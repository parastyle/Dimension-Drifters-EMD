# B95 Three Enemies

Owner: Sol `b95-three-enemies`  
Branch: `sol/b95-three-enemies`  
Date: 2026-07-28

## Outcome

The live combat taxonomy is now Runner, Cultist, and Big. The seven former non-boss
behaviours (`swarm`, `rusher`, `ranger`, `spitter`, `leaper`, `duelist`, and `zoner`) no
longer exist as live archetypes; the former `boss` category is now Big. Historical kind
ids remain valid persistence/data lookup keys, but a post-merge normalization pass
collapses every field row into Runner or Cultist before a roster consumer sees it.
`dummy` remains only because the Testing Grounds needs its inert damage fixture; it is
explicitly excluded from the combat taxonomy.

The shipped pacing is therefore:

1. Runner: cheap swarm pressure.
2. Cultist: authored-weapon threat.
3. Big: the existing unique rule-changing spectacle.

## Runner

- Every Runner uses `proto-frost-rune-guardian`, is weaponless, has no ranged controller,
  and seeks the nearest living player through the allocation-free density path.
- `MAX_ENEMIES` and the gated debug spawn limit are now 200.
- The run pose is a full-body sprint vocabulary, not a small walk modifier: torso pitch
  and compression, long opposing arm pumps, high knees, foot rotation, and a visibly
  bobbing body all change the crowd silhouette. The lunge stretches and pitches the body
  forward while both hands fling forward and both feet trail behind.
- The lunge moves the enemy, never the player root. It remains a parryable body attack.

The lunge reuses the existing leaper state machine rather than adding another attack
controller: the existing combo-state ledger, `COMBO_LEAP_RANGE`, committed landing
point, air-flight interpolation using `COMBO_LEAP_AIR_TICKS`, landing-marker
creation/cleanup seam, `COMBO_LEAP_COOLDOWN`, frozen strike vector, nav-valid final
commit, and recovery path. Runner intentionally spends no fairness offer: its marker is
removed immediately, it enters flight on the same decision, and its weaponless
one-tick impact uses the whole rig. The old leaper's offer/settle choreography remains
compatibility code only and is unreachable from normalized live rows.

## Runner CPU density

`tools/bench-runner-density.ts` measures only the authoritative
`GameRoom.stepDuelists` Runner AI loop: 20 warm-up ticks, 40 retained raw samples per
count, and the real 50 ms server-tick budget. It does not include the rest of the room,
network serialization, client pose work, or rendering.

Run command:

```text
pnpm --filter @dd/server exec tsx ../../tools/bench-runner-density.ts
```

Latest clean-host result:

| Runners | Mean AI tick | p95 AI tick | Mean per Runner |
| ---: | ---: | ---: | ---: |
| 50 | 0.0368 ms | 0.0555 ms | 0.736 us |
| 100 | 0.0735 ms | 0.1226 ms | 0.735 us |
| 200 | 0.1240 ms | 0.1723 ms | 0.620 us |

The isolated loop's last sampled p95 below budget was 48,000 Runners at 33.6009 ms.
The first break was 51,200 at 51.6375 ms p95. This is an implementation ceiling, not a
recommended game count; the shipped cap of 200 leaves the Runner AI loop at about
0.25% of one 50 ms tick on this host. The benchmark emits all 40 raw samples for every
count so a single-frame spike cannot disappear into a mean.

## Runner render density

The requested live client frame costs could not be measured in this worktree:

| Runners | Live frame cost |
| ---: | --- |
| 50 | unavailable — no browser surface |
| 100 | unavailable — no browser surface |
| 200 | unavailable — no browser surface |

I attempted the repository's required in-app Browser workflow, including browser
discovery, and it returned an empty browser list. I did not substitute a standalone
browser or grade source inspection as live proof. Consequently, the density-versus-
animation rendering requirement remains unverified even though the CPU AI requirement
has ample headroom.

