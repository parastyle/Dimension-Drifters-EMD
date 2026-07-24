# B22 Fan Tornado V2 Implementation Report

## Understanding

B22 corrects the B18 presentation contract for exactly three fan weapons:

- `x2-iron-war-fan` / `vfx-tornado-iron-gale`
- `x2-ember-fan` / `vfx-tornado-ember-fire`
- `x2-storm-fan` / `vfx-tornado-storm-shock`

Each attack must produce one elemental tornado at approximately the full 76 px character-art envelope height. The tornado is no longer presentation-only: it is a server-owned, facing-aware projectile whose authoritative moving damage envelope stays aligned with its visible funnel. It travels a moderate distance at a speed comparable to existing slow projectile families.

The funnel remains vertical throughout its lifetime. Its only animation is travel plus a restrained scale pulse; it must not rotate or alternate flips while moving. A single spawn-time mirror based on facing is permitted.

The tornado becomes the complete fan VFX signature. B18's fan-out weapon-sprite motion remains, but all ribbon, sweep-glow, hybrid projectile, and other supplementary fan effects must be removed for these three weapons. No non-fan weapon, character, pet, kung-fu wrap, B20 surface, aura, chain, or tassel behavior is in scope.

Damage will be redistributed from the existing fan arc and/or hybrid source into the moving tornado as needed so each weapon's nominal per-attack DPS remains within 10% of its current 20 DPS baseline. The implementation and migrated tests will require visible and authoritative travel to share the same spawn geometry, speed, range, and lifetime.

## Implementation plan

1. Trace the B18 fan recipes, client renderer, shared weapon definitions, server projectile ownership, hit-envelope logic, and focused/live tests.
2. Define a generated-data contract for one upright, non-spinning, player-height tornado projectile per fan, using a moderate range and an established slow-projectile speed family.
3. Move the tornado damage into a server-authoritative traveling envelope and rebalance the retained fan arc so nominal DPS stays in the 18-22 band.
4. Preserve only the fan-out weapon-sprite motion and suppress every other fan VFX layer, including B18 ribbons/sweep effects and displaced hybrid visuals.
5. Migrate B18's unit and live-gate assertions to cover size, upright/no-spin transforms, sole-VFX output, both-facing forward travel, aligned moving damage, and DPS.
6. Run generation, generated-file checks, typecheck, the full unit suite, and asset validation.
7. Exercise all three fans in both facings with `proto-cowboy-hidden-face` on private ephemeral ports, retain screenshots and machine-readable observations under `docs/owner-notes-audit-v11-evidence/b22-fan-tornado-v2/`, visually inspect the captures, then commit the completed correction set.

## Progress

- Recorded the B22 correction contract and implementation plan before changing product code.
- Replaced the split B18 presentation/damage model with one replicated `fan:tornado` projectile per accepted fan swing. All three use 520 px/s speed, 260 px range, 0.5 s authoritative life, one projectile, no spread, no return leg, and one pierce.
- Added a shared 48x76 upright capsule envelope: 24 px radius plus a 14 px vertical half-segment. Client display geometry and server swept collision both consume this one contract.
- Kept the visible fan weapon's folded-to-open motion data, while setting each weapon and VFX row to suppress procedural swing/ribbon layers.
- Removed the legacy iron-gust, ember-shard, storm-returning-arc projectile/impact recipe modules. The generated tornado image now renders directly on the server projectile row; projectile removal produces no extra fan impact VFX.
- Replaced B18's spin/alternating-flip tween with fixed zero rotation, one spawn-time horizontal facing mirror, and a uniform growth-only 1.00-1.06 scale pulse.

## Iron War Fan

- `x2-iron-war-fan` now launches `vfx-tornado-iron-gale` on every accepted swing rather than only releasing a cutting gust on the third combo beat.
- The projectile travels straight forward at 520 px/s for 260 px and carries 4 damage inside the shared player-height upright envelope.
- The retained visible fan cut deals 12 damage. At the 0.8 s cadence, the 15 melee DPS plus 5 tornado DPS remains exactly 20 DPS.

## Ember Fan

- `x2-ember-fan` now launches one `vfx-tornado-ember-fire` rather than three cinder shards.
- The one tornado travels straight forward at 520 px/s for 260 px and carries the complete 4-damage secondary payload in the shared upright envelope.
- The retained visible fan cut remains 12 damage, preserving exactly 20 nominal DPS at the 0.8 s cadence.

## Storm Fan

- `x2-storm-fan` now launches one `vfx-tornado-storm-shock` straight forward; the old 300 ms reversal, return leg, re-armed damage ledger, and folding-arc impact treatment are removed.
- Its 520 px/s, 260 px forward flight carries 4 damage in the same 48x76 upright envelope.
- The retained visible crossed-fan cut remains 12 damage, preserving exactly 20 nominal DPS at the 0.8 s cadence.

## Focused verification

