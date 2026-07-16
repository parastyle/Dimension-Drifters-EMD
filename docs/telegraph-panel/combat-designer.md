# Diegetic Telegraph Language — Senior Combat Design Contract

## Panel verdict

The playtest complaint is correct. A danger shape is not an attack. It is the last, least expressive layer of an attack, and the current presentation has promoted it to the whole event: the server raises an authoritative row, the client fills a red primitive, and the attacker often continues its ordinary locomotion. The result communicates collision data but not cause, intent, force, or fantasy.

Dimension Drifters needs one causal sentence for every threatened hit:

> **I see who is doing it; I see what the world is about to do; I can verify exactly where and when it will hurt.**

That sentence is the useful common ground between Hades, Monster Hunter, FFXIV, and Furi. The attacker owns anticipation and commitment; the world makes the consequence believable; exact geometry remains quietly available for fair decisions. None of the references asks a colored floor shape to carry all three jobs.

The server already has the correct seed of a truth contract: a primitive computes telegraph and payload from the same fixed coordinates, and `BossController` advances the row's normalized `t` before resolving it (`packages/shared/src/boss-primitives.ts:15-23`, `packages/server/src/rooms/BossController.ts:189-205`). Preserve that authority. Replace the presentation hierarchy around it.

## The three-layer contract

These are causal layers, not merely draw-order layers. Every authored cast must pass all three.

### 1. The attacker announces the attack

The first readable change must occur on the source. A boss stops looking like its locomotion loop and enters an authored pose keyed by boss, attack primitive, aim, and normalized cast progress. Existing body, hand, foot, and weapon parts move; no new render is required.

The §40 vocabulary supplies the motion principles: frozen aim, hand ownership, planted feet, a whole-body envelope, a committed active beat, and follow-through. It is not a demand that every boss literally play a player weapon swing. `arc`, `chop`, `pivot`, `punch`, `thrust`, `orbit`, and `spin` are a reusable vocabulary for authored part poses (`packages/client/src/entities/SpriteRig.ts:783-807`, `packages/client/src/entities/SpriteRig.ts:882-1070`). Boss poses may combine those principles—an eye-beam uses a thrust-like brace, a quake uses chop's rise-to-squash, and a dash uses punch's chamber-to-drive—but must retain the boss's identity.

Non-negotiable pose rules:

- The silhouette must change within the first 80 ms of a cast. Do not wait for `t = 0.5` to make the attacker react.
- Aim is captured from the authoritative cast. Hands, face/emitter, torso, and underlay point to the same `rot`; the client never reacquires the nearest player to pose a boss cast.
- Large attacks plant a foot or base. A moving boss may strafe during light fire, but cannot casually walk through a major wind-up unless the authored attack is explicitly a moving cast.
- Resolve produces a visible action: recoil, stomp, arm release, iris flare, or launch. A pose that only holds until the floor marker disappears is still incomplete.
- Recovery is information. Heavy attacks expose 12–25% of their total presentation in committed follow-through; fast duel attacks may recover in 8–12%.
- Cancellation returns the pose to locomotion over 80–120 ms and suppresses release/impact. The controller already distinguishes a completed row pinned at `t = 1` from a cancelled row removed early (`packages/server/src/rooms/BossController.ts:104-108`).

Bosses receive authored `boss kind × pose id` tracks over their existing part rigs. Regular enemies do not need bespoke tracks: their archetype pose sampler consumes the already-synced `EnemyState.windup` field. That field currently ramps 0→1 for every duelist wind-up (`packages/shared/src/state.ts:153-156`, `packages/server/src/rooms/GameRoom.ts:3439-3442`); it should now drive a chamber/plant/strike pose as well as the white timing graphics. A dodge-only regular attack may reuse the same normalized field only if its danger semantic is also synced—white must never be inferred merely because `windup > 0`.

### 2. The world foreshadows the consequence

The second layer begins at the source or intended impact point and develops toward the result. It explains material and direction, not exact collision. Use the installed painted ingredients:

