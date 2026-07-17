# First-session experience critique

This is a fresh-player pass through the current coded flow: `MenuScene` → matchmaking/join → first minute → first level-up → first death → first boss. I screened `IMPROVEMENT_AUDIT.md`, `POLISH_AUDIT.md`, `GAMEFEEL_AUDIT.md`, `VFX_HITBOX_AUDIT.md`, and `BACKLOG.md` first. The list below deliberately excludes their already-reported issues unless a system added today creates a new regression or makes the old risk materially worse.

I also read the current implementations in `MenuScene.ts`, `ArenaScene.ts`, `SpriteRig.ts`, `melee.ts`, `combat.ts`, `weapons.ts`, `augments.ts`, `progression.ts`, `GameRoom.ts`, `BossController.ts`, `enemies.ts`, `AudioBus.ts`, and the beam, XP-mote, worm, telegraph, and general VFX paths.

Effort: **S** = copy/local presentation change; **M** = coordinated UI/state or renderer change; **L** = protocol/input architecture or broad content pass.

## Coded first-session trace

The current path is immediate: a card fades straight into `joinOrCreate`; `onJoin` creates a level-1 player with the Rusty Cleaver (`packages/server/src/rooms/GameRoom.ts:1716-1744`); the arena exposes the survival/boss countdown plus the mouse verbs (`packages/client/src/scenes/ArenaScene.ts:7063-7114`); kills produce squad-shared XP Echoes and the first six XP open the timed flex window (`packages/shared/src/state.ts:43-57`; `packages/server/src/rooms/progression.ts:33-51`); zero HP becomes a persistent downed body or squad defeat (`GameRoom.ts:2439-2472`); and `bossSpawnAt` ultimately hands control to the selected boss definition (`packages/shared/src/enemies.ts:720-727`; `packages/server/src/rooms/BossController.ts:1521-1560`). The findings follow the points where that sequence fails to explain itself or loses visual truth.

## P0 — feel-breaking or highest-leverage

### 1. The menu's chosen run is not a matchmaking contract — **M**

**Evidence:** The menu presents dimension and Boss Rush cards as direct launch choices (`packages/client/src/scenes/MenuScene.ts:129-159`, `:310-350`), but ordinary launches always call `joinOrCreate` with those values merely as options (`packages/client/src/scenes/ArenaScene.ts:2581-2608`). Only `GameRoom.onCreate` consumes `dimensionId`/`bossRush` (`packages/server/src/rooms/GameRoom.ts:633-661`); joining an existing room silently inherits its state. Connection feedback is an external DOM string containing only the session id (`ArenaScene.ts:2657`).

**10-second player consequence:** I click a dimension—or the explicitly different Boss Rush mode—and can materialize in somebody else's mode with no explanation. The first promise the game makes is visibly false, so every later oddity looks like another bug.

**Recommendation:** Put **Solo / Host / Quick Join / Join Code** ahead of the cards, or make card launches create a matching room and reserve `joinOrCreate` for an explicit Quick Join. On arrival, show a short in-canvas confirmation: mode, dimension, player count, and whether my requested choice was overridden.

### 2. Today's iconic melee combos still resolve as the legacy centered sweep — **L**

**Evidence:** Combo `direction` is explicitly cosmetic and combo path damage/range/knockback are dormant (`packages/shared/src/melee.ts:119-145`). `swingDescriptorFor` still creates the base style clock (`melee.ts:1053-1094`), the server registers only `aim0`, base `swingArc`, and one reach (`packages/server/src/rooms/GameRoom.ts:2511-2540`), then samples that centered blade sweep (`GameRoom.ts:3271-3411`). `SpriteRig.triggerSwing` enriches the client descriptor with authored combo motion while stating that gameplay remains the legacy sweep (`packages/client/src/entities/SpriteRig.ts:1844-1903`).

**10-second player consequence:** A Falling Gate, pommel bash, hook, scissor, or full-body lunge can visibly contact or miss a target while the invisible base arc decides the opposite. The new animation identity magnifies, rather than hides, hit-truth errors.

**Recommendation:** Promote the accepted combo family/step/path into the authoritative attack descriptor and make server hit sampling consume the same signed path, range multiplier, timing, and secondary strike that drives the rig and painted ribbon. Until then, constrain ribbons and body travel to the legacy swept band.

