# Bubble Wand Swarm Caster Art Sol Report

## Plan

1. Inspect the shipped ArtKit generation, chroma-key, slicing, and install conventions plus comparable weapon sprites.
2. Generate exactly one subject with the required prompt: `x2-bubble-wand-swarm-caster`.
3. Inspect the generated sprite for weapon-only composition, right-facing orientation, an up-and-right ring loop, flat `#00ff00`, and the absence of characters, bubbles, or flexible dangling elements.
4. Run the shipped chroma-key and harvest/install pipeline to produce `packages/client/public/sprites/x2-bubble-wand-swarm-caster/part-1.png` and its manifest geometry.
5. Add one `_stub: true` concept row without behavior wiring.
6. Verify dimensions, keyed edges, manifest/JSON syntax, the static asset checks, and `pnpm typecheck`.
7. Commit only the subject art, manifest/atlas outputs required by the pipeline, concept stub, and this report.

## Generation prompt

> Weapon-only in-world sprite: a caster's bubble-wand — long tapered handle with a large ringed loop at the top (aluminium or bone frame), coated in bubble-film residue. Held like a staff/wand. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the ring loop UP-AND-RIGHT. Flat #00ff00 background. No character, no bubbles.

## Progress

- Plan recorded before generation.
- Generated three takes of the single requested subject through the isolated ArtKit/Codex image backend.
- Selected candidate 2 because it is one rigid connected weapon with a readable ring silhouette and no character, bubbles, rope, chain, tassel, or dangling element. Rejected candidate 1 for a banned dangling cord detail and candidate 3 for an unrequested skull-like pommel.
- Normalized the selected source to a flat exact `#00ff00` 1024×1024 intake canvas before running the shipped chroma-keyer.
- Shipped keyer removed 84.1% of the intake canvas. The shipped slicer found exactly one connected weapon part.
- Installed through `tools/artkit/harvest-install.mjs` with post-keying and a 300 px weapon target so both native output dimensions satisfy the brief.
- Added the generated one-part weapon manifest geometry and a `_stub: true` concept row with empty `stats` and `behavior`.

## Verification

- Final PNG: RGBA, 300×221, 59,239 bytes.
- Alpha: all four corners transparent; 46,639 transparent pixels; no visible exact-green pixels and no near-green fringe pixels.
- Install directory contains only `part-1.png`.
- Manifest contains `x2-bubble-wand-swarm-caster` as `kind: "weapon"` with exactly one `part-1`.
- Concept JSON parses, contains 325 rows, matches its `count`/`byType` census, and preserves the exact prompt in the stub.
- LF-only verified for every touched text file.
- `pnpm typecheck`: pass.
- `pnpm assets:check`: pass (437 sprite entries / 842 parts; 351 expansion parts checked loose).
- Focused `data-consistency` census unit test: pass.
- `git diff --check`: pass.

VERDICT: x2-bubble-wand-swarm-caster | PNG: packages/client/public/sprites/x2-bubble-wand-swarm-caster/part-1.png | Prompt: "Weapon-only in-world sprite: a caster's bubble-wand — long tapered handle with a large ringed loop at the top (aluminium or bone frame), coated in bubble-film residue. Held like a staff/wand. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the ring loop UP-AND-RIGHT. Flat #00ff00 background. No character, no bubbles." | Dimensions: 300×221 px
