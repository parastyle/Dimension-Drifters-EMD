# Satisfying XP — senior game-feel design

## Ruling

Ship **real, server-authoritative XP Motes**. A paid kill creates a bounded XP Echo at the corpse, the Echo rests on the field, an eligible drifter crossing their Mote Reach latches it, and the server grants the Echo's value to the whole squad on the tick the visible flight reaches that drifter.

Do not keep the current instant grant and fly a decorative receipt afterward. That would make the bar, level, stat allocation, and level window change before the object apparently carrying them arrives. It also cannot support a real pickup-radius stat. The game's own audit treats a visible action separated from its authoritative consequence as a root game-feel failure and calls moving slash-versus-hitbox disagreement a WYSIWYG defect (`docs/GAMEFEEL_AUDIT.md:9-12`, `docs/GAMEFEEL_AUDIT.md:93-96`).

This is an economy decision, not merely VFX polish. The cost is justified by the brief: **position affects when XP arrives, Mote Reach becomes build space, and the catch is literally causal**. Keep today's co-op generosity: one physical collector, one squad reward, no division by player count and no final-blow ownership.

The unit of replication is an **XP Echo**, not one XP point. One Echo may display one orb and a few satellite motes, and may contain the summed value of many kills. “A hundred motes” must mean a rich visible stream, never 100 schema rows moving at 20 Hz or 100 simultaneous pings.

## What the game does today

- There is no XP pickup phase. The common death primitive returns a dead enemy's authored `xpValue`, multiplied by four for a tough, and its callers delete the killed enemies and call `grantXp()` immediately (`packages/server/src/rooms/GameRoom.ts:3120-3124`, `packages/server/src/rooms/GameRoom.ts:3133-3138`, `packages/server/src/rooms/GameRoom.ts:3176-3178`, `packages/shared/src/constants.ts:375-380`). Swept melee demonstrates the delete-then-grant sequence directly; chain lightning, explosions, Emberguard waves, and friendly projectiles have parallel direct-grant paths (`packages/server/src/rooms/GameRoom.ts:2381-2468`, `packages/server/src/rooms/GameRoom.ts:2304-2318`, `packages/server/src/rooms/GameRoom.ts:3252-3290`, `packages/server/src/rooms/GameRoom.ts:3828-3853`).
- `grantXp()` gives the full amount to every player row without a killer or alive check. `levelUpPlayer()` immediately adds XP, carries threshold overflow, applies two automatic attributes, opens a flex choice, can open a signature choice, and updates the next threshold (`packages/server/src/rooms/GameRoom.ts:2465-2469`, `packages/server/src/rooms/progression.ts:33-53`). Thus downed players currently receive squad XP too.
- `PlayerState` synchronizes `level`, `xp`, and `xpToNext` for the HUD (`packages/shared/src/state.ts:43-48`). The client eases the cyan bar upward from that state and snaps it on a level wrap (`packages/client/src/scenes/ArenaScene.ts:6510-6519`); the bar itself is a four-pixel cyan fill (`packages/client/src/scenes/ArenaScene.ts:1540-1551`).
- `PickupState` is specifically a weapon/loot row: position, public/server weapon identity, rarity, affix, known state, and coarse weapon class. It has no generic kind, value, target, or movement phase (`packages/shared/src/state.ts:208-231`). The server consumes those rows through an explicit `grabWeapon` message within a fixed 46 px radius, and the simulation comments explicitly say weapon pickups are R-key grabs rather than walk-over pickups (`packages/server/src/rooms/GameRoom.ts:850-907`, `packages/shared/src/constants.ts:281-285`, `packages/server/src/rooms/GameRoom.ts:1883-1888`). XP must therefore use a separate state type and interaction contract.
- The only synchronized pickup collection is `ArenaState.pickups: MapSchema<PickupState>`; there is no XP entity map (`packages/shared/src/state.ts:256-265`). Appending one changes the schema and requires a handshake-version bump (`packages/shared/src/constants.ts:8-13`).
- The client knows a good visible death origin because it retains the rig until the authoritative enemy row vanishes, then plays poof, death audio, weapon-kill FX, and the paper death from that rendered position (`packages/client/src/scenes/ArenaScene.ts:2867-2915`). Disappearance alone is not an XP authority signal: the same path handles muted bulk removals and pit falls, while terrain kills intentionally pay no XP (`packages/client/src/scenes/ArenaScene.ts:2881-2895`, `packages/server/src/rooms/GameRoom.ts:2119-2130`, `packages/server/src/rooms/GameRoom.test.ts:731-753`).
- There is no synchronized final-blow owner. Current corpse direction and semantic kill FX approximate the killer as the nearest living player (`packages/client/src/scenes/ArenaScene.ts:2896-2915`). XP should communicate “this drifter collected for the squad,” not “this drifter landed the kill.”
- The current test proves only that a killed enemy disappears and XP/level advances after several ticks; there is no intervening collection assertion (`packages/server/src/rooms/GameRoom.test.ts:499-518`).

