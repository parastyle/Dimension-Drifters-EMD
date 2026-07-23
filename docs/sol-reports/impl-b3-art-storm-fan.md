# impl-b3-art-storm-fan

## Plan

- Generate only `x2-storm-fan` with the exact owner-supplied prompt.
- Inspect the generated image for a weapon-only crossed-fan silhouette, right-facing presentation, flat `#00ff00` background, banned-element compliance, and absence of lightning.
- Key and slice the approved source through the shipped ArtKit guards, then install it with `tools/artkit/harvest-install.mjs`.
- Add one `x2-storm-fan` manifest entry through the harvester and one `_stub: true` concept row with behavior fields left blank for the catalog integrator.
- Verify PNG dimensions, clean chroma keying, JSON/TypeScript syntax, `pnpm typecheck`, scoped git diff, LF endings, and commit on `sol/b3-art-storm-fan`.

## Generation prompt

"Weapon-only in-world sprite: a pair of open war fans held crossed (X shape) — steel ribs, dark ink-blue lacquer, cloudy storm-motif ink on the surfaces, small silver electric etchings on the guards. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT, crossed fans overlapping. Flat #00ff00 background. No character, no lightning."

## Progress

- Plan recorded before generation.
- Generated one candidate with the exact supplied prompt and promoted only that Storm Fan subject.
- The shipped chroma-key guard removed 62.3% of the 1536×1024 source canvas.
- The shipped slicer found one connected 1420×829 weapon component and emitted `part-1.png`.
- `harvest-install.mjs` installed the component at 384×224, added one weapon manifest entry, and ran its post-resize chroma-key pass.
- Added one `x2-storm-fan` `_stub: true` concept row with an empty behavior placeholder; the declared count and row count are both 325.

## Verification

- Installed PNG: 384×224 RGBA, transparent at all four corners, zero residual keyable-green pixels, and zero green-dominant nontransparent pixels.
- Manifest: one weapon part, `part-1.png`, zero offsets, and dimensions matching the installed PNG.
- Prompt: exact equality confirmed between the owner-supplied prompt and the concept stub.
- `git diff --check`: pass.
- LF-only touched text: pass.
- `pnpm typecheck`: pass.
- `pnpm assets:check`: pass.

Verdict: PASS — `x2-storm-fan` — `packages/client/public/sprites/x2-storm-fan/part-1.png` — prompt: "Weapon-only in-world sprite: a pair of open war fans held crossed (X shape) — steel ribs, dark ink-blue lacquer, cloudy storm-motif ink on the surfaces, small silver electric etchings on the guards. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT, crossed fans overlapping. Flat #00ff00 background. No character, no lightning." — 384×224 px
