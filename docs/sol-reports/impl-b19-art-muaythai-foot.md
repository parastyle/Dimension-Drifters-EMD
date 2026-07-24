# B19 Muay Thai Single Foot Wrap Rework

## Plan

- Inspect the blob-foot shape reference, the defective palette reference, and the shipped ArtKit harvest/install conventions.
- Generate with the supplied prompt verbatim, using the references only for shape and palette guidance.
- Reject any candidate containing toes/digits, a second item, or dangling rope/tassel/chain elements.
- Install the accepted keyed PNG over `packages/client/public/sprites/x2-muay-thai-wraps/part-2.png`.
- Verify chroma-key cleanliness, native dimensions, single-item composition, and closed digit-free blob silhouette.
- Commit only the replacement PNG and this append-only report on `sol/b19-art-muaythai-foot`.

## Reference review

- Shape reference: `proto-cowboy-hidden-face/foot-l.png` reads as a flat-base, domed-top, closed blob foot with no anatomical digits.
- Palette-only reference: `x2-muay-thai-wraps/part-1.png` supplies the crimson, near-black, stained-cloth, and rope-ridge palette. Its fused pair and human digits were explicitly rejected as anatomy/composition references.

## Generation and install

- Generated one candidate with the built-in image generator and both supplied reference images.
- Used the owner prompt verbatim, without restyling or added creative requirements.
- Harvested the green-screen render into `tools/artkit/out/x2-muay-thai-wraps/part-2.png`.
- Ran the shipped pinned ArtKit keyer, `tools/artkit/guards/chroma-key.mjs`, with full despill and installed its keyed output at `packages/client/public/sprites/x2-muay-thai-wraps/part-2.png`.
- Did not run the manifest-writing portion of `harvest-install.mjs`, because the owner explicitly reserved manifest, atlas, definitions, catalog, shared, and generated-file updates for the B19 integrator.

## Prompt used

```text
Weapon-part sprite: a SINGLE wrapped training foot for a cartoon blob character — a rounded DOME boot shape (flat base, domed top) with NO toes, NO digits,
wrapped in crimson-red fight-cloth bands crossing tightly, with a tight painted rope-cord ridge across the striking face (static, flush to the surface, nothing dangling) and dark battle stains. Rounded closed silhouette that reads as a bandaged
blob foot at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.
EXACTLY ONE single foot — never a pair, no second copy anywhere in frame. Flat #00ff00
background. No character, no limb, no scenery — the wrapped foot only.
```

## Verification

- Native keyed PNG: 1479×1064 RGBA, within the required greater-than-200 and less-than-2048 bounds.
- ArtKit keyer removed 58.7% of the green-screen canvas.
- Alpha inspection: 924,183 transparent pixels, 649,473 opaque subject pixels, and zero partial-alpha pixels.
- Fringe inspection: zero opaque green-dominant pixels after full despill.
- Connectivity inspection: exactly one alpha component (649,473 pixels); no detached second item or debris.
- Visual inspection on the ArtKit charcoal preview: exactly one flat-base/domed-top foot, closed blob silhouette, zero fingers/thumbs/toes/digits, and no character or limb.
- The painted cord ridge is static and flush within the silhouette, with both ends tucked/occluded; there is no dangling chain, tassel, or rope.

FINAL VERDICT — subject id: `x2-muay-thai-wraps:part-2` (`muaythai single foot wrap`); PNG path: `packages/client/public/sprites/x2-muay-thai-wraps/part-2.png`; prompt used: verbatim owner prompt reproduced above; pixel dimensions: 1479×1064; confirmed digit-free, exactly one connected single item, closed blob silhouette, clean chroma key, and no dangling element.
