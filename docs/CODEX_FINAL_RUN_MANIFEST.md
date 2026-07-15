# CODEX FINAL RUN — asset manifest (≈2 days of image generation left)

Codex image access ends in ~2 days (from 2026-07-14). This is the prioritized spend: every pack lists
what it is, why it earns its slot, the count, the spec, and which generator runs it (existing script vs
a new factory cloned from `tools/artkit/gen-particle-packs.mjs` — the proven resumable pattern:
cluster render → chroma-key → slice → manifest codegen, concurrency 8, skips existing raws so runs
survive restarts).

**Ground rules for the run:**
- Everything goes through a RESUMABLE factory script — never hand-run one-offs; a crash at image 400
  must not lose the night.
- Painted style locked to the existing look (the weapon/particle/vista suite) via `styleRef` images,
  same as `subjects-vfx-300.json` does today.
- Chroma-key `#00ff00` for anything that needs transparency; JPG for full-frame art (cards, vistas).
- Verify each pack in-game the morning after (dev portal deep-links), so there's time to re-run rejects.

**Coverage audit (2026-07-14):** weapons 317 (≈5 missing sprites) · enemies 49 (7 missing, 3 of them
bosses) · dimensions 5 but only **1 floor tile file** · POIs 6 generic (not themed) · decals 9 generic ·
weapon cards 17/317 · particles 48 packs · characters 40 sprited of 50 concepts · UI 6 border files.

---

## P0 — the game you actually look at (Day 1, daytime: ~350 renders)

### P0.1 Dimension terrain kits — the single biggest visual win
Top-down arenas are the PRIMARY mode and the floor under every fight is procedural vector fill with
ONE painted tile in `public/tiles/`. A painted terrain kit per dimension changes every second of play.

Per dimension (wild-west, frostfell, verdant-ruins, ashlands, neon-cyber), 5 kits:
- 4 seamless ground tiles (512px, tileable, low-contrast so entities read on top)
- 2 large ground patches / transition blobs (chroma-keyed, ~768px: dry lakebed, ice sheet, moss field…)
- 1 pit-rim texture strip (the pit edges are currently vector)
- 6 small scatter props (pebbles/tufts/shards — cheap depth everywhere)
- **Count: 5 dims × 13 = 65 renders.** Generator: extend `gen-tiles.mjs` into `gen-terrain-kits.mjs`.
- In-game: `floor-renderer.ts` picks the kit by `dimensionId` (wire-up is our job, not Codex's).

### P0.2 Themed POI + decal packs (replaces the 6-generic-for-everything set)
Landmarks/decals are shared across all 5 dimensions today, so the frost dimension has the same props
as the desert.
- POIs: 5 dims × 7 props (each dim: 2 large landmarks, 3 mid cover pieces, 2 small) = **35 renders**
- Decals: 5 dims × 8 ground stains (cracks, bones, tracks, graffiti, scorch, frost-shatter…) = **40 renders**
- Generator: `gen-decals.mjs` already does packs (`--pack=pois|decals`) — add `--dim=` theming.

### P0.3 Missing weapon sprites (players hold these RIGHT NOW)
`x-sword-whirlwind` (Dervish Greatblade — the Garen spin!), `x-gun-hand-mortar`, `x-staff-arcane-lance`,
`x-staff-storm-rod`, and verify `gravediggers-spade` (has card art; confirm whether its sprite rides the
dd-sprites atlas or is genuinely missing). Same pipeline as the 300-weapon run (subjects file + identity
refs exist). **Count: ~5 weapons × 2 views = 10 renders.** Generator: existing weapon pipeline via
`orchestrate.mjs`.

### P0.4 Missing enemy + boss art
`old-rust`, `world-titan` boss rigs; `ronin`, `gatlin`, `vault-ronin`, `dust-ranger` regulars; a painted
`dummy` skin (training grounds is the most-visited room in dev). `dimensional-colossus` stays procedural
by design (partial-body §27) — but give it **2 painted body plates + 1 fist** so the parts it does show
are painted. **Count: ~9 subjects × 3 parts = 27 renders.** Generator: character/enemy pipeline
(`gen-character-roster.mjs` pattern).

### P0.5 Menu dimension key-art
The top-down menu cards for the 5 dimensions (the belt vistas cover 4 themes but there is no wild-west
vista and the menu deserves its own 16:9 key frames). **Count: 5 renders (1200×675 JPG).**

---

## P1 — the big overnight batch (Day 1 night: ~350 renders, resumable)

### P1.1 Weapon card art factory — 300 cards
17/317 weapons have bespoke card art; every other card in the carousel/shop/draft falls back to the
sprite thumbnail. This is the particle-factory play: one resumable overnight run.
- Spec: 600×840 JPG, painted weapon hero-shot on a dimension-flavored backdrop, rarity-neutral
  (frames/tint come from code).
- Source: `data/weapon-concepts-300.json` + each weapon's `identity-ref.png` as styleRef (already on
  disk in `out/<id>/` from the sprite run).
