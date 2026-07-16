# VFX developer panel recommendation: Painted Edge Ribbon

## Decision

Replace the procedural fallback implementations of `twin-slash`, `blade-trail`, and `thrust-streak` with one shared renderer: **Painted Edge Ribbon (PER)**. PER is a short-lived, tapered mesh that records the blade's *recent* authoritative path. It has two layers:

1. a broad, painted **NORMAL-blend body** sampled from an existing element particle frame; and
2. a narrow **ADD-blend leading lip** in the canonical element color.

The three existing layer ids remain as authored/Weaponsmith-facing profiles, but call the same mesh builder. `twin-slash` becomes a forked, staggered ribbon rather than an X; `blade-trail` becomes one compact fan ribbon rather than parallel speed lines; `thrust-streak` becomes a narrow, point-forward ribbon rather than a white line. This preserves the registry and canonical-preview contract while replacing the part players dislike (`packages/client/src/vfx/vfx-layers.js:17-18`, `packages/client/src/vfx/vfx-layers.js:37-65`, `packages/client/src/vfx/vfx-render.js:288-311`).

This is a fallback-only change. Existing bespoke suites remain opt-in and unchanged unless individually migrated. The current suite selection already gives authored suites priority over the synthesized fallback (`packages/client/src/vfx/VfxPlayer.ts:275-284`).

## Why this shape translates to Dimension Drifters

The useful lesson from Hades is not “draw a brighter line”; it is to replace the weapon's contact frame with a broad, authored-looking smear whose mass peaks for only a few frames. Dead Cells similarly gets direction and force from a filled, tapered arc with a decisive outer edge, not from hairlines. Brotato and Vampire Survivors supply the density rule: one legible motion mark must survive a crowded screen; decorative trails should be the first thing removed.

For Dimension Drifters' straight-down camera, the translation is a **ground-plane fan slice**, not a side-view crescent pasted upright and not a screen-space X. The slice begins near the hand, widens toward the blade tip, and covers only the path just swept. The player silhouette stays open in the middle. The outer tip and sweep direction read at a glance even when enemies overlap the inner half.

PER therefore chooses a **tapered wedge-ribbon with a crescent outer silhouette**. It is not a solid full-attack wedge and not a weapon afterimage. A full wedge would paint all past and future danger at once; an afterimage would become illegible under a straight-down paper-doll; a thin crescent would repeat the existing “white streak” failure.

## Non-negotiable truth contract

The §20 rule is stronger than style: the effect must explain the edge that can actually hurt something. The authoritative melee is a radial blade segment swept through the arc, with each enemy hit once, not an instantaneous cone (`packages/shared/src/melee.ts:7-12`). Its half-width is 21 px (`packages/shared/src/melee.ts:23-29`). Its effective reach is floored at the rendered sprite tip and shared with the server (`packages/shared/src/weapons.ts:292-304`).

PER obeys these constraints:

- Anchor fallback geometry at the **rendered wielder center**, using the frozen swing aim. Do not build it around the current “60% along reach” strike point; that placement is appropriate for a decorative burst, not for a swept blade (`packages/client/src/scenes/ArenaScene.ts:5121-5139`).
- Set the mesh's outer high-alpha edge to `meleeReach(weapon)`. No fallback `reach: 1.35`; artistic reach multipliers may shorten the body but never lengthen it.
- Keep the visible leading band at or below 42 px total width. Texture alpha is clipped by mesh geometry, so painted wisps cannot bloom beyond the server's 21 px half-width.
- Sample the current angle with `bladeAngleAt(aim, weapon.swingArc, q)`, where `q` is `swingEdgeProgress(swing, elapsedSeconds)` (`packages/shared/src/melee.ts:395-409`). The ribbon covers `[q - history, q]`; it never paints unswept future space.
- Leave the innermost `min(28 px, 0.20 × reach)` transparent so the rig remains readable. This is presentation clearance, not a claimed safe zone; the damaging radial segment still owns the underlying space.
- The bright lip means “edge active now.” It is absent before `activeStartSeconds` and removed at `activeEndSeconds`. Only the dim NORMAL body may persist into follow-through.

