# B9 — Weapon visual size and image orientation

## Size and facing datum system

- The four requested size changes are presentation-only weapon sprite lengths. Their gameplay damage, range, and collision reach must remain unchanged.
- Source-of-truth catalog edits belong in `packages/shared/src/weapons.ts` and `data/weapon-concepts-300.json`; generated catalog output will be refreshed with `pnpm gen`.
- Prismhex will keep its existing image asset. Its correction will use stable sprite/facing metadata consumed by the rig so horizontal image mirroring composes deterministically with left/right actor facing and never rotates the artwork upside down.

## Implementation plan

1. Trace weapon length generation, asset manifest metadata, and the SpriteRig facing transform.
2. Add the four exact visual lengths and a stable Prismhex horizontal mirror datum at the narrowest reusable layer.
3. Add exact catalog/gameplay invariance tests plus asset-dimension and two-facing pose tests.
4. Regenerate, run catalog and asset checks, typecheck, and the full test suite.
5. Run the app on private ephemeral ports and retain before/after bounding-box and both-facing Prismhex evidence under `docs/owner-notes-audit-v9-evidence/b9-size/`.
6. Append verification results and the final per-weapon verdict, then commit on `sol/b9-size`.

## Baseline live capture

- The real client/server stack booted on private ephemeral client port `51526` and game port `51525`; owner ports `5180` and `2567` were not used.
- Before oriented bounding-box lengths were measured from the live weapon image transforms: Idol `147.8269px`, Dervish `117.8792px`, Mournveil `279.2491px`, and Gravewind `54.0000px`.
- Prismhex was captured facing right and left with the unchanged source asset (`256x162`). Its local X scale was positive on both facings, establishing the pre-fix image orientation.
- Durable baseline measurements and screenshots are in `docs/owner-notes-audit-v9-evidence/b9-size/before-measurements.json` and the adjacent `before-*.png` files.

## Implementation checkpoint

- Catalog presentation lengths are now Idol `207.2`, Dervish `236`, Mournveil `364`, and Gravewind `108`.
- Because existing shared code also used `displayLength` to floor melee reach and place canonical gun muzzles, each B9 size order now retains its old length in optional `collisionLength`. Shared melee, muzzle, and blade-extension authority consume `collisionLength ?? displayLength`; the client rig continues to render from `displayLength`.
- Prismhex retains the exact installed `256x162` PNG (SHA-256 `6bb02a389afce46517ca621e5a62456fc55f8561367d3c5eb06424e6304336f3`). Manifest metadata declares `imageFacing: "mirror-x"`; SpriteRig composes that local X sign once at the final art seam and never applies it to Y.
- `pnpm gen` completed after installing Artkit's already-locked local dependencies. Unrelated environment-dependent generated churn was rejected; only the weapon expansion catalog remains changed.
- Focused B9 and generator-consistency tests: `380 passed`.

## Final verification

- The clean post-change live gate passed on private ephemeral client port `59342` and game port `59341`. The owner ports `5180` and `2567` were not used.
- Live oriented bounding-box length ratios were Idol `1.399637x`, Dervish `1.999547x`, Mournveil `1.301689x`, and Gravewind `2.000000x`; thickness ratios were `1.399984x`, `1.999923x`, `1.300024x`, and `2.000000x`. Every measurement is within 1% of the ordered multiplier.
- Prismhex's live local image scale was `(-0.3515625, +0.3515625)` facing both right and left. Its root-facing determinant changed sign exactly once between actor facings, proving the painted image mirror composes with the rig mirror while Y stays upright. The right/left screenshots retain the exact source bitmap and show the thumb on the corrected hand side.
- `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, and `pnpm typecheck` completed successfully.
- `pnpm test` completed with `143` test files and `1823` tests passing. The real Colyseus transport integration test also booted on an ephemeral port.
- `pnpm exec playwright test e2e/tests/b9-size-facing-live-gate.spec.ts --workers=1` completed with `1 passed`.

Verdict: Idol of the Pale Verdict PASS (`148 -> 207.2`, `1.4x`); Dervish Greatblade PASS (`118 -> 236`, `2x`); Mournveil Scythe PASS (`280 -> 364`, `1.3x`); Gravewind Rimfire PASS (`54 -> 108`, `2x`); Prismhex Diffraction Gauntlet PASS (stable horizontal mirror, corrected thumb/hand alignment facing right and left, upright on both); evidence paths: `docs/owner-notes-audit-v9-evidence/b9-size/before-measurements.json`, `docs/owner-notes-audit-v9-evidence/b9-size/after-measurements.json`, and adjacent `before-*.png`/`after-*.png`; files touched: `data/weapon-concepts-300.json`, `packages/shared/src/weapons.ts`, `packages/shared/src/weapons-expansion.generated.ts`, `packages/shared/src/hit-envelope.ts`, `tools/artkit/gen-weapon-expansion.mjs`, `tests/data-consistency.test.ts`, `packages/client/src/sprites/manifest.ts`, `tools/artkit/harvest-install.mjs`, `packages/client/src/entities/SpriteRig.ts`, `tests/b9-weapon-size-facing.test.ts`, `e2e/tests/b9-size-facing-live-gate.spec.ts`, `docs/owner-notes-audit-v9-evidence/b9-size/*`, `docs/sol-reports/impl-b9-size.md`.