- **Count: 300 renders.** Generator: NEW `gen-card-factory.mjs` (clone the particle factory skeleton,
  emit via `gen-card-manifest.mjs`).
- Skip list: the 17 done + the 2 banned whips.

---

## P2 — depth + polish (Day 2 daytime: ~250 renders)

### P2.1 Particle expansion (the factory is already written — cheapest wins in the doc)
- +4 elements × 6 shapes: **blood/gore, sand/earth, water/brine, nature/spore** = 24 packs ≈ 260
  particles → but at ~11 per pack the render cost is ~24 cluster renders. **Count: ~24 renders.**
- +2 shapes × existing 8 elements: **spark** (tiny hot chips for hits) and **splat** (directional smears
  for kills/walls) = 16 packs. **Count: ~16 renders.**
- Generator: `gen-particle-packs.mjs` untouched — just extend its element/shape tables.

### P2.2 Character portraits — 50
Head-and-shoulders painted portraits for the character select / HUD / future dialogue. Concepts +
existing sprite identity refs are on disk. Spec: 512×512 JPG. **Count: 50 renders.**

### P2.3 UI icon set — ~36 icons
Everything is text today. Chroma-keyed painted icons, 128px:
- 5 stats (STR/DEX/INT/CON/LUK), 3 classes (melee/ranged/caster), 6 rarities (gem set)
- currency (scrip), salvage, drop, grab-hand, parry, jump
- ~12 augment-category glyphs, 2 misc (mystery "?", boss skull)
**Count: ~36 renders.** Generator: NEW `gen-ui-icons.mjs` (decals pipeline with a fixed grid).

### P2.4 Shopkeeper + wild-west belt completion
- Shopkeeper NPC (idle pose + portrait): 3 renders
- `bg-wild-west.png` + `deck-wild-west.png` so the shelved belt mode isn't missing its 5th theme if it
  returns: 2 renders. **Count: 5 renders.**

---

## P3 — stretch (Day 2 night, whatever budget remains)

1. **Boss splash frames** — 17 bosses × 1 wide intro splash (used by a future boss-intro banner). 17 renders.
2. **Element impact flipbooks** — 8 elements × 6-frame hit flipbook (48 renders) for melee connects.
3. **Title key art** — 3 candidate 4K title-screen paintings. 3 renders.
4. **Victory/defeat banners** — 2 renders.
5. **Emote/pin set** — 8 painted pings (attack here, help, retreat…) for co-op comms. 8 renders.

---

## Schedule

| Slot | Packs | ~Renders |
|---|---|---|
| Day 1 day | P0.1–P0.5 (terrain, POIs/decals, missing weapons/enemies, menu art) | ~180 |
| Day 1 night | P1.1 card factory (resumable, unattended) | ~300 |
| Day 2 morning | verify card run in portal, re-render rejects | ~30 |
| Day 2 day | P2.1–P2.4 (particles, portraits, icons, shopkeeper) | ~115 |
| Day 2 night | P3 stretch in listed order until access ends | ~78 |

Total ≈ 700 renders — comfortably inside proven throughput (the particle run did 519 in one night).

**Priority rule if anything slips:** P0 > P1 > P2.1 > P2.3 > P2.2 > rest. Terrain kits are the one pack
that must not be sacrificed — they're the only pack the player stares at 100% of the time.
