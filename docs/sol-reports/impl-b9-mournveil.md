# B9 Amendment — Mournveil Scythe Restoration

## Understanding

Restore only the `x2-mournveil-scythe` held/carry sprite at source resolution suitable for its already-approved 364 px display length. Preserve the authored silhouette, blade curve, grip, colorway, pose language, DPS, range, cadence, and `collisionLength`. Install through `tools/artkit/harvest-install.mjs` so the asset, atlas, manifest, and pose registration remain coherent. Pets and all other subjects are out of scope.

## Plan

1. Capture the current Mournveil asset, manifest geometry, pose registration, display length, and `collisionLength` as the registration baseline.
2. Produce one higher-resolution restoration of the existing scythe without restyling it.
3. Install the restoration through the shipped harvest/install pipeline.
4. Verify grip and blade-edge registration against the baseline within 1 px, and add a focused regression test covering display length, collision length, and anchor tolerance.
5. Run `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, and the full `pnpm test`; inspect the final diff for LF-only, Mournveil-only scope; commit on `sol/b9-mournveil-art`.

## Implementation

- Captured the pre-restoration shipped bitmap and manifest baseline: 256×128 part, 261×261 canvas, body/part centroid `(171.22, 128)`, `displayLength: 364`, and `collisionLength: 280`.
- Used the built-in image-generation edit path once, with the existing Mournveil part as the edit target and exact silhouette/color/grip preservation as invariants. The model candidate was used only as a high-frequency restoration source: its low-frequency color and geometry were discarded, while the authored bitmap supplied RGB/color placement and the exact alpha boundary.
- Built a 1456×728 keyed master on a 1484×1484 canvas, ran the repository's canonical chroma keyer and connected-component slicer, then installed with:

  `node tools/artkit/harvest-install.mjs --ids=x2-mournveil-scythe --kind=weapon --weapon-target=728`

- The shipped pipeline Lanczos-presized the master by 0.5 to a 728×364 part, regenerated `manifest.ts`, and repacked the shipped sprite atlas. The x2 runtime continues to use its registered loose part; the atlas pack completed successfully without unrelated tracked atlas drift.
- No pose, weapon definition, gameplay, or pet file changed.

## Pixel registration

- Native density increased from `256 / 364 = 0.7033` to `728 / 364 = 2.0` source pixels per displayed pixel, a 2.84375× source-density restoration.
- Center grip is `(182, 91)` in 364×182 display space before and after: `0 px` delta on both axes.
- Blade edges remain `-182 px` and `+182 px` from the center grip: `0 px` delta at both ends.
- Normalized manifest centroid delta at display scale is `-0.1292 px` X and `-0.4379 px` Y. Normalized manifest width/height deltas are `0.1053 px` and `0.0526 px`. All are within the required 1 px tolerance.
- Numeric proof: `docs/owner-notes-audit-v9-evidence/b9-mournveil-restoration/registration.json`.
- Visual proof at the unchanged 364 px presentation: `docs/owner-notes-audit-v9-evidence/b9-mournveil-restoration/comparison.png`.

## Generated-art prompt

Built-in image edit prompt, normalized to the production constraints: reconstruct the exact same single Mournveil twin-crescent scythe at substantially higher native resolution; preserve the source silhouette, blade curves, proportions, shaft thickness, center grip, left/right orientation, transparent bounds, gritty dark-comic cel treatment, and off-white/silver/bone/tan/charcoal palette; render one fully visible weapon only on a flat `#00ff00` field; add no character, prop, text, glow, particle, shadow, reflection, or scenery. The installed result retains only high-frequency restoration detail from this render.

## Verification

- Focused B9 test: 14/14 passed after generation.
- `pnpm gen`: passed. The scratch-dependent VFX subject projection was restored to its tracked baseline after the run; it is not part of this amendment.
- `pnpm gen:check`: passed (the existing fresh-worktree VFX reference check reported its documented skip for unavailable untracked references).
- `pnpm typecheck`: passed across shared, client, and server.
- Full `pnpm test`: 153 test files passed, 1,984 tests passed. The first fresh-worktree run identified ignored ArtKit test prerequisites (`pngjs`, orientation report, and preview actors); after provisioning those ignored inputs, the complete command passed without product changes.
- `pnpm assets:check`: passed with 436 sprite entries, 841 parts, 350 loose expansion parts, and 491 atlas frames.
- `git diff --check`: passed. Explicit CRLF scan of all changed text files returned `crlf: []`.
- Final tracked scope: the Mournveil part, its generated manifest row, the focused B9 regression test, this report, and the four-file restoration evidence bundle.

Verdict: restoration installed; pixel registration proof: grip/blade edges 0 px delta and normalized manifest anchors ≤0.438 px delta; files touched: `packages/client/public/sprites/x2-mournveil-scythe/part-1.png`, `packages/client/src/sprites/manifest.ts`, `tests/b9-weapon-size-facing.test.ts`, `docs/sol-reports/impl-b9-mournveil.md`, and `docs/owner-notes-audit-v9-evidence/b9-mournveil-restoration/*`; evidence path: `docs/owner-notes-audit-v9-evidence/b9-mournveil-restoration/registration.json`.
