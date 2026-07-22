# V7 katana bespoke movesets — durable report

## Work-order understanding and planned approach

Started 2026-07-22 on `feat/v0.118-metagame` as Sol `v7-katana-bespoke`.

The owner does not want another katana VFX pass. The acceptance boundary is body choreography: all 14 active katana-family weapons must be distinguishable with slash VFX disabled, using visibly different combinations of weapon/hand paths, torso and paper-card motion, foot placement, level changes, and rhythm. The requested vocabulary explicitly includes side slashes, wave-shaped paths, backflips, knees-bent stabs, and lunges, and the creative direction is to make every weapon feel deliberately bespoke. Existing at-rest stances are liked and must remain byte-identical; the named/size rest tables and `pose-language.ts` are read-only.

The 14 active weapons are Neon Katana; the eight active Drift-line blades other than archived Kagewake and Hushglass; Hailwidow; Gravechill; Voltfang; Cinderfang; and Stormpetal. The archived pair keeps its durable definitions and receives no new unreachable choreography. Hailwidow also receives the separate ordered `1.5x` weapon-size change through source data and codegen.

The shipped V7.1 blade-extension contract is an input, not a seam to fork: presentation will consume the hand-indexed `leadWeaponTipPose` blade basis, measured blade width, and combo identity. No parallel blade transform, VFX transform, muzzle affine, or hit-envelope implementation will be introduced.

Planned implementation:

