# impl-b31-art-emberleaf

## Plan

- Generate the single `vfx-emberleaf-fireball` subject with the supplied prompt verbatim through the approved image-generation path.
- Process and install the chosen source through the repository's `tools/artkit/harvest-install.mjs` conventions.
- Install only `packages/client/public/sprites/vfx-emberleaf-fireball/part-1.png`; make no manifest, catalog, shared, or runtime edits.
- Verify PNG format, native dimensions above 200x200 and below 2048x2048, a flat clean `#00ff00` chroma background, readable round silhouette, and absence of characters, weapons, fingers, chains, tassels, dangles, or aura framing.
- Inspect the final asset visually and append generation/validation evidence plus the required final verdict line to this report.

## Generation

- Generated exactly one subject through the built-in image-generation path with the supplied prompt passed verbatim and without a style reference.
- Staged the generated 1254x1254 RGB green-screen master as `tools/artkit/out/vfx-emberleaf-fireball/identity-ref.png`.
- Visual review confirmed one round, roiling orange-red fireball with a dense layered flame sphere, white-hot core, short surface flame tongues, ember flecks, hard dark-comic outlines, and no character, weapon, fingers, chain, tassel, dangle, or aura frame.

## ArtKit installation

- Ran the pinned `tools/artkit/guards/chroma-key.mjs` keyer; it removed 51.2% of the generation canvas.
- Ran the documented connected-component slicer with `--kind=weapon --minAreaPct=0.5`; detached micro-flecks were excluded from part registration and the fireball resolved to exactly one 1072x1073 component named `part-1.png`.
- Ran `tools/artkit/harvest-install.mjs --ids=vfx-emberleaf-fireball --kind=weapon --weapon-target=768 --post-key=1`; the standard Lanczos presize produced the installed 767x768 sprite.
- Preserved and restored the pre-harvest generated sprite manifest and atlas files byte-for-byte. No manifest, catalog, shared, source, or runtime file remains changed.

## Verification

- Final PNG: 767x768 RGBA, SHA-256 `598ca8bcfac8517979e2cd9ee46295c7e7f6df340afb79ec9f5470a3cd68f9c4`; both native dimensions are greater than 200 and less than 2048.
- Alpha/key audit: all four corners are transparent; 191,605 fully transparent pixels; 13,681 semitransparent edge pixels; zero visible exact-`#00ff00` pixels; zero visible pixels matching the shipped keyer's keyable-green predicate; zero visible green-dominant pixels.
- Visual inspection at native size and a 96x96 Lanczos preview confirmed a clean round silhouette, readable white-hot core, distinct orange-red flame layers, and intact short flame tongues at both large and small scale.
- Scope check: the installed directory contains exactly `part-1.png`; final tracked scope is only this report and the requested PNG. `git diff --check` passes. No live stack was started.

## Prompt used

> VFX-only in-world sprite: a readable ROILING FIREBALL orb — dense sphere of layered orange-red flame with a white-hot core, short flame tongues licking off the surface, ember flecks, ~5-7 colours, gritty dark-comic cel with hard outlines. Round silhouette that reads as a charged fireball at small AND large scale (it will be scaled during charge). Flat #00ff00 background. No character, no weapon.

VERDICT: PASS — subject id `vfx-emberleaf-fireball`; PNG path(s) `packages/client/public/sprites/vfx-emberleaf-fireball/part-1.png`; prompt used: "VFX-only in-world sprite: a readable ROILING FIREBALL orb — dense sphere of layered orange-red flame with a white-hot core, short flame tongues licking off the surface, ember flecks, ~5-7 colours, gritty dark-comic cel with hard outlines. Round silhouette that reads as a charged fireball at small AND large scale (it will be scaled during charge). Flat #00ff00 background. No character, no weapon."; pixel dimensions: 767x768.
