# B59 — Lean canon index rebuild

## Evidence ledger

### Sources read

The reconciliation read the full current versions of:

- `DIMENSION_DRIFTERS_MASTER_SPEC.md` before replacement (951 lines);
- `docs/sol-reports/design-lock-b20.md`;
- `docs/sol-reports/design-lock-b57-dimension-loop.md`;
- `docs/sol-reports/night-summary-2026-07-24.md`;
- `docs/sol-reports/night-summary-2026-07-25.md`;
- `docs/sol-reports/audit-design-practice.md`;
- `docs/sol-reports/notes-ledger-v9.md`;
- `docs/sol-reports/notes-ledger-v10.md`;
- implementation reports for B20 L1–L5, B23, B26, B33, B42, B44, B45, the
  no-thumb character batches, and the cited art subjects;
- current shared/server/client source and generated catalogs where prose conflicted;
- committed parallel evidence from B55 (`6b63880`) and B58 (`394f7de`) without
  importing their gameplay/art changes into this worktree.

The evidence order was current code and generated data, current tests/reports,
Git history, then older declarations. Later owner rulings override earlier ones;
ambiguity remains open.

### Claim-to-truth map

| Claim under review | Current truth indexed | Evidence |
| --- | --- | --- |
| Stats, levels, XP, five-attribute allocation | Deleted for players; pet Bond XP/level bands are a distinct account/pet system | B20 lock rule 1; `9e4641c`; `packages/shared/src/state.ts`; `packages/shared/src/leveling.ts` explicitly says no numeric player progression |
| Weapon `scalingGrades` / `requirements` | Deleted at every weapon nesting level; any character can use any weapon | B20 lock; `9e4641c`; `WEAPONS`; existing data-consistency tests |
| Signature pick every five levels | Deleted with the level lane | B20 lock/dispositions; `impl-b20-l1-teardown.md` |
| “Ultimate” rarity prose | Not retained as canon | Owner B59 brief; pack rarity truth is `packages/shared/src/booster-packs.ts`; legacy `loot.ts`, `gear.ts`, `bank.ts`, and `style.json` still contain “Ultimate” rarity residues, recorded below rather than blessed |
| Chest/relic economy wording | Current player-facing fiction is dimensional capsules and trinkets | B20 lock composed with B57 fiction lock `90aae40`; B55 `6b63880` |
| In-run itemization | Capsules own weapon/trinket/money and B55 pet/potion rewards; enemy/boss itemization paths were retired | B20 rule 4; `impl-b20-l2-chests-relics.md`; B55 `6b63880` |
| Shopkeeper / sell | Deleted; archived art is not a live system | B20 rule 5; `05fda7a`; runtime room-source search |
| Disassembly | Floor/bag conversion to money, non-modal | B20 rule 6; `impl-b20-l3-economy.md` |
| Money settlement | No in-run sink; 100% banks at terminal settlement including death | B20 rule 7; B57 loop; `impl-b20-l3-economy.md` |
| Booster meta | Bank buys weapon/pet/character packs; rarity-weighted duplicate refund is visibly 50% | B20 rules 8–9; `fa592f4`; `impl-b20-l4-booster-meta.md` |
| Exact weapon persistence | Contradictory: B20 says no between-run stash, current build has a 72–144-entry stash and expedition persistence | B20 rule 10 vs `packages/shared/src/bank.ts`, server progression, and audit finding 7; routed to Q15 |
| Augment acquisition | B55 grants augments as eligible trinket payloads | B55 `6b63880`; B57 B55 disposition |
| Capsule content classes | Trinket/augment, weapon, pet, HP potion, money; exact weights stay out of prose | B55 `6b63880`; B57 disposition |
| Ultimates | Owner lock is OFF until further notice; dormant implementation is guarded by B55 | B57 disposition; B55 `6b63880` |
| HP potion behavior | B55’s instant 35%-max-HP heal is explicitly an owner-review assumption | B55 report; routed to Q02 |
| Capsule pet behavior | B55’s run-only replacement/no-unlock behavior is explicitly an owner-review assumption | B55 report; routed to Q03 |
| Core run shape | Grind room → timed typed portal → authored boss sequence/boss → harder grind room; death ends run | B57 `570696a` |
| Hub/crystals | Cut; no mid-run hub or portal currency | B57 rules 1–2 |
| Portal concurrency/type | Timed, randomly placed, visible type, unlimited concurrency; type selects sequence and destination | B57 rules 4–7 |
| Escalation/end condition | Ignoring portals loses to escalating enemies and a closing lethal gas circle | B57 rules 8–9 |
| Mode shape | One map-data system; `belt` mode is a deletion target, not canon | B57 mode-collapse lock; L1 not landed yet |
| Movement authority | Owner movement is accepted inside a bounded swept server envelope; combat/economy remain server-owned | B42 `3a05a22` |
| Enemy melee | Telegraph then target-locked committed lunge; walk/strafe is not post-lock evasion | B33 `7a32051` |
| Directional parry | Below lift, side damage-weighted slide, above brace, three guard poses per subtype | B26 `24e22dd` |
| Attack-driven player travel | Removed; rendered choreography remains planted | B44 `4d2c5ab` |
| Weapon displacement exception | Classified physical ranged recoil is sanctioned; melee/caster attacks remain planted | B45 `8d70bf3` |
| Chains/tassels/ropes | Standing visual ban because no truthful dangling simulation exists | B2/B3 reports and `tests/b3-fan-hybrids.test.ts` |
| Player auras | Standing ban; strike-local effects remain legal | B23 `cbaa4ae` and permanent tests |
| Fingers/thumbs | Standing ban for character and wrap limbs | `1f06dca`; B19 art reports; `impl-char-rig-batch3.md` |
| Modal rewards | Forbidden in live gameplay; short receipts/toasts are the accepted lane | B20 L2/L4 reports; audit findings 6 and 8 expose legacy violations |
| Large visual migrations | Render-layer only, every surface enumerated and screenshot-gated, playable after each merge | 2026-07-24 night summary; B57 implementation gate |
| Employer/capsule fiction | DPD employer; dimensional capsules are armory resupply pods with sealed/open art | B57 fiction `90aae40`; B58 `394f7de` |
| Character/weapon art language | Gritty flat-cel, Madness-flavored pill grunts, detached digit-free parts, flat right-facing weapon identity art, no baked VFX | old art locks `e178c1b` / `1f06dca`; executable `tools/artkit/style.json`; current character reports |

