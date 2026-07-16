# Beam Weapons — Devil's Advocate

## Decision: conditional veto

I oppose the feature as pitched if “Goku-style” means a freely snapping, screen-length, indefinitely sustained beam that follows the owner’s live cursor. That version is fatal to Dimension Drifters: it converts positioning into aiming, turns horde density into free multiplicative DPS, and makes the loudest player own everybody’s view.

I would accept a narrower version: a rare, high-commitment line weapon with a visible charge, a short heat-limited channel, heavy aim inertia, a hard range/width ceiling, and one server-owned damage ribbon. It must create a vulnerability window and a direction-of-commitment, not a portable screen eraser. If those constraints are rejected, keep the tracer placeholder or ship a charged one-shot lance; do not ship a sustained beam.

## Steelman: why this is worth saving

The fantasy is unusually legible. “Brace, charge, release, steer” gives staves and guns an attack sentence that neither a bolt nor an automatic weapon has. In co-op, a bounded beam can create a real role: one player commits to a lane while teammates peel, herd, or cover the flanks. That can reinforce dodging if the beam user becomes less mobile and must choose a lane; it only inverts the genre when it stays available long enough to replace movement.

The repository already proves the right *shape* of implementation. Boss beams are not projectile impostors: a cast plan creates a rectangular warning, promotes it to a live hazard after windup, advances its angle, applies `dps × stepDt`, and removes it at the end. The primitive carries duration, DPS, origin, length, half-width, and start/end rotation. `packages/shared/src/boss-primitives.ts:90-107`, `packages/shared/src/boss-primitives.ts:416-458`, `packages/server/src/rooms/BossController.ts:180-216`, `packages/server/src/rooms/BossController.ts:220-240`

There is also enough installed art to build the presentation without another render. The runtime registers 12 component packs; `holy-smite` explicitly identifies component 2 as the pillar, while `storm-call` supplies an additive flash, three hot components, cloud/rain, and wind swirls. The particle manifest contains 96 painted element/shape packs, and the impact system exposes eight six-frame element strips. These are good charge-knot, corona, filament, endpoint, and release ingredients—not a license to stamp a whole impact pack every server tick. `packages/client/src/vfx/fx-composer.ts:17-46`, `packages/client/src/vfx/fx-composer.ts:95-101`, `packages/client/src/vfx/fx-composer.ts:115-119`, `packages/client/src/vfx/particle-manifest.ts:9-107`, `packages/client/src/scenes/arena/vfx.ts:21-34`, `packages/client/src/scenes/arena/vfx.ts:363-370`

Finally, replacing the placeholder can reduce churn at runtime. Today a generated beam becomes a 10 Hz tracer gun with a 30-round magazine by default, and friendly player projectiles are deliberately uncapped. One channel row plus bounded endpoint particles is potentially cheaper and quieter than emitting another projectile every 0.1 seconds per beam user. `tools/artkit/gen-weapon-expansion.mjs:195-212`, `packages/server/src/rooms/GameRoom.ts:2882-2928`

## What exists today—and what does not

Player delivery is mutually exclusive and event-like. Guns spend one magazine charge, call `fireGun`, accumulate `fireRate`, and reload on empty. Casters call `fireCast` once and take a flat cast cooldown with no ammo. Both ultimately spawn moving projectiles from the shared muzzle origin. `packages/server/src/rooms/GameRoom.ts:1926-1982`, `packages/server/src/rooms/GameRoom.ts:2939-3010`, `packages/server/src/rooms/GameRoom.ts:3012-3048`

The shared `WeaponDef` has `cast` and `gun` blocks but no beam block. `cast` describes a moving bolt; `gun` describes projectile speed, range, fire rate, magazine, reload, bullet kind, and recoil. `packages/shared/src/weapons.ts:165-230`

The wire projectile is only a point, velocity, kind, side, and explosion radius. The server advances that point, blocks it on arena/POI cover, and damages by projectile-circle overlap and a finite pierce count; the client dead-reckons the same point along its velocity. A sustained segment with owner, phase, width, range, heat, and live angle cannot be represented honestly as another `ProjectileState.kind`. `packages/shared/src/state.ts:239-253`, `packages/server/src/rooms/GameRoom.ts:3740-3798`, `packages/server/src/rooms/GameRoom.ts:3832-3860`, `packages/client/src/scenes/ArenaScene.ts:4057-4082`

The boss path is useful precedent, not reusable player-beam state. Its beam aim is captured once, converted to `rot0`/`rotEnd`, and then sampled at one angle per simulation step. Its hit primitive tests a player *center point* against an oriented rectangle. Player beams need a live owner, aim input, enemy-radius-aware contact, heat, cancellation, source scaling, kill/XP routing, and cover truncation. Copying the boss rectangle straight into friendly damage would be a false shortcut. `packages/shared/src/boss-primitives.ts:374-392`, `packages/shared/src/boss-primitives.ts:419-455`, `packages/server/src/rooms/BossController.ts:229-240`, `packages/server/src/rooms/GameRoom.ts:2748-2772`

