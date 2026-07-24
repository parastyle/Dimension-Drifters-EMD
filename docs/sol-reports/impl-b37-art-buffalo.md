# impl-b37-art-buffalo

## Plan

- Inspect the existing Ironhide Buffalo Gun sprite and the shipped ArtKit `harvest-install.mjs` workflow.
- Regenerate the same weapon fiction, palette, proportions, and canvas registration as a strict flat right-facing side profile using the supplied prompt verbatim.
- Install only `packages/client/public/sprites/x2-ironhide-buffalo-gun/part-1.png`.
- Validate native dimensions, flat `#00ff00` key cleanliness, subject framing, and prohibited details.
- Append generation and validation results here, then commit only the PNG and this report on `sol/b37-art-buffalo`.

## Generation prompt

```text
Weapon-only in-world sprite: REFERENCE the existing art at packages/client/public/sprites/x2-ironhide-buffalo-gun/part-1.png and reproduce its exact fiction/palette/proportions but as a STRICT FLAT ORTHOGRAPHIC FULL SIDE-PROFILE (no perspective, no 3/4 view, no visible bore opening), barrel RIGHT, stock LEFT, ~5 colours, gritty dark-comic cel, hard outlines. Flat #00ff00 background.
```

## Pipeline record

- Read the prior installed PNG as the identity, palette, proportion, and registration reference. It was a 256×84 RGBA slice with a long walnut-stock/dark-gunmetal/brass silhouette, stock left and barrel right.
- Generated one reference-conditioned render with the built-in image generator using the owner prompt verbatim.
- Staged the raw 2110×745 green-screen render at the ignored ArtKit intake path `tools/artkit/out/x2-ironhide-buffalo-gun/identity-ref.png`.
- Ran the shipped pinned ArtKit chroma-key guard with full despill; it removed 66.5% of the source plate.
- Ran the shipped ArtKit weapon slicer; it found exactly one connected component and emitted a 1923×614 `parts/part-1.png`.
- Applied the harvester's Lanczos presize convention to an exact 3× reference canvas, producing the final 768×252 part, then ran the shipped keyer in-place as the post-presize cleanup pass.
- Promoted only the requested `part-1.png`. `harvest-install.mjs` itself was not run because it also rewrites the shared sprite manifest and atlas, which this art-only order explicitly forbids; no manifest, catalog, shared file, or other asset was edited.

## Verification

- Visual subject gate: PASS — one weapon only; strict flat broadside; barrel right and stock left; the right muzzle is a square side plate with no visible bore opening; the palette and fiction retain the reference's dark gunmetal, walnut red-brown, brass, and hard charcoal outlines.
- Prohibited-detail gate: PASS — no character, perspective/three-quarter construction, chain, tassel, dangling element, digits, or radial ambient effect.
- Native-size gate: PASS — 768×252 RGBA PNG, so both dimensions are greater than 200 and less than 2048.
- Registration gate: PASS — the final canvas is exactly 3× the 256×84 reference in each axis and has the identical 3.047619 aspect ratio. The normalized visible-pixel centroid is `(0.4741, 0.5468)` versus reference `(0.4719, 0.5470)`.
- Shape gate: PASS — exactly one alpha-connected component at threshold 128.
- Chroma/alpha gate: PASS — zero visible keyable-green pixels, zero visible green-dominant pixels, zero hidden RGB in fully transparent pixels, and clean transparent separation around the silhouette.
- Static asset gate: PASS — `pnpm assets:check` reports 479 sprite entries / 1011 parts and 635 atlas frames with no missing runtime art.
- Scope/hygiene gate: PASS — only the requested PNG and this report are changed; no live stack was booted.
- Final PNG SHA-256: `5acd291d7d9c4321bef6150d408ab2e12c682bc93b9480e97cc7213e12cbef9f`.

VERDICT: PASS — subject id `x2-ironhide-buffalo-gun`; PNG path `packages/client/public/sprites/x2-ironhide-buffalo-gun/part-1.png`; prompt used: "Weapon-only in-world sprite: REFERENCE the existing art at packages/client/public/sprites/x2-ironhide-buffalo-gun/part-1.png and reproduce its exact fiction/palette/proportions but as a STRICT FLAT ORTHOGRAPHIC FULL SIDE-PROFILE (no perspective, no 3/4 view, no visible bore opening), barrel RIGHT, stock LEFT, ~5 colours, gritty dark-comic cel, hard outlines. Flat #00ff00 background."; pixel dimensions: 768×252 RGBA PNG.
