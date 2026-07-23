# Owner Notes Ledger v9

## Method, normalization, and accounting

This is a read-only audit of all 403 records in `data/owner-notes.jsonl`: 369 weapon records and 34 game records, spanning `2026-07-20T17:17:59.444Z` through `2026-07-23T04:57:44.915Z`.

The unit counted in this ledger is a **normalized intent bundle**:

- Weapon notes are grouped by `weaponId`; separate surviving topic clauses remain in that weapon's bundle, while a later note about the same topic supersedes the earlier wording. This produces 215 weapon bundles from 369 raw weapon records. Nullspike is the one open bundle with two separate surviving clauses, and both are quoted below.
- Game notes are grouped by subsystem/topic. The two beam-anchor reports collapse to the later report; the three beam-distinction/wave/structure reports collapse to the final overall-structure request; the pistol-twirl repeat collapses to its later timing clarification; and the lever/pump follow-ups are retained as the final mechanism-language requirements. This produces 28 game bundles from 34 raw game records.
- Therefore the audit denominator is **243 normalized bundles**, not 403 raw rows. A bundle is marked DONE only when the current tree plus implementation evidence satisfies every surviving clause in it. Mixed-history bundles such as Galvanic Overcasters remain OUTSTANDING even though an earlier projectile clause is done.

Evidence was checked in this order: current data/code, current live-gate reports, Git history, then older audit declarations. A later owner observation overrides an older “closed” claim. Ambiguity stays open. The resulting split is 211 DONE/SKIP bundles and 32 OUTSTANDING bundles.

## Section A — DONE / SKIP

### A1. Game bundles already satisfied (25)

Every one of the 34 raw game records is represented either in this table or in Section B. “Rows” are one-based JSONL record numbers.

| Normalized game bundle | Raw row(s) | Disposition and current evidence |
|---|---:|---|
| Beam origin stays attached while moving | 2, 46 | **DONE.** `951fb62` is the corrective live-proven anchor implementation after `d6175ea`; `docs/sol-reports/v7-beam-structures.md` records a moving-beam muzzle delta of effectively 0 px. Current beam rendering uses the weapon muzzle/origin path. |
| Facing-symmetric locomotion and weapon-class movement posture | 8 | **DONE.** `45e7bb2` names both facing symmetry and per-class posture; current `packages/client/src/sprites/pose-language.ts` carries the posture language. |
| Melee combos do not warp the player between swings | 25 | **DONE.** `d6175ea` implements the no-warp rule; current combo progression is animation/attack sequencing rather than position correction. Later explicit movement exceptions are separately authored server movement and are audited in Section B. |
| Thrown weapons throw their own weapon | 27 | **DONE as a systemic law.** `d6175ea` established it, and `docs/sol-reports/v8-thrown-and-sniper.md` live-proves the current generated throwing-star/kunai projectiles use their own art. The three weapons whose classification/release language is still wrong are separately open in B7. |
| Beams have distinct overall structures, including non-tube forms | 30, 177, 357 | **DONE.** The last note acknowledges the inner helixes and asks for overall silhouette variation. `bd07261` plus `docs/sol-reports/v7-beam-structures.md` assign five structural families across all 22 beam definitions and live-gate them with VFX enabled. |
| Glove weapons replace hands instead of overlaying them | 50 | **DONE.** `951fb62`; current glove-pair rendering and `packages/client/src/entities/SpriteRig.glove-pair.test.ts` cover replacement/paired presentation. |
| Dual pistols use visibly staggered hands | 132 | **DONE.** `8a49904`; current dual-wield pose logic and `SpriteRig.dualwield.test.ts` retain the stagger. |
| Pistol twirl after firing stops, including dual wield | 133, 202 | **DONE.** The later note sets the delay to about 0.5 s. `4141c54` live-proved the flourish, and `packages/client/src/sprites/pose-language.flourish.test.ts` covers current timing/language. |
| Lever-action hand placement and down/up cycling | 156 | **DONE.** `8a49904`, refined and live-gated by `bd07261`; see `docs/sol-reports/v7-hands-affine.md`. |
| Shotgun stock/trigger/pump placement and back/forward pump cycle | 164, 199, 338 | **DONE.** `8a49904`, `4141c54`, and the accepted-shot mechanism pass in `bd07261`; `docs/sol-reports/v7-hands-affine.md` distinguishes pump back/forward from lever down/up. |
| Add auto rifles with foregrips | 166 | **DONE.** `5141040` adds three foregrip auto rifles. |
| Foregripped guns are held by the foregrip, not the magazine | 217 | **DONE.** `4141c54` and `bd07261`; live evidence is summarized in `docs/sol-reports/v7-hands-affine.md`. |
| Reduce player-weapon screen shake by 95% | 221 | **DONE.** `f738040`; current shake scaling is covered by the v5 systemic tests/audit in `docs/owner-notes-audit-2026-07-21-v5.md`. |
| Character-spawned offensive VFX belongs at cursor impact within radius | 253 | **DONE with the owner's later clarification.** `f738040` made the sweep; `811d158` then removed 64 vestigial cursor effects and made the law conditional so legitimate self-auras remain self-anchored. See v6.3 in `docs/owner-notes-audit-2026-07-21-v6.md`. |
| Bespoke generated slash VFX for every katana | 309 | **DONE.** `ee27031`; current generated treatments and the v6 audit enumerate the katana art program. |
| Forward-pointed staves use two hands, one farther up-shaft | 318 | **DONE.** `ee27031`; current grip data and `tests/owner-notes-weapon-pose.test.ts` carry the rule. |
| Remove immersion-breaking simple geometry from VFX | 320 | **DONE for the audited catalog.** `ee27031` performs the geometry purge and `811d158` corrects its anchoring side effects; current recipes live in `packages/client/src/vfx/weapon-vfx.generated.ts`. |
| Generated muzzle-flash variations on guns | 323 | **DONE.** `ee27031` adds the generated flash program; current muzzle metadata is in `packages/shared/src/weapon-muzzles.generated.ts`. |
| Special effects default to generated-image art | 326 | **SKIP as a standing production law, not a remaining code change.** Subsequent art programs follow it (`ee27031`, `bd07261`, `docs/sol-reports/ranged-orders.md`). All new-art batches below explicitly split one image subject per art Sol. |
| Various throwing stars as weapons | 329 | **DONE.** `f1f56a6`; `docs/sol-reports/v8-thrown-and-sniper.md` records four stars plus a kunai, own-sprite projectiles, and live gates. |
| A distinct moveset for every katana | 359 | **DONE.** `c072111`; `docs/sol-reports/v7-katana-bespoke.md` proves 14 distinct choreography signatures with VFX disabled while retaining rest stances. Voltedge's later, specific stab order is a new override and remains open in B8. |
| VFX collision damages enemies, including extended blades | 366 | **DONE systemically.** `4662c4a` adds the VFX/hit-envelope law and `852d9d0` unifies extended blades; `docs/sol-reports/v7-hit-system.md` and `e2e/tests/v7-blade-extension-live-gate.spec.ts` are the evidence. Removing Headsman's extension is a later exception in B10. |
| Fixed-distance quick tumbly dodge roll with cooldown | 368 | **DONE.** `1e97c9a`; `docs/sol-reports/v7-move-tumble-longjump.md` records the 188 px/400 ms fixed roll, full tumble, and delay. |
| Long jump replaces default jump with no activation delay | 369 | **DONE.** `1e97c9a`; the same movement report records the immediate long-jump gate. |
| Bolt-action .50-cal Barrett-style sniper rifle | 384 | **DONE.** `3478ab6` adds the bolt-cycle family and new .50-cal Barrett; `f1f56a6` also lands the M-50 sniper. See `docs/sol-reports/v8-bolt-action.md` and `docs/sol-reports/v8-thrown-and-sniper.md`. |

