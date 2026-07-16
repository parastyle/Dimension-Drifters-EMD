# Beam Weapons — Senior Weapons Designer Panel

## Decision

Ship beams as a first-class held delivery, `WeaponDef.beam`, not as very fast bullets and not as the hostile-boss telegraph type. Holding RMB starts a readable charge, ignition establishes an authoritative beam, and continued hold channels damage while the beam follows aim through weapon-specific angular inertia. Heat always limits caster beams; the two gun beams also consume magazines. Release stops damage immediately. Overheat forces a visible lockout.

The non-negotiable contract is: **the saturated outer sheath is the complete damage width, its bright cap is the real terminal point, and everything swept between the previous and current authoritative poses is eligible to be hit.** Decorative bloom may extend outside the sheath, but it must be soft enough that nobody reads it as a second hit boundary.

This deserves a new delivery path. The current caster block is a cooldown-driven piercing projectile with no magazine, while the gun block is a fire-rate-driven projectile with magazine and reload (`packages/shared/src/weapons.ts:165`, `packages/shared/src/weapons.ts:187`). The server routes guns and casts into separate one-shot methods (`packages/server/src/rooms/GameRoom.ts:1949`, `packages/server/src/rooms/GameRoom.ts:1975`), and both ultimately call the projectile spawner (`packages/server/src/rooms/GameRoom.ts:2989`, `packages/server/src/rooms/GameRoom.ts:3034`). A train of tracer points cannot honestly represent one continuous swept volume.

The expansion pipeline already recognizes `beam` as an authored kind (`tools/artkit/gen-weapon-expansion.mjs:37`), but the generator deliberately turns it into a fast tracer gun (`tools/artkit/gen-weapon-expansion.mjs:198`). It maps authored `tickRate` to `gun.fireRate`, supplies a magazine, and emits a tracer (`tools/artkit/gen-weapon-expansion.mjs:204`, `tools/artkit/gen-weapon-expansion.mjs:205`, `tools/artkit/gen-weapon-expansion.mjs:207`). The consistency test currently enshrines that substitution (`tests/data-consistency.test.ts:183`). That placeholder must be removed, not layered over.

## Player contract and channel clock

The channel has four states:

1. **Idle → Charging.** RMB down captures the equipped weapon, increments `beamSeq`, and starts an immutable server beam descriptor. The rig points at aim immediately, movement is braced by the profile multiplier, the implement glows, and three charge beats occur at 35%, 70%, and 92%. No damage and no ammo drain occur during charge.
2. **Charging → Active.** Reaching `chargeSeconds` spends `ignitionAmmo`, adds `ignitionHeat`, and establishes the first damage pose on the already-accepted sequence. The client plays ignition kick, flash, ring, sound, and one camera impulse. Releasing before this point cancels cleanly.
3. **Active → Cooling.** While RMB remains down, heat and optional ammo drain; the authoritative beam angle approaches aim using the weapon's sweep lag. Voluntary release ends damage on that exact simulation step and preserves accumulated heat. The visual may taper for 80 ms, but the taper is never damaging.
4. **Active → Overheated.** At heat 1, `maxChannelSeconds`, empty magazine, death/down, weapon swap, level window, disconnect, or stale fire input, damage ends immediately. A true overheat locks restart for `lockSeconds` and until heat is at or below `restartHeat`. Empty gun beams reload as guns do. If RMB is still held when every gate clears, charging may start again; the forced gap is intentional.

Heat is normalized `[0,1]`. During channel it rises by `heatPerSecond × dt`; while not active it falls by `coolPerSecond × dt`. `maxChannelSeconds` remains an independent hard ceiling, so future cooling or heat modifiers cannot accidentally create a permanent laser. `ignitionHeat` prevents rapid release/re-ignite from outperforming a full channel. Casters have no magazine; gun beams stop at whichever budget—heat, duration, or ammo—runs out first.

Use a beam-specific immutable descriptor analogous to the accepted swing clock. The existing `SwingDescriptor` freezes effective swing timing (`packages/shared/src/melee.ts:609`), is created at authoritative acceptance (`packages/shared/src/melee.ts:659`), and exposes shared phase functions (`packages/shared/src/melee.ts:740`). Do not force a held state into that one-shot type. Add `BeamDescriptor` and pure phase/angle/geometry helpers beside it in shared simulation code, capturing effective charge, channel, cooling, damage multiplier, resource rates, start tick, weapon id, and sequence at acceptance.

