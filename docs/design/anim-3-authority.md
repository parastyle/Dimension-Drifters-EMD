# Animation Transition Smoothing — Authority and Netcode Safety

## 1am summary

Do not smooth the combat clock and do not smooth the authoritative player root. Keep the weapon—and any parent/hand transform that moves its damaging silhouette—on the exact accepted `attackSeq` pose; smooth only body presentation channels that carry no hit geometry. The checked-in 80 ms stage bridge is **not safe as written**: it blends weapon images, and it computes its deadline from the generic swing windup rather than the server-selected combo step. A catalog measurement found the bridge still active when authority begins damage on **36 of 51 authoritative-envelope combo steps**; at the worst active-start frame, **74.1% of the prior pose remains**. Fixing visible snaps is worthwhile, but the first shipping gate must prove the rendered blade/capsule is within the V7 `1 px` envelope at every active sample, owner and remote, while root position and predictor traces remain bit-for-bit unchanged.

## Mandate and working law

This report evaluates animation-transition smoothing solely through authority, combat truth, and co-op synchronization. The non-negotiable law is: server-accepted `attackSeq` remains the only combo clock; smoothing is presentation-only and may never alter attack selection, combo progression, authored timing, hit windows, authoritative transforms, or reconciliation. Because V7 defines visual geometry as hit geometry, any presentation blend that leaves a damage-bearing weapon somewhere other than its authored active-frame pose is unsafe. The investigation will identify the exact transition seams, test proposed smoothing strategies against that law, specify permanent measurable gates, and plainly reject approaches capable of replaying today's prediction/correction vibration. No implementation is made here.

## Investigation log

- **Established before code inspection:** The owner-approved movesets, beats, timings, hit windows, and choreography are out of scope for change. The only acceptable target is discontinuity in presentation pose transitions.
- **Verified reporting rule:** `docs/sol-reports/README.md:1-8` requires the report to exist from the start, to be updated as work completes, and to append validation last. This file follows that regime.
- **Verified fresh regression evidence:** `docs/sol-reports/v8-regressions-repeats.md:42-43` says the reverted A1 implementation predicted recoil, retained pending impulses across older movement patches until attack-clock confirmation, and added recovery/resync presentation bounds. Commit `324a240` records the observed result: the client displaced for an impulse authority had not yet applied, reconciliation pulled it back, repeated rounds produced vibration, and queued impulses continued after release. The revert removes that prediction path from `prediction.ts`, `prediction.test.ts`, and `ArenaScene.ts`. This is direct evidence that a bounded or “presentation-only” client transform is still unsafe when it writes into a predictor state that reconciliation also owns.
- **Verified limitation of the earlier green proof:** The same report claimed a `72 px` rendered-owner lead bound and green isolated-stack measurements (`docs/sol-reports/v8-regressions-repeats.md:43,65`), but the owner immediately found the repeated vibration in ordinary play and commit `324a240` reverted it. A maximum-separation bound did not measure sign-flipping correction or post-input settling, so it could not certify perceptual stability.
- **Claims pending verification:** Exact combo, pose, hit-geometry, remote-player, interruption, and resync paths—and quantitative thresholds for their permanent gates—will be added only after direct inspection or measurement.

## Verified codebase facts

- **Measured at HEAD `324a240`:** `SpriteRig.ts` is 10,713 lines, `melee.ts` is 2,141, `pose-language.ts` is 2,381, and exactly 544 `SpriteRig.ts` lines match `lerp|blend|interpolate|ease|tween|smooth` case-insensitively. The issue is ownership at particular seams, not absent interpolation vocabulary.

### The clocks and authority path

