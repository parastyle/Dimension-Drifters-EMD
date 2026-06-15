# artkit (Dimension Drifters fork)

Forked from the World Tournament `artkit` card-art pipeline. **We keep the engine; DD authors its own style.** Tracked in-repo per §26 retro #1 (never hand-carried in scratch). Engine internals are documented in [`README.engine.md`](./README.engine.md).

## What this is
A two-phase, Codex-driven generator: per **subject** it makes an `identity-ref.png` (the subject alone on a keyable background) then a `cardart.png` (action pose on a complementary backdrop). Game-agnostic engine; everything DD-specific lives in `style.json` + `subjects.json`.

## DD deltas from the stock engine
- **`style.json` is DD's own** — gritty indie-arcade / dark-comic, HD cel-shaded, limbless characters (§18). It is **`DRAFT v0`** (seeded from spec §18/§14); **refine it when the product-owner art-style doc lands (§24)**, then freeze before any fleet generation (§26 #5).
- **WT's "Lythero Cartoon Bold" is NOT inherited.** Its style file is kept only as `style.reference-wt.json` — a **schema reference**, never generated against. (§18 is explicit: DD's look is its own.)
- **Subjects are mostly weapons** (§14: weapon sprite → card art). `subjects.example.json` holds DD M0 melee examples. The end state is `subjects.json` **generated from weapon data + tags** (§10/§14), not hand-edited.
- **Chroma-key, not transparency.** DD renders the identity-ref on a flat **`#00ff00`** field and keys it out with a deterministic color-key (§18 / `character-style-prompts.md`) — never asks the model for true alpha (§26 retro #2). The bundled `guards/fix-checkerboard.mjs` targets the WT transparent flow; a DD **`#00ff00` chroma-key guard is still TODO**.

## Not in the pnpm workspace
This tool is intentionally excluded from the root workspace (it pulls native `sharp` and needs the external `codex` CLI). Install/run it on demand:

```bash
cd tools/artkit
pnpm install                 # or npm install — pulls sharp
cp subjects.example.json subjects.json   # then edit (or generate from weapon data)
node orchestrate.mjs                      # phase 0: reference candidates
node orchestrate.mjs --promote=1          # auto-pick, or hand-pick per README.engine.md
node orchestrate.mjs                      # phase 0.5: card art
```

## Status
- ✅ Engine forked + tracked. `style.json` is the executable form of **master spec §28** (the art spec; the former standalone art bible was consolidated there).
- ✅ Style anchor baked in (Behemoth × Darkest Dungeon); **reference-image generation** via `subjects.json.styleRef` (attach a golden anchor as Image 1).
- ✅ `guards/chroma-key.mjs` (#00ff00 → transparent) + `guards/contact-sheet.mjs` (flattened-JPEG review sheets).
- ⏳ `subjects.json`-from-weapon-data wiring lands with SPEC-01; per-class golden anchors get promoted as picks land.
