# B19 drunken single foot wrap rework

## Plan

1. Inspect the blob-foot shape reference and the defective wrap strictly as a palette reference.
2. Generate the exact requested single-foot subject through the shipped ArtKit harvest/install workflow.
3. Reject any result containing a second item, digits, dangling wrap ends, rope, chain, tassels, or an open/non-blob silhouette.
4. Install only the keyed PNG at `packages/client/public/sprites/x2-drunken-fist-wraps/part-2.png`.
5. Verify dimensions, clean chroma-key background/edges, and the single-item digit-free closed silhouette; append results and commit only this report and the PNG.

## Implementation

- Read `proto-cowboy-hidden-face/foot-l.png` as the blob-foot shape reference and `x2-drunken-fist-wraps/part-1.png` only as the worn tan/amber, wine-purple, gritty-outline palette reference.
- Generated one candidate through the built-in image-generation path with the supplied prompt unchanged and both reference images attached in those limited roles.
- Accepted the candidate after visual review confirmed one low dome/boot subject, a flat base, a closed rounded silhouette, zero toes/digits, no second copy, and no chain, rope, tassel, or dangling cloth end.
- Staged the 1340×1174 green-field source in the ignored ArtKit workspace. The shipped chroma-key guard removed 57.8% of the source canvas.
- The shipped weapon slicer found exactly one connected component and emitted one 1048×818 part.
- Installed at full resolution through `tools/artkit/harvest-install.mjs` with its pinned post-key pass, then promoted that harvested part to `packages/client/public/sprites/x2-drunken-fist-wraps/part-2.png`.
- Preserved the existing `part-1.png` and restored ArtKit's manifest and atlas outputs byte-for-byte. No manifest, weapon definition, catalog row, or shared/generated file remains changed.

## Verification

- Visual review at native size: PASS — exactly one wrapped blob foot with a flat base and domed top; all wrap ends are flush/tucked; no toes, digits, limb, character, pair, second copy, scenery, rope, chain, tassel, or dangling element.
- Small-scale review at 96 pixels wide: PASS — the closed dome/boot silhouette remains readable as one bandaged blob foot.
- Native-size gate: PASS — 1048×818 pixels, with both dimensions greater than 200 and less than 2048.
- Alpha/chroma audit: PASS — RGBA PNG, all four corners transparent, 193,646 fully transparent pixels, zero visible exact-`#00ff00` pixels, zero visible pixels matching the shipped keyer's keyable-green predicate, and zero visible green-dominant pixels.
- File integrity: SHA-256 `0b13d06e42e0eefe33393ae04a217cd9c4297f7fe26d92a28a42f2a750fe89a6`.
- Scope: only this report and the requested PNG are tracked changes; the live stack was not started.

VERDICT: PASS — subject id `x2-drunken-fist-wraps`; PNG path `packages/client/public/sprites/x2-drunken-fist-wraps/part-2.png`; prompt used: "Weapon-part sprite: a SINGLE wrapped training foot for a cartoon blob character — a rounded DOME boot shape (flat base, domed top) with NO toes, NO digits, wrapped in loose layered tan-sand cloth bands wrapped sloppily with overlapping folds (all flush to the surface, nothing dangling), with wine-purple stain blotches. Rounded closed silhouette that reads as a bandaged blob foot at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines. EXACTLY ONE single foot — never a pair, no second copy anywhere in frame. Flat #00ff00 background. No character, no limb, no scenery — the wrapped foot only."; pixel dimensions: 1048×818; digit-free: confirmed; single-item: confirmed.
