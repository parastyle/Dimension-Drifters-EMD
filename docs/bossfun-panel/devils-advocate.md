# Devil's advocate: a boss is not a pile of boss systems

## Ruling

The framework can generate bosses. It does not yet guarantee a good boss **instance**.

The dangerous response to “make one fight as fun as possible” is to showcase everything at once: enormous art, four independent modules, horde pressure, adds, white parries, red dodges, jump checks, painted telegraphs, paper motion, ribbon-heavy player attacks, XP Echoes, and a nuke pack on every large impact. That produces a feature reel, not a fight players can learn, master, and remember.

If the chosen instance is the giant footstep fight, its sentence must stay brutally simple:

> **Read the lifted foot, jump the quake or risk a parry for a counter, then punish the planted giant.**

`WORLD_TITAN` is closer to that sentence than `COLOSSUS`. Gorogoth's final phase is already a kitchen sink of four crater zones, an expanding ring, 26 bullets, and four adds (`packages/shared/src/bosses.ts:764-846`). Vastaghar at least has a core verb, but its current “double” and “triple” stomps are simultaneous circles, its parry reward is incomplete, and the ordinary horde can still turn the feet into background scenery (`packages/shared/src/bosses.ts:856-919`). Do not merge the two kits merely because both bodies are enormous.

Every law below is a release gate for this one encounter. “It felt okay in a clean local test” is not evidence.

## 1. Identity dilution: the boss becomes a geometry sampler

### How this codebase produces it

`BossDef` encourages phases to accumulate independent modules. The controller has no encounter-level move selector, no global recovery, and no concept of a primary verb. Each module advances on its own cadence. Meanwhile the client selects only one dominant telegraph to pose the boss, based mostly on the row nearest resolution (`packages/client/src/scenes/ArenaScene.ts:3126-3156`). Two honest casts can therefore ask the floor to say two things while the body performs only one.

This is especially bad for a titan. Size already consumes attention. Adding craters, a beam, a radial burst, a ring, adds, quakes, contact damage, and horde attacks does not make the titan deeper. It makes the titan the least important thing in its own fight.

### Hard guardrails

- **One-sentence law:** after one run, at least 8 of 10 blind playtesters must describe the same core verb without being prompted. “Lots of AoEs” is a failure.
- **Signature-share law:** at least 60% of the encounter's major decision beats must be the signature footstep sequence. No phase may go more than 8 seconds without advancing, resolving, or paying off that verb.
- **Support-budget law:** the fight may have at most two supporting attack families, and neither may introduce a third required response input. Support exists to alter where or when the player handles the footstep, not to replace it.
- **Decision-concurrency law:** a local player may be inside the final 350 ms decision window of at most one boss-authored major attack at a time. Secondary pressure may move the player, but it may not demand a simultaneous contradictory jump/parry/dodge decision.
- **Pose-ownership law:** every major cast has one source pose and one authoritative cast identity. If two modules cannot be expressed by compatible body parts, the later cast is deferred. Choosing one row to animate while resolving both is forbidden.

## 2. HP sponge: elapsed time masquerades as difficulty

### How this codebase produces it

Boss HP is body HP multiplied by `enemyHpScale(this.state.players.size)` and depth HP (`packages/server/src/rooms/GameRoom.ts:4712`). Squad scaling is `+60%` per additional connected player, not living player (`packages/shared/src/constants.ts:416`; `packages/shared/src/enemies.ts:695-706`). A downed or disconnected-in-practice squad can therefore leave the survivors chewing full-squad HP.

The screen titan starts at 1,900 base HP (`packages/shared/src/enemies.ts:361-370`). Worse, the client boss bar divides the scaled live HP by the body's unscaled roster HP, then clamps to one (`packages/client/src/scenes/ArenaScene.ts:4365-4372`). With four players, a 2.8x-scaled boss appears completely full until roughly 64% of its real HP is already gone. At ten players it appears full until roughly 84% is gone. The authoritative phase machine uses the correct frozen scaled max HP, so the boss can change phases while the visible bar claims nothing happened.

