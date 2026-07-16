# Devil's advocate: modular sprites are not modular authority

## Ruling

The worm is a strong second flagship precisely because it can do what Vastaghar does not: move laterally, change topology, disappear into the ground, and turn the arena into a pursuit problem. It should complement the footstep titan, not compete to be an even larger pile of boss spectacle.

The dangerous implementation is also the obvious one: spawn a head and `N - 1` ordinary `EnemyState` rows, make each row follow the previous row, give every row HP and contact damage, and let the existing enemy renderer build one rig per row. That version will look convincing in a zero-latency solo capture and fail under co-op, interpolation, piercing weapons, middle-segment deaths, pits, camera separation, and a busy 20 Hz patch stream.

The shipped partial-body giant is not precedent for that authority model. Vastaghar/Gorogoth is one authoritative enemy root. `BossDef` names one body kind, `BossController.step()` receives one `EnemyState`, movement and phase selection mutate that one row, and every primitive receives one boss point (`packages/shared/src/bosses.ts:52-60`; `packages/server/src/rooms/BossController.ts:151-174`; `packages/shared/src/boss-primitives.ts:153-163`). The client then constructs body, hands, and feet as local children of one `SpriteRig` and moves the whole container from one snapshot ring (`packages/client/src/entities/SpriteRig.ts:645-749`; `packages/client/src/scenes/ArenaScene.ts:2943-2977`, `:3116-3132`). The lower-body framing is also a visual lift only; collision, depth, and the shadow remain rooted to the single boss position (`packages/client/src/entities/SpriteRig.ts:790-796`, `:3521-3536`).

That precedent proves that separate sprites can share one synchronized owner. It does **not** prove that sixteen independently damaged, colliding, interpolated boss bodies are safe.

The launch version I would approve has this sentence:

> **Hunt the head, sever armor to shorten the threat, read the ground before it dives, and finish the core through the head.**

It also has these architectural boundaries:

- one authoritative worm owner and one terminal core HP ledger;
- one contiguous chain, with no autonomous split-worms in v1;
- separate modular sprites, but not ordinary autonomous enemies;
- at most 16 active, collidable pieces at launch unless a measured packed/path representation earns more;
- passive locomotion is not an untelegraphed damaging sweep;
- segment loss changes shape and attacks, but never duplicates boss completion, loot, XP, aggro, or cameras.

If those boundaries sound less like Terraria, that is because Terraria is not synchronizing a ten-player authoritative room over reliable 20 Hz patches while also carrying 80 enemies, 120 hostile projectiles, 48 XP Echoes, prediction acknowledgements, and current telegraphs.

## 1. The existing boss lifecycle assumes exactly one boss body

`EnemyState` has `id`, `kind`, `x`, `y`, `hp`, and ordinary-enemy presentation fields. It has no encounter owner, segment index, parent, topology generation, chain state, burrow state, local armor maximum, or terminal/nonterminal distinction (`packages/shared/src/state.ts:146-169`). `ArenaState` owns one enemy map plus one `bossPhase` and one `bossKind`; `GameRoom` separately tracks one private `bossId` (`packages/shared/src/state.ts:283-292`, `:332-352`; `packages/server/src/rooms/GameRoom.ts:534`).

Making each piece an ordinary enemy silently opts into unrelated laws:

- Only `bossId` is skipped by generic enemy AI, POI collision, pit death, respawn clearing, and belt trash counting. Every other piece can be moved as horde trash, wedged on Cover, erased near a revive, fall into a pit without XP, or keep a belt room uncleared (`packages/server/src/rooms/GameRoom.ts:1476-1485`, `:2095-2101`, `:2166-2207`, `:4545-4551`).
- The collision solver separates every enemy pair twice and then pushes every enemy out of every living player. Sibling segments would fight the chain constraint while players locally kink it (`packages/server/src/rooms/GameRoom.ts:1510-1586`).
- `clearBoss()` disposes the one controller and its telegraphs, then clears `bossId`; it does not discover or delete an arbitrary segment family (`packages/server/src/rooms/GameRoom.ts:3043-3056`). A head death can therefore leave damaging body rows behind.
- If every segment kind is marked `archetype: "boss"`, every segment death enters the boss reward branch and can open a portal, award boss loot, or advance Boss Rush. If segments are ordinary kinds, every death creates an XP Echo and becomes eligible for ordinary post-boss loot after `bossId` clears (`packages/server/src/rooms/GameRoom.ts:3627-3692`). Neither classification is correct.
- `BossController` selects phases from the one supplied body's `hp / maxHp`, moves that body, and instantiates primitives around that body's point. It has no part registry or per-emitter cancellation (`packages/server/src/rooms/BossController.ts:151-217`, `:351-385`).

This is not a data-only `BossDef`. The current primitive contract can still drive supporting volleys or fixed attacks, but topology, chain motion, segment-owned attacks, and encounter death require a dedicated worm encounter layer.

### Hard guardrails

