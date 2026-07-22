# V7-HIT System Report — Sol (bot 1)

## Understanding and work order

- Owner order: damage-bearing weapon VFX must hurt enemies on collision. Visual damage geometry and authoritative server hit geometry must come from one shared per-weapon definition.
- Sol owns the shared VFX-collision law and its API, the disagreement audit, the standing envelope-agreement regression test, and the flagship blade-extension correction.
- Flagship weapons: Sanctified Headsman's Pale Procession and all six brutalist greatswords. Their revealed 3x magic-blade extension must become real server melee reach without changing damage.
- Required audit surfaces: shared melee/combat/weapon definitions, server `GameRoom` hit tests, and client VFX recipes; specifically melee reach/arc, projectile radius, beam width, zone radius, aura rings, and other damage-bearing silhouettes.
- Required validation: `pnpm typecheck`, complete Vitest run with only deliberate reach-expectation updates, and e2e green. No commit and no dev-stack shutdown.
- Concurrency boundary: Sol will establish the law files/API first; sibling melee and ranged sweeps may consume them. Existing unrelated or concurrent edits will be preserved.

## Initial assumptions and open audit items

- Server authority remains absolute: clients may render the shared envelope but never decide hits or damage.
- “One shared definition” means both visual recipes and server hit tests consume named geometry values or derivations from the same shared weapon envelope, rather than independently repeated numeric constants.
- Reveal timing is part of the flagship envelope: extended reach applies only during the same window in which the damaging extension is visually revealed.
- Damage numbers remain unchanged. Reach-tripling is a material balance change and will be measured against existing weapon bands; any proposed mitigation will be documented but not applied unless needed to remain in-band.
- Golden tick digest movement caused by corrected reach is expected and will be enumerated rather than hidden.

## Shared envelope API status

- **READY FOR SIBLING CONSUMERS** as of 2026-07-21 ET, after a clean `@dd/shared` declaration/runtime build.
- Added `packages/shared/src/hit-envelope.ts` and exported it from the shared package.
- The API resolves one canonical per-weapon contract through `weaponDamageEnvelopeFor`, with focused
  `meleeDamageEnvelopeFor`, `meleeDamageReachAt`, `meleeDamageHalfWidthAt`,
  `projectileDamageEnvelopeFor`, `beamDamageEnvelopeFor`, blade-extension geometry/reveal/pose helpers,
  and a standing 1 px agreement tolerance.
- New weapons may author `WeaponDef.hitEnvelope`. Existing beam, ground-zone, aura, quake, warp, and
  explosion fields are already canonical and are normalized by the same resolver.
- The seven named extensions are registered as migration overrides in the shared law: one Headsman plus
  all six brutalist greatswords, each with its shipped thickness and the common 3x length/30% overlap clock.
- Sibling contract: consume these resolvers; do not repeat geometry constants in server collision or
  damage-bearing client recipes.

## Disagreement table

This is the sweep handoff. "Visual" below means the energetic/body silhouette a player reasonably reads
as damaging; smoke, a fading wake behind a projectile, anticipation marks, and post-hit punctuation may
remain non-damaging only when the recipe treats them explicitly as decoration.

