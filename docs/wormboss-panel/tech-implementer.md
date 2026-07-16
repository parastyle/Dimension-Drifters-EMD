# Serraketh, the Seam-Eater — Technical Implementation Panel

Status: implementation specification  
Scope: one new flagship segmented-worm encounter; no replacement of Vastaghar  
Authority: 20 Hz server simulation, Colyseus state, client interpolation  
Encounter topology: 10 starting parts, 12-part hard cap, one authored temporary split

## 1. Decision

Build Serraketh as one boss owner with a dedicated fixed-capacity segment state, a server-side arc-length path solver, and one batched client WormRig.

Do not model each segment as an ordinary EnemyState. Do not reconstruct gameplay positions from only the head on the client. The server publishes each active segment center at a lower pose cadence while retaining full 20 Hz authority. This gives:

- honest per-part hurt geometry;
- deterministic sever, regrow, burrow, and temporary-split behavior;
- bounded bandwidth at the 12-part encounter cap;
- one interpolation timeline for the whole chain, so tail smoothing cannot compound head jitter;
- one boss health owner, reward owner, and progression event.

The starting topology is:

    HEAD — NECK — BODY — SPINNER — BODY — BODY — SPINNER — BODY — BODY — TAIL

That is 10 active parts: one head, one neck, five bodies, two spinners, and one tail. Two dormant Body slots permit authored regrowth without exceeding 12 active parts across the main chain and temporary stub.

The worm is a second flagship encounter, complementary to Vastaghar. It must not reuse Vastaghar progression, framing, or nuke moments except through existing generic boss and FX interfaces.

## 2. What the current code actually establishes

The implementation must preserve these existing contracts:

- BossController owns one EnemyState root, derives phase from root HP, runs deterministic modules, applies projectile/add budgets, and holds resolved telegraphs for the broadcast generation.
- BossController.test.ts uses a recording sink, fixed 0.05-second steps, and deterministic seeds. Those patterns are suitable for the worm director, but the current generic module scheduler is not sufficient for this encounter's authored topology transitions.
- boss-primitives.ts returns pure CastPlan data. World-titan footfall quakes, jumps, and parries are encounter behavior around a single boss center, not a multipart physics model.
- EnemyState contains one position and one HP value. ArenaState.enemies is a MapSchema of those roots.
- SpriteRig's Colossus partial body is a client-local Container assembled from body, hand, and foot sprites around one synchronized EnemyState position. It is important rendering precedent, but it does not synchronize independent parts.
- ArenaScene creates one SpriteRig and one SnapshotBuffer per EnemyState. Reusing that route for 10–12 worm pieces would multiply buffers, entity callbacks, map keys, and gameplay ownership.
- SnapshotBuffer is a typed-array ring of depth 8. Interpolation is linear, with 120 ms delay, bounded extrapolation, and a large-distance snap rule.
- SpatialGrid stores a center cell per inserted entity and returns a stable broad-phase superset for AABB or radius queries. Its 128 px cells work for ordinary enemies but a worm requires a dedicated segment broad phase and swept narrow phase.
- GameRoom has one bossId, one BossController, an enemyGrid, and centralized damageEnemy, reward, collision, and boss progression paths. Every damage source ultimately needs a worm-aware target route.
- The room is capped at 80 EnemyState rows, 48 XP Echo rows, 120 boss projectiles, and 12 boss adds. SCHEMA_VERSION is 15.

The new implementation should extend those contracts. It should not pretend the existing Colossus already solves networked multipart state.

## 3. Runtime ownership

Use three layers with explicit responsibilities.

### 3.1 BossController remains the room-facing owner

BossController continues to expose one boss lifecycle to GameRoom. Add an encounter discriminator to BossDef, such as encounter: "worm". Its step method delegates worm encounters to a WormEncounterDirector while leaving all existing bosses on the current module path.

BossController still owns:

- root/core HP and phase publication;
- one bossId and one terminal death;
- projectile and add budgets;
- telegraph creation, cancellation, resolve retention, and broadcast-generation guarantees;
- the deterministic encounter seed.

### 3.2 WormEncounterDirector owns authored combat

The generic independent module scheduler cannot safely express one major move, a scripted 70% split, a 45% regrowth check, emitter destruction, burrow fairness, and a terminal 8% sequence. Add a dedicated deterministic director.

The director owns:

- encounter phases at 70%, 35%, and 8% core HP;
- one major action record at a time;
- explicitly declared additive spinner attacks;
- action sequence, emitter slot, emitter generation, and topology sequence;
- telegraph start, resolve, settle, cancel, and end ticks;
- the one temporary split at the 70% transition;
- Graft Hunger once at 45%;
- terminal death choreography.

Every action record contains:

- action kind and action sequence;
- start, resolve, and end ticks;
- owner boss ID;
- emitter stable slot and generation;
- topology sequence captured when the cast starts;
- target player or committed world point when required;
- damage epoch and per-player hit ledger.

If the emitter no longer exists at resolve, or its generation or required topology differs, the director cancels the action. A canceled warning never reaches fully resolved coverage. A resolved warning remains visible through the same broadcast-generation contract already tested for BossController.

### 3.3 WormBossRuntime owns topology and motion

WormBossRuntime is server-private fixed-capacity data plus pure deterministic operations:

- fixed arrays for at most 12 segment slots;
- active, targetable, collidable, underground, and reward-paid bitsets;
- role, condition, armor band, generation, chain, ordinal, local integrity, and position arrays;
- one path-history ring per live chain;
- topology transaction queue;
- movement mode and committed path;
- split-stub expiry and reconnection state.

There are no per-tick allocations in the chain solver. Arrays and query scratch buffers are constructed when the boss spawns.

