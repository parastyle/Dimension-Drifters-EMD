# Dimension Drifters — Weapon Animation Review and Sequential Melee Combos

## 1. CURRENT-SYSTEM REVIEW

### Verdict

The paper-doll rig is no longer a generic “rotate the weapon” system. It has a useful seven-style vocabulary, captured aim, hand-driven offsets, full-body envelopes, two-handed grip reconstruction, fake depth, and a genuinely good continuous-spin special case. The strongest work is `chop`, `orbit`, and `spin`; the weakest parts are bare fists, thrust damage readability, dual-rake ownership, and the absence of a single accepted-swing clock shared by rig, VFX, and server.

The current §20 WYSIWYG claim is therefore **spatially credible for a classic arc, approximately credible for orbit/spin coverage, and not yet true in time or shape for chop, pivot, punch, and thrust**. The server is authoritative and its swept-blade implementation is solid on its own; the problem is that most visual styles are not sampling the same path on the same timeline.

### What the vocabulary gets right

`swingStyleFor()` is a compact, legible resolver: an authored `WeaponDef.swingStyle` wins, then worn gear splits into claw `pivot` versus blunt `punch`, quake gear becomes `chop`, long piercing families become `thrust`, two-handed gear becomes `orbit`, and everything else falls back to `arc` (`packages/client/src/entities/SpriteRig.ts:47-62`). That is a good defaulting hierarchy for a large arsenal, and `WeaponDef.swingStyle` already provides the correct escape hatch (`packages/shared/src/weapons.ts:38-49`).

The rig also has the right common infrastructure:

- Aim is frozen when the swing starts, rather than chasing the cursor through the move (`packages/client/src/entities/SpriteRig.ts:416-432`; `packages/client/src/scenes/ArenaScene.ts:3548-3551`).
- Style motion drives the front hand, not just the weapon sprite; the weapon then rides the hand, and two-handed weapons reconstruct the second grip along the haft (`packages/client/src/entities/SpriteRig.ts:858-910`, `:1039-1046`).
- Body posing is additive over gait/look/recoil. Chop stretches and squashes, rake twists the shoulder, punch rotates from the hips, thrust stretches into the lunge, and orbit/spin crouch and turn the torso (`packages/client/src/entities/SpriteRig.ts:693-849`, `:998-1024`). This makes attacks belong to the character instead of reading as a detached prop.
- The animation clock pauses during local hit-stop, so the rig no longer silently skips animation frames during a freeze (`packages/client/src/scenes/ArenaScene.ts:358-361`, `:1740-1756`). That is a presentation win, although it creates a server-phase risk discussed below.
- The former end-of-swing hard snap has been fixed: ordinary styles occupy `cooldown × SWING_WINDOW_FRAC`, and explicit recovery branches return to rest at `t = 1` (`packages/client/src/entities/SpriteRig.ts:667-675`, `:840-845`).

### Style-by-style assessment

| Style | What reads well | What is weak |
|---|---|---|
| **Arc** | The blade winds 16%, sweeps 58%, recovers 26%, and the visible sweep is centered on frozen aim (`SpriteRig.ts:830-849`). This is the cleanest match to the server’s centered negative-to-positive arc. | The body contribution is only `0.07 rad`, so large one-handed blades can still read wrist-led. Every arc repeats in the same direction. There is no held follow-through pose between attacks, so “chain” flow cannot exist yet. |
| **Orbit** | This is the visual standout: elliptical waist path, projected foreshortening, radial blade orientation, far-side depth swap, both hands on the haft, and torso paper-twist (`SpriteRig.ts:938-1031`). It uses paper-doll limitations as a style. | It is the default for **all** two-handed weapons after earlier checks, so a spade, coffin lid, anchor, saw, and nodachi inherit the same waist orbit whether or not their fantasy supports it. It also travels `1.5 rad` before and `0.9 rad` past the authored damage arc (`SpriteRig.ts:968-973`), visibly touching space the default server sweep does not cover. There is no discrete impact frame. |
| **Chop** | Best weight envelope in the ordinary set: 30% raise, accelerating fall to the shared 52% landing, an 18% buried hold, then 30% recovery. Torso lean, toe-rise, downward drive, and squash all reinforce the blade (`SpriteRig.ts:693-733`). | The weapon angle is an authored screen-space overhead-to-forward pose; it does not use `aimLocal` for its actual arc (`SpriteRig.ts:699-718`). Meanwhile the server still performs a wide centered angular sweep from the input tick. The quake lands on a meaningful visual beat, but the edge can already have damaged targets before the blade arrives. |
| **Pivot / rake** | The front arm crosses the target, reaches outward at mid-rake, and the shoulder twists behind it. The asymmetric `−60% → +40%` path feels like dragging talons through a body rather than rotating a knife in place (`SpriteRig.ts:734-766`). | Anticipation is only 10%, which can pop on large claws. Only the **front** hand receives `swingOff`; the other claw merely inherits weapon rotation, so dual claws do not alternate or scissor (`SpriteRig.ts:878-884`). The visual arc is forced to at least `2.6 rad` and enlarged to `1.1 × swingArc`, while the server uses the unmodified authored arc. |
| **Punch** | Chamber, hook path, hand extension, hip rotation, crouch, and a deeper two-handed roundhouse are all present. Full extension lands at the same 52% beat used by quake (`SpriteRig.ts:767-809`). | Bare fists do not reach this branch: all melee style dispatch is gated by `this.weapons.length > 0` (`SpriteRig.ts:655-675`), while `unequip()` deliberately keeps a fists definition with zero weapon sprites (`SpriteRig.ts:496-502`). The nominal fists fallback therefore has no authored punch. Server collision is still a full-length rotating blade, not a traveling fist volume. |
| **Thrust** | The blade locks to aim, draws back 14%, reaches full extension at 38%, and carries the torso into the lunge (`SpriteRig.ts:810-828`). Its silhouette is immediately distinct from a slash. | The remaining 62% is one long ease back with no extension hold or tip recoil, so the stab loses its puncture beat. More importantly, the server fans `swingArc` across the target like a sword; it does not test a segment growing along the aim line. This is the largest geometry mismatch. |
| **Spin** | The authored-only whirlwind is coherent end to end: integer revolutions, blade/body mirror turns, a full-cooldown window, and chained presses that remove spin-up so angle and speed remain continuous (`SpriteRig.ts:689-692`, `:958-967`, `:998-1016`). The Dervish Greatblade correctly pairs two turns with a `4π` damage arc (`packages/shared/src/weapons.ts:636-655`). | The first visual spin eases into motion while the server advances linearly. The server ends at `95%` of the effective cooldown, the client uses `100%` of base cooldown, and only the client knows `swingChained` (`GameRoom.ts:2171-2177`; `SpriteRig.ts:964-967`). Total coverage is right; instantaneous blade angle is not. |

