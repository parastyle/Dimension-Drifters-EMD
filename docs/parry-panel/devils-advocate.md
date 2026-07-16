# Devil's advocate: a glowing blade is not yet a trustworthy clock

## Ruling

The director is right about the causal failure. The current enemy cue says “this body is dangerous now,” while the sword remains in an idle pose; the visible swing starts only after the server bumps `atkSeq` on the damage tick (`packages/server/src/rooms/GameRoom.ts:3421-3425`, `packages/server/src/rooms/GameRoom.ts:3475-3481`; `packages/client/src/scenes/ArenaScene.ts:2794-2810`). That reverses the useful order. The weapon should claim the player's attention, visibly load, commit, and then cross the target on the hit beat.

The director is also right that the present cone is not the whole truth. Ordinary melee does not damage “the cone currently painted under the enemy.” The server first lunges the attacker, then applies an instantaneous point-in-sector test from the **post-lunge** origin toward the selected target (`packages/server/src/rooms/GameRoom.ts:3421-3425`, `packages/server/src/rooms/GameRoom.ts:3447-3463`, `packages/server/src/rooms/GameRoom.ts:3475-3481`). The client instead draws its cone from the interpolated pre-lunge rig position and independently reacquires the nearest player (`packages/client/src/scenes/ArenaScene.ts:3117-3139`). Calling that cone exact is indefensible.

I nevertheless reject the simple prescription “remove the body tell, light the weapon, add a range circle.” At horde scale, a thin weapon can disappear behind bodies and effects; a late packet can make a terminal weapon flash arrive after the useful decision point; and a circle is not the sector-plus-lunge that actually hits. The boss telegraph panel already reached the relevant principle: source performance supplies causality, while a restrained, redundant fairness cue survives zoom, occlusion, network delay, and color-vision differences (`docs/telegraph-panel/devils-advocate.md:7-13`, `docs/telegraph-panel/devils-advocate.md:42-52`). Melee should inherit that principle, not copy the boss footprint wholesale.

My acceptable rule is:

> **The weapon owns anticipation and impact. The rhythm cue owns readable timing. Any range mark admits that it is an envelope, not a hitbox.**

## What the current contract actually guarantees

`EnemyState.windup` is a normalized 0→1 field for a parryable attack, not an animation clip or a future impact timestamp (`packages/shared/src/state.ts:153-156`). `stepDuelists` starts it when a target is within `approach`, advances it for the first strike and every combo follow-up, and computes the synced value from the remaining timer (`packages/server/src/rooms/GameRoom.ts:3371-3388`, `packages/server/src/rooms/GameRoom.ts:3420-3442`). The Ronin's first wind-up is 0.52 seconds, but its later beats are only 0.34 seconds; the Vault Ronin uses 0.46 and 0.30 seconds (`packages/shared/src/enemies.ts:388-397`, `packages/shared/src/enemies.ts:437-446`). Derived rusher/swarm/zoner lunges use the same state machine, with a 0.32-second swarm wind-up (`packages/shared/src/enemies.ts:551-579`; `packages/shared/src/constants.ts:567-572`).

The client reads that direct synced field while the enemy root itself renders on a 120 ms snapshot delay (`packages/shared/src/constants.ts:141-149`; `packages/client/src/scenes/ArenaScene.ts:2935-2949`). It eases rising `windup` values but snaps falling values to zero, then draws a body-adjacent white disc, a 52→22 px rhythm ring, and the melee cone (`packages/client/src/scenes/ArenaScene.ts:3093-3145`). This is why the body appears to blink before the sword moves: the early source cue is the anticipation layer, while `atkSeq` currently starts the weapon animation only on resolve.

The parry is deliberately generous enough for an early tell. The server runs at 20 Hz, grants 0.52 seconds of i-frames, uses a 0.60-second miss cooldown, accepts a 0.20-second on-cooldown buffer, and shortens a successful chain's cooldown to 0.12 seconds (`packages/shared/src/constants.ts:15-18`, `packages/shared/src/constants.ts:512-537`). An accepted input grants those i-frames immediately on the server (`packages/server/src/rooms/GameRoom.ts:616-640`, `packages/server/src/rooms/GameRoom.ts:3241-3248`), and a swing checks that authoritative window only after confirming that the player center lies in the sector (`packages/server/src/rooms/GameRoom.ts:3479-3485`). The local `parryGfx` ring is merely a client mirror of the press and constants; the server still owns whether the window exists (`packages/client/src/scenes/ArenaScene.ts:5396-5427`).

The actual ordinary-melee footprint is therefore:

1. choose the nearest player on the server;
2. creep during wind-up;
3. at resolve, move forward by up to `step`, stopping no closer than `range × 0.45`;
4. from that new origin, test whether each player **center** is within `range` and within `halfArc` of the target direction (`packages/server/src/rooms/GameRoom.ts:3350-3369`, `packages/server/src/rooms/GameRoom.ts:3447-3463`; `packages/shared/src/enemies.ts:648-666`).

It is a directional sector after a translation. It is not a circle, lane, swept blade capsule, or collision against the painted sword. Boss `meleeCombo` is a different and cleaner case: its cone and melee payload share a trigger-time origin/aim, and `BossController` plants the boss until resolve (`packages/shared/src/boss-primitives.ts:546-575`; `packages/server/src/rooms/BossController.ts:170-173`). The horde system cannot borrow that boss claim of exact co-location without first reconciling its lunge.

The rig can support a weapon-led source tell without new art, but this is not already wired. Enemy rigs equip `wieldsWeapon` into private weapon `Image`s owned by the hand (`packages/client/src/scenes/ArenaScene.ts:2780-2785`; `packages/client/src/entities/SpriteRig.ts:501-509`, `packages/client/src/entities/SpriteRig.ts:1010-1045`). Those Images can be tinted, additively echoed, and scaled, and the procedural swing vocabulary already moves the weapon and body around a frozen aim (`packages/client/src/entities/SpriteRig.ts:1093-1163`, `packages/client/src/entities/SpriteRig.ts:2218-2261`). However, the existing Brand/downed/impact tint helpers iterate `parts`, not `weapons`, so a weapon-tell API needs explicit priority and cleanup rather than piggybacking on `flash()` (`packages/client/src/entities/SpriteRig.ts:1203-1223`). Handless rigs are also allowed to own a drop weapon without drawing it (`packages/shared/src/enemies.ts:489-524`). Weapon-only is therefore not a universal fallback.

## Challenge 1: can a glowing sliver carry timing in a four-player horde?

**Verdict: fatal as the sole timing channel; manageable as the primary source channel with a minimum-size redundant beat.**

### Steelman

Weapon focus fixes the largest experiential lie. A sword that draws back, gains luminance, steadies at lock, and then cuts through the target gives the eye one causal object to follow. It also distinguishes a melee commitment from an enemy merely walking nearby. Because every non-boss/dummy kind is assigned an existing held weapon when its rig has hands, the content coverage is broad without new art (`packages/shared/src/enemies.ts:489-524`). `SpriteRig` already has the hand ownership, weapon pivot, swing styles, and frozen aim needed to turn the synced phase into anticipation rather than invent another animation system (`packages/client/src/entities/SpriteRig.ts:1007-1091`, `packages/client/src/entities/SpriteRig.ts:1093-1163`).

### Attack

The Sekiro comparison has a scale assumption Dimension Drifters does not share. Here the server permits 80 enemies, the debug summon can add 30 at once, and up to 10 players can occupy the arena (`packages/shared/src/constants.ts:244-265`). A player may be tracking several attackers while teammates, projectiles, drops, damage numbers, and paper bodies cross the same pixels. The Ronin's Voltedge is long but visually slender: its source part is 256×35 and is scaled to a 125 px display length, leaving roughly a 17 px-thick painted strip before crowd occlusion and contrast loss (`packages/client/src/sprites/manifest.ts:5785-5809`; `packages/shared/src/weapons.ts:849-861`). Other blades, foreshortened orientations, handless rigs, and off-screen-edge attackers fare worse.

A raw white tint fails in at least four ways:

- it can merge into pale floor/VFX values or bloom;
- it can be hidden by another rig while the attack sector still reaches the player;
- thirty simultaneous white blades become sparkle noise with no threat ranking;
- longitudinal scale pulsing changes the apparent weapon reach, creating a second WYSIWYG lie.

The colorblind-safe contract rules out hue as the rescue. The sibling panel requires high luminance **plus** inward motion, distinct edge structure, and a stable screen-space minimum—not body tint alone (`docs/telegraph-panel/devils-advocate.md:42-52`). The melee equivalent should use a dark separation keyline, a white-hot weapon core, and a non-hue rhythmic change in width/halo/pose. Painted particles may reinforce nearby threats, but cannot be the only tell.

The manageable version gives every committed attacker a cheap weapon pose and luminance change, while reserving a larger additive echo or a few particles for attacks threatening the local player. A compact source bracket/rhythm mark survives when the weapon is occluded or absent. That fallback is not permission to whiten the whole body again; it is a stable, weapon/hand-anchored minimum cue.

## Challenge 2: does the early body blink compensate for latency better than a late weapon flash?

**Verdict: the early claim is necessary; treating it as the exact “parry now” beat is not. Moving all urgency to a terminal weapon flash is fatal under the current wire.**

### Steelman

