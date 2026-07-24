# Sol Report: Storm Lightning Tornado VFX

## Plan

1. Inspect the shipped ArtKit harvest/install and chroma-key conventions without booting the live stack.
2. Generate exactly one VFX-only storm lightning tornado using the supplied prompt verbatim.
3. Install the selected asset as `packages/client/public/sprites/vfx-tornado-storm-shock/part-1.png`.
4. Verify native dimensions are greater than 200x200 and less than 2048x2048, then run the shipped keyer and inspect for clean chroma-key edges.
5. Confirm the worktree contains only this report and the requested PNG, then commit both on `sol/b18-art-tornado-storm`.

## Progress

- Confirmed the worktree began clean on `sol/b18-art-tornado-storm`.
- Inspected the shipped chroma-key guard, connected-component slicer, and harvest installer. Because the installer also regenerates shared manifest and atlas files, this art-only run will reuse its `out/<id>/identity-ref.keyed.png` and `parts/part-1.png` conventions while installing only the requested PNG.
- Generated exactly one image subject with the supplied prompt unchanged and staged the selected render as `tools/artkit/out/vfx-tornado-storm-shock/identity-ref.png`.
- The initial guard invocation stopped before processing because this isolated worktree did not yet have ArtKit's locked `sharp` dependency installed.
- Restored ArtKit's locked dependencies with `npm ci`, then reran the shipped guards successfully.
- The shipped keyer removed 65.2% of the 1024x1536 green-screen canvas. The slicer selected the dominant connected tornado component as `part-1.png`; three detached incidental edge fragments were not installed.
- Applied the harvest installer's post-key convention (`--in-place=1 --preview=0 --despill=1`) and installed only the requested sprite PNG.

## Verification

- Visual inspection on charcoal, white, and magenta backgrounds confirms a readable vertical storm tornado with a wide cloud top, narrow funnel bottom, layered storm bands, lightning, hard comic outlines, and no character, weapon, scenery, chain, tassel, rope, or ribbon.
- Installed PNG is 901x1444 RGBA: both native dimensions are greater than 200 pixels and less than 2048 pixels.
- Chroma/alpha audit: four transparent corners; zero visible pixels matching the shipped keyer's keyable-green rule; zero green-dominant visible pixels; zero hidden RGB in fully transparent pixels; zero alpha-1-through-9 fringe pixels.
- The install directory contains only `part-1.png`.

VERDICT: subject id `vfx-tornado-storm-shock` | PNG path `packages/client/public/sprites/vfx-tornado-storm-shock/part-1.png` | prompt used: "VFX-only in-world sprite: a readable VERTICAL STORM TORNADO / thundercloud vortex funnel — a tapering spiral funnel (wide at TOP, narrow at BOTTOM) composed of layered deep-blue and slate-storm cloud bands spiraling upward, jagged white-cyan lightning bolts arcing across the funnel and crackling off its edges, faint rain-streak accents, ~4-8 colours, gritty dark-comic cel treatment with hard outlines. Silhouette must READ as a spinning storm tornado at small scale. Flat #00ff00 background. No character, no weapon, no scenery — VFX subject only." | pixel dimensions 901x1444