- **Owner law:** exactly one encounter owner is allowed to set `bossPhase`, clear boss telegraphs, pay the boss reward, open the portal, or advance Boss Rush.
- **Classification law:** a segment is neither a boss nor trash for generic lifecycle purposes. It must resolve to an owner before damage, collision, XP, pit, POI, add-cap, and cleanup rules run.
- **Cleanup law:** terminal death, restart, dimension change, training swap, disconnect teardown, and boss-picker replacement remove every segment, path sample, cast, hit ledger, collider, trail, and detached visual in one bounded owner cleanup.
- **Schema law:** any decorated synchronized field or collection is append-only and bumps `SCHEMA_VERSION` from its then-current value. The repository is currently at 15, and field order is explicitly wire-significant (`packages/shared/src/constants.ts:8-18`; `packages/shared/src/state.ts:283-287`).
- **No counterfeit precedent law:** review documents and PRs may say the giant establishes a *multi-sprite* precedent. They may not claim it establishes independent multi-body HP, collision, interpolation, or lifecycle.

## 2. The wire bill is not hypothetical

I measured the current `@colyseus/schema` 3.0.76 encoder with the current `ArenaState` and represented each worm piece as an `EnemyState` in `ArenaState.enemies`. After an initial full encode, every row's `x` and `y` changed once per patch; the HP case also changed every row's `hp`. The table includes the normal five-byte `tick` change, excludes WebSocket/Colyseus transport framing, and assumes one broadcast per completed tick, which is how `GameRoom` is configured (`packages/server/src/rooms/GameRoom.ts:1056-1061`, `:1719-1733`).

| Pieces, including head | Share of `MAX_ENEMIES=80` | One-time add patch | `x/y` patch | `x/y` per client at 20 Hz | `x/y/hp` patch | `x/y/hp` per client at 20 Hz | Raw client position-ring payload |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 10% | 463 B | 117 B | 2.34 KB/s | 149 B | 2.98 KB/s | 1.50 KiB |
| 12 | 15% | 699 B | 173 B | 3.46 KB/s | 221 B | 4.42 KB/s | 2.25 KiB |
| 16 | 20% | 939 B | 229 B | 4.58 KB/s | 293 B | 5.86 KB/s | 3.00 KiB |
| 24 | 30% | 1,419 B | 341 B | 6.82 KB/s | 437 B | 8.74 KB/s | 4.50 KiB |
| 32 | 40% | 1,899 B | 453 B | 9.06 KB/s | 581 B | 11.62 KB/s | 6.00 KiB |
| 80 | 100% | 4,779 B | 1,125 B | 22.50 KB/s | 1,445 B | 28.90 KB/s | 15.00 KiB |

The raw ring column is only `N * SNAPSHOT_DEPTH * (t,x,y) * 8 bytes`: three `Float64Array`s at depth eight. It excludes the buffer objects, maps, rigs, Images, shadows, containers, and V8/Phaser overhead. The rings are admirably allocation-free, but one is still created and pushed for every enemy on every patch (`packages/client/src/net/snapshots.ts:91-122`; `packages/client/src/scenes/ArenaScene.ts:8228-8256`).

The patch cost multiplies by connected clients because StateView/AOI is still not wired (`packages/shared/src/state.ts:16-23`). Sixteen pieces therefore cost roughly 45.8 KB/s of server egress at ten clients for coordinates alone, or 58.6 KB/s while all HP values churn, before transport framing. This is not catastrophic in isolation. It is reckless when added to the same reliable ordered stream as a full horde, projectiles, telegraph progress, player acknowledgements, and XP receipts. Backlog does not merely lower visual fidelity; it delays the fairness layer.

The cap comparison is just as important. Sixteen ordinary segment rows consume 20% of the entire POC enemy ceiling before one add is summoned. Twenty-four consume 30%. `BOSS_ADD_CAP=12` does not save this: it counts only ids in `bossAddIds`, not arbitrary body rows (`packages/shared/src/constants.ts:505-511`; `packages/server/src/rooms/GameRoom.ts:3126-3134`, `:3310-3337`).

### Hard guardrails

- **Launch-count law:** default encounter tuning is 10-12 active pieces; the hard launch ceiling is 16 active/collidable pieces plus at most four pooled, visual-only forming or severing pieces. A designer cannot raise this constant in boss data.
- **Room-budget law:** worm pieces reserve an equivalent share of the 80-enemy budget even if they live outside `state.enemies`. The spawn director must reduce or stop ordinary horde pressure; a custom collection is not permission to hide bodies from the cap.
- **Wire law:** at 16 pieces, the worm's measured steady-state delta must remain at or below 300 bytes/patch/client and 6 KB/s/client at 20 Hz, including coordinates, topology, routine HP, and state flags. A topology burst may reach 1.5 KB once, not every tick.
- **Stress-egress law:** at ten connected clients, worm-specific egress must stay below 60 KB/s sustained and must not increase p95 input-ack or telegraph delivery latency by more than one 50 ms tick versus the same stress scene without the worm.
- **Snapshot law:** use one fixed-capacity structure-of-arrays `WormSnapshotBuffer` (or equivalent packed batch) with one tick/topology epoch per row. Do not allocate `N` independent `SnapshotBuffer` objects and discover topology by noticing missing map ids.
- **HP-event law:** HP is event-driven. Do not rewrite every segment's unchanged HP each tick, and do not replicate client-cosmetic bend angle, scale, shadow, trail, or damaged tint.
- **Measurement law:** patch bytes are recorded from the real encoder and real room at 8/12/16/24 pieces. Object-count estimates and JSON sizes are not substitutes.