The game-feel audit identifies a separate, approximately 49 px render-versus-authority offset while strafing (`docs/GAMEFEEL_AUDIT.md:94-96`). PER must spawn from the rendered/predicted rig as the current attack path does, but it cannot solve that netcode issue. Do not claim that this art change closes global WYSIWYG until prediction/reconciliation does.

## Geometry specification

Build one reusable, pooled 2D mesh strip per blend layer. For an arc profile, use 8 samples at standard quality and 12 at high quality. Each sample contains an inner and outer vertex on the radial blade segment; adjacent samples form the recent fan. Alpha is the product of:

- radial taper: `0` at inner clearance, `0.65` at 55% reach, `1` at the tip;
- history taper: `0` at the oldest sample, `1` at the live edge; and
- the timing envelope below.

The painted frame is mapped from hilt to tip and oldest to newest edge. Tile it in two or three patches rather than stretching one 96 px frame past roughly 2.2:1. Select the frame deterministically from the weapon id at swing start; changing frames every render frame would shimmer.

The additive lip occupies only the newest 18% of history and the outer 55% of radius. It uses the same vertices with narrower radial coverage, so it reads as a luminous cutting edge embedded in paint, not a free-standing line. There is no pure-white outline.

### Profiles

| Resolver | Shape within the common PER system | Motion treatment |
|---|---|---|
| `tags.grip === "dual"` | Two tapered lobes inside one collision-width envelope; each is 58% of normal width and offset by ±18% of normal width. | Rear lobe uses `max(0, q - 0.12)` and at most 42% opacity. Only the leading lobe gets the bright live-edge lip. The result reads as two hands without promising two hit events or drawing a static X. |
| `swing.style === "thrust"` | A narrow, point-forward fan using a painted `*-bolt` frame; inner taper is longer and tip opacity is highest. | In the current protocol it still samples `bladeAngleAt`, with history capped at 0.18 rad, because the server still sweeps the legacy angular line. It reads as a darting edge but does not invent a client-only forward capsule. |
| `swing.style === "chop"` or a 2H L/XL fallback | Broad wedge-ribbon with a blunt tail and a dense outer third. | History is longer and NORMAL body is heavier; the additive lip is less dominant. Peak mass is centered on `impactSeconds`. |
| `swing.style === "orbit"` | Long outer crescent attached to a tapered radial fill. | Follow the descriptor edge, not the rig's extra cosmetic overtravel. |
| `swing.style === "spin"` | A moving ring segment, never a full persistent disc. | Retain only the latest 0.45-0.70 rad so the direction of rotation stays readable. `buzzsaw-wake` may override the texture for a saw family. |
| `swing.style === "pivot"` or `"punch"` | Compact, short-reach brush wedge; dual worn weapons may use the forked profile. | No blade-length exaggeration. A soft painted body carries the motion; the lip is small or absent for blunt fists. |
| Everything else (`arc`) | The default tapered fan slice. | Family changes material/edge character, not gameplay reach or timing. |

The shipping thrust profile above is deliberately conservative. Shared code currently says exact per-style path synchronization is later work and still advances the legacy sweep inside each style's active interval (`packages/shared/src/melee.ts:351-353`). A true longitudinal spear smear should ship only when the shared descriptor owns a longitudinal thrust path. Turning it on client-only would look better in isolation and make the §20 claim false.

The rig also documents that reverse, dual, and overhead combo poses are presentation-only while the server still owns one centered positive sweep (`packages/client/src/entities/SpriteRig.ts:797-799`). PER follows the descriptor, not those cosmetic deviations, until that protocol work lands.

## Timing against `SwingDescriptor`

Let `D = poseSeconds`, `A = activeStartSeconds`, `B = activeEndSeconds`, `I = impactSeconds`, and `e = poseP × D`. These fields are already the immutable predicted/accepted swing clock (`packages/shared/src/melee.ts:313-323`). Non-spin pose duration is effective cooldown × 0.64, and the common authored impact beat is 52% of the pose (`packages/shared/src/constants.ts:454-458`). Style-specific active fractions are already resolved centrally (`packages/shared/src/melee.ts:354-392`).

### Anticipation: `0 ≤ e < A`