- **Stone/quake/eruption:** dust inhales, pebbles lift, then hairline cracks propagate before impact. Use the quake-burst ground crack (component 6), reserving its core, rock chunks, ring, and plume for resolve (`packages/client/src/vfx/fx-composer.ts:133-139`).
- **Frost:** desaturate/darken the floor locally; frost filaments creep along it; frost motes condense inward. Use frost-nova ground component 8 and restrained wisps 6–7 (`packages/client/src/vfx/fx-composer.ts:82-87`).
- **Ember/fire:** a few embers travel inward against gravity, the source brightens, and fissures glow before an eruption. Use ember-eruption hot tongues 0/1/3, wisp 4, and ground component 10 (`packages/client/src/vfx/fx-composer.ts:108-114`).
- **Storm/bolt:** a soft cloud shadow arrives first, then a rain/wind drift and small charge filaments, then the bolt. Storm-call already identifies its cloud, rain, wind, and flash components (`packages/client/src/vfx/fx-composer.ts:115-119`).
- **Light/beam:** particles are pulled into the aperture or weapon, a small lens/core gathers, and a narrow light leak points down the aim before release. Lightning-ball or holy-smite components provide existing cores/filaments; do not preview a beam with the impact flipbook.
- **Toxic/void/grave/water:** follow the same cause-first rule with the corresponding pack's ground, wisp, ring, and core roles. World paint may be irregular, but it must not invent a false safe pocket or a false damaging lobe.

The 96 typed particle packs can supply low-count motes, wisps, sparks, and rings (`packages/client/src/vfx/particle-manifest.ts:4-17`, `packages/client/src/vfx/particle-manifest.ts:66-105`). The eight six-frame flipbooks are impact assets and belong on resolve, not throughout anticipation (`packages/client/src/scenes/arena/vfx.ts:15-18`, `packages/client/src/scenes/arena/vfx.ts:26-47`). Do not turn an impact bloom into a warning texture.

### 3. A thin authoritative underlay guarantees fairness

The abstract marker remains, but it becomes a quiet measuring instrument under the fiction.

- Draw the complete authoritative boundary on the first rendered cast frame. **Never grow coverage from zero.** The player should not have to wait for a fill to learn the final footprint.
- No solid interior fill. Use a low-alpha, painted-texture edge clipped to exact geometry: two rails plus end cap for a lane; inner and outer edges for a damaging annulus; a perimeter for a landing zone; edge and arc for a melee wedge.
- Dodge-only base alpha is 0.10–0.14, rising to 0.18–0.24 during lock. Parryable white may pulse higher in the final timing beat. At resolve, permit one 60–90 ms edge flash, then clear or transition to the live-hazard edge.
- `t` controls edge energy, cadence, texture flow, and the final pulse—not the size of the threatened region. Live geometry changes are the only reason an edge moves.
- Texture breakup must stay within a 2 px tolerance of the mathematical edge. Decorative cracks, sparks, fog, and glow may extend farther, but can never masquerade as the boundary.
- The underlay is below actors and primary effects, above the floor and world-shadow layer. It must remain legible when effects are reduced by accessibility/performance settings.
- `danger = parryable` is white. `danger = dodge-only` uses a muted vermilion/element edge and never flashes white at release. Color supports the verb; it does not replace the verb.

The current client does the opposite for rectangles: it grows a translucent red bar from origin to `len × t` and outlines the whole rect (`packages/client/src/scenes/ArenaScene.ts:2112-2123`). That filled bar is the first thing to remove.

## Shared timing grammar

All timings below are normalized to the authoritative wind-up `t`. Existing tuned seconds remain intact; a 0.34 s Kaido swing and a 1.0 s colossus cast sample different poses at the same normalized beats.

| Beat | Normalized time | Player-facing meaning | Required presentation |
|---|---:|---|---|
| **Claim** | `0.00–0.15` | “That attacker has chosen an action.” | Silhouette break; aim acquisition; full thin underlay appears; first source particle or world shadow. |
| **Load** | `0.15–0.65` | “This is the attack family and element.” | Pose grows; material gathers or ground reacts; exact direction and safe-gap logic become obvious. |
| **Lock** | `0.65–0.88` | “The commitment is fixed; make the decision.” | Foot/base plants; emitter steadies; world effect reaches its readable pre-impact state; underlay cadence tightens. |
| **Release** | `0.88–1.00` | “Impact now.” | Short held anticipation followed by the authored release on `t = 1`; one semantic flash; no late retarget. |
| **Active/recovery** | after resolve | “This body/effect is dangerous, then punishable.” | Active hazard tracks exact live geometry; attacker follows through/recoils; impact flipbook and heavy debris occur only here. |