The paper-doll rig is not the blocker. It already mounts one- and two-handed painted parts at their authored grip and has a gun branch that points the barrel at the local live aim or remote synced `aimDir`. The gap is a beam-specific charge/channel brace and remote beam ownership, not new weapon art. `packages/client/src/entities/SpriteRig.ts:1033-1117`, `packages/client/src/entities/SpriteRig.ts:2203-2225`, `packages/client/src/entities/SpriteRig.ts:2454-2466`

There is adjacent input debt that must not be copied. The client sends held-RMB attacks only when its local cooldown expires and chooses `gun.fireRate` or the weapon’s base `cooldown`; the server updates combat aim when an `attack` message arrives and gates casters with `cast.cooldown`. A beam needs a held-state lifecycle and aim samples on the fixed command stream, not repeated “fire” RPCs pretending to be a channel. The existing movement command loop already runs every 50 ms, but its minted command currently carries movement and jump rather than beam held/aim state. `packages/client/src/scenes/ArenaScene.ts:5620-5644`, `packages/client/src/scenes/ArenaScene.ts:5745-5763`, `packages/server/src/rooms/GameRoom.ts:592-627`, `packages/server/src/rooms/GameRoom.ts:1975-1980`, `packages/client/src/scenes/ArenaScene.ts:7609-7632`

## Risk ruling

| Attack | Ruling | Why | Acceptance bar |
|---|---|---|---|
| Genre inversion | **Fatal as proposed** | A long-duty-cycle hitscan lane lets aim replace pathing and converts a horde into a stationary damage opportunity. | The user must pay with charge time, mobility, turn speed, heat, and recovery. The beam is a commitment window, not the default neutral game. |
| Owner sweep versus authority | **Fatal if naive** | The authoritative sim is 20 Hz/50 ms, while the owner’s cursor and rig update at render rate. Current attack aim changes only on attack messages. `packages/shared/src/constants.ts:16-18`, `packages/client/src/scenes/ArenaScene.ts:5524-5565`, `packages/server/src/rooms/GameRoom.ts:592-627`, `packages/server/src/rooms/GameRoom.ts:1653-1677` | One server-owned angle and phase; bounded turn rate; fixed-step aim samples; swept collision between accepted angles; render the same short swept ribbon. Never draw a damaging core straight to unsent local aim. |
| “Reuse boss beam” | **Manageable, but dangerous** | Boss code supplies windup→active timing and `dps × dt`, but its sweep is predetermined and its rectangle tests player centers at one current angle. `packages/shared/src/boss-primitives.ts:416-458`, `packages/server/src/rooms/BossController.ts:220-240`, `packages/server/src/rooms/GameRoom.ts:2759-2764` | Reuse the concepts and pure geometry helpers; create a player-owned channel state and enemy damage path. Do not put friendly beams in the boss controller or telegraph map. |
| 20 Hz presentation | **Fatal if left stair-stepped** | Live telegraph geometry is rebuilt directly when synced `rot` changes; there is no generic angle interpolation in that path. The gamefeel audit already classifies 20 fps timing tells as a defect. `packages/client/src/scenes/ArenaScene.ts:3572-3594`, `packages/client/src/scenes/ArenaScene.ts:3624-3635`, `docs/GAMEFEEL_AUDIT.md:60-64` | Interpolate only inside the server-accepted angular interval and show the previous-to-current swept ribbon for the same 50 ms in which it can deal damage. |
| Near-hitscan versus projectile economy | **Fatal without a new budget law** | Bullets pay travel time, collision opportunity, cover, pierce, and ammo; a line would otherwise hit every intersected enemy every tick. Current projectile logic explicitly enforces those costs. `packages/shared/src/weapons.ts:188-224`, `packages/server/src/rooms/GameRoom.ts:3740-3798`, `packages/server/src/rooms/GameRoom.ts:3832-3860` | DPS is time-normalized, cover truncates the visible beam, total per-step throughput is capped, and crit/proc frequency is rate-limited independently of the 20 Hz damage sampling. |
| Shared-screen noise | **Manageable** | The FX runtime already has a ten-pack-per-frame budget, and telegraph preludes cap persistent painted images and milestone particles. `packages/client/src/vfx/fx-composer.ts:149-174`, `packages/client/src/vfx/fx-composer.ts:183-204`, `packages/client/src/scenes/arena/vfx.ts:133-145` | Per beam: one gameplay core, one corona, one endpoint, at most six live motes/filaments. No continuous camera shake, no full composer pack per tick, no opaque off-element slab. |
| WYSIWYG | **Fatal if glow becomes geometry camouflage** | The project’s melee clock super-samples between 20 Hz ticks specifically so visible swept contact cannot fall through gaps, and its fixed VFX doctrine separates geometry from damage scaling. `packages/shared/src/melee.ts:6-28`, `packages/shared/src/weapons.ts:31-35` | The solid core edge is the hit edge; enemy radius participates in contact; the endpoint is the server-truncated endpoint; any outer bloom is faint, bounded, and never used to imply extra reach. |
| 21-concept migration | **Manageable** | Strict codegen currently whitelists beam as gun-shaped data and deliberately maps it to `def.gun`; generated expansion entries remain outside `WEAPON_IDS`. `tools/artkit/gen-weapon-expansion.mjs:31-68`, `tools/artkit/gen-weapon-expansion.mjs:144-160`, `tools/artkit/gen-weapon-expansion.mjs:195-228`, `packages/shared/src/weapons.ts:1257-1270` | Prove one vertical slice, then migrate source data and regenerate. Never hand-edit the generated TypeScript. |

