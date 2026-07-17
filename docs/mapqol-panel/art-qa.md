# Quantitative map-art QA

Audit date: 2026-07-17. Scope: the five live dimension kits requested by `floor-renderer.ts` and `ArenaScene.ts`: 20 dimension ground tiles, five horizontally tiled rims, the universal fallback ground, 31 POIs, and 47 decals. Total: **104 files / 18,239,238 bytes (17.39 MiB)**. No source or art was changed for this audit.

## Method and thresholds

- **Seams:** Sharp-decoded RGB. `MAE` is the mean absolute per-channel difference on a 0–255 scale between the first/last columns or rows; `p95` is the 95th-percentile per-pixel RGB delta. Review bands used here: pass `<=2`, watch `>2–5`, fail `>5–10`, severe `>10`. These are prioritization thresholds, not renderer tolerances.
- **Cross-variant seams:** right edge of variant A versus left edge of B, and bottom edge of A versus top edge of B. This matters because the renderer can place different material-zone variants directly beside each other.
- **Palette:** every asset was normalized to an equal-asset CIE Lab `8x8x8` histogram; pixels with alpha `<32` were ignored. Distance is square-root Jensen-Shannon distance in `[0,1]`. A robust z-score uses the per-theme median/MAD. `z >=3.5` is an extreme outlier; `z >=2.0` is a review watch.
- **Alpha/grounding:** visible means alpha `>16`. The baked-shadow screen is `(dark neutral share of the bottom/contact band) x (horizontal span / opaque-bbox width)`. It is a risk score, not semantic image recognition. The stronger evidence for baked shadows is the generator contract itself: `gen-decals.mjs` explicitly prompts for a “small SOFT dark contact shadow” on every POI/decal.
- **Coverage:** file existence was checked against the exact load paths, manifest IDs, `DimensionPropPack` metadata, material-zone arrays, and every selection filter in `buildPoiGroundingCluster`, `buildPitDebris`, and `scatterDecor`.

## Ranked findings

### P0 — Ground and rim seams are visible; mixed variants are substantially worse

The dimension generator (`tools/artkit/gen-terrain-kits.mjs`) asks image generation for seamless art but only performs `resize(...).png()`. It does not enforce edge continuity. By contrast, the old `ground.jpg` uses the mirror-fold path in `gen-tiles.mjs` and measures **0.122/255 L/R MAE and 0.000/255 T/B**.

Five dimension tiles are severe on at least one self-tiled axis: Frostfell `tile-3` **13.325**, Frostfell `tile-2` **11.917**, Verdant `tile-1` **10.732**, Neon `tile-3` **10.581**, and Wild West `tile-1` **10.098**. No dimension ground tile passes the `<=2` gate.

#### Every ground texture

`max p95` is the worse p95 across the two tiled axes.

| Texture | L/R MAE | T/B MAE | max p95 | Result |
|---|---:|---:|---:|---|
| `tiles/ground.jpg` | 0.122 | 0.000 | 0.667 | pass |
| `tiles/wild-west/tile-0.png` | 5.620 | 6.479 | 15.667 | fail |
| `tiles/wild-west/tile-1.png` | 10.098 | 9.042 | 28.333 | severe |
| `tiles/wild-west/tile-2.png` | 9.604 | 9.835 | 25.000 | fail |
| `tiles/wild-west/tile-3.png` | 7.083 | 9.137 | 23.667 | fail |
| `tiles/frostfell/tile-0.png` | 9.086 | 9.638 | 24.333 | fail |
| `tiles/frostfell/tile-1.png` | 5.445 | 5.867 | 15.333 | fail |
| `tiles/frostfell/tile-2.png` | 10.969 | 11.917 | 30.333 | severe |
| `tiles/frostfell/tile-3.png` | 12.715 | 13.325 | 34.000 | severe |
| `tiles/verdant-ruins/tile-0.png` | 5.050 | 4.873 | 12.333 | fail |
| `tiles/verdant-ruins/tile-1.png` | 9.898 | 10.732 | 27.000 | severe |
| `tiles/verdant-ruins/tile-2.png` | 9.941 | 9.518 | 28.333 | fail |
| `tiles/verdant-ruins/tile-3.png` | 9.166 | 9.081 | 24.000 | fail |
| `tiles/ashlands/tile-0.png` | 6.382 | 6.318 | 16.000 | fail |
| `tiles/ashlands/tile-1.png` | 8.238 | 7.406 | 20.000 | fail |
| `tiles/ashlands/tile-2.png` | 6.630 | 6.819 | 18.000 | fail |
| `tiles/ashlands/tile-3.png` | 8.396 | 7.969 | 20.667 | fail |
| `tiles/neon-cyber/tile-0.png` | 3.483 | 3.832 | 8.667 | watch |
| `tiles/neon-cyber/tile-1.png` | 3.895 | 4.271 | 12.000 | watch |
| `tiles/neon-cyber/tile-2.png` | 2.855 | 5.048 | 17.333 | fail |
| `tiles/neon-cyber/tile-3.png` | 7.465 | 10.581 | 32.667 | severe |

