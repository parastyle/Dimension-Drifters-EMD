# ULTIMATES — Server Tech Spec (authoritative execution)

Panel role: SERVER TECH IMPLEMENTER. Scope: everything the authoritative 20Hz sim needs to unlock,
charge, validate, execute, and sync the four ultimate archetypes. Written against the SETTLED
GameRoom (post weapon-draw-lock / combat-receipt / beam-curator wave, schema v18). Client input,
HUD, and VFX are the client panel's docs; the designer economy numbers are the design panel's —
every number here is a `(tuning)` placeholder wired to a named constant so the designer owns it
without touching sim code.

Non-negotiable house laws this spec is built on (all already in the codebase):

- The server is fully authoritative; clients only REQUEST (`attack`/`parry` handler pattern,
  GameRoom.ts ~line 765+). Trust nothing off the wire: `Number.isFinite` coercion, normalized aim,
  clamped targets.
- Every synced-field change appends at the END of a Schema class and bumps `SCHEMA_VERSION`
  (state.ts / constants.ts). It is 18 now; **other waves may take 19 — the implementing wave bumps
  to the next available version at merge time**, never a hardcoded number in this doc.
- Every server-side reposition of a player goes through `zeroMoveVel(id)` (GameRoom.ts ~5188) —
  that is THE teleport law: it drops queued/held input, zeroes the synced steering mirror, and
  bumps `teleportSeq`, the one hard-resync signal the predicting client watches "by construction".
- All player-attributed enemy damage routes through the ONE damage primitive `damageEnemy`
  (~5084) / `damageWormSlots` (~5009), which writes the fixed v18 `combatReceipts` ring — receipts
  are the per-hit event bus every viewer already renders from.
- Multi-phase actions sync as IMMUTABLE TICK EPOCHS, not per-tick mutation: the Serraketh model
  (`WormBossState.actionKind/actionSeq/actionStartTick/actionResolveTick/actionEndTick`,
  state.ts ~368) and the beam row (`BeamState.phase/phaseStartTick`). Ultimates copy this shape.
- `stepSim`'s hand-numbered phase order is a CONTRACT (golden test) — the new phase gets a number
  and a slot, not an ad-hoc call.

---

## 1. Allocation-frequency tracking

**What "frequency" means here.** Each level grants 3 points: +1 class attr and +1 requirement attr
automatically (`levelUpPlayer`, progression.ts), plus 1 FLEX the player chooses (`chooseAttribute`
handler, GameRoom.ts ~1196, or the timeout auto-resolve in `tickLevelWindows` ~4309). The auto
points are not choices and `classForCharacter` is read live (a character swap re-aims growth), so
attribute TOTALS cannot reconstruct intent. Therefore: **track FLEX allocations only**, as
authoritative per-attribute counters. (If the designer rules auto points count too, it is a
one-line change at the same seam — the counters are written where `allocate` is called with a
source tag.)

**Storage.** New NON-decorated (never serialized) field on `PlayerState`, exactly like the
existing server-only `flexTimer` (state.ts line 69):

```ts
/** Server-only §ULT: per-attr FLEX allocation counts this run. Not decorated — never serialized. */
allocFlex: Record<Attr, number> = { str: 0, dex: 0, int: 0, con: 0, luk: 0 };
```

Living on PlayerState (not CombatState) keeps `progression.ts` pure — no GameRoom plumbing.

**Write sites.** `allocate(player, attr, n, source: "flex" | "auto" = "auto")` grows a source tag;
only `source === "flex"` increments `allocFlex[attr]`. Callers: `chooseAttribute` handler and the
timeout auto-resolve pass `"flex"`; `levelUpPlayer`'s two auto points pass `"auto"`.