1. Read every predecessor report relevant to transferred shared leases, with special attention to V7.1 blade-extension unification, then inventory the current 14 IDs, combo authority/presentation seams, generated source path, and repository ephemeral-stack/live-evidence idioms.
2. Record a pre-edit snapshot of every rest-pose definition and baseline combo/DPS data. Treat the snapshot as an immutable comparison target and add automated byte-level/rest-transform laws.
3. Design 14 recognizable combo bars from a small reusable choreography vocabulary (side cuts, wave paths, low/knees-bent stabs, lunges, reversals, spins, leaps/card flips, and distinct recovery rhythms). Avoid 14 presentation-only weapon-ID branches: weapon data selects reusable primitives and timing, while the accepted authoritative combo clock selects the active beat.
4. Keep damaging beats server-authoritative. If a choreography needs real root travel, express it through the existing server-owned combo/performance movement seam; paper backflips may rotate visually without inventing client-only displacement. Preserve nominal aggregate DPS; if any beat count changes, redistribute per-hit damage and document the exact before/after total and cadence.
5. Apply Hailwidow's exact `1.5x` source size and regenerate derived catalog output with the canonical generator.
6. Add focused catalog, server, continuity, rest-identity, DPS-neutrality, and all-pairs motion-fingerprint tests. Add a permanent Playwright gate that cycles all 14 active IDs, drives enough accepted attacks to cover every combo bar, records normalized timing plus body/hand/weapon/foot/root trajectories, and fails on any duplicate pair.
7. Use only the repository's `runArenaSpec` / `startSpecStack` private-stack idiom. Never stop, replace, bind, or kill the owner's listeners on ports 5180 and 2567. Retain headline frame sequences and machine-readable traces under `docs/owner-notes-audit-v7-evidence/katana-movesets/`.
8. Run the mandated validation order: `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, focused tests, and typecheck because the catalog is in scope. Append validation only after implementation/evidence sections are complete.

Exclusive writes are limited to the paths assigned under Sol 5: this report; `docs/owner-notes-audit-v7-evidence/katana-movesets/**`; the catalog source/generator/generated expansion; shared melee/weapon definitions; `GameRoom` plus its new katana test; `SpriteRig` plus combo-continuity test; the katana unit tests; and the new Playwright gate. All other files are read-only unless the conductor explicitly transfers a lease.

Assumptions recorded before implementation:

- “Byte-identical rest stances” means existing rest-source rows/tables and their resolved idle transforms must not be modified as part of choreography. Attack-only data and attack-only resolution may be added without changing the idle serialization or idle output.
- “Exactly 1.5x” for Hailwidow means multiplying the pre-order weapon size by 1.5 in authoritative catalog source, not stacking repeated runtime scale multipliers.
- Visual distinctness requires a measured all-pairs trajectory-and-timing comparison from live-rendered attacks, not merely distinct recipe names or data rows.
- Existing generated slash textures and Weaponsmith assignments remain untouched.

## Progress log

- Created this report before inspecting code or predecessor implementation, after reading only the three mandated work-order/reporting/owner-audit documents.

Current state: planning recorded; predecessor-report review and baseline inventory remain.

### Lease-transfer review

- Read the completed HANDS, BEAM, generated-identity-art, MOVE, and V7.1 blade-extension reports before opening shared runtime code.
- HANDS established accepted-`attackSeq` presentation cycles layered after the canonical primary grip and final secondary-hand constraint; katana work must not disturb its gun mechanism state or the shared muzzle affine.
- MOVE restored a server/predictor-owned fixed roll and immediate long jump, and added whole-card roll presentation in `SpriteRig`; katana attack poses must remain attack-scoped and must not overwrite traversal presentation.
- V7.1 widened `leadWeaponTipPose(hand)` into the sole blade attachment source. It now supplies the final held-image basis, alpha-measured join width, hand/source identity, and stable combo generation/start/expiry. Katana choreography will preserve and consume that final held-image geometry rather than reconstructing a blade pose for extensions.
- The beam and generated-art Sols do not transfer a katana implementation seam. Their reports reinforce that metadata-only visual claims are insufficient and that existing generated katana slash art is not part of this order.
- Pre-existing unrelated worktree modifications were present in `e2e/tests/v7-perf-coop-frame.spec.ts` and `tools/janitor/run-janitor.mjs`. They are outside this Sol's lease and will be preserved untouched.

Current state: predecessor handoff complete; baseline inventory and pre-edit snapshots are next.

### Baseline inventory and choreography design

- Confirmed the active census is exactly 14: `x-sword-neon-katana`, `x2-hailwidow-katana`, `x2-gravechill-nodachi`, `x2-voltfang-tachi`, `x2-cinderfang-wakizashi-pair`, `x2-stormpetal-odachi`, and the eight active Drift IDs `drift-katana-stillwater-edict`, `drift-katana-stormthread`, `drift-katana-riftstep`, `drift-nodachi-pale-horizon`, `drift-nodachi-gatebreaker`, `drift-greatkatana-moonwake`, `drift-greatkatana-tempest-regent`, and `drift-colossal-world-seam`. Archived Kagewake/Hushglass are excluded.
- Existing data already supplies many distinct names, rhythms, ribbon recipes, and katana mechanical hooks, but `SpriteRig` funnels most of their motion values into a few shared greatsword/Cold Court/Petalfall/generic chop branches. Distinct data therefore collapses into similar body motion, matching the owner's complaint.
- The server already selects and records each solo melee step from authoritative `attackSeq`, accepted tick time, weapon ID, family, cadence window, and prior accepted step. The client mirrors the same `comboStepForChain` law and snapshots the selected step into the immutable swing descriptor. This is the clock to consume; no new animation timer is needed.
- Choreography will be an optional presentation-only field on `MeleeComboStep`, preserved by codegen. Existing `timing`, `path`, ribbon, katana hooks, damage, cooldown, and beat counts remain unchanged. A pure reusable sampler will expose normalized weapon/body/foot/paper channels for `SpriteRig`; the renderer dispatches on the primitive, never on weapon ID.

Planned primitive bars (directions, authored timing, and per-beat intensity further distinguish them):

| Weapon | Recognizable motion sentence |
|---|---|
| Voltedge / Neon Katana | side cut → wave cut → backflip → lunge |
| Hailwidow Katana | staccato side cut → knees-bent stab → rising cut |
| Gravechill Nodachi | guard pivot → deep knees-bent stab → heavy side execution |
| Voltfang Tachi | rising cut → wave cut → backflip thunder fall |
| Cinderfang Wakizashi Pair | alternating side cut → off-hand wave → paired spin cut |
| Stormpetal Odachi | wave cut → weightless guard pivot → petal backflip |
| Stillwater Edict | guard pivot → side cut → measured pivot → knees-bent stab → rising cut → lunge |
| Stormthread Tachi | wave → side → reverse wave → pivot → low stab → rise → spin |
| Riftstep Katana | knees-bent stab → fold pivot → backflip → authoritative finisher lunge |
| Pale Horizon Nodachi | long side cut → wave → reverse side cut → rising horizon → lunge |
| Gatebreaker Odachi | low stab → side cut → guard break → reverse side → spin → rise → lunge |
| Moonwake Great Katana | wave → side cut → backflip → rise → moon spin → lunge |
| Tempest Regent | side cut → wave → royal pivot → backflip → storm spin |
| World-Seam Odachi | colossal knees-bent measure → rising measure → still pivot → world-splitting side cut |

- The eight reusable primitives are `side-cut`, `wave-cut`, `knee-stab`, `lunge`, `backflip`, `rising-cut`, `spin-cut`, and `guard-pivot`. They will author materially different weapon paths, torso level/rotation, foot plants, hand ownership, paper lift/rotation, and shadows. Backflip rotates the rendered paper card around its unchanged root; it does not invent world displacement.
- Hailwidow baseline `displayLength` is 128 px. The source-data order will set it to exactly 192 px (`128 × 1.5`). Damage 7 and cooldown 0.3 s remain unchanged. Under the standing WYSIWYG hit law, `meleeReach` will legitimately rise from 140 px to the larger visible-tip floor; that reach change is the direct consequence of the ordered size increase, not choreography.
- No rest stance selector, named stance data, grip point, size class, pose-language registry, slash texture, or Weaponsmith assignment will change. Hailwidow's blade scale is the sole intentional idle-appearance delta; its stance angles/hand placement remain the existing `tachi-no-tori` transform.

Current state: design fixed before implementation; the baseline-capable permanent live gate will be authored and run against the unmodified motion before product edits.

### Permanent gate authored and baseline capture

- Added `e2e/tests/v7-katana-movesets-live-gate.spec.ts` before product edits. It uses `runArenaSpec`, disables `ArenaScene.spawnSlash` during measurement, cycles exactly the 14 active IDs, records two complete bars of natural frames per weapon, retains a screenshot per weapon, and stores weapon/hand/body/foot/render-root/authority-root trajectories plus combo timing.
- The gate normalizes positions by rendered body width, resamples complete bars into a fixed 48-phase vector, includes rotation/scale/timing channels, measures all 91 pair distances, and also rejects byte-identical quantized fingerprints. Its initial minimum separation threshold was fixed at `0.075` before the baseline run.
- Baseline run used private game listener `63302`; it completed all 14 captures and wrote `before/catalog-live-capture.json` plus 14 natural-motion PNGs before intentionally failing on the absent `comboChoreography` field. The owner listeners were not touched.
- Baseline coverage: 14/14 IDs, all 62 existing bar steps, 91/91 pair comparisons, and 1,907 rendered frames. Rest contracts settled byte-identically within each weapon capture. Hailwidow baseline is confirmed as `displayLength=128`, `damage=7`, `cooldown=0.3`.
- The closest pre-edit normalized pair is Stillwater Edict vs Pale Horizon Nodachi at `0.132431`. Because the owner has already judged the shipped motions indistinguishable, the permanent minimum will be raised before implementation to `0.16`; this is a stricter threshold, not a post-failure relaxation. Exact duplicate rejection remains separate.

Two baseline harness assumptions were proved wrong and the gate will not be relied on until corrected:

1. Repeated simulated local held input accumulates predicted `rigAttackSeq` ahead of server `attackSeq` across sequential `devEquip` calls (the divergence grew from 0–1 on Voltedge to 22–23 by the final weapons). Comparing those global counters per frame therefore does not prove the current rendered step was accepted. The corrected gate will send repeated real wire `attack` messages without locally predicting extra attempts; server cadence accepts them and the observed rig consumes the authoritative patch.
2. `x2-gravechill-nodachi` intentionally emits zero ordinary slash calls under its existing VFX policy. Requiring every weapon to increment a suppressed-slash counter is not a VFX-off law. The correct invariant is that the gate installs the no-op slash override for the whole measurement and no original slash renderer is invoked; zero attempted calls is valid.

Per the hard rule, these assertions are being corrected from the measured proof above before product work or any green claim. No threshold is being weakened and the failed baseline is retained.

Current state: baseline evidence retained; gate authority/VFX instrumentation correction and a clean baseline rerun are next. Product code remains unmodified.

### Corrected authoritative baseline

- Corrected the harness as documented and raised the pair-distance threshold from `0.075` to `0.16` before product implementation. The exact-duplicate fingerprint assertion remains unchanged.
- Reran on private game listener `64370`. Every rendered frame for every weapon now has `rigAttackSeq - authority attackSeq = 0`; all 62 steps are individually authority-confirmed. The VFX no-op override was installed for all 14 captures and the original slash renderer was invoked zero times.
- The corrected closest baseline pair is Hailwidow vs Cinderfang at `0.129571`, below the now-fixed `0.16` visible-separation threshold. Thus the retained baseline independently fails both the missing choreography-vocabulary requirement and the measured all-pairs separation requirement.
- All other baseline prerequisites are healthy: 14/14 census, 62/62 bar coverage, 91 pair measurements, exact rest settle, and unchanged live definition/DPS contracts. The intentional failing assertion remains the missing choreography vocabulary; no threshold was weakened.
- Design refinement before implementation: Voltedge keeps its existing three-beat count to avoid any combo-budget reinterpretation. Its final sentence is `side-cut → wave-cut → lunge`; the backflip headline remains assigned to Moonwake. Every other planned beat count also remains exactly unchanged.

Current state: authoritative before evidence is complete. Shared choreography/codegen implementation begins next.

### Choreography implementation checkpoint

- Added an attack-only, reusable `comboChoreography` vocabulary to the shared melee step contract. The eight primitives are sampled from normalized combo phase and expose weapon angle/translation, body bend/rotation/scale, foot plants, card lift/rotation, hand spacing, blade-length emphasis, depth, and shadow channels. `SpriteRig` consumes those channels inside the existing accepted-combo dispatch; no weapon-ID animation branches or new timers were added.
- Authored distinct primitive/intensity bars for all 14 active katana-family IDs. Neon receives a named three-beat presentation variant while preserving the existing arc timings and mechanics; Cinderfang receives an explicit three-beat generated bar copied from the existing arc mechanics so its lead/off/both-hand dance can be data-driven. The remaining generated and hand-authored bars retain their prior beat counts, timings, paths, hooks, damage, and cooldown contracts.
- Added generator validation for the optional choreography array: only the eight declared primitives and `intensity` key are accepted, and array length must exactly match the existing combo bar. Archived Kagewake and Hushglass remain without new choreography.
- Set Hailwidow's source `displayLength` from 128 to exactly 192. Damage remains 7 and cooldown remains 0.3 seconds. Its named rest stance remains `tachi-no-tori`; no stance table, grip row, size class, or pose-language registry was edited.
- Ran the first canonical `pnpm gen` successfully: 314 weapon definitions and 30 generated combo bars were emitted, followed by a successful shared-package build. The generated expansion now carries the source choreography rows. A diff audit is in progress before focused tests so any generator side effect outside this Sol's write lease can be identified rather than silently adopted.

Current state: product implementation is present and codegen completed once; sampler cleanup, exact diff audit, focused contract tests, and live after-evidence remain.

### Implementation hardening and focused contracts

- The first focused run surfaced an existing, intentionally strict full-roster routing assertion in `tests/driftblade-model-panel.test.ts`: my initial Neon named variant and Cinderfang generated variant changed the roster routing groups even though their timings were copied. The assertion was correct and was not edited. I moved those two recipes onto an attack-only `WeaponDef.comboChoreography` overlay instead. Neon remains byte-for-byte routed as `arc/hero-spin`; Cinderfang remains `arc/default`. Cinderfang's optional choreography-hand field provides lead/off/both presentation ownership without changing its underlying combo path or server hand/damage mechanics.
- Generator validation now accepts a choreography recipe either alongside an authored bar or as an overlay on an existing family/variant route. It validates 1–8 beats, exact bar length when a bar is present, primitive, intensity, and optional presentation hand. Runtime resolution also rejects a recipe whose beat count differs from its unchanged selected route. Resolved overlay sequences are frozen and cached per weapon/base/recipe rather than allocated per frame or accepted attack.
- Removed the temporary 30th generated Cinderfang bar; the canonical expansion is back to 29 generated bars and the prior routing census. The generator emits the normalized attack-only recipe on the weapon definition and also carries it into generated authored bars. Neon receives the same normalized overlay directly in its durable hand-authored definition.
- Hardened the pure sampler: reset is allocation-free; `t=1` returns exact neutral identity; backflip/spin depth, shadow scale/rotation, and hand spacing no longer leave residual channels. Backflip remains a paper rotation only and never exposes world-root displacement.
- Added `tests/v7-katana-movesets.test.ts`: exact 14-ID census, unique complete primitive bars, pre-order beat-count comparison, exact baseline DPS/hook comparison, rest-source comparison against retained before evidence, exact Hailwidow 128→192 size and 140→193.68 px WYSIWYG reach proof, legacy Neon/Cinder routing, Cinder arc mechanics, and archived-pair exclusion.
- Added `packages/server/src/rooms/GameRoom.v7-katana.test.ts`: two full bars of contiguous accepted-sequence progression for every ID, expiry reset, descriptor timing/cooldown neutrality, and a source contract proving `GameRoom` contains no choreography clock or choreography consumption.
- Extended `SpriteRig.combo-continuity.test.ts` with exact neutral-return checks for all eight primitives, distinct normalized multi-channel primitive trajectories, and explicit owner-headline laws for knees-bent stab, lunge, backflip, and spin broadside. The first spin assertion sampled phase 0.38, which measured the deliberate second edge-on crossing (`scaleX=0.959`); phase sampling proved the broadside is phase 0.30 (`scaleX=0.753`, weapon length scale `0.587`). The assertion threshold was not weakened; the test now samples the actual broadside.
- Focused verification is green: shared TypeScript build plus 90 tests across the new catalog/server/client contracts and the existing katana line, Driftblade roster invariance, V3M, and V5M suites. The previously failing full-roster test now passes unchanged.
- `pnpm gen` also revealed an unrelated VFX-subject registry refresh caused by broader committed catalog drift. That file is outside this Sol's lease and the generated diff was excluded; no unrelated VFX registry change is part of this deliverable.

Current state: implementation and focused unit contracts are green. The permanent private-stack after gate and retained headline/live evidence are next.

### Retained live after-evidence

- Ran the permanent gate on an isolated `runArenaSpec` stack at private game port `54204`; the owner's listeners on 5180/2567 were not touched. Playwright completed in 151.4 seconds and passed.
- Retained `after/catalog-live-capture.json`, 14 natural-motion screenshots, and 15 three-phase headline screenshots under `docs/owner-notes-audit-v7-evidence/katana-movesets/after/`. The five headline sequences are side slash (Neon), wave path (Stormthread), paper backflip (Moonwake), knees-bent stab (Hailwidow), and lunge (Riftstep).
- Live coverage is 14/14 IDs, 1,845 rendered attack frames, all 62 authored bar positions, two or more accepted bars per weapon (140 accepted beats total), and all 91 pair comparisons. Every recorded attack frame had `rigAttackSeq - authority attackSeq = 0`.
- VFX was disabled for the complete measurement. The no-op slash override was installed for every weapon and the original slash renderer was invoked zero times. The measured distinctions therefore come from weapon/body/hand/foot/shadow/paper motion and timing rather than the already-distinct generated slash art.
- No normalized fingerprints duplicate. The closest pair is Voltfang vs Cinderfang at `0.165129`, above the pre-implementation fixed `0.16` minimum. The before gate's closest pair was Hailwidow vs Cinderfang at `0.129571`, below that same requirement.
- The after artifact records every permanent assertion true: exact census, complete bar coverage, authority confirmation, VFX-off measurement, per-capture rest settle, exact before/after rest contract, exact before/after nominal DPS/hook contract, Hailwidow exact 1.5x, no duplicate fingerprint, all-pairs minimum separation, all five headline verbs, and all headline frame sequences.
- Hailwidow live definition is `displayLength=192`, `range=140`, `damage=7`, `cooldown=0.3`, `stance=tachi-no-tori`. Its WYSIWYG melee reach is 193.68 px versus the 140 px baseline floor; this is the documented visible-size consequence of the ordered 1.5x blade, with no damage or cadence change.
- Visually inspected the retained midpoint headline frames. They show five plainly different silhouettes with VFX absent: Neon crossed side-cut, Stormthread extended wave, Moonwake inverted/card-rotated backflip, Hailwidow compressed knees-bent vertical stab, and Riftstep forward straight-line lunge.

Current state: live visual closure and retained evidence are complete. Only the mandated ordered final validation and final report verdict remain.

## Validation

Final validation is starting in the binding order: canonical generation, generated drift check, asset check, focused tests, then repository typecheck. Results will be appended here as each gate completes.

1. `pnpm gen` — PASS. Canonical generation emitted 314 weapons / 29 generated combo bars, built shared TypeScript, and completed every downstream generator/aggregator/portal step.
2. `pnpm gen:check` — PASS. Weapon expansion, dimensions, dimension subjects, card manifest, Weaponsmith aggregation, generated weapon VFX, and portal are in sync. The command reported its existing conditional skips for the VFX-subject check (10 unavailable untracked reference artifacts) and character check (one unavailable untracked sprite-parts artifact); it exited zero.
3. `pnpm assets:check` — PASS. 415 sprite entries / 754 parts, 412 atlas frames, 312 cards, 6 POIs, 9 decals, 12 projectile URLs, and 96 particle URLs validated.
4. Focused tests, first final pass — Vitest PASS: 7 files / 90 tests. The post-generation Playwright repeat then FAILED only `pairwiseMotionDistance`: Neon vs Stormthread measured `0.153243` and Stillwater vs Stormthread `0.154043`, below the unchanged `0.16` minimum; every other live assertion remained true. The earlier live run measured a different closest pair at `0.165129`, proving the natural-frame fingerprint's baseline is unstable. Audit found it subtracts `frames[0]`, which is an arbitrary attack frame rather than a deterministic settled idle pose, and chooses nearest naturally scheduled frames. The threshold remains `0.16`. The gate is being hardened to replay each already-authority-confirmed descriptor at fixed phases against a fixed-time idle pose; the failed JSON will be retained separately before the next run overwrites the current after artifact.
   - The first hardened-gate launch stopped before product assertions because `FINGERPRINT_PHASE_SAMPLES` was referenced inside the serialized browser closure. The sample count is now passed explicitly through `page.evaluate`; this is a harness serialization correction, not a product or threshold change.
   - The next deterministic run proved its replay restored only `swing`, not SpriteRig's accepted combo-family/step/variant snapshot: Stormthread vs Gatebreaker collapsed to `0.045911` even though their recorded primitive labels differed. That audit also found a real product seam defect for overlay-only recipes: live animation reselected `meleeComboSequenceFor(family, variant)` and therefore missed Neon/Cinderfang's weapon-level overlay even though the descriptor carried it. `SpriteRig` now resolves the current weapon selection first (falling back to the old table only when identities do not match), and deterministic replay restores the complete accepted combo snapshot. This is an implementation fix; the threshold is still `0.16`.
   - Corrected deterministic gate — PASS on private port `58046` in 143.4 seconds. It retained 1,832 natural frames plus 672 fixed-phase live-render replay frames (48 per weapon), covered all bars with 138 accepted beats, and reported every assertion true. The closest deterministic pair is Gravechill vs Stormpetal at `0.163115`, above the unchanged `0.16` floor. `catalog-live-capture.failed-pairwise.json` retains the failed audit run separately.
   - Because the audit produced a real `SpriteRig` correction after the first generation sequence, the complete binding sequence is being restarted below; only the restarted results count as final.
   - The restarted live pass reconfirmed deterministic pair separation (`0.163267` minimum) but stopped because Riftstep's naturally rendered stream had not yet shown step 3 when the gate stopped at its numeric two-bar beat target; census/rest/DPS/VFX and pairwise assertions all passed. The gate now keeps the attack stream active until its authority-confirmed render snapshot contains every expected step, then asserts exactly 48 deterministic fingerprint phases per weapon. The coverage assertion remains required, and the failed coverage JSON is retained separately on the next run.
   - The coverage-aware rerun passed all 17 assertions with a `0.165726` minimum, but comparison with the prior `0.163115` pass exposed remaining low-amplitude noise. The metric captured the root display transform but fingerprinted only root X/Y, omitting rotation/scale—the defining backflip channels—while retaining procedural extremity channels. The permanent fingerprint now includes the root's full normalized X/Y/rotation/scale feature just like every other rendered part. This strengthens the backflip measurement; the `0.16` threshold is unchanged.
   - Full-root measurement passed but exposed Stillwater vs Gatebreaker at only `0.160101`, an unacceptable `0.000101` margin. Gatebreaker's seven-beat mechanics remain untouched, but its attack-only sentence is strengthened from a mostly Stillwater-overlapping guard/side chain into `knee → side → spin → knee → spin → rise → lunge`, with escalating intensity. This creates the intended violent threshold-breaking double-low/double-spin body rhythm without changing damage, reach, timing, or cadence. Regeneration and live remeasurement follow; the threshold remains `0.16`.
   - Gatebreaker remeasurement — PASS on private port `63453` in 144 seconds. Stillwater vs Gatebreaker rose from `0.160101` to `0.175017`; the new closest pair is Stillwater vs Stormthread at `0.166372`. All 17 assertions are true. Because this was a catalog-source refinement after the restarted canonical sequence, the binding sequence is run one last time below before typecheck.

Final binding sequence after the last product/catalog edit:

1. `pnpm gen` — PASS; 314 weapons / 29 combo bars, shared build and all downstream generators completed.
2. `pnpm gen:check` — PASS with the same two explicitly reported conditional skips for unavailable untracked art inputs.
3. `pnpm assets:check` — PASS; 415 sprite entries / 754 parts and all reported manifests/URLs validated.
4. Focused Vitest — PASS; 7 files / 90 tests, including the unchanged Driftblade full-roster routing gate.
5. Permanent Playwright live gate — PASS on private port `56787` in 149 seconds. Final retained artifact has all 17 assertions true, 2,031 natural frames, 672 deterministic phases, 146 accepted beats, and minimum pair Stillwater vs Stormthread `0.165798` at the unchanged `0.16` threshold. The preceding full-root pass measured the same pair at `0.166372`, confirming stable clearance after the Gatebreaker refinement.
6. `pnpm typecheck` — PASS. Shared build plus shared/client/server `tsc --noEmit` all completed successfully.
7. Final lease/diff audit — PASS. `git diff --check` reports no whitespace errors on leased source/test/report files. The canonical generator's unrelated `tools/artkit/subjects-vfx-300.json` refresh was removed exactly because that file is outside this Sol's lease. Concurrent perf work and untracked `tests/fixtures/` remain untouched.

Permanent evidence now contains 47 files (before/after machine traces, 28 natural-motion frames, 15 headline frames, and two retained failed-gate traces) totaling 50,996,403 bytes. The final after JSON is the passing full-root deterministic artifact; failed pairwise and failed-coverage runs remain separately named for auditability.

VERDICT: SHIPPED all 14 active katana-family weapons with visibly distinct accepted-clock body movesets, unchanged rest-pose contracts, unchanged nominal DPS/hooks/beat counts, Hailwidow's exact 1.5x blade, permanent VFX-off all-pairs Playwright enforcement, and retained before/after/headline evidence; DID NOT SHIP new slash VFX, archived Kagewake/Hushglass choreography, client-only world displacement, routing changes, or unrelated generator output; COULD NOT PROVE only the two unrelated `gen:check` registries explicitly skipped because their untracked art inputs were unavailable—every katana-scope order and gate is proven green.