#### Horizontally tiled rims

| Rim | L/R MAE | p95 | Result |
|---|---:|---:|---|
| `tiles/wild-west/rim.png` | 15.382 | 55.667 | severe |
| `tiles/frostfell/rim.png` | 6.596 | 19.000 | fail |
| `tiles/verdant-ruins/rim.png` | 13.505 | 52.667 | severe |
| `tiles/ashlands/rim.png` | 6.961 | 26.000 | fail |
| `tiles/neon-cyber/rim.png` | 7.913 | 29.667 | fail |

#### Worst cross-variant boundaries

| Theme | Worst horizontal A→B | MAE / p95 | Worst vertical A→B | MAE / p95 |
|---|---|---:|---|---:|
| Wild West | `2→0` | 23.001 / 41.000 | `2→0` | 23.118 / 39.667 |
| Frostfell | `3→1` | 22.124 / 53.333 | `1→2` | 21.389 / 46.667 |
| Verdant Ruins | `0→1` | 17.617 / 39.667 | `0→1` | 17.016 / 36.333 |
| Ashlands | `1→2` | 14.151 / 30.667 | `1→2` | 11.626 / 26.333 |
| Neon Cyber | `3→0` | **28.609 / 40.333** | `3→0` | **22.560 / 44.000** |

**Visual impact:** these textures are rendered as unblended 512px images. Self-seams form a regular grid; cross-variant seams also outline the material-zone decisions, producing the “quilt” the grounding pass is intended to remove.

**Remediation:** make continuity a deterministic Sharp step, not a prompt-only request. For each dimension, derive a shared 24–32px edge strip from its quiet base tile, blend all four tile perimeters into that common strip, and make the final opposite edge pixels identical. Apply the same horizontal cross-fade to rims. The fallback mirror fold proves the pipeline can reach near-zero error. Re-run QA with gates of self-edge `MAE <=2 / p95 <=6` and cross-variant `MAE <=4 / p95 <=12`. Prompt text should additionally demand uniform edge luminance/chroma and prohibit large features within the outer 10%—but prompt wording does not replace the Sharp correction.

### P0 — Every generated prop carries a baked-shadow instruction, so POIs can double-shadow

`floor-renderer.ts` now supplies both a height-dependent south-east cast lobe and a dense contact AO kernel. The art generator asks all **78/78** cutouts for their own soft contact shadow. That is an input-contract conflict, not a renderer-design issue.

The quantitative bottom/contact-band screen has mean score **0.407**, median **0.392**; **30/78** assets score `>=0.5` and **13/78** score `>=0.7`. Semi-transparent pixels average only 5–9% by theme, so an alpha-threshold cleanup cannot reliably remove these shadows: much of the dark base material is already opaque after chroma keying.