## The player-facing contract

The complete reward sentence is:

> **Kill → pop → settle → reach → hook → spiral → catch → bar.**

1. **Pop.** On a paid death, painted motes burst 18–68 px from the exact corpse point. Scale overshoots and a tiny vertical lift make the reward separate from the death poof.
2. **Settle.** The pieces recoil toward one bright, stable Echo center for 150–270 ms. The Echo cannot latch during this minimum read window; every kill gets time to say “reward dropped.”
3. **Rest.** The Echo bobs gently and remains indefinitely during live combat. It neither fades out nor globally vacuums itself, so route choice and Mote Reach remain real.
4. **Reach.** When an eligible drifter enters the authoritative radius, the Echo gives a 50 ms inward squash and halo flare. That is the visible edge at which the reward becomes guaranteed.
5. **Magnetize.** It leaves with a lateral hook, then covers most of its distance in the back half of the trip. It targets the visible paper-doll chest, not the HUD.
6. **Spiral.** The final third curls roughly 126° around the chest and collapses inward. This is a hook-and-catch, not a full orbit that delays the reward.
7. **Catch.** On one authoritative tick, the orb touches the rig, the squad receives the value, the rig halo pops, the audio stream advances in pitch, the XP bar flashes, and any level-up begins. This simultaneity is non-negotiable.

The genre lesson is phase contrast, not imitation: Vampire Survivors supplies the readable ground reward and range build; Brotato supplies bounded piles plus cleanup vacuum; Hades supplies the deliberate anticipation/receipt beat. Dimension Drifters' version is faster, curved, squad-owned, and visually made from its painted drift-energy library.

## Authoritative Echo contract

Add a dedicated synchronized row, conceptually:

```ts
XpEchoState {
  id: string
  x: number                 // resting/launch origin
  y: number
  value: uint32             // whole XP represented by this Echo
  seed: uint16              // frame, scatter, hook side
  bornTick: uint32
  collectorId: string       // empty while resting
  launchTick: uint32        // may be future while queued
  collectTick: uint32       // award epoch
  delivered: boolean        // one-tick receipt latch before deletion
}
```

Append `xpEchoes: MapSchema<XpEchoState>` to `ArenaState`; do not overload the weapon pickup map. The room already has a tick-locked 20 Hz fixed step and broadcasts after completed simulation work (`packages/shared/src/constants.ts:15-18`, `packages/server/src/rooms/GameRoom.ts:1653-1674`). The row therefore needs only resting state plus immutable launch/arrival ticks—never per-tick synchronized flight coordinates.

Follow the architectural lesson of `SwingDescriptor`: one immutable descriptor stores the effective pose, active, and impact epochs, and pure helpers interpret elapsed time (`packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`, `packages/shared/src/melee.ts:740-761`). Add a smaller shared `XpFlightDescriptor`/sampler derived from launch distance, seed, `launchTick`, and `collectTick`. Do not reuse the melee type; reuse its single-clock doctrine.

At a paid death, `damageEnemy()` should call `dropXp(enemy.x, enemy.y, value)` inside its common death branch instead of returning XP for later aggregation. That is the only current seam shared by edge, chain, blast, projectile, and wave damage, and it already excludes surviving enemies and resettable dummies before performing boss/drop bookkeeping (`packages/server/src/rooms/GameRoom.ts:3120-3178`). Remove the later direct `grantXp()` accumulators from every caller. Terrain removal stays outside this seam and therefore creates no Echo.

