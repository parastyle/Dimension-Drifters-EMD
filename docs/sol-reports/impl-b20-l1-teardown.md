# B20 Lane 1 implementation report — core stat/level teardown

## Understanding

Lane L1 implements the owner-locked removal of in-run character stats, weapon stat scaling and
requirements, XP, and levels while preserving the complete playable combat/content surface.
Weapon and per-source damage must be the authored flat damage, time/charge/loot/quirk factors that
are independent of attributes remain intact, crit uses a flat 5% base plus an additive modifier
accumulator, XP-producing kills pay the existing `PlayerState.scrip` money counter, and the
ultimate system remains playable through a flat damage/activity charge threshold. Chests/relics,
shopkeeper/economy redesign, booster meta, weapon tiers, kung-fu wraps, fans, Wyrmskull, and Mirage
remain outside this lane.

## Initial touchpoint inventory

### Weapon definitions, source data, and generation

- `packages/shared/src/weapons.ts` owns `WeaponDef`, all behavior-source definitions, scaling grade
  helpers, requirement penalties, per-source damage descriptions, and hand-authored weapon rows.
- `data/weapon-concepts-300.json` is the source catalog containing top-level and nested
  `scalingGrades`/`requirements` rows.
- `tools/artkit/gen-weapon-expansion.mjs` validates, normalizes, and emits the catalog's stat
  coupling.
- `packages/shared/src/weapons-expansion.generated.ts` is the generated catalog output.
- `packages/client/src/scenes/arena/card-art.ts`, `packages/client/src/scenes/ArenaScene.ts`,
  `packages/client/src/ui/pair-preview.ts`, `packages/client/src/ui/level-up-model.ts`, and
  `packages/client/src/vfx/caster-vfx-recipes.ts` present or recompute scaling, requirements, and
  stat-derived damage.
- `packages/server/src/rooms/GameRoom.ts` applies `heldDamageMult`/`heldCastDamageMult` across
  melee, gun, thrown, scatter, cast, beam, zone, quake, chain, and explosion sources.

### Character numeric progression

- `tools/artkit/gen-character-roster.mjs` emits per-character five-stat spreads.
- `packages/shared/src/characters.ts` contains the generated spreads and quirk identity mapping.
- `packages/shared/src/character-classes.ts` exposes lineage labels plus spread lookup and numeric
  quirk modifiers.
- `packages/shared/src/leveling.ts` owns attributes, XP/level curves, allocation, derived
  CON/LUK/DEX effects, and crit derivation.
- `packages/shared/src/gear.ts` composes identity/wardrobe numeric stat effects used when a run
  snapshot is installed.
- `packages/server/src/rooms/progression.ts` applies XP, levels, allocation, and derived health.
- `packages/server/src/rooms/GameRoom.ts` seeds/resnapshots character spreads and consumes numeric
  character/gear progression in combat and run state.
- `packages/client/src/scenes/MenuScene.ts` and wardrobe preview/model tests display the numeric
  identity spread.

### XP, levels, and UI/state

- `packages/shared/src/state.ts` syncs player level/XP/attributes/pending level drafts and the
  `XpEchoState` collection.
- `packages/shared/src/constants.ts` contains XP Echo caps, timing, attraction, and presentation
  tuning.
- `packages/server/src/rooms/GameRoom.ts` creates, merges, launches, collects, retargets, drains,
  and boundary-cleans XP Echoes; drives level windows and signature offers; freezes and protects
  players while level choices are pending.
- `packages/client/src/vfx/xp-motes.ts` renders XP pickups and delivery receipts.
- `packages/client/src/scenes/ArenaScene.ts` owns XP-mote stepping, the XP/level HUD, the level-up
  carousel/signature draft, input gating, and frozen presentation.
- `packages/client/src/ui/level-up-model.ts` owns the deleted draft's model and stat projections.
- `packages/client/src/net/prediction.ts` and arena presentation read level-window freeze state.
- `packages/shared/src/augments.ts` and server augment delivery currently bind signature offers to
  every-fifth-level gates; the ultimate machinery also retains stat/allocation-derived routing.

### Tests to migrate or delete

- `tests/weapons.test.ts`, `tests/data-consistency.test.ts`, `tests/b2-wacky-weapons.test.ts`, and
  `tests/b3-fan-hybrids.test.ts` assert scaling/requirements/source generation.
- `tests/leveling.test.ts` is entirely about the deleted XP/level/stat progression subject.
  `packages/server/src/rooms/progression.test.ts` mixes that deleted subject with surviving
  account/pet/weapon-bank coverage, so only its progression cases are deletion candidates.