A snappy terminal blade beat is what the current presentation lacks. The sword should reach maximum load, flare once, and release across a short, forceful interval. That would let the player time against the weapon rather than a detached body disc, and it would make `atkSeq` feel like contact instead of the start of an animation.

### Attack

At 20 Hz, the source phase advances in 50 ms steps before transport delay is considered (`packages/shared/src/constants.ts:15-18`). If a patch is observed 50–100 ms after the authoritative step, a 0.52-second first tell has lost roughly 10–19% of its decision time; a 0.34-second follow-up has lost 15–29%; a 0.32-second swarm tell has lost 16–31%. `PARRY_BUFFER_SECONDS` does not rewind late network input—it only queues a press that reached the server while the parry cooldown was still active (`packages/server/src/rooms/GameRoom.ts:632-639`, `packages/server/src/rooms/GameRoom.ts:1891-1900`).

The present early blink is therefore doing useful compensatory work. The first Ronin wind-up and the base i-frame window are both 0.52 seconds (`packages/shared/src/enemies.ts:388-397`; `packages/shared/src/constants.ts:512-515`): pressing on first observation is intentionally safe even though the sword has not moved. Removing that early claim and waiting for, say, the last 100–150 ms would make a visually superior flash a worse networked input cue.

But the compensation is accidental and inconsistent, not a correct latency model. `windup` carries phase only—no cast start tick or resolve epoch—and the client applies a rising ease that lags the already-delayed samples (`packages/shared/src/state.ts:153-156`; `packages/client/src/scenes/ArenaScene.ts:3093-3106`). The root underneath it is rendered 120 ms in the past. A client cannot know from this field whether a missing increment is normal cadence, jitter, or the final unresolved step. The boss-panel advocate identified the same failure: replaying a pose from packet arrival is fatal; first observation must sample the current authoritative phase and later samples may correct it (`docs/telegraph-panel/devils-advocate.md:77-94`).

The acceptable use of the current field is two-stage:

- **Claim/load:** on the first observed nonzero `windup`, immediately pose and light the weapon at the observed phase. Do not replay from zero. Keep a subdued redundant rhythm mark from that first sample so an early press remains legible and rewarded.
- **Lock/release:** make the last third visually sharper through weapon steadiness, a high-contrast width/halo pulse, and a short release pose. Between 20 Hz samples, interpolate cosmetically and monotonically, but never run beyond a near-impact clamp or extend the authoritative window. A falling `windup` cancels/snaps the anticipation; `atkSeq` confirms release/contact and recovery rather than starting the whole swing.

This preserves the early network margin while moving the player's visual attention from the body to the blade. It cannot make a 100 ms-late patch punctual, but it avoids making it worse.

## Challenge 3: does a range circle solve the cone complaint, or add another abstraction?

**Verdict: fatal if sold as the hit footprint; manageable as a thin, explicitly approximate commitment envelope paired with weapon direction.**

### Steelman

A circle is faster to parse than a filled cone, survives attacker overlap, and can perform two jobs with one low-mass shape: its radius communicates scale while its cadence communicates time. Replacing the current 52→22 px body ring with a ring whose settled radius reflects attack reach would answer a real question the current rhythm cue ignores (`packages/client/src/scenes/ArenaScene.ts:3141-3145`). It also avoids painting every melee attack as the same large wedge.

### Attack

A full circle says “equally dangerous in every direction.” That is false. `inMeleeArc` rejects points outside `halfArc`, and the server translates the origin before testing (`packages/shared/src/enemies.ts:648-666`; `packages/server/src/rooms/GameRoom.ts:3447-3481`). Centering a radius-`range` circle on the pre-lunge body hides forward reach; using `range + step` covers that reach but grossly overstates the sides and rear. Centering the circle on a client-predicted post-lunge point is closer, but target motion, nearest-player changes, and the enemy's 120 ms render delay prevent exactness under the current protocol.

The present cone is wrong in placement, not wrong merely because it is a cone. Its sampled outline does represent the server's sector mathematical shape (`packages/client/src/scenes/ArenaScene.ts:3151-3220`); it becomes dishonest because it is rooted and aimed from different presentation state than the resolve. Replacing a misplaced sector with a circle trades one lie for a simpler one.

The manageable circle must therefore refuse hitbox semantics:

- no fill and no solid 360-degree danger edge;
- a low-alpha broken circumference for approximate commitment distance;
- a solid forward outer arc or direction notch aligned with the loaded weapon, so rear space does not read equally threatened;
- when a lunge is part of the move, offset/lead the envelope toward the predicted post-lunge origin or add a short forward travel tick; never label it “exact”;
- use stable radius for range and segment convergence/line weight for timing—do not continuously shrink the only range reference into the body.

