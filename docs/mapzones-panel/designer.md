# Natural Map Zones — senior level-design specification

> **Decision:** every seeded arena generates **3–5 macro-regions**, including one neutral central Commons and 2–4 organic outer regions. The outer regions are not cosmetic biomes: terrain, cover, enemy composition, pressure, elite incidence, and reward quality all change together. A player should be able to say “do not hold the northwest mine scar” or “kite the knight out of the reliquary” after one pass through a seed.

This proposal uses only the installed painted tiles, POIs, decals, particle packs, component FX, and procedural Phaser geometry. Those libraries are already registered by the floor renderer, particle manifest, and component composer (`packages/client/src/scenes/arena/floor-renderer.ts:38-81`, `packages/client/src/vfx/particle-manifest.ts:1-10`, `packages/client/src/vfx/fx-composer.ts:17-46`). It calls for no new image renders.

## 1. What is wrong now

The arena is large enough to support meaningful geography: it is 4,800 × 4,800 px, divided into 80 px cells, so generation operates on a 60 × 60 grid (`packages/shared/src/constants.ts:154-167`). But the generated data is only a binary ground/pit grid plus a flat POI list; it has no macro-region or local identity layer (`packages/shared/src/mapgen.ts:38-65`).

The existing ingredients are individually strong but globally uniform:

| Current system | Consequence for level feel |
|---|---|
| Pit sites are rejection-sampled across the whole interior, then grown into jittered radius-2–3 blobs and smoothed twice (`packages/shared/src/mapgen.ts:78-145`, `packages/shared/src/mapgen.ts:429-437`). | Pits look organic locally, but no part of the map owns a memorable concentration or shape language. |
| Pit coverage targets 13% and is hard-capped at 22% (`packages/shared/src/constants.ts:172-180`). | The global playability budget is sensible and should be retained; it simply needs spatial allocation. |
| A center spawn disc and border ring are forced to ground, then connectivity is repaired so all ground is reachable by walking or hopping (`packages/shared/src/mapgen.ts:171-189`, `packages/shared/src/mapgen.ts:302-329`). | There is already a robust neutrality/safety foundation for the center and perimeter. |
| The generator targets 28 POIs, rejects pits and the spawn area, checks each collision footprint plus clearance, and maintains a radius-aware walking gap (`packages/shared/src/constants.ts:190-212`, `packages/shared/src/mapgen.ts:356-418`). | Landmarks are fair cover, but their even whole-map distribution prevents a ruin, sparse field, or dense landmark quarter from emerging. |
| The renderer picks uniformly from four painted ground variants across 512 px chunks and scatters dust/decal attempts uniformly across the entire arena (`packages/client/src/scenes/arena/floor-renderer.ts:97-184`, `packages/client/src/scenes/arena/floor-renderer.ts:374-447`). | Art changes by dimension, not by place within a dimension. |
| POI visuals derive their scale from the same radius used for collision, and projectile collision treats POIs as real cover (`packages/client/src/scenes/arena/floor-renderer.ts:195-258`, `packages/shared/src/mapgen.ts:470-485`). | This is the correct WYSIWYG foundation; zone dressing must preserve it. |
| A dimension currently owns one roster, one boss, one hazard description, one palette, and one tile/POI/decal asset set (`packages/shared/src/dimensions.ts:27-41`). | The registry has the right ownership boundary, but it lacks a deck of local zone recipes. |
| Normal arena spawns use the active dimension roster, choose a random living player, choose a random angle on a 720 px ring, and nudge the result off pits and POIs (`packages/server/src/rooms/GameRoom.ts:4074-4131`, `packages/shared/src/constants.ts:251-263`). | Pressure follows the squad correctly, but geography has no say in what arrives or how hard a location presses. |
| Tough chance is a single global function of elapsed time, living-player count, and chain depth; swarm enemies are excluded from becoming tough (`packages/shared/src/enemies.ts:681-691`, `packages/server/src/rooms/GameRoom.ts:4097-4110`). | There is escalation, but no “elite country.” |
| Non-boss enemies die with no XP when they end a tick over a pit, while the boss is pit-immune (`packages/server/src/rooms/GameRoom.ts:2119-2131`). | A pit-heavy zone can accidentally become safer than open ground unless its roster and rewards are designed around terrain-kill kiting. |
| Trash and tough mystery-drop rates are 1.2% and 5.5%; tough kills also receive +2 effective LUK on the rarity roll, while bosses receive +8 and a guaranteed drop (`packages/shared/src/constants.ts:420-438`, `packages/server/src/rooms/GameRoom.ts:3139-3178`). | The existing economy already has clean levers for a local risk premium. |

The target is therefore not “more random clusters.” It is a deterministic **macro-composition pass** that makes the existing systems agree about place.

## 2. Player-facing rules

1. **Geography first.** A region is a navigable territory roughly one to two screens across, not a decal patch. Its center, border, silhouette, enemy mix, and reward profile tell the same story.
2. **Three reads at three distances.** From far away: ground texture bias and negative-space density. At one screen: transition band and sentinel silhouettes. Underfoot: exact pit/hazard telegraph.
3. **Bias, never hard exclusion.** A region makes preferred enemies common, not exclusive. The dimension still feels like one ecosystem and co-op players do not need a bestiary key to understand a border.
4. **Danger is optional and lucrative.** The central Commons is never the best farming location. A danger region is visibly more hostile and pays a measurable but sub-boss reward premium.
5. **The center belongs to the squad.** Joining, rift descent, reorientation, and early co-op regrouping happen in neutral terrain. No elite nest, damaging hazard, large POI, or region-specific burst may overlap it.
6. **The border is not the hazard.** A transition band says “the rules are changing.” The exact hot rim, pool, slick, vent, or grid footprint says “this cell can hurt or move you.”
7. **What looks solid is solid.** Tall sentinel structures participate in POI collision. Non-colliding border marks must be visibly flat decals, dust, cracks, roots, paint, or light traces. This extends the audit’s “visual and authoritative positions must agree” doctrine to terrain (`docs/GAMEFEEL_AUDIT.md:94-99`).

