# Melee Parry Language — Senior Combat Design Contract

## Panel verdict

The director's diagnosis is correct: the present tell asks the player to time a body-adjacent white blink while the weapon is still idle. The weapon animation begins only when `atkSeq` changes, but the server increments `atkSeq` on the same tick that it applies damage (`packages/server/src/rooms/GameRoom.ts:3421-3425`, `packages/server/src/rooms/GameRoom.ts:3475-3485`; `packages/client/src/scenes/ArenaScene.ts:2794-2810`). Cause and consequence are backwards.

The replacement language is:

> **Read the weapon for intent. Read the white glint for the parry beat. Read the thin range edge for the exact space that will be tested.**

These are redundant channels, not alternatives. Weapon motion supplies causality; a high-luminance, non-hue glint supplies response timing; the ground edge supplies spatial truth when a weapon is small, occluded, handless, off-screen, or budgeted out. This inherits the sibling panel's rule that the source explains why while an authoritative underlay guarantees fairness (`docs/telegraph-panel/combat-designer.md:15-17`, `docs/telegraph-panel/combat-designer.md:49-59`; `docs/parry-panel/devils-advocate.md:119-131`).

The current whole-body white disc and fixed 52→22 px ring are retired. White belongs on the attacking implement and on the exact response edge, not across the enemy's torso (`packages/client/src/scenes/ArenaScene.ts:3093-3145`).

## The authority this design must respect

### Timing truth

`EnemyState.windup` is the sole horde-melee countdown. It is normalized progress from 0→1 for a parryable attack, synced at the server's locked 20 Hz rate (`packages/shared/src/state.ts:153-156`; `packages/shared/src/constants.ts:15-18`). `stepDuelists` writes it for the first strike and every follow-up from the current state-machine timer (`packages/server/src/rooms/GameRoom.ts:3371-3388`, `packages/server/src/rooms/GameRoom.ts:3420-3442`). No client timer may restart the attack, extend it, or decide that impact occurred.

The resolve signal for ordinary melee is the rising-to-falling edge of `windup` together with the `atkSeq` increment. The server changes phase and attacks before it writes the next public `windup`, so a client is not guaranteed a delivered sample of exactly `1.0` (`packages/server/src/rooms/GameRoom.ts:3420-3442`). `atkSeq` therefore confirms contact/recovery; it must no longer start a complete swing from its idle frame (`packages/shared/src/state.ts:148-156`; `packages/client/src/scenes/ArenaScene.ts:2794-2810`).

### Spatial truth

Every current non-boss melee attack routed through `effectiveMelee` uses the same authoritative geometry:

1. Find the nearest player.
2. Creep during wind-up.
3. On resolve, lunge forward by up to `step`, stopping at `range × 0.45` from the target.
4. From that **post-lunge origin**, test each living player's center against `range` and `±halfArc` (`packages/server/src/rooms/GameRoom.ts:3350-3369`, `packages/server/src/rooms/GameRoom.ts:3421-3425`, `packages/server/src/rooms/GameRoom.ts:3447-3481`; `packages/shared/src/enemies.ts:648-666`).

That is an instantaneous translated sector. It is not a full circle, lane, capsule, or collision against the painted blade. The player's weapon system does contain real swept-blade geometry, but horde duelists do not call it (`packages/shared/src/melee.ts:6-12`; `packages/server/src/rooms/GameRoom.ts:3466-3485`). Animation may make the blow feel swept; the footprint must continue to describe the sector the server actually tests.

The present client sector has the right mathematical family but the wrong authority: it is rooted at the interpolated, pre-lunge rig and reacquires its own nearest player (`packages/client/src/scenes/ArenaScene.ts:3117-3139`). A full range circle would be a second lie. Boss `meleeCombo` is already the clean reference: its trigger-time origin, aim, telegraph sector, and payload agree, and the boss is planted until resolve (`packages/shared/src/boss-primitives.ts:546-575`; `packages/server/src/rooms/BossController.ts:170-173`).