Aim inertia is deterministic first-order steering:

```text
desiredDelta = shortestAngle(targetAim - beamAngle)
alpha        = 1 - exp(-dt / sweepLagSeconds)
beamAngle   += clampForSweepBudget(desiredDelta * alpha)
```

`sweepLagSeconds` therefore has an understandable meaning: after one lag constant the beam has covered about 63% of a sudden aim change. Charge uses the same steering, so a heavy beam cannot snap to the opposite side on its ignition frame. The synchronized beam angle—not the raw cursor—is always what renders and hits.

## Proposed `WeaponDef.beam`

Add this sibling to `cast` and `gun` in `packages/shared/src/weapons.ts`. Existing delivery blocks already own their source-specific damage, cadence, range, visual kind, and scaling fields (`packages/shared/src/weapons.ts:171`, `packages/shared/src/weapons.ts:194`); the beam should do the same.

```ts
beam?: {
  /** Base damage per active second, before source/stat/affix modifiers. */
  damagePerSecond: number;
  /** Damage/event cadence; strict multiple of the 50 ms sim step. */
  tickRate: number;
  /** Full world-space damaging diameter, in px. */
  width: number;
  /** Maximum muzzle-to-cap distance, in px. */
  range: number;
  /** Held time before authoritative ignition, in seconds. */
  chargeSeconds: number;
  /** Exponential angular-follow time constant, in seconds. */
  sweepLagSeconds: number;
  overheat: {
    maxChannelSeconds: number;
    heatPerSecond: number;
    coolPerSecond: number;
    ignitionHeat: number;
    lockSeconds: number;
    restartHeat: number;
  };
  /** Present only on magazine-fed gun beams. */
  ammo?: {
    magazine: number;
    reloadSeconds: number;
    ignitionCost: number;
    drainPerSecond: number;
  };
  movement: {
    chargeMul: number;
    channelMul: number;
  };
  scalingGrades?: Partial<Record<Attr, Grade>>;
};
```

Schema laws:

- `tickRate` must be `0.10`, `0.15`, `0.20`, or another exact multiple of the shared 50 ms step; the shared constants define a 20 Hz / 50 ms tick (`packages/shared/src/constants.ts:16`, `packages/shared/src/constants.ts:18`). Authored 0.11–0.14 placeholders are normalized to 0.10 or 0.15 during migration, never silently rounded at runtime.
- `width` is full diameter. Boss `ActiveSpec.b` currently means half-width (`packages/shared/src/boss-primitives.ts:101`); the player schema intentionally removes that ambiguity.
- `range`, `width`, `chargeSeconds`, and movement values are fixed presentation/geometry numbers. Only `damagePerSecond` receives stat/rarity/affix/set damage multiplication, through the same source multiplier used by gun and cast damage (`packages/server/src/rooms/GameRoom.ts:2956`, `packages/server/src/rooms/GameRoom.ts:3019`).
- Cooldown affixes scale `chargeSeconds` and `lockSeconds`; they do not lengthen the active window or accelerate heat cooling. Damage is snapshotted at ignition and the channel is canceled on weapon swap, preventing mid-beam equipment exploits.
- `tags.classPool` continues to decide caster versus ranged identity; the current taxonomy already carries class, element, family, grip, size, and range band (`packages/shared/src/weapons.ts:232`). `beam` is the delivery, not a fourth class.
- Generator strict mode remains strict: add only these keys to the behavior whitelist, validate every bound, emit a real `beam` block, and delete the `beam → gun` branch. The generator's stated policy is to fail unknown/sibling keys rather than repair them (`tools/artkit/gen-weapon-expansion.mjs:6`).

Recommended validation bands: DPS 20–80, tick 0.10–0.20, width 24–96 px, range 360–900 px, charge 0.25–1.25 s, lag 0.05–0.35 s, channel 1.25–2.75 s, lock 0.6–1.6 s, and movement multipliers 0.35–1.0. These are authoring alarms, not automatic clamps.

## Authority and protocol

### Input

Do not infer hold from repeated `attack` messages. Today RMB is sampled client-side and emits an `attack` request (`packages/client/src/scenes/ArenaScene.ts:5628`, `packages/client/src/scenes/ArenaScene.ts:5802`); the server turns that into a short attack buffer plus normalized aim (`packages/server/src/rooms/GameRoom.ts:604`, `packages/server/src/rooms/GameRoom.ts:607`). That is right for one-shot weapons and wrong for start/continue/release semantics.

