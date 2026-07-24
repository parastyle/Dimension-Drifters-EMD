# B24 radial-hunt implementation report

## Stage 0 — investigation opened

Forensic source: the rogue layer is the synthesized PER motion suite returned by
`buildWeaponFallbackSuite()` in `packages/client/src/vfx/weapon-vfx-suite.ts`. An un-authored weapon
is assigned `blade-trail`, `twin-slash`, or `thrust-streak` there. All three enter the shared
`renderPer()` renderer in `packages/client/src/vfx/vfx-render.js`, sample the painted 48-pack particle
textures, and (for the ordinary blade/thrust profiles) add the `perLip` strip through
`updateRadialRope()`. That synthesized suite is independent of the bespoke `WeaponEffectRecipe`
channel: Hollow Harvest's `hollow-harvest-circle`, Gravechain's `gravechain-dominant-spin`, and Twin
Whispervolumes' `whispervolume-page-scatter` are separate authored recipes and must remain intact.

Cohort commit: `ee27031673171daaef035a95f25c7dcf9553e0a4` (`feat(weapons): owner notes v6 —
anchor law closed for good, katana slashes, geometry purge, muzzle flashes + Headsman prototype kit`,
2026-07-21) introduced `weapon-vfx-suite.ts` and routed every un-authored definition into this shared
PER fallback. The lower-level radial-rope renderer predates the cohort in
`4507ffa53ae9aae3bf4d6950a7a79e45533598c7` (`feat(vfx): Painted Edge Ribbon — the MS-Paint streaks
are dead (§50, VFX panel consensus)`, 2026-07-16); `ee270316` is the cohort injection that made that
renderer appear across the affected weapons.

Affected weapon count and IDs: **322 weapon definitions** (321 catalog entries plus built-in
`fists`) resolved one of the synthesized PER layers before this change (**311 active, 11 already
archived**). The exact pre-change census, grouped by resolved layer, is:

- `blade-trail` (290): driftblade, fists, gravediggers-spade, rattler-sabre, x-gun-coffin-shotgun, x-gun-gatling, x-gun-hand-mortar, x-gun-nailgun, x-gun-revolver-cannon, x-gun-ricochet-pistol, x-staff-storm-rod, x-sword-anchor, x-sword-coffin, x-sword-railspike, x-sword-whirlwind, x2-abyssal-apocrypha, x2-anvil-drop, x2-anvil-heart-quake-maul-staff, x2-ashfall-peacemaker, x2-auroral-filament-wand, x2-barrett-50-cal-sniper, x2-blightfork-glaive, x2-blightgrip-spore-mitt, x2-boneash-scattergun-rifle, x2-bonepicker-coachgun, x2-boneyard-ricochet-mortar, x2-boomerang-boot, x2-boomstick-saddlegun, x2-boomtown-maul, x2-boothill-hatchet, x2-boothook-harpoon, x2-bramblecoil, x2-brasswork-volley-rifle, x2-brimstone-bull, x2-brimstone-falcata, x2-brimstone-rocket-tube, x2-brinequill-tidescepter, x2-bubble-wand-swarm-caster, x2-buckshot-avalanche, x2-buckshot-bramble-bow, x2-buckshot-briar, x2-buzzard-s-burnout, x2-buzzard-s-eye-marksman, x2-cairn-of-hollow-names, x2-calamity-howitzer, x2-carom-coachgun, x2-carom-king, x2-carrion-cudgel, x2-carrion-effigy, x2-carrion-roost-necro-scepter, x2-caustic-drum-sweeper, x2-censer-of-the-weeping-saint, x2-choir-iron-greataxe, x2-cinder-briar, x2-cinderbore-longrifle, x2-cinderbrand-cleaver, x2-cinderchoke-blunderbuss, x2-cinderchoke-brazier-orb, x2-cinderfan-dragoon, x2-cinderfang-derringer, x2-cinderpalm-brand-glove, x2-cinderquill-almanac, x2-cinderquill-dart-caster, x2-codex-of-forked-tongues, x2-coffin-nail-carbine, x2-coffin-nail-rosary-orb, x2-coffinnail-driver, x2-cogwright-s-tesla-rod, x2-coilshot-meteor, x2-confetti-cannon, x2-coyote-trickster-s-sparkmitt, x2-doomsday-drum-cannon, x2-drunken-fist-wraps, x2-dust-devil-cyclone-orb, x2-dust-devil-flail, x2-dustdevil-riotgun, x2-dustdevil-warmaul, x2-dustline-lever-action, x2-emberfan-pumpgun, x2-emberleaf-chapbook, x2-embernail-repeater, x2-exploding-present-lobber, x2-ferrous-serpent, x2-fire-throwing-star, x2-fish-launcher, x2-fool-s-gold-revolver, x2-frostbite-headstone, x2-frostbite-snowglobe, x2-frostbite-volley-gun, x2-frostbore-scattergun, x2-frostfang-speargun, x2-frostgig-harpoon, x2-frostknuckle-rimewrap, x2-frostquill-compendium, x2-frostsaint-ossuary, x2-fulgurite-storm-sphere, x2-gallows-splitter, x2-galvanic-coachgun, x2-galvanic-liber-of-storms, x2-galvanic-overcasters, x2-ghostbolt-crossbow, x2-ghostwind-spectre-rail, x2-gilded-hourglass-frost-scepter, x2-glacier-headtaker, x2-glasswidow-hexweave, x2-glasswidow-punchgun, x2-glimmerdust-prospector-wand, x2-glyphward-manuscript, x2-godsbone-pillar, x2-grave-anchor-harpoon, x2-gravechain-scythe, x2-gravechill-nodachi, x2-gravelthroat-repeater, x2-gravelung-punt-rifle, x2-graveshot-grenade-gun, x2-gravesinger-s-hex-wand, x2-gravewax-seance-globe, x2-gravewind-rimfire, x2-grit-snubnose, x2-hailshard-resonator, x2-hailshot-hand-maul, x2-hailspitter-pepperbox, x2-hailspur-sickle, x2-hailstorm-coilgun, x2-hailwidow-katana, x2-hallowbore-coachgun, x2-hangman-s-gavel, x2-hangman-s-greatcleaver, x2-hellbore-gatling, x2-hellmouth-palmcaster, x2-hexbinder-s-iron-orrery, x2-hexbloom-scattergrimoire, x2-hexbolt-spitter-mitt, x2-hexbore-voidmaw, x2-hexbore-witchrifle, x2-hexglyph-partisan, x2-hexpost-charm-pole, x2-hoarfrost-piledriver, x2-hollow-harvest, x2-hollowbarrel-spell-scattergun-staff, x2-hollowmoon-reaver, x2-hollowmother-spore-totem, x2-hollowpoint-hex, x2-hollowpoint-repeater, x2-hollowpoint-voidgun, x2-hornet-s-nest-bolter, x2-ice-throwing-star, x2-idol-of-the-pale-verdict, x2-iron-chakram, x2-iron-marshal, x2-iron-palm-wraps, x2-iron-throwing-star, x2-iron-vow-bearded-axe, x2-ironbrand-heatfist, x2-ironhail-pepperbox, x2-ironhide-buffalo-gun, x2-kunai, x2-ledger-of-spent-souls, x2-leviathan-harpoon-gun, x2-locust-flail, x2-locust-glass-plague-orb, x2-m50-anti-materiel-rifle, x2-magpie-scattergun, x2-maledict-tome-of-salt-lines, x2-marrowpike-ranseur, x2-marshlight-bog-censer-wand, x2-mauler-slug-thrower, x2-mawstone-cairn-idol, x2-mesa-hand-cannon, x2-mesa-spine-thunder-stave, x2-miasma-bell-censer, x2-mirage-coilrifle, x2-mirage-hardlight-saber, x2-mistral-kusarigama, x2-muay-thai-wraps, x2-nine-tail-razorlash, x2-null-grimoire-of-the-hollow-page, x2-nullsaint-reliquary, x2-obsidian-maw-void-staff, x2-pale-horse-longgun, x2-pearl-of-penance-censer, x2-pearlbreech-volleygun, x2-pendulum-of-the-pyre, x2-permafrost-bardiche, x2-permafrost-cryo-bracer, x2-permafrost-siege-lobber, x2-plaguespitter-flak-gun, x2-plaguethresh, x2-pocket-hexicon, x2-powderkeg-mortar, x2-prismhex-diffraction-gauntlet, x2-psalter-of-the-burning-halo, x2-pyreclap-mauler, x2-pyroglyph-spellbook, x2-quarry-splitter-bardiche, x2-quartzlight-wayfinder, x2-quicksilver-censer, x2-quicksilver-chainblade, x2-quicksilver-fanner, x2-quicksilver-skinning-cleaver, x2-quicksilver-slugthrower, x2-quicksilver-streetsweeper, x2-quill-storm-repeater, x2-reaper-s-tithe, x2-reckoning-s-sun-orb, x2-reliquary-broadaxe, x2-reliquary-lantern-wand, x2-reliquary-nailcaster, x2-reliquary-repeater, x2-rendclaw-vambrace, x2-reverent-broadsword, x2-ricochet-roulette, x2-riftcaller-naginata, x2-riftcleaver-greatblade, x2-riftglass-prism-lantern, x2-rimebound-folio, x2-rimethorn-naginata, x2-rotgrove-totem, x2-rustwidow-pump-rifle, x2-saint-bough-frost-crozier, x2-saint-calamity, x2-saint-s-knucklebone-censer-orb, x2-saintskull-monstrance, x2-saloon-tomahawk, x2-saltbrand-cutlass, x2-sanctum-brazier-staff, x2-sanctus-siege-bombard, x2-sandsong-saber, x2-scattershot-saint, x2-seraph-s-knuckle-reliquary, x2-sermon-bell, x2-sidewinder-spitfire, x2-slughammer-breachgun, x2-sluicebox-maul-axe, x2-smoldering-eye-of-perdition, x2-snakebite-dart-slinger, x2-snakebite-lash, x2-snakebite-morningstar, x2-snakeoil-tincture-scepter, x2-sparkknuckle-hex-mitt, x2-spitfire-censer-wand, x2-spore-spitter-blunderbuss, x2-sporebound-witchglobe, x2-squeaky-mallet, x2-static-tomahawk, x2-stormcaller-tesla-gatling, x2-stormpetal-odachi, x2-sunbrand-hogleg, x2-sunbreaker-railgun, x2-sunmote-reliquary-staff, x2-tallowtongue-pyre-stave, x2-tesla-drumbore, x2-tesla-faradayer, x2-throne-of-ash-coal-scepter, x2-thunderhead-lever-gun, x2-thunderhead-repeater-cannon, x2-thunderhead-sledge, x2-thunderhead-spikecaster, x2-thunderhead-stormfists, x2-thunderhoof-splittingaxe, x2-thunderpost-fetish, x2-tidehook-bombarpoon, x2-tombwarden-claymore, x2-toxinwell-khopesh, x2-tracer-saint-carbine, x2-tumbleweed-flail, x2-tumbleweed-skipper, x2-tumbleweed-static-bauble, x2-unicorn-rainbow-beam, x2-vagrant-s-wishing-marble, x2-venomspine-repeater, x2-verdict-longsword, x2-verdigris-grand-grimoire, x2-void-throwing-star, x2-voidgrasp-null-gauntlet, x2-voidwell-idol, x2-voltcaster-machine-pistol, x2-voltfang-tachi, x2-voltscript-codicil, x2-wickfire-fauchard, x2-widowmaker-arbalest, x2-widowmaker-cannon, x2-widowmaker-wrecking-ball, x2-wing-chun-wraps, x2-witchwood-splitter, x2-witherleaf-bestiary, x2-wormwood-hex-stave, x2-wyrmgut-blunderbuss, x2-wyrmscale-hex-talon, x2-wyrmskull-reliquary.
- `twin-slash` (22): twin-bowie-fangs, x2-bogwater-twinbits, x2-brimstone-doubleheader, x2-cinderfang-wakizashi-pair, x2-coyote-s-grin, x2-coyote-stinger, x2-dustdevil-whirlbits, x2-frostfang-rakes, x2-gravewax-twin-idols, x2-knucklebone-talons, x2-pinwheel-caromer, x2-pyre-marble-bandolier, x2-revenant-knuckle, x2-scattershell-duster, x2-sidewinder-twin-rifles, x2-stormcradle-faradaygloves, x2-stormcrow-twin-hatchets, x2-twin-maw-greenerbore, x2-twin-whispervolumes, x2-voltvein-conductors, x2-wendigo-claws, x2-whisperbarb-hand-crossbow.
- `thrust-streak` (10): x2-bonewhisper-jian, x2-buckhorn-boarspear, x2-cinderbrand-pike, x2-galvanic-lancepole, x2-hexbloom-rapier, x2-nullspike-pike, x2-phantom-estoc, x2-sidewinder-spontoon, x2-sunlance-javelin-pike, x2-venomtongue-trident.