Huge radius also flatters certain builds. A 230 px target is nearly impossible for a multi-revolution spin to miss, and spin hit sets now re-arm each revolution (`packages/server/src/rooms/GameRoom.ts:2491-2500`). That is satisfying when it is an earned punish and a balance disaster when it is uninterrupted lawn-mower uptime.

### Hard guardrails

- **Truthful-bar law:** the client receives or derives the exact frozen encounter max HP. Displayed HP error must remain below 0.5 percentage points, and every phase tick must be crossed within one 20 Hz patch of the authoritative transition.
- **Time-budget law:** in representative completed builds, median kill time must be 90-120 seconds; the 10th-90th percentile band must remain 70-150 seconds. Measure solo, two-player, and four-player squads. Group medians may differ by no more than 15%.
- **Phase-length law:** no phase may have a median duration above 45 seconds or require more than six clean repetitions of a solved pattern. Each learning phase must normally expose its signature at least twice.
- **No-immunity law:** phase transitions may not discard damage or make the boss invulnerable. One hundred percent of accepted damage, including crit, quake, riposte, and per-revolution spin damage, must be conserved across a phase boundary.
- **Build-band law:** after normalizing item level, the fastest legal weapon family may not beat the slowest viable family's median kill time by more than 2.25x. A full-revolution spin must be valuable during punish windows, not categorically optimal because the body is enormous.
- **Downed-squad law:** boss max HP does not rubber-band downward mid-fight, but a down must create a recoverable encounter state: while at least two players live, the fight must offer a safe revive window of at least 2 seconds within the next 12 seconds.

## 3. Telegraph soup: correct shapes can still create an unreadable fight

### How this codebase produces it

The new three-layer tell is the right foundation: source pose, painted foreshadow, and exact thin underlay. The failure mode is assuming that because every individual tell is good, twelve overlapping tells are also good.

The server runs at 20 Hz (`packages/shared/src/constants.ts:16-18`). Remote enemy bodies render 120 ms behind the server timeline (`packages/shared/src/constants.ts:141-147`), while boss telegraph pose selection samples raw row `t` (`packages/client/src/scenes/ArenaScene.ts:3126-3156`). The exact ground promise can therefore be current while the enormous source body is visibly behind it. Short 0.34-second boss melee windups have fewer than seven simulation steps (`packages/shared/src/bosses.ts:601`, `:752`). Packet transit and a missed first patch can consume a meaningful portion of the performance.

There is also no cast-level presentation grouping on the client. A multi-circle landing cast is several rows. Each resolved 220 px crater calls `spawnExplosion`, and explosions at radius 160 or greater select the universal `nuke` pack (`packages/client/src/scenes/arena/vfx.ts:729-748`, `:783-795`). Gorogoth's four-crater cast can consequently request four nuke packs, four impact stacks, repeated boom calls, and repeated shake requests for one authored action.

Instant projectile modules are another regression path. `bulletFan` and `aimedVolley` can resolve with `windup: 0`, creating bullets without a boss telegraph row and therefore without the new source-performance contract.

### Hard guardrails

- **Primary-tell law:** no more than one primary boss telegraph may be in Lock/Release for a player. Across boss, adds, and residual horde, no more than eight exact footprints may be live on a client's viewport; excess content must be rescheduled, not visually hidden.
- **Route law:** at every decision sample, the union of boss danger may cover at most 55% of currently navigable visible ground, and at least one route to safety must remain `2 * PLAYER_RADIUS + 24 px` wide after collision and boss-body exclusion.
- **First-frame law:** the complete exact footprint and a changed attacker silhouette must be present on the first observed cast patch. Coverage never grows from zero; `t` may change cadence and energy only.
- **No-instant-major law:** every damaging boss volley or major contact attack gets at least 0.40 seconds of authoritative source warning. `windup: 0` is permitted only for harmless transitions or payloads already continuously forecast by an active move.
- **Network-read law:** at 0/100/200 ms RTT with 0/30 ms jitter and 1% packet loss, source pose, painted foreshadow, exact edge, and impact must agree on the same cast within one rendered frame. A late first observation samples the current phase; it never replays Claim.
- **Cast-payoff law:** one authoritative cast may dispatch at most one nuke pack, one camera shake, and one primary boom, regardless of row count. The nuke pack may be used at most twice in any rolling 10 seconds and never as a windup texture.
- **Failure-mode law:** with all optional paint packs and flipbooks unavailable, dodge/parry success rate may fall by no more than 5 percentage points. Optional art can carry awe, never collision truth.

