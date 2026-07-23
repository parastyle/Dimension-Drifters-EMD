# Sol Report: Confetti Cannon

## Plan

- Inspect the shipped ArtKit harvester and comparable `x2-*` weapon assets.
- Generate only `x2-confetti-cannon` with the supplied prompt, then install `part-1.png`.
- Add one weapon manifest entry and one `_stub: true` concept row with behavior left blank.
- Verify dimensions, chroma-key compatibility, syntax, and `pnpm typecheck`.
- Commit the art-only changes on `sol/b2-art-confetti-cannon`.

## Progress

- Generated one subject with the exact supplied prompt via the built-in image generator.
- Staged a 1536×1024 flat-green source at `tools/artkit/out/x2-confetti-cannon/identity-ref.png`.
- The shipped keyer removed 71.2% of the source canvas; visual review of its charcoal preview showed a clean, right-facing, weapon-only silhouette.
- The shipped slicer found one connected component measuring 1380×693.
- Installed the full-resolution keyed part with `harvest-install.mjs --presize=0 --post-key=1` to satisfy the explicit native-size gate.
- Added the generated weapon manifest entry and one `_stub: true` concept row with blank behavior.

## Verification

- `pnpm assets:check` passed: 437 sprite entries, 842 parts, and 491 atlas frames.
- `pnpm typecheck` passed for shared, server, and client.
- Installed PNG: RGBA, 1380×693, 1,292,178 bytes, transparent at all four corners.
- Key analysis: 0 opaque keyable-green pixels and 0 detected green-fringe pixels after the shipped post-key pass.
- JSON validation: declared concept count 325 equals the 325 rows; exactly one `x2-confetti-cannon` row exists with `_stub: true` and `behavior: {}`.
- The stub is categorized as `ranged`, and the source `byType` census was incremented consistently.
- Targeted data-consistency census test passed.
- `git diff --check` passed; all touched text files contain LF only.
- Final visual inspection passed for weapon-only composition, right-facing muzzle, connected rigid silhouette, and absence of confetti or banned flexible elements.

Verdict: `x2-confetti-cannon` — PNG `packages/client/public/sprites/x2-confetti-cannon/part-1.png` — prompt used: "Weapon-only in-world sprite: a heavy iron party-cannon — wide bell muzzle painted with peeling festive stripes, brass barrel bands, wooden pistol grip. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the bell muzzle to the RIGHT. Flat #00ff00 background. No character, no confetti in the sprite." — 1380×693 pixels.
