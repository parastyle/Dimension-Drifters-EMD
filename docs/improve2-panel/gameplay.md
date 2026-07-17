# Gameplay improvement audit — current code

**Role:** Senior gameplay designer  
**Date:** 2026-07-16  
**Scope:** Moment-to-moment decisions, build depth, enemy verbs, co-op incentives, risk/reward, and boss reuse in the current authoritative implementation.

I read the current gameplay paths and the five prior audit/backlog documents. This report intentionally does **not** repeat their existing findings about generic hitstop/camera feel, old XP pacing, generic melee-archetype convergence, remote attack footprints, telegraph/hitbox projection, Conflagration's missing *visual*, or the already-known durability backlog. The items below are new current-code interactions, or older surfaces made materially different by today's beams, Echoes, map zones, weapon dock, combo art, and Serraketh core.

## Priority read

- **P0:** A rule currently breaks the intended decision, enables a dominant exploit, or leaves a flagship system without its gameplay payload.
- **P1:** A meaningful build/encounter choice is missing or points players toward a shallow optimum.
- **P2:** A smaller dead hook or clarity gap that is cheap to convert into a real choice.
- **Effort:** **S** = tuning/local logic, **M** = one state/UI seam, **L** = new authoritative state or multi-system content.

The highest-leverage sequence is: preserve weapon resources across swaps, make parry augments success-triggered, close the wielded-drop economy leak, teach the loot gate how beams work, give Scar an actual upside, then connect Serraketh's already-authored attacks. Those six changes turn today's new presentation work into trustworthy game rules.

## P0 — feel-breaking or system-defining

### G-01 — Weapon swapping is an infinite-ammo/cooldown cancel

**Evidence:** `packages/server/src/rooms/GameRoom.ts:789` (`cycleWeapon`), `:822-850` (`swapSlot`/`cycleSlot`), and especially the weapon-change block at `:2185-2200`. Every equip sets `c.cd = 0`, `c.reloadCd = 0`, and refills `player.charges` to the new weapon's maximum. `loadSlot` at `:1273` changes the weapon but preserves no slot-local combat resources.

**10-second player read:** Fire a slow quake/mortar, or empty a gun, swap away and back, and it is immediately ready with a full magazine. Fast Q/E or 1/2/3 cycling out-DPSes honest use and makes reload, charges, and heavy-weapon recovery fictional.

**Concrete change:** Store `cooldown`, `reload`, and `charges` per arsenal slot (and a per-weapon ledger for the arena carousel if it remains). Equipping must restore that ledger, never initialize it. Add a short shared draw lock, roughly 120–180 ms, so swapping is responsive but cannot interleave several one-shot weapons in a single cadence. Initialize resources only when a genuinely new pickup enters a slot.

**Effort:** **M**

### G-02 — Parry augments reward the button press, not the parry

**Evidence:** `executeParry` in `packages/server/src/rooms/GameRoom.ts:4853-4874` always calls `applyParryAugments`. That function heals with Second Wind (`:4885`), extends invulnerability with Bulwark, fires Counterblades (`:4895`), Brands nearby enemies, and casts Emberguard. There is no success predicate at that call site. `PARRY_COOLDOWN` is 0.6 s (`packages/shared/src/constants.ts:604`) while Bulwark grants 1.5 s (`packages/shared/src/augments.ts:193`).

**10-second player read:** Spam LMB in empty space and receive healing, projectiles, marks, and fire waves. With Bulwark, every 0.6-second press refreshes 1.5 seconds of protection against all invulnerability-respecting threats. Reading an enemy beat is strictly worse than drumming the button.

**Concrete change:** Let the press open only the base parry window. Move success effects to the actual melee/projectile resolution path, emit one authoritative `ParrySuccess` receipt, and proc augments once from that receipt. Replace Bulwark's extended i-frames with a one-hit absorb or a small shield value so it cannot create permanent coverage. Keep whiff knockback only if it is explicitly the base defensive verb; it should not trigger build rewards.