Separate sprites are compatible with a compact wire model. The server can own a head path plus stable arc-length offsets and sparse per-segment armor/state, or send a packed, quantized segment batch. What it may not do is equate “separate PNG” with “full schema entity.”

## 3. Follow-the-leader turns network jitter into a tail whip

Remote enemies render 120 ms behind the tick timeline, using eight samples, linear interpolation, at most 60 ms of extrapolation, and then a hold (`packages/shared/src/constants.ts:141-149`; `packages/client/src/net/snapshots.ts:140-185`). That works for independent bodies. A chain adds a constraint: each child must remain at a stable arc-length from its predecessor while all pieces turn.

A naive solver fails in two different ways:

1. **Server propagation lag.** If segment `i` follows segment `i - 1`'s previous-tick position, a disturbance advances only one link per 50 ms tick. A 16-piece chain can put the tail 750 ms behind the head's decision before network interpolation adds anything.
2. **Render recursion.** If the client first interpolates the head and then makes each visible child follow the already-interpolated parent, a small head correction changes the first tangent; every subsequent tangent integrates that error. Position noise becomes angular noise, rotations alternate, link overlap opens and closes, and the tail snaps farther than the head.

Independent rings are not a cure. They can preserve each server coordinate at a common sample time, but additions, removals, stalls, and teleport gap decisions occur per id. The current enemy sampler cuts only when a bracket displacement exceeds 260 px (`packages/shared/src/constants.ts:99`; `packages/client/src/scenes/ArenaScene.ts:3116-3132`). One piece can cut while its neighbor interpolates, visibly inverting the chain for a frame.

The acceptable model is a same-tick chain solution sampled as one object. The authoritative server solves the complete chain from one path/constraint state on tick `T`; the client samples two complete chain snapshots with the same topology generation, interpolates corresponding stable ids, and performs at most a bounded visual constraint projection. Better still, both sides sample pieces by distance along the same non-overshooting polyline/path history. No link consumes a rendered parent as its next simulation input.

### Hard guardrails

- **Same-tick law:** head motion affects every active link's authoritative position in the same simulation tick. No one-link-per-tick propagation is permitted.
- **Shared-epoch law:** all pieces rendered in one frame come from one interpolation bracket and one `topologySeq`. A topology mismatch cuts/reseeds the whole worm buffer; it never pairs an old tail with a new head.
- **Spacing law:** for target link spacing `S`, authoritative adjacent center distance error is at most `max(3 px, 0.05S)` p99. Rendered error is at most `max(6 px, 0.10S)` p99 under the network matrix below.
- **Amplification law:** tail RMS position error against delayed authoritative truth may not exceed 1.5 times head RMS error. Maximum non-teleport tail correction is 18 px/frame at 60 fps and may not grow linearly with segment index.
- **Turn law:** no adjacent pair may reverse ordering, cross, or rotate more than 35 degrees in one rendered frame outside an explicit burrow/topology cut.
- **Path law:** visual smoothing may not use a spline that overshoots the authoritative swept capsules into safe ground. Use a non-overshooting polyline/arc-length sampler or prove the curved hull remains inside the server hull.
- **Join law:** a join-in-progress client receives one complete owner/topology/path baseline. It does not watch pieces stream in head-to-tail over several patches.

## 4. Burrow is a teleport unless the protocol says otherwise

The current boss teleport contract is designed for one body. `blinkStrike` chooses one destination, paints a point and circle there, then `moveBoss` writes one `x/y` pair before the slam (`packages/shared/src/boss-primitives.ts:580-601`; `packages/server/src/rooms/BossController.ts:403-435`). A worm dive has at least four different events: the head commits, successive body pieces leave the surface, an underground path moves, and successive pieces emerge. Treating that as “set all positions at resolve” makes half an arena of body appear without a causal source.

The interpolation snap threshold cannot define burrowing. A 259 px displacement currently interpolates; a 261 px displacement cuts. Neither number says whether the piece is above ground, targetable, collidable, or damaging.

The telegraph language must remain the established hybrid:

- the head coils and the visible chain compresses toward the entry point;
- painted dust/rift cracks travel along the committed underground route;
- the exact, quality-invariant underlay shows every damaging emergence capsule from the first observed cast patch;
- the emerging head/plate carries the weapon-glint-equivalent timing crest;
- only then does the hitbox arm.

### Hard guardrails

