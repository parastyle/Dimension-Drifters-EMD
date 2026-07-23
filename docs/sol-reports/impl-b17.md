# B17 Idle-Hand Implementation Report

Date: 2026-07-23  
Sol: `impl-b17`  
Branch: `sol/b17-idle-hand`  
Worktree: `C:/Users/Exped/ddv2-wt/b17-idle-hand`

## Reading map

- `docs/sol-reports/panel-dead-body-parts.md` — authoritative diagnosis, taxonomy, invariants, schema, and ten-step execution plan.
- `packages/client/src/sprites/pose-language.ts` — pose vocabulary, hand-role seams, idle/recovery targets, and foot profiles.
- `packages/client/src/entities/SpriteRig.ts` — runtime hand/foot composition, whole-art exception, action ownership, and late canonical clamps.
- `packages/shared/src/weapons.ts` — shared `WeaponDef` schema and base-catalog presentation overrides.
- `data/weapon-concepts-300.json` — generated-catalog pose-language exceptions.
- `tools/artkit/gen-weapon-expansion.mjs` — strict JSON validation and generated `WeaponDef` output.
- `packages/shared/src/weapons-expansion.generated.ts` — canonical generated expansion output.
- `packages/client/src/sprites/manifest.ts` and `packages/client/src/sprites/whole-art-character.ts` — real six-part sockets and whole-art eligibility.
- `packages/client/src/sprites/firing-stance.ts` — casting, aimed, and worn/fist-gun hand ownership.
- `packages/client/src/sprites/pose-language.test.ts` — pure catalog-wide hand, recovery, mirror, and foot laws.
- `packages/client/src/entities/SpriteRig.idle-parts.test.ts` — focused integrated whole-art idle-parts laws.
- `packages/client/src/entities/SpriteRig.ranged.test.ts` and `packages/client/src/entities/SpriteRig.dualwield.test.ts` — ranged, mechanism, cast, and dual-owner regressions.
- `tests/data-consistency.test.ts` — strict generator and authored-field round-trip laws.
- `tests/owner-notes-weapon-pose.test.ts` and `tests/v6g-systemic-owner-orders.test.ts` — B8 named-pose and secondary-grip invariants.
- `docs/sol-reports/v7-hands-affine.md` and `docs/sol-reports/impl-b8-pose.md` — earlier affine evidence and named-action intent.

## Execution plan

1. Write failing laws first using real negative manifest sockets for blade, blunt, pistol, focus, Saint-Bough, and Hellmouth.
2. Add shared `poseLanguage` schema, strict generator validation/emission, generated output, and round-trip laws.
3. Add exhaustive visible-hand semantic classification.
4. Add the five-pose hand registry and family defaults, with only proven per-weapon overrides.
5. Replace the whole-art bypass with visible absolute idle targets.
6. Compose movement and micro-motion, then apply the facing-side post-condition late in canonical local space before the one root mirror.
7. Make terminal recovery converge on the same next-frame idle target.
8. Normalize feet to one selected neutral profile and make named stances replace generic stance composition.
9. Protect dual, 2H, cast/channel, thrown recovery, mechanisms, flourishes, and B8 named actions with explicit laws.
10. Run generation, typecheck, full unit suite, grip/muzzle gates, and a measured private-port live idle-parts gate; retain evidence under `docs/owner-notes-audit-v10-evidence/b17-idle-hand/`.

## Progress log

