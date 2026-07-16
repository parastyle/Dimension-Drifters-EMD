# Technical implementer: make the attacker the tell, keep geometry as the ruler

## Recommendation

Ship a three-layer wind-up and keep the existing server payload contract:

1. **Source:** the boss rig performs a committed, attack-specific anticipation pose driven by the live telegraph phase.
2. **Foreshadow:** a small, reusable painted recipe explains what is about to happen: cracks, frost creep, inward-moving motes, dust compression, or gathering light.
3. **Fairness underlay:** the exact authoritative footprint remains, but as a thin, low-mass painted edge rather than a red area-progress bar.

Resolve VFX remain a fourth, short-lived payoff layer. Optional painted art may disappear under load or failed asset decode; the exact edge and the white parry grammar may not.

This first shipment needs **no protocol change**. The row already has enough information to choose and phase a shared pose: shape, fixed geometry, aim, `t`, parry/dodge class, and `kindTag` (`packages/shared/src/state.ts:185-205`). `ArenaState.bossKind` identifies the one active boss kind (`packages/shared/src/state.ts:318-325`), and `ArenaScene` already owns a rig for every enemy (`packages/client/src/scenes/ArenaScene.ts:1789-1819`). A client-only resolver can therefore find the rig whose `EnemyState.kind === state.bossKind`, select a dominant winding row, and drive a normalized pose from that row.

Do not overload `EnemyState.windup`. That field explicitly means a **parryable** enemy attack and the current renderer always turns it into a white source disc/ring (`packages/shared/src/state.ts:153-156`, `packages/client/src/scenes/ArenaScene.ts:1951-2001`). Reusing it for red dodge-only boss attacks would corrupt the established response language.

## What is already synchronized

The existing wire is stronger than the current presentation suggests.

| Field/lifecycle | Existing meaning | Presentation use |
|---|---|---|
| `id` | Stable server-minted row id | Own a cached underlay path and pooled painted prelude until removal. |
| `shape` | Circle, ring, cone, rect, arc-sweep, or point warning | Select exact boundary construction and a broad pose family. The enum is at `packages/shared/src/boss-primitives.ts:28-35`. |
| `x`, `y` | Fixed world-space footprint origin | Place the fairness edge and ground prelude. It is deliberately not parented to the interpolated body (`packages/shared/src/state.ts:180-183`). |
| `a`, `b`, `rot` | Primary/secondary dimensions and authoritative orientation | Build exact geometry; use `rot` as the body/limb aim for cone, beam, and dash poses. |
| `t` | Authoritative wind-up progress `0..1` | Sample anticipation directly; never start a fresh local animation when a late patch arrives. |
| `danger` | `0` white/parryable, `1` red/dodge-only | Preserve white source glint and inward rhythm for parry; use a warm broken edge for dodge. |
| `kindTag` | Cosmetic/semantic sub-style | Select slam, pool, summon/blink, burst, beam/dash, ring, melee, or quake recipes. |
| row removal | Resolve after an observed full row, or cancellation before full | Destroy prelude either way; play payoff only after observed `t=1`. |

`TgSpec` already exposes the same shape/geometry/danger/tag inputs to every boss primitive (`packages/shared/src/boss-primitives.ts:50-60`). `GameRoom` copies them into `TelegraphState`, initializes `t=0`, mutates progress, and can update active geometry (`packages/server/src/rooms/GameRoom.ts:2534-2562`). The controller computes a cast plan once, creates all of its rows, and stores the wind-up duration (`packages/server/src/rooms/BossController.ts:351-385`). Each server step advances one normalized `t` for every row in the cast and resolves at the peak (`packages/server/src/rooms/BossController.ts:189-205`).

Two lifecycle details are load-bearing:

- The controller pins a resolved row to `t=1` and retains it through a broadcast generation before deletion, so clients can distinguish resolve from phase-change/death cancellation (`packages/server/src/rooms/BossController.ts:181-205`). The older prose in `state.ts` saying deletion happens on the resolve tick is stale; implement against the controller behavior.
- Beam, expanding-ring, and dash casts transfer their first row to an active hazard. That row can stay at `t=1` while its geometry moves until the hazard expires (`packages/server/src/rooms/BossController.ts:198-202`, `packages/server/src/rooms/BossController.ts:220-281`). A wind-up pose must therefore run only while the chosen row is below terminal progress; it must not hold the boss in anticipation for the whole live beam/ring/dash.

The client already caches terminal state and branches payoff by `kindTag` (`packages/client/src/scenes/ArenaScene.ts:2038-2083`). Preserve that edge-trigger instead of inventing a second resolve timer.

## Client-only wind-up driver

Add a small client enum and three scalar inputs, not a new animation object allocated every frame:

```ts
const enum TelegraphPose {
  None,
  Arc,
  Overhead,
  Charge,
  Gather,
  Cast,
  Stomp,
}

// Scalars written before SpriteRig.animate(); reset to None/0 every frame.
pose: TelegraphPose;
poseT: number;
poseAimWorld: number;
```

These can be optional scalar fields on the existing `RigAnim`, or private scalars set through `SpriteRig.setTelegraphPose(pose, t, aim)`. The setter is preferable if keeping player `RigAnim` narrow matters. Either path is client-only.

In `ArenaScene.animateEnemies`, resolve the boss and its pose **before** the current `rig.animate(...)` call at `packages/client/src/scenes/ArenaScene.ts:1942-1947`. The current order animates first and only then reads `EnemyState`, which is too late to influence that frame.

The resolver should:

1. Return `None` when `bossKind` is empty or no matching boss rig exists.
2. Consider rows with `t < 0.999`; a newly created `t=0` row is already a valid anticipation start.
3. Choose one dominant body pose, not blend all concurrent casts. Prefer the row nearest resolve; break ties by response-critical priority: parry melee/quake, charge/beam, slam, radial/ring, pool/summon.
4. Use `row.rot` for cone/rect aim. For a target-space circle or point warning, aim from the boss render root toward `(row.x,row.y)`. Radial/ring gathers are symmetric and need no directional aim.
5. Sample the normalized anticipation at the observed `row.t`. If smoothing is added, it may extrapolate visually only to `0.98`; terminal commit/release still waits for an observed `t=1`. Never restart from zero, never allow a smoothing tail to extend the danger window, and snap a cancelled source out of anticipation into a short cosmetic recovery.

The server is locked to 20 Hz (`packages/shared/src/constants.ts:15-18`) while remote bodies intentionally render 120 ms behind the server timeline (`packages/shared/src/constants.ts:100-106`). That means a pose sampled from direct telegraph state can be current in phase while its root is a delayed body position. This is acceptable for the first pass because the exact ground footprint stays authoritative. For source-rooted casts, improve causality without changing the wire by extending the controller's existing melee plant rule (`packages/server/src/rooms/BossController.ts:170-173`): mark a pending cast `sourceRooted` when one of its planned rows begins at the trigger-time boss origin, and suppress ordinary movement for that wind-up. This covers beam, ring, dash, radial, and the first footfall while leaving target-space landing zones and blink destinations free.

The current single-boss contract makes the no-protocol resolver practical. If mixed non-boss row producers during a boss fight or true multi-boss encounters become normal, append only `ownerId: string` to `TelegraphState` and stamp it in the two row-creation paths. `shape + kindTag` still selects the pose; an additional pose field is not justified yet. A cast epoch, emitting part, or bespoke pose id is a larger protocol revision and should be driven by demonstrated content needs, not added speculatively.

## Pose vocabulary and painted recipes