The last 12% is not an extra reaction window added to balance. It is the visual accent inside the existing server wind-up. The hit still resolves when the authoritative cast resolves.

## Attack-family language

### Ring — pulse, quake, eruption, and expanding annulus

**Timing.** Claim `0.00–0.12`: the boss lowers its center and draws limbs or appendages inward. Load `0.12–0.62`: energy/dust/motes gather toward the center; for a stomp, the striking foot rises while the support foot compresses. Lock `0.62–0.88`: the body reaches maximum compression or suspension and the safe-gap direction is visually fixed. Release `0.88–1.00`: one held beat, then the torso expands or foot slams. During an expanding active ring, the body remains in follow-through for the first 15–25% of live duration before recovering.

**Attacker layer.** Metronome closes around its core and then opens on the beat. Gorogoth braces wide and drives both arms/weight downward. Vastaghar raises the authored foot, shifts the body over the planted foot, and collapses vertically on resolve. A radial projectile burst uses a smaller inhale/open pose; it must not borrow the weight of a quake.

**World layer.** Quake/eruption uses pre-impact cracks and inward dust. Frost uses creeping rime. Fire uses ember convergence and glowing fissures. An expanding energy ring uses particles pulled into the source, then releases the ring outward. The safe gap remains materially quiet—no cracks, frost, embers, or sparks across it—so the fiction reinforces the mechanic.

**Underlay.** A landing/eruption zone shows its full exact perimeter from Claim. An expanding annulus shows both exact band edges and the safe gap; once live, those edges move with the server's current `bandR`. Do not show a filled disc for an annulus. The controller already updates active ring radius from the same spec used by `damageAnnulus` (`packages/server/src/rooms/BossController.ts:241-260`).

**Parry integration.** Ordinary rings and eruptions are dodge-only and receive no white beat. `footfallQuake` is the explicit exception: it is white, jumpable, and parryable (`packages/shared/src/boss-primitives.ts:296-315`). Its raised foot/body rim receives the same tightening white cadence as the underlay during Lock; the ground cracks remain stone-colored. White tells the player what input is valid, not what material the world is made from.

### Lane — a fixed corridor that resolves or persists in place

This is the semantic specialization of a rect whose start and end rotation are equal: a suppressed sightline, raking ground eruption, or static beam lane. It is not a dash.

**Timing.** Claim `0.00–0.12`: the attacker turns the emitting body part to the captured line. Load `0.12–0.58`: one hand/appendage traces or sights down the lane while the rear foot/base plants. Lock `0.58–0.88`: aim stops drifting and the source steadies. Release `0.88–1.00`: a sharp recoil/drive launches the effect. If the lane persists, recovery begins only after the first 20% of its active duration.

**Attacker layer.** The source must visibly own both origin and axis. A gunner shoulders/extends toward the lane. An eye narrows and aligns. A ground caster drags a hand/weapon along the future fissure. The attacker cannot continue its ordinary strafe/gait at full amplitude through Lock.

**World layer.** A physical lane sends cracks or dust races from origin toward the far cap. Frost creeps down its length; embers gather in a narrow wake; a storm lane receives an elongated cloud shadow before the bolt. Directional propagation is allowed, but the final cap and width must be readable by mid-Load.

**Underlay.** Show two exact textured rails and the far end cap for the entire authoritative rect from Claim. A faint origin notch associates it with the attacker. Do not fill between the rails. If the current server damages the whole lane throughout the active window, the whole lane remains edged throughout that window even if the fiction would prefer a traveling hit.

**Parry integration.** Current active lanes are dodge-only. They use no white on source or rails. If a future lane is parryable, white must appear on the attacker and at the approaching contact beat, not merely repaint the whole corridor white for the entire wind-up.

### Beam — an emitter sweeps through an arc

**Timing.** Claim `0.00–0.15`: aperture/weapon finds `rot0`; the boss's torso or base counter-rotates. Load `0.15–0.65`: light/motes collapse into the source and a narrow leak establishes the start line. Lock `0.65–0.88`: the emitter braces at `rot0`; a subtle directional pre-twist shows clockwise/counter-clockwise intent. Release `0.88–1.00`: aperture snaps open or weapon recoils. During the live sweep, the head/arms track the authoritative current `rot`, while feet/base remain planted.