### Parry truth

`PARRY_IFRAMES = 0.52` seconds begins when the server accepts a parry; a melee hit counts as parried only when the player's center is in the sector and the server's `invuln` value is still positive (`packages/shared/src/constants.ts:512-517`; `packages/server/src/rooms/GameRoom.ts:3241-3248`, `packages/server/src/rooms/GameRoom.ts:3479-3485`). This is a generous defensive window, not a 520 ms “perfect flash.”

`PARRY_BUFFER_SECONDS = 0.20` queues a press that reached the server while parry was on cooldown, and a successful parry reduces the next chain cooldown to `0.12`; neither rule rewinds an input that arrived after damage (`packages/shared/src/constants.ts:527-537`; `packages/server/src/rooms/GameRoom.ts:632-639`, `packages/server/src/rooms/GameRoom.ts:1891-1900`). The local `parryGfx` active/cooldown ring remains the player's status display; it mirrors the shared i-frame/cooldown constants but never decides the verdict (`packages/client/src/scenes/ArenaScene.ts:5396-5427`).

## 1. Weapon-carried tell

### Mandatory visual hierarchy

For every **full** melee tell:

1. The held weapon or striking limb moves first. The torso may counter-lean, plant, or squash to support the action, but it never flashes white as the timing carrier.
2. The implement draws back through a recognizable anticipation arc aimed along the attack's committed axis.
3. Its painted sprite remains visible beneath a 2–3 screen-pixel dark separation rim and a high-luminance white additive echo. Do not replace the art with a flat white silhouette for the whole wind-up.
4. The white echo thickens perpendicular to the weapon and brightens; it never pulses the blade's longitudinal scale, because changing apparent weapon length creates a false reach cue.
5. At the glint, the striking third of the weapon produces one 45–70 ms white-hot crest and at most three inward-painted motes. After the crest, a steady white edge remains until contact; there is no second body flash.

No new art is required. Enemy rigs already create held weapon `Image`s on their hands and retain those images privately (`packages/client/src/entities/SpriteRig.ts:501-509`, `packages/client/src/entities/SpriteRig.ts:1010-1045`), while the installed particle manifest supplies reusable painted sparks, motes, and rings (`packages/client/src/vfx/particle-manifest.ts:4-17`, `packages/client/src/vfx/particle-manifest.ts:66-105`). Because Brand/downed/hit-flash restoration currently iterates body `parts`, not held `weapons`, the tell needs its own weapon-overlay state and explicit clear path rather than borrowing `flash()` (`packages/client/src/entities/SpriteRig.ts:1203-1223`).

The implementation seam belongs inside `SpriteRig`, where weapon angle, hand ownership, position, scale, and draw depth are already resolved every frame (`packages/client/src/entities/SpriteRig.ts:2091-2149`, `packages/client/src/entities/SpriteRig.ts:2960-3166`). `ArenaScene` supplies phase, committed aim, attack family, combo beat, and full/underlay rank **before** `rig.animate`; the current order computes the enemy tell after animation and is one frame too late to pose the weapon (`packages/client/src/scenes/ArenaScene.ts:3056-3107`).

### Wind-up pose by enemy attack archetype

The shared player rig already provides arc, chop, rake, punch, and thrust poses plus three-step sequences; enemy tells sample only their anticipation/commit portions, then use a short release from the loaded pose (`packages/shared/src/melee.ts:103-156`, `packages/shared/src/melee.ts:157-214`, `packages/shared/src/melee.ts:267-383`; `packages/client/src/entities/SpriteRig.ts:2218-2265`, `packages/client/src/entities/SpriteRig.ts:2453-2695`). The pose family follows the **AI attack archetype first**, then the held weapon's grip/shape. This prevents a gun-tagged melee enemy from remaining in the gun-aim branch and prevents a randomly assigned novelty weapon from rewriting the server attack (`packages/client/src/entities/SpriteRig.ts:2124-2137`; `packages/shared/src/enemies.ts:489-524`).