**Resets.** `restartRun` (~1754, the attribute-reset block) and any future fresh-run path zero the
counters alongside `str..luk`. Rift descent does NOT reset (levels persist across the chain).
`toggleTraining` leaves them (training doesn't touch attributes), but see §3 for the training
accrual gate.

## 2. Unlock evaluation law

**Archetype selection.** PRIMARY = the attr with the highest `allocFlex` count, SECONDARY = second
highest; ties break by fixed `ATTRS` order (leveling.ts line 28) so evaluation is deterministic and
testable. The ordered `(primary, secondary)` pair indexes a designer-owned table in the new shared
`ultimate.ts`; default mapping until the design doc lands (tuning):

| primary | archetype |
|---|---|
| dex | 1 · Far Blink (cursor teleport) |
| str | 2 · Phase Attack (dash-through) |
| luk | 3 · Alpha Strike (multi-hit dash across targets) |
| int | 4 · Fireball (nuke projectile) |
| con | 2 · Phase Attack (the tank line shares the dash) |

Secondary attr modulates magnitude (designer economy), never the archetype id, so the wire stays
one uint8.

**When evaluated.** ONLY at allocation edges — immediately after any `allocate(…, "flex")` in the
two call sites. Never per tick (nothing changes between allocations). Unlock fires when
`allocFlex[primary] + allocFlex[secondary] >= ULT_UNLOCK_ALLOCS` (tuning, ~6 → roughly level 6–8
on a committed build). Re-evaluation at later edges may CHANGE the archetype if the ranking flips;
charge is a player resource, not the archetype's, and is preserved across a flip.

**What syncs.** Appended to `PlayerState` AFTER `sigGateQueue` (append-only; bump SCHEMA_VERSION
to the next available):

```ts
/** §ULT archetype id (0 = locked, 1..4 = the table above). Changes only at allocation edges. */
@type("uint8") ultArchetype = 0;
/** §ULT charge, quantized percent 0..100. Server-private float is the truth; this is the HUD/teammate view. */
@type("uint8") ultCharge = 0;
/** §ULT phase: 0 ready/idle · 1 windup · 2 active · 3 recovery. */
@type("uint8") ultPhase = 0;
/** §ULT monotonic acceptance edge (bumped once per accepted activation) — the VFX trigger, like attackSeq. */
@type("uint16") ultSeq = 0;
/** §ULT immutable tick epochs of the CURRENT activation (Serraketh action-tick model): windup start,
 *  the resolve beat (blink lands / fireball launches / first alpha hit), and the end of active+recovery. */
@type("uint32") ultStartTick = 0;
@type("uint32") ultResolveTick = 0;
@type("uint32") ultEndTick = 0;
/** §ULT clamped world target captured at acceptance (blink dest / dash end / fireball aim / first alpha target). */
@type("float32") ultTargetX = 0;
@type("float32") ultTargetY = 0;
```

"READY" is derived, not stored: `ultArchetype > 0 && ultCharge >= 100 && ultPhase === 0`. Every
viewer (owner, teammates, spectators) renders the same windup fill from
`(tick - ultStartTick) / (ultResolveTick - ultStartTick)` with zero per-tick field churn — the
telegraph lesson (state.ts TelegraphState comment) and the worm action model, reused.

**Version discipline.** All nine fields land in ONE schema bump. `ultCharge` writes only when the
quantized integer changes (the `syncFlexTimer` decisecond pattern, ~2149) — ≤100 patches per full
bar, not 20Hz churn.

## 3. The authoritative charge resource

**Server truth.** `CombatState.ultChargeF: number` (0..1 float) — CombatState because it is
combat-runtime like `cd`/`invuln`, and `clearTransients`/`restartRun` already own that lifecycle.
Mirrored to `player.ultCharge` as `Math.floor(ultChargeF * 100)` write-on-change.

**Accrual seam.** One seam, inside `damageEnemy` / `damageWormSlots` right after `applied` damage
lands (the "ONE damage primitive" law means edge, chain, quake, gun, cast, thrown, beam, scatter,
riposte ALL flow through it — no per-source bookkeeping):

- `if (sourcePlayerId && enemy.kind !== "dummy" && mode !== "training")` → credit the source
  player `applied × ULT_CHARGE_PER_DAMAGE`.
- Kill bonus: `+ULT_CHARGE_KILL_BONUS` on `finalBlow`.
- Successful parry bonus: `+ULT_CHARGE_PARRY_BONUS` in `resolveParry`'s success path (the same
  site that pays the parry-chain heal) — defense charges the ult too (designer economy hook).

