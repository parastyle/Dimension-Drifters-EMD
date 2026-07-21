# V6G systemic delivery and catalog audit

Date: 2026-07-21  
Branch: `feat/v0.118-metagame`

## Root cause and systemic boundary

V5 audited the typed `weapon-effect-recipes.ts` path, but unauthored melee weapons do not use that
path. `VfxPlayer` synthesized a second, element/archetype fallback suite and rendered source motion plus
hit layers on one surface centered on the wielder. The fist/claw/gauntlet family largely travels through
that fallback, which is why its hit rings and flashes escaped the recipe-only sweep.

V6G makes anchor classification data required on every canonical VFX layer, routes the live fallback
through the same exported suite builder exercised by tests, and splits every suite into source and target
surfaces before rendering. The permanent test rejects an unclassified layer and rejects every `hit`,
`impact`, `blast`, or `slam` layer whose anchor is not `target`.

## V6G1 named escalation

| Item | Previous failure | Delivered route |
| --- | --- | --- |
| Wendigo Claws | Synthesized frost hit layers shared the wielder-centered surface. | `hit-spark` and `impact-flash` are split to the clamped attacked point. |
| Revenant Knuckle | Void `shockwave-ring`/`sigil-ring` appeared as self aura. | Both circle layers render on the attacked point; every catalog sharer is covered below. |
| Riftcaller Naginata | The same synthesized void circle pair appeared on self. | `shockwave-ring` and `sigil-ring` are explicitly deleted from its fallback suite. |
| Seraph's Knuckle-Reliquary | Beam art terminated on its smoothed authoritative direction rather than the cursor. | Local visual pose points to and terminates at the cursor, capped by authoritative beam length; damage authority is unchanged. |
| Dustreaper Zweihander | Fire rode the blade/source path and was too sparse. | Recipe is now target-classified `fire-wisp`, clamped to melee reach in cursor direction, with `5 × 30 = 150` particles. |

### Canonical layer classification

| Anchor | Layers (`trigger`) |
| --- | --- |
| Target | `hero-skin (impact)`, `cleave-flash (hit)`, `magma-scatter (hit)`, `hit-spark (hit)`, `blood-mist (hit)`, `fire-burst (blast)`, `arc-bolt (cast)`, `sigil-ring (cast)`, `ember-rain (cast)`, `dust-cloud (slam)`, `debris (slam)`, `shockwave-ring (slam)`, `impact-flash (impact)` |
| Weapon | `slash-arc (swing)`, `twin-slash (swing)`, `edge-trail (swing)`, `blade-trail (swing)`, `thrust-streak (swing)`, `drift-petals (swing)`, `saw-sparks (channel)`, `barrel-spin (charge)`, `charge-glow (charge)`, `beam (channel)`, `throw-dust (throw)` |
| Muzzle | `muzzle-flash (fire)`, `tracer (fire)`, `pellet-spread (fire)`, `shell-eject (fire)` |
| Flight | `lob-arc (flight)`, `spin-trail (flight)` |
| Character | `aura-pulse (aura)` only; it is an explicit buff/aura layer, never a hit-class layer. |

### Authored effect-recipe classification

| Recipe | Classification | Anchor/emitter |
| --- | --- | --- |
| `galvanic-blue-burst` | projectile-impact | tip/projectile receipt |
| `riftglass-rainbow-volley` | projectile-impact | tip/projectile receipt |
| `whispervolume-page-scatter` | chain-path | tip |
| `riftcleaver-crystal-shards` | weapon-motion | blade |
| `verdict-tip-procession` | weapon-motion | tip |
| `tombwarden-dark-slash` | impact | target |
| `choir-iron-flame-slash` | weapon-motion | blade |
| `hangman-blood-spatter` | impact | target |
| `cinderbrand-fire-slash` | weapon-motion | blade |
| `sanctified-holy-slash` | weapon-motion | blade |
| `dustreaper-continuous-edge` | impact | target |
| `gravechain-dominant-spin` | weapon-motion | blade |
| `hollow-harvest-circle` | weapon-motion | blade |
| `stormfist-blue-lunge` | character-action | body |
| `thunderhead-electric-codex` | weapon-motion | blade |
| `sermon-musical-notes` | impact | target |
| `nullspike-impact-circle` | impact | target |
| `quarry-quad-spatter` | weapon-motion | blade |
| `witherleaf-tip-spores` | weapon-motion | tip |
| `snakeoil-tip-sparks` | weapon-motion | tip |
| `void-caster-explosion` | impact | target |
| `hexbloom-toxic-impact` | impact | target |
| `cinderbrand-magma-impact` | impact | target |
| `cinderchoke-fire-impact` | impact | target |

