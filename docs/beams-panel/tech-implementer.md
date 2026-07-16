# Beam weapons — technical implementer panel

## Decision

Implement a first-class `WeaponDef.beam` delivery with an authoritative channel runtime in each player's private `CombatState`, plus one replicated `BeamState` row per active owner. Do not model a beam as a high-rate gun, a projectile train, a `cast` bolt, or a hostile `TelegraphState`.

That division keeps the responsibilities clean:

| Layer | Source of truth | Responsibility |
|---|---|---|
| Authored data | `WeaponDef.beam` | Width, range, charge/channel/release timing, turn rate, damage normalization, optional magazine |
| Server runtime | `CombatState` | Held input, phase clock, accepted start sequence, authoritative aim, previous line, resource drain, cooldown |
| Replication | one `BeamState` row keyed by player id | Exact origin, angle, length, half-width, intensity, phase, accepted input sequence |
| Owning client | predicted beam clock replayed from acknowledged input | Immediate charge and responsive sweep; presentation only |
| Remote clients | replicated row | Smooth visual playback of the authoritative beam |

This is a new sustained-action protocol, not an extension of `SwingDescriptor`. The shared swing clock is an immutable, finite pose with one active interval and one impact time; it deliberately describes accepted/predicted melee epochs. A channel needs held/released input, a variable live duration, continuous aim, and repeated line damage, so overloading the swing clock would create two meanings for its timing fields. `packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`.

## Ground truth in the current implementation

Guns and casters converge on the same projectile pipeline today. A gun spends `charges`, fires on `gun.fireRate`, and enters `reloadSeconds` when its magazine reaches zero; a caster calls `fireCast` on a flat `cast.cooldown` with no ammo. `packages/server/src/rooms/GameRoom.ts:1928-1961`, `packages/server/src/rooms/GameRoom.ts:1975-1981`. `fireGun` and `fireCast` both calculate a shared barrel-tip origin with `gunMuzzleReach`, then create friendly `ProjectileState` rows through `fireProjectile`. `packages/server/src/rooms/GameRoom.ts:2939-3001`, `packages/server/src/rooms/GameRoom.ts:3012-3047`, `packages/shared/src/weapons.ts:275-290`.

Those projectile rows carry position, velocity, kind, allegiance, and explosion radius; the client dead-reckons their velocity between 20 Hz snapshots. `packages/shared/src/state.ts:233-254`, `packages/client/src/scenes/ArenaScene.ts:4057-4062`. On the server, friendly projectiles broad-phase through `enemyGrid.queryRadius`, exact-test circle overlap, and route successful hits through the common `damageEnemy` primitive. `packages/server/src/rooms/GameRoom.ts:3832-3858`. That primitive owns crit, Brand, dummy reset, kills, XP, boss/drop, and portal bookkeeping, so beam damage must call it rather than duplicate any of that logic. `packages/server/src/rooms/GameRoom.ts:3120-3137`.

The current input protocol is insufficient for a channel. `attack` is a short buffer refreshed by discrete messages, while the client sends it only when its local cooldown opens; release is represented only by the absence of a later message. `packages/server/src/rooms/GameRoom.ts:592-625`, `packages/client/src/scenes/ArenaScene.ts:5620-5639`, `packages/client/src/scenes/ArenaScene.ts:5791-5802`. By contrast, movement already has a bounded, monotonic, sequence-numbered 50 ms command stream, server acknowledgement, and newest-command consumption. `packages/server/src/rooms/GameRoom.ts:234-257`, `packages/server/src/rooms/GameRoom.ts:564-588`, `packages/server/src/rooms/GameRoom.ts:1677-1702`. Beam hold, release, and aim belong on that stream.

Boss beams establish useful conventions but are not the player implementation. Shared boss data already defines rect/arc-sweep telegraphs and an active beam with duration, DPS, origin, length, half-width, start angle, and end angle. `packages/shared/src/boss-primitives.ts:26-35`, `packages/shared/src/boss-primitives.ts:90-108`. `beamSweep` creates a fixed rect windup and a live rotating hazard, and `BossController` updates its telegraph geometry and applies per-step damage. `packages/shared/src/boss-primitives.ts:416-458`, `packages/server/src/rooms/BossController.ts:230-240`. Player beams should reuse the windup/live/release discipline, but not hostile `TelegraphState`: those rows encode danger/parry language and boss teardown deletes non-melee telegraphs. `packages/shared/src/state.ts:171-205`, `packages/server/src/rooms/GameRoom.ts:2536-2549`.

