# Implementation report — sound effects wave

Branch: `sol/sfx-wave`  
Date: 2026-07-24

## Gun family census

Source of truth: `ACTIVE_WEAPON_CATALOG_IDS`, filtered to definitions with `weapon.gun`. This yields 121 active gun-mechanic weapons. The runtime classifier uses the authored `tags.family` first, then narrow fiction/mechanism exceptions inside broad generated-catalog buckets.

- `revolver` (12): `x-gun-revolver-cannon`, `x-gun-ricochet-pistol`, `x2-ashfall-peacemaker`, `x2-grit-snubnose`, `x2-hailspitter-pepperbox`, `x2-gravewind-rimfire`, `x2-fool-s-gold-revolver`, `x2-tumbleweed-skipper`, `x2-hollowpoint-hex`, `x2-carom-king`, `x2-pinwheel-caromer`, `x2-ricochet-roulette`
- `scatter-sidearm` (5): `x2-cinderfang-derringer`, `x2-quicksilver-fanner`, `x2-scattershot-saint`, `x2-frostbite-volley-gun`, `x2-magpie-scattergun`
- `hand-cannon` (5): `x2-hailshot-hand-maul`, `x2-mesa-hand-cannon`, `x2-sunbrand-hogleg`, `x2-brimstone-bull`, `x2-iron-marshal`
- `shotgun` (15): `x-gun-coffin-shotgun`, `x2-buckshot-briar`, `x2-bonepicker-coachgun`, `x2-frostbore-scattergun`, `x2-galvanic-coachgun`, `x2-quicksilver-streetsweeper`, `x2-hallowbore-coachgun`, `x2-twin-maw-greenerbore`, `x2-slughammer-breachgun`, `x2-caustic-drum-sweeper`, `x2-emberfan-pumpgun`, `x2-carom-coachgun`, `x2-boomstick-saddlegun`, `x2-tesla-drumbore`, `x2-dustdevil-riotgun`
- `blunderbuss` (6): `x2-cinderchoke-blunderbuss`, `x2-spore-spitter-blunderbuss`, `x2-hollowpoint-voidgun`, `x2-wyrmgut-blunderbuss`, `x2-glasswidow-punchgun`, `x2-pearlbreech-volleygun`
- `rotary-auto` (10): `x-gun-gatling`, `x2-sidewinder-spitfire`, `x2-coyote-stinger`, `x2-buzzard-s-burnout`, `x2-reliquary-repeater`, `x2-hellbore-gatling`, `x2-ironhail-pepperbox`, `x2-gravedog-auto-rifle`, `x2-stormspur-coil-carbine`, `x2-brimstone-gallows-rifle`
- `industrial-repeater` (10): `x-gun-nailgun`, `x2-gravelthroat-repeater`, `x2-coffinnail-driver`, `x2-quill-storm-repeater`, `x2-hornet-s-nest-bolter`, `x2-embernail-repeater`, `x2-snakebite-dart-slinger`, `x2-reliquary-nailcaster`, `x2-thunderhead-spikecaster`, `x2-cinderquill-dart-caster`
- `lever-rifle` (8): `x2-dustline-lever-action`, `x2-hollowpoint-repeater`, `x2-thunderhead-lever-gun`, `x2-venomspine-repeater`, `x2-rustwidow-pump-rifle`, `x2-sidewinder-twin-rifles`, `x2-brasswork-volley-rifle`, `x2-boneash-scattergun-rifle`
- `long-rifle` (10): `x2-buzzard-s-eye-marksman`, `x2-quicksilver-slugthrower`, `x2-cinderbore-longrifle`, `x2-tracer-saint-carbine`, `x2-ironhide-buffalo-gun`, `x2-gravelung-punt-rifle`, `x2-pale-horse-longgun`, `x2-hexbore-witchrifle`, `x2-barrett-50-cal-sniper`, `x2-m50-anti-materiel-rifle`
- `coil-rail` (3): `x2-sunbreaker-railgun`, `x2-ghostwind-spectre-rail`, `x2-hailstorm-coilgun`
- `siege-ordnance` (11): `x-gun-hand-mortar`, `x2-widowmaker-cannon`, `x2-powderkeg-mortar`, `x2-thunderhead-repeater-cannon`, `x2-brimstone-rocket-tube`, `x2-graveshot-grenade-gun`, `x2-mauler-slug-thrower`, `x2-sanctus-siege-bombard`, `x2-hexbore-voidmaw`, `x2-calamity-howitzer`, `x2-boneyard-ricochet-mortar`
- `heavy-scatter` (4): `x2-buckshot-avalanche`, `x2-plaguespitter-flak-gun`, `x2-scattershell-duster`, `x2-cinderfan-dragoon`
- `bolt-launcher` (8): `x2-widowmaker-arbalest`, `x2-leviathan-harpoon-gun`, `x2-ghostbolt-crossbow`, `x2-frostfang-speargun`, `x2-buckshot-bramble-bow`, `x2-whisperbarb-hand-crossbow`, `x2-grave-anchor-harpoon`, `x2-tidehook-bombarpoon`
- `occult-relic` (5): `x2-gravesinger-s-hex-wand`, `x2-saintskull-monstrance`, `x2-gravewax-twin-idols`, `x2-voidwell-idol`, `x2-spitfire-censer-wand`
- `gauntlet-discharge` (6): `x2-voltvein-conductors`, `x2-tesla-faradayer`, `x2-hellmouth-palmcaster`, `x2-hexbolt-spitter-mitt`, `x2-galvanic-overcasters`, `x2-permafrost-cryo-bracer`
- `novelty-launcher` (3): `x2-fish-launcher`, `x2-exploding-present-lobber`, `x2-confetti-cannon`

