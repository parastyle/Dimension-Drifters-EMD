# impl-b37-art-tornadoember

## Plan

- Inspect the shipped `part-1.png` reference and the ArtKit harvest/install conventions.
- Generate two registered mid-spin frames from the exact supplied prompt through the shipped ArtKit pipeline.
- Install only `part-2.png` and `part-3.png` under `packages/client/public/sprites/vfx-tornado-ember-fire/`.
- Verify native dimensions, flat `#00ff00` borders/background, clean keying, same-subject registration, file scope, and LF report endings.
- Commit the two PNGs and this report on `sol/b37-art-tornadoember`.

## Generation

- Used the built-in image-generation path with `part-1.png` as the reference image and the supplied prompt verbatim:

> REFERENCE packages/client/public/sprites/vfx-tornado-ember-fire/part-1.png (fire tornado funnel). Generate TWO more frames of the SAME vortex mid-spin: identical silhouette, palette, size and funnel shape, but flame-band spiral pattern advanced so part-1->2->3 cycles as continuous spinning. Flat #00ff00 background each.

- The generated 973x1616 source contained the two requested vortex frames left-to-right on the green field.
- The shipped ArtKit keyer removed 74.6% of the source canvas.
- The shipped connected-component slicer found exactly two main vortex components at a 0.5% minimum-area threshold: 467x932 and 465x930. Detached flame flecks did not become extra installed parts.
- Preserved the generated left-to-right order as `part-2` and `part-3`, registered both to the reference 468x768 canvas, and locked their alpha silhouette to the reference so only the internal flame-band phase changes.

## Installation

- Staged `part-1.png`, `part-2.png`, `part-3.png`, and `parts.json` under the ignored `tools/artkit/out/vfx-tornado-ember-fire/parts/` convention.
- Ran `tools/artkit/harvest-install.mjs --ids=vfx-tornado-ember-fire --kind=weapon --presize=0 --post-key=0`.
- Confirmed the installed `part-1.png` stayed byte-identical at SHA-256 `d3561260aed73be7f50ceb7f682a4d07569fd6ed73411e3b2fdf16893f61b424`.
- Restored the generated manifest side effect after harvest. The atlas repack helper was unavailable because its local module was not installed; this `weapon-vfx` subject is excluded from that atlas, no atlas file changed, and the B37 integrator owns wiring.
- Final tracked scope contains only the two requested PNGs and this report. No manifest, catalog, shared, or live-stack file is included.

## Verification

- Visual sequence review passed: same top-wide/tip-down fire funnel, same orange-red-yellow dark-comic cel palette, identical registered silhouette, and distinct progressive flame-band interiors across `part-1 -> part-2 -> part-3`.
- Standing-law review passed: one subject only; no chains, tassels, dangles, hands, digits, or radial-ambient elements.
- Both deliverables are 468x768 RGBA PNGs, satisfying the greater-than-200 and less-than-2048 native-dimension limits.
- All three frames have the same alpha SHA-256 `ed4ee8b1012aab3a8ab9a882b067ece187925472d4a78898e8a79cb3a43a3505`, alpha-mask IoU 1.0, and transparent corners.
- Chroma audit for each new frame: zero visible exact-`#00ff00` pixels, zero visible pixels matching ArtKit's keyable-green predicate, and zero visible green-dominant pixels.
- Frame distinction audit on charcoal: RGB mean absolute difference is 14.014 for `part-1 -> part-2`, 12.742 for `part-2 -> part-3`, and 14.056 for `part-3 -> part-1`.
- Final sizes and hashes:
  - `part-2.png`: 497,742 bytes; SHA-256 `3f5f31451024cc45a15bb864148f9a07298b2f2c37f5c79469d6d132c3ad7c24`.
  - `part-3.png`: 509,132 bytes; SHA-256 `a852c1c096d1c25466ac8508c9d223f6c89d265c48643987e4ebfcaaa1c0d1a3`.
- No live-stack boot was performed.

VERDICT: PASS — subject id `vfx-tornado-ember-fire`; PNG paths `packages/client/public/sprites/vfx-tornado-ember-fire/part-2.png`, `packages/client/public/sprites/vfx-tornado-ember-fire/part-3.png`; prompt used: "REFERENCE packages/client/public/sprites/vfx-tornado-ember-fire/part-1.png (fire tornado funnel). Generate TWO more frames of the SAME vortex mid-spin: identical silhouette, palette, size and funnel shape, but flame-band spiral pattern advanced so part-1->2->3 cycles as continuous spinning. Flat #00ff00 background each."; pixel dimensions: 468x768 each.
