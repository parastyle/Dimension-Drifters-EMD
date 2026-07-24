# B20 Lane 4 — Booster-Pack Meta Implementation Report

## Scope and authority

This lane implements the owner-locked out-of-run booster-pack economy after the shipped L1
teardown, L2 chest/relic authority, and L3 money banking. The persisted meta account is the only
source of bank balance and permanent unlock truth. L4 adds no in-run power curve, weapon stat
change, modal, aura, chain, or tassel. Its only arena changes are per-account weapon-pool filters at
the existing chest and authored enemy-drop seams.

No synchronized arena field is required: unlocks travel in the existing private meta-account join
payload and the server already owns one sanitized account per player. The meta-account envelope
advances independently from V4 to V5; `SCHEMA_VERSION` remains 37 unless implementation discovers a
new synchronized field is unavoidable.

## Pack tuning

All values are exported shared constants so balance work does not need to edit menu or server code.
A purchase spends banked `metaAccount.scrip` immediately and resolves three deterministic cards.
The seed is explicit input to the pure pack opener; ordinary menu purchases derive a fresh uint32
seed while tests and private gates can supply a fixed one.

| Pack | Price | Pulls | Candidate pool at purchase |
| --- | ---: | ---: | --- |
| Weapon Pack | 90 money | 3 | Every active, non-archived catalog weapon not yet unlocked |
| Pet Pack | 120 money | 3 | Every pet-roster id not yet owned |
| Character Pack | 150 money | 3 | Every `WHOLE_ART_CHARACTERS` id not yet unlocked |

Candidates are snapshotted when the pack is opened. Each card first rolls an available rarity
bucket by weight, then rolls uniformly inside that bucket. Sampling is with replacement from the
snapshot: the first occurrence unlocks the item and a later occurrence in the same pack is a
visible duplicate. A pack cannot be bought when its locked candidate pool is empty.

| Rarity | Pull weight | Item-cost multiplier | Duplicate refund |
| --- | ---: | ---: | ---: |
| Common | 55 | 1.0× | floor(50% × pack-price/3 × 1.0) |
| Uncommon | 28 | 1.5× | floor(50% × pack-price/3 × 1.5) |
| Rare | 13 | 2.5× | floor(50% × pack-price/3 × 2.5) |
| Legendary | 4 | 5.0× | floor(50% × pack-price/3 × 5.0) |

This produces per-card duplicate refunds of 15/22/37/75 money for Weapon Packs,
20/30/50/100 for Pet Packs, and 25/37/62/125 for Character Packs. Refunds are applied to the same
persisted bank transaction and are rendered directly on the revealed duplicate card as
`DUPLICATE -> +N MONEY`.

## Rarity mapping

Weapon rarity is derived from L2's existing flat-damage `placeholderWeaponBudget` helper, not from
an L5 tier assignment. L4 does not modify any weapon definition or the chest time curve.

| Weapon power budget | Pack rarity |
| --- | --- |
| `< 24` | Common |
| `24–<48` | Uncommon |
| `48–<72` | Rare |
| `>= 72` | Legendary |

Pet rarity is derived from the roster's closed bonus kind.

| Pet bonus kind | Pack rarity |
| --- | --- |
| passive regeneration, healing received | Common |
| money reach, earned pickup reach, reload/refill | Uncommon |
| earned-economy hook, revive | Rare |
| ground-hazard protection | Legendary |

Characters have no numeric power budget after L1, so their rarity is presentation-kind only. The
mapping is a closed catalog assignment grouped by visual archetype: grounded adventurers and
soldiers are Common; specialized constructed, masked, or elemental archetypes are Uncommon;
occult, spectral, alien, and high-fantasy archetypes are Rare; the two red-rebel and blue-spectral
demon-hunter variants plus the paper-cutout anomaly are Legendary. This is collection flavor and
never affects run stats.

## Starter unlocks

The weapon starter set contains 74 active ids. It includes all 29 current non-expansion weapons
(including the default `rusty-cleaver`) and adds one representative from every family absent from
that base group, covering 58 catalog families before pack chase begins.