| Theme | Mean shadow-risk score | Strongest sampled asset | Score | Dark-neutral band | Horizontal span |
|---|---:|---|---:|---:|---:|
| Wild West | 0.297 | `decal-07` | 0.5144 | 60.80% | 84.62% |
| Frostfell | 0.114 | `poi-frostfell-02` | 0.2407 | 24.98% | 96.36% |
| Verdant Ruins | 0.429 | `poi-verdant-ruins-02` | 0.5208 | 55.50% | 93.84% |
| Ashlands | 0.671 | `poi-ashlands-00` | **0.7798** | 77.98% | 100.00% |
| Neon Cyber | 0.464 | `poi-neon-cyber-00` | **0.7043** | 75.43% | 93.37% |

Five currently usable POIs also have their declared contact point more than 3px from any alpha, making the procedural AO/skirt origin a calibration candidate:

| POI | Nearest visible pixel from contact | Other numeric concern |
|---|---:|---|
| `poi-frostfell-01` | 7.07px | base span is only 54.2% of opaque-bbox width |
| `poi-00` | 6.00px | alpha at contact is 0 |
| `poi-verdant-ruins-04` | 5.66px | alpha at contact is 0 |
| `poi-neon-cyber-06` | 4.47px | contact X is 29.5px left of opaque-bbox center |
| `poi-ashlands-02` | 4.00px | alpha at contact is 0 |

The bottom calibration itself is otherwise tight: live POIs end within `-1…+4px` of `contactY`, and normal POI margins are 1–3px.

**Remediation:** re-render POIs with “isolated object only; no cast shadow, no contact shadow, no ground patch, no ambient occlusion painted outside the physical base.” Require a single explicit footline centered at the bottom and keep the full base in-frame. After extraction, derive candidate `contactX/contactY` from the alpha footline, then hand-verify only asymmetric/multi-leg structures. Do not attempt broad dark-pixel deletion with Sharp; it would erase Ashlands rock/soot and Neon understructure. Flat decals may retain intrinsic painted staining only when the metadata role is `flat`; upright/solid cutouts should use the same no-shadow prompt.

### P1 — Coverage is complete on disk, but one authored Ashlands decal is unreachable

Shared mapgen has two tile kinds: `TILE_GROUND` and `TILE_PIT`. Every dimension has all four requested ground variants and its rim; every manifest ID resolves to a file. All material roles have non-empty arrays, and every POI size class has at least three usable choices. Therefore no current dimension triggers the legacy ground or vector-grid fallback.

The renderer’s four ground roles are shown as `base / route / cluster / edge`:

| Dimension | Tile role mapping | Files | Usable POIs (S/M/L/XL eligible) | Open flat scatter | Pit-debris pool | Gap / fallback behavior |
|---|---|---|---|---|---|---|
| Wild West | `2,0 / 3 / 1 / 1,0` | 4/4 + rim | 5/6 (`5/5/4/4`) | `decal-08` | `decal-00,01,02,04` | `poi-05` quarantined; alternate POI pool remains valid |
| Frostfell | `1 / 0 / 3 / 2` | 4/4 + rim | 5/6 (`5/5/5/3`) | `decal-frostfell-01,04` | `decal-frostfell-01,03,05` | `poi-frostfell-05` and `decal-frostfell-02` quarantined; no placeholder |
| Verdant Ruins | `0,3 / 1 / 2 / 2` | 4/4 + rim | 5/6 (`5/5/5/4`) | `decal-verdant-ruins-02,04,05,07` | `decal-verdant-ruins-01,02,04,06` | `poi-verdant-ruins-01` quarantined; alternate pool remains valid |
| Ashlands | `3 / 0 / 1 / 2` | 4/4 + rim | 5/6 (`5/5/5/3`) | `decal-ashlands-03,10` | `decal-ashlands-00,02,05,06,07` | `poi-ashlands-05` quarantined; **`decal-ashlands-01` unreachable** |
| Neon Cyber | `0 / 1 / 2 / 3` | 4/4 + rim | 6/7 (`6/6/6/6`) | `decal-neon-cyber-00,01,05,07` | `decal-neon-cyber-00,01,04,07` | `poi-neon-cyber-03` and `decal-neon-cyber-06` quarantined; alternate pools remain valid |