**Effort:** **M**

### G-03 — The new “every enemy wields a weapon” channel floods loot and bypasses the boss anti-farm rule

**Evidence:** The post-merge enemy pass assigns almost every non-boss/dummy a weapon and defaults `dropWeapon` to **0.22** (`packages/shared/src/enemies.ts:489-524`). Normal mystery drops are only 1.2%/5.5% for trash/tough enemies (`packages/shared/src/constants.ts:489-491`). During a boss, `damageEnemy` correctly suppresses `dropLoot`, but then calls `maybeDropWeapon` unconditionally (`packages/server/src/rooms/GameRoom.ts:4689-4707`); `maybeDropWeapon` at `:5280` has no `bossId` gate. The horde explicitly continues while the boss is alive (`GameRoom.ts:2110-2117`).

**10-second player read:** At combat density, known weapons arrive roughly every five kills and cover the floor, while the supposedly rarer mystery channel becomes background noise. Kiting a live boss still yields endlessly salvageable 22% weapon rolls despite the nearby comment saying boss-time farming is suppressed.

**Concrete change:** Put *all* non-boss reward channels behind one kill-reward budget. While a boss lives, ordinary wielded weapons should not drop. Outside bosses, lower the default known-weapon chance into the same economy as mystery drops—e.g. 2% trash, 6% tough, guaranteed only for named shifters—or make most visible weapons break into non-sellable scrap. Keep the visible carry as foreshadowing, not a second high-volume loot table.

**Effort:** **S**

### G-04 — The automatic drop curator cannot evaluate any of the 23 beams

**Evidence:** `effectivePower` in `packages/shared/src/loot.ts:149-184` models thrown, quake, chain, scatter, and gun sources but never reads `def.beam`. `isDropEligible` and `DROP_POOL` (`:222-239`) use that estimate to admit expansion weapons. A representative beam, `x2-voltcaster-machine-pistol`, has a 6-damage/0.4-second legacy shell but 75 beam DPS, charge, channel, heat, and lock data in `packages/shared/src/weapons-expansion.generated.ts:4076-4130`.

**10-second player read:** Two weapons that pass the curator as similar can have radically different real sustained damage, target coverage, and downtime. The player experiences a lottery of trap beams or dominant beams even though the pool claims to be power-gated.

**Concrete change:** Add a beam branch to `effectivePower`: cycle-normalized output should include `damagePerSecond × activeSeconds`, charge time, chosen/forced vent downtime, overheat lock, cooling to restart heat, aggregate-target cap, range, and width. Validate all beam entries against their class median with tests for one early-vent and one full-overheat cycle. Do not admit more beam drops until the estimator uses their actual delivery.

**Effort:** **M**

### G-05 — Commons/Cover/Scar are geography, not priced routing decisions

**Evidence:** Scar accepts pit sites at 1.0 versus 0.42 in Commons and 0.2 in Cover (`packages/shared/src/mapgen.ts:292-329`). `placePoiClusters` strongly favors Cover (`:805-852`). `zoneAtPx` exists at `mapgen.ts:287`, but current server combat/spawn/reward code has no zone caller; `runSpawnDirector`/`spawnEnemy` (`packages/server/src/rooms/GameRoom.ts:5683-5730`) choose around player anchors without zone rules.

**10-second player read:** Crossing into Scar gives more holes, less cover, the same enemies, the same Echo value, and the same loot. Its open lanes can incidentally help a long-range build and its pits offer unrewarded crowd control, but neither is a dependable premium for accepting the risk. The beautiful boundary communicates a priced decision that does not exist.

**Concrete change:** Make the exchange explicit and server-authoritative. Recommended first pass: kills whose corpse is in Scar drop +25% Echo value and roll loot with +1 tier-LUK, while Cover supplies safer sightline breaks but a small reward penalty or a higher melee-flanker share; Commons remains neutral. Show the active modifier at the boundary. Reward by kill location so entering the risky ground—not merely standing at its edge—earns the premium.