```text
gravediggers-spade
rusty-cleaver
tombstone-greatsword
x-sword-whirlwind
driftblade
twin-bowie-fangs
x-sword-buzzsaw
x-sword-anchor
rattler-sabre
x-sword-coffin
x-sword-railspike
x-sword-neon-katana
x-sword-bone
x-gun-revolver-cannon
x-staff-arcane-lance
x-staff-storm-rod
x-gun-coffin-shotgun
x-gun-hand-mortar
x-gun-gatling
x-gun-nailgun
x-gun-ricochet-pistol
drift-katana-stillwater-edict
drift-katana-stormthread
drift-katana-riftstep
drift-nodachi-pale-horizon
drift-nodachi-gatebreaker
drift-greatkatana-moonwake
drift-greatkatana-tempest-regent
drift-colossal-world-seam
x2-abyssal-apocrypha
x2-anvil-drop
x2-auroral-filament-wand
x2-barrett-50-cal-sniper
x2-blightfork-glaive
x2-blightgrip-spore-mitt
x2-bogwater-twinbits
x2-boneash-scattergun-rifle
x2-bonewhisper-jian
x2-boneyard-ricochet-mortar
x2-boothook-harpoon
x2-bramblecoil
x2-brimstone-falcata
x2-brimstone-gallows-rifle
x2-brinequill-tidescepter
x2-buckhorn-boarspear
x2-buckshot-bramble-bow
x2-buzzard-s-burnout
x2-cairn-of-hollow-names
x2-carrion-cudgel
x2-cinderbrand-cleaver
x2-cinderchoke-blunderbuss
x2-cinderchoke-brazier-orb
x2-cinderquill-almanac
x2-codex-of-forked-tongues
x2-coffin-nail-rosary-orb
x2-confetti-cannon
x2-dustdevil-warmaul
x2-dustreaper-zweihander
x2-ember-fan
x2-emberleaf-chapbook
x2-frostquill-compendium
x2-ghostwind-spectre-rail
x2-glyphward-manuscript
x2-gravechill-nodachi
x2-hailshot-hand-maul
x2-hexglyph-partisan
x2-ledger-of-spent-souls
x2-mirage-hardlight-saber
x2-pendulum-of-the-pyre
x2-pyroglyph-spellbook
x2-reliquary-halberd
x2-riftcaller-naginata
x2-storm-fan
x2-witherleaf-bestiary
```

Starter characters are:

- `proto-cowboy-hidden-face`
- `proto-cowboy`
- `proto-hooded-rogue`
- `proto-junkyard-mechanic`
- `proto-templar-knight`
- `proto-wizard`

The existing `verdant-wing` remains the starter-owned pet. Sanitization always repairs all starter
unlocks so old, partial, or corrupt local records cannot brick a run.

## UI plan

`Packs` becomes a fourth MenuScene tab beside Characters, Armory / Carry, and Destinations. The
tab uses the existing full-screen Armory paper/panel palette. Its header shows the bank balance and
three horizontal pack cards with price, remaining-pool count, rarity legend, and affordable/sold-out
state.

Keyboard grammar mirrors the existing menu workspaces: arrows move pack focus, Home/End jump, and
Enter/Space buys the focused pack. Tabs remain click targets and pack cards are clickable. During
the short ceremony, Enter/Space/Shift/Escape reveals all remaining cards immediately; clicking the
ceremony also skips. The ceremony never exists in ArenaScene.

The three card backs deal in, then flip left-to-right. Each front shows rarity, kind, item name, and
either `NEW UNLOCK` or the mandatory `DUPLICATE -> +N MONEY` line. A final `BANK N` footer and
`CONTINUE` affordance return control without a modal stack or run launch.

The Characters workspace continues to show the whole roster, but locked cards are desaturated,
carry a `LOCKED` badge, and reject selection. If a stale selected-character preference points to a
locked id, it is repaired to `proto-cowboy-hidden-face`.

## Implementation log

- Initial authority, tuning, starter-set, rarity, persistence, input, and live-gate design recorded
  before runtime source edits.
- Added the shared booster catalog and pure opener: explicit seed, rarity-bucket roll, uniform
  identity roll, three-card with-replacement snapshot, atomic bank spend/refund, sold-out and
  insufficient-funds results, and exact per-card duplicate receipts.
- Added the 74-weapon and six-character starter constants, rarity derivation for all three pull
  kinds, locked-pool queries, and the active unlocked weapon-drop-pool projection.
