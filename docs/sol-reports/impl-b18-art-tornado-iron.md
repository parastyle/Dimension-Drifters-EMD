# Iron Gale Tornado VFX

## Plan

1. Generate exactly one VFX-only vertical iron tornado on a flat `#00ff00` background using the shipped ArtKit workflow and the required prompt verbatim.
2. Harvest and install the selected result at `packages/client/public/sprites/vfx-tornado-iron-gale/part-1.png`.
3. Verify clean chroma keying with the shipped keyer, confirm native dimensions are greater than 200x200 and less than 2048x2048, and inspect the subject for silhouette and prompt compliance.
4. Append generation and verification evidence here, then commit only the PNG and this report.

## Implementation

- Generated exactly one VFX subject through the built-in image-generation path with the required prompt verbatim.
- Staged the generated 1024x1536 green-screen source as `tools/artkit/out/vfx-tornado-iron-gale/identity-ref.png`.
- Ran the shipped ArtKit chroma keyer, which removed 69.1% of the source canvas.
- Ran the shipped ArtKit slicer as a one-part VFX sprite. It found exactly one qualifying connected component and produced `part-1.png`.
- Installed through `tools/artkit/harvest-install.mjs` with full-resolution preservation and the pinned post-install keying pass. Restored the generated shared manifest and atlas to their pre-harvest state so the only tracked art deliverable is the requested PNG.

## Verification

- Visual inspection: PASS - one vertical tornado funnel, wide at the top and narrow at the bottom, with layered slate/gunmetal bands, silver slash highlights, hard dark-comic outlines, and dark debris flecks caught in the spiral; no character, weapon, scenery, chain, tassel, rope, or ribbon element.
- Native-size gate: PASS - 839x1380, with both dimensions greater than 200 and less than 2048.
- Chroma-key inspection: PASS - RGBA PNG, all four corners transparent, 58.48% transparent pixels, zero visible keyable-green pixels, and zero visible green-dominant pixels after the shipped post-install keyer.
- File integrity: SHA-256 `c22667e8faa6c1b836ece523601bd07347ba70034bb594fff30d11942c2a47de`.
- Scope and hygiene: PASS - only the PNG and this report are tracked changes; `git diff --check` passes; no manifest, concept row, shared/generated file, or live stack was touched in the final diff.

Verdict: `vfx-tornado-iron-gale` PASS; PNG `packages/client/public/sprites/vfx-tornado-iron-gale/part-1.png`; prompt used: "VFX-only in-world sprite: a readable VERTICAL TORNADO / whirlwind funnel of grey steel wind — a tapering spiral funnel (wide at TOP, narrow at BOTTOM) composed of layered slate-grey and gunmetal wind bands with silver slash-streak highlights, small dark debris flecks caught in the spiral, ~4-6 colours, gritty dark-comic cel treatment with hard outlines. Silhouette must READ as a spinning tornado funnel at small scale. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only."; pixel dimensions: 839x1380.