For ordinary melee, exact safe-space geometry is impossible from `windup` alone because future origin and aim are not synced. If design requires an exact footprint, the server must commit and expose those values as the boss primitive does; presentation cannot manufacture authority. Until then, the range ring is navigation aid and rhythm instrument, not collision documentation.

## Fatal versus manageable

| Proposal or risk | Ruling | Condition |
|---|---|---|
| Weapon tint/pose becomes the primary causal tell | **Manageable and desirable** | Add a dark keyline, white luminance, screen-space minimum halo, and occlusion/handless fallback. |
| Weapon art alone carries the parry clock | **Fatal** | Small/foreshortened/covered weapons and horde sparkle cannot guarantee perception. |
| Longitudinally scale the blade to pulse | **Fatal** | It changes apparent reach. Pulse halo width, luminance, or perpendicular thickness instead. |
| Remove the early claim and flash only near impact | **Fatal** | A 50–100 ms delivery delay consumes too much of 0.30–0.52-second tells. |
| Keep an early low-intensity cue, then sharpen the last third | **Manageable and desirable** | Sample current `windup`, never replay phase zero, and keep late interpolation cosmetic/clamped. |
| Continue starting the entire weapon swing from `atkSeq` | **Fatal** | `atkSeq` is bumped on the authoritative hit tick; it belongs at release/contact, not anticipation. |
| Use a full range circle as the actual hitbox | **Fatal** | Ordinary melee is a post-lunge directional sector, not radial damage. |
| Use a broken range/rhythm envelope with a solid forward arc | **Manageable** | Explicitly approximate, no fill, direction remains weapon-led, and lunge travel is acknowledged. |
| Remove every non-weapon fallback | **Fatal** | Handless rigs, occlusion, low contrast, and accessibility defeat a blade-only contract. |
| Use existing weapon Images and painted particles | **Manageable** | No new art is needed, but particles are budgeted reinforcement and tint state must restore cleanly. |

## The hybrid I would accept

1. **Weapon-first, not weapon-only.** From the first nonzero `enemy.windup`, the attacking hand and weapon enter a real anticipation pose. The weapon gains a dark separation rim plus high-luminance white core; a bounded additive echo or 1–3 painted motes broadens the cue without stretching the blade. Whole-body whitening is removed. A compact hand/weapon bracket supplies the minimum cue when the sprite is occluded, absent, or visually too thin.

2. **One authoritative phase, two presentation beats.** `enemy.windup` remains the timing source. Claim/load begins immediately at the current observed phase. Lock is a sharper last-third pose and luminance/width pulse, not the first warning. Cosmetic interpolation between 20 Hz values is monotonic and clamped below resolve; a downward value cancels immediately. `atkSeq` drives the short crossing/contact/follow-through beat from the already-loaded pose.

3. **A range rhythm, not another floor hitbox.** Replace the fixed 52→22 px ring and persistent full-cone read with a thin broken envelope sized from the melee definition. Its forward outer arc/direction notch is solid and agrees with the weapon; the remainder is visibly secondary. For lunges, lead it toward the predicted post-lunge origin or show a forward travel tick. It never claims exact safe space. Boss melee may retain an exact thin sector because its origin/aim are committed and planted.

4. **Threat-scaled horde salience.** Every wind-up gets pose plus the minimum luminance/rhythm cue. Only attacks plausibly threatening the local player receive the broader halo/particles and strongest forward arc; decorative density degrades before timing. This follows the sibling contract's crowd rule while keeping the response channel invariant (`docs/telegraph-panel/devils-advocate.md:26-40`).

5. **Colorblind and low-vision redundancy.** White remains the parry category, but success cannot depend on distinguishing hues. Dark/light contrast, inward segment motion, weapon pose, and the forward-versus-broken edge pattern all encode the event. Validate in grayscale, against pale and busy floors, at minimum weapon thickness, with effects reduced, and with overlapping attackers.

6. **Latency and truth gates.** Test first-hit and 0.30–0.34-second combo beats under synthetic 0/50/100/150 ms patch delay. The cue must catch up to the observed phase without restarting, and parry success must not drop merely because urgency moved from body to weapon. Separately capture the server's pre-lunge origin, post-lunge origin, aim, `range`, and `halfArc` against the rendered envelope; no review may call the ordinary-melee ring or arc exact while those differ.

This hybrid accepts the director's core demand: **the player watches the weapon, not a blinking torso, and the visible blade is already moving before damage resolves.** It retains one lesson from the old blink: the networked game must announce commitment early. It also refuses to answer “cones are abstract and wrong” with “here is a different abstract shape presented as truth.” The weapon tells the story, the rhythm makes the timing readable, and the range mark stays honest about being approximate.