Use the existing section 40 motion shapes rather than build a second procedural rig. `SpriteRig` already dispatches arc/orbit/chop/pivot/thrust/spin from a normalized pose clock (`packages/client/src/entities/SpriteRig.ts:761-785`) and already accumulates body rotation, squash/stretch, hand offsets, and weapon placement (`packages/client/src/entities/SpriteRig.ts:1108-1115`, `packages/client/src/entities/SpriteRig.ts:1234-1269`). External telegraph poses should reuse the **anticipation half** of those envelopes and add only `Gather`, `Cast`, and `Stomp` boss-part poses.

| Current tag/shape | Source pose | Foreshadow recipe | Exact underlay |
|---|---|---|---|
| `0` circle: landing/slam | `Overhead`: lift front/both hands, counter-lean, plant/squash; large bosses lift the relevant foot/leg rather than merely tinting the body. | One persistent crack/ground component fades in from the center; sparse dust at phase milestones. | Stable circle/ellipse edge; no growing red disc. |
| `1` circle: corrosive pool | `Cast`: hands open and lower toward the target; torso recoils from the release. | Toxic ground stain at low alpha plus inward toxic wisps/bubbles. | Broken warm hazard edge and sparse inward hatch. |
| `2` point warning: summon/blink | `Cast`: hands draw inward, body narrows; blink may briefly collapse the root silhouette. | Holy/arcane/void motes converge on the destination; a small core brightens. | Point core plus tightening response ring. |
| `3` ring: radial burst | `Gather`: arms/core compress, then spread at terminal phase. | Motes and sparks travel **toward** the attacker; gathering light, not an early explosion. | Thin source ring with outward dodge ticks. |
| `4` rect: beam or dash | `Charge`: use the thrust/plant vocabulary, align shoulders/hands/weapon to `rot`, compress along the attack axis. | Shock/steel light gathers at the emitter for a beam; dust pulls backward inside the lane for a dash. | Two exact lane rails, end cap, and sparse advancing chevrons; never a filling rectangle. |
| `5` ring: expanding hazard | `Gather`: wide stance and core compression; release the pose when the row becomes the active `t=1` hazard. | Core pressure ring and inward motes only during wind-up. | Exact projected annular band and safe gap during the live phase. |
| `6` cone: boss melee | `Arc`/`Pivot` from the section 40 vocabulary, with weapon/hand visibly drawn back opposite `rot`. | Minimal white glint at the attacking hand/edge. | White double edge plus inward rhythm ticks: this is parry, not red dodge. |
| `7` circle: footfall quake | `Stomp` built from `Overhead`: weight shifts to the planted side while the striking foot/limb lifts, then drops at commit. | Quake crack grows under the foot and into aftershock sites; dust pressure stays low until impact. | White double ellipse because the authored attack is jump-or-parry (`packages/shared/src/boss-primitives.ts:296-315`). |

The tags above are currently magic numbers spread between primitive producers and `ArenaScene`. Introduce a shared `TelegraphKindTag` enum with the **same numeric values** before adding recipes. That is a source cleanup, not a wire change. Beam and dash intentionally share tag 4 today (`packages/shared/src/boss-primitives.ts:416-458`, `packages/shared/src/boss-primitives.ts:503-544`), so their first pose can share a directional charge. The active hazard already knows which one it is server-side; no gameplay ambiguity is introduced by a common anticipation silhouette.

Boss rigs are already sliced into optional body/hands/feet and normalize all builds through the same procedural animator (`packages/client/src/entities/SpriteRig.ts:94-103`, `packages/client/src/entities/SpriteRig.ts:115-123`). Apply offsets only to parts that exist. A hands-only caster gathers with hands; a leg-heavy colossus shifts and lifts feet; a blob compresses its body. Do not make missing parts a fallback to “flash the whole boss red.”

## Reuse the painted inventory without turning it into the hitbox

All required art is already boot-addressable. The composer enumerates twelve component packs (`packages/client/src/vfx/fx-composer.ts:17-30`), the particle manifest contains the 12 element by 8 shape matrix (`packages/client/src/vfx/particle-manifest.ts:9-107`), and the impact path exposes eight optional six-frame elemental strips (`packages/client/src/scenes/arena/vfx.ts:15-39`).

