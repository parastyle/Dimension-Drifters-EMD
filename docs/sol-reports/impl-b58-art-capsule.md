# impl-b58-art-capsule

## Plan — 2026-07-25

- Generate the sealed `dimensional-capsule` state from the owner-supplied part-1 prompt through the shipped ArtKit harvest/install workflow.
- Generate the open state as a constrained edit of the sealed state from the owner-supplied part-2 prompt, preserving canvas, orientation, body silhouette, palette, insignia, and pod footprint.
- Install only `packages/client/public/sprites/dimensional-capsule/part-1.png` and `packages/client/public/sprites/dimensional-capsule/part-2.png`.
- Validate both PNGs are native dimensions above 200×200 and below 2048×2048, have a flat `#00ff00` key background, contain no green fringe or banned dangling/radial elements, and register without a state-swap pop.
- Record the final prompts, dimensions, key/registration checks, and commit both PNGs plus this report on `sol/b58-art-capsule`.

## Result — 2026-07-25

Generated through the shipped ArtKit isolated Codex/image-harvest path. The open state used the sealed state as its image input. Both states were staged as ArtKit parts, passed through `tools/artkit/guards/chroma-key.mjs` with full despill, rebuilt over exact `#00ff00`, and installed with:

```text
node harvest-install.mjs --ids=dimensional-capsule --kind=prop --presize=0
```

The harvester's generated `manifest.ts` change was intentionally discarded, and the atlas pack was not produced because its optional module was unavailable. No manifest, catalog, shared, runtime, or atlas edit is included in this art-only delivery.

### Prompts used

Part 1:

```text
Prop-only in-world sprite (no character, no background): a SEALED dimensional resupply capsule —
a squat armored drop-pod, roughly barrel-proportioned with a heavy blast-scorched base and four
stubby landing fins, riveted gunmetal plating with a single bold hazard-striped band, a small
glowing indicator light, and a stenciled police-issue insignia panel (badge-like shield stencil,
no readable text). Gritty dark-comic cel treatment, hard outlines, ~5-7 colours, readable
silhouette at small scale. Flat orthographic side view. Flat #00ff00 background.
```

Part 2:

```text
Prop-only in-world sprite: the SAME dimensional resupply capsule from part-1, now OPEN — identical
pod body, palette, proportions, insignia and registration, but the front hatch has split/hinged
wide to reveal a lit interior armory rack with weapon silhouettes racked inside and a soft glow
spilling out. Same size, same orientation, same side view as part-1 so the two states swap in
place. Gritty dark-comic cel, hard outlines. Flat #00ff00 background.
```

### Validation

- `part-1.png`: 1254×1254 RGB PNG; 1,832,144 bytes.
- `part-2.png`: 1254×1254 RGB PNG; 1,843,757 bytes.
- Both are above 200×200 and below 2048×2048.
- Both canvases are identical and both keyed subject bounds are exactly `x=82..1167`, `y=95..1121` (`1086×1027`), confirming same pod footprint and in-place state registration.
- Installed backgrounds are exact `#00ff00`; the final shipped-keyer validation removed 46.3% for sealed and 46.0% for open.
- Both keyed QA outputs had zero partially transparent pixels and zero green-dominant opaque pixels, confirming a clean key with no green fringe.
- Visual inspection confirms one capsule subject, four landing fins, the single hazard band, badge-like no-text insignia, sealed/open state readability, and no chains, tassels, ropes, cables, dangling elements, ambient/radial effects, player-aura framing, labels, or watermark.
