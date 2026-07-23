# impl-b14-art-drunken-fist

## Plan

1. Generate only `x2-drunken-fist-wraps` with the supplied prompt through the shipped ArtKit workflow.
2. Inspect the result for a right-facing, weapon-only silhouette; reject any character, dangling cord, motion line, or non-flat background.
3. Chroma-key with the shipped keyer, slice and install with `tools/artkit/harvest-install.mjs`, and verify native dimensions and edge cleanup.
4. Add one `_stub: true` weapon-concept row without behavior wiring.
5. Run static asset checks and `pnpm typecheck`, record results here, and commit the art-only changes.

## Progress

- Worktree confirmed clean on `sol/b14-art-drunken-fist`.
- Generated exactly one subject with the supplied prompt verbatim through the built-in image-generation path.
- Staged the 1536×1024 green-screen render at the ignored ArtKit intake path `tools/artkit/out/x2-drunken-fist-wraps/identity-ref.png`.
- Ran the shipped chroma-key guard with full despill; it removed 72.2% of the source canvas.
- The shipped weapon slicer found the intended two-piece matched pair: a 972×447 gourd wrap and an 889×433 companion wrap.
- Installed through `node tools/artkit/harvest-install.mjs --ids=x2-drunken-fist-wraps --kind=weapon --weapon-target=512 --post-key=1`.
- ArtKit presized the pair to 512×235 and 468×228, generated one weapon manifest entry with two parts, and repacked the atlas.
- Added one minimal `_stub: true` concept row with exact prompt provenance and an empty behavior placeholder. No weapon behavior, definition, generator, or generated gameplay file was changed.

## Verification

- Visual review: PASS — matched warm tan/amber wraps face right with loose knuckles up-right; one clay wine gourd is rigidly painted into the wrist binding; there is no character body, scene, motion line, chain, tassel, rope, or cord connector.
- Chroma-key review: PASS — both installed RGBA files have zero visible pixels matching the shipped keyer's keyable-green predicate and zero green-dominant visible pixels.
- Component and size review: PASS — each installed part contains one connected component; 512×235 and 468×228 are both greater than 200×200 and less than 2048×2048.
- Concept review: PASS — 335 declared rows equal 335 actual rows; exactly one `x2-drunken-fist-wraps` row exists with `_stub: true`, exact prompt equality, and `behavior: {}`.
- `pnpm assets:check`: PASS — 447 sprite entries / 853 parts; all 362 loose expansion parts resolved.
- `pnpm typecheck`: PASS across shared, client, and server.
- `pnpm gen` and the live stack were intentionally not run.

Verdict: PASS — subject `x2-drunken-fist-wraps`; PNG path `packages/client/public/sprites/x2-drunken-fist-wraps/part-1.png` (paired companion `part-2.png`); prompt used: "Weapon-only in-world sprite: a matched pair of loose, unravelling Drunken Fist hand-wraps — old worn cotton/hemp cord loosely bound, small clay wine-gourd bottle painted rigidly strapped to one wrist (static, no dangling cord), fingers half-loose from the wrap. Weathered warm tan/amber colouring, stained. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the loose knuckles UP-RIGHT to imply the tilted stance. Flat #00ff00 background. No character, no motion lines."; pixel dimensions: 512×235 px (`part-1`), 468×228 px (`part-2`).