Create a narrow `TelegraphFxPool` keyed by row id:

- At row creation, acquire at most one persistent ground/component image and one optional emitter/core image.
- Update position, rotation, scale, and alpha in place from cached row geometry and `t`.
- Emit only small milestone bursts, for example at `t=.3`, `.65`, and `.9`; do not emit every render frame.
- On cancellation, fade/release pooled prelude objects without payoff. On observed terminal resolve, release them and let the existing cache path play the impact.

Expose a small semantic allow-list rather than duplicating private component indexes at call sites. The composer has already audited quake crack as `quake-burst` ground index 6, frost ground as index 8, toxic ground as index 8, and ember ground as index 10 (`packages/client/src/vfx/fx-composer.ts:63-67`, `packages/client/src/vfx/fx-composer.ts:82-113`, `packages/client/src/vfx/fx-composer.ts:133-139`). Those static components can creep/fade during anticipation. Motes, wisps, rings, sparks, and splats come from the typed particle sheets.

Do **not** call `playFxPack` every frame of a wind-up. It instantiates component Images and self-destroying tween chains, and it has a ten-pack-per-frame admission budget (`packages/client/src/vfx/fx-composer.ts:183-204`, `packages/client/src/vfx/fx-composer.ts:238-253`). Likewise, `particleBurst` creates one Image and tween per particle (`packages/client/src/vfx/particles.ts:38-74`), so anticipation uses explicit low counts and a scene-wide emission budget. Whole packs and the six-frame strips are resolve punctuation only.

Paint must never become a false crisp boundary. Keep crack/creep decals at roughly 85% of the authoritative footprint, keep beam/dash streaks between the exact rails, and let any decorative overhang be soft and low-alpha. The thin geometry edge remains the only sharp safe/danger boundary.

## Restyle `telegraphGfx` into a real underlay

Today one high-depth `telegraphGfx` is created for the white tell layer (`packages/client/src/scenes/ArenaScene.ts:845-850`), cleared at the beginning of every enemy animation frame, then reused for enemy white tells, all generic telegraphs, projectile tells, and the rift channel (`packages/client/src/scenes/ArenaScene.ts:1924-2005`, `packages/client/src/scenes/ArenaScene.ts:3757-3798`). Generic rows are drawn by `renderTelegraphs`, and `drawTelegraph` renders filling dots, bars, wedges, and discs (`packages/client/src/scenes/ArenaScene.ts:2015-2037`, `packages/client/src/scenes/ArenaScene.ts:2087-2164`). That shared high overlay is why geometry reads as detached UI laid over the attacker.

Split it into:

- `telegraphGroundGfx`, in the ground/VFX depth band above terrain and zones but below actor rigs, for exact footprints and their restrained painted-edge echo;
- the existing high `telegraphGfx`, retained for source-adjacent white parry rings, incoming projectile rings, and other cues that must remain visible over bodies.

For every danger footprint, draw a stable boundary from the first observed row:

- one dark 3-4 px keyline for terrain contrast;
- one 1.5-2 px exact response-colored line;
- a deterministic dry-brush echo or hatch **inside** the boundary only;
- no opaque fill, or at most a `<= .04` alpha wash that does not grow with `t`.

Timing moves along the edge rather than filling the area. Parryable footprints use a continuous white double edge and ticks that converge inward. Dodge-only footprints use a warm broken/hazard cadence and outward-moving chevrons. The source pose and painted prelude carry most of the countdown; the line carries exact space and response class.

## TG-1 P0: project geometry, not just its origin

The current belt path applies `beltY` to only the row origin and deliberately leaves dimensions world-scale (`packages/client/src/scenes/ArenaScene.ts:2020-2036`). Belt projection is the affine transform

```text
P(x, y) = (x, BELT_Y0 + (y - BELT_Y0) * 0.5)
```