**Anti-exploit caps** (each one closes a real hole in this codebase's history):

1. **Dummy gate** — dummies reset to full HP forever (`damageEnemy` dummy branch ~5126); without
   the gate the Testing Grounds is an infinite charge farm (same class as the F2
   training-launder finding).
2. **Training gate** — nothing accrues in `mode === "training"`, and `toggleTraining` zeroes
   `ultChargeF` (T must not be a charge-prep booth for the real run; mirrors salvage forfeiture).
3. **Per-tick cap** — accrual per player per sub-step clamps to `ULT_CHARGE_TICK_CAP` (tuning,
   ~0.04) so one nuke-tier detonation into a pack can't refill the bar it just spent (the
   fireball→detonate→full-bar perpetual loop). Implemented as a per-CombatState accumulator reset
   in the phase-0 budget-refill block.
4. **No self-charging while active** — accrual is suspended while `ultPhase !== 0` (phase-dash
   damage must not pay for its own next cast at 1:1; recovery resumes accrual).
5. Charge is clamped `[0,1]`, spent to exactly 0 at acceptance (no banking overflow), preserved
   across down/rez and rift descent, reset by `restartRun`/`toggleTraining`.

This is "synced like beam heat" in the intended sense: the precise resource is server-private
(`BeamResourceLedger.heat` is), and the wire carries a stable quantized presentation value.

## 4. The activation message

New `"ultimate"` handler registered in `onCreate`, shaped exactly like `"attack"`:

```ts
this.onMessage("ultimate", (client, message: { aimX?: number; aimY?: number; tx?: number; ty?: number }) => {
  if (!this.takeAction(client)) return;            // §44 action budget — NOT exempt (see below)
  const player = this.state.players.get(client.sessionId);
  const c = this.combat.get(client.sessionId);
  if (!player?.alive || !c) return;
  if (this.inLevelWindow(player)) return;          // no casting from inside the invincible pick window
  // coerce + normalize aim (the attack handler's exact block), coerce tx/ty with player-relative fallback
  c.ultBuffer = ULT_BUFFER_SECONDS;                // queue, don't latch — the tick consumes it (de-clunk law)
});
```

- **Budget: NOT exempt.** `ACTION_MSGS_PER_TICK = 8` (160/s) dwarfs one press per multi-second
  bar; exempting any RPC re-opens the Sol-audit hole the budget exists to close. No new budget
  class either — it is an ordinary action message.
- **Buffered, never latched** (`ULT_BUFFER_SECONDS` ≈ 0.2, tuning): a press racing the last tick
  of recovery or the final charge sliver fires the instant it becomes legal, matching
  `attackBuffer`/`parryBuffer`/`jumpBuffer` semantics. Consumption happens in the tick under the
  common gate: `outcome === "active" && player.alive && !inLevelWindow && ultReady && beam-safe`.
- **Beam interaction:** acceptance calls `cancelBeam(player, id, c, true, false)` — the same
  early-cancel heat cost the parry pays (~5370). An ult is a hard channel interrupt, not a free
  escape.
- **Aim payload:** normalized `aimX/aimY` unit vector + cursor world point `tx/ty`. Direction is
  derived server-side via the `aimDir` cursor-point law (~4823). Target legality is per-archetype
  (below) and ALWAYS resolved at acceptance into `ultTargetX/Y` — the client's raw cursor never
  survives into execution.
- Acceptance: spend charge to 0, bump `ultSeq`, stamp `ultStartTick/ultResolveTick/ultEndTick`
  from the archetype's immutable descriptor (shared `ultDescriptorFor`, the
  `beamDescriptorFor`/`swingDescriptorFor` pattern: constructed ONCE at the accepted epoch,
  frozen), set `ultPhase = 1`, capture `c.ultTeleportSeqAtAccept = player.teleportSeq`.

## 5. The generic ultimate state machine

New server-private runtime on `CombatState`:

```ts
ultChargeF: number; ultBuffer: number; ultAccrualThisTick: number;
ult?: {
  descriptor: UltDescriptor;            // frozen at acceptance
  archetype: 1 | 2 | 3 | 4;
  dirX: number; dirY: number;           // captured dash/launch direction
  targets: { id: string; gen?: number }[]; // alpha strike's server-picked set
  hitIndex: number; nextHitTick: number;
  hit: Set<string>;                     // phase-dash hit-once set
  teleportSeqAtAccept: number;          // external-teleport cancel guard (the beamTeleportSeq law)
};
```