- `GameRoom.stampAttackBeat()` increments authoritative `player.attackSeq`, stamps `attackTick`, and latches `attackHeld` only after resource admission (`packages/server/src/rooms/GameRoom.ts:7153-7158`; the admission then stamp order is at `GameRoom.ts:7349-7365`). This is the edge presentation must follow.
- The server resolves the prospective `(weapon, family, step)` from that next contiguous sequence and accepted server time (`GameRoom.ts:7161-7206`), records the accepted chain (`GameRoom.ts:7209-7224`), and builds the damage swing from the selected step where `weaponUsesAuthoritativeEnvelopeCombo()` applies (`GameRoom.ts:7310-7315`, `7432-7469`). Damage then advances from `sw.elapsed` through `swingEdgeProgress()` on server ticks and samples the shared blade angle/reach during the active interval (`GameRoom.ts:8758-8787`, `8881-8937`). Presentation cannot move any of those clocks.
- The client routes each authoritative edge once. For observers it reconstructs the swing from the wire weapon/affix and calls `triggerSwing()` on the mapped `attackTick` epoch; for the owner an already-predicted edge is consumed as confirmation (`packages/client/src/scenes/ArenaScene.ts:3413-3459`, `3630-3663`). The shared chain resolver advances only a contiguous uint32 sequence with the same weapon/family inside its expiry; duplicates keep the selected step, and gaps/reversal/swap/expiry restart at zero (`packages/shared/src/melee.ts:1949-1985`).
- The reported katana gate is direct live evidence, not an assumption: `docs/sol-reports/v7-katana-bespoke.md:102,137` records 14/14 weapons, 1,845 rendered attack frames, 62 authored steps, 140 accepted beats, and exact `rigAttackSeq - authority attackSeq = 0` throughout. Any smoothing proposal must reproduce zero, not merely stay “close.”

### The V7 geometry law

- The binding module states that every energetic, damage-bearing silhouette is shared by server and client, while decorative smoke/trails/anticipation may remain outside it; the standing rendered-versus-authority tolerance is `1 px` (`packages/shared/src/hit-envelope.ts:1-20`). `weaponUsesAuthoritativeEnvelopeCombo()` promotes explicit authoritative combos and every blade-extension weapon to that law (`hit-envelope.ts:108-117`).
- The server uses the selected step’s authored `activeStart`, `activeEnd`, `impact`, path arc, and range multiplier for those weapons (`packages/server/src/rooms/GameRoom.ts:7432-7461`). The collision sampler uses the same timed extension pose and reach (`GameRoom.ts:8881-8937`). Existing V7 tests prove the server consumes the visual combo start/end and can hit along the shared extension paths (`packages/server/src/rooms/GameRoom.v7-hit.test.ts:56-129`), but they do not run the late client presentation bridge.
- The rig’s canonical blade accessor reads the **final Phaser world transform** of the visible weapon (`packages/client/src/entities/SpriteRig.ts:3080-3117`), and local slash/VFX consumers retain that live accessor (`packages/client/src/scenes/ArenaScene.ts:10320-10362`). Therefore a late blend of the weapon is not harmless metadata: it changes the visible/canonical world affine that downstream presentation calls “the blade.”
- Recent history validates the one-affine rule. The muzzle audit measured a 14.68 px dual-copy selection miss and classified it as a transform-selection defect, not a point to retune (`docs/sol-reports/v7-muzzle-verify.md:47`). The blade-extension audit found a remote fallback independently re-resolving pose (`docs/sol-reports/v7-blade-extension-unify.md:15-21`); its retained before evidence measured 239.59–313.00 px axial and 167.87–204.57 px lateral error, while the final shared blade basis reduced both to floating-point noise in 1,651 local/remote frames (`v7-blade-extension-unify.md:83-92`). Smoothing must consume the canonical final affine, never create another solver.

### The existing stage bridge fails the law

