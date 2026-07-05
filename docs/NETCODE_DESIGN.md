# Netcode Design — client prediction + reconciliation + snapshot interpolation (v0.107)

> Adversarially design-reviewed BEFORE implementation (4-lens panel, 24 findings). The synthesis below is the AMENDED, binding design. Implementation follows it exactly.

All load-bearing claims verified against the code. Verdict on the design: **architecturally sound** (predict-self / snapshot-interp remotes / tick-locked patches is the right shape), but **not implementable as written** — three foundations (server timestep, mv/vh reconciliation source, queue discipline) must change first. No finding misread the code badly enough to reject outright; one is partially superseded (noted).

---

## MUST-CHANGE (blockers — amend before P1 coding)

**1. Server must be fixed-timestep before prediction exists.**
Colyseus passes real elapsed time (`onTickCallback(this.clock.deltaTime)`, @colyseus/core `build/Room.js:347-349` — verified) and `GameRoom.ts:938` integrates with it (`Math.min(deltaMs, TICK_MS*2.5)/1000`). Client replays fixed 50ms steps; `steerVelocity`'s `k=1-exp(-rate·dt)` (movement.ts:94) and `pos += v·dt` make server state irreproducible from the input stream alone.
**Amendment:** accumulate `deltaMs` in `update()`, run `floor(acc/TICK_MS)` fixed 50ms sub-steps, one input command consumed per sub-step, `broadcastPatch` after the batch (ackSeq = last consumed). Existing tests call `update(50)` and are unaffected. This also fixes the "server ticks slower than client produces" drift (finding: latency ratchet) at the source — the accumulator catches up.

**2. Sync `mvx`/`mvy` on PlayerState; delete the `pending[ack].postMv` rebase.**
Confirmed mv lives only in the server-private `InputState` (GameRoom.ts:179, 890, 948-950); PlayerState syncs only impulse vx/vy (state.ts:78-79). The "mv evolves only from the input stream" invariant is broken by the plan's own held-fallback (same seq steered twice on a starved tick), drop-oldest (seqs consumed zero times), and freezes. Three reviewers independently derived divergence.
**Amendment:** append `mvx`/`mvy` floats to PlayerState (schema v6 is bumping anyway), adopt at reconcile exactly like impulse vx/vy. Removes postMvx/postMvy bookkeeping from the pending array entirely.

**3. Queue discipline: consume+ack every tick for EVERY player; add a drain rule.**
`GameRoom.ts:942-943` skips `!alive || inLevelWindow` players before input is touched — the plan keeps this, so queues pin at cap during 5s level windows / minutes downed, ackSeq stalls, and 8 stale commands (~400ms) replay on unfreeze. Separately, consume-1/tick vs drop-oldest means any burst backlog never shrinks: permanent +400ms latency ratchet.
**Amendment:** (a) hoist `queue.shift(); held=cmd; player.ackSeq=cmd.seq` above the alive/level-window gate — skip only integration (this also implements the plan's level-window mv-zero naturally); (b) when queue depth >1 after a shift, drop to the newest command and ack its seq (safe: input only sets direction; client's "drop pending ≤ ackSeq" already tolerates ack jumps); keep cap 8 as safety net; (c) clear queue+held inside `zeroMoveVel` (GameRoom.ts:1831) so every teleport site gets it free; (d) client rule: reconcile whose ackSeq has no pending entry ⇒ hard resync.

**4. Validate `seq` explicitly or one crafted message kills the process.**
The current handler coerces only dx/dy (GameRoom.ts:369-370). @colyseus/schema's decorated setter asserts type on assignment; `GameRoom` defines no `onUncaughtException` (verified: zero hits in packages/server/src) so Colyseus does NOT wrap the tick callback (`build/Room.js:344-346` wraps only when defined) — `player.ackSeq = "x"` throws out of the timer and kills Node.
**Amendment:** `seq = (Number.isFinite(message?.seq) ? message.seq : 0) >>> 0`; drop commands whose seq isn't strictly greater than the last accepted (monotonic ackSeq, replay-proof). Also define `onUncaughtException` in GameRoom as defense-in-depth.

**5. Fold jump into the sequenced command and give vh a rebase source.**
Jump is a separate un-seq'd message (`GameRoom.ts:513-520` sets `c.jumpBuffer`; consumed on an arrival-timed tick at ~1068); `vh` is server-private (CombatState; state.ts syncs `height` only — verified line 72, no `vh` anywhere in state.ts). A one-tick trigger disagreement = an uncorrectable ~0.45s height arc and predicted-vs-actual pit-fall divergence.
**Amendment:** command becomes `{seq, dx, dy, jump}` consumed on the acked tick (keep the buffer semantics server-side); append `vh` to PlayerState and rebase it at reconcile alongside height.

**6. Add a synced server tick counter; never stamp snapshots with client receive time.**
Confirmed no usable timeline field exists: ArenaState.elapsed (state.ts:177) only advances in active-arena mode (GameRoom.ts:1019-1021) and resets on mode changes. Receive-time stamping collapses under TCP head-of-line bursts (200ms of motion lands in ~1ms of timeline) — reintroducing the rubber-band this plan exists to fix.
**Amendment:** append `@type("uint32") tick` to ArenaState, incremented unconditionally per sub-step in `update()`; stamp snapshots `t = tick*TICK_MS`; drive renderTime from an adaptive offset (sliding-window min of `recvTime − tickTime`). Bonus: guarantees hasChanges every tick, keeping patches truly tick-locked.