## 4. Server chain model at 20 Hz

### 4.1 Head steering

The main head is the only freely steered body point. The director selects a target or path objective; the runtime advances the head with a bounded speed and angular velocity at each 50 ms tick.

Steering must be deterministic from:

- encounter seed;
- server tick;
- action sequence;
- current head position and heading;
- committed target/path;
- current number of lost active anatomy pieces.

Each lost anatomy piece adds 4% surface speed, capped at 28%. Speed does not increase during a published wind-up. Capture the wind-up speed when the action begins and retain it until resolve or cancel.

Arena navigation must validate the head's next swept capsule against zone rules and encounter bounds. Commons, Cover, and Scar may influence route preference, but no attack is allowed to erase all legal escape space. Pits are invalid surface centers; burrow paths may cross below pits, but emergence centers must be valid solid arena positions.

### 4.2 Same-tick arc-length following

Do not solve each link from the predecessor's previous-tick position. That common spring-chain approach accumulates phase lag and amplifies jitter toward the tail.

Instead:

1. Advance the head for the current server tick.
2. Append its current position to a fixed path-history polyline with cumulative distance.
3. For each active segment in chain order, sample the same current polyline at its required distance behind the head.
4. Write all segment positions as one pose for that tick.
5. Resolve topology recovery and collision states after the complete pose is available.

For segment i, the target arc distance is the sum of the desired gaps between all preceding active anatomy pieces, not merely i multiplied by a global constant. Role-specific radii can therefore use:

    gap(a, b) = overlapFactor × (radius[a] + radius[b])

The overlap factor is tuned so connector art overlaps by 12–16% while hurt capsules do not leave projectile-sized holes. The runtime stores cumulative path distance in a fixed ring, walks it with a cached cursor, and linearly samples the bracketing edge. A 128-point history is sufficient only if its retained distance covers the longest 12-part topology plus one recovery margin; size it from maximum chain length and minimum per-tick head travel rather than accepting 128 blindly.

Seed the history behind the spawn heading before the first visible tick, so all 10 starting pieces begin at valid spacing. When a temporary stub is created, initialize its own path from the suffix's current centers and tangent. The split must not teleport either daughter endpoint.

### 4.3 Constraint and transition rules

Normal surface poses satisfy these invariants after each tick:

- active ordinals are dense within each chain;
- every active slot appears in exactly one chain;
- the head occupies main-chain ordinal zero;
- no temporary stub contains the persistent head;
- adjacent center distance is within a tuned chord-error band around its role gap;
- all values are finite and inside the encounter's allowed coordinate envelope;
- active count across main and stub never exceeds 12.

Curved path chord distance will be shorter than arc distance. Tests should establish a maximum curvature-dependent error rather than asserting exact Euclidean equality.

Destroying an ordinary interior Body or Spinner does not create an autonomous worm. The main chain compacts its ordinals and enters Reconnecting for 6–9 ticks. Followers advance along the stored path with a bounded catch-up rate; affected links are non-damaging and non-solid until their spacing settles. This avoids both teleporting hitboxes and a transient giant collision capsule.

The only second chain is the authored temporary stub described below.

## 5. Authoritative topology lifecycle

Topology changes are server events expressed as transactions over the fixed slot table. The schema carries the resulting state and a monotonically increasing topologySeq; gameplay never depends on a client event arriving once.

Each transaction:

1. collects all same-tick changes;
2. sorts them by stable slot;
3. increments topologySeq exactly once;
4. increments affected slot generations where a new incarnation is created;
5. updates active and changed masks;
6. recomputes chain and ordinal arrays;
7. cancels casts whose emitter identity is no longer valid;
8. emits at most one aggregate locked segment Echo for the transaction;
9. publishes one coherent topology state.

Stable slots are never reassigned to different anatomy roles during the encounter. A dormant Body slot may be activated by regrowth, and its generation increments. A slot's first-break reward bit never resets, so regrown generations cannot mint repeat XP.

### 5.1 Spawn

spawnBoss creates one normal root EnemyState for Serraketh and one WormBossState keyed to the same owner ID. WormBossRuntime activates the 10 authored slots, initializes their roles and integrity, seeds the path history, and publishes a single topology transaction before collision or targeting is enabled.

For the first 6 ticks after visibility, pieces may be targetable but are non-damaging and non-solid. The encounter starts only after every client-visible segment has had the normal interpolation lead time or an equivalent intro hold.

### 5.2 Destroy and sever

Damage first reduces a segment's local integrity. Local integrity destruction performs role-specific authored consequences:

- Body: remove the link, reconnect the main chain, and record its first-break reward.
- Spinner: remove the link and permanently remove its shard-fan/Rib Quake emission slot.
- Tail: remove Stitch-Reap and widen authored Closing Loop exits.
- Neck: crack armor but remain in the chain unless its encounter rule explicitly permits destruction.
- Head: persists for the encounter; armor state changes to exposed/critical rather than removing it.

All segment damage also contributes bounded core damage through the owner ledger described in section 8. A segment cannot die twice in one tick, and two sources that cross zero in the same tick still produce one topology transaction.

### 5.3 One scripted temporary split

At the 70% phase transition, one authored interior Body seam tears and forms a tailward temporary stub. This is the only autonomous split in version one; ordinary mid-chain destruction and recursive splitting are explicitly disallowed.

The stub:

- has no separate boss health bar and shares the Serraketh owner;
- lives for at most 8 seconds;
- may use only a simple Stitch-Reap or reduced fan;
- cannot burrow, form Closing Loop, regrow, or split;
- carries its own local integrity and same-tick path history;
- counts toward the shared 12-part active topology cap and room body budget.