**Effort:** **M**

### G-06 — Serraketh's parry kit is authored but unreachable

**Evidence:** Serraketh's four phase rows all have empty module arrays (`packages/shared/src/bosses.ts:931-987`). `WormEncounterDirector` currently schedules split, regrow, dive, eruption, and contact (`packages/server/src/rooms/BossController.ts:1329-1401`). The actual `seamEaterRibQuake` and `seamEaterStitchReap` primitives exist at `packages/shared/src/boss-primitives.ts:627` and `:656`, but have no encounter call site; the client rig already checks those action kinds for parry glints.

**10-second player read:** The marquee worm chases, contacts, burrows, and restructures, but never performs the white Spinner counter lesson or tail reap its art and glints promise. Players mostly kite the body and burst exposed segments instead of alternating dodge/parry verbs.

**Concrete change:** Give the worm director a small phase action scheduler that composes the existing primitives: phase 1 tail reap; phase 2 alternating reap/rib quake after split; phase 3 shorter cadence around regrow; phase 4 a paired but non-overlapping sequence. Publish the corresponding `WormActionKind` and resolve through the same telegraph sink. Build this as a reusable “segmented-boss action module” so another chain/body boss can reuse the scheduler rather than forking `BossController` again.

**Effort:** **L**

## P1 — substantial depth and decision gains

### G-07 — Beam mastery is a hidden “release one tick before overheat” clock, amplified by three independent reactors

**Evidence:** A full channel forces `finishBeam(..., true)` and a minimum 1.5-second lock (`packages/server/src/rooms/GameRoom.ts:2871-2934`; `packages/shared/src/constants.ts:152`). Releasing just before the threshold gets only 0.35-second recovery (`constants.ts:150`). `stepBeamResources` (`GameRoom.ts:2722`) cools every inactive weapon in its own ledger, including stowed beams. All beams are clamped to the same 0.65-second minimum charge, 1.25-second maximum channel, heat floor, and restart laws (`packages/shared/src/combat.ts:58-85`).

**10-second player read:** Holding until the spectacular overheat is a mathematical mistake; releasing just before it avoids the lock. With three beam slots, rotate separate heat ledgers while stowed weapons cool. The strongest play is an invisible stopwatch/slot macro, not aiming, positioning, or choosing when to commit.

**Concrete change:** Create a readable redline decision. For example, releasing at 85–99% heat gives fast vent/uptime, while intentionally crossing 100% triggers a meaningful terminal rupture—bonus final damage, armor break, or crowd shove—worth the lock. Add a brief shared beam draw/restart lock and reduce stowed cooling so three reactors improve flexibility without deleting the heat constraint. Vary at least charge/channel/heat curves across beam families instead of making all 23 share one cadence.

**Effort:** **M**

### G-08 — Beam state lacks the feedback needed to make that decision

**Evidence:** The only continuous heat read is a muzzle circle growing from roughly 8 to 16 px (`packages/client/src/vfx/BeamRenderer.ts:262-270`). `AudioBus.play` has shot, hit, parry, loot, and boss-slam cases but no beam charge, ignition, redline, release, or overheat event (`packages/client/src/audio/AudioBus.ts:242-331`). `ArenaScene.updateBeams` (`packages/client/src/scenes/ArenaScene.ts:8514-8581`) updates visuals without routing phase audio.

**10-second player read:** During the first hold, the player cannot hear ignition or impending lock and must look at a tiny effect under the weapon amid the beam itself. Releases feel arbitrary; an overheat is learned as unexplained downtime.

**Concrete change:** Add a compact heat arc beside the crosshair/weapon dock and four phase sounds: rising charge, ignition crack, heat-pitched sustain/redline chirp, and vent/overheat. Trigger sounds on authoritative `BeamPhase` edges, with only the owner's sustain prominent. The meter should mark both restart heat and overheat, turning early vent versus commit into an informed choice.