All six owner-marked weapons occur in that census: Thunderpost Fetish, Thunderhoof Splittingaxe,
Reaper's Tithe, Hollow Harvest, and Gravechain Scythe resolved `blade-trail`; Twin Whispervolumes
resolved `twin-slash`.

Two render-path proofs:

1. `x2-thunderpost-fetish`: local accepted fire enters `ArenaScene.sendAttack()`; it is neither gun,
   quake, cast, warp, nor thrown, so `spawnSlash()` calls `VfxPlayer.playSwing()`.
   `weaponVfxSuiteFor()` finds no authored `WEAPON_VFX` suite, and `buildWeaponFallbackSuite()` assigns
   `blade-trail` (2H/L). `VFXRENDER.R["blade-trail"]` calls `renderPer()`, which resolves the shared
   wisp/bolt painted particle textures and draws the secondary strip with `updateRadialRope()`.
2. `x2-hollow-harvest`: the same `spawnSlash()` → `VfxPlayer.playSwing()` →
   `weaponVfxSuiteFor()` fallback path assigns `blade-trail` and reaches the same PER emitter. In
   parallel, `cueWeaponSwingIdentity()` resolves the separate authored `hollow-harvest-circle` recipe
   and calls `spawnWeaponRadialIdentity()` with `fire-splat`. Removing the fallback builder output
   therefore removes only the rogue PER layer while leaving the authored fire circle unchanged.

