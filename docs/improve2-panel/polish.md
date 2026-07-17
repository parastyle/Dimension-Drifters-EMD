# Improve2 panel — game-feel / polish audit

**Scope:** current gameplay and presentation code after the July 16 systems pass. Findings are ordered by felt severity and leverage, not by file. **S** is a focused edit, **M** crosses a few owners or needs tuning, and **L** needs a protocol/state seam or a broad content pass.

## Prior-audit boundary

I read `IMPROVEMENT_AUDIT.md`, `POLISH_AUDIT.md`, `GAMEFEEL_AUDIT.md`, `VFX_HITBOX_AUDIT.md`, and `BACKLOG.md` before tracing the current source. I have intentionally not repeated their already-covered generic hit-stop, basic parry feedback, low-HP vignette/heartbeat, death/respawn ceremony, end cards, generic damage-number budgeting, reload/dry-fire, footsteps, weapon lazy-load pop, or old “remote attacks do not animate” findings.

Two findings below resemble older topics only because today's code creates a new interaction:

- The new accepted attack beat now animates remote bodies, but stops before the new authored source VFX and sound.
- Earlier hit-stop work froze rig updates, but today's tween-driven painted ribbons/composer packs and wall-clock tome/combo layers have reopened a split-clock problem.

## P0 — feel-breaking or highest-leverage

### 1. Hit-stop now freezes the actor while today's authored effects keep spending wall time

**Evidence / owner:** `ArenaScene.update()` gates interpolation, rig animation, worm interpolation, and projectile movement behind `frozenUntil`, but continues beams, XP, combat FX, HUD, and all Phaser managers (`packages/client/src/scenes/ArenaScene.ts:2861-2905`). The melee rig samples `scene.time.now` for tome and combo state and for swing phase (`packages/client/src/entities/SpriteRig.ts:3446-3462`, `:3473-3478`, `:3818-3823`). Painted-edge ribbons run on a Phaser counter tween (`packages/client/src/vfx/VfxPlayer.ts:456-504`), while composed impact pieces use ordinary tweens and tween chains (`packages/client/src/vfx/fx-composer.ts:257-379`).

**10-second player impact:** On the first crit, parry, or connected quake, the character holds but the ribbon, page state, shrapnel, and another player's beam continue. The supposedly weighty freeze looks like the actor lagged behind its effects; on release the rig may jump to a later swing/page phase.

**One notch better:** Establish one freeze-aware presentation clock. Drive rig, tome, combo, ribbon, and authored impact timelines from it, while explicitly whitelisting server-timed geometry such as XP receipts. If global tween pause is too broad, give combat-action tweens a named timeline and pause only that timeline. Preserve authoritative danger by freezing presentation, not simulation.

**Effort:** M

### 2. Big-sword combo identity is indexed by the player's global attack count, not the current combo

**Evidence / owner:** `comboStepForAttackSeq()` maps the global accepted attack count directly through sequence length (`packages/shared/src/melee.ts:1097-1104`), and the helper explicitly says idle and weapon swap do not reset it (`:1135-1148`). `SpriteRig.equipWeapon()` resets its local combo (`packages/client/src/entities/SpriteRig.ts:1765-1774`), but `triggerSwing()` gives the synced attack beat precedence over the local “continues” check (`:1864-1878`).

**10-second player impact:** Swap from a gun or another melee weapon, wait, then swing a greatsword: its first visible move can be step 2, step 3, or the family finisher. The four new family identities never reliably introduce themselves with their opener, and a finisher can appear without buildup.

**One notch better:** Sync or predict a small combo epoch plus step scoped to `(weapon, combo family)`. Reset it on weapon change and after the authored grace window; always make the first attack of a fresh epoch step 0. Keep the global attack sequence only as event ordering/deduplication.

**Effort:** M

### 3. The beam renderer silently supports four simultaneous channels in a ten-player game

**Evidence / owner:** The session ceiling is ten (`packages/shared/src/constants.ts:266-267`), but `BeamRenderer` preallocates exactly four entries (`packages/client/src/vfx/BeamRenderer.ts:96-124`). `update()` requests one entry per observed owner (`:149-163`), and `acquire()` simply returns `undefined` when all four are occupied (`:191-203`).

