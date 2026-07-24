# B19 Wing Chun Single Hand Wrap Rework

## Plan — 2026-07-23

1. Inspect the blob-hand shape reference, defective wrap palette reference, repository instructions, and shipped ArtKit harvest/install conventions.
2. Generate exactly one oval wrapped blob fist with the supplied verbatim prompt, using the references only for silhouette and palette guidance.
3. Reject any result containing fingers, a thumb, digits, a second item, or dangling chain/tassel/rope elements.
4. Process and install the clean keyed PNG at `packages/client/public/sprites/x2-wing-chun-wraps/part-1.png`.
5. Verify native dimensions, clean keying/no green fringe, and a closed single-item blob silhouette; append the evidence and final verdict to this report.
6. Commit only the replacement PNG and this report on `sol/b19-art-wingchun-hand`.

## Pipeline record

- Shape reference read: `packages/client/public/sprites/proto-cowboy-hidden-face/hand-l.png` — compact, finger-free egg/blob hand.
- Palette reference read: prior `packages/client/public/sprites/x2-wing-chun-wraps/part-1.png` — white cloth, dark ink shading, and red endless-knot cuff emblem only; its human fingers and elongated anatomy were explicitly rejected.
- Generation: built-in image generation using both local references and the owner-supplied prompt verbatim.
- ArtKit processing: staged as `tools/artkit/out/x2-wing-chun-wraps/identity-ref.png`, keyed with the shipped `guards/chroma-key.mjs` at full despill, then sliced as a weapon with the shipped `guards/slice.mjs`.
- Install: copied the sole connected component, `parts/part-1.png`, over the requested tracked sprite. `harvest-install.mjs` itself was not run because it also rewrites the shared sprite manifest and atlas, which this art-only order explicitly forbids.

## Generation prompt

```text
Weapon-part sprite: a SINGLE wrapped training fist for a cartoon blob character — a plain OVAL mitt shape (like an egg) with NO fingers, NO thumb, NO knuckle digits,
wrapped in clean white cloth bands wrapped precisely and tightly, with a small red endless-knot emblem on the cuff band. Rounded closed silhouette that reads as a bandaged
blob fist at small scale, ~4-6 colours, gritty dark-comic cel treatment with hard outlines.
EXACTLY ONE single fist — never a pair, no second copy anywhere in frame. Flat #00ff00
background. No character, no limb, no scenery — the wrapped fist only.
```

## Verification

- Installed PNG dimensions: 1121×912 RGBA, satisfying the greater-than-200×200 and less-than-2048×2048 native-size limits.
- Chroma-key removal: 49.8% of the source canvas removed by the pinned ArtKit keyer.
- Component count: exactly 1 component at the slicer's alpha threshold.
- Alpha inspection: all four corners transparent; 231,996 transparent pixels and 790,356 visible pixels.
- Fringe inspection: 0 visible green-dominant pixels and 0 visible key-green pixels after full despill.
- Visual inspection: exactly one closed rounded wrapped mitt; zero fingers, thumbs, knuckle digits, toes, characters, limbs, duplicate items, chains, tassels, ropes, or dangling wrap ends.

VERDICT: PASS — subject id `x2-wing-chun-wraps` (wingchun single hand wrap); PNG `packages/client/public/sprites/x2-wing-chun-wraps/part-1.png`; prompt used: exact verbatim owner prompt reproduced above; 1121×912 RGBA; digit-free: confirmed; single-item: confirmed.
