# Jump Feel — Tech Spec

Panel: jumpfeel (higher satisfying jump + ground pound · crouch-commit distance jump over pits)
Role: TECH IMPLEMENTER · Target: server-authoritative 20Hz sim + client prediction
Read basis: `movement.ts` (stepVertical/stepSteeredMovement/stepImpulse — all pure), `GameRoom.ts`
jump path (msg handler ~1123, command-riding jump ~2242, buffered consume + stepVertical 2481–2491,
pit-fall 2351–2402, quake resolve 4583–4614, detonate 5253–5301, zeroMoveVel 5188–5202),
`prediction.ts` end to end (+ its tests), ArenaScene input sampler (9419–9455, jumpQueued 971/3038),
`constants.ts` (jump/gravity/map blocks), `state.ts` PlayerState, `mapgen.ts` (isPitAtPx,
nearestGroundPx, safeSpawnPos), `docs/enemycombo-panel/tech-implementer.md` (juggle vh channels,
juggledSeq, schema claims).

---

## 0. Substrate — what already exists (extend, never replace)

| Need | Existing precedent | Where |
|---|---|---|
| Vertical axis | `player.height`/`player.vh` synced; `stepVertical` pure + shared | `movement.ts` 193–201, `state.ts` 93/118 |
| Jump intent on the acked timeline | `cmd.jump` rides the seq'd InputCmd (review #5: "so its consume tick is part of the acked timeline"); the `"jump"` message is the legacy twin | `GameRoom.ts` 288–300, 2240–2245, 1123–1131 |
| Held input-state pattern | `fireHeld` sampled into EVERY command; server treats it as state, not an event | `InputCmd.fireHeld`, ArenaScene 9435–9444 |
| Buffered consume gate | `jumpBuffer`/`jumpCd` aged per tick; hop fires at 2482 only when `acting && grounded && cd<=0` — all laws re-checked at consume (anti-cheat posture) | `GameRoom.ts` 2469–2486 |
| Airborne exemptions | pit-fall (2364) and boss quake (4599) both gate on `height > GROUND_EPSILON` | `GameRoom.ts` |
| Player-AoE-vs-enemies with full bookkeeping | `detonate(x, y, radius, damage, crit, sourcePlayerId, sourceWeaponId, delivery)` — grid query, damageEnemy, worm slots, kills/XP/portal | `GameRoom.ts` 5253–5301 |
| Deferred ground blast | `pendingQuakes` (epicenter captured at commit, detonated at landing) — exactly the pound's shape | `GameRoom.ts` 560, 2575–2593, 2981–2994 |
| WYSIWYG blast radius | `ProjectileState.explodeR` — "client renders a blast of exactly this radius" | `state.ts` 290 |
| Nav-valid placement | `safeSpawnPos` (mapgen 1214), `nearestGroundPx` (1180), belt `beltSafeX`/`clampBeltFloorY` — used by every spawn/teleport/reposition | `mapgen.ts`, `GameRoom.ts` 2374/2392 |
| Teleport reconcile signal | `zeroMoveVel` bumps `teleportSeq` — "the ONE hard-resync signal" | `GameRoom.ts` 5188–5202 |
| Vertical reconcile | prediction is "local-first, adopt-on-divergence": rebase at acked height/vh, replay pending jumps, adopt only a >12px residual (`HEIGHT_ADOPT_PX`) | `prediction.ts` 36–39, 308–335 |
| Deterministic pending replay of un-synced timers | `PendingPredCmd.jumpCdBefore/jumpBufBefore` — rebase points for timers the server never syncs | `prediction.ts` 79–93, 311–316 |
| Transition-only VFX counters | `fellSeq`, `parriedSeq`, `revivedSeq`, `juggledSeq` (combo wave) | `state.ts` |

---

## 1. INPUT ENCODING

### 1.1 Space tap-vs-hold discrimination (client-side, ArenaScene)

Space currently fires `jumpQueued = true` on `JustDown` (ArenaScene 3038). New sampler, all local:

- **`JustDown` while predicted-airborne** (`predictor` height > `GROUND_EPSILON`) → queue **pound**
  (one-shot, like `jumpQueued`). Grounded-ness is read from the LOCAL prediction, so the check is
  frame-fresh, not RTT-stale.
- **`JustDown` while predicted-grounded** → start a hold timer (`spaceDownMs`). Nothing is sent yet.
- **`JustUp` with `spaceDownMs < CROUCH_HOLD_MS`** → this was a TAP → `jumpQueued = true` (normal
  jump, unchanged semantics from here on).