The server evaluates resting Echoes after player movement and before level-window ticking. A latch writes one collector and both epochs. At `collectTick`, exactly once:

1. call the existing squad-wide `grantXp(value)`;
2. set `delivered=true` and keep the row for one patch so every client observes the catch state and the new XP together;
3. delete the row on the following simulation tick.

This one-tick receipt latch avoids treating row deletion as the only event. The client does not have to guess whether disappearance meant collection, teardown, or correction.

### Mote Reach

Start with:

```text
BASE_MOTE_REACH = 180 px
effectiveReach = clamp((180 + flatReach) × (1 + reachPct), 120, 600)
```

The baseline is 7.5 player radii because the player body radius is 24 px (`packages/shared/src/constants.ts:214-215`). It is far enough to show a real flight, but well short of the 720 px enemy spawn ring (`packages/shared/src/constants.ts:257-263`).

Expose **Mote Reach** as a real derived stat. A simple first hook is `+18% Mote Reach` per stack; rarer hooks may add flat reach or shorten the settle window, but must never multiply XP value. The character sheet and upgrade card show the exact before/after radius in pixels. Hovering or acquiring the stat draws its exact world-space radius for 1.2 seconds; in belt mode that circle must use the same depth projection as the world rather than appearing as an unprojected screen circle.

Mote Reach decides eligibility only. Once latched, leaving the radius cannot uncollect the Echo. This prevents zig-zagging at the edge, network correction theft, and “almost arrived but snapped back” frustration.

### Eligible collector and co-op rules

- **Value is never split.** One Echo worth 12 grants 12 to every current player row, exactly preserving the existing full-squad grant (`packages/server/src/rooms/GameRoom.ts:2465-2469`). Two players do not receive 6 each, and the collector does not receive a bonus share.
- **One physical collector.** Every client renders the same Echo flying to the same `collectorId`; never clone a gameplay Echo toward each local camera.
- **Eligibility:** alive, connected, and not already in the invincible level-choice window. The existing window predicate is `flexPending > 0 || sigPending > 0`, and it currently freezes movement (`packages/server/src/rooms/GameRoom.ts:1620-1623`, `packages/server/src/rooms/GameRoom.ts:1711-1724`). Excluding it from new latches prevents risk-free vacuuming while the player is frozen. A player entering the window after a latch still receives the catch.
- **Winner:** nearest absolute world distance among eligible players whose own effective Reach contains the Echo; exact ties resolve by stable session id. Do not compare normalized `distance / reach`, which would make a large-radius build steal the visible catch from a teammate standing on the mote. Since value is shared, ownership is presentation and route credit, not economic competition.
- **Downed players:** do not attract new Echoes, but continue receiving the squad award because that is current behavior. If a collector is downed after latch, the already-guaranteed flight finishes at the downed body.
- **Disconnect:** recompute the current shared flight point, make it the new origin, then retarget the nearest eligible player with a fresh 160–260 ms descriptor. If nobody is eligible, return the Echo to rest. Never delete unpaid value.
- **Late join:** a player present on the catch tick receives the full award because `grantXp()` iterates the then-current roster. The current join path creates a fresh `PlayerState` and does not copy the squad's earlier level/XP (`packages/server/src/rooms/GameRoom.ts:1530-1569`); catch-up progression is a separate co-op policy and should not be silently invented inside Mote collection.

### Encounter cleanup

Normal combat has no TTL and no whole-screen vacuum. Cleanup vacuum is reserved for an actual closed beat: a belt room clear, a boss clear/portal opening, or a committed rift/extraction transition. Freeze new enemy pressure first, then:

- latch all resting Echoes value-descending;
- admit up to six flights per tick instead of the combat limit;
- compress travel to 220–360 ms without deleting the pop/spiral language;
- hold the transition for at most 650 ms, then fold any remaining value into one final visible core and catch it before world teardown.

