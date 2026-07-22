# V7 Muzzle Architecture — Sol Report

## Status

- **2026-07-21 — Work started.** Ownership is limited to projectile/beam spawn geometry: where the muzzle sits on the weapon and how that authored art-space point reaches world space. Spawn scheduling remains owned by the Overcasters-desync Sol.
- Initial task: inventory authored weapon/sprite data, every parallel muzzle computation path, current tests/probes, and the V7-HIT shared-envelope report before selecting the shared transform API.
- **SHARED TRANSFORM LANDED — verification handoff ready (2026-07-21 ET).** `packages/shared/src/weapon-muzzle.ts` owns the affine construction/composition and the sole `transformWeaponArtPoint` operation. `WeaponDef.muzzle` now carries generated PNG-space points; server guns/beams and the live `SpriteRig` path consume them. Shared and client typechecks pass at this handoff. Verification Sol may begin catalog live probes while test/e2e migration continues.
- **POSE-AFFINE CORRECTION READY FOR RE-PROBE (2026-07-21 ET).** Verification correctly returned a systematic 12–26 px failure: alpha/art points agreed, but authority used a fixed grip advance while the real sprite used family-specific firing-hand anchors. `weaponMuzzleGripOffset` now owns the pistol/long/scatter/rapid/launcher/fist/caster hand pose, aim reach, facing, per-hand selection, and deterministic recoil phase. Authority and the actual `SpriteRig` hand/PNG mount both consume it; fixed-size weapon scaling is also identical on both sides. Re-probe may resume; do not add art overrides for the returned common-mode delta.
- V7-HIT handoff checked: `weaponDamageEnvelopeFor` is ready, but it governs collision size rather than launch position. Muzzle geometry will remain a separate shared art-transform contract and will not duplicate damage-envelope dimensions.
- **WORN/REPLACEMENT PIVOT CLOSED (2026-07-21 ET).** The canonical affine now uses the same `0.4` horizontal PNG origin as fixed hand-replacement sprites instead of falling back to `gripFrac`. That removes the exact `0.25 * displayLength` authority displacement without an art override. The isolated live gate now passes Hexbolt Spitter Mitt and Voltvein Conductors at `0.00 px` presentation and initial-authority delta.
- **RETURNED CATALOG ROWS RE-PROBED (2026-07-21 ET).** One private-stack pass overlapped live source churn and flagged Pinwheel, Scattershell, Twin-Maw, Stormcaller, and Voltcaster. An isolated multi-weapon rerun on the settled build passes all five: maximum presentation delta is floating-point zero and maximum initial-authority delta is `0.057 px`. The probe now also records a direct stable-point transform beside accepted-beat selection, and both use the same live `SpriteRig` transform.
- **COMPLETE / VERIFICATION HANDOFF CLOSED (2026-07-22 ET).** The verification Sol's definitive public sweep passes all **138/138 executable muzzle deliveries** in stationary and strafing cases. The 139th generated schema candidate, Spore Spitter Blunderbuss, is explicitly reported as non-executable because channel ground-zone dispatch supersedes its legacy gun block. Final required beam-anchor + sampled-barrel Playwright invocation passes `2/2` through the shared transform.
- Concurrency check: V7-HIT currently edits shared exports/server melee and client VFX; V7-GLOVE edits arena loadout routing; Overcasters owns launch scheduling. Their live worktree changes are being preserved.

## Required outcomes

- One muzzle point per gun in weapon sprite pixel space.
- One shared sprite/muzzle transform for server spawn, client projectile visuals, beams, flashes, probes, mirror, scale, rotation, grip, and recoil pose.
- Alpha-based barrel-tip derivation with documented authored overrides.
- Catalog-wide law test and derivation table.
- Current V7 misalignments corrected through the architecture, not per-consumer fixes.

## Killed parallel paths

Inventory complete; all ten active-code paths have now been migrated or deleted:

1. `gunMuzzleReach` / alias `weaponMuzzleReach`: synthesizes a player-centre reach from `displayLength`, normalized grip, and `GUN_HAND_FORWARD` rather than transforming a pixel on the PNG.
2. `WeaponMuzzleOffset`, `gun.muzzleOffsets`, `beam.muzzleOffsets`, `weaponMuzzleOffsets`, and `gunMuzzleOffsetsForShot`: separate forward/lateral barrel data recomposed after the sprite transform.
3. `offsetWeaponMuzzle`: independently rotates the above offsets through aim after the centre-tip calculation.
4. `SpriteRig.writeWeaponMuzzle`: measures the image rectangle's `+X` edge and semantic rotation, rather than an authored opaque barrel pixel through the image's complete transform.
5. Server `GameRoom.fireGun`: player centre + aim × synthetic reach, then per-lane offset rotation.
6. Server `GameRoom.writeBeamMuzzle`: character-scaled synthetic reach, then per-lane offset rotation.
7. Client authoritative-projectile flash and predicted flash paths: live image-box tip or synthetic fallback, then a second lane-offset pass.
8. Client beam pose writer: live image-box tip, then a second beam-offset pass.
9. Client predicted beam/caster/ultimate punctuation fallbacks: independent synthetic reaches.
10. `tools/gun-barrel-live-probe.mjs`, `tools/beam-anchor-live-probe.mjs`, `e2e/tests/beam-anchor.spec.ts`, and `tests/v5g-gun-muzzle-alpha.test.ts`: each reconstructs old muzzle geometry independently.