## 3. Region vocabulary and baseline tuning

Every dimension supplies a five-card deck. **Commons is mandatory**; the seed deals 2–4 of the four outer cards. The result is 3, 4, or 5 total regions. When only two outer cards are dealt, one must be a danger card and the other must contrast it spatially: Open or Ruin. When all four are dealt, all roles appear.

The four existing painted tile variants should first receive per-dimension semantic tags after a visual audit (`packages/client/src/scenes/arena/floor-renderer.ts:117-128`):

- **C — clean:** lowest visual damage/noise.
- **W — worn:** ordinary traversal texture.
- **B — broken:** debris, cracks, or disrupted pattern.
- **H — hazard-adjacent:** strongest thematic distress or energy.

These are mappings to existing `tile-0`…`tile-3` images, not new art. The renderer currently constructs exactly four keys and chooses among them uniformly (`packages/client/src/scenes/arena/floor-renderer.ts:117-135`). The tag-to-index mapping belongs in dimension zone data because the semantic order may differ by painted set.

| Abstract role | Danger | Tile weights C/W/B/H | POI allocation weight | Decal/dust density | Expected spawn count per due director event | Tough rule | Mystery-drop multiplier / rarity bonus |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Commons** | 0 | 55/30/12/3 | 0.40× | 0.55× | 0.75 | `base × 0.65` | 1.00× / +0 LUK |
| **Open killing field** | 1 | 42/38/15/5 | 0.25× | 0.45× | 1.00 | `base` | 1.15× / +0 LUK |
| **Landmark ruin** | 2 | 10/22/46/22 | 2.00× | 1.55× | 1.10 | `base × 1.20 + .02` | 1.30× / +1 LUK |
| **Pit scar** | 2 | 8/18/34/40 | 0.60× | 0.80× | 0.95 | `base × 1.30 + .04` | 1.45× / +1 LUK |
| **Hazard/elite nest** | 3 | 5/12/28/55 | 1.10× | 1.35× | 1.25 | `base × 1.50 + .10` | 1.75× / +2 LUK |

“Expected spawn count” uses stochastic rounding: 0.75 skips one event in four; 1.10 has a 10% chance to produce a second body; 1.25 has a 25% chance. Every body still consumes the existing global cap, currently 80 (`packages/shared/src/constants.ts:260-263`). The result changes local pressure without inventing a second global difficulty curve.

The proposed tough formula is clamped to the current 0.80 ceiling, and swarms remain ineligible (`packages/shared/src/enemies.ts:681-691`, `packages/server/src/rooms/GameRoom.ts:4101-4104`). A nest therefore has an early identity even when the time-based tough chance is still near zero, but it cannot exceed the existing global maximum. Tough HP, damage, scale, and XP multipliers already make that flag an effective elite language (`packages/shared/src/constants.ts:364-380`).

### Spawn preferences by abstract role

Multipliers apply to the enemy kind’s existing roster weight. A zero-weight kind remains zero, so bosses and non-roster invaders can never leak into ordinary zone selection. The current picker already sums existing weights within the supplied dimension roster (`packages/shared/src/enemies.ts:536-548`).

| Role | Kind-weight multipliers | Design intent |
|---|---|---|
| Commons | filler rusher/swarm 1.15×; specials 0.65×; zoner 0.75× | Readable regrouping pressure, not a sanctuary that turns the run off. |
| Open | spitter/ranger 1.80×; swarm 1.20×; duelist/leaper 0.70×; zoner 0.80× | Long sightlines become the threat. Sparse cover is meaningful. |
| Ruin | duelist/leaper/rusher 1.55×; zoner 1.25×; spitter/ranger 0.80×; swarm 0.90× | Corners, cover, and close-range tells matter. |
| Scar | spitter/ranger/zoner 1.45×; duelist/leaper 1.10×; rusher 0.65×; swarm 0.50× | Fewer enemies mindlessly donate themselves to pits; threats work across broken lanes. |
| Nest | dimension-signature specials 2.00×; zoner/duelist/leaper 1.60×; filler 0.65× | The place produces named trouble, not merely more trash. |

At least 20% of normal events should ignore the region multiplier and use base dimension weights. That “ecology bleed” prevents a hard border from feeling like an encounter-room switch.

## 4. Seeded generation specification

### 4.1 Shared data contract

Extend the generated map conceptually with:

```ts
type ArenaRegion = {
  id: number;
  archetype: "commons" | "open" | "ruin" | "scar" | "nest";
  siteCol: number;
  siteRow: number;
  centroidX: number;
  centroidY: number;
  danger: 0 | 1 | 2 | 3;
  nestX?: number;
  nestY?: number;
};

type ArenaMapZones = {
  regionOf: Uint8Array;       // one id per 80 px map cell
  transition: Uint8Array;     // 0 interior, 1 outer band, 2 boundary spine
  regions: ArenaRegion[];
};
```

Extend `DimensionDef` with a `zoneProfile` containing the five-card deck, semantic tile mapping, prop tags, enemy multipliers, hazard recipe, and transition vocabulary. Both server and client should call `generateArena(seeds, dimension.zoneProfile)`.

**Inference:** no new Colyseus field is required for static region geometry. The four map seeds and `dimensionId` are already synchronized (`packages/shared/src/state.ts:266-285`); both server and client already rebuild the map locally from those seeds (`packages/server/src/rooms/GameRoom.ts:4346-4362`, `packages/client/src/scenes/ArenaScene.ts:2350-2363`). A zone profile selected from the same shared dimension registry therefore produces the same region grid on both sides. Timed hazard phases are different and must remain authoritative; see §7.

Keep the generator’s streams independent. Region layout should use a new stream mixed from terrain and theme, while local dressing should use separate stateless channels mixed from theme/decor. The current pit and POI passes already isolate their RNG streams so tuning one does not reshuffle the other (`packages/shared/src/mapgen.ts:429-443`). Region work should preserve that property.

### 4.2 Site deal: 3–5 regions

