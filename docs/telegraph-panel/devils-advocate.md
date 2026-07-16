# Devil's advocate: the body cannot be the hitbox

## Ruling

The playtest verdict is right about the symptom and dangerous as a prescription. A red rectangle filling independently of the attacker is not anticipation; it is a progress bar laid on the floor. The attacker must own the action through a committed pose, and the world should react before the hit through cracks, frost, gathering light, pressure, dust, or another causally appropriate effect.

I nevertheless reject **diegetic-only telegraphing**. At Dimension Drifters' scale, animation and painted effects cannot be the sole answer to “where can I stand?” Thirty simultaneous wind-ups become silhouette noise; small or occluded bodies stop carrying timing; optional art can be absent; and a pose driven from a 20 Hz patch can begin after the authoritative cast already has. Abstract geometry exists because exact boundaries remain legible when theme, scale, camera, network, and spectacle are all hostile to legibility.

The acceptable principle is:

> **The attacker explains why. The effect explains what. A restrained authoritative underlay says exactly where and when.**

The underlay is load-bearing for fairness. Animation and effects are load-bearing for causality, anticipation, ownership, and charm, but they are never the only collision contract.

## The current abstraction is architectural, not merely an art mistake

The current result looks arbitrary because the protocol contains geometry but almost no performance semantics:

- A telegraph row carries shape, origin, two dimensions, rotation, fill, danger, and a small `kindTag`; it does **not** carry attacker id, cast start/resolve tick, pose family, emitting part, or effect prelude (`packages/shared/src/state.ts:185-205`).
- `BossController` creates the whole cast plan once, mints rows, advances `t`, and applies the payload when the timer peaks (`packages/server/src/rooms/BossController.ts:189-205`, `packages/server/src/rooms/BossController.ts:351-385`). This is a strong authority model, but it gives the client no semantic bridge from cast to body.
- The client gives enemies a generic rig scale and optionally equips their weapon; it triggers an attack animation only when `EnemyState.atkSeq` changes (`packages/client/src/scenes/ArenaScene.ts:1789-1837`). Boss melee is routed straight from the controller sink into `applyBossMelee`, with no corresponding attack-sequence bump (`packages/server/src/rooms/GameRoom.ts:2572-2577`, `packages/server/src/rooms/GameRoom.ts:3563-3594`).
- The generic rectangle is literally rendered as a growing filled bar inside a fixed outline (`packages/client/src/scenes/ArenaScene.ts:2112-2123`). With no source-performance field to consume, the client cannot make the boss meaningfully wind up just because the row happens to be a lane.

This also explains why “make every attack bespoke” is the wrong repair. Boss definitions were deliberately built as reusable data whose modules name a primitive, cooldown, wind-up, initial delay, and numeric parameters (`packages/shared/src/bosses.ts:15-39`). The current registry has twelve picker boss definitions plus five additional dimension-finale boss kinds mapped onto tested fights (`packages/shared/src/bosses.ts:923-952`). A solution that needs a new animation implementation for every module on every one of those 17 boss-kind surfaces destroys the framework's scaling premise.

## Challenge 1: thirty honest wind-ups still make unreadable soup

**Verdict: fatal for diegetic-only; manageable for a hybrid with salience control.**

The worst case is not one boss in an empty room. The simulation already permits 80 enemies, and the debug summon cap is explicitly 30 at once (`packages/shared/src/constants.ts:218-224`). Every visible enemy is animated each unfrozen frame, and the same pass also draws every enemy wind-up and all generic telegraphs into the shared tell layer (`packages/client/src/scenes/ArenaScene.ts:1924-2005`). If 30 bodies simultaneously whiten, crouch, lift weapons, grow elemental halos, and throw anticipation particles, the player does not see 30 clear sentences. They see one flickering paragraph.

Body animation has three scale failures that an exact footprint does not:

1. **Occlusion:** the dangerous limb can sit behind another rig, a boss part, a projectile cloud, or screen-edge cropping.
2. **Angular ambiguity:** at zoomed-out size, “raised arm for lane,” “raised arm for slam,” and “raised arm for summon” collapse into the same few pixels.
3. **Source overload:** even individually good poses cease to be separable when many attackers share the same anticipation beat.