The WYSIWYG precedent is strong. The game-feel audit identifies the rendered-self/authoritative-body offset as a direct slash-versus-hitbox failure and prescribes owner prediction with reconciliation. `docs/GAMEFEEL_AUDIT.md:93-96`. Shared gun muzzle reach exists specifically so server spawn and client flash coincide, shared melee reach floors damage reach at the rendered tip, and projectile explosion radius is explicitly replicated for exact-size rendering. `packages/shared/src/weapons.ts:275-305`, `packages/shared/src/state.ts:251-253`. Therefore beam width and endpoints must be gameplay geometry first and VFX inputs second; decorative bloom may soften the edge, but a stable visible boundary must mark the actual damage capsule.

## Shared weapon contract

Add this sibling block to `WeaponDef`, beside the existing `cast` and `gun` blocks at `packages/shared/src/weapons.ts:165-231`:

```ts
beam?: {
  /** Damage represented by one authored tick; server normalizes it over fixed dt. */
  damage: number;
  /** Beam line from muzzle to this distance, px. */
  range: number;
  /** Gameplay and visible half-thickness, px. */
  halfWidth: number;
  /** Authored damage quantum, sec; DPS = damage / tickRate. */
  tickRate: number;
  chargeSeconds: number;
  channelSeconds: number;
  releaseSeconds: number;
  /** Post-release lockout. */
  cooldown: number;
  /** Maximum authoritative aim rotation, radians/sec. */
  turnRate: number;
  scalingGrades?: Partial<Record<Attr, Grade>>;
  /** Present only for gun-fed beams; one ammo is consumed per authored tick. */
  magazine?: number;
  reloadSeconds?: number;
};
```

The strict invariant is `magazine` and `reloadSeconds` are either both absent or both present. Caster/staff beams omit them; gun beams use the existing `charges/maxCharges` HUD and reload path. The existing wire fields are numeric and already serve gun/thrown resources. `packages/shared/src/state.ts:71-73`, `packages/server/src/rooms/GameRoom.ts:1928-1940`.

Define `damage` as damage per `tickRate`, but apply `damage * dt / tickRate` to every enemy touched in each fixed step. This preserves the placeholder tracer's nominal DPS while making contact continuous and independent of whether `tickRate` is an exact multiple of the 50 ms simulation step. The server is fixed at 20 Hz and carries exact 50 ms substeps through timer jitter. `packages/shared/src/constants.ts:15-18`, `packages/server/src/rooms/GameRoom.ts:1653-1674`.

Use data defaults only as an initial migration policy, clearly marked tuning rather than engine constants:

- `halfWidth`: S/M/L/XL = 18/24/32/42 px.
- `chargeSeconds`: 0.45.
- `channelSeconds`: 1.50.
- `releaseSeconds`: 0.16.
- `cooldown`: the concept's existing `stats.cooldown`.
- `turnRate`: 7 rad/s.
- Caster concepts: no magazine; future ranged/gun beam concepts must author `magazine` and `reloadSeconds` explicitly.

Set beam tags to `delivery: "beam"` and `fireMode: "hold"`. Keep `classPool` unchanged, so a staff remains caster and a beam gun remains ranged; class-set logic reads `tags.classPool`, not the delivery block. `packages/shared/src/weapons.ts:232-240`, `packages/shared/src/weapons.ts:307-315`.

Add beam handling to shared consumers. `weaponDamageSources` currently branches through gun/thrown/default and would otherwise report the irrelevant edge hit; add a `beam tick` source using `beam.damage` and its grades. `packages/shared/src/weapons.ts:426-491`. `effectivePower` currently models gun cadence, magazine downtime, and gun/thrown reach; add `beam.damage / beam.tickRate`, channel duty cycle, optional magazine reload downtime, and `beam.range`. `packages/shared/src/loot.ts:149-175`.

## Input and authoritative state machine

