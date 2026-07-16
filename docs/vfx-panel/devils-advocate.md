# Devil's advocate: subtraction is a credible upgrade

## Ruling

Do not replace the three complained-about fallback layers yet. The first candidate worth playtesting is deletion of `twin-slash`, `thrust-streak`, and `blade-trail` from the **synthesized fallback only**. Keep the layers available to authored suites, keep the weapon animation, and let confirmed-hit feedback carry the visual emphasis.

That is not an aesthetic surrender. It is a claim about information hierarchy: in a top-down bullet-heaven, a swing effect earns screen area only if it communicates something the weapon pose, enemy reaction, and confirmed impact do not already communicate. A louder but approximate slash can be worse than no slash.

One citation correction matters. In this snapshot, the audit's explicit melee-WYSIWYG finding is in B1: the rendered slash can be about 49 px away from the server sweep while strafing (`docs/GAMEFEEL_AUDIT.md:93-96`). The explicit `§20` reference at B4 concerns momentum/impulses (`docs/GAMEFEEL_AUDIT.md:104-105`). I use the defensible doctrine common to both: presentation should reveal gameplay truth, not merely add motion.

## What the current code actually draws

These are not neutral placeholders that only need better color:

- All three layers are registered as `swing` layers (`packages/client/src/vfx/vfx-layers.js:37-65`).
- `blade-trail` draws a filled crescent, a white inner arc, and up to several 1.1 px arc lines (`packages/client/src/vfx/vfx-render.js:223-252`).
- `twin-slash` draws two opposing 5 px colored arcs, each capped by a 1.5 px white arc (`packages/client/src/vfx/vfx-render.js:288-299`).
- `thrust-streak` is literally one fading additive line from a trailing point to a moving head (`packages/client/src/vfx/vfx-render.js:300-310`).
- The live player clears and redraws the Graphics layer through the whole swing tween and asks the canonical renderer for mode `all` (`packages/client/src/vfx/VfxPlayer.ts:319-330`).

The complaint therefore identifies the medium, not just the tuning: thin additive vector marks are being asked to coexist with painted assets.

There is also strong precedent for subtraction. The fallback once included `edge-trail`; it was removed from every fallback after it read as a narrow white line, while authored suites retained access to it (`packages/client/src/vfx/VfxPlayer.ts:94-95`). Replacing today's lines before testing their absence ignores the lesson already recorded in the code.

The reported weapon attribution must be corrected before anyone edits a renderer:

- Twin Bowie Fangs is tagged `grip: "dual"` and `size: "S"` (`packages/shared/src/weapons.ts:702-720`); because the dual branch precedes the fast branch, its fallback does select `twin-slash` (`packages/client/src/vfx/VfxPlayer.ts:96-104`).
- Drowned Anchor (`x-sword-anchor`) is tagged 2H, L, physical, and `rangeBand: "close"` (`packages/shared/src/weapons.ts:753-774`). Under the current fallback classifier, that is heavy—not reachy or fast—so it selects `slash-arc`, `cleave-flash`, and `shockwave-ring`, not `thrust-streak` or `blade-trail` (`packages/client/src/vfx/VfxPlayer.ts:87-92`, `packages/client/src/vfx/VfxPlayer.ts:101-118`).

If Drowned Anchor reproduces the complaint in the current build, targeting the three named layers will not fix that instance. The test build must record `weaponId` and selected layer IDs; otherwise the panel is diagnosing screenshots by silhouette.

## Is more swing VFX even the right objective?

The strongest case for more swing VFX is real. A whiff still needs cadence; a fast knife should not feel like a maul; dual weapons should read as two attacks rather than one; elemental identity should be visible before contact. The fallback was explicitly designed to distinguish more than 300 unauthored weapons by element and archetype without per-weapon authoring (`packages/client/src/vfx/VfxPlayer.ts:21-27`). Removing everything would throw away useful anticipation and category information.

But the present swing effect is predicted feedback, not hit evidence. Plain-melee VFX is spawned before the client sends the attack to the server (`packages/client/src/scenes/ArenaScene.ts:3662-3689`). Its default position is a fixed point 60% along weapon range, while its size is a fixed VFX radius rather than damage geometry (`packages/client/src/scenes/ArenaScene.ts:5121-5139`). Making that mark broader, more opaque, or more painterly risks turning an approximate flourish into an apparent hitbox. That cuts directly against the audit's documented slash-versus-server offset (`docs/GAMEFEEL_AUDIT.md:93-96`).