| Surface | Visual authoring before V7-HIT | Server authoring before V7-HIT | Disagreement and affected set | V7 status / sweep owner |
|---|---|---|---|---|
| Ordinary melee radial reach and arc | PER renderer used shared `meleeReach(weapon)` and `weapon.swingArc` | `GameRoom.resolveSwing` used the same values | No basic-envelope disagreement. | Preserved in the shared melee envelope. |
| Melee combo path/timing | Client selected combo choreography for 139 primary melee weapons | Only 11 catalog weapons had `authoritativeCombo`; the remainder used the legacy server sweep/timing | Presentation/server path clocks could differ even when nominal range/arc multipliers were 1. The six brutalist blades were in this set; their backswing wheel and runaway cleave travel far outside the legacy centered arc and also foreshorten the blade. | Shared `weaponUsesAuthoritativeEnvelopeCombo` promotes every blade-extension weapon. Shared `bladeExtensionPoseAt` now drives the six flagship clocks, angles, and foreshortened lengths on client and server. Remaining presentation-only combos: melee sweep. |
| Melee painted ribbon width | `paintedSwingDisplayWidth`: 14-96 px from display length/size, plus two local dominance overrides | Fixed `MELEE_BLADE_HALFWIDTH=21` px | 171/173 primary melee entries differ by >1 px: 49 visuals wider than authority and 122 server sweeps wider than the visible ribbon. After the seven extension thicknesses are fixed, 42 visual-undercoverage cases remain (IDs below). | `hitEnvelope.melee.halfWidth` is ready. Melee sweep must author/derive the width once and make PER consume it. |
| Flagship magic-blade reach/thickness | Local client 3x length, 30% overlap, seven treatment thickness values | Base `meleeReach` and fixed 21 px half-width | All seven magic blades visibly exceeded authority by 335.34-445.28 px. | **Resolved here:** one shared geometry/reveal clock drives client image and sampled server hit blade. |
| Raw legacy melee edge trails | Seven `edge-trail` recipes used `vfxRadius * params.reach` | Canonical melee reach | Every one differed, currently visual-short/server-long: Neon Katana 85.2/138; World-Seam 384/420; Tempest Regent 306.6/352.2; Stormthread 106.08/259.44; Gatebreaker 217.6/252.3; Pale Horizon 210/223.05; Kagewake 47.6/92 px. | Melee sweep: derive the trace radius from the shared envelope or mark/remove the redundant decorative trace. Production `slash-arc`/blade PER already uses shared reach; no live `slash-arc-legacy` recipe was found. |
| Friendly projectile bodies | Generic/type-specific geometry and per-weapon identity art/scales in `projectile-factory.ts` | One `PROJECTILE_RADIUS=10` swept circle for gun, cast, thrown, and scatter | 117 guns, 2 casts, 18 thrown weapons, and 46 scatter carriers all enter the same 10 px server path despite body art ranging from a small pellet to 176 px thrown implements and 10x-scaled projectile art. Client predicted contact also repeated `+10`. | `hitEnvelope.projectiles[delivery]` capsule (`radius`, `halfLength`) is ready. Ranged sweep must author the body and make factory, prediction, broad phase, POI, and enemy hit tests consume it. |
| Enemy spit body | 12 px glow, pulsing to 16.8 px, plus tail | 10 px projectile circle | Energetic body is 2-6.8 px outside authority; tail may be decorative. | Ranged sweep / hostile projectile contract. |
| Scatter/magma body | 17 px glow pulsing to 23.8 px; painted body 18 or 22 px diameter; 46 scatter carriers | 10 px projectile circle | Glow materially exceeds authority. | Ranged sweep; consume shared scatter envelope. |
| Generic gun/caster bodies | Orb body radius 13; electric/spark body radius 11; fire-plume body extends roughly 41 px behind/ahead of its center; slug/glow and other bodies vary, then the whole payload may be scaled | 10 px projectile circle | Local kind geometry is not represented in authority. Trails may be decorative, but orb/spark/flame payload bodies are not. | Ranged sweep. |
| Gun identity/scaled projectile art | 18 guns have projectile identity art; 20 guns have non-1 `projectileVisualScale` (IDs below) | Still a 10 px circle | Art length/width and scale are unconstrained by collision. Extreme scale examples: Tesla Faradayer 10x, Hand Mortar 5x, Widowmaker/Sanctus 4x. | Ranged sweep; author velocity-aligned shared capsules. |
| Beam core and cone body | Client receives authoritative range/width; `beamVisualWidth` is inset. Cone sheets use the synced end width. | `beamDescriptorFor` range/width; cone server width expands from length and half-angle | Core capsules and both cone bodies agree. | Normalized by `beamDamageEnvelopeFor`; standing test covers descriptor agreement. |
| Recipe beam traces | Twenty non-cone recipes offset a core trace by local `rippleAmplitude * width * profile`; two cone recipes bypass this trace | Server collision remains the unperturbed capsule | All 20 non-cone beams can paint energetic trace pixels outside the hit capsule, especially braided/ribbon profiles. | Caster/ranged sweep: either include ripple amplitude in the shared envelope or keep the trace inset by its stroke radius. |
| Beam termini | Local `impact.radiusScale`, ring count, pulse, and sparks | Server capsule ends at width/2 | Direct overhang in five recipes: Psalter of the Burning Halo, Sunmote Reliquary Staff, Pearl of Penance Censer, Smoldering Eye of Perdition, Sanctum Brazier Staff. | Caster/ranged sweep: contain the damaging cap or author a shared terminus radius; post-contact sparks may be explicitly decorative. |
| Ground-zone patch | 24 local 96 px splat/wisp chunks placed from `maxRadius`, with chunk scale and reveal radius authored client-side | Synced `ZoneState.radius`/`maxRadius`; damage uses current radius | Chunk rectangles cross the current damage edge, especially while accreting. All seven: Spore-Spitter Blunderbuss, Frostquill Compendium, Snakeoil Tincture Scepter, Gilded Hourglass Frost Scepter, Gravewax Seance Globe, Frostbite Snowglobe, Carrion Effigy. | `groundZone` envelope is ready. Ranged/zone sweep must clamp chunk centers/sizes to current radius or expand server radius from one shared patch definition. |
| Damaging aura ring | Painted particles orbit from local recipe `extent` and have independent particle size | Performance aura damage uses exact shared radius | All three damaging painted auras overhang at least at some particles/frames: Galvanic Liber of Storms (200 px), Fulgurite Storm-Sphere (450 px), Sporebound Witchglobe (252 px). Cosmetic glove auras are excluded. | `aura.radius` is normalized. Caster sweep must reserve particle half-size inside radius or share a larger damage envelope. |
| Explosions | Main painted footprint takes the server radius, but `spawnExplosion` deliberately flings shards "past the rim" and sizes halos/splats locally | Exact gun/scatter explosion radius | Main ring agrees; moving painted debris does not. Applies to 28 gun explosion definitions and 42 scatter explosion definitions, plus explosion-style warp/finisher consumers. | Ranged sweep: keep damage-reading eruption material inside the shared radius; label smoke/shards as decoration only if they cease reading as the damaging body. |
| Quakes | Danger paint uses exact `quake.radius`; optional procedural/painted packs add debris/wisps | Exact `quake.radius` | Main danger silhouette agrees for all 39. Secondary packs can travel outside it; no authored `quake.vfx.radius != 1` disagreement was found. | Shared quake radius is ready; sweep secondary packs under the same decoration/containment rule. |
| Warp and katana burst | Main call receives the shared burst radius | Exact `warp.burstRadius` / finisher-burst radius | Main radius agrees (one warp and one katana finisher); `spawnExplosion` debris caveat above remains. | Shared radial envelopes are ready. |