Never clear unpaid Echoes on restart, training toggle, descent, extraction, victory, or defeat without an explicit rule. Current transient cleanup already centralizes projectile, swing, pickup-grace, and other run-owned state, while fresh-run paths clear weapon pickups and progression (`packages/server/src/rooms/GameRoom.ts:1018-1039`, `packages/server/src/rooms/GameRoom.ts:1340-1379`). Echo cleanup/flush must be added to those same lifecycle decisions.

If every current player is at the level cap, paid deaths create no Echoes; `levelUpPlayer()` already ignores awards at cap (`packages/server/src/rooms/progression.ts:33-36`). Do not show a collectible that can produce no receipt.

## Motion specification

All visual phase values come from the authoritative ticks plus `seed`; no Phaser Tween owns the flight.

### Birth pop and settle

Let `a` be age from `bornTick` and `s` a deterministic unit direction from `seed`.

- **Outward, 0–110 ms:** `r = R × (1 - (1-u)^3)`, where `u=a/110ms`. Apply `position = center + s×r`, plus a screen-up lift `-H×4u(1-u)`. Scale runs `0.45 → 1.18` by 65 ms.
- **Settle, 110–260 ms:** return toward the authoritative center with `r = R × (1-v)^2 × cos(1.25πv)`, `v=(a-110)/150`. Scale eases `1.18 → 1.0`. Satellites retain only their small tier orbit.
- **Arm:** ordinary Echoes become eligible at 260 ms. Add 40 ms per value tier, capped at 380 ms, so a boss core gets a slightly longer “look what dropped” beat.
- **Rest:** center bob `y = 2.5×sin(2π×1.7Hz×time + phase)`, scale `1 ± 0.035`, halo alpha `0.18–0.28`. Seed phases prevent a field from breathing in lockstep.

The main painted body finishes settle at the synchronized `x,y`; satellites orbit within 6–14 px. Therefore the visible center and the server's Reach test agree before the Echo can latch.

### Magnet flight

Travel time is distance-sensitive and tick-quantized:

```text
flightSeconds = clamp(0.22 + distance / 1500, 0.24, 0.52)
collectTick = launchTick + ceil(flightSeconds × 20)
```

Let `P0` be the fixed Echo origin, `T` the collector rig's current rendered chest socket, `d=|T-P0|`, `f` the unit direction to `T`, `n` its perpendicular, and `sign` be ±1 from the seed. Cache `C1` at launch; allow `C2` and `T` to follow the rendered collector:

```text
C1 = P0 - f × min(16, 0.06d) + sign × n × min(72, 0.24d)
C2 = T  - f × min(84, 0.30d) - sign × n × min(28, 0.08d)
t  = clamp((renderTick - launchTick) / (collectTick - launchTick), 0, 1)
q  = t^2.2
B  = cubicBezier(P0, C1, C2, T, q)
w  = smoothstep((t - 0.68) / 0.32)
P  = T + rotate(B - T, sign × 0.70π × w)
```

`q=t^2.2` puts only about 22% of the path in the first half and 78% in the second: readable turn, then decisive acceleration. Rotating the shrinking final vector produces the short arrival spiral without adding a separate orbit timer.

Aim the sprite along the sampled tangent. As normalized speed rises, stretch along travel to `1.28×` and compress across it to `0.84×`; never scale the painted body into a laser-thin line. Draw two fading trail segments in one shared additive `Graphics` layer. Trail length is `clamp(speed×0.035, 8, tierMax)` and must not imply a damaging beam.

The target is a small catch socket at the visible paper-doll chest, derived from `SpriteRig.root`, rather than raw server coordinates. The rig root is already the container driven by synchronized/rendered position and exposes its world x/y (`packages/client/src/entities/SpriteRig.ts:433-445`, `packages/client/src/entities/SpriteRig.ts:719-733`, `packages/client/src/entities/SpriteRig.ts:1437-1443`). Add a stable `getRewardCatchPoint()` so XP does not duplicate private body-layout assumptions.

XP motion continues during client hit-stop. The scene keeps sync, input, and HUD work running while the normal rig animation block is frozen (`packages/client/src/scenes/ArenaScene.ts:2744-2750`, `packages/client/src/scenes/ArenaScene.ts:2767-2790`). A server-timed catch cannot wait for a local cosmetic freeze without separating arrival from the bar. The frozen drifter becomes a clean target while the reward streak moves into it.

