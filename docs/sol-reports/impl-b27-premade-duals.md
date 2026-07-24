# B27 implementation report — retire player-composed dual wield

Owner direction, 2026-07-24: weapons are authored as pre-made duals or they are not; players no
longer compose a dual-wield loadout from two independent arsenal weapons.

## Stage 0 — inventory and compatibility plan

Status: inventory complete; implementation not yet changed.

### Compatibility boundary

`PlayerState.dualWield` is a compatibility container at the final direct `PlayerState` schema
position. Its current nested wire order is:

1. `offhandSlot: uint8` — composed-pair state
2. `pairBaseSeq: uint32` — composed-pair state
3. `offCharges: uint8` — composed-pair state
4. `offMaxCharges: uint8` — composed-pair state
5. `gearUpper: string` — unrelated live wardrobe state
6. `gearLower: string` — unrelated live wardrobe state
7. `weaponResource: WeaponResourceState` — unrelated live Drive state
8. `prestige: uint8` — unrelated live progression state
9. `relics: RelicState` — unrelated live relic state

Plan: keep the row, class identity, parent field, and all nine wire positions/types byte-compatible.
The first four properties will become inert, zero/default compatibility tombstones with neutral
names; every runtime accessor and write for the old pairing meanings will be deleted. The five
unrelated tenants remain at indexes 4–8 with their names, types, initialization, accessors, and
runtime plumbing unchanged. Because the wire type/order is unchanged, `SCHEMA_VERSION` remains at
its current value (37); if implementation forces a real wire-layout change, it will instead be
bumped and every test pin migrated.

### Composed-pairing touchpoint inventory

- Shared schema:
  - `packages/shared/src/state.ts`: four nested pairing fields, four root compatibility
    getter/setter pairs, and pairing-specific comments on the otherwise shared tail container.
- Shared combat/balance:
  - `packages/shared/src/combat.ts`: `DualWieldHand` and `dualHandForSeq` composed-pair parity.
  - `packages/shared/src/weapons.ts` and generated/shared exports: `pairEligible`,
    `pairDamagePerUse`, `dualOffhandDamageMultiplier`, `PAIR_TEMPO`, and
    `DUAL_MELEE_PAIR_BAR` are candidates for removal after a usage census. Authored pre-made dual
    render/combo definitions (`grip: "dual"`, `dual`, `glovePair`, twin manifests) are explicitly
    outside removal scope.
- Shared bank persistence:
  - `packages/shared/src/bank.ts`: `PairedWeaponEntryV1`, pair entry IDs, pair parsing/validation,
    pair physical-span helpers, and pair retirement behavior. These model player-composed pairs and
    must stop creating/returning atomic pairs; existing saved pair rows need a lossless compatibility
    split/migration into two single entries.
  - `packages/shared/src/state.ts` `ArsenalSlot`: server-only `bankEntryKind`/`bankPairRole`
    bookkeeping for materialized composed pairs.
- Server:
  - `packages/server/src/rooms/GameRoom.ts`: pair/unpair message handlers and guards; pair
    bind/unbind/materialization; `pairedOffSlot`, `dissolvePair`, slot-touch invalidation;
    paired-off resource stepping and stowed-resource exclusions; alternating hand selection;
    paired melee combo state/cadence; off-hand damage/cooldown/resource/projectile resolution;
    composed-pair set-count suppression; bank movement/drop/retirement atomicity; reset/join
    activation; pair-specific combat state and presentation receipt routing.
  - Composed-pair-only balance hooks to collapse: pair tempo, off-hand throughput trim, pair damage
    contribution, two-weapon set-count suppression, and paired melee bar/cadence. Removal will leave
    the ordinary one-active-weapon attack path and authored weapon-definition combo path unchanged.
- Client arena:
  - `packages/client/src/scenes/ArenaScene.ts`: nested offhand link resolution, paired art loading,
    `SpriteRig.equipLoadout` use, pair epoch sync, pair loadout signatures, composed-pair arsenal
    cards/art/grades/glyphs/tooltips, atomic-pair navigation, and pair preview imports/state.
  - `packages/client/src/entities/SpriteRig.ts`: composed two-independent-weapon equip path,
    pair epoch/parity, pairing ceremony/glint, arbitrary-pair pose/cadence and scale state. The
    authored pre-made-dual path that resolves two parts from one weapon definition must remain.
  - `packages/client/src/ui/loadout-entry-view.ts`: offhand identity/resource/next-hand projection
    and pair key.
  - `packages/client/src/ui/pair-preview.ts`: composed-pair eligibility, throughput, and fee preview.