**Effort:** **M**

### G-09 — Beam builds fall through the augment draft gate

**Evidence:** Augment delivery supports only `"gun" | "cast"` (`packages/shared/src/augments.ts:16-28,229`). `tickLevelWindows` derives the gate only from `w.gun` or `w.cast` (`packages/server/src/rooms/GameRoom.ts:3920-3927`), so a beam gets only universal parry cards. Yet caster-class beams explicitly consume Overcharge stacks in `stepPlayerBeam` (`GameRoom.ts:2783`).

**10-second player read:** A caster beam user reaches a signature level and sees no beam/caster delivery card; someone who drafted Overcharge while holding a bolt staff can swap to the same beam and gain damage. Build access depends on what was in hand when the modal opened, not the build being played.

**Concrete change:** Derive draft eligibility from class plus delivery tags, not optional behavior fields. Let caster beams draft/apply Overcharge, and add a small beam lane for capacitor capacity, faster venting, or sweep control; ranged beams should receive beam cards rather than gun-only pierce/bounce. Snapshot the eligible lane when the level is earned so a last-frame weapon swap cannot reroll build identity.

**Effort:** **M**

### G-10 — The augment draft can offer dead duplicates and a dead prerequisite card

**Evidence:** Definitions mark many augments `stacks: false`, but `draftAugments` receives no owned set and filters only by weapon kind (`packages/shared/src/augments.ts:229-241`). `chooseAugment` appends any offered id again (`packages/server/src/rooms/GameRoom.ts:1127-1141`). Duplicate Brand/Bulwark/Emberguard picks do nothing because their effects use `hasAugment`; Counterblade accidentally gains another projectile despite being non-stackable. Conflagration is offered freely, but its proc is nested inside `if (hasAugment("emberguard"))` (`GameRoom.ts:4934-4946`).

**10-second player read:** A signature card can be selected and produce no change on the very next parry. Worse, one “non-stackable” card secretly stacks while its peers do not, so card text and server rules cannot be trusted.

**Concrete change:** Pass owned augments into the draft; remove owned non-stackables, and reject duplicate non-stackables server-side. Gate Conflagration behind Emberguard or make it self-contained by granting a weak base wave when picked. If the eligible pool becomes too small, offer explicit upgrades rather than duplicate base cards.

**Effort:** **S**

### G-11 — Echo arrival plus live character switching lets players reroute class growth on demand

**Evidence:** `cycleCharacter` changes `player.character` at any time (`packages/server/src/rooms/GameRoom.ts:948-951`). `levelUpPlayer` reads `classForCharacter(player.character)` live for the two automatic points (`packages/server/src/rooms/progression.ts:35-48`), and timeout allocation reads it live again (`GameRoom.ts:3941`). The menu launches only dimension/mode data and has no committed class choice (`packages/client/src/scenes/MenuScene.ts:382-389`).

**10-second player read:** Because today's Echo visibly flies before granting XP, a player can tap C just before receipt to route auto stats into a desired class, then switch back. Character fantasy becomes timing tech, and cycling 40 bodies is a stat-allocation control.

**Concrete change:** Add a pre-run drifter/class selection and store an immutable run-class id. C may remain a cosmetic skin switch only if skins no longer determine growth. Alternatively, snapshot the class when XP is earned, but run-start commitment is clearer and supports future passives/loadouts.

**Effort:** **M**

### G-12 — The class set bonus makes off-hand weapons stat sticks and rewards camping

**Evidence:** `weaponSetBonus` grants +8%/+18% held damage for carrying two/three weapons of the same class (`packages/shared/src/weapons.ts:338-360`). `heldDamageMult` applies it passively (`packages/server/src/rooms/GameRoom.ts:1324-1333`); it does not require the other slots to be drawn or used.