### 3. Five simultaneous beams make at least one authoritative attack invisible — **S**

**Evidence:** The game advertises 1–10 player co-op (`packages/client/src/scenes/MenuScene.ts:132-137`), but `BeamRenderer` allocates exactly four retained entries (`packages/client/src/vfx/BeamRenderer.ts:96-124`). `acquire` returns `undefined` once all four are occupied (`BeamRenderer.ts:191-203`), even though every player's beam is an independent synced `BeamState` (`packages/shared/src/state.ts:283-306`).

**10-second player consequence:** In a beam-heavy squad, a player can hold fire, slow down, spend heat, and deal damage while seeing no beam at all. Observers can also take strategic cues from only the first four owners.

**Recommendation:** Size the pool to the room ceiling plus one predicted-owner slot, and always reserve/evict in favor of the local player. Ten retained ropes is still a tiny bounded pool.

### 4. Beam charge, heat, recovery, and overheat rules have no HUD vocabulary — **M**

**Evidence:** A beam has charge time, ignition heat, channel limit, heat/cooling, overheat lock, restart threshold, and movement penalties (`packages/shared/src/weapons.ts:17-40`; `packages/shared/src/combat.ts:26-86`). The server enforces rising-edge start, non-damaging charge, early-cancel heat, recovery, mandatory release, and restart heat (`packages/server/src/rooms/GameRoom.ts:2721-2968`). The weapon HUD renders only ammo/reload resources (`packages/client/src/scenes/ArenaScene.ts:7011-7044`); beam state survives only as small world-space rings at the emitter (`packages/client/src/vfx/BeamRenderer.ts:228-271`).

**10-second player consequence:** My new weapon does no damage during charge, slows me, stops itself, then ignores my next hold. With no **CHARGING / HOT / OVERHEATED / COOLING / RELEASE** read, the correct rules are indistinguishable from lag or broken input.

**Recommendation:** Add a heat strip and phase word beside the held weapon, including charge progress, lock countdown, and a release prompt. The first beam equip should show a two-line contextual card: “Hold RMB to charge/channel. Release before overheat; cool below the marker to restart.”

### 5. New beams and XP Echoes render above the exact dodge/boss footprints — **M**

**Evidence:** Exact danger geometry is deliberately placed at depth 3, beneath actors (`packages/client/src/scenes/ArenaScene.ts:639-649`, `:1418-1435`). Beams render at depths 9990–9992 (`packages/client/src/vfx/BeamRenderer.ts:102-110`) and XP Echo leaders/trails/receipts at 99981–99993 (`packages/client/src/vfx/xp-motes.ts:4-6`, `:100-139`). Only the compact white parry-source layer sits above them at 99990; red dodge geometry still uses the ground layer (`ArenaScene.ts:3946-3990`).

**10-second player consequence:** At the exact moment the screen has beams, motes, bodies, and boss spectacle, the red line that says “leave this area” is the layer most likely to disappear. A death then feels arbitrary even if the server footprint was exact.

**Recommendation:** Reserve a protected response-edge channel above combat VFX but below HUD: thin, contrast-keyed outer boundaries only. Keep painted fills on the ground, but redraw the final dodge edge and player-intersecting boss edge in that protected channel.

### 6. The horde tell cap does not cap the two ground geometries drawn for every melee windup — **M**

**Evidence:** `MELEE_FULL_TELL_COUNT` limits only six rig-owned source/bracket details (`packages/client/src/scenes/ArenaScene.ts:254-257`, `:3556-3593`). `animateEnemies` still draws a range sector for every active melee enemy (`ArenaScene.ts:3320-3450`), then `renderTelegraphs` iterates every synced row and draws another exact footprint (`ArenaScene.ts:3793-3910`). The code explicitly says geometry/rhythm is never culled (`ArenaScene.ts:3330`).

**10-second player consequence:** In the advertised 50-enemy chaos, overlapping white sectors become a luminous floor texture. I can no longer distinguish “this strike contains me now” from harmless distant rhythm, and boss red edges underneath lose the visual vote.

**Recommendation:** Keep exact geometry for every threat that intersects or can reach the local player soon; collapse distant windups to one source glint/implement bracket. Do not draw both the range ruler and full footprint for the same low-salience row. Reserve a separate, non-competing budget for boss tells.

### 7. The first death cannot say what killed me — **M**