Extend the 50 ms sequenced input command with `fireHeld`, normalized `aimX/aimY`, and target world coordinates. The current command contains movement and jump only (`packages/server/src/rooms/GameRoom.ts:234`), is sent when the shared tick accumulator reaches `TICK_MS` (`packages/client/src/scenes/ArenaScene.ts:7623`, `packages/client/src/scenes/ArenaScene.ts:7631`), and the server already drains to the newest command while retaining it as held state (`packages/server/src/rooms/GameRoom.ts:1690`, `packages/server/src/rooms/GameRoom.ts:1693`). One-shots can keep the attack RPC during migration; beams read only the sequenced held field.

Because the existing input fallback deliberately preserves held state when starved (`packages/server/src/rooms/GameRoom.ts:243`), add `lastFreshFireTick`: three simulation ticks (150 ms) without a new command forces `fireHeld=false` and terminates the beam. Movement may continue using its existing held fallback. This is both disconnect safety and protection against a channel becoming permanent during a network stall.

The local player may predict charge glow and the braced pose immediately. It must not predict damaging ignition. If the authoritative `beamSeq` has not arrived at local charge completion, hold the charge visual at 95%; ignite when accepted. A rejected charge fades. This hides normal round-trip delay inside a deliberately long anticipation without ever showing a damaging beam the server does not own.

### Authoritative state

Add an append-only `BeamState` map on `ArenaState`, keyed by owner id:

```ts
BeamState {
  ownerId: string;
  weaponId: string;
  seq: uint32;
  phase: uint8;        // charging | active | cooling | overheated
  phaseStartTick: uint32;
  originX: number;
  originY: number;
  angle: number;
  effectiveLength: number;
  width: number;
  heat: number;
}
```

Keep `charges/maxCharges` as the gun-beam magazine readout; the server already initializes that shared readout from a gun magazine or thrown charges (`packages/server/src/rooms/GameRoom.ts:1928`), and `aimDir` is updated from normalized attack aim for remote gun presentation (`packages/server/src/rooms/GameRoom.ts:607`, `packages/server/src/rooms/GameRoom.ts:617`). Retain the equipped beam row during cooling/lockout so remote rigs and HUD can show heat; remove it at cold idle or when a non-beam is equipped.

Keep a private resource ledger by owner plus weapon/loadout key. Heat continues cooling while that weapon is unequipped, and gun-beam ammo/reload state persists across a swap; returning to the weapon restores both debts. The current one-shot route reinitializes the shared magazine whenever the weapon changes (`packages/server/src/rooms/GameRoom.ts:1928`, `packages/server/src/rooms/GameRoom.ts:1938`), which would otherwise let beam users bypass both budgets by cycling weapons. Only the currently equipped beam needs a synchronized presentation row.

Do not reuse `TelegraphState`. It is explicitly the synchronized boss danger-footprint backbone and carries the existing parry/dodge danger language (`packages/shared/src/state.ts:172`, `packages/shared/src/state.ts:183`). Friendly saturated beams need source element/team color and no red/white hazard fill. The useful precedent is behavioral: hostile beams author a charging sweep telegraph (`packages/shared/src/boss-primitives.ts:416`), hold a persistent active spec with DPS/length/width/rotation (`packages/shared/src/boss-primitives.ts:90`), then update geometry and apply `dps × stepDt` every active step (`packages/server/src/rooms/BossController.ts:220`, `packages/server/src/rooms/BossController.ts:234`).

The origin and angle are direct authoritative presentation data, not derived from a remote body's delayed render position. Hostile telegraphs already document why authoritative footprint data must not be snapshot-interpolated with a lagging body (`packages/shared/src/state.ts:180`). During an active beam, the remote rig's weapon pose should temporarily align to the beam origin and angle so the painted implement never floats away from its own beam.

## Damage geometry: swept capsule, not point samples

For each active 50 ms simulation step:

