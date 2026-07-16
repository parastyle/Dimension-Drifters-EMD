# Natural Map Zones — Devil's Advocate

## Panel verdict

**Approve only a minimum “terrain neighborhood” pass. Reject bespoke environmental-hazard zones, zone-directed spawning, and zone loot.**

The director is asking for spatial memory and causality: “top-left is dangerous because it is the shaft country,” not merely more objects on the floor. The smallest version that earns that sentence is to correlate the existing pits and POIs into a few broad, readable neighborhoods. It should leave the bullet-heaven director player-centered and make the player choose **where to receive the horde**. (`packages/shared/src/mapgen.ts:38-65`, `packages/server/src/rooms/GameRoom.ts:4074-4131`)

The decisive exchange is already in the game:

- A pit-heavy scar is dangerous to traverse, but it can erase pursuing non-boss enemies. Terrain kills grant no XP, so escaping there trades growth for survival rather than printing value. Grounded players instead lose 15% max HP and snap back; jumping clears the gap. (`packages/server/src/rooms/GameRoom.ts:1797-1843`, `packages/server/src/rooms/GameRoom.ts:2119-2131`, `packages/shared/src/constants.ts:331-332`)
- A POI-heavy ruin gives projectile cover, but the same landmarks block players, normal enemies, hostile shots, and the squad's own shots. That is cover versus mobility and firing lanes, not a free buff. (`packages/server/src/rooms/GameRoom.ts:1788-1795`, `packages/server/src/rooms/GameRoom.ts:2090-2117`, `packages/server/src/rooms/GameRoom.ts:3769-3792`)

If a proposed zone cannot create a similarly legible two-sided exchange **without** a loot bonus or a spawn command, it is scenery and should not ship as a system.

## What the code actually says

The present arena has no macro-zone concept. `ArenaMap` contains a binary ground/pit tile array, one central spawn, POI points, and seeds; `generateArena` accepts only those seeds and emits those fields. (`packages/shared/src/mapgen.ts:38-65`, `packages/shared/src/mapgen.ts:421-454`)

The “randomly spread” feeling is not accidental. Pit seed sites reject nearby sites, explicitly spreading hazards apart, while POIs are rejection-sampled across ground and forced apart by radius-aware spacing. Pit generation and POI placement also use independent random streams. (`packages/shared/src/mapgen.ts:78-101`, `packages/shared/src/mapgen.ts:356-418`, `packages/shared/src/mapgen.ts:429-443`)

The map is deliberately roomy: it is 4800×4800, with a 13% pit target, a 22% ceiling, a clear center, and a ground border. Connectivity repair guarantees that every ground tile remains reachable from spawn by walking or a permitted hop. (`packages/shared/src/constants.ts:154-180`, `packages/shared/src/mapgen.ts:171-188`, `packages/shared/src/mapgen.ts:302-329`, `packages/shared/src/mapgen.ts:643-661`)

The horde does not belong to a quadrant. The director accumulates time, chooses the active dimension's weighted roster, chooses a random living-player anchor, and places an enemy at a random angle on a 720px ring before nudging it off pits and POIs. Generic enemies then chase or kite the nearest living player, and melee enemies close on the nearest player before attacking. (`packages/server/src/rooms/GameRoom.ts:4074-4131`, `packages/shared/src/constants.ts:250-263`, `packages/server/src/rooms/GameRoom.ts:2014-2067`, `packages/server/src/rooms/GameRoom.ts:3386-3427`)

The existing runtime `ZoneState` is not macro geography: it carries only a center and radius. Zoner enemies lay those circles at their own positions, they expire after 4.5 seconds, and they damage players who remain inside. In other words, the game's successful area denial is delivered by a horde actor rather than waiting forever in a quadrant. (`packages/shared/src/state.ts:163-169`, `packages/shared/src/constants.ts:354-362`, `packages/server/src/rooms/GameRoom.ts:3941-3993`)

Dimensions scope rosters, bosses, palettes, and asset-set keys, but the `hazard` field is explicitly flavour-only today. Its four generated descriptions imply four materially different systems—sliding black ice, stacking poison plus slow, cycling vents, and a timed laser grid—not one cheap generic zone. (`packages/shared/src/dimensions.ts:27-40`, `packages/shared/src/dimensions.generated.ts:23-41`, `packages/shared/src/dimensions.generated.ts:56-74`, `packages/shared/src/dimensions.generated.ts:89-107`, `packages/shared/src/dimensions.generated.ts:122-140`)