### A2. Weapon bundles already satisfied (186)

The following are closure rosters, not name-only assumptions. Each roster's evidence applies to every listed bundle: the cited audit maps the underlying note(s), the cited commit implements that wave, and the weapon remains present with authored fields in `data/weapon-concepts-300.json` or `packages/shared/src/weapons.ts` and the current generated catalog `packages/shared/src/weapons-expansion.generated.ts`. No later note reopens these bundles.

**Wave 1 — 11 DONE.** Evidence: `docs/owner-notes-audit-2026-07-20.md`, commits `52a5ca1` and `8dd2fc9` (with systemic prerequisites in `d6175ea`).

Riftglass Prism-Lantern (`x2-riftglass-prism-lantern`); Emberleaf Chapbook (`x2-emberleaf-chapbook`); Gravewax Seance-Globe (`x2-gravewax-seance-globe`); Rotgrove Totem (`x2-rotgrove-totem`); Throne-of-Ash Coal-Scepter (`x2-throne-of-ash-coal-scepter`); Verdict Longsword (`x2-verdict-longsword`); Gallows Splitter (`x2-gallows-splitter`); Tallowtongue Pyre-Stave (`x2-tallowtongue-pyre-stave`); Dustdevil Whirlbits (`x2-dustdevil-whirlbits`); Choir-Iron Greataxe (`x2-choir-iron-greataxe`); Saloon Tomahawk (`x2-saloon-tomahawk`).

**Wave 2 — 18 DONE.** Evidence: `docs/owner-notes-audit-2026-07-20-v2.md`, commits `32a3ae2` and `90966f7` (system fixes in `951fb62`).

Permafrost Cryo-Bracer (`x2-permafrost-cryo-bracer`); Frostknuckle Rimewrap (`x2-frostknuckle-rimewrap`); Voidwell Idol (`x2-voidwell-idol`); Spitfire Censer-Wand (`x2-spitfire-censer-wand`); Gravewax Twin Idols (`x2-gravewax-twin-idols`); Marshlight Bog-Censer Wand (`x2-marshlight-bog-censer-wand`); Permafrost Bardiche (`x2-permafrost-bardiche`); Riftcleaver Greatblade (`x2-riftcleaver-greatblade`); Quicksilver Skinning Cleaver (`x2-quicksilver-skinning-cleaver`); Glacier Headtaker (`x2-glacier-headtaker`); Boothill Hatchet (`x2-boothill-hatchet`); Hollowmoon Reaver (`x2-hollowmoon-reaver`); Cogwright's Tesla-Rod (`x2-cogwright-s-tesla-rod`); Moonwake Great Katana (`drift-greatkatana-moonwake`); Quicksilver Censer (`x2-quicksilver-censer`); Carrion Cudgel (`x2-carrion-cudgel`); Venomtongue Trident (`x2-venomtongue-trident`); Buckhorn Boarspear (`x2-buckhorn-boarspear`).

**Wave 3 — 32 DONE.** Evidence: `docs/owner-notes-audit-2026-07-20-v3.md`, commits `8a49904`, `8f3d939`, and `5141040`.