`decal-ashlands-01` is `usable=true`, `pitOnly=true`, `accent=true`, but all three placement filters require `!pitOnly`; `buildPitDebris` additionally requires `!accent`. Its manifest/file exist, but its live selection probability is exactly **0%**. This is the only real role-coverage hole. Create a dedicated pit-only/accent channel or let the pit-debris pool admit a sparse `pitOnly` accent; do not merely set `pitOnly=false`, which would permit a harmless glowing crack away from the authoritative pit.

Quarantined and unreachable files are still preloaded. Across the repository they total **694,856 bytes**: Wild West 155,197; Frostfell 206,643; Verdant 155,904; Ashlands 113,506 including the unreachable pit decal; Neon 63,606. Keep IDs archived for stability, but build the load list from usable metadata so quarantined files are not transferred. Wire the Ashlands pit decal rather than dropping it.

Failure behavior is otherwise safe but visually reduced:

- One missing dimension tile makes `paintedKeys.every(hasTile)` false, so the **entire** ground kit switches to `ground.jpg`; no partial dimension kit is shown.
- A missing rim skips painted rim art but retains the exact procedural pit rail.
- A missing selected POI skips the sprite but retains the procedural skirt/collider cue and shadows.
- A missing decal skips only that draw; no placeholder is substituted.

### P1 — Palette cohesion has two prop watches but no formal extreme pasted-in outlier

#### Dominant per-theme colors

Percentages are equal-asset histogram mass, so a small prop counts as one asset rather than being drowned out by 512px tiles.

| Theme | Dominant colors (hex and histogram mass) |
|---|---|
| Wild West | `#cba772` 14.18%, `#5a4634` 9.38%, `#3d2a1e` 9.21%, `#ddb980` 8.19%, `#170f0a` 7.67%, `#97826a` 7.12%, `#78624b` 6.84%, `#25311a` 5.92% |
| Frostfell | `#afc7da` 18.41%, `#91b0c8` 15.88%, `#6c8da3` 6.21%, `#77ade3` 5.51%, `#c2cdea` 4.85%, `#506b7d` 4.63%, `#374c5b` 4.45%, `#dee3f6` 3.08% |
| Verdant Ruins | `#464930` 29.49%, `#2e321f` 17.16%, `#11160c` 9.37%, `#544737` 6.21%, `#938471` 5.69%, `#746654` 5.48%, `#62654b` 5.41%, `#372d23` 5.03% |
| Ashlands | `#2e2e30` 13.56%, `#342f2d` 12.88%, `#2a3029` 9.43%, `#101518` 8.66%, `#272e31` 8.24%, `#15110f` 7.52%, `#0e150d` 7.30%, `#101116` 7.24% |
| Neon Cyber | `#3e4a4d` 8.59%, `#35343a` 8.10%, `#444642` 7.54%, `#4d453e` 7.02%, `#141116` 6.18%, `#0b160b` 6.13%, `#283337` 5.91%, `#372e28` 5.44% |

No asset reaches the formal `robust z >=3.5` outlier threshold. The review watches are:

| Asset | Palette distance | Robust z | Interpretation / action |
|---|---:|---:|---|
| `tiles/wild-west/tile-0.png` | 0.84075 | 2.66 | tile-family watch; edge normalization is higher priority than recolor |
| `tiles/wild-west/tile-2.png` | 0.82864 | 2.57 | tile-family watch; pairwise seam to `tile-0` is 23.118 |
| `tiles/neon-cyber/tile-1.png` | 0.80367 | 2.52 | intentional hazard/service-lane accent; keep localized |
| `pois/neon-cyber/poi-neon-cyber-03.png` | 0.77750 | 2.32 | malformed 36×160 quarantine; rerender before re-entry |
| `tiles/neon-cyber/tile-0.png` | 0.75006 | 2.11 | tile-family watch; worst pair is `tile-3→0` |
| `decals/ashlands/decal-ashlands-04.png` | 0.80257 | 2.07 | only live prop watch; sulfur accent is intentionally rare, but reduce saturation if it reads pasted-in |
| `tiles/neon-cyber/tile-3.png` | 0.74412 | 2.06 | tile-family watch plus severe self/cross seams |