1. Compute muzzle `O` from the authoritative player position, accepted beam angle, character scale, and the shared held-weapon reach. Guns already share a barrel-tip reach function between server and client (`packages/shared/src/weapons.ts:275`); generalize its name to `weaponMuzzleReach` and use it for staves, wands, gauntlets, and guns.
2. Ray-clip maximum range against authoritative arena bounds and any colliding POI/cover shape. The nearest hit becomes `E`; synchronize `effectiveLength = |E-O|`. A beam never damages through a blocker while painting through it.
3. Treat the current beam as capsule `O→E`, radius `width/2`. Enemy collision disc radius `r` intersects when `pointSegmentDist2(enemy, O, E) <= (width/2 + r)^2`. A pure point-to-segment helper already exists in shared melee geometry (`packages/shared/src/melee.ts:774`); reuse it rather than inventing a subtly different distance test.
4. Cover the motion from the previous authoritative capsule to the current one. Let `travel = max(|O1-O0|, 2R·sin(|Δangle|/2))` and `N = ceil(travel/(width/2))`. Test `N+1` interpolated capsules, using shortest-angle interpolation. Clamp the accepted angular move before this calculation so `N <= 24`; the leftover aim delta remains for subsequent steps and therefore renders as additional inertia rather than becoming an untested teleport.
5. Broad-phase only enemies in the union AABB of previous/current origins and endpoints, expanded by `width/2 + maxEnemyRadius`. `SpatialGrid.queryAabb` already supplies this query shape (`packages/server/src/rooms/SpatialGrid.ts:60`). Narrow-phase every candidate against the interpolated capsules.

Damage accounting is continuous even though feedback is pulsed. On every simulation step, add `dt` once to `contactSeconds[enemyId]` if any swept sub-capsule intersects that enemy; never add more than once for overlapping sub-samples. At each `tickRate`, apply:

```text
damage(enemy) = damagePerSecond × contactSeconds[enemy] × snapshottedDamageMultiplier
```

Then clear that enemy's accumulator. Flush prorated contact on release, overheat, death, or swap so short end fragments neither vanish nor receive a full tick. Route the result through the normal authoritative enemy damage/crit/kill pipeline. This makes pulse rate a readability/network lever, not a DPS lever.

The existing friendly projectile loop advances point positions and then radius-queries enemy contacts (`packages/server/src/rooms/GameRoom.ts:3745`, `packages/server/src/rooms/GameRoom.ts:3836`). It is not the beam broad phase, lifetime, or hit ledger. A player beam owns one state row and bounded contact maps—not dozens of pseudo-projectiles—so four-player co-op stays at four principal beam volumes.

### WYSIWYG rendering law

- Build the outer sheath as a procedural world-space quad plus round start/end caps at exactly `effectiveLength × width`. Project its vertices through the arena's world-to-screen transform; do not fake width with an unprojected horizontal sprite.
- Draw a white-hot core at 26–34% of sheath width. Core, sheath, and collision share the same centerline. Color noise, painted wisps, sparks, and bloom are contained decoration.
- The hard outer sheath is alpha-stable enough to aim by. Bloom outside it stays below 20% peak opacity and cannot form a second crisp edge.
- The terminal eruption is pinned to synchronized `E`, including wall clipping. Enemy contact accents can appear along the shaft, but nothing may imply that the beam stopped at the first enemy because the damage capsule pierces.
- On release/overheat, stop the hard sheath on the authoritative step. Cosmetic afterglow shrinks inward from `E` for at most 80 ms and never leaves a hit-looking cap behind.

The audit already identifies moving-body versus authoritative-hit geometry as a WYSIWYG failure mode (`docs/GAMEFEEL_AUDIT.md:94`). Direct beam pose state plus an exact rendered capsule addresses that failure instead of hiding it under bloom.

## Feel and presentation

No new render is required. The library exposes twelve named component packs, including `holy-smite` and `storm-call` (`packages/client/src/vfx/fx-composer.ts:17`), and the 96 existing particle packs occupy the element/shape manifest (`packages/client/src/vfx/particle-manifest.ts:10`, `packages/client/src/vfx/particle-manifest.ts:105`). Use those textures as ingredients inside a retained beam renderer; do not call the full one-shot composer every damage pulse. `playFxPack` spends a frame budget and stages self-destroying tweens (`packages/client/src/vfx/fx-composer.ts:238`, `packages/client/src/vfx/fx-composer.ts:252`), which is appropriate for ignition/termination, not a permanent shaft.

### Charge

- Pose the weapon along the accepted/predicted aim and pull both hands into a brace. The rig currently mounts painted weapon parts under their hands and scales them from `displayLength` (`packages/client/src/entities/SpriteRig.ts:1033`, `packages/client/src/entities/SpriteRig.ts:1069`). Add `setBeamPose(phase, progress, heat, angle)` and `getWeaponMuzzleWorld(out)` rather than reaching into private images from the scene.
- Reuse the retained additive duplicate technique already used for a weapon echo (`packages/client/src/entities/SpriteRig.ts:1363`, `packages/client/src/entities/SpriteRig.ts:1378`): an element-tinted duplicate grows from alpha 0.08 to 0.55 without changing the painted weapon's dimensions.
- Pull element motes and wisps inward toward the muzzle. At the three charge thresholds, flash a progressively tighter ring and play low/mid/high tonal beats. The last beat is a promise, not ignition.
- No camera shake, hit stop, or impact flipbook during charge. Anticipation should be legible without stealing the impact channel.