Coffin-Nail Rosary Orb (`x2-coffin-nail-rosary-orb`); Witherleaf Bestiary (`x2-witherleaf-bestiary`); Hailshard Resonator (`x2-hailshard-resonator`); Snakeoil Tincture Scepter (`x2-snakeoil-tincture-scepter`); Carrion Roost Necro-Scepter (`x2-carrion-roost-necro-scepter`); Vagrant's Wishing Marble (`x2-vagrant-s-wishing-marble`); Carrion Effigy (`x2-carrion-effigy`); Anvil-Heart Quake Maul-Staff (`x2-anvil-heart-quake-maul-staff`); Quarry-Splitter Bardiche (`x2-quarry-splitter-bardiche`); Blightfork Glaive (`x2-blightfork-glaive`); Stillwater Edict (`drift-katana-stillwater-edict`); Pale Horizon Nodachi (`drift-nodachi-pale-horizon`); Wickfire Fauchard (`x2-wickfire-fauchard`); Gatling (`x-gun-gatling`); Cinderquill Dart-Caster (`x2-cinderquill-dart-caster`); Embernail Repeater (`x2-embernail-repeater`); Spore-Spitter Blunderbuss (`x2-spore-spitter-blunderbuss`); Hailshot Hand-Maul (`x2-hailshot-hand-maul`); Grave-Anchor Harpoon (`x2-grave-anchor-harpoon`); Boneyard Ricochet Mortar (`x2-boneyard-ricochet-mortar`); Snakebite Dart-Slinger (`x2-snakebite-dart-slinger`); Brimstone Bull (`x2-brimstone-bull`); Reliquary Nailcaster (`x2-reliquary-nailcaster`); Thunderhead Spikecaster (`x2-thunderhead-spikecaster`); Scattershell Duster (`x2-scattershell-duster`); Boneash Scattergun-Rifle (`x2-boneash-scattergun-rifle`); Venomspine Repeater (`x2-venomspine-repeater`); Hallowbore Coachgun (`x2-hallowbore-coachgun`); Frostbore Scattergun (`x2-frostbore-scattergun`); Ashfall Peacemaker (`x2-ashfall-peacemaker`); Buckshot Briar (`x2-buckshot-briar`); Carom Coachgun (`x2-carom-coachgun`).

**Wave 4 — 26 DONE.** Evidence: `docs/owner-notes-audit-2026-07-21-v4.md`, commits `4141c54` and `a9f3e56`.

Voltvein Conductors (`x2-voltvein-conductors`); Cairn of Hollow Names (`x2-cairn-of-hollow-names`); Gravesinger's Hex-Wand (`x2-gravesinger-s-hex-wand`); Bogwater Twinbits (`x2-bogwater-twinbits`); Thunderhoof Splittingaxe (`x2-thunderhoof-splittingaxe`); Riftstep Katana (`drift-katana-riftstep`); Godsbone Pillar (`x2-godsbone-pillar`); Mistral Kusarigama (`x2-mistral-kusarigama`); Snakebite Lash (`x2-snakebite-lash`); Ferrous Serpent (`x2-ferrous-serpent`); Dust-Devil Flail (`x2-dust-devil-flail`); Locust Flail (`x2-locust-flail`); Nine-Tail Razorlash (`x2-nine-tail-razorlash`); Widowmaker Wrecking-Ball (`x2-widowmaker-wrecking-ball`); Hollowpoint Hex (`x2-hollowpoint-hex`); Quicksilver Fanner (`x2-quicksilver-fanner`); Tumbleweed Skipper (`x2-tumbleweed-skipper`); Dustdevil Riotgun (`x2-dustdevil-riotgun`); Mirage Coilrifle (`x2-mirage-coilrifle`); Widowmaker Cannon (`x2-widowmaker-cannon`); Buckshot Avalanche (`x2-buckshot-avalanche`); Doomsday Drum Cannon (`x2-doomsday-drum-cannon`); Voltcaster Machine Pistol (`x2-voltcaster-machine-pistol`); Coyote Stinger (`x2-coyote-stinger`); Whisperbarb Hand-Crossbow (`x2-whisperbarb-hand-crossbow`); Buckshot Bramble Bow (`x2-buckshot-bramble-bow`).

**Wave 5 — 33 DONE.** Evidence: `docs/owner-notes-audit-2026-07-21-v5.md`, commits `f738040` and `c4532ef`.

Galvanic Liber of Storms (`x2-galvanic-liber-of-storms`); Frostbite Snowglobe (`x2-frostbite-snowglobe`); Cinderchoke Brazier-Orb (`x2-cinderchoke-brazier-orb`); Locust-Glass Plague-Orb (`x2-locust-glass-plague-orb`); Gilded Hourglass Frost Scepter (`x2-gilded-hourglass-frost-scepter`); Sporebound Witchglobe (`x2-sporebound-witchglobe`); Saintskull Monstrance (`x2-saintskull-monstrance`); Reverent Broadsword (`x2-reverent-broadsword`); Tombwarden Claymore (`x2-tombwarden-claymore`); Hangman's Greatcleaver (`x2-hangman-s-greatcleaver`); Voltfang Tachi (`x2-voltfang-tachi`); Stormcaller Rod (`x-staff-storm-rod`); Frostfang Rakes (`x2-frostfang-rakes`); Gravechain Scythe (`x2-gravechain-scythe`); Quicksilver Chainblade (`x2-quicksilver-chainblade`); Iron Vow Bearded Axe (`x2-iron-vow-bearded-axe`); Reliquary Halberd (`x2-reliquary-halberd`); Frostgig Harpoon (`x2-frostgig-harpoon`); Marrowpike Ranseur (`x2-marrowpike-ranseur`); Cinderbrand Pike (`x2-cinderbrand-pike`); Anvil-Drop (`x2-anvil-drop`); Hexbloom Rapier (`x2-hexbloom-rapier`); Sunlance Javelin-Pike (`x2-sunlance-javelin-pike`); Widowmaker Arbalest (`x2-widowmaker-arbalest`); Gravedog Auto-Rifle (`x2-gravedog-auto-rifle`); Stormspur Coil Carbine (`x2-stormspur-coil-carbine`); Quill Storm Repeater (`x2-quill-storm-repeater`); Hand Mortar (`x-gun-hand-mortar`); Leviathan Harpoon Gun (`x2-leviathan-harpoon-gun`); Permafrost Siege Lobber (`x2-permafrost-siege-lobber`); Mauler Slug-Thrower (`x2-mauler-slug-thrower`); Hellbore Gatling (`x2-hellbore-gatling`); Graveshot Grenade Gun (`x2-graveshot-grenade-gun`).

**Wave 6 — 37 DONE.** Evidence: `docs/owner-notes-audit-2026-07-21-v6.md`, commits `ee27031`, `00b025a`, and corrective commit `811d158`. Brimstone Gallows-Rifle is deliberately excluded here and counted in the later ranged closure roster because its latest order landed there.