- **Explicit-state law:** `surface`, `diving`, `burrowed`, `emerging`, and `active` are authoritative tick-stamped states. A discontinuity has an explicit movement/topology epoch; distance heuristics are fallback corruption guards only.
- **Commit law:** entry, path, exit, active piece count, and damaging footprint are chosen once at cast start. They are not retargeted after the first telegraph is broadcast.
- **Warning law:** any damaging emergence has at least 0.90 seconds of authoritative warning. At 200 ms RTT plus 30 ms jitter, the complete exact footprint and an edge/source cue must still be observable for at least 600 ms before damage.
- **Full-footprint law:** `t` changes cadence and energy, not coverage. The whole committed emergence/sweep footprint is present on the first observed patch.
- **Surface law:** burrowed pieces are untargetable, non-colliding, and non-damaging. Emerging pieces remain non-damaging until the advertised resolve tick; they do not apply ordinary contact damage on the creation patch.
- **Broadcast law:** the final above-ground warning state survives a complete broadcast generation before damaging collision can begin, mirroring the controller's existing settle-retention concern (`packages/server/src/rooms/BossController.ts:180-205`; `packages/server/src/rooms/BossController.test.ts:395-445`).
- **Route law:** the union of emergence danger and pits/obstacles may cover at most 55% of navigable visible ground around the target, and at least one route `2 * PLAYER_RADIUS + 24 px` wide remains.
- **Offscreen law:** an exit outside the target player's viewport gets a persistent directional edge tell tied to the exact source. The worm may not emerge damaging from an unmarked screen edge.
- **Cancel law:** if the cast is canceled by phase, sever, death, or target loss, its source pose visibly releases and its exact footprint disappears without impact VFX. A canceled tunnel never resolves from cached coordinates.

## 5. A long body needs a contact-damage constitution

The current contact rule is per enemy, per player, every tick. Each overlapping enemy subtracts `contactDamage * dt` and applies its own shove (`packages/server/src/rooms/GameRoom.ts:2209-2241`). Sixteen segments therefore imply as many independent DPS sources. Even if ordinary collision normally separates their circles, a curl, emergence, map boundary, or topology transition can stack several on one player for a single-tick burst.

The current body solver is also incompatible with a kinematic chain. It resolves sibling overlap by moving both pieces, then resolves player overlap by moving the enemy while the player stays fixed (`packages/server/src/rooms/GameRoom.ts:1510-1586`). That either violates segment spacing or allows the solver to rewrite the worm's attack path after it was telegraphed.

The launch-safe law should be blunt:

> **Passive worm locomotion is non-damaging and non-solid to players. Damage comes from named, telegraphed head bites, armed side-swipes, coils, and emergence sweeps.**

It is acceptable for passive overlap to apply a cosmetic dust response or a tiny non-damaging separation hint. It is not acceptable for simply moving the long chain through a player to become an unpainted arena-wide attack. If later playtests demand passive touch damage, it must still use one worm-wide per-player hit ledger and an explicit grace/cooldown; it cannot fall back to the generic per-row loop.

### Hard guardrails

- **One-epoch-one-hit law:** a player takes at most one damage event and one knockback impulse from one worm attack epoch, regardless of how many segment capsules overlap or how many substeps catch up.
- **Swept-shape law:** fast attacks test continuous swept capsules between tick positions. The exact telegraph covers that same swept hull, including the thickest segment and player radius convention.
- **No-passive-DPS law:** ordinary following, topology reconnection, spawn, join repair, and visual correction never deal damage.
- **Arm-grace law:** a newly formed, re-emerged, or reconnected piece has at least 300 ms of non-damaging grace after it becomes visibly present unless it belongs to an already advertised attack with a later resolve tick.
- **Sibling law:** pieces of the same worm are excluded from generic enemy-enemy relaxation. The owner constraint solver is the only system allowed to change their relative geometry.
- **No-pin law:** a worm attack may not close a loop around a player or use its body plus pit/Cover collision to remove all exits. At 1280x720, the target must retain a 72 px-wide escape corridor after authoritative collision inflation.
- **Parry law:** if a head bite is white/parryable, only the named head attack epoch accepts the parry. Touching a trailing segment during the same window neither consumes nor duplicates it.

## 6. Multi-hit weapons can turn segments into a damage exploit

The server deduplicates many attacks by enemy id. A melee swing's hit set, a piercing projectile, an explosion, a fire wave, or a spin can therefore hit several segment ids during one authored attack. Against a long overlapping target, that converts body count directly into DPS. Segment removal then becomes self-balancing in the worst way: the boss is hardest while long because it deals the most area denial, but it also melts fastest because every AoE and orbiting weapon collects many hit receipts.

This is not solved by lowering each segment's HP. Local armor break and terminal boss damage are different ledgers and need an explicit conversion.

### Hard guardrails

- **Owner-dedup law:** every player damage source resolves segment candidates through `SpatialGrid`, then deduplicates by worm owner before terminal-core damage is booked. Spatial indexing narrows queries; it does not define reward multiplicity.
- **Damage-budget law:** one authored attack may contribute at most 1.5 times its advertised single-target damage to terminal core HP, regardless of segment count. If multiple pieces are hit, local armor feedback may appear on all of them while core damage is clamped and distributed deterministically.
- **Pierce law:** a piercing projectile may consume at most two worm segment contacts; the second contributes at most 50% core damage. It cannot spend its entire pierce budget marching down one body.
- **Ledger law:** accepted damage is booked once with `(sourceId, attackSeq, wormOwnerId)`. Catch-up ticks, topology reindexing, id reuse, and client retries cannot replay it.
- **Build-band law:** across representative gun, explosion, melee, spin, chain, and parry builds, the fastest median worm kill time may not exceed the slowest viable median by more than 2.25x after normal item-level normalization.
- **Debug-truth law:** the combat debug overlay/log distinguishes raw per-segment contacts, accepted local armor damage, accepted core damage, and clamp reason. Tuning by floating damage numbers alone is forbidden.