Extend both client `PredCmd` and server `InputCmd` with `fireHeld`, `aimX`, `aimY`, `targetX`, and `targetY`. The client already mints one command per elapsed `TICK_MS`, sends the same command it predicts, and caps catch-up at three commands per frame. `packages/client/src/net/prediction.ts:44-50`, `packages/client/src/net/prediction.ts:213-225`, `packages/client/src/scenes/ArenaScene.ts:7609-7633`. Validate every new numeric field exactly as the current handler validates `seq/dx/dy`; normalize aim server-side and treat non-finite targets as absent. The current attack handler demonstrates both normalization and cursor-point fallback. `packages/server/src/rooms/GameRoom.ts:557-588`, `packages/server/src/rooms/GameRoom.ts:604-625`.

Keep the existing `attack` message for tap/cadence weapons. When the equipped definition has `beam`, `sendAttack` must not create a swing, gun flash, cast flash, or attack RPC; it delegates entirely to the held state on input commands. Without this explicit branch, the current `!weapon.gun` condition would predict a melee swing for a beam. `packages/client/src/scenes/ArenaScene.ts:5640-5653`, `packages/client/src/scenes/ArenaScene.ts:5712-5764`.

Put the complete server-only runtime in `CombatState`, whose existing purpose is per-player unsynced combat/auxiliary state. `packages/server/src/rooms/GameRoom.ts:259-313`. Add:

```ts
beamPhase: 0 | 1 | 2 | 3; // idle, charge, sustain, release
beamPhaseT: number;
beamChannelT: number;
beamAngle: number;
beamPrevAngle: number;
beamPrevX: number;
beamPrevY: number;
beamStartSeq: number;
beamAmmoAcc: number;
beamReleaseGeneration: number;
beamHitIds: Set<string>; // allocated once; cleared and reused each tick
beamTeleportSeq: number;
```

The transition contract is:

1. **Idle → charge.** Accept only when outcome is active, player is alive, no level window is open, the equipped weapon is unchanged, cooldown/reload is clear, and optional ammo is nonzero. Capture the consumed input `seq`, initialize the authoritative angle from the validated cursor target, create the replicated row, and set intensity to zero. The room already computes the same `acting` gate for attacks. `packages/server/src/rooms/GameRoom.ts:1908-1909`, `packages/server/src/rooms/GameRoom.ts:1926-1946`.

2. **Charge.** While `fireHeld`, advance `beamPhaseT`, apply the shared turn-rate clamp toward the newest validated aim, and publish charge intensity `phaseT / chargeSeconds`. Charge has no damaging line. Releasing early cancels with a short 0.10 s retrigger guard; swapping, downing, entering a level window, teleporting, or leaving the active outcome cancels immediately.

3. **Ignite → sustain.** At the charge boundary, set phase to sustain, reset `beamChannelT`, make the row's full length and half-width live, and run the first swept-line step. Continue while held, within `channelSeconds`, and with optional ammo. Accumulate gun-beam ammo at `dt / tickRate`, decrement one integer charge whenever the accumulator crosses one, and enter reload on empty. This matches the authored tick economy without introducing fractional HUD ammo.

4. **Sustain → release.** Release on button-up, maximum channel time, resource exhaustion, or any invalid acting condition. Stop damage immediately, set the post-release cooldown, and keep phase 3 replicated for `releaseSeconds`. A weapon swap/death/terminal reset is a cancellation and may remove immediately; ordinary release gets a visible tail.

5. **Release → idle.** Remove the replicated row only after it has survived at least one broadcast generation in release. The room batches up to three fixed substeps before one patch, so deleting a row in the same batch that created or changed it could make a short phase unobservable. `packages/server/src/rooms/GameRoom.ts:1653-1674`. The existing telegraph client likewise distinguishes completed rows by observing a full state before removal. `packages/client/src/scenes/ArenaScene.ts:3660-3683`.

On weapon change, reset beam state alongside the existing cooldown/reload/buffer reset and initialize `charges` from `beam.magazine` when present. `packages/server/src/rooms/GameRoom.ts:1928-1940`. Add beam teardown to `clearTransients`/`clearCombatEntities`, and remove the owner's row on leave; run boundaries already centralize transient cleanup and terminal combat retirement. `packages/server/src/rooms/GameRoom.ts:1018-1049`, `packages/server/src/rooms/GameRoom.ts:1608-1611`.