## 4. The body lies: fixed geometry detaches from a moving titan

### How this codebase produces it

Primitives correctly compute telegraph and payload together at trigger time. That preserves exact geometry. It does not preserve causality if the attacker walks away from that geometry.

`BossController` plants the boss only while a pending cast emits melee (`packages/server/src/rooms/BossController.ts:170-174`). Footfall quakes, source rings, beams, radial bursts, and crater slams do not plant it. Vastaghar can move roughly 38 px during a 0.95-second P1 footstep. A chase-mode Gorogoth can walk away from the fixed origin of its active ring or beam. The client may cosmetically suppress gait, but the root still follows authoritative movement.

Dash has the inverse problem. The boss becomes the payload visually, but the current active hazard damages the entire original start-to-end rectangle every live tick, not a moving body capsule. The exact underlay tells this truth, yet the move still feels like a floor lane wearing a boss costume.

### Hard guardrails

- **Source-root law:** from Lock through resolve, an attacking foot/emitter and its authoritative origin may differ by at most 8 world px in top-down play and 6 screen px in the minimum supported viewport. Plant the body or update both damage and telegraph from the same authoritative socket.
- **Active-anchor law:** a beam, ring, or quake visibly emitted by the boss either remains anchored to the boss for its whole active life or visibly leaves behind an independent world source. No invisible pivot is allowed.
- **Dash-body law:** if the fiction says the body hits, damage follows a swept body capsule. If the whole lane remains dangerous, the fight must render a persistent damaging wake that fills that lane; a moving sprite alone is insufficient.
- **Occlusion law:** the titan's opaque art may not cover the local player or a response-critical edge/glint for more than 150 ms. Fade/crop upper-body layers locally if required; do not shrink the gameplay body to solve an art problem.

## 5. The footstep rhythm is currently fake

### How this codebase produces it

`footfallQuake` interprets `count` as several circles in one `CastPlan`. They share one windup and resolve together in one payload loop (`packages/shared/src/boss-primitives.ts:297-323`; `packages/server/src/rooms/BossController.ts:394-402`). P2's “double stomp” and P3's “triple stomp” are therefore simultaneous, not rhythmic.

That creates both easy and brutal failures:

- one jump or one broad parry iframe can negate the entire advertised sequence;
- overlapping circles can damage a grounded player two or three times on one tick;
- a parrying player can receive multiple `parriedSeq` bumps from one button press;
- the player never learns alternating feet, cadence, or escalation, because there is only one beat.

The authored `cooldown` label is also misleading. The controller stops decrementing module cooldown while a cast is pending, then lingers its resolved row for a broadcast generation (`packages/server/src/rooms/BossController.ts:180-214`). Actual start-to-start interval is roughly windup + settle + cooldown, although `AttackModule.cooldown` is documented as seconds between triggers (`packages/shared/src/bosses.ts:15-31`). A nominal 1.4-second stampede is materially slower and less musical than the data says.

### Hard guardrails

- **One-foot-one-epoch law:** one footfall is one cast id, one resolve tick, one damage opportunity, and at most one personal parry receipt. `count > 1` may not stand in for a sequence.
- **Cadence law:** P2 double steps resolve 0.50-0.70 seconds apart. P3 triple steps resolve 0.38-0.58 seconds apart. The gap may vary only within an explicitly authored rhythm and may not change with render frame rate.
- **No-stack law:** a player can take quake damage at most once per footstep epoch. Two circles resolving on the same tick may never multiply the hit.
- **Declared-clock law:** logged cast start-to-start time must match the authored cadence within one 50 ms server step. If the field means post-recovery downtime, rename it and author an explicit start-to-start beat separately.
- **Audio law:** each foot has one audible pre-beat and one impact. In a blind audio test after one training exposure, 8 of 10 players must correctly jump/parry at least four of the next five steps.

