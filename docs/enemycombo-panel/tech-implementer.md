# Tough Enemy Melee Combos — Tech Implementer Spec

Panel: enemy-combo (negotiated leaps · parry-baited return steps · juggle combos)
Role: TECH IMPLEMENTER · Target: server-authoritative 20Hz sim (`GameRoom.stepSim` phase 5.1) + client presentation
Read basis: `GameRoom.ts` (6690 lines, end to end), `state.ts`, `melee.ts`, `enemies.ts`, `movement.ts`, `prediction.ts`, `BossController.ts` (worm action model), `constants.ts`.

---

## 0. What already exists (the substrate we extend, not replace)

Everything this feature needs has a working precedent in the codebase. The design below is an
*extension of `comboState` + the telegraph pipeline*, not a new system:

| Need | Existing precedent | Where |
|---|---|---|
| Per-enemy multi-step attack machine | `comboState` map: `phase: idle/leapwind/leap/windup/recover`, `t`, `hits`, `wind`, `lx/ly`, `tg`, `strike` | `GameRoom.ts` ~line 512 |
| Scripted authoritative action w/ tick anchors | Serraketh `WormBossState`: `actionKind/actionSeq/actionStartTick/actionResolveTick/actionEndTick/actionTargetX,Y` | `state.ts` 355–379, `BossController.beginAuthoredAction` |
| Commit-at-Lock strike geometry | `planDuelistStrike` snapshots origin+aim at `MELEE_LOCK_PHASE = 0.65` of the windup; telegraph AND damage consume the same frozen values | `GameRoom.ts` 5583–5605, 5637 |
| One telegraph per step | `addMeleeTelegraphRow` (`melee:{enemyId}` cone rows, only `t` mutates) + `addTelegraphRow` (leap landing circle) | `GameRoom.ts` 4498–4547 |
| Parry → attacker knockback | `resolveParry`: attacker displaced `PARRY_KNOCKBACK × 1.6 × ironKnockback` (~154 px), riposte stagger at chain ≥ `PARRY_CHAIN_RIPOSTE_AT` | `GameRoom.ts` 5725–5783 |
| Player vertical axis | `player.height`/`player.vh` synced; `stepVertical` (shared, pure); `PARRY_LAUNCH` already ADDS to `c.vh` (kick 420 px/s, cap 640) | `movement.ts` 193, `constants.ts` 679–681 |
| Airborne gating | pit-fall + boss quake both check `height > GROUND_EPSILON` | `GameRoom.ts` 2364, 4599 |
| Juggled-player reconciliation | prediction vertical is "local-first, adopt-on-divergence": an **unpredicted launch** (their own comment names the parry-launch) shows as >12 px residual and the client adopts the replayed server arc | `prediction.ts` 36–39, 330–335 |
| Horizontal shove reconciliation | `addImpulse` → `player.vx/vy` are synced and rebased every patch; corrections fold into the decaying error offset | `prediction.ts` reconcile() |
| Transition-only VFX counters | `fellSeq`, `parriedSeq`, `revivedSeq`, `critFlash` | `state.ts` |
| Run-boundary hygiene | `clearTransients` already clears `comboState` + orphan telegraphs; `damageEnemy` already removes `combo.strike.tg` on mid-combo death | `GameRoom.ts` 1237–1268, 5130–5132 |

---

## 1. Combo state machine shape

### 1.1 Authoritative machine: server-private map (extend `comboState`), NOT synced fields

Follow the audit-#14 pattern (Brand timers, hidden loot identities): **precise gameplay state stays
server-private; only presentation edges sync.** The full machine lives in the existing per-enemy
`comboState` map, widened:

```ts
// GameRoom.ts — widened comboState value (server-private, pruned with the enemy, cleared by clearTransients)
{
  phase: "idle" | "leapwind" | "leap" | "windup" | "return" | "recover";
  // NEW — authored combo identity + progress (tick-anchored, worm-action style):
  comboId: string;        // keys shared TOUGH_COMBOS; "" = legacy derived lunge (unchanged path)
  stepIndex: number;      // 0-based index into the combo's steps
  stepStartTick: number;  // uint32 ArenaState.tick at step entry (wrap-safe deltas, like attackTick)
  stepEndTick: number;    // authored duration in ticks — resolve edge (worm actionResolveTick precedent)
  negotiatedX: number;    // committed leap landing point (world px) — frozen at decision
  negotiatedY: number;
  // Existing fields kept as-is: t (legacy float path), hits, wind, lx/ly, tg, leapCd, strike{...}
  // NEW — parry-return + juggle bookkeeping:
  displacedX: number;     // position AFTER parry knockback (captured in resolveParry) — the return
  displacedY: number;     //   step path-plans FROM here, not from where the swing was thrown
  empowered: boolean;     // next step uses authored empowered timing/damage (the "comes back stronger")
  returnsLeft: number;    // per-combo cap on parry-baited returns (default 1) — no infinite loop
  juggleHits: number;     // air-keep hits landed so far this combo (cap JUGGLE_MAX_HITS)
}
```

Why tick anchors and not more `st.t -= dt` floats: the worm proved the tick-anchored model survives
catch-up sub-steps and golden-tick tests exactly (`(tick - stepStartTick) >>> 0` deltas, same as
`attackHeld`). New code uses ticks; the legacy derived-lunge path keeps its float `t` untouched so
rusher/swarm/zoner behavior does not change byte-for-byte.

### 1.2 Synced wire additions (appended, minimal)

Two presentation edges the client cannot infer, appended to the END of `EnemyState`:

```ts
// state.ts — EnemyState, appended (field order stable; SCHEMA_VERSION bump — see §1.3)
/** Bumped once per combo STEP COMMIT (leap liftoff, each strike lock, return-step start). Client
 *  edge-triggers step presentation (arc hop, empowered flash) off changes; 0 = no combo. */
@type("uint8") comboSeq = 0;
/** Bit flags: 1 = airborne (leap in flight — client renders the ballistic hop + shadow),
 *  2 = empowered return step (client tints the windup), 4 = juggle follow-up (air-keep posture). */
@type("uint8") comboFlags = 0;
```

And one VFX counter on `PlayerState` (appended):

```ts
/** Bumped when this player is LAUNCHED or air-kept by a juggle hit — client hit-reaction + juice. */
@type("uint8") juggledSeq = 0;
```

Everything else reuses existing wire: `windup` (0→1 per-step white ramp — already per-step for
duelists), `atkSeq` (swing animation edge), `TelegraphState` rows (step geometry), `height/vh`
(juggled player arc).

**Wire-cost math** (Colyseus delta encoding — only changed fields ship):
- `comboSeq`/`comboFlags`: uint8, ~1–2 B payload + index byte per change; a combo commits a step
  every 0.3–0.5 s → ~3 changes/step-pair ≈ **< 20 B/s per active elite**.
- Telegraph per step: row create ≈ 40–60 B once, then one float `t` per tick ≈ 6–8 B × 20 Hz ≈
  **~150 B/s while winding** — identical to today's `melee:` rows (there is still exactly ONE live
  telegraph per elite because steps are sequential).
- `juggledSeq`: 1 change per juggle hit, ≤ 4/combo. Negligible.
- Elites are rare (spawn weight 0.55–0.7 vs 5 for critters); 3–5 concurrent combos ≈ **< 1 KB/s
  total added**, dwarfed by the 80-enemy position stream. No new per-tick unconditional mutations
  (the schema-bandwidth discipline: `windup`/`t` are the only per-tick movers and they exist today).

### 1.3 Schema discipline — COORDINATION FLAG

`constants.ts` on this branch already reads `SCHEMA_VERSION = 18` — the in-flight improvement wave
(combat-receipt ring + `sigGateQueue`, both appended "at schema v18") has claimed 18; master is at 17.
**This feature takes 19.** Rule: one wave = one bump; whoever merges second rebases their appended
fields AFTER the other wave's appends and takes the next number. Do not both claim 18 — the join
handshake would pass while offsets diverge. All three additions above are appends (never inserts),
so old field offsets stay frozen per the documented Colyseus field-order contract.