## Per-tick swept-line query

Do not call the boss `damageBeamRect` path. It checks player points inside a single current rectangle and has no enemy-radius expansion or between-tick sweep. `packages/server/src/rooms/GameRoom.ts:2748-2772`. Player beams instead use the enemy grid and the shared capsule-distance test.

For each sustaining beam and fixed step:

1. Compute current muzzle origin `O1 = player position + aim * gunMuzzleReach(weapon)` and endpoint `E1 = O1 + aim * range`; retain the previous origin/angle as `O0/A0`. Guns and casts already use the shared reach at the authoritative body. `packages/server/src/rooms/GameRoom.ts:2973-2977`, `packages/server/src/rooms/GameRoom.ts:3021-3025`.

2. Wrap the angular delta to `[-π, π]`, clamp it to `beam.turnRate * dt`, and compute `travel = distance(O0,O1) + range * abs(deltaAngle)`. Set `samples = max(1, ceil(travel / (2 * halfWidth)))`. Cap at 16 only by reducing this tick's accepted angular delta enough to preserve that spacing; never keep the full delta and drop samples, which would reopen holes.

3. Interpolate origin and angle for samples `0..samples`. While doing so, accumulate an AABB over every sampled origin and endpoint, then expand all four sides by `halfWidth + MAX_ENEMY_RADIUS`.

4. Call `enemyGrid.queryAabb` once with the room's reusable `enemyCandidates` array. The grid indexes each enemy by its center, returns every center cell touched by an inclusive AABB without duplicates, and intentionally leaves exact geometry to the caller. `packages/server/src/rooms/SpatialGrid.ts:1-3`, `packages/server/src/rooms/SpatialGrid.ts:59-87`. The room already rebuilds that grid once per active substep and updates membership after enemy motion. `packages/server/src/rooms/GameRoom.ts:1430-1449`, `packages/server/src/rooms/GameRoom.ts:1703-1709`.

5. For each candidate still present in `state.enemies`, get its authored radius and test every sampled line with `bladeHitsCircle(sampleOrigin, sampleAngle, range, enemy, enemyRadius, halfWidth)`. That helper is exactly a point-to-segment distance against `enemyRadius + halfWidth`, including rounded origin/end caps. `packages/shared/src/melee.ts:773-815`.

6. Clear and reuse `beamHitIds`; add an enemy id on its first successful sample so it can be damaged at most once this fixed step. Apply `beam.damage * dt / beam.tickRate * heldDamageMult(...)` through `damageEnemy`, defer deletions until after candidate iteration, then grant accumulated XP through the existing path. Friendly projectile handling demonstrates that query → exact test → shared damage → deferred delete/XP order. `packages/server/src/rooms/GameRoom.ts:3832-3858`.

This tests the swept union of the visible capsule from the prior accepted aim to the current accepted aim. A fast aim change cannot jump over a small enemy, and movement of the muzzle is included as well as rotation. Cancel on a teleport-sequence change instead of sweeping across the teleport; `teleportSeq` already identifies every authoritative reposition for prediction. `packages/shared/src/state.ts:112-115`.

The broad phase is one query per beam per server tick, not one query per sample. Trigonometry is computed once per sample, not once per enemy. With four active beams, the hard bound is four AABB queries and at most 64 sampled capsules per 50 ms step; normal 7 rad/s steering at the proposed widths should use far fewer samples.

## Replication and schema discipline

Add a dedicated shared schema row:

```ts
export class BeamState extends Schema {
  @type("uint8") phase = 0;       // charge, sustain, release
  @type("uint32") startSeq = 0;   // accepted input command
  @type("number") originX = 0;
  @type("number") originY = 0;
  @type("number") angle = 0;
  @type("number") length = 0;
  @type("number") halfWidth = 0;
  @type("number") intensity = 0;  // clamped 0..1
}
```