**Evidence:** `PlayerState` carries HP/alive/fall/parry/revive edges but no last-damage source (`packages/shared/src/state.ts:25-33`, `:83-99`). Contact, boss AoE, duelist, projectile, and zone damage mutate HP through unrelated paths (`packages/server/src/rooms/GameRoom.ts:2410-2428`, `:4172-4254`, `:5160-5170`, `:5370-5386`, `:5590-5594`). The death overlay reports only **DOWNED** or **DEFEATED** and the rez weapon name (`packages/client/src/scenes/ArenaScene.ts:7127-7140`).

**10-second player consequence:** After a visually dense death I cannot tell whether I missed a parry, stood in a pool, was shot offscreen, touched a body, or fell. The most teachable moment in the first run teaches nothing.

**Recommendation:** Sync a compact death receipt—source kind/id, damage type, amount, parryability, and optional telegraph kind—and render “Downed by Acid Pool (unparryable), 18 damage” plus one actionable counter. Keep a short two-entry damage recap for multi-hit deaths.

### 8. Serraketh's valid targets and armor state read as subtle art variants, not boss rules — **M**

**Evidence:** Untargetable segments and buds are communicated mainly by alpha 0.68–0.72 and a gray tint (`packages/client/src/entities/WormRig.ts:760-789`, `:921-1001`). Hits on non-targetable slots are simply skipped (`packages/server/src/rooms/BossController.ts:713-795`); armored parts absorb local damage and use dramatically different core multipliers (`BossController.ts:1066-1104`; `packages/shared/src/bosses.ts:930-979`). The boss bar compresses anatomy into tiny unlabeled colored notches (`WormRig.ts:1061-1103`).

**10-second player consequence:** I unload into a huge, apparently solid body and see little or no core movement, with no **IMMUNE**, armor crack, seam target, or segment objective. The first impression is “boss hit registration is broken.”

**Recommendation:** Give targetable seams a stable silhouette treatment (bracket/reticle plus high-contrast edge), show **ARMORED** or **IMMUNE** on rejected contact, and label the first anatomy state change. The entrance micro-objective should say what to attack and what severing/regrowth means.

## P1 — likely to lose or confuse a player in the first ten minutes

### 9. XP Echo presentation falsely implies personal or last-hit XP — **S**

**Evidence:** XP is granted to every player in lockstep (`packages/server/src/rooms/GameRoom.ts:3416-3420`), but each Echo selects one collector (`GameRoom.ts:3600-3617`, `:3846-3914`). The client flies the mote into that rig and prints `+N XP` over that collector while pulsing everyone's bar (`packages/client/src/scenes/ArenaScene.ts:2914-2990`).

**10-second player consequence:** The first few kills look as if my teammate vacuumed my reward or last-hit credit. That creates unnecessary co-op mistrust before I understand the shared progression model.

**Recommendation:** Label the first receipt **SQUAD XP — shared**, and use “+N SQUAD XP” for large batches. A tiny simultaneous pulse/tether on each squad portrait would reinforce the truth without adding more world text.

### 10. The expanded response language—parry, dodge, jump, and persistent zone—has no legend — **S**

**Evidence:** Exact tells encode parry as white and dodge as warm red with different cadence marks (`packages/client/src/scenes/ArenaScene.ts:3946-3990`); the enemy definitions describe white melee windups versus red, unparryable leap landings (`packages/shared/src/enemies.ts:95-117`); and zones are explicitly red/orange and unparryable only in code comments (`ArenaScene.ts:4287-4312`). One bespoke World Titan banner teaches jump/parry (`ArenaScene.ts:4463-4467`), but other attacks and zones get no first-contact response label.

**10-second player consequence:** A newcomer knows LMB is “parry” from the HUD but not what is parryable. The first red pool or landing marker can reasonably be read as another timing ring, producing a failed parry and apparently inconsistent rules.

**Recommendation:** On first encounter only, annotate the live cue: **WHITE — PARRY**, **RED HATCH — DODGE**, **GROUND POOL — MOVE OUT**, **QUAKE — JUMP OR PARRY**. Reuse the actual cue shape beside the text, then retire each card after it is demonstrated.

### 11. The always-on objective HUD is an unwrapped wall of unrelated information — **S**

