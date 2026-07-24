# B20 Lane 3 — Economy Implementation Report

## Scope and authority

This lane implements the economy decisions locked by
`docs/sol-reports/design-lock-b20.md` after the shipped L1 teardown and L2
chest/relic work. Money is a run resource with no in-run shop sink. Weapons can
be converted to money in place or from the finite bag, and terminal outcomes
bank all remaining run money into the existing meta account.

L4 booster packs/meta-shop UI and L5 tier curves are outside this lane.
Chest/relic reward APIs remain owned by L2.

## Shop-removal inventory

The following live systems are removed:

- Belt-level shopkeeper coordinates and replicated shop position.
- Shopkeeper spawn/rendering, proximity prompt, input route, and shop panel.
- Weapon and stash-entry sell messages and their receipts.
- Shop-only bind/unbind and inert upgrade-purchase message routes.
- Shop rarity-price helpers and shop-referencing client/server tests.
- Any `[F]`/`[E]` shop interaction hint.

The following art sources are archived in place: they are not moved or deleted,
but are no longer spawned, rendered, or wired into the game.

- `packages/client/public/ui/shopkeeper.jpg`
- The shopkeeper generation job in `tools/artkit/gen-sprint2.mjs`

## Disassembly value curve

Floor and bag disassembly use the same shared deterministic curve:

1. Compute the weapon damage budget with L2's placeholder budget helper. The
   budget sums authored damage sources and applies the existing cadence credit.
2. Convert budget to money with `round(damageBudget / 4)`.
3. Clamp the result to 4–60 money.

This intentionally consumes L2's placeholder weapon budget instead of
introducing the L5 tier curve. Bound pairs are atomic: disassembling one entry
removes the pair and pays the sum of both component values. The home-issue
weapon is not disassemblable.

Floor disassembly is a distinct, server-authorized hold interaction. Pressing E
starts an intent; holding for 0.4 seconds permits the server to consume the
weapon and award money, while releasing before the threshold performs the
normal pickup. Chest rewards that cannot fit in the bag are placed beside the
chest as owner-visible floor weapons so they can be picked up or disassembled.

The break response reuses the existing directional hit-spark/core-flash and
weapon-break sound language. It adds no ambient, radial, or player-attached
effect system.

## Banking flow

The existing pet/meta account remains the persistence authority:

1. A run always starts with zero run money; the account balance is not copied
   into the arena wallet.
2. Chest money, money drops, and weapon disassembly increment only the
   replicated run-money field.
3. The first terminal settlement for victory, death, or extraction atomically
   adds 100% of remaining run money to `metaAccount.scrip`, zeroes the run
   wallet, bumps the account revision, and publishes the updated account.
4. A dedicated terminal receipt reports the amount banked and new account
   total for the existing end-screen idiom. Settlement remains idempotent.

There is no tax and no in-run sink.

## Implementation log

- Initial authority and ownership inventory completed.
- Removed belt-level shop coordinates, replicated shop position, sale/bind/upgrade
  handlers, and the old held-weapon salvage action/resource.
- Added shared damage-budget disassembly constants, receipts, and the 4–60
  value function. Schema version advanced from 36 to 37 for appended pickup
  disassembly/owner fields and retired shop/salvage wire state.
- Added server-clock floor hold intents, authoritative floor/bag consumption,
  atomic pair valuation, owner-visible chest overflow drops, and ordinary
  authored enemy weapon drops.
- Separated run and account balances at join. Terminal settlement now banks the
  run wallet into the existing meta account and emits an idempotent money
  receipt on victory, death, and extraction.
- Reworked the live client input so E-tap picks up and E-hold disassembles,
  added bag-row disassembly, changed HUD/end-screen copy to money, and removed
  all live vendor routes.
- The held client retries completion at 10 Hz after the presentation threshold.
  This covers a render-stall/server-tick race without weakening the exact
  server-side pickup, distance, owner, provenance, and eight-tick hold checks.