- `packages/server/src/rooms/GameRoom.test.ts` contains crit, XP Echo, level-window, character
  spread, gear-derived stat, ultimate allocation, and flat-damage integration assertions among
  unrelated gameplay coverage.
- Focused server weapon suites (`GameRoom.b14-kungfu-wraps.test.ts`,
  `GameRoom.v3c-caster.test.ts`, `GameRoom.v3r-ranged.test.ts`,
  `GameRoom.v5r.test.ts`, and `GameRoom.w4r-ranged.test.ts`) call the stat multiplier path and need
  flat-damage expectations without changing their weapon behavior coverage.
- Client level-up and wardrobe tests need removal or migration to label/identity-only behavior.

## Plan

1. Strip stat coupling from weapon source rows, schemas, generator, generated outputs, runtime
   damage paths, and card/pair presentation.
2. Replace generated character spreads and run-state numeric seeding with identity/lineage labels;
   remove attribute-derived health/damage/crit effects while retaining unrelated character flavor.
3. Replace crit derivation with `base + additive modifiers` and land an empty runtime accumulator
   hook for the later relic lane.
4. Delete XP Echo and level state/runtime/UI, replace former kill XP awards with collectible MONEY
   rows that settle through the existing authoritative `scrip` counter, and preserve unrelated
   reward/shop plumbing.
5. Adapt ultimate charging to one stat-free flat damage/activity threshold without deleting the
   ultimate system.
6. Migrate focused coverage, delete only wholly obsolete progression suites, run every required
   static/unit gate, then execute the private-port browser gate and retain screenshots/evidence.

## Implementation log

### Weapon schema/source/generation and flat runtime damage

- Recursively stripped 734 `scalingGrades`/`requirements` properties from
  `data/weapon-concepts-300.json` while preserving every other source field.
- Removed those keys from every generator whitelist and emission path; future reintroduction is now an
  unknown-key generation failure.
- Removed top-level and nested stat-coupling fields, grade/requirement types, multiplier primitives, and
  requirement penalties from `WeaponDef`; regenerated all 336 expansion definitions with no stat fields.
- Collapsed server held damage to the surviving stat-independent factors: rarity/affix, dual-wield
  throughput trim, weapon-class set bonus, and runtime outgoing-damage modifiers. Melee, gun, caster,
  beam, thrown, scatter, quake, chain, aura, zone, warp, and hybrid-projectile sources now start from
  their exact authored flat damage.
- Removed scaling/requirement chips and requirement verdicts from weapon cards. Card equations and pair
  previews now use flat authored damage plus the same non-stat loot/pair factors as authority.
- Caster VFX intensity no longer reads an INT grade; it derives presentation intensity from the already
  authored flat damage band.

### Character identity and runtime-state teardown

- Regenerated all 77 playable character kit rows as identity plus quirk only. The generator no longer
  computes, validates, or emits five-stat spreads.
- Removed class/lineage numeric bias and spread APIs while retaining lineage labels, menu blurbs,
  character names, and data-only quirk labels.
- Advanced the synchronized schema to 34 and removed `level`, `xp`, `xpToNext`, five player attributes,
  pending allocation/draft fields, and their freeze/window state from `PlayerState`.
- Removed character/gear stat installation from join, training reset, health, regen, harvesting,
  crit, damage, and ultimate routing. Archived account gear descriptors and L4-owned legacy meta
  migration labels remain inert and outside live run power, honoring the lane boundary.
- Kept unrelated combat/content systems on their existing rails: character spawning, identity quirks,
  parry, dodge, jump, pets, bosses, shopkeeper, kung-fu wraps, fans, Wyrmskull, and Mirage.

### Flat crit plus additive hook

- `critChanceFor()` now starts at `CRIT_BASE = 0.05`, sums finite additive modifier values, and clamps
  to the existing 75% safety cap. LUK/DEX derivation is gone.
- `GameRoom` routes weapon and eligible ultimate crit checks through
  `critAdditiveModifiers(player, combat)`. L1 intentionally returns an empty array: this is the only
  accumulator seam landed for the relic lane, with no relic schema or behavior invented.
- Existing gold crit numbers and presentation were left intact.

### XP/level removal and MONEY-drop reroute

- Renamed enemy reward data from `xpValue` to `moneyValue` through authored dimension data, generator,
  generated output, boss/worm receipts, and authority.
- Added schema-34 `MoneyDropState`/`ArenaState.moneyDrops`. Paid enemy deaths now spawn synchronized
  gold MONEY rows, arm for six ticks, latch the nearest living collector within the existing pickup
  reach, fly for six ticks, and then add their exact value to every squad member's existing `scrip`
  counter (matching the former squad-shared reward ownership).