Glasswidow Hexweave (`x2-glasswidow-hexweave`); Abyssal Apocrypha (`x2-abyssal-apocrypha`); Hexbloom Scattergrimoire (`x2-hexbloom-scattergrimoire`); Null Grimoire of the Hollow Page (`x2-null-grimoire-of-the-hollow-page`); Glyphward Manuscript (`x2-glyphward-manuscript`); Dust-Devil Cyclone Orb (`x2-dust-devil-cyclone-orb`); Seraph's Knuckle-Reliquary (`x2-seraph-s-knuckle-reliquary`); Pyreclap Mauler (`x2-pyreclap-mauler`); Hexbolt Spitter-Mitt (`x2-hexbolt-spitter-mitt`); Hexpost Charm-Pole (`x2-hexpost-charm-pole`); Twin Whispervolumes (`x2-twin-whispervolumes`); Thunderpost Fetish (`x2-thunderpost-fetish`); Cinderbrand Cleaver (`x2-cinderbrand-cleaver`); Coilshot Meteor (`x2-coilshot-meteor`); Hollow Harvest (`x2-hollow-harvest`); Hailspur Sickle (`x2-hailspur-sickle`); Dustdevil Glaive (`x2-dustdevil-glaive`); Kagewake (`drift-wakizashi-kagewake`); Cinderfang Wakizashi Pair (`x2-cinderfang-wakizashi-pair`); Snakebite Morningstar (`x2-snakebite-morningstar`); Sermon Bell (`x2-sermon-bell`); Revenant Knuckle (`x2-revenant-knuckle`); Stormthread Tachi (`drift-katana-stormthread`); Saintspar Lochaber (`x2-saintspar-lochaber`); Reaper's Tithe (`x2-reaper-s-tithe`); Verdigris Grand Grimoire (`x2-verdigris-grand-grimoire`); Wendigo Claws (`x2-wendigo-claws`); Rimethorn Naginata (`x2-rimethorn-naginata`); Galvanic Lancepole (`x2-galvanic-lancepole`); Riftcaller Naginata (`x2-riftcaller-naginata`); Coyote's Grin (`x2-coyote-s-grin`); Drowned Anchor (`x-sword-anchor`); Rusty Cleaver (`rusty-cleaver`); Hangman's Gavel (`x2-hangman-s-gavel`); Ghostbolt Crossbow (`x2-ghostbolt-crossbow`); Calamity Howitzer (`x2-calamity-howitzer`); Tidehook Bombarpoon (`x2-tidehook-bombarpoon`).

**Late ranged backlog — 22 DONE.** Evidence: commit `2dcbb4d` and `docs/sol-reports/ranged-orders.md`, including its catalog, server, and live visual gates.

Gravelthroat Repeater (`x2-gravelthroat-repeater`); Plaguespitter Flak Gun (`x2-plaguespitter-flak-gun`); Brimstone Gallows-Rifle (`x2-brimstone-gallows-rifle`); Brimstone Rocket Tube (`x2-brimstone-rocket-tube`); Mesa Hand-Cannon (`x2-mesa-hand-cannon`); Tesla Faradayer (`x2-tesla-faradayer`); Sanctus Siege Bombard (`x2-sanctus-siege-bombard`); Stormcaller Tesla Gatling (`x2-stormcaller-tesla-gatling`); Sidewinder Spitfire (`x2-sidewinder-spitfire`); Gravelung Punt-Rifle (`x2-gravelung-punt-rifle`); Ironhide Buffalo Gun (`x2-ironhide-buffalo-gun`); Galvanic Coachgun (`x2-galvanic-coachgun`); Ricochet Pistol (`x-gun-ricochet-pistol`); Hailspitter Pepperbox (`x2-hailspitter-pepperbox`); Dustline Lever-Action (`x2-dustline-lever-action`); Hexbore Voidmaw (`x2-hexbore-voidmaw`); Tesla Drumbore (`x2-tesla-drumbore`); Frostfang Speargun (`x2-frostfang-speargun`); Thunderhead Lever-Gun (`x2-thunderhead-lever-gun`); Thunderhead Repeater Cannon (`x2-thunderhead-repeater-cannon`); Ironhail Pepperbox (`x2-ironhail-pepperbox`); Hailstorm Coilgun (`x2-hailstorm-coilgun`).

**Late specialist closures — 3 DONE.** Frostquill Compendium (`x2-frostquill-compendium`) is current in the five-family beam implementation (`bd07261`, `docs/sol-reports/v7-beam-structures.md`); Coyote Trickster's Sparkmitt (`x2-coyote-trickster-s-sparkmitt`) is current in the glove-pair implementation (`4662c4a`, `docs/sol-reports/v7-glove.md`); Hailwidow Katana (`x2-hailwidow-katana`) is current in the bespoke-katana pass (`c072111`, `docs/sol-reports/v7-katana-bespoke.md`), including its 1.5x order.

**Regression closures — 2 DONE.** Wyrmtooth (`x-sword-bone`) and Buzzard's Burnout (`x2-buzzard-s-burnout`) are restored by `bcb8e3e`; `docs/sol-reports/v8-regressions-repeats.md` supplies their current VFX/live evidence. This call does **not** extend to the Overcasters portion of that commit, which was reverted in `324a240`.

**Bolt-action/dual-lever closures — 2 DONE.** Sidewinder Twin-Rifles (`x2-sidewinder-twin-rifles`) and Tracer-Saint Carbine (`x2-tracer-saint-carbine`) are implemented in `3478ab6`; see `docs/sol-reports/v8-bolt-action.md`.

## Section B — OUTSTANDING

There are 3 outstanding game bundles followed by 29 outstanding weapon bundles. This ordering intentionally keeps every game request ahead of weapon work. Within the weapon portion, correctness/position bugs precede content tweaks. All quoted note text below is verbatim.

### B1 — Game correctness: screen-true damage numbers and projectile facing

**Exact note**

- `2026-07-23T04:19:30.398Z` — game: “damage numbers still face the wrong way on many hits, same with a few sprites like the holy skull will be upside down if shot to the left”