### Receipt

At the first observed `delivered=true` patch:

- collapse the main sprite from `1.0 → 0.35` over the last 45 ms and hide it at the socket;
- punch one pooled cyan-white ring `12 → 34/46/60 px` over 120 ms, sized by tier;
- pulse one non-damage halo behind the collector's torso for 90 ms—do not call the rig's damage/crit `flash()` channel;
- brighten/thicken the XP fill for 120 ms without fighting its authoritative width assignment;
- aggregate a `+N XP` label per collector over a 200 ms window, and show it only when `N ≥ 5`;
- if the catch levels the local player, let the existing level-up edge and stinger dominate; the client already detects a rising level and plays `levelup` (`packages/client/src/scenes/ArenaScene.ts:5918-5923`).

No camera shake and no hit-stop. Collection is a clean pull-and-click reward, not a collision impact.

## Painted visual language

Use a universal XP identity:

- persistent body: whitelisted jewel/star frames from `ptcl:arcane-mote`;
- large body: `ptcl:arcane-orb`;
- procedural accent: the same cyan as the XP bar, with a white catch core.

The generated manifest provides `arcane-mote` and `arcane-orb` as 96 px equal-cell sheets with ten painted frames each, and it exposes corresponding mote/orb families across blood, fire, frost, holy, nature, sand, shock, steel, toxic, void, and water (`packages/client/src/vfx/particle-manifest.ts:1-20`, `packages/client/src/vfx/particle-manifest.ts:26-44`, `packages/client/src/vfx/particle-manifest.ts:50-68`, `packages/client/src/vfx/particle-manifest.ts:74-100`). The complete catalog is 12 element families × 8 shapes = 96 packs (`packages/client/src/vfx/particle-manifest.ts:9-107`). All are already queued as `ptcl:<id>` spritesheets (`packages/client/src/vfx/particles.ts:9-13`). No new render is needed.

Do not color XP by killing weapon, presumed killer, or dimension in version one. The protocol cannot prove the final-blow weapon, and multicolor elemental rewards become hostile-projectile soup. The unused element mote/orb families remain future skins or augment accents; the authoritative body stays arcane/cyan so it is learned once.

### Value tiers

| Echo value | Read | Painted body | Desired pieces | Display diameter | Pop radius | Catch treatment |
|---:|---|---|---:|---:|---:|---|
| 1 | chip | arcane-mote jewel/star | 1 | 12 px | 18–28 px | 34 px ring, light tick |
| 2–4 | mote | brighter arcane-mote | 1 + 1 satellite | 15 px | 22–36 px | 34 px ring |
| 5–15 | orb | arcane-orb + mote | 2 | 20 px | 28–44 px | 46 px ring, `+N` eligible |
| 16–35 | core | arcane-orb + 2 motes | 3 | 28 px | 36–54 px | 46 px double pulse, weighted ping |
| 36+ | crown | arcane-orb + 3 motes | 4 | 36 px | 44–68 px | 60 px ring, low bloom, forced cleanup priority |

Value controls a coarse tier and logarithmic sound weight; it never creates one image per XP. The roster spans 1–3 XP trash, roughly 9–13 XP specials, 38–110 XP bosses, and a ×4 tough multiplier, so these bands create meaningful silhouettes without a bespoke enemy table (`packages/shared/src/enemies.ts:145-185`, `packages/shared/src/enemies.ts:197-205`, `packages/shared/src/enemies.ts:348-369`, `packages/shared/src/enemies.ts:376-385`, `packages/shared/src/constants.ts:375-380`).

Do not use `particleBurst()` for persistent or homing pieces. It randomizes a one-shot outward fling, creates one image and one tween per particle, fades it, and destroys it (`packages/client/src/vfx/particles.ts:37-74`). Build a fixed `XpEchoRenderer` pool that chooses deterministic frames and samples the shared phases without per-Echo tweens, timers, closures, or temporary vectors.