The strongest version of the diegetic proposal is still worth keeping. A planted boss, a whole-body coil, and a weapon or limb aimed through the future attack create causality that a detached rectangle never will. `BossController` already plants a boss during parryable melee so its warning and hit remain co-located (`packages/server/src/rooms/BossController.ts:170-173`). The §40 rig also proves that a shared vocabulary can alter weapon, hands, torso lean, squash, and aim instead of merely rotating a sprite (`packages/client/src/entities/SpriteRig.ts:783-806`, `packages/client/src/entities/SpriteRig.ts:980-1115`). Those are excellent *source tells*.

They are not sufficient *area tells*. At crowd scale, every committed attacker may still perform its cheap pose, but anticipation VFX need a threat budget: reserve full effects for the boss, the local player's targeted threats, and a small number of nearest/highest-damage casts; reduce the rest to pose plus underlay. The footprint never enters that budget. A culled crack is lost charm; a culled safe boundary is an unfair hit.

## Challenge 2: animation-only punishes colorblind, low-vision, low-spec, and zoomed-out play

**Verdict: fatal if hue, silhouette, or optional art is the sole channel; manageable with redundant coding.**

The white parry-tell system contains the right lesson. It does more than tint an attacker. During enemy wind-up it combines a white body-adjacent disc, a shrinking rhythm ring, and the real melee cone (`packages/client/src/scenes/ArenaScene.ts:1951-2001`). Incoming parryable projectiles likewise use a bright core plus a ring that tightens as the slug arrives (`packages/client/src/scenes/ArenaScene.ts:3757-3783`). Luminance, inward motion, proximity, and footprint reinforce the “white = parry” category. That is already a hybrid, and it is stronger than either body color or ground geometry alone.

The mistake would be reducing the system back to “the attacker turns white” or “red means dodge.” Colorblindness is not the only concern: a small white limb against bloom, snow, or another effect can disappear even with perfect color perception. The parry/dodge distinction therefore needs a non-hue grammar on the fairness layer:

- **Parryable:** white/high-luminance double edge, inward timing ticks or a tightening pulse, and the established white source glint.
- **Dodge-only:** warm danger hue plus a different edge pattern—outward chevrons, broken/hazard hatching, or another motion direction that cannot be confused with the parry rhythm.
- **Both:** stable, screen-space minimum line width and timing marks that survive zoom; never body tint alone.

Low-spec behavior makes the same point more bluntly. The twelve component packs are optional and silently fall back when loading or decoding fails (`packages/client/src/vfx/fx-composer.ts:152-174`), and the composer permits only ten pack plays per render frame (`packages/client/src/vfx/fx-composer.ts:183-204`). The eight impact flipbooks are also explicitly optional, with procedural feedback surviving a missing strip (`packages/client/src/scenes/arena/vfx.ts:15-47`). Any cue allowed to disappear through an asset failure, quality setting, or frame budget is disqualified from carrying fairness.

## Challenge 3: bespoke animation does not scale across the boss roster

**Verdict: fatal as a per-attack production policy; manageable as a small semantic vocabulary with capped hero exceptions.**

There is a good steelman here. “Data-driven” should not mean “visually generic.” Shared primitives can select shared performance families, and the sliced rigs can produce substantially different poses without new renders. The §40 weapon contract already maps one weapon into arc, orbit, chop, pivot, thrust, spin, or punch rather than authoring a new animation per weapon (`packages/shared/src/weapons.ts:38-49`). Boss parts can use the same idea: additive body/hand/weapon/part transforms chosen by attack semantics.

What scales is a compact vocabulary such as:

1. melee coil / arc release;
2. overhead lift / ground slam;
3. braced beam charge / sweep;
4. shoulder-down dash compression / launch;
5. core gather / radial release;
6. hands-out summon channel;
7. limb plant / ground eruption;
8. blink collapse / reappearance.

Each vocabulary entry owns anticipation, commit, resolve, and recovery phases. A boss module selects one family and a few normalized parameters—aim, handed part, amplitude, phase bias—not a new block of animation code. A small number of signature bosses may override a phase or part pose, but that exception budget must be explicit and capped. If readability requires one-off tuning for every attack, the vocabulary has failed.