Append `@type({ map: BeamState }) beams = new MapSchema<BeamState>()` as the final `ArenaState` field and key it by player id. Do not insert fields into `PlayerState` and do not reuse `TelegraphState`; a stable row avoids create/delete churn through charge/sustain/release and sends static length/width only when they change. Current schema policy requires append-only field order and a version bump for any synced `@type` change. `packages/shared/src/state.ts:256-265`, `packages/shared/src/state.ts:313-335`, `packages/shared/src/constants.ts:8-13`.

Bump `SCHEMA_VERSION` from 13 to 14 in the same implementation change. The client already compares the server value to its compiled constant on first state and reports a hard reload on mismatch. `packages/shared/src/constants.ts:8-18`, `packages/client/src/scenes/ArenaScene.ts:2505-2522`.

Sync the row even though some values are derivable. Deriving origin from a rendered rig would mix predicted/interpolated presentation with authoritative collision, and `aimDir` is currently updated only from attack messages. `packages/shared/src/state.ts:39-42`, `packages/server/src/rooms/GameRoom.ts:617-618`. At four rows, exact geometry is worth the small patch cost: during sustain only origin, angle, and intensity normally mutate; length and half-width remain static. This also gives spectator/replay code one unambiguous offensive footprint.

## Owner prediction and latency

Prediction is cosmetic; damage, crits, resource spend, kills, and phase acceptance remain server-only. The current gun path already predicts the owning player's flash/sound and suppresses the later authoritative duplicate, while projectile damage stays server-side. `packages/client/src/scenes/ArenaScene.ts:5719-5743`, `packages/client/src/scenes/ArenaScene.ts:3991-4022`.

Add a small `BeamPredictor` beside movement prediction:

- On local RMB down, enter predicted charge immediately using the next minted input sequence, current predicted body, current cursor, and the shared beam timing. No hit flash or damage number is predicted.
- On every 50 ms input command, run the same shared shortest-angle/turn-rate step used by the server and retain the command until `ackSeq` passes it. The existing player row already exposes the last consumed input sequence. `packages/shared/src/state.ts:100-115`.
- When the authoritative row arrives, match `startSeq`, rebase on its phase/origin/angle/intensity, then replay pending aim commands. This is the beam equivalent of movement's acknowledged rebase, not a free-running local clock.
- On rejection (dead, frozen, swap, cooldown, no ammo), fade the predicted charge in 80 ms. On button-up, predict release immediately; reconcile if the server's release arrives later.
- Remote beams use replicated rows only. Interpolate angle over one patch interval for smoothness, but never extrapolate past the authored `turnRate`.

Do not add client timestamps, rewind enemies, or lag-compensate damage. The reliable sequence stream tells the server which intent it consumed, and the swept previous/current line prevents between-command tunneling. The owner feels an immediate locally replayed beam, while the authoritative row bounds and corrects it.

## Client rendering and paper-doll pose

Create a `BeamRenderer` with a fixed pool of four entries keyed by `ownerId:startSeq`. Each entry owns two additive Phaser Ropes and lightweight phase state; one shared Graphics/Mesh pass draws all exact quads. The existing PER renderer already pools 4/8/12-point arrays, additive Ropes, texture/UV patching, width scaling, body/lip strips, and two Rope objects per surface. `packages/client/src/vfx/vfx-render.js:183-241`, `packages/client/src/vfx/vfx-render.js:478-555`, `packages/client/src/vfx/vfx-render.js:1016-1034`.

Factor `makePerRope`, `preparePerRope`, vertex writing, and a new `updateLinearRope` into a reusable PER helper consumed by both `VfxPlayer` and `BeamRenderer`; do not copy a second Rope implementation. `updateRadialRope` shows the existing straight radial point mutation pattern, though its melee-specific 45%-reach trimming must not be used for a full beam. `packages/client/src/vfx/vfx-render.js:296-327`. Use 12 points for the local hero beam when budget allows, 8 for remotes, and 4 only as pressure fallback, matching the current PER quality vocabulary. `packages/client/src/vfx/VfxPlayer.ts:219-240`, `packages/client/src/vfx/VfxPlayer.ts:366-370`.

Render sustain back-to-front:

1. A dark procedural under-quad/capsule exactly `2 * halfWidth` wide, giving the gameplay edge a readable silhouette.
2. An element-coloured quad at roughly 80% width.
3. A narrow white/hot core quad.
4. A painted `ptcl:<element>-wisp` Rope inside the colour band and a narrower `ptcl:<element>-bolt` Rope as the moving lip.
5. A rounded muzzle cap and endpoint cap whose radius is `halfWidth`.

Keep Rope normal-wobble inside the authoritative half-width and seed it from `ownerId:startSeq`, so frame-rate and packet timing do not change the silhouette. Bloom may extend optically outside the dark edge, but particles must not form a second line that appears damaging. The existing live VFX path preloads element wisp/bolt sheets and uses one shared bloom root. `packages/client/src/vfx/VfxPlayer.ts:67-84`, `packages/client/src/vfx/VfxPlayer.ts:242-279`, `packages/client/src/vfx/VfxPlayer.ts:288-302`.

Drive visuals as an edge-triggered state machine keyed by replicated phase and sequence:

- **Charge:** no line footprint; draw an inward-spinning muzzle ring/orb, lift the hands into a brace, and raise pitch/brightness with authoritative intensity.
- **Ignite:** instantiate the full quads/Ropes on the sustain edge, fire one muzzle shock ring, and allow one selected painted component.
- **Sustain:** update pooled points/quads every render frame from predicted owner geometry or the remote replicated row; emit a few low-rate sparks constrained to the line and endpoint.
- **Release:** stop gameplay immediately, collapse the Rope toward the muzzle over `releaseSeconds`, fade the quads, emit one ring, and return the entry to the pool.

Use the painted library as accents, not as a continuously replayed full pack. The composer has twelve packs; holy-smite's audited core index 2 is an additive pillar, while storm-call exposes an additive flash and three bolt islands. `packages/client/src/vfx/fx-composer.ts:17-46`, `packages/client/src/vfx/fx-composer.ts:95-101`, `packages/client/src/vfx/fx-composer.ts:115-119`. Rotate/scale the holy pillar as a one-frame ignite core for holy beams, and place a storm bolt island at ignite or an occasional endpoint crackle for shock beams. `playFxPack` creates independently tweened, self-destroying component images and is capped to ten pack plays per frame, so replaying it every sustain frame would churn objects and consume the shared contact budget. `packages/client/src/vfx/fx-composer.ts:183-205`, `packages/client/src/vfx/fx-composer.ts:238-380`.

No new raster render is needed: every persistent beam layer above is procedural or uses the already-loaded painted PER/particle/component assets.

Use the particle manifest for charge motes/sparks and the existing element impact flipbook only on an authoritative damage event or aggregated hit cadence, never once per rendered frame. The manifest is generated from equal-cell painted sheets and contains the existing element packs. `packages/client/src/vfx/particle-manifest.ts:1-17`, `packages/client/src/vfx/particle-manifest.ts:100-107`. The impact system defines eight elements and six-frame strips. `packages/client/src/scenes/arena/vfx.ts:21-34`, `packages/client/src/scenes/arena/vfx.ts:359-424`.

Paper-doll work is required for both guns and staves. `SpriteRig.equipWeapon` mounts art at the authored grip and retains the weapon definition. `packages/client/src/entities/SpriteRig.ts:1033-1073`. Add `setBeamChannel(phase, intensity, aim)` and treat `weaponDef.beam` as an aim-owned pose beside the existing gun branch; currently only guns force remote facing and barrel orientation from synced aim. `packages/client/src/entities/SpriteRig.ts:2203-2215`, `packages/client/src/entities/SpriteRig.ts:2454-2466`. Add `getWeaponMuzzle(out)` using the actual mounted image transform, modeled on the existing world-space implement-anchor helper, and use it for the predicted owner's cosmetic origin. `packages/client/src/entities/SpriteRig.ts:1251-1278`. The replicated row remains the remote/exact geometry source.

## Four-beam performance budget

Set explicit budgets rather than relying on general scene pressure:

- Four persistent renderer entries maximum; eight Rope objects total, all preallocated.
- One shared draw pass for the three procedural beam layers and caps.
- No per-frame Containers, Images, Tweens, arrays, or Sets during sustain.
- Quality 12/8/4 points for local/remote/pressure; mutate existing point objects and call `setDirty`.
- Server: one AABB query per active beam per fixed step, one reusable candidate array, no query per sweep sample.
- Client particles: at most four charge/sustain particles per beam per render frame and endpoint sparks capped at 10 Hz; pack components only on phase edges.
- Network: at most four stable rows; mutate only origin/angle/intensity/phase. No projectile rows are emitted for a beam.

