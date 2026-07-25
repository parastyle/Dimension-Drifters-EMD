# SPEC — Dimension Art Direction (2.5D parity with the tunnel)

Status: **OWNER-RULED, 2026-07-25** — see §-1 below. All seven open decisions are answered; §9 is
closed. Where §-1 and any later section disagree, **§-1 wins**.
Art-direction spec only — no code changed by this document.
Scope: the **DIMENSIONS** (big procedurally generated maps). Not tunnels.

Terminology (owner-locked 2026-07-25):

- **DIMENSION** — a big procedurally generated map, the primary content, endless mob-fight arena.
  Four themes today (`frostfell`, `verdant-ruins`, `ashlands`, `neon-cyber` in `data/dimensions-design.json`)
  plus the legacy `wild-west` pack that is still fully wired in code.
- **TUNNEL** — a smaller scripted sequence of rooms between dimensions, ending in a boss. One exists
  (the corporate CEO tower, LDtk, horizontal). **Tunnels are not necessarily horizontal.** Nothing in
  this spec may assume they are.

Owner directive (verbatim, 2026-07-25):

> "I was hoping we'd use this time to bring our currently big maps (dimensions as opposed to tunnels
> (terminology going forward)) up to art standards. Right now as you said our dimensions (big procedural
> maps) are iso and dont match the art style of the tunnel (smaller, more scripted maps that lead to other
> dimensions) ...We want to update the art only..no insane game engine overhaul, tweaks at most...to be
> 2.5 perspective just like the CEO tunnel, just like....super animal royale. and bring the actual art
> style, colors, contrast n stuff up to parity with the tunnel."

Canon this spec is subordinate to:

- `PROJECT_ART_STYLE_BIBLE.md` — character/prop/tile canon. It has **no dimensions section**; this spec
  is that section. Where they disagree, the bible wins on treatment; this spec adds the top-down rules
  the bible never had to state.
- `docs/sol-reports/design-lock-b57-dimension-loop.md` — dimensions are grind rooms with timed portals,
  escalation, and a closing gas circle.
- `packages/client/src/scenes/arena/floor-renderer.ts` — the renderer this spec must target.
- `packages/shared/src/mapgen.ts` — the structure the art must serve.

---

## -1. OWNER RULINGS (2026-07-25) — SUPERSEDING

These answer §9 and correct one factual error in §1.7. **This section overrides every later section.**

### R1 — All five dimensions are re-authored. (§9.1)
Owner: *"All the dimensions are being reauthored doesnt matter."* `wild-west` included. No fallback
theme is left in the old style.

### R2 — Value target is a COMPRESSION, not an inversion. (§9.2 — and §1.7 was WRONG)

**§1.7's claim that "the shipped tiles are near-black" is FALSE and must not be acted on.** The
greyscale 15–25 figure it cited is `palette.groundBed` — a flat rectangle drawn at depth −20 that the
painted tiles completely cover at −19.5. All five painted kits are complete on disk, so the bed
**never shows through**. The near-black actually visible in game is `pitVoid` (8–13): the pits.

Measured means of the shipped tiles (alpha-weighted greyscale, `packages/client/public/tiles/<dim>/`):

| Dimension | tile-0 | tile-1 | tile-2 | tile-3 | rim | vs target 70–125 |
| --- | --- | --- | --- | --- | --- | --- |
| `wild-west` | 189 | 184 | 168 | 177 | 71 | **far too BRIGHT** |
| `frostfell` | 189 | 187 | 182 | 172 | 102 | **far too BRIGHT** |
| `verdant-ruins` | 62 | 68 | 68 | 66 | 39 | ~8 too dark |
| `neon-cyber` | 64 | 67 | 58 | 53 | 42 | ~12 too dark |
| `ashlands` | 51 | 40 | 51 | 47 | 24 | ~25 too dark |

The real defect is **spread**: the five dimensions span 40 → 189, a 149-point range, so entity
readability changes completely depending on which dimension the player is in.

**RULING: every dimension's floor targets mean 70–125 with ≤ ±18 internal variation.**
`ashlands` / `verdant-ruins` / `neon-cyber` come **up**; `wild-west` / `frostfell` come **down**.
This is a generation parameter, not extra work.

The half of §1.7 that stands unchanged and matters most: **within-tile spread**. Shipped tiles run
`wild-west` tile-1 119–232, `frostfell` tile-0 128–240, `ashlands` tile-3 9–145. That is photographic
noise, and it is why the floors read as mush. Cel-shading fixes it by construction. The rest of the
§1.7 table (pit void ≤ 25, rim face 30–60, decal within ±20 of floor, gas ring ≥ 230) stands.

### R3 — Boundary shelf: approved. (§9.3)
T2 ships. Owner note: *"we can always parallax the background past the edges later"* — so the shelf
must not hard-code the void as a flat fill that a future parallax layer would have to fight. Leave the
area beyond the shelf a single addressable layer.

### R4 — Whole-kit-per-dimension. (§9.4)
One complete theme at a time. **`ashlands` is theme one** — largest value correction, so it is the
most honest test of R2. Owner gate after ashlands before the remaining four are funded.

### R5 — Gas veil: one fixed neutral plum in every dimension. (§9.5)
`#2A2233` as specced. Owner: *"Perfect, was thinking purpley plum as well."* Not per-theme. This
forbids `frostfell` from being white — see R2, which independently requires the same thing.

### R6 — Decal alpha: orchestrator sets it from a capture. (§9.6)
Not an owner decision. `flat` role currently renders at **0.065** — 38 authored decal images are
effectively invisible. Value to be set from a screenshot at a 40-enemy fight, judged on whether ground
wear competes with enemies for attention. Ships as part of T4.

### R7 — POI LANDMARKS ARE DELETED FROM DIMENSIONS. (supersedes §9.7, §3.4, and parts of §6)

Owner ruled past the question that was asked. Verbatim:

> "No landmarks, only destructible environments that don't get in our way, like crates, tumbleweeds,
> tables...(all of them btw should be able to break, dodge rolling through a crate should break it)
> MAYBE in the tunnels we'll have obstacles as cover since its horizontal, but not the dimensions."

Consequences, all binding:

1. **§3.4 is void.** The 31 POI assets (6–7 per theme) are removed, not re-authored. `poiIds` /
   `poiDir` leave `DIMENSION_PROP_PACKS`.
2. **The isometric projection mismatch disappears rather than being corrected.** POIs were the *only*
   asset class in a dimension drawn in two-point isometric. Deleting them removes one of the three
   incompatible projections named in §0 outright.
3. **Dimensions have no blocking geometry except pits.** `poiCollisionCircles` leaves `mapgen.ts`
   (three call sites: spawn validity, nav, collision). This is intended — "don't get in our way."
4. **§6.1's implied-height ceiling and §6.2's occlusion policy lose their subject.** Nothing in a
   dimension is tall enough to occlude a player any more. Both sections apply to tunnels only.
5. **Destructible props replace them as art** — crates, tumbleweeds, tables, pots, barrels. Per theme.
   Small, low, ignorable. They obey every rule in §1 and §2 like any other prop.
6. **Destructibles are NOT art and are NOT in this spec's scope.** No destructible system exists in the
   codebase today (zero matches for `destructible` in `packages/`). Prop entities with HP, a break
   reaction, and a dodge-roll interaction are new gameplay code, sequenced as a separate owner-approved
   batch. Until it lands, the new prop art ships as **inert scenery**. The art does not change either way.

**Load-bearing consequence — read this before authoring tiles.** Landmarks were what made one region of
a dimension look different from another. With them gone, the only remaining spatial-orientation cue is
**§3.1's four floor tiles carrying fixed semantic roles** (quiet bed / worn route / disturbed cluster /
pit approach) plus the pits themselves. §3.1 is now carrying weight it was not designed to carry alone.
Author the four variants so a player can tell, at a glance and without landmarks, which kind of ground
they are standing on. Role separation is no longer a nicety — it is the navigation system.

---

## 0. The diagnosis, stated plainly

Two art pipelines produced two incompatible worlds.

