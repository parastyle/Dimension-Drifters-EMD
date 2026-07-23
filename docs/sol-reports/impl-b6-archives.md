# B6 Weapon Catalog Archives — Implementation Report

## Archive mechanism found

The repository already has a durable archive path centered on `WeaponDef.archived`.
The authoritative `data/weapon-concepts-300.json` row carries `"archived": true`;
`tools/artkit/gen-weapon-expansion.mjs` validates and copies that flag into
`packages/shared/src/weapons-expansion.generated.ts`; and
`packages/shared/src/weapons.ts` keeps every definition in `WEAPONS` and
`WEAPON_CATALOG_IDS` while filtering archived rows out of
`ACTIVE_WEAPON_CATALOG_IDS`, `ACTIVE_EXPANSION_WEAPON_IDS`, `WEAPON_IDS`, and
`isActiveWeaponId`.

Existing acquisition boundaries build on that same state:
`packages/shared/src/loot.ts` excludes archived rows from curated drops,
class-pool rolls, and provenance checks; the Weaponsmith authoring roster,
Testing-Grounds showroom, direct dev-equip, enemy weapon drops, and bank
acquisition/migration paths also consult the canonical `archived` flag. The
definition and resource rows deliberately remain addressable so historical
IDs do not dangle.

## Plan

1. Mark only `x2-coffin-nail-carbine` and
   `x2-psalter-of-the-burning-halo` as archived in the authoritative concept
   data and run the normal generator.
2. Advance archive/active census guards from 334 active + 9 archived to 332
   active + 11 archived without changing the durable total.
3. Add a B6 archive census gate that proves the exact two-ID state delta,
   absence from every exposed new-acquisition/selection pool, canonical
   resolution by ID, and existing-save/inventory handling without crash or
   silent substitution.
4. Run `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`,
   `pnpm typecheck`, the full `pnpm test`, and a server boot smoke test on a
   non-reserved port. Retain command and acceptance evidence under
   `docs/owner-notes-audit-v9-evidence/b6-archives/`.
5. Append the verified results and final verdict here, inspect the complete
   diff, and commit the isolated worktree on `sol/b6-archives`.

## Implementation

Both authoritative concept rows now carry `"archived": true`. The unchanged
generator archive mapping emitted the same flag on both durable generated
definitions. No parallel retirement mechanism was added: the existing
`packages/shared/src/weapons.ts` archive filters now naturally place the two
IDs in `ARCHIVED_WEAPON_IDS` while excluding them from active catalog,
expansion, and ordinary selection rosters.

The durable census remains 343. The state split moved from 334 active + 9
archived to 332 active + 11 archived, and active expansion moved from 305 to
303. The resource census and every active-roster pin were advanced together.
The regenerated portal contains 332 active launch rows and neither archived
deep link; the Weaponsmith accessibility shell reports the same active count,
while its existing runtime filter hides archived definitions.

## Acceptance proof

`tests/b6-weapon-archives.test.ts` locks the complete archive set as the prior
nine IDs plus exactly the two B6 IDs. It also proves both are absent from
`ACTIVE_WEAPON_CATALOG_IDS`, `ACTIVE_EXPANSION_WEAPON_IDS`, `WEAPON_IDS`,
`DROP_POOL`, enemy wield identities, and every accepted acquisition
provenance. Existing generic W4A coverage continues to prove archive exclusion
from Testing-Grounds pages, direct dev-equip, portal links, and the default
Weaponsmith roster.

`tests/fixtures/b6-archived-weapon-bank-v1.json` is a serialized historical
inventory containing one instance of each exact ID. The production sanitizer
loads it successfully without changing either ID; both definitions and
resource rows resolve under their original names; and the existing one-way
archive migration reports those same two IDs before removing and valuing the
instances. This proves historical resolution and intentional migration rather
than a crash, rejection, default-weapon fallback, or silent substitution.

The retained runtime census and save result are in
`docs/owner-notes-audit-v9-evidence/b6-archives/archive-census.json`, with the
validation ledger beside it.

## Verification

- `pnpm gen` — pass; generated catalog and portal updated.
- `pnpm gen:check` — pass. The documented fresh-checkout skips applied only to
  unavailable untracked VFX reference and character-parts caches.
- `pnpm assets:check` — pass: 426 sprite entries / 781 parts, 431 atlas frames,
  320 cards.
- `pnpm typecheck` — pass across shared, server, and client.
- `pnpm test` — pass: 139 test files, 1,803 tests.
- Built-server smoke — pass on OS-assigned ephemeral port 53170, followed by a
  clean shutdown; ports 5180 and 2567 were not used.

## Files touched

- Archive source/output: `data/weapon-concepts-300.json`,
  `packages/shared/src/weapons-expansion.generated.ts`.
- Census and active surfaces: `packages/shared/src/weapon-resource.ts`,
  `tools/portal/index.html`, `tools/weaponsmith/public/index.html`.
- Census regression updates: `packages/server/src/rooms/GameRoom.test.ts`,
  `tests/w4a-weapon-archive.test.ts`,
  `tests/v61-brutalist-greatswords.test.ts`,
  `tests/v3x-auto-rifles.test.ts`.
- B6 acceptance: `tests/b6-weapon-archives.test.ts`,
  `tests/fixtures/b6-archived-weapon-bank-v1.json`.
- Handoff/evidence: `docs/sol-reports/impl-b6-archives.md`,
  `docs/owner-notes-audit-v9-evidence/b6-archives/archive-census.json`,
  `docs/owner-notes-audit-v9-evidence/b6-archives/verification.md`.

Verdict: both weapons archived; pool-absence is proven across active, drop, enemy, portal, Testing-Grounds, Weaponsmith, and acquisition surfaces; save-safety is proven by exact-ID fixture load, canonical/resource resolution, and exact-ID archive salvage; files touched are the authoritative concepts, generated catalog, census/active surfaces, regression and B6 acceptance tests, serialized fixture, report, and retained evidence listed above.