The current floor art cannot silently carry semantic regions. Painted ground variants tile across the whole arena, while dust and decals sample positions across the whole arena and merely reject pits; dimension selection swaps whole POI/decal packs rather than assigning a pack to a subregion. (`packages/client/src/scenes/arena/floor-renderer.ts:47-85`, `packages/client/src/scenes/arena/floor-renderer.ts:117-165`, `packages/client/src/scenes/arena/floor-renderer.ts:374-416`)

## Attack: why the obvious zone proposals fail

### 1. Static danger is optional wallpaper

Put poison in the northwest and the rational player stands elsewhere. The director spawns around the squad and enemies converge on the squad, so nothing about the survival loop presently requires crossing or holding that poison. (`packages/server/src/rooms/GameRoom.ts:4074-4131`, `packages/server/src/rooms/GameRoom.ts:2014-2067`)

That is not automatically bad—“stay away because X” is part of the brief—but it is not enough to justify a zone system. A zone changes a decision only when occupying or routing through it changes the incoming fight. A static damage disc in a 23-million-pixel² arena is mostly a subtraction from usable floor. (`packages/shared/src/constants.ts:154-159`)

**Verdict: reject stationary damage/slow biomes as the first pass.** They add avoidance, not play.

### 2. Forcing the horde into zones solves the wrong problem

Fixed nests, quadrant-biased spawns, or “the next wave is in the swamp” would make the squad commute to the encounter. Zone-specific reinforcements aimed at a player inside the zone would make entering it a hidden director toggle. Both replace the current promise—pressure arrives around living players on a timed curve—with authored engagement geography. The existing curve accelerates from 1.9s to 0.65s between spawns, is depth-scaled, and caps at 80 enemies; spatial forcing would be a second difficulty director layered on that one. (`packages/shared/src/constants.ts:250-263`, `packages/shared/src/enemies.ts:711-717`, `packages/server/src/rooms/GameRoom.ts:4074-4084`)

**Verdict: reject zone-biased trash spawns and mandatory zone objectives.** If a region is interesting only when the director orders attendance, the region is not carrying its design weight.

### 3. Co-op turns local modifiers into squad friction

The director chooses a random living player as each spawn anchor, while enemy movement and ranged fire retarget the nearest living player. A squad split across differently tuned regions would therefore mix spawn origins, target selection, and incompatible local modifiers in one authoritative fight. (`packages/server/src/rooms/GameRoom.ts:4091-4095`, `packages/server/src/rooms/GameRoom.ts:2025-2063`, `packages/server/src/rooms/GameRoom.ts:2833-2868`)

A “good farming zone” also creates a social command: stay with the optimizer or lower the squad's yield. A “bad debuff zone” punishes the player whose movement or class needs more space. Neither is natural geography; both are lobby arguments encoded into floor coordinates.

**Verdict: regions may alter shared terrain interactions, not per-player stats.** No local damage multiplier, cooldown multiplier, rarity modifier, XP aura, or class-specific boon in v1.

### 4. The dressing budget cannot make an invisible rule honest

The existing renderer has a good exact language for pits: the tile truth produces the void, hot rim, and different “hop me” versus “go around” edge marks. POI sprites likewise derive visual scale from the same shared radius used for collision. (`packages/client/src/scenes/arena/floor-renderer.ts:199-258`, `packages/client/src/scenes/arena/floor-renderer.ts:261-370`, `packages/shared/src/mapgen.ts:331-349`)

It has no corresponding macro-zone footprint in `ArenaMap`. Reusing scattered decals as a boundary would make a statistical suggestion, not a hit rule. Repeating combat FX is worse: the composer stages transient, self-destroying component timelines and refuses calls after ten packs in a render frame. (`packages/shared/src/mapgen.ts:52-65`, `packages/client/src/vfx/fx-composer.ts:1-2`, `packages/client/src/vfx/fx-composer.ts:183-204`, `packages/client/src/vfx/fx-composer.ts:238-255`)

The WYSIWYG bar is not negotiable. The audit already identifies rendered-versus-authoritative positional disagreement as a melee and terrain-read failure, while the shared melee clock makes active start, active end, impact, and progress explicit instead of asking two sides to infer them. (`docs/GAMEFEEL_AUDIT.md:93-99`, `packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`, `packages/shared/src/melee.ts:740-761`)