**The tunnel** (`packages/client/public/maps/corporate-grid/v13_imagegen_material_variant_modules_60.png`)
is cel-shaded: flat material planes, deliberate ink seams, a pale marble floor read as slabs with a
shallow diagonal joint, dark charcoal structure, muted burgundy accent lines, smoky glass. Value
structure is explicit — **light floor, dark structure, one saturated accent hue.**

**The dimensions** are two different projections stacked on each other:

| Layer | Source | What it actually is today |
| --- | --- | --- |
| Floor tiles | `tools/artkit/gen-terrain-kits.mjs` `TILE_FRAME` | *"viewed from directly overhead"* photoreal/painterly noise. No outlines, no material planes, baked vignettes and lighting gradients (`frostfell/tile-0.png` has a visible bright frame; `ashlands/tile-3.png` is near-black mush). Near-black mean value. |
| Pit rims | same, `RIM_FRAME` | Photoreal cliff renders with soft depth gradients. |
| POI landmarks | `gen-decals.mjs` prop packs | **Full ~45° two-point isometric** — you see the top plane *and two converging side faces* (`pois/ashlands/poi-ashlands-03.png`, `pois/neon-cyber/poi-neon-cyber-01.png`). High internal detail, no ink outline, chroma-green residue at several bases, baked contact shadows/grass patches at the foot. |

So the owner's word "iso" is literally correct for the landmarks, and the floor is a *third* thing —
90° overhead photo-texture. The dimension currently contains a 90° floor, 45° buildings, and 0°
side-profile characters. Nothing agrees with anything, and none of the three agrees with the tunnel.

Fixing this is an asset problem plus four small renderer tweaks (§5). No mapgen, collision, camera,
or netcode work.

---

## 1. The 2.5D target, precisely defined

### 1.1 What the camera is

Define one **virtual camera** shared by every dimension and every tunnel:

- Yaw is free (the tunnel looks along a corridor; a dimension looks straight down at a plain). Yaw is
  what makes them *look* different and is not a parity concern.
- Pitch is **fixed and shared**: tipped back from vertical far enough that a standing object shows a
  substantial front face *and* a substantial top plane, and **no further**.

Authoring target, stated as a measurable result rather than an angle (this is what an image-gen prompt
can actually be held to). For a notional cube of side `S` standing on the ground:

- **Drawn front face height = 0.55·S** (±10%)
- **Drawn top-plane depth = 0.75·S** (±10%)
- Total drawn height of the cube ≈ **1.30·S**

That is roughly a camera ~35° back from straight-down. It is the Super Animal Royale read: you are
looking down at the world, but every building, rock and crate still has a face.

### 1.2 The four hard projection rules (identical to the bible's prop rules)

1. **Verticals stay vertical.** No convergence, no lean, no rotation. This is the single rule that
   separates 2.5D-oblique from isometric, and it is the rule the current POIs break.
2. **Horizontals stay horizontal.** A ground-line is a screen-horizontal line.
3. **Top planes are visible**, compressed to 0.75·S and receding **straight up-screen**, with at most
   an **8% leftward shear** (top plane shifted left relative to the front face) so the shared NW key
   light catches the top-left corner. The shear direction is fixed for every asset in the game.