The existing VFX surface pool is capped at twelve and already drops PER quality as active surface count rises, so beam entries should be a separate fixed pool sharing textures/bloom rather than stealing short-lived swing surfaces for an entire channel. `packages/client/src/vfx/VfxPlayer.ts:242-279`, `packages/client/src/vfx/VfxPlayer.ts:350-370`.

## Codegen migration for the 21 concepts

The concepts source contains 21 beam behaviors at `data/weapon-concepts-300.json:9688`, `data/weapon-concepts-300.json:9908`, `data/weapon-concepts-300.json:10200`, `data/weapon-concepts-300.json:10469`, `data/weapon-concepts-300.json:10598`, `data/weapon-concepts-300.json:10785`, `data/weapon-concepts-300.json:10920`, `data/weapon-concepts-300.json:11046`, `data/weapon-concepts-300.json:11178`, `data/weapon-concepts-300.json:11361`, `data/weapon-concepts-300.json:11623`, `data/weapon-concepts-300.json:11795`, `data/weapon-concepts-300.json:11963`, `data/weapon-concepts-300.json:12090`, `data/weapon-concepts-300.json:12212`, `data/weapon-concepts-300.json:12387`, `data/weapon-concepts-300.json:12755`, `data/weapon-concepts-300.json:12934`, `data/weapon-concepts-300.json:13446`, `data/weapon-concepts-300.json:13532`, and `data/weapon-concepts-300.json:13711`. They author `damage`, `range`, and `tickRate`; the first and last examples show that shape directly. `data/weapon-concepts-300.json:9687-9692`, `data/weapon-concepts-300.json:13710-13715`.

The generator currently makes `kind === "beam"` satisfy `isGun`, tags it as projectile/auto, maps `tickRate` to `gun.fireRate`, and supplies a 1200 px/s tracer, 30-round magazine, spark muzzle, and recoil. `tools/artkit/gen-weapon-expansion.mjs:144-188`, `tools/artkit/gen-weapon-expansion.mjs:195-227`. The generated output confirms that placeholder for both the first and last beam examples. `packages/shared/src/weapons-expansion.generated.ts:8797-8837`, `packages/shared/src/weapons-expansion.generated.ts:12538-12580`.

Change the generator in this order:

1. Replace the beam whitelist's gun fields with exactly `kind`, `damage`, `range`, `tickRate`, `halfWidth`, `chargeSeconds`, `channelSeconds`, `releaseSeconds`, `cooldown`, `turnRate`, `magazine`, `reloadSeconds`, and `scalingGrades`. Unknown keys must continue to fail; strict mode currently aborts for unknown/sibling/enum errors and permits only counted numeric clamping. `tools/artkit/gen-weapon-expansion.mjs:6-10`, `tools/artkit/gen-weapon-expansion.mjs:41-89`.

2. Split `isBeam = kind === "beam"` from `isGun = kind === "gun" || (!isBeam && type === "ranged")`. Compute beam tags as `delivery: "beam"`, `fireMode: "hold"` before the generic ranged/gun rule.

3. Branch `if (isBeam)` before `if (isGun)` and emit `def.beam`, never `def.gun`. Map the three already-authored fields exactly; use the documented size/timing defaults for missing migration fields. For a caster, omit magazine/reload. For a future ranged beam, fail unless both resource fields are authored, so a gun/staff distinction is intentional rather than inferred into hidden defaults.

4. Preserve `scalingGrades` on the beam source, because the server's existing source multiplier accepts per-source grades and falls back to the weapon grades. `packages/shared/src/weapons.ts:363-375`.

5. Regenerate `packages/shared/src/weapons-expansion.generated.ts`; never hand-edit it. The generator reads the JSON source and writes that typed module, and aborts before emission if validation accumulated errors. `tools/artkit/gen-weapon-expansion.mjs:18-21`, `tools/artkit/gen-weapon-expansion.mjs:282-314`.