1. Choose total count from a weighted deterministic roll: **3 = 20%, 4 = 55%, 5 = 25%**.
2. Place Commons site at the arena center. Force every cell within 5 tiles of the center to Commons; force the current 3-tile ground disc as before (`packages/shared/src/constants.ts:167-171`, `packages/shared/src/mapgen.ts:171-188`). The extra two tiles are identity buffer, not guaranteed empty ground.
3. Place the remaining sites in an annulus 12–25 tiles from center with at least 11 tiles between sites and at least 22° angular separation. Use rejection sampling with a fixed attempt budget, then fall back to evenly spaced angles plus seeded jitter.
4. Deal outer archetypes without replacement. Guarantee one of Scar/Nest and one of Open/Ruin.
5. Randomize compass placement. No archetype owns northwest, a corner, or a fixed relationship to the camera.

This creates a center that naturally belongs to the squad and outer territories that reach the arena edges. The forced border remains ground as it is today, but it visually inherits the nearest outer region rather than becoming a sixth theme (`packages/shared/src/mapgen.ts:171-189`).

### 4.3 Organic boundaries: warped Voronoi, then cleanup

Use a low-frequency, fixed-point displacement field over the 60 × 60 grid:

1. Hash a 6-tile lattice into signed 16-bit `warpX` and `warpY` values.
2. Bilinearly interpolate in integer fixed point; cap displacement at ±2.25 cells.
3. For each map cell, offset the sample by the warp and choose the site with the lowest weighted squared distance. Give outer sites a seeded size factor of 0.88–1.14 so territories do not look equal-area.
4. Run two boundary-only 8-neighbor majority passes. Never change the forced Commons core.
5. Flood-fill from each site. Reassign detached islands smaller than 18 cells to the adjacent region with the longest shared edge. If a larger detached component remains, connect it to its parent by reassigning the minimum-cost cell chain rather than allowing region confetti.
6. Reject and redeal if any outer region owns under 9% of the grid or over 43%. After three failures, merge the smallest into its longest-border neighbor.

Use squared integer distance and hash-per-cell channels, not variable-cadence random draws. The current POI code deliberately consumes its art roll before rejection to keep cadence stable (`packages/shared/src/mapgen.ts:376-384`); stateless cell hashing extends that determinism to region tuning.

### 4.4 Transition bands

Derive a boundary spine wherever a cardinal neighbor has a different region id. Dilate it by two cells on both sides to make a **160 px transition band**. Do not blend the two identities evenly:

- Outer band: 70% current-region dressing, 30% neighbor dressing.
- Inner band: 45% current, 45% neighbor, 10% neutral “connector” decals.
- Boundary spine: sparse sentinel marks every 5–8 cells, jittered parallel to the border.

The 512 px painted ground chunks should use the dominant region from a 3 × 3 sample and that region’s semantic tile weights. The transition band then hides coarse chunk changes with procedural tint/stipple, existing flat decals from both sides, and low-rate particles. This works with the current renderer’s 512 px painted images without requiring a new blended tile sheet (`packages/client/src/scenes/arena/floor-renderer.ts:38-39`, `packages/client/src/scenes/arena/floor-renderer.ts:117-138`).

Sentinels follow two rules:

- Flat marks are non-colliding decals.
- Any upright/tall sentinel is placed through the normal POI path and uses the same collision radius/visual scale contract as every other landmark (`packages/shared/src/mapgen.ts:331-349`, `packages/client/src/scenes/arena/floor-renderer.ts:226-256`).

No continuous fence is allowed. Maintain at least a 320 px open crossing every 720 px of border length and never place two tall sentinels opposite each other across a crossing.

### 4.5 Region-aware pits

Keep the existing organic blob growth, smoothing, 13% global target, 22% ceiling, forced center/border ground, and final connectivity repair (`packages/shared/src/mapgen.ts:104-169`, `packages/shared/src/mapgen.ts:421-440`). Change only **where the pit budget is spent**:

| Role | Relative pit-site budget | Site spacing | Blob tendency |
|---|---:|---:|---|
| Commons | 0.25× | 10 cells | small edge incursions only; none inside forced core |
| Open | 0.35× | 10 cells | isolated, readable holes |
| Ruin | 0.75× | 7 cells | pits avoid the densest POI court |
| Scar | 2.25× | 4–6 cells | elongated ridge field; adjacent blobs may join into a named scar |
| Nest | 1.55× | 5–7 cells | broken perimeter around a broad, solid nest heart |

Normalize these weights back to the global target; Scar does not add pits to the whole map, it takes budget from Commons and Open.

For Scar, generate one seeded quadratic spine between two boundary points in the region. Candidate sites score higher within 2–5 cells of that spine, producing a directional wound rather than uniform Swiss cheese. Preserve at least two 3-cell-wide ground crossings through the scar and one 4-cell-wide connector back toward Commons.

The nest heart is a 5-cell-radius ground pocket. Its elite anchor, arrival telegraph, and reward fight happen on this solid platform, while its dangerous perimeter creates commitment. This avoids spawning prized enemies where they immediately fall. Terrain kills remain rewardless, as they are now (`packages/server/src/rooms/GameRoom.ts:2119-2131`).

Run the existing reachability repair after all pit shaping. Add validation that every region owns at least one ground route to Commons and that every required crossing is wider than a single-player body lane. The current reachability model already treats straight gaps of at most two pit cells as hoppable (`packages/shared/src/constants.ts:181-187`, `packages/shared/src/mapgen.ts:191-232`).

### 4.6 Region-aware POIs and decor

Preserve the current global POI target and size-class cycle; normalize allocation weights across regions rather than multiplying the total. The size-class cycle guarantees a consistent S/M/L/XL mix, including one XL per seven accepted landmarks (`packages/shared/src/mapgen.ts:331-354`).

Placement order:

1. Reserve Commons core, required border crossings, nest heart, and hazard telegraph lanes.
2. Place two or three border sentinels from the global POI budget.
3. Allocate remaining POI attempts by region weight.
4. Run the existing solid-ground footprint, spawn-clearance, collision-clearance, and pairwise-gap checks unchanged (`packages/shared/src/mapgen.ts:356-418`).
5. Scatter decals and dust by region density, but draw every random/hash decision before checking pits or texture availability so clients remain visually deterministic. The current renderer already follows this fixed-cadence pattern for decor (`packages/client/src/scenes/arena/floor-renderer.ts:382-415`).