from `BELT_FORESHORTEN=0.5` and `beltY` (`packages/client/src/scenes/ArenaScene.ts:140-147`, `packages/client/src/scenes/ArenaScene.ts:3007-3011`). As the audit records, this makes depth dimensions 2x too large and can put a ring's real damaging band inside visually empty “safe” space (`docs/VFX_HITBOX_AUDIT.md:20`, `docs/VFX_HITBOX_AUDIT.md:121-137`). Fix this before reducing fill opacity.

Build every underlay path in world-local coordinates and pass **every vertex/vector** through `P`:

- Circle/AoE: exact ellipse with `Rx=a`, `Ry=.5a` in belt mode; `Ry=a` top-down.
- Rect: let `u=(cos rot,sin rot)` and `n=(-sin rot,cos rot)`. Project the four rooted-lane corners `origin +/- b*n` and `origin + a*u +/- b*n`. Do not rotate a screen-space rectangle after projecting its center.
- Cone: project the origin and sampled world-arc vertices from `rot-b` through `rot+b`. Do not merely compress the aim vector and keep a circular screen arc; the current enemy cone makes that same TG-2 mistake (`packages/client/src/scenes/ArenaScene.ts:1967-2001`).
- Active ring: construct outer and inner world radii `a +/- RING_BAND_HALF`, omit the world-angle safe gap centered at `rot`, then project both vertex chains. The shared half-thickness is 46 px (`packages/shared/src/constants.ts:433-436`), and the primitive/server intentionally uses that same band (`packages/shared/src/boss-primitives.ts:460-500`).
- Point warning: project its center and render an ellipse/ticks whose depth offsets are also scaled.

Use the same builder with `yScale=1` top-down and `yScale=.5` on belt; do not maintain two shape implementations. Cache the resulting vertices by `(shape,x,y,a,b,rot,yScale)`. Static wind-ups build once; live beam/ring geometry rebuilds only when its synced signature changes. Choose adaptive arc subdivision by screen-space sagitta, capped around 24-96 samples, so a large `R=660` ring remains within the line width without paying 96 vertices for a 26 px point warning.

## QK-1 P0: construct the final quake danger ellipse directly

The unrelated player-quake fallback contains the same lesson and should land in the correctness slice. It creates a `44x26` ellipse, then sets `scaleX=2R/44` and `scaleY=scaleX*.62`, which produces final `Ry=.366R` (`packages/client/src/scenes/arena/vfx.ts:628-644`). The audit measures 63.4% of top-down vertical damage reach hidden (`docs/VFX_HITBOX_AUDIT.md:111-119`).

Pass the projection y-scale into `spawnQuake` from its `ArenaScene` call site (`packages/client/src/scenes/ArenaScene.ts:3601-3616`) and create the final boundary dimensions directly:

```ts
const ry = radius * projectionYScale; // 1 top-down, .5 belt
const ring = scene.add.ellipse(x, y, radius * 2, ry * 2).setScale(0.2);
// tween scalar scale to 1; never multiply a seed ellipse aspect a second time
```

The exact ring is the danger carrier. Dust, debris, the quake component pack, and any hero image remain decoration. Passing the same projection scale to the hero path also closes the audit's belt-only QK-2 overdraw while this code is open, without requiring new art.

## Performance with 12+ simultaneous telegraphs

Twelve exact boundaries and restrained preludes are cheap if the implementation stays retained and pooled.

