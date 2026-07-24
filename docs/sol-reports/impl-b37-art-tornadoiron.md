# impl-b37-art-tornadoiron

## Plan

- Inspect `packages/client/public/sprites/vfx-tornado-iron-gale/part-1.png` and the shipped `tools/artkit/harvest-install.mjs` conventions.
- Generate two registered mid-spin frames of the same Iron Gale vortex using the supplied prompt verbatim.
- Install only `part-2.png` and `part-3.png` in the reference asset directory.
- Validate PNG format, native dimensions, flat `#00ff00` key background, keying cleanliness, registration, and changed wind-band phases.
- Commit the two PNGs and this report on `sol/b37-art-tornadoiron`.

## Prompt

"REFERENCE packages/client/public/sprites/vfx-tornado-iron-gale/part-1.png (grey steel wind tornado funnel). Generate TWO more frames of the SAME vortex mid-spin: identical silhouette, palette, size and funnel shape, but the wind-band spiral pattern rotated/advanced so cycling part-1->2->3 reads as continuous spinning. No other changes. Flat #00ff00 background each."

## Implementation

- Used `part-1.png` as the image-generation reference and generated a single two-frame source sheet from the verbatim prompt above.
- Staged the source under `tools/artkit/out/vfx-tornado-iron-gale/`, split the two tornado components, and normalized both frames to the reference canvas.
- Ran both generated frames through the shipped `tools/artkit/guards/chroma-key.mjs` keyer with full despill.
- Locked both final alpha masks to `part-1.png` so all three animation frames have identical silhouette registration.
- Installed only:
  - `packages/client/public/sprites/vfx-tornado-iron-gale/part-2.png`
  - `packages/client/public/sprites/vfx-tornado-iron-gale/part-3.png`
- No manifest, catalog, shared-code, or live-stack changes were made.

## Validation

- Both installed files are native 839×1380 RGBA PNGs.
- Both use the same binary alpha mask as `part-1.png`: 480,751 opaque pixels, 677,069 transparent pixels, and zero alpha-mask differences.
- Transparent pixels have zero RGB residue; opaque pixels contain zero keyable or green-dominant chroma pixels.
- Wind-band phase changes are material: 87.92% of opaque pixels differ between frames 1 and 2, 87.56% between frames 1 and 3, and 52.61% between frames 2 and 3.
- File sizes: `part-2.png` 1,260,597 bytes; `part-3.png` 1,261,723 bytes.
- Visual QA passed on a three-frame charcoal contact sheet in ArtKit scratch.
