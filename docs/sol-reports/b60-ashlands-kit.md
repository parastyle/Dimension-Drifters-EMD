# B60 — Ashlands terrain kit

Date: 2026-07-25

Branch: `sol/b60-ashlands-kit`

Scope: Ashlands only — four floor tiles and one pit rim.

## Iteration 1 result (v1, `13a7676`)

Ashlands is now a lit ash-grey cel-shaded field rather than a near-black photographic texture. The
four fixed slots carry the navigation roles in order:

| File | Fixed role | Visual history |
| --- | --- | --- |
| `tile-0.png` | quiet bed | broad, plain ash-covered basalt plates; fewest joints |
| `tile-1.png` | worn route | the same plates swept smooth and lighter by traffic; partly filled joints |
| `tile-2.png` | disturbed cluster | the same family broken into a richer mix of basalt, cooled grey ropey crust, and cinder cells |
| `tile-3.png` | pit approach | smaller plates, more/wider joints, and sparse point accents |

`FLOOR_STYLES.ashlands` now maps these authored slots as `[0] / [1] / [2] / [3]`. No other
dimension mapping or asset changed.

## Before / after value audit

Greyscale uses Rec. 709 luminance and alpha weighting. Floor spread is the greater of
`mean - min` and `max - mean`; the hard floor gate is mean 70–125 and spread no greater than ±18.
The rim is intentionally multi-band, so its pass is based on ground/wall/void segment values and the
fixed split rather than whole-file spread.

| File | Before mean | Before min–max | Before spread | Before | After mean | After min–max | After spread | After |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| `tile-0.png` | 51.10 | 19.28–90.72 | ±39.62 | FAIL | 92.12 | 82.41–99.26 | ±9.70 | PASS |
| `tile-1.png` | 39.57 | 10.07–84.44 | ±44.87 | FAIL | 100.50 | 84.62–111.40 | ±15.87 | PASS |
| `tile-2.png` | 50.91 | 24.43–101.78 | ±50.87 | FAIL | 94.01 | 84.62–101.41 | ±9.39 | PASS |
| `tile-3.png` | 46.76 | 8.36–144.79 | ±98.03 | FAIL | 93.95 | 84.41–101.97 | ±9.53 | PASS |
| `rim.png` | 23.24 | 0.00–198.69 | ±175.45 | FAIL | 63.71 | 19.71–97.26 | ±44.00 | PASS (segmented) |

The after floor-family mean is 95.14 with maximum tile drift ±5.36, below the ±12 gate. Rim bands
measure ground 90.05, wall face 44.81, and pit void 20.02. The unbroken five-pixel lip occupies
y=126–130 and is centred at exactly y=128.

## Prompt-frame changes

The shared `TILE_FRAME` keeps the required top-down orthographic projection but replaces the old
photographic language with:

- four to six flat colour planes, hard boundaries, and explicit 3–4px major / 2px minor drawn joints;
- 3px NW-light chamfers only, with no gradient, noise, grain, airbrush, painterly blend, shadow, AO,
  vignette, glow, bloom, or reflection;
- an explicit mean/spread contract that includes ink, antialiasing, chamfers, and accents;
- the full toroidal edge contract and quiet outer 10%;
- pristine repeatable bases: no authored wear, memorable crack, direction cue, obstruction, gameplay
  semaphore, or feature over 140px.

The shared `RIM_FRAME` now states the exact 1024×256 structure: ground y=0–127, a 5–6px unbroken lip at
y=128, wall face y=128–223, and void y=224–255. It also carries the cel palette/ink rules, value bands,
horizontal-only top 72px, horizontal tiling, and the ban on authored hot lip accents.

Ashlands material prompts now describe one ash/basalt family with four different histories. Tile 2's
final prompt explicitly forbids orange and focal ropey blobs; tile 3 reserves the restrained ember
accent for sparse points rather than continuous fissures.

## Generation and normalization

Generation used the built-in image generator, with one isolated image-generation call per tile or rim.
No multi-subject call was used. Stale Ashlands raws were absent before the pass, and the selected raw for
each iteration replaced only its own slot.

| Asset | Iterations | Final correction |
| --- | ---: | --- |
| `tile-0.png` | 2 | removed soft material shading and reduced joint contrast |
| `tile-1.png` | 2 | made traffic history lighter without a directional path mark |
| `tile-2.png` | 4 | removed focal ropey islands and all orange; distributed anonymous grey secondary material |
| `tile-3.png` | 2 | reduced tiny-plate density and converted accent to sparse points |
| `rim.png` | 2 | moved the authored lip toward centre and separated flat ground/wall/void bands |

The existing `normalizeTileFamily` and `normalizeRim` seam operations remain intact. A deterministic
pre-fold cel pass now quantizes Ashlands floors to seven colours and compresses generated luminance into
the measured role targets before `normalizeTileFamily`. The rim pass detects the generated bands,
recomposes them into the renderer's exact 126/5/93/32 pixel contract, and horizontalizes the top 72px
before the existing rim fold. Edge verification reports 0.000 MAE for every tile's left/right and
top/bottom edges, every cross-variant shared perimeter, and the rim's left/right edge.

`--terrain-only` was added to the resumable generator so a scoped terrain run does not generate or
install menu key art.

## Permanent gate

`node tools/artkit/check-tile-values.mjs ashlands` checks all five required files, dimensions, opacity,
alpha-weighted mean/min/max/spread, floor-family drift, rim ground/wall/void bands, and the y=128 split.
Iteration 2 extends the gate with per-tile mean RGB, central-field palette classification, a 4-6 surface
colour contract, distinct ink detection, and accent-area enforcement at no more than 8%. It exits
non-zero on a violation and exits 0 for the shipped kit.