## 7. Segment loss and growth are topology transactions, not `Map.delete()`

Deleting a middle sprite raises questions the generic enemy path never answers. Does the posterior half become a second worm? Does it teleport forward? Does the gap remain a safe hole? Can projectiles fly through it? Which half owns an in-flight attack? What happens to a player already inside the reconnecting hull? Which id keeps aggro? Does regrowth refund effective HP and XP?

The v1 answer should favor one readable chain over maximal simulation:

| Event | Naive failure | Required v1 rule |
|---|---|---|
| Middle armor reaches zero | Chain splits, both halves target, camera and boss bar become ambiguous | No split. The piece enters `severing`; the posterior chain reconnects to the same owner along the current path during a non-damaging topology transition. |
| Tail armor reaches zero | The least important sprite can accidentally end the boss | Tail sever changes length/attack reach only. It cannot touch core terminal state, boss loot, portal, or nuke payoff. |
| Head local armor reaches zero | Head disappears although it owns navigation and causality | The head becomes broken/exposed but persists. Only the terminal core ledger can start encounter death. |
| Core reaches zero from a body hit | Reward explodes at an offscreen tail while a live head keeps moving | Threat disables immediately; a bounded death cascade travels to and culminates at the head, then the reserved reward pays once. |
| Segment is added/regrown | New collider appears in a player; effective HP and farmable XP increase | New stable id/generation forms only in an advertised socket, is non-colliding/non-damaging during growth, and cannot increase remaining effective HP or reward budget. |
| Two pieces sever on one tick | Reindex order changes the outcome; casts double-cancel | Sort by stable chain order, apply one topology transaction, increment `topologySeq` once, and emit one bounded presentation beat. |
| An emitting piece severs | Detached telegraph resolves from a missing limb | Cancel that cast visibly or transfer it only through an explicitly authored owner rule fixed at cast start. |
| Dive begins during reconnect | Old surface ids pair with new underground positions | Topology transition completes or the dive is deferred. No overlapping topology epochs. |

Regrowth deserves special hostility. If a killed 100-HP plate regrows with 100 HP, the boss has healed even if the boss bar did not move. If it pays XP again, the optimal strategy may be to farm it. If the same id is reused, delayed patches and hit ledgers can apply old events to the new plate.

### Hard guardrails

- **No-split law:** autonomous split-worms are out of v1. Adding them later requires a separate owner, aggro policy, controller budget, reward ledger, camera/source policy, and boss-bar design; a detached half cannot masquerade as adds.
- **Stable-id law:** segment ids are never reused during an encounter. `chainIndex` may change; identity and `generation` do not.
- **Topology law:** add/remove/reconnect is one deterministic transaction with `topologySeq`, `effectiveTick`, old-to-new ordering, and explicit `forming/active/severing/burrowed` state.
- **Hitbox law:** only `active` pieces accept hits or participate in damaging attack collision. Severing paper art may linger, but its gameplay capsule is gone on the authoritative sever tick.
- **Damage-conservation law:** the sum of remaining terminal core plus convertible segment armor may never rise because of regrowth. Accepted damage is never erased at a phase boundary or topology change.
- **Aggro law:** the owner/head chooses targets. Segments do not acquire nearest players, enter generic duel/ranged AI, or rotate threat independently.
- **Target-fairness law:** with at least two living players, no player receives more than two consecutive targeted primary attacks; over any eight targeted attacks, counts differ by at most one absent an explicit player-owned taunt.
- **Cast-ownership law:** every cast records owner, emitting stable segment id, start/resolve tick, and topology generation. Missing emitters cannot silently resolve.
- **Map law:** pit immunity, POI/Cover interaction, Commons/Cover/Scar zone response, leash, and cleanup are owner policies applied coherently to the whole chain. They are not inherited accidentally from whether a piece equals `bossId`.

## 8. Co-op cameras will not agree on what the boss is

Each client camera follows its own predicted player; downed clients spectate a nearby living teammate. There is no squad-midpoint or boss-framing camera (`packages/client/src/scenes/ArenaScene.ts:5762-5851`). That preserves player agency and should remain. It also means one player can fight the head while another sees only three body plates and an offscreen marker.

A worm spanning the arena creates three camera traps:

- attacks can originate from a head the target cannot see;
- the head can chase one player while the tail sweeps another independent screen;
- a midpoint camera proposal can zoom everyone out until player shots, glints, and safe lanes become illegible.

The solution is local encounter information, not camera theft.

### Hard guardrails

