# impl-b37-art-presents

## Plan

- Inspect the shipped ArtKit `harvest-install.mjs` conventions and any existing Exploding Present Lobber artwork for canvas/registration guidance.
- Generate five separate projectile-only sinister wrapped gift-box bomb variations using the assigned prompt verbatim; keep variants 1–4 similarly sized and make variant 5 the noticeably larger, heavier-strapped payload.
- Harvest/install only `packages/client/public/sprites/vfx-present-variants/part-1.png` through `part-5.png`.
- Verify PNG format, native dimensions above 200×200 and below 2048×2048, flat `#00ff00` key cleanliness, subject separation/readability, and variant registration without booting the live stack.
- Append generation and validation evidence to this report, then commit only the five PNGs and this report on `sol/b37-art-presents`.

## Execution

- Generated the requested five-variant subject with the built-in image-generation path using the owner prompt verbatim. The selected 1254×1254 source plate contained four similarly sized grimy gift bombs in deep red, midnight blue, poison green, and dusty purple plus one clearly larger iron-strapped payload.
- Staged the source at the ignored ArtKit intake `tools/artkit/out/vfx-present-variants/identity-ref.png`.
- Ran the shipped `guards/chroma-key.mjs` keyer at its palette-safe `0.5` despill setting; it removed 69.3% of the generated green field while retaining the intentionally poison-green wrapping.
- Ran the shipped `guards/slice.mjs` weapon-component slicer with its documented `0.5%` minimum-area filter. It found exactly five qualifying connected presents and emitted five masked alpha parts.
- Ordered the harvested parts as red, midnight blue, poison green, dusty purple, then the large payload. No manifest, atlas, catalog, shared, or runtime file was changed.
- Normalized all five parts without scaling onto one shared 640×512 transparent canvas. Every subject is centered at x=320 and registered to the same bottom datum at y=479; this preserves the large payload's authored size difference.
- Installed only `packages/client/public/sprites/vfx-present-variants/part-1.png` through `part-5.png`.

## QA

- Visual contact-sheet review passed: each PNG contains exactly one projectile-only sinister present; all have grimy wrapping, frayed ribbon, a dented bow, a small fuse spark, hard dark-comic outlines, and no character, chain, tassel, dangle, or radial ambience.
- Variants 1–4 have closely matched painted bounds of 312–322×352–366. Variant 5 has 595×452 painted bounds and 191,496 visible pixels versus approximately 72,000–73,000 for each regular payload, making it noticeably bigger and more heavily strapped.
- All five deliverables are valid RGBA PNGs at 640×512, safely above 200×200 and below 2048×2048, with transparent corners.
- Chroma/alpha audit passed for every PNG: zero visible exact-`#00ff00` pixels, zero visible pixels matching the shipped keyer's keyable-green predicate, zero hidden RGB in fully transparent pixels, and zero alpha-1-through-9 fringe pixels.
- `git diff --check` passed. The report is LF-only.
- Final Git scope contains only this report and the five requested PNGs. The live stack was not started.

verdict: vfx-present-variants | PNG paths: packages/client/public/sprites/vfx-present-variants/part-1.png; packages/client/public/sprites/vfx-present-variants/part-2.png; packages/client/public/sprites/vfx-present-variants/part-3.png; packages/client/public/sprites/vfx-present-variants/part-4.png; packages/client/public/sprites/vfx-present-variants/part-5.png | prompt used: "Projectile-only in-world sprites, FIVE separate variations of a sinister wrapped gift-box bomb: dark grimy wrapping paper in different colorways (deep red, midnight blue, poison green, dusty purple), fraying ribbon + dented bow, small fuse spark; variants 1-4 similar size, variant 5 noticeably BIGGER and heavier-strapped (the big payload). Each ~4-6 colours, gritty dark-comic cel, hard outlines, readable at small scale. Flat #00ff00 background, one present per image." | pixel dimensions: part-1.png 640×512; part-2.png 640×512; part-3.png 640×512; part-4.png 640×512; part-5.png 640×512
