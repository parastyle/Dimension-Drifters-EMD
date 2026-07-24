# Ember Fire Tornado VFX — implementation report

## Plan

1. Review the shipped `tools/artkit/harvest-install.mjs` interface and the existing VFX asset conventions.
2. Generate exactly one VFX-only subject with the supplied prompt, unchanged.
3. Harvest/install the generated image to `packages/client/public/sprites/vfx-tornado-ember-fire/part-1.png`.
4. Verify native dimensions are greater than 200x200 and less than 2048x2048, then run the shipped chroma keyer and inspect the keyed result for clean edges and green spill.
5. Append generation, installation, and verification evidence here; commit only the PNG and this report.

## Generation prompt

> VFX-only in-world sprite: a readable VERTICAL FIRE TORNADO / flame vortex funnel — a tapering
> spiral funnel (wide at TOP, narrow at BOTTOM) composed of layered orange-red-yellow flame bands
> spiraling upward, glowing ember flecks and short flame tongues licking off the spiral edges,
> molten-crack highlights, ~4-8 colours, gritty dark-comic cel treatment with hard outlines.
> Silhouette must READ as a spinning fire tornado at small scale. Flat #00ff00 background. No
> character, no weapon, no scenery — VFX subject only.

## Progress

- Generated exactly one subject with the supplied prompt passed verbatim through the built-in image-generation path.
- Visually approved the source as a vertical spinning fire funnel: wide at the top, narrow at the bottom, layered orange/red/yellow spiral bands, ember flecks, flame tongues, molten-crack highlights, and hard dark-comic outlines.
- Confirmed there is no character, weapon, scenery, chain, rope, tassel, or dangling ribbon element.
- The shipped ArtKit chroma keyer removed 73.8% of the 1024x1536 source canvas.
- Reran the shipped connected-component slicer with its documented `--minAreaPct=0.5` option so detached ember specks did not become additional installed sprite files; the tornado resolved to exactly one 742x1217 component.
- Installed with `tools/artkit/harvest-install.mjs --ids=vfx-tornado-ember-fire --kind=weapon --weapon-target=768 --post-key=1`; the post-resize key pass removed the remaining 0.1% keyable edge pixels.
- Restored ArtKit's generated manifest and atlas outputs after installation. The final worktree scope contains only this report and the requested PNG.

## Verification

- Final PNG: 468x768 RGBA, 445,935 bytes; both dimensions are greater than 200 and less than 2048.
- Alpha/keying audit: all four corners are transparent; 194,956 fully transparent pixels; 13,370 semi-transparent edge pixels; zero visible exact-`#00ff00` pixels; zero visible pixels matching the shipped keyer's keyable-green predicate; zero visible green-dominant pixels.
- Visual review: the keyed sprite retains a clean, readable tapered tornado silhouette with the flame spiral and molten-crack detail intact at small scale.
- Installed directory contains exactly one file: `part-1.png`.
- No manifest entry, weapon-concept row, shared generated file, character, weapon, or scenery was added.

VERDICT: PASS — subject id `vfx-tornado-ember-fire`; PNG path `packages/client/public/sprites/vfx-tornado-ember-fire/part-1.png`; prompt used: "VFX-only in-world sprite: a readable VERTICAL FIRE TORNADO / flame vortex funnel — a tapering spiral funnel (wide at TOP, narrow at BOTTOM) composed of layered orange-red-yellow flame bands spiraling upward, glowing ember flecks and short flame tongues licking off the spiral edges, molten-crack highlights, ~4-8 colours, gritty dark-comic cel treatment with hard outlines. Silhouette must READ as a spinning fire tornado at small scale. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only."; pixel dimensions: 468x768.