- Keep one ground `Graphics` object for all boundaries and one existing high tell `Graphics`; do not create one Graphics per row.
- Replace the per-frame `new Set()` and replacement cache-object writes currently in `renderTelegraphs` (`packages/client/src/scenes/ArenaScene.ts:2019-2051`) with mutable cache records carrying a frame-generation mark.
- Cache projected path vertices and rebuild only on geometry signature changes. Updating alpha/tick positions must not allocate arrays.
- Cap persistent prelude objects at two pooled Images per fully featured row. Twelve live rows therefore cost at most 24 retained Images, not hundreds of tween owners.
- Give the boss a reserved full-prelude slot. At pressure, degrade other rows in this order: milestone particles, second painted component, first painted component. The exact edge and source pose never degrade.
- Apply camera-bounds culling to painted Images and particles, but retain their row/cache phase so they re-enter correctly. Geometry may remain batched into the single Graphics pass.
- Use row-id-derived deterministic frame/rotation choices. Calling `Math.random()` every frame will shimmer and makes captures irreproducible.
- Whole component packs and impact flipbooks remain edge-triggered. A 12-row simultaneous resolve may exceed the composer's ten-pack frame budget; the existing procedural payoff/underlay must still complete for every row.

Profile target for the 12-row stress fixture: steady-state telegraph update below 0.5 ms on the reference browser, zero hot-loop object/array allocations after caches are warm, one boundary Graphics pass, no more than 24 retained anticipation Images, and no growth in tweens while `t` is unchanged. Verify DPR 1 and 2, top-down and belt, optional assets missing, and a 10-player/busy-projectile scene.

## Build order

1. **Characterize the contract.** Add shared `TelegraphKindTag` constants without changing values. Add tests for controller progress, the one-broadcast `t=1` linger, active-hazard takeover, and cancel-without-impact.
2. **Correct spatial truth first.** Extract the pure projection/path builder; fix TG-1 for circle, horizontal/vertical/angled rect, cone, point, and gap ring. Fix QK-1 by constructing the final ellipse directly. Add numeric extrema tests and belt/top-down golden captures before changing style.
3. **Split the render layers and demote geometry.** Introduce `telegraphGroundGfx`, cached paths, exact keylines, parry/dodge edge patterns, and remove the filling rect/disc/wedge mass. Keep current resolve caching intact.
4. **Make the attacker perform.** Add the client-only scalar pose driver, resolve it before `SpriteRig.animate`, reuse section 40 anticipation envelopes, and add bounded `Gather`/`Cast`/`Stomp` part poses. Optionally plant source-rooted boss casts in `BossController`; this is server behavior, so cover it with movement tests.
5. **Add painted preludes.** Implement the pooled row visual, semantic component allow-list, deterministic ingredient selection, and milestone particle budget. Start with quake/slam cracks, frost creep, and gathering light because they prove three different causal reads.
6. **Polish transitions and budgets.** Resolve/cancel cleanup, active-hazard handoff, salience degradation, camera culling, missing-asset fallback, and the 12+ row profiler fixture.

## Acceptance gates

1. A paused wind-up frame identifies the attacker and whether it is slamming, charging/aiming, gathering, casting, melee-coiling, or stomping without reading the ground shape.
2. A paused footprint frame still gives the exact safe/danger boundary. In belt mode all four rect vertices, cone samples, ellipse axes, annulus band, and gap are projected; origin-only projection is gone.
3. A dodge-only lane never becomes a large filling red bar. A parryable cone/quake retains the established white source glint, inward timing rhythm, and exact white edge; incoming projectile tells remain unchanged (`packages/client/src/scenes/ArenaScene.ts:3757-3783`).
4. A row removed below full cleans up pose/prelude and produces no impact. A row observed at full produces one payoff. A beam/ring/dash releases anticipation when it becomes an active hazard.
5. Top-down procedural quake reaches `Rx=Ry=R`; belt quake reaches `Rx=R, Ry=.5R`. Decorations cannot hide or replace that ring.
6. With component textures, particle sheets, or impact strips deliberately unavailable, dodge/parry timing and footprint remain equally usable.
7. At 12+ live rows, caches and pools remain bounded, no per-frame object churn appears, and source poses plus exact underlays survive every degradation tier.

The intended final read is: **the boss's body tells me an action is coming; the world tells me what kind; the thin edge tells me exactly where and whether to parry or dodge.**