**10-second player impact:** In a beam-heavy co-op build, the fifth teammate can be dealing authoritative swept damage with no beam on this client. It reads as invisible damage and destroys target ownership immediately.

**One notch better:** Size the retained pool to `MAX_PLAYERS`, or retain ten cheap procedural rows and allocate the more expensive painted ropes by camera/salience. Never drop the damaging capsule: the degraded path should at least draw its exact line and width.

**Effort:** S

### 4. Beam charge, ignition, sustain, release, and overheat have no sonic or camera lifecycle

**Evidence / owner:** Beam phase changes only arm short visual timers in `BeamRenderer.observePhase()` (`packages/client/src/vfx/BeamRenderer.ts:205-210`); ignition is a 70 ms white source circle and overheat is a small source ring (`:235-270`). `ArenaScene.updateBeams()` contains no audio, shake, or event edge (`packages/client/src/scenes/ArenaScene.ts:8513-8582`). `AudioBus.play()` has gun, hit, reward, hurt, and boss one-shots, but no beam events or loop owner (`packages/client/src/audio/AudioBus.ts:240-333`).

**10-second player impact:** Holding RMB on one of 23 new beam weapons produces a handsome line but no rising charge, accepted-ignition punch, sustain pressure, release tail, or overheat failure sound. The most mechanically distinctive delivery feels quieter and less physical than a basic revolver.

**One notch better:** Add an owner-scoped beam voice: predicted charge ramp, accepted ignition transient, looped sustain whose pitch/noise follows heat and contact, short release tail, and unmistakable overheat choke. Give local ignition one restrained camera kick and a terrain-level light pulse; remote beams use the same grammar at lower gain. Reconcile the predicted charge voice by `startSeq`, just as the visual is reconciled.

**Effort:** M

### 5. Beam heat and lockout are authoritative combat truth with no HUD or dock readout

**Evidence / owner:** The server retains heat across stow, applies recovery/lock, requires release after overheat, and syncs Cooling/Overheated rows (`packages/server/src/rooms/GameRoom.ts:2721-2745`, `:2911-3002`). The HUD only formats `charges/maxCharges` (`packages/client/src/scenes/ArenaScene.ts:7011-7044`), and the mirrored-L junction blanks its resource field whenever `maxCharges` is zero (`:7427-7457`). Neither reads the local beam row's `heat` or `phase`.

**10-second player impact:** A beam stops and refuses to restart even though the selected weapon shows no debt, venting, or lock. Early-cancel heat and stowed cooling are invisible, so a rules-correct rejection feels like dropped input.

**One notch better:** Put a compact heat arc in the active dock junction and a terse phase label (`CHARGE`, `VENT`, `LOCK`). Pulse the last 20% and drain it while stowed. The row already contains the needed phase and heat, so this can remain read-only client presentation.

**Effort:** S

### 6. XP Echo receipts reuse the loot-reveal arpeggio and can consume the flat voice cap

**Evidence / owner:** Every 70 ms XP receipt bucket calls `audio.play("loot")` and raises its `amt` (`packages/client/src/scenes/ArenaScene.ts:2936-2962`). `loot` is a three-note arpeggio (`packages/client/src/audio/AudioBus.ts:291-293`, `:336-340`). The bus has a flat 24-source cap with no priority or reserved skill voices (`:34-41`, `:160-165`), so repeated XP triads compete with parry, hurt, boss, and the actual loot reveal.

**10-second player impact:** The first dense kill wave produces a spray of miniature legendary-style arpeggios, then important cues can vanish because XP got there first. It also collapses two reward meanings: “a mote arrived” and “you equipped rare loot” sound identical.

**One notch better:** Give XP a monophonic `xpTick` owner that retunes one live oscillator or schedules one-note buckets. Let pitch and brightness climb across a 250–400 ms catch streak, end with a small cadence only for a meaningful batch, and reset cleanly. Add cue priority or reserved headroom so parry/hurt/boss events can pre-empt ambience and reward ticks.

**Effort:** M

### 7. Co-op hit and kill confirmation guesses the attacker by proximity

**Evidence / owner:** Per-hit spark direction, element, and flipbook are taken from the nearest rendered player and that player's currently equipped weapon (`packages/client/src/scenes/ArenaScene.ts:6606-6632`). On enemy removal, corpse launch direction and the new weapon-family kill pack use the nearest living player because no final-blow owner is serialized (`:3117-3136`).