The current renderer only tags POIs as squat or tall by aspect ratio (`packages/client/src/scenes/arena/floor-renderer.ts:217-236`). Add hand-authored semantic tags to the existing manifest members—such as `monument`, `cover`, `debris`, `sentinel`, `organic`, `industrial`, and `ground-mark`—after a one-time visual audit. A zone recipe chooses among tags; it does not assume that opaque manifest index 03 means the same thing across dimensions. Existing packs already vary by dimension through separate POI/decal registries (`packages/client/src/scenes/arena/floor-renderer.ts:47-85`).

## 5. Spawn director, co-op flow, and elite nests

### 5.1 Ordinary events stay player-anchored

Do not turn regions into distant monster closets. The existing director’s core behavior—pressure around a living player at a 720 px ring—keeps a 4,800 px map playable and supports a split squad (`packages/server/src/rooms/GameRoom.ts:4074-4129`, `packages/shared/src/constants.ts:251-258`). Refactor one due event as follows:

1. Choose a living anchor from a shuffle bag. In co-op, every living player receives one event before any receives a second; reshuffle after the bag empties.
2. Read the anchor’s region. This is the **encounter region** for density, kind bias, tough chance, and reward provenance.
3. Generate 12 candidate angles around the same 720 px ring. Nudge each with `safeSpawnPos`.
4. Prefer candidates still inside the encounter region, outside the Commons core, and at least 120 px from a transition spine. Fall back to the highest-scoring safe candidate rather than canceling the event.
5. Stochastically round the region’s expected body count; stop at the global cap.
6. For each body, use base roster weights 20% of the time and region-adjusted weights 80% of the time.

This keeps the director neutral about **which player** deserves pressure while allowing the chosen player’s current geography to matter. It also prevents a player in the northeast from causing an offscreen fixed nest in the southwest to fill the entity cap.

### 5.2 Server-private encounter provenance

Record `enemyId -> encounterRegionId` in a server-only map when an ordinary enemy is created. Reward uses the origin region, not the death position. Otherwise players would drag a nearly dead enemy two steps over a danger border to upgrade the roll.

Clean the entry on every removal path, including ordinary death, terrain fall, transition clear, boss cleanup, and reset. Terrain falls currently delete enemies directly rather than routing through the reward-bearing death function (`packages/server/src/rooms/GameRoom.ts:2119-2131`), so that path needs explicit provenance cleanup.

Bosses, shifters, boss adds, debug summons, belt waves, and training dummies receive no ordinary region provenance. Their existing reward and encounter rules remain authoritative.

### 5.3 Elite nest event

Each dealt Nest has one deterministic ground anchor. It activates only while:

- at least one living player is in the Nest;
- the squad has accumulated 3 seconds in the region;
- no boss is alive and no extraction/rift decision is open;
- the nest cooldown, seeded to 38–52 seconds, has elapsed;
- enough global enemy-cap room exists for at least three bodies.

Activation sequence:

1. A 1.15-second authoritative summon marker appears at the nest heart.
2. Spawn one guaranteed non-swarm tough signature enemy plus 2–4 biased support enemies, scaled down if the cap is tight.
3. Mark only the guaranteed elite with a nest reward flag; do not multiply the entire support pack twice.
4. Reset cooldown only after the telegraph resolves, so leaving during the tell cancels without burning the event.

The existing generic telegraph schema already supports fixed world circles, rings, cones, rectangles, fill progress, and a cosmetic kind tag, and it is read as authoritative state rather than inferred from an interpolated body (`packages/shared/src/state.ts:171-205`). A summon marker can therefore reuse that geometry language without creating a client-guessed countdown.

Use one restrained existing component pack for the completion beat—Quake for Wild West, Frost Nova, Toxic Burst, Ember Eruption, or Storm/Lightning according to dimension. The composer already exposes those packs and accepts a gameplay radius for stable visual sizing (`packages/client/src/vfx/fx-composer.ts:17-46`, `packages/client/src/vfx/fx-composer.ts:176-215`). The tell itself remains procedural and readable even if optional painted FX fail to load; the composer already falls back cleanly when textures are absent (`packages/client/src/vfx/fx-composer.ts:149-174`, `packages/client/src/vfx/fx-composer.ts:238-255`).

### 5.4 Boss arrival is region-neutral

Do not change the boss clock, boss kind selection, anchor selection, ring distance, or safe-ground landing. The current survival loop summons the dimension boss at the depth-scaled time and continues the ordinary horde until the boss falls (`packages/server/src/rooms/GameRoom.ts:1845-1864`). The boss itself uses the dimension’s boss id, a random living-player anchor, the same ring concept, and `safeSpawnPos` (`packages/server/src/rooms/GameRoom.ts:4200-4259`).

At boss arrival:

- cancel any unresolved nest summon;
- suspend new nest events;
- continue ordinary region-biased horde events exactly where players are fighting;
- ignore region tough/reward modifiers for the boss and boss adds;
- never pull the squad back to Commons or flatten local terrain;
- retain boss immunity to pit/POI trapping. Bosses are already excluded from normal POI resolution and pit death (`packages/server/src/rooms/GameRoom.ts:2090-2116`, `packages/server/src/rooms/GameRoom.ts:2119-2129`).

The result is a boss that can invade the place the squad chose to hold, without a lucky danger region upgrading its guaranteed boss payout.

## 6. Risk and reward

### 6.1 Reward rule

For ordinary provenance-bearing enemies only:

```text
effective mystery chance = existing trash/tough chance × region.dropMultiplier
effective rarity LUK     = best squad LUK + existing tough bonus + region.rarityBonus
```

Clamp mystery chance below the boss guarantee. The Nest elite may receive a separate minimum mystery chance of 18%, but it should not be guaranteed. Its +2 region rarity bonus stacks with the current tough +2, still well below the boss’s +8 rarity bonus (`packages/shared/src/constants.ts:425-438`).