## Test migrations

- Deleted the individual tests for `sellWeapon`, home stash/intake sales,
  pair-sale receipts, shop proximity, better-half shop fees, `buyUpgrade`,
  Gilded Gecko sale minting, and rarity-based salvage payout. The associated
  sale helpers and message handlers were deleted with them; no tracked test
  file was removed wholesale.
- Replaced carried-salvage bank-or-lose assertions with terminal 100% banking
  assertions for extraction and wipe/death, including account revision,
  zeroed run money, and the owner receipt.
- Replaced the old R-hold salvage cases with exact-ID floor intent tests:
  early completion rejection, eight-tick completion, owner/range/provenance
  checks, damage-budget payout, pair atomicity, and bag consumption.
- Replaced the “enemy weapons never drop” assertion with an authored-wielder
  drop/disassembly assertion. Added chest-overflow owner-floor coverage.
- Migrated backpack action, armory value, pair-preview, objective HUD,
  wardrobe, ultimate-gate, schema-pin, and loot tests away from shop/sale
  behavior.
- Added `tests/economy.test.ts` for the shared curve, bounds, deterministic
  values, pair component summing, and the fixed 0.4-second/eight-tick law.

## Verification

All required static gates are green:

- `pnpm gen` — regenerated 314 VFX subjects from the canonical ignored
  identity-reference fixtures and all tracked generators completed.
- `pnpm gen:check` — green; all generated sources, manifests, assignments,
  weapon VFX, and portal output are current.
- `pnpm typecheck` — green across shared, client, and server.
- `pnpm test` — 173 files and 2,231 tests passed.
- `pnpm assets:check` — green: 478 sprite entries / 1,007 parts, 635 atlas
  frames, 320 cards, 6 POIs, 9 decals, 24 projectile URLs, 96 particle URLs,
  and 9 weapon-VFX URLs.

The private live gate passed on client port 53055 and game port 53051. It did
not touch 5180 or 2567. The run used `proto-cowboy-hidden-face`, killed a real
authored `thornblade-warden`, and received its real `x-sword-coffin` drop. The
captured flow shows:

- `[E] DISASSEMBLING 100%` while the physical E key remains held; the test
  records the 400 ms contract and delays only the completion packet until the
  evidence PNG is written.
- A server receipt consuming that exact floor row for 5 money and the existing
  directional break flash/SFX banner.
- The same weapon stowed in the finite backpack with `DISASSEMBLE +◈5`, then
  consumed by its per-item action for the same curve value.
- A terminal defeat receipt banking all 10 run money, zeroing the run readout,
  persisting account total 10, and showing
  `MONEY BANKED +◈10 · ACCOUNT ◈10`.
- No shop display object, texture, state field, prompt, vendor copy, or
  shopkeeper anywhere in the arena.

Evidence:
`docs/owner-notes-audit-v11-evidence/b20-l3-economy/`

## Files touched

- Shared economy/schema/catalog:
  `economy.ts`, `constants.ts`, `state.ts`, `index.ts`, `loot.ts`, `bank.ts`,
  `belt-map.ts`, `meta.ts`, `weapons.ts`, `character-classes.ts`, and
  `gear.ts`.
- Server authority:
  `GameRoom.ts`, `progression.ts`, their migrated tests, and the schema pin in
  `BossController.test.ts`.
- Client interaction/presentation:
  `ArenaScene.ts`, `MenuScene.ts`, backpack/armory actions, objective HUD,
  pair preview, pet copy, ultimate input gate, wardrobe copy, and their tests.
- Verification/artifacts:
  `tests/economy.test.ts`, migrated loot/flourish tests, the dedicated
  Playwright config/spec, the evidence directory, and regenerated
  `tools/portal/index.html`.

Verdict: shopkeeper gone; floor+bag disassembly live with curve; auto-banking live; evidence path `docs/owner-notes-audit-v11-evidence/b20-l3-economy/`; files touched documented above.