**10-second player impact:** A distant beam, cast, projectile, or long-reach lunge can land a kill beside a teammate and produce that teammate's element, family kill effect, and corpse direction. Your kill feels stolen; their weapon appears to cause damage it never dealt. Today's long-range beams make this geometric approximation fail much more often.

**One notch better:** Emit a compact authoritative hit/kill receipt containing target id, source player, delivery/element, hit direction, damage, crit, and final-blow flag. It can be an expiring event ring rather than permanent entity state. Drive contact flash, damage-number style, kill sound, pack, hit-stop eligibility, and corpse impulse from that receipt.

**Effort:** L

### 8. The new synchronized attack beat completes the remote pose, but not the attack's signature

**Evidence / owner:** `routePlayerAttacks()` now calls `triggerAcceptedRigAttack()`, which resolves a descriptor and only invokes `rig.triggerSwing()` (`packages/client/src/scenes/ArenaScene.ts:2197-2207`). The owning input path separately schedules quake presentation, cast muzzle flash, authored slash/ribbon, and chain lightning (`:6115-6215`), and those calls are not made by the accepted remote path.

**10-second player impact:** A teammate finally lunges/swings on beat, but their painted edge, cursor quake, chain leap, cast source flash, and attack sound are absent to observers. Co-op reads like animated pantomime beside the owner's full spectacle, especially for today's iconic melee families.

**One notch better:** Turn accepted attacks into a single presentation event consumed by both prediction and observation. Include the accepted aim/epoch plus any cursor epicenter and authoritative secondary result needed by quake/chain. Deduplicate local prediction by attack sequence, then run the same source-VFX/audio dispatcher for every player with distance and salience scaling.

**Effort:** L

**Why this is new:** The previous VFX audit's NET-1 described an entirely absent remote attack footprint. Today's attack sequence fixes the body pose; this finding is the new half-parity seam exposed by that implementation, not a claim that remote attacks still do nothing.

## P1 — clearly felt, next-pass work

### 9. Sustained beams turn damage numbers and generic hit audio into a tick-rate curtain

**Evidence / owner:** Beam descriptors permit a 50–250 ms damage cadence (`packages/shared/src/combat.ts:71-74`), and the server flushes pending damage at that cadence (`packages/server/src/rooms/GameRoom.ts:3225-3231`). Every delivered enemy HP drop becomes a fresh label and generic hit sound in `updateCombatFx()` (`packages/client/src/scenes/ArenaScene.ts:6563-6605`). The existing per-frame caps prevent runaway allocation, but do not choreograph sustained contact over time.

**10-second player impact:** Sweep a wide beam through a pack and the targets repeatedly shed small numbers while the same hit thunk chatters. The beam reads like many tiny bullets, obscures silhouettes, and spends the feedback budget that should make its ignition, high heat, crit quantum, and kills distinct.

**One notch better:** Maintain a short-lived per-target beam accumulator. Update one anchored/rolling number every ~220–300 ms, use continuous contact hiss/sparks at a fixed global cadence, and reserve separate pops for crit quanta and kills. Keep ordinary projectile/melee number choreography unchanged.

**Effort:** M

### 10. A wide beam visibly hits a horde but secretly loses per-target power after three contacts

**Evidence / owner:** `beamStepDamage()` scales every target by `min(1, 3 / targetCount)` (`packages/shared/src/combat.ts:123-127`). `GameRoom.damageBeamSweep()` counts current contacts and applies that diluted step to each (`packages/server/src/rooms/GameRoom.ts:3217-3223`). No weapon copy, heat display, beam intensity, or hit feedback communicates the shared aggregate budget.

**10-second player impact:** The genre fantasy says “line up the crowd,” but the beam gets less effective per enemy exactly when it looks most dominant. Within one sweep, players can feel that the health bars barely move without understanding why.

**One notch better:** Keep the cap if it is required for balance, but expose it. Card copy can say “full power through 3 targets; damage is shared beyond,” while contact VFX thin or split after the third full-power lock. A stronger alternative is to cap aggregate damage without reducing already-acquired targets until the next contact quantum, avoiding flicker as bodies enter the width.

**Effort:** S for communication, M for behavior polish

### 11. Non-gun melee has impact audio but no source/whiff sound