### Ignition

- One simulation-authorized beat: a single-frame white core, painted muzzle ring, backward weapon/body kick, low-frequency sound transient, and the beam growing from muzzle to synchronized endpoint over 45–70 ms. The damage capsule is already full-length on the authoritative ignition step; the visual growth is fast enough to read as light travel, not a projectile.
- Screen shake is one impulse only: Agile `60 ms / 0.0025`, Standard `80 ms / 0.0045`, Heavy `100 ms / 0.0065`. These sit below the existing boss-slam `0.014` and quake `0.03` events (`packages/client/src/scenes/ArenaScene.ts:3691`, `packages/client/src/scenes/ArenaScene.ts:3709`).
- No ignition hit stop. Freezing a sustained aim source makes its first swept segment disagree with input, and the current shake helper already prioritizes stronger active shakes (`packages/client/src/scenes/ArenaScene.ts:6125`).

### Sustained shaft

- Retained procedural sheath and core, with two slow scrolling noise bands. Do not randomize the centerline or width.
- Spawn a sparse painted bolt/wisp inside the sheath every 90–160 ms, globally budgeted. `storm-call` provides hot bolt components and wisps (`packages/client/src/vfx/fx-composer.ts:115`); shock/arcane/void beams favor those. Holy/fire/solar beams can use the `holy-smite` pillar/core and hot components (`packages/client/src/vfx/fx-composer.ts:95`) as short rotated/tiled accents, not a stretched blurry pillar.
- Sustained feedback is weapon recoil, hand vibration, a restrained controller rumble, and a 2–3 px endpoint boil. **No per-tick screen shake and no per-tick hit stop.** The camera remains useful for dodging while channeling.

### Terminal/contact eruption

- Maintain one small endpoint emitter at `E`: ring every 250 ms, inward sparks, and element splat/shards on wall contact. Increase it while the endpoint is on an enemy, but keep the cap visible.
- The eight optional impact strips are six-frame one-shots (`packages/client/src/scenes/arena/vfx.ts:21`, `packages/client/src/scenes/arena/vfx.ts:33`, `packages/client/src/scenes/arena/vfx.ts:363`). Play one only on first contact after ignition, a kill, or a new endpoint blocker—not on every 10 Hz damage pulse.
- Overheat collapses the shaft from endpoint to muzzle, spits two hot components, makes a dry cutoff sound, and applies at most `70 ms / 0.003` shake. Normal release exhales without shake.

SpriteRig must treat `beam` like `gun` for facing and aim pose. Remote aim-facing currently explicitly keys on `weaponDef.gun` (`packages/client/src/entities/SpriteRig.ts:2214`), and the no-swing barrel pose is likewise gun-only (`packages/client/src/entities/SpriteRig.ts:2454`). Add beam to both branches. A charge/channel never calls the melee swing clock.

## Roster assignment

### All 21 authored beam casters convert

Every concept authored with `behavior.kind: "beam"` gets the new delivery. The table below is the first-pass base-stat sheet. All use `tickRate=0.10`; profile heat/movement values follow the next section. Width is the **full damaging width** and lag is `sweepLagSeconds`.