| Enemy attack archetype | Wind-up pose | Release/contact read |
|---|---|---|
| **One-handed duelist, hit 1** | Forehand load: point travels 55–70° behind the outside shoulder; weapon hand retracts 0.20 body-heights; front foot plants and torso counter-rotates 6–10°. | Edge accelerates across the committed axis; the aim line is crossed on the resolve edge, followed by a 100–140 ms high/crossed guard. This is the existing “forehand cut” vocabulary (`packages/shared/src/melee.ts:108-122`). |
| **One-handed duelist, hit 2** | Reverse load from the prior crossed guard: blade folds toward the far hip, elbow/hand crosses the body, rear foot becomes the plant. Do not return to neutral between combo beats. | Backhand cuts in the opposite direction and settles outside, using the existing reverse step rather than replaying hit 1 (`packages/shared/src/melee.ts:123-136`). |
| **One-handed duelist, hit 3** | Finisher load: blade lifts above and slightly behind the head, striking hand rises 0.16 body-heights, body lengthens, then hard-plants. | Down-forward diagonal crosses aim on contact, with the strongest squash and longest 140–180 ms follow-through (`packages/shared/src/melee.ts:137-155`; `packages/client/src/entities/SpriteRig.ts:2623-2658`). |
| **Heavy/two-handed duelist** | Hit 1 loads over the rear shoulder; hit 2 starts low for a reverse rising cut; final hit raises into an execution hang. Both hands visibly stay on the haft and feet own the pose. | Shoulder chop → rising reversal → vertical/diagonal execution. Use the chop sequence, not the rig's generic waist-orbit fallback, because the attack is an instantaneous forward sector rather than a 360° damage sweep (`packages/shared/src/melee.ts:157-214`; `packages/shared/src/melee.ts:637-647`). |
| **Rusher, single lunge** | Thrust-like outside draw: weapon/lead limb retracts 0.18–0.25 body-heights along the committed axis; body compresses backward while the lead foot points forward. A broad blade may use a compact shoulder slash, but still reads as one direct commitment. | First 20–25% of the forward motion begins before impact; the implement crosses the aim line as the root performs its server lunge. Derived rushers use one hit through the common melee state machine (`packages/shared/src/enemies.ts:551-579`). |
| **Swarm, single fast lunge** | Needle/jab load: minimal 8–12° lateral motion, strong rearward squash, and a bright leading-tip bracket. On a handless swarm the bracket sits at the forward striking edge, never over the whole body. | A straight dart with an 80–100 ms follow-through. The short 0.32 s wind-up compresses Claim/Load but does not remove the early white implement cue (`packages/shared/src/constants.ts:567-573`; `packages/shared/src/enemies.ts:560-579`). |
| **Zoner/contact lunge** | Heavy shove/haymaker. If the assigned render is a gun, chamber it across the chest and lead with the grip/stock as a pistol-whip; suppress muzzle-aim language. If handless, use the forward implement bracket. | One wide, weighty cross into the same authoritative sector, then a vulnerable low recovery. Zoner's puddle remains a separate dodge-only threat; white applies only to this discrete `effectiveMelee` lunge (`packages/shared/src/enemies.ts:551-582`; `packages/shared/src/constants.ts:559-565`). |
| **Leaper combo** | The leap charge and landing marker stay red/dodge-only. White weapon loading begins only after landing starts the first melee wind-up; subsequent hits use the appropriate light/heavy duelist sequence without neutral resets. | Landing is not a parry glint. The first blade contact follows the new white wind-up, then the combo rhythm continues (`packages/server/src/rooms/GameRoom.ts:3375-3418`; `packages/shared/src/enemies.ts:423-448`). |
| **Boss `meleeCombo`** | Use the same arc/chop source language on the boss's weapon or attacking limb, driven by the boss telegraph row's `t`. The boss remains planted. | Weapon/limb crosses the row's captured `rot` as the exact sector payload resolves. This is the boss-panel sibling, not an `EnemyState.windup` consumer (`packages/shared/src/boss-primitives.ts:546-575`; `packages/server/src/rooms/BossController.ts:170-205`). |