**Tick integration — new numbered phase `4.7 stepUltimates(dt)`**, after `stepMeleeSwings` (4.6)
and the quake detonations (4.65), before enemy AI (5): player-sourced scripted damage resolves in
the same band as the other player damage machines, and the repositioning archetypes settle BEFORE
enemy targeting reads player positions. The golden phase-order test gains the slot.

Phase transitions (all tick-epoch driven, wrap-safe `>>>0` deltas like `attackHeld` ~2209):

- `1 windup` → at `tick === ultResolveTick`: run the archetype's resolve. Windup is short
  (2–4 ticks, tuning) — readability beat, not a channel; movement continues normally during it.
- `2 active` → archetype-owned (below) until `ultEndTick - recoveryTicks`.
- `3 recovery` → pure timer; ends at `ultEndTick`, `ultPhase = 0`, runtime struct dropped.
- **Cancel law** (any tick, any phase): owner downed (`!player.alive`), external teleport
  (`player.teleportSeq !== ult.teleportSeqAtAccept` — pit snap-back, rift descent, restart,
  revive), or terminal outcome → immediate cancel: `ultPhase = 0`, drop runtime, `zeroMoveVel` if
  mid-scripted-motion, **no refund** (spent is spent; the designer may soften this).
- `clearTransients` (~1237) clears every `c.ult*` — honoring its "adding a new transient forces
  touching this" contract — so no in-flight ult ghost-carries across restart/training/terminal
  boundaries.

**Movement law while `ultPhase === 2` for the scripted-motion archetypes (2/3):** the player is
input-frozen exactly like the level-window branch of movement phase 1 (~2261): `input.mvx/mvy = 0`,
synced mirrors zeroed; the sim writes `player.x/y` directly. `zeroMoveVel` fires at scripted-motion
START and END (and at each alpha reposition), so every authoritative jump is covered by the
teleportSeq resync law by construction — the owning client's predictor rebases instead of fighting
the scripted path. Blink (1) and fireball (4) freeze nothing.

## 6. Per-archetype authoritative execution

### 6.1 Far Blink (cursor teleport)

- **Acceptance clamp:** `clampQuakeEpicenter(player, {tx,ty}, ULT_BLINK_RANGE)` — the exact shared
  "you aim it, within reach" primitive (combat.ts ~195), range ~700px (tuning, ≈ screen-edge).
- **Nav-valid destination law** (arena): clamp into `[PLAYER_RADIUS, ARENA_* - PLAYER_RADIUS]` →
  `resolvePoiCollision(map, x, y, PLAYER_RADIUS)` pushes out of Cover landmarks →
  `isPitAtPx` still true ⇒ `nearestGroundPx(map, x, y)` (the pit snap-back's own fallback,
  ~2391). Belt mode: `beltSafeX` (off pit gaps) + `clampBeltFloorY`, and the destination x clamps
  to the closed-gate bound `beltLockX - PLAYER_RADIUS` (~2335) — no blinking through an unfought
  room gate. The resolved point is written to `ultTargetX/Y` at acceptance so all clients paint the
  landing marker at the REAL destination (the telegraph fixed-world-coord law).
- **Resolve tick:** set `player.x/y = ultTarget`, `c.lastGroundX/Y = dest` (nav-valid by
  construction — the stale-last-ground pit interaction is closed), `c.pitGrace = PIT_FALL_GRACE`
  (no landing-gank), then `zeroMoveVel(id)` — one `teleportSeq` bump, prediction hard-resyncs.