| Beam concept | Profile | DPS | Width | Range | Charge | Lag | Gameplay read |
|---|---:|---:|---:|---:|---:|---:|---|
| Null Grimoire of the Hollow Page (`data/weapon-concepts-300.json:9671`, `data/weapon-concepts-300.json:9688`) | Standard | 44 | 44 | 760 | 0.65 | 0.14 | Clean void eraser; balanced line control |
| Psalter of the Burning Halo (`data/weapon-concepts-300.json:9891`, `data/weapon-concepts-300.json:9908`) | Heavy | 58 | 72 | 820 | 1.00 | 0.23 | Long solar nave; commits hard |
| Frostquill Compendium (`data/weapon-concepts-300.json:10183`, `data/weapon-concepts-300.json:10200`) | Standard | 40 | 52 | 800 | 0.72 | 0.17 | Broad, steady frost stream |
| Brinequill Tidescepter (`data/weapon-concepts-300.json:10447`, `data/weapon-concepts-300.json:10469`) | Agile | 34 | 46 | 520 | 0.38 | 0.09 | Short pressure-washer sweep |
| Sunmote Reliquary Staff (`data/weapon-concepts-300.json:10577`, `data/weapon-concepts-300.json:10598`) | Heavy | 60 | 76 | 700 | 0.95 | 0.22 | Thick holy pillar laid sideways |
| Carrion Roost Necro-Scepter (`data/weapon-concepts-300.json:10764`, `data/weapon-concepts-300.json:10785`) | Heavy | 56 | 64 | 760 | 0.85 | 0.18 | Dirty feathered death-ray |
| Auroral Filament Wand (`data/weapon-concepts-300.json:10899`, `data/weapon-concepts-300.json:10920`) | Agile | 34 | 30 | 720 | 0.32 | 0.07 | Fast, thin aim-skill filament |
| Mesa-Spine Thunder Stave (`data/weapon-concepts-300.json:11025`, `data/weapon-concepts-300.json:11046`) | Standard | 44 | 46 | 740 | 0.58 | 0.13 | Crackling midweight lane |
| Gilded Hourglass Frost Scepter (`data/weapon-concepts-300.json:11156`, `data/weapon-concepts-300.json:11178`) | Agile | 32 | 40 | 700 | 0.45 | 0.20 | Deliberately viscous time/frost sweep |
| Riftglass Prism-Lantern (`data/weapon-concepts-300.json:11329`, `data/weapon-concepts-300.json:11361`) | Standard | 48 | 28 | 720 | 0.70 | 0.12 | Highest precision, narrow prism ray |
| Gravewax Seance-Globe (`data/weapon-concepts-300.json:11591`, `data/weapon-concepts-300.json:11623`) | Standard | 48 | 52 | 760 | 0.68 | 0.16 | Smoky occult lane |
| Quartzlight Wayfinder (`data/weapon-concepts-300.json:11763`, `data/weapon-concepts-300.json:11795`) | Standard | 44 | 48 | 740 | 0.60 | 0.13 | Reliable navigation line |
| Pearl-of-Penance Censer (`data/weapon-concepts-300.json:11931`, `data/weapon-concepts-300.json:11963`) | Heavy | 58 | 80 | 780 | 1.05 | 0.25 | Widest holy commitment short of Voidwell |
| Smoldering Eye of Perdition (`data/weapon-concepts-300.json:12058`, `data/weapon-concepts-300.json:12090`) | Standard | 50 | 40 | 800 | 0.72 | 0.16 | Long infernal focus beam |
| Nullsaint Reliquary (`data/weapon-concepts-300.json:12189`, `data/weapon-concepts-300.json:12212`) | Standard | 46 | 58 | 720 | 0.72 | 0.18 | Forgiving void/holy hybrid |
| Saintskull Monstrance (`data/weapon-concepts-300.json:12364`, `data/weapon-concepts-300.json:12387`) | Heavy | 62 | 74 | 760 | 1.00 | 0.24 | Shortest, hottest heavy burst |
| Voidwell Idol (`data/weapon-concepts-300.json:12732`, `data/weapon-concepts-300.json:12755`) | Heavy | 62 | 84 | 800 | 1.15 | 0.28 | Maximum coverage, maximum steering debt |
| Sanctum Brazier-Staff (`data/weapon-concepts-300.json:12911`, `data/weapon-concepts-300.json:12934`) | Heavy | 56 | 68 | 740 | 0.90 | 0.20 | Fire/holy corridor burner |
| Seraph's Knuckle-Reliquary (`data/weapon-concepts-300.json:13420`, `data/weapon-concepts-300.json:13446`) | Agile | 30 | 36 | 440 | 0.34 | 0.08 | Mobile palm-beam brawler |
| Voidgrasp Null-Gauntlet (`data/weapon-concepts-300.json:13506`, `data/weapon-concepts-300.json:13532`) | Agile | 34 | 42 | 460 | 0.40 | 0.10 | Short, forceful hand cannon ray |
| Glasswidow Hexweave (`data/weapon-concepts-300.json:13684`, `data/weapon-concepts-300.json:13711`) | Agile | 28 | 28 | 400 | 0.30 | 0.06 | Hyper-responsive needle thread |

This is a wholesale correction of the 21 placeholders, not a curated subset: a concept explicitly authored as a beam should no longer arrive in play as a tracer gun.