Enemy combo direction may be presented as forehand/reverse/overhead, but the footprint remains the one centered sector until the server actually adopts signed per-step paths. The current shared combo paths are explicitly dormant for later authoritative use (`packages/shared/src/melee.ts:76-100`), and the rig already labels signed combo motion as presentation-only against legacy centered damage (`packages/client/src/entities/SpriteRig.ts:2239-2240`).

### Handless and occluded fallback

Some enemy kinds receive a drop weapon even when their rig has no usable hand, so `equipWeapon` can legitimately create no held image (`packages/shared/src/enemies.ts:489-524`; `packages/client/src/entities/SpriteRig.ts:1023-1051`). A full tell then anchors a 10–14 screen-pixel open bracket and the white glint at the committed striking point: forward hand if present, otherwise the leading body edge/mandible/attack origin. The bracket uses two opposing inward ticks plus a dark keyline. It is an implement marker, not a white torso disc.

If the weapon is occluded, the exact underlay still carries response, time, and reach. Do not raise the whole rig above other actors to rescue the weapon; draw-order cheating breaks spatial readability.

## 2. Timing contract

Let:

- `w` be the latest authoritative `EnemyState.windup` sample.
- `W` be the authored duration selected by a synced presentation-only `meleeTellStep`: `melee.windup` for step 0 or `melee.swingGap` for a follow-up. This step chooses pose and duration but never advances the clock.
- `R = (1 - w) × W` be authoritative remaining time represented by that sample.
- `L = 0.28 s` be the shipping glint lead budget.
- `wGlint = clamp(0.05, 0.70, 1 - L / W)`.

The durations already differ materially—Ronin uses 0.52/0.34 s, Vault Ronin 0.46/0.30 s, derived swarm 0.32 s, and the heavy Grave Warden 0.72/0.50 s—so a single normalized “flash at 70%” cannot be fair (`packages/shared/src/enemies.ts:388-397`, `packages/shared/src/enemies.ts:437-446`; `packages/shared/src/constants.ts:567-573`; `packages/shared/src/dimensions.generated.ts:566-588`). The absolute-lead formula makes the glint mean the same thing across cadences. On a 0.30 s beat it occurs almost immediately; on a 0.52 s beat it occurs near `w=.46`; on a 0.72 s beat near `w=.61`.

| Beat | Authoritative relation | Weapon | Range edge | Player meaning |
|---|---:|---|---|---|
| **Claim** | First observed `w > 0` | Immediately sample the current pose; break idle silhouette and begin the draw-back. Base sprite stays readable; faint white edge appears on implement only. | Full final footprint appears at low alpha; no coverage grows from zero. | “That weapon has committed.” |
| **Load** | `R > .28 s` | Travel through 70–85% of the anticipation arc. Feet/torso plant progressively; weapon luminance ramps monotonically. | Static exact boundary plus a dim perimeter fill advancing from both sector ends. | “This is the attack direction and range.” |
| **Glint / parry beat** | `R = .28 s`, or immediately on first observation if the sample has already passed it | 45–70 ms white-hot crest at the striking third; 2–3 px halo-width snap; no length pulse. The weapon is fully loaded and starts forward. | Matching 60 ms white edge pulse; the two perimeter fills step inward toward the aim-center notch. | **“Parry now.”** |
| **Commit** | `.28 s > R > .09 s` | Hold direction for at most 40 ms, then move through the first 20–30% of the incoming blow. The player is watching motion, not waiting on a body flash. | Perimeter fill accelerates; exact base edge never moves. | “The blow is on its way.” |
| **Contact approach** | `.09 s ≥ R > 0` | Fast ease-in through the remaining arc, stopping just short of the contact keyframe until authority confirms. | Filled perimeter converges on the forward notch; line width snaps once, not a slow sine breath. | “Impact.” |
| **Resolve** | Falling `windup` edge plus changed `atkSeq` | Cross the committed aim/contact keyframe immediately, then run only follow-through/recovery. Never begin from idle here. | One 40–60 ms full-edge flash, then clear. Successful parry response may replace it with the existing parry spark. | “Hit or parry verdict.” |
| **Cancel/stagger** | `windup` falls without `atkSeq`, enemy dies, or chain stagger clears it | Suppress contact; release the loaded pose over 70–100 ms and clear all weapon tint/echo state. | Clear immediately; no impact flash. | “The attack did not happen.” |

