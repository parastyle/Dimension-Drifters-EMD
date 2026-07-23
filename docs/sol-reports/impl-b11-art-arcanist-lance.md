# impl-b11-art-arcanist-lance

## Plan

1. Inspect the shipped ArtKit harvest/install conventions and nearby weapon sprite assets.
2. Generate exactly one Arcanist Lance VFX subject with the required verbatim prompt.
3. Install the selected chroma-key source as `packages/client/public/sprites/vfx-arcanist-lance/part-1.png`.
4. Add only the `vfx-arcanist-lance` weapon manifest entry and `_stub: true` concept row.
5. Verify dimensions, green-background keying, syntax, typecheck, changed-file scope, and LF endings.
6. Commit the completed art-only change on `sol/b11-art-arcanist-lance`.

## Generation and installation

- Used the image-generation skill and generated exactly one subject with the owner-supplied prompt unchanged.
- Accepted the single candidate after visual review: VFX-only, right-facing spear-tip silhouette, arcane-blue/indigo/white runic construction, glyph-marked shaft segments, sparks, tapering rear trail, and no character, weapon body, scenery, or banned flexible element.
- Staged the generated `1536×1024` green-field source in ArtKit. The shipped chroma-key guard removed 90.2% of the source field.
- The shipped slicer found exactly one connected `1370×334` weapon component and emitted `part-1.png`.
- Installed through `tools/artkit/harvest-install.mjs` with its post-key and atlas-pack steps. Presizing was disabled because the common brief requires the finished PNG to be greater than `200×200` native.
- Added exactly one `kind: "weapon"` sprite manifest entry and one behavior-empty `_stub: true` concept row. No behavior definitions, weapon definitions, generators, or live-stack files were changed.

## Verification

- Installed PNG: `1370×334` RGBA, 67.34% transparent pixels, all four corners transparent.
- Chroma QA: zero visible pixels matching the shipped keyable-green predicate and zero visible green-dominant pixels.
- Manifest QA: one part named `part-1.png`, zero offsets, and geometry matching the installed PNG.
- Atlas QA: frame count increased from 491 to 492; the sole added frame is `vfx-arcanist-lance/part-1`; no existing frame was removed.
- Concept QA: declared count and actual row count are both 335; exactly one matching stub; empty `behavior` and `stats`; prompt equality is exact.
- `pnpm typecheck`: passed.
- `pnpm assets:check`: passed with 447 sprite entries, 852 parts, and 492 atlas frames.
- `git diff --check`: passed.
- LF-only scan: zero carriage returns in every touched text file.

VERDICT: PASS — `vfx-arcanist-lance` — PNG `packages/client/public/sprites/vfx-arcanist-lance/part-1.png` — prompt used: "VFX-only in-world sprite: an authored spear-tip magical PROJECTILE — a sharp arcane lance-head made of layered arcane-blue/indigo runic energy with sparks + a faint tapering trail behind it, glyph-marked energy segments along the shaft. Reads as a distinct staff-cast lance projectile at small scale, not a generic beam. Gritty dark-comic cel, ~4-8 colours (blue/indigo/white). Flat #00ff00 background. No character, no weapon body, no scenery — VFX subject only." — 1370×334 pixels.