`swingChained` is a good seed, but today it is only a Boolean and only spin consumes it. Its ordinary-style test is “previous visual duration + 150 ms” (`packages/client/src/entities/SpriteRig.ts:419-431`). Because an ordinary visual duration is only `0.64 × cooldown`, a slow weapon’s next legal attack can occur after that test has already expired. It cannot serve as the combo counter without being redefined around the **accepted attack cadence**, not the visual window.

### The real visual-versus-damage clock

There are currently four clocks:

| Layer | Current clock | Consequence |
|---|---|---|
| Rig, non-spin | `T_rig = baseCooldown × 0.64` (`SpriteRig.ts:667-675`; `constants.ts:454-463`) | Loot speed affixes change attack cadence but do not speed up or slow down the pose. |
| Server edge | `T_edge = min(0.18 s, max(0.04 s, 0.9 × effectiveCooldown))` and it begins immediately (`packages/shared/src/melee.ts:13-31`; `GameRoom.ts:2162-2178`) | Slow weapons finish all edge damage early in a much longer pose; very fast weapons can remain damaging after their pose has ended. |
| Authored swing VFX | Fixed `470 ms`, regardless of weapon or style (`packages/client/src/vfx/VfxPlayer.ts:15-19`, `:315-343`) | A 220 ms saw and a 950 ms anchor play the same-length effect. The VFX suite has no combo step or signed sweep direction. |
| Quake | `baseCooldown × 0.64 × 0.52` on both peers (`constants.ts:454-463`; `ArenaScene.ts:3583-3597`; `GameRoom.ts:2240-2255`) | The formula is shared, but the client starts it on button-send and the server starts it on accepted attack. Network/tick/buffer phase is not shared. |

For a plain 0.62 s Driftblade, the rig lasts about 397 ms. Its visible arc action runs from about 64 ms to 294 ms, but the authoritative blade sweeps its entire arc from 0 ms to 180 ms. For a 0.78 s Tombstone Greatsword, the visual/quaked impact is about 260 ms after the local press, but the ordinary edge sweep is complete by 180 ms. For a 0.22 s Buzzcutter, the pose lasts about 141 ms while the ordinary server edge stays active for 180 ms. These are not tiny easing differences; they invert which frame appears dangerous.

The server path itself is robust. It stores frozen aim, reach, arc, thickness, elapsed time, active time, and a hit-once set (`packages/server/src/rooms/GameRoom.ts:391-406`, `:2162-2179`). Each 20 Hz tick is angularly super-sampled at `0.08 rad`, and the live authoritative player position anchors every sample (`GameRoom.ts:2296-2368`; `packages/shared/src/melee.ts:18-31`). Captured aim and rendered-tip reach are also sound WYSIWYG decisions (`GameRoom.ts:2154-2168`; `packages/shared/src/weapons.ts:292-304`).