Meanwhile, the rig already has a normalized pose window and dispatches weapon motion through arc, orbit, chop, pivot, thrust, and spin vocabularies (`packages/client/src/entities/SpriteRig.ts:750-785`). Ordinary arcs visibly drive the weapon from backswing through active motion and follow-through (`packages/client/src/entities/SpriteRig.ts:1117-1178`). The fallback is therefore supplementary motion, not the sole carrier of motion.

In survival play, supplementary motion has a burden of proof. A local or co-op partner's large bright smear occupies the same attentional channel as hostile projectiles, enemy windups, ground danger, and the exact point of impact. “More juice” is not automatically more readable. The desired hierarchy should be:

1. hostile danger and safe space;
2. confirmed contact and consequence;
3. weapon cadence and flavor.

The fallback streaks currently promote item 3 toward item 1.

## Is deletion actually supported by the painted inventory?

Yes, with an important qualification: the impact stack can carry **contact**, but it is not a perfect replacement for **attack ownership**.

The inventory is abundant but role-specific. The typed particle manifest describes individually painted, connected-component particles and enumerates 96 element-by-shape packs (`packages/client/src/vfx/particle-manifest.ts:1-9`, `packages/client/src/vfx/particle-manifest.ts:10-106`). The twelve component packs are explicitly bespoke islands with independent timelines, and the composer lists all twelve (`packages/client/src/vfx/fx-composer.ts:1-2`, `packages/client/src/vfx/fx-composer.ts:17-30`). Those are not automatically suitable universal smear textures.

The eight impact strips are a much cleaner fit for their assigned job. They are loaded as six-frame, 256 px flipbooks (`packages/client/src/scenes/arena/vfx.ts:15-18`, `packages/client/src/scenes/arena/vfx.ts:26-47`) and played additively at the damaged body's diameter, with physical/unknown resolving to steel (`packages/client/src/scenes/arena/vfx.ts:50-80`). Direct-hit feedback is driven from authoritative enemy HP decreases rather than the predicted click (`packages/client/src/scenes/ArenaScene.ts:3991-4027`).

Do not overclaim that path, though. Full painted hit stacks are budgeted to ten per update; excess hits retain the enemy flash and may retain a damage number but skip painted images, rings, and tweens (`packages/client/src/scenes/ArenaScene.ts:137`, `packages/client/src/scenes/ArenaScene.ts:4028-4047`). In co-op, the impact element is inferred from the nearest player's equipped weapon, not an authoritative attacker ID, and flipbooks are gated to inferred gun or ordinary-melee deliveries (`packages/client/src/scenes/ArenaScene.ts:4048-4075`). Thus deletion is justified by the whole feedback stack—weapon pose, enemy flash, number/audio when budget permits, and painted impact—not by pretending the flipbook is an infallible combat log.

The deletion risk is manageable. Physical dual and long-reach weapons could have no generic fallback swing graphic because the physical element flourish is empty (`packages/client/src/vfx/VfxPlayer.ts:79-80`); that is precisely what the A/B should test. A readable weapon pose plus honest silence on a whiff may be preferable to a conspicuous false contour.

## Attack the replacement proposals

### 1. Painted smears from existing art

**Steelman.** This is the fastest route to material coherence. Reusing steel wisps, elemental motes, or trimmed component art would bring brush texture, irregular edges, and color variation that Graphics strokes cannot. A small archetype library could preserve the current element-plus-shape system instead of authoring hundreds of weapons.

**Attack.** A smear is not just texture; it encodes a viewing plane, lighting direction, thickness profile, and motion path. A side-view anime crescent placed into a top-down scene can look like a vertical sheet standing on the floor. Stretching a discrete painted wisp or shard across weapons with different reach, swing arc, grip, and pose will also expose distortion. Worse, the effect still sits at the approximate fallback point and fixed VFX radius, not the actual weapon-tip trajectory or damage sweep (`packages/client/src/scenes/ArenaScene.ts:5121-5139`). Painting that approximation more convincingly can make the WYSIWYG lie more persuasive.

**Verdict.** Perspective and semantic mismatch are **fatal for a universal fallback smear**. They are manageable for a few curated hero weapons after in-game camera tests. Asset reuse itself is not fatal; assuming “painted” means “camera-agnostic” is.

### 2. Phaser Rope/Mesh ribbon with painted texture fill