- The bridge predates today’s katana work. `git blame` attributes its helpers, state, trigger, and final pass to `45e7bb20` (2026-07-20); `c072111` landed 2026-07-22. The katana commit did not invent the bridge.
- At a continued step change, `triggerSwing()` selects the step from the accepted chain, enriches the immutable presentation descriptor, starts `beginComboStageTransition()`, and only then replaces `swingStart/swing` (`packages/client/src/entities/SpriteRig.ts:4988-5059`, `5088-5091`). On the first `animate()` frame for step N+1, this is the exact discontinuity seam.
- `beginComboStageTransition()` snapshots every `this.parts` image **and every weapon image**; the late pass smoothsteps each captured local x/y/rotation/scale toward the new authored frame (`SpriteRig.ts:4036-4095`) after weapon art geometry is applied (`SpriteRig.ts:10538-10541`). At elapsed zero the weapon remains in step N’s pose even though `swingStart`, `swing`, combo step, and server damage clock are already step N+1.
- The duration is `min(80 ms, 0.8 × swing.activeStartSeconds)` (`SpriteRig.ts:248-249`, `705-712`). But `swingDescriptorWithComboStep()` copies choreography/timing/path fields without replacing the generic descriptor’s scalar `activeStartSeconds` (`packages/shared/src/melee.ts:1988-2015`), while the server does replace it with `comboStep.timing.activeStart × poseSeconds` (`GameRoom.ts:7433-7442`). The current unit test asserts the bridge ends before the **generic** `descriptor.activeStartSeconds` (`packages/client/src/entities/SpriteRig.combo-continuity.test.ts:102-136`), so it proves the wrong deadline.
- **Measured at HEAD `324a240` using the built shared catalog and the exact checked-in formulas:** among 51 steps whose weapons satisfy `weaponUsesAuthoritativeEnvelopeCombo`, the current bridge deadline exceeds the server-authored active start on **36**. Worst cases: Marrowpike step 1 bridges for 80 ms while authority activates at 26.624 ms (74.1% prior-pose weight remains at active start); Cinderbrand steps 0/1 likewise retain 74.1%; Hailwidow step 1 bridges for 57.899 ms while authority activates at 23.04 ms (65.1% prior pose remains). This is a deterministic catalog failure, not a hypothetical network edge.
- The bridge also omits `root.rotation` and attack-shadow channels. Today’s katana choreography writes both (`SpriteRig.ts:8661-8715`), so the first N+1 frame can reset the parent rotation/shadow while child locals are restored to N. This corroborates the architecture/craft arms’ exact seam diagnosis. It is presentation discontinuity, but naively adding root rotation to the blend would also rotate the weapon’s world-space damage silhouette and is therefore not authority-safe.

### Remote timing and reconciliation

- Remote positions already render on a tick-stamped snapshot timeline delayed by `INTERP_DELAY_MS`; tick time, rather than patch arrival time, prevents a burst of patches collapsing motion into a teleport (`packages/client/src/net/snapshots.ts:3-12`, `72-76`). `ArenaScene.interpolate()` samples remote position at that timeline while the owner renders prediction (`packages/client/src/scenes/ArenaScene.ts:8996-9033`).
- `attackClientEpoch()` deliberately keeps that interpolation delay for remotes so their attack meets their interpolated body at the same rendered tick; the local fallback removes it (`ArenaScene.ts:3403-3410`). An additional remote animation buffer/cross-fade delay would double-pay latency and is unsafe.
- Owner reconciliation rebases to synced x/y/velocity, replays unacknowledged commands, and folds the visible residual into `errX/errY`; explicit teleports snap, while ordinary residual decays (`packages/client/src/net/prediction.ts:1162-1251`, `1254-1302`, `1316-1360`). The scene is the sole root-position presenter (`ArenaScene.ts:8996-9025`). Animation smoothing must remain below that root and must never call predictor impulse, error-fold, render constraint, or root-position APIs.
- The fresh vibration failure demonstrates why a distance cap is insufficient: prediction and reconciliation can alternate direction while staying inside a maximum radius. The permanent gate must measure correction direction/settling and, for animation smoothing specifically, prove the complete owner root trace is unchanged with smoothing enabled.

### A pre-existing law gap that smoothing must not hide

