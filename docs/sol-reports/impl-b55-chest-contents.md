# B55 — Chest content overhaul and augment revival

## Outcome

B55 restores the orphaned augment system through chest trinkets while leaving the
existing relic mechanics and identifiers intact. `relic` remains the internal
implementation term to avoid a churn refactor; all player-facing HUD, chest
receipt, and toast copy now says **trinket**.

Ultimates are reversibly disabled behind the single shared constant
`ULTIMATES_ENABLED` in `packages/shared/src/constants.ts`. It currently equals
`false`. While false, the client does not render or route the ultimate HUD,
reveal, ready hint, key legend, input, or VFX; the server rejects activation,
does not charge or grant an ultimate, and continually keeps the synchronized
ultimate state locked and zeroed. The implementation and its detailed tests
remain dormant behind the same constant, so re-enabling is a one-line change.
The B20 interim hardcoded Sunspite Comet assignments now resolve to locked/empty
state while the flag is off.

## Chest table

Weights are percentages and total 100 in each zone.

| Content | Commons | Scar |
| --- | ---: | ---: |
| Trinket | 34% | 38% |
| Weapon | 24% | 30% |
| Pet | 10% | 12% |
| HP potion | 14% | 8% |
| Money | 18% | 12% |

Additional trinket rolls:

| Roll | Commons | Scar |
| --- | ---: | ---: |
| Rare trinket, conditional on a trinket result | 8% | 20% |
| Augment payload, conditional on an eligible trinket | 35% | 50% |

Luck scales rare-trinket and augment chances using the existing capped luck
multiplier. Scar moves weight away from consumables/currency and toward lasting
run power. Existing behavior remains in place for per-player opened state,
player-keyed seeded determinism, Scar weapon-tier risk weighting, and the
2.5-minute weapon-cache rubber band. Weapon-cache chests remain guaranteed
weapon rolls.

Category, weapon, trinket, augment, pet, and money use separate deterministic RNG
streams. This keeps a roll stable when unrelated candidate lists change.

## Augments on trinkets

The explicit mapping covers all 16 shipped augment definitions:

| Internal trinket ID | Player-facing trinket | Augment payload |
| --- | --- | --- |
| `energy-pool` | Capacitor | Vented Coils |
| `energy-regen` | Kinetic Coil | Overcharge |
| `parry-reach` | Wide Guard | Counterblade |
| `dodge-recovery` | Light Soles | Hair-Trigger |
| `move-speed` | Roadrunner Spur | Twin Fang |
| `hp-regen` | Mending Thread | Second Wind |
| `luck` | Lucky Tooth | Ricochet Rounds |
| `crit` | Keen Edge | Hollow-Points |
| `jump-count` | Skyhook | Arc Split |
| `dodge-shuffle` | The Shuffle | Deflector |
| `dodge-ninja-flip` | Ninja Flip | Iron Stance |
| `dodge-phase-step` | Phase Step | Bulwark |
| `dodge-bloodhound-step` | Bloodhound Step | Steady Lens |
| `revive` | Second Wind | Emberguard |
| `one-shot-protection` | Death Ward | Brand or Conflagration |

The authority writes the payload through `grantAugment()`, appends to the synced
CSV, validates IDs, and respects each existing stack contract. Non-stacking
augments cap at one; Arc Split caps at its existing three-stack gameplay limit;
other stackable augments retain their existing unbounded behavior. A capped
payload is excluded before rolling, preventing silent dead rewards.

Chest receipts include trinket label, rarity, current relic stack, and—when
present—the augment's name, description, and new stack count. The non-modal
toast therefore always says what was gained and what an augment does.

Augments clear on join, restart, Testing Grounds reset, terminal run settlement,
and all other run-reset paths alongside relic/run state.

## HP potion assumption — OWNER REVIEW REQUIRED

**ASSUMPTION: an HP potion is an instant chest pickup, not inventory. It heals
35% of maximum HP and clamps at maximum HP.**

The heal uses the existing authoritative heal/pickup presentation route and the
shipped `revive` heal-family SFX. It deliberately bypasses the Hearth weapon's
healing multiplier so the documented 35% chest reward remains exact. Unit tests
cover exact math, invalid inputs, and overheal clamp; the live gate records a
35-point heal at 100 maximum HP.