### Exactly two guns convert in the first wave

| Gun | DPS / width / range | Charge / lag | Heat profile | Magazine budget | Reason |
|---|---|---|---|---|---|
| Voltcaster Machine Pistol (`data/weapon-concepts-300.json:4548`) | 34 / 32 / 560 | 0.30 / 0.07 | Agile, 2.0 s hard channel | 24; ignition 2; drain 10/s; reload 1.8 s | Its authored theme is a “full-auto shock burner” and its card action already describes a hosed arc-violet stream (`data/weapon-concepts-300.json:4551`, `data/weapon-concepts-300.json:4569`). |
| Stormcaller Tesla Gatling (`data/weapon-concepts-300.json:8197`) | 52 / 60 / 620 | 0.75 / 0.16 | Heavy, 1.5 s hard channel | 40; ignition 6; drain 20/s; reload 2.4 s | Its authored identity is an arc-coil minigun with a torrent of forking bolts (`data/weapon-concepts-300.json:8200`, `data/weapon-concepts-300.json:8221`). |

Do **not** convert the base ballistic guns. The Revolver's identity is a slow heavy slug (`packages/shared/src/weapons.ts:946`), while the Gatling is explicitly a light tracer torrent with mild spray (`packages/shared/src/weapons.ts:1147`). Shotgun pellets, mortar shell, nail pierce, and ricochet caroms likewise remain discrete-projectile fantasies. Railguns remain charged single shots. Sustained beam should be a recognizable energy-weapon promise, not a synonym for every automatic gun.

## Balance guardrails

### Three heat profiles

| Profile | Max active | Heat/s | Full cool | Ignition heat | Lock | Restart heat | Move charge / active |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agile | 2.40 s | 0.383 | 1.40 s | 0.08 | 0.75 s | 0.25 | 0.85 / 0.70 |
| Standard | 2.00 s | 0.450 | 2.00 s | 0.10 | 1.00 s | 0.25 | 0.75 / 0.55 |
| Heavy | 1.50 s | 0.587 | 2.60 s | 0.12 | 1.35 s | 0.25 | 0.65 / 0.40 |

`heatPerSecond = (1-ignitionHeat)/maxChannel`, making the heat ceiling and hard duration meet on the same step; `coolPerSecond = 1/fullCool`. The restart threshold means the practical cold-overheat cycle is:

```text
cycleDPS = liveDPS × maxChannel /
           (charge + maxChannel + max(lock, (1-restartHeat) × fullCool))
```

At common rarity and attribute 1, target **18–24 single-target cycle DPS** for Agile/Standard and **18–22** for Heavy. Live DPS may be 28–62 because the charge and enforced cooling pay it back. Width, range, and unlimited line penetration are real power; Heavy gets lower cycle DPS because it buys the most horde coverage.

Current raw direct-fire references justify that band: Revolver is `18 / (0.50 + 1.40/6) = 24.5` cycle DPS from its authored gun values (`packages/shared/src/weapons.ts:946`); Gatling is `3 / (0.08 + 2.40/50) = 23.4` (`packages/shared/src/weapons.ts:1147`); Arcanist's Lance is `16/0.62 = 25.8` per target with line pierce (`packages/shared/src/weapons.ts:990`); Stormcaller Rod is `10/0.32 = 31.25` before its finite pierce limit (`packages/shared/src/weapons.ts:1026`). A beam may exceed those while lit, but should not beat them over repeated cold-overheat cycles before earning extra targets.

Guardrails:

- Evaluate solo boss, three-target lane, and dense-lane power separately. Never approve from paper single-target DPS alone.
- No enemy receives more than one contact contribution per 50 ms sim step, regardless of sweep sub-samples or overlapping decorative filaments.
- Width above 60 px or range above 760 px costs 5–12% cycle DPS unless charge/lag already makes the trade severe.
- A gun beam pays both heat and magazine downtime; do not compensate it back to caster uptime merely because it has two UI meters.
- Four simultaneous beams must stay within the step budget with the enemy-grid broad phase. Damage events are aggregated at `tickRate`, not broadcast for every 50 ms contact sample.
- Co-op testing must use scaled enemy health: enemy HP grows by 60% per extra player (`packages/shared/src/constants.ts:375`, `packages/shared/src/enemies.ts:695`). Do not lower beam DPS just because four coordinated beams erase solo-tuned targets.
- No crit roll per visual sub-sample. Roll once per enemy per damage pulse, or use the project's deterministic damage convention, so increasing sweep resolution cannot increase crit frequency.

