# Hit-FX Panel — FEEL (Tactile Channel) Design

**Role:** Impact-feel designer. Owns hit-stop, knockback/flinch, follow-through, screen shake, haptics, and their composition laws.
**Directive:** "make hit effects satisfying including all our senses — sight, feel, hearing — including sounds similar to the tsktsktsktsk you get when landing hits in CoD."
**Scope note:** This doc is the tactile half of that sentence. The audio panelist owns the tsk-tsk sound itself; my job is to make sure every tsk has a *thud* under it — and that sixty tsks per second never become sixty thuds.

---

## 0. What exists today (read-first findings)

The foundation is genuinely good. We are tuning a working system, not building one.

| System | Where | What it does now |
|---|---|---|
| `hitStop(ms, priority)` | `packages/client/src/scenes/ArenaScene.ts:6848` | Global presentation freeze via `frozenUntil = max(...)`. Non-priority spends from a **leaky bucket: 250ms per rolling 1000ms** (`FREEZE_BUDGET_MS`/`FREEZE_WINDOW_MS`, :6835). Priority events bypass AND don't deplete it. |
| Freeze semantics | `ArenaScene.ts:3120-3148` | Frozen frames skip interpolate/animate for players, enemies, worm, projectiles. Input, net sync, prediction, XP motes keep running. Unfreeze edge folds accrued prediction error so catch-up glides (:3126). `animClock` advances only on unfrozen frames. |
| Hit-stop-aware rig clocks | `packages/client/src/entities/SpriteRig.ts:1597-1640` | Beats accepted during a freeze begin at the held presentation phase; observed remote signatures flush only from `animate()` so they can't outrun a held actor. |
| Existing hit-stop calls | `ArenaScene.ts` | Quake **connected** 130ms priority (:6473); parry 100ms priority (:7201); crit +70ms budgeted (:7186); near-you kill 45ms budgeted, throttled ≥110ms apart via `lastKillStop` (:3441). |
| `shakeCam(duration, intensity)` | `ArenaScene.ts:6868` | Priority shake: equal-or-stronger force-restarts, weaker is dropped. Current grammar: gun per-shot ≤70ms/recoil(~0.0017); got-hit 100/0.005; boss slam 200/0.014·scale; quake ground-buckle 280/0.03; titanic 700/0.02. |
| Server impulse (players only) | `packages/shared/src/movement.ts:159-183`, `GameRoom.ts` | `addImpulse` + `stepImpulse`: exp friction (`IMPULSE_FRICTION=9`), cap `IMPULSE_MAX=780`. Used for gun recoil and getting-hit knockback (`HIT_KNOCKBACK_IMPULSE=300`). **Enemies have no impulse channel** — the only enemy displacement is the parry's direct positional shove (`PARRY_KNOCKBACK=96px`, `GameRoom.ts:5369-5388`). |
| Combat-receipt ring | `packages/shared/src/state.ts:318-334`, writer `GameRoom.ts:2111` | Authoritative per-hit: `targetId, sourcePlayerId, weaponId, delivery (Melee/Gun/Cast/Thrown/Beam/Quake/Chain/Parry/Scatter), element, dirX/dirY, damage, crit, finalBlow`. Currently consumed only for the self-damage recap. **This ring is the spine of everything below.** |
| Client hit detection | `ArenaScene.ts:7100-7187` | Per-frame hp-drop diff, crit via `critFlash` counter, attribution via **nearest-player heuristic** (the exact thing receipts were added to replace — polish.md finding #7). |
| Known debt | `docs/improve2-panel/polish.md` P0 #1 | Tween-driven ribbons/composer packs and wall-clock tome/combo layers spend wall time during a freeze — the actor holds, its effects don't. Every mechanism in this doc must ride the presentation clock, not wall clock. |
| Beam ticks | `packages/shared/src/combat.ts:88` | `tickRate` quantized to 0.05–0.25s → **4–20Hz per-enemy damage events**. This is the stacking hazard. |
| Telegraph timings | `packages/shared/src/constants.ts` | `LUNGE_WINDUP=0.46s`, swarm `0.32s`, `BOSS_SLAM_TELEGRAPH=0.85s`. These set the ceiling on how much time-dilation feel effects may inject. |

---

## 1. The hit-stop tier table

**Composition law (unchanged, load-bearing):** `frozenUntil = max(existing, now + ms)` — freezes never *add*, they *extend*. Priority freezes bypass the bucket and don't deplete it; the sacred set stays tiny.

**Who freezes:** keep the **global** presentation freeze for every tier. Victim-only freezing was considered and rejected: rigs ride shared scene passes (`interpolateEnemies`/`animateEnemies`), per-rig clocks would multiply the split-clock bug polish.md P0 #1 already documents, and at ≤50ms a global stop reads as "the world felt that" rather than "the game hitched." The prediction fold at :3126 already makes global freezes free of pop.

| Tier | Event | Duration | Priority? | Refractory | Notes |
|---|---|---|---|---|---|
| **T0** | Beam tick, Scatter pellet, ordinary gun bullet, Chain arc, Cast tick | **0ms** | — | — | High-frequency deliveries NEVER freeze. Their feel channel is flinch + rumble hum + audio (§2, §6). This is the compression law's first clause. |
| **T1** | Melee light connect (equipped melee, no `quake`, damage < 40) | **30ms** | budgeted | 90ms | 2 frames at 60fps — a tick, not a pause. New. |
| **T2** | Melee heavy connect / any big hit (`dmg ≥ 40`, the existing `big` band) | **50ms** | budgeted | 90ms | New. Thrown/Cast direct hits that cross the band also land here. |
| **T3** | Crit | **70ms** | budgeted | 90ms | Existing value at :7186, kept. Crit on a heavy connect = max(70, 50), not 120. |
| **T4a** | Normal kill near you (<420px) | **45ms** | budgeted | 110ms (existing `lastKillStop`) | Existing value at :3441, kept. |
| **T4b** | Tough-enemy kill (yours) | **80ms** | budgeted | 110ms | New — a tough dying should out-weigh a swarm pop. |
| **T4c** | Multi-kill: ≥3 final blows in one aggregation window from one source swing/quake | **95ms** | budgeted | 250ms | New. Replaces (not stacks with) the individual 45s — see §3. |
| **T5** | Parry (yours) | **100ms** | **priority** | — | Existing, sacred, untouched. |
| **T6** | Quake that connected | **130ms** | **priority** | — | Existing, sacred, untouched. |
| **T7** | Boss final blow / worm segment sever (yours) | **160ms** | **priority** | once per boss | New. The single longest stop in the game; a run-defining beat. |

**Hard cap:** no single freeze may exceed 160ms. Rationale in §8 (telegraph readability).

**Ownership rule:** T1–T4 fire only when `receipt.sourcePlayerId === self` (or, until receipts drive this path, the existing near-you proxy). A teammate's crit across the map must not stop *your* world; their kills already read via VFX/audio at reduced weight.

**Clock rule (the polish.md P0 #1 mandate):** every decay/spring introduced in this doc (flinch decay §2, camera punch spring §5, follow-through settle §4) advances on `animClock` / the rig presentation clock — never `this.time.now` deltas — so a freeze holds the *entire* impact picture, not just the actor.

---

## 2. Victim micro-knockback / flinch — recommendation: client-only, receipt-driven

**Recommendation: client-only cosmetic flinch for all per-hit reaction; server displacement reserved for two heavy deliveries. Do not add an enemy impulse channel.**

Why not server impulse per hit:
- Enemies have no `Impulse` field; adding one means new schema bytes × enemy count × 20Hz, `updateEnemyGrid` churn on every hit, and re-tuning every AI approach speed against constant jitter.
- At 20Hz a 4-tick knockback is 200ms of authoritative displacement — it changes *balance* (kiting, spacing, beam tracking), and the directive is about *feel*, not balance.
- The receipt ring already carries `dirX/dirY` per hit — the client has everything it needs to fake it perfectly.

**Client flinch spec** (new small system, e.g. per-rig `flinchX/flinchY` consumed in `animateEnemies`):
- On receipt for `targetId` I can see: offset the rig's **render** position along `(dirX, dirY)`:
  - T0 deliveries (beam tick, bullet, scatter): **3px**
  - Melee light: **5px**; melee heavy / big band: **8px**
  - Crit: **11px**, plus a 1-frame 1.06× squash perpendicular to the hit vector
- Decay: exponential toward zero with time-constant **~45ms** (visually settled in ~120ms), advanced on `animClock` so a freeze holds the flinch at full extension — the crunchiest possible frame is the frozen one.
- Stacking: additive but clamped to **14px** total, so a 10Hz beam produces a sustained ~4–6px shiver — the visual tsk-tsk-tsk — never a teleport.
- Never touches authoritative `enemy.x/y`: collision, AI, telegraph anchors, and the enemy grid are untouched by definition. Belt mode is safe because the offset applies in render space after `beltY`.
- Budget: flinch is two floats per rig and one add in an existing pass — it does NOT count against `HIT_VFX_BUDGET`, so it's the one feedback channel that never degrades in hordes. Off-screen rigs skip it.

**Server displacement, Phase 2 (optional, two call sites only):** a parry-style direct positional nudge (`GameRoom.ts:5383` pattern — clamp + `updateEnemyGrid`) of **16px** on Quake connect and **12px** on a melee heavy finisher. One-shot, not an impulse; cheap; makes the two priority hit-stops physically true. Skip bosses/worm (the parry code already exempts the worm at :5377).

---

## 3. The compression law (rapid-hit anti-stacking)

A beam at 10Hz across 6 enemies is 60 receipts/second. The law has four clauses, layered:

1. **Tier-zero deliveries never freeze.** `Beam`, `Scatter`, `Chain`, and `Cast`-tick receipts are T0 by delivery enum — checked before anything else. They express through flinch (uncapped, cheap), rumble hum (§6), and audio. 60 beam hits/s = **0** freezes.
2. **Per-frame aggregation.** Hits are already observed batched (the hp-diff scan and the receipt drain both run once per render frame). All eligible freezes in one frame collapse to **one** call: `hitStop(max(tier) + min(8 × (extraHits), 24))`, capped at 95ms. Six simultaneous melee-cleave hits = one ~74ms stop that *feels* bigger than one hit, not six stops.
3. **Per-tier refractory** (generalize the existing `lastKillStop` pattern into a small per-tier timestamp map): T1–T3 ≥90ms between fires, T4 keeps 110ms, multi-kill 250ms. A 5Hz auto-melee build ticks T1 at most ~11×/s → at most the refractory allows ~6 × 30ms = 180ms/s *requested*…
4. **…and the leaky bucket stays as the backstop.** 250ms/1000ms (`ArenaScene.ts:6835`) is already correct and is not to be raised. When the bucket rejects, the hit still has flinch + spark + rumble + sound — hit-stop is the garnish, never the only signal.

Multi-kill folding: final-blow receipts from one `sourcePlayerId` within one aggregation window (one render frame, plus a 50ms trailing window for a sweeping quake) collapse into a single T4c fire, replacing their individual T4a/b requests.

---

## 4. Attacker follow-through weight

The attacker's own body must acknowledge the connect — this is what sells melee weight more than any victim effect.

- **Connect pulse:** on the first receipt of a swing (`sourcePlayerId === self`, delivery Melee/Quake), the attacker rig gets a 1-frame **1.05× scale pulse** and a **3px lean** along the swing direction, decaying on `animClock` over 60ms. During the hit-stop this reads as "braced against the blow."
- **Heavy recovery hold:** melee heavy connects extend the rig's post-impact pose hold by **+70ms of `animClock`** (the swing system already rides `animClock` / `impactSeconds` from `packages/shared/src/melee.ts:1013,1093`, so this is a presentation-phase offset, not a gameplay change — attack cadence is server-authoritative).
- **Whiff contrast rule:** none of this fires on a miss. A swing that connects and a swing that whiffs must feel categorically different; the whiff keeps today's clean follow-through. That contrast *is* the weight.
- Self recoil impulse on guns (`GUN_RECOIL_IMPULSE`, server) already provides the shooting-side body feel; no change.

---

## 5. Screen-shake grammar + the controller-free rumble equivalent

`shakeCam`'s priority rule (weaker never stomps stronger, :6868) is the budget. The grammar that keeps it legible:

**Grammar rule 1 — danger outranks glory:** no *outgoing*-hit shake may reach the got-hit intensity (0.005) except multi-kill, and nothing outgoing may approach boss-slam (0.014). The player's spine must always know the difference between "I hit something" and "something hit me."

| Event | duration ms | intensity | vs. existing |
|---|---|---|---|
| Beam tick / bullet / scatter | 0 | — | gun already has per-shot recoil shake (≤70 / recoil) |
| Melee light connect | 0 | — | flinch + rumble carry it |
| Melee heavy / big hit | 60 | 0.0022 | below gun-recoil ballpark; texture, not an event |
| Crit | 90 | 0.0038 | just under got-hit |
| Kill (yours) | 70 | 0.0030 | |
| Tough kill | 110 | 0.0045 | |
| Multi-kill | 140 | 0.0060 | the one outgoing shake allowed past got-hit |
| Boss final blow | reuse the existing titanic 360/0.011 site | | |
| *(unchanged)* got-hit 100/0.005 · boss slam 200/0.014 · quake 280/0.03 | | | |

**Grammar rule 2 — shake says "big," punch says "where."** The **camera micro-punch** is the controller-free rumble equivalent and the directional channel shake can't provide:

- On T2+ own-hits, offset the camera follow target **toward the hit direction** (`receipt.dirX/dirY` — the blow's true vector, not the nearest-player guess): crit **4px**, kill **5px**, multi-kill **7px**, heavy **3px**.
- Critically damped spring return over **~80ms on `animClock`** — it must never oscillate (oscillation is shake's job) and must freeze mid-punch during hit-stop.
- Refractory 90ms, and punches don't stack — new punch replaces the spring state.
- Implementation seam: a `punchX/punchY` added in `followSelf()` after the follow computation; zero interaction with `shakeCam`'s bookkeeping since Phaser shake is a separate camera effect.

---

## 6. Gamepad rumble — progressive enhancement spec

Phaser 4's `Input.Gamepad` plugin surfaces pads but haptics come from the underlying native `Gamepad` object (`navigator.getGamepads()[i].vibrationActuator`, `dual-rumble` effect — Chromium-family only; Firefox/Safari lack `playEffect`, some pads lack actuators). Spec accordingly:

- **Capability gate:** one check at first pad connect: `pad.vibrationActuator?.playEffect` is a function → enable; else the feature silently doesn't exist. No polyfill, no setting UI needed initially (respect a future accessibility toggle).
- **Natural compression:** `playEffect` *replaces* any running effect on that actuator — the API itself is a last-writer-wins channel. Impose the same priority rule as `shakeCam`: track `rumbleUntil`/`rumbleStrength`; a weaker request while a stronger one runs is dropped.
- **The tsk-tsk channel (this is the CoD ask, in the hands):** while your beam/auto-fire is landing ticks, refresh a low hum on every receipt: `{duration: 60, weakMagnitude: 0.15, strongMagnitude: 0}`. At 10–20Hz the refreshes fuse into a granular buzz that stops the instant you stop hitting — hit-confirmation you can feel without looking.

| Event | duration ms | strong | weak |
|---|---|---|---|
| Beam/auto tick (refresh) | 60 | 0 | 0.15 |
| Melee light | 40 | 0.25 | 0.10 |
| Melee heavy | 70 | 0.45 | 0.15 |
| Crit | 90 | 0.65 | 0.30 |
| Kill | 70 | 0.50 | 0.20 |
| Multi-kill | 150 | 0.90 | 0.40 |
| Parry | 60 | 1.00 | 0 (one sharp snap) |
| Got hit | 120 | 0.80 | 0.40 |
| Boss slam nearby | 200 | 0.70 | 0.60 |

Danger-outranks-glory applies here too: got-hit (0.80 strong) beats every outgoing except multi-kill/parry snaps, which are short enough not to mask it.

---

## 7. Kill-tier escalation summary

| Kill class | Hit-stop | Shake | Punch | Rumble | Plus |
|---|---|---|---|---|---|
| Normal kill | 45ms | 70/0.0030 | 5px | 0.50/70ms | existing paper-death pop |
| Tough kill | 80ms | 110/0.0045 | 5px | 0.55/90ms | victim flinch 11px pre-death |
| Multi-kill (≥3, one swing) | 95ms (folded, replaces singles) | 140/0.0060 | 7px | 0.90/150ms | one fire per 250ms |
| Boss / worm-sever final blow | 160ms **priority** | titanic 360/0.011 | 8px | 1.0/300ms | once per boss |

Escalation is *replacement*, never summation — a quake that kills 8 enemies including 2 toughs resolves to exactly one multi-kill package.

---

## 8. Telegraph readability constraints (the non-negotiables)

Server simulation runs through client freezes — a freeze doesn't pause danger, it hides its progress. The dodge/parry windows are `LUNGE_WINDUP=0.46s`, swarm `0.32s`, boss slam `0.85s`:

1. **160ms single-freeze hard cap** = exactly half the tightest windup (0.32s). Even the worst-case priority stop landing at the worst moment leaves half the swarm-lunge tell visible.
2. **The 250ms/s bucket caps average time-theft at 25%** for all budgeted feel combined. Do not raise it; every tier above was sized to live inside it.
3. **Enemy attacks never trigger hit-stop.** Incoming danger expresses through shake/rumble/flinch only — freezing the world on *their* wind-up would be aiming the gun at our own reaction window.
4. **Flinch and camera punch never move authoritative positions or telegraph anchors** (client-render-space by construction, §2/§5). A white-tell ring stays glued to the true enemy position even while its rig shivers.
5. **Shake intensity ceiling during an active nearby unparryable telegraph** (optional polish): while a `TELEGRAPH_DODGE` tell is live within ~300px of self, clamp outgoing-hit shake to 0.003 so the red tell isn't reading through jelly.

---

## 9. Build order

1. **Receipt-driven flinch + tier table** (T0 law, T1/T2 additions, per-tier refractory, frame aggregation) — biggest feel win, no schema changes, retires the nearest-player direction guess for feel purposes.
2. **Attacker follow-through + camera micro-punch** — both ride `animClock`; small, local.
3. **Kill escalation folding** (multi-kill window, tough/boss tiers).
4. **Gamepad rumble** — isolated progressive enhancement, can ship any time after receipts drive the feel path.
5. **Phase-2 server nudges** (quake 16px / heavy-finisher 12px) — only after 1–3 prove the client-only flinch reads; it may already be enough.
