# impl-b31-art-unicornbeam

## Plan

- Inspect the shipped `tools/artkit/harvest-install.mjs` conventions and the target VFX directory without starting the live stack.
- Generate exactly one Unicorn Rainbow Beam VFX subject with the supplied prompt verbatim via the approved image-generation path.
- Harvest/install only `packages/client/public/sprites/vfx-unicorn-rainbow-beam/part-1.png`.
- Validate PNG format, native dimensions (`>200x200` and `<2048x2048`), flat `#00ff00` chroma border/background, clean key separation, and repository scope.
- Append validation results and the required final verdict line to this report.

## Progress

- Inspected the shipped ArtKit harvest/install, chroma-key, and connected-component slicing conventions. Because `harvest-install.mjs` also rewrites the shared sprite manifest and atlas, this art-only run uses its `out/<id>/identity-ref.keyed.png` and `parts/part-1.png` conventions while reserving manifest/atlas wiring for the B31 integrator.
- Generated exactly one VFX subject through the built-in image-generation path with the owner prompt passed verbatim.
- Selected the generated green-screen source: a horizontal rainbow beam with crisp parallel red-through-violet cel bands, a white-hot center stripe, hard pale outlines, and star-sparkle edge glints; no character, weapon, aura frame, chain, tassel, or dangling element.
- Confirmed the isolated worktree did not have ArtKit's locked `sharp` dependency installed; restoring only the tool's locked dependencies before running the shipped offline guards.
- Restored ArtKit's locked dependencies with `npm ci`; no live application stack was started.
- Staged the generated 1774×887 PNG as `tools/artkit/out/vfx-unicorn-rainbow-beam/identity-ref.png`.
- Ran the shipped chroma-key guard, which removed 66.8% of the flat green canvas, then ran the shipped connected-component slicer with its documented `--minAreaPct=0.5` filter. The slicer found exactly one qualifying beam component and emitted a 1772×362 `part-1.png`.
- Removed only the generated pointed decorative endcaps by cropping at the closest pixel-matched interior columns (source columns 287 through 1444 inclusive). This produced straight repeatable sides while preserving the parallel bands and multiple sparkle glints.
- Installed only `packages/client/public/sprites/vfx-unicorn-rainbow-beam/part-1.png`, then applied the harvest installer's pinned in-place despill/key pass. It found zero remaining keyable pixels.

## Verification

- Visual subject check: PASS — one beautiful left-to-right combat beam; saturated red, orange, yellow, white-hot core, cyan, blue, and violet hard-edged parallel cel bands; crisp pale outlines; subtle star glints; no blur, character, weapon, scenery, player-aura frame, chain, tassel, or dangling element.
- Horizontal tiling check: PASS — a three-repeat charcoal-background preview has no visible seam. The first and last columns have identical alpha profiles; their mean absolute RGBA difference is 0.433 on a 0–255 scale.
- Native-size gate: PASS — 1158×362, with both dimensions greater than 200 and less than 2048.
- PNG/keying check: PASS — sRGB RGBA PNG; 17.07% fully transparent pixels; hard alpha with no semi-transparent pixels; zero visible exact `#00ff00` pixels; zero visible pixels matching the shipped keyer's green predicate; zero green-dominant visible pixels; zero hidden RGB in fully transparent pixels.
- Install scope: PASS — the target directory contains exactly `part-1.png`; no manifest, catalog, shared, atlas, runtime, or live-stack file was changed.
- File integrity: 254,740 bytes; SHA-256 `42cf2f9923308843ff16ea646e7b11366402d97c73e472236fc3c76bcef78dfe`.
- Repository hygiene: PASS — only this report and the requested PNG are present as worktree changes; `git diff --check` passes; this report uses LF line endings.

VERDICT: PASS — subject id `vfx-unicorn-rainbow-beam`; PNG path `packages/client/public/sprites/vfx-unicorn-rainbow-beam/part-1.png`; prompt used: "VFX-only in-world sprite: a BEAUTIFUL horizontal RAINBOW BEAM segment — clean parallel bands of saturated rainbow colour (red through violet) with a bright white-hot core stripe, crisp hard-edged cel bands (NOT a blurry gradient), subtle star-sparkle glints along the edges, reads like a polished magical-girl / Nyan-cat-quality beam at combat scale, tileable horizontally, beam axis LEFT-to-RIGHT, ~8 colours, hard outlines. Flat #00ff00 background. No character, no weapon."; pixel dimensions: 1158×362.