- The rig itself marks signed reverse/dual/overhead combo poses as a “KNOWN STAGE-1 RESIDUAL”: presentation selects them while server damage retains a centered positive single sweep (`SpriteRig.ts:8657-8661`). The V7-HIT report likewise records that only selected catalog weapons had authoritative combo timing/path and leaves the remaining presentation-only melee sweep as follow-up (`docs/sol-reports/v7-hit-system.md:41-47`).
- **Measured at HEAD:** of the 14 katana IDs in today’s bespoke gate, only `x2-hailwidow-katana` currently has `authoritativeCombo`/`weaponUsesAuthoritativeEnvelopeCombo`; the other 13 do not. This is not a defect introduced by `c072111`, and changing their damage is out of this panel’s scope, but it means a new smoothing gate must compare actual visual geometry to authority rather than assuming the current weapon pose is already truth. The muzzle history forbids tuning a blend against a broken baseline.
- Consequence: a global V7 active-geometry gate may correctly be red before smoothing work starts. Do not weaken it, replace it with “no worse than baseline,” or claim broad weapon-carrier smoothing is safe. Body-only work can be developed incrementally, but no implementation should touch weapon/root/hand carrier channels until the affected weapon’s existing active geometry closes against authority.

## Recommendation: two render lanes, one combat clock

Use the existing accepted step selection and continuously sampled authored pose, but classify its outputs before applying any transition residual:

| Lane | Channels | Transition rule |
|---|---|---|
| **Combat-truth lane** | `attackSeq`, accepted epoch, descriptor time, root world x/y, visible weapon world affine, blade extension, weapon scale/foreshortening, and every parent/attacking-hand transform that changes the weapon silhouette | Publish the authored pose for the current accepted epoch directly. No cross-fade, spring, tween, inertial residual, or arrival delay. |
| **Presentation-only lane** | Torso/head/feet, non-damaging gear/cloth, and shadow/secondary body language that cannot move a damage silhouette | At a valid accepted step boundary, latch the previous rendered local pose once and decay that residual toward the newly sampled authored pose. Never restart it; finish by the selected step’s **authoritative** active start, preferably earlier. |

This is the “keep the weapon on the authored clock while blending the body” option. It is safer than blending all parts and merely bounding time because the current catalog proves deadline calculations can disagree, and it is safer than blending position but not pose because weapon/hand position is itself hit geometry. A bound remains useful for the body, but the correctness condition is actual zero residual on every active sample—not the nominal duration value.

### Exact frame behavior

Let frame F be the last rendered frame of accepted step N. When `routePlayerAttacks()` supplies accepted sequence K+1, `SpriteRig.triggerSwing()` selects N+1 and replaces `swingStart/swing` at `SpriteRig.ts:5088-5091`. On the first unfrozen `animate()` frame F+1:

1. Sample N+1 at `sceneNow - acceptedEpoch`, not at time since packet receipt and not at time since blend creation.
2. Commit the combat-truth lane exactly to that sample. If F+1 is already at or beyond `activeStart`, there is no catch-up animation; late truth wins immediately.
3. For eligible body-only channels, render `authored(N+1, t) + residual(F) × decay(t)`. The residual is latched once from F, keyed to `(source rig, hand, weapon, attackSeq, combo generation)`, and is zero no later than the server-selected `comboTiming.activeStart × poseSeconds`.
4. On every subsequent frame, resample the moving N+1 target on the same immutable accepted epoch. Do not interpolate between two frozen poses while the target clock advances invisibly underneath.

The current root-rotation snap needs special treatment. `root.rotation` carries the weapon, so simply adding it to `ComboStageTransitionState` is unsafe. The incremental safe choice is to leave the combat root exact and smooth only body-card channels below it. A later body-only visual pivot may carry torso/head/feet rotation, but weapons and their grip parents must remain outside that pivot. Do not introduce counter-rotation or a second weapon solver to make a blended parent “look right”; recent muzzle and blade-extension evidence shows that architecture fails under motion.