- Advanced the persisted meta account from V4 to V5. V2/V3/V4 records migrate forward; starters
  are repaired; malformed/archived ids are dropped; existing legal bank instances become unlocked;
  and balance, pets, gear, prestige, bank, weapon unlocks, and character unlocks round-trip through
  one canonical sanitizer. The local cache key advanced to `dd.metaAccount.v5` with V4/V2 fallback.
- Changed chest weapon candidates from the old global `WEAPON_IDS` list to the opener's complete
  active unlocked pool. Authored enemy weapon rewards are now separately instanced per participating
  account and emitted only when that account owns the exact weapon id.
- Added the full-screen Packs menu workspace with bank balance, three purchasable pack cards,
  remaining-pool counts, affordability/sold-out states, arrows/Home/End plus Enter/Space grammar,
  pointer focus/purchase, and optional `packSeed` query input for deterministic private gates.
- Added the menu-only reveal ceremony: three dealt card backs, quick left-to-right flips, rarity
  color, item name, `NEW UNLOCK` or exact `duplicate -> +N money` line, refund/bank footer, and
  Enter/Space/Shift/Escape/click fast reveal/continue. No ceremony code or state enters ArenaScene.
- Character cards now project the full roster against V5 ownership. Locked rows stay visible with
  a grey treatment and lock badge, reject pointer/keyboard activation, and stale local selection is
  repaired to `proto-cowboy-hidden-face` before launch.
- Added unit coverage for power-budget rarity boundaries, pet rarity, exact rarity-weighted
  half-refunds, deterministic seeded replay, same-pack duplicate pulls, insufficient/sold-out
  transactions, starter-set size/family/default-loadout coverage, V4-to-V5 migration, V5
  persistence round trip, and active unlocked-pool filtering. GameRoom coverage now locks
  per-account co-op chest candidates, authored enemy-drop ownership, and locked character fallback.

## Verification

- `pnpm gen` — pass; 314 available VFX reference subjects regenerated, with the existing 24
  unavailable private references skipped.
- `pnpm gen:check` — pass.
- `pnpm typecheck` — pass across shared, client, and server.
- `pnpm test` — pass: 174 test files and 2,244 tests.
- `pnpm assets:check` — pass: 478 sprite entries / 1,007 parts, 635 atlas frames, 320 cards, and all
  checked projectile/particle/VFX URLs.
- Private deterministic pack gate — pass: Pet Pack seed 77 produced one new Rare Pale Firefly then
  two visible `duplicate -> +50 money` receipts, ending at 480 banked money and persisting in V5.
- Private transport gate — pass on client `52249` / game `52248`, room `I_8YHH2Gy`, schema 37:
  two weapon-cache rewards and two enemy weapon pickups were all in the 74-item account pool;
  locked `x2-sandsong-saber` was absent; no denial or protected-port use occurred.
- Visual ceremony screenshot — unavailable: the Browser skill recovery flow found no connected
  browser surface (`[]`) and prohibits a separate headless-browser substitute. The evidence records
  this explicitly rather than claiming a capture.

## Files touched

- `packages/shared/src/booster-packs.ts`
- `packages/shared/src/meta.ts`
- `packages/shared/src/index.ts`
- `packages/client/src/scenes/MenuScene.ts`
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/ui/character-select.ts`
- `packages/client/src/ui/pet-select.ts`
- `packages/client/src/ui/armory/model.ts`
- `packages/client/src/ui/wardrobe/model.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/progression.ts`
- `tests/booster-packs.test.ts`
- `packages/client/src/scenes/MenuScene.character-tab.test.ts`
- `packages/client/src/scenes/MenuScene.dev-links.test.ts`
- `packages/client/src/ui/character-select.test.ts`
- `packages/client/src/ui/armory/model.test.ts`
- `packages/client/src/ui/wardrobe/model.test.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/server/src/rooms/progression.test.ts`
- `docs/owner-notes-audit-v11-evidence/b20-l4-booster-meta/`
- `docs/sol-reports/impl-b20-l4-booster-meta.md`

VERDICT: packs tab live; 3 pack types; dupe refund on-flip; pool filtering enforced; starter set size 74; evidence path `docs/owner-notes-audit-v11-evidence/b20-l4-booster-meta/`; files touched: 19 source/test files plus the implementation report and retained evidence directory.