The server already clears a staggered attacker's `windup` when the parry chain interrupts its combo (`packages/server/src/rooms/GameRoom.ts:3543-3549`). Successful parry response remains the existing `parriedSeq`-driven spark, sound, cooldown refresh, and hit-stop; anticipation graphics must be gone before that payoff (`packages/client/src/scenes/ArenaScene.ts:5805-5829`).

### 20 Hz smoothing without inventing time

The current rising ease adds a large visual tail to an already delayed sample, while falling values snap to zero (`packages/client/src/scenes/ArenaScene.ts:3095-3106`). Replace that presentation rule with bounded phase reconstruction:

- On first observation, sample the received `w` immediately. Never replay Claim from zero.
- Between rising samples, use the measured positive slope to interpolate/extrapolate for at most one `TICK_MS` and clamp the pose to `< .98`. This removes stair-steps without locally declaring impact.
- A lower sample, `atkSeq` change, death, or loss of the state snaps anticipation out immediately.
- Weapon, glint, bracket, perimeter fill, and pulse all consume the same reconstructed phase. No layer owns a second clock.

Remote enemy roots intentionally render 120 ms behind the server timeline while the direct state field remains current (`packages/shared/src/constants.ts:141-149`; `packages/client/src/scenes/ArenaScene.ts:2929-2949`). Therefore phase is sampled from direct `windup`, never from rig motion or snapshot time. The exact underlay is anchored to committed server geometry, not to the delayed root.

### Latency budget

The 280 ms glint lead is allocated as follows:

| Budget item | Allowance |
|---|---:|
| 20 Hz sample age/quantization | 0–50 ms |
| Target server→client→server network path | 100 ms RTT |
| Render/input dispatch | 20 ms |
| Deliberate player response | 90 ms |
| Jitter margin | 20 ms |
| **Total** | **280 ms** |

If the player presses on the glint and the server accepts the message 50 ms later, the 0.52 s i-frame window still spans impact with roughly 230 ms of post-impact margin. That is why the glint can occur earlier than a single-player Sekiro spark while still feeling like a weapon commitment rather than a panic flash.

This contract targets 100 ms RTT. At 150 ms artificial delivery delay, the client must catch up to the observed loaded pose and fire a shortened 45–70 ms glint immediately; it must never restart the animation. If product requirements demand the same success envelope above the 280 ms budget, design must either lengthen the shortest 0.30–0.34 s follow-ups or add server-side late-input adjudication. `PARRY_BUFFER_SECONDS` cannot be counted as that compensation because it only handles cooldown ordering (`packages/server/src/rooms/GameRoom.ts:632-639`, `packages/server/src/rooms/GameRoom.ts:1891-1900`).

## 3. Range honesty

### Required server commitment

An exact pre-hit footprint is impossible while ordinary melee reacquires the nearest player, creeps, and computes its lunge only at resolve. To ship the director's “true geometry” requirement, horde melee must adopt the boss melee commitment rule:

1. On entry to each `windup`, snapshot the target/aim and compute the planned post-lunge origin using the same `step`, `range × .45` floor, and arena clamp that resolve will use.
2. Plant authoritative root movement for that beat. The existing forward creep becomes a rig-only weight shift; it may not move the hit origin after the footprint appears.
3. Store the committed origin and aim in `comboState`, use them for both `duelistLunge` and `duelistSwing`, and reacquire only when a follow-up wind-up begins. The relevant state transitions and resolve calls live together in `stepDuelists` (`packages/server/src/rooms/GameRoom.ts:372-387`, `packages/server/src/rooms/GameRoom.ts:3334-3445`).
4. Expose geometry-only `meleeTellX`, `meleeTellY`, and `meleeTellRot` plus presentation-only `meleeTellStep` beside `EnemyState.windup`. `meleeTellStep` disambiguates opening/next/finisher for late joiners and selects `windup` versus `swingGap`; none of these fields advances timing, and `windup` remains the sole phase authority (`packages/shared/src/state.ts:138-160`). Adding schema fields requires the normal `SCHEMA_VERSION` bump because field order is wire-significant (`packages/shared/src/constants.ts:8-13`).
5. At resolve, assert that the committed origin/aim passed to the sector test are byte-for-byte the values advertised. Clear them on recover, death, cancellation, and parry-chain stagger.

This capture is a small targeting commitment, not a new hitbox. Players who move out after Claim earn a whiff; enemies still advance by their authored lunge and follow-ups may reacquire between beats. Until this latch exists, any horde range mark must be styled as a broken **approximation** and may not be described in UI, tests, or review as exact (`docs/parry-panel/devils-advocate.md:80-102`).

### The footprint that replaces the cone mass

Once committed, construct the exact translated sector from:

- center = committed post-lunge `(meleeTellX, meleeTellY)`;
- radius = `effectiveMelee(kind).range`;
- angular interval = `meleeTellRot ± effectiveMelee(kind).halfArc`;
- hit convention = player center, including the server's point-blank acceptance (`packages/shared/src/enemies.ts:648-666`).

Render it through the same world-space geometry builder as boss telegraphs. That builder already samples cone arcs, projects every vertex for belt mode, and produces an exact edge plus a two-pixel inner echo (`packages/client/src/scenes/ArenaScene.ts:227-238`, `packages/client/src/scenes/ArenaScene.ts:340-396`). Remove the separate `strokeEnemyMeleeCone` path rather than maintaining two sector implementations (`packages/client/src/scenes/ArenaScene.ts:3151-3220`).

The new sector treatment is deliberately read as a **range arc**, not a filled cone:

- The outer curved edge at `range` is primary: dark 3–4 px terrain keyline, 1.8–2 px white line, and 1–1.2 px inward echo in screen space.
- The two radial sides are 65% of the outer edge's alpha. They preserve exact angular truth without dominating the floor.
- The complete boundary is present on the first observed wind-up frame. `w` changes energy, cadence, and perimeter completion—not radius or threatened coverage.
- A bright progress stroke fills the outer arc symmetrically from both ends toward the forward aim notch. At impact the two strokes meet. This is the requested “hit-timing circle” specialized to the attack's true angular interval.
- Three pairs of short ticks travel inward **along the perimeter** toward the forward notch. Their motion, the double edge, and the white weapon glint encode parryability without relying on hue.
- The non-damaging lunge from the visible root to the committed origin is shown only as a dim, broken travel stem ending in an open origin notch. It never shares the solid danger edge and never receives fill.
- There is no interior cone fill, no shrinking radius, and no 360° solid ring for a directional sector.

The generic telegraph renderer already follows the correct base doctrine—stable boundary, dark keyline, response-colored line, inner echo, and cadence driven by `t` rather than growing coverage (`packages/client/src/scenes/ArenaScene.ts:3366-3407`, `packages/client/src/scenes/ArenaScene.ts:3426-3458`). Horde melee should reuse that language with the more legible outer-arc completion above. Boss `meleeCombo` can use the same range-arc style immediately because its current row is already exact and planted (`packages/shared/src/boss-primitives.ts:546-575`; `packages/server/src/rooms/BossController.ts:170-173`).