- Tests:
  - `packages/server/src/rooms/GameRoom.test.ts`: composed pair authority, combat, lifecycle,
    resources, bank atomicity, schema defaults/layout, and balance laws.
  - `packages/client/src/scenes/ArenaScene.dualwield.test.ts`: composed offhand equip/art/epoch
    coverage mixed with unrelated nested-row reflection coverage that must be retained or moved.
  - `packages/client/src/ui/loadout-entry-view.test.ts` and `pair-preview.test.ts`: composed-pair UI
    projections and preview laws.
  - Shared/server schema-layout tests in `progression.test.ts` and `GameRoom.test.ts` must pin the
    neutral tombstones plus unchanged unrelated tenant positions.
  - New required coverage: census every catalog weapon with `grip: "dual"` (expected 22), assert
    each resolves its authored pair render, and assert ordinary same-class one-hand weapons remain
    independent arsenal slots.
- UI/copy/docs/dev portal:
  - Live pair cards, pair grades, pair glyphs, “Off-hand”, “Atomic pair”, “bound pair”, and
    pair-movement banners in `ArenaScene.ts`.
  - `docs/dualwield-panel/tech-client.md` and `tech-server.md` are implementation plans for the
    retired feature and should be deleted.
  - `docs/metagame-panel/bank-tech.md`, `bank-systems.md`, `bar-design.md`, and `bar-advocate.md`
    contain composed-pair assumptions and require migration or explicit historical marking.
  - `docs/audit-armory/weapons.md` documents live composed-pair acceptance and requires migration.
  - Historical audit/report mentions will be reviewed individually; unrelated references to
    authored dual weapons, generic pair geometry, or the compatibility container name are not
    composed-pair orphans.

### Guardrails recorded

- Do not modify relic behavior, gear behavior, prestige behavior, or Drive/weapon-resource behavior.
- Do not rebalance any weapon and do not alter kung-fu, parry, fans, chests, packs, characters, or
  pets.
- Keep authored pre-made dual rendering and combos driven by the weapon definition.
- Use only private ephemeral ports for the live gate; never start the normal live stack or use ports
  5180/2567.