**Attacker layer.** A beam originates at a visible emitter. Nul's eye/body is the emitter; Gorogoth's gaze uses head/body and braced limbs. Hands/appendages frame or stabilize the source rather than waving independently. A sweep is readable from source rotation even if floor effects are hidden by the horde.

**World layer.** Gathering light, inward motes, a small lens flare, and a thin pre-beam leak build at the source. The floor may show a restrained scorch/frost/light trace under the current line. A storm beam uses a moving cloud shadow; a void beam pulls motes inward rather than emitting sparks outward.

**Underlay.** During wind-up, exact rails show the start beam footprint. A second, much dimmer curved motion guide and end tick may forecast the authored sweep direction, but it is not colored like current danger. During the active window, rails rotate from the server-updated geometry each tick; `BossController` already updates the same rect rotation it damages (`packages/server/src/rooms/BossController.ts:235-239`). Pre-wind-up fairness requires syncing `rotEnd`/sweep direction with the cast presentation; the current telegraph row carries only `rot0`, so the client cannot honestly invent it.

**Parry integration.** Beams remain dodge-only. No white aperture flash. The final source flare uses the beam's element/highlight color. If accessibility requires a timing accent, use value/scale and a short audio rise, preserving white as the parry verb.

### Dash — the attacker becomes the payload

**Timing.** Claim `0.00–0.15`: boss snaps to the captured axis and arrests ordinary gait. Load `0.15–0.62`: hips/torso sink, rear foot digs in, front limb tucks, and mass shifts backward. Lock `0.62–0.88`: maximum coil with a small 2–3 Hz strain/tremor; aim is fixed. Release `0.88–1.00`: back foot kicks, torso lengthens into a thrust/punch-like drive. Recovery begins after the active travel ends, with a skid, overrun, or chain recoil.

**Attacker layer.** Grull lowers shoulder and pulls both hands/chains behind the body. Kaido draws blade/arm to the hip and plants the opposite foot. The Twins split their hand ownership so the two staggered dashes are visibly Castor then Pollux, rather than the same pose replayed. The moving boss silhouette is the primary active hazard.

**World layer.** Dust is pulled backward during Load, then becomes a directional wake on Release. Heavy dashes fracture the launch point, not the whole lane. Frost skates a thin creep from the planted foot; ember dashes shed a few backward sparks. Never spawn impact debris before contact.

**Underlay.** Full exact lane rails appear on Claim and remain while the server treats the entire rectangle as dangerous. The current dash implementation damages the complete start-to-end rect on every active step rather than a moving body capsule (`packages/server/src/rooms/BossController.ts:263-276`); presentation must tell that truth. If design later changes damage to a traveling capsule, then—and only then—may the active underlay collapse to a moving footprint.

**Parry integration.** Current red dashes are dodge-only, including Kaido's deliberate white-melee/red-dash contrast (`packages/shared/src/bosses.ts:548-570`). The dash coil must therefore avoid white glints on blade/body at Release. Parryable melee that happens to include a short lunge remains in the white melee language, not the dash language.

## The bare-rectangle incident

Source inspection shows that the complaint is a shared presentation defect, not a single bespoke renderer. `TgShape.Rect` serves both beam and dash lanes (`packages/shared/src/boss-primitives.ts:28-35`), and the client always renders that shape as a filling red bar. BossController creates the rows and advances their `t`, but writes no boss pose or attack sequence during the cast (`packages/server/src/rooms/BossController.ts:351-385`). The client only starts an enemy attack animation when `EnemyState.atkSeq` changes, which currently comes from the regular duelist path (`packages/client/src/scenes/ArenaScene.ts:1821-1837`). Therefore every boss rect can be body-silent.

The quoted “slowly filling arbitrary red rectangle” maps most directly to **Nul the Sightline's phase-one `beamSweep`**: a stationary eye boss charges a `length: 1000`, `halfWidth: 42`, `sweepArc: 0` static lane for **0.95 s** (`packages/shared/src/bosses.ts:321-336`). Later phases use the same producer with 0.9/0.8 s wind-ups and actual sweeps (`packages/shared/src/bosses.ts:340-370`). The primitive turns it into the current rect row (`packages/shared/src/boss-primitives.ts:416-457`). Quickdraw Vane repeats the static `sweepArc: 0` lane at 0.7/0.6 s (`packages/shared/src/bosses.ts:493-541`), so the fix must cover both rather than special-case one encounter.

### Authored Nul “Sightline Compression” wind-up