### Option verdicts

- **Blend only parts with no hit geometry:** safe and recommended, subject to the gates below. This is the best first increment.
- **Keep weapon authored, blend body:** same recommended design, with attacking hands/grip parents treated as part of the weapon lane.
- **Finish all blending before `activeStart`:** necessary for any parent/body channel that could influence perceived contact, but not sufficient by itself. It must use the selected server timing and prove zero live residual; the current implementation uses the wrong scalar and fails 36/51 steps.
- **Blend position but not active-frame pose:** unsafe for weapons/hands because their position defines tip reach and contact. Acceptable only for proven non-hit body nodes.
- **Blend active frames and delay the hit window to match:** forbidden. It changes owner-approved combat and server cadence to accommodate presentation.

## Remote players and co-op

Remote rigs already pay the deliberate snapshot interpolation delay. Their accepted attack epoch is mapped onto that same delayed server timeline (`ArenaScene.ts:3403-3410`), so smoothing must use the mapped epoch and cannot start a fresh duration when the patch arrives. If a patch arrives after the body blend’s deadline, skip the blend. The weapon’s first authored motion must appear on the first rendered frame whose remote timeline reaches `attackTick`; its active silhouette must be exact on the first frame whose timeline reaches active start. This preserves apparent attack latency while still allowing body-only continuity when enough anticipation remains.

For packet gaps, sequence jumps restart the combo opener by the existing shared chain law; they must not synthesize intermediate transitions. For a newly observed player already inside `attackHeld`, the catch-up path at `ArenaScene.ts:3428-3438` samples the current accepted epoch and likewise must not replay the attack from zero.

## Prediction, reconciliation, and resync

The structural guarantee against today’s vibration is ownership separation:

- `ArenaScene.interpolate()`/`SelfPredictor` remain the only writers of the owner root x/y. Transition code receives no predictor reference and never calls `addPredictedImpulse`, `foldError`, `constrainRenderStep`, or `setPosition` on the rig root.
- A normal reconciliation patch may move the root while the child-local body residual continues; because the residual is local and has no feedback into predictor state, it cannot pull the root back or create a correction loop.
- A `teleportSeq` edge, death/down, weapon/loadout swap, scene reset, or authoritative action cancellation invalidates the residual in the same frame. It must never carry an old local pose across an identity/lifetime boundary.
- A >250 ms frame-gap resync does not restart a body blend. Its elapsed time is derived from the accepted epoch; normally it will be expired on the first resumed frame. Explicit teleports remain deliberate cuts.
- Reconciliation must never use a visual child’s world position as a new simulation/prediction input. That feedback loop is the animation equivalent of the reverted recoil defect.

“Never vibrates” is not established by a maximum-distance cap. It is established by making animation unable to write the root and by an A/B adversarial gate that proves the entire owner root trace is identical with smoothing enabled or disabled.

## Hard invariants and permanent gates

Each item is phrased as a testable law; all thresholds are pass/fail, not tuning suggestions.

1. **Accepted-clock identity is exact.** In a private-stack live run, capture wire `attackSeq`, rig `attackBeatSeq`, selected weapon/family/step, and accepted epoch on every rendered attack frame for local and remote players. Gate: `rigAttackSeq - authorityAttackSeq === 0` and rig/server `(weapon,family,step)` agree on every sample. Reuse the 14-katana/1,845-frame coverage floor and include uint32 wrap, timeout restart, swap, and dual wield.

2. **Smoothing cannot retime combat.** Unit/catalog replay every combo with smoothing off/on. Measure `effectiveCooldown`, `poseSeconds`, authoritative `activeStart`, `activeEnd`, `impact`, `followEnd`, path, range, damage, knockback, server hit tick, and hit count. Gate: exact equality for all scalar/enum data and identical server receipts/hits.