**Evidence:** `modeText` is a single centered `Text` object with no wrap or width constraint (`packages/client/src/scenes/ArenaScene.ts:1701-1711`). In normal play it concatenates dimension, depth, objective, two salvage totals, two controls, character, class, and growth stat (`ArenaScene.ts:7063-7114`). The lower-left level line simultaneously exposes five attribute acronyms and crit chance (`ArenaScene.ts:7002-7008`).

**10-second player consequence:** On a laptop-width viewport the critical objective competes with or clips behind trivia; on any viewport a new player has to parse build math before learning movement. Nothing has a clear “read me now” hierarchy.

**Recommendation:** Keep one top-center objective and timer. Move carried/banked values to an economy chip, controls to contextual hints, and class/build details to the weapon/level panel. Add width constraints and a two-line maximum at every supported viewport.

### 12. Ten-player co-op has no party-awareness layer — **M**

**Evidence:** `SpriteRig` creates a world label only for the local player (`packages/client/src/entities/SpriteRig.ts:1130-1138`). The HUD builds local HP/XP, weapon, objective, and boss widgets but no teammate roster (`packages/client/src/scenes/ArenaScene.ts:1615-1756`, `:6947-7141`). A downed teammate is only a half-alpha gray world rig (`SpriteRig.ts:2024-2047`) with no offscreen/downed pointer.

**10-second player consequence:** On joining, I cannot reliably identify teammates with matching skins, see who is hurt, notice an offscreen down, or find the body that needs the named rez weapon. The co-op promise reads like several anonymous sprites sharing a room.

**Recommendation:** Add a compact party strip with color/initial, HP, downed state, distance/offscreen direction, and local/host marker. Apply the same stable color to a subtle foot ring and nameplate—not the character art or danger colors.

### 13. A held beam is labeled **PARRY** in the level-up build context — **S**

**Evidence:** Augment gating recognizes only `gun` and `cast`; everything else receives the universal parry pool (`packages/shared/src/augments.ts:224-233`; `packages/server/src/rooms/GameRoom.ts:3917-3928`). The level-up model explicitly maps any weapon without `.gun` or `.cast` to delivery **PARRY** (`packages/client/src/ui/level-up-model.ts:379-400`), despite beam being a first-class delivery (`packages/shared/src/weapons.ts:17-40`).

**10-second player consequence:** My first level screen can call a screen-filling laser weapon “PARRY.” That makes the new parity UI look untrustworthy and hides that there is no beam-specific signature path.

**Recommendation:** Add **BEAM** to the delivery taxonomy and decide its signature eligibility explicitly. Even if its first draft remains universal parry perks, the rail must say **BEAM + PARRY SIGNATURE**, not redefine the weapon.

### 14. A plain Common mystery pickup can reveal nothing at all — **S**

**Evidence:** Pickups intentionally hide identity behind a mystery presentation (`packages/client/src/scenes/ArenaScene.ts:1760-1859`). After equip, the reveal banner only fires if rarity is above Common or an affix exists (`ArenaScene.ts:6691-6711`). The drop pool now includes power-banded expansion weapons (`packages/shared/src/loot.ts:219-244`), including unfamiliar beam deliveries.

**10-second player consequence:** I press grab, my weapon behavior changes radically, and the only acknowledgement may be a small lower-left name change. A Common beam is exactly the item that most needs explanation and exactly the item the reveal path can suppress.

**Recommendation:** Always reveal on weapon-id change. Rarity controls flourish, not whether identity is announced. For the first acquisition of each delivery, append one verb line and its resource rule; retain a glossary entry in the dock.

### 15. Beams have no charge, ignition, sustain, release, or overheat audio — **M**

**Evidence:** `AudioBus.play` defines shots, impacts, rewards, death, boss, movement, and recovery stingers, but no beam events (`packages/client/src/audio/AudioBus.ts:240-333`). `ArenaScene.updateBeams` reconciles every beam phase without dispatching audio (`packages/client/src/scenes/ArenaScene.ts:8436-8580`).

**10-second player consequence:** The weapon's most important state transitions are silent. I cannot hear ignition complete, heat danger rise, or the overheat lock while watching the cursor or escaping a horde.

**Recommendation:** Add throttled owner-priority cues: charge rise, ignition crack, a bounded sustain voice, heat-warning pulse, release tail, and overheat clunk. Teammate beams should use a quieter spatial mix.

