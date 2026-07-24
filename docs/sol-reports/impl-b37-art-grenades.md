# impl-b37-art-grenades

## Plan

1. Inspect the shipped ArtKit harvest/install conventions and confirm the isolated branch/worktree state.
2. Generate the Quicksilver Streetsweeper grenade and matching explosion from the exact supplied prompt on flat `#00ff00`.
3. Install only `part-1.png` and `part-2.png` under `packages/client/public/sprites/vfx-streetsweeper-grenade/`.
4. Validate PNG format, native dimensions, chroma-key cleanliness, subject framing, and scope.
5. Append results to this report and commit only the two PNGs plus this report.

## Implementation

- Confirmed isolated worktree branch: `sol/b37-art-grenades`.
- Generated through `tools/artkit/lib/codex.mjs` using an isolated ArtKit Codex home and ArtKit image harvesting.
- Rejected the first harvested candidate because it contained only the explosion and omitted the grenade.
- Accepted the second harvested attempt, which produced separate grenade and explosion images in the same generation run.
- Installed only:
  - `packages/client/public/sprites/vfx-streetsweeper-grenade/part-1.png`
  - `packages/client/public/sprites/vfx-streetsweeper-grenade/part-2.png`
- Applied the pinned ArtKit keyer with:
  - `node tools/artkit/guards/chroma-key.mjs --in-place=1 --preview=0 --despill=1 ...`
- Made no manifest, catalog, shared-code, or live-stack changes.

## Prompt

> TWO related subjects. Part-1: a stubby 40mm-style grenade shell projectile, gunmetal body with a quicksilver-chrome band and dull brass tip, ~4-5 colours, gritty dark-comic cel, flying RIGHT. Part-2: a matching compact EXPLOSION burst — layered orange-white core with gunmetal debris flecks and a chrome glint ring, round readable silhouette, ~5-7 colours, same cel style. Flat #00ff00 background each.

## Validation

| Asset | Native dimensions | Transparent pixels | Visible bounds | Corner alpha | Visible green spill | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `part-1.png` | 1536×1024 | 1,249,218 | 1120×401 | 0,0,0,0 | 0 px | PASS |
| `part-2.png` | 1254×1254 | 1,050,594 | 930×921 | 0,0,0,0 | 0 px | PASS |

Both files are native PNGs with alpha, exceed 200×200, remain below 2048×2048, have transparent corners, and key cleanly without visible `#00ff00` spill.

VERDICT: PASS — subject `vfx-streetsweeper-grenade`; grenade `packages/client/public/sprites/vfx-streetsweeper-grenade/part-1.png` (1536×1024); explosion `packages/client/public/sprites/vfx-streetsweeper-grenade/part-2.png` (1254×1254); prompt used verbatim as recorded above.
