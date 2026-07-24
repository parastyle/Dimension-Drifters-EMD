# impl-b19-art-ironpalm-foot

## Plan

1. Inspect the blob-foot shape reference and the defective wrap palette reference.
2. Generate exactly one closed, digit-free foot wrap with the supplied prompt through the shipped ArtKit workflow.
3. Install only the keyed PNG at `packages/client/public/sprites/x2-iron-palm-wraps/part-2.png`.
4. Verify dimensions, chroma-key cleanliness, single-item composition, closed silhouette, and the absence of digits or dangling elements.
5. Append generation and verification results here, then commit only this report and the PNG.

## Generation

- Shape reference: `packages/client/public/sprites/proto-cowboy-hidden-face/foot-l.png` (rounded, flat-base blob-foot silhouette only).
- Palette reference: `packages/client/public/sprites/x2-iron-palm-wraps/part-1.png` (slate cloth, dark iron, rivets, scratches, and outline treatment only).
- Generated one source candidate with the built-in image generator and both references.
- Processed the candidate with the shipped ArtKit conventions: pinned `guards/chroma-key.mjs` at full despill, one-component `guards/slice.mjs` weapon slicing, direct `part-2.png` install, and a final in-place full-despill pass. The shared installer was not invoked because it would also rewrite forbidden manifest and atlas files.

Prompt used (verbatim):

```text
Weapon-part sprite: a SINGLE wrapped training foot for a cartoon blob character — a rounded DOME boot shape (flat base, domed top) with NO toes, NO digits,
wrapped in a slate-grey cloth base with riveted dark-iron plates over the striking face, with a studded iron knuckle ridge and worn metal scratches. Rounded closed silhouette that reads as a bandaged
blob foot at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.
EXACTLY ONE single foot — never a pair, no second copy anywhere in frame. Flat #00ff00
background. No character, no limb, no scenery — the wrapped foot only.
```

## Verification

- Installed PNG: `packages/client/public/sprites/x2-iron-palm-wraps/part-2.png`.
- Native image: `1040×829` RGBA PNG, within the required bounds.
- ArtKit source key removed `56.9%` of the green canvas; slicing found exactly one retained component.
- Final pixel audit: one 8-connected opaque component, all four corners transparent, zero keyable-green pixels, and zero green-dominant fringe pixels.
- Visual audit: exactly one closed dome-shaped blob foot; zero toes, fingers, thumbs, or other digits; no character or limb; flush/tucked wraps with no chain, tassel, rope, or dangling end.
- Tracked scope audit: only the requested PNG and this report are changed.

VERDICT: subject id `x2-iron-palm-wraps/part-2`; PNG `packages/client/public/sprites/x2-iron-palm-wraps/part-2.png`; prompt used: exact verbatim owner prompt recorded above; pixel dimensions `1040×829`; CONFIRMED digit-free and exactly one item.