The loot estimator must gain a beam branch before these enter the drop pool. Today `effectivePower` has explicit thrown and gun cadence/resource handling but no cast or beam branch (`packages/shared/src/loot.ts:149`, `packages/shared/src/loot.ts:163`), and expansion eligibility is a 0.6×–2.2× class-median gate (`packages/shared/src/loot.ts:198`). Beam power should use live DPS × duty cycle × expected line targets, then apply bounded reach/width credit and optional ammo downtime. Run the strict data-consistency test against all 21 caster conversions and both gun conversions.

### Signature augments

Replacing `cast`/`gun` blocks would otherwise break current augment classification: Hollow-Points and Ricochet Rounds are marked gun-only, while Overcharge and Arc Split are marked cast-only (`packages/shared/src/augments.ts:117`, `packages/shared/src/augments.ts:136`). Classify a beam by `tags.classPool` for offers, then give each an honest visible mapping:

- Caster **Overcharge:** keep the existing +25% DPS per stack tuning (`packages/shared/src/augments.ts:200`); the power estimator and live-DPS ceiling include stacks.
- Caster **Arc Split:** each stack, capped at three as today (`packages/shared/src/augments.ts:202`), adds a slender ±0.14 rad side filament. Main carries 70% of base beam DPS; side filaments share the remaining 30%, so it buys coverage rather than multiplying boss DPS. Every filament has its own visible exact-width capsule.
- Gun **Hollow-Points:** +10% full width per stack, capped at +30%, and +5% heat generation per stack. The beam is already penetrating; pretending it has another invisible pierce count would do nothing.
- Gun **Ricochet Rounds:** on wall/cover termination, create one visible reflected beam leg carrying 20% extra DPS and +15% heat generation; further stacks extend that leg by 25%, not add more branches. If there is no blocker there is no reflected damage. This is literal WYSIWYG ricochet, not an unseen target jump.

## Delivery sequence and acceptance gates

1. **Shared data:** add `WeaponDef.beam`, `BeamDescriptor`, pure heat/angle/swept-capsule helpers, schema validation, and the effective-power branch. Make the strict generator emit `beam`; update its independent consistency assertions.
2. **Protocol:** append `BeamState`, extend sequenced input with held fire/aim, add the stale-input release watchdog, and retain one-shot attack RPCs for non-beams.
3. **Server:** add the per-player beam state machine before one-shot attack routing; compute shared muzzle, clipping, sweep substeps, grid broad phase, contact-time accumulation, resource drain, and cancellation. Reuse the normal damage pipeline.
4. **Client rig:** add beam facing/pose, charge glow, authoritative muzzle anchor, heat feedback, and predicted-charge/authoritative-ignition reconciliation.
5. **Client renderer:** retained sheath/core/caps, exact world projection, endpoint emitter, painted component accents, audio, shake law, and HUD heat/reload state.
6. **Roster:** convert all 21 authored beam concepts, convert only the two named energy guns, regenerate, and tune through solo plus four-player encounter captures.

The feature is not done until these pass:

- Data test finds exactly the intended beam definitions, zero `kind:beam` concepts emitted as `.gun`, and rejects unknown beam keys.
- Geometry tests cover horizontal/vertical/diagonal capsules, enemy radii, moving origin, 180° aim reversal, blocker clipping, and the no-double-contact-per-step rule.
- Integration tests cover release during charge, release between damage pulses, overheat, empty magazine, reload, swap, down/death, level window, restart, disconnect, and the three-tick input watchdog.
- Determinism test runs identical 20 Hz inputs twice and compares phase, angle, heat, ammo, contacts, damage, and beam sequence tick-for-tick.
- WYSIWYG debug overlay draws the server capsule over the final sheath at multiple belt depths; hard edges and cap must coincide within one screen pixel.
- Performance capture runs four maximum-width sweeping beams through the densest supported horde. No projectile rows are created, contact maps remain bounded to broad-phase candidates, and damage events stay at authored pulse cadence.
- Reduced-motion mode removes shaft flicker, repeated rings, and rumble while preserving charge thresholds, exact sheath/cap, heat state, and ignition readability.

That package creates the requested kamehameha rhythm—anticipation, explosive ignition, committed sustained power, aimable sweep, and forced exhale—without violating server authority, the existing combat economy, or “what you see is what hits.”