**Why open / concrete change.** Current `damage-numbers.transform.test.ts` proves a helper in isolation, but the later live report shows the real parent-camera transform chain is not covered. `projectile-factory.ts` applies the travel angle directly; a left-moving asymmetric sprite can therefore receive a π rotation and appear upside down. Keep damage text screen-upright in the actual world/camera/container chain. For directional projectile art, preserve its authored upright axis and use horizontal facing/mirroring (or an art-specific facing mode) instead of blindly rotating asymmetric sprites through π. Audit at least the holy skull plus every projectile flagged asymmetric in the projectile manifest.

**Likely ownership/files.** `packages/client/src/ui/damage-numbers.ts`, `packages/client/src/ui/damage-numbers.transform.test.ts`, `packages/client/src/vfx/screen-true-transform.ts`, `packages/client/src/scenes/arena/projectile-factory.ts`, `packages/client/src/sprites/projectile-manifest.ts`, and an Arena live-gate spec. Client-rendering-only; no weapon catalog.

**Generated art:** No.

**Acceptance signal.** A new live gate captures right- and left-fired holy skulls plus damage numbers under camera pan/zoom and nested container transforms: text baselines are upright in screen space and both skulls have the same “top,” while projectile velocity still points correctly. Unit coverage must exercise the actual parent transform chain, not only the helper.

### B2 — New game family: seven wacky weapons

**Exact note**

- `2026-07-22T21:14:34.713Z` — game: “Need unicorn rainbow beam weapon; and any other wacky staple from video games. do some research. include like 7 of them”

**Concrete change.** Ship at least seven active, obtainable weapons total: (1) Unicorn Rainbow Beam, (2) fish launcher, (3) rubber-chicken flail, (4) exploding-present lobber, (5) bubble-wand swarm caster, (6) boomerang boot, and (7) confetti cannon. These are trope-level concepts, not copies of branded weapons. Each needs a distinct behavior signature, projectile/effect language, tags, balance entry, own held/projectile art where applicable, and no reuse that makes the seven feel like palette swaps. The rainbow beam must use the already-correct anchored beam path and a distinct broad/ribbon silhouette.

**Likely ownership/files.** One catalog integrator owns `data/weapon-concepts-300.json`, the relevant generator, `packages/shared/src/weapons-expansion.generated.ts`, weapon tags/drop/shop pools, `packages/shared/src/weapon-muzzles.generated.ts`, `packages/client/src/sprites/manifest.ts`, `packages/client/src/sprites/projectile-manifest.ts`, `packages/client/src/vfx/weapon-vfx.generated.ts`, `packages/client/src/vfx/weapon-vfx-suite.ts`, and catalog/server/live tests.

**Generated art:** **YES — seven subjects.** Use seven art-only Sols, exactly one weapon subject each. The catalog integrator consumes their validated transparent assets; it does not ask any art Sol for a sheet containing multiple weapons.

**Acceptance signal.** A catalog gate finds seven new non-archived IDs and seven distinct behavior signatures; an asset gate proves every referenced texture exists and has visible alpha bounds; a live gallery fires each weapon left/right while moving. The rainbow beam remains muzzle-anchored, and no two weapons share the same mechanical plus visual signature.

### B3 — New game family: fan melee/projectile hybrids

**Exact note**

- `2026-07-23T04:57:44.915Z` — game: “need Fan weapons, melee projectile hybrids”

**Concrete change.** “Weapons” is plural, so ship a minimum three-weapon family: an iron war fan whose combo finisher emits a cutting gust, an ember fan whose close sweep releases a short cinder-blade cone, and a storm fan whose crossed-fan melee strike launches a narrow returning arc. Every member must deal authoritative melee damage at close range and also create its own authoritative projectile during the same authored combo; the projectile is not a cosmetic hit.

**Likely ownership/files.** One catalog integrator owns the same catalog/generator/manifest surfaces as B2 plus `packages/server/src/rooms/GameRoom.ts`, shared melee/combo definitions in `packages/shared/src/weapons.ts`, `packages/client/src/entities/SpriteRig.ts`, pose-language tests, hit-envelope tests, and a live hybrid gate.

**Generated art:** **YES — three subjects.** One fan weapon per art-only Sol. Do not combine the family into one generation request.

**Acceptance signal.** Three obtainable fan IDs each pass a live gate demonstrating close melee collision and a separately observable, own-art projectile hit on the same combo. Left/right pose and projectile facing must pass B1's screen-truth rule.

### B4 — Weapon correctness: Galvanic Overcasters moving-fire regression

**Exact note**

- `2026-07-22T20:11:40.781Z` — **Galvanic Overcasters** (`x2-galvanic-overcasters`): “character movement and bullet origins go crazy when you continuously fire and walk at the same time”

**Why open / concrete change.** This is not closed by `bcb8e3e`: its client recoil/prediction portion was reverted in `324a240`. `a1ed5cb` intentionally fixes only projectile muzzle continuity. `docs/sol-reports/v8-overcasters-redo.md` says **NOT SHIPPED** for the character side and records the unchanged-character gates as red, including a rig/authority delta around `444 > 80`. Preserve the projectile-only fix; isolate predicted recoil from authoritative locomotion/remote interpolation so continuous burst fire never displaces or vibrates the character or causes later muzzle samples to detach.

**Likely ownership/files.** `packages/client/src/net/prediction.ts`, `packages/client/src/net/prediction.test.ts`, Arena remote/local interpolation and muzzle sampling, `packages/server/src/rooms/GameRoom.ts`, `GameRoom.v7-overcasters.test.ts`, and `e2e/tests/burst-origin-moving.spec.ts`. Avoid catalog changes unless a truly necessary recoil datum is proven.

**Generated art:** No.

**Acceptance signal.** Re-run the current Overcasters redo thresholds and make all red character-side gates green: local and remote rigs remain bounded against authority while walking in both directions through sustained bursts, no one-frame snap/vibration occurs, and every shot remains at the correct moving muzzle. Test both low and induced-latency sessions.

### B5 — Weapon correctness: attack-authored root movement

**Exact notes**