For most of this transition, the main body is dormant or uses clearly non-damaging feints. If players destroy the stub, its parts tear into locked segment Echoes and the head receives a 1.2-second punish window. If the stub survives, it rejoins at a visibly marked seam without teleporting; its survival grants one extra eligible Body activation during Graft Hunger. Reconnection pieces receive at least 6 ticks, 300 ms, of non-damaging arm grace.

### 5.4 Graft Hunger regrowth

At 45% core HP, once per encounter, Graft Hunger runs for 5.5 seconds. It creates two regrowth buds in solo and three in co-op.

Bud rules:

- buds use fixed dormant slot state but are not yet chain members;
- they are registered as targetable worm-owned hurt shapes;
- they count against the effective room body budget;
- they do not heal the boss core;
- surviving buds activate dormant Body slots only;
- they never restore a Spinner or Tail;
- the resulting active topology remains at or below 12;
- activated slots increment generation and retain rewardPaid from any prior incarnation;
- newly activated links are non-damaging for at least 6 ticks and enter via an authored seam animation.

Resolve all bud outcomes in one topology transaction. If fewer eligible dormant slots exist than surviving buds, excess buds fail visibly and harmlessly rather than exceeding the cap.

### 5.5 Final destruction

Only root/core death ends the encounter, grants boss completion, drops terminal loot, opens progression, and plays the nuke-tier pack.

Death order:

1. disable every worm damage source and collision shape;
2. cancel unresolved attacks while retaining any already-resolved warning for its broadcast generation;
3. unlock stored segment Echoes in chain order;
4. run the paper-cutout void implosion at approximately 140 ms;
5. play the death-only nuke pack at approximately 360 ms;
6. emit final core reward and progression once;
7. remove worm state after the terminal presentation window.

Full paper-cutout tear treatments are capped at two during ordinary severing. The death sequence may use its own authored collapse treatment.

## 6. Schema and synchronization

### 6.1 Options considered

| Option | Advantages | Failure mode | Decision |
| --- | --- | --- | --- |
| One EnemyState per segment | Reuses current grid, snapshots, and damage calls superficially | Duplicates boss ownership, Map keys, callbacks, snapshot rings, rewards, and caps; awkward atomic topology | Reject |
| Head position plus client reconstruction | Smallest wire payload | Client hit geometry diverges on turns, topology recovery, split, and burrow; late joins cannot reconstruct retained path exactly | Reject for gameplay |
| Sparse path knots plus client sampling | Moderate payload and coherent chain | More schema and interpolation complexity; path error becomes collision error | Keep as a future optimization only |
| Dedicated WormBossState with per-active-slot centers | Honest collision/render agreement, atomic topology, bounded at 12 | Adds one schema and a batch renderer | Adopt |

Rotation is derived from adjacent authoritative centers and is not synchronized. Local cosmetic bend is never used for hit detection.

### 6.2 Proposed append-only schema

Add a WormSegmentState schema with append-only fields in this order:

1. slot: uint8
2. generation: uint16
3. role: uint8
4. condition: uint8
5. armorBand: uint8
6. mode: uint8
7. chain: uint8
8. ordinal: uint8
9. x: float32
10. y: float32
11. changeTick: uint32

Add WormBossState:

1. active: boolean
2. ownerId: string
3. topologySeq: uint32
4. poseTick: uint32
5. mode: uint8
6. activeMask: uint16
7. targetableMask: uint16
8. collidableMask: uint16
9. undergroundMask: uint16
10. changedMask: uint16
11. splitActive: boolean
12. splitExpireTick: uint32
13. actionKind: uint8
14. actionSeq: uint16
15. actionStartTick: uint32
16. actionResolveTick: uint32
17. actionEndTick: uint32
18. actionEmitterSlot: uint8
19. actionEmitterGeneration: uint16
20. actionTopologySeq: uint32
21. actionTargetX: float32
22. actionTargetY: float32
23. segments: logically fixed-cap ArraySchema of WormSegmentState

Append one always-allocated wormBoss reference after xpEchoes in ArenaState and use active=false outside the encounter. This is preferable to repeatedly replacing an optional Schema reference. Do not insert fields in EnemyState or reorder ArenaState fields. Use exact-width number annotations for all new hot fields.

The root EnemyState continues to carry core HP, phase-driving position, wind-up compatibility fields, and general boss identity. BossController and the shared definition retain max-HP knowledge, because EnemyState does not currently publish maxHp. Root x/y should follow the head so existing camera and fallback UI paths remain meaningful. Root HP is not copied into every segment.

Allocate all 12 stable slot rows when Serraketh spawns, then update them through masks. Clear active and all masks on teardown; the schema object itself remains. A fixed row table makes late join, dormant generation, and atomic bitmask changes simpler than deleting and reinserting schema objects. Retain changedMask until at least the patch containing the topology transaction has been broadcast; clients use topologySeq and the complete masks as the durable truth rather than depending on a one-shot event.

Because the wire layout changes, increment SCHEMA_VERSION from 15 to 16 in the same shared commit as the schema. A server and client from different versions must fail the existing handshake; do not attempt a mixed-version fallback.

### 6.3 Wire-cost math

The critical steady-state mutation is x/y. An isolated Colyseus Schema 3.0.76 measurement for a dedicated segment row with float32 x/y produced 12 bytes per moving segment per patch. Publishing poseTick adds approximately 7 bytes per worm patch:

    pose bytes ≈ 12N + 7