- Main body and additive lip are off.
- During only the last 35% of anticipation, a compressed NORMAL-blend stamp may rise from 0 to 0.16 alpha at the first blade angle. It must stay behind the starting edge and within half-width.
- No particles, flash, or white glint. Anticipation is carried primarily by the weapon pose; PER should not suggest early damage.

### Contact/active sweep: `A ≤ e < B`

- `q = (e - A) / (B - A)` via the shared helper.
- Body alpha eases to its family maximum over the first 15% of active time. The live lip appears immediately and follows `q`.
- Arc/default opacity: NORMAL body 0.68-0.78, ADD lip 0.42-0.62. Heavy/blunt: body 0.78, lip 0.30-0.42. Energy-blade: body 0.52, lip up to 0.72.
- For chop/punch, use `I` only to crest the smear's mass for 16-30 ms. `I` is a pose beat, not proof of an enemy hit. Actual impact flipbooks and hit particles remain hit-confirm effects.

### Follow-through: `B ≤ e < B + F`

Use `F = min(D - B, clamp(0.22 × (B - A), 0.035 s, 0.090 s))`.

- Freeze path progress at `q = 1`.
- Remove the ADD lip within one rendered frame or at most 20 ms.
- Retract history toward the final edge while the NORMAL body fades from at most 0.30 to zero.
- The ribbon is fully absent after `B + F`, even if the weapon pose holds a combo guard. This prevents a harmless held pose from reading as an active hitbox.

The live player already constructs one effective-cooldown descriptor, freezes aim, and passes that descriptor to both rig and VFX (`packages/client/src/scenes/ArenaScene.ts:3565-3578`, `packages/client/src/scenes/ArenaScene.ts:3662-3674`). `VfxPlayer` already runs its tween for `swing.poseSeconds` (`packages/client/src/vfx/VfxPlayer.ts:319-330`). The renderer must stop using hard-coded pose slices such as `0.03/0.34`, `0.05/0.32`, and `0.10/0.25`; those are the current source of phase drift (`packages/client/src/vfx/vfx-render.js:223-311`).

## Color and painted-material integration

Do not use `lerpHue` for PER. It selects a coarse stop by floored index, while the fallback's `ELEMENT_HUE` values are a second, divergent color convention (`packages/client/src/vfx/vfx-render.js:19-22`, `packages/client/src/vfx/VfxPlayer.ts:29-38`). Use the exact `ELEMENT_COLOR` convention already used for projectiles (`packages/client/src/scenes/arena/projectile-factory.ts:28-39`) and add physical steel as `0xd6dde6`.

| Element | Lip color | NORMAL body pack | Point/lip pack |
|---|---:|---|---|
| physical/unknown | `0xd6dde6` | `steel-wisp` | `steel-bolt` |
| fire | `0xff6a2a` | `fire-wisp` | `fire-bolt` |
| frost | `0x6fd6ff` | `frost-wisp` | `frost-bolt` |
| shock | `0xffe24a` | `shock-wisp` | `shock-bolt` |
| holy | `0xffe6a0` | `holy-wisp` | `holy-bolt` |
| toxic | `0x9cff3b` | `toxic-wisp` | `toxic-bolt` |
| void | `0xb14bff` | `void-wisp` | `void-bolt` |
| arcane | `0x8f6aff` | `arcane-wisp` | `arcane-bolt` |

These are existing equal-cell painted sheets, not new renders. The typed manifest exposes every required wisp and bolt (`packages/client/src/vfx/particle-manifest.ts:10-17`, `packages/client/src/vfx/particle-manifest.ts:26-49`, `packages/client/src/vfx/particle-manifest.ts:66-97`). Physical/unknown already resolves to steel through `elementPack` (`packages/client/src/vfx/particles.ts:77-81`). The sheets are boot-preloaded as `ptcl:<id>` spritesheets (`packages/client/src/vfx/particles.ts:9-13`).

Use native painted color for the NORMAL body. Apply no tint, or only a subtle 90-100% element multiplication, so highlights and dark brush texture survive. The ADD lip uses the exact hex above. Holy may approach warm white; no other element gets a white center.

### Component-pack allow-list