The mismatch comes from the descriptor: `bladeAngleAt()` always travels linearly from `aim − arc/2` to `aim + arc/2` (`packages/shared/src/melee.ts:29-31`), regardless of visual style. Arc broadly follows that path. Orbit crosses it amid extra wind/follow motion. Spin eventually covers it. Chop, punch, and thrust do something else; pivot uses a different size and center. Belt mode is a separate exception: it ignores the angular path entirely and tests a forward lane throughout the active window (`GameRoom.ts:2313-2342`).

There is also no accepted-swing event on the client. The local rig and VFX fire immediately before `room.send("attack", ...)` (`ArenaScene.ts:3530-3551`, `:3635-3662`); the server buffers the request for up to 150 ms, normalizes aim, and fires only when its cooldown gate accepts it (`GameRoom.ts:567-600`, `:1875-1917`; `constants.ts:487-493`). Shared duration constants prevent rate drift, but they do not establish a shared epoch. The existing tests prove that a sweep eventually connects, a spin reaches behind aim, and a quake eventually waits beyond click; they do not assert per-frame visual/server phase (`packages/server/src/rooms/GameRoom.test.ts:204-226`, `:851-884`).

### VFX assessment

`VfxPlayer` has a sensible live pipeline: Weaponsmith suites are baked, pooled, rotated into aim space, drawn through the canonical renderer, and allowed a 900 ms particle tail instead of being cut off (`packages/client/src/vfx/VfxPlayer.ts:1-19`, `:258-343`). Fallback suites also distinguish element and broad archetype—dual, reachy, heavy, fast—rather than giving 300 expansion weapons the same slash (`VfxPlayer.ts:84-138`).

The weakness is integration, not renderer quality. The generated authored table contains seven weapon entries and exposes suite, rotation, radius, origin, cursor spawn, hero, and scatter, but no animation style, combo step, impact fraction, or direction (`packages/client/src/vfx/weapon-vfx.generated.ts:6-24`, `:24-167`). The player runs the whole suite from `p = 0 → 1` in 470 ms (`VfxPlayer.ts:258-325`), while fallback impact graphics generally peak near their own fixed phase. The result is attractive VFX beside the attack, not VFX driven by the blade’s authoritative phase.

The new component-pack directory should be treated as promising but not production-complete in this checkout. `packages/client/public/vfx/packs/nuke/` contains eleven separated painted components, including flash, cloud, rings, ground crack, dust, smoke, and debris shapes that can be repurposed at restrained scale. `packs/lightning-ball/` is currently empty, and no `frost-nova/` directory is present. Several nuke components also retain green matte. Plan around a component manifest plus alpha/trim QA; do not make combo readability depend on packs that are not yet present.

## 2. IMPROVEMENT RECOMMENDATIONS

Ranked by correctness first, then player-felt gain per unit of work.

### P0 — Establish one swing descriptor and one accepted epoch

Before adding more poses, define a shared, immutable descriptor for an accepted swing: weapon id, effective cooldown, style/family, combo step, frozen aim, start tick/time, visual duration, active interval/path, impact fraction, range, damage multiplier, and knockback. The server constructs the authoritative descriptor when `canAct` succeeds—not when a message arrives—and the client predicts the same descriptor from its local send. A small synced acceptance (`swingSeq`, `comboStep`, using existing `aimDir`) confirms or corrects prediction.

This is the prerequisite for honest WYSIWYG. It also fixes three existing inconsistencies at once:

- Apply `lootCooldownMult` to animation/VFX duration, as the client attack cadence and server cooldown already do (`ArenaScene.ts:3542-3547`; `GameRoom.ts:1879-1917`).
- Schedule quake from the accepted descriptor’s impact fraction, not two independently started timers.
- Let rig and VFX sample the same signed path and impact phase the server owns, even if rendering is briefly held for hit-stop.

Do not delete the 20 Hz super-sampling or hit-once set; those are the correct authoritative primitives. Generalize their input.

### P1 — Retune the existing envelopes before multiplying them

Keep normalized phase authoring, but give each style a clear anticipation / active / follow-through / recovery contract:

1. **Arc:** preserve the current 16/58/26 light-blade split. Scale anticipation toward 22% and torso twist from `0.07` toward `0.12–0.18 rad` for L/XL weapons; keep active travel fast and reserve roughly 28–32% for follow-through/recovery. Size should change weight without changing damage geometry.
2. **Chop:** keep the excellent 30% raise and 52% impact. Split the current post-impact region into a named 12–18% hit hold plus recovery. Add a one- or two-frame blade flex and a plant-foot squash at impact; the body envelope already supplies the needed stretch-to-squash base (`SpriteRig.ts:702-732`).
3. **Pivot/rake:** grow anticipation from 10% to 12–15% for readable claws, shorten the powered cross-body travel slightly, and explicitly assign a lead hand. Dual weapons should alternate hands on step 2 and use both on the finisher; single claws should reverse the same arm.
4. **Punch:** retain light/heavy chambers and the 52% default connect. Add a planted rear foot before the drive, a 2–4 frame fist deformation/foreshortening at contact, and shoulder overshoot after contact. Most importantly, allow hand-only style dispatch when no weapon sprite exists so fists actually punch.
5. **Thrust:** replace the current 14/24/62 shape with roughly 14–18% draw, 26–32% extension, 6–10% full-extension hold, and the remaining 40–50% pullout. The tip should recoil a few pixels on confirmed contact. Its server geometry must become a growing line/capsule rather than an angular fan.
6. **Orbit/spin:** preserve the fake-depth machinery. Give ordinary orbit a readable “danger interval” rather than letting the whole pre/post overtravel imply damage. For spin, use one shared angular phase function on client and server; either both ease the first revolution or both stay linear.