The existing painted inventory is ample for *semantic recipes*, not for 17 bespoke pipelines. The composer enumerates twelve reusable component packs (`packages/client/src/vfx/fx-composer.ts:17-30`), the particle manifest enumerates 96 element-by-shape sheets (`packages/client/src/vfx/particle-manifest.ts:9-106`), and eight elemental impact strips already exist as six-frame payoff animations (`packages/client/src/scenes/arena/vfx.ts:15-18`, `packages/client/src/scenes/arena/vfx.ts:26-39`). Recombine them: quake/ember components can seed cracks, frost shards and wisps can creep inward, holy/arcane motes can gather toward an emitter, and shock/steel shapes can charge a beam. Do not stretch an impact flipbook across a wind-up or pretend a decorative particle edge is the hitbox.

## Challenge 4: a 20 Hz pose starts late unless the protocol carries time

**Verdict: fatal if the pose is triggered from patch arrival; manageable with an authoritative cast epoch.**

The server runs at 20 Hz, or one 50 ms step (`packages/shared/src/constants.ts:15-18`). During a cast, the controller subtracts that step, updates `t`, and resolves the payload in the same authoritative loop when the remaining duration crosses zero (`packages/server/src/rooms/BossController.ts:189-205`). Meanwhile remote enemies are intentionally rendered 120 ms behind the server-tick timeline for smooth motion (`packages/shared/src/constants.ts:100-108`). Telegraph rows bypass that interpolation specifically so the fixed danger point is current even while the body is visually behind (`packages/shared/src/state.ts:180-183`).

That is a hard contradiction for naïve diegetic synchronization. Trigger a pose when a row first appears and it starts one patch plus transit time late. Drive it from the displayed interpolated body timeline and it can be roughly 120 ms behind the authoritative danger. Smooth successive `t` values and it looks pleasant while becoming a dishonest clock; the existing enemy white tell already has to smooth the 20 Hz ramp but snap immediately to zero at the strike (`packages/client/src/scenes/ArenaScene.ts:1953-1964`).

Do not client-predict an AI decision. Instead, extend the cast contract with at least:

- `castSeq` / stable cast id;
- `attackerId` and, where relevant, emitting part;
- `startTick` and `resolveTick` (or authoritative durations tied to a start tick);
- attack/tell family and pose id;
- fixed target/aim and the existing exact geometry;
- parry/dodge class and effect-prelude recipe.

On first observation, the client samples the pose at the **current authoritative phase** derived from the synced server clock; it does not replay phase zero. Later `t` values correct the clock rather than act as animation keyframes. Planted casts can safely animate around the fixed attacker root; mobile or teleporting casts must keep their exact footprint anchored to the cast geometry even if the cosmetically interpolated body trails. A minimum authored wind-up budget should cover one simulation step plus expected network jitter, but a delayed packet may still shorten the visible pose. That is precisely why the authoritative underlay remains mandatory.

## Challenge 5: demoting geometry before fixing it makes the game less fair, not more diegetic

**Verdict: fatal until TG-1 and QK-1 are fixed.**

The abstract layer is only defensible if it is exact. In top-down mode the current boss renderer does match circle, lane, cone, and ring parameters to the authoritative player-center convention (`docs/VFX_HITBOX_AUDIT.md:121-125`). In belt mode it projects only the origin and leaves world dimensions unchanged, producing 2× depth scale and displaced ring danger; the audit correctly ranks TG-1 P0 (`docs/VFX_HITBOX_AUDIT.md:127-137`). A thin wrong line is not better than a fat wrong rectangle.

QK-1 is the warning against letting a beautiful effect inherit boundary authority. The procedural quake fallback shows only `0.366R` vertically and hides `0.634R`—63.4 percent—of damaging vertical reach in top-down play (`docs/VFX_HITBOX_AUDIT.md:111-119`). That is not a polish defect. It is a surprise-hit generator.

Therefore the order is non-negotiable:

1. Correct every telegraph vertex, axis, ring band, and quake ellipse through the belt/top-down projection.
2. Establish automated render-versus-hitbox captures for every shape, orientation, camera mode, and edge case.
3. Only then lower fill opacity, remove the arbitrary progress-bar mass, and promote pose/effect storytelling around the exact line.