- **Camera-agency law:** active players keep local camera ownership. Any encounter zoom adjustment is at most 5%, eases over at least 300 ms, and never shifts the local player more than 10% of screen width.
- **Source-visibility law:** at 1280x720, a player targeted by a major attack sees either the responsible head/segment and exact footprint, or a persistent edge-source tell, for at least 80% of the Lock window.
- **Escape-space law:** the local player, relevant danger boundary, and at least 160 px of escape space fit in the viewport during every targeted resolve. If they do not, the attack is not admitted.
- **Locator law:** the head has a restrained offscreen locator whenever it is targetable. Broken/weak segments may be located only while actionable; sixteen permanent arrows are forbidden.
- **No-tail-aggro law:** the posterior body cannot independently retarget a distant teammate. Tail motion is a consequence of the owner's path, and any intentional tail lash is a named cast with its own local source tell.
- **Punish-access law:** after a major dodge, sever, or parry, the exposed damage opportunity must be reachable or meaningfully targetable by every living player within 2 seconds. A melee player may not spend the whole reward window crossing one viewport to the head.
- **Shake law:** segment sever shakes only cameras within its local falloff. Worm-authored shake duty cycle stays below 15% of any rolling 10 seconds; final death owns the one global flagship shake.
- **Length law:** the launch count/spacing may not produce an authoritative active chain longer than 0.9 times the 1280x720 viewport diagonal without proving the visibility, route, and performance gates at that longer length.

## 9. A full `SpriteRig`, shadow, trail, and death effect per piece is a trap

Every current enemy row creates a `SpriteRig`. Even a minimal rig creates a body Image, an ellipse shadow, a Container, animation state, and a per-frame `animate()` call; multipart manifests add hands and feet (`packages/client/src/entities/SpriteRig.ts:645-749`). `ArenaScene.animateEnemies()` iterates every enemy rig every unfrozen frame, not merely on-screen rigs (`packages/client/src/scenes/ArenaScene.ts:3231-3336`). Sixteen segment rows implemented this way are sixteen small characters pretending to be one boss.

AO shadows and trails multiply the cost again. A shadow per circular plate flickers into a row of black coins on bends. A particle emitter or tween per segment creates avoidable object churn. Simultaneous segment death also collides with the existing bounded paper-death budget of twelve full presentations (`packages/client/src/scenes/ArenaScene.ts:171-176`, `:3063-3084`). Nuke-tier packs are selected for large impacts and are not a per-plate resource (`packages/client/src/scenes/arena/vfx.ts:732-748`).

Use a dedicated pooled `WormRig`: separate atlas-backed Images for head/body/weak/tail pieces, one shared owner update, one batched or ribbon-like ground-contact treatment, and a bounded shared trail. “Each segment is its own sprite” does not require its own generic character rig, Tween, emitter, Graphics object, or snapshot object.

### Hard guardrails

- **Object law:** at 16 active pieces, the live worm uses at most 40 Phaser GameObjects including sprites, shared AO, shared trail, source tells, and pooled transition visuals. There are no per-segment labels, Containers, Tweens, particle emitters, or ellipse shadows.
- **Batch law:** all ordinary segment art is installed into one atlas and the worm adds at most six draw calls in the representative scene. Damaged state is preferably tint/shader/decal, not a texture swap that breaks batching.
- **Allocation law:** steady-state worm update and render allocate zero arrays, vectors, closures, tweens, or particles per tick/frame after warm-up. Topology events borrow from bounded pools.
- **AO law:** use one chain-aware AO ribbon or a capped small set of pooled blobs. AO may not be baked into sprites and may not reveal a false collision boundary.
- **Trail law:** one shared trail history samples the owner path. It has a fixed point cap, degrades before exact telegraphs, and is disabled by reduced-motion/low-quality settings without changing fairness.
- **FX law:** one sever transaction plays at most one ordinary impact pack, one local shake, and one primary sound regardless of pieces removed. Only terminal death may request the nuke-tier pack, one global shake, and the full paper cascade.
- **Client-frame law:** in a ten-client-equivalent render stress scene with 80 total enemy-budget bodies, 120 hostile projectiles, 48 Echoes, and live telegraphs, the worm adds at most 2.0 ms p95 CPU frame time on the target desktop and 4.0 ms on the minimum supported machine. Whole-scene p95 stays below 16.7 ms and p99 below 33.3 ms at 60 fps.
- **Server-tick law:** the corresponding ten-player room stays below 25 ms p95 and 40 ms p99 simulation time, with no tick above the 50 ms budget during a 10-minute run. Topology and burrow ticks are included, not excluded as outliers.
- **Degrade law:** under pressure, decorative trail, dust, AO refinement, and extra sever scraps degrade in that order. Segment positions, exact tells, glints, hit reactions, and terminal payoff do not disappear.

## 10. The tail cannot own the climax or the economy

Today `damageEnemy()` drops one XP Echo at every killed enemy's position. A boss-kind death then clears the boss, pays its reward route, and opens the portal or advances the gauntlet (`packages/server/src/rooms/GameRoom.ts:3627-3671`). XP Echoes are bounded to 48 and merge value rather than discard it, which is a good transport foundation (`packages/shared/src/constants.ts:287-326`; `packages/server/src/rooms/GameRoom.ts:2590-2662`). It still needs an encounter-level reward ledger.

If every plate pays its full XP on sever, regrowth becomes a farm and the final head is a formality. If the last unit of shared HP happens to be removed by an offscreen tail tick, the boss can vanish into a small tail poof while the head is still lunging on another player's screen. If every segment is a boss kind, the first sever can produce the guaranteed boss loot and portal.

The finale must be owner-authored even when the lethal hit lands elsewhere.

### Hard guardrails