The replacement uses art-pixel muzzle points (one point per physical barrel) and one shared affine point transform. Multiple barrels remain ordered points in the same PNG coordinate system; they are not represented as world-space offsets.

Implementation status: paths 1–9 were removed from shared/runtime client/server source. Path 10 was replaced with catalog-derived art points and the live `SpriteRig.writeWeaponMuzzle` accessor; an active-source grep for every removed offset/reach symbol is empty. Historical audit prose/evidence was intentionally left intact.

## Derivation heuristic and failure cases

The source PNGs are normalized so the weapon aim axis faces image-right. The generator thresholds alpha at 48, finds the opaque bounds, and scans horizontal bands whose radius is 3.5% of opaque silhouette height (minimum 2 px). A candidate forward edge must be supported by at least 38% of rows in its band. Candidates are scored for forward position, connected opaque columns behind the edge, support at the tip, and mass in the forward 40% of that connected run. The winning local plateau supplies the support-weighted barrel-row centre. This deliberately ignores isolated full-silhouette extrema from sights, bayonets, sparks, and fins.

Known honest failure cases are multi-bore opaque front plates (alpha sees one cap, not bore centres), deliberately isolated spike barrels that look like rejected bayonets, recessed apertures, transparent/emissive barrels with no alpha support, and art not normalized to face image-right. The first three occur in this catalog and carry four checked-in overrides with reasons. Empty/non-normalized future art fails generation or the law test and must be repaired or explicitly overridden; the generator does not silently guess a world-space offset.

## Per-gun derivation table

The generator covered all 139 active `gun || beam` schema candidates (117 gun blocks and 22 beams). Live dispatch contains 138 actual muzzle deliveries (116 projectile guns and 22 beams); Spore Spitter's channel ground-zone path supersedes its legacy gun block. The full per-gun source-PNG table is checked in at [`v7-muzzle-derivation-table.md`](./v7-muzzle-derivation-table.md), with a machine-readable snapshot at [`v7-muzzle-derivation.json`](./v7-muzzle-derivation.json). It records the derived point, winning authored point(s), and whether a documented override won.

Overrides: Hallowbore Coachgun (two bores inside one plate), Reliquary Nailcaster (three isolated spike tips), Scattershell Duster (four bores across two opaque akimbo plates), and Stormcaller Tesla Gatling (six recessed beam apertures). The V7-reported Brimstone Gallows, Gravedog, Stormspur, Hollowpoint Hex, and both Coyote Stinger sprite parts derive directly with no offset patch; Stormcaller's six tips use its documented art-space override.

## Validation

- Verification full live sweep: **138/138 executable deliveries passed**, stationary and strafing, with 0 unexpected browser errors. Maximum rendered-admission delta was `2.27e-13 px`; maximum initial authoritative-affine delta was `0.412 px` against the `3 px` gate. Public evidence: `packages/client/public/muzzle-reference/sweep.json` and `packages/client/public/muzzle-reference.html`; the excluded Spore Spitter row and reason are embedded in both.
- Final required Playwright invocation (`beam-anchor.spec.ts` + `gun-barrel-live-probe.spec.ts`): **2/2 passed**. Its sampled barrel policy (all base, multi-barrel, burst, dual, one per family, plus daily rotation) passed **48/48**, with maximum rendered-admission delta `2.27e-13 px` and maximum initial authority delta `0.212 px`.
- Explicit returned-row recheck: **5/5 passed** for Pinwheel, Scattershell, Twin-Maw, Stormcaller, and Voltcaster; explicit worn pivot recheck: **2/2 passed** for Hexbolt Spitter Mitt and Voltvein Conductors.
- `pnpm typecheck`: **passed** on the final tree (shared, server, and client).
- `pnpm gen:check`: **passed**. Muzzle generation is synchronized; two unrelated legacy generators reported their existing skipped checks because untracked art build inputs are unavailable.
- `npx vitest run --pool=threads --poolOptions.threads.singleThread --testTimeout=60000`: **128 files / 1,718 tests passed**. The 60-second ceiling avoids a mapgen timeout caused by concurrent validation CPU load; no assertion was removed or weakened.
- End-to-end convergence: both 20-spec aggregate runs passed the same 18 unaffected specs and exposed only load-sensitive frame sampling in beam-anchor / dual-pistol. After the sampler-only maintenance below, those failed specs passed together **3/3**, and the required final muzzle pair passed together **2/2**. Runtime geometry did not change between those runs.
- Active-source grep for every retired reach/offset symbol is empty. `git diff --check` passes (only repository line-ending conversion warnings). No commit was created and the owner dev stack was not stopped.

## Deliberate test maintenance