Nul already has separate body, left/right hand, and left/right foot parts (`packages/client/src/sprites/manifest.ts:4107-4171`). Sample the following pose from the authoritative cast `t`:

- **Claim, `0.00–0.15`:** snap the body to face `rot0`; feet spread 6% of body width and rotate outward; hands retract toward the body/eye; squash body Y to 0.96 and widen X to 1.03. Ordinary bob/gait amplitude becomes zero.
- **Load, `0.15–0.65`:** hands pull apart perpendicular to the beam like an opening iris; body eases back 4–6 px from the aim and counter-rotates up to 0.08 rad; a tiny gathered-light core grows at the eye while 4–8 motes stream inward. For a sweeping phase, bias the torso toward `rot0` and visibly preload opposite the future sweep direction.
- **Lock, `0.65–0.88`:** feet and torso hard-plant; hands stop at maximum spread; body narrows to Y 0.93 for a visible squint. The eye core pulses twice in element color. The full thin lane rails are already present; their edge cadence accelerates.
- **Release, `0.88–1.00`:** hold for the first half, then snap body Y from 0.93 to 1.07 and kick both hands 5–8 px backward on `t = 1`; the eye core becomes the beam. During a sweep, body/hands track the authoritative live rotation with planted feet. Recover over 18% of active duration after the initial recoil.

This turns “a rectangle happened near a sprite” into “the eye compressed, aimed, and discharged a sightline.” The underlay remains sufficient if particles are disabled, but the attacker remains sufficient to identify the verb if the floor is crowded.

### Authored Quickdraw “Deadeye Brace” variant

Use the same lane contract but a different silhouette: front foot slides toward the captured aim, rear foot turns outward, aiming hand extends on a thrust-like line, off-hand braces the wrist/barrel, and the torso leans back against recoil. Lock removes strafe bob even though the controller otherwise orbits targets. Resolve kicks the aiming hand and shoulder backward. Quickdraw's installed rig also exposes body, both hands, and both feet (`packages/client/src/sprites/manifest.ts:4265-4329`); no gun render is required for the pose to communicate a deliberate shot.

## White parry-tell integration

White is a gameplay verb: **parry this impact**. It is not “magic,” “high energy,” “boss attack,” or a generic final flash.

The regular-enemy system already has a good cadence skeleton: synced `windup`, a white body disc, an exact melee cone, and a ring that shrinks toward the enemy as the hit approaches (`packages/client/src/scenes/ArenaScene.ts:1951-2001`). Keep its timing semantics, but rebalance its hierarchy:

1. The attacker's chamber/weapon pose is primary.
2. White gathers on the attacking limb/emitter during Load and pulses once during Lock.
3. The exact white wedge/edge is thin and secondary; remove its filled interior.
4. The body-centered rhythm ring remains a compact timing instrument, not an attack-area substitute.
5. On strike, the white anticipation clears crisply. On a successful parry, play the existing white response plus an attacker recoil; never leave a white wind-up ghost. The server already clears a regular attacker's wind-up when the parry chain forces stagger (`packages/server/src/rooms/GameRoom.ts:3543-3548`).

Boss `meleeCombo` is already explicitly white/parryable and foot-planted (`packages/shared/src/boss-primitives.ts:546-576`, `packages/server/src/rooms/BossController.ts:170-173`). It now needs the authored §40 arc/chop pose during wind-up and a resolve swing sequence, not only a white wedge. Footfall quake uses the same white cadence on the raised foot/core because parry is valid, while retaining stone-colored ground cracks so the material does not turn into abstract white paint.

Never use white on lane, beam, or dash Release while they remain dodge-only. Never ask players to infer parryability from attack shape alone; `danger` remains authoritative (`packages/shared/src/state.ts:200-205`).

## Presentation data and authoring contract

The current telegraph row knows geometry and progress, but not which attacker/pose owns it (`packages/shared/src/state.ts:171-205`). A professional diegetic system needs an attack-level presentation descriptor generated beside the cast plan:

```text
CastPresentation {
  sourceEnemyId, castSeq, poseId, family,
  startTick, windupSeconds, t,
  aimRot, rotEnd?, danger,
  state: windup | active | recover | cancelled,
  resolveSeq
}
```