### Revenant circle-recipe sharers

Every item below is enumerated from the live suite resolver, not from name heuristics. All of these circle
layers are target-anchored. Riftcaller is intentionally absent because its two layers are deleted.

| Circle layer | Complete active melee set |
| --- | --- |
| `shockwave-ring` | `gravediggers-spade`, `tombstone-greatsword`, `x-sword-whirlwind`, `driftblade`, `x-sword-anchor`, `x-sword-coffin`, `x2-gravechill-nodachi`, `x2-voltfang-tachi`, `x2-tombwarden-claymore`, `x2-phantom-estoc`, `x2-mirage-hardlight-saber`, `x2-riftcleaver-greatblade`, `x2-dustreaper-zweihander`, `x2-bonewhisper-jian`, `x2-stormpetal-odachi`, `x2-cinderbrand-cleaver`, `x2-permafrost-bardiche`, `x2-thunderhoof-splittingaxe`, `x2-sanctified-headsman`, `x2-hollowmoon-reaver`, `x2-sluicebox-maul-axe`, `x2-glacier-headtaker`, `x2-choir-iron-greataxe`, `x2-witchwood-splitter`, `x2-hangman-s-greatcleaver`, `x2-stormcrow-twin-hatchets`, `x2-iron-vow-bearded-axe`, `x2-dustdevil-glaive`, `x2-rimethorn-naginata`, `x2-galvanic-lancepole`, `x2-reliquary-halberd`, `x2-hexglyph-partisan`, `x2-nullspike-pike`, `x2-quarry-splitter-bardiche`, `x2-wickfire-fauchard`, `x2-saintspar-lochaber`, `x2-thunderhead-voulge`, `x2-marrowpike-ranseur`, `x2-blightfork-glaive`, `x2-boomtown-maul`, `x2-thunderhead-sledge`, `x2-frostbite-headstone`, `x2-pendulum-of-the-pyre`, `x2-anvil-drop`, `x2-revenant-knuckle`, `x2-sermon-bell`, `x2-dustdevil-warmaul`, `x2-saint-calamity`, `x2-hoarfrost-piledriver`, `x2-static-tomahawk`, `x2-widowmaker-wrecking-ball`, `x2-reaper-s-tithe`, `x2-gravechain-scythe`, `x2-mournveil-scythe`, `x2-plaguethresh`, `x2-hollow-harvest`, `x2-rendclaw-vambrace`, `x2-verdigris-grand-grimoire`, `drift-greatkatana-moonwake`, `drift-greatkatana-tempest-regent`, `drift-colossal-world-seam` |
| `sigil-ring` | `x2-reverent-broadsword`, `x2-phantom-estoc`, `x2-riftcleaver-greatblade`, `x2-verdict-longsword`, `x2-bonewhisper-jian`, `x2-sanctified-headsman`, `x2-hollowmoon-reaver`, `x2-choir-iron-greataxe`, `x2-reliquary-broadaxe`, `x2-reliquary-halberd`, `x2-hexglyph-partisan`, `x2-nullspike-pike`, `x2-saintspar-lochaber`, `x2-sunlance-javelin-pike`, `x2-hangman-s-gavel`, `x2-revenant-knuckle`, `x2-sermon-bell`, `x2-saint-calamity`, `x2-gravechain-scythe`, `x2-frostfang-rakes` |

## V6G2 katana slash assignment

Artkit's built-in Codex image pipeline generated five source slash languages in one resumable batch. The
installer chroma-keys, palette-derives, seam-feathers, and packages a unique 10×96 sheet URL per blade.

| Blade | Language | Palette | Distinct assignment |
| --- | --- | --- | --- |
| `x2-hailwidow-katana` | crescent | `#9eeaff` | splitting-hail crescent |
| `x2-gravechill-nodachi` | seam | `#d9f7ff` | frozen fracture seam |
| `x2-voltfang-tachi` | crosscut | `#ffe24a` | forked thunder cross-cut |
| `x2-cinderfang-wakizashi-pair` | crosscut | `#ff6a2a` | ember twin cross-cut |
| `x2-stormpetal-odachi` | inkstroke | `#ff9ecf` | petal-fiber ink stroke |
| `drift-wakizashi-kagewake` | inkstroke | `#f4f7ff` | blackglass white ink |
| `drift-wakizashi-hushglass` | seam | `#62d9e8` | smoked-glass hush seam |
| `drift-katana-stillwater-edict` | ripple | `#b9e7ff` | stillwater judicial ripple |
| `drift-katana-stormthread` | crosscut | `#56a7ff` | blue storm-thread cross-cut |
| `drift-katana-riftstep` | seam | `#b14bff` | violet rift-step seam |
| `drift-nodachi-pale-horizon` | crescent | `#d8fbff` | pale horizon crescent |
| `drift-nodachi-gatebreaker` | inkstroke | `#f1c06a` | gatebreaking dry brush |
| `drift-greatkatana-moonwake` | crescent | `#e8e3ff` | lunar wake crescent |
| `drift-greatkatana-tempest-regent` | ripple | `#d9b85f` | regent storm ripple |
| `drift-colossal-world-seam` | seam | `#ff5eea` | colossal world seam |
| `x-sword-neon-katana` | ripple | `#59fff2` | neon plasma ripple |