Future thrust capsules, lanes, circles, or true swept-blade paths may select different builders only after the server changes the damage test. A pose name never authorizes presentation to invent gameplay geometry.

## 4. At-scale and accessibility rules

The simulation permits 80 enemies and the Testing Grounds can summon 30 at once, so unbounded weapon echoes and particles would turn the parry language into white noise (`packages/shared/src/constants.ts:260-265`). Salience is client-local and cosmetic; authority and underlays are never culled.

### Nearest-N policy

- A boss parryable melee cast always receives one reserved full-tell slot.
- Among ordinary winding attackers, the nearest **six** receive full tells: anticipation pose, weapon/implement rim, white-hot glint, bracket, and up to three painted motes.
- Rank attacks that already contain the local player's center first, then by distance from the player center to the committed footprint, then by lower `R`, then stable enemy id. Retain an incumbent until it resolves or a challenger is at least 20% closer; this prevents weapons flickering in and out of the six slots.
- Every other winding attacker receives the complete exact sector underlay, perimeter fill, and inward timing ticks only. No weapon echo, particles, bracket, or body whitening.
- Off-camera source art is never promoted merely because its sector reaches the camera; the visible part of its exact underlay remains.

The ranking belongs in `ArenaScene.animateEnemies`, which already owns the rendered enemy map, direct enemy state, local player positions, and per-enemy wind-up cache (`packages/client/src/scenes/ArenaScene.ts:565-580`, `packages/client/src/scenes/ArenaScene.ts:678-680`, `packages/client/src/scenes/ArenaScene.ts:3056-3148`). Compute the six winners once per frame before any rig is animated; do not allocate/sort inside each enemy's draw call. The existing bounded paper-death treatment provides a precedent for stable full-versus-lite enemy presentation (`packages/client/src/scenes/ArenaScene.ts:2863-2890`).

### Colorblind, low-vision, reduced-effects contract

White remains the parry category, but no required distinction depends on hue:

- **Source:** draw-back direction, weapon steadiness, a dark separation rim, and a short high-luminance thickness crest.
- **Footprint:** continuous double edge, forward notch, and inward-moving paired ticks. Dodge-only warnings retain warm broken edges and outward chevrons; their motion grammar cannot be mistaken for parry (`packages/client/src/scenes/ArenaScene.ts:3386-3406`, `packages/client/src/scenes/ArenaScene.ts:3426-3458`).
- **Timing:** perimeter completion and discrete 45–70 ms pulses survive grayscale, muted color, and pale floors.
- **Minimum size:** keyline, response line, echo, notch, and bracket use screen-space widths; zoom never reduces them below one physical pixel.
- **Reduced effects:** remove motes and additive bloom first. Keep anticipation pose for the nearest six and keep every underlay/pulse. Reduced motion may replace traveling ticks with three discrete inward steps, but may not remove the beat.
- **Missing art/hand:** use the implement bracket plus underlay. Never fall back to whole-body whitening.

This is the advocate contract in melee form: luminance, structure, motion direction, pose, and exact space all repeat the message (`docs/telegraph-panel/devils-advocate.md:42-54`; `docs/parry-panel/devils-advocate.md:121-131`).

## Integration contract