### P2 — Drive VFX by swing phase and confirmed impact

Extend `playSwing()` conceptually to accept `{ step, direction, phase/clock, impactFrac, attach }` rather than starting an unrelated 470 ms tween. Swing-trigger layers should follow the predicted blade path; hit/slam layers should fire from the authoritative hit/impact signal. Preserve immediate cosmetic responsiveness, but never predict damage, finisher multiplier, or knockback.

The existing HP-diff path is already an authoritative-enough hook for ordinary hit flash, sparks, sound, rings, and crit hit-stop (`packages/client/src/scenes/ArenaScene.ts:3964-4041`). Add a swing/step identity to prevent aggregate patch damage from being attributed to the wrong predicted attack. Quake’s 130 ms priority stop is already gated on a likely connection (`ArenaScene.ts:3588-3597`); move that decision to an accepted impact result when protocol support exists.

Use the painted packs as secondary motion, not as a replacement for silhouette:

- Crop/author a small dust crescent from the nuke dust components for chop/punch plant feet.
- Use smoke/debris fragments for heavy finisher follow-through; cap them aggressively so the 12-surface pool is not constantly pressure-stolen (`VfxPlayer.ts:151-155`, `:228-255`).
- Add style-native trail smears: broad curved smear for arc, narrow line for thrust, twin diagonal smears for rake, short glove ghost for punch. Incoming lightning/frost packs can skin those shapes after their directories contain validated assets.
- Require transparent alpha, consistent trim/pivot metadata, and a manifest. The current green-matte components should not ship raw.

### P3 — Author signature overrides instead of trusting the fallback forever

The resolver should remain the mass-content fallback; named weapons deserve deliberate `WeaponDef.swingStyle`/combo-family choices.

- **Gravedigger’s Spade:** author `chop`. Its fantasy is a deliberate dig, but `twoHanded` currently sends it to orbit (`packages/shared/src/weapons.ts:530-559`).
- **Drowned Anchor** and **Reaper’s Lid:** author `chop` unless playtest explicitly prefers the waist orbit. Both are tagged melee-slam yet have no quake, so the current resolver falls through to two-handed orbit (`weapons.ts:754-776`, `:801-823`).
- **Twin Bowie Fangs:** author `pivot` once alternating-hand rake exists. Their `fist-blade` family/name does not satisfy the current worn-claw test, so they default to arc (`weapons.ts:703-725`; `SpriteRig.ts:40-61`).
- **Driftblade:** compare authored `arc` versus `orbit` in the Testing Grounds. The absurdly long nodachi benefits from fake depth, but a directional two-cut combo may read more precisely than waist rotation (`weapons.ts:668-701`).
- **Dervish Greatblade:** keep explicit `spin`; it is the good example of a style override paired with matching damage geometry (`weapons.ts:636-655`).

Do not set `spin` merely because a weapon is circular or saw-like. The server special-cases literal `weapon.swingStyle === "spin"` and expects a full-circle authored `swingArc` (`GameRoom.ts:2171-2177`); a cosmetic override can therefore change gameplay duration today despite the interface comment calling styles cosmetic.

### P4 — Cheap weight pass

After clock correctness, the cheapest high-return additions are:

- **Plant-foot event:** pick the foot opposite the swing direction, reduce its stride, squash it 6–10%, and emit one small dust crescent. This prevents locomotion gait from skating underneath a committed attack.
- **Weapon deformation frames:** procedural scale/shear is enough—slight backward bend during acceleration, one-frame forward overshoot after impact, then settle. Cap tip displacement inside the authoritative half-width so cosmetics do not promise extra reach.
- **Contact recoil:** on a confirmed hit, offset the hand 3–6 px opposite travel for 30–50 ms while the body continues 1–2 frames. Whiffs keep the full follow-through. That one distinction adds more weight than another generic flash.
- **Impact squash:** chop/punch finishers get a short body `scaleY` squash; thrust gets longitudinal compression; arc gets torso twist overshoot. Compose with existing body transforms rather than overwriting gait/recoil.
- **Hit-stop tiers:** ordinary confirmed melee 25–35 ms, heavy/finisher 45–65 ms, crit adds only enough to reach its tier, quake/parry retain priority. Avoid stacking independent stops. Because the server keeps simulating, the authoritative swing phase must advance during a visual hold and resample on release; otherwise a local freeze reintroduces timing drift.