### 1.4 Combo authoring data (shared, pure, data-driven)

New file `packages/shared/src/enemy-combos.ts` (mirrors the boss framework's data-driven posture —
`enemies.ts` stays the roster, combos are a module library):

```ts
export interface ToughComboStep {
  kind: "leap" | "strike" | "launcher" | "airkeep";
  windupTicks: number;         // authored in TICKS (20 Hz) — deterministic, worm-style
  range: number; halfArc: number;
  damageMult: number;          // × kind.melee.damage
  step: number;                // forward lunge px (strike/launcher); leap uses negotiation instead
  launch?: { vh: number; push: number };        // launcher: player vertical kick + horizontal shove
  airWindow?: { min: number; max: number };     // airkeep: valid target height band (px)
  returnCapable?: boolean;     // may convert a parry knockback into an empowered return step
}
export interface ToughComboDef {
  id: string;
  steps: readonly ToughComboStep[];
  recoverTicks: number;
  empowered: { windupMult: number; damageMult: number };  // authored return-step timing/damage
  maxReturns: number;          // parry-bait cap per combo run (default 1)
  frontOffset: number;         // leap negotiation: land this many px in FRONT of the player
}
export const TOUGH_COMBOS: Record<string, ToughComboDef> = { /* vault-ronin-cross, juggler-uppercut, … */ };
// Pure helpers (unit-testable, no engine/network types — §15 module-library contract):
export function negotiateLeapPoint(target, facingX, facingY, def, clampFn): Vec2;
export function airkeepWindupFits(step, gravity): boolean; // authoring lint: windup ≤ fall time
```

`EnemyKind` gets `combo?: string` (a `TOUGH_COMBOS` key). Kinds without it run today's machine
untouched.

---

## 2. Leap negotiation algorithm

**Decision tick** (`idle → leapwind` edge, same site as today's leap commit at `stepDuelists` 5534):

1. **Facing sample**: the player's front is `aimDir` (synced, refreshed every consumed input command
   and on every attack) — fall back to steering heading `(mvx,mvy)` when the aim is degenerate, then
   to the enemy→player vector. All three are authoritative server-side state at THIS tick; nothing is
   read from the future or the client.
2. **Raw landing point**: `L = playerPos + unit(facing) × def.frontOffset` (≈ `melee.range × 0.6`,
   ~85 px) — the enemy lands *in the player's face*, on the side they are looking/moving toward, so
   step 1 of the combo is in range without a post-landing shuffle.
3. **Distance clamp**: if `|L − enemy| > leap.range`, pull `L` back along the enemy→L ray to range.
4. **Nav-valid clamp** (the same clamps every other placement uses — no new geometry code):
   - arena: `safeSpawnPos(this.map, clamp(x, r, W−r), clamp(y, r, H−r), r)` — nudges off pits + POIs
     (identical to `spawnBossAddAt` / `validateWormPoint`);
   - belt: `x' = beltSafeX(level, x, x)`, `y' = clampBeltFloorY(level, x', y, r)`.
5. **Commit**: write `negotiatedX/Y`, mint the landing telegraph at that FIXED world coord
   (`addTelegraphRow(circle, …, danger=1)` — red, dodge cue, exactly the v0.113 leaper contract),
   set `stepStartTick/stepEndTick`, bump `comboSeq`, set `comboFlags |= AIRBORNE` at liftoff.

**Commit-vs-renegotiate law** (the design's honesty contract, matching the telegraph doc's CRUCIAL
note that danger is authored at fixed world coords):

- The **leap landing point never renegotiates** after `leapwind` begins. The marker is the promise;
  dodging it must beat the leap. The flight interpolation (existing `leap` phase math: remaining
  distance ÷ remaining ticks) flies to `negotiatedX/Y`, not to the live player.
- **Between combo steps**, re-aiming is allowed only in each step's pre-Lock window: from step entry
  until `MELEE_LOCK_PHASE` (0.65) of that step's windup, the strike origin/aim tracks the target via
  `planDuelistStrike` (existing behavior — the lean-in). At Lock the strike snapshot freezes and the
  advertised sector IS the damage sector (existing invariant, kept verbatim).