**Verdict: no zone mechanic without an exact shared footprint and phase.** Painted props and ambient particles may reinforce that truth; they may never define it.

### 5. Zone loot would dominate the economy

Trash and tough mystery-drop chances are currently 1.2% and 5.5%; bosses guarantee a mystery drop; killing wielders can add a separate known-weapon drop; rarity uses the best living squad member's LUK. Drops are placed at the death position and nudged only to safe ground. (`packages/shared/src/constants.ts:420-438`, `packages/server/src/rooms/GameRoom.ts:3151-3176`, `packages/server/src/rooms/GameRoom.ts:3203-3249`, `packages/server/src/rooms/GameRoom.ts:3713-3732`)

A zone drop multiplier therefore rewards camping, not travel: the horde already comes to the player, so the optimal squad parks in the richest footprint and receives the normal enemy stream plus a spatial premium. A one-time chest merely changes the exploit to a solved opening route. Boss and shifter salvage already provide the depth-scaled wages for engaging capstone threats. (`packages/server/src/rooms/GameRoom.ts:4074-4131`, `packages/server/src/rooms/GameRoom.ts:3158-3164`, `packages/server/src/rooms/GameRoom.ts:4365-4374`)

**Verdict: no zone-specific drop chance, rarity, salvage, XP, chest, harvesting node, or guaranteed weapon.** The first pass must survive on combat value alone.

### 6. “Wire the registry hazards” is a scope trap

The registry labels environmental hazards as future wiring, and the descriptions require different movement, status, timing, and telegraph rules. (`packages/shared/src/dimensions.ts:31-40`, `packages/shared/src/dimensions.generated.ts:23-25`, `packages/shared/src/dimensions.generated.ts:56-58`, `packages/shared/src/dimensions.generated.ts:89-91`, `packages/shared/src/dimensions.generated.ts:122-124`)

Black ice is especially hostile to the current contract because it changes movement, while the gamefeel audit treats prediction and reconciliation—including terrain collision push-outs—as a coordinated system rather than a cosmetic tweak. (`docs/GAMEFEEL_AUDIT.md:89-102`)

**Verdict: defer bespoke per-dimension hazards.** First prove that spatial correlation of existing mechanics is fun; only then promote one registry hazard through a shared descriptor and authoritative telegraph path.

## Steelman: the version that strengthens the bullet-heaven loop

Natural zones can work precisely because the horde comes to the squad. The player is not choosing where enemies exist; the player is choosing the terrain on which to receive them. (`packages/server/src/rooms/GameRoom.ts:4074-4131`)

The map already contains two unusually strong, two-sided terrain interactions:

1. **The scar / shaft country:** denser, larger pit features. Entering it exposes the player to fall damage and snap-back, but a pressured squad can kite normal enemies into instant terrain deletion. Because those deletions pay no XP, the scar is an emergency valve, not a farm. (`packages/server/src/rooms/GameRoom.ts:1797-1843`, `packages/server/src/rooms/GameRoom.ts:2119-2131`)
2. **The ruin / cover country:** denser POIs with the existing guaranteed walking gaps. It breaks ranged lines and bunches pursuing enemies, but it also constrains the squad and absorbs friendly fire. (`packages/shared/src/constants.ts:189-212`, `packages/server/src/rooms/GameRoom.ts:2090-2117`, `packages/server/src/rooms/GameRoom.ts:3769-3792`)

Now “avoid the northwest” has a real answer: it is scarred ground where one mistake costs health. “Go northwest” also has a real answer: the horde is about to overwhelm us, and we are willing to burn XP to dump bodies into shafts. “Take the eastern ruins” answers a different roster state: ranged pressure is worse than losing clean shot lanes. The active dimension's roster remains responsible for which of those choices is attractive, because the director already restricts its weighted pick to that roster. (`packages/shared/src/dimensions.ts:27-40`, `packages/server/src/rooms/GameRoom.ts:4086-4104`)

This is the steelman because it adds map memory without adding a parallel objective loop, a second reward economy, or a second spawn director.

## Proposal verdicts