- The migrated B18/B3 coverage is consolidated in `tests/b22-fan-tornado-v2.test.ts`, `tests/b3-fan-hybrids.test.ts`, `packages/client/src/vfx/fan-tornado-vfx-recipes.test.ts`, `packages/server/src/rooms/GameRoom.b3-fans.test.ts`, and `tests/v7-hit-envelope-law.test.ts`.
- Focused verification passes 31/31 tests. It covers catalog identity, direct-loaded PNG dimensions, the retained fan-out weapon motion, one tornado per accepted beat, both-facing forward velocity, the exact 48x76 upright damage envelope, collision at the visible boundary and rejection outside it, no rotation/flip animation, sole-VFX suppression, bespoke audio, and exact 20 DPS totals.
- The obsolete B18 presentation-only gate and B3 gust/shard/return gate were replaced by the single B22 live gate. No current coverage asserts the removed secondary VFX identities.

## Live gate

- Ran `e2e/tests/b22-fan-tornado-v2-live-gate.spec.ts` against the real Arena client and Colyseus authority with `proto-cowboy-hidden-face`.
- Used private ephemeral ports only: client `53787`, game `53786`; protected ports `5180` and `2567` were never used.
- Captured all six weapon/facing combinations. Authoritative forward displacement measured 60.1-141.4 px at the frozen capture frames, while rendered displacement measured 81.5-98.8 px.
- Every capture records container rotation `0`, image rotation `0`, no vertical flip, a fixed horizontal mirror only for left-facing travel, exactly one visible generated fan-VFX container, and zero procedural fan-VFX frames.
- The base projectile display/damage geometry is exactly 48x76. The restrained growth-only pulse produced captured display sizes from 49.4x78.2 through 50.7x80.2, within the declared 1.00-1.06 range.
- Each fan produced an authoritative `HybridProjectile` receipt against the same dummy within one or two ticks of its sampled moving funnel path. The observed target lateral distances were 8.0 px (iron), 1.6 px (ember), and 40.7 px (storm), all inside the swept funnel plus target collider.
- Visually inspected all six PNG captures. The correct elemental funnel is player-height, vertical, cleanly separated from the character, traveling in the committed facing, and is the only fan VFX visible.
- Evidence: `docs/owner-notes-audit-v11-evidence/b22-fan-tornado-v2/live-gate.json` plus six facing PNGs in the same directory.

## Final verification

- `pnpm gen`: pass. The isolated worktree required the same gitignored art-tool dependency fixtures used by the primary checkout; the unrelated VFX-subject scratch catalog was restored after generation because its reference-art tree is intentionally unavailable here.
- `pnpm gen:check`: pass; the unavailable untracked VFX reference-art check reports its expected skip while every tracked generated output is synchronized.
- `pnpm typecheck`: pass across shared, client, and server.
- `pnpm test`: pass, 167 test files / 2,239 tests.
- `pnpm assets:check`: pass, 478 sprite entries / 1,007 parts, 635 atlas frames, 320 cards, 24 projectile URLs, 96 particle URLs, and 9 weapon-VFX URLs.
- Private-port B22 live gate: pass, one Playwright test with six visual captures and three moving-damage proofs.

## Files touched

- Source data/generation: `data/weapon-concepts-300.json`; `tools/artkit/build-weapon-vfx.mjs`; `tools/artkit/gen-weapon-expansion.mjs`; `tools/artkit/weapon-vfx-overrides.json`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/client/src/vfx/weapon-vfx.generated.ts`.
- Shared/server authority: `packages/shared/src/hit-envelope.ts`; `packages/shared/src/weapons.ts`; `packages/server/src/rooms/GameRoom.ts`.
- Client runtime: `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/vfx/generated-image-weapon-vfx-recipes.ts`; `packages/client/src/vfx/generated-image-weapon-vfx.ts`.
- Removed obsolete fan VFX runtime: `packages/client/src/vfx/fan-hybrid-vfx-recipes.ts`; `packages/client/src/vfx/fan-hybrid-vfx.ts`.
- Unit coverage: `packages/client/src/vfx/fan-tornado-vfx-recipes.test.ts` (replaces `fan-hybrid-vfx-recipes.test.ts`); `packages/server/src/rooms/GameRoom.b3-fans.test.ts`; `tests/b22-fan-tornado-v2.test.ts` (replaces `tests/b18-fan-tornado.test.ts`); `tests/b3-fan-hybrids.test.ts`; `tests/v7-hit-envelope-law.test.ts`.
- Live coverage/evidence: `e2e/tests/b22-fan-tornado-v2-live-gate.spec.ts` (replaces the obsolete B18 and B3 fan gates); `docs/owner-notes-audit-v11-evidence/b22-fan-tornado-v2/`; this report.

verdict: 3 tornadoes player-sized/upright/non-spinning/traveling, sole fan VFX, DPS band exactly 20 each (within ±10%), evidence path `docs/owner-notes-audit-v11-evidence/b22-fan-tornado-v2/`, files touched: fan source/generators/generated catalogs; shared/server projectile envelope authority; client fan renderer/runtime; migrated unit/live tests; B22 evidence; `docs/sol-reports/impl-b22-fan-tornado-v2.md`.