## 6. Parry and jump fairness collapses under latency unless tested as a networked verb

### How this codebase produces it

The generous constants help: parry iframes are 0.52 seconds and the input buffer is 0.2 seconds (`packages/shared/src/constants.ts:555-578`). But the buffer only helps a press waiting on cooldown. It does not rewind a boss hit that resolved before the input reached the server.

The excellent weapon-glint pipeline is not automatically the boss pipeline. The 280 ms glint is driven by regular-enemy `windup` and `melee:` ownership (`packages/client/src/scenes/ArenaScene.ts:233-236`, `:3428-3443`). Boss `meleeCombo` and quake rows are generic `tg` rows feeding the boss's brace and exact footprint. Without an explicit boss limb/weapon glint, the marquee boss parry can have a better floor ruler and a worse parry moment than a common duelist.

The quake reward contract is presently false. The primitive says a quake parry “feeds the parry chain” (`packages/shared/src/boss-primitives.ts:297-299`), but `applyBossQuake` only increments `parriedSeq` and returns (`packages/server/src/rooms/GameRoom.ts:3209-3230`). It does not call the shared `resolveParry`, so there is no server chain increment, heal, cooldown refresh, launch, or riposte behavior. The client can celebrate a chain the server did not award.

Jump has the same latency cliff. The quake checks server `height > GROUND_EPSILON` on the resolve tick. A locally airborne paper doll is not proof the jump command arrived in time.

### Hard guardrails

- **Advertised-window law:** define one client-visible response window for each footstep. At 0/100/200 ms RTT with 0/30 ms jitter, at least 95% of presses made in the middle 60% of that displayed window must produce the advertised server result. Window center may shift by no more than 50 ms between network profiles.
- **Five-tick law:** the final actionable boss glint/rhythm beat must span at least five server ticks (250 ms), with a 60-90 ms crest. It must appear on the actual striking foot/weapon as well as the exact footprint.
- **Semantic law:** white always means this exact impact accepts parry. No dodge-only flash, nuke core, paper edge, or player ribbon may use a competing response-white crest during that window.
- **Parity law:** a successful quake parry must update the same authoritative personal chain ledger, cooldown refresh, heal, and feedback sequence as boss melee. Client and server chain values may never diverge after an acknowledged parry.
- **Choice-value law:** jumping is the reliable positional answer; parrying is the risky offensive answer. Three consecutive footstep parries must earn a clearly measured punish—at least 0.8 seconds of boss stagger/break or equivalent conserved counter damage. The global boss stagger may trigger once per footstep, while every successful player still receives their personal chain reward.
- **Input-outcome law:** one physical press cannot earn two or three quake parries because several circles shared a tick.

## 7. Co-op camera and target selection can turn the giant into griefing

### How this codebase produces it

Each client camera follows its own player at fixed encounter zoom (`packages/client/src/scenes/ArenaScene.ts:5548-5619`). That is correct for agency, but there is no boss framing, leash, limb locator, or camera-aware attack admission. A render-scale-13, radius-230 boss can consume one player's screen while its target-space warnings fall on another player's independent screen (`packages/shared/src/enemies.ts:359-370`).

Boss movement and most aimed primitives use the nearest living target (`packages/server/src/rooms/BossController.ts:317-329`; `packages/shared/src/boss-primitives.ts:171-185`). There is no threat rotation. One kiter can drag the boss and every source-rooted tell across the arena while teammates free-fire or lose the boss completely. The same nearest player can receive repeated craters merely for playing melee.

A downed player camera switches to a living teammate, but the fight has no authored revive beat. With the normal horde still active, “watch the teammate” can become “watch the teammate disappear under unrelated trash.”

### Hard guardrails