- **I-frame window law:** `c.invuln = max(c.invuln, ULT_BLINK_IFRAMES)` applied at the RESOLVE
  tick only (~0.35s, tuning) — the escape is protected on arrival, the windup is not (a read
  window for enemies; parity with the jump's "no free defensive layer" ruling). Recovery ~0.4s.

### 6.2 Phase Attack (dash-through with damage)

- **Acceptance:** direction = `aimDir(player, c)`; endpoint = start + dir × `ULT_PHASE_RANGE`
  (~420px), then the full blink nav-valid law applies to the ENDPOINT (bounds → POI push-out →
  pit fallback; belt gate bound). Mid-path statics are PHASED: POIs are not collision-resolved
  during flight, and the §17 pit check exempts `ultPhase === 2` players exactly as it exempts
  `height > GROUND_EPSILON` (add one condition at ~2364) — you phase OVER gaps; only the landing
  must be standable. Duration = range / `ULT_PHASE_SPEED` (~1400px/s ⇒ 6 ticks).
- **Motion:** input-frozen scripted advance `x += dirX·speed·dt` per active tick; `zeroMoveVel` at
  start and end.
- **Collision exemption:** `c.invuln = max(…, activeDuration + ε)` covers contact damage,
  projectiles, and lunges for the whole dash (all three already gate on `invuln`); body-collision
  push-out of enemies (phase 5.5) is one-way onto enemies and does not displace the player, so no
  further exemption is needed.
- **Swept damage — machinery ruling** (the spec asked to evaluate beam-sweep vs melee-sweep):
  use NEITHER directly. The beam sweep (`damageBeamSweep` + the 17-slot sample arrays) is built
  for a rotating, origin-moving capsule fan; the melee sweep (`stepMeleeSwings`) is angular
  blade-arc supersampling. A dash is one straight swept capsule per tick — the cheapest correct
  primitive is the PROJECTILE model: per active tick, `enemyGrid.queryAabb` over the segment's
  AABB inflated by `ULT_PHASE_HALFWIDTH + MAX_ENEMY_RADIUS`, exact point-to-segment distance test
  per candidate, plus `wormSegmentGrid` + `runtime.segmentIntersectsSweptCapsule` for Serraketh
  slots (the stepProjectiles worm block ~5983 is the copy-from). Hit-once via the dash-lifetime
  `ult.hit` set (ids + worm `slot:generation` keys); damage `ULT_PHASE_DAMAGE ×` the archetype's
  attr scaling through `damageEnemy` with the new delivery (below). Kills flush through the same
  `kills[]` → `state.enemies.delete` idiom.

### 6.3 Alpha Strike (server-picked multi-hit dash across targets)

- **Target selection at acceptance (server-picked, hard-capped):**
  `enemyGrid.queryRadius(player.x, player.y, ULT_ALPHA_RADIUS, …)` (~520px) → exact-distance
  filter, exclude the worm compatibility root, plus targetable worm slots via `wormSegmentGrid`;
  sort by distance; take `min(n, ULT_ALPHA_MAX_TARGETS)` (hard cap 5, tuning — the BOSS_ADD_CAP
  philosophy: caps are protocol, not designer-expandable). Zero targets in radius ⇒ activation is
  REFUSED before charge is spent (the buffer keeps the press alive briefly). Captured as
  `{id, generation}` pairs; `ultTargetX/Y` = first target's position.
- **Sequenced hits — the Serraketh action-tick model:** first hit at `ultResolveTick`, then one
  hit every `ULT_ALPHA_HIT_TICKS` (2 ticks = 100ms, tuning). Per hit tick: skip
  dead/despawned/generation-mismatched targets (revalidate `state.enemies.has` /
  `runtime.isTargetable + generation`); reposition the player ADJACENT to the target
  (offset by target radius + PLAYER_RADIUS along the approach vector, then the blink nav-valid
  law), `zeroMoveVel` (every reposition is a teleport — the law is unconditional), then
  `damageEnemy(…, ULT_ALPHA_DAMAGE × scaling, kills, critChanceFor(player.luk, player.dex), …)`.
  Per-hit VFX for all viewers ride the existing `combatReceipts` ring + the synced position jumps —
  **no per-hit schema fields**; `ultEndTick` is stamped once at acceptance from the FULL planned
  sequence and does not shrink if targets die early (the tail just whiffs into recovery —
  deterministic wire).
- **Untargetable window law:** for the whole active window the player is (a) `invuln` (contact /
  projectiles / lunges / boss AoE that respects i-frames), and (b) EXCLUDED from the `bodies`
  target array built in stepSim phase 2 (~2313) — enemies re-aim at remaining squad members
  instead of tracking an untouchable blur; the same exclusion the `alive` filter already performs.
  Boss mechanics that ignore i-frames by design (unparryable slams) still connect if the player
  materializes inside one — the window is untargetable, not unhittable-by-everything.

### 6.4 Fireball (big projectile + nuke-tier explosion)

- **Acceptance:** aim = `aimDir` cursor-point law; `ultTargetX/Y` = clamped cursor point (render
  aid only — the projectile flies until contact/range like every other shot).
- **Resolve tick:** one `fireProjectile` call — the entire existing pipeline is reused unchanged:
  `from` = muzzle (`gunMuzzleReach` idiom), speed `ULT_FIREBALL_SPEED` (~520), direct damage
  `ULT_FIREBALL_DAMAGE × scaling`, `hostile = false`, `kind = "fireball"` (client renderer key;
  element-suffix rule from fireGun applies), `pierce = 1`, `ttl = ULT_FIREBALL_RANGE / speed`,
  `explode = { radius: ULT_NUKE_RADIUS, damage: ULT_NUKE_DAMAGE × scaling }`, crit captured at
  acceptance, `sourcePlayerId/sourceWeaponId` = player id + a sentinel `"ult:fireball"` weapon id
  (receipts stay attributable; `WEAPONS[...]` miss falls back to `"physical"` element in
  `writeCombatReceipt` — acceptable, or the shared table registers the sentinel).
- **Nuke tier:** `ULT_NUKE_RADIUS` ≈ 260px (tuning — larger than every current blast; boss slam is
  150) and the death → `detonate` path (~6033) already does grid-queried AoE, worm-slot AoE, crit,
  receipts, kills, XP, loot, portal bookkeeping. `explodeR` is synced on the projectile row, so
  the client draws EXACTLY the authoritative blast (§14 WYSIWYG law, free).
- Friendly projectiles are exempt from `BOSS_PROJECTILE_BUDGET` by existing rule — no budget work.
- Note: `detonate`-scale damage hits the §3 per-tick accrual cap, so a nuke cannot meaningfully
  refill its own bar (cap #3/#4).

**New delivery enum:** `CombatDelivery.Ultimate = 10` (combat.ts — the taxonomy is explicitly
append-only). All four archetypes stamp it on receipts; the client's receipt renderer keys new
juice off it.

## 7. Co-op rules (downed / rez / window interactions)

- **Owner downed mid-ult** (zone DoT ticks through i-frames windows that lapse, unparryable boss
  AoE): the phase-tick cancel law fires — motion stops where it is, `zeroMoveVel`, no refund.
- **Rez interactions:** a downed ally can be rezzed by a teammate while the rezzer is mid-ult only
  if the rez weapon swings — impossible while input-frozen (archetypes 2/3) and irrelevant for
  1/4; no special case. A REVIVED player (`tryRez` → `zeroMoveVel`) resumes with whatever
  `ultChargeF` they had — charge survives down/rez.
- **Downed players** deal no damage ⇒ accrue nothing; they keep their bar.
- **Level-up window:** activation is refused inside the window (§4 gate — the parry learned this
  the hard way in the Sol audit). A window OPENING mid-ult (alpha-strike kills level the squad) is
  allowed to coexist: scripted motion bypasses the input path the freeze acts on, the window's
  invuln stacks with the ult's, and `flexTimer` ticks normally. One law, no re-entrancy.
- **Squad wipe / victory mid-ult:** the `outcome !== "active"` cancel + `clearTransients` boundary
  already retires everything (§5).
- **Griefing surface:** none new — no friendly fire exists, repositioning archetypes move only the
  caster, and the rift/extraction channels are untouched (an ult-active player over the rift still
  charges it only via the normal proximity rule; if the designer objects, gate rift charge on
  `ultPhase === 0` — one condition in `checkDescend`).

## 8. Wire costs

Per player, appended fields (Colyseus delta-syncs only changes):

| field | type | churn |
|---|---|---|
| ultArchetype | uint8 | allocation edges only (~once per few levels) |
| ultCharge | uint8 | write-on-quantize-change: ≤100 writes/full bar, bursty under the tick cap (≤4/s typical) |
| ultPhase | uint8 | 3 writes per activation |
| ultSeq | uint16 | 1 write per activation |
| ultStartTick/ultResolveTick/ultEndTick | uint32 ×3 | 1 write each per activation (immutable epochs — zero per-tick churn; the whole point) |
| ultTargetX/Y | float32 ×2 | 1 write each per activation |

Worst-case activation burst ≈ 24 bytes + schema overhead, once; steady-state cost is the charge
byte a few times a second while fighting. The scripted-motion archetypes add ordinary `x/y`
position churn (already synced every tick) plus 1–6 `teleportSeq` bumps per cast. Receipts reuse
the fixed preallocated ring — zero new allocation. This is far below one BeamState row's per-tick
footprint; ten players ulting simultaneously is wire-trivial.

## 9. File / function touch list

**packages/shared/src/**
- `state.ts` — PlayerState: 9 appended decorated fields + non-decorated `allocFlex`.
- `constants.ts` — bump `SCHEMA_VERSION` to next available; new `ULT_*` block (all tuning):
  `ULT_UNLOCK_ALLOCS`, `ULT_CHARGE_PER_DAMAGE`, `ULT_CHARGE_KILL_BONUS`, `ULT_CHARGE_PARRY_BONUS`,
  `ULT_CHARGE_TICK_CAP`, `ULT_BUFFER_SECONDS`, `ULT_RECOVERY_SECONDS`, `ULT_BLINK_RANGE`,
  `ULT_BLINK_WINDUP_TICKS`, `ULT_BLINK_IFRAMES`, `ULT_PHASE_RANGE`, `ULT_PHASE_SPEED`,
  `ULT_PHASE_HALFWIDTH`, `ULT_PHASE_DAMAGE`, `ULT_ALPHA_RADIUS`, `ULT_ALPHA_MAX_TARGETS`,
  `ULT_ALPHA_HIT_TICKS`, `ULT_ALPHA_DAMAGE`, `ULT_FIREBALL_SPEED`, `ULT_FIREBALL_RANGE`,
  `ULT_FIREBALL_DAMAGE`, `ULT_NUKE_RADIUS`, `ULT_NUKE_DAMAGE`.
- `combat.ts` — `CombatDelivery.Ultimate = 10`.
- `ultimate.ts` (NEW, pure — the combat.ts pattern: no engine/network types) —
  `UltArchetype` enum, `archetypeForAllocation(allocFlex)` (ranking + tie-break + table),
  `ultDescriptorFor(archetype, startTick, attrs)` frozen descriptor, shared clamp helpers
  (re-exporting `clampQuakeEpicenter` use), `pointSegmentDistSq` if not already shared.
- `index.ts` — exports.

**packages/server/src/rooms/**
- `progression.ts` — `allocate` source tag + `allocFlex` increment; unlock re-eval helper called
  from both flex sites (or returned to the caller — keep the module pure).
- `GameRoom.ts` — `onCreate`: `"ultimate"` handler; `CombatState`: `ultChargeF/ultBuffer/
  ultAccrualThisTick/ult`; `onJoin` init; `stepSim`: phase 4.7 `stepUltimates(dt)`, `bodies`
  exclusion for alpha-active players, pit-check exemption for phase-dash; `damageEnemy`/
  `damageWormSlots`: accrual seam; `resolveParry`: parry bonus; `chooseAttribute` +
  `tickLevelWindows`: flex source tag + unlock re-eval + `syncUltCharge`; `clearTransients`,
  `restartRun`, `toggleTraining`: resets; new private methods `stepUltimates`, `acceptUltimate`,
  `execBlink`, `stepPhaseDash`, `stepAlphaStrike`, `launchFireball`, `cancelUltimate`,
  `syncUltCharge`, `navValidDest(x, y)` (the shared clamp→POI→pit→belt law used by 6.1/6.2/6.3).

**tests** — `packages/server/src/rooms/ultimate.test.ts` (new), additions to `GameRoom.test.ts`
golden phase-order test, `progression.test.ts` counter cases, `packages/shared/src/ultimate.test.ts`
pure-function cases.

**Client (other panel, listed for the contract):** input button → `"ultimate"` message; HUD bar off
`ultCharge/ultPhase`; windup/active VFX off `ultSeq` + tick epochs + `ultTargetX/Y`; per-hit juice
off receipts with `delivery === Ultimate`; predictor already handles the teleportSeq resyncs.

## 10. Deterministic test strategy per archetype

House rules from the existing suites: drive `update(50)` fixed steps (never wall clock), pin
`Math.random` when ANY stacked RNG is in the path (the §50 explosive-gun flake was exactly
"three stacked RNG causes" — crit roll × drop roll × spawn scatter; ult tests pin crit to 0 unless
crit is the assertion), build rooms via the existing GameRoom test harness, place enemies
explicitly, and assert on synced state + receipts.

- **Unlock/eval:** allocate flex via `chooseAttribute` messages; assert `ultArchetype` flips
  exactly at the threshold edge and ONLY at allocation edges (step 100 ticks between allocations,
  assert no change); tie-break determinism (equal counts ⇒ ATTRS order); restart resets counters.
- **Charge:** spawn one enemy, hit it with a known-damage source, assert exact quantized
  `ultCharge`; dummy hit ⇒ 0; training mode ⇒ 0; a single detonate over a 10-pack ⇒ accrual equals
  the tick cap, not 10× (cap #3); no accrual while `ultPhase !== 0` (cap #4).
- **Blink:** author the map deterministically (seed the state seeds before `mintMap`, or point the
  dest at a known pit/POI cell); assert dest clamps to range, resolves off the POI and pit,
  `teleportSeq` bumped exactly once, `invuln ≥ ULT_BLINK_IFRAMES` at the resolve tick and NOT
  during windup, beam canceled with the early-cancel heat cost, belt gate bound respected.
- **Phase dash:** enemies on-line, off-line (beyond half-width), and behind; step the full active
  window; assert on-line each damaged EXACTLY once (hit-once), off-line/behind untouched, worm
  slot hit via the swept capsule, `mvx/mvy` mirrors are 0 during active, `teleportSeq` +2
  (start/end), endpoint nav-valid over an authored pit lane (dashed over, not fallen), contact
  damage taken during dash = 0.
- **Alpha strike:** spawn `cap + 3` enemies in radius; assert target count == cap and it is the
  NEAREST cap by distance; hits land exactly on `ultResolveTick + k·ULT_ALPHA_HIT_TICKS` (read
  receipts' `tick` fields); kill a target mid-sequence externally ⇒ its beat whiffs, no throw, no
  retarget; enemy lunges/spitters aim at the OTHER player while active (`bodies` exclusion);
  `ultEndTick` never mutates after acceptance.
- **Fireball:** fire down a clear lane at a wall of 3 enemies at known distances; assert the
  projectile row's `explodeR === ULT_NUKE_RADIUS`; step to contact; assert direct hit on first
  enemy + detonate damage on all within radius and none beyond (grid AABB superset vs exact r²);
  crit pinned both ways; receipts carry `delivery === Ultimate` and the sentinel weapon id.
- **Lifecycle:** cancel-on-down, cancel-on-external-teleport (force a pit fall mid-windup),
  cancel-on-terminal, `clearTransients` sweep, golden phase-order contract updated for 4.7.

## 11. File-lock wave plan

An improvement wave is actively landing in `GameRoom.ts` (weapon-draw lock, combat receipts, beam
curator — some already merged at v18). The plan isolates the hot file to one exclusive wave and
front-loads everything that can land without touching it.

- **Wave 1 — shared package only** (no lock contention; parallel-safe with the improvement wave):
  `state.ts` appended fields + `constants.ts` `ULT_*` + SCHEMA_VERSION bump (**claim the next free
  version at merge time** — coordinate in the version ledger since v19 may be taken),
  `combat.ts` delivery enum, new `ultimate.ts` + its pure tests, index exports. Everything compiles
  unused. CI green with zero behavior change.
- **Wave 2 — `progression.ts` + its test** (single small file, no GameRoom): allocate source tag +
  counters + `archetypeForAllocation` wiring surface. Still zero live behavior (GameRoom callers
  pass the default `"auto"`).
- **Wave 3 — `GameRoom.ts` EXCLUSIVE lock**: take the lock only after the improvement wave's
  GameRoom items are merged; rebase on the settled file. Lands the handler, CombatState fields,
  accrual seam, `stepUltimates` + all four exec paths, resets, `bodies`/pit exemptions, and the
  GameRoom-level tests. This is the only wave that can conflict — keep it one owner, one branch,
  short-lived. (Local `pnpm lint` CRLF failures are environmental — trust CI, per the repo memory.)
- **Wave 4 — client** (other panel; depends on Waves 1+3 wire contract only, can start against
  this doc immediately).

Rollback: Waves 1–2 are inert without Wave 3; reverting Wave 3 alone fully disables the feature
(the schema fields idle at 0, matching the `bossSlamX/Y/T` kept-for-offset-stability precedent).