**Evidence / owner:** Guns fire a predicted `shot:*` cue (`packages/client/src/scenes/ArenaScene.ts:6146-6172`). Cast and ordinary melee branches create visual source feedback but never call audio (`:6174-6215`). `WeaponDef` contains extensive delivery and visual metadata but no sound family or weight hook (`packages/shared/src/weapons.ts:43-214`), and `AudioBus` offers no swing/cast cases (`packages/client/src/audio/AudioBus.ts:249-333`).

**10-second player impact:** Miss once with a claw, dagger, greatsword, or staff: the full-body lunge and ribbon move in silence. On contact, every family converges on the same generic hit layer, so the new silhouette identities lack audible mass and timing.

**One notch better:** Add a small sonic taxonomy derived from family/weight plus element sweetener: close-blade air cut, claw cloth/metal rake, heavy two-hand displacement, blunt whoomph, and arcane source bloom. Fire the source cue on accepted attack even on whiff; keep material/target impact as a separate layer.

**Effort:** M

### 12. Open-tome page flips have no event seam for their signature sound

**Evidence / owner:** `SpriteRig.setAttackBeat()` coalesces and schedules page flips (`packages/client/src/entities/SpriteRig.ts:1562-1605`), and `startTomePage()` mutates retained page/scrap state internally (`:1623-1648`). There is no callback/event when a page actually begins, and `AudioBus` has no page/rustle event (`packages/client/src/audio/AudioBus.ts:249-333`).

**10-second player impact:** The new open-tome art visibly snaps and sheds paper, but it has no tactile paper cue. Because flips are intentionally rate-limited, each one is a rare readable beat; silence makes the channel look decorative rather than mechanically alive.

**One notch better:** Surface a `pageFlip(ownerId, x, seq, settle)` edge from `SpriteRig` or schedule it alongside the accepted beat. Use a short dry page flick for normal turns and a lower cover-close/rune-settle layer at channel end, spatialized and quieter for teammates.

**Effort:** S

### 13. HP increases have easing but no healing event feedback

**Evidence / owner:** The server applies continuous regen (`packages/server/src/rooms/GameRoom.ts:2439-2452`), Second Wind healing (`:4884-4889`), projectile-parry chain healing (`:5539-5545`), boss-rush healing (`:5781-5787`), and progression can immediately fill new CON headroom (`packages/server/src/rooms/progression.ts:18-24`). The client only branches on `self.hp < prevSelfHp` for hurt feedback (`packages/client/src/scenes/ArenaScene.ts:6664-6681`); HP rises merely move the eased bar (`:6967-6977`).

**10-second player impact:** Trigger Second Wind or survive into regen and the reward is nearly invisible unless the player watches the small number. A successful defensive build does not answer with the green/clean “I got life back” beat players expect.

**One notch better:** Detect thresholded HP rises and classify them by nearby event where possible. Add a restrained green-white fill sweep, `+N` only for discrete heals, a soft inhale/chime, and a brief rig/catch-ring accent. Do not tick audio for continuous regen; accumulate it and speak only after a meaningful recovered amount or a discrete parry heal.

**Effort:** S

### 14. Every boss entrance speaks the same generic slam, including Serraketh

**Evidence / owner:** The first observed boss uses one shake/flash path and always calls `audio.play("bossslam")` (`packages/client/src/scenes/ArenaScene.ts:4451-4463`). `AudioBus` owns one generic low boom recipe (`packages/client/src/audio/AudioBus.ts:306-310`), even though `BossController` exposes the boss definition/name and distinct encounter kind (`packages/server/src/rooms/BossController.ts:1439-1479`).

**10-second player impact:** The seam-eater, stationary eye, gunslinger, world titan, and blink assassin all enter with the same acoustic identity. Serraketh's first appearance therefore sounds like a reused AoE impact rather than a new boss category.

**One notch better:** Dispatch a `bossIntro` profile by boss definition/encounter: a short mix duck plus shared threat downbeat, then one identity layer (Serraketh subterranean scrape/metal stitch, eye electrical focus, gunslinger chamber spin, titan deck groan). Keep the existing boom as the shared grammar, not the whole stinger.

**Effort:** M

### 15. Serraketh's sever, regrow, burrow, eruption, and parry glint edges are visual-only

