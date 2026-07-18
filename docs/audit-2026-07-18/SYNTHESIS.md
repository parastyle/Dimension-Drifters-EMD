# Audit synthesis — 2026-07-18 (six-bot pass)

Six territories: [server](server.md) · [client](client.md) · [prune](prune.md) ·
[shared](shared.md) · [tests](tests.md) · [tooling](tooling.md). 792 lines of findings
distilled into one ordered plan. Nothing below has been executed — owner picks.

## Fix now (small, sharp, real)

1. **META_UPGRADES is a live half-retired shop** (prune P0-1): the shopkeeper still sells
   the old upgrade tracks alongside the gear economy they were folded into — inconsistent
   pricing/state. Finish the fold or tombstone the shop rows. ~1 Sol.
2. **Schema-mismatch guard warns but still installs the patch path** (client P1-1): a
   version-mismatched server currently half-connects instead of refusing cleanly.
3. **E2E port collisions skip instead of fail** (tests P2.5): the false-green class that
   bit us this morning — make "stack didn't boot" a failure.
4. **`gen:check` can green-skip on a dirty checkout** (tooling P1-1) and **the replacement-
   bake contract tests aren't in root/CI** (tests P1.1): wire both into CI's gauntlet.
5. **Beam heat is still a client-visible API** (prune P1-2) + seven obsolete wire fields:
   alias/retire once the Drive HUD is confirmed stable.

## The prune plan (ordered by precondition)

| System | Precondition | Reclaims | Recipe |
|---|---|---|---|
| v1 layered-gear path + old-format art | **replacement fleet completes + fit-check approved** | large client path + old renders | prune P0-2's sequencing |
| 40 legacy character kits (one vertical slice: data + fallback + select + art) | wardrobe accepted as the only identity (owner call) | ~40 kits of code+art (biggest single win) | prune P1-1 |
| BELT mode (compiled surface + 19% of public bytes) | owner ruling: keep-shelved vs delete | ~MB-scale assets + a second game mode's code | prune P1-3 + tooling P1-5 |
| Drive-obsolete wire fields + ledgers (charges/magazine/heat tombstones) | one stable release on schema 31 | wire bytes + confusion | prune P1-2, shared P2.5 |
| Banned whips' boot-loaded art, concept-catalog dupes, 4 icon packs + 11 portraits, 15.25 MiB unreachable public/ui, outline tool + archive | none — dead today | ~20+ MiB | prune P2s, tooling P1-4 |

## The refactor roadmap (post-feature-freeze, not now)

- **GameRoom**: no enforceable subsystem boundaries (server P1-4) — extract along the
  audited phase-order contract; unify the three revisioned-transaction receipt idioms
  (server P1-3); route all gameplay messages through the action budget (server P1-2).
- **ArenaScene (13.9k lines) / SpriteRig (8.6k)**: the audited seam maps exist (client
  P1-4/P1-5) — HUD regions, input, join/net, presentation directors; bake lifecycle out
  of choreography. Do it as its own dedicated wave with e2e before/after.
- **Shared**: split the misleading `DualWieldState` tail name, layout-contract test for
  the 64-field ceiling (shared P1.3), registry prototype-name hole (P1.1), constants.ts
  grouping + dead-knob sweep (P2.4).

## Test estate

Green and law-complete, but: consolidate panel-named append logs into module-owned
suites (map in tests P2.1/P2.3), share the copied harnesses (P2.4), collapse the
duplicate 200-map mapgen regeneration (P2.2 — the suite's whole hot spot), add the
missing metagame e2e journeys (P1.4: wardrobe→carry→extract/death→settlement).

## Standing note

Server P0-1 (client-forged accounts accepted) is the LOCAL-TRUST MODEL working as
designed for friends-and-family play — it becomes a real P0 only at public deploy.
It is recorded here so the deploy milestone inherits it explicitly.
