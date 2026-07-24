# B20 Lane 2 implementation report — chests and relics

## Understanding

Lane L2 makes server-authored chests the sole in-run weapon/relic/money itemization channel while
leaving the L3-owned shop, disassembly, and banking surfaces otherwise unchanged. Legacy ordinary,
tough, wielder, worm-anatomy, boss, and boss-rush reward paths no longer mint weapons or money.
Chests spawn on valid, walkable arena ground, never block
movement, roll their contents only when a player opens them, and are consumed independently per
player. Relics are run-scoped `PlayerState` power: common lines stack additively and rare lines
change an ability or add a bounded survival rule. Presentation is a compact HUD row plus a brief
non-blocking receipt card. L2 does not implement floor disassembly, banking, shop removal, booster
packs, or the final catalog tier curve.

## Initial design

### Cadence and deterministic ownership

| Setting | Initial value | Rule |
| --- | ---: | --- |
| Baseline spawn interval | 55 seconds | One scheduled chest after every interval. |
| Spawn jitter | ±15 seconds | Drawn from the chest cadence stream. |
| First chest | 25 seconds | Gives a new run an early itemization target. |
| Weapon rubber-band | 150 seconds | If no weapon-bearing chest has spawned in this window, the next chest is a weapon cache. |
| Open reach | 72 world units | Server validates opener distance and alive state. |

Chest cadence, placement, contents, and each player's contents use separate seeded streams mixed
from the room seed, chest sequence, tick, purpose tag, and (for contents) the stable player session
key. No chest draw advances mapgen, combat, loot, or any pre-existing random stream. Catch-up
spawns are derived from authoritative ticks, so all clients observe the same chest rows.

The synchronized `ArenaState.chests` rows contain an id, x/y position, map-zone value, spawn tick,
kind (`STANDARD` or guaranteed `WEAPON_CACHE`), global `opened` presentation state, and a per-player
consumption map. A chest becomes globally open-looking once every currently participating player
has consumed it, while each player remains entitled to exactly one roll. The chest has no physics
body or navigation blocker.

### Zone-risk placement and roll weights

Placement samples existing mapgen/nav candidates and rejects pits, POI interiors, blocked tiles,
and unsafe spawn points. Candidates in `MAP_ZONE_SCAR` are intentionally more valuable than
commons-zone candidates.

| Roll | Commons zone | Scar zone |
| --- | ---: | ---: |
| Standard chest weapon chance | 50% | 70% |
| Relic bundle chance | 70% | 85% |
| Money bundle chance | 80% | 90% |
| Weapon tier weight: low / mid / high | 60 / 30 / 10 | 35 / 40 / 25 |
| Relic rarity weight: common / rare | 92 / 8 | 80 / 20 |

The three content categories roll independently, but every standard chest is repaired to at least
one category. A `WEAPON_CACHE` always includes a weapon and still rolls relics and money normally.
Weapon tier weights are shifted upward by elapsed run time before weapon candidates are sampled.
Until L5 replaces it, the placeholder tier is derived only from each weapon's authored flat damage
budget (`low`, `mid`, `high`) and is clearly isolated behind the chest weapon sampler.

Common stacks are capped at 20 per line so synchronized counts, Drive hundredths, and every derived
effect remain bounded. Initial bundle tuning:

| Content | Amount |
| --- | --- |
| Weapon | 1, delivered through the existing authoritative bag/arsenal flow |
| Common relics | 1; 20% chance of a second line |
| Rare relic | 1 and no bonus common line from that relic roll |
| Money | 8–16 plus 1 per elapsed run minute, settled through the existing money/scrip flow |

### Relic table

All common values below are additive per copy and server-clamped at the application boundary where
needed. Luck is stored and affects only L2 chest quality rolls in this lane.