- A target that dies/disconnects mid-combo: renegotiate to `nearestPoint` at the next step's entry
  edge (pre-Lock), or drop to `recover` if none — mirrors today's `target ?? fallback` handling.

---

## 3. Telegraph pipeline reuse — one telegraph per step

No new telegraph shapes, no new wire fields:

- **Leap step** → one `tg{n}` circle row, `danger=1` (red/unparryable — you dodge the landing),
  `kindTag=2` (existing leaper poof style), `t` filled from `(tick − stepStartTick)/windupTicks`.
  Deleted at landing → client edge-fires impact dust (existing removal contract).
- **Strike / launcher / air-keep steps** → one `melee:{enemyId}` cone row minted AT LOCK from the
  committed `strike` snapshot (`addMeleeTelegraphRow` — geometry = committed origin + rot, `a=range`,
  `b=halfArc`, `danger=0` white/parryable). The client already binds these rows to the owner's
  `windup` scalar by id (ArenaScene 4098), so per-step fill needs zero new sync.
- **Empowered return step** → same white cone (STILL parryable — that is the bait) with `kindTag=7`
  (new cosmetic sub-style: the renderer draws the "coming back angry" flare; `kindTag` exists for
  exactly this "art differs without new shapes" case).
- `enemy.windup` keeps ramping 0→1 per step (the universal white-tell), driven off tick deltas
  instead of `st.t` for combo kinds.

Cleanup paths already exist and are kept: `damageEnemy` removes the strike row on death,
`stepDuelists`'s reaper loop removes rows for deleted enemies, `clearTransients` clears the map and
orphan telegraphs at run boundaries. New rows ride the same three paths (extend the reaper to also
check `comboSeq`-era rows — same lines, one extra field).

---

## 4. Parry-knockback compensation — the return step

Today: `resolveParry` displaces the attacker ~154 px away and (at chain ≥ 3) staggers it. The
return step slots in WITHOUT touching the parry's player-facing rewards (launch, heal, chain, flow):

1. In `resolveParry`, after the knockback clamp: if the attacker's `comboState` has a live combo
   whose current step is `returnCapable`, `returnsLeft > 0`, **and** `pc.parryChain <
   PARRY_CHAIN_RIPOSTE_AT` (the riposte stagger ALWAYS wins — chain mastery still shuts the enemy
   down, no exceptions), then:
   - record `displacedX/Y = attacker.x/y` (post-knockback — the return path-plans from where the
     parry actually put it, i.e. the knockback is real and the enemy visibly claws back from it),
   - set `empowered = true`, `returnsLeft--`, `phase = "return"`,
   - `stepStartTick = tick`, `stepEndTick = tick + round(step.windupTicks × empowered.windupMult)`
     (authored FASTER — e.g. ×0.75 — the "returns stronger" is authored timing, not a speed hack),
   - bump `comboSeq`, set `comboFlags |= EMPOWERED`.
2. The `"return"` phase is a windup variant: the enemy closes from `displacedX/Y` using
   `planDuelistStrike` with `step` scaled up to cover the knockback distance
   (`min(RETURN_STEP_MAX, dist − range×0.45)` — capped so a max Iron-Stance knockback cannot mint a
   screen-length dash), locks at 0.65 as usual, and swings with `damage × empowered.damageMult`.
   The telegraph is WHITE: parry it again and you re-enter `resolveParry` — chain builds toward the
   riposte stagger, which ends the loop. `maxReturns` (default 1) bounds it even without the chain.
3. Iron Stance interplay: bigger knockback ⇒ longer return path at the same authored windup ⇒ the
   empowered swing arrives from farther and reads bigger. No special-casing needed; distance is the
   knob the player already owns.

Un-parried players keep the existing clean-hit branch (`damagePlayer` + `HIT_KNOCKBACK_IMPULSE`
shove) untouched.

---

## 5. Juggle math (server-side)