- **Camera-agency law:** interactive boss play never changes camera ownership to a squad midpoint or boss anchor. Encounter zoom changes are at most 5% and may not move the local player more than 10% of screen width in 250 ms.
- **Minimum-viewport law:** at 1280x720, the local player, the response-critical limb/source, and at least 220 px of escape space must be simultaneously visible for 90% of major Lock windows. Otherwise the cast may not target that player without an explicit edge-source tell.
- **Target-fairness law:** with at least two living players, no player receives more than two consecutive targeted major casts. Across any eight targeted casts, target counts may differ by at most one unless a player deliberately owns a visible taunt/threat mechanic.
- **Leash law:** the boss cannot be dragged out of the authored encounter stage or more than one minimum viewport away from the squad centroid. Re-entry is an authored move, never a teleport correction.
- **Revive law:** after a down, a 2-second revive opportunity must occur within 12 seconds. During it, the boss does not target the downed body or the active reviver with a major cast; residual adds cannot erase the window.
- **Shake law:** camera shake duty cycle may not exceed 20% of any rolling 10-second interval. Repeated footsteps communicate rhythm through audio, pose, and ground response; they do not continuously steal aim.

## 8. Adds and the ordinary horde can demote the boss to wallpaper

### How this codebase produces it

Normal arena mode explicitly keeps running the horde director until the boss falls (`packages/server/src/rooms/GameRoom.ts:1918-1925`). The boss-add cap of 12 counts only ids in `bossAddIds`, not the horde (`packages/server/src/rooms/GameRoom.ts:385-387`, `:3110-3115`; `packages/shared/src/constants.ts:510-511`). The global enemy cap is 80 (`packages/shared/src/constants.ts:263`). A four-add summon is therefore not “four adds”; it is four adds on top of whatever survived the 120-second run-up and whatever the director keeps spawning.

Adds also produce XP Echoes. Boss-active loot is suppressed, but XP is not. Those Echoes can open per-player level windows during the boss, making that player invulnerable and untargetable while a modal replaces combat input. The boss instance can literally reward add clearing by pausing one participant's fight.

Finally, boss and trash reward signals share the same bounded Echo system. `dropXp` may merge a new packet into a recent nearby packet (`packages/server/src/rooms/GameRoom.ts:2575-2622`). The boss's large XP core can therefore be swallowed into trash residue instead of reading as the kill receipt.

### Hard guardrails

- **Clean-stage law:** the ordinary spawn director stops when the boss entrance begins. Pre-existing trash is defeated, fled, or folded into the entrance within 3 seconds. It may not remain as an unbounded second director.
- **Add-cap law:** this encounter may have at most six live adds, independent of the global cap. A new wave cannot begin until the prior wave has one or fewer survivors, and summon starts are at least 12 seconds apart.
- **Add-uptime law:** adds are alive for no more than 35% of fight time. Median add lifetime is at most 7 seconds. If players spend more than 30% of squad damage on non-boss bodies, the add design has failed.
- **Purpose law:** every add wave names one tactical purpose—screen a foot, carry a break resource, or create a safe pocket. “More targets” is not a purpose.
- **Draft law:** XP may accumulate and Echoes may travel during the fight, but no level-up allocation window opens during an active boss attack. Queue it for an authored phase break or after death. No player receives modal invulnerability as an add-clear exploit.
- **Boss-core law:** the boss death creates one reserved, unmergeable, highest-tier XP Echo. Trash packets may fold into it; it may never fold into trash.

## 9. Phase transitions can erase player momentum and rewrite the rules silently

### How this codebase produces it

On phase change, `enterPhase` calls `dispose`, deleting pending telegraphs and active hazards, then rebuilds every module with `cd = firstDelay ?? 0` and `fires = 0` (`packages/server/src/rooms/BossController.ts:306-314`). A threshold hit can silently cancel a nearly resolved attack, delete a live beam/ring, restart a spiral, and immediately begin every zero-delay module in the new phase.

That is exploitable and emotionally flat. Burst damage becomes a hidden interrupt, but the boss does not visibly stagger. Conversely, a “cinematic” fix could easily freeze input, clear the player's accepted `SwingDescriptor`, stop a multi-revolution spin between paid revolutions, reset cooldowns, or throw the squad away from its earned position. Paper motion makes that temptation worse: a page fold is a semantic transition and can hide live combat while the server keeps moving.

### Hard guardrails