## V6G3 simple-geometry found → fixed

| Found primitive/type specimen | Runtime replacement |
| --- | --- |
| Brimstone/general explosion core discs, clean ring, rectangular rays, and circular scorch | Painted element splats, rings, shards, motes, and wisps; existing shake arbitration unchanged. |
| Quake danger ellipse, ground ellipse, dust/flash ellipses, square debris, procedural circles | Painted element ring/splat, sand wisps, fire splat, and steel shards. |
| Canonical `shockwave-ring`, `sigil-ring`, and `aura-pulse` perfect arcs | Gapped, jittered `paintBrokenRim` strokes. |
| Electric-bolt contact circle | Painted `shock-splat` burst. |
| Beam endpoint perfect rings | Gapped, wobbled organic rims. |
| Generic bullet flash/disc/scorch and ricochet rectangles | Painted element splat, sand wisp, shock bolt, and steel splat. |
| Generic `spawnSplat` circle | Painted fire/toxic splats. |
| Rail/sonic clean ellipse | Painted `shock-ring`. |
| Procedural muzzle star and hot-core circles in the live gun route | Codex-generated muzzle-flash sprites. |

Intentional semantic geometry is excluded: HUD/progress marks, authoritative gameplay telegraphs, layered
caster glyph language, and literal physical objects such as a casing or nail. These are not unmasked effect
fillers pretending to be painted phenomena.

## V6G4 muzzle-flash assignment

The generated sheet contains six 192px variants. The table is exhaustive for the 117 active gun definitions;
each ID occurs once, and catalog-neighbor assignments are asserted to use different frames.

| Variant | Assigned gun IDs |
| --- | --- |
| Crown | `x-gun-revolver-cannon`, `x-gun-hand-mortar`, `x2-ashfall-peacemaker`, `x2-mesa-hand-cannon`, `x2-hailspitter-pepperbox`, `x2-scattershot-saint`, `x2-rustwidow-pump-rifle`, `x2-pale-horse-longgun`, `x2-spore-spitter-blunderbuss`, `x2-caustic-drum-sweeper`, `x2-tesla-drumbore`, `x2-powderkeg-mortar`, `x2-graveshot-grenade-gun`, `x2-mauler-slug-thrower`, `x2-hexbore-voidmaw`, `x2-boneyard-ricochet-mortar`, `x2-ghostbolt-crossbow`, `x2-frostfang-speargun`, `x2-buckshot-bramble-bow`, `x2-hexbolt-spitter-mitt` |
| Split | `x-gun-coffin-shotgun`, `x2-gravewind-rimfire`, `x2-coyote-stinger`, `x2-dustline-lever-action`, `x2-sunbreaker-railgun`, `x2-venomspine-repeater`, `x2-ironhide-buffalo-gun`, `x2-gravelung-punt-rifle`, `x2-boneash-scattergun-rifle`, `x2-bonepicker-coachgun`, `x2-galvanic-coachgun`, `x2-emberfan-pumpgun`, `x2-pearlbreech-volleygun`, `x2-hellbore-gatling`, `x2-brimstone-rocket-tube`, `x2-pinwheel-caromer`, `x2-whisperbarb-hand-crossbow`, `x2-saintskull-monstrance`, `x2-voltvein-conductors`, `x2-hellmouth-palmcaster`, `x2-galvanic-overcasters`, `x2-gravedog-auto-rifle` |
| Shard | `x-gun-gatling`, `x2-hailshot-hand-maul`, `x2-cinderfang-derringer`, `x2-sidewinder-spitfire`, `x2-fool-s-gold-revolver`, `x2-tumbleweed-skipper`, `x2-hollowpoint-hex`, `x2-coffin-nail-carbine`, `x2-quicksilver-slugthrower`, `x2-tracer-saint-carbine`, `x2-brasswork-volley-rifle`, `x2-frostbore-scattergun`, `x2-carom-coachgun`, `x2-dustdevil-riotgun`, `x2-widowmaker-cannon`, `x2-hailstorm-coilgun`, `x2-plaguespitter-flak-gun`, `x2-hornet-s-nest-bolter`, `x2-reliquary-nailcaster`, `x2-gravesinger-s-hex-wand`, `x2-permafrost-cryo-bracer`, `x2-stormspur-coil-carbine` |
| Bloom | `x-gun-nailgun`, `x2-iron-marshal`, `x2-reliquary-repeater`, `x2-buzzard-s-eye-marksman`, `x2-cinderbore-longrifle`, `x2-sidewinder-twin-rifles`, `x2-hexbore-witchrifle`, `x2-buckshot-briar`, `x2-hollowpoint-voidgun`, `x2-slughammer-breachgun`, `x2-glasswidow-punchgun`, `x2-calamity-howitzer`, `x2-quill-storm-repeater`, `x2-snakebite-dart-slinger`, `x2-magpie-scattergun`, `x2-cinderquill-dart-caster`, `x2-tidehook-bombarpoon`, `x2-tesla-faradayer` |
| Needle | `x-gun-ricochet-pistol`, `x2-gravelthroat-repeater`, `x2-grit-snubnose`, `x2-sunbrand-hogleg`, `x2-quicksilver-fanner`, `x2-frostbite-volley-gun`, `x2-buzzard-s-burnout`, `x2-hollowpoint-repeater`, `x2-cinderchoke-blunderbuss`, `x2-hallowbore-coachgun`, `x2-wyrmgut-blunderbuss`, `x2-boomstick-saddlegun`, `x2-ironhail-pepperbox`, `x2-sanctus-siege-bombard`, `x2-carom-king`, `x2-leviathan-harpoon-gun`, `x2-grave-anchor-harpoon`, `x2-voidwell-idol`, `x2-brimstone-gallows-rifle` |
| Fork | `x2-brimstone-bull`, `x2-thunderhead-lever-gun`, `x2-ghostwind-spectre-rail`, `x2-quicksilver-streetsweeper`, `x2-twin-maw-greenerbore`, `x2-thunderhead-repeater-cannon`, `x2-buckshot-avalanche`, `x2-scattershell-duster`, `x2-cinderfan-dragoon`, `x2-coffinnail-driver`, `x2-widowmaker-arbalest`, `x2-embernail-repeater`, `x2-thunderhead-spikecaster`, `x2-ricochet-roulette`, `x2-gravewax-twin-idols`, `x2-spitfire-censer-wand` |