3. **The active visual envelope equals authority.** On every active rendered sample, reconstruct the server’s shared damaging segment/capsule at the same accepted elapsed time and compare it with the final visible weapon/blade-extension affine after all render writers. Gate: maximum endpoint/edge distance `≤ HIT_ENVELOPE_TOLERANCE_PX` (`1 px`) for owner and real second-client observer, both facings and multiple aim angles. No baseline-relative exception.

4. **No transition residual survives into danger.** For every catalog step, log the final per-channel residual and blend weight at the first rendered sample at/after the server-selected active start, at impact, and through active end. Gate for every combat-truth carrier and any blended parent: residual translation `0 px`, angular residual `0 rad`, scale residual `0`, blend weight exactly `1`. Separately assert computed deadline `≤ comboTiming.activeStart × poseSeconds`; this would fail the current 36/51 overlap.

5. **Weapon motion has no extra remote latency.** With a real second Colyseus client under normal cadence plus injected jitter/batched patches, measure the mapped accepted epoch and first authored weapon-motion frame. Gate: onset occurs on the first eligible rendered frame, no more than one rendered frame and `≤70 ms` after the mapped epoch; active-envelope gate #3 must pass on the first eligible active frame. Do not subtract `INTERP_DELAY_MS`—it is already included in the mapped epoch.

6. **Animation cannot move the owner root.** Run identical recorded input/patch streams with transition smoothing off/on, including WASD reversals, firing/release, collision correction, hit-stop unfreeze, a >250 ms frame gap, and a teleport. Capture predictor candidate and rig root x/y each frame. Gate: smoothing-on minus smoothing-off root x/y is exactly `0 px` for every frame; predictor pending depth and `errPx` traces are also identical.

7. **No vibration or correction fight is introduced.** In the same A/B trace, measure per-frame root displacement direction, sign reversals, total variation, and time to settle after input/fire release. Gate: smoothing adds zero direction reversals, zero path-length/total-variation increase, zero settling-time increase, and zero post-release displacement. This closes the hole left by the reverted 72/80 px maximum-separation test.

8. **A blend starts once and never chases patches.** Instrument transition identity, `startedAt`, and restart count. Gate: exactly one start for each contiguous accepted step change, zero starts for duplicate patches/render frames, immutable `startedAt`, and no synthesized transitions for sequence gaps. The body residual’s norm must reach zero by its deadline and never increase thereafter.

9. **Invalidation is same-frame and complete.** Exercise combo expiry/drop, weapon swap/draw/stow, death/down/revive, teleport, scene reset, tumble/long-jump/crouch interruption, and dual-hand replacement. Gate: stale transition identity is absent by the final render pass of the invalidating frame; no captured node from the old weapon/loadout is written afterward.

10. **Dual wield is per-hand honest.** Capture both final weapon affines, active hand/pair step, and the server event actually dealing damage. Gate: each damage-bearing hand satisfies gate #3; a presentation-only “both” flourish must not manufacture a second damaging-looking carrier or delay the server hand. Transition state is keyed per hand and cannot advance one hand from the other’s duplicate/late patch.

11. **Continuity is measured only on eligible body nodes.** Freeze root translation and compare the final screen-space transform immediately before/after an accepted stage edge. Gate: selected non-hit body nodes have zero boundary value discontinuity at elapsed zero, while excluded combat carriers match their authored N+1 pose. Also measure velocity discontinuity so a zero-slope smoothstep cannot be declared visually solved solely because position is C0.

The live geometry and remote gates should use the repository’s private `runArenaSpec`/`startSpecStack` idiom and a real second client. Unit-only synthetic transforms, like the current combo-continuity test, are insufficient because they omit final parent/root/world transforms and the authority timeline.

## Approaches that are simply unsafe here