- **still down at `CROUCH_HOLD_MS`** (and still grounded) → this is a HOLD → begin setting
  `crouchHeld = true` on every minted command until release. **`JustUp` after the threshold** → the
  `crouchHeld` true→false edge in the command stream IS the distance-jump trigger (server-derived,
  §2.4). No separate "launch" message exists.

**Threshold: `CROUCH_HOLD_MS = 150`.** Median keyboard tap is ~80–120ms, so ≥99% of intended taps
resolve under 150; anything longer reads as intentional. Cost analysis: the tap jump moves from
press-triggered to release-triggered, adding the player's actual press duration (~90ms median,
150ms worst case) before the command is minted. This is acceptable because (a) the jump is
explicitly "PURE movement, NOT a dodge" (GameRoom 1120–1122) — its only timing role is quake-
hopping, where telegraphs wind up for 0.6s+ and `JUMP_BUFFER_SECONDS = 0.25` already tolerates far
coarser timing; (b) the *visual* hop still starts the frame the command is minted (predicted
locally — ArenaScene 6349's "hop starts the frame you press SPACE" becomes "the frame you release",
zero network latency either way); (c) the alternative (jump on press, crouch on a different key)
violates the directive's single-key design, and jump-on-press-then-convert would waste a jump
cooldown on every crouch attempt.

### 1.2 Crouch-commit: input-STATE on the seq'd command (the fireHeld pattern) — verdict

**Crouch rides the command as a held flag (`crouchHeld: boolean`), NOT discrete crouchStart/
crouchEnd messages.** The argument, in the architecture's own terms:

1. **The acked-timeline law.** Review #5 already moved `jump` from an out-of-band message onto the
   seq'd command precisely so "its consume tick is part of the acked timeline". Crouch is *more*
   timeline-sensitive than jump: the commit duration and the release edge are gameplay (the release
   edge launches a dash whose direction is sampled at that tick). Discrete messages are consumed via
   the action budget outside the per-tick command consume — their tick of effect is whatever tick
   the message happens to land on, which the predictor cannot replay. A held flag on the command has
   an exact, replayable consume tick.
2. **Determinism for prediction.** The predictor replays `pending` commands through the shared
   steppers (prediction.ts 317–320). A `crouchHeld` bit per command makes crouch entry, commit
   progress, and the release-edge launch a pure function of the command stream — replayable
   byte-exact, like `jump`/`jumpBuf` today. Discrete messages would force the crouch to be
   authoritative-only, i.e. the pause would begin a full RTT late — the single worst place to add
   latency in this feature, because the crouch is a *feel* beat the player is actively holding.
3. **Edge-derivation is free.** The server keeps the previous tick's flag (one boolean in
   `CombatState`); `prev && !cur` = release edge, `!prev && cur` = press edge. Same trick the beam
   uses with `beamInputWasHeld`.
4. **Latency accounting.** Held-flag: crouch visually starts locally at the threshold frame
   (predicted), authoritatively ≤1 command interval (50ms) + uplink later — identical to movement.
   Discrete message: authoritative start at RTT/2 + budget scheduling, client cannot predict without
   inventing a second, unacked timeline. No contest.

### 1.3 Pound trigger encoding (mid-air)

**`pound: boolean` — a one-shot edge flag on the InputCmd, exactly like `jump`** (not a held state:
a pound is a discrete commit, not a stance you hold before it fires). Client sets it on the next
minted command after a mid-air Space press; server consumes it in the same block that consumes
`cmd.jump` (2242): if `height > GROUND_EPSILON && stance === normal-airborne && !poundUsed` →
commit the pound (§2.6). No buffer (a grounded pound press is discarded — there is nothing
sensible to queue; the airborne window is seconds long, not a 50ms slot).

**Named trade-off:** today a mid-air Space press seeds `jumpBuffer` (the de-clunk queue-a-hop).
That mid-air press now means *pound*. The buffer is NOT deleted — it still catches presses made
while grounded during the cooldown remainder, which is its main job (`JUMP_COOLDOWN 0.7 −
airtime ≈ 0.25s` post-landing dead window ≈ exactly `JUMP_BUFFER_SECONDS`). Only the "press while
still airborne to queue the next hop" convenience is spent, deliberately, on the pound.

### 1.4 InputCmd / PredCmd diff

```ts
// GameRoom.ts InputCmd + prediction.ts PredCmd + ArenaScene mint — appended fields:
crouchHeld: boolean;  // held state, sampled every command (fireHeld pattern)
pound: boolean;       // one-shot edge (jump pattern)
```
`zeroMoveVel`'s held-reset (5194) adds `crouchHeld: false, pound: false`. The `"jump"` legacy
message stays as-is; no `"crouch"` message is added.

---

## 2. SERVER STATE MACHINE