Apply the region rarity bonus to a wielded-weapon drop if that drop succeeds, but do **not** increase its signature drop chance. Wielded drops currently roll their own kind-specific chance and then use squad LUK for rarity (`packages/server/src/rooms/GameRoom.ts:3715-3734`). This preserves weapon identity rarity while preventing a nest from exploding into duplicate drop channels.

Keep all existing anti-farm boundaries:

- Ordinary mystery loot remains suppressed while the boss is alive (`packages/server/src/rooms/GameRoom.ts:3165-3175`).
- Training produces no wielded loot (`packages/server/src/rooms/GameRoom.ts:3715-3718`).
- Terrain kills produce no XP or loot (`packages/server/src/rooms/GameRoom.ts:2119-2131`).
- Bosses keep their guaranteed boss-tier reward and portal wage (`packages/server/src/rooms/GameRoom.ts:3139-3156`, `packages/server/src/rooms/GameRoom.ts:4365-4394`).

### 6.2 What the player should feel

- Commons: “We can reset formation here, but staying is slow money.”
- Open: “The sightline is dangerous, yet the route is clean.”
- Ruin: “Cover helps until a duelist comes around it.”
- Scar: “The ground can delete the horde, but the shooters own the lanes and terrain kills pay nothing.”
- Nest: “We can leave; if we commit, the elite and its better roll are visibly earned.”

Do not add a passive HUD percentage for reward quality. The reward contract should be learned through danger rank, elite frequency, and the region’s visuals. A small region-name toast on first entry per map is acceptable for callouts, but it must not obscure combat.

## 7. Hazard truth and visual legibility

The dimension registry currently describes environmental hazards as theme data and explicitly notes that wiring comes later (`packages/shared/src/dimensions.ts:33-38`). Regions can ship before all five bespoke hazard simulations, but they must never show an active damaging floor that the server does not enforce.

### 7.1 Launch-safe layering

**Layer A — always shippable:** tile bias, pit allocation, prop density, spawn mix, tough incidence, nest summon, and reward provenance. These already make a hazard nest dangerous without pretending a decorative decal deals damage.

**Layer B — only when authoritative:** black-ice movement, toxin pools, vents, and live-grid pulses. The exact deterministic hazard mask would be shared in `ArenaMap`; the server would own effects and phase changes. Static hazards may be derived entirely from the map. Timed hazards must announce each active footprint through authoritative telegraph/state rather than a client clock.

### 7.2 WYSIWYG rules

1. A damaging footprint and its hot visual use the same cells or exact radius.
2. Telegraph starts at least 0.75 seconds before a timed cell activates; removal/impact occurs on the server event.
3. Transition dust never uses the dimension’s reserved hot pit-lip color. Dimension palettes deliberately distinguish hot hazard rims from the cool spawn ring (`packages/shared/src/dimensions.ts:12-24`).
4. Ambient particles are sparse, slow, low-alpha, and non-additive where possible. They describe air, not a hitbox.
5. Combat-grade full FX fires only on nest activation or a real hazard pulse, never as continuous region wallpaper.
6. POI cover remains honest: the visual base width continues to match collision, and cover continues to block projectiles (`packages/client/src/scenes/arena/floor-renderer.ts:199-256`, `packages/shared/src/mapgen.ts:482-485`).

The installed particle registry already provides sand, frost, nature, toxic, fire, shock, arcane, void, water, holy, blood, and steel families (`packages/client/src/vfx/particle-manifest.ts:9-105`). Use at most one ambient family per region plus one secondary family at the Nest; do not turn the whole floor into weapon VFX.

## 8. Per-dimension five-card decks

The seed always deals Commons plus 2–4 outer cards from the relevant deck. Names are player-facing callout candidates. Prop descriptions below are **semantic curation targets for existing pack members**, not requests for new assets.

### 8.1 Wild West

Wild West’s registered roster is critter, mote-swarm, pricklepulp, boothill, ronin, gatlin, vault-ronin, and dust-ranger; its environmental hazard is pitfall mineshafts (`packages/shared/src/dimensions.ts:43-73`). Its current landmark vocabulary explicitly includes derrick, windmill, dead tree, adobe ruin, water tower, and rock spire, while its decal comments identify rocks, scrub, bones, skull, cactus, and wheel (`packages/shared/src/constants.ts:189-197`, `packages/client/src/scenes/arena/floor-renderer.ts:398-400`).