The suspected caster `staff → radial/spark` impact table is not the shared source: Thunderhoof,
Reaper's Tithe, Hollow Harvest, and Gravechain are melee-class definitions and never resolve a caster
recipe. The marked intersection is the synthesized PER fallback.

## Stage 1 — preservation baseline

Captured `docs/owner-notes-audit-v11-evidence/b24-radial-hunt/before-forensics.json` before behavior
changes. It records the six marked resolver results, exact authored recipes for Hollow Harvest,
Gravechain, and Twin Whispervolumes, side-order baselines, and SHA-256 hashes for the authored recipe
module, its renderer, and the installed Whispervolume page bitmap. This gives the after-stage a
byte-for-byte preservation check in addition to focused regression assertions.

Plan:

1. Trace two owner-marked weapons from fire dispatch through recipe resolution to the shared emitter.
2. Use blame and `git log -S` on that emitter and its resolver to identify the cohort commit.
3. Capture the complete pre-change resolved weapon set and snapshot the bespoke layers that must remain unchanged.
4. Remove only the shared default layer, then implement the four scoped side orders.
5. Regenerate artifacts, migrate focused tests, run all required static/unit/asset checks, and perform the private-port live gate.
6. Store evidence under `docs/owner-notes-audit-v11-evidence/b24-radial-hunt/`, append each stage here, and commit the finished change.

## Stage 2 — source fix, side orders, and focused regression gate

Removed the rogue layer at its only shared injection point: `buildWeaponFallbackSuite()` now returns
an empty suite. `weaponVfxSuiteFor()` still merges the two named fallback impact exceptions
(`x2-wendigo-claws` and `x2-revenant-knuckle`), still returns every authored `WEAPON_VFX` suite
unchanged, and still routes the independent `WeaponEffectRecipe` channel. No per-weapon masking was
added for any of the six marked weapons.

The six marked weapons now resolve no synthesized PER layer. There was no second rogue source among
them: Hollow Harvest's fire-splat circle, Gravechain's void-wisp circle, and Twin Whispervolumes'
page scatter are authored effects and remain exactly equal to the Stage 1 snapshots. SHA-256 checks
also prove `weapon-effect-recipes.ts`, `weapon-effect-vfx.ts`, and the Whispervolume page bitmap are
byte-identical.