- **Single-terminal law:** only terminal core death pays boss salvage, guaranteed boss loot, portal/rift, Boss Rush advancement, boss-clear music, and the nuke/paper flagship beat. Each occurs exactly once.
- **Escrow law:** at least 75% of the boss's total XP value remains reserved for terminal death. All segment sever rewards combined are at most 25%, debited from a fixed encounter budget rather than minted per generation.
- **No-farm law:** a segment identity/generation can pay sever XP at most once, and regrowth never replenishes the encounter reward budget.
- **Echo law:** one topology transaction creates at most one aggregate sever Echo, even when several pieces break. Terminal death creates one reserved core Echo at the head or a visible chain centroid, then uses the existing bounded catch stream.
- **Threat-off law:** terminal core death disables every worm collider, damage source, projectile emitter, and pending resolve in the same 50 ms authoritative tick. Presentation may continue for 0.8-1.2 seconds, but it is harmless.
- **Head-payoff law:** a lethal body/tail hit starts a visible collapse that culminates at the head. The final sound, nuke pack, paper tear, boss loot, and reserved XP core do not fire from an anonymous tail plate.
- **Co-op-credit law:** reward remains squad-shared under the existing XP system. Target ownership, last hit, and which segment was struck cannot redirect or duplicate payment.

## 11. Art generation brief: render a kit, not sixteen unrelated worms

Do not generate one complete snake and slice it after the fact. The seams, lighting, plate scale, and connector perspective will not survive arbitrary rotation or segment-count changes. Generate a deliberately modular kit with consistent anchors.

### Required transparent sprites

1. `worm-head` — low, wedge-shaped hunting head with readable jaws/eyes and one exposed-core state that can carry a glint.
2. `worm-neck` — transition plate from the wider head to the standard body connector.
3. `worm-body-a`, `worm-body-b`, `worm-body-c` — silhouette variants sharing identical connector anchors and footprint; variation stays inside the plate, never at the seam.
4. `worm-weakpoint` — a distinct breakable armor plate whose exposed center remains readable at gameplay scale without bloom.
5. `worm-tail` — tapered terminal piece, important but visually subordinate to the head.
6. `worm-sever-cap-front` and `worm-sever-cap-back` — brief pooled paper/rift interior caps for a reconnect transition; no gore dependency.
7. `worm-burrow-mound` — a separate ground-contact/dust source sprite, not part of the collision silhouette.

### Image-generation prompt

> Top-down 3/4 orthographic game sprite for Dimension Drifters, a painterly paper-cutout dimensional worm boss segment, transparent background, segment points horizontally to the right, inked torn-paper edges, low serpentine silhouette, dark mineral chitin with restrained cyan-violet dimensional fissures, bold readable value grouping at 64-100 pixel gameplay size, connector plates at exact left and right centerline with an 18% underlap hidden beneath neighboring segments, lighting consistently from upper left, no perspective drift, no cast shadow, no ground, no particles, no trail, no bloom, no text, no border, no extra body pieces. Render one isolated modular asset centered with generous transparent padding.

Run that prompt once per required sprite with the asset role appended, keeping the same reference/style seed. Render at 512x512 source resolution (head may use 768x512), then normalize pivots and downsample during the asset pipeline. All standard body variants must share the same canvas, longitudinal centerline, connector anchor pair, visible plate length, and overlap mask. Runtime rotates each sprite to the chain tangent; do not generate eight directional copies.

### Art guardrails

- Head, weakpoint, ordinary body, and tail must be distinguishable in grayscale at 50% gameplay scale.
- No baked shadow, dust, glow, crack telegraph, safe boundary, or motion trail; those would rotate with the sprite and lie about ground contact.
- Connector underlaps may hide spacing error, but visible opaque art may not extend more than 6 px beyond the authoritative segment capsule at target scale unless it is obviously non-solid paper fringe.
- Damaged variants keep the same outer silhouette and anchors. Do not make collision appear to shrink before the authoritative sever tick.
- The worm stays low, fast, and horizontal. It must not borrow Vastaghar's towering legs, quake rhythm, screen-filling vertical framing, or gold-scale hierarchy; the two flagships should be recognizable from silhouette and core verb alone.

## 12. Required test matrix

The existing boss tests pin one-body phase selection, telegraph settle/cancel, projectile/add budgets, active hazards, melee planting, blink destination, and deterministic emits (`packages/server/src/rooms/BossController.test.ts:111-445`). None of those tests exercises topology or chained authority. The worm needs its own deterministic and networked matrix.

### Simulation and lifecycle

- 8/12/16 pieces on straight, maximum-curvature, arena-edge, pit-adjacent, Cover-adjacent, and Scar-zone paths.
- Middle, adjacent-middle, tail, head-armor, and simultaneous multi-sever at every phase threshold.
- Sever on the same tick as cast start, resolve, burrow start, emerge resolve, terminal core death, parry, explosion, and projectile pierce.
- Regrow/add while a player occupies the socket, while the tail is offscreen, and while the cap is full.
- Restart, boss-picker replacement, rift descent, belt victory, Boss Rush transition, wipe, disconnect, and join-in-progress during every topology state.
- Golden deterministic digest for identical seed, input script, damage order, topology event order, and final reward ledger.

### Network and interpolation