| Active pieces N | Pose patch | At 10 Hz pose publication | At 20 Hz pose publication | 10 clients at 10 Hz |
| ---: | ---: | ---: | ---: | ---: |
| 8 | 103 B | 1.03 KB/s | 2.06 KB/s | 10.3 KB/s |
| 10 | 127 B | 1.27 KB/s | 2.54 KB/s | 12.7 KB/s |
| 12 | 151 B | 1.51 KB/s | 3.02 KB/s | 15.1 KB/s |
| 16 stress-only | 199 B | 1.99 KB/s | 3.98 KB/s | 19.9 KB/s |

These numbers exclude transport framing, action changes, the ordinary room patch, and encryption. They are a comparison, not a bandwidth promise.

By contrast, adding current number-typed x/y EnemyState-like rows costs about 14 bytes per moving row even before real MapSchema string keys and per-entity patch handling. A measured current-Arena-shaped patch is approximately 173 B for 12 moving rows, or 3.46 KB/s at 20 Hz, before the architectural costs of 12 EnemyState owners.

Recommended publication:

- simulate the entire chain at 20 Hz;
- publish segment poses at 10 Hz by marking x/y dirty every second server tick;
- publish topology, action, burrow, damage condition, and resolve state immediately on the tick they change;
- continue publishing the root/head through the normal room cadence.

The 20 Hz runtime positions live in WormBossRuntime's private typed arrays and drive every server query. Copy them into WormSegmentState only on publication ticks. This prevents the schema from becoming dirty at 20 Hz merely because the authoritative solver ran.

At 12 pieces this is approximately 1.51 KB/s/client of worm pose data. A full 12-row state is expected around 0.45–0.55 KB depending on actual flags and references. The topology burst guard is 1.5 KB. Measure the final generated schema instead of accepting estimates.

Release gates:

- normal 12-piece pose patch at or below 300 B/client;
- total worm pose stream at or below 6 KB/s/client at 20 Hz fallback;
- topology burst at or below 1.5 KB;
- no topology update split across multiple inconsistent authoritative ticks.

Do not reduce bandwidth by lowering authority below 20 Hz. Lower only publication cadence.

## 7. Snapshot-ring and interpolation contract

Do not allocate one SnapshotBuffer per segment. Add WormSnapshotBuffer with one frame header and structure-of-arrays storage:

- serverTime or poseTick per frame;
- topologySeq per frame;
- active mask per frame;
- x[depth][12] and y[depth][12];
- optional mode mask needed for visual transition selection.

Keep SNAPSHOT_DEPTH at 8. At 10 Hz worm pose publication, the batch ring retains roughly 800 ms, enough for the 120 ms interpolation delay and brief patch variance. At 20 Hz fallback it retains 400 ms. Do not globally increase SNAPSHOT_DEPTH for the worm; that would increase every existing entity's typed-array allocation.

Interpolation samples one pair of whole-chain frames and one alpha:

    renderedSlot = lerp(frameA.slot, frameB.slot, alpha)

No rendered slot follows the already-smoothed position of its predecessor. That rule is the primary defense against tailward jitter amplification.

If topologySeq differs between the interpolation endpoints:

- do not blend across the topology transaction;
- cut the entire batch to the newer topology;
- allow WormRig's authored sever/reconnect presentation to bridge the visual change without changing gameplay centers.

Extrapolation, if used, is bounded by the existing 60 ms limit and applies a velocity estimated independently per slot from the same two batch frames. Burrow entry, emergence, split, regrowth, and Reconnecting disable extrapolation for affected slots. A whole-chain teleport/snap metric is based on the head plus topology sequence, not independently triggered tail snaps.

Regression telemetry must report head RMS error and tail RMS error. Tail error may not exceed 1.5 times head error in the stable surface case.

## 8. Hit routing, SpatialGrid, and damage deduplication

### 8.1 Dedicated worm segment grid

Keep one EnemyState root in enemyGrid for compatibility, but exclude that root from ordinary physical body collision and direct damage shapes while WormBossState is active.

Add wormSegmentGrid, or a typed worm branch beside enemyGrid, containing one lightweight handle per active targetable segment or regrowth bud:

    ownerId, slot, generation, chain, role, x, y, radius

Update the handles after the same-tick chain solution. Registration is authoritative:

- Surface and targetable: present in hurt queries.
- Named solid attack phase: present in player collision/damage queries.
- Reconnecting or newly formed arm grace: hurt queries as authored, absent from damage/solid queries.
- Burrowing/Underground: absent from hurt, solid, and direct-damage queries.
- Regrowth bud: present only in hurt queries.
- Destroyed/dormant: absent everywhere.

Use the grid for broad phase and a circle/capsule or swept-capsule narrow phase. Fast projectiles and attacks must test the segment's previous-to-current swept capsule, not only the new center.

Audit every damage source that currently reaches damageEnemy:

- player projectiles, including piercing and area payloads;
- melee arcs;
- detonation and branded damage;
- damage waves;
- companion or ability hits;
- any future zone damage.

All of them should resolve to a DamageTargetRef that can be Enemy or WormSegment. Only the owner/core route invokes boss progression.

### 8.2 Passive locomotion is harmless

Normal worm following is non-damaging and non-solid. The boss's screen coverage is not itself an attack.

Player damage and knockback occur only during named, pre-telegraphed attack epochs such as Closing Loop, Stitch-Reap, Rib Quake, or Eruption. Each epoch maintains a bitset or fixed player ledger so the same chain-wide attack damages and knocks a player at most once per declared window. Closing Loop uses a chain-wide 350 ms hit epoch.

Newly visible, reconnected, or regrown parts have at least 300 ms of arm grace unless an already-visible telegraph explicitly claims that location and resolves after the grace.

### 8.3 Local integrity versus core damage