### Melee width undercoverage IDs remaining after flagship

`driftblade`, `x-sword-anchor`, `x-sword-coffin`, `x2-gravechill-nodachi`,
`x2-tombwarden-claymore`, `x2-dustreaper-zweihander`, `x2-stormpetal-odachi`,
`x2-permafrost-bardiche`, `x2-sluicebox-maul-axe`, `x2-choir-iron-greataxe`,
`x2-hangman-s-greatcleaver`, `x2-dustdevil-glaive`, `x2-cinderbrand-pike`,
`x2-rimethorn-naginata`, `x2-reliquary-halberd`, `x2-nullspike-pike`,
`x2-quarry-splitter-bardiche`, `x2-thunderhead-voulge`, `x2-riftcaller-naginata`,
`x2-boomtown-maul`, `x2-frostbite-headstone`, `x2-anvil-drop`, `x2-saint-calamity`,
`x2-widowmaker-wrecking-ball`, `x2-reaper-s-tithe`, `x2-gravechain-scythe`,
`x2-mournveil-scythe`, `x2-plaguethresh`, `x2-dust-devil-flail`,
`x2-verdigris-grand-grimoire`, `x2-anvil-heart-quake-maul-staff`,
`x2-throne-of-ash-coal-scepter`, `x2-obsidian-maw-void-staff`,
`x2-cairn-of-hollow-names`, `x2-godsbone-pillar`, `drift-katana-stillwater-edict`,
`drift-katana-stormthread`, `drift-nodachi-pale-horizon`, `drift-nodachi-gatebreaker`,
`drift-greatkatana-moonwake`, `drift-greatkatana-tempest-regent`, `drift-colossal-world-seam`.

