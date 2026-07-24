# impl-b19-art-muaythai-hand

Plan:

1. Inspect the blob-hand shape reference, defective palette reference, and shipped ArtKit harvest/install conventions.
2. Generate the exact requested single wrapped blob fist on flat `#00ff00`, rejecting any output with digits, duplicate items, or dangling wrap elements.
3. Install only the keyed PNG at `packages/client/public/sprites/x2-muay-thai-wraps/part-1.png`.
4. Verify dimensions, clean chroma key, single-item composition, closed digit-free silhouette, and repository scope.
5. Append the verification record and final verdict, then commit the PNG and this report on `sol/b19-art-muaythai-hand`.

## Progress

- Confirmed the worktree began clean on `sol/b19-art-muaythai-hand`.
- Inspected `proto-cowboy-hidden-face/hand-l.png` as the silhouette authority: a compact, plain egg-like blob hand with no fingers, thumb, or digit separations.
- Inspected the former `x2-muay-thai-wraps/part-1.png` only for its crimson, black, and rope-tan palette; rejected its paired, human-fingered construction.
- Inspected the shipped ArtKit chroma-key, slice, and `harvest-install.mjs` conventions. Because the installer also regenerates the shared sprite manifest and atlas, this art-only run used its `out/<id>/identity-ref.keyed.png` and `parts/part-1.png` conventions while installing only the requested PNG.
- Generated one image with the owner-supplied prompt unchanged, then staged it as `tools/artkit/out/x2-muay-thai-wraps/identity-ref.png`.
- Restored the isolated worktree's ignored, tool-local ArtKit dependencies with `npm ci` after the first keyer attempt reported that locked dependency `sharp` was absent.
- The shipped chroma-key guard removed 58.8% of the 1536×1536 green plate. The shipped slicer found exactly one qualifying alpha-connected component and emitted a 783×1056 `part-1.png`.
- Overwrote only `packages/client/public/sprites/x2-muay-thai-wraps/part-1.png` and applied the pipeline's post-install in-place despill/key pass; it found zero remaining keyable pixels.

## Verification

- Visual inspection: PASS — exactly one rounded, closed oval mitt; zero fingers, thumbs, knuckles, toes, or digit separations; crimson crossing cloth bands; dark stains; one rope-cord ridge painted flush across the face; no second item, limb, character, scenery, loose end, chain, tassel, or dangling rope.
- Multi-background proof: PASS — charcoal, white, and magenta composites show a clean hard outline without green fringe.
- Native-size gate: PASS — 783×1056 RGBA, so both dimensions are greater than 200 and less than 2048.
- Alpha/chroma audit: PASS — four transparent corners, exactly one component above alpha 9, zero visible keyable-green pixels, zero visible green-dominant pixels, zero alpha-1-through-9 pixels, and zero hidden RGB in fully transparent pixels.
- File integrity: SHA-256 `86cc6e330e8a5760ca63448762f06521301865ccea96c6efe3af0d9427e40471`.
- Scope and hygiene: PASS — final worktree changes are only the requested PNG and this report; no manifest, weapon definition, catalog row, or other shared/generated file changed; `git diff --check` passes; the report uses LF-only endings; no live stack was booted.

VERDICT: PASS — subject id `x2-muay-thai-wraps` (`muaythai single hand wrap`) | PNG path `packages/client/public/sprites/x2-muay-thai-wraps/part-1.png` | prompt used: "Weapon-part sprite: a SINGLE wrapped training fist for a cartoon blob character — a plain OVAL mitt shape (like an egg) with NO fingers, NO thumb, NO knuckle digits, wrapped in crimson-red fight-cloth bands crossing tightly, with a tight painted rope-cord ridge across the striking face (static, flush to the surface, nothing dangling) and dark battle stains. Rounded closed silhouette that reads as a bandaged blob fist at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines. EXACTLY ONE single fist — never a pair, no second copy anywhere in frame. Flat #00ff00 background. No character, no limb, no scenery — the wrapped fist only." | pixel dimensions 783×1056 | digit-free: confirmed | single-item: confirmed