- **Conservation law:** phase entry never clears player velocity, cooldown, buffers, accepted swing clocks, per-revolution hit accounting, projectiles, or earned position. Damage overflow across the threshold is retained at full value.
- **Visible-break law:** if a threshold cancels a boss cast, the cancel is converted into an explicit boss stagger/break with cause, sound, and pose. No danger footprint may simply vanish below `t=1` without the boss visibly acknowledging the interruption.
- **Transition-window law:** the authored phase break lasts 0.55-0.85 seconds. Players retain full control and can finish attacks; the boss deals no damage during the break. The first new major Claim begins 0.75-1.25 seconds after the break resolves.
- **No-skip/no-theft law:** one server tick may cross at most one phase boundary. If mandatory signature material remains, overflow damage is stored and reapplied after the short break; it is never discarded, and the player is never asked to damage an invulnerable bar.
- **Paper-semantic law:** phase change may use a boss-local fold, tear, or stance transformation lasting at most 300 ms, but never a full-screen page turn and never the same tear-out used for death. Exact live instructions stay visible above it.
- **Schedule law:** phase-entry module order is explicitly authored. It may not arise accidentally from every omitted `firstDelay` becoming zero or every rotation counter returning to one.

## 10. No punish window means no mastery—and no room for the new melee toys

### How this codebase produces it

The controller has windup and active state but no explicit recovery state. Melee planting lasts only while the cast row is pending; other casts can allow movement throughout. Independent cooldowns can cover one module's downtime with another module's Claim. The boss is technically damageable throughout, but “the HP accepts damage” is not the same as “the player earned an offensive turn.”

This matters more now that player melee has an authoritative `SwingDescriptor`, iconic combo poses, painted edge ribbons, and per-revolution spin damage. A signature punish should let a hammer finisher land, a Stinger commit, or a whirlwind complete a visible revolution. If the next crater or add wave begins immediately, those systems become noisy passive DPS instead of expressive choices.

It also exposes a range lottery. A 320 px quake around a 230 px boss strongly pressures melee while a ranged build can hover beyond it. If ranged players can ignore the signature without sacrificing damage, the footstep is not the encounter mechanic; it is a melee tax.

### Hard guardrails

- **Earned-turn law:** every completed signature sequence creates a clearly posed boss recovery of at least 1.0 second. During it the boss is reachable, deals no contact damage, and begins no new major Claim.
- **Rolling-uptime law:** in every rolling 10 seconds, every viable delivery family gets at least 3 seconds of practical boss damage uptime after movement, body exclusion, and projectile travel are considered.
- **Move-completion law:** at least one punish per phase is long enough for the slowest approved iconic finisher to reach impact and for a spin weapon to complete one full damaging revolution from a fresh accepted input.
- **Range-parity law:** no delivery family may ignore more than 20% of signature steps while retaining over 70% of its dummy DPS. If standing outside the quake is safe, the boss must force re-entry or impose a real damage tradeoff.
- **Ribbon-priority law:** painted player ribbons render below response-critical white glints and exact tell edges. In a four-player all-melee stress capture, the foot/weapon glint remains identifiable in 9 of 10 randomized frames.
- **Contact law:** the titan's passive contact damage is disabled during earned punish windows. The player may approach the feet when invited without paying unavoidable background DPS.

## 11. Reward anticlimax: the boss disappears and three errands spawn in its corpse

### How this codebase produces it

On lethal damage, the server drops XP, clears the controller, opens the extraction portal at the exact corpse position, and drops guaranteed loot at that same position (`packages/server/src/rooms/GameRoom.ts:3612-3652`). The deeper rift is offset, but the portal, loot, boss Echo, corpse art, poof, and any nearby trash Echoes begin stacked.

Extraction is an instant proximity tripwire (`packages/server/src/rooms/GameRoom.ts:4935-4948`). A melee player near the kill can start the XP cleanup boundary on the next tick before anyone inspects the loot or consciously chooses extraction versus descent. Existing horde and boss adds are not deleted by ordinary `clearBoss`; the tracking set is merely cleared (`packages/server/src/rooms/GameRoom.ts:3026-3034`). The “victory lap” can therefore be an auto-extract, a loot scramble, or continued trash damage.