| Integration point | Required change | Authority preserved |
|---|---|---|
| `GameRoom.comboState` / `stepDuelists` | Capture target, post-lunge origin, and aim at each wind-up entry; plant until resolve; use the snapshot for lunge and sector (`packages/server/src/rooms/GameRoom.ts:372-387`, `packages/server/src/rooms/GameRoom.ts:3334-3485`). | Same `range`, `halfArc`, damage, hit order, and 20 Hz state machine; only target commitment changes. |
| `EnemyState` | Append committed geometry scalars and `meleeTellStep` beside `windup`, then bump schema version (`packages/shared/src/state.ts:138-160`; `packages/shared/src/constants.ts:8-13`). | Geometry/pose selection only; `windup` remains the only timing field. |
| `ArenaScene.syncEnemies` | Keep existing weapon equip, but make `atkSeq` call release/contact from the loaded pose instead of `triggerSwing` from idle (`packages/client/src/scenes/ArenaScene.ts:2762-2811`). | `atkSeq` remains a resolve confirmation. |
| `ArenaScene.animateEnemies` | Read/reconstruct `windup`, rank nearest six, set rig tell inputs, then animate; remove body disc/fixed ring and pre-lunge target guess (`packages/client/src/scenes/ArenaScene.ts:3056-3148`). | Direct synced phase; no AI prediction or local impact. |
| `SpriteRig` | Add wind-up/loaded-release inputs inside the existing style sampler; add weapon tint/rim/glint state with exact cleanup (`packages/client/src/entities/SpriteRig.ts:501-509`, `packages/client/src/entities/SpriteRig.ts:1093-1164`, `packages/client/src/entities/SpriteRig.ts:2091-2265`). | Existing weapon images, pivots, hands, and pose vocabulary; no new render assets. |
| Enemy footprint renderer | Route committed sector geometry through `buildTelegraphGeometry`/`drawTelegraph`; delete the standalone cone stroke (`packages/client/src/scenes/ArenaScene.ts:340-396`, `packages/client/src/scenes/ArenaScene.ts:3151-3220`, `packages/client/src/scenes/ArenaScene.ts:3366-3458`). | Same mathematical sector, now at the true post-lunge origin and belt-projected through one path. |
| Parry response | Preserve server i-frame check, chain resolution, `parriedSeq`, spark, sound, and hit-stop (`packages/server/src/rooms/GameRoom.ts:3479-3486`, `packages/server/src/rooms/GameRoom.ts:3504-3561`; `packages/client/src/scenes/ArenaScene.ts:5805-5829`). | Presentation never grants or denies a parry. |

## Ship gates

1. **Weapon-order capture:** for every listed archetype and combo beat, frame captures show the implement leave idle during wind-up, begin its incoming motion before resolve, cross aim on the `atkSeq`/falling-edge frame, and enter follow-through afterward. No body-centered white disc appears.
2. **Timing capture:** run 0.30, 0.32, 0.34, 0.46, 0.52, 0.50, and 0.72 s beats. The glint occurs at `R=.28 s` or immediately on first late observation; a press on that crest remains inside the base 0.52 s i-frame window at impact.
3. **Network capture:** under 0/50/100/150 ms artificial delivery, first observation samples current `windup`, rising motion never exceeds the one-tick/clamp rule, falling values cancel immediately, and `atkSeq` never restarts the whole swing.
4. **Geometry truth:** overlay the server's committed post-lunge origin, aim, `range`, and `halfArc` against the rendered sector in top-down and belt modes. Player centers just inside/outside each edge must agree with `inMeleeArc`; no build may label a pre-latch horde envelope exact.
5. **Range-read test:** after one training exposure, players identify short/medium/heavy reach and forward angular coverage from the thin outer arc at least 9/10 times without seeing a filled cone.
6. **Crowd test:** with 30 simultaneous melee wind-ups, exactly six ordinary attackers plus any reserved boss receive full source tells, selection does not churn, and every remaining attack retains its full underlay and timing fill.
7. **Accessibility test:** in grayscale, on pale and busy floors, at minimum zoom, with particles/bloom disabled, players still distinguish parryable inward/double-edge rhythm from dodge-only outward/broken rhythm and time the impact.
8. **No-new-art test:** every weapon tell reuses its held image, rig transforms, tint/outline/glow, and at most three installed painted particles. Handless coverage uses the procedural bracket and exact underlay.
9. **Cancellation test:** death, lost state, and chain stagger clear pose, glint, echo, particles, and edge without contact flash; a real resolve produces exactly one contact/follow-through and one server-owned verdict.

The intended final read is simple: **the enemy commits; the weapon draws and goes white-hot; the true range arc counts down; the blade is already coming when the player parries; impact and server verdict happen together.**