Do not spend component packs on routine XP. `lightning-ball` and `storm-call` are among twelve combat-scale packs, and the composer already caps full pack starts to ten per frame (`packages/client/src/vfx/fx-composer.ts:17-30`, `packages/client/src/vfx/fx-composer.ts:183-204`, `packages/client/src/vfx/fx-composer.ts:238-255`). Their weather/attack semantics belong to the weapons and bosses that caused the kill.

Do not use the eight impact flipbooks for catch receipts. They are six-frame, 256 px additive body-impact strips for fire, frost, shock, void, holy, toxic, arcane, and steel (`packages/client/src/scenes/arena/vfx.ts:21-35`, `packages/client/src/scenes/arena/vfx.ts:359-424`). A small pooled procedural ring is clearer and cheaper.

## Fifty-Mote stream law

The stream needs cadence, not simultaneity.

- A collector may launch at most **two Echoes per server tick**; the room may launch at most **three total per tick** during combat. Candidates beyond that are visibly “tugged” 4 px toward their chosen player while they wait.
- Reserve no more than two receipts for the same collector on one tick. If flight-duration rounding would overbook it, extend the later `collectTick` by one tick. Never shorten a flight to solve a slot collision.
- Alternate hook signs and three curvature amplitudes from seed. Consecutive motes form a braided left/right/center ribbon instead of tracing one opaque line.
- Fifty eligible Echoes drain in roughly 0.85–1.25 seconds before travel tail, depending on one versus multiple collectors. That is long enough to read as a reward stream and short enough not to feel like delayed accounting.
- Render every authoritative leader, but only the nearest eight local/on-camera flights get two trail segments; the next eight get one; all others get leader-only motion. Arrival timing, value, and catch ring never degrade.
- Catch rings, XP labels, HUD pulse, and audio aggregate by collector per receipt tick. Fifty bodies may arrive, but feedback speaks in rhythmic packets.

## Pitch-rising collect audio

Add one procedural XP stream voice to `AudioBus`, where event throttling and the 24-voice cap already live (`packages/client/src/audio/AudioBus.ts:10-13`, `packages/client/src/audio/AudioBus.ts:34-41`, `packages/client/src/audio/AudioBus.ts:227-249`). Do not schedule a sound per visual piece.

For each client:

```text
audible bucket       = 70 ms
streak reset         = 320 ms without a receipt
pitch semitones      = min(12, 0.75 × bucketIndex)
fundamental          = 620 Hz × 2^(semitones/12)
gain                 = clamp(0.10 + 0.04 × log2(1 + bucketValue), 0.10, 0.24)
```

Use a 45–65 ms sine/triangle pluck with a 4 ms attack. A bucket worth 16+ adds one quiet 220 Hz, 90 ms bloom; it does not reset the rising melody. Multiple arrivals inside the bucket sum value and emit one note. Sixteen consecutive audible buckets climb one octave, then hold rather than becoming shrill.

The collector's local client plays the catch centered and full. Other clients hear it panned at the collector and about 6 dB lower while their own HUD still pulses, communicating “our XP, their catch.” Suppress ordinary collect plucks for 180 ms after the existing four-note level-up stinger begins; the stinger already owns the progression climax (`packages/client/src/audio/AudioBus.ts:283-293`, `packages/client/src/audio/AudioBus.ts:336-340`).

## The 100+ law

### Authoritative field

Set `MAX_XP_ECHOES = 48`.

1. Under 32 live Echoes, a paid kill gets its own Echo unless another resting Echo is within 64 px and was born within the last 200 ms; close simultaneous AoE kills combine naturally.
2. From 32–47, first merge into the nearest resting Echo within an 80 px spatial cell; create a new row only when no local merge exists.
3. At 48, merge new value into the nearest resting Echo. If every Echo is latched, add it to the earliest-arriving flight packet. Value is conserved even though overload removes a birth body.
4. Merge updates tier immediately but clamps diameter at the crown tier. Large numbers become brighter, not screen-sized.
5. Cleanup vacuum processes the same 48 bounded rows. There is never a 49th row and never a per-frame x/y schema update.

This adapts the useful part of Brotato's documented 50-field-material cap and overflow merge without importing its XP/gold economy (`docs/BROTATO_PARITY.md:94-98`). It also stays below the current synchronized enemy cap of 80 (`packages/shared/src/constants.ts:259-263`).

