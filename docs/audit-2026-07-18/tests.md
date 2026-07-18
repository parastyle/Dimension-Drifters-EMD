# Test-suite health audit — 2026-07-18

Scope: the configured 66-file Vitest estate, the standalone Artkit contract test, and all six Playwright specs. A read-only `pnpm exec vitest run` passed all 66 files / 1,218 tests in 22.45s; Playwright was not run because its harness starts its own Vite/Colyseus stack and the requested background services were left untouched. The known repo-wide Biome/CRLF debt is intentionally omitted.

## P0

No P0 test-health finding: the configured Vitest suite is green and no currently gated law is silently failing.

## P1

### P1.1 — The replacement-bake contract is not in the root test or CI estate

Evidence: `vitest.config.ts:7-10` includes only `tests/**/*.test.ts` and `packages/**/src/**/*.test.ts`; `tools/artkit/lib/gear-replacement-contract.test.mjs:35`, `:93`, and `:125` define three `node:test` contracts; `tools/artkit/package.json:7-10` has no test script; `.github/workflows/ci.yml:35` runs only Vitest.

Why it matters: the feature arc's migration counts, torso-mask rules, and full-replacement rejection laws can regress while both `pnpm test` and CI remain green.

Fix: add root script `"test:artkit": "node --test tools/artkit/lib/gear-replacement-contract.test.mjs"`, invoke it from `test` after Vitest, and add the same command immediately after `.github/workflows/ci.yml:35`; this test uses built-ins plus tracked Artkit modules, so do not pull Artkit into the pnpm workspace merely to gate it.

### P1.2 — “Cleared POI” spatial fixtures retain the generated collision index, and clearing is applied inconsistently

Evidence: tests clear only `map.pois.length` at `packages/server/src/rooms/GameRoom.test.ts:814`, `:844`, `:2489`, and `:2848`, but `ArenaMap` stores a separate immutable `poiCollisionIndex` at `packages/shared/src/mapgen.ts:97-100` and all exact POI queries read that index at `packages/shared/src/mapgen.ts:790-792`; other pinned tests clear only tiles (`GameRoom.test.ts:2519`, `:4565`) while the correct intent is stated and both surfaces are cleared at `GameRoom.test.ts:3069-3074` and `:3351-3357`.

Why it matters: a pinned projectile, melee, beam, or extraction test can still collide with seed-dependent landmark geometry even though the fixture claims landmarks are gone, producing the same parallel/isolated RNG flake class documented at `GameRoom.test.ts:810-815`.

Fix: add one shared server-test helper, e.g. `flattenArena(h)`, that fills `tiles` with `TILE_GROUND`, empties `pois` and `poiClusters`, and replaces `poiCollisionIndex` with `new PoiCollisionIndex([], width, height)`; call it from every helper/test that pins positions (`makeBeamRoom`, spin re-hit, melee telegraph, jump/slide, ultimate, extraction, dual-wield receipt), and ban direct `map.pois.length = 0` / `map.tiles.fill(...)` outside map-specific tests.

### P1.3 — Retired upgrade/ammo/reload behavior is mixed with the compatibility laws that should replace it

Evidence: `packages/server/src/rooms/GameRoom.test.ts:1843-1897` still requires the old persisted upgrade shop and `buyUpgrade`, while `packages/server/src/rooms/progression.test.ts:510-539` requires migration to visible gear with no stored `upgrades`; `packages/client/src/ui/loadout-entry-view.test.ts:4-37` requires non-zero per-weapon `charges/maxCharges`, while Drive-era server tests require the legacy runtime fields to remain zero at `GameRoom.test.ts:2160-2165` and `:5672-5682`; `progression.test.ts:250-255` even pins an inert class-era hook returning `reload-held-gun`.

Why it matters: tests are now an ownership claim on mutually contradictory systems, so a cleanup bot cannot remove the retired shop, ammo mirrors, reload action, or class hook without appearing to break supported behavior.

Fix, in this order: (1) create `packages/server/src/rooms/schema-compat.test.ts` with exactly one V2/V3→V4 gear/bank migration law and one schema-31 zero-tombstone law; (2) remove the `§31 meta upgrades` block only in the same change that deletes the server handler and old client shop; (3) delete `charges/maxCharges/offCharges/offMaxCharges` from `LoadoutEntryView` and its fixtures because Drive is global, then remove the inert `reload-held-gun` hook and assertion; (4) keep authored `thrown.charges` and beam `overheat` inputs because `packages/shared/src/weapon-resource.ts:130-134` still converts them into Drive economics, but move old-curve equivalence assertions (`GameRoom.test.ts:2940-2969`, `:6689-6708`) under one explicitly named Drive-compat describe until that data format is migrated.

### P1.4 — The shipped metagame arc has no end-to-end journeys

Evidence: the only feature specs are beam lifecycle (`e2e/tests/beam-lifecycle.spec.ts:35`), level-up (`e2e/tests/level-up-window.spec.ts:31`), movement jitter (`e2e/tests/movement-jitter.probe.spec.ts:54`), Serraketh (`e2e/tests/serraketh-worm.spec.ts:26`), XP echoes (`e2e/tests/xp-echoes.spec.ts:31`), and the boot smoke; the smoke merely presses Enter past Wardrobe and launches a run (`e2e/tests/black-screen.smoke.spec.ts:60-64`).