- The field is bounded at 48 rows. Overflow merges into the nearest unpaid row; the all-delivered
  one-tick edge settles immediately. Disconnects retarget flights, and extraction/descent/victory
  boundaries drain unpaid value so no reward is lost.
- Rewired the Lodestar pet's existing pickup-reach behavior to MONEY drops without changing pet
  progression. Pet Bond XP is a separate retained pet-account system and was not repurposed.
- Added the fixed-pool client MONEY renderer with gold `$` drops, authoritative flight interpolation,
  and `+$N MONEY` receipt presentation.
- Deleted `xp-motes.ts`, the level bar, level window/input freeze, allocation/signature carousel,
  level-up effects/layout/model, level-up audio call path, and prediction's level-window freeze path.

### Stat-free interim ultimate

- Every spawned character receives the existing Sunspite Comet/STR-variant content row as a universal
  interim ultimate; the `STR` token is only the shipped variant code, not a numeric stat lookup.
- Charge is a single normalized 0..1 damage/activity meter with a flat 100-point display threshold:
  applied damage contributes one displayed point per 30 damage, a final blow contributes 0.3 points,
  and a successful parry contributes 4 points, under the existing 4-point per-tick cap. Training,
  dead/downed, active-ultimate, and ultimate-self-damage exclusions remain.
- The existing ultimate cast/runtime/VFX system is preserved. Family selection by allocation,
  stat-frequency unlock, temper, and level-window gating are removed.

### Test migration and deletions

- Migrated 19 test files across shared, server, client, and repository compatibility coverage to the
  flat weapon, flavor-only character, schema-34, flat-crit, MONEY-drop, and stat-free ultimate
  contracts.
- Deleted 64 obsolete test cases whose complete subjects no longer exist, documented by file:
  - `packages/client/src/net/prediction.test.ts`: 2 level-window freeze/glide cases.
  - `packages/server/src/rooms/GameRoom.test.ts`: 7 level-carousel handler/freeze/parry, LUK harvest,
    capped-XP receipt, class-timeout, and AFK allocation cases.
  - `packages/server/src/rooms/progression.test.ts`: 23 XP grant/curve, allocation, character spread,
    class timeout, stat-frequency ultimate, grade-floor, and attribute-ledger cases; all unrelated
    account, pet, gear-compatibility, and weapon-bank cases remain.
  - `tests/weapons.test.ts`: 22 grade multiplier, inherited source-scaling, requirement penalty,
    reachability, and grade-order cases. Surviving source enumeration/card math was migrated to flat
    damage assertions.
  - `tests/leveling.test.ts`: the entire 10-case file (XP curve, CON-derived health/regen, and network
    attribute validation) because its whole subject was deleted.
- Added one recursive source-catalog invariant proving no nested `scalingGrades` or `requirements`
  key can survive, in addition to migrated generated/runtime flat-damage assertions.

### Verification

- PASS — `pnpm gen`.
- PASS — `pnpm gen:check` (the existing unavailable-reference warning skips only the unrelated
  `subjects-vfx-300.json` comparison; its tracked output was preserved).
- PASS — `pnpm typecheck`.
- PASS — full `pnpm test`: 166 files, 2,172 tests.
- PASS — `pnpm assets:check`: 478 sprite entries / 1,007 parts, 635 atlas frames, 320 cards, and all
  projectile/particle/weapon-VFX URLs.
- PASS — `git diff --check`; all 65 present candidate text files contain LF only.
- PRIVATE STACK SMOKE — Vite client `64045` returned HTTP 200 and Colyseus `64046` listened
  successfully; protected ports `5180`/`2567` were not used, and both private processes were stopped.
- BLOCKED — the connected browser runtime reported zero available browser surfaces after its required
  recovery check. Its control contract forbids substituting a separate headless browser, so the
  requested menu/character/movement/combat/MONEY/UI screenshots could not be captured and the visual
  playability gate is not claimed as passed. Evidence:
  `docs/owner-notes-audit-v10-evidence/b20-l1-teardown/`.

verdict: stats/XP/scaling removed, weapons flat, crit flat+hooked, money-drop reroute implemented and unit-verified; playability screenshot gate BLOCKED by no connected browser surface; evidence path `docs/owner-notes-audit-v10-evidence/b20-l1-teardown/`; 70 files touched; 19 test files migrated, 64 obsolete test cases deleted (1 whole 10-case file), 1 invariant added.