**Steelman.** A ribbon can be generated in screen space, taper over time, bend along a sampled trajectory, and use a shared painted texture. In principle it solves the straight-line look without requiring a new bitmap for each weapon. Geometry can be pooled and bounded.

**Attack.** The current VFX call receives weapon ID, one origin, aim, radius, swing descriptor, and element; it receives no live hand or weapon-tip samples (`packages/client/src/vfx/VfxPlayer.ts:261-272`). A bolt-on ribbon would therefore invent a path from archetype metadata rather than follow the painted weapon. Dual grips, combo reversals, thrusts, spins, and two-handed poses would vary in quality across the catalog. Plumbing actual tip samples from the rig could solve this, but then this is an animation/VFX integration project, not a renderer swap.

The batching/performance objection is serious but not automatically fatal. The current design pools surfaces to a cap of twelve under one bloom root (`packages/client/src/vfx/VfxPlayer.ts:151-162`) and attaches one Graphics object plus pooled emitters to each surface (`packages/client/src/vfx/vfx-render.js:664-684`). A fixed-segment, shared-texture, pooled ribbon might fit that budget, but it must prove frame time and draw-call behavior in a four-player horde. “Mesh” is not a performance plan.

**Verdict.** Unmeasured batching risk is **manageable**. A ribbon that is not driven by the actual rig trajectory is **fatal as a universal quality solution**. A motion-sampled ribbon may be viable later, but it fails the minimal-intervention test.

### 3. Per-weapon authored suites

**Steelman.** This gives an artist control over exceptions: dual claws need different spacing from twin knives; an anchor should not share a rapier's language. The canonical renderer is deliberately shared by Weaponsmith and the live game, so preview and shipping output use the same drawing code (`packages/client/src/vfx/vfx-render.js:1-11`). At runtime an authored non-empty suite already wins over fallback (`packages/client/src/vfx/VfxPlayer.ts:279-284`). For a few signature or legendary weapons, this is the quality ceiling.

**Attack.** The fallback exists specifically because the expansion catalog has more than 300 weapons without authored suites (`packages/client/src/vfx/VfxPlayer.ts:21-27`). Making individual authoring the baseline replaces one visible defect with a permanent content-production and regression matrix. It also does not automatically fix gameplay truth: an authored suite rendered at the same approximate origin and fixed radius can still disagree with damage space (`packages/client/src/scenes/ArenaScene.ts:5121-5139`).

**Verdict.** Per-weapon authoring as catalog policy is **fatal on scale**. A curated exception budget for a small number of identity-defining weapons is **manageable and desirable**, but it is not the fallback answer.

## Fatal versus manageable, plainly

Fatal to the proposed universal solutions:

- a painted smear whose perspective and path are not validated in the top-down camera;
- a ribbon that invents motion because it has no weapon-tip samples;
- individual suite authoring across the expansion catalog;
- any more salient swing shape presented as damage geometry while it remains spatially approximate.

Manageable:

- a temporary loss of extra whiff spectacle while the weapon itself still animates;
- the impact stack's budget and co-op attribution limitations, provided it is treated as contact feedback rather than attacker truth;
- Rope/Mesh performance, if a later prototype uses shared textures, fixed geometry, pooling, and measured four-player worst cases;
- hand-authored exceptions for a small, explicitly capped prestige set.

## Minimal intervention I would accept

Run one reversible content-selection experiment:

- Remove `twin-slash` and `thrust-streak` from synthesized fallback branch outputs.
- Remove only `blade-trail` from the fast fallback; retain its existing `slash-arc` for the test.
- Do not delete layer definitions or renderers, because authored suites may still choose them.
- Do not replace them with smears, particles, ribbons, or per-weapon assignments in the same test.
- Log `weaponId`, fallback branch, and selected layer IDs so the Drowned Anchor mismatch cannot contaminate the result.

The deciding playtest metric should be **avoidable incoming hits per 100 player/nearby-partner swing windows**, where a window runs from swing start through 300 ms after its pose ends, tested current-versus-streakless in counterbalanced runs on the same seeded horde scenarios. Pre-register deletion as the winner only if it reduces that rate by at least 10% with the confidence interval excluding no improvement. Use **connected-hit recognition accuracy** on sampled attacks as a guardrail: deletion must be non-inferior within 5 percentage points against authoritative hit logs.

That metric answers the actual design question. If players survive visual congestion better and still know when they connected, deletion is the upgrade. If hit recognition materially falls, then—and only then—prototype one motion-sampled textured ribbon, not a catalog-wide smear program.
