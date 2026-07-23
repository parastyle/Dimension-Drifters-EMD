# Drifter Art Evidence

Reference lock: `DRIFTER_STYLE_LOCK_V1`. Subject audit: Drifter only.

## Acceptance checklist

- [x] Face law: no visible or implied skin, eye, eye mark, glint, nose, mouth, jaw, facial hair, ear, expression, or readable profile. The low brim covers a solid opaque `#22252B` Eclipse Brim wedge.
- [x] Head separable: `head.png` is an independent RGBA layer with a closed lower silhouette and no pixels bridging to the body.
- [x] No neck: `body.png` has no head, neck, neck stub, connector, or socket art; its shoulder/collar roof is fully painted and opaque.
- [x] Bob overlap: fixed socket `(0, -0.38B)`, pivot `(0.50, 0.55)`, mount `0.85`, and rest overlap `0.18B` (`92.16` source px / `13.68` runtime px). All nine `+/-4 px` runtime bob samples retained alpha overlap with no daylight.
- [x] On style: shallow high three-quarter/right-facing game read, compact paper-cut silhouette, bold imperfect flat contour, restrained occult-western palette, matte cel bands, sparse 76 px-readable detail.
- [x] Canonical body size: every character inherits `B_source = 512 px` on a `1024x1024` authoring canvas and `B_runtime = 76 px`; no character-specific scale tier.
- [x] Transparent delivery: both final PNGs are RGBA with transparent corners and clean despilled edges.

## Final assets

- `body.png`: `576x544`; alpha bounds `[24,16,552,528]`; SHA-256 `ac1e9c9590669f42388b79f01e2c9f313220cd1d38fc6e8a092d15393b912551`.
- `head.png`: `576x320`; alpha bounds `[22,25,553,301]`; SHA-256 `71a3df303b60676976f95f74de62a6549873ac06f77ff78d0663e9c53ad35057`.

Generation used Codex built-in image generation for one coherent two-layer Drifter source plate on a flat chroma field, followed by local soft-matte chroma removal, despill, canonical scaling, and alpha validation.