The live gun spawner receives the concrete weapon ID and positions the selected image at the guarded muzzle
offset. No new shake site was added; existing heavy/artillery shake remains under the shared budget.

## V6G5 forward-staff grips

The family sweep includes staff/stave forms plus the two staff-rig exceptions (Storm Rod and the two-hand
Gravesinger wand). Normalized X increases toward the head/business end.

| Weapon | Rear hand | Forward shaft hand |
| --- | ---: | ---: |
| `x-staff-arcane-lance` | 0.12 | 0.40 |
| `x-staff-storm-rod` | 0.14 | 0.42 |
| `x2-tallowtongue-pyre-stave` | 0.10 | 0.38 |
| `x2-gravesinger-s-hex-wand` | 0.16 | 0.42 |
| `x2-sunmote-reliquary-staff` | 0.10 | 0.40 |
| `x2-anvil-heart-quake-maul-staff` | 0.08 | 0.38 |
| `x2-hollowbarrel-spell-scattergun-staff` | 0.10 | 0.42 |
| `x2-saint-bough-frost-crozier` | 0.10 | 0.40 |
| `x2-mesa-spine-thunder-stave` | 0.10 | 0.40 |
| `x2-obsidian-maw-void-staff` | 0.08 | 0.38 |
| `x2-wormwood-hex-stave` | 0.10 | 0.38 |
| `x2-sanctum-brazier-staff` | 0.10 | 0.40 |

Every secondary point has role `shaft`; the test derives this 12-item family and requires a forward gap
greater than 0.20.

## Evidence and validation

The serialized Playwright live probe writes the five named screenshots and event JSON to
`docs/owner-notes-audit-v6-evidence/v6g1-*`, plus `v6g1-live-summary.json`. The final capture reported zero
endpoint error for all five cases, 105–218px separation from the wielder, no Riftcaller shockwave/sigil
layers, and Dustreaper's complete 150-particle `fire-wisp` recipe. All five browser error lists were empty.

| Validation | Final result |
| --- | --- |
| `pnpm typecheck` | pass |
| `npx vitest run` | 119 files passed; 1,654 tests passed; zero failures (baseline 1,640 + 14 coverage tests) |
| `npx playwright test e2e/tests/ --config=e2e/playwright.config.ts` | 15 passed; zero failures; serialized one-worker stack |
| V6G1 named live evidence | five screenshots + five JSON records + aggregate summary; every assertion true |