### 2.1 States and where they live

```
grounded ──hold≥commit──▶ crouching ──release──▶ dashing (distance jump, airborne)
   │ tap                       │ cancel laws          │ land
   ▼                           ▼                      ▼
 rising ─▶ apex ─▶ falling ─▶ grounded ◀── pound-landing ◀── pounding
              │ pound press (any airborne phase)          ▲
              └───────────────────────────────────────────┘
```

**Storage law: store only what is not derivable.** `rising/apex/falling` are pure derivations of
the already-synced `(height, vh)` (`rising: vh > 0`, `apex: |vh| < APEX_EPS`, `falling: vh < 0`) —
they get **no storage and no wire**. Only the *committed modes* need state, and it lives
server-private in the per-player **`CombatState`** map (the same home as `jumpCd/jumpBuffer/vh` —
audit-#14 posture: precise gameplay state stays server-private):

```ts
// CombatState — appended (server-private, no @type):
stance: 0 | 1 | 2 | 3;   // 0 normal · 1 crouching · 2 dashing · 3 pounding
crouchT: number;         // seconds held in crouch (commit gate)
crouchPrevHeld: boolean; // previous tick's crouchHeld — edge derivation
crouchAimX: number;      // last non-zero held (dx,dy) seen DURING the crouch — the soft-lock sample
crouchAimY: number;
dashDirX: number;        // locked unit direction, frozen at launch
dashDirY: number;
dashSpeed: number;       // px/s, computed at launch so the flight lands ON the validated point
distJumpCd: number;      // distance-jump cooldown, sec (aged with jumpCd at 2469)
poundUsed: boolean;      // one pound per airborne arc; reset on landing
recoveryT: number;       // post-pound landing lag, sec (movement input suppressed)
```

### 2.2 Synced fields (remote rendering + reconcile) — appended, minimal

```ts
// state.ts PlayerState — APPENDED at the end (after the combo wave's juggledSeq):
/** Committed movement stance for remote pose: 0 none · 1 crouch · 2 distance-jump · 3 pound. */
@type("uint8") moveStance = 0;
/** Bumped at each pound LANDING — client fires the WYSIWYG POUND_RADIUS ring + camera thump. */
@type("uint8") poundSeq = 0;
/** Bumped on every SERVER-FORCED stance cancel (hit-cancel, level-window, death) — the predictor's
 *  soft stance-resync signal (§3.3). Never bumped on organic transitions. */
@type("uint8") stanceSeq = 0;
```

Remotes need nothing else: position/height/vh are already synced and smoothed (ArenaScene 6349),
pose comes from `moveStance`, dash facing from the already-synced `mvx/mvy`.

**Wire cost** (Colyseus delta encoding — changed fields only): three uint8s, each ~2B per change.
A full crouch→dash→land sequence = 4 `moveStance` edges ≈ 8B; a pound = 2 edges + 1 `poundSeq`
≈ 6B; `stanceSeq` only on forced cancels. Worst case (4 players spamming every cooldown) is well
under **50 B/s total** — zero per-tick unconditional mutations, honoring the schema-bandwidth
discipline (`windup`/`t` remain the only per-tick movers).

**Schema discipline — coordination statement:** master is at `SCHEMA_VERSION = 17`; the in-flight
improvement wave (combat receipts + `sigGateQueue`) has claimed **18** (already in this branch's
`constants.ts`); the enemy-combo wave being implemented NOW claims **19** (`comboSeq/comboFlags/
juggledSeq`). **This feature takes the next available: `SCHEMA_VERSION = 20`**, and its three
fields are appended AFTER `juggledSeq`. One wave = one bump; whoever merges later rebases their
appends after the earlier wave's and re-verifies the number.

### 2.3 Crouch laws (authoritative, all enforced at consume — client flags are requests)

1. **Entry:** `crouchHeld` press edge + `grounded` + `alive` + `!inLevelWindow` + `stance === 0`
   + `recoveryT <= 0`. (`jumpCd` does NOT gate entry — crouching is not a jump; the *launch* is
   gated by `distJumpCd`.)
2. **While crouching:** the body is STATIONARY — the movement phase treats held `(dx,dy)` as zero
   (steering decelerates to rest via the existing no-input branch of `steerVelocity`), but the raw
   held input updates `crouchAimX/Y` every tick (the soft-lock is *steered by intent, moved by
   nothing*). `windup`-style tell: `moveStance = 1` is the remote pose; the crouch IS the telegraph.
3. **Commit gate:** release before `CROUCH_COMMIT_SECONDS` (0.25s = 5 ticks) → stand, nothing
   happens (an aborted crouch is free). Release at/after commit + `distJumpCd <= 0` → LAUNCH (§2.4).
   Release after commit but on cooldown → stand (no buffer: a committed pause into a fizzle reads
   worse than a visible cooldown pip on the HUD).
4. **Cancel laws (server-forced, each bumps `stanceSeq` + resets to stance 0):**
   - taking ANY damage (`damagePlayer` hook) — the commit is interruptible; enemies punish it;
   - attack / parry / beam `fireHeld` consumed — offensive/defensive tools always win over the pose;
   - level-window freeze, death, pit snap-back, rift descent (the `zeroMoveVel` sites — those
     already bump `teleportSeq`, which is strictly stronger; bump `stanceSeq` anyway for uniformity);
   - a juggle launcher hit (combo wave) — the launch takes the body (§4.1).
5. Crouch input while airborne is ignored (no buffered air-crouch; keep the machine one-deep).

### 2.4 Distance jump: soft-lock sampling tick + clamp law + flight

**Sampling tick:** the tick that consumes the release-edge command. Direction = the unit of that
tick's held `(dx,dy)`; if degenerate, `crouchAimX/Y` (last non-zero intent during the crouch); if
still degenerate, `aimDir`. This is the "soft" in soft-lock: you steer the lock with WASD the whole
pause and the LAST intent wins — sampled from authoritative server-side state at one tick, worm-
action style, never from the future.

**Clamp law (nav-valid landing via the exact placement functions everything else uses):**

```
L_raw = pos + dir × DIST_JUMP_REACH
L1    = clamp(L_raw, PLAYER_RADIUS, ARENA−PLAYER_RADIUS)          // arena bounds (movement.ts law)
L2    = arena: safeSpawnPos(this.map, L1.x, L1.y, PLAYER_RADIUS)  // nudges off pits + POIs — the
        belt:  x'=beltSafeX(level, L1.x, pos.x); y'=clampBeltFloorY(level, x', L1.y, PLAYER_RADIUS)
dashDir   = unit(L2 − pos)                                        // re-derive after clamps
dashSpeed = |L2 − pos| / DIST_JUMP_AIRTIME                        // land ON the point, exactly
vh        = GRAVITY × DIST_JUMP_AIRTIME / 2                       // symmetric arc, airtime-locked
```

Same functions as spawns/teleports (`safeSpawnPos` — GameRoom 1645/6320/6527…), so the landing is
ground by construction; the flight itself is honest physics (no teleport): position integrates
through the normal movement phase every tick with the steering OVERRIDDEN to `dashDir × dashSpeed`
(held input ignored for steering during `stance === 2`; `mvx/mvy` sync the override so remotes and
the predictor rebase exactly). POI collision (phase 2.4) still runs — a mid-flight clip resolves as
today and the residual folds into prediction error. Landing = `height` returns to 0 → stance 0,
steering velocity continues at `dashDir × MOVE_SPEED` (momentum carries; no hitch on a clean land),
`distJumpCd = DIST_JUMP_COOLDOWN`.

**Direction is HARD-locked in flight** (input cannot steer a dash) — that is the counterweight for
its speed, and it keeps the flight a two-constant pure function the predictor replays for free.

### 2.5 Pit-clearance math vs the real hoppable widths

Ground truth from `constants.ts`: `MAP_TILE = 80`; the generator's connectivity guarantee bridges
any REQUIRED gap wider than `MAP_MAX_JUMP_TILES = 2` (160px); pit blobs elsewhere can be wider
(optional shortcuts). Pit test is center-point (`isPitAtPx`, mapgen 1084) at grounded ticks only.

| Jump | Airtime | Horizontal | Reach | Clears |
|---|---|---|---|---|
| Hop (today) | 2·303/1350 = 0.449s | MOVE_SPEED 320 | **144px** | 1.8 tiles — technically UNDER the 2-tile (160px) guarantee; works in practice only via tile quantization + edge slop |
| Hop (new, §2.7) | 2·360/1350 = 0.533s | 320 | **171px** | 2.14 tiles — the guarantee now holds with margin, fixing the latent 144<160 shortfall |
| Distance jump | DIST_JUMP_AIRTIME 0.40s | ≤ DIST_JUMP_REACH/0.40 = 650 | **260px** | 3.25 tiles — clears every 3-tile (240px) gap with a 20px landing margin, plus the safeSpawnPos nudge |

`DIST_JUMP_REACH = 260`. The margin law: reach must exceed the target gap by ≥ `PLAYER_RADIUS/2`
so a launch from the pit lip lands center-on-ground before the next grounded pit check; 260 − 240 =
20px satisfies it, and the §2.4 clamp guarantees the *aimed* point is ground regardless. Update the
`MAP_MAX_JUMP_TILES` derivation comment (constants 203–209) to the new hop numbers; the constant
itself does NOT change (required crossings stay 2-tile — the distance jump is reward, not a new
minimum-skill floor).

### 2.6 Ground pound

- **Commit** (consume of `cmd.pound`, gates in §1.3): `stance = 3`, `c.vh = −POUND_SPEED` (900
  px/s — a committed descent, ~0.05s from hop apex, ~0.17s from a full parry-launch loft),
  `poundUsed = true`, `moveStance = 3`. Horizontal steering is zeroed for the descent (a pound
  drops straight — WYSIWYG for enemies under the shadow).
- **Landing** (the tick `stepVertical` returns height 0 while `stance === 3`): resolve
  `detonate(player.x, player.y, POUND_RADIUS, poundDamage, critChance(player), player.id,
  "pound", CombatDelivery.Quake)` — the §0 machinery with full kill/XP/portal/receipt bookkeeping
  (receipts require `sourcePlayerId`, which a pound has, unlike enemy hits). `poundSeq++`,
  `jumpCd = max(jumpCd, JUMP_COOLDOWN)`, `recoveryT = POUND_RECOVERY` (0.2s: movement input
  suppressed — the landing has weight), stance 0, `poundUsed` reset.
- **WYSIWYG:** `POUND_RADIUS` is a shared constant; the client draws the ring at exactly that
  radius on the `poundSeq` edge at the landing position (the `explodeR` precedent, state.ts 290 —
  but as a constant, not a per-entity float, since the radius never varies). Damage ships flat
  (`POUND_DAMAGE` × the same STR-scaled melee multiplier path); height-scaled damage is a tuning
  stretch, NOT ship-first.
- Pound is legal from any airborne phase including a parry-launch loft (fun composes); one per
  airborne arc (`poundUsed`).

### 2.7 Cooldown / exhaustion enforcement (all server-side, re-checked at consume)

- `JUMP_VELOCITY 303 → 360` (peak 34→48px, airtime 0.449→0.533s) — jump 1's "higher, satisfying".
  `JUMP_COOLDOWN` stays 0.7 (airtime grew into it; the post-landing dead window shrinks 0.25→0.17s,
  a feel win, and `JUMP_BUFFER_SECONDS 0.25` still covers it).
- Optional apex-hang knob (satisfying floatiness): `stepVertical` gains a gravity multiplier
  `APEX_HANG` (~0.6) while `|vh| < APEX_HANG_BAND` (~60). It lives in the SHARED stepper so server
  and predictor stay byte-identical by construction; golden fixtures re-record. Tuning-flagged, off
  by default in the first PR.
- `distJumpCd = DIST_JUMP_COOLDOWN` (2.5s) set at launch; aged next to `jumpCd` (2469). The crouch
  itself is free — the cooldown gates the launch, so holding crouch on cooldown just poses.
- Pound: gated by `poundUsed` (one per arc) + implicitly by jump availability; landing recovery
  `POUND_RECOVERY` is the exhaustion (you cannot chain pound→instant-dash; recovery blocks crouch
  entry per §2.3-1).
- No stamina system is introduced; three timers in `CombatState` are the whole economy.

New shared constants: `CROUCH_HOLD_MS 150`, `CROUCH_COMMIT_SECONDS 0.25`, `DIST_JUMP_REACH 260`,
`DIST_JUMP_AIRTIME 0.40`, `DIST_JUMP_COOLDOWN 2.5`, `POUND_SPEED 900`, `POUND_RADIUS 120`,
`POUND_DAMAGE` (tune vs. melee baseline), `POUND_RECOVERY 0.2`, `APEX_HANG/_BAND` (flagged),
`STANCE_NONE/CROUCH/DASH/POUND`, `SCHEMA_VERSION 20`.

---

## 3. PREDICTION

### 3.1 What predicts, what is authoritative-only

| Piece | Predicted? | Why |
|---|---|---|
| Tap jump | YES (today, unchanged) | command-stream-deterministic |
| Crouch enter/pose/commit timer | **YES** | §3.2 |
| Distance-jump launch + flight | **YES** | launch = pure function of (release edge, held dx/dy, distJumpCd); flight = two frozen constants through the shared steppers. One caveat: the predictor clamps `L` through `safeSpawnPos` on the CLIENT's map — which is the SAME map (server-seeded, shared mapgen; the predictor already holds it via `setMap` for POI collision), so the clamp replays identically. |
| Pound descent | **YES** | `vh = −POUND_SPEED` off the command's `pound` bit — deterministic |
| Pound landing AoE / damage / poundSeq | **NO — authoritative-only** | world interaction (enemy HP, kills, receipts); client plays the ring/thump off the `poundSeq` edge, and the local rig can pre-play landing dust off its own predicted landing (cosmetic only) |
| Server cancels (hit-cancel, juggle steal, freeze) | NO | arrive as divergence; §3.3 |

### 3.2 Why the crouch pause is client-predictable — the argument

The crouch is a pure function of inputs the client already owns: its OWN `crouchHeld` bits (in the
pending command window), a timer (`crouchT`), and a cooldown (`distJumpCd`) — the identical input
class as `jumpBuf`/`jumpCd`, which the predictor already replays deterministically via the
`PendingPredCmd.*Before` rebase-point pattern (prediction.ts 79–93). No RNG, no other actor, no
world query participates in entry, progress, or the release-edge launch (the `safeSpawnPos` clamp
queries the map, which is seeded + shared). The ONLY divergence sources are server-forced cancels
(damage, freeze) — rare, and handled by the divergence rail below. Predicting it matters
double: the pause is the feature's feel beat (a RTT-late sink would read as input lag), and the
launch direction is sampled from held input at a specific tick the client must be able to trust.

Mechanics: extend `PendingPredCmd` with `crouchTBefore/distCdBefore/poundUsedBefore/stanceBefore`
(the exact `jumpCdBefore` precedent); `stepPredictedVertical` grows into a stance-aware step that
mirrors the server's consume order (latch flags → age timers → transitions → `stepVertical`); the
horizontal step overrides steering with the dash constants while replayed stance is 2, and zeroes
it while 1/3 — all inside the existing `tick()`/`reconcile()` replay loops.

### 3.3 Reconciliation — existing rails, plus ONE genuinely new need

Existing rails cover almost everything:
- **Vertical:** adopt-on-divergence (`HEIGHT_ADOPT_PX = 12`, prediction.ts 330–335) absorbs a
  denied pound, a denied dash arc, and juggle launches — unchanged, by design ("a denied jump / an
  unpredicted launch" is its own comment).
- **Horizontal:** rebase-from-synced-truth (`mvx/mvy` are synced and adopted every patch) + replay
  + error-offset glide; a cancelled dash's speed override disappears on rebase and the residual
  glides out under `INTERP_SNAP_PLAYER`.
- **Teleports:** `teleportSeq` (zeroMoveVel) already hard-snaps pit snap-backs and rift moves —
  untouched; dash/pound never call `zeroMoveVel` mid-flight (they are physics, not teleports).

**THE GENUINELY NEW NEED — say it loudly: `stanceSeq`, a soft stance-resync signal.** The one hole
in the existing rails: after a rebase, the predictor REPLAYS its pending commands — and the pending
window still contains the `crouchHeld`/`pound` bits that legitimately derive a crouch/dash/pound
locally. If the server force-cancelled the stance (hit-cancel, juggle steal, freeze edge), a plain
rebase-and-replay would resurrect the denied stance every patch until the pending window drains —
a mode disagreement, not a position residual, so neither `HEIGHT_ADOPT_PX` (vertical-only) nor the
error offset (position-only) can see it, and `teleportSeq` is too blunt (hard camera snap for a
non-teleport). Fix: on a `stanceSeq` change, the predictor adopts the server's `moveStance` +
clears its local stance timers and strips stance-deriving flags from the still-pending commands,
WITHOUT zeroing the error offset (position continuity — it glides). ~15 lines in `reconcile()`,
plus `moveStance`/`stanceSeq` added to `ServerView`. This is the only new reconciliation concept
this feature introduces; everything else rides adopt-on-divergence + rebase precedents verbatim.

### 3.4 Recommended (small) refactor while we are here

`stepPredictedVertical` currently DUPLICATES the server's buffered-jump consume order client-side
(prediction.ts 100–125 vs GameRoom 2481–2491). The stance machine triples the shared surface —
promote one pure `stepJumpStance(state, cmd, dt)` into `packages/shared/src/movement.ts` and call
it from BOTH GameRoom and the predictor. Kills the whole "mirrored constants drifted" divergence
class before it grows. Pure, engine-free, unit-testable next to `stepVertical`.

---

## 4. INTERACTION LAWS

### 4.1 vh authority vs enemy juggles — ONE displacement-priority law

The combo wave's juggle writes `vh` (add-capped launch, assignment refresh) through the same
channel our jumps and pound use. The single law:

> **`vh` is one channel with ranked writers: POUND (3) > ENEMY JUGGLE (2) > ADDITIVE LAUNCHES
> (parry-launch) (1) > JUMP/DASH SEED (0). A committed higher-ranked state ignores lower-ranked
> writes for its duration; a higher-ranked write into a lower-ranked state TAKES the channel and
> force-cancels that state (bump `stanceSeq`).**

Concretely: a juggle launcher hitting a croucher/dasher cancels the stance and lofts them (enemies
punish the commit — coherent with §2.3-4); a juggle air-keep during a pound descent is IGNORED
(the pound is a ~0.1s committed slam; letting a keep reverse it mid-drop would read as a glitch,
and the pound's landing lag is the enemy's counter-window instead); parry-launch keeps its additive
compose everywhere except into a pound. Implementation is a 3-line guard where juggle/parry write
`c.vh` (`if (c.stance === STANCE_POUND) return`), plus the cancel hook — no new fields.

### 4.2 Quake-dodge eligibility per jump type

`applyBossQuake` (4599) and pit-fall (2364) gate on `height > GROUND_EPSILON` — unchanged, and the
law falls out per type:

| State | Airborne? | Quake | Pit |
|---|---|---|---|
| rising / apex / falling (tap jump) | yes | CLEARS | clears |
| dashing (distance jump) | yes | CLEARS | clears (that is jump 2's whole pitch) |
| pounding (descent) | yes until landing | CLEARS mid-descent; the landing tick is grounded — a quake resolving that exact tick hits (fair: you chose to land) | clears until landing |
| crouching | no | **HIT** — the crouch is a commit, not a dodge | n/a (crouch requires ground) |
| pound recovery | no | HIT | normal |

No special-case code: every row is the existing height gate evaluated at the resolve tick.

### 4.3 i-frame policy

**No member of the jump family grants i-frames — reaffirming the existing law** (GameRoom
1120–1122: "PURE movement, NOT a dodge (no i-frames — the parry stays the defensive tool)").
Distance jump's defense IS the airborne exemptions; pound landing gets no mercy window (recovery
lag is a vulnerability, deliberately); crouch is hittable and cancellable. The only i-frame sources
remain parry `invuln` and `pitGrace`, both untouched. Parry stays height-agnostic (works mid-dash,
mid-fall — composes with the combo wave's air-parry rule for free).

---

## 5. Deterministic test strategy (GameRoom.test harness)

Harness reuse: `new GameRoom()` → `onCreate` → fake clients → `room.update(50)` per tick.
**Map-RNG law (the pinned-position discipline, GameRoom.test.ts 819–820 / 848–850):** every test
that pins positions starts with `h.room.map.pois.length = 0; h.room.map.tiles.fill(TILE_GROUND)` —
then AUTHORS geometry explicitly (e.g. set a 3-tile `TILE_PIT` strip) so pit assertions are seeded,
not rolled. The stance machine itself is RNG-free (flags + timers), so most tests need no
`Math.random` pinning; the pound-damage test pins it only if crit rolls participate (the eee600a
precedent: pin every stacked cause).

1. **Tap unchanged:** inject `cmd.jump`; assert liftoff tick, `vh = JUMP_VELOCITY(360)`, cooldown —
   the existing jump tests re-tuned, plus the golden phase-order test stays green (stance code runs
   inside existing phases; no new phase numbers).
2. **Crouch commit gate:** `crouchHeld` for 3 ticks then release → no launch, stance 0. For 6 ticks
   then release → launch. Release on `distJumpCd` → no launch.
3. **Soft-lock sampling:** hold crouch with `(dx,dy)=(1,0)` then switch to `(0,1)` on the release
   command → assert `dashDir ≈ (0,1)` (last intent wins); degenerate input falls back to
   crouch-window intent, then `aimDir`.
4. **Hard lock in flight:** inject perpendicular input mid-dash → heading unchanged; land at the
   clamped point within ε.
5. **Clamp law:** author a pit at the raw target → assert launch aims at the `safeSpawnPos`-nudged
   ground point; belt variant asserts `beltSafeX`/`clampBeltFloorY`. Aim past the wall → arena
   clamp first.
6. **Pit clearance math:** author a 3-tile (240px) pit strip; place the player at the lip; dash
   across → `fellSeq` unchanged, lands on far ground. Control: tap-hop the same strip → `fellSeq`
   increments (the hop cannot clear 3 tiles).
7. **Crouch cancels:** damage mid-crouch → stance 0 + `stanceSeq` bump, no launch on release;
   attack/parry/freeze variants; juggle-launcher steal (once the combo wave lands) asserts §4.1.
8. **Pound:** pinned enemy inside/outside `POUND_RADIUS` at the landing spot; airborne `cmd.pound`
   → `vh = −POUND_SPEED` next tick; landing tick → inside enemy damaged (kill bookkeeping: XP
   drop), outside enemy untouched (WYSIWYG radius), `poundSeq +1`, `recoveryT` set, `jumpCd`
   floored; second `pound` in the same arc ignored (`poundUsed`); grounded `pound` ignored.
9. **Quake eligibility:** boss quake resolving while dashing → cleared; while crouching → hit;
   pound landing tick vs quake tick ordering pinned by the phase-order contract.
10. **Prediction contracts (`prediction.test.ts` pattern — mock server on the shared steppers):**
    crouch/dash/pound replay byte-exact against the mock (no residual, no adopt); a server
    hit-cancel mid-crouch (mock bumps `stanceSeq` + stance 0) → predictor drops the stance, does
    NOT re-derive it from pending commands on the next three reconciles, error offset glides (no
    `INTERP_SNAP` pop); denied dash arc adopts via `HEIGHT_ADOPT_PX`.
11. **Hygiene:** restart/level-window mid-crouch and mid-dash → stance cleared (`clearTransients` /
    freeze path), no stuck `moveStance` on the wire.

---

## 6. File / function touch list

**shared** — `packages/shared/src/constants.ts` (§2.7 constants, `SCHEMA_VERSION = 20`, update the
`MAP_MAX_JUMP_TILES` derivation comment); `packages/shared/src/state.ts` (append `moveStance`,
`poundSeq`, `stanceSeq` after the combo wave's `juggledSeq`); `packages/shared/src/movement.ts`
(`stepJumpStance` pure shared machine per §3.4; optional `APEX_HANG` inside `stepVertical`);
`packages/shared/src/index.ts` (re-exports); `packages/shared/src/movement.test.ts` (stance-step
unit tests).

**server** — `packages/server/src/rooms/GameRoom.ts`: `InputCmd` (~290: `crouchHeld/pound`);
command consume (~2242: latch both next to `cmd.jump`); `CombatState` (~333: §2.1 fields) +
`createCombat` init (~2033); movement phase (~2283: crouch/dash steering override); jump/vertical
block (2469–2491: call the shared stance step; pound landing → `detonate` + `poundSeq` +
recovery); `damagePlayer` (crouch hit-cancel + `stanceSeq`); `zeroMoveVel` (5194: reset new held
flags + stance); level-window freeze edge (~2261: stance cancel); new
`packages/server/src/rooms/GameRoom.jump.test.ts` (§5 — a NEW file so it never collides with the
combo wave's `GameRoom.combo.test.ts`).

**client** — `packages/client/src/net/prediction.ts` (`PredCmd`/`PendingPredCmd`/`ServerView`
fields, shared stance step, `stanceSeq` soft-resync in `reconcile()`);
`packages/client/src/net/prediction.test.ts` (§5-10); `packages/client/src/scenes/ArenaScene.ts`
(Space tap/hold sampler replacing the bare `JustDown` at 3038, `crouchHeld/pound` into the mint at
9442, local crouch/dash/pound pose, remote `moveStance` pose, `poundSeq` ring + camera thump,
help-text strings); possibly `vfx` for the pound ring style.

---

## 7. Wave plan — sequenced AFTER the enemy-combo server wave

The enemy-combo wave OWNS `GameRoom.ts`, `state.ts`, `constants.ts`, `enemies.ts`, `combat.ts`
RIGHT NOW (its doc's waves A–B). This feature makes **zero parallel edits** to those files; it is a
follow-up train:

- **Wave J1 — shared foundations** (locks: `constants.ts`, `state.ts`, `movement.ts`, `index.ts`).
  Starts only after the combo wave's shared+server waves MERGE: our schema fields append after
  `juggledSeq` and we take `SCHEMA_VERSION = 20` — both physically impossible to get right before
  their append lands. Pure + additive; nothing reads the fields yet. Independently green.
- **Wave J2 — server machine** (lock: `GameRoom.ts` + new `GameRoom.jump.test.ts`). Rebase-first
  checklist: re-read `resolveParry`/juggle vh writes (add the §4.1 rank guard), the widened
  `comboState` (no overlap — our state is on `CombatState`), and `damagePlayer` (receipts wave +
  our crouch-cancel hook touch it; ours is append-only at the top).
- **Wave J3 — client** (locks: `prediction.ts` + tests, `ArenaScene.ts`). Can start once J1 is
  merged (predictor changes compile against shared; ArenaScene renders default-0 stances as
  "nothing" until J2 ships) — parallel with J2 if two seats are free.
- **Wave J4 — tuning + golden re-record** only if `JUMP_VELOCITY`/apex-hang shift the phase-order
  fixture (they touch phase internals only; expected no-op).

CI is the arbiter (`pnpm lint` CRLF false-negative locally, per project memory).