**10-second player read:** Fill slots 2 and 3 with any same-class weapons, then camp the strongest weapon forever with +18% damage. The nominal arsenal choice is solved by inventory tags, and complementary melee/ranged/caster coverage is penalized.

**Concrete change:** Turn the bonus into active resonance: the 2-piece bonus comes online only after both distinct slots hit within the last six seconds; the 3-piece bonus requires all three and then decays. Keep the same numbers initially. This preserves mono-class identity while making the promised swap loop the way the player earns its power, not a reason to avoid swapping.

**Effort:** **M**

### G-13 — Today's iconic melee combos are explicitly cosmetic

**Evidence:** `packages/shared/src/melee.ts:33-35` says combo tables are inert client data while the server resolves one centered legacy sweep. The big-sword section repeats that its timing/ribbon data is presentation-only (`:513-515`). `swingDescriptorForAttackSeq` uses the global attack count and intentionally does not reset after idle or weapon swap (`:1135-1149`), while `GameRoom.resolveSwing` still uses one weapon damage/range/arc (`packages/server/src/rooms/GameRoom.ts:2515-2543`).

**10-second player read:** Falling Gate, wheel, breach, dagger lunge, and finisher poses look different but ask for the same aim, spacing, cadence, and commitment. After a swap or long pause, the next visual combo step is also arbitrary because it inherits the global attack sequence.

**Concrete change:** Ship the accepted combo epoch the comments already anticipate: server-owned weapon id, step, last-attack tick, and reset window. Consume each step's signed timing/path/range/damage/knockback on the server. Start narrowly with the four big-sword families and dagger/claw third hits: two setup attacks, then a stronger but more committed finisher that resets on whiff, delay, or swap. The art then teaches a real rhythm.

**Effort:** **L**

### G-14 — Enemy-held weapons are false tactical signals

**Evidence:** The assignment comment explicitly states `wieldsWeapon` drives only drop and in-hand rendering—“no AI change” (`packages/shared/src/enemies.ts:489-496`). Spitters fire from the enemy kind's generic `ranged` block in `GameRoom.stepSpitters` (`packages/server/src/rooms/GameRoom.ts:4301-4348`); melee uses the kind's generic/derived combo, not the visible weapon.

**10-second player read:** An enemy visibly carrying a shotgun, gatling, greatsword, or katana may still emit the same archetype shot/lunge. The player's fastest readable threat cue—the silhouette in its hands—lies, so learning the arsenal does not improve enemy reads.

**Concrete change:** Use compatibility pools immediately, then derive a lightweight attack profile from the carried weapon: shotgun → spread/short range, gatling → burst stream, greatsword → slow wide lunge, dagger → quick narrow double. Scale player values down for enemies and retain archetype movement. If that scope is too large, restrict each kind to weapons matching its existing cadence; never display a weapon whose verb will not occur.

**Effort:** **M**

### G-15 — Cover stops projectiles, but ranged AI never recognizes cover

**Evidence:** `stepSpitters` targets the nearest body and fires whenever distance is in range (`packages/server/src/rooms/GameRoom.ts:4301-4348`), with no POI line-of-sight query. Projectile simulation later absorbs/caroms shots on POIs (`GameRoom.ts:5303-5351`). Cover therefore works symmetrically in collision but only the player understands it.

**10-second player read:** Stand behind one landmark and ranged enemies repeatedly shoot the wall while melee enemies pile on its edge. Cover becomes permanent AI taxation rather than a temporary position that enemies contest.

**Concrete change:** Before firing, ray-test the current lane against compound POIs. After one or two blocked shots, choose a tangential flank point with clear sight and move there; elite ranged enemies may coordinate opposite sides. Preserve a short reaction delay so cover still buys safety, then force the squad to rotate.

**Effort:** **M**

### G-16 — The ranger's advertised punish window is missing—and in belt mode it becomes harder to hit