- `2026-07-22T20:43:31.180Z` — **Thunderhead Stormfists** (`x2-thunderhead-stormfists`): “the movement should be a scripted dash, twice as fast and the punch/impact at the destination”
- `2026-07-23T03:40:34.395Z` — **Sparkknuckle Hex-Mitt** (`x2-sparkknuckle-hex-mitt`): “there is some weird movement baked into the attacks. Screws up player position during and after attacks. Please remove the weird movements. Animations are good though”

**Concrete change.** Split the two policies explicitly. Sparkknuckle currently has an authored `forwardDrift` that `GameRoom.ts` turns into a weapon lunge; delete that movement while retaining the approved glove combo animation and VFX. Stormfists currently has a very fast long lunge, but its impact is not explicitly destination-bound: implement a server-authored, collision-safe dash at twice the current intended traversal speed, resolve the punch/hit/VFX at the legal destination, and preserve its existing iframe contract. Do not make either result a client animation that rewrites authority.

**Likely ownership/files.** `data/weapon-concepts-300.json`, `packages/shared/src/weapons-expansion.generated.ts`, generator input/output, `packages/server/src/rooms/GameRoom.ts`, weapon-lunge/melee tests, `packages/client/src/entities/SpriteRig.ts`, glove-pair/combo tests, and a focused live dash-position gate.

**Generated art:** No.

**Acceptance signal.** Sparkknuckle's authoritative start/end position is unchanged by a stationary full combo and remains ordinary locomotion-only while moving; its animation frames are visually unchanged. Stormfists reaches the collision-clamped destination in half the pre-change traversal time, takes no transit damage during the authored iframe window, and applies punch damage/VFX once at the endpoint—not along the path or at the origin.

### B6 — Weapon catalog maintenance: archives

**Exact notes**

- `2026-07-21T21:27:41.508Z` — **Coffin-Nail Carbine** (`x2-coffin-nail-carbine`): “archive this weapon”
- `2026-07-22T02:26:07.269Z` — **Psalter of the Burning Halo** (`x2-psalter-of-the-burning-halo`): “archive weapon”

**Why open / concrete change.** Both IDs still appear as active generated entries; the consolidated `docs/owner-notes-audit-2026-07-23-WEAPON-BACKLOG.md` explicitly lists these two archive orders as unrun. Mark them through the existing archive mechanism, remove them from new drops/shop/selection pools, and preserve load/migration safety for inventories or saves that already reference the IDs.

**Likely ownership/files.** `data/weapon-concepts-300.json`, catalog generator/output, archive filter in `packages/shared/src/weapons.ts`, loot/shop/pool tests, and save/load migration tests.

**Generated art:** No.

**Acceptance signal.** Both IDs are absent from all new acquisition/roll pools, remain resolvable for an existing-save fixture without crash or silent substitution, and an archive census gate reports exactly these intended state changes.

### B7 — Weapon conversions: thrown classification and release language

**Exact notes**

- `2026-07-21T21:21:50.486Z` — **Sidewinder Spontoon** (`x2-sidewinder-spontoon`): “Thrown weapon”
- `2026-07-22T00:34:22.409Z` — **Boothook Harpoon** (`x2-boothook-harpoon`): “throw over the shoulder”
- `2026-07-23T04:21:42.854Z` — **Stormcrow Twin-Hatchets** (`x2-stormcrow-twin-hatchets`): “these are throwing weapons”

**Why open / concrete change.** Sidewinder is still catalogued as `edge`; Stormcrow is still `chainLightning`; Boothook is thrown but lacks an explicit over-shoulder release performance. Convert the first two to authoritative own-sprite thrown behaviors without losing intended special effects, and add an over-shoulder wind-up/release pose for Boothook. Preserve Boothook's earlier no-spin projectile requirement and its current speed.

**Likely ownership/files.** `data/weapon-concepts-300.json`, `packages/shared/src/weapons-expansion.generated.ts`, thrown behavior/types in `packages/shared/src/weapons.ts`, `packages/server/src/rooms/GameRoom.ts`, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/scenes/arena/projectile-factory.ts`, `packages/client/src/sprites/projectile-manifest.ts`, and thrown-own-sprite/live tests.

**Generated art:** No; reuse each weapon's existing held art as its projectile subject.

**Acceptance signal.** Catalog tests report thrown delivery for all three. A live gate shows the actual Spontoon and both actual hatchets leave the hand and deal projectile damage; Boothook releases from behind/over the shoulder, flies point-forward without spin, and remote clients see the same timing/pose.

### B8 — Weapon pose, grip, and combo language

**Exact notes**

- `2026-07-21T21:21:31.219Z` — **Gravewarden Buster** (`gravediggers-spade`): “Make this animation continuous and smooth like a beyblade”
- `2026-07-22T02:27:18.447Z` — **Saint-Bough Frost Crozier** (`x2-saint-bough-frost-crozier`): “Held upright in 1 hand like a walking staff, walking staff animation. If we dont have one make one”
- `2026-07-22T02:30:21.180Z` — **Nullspike Pike** (`x2-nullspike-pike`): “the farther hand should a little bit closer (on top of the purple bandages in the midpoint)”
- `2026-07-22T02:30:43.371Z` — **Nullspike Pike** (`x2-nullspike-pike`): “also, 3 hit combo. Look similar to what xin zhao's Q does in LoL”
- `2026-07-22T21:13:38.501Z` — **Voltedge** (`x-sword-neon-katana`): “held near the ears, blade facing upwards, stab position. Attack is a stab”
- `2026-07-22T22:49:18.958Z` — **Sunbreaker Railgun** (`x2-sunbreaker-railgun`): “hand on barrel should be closer, on the horizontal grip right before the barrel”
- `2026-07-23T03:41:22.450Z` — **Fool's Gold Revolver** (`x2-fool-s-gold-revolver`): “hand closer to the trigger”
- `2026-07-23T04:20:32.525Z` — **Hollowbarrel Spell-Scattergun Staff** (`x2-hollowbarrel-spell-scattergun-staff`): “This is a horn, held to face to shoot.”

**Concrete change.**

- Gravewarden: replace the reset-prone/frontflip presentation with a continuous, fixed-rate full-body/weapon spin while held, keeping its buster-sword identity and existing attack coverage.
- Saint-Bough: author a one-hand upright walking-staff idle and matching locomotion language; do not inherit the generic two-hand forward staff pose.
- Nullspike: move the secondary shaft grip inward onto the midpoint purple wrap and author a readable three-thrust progression (short setup, driving second thrust, empowered third thrust) inspired only at the move-language level—no copied names/assets.
- Voltedge: its current `side-cut`, `wave-cut`, `lunge` choreography is superseded. Give it the requested near-ear, blade-up ready pose and a stab attack while retaining the already-approved katana rest-style quality.
- Sunbreaker: add explicit grip points so the support hand is on the horizontal foregrip immediately before the barrels.
- Fool's Gold: move the primary grip/hand to the trigger rather than the generic pistol fraction.
- Hollowbarrel: keep the already-correct spout emitter/recoil, but classify its pose as a horn raised to the face, with hands placed for playing/aiming rather than a generic forward staff.

**Likely ownership/files.** One pose-language Sol owns `packages/shared/src/weapons.ts`, `data/weapon-concepts-300.json`, regenerated `packages/shared/src/weapons-expansion.generated.ts`, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/sprites/pose-language.ts`, combo/pose tests, `tests/owner-notes-weapon-pose.test.ts`, and one live pose/combo gallery. This batch is intentionally isolated from VFX recipes.