- `BossController` owns this state. Geometry rows reference `castSeq`; all rows from a multi-zone cast share one attacker pose and clock.
- Boss pose, world pre-effect, underlay, audio rise, and resolve animation sample the same `t`. Client body interpolation may lag position, but pose phase must not lag or guess.
- `poseId` is authored in boss data beside `primitive`, not derived from `shape`. A circle may be a stomp, spell, blink landing, or corrosive spit; identical geometry does not mean identical body language.
- `aimRot` is the cast's captured authority. `rotEnd`/direction is mandatory for a sweeping beam forecast.
- `resolveSeq` triggers recoil/impact once. A removed row is not enough to identify which body animation to play when one cast emitted several rows.
- Regular enemies continue to use `EnemyState.windup` and `atkSeq`; their archetype and `danger` select the pose and color.
- Major boss pose tracks are exclusive. If independent modules overlap, either defer the later major cast until the first reaches recovery, or author it into a non-conflicting additive slot (for example, eye emitter over planted lower body). Never average two contradictory full-body poses. World-only secondary warnings do not excuse an attacker that appears to perform neither action.

## Geometry audit requirements

Diegetic polish cannot be allowed to launder incorrect hitbox presentation.

### TG-1 — belt telegraphs

The current belt path projects only the telegraph origin while leaving radii and vertices in world proportions. Circles, lanes, cones, and rings are therefore up to 2× wrong in depth, with both false-danger and hidden-danger regions (`docs/VFX_HITBOX_AUDIT.md:121-137`). The underlay contract requires one affine pipeline:

1. Construct the exact primitive in world space.
2. Transform every point and width basis by the belt projection `(x, 0.5y)` about the same origin.
3. Draw the painted edge on that transformed path.
4. Apply the same transform to clipped world decals that are intended to communicate reach.

Do not special-case only the origin, direction, or nominal radius. A horizontal lane's depth half-width, a vertical lane's length, an angled lane's vertices, and both ring radii/band edges all transform.

### QK-1 — quake reach

The procedural quake fallback currently shows only `0.366R` vertically in top-down play, hiding 63.4% of authoritative vertical reach (`docs/VFX_HITBOX_AUDIT.md:111-119`). Before adding prettier cracks, correct the footprint:

- Top-down authoritative circle: `Rx = R`, `Ry = R`.
- Belt-projected circle: `Rx = R`, `Ry = 0.5R`.
- Quake-burst crack paint is clipped/scaled inside that exact footprint; it is foreshadow, not the boundary.
- The thin perimeter remains exact even when the irregular crack texture has empty regions.

The same review must preserve the player-center hit convention and make the ground hurt-point readable; top-down boss geometry is currently exact only for that point convention (`docs/VFX_HITBOX_AUDIT.md:123-125`).

## Ship gates

This language is ready only when all of the following pass:

- **Source-only test:** with floor markers/effects hidden, a player can identify ring, fixed lane, sweeping beam, and dash from the attacker at least 8/10 times after one training exposure.
- **World-only test:** with the underlay hidden, the effect communicates element, origin, and direction without creating a confidently false safe area. This is a quality test, not permission to remove the underlay.
- **Truth test:** with effects hidden, the underlay matches server circle/rect/annulus/cone tests at boundary, safe gap, orientation, and active motion. Run top-down and belt variants.
- **Timing test:** capture `t = 0`, `0.15`, `0.65`, `0.88`, `1.0`, first active frame, and recovery. Attacker, world, edge cadence, audio, and resolve share the authoritative beat within one rendered frame.
- **Parry test:** in grayscale and heavy combat clutter, every valid parry has the white attacker cue and compact cadence ring; no dodge-only lane/beam/dash produces a competing white release flash.
- **Cancellation test:** phase change and death remove pose/effects/edge without impact, recoil, camera shake, or flipbook.
- **Overlap test:** two module cadences never blend the boss into an unreadable pose. Secondary effects either occupy an authored additive slot or their cast is deferred.
- **Clutter test:** world foreshadow budgets down before attacker pose or underlay. Minimum mode retains one source effect, exact edge, and parry cadence.
- **No-new-render test:** every pose uses installed rig parts; every pre-effect comes from the 12 component packs or 96 particle packs; the eight impact flipbooks remain resolve-only.

The final priority is strict: **attacker pose first, diegetic world response second, exact thin underlay always, decorative density last.** If a playtest build ever shows a filled rectangle with an idle attacker again, it has violated the contract even if its hitbox is mathematically correct.