One hit may honestly intersect multiple local segment shapes, but it must not multiply core damage by segment count.

Use a ledger keyed by:

    sourceId, attackSeq, wormOwnerId

For one source epoch:

- apply local integrity to up to two distinct intersected segments for a piercing source;
- apply the second segment at no more than 50% local integrity unless the ability explicitly overrides it;
- apply core contribution once, using the largest eligible anatomy multiplier among contacts;
- cap core contribution at the ability's nominal boss-hit value;
- apply Brand and critical side effects once to the owner;
- record each accepted local contact by slot and generation.

This is intentionally more conservative than a 1.5-times core allowance. It prevents a shotgun or long melee arc from deleting core HP solely because the art has many pieces.

Spinner shards also obey BOSS_PROJECTILE_BUDGET, with an encounter-local cap of 16 live spinner shards.

## 9. Entity-cap, body-budget, and reward interactions

### 9.1 MAX_ENEMIES is still a physical budget

Schema-wise, the worm consumes one ArenaState.enemies row. Physically, it consumes 10–12 broad-phase bodies plus up to three temporary regrowth buds. Those bodies cannot be treated as free just because they live outside MapSchema.enemies.

Define and enforce:

    effectiveEnemyBodies =
        state.enemies.size
        + activeTargetableWormPieces
        + activeWormBuds
        - wormRootCompatibilityRow

The value may not exceed MAX_ENEMIES. Reserve the planned worm body count before encounter admission. During Serraketh, do not spawn a replacement horde or ordinary boss adds. If a development command attempts to spawn the encounter into a saturated room, either delay admission until the deterministic reserve is available or reject the command; do not silently overrun the cap.

The 12-part topology cap is a hard assertion in server code, schema masks, tests, and client allocation. The 16-piece wire row above is stress evidence only, not launch configuration.

### 9.2 XP Echo escrow

The depth-one reward target is fixed at 110 XP:

- up to 35 XP is represented by first-time logical anatomy breaks;
- at least 75 XP remains terminal/core reward;
- regrown generations never mint repeat value.

A first-time break creates at most one aggregate XpEchoState for the topology transaction at the tear point. It is encounter-locked:

- use an identifiable worm-locked ID prefix and a server-private locked-Echo ID set;
- stepXpEchoes skips latch, flight, collection, and ordinary merge for locked IDs;
- locked and unlocked Echoes never merge;
- the client renders a quiet resting trophy, not a collectible promise;
- on terminal death, clear danger first and unlock the stored Echoes in chain order;
- any anatomy escrow never instantiated or never earned is folded into the terminal core value so the encounter total stays 110.

Only the root death triggers loot, portal/progression, or nuke effects. A segment break never calls the generic boss-death branch.

At the 10-start/12-cap topology, the number of locked rows is comfortably below MAX_XP_ECHOES=48, but cap checks still need tests. The room must reserve enough Echo rows for the terminal release. If the general Echo cap is pressured, coalesce multiple same-tick anatomy rewards into the one required transaction Echo; never discard fixed encounter value.

## 10. Burrow state and fairness

Burrow is an explicit tick-state machine:

1. Surface
2. DiveWindup
3. Submerging
4. Underground
5. EruptionClaim
6. Emerging
7. SurfaceArmGrace

Timing locks:

- Seam Dive wind-up: 13 ticks, 0.65 s.
- Underground travel: 25–38 ticks, 1.25–1.90 s.
- Eruption warning: 18 ticks, 0.90 s, fixed.
- Surface arm grace after emergence: at least 6 ticks, 0.30 s.

During DiveWindup, the attacker pose, painted foreshadow, and weapon/seam glint identify the move. As each segment becomes Submerging, remove it from hurt, solid, and damage grids at the server-authored transition tick. Underground segments cannot be hit and cannot hit players.

The server commits an underground route and emergence point before publishing EruptionClaim. The client receives the committed point and action ticks; it does not predict a moving target. The red eruption warning reaches its full claimed radius without growing damage coverage as its timer advances. Radius is 145 px. Jumping does not grant immunity to Eruption.

Fairness requirements:

- warning start, full footprint, and resolve are server ticks;
- the fully painted footprint remains readable for the resolved broadcast generation;
- at least one legal escape route remains and its minimum width is validated against player radius and movement speed;
- simultaneous encounter danger claims cover no more than 55% of navigable local space;
- emergence cannot be in a pit or invalid zone;
- offscreen entry/emergence uses a camera-edge direction tell without moving or stealing the camera;
- newly emerged body movement is harmless during arm grace; only the separately telegraphed Eruption can damage at its resolve tick.

The underground trail is cosmetic evidence, not a collision proxy. It follows server-synchronized route knots or the last published route corridor and may pass under pits. Missing trail art falls back to the existing telegraph/fx language, never to an invisible attack.

## 11. Client rendering

### 11.1 One batched WormRig

Add WormRig instead of constructing a SpriteRig per part. It owns:

- up to 12 reusable Phaser Images for anatomy;
- a small fixed pool for three buds and two sever caps;
- one shared AO ribbon or segmented shadow mesh;
- one shared underground trail;
- a fixed pool for paper-cutout tear overlays;
- no per-part Containers, Tweens, particle emitters, or shadow objects.

Targets at the 12-part cap:

- at most 40 persistent display objects including temporary encounter pieces;
- no steady-state allocations in update;
- six or fewer draw-call groups for the worm kit and its shared effects;
- renderer work linear in active pieces with fixed-cap scratch arrays.

Each sprite is positioned from its independently interpolated authoritative center. Facing is derived from the neighboring centers in the same interpolated frame:

- head/tail use the single adjacent tangent;
- interiors use the normalized vector from previous center to next center;
- zero-length cases retain the last valid angle.

Depth ordering follows chain order and view-space y with a stable slot tie-break. A split stub has its own deterministic depth band.

### 11.2 Bounded follow-spline presentation

The centers are authoritative. A visual follow spline may smooth tangent and shared AO/trail shape, but it may not move damage-bearing centers or overshoot authoritative swept capsules.

Do not use unconstrained Catmull-Rom through the centers. It can bulge outside the safe corridor on tight turns. Launch with one of:

- piecewise-linear centers plus a miter-limited tangent; or
- monotone/bounded Hermite whose control points are clamped to the union of adjacent authoritative capsules.

Connector art hides the remaining angular discontinuity. Any future spline improvement must prove that its rendered body hull does not claim visually safe ground outside gameplay capsules.

### 11.3 Topology and action presentation

WormRig observes topologySeq and changedMask:

- Destroy: detach the affected image, play an available tear treatment, and reveal front/rear stump art.
- Reconnect: move only by subsequent authoritative poses; crossfade seam treatment without fake hit geometry.
- Split: establish a second render chain using the same slot objects.
- Regrow: show bud states, then change the activated slot's generation and body texture.
- Burrow: hide each body image on its authoritative transition tick and reveal the shared trail.

Action visuals use actionKind, emitter identity, and server ticks, not inferred animation timing. The existing diegetic grammar remains mandatory: attacker/source pose, painted foreshadow, and a glint or seam cue. White moves retain jump/parry semantics; red moves retain dodge semantics. Specifically:

- Rib Quake: 0.80 s white warning, final 150 ms white commitment, jump/parry.
- Stitch-Reap: 0.55 s white warning; jump does not itself grant immunity.
- Shear Bloom: 0.65 s warning, six shards per live Spinner, 0.45 s stagger.
- Closing Loop: 1.60 s formation, 0.50 s lock, 2.40 s constrict; red body danger and visible exits.
- Eruption: 0.90 s fixed red warning; jump does not negate it.

The normal SpriteRig path remains untouched for all other enemies. ArenaScene branches on the worm owner, updates one WormSnapshotBuffer and one WormRig, and suppresses the root's ordinary sprite.

## 12. Modular sprite-art specification

Generate separate images only. Never render a combined worm or a spritesheet containing the assembled chain.

Common render prompt:

> One modular game boss anatomy piece for Serraketh, the Seam-Eater, a colossal dimensional burrowing worm in a top-down co-op bullet-heaven. HD cel-shaded paper-cutout sprite, three-quarter top-down view, longitudinal spine centered on y=256, anatomy facing RIGHT. Exact 512×512 canvas with flat chroma-key green #00ff00 background. The front and rear connectors must align on the horizontal spine and provide 12–16 percent overlap with adjacent modular pieces. Consistent upper-left lighting, crisp silhouette, readable at game scale. No baked ground shadow, no text, no UI, no telegraph, no particles, no glow extending off canvas, and no neighboring segment.

Render these IDs into sprites/seam-eater/:

- seam-eater-head-armored
- seam-eater-head-exposed
- seam-eater-head-critical
- seam-eater-neck-armored
- seam-eater-neck-cracked
- seam-eater-body-intact
- seam-eater-body-wounded
- seam-eater-body-regrown
- seam-eater-spinner-closed
- seam-eater-spinner-open
- seam-eater-spinner-wounded
- seam-eater-tail-armored
- seam-eater-tail-exposed
- seam-eater-stump-front
- seam-eater-stump-rear
- seam-eater-regrowth-bud
- seam-eater-regrowth-bud-wounded

Create dimensional-material variants as edits of the accepted silhouettes; do not change connector geometry between passes. Optional separate decals are burrow bulge, entry seam, and eruption claim. Decals must not contain the damaging red/white telegraph color baked into the art; the runtime paints semantics.

The asset pipeline should use the existing artkit harvest/install/pack/check workflow and manifest conventions. Missing optional art must degrade to shared VFX, while missing required anatomy art fails the asset check.

## 13. Deterministic test plan

Follow BossController.test.ts conventions: tiny definitions, recording sinks, fixed 0.05-second ticks, explicit seed, and exact event assertions. Keep pure chain tests separate from GameRoom integration tests.

### 13.1 WormBossRuntime unit tests

- Initial spawn produces exactly 10 active slots in the locked role order and dense main ordinals.
- Path history is correctly preseeded; no initial segment appears at the origin.
- Straight-line motion holds each role gap within tolerance for thousands of ticks.
- Maximum allowed turn rate preserves the curvature-derived chord-distance bound.
- All followers sample the same current-tick head history; no previous-tick recursive propagation.
- Repeating seed, inputs, and ticks yields byte-identical slot poses and topology events.
- A 10-to-12 regrowth sequence never exceeds the cap.
- Destroying an interior Body compacts the main chain without creating a daughter.
- Reconnecting links are non-damaging/non-solid for the complete transition and never teleport beyond the configured catch-up bound.
- Same-tick multi-sever sorts slots, increments topologySeq once, and emits one reward transaction.
- Slot generation increments on activation; stable role does not change; rewardPaid never resets.
- NaN, path-ring underflow, zero-length tangent, and arena-edge cases fail safe.

### 13.2 Split and regrow edges

- The 70% transition creates exactly one tailward stub with no head and no second health owner.
- The stub cannot split, burrow, coil, or regrow.
- Main plus stub active count remains at or below 12.
- Stub destruction gives one 1.2-second punish window and locks reward Echoes.
- Stub expiry rejoins at a marked seam without a position jump and grants the configured Graft Hunger eligibility.
- Re-entry arm grace lasts at least 6 ticks.
- Graft Hunger runs once at 45%, creates two solo or three co-op buds, and activates only available dormant Body slots.
- Destroyed buds do not activate slots; excess surviving buds cannot breach the cap.
- Regrowth does not heal core HP and later regrown breaks mint no XP.

