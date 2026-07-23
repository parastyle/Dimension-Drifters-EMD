# impl-b3-art-ember-fan

## Plan

1. Inspect the shipped ArtKit harvesting/install workflow and comparable weapon sprite conventions.
2. Generate exactly one subject, Ember Fan (`x2-ember-fan`), using the required prompt verbatim.
3. Install `part-1.png`, then verify its dimensions, chroma-key quality, silhouette, and right-facing composition.
4. Add one weapon manifest entry and one `_stub: true` concept row without behavior implementation.
5. Run static checks, confirm LF endings and task-only scope, then commit the completed art-only change.

## Result

- Generated only Ember Fan from the required prompt.
- Ran the shipped `tools/artkit/guards/chroma-key.mjs` and `tools/artkit/harvest-install.mjs` workflow.
- ArtKit found one connected weapon part and installed a presized 256×215 PNG.
- Added one `x2-ember-fan` weapon entry to the sprite manifest.
- Added one behavior-empty `_stub: true` concept row and updated the dataset count.

## Verification

- Visual review: weapon-only open war fan, handle/pivot left, fan business-end right, no character, no dangling element, and no flame VFX.
- Chroma audit: all four corners transparent; 56.09% transparent pixels; zero visible keyable-green pixels; zero visible green-dominant pixels.
- Native dimensions: 256×215, within the required bounds.
- `node tools/artkit/check-assets.mjs`: passed.
- `pnpm typecheck`: passed.
- `git diff --check`: passed.
- Touched text files contain zero CRLF sequences.

VERDICT: `x2-ember-fan` | PNG: `packages/client/public/sprites/x2-ember-fan/part-1.png` | Prompt: "Weapon-only in-world sprite: an open war fan whose blades are forged from cooling ember-steel — dark iron ribs with glowing red-orange fissures along the fan blades, small charred edges, wooden pivot. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the open ember fan to the RIGHT. Flat #00ff00 background. No character, no flame VFX." | Dimensions: 256×215