## Accepted constraints

These are not suggested tuning values. They are the price of my “yes.”

### 1. Charge cost

- Minimum cold charge: **0.65 seconds** before any damage.
- During charge, movement is **55%** of normal. During the live channel, movement is **35%** of normal.
- Charge cannot be banked. Releasing early cancels it, adds **20 heat**, and imposes **0.35 seconds** of recovery.
- Parry cancels charge/channel and pays the same heat/recovery cost. It remains an escape decision, not a free animation cancel into uninterrupted DPS.
- No damage, hit-stop, camera shake, or thick line before ignition. Charge may show a muzzle knot, inward particles, a thin aim filament, and the braced paper-doll pose.

This should use a beam-specific immutable descriptor modeled after—not folded into—`SwingDescriptor`: one shared clock containing charge, live, and recovery boundaries. `SwingDescriptor` already demonstrates the correct doctrine: an immutable accepted/predicted epoch, explicit active boundaries, and geometry/damage kept separate. `packages/shared/src/melee.ts:387-389`, `packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`

### 2. Width, range, and sweep caps

- Default damaging core: **48 px full width**. Hard maximum: **64 px full width**.
- Default range: **520 px** from the shared muzzle point. Hard maximum: **640 px**.
- Outer bloom: at most **8 px per side**, low-alpha, with no solid painted edge. The core remains the unmistakable contract.
- Maximum server turn rate while live: **75°/second**. No snap turns, mouse flicks, 180° reversals, or aim assist that bypasses this rate.
- Collision must test the angular interval between the previous and new accepted angle, as melee already super-samples swept movement to prevent 20 Hz holes. The client must retain that same swept ribbon for one tick. `packages/shared/src/melee.ts:23-28`, `packages/shared/src/melee.ts:740-770`
- The beam stops visually and mechanically at blocking POI cover. It does not ricochet. Existing projectiles already establish that cover works both ways. `packages/server/src/rooms/GameRoom.ts:3772-3798`

Player beams do **not** inherit boss scale. Existing boss examples reach 1,000–1,500 px with 42–70 px half-width after roughly one second of windup; that is encounter-scale denial, not a player-weapon target. `packages/shared/src/bosses.ts:321-347`, `packages/shared/src/bosses.ts:788-805`

### 3. Overheat law

- Ignition deposits **25 heat**.
- Live channel adds **60 heat/second**.
- At **100 heat**, the beam shuts down authoritatively. A cold weapon therefore gets at most **1.25 seconds** of live beam.
- Voluntary release imposes **0.35 seconds** recovery. Forced overheat imposes **1.50 seconds** lockout.
- Cooling begins only after recovery, at **35 heat/second**. Heat does not cool while RMB remains held, during charge, or during a lockout.
- Re-ignition is forbidden above **35 heat**, and held input during lockout does not queue a free restart.
- Version one has one resource model: **heat**, for both staves and guns. Do not combine magazine/reload plus charge plus heat; gun/staff differences are pose, sound, element, scaling, and component recipe until the base system is proven.

### 4. Damage and horde law

- Author beam data as **DPS**, never “damage per tick.” Apply `dps × actual step duration`, the same stable law the boss active-hazard path uses. `packages/server/src/rooms/BossController.ts:229-239`
- Cap aggregate damage delivered by one beam step at **3× its single-target step damage**. Every intersected enemy receives damage, but the budget is shared once more than three targets are in the core. This preserves “what the core touches gets hurt” without letting density create unbounded output.
- Roll crit at most once per **0.25-second damage quantum**, not once per 20 Hz overlap check. On-hit procs get the same or a stricter internal cadence.
- Beam damage must route through the same enemy damage primitive as projectiles so boss logic, Brand, drops, XP, dummy reset, and death stay unified. The projectile path already centralizes that routing. `packages/server/src/rooms/GameRoom.ts:3842-3858`