- 0/100/200 ms RTT, each with 0/30 ms jitter and 0/1% loss; include 200 ms reliable-patch burst stalls.
- Validate spacing, tail amplification, shared topology epoch, source visibility, glint/footprint timing, and one-hit ledgers from the rendered capture and authoritative log.
- Force a topology patch and a position patch into the same catch-up broadcast; force them into adjacent broadcasts; late-join on each side of the boundary.
- Measure encoded bytes and delivered bytes, not only in-memory state.

### Combat and co-op

- Solo, two-player split across one viewport, four-player surround, and ten-player maximum with one or more downed players.
- Every weapon family plus explosion, spin, chain, burn, quake, parry counter, and piercing projectile against straight and coiled bodies.
- Verify one attack's raw segment contacts, core clamp, local armor breaks, XP debit, and final loot exactly.
- Verify no player receives multi-segment contact stacks, unmarked offscreen emergence, body/pit pinning, or a punish window they cannot reach.

### Performance and presentation

- 10-minute stress capture at 80 total enemy-budget bodies, 120 hostile projectiles, 48 Echoes, maximum live tells, repeated sever/regrow, and the final paper/nuke sequence.
- Record server p50/p95/p99/max tick, patch bytes, process egress, client p50/p95/p99 frame time, allocations, live GameObjects, draw calls, texture switches, pools, and FX drops.
- Repeat with reduced motion, optional FX packs missing, low quality, 1280x720, ultrawide, and high-DPI rendering. Fairness success rate may fall by no more than five percentage points when optional art is absent.

## Non-negotiable ship checklist

- [ ] The encounter has one owner, one terminal core, one boss bar, one reward ledger, and one cleanup path.
- [ ] The documentation calls the giant a multi-sprite precedent, not a multi-authority precedent.
- [ ] Pieces are not ordinary autonomous `EnemyState` enemies inheriting trash/boss lifecycle by accident.
- [ ] Any synced schema addition is append-only and bumps the then-current `SCHEMA_VERSION`.
- [ ] Default active count is 10-12; hard launch count is 16 unless real measurements approve more.
- [ ] Worm-specific steady-state sync is at most 300 B/patch/client and 6 KB/s/client; ten-client egress is at most 60 KB/s.
- [ ] Worm pieces reserve their equivalent share of `MAX_ENEMIES`; the encounter does not smuggle bodies outside caps.
- [ ] One batch snapshot ring samples one tick and topology generation; no render-time parent recursion or per-link tick propagation exists.
- [ ] Tail RMS error is no more than 1.5x head error, spacing meets the p99 bound, and no segment crosses its neighbor under the full network matrix.
- [ ] Burrow/dive/emerge use explicit tick-stamped states and epochs, not the 260 px interpolation snap threshold.
- [ ] Damaging emergence shows its complete exact footprint for at least 0.90 seconds authoritatively and 600 ms under the 200 ms RTT profile.
- [ ] Attacker coil/source, painted path, exact underlay, and segment/head glint agree on one committed route and resolve tick.
- [ ] Passive locomotion and topology correction are non-damaging; every damaging sweep is a named telegraphed attack.
- [ ] One worm attack can hit and knock a player at most once, irrespective of overlapping pieces or catch-up substeps.
- [ ] Swept capsule damage and the rendered exact footprint use the same inflated hull and leave the required escape route.
- [ ] Generic enemy collision never relaxes siblings or rewrites the telegraphed chain.
- [ ] Player attacks deduplicate by owner; one attack contributes at most 1.5x nominal core damage and piercing obeys its two-contact rule.
- [ ] Middle death does not split in v1; topology transactions use stable ids, generations, and one `topologySeq` edge.
- [ ] Forming, severing, reconnecting, and burrowed pieces have explicit hitbox/targetability laws and never spawn damage inside a player.
- [ ] Regrowth conserves remaining effective HP, never reuses ids, and never replenishes XP.
- [ ] Segment-owned casts cancel visibly when their emitter disappears; unrelated casts do not vanish merely because indices changed.
- [ ] Independent co-op cameras keep agency; offscreen sources, head location, punish access, target distribution, and escape space pass at 1280x720.
- [ ] The dedicated worm renderer stays within 40 live GameObjects, six draw calls, zero steady-state allocations, and the client/server frame budgets.
- [ ] AO and trails are shared, pooled, cosmetic, and first to degrade; exact tells and glints never enter that budget.
- [ ] A sever transaction dispatches at most one ordinary pack/shake/sound. Only terminal death owns the nuke-tier pack and global paper cascade.
- [ ] Segment rewards consume at most 25% of fixed boss XP; at least 75%, guaranteed loot, salvage, portal, and progression remain terminal-only.
- [ ] Terminal death disables all threat in one 50 ms tick and culminates at the head even if the lethal hit landed on the tail.
- [ ] Join-in-progress, restart, boss swap, dimension change, belt, Boss Rush, wipe, and disconnect leave zero orphan pieces, colliders, casts, trails, or rewards.
- [ ] The generated art kit uses consistent anchors and underlaps, remains readable in grayscale, and contains no baked shadows, telegraphs, trails, or bloom.

If any one of these fails, adding more body plates is not “more Terraria.” It is multiplying an unresolved authority bug. The worm earns flagship status when players can remove pieces and feel the fight transform while the network, camera, collision, economy, and finale continue to behave as though there is exactly one boss.