## 3. COMBO PROPOSAL — SEQUENTIAL MELEE COMBOS

### Design target

Repeated accepted melee attacks advance through a short authored sequence: a forehand naturally leaves the body ready for a backhand, which naturally leaves it ready for a finisher. Attack cadence, input buffering, hit-once semantics, and server authority remain intact. The first client-only stage changes **animation only**; the final stage gives each accepted step its matching server path and a modest authoritative finisher payoff.

Held RMB currently re-fires whenever the local cooldown drains (`ArenaScene.ts:3530-3547`). Version one preserves that behavior: holding cycles the combo automatically, while releasing long enough resets it. This is animation variety and a mild cadence reward, not a timing minigame. Requiring discrete button edges or “perfect” presses is explicitly deferred.

### A. Rig state model and chain window

Replace the single-use Boolean concept with explicit state while retaining `swingChained` as a derived convenience:

```ts
comboFamily       // arc | chop | rake | punch | thrust | none
comboStep         // accepted/predicted active step, zero-based
comboExpiresAtMs  // end of the grace window
comboWeaponId     // prevents a weapon swap inheriting a chain
swingStep         // immutable snapshot used by the current pose
swingDirection    // +1 forehand, -1 reverse
swingAcceptedSeq  // last server acceptance reconciled by this rig
comboHoldPose     // authored end pose held between legal attacks
```

On `triggerSwing`:

1. Resolve the combo family from shared weapon data.
2. Continue only if weapon id and family match, the previous **accepted/predicted start** is still inside the chain grace, and the prior step was not explicitly cancelled.
3. Advance `comboStep`; after the finisher, the next accepted attack returns to step 0.
4. Snapshot step/direction/aim into the active swing. Never read a mutable combo index while sampling an in-flight pose.
5. Hold the authored end pose through the remaining cooldown. If the next attack arrives, step 2 begins from that pose; if the grace expires, ease to rest over about 100–140 ms. This removes the current `0.64 × cooldown` animation followed by an unrelated rest gap.

The server defines continuity from accepted times:

- `readyAt = priorAcceptedAt + effectiveCooldown`.
- Existing `ATTACK_BUFFER_SECONDS = 0.15` continues to accept an early request, but the step advances only when it fires (`constants.ts:487-493`; `GameRoom.ts:1875-1917`).
- The chain remains live until `readyAt + grace`, where `grace = clamp(0.12, 0.30, 0.35 × effectiveCooldown)`. This tolerates one late frame/network patch without allowing a combo to survive a real pause.
- Reset on weapon/slot change, death/down, room/mode reset, or timeout. A parry or jump does not reset in version one; their time cost naturally risks the timeout.

The local rig predicts this state on send for responsiveness. A later authoritative acceptance may confirm it, correct the step for the next pose, or cancel an unaccepted prediction. Remote rigs should trigger from synced acceptance rather than infer attacks from cooldown.

### B. Authored family sequences

Fractions below are normalized over the step’s visual window. “Active” is the interval during which the server path advances in the final stage. “Impact” is the authored pose/VFX/hit-stop beat; a sweep can contact a particular target earlier or later as its blade crosses that target.

#### Arc — three steps

| Step | Motion and flow | Timing | Final server path |
|---|---|---|---|
| **1. Forehand cut** | Pull just past the right-side start, rotate hips through frozen aim, finish across the body with the blade low-left. Hold that crossed pose. | Anticipation `0.00–0.16`; active `0.16–0.66`; follow `0.66–0.80`; hold/recover `0.80–1.00`. | Signed sweep `+1.0 × swingArc`, approximately `aim − 0.55A → aim + 0.45A`. |
| **2. Reverse backhand** | From the crossed hold, lead with the pommel and unwind left-to-right. The rear foot becomes the plant; hands finish high on the starting side. | Re-chamber `0.00–0.10`; active `0.10–0.60`; follow `0.60–0.78`; hold `0.78–1.00`. | Signed sweep `−1.0 × swingArc`, `aim + 0.50A → aim − 0.50A`. This is the first real directional server change. |
| **3. Overhead diagonal finisher** | Lift from the high hold, compress the body, then cut down through aim with a longer torso follow-through. Blade flexes on contact and ends planted low. | Lift `0.00–0.28`; active `0.28–0.60`; impact center near `0.52`; planted follow `0.60–0.74`; recover `0.74–1.00`. | Broad signed sweep `+1.25A`, range `1.08×`, one hit per enemy. Damage `1.20×`; knockback `72 px`. |

#### Chop — three steps