| Region | Visual identity | Gameplay identity | Risk/reward | Border read |
|---|---|---|---|---|
| **Drifter’s Trailhead — Commons** | Clean/worn hardpan; 0.40× POIs; low scrub, wheel tracks, and small rocks; one distant XL navigation landmark outside the core. | Base roster with filler bias; suppress ronin, gatlin, vault-ronin, and dust-ranger to Commons rate. Those special threats are low-weight roster members in current data (`packages/shared/src/enemies.ts:372-469`). | Rank 0. Formation reset, lowest pressure and base loot. | Loose dust fades into hardpan; paired flat wheel-track decals point toward outer crossings. |
| **Longshot Flats — Open** | Clean/worn tile bias; 0.25× POIs; water tower or windmill silhouettes at the far edge, almost no mid-field cover; sand wisps. | Prefer boothill, dust-ranger, gatlin, then mote-swarm. These supply single-shot kiting, evasive ranged pressure, spread volleys, and fast filler (`packages/shared/src/enemies.ts:156-192`, `packages/shared/src/enemies.ts:400-420`, `packages/shared/src/enemies.ts:450-469`). | Rank 1. Clean footing but exposed sightlines; 1.15× mystery chance. | A broad pale dust band with sparse posts/flat wheel marks; players see the loss of cover before the first volley. |
| **Ruin Crossing — Ruin** | Broken tile bias; 2.00× POIs; adobe/derrick/dead-tree cover courts; bones, wheels, and rubble clustered at structure bases. | Prefer ronin, vault-ronin, critter, and pricklepulp; reduce long-range specialists. Ronin and vault-ronin are close/leap combo threats, while pricklepulp supplies area denial (`packages/shared/src/enemies.ts:166-174`, `packages/shared/src/enemies.ts:372-398`, `packages/shared/src/enemies.ts:423-448`). | Rank 2. Cover breaks firing lanes but hides close threats; 1.30× drops and +1 rarity LUK. | Two or three colliding tall sentinels staggered along a rubble-and-shadow band, with 320 px open breaches. |
| **Broken Claim — Scar** | Hazard/broken tile bias; 2.25× pit budget along one collapsed-shaft spine; rock spires and small claim debris, not dense buildings. | Prefer boothill, dust-ranger, pricklepulp, and vault-ronin; cut critter/mote weights so the region is not a free pit grinder (`packages/shared/src/enemies.ts:146-192`, `packages/shared/src/enemies.ts:423-469`). | Rank 2. Pits offer crowd control but no terrain-kill payout; ranged lanes and +1 rarity make committed kills worthwhile. | Rust dust thickens for 160 px, then repeated flat crack/track sentinels align with the scar. The actual hot lip remains the exact pit edge. |
| **Rattler Mine — Nest** | Hazard tile majority; solid claim platform inside a broken pit perimeter; 1.10× POIs concentrated as a visible industrial/skeletal nest crown. | Guaranteed elite preference: gatlin, ronin, or vault-ronin, supported by pricklepulp and boothill (`packages/shared/src/enemies.ts:166-192`, `packages/shared/src/enemies.ts:372-448`). | Rank 3. Highest local pressure; nest elite gets the 1.75×/+2 region reward rule. | Quake-like dust tell at the heart; border uses low sand wisps and converging wheel tracks, never a fake damaging ring. |

### 8.2 Frostfell

Frostfell’s roster is frostbitten-revenant, shriek-wraith, hoarfrost-bloom, rimebound-archer, and frozen-knight; its hazard is black-ice slicks telegraphed by pale low fog (`packages/shared/src/dimensions.generated.ts:11-42`).

| Region | Visual identity | Gameplay identity | Risk/reward | Border read |
|---|---|---|---|---|
| **Thaw Camp — Commons** | Clean slate/ice tile bias; sparse low debris; 0.40× POIs; frost motes only at the perimeter. | Filler revenant/wraith bias; knight and bloom suppressed. Roster roles and weights are defined in the generated enemy data (`packages/shared/src/dimensions.generated.ts:146-215`). | Rank 0. Stable footing and regrouping space. | Thin thaw-water stipple and flat broken-ice fragments; no pale fog over safe ground. |
| **Whiteout Transept — Open** | Clean/worn tile bias; long empty nave-like sightlines; tiny frost-shard drifts, almost no upright cover. | Prefer rimebound-archer and shriek-wraith; revenants provide interception. Archer range and preferred range make the open identity mechanically real (`packages/shared/src/dimensions.generated.ts:156-191`). | Rank 1. Low terrain risk, high projectile exposure; 1.15× mystery chance. | Wind-combed snow band; paired flat shard fans point inward. |
| **Shattered Nave — Ruin** | Broken tile majority; 2.00× cathedral/column/reliquary-tagged POIs; dense fractured floor decals near cover bases. | Prefer frozen-knight, frostbitten-revenant, and hoarfrost-bloom; reduce archer. Knight is the roster’s weighted duelist and bloom its zoner (`packages/shared/src/dimensions.generated.ts:146-175`, `packages/shared/src/dimensions.generated.ts:193-215`). | Rank 2. Close threats and denial pockets among cover; 1.30×/+1. | Colliding column/reliquary sentinels alternate with wide snow-filled breaches. |
| **Hollow Chasm — Scar** | Hazard/broken ice; pit spine reads as a frozen collapse; sparse tall ice/stone silhouettes, stronger frost wisps along the safe rim. | Prefer archer and bloom, then knight; cut wraith weight to avoid free pit deletion (`packages/shared/src/dimensions.generated.ts:156-215`). | Rank 2. Broken crossings under ranged/zone pressure; terrain kills do not pay; 1.45×/+1. | Opaque frost dust before the chasm, exact cyan-white hot lip only on real pit cells. |
| **Black-Ice Reliquary — Nest** | Hazard tile majority around a solid reliquary heart; low pale fog is reserved for exact slick cells; 1.10× monumental POIs. | Elite frozen-knight or hoarfrost-bloom with archer support (`packages/shared/src/dimensions.generated.ts:166-215`). Once black ice is authoritative, momentum danger occupies paths around—not under—the summon heart, matching the registered hazard concept (`packages/shared/src/dimensions.generated.ts:23-26`). | Rank 3. Positional commitment plus elite pressure; 1.75×/+2. | Frost-ring summon tell; low fog begins at exact slick boundary, while the broader transition uses only dry frost grains. |

### 8.3 Verdant Ruins

Verdant Ruins’ roster is vine-lasher, venom-spore, fungal-bloomer, blowdart-sentinel, and thornblade-warden; its hazard is a toxin-spore pool that damages/slows while occupied (`packages/shared/src/dimensions.generated.ts:44-75`).