| Proposal | Verdict | Reason |
|---|---|---|
| Correlate existing pits and POIs into broad irregular neighborhoods | **Approve** | It changes the terrain on which the player receives the horde while retaining existing authoritative interactions. (`packages/server/src/rooms/GameRoom.ts:1788-1843`, `packages/server/src/rooms/GameRoom.ts:2090-2131`) |
| Keep the continuous director player-anchored and roster-scoped | **Approve** | That is the current bullet-heaven contract. (`packages/server/src/rooms/GameRoom.ts:4074-4131`) |
| Add a static damage, slow, or stat aura to every neighborhood | **Reject** | It is either ignorable floor loss or an always-optimal buff, and it creates a new WYSIWYG burden. |
| Bias trash spawns toward or away from a zone | **Reject** | It replaces the current player-centered pressure with commute/attendance pressure. (`packages/server/src/rooms/GameRoom.ts:4074-4131`) |
| Add zone loot, rarity, salvage, XP, chests, or resource nodes | **Reject** | Player-centered spawns turn any spatial yield bonus into a camping multiplier. (`packages/server/src/rooms/GameRoom.ts:4074-4131`) |
| Implement all four dimension hazard descriptions now | **Reject** | The registry describes four different systems and explicitly marks hazard wiring as later. (`packages/shared/src/dimensions.ts:35-40`, `packages/shared/src/dimensions.generated.ts:23-25`, `packages/shared/src/dimensions.generated.ts:56-58`, `packages/shared/src/dimensions.generated.ts:89-91`, `packages/shared/src/dimensions.generated.ts:122-124`) |
| Use existing dimension props, particles, and component packs as accents | **Conditional** | They can reinforce a shared procedural footprint, but the current decor is whole-map scatter and the FX composer is transient. (`packages/client/src/scenes/arena/floor-renderer.ts:374-416`, `packages/client/src/vfx/particle-manifest.ts:9-107`, `packages/client/src/vfx/fx-composer.ts:148-174`, `packages/client/src/vfx/fx-composer.ts:238-255`) |
| Add a timed environmental attack later | **Conditional** | Its fixed geometry, phase, and danger must be authoritative; the existing generic telegraph schema already establishes that pattern. (`packages/shared/src/state.ts:171-205`, `packages/shared/src/state.ts:318-322`) |

## Minimum zone contract

Ship no zone work unless the following entire contract is met.

### 1. One shared spatial truth

Extend the generated `ArenaMap` with deterministic zone descriptors; the current map shape has no place for them. A descriptor minimally needs `id`, `kind`, an irregular footprint seed/parameters, and a pure `weightAt(x,y)`/`contains(x,y)` result. Generation, collision/effects, and rendering must call the same shared predicate. (`packages/shared/src/mapgen.ts:42-65`, `packages/shared/src/mapgen.ts:421-454`)

Do not maintain a server polygon and a visually similar client polygon. If a later zone has an active cycle, give it one shared/authoritative phase clock in the same spirit as `SwingDescriptor`, or publish fixed danger geometry and progress through the existing authoritative telegraph state. (`packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`, `packages/shared/src/state.ts:171-205`)

### 2. Exactly two authored gameplay profiles, plus neutral ground

- **Scar profile:** smoothly increases pit-site likelihood and/or blob size toward one broad irregular locus; decreases POI likelihood there.
- **Cover profile:** smoothly increases POI likelihood toward another locus; preserves the existing footprint clearance and 150px walking-gap guarantees; decreases pit likelihood there. (`packages/shared/src/mapgen.ts:356-418`, `packages/shared/src/constants.ts:199-212`)
- **Neutral profile:** remains the baseline and keeps the central spawn disc safe. (`packages/shared/src/mapgen.ts:171-188`)

The loci must be large enough to host a fight, not icon-sized patches, and must not ring or overlap the central spawn. Placement must still pass the existing spawn, border, and connectivity validator. (`packages/shared/src/mapgen.ts:171-188`, `packages/shared/src/mapgen.ts:643-661`)

Two profiles are enough to test the premise. More profiles make readability and balance attribution worse before the core decision is proven.

### 3. The decision must be tactical, reciprocal, and loot-free

The scar's contract is **survival now versus growth later**: player fall risk and constrained paths in exchange for no-XP terrain disposal of the horde. The cover region's contract is **protection versus freedom**: projectile interception and enemy bunching in exchange for blocked friendly shots and tighter routes. Those consequences already follow from authoritative pit and POI behavior; no stat aura is needed. (`packages/server/src/rooms/GameRoom.ts:1797-1843`, `packages/server/src/rooms/GameRoom.ts:2090-2131`, `packages/server/src/rooms/GameRoom.ts:3769-3792`)