Component-pack islands are optional profile overrides, not extra per-swing explosions. Read their already-loaded texture directly into the mesh; do **not** call `playFxPack`, which would spawn every island and spend the ten-stack frame budget (`packages/client/src/vfx/fx-composer.ts:188-204`, `packages/client/src/vfx/fx-composer.ts:242-253`). Preserve the pack's authored NORMAL/ADD role (`packages/client/src/vfx/fx-composer.ts:48-60`).

- `ember-eruption`: `fx-ember-eruption-00`, `-01`, `-03` are additive fire tongues for the outer third of heavy fire swings (`packages/client/src/vfx/fx-composer.ts:108-113`).
- `lightning-ball`: `fx-lightning-ball-00`, `-03`, `-07` are additive filaments for a shock lip, never the body (`packages/client/src/vfx/fx-composer.ts:75-81`).
- `void-implosion`: `fx-void-implosion-07`, `-08` are painted void wisps suitable for a void ribbon override (`packages/client/src/vfx/fx-composer.ts:89-94`).
- `buzzsaw-wake`: `fx-buzzsaw-wake-00` is a NORMAL metal blur reserved for saw/spin families; `-01` through `-04` remain additive sparks (`packages/client/src/vfx/fx-composer.ts:120-125`).
- `frost-nova`: `fx-frost-nova-01` is an additive ring source usable only by the spin profile, cropped to the current segment (`packages/client/src/vfx/fx-composer.ts:82-88`).
- `tide-crash`: `fx-tide-crash-01` and `-02` are NORMAL painted water arcs ready if water becomes a supported weapon element; do not remap them to frost (`packages/client/src/vfx/fx-composer.ts:126-131`).

Keep a strict runtime allow-list. Do not select arbitrary extracted islands: the inventory contains green-matte/incompletely keyed pieces, already called out by the animation/VFX audit (`docs/ANIMATION_REVIEW_AND_COMBOS.md:296-298`). The universally safe path is always the typed particle sheet.

The eight six-frame impact strips are **not** smear fills. They are 270 ms additive blooms sized to the damaged body and should remain confirmed-hit punctuation (`packages/client/src/scenes/arena/vfx.ts:15-19`, `packages/client/src/scenes/arena/vfx.ts:50-80`). Playing them on a whiff would collapse the distinction between motion and contact.

## Scaling across the fallback roster

Use the closed `style`, `grip`, and `size` vocabulary first; treat free-form `family: string` only as a material hint. The tag contract makes this distinction explicit (`packages/shared/src/weapons.ts:232-242`). The shared style resolver is the canonical family-to-motion decision and already recognizes worn, quake, thrust, two-handed, and default arc weapons (`packages/shared/src/melee.ts:325-342`).

| Size | Tip body width | ADD lip width | Active-path history | Angular cap |
|---|---:|---:|---:|---:|
| S | 14 px | 4 px | 16% | 0.35 rad |
| M | 22 px | 6 px | 22% | 0.50 rad |
| L | 30 px | 8 px | 28% | 0.70 rad |
| XL | 38 px | 9 px | 34% | 0.85 rad |

All widths stay inside the 42 px collision band. Actual reach always comes from `meleeReach`; `rangeBand` does not scale the mesh.

Family hints may make only these bounded changes:

- rapier/spear/pike/lance/estoc/needle: bolt texture, pointed radial taper, short angular history;
- axe/cleaver/glaive/halberd/broadsword: denser outer 35%, squared tail;
- mace/maul/warhammer/gauntlet: round the live tip, reduce ADD alpha by 30%, retain a broad painted air body;
- katana/saber/nodachi/energy-blade: sharpen history taper; energy families shift blend weight toward ADD without changing width;
- saw: allow the `buzzsaw-wake` spin override;
- unknown/exotic: resolved shared style plus the size table, with no name-derived reach bonus.

This avoids a brittle exhaustive switch over the expansion roster. It also corrects the current fallback's category shortcuts: it selects dual, then `rangeBand === "long"`, then 2H L/XL, then size S (`packages/client/src/vfx/VfxPlayer.ts:84-124`). The new classifier should receive `swing.style` and use it before `rangeBand`.