| Step | Motion and flow | Timing | Final server path |
|---|---|---|---|
| **1. Shoulder chop** | Raise to the weapon-side shoulder rather than fully overhead, drive a diagonal cut into the aim line, and finish low. | Coil `0.00–0.24`; active fall `0.24–0.52`; impact `0.52`; buried hold `0.52–0.66`; recover to low guard `0.66–1.00`. | Narrow diagonal sweep `+0.75A`, centered slightly before aim. Default quake impact remains `0.52`. |
| **2. Reverse rising cut** | Use the low guard as a loaded position; legs and hands lift the weapon back across the target, finishing above the head ready for step 3. | Load `0.00–0.14`; active rise `0.14–0.50`; impact/apex `0.50`; carry overhead `0.50–0.70`; hold `0.70–1.00`. | Reverse sweep `−0.80A`; same base damage/range. A quake carrier uses this step’s `impactFrac = 0.50`. |
| **3. Execution slam** | Hang the weapon overhead for a readable beat, rise/stretch, then collapse the whole frame into the existing squash-and-buried pose. Wrench the blade free late. | Hang `0.00–0.32`; active drop `0.32–0.56`; impact `0.56`; buried hold `0.56–0.74`; recover `0.74–1.00`. | Impact ray/capsule along aim plus `1.15A` forgiving landing fan; range `1.05×`, damage `1.25×`, knockback `96 px`. Quake detonates from authoritative `impactFrac = 0.56`, not the legacy global default. |

#### Pivot / rake — three steps

| Step | Motion and flow | Timing | Final server path |
|---|---|---|---|
| **1. Lead-hand rake** | Current diagonal arm rake, with a slightly longer wind and named lead hand. Reach peaks while crossing aim; finish extended across the body. | Wind `0.00–0.13`; active `0.13–0.58`; follow `0.58–0.76`; hold `0.76–1.00`. | Asymmetric positive sweep `aim − 0.60A → aim + 0.40A`; base damage. |
| **2. Off-hand reverse rake** | Dual claws switch ownership to the rear hand; single claws reverse the same arm. Shoulder and torso unwind in the opposite direction. | Snap load `0.00–0.09`; active `0.09–0.54`; follow `0.54–0.74`; hold `0.74–1.00`. | Negative sweep `aim + 0.55A → aim − 0.45A`; base damage. |
| **3. Scissor drag** | Both hands open outside aim, cross through the target on staggered paths, then rip apart. The torso compresses at the crossing frame. | Open `0.00–0.18`; first path `0.18–0.52`; second path `0.24–0.58`; cross impact near `0.43`; tear-out `0.58–0.76`; recover `0.76–1.00`. | Union of two opposing `0.85A` sweeps sharing **one** hit set. Range `1.05×`, damage `1.18×`, knockback `64 px`; never double-hit because both paths consult the same enemy id set. |

#### Punch — three steps

| Step | Motion and flow | Timing | Final server path |
|---|---|---|---|
| **1. Lead jab** | Compact chamber, straight extension, brief fist compression, retract to an outside guard that loads the cross. | Chamber `0.00–0.10`; active extension `0.10–0.36`; impact `0.36`; hold `0.36–0.44`; recoil/guard `0.44–1.00`. | Growing fist capsule along aim, range `0.92×`; damage `0.95×`, no bonus knockback. |
| **2. Cross / body hook** | Rear shoulder and hip pass through the target on a curved hand path; finish wound on the opposite side. Heavy gauntlets use the wider current roundhouse. | Chamber `0.00–0.18`; active hook `0.18–0.48`; impact `0.48`; overshoot `0.48–0.68`; hold/recover `0.68–1.00`. | Positive curved sweep around aim, base range/damage. |
| **3. Haymaker / hammerfist** | Deep rear-foot plant, whole-body wind, glove leads through a wide roundhouse; two-handed maulers finish downward so quake gear still sells the ground hit. | Plant/chamber `0.00–0.28`; active `0.28–0.56`; impact `0.56`; compressed hold `0.56–0.72`; recoil `0.72–1.00`. | Wide sweep or impact capsule by weapon subtype; range `1.05×`, damage `1.25×`, knockback `88 px`. Quake gauntlets schedule their eruption at `0.56`. |

#### Thrust — three steps

| Step | Motion and flow | Timing | Final server path |
|---|---|---|---|
| **1. Outside-line lunge** | Draw the grip slightly outside, extend straight through aim, hold the tip for a puncture beat, then retract to the other guard. | Draw `0.00–0.14`; active extension `0.14–0.42`; impact/full reach `0.42`; hold `0.42–0.50`; retract `0.50–1.00`. | Growing capsule on aim; no angular fan. Base range/damage. |
| **2. Disengage thrust** | Small circular hand disengage around an imagined guard, then a lower-line stab. Torso tilt reverses so it does not look like step 1 replayed. | Disengage `0.00–0.18`; active extension `0.18–0.44`; impact `0.44`; hold `0.44–0.52`; retract/hold `0.52–1.00`. | Growing capsule on aim with a tiny authored lateral offset bounded inside blade half-width; base range/damage. |
| **3. Step-through impale** | Rear foot passes forward, both hands drive long weapons, body stretches farther, then the weapon sticks before a forceful pullout. | Coil `0.00–0.24`; active drive `0.24–0.58`; impact `0.58`; stick `0.58–0.70`; pullout `0.70–1.00`. | Growing capsule to `1.15×` range; damage `1.22×`, forward knockback `80 px`. Keep the line narrow—its payoff is reach and force, not cleave coverage. |

