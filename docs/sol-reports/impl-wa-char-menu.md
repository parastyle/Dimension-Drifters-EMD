# Wave 4 Sol 4 — Character menu implementation

## Menu tab system

`MenuScene` currently uses a three-value `MenuTab` union, constructs each tab with
`makeMenuChip`, builds the Wardrobe and Armory roots during `create()`, selects Wardrobe through
`setMenuTab("wardrobe")`, and finishes by running the shared responsive `layout()`. `setMenuTab`
owns root visibility. In the retired path it also makes the companion row visible only for
Wardrobe, while the prestige drawer and World Tier control are children of the Wardrobe root.
The scene preload likewise queues the boilerplate and complete gear manifest specifically for the
Wardrobe preview.

## Implementation plan

1. Add a pure, versioned character-selection model backed by `dd.character.selected.v1`, validating
   every read and write against shared `WHOLE_ART_CHARACTERS` and falling back to
   `DEFAULT_CHARACTER`.
2. Replace the active Wardrobe tab descriptor/default with Characters, build a character root using
   the established chip/root/tab/layout lifecycle, and retain Wardrobe code only as unreachable
   archive implementation.
3. Queue exactly the six manifest parts for every shared whole-art character and render one
   selectable card per shared roster entry with a readable name, selection treatment, and assembled
   whole-art portrait.
4. Support pointer activation plus bounded arrow/Home/End and Enter/Space keyboard selection, save
   immediately, and pass `selectedCharacterId` in every normal Arena launch.
5. Remove normal-play Wardrobe construction, visibility, routing, and full gear-art preload while
   preserving the Armory / Carry root and its existing keyboard behavior.
6. Keep the companion selector visible on Characters and leave its account save/select behavior
   unchanged.
7. Move the existing World Tier/prestige transaction into a neutral Destinations control and drawer,
   preserving transport, eligibility, confirmation, and server semantics while removing hat/tower
   reward promises.
8. Update active identity and matchmaking copy, add focused pure and Phaser-facing behavioral tests,
   then run `pnpm typecheck` and the full `pnpm test` suite without starting the live stack.

## Implemented

- Added the versioned `dd.character.selected.v1` preference envelope. Missing, malformed, legacy,
  and non-whole-art values resolve to shared `DEFAULT_CHARACTER`; valid selections are limited to
  shared `WHOLE_ART_CHARACTERS`.
- Replaced the active Wardrobe tab/default/key grammar with Characters. The scene renders every
  shared whole-art candidate as a readable six-part portrait card with pointer and keyboard
  selection, then sends `selectedCharacterId` in normal and dev Arena start payloads.
- Removed the active Wardrobe build, visibility, layout, and full gear-texture preload. Wardrobe
  methods and preset storage remain dormant archive code.
- Preserved `ARMORY / CARRY`, kept the companion selector visible and writable on Characters, and
  kept selected pets in the launch payload.
- Moved the existing prestige transport, eligibility, two-stage confirmation, and receipt flow to a
  World Tier control/drawer on Destinations. Active copy now describes World Tier and destination
  difficulty without hat or tower rewards.
- Added deterministic behavior coverage for the initial tab, exact shared roster, six-part-only
  preload, keyboard and shared pointer/keyboard persistence, refresh loading, launch identity,
  Armory/Destinations reachability, companion saving, and eligible prestige outside Wardrobe.

## Verification

- `pnpm typecheck` — passed across shared, client, server, and workspace packages.
- Focused menu/model run — 4 files, 25 tests passed.
- `pnpm test` — 150 files, 1,882 tests passed.
- LF audit and `git diff --check` — passed.
- Live stack — not started, per Sol order.

## Files touched

- `packages/client/src/scenes/MenuScene.ts`
- `packages/client/src/scenes/MenuScene.character-tab.test.ts`
- `packages/client/src/ui/character-select.ts`
- `packages/client/src/ui/character-select.test.ts`
- `packages/client/src/ui/characters/preview.ts`
- `packages/client/src/ui/characters/preview.test.ts`
- `docs/sol-reports/impl-wa-char-menu.md`

Verdict: Characters is the initial tab with persisted selection; Armory / Carry, Destinations, pets, and prestige are preserved; touched only the seven scoped files above; `pnpm typecheck` and all 1,882 `pnpm test` tests pass.