Repository-state note for panel review: `twin-bowie-fangs` is dual/S and should use the forked profile (`packages/shared/src/weapons.ts:702-724`). Under the checked-in fallback precedence, `x-sword-anchor` is 2H/L/close and therefore classifies as heavy, not reachy (`packages/shared/src/weapons.ts:753-775`, `packages/client/src/vfx/VfxPlayer.ts:87-112`). If an observed build showed speed lines on the anchor, that came from older or authored data; do not preserve that misclassification in the replacement.

## Layering and pooling

The current canonical surface owns only additive Graphics, so even broad shapes glow like UI strokes (`packages/client/src/vfx/vfx-render.js:664-684`). Extend each pooled surface with:

1. `meshBody`, NORMAL, below all swing-core work;
2. `meshLip`, ADD, above the body;
3. existing particles and painted hero in their current order.

Update vertices and alpha in place. Do not create Images, Meshes, or Ropes per render frame. The canonical order already groups the three swing layers together before beams and hit punctuation (`packages/client/src/vfx/vfx-layers.js:201-233`), and `renderLayers` already centralizes dispatch for game and preview (`packages/client/src/vfx/vfx-render.js:790-827`).

PER must remain readable when bloom is unavailable. The root filter is intentionally disabled at high DPR to avoid camera-space offsets (`packages/client/src/vfx/VfxPlayer.ts:159-180`); therefore painted NORMAL contrast carries the silhouette and ADD is only reinforcement.

The pool caps at 12 surfaces and pressure-steals in rotation (`packages/client/src/vfx/VfxPlayer.ts:151-155`, `packages/client/src/vfx/VfxPlayer.ts:231-258`). A ribbon-only swing must release after its follow-through. Do not hold it for the unconditional 900 ms particle tail: track whether a suite actually fired a long-lived emitter, and use the existing tail delay only in that case (`packages/client/src/vfx/VfxPlayer.ts:17-19`, `packages/client/src/vfx/VfxPlayer.ts:332-347`). That lifecycle change is more valuable than shaving two mesh vertices.

## Budget degradation path

Choose quality once when acquiring a surface; do not oscillate within a swing. Local-player motion has priority over remote decoration.

| Pressure | PER output | What is removed first |
|---|---|---|
| Full: 0-6 busy surfaces and frame on budget | 12 samples, NORMAL body + ADD lip, forked dual geometry, one allow-listed component override. | Nothing. |
| Standard: 7-9 busy surfaces | 8 samples, NORMAL body + ADD lip, particle-sheet textures only. Both dual lobes share the same two pooled meshes. | Component-pack override and any decorative stamp. |
| Low: 10-12 busy surfaces or component frame budget exhausted | 4 samples, one NORMAL painted mesh. Dual becomes one forked silhouette in that mesh; no lip, particles, or afterimage. | ADD mesh and second material pass. |
| Emergency/missing texture/context loss | One filled tapered fan or lance quad in the exact element color, NORMAL at 0.55 alpha, with no outline. | All texture sampling and subdivision. |

The emergency fallback is intentionally a filled silhouette, not a stroked arc. It keeps direction, mass, element, and timing—the four semantic essentials—without recreating the “MS Paint white streak.”

## Integration map