Orbit and spin deliberately do not enter this first combo matrix. Spin is already a continuous authored loop, and forcing it through a three-step reset would regress its best property. Ordinary orbit can later receive left/right/finisher variants using the arc profile, but only after its fake-depth path can consume signed authoritative angles without breaking depth swaps.

### C. Server authority and minimal data/protocol change

The server must decide the step. Do **not** trust a client-supplied “finisher” flag or multiplier.

Minimal shared/data change:

1. Add `WeaponDef.comboFamily?: "arc" | "chop" | "rake" | "punch" | "thrust" | "none"` and move the current style resolver into shared code so client and server use one classification. Omitted values derive from the resolved style; signature weapons can override.
2. Store immutable family profiles in shared code. Each step contains pose id, signed path(s), active interval, impact fraction, range/damage multipliers, and knockback. Weapon definitions select a family; they do not repeat the full table.
3. Add server-only `comboStep`, `comboExpiresAt`, and `comboWeaponId` to `CombatState`. Advance only inside the `canAct` branch immediately before `resolveSwing()` (`GameRoom.ts:1875-1917`). Buffered, duplicated, rate-limited, rejected, or stale messages never advance the chain.
4. Add `swingSeq` and `comboStep` to `PlayerState`; reuse existing synced `aimDir` (`packages/shared/src/state.ts:38-42`). This is enough for remote animation and local prediction confirmation. The existing attack payload can remain unchanged. If exact prediction pairing proves ambiguous under packet loss, add a monotonic client `attackSeq` later and echo `acceptedAttackSeq`; it is not required to authorize geometry.

`resolveSwing()` then resolves a shared step profile and registers explicit path data rather than only `{ aim0, swingArc, active }`:

```ts
{
  startAt, duration, activeStart, activeEnd, impactAt,
  paths: [{ kind, startAngle, deltaAngle, range0, range1 }],
  halfWidth, edgeDamage, knockback, hit
}
```

For signed sweeps, generalize `bladeAngleAt` to `startAngle + deltaAngle × p` and calculate super-sample count from `abs(deltaAngle)`; the current positive-only formula and step count assume one direction (`packages/shared/src/melee.ts:29-31`; `GameRoom.ts:2344-2353`). For thrust, super-sample radial growth rather than angle. For a scissor rake, advance both paths but share one `hit` set. On a confirmed finisher hit, multiply edge damage on the server and displace the surviving enemy along the authored blow direction, clamped and followed by `updateEnemyGrid`, matching the existing authoritative parry-knockback pattern (`GameRoom.ts:3158-3169`). Bosses should receive a reduced knockback multiplier or immunity from their definition.

Secondary layers must use the accepted step too. Chain-lightning’s seed wedge currently assumes a symmetric `swingArc` (`GameRoom.ts:2181-2221`); seed from enemies actually touched by the step path, or retain the old wedge until the edge connects and then launch from the first confirmed hit. Quake uses the step’s accepted `impactAt`. Scatter/revive remain once per accepted swing unless design explicitly changes them.

**Belt mode:** signed top-down angles cannot simply be copied into the lane branch. Add per-step belt geometry `{ frontReachMult, rearReach, depthMult }`. Forehand/backhand may share the same forward lane while overhead/thrust tune depth width; a visual path that crosses behind the body may earn a small `rearReach`, otherwise it must not damage behind. Preserve the current hit-once and depth-dodge rules (`GameRoom.ts:2313-2342`).

### D. Finisher payoff and balance contract

Finishers are server-owned and modest:

- Damage multiplier target: `1.18–1.25×` by family.
- Coverage payoff: either `1.05–1.15×` range **or** a wider arc, not both at maximum.
- Knockback: `64–96 px` direct enemy displacement, reduced on toughs and heavily reduced/disabled on bosses.
- VFX: one extra painted smear/debris burst, stronger contact recoil, and a 45–65 ms hit-stop tier only on confirmed contact.
- Hit count remains once per enemy per accepted attack, including two-path rake finishers and multi-revolution spin.

Because held RMB earns finishers automatically, the first pass should target a three-hit cycle average near `1.05–1.08×` base edge DPS, not a burst-combo economy. Secondary damage sources should **not** inherit the edge finisher multiplier by default: multiplying quake, chain, scatter, and edge together would make a visual-system feature rewrite weapon balance. Any secondary finisher interaction must be separately authored and server-tested.

### E. Staged implementation plan