### Contradictions and non-inventions

- B55 and B58 are committed on parallel branches but are not ancestors of this
  worktree. The index cites their immutable commits and future report paths. The
  orchestrator must merge/rebase them before final branch verification.
- B57 L1 mode collapse has not landed. The index records the lock, but the new
  invariant test intentionally does not assert removal of `belt` yet.
- Current code still contains live between-run weapon-stash machinery despite
  B20’s no-stash lock. No winner was invented; Q15 asks for the ruling.
- Current shared/style sources still contain “Ultimate” rarity rows even though
  the owner says that tier was deleted. The lean index does not preserve the
  old tier. Removing/migrating executable rarity state is gameplay/data work and
  was not authorized in this documentation-only lane.
- B55’s HP-potion and pet behaviors are marked assumptions by its own report.
  They are Q02/Q03, not silently upgraded to canon.
- B57 portal cadence, lifetime, gas timing, arrival animation, branch table, and
  boss-sequence length are defaults or unfilled content, so they remain Q04–Q07.
- The practice audit’s fixes are recommendations, not owner locks. Only its
  verified contradictions became questions.

## Rebuild result

The new index contains only:

1. standing laws/bans with their reason;
2. one-line current locked decisions with dates, superseded designs, and citations;
3. fiction/art truths code cannot communicate;
4. explicit questions where the evidence does not authorize an answer.

