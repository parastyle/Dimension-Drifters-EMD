# Sol report: impl-b49-melee-thrown

Branch: `sol/b49-melee-thrown`
Worktree: `C:/Users/Exped/ddv2-wt/b49-melee-thrown`

## Outcome

All thirteen owner orders are implemented and covered by migrated/unit tests plus a private-port live gate for both facings. The consolidated live receipt contains 26 captures, reports exactly `0px` maximum attack displacement, includes visible Gravedigger and Doubleheader damage-number cadence frames, and records paired Void Throwing Star helix frames in both directions.

## Hailshard regression culprit

The regression came from B30 commit `2a577c7` (`feat: implement recovered B30 weapon orders`, merged by `12986aa`). B30 interpreted the rogue-VFX note too broadly: it changed Hailshard from its radial-random/spinning presentation to a forward cone/hold and added suppression that removed the circular weapon read. This batch restores the intended continuous 360-degree swing and omnidirectional ice while retaining suppression of the unrelated melee hitbox.

## Orders

| # | Weapon | Result |
|---:|---|---|
| 1 | `x2-hailshard-resonator` | Restored a held circular shaft spin and `radial-random` ice emission around the player. |
| 2 | `gravediggers-spade` | Set five visible revolutions per second (half the observed rate), three authoritative hits per 0.6-second beat, and `8 / 3` damage per hit so beat damage/DPS remains unchanged. Every revolution emits a combat receipt/damage number; attack displacement is zero. |
| 3 | `x2-cinderbrand-cleaver` | Confirmed the B44 in-place implementation, retained its envelope, and added current-schema/live regression coverage proving zero displacement. |
| 4 | `x2-brimstone-doubleheader` | Added continuous held, one-revolution in-place whirlwind attacks with two opposed outstretched arms, no VFX, swept hit resolution, and a damage-number receipt for every accepted revolution. |
| 5 | `x2-hollowmoon-reaver` | Added an upright, slightly forward carry plus a five-beat eclipse combo with authored lead/support-hand positioning. |
| 6 | `x2-frostfang-rakes` | Kept the pose and increased authored forward hand travel to 64px. |
| 7 | `x2-gallows-splitter` | Added an authored two-hand overhead windup behind the head and forward axe release. |
| 8 | `x2-saloon-tomahawk` | Added the same proper two-hand over-the-shoulder axe throw language. |
| 9 | `x2-reverent-broadsword` | Extended the flip timing through `flipEnd: 0.68`; migrated render evidence tests. |
| 10 | `x2-emberfist-wraps` | Reduced fist display length to 40 and extended punch reach to 184. |
| 11 | `x2-void-throwing-star` | Made the weapon dual-wielded; the server emits two equal-damage source parts at opposite helix phase and the client reconstructs their paired curved paths. |
| 12 | `x2-frostknuckle-rimewrap` | Uses the existing sprite as a mirrored second glove and fires fist-anchored weaponized frost/star projectiles made from existing ice assets. |
| 13 | `x2-cinderpalm-brand-glove` | Made the glove dual-wielded and moved its flame/projectile source to the rendered fist anchor; no player/body aura is created. |

## Guardrails and combat accounting

- All 26 live captures measured `0px` maximum displacement. Spins, melee combos, and authored throws remain planted.
- Gravedigger retains eight total damage per 0.6-second beat by splitting it over three revolution hits.
- Void Throwing Star splits the existing total throw damage equally across its two helix parts.
- Doubleheader resolves one swept hit/receipt per visual revolution; its held cadence does not add off-cycle damage.
- Hailshard keeps its existing hold scaling, and the remaining weapons retain their prior damage/cooldown envelopes.
- Doubleheader has VFX suppressed; Cinderpalm and Frostknuckle effects originate at hands/fists. No player aura or chain behavior was added.

## Verification

- `pnpm gen` — pass.
- `pnpm gen:check` — pass.
- `pnpm typecheck` — pass after final implementation.
- `pnpm test` — pass: 212 files, 2,743 tests.
- `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/tests/b49-melee-thrown-live-gate.spec.ts --workers=1` — pass in 5.0 minutes.
- Live gate: client port `58185`, game port `58184`; neither standing/default port was used.
- Live receipt: 13 orders, 26 captures, 0px maximum displacement.
- Cadence evidence: both facings for Gravedigger and Doubleheader, with visible simultaneous damage labels and per-revolution authoritative receipts.
- Helix evidence: seven paired rendered frames per facing; maximum pair separation was 51.14px right and 50.57px left.
- `git diff --check` — pass; line endings and whitespace are clean.

## Evidence

- Index: `docs/owner-notes-audit-v12-evidence/b49-melee-thrown/README.md`
- Machine receipt: `docs/owner-notes-audit-v12-evidence/b49-melee-thrown/live-gate.json`
- Screenshots: 26 order/facing frames plus four dedicated damage-cadence frames in the same directory.

## Files touched

- Weapon data/schema/generation: `data/weapon-concepts-300.json`, `packages/shared/src/melee.ts`, `packages/shared/src/weapons.ts`, `packages/shared/src/weapons-expansion.generated.ts`, `tools/artkit/gen-weapon-expansion.mjs`, `tools/portal/index.html`.
- Client runtime: `packages/client/src/entities/rig/rig-pose.ts`, `packages/client/src/scenes/ArenaScene.ts`, `packages/client/src/sprites/pose-language.ts`, `packages/client/src/vfx/caster-vfx-recipes.ts`.
- Server runtime: `packages/server/src/rooms/room/room-combat.ts`, `packages/server/src/rooms/room/room-progression.ts`.
- Tests: the new B49 unit/live gates plus migrated client, server, B24, B30, B44, owner-order, V3C, V5M, and V6A expectations listed in the commit.
- Documentation/evidence: this report and 32 artifacts under `docs/owner-notes-audit-v12-evidence/b49-melee-thrown/`.

verdict: 13 orders done; Hailshard culprit: B30 commit 2a577c7 (merge 12986aa); evidence: docs/owner-notes-audit-v12-evidence/b49-melee-thrown/; files touched: 67 total (35 source/generated/test/report files, 32 evidence artifacts).