4. **At most one side face**, and only a sliver (≤ 8% of the object's drawn width), on the **left/west**
   side only. Never two receding side faces. Two side faces = isometric = reject.

Reconciliation with the bible: the bible says prop *"side/depth edges follow one consistent shallow
angle aligned to the hallway diamond floor."* In a tunnel the camera is yawed along a corridor, so
depth recedes diagonally. In a dimension the camera looks down a plain, so depth recedes straight
up-screen. **Same projection, different yaw.** Rules 1–4 hold in both, and they are what the player
reads as "same game".

### 1.3 The floor is orthographic — this is deliberate

**The dimension ground plane is drawn with ZERO foreshortening.** Do not bake an oblique or a diamond
lattice into a dimension floor tile.

Reasons, all structural:

- `mapgen.ts` is a square grid (`MAP_TILE = 80`), movement is isotropic in X and Y, and the map has no
  privileged forward axis. A foreshortened floor would make walking north cover visibly less "ground"
  than walking east.
- `floor-renderer.ts` `drawArena` places painted tiles **axis-aligned, unrotated, and explicitly never
  mirrored** ("never mirror authored light under the one-sun rule", `buildPoiGroundingCluster`). Any
  baked perspective would tile against itself at 512px intervals.
- The pit grid (`drawPitDepth` fills exact `TILE_PIT` rects), the spawn safe-ring (`strokeCircle`), and
  the gate discs are all axis-aligned squares and true circles. A sheared floor would shear against
  every one of them.

The tunnel's floor *is* foreshortened because its camera is yawed at a corridor. A dimension's is not,
because the camera looks down at a plain. This is not an inconsistency; it is the same camera pitch at
two yaws, and no player will notice it while both obey §1.2.

### 1.4 How verticality is implied on a flat floor

Three cues only, in priority order:

1. **Bevels, not perspective.** Any floor-level feature (flagstone, ice plate, deck panel, basalt slab)
   gets a **3 world-px light chamfer** on its top and left edges (+25 greyscale value) and a **3 world-px
   dark chamfer** on its bottom and right edges (−30 value). Implied relief height **≤ 4 world px**.
   This is the whole trick: a top-down floor reads as a real surface with beveled joints and reads as
   paper without them. It also tiles perfectly, which baked shadows and gradients do not.
2. **The pit rim wall** (§3.5) — the only place the world's *thickness* is shown at floor level.
   Implied shelf thickness is **128 world px, identical in every dimension**, so the whole game reads
   as one slab of one depth.
3. **Standing objects** (POIs, `solid`/`edge` decals) — drawn per §1.2 with a procedural contact
   shadow already supplied by the renderer.

### 1.5 Light

One key light, **north-west**, for every asset in the game — floors, rims, decals, POIs, tunnel props.
This is already locked in code: `SHADOW_X = 0.62`, `SHADOW_Y = 0.78` in `floor-renderer.ts` puts the
cast shadow down-and-right, i.e. sun from upper-left.

- Top planes catch the key (lightest plane on any object).
- North and west faces: mid.
- South and east faces: shadow plane.
- **No baked cast shadows, no baked contact shadows, no baked AO, no gradients, no glow/bloom** in any
  tile, rim, decal, or POI. The renderer already draws a soft contact ellipse plus an offset cast
  ellipse for every POI (`ensureContactShadowTexture`, `buildPois`); a baked one would double up.

### 1.6 Outline weight

**Author 1:1 to world pixels.** A 512px tile renders at 512 world px (`PAINTED_TILE_SIZE`); a 280px-tall
POI renders at up to ~320 world px. So authoring pixels ≈ screen pixels, and outline weights can be
stated absolutely:

| Element | Outer silhouette ink | Internal material divisions |
| --- | --- | --- |
| POI landmark | 3–4 px | 1.5–2 px |
| `solid` / `edge` decal | 2–3 px | 1–1.5 px |
| Floor tile | *none* (tiles have no silhouette) | 3–4 px major joints, 2 px minor |
| Pit rim — the lip line | **5–6 px** (the heaviest ink in the floor stack; it is a death boundary) | 2–3 px within the wall face |

Ink colour is a near-black tinted toward the theme's shadow (`FLOOR_STYLES[dim].shadow`), never pure
`#000000` for floors — pure black is reserved for entity outlines so entities stay the crispest thing
on screen.

### 1.7 Contrast and value discipline

Stated as 8-bit **greyscale value** (desaturate and read the Info panel — anyone can verify it).

| Element | Mean value | Notes |
| --- | --- | --- |
| **Floor tile** | **70–125** | Within-tile variation ≤ ±18. Never < 60 (entity black outlines die), never > 145 (blows out the gameplay semaphores and the gas ring). |
| Floor tile, tile-to-tile drift within a theme | ≤ ±12 between the four variants | so zone changes read as *material*, not as lighting |
| Pit void | ≤ 25 | `palette.pitVoid` is already correct for every theme |
| Pit rim wall face | 30–60 | clearly darker than the floor, clearly lighter than the void |
| POI body mass | must differ from the local floor by **≥ 45** | landmarks separate by value alone, before colour |
| Decal (`flat` role) | within ±20 of the floor | wear, not litter |
| Gas ring core | ≥ 230 | see §6.5 |

**This inverts today's dimensions.** The current `groundBed` values (`#1C2330`, `#1a1210`, `#171A21`) are
greyscale 15–25, and the shipped tiles are near-black. The new floors are **mid-value and lighter than
the structure on them** — exactly the tunnel's pale marble against charcoal walls, and exactly Super
Animal Royale's lit ground under dark-outlined animals. Every character, enemy, boss and prop in this
game is drawn with a **uniform black outline** (see every `artPrompt` in `data/dimensions-design.json`).
A black outline on a near-black floor is invisible. This is the single highest-value change in the spec
and it is listed as an owner decision (§9.2) because it changes the mood of every dimension.

Note: `palette.groundBed` only shows through where painted tiles are absent, so this does **not** require
palette edits — but see §5, T2 for the one place the bed colour still matters.

---

## 2. Parity rules with the tunnel

Parity is in **treatment**, never in subject. A dimension must never look like a corporate office.
The seven shared elements:

**P1 — Cel-shaded flat planes.** Every surface is a small number of flat colour planes with hard
boundaries. No airbrush, no noise textures, no photographic grain, no painterly blending. This is the
single biggest visible break today: the current tiles are photographic.

**P2 — Deliberate ink.** Every material boundary is a drawn line at the weights in §1.6. The tunnel's
marble slabs have drawn joints; the dimension's flagstones must too. "Detail" comes from *more shapes
with lines around them*, never from more texture.

**P3 — Bounded palette.** Each dimension theme runs **4–6 colours plus black ink plus one accent**,
mirroring the enemy `artPrompt` discipline already locked in `dimensions-design.json` ("~4-6 colours,
bold uniform black outline, flat cel shading"). The accent is the theme's existing
`palette.pitAmberLip`/`paletteAccent` hue and appears in **≤ 8% of floor area**.

**P4 — One value structure.** Light ground / dark structure / one saturated accent (§1.7). The tunnel
already does this; the dimensions currently do the opposite.

**P5 — One key light, NW, no baked shadows** (§1.5).

**P6 — Pristine bases, wear as decals.** Bible rule, restated for dimensions: base floor tiles are
**clean and pristine**. No unique scuff, stain, scratch, crack-with-personality, or diagonal squiggle
may live in a 512px repeat tile — at 512px the arena shows ~9×9 of them and a memorable mark becomes
wallpaper instantly. All wear ships as separate `flat`-role decals, which the renderer already scatters
seeded and rotated (`scatterDecor`).

**P7 — Nothing is baked into the ground that should be an entity.** Bible rule ("Obstructions are not
baked into base maps"). In a dimension this is load-bearing for *correctness*, not just style: the
server collides against `poiCollisionCircles`, and painting a rock into a floor tile creates a solid-
looking thing you walk straight through.

### What is explicitly NOT shared

- **Subject.** Charcoal/burgundy/brass/smoky-glass is the tunnel's corporate material language and stays
  there. Dimensions use their own themed materials.
- **Camera yaw** (§1.3).
- **Parallax backdrops.** The tunnel has a city layer behind transparent windows. A dimension is a
  top-down plain with no horizon and no backdrop layer; do not invent one.
- **The burgundy accent.** It is the tunnel's identity hue. Dimensions use their own.

---

## 3. The asset list

### 3.0 What the renderer will actually load

Verified in `ArenaScene.ts` (preload ~L1930 and the lazy floor gate ~L4125) and `floor-renderer.ts`:

```
packages/client/public/tiles/<dim>/tile-0.png     512×512   terrain:<dim>:tile-0
packages/client/public/tiles/<dim>/tile-1.png     512×512   terrain:<dim>:tile-1
packages/client/public/tiles/<dim>/tile-2.png     512×512   terrain:<dim>:tile-2
packages/client/public/tiles/<dim>/tile-3.png     512×512   terrain:<dim>:tile-3
packages/client/public/tiles/<dim>/rim.png       1024×256   terrain:<dim>:rim
packages/client/public/pois/<dim>/poi-<dim>-NN.png          (6–7, transparent)
packages/client/public/decals/<dim>/decal-<dim>-NN.png      (8–11, transparent)
```

Hard gates:

- `drawArena` requires **all four** tile keys (`paintedKeys.every(hasTile)`). Three tiles = the whole
  painted path is skipped and the legacy `tile-ground` fallback runs. Ship kits complete or not at all.
- `rim.png` is independently optional (`if (hasTile(rimKey))`). Absent = procedural bands only.
- POI/decal ids are frozen by the manifests in `packages/client/src/sprites/` and the metadata tables in
  `floor-renderer.ts` (`FROSTFELL_POI_META` etc.). **Re-authoring must reuse the existing ids and index
  order** — the local kind/index → texture convention is the stable contract. New art in old slots.
- No asset may be added that the renderer does not already look for, except the one optional file in
  §5 T3.

### 3.1 The four floor tiles — role contract

`zoneVariants()` selects a tile from a per-dimension index array by map zone and material zone. Today
those arrays differ per dimension (`FLOOR_STYLES`), so "tile-2" means different things in frostfell and
ashlands. **§5 T1 unifies them.** Under the unified mapping the four slots are:

| Slot | Role | Selected when | Share of floor |
| --- | --- | --- | --- |
| `tile-0` | **COMMONS BED** | `MAP_ZONE_COMMONS` + material `base` | ~55–70% |
| `tile-1` | **ROUTE** | material `route` (the seeded wear paths from spawn to the big landmarks, `buildWearRoutes`) | ~8% |
| `tile-2` | **COVER / CLUSTER** | `MAP_ZONE_COVER`, and POI aprons in Commons | ~15% |
| `tile-3` | **SCAR / EDGE** | `MAP_ZONE_SCAR`, and any 512px cell within one map tile of a pit | ~15% |

Art direction per role, applying to every theme:

- **`tile-0` COMMONS BED** — the quietest, most uniform surface in the kit. Largest, plainest material
  units. This is the tile the player stares at for ten minutes; it must be boring on purpose. Lowest
  internal contrast of the four (variation ≤ ±12).
- **`tile-1` ROUTE** — the same material, *compacted*: joints partly filled, surface incident worn
  smoother, value shifted **+8 to +12** (a trodden path reads lighter, and the renderer already lays a
  low-alpha wear stroke over it in `buildPathWear`). No footprints, no arrows, no directional marks —
  routes run in every direction and any direction cue would be wrong most of the time.
- **`tile-2` COVER / CLUSTER** — the richest material. This is where landmarks stand and where cover
  fights happen. More material units, more joints, a secondary material introduced (rubble, plating,
  drift, growth). Still no hero features. Value within ±12 of the bed.
- **`tile-3` SCAR / EDGE** — broken. The material is fractured into smaller pieces, joints widen into
  gaps, the theme accent appears at its highest concentration here (still ≤ 8% of area). This tile
  surrounds every pit and fills the SCAR zone, so it must read as "the ground is failing here" while
  staying flat, tileable, and low-relief. **The accent must not resemble the amber pit lip** — the lip
  is the exact death boundary and nothing else may claim that read (see §6.3).

### 3.2 Tile tiling constraints (all four)

1. **Seamless toroidally** — left continues right, top continues bottom.
2. **Seamless across variants.** Tiles are placed on a 512 grid with no gutters and *any* variant may
   neighbour *any* variant. Run `normalizeTileFamily({ files, baseFile: tile-0, strip: 32 })` from
   `tools/artkit/lib/map-art-processing.mjs` on every kit — it blends all four perimeters into one
   shared strip derived from `tile-0`. **This means the outer 32px of all four tiles is effectively the
   commons-bed material**; do not put role-defining content there.
3. **No rotation-tolerance requirement, but no mirror-tolerance either** — tiles are drawn unrotated and
   unflipped, so authored NW light is preserved. Author for one orientation only.
4. **No vignette, no border, no lighting gradient, no corner darkening.** Keep luminance and chroma flat
   edge-to-edge; the current `frostfell/tile-0.png` fails this visibly.
5. **No feature larger than ~140px** (≈1.75 map tiles) and **no memorable feature at all.** At 512px the
   arena is a 9×10 grid of these; anything with a personality becomes a repeating stamp within seconds.
6. **Nothing that reads as an obstacle, a hazard, a pit, a hole, a ledge, or a door.** Every one of those
   words has an authoritative gameplay meaning elsewhere on this floor.
7. **Opaque, no alpha.** Tiles are direct renders, not chroma-keyed (see §4).

### 3.3 The pit rim — `rim.png`, 1024×256

The most constrained asset in the kit. `buildPaintedRims()` uses it two different ways:

**Camera-facing runs** (`nx === 0, ny === 1` — ground above, pit below; the wall you look at):
a `tileSprite` of the **full 256px height, centred on the exact tile boundary line**, at depth −13.9.

> **Therefore: the ground/void split in the art must sit at exactly y = 128, the vertical centre.**
> Top 128px = the ground surface running up to the lip. Bottom 128px = the wall face falling into dark.
> The top half overlaps real walkable ground — it must be continuous with `tile-3` in material and
> value, or there will be a visible seam ring around every pit.

**All other runs** (north-facing, east, west): a derived **lip** strip — `ensureRimLipTexture` crops the
top 28% of `rim.png` (72px), squashes it to 18% of source height (**46px**), and rotates it. A 2.6×
vertical squash will visibly crush cel linework. Two consequences:

- Author the top 72px so it survives a 2.6× vertical squash: **horizontal linework only** in that band,
  no diagonal joints, no vertical elements.
- Or ship the optional authored override in §5 T3.

Composition rules:

- Ground band (y 0–128): `tile-3` material, converging on the lip. Value 70–125 at the top, easing to
  ~60 at the lip.
- **The lip line at y = 128: a 5–6px near-black ink rule, unbroken, running the full width.** This is
  the heaviest ink in the game's floor stack.
- Wall band (y 128–256): a vertical face, value 30–60 at the top falling to ≤ 25 at the bottom. The face
  must read as **one consistent 128px slab thickness** — this is the world's implied depth and it is
  shared by every dimension. Small overhangs and broken teeth are welcome; a *soft gradient* is not.
- **Horizontally tileable**, run `normalizeRim(file, 32)`. Left/right material, lip height, wall depth,
  and value must continue at identical heights. No unique crack, root, cable, or vine may begin or end
  in the outer 32px.
- **No hot accent along the lip.** The renderer draws the authoritative danger rail on top of this art:
  a rust band at `T*0.11` (8.8px) and an amber lip at `T*0.045` (3.6px) plus chevron/notch glyphs
  (`buildArenaFloor`). Painting your own glow there produces two competing danger lines.

### 3.4 POI landmarks — 6–7 per theme — **VOID (see R7). DO NOT AUTHOR.**

> **This subsection is dead.** Owner deleted landmarks from dimensions entirely on 2026-07-25. The 31
> existing POI assets are removed, not re-authored. Replaced by low destructible props (crates,
> tumbleweeds, tables) which follow the ordinary prop rules in §1–§2, carry no height allowance, and
> block nothing. Retained below only so the deletion is auditable.

Scale math (verified in `buildPois`): `scale = (poiRadius(kind) * 2) / meta.baseSpanPx`, so

```
displayed height = texture_pixel_height × (2·r / baseSpanPx)
displayed height / footprint width = texture_pixel_height / baseSpanPx     ← the authoring lever
```

`MAP_POI_RADIUS = 58`; classes are S 0.8 / M 1.0 / L 1.45 / XL 1.9 (`poiScale`), so footprint widths are
92 / 116 / 168 / 220 world px. A player rig is ~120 world px tall (`TARGET_BODY_H = 76` plus detached
head and feet).

| Rule | Value | Why |
| --- | --- | --- |
| **Height cap** | `texture_height / baseSpanPx ≤ 1.45` | At XL that is 320 world px ≈ 2.7 player heights, and ≤ 40% of the height of the smallest viewport we support. Today `poi-frostfell-02` is 1.73 (≈380px) — a real, small reduction. |
| **Mass distribution** | the widest 80% of the silhouette must live in the **bottom 45%** of the sprite | anything above the base must be a spire/mast/pylon/arch-post, never a slab — so the occluded column is narrow (§6.2) |
| **Contact** | keep `contactX`/`contactY` on the existing base-centre convention (~y 274 of 280) | the metadata tables in `floor-renderer.ts` are already calibrated; re-author to the same anchor rather than editing the table |
| **Projection** | §1.2, strictly. Front face square-on, one visible top plane, **no second side face** | the current iso landmarks are exactly what is being replaced |
| **Shadows** | none baked. No grass tuft, dirt patch, or contact darkening at the foot | the renderer supplies the contact ellipse, the cast ellipse, the skirt and the collider cue |
| **Alpha** | clean transparent cutout, zero chroma fringe | several shipped POIs have visible green fringe; two ids are already quarantined in code as unusable chroma-green sources (`poi-05`, `decal-neon-cyber-06`) |
| **Canopy ramp** | `heightClass 3` POIs only: bake an alpha ramp above 70% height, 100% → 70% | §6.2 — costs zero code |
| **Read** | must read as a **blocker** at a glance | it *is* one; `poiCollisionCircles` collides an L/XL as three overlapping circles spanning the full base width, so no walk-through arches, no open gates, no doorways. `poi-verdant-ruins-01` is already quarantined (`usable = false`) for promising a passage that does not exist. |

Bucket mix per theme (matching the existing `poiMeta` tables so nothing needs rewiring): 2–3 `structure`,
2 `squat`, 1 `organic`.

### 3.5 Decals — 8–11 per theme

Three roles, already typed in `floor-renderer.ts`:

| Role | Projection | Drawn at | Author as |
| --- | --- | --- | --- |
| `flat` | `ground` / `low` | alpha **0.065**, depth −15 / −13.55, rotated arbitrarily on `ground` | **pure top-down**, no height, no ink outline (it would ghost). Wear: scorch, drift, moss film, stain, frost bloom, oil. Value within ±20 of the floor. |
| `edge` | `low` / `upright` | alpha **0.52**, depth −13.55/−13.85 | low-profile debris lying *on* the ground: shards, planks, plates, chunks. ~0.3·S implied height. Thin ink (2px). |
| `solid` | `low` / `upright` | alpha **0.64**, depth −13.55 | small standing objects, §1.2 projection, ≤ 60 world px implied height, 2–3px ink. |

Footprint band is 132px (`decalMeta` default `footprintPx = 132`); drawn scale is 0.18–0.46, so a decal
renders at **24–61 world px**. Author at 132px and expect a ~3× downscale: **no detail below 6 authored
px will survive.**

`flat` at alpha 0.065 is the reason today's floor litter is invisible. See §5 T4.

Per-theme decal roles must include, at minimum: 3 `flat` non-accent (the scatter pool — `scatterDecor`
filters `role === "flat" && !accent`), 3 `edge` (the pit-debris pool — `buildPitDebris` filters
`projection === "low" || role === "edge"`), 2 `solid`, and ≤ 2 marked `accent` (the renderer places at
most one accent per landmark, only at L/XL, at 28% odds).

### 3.6 The border ring

`mapgen.forceGround` guarantees a `MAP_BORDER_TILES = 1` (80px) ground ring. Today the only art is a
**6px stroked rectangle** in `palette.boundaryRail` at depth −12 (`drawArena`). In a 2.5D world that is
a hairline on an infinite plane, and the illusion dies at the map edge.

Proposed treatment (needs §5 T2, no new asset): terminate the world as a **shelf**, reusing `rim.png`.
Four synthetic runs around the arena rect with outward normals — the south edge takes the full 256px
camera-facing wall, the other three take the 46px lip — plus a `palette.pitVoid` fill covering the
painted-tile overhang outside the rail (tiles are laid to 5120px against a 4800px arena). The 6px
`boundaryRail` stroke **stays on top** as the gameplay bound; it is a semaphore, not decoration.

Result: a dimension reads as a finite plateau of the same 128px thickness as its pits, floating in the
theme's void — which is precisely the Super Animal Royale island read, and it costs no art.

### 3.7 Kit summary

Per dimension theme: **4 tiles + 1 rim + (1 optional lip) + 6–7 POIs + 8–11 decals = 19–24 assets.**
Four themes = 76–96. Five, if `wild-west` is kept (§9.1).

---

## 4. Chroma-key note

The bible mandates `#ff00ff` for assets containing green foliage because the standard key is `#00ff00`.
For dimensions the rule needs one extra clause, because **`neon-cyber`'s accent is magenta**
(`boundaryRail #FF3BD4`, Dronemite accent `#FF3BD4`) — magenta-keying that theme would eat its own hue.

| Theme | Key | Reason |
| --- | --- | --- |
| `frostfell` | `#00ff00` | glacial blue / cyan / bone. No greens, no magentas. |
| **`verdant-ruins`** | **`#ff00ff`** | **every POI and decal in the pack.** Moss, vine, lichen, fern, leaf-litter, and the `#9cff3b` plasma-lime accent all sit inside the green key. Specifically: `poi-verdant-ruins-00 … 05` and `decal-verdant-ruins-00 … 08`. |
| `ashlands` | `#00ff00` | charcoal / basalt / ember-orange. No greens. |
| `neon-cyber` | `#00ff00`, **with a constraint** | magenta is unusable as a key here. To keep `#00ff00` safe, **the `#9cff3b` lime is forbidden in neon-cyber environment art** — it is reserved for `spawnRingSafe`, which is a gameplay semaphore and should not be echoed by scenery anyway. Cyan `#33e6ff`, violet `#b14bff` and magenta `#ff3bd4` are all far from the green key. |
| `wild-west` | `#00ff00` | dust / rust / bone. Grass wisps must be **pale straw**, not green — `poi-05` is already quarantined in code as a failed green key. |

Floor tiles and rims are **exempt**: `gen-terrain-kits.mjs` renders them direct with no chroma pass and
installs them opaque. Only the POI/decal packs (`gen-decals.mjs`) are keyed.

Validation, per the bible's export rules: remove chroma locally, confirm all four alpha corners are
transparent, and confirm **no residual key pixels anywhere in the sprite**, not just at the border.
Several shipped POIs fail this today with green fringing along the base.

---

## 5. Render tweaks required

Four tweaks. Each is data or a small localized edit; none touches mapgen, collision, camera, netcode, or
the depth contract. Listed with why-needed and why-small.

### T1 — Unify the tile role mapping (config only)

**What.** In `FLOOR_STYLES` (`floor-renderer.ts` L270–336), set every dimension to
`tileBase: [0], tileRoute: [1], tileCluster: [2], tileEdge: [3]`.

**Why needed.** Today the five dimensions each map the four slots differently (`frostfell` base `[1]`,
`ashlands` base `[3]`, `verdant-ruins` reuses tile 2 for both cluster and edge, `wild-west` uses two-tile
arrays). There is no way to write "author tile-2" in a prompt and have it mean one thing.

**Why small.** Five four-line literals in one `const`. No logic, no call sites, no types. It is only
safe *after* each kit is re-authored in role order, so it lands with the art.

**Cost of not doing it.** Every prompt has to carry a per-dimension index table, and the next kit gets it
wrong.

### T2 — Terminate the arena boundary as a shelf

**What.** In `drawArena`, after the existing rail: (a) fill the four bands between the arena rect and the
painted-tile overhang (out to 5120px) with `palette.pitVoid` at depth −14.5; (b) build four synthetic
`PitSegment` runs on the arena rect with outward normals and pass them through the existing
`buildPaintedRims` when `hasTile(rimKey)`; (c) keep the 6px `boundaryRail` stroke on top at −12.

**Why needed.** §3.6 — without it the 2.5D read has no terminus and the world edge is a hairline over
tiles that visibly continue past the playable bound.

**Why small.** All the machinery exists: `mergeRimRuns`/`buildPaintedRims` already turn runs into
oriented tileSprites, and the depth band −14.5 is free (pits −14, rims −13.9). Approximately 40 lines,
render-only, zero new assets, zero collision change — `forceGround` already guarantees the border ring is
walkable ground, so nothing gameplay-relevant lives out there.

### T3 — Optional authored side/back lip

**What.** In `ensureRimLipTexture`, early-return an authored `terrain:<dim>:rim-lip` texture
(`tiles/<dim>/rim-lip.png`, 1024×64) when it exists; otherwise fall through to today's crop-and-squash.
Add the file to the two optional-floor-art preload lists in `ArenaScene.ts`.

**Why needed.** The derived lip crops the top 28% of `rim.png` (72px) and squashes it to 46px — a 2.6×
vertical crush that destroys cel linework. Every non-camera-facing pit edge in the game gets this.

**Why small.** One `if (scene.textures.exists(key)) return { key, height }` guard plus one preload entry.
The fallback path is untouched, so kits that skip the file behave exactly as today.

**Alternative if this is rejected:** author the top 72px of `rim.png` as horizontal linework only, so the
squash is survivable. Slightly worse result, zero code.

### T4 — Per-pack decal alpha

**What.** Add `decalAlphaFlat`, `decalAlphaEdge`, `decalAlphaSolid` to `DimensionFloorStyle`, defaulting
to today's `0.065 / 0.52 / 0.64`, and substitute at the five hard-coded call sites
(`buildPoiGroundingCluster` ×1 ternary, `buildPitDebris` ×1, `scatterDecor` ×1).

**Why needed.** 6.5% alpha on an ink-outlined cel decal renders nothing. The current values were tuned
for soft painterly noise; a flat decal with a 2px black line needs roughly **0.18–0.25**.

**Why small.** Three numbers on an existing readonly type plus three literal substitutions. Defaults
preserve current behaviour exactly, so it cannot regress an un-re-authored pack.

**Gate.** The exact values are a screenshot decision with the owner, not a spec decision (§9.6).

### Explicitly NOT proposed — real engine work, with art-only alternatives

| Tempting | Why it's not small | Art-only alternative |
| --- | --- | --- |
| Foreshorten the floor / true perspective | Breaks isotropic movement, shears against the square pit grid and the circular spawn/gate discs, and invalidates every existing world-px calibration | §1.4 bevels — a top-down floor with beveled joints reads 2.5D and tiles perfectly |
| Wall tiles / elevation in mapgen | `mapgen.ts` is binary `TILE_GROUND`/`TILE_PIT` with a hop-connectivity post-condition; height is a new authoritative dimension for pathing, collision, projectiles and netcode | Verticality comes from pit rims (down) and POIs (up) only — which is already all the renderer models |
| Fade POIs when **any enemy** is behind them | A per-frame N-enemies × M-landmarks test, and constant strobing as 40 enemies stream past | §6.2 — cap the occluding column by silhouette, plus the baked canopy alpha ramp |
| Dynamic shadows / a light pass | Renderer is a flat depth-sorted 2D stack by design | One baked NW key per asset (§1.5), plus the procedural contact + cast ellipses that already exist |
| Auto-tiled edge/corner transition tiles | `zoneVariants` picks one of four by zone; there is no 47-tile blob machinery and adding one is a real system | The 32px `normalizeTileFamily` shared perimeter already makes every variant abut every other cleanly |

---

## 6. The readability risk

A dimension is a 4800×4800 arena, viewed at roughly 1:1 world-px-to-CSS-px
(`camera.setZoom(RENDER_DPR)` against a `RENDER_DPR`-scaled buffer), so a 1920×1080 window shows
1920×1080 world px — about 24×13 map tiles, or 3.7×2.1 painted tiles. Into that fits: up to 28 POI
landmarks per map (`MAP_POI_COUNT`), 40+ enemies, dense weapon VFX, boss telegraphs, portals, capsule
drops, and a closing gas circle. **The art is the thing most likely to destroy this.** The constraints
below are not style preferences; they are the conditions under which the fight stays legible.

### 6.1 Implied height ceiling

- **Nothing on a dimension floor may imply more than 128 world px of downward depth** — the shelf
  thickness, identical everywhere.
- **Nothing may imply more than 320 world px of upward height**, and only XL landmarks reach it
  (§3.4 height cap `≤ 1.45 × footprint`). That is 2.7 player heights and ≤ 40% of the shortest
  supported viewport.
- Decals: `solid` ≤ 60 world px, `edge` ≈ 0.3·S. Floor bevels ≤ 4 world px.

### 6.2 Occlusion policy

The renderer depth-sorts entities against POIs by base-Y (`img.setDepth(poi.y)`, entities at
`depth = worldY`), so a landmark genuinely hides whatever stands behind it. `updatePoiOcclusion`
(`ArenaScene.ts` L10387) fades a POI to 45% **only when the local player is behind it** — enemies behind
one stay hidden.

The mitigation is entirely in the silhouette, and it is mandatory:

1. **The widest 80% of the mass in the bottom 45%** (§3.4). Above that, only narrow elements — a mast, a
   pylon, a spire, an arch post, a chimney, a mine-head wheel. A tall *slab* is the failure case; it
   hides a 220px-wide column of arena for its entire height.
2. **The occluded column above the base must be ≤ 35% of the sprite's width.** An XL therefore hides at
   most ~77 world px of width above its own footprint — narrower than one enemy.
3. **Baked canopy alpha ramp**, `heightClass 3` only: alpha ramps 100% → 70% across the top 30% of the
   sprite. Costs zero code and softens exactly the part of the sprite that is doing the occluding.
   Never ramp below 70% (a landmark must still read as a solid blocker) and never ramp the bottom 70%
   (the base is the collider and must stay opaque and honest).
4. **No POI may be transparent in its base region.** The base *is* the collision footprint.
5. Decals and the whole floor stack live at depths −20…−13.55, **strictly below entities**. No decal can
   ever occlude anything. Keep it that way — no decal is ever promoted above depth 0.

### 6.3 Semaphore protection

These reads are authoritative and nothing in a kit may imitate them:

| Semaphore | Owner | Kit prohibition |
| --- | --- | --- |
| **Hot amber/rust pit lip** + inward chevrons | `buildArenaFloor`, `palette.pitAmberLip` / `pitRustBand` | No hot linear accent anywhere on open floor. `tile-3`'s accent must be *point-like or areal*, never a continuous bright line. |
| **Cool cyan spawn safe-ring** (`spawnRingSafe`, cool = safe) | `buildArenaFloor` | No cool-cyan ring, arc, or circle in any tile or decal. |
| **Portal / gate discs** | gate ground depth −10, protected read 99990 | No circular ground feature over ~120px in any tile. |
| **Enemy tier glow** | engine layer | No baked glow or bloom in any environment asset, ever. |
| **Gas circle** | §6.5 | No large near-white field; no marching-chevron pattern. |

### 6.4 Floor-to-entity separation

- Floor value 70–125 (§1.7) guarantees every entity's **uniform black outline** has ≥ 50 points of
  contrast against the ground everywhere on the map.
- Floor tiles carry **no black** above 4px in any dimension. Black is the entity read; a floor with black
  joints thicker than that produces false silhouettes at speed.
- Floor chroma stays **below the entity chroma**. Each theme's accent hue appears on ≤ 8% of floor area
  and never at full saturation on the floor — enemies and VFX own the saturated end of the theme.
- The four tile variants sit within ±12 value of each other, so a zone transition reads as a **material**
  change, never as a lighting change or a shadow the player might mistake for a hazard.

### 6.5 The gas circle stays legible

The closing gas circle is LOCKED design (`design-lock-b57`, rule 9) and is **not built yet** (lane L3).
Specifying it now is cheap; retrofitting it over four finished kits is not.

The problem: every hue is taken. Frostfell owns cyan, verdant owns lime, ashlands owns amber, neon owns
magenta + cyan + violet. **Therefore the gas must not be identified by hue.** Its identity is
**value + motion + ink**:

- **Exterior veil** — a single theme-neutral cold dark plum (`#2A2233`) filling everything outside the
  circle, alpha ramping 0 → 0.5 across the first ~400px and capped at 0.5. Drawn at **depth −9.5**:
  above the entire floor stack (deepest is gate ground at −10), **below entities (≥ 0)**. This is the
  key decision — the veil darkens the *ground* but never dims an enemy, so the outside stays lethal-
  looking and still fully readable. Same colour in every dimension so the signal is learned once.
- **The ring** — 5 world px bone-white core (`#EDE7DA`, value ≥ 230) flanked by 2px near-black ink on
  both sides. The ink is what makes it survive a pale frostfell floor *and* a dark ashlands one.
  Inward-marching chevrons at ~96px pitch supply the motion cue, at the same weight.
- **Depth** — the ring at ~99985, mirroring the existing `GATE_PROTECTED_DEPTH = 99990` pattern: above
  every y-sorted world occluder, below telegraphs/HUD, and just below the gate's protected read so a
  portal locator still wins a tie.
- **The kit constraint this imposes:** no dimension floor tile, decal, or rim may present a large field
  above value 145 or a bone/off-white hue. **Frostfell is the asset at risk** — its ice and snow must be
  blue-grey (value 95–125), never white. The current `frostfell/tile-0.png` is near-white and would
  swallow the ring completely.

### 6.6 Density budget

The renderer already caps decor: ≤ 10 dust drifts, `round(7 × area/2400²)` flat scatter marks, 1–5
grounding decals per landmark, pit debris every 2–4 segments. **These budgets are calibrated for the
current near-invisible alpha.** Raising alpha (T4) without re-checking density is how a legible floor
becomes noise. The screenshot gate must evaluate alpha and density together, at a 40-enemy fight, not
on an empty map.

---

## 7. Generation prompt templates

Written in the bible's prompt style, drop-in for `tools/artkit/gen-terrain-kits.mjs` (replacing
`TILE_FRAME` / `RIM_FRAME`) and `gen-decals.mjs`. One shared frame per asset type plus per-theme
material lines.

### 7.1 Shared frames

**TILE_FRAME_25D**

```text
Paint ONE SQUARE 512x512 image: a TOP-DOWN GROUND TEXTURE for a 2D action game floor, drawn in a
cel-shaded comic style, viewed from directly overhead with NO perspective and NO isometric skew.
Style: flat cel-shaded material planes with hard edges, deliberate drawn linework, 4-6 colours plus a
dark ink. NO photographic texture, NO airbrush, NO noise, NO painterly blending, NO gradients.
Relief: material joints get a 3px light chamfer on their top and left edges and a 3px dark chamfer on
their bottom and right edges — a shallow beveled surface, implied relief no deeper than 4px.
Light: one key from the upper-left, expressed ONLY through those chamfers. NO cast shadows, NO baked
ambient occlusion, NO vignette, NO glow, NO bloom.
Value: mid-tone. Overall greyscale value 70-125 of 255, internal variation no more than ±18. Never
near-black, never near-white.
Linework: 3-4px joints for major material divisions, 2px for minor. No line thicker than 4px anywhere.
Tiling: SEAMLESSLY TILEABLE — the left edge continues the right edge and the top continues the bottom.
Keep luminance, chroma and material uniform through the outer 10% on all four sides; no feature may
enter that band unless it continues toroidally through the exact opposite edge. NO border, NO frame.
Content: PRISTINE and REPEATABLE. No unique scuff, stain, scratch, crack, squiggle, or memorable mark
of any kind — this image repeats about 90 times on screen. No feature wider than 140px. No object, no
creature, no text, no debris, no hole, no ledge, no doorway, no circular marking, no bright line.
```

**RIM_FRAME_25D**

```text
Paint ONE 1024x256 image: a horizontal TOP-DOWN CLIFF RIM strip in a cel-shaded comic style — the lip
where solid ground breaks off and drops into a pit.
Composition, exact: the TOP HALF (y 0-128) is the ground surface running up to the edge. A 5-6px
unbroken near-black ink lip line sits at EXACTLY the vertical centre, y=128, running the full width.
The BOTTOM HALF (y 128-256) is the vertical wall face falling into darkness — one consistent slab of
thickness, not a receding slope.
Style: flat cel-shaded planes, hard edges, drawn linework, 4-6 colours plus dark ink. NO photographic
texture, NO airbrush, NO soft gradient, NO glow.
Value: ground band 70-125 easing to about 60 at the lip; wall face 30-60 at the top falling to 25 or
darker at the bottom.
Light: one key from the upper-left. NO cast shadows, NO baked ambient occlusion, NO vignette.
Detail: crisp broken edge with small square overhangs and a few blocky teeth. Verticals stay vertical.
Tiling: TILEABLE HORIZONTALLY. Left and right material, lip height, wall depth and value must continue
at identical heights. No crack, root, cable, vine or overhang may begin or end in the outer 10%.
The top 72px band must be HORIZONTAL LINEWORK ONLY — no diagonals, no vertical elements — because it is
also reused as a squashed side-edge strip.
NO hot glowing accent along the lip (the engine draws its own hazard rail on top). No objects, no
creatures, no text, no border.
```

**POI_FRAME_25D**

```text
Create ONE original <theme> landmark structure as an isolated 2D game asset on a perfectly flat solid
<CHROMA> chroma-key background.
Perspective: SHALLOW 2.5D — a camera looking down at the object but tipped back enough to show a real
front face. For a cube of side S, the drawn front face is 0.55S tall and the visible top plane is 0.75S
deep. VERTICALS STAY VERTICAL — no convergence, no lean, no rotation. Horizontals stay horizontal. The
top plane recedes STRAIGHT UP-SCREEN with at most an 8% shift to the LEFT. Show AT MOST a thin sliver of
ONE side face, on the LEFT side only. NEVER two converging side faces — this must NOT be isometric.
Silhouette: the widest 80% of the mass sits in the BOTTOM 45% of the image. Above that, only narrow
elements — a mast, spire, pylon, post or chimney no wider than 35% of the total width. Overall image
height must be no more than 1.45x the width of the base footprint.
It must read instantly as a SOLID BLOCKER: no arch you could walk through, no open gate, no doorway,
no tunnel.
Style: dark-comic cel-shaded action-game asset art. Thick 3-4px black outline on the outer silhouette,
1.5-2px internal material divisions, flat cel-shaded planes, 4-6 colours. Moderate internal detail,
readable at game scale. NO photographic texture, NO painterly rendering, NO gradients.
Light: one key from the upper-left — top planes lightest, north/west faces mid, south/east faces
shadowed. NO cast shadow, NO contact shadow, NO ground patch, NO grass, NO dirt, NO base plinth of any
kind under the object.
NO glow, NO bloom, NO VFX, NO people, NO creatures, NO weapons, NO text, NO chains, ropes or tassels.
Generous padding on all sides for transparent cutout export.
```

**DECAL_FRAME_25D**

```text
Create <decal list> as separated 2D ground decals on a perfectly flat solid <CHROMA> chroma-key
background, each isolated with generous padding.
FLAT decals: pure top-down, zero height, NO outline — surface wear only (stain, scorch, drift, film,
bloom, residue), value within 20 points of the floor.
EDGE decals: low debris lying ON the ground — shards, plates, planks, chunks — implied height about
0.3 of their width, 2px ink.
SOLID decals: small standing objects, shallow 2.5D per the landmark rule (front face 0.55S, top plane
0.75S, verticals vertical, one left-side sliver at most), implied height no more than 60px, 2-3px ink.
Style: flat cel-shaded planes, hard edges, 4-6 colours, dark-comic action-game asset art.
Light: one key from the upper-left. NO cast shadows, NO contact shadows, NO ground plane, NO glow.
These render at roughly one third of authored size — no detail finer than 6px.
No text, no labels, no people, no creatures, no weapons.
```

### 7.2 Per-theme material lines

Substitute into the frames above. Accent hues are the theme's existing palette accents and stay
under 8% of floor area.

**FROSTFELL** — *"The cathedral froze mid-prayer, and the prayer answered."*
Palette: blue-grey packed snow, glacier blue, slate, bone. Accent `#33E6FF` cyan (points only).
**Critical: no white.** Snow and ice are blue-grey at value 95–125 — the gas ring owns near-white.

- `tile-0` COMMONS BED — wind-packed blue-grey snow over broad frozen flagstones, joints beveled, quiet.
- `tile-1` ROUTE — the same flagstones swept clear and polished by traffic, joints part-filled, +10 value.
- `tile-2` COVER/CLUSTER — cracked glacier plates over the flagstones, a second material of pale rime ridges.
- `tile-3` SCAR/EDGE — the ice sheet fractured into smaller plates, joints widened to dark gaps, sparse cyan-chip glints (points, never a line).
- `rim` — a fractured blue-ice shelf: snow-crusted ground band, blocky snow overhang teeth at the lip, a slate-blue ice wall falling to near-black.
- POIs — frozen cathedral fragments: a broken bell-tower stump, a rimed buttress pier, a stack of frost-welded pews, a hoarfrost stalagmite cluster, a toppled reliquary block, an ice-locked bare tree.
- Decals — flat: frost bloom, snow drift film, thaw stain. edge: ice shards, splintered planks, broken slate. solid: a rime boulder, a frozen votive stump.

**VERDANT-RUINS** — *"The jungle ate the temple, and the temple woke up."* Chroma `#ff00ff`.
Palette: grey-green stone, moss green, deep olive, bone. Accent `#9CFF3B` plasma-lime (points only).

- `tile-0` COMMONS BED — broad grey temple flagstones with moss filling the beveled joints, quiet.
- `tile-1` ROUTE — the same flagstones scrubbed bare by traffic, moss retreated to the joints, +10 value.
- `tile-2` COVER/CLUSTER — moss carpet advancing over the stone, flagstone seams ghosting through, a second material of clover and leaf-litter.
- `tile-3` SCAR/EDGE — flagstones heaved and broken into smaller plates, root wedges in the widened joints, sparse lime spore-flecks (points).
- `rim` — a broken mossy terrace edge: mossed ground band, blocky broken flagstone teeth at the lip, a root-veined stone wall falling to dark green-black.
- POIs — temple fragments: a carved stela, a collapsed column drum stack, a mossed idol torso, a root-split wall section, a strangler-fig stump, a stepped altar block.
- Decals — flat: moss film, leaf-litter, water stain. edge: broken flagstones, fallen branches, shattered carving. solid: a mossed boulder, a fern-crowned stump.

**ASHLANDS** — *"Cracked magma, falling ash, and the brute below."*
Palette: warm charcoal, basalt grey, soot, dull brick-red. Accent `#FF8A2B` ember (points only).
**Critical:** the current kit is near-black mush. The ash field must be a **lit grey field**, value 75–110.

- `tile-0` COMMONS BED — packed grey ash over broad cooled basalt plates, joints beveled, quiet.
- `tile-1` ROUTE — ash swept from the basalt by traffic, plate faces exposed, +10 value.
- `tile-2` COVER/CLUSTER — ropey lava crust over the plates, a second material of cinder gravel and slag chips.
- `tile-3` SCAR/EDGE — basalt fractured into smaller plates, joints widened to dark fissures, sparse ember specks deep in the gaps (points, never a continuous glowing line — the pit lip owns that read).
- `rim` — a cracked basalt shelf: ash-dusted ground band, blocky broken column teeth at the lip, a columnar basalt wall falling to near-black. No ember glow on the lip.
- POIs — a slag chimney, a cooled lava bulwark, a cracked obsidian monolith, a collapsed kiln, a cinder-cone mound, a fused bone-and-basalt stack.
- Decals — flat: soot smear, ash drift, scorch ring. edge: basalt shards, slag chunks, broken plates. solid: a cinder boulder, a small vent stack.

**NEON-CYBER** — *"Chrome streets, killbots, and the live grid."*
Palette: gunmetal, cool slate, dark alloy, off-white paint wear. Accents `#33E6FF` cyan, `#B14BFF` violet,
`#FF3BD4` magenta (points only). **No `#9CFF3B` lime anywhere** (§4).
**Critical:** the floor plate must be light enough to be a *street*, value 80–120, not a black void.

- `tile-0` COMMONS BED — broad brushed-gunmetal deck plates with hairline beveled panel seams, quiet.
- `tile-1` ROUTE — the same plating scuffed smooth by traffic, paint wear along the walk line, +10 value.
- `tile-2` COVER/CLUSTER — mixed plate sizes with inset grating and cable channels, a second material of composite tiling.
- `tile-3` SCAR/EDGE — plating sheared into smaller panels, seams widened to dark gaps, exposed conduit stubs, sparse cyan/violet indicator points (never a continuous bright trace).
- `rim` — a sheared deck edge: plated ground band, blocky torn-plate teeth at the lip, an exposed strut-and-cable wall falling to near-black.
- POIs — a server pylon, a transformer block, a sheared mag-lev stanchion, a stacked cargo module, a coolant drum cluster, a holo-billboard post (dark panel — no baked glow), a vent tower.
- Decals — flat: oil stain, paint wear, grime film. edge: torn plate, cable coil, broken panel. solid: a bollard, a junction box.

**WILD-WEST** *(only if kept — §9.1)* — *"Dust, rust, and the drop."*
Palette: pale ochre hardpan, dusty tan, weathered bone, rust brown. Accent rust/amber (points only).

- `tile-0` — packed ochre hardpan, faint beveled clay plates. `tile-1` — a trodden path, dust compacted, +10 value.
- `tile-2` — pebble scatter and pale straw wisps over hardpan (**straw, not green** — §4).
- `tile-3` — sun-cracked clay broken into smaller plates, joints widened to dark gaps.
- `rim` — a crumbling mesa lip: hardpan ground band, blocky sandstone teeth, a strata-banded wall falling to dark.

---

## 8. Acceptance checklist

A dimension kit ships when **all** of the following hold. Judge against the tunnel
(`v13_imagegen_material_variant_modules_60.png`) side by side, not in isolation.

**Projection**

- [ ] Every standing asset: verticals vertical, horizontals horizontal, top plane visible, **at most one
      side face** on the left. No asset shows two converging side faces.
- [ ] Cube test: front face ≈ 0.55·S, top plane ≈ 0.75·S, within ±10%.
- [ ] Floor tiles have **zero** baked perspective, isometric skew, or diamond lattice.
- [ ] Floor relief is bevel-only, ≤ 4 world px implied.

**Parity with the tunnel**

- [ ] Flat cel planes with hard edges everywhere. No photographic texture, airbrush, noise, or painterly
      blending survives anywhere in the kit.
- [ ] Every material boundary is a drawn line at the §1.6 weights.
- [ ] 4–6 colours plus ink per theme; accent hue on ≤ 8% of floor area.
- [ ] Light ground / dark structure / one accent. Floor is the lightest large field on screen.
- [ ] One NW key light. **Zero baked shadows, AO, gradients, vignettes, glow or bloom** in any asset.
- [ ] Placed beside the tunnel tileset, the two read as one game's environment art.

**Tiling**

- [ ] All four tiles are toroidally seamless individually.
- [ ] `normalizeTileFamily` run against `tile-0`; every variant abuts every other variant with no seam.
- [ ] Screenshot of a 9×10 tile field at 1:1 shows **no recognisable repeating mark**.
- [ ] `rim.png` is horizontally seamless (`normalizeRim` run); ground/void split is at exactly y=128;
      lip line is an unbroken 5–6px ink rule; top 72px survives a 2.6× vertical squash.

**Structure served**

- [ ] Four tiles in role order — bed / route / cover / scar — with `FLOOR_STYLES` unified to `[0]/[1]/[2]/[3]`.
- [ ] The three map zones are distinguishable at a glance from a static screenshot, by **material**, and
      the four variants sit within ±12 value of each other.
- [ ] No tile contains anything readable as an obstacle, hazard, pit, ledge, door, or circular marking.
- [ ] Nothing in a tile mimics the amber pit lip, the cyan spawn ring, a gate disc, or a tier glow.
- [ ] POI ids and index order unchanged; contact anchors match the existing `poiMeta` tables.
- [ ] Every POI reads as a solid blocker; no walk-through arches or gates.
- [ ] Decal role mix present: ≥ 3 `flat` non-accent, ≥ 3 `edge`, ≥ 2 `solid`, ≤ 2 `accent`.

**Readability**

- [ ] Floor greyscale mean 70–125, variation ≤ ±18, no black above 4px, no field above value 145.
- [ ] Every POI: height ≤ 1.45 × footprint width; widest 80% of mass in the bottom 45%; occluding column
      above the base ≤ 35% of width.
- [ ] `heightClass 3` POIs carry the baked canopy alpha ramp (100%→70% over the top 30%, base opaque).
- [ ] Frostfell contains no near-white field (gas-ring protection).
- [ ] **A 40-enemy fight screenshot at 1:1 on the new floor:** every enemy silhouette, every telegraph,
      the pit lip, and the spawn ring are all individually identifiable.
- [ ] The same screenshot with decal alpha at the T4 value: the floor is not noisy.

**Export hygiene** (bible rules)

- [ ] Tiles/rims: opaque, exactly 512×512 / 1024×256, no alpha.
- [ ] POIs/decals: transparent cutouts, all four alpha corners clear, **zero residual chroma pixels
      anywhere in the sprite** — not merely at the border.
- [ ] Correct chroma key per §4 (`verdant-ruins` = `#ff00ff`; everything else `#00ff00`).
- [ ] Contact sheet plus a manifest of dimensions and base spans accompanies each prop pack.

**Process** (per the standing `ddv2-big-visual-changes-contract`)

- [ ] Render-layer only — no mapgen, collision, camera, or netcode change.
- [ ] Every surface enumerated before the pass starts; playable after every merge.
- [ ] Orchestrator screenshot gate per dimension, before and after, at 1:1 and in a live fight.
- [ ] Full gen/typecheck/test green.

---

## 9. OWNER DECISIONS — **ALL CLOSED 2026-07-25. See §-1 for the rulings.**

> 9.1 → R1 (all five re-authored) · 9.2 → R2 (compression to 70–125, NOT inversion; §1.7's
> "near-black" premise was factually wrong) · 9.3 → R3 (shelf approved) · 9.4 → R4 (whole-kit,
> ashlands first) · 9.5 → R5 (fixed plum) · 9.6 → R6 (orchestrator sets from capture) ·
> 9.7 → R7 (**landmarks deleted entirely**, replaced by destructible props).
> The original text is retained below for provenance. Do not act on it directly.

### 9 (original text, superseded)

**9.1 — Does `wild-west` get re-authored?** It is a fifth fully-wired dimension pack in code
(`DIMENSIONS`, `DIMENSION_PROP_PACKS`, complete tile/POI/decal kit shipped, and the compatibility
fallback for any unknown dimension id). It is not in the four-theme list in `dimensions-design.json`.
Re-authoring costs one extra kit (~20 assets); skipping it leaves the fallback dimension looking like
the old game. **Recommendation: include it** — it is the fallback, so it is what a stale client shows.

**9.2 — Confirm the floor value inversion (§1.7).** Dimension floors go from near-black
(greyscale 15–25) to mid-value (70–125). This is the single largest mood change in the spec: ashlands
becomes a *lit ash-grey field* rather than a black one, frostfell becomes *blue-grey* rather than white.
The justification is that every entity in this game carries a uniform black outline, and black outlines
on a black floor do not read — plus it is what the tunnel (pale marble) and Super Animal Royale both do.
**Recommendation: yes**, but this is a taste call, not a technical one.

**9.3 — Confirm the arena boundary shelf (T2, §3.6).** The world would read as a finite plateau
floating in the theme's void, replacing today's hairline rail. Alternative: keep the hairline and accept
that the 2.5D read stops at the map edge. **Recommendation: do it** — it is ~40 lines, needs no new art,
and it is the cheapest large gain in the spec.

**9.4 — Sequencing: floors-first or whole-kits-at-once?** Floors-first is playable at every merge but
looks *worse* mid-way (cel-shaded floor under 45° isometric landmarks — the mismatch becomes more
obvious, not less). Whole-kit-per-dimension means one theme is finished and correct while three still
look old. **Recommendation: whole-kit-per-dimension**, shipping one complete theme at a time.

**9.5 — Gas veil colour (§6.5): one fixed neutral (`#2A2233`) in every dimension, or per-theme?**
**Recommendation: fixed** — the gas is a life-threatening signal and must be learned once, not
re-learned four times.

**9.6 — Decal alpha values (T4).** Spec proposes raising `flat` from 0.065 to ~0.18–0.25 so ink-outlined
decals are visible at all. The exact number, and whether the scatter density budget drops to compensate,
should be a screenshot decision at a 40-enemy fight rather than a number chosen here.

**9.7 — POI height cap tightening.** `1.45 × footprint` reduces XL landmarks from ~380 to ~320 world px.
That is the "landmark you navigate BY" getting ~15% shorter. Confirm the trade of a slightly less
imposing skyline for guaranteed viewport headroom.
