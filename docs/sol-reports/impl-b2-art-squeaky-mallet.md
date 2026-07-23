# Squeaky Mallet art implementation

## Plan

1. Inspect the ArtKit harvest/install interface and comparable weapon sprites.
2. Generate only `x2-squeaky-mallet` with the supplied prompt, then install `part-1.png`.
3. Verify dimensions, chroma key quality, silhouette, and right-facing orientation.
4. Add the single weapon manifest entry and one `_stub: true` concept row.
5. Run static asset checks and `pnpm typecheck`, review the scoped diff, and commit.

## Progress

- Generated only the Squeaky Mallet subject with the supplied prompt via the Codex image-generation path.
- Preserved the generated 1536×1024 green-screen render at the ignored ArtKit intake path `tools/artkit/out/x2-squeaky-mallet/identity-ref.png`.
- Ran the shipped `guards/chroma-key.mjs`; it removed 77.5% of the source canvas and produced a clean transparent identity reference.
- Ran the shipped weapon slicer; it found exactly one connected component measuring 1181×740.
- Installed through `harvest-install.mjs --ids=x2-squeaky-mallet --kind=weapon --weapon-target=384 --post-key=1`.
- Added exactly one `kind: "weapon"` sprite-manifest entry and one concept `_stub` row with an empty behavior placeholder.

## Verification

- Installed PNG: 384×241 RGBA, one connected weapon part, both dimensions above 200 and below 2048.
- Chroma-key edge audit: 0 green-dominant nontransparent pixels and 0 remaining pixels matching the shipped keyer's keyable-green predicate.
- Direction/content review: head right, handle left, one rigid piece, no character, no impact effect, and no dangling element.
- LF audit: 0 CRLF sequences in all touched text files.
- `node tools/artkit/check-assets.mjs`: PASS — 437 sprite entries / 842 parts; all 351 expansion parts resolved.
- `pnpm typecheck`: PASS.

Verdict: PASS — subject `x2-squeaky-mallet`; PNG `packages/client/public/sprites/x2-squeaky-mallet/part-1.png`; prompt used: "Weapon-only in-world sprite: an oversized cartoon squeaky mallet — bulbous cylindrical vinyl head (bright red/pink), short wooden handle with taped grip. Rigid one-piece weapon, no dangling parts. Slight scuffs and worn paint. Gritty dark-comic cel, ~4–8 colours. Flat orthographic side profile, faces RIGHT with the mallet head to the RIGHT. Flat #00ff00 background. No character, no impact effect."; pixel dimensions 384×241.