## Chest pet assumption — OWNER REVIEW REQUIRED

**ASSUMPTION: a chest pet becomes the player's one active companion for the
remainder of the run, automatically replacing the current active pet, and does
not unlock anything on the meta account.**

The replacement is reported by name in the chest toast. Run-only pets neither
gain terminal bond XP nor persist across a run reset; the persistent account
selection is restored when returning to the normal reset path. Tests verify
activation, replacement, lack of account unlock, and reset restoration.

## Verification

- `pnpm gen` — passed.
- `pnpm gen:check` — passed. The existing optional VFX-subject check reported
  its documented skip because local ArtKit output references are unavailable.
- `pnpm typecheck` — passed for all workspaces.
- `pnpm test` — passed: 216 files, 2,766 passed, 20 skipped, 2,786 total. The
  skipped cases are the retained ultimate implementation suites guarded by
  `ULTIMATES_ENABLED`; the disabled contract itself is active and passing.
- `git diff --check` — passed.

Unit coverage includes augment grant/stack/cap/clear, chest weights and
determinism, potion heal/clamp, pet activation/swap/non-unlock, the ultimate
disabled contract, and direct authoritative combat checks for three augment
families:

- Hollow-Points: two stacks produce `+2` projectile pierce.
- Ricochet Rounds: two stacks produce `+2` projectile bounces.
- Arc Split: three stacks add three split projectile rows.

The private-port live gate used Vite `5195`, Colyseus `2591`, and local evidence
control `2592`; it did not use `5180` or `2567`. It opened every requested
content type through the real network message path, captured an
augment-bearing trinket with explanatory receipt copy, proved Hollow-Points hit
two collinear targets, healed with a potion, swapped a run pet, and observed
locked/zero ultimate state. The in-app Browser reported no available browser,
so a HUD screenshot could not be captured; this limitation is documented
without substituting a disallowed standalone browser.

Evidence:
`docs/owner-notes-audit-v12-evidence/b55-chest-contents/`

## Design-audit and merge notes

The supplied audit finding and current code agree that B20 removed the sole
augment acquisition write. The implemented owner interpretation deliberately
uses existing relics as player-facing trinkets instead of redesigning the relic
system. No damage/DPS constants changed; combat changes only through pre-existing
augment reads.

B55 does not touch `packages/shared/src/weapons.ts`, the generated weapon
catalog, or `SCHEMA_VERSION`. The orchestrator should still rebase onto main
before merging and reconcile any B54 schema/catalog changes there rather than
assuming this branch's current schema pin.

## Files touched

- `packages/shared/src/constants.ts`
- `packages/shared/src/augments.ts`
- `packages/shared/src/chests.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/room/room-combat.ts`
- `packages/server/src/rooms/room/room-economy.ts`
- `packages/server/src/rooms/room/room-progression.ts`
- `packages/server/src/rooms/GameRoom.combat-weapons.test.ts`
- `packages/server/src/rooms/GameRoom.economy.test.ts`
- `packages/server/src/rooms/GameRoom.progression-late.test.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/ui/ultimate-reveal.ts`
- `packages/client/src/ui/ultimate-reveal.test.ts`
- `packages/client/src/ui/verb-legend.ts`
- `packages/client/src/ui/verb-legend.test.ts`
- `tests/augments.test.ts`
- `tests/chests.test.ts`
- `docs/input-map.md`
- `docs/owner-notes-audit-v12-evidence/b55-chest-contents/README.md`
- `docs/owner-notes-audit-v12-evidence/b55-chest-contents/live-gate-server.ts`
- `docs/owner-notes-audit-v12-evidence/b55-chest-contents/live-network-gate.ts`
- `docs/owner-notes-audit-v12-evidence/b55-chest-contents/live-network-evidence.json`
- `docs/sol-reports/impl-b55-chest-contents.md`

VERDICT: ultimates gated off (`ULTIMATES_ENABLED`), augments grantable (3 families proven), chest table shipped, potion + pet sources live, assumptions flagged, evidence path `docs/owner-notes-audit-v12-evidence/b55-chest-contents/`, files touched: shared augments/chests/constants; server combat/economy/progression/room/tests; client arena/ultimate reveal/verb legend/tests; input map; B55 evidence harness/results; implementation report.
