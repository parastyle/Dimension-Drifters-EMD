# B19 wingchun single foot wrap rework

## Plan

1. Inspect the blob-foot shape reference and defective wrap palette reference.
2. Read the shipped ArtKit harvest/install conventions without starting the live stack.
3. Generate the exact requested single-foot subject on flat `#00ff00`.
4. Install the keyed PNG at `packages/client/public/sprites/x2-wing-chun-wraps/part-2.png`.
5. Verify dimensions, chroma-key quality, one-item composition, closed blob silhouette, and absence of digits or dangling elements.
6. Commit only the art asset and this report on `sol/b19-art-wingchun-foot`.

## Generation and install

- Read `proto-cowboy-hidden-face/foot-l.png` as the blob-foot shape reference.
- Read `x2-wing-chun-wraps/part-1.png` as the wrap palette reference only.
- Generated one candidate with the built-in image generator using both references.
- Processed the flat-green candidate with the shipped ArtKit guard:
  `node guards/chroma-key.mjs --despill=1 out/x2-wing-chun-wraps/part-2.png`
- Promoted only the keyed PNG to the requested install path. The installed SHA-256 matches the keyed ArtKit output: `21F373373FDC78FD3285EC04B8BA37C6AE58962A9AF86594D38D618C2F2A942A`.

## Prompt used

```text
Weapon-part sprite: a SINGLE wrapped training foot for a cartoon blob character — a rounded DOME boot shape (flat base, domed top) with NO toes, NO digits,
wrapped in clean white cloth bands wrapped precisely and tightly, with a small red endless-knot emblem on the cuff band. Rounded closed silhouette that reads as a bandaged
blob foot at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.
EXACTLY ONE single foot — never a pair, no second copy anywhere in frame. Flat #00ff00
background. No character, no limb, no scenery — the wrapped foot only.
```

## Verification

- Native PNG: 1391 × 1131 RGBA; above 200 × 200 and below 2048 × 2048.
- Alpha/keying: 957,516 fully transparent pixels; 615,705 fully opaque pixels; zero remaining visible pixels matching the ArtKit key-green predicate.
- Alpha structure: exactly one visible connected component (615,705 pixels), with zero green-dominant visible pixels.
- Visible subject bounds: 1041 × 742 pixels with generous transparent padding.
- Visual review on ArtKit's charcoal preview: one closed rounded dome/flat-base blob foot; no toes, fingers, thumbs, or other digits; no second item; no chain, tassel, rope, or loose wrap end.
- Scope check: only the requested PNG and this report are tracked changes.

VERDICT: subject id=`x2-wing-chun-wraps/part-2` (wingchun single foot wrap); PNG=`packages/client/public/sprites/x2-wing-chun-wraps/part-2.png`; prompt used=verbatim owner prompt reproduced above; pixel dimensions=1391 × 1131 RGBA; PASS—digit-free and exactly one item.