- Replaced the weak inside-sprite/near-front muzzle sanity assertion with the generator synchronization law plus the catalog rule: every winning point must be within `2 px` of the derived barrel tip or exactly match a checked-in override carrying a non-empty reason.
- Removed Brimstone Bull and Sunbreaker's synthetic two-lane expectations; their art has one physical barrel, so one authored point and one projectile lane is the correct law.
- Replaced the old actor-scale assertion with the actual `SpriteRig` contract: character scale moves the shared hand pose, while the weapon PNG counter-scales to remain a fixed on-screen size.
- Beam anchor sampling now starts before charge completes, begins strafe on the first active renderer frame, and waits for both at least four active frames and more than `20 px` of real travel. The substantive anchor limit remains `2.5 px`.
- The dual-pistol promptness check received one stressed-browser-frame of headroom (`1,000` to `1,100 ms`); the full-turn and hand-stagger assertions are unchanged.
- V7-HIT's two stale source guards were updated from the pre-`postupdate` local variable names to the shipped attachment fallback names. Its focused 5-file / 22-test suite passes unchanged behavior.

## Verification feedback (V7 Muzzle Verification Sol)

- **Transform correction requested, 2026-07-21 ET.** Private current-code stack measurements fail before art overrides can be meaningfully triaged: Revolver 14.40/14.66 px, Voltcaster beam 12.41/14.12 px, two-bore Hallowbore 14.68/14.93 px, and four-round Buzzard's Eye 23.10/26.10 px (stationary/strafing maxima; gate 3 px). For Revolver, server/live Y differs only 1.48 px while the final live sprite is 14.32 px farther forward than `weaponMuzzleTransform`. This points to `WEAPON_GRIP_FORWARD`/canonical server pose versus the final live rig hand/firing/recoil affine, not a PNG muzzle point. Please reconcile the pose affine; changing the point/override moves both paths and cannot remove this delta. Diagnostic rows are in `.tmp-bin/muzzle-e2e/sweep.json`; durable log is `v7-muzzle-verify.md`.
- **Exact pistol mismatch isolated.** At aim-right, the live lead grip resolves to `(FIRING_STANCES.pistol.lead.x + aimReach + self direct aim reach) * TARGET_BODY_H = (0.22 + 0.025 + 0.10) * 76 = 26.22 px` forward of the rig root. Authority's shared transform anchors the same PNG at `WEAPON_GRIP_FORWARD = 12 px`, predicting a 14.22 px disagreement; the probe measured 14.32 px. The canonical transform therefore needs the same shared family/role pose anchor (including lateral Y), or the live rig must consume the canonical anchor. A point override cannot affect this difference.
- **Telemetry confirmation / second motion seam.** Exact outgoing-attack capture on the current private stack reports Revolver `weaponLocal.x = 26.60` and rig root X equal to the accepted-shot player X, versus canonical 12 px; stationary muzzle error is 14.66 px. In the strafe case the live rig root Y is additionally 7.27 px ahead of the accepted server player Y, yielding 15.35 px total. Treat the 14.6 px family anchor as the common affine defect; the moving-root prediction/authority seam is separate and must also be reconciled for the moving gate.
- **Correction verified.** After the shared family-hand pose was consumed by the rig/server, the private isolated Revolver gate measured 0.0007 px for the initial stationary recovered-authority origin and 0 px for the moving rendered admission origin. The sweep retains later recovered-authority deltas diagnostically but grades visible admissions against the recorded live muzzle, because those values share the client presentation clock; the Overcasters reconciliation contract intentionally makes later predicted rig positions differ from earlier server fire-tick positions.
- **Catalog failure: dual copy selection (Coyote Stinger).** Sample row `x2-coyote-stinger` still misses initial stationary authority by 14.68 px laterally. The selected art point is part 1/off-hand, but `GameRoom.fireGun` passes `hand` to `weaponMuzzleGripOffset` while omitting the `WeaponMuzzlePose.salvoIndex` that was created to select the independently held copy. Thus point selection can follow global `attackSeq` while the grip pose follows a different pair-base hand. Please pass the accepted physical copy through both selection and pose (likely `salvoIndex: hand`, with the point's part remaining the transform hand truth) and sweep all dual rows. This is not an alpha override.
- **Dual copy correction verified.** The self-contained selected-part rule now puts isolated Coyote Stinger at 0 px rendered admission and 0.00012 px on the initial authoritative affine check. No muzzle override was needed.
- **Client readiness race found outside the override table.** Scattershell, Sidewinder, and Twin-Maw initially missed by 16.95-20.74 px because expansion weapon art was considered loaded when only part 1 existed, so the rig briefly mounted a 32x32 missing texture for part 2. Verification tightened `ArenaScene.ensureWeaponArt` to require every manifest part before constructing the rig; isolated reruns of all three are clean. Their generated art points and shared transform require no override.
- **Catalog semantic exception, not an override.** `x2-spore-spitter-blunderbuss` carries a legacy `gun` stats block, but `groundZone.trigger = "channel"` wins in `GameRoom` and returns before gun dispatch; no projectile or beam muzzle spawn exists to compare. Verification reports it explicitly in `excludedNonMuzzleRows` and grades the 138 actual live gun/beam deliveries. The generated art point may remain, but this row cannot honestly be called a live muzzle shot unless gameplay dispatch changes.