6. Rewrite the independent field-level test so beam concepts require `def.beam`, reject `def.gun`, compare every authored/defaulted beam field, and no longer assert `tickRate → gun.fireRate`. The current test deliberately re-derives mappings independently, but its beam branch currently enshrines the placeholder. `tests/data-consistency.test.ts:91-99`, `tests/data-consistency.test.ts:164-187`. Keep the existing JSON/generated bijection guard. `tests/data-consistency.test.ts:62-80`.

## Build order and verification gates

1. **Shared contract and pure geometry.** Add `BeamDef`, shared phase/turn helpers, beam damage-source/power handling, and pure tests for shortest-angle clamping plus sampled swept-capsule coverage. Extend the existing segment/capsule helper rather than creating server-only geometry. `packages/shared/src/melee.ts:773-815`.

2. **Codegen migration.** Update strict whitelists/mapping/tests, regenerate, and prove all 21 definitions have `beam` and no `gun`. This makes the data usable before runtime branches are added. `tools/artkit/gen-weapon-expansion.mjs:37-63`, `tests/data-consistency.test.ts:132-187`.

3. **Input protocol and private server runtime.** Extend the acknowledged command shape, initialize/reset new `CombatState` fields, and add the charge/sustain/release machine before adding damage. Add adversarial input tests beside the existing replay, malformed-input, queue-bound, and wrap tests. `packages/server/src/rooms/GameRoom.test.ts:936-1020`.

4. **Authoritative line damage.** Add the single-query swept AABB path, exact capsule samples, shared damage routing, ammo/reload, and teardown. Spatial-grid tests already cover inclusive boundaries, conservative supersets, stable reuse, and duplicate prevention. `packages/server/src/rooms/SpatialGrid.test.ts:4-59`.

5. **Schema and replication.** Add the row/map last, bump schema 13→14, and test row lifecycle across batching: charge observable, sustain observable, ordinary release observable for one generation, cancellation removed, no orphan after leave/reset/outcome. `packages/shared/src/state.ts:256-265`, `packages/server/src/rooms/GameRoom.ts:1653-1674`.

6. **Rig and renderer.** Add the beam aim pose/muzzle anchor, PER linear Rope helper, four-entry pool, exact quads, and phase-edge ingredients. Test with procedural fallbacks and missing optional textures; the FX loader is deliberately tolerant of missing pack assets. `packages/client/src/vfx/fx-composer.ts:149-174`.

7. **Owner prediction.** Move beam hold/aim onto input commands, bypass `sendAttack`, reconcile by `startSeq/ackSeq`, and verify no predicted damage or double ignite. Retain the current data-only patch callback rule: patches update samples, render update moves visuals. `packages/client/src/scenes/ArenaScene.ts:2531-2537`.

8. **Balance and soak.** Tune charge/channel/release, width, turn rate, sound, camera response, and particle cadence only after correctness and four-beam profiling. The 21 migrated concepts retain their existing nominal tracer DPS because `damage / tickRate` is unchanged.

Required server cases before enabling the roster:

- Charge deals zero damage; sustain begins on the exact accepted boundary.
- A target on either rounded edge at `enemyRadius + halfWidth` hits; one just outside misses.
- Rotation and origin movement between two 20 Hz samples cannot tunnel over a small target.
- One enemy intersecting multiple sweep samples receives only one fixed-step damage contribution.
- Continuous raw damage over one second equals `damage / tickRate` before scaling.
- Release, early cancel, swap, down, level window, teleport, leave, restart, training toggle, victory, and defeat leave no damage machine or replicated row.
- Caster beams never touch charges; gun beams drain/reload and stop at zero.
- Two players can channel independently; four concurrent beams stay within the query/render/network budgets.
- Beam kills use the same dummy, crit, Brand, XP, boss, drop, and portal behavior as projectiles through `damageEnemy`. `packages/server/src/rooms/GameRoom.ts:3120-3178`.

The resulting weapon is genuinely a sustained beam: it charges, ignites once, remains thick and continuous, sweeps under a bounded authoritative aim clock, damages the swept visible line every fixed step, releases cleanly, and uses only the existing painted library plus procedural geometry.