All player displacement goes through the TWO channels prediction already reconciles — the impulse
system (`addImpulse` → synced `vx/vy`) and the vertical axis (`c.vh` → synced `vh/height`). **Never
write `player.x/y` directly and never call `zeroMoveVel`** — a juggle is a shove, not a teleport.

- **Launcher hit** (un-parried, in the locked arc): reuses the `duelistSwing` hit branch, plus
  ```
  pc.vh = Math.min(pc.vh + JUGGLE_LAUNCH, PARRY_LAUNCH_MAX);   // e.g. 380 px/s → peak ≈ 53 px
  addImpulse(player, dir × step.launch.push);                  // slight pop along the strike
  player.juggledSeq++;
  ```
  Physics check (GRAVITY = 1350): vh 380 → apex at 0.28 s (53 px), back under the 12 px floor at
  ≈ 0.55 s. That is the juggle budget.
- **Air-keep steps**: authored `windupTicks ≤ 6` (0.30 s) so the resolve lands INSIDE the fall
  window — the enemy visibly compensates for the falling player by swinging on a faster authored
  rhythm, not by tracking magically. At the step's **decision tick** the enemy samples the live
  authoritative player (position + `mvx/vx`) and plans the strike origin with a short lead
  (`pos + (mv+v) × windupSeconds` fed to `planDuelistStrike`'s target argument); at Lock (0.65 —
  ~0.2 s out) it freezes like every other strike. The player keeps FULL air steering (prediction
  untouched); dodging out of the locked sector mid-fall is the counterplay.
- **Air-keep hit test**: the existing 2D `inMeleeArc` (melee already hits jumping players — no
  change to that rule) **plus** the height gate `step.airWindow.min ≤ player.height ≤ max`
  (e.g. 12–90 px). On hit: `pc.vh = JUGGLE_KEEP` (~300 px/s — refresh, not stack: assignment, so no
  moon-launch even in co-op with two jugglers), damage, `juggledSeq++`.
- **Honest limits** (each one is a rule, not a tuning suggestion):
  1. `juggleHits ≥ JUGGLE_MAX_HITS` (3) → combo forced to `recover`. Bounded worst-case damage.
  2. Target grounded at an air-keep resolve tick (they dodged the window) → the swing whiffs the
     height gate; combo goes straight to `recover`. Falling out IS an escape.
  3. **Parry works airborne**: `pc.invuln` is height-agnostic today and stays so — parrying an
     air-keep negates it AND adds `PARRY_LAUNCH`, converting their juggle into your ride-the-flurry
     ascent (the §8 Stage-D fantasy composes for free).
  4. Level-window/downed/invuln checks in the hit loop are the existing ones, unchanged.
  5. Airborne juggled players keep the existing airborne exemptions (pit-clear, quake-clear) —
     already gated on `height > GROUND_EPSILON`, zero new code, and it is *coherent*: being juggled
     over a pit does not double-punish.

---

## 6. Client rendering needs

Enemy rigs already play swings off `atkSeq` and white-ramp off `windup`; telegraphs render
generically. New presentation, all driven by appended fields:

1. **Leap arc**: on `comboFlags & AIRBORNE`, ArenaScene lifts the rig on a local cosmetic ballistic
   (`h = 4·H·f·(1−f)` over the flight duration inferred from the `comboSeq` change tick → landing
   telegraph removal) and pins a shrinking shadow blob to the interpolated ground track. The
   *position* stays the plain snapshot interp (the server already moves x/y along the flight);
   only height is cosmetic. On the flag clearing: landing dust + a small camera thump if on-screen.
2. **Empowered return**: `comboFlags & EMPOWERED` → tint the windup ramp (hot-white edge) + `kindTag
   7` telegraph flare; play the existing swing anim family faster to match the authored windup.
3. **Juggle reactions**: `player.juggledSeq` change → hit flash + a brief tumble pose on the rig
   (remote AND local); local player already renders `height` from the predictor so the arc itself
   needs nothing. HUD: reuse the damage vignette.
4. No new manifest art required for ship-first: existing rigs + telegraph renderer + tints.