### 16. Combo identity does not reset on a new weapon or a long pause — **M**

**Evidence:** The deterministic visual step derives from global `attackSeq`; its own comment says long idle and weapon swap do not reset the count (`packages/shared/src/melee.ts:1097-1148`). `SpriteRig.triggerSwing` uses that sequence whenever an attack beat has been seen, ahead of its local continuity/reset branch (`packages/client/src/entities/SpriteRig.ts:1860-1878`). The server's beat is player-global (`packages/server/src/rooms/GameRoom.ts:2504-2509`).

**10-second player consequence:** The first swing after equipping a signature big sword can begin on move two or three, and walking away for a while resumes mid-combo. The authored opening/finisher grammar is never reliably introduced.

**Recommendation:** Sync a per-held-weapon combo epoch/step that resets on swap, down/revive, and cadence timeout. Use that same step for server geometry once finding 2 is fixed.

### 17. The first level-up explains numbers with expert shorthand, not decisions — **S**

**Evidence:** Card context strings use `REQ POWER`, `HELD SCALING`, `SQUAD HARVEST`, `I-FRAMES`, and compressed before/after percentages (`packages/client/src/ui/level-up-model.ts:140-223`, `:268-289`). Progression grants the first flex choice after auto-applying two class-specific attributes (`packages/server/src/rooms/progression.ts:33-51`), so this vocabulary arrives before the player has used the build system.

**10-second player consequence:** Under a five-second choice timer, I am decoding acronyms rather than making a build decision. Exact math is valuable, but it currently replaces the plain-language outcome instead of supporting it.

**Recommendation:** Lead each first-session card with a player verb—**hit harder**, **survive longer**, **crit more often**—then show exact deltas beneath. Tooltips/glossary can define requirement penalty, scaling grades, i-frames, and harvest after the choice.

### 18. “Reduced motion” leaves the strongest flashes and shakes untouched — **M**

**Evidence:** The only preference source is the OS `prefers-reduced-motion` query (`packages/client/src/scenes/ArenaScene.ts:225-230`), used for paper, spawn, UI, and XP motion. Pit/rift flashes, fall shake, telegraph-impact shake, boss entrance flash/quake, gun recoil, and hurt shake call the camera directly (`ArenaScene.ts:2531-2575`, `:3921-3940`, `:4455-4462`, `:6534-6545`, `:6672-6678`). The low-HP vignette also pulses (`ArenaScene.ts:6979-6987`).

**10-second player consequence:** A motion-sensitive player can opt out at OS level and still receive forced full-screen impulses and flashes—the effects most likely to cause discomfort—on their first fall, hit, or boss entrance.

**Recommendation:** Add explicit **Screen shake**, **Full-screen flash**, **VFX intensity**, and **Low-HP pulse** settings. Route every camera effect through one accessibility-aware mixer; OS preference should initialize conservative defaults, not be the only control.

### 19. Controls are hardcoded, including the left/right mouse roles — **L**

**Evidence:** The complete keyboard map is hardcoded in `ArenaScene.create` (`packages/client/src/scenes/ArenaScene.ts:1456-1489`), and attack/parry directly poll right/left mouse buttons (`ArenaScene.ts:6060-6070`, `:6230-6246`). There is no binding model in `MenuScene`; its only settings surface is audio (`packages/client/src/scenes/MenuScene.ts:182-230`).

**10-second player consequence:** A left-handed player, non-QWERTY user, one-handed player, or anyone whose browser/device reserves RMB cannot perform the two core verbs comfortably. There is no path to fix it before deciding the game is not for them.

**Recommendation:** Introduce action-based bindings with keyboard/mouse remap, swap attack/parry, and conflict detection. Gamepad aim/fire/parry should be a first-class profile rather than another set of conditionals in the scene.

### 20. Telegraph accessibility still depends too heavily on the authored palette — **M**

**Evidence:** Parry and dodge do have some structural variation, but their dominant response colors are hardcoded white and `0xd96a4f` (`packages/client/src/scenes/ArenaScene.ts:3946-3990`). Persistent unparryable zones are hardcoded red/orange ellipses (`ArenaScene.ts:4287-4312`). The menu exposes no contrast/color-vision controls (`packages/client/src/scenes/MenuScene.ts:182-230`).

**10-second player consequence:** If those hues collapse against a dimension palette or for a color-vision deficiency, “parry this” versus “leave this” loses the quick preattentive read exactly when fifty enemies prevent close inspection.