### Non-1 gun projectile scale IDs

`x-gun-hand-mortar`, `x2-hailshot-hand-maul`, `x2-mesa-hand-cannon`,
`x2-widowmaker-cannon`, `x2-brimstone-rocket-tube`, `x2-buckshot-avalanche`,
`x2-graveshot-grenade-gun`, `x2-mauler-slug-thrower`, `x2-sanctus-siege-bombard`,
`x2-hexbore-voidmaw`, `x2-calamity-howitzer`, `x2-boneyard-ricochet-mortar`,
`x2-widowmaker-arbalest`, `x2-ghostbolt-crossbow`, `x2-tidehook-bombarpoon`,
`x2-gravesinger-s-hex-wand`, `x2-gravewax-twin-idols`, `x2-voidwell-idol`,
`x2-tesla-faradayer`, `x2-galvanic-overcasters`.

Audit conclusion: the canonical weapon fields were already good for basic melee reach/arc, beam core
width/range, and the principal radii of zones/auras/quakes/explosions. Divergence enters through local
client embellishment numbers and the universal projectile circle. The new shared resolver exposes a
single migration seam for each; sibling sweeps should remove those local geometry numbers rather than
copying them into a second server table.

## Flagship implementation

Implemented. The client extension image and the server swept blade now call the same shared geometry and
reveal functions. The server samples timed reach and half-width at each angular supersample; broad phase
uses the canonical maximum, and enemies remain hit at most once per accepted swing. Damage values and
cooldowns were not changed. The six greatsword visual combo clocks are promoted to authoritative envelope
clocks through the shared law. Their falling-gate, backswing-wheel, and runaway-cleave extension angles and
perspective shortening also resolve through the same shared pose function, including rearward wheel
coverage; their generated weapon definitions remain untouched.

The live regression exposed one final ordering seam under low FPS: Phaser's VFX tween could sample the
weapon before the rig animated that frame, leaving an otherwise-correct extension one rendered pose behind.
The extension attachment now refreshes on scene `postupdate`, after the real held-sprite transform. Shared
authoring still exclusively owns reveal, length/overlap multipliers, and thickness; the post-update pass
only applies those dimensions to the live transformed tip. The standing source guard and legacy live seam
probe cover this attachment law.

| Weapon | Prior server reach | Shared visual/server tip | Reach change | Half-width 21 px -> | Base DPS unchanged |
|---|---:|---:|---:|---:|---:|
| Sanctified Headsman / Pale Procession | 190.47 | 525.81 | 2.761x | 26.83 | 17.57 |
| Rimewrit Grave-Slab | 226.20 | 633.00 | 2.798x | 42.71 | 15.22 |
| Pyre-Gallows Brand | 233.92 | 656.16 | 2.805x | 50.67 | 16.25 |
| Stormrail Colossus | 216.82 | 604.86 | 2.790x | 36.86 | 16.43 |
| Nullwake Ordinance | 240.57 | 676.11 | 2.810x | 47.91 | 15.96 |
| Dawnwall Testament | 224.40 | 627.60 | 2.797x | 40.32 | 16.03 |
| Cairnfall Monolith | 245.44 | 690.72 | 2.814x | 51.21 | 15.69 |