Touch: `ArenaScene.ts` (enemy sample machinery ~3300/3722, telegraph style table ~4098), possibly
`vfx` for the landing thump. No changes to `prediction.ts` required (see §7).

---

## 7. Prediction interplay for the JUGGLED player

This is the jump-reconciliation precedent applied verbatim — the design was built for exactly this
("a denied jump / **parry-launch we didn't predict**", prediction.ts 331):

- **Vertical**: the server sets `c.vh`; `player.height/vh` are synced. The client's replay produces
  a residual > `HEIGHT_ADOPT_PX` (12 px) on the first post-launch patch and **adopts the replayed
  server arc** — a one-time ≤ RTT lift-off latency (~50–100 ms), after which `stepVertical` on both
  ends integrates identically until the next hit. Air-keep refreshes re-trigger the same adopt. No
  predictor change.
- **Horizontal**: the launch/keep shove is `addImpulse` → `vx/vy` are part of the rebase state at
  every reconcile; the un-predicted displacement folds into `errX/Y` and **glides** out (sub-snap:
  the shove magnitudes are well under `INTERP_SNAP_PLAYER`). This is the same path enemy contact
  knockback and duelist-hit knockback already take today — juggle adds zero new divergence classes.
- **What NOT to do**: no direct `x/y` writes, no `teleportSeq` bumps (that would hard-snap the
  camera), no reduced-air-control gameplay in Phase 1 — air control is mirrored in the shared
  stepper, and gating it on a server-only juggle flag would desync the predictor. If design later
  wants heavier juggled bodies, the flag must become a synced field consumed by
  `stepSteeredMovement` on BOTH ends (shared constant + predictor input) — noted as Phase 2, not
  ship-first.
- The local player will *feel* the launch on the next patch rather than the hit frame. Acceptable at
  co-op PvE latencies; if playtest wants zero-latency lift, the clean fix is predicting off the
  telegraph resolve tick (client knows `stepEndTick` implicitly from the telegraph fill) — flagged
  as a stretch, NOT in this wave.

---

## 8. CPU / wire budgets

- **CPU**: combo machine is O(1) per elite per tick on top of the existing `stepDuelists` pass
  (same forEach). Leap negotiation runs once per leap: one `safeSpawnPos` (grid lookups) — the same
  cost class as one boss add spawn. Air-keep adds one height compare per player in the existing
  O(players) swing loop. Elites in play ≤ ~6 → **< 0.05 ms/tick** added on the 50 ms budget. No new
  allocations in the hot loop (the map entry is created once per enemy, worm-style scratch reuse
  elsewhere).