### 5. Authority and presentation law

- Add one player-owned beam state with owner, phase, start tick, accepted angle, previous angle, range, half-width, heat, and element/style identifiers. Do not emit a train of fake projectiles.
- Put beam held/aim state on the fixed 50 ms command cadence. Start/cancel remains an edge; sustain is state. The existing action RPC is buffered fire intent, not a channel protocol. `packages/server/src/rooms/GameRoom.ts:592-627`, `packages/client/src/scenes/ArenaScene.ts:7609-7632`
- The solid damaging core always follows server-accepted geometry for owner and teammates. Local unsent aim may appear only as a thin non-damaging reticle/filament during charge.
- Reuse the shared muzzle calculation so the beam begins at the painted barrel/staff tip on client and server. `packages/shared/src/weapons.ts:275-290`
- Use procedural core/corona geometry continuously. Use painted storm components, the holy pillar, rings, motes, and the eight impact families only at charge milestones, ignition, contact endpoint, release, and overheat. The art is seasoning around the line, not a stretched hitbox substitute. `packages/client/src/vfx/fx-composer.ts:95-101`, `packages/client/src/vfx/fx-composer.ts:115-119`, `packages/client/src/vfx/particle-manifest.ts:9-107`, `packages/client/src/scenes/arena/vfx.ts:21-34`

## Migration ruling

Do not migrate 21 concepts in the feature branch’s first playable. The generator is intentionally strict: unknown keys fail, misplaced mechanic siblings fail, and any validation error aborts before writing. The source of truth is `data/weapon-concepts-300.json`; the generated TypeScript says not to edit it. `tools/artkit/gen-weapon-expansion.mjs:1-10`, `tools/artkit/gen-weapon-expansion.mjs:18-21`, `tools/artkit/gen-weapon-expansion.mjs:41-68`, `tools/artkit/gen-weapon-expansion.mjs:144-154`, `tools/artkit/gen-weapon-expansion.mjs:282-314`

The current 21-row inventory is real, but contained. Every row is marked `kind: "beam"`; representative authoring supplies damage, range, and tick rate, which codegen currently turns into projectile delivery, auto fire, tracer rounds, a default magazine, and reload. A representative source entry is `data/weapon-concepts-300.json:9687-9708`; its generated placeholder is `packages/shared/src/weapons-expansion.generated.ts:8797-8837`. The full 21 behavior rows are `data/weapon-concepts-300.json:9688`, `data/weapon-concepts-300.json:9908`, `data/weapon-concepts-300.json:10200`, `data/weapon-concepts-300.json:10469`, `data/weapon-concepts-300.json:10598`, `data/weapon-concepts-300.json:10785`, `data/weapon-concepts-300.json:10920`, `data/weapon-concepts-300.json:11046`, `data/weapon-concepts-300.json:11178`, `data/weapon-concepts-300.json:11361`, `data/weapon-concepts-300.json:11623`, `data/weapon-concepts-300.json:11795`, `data/weapon-concepts-300.json:11963`, `data/weapon-concepts-300.json:12090`, `data/weapon-concepts-300.json:12212`, `data/weapon-concepts-300.json:12387`, `data/weapon-concepts-300.json:12755`, `data/weapon-concepts-300.json:12934`, `data/weapon-concepts-300.json:13446`, `data/weapon-concepts-300.json:13532`, `data/weapon-concepts-300.json:13711`.

The safe sequence is:

1. Add a mutually exclusive `WeaponDef.beam` contract and strict generator keys for the accepted laws above.
2. Build one dev-only reference weapon—prefer the Mesa-Spine Thunder Stave because its concept already promises a steady forked storm lance—and validate charge, sweep, cover, co-op clutter, and heat before touching the rest. `data/weapon-concepts-300.json:11041-11063`
3. Keep every expansion beam out of the active roster during tuning; expansion entries are already filtered from `WEAPON_IDS`. `packages/shared/src/weapons.ts:266-269`, `packages/shared/src/weapons.ts:1264-1270`
4. After the reference passes, migrate the 20 remaining source rows into a small number of deliberate beam profiles, regenerate once, and require data-consistency plus server geometry tests. Do not preserve placeholder magazine/projectile fields merely to reduce diff size.

## Final position

The feature is not blocked by art, paper dolls, or the existence of 21 concepts. Those are manageable. The fatal risks are product and authority risks: unlimited duty cycle, encounter-scale reach, density-multiplying hitscan, and a local visual line that disagrees with the server line.

Approve the bounded channel above and it can become a high-drama commitment weapon that belongs in a bullet-heaven. Approve the unconstrained pitch and it becomes the game’s answer to every horde, every lane, and every teammate’s ability to read the screen. That is not a weapon addition; it is a genre replacement.