| Integration point | Required change | Source of truth |
|---|---|---|
| Layer registry | Keep the three ids; replace their labels/params with shared PER controls (`history`, `bodyAlpha`, `lipAlpha`) while retaining `trigger: "swing"`. Preserve their place in `ORDER`. | `packages/client/src/vfx/vfx-layers.js:17-18`, `packages/client/src/vfx/vfx-layers.js:37-65`, `packages/client/src/vfx/vfx-layers.js:201-220` |
| Canonical renderer | Replace the line renderers with calls to one PER mesh updater. Convert normalized tween phase to descriptor elapsed time; delete hard-coded phase windows and white strokes. | `packages/client/src/vfx/vfx-render.js:129-163`, `packages/client/src/vfx/vfx-render.js:221-311` |
| Surface construction | Pool one NORMAL body mesh and one ADD lip mesh per surface; update/clear them in `prepare`. | `packages/client/src/vfx/vfx-render.js:664-684`, `packages/client/src/vfx/VfxPlayer.ts:213-258` |
| Descriptor handoff | Store `swing`, weapon reach/arc, frozen aim, element, size, grip, and resolved style on the surface before the tween starts. | `packages/client/src/vfx/VfxPlayer.ts:264-330`, `packages/shared/src/melee.ts:316-323` |
| Fallback classifier | Pass `swing.style` into the fallback builder; use dual/style/size priority and remove reach multipliers over 1. Use exact element colors, not `ELEMENT_HUE`. | `packages/client/src/vfx/VfxPlayer.ts:29-38`, `packages/client/src/vfx/VfxPlayer.ts:84-126`, `packages/shared/src/melee.ts:334-342` |
| World anchor | For fallback PER, pass the rendered wielder center and derive outer extent from `meleeReach`; keep authored cursor-spawn/origin behavior isolated. | `packages/client/src/scenes/ArenaScene.ts:3662-3674`, `packages/client/src/scenes/ArenaScene.ts:5121-5139`, `packages/shared/src/weapons.ts:292-304` |
| Painted textures | Reuse boot-loaded `ptcl:<element>-wisp/bolt` frames. Optional pack islands are already queued with the twelve FX packs. | `packages/client/src/vfx/particles.ts:9-13`, `packages/client/src/vfx/VfxPlayer.ts:197-201`, `packages/client/src/vfx/fx-composer.ts:152-174` |
| Lifecycle/budget | Release ribbon-only surfaces after follow-through; retain the 900 ms delay only for fired particle tails. Degrade before pressure-stealing. | `packages/client/src/vfx/VfxPlayer.ts:17-19`, `packages/client/src/vfx/VfxPlayer.ts:231-258`, `packages/client/src/vfx/VfxPlayer.ts:332-347` |
| Hit punctuation | Leave impact flipbooks and painted particle bursts on the hit-confirm path; do not fold them into swing fallback. | `packages/client/src/scenes/arena/vfx.ts:26-80`, `packages/client/src/vfx/particles.ts:37-75` |
| Preview parity | Implement PER only in the canonical renderer so Weaponsmith and live game continue to execute the same layer code. | `packages/client/src/vfx/vfx-render.js:1-11`, `packages/client/src/vfx/vfx-render.js:790-827` |

## Acceptance criteria and adversarial checks

1. **Still procedural?** Geometry and timing are procedural; the visible surface is painted existing art. No fallback frame contains an untextured white stroke.
2. **Dual implies two hits?** It must not. The dim lobe is historical, never ahead of the live edge, and only one lip denotes active contact.
3. **Thrust lies about its hitbox?** Not in this shipment. It remains descriptor-path-authoritative until a shared longitudinal path exists.
4. **Paint stretches like rubber?** Reject any capture with a texture patch stretched beyond approximately 2.2:1; add a tile/patch instead. Frame selection is stable for the whole swing.
5. **Clutter in co-op?** At four players plus a horde, the local swing retains body+lip; remotes drop component overrides, then lip, then subdivision. No ordinary swing spawns a full FX pack.
6. **Slow weapons leave harmless danger on screen?** The ADD lip ends at `B`; the NORMAL body is gone by `B + F ≤ B + 90 ms`.
7. **Fast weapons flash for less than a frame?** Capture S weapons at 30, 60, and 120 Hz. The active body must receive at least one rendered frame; if necessary, hold the last *active* sample for one presentation frame while keeping the lip cutoff tied to descriptor time.
8. **DPR/bloom dependency?** Compare DPR 1 and DPR 2. NORMAL paint must carry the same silhouette with bloom disabled.
9. **Spatial honesty?** In the Testing Grounds, overlay the shared blade segment and 21 px half-width. At every sampled frame, high-alpha PER vertices stay within the already-swept band and outer reach.
10. **Roster coverage?** Capture physical/fire/frost/shock/holy/toxic/void/arcane across S/M/L/XL, plus dual, thrust, heavy, pivot/punch, orbit, and spin. Unknown families must land on the default profile without throwing or changing reach.

Ship only after these captures pass against both painted terrain and the busiest enemy-density scene. The success test is not “more particles”; it is that a player can identify direction, active edge, weapon weight, and element from one paused contact frame—with no white X and no speed-line comb.