### Client pool and degradation

Preallocate **48 leader images, 96 satellite images, 16 catch rings/halos, and one shared trail `Graphics` object**. Reuse fixed numeric slots; no warm-state spawn/destroy. Apply a global satellite budget:

- 0–24 visible Echoes: full tier treatment;
- 25–40: remove satellites from 1–4 value Echoes;
- 41–48: reserve satellites for the 16 highest values and disable idle rotation on the rest;
- off-camera resting Echoes keep one leader only;
- reduced motion keeps one leader per Echo and no trail segments.

Every authoritative collectible retains a visible leader. Degradation removes garnish, never the object whose Reach test can fire. Existing combat presentation already budgets full hit stacks, labels, paper deaths, and pickup exits instead of assuming unlimited horde headroom (`packages/client/src/scenes/ArenaScene.ts:151-158`).

At 100, 250, or 1,000 XP-source stress, assert:

- at most 48 synchronized Echo rows;
- exact summed value before and after all catches;
- at most 144 persistent painted images and 16 receipt objects;
- no per-Echo Tween, timer, closure, array, or vector allocation after pool creation;
- no more than one audio dispatch per 70 ms bucket;
- no component-pack or impact-flipbook calls from routine XP;
- p95 Echo render/update below 0.25 ms on the desktop baseline;
- no retained object growth after 10,000 spawn/merge/catch cycles.

## Accessibility and camera cases

The scene already queries `prefers-reduced-motion` and uses it to remove pickup flourishes and over-budget exits (`packages/client/src/scenes/ArenaScene.ts:198-203`, `packages/client/src/scenes/ArenaScene.ts:1681-1683`, `packages/client/src/scenes/ArenaScene.ts:1911-1925`). Under reduced motion:

- birth scatter is at most 6 px;
- the Echo rests normally;
- flight is a straight 160–220 ms glide staged at the end of the unchanged authoritative duration;
- there is no rotation stretch, arrival spiral, or trail;
- one catch ring, one batched sound, and the same catch tick remain.

Off-screen Echoes still exist and collect authoritatively. When an off-screen Echo latches to the local player, begin its visible flight at the camera edge along the true bearing rather than drawing a streak across the whole 4,800 px world. A remote-to-remote off-screen flight may be leaderless, but its panned batched receipt and squad HUD pulse remain. Camera cuts, teleports, and spectate changes never alter `collectTick`; clamp to the new target socket on receipt.

## Tuning locks and acceptance

Expose only these first-pass knobs: base Reach, value-tier thresholds, pop radius, arm delay, flight duration slope/cap, Bézier lateral magnitude, spiral angle, launch/receipt admissions, audio bucket/reset, and HUD pulse strength. Do not add per-enemy or per-element tuning.

The feature is accepted only when all of the following are literal:

1. A paid kill outside Reach creates or feeds a visible Echo and changes no player's XP.
2. Dummies, terrain deaths, muted teardown, and zero-XP enemies create no Echo.
3. A tough contributes exactly authored XP ×4; merging never changes total value.
4. Crossing Reach chooses one collector deterministically and makes the reward guaranteed.
5. Before `collectTick`, XP, level, attributes, flex state, and signature state are unchanged.
6. On `collectTick`, visible chest contact, squad grant, HUD pulse, catch ring, and audio bucket share one patch/frame.
7. The full value reaches every current player, including downed players, and is never divided by party size.
8. A disconnect retargets or rests without duplicating or losing value.
9. Fifty pickups form a rising, braided stream rather than one burst; 100+ sources obey the 48-Echo cap and preserve exact XP.
10. Cleanup vacuum completes before the room clears its Echo state or progression presentation.
11. Reduced motion changes flourish only, never authority, value, Reach, or catch time.
12. No new rendered art is required: the shipped painted arcane mote/orb sheets plus procedural trails, halos, rings, and procedural audio complete the feature.

The emotional target is simple: the kill produces treasure, movement claims it, the treasure visibly **turns and accelerates**, and the player hears the whole stream climbing into them. The bar moves because the orb arrived—not a frame before.
