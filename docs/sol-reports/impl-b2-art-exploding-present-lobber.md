# Exploding Present Lobber Art Sol Report

Subject: `x2-exploding-present-lobber`

Plan:

1. Inspect the shipped ArtKit harvest/install workflow, existing weapon sprites, manifest entries, concept stubs, and static verification commands.
2. Generate only the Exploding Present Lobber with the supplied prompt verbatim.
3. Install the selected chroma-key sprite at `packages/client/public/sprites/x2-exploding-present-lobber/part-1.png`.
4. Add one weapon manifest entry and one `_stub: true` concept row without implementing behavior.
5. Verify PNG dimensions, chroma-key cleanliness, syntax, and `pnpm typecheck`; inspect the final sprite visually.
6. Review the scoped diff and commit it on `sol/b2-art-exploding-present-lobber`.

Progress:

- Generated exactly one subject with the supplied prompt unchanged.
- The shipped chroma-keyer removed 64.0% of the source canvas; the keyed master has zero visible keyable-green pixels.
- Visual review confirmed a weapon-only, right-facing, connected launcher with a rigid attached bow/ribbon treatment and no projectile.
- ArtKit found one connected component and harvested it as a single `part-1.png` with zero offsets.
- Added one minimal `_stub: true` concept row without behavior or stats.

Verification:

- Installed PNG: 512×224 RGBA; native dimensions are greater than 200×200 and less than 2048×2048.
- Chroma/alpha: zero visible keyable-green pixels, zero green-dominant visible pixels, zero hidden green RGB, and zero alpha-1–9 fringe pixels after the shipped post-resize key pass and alpha cleanup.
- `pnpm assets:check`: passed (437 sprite entries, 842 parts, 351 loose expansion parts).
- `pnpm typecheck`: passed for shared, client, and server.
- Concept JSON: 325 declared rows and 325 actual rows; exactly one `x2-exploding-present-lobber` `_stub` row with behavior fields absent.
- Manifest: exactly one `x2-exploding-present-lobber` weapon entry with one part and zero offsets.
- Line endings: LF-only in every touched text file.

Verdict: `x2-exploding-present-lobber` | PNG: `packages/client/public/sprites/x2-exploding-present-lobber/part-1.png` | Prompt: "Weapon-only in-world sprite: a stubby underslung grenade-launcher — barrel is a wrapped gift box (dark grimy paper with a fraying ribbon and dented bow), pistol grip, iron trigger housing. Rigid, no swinging bow. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the present-muzzle to the RIGHT. Flat #00ff00 background. No character, no projectile." | Dimensions: 512×224
