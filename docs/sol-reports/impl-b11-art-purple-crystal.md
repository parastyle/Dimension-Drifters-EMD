# impl-b11-art-purple-crystal

## Plan

- Generate only `vfx-purple-crystal-family` with the exact owner-supplied prompt.
- Inspect the source for a dense family of six-to-twelve irregular violet/amethyst shards, overlapping depth, cracked edges, refractive highlights, a flat `#00ff00` background, and no character, weapon, scenery, perfect circles, or ring-shaped bursts.
- Key and slice the approved source through the shipped ArtKit guards, then install it with `tools/artkit/harvest-install.mjs`.
- Add one `vfx-purple-crystal-family` weapon manifest entry through the harvester and one `_stub: true` concept row with behavior fields left blank for the catalog integrator.
- Verify native PNG dimensions, clean chroma keying, JSON/TypeScript syntax, `pnpm typecheck`, scoped git diff, LF endings, and commit on `sol/b11-art-purple-crystal`.

## Generation prompt

"VFX-only in-world sprite: a dense CLUSTERED FAMILY of jagged violet/amethyst crystal shards + bursts — no perfect circles, no ring-shaped bursts. Six-to-twelve angular geode-fragments of varying size scattered in a controlled radial spread, translucent purple cores with cracked edges, small refractive white highlights. Some fragments overlap for depth. Gritty dark-comic cel. ~4-8 colours in the violet family. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only."

## Progress

- Plan recorded before generation.
- Generated exactly one candidate with the owner-supplied prompt unchanged through the built-in image-generation path.
- Staged the 1254×1254 source at ArtKit's ignored `tools/artkit/out/vfx-purple-crystal-family/identity-ref.png` intake.
- Visually approved eight major angular amethyst/geode clusters plus smaller splinters, overlapping central depth, cracked edges, refractive highlights, and the absence of circles, rings, character, weapon, and scenery.
- The shipped chroma-key guard removed 67.8% of the source plate.
- Preserved the intentionally disconnected fragment family as one composited `part-1` ArtKit source, then installed it with `harvest-install.mjs --ids=vfx-purple-crystal-family --kind=weapon --weapon-target=384 --post-key=1`.
- ArtKit presized the 1075×1143 keyed family by 0.34 to 361×384, added one weapon manifest entry, post-keyed the resized edge, and repacked the sprite atlas.
- Added one `vfx-purple-crystal-family` `_stub: true` concept row with empty `stats` and `behavior` placeholders; the declared count, row count, and per-type counts remain consistent.

## Verification

- Installed PNG: 361×384 RGBA, transparent at all four corners, 47.73% visible-pixel coverage, zero residual keyable-green pixels, and zero green-dominant nontransparent pixels.
- Manifest: exactly one `vfx-purple-crystal-family` entry and one `part-1.png` part; manifest and installed PNG dimensions match.
- Atlas: exactly one `vfx-purple-crystal-family/part-1` frame; `pnpm assets:check` passes with 447 sprite entries and 492 atlas frames.
- Concept data: exactly one matching `_stub: true` row; `stats` and `behavior` are empty; declared count and row count are both 335; the supplied prompt matches exactly.
- `pnpm typecheck`: pass.
- `git diff --check`: pass.
- LF-only touched text: pass.

Verdict: PASS — `vfx-purple-crystal-family` — `packages/client/public/sprites/vfx-purple-crystal-family/part-1.png` — prompt: "VFX-only in-world sprite: a dense CLUSTERED FAMILY of jagged violet/amethyst crystal shards + bursts — no perfect circles, no ring-shaped bursts. Six-to-twelve angular geode-fragments of varying size scattered in a controlled radial spread, translucent purple cores with cracked edges, small refractive white highlights. Some fragments overlap for depth. Gritty dark-comic cel. ~4-8 colours in the violet family. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only." — 361×384 px