## Gap audit

- Gun fire: present but clearly placeholder-level. All guns collapse to `shot:<bulletKind>`; several element rows share the same `replaces` cue, so manifest order—not weapon fiction—chooses the sample. Remote guns with generated-image recipes are also skipped.
- Dodge/roll: present and sample-backed through `player-roll-whoosh`.
- Jump/land: present and sample-backed through `player-jump` / `player-land`.
- Ground pound: impact is sample-layered, but generated `player-pound-tuck` and `player-pound-drop` are installed and never played.
- Chest: no chest/container gameplay event exists in the current client/server/shared code, so this candidate is not applicable.
- Weapon pickup/rarity: pickup has only the generic `grab` synth; rarity reveal has the installed `loot-drop-rarity` sample.
- Money pickup: confirmed silent. `MoneyDropRenderer` fires a receipt banner only.
- Enemy death: four installed size-tier samples all replace the same `death` cue; first-manifest-entry wins, so every ordinary/tough/boss removal gets the small variant.
- Boss coverage: Vastaghar’s authored cue set is wired. Serraketh’s dive/eruption/sever/regrow/death/rumble samples are generated but mostly unwired; `serraketh-eruption` also steals generic `bossslam` through a duplicate `replaces` key.
- Parry: success is sample-backed. An accepted brace/attempt has no sound, so whiffs and successful attempts have no anticipatory distinction before the success clang.
- Weapon swap: no sound.
- Disassemble/salvage: landed as `salvageWeapon`; no sound.
- Menu confirm/cancel: installed `ui-card-confirm` and `ui-dock-close` samples exist but the semantic menu cues are unwired.
- Kung-fu strike whooshes: all four styles currently reuse broad sword/fist/tome families; Iron Palm alone has an impact accent.

## Generation plan

- Use only `tools/soundkit/sfx-manifest.json`, `gen-sfx.mjs`, and `check-sfx.mjs`.
- Generate 16 gun-family rows / 37 clips: three variations for the five fastest/highest-repeat families and two for the other eleven.
- Generate nine gap rows / 23 clips: weapon pickup, money pickup, parry brace, swap, salvage, and four kung-fu styles.
- Reuse installed samples for pound phases, enemy-death tiers, Serraketh, and menu confirm/cancel instead of regenerating them.
- Install generated clips under `packages/client/public/audio/sfx/` and wire them through `AudioBus`.
- Stop on quota/credential/API-service failure, preserve landed output, and record any remaining rows. Manifest-validation errors may be corrected once and resumed because existing raws are skipped.

## Progress log

- Report initialized before implementation work.
- Census completed: 121 active gun definitions grouped into 16 mechanism/fiction families.
- Gap audit completed: nine new authored rows planned; installed-but-unwired samples will be recovered through semantic cue mappings.
- Authoring/wiring batch completed: 25 priority-5 manifest rows describe 60 clips; deterministic active-gun census test passes and client TypeScript is green before generation.
- Generation batch 1 installed 40/60 clips. All 23 gap-event clips and 17 gun-family clips landed. Twenty clips across eight gun families were rejected with HTTP 400 `text_too_long` because the generator's alternate-take suffix pushed the request over ElevenLabs' 450-character limit: revolver (3), scatter sidearm (3), rotary auto (3), industrial repeater (3), coil/rail (2), siege ordnance (2), occult relic (2), and novelty launcher (2).
- Shortened only those eight prompts while retaining their fiction, mechanism, transient, exclusion, and western-occult direction. Batch 2 will be a resumable pass over the 20 missing clips; the 40 existing raw files remain untouched.
- Generation batch 2 completed cleanly: 20 generated, 40 skipped from resumable raws, 60 installed, zero failed. The public sample-bank manifest now publishes all 155 authored entries; final API shortfall is none.
- Runtime wiring completed. Predicted and remote gun shots—including generated-image weapons—resolve through the family map; local reports retain full mix weight and remote reports are attenuated. The old bullet-kind cue remains only as a defensive fallback for non-catalog data.
- Gap wiring completed for weapon pickup, money pickup, parry brace/whiff, weapon swap, salvage, four kung-fu styles, pound phases, four enemy-death weights, five Serraketh edges plus its rumble lifecycle, and semantic menu confirm/cancel.
- The sound portal was regenerated from the published audio manifest and now exposes all 155 sound entries.

## Verification

- `node tools/soundkit/check-sfx.mjs`: green; 155 manifest entries, 316/316 expected clips installed. The checker's only orphan warning is its own `audio/sfx/manifest.json`.
- `pnpm gen:check`: green, including `tools/portal/index.html`.
- `pnpm typecheck`: green across shared, server, and client.
- `pnpm test`: green; 168 test files and 2,195 tests passed. One prior all-assertions-pass run hit a Vitest worker RPC timeout after completion; the clean retry exited zero.
- Deterministic audio coverage: 121/121 active guns mapped, all 16 families sample-backed with two or three variations, no placeholder cue in the gun map, and every new/recovered event cue resolves to one authored installed sample row.
- Hygiene: all 60 generated MP3s are committed from `packages/client/public/audio/sfx/`; resumable raws under `tools/soundkit/out/` remain ignored, and no `.env` path or content entered the change.

verdict: 121 guns wired across 16 families, 9 gap sound families added (23 clips), API shortfall: none, files touched: 71 paths (60 installed MP3s plus 11 code, test, manifest, portal, and report paths).