**7. Add `teleportSeq` — the hard-resync trigger list misses toggleTraining today.**
Verified: `toggleTraining` (GameRoom.ts:686-729) repositions to arena centre + `zeroMoveVel` with NO mintMap and no trigger from the plan's list; `state.mode` flips at 690/731 but isn't a trigger. The trigger list is a hand-maintained mirror of zeroMoveVel call sites and is incomplete on day one.
**Amendment:** append `@type("uint32") teleportSeq` to PlayerState, incremented inside `zeroMoveVel` itself (covers all 5 sites: GameRoom.ts:728, 804-ish revive, 1014 pit, restart, descend + all future ones); make it a hard-resync trigger.

**8. Preview must be a pure function of the last tick's state, single step of size `timeSinceTick`.**
`stepSteeredMovement` integrates `pos + v_end·dt` (movement.ts:122-125) — position integration does NOT compose across sub-steps (only the velocity blend does; the exactness comment at movement.ts:72-73 is about velocity). Cumulative per-frame stepping produces a ~3.5px seam at every tick boundary during accel/decel, 20×/s.
**Amendment:** spec the render preview as `preview = step(lastTickPred, timeSinceTick)` recomputed each frame, never mutating pred. Then preview(50ms) ≡ the next real tick by construction.

**9. Purity gate must cover the newly replicated modules.**
`tests/purity.test.ts:22` lists only `["combat.ts","melee.ts","enemies.ts","mapgen.ts"]` (verified). Prediction replicates movement.ts + collision.ts.
**Amendment:** add `"movement.ts"`, `"collision.ts"` to REPLICATED_MODULES in the same commit that lands P2.

---

## SHOULD-CHANGE

**10. Remote pit-fall snap vs snapshot buffer (v0.105 regression).** `ArenaScene.ts:810-818` hard-snaps the rig on fellSeq specifically to defeat the interpolator; the ring buffer would overwrite it next frame and re-walk the rig into the pit (snap distance < INTERP_SNAP_PLAYER=200 so the gap-teleport never fires). Amendment: on a remote fellSeq bump, purge + reseed that player's buffer with one post-snap snapshot; for self, make the fellSeq hard-resync predictor-state-only (never touch the rig in onStateChange — checkFalls at ArenaScene.ts:966 runs before the render step at 975+).

**11. Hit-stop unfreeze pop.** Freeze gate at ArenaScene.ts:975 currently relies on the tau≈154ms lerp (being removed for self) to glide the catch-up; predictor keeps ticking through a 130ms quake freeze ⇒ ~42px instant pop on unfreeze. Amendment: when the gate lifts, fold `(predRenderPos − lastDrawnPos)` into the decaying error offset.

**12. Client accumulator burst clamp.** Verified `forceSetTimeOut` browser path (main.ts:29-33) + the project's known hidden-tab throttling; a 1s wake fires ~20 ticks/sends. Amendment: clamp accumulator to ≤3 ticks/frame; on frame gap >250ms reset the accumulator, resend held keys once, hard resync. (G3's drain rule already prevents the permanent backlog; this kills the transient chaos.)

**13. Pending-overflow (64 entries) has nothing fresh to resync TO during a stall.** Amendment: on overflow with no new ack, freeze the predictor (stop advancing/recording, keep sending), show a connection-degraded hint past ~1-2s of ack silence, hard-resync when the next patch actually arrives.

**14. Level-window (flexPending) resync = backward snap of up to RTT×320px/s.** Amendment: implement the freeze resync as an error-offset fold (glide ~80ms under the level-up UI), not an instant rig snap.

**15. Seed-change reconcile ordering.** On rift descent the same patch carries new seeds + teleport (mintMap and reposition in one tick; broadcastPatch is last). Amendment: on seed-key change, regenerate/swap the client ArenaMap BEFORE the replay step; initialize SelfPredictor only after the first patch with non-zero seeds. NOTE: synchronous 4x-arena regen inside onStateChange is a frame hitch — measure it.

**16. Enemy-id recycling vs ring buffers.** `enemySeq` resets on restart and dummy0-2 ids are fixed. Amendment: prune each enemy's snapshot buffer in the same removal block that prunes enemyPrev/enemyHp/enemyAtk/enemyWindup (ArenaScene.ts:~1048), and clear all buffers in maybeBuildFloor's rebuild branch (seedKey change).

**17. Self-position consumers.** updatePoiOcclusion / updateEdgeArrow (ArenaScene.ts:~2178, ~2203) read raw state self coords; after prediction the rig LEADS state by RTT/2 so occlusion fade/arrow lag visibly. Amendment: route both through a `getSelfRenderPos()` accessor in P4.

**18. Input-handler rate cap.** Pre-existing surface, but the fixed-rate protocol makes abuse detectable. Amendment: per-client message counter reset per second; ignore past ~60 msg/s, kick on sustained abuse. One integer.

---

## NOTES (no design change required)

- **Partially superseded finding:** the standalone "server ticks strictly slower than client production" latency-creep argument is resolved by #1 (server accumulator catches up to true 20Hz average) + #3's drain rule; no separate action.
- With #2 (synced mv) landed, the held-fallback repeat and drop-oldest cases become harmless to reconciliation — do NOT also implement the "re-apply steerVelocity per extra held-consumption" alternative; it's dead complexity.
- Schema appends (ackSeq, mvx, mvy, vh, teleportSeq, ArenaState.tick) are all end-appended; one SCHEMA_VERSION 5→6 bump covers everything; golden digest is named-field and unaffected (verify the digest test still passes since tick increments every update).
- Implementation order: #1, #3, #4 are P1 (server protocol); #2, #5, #7, #8, #13, #14, #15 are P2 (predictor); #6, #10, #16 are P3 (snapshots); #11, #12, #17 are P4; #9, #18 ride whichever commit touches the file.
