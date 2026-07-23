# Fire Dragon VFX Art Sol Report

Subject id: `vfx-fire-dragon`

## Plan

1. Inspect the shipped ArtKit generation, chroma-key, slicing, and install conventions plus comparable VFX sprites.
2. Generate exactly one Fire Dragon VFX subject with the required prompt unchanged.
3. Inspect the generated source for an eastern serpentine dragon sweep, a right-leading horned and fanged head, layered flame filaments, trailing smoke, a readable small-scale silhouette, a flat `#00ff00` field, and no character, weapon, scenery, or banned dangling element.
4. Run the shipped ArtKit chroma-key, slice, and `harvest-install.mjs` workflow to install `packages/client/public/sprites/vfx-fire-dragon/part-1.png` and the generated one-part weapon manifest geometry.
5. Add one `_stub: true` weapon-concept row with behavior fields left blank for the catalog integrator.
6. Verify dimensions, alpha/keyed edges, one-part manifest/JSON syntax, LF endings, static asset checks, and `pnpm typecheck`.
7. Review the art-only diff and commit the isolated changes on `sol/b11-art-fire-dragon`.

## Generation prompt

> "VFX-only in-world sprite: a readable EASTERN-style flaming dragon SWEEP — long serpentine dragon body composed of layered orange-yellow-red flame filaments trailing into smoke, ~4-8 colours, dragon's head at the LEADING edge (RIGHT) with fanged jaws + horns, body coiling behind. Semi-transparent flame plumes at the tail. Silhouette must READ as a dragon at small scale. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only."

## Progress

- Plan recorded before generation.
- Generated exactly one Fire Dragon VFX source with the required prompt unchanged, using the built-in image-generation path and harvesting the result into the shipped ArtKit workspace.
- Visually approved the source and keyed preview: the silhouette remains an eastern serpentine dragon at small scale; the horned, fanged head leads on the right; the orange/yellow/red filament body coils behind into smoke-softened flame; and there is no character, weapon, scenery, chain, rope, tassel, or other dangling element.
- The shipped chroma-keyer removed 75.6% of the source canvas.
- The shipped slicer found exactly one connected effect component at 1475×531 before presizing.
- Installed with `harvest-install.mjs --ids=vfx-fire-dragon --kind=weapon --weapon-target=768 --post-key=1`; ArtKit produced one 768×276 part, merged the generated manifest entry, and repacked the runtime atlas.
- Added exactly one `_stub: true` weapon-concept row with empty `stats` and `behavior` placeholders. No weapon behavior, weapon definition, or generator logic was changed.

## Verification

- Final PNG: 768×276 RGBA, 376,995 bytes; both dimensions are greater than 200 and less than 2048.
- Alpha/keying: all four corners transparent; 97,722 transparent pixels; 22,083 semi-transparent pixels; zero visible exact-`#00ff00` pixels; zero visible green-dominant fringe pixels.
- Small-scale review: the 192 px-wide downsample still reads as a coiled dragon with its head leading right.
- Manifest: exactly one `vfx-fire-dragon` entry, `kind: "weapon"`, with exactly one `part-1`.
- Atlas: exactly one frame added; no frames removed.
- Concept JSON: parses; declared and actual counts are both 335; the declared and actual type census is melee 127 / ranged 111 / caster 97; exactly one matching `_stub: true` row exists.
- `node tools/artkit/check-assets.mjs`: passed (447 sprite entries / 852 parts, 492 atlas frames).
- `pnpm typecheck`: passed.
- LF-only and `git diff --check`: passed for the touched text files.

VERDICT: PASS — subject id `vfx-fire-dragon`; PNG path `packages/client/public/sprites/vfx-fire-dragon/part-1.png`; prompt used: "VFX-only in-world sprite: a readable EASTERN-style flaming dragon SWEEP — long serpentine dragon body composed of layered orange-yellow-red flame filaments trailing into smoke, ~4-8 colours, dragon's head at the LEADING edge (RIGHT) with fanged jaws + horns, body coiling behind. Semi-transparent flame plumes at the tail. Silhouette must READ as a dragon at small scale. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only."; pixel dimensions: 768×276.
