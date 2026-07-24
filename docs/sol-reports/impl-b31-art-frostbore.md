# impl-b31-art-frostbore

## Plan

- Inspect the shipped `tools/artkit/harvest-install.mjs` workflow and repository art constraints.
- Generate one Frostbore Scattergun sprite with the owner-supplied prompt, preserving the strict flat right-facing side profile and flat `#00ff00` background.
- Install only `packages/client/public/sprites/x2-frostbore-scattergun/part-1.png`.
- Validate PNG format, native dimensions, chroma-key border/background cleanliness, subject bounds, and the requested art-only change scope.
- Append generation and validation results, ending with the required verdict line.

## Implementation

- Generated exactly one subject with the owner-supplied prompt using the built-in image-generation path.
- Promoted the 1971×798 candidate to `tools/artkit/out/x2-frostbore-scattergun/identity-ref.png`.
- Ran the shipped ArtKit chroma keyer and weapon slicer. The keyer removed 75.7% of the canvas, and the slicer found exactly one connected 1808×459 weapon part.
- Applied the same pinned full-despill post-key pass used by `harvest-install.mjs --post-key=1`.
- Overwrote only `packages/client/public/sprites/x2-frostbore-scattergun/part-1.png`; manifest, catalog, atlas, and shared wiring remain untouched for the B31 integrator.

## Verification

- Visual inspection: PASS — one heavy frost-crusted double-barrel scattergun in strict flat full side profile, dark wrapped stock left, icy blue-steel barrels right, hard dark-comic outlines, no character, scene, aura, chain, tassel, or dangling element.
- Native-size gate: PASS — RGBA PNG at 1808×459, greater than 200×200 and less than 2048×2048.
- Chroma-key inspection: PASS — transparent corners, exactly one alpha-mask component, zero keyable-green pixels and zero green-dominant pixels at nonzero alpha.
- `node tools/artkit/check-assets.mjs`: PASS — 478 sprite entries, 1007 parts, and 635 atlas frames resolved.
- Scope and whitespace checks: PASS — the tracked scope is the requested PNG plus this report; `git diff --check` is clean.
- No live stack was started.

Verdict: `x2-frostbore-scattergun` PASS; PNG `packages/client/public/sprites/x2-frostbore-scattergun/part-1.png`; prompt used: "Weapon-only in-world sprite (no character, no background): a heavy frost-crusted double-barrel scattergun, icy blue-steel barrels rimmed with hoarfrost, dark wooden stock with frozen leather wrap, STRICT FLAT ORTHOGRAPHIC FULL SIDE-PROFILE (no perspective, no three-quarter view), barrels pointing RIGHT, stock LEFT, ~5 colours, gritty dark-comic cel with hard outlines. Flat #00ff00 background."; pixel dimensions: 1808×459.
