# impl-b19-art-drunken-hand

## Plan

1. Inspect the blob-hand shape reference, defective palette reference, and shipped ArtKit harvest/install conventions.
2. Generate one keyed sprite with the supplied prompt verbatim, rejecting any result with digits, multiple items, or dangling wrap elements.
3. Install only `packages/client/public/sprites/x2-drunken-fist-wraps/part-1.png`.
4. Verify dimensions, clean chroma key, silhouette, palette, single-item count, and digit-free design.
5. Append evidence and the required final verdict, then commit the PNG and this report on `sol/b19-art-drunken-hand`.

## Work log

- 2026-07-23: Started the art-only rework; no manifest, weapon definition, catalog, or shared/generated files will be touched.
- Inspected `proto-cowboy-hidden-face/hand-l.png` as the shape reference: a compact, featureless egg/oval blob hand with no anatomical digits.
- Inspected the defective installed `x2-drunken-fist-wraps/part-1.png` only for its warm tan, dark outline, and stained-cloth palette; rejected its long arm, human fingers, and extra prop geometry.
- Generated exactly one subject through the built-in image-generation path with both references supplied and the owner prompt passed verbatim.
- Accepted the first render: one closed oval wrapped mitt, no fingers/thumb/knuckle digits, no second item, no limb, and no dangling wrap, chain, tassel, or rope.
- Staged the 1254×1254 green-screen render at the ignored ArtKit intake path `tools/artkit/out/x2-drunken-fist-wraps/identity-ref.png`.
- Ran the shipped ArtKit chroma-key guard with full despill; it removed 58.5% of the source canvas.
- Ran the shipped weapon slicer; it found exactly one connected component, initially cropped to 770×1083.
- Applied `harvest-install.mjs`'s Lanczos3 presize convention with a 512 px longest-side target, producing 364×512, then ran the pinned post-key pass.
- Overwrote only `packages/client/public/sprites/x2-drunken-fist-wraps/part-1.png`. No manifest, weapon definition, catalog row, atlas, or other shared/generated product file was changed.

## Verification

- Visual review: PASS — exactly one rounded egg-shaped blob fist; zero fingers, thumbs, knuckles, digits, limbs, characters, scenery, chains, tassels, ropes, or dangling wrap ends.
- Component review: PASS — the shipped ArtKit slicer finds exactly one component after final presizing.
- Native-size review: PASS — 364×512 is greater than 200×200 and less than 2048×2048.
- Chroma/alpha review: PASS — RGBA PNG, four transparent corners, 0 visible keyable-green pixels, 0 visible green-dominant pixels, and 0 maximum green-channel excess.
- Install integrity: PASS — installed SHA-256 `4baae96abe4995597ac425ae4f4922a4e31f10b7545beed6a3edb621b1541a6d` exactly matches the staged final.
- `git diff --check`: PASS. The live stack was intentionally not booted.

Verdict: PASS — subject id `x2-drunken-fist-wraps`; PNG path `packages/client/public/sprites/x2-drunken-fist-wraps/part-1.png`; prompt used: `"Weapon-part sprite: a SINGLE wrapped training fist for a cartoon blob character — a plain OVAL mitt shape (like an egg) with NO fingers, NO thumb, NO knuckle digits,\nwrapped in loose layered tan-sand cloth bands wrapped sloppily with overlapping folds (all flush to the surface, nothing dangling), with wine-purple stain blotches. Rounded closed silhouette that reads as a bandaged\nblob fist at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.\nEXACTLY ONE single fist — never a pair, no second copy anywhere in frame. Flat #00ff00\nbackground. No character, no limb, no scenery — the wrapped fist only."`; pixel dimensions `364×512`; confirmed digit-free and exactly one single item.