If the owner's live run misses its frame budget, the cheapest honest response is
distance-based pose LOD: retain the complete near Runner sprint/lunge, animate fewer
far-joint transforms, then group far animation phases. Horde count and the full-body
near animation should remain intact; silently thinning the horde or reverting Runner to
a subtle gait would defeat the design.

## Cultist

Cultists rotate the six ordered purple player-character identities:

- `proto-punk-occult-summoner`
- `proto-ninja-purple`
- `proto-wizard`
- `proto-cyberpunk-hacker`
- `proto-alien-void-scholar`
- `proto-hooded-rogue`

Each spawn owns a real active catalog weapon id. The existing enemy-held weapon render
and drop path now reads that per-instance id, so this work does not invent a second
wield/drop system. The AI's approach policy is selected once by authored weapon
subclass, while attack execution reads the actual `WeaponDef`: melee performance and
combo descriptors, gun cadence/magazine/reload/burst/muzzles/pellets, casts, thrown
charges/refill/return/helix/ricochet/landing zones, charged projectiles, beams,
continuous zones, auras, damage, range, cooldown, element, projectile presentation, and
VFX/audio attribution.

Parallel authored barrels divide damage across their simultaneous muzzle rows, matching
the player's total-damage contract rather than multiplying it.

### Subclass to behaviour table

Preferred and retreat distances are fractions of that weapon's authored useful range;
strafe controls orbit pressure. No weapon id has bespoke AI.

| Behaviour | Weapon subclasses | Approach |
| --- | --- | --- |
| `blade-duelist` | Broadswords, Energy Blades, Katanas, Rapiers, Sabers, Swords | close to 0.72 range, commit from 0.35, light orbit |
| `heavy-breaker` | Axes, Cleavers, Greatswords, Maces, Mauls, Nodachi, Warhammers | close to 0.62, retreat at 0.25, no orbit |
| `reach-keeper` | Flails, Glaives, Halberds, Harpoons, Naginatas, Partisans, Scythes & Sickles, Spears, Whips & Chains | hold 0.88, retreat at 0.58 |
| `brawler` | Claws, Fist Blades, Martial Arts | crash to 0.45, never retreat |
| `thrown-skirmisher` | Thrown Weapons, War Fans | hold 0.62, retreat at 0.42, strong orbit |
| `automatic-suppressor` | Auto Rifles, Machine Pistols, Rotary Guns | hold 0.55, retreat at 0.38 |
| `scatter-flanker` | Blunderbusses, Heavy Scatterguns, Scrap Cannons, Shotguns | close to 0.42, strong flank |
| `precision-marksman` | Crossbows, Hand Cannons, Lever Rifles, Marksman Rifles, Railguns | hold 0.82, retreat at 0.62 |
| `artillery-bombardier` | Launchers & Mortars, Siege Cannons, Spike Launchers | hold 0.72, retreat at 0.56, no orbit |
| `mobile-gunner` | Harpoon Guns, Pistols, Ricochet Guns | hold 0.58, retreat at 0.36, mobile orbit |
| `beam-channeler` | Foci, Gauntlets, Staves & Rods | hold 0.66, retreat at 0.50 |
| `ritual-caster` | Battle Grimoires, Orbs, Relics & Totems, Scepters, Spellbooks, Wands | hold 0.70, retreat at 0.50 |
| `adaptive-special` | Special | neutral 0.62/0.40 policy; delivery still comes from the weapon |

This is 13 behaviours covering every active authored subclass and every active catalog
weapon.

### Authored weapon evidence

The permanent GameRoom tests spawn each selected weapon through the real debug RPC,
step the Cultist controller, and compare emitted state to the catalog definition rather
than duplicating expected mechanics:

| Sample | Evidence |
| --- | --- |
| Revolver Cannon (`x-gun-revolver-cannon`) | hostile projectile carries Cultist owner and weapon ids; runtime cooldown equals authored 0.5 s; magazine becomes 5/6 |
| Gravewarden Buster (`gravediggers-spade`) | damages on the authored 0.19968 s impact clock and enters its authored 0.6 s cooldown |
| Arcanist's Lance (`x-staff-arcane-lance`) | emits the authored 3-bolt, 0.16-spread volley and uses the cast's 0.62 s cooldown |
| Rusty Cleaver | consumes one of 3 authored charges, uses 0.26 s attack cooldown, and retains the 1.5 s refill ledger |
| Mirage Coilrifle | stays in exact 0.65 s charge, creates a beam attributed to the Cultist/weapon, and damages on the 0.1 s tick rate |
| Quicksilver Fanner | emits six sequential burst rows at 0.05 s intervals with indices 0–5 while spending one round from its six-round magazine |

## Big

All 13 existing `BOSS_DEF_IDS` are classified as Big and still enter the existing
`spawnBoss`/`BossController` path. No BossDef, controller phase, HP, damage, attack, or
movement logic was changed to make Bigs tougher. A permanent test iterates all 13,
asserts the concrete Big root spawns, and asserts the existing controller remains
attached. The broader boss phase, boss-rush, and dimension boss suites also remain
green.

## Testing Grounds controls

The existing dev-tool path was extended; no second spawn system was added.

- Count chips: 1, 50, 100, or 200.
- Runner button: spawns the chosen count.
- Cultist button: spawns the chosen count with either Random or the selected active
  catalog weapon. Left/right click cycle the selector in either direction.
- Big pages: spawn a specific one of the 13 existing definitions.
- Clear Field: removes Runners, Cultists, Bigs, hostile/friendly projectiles, beams,
  zones, controllers, and their runtime ledgers.

Server mutation remains behind `serverDevToolsEnabled()` through the existing
`devToolsEnabled()` seam, action-rate limiting, and `mode === "training"`. The UI remains
behind `clientDevToolsEnabled()`. Production clients and production server authority
cannot reach these controls.

## Dimensions, readability, and friendly fire

The generated rosters for Wild West, Frostfell, Verdant Ruins, Ashlands, Neon Cyber,
and Lava Foundry now resolve to Runner/Cultist while preserving each existing Big. The
full suite's lava contract passed all 13 checks, including byte-identical routing for
the five historical generators and the 2,000-seed exact surface-clearance/jumpability
invariants.

No art was created for the later infected/robe variants. The current Frost Guardian
versus six purple Cultist identities keeps the requested temporary distinction and does
not constrain later appearances.

I could not make a live co-op readability observation because no browser surface was
available. Structurally, these enemies now use the same rig family as players and this
batch adds no ally/enemy marker change, so mistaken target acquisition remains a real
owner-test risk. It was not solved outside scope.

## Verification

- `pnpm gen:check`: pass. It emitted the existing availability warnings for 375
  untracked weapon-reference artifacts and unavailable measurement for 77 characters;
  all tracked generated outputs were in sync.
- `pnpm typecheck`: pass for shared, server, and client.
- Focused archetype/authored-weapon suite: pass.
- `pnpm test` pass 1: 251 files, 2,940 passed, 42 skipped.
- `pnpm test` pass 2: 251 files, 2,940 passed, 42 skipped.
- `git diff --check`: pass.
- G7 call sites are literal-source pinned for the server tick dispatch, spawn identity
  initialization, mixed-in controller methods, appearance resolution, and Runner
  animation vocabulary.
- Player locomotion authority, map collision primitives, lava invariants,
  `data/weapon-concepts-300.json`, foundation art, and the walkability painter remain
  untouched. The only boss-registry-facing edit is the owner's explicitly ordered
  `boss` -> `big` classification; all 13 BossDefs and controllers remain untouched.

VERDICT: archetypes replaced 8->3; runner cost/max count 0.620 us at 200 / 48,000 p95 sustainable (tick budget breaks at 51,200); subclass behaviours 13; cultist weapon evidence YES (6 authored delivery samples); bigs unchanged YES; testing controls added YES; 2x test results PASS (2,940 passed each).