**Recommendation:** Offer tested telegraph palettes and high-contrast mode. Give every persistent dodge hazard a repeated non-color pattern/icon, and preview all response types in settings so the player can choose before a run.

### 21. There is no in-run settings or leave-to-menu surface — **M**

**Evidence:** The arena key set contains no Escape/pause/settings action (`packages/client/src/scenes/ArenaScene.ts:1456-1489`). The only live audio control is the binary `M` mute path, while volume controls exist only in `MenuScene` (`packages/client/src/scenes/MenuScene.ts:182-230`). The always-visible action in the arena is **Restart Run** (`ArenaScene.ts:1659-1671`), not settings or return.

**10-second player consequence:** Once combat starts, I cannot lower volume incrementally, enable accessibility options, inspect bindings, or leave cleanly. Reloading the page becomes the apparent navigation model.

**Recommendation:** Escape should open a non-pausing co-op overlay with Resume, Settings, Controls, Leave Run, and Return to Menu. Make it explicit that the world remains live, while the local player gets no special protection.

### 22. Boss entrances announce spectacle, not the boss's playable verb — **S**

**Evidence:** The approach banner says only “THE [DIMENSION] BOSS APPROACHES” (`packages/client/src/scenes/ArenaScene.ts:4509-4513`). The bar can show the boss-def name (`ArenaScene.ts:4446-4478`), but only World Titan receives a mechanic-specific follow-up (`ArenaScene.ts:4463-4467`). `BossController` otherwise supports very different melee, projectile, AoE, zone, beam, ring, dash, and worm behaviors (`packages/server/src/rooms/BossController.ts:58-100`, `:1738-1832`).

**10-second player consequence:** The first boss arrives with excellent shake and flash but no clue what skill the fight is about. Trial-and-error begins at the most lethal point of the run.

**Recommendation:** Add a short `onboardVerb`/response glyph to each boss definition and show it after the name: one sentence, one icon, then gone. Serraketh's should teach seams/armor; other bosses should name only their signature response, not spoil phases.

## P2 — worthwhile polish after the first-session blockers

### 23. Commons, Cover, and Scar change traversal but never become player concepts — **S**

**Evidence:** The three macro-zones exist only as internal map kinds (`packages/shared/src/mapgen.ts:45-60`). Scar accepts far more/closer pit seeds while Cover strongly suppresses them (`mapgen.ts:295-325`); Cover also receives most landmark clusters (`mapgen.ts:805-853`, `:984-992`). Client identity is a very subtle wash—alpha 0.025/0.095/0.12—and different tile families, with no label (`packages/client/src/scenes/arena/floor-renderer.ts:616-627`, `:1348-1390`).

**10-second player consequence:** Crossing the new painted boundary can look like entering a damage biome, while the actual lesson is “more solid cover here / denser fractures there.” I learn only after colliding or falling.

**Recommendation:** On the first boundary crossing, show a restrained diegetic location tag: **COVER — dense structures**, **SCAR — fractured ground**, **COMMONS — open ground**. Do not add permanent HUD or imply buffs that do not exist.

### 24. The dimensions have no continuous audible identity — **M**

**Evidence:** `AudioBus` is a bounded procedural one-shot SFX dispatcher with one master gain (`packages/client/src/audio/AudioBus.ts:1-14`, `:240-333`). It has no loop, ambient bed, music bus, or dimension/boss state API. The menu's settings expose only one master volume (`packages/client/src/scenes/MenuScene.ts:182-230`).

**10-second player consequence:** Between impacts the grounded art has no audible place, pressure curve, or transition into the boss. The first arena can feel like a VFX test room whose sounds happen only when something fires.

**Recommendation:** Add a restrained dimension ambience/music bed with combat and boss stems, plus separate Music / SFX / UI sliders. Preserve positional one-shots; the bed's job is place and pacing, not volume.

## Recommended first-session order

The highest-return sequence is: make menu choice truthful; protect and prioritize response edges; expose beam state; restore combo hit truth; add death receipts; then add party awareness and one-shot contextual teaching for XP, hazards, pickups, level-up vocabulary, and each boss. Accessibility settings should ship alongside the protected telegraph channel, because both depend on centralizing visual-response policy rather than adding more isolated effects.