### 13.3 Burrow fairness

- Seam Dive lasts exactly 13 ticks before collision leaves each authored part.
- Underground duration stays within 25–38 ticks for every deterministic route.
- EruptionClaim is exactly 18 ticks and its footprint does not expand with telegraph progress.
- No underground piece remains in hurt, solid, or damage grids.
- The committed emergence point is solid, inside bounds, and identical on replay.
- Eruption damages at most once per player at resolve; jump state does not suppress it.
- Surface body damage stays disabled for at least 6 ticks after emergence.
- Resolved warning survives its broadcast generation; cancel never displays full coverage.
- Generated claims preserve the configured route width and 55% local-danger ceiling.

### 13.4 Hit and grid integration

- Every current damage source can hit a WormSegment target.
- A single projectile intersecting overlapping segments applies core damage once.
- A piercing source applies local damage to at most two slots and bounded damage to the second.
- Brand, crit, and proc ownership apply once to the worm owner.
- Swept capsule catches a projectile or player crossing between 20 Hz poses.
- Named chain attack damages/knocks each player at most once per epoch.
- Passive surface following never damages or pushes players.
- Destroyed, dormant, reconnecting-solid-disabled, and underground pieces are absent from the relevant grids.
- Segment death never invokes boss completion; root death invokes it exactly once.

### 13.5 Schema, wire, snapshots, and late join

- Generated schema preserves all existing field order and appends wormBoss.
- Client/server version 15/16 mismatch fails the handshake.
- Actual 12-piece steady pose patch and topology burst meet the release gates.
- WormSnapshotBuffer allocates one fixed batch ring, not 12 rings.
- Interpolation uses one frame pair and alpha for all pieces.
- Tail RMS jitter is at most 1.5 times head RMS in a deterministic packet-jitter trace.
- Interpolation never blends across topologySeq.
- Burrow, split, reconnect, and regrow disable invalid extrapolation.
- Late join during surface, warning, underground, temporary split, Graft Hunger, and terminal settle reconstructs the current authoritative state.

### 13.6 Caps, rewards, and stress

- effectiveEnemyBodies includes worm pieces and buds while subtracting the compatibility root exactly once.
- Encounter admission cannot exceed MAX_ENEMIES.
- No replacement horde or ordinary boss adds spawn during Serraketh.
- Live Spinner shards never exceed 16 or BOSS_PROJECTILE_BUDGET.
- Locked Echoes cannot latch, collect, or merge before death.
- Locked and ordinary Echoes do not merge.
- Same-tick sever emits at most one aggregate Echo and stays under MAX_XP_ECHOES.
- Encounter reward totals exactly 110 for no sever, all eligible sever, regrow, and stub success/failure paths.
- Only terminal death plays nuke, loot, and progression.
- Four-player stress: 12 pieces, three buds during their legal window, 16 shards, maximum permitted residual enemies, pits, Cover/Scar/Common boundaries, and packet jitter.
- Ten-client network stress stays inside the measured room bandwidth budget without steady allocation growth.

## 14. File and function touch list

Names below are proposed; keep ownership boundaries even if final filenames differ.

### Shared

- packages/shared/src/worm.ts — role/mode/action enums, 12-slot cap, topology masks, timing constants, type guards.
- packages/shared/src/state.ts — append WormSegmentState and WormBossState; append wormBoss to ArenaState.
- packages/shared/src/constants.ts — SCHEMA_VERSION 15 to 16; worm limits only if they are cross-runtime contracts.
- packages/shared/src/bosses.ts — add Serraketh BossDef and encounter discriminator; define phase thresholds and action tuning.
- packages/shared/src/boss.ts — add only reusable director-facing types that genuinely belong to all runtimes.
- packages/shared/src/boss-primitives.ts — pure Serraketh CastPlan builders for warnings and payload declarations; do not put topology mutation here.
- packages/shared/src/enemies.ts — add seam-eater root presentation metadata and collision fallback; root remains non-physical under WormRig.
- packages/shared/src/index.ts — export new schema/types.

### Server

- packages/server/src/rooms/WormBossRuntime.ts — fixed arrays, head steering, path rings, same-tick sampling, topology transactions, masks.
- packages/server/src/rooms/WormBossRuntime.test.ts — motion, spacing, split, regrow, burrow, and replay determinism.
- packages/server/src/rooms/WormEncounterDirector.ts — authored phase/action state machine and emitter validation.
- packages/server/src/rooms/WormEncounterDirector.test.ts — exact timing, settle, cancellation, budgets, and terminal sequence.
- packages/server/src/rooms/BossController.ts — construct/delegate director for encounter worm; preserve legacy path.
- packages/server/src/rooms/BossController.test.ts — integration assertions matching the existing recording-sink style.
- packages/server/src/rooms/SpatialGrid.ts — preferably generalize handles/query scratch without changing existing stable-order semantics; otherwise add a sibling grid.
- packages/server/src/rooms/GameRoom.ts:
  - spawnBoss creates root plus worm state/runtime;
  - stepBoss advances the runtime/director before relevant collision queries;
  - grid rebuild/update includes worm handles;
  - damageEnemy routes WormSegment refs through owner dedupe;
  - resolveEnemyCollisions excludes passive worm root/body;
  - all projectile/melee/detonation/wave call sites accept DamageTargetRef;
  - enemy admission uses effectiveEnemyBodies;
  - boss death tears down worm state once.