Diegetic VFX may occupy or approach the dangerous area, but they should be clipped to the authoritative footprint or remain obviously texture—not a crisp false boundary. The thin underlay must remain visually dominant at the actual safe/danger edge even when cracks, frost, smoke, or light extend decoratively within it.

## Fatal versus manageable

| Proposal or risk | Ruling | Condition |
|---|---|---|
| Remove abstract footprints and trust body/effects alone | **Fatal** | No body pose can guarantee exact safe space under crowding, occlusion, zoom, quality reduction, and network delay. |
| Use color or attacker whitening as the only parry/dodge code | **Fatal** | Preserve white as the category, but pair it with distinct edge pattern and timing motion. |
| Trigger a wind-up pose when a 20 Hz state change arrives | **Fatal** | Sync an authoritative cast epoch and sample the current phase. |
| Author a unique animation/VFX implementation for every attack across 17 boss kinds | **Fatal** | Use a small shared tell vocabulary and capped signature overrides. |
| Make optional packs, particles, or flipbooks carry safe-space truth | **Fatal** | Optional assets may enrich or disappear; fairness cannot. |
| Thirty simultaneous poses/effects | **Manageable** | Cheap pose for all committed attacks, threat-prioritized full VFX, cadence staggering, and invariant footprints. |
| Demote the current heavy fill to a thin underlay | **Manageable and desirable** | Only after TG-1/QK-1 correctness, with minimum screen-space edge visibility. |
| Reuse existing painted ingredients for cracks, creep, gathering, and payoff | **Manageable and desirable** | Treat them as semantic recipes, not boundaries; keep budgets and fallbacks. |

## The hybrid contract I would accept

1. **Authoritative cast descriptor.** Every warned attack exposes attacker, cast epoch, resolve epoch, attack/tell family, danger class, fixed aim/target, and exact active geometry. `t` remains a correction/fallback, not the sole animation clock.
2. **Fairness underlay—always on, exact, quality-invariant.** Render the true projected boundary with a thin edge, sparse timing motion, and little or no opaque fill. Use screen-space minimum width, top combat-layer visibility, colorblind-safe patterns, and the same geometry as the server. Cancels disappear; resolves reach an unambiguous terminal beat.
3. **White parry language—preserved, not overburdened.** White/high luminance still means “parry this,” but the inward rhythm and double-edge pattern carry the category without hue. Red/warm dodge danger gets a different pattern and motion. The footprint communicates *where*; the rhythm communicates *which response and when*.
4. **Diegetic source pose—mandatory for causality, not trusted as a ruler.** The attacker uses the shared §40-style vocabulary plus boss-part poses from wind-up through recovery. Aim and committed part must agree with the cast descriptor. Boss-specific overrides are rare, declarative, and capped.
5. **Foreshadow effect—semantic, reusable, budgeted.** Ground cracks precede eruption, frost creeps before freeze, particles gather toward a light/beam source, dust compresses before dash, and so on. Use the twelve component packs and 96 particle packs for anticipation; reserve the eight impact flipbooks for resolve/payoff. Low-spec or missing-art fallback removes texture, never information.
6. **Crowd salience policy.** The boss owns a reserved full-VFX slot. Nearby/high-damage/on-player casts receive the remaining full preludes; distant or redundant casts retain pose plus exact underlay. Server cadence should avoid gratuitous synchronized starts, but correctness cannot rely on perfect scheduling.
7. **Release gate.** No rollout until belt geometry and quake reach pass the audit, every tell remains readable in grayscale and at minimum zoom, missing optional assets leave the same dodge/parry success rate, and artificial 50/120/250 ms delivery tests show that poses catch up without extending or restarting the authoritative window.

The final hierarchy is deliberately asymmetric. **For FAIRNESS, the authoritative thin underlay and its response/timing pattern are load-bearing. For charm, causality, threat ownership, and satisfaction, the attacker pose and foreshadow effects are load-bearing. Impact art is payoff.** If the diegetic layers fail, the game may look plain but must remain fair. If the underlay is missing or wrong, the build is not shippable, however beautiful the wind-up looks.