**Evidence:** `EnemyKind.dodge` says the payoff is catching the ranger mid-roll (`packages/shared/src/enemies.ts:124-131`). The server roll at `packages/server/src/rooms/GameRoom.ts:2297-2324` is only movement; `damageEnemy` has no exposed/recovery multiplier. Belt melee explicitly shrinks a rolling ranger's depth hurt window using `DEPTH_DODGE_MULT` (`GameRoom.ts:3308-3312`).

**10-second player read:** Closing distance triggers an escape that provides no timing reward. Swinging during the visually dramatic roll is equal in top-down and less reliable in belt, so the correct response is simply more chasing or ranged DPS.

**Concrete change:** Add a short authoritative recovery/exposed state after the roll: 1.5× posture/damage for roughly 0.35 seconds, or allow a melee intercept to cancel the roll into stagger. Sync that state for a clear paper-cutout stumble. The roll remains evasive during travel; the decision is whether to predict its endpoint and punish.

**Effort:** **M**

### G-17 — Player-authored pit kills delete progression, making the environmental verb a last resort

**Evidence:** The pit phase directly deletes every non-boss enemy over a pit and explicitly grants no XP (`packages/server/src/rooms/GameRoom.ts:2390-2402`). It bypasses `damageEnemy`, so it also skips Echoes, loot, shifter bounties, and weapon drops. Scar contains the highest pit density.

**10-second player read:** A satisfying parry knock or kite into a pit produces no Echo and no reward. Once players notice, they avoid using the map's most distinct combat verb except when overwhelmed—and Scar's extra pits become another economic downside.

**Concrete change:** Track the last player-authored impulse/damage source for a brief window. An assisted pit kill should pay about 60–70% XP as an Echo but no weapon/mystery loot; an enemy that wanders in unaided still pays nothing. This keeps pits from replacing weapon DPS while rewarding deliberate setup and parry mastery.

**Effort:** **M**

### G-18 — Shared XP removes kill competition, but there is no positive co-op combat incentive

**Evidence:** `grantXp` gives every Echo's full value to every player regardless of distance or participation (`packages/server/src/rooms/GameRoom.ts:3417-3421`), while collector selection is merely nearest-body routing (`:3600`) and all baseline enemy targeting is nearest-player (`packages/shared/src/enemies.ts:586`; GameRoom call sites `:2296`, `:4321`, `:4967`). No assist/owner ledger creates a team verb.

**10-second player read:** Two players splitting into separate farming fronts gain the same progression as fighting shoulder-to-shoulder, often with less pressure per person. Focus fire, crossfire, bodyguarding, and setting up a teammate have no baseline payoff beyond raw combined DPS.

**Concrete change:** Keep squad-shared base XP, but add a “Resonance” receipt when two different players damage the same target within two seconds: a brief stagger/exposure and a 10–15% bonus Echo on death, capped once per enemy. This rewards coordinated focus without punishing a scout or making distance-based XP feel stingy. Reuse the source ledger later for assists and co-op challenges.

**Effort:** **M**

### G-19 — Revival is free in the arena carousel and effectively unavailable in the constrained arsenal

**Evidence:** Gravedigger's Spade is the only `rez` carrier (`packages/shared/src/weapons.ts:569-586`) and `tryRez` fires from its swing (`packages/server/src/rooms/GameRoom.ts:2669-2699`). Support/rez weapons are excluded from random drops (`packages/shared/src/loot.ts:222-224`). Top-down Q/E can conjure the base roster (`GameRoom.ts:789`), but belt pickups accumulate into the real three-slot arsenal and cannot roll the Spade (`GameRoom.ts:1014-1018`).

**10-second player read:** In top-down, a knowledgeable player scrolls to a free Spade only after an ally falls, so support costs no loadout choice. In the constrained mode, a downed teammate can leave the squad with no legal recovery path at all.

**Concrete change:** Add a universal risky revive channel at a downed body—roughly 1.5 seconds, interrupted by damage. Make the Spade the premium support option: its swing revives instantly or from safer range and restores more HP. Then it can remain a deliberate non-random reward without being the sole switch that decides whether co-op continues.