Why it matters: localStorage/account serialization, MenuScene UI, Colyseus messages, authoritative runtime state, and presentation are never exercised together for extraction/settlement, wardrobe, dual-wield, or ultimates.

Fix: add four deterministic Playwright journeys using the existing dev seam: `metagame-extraction-settlement.spec.ts` (seed carry + found weapon, hold the gate, assert settlement counts and persisted stash), `wardrobe-persistence.spec.ts` (equip a mixed/replacement set, reload, launch, assert local and remote rig cosmetics), `dual-wield.spec.ts` (bind an eligible pair, observe alternating/both beats and one Drive debit per accepted hand), and `ultimate.spec.ts` (force five allocations/charge, cast, assert HUD ready edge plus authoritative effect); prefer one representative happy path plus one persistence assertion per file rather than copying the full Vitest law tables.

## P2

### P2.1 — Panel-named append-only files duplicate general combo laws and test source spelling instead of module behavior

Evidence: the timing law in `tests/bigsword-combos-panel.test.ts:103-118` is copied “verbatim” at `tests/driftblade-model-panel.test.ts:75-96`; the unit-strength path law is repeated at `bigsword-combos-panel.test.ts:103-119` and `driftblade-model-panel.test.ts:120-130`; accepted-chain sequencing is asserted in both `driftblade-model-panel.test.ts:287-311` and `tests/rig-correctness-panel.test.ts:11-118`; source-string checks bind tests to private names/ordering at `bigsword-combos-panel.test.ts:180-197`, `driftblade-model-panel.test.ts:314-351`, and `rig-correctness-panel.test.ts:120-137`.

Why it matters: one law has several editors and harmless refactors of private methods can fail tests without changing behavior, while a behavior regression can pass if the expected text remains present but unused.

Fix: delete the four `*-panel.test.ts` files after moving their unique laws according to this map: `bigsword-combos-panel`, `dagger-anim-panel`, the data half of `driftblade-model-panel`, and `comboStepForChain` cases from `rig-correctness-panel` → `tests/melee-combos.test.ts`; expose one `assertComboSequenceLaw(sequence)` table test for freeze/timing/path/ribbon bounds; close-blade sampler laws → existing `packages/client/src/entities/close-blade-pose.test.ts`; SpriteRig clock/attack plumbing → new `packages/client/src/entities/SpriteRig.attack.test.ts` through exported pure seams; painted-edge ribbon consumption → `packages/client/src/vfx/vfx-render.test.ts` through a callable renderer seam. Keep the roster snapshots and adopter-specific M1–M8 differences; remove only duplicate generic assertions and all `readFileSync(...source)` private-spelling checks.

### P2.2 — Mapgen owns almost the entire suite runtime because the same 200 maps are regenerated and re-audited in separate tests

Evidence: `tests/mapgen.test.ts:34-36` creates one 200-seed corpus, but separate loops regenerate it for validation/spawn/pit laws at `:54-76` and again for five natural-zone laws at `:350-443`; a full run measured `mapgen.test.ts` at 20.686s (including 8.025s connected zones, 3.049s validation, and 2.965s gate placement), versus 28.25s total test CPU time.

Why it matters: mapgen alone consumes about 73% of measured test CPU time and makes fast feedback depend on repeatedly proving the same generation precondition.

Fix: split `mapgen.unit.test.ts` (helpers/goldens) from `mapgen.property.test.ts`; in the property file build `const corpus = SAMPLES.map(generateArena)` once in `beforeAll`, run all non-mutating per-map laws in one audit function that returns a seed-qualified failure reason, and generate fresh maps only for determinism and mutating gate tests; preserve the 200/120/32 sample sizes and every invariant, but stop regenerating the 200-map corpus for each assertion family.

### P2.3 — The two largest server files are append logs rather than module-owned suites

Evidence: `packages/server/src/rooms/GameRoom.test.ts:49-96` defines one global private-access harness and then accumulates feature waves through dual-wield (`:5494`), banking (`:6046`), Drive (`:6348`), and stale expedition handling (`:6735`) until line 6,782; `packages/server/src/rooms/progression.test.ts:258`, `:313`, and `:600` similarly append ultimates, pets/gear, and banking through line 963.

Why it matters: unrelated feature work shares giant import/mock/helper scope, review diffs have no stable owner, and a helper mutation can silently affect hundreds of laws.

Fix: first extract `packages/server/src/rooms/test-support/game-room-harness.ts` containing `makeRoom`, `flattenArena`, join/message helpers, and typed fixture builders; then mechanically move whole describe blocks—without rewriting assertions—into `GameRoom.lifecycle.test.ts`, `.combat.test.ts`, `.movement.test.ts`, `.bosses.test.ts`, `.progression.test.ts`, `.pets-gear.test.ts`, `.bank-settlement.test.ts`, `.dual-wield-drive.test.ts`, and `.schema-compat.test.ts`. Split `progression.test.ts` into `progression.run.test.ts` (lines 31-311), `meta-account.test.ts` (current pet/gear/migrations), and `weapon-bank.test.ts` (current B1-B3). Target no test file over roughly 1,000 lines and no feature-wave comments as ownership markers.

