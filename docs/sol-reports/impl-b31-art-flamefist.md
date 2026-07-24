# Sol Report — impl-b31-art-flamefist

## Plan

- Confirm the isolated worktree, branch, ArtKit harvest/install conventions, and existing sprite-part precedents.
- Generate one registered two-part flame-fist subject with the supplied prompt: a digitless wrapped oval mitt and a matching flame sheath overlay on flat `#00ff00`.
- Harvest and install only `packages/client/public/sprites/x2-emberfist-wraps/part-1.png` and `part-2.png`.
- Inspect both PNGs visually and validate native dimensions, chroma-key cleanliness, registration, file format, and allowed Git scope without starting the live stack.

## Execution

- Generated one two-panel identity plate with the supplied prompt unchanged.
- Staged the plate under `tools/artkit/out/x2-emberfist-wraps/`, separated its two model-authored panels, and ran the shipped `guards/chroma-key.mjs` keyer with full despill.
- Chroma-key removal measured 57.7% for the wrapped mitt panel and 50.7% for the flame sheath panel.
- Reassembled the keyed panels as one ArtKit identity source and ran `guards/slice.mjs` as a two-part weapon subject. The slicer retained exactly two connected components and rejected detached flame flecks below the component threshold.
- Normalized both parts to one shared 576×896 frame. Their nontransparent bounds have the same center `(287.5, 447)`, so the flame sheath registers directly over the wrapped mitt.
- Made the flame sheath a real alpha overlay: its connected layered flame remains visible while the wrapped cloth reads beneath it in the composite.
- Installed through `harvest-install.mjs` with presizing disabled so the registered native frames were copied unchanged.
- Restored the integrator-owned sprite manifest after harvest. The optional atlas repack could not load its packer dependency and produced no atlas change; atlas/catalog wiring is intentionally outside this art-only assignment.

## QA

- Visual inspection passed: one plain oval mitt, no fingers, thumb, chains, tassels, dangles, player aura, or extra fist.
- Visual composite inspection passed: one coherent orange-red flame sheath with a white-hot upper edge; no particle cloud.
- Both outputs are valid RGBA PNGs at 576×896, with transparent corners and dimensions inside the required native range.
- Key cleanliness passed with zero retained keyable-green pixels in either installed PNG.
- `part-1.png` is 691,636 bytes; `part-2.png` is 878,811 bytes.
- `git diff --check` passed.
- Final Git scope contains only this report and the two requested PNGs.
- The live stack was not started.

verdict: x2-emberfist-wraps | PNG paths: packages/client/public/sprites/x2-emberfist-wraps/part-1.png; packages/client/public/sprites/x2-emberfist-wraps/part-2.png | prompt used: "TWO-PART subject, generate part-1 first then part-2 matched to it. Part-1: a SINGLE wrapped training fist for a cartoon blob character — plain OVAL mitt shape, NO fingers, NO thumb, wrapped in charcoal-black fight-cloth bands with ember-orange stitching, ~4-6 colours, gritty dark-comic cel, EXACTLY ONE fist, flat #00ff00 background. Part-2: a FLAME SHEATH overlay matching part-1's exact silhouette — the same oval outline engulfed in layered orange-red flame with white-hot knuckle edge, designed to composite directly OVER part-1 at identical registration, flat #00ff00 background." | pixel dimensions: part-1.png 576×896; part-2.png 576×896