Side orders implemented:

- `x2-mournveil-scythe`: generated VFX override is now an empty suite with
  `suppressFallback: true`; its 364 px held render, damage/range/cooldown, spin arc, and existing
  screen-circle/shaft-midpoint swing performance are unchanged.
- `x2-pocket-hexicon`: archived via the canonical concept flag and regenerated catalogs. Census is
  now 343 active + 14 archived, with all acquisition/drop surfaces migrated.
- `x2-spitfire-censer-wand`: `displayLength` changed from 90 to 126 px, exactly +40%; combat and gun
  metadata are unchanged.
- `x2-twin-whispervolumes`: page presentation changed from 30×22 to 45×33 px (1.5×); direct range
  changed 145→220 and authoritative chain-hop range 180→240. Damage 6, cooldown 0.32, chain damage
  5, jumps 3, and falloff 0.8 are unchanged. Nominal DPS remains 18.75 and effective-power ratio is
  1.0284× the baseline, inside the ±10% order.

`pnpm gen` completed after restoring this isolated worktree's ignored identity-reference inputs;
the generated VFX subject manifest is byte-identical and carries no unrelated churn. Focused gate:
9 test files / 59 tests passed, including the new B24 census, source-removal, bespoke-preservation,
archive, size, reach, DPS, and authoritative chain-target assertions.

## Stage 3 — required gates and live evidence

All required generation, static, asset, and test gates are green:

- `pnpm gen`
- `pnpm gen:check`
- `pnpm typecheck`
- `pnpm assets:check` (478 sprite entries / 1,007 component parts checked)
- focused regression gate (9 files / 59 tests)
- full `pnpm test` suite with one worker (168 files / 2,198 tests)

The full suite was serialized because the default concurrent run exhausted the existing five-second
timeout in an unrelated boss stress test; that isolated test passed, and the complete serialized
suite passed without changing its timeout or any unrelated production surface. Biome checks for the
four changed/new VFX and audit files, `git diff --check`, and the changed-text LF audit are also
clean.

The live gate ran through the repository's private ephemeral-port harness on
`proto-cowboy-hidden-face`, using client port 57370 and game port 57369; protected ports 5180 and
2567 were never used. Sixteen accepted authoritative attacks cover the eight unique requested
weapons in both left and right facings. Every marked capture reports zero `blade-trail`,
`twin-slash`, or `thrust-streak` layers. Both facings also record:

- Hollow Harvest's authored `fire-splat` circle at count 24.
- Gravechain Scythe's authored `void-wisp` circle at count 24.
- Twin Whispervolumes' 45×33 page projectiles, at least six visible pages, more than 190 px of live
  forward travel, direct range 220, and chain range 240.
- Mournveil's active swing rotation with no cursor-suite event.
- Spitfire Censer Wand's `displayLength: 126` and approximately 126 px live oriented render.

The machine-readable live receipts, before snapshot, screenshot index, and all 16 firing captures
are in `docs/owner-notes-audit-v11-evidence/b24-radial-hunt/`. Authored preservation is proven three
ways: exact recipe snapshots in the B24 test, unchanged SHA-256 hashes for the recipe module and
renderer (plus the installed page bitmap), and both-facing live recipe receipts. The fan/tornado,
kung-fu wrap, B20 stat-teardown, character, pet, player-aura, chain, and tassel surfaces were not
changed.

Verdict: source `buildWeaponFallbackSuite()` synthesized PER fallback named; cohort commit `ee27031673171daaef035a95f25c7dcf9553e0a4`; 322 weapon definitions cleaned; bespoke Hollow Harvest, Gravechain Scythe, and Twin Whispervolumes layers proven intact; side orders done (Mournveil cursor-free, Pocket Hexicon archived, Spitfire Censer Wand +40%, Twin pages +50% with 220/240 authoritative reach and power inside ±10%); evidence `docs/owner-notes-audit-v11-evidence/b24-radial-hunt/`; files touched: `data/weapon-concepts-300.json`, client VFX suite/page/generated metadata, shared generated weapon catalog/resource census, server archive census test, artkit VFX overrides, portal/weaponsmith archive counts, B24 unit/live tests, migrated archive/owner-note tests, this report, and the B24 evidence directory.