For context, the highest prop z-scores in the themes without a watch are Wild West `poi-01` 1.60, Frostfell `decal-frostfell-01` 0.97, and Verdant `decal-verdant-ruins-00` 0.43.

The strict chroma-key predicate finds no field-scale residue: the maximum over all assets is only 0.0868% of visible pixels, and each of the four comments that mention chroma-green measures 0.0000% under that exact predicate. A looser green screen finds `poi-neon-cyber-03` at 2.2314% and `decal-neon-cyber-06` at 0.5097%, versus 0.0184% for `poi-05` and 0.0460% for `poi-frostfell-05`. Keep the Neon quarantines; the Wild/Frost green-field comments should be revalidated from the source pack rather than treated as current pixel evidence.

### P2 — Dimensions and formats are consistent; payload and one POI resolution are not

Format contract passes:

- 20 ground tiles: exactly `512x512`, RGB PNG, no alpha.
- Five rims: exactly `1024x256`, RGB PNG, no alpha.
- Universal fallback: `2048x2048`, RGB JPEG, no alpha.
- 47 decals: RGBA PNG, each dimension `<=132`.
- 31 POIs: RGBA PNG, each dimension `<=280`.

The one resolution/silhouette anomaly is `poi-neon-cyber-03.png` at **36x160**. It is 68.7% narrower than the next-narrowest POI (115px) and is already quarantined. Re-render it; scaling a 36px sliver up to an XL collider is not recoverable by metadata.

Terrain accounts for **13,639,697 bytes / 13.01 MiB** of the 17.39 MiB audited set; props account for **4,599,541 bytes / 4.39 MiB**. `ground.jpg` is loaded unconditionally even when the complete dimension kit succeeds, so every normal arena pays its 757,214-byte cost without drawing it.

| Active dimension | Active kit bytes | Plus unconditional `ground.jpg` | Approx MiB transferred |
|---|---:|---:|---:|
| Wild West | 3,539,620 | 4,296,834 | 4.10 |
| Frostfell | 3,708,933 | 4,466,147 | 4.26 |
| Verdant Ruins | 4,014,936 | 4,772,150 | 4.55 |
| Ashlands | 3,146,123 | 3,903,337 | 3.72 |
| Neon Cyber | 3,072,412 | 3,829,626 | 3.65 |

#### Top 10 largest audited assets

| Asset | Bytes | KiB | Dimensions / format |
|---|---:|---:|---|
| `tiles/ground.jpg` | 757,214 | 739.5 | 2048x2048 JPEG |
| `tiles/frostfell/tile-2.png` | 634,799 | 619.9 | 512x512 PNG |
| `tiles/frostfell/tile-3.png` | 630,715 | 615.9 | 512x512 PNG |
| `tiles/wild-west/tile-2.png` | 617,473 | 603.0 | 512x512 PNG |
| `tiles/verdant-ruins/rim.png` | 603,333 | 589.2 | 1024x256 PNG |
| `tiles/verdant-ruins/tile-1.png` | 597,311 | 583.3 | 512x512 PNG |
| `tiles/wild-west/tile-1.png` | 597,304 | 583.3 | 512x512 PNG |
| `tiles/verdant-ruins/tile-2.png` | 596,503 | 582.5 | 512x512 PNG |
| `tiles/verdant-ruins/tile-3.png` | 584,025 | 570.3 | 512x512 PNG |
| `tiles/frostfell/rim.png` | 571,175 | 557.8 | 1024x256 PNG |

