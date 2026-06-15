# artkit — game-agnostic card-art pipeline

A drop-in kit for generating **card art** with a consistent house style, using
the `codex` CLI as the image backend. Two outputs per subject:

- **`identity-ref.png`** — the *reference*: the subject alone on transparency, the
  canonical "what does this look like." Reused as the locked character reference
  everywhere downstream.
- **`cardart.png`** — the *card art*: that subject in an action pose, single-render,
  popping off a complementary painted background.

Nothing in here knows about any specific game — it operates on a flat list of
**subjects** (`{ id, name, prompt, palette?, tags?, cardartAction? }`). Drop it in
any repo, point it at your subjects, go.

## Prerequisites

1. **Node 18+**.
2. The **`codex` CLI** installed and authenticated (`codex` must be on PATH and
   `~/.codex/auth.json` present — the kit reads your real `~/.codex` and isolates
   per-generation copies so chats never cross-contaminate).
3. `npm install` (pulls `sharp`, used only by the alpha-repair guard).

## Usage

```bash
# 1. Author your subjects
cp subjects.example.json subjects.json   # then edit

# 2. Generate reference candidates (3 per subject)
node orchestrate.mjs                      # or: PARALLEL=8 node orchestrate.mjs

# 3. Pick a reference per subject — copy your favourite candidate to identity-ref:
#    out/<id>/sheets/candidate-2.png  →  out/<id>/identity-ref.png
#    (or skip manual picking entirely: node orchestrate.mjs --promote=1)

# 4. Generate the card art (reads each picked identity-ref)
node orchestrate.mjs

# 5. (Safety net) repair any reference that came back with a baked-in
#    transparency checkerboard instead of true alpha:
node guards/fix-checkerboard.mjs --all
```

Re-running is **idempotent** — it only fills what's missing, so you can iterate
subject-by-subject. Use `--only=id1,id2` to scope a run.

### Output layout

```
out/
  <subject-id>/
    sheets/candidate-1.png … candidate-3.png   # phase 0 options
    identity-ref.png                            # the one you picked (the reference)
    cardart.png                                 # phase 0.5 (the card art)
```

## Re-skinning the style (the recyclable part)

`style.json` is the single source of truth for the **canon art style** and the
render rules. To re-skin the whole pipeline to a different aesthetic, edit:

- `styleBlock` / `outlineGuidance` / `shadingGuidance` — the house look.
- `referenceFamily` — the named visual references the look is built from.
- `avoidList` — hard "never do this" list.
- `identityRefRenderRules` / `cardartRenderRules` — composition + output rules.
- `bgArchetypes` — the pool of ~30 background treatments the card art rotates
  through (deterministic per subject) so a set doesn't read as 30 identical
  hazy backdrops. `elaborateSceneWeight` controls how often a full painted scene
  is chosen vs. a flat/graphic backdrop.

The bundled style is **"Lythero Cartoon Bold"** — bold cel-shaded cartoon-action
(thick inked outlines, flat punchy saturated color, one shadow tone + one rim
light), built on Lythero raid-boss thumbnails + Genndy Tartakovsky + Studio
Trigger + Guilty Gear key art + Yu-Gi-Oh summon presentation.

## How it works (the proven bits worth keeping)

- **Per-chat isolation** (`lib/codex.mjs`): each generation gets a throwaway
  `CODEX_HOME` (auth/config junctioned from the real one, a fresh
  `generated_images/`). Stops image-gen models from carrying concepts across
  subjects, and lets the pipeline run many subjects in parallel.
- **Harvest, don't trust the sandbox**: codex's sandbox often can't copy its own
  output to a path, so after each run the kit pulls the newest PNG out of that
  chat's `generated_images/` and places it (`harvestTo` / `harvestNames`).
- **Two-phase with a human gate**: reference candidates first (you pick the one
  that's on-model), THEN card art anchored to the picked reference — so a bad
  roll never propagates into the expensive downstream art.
- **Child reaping**: Ctrl-C / kill tears down in-flight codex children instead of
  orphaning paid API calls.

## Notes / knobs

- `PARALLEL` (default 6) — concurrent generations.
- `CANDIDATES` (default 3) — reference options per subject.
- `--promote=N` — auto-pick `candidate-N` as the reference (skip manual review).
- This kit covers **reference + card art** only. Combat sprite sheets, VFX
  overlays, and backgrounds were game-specific in the source project and were
  intentionally left out.

## examples/

Two real reference→cardart pairs produced by this exact pipeline + style, as a
visual target for "on-model":

- `sevran.identity-ref.png` → `sevran.cardart.png` (a demon-pact swordsman)
- `briar.identity-ref.png`  → `briar.cardart.png`  (a brass-heart tinker)

Note how each cardart re-lights and re-poses the flat reference into a dramatic
action beat on a complementary backdrop, while staying the same character.