### P2.4 — Test-support code is copied across client, server, and e2e suites

Evidence: `FakeDisplayObject`/`FakeContainer` are separately implemented in `packages/client/src/entities/SpriteRig.boilerplate.test.ts:35-158` and `packages/client/src/ui/wardrobe/preview.test.ts:91-194`; `replacementManifest` is copied in five tests (`gear-texture-baker.test.ts:27`, `gear-parts.test.ts:332`, `SpriteRig.boilerplate.test.ts:488`, `remote-gear.test.ts:42`, `wardrobe/preview.test.ts:34`); `e2e/helpers/real-stack.ts:38-152` and `e2e/helpers/spec-stack.ts:39-154` duplicate timeout, error, Vite, server, and teardown logic, differing mainly in Vite options.

Why it matters: fixture drift creates false differences between runtime and wardrobe tests, and every stack lifecycle fix must be made twice.

Fix: add `packages/client/src/test-support/paper-rig-fakes.ts` for the display/container/scene fake and `gear-fixtures.ts` for `replacementManifest`; make one `e2e/helpers/stack.ts` accepting `{ reloadProof: boolean, label: string }`, keep `startRealStack`/`startSpecStack` as thin option wrappers, and share the generic timeout helper with `packages/server/src/integration.test.ts:36`. When the GameRoom suite is split, import the single harness rather than recreating `makeRoom` or the Colyseus stub; adapt the inline BossController room stub at `packages/server/src/rooms/BossController.test.ts:425-449` to the same test-support module.

### P2.5 — E2E port collisions are converted into skips, allowing a false-green run

Evidence: `e2e/helpers/spec-stack.ts:81-94` binds `DEFAULT_PORT` and returns `status: "skipped"` on `EADDRINUSE`; `e2e/helpers/arena-harness.ts:83-86` converts that result to `test.skip`, and `e2e/playwright.config.ts:5-7` runs the suite serially in one worker.

Why it matters: `pnpm e2e` can finish successfully with every feature spec skipped whenever another server owns the fixed port—the exact local condition under which developers most need reliable feedback.

Fix: teach ArenaScene's test boot URL to accept an injected WebSocket endpoint, start Colyseus on port `0` as `packages/server/src/integration.test.ts:95-100` already does, and remove the `SkippedStack` branch; until endpoint injection lands, treat `EADDRINUSE` as a hard failure in CI and print a final skipped-count failure locally instead of silently passing.

## P3

### P3.1 — Passing runs bury signal in room logs and unhandled new-protocol warnings

Evidence: the real transport test covers only matchmaking/schema/input/removal at `packages/server/src/integration.test.ts:123-199` and registers no handlers for the new `weaponManifest` or `metaAccount` messages; the audit run emitted four `onMessage() not registered` warnings, while the GameRoom harness at `GameRoom.test.ts:49-96` leaves production join/boss/outcome logging enabled and produced most of a 1,094-line run.

Why it matters: expected noise makes it difficult to notice a novel warning and the only real-transport test currently ignores the feature arc's owner-private messages.

Fix: install explicit transport handlers/assertions for `weaponManifest` and `metaAccount` in a dedicated integration case, fail on any other warning, and silence expected GameRoom `console.log` calls in harness setup with a restored Vitest spy; do not blanket-suppress `console.warn` or `console.error`.

## Law-preserving reorganization sequence

1. Gate the Artkit `node:test` contract and add `flattenArena`; these are independent, low-diff safety fixes.
2. Extract test-support modules without moving assertions, then run all 1,218 Vitest tests after each mechanical extraction.
3. Move panel laws to their production-module owners and replace source-text assertions with exported pure behavior seams; delete each panel file only after its unique roster/variant laws appear in the destination.
4. Split GameRoom/progression by whole describe blocks, then collapse only the explicitly identified duplicate combo and retired-system assertions.
5. Add the four browser journeys, unify the stack harness, and make port collision a failure; keep Playwright journeys coarse while Vitest remains the exhaustive law layer.

## Executive summary

1. Vitest is green at 66 files / 1,218 tests, but the replacement-bake `node:test` contract is outside every root gate.
2. Pinned spatial fixtures are not actually deterministic because clearing `pois` leaves `poiCollisionIndex` intact and many tests clear only half the map state.
3. Prune the old upgrade shop, runtime ammo/reload mirrors, and inert class reload hook; retain only explicit migration/tombstone and Drive-conversion contracts.
4. Consolidate four panel files, copied fakes/manifests, duplicate e2e stacks, and the 6,782-line GameRoom append log around module-owned harnesses.
5. Cache the map corpus and add extraction/settlement, wardrobe, dual-wield, and ultimate browser journeys before treating the metagame arc as end-to-end covered.