**Remediation:** lazy-load `ground.jpg` only after the four active tiles fail completeness, saving **757,214 bytes** on every successful kit. Remove unusable IDs from the preload list, saving another per-dimension 63–207 KiB. Add a final deterministic terrain encode step: lossless PNG recompression if URLs must stay stable, or quality-tested WebP plus updated load paths if a format change is acceptable. Do not downscale the 512px live tiles; their dimensions match the renderer exactly.

### P2 — Decal extraction is clipping alpha at the canvas boundary

POI trim is mostly healthy, but **22/47 decals** have visible alpha on an outermost pixel; **16/47** have more than 10 such pixels and **7/47** have more than 50. Rotated `edge`/`low` decals can therefore show clipped outlines or texture-bleed exactly where the grounding pass places them around POIs and rims.

| Asset | Visible border pixels | Alpha-bbox margins L/R/T/B |
|---|---:|---|
| `decal-ashlands-06` | **280** | `0/0/0/0` |
| `decal-02` | 121 | `2/0/0/0` |
| `decal-ashlands-07` | 121 | `0/2/0/2` |
| `decal-neon-cyber-04` | 95 | `0/0/1/0` |
| `decal-ashlands-05` | 93 | `1/0/1/0` |
| `decal-neon-cyber-06` | 92 | `0/0/0/0` |
| `poi-neon-cyber-03` | 85 | `3/0/0/0` |

Alpha occupancy is otherwise stable:

| Theme | Assets | Mean visible coverage | Mean semi-transparent share | Border-touch assets |
|---|---:|---:|---:|---:|
| Wild West | 15 | 57.18% | 8.60% | 2 |
| Frostfell | 14 | 58.62% | 7.11% | 5 |
| Verdant Ruins | 15 | 64.13% | 5.14% | 0 |
| Ashlands | 17 | 63.86% | 6.06% | 8 |
| Neon Cyber | 17 | 61.05% | 7.70% | 8 |

**Remediation:** in `gen-decals.mjs`, re-extract cached packs with an 8px component pad, resize to `max-8`, then Sharp-extend four transparent pixels on every side after resize. This is a post-process/re-extraction fix for most assets, not an image-generation job. Recompute POI contact coordinates after padding. Require `borderVisiblePixels=0` at alpha `>16` before manifest emission.

## Acceptance gates for the next art drop

1. Every ground tile: self-edge MAE `<=2`, p95 `<=6`; every allowed cross-variant pair: MAE `<=4`, p95 `<=12`.
2. Every rim: horizontal MAE `<=2`, p95 `<=6`.
3. No POI/solid decal prompt contains a baked shadow; the renderer owns cast shadow and AO.
4. Every live POI contact point is within 3px of alpha and within 4px of the bottom visible footline unless a multi-leg profile documents the gap.
5. Every emitted prop has at least four transparent pixels on each side at alpha `>16`.
6. Every manifest/metadata entry has a reachable renderer channel; `pitOnly` must have a pit-only selector.
7. No palette asset reaches robust `z>=3.5`; every `z>=2.0` accent is explicitly rare/localized in metadata.
8. Complete dimension kits do not transfer the universal fallback; quarantined IDs do not preload.

## Prioritized re-render list

Sharp seam correction remains mandatory after terrain re-rendering; image generation alone cannot guarantee pixel continuity.

