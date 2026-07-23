# B16 One-Handed Glove / Idle-Hand Implementation Report

Date: 2026-07-23
Sol: `impl-b16`
Branch: `sol/b16-glove-hand`
Worktree: `C:/Users/Exped/ddv2-wt/b16-glove-hand`

## Understanding

B17 is the direct shipped dependency and remains authoritative for the `poseLanguage` schema, five-pose vocabulary, semantic hand-role classifier, absolute idle-hand target resolver, and universal facing-side post-condition. B16 is a narrow data-driven owner-note amendment:

- Ironbrand Heatfist (`x2-ironbrand-heatfist`) is a single equipped glove. Exactly one hand may be `action-owned`; the other must be `authored-idle`, resolve through `poseLanguage.idle`, and stay visibly on the facing side on both facings. Its combo, damage, quake, cadence, one-hand identity, grips, and geometry must not change.
- Hellmouth Palmcaster (`x2-hellmouth-palmcaster`) is the owner’s exemplar for the unused-hand defect. Its free hand must classify as `authored-idle` and use the panel-selected `casting-gesture`. If B17’s caster-family default already supplies that pose, B16 will document and test the default instead of adding redundant per-weapon data.
- No B17 vocabulary or facing transform is reimplemented. The only runtime amendments are the minimal glove-family classifier branch and monk-channel routing needed for the explicit Ironbrand idle datum; combat authority, projectile/muzzle geometry, six-part manifest offsets, pets, and unrelated pose-language behavior remain unchanged.

## Plan

1. Inspect B17’s generated catalog, family defaults, classifier predicates, integrated test seams, and live idle-parts gate.
2. Add the smallest required `data/weapon-concepts-300.json` override for Ironbrand; add a Hellmouth override only if the shipped caster default is semantically wrong.
3. Regenerate `packages/shared/src/weapons-expansion.generated.ts`.
4. Add focused laws covering both weapons across all three shipped whole-art prototypes and both facings: one action-owned hand, one authored-idle hand, selected idle pose, and strictly positive composed world-facing margin.
5. Run `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, and the full `pnpm test`.
6. Run the measured idle-parts gate on private ephemeral ports for Ironbrand and Hellmouth, both facings, on `proto-sheriff`; retain the capture pair and machine-readable measurements under `docs/owner-notes-audit-v10-evidence/b16-glove-hand/`.
7. Record exact evidence, files touched, unchanged combat/catalog fields, and commit the completed work on `sol/b16-glove-hand`.

## Ironbrand Heatfist

- Added generated-catalog `poseLanguage.idle: "mirror-guard"` to make the one-glove occupancy explicit. The override follows the panel’s raised fighting-guard vocabulary and keeps the unequipped hand intentional without converting Ironbrand into a glove pair.
- B17’s shipped classifier treated every worn `fists`-family weapon as an implicit pair before consulting the authored idle job. The minimal glove-family amendment recognizes an explicit idle pose on a 1H, non-dual, non-`glovePair` worn fist as single-glove occupancy. During an accepted action the lead/equipped hand is `action-owned` and the unequipped hand is `authored-idle`; terminal idle restores the equipped hand to its hard-mounted role. Explicit dual/paired state still has higher priority.
- The monk render lane now keeps authored off-hand beats on the equipped glove when an explicit idle hand exists, so no rear-hand punch channel is populated. True pairs and bare fists retain their existing alternating channels.
- Focused laws pin `grip: "1H"`, no `glovePair`, damage `6`, cooldown `0.6`, and quake `{ radius: 120, damage: 7 }`. The existing monk-lane and Coyote/Sparkknuckle paired-glove regressions remain green, so combo selection and cadence are unchanged.
- All three shipped whole-art prototypes (`proto-samurai`, `proto-sheriff`, and `proto-witch`) resolve the authored-idle hand through `mirror-guard` with positive composed world-facing margin for LEFT and RIGHT.

## Hellmouth Palmcaster

- B17 already classifies Hellmouth as `fist-gun`. That shipped family default resolves to `casting-gesture`, and its foot-family default resolves to `loose-plant`; therefore the existing per-weapon `casting-gesture`/`loose-plant` object was redundant.
- Removed the redundant Hellmouth `poseLanguage` object from source data and generated output. The focused law proves `poseLanguage.idle` is unauthored while `idleHandPoseFor` still resolves `casting-gesture`, with one hard-constrained weapon hand and one `authored-idle` hand.
- All three shipped whole-art prototypes resolve the unused hand with positive composed world-facing margin for LEFT and RIGHT. The live `proto-sheriff` fixture also records zero primary-grip-origin movement.

## Verification

- `pnpm gen` — PASS. The generator emitted the Ironbrand override and removed Hellmouth’s redundant override. Its unrelated VFX-subject cache side effect, caused by unavailable ignored reference art, was restored and is not part of B16.
- `pnpm gen:check` — PASS. In-scope generated files are synchronized; the command reports the expected skip for unavailable ignored VFX reference artifacts.
- Focused owner matrix — PASS, 4 files / 47 tests: B16 owner law, B17 pose language, integrated idle parts, and paired-glove regressions.
- `pnpm typecheck` — PASS for shared, client, and server.
- `pnpm test` — PASS, 153 files / 1,981 tests. The first run exposed two missing ignored `tools/artkit/out` test fixtures; canonical copies from the main worktree were supplied to the ignored cache and the unchanged full suite passed on two subsequent runs.
- `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/tests/b16-glove-hand-live-gate.spec.ts` — PASS on the final tree. The gate used private ephemeral game/Vite ports `65347/65348`, protected `2567/5180`, and retained 4 captures: 2 weapons × 2 facings on `proto-sheriff`.
- Final live summary: minimum world-facing margin `24.4949 px`, minimum visible torso-edge clearance `10.0833 px`, and maximum primary-grip-origin delta `0 px`.
- Changed-file Biome check — PASS with one pre-existing optional-chain warning outside the edited classifier block.
- `git diff --check` and LF-only text census — PASS.

## Evidence

- Machine-readable measurements: `docs/owner-notes-audit-v10-evidence/b16-glove-hand/live-idle-parts.json`
- Ironbrand: `proto-sheriff-x2-ironbrand-heatfist-right.png` and `proto-sheriff-x2-ironbrand-heatfist-left.png`
- Hellmouth: `proto-sheriff-x2-hellmouth-palmcaster-right.png` and `proto-sheriff-x2-hellmouth-palmcaster-left.png`

## Files touched

- Catalog/generated output: `data/weapon-concepts-300.json`, `packages/shared/src/weapons-expansion.generated.ts`
- Minimal B17 consumption seam: `packages/client/src/sprites/pose-language.ts`, `packages/client/src/entities/SpriteRig.ts`
- Focused laws/gate: `packages/client/src/entities/SpriteRig.b16-glove-hand.test.ts`, `e2e/tests/b16-glove-hand-live-gate.spec.ts`
- `docs/sol-reports/impl-b16.md`
- `docs/owner-notes-audit-v10-evidence/b16-glove-hand/live-idle-parts.json` and four paired-facing PNG captures

Verdict: Ironbrand single-glove occupancy proven; Hellmouth facing-side behavior proven; evidence retained under `docs/owner-notes-audit-v10-evidence/b16-glove-hand/`; files touched are the catalog/generated output, minimal B17 pose/runtime consumption seams, focused unit/live gates, report, and evidence paths listed above.