**Effort:** **M**

### G-20 — One player can commit the entire squad to the deeper rift

**Evidence:** `checkDescend` says one griefer cannot yank the squad, but `holding` becomes true when **any one** living body is in range; after 1.6 seconds it starts squad-wide descent (`packages/server/src/rooms/GameRoom.ts:6077-6104`; `RIFT_CHANNEL_SECONDS` at `packages/shared/src/constants.ts:481`). Downed bodies are carried through still down (`GameRoom.ts:6038-6039`).

**10-second player read:** One teammate stands in the rift and everyone—possibly carrying salvage or lacking a rez option—is moved to the next difficulty without consent. The run's largest greed decision is owned by proximity, not the group.

**Concrete change:** Track a ready bit per living player and display portraits around the rift. Require all living players, or a clear majority plus a short uncontested grace period, before committing. Allow any living player to cancel by entering an adjacent “extract” vote zone or pressing interact. Keep the shared 1.6-second flourish only after consent is resolved.

**Effort:** **M**

### G-21 — Serraketh's anatomy trophies look collectible but are escrowed until the boss is already dead

**Evidence:** Segment breaks call `dropLockedWormXp` (`packages/server/src/rooms/GameRoom.ts:3538-3566`). Locked ids are skipped by merge, launch, and collection, and only `releaseWormXp` unlocks them on terminal core death (`:3568-3591`, collection skip at `:3846-3864`). The boss allocates up to 35 of its 110 XP to these anatomy breaks (`packages/shared/src/constants.ts:557-559`).

**10-second player read:** Break a visible segment, see an Echo trophy appear, approach it, and nothing happens. The object uses the new collectible language but cannot power the squad during the fight, so targeting anatomy offers less immediate risk/reward than it appears to.

**Concrete change:** Release segment Echoes immediately at reduced value and subtract them from the terminal core exactly as today. If mid-boss levels are considered too disruptive, let the immediate trophy grant a short squad boon—vent heat, heal a sliver, or expose the core—while its XP remains escrowed with a distinct non-collectible visual. Either rule makes the break receipt truthful and turns segment focus into encounter strategy.

**Effort:** **M**

## P2 — cheap conversions of dead hooks

### G-22 — XP Echo reach has a build hook that no player can obtain

**Evidence:** `xpMoteReach` scans for `"mote-reach"` stacks and says the id is reserved until its card lands (`packages/server/src/rooms/GameRoom.ts:3441-3452`). No such id exists in `AUGMENTS` (`packages/shared/src/augments.ts:32-155`), so every player is permanently at the 180 px baseline despite the new authoritative Reach/magnet system.

**10-second player read:** Every build collects Echoes identically; no stat or augment changes the new pickup-routing verb. A player trying to specialize as the squad collector has no lever.

**Concrete change:** Activate the hook without bloating the scarce signature pool: scale reach modestly from LUK now (for example +3% per point above 1, capped), then surface that line in the stat tooltip. Later, a utility reward can add explicit `mote-reach` stacks. This gives LUK and co-op collector positioning an immediate, understandable connection to Echoes.

**Effort:** **S**

## Recommended implementation order

1. **Integrity patch:** G-01, G-02, G-03, and G-10. These are compact server fixes that restore trust in cooldowns, parry text, loot scarcity, and drafts.
2. **Beam balance gate:** G-04, G-07, G-08, and G-09 before broadly exposing the 23 beams through live drops.
3. **Make the map a game system:** G-05 plus G-15 and G-17. Scar becomes greed, Cover becomes temporary safety, and pits become a deliberate setup verb.
4. **Convert today's animation wins into decisions:** G-06, G-13, G-14, G-16, and G-21.
5. **Co-op pass:** G-18, G-19, and G-20, with G-11/G-12 locking run identity and making the arsenal an active rotation rather than passive inventory math.