**Generated art:** No.

**Acceptance signal.** A live left/right gallery with VFX disabled shows all seven weapons' requested holds and actions; grip markers land on the actual painted handles/trigger/wrap/foregrip; Gravewarden has no seam at its loop point; Nullspike produces exactly three distinct authoritative hits; Voltedge's attack hit envelope follows the stab rather than the old side/wave cuts.

### B9 — Weapon visual size and image orientation

**Exact notes**

- `2026-07-22T02:34:13.854Z` — **Idol of the Pale Verdict** (`x2-idol-of-the-pale-verdict`): “increase size by 1.4x”
- `2026-07-22T03:36:54.871Z` — **Dervish Greatblade** (`x-sword-whirlwind`): “sword twice as big”
- `2026-07-22T03:39:31.009Z` — **Mournveil Scythe** (`x2-mournveil-scythe`): “weapon 1.3x big”
- `2026-07-23T03:39:25.892Z` — **Prismhex Diffraction Gauntlet** (`x2-prismhex-diffraction-gauntlet`): “upside down, thumb is where the pinky is. Just mirror the weapon image”
- `2026-07-23T03:41:08.387Z` — **Gravewind Rimfire** (`x2-gravewind-rimfire`): “increase gun size x2”

**Concrete change.** Apply visual length multipliers from the current tree: Idol `148 -> 207.2` (or the generator's documented deterministic rounding), Dervish `118 -> 236`, Mournveil `280 -> 364`, and Gravewind `54 -> 108`. These are presentation-size orders; do not silently multiply damage, fire range, or collision reach. Correct Prismhex by a stable horizontal image mirror/facing datum so the painted thumb aligns with the rig hand on both facings; do not regenerate a “similar” gauntlet.

**Likely ownership/files.** `packages/shared/src/weapons.ts`, `data/weapon-concepts-300.json`, generated catalog, sprite/facing metadata in `packages/client/src/sprites/manifest.ts` or `SpriteRig.ts`, asset-dimension and pose tests. No VFX recipe ownership.

**Generated art:** No.

**Acceptance signal.** Exact catalog assertions prove all four multipliers and unchanged gameplay range/damage. A live before/after measurement proves visual bounding-box ratios within 1%; Prismhex's thumb/pinky relationship is correct on both left and right without becoming upside down.

### B10 — Weapon VFX cleanup/reuse

**Exact notes**

- `2026-07-22T00:31:55.614Z` — **Fulgurite Storm-Sphere** (`x2-fulgurite-storm-sphere`): “the VFX should be blue, fill in the dead space between the VFX and the player with more VFX”
- `2026-07-22T02:23:39.254Z` — **Tombstone Greatsword** (`tombstone-greatsword`): “just the stones and the smoke, take away the bone VFX particles”
- `2026-07-22T02:29:21.116Z` — **Thunderhead Voulge** (`x2-thunderhead-voulge`): “VFX should be blue, increase VFX size but a  ton”
- `2026-07-23T04:24:15.503Z` — **Sanctified Headsman** (`x2-sanctified-headsman`): “Take away this swords VFX. This one in particular just doesnt work with the extendo-blade mechanic”

**Concrete change.** Recompose Fulgurite from its existing generated blue art so coverage visibly connects the owner to the outer damaging aura, with no dead annulus. Scale/tint Thunderhead Voulge's existing generated electrical art to a clearly large blue treatment whose extent matches its damage envelope. Remove only bone particles from Tombstone, preserving stones and smoke. For Sanctified Headsman, remove the recipe, extension visual treatment, extension-only hit-envelope override, and extension ignition hooks; retain normal sword animation and ordinary blade damage.

**Likely ownership/files.** `data/weapon-concepts-300.json`, generated catalog, `packages/client/src/vfx/weapon-vfx.generated.ts`, `packages/client/src/vfx/weapon-vfx-suite.ts`, `packages/client/src/vfx/blade-extension-treatments.ts`, `packages/shared/src/hit-envelope.ts`, `packages/client/src/entities/SpriteRig.blade-extension.test.ts`, VFX owner-note tests, and live VFX/hit-envelope gates.

**Generated art:** No new subject. Reuse/remove existing generated assets.

**Acceptance signal.** Pixel/extent live gates show continuous blue Fulgurite coverage from player to damaging radius and a materially enlarged blue Voulge effect; a particle census for Tombstone contains stone/smoke and zero bone; a Headsman capture has zero special VFX/extension and a server gate proves only its normal blade envelope damages.

### B11 — Weapon generated-image VFX

**Exact notes**

- `2026-07-22T03:36:32.892Z` — **Dustreaper Zweihander** (`x2-dustreaper-zweihander`): “Fire dragon VFX”
- `2026-07-22T20:05:48.517Z` — **Mesa-Heart Geodes** (`x2-mesa-heart-geodes`): “lots of purple crystal VFX everywhere”
- `2026-07-22T20:06:36.989Z` — **Arcanist's Lance** (`x-staff-arcane-lance`): “needs image VFX to replace current VFX”

**Concrete change.** Replace/author the three treatments with generated-image subjects: a readable fire-dragon sweep for Dustreaper whose damaging extent follows the dragon; a dense family of purple crystal bursts/fragments for Mesa-Heart with controlled pooling and no simple circles; and a complete generated-image replacement for Arcanist's current procedural effect while preserving its existing firing cadence/projectile count. Remove displaced procedural layers rather than stacking the new art invisibly beneath them.

**Likely ownership/files.** One VFX integrator owns weapon recipes in the catalog/generated output, `tools/artkit/weapon-vfx-overrides.json`, `tools/artkit/build-weapon-vfx.mjs`, produced assets, `packages/client/src/vfx/weapon-vfx.generated.ts`, `weapon-vfx-suite.ts`, `packages/shared/src/hit-envelope.ts` where visual damage extends beyond the base weapon, and VFX/live tests.

**Generated art:** **YES — three subjects.** Three art-only Sols: one Fire Dragon, one Purple Crystal family subject, one Arcanist Lance effect subject. Each returns only its own subject assets; the VFX integrator composes them.

**Acceptance signal.** Asset provenance/alpha gates pass; live captures with procedural debug geometry disabled show the named subject clearly at combat scale; old displaced recipes no longer spawn; authoritative hit envelopes cover every damaging visible lobe without granting invisible damage outside the art.

### B12 — Weapon blade-extension exception: Mirage Hardlight Saber

**Exact note**

- `2026-07-22T20:06:54.352Z` — **Mirage Hardlight Saber** (`x2-mirage-hardlight-saber`): “Give this the blade extension technique”

**Why open / concrete change.** `852d9d0` supplies a reusable blade-owned extension technique, but the current treatment list contains Headsman and six brutalist swords—not Mirage. Add Mirage to the unified transform/hit-envelope path with its own hardlight extension art, ignition timing, per-facing transform, and authoritative combo envelope. Do not revive Headsman's treatment removed by B10.

**Likely ownership/files.** Catalog/generated weapon data, `packages/client/src/vfx/blade-extension-treatments.ts`, `packages/client/src/entities/SpriteRig.ts`, `packages/shared/src/hit-envelope.ts`, manifest/assets, blade-extension unit tests, and `e2e/tests/v7-blade-extension-live-gate.spec.ts`.

**Generated art:** **YES — one subject**, Mirage's hardlight extension.

**Acceptance signal.** The existing blade-extension live gate gains Mirage for local/remote left/right cases; the extension remains blade-owned through all combo frames, ignites only in its authored window, and its visible reach matches server damage. Headsman is absent from the extension census after B10.

### B13 — Weapon second-frame art: Wyrmskull Reliquary

**Exact note**

- `2026-07-23T04:20:00.637Z` — **Wyrmskull Reliquary** (`x2-wyrmskull-reliquary`): “Use this weapon as a reference image to make a second frame of this weapon with its mouth open. Use in the firing animation.”

**Concrete change.** Generate a second, same-registration frame from the exact current Wyrmskull reference with its mouth open. Keep the closed frame at idle; switch to open during the firing release window and return deterministically after the shot. Preserve silhouette, palette, grip, scale, and muzzle registration so the frame does not pop or drift.

**Likely ownership/files.** Existing Wyrmskull asset as the reference, a new adjacent sprite asset, `packages/client/src/sprites/manifest.ts`, catalog animation/frame metadata, `packages/client/src/entities/SpriteRig.ts`, firing-clock tests, and a live capture for local/remote left/right shots.

**Generated art:** **YES — one subject**, the Wyrmskull mouth-open frame. It must be the sole subject assigned to that art Sol.

**Acceptance signal.** Pixel registration between closed/open frames stays within 1 px at grip and muzzle anchors; idle never displays the open mouth; every accepted shot displays it for the authored release window on local and remote clients; no missing-texture fallback occurs.

## Recommended Sol fan-out and safe merge order

Use **13 implementation Sols**, one per B batch. Add **15 art-only subject Sols** where generation is required: seven for B2, three for B3, three for B11, one for B12, and one for B13. That is 28 bounded roles if capacity permits, but only the 13 integrators own repository implementation. Art-only Sols can run in parallel and hand assets to their batch integrator.

The safe serial merge order is:

1. **B1** screen truth (client renderer only).
2. **B2** wacky family.
3. **B3** fan family.
4. **B4** Overcasters prediction/authority.
5. **B5** attack-root movement.
6. **B6** archives.
7. **B7** thrown conversions.
8. **B8** pose/grip/combo.
9. **B9** size/mirror.
10. **B10** VFX cleanup.
11. **B11** generated VFX.
12. **B12** Mirage extension.
13. **B13** Wyrmskull second frame.

B1 and all art-only work are safe to prepare in parallel. B4 can also be developed independently of catalog work, but it should merge before B5 because both may touch Arena/server movement evidence. **B2, B3, and B5 through B13 all touch or may regenerate the shared weapon catalog/manifest; merge them strictly one at a time in the order above.** Before each such merge, rebase onto the preceding catalog merge, regenerate once from source, reject unrelated generated churn, and run catalog/asset referential-integrity tests. B10 must precede B12 so the extension census removes Headsman before adding Mirage. B1 must precede new left/right visual gates so B2/B3 inherit the corrected facing contract.

Verdict: 243 total normalized intents; 211 done/skip; 3 outstanding game; 29 outstanding weapon; 13 batches; recommended Sol fan-out 13 implementation Sols + 15 one-subject art Sols (28 bounded roles).