## Verification

- `node tools/artkit/check-tile-values.mjs ashlands` — PASS, exit 0.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS: 220 test files, 2,778 passed, 20 skipped.
- Live run — Ashlands depth 1 at 1920×1080 with active entities, pits, rim, and role tiles:
  `docs/sol-reports/b60-evidence/ashlands-live.png`.
- Entity-outline thesis crop — black outline visibly separated from the new ash-grey floor:
  `docs/sol-reports/b60-evidence/ashlands-entity-outline.png`.

V1 VERDICT (`13a7676`): value gate PASS; ink, colour, and semantic-role contracts required correction.

## Iteration 2 — v1 vs v2 contract correction

Iteration 2 keeps the validated value family, exact toroidal folds, and unchanged rim while correcting
the three failed contracts. Colour variation is carried by bounded hue and saturation changes inside
the established luminance family: six flat volcanic surface colours, the near-black warm-purple theme
ink `#574A5C`, and the ember accent `#C44C14`. Accent coverage is 0.149% across the four-tile family
and no more than 0.432% on any tile, comfortably below the 8% cap.

| File | v1 mean | v1 mean RGB | v2 mean | v2 mean RGB | v2 spread | v2 palette / accent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `tile-0.png` | 92.6 | (99, 91, 86) | 93.07 | (99.08, 91.60, 89.86) | ±13.01 | 6 + ink / 0.000% |
| `tile-1.png` | 101.1 | (108, 99, 94) | 100.22 | (110.17, 98.04, 92.51) | ±17.38 | 6 + ink / 0.025% |
| `tile-2.png` | 94.4 | (100, 93, 87) | 93.19 | (101.00, 90.79, 93.93) | ±16.13 | 6 + ink / 0.139% |
| `tile-3.png` | 94.4 | (100, 93, 89) | 93.46 | (103.18, 91.04, 88.81) | ±16.40 | 6 + ink / 0.432% |

The v2 floor-family mean is 94.99 with maximum tile drift ±5.23. Every floor remains inside the
70–125 mean band and ±18 spread gate. The unchanged rim remains mean 63.71 with ground 90.05, wall
44.81, void 20.02, and its five-pixel lip at y=126–130 centred exactly on y=128.

### Ink contract

All material-region boundaries are deliberate, hard-edged drawn ink rather than embossed shading.
Installed tile lines measure 3–4px on major plate/material boundaries and 2px on minor cracks; the
unchanged rim lip remains 5px. The fixed ink colour is part of the theme palette and is kept distinct
from surface-colour quantization.

### Semantic role read

- `tile-0`, quiet bed: broad uninterrupted settled-ash and basalt fields with the fewest joints make
  the default ground visibly calm.
- `tile-1`, worn route: a broad horizontal swept/scuffed lane and partly filled joints give a
  directional travelled read even when only a crop is visible.
- `tile-2`, disturbed cluster: overlapping broken plate, slag, and ash-bank clusters read as churned
  ground where an event has upheaved the surface.
- `tile-3`, pit approach: branching stress lines widen into dark, ember-bearing gaps toward a collapse
  fan, making the tile a failing-ground warning.

### V2 evidence and seam audit

- `docs/sol-reports/b60-evidence/ashlands-live.png` — 1920×1080 live Ashlands fight with v2 tiles,
  entities, pits, and unchanged rim.
- `docs/sol-reports/b60-evidence/ashlands-entity-outline.png` — 520×360 live entity-outline crop on
  the v2 palette.
- `docs/sol-reports/b60-evidence/ashlands-tiles-sheet.png` — 1024×1024, 2×2 at 1:1: tile 0 top-left,
  tile 1 top-right, tile 2 bottom-left, and tile 3 bottom-right.

All four tiles measure 0.000 MAE at left/right and top/bottom folds, and all shared cross-variant
perimeters measure 0.000 MAE. The contact sheet therefore shows the authored centres without hiding
any seam correction.

### Amber-wash measurement

The gameplay semaphore was left unchanged. In the typical-fight live capture, its saturated
amber/orange rail and core occupy approximately 1.8% of the 1920×1080 viewport (1.51% at the strict
core threshold; 1.76% with the full rail threshold). A deliberately broad warm-pixel threshold reads
16.8%, but it also counts authored umber/cinder floor regions, so that number is an inclusive visual
wash estimate rather than attributable semaphore area. The owner can rule using both measures.

### V2 verification

- `node tools/artkit/check-tile-values.mjs ashlands` — PASS, exit 0.
- `pnpm typecheck` — PASS.
- Full `pnpm test` — PASS: 220 test files; 2,778 passed, 20 skipped.
- Real-stack Playwright evidence capture — PASS.

VERDICT: PASS — means tile-0 93.07 RGB (99.08,91.60,89.86), tile-1 100.22 RGB (110.17,98.04,92.51), tile-2 93.19 RGB (101.00,90.79,93.93), tile-3 93.46 RGB (103.18,91.04,88.81), rim 63.71; band PASS (family 94.99, drift ±5.23; rim split y=128 PASS); ink 3–4px major / 2px minor (rim lip 5px); amber-wash coverage ~1.8% rail/core (16.8% inclusive warm threshold); typecheck PASS; full test PASS — 220 files, 2,778 passed, 20 skipped.