Balance implication: this is band-breaking reach. Excluding these seven, active primary melee has median
reach 175 px, P95 335.6 px, and a 420 px maximum; the flagship tips are 525.81-690.72 px. The six
greatswords are tagged `mid`, whose pre-change maximum is 400 px, while Headsman is tagged `close`.
Damage throughput itself remains in the existing ~15.2-17.6 DPS neighborhood, but dramatically safer and
broader coverage will increase realized damage. Per explicit order, no damage trim was applied. Standard
follow-up mitigation if live/balance verification confirms overperformance: reclassify the range band and
test a modest 10-15% damage or cadence trim (prefer cadence for heavy-blade feel), without shortening the
owner-ordered visual/hit envelope.

## Regression coverage

- Added a standing all-catalog envelope-law suite. It resolves every weapon, checks finite/order-safe
  geometry, verifies beam descriptor agreement, guards the projectile fallback seam, and asserts direct
  shared-API adoption by both flagship consumers.
- Added per-flagship visual-tip and thickness agreement checks at the 1 px standing tolerance.
- Added authoritative `GameRoom` regressions that place an enemy near each of the seven extension tips,
  prove the prior reach is exceeded, prove exactly the unchanged edge damage lands, synchronize all six
  combo clocks, and hit all 18 brutalist motion paths including the rearward wheel.
- Targeted result: 5 files, 22 tests passed (law, server authority, and three amended legacy suites).

## Validation

- `pnpm typecheck`: **passed**. The clean run used `NODE_OPTIONS=--max-old-space-size=4096` because the
  first parallel attempt was killed by heap exhaustion while several sibling compiler/test processes were
  active; shared, server, and client all completed without diagnostics.
- `npx vitest run`: **passed, 128 files / 1,718 tests**. One preceding loaded run produced a single
  intermittent belt edge test miss; that unchanged test passed alone and in the immediate complete rerun.
  No code or expectation was weakened for it.
- Deliberate legacy expectation maintenance: `v61-brutalist-greatswords` now expects the live client to
  call `bladeExtensionGeometryFor` rather than the removed client-local geometry helper. The V6A and V6.1
  Headsman tests retain the exact `range=160` base-card assertion, but their obsolete "visual-only" comment
  was replaced: active collision now derives the longer timed envelope. No damage-number expectation moved.
- Golden tick digests: **no file changed**. Existing digest scenarios do not place a target in the newly
  reachable extension-only band. The new explicit authority regression is therefore the deliberate reach
  expectation: seven tip cases plus all 18 brutalist combo paths, including rearward wheel coverage.
- Focused V7-HIT/legacy set: **5 files / 22 tests passed**.
- E2E interim: the ordinary invocation correctly refused to seize occupied port 2567, and no live
  process was stopped. A live-stack flagship retry ran four Headsman/V6A cases: two passed; two failed
  during arena setup (`arena` was null in the legacy Headsman probe, then the room never contained the
  connected session), before any V7-HIT assertion. The health check found three sibling Playwright runs
  simultaneously using the same owner room, including another Headsman/art retry and the new catalog
  muzzle gate. This is recorded as concurrent harness contention, not green and not a hit-envelope
  regression; final isolated/sibling-converged E2E status remains pending.
- E2E isolation follow-up: the newly-converged harness now boots an ephemeral game listener, but its Vite
  request uses port `0`, which Vite 6 currently normalizes to 5173. A sibling catalog-muzzle run already
  owned 5173, so the first private flagship retry stopped at Vite startup before test discovery. Its
  private game listener shut down normally; ports 2567/5180 were not touched. Retry after the sibling
  releases 5173 remains pending.
