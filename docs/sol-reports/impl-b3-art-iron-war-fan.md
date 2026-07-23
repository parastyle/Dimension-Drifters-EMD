# Iron War Fan art implementation

## Plan

1. Inspect the shipped ArtKit harvest/install workflow and representative weapon sprites.
2. Generate exactly one `x2-iron-war-fan` source from the mandated prompt.
3. Install `part-1.png`, then verify its dimensions, chroma key, silhouette, and right-facing orientation.
4. Add one weapon manifest entry and one `_stub: true` concept row without behavior wiring.
5. Run static checks and `pnpm typecheck`, inspect the scoped diff, and commit the completed art-only change.

## Implementation

- Generated exactly one subject with the mandated prompt using the built-in image-generation path.
- Copied the 1536×1024 candidate to `tools/artkit/out/x2-iron-war-fan/identity-ref.png`.
- Ran the repository chroma keyer and weapon slicer. The keyer removed 76.7% of the canvas, and the slicer found exactly one connected 833×864 weapon part.
- Installed through `node tools/artkit/harvest-install.mjs --ids=x2-iron-war-fan --kind=weapon --post-key=1`. ArtKit presized the part to 247×256, regenerated the sprite manifest, and repacked the atlas.
- Added only the requested minimal `_stub: true` concept row. Behavior, stats, performance, weapon definitions, and generator outputs remain unmodified for the catalog integrator.

## Verification

- Visual inspection: PASS — one open iron tessen, rigid handle/ring on the left, open armored fan blades on the right, no character, wind, scene, chain, tassel, rope, or detached element.
- Chroma-key inspection: PASS — RGBA output with zero green-dominant and zero keyable-green pixels at nonzero alpha.
- Native-size gate: PASS — 247×256, greater than 200×200 and less than 2048×2048.
- `pnpm assets:check`: PASS — 437 sprite entries, 842 parts, 351 loose expansion parts, and 491 atlas frames.
- `pnpm typecheck`: PASS across shared, client, and server.
- No live stack was started, and `pnpm gen` was intentionally not run.

Verdict: `x2-iron-war-fan` PASS; PNG `packages/client/public/sprites/x2-iron-war-fan/part-1.png`; prompt used: "Weapon-only in-world sprite: a folding iron war fan (tessen) in OPEN configuration — steel ribs, blackened iron guards, riveted spine, subtle etched motif on the fan surface. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the open fan blades to the RIGHT. Flat #00ff00 background. No character, no wind."; pixel dimensions: 247×256.