| Region | Visual identity | Gameplay identity | Risk/reward | Border read |
|---|---|---|---|---|
| **Waystone Glade — Commons** | Clean/worn flagstone; 0.40× low ruins; open grass/moss negative space; restrained nature motes. | Vine-lasher and venom-spore filler bias; warden and bloomer suppressed. Their roster roles are defined in generated data (`packages/shared/src/dimensions.generated.ts:237-306`). | Rank 0. Readable regrouping lawn, base reward. | Moss density rises gradually; flat root lines point to safe crossings. |
| **Sunken Court — Open** | Worn flagstone with broad clear courts; 0.25× POIs; scattered leaves and low moss, few vertical blockers. | Prefer blowdart-sentinel and venom-spore, then vine-lasher. Blowdart range turns the court into a firing field (`packages/shared/src/dimensions.generated.ts:247-282`). | Rank 1. Easy travel, exposed to darts and flanks; 1.15×. | A leaf-and-pollen windrow, with toppled flat stones as sentinels. |
| **Rootbound Cloister — Ruin** | Broken tile majority; 2.00× temple/monument/column-tagged POIs; roots and masonry decals cluster into alternating courts. | Prefer thornblade-warden, vine-lasher, and fungal-bloomer; reduce sentinel. Warden is the duel threat and bloomer the slow zoner (`packages/shared/src/dimensions.generated.ts:237-265`, `packages/shared/src/dimensions.generated.ts:284-306`). | Rank 2. Close ambush plus denial in cover; 1.30×/+1. | Colliding stone sentinels tied together visually by flat root bands, never by invisible walls. |
| **Rootbreak Sink — Scar** | Hazard/broken flagstone; pits follow a ruptured root-and-sump spine; low debris, strong negative space. | Prefer blowdart-sentinel, fungal-bloomer, and thornblade-warden; halve venom-spore to limit pit donations (`packages/shared/src/dimensions.generated.ts:247-306`). | Rank 2. Broken movement under darts and pools; 1.45×/+1 for direct kills. | Dark wet-moss transition, then the exact pit/pool telegraph. Roots crossing the band are flat decals. |
| **Sporeheart — Nest** | Hazard tile majority; solid temple dais surrounded by authored toxin-pool pockets when their server logic exists; 1.10× organic/monumental POIs. | Elite thornblade-warden or fungal-bloomer with blowdart/lasher support (`packages/shared/src/dimensions.generated.ts:237-306`). The pool behavior follows the registered stacking-poison/slow concept only when authoritative (`packages/shared/src/dimensions.generated.ts:56-59`). | Rank 3. Area denial and elite commitment; 1.75×/+2. | Toxic-ring summon tell; nature motes transition to toxic wisps only at the exact hazard footprint. |

### 8.4 Ashlands

Ashlands’ roster is cinder-imp, ember-mote, slag-crawler, ember-spitter, and magma-duelist; its hazard is lava cracks and cyclic fire vents (`packages/shared/src/dimensions.generated.ts:77-108`).

| Region | Visual identity | Gameplay identity | Risk/reward | Border read |
|---|---|---|---|---|
| **Ashfall Shelf — Commons** | Clean/worn basalt; low soot drifts, 0.40× POIs, almost no active glow; sparse non-additive ash. | Cinder-imp and ember-mote filler bias; duelist/crawler suppressed. Generated roles and weights define this roster (`packages/shared/src/dimensions.generated.ts:332-401`). | Rank 0. Stable basalt and lowest pressure. | Soot accumulation and flat cooled-lava seams; no orange pulse on safe cells. |
| **Cinder Expanse — Open** | Worn basalt, broad empty lanes, 0.25× POIs; low ash streaks and a few distant vertical silhouettes. | Prefer ember-spitter and ember-mote, with cinder-imp interceptors (`packages/shared/src/dimensions.generated.ts:332-377`). | Rank 1. Long fire lanes, little cover; 1.15×. | Windblown ash band with flat shard fans aimed into the field. |
| **Furnace Graveyard — Ruin** | Broken tile majority; 2.00× furnace/column/wreck-tagged POIs; slag and cooled-flow decals mass at cover bases. | Prefer magma-duelist, slag-crawler, and cinder-imp; reduce spitter. Duelist and crawler create close/denial pressure (`packages/shared/src/dimensions.generated.ts:332-360`, `packages/shared/src/dimensions.generated.ts:379-401`). | Rank 2. Choked lanes and close threats; 1.30×/+1. | Upright colliding sentinels alternate with broad cooled-slag breaches. |
| **Magma Rift — Scar** | Hazard/broken tile bias; highest pit budget along a molten fracture; sparse cover so the lip remains legible. | Prefer ember-spitter, slag-crawler, and magma-duelist; reduce imp/mote weights to control free terrain kills (`packages/shared/src/dimensions.generated.ts:332-401`). | Rank 2. Few safe crossings under range/denial; 1.45×/+1. | Charred 160 px band; exact amber lip marks the real fall/burn footprint, consistent with the registered molten-rim language (`packages/shared/src/dimensions.generated.ts:89-101`). |
| **Vent Crown — Nest** | Hazard majority around a solid basalt crown; cyclic vents occupy an outer ring only when server-authoritative; 1.10× furnace/spire silhouettes. | Elite magma-duelist or slag-crawler with ember-spitter support (`packages/shared/src/dimensions.generated.ts:352-401`). | Rank 3. Timed perimeter plus elite center; 1.75×/+2. | Ember-eruption completion beat; each vent gets its own exact preflare, while the zone transition stays dark soot. |

### 8.5 Neon-Cyber

Neon-Cyber’s roster is synthrunner, dronemite, turret-node, laser-spire, and riot-enforcer; its hazard is a telegraphed live laser grid (`packages/shared/src/dimensions.generated.ts:110-141`).