- packages/server/src/rooms/GameRoom.test.ts or focused room tests — hit routing, body cap, progression, and late-join state.
- XP Echo functions in GameRoom, including dropXp/drop equivalent and stepXpEchoes — locked set, no merge/latch, ordered unlock, fixed total.

### Client

- packages/client/src/net/worm-snapshots.ts — one fixed WormSnapshotBuffer.
- packages/client/src/render/WormRig.ts — batched anatomy, shared AO/trail, bounded tangents, topology presentation.
- packages/client/src/scenes/ArenaScene.ts:
  - preload seam-eater kit;
  - create one WormRig for wormBoss;
  - push whole-chain snapshots on patches;
  - suppress root SpriteRig;
  - dispatch semantic actions and topology changes;
  - clean up all pooled objects on removal.
- packages/client/src/scenes/arena/vfx.ts — shared burrow trail, sever paper treatment, edge tell, and death sequence through existing FX composition.
- packages/client/src/vfx/xp-motes.ts — render locked worm Echo IDs as resting trophies and animate ordered unlock.
- packages/client/src/render/SpriteRig.ts — no multipart worm implementation; touch only if a small shared texture lookup helper is extracted.

### Assets and documentation support

- packages/client/public/sprites/seam-eater/ — required independent anatomy sources/outputs according to the repository's actual asset layout.
- packages/client/src/assets/manifest.ts — exact required anatomy keys and optional decal keys.
- existing artkit harvest/install/pack/check inputs and generated atlas outputs — update through the normal pipeline, not manual atlas edits.

## 15. File-lock wave plan

Use explicit file ownership. No two implementation agents edit the same file in the same wave.

### Wave 0 — contracts and failing tests

- Lock owner A: shared worm contract proposal and schema/wire fixture tests only.
- Lock owner B: WormBossRuntime.test.ts.
- Lock owner C: WormEncounterDirector.test.ts.
- Lock owner D: client WormSnapshotBuffer tests and deterministic jitter fixture.

Exit: topology, timing, cap, wire, and interpolation expectations are executable and failing for known reasons.

### Wave 1 — independent foundations

- Owner A locks shared worm.ts, state.ts, constants.ts, and index.ts.
- Owner B locks new WormBossRuntime.ts only.
- Owner C locks new WormEncounterDirector.ts only.
- Owner D locks new worm-snapshots.ts only.
- Art owner works only in seam-eater source asset staging, not manifest or atlases.

Exit: shared schema compiles; runtime and director unit suites pass in isolation; measured wire fixture is recorded.

### Wave 2 — boss and room integration

- Owner A locks bosses.ts, boss.ts, boss-primitives.ts, and enemies.ts.
- Owner B locks BossController.ts and BossController.test.ts.
- Owner C exclusively locks GameRoom.ts and its focused tests, including damage routing, body budget, and XP escrow.
- Owner D locks SpatialGrid.ts only if generalization is necessary; otherwise owns a new worm-grid file.

GameRoom.ts is a single-owner hotspot for the entire wave. Other owners provide narrow commits or patch notes for that owner to integrate; they do not edit it opportunistically.

Exit: a headless room can spawn, fight, split, regrow, burrow, reward, and terminate Serraketh deterministically.

### Wave 3 — client integration

- Owner A locks WormRig.ts.
- Owner B locks ArenaScene.ts exclusively.
- Owner C locks arena/vfx.ts and xp-motes.ts.
- Owner D runs read-only replay, jitter, and visual-hull diagnostics; fixes go back to the owning file agent.

Exit: one batch rig renders every topology state, no root duplicate is visible, and topology changes never interpolate through invalid layouts.

### Wave 4 — asset packaging

- Art owner finalizes required separate 512×512 sources.
- Asset owner exclusively locks manifest.ts and the artkit/atlas outputs, runs harvest/install/pack/check, and reports missing required IDs.
- Client owners are read-only on asset files during packaging.

Exit: all required part keys load from sprites/seam-eater/, optional decal fallback works, and no combined worm asset is present.

### Wave 5 — tuning and hardening

- One owner at a time locks tuning definitions in bosses.ts/boss-primitives.ts.
- Server profiling owner locks only files proven by traces to need changes.
- Client profiling owner locks only WormRig or VFX files, never both concurrently with another owner.
- Test owner expands stress fixtures without changing production code in the same pass.

Exit: all release gates below pass under the final tuning.

## 16. Release gates

The encounter is implementation-complete only when:

- exactly one boss owner and health bar exist;
- start topology is the locked 10-part order and active topology never exceeds 12;
- the chain is solved at 20 Hz from same-tick arc-length history;
- full segment centers, not client-only reconstruction, drive rendering and damage;
- pose publication meets measured wire gates and SCHEMA_VERSION is 16;
- only one batched snapshot ring and one WormRig exist;
- tail smoothing does not amplify jitter beyond the test threshold;
- passive worm movement is harmless and non-solid;
- every damaging chain state has a server-timed diegetic warning and per-player epoch dedupe;
- burrow collision removal, 0.90-second eruption claim, route access, and arm grace pass deterministic tests;
- ordinary severing reconnects one main chain; the only autonomous split is the authored 70% temporary stub;
- Graft Hunger cannot heal core, restore special anatomy, repeat XP, or exceed the cap;
- worm bodies reserve physical room capacity even though only the root uses EnemyState;
- XP Echo escrow stays under its cap and totals exactly 110 on terminal release;
- only core death triggers loot, progression, portal, and nuke;
- asset validation finds every required independent anatomy sprite;
- existing bosses and their BossController tests remain behaviorally unchanged.