| Priority | Asset ID / path | New prompt must fix |
|---:|---|---|
| 1 | `tiles/neon-cyber/tile-3.png` | Quiet top-down rain-slick composite; match the kit’s common gunmetal edge palette, no neon/luminance drift in outer 10%, no edge-crossing feature unless toroidally continuous; current self T/B 10.581 and `3→0` H 28.609. |
| 2 | `tiles/neon-cyber/tile-0.png` | Quiet gunmetal base with the exact same perimeter luminance/chroma as the other three Neon tiles; no border panels or directional edge reflection; partner in the 28.609 cross-seam. |
| 3 | `tiles/wild-west/tile-2.png` | Sparse pebbles/grass only in the interior; outer 10% must match quiet hardpan `tile-0` in value and hue; no cut pebbles/grass at edges; current `2→0` V 23.118. |
| 4 | `tiles/wild-west/tile-0.png` | Uniform quiet hardpan perimeter shared by every Wild West variant; no wind gradient or vignette; partner in the 23.118 cross-seam. |
| 5 | `tiles/frostfell/tile-3.png` | Hoarfrost detail confined away from the boundary; edge value/chroma must match the quiet ice base; no directional frost plume at edges; self 13.325 and `3→1` H 22.124. |
| 6 | `tiles/frostfell/tile-1.png` | Calm glacial ice with a uniform shared perimeter and no broad edge brightness shift; partner in the 22.124 cross-seam. |
| 7 | `tiles/wild-west/rim.png` | Horizontally toroidal mesa lip: left/right material, crack, lip height, and abyss value continue exactly; no unique debris in outer 10%; current MAE 15.382 / p95 55.667. |
| 8 | `tiles/verdant-ruins/rim.png` | Horizontally toroidal mossy masonry lip; no vine/root begins or ends at a canvas edge; identical edge wall depth/value; current MAE 13.505 / p95 52.667. |
| 9 | `tiles/frostfell/tile-2.png` | Cracks stay away from the boundary or continue toroidally; uniform snow/ice edge balance; current self MAE 11.917 / p95 30.333. |
| 10 | `tiles/verdant-ruins/tile-1.png` | Interior-only flagstone accents with a shared moss/stone perimeter; no seam terminating at the edge; current self 10.732 and `0→1` H 17.617. |
| 11 | `tiles/ashlands/tile-1.png` | Ropey lava detail confined to the interior; outer perimeter is neutral packed ash matching `tile-2`; no ember line reaches an edge; current `1→2` H 14.151. |
| 12 | `tiles/ashlands/tile-2.png` | Neutral ash perimeter shared with `tile-1`; ember cracks stay interior and low contrast; partner in the 14.151 cross-seam. |
| 13 | `poi-neon-cyber-03` | Full, readable high-3/4 landmark—not a 36px sliver; complete base centered in frame, at least 4px transparent padding, no chroma residue, no ground patch, and absolutely no baked shadow. |
| 14 | `poi-ashlands-00` | Preserve the squat Ashlands silhouette and physical base only; remove all painted ground/contact/cast shadow and leave a clean transparent footline; current shadow-risk score 0.7798. |
| 15 | `poi-ashlands-02` | No baked shadow or soot ground patch; one explicit centered footline at the declared base; current shadow-risk 0.7315 and contact-to-alpha gap 4.00px. |
| 16 | `poi-neon-cyber-00` | Isolated machinery landmark with no underpaint, glow pool, AO, contact shadow, or cast shadow; complete padded base; current shadow-risk 0.7043. |
| 17 | `poi-frostfell-01` | Isolated frozen landmark with a visually explicit base/footline, no snow floor patch and no shadow; current contact-to-alpha gap 7.07px. |
| 18 | `poi-00` | Isolated Wild West landmark, base fully visible and centered, no surrounding dirt or shadow; current contact-to-alpha gap 6.00px. |
| 19 | `poi-verdant-ruins-04` | Keep roots that physically belong to the object, remove surrounding moss floor and all shadow; make one clear footline at the anchor; current gap 5.66px. |
| 20 | `poi-neon-cyber-06` | No ground glow/shadow; keep the actual support base centered under the landmark rather than 29.5px off the opaque-bbox center; current contact gap 4.47px. |
| 21 | `decal-ashlands-04` | Muted sulfur crust as flat material, not self-lit yellow; no object-like outline or contact shadow; stay within the Ashlands charcoal/ember palette; current palette distance 0.80257, z 2.07. |
| 22 | `decal-neon-cyber-06` | Only if restoring the quarantined slot: fully isolated prop, no chroma field/residue, no baked shadow or glow pool, complete 4px transparent padding; current loose-green share 0.5097% and 92 border pixels. |