1. **Stage 0 — Instrument the baseline.** Add a dev-only overlay/log showing predicted rig phase, server sweep phase, accepted sequence, impact time, and current step in the Testing Grounds. Capture arc, chop, thrust, fists, spin, one fast weapon, one slow weapon, and Swift/Brutal affixes.
2. **Stage 1 — Client visual only, identical damage.** Add rig combo state, five family pose sequences, end-pose holds, alternating rake hands, and bare-fist dispatch behind a feature flag. Keep the existing server `{ swingArc, damage, active }` untouched; finisher VFX is cosmetic and all multipliers are `1`. Scale pose duration by effective cooldown, but do not claim WYSIWYG yet.
3. **Stage 2 — Acceptance sync, still identical damage.** Add authoritative combo tracking plus `swingSeq/comboStep`. Trigger remote rigs from acceptance and reconcile local predictions. Continue using existing damage geometry and `1×` damage so protocol/chain correctness can be soak-tested separately from balance.
4. **Stage 3 — Server-synced paths.** Enable shared signed arcs/thrust capsules/impact paths family by family: arc first, then chop, rake, punch, thrust. Move quake and phase-driven VFX onto the accepted descriptor. Keep a server feature flag that can fall back to the legacy centered sweep without disabling visual combos.
5. **Stage 4 — Payoffs and polish.** Enable authoritative finisher damage/knockback after spatial tests pass. Add component-pack dust/debris, deformation, contact recoil, step-specific audio, and authored signature overrides. Tune belt profiles separately.

### F. Test strategy

**Shared pure tests**

- Step sequence `0 → 1 → 2 → 0`; timeout, death, weapon swap, family swap, and mode reset return to 0.
- An early buffered press does not advance until accepted; a stale/rejected/duplicate request never advances.
- Swift/Heavy/Brutal/Hollow effective cooldowns produce the same client/server chain expiry and phase.
- Positive and negative arcs have exact endpoints; sample count uses absolute delta; two-path finishers still expose one hit set.
- Thrust capsule reaches enemies on the aim line and rejects enemies inside the old angular fan but outside blade width.

**Server integration tests**

- Extend the existing swept-melee test (`GameRoom.test.ts:204-226`) with enemies placed only on step 1, only on reverse step 2, only on the finisher edge, and just outside all three paths.
- Pin accepted `comboStep` under held input, tap input, 150 ms early buffer, late-within-grace, late-after-grace, weapon swap, and action-message rate limiting.
- Assert exact finisher edge damage, no multiplier on quake/chain by default, one damage application for dual rake paths, and authoritative knockback/grid update.
- Replace the coarse quake timing assertion with before/at/after checks against the accepted step’s impact tick; retain the existing full-circle spin regression (`GameRoom.test.ts:851-884`).
- Run every geometry test in top-down and belt mode, including depth dodge and boss knockback reduction.

**Client/visual tests**

- Extract pose sampling into a pure function and assert continuity at every phase boundary, finite transforms, weapon/hand coincidence, and end-pose-to-next-start continuity.
- Golden captures at `t = 0`, anticipation end, aim crossing/impact, active end, and hold for every family, facing, 1H/2H/dual, and S/L weapon.
- Network simulation at 0/100/200 ms RTT, jitter, dropped attack message, and buffered acceptance: local prediction must not display two finishers or make a rejected finisher’s payoff VFX look confirmed.
- Hit-stop capture: rendering may hold, but on release the sampled authoritative/predicted phase must not resume from stale time.
- Stress more than 12 simultaneous suites to verify pool stealing does not teleport a prior swing’s particles (`VfxPlayer.ts:228-255`).

### G. Explicit non-goals and risks

**Non-goals for this proposal:** branching by movement direction, light/heavy input buttons, charge attacks, animation cancelling, stamina/poise, aerial combos, target lock, rollback/lag-compensated melee, per-limb enemy hurtboxes, motion-captured sprite frames, multi-hit-per-enemy rake/spin, and a timing-grade or “perfect input” system. Spin remains its own continuous style; orbit combos are deferred.

**Risks:**

- Client prediction can show the wrong step when a request is dropped, rate-limited, buffered longer than expected, or invalidated by a weapon swap. Confirmation must gate payoff VFX; correction should affect the next pose rather than replaying damage.
- Applying affix speed to pose/impact timing changes the feel of quake and heavy attacks. That is the correct long-term rule, but it needs balance capture before rollout.
- Longer server-active visual paths let moving enemies enter a slow swing later than today; shorter fast paths remove the current post-animation damage tail. Spatial area is controlled, but temporal opportunity changes.
- Local hit-stop freezes presentation while the authoritative server continues. Treat it as a held frame over an advancing phase, and never let a freeze extend the server damage window.
- Belt mode cannot express reverse angular coverage literally. It needs authored lane equivalents, not a silent fallback that claims WYSIWYG.
- Extra finisher debris and 900 ms particle tails can exhaust the 12-surface VFX pool during horde clears. Budget by semantic importance and degrade ordinary steps first.
- Weapon bend, smears, orbit overtravel, and painted components can visually exceed server reach. Keep deformation inside collision tolerance or update the shared profile deliberately.
- The current component-pack inventory is incomplete and partly unkeyed. Asset arrival must not block the state/protocol work, and green-matte art requires cleanup before use.
