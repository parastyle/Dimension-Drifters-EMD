# impl-b19-art-ironpalm-hand

## Plan

- Inspect the blob-hand shape reference and the defective wrap only as a palette/style reference.
- Review the shipped `tools/artkit/harvest-install.mjs` generation/install conventions.
- Generate one keyed iron-palm wrap from the supplied prompt, rejecting any result with digits, dangling elements, or more than one item.
- Install only `packages/client/public/sprites/x2-iron-palm-wraps/part-1.png`.
- Verify dimensions, chroma-key quality, silhouette, subject count, and changed-file scope; then commit the PNG and this report.

## Generation and installation

- Generated with the built-in image generator using the two required local references.
- Used `proto-cowboy-hidden-face/hand-l.png` for the finger-free oval blob silhouette.
- Used the previous `x2-iron-palm-wraps/part-1.png` only for the slate-grey cloth and dark-iron palette.
- Staged the raw green render as `tools/artkit/out/x2-iron-palm-wraps/identity-ref.png`.
- Processed the render with the shipped pinned ArtKit chroma keyer using full despill.
- Processed the keyed render with the shipped ArtKit weapon slicer; it detected exactly one connected part.
- Promoted only that sliced `part-1.png` to the requested install path. The manifest, weapon definitions, catalogs, generated shared files, and atlas were not touched.

## Prompt used

```text
Weapon-part sprite: a SINGLE wrapped training fist for a cartoon blob character — a plain OVAL mitt shape (like an egg) with NO fingers, NO thumb, NO knuckle digits,
wrapped in a slate-grey cloth base with riveted dark-iron plates over the striking face, with a studded iron knuckle ridge and worn metal scratches. Rounded closed silhouette that reads as a bandaged
blob fist at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.
EXACTLY ONE single fist — never a pair, no second copy anywhere in frame. Flat #00ff00
background. No character, no limb, no scenery — the wrapped fist only.
```

## Verification

- Installed PNG: 766 × 1066 pixels, RGBA PNG.
- Bounds: both dimensions are greater than 200 and less than 2048.
- Chroma key: all four corners are transparent; zero visible pixels match the ArtKit keyable-green test; zero visible pixels are materially green-dominant.
- Component check: ArtKit slicer found exactly one connected subject.
- Visual check: exactly one closed oval mitt; zero fingers, thumbs, knuckle digits, or other anatomical digits; no second item; no limb or character.
- Wrap-end check: all stitching and wrap details are flush/tucked; no chain, tassel, rope, or dangling element.
- Scope check: only the requested PNG and this report are changed.

VERDICT: subject id `x2-iron-palm-wraps`; PNG `packages/client/public/sprites/x2-iron-palm-wraps/part-1.png`; prompt used: verbatim owner-supplied prompt quoted above; 766 × 1066 RGBA PNG; confirmed digit-free, single-item, closed blob-fist silhouette with no dangling elements.