| Region | Visual identity | Gameplay identity | Risk/reward | Border read |
|---|---|---|---|---|
| **Dead-Grid Hub — Commons** | Clean/worn pavement; 0.40× low tech debris; muted traces, no active arc-violet current; sparse steel motes. | Synthrunner and dronemite filler bias; riot-enforcer/turret suppressed. Generated data defines the roster’s roles and weights (`packages/shared/src/dimensions.generated.ts:423-492`). | Rank 0. Reliable regrouping pad and base loot. | Broken, unlit trace band; flat warning bars lead toward crossings. |
| **Killbox Plaza — Open** | Clean/worn geometric paving; 0.25× POIs; long orthogonal sightlines and very sparse low debris. | Prefer laser-spire, dronemite, and turret-node. Laser-spire’s ranged profile and turret-node’s zoner role make exposure the threat (`packages/shared/src/dimensions.generated.ts:433-468`). | Rank 1. Clear movement, punishing lines of fire; 1.15×. | Broad unlit scanline band with paired flat corner brackets. |
| **Server Stack — Ruin** | Broken circuit paving; 2.00× server/pylon/wreck-tagged POIs; cable and panel decals mass into cover aisles. | Prefer riot-enforcer, synthrunner, and turret-node; reduce laser-spire. Enforcer is the roster’s weighted duelist (`packages/shared/src/dimensions.generated.ts:423-451`, `packages/shared/src/dimensions.generated.ts:470-492`). | Rank 2. Close pursuit plus denial among hard cover; 1.30×/+1. | Colliding pylon sentinels with wide cable-marked breaches. Cable is visual only unless tied to a real obstacle. |
| **Gridbreak Trench — Scar** | Hazard/broken tiles; pits form a severed-circuit trench; low cover and concentrated fault decals. | Prefer laser-spire, turret-node, and riot-enforcer; reduce dronemite to limit pit feeding (`packages/shared/src/dimensions.generated.ts:433-492`). | Rank 2. Chasm crossings under range and zone control; 1.45×/+1. | Violet/cyan static is confined to exact dangerous edges; outer transition uses dark, unlit trace fragments. |
| **Overclock Node — Nest** | Hazard majority around a solid node platform; pulsing row/column cells live in the perimeter when authoritative; 1.10× pylon/monument silhouettes. | Elite riot-enforcer or turret-node with laser-spire/synthrunner support (`packages/shared/src/dimensions.generated.ts:423-492`). The hazard follows the registered telegraphed row/column cycle (`packages/shared/src/dimensions.generated.ts:122-135`). | Rank 3. Timed crossing windows plus elite burst; 1.75×/+2. | Storm/Lightning completion beat at the node; exact grid rows fill authoritatively, transition brackets remain inert. |

## 9. Validation and acceptance criteria

### Deterministic generation

Run at least 10,000 seeds per dimension and assert:

- same seeds + same dimension profile produce byte-identical `tiles`, `regionOf`, region metadata, POIs, nest anchors, and static hazard masks;
- region count is always 3–5;
- Commons owns the forced center core;
- every outer region owns 9–43% of map cells after cleanup;
- each region is one connected macro-component after island cleanup;
- pit fraction never exceeds the existing 22% ceiling (`packages/shared/src/constants.ts:172-180`);
- the existing `validateArena` postconditions still pass: ground spawn, solid border, and reachable ground (`packages/shared/src/mapgen.ts:643-661`);
- nest anchor is ground, outside every POI radius, at least 7 cells from map center, and connected to Commons;
- required region crossings meet width targets.

### Director simulation

Simulate 30-minute runs at 1–4 players and depths 1–5:

- no living player is skipped for more than one full anchor-bag cycle;
- every spawn begins on ground and outside POI collision, retaining the current `safeSpawnPos` contract (`packages/shared/src/mapgen.ts:564-591`);
- observed kind shares match region-adjusted weights within ±5 percentage points after 2,000 events;
- Commons produces 25% fewer bodies per due event than baseline in expectation; Nest produces 25% more, cap permitting;
- no region formula exceeds the current 0.80 tough cap (`packages/shared/src/enemies.ts:683-691`);
- nest pulses stop at boss arrival and never consume boss/add slots needed by the encounter;
- boss spawn time, boss kind, landing safety, reward, and portal flow are unchanged.

### Economy

- A direct kill in Rank 3 has approximately 1.5–1.8× the non-boss loot EV of the same direct kill in Commons, depending on rarity distribution.
- A terrain kill has zero reward regardless of region.
- Moving an enemy across a border never changes its reward provenance.
- Boss, shifter, boss-add, belt, training, and debug rewards are unchanged.
- Nest elite reward remains clearly below the guaranteed boss drop.

### Legibility playtest

On six unseen seeds per dimension:

- 80% of players can distinguish the current region from the previous one within three seconds of crossing, without a minimap.
- 80% can point toward at least one safe border crossing from one screen away.
- 90% correctly identify whether the cell under a timed hazard tell will become dangerous.
- In co-op, players spontaneously use at least one region name or visual callout per run.
- Fewer than 10% mistake a non-colliding sentinel for solid cover.

### Performance and fallback

- `regionAtPx` is a single clamped array lookup.
- Region generation is bounded to the 3,600-cell grid and occurs only when the arena is minted/rebuilt.
- Static zone data requires no per-tick network traffic.
- Missing optional particles, component FX, or painted textures falls back to procedural transition geometry and the existing palette; gameplay geometry remains unchanged. The current floor already has a painted-tile fallback to a themed grid (`packages/client/src/scenes/arena/floor-renderer.ts:156-184`).

## 10. Recommended implementation slices

1. **Shared region skeleton:** add dimension zone profiles, warped-Voronoi `regionOf`, cleanup, lookup helpers, and deterministic validation. Do not touch pits yet.
2. **Visual proof:** region-weight the four existing tiles and decor (`packages/client/src/scenes/arena/floor-renderer.ts:117-138`, `packages/client/src/scenes/arena/floor-renderer.ts:374-447`), add 160 px procedural transition bands, and tag existing prop manifests. Validate callouts at running speed.
3. **Terrain composition:** allocate the current pit and POI budgets by region while retaining force-ground, connectivity repair, safe placement, and WYSIWYG collision (`packages/shared/src/constants.ts:172-212`, `packages/shared/src/mapgen.ts:171-189`, `packages/shared/src/mapgen.ts:302-329`).
4. **Director and provenance:** region-biased candidate selection, anchor shuffle bag, kind/density/tough rules, server-private origin, and regional loot bonus.
5. **Elite nest:** deterministic heart, authoritative summon telegraph, cap-aware elite pack, boss suspension, and restrained existing FX.
6. **Dimension hazards:** implement static/timed hazard truth one dimension at a time. Never let decorative danger get ahead of server damage/movement logic.
7. **Tune from seed walls:** review 100-map contact sheets and 30-minute director simulations, then lock region-area, crossing, density, and reward bands before content expansion.

The decisive shift is organizational: pits, POIs, painted ground, enemies, and loot stop rolling independently across the whole square. They remain procedural, but each roll answers to a place the squad can see, name, avoid, exploit, and deliberately enter.
