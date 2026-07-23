# Boomerang Boot Art Sol Report

Subject: `x2-boomerang-boot`

Plan:

1. Inspect repository art conventions and the shipped ArtKit harvest/install workflow.
2. Generate only the Boomerang Boot using the required prompt verbatim.
3. Install and visually verify `packages/client/public/sprites/x2-boomerang-boot/part-1.png`.
4. Add exactly one weapon manifest entry and one `_stub: true` concept row.
5. Run chroma-key, dimensions, syntax, and typecheck gates without booting the live stack.
6. Review the isolated diff and commit it on `sol/b2-art-boomerang-boot`.

## Implementation log

- Generated one source plate for `x2-boomerang-boot` with the required prompt unchanged.
- Staged the 1536×1024 source as ArtKit's ignored `identity-ref.png`.
- Ran the shipped chroma-keyer; it removed 78.8% of the source plate and produced a true-alpha keyed source.
- Ran `harvest-install.mjs --ids=x2-boomerang-boot --kind=weapon --post-key=1`. ArtKit detected one connected 860×895 weapon part, presized it to 246×256, post-keyed the resized edge, installed `part-1.png`, added the generated weapon manifest row, and repacked the sprite atlas.
- Added one catalog stub with an empty behavior placeholder and `_stub: true`; no gameplay definitions, behavior logic, stats, generators, or live-stack files were changed.

## Verification

- PNG audit: 246×256 RGBA; all four corners transparent; zero visible pixels matching ArtKit's key-green rule; zero visible green-dominant pixels.
- Catalog audit: declared count 325 equals 325 rows; exactly one `x2-boomerang-boot` stub exists.
- Manifest audit: exactly one `x2-boomerang-boot` weapon entry with one `part-1` and zero offsets.
- Line-ending audit: zero CR bytes in every touched text file.
- `pnpm assets:check`: PASS — 437 sprite entries, 842 parts, and 491 atlas frames validated.
- `pnpm typecheck`: PASS.
- Live stack: not started.

Verdict: PASS — subject id `x2-boomerang-boot`; PNG path `packages/client/public/sprites/x2-boomerang-boot/part-1.png`; prompt used: "Weapon-only in-world sprite: a heavy-soled work boot shaped into an aerodynamic boomerang — leather uppers, iron toe cap, curved sole formed like a boomerang's L-arc, laces tied off short. Rigid one piece. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the toe pointing UP-RIGHT to imply throw direction. Flat #00ff00 background. No character, no motion lines."; pixel dimensions: 246×256.