- Step 0 — Read the authoritative panel in full and created this report before implementation changes. The ruling fixes the bug in canonical local space and preserves the existing signed root mirror as the sole LEFT/RIGHT transform.
- Step 1 red — Added `SpriteRig.idle-parts.test.ts` with the real `proto-samurai`, `proto-sheriff`, and `proto-witch` manifest sockets plus blade, blunt, pistol, focus, Saint-Bough, and Hellmouth fixtures at both facings. The untouched whole-art branch failed immediately at `proto-samurai:rattler-sabre` with composed facing distance `-53.417 px` against the required `+2.28 px` floor, proving the root mirror preserves the wrong canonical half-plane.
- Step 2 — Added shared `IdleHandPose`, `IdleFootPose`, `WeaponPoseLanguageDef`, and optional `WeaponDef.poseLanguage`; strict generator parsing rejects unknown keys/poses and `secondary-grip` without `gripPoints.secondary`. JSON → generated TypeScript → `WEAPONS` round trip is covered, including Saint-Bough/Hellmouth generated overrides and Voltedge's base-catalog override. The focused data suite is green: 370/370.
- Step 3 — Added priority-ordered `classifyHandRole`. Both visible hands now resolve to `hard-constrained`, `action-owned`, `recovering`, `authored-idle`, `absent-replaced`, or the deliberately failing `explicit-test-failure`; catalog-wide idle enumeration proves no live hand reaches the failure state.
- Step 4 — Added the frozen five-pose registry and family defaults: `secondary-grip`, `mirror-guard`, `low-guard`, `casting-gesture`, and `hip-rest`. Every current catalog row resolves a named entry without the last-resort fallback.
- Step 5 — Deleted the whole-art idle bypass. The free hand now uses an absolute canonical target that ignores its negative manifest socket and leaves enough facing-side bounds visible beyond all three prototype torso rectangles, preserving the original anti-occlusion intent.
- Step 6 — Runtime composition now applies locomotion and procedural residuals before a final canonical `+0.03 * bodyHeight` post-condition on `authored-idle` only; no facing multiplier enters the target, so the signed root remains the sole mirror.
- Step 7 — Non-terminal recovery resolves on an absolute authored return path and terminal recovery resolves byte-identically to the following idle target. Pure catalog laws cover representative aims, both root facings, adverse movement/micro offsets, finite bounds, and reduced motion.
- Step 8 — Added `loose-plant`, `combat-plant`, and `wide-plant`; one selected neutral profile contributes a gait-faded planted bias. Blade-size/named stances replace that profile rather than stacking on it, and foot placement no longer rotates with upper-body aim.
- Step 9 — Protected higher-priority owners explicitly. Neutral dual/fists/glove/2H hands classify hard, dual action choreography retains its existing support layer, aimed/muzzle and secondary-grip writers remain late, and cast/channel/page/throw/flourish/brace states never receive the idle clamp. The focused owner matrix is green: ranged, dual, combo continuity, B8 owner notes, secondary grips, pose language, integrated idle parts, and data consistency — 475/475 tests; shared build and client typecheck also pass.
- Step 10 — Generated and validated the final tree. `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, `pnpm assets:check`, and the exact full `pnpm test` rerun all pass; the full unit result is 151 files / 1,974 tests. After formatting, the expanded focused owner matrix also passes 10 files / 492 tests. `git diff --check` and the changed-file Biome check pass (three pre-existing warnings remain outside the B17 edits).
- Step 10 live idle-parts gate — `e2e/tests/b17-idle-parts-live-gate.spec.ts` passed on private ephemeral game/Vite ports `52325/52326`, explicitly protecting `2567/5180`. It retained 42 pre/post pairs: seven representative 1H weapons × three shipped whole-art prototypes × two facings. The final machine summary reports minimum post world-facing margin `27.4624 px`, maximum legacy margin `-37.4624 px`, minimum visible torso-edge clearance `7.3071 px`, minimum foot separation `64.5572 px`, and maximum primary-grip-origin delta `0 px`.
- Step 10 compatibility gates — The V7 accepted-cycle hand/mechanism gate passed for the six retained lever/pump/shotgun mechanisms, and the unchanged B8 live gallery passed on rerun with both facings, painted grips, Voltedge envelope, Gravewarden seam, and Nullspike steps `0/1/2`. The sampled legacy muzzle probe currently reports all 53 visible spawn-to-painted deltas at floating-point zero but retains a red initial-authority diagnostic (52/53) caused by comparing its tracked Drifter-era `scale=1` authority baseline with the current default whole-art root (`scale≈0.7295`); no B17 diff touches its probe, server authority, projectile geometry, muzzle definitions, or weapon transform. Per the order, this diagnostic was not “fixed” by changing geometry or weakening its `3 px` threshold; the user-specified unit + measured live-idle-parts acceptance remains green.

## Evidence

- Machine measurements: `docs/owner-notes-audit-v10-evidence/b17-idle-hand/live-capture.json`
- Legacy/pre captures: `docs/owner-notes-audit-v10-evidence/b17-idle-hand/pre/` (42 PNGs)
- Facing-side/post captures: `docs/owner-notes-audit-v10-evidence/b17-idle-hand/post/` (42 PNGs)
- Representative visual audit: sheriff/Rattler RIGHT moves from the real negative authored socket on the far side to a visible mirror guard beyond the facing torso edge; witch/Hellmouth LEFT retains the glove owner while its classified idle hand satisfies the same canonical target and one-root-mirror law.

## Files touched

- Schema/catalog/codegen: `packages/shared/src/weapons.ts`, `data/weapon-concepts-300.json`, `tools/artkit/gen-weapon-expansion.mjs`, `packages/shared/src/weapons-expansion.generated.ts`
- Pose/runtime: `packages/client/src/sprites/pose-language.ts`, `packages/client/src/entities/SpriteRig.ts`
- Laws: `packages/client/src/sprites/pose-language.test.ts`, `packages/client/src/entities/SpriteRig.idle-parts.test.ts`, `tests/data-consistency.test.ts`
- Live gate/report/evidence: `e2e/tests/b17-idle-parts-live-gate.spec.ts`, `docs/sol-reports/impl-b17.md`, `docs/owner-notes-audit-v10-evidence/b17-idle-hand/live-capture.json`, and the grouped `pre/` + `post/` PNG sets

Verdict: universal facing-side rule in place; five-pose vocabulary wired; `poseLanguage` schema added; semantic classifier covers every visible hand; evidence retained at `docs/owner-notes-audit-v10-evidence/b17-idle-hand/`; files touched are the schema/catalog/codegen, pose/runtime, focused laws, live gate, report, and evidence paths listed above.