**Evidence / owner:** `WormRig.topologyEdge()` emits sever/regrowth particles and shake without an audio bridge (`packages/client/src/entities/WormRig.ts:670-710`). `updateAction()` handles dive, eruption, and glint action edges only through `WormBossVfx` (`:828-890`), and mode edges only emit dive dust (`:1005-1019`). `WormBossVfx` itself owns Graphics/particles/shake, not `AudioBus` (`packages/client/src/vfx/worm-boss-vfx.ts:24-55`).

**10-second player impact:** Cutting off an armored segment can be one of the run's most important successes, yet it produces no metal tear/bone-paper rip. Regrowth has no reverse-suck cue, dive has no traveling subterranean rumble, and the parry crest has no blade-ring ping. The rig looks much more finished than it sounds.

**One notch better:** Give `WormRig` a small action-edge callback into `ArenaScene`/`AudioBus`. Layer localized sever snap + debris tail, loop/follow a quiet burrow rumble, pre-rise it toward eruption, reverse the spectral layer on regrow, and use a crisp material-specific glint ping for parryable moves.

**Effort:** M

### 16. Serraketh's private shake gate can let a small sever suppress a major eruption

**Evidence / owner:** `WormBossVfx.localShake()` rejects every shake within 700 ms of the last admitted worm shake without comparing intensity (`packages/client/src/vfx/worm-boss-vfx.ts:309-322`). It then delegates to `ArenaScene.shakeCam()`, which already performs priority arbitration by intensity (`packages/client/src/scenes/ArenaScene.ts:6534-6546`). A sever asks for `0.006` while eruption asks for `0.017` (`packages/client/src/entities/WormRig.ts:686-693`, `:855-864`).

**10-second player impact:** Break a seam shortly before the worm erupts and the little seam shake can consume the 700 ms admission window; the much larger ground breach then lands without its camera punch.

**One notch better:** Remove the private cooldown and let the central priority budget arbitrate, or store `(until, intensity)` and always admit a stronger replacement. Keep distance falloff before arbitration.

**Effort:** S

### 17. The mirrored-L dock fades nicely, but selection teleports its neighborhood

**Evidence / owner:** `layoutCarouselDock()` hides all visible chips and sets the new chip positions/visibility immediately (`packages/client/src/scenes/ArenaScene.ts:7332-7360`). A selection change invalidates the layout and swaps junction art synchronously (`:7638-7648`); the new neighborhood is laid out immediately on the next signature (`:7697-7718`). The dock has entrance/fade tweens (`:7263-7307`) but no selection travel around the elbow.

**10-second player impact:** Tap Q/E and the active art plus four neighbors blink into a different arrangement instead of rotating through the L. The new dock communicates a physical carousel shape, but its most common interaction breaks that spatial metaphor.

**One notch better:** Animate old/new chip transforms along the bottom arm and around the elbow over ~110–150 ms, with a tiny junction stamp/click at commit. Preserve the truth field immediately, but let decorative neighbors travel or cross-cut as paper tabs.

**Effort:** M

### 18. Authored FX packs are admitted first-come, not by player relevance

**Evidence / owner:** `fx-composer` grants ten pack plays per render frame, increments immediately, and returns false once spent (`packages/client/src/vfx/fx-composer.ts:183-204`, `:238-253`). Kill packs, elemental explosions, and quake hero packs all share that same allowance through `packages/client/src/scenes/arena/vfx.ts:775-792` and `:936-937`.

**10-second player impact:** A horde clear can spend the frame's authored-pack budget on the first ten iteration-order deaths, causing a local hero quake or boss-adjacent explosion later that frame to fall back or vanish. The rare/high-intent action loses to routine off-center work.

**One notch better:** Queue pack intents until the end of the frame and score them: local-player source, boss/elite, on-camera, crit/kill, size, then distance. Always reserve one or two slots for local skill and boss resolution. Keep the procedural degraded path for rejected routine kills.

**Effort:** M

### 19. The marquee bloom layer is deliberately disabled on every DPR-scaled display

**Evidence / owner:** `VfxPlayer` only enables its shared glow filter when `RENDER_DPR === 1`; hi-DPI drops bloom because the current per-container framebuffer offsets under the zoomed camera (`packages/client/src/vfx/VfxPlayer.ts:247-273`). Painted ribbons and chain lightning are explicitly placed under this root (`:276-279`; `packages/client/src/scenes/ArenaScene.ts:8224-8231`).