- **Wire**: §1.2 math — < 20 B/s per elite steady-state + ~150 B/s per live windup telegraph
  (unchanged from today's melee rows), one-time uint8 edges for steps and juggle hits. Telegraph
  count invariant holds: **one live row per elite** (steps are sequential), plus the one landing
  circle during leaps. `SCHEMA_VERSION` 19 forces the reload handshake.

---

## 9. File / function touch list

**shared** (wave 1 — no server lock needed):
- `packages/shared/src/enemy-combos.ts` — NEW: `ToughComboDef/Step`, `TOUGH_COMBOS`,
  `negotiateLeapPoint`, `airkeepWindupFits` (pure; unit tests beside it).
- `packages/shared/src/enemies.ts` — `EnemyKind.combo?: string`; tag `vault-ronin` (leap combo) +
  one new juggler kind (or tag `ronin` with a launcher variant).
- `packages/shared/src/state.ts` — append `EnemyState.comboSeq/comboFlags`, `PlayerState.juggledSeq`.
- `packages/shared/src/constants.ts` — `SCHEMA_VERSION = 19` (see §1.3 coordination), `JUGGLE_LAUNCH`,
  `JUGGLE_KEEP`, `JUGGLE_MAX_HITS`, `RETURN_STEP_MAX`, `COMBO_FLAG_*` bits.
- `packages/shared/src/index.ts` — re-exports.

**server** (wave 2 — GameRoom.ts lock):
- `GameRoom.ts` `comboState` decl (~512): widen the value type.
- `stepDuelists` (~5489): branch `kind.combo` into the tick-anchored machine (`leapwind/leap/windup/
  return/recover` with step arrays); legacy path untouched.
- `planDuelistStrike` (~5637): accept an optional lead-adjusted target (air-keep sampling).
- `duelistSwing` (~5682): launcher/air-keep branches (vh kick, height gate, `juggledSeq`).
- `resolveParry` (~5725): return-step conversion (post-knockback capture, riposte-priority guard).
- `damageEnemy` (~5130): extend the existing strike-telegraph cleanup to combo rows (rebase over the
  receipts wave — see §11).
- reaper loop in `stepDuelists` (~5490): also clear combo landing rows.

**client** (wave 3):
- `packages/client/src/scenes/ArenaScene.ts` — leap-arc cosmetic + empowered tint + `juggledSeq`
  reaction (enemy sample block ~3300–3780, telegraph styling ~4098).

**tests**:
- `packages/shared/src/enemy-combos.test.ts` — NEW (pure helpers).
- `packages/server/src/rooms/GameRoom.combo.test.ts` — NEW (harness reuse; see §10).

---

## 10. Deterministic test strategy

Reuse the established harness (`new GameRoom()`, `onCreate`, fake clients, drive `room.update(50)`;
GameRoom.test.ts line 51). RNG discipline per the fresh flake-fix precedent (commit eee600a): pin
`Math.random` for any path that rolls (toughness, drops); the combo machine itself is
RNG-free by construction (tick anchors + authored data), so most assertions need no pinning.

1. **Negotiation lands at the front + nav-valid**: place player with a known `aimDir` next to a pit
   (seeded map); force a combo elite in leap range; step to the decision tick; assert
   `negotiatedX/Y ≈ player + facing × frontOffset` and `!isPitAtPx(map, …)`. Belt variant asserts
   `clampBeltFloorY` band.
2. **Commit law**: after `leapwind` begins, move the player (inject input commands); assert the
   landing telegraph row's `x/y` never change and the enemy lands at the committed point. Same for a
   strike: advance past Lock (windup × 0.65), move the player, assert the `melee:` row rot/origin
   frozen and damage resolves from the advertised sector (miss when the player left it).
3. **Per-step telegraphs**: one row per step, exactly one live at a time; row deleted at each
   resolve tick; `windup` ramps 0→1 per step.
4. **Parry return**: set the target's `c.invuln`, land the parry; assert (a) attacker displaced by
   the knockback, (b) `phase === "return"` planned FROM the displaced position, (c) empowered
   windup tick count = `round(windupTicks × windupMult)`, (d) empowered damage on the un-parried
   return, (e) with `parryChain ≥ PARRY_CHAIN_RIPOSTE_AT` the stagger fires INSTEAD (no return), and
   (f) `maxReturns` exhausts.
5. **Juggle**: launcher hit → `player.height` rises next tick, `vh === JUGGLE_LAUNCH` (capped),
   `juggledSeq` +1; air-keep inside the window refreshes `vh` (assignment, not add); a grounded
   target at resolve ends the combo; `JUGGLE_MAX_HITS` forces recover; airborne parry of an air-keep
   negates + adds `PARRY_LAUNCH` on top.
6. **Prediction contract** (`prediction.test.ts` pattern — mock server running shared steppers):
   feed a mid-flight `vh` change through `reconcile`; assert the >12 px residual adopts and NO
   `teleportSeq`-style snap occurs; horizontal shove folds into err and decays.
7. **Hygiene**: kill the elite mid-leap and mid-windup → no orphan telegraph rows (extends the
   existing orphan assertions); `restartRun`/`toggleTraining` clears combo rows (clearTransients
   already covers the map — assert the rows too).
8. **Golden phase-order test**: unchanged — the combo machine runs inside phase 5.1; assert the
   hand-numbered contract still passes byte-identical for non-combo kinds.

---

## 11. File-lock wave plan + collision flags with the in-flight improvement wave

The working tree already carries the improvement wave inside `GameRoom.ts`: **G-01 weapon-draw lock**
(`CombatState.drawLock`, `WEAPON_DRAW_LOCK_SECONDS`, `transitionWeapon`) and **polish-07 combat
receipts** (`CombatReceiptState` ring, `writeCombatReceipt` calls threaded through `damageEnemy` and
every damage source), both stamped "schema v18". Concrete collision surface with THIS feature:

| Collision | Risk | Rule |
|---|---|---|
| `SCHEMA_VERSION` | Both waves appending schema fields | Receipts wave owns **18**; this feature takes **19** and appends AFTER `combatReceipts`/`sigGateQueue`. Single-bump-per-wave; never renumber theirs. |
| `damageEnemy` | Receipts added `writeCombatReceipt` + params mid-function; our mid-combo-death cleanup edits the same region (5130-ish) | Land AFTER the receipts wave merges; our edit is 3 lines adjacent to the existing `combo.strike` cleanup — rebase, don't pre-merge. |
| `CombatState` interface | `drawLock` was just added to the same declaration block our juggle bookkeeping does NOT touch (juggle state lives on `comboState`/`pc.vh`) | No field additions to `CombatState` in this wave — deliberate, to keep the diff disjoint. |
| `resolveParry` | The dodge-integrity P0 fixes (commit 3b5ae75) touched telegraphs + parry paths | Our hook is append-only at the end of `resolveParry` (after `applyParryAugments`); re-read on rebase. |
| `stepDuelists` | Same commit reworked Lock/strike commitment | Our machine BUILDS on that exact commitment model — verify `MELEE_LOCK_PHASE` and `strike` snapshot semantics on rebase before extending. |
| Enemy melee receipts | Receipts are player-sourced only (`sourcePlayerId` required, early-return otherwise) | Enemy combo hits write NO receipts — no interface pressure. |

**Wave plan** (locks are per-file; each wave is independently green — `pnpm lint` CRLF caveat noted
in project memory, CI is the arbiter):

- **Wave A — shared foundations** (locks: `enemy-combos.ts` NEW, `enemies.ts`, `state.ts`,
  `constants.ts`, `index.ts`). Pure data + appended schema fields + tests. Blocks nothing; nothing
  reads the fields yet. MUST land after (or coordinated with) the receipts wave's v18 claim.
- **Wave B — server machine** (lock: `GameRoom.ts` only, + new `GameRoom.combo.test.ts`). The whole
  §9 server list in one lock session — the functions are adjacent and interleave, splitting them
  invites conflicts. Rebase over the improvement wave first (table above).
- **Wave C — client presentation** (locks: `ArenaScene.ts`, vfx touch). Purely additive; can run in
  parallel with B once Wave A's fields exist (renders default-0 fields as "no combo" until B ships).
- **Wave D — tuning + golden re-record** if any authored constant shifts the phase-order fixture
  (it should not — phase 5.1 internals only).

---

## Final note — architecture chosen

I kept the entire combo brain server-private in the existing per-enemy `comboState` map — widened
with worm-style tick anchors (`comboId/stepIndex/stepStartTick/negotiatedX,Y`) rather than floats —
and synced only three appended presentation edges (`EnemyState.comboSeq/comboFlags`,
`PlayerState.juggledSeq`) at schema v19 (v18 is claimed by the in-flight receipts wave), because
every hard problem here already has a proven rail: per-step telegraphs reuse the `melee:` cone rows
and the Lock-at-0.65 commitment invariant verbatim; leap negotiation is one facing-projected point
clamped through the same `safeSpawnPos`/belt clamps every spawn uses, committed at decision and
never renegotiated after the marker exists; parry-return path-plans from the post-knockback position
with authored empowered tick timing, capped by `maxReturns` and always losing to the riposte
stagger; and juggles push the player exclusively through the two channels prediction already
reconciles (`addImpulse` and `vh`), so the juggled client adopts the launch via the existing
jump/parry-launch divergence rule with zero predictor changes — the result is a data-driven combo
library (`TOUGH_COMBOS` in shared) that lands in three small file-lock waves without fighting the
weapon-draw-lock/combat-receipt changes currently landing in `GameRoom.ts`.