- Run `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, full `pnpm test`, and
  `pnpm assets:check`; store live-gate evidence under
  `docs/owner-notes-audit-v11-evidence/b27-premade-duals/`.

## Stage 1 — runtime and persistence implementation

Status: complete; targeted typecheck and 377 affected tests green.

- Preserved `DualWieldState` as the same nine-field wire row. Positions 0–3 are now inert
  `uint8/uint32/uint8/uint8` tombstones with the previous defaults; positions 4–8 remain
  `gearUpper`, `gearLower`, `weaponResource`, `prestige`, and `relics` with the same types and
  initialization. `SCHEMA_VERSION` remains 37.
- Deleted the server bind/unbind, linked-slot, atomic drop/move, off-hand attack, secondary
  resource, alternate-instance damage, and composed-pair lifecycle paths. Active-slot selection
  now equips and attacks exactly that one slot.
- Reduced the live bank type to one single-instance entry. The version-1 sanitizer accepts the
  obsolete pair JSON only at the trust boundary, validates both exact instances, and immediately
  emits two singles. Saved Active/Pack placement expands into adjacent cells and the former lead
  remains the selected entry.
- Deleted the arbitrary two-definition `SpriteRig` equip surface. `authoredWeaponRenderPlan`
  resolves either one render piece or the two parts authored by the same `grip: "dual"`/`dual`
  definition; glove-pair definitions retain their existing two-receiver plan.
- Deleted the composed loadout projection, pair preview, split dock art, pair glyph/grade/copy,
  atomic navigation, and Armory composition filter. Owner-private weapon manifests now accept
  only `kind: "single"`.
- Renamed the retained presentation vocabulary and equip sound cue to authored-dual terms so the
  remaining two-hand behavior cannot be mistaken for a player-created link.

### Composed-only balance hooks collapsed

1. **Pair tempo and throughput cap:** deleted. One selected definition uses its ordinary authored
   cooldown and accepted-action interval.
2. **Off-hand damage/resource multipliers:** deleted. No second instance enters damage, Drive,
   charge, reload, beam, gun, throw, cast, or melee resolution.
3. **Two-instance set-count suppression:** deleted. Each independent occupied slot contributes its
   own loadout identity; selecting a slot never combines it with another.
4. **Composed six-beat melee cadence:** deleted as a topology rule. The same six-beat
   lead/off/lead/off/lead/both presentation bar remains only for one authored dual definition.
5. **Archived Driftblade `pair-half` identity hook:** renamed to neutral `short-flurry`; its exact
   stats and four-beat combo data are unchanged.
6. **Archived-pair salvage remap:** deleted after the sanitizer boundary normalizes old pairs.
   Runtime salvage now handles only canonical singles.

No weapon numeric field changed. Drive, relic, gear, prestige, kung-fu, parry, fan, chest, pack,
character, and pet mechanics were not altered.

## Stage 2 — coverage and orphan sweep

Status: complete.

- Added a catalog census that asserts exactly 22 expansion weapons with `grip: "dual"` and checks
  that each resolves two existing render parts from its one definition. The base
  `twin-bowie-fangs` is a twenty-third legacy authored dual and is covered by the same all-catalog
  render law.
- Replaced composed-pair server tests with independent same-class slot and compatibility-row laws.
  Migrated bank tests cover one-way legacy-save normalization. Retained character/reflection tests
  were moved out of the deleted dual-wield suite.
- Deleted the pair-preview module/tests, composed SpriteRig/Arena suites, and five
  `docs/dualwield-panel` design documents. Migrated active Armory, bank, Drive, flourish, pose,
  class-merge, audit, option-analysis, pet-invariant, sound, and root-test copy to the authored-dual
  contract.
- Targeted verification: `pnpm typecheck` green; 8 affected files / 377 tests green, including the
  full 294-test `GameRoom` suite.

### Deletions and migrations

- Deleted retired implementation plans:
  `docs/dualwield-panel/{combat-designer,designer,devils-advocate,tech-client,tech-server}.md`.
- Deleted composed client coverage:
  `SpriteRig.dualwield.test.ts` and `ArenaScene.dualwield.test.ts`; retained character and
  authored-dual laws moved to purpose-named suites.
- Deleted the composed pairing preview:
  `packages/client/src/ui/pair-preview.ts` and `pair-preview.test.ts`.
- Renamed the old `pairing-x-lock` audio samples/manifest row to `authored-dual-equip`; the sample
  is now selected only by the authored-dual equip cue.
- Migrated the B6 archive fixture test to assert the sanitizer's canonical single rows. The
  obsolete pair shape remains only as explicit one-way save-compatibility input in migration
  tests and `sanitizeWeaponBankV1`.
- Frozen pre-B27 audit/evidence records were retained as historical truth. The active runtime,
  product copy, tests, design contracts, generated portal, and sound catalog have zero remaining
  composed-pair references; absence assertions and the compatibility inventory are intentional.

## Stage 3 — final verification and live evidence

Status: complete.

- `pnpm gen`: green. The isolated worktree does not contain 338 ignored source-art references, so
  the generator's temporary empty VFX-subject output was not committed; the tracked canonical
  subject ledger was preserved.
- `pnpm gen:check`: green. It reported the expected skip for those unavailable ignored art
  references and preserved the tracked character scales.
- `pnpm typecheck`: green.
- Full `pnpm test`: green, 174 files / 2,237 tests.
- `pnpm assets:check`: green, including 478 sprite entries / 1,007 parts and 320 cards.
- `git diff --check`: green. Every changed text artifact was byte-scanned and uses LF endings.
- Private Playwright live gate: green on client port 59920 and game port 59918; forbidden ports
  5180/2567 were not bound or touched.
  - `proto-cowboy-hidden-face` equipped `x2-knucklebone-talons`: two pieces remained visible while
    six accepted server beats produced `lead/off/lead/off/lead/both`.
  - `rattler-sabre` and `x2-sandsong-saber` occupied separate same-class 1H slots: each selection
    rendered one piece and no pairing properties appeared.
  - A real `openChest` request applied the deterministic Keen Edge relic while the four tombstones
    and unrelated gear/Drive/prestige/relic tenants remained present at their pinned positions.
- Evidence:
  `docs/owner-notes-audit-v11-evidence/b27-premade-duals/README.md`,
  `live-gate.json`, and three screenshots.

VERDICT: composed pairing removed; 22 pre-made expansion duals intact (plus the legacy authored Twin Bowie Fangs); compat-container wire layout and non-pairing tenants untouched; orphan sweep count: 0 active composed-pair references; evidence path: `docs/owner-notes-audit-v11-evidence/b27-premade-duals/`; files touched: 83.