There must be no zone-specific loot table, rarity roll, salvage, XP multiplier, pickup, or resource counter. The existing pit rule's no-XP outcome is the economic cost, not a hole to compensate. (`packages/server/src/rooms/GameRoom.ts:2119-2131`)

### 4. The spawn director does not know zones exist

Keep timed spawning around a random living player, keep the active dimension roster, and keep the safe-ground nudge. A zone earns engagement by changing the chosen battlefield, not by overriding where the fight starts. (`packages/server/src/rooms/GameRoom.ts:4074-4131`)

If playtests ignore a region, first enlarge it, strengthen the existing terrain contrast, or remove it. Do not rescue it with forced attendance or a reward multiplier.

### 5. Readability uses exact procedural geometry

The exact zone weight must drive all three layers:

1. **Topology:** pit/POI density.
2. **Ground read:** a low-frequency palette tint, contour, cracks, fog band, grid distortion, or other procedural mark tied to the same footprint.
3. **Dressing:** weighted selection/density from the existing active-dimension decal and POI pack.

The current dimension palette already separates hot pit danger from the cool safe spawn, and the pit renderer derives its void/rim/chevrons from exact tile truth. Preserve that vocabulary rather than adding another arbitrary neon ring. (`packages/shared/src/dimensions.ts:12-24`, `packages/client/src/scenes/arena/floor-renderer.ts:261-370`)

Painted assets and particles are reinforcement only. The particle registry and twelve component packs provide useful dimension-coloured accents, but transient FX may not be the only indication that a persistent rule exists. (`packages/client/src/vfx/particle-manifest.ts:1-10`, `packages/client/src/vfx/particle-manifest.ts:95-107`, `packages/client/src/vfx/fx-composer.ts:17-45`)

### 6. WYSIWYG is an acceptance gate

- No damage, slow, stagger, collision, or director effect may occur outside the visible shared footprint.
- No visible “hot” footprint may be harmless during a phase unless its inactive state is unmistakable.
- No client-only timer may decide when an authoritative environmental hit is active.
- POI visual scale must continue to derive from the shared collision radius, and pit marks must continue to derive from the pit tiles. (`packages/client/src/scenes/arena/floor-renderer.ts:199-258`, `packages/client/src/scenes/arena/floor-renderer.ts:281-370`)

For v1, the safest way to pass this gate is to add **no new runtime damage rule at all**: make the macro-zone out of exact existing pit and POI truth.

### 7. A decision test, not a screenshot test

The feature passes only if all of these are true in seeded co-op playtests:

- From the floor alone, a new player can point to the scar and cover neighborhood and predict the basic consequence before entering.
- Under pressure, a player deliberately chooses scar, cover, or neutral ground for a combat reason—not because a reward marker says to go there.
- At least two choices remain defensible: if one region is always optimal, it is a dominant strategy, not a zone.
- The squad can leave any region under ordinary movement; no spawn rule, gate, or objective holds them there.
- Reproducing the same seeds yields the same footprints, topology, and dressing on server and client, preserving the existing shared-generation model. (`packages/shared/src/state.ts:267-276`, `packages/server/src/rooms/GameRoom.ts:4346-4362`)
- Drop and salvage expectations do not receive a zone multiplier.

## Kill criteria

Kill or cut the feature if any of these sentences appears during implementation:

- “Players need a chest there or they will never visit.”
- “The director should spawn the next wave there so they have to engage.”
- “The decal density is close enough to the damage mask.”
- “Each dimension needs its own movement/status implementation for the first release.”
- “The minimap label explains what the floor art cannot.”

Those are not polish requests. They are evidence that the zone itself does not produce a readable, voluntary combat decision.

## Final ruling

**Yes to natural zones as correlated terrain; no to zones as content containers.**

Make one memorable scar country and one memorable cover country. Let the existing roster change which is attractive. Let the existing horde follow the players into either. Let pits exchange XP for survival and let ruins exchange shot lanes for cover. (`packages/server/src/rooms/GameRoom.ts:4086-4131`, `packages/server/src/rooms/GameRoom.ts:2119-2131`, `packages/server/src/rooms/GameRoom.ts:3769-3792`) Spend procedural rendering and the painted library on making those exact truths legible. Do not add loot, forced spawns, invisible stats, or four bespoke hazards until this minimum version proves that players actually choose where to fight.