The rebuilt spec is 274 lines, comfortably below the 400-line failure ceiling
and inside the requested 200–300-line target.

## Deletion ledger

The following old-spec material was intentionally removed rather than migrated:

- vision prose, pillars, genre pitch, and elevator pitch;
- dependency names/versions, renderer/server choices, and upgrade reminders;
- netcode architecture, sync tiers, tick rates, interpolation, reconnect details,
  and authoritative-state walkthroughs;
- player-count framing, camera behavior, movement constants, map dimensions, and
  other runtime facts discoverable by running or reading the game;
- the old arena/boss/extraction run walkthrough and corporate tower framing;
- class/signature system narration and every-five-level signature acquisition;
- parry implementation walkthrough, augment tables, and numeric tuning;
- arsenal slots, charge/durability behavior, tag schema, resource equations,
  weapon-size bands, starter loadout, bag/repair, affix, and rarity walkthroughs;
- all of old §§11–12: five stats, derived effects, XP curve, level cap, point
  allocation, level-up window, and signature cadence;
- run-only Gems, salvage/parts, shopkeeper, sell, weapon-bank, hub, and pack-flow
  walkthroughs that conflict with B20/B55;
- VFX API/registry/renderer architecture, function names, data flow, hitbox
  implementation, and per-source scaling history;
- enemy archetype/roster lists, counts, behavior tables, and implementation status;
- boss roster, phase scripts, tuning, and OLD RUST encounter walkthrough;
- dimension roster, procgen algorithm, map-validation implementation, and palette
  implementation tables;
- audio implementation, file counts, buses, and cue mechanics;
- HUD layout, key bindings, control lists, onboarding implementation, and modal
  inventory;
- hub-room description, matchmaking flow, session implementation, and vertical
  slice milestone plans;
- pending-spec roadmap, M0 build order, project tree, API conventions, pinned
  reference repositories, and dependency-mining advice;
- the 230+ line chronological decision log and per-feature implementation history;
- asset canvas sizes, resampling/mipmap/DPR recipes, file paths, code symbols,
  exact palette tables, per-dimension implementation blocks, and ArtKit internals;
- weapon/character/enemy counts and every “built/TODO” status snapshot.

Retained art prose was reduced to identity, originality, construction, and
presentation laws. Executable prompt detail remains in `tools/artkit/style.json`.

## Anti-rot test

`tests/canon-invariants.test.ts` adds three cheap, active checks:

1. `PlayerState` cannot regain numeric player `level`/`xp`/attributes or a
   pending level-choice field. Pet Bond XP is deliberately outside this claim.
2. Every weapon is recursively protected from serialized `scalingGrades` and
   `requirements` keys.
3. Runtime room source cannot regain `shopkeeper`, `shopNpc`, or `openShop`
   surfaces/messages.

The test does not fake coverage for visual laws, fiction, the unmerged B55
ultimate flag, or the unlanded B57 `belt` deletion. B55 owns active
ultimate-disabled tests in its branch; B57 L1 must add the belt invariant when
it lands.

## Verification

- Focused invariant test: passed, 1 file / 3 tests.
- `pnpm typecheck`: passed.
- Full `pnpm test`: passed, 217 files / 2,778 tests.
- `pnpm exec biome check tests/canon-invariants.test.ts`: passed.
- `git diff --check`: passed.
- LF check: passed for all three touched files.

## Files touched

- `DIMENSION_DRIFTERS_MASTER_SPEC.md`
- `tests/canon-invariants.test.ts`
- `docs/sol-reports/impl-b59-canon-index.md`

verdict: spec 951 -> 274 lines, 8 laws, 22 locked decisions, 14 fiction entries, 15 open questions, invariant test: 3/3 active checks passed (player progression state, nested weapon stat coupling, shopkeeper room surface), files touched: DIMENSION_DRIFTERS_MASTER_SPEC.md; tests/canon-invariants.test.ts; docs/sol-reports/impl-b59-canon-index.md.