| Common relic line | Per-copy effect |
| --- | ---: |
| Energy pool | +10 maximum energy |
| Energy regeneration | +0.8 energy/second |
| Parry reach | +8 world units of radius/forgiveness |
| Dodge recovery | −0.06 seconds cooldown |
| Move speed | +3% base movement speed |
| HP regeneration | +0.25 HP/second |
| Luck | +5% additive quality bias |
| Critical chance | +2 percentage points through L1's additive crit hook |
| Jump count | +1 air jump |

| Rare relic | Server-owned behavior |
| --- | --- |
| The Shuffle | Short, low-recovery dodge with the standard fair i-frame duration |
| Ninja Flip | Longer acrobatic dodge with higher recovery and the standard fair i-frame duration |
| Phase Step | Short out/in presentation, medium distance/recovery, standard fair i-frame duration |
| Bloodhound Step | Longest distance and recovery, standard fair i-frame duration |
| Second Wind | Revives the owner once per run, then marks itself spent |
| Death Ward | A lethal hit received above 35% max HP leaves 1 HP; 90-second cooldown |

Rare dodge relics are mutually overriding: the most recently acquired dodge type is active, while
ownership remains visible. Re-rolling an already-owned non-stackable rare repairs to a common line.
Ultimate-grant relics remain a later content integration because L1 deliberately left one interim
ultimate and the L2 task explicitly enumerates the six rare behaviors above.

### Player state and effect application

`PlayerState.relics` stores integer common-stack counts, owned rare ids, the active dodge override,
revive availability/consumption, and one-shot-protection cooldown tick. Authoritative derived
values are computed from counts rather than synced as a second mutable source of truth. Energy
maximum/regeneration, dodge recovery, parry reach, movement speed, HP regeneration, crit, jump
count, revive, and lethal protection are applied by the server. Existing client prediction reads
the synchronized relic counts/override for movement, dodge, and parry presentation.

The client renders owned relics as a compact icon/count row in the existing arena HUD language.
Opening a chest emits an owner-only reward receipt used for a short toast/card; it does not pause,
capture input, freeze simulation, open a modal, or add an aura.

## Implementation log

### Shared state and deterministic rules

- Advanced the synchronized schema to 35. `ArenaState.chests` owns position, zone, kind, tick,
  global presentation state, and per-player consumption. The existing nested `DualWieldState`
  tail now owns `RelicState`, keeping `PlayerState` under its direct-field ceiling.
- Added pure, purpose-seeded chest cadence, placement, reward, placeholder weapon-budget tier,
  relic math, dodge-profile, revive, and Death Ward helpers. Category, weapon, relic, and money
  rolls each have a separate `mixSeeds` branch and cannot perturb existing RNG streams.
- Appended an owner id to synchronized money drops. A player id makes chest scrip opener-instanced
  without forking the established homing/collection flow.

### Server authority

- Added the arena-only chest director, 25-second first spawn, 55Â±15-second cadence, and forced
  150-second weapon-cache deadline. Placement uses `isArenaDiscSafe` and existing zone/POI/pit
  helpers, and chest rows have no collision or navigation body.
- Added the budgeted `openChest` action with alive, range, existence, and per-player-consumption
  validation. Rewards roll only on accepted open; weapons enter the existing bag/arsenal flow,
  relics apply to the opener, and money uses owner-instanced money drops. A full bag leaves a
  weapon-bearing chest unopened for that player.
- Retired both legacy weapon-drop implementations and every enemy/boss weapon callsite. The
  temporary L1 kill-to-money production callsites (ordinary/tough enemies, worm anatomy/core,
  ordinary bosses, boss rush, and Vastaghar) are also retired; their combat cleanup and progression
  gates remain intact. `dropMoney` now has one runtime production caller: accepted chest OPEN.
- Applied all nine common lines at server seams: Drive capacity/regen, parry reach, roll cooldown,
  locomotion speed, HP regen, L2 luck, L1 additive crit, and extra traversal launches.
- Applied all six rare lines: four mutually overriding dodge profiles, once-per-run Second Wind,
  and threshold/cooldown Death Ward. Dodge profiles vary displacement, recovery, and presentation
  while retaining the existing fixed roll duration/contact i-frame ticks.