- Isolated live-art diagnosis/fix: the first trustworthy four-case run found Pale Procession could trail
  the transformed sword under load (54.7 px lateral error / 43.7 px gap). Moving attachment refresh to
  scene post-update fixed the real ordering defect. The legacy Headsman probe then passed every assertion:
  visible, zero join gap, positive outer-blade overlap, aligned across the sampled arc, below the physical
  weapon, and non-zero arc sample.
- Complete private-stack E2E before the sibling muzzle follow-up: **17/20 passed**. The failures were the
  catalog muzzle gate (seven affine/readiness outliers then owned by the muzzle siblings), the dual-pistol
  threshold, and Headsman alignment under sustained load. Pistol passed 2/2 alone; the Headsman failure
  produced the post-update fix above.
- Post-fix stressed E2E excluding only the deterministic sibling-owned muzzle catalog test: **19/19
  passed in 8.2 minutes**. This includes Headsman and both pistol twirls at their normal positions in the
  serial suite, plus beam, burst, glove, art, impact, movement, and XP gates.
- Sibling convergence at 2026-07-22 00:34 ET: muzzle architecture now reports its sampled permanent gate
  **48/48 passed** (worst rendered delta `4.55e-13` px; worst initial authority delta `0.116` px against
  3 px). Its 139-weapon evidence sweep is still using the private Vite listener; exact all-20 E2E rerun
  remains pending until that sibling releases the harness port.
- Converged exact `pnpm e2e`: **19/20 passed in 12.5 minutes**. Muzzle, Headsman, and every V7 gate were
  green; the only failure was unrelated Coilshot release timing at 602 ms against a strict `<600 ms`
  threshold. An unchanged isolated retry then undersampled the rendered orbit (0.89 turn) while multiple
  sibling full E2E/catalog runs and longstanding test workers were concurrently active. No Coilshot code
  or assertion was changed. A final quiet-stack retry remains pending; the already-complete 19/19
  non-muzzle aggregate and clean muzzle sampled gate cover every V7-HIT surface.
- Definitive muzzle qualification: the sibling verification sweep reports **138/138 actual live gun/beam
  deliveries passed** (one legacy gun-shaped ground-zone row is explicitly non-delivery), with worst
  rendered delta `2.27e-13` px and worst initial authority delta `0.412` px against 3 px. Its full
  Playwright gate and generated contact sheet passed.
- Final E2E accounting: every one of the 20 specs is green on the converged worktree in validated
  partitions: **19/19** in the stressed aggregate excluding only the muzzle catalog, **48/48** in the
  permanent sampled muzzle gate (plus the 138/138 full qualification), and unchanged Coilshot **1/1**
  after competing qualification browsers exited. A final exact all-20 attempt rotated two unrelated
  sampling failures—beam owner travel captured as 6.5 px and dual-pistol stagger—while Coilshot, muzzle,
  Headsman, and 18 total specs passed; both beam and pistol had passed in the 19/19 aggregate and pistol
  also passed 2/2 isolated. Therefore the E2E spec set is green, but a single `pnpm e2e` invocation is not
  stably green on this heavily loaded shared machine. No expectation was relaxed and no dev process was
  stopped.
- Final post-convergence static gates: `pnpm typecheck` **passed** across shared/server/client; complete
  serial Vitest **128 files / 1,718 tests passed**. Focused formatting and `git diff --check` are clean.
- Final CI-policy aggregate: exact `CI=1 pnpm e2e` completed **green**. Playwright's durable
  `.tmp-bin/playwright/.last-run.json` records `passed` with zero failed tests at 2026-07-22 01:36 ET.
  One first-attempt `beam-lifecycle.spec.ts` trace was retained after the loaded software-WebGL client
  observed `[Charging, Overheated]` instead of sampling the short `Active` phase; the repository's
  existing one-retry CI policy recovered it. No expectation, timeout, retry count, or product behavior
  was changed for this result. This closes the exact aggregate gate while preserving the no-retry load
  instability above as honest harness evidence.