The client does have good ingredients: authoritative XP Echo travel, a boss-priority paper tear, painted impact packs, and the `nuke` hero pack. None of those creates a reward sequence by itself. Playing all of them simultaneously is still anticlimax.

### Hard guardrails

- **Threat-end law:** within one server tick of boss death, no boss, add, horde, projectile, zone, or contact source can deal further damage. The encounter ends cleanly before celebration begins.
- **Death-sequence law:** the authoritative death owns 0.8-1.2 seconds: committed collapse, one boss-priority paper cutout treatment, one cast-level nuke/element pack, one shake, and one final sound. Reduced-motion mode retains the same timing and receipt without the fold.
- **Receipt-order law:** the reserved boss XP core launches after the body commits to death and reaches the squad before portals become interactive. Its value and presentation cannot merge into trash.
- **Separation law:** loot, extraction, and deeper-rift interaction centers are separated by at least the sum of their interaction radii plus 32 px. No reward is hidden under the corpse or another interactable.
- **Agency law:** extraction remains non-interactive for at least 2 seconds after death and then requires an explicit hold/interact. Merely standing at the kill point cannot bank the run. Descent and extraction remain distinct deliberate choices.
- **Co-op reward law:** the guaranteed boss reward has explicit squad ownership—individual rolls, a shared choice, or a declared recipient. Nearest-player grab and last-hit position may not decide who receives the only capstone item.
- **Receipt-duration law:** the boss name, clear statement, earned salvage, XP core, and reward choice remain readable for at least 2 seconds without a level-up modal, portal transition, or banner stack covering them.

## Required instrumentation

These laws are not review prose unless the encounter records enough data to prove them. The boss fixture must log:

- encounter start/end, scaled max HP, HP ratio, phase entries, stored overflow, and damage by player/source;
- cast id, family, target player, Claim/Lock/resolve/recovery ticks, cancellation cause, and actual start-to-start interval;
- per-player jump/parry input receipt, client timestamp, RTT bucket, result, chain state, and quake epoch;
- simultaneous tell count, local danger coverage, safe-route width, boss/source visibility, shake time, and full-VFX dispatch count;
- boss versus add damage share, live add count, XP/draft boundaries, downs, revive-window availability, and reward interaction order.

The automated encounter matrix is solo/two/four players, melee/ranged/caster/spin-heavy loadouts, 0/100/200 ms RTT, 0/30 ms jitter, minimum viewport, reduced motion, optional VFX missing, and at least one down/revive. A local zero-latency video is the easiest case and proves almost nothing.

## Non-negotiable checklist

- [ ] One core verb accounts for at least 60% of major decisions; no kitchen-sink Colossus merge.
- [ ] Exact scaled max HP drives the bar; median fight is 90-120 seconds and no phase exceeds 45 seconds.
- [ ] One player faces at most one major final decision at a time; navigable danger coverage stays at or below 55%.
- [ ] Source limb and authoritative origin agree within 8 world px; source-rooted casts plant or truly track.
- [ ] Double/triple footsteps are separate epochs 0.38-0.70 seconds apart, never simultaneous multi-hit circles.
- [ ] Parry and jump pass the 0/100/200 ms RTT matrix; quake parry uses the real server chain and counter reward.
- [ ] Ordinary horde spawning stops; live boss adds cap at six, add uptime stays below 35%, and boss drafts cannot interrupt combat.
- [ ] Target distribution, minimum-viewport visibility, camera agency, shake duty, and revive windows pass co-op tests.
- [ ] Phase breaks conserve all damage and player clocks; canceled boss casts become visible staggers, not silent deletion.
- [ ] Every signature sequence earns at least a 1-second punish window usable by iconic finishers and a full spin revolution.
- [ ] One cast produces at most one nuke pack, shake, and primary boom; ribbons and optional art never outrank tells.
- [ ] Boss death ends all threat in one tick, delivers one reserved XP core, separates rewards, and cannot auto-extract the killer.

If any item fails, the instance is not “almost fun.” It is one of the familiar bad boss fights wearing excellent new effects.