- Run restart/training reset relic ownership; rift descent preserves relics as part of the same run
  while reminting the floor's chest stream.

### Client presentation and prediction

- Added a simple geometry-only placeholder chest with closed/open states, explicit Scar/Commons and
  weapon-cache labels, and no physics body. `E` targets the nearest eligible pickup or unopened chest
  through the existing interaction route.
- Added a compact `RELICS` abbreviation/count row and owner-only chest/rare-trigger toasts. These are
  retained HUD text and brief banners only: no modal, input capture, simulation pause, or aura.
- Movement and roll prediction now read synchronized relic values. Shuffle adds a plant beat, Ninja
  Flip tilts through the roll, Phase Step fades the rig during the fixed roll window, and Bloodhound
  draws a longer doubled wake. Parry-reach stacks show one transient predicted reach boundary on
  brace. The Drive HUD uses the authoritative relic-expanded capacity.

### Tests and migration

- Added cadence/deadline simulation, deterministic placement/rolls, zone weighting,
  per-player-instancing, common stacking, dodge overrides, revive, Death Ward, and expanded Drive
  HUD tests. The deterministic weighting census proves Scar increases rare/high-budget outcomes and
  the later run clock increases high-budget outcomes. Added room-level tests for authoritative safe
  placement, independent co-op consumption, server dodge distance/recovery, crit/regen, once-per-run
  revive, Death Ward, and zero enemy/boss itemization.
- Migrated schema assertions to 35. Full verification and private-port evidence are recorded below
  after the live gate.

### Art order

- Replace the geometry-only closed/open chest primitive with an authored non-colliding chest sheet.
  Required states: Commons closed/open, Scar closed/open, and weapon-cache tell. No art was generated
  in L2; no cover/collision body should be introduced by the future asset.

## Verification

- `pnpm gen`: passed.
- `pnpm gen:check`: passed. The existing unavailable reference-art and character-scale notices were
  emitted without an out-of-sync generated file.
- `pnpm typecheck`: passed for shared, server, and client.
- Full `pnpm test`: 171 test files passed; 2,214 tests passed.
- `pnpm assets:check`: passed (478 sprite entries, 1,007 parts, 635 atlas frames, 320 cards).
- `git diff --check`: passed. All 19 touched text files use LF with no CRLF sequences.

## Private live gate

The isolated server ran on port 55109 and the Vite client served on port 55110; the lane did not
use protected ports 5180 or 2567. A two-player `proto-cowboy-hidden-face` room ran for 165.11
seconds and retained schema-35 transport observations under the evidence path below.

- Room `Aeo-WsQNe` spawned four valid-ground, non-blocking chests: tick 500/Scar, 1821/Cover,
  2735/Scar, and the locked weapon cache at tick 3000/Commons.
- Both players independently opened every chest: eight owner receipts across four synchronized
  chest rows. Weapon, relic, and money rewards were all observed, including different rolls from
  the same chest.
- The first Scar chest granted The Shuffle. Its authoritative action covered 210.6 world units and
  retained the shared eight-tick roll/i-frame window.
- The compact relic-HUD inputs were populated for both players. Input acknowledgement advanced
  after every OPEN while the room remained active, proving that opening did not interrupt gameplay.
- The retained artifact has zero errors and zero open denials. The connected visual browser surface
  was unavailable after the browser skill's recovery check, so no substitute headless browser or
  screenshot was fabricated; `live-observations.json` is the real Colyseus transport/state/action
  capture, and the evidence README records the limitation.

Evidence:
`docs/owner-notes-audit-v11-evidence/b20-l2-chests-relics/`

Files touched: 19 (shared chest/relic/state contracts, server authority and migrated tests, client
prediction/HUD/presentation, focused unit tests, implementation report, and private-gate evidence).

verdict: chests live (cadence + rubber-band + zone-risk), relic system live (9 commons, 6 rares), per-player instancing live, art orders flagged, evidence path `docs/owner-notes-audit-v11-evidence/b20-l2-chests-relics/`, 19 files touched.
