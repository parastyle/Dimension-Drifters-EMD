# Unicorn Rainbow Beam art implementation

Subject id: `x2-unicorn-rainbow-beam`

Plan:

1. Generate only the Unicorn Rainbow Beam weapon through the shipped ArtKit workflow with the required prompt unchanged.
2. Inspect the generated side-profile sprite for right-facing orientation, weapon-only content, prohibited flexible elements, palette/readability, and a uniform `#00ff00` field.
3. Chroma-key and slice the selected source, then install `part-1.png` through `tools/artkit/harvest-install.mjs`.
4. Add one weapon manifest entry and one `_stub: true` concept row without implementing behavior.
5. Run image-dimension, chroma-key, JSON, asset, and TypeScript checks; review the art-only diff; commit on `sol/b2-art-unicorn-rainbow-beam`.

Generation prompt:

> Weapon-only in-world sprite: a compact chrome/pearl unicorn-horn beam emitter wand held like a pistol grip — twisted spiral horn muzzle mounted on a small pearl-white/gold housing with iridescent trim, gritty dark-comic cel treatment. Flat orthographic side profile, ~4–8 colours, faces RIGHT with horn tip to the RIGHT. Flat #00ff00 background. No character, no beam projectile in the sprite, no scenery.

Implementation:

- Generated one Unicorn Rainbow Beam source with the prompt above, unchanged.
- Chroma-keyed the source with the shipped ArtKit keyer; 83.0% of the source canvas was removed.
- Visually approved the keyed preview: weapon-only, orthographic side profile, horn tip facing right, no projectile, no scene, and no flexible dangling elements.
- Sliced exactly one connected weapon component and installed it with `harvest-install.mjs` at a 384-pixel long-side target.
- Added exactly one generated manifest entry and one `_stub: true` concept row with empty behavior/stat placeholders.

Verification:

- Installed PNG: 384×217 RGBA, 62.47% transparent canvas, all four corners transparent.
- Green-fringe scan: 0 visible green-dominant pixels.
- `node tools/artkit/check-assets.mjs`: passed (437 sprite entries / 842 parts).
- Concept JSON: parsed; declared and actual counts are both 325; exactly one matching stub.
- LF scan: no carriage returns in touched text files.
- `pnpm typecheck`: passed.

VERDICT: `x2-unicorn-rainbow-beam` — PNG `packages/client/public/sprites/x2-unicorn-rainbow-beam/part-1.png` — prompt used: "Weapon-only in-world sprite: a compact chrome/pearl unicorn-horn beam emitter wand held like a pistol grip — twisted spiral horn muzzle mounted on a small pearl-white/gold housing with iridescent trim, gritty dark-comic cel treatment. Flat orthographic side profile, ~4–8 colours, faces RIGHT with horn tip to the RIGHT. Flat #00ff00 background. No character, no beam projectile in the sprite, no scenery." — 384×217 pixels.