- Blanket cross-fading `this.parts` plus `this.weapons`—the checked-in bridge does this today.
- Extending the 80 ms duration, adding a spring to the final weapon transform, or letting a residual survive through active frames.
- Capturing/blending `root.x/y`, feeding rendered displacement into prediction, or predicting smoothing-related recoil/lunge/impulses.
- Adding `root.rotation` to the current bridge without separating the weapon carrier; it rotates hit geometry.
- A second pose solver, aim reconstruction, inverse/counter-transform, or per-weapon compensation offset. The muzzle and blade-extension regressions are direct warnings against this class.
- Starting remote blends at receipt time or adding another interpolation buffer.
- Restarting a tween/blend on every frame or network patch; this creates asymptotic lag and can prevent completion.
- Phaser tweens that outlive attack identity and compete with `animate()`’s final writer.
- Retiming server damage, cooldown, combo expiry, or `attackSeq` so collision “waits” for a cosmetic blend.
- Calling a position-only weapon blend safe: moving the blade tip without rotating it still moves the hit silhouette.
- Certifying stability with only maximum authority/render separation. Vibration is an oscillation/settling property, not a radius.

## Cost and implementation risk

The safe first increment is small and does not require a rewrite: narrow the transition capture/application in `SpriteRig.ts:4036-4095`, use the selected combo timing at the trigger seam `5088`, and add final-render classification/instrumentation around `10541`. Expect roughly three localized rig regions plus tests/live gate, on the order of 100–200 rig lines rather than broad edits across 10,713 lines. No server timing or shared moveset data should change.

The main engineering cost is not line count; it is proving channel ownership. Hands, parent rotation, weapon scale, extensions, and dual-wield transforms are geometry carriers even though they live in presentation code. A body-only visual pivot for smoothing the new katana `paperRotation` seam is a second, incremental phase and needs live grip/geometry proof before adoption.

Risk is **high** for any blanket fix because the current bridge already overlaps authority and the remaining presentation-only melee debt is known. Risk is **low-to-moderate** for torso/head/feet/shadow-only residuals behind the gates above. Remote support adds test cost, not a different algorithm: it uses the same accepted epoch on the delayed timeline.

## What I would not change

I would not change combo bars, choreography primitives/intensities, rest stances, cooldowns, hit windows, damage, range, knockback, pair order, `attackSeq/attackTick`, server chain selection, snapshot interpolation delay, predictor reconciliation, or the final canonical blade accessor. `c072111`’s movesets remain intact. The katana commit is **not** the origin of the stage bridge; it exposed/worsened a longstanding seam by adding large parent-rotation/shadow/body trajectories and by making the correct per-weapon selection visible. The right response is to make the transition respect those authored poses and authority, not to flatten the choreography.

## Shipping verdict

My angle is the prerequisite worth shipping first: make the existing transition incapable of touching hit carriers, add the selected-active-clock catalog gate, and prove root/predictor A/B identity before expanding smoothing. That alone will not remove every visible snap—the root-rotation/body-pivot issue needs the architecture/craft follow-up—but it prevents the panel from shipping another visually pleasant authority regression. After that guardrail, body-only seam smoothing can land incrementally by combo-step, attack/idle return, chain drop, swap, dual wield, and movement interruption without rewriting the rig.

## Authority review of the other panel proposals

This is a review against the laws above, not a claim that the other arms have finished implementation designs.

- **Measurement arm — pass as evidence plumbing, incomplete as an authority gate.** Its proposed hook copies transforms only after `rig.animate()` and includes root, body, shadow, weapons, hands, and feet (`docs/design/anim-1-measure.md:17-24`). That is the correct point for detecting the visible discontinuity. To close a safety claim, the same sample must also carry the wire/server `attackSeq`, accepted `attackTick`/mapped epoch, selected combo timing/path, canonical blade endpoints, and owner predictor/root A/B trace. A transform jump detector alone cannot say whether a smooth-looking frame is late against damage. At the time of this review, that arm explicitly has not yet claimed a teleport result (`anim-1-measure.md:25`).