**10-second player impact:** On a common 125–200% Windows display or retina-class panel, energy edges, sparks, and chain lightning look flatter than on the reference DPR-1 setup. Today's painted-edge ribbon pass therefore has platform-dependent punch from the first attack.

**One notch better:** Move glow to a camera/post pipeline that composes in camera space, or render the glow mask in a DPR-aware render texture and composite once. Validate alignment at DPR 1, 1.25, 1.5, and 2 before restoring it.

**Effort:** L

## P2 — polish and atmosphere

### 20. Muzzle and impact flashes do not cast even a fake light onto the newly grounded map

**Evidence / owner:** Gun muzzle flashes are high-depth additive Graphics that tween away (`packages/client/src/scenes/arena/vfx.ts:447-550`); bullet impacts likewise create top-layer additive circles/streaks (`:596-670`). They do not create a low-depth terrain spill or touch a shared light layer. Beam ignition is also only drawn at beam depth (`packages/client/src/vfx/BeamRenderer.ts:235-241`).

**10-second player impact:** The AO, skirts, and grounded lighting make the arena feel materially present, but the first bright muzzle/beam/impact appears pasted above it. Night/dark palettes expose the disconnect fastest.

**One notch better:** Add one budgeted ground-light pool: soft projected ellipses under muzzle, ignition, explosion, and heavy impact, 60–140 ms, element-tinted, below actors and above terrain. This is not full dynamic lighting; one reusable translucent spill is enough to make the map answer the weapon.

**Effort:** M

### 21. UI interactions have visual states but almost no coherent sound or eased press grammar

**Evidence / owner:** Menu cards snap directly to scale `1.04` on hover and back to `1` on exit, then launch silently into a fade (`packages/client/src/scenes/MenuScene.ts:289-301`, `:382-390`); audio settings buttons also only recolor (`:184-217`). The reworked level window eases focus visually but navigation is silent and confirmation reuses the world-pickup `grab` cue (`packages/client/src/scenes/ArenaScene.ts:4916-4955`). `AudioBus` has no hover, focus, confirm, back, or paper-stamp vocabulary (`packages/client/src/audio/AudioBus.ts:249-333`).

**10-second player impact:** Before combat even starts, hovering and selecting a dimension feels less tactile than picking up a weapon. In the level window, rich paper motion is paired with either silence or a generic pickup blip, weakening the parity rework's sense of occasion.

**One notch better:** Add a tiny UI bus/vocabulary: subdued focus tick or paper brush, low press, confirm stamp, back fold. Tween menu hover/press scale over ~70/45 ms with a short yoyo on click. Keep UI non-spatial and duck it under urgent combat cues.

**Effort:** S

### 22. Dimensions have visual atmosphere but no audio bed, so idle time is dead air

**Evidence / owner:** `AudioBus` exposes only event one-shots through `play()` and has no loop, crossfade, duck, or dimension-bed owner (`packages/client/src/audio/AudioBus.ts:27-41`, `:240-333`). `ArenaScene` updates visual ambient dust every frame (`packages/client/src/scenes/ArenaScene.ts:2898-2901`) and knows the active dimension for HUD/map construction, but never sets an ambient soundscape.

**10-second player impact:** Stand still after a wave and the game stops breathing. Commons, Cover, Scar, carrier deck, frost, void, and forge can look different while sounding like the same silent room between one-shots.

**One notch better:** Add a two- or three-layer procedural/loop bed keyed by dimension and zone: broad air/room tone, sparse distant identity one-shots, and a subtle hazard/Scar layer. Crossfade calm/combat density, duck it briefly for boss intro/parry/level-up, and keep the center channel quiet enough for positional combat cues.

**Effort:** M

## Recommended juice-pass order

1. Fix presentation clock coherence, combo epochs, beam pool size, and beam HUD truth.
2. Build the beam/XP/non-gun audio owners with priority-aware voice admission.
3. Add exact combat-source receipts, then use that seam to finish remote source-VFX parity and correct hit/kill choreography.
4. Wire Serraketh action foley and remove its duplicate non-priority shake gate.
5. Finish dock travel, hi-DPI glow, fake ground lighting, UI sound, and dimension ambience.

That order makes the next polish work land on truthful ownership and clocks instead of adding more effects to ambiguous events.
