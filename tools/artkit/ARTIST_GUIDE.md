# Artkit — the Codex art pipeline (setup + workflow + machine transfer)

This is how the game's art gets made: **Codex renders** → the `out/` scratch workspace → **installed** into the
tracked game assets (`packages/client/public/sprites`, `public/cards`, the atlas, the manifests). This guide
sets a **fresh machine** up to do art work, documents the full render→install loop, and explains how to move
the big `out/` workspace between machines (git can't carry it).

---

## 0. What travels through git vs what doesn't

| Thing | In git? | Why |
|---|---|---|
| The **playable game** — all installed sprites, the 10 boss sprites, the 17 base weapon cards, the atlas (`dd-sprites.png/json`), `manifest.ts`, `card-manifest.ts`, all code | ✅ committed | it's the runtime asset set the game loads |
| **`tools/artkit/out/`** — raw Codex renders (~15 GB): candidate sheets, previews, keyed masters, the 297 **expansion** weapon card images | ❌ gitignored | GitHub rejects >100 MB files; 15 GB won't fit. See §3 to move it. |
| **Codex CLI + its login** | ❌ never | it's a globally-installed tool + secret auth tokens in `~/.codex`. Auth must never be committed. See §1. |

So a fresh clone **plays the full game** but has **no Codex** and **no `out/` workspace** — both are set up per machine.

---

## 1. Set up Codex on a new machine (do this once)

The renderer is OpenAI's **Codex CLI**, called by `lib/codex.mjs`. Known-good version on the origin machine:
**`@openai/codex@0.136.0`**.

```bash
# 1. install the CLI globally (npm)
npm install -g @openai/codex@0.136.0        # or latest: npm install -g @openai/codex

# 2. LOG IN (interactive — opens a browser / device flow). THIS IS THE STEP THAT WAS MISSING.
codex login
#    → this writes ~/.codex/auth.json + config.toml. Nothing here is in the repo (by design).

# 3. verify it works
codex exec "reply with exactly: AUTH_OK"     # must print AUTH_OK
```

Notes:
- `~/.codex/` (Windows: `C:\Users\<you>\.codex\`) holds `auth.json` + `config.toml` — that's the whole auth.
- `lib/codex.mjs` **copies** `~/.codex` into an isolated per-generation `CODEX_HOME` (so parallel renders don't
  fight over one config). You only need to `codex login` **once** — artkit handles the rest.
- If a render logs `WARN no ~/.codex … is the codex CLI installed + authed?`, you skipped step 2.

---

## 2. The artist workflow (render → install)

Everything runs from `tools/artkit/`. `out/` is scratch; the **install** steps are what land art in the game.

### 2a. Author subjects
A `subjects-*.json` is a flat array of subjects. Minimum fields: `id`, `name`, `prompt`, `tags`. For art that
must match an existing look, add `styleRef` (a reference image path) and a `palette`. Examples in the repo:
`subjects-bosses.json`, `subjects-bosses3.json` (bosses), `subjects-basecards.json` (weapon cards), `subjects.json`.

```jsonc
{ "id": "kaido", "name": "Kaido the Parry-Dancer", "tier": "boss",
  "styleRef": "out/drifter/identity-ref.png",
  "prompt": "…limbless pill-blob, side-on facing RIGHT on flat green (#00b140)…",
  "palette": { "primary": "#41506B", "accent": "#EDEDED" },
  "tags": ["enemy","boss","character","wild-west"] }
```
Boss/enemy art style = limbless pill-blob, detached hands/feet **outside** the silhouette, flat green `#00b140`
chroma, side-on facing RIGHT. Weapons use `tags:["weapon"]` (drives the card's 1:1-adherence prompt).

### 2b. Render (Codex)
```bash
# generate candidates + auto-promote candidate-1 to identity-ref.png, then generate cardart.png:
SUBJECTS=subjects-x.json PARALLEL=6 node orchestrate.mjs --promote=1
#   --only=id1,id2   restrict to specific subjects
#   (idempotent: re-running only fills what's MISSING — skips a subject that already has ref+cardart)
```
Output lands in `out/<id>/`: `identity-ref.png` (+ `.keyed.png`), `cardart.png` (+ `.keyed.png`), `sheets/`.

### 2c. Install SPRITES (characters / enemies / bosses / in-hand weapons)
```bash
node harvest-install.mjs --ids=kaido,nihil,blade-twins --kind=character
#   slices each identity-ref.keyed.png into parts (body/hand-l/hand-r/foot-l/foot-r),
#   presizes to game-res, copies to public/sprites/<id>/, regenerates src/sprites/manifest.ts,
#   and REPACKS the atlas (dd-sprites.png/json). --kind=weapon for weapons.
```
Then **wire the sprite id** so the game uses it:
- **enemies/bosses:** set `ENEMY_KINDS["<id>"].sprite = "<id>"` in `packages/shared/src/enemies.ts` (was `"boothill"`).
- **weapons:** already auto-resolved by `WEAPON_IDS`; no wiring needed.

### 2d. Install CARDS (weapon carousel art, §9)
```bash
# 1. write the weapon-id allowlist (so character/boss cardart never leaks into the weapon carousel):
node --input-type=module -e "import * as S from '@dd/shared'; import fs from 'node:fs'; const ids=[...new Set([...(S.WEAPON_IDS||[]),...(S.EXPANSION_WEAPON_IDS||[]),...Object.keys(S.WEAPONS||{})])]; fs.writeFileSync('tools/artkit/weapon-ids.tmp.json', JSON.stringify(ids));"
# 2. presize every rendered cardart.png → public/cards/<id>.jpg (sharp, 460px, q82 — ~25KB each):
node tools/artkit/install-cards.mjs
# 3. regenerate the manifest the carousel preloads from:
node tools/artkit/gen-card-manifest.mjs
```
Only **non-expansion** weapon cards preload at boot (the carousel shows `WEAPON_IDS`, the base arsenal). The 297
`expansion:true` weapons are gated out of the live game until promoted (clear their `expansion` flag), so their
cards can be installed but won't display yet.

### 2e. Gate + commit
```bash
pnpm --filter @dd/shared build && pnpm -r typecheck && pnpm test && pnpm lint && pnpm gen:check
```
The installed assets under `public/` + the regenerated manifests are all **tracked** — commit them and they
travel via git to the other machine. (Only `out/` stays local.)

---

## 3. Moving the 15 GB `out/` workspace between machines

Git can't (15 GB, >100 MB files). Two paths:

### Option A — TRANSFER a trimmed copy (recommended, ~4 GB)
Of the 15 GB, **~9.9 GB is candidate `sheets/`** and **~3.7 GB is review `*.preview.png`** — both are
pick-time leftovers. What you need to keep working (re-slice / re-install / promote **without re-rendering**) is
just the promoted refs + card masters + sliced parts (~3–4 GB).

```bash
# on the SOURCE machine — build a slim copy that drops sheets/ + previews:
node tools/artkit/pack-out.mjs           # → creates tools/artkit/out-transfer/ (~4 GB)
```
Then move `out-transfer/` to the other machine's `tools/artkit/out/` by whichever is easiest:
- **USB drive** — copy the folder, plug in, copy into place. Simplest offline.
- **Same LAN** — serve it and pull it:
  `cd tools/artkit && npx --yes serve out-transfer -l 8099` on the source, then on the target
  download it (browser, or `wget -r`), or just use a Windows file share / `robocopy \\SOURCEPC\share out`.
- **Cloud** — zip `out-transfer/` (`tar -cf out-transfer.tar out-transfer` — PNGs are already compressed, don't
  bother gzipping), upload to your Google Drive / Dropbox / WeTransfer, download on the target, extract into
  `tools/artkit/out/`.

Keep the whole 15 GB only if you want to **re-pick** candidates later (the `sheets/`); otherwise the trim is enough.

### Option B — RE-RENDER on the other machine (no transfer)
Every `subjects-*.json` **is committed**, so with Codex set up (§1) you can regenerate `out/` from scratch:
```bash
SUBJECTS=subjects-x.json PARALLEL=6 node orchestrate.mjs --promote=1
```
Slower + costs Codex tokens (297 weapons = hours), but needs no file transfer. Good for a few subjects.

---

## 4. File reference
- `orchestrate.mjs` — the render driver (Phase 0 candidates → Phase 0.5 cardart). `SUBJECTS=`, `PARALLEL=`, `CANDIDATES=`, `--promote=N`, `--only=`.
- `harvest-install.mjs` — slice + presize + install SPRITES + regen `manifest.ts` + repack the atlas.
- `install-cards.mjs` — presize→JPEG + install weapon CARDS (needs `weapon-ids.tmp.json`, see §2d).
- `gen-card-manifest.mjs` — regen `src/sprites/card-manifest.ts` from `public/cards/*.jpg`.
- `pack-out.mjs` — build the slim `out-transfer/` for a machine move (§3A).
- `lib/codex.mjs` — the Codex CLI wrapper (per-generation isolated `CODEX_HOME` copied from `~/.codex`).
- `subjects-*.json` — render manifests (committed).
- `out/` — render scratch (gitignored, ~15 GB).