- **Architecture arm — conditional pass for separating target construction from rendered output; fail for blanket coverage expansion.** It correctly keeps root world x/y outside a pose smoother (`docs/design/anim-2-architecture.md:33-42`) and says remote presentation must stay on the reconstructed accepted epoch rather than delaying the clock (`anim-2-architecture.md:58`). Its central target/output split is compatible with the two-lane recommendation only if the output filter excludes the final weapon affine, blade extension, every grip/carrier parent, and root translation. However, its statement that the checked-in bridge is bounded to authored anticipation and therefore leaves hit timing untouched (`anim-2-architecture.md:21`) is disproved by the catalog measurement here: the helper reads the generic descriptor scalar, and 36/51 authoritative-envelope steps retain old weapon pose after the server-selected active start. Extending that bridge to missing root/shadow channels as one blanket fix fails; root rotation carries the weapon in world space. A body-only pivot outside the weapon parent remains viable.

- **Craft arm — conditional pass for authored carry/settle, after the authority guard; fail for any active weapon residual.** Its protected-clock premise and rejection of longer generic blends are correct (`docs/design/anim-4-craft.md:45-49`, `130-137`), and it explicitly places its work after the ownership/authority fix (`anim-4-craft.md:151-155`). Authored `carry` can ship only as presentation connective tissue after the old active window and before the next active window, without changing the approved primitive, timing, or final damaging affine. The phrase “prior blade arc ... bend[s] into the next anticipation” (`anim-4-craft.md:113`) is safe only while the next step is still pre-active and gate #3 remains within 1 px; at active start the weapon must be the exact authored sample. A later inertial residual is acceptable for torso/head/feet and other proven non-hit channels, including remote rigs when enough mapped anticipation remains. It is unsafe on weapons, attacking hands/carriers, root translation, or any active-frame pose. Motion matching remains rejected because it would choose a presentation pose independently of the accepted combo step.

The integrated panel answer is therefore ordered: first instrument the final rendered affine together with authority truth; then enforce the combat/presentation channel boundary and selected-clock deadline; then fix target/output ownership for eligible body channels; only then author carry/settle quality. Reversing that order risks tuning attractive links against the same wrong pose/clock class that caused the muzzle, blade-extension, and recoil regressions.

## Validation

- **Read-only catalog measurement:** imported the already-built shared catalog at HEAD and enumerated every selected combo step whose weapon satisfies `weaponUsesAuthoritativeEnvelopeCombo()`. For each of 51 steps, compared the checked-in bridge duration `min(80 ms, 0.8 × generic activeStartSeconds)` with the server-selected `comboStep.timing.activeStart × poseSeconds`, then evaluated the checked-in smoothstep weight at that active start. Result: 36/51 overlap; the measured worst retained old-pose weight is 74.1%. No thresholds were adjusted.
- **Focused existing tests:** `pnpm exec vitest run packages/client/src/entities/SpriteRig.combo-continuity.test.ts packages/server/src/rooms/GameRoom.v7-hit.test.ts` passed 2/2 files and 20/20 tests (17 combo-continuity, 3 V7 hit). This green baseline does **not** refute the catalog failure: the continuity test checks the generic descriptor deadline and synthetic local transforms, while the server test does not execute the final client bridge/root/world affine. That precise coverage hole is why gates #3 and #4 are required.
- **Live evidence boundary:** no implementation exists to validate before/after, so this arm makes no new live smoothing claim. The cited 1,845-frame katana sequence proof, 1,651-frame blade-affine proof, and same-day owner vibration/revert are the applicable retained live evidence. A shipping implementation must close the private-stack owner/second-client gates specified above; unit tests alone are not acceptance.
- **Workspace discipline:** this arm wrote only `docs/design/anim-3-authority.md`. Sibling panel reports/evidence already present in `docs/design/` were read and preserved. The owner’s stack on ports 5180/2567 was never stopped, rebound, or used, and no private stack was needed for this diagnosis.
