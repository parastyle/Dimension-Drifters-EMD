# QA / Test Structure + Soundness Audit

## Audit understanding

This is a read-only audit of Dimension Drifters' testing posture and QA process. The review will trace the highest-risk runtime paths—especially client character rendering, netcode reconciliation, input, VFX, and boss phases—against actual behavioral coverage; quantify source-grep/string-contains tests (particularly those coupled to `ArenaScene`); assess census guards, flake risks, live-gate E2E coverage, line-ending consistency, and CI soundness. Findings will distinguish tests that execute behavior from tests that merely prove source text exists, and every material conclusion will cite `file:line`.

The known character-render regression is the calibration case: whole-art `proto-*` characters silently fell back to the boilerplate base model without a test failure. The audit will look for structurally similar gaps where routing, asset selection, lifecycle wiring, ordering, or real-time interaction is only implied by source or mocked too far from the runtime boundary.

## Working plan

1. Inventory test suites, E2E live gates, census checks, and CI jobs.
2. Quantify brittle source-grep assertions and identify the behavioral contracts they should cover.
3. Map critical runtime paths to tests and rank untested or weakly tested paths by player-facing risk.
4. Identify known and likely flake patterns, including RNG, shared state, ordering, timers, and isolated-versus-full-suite differences.
5. Evaluate exact-count guards and local-versus-CI line-ending behavior.
6. Produce a prioritized QA hardening plan covering tests to add, strengthen, convert, prune, and process/tooling fixes.

## Executive assessment

The repository has broad logic coverage but weak protection at the boundaries where the shipped game is assembled. The 1,790-test Vitest suite is strongest on pure shared/server rules and weakest on Phaser scene wiring, real input, Colyseus reconciliation, retained VFX lifecycle, and complete boss encounters. That mismatch explains how a character-selection bug could survive: the pieces were tested, but the runtime decision that selected the pieces was not.

This audit's local full Vitest run found 137 files and 1,790 tests. It finished with 1 failure and 1,789 passes; the failed guaranteed-flight retargeting test passed immediately when run alone. The suite is therefore not currently order/run-context clean. The browser side contains 33 Playwright spec files, but they are serial, Chromium-only, globally retried once in CI, and mostly lack image assertions. The census and generated-artifact gates are useful, but several tests confuse exact inventory totals or source spelling with behavior.

Risk rating:

| Area | Current protection | Residual risk |
|---|---|---|
| Shared combat, movement, map, and server boss rules | Broad behavioral Vitest coverage | Medium |
| Character presentation selection and rebuild | Three `proto-*` browser cases; almost no scene-level unit behavior | Critical |
| Client reconciliation wiring and reconnect | Good pure predictor/snapshot tests; scene/transport seam untested | Critical |
| Physical input-to-network routing | Good pure routing tests and strong movement keyboard gate; attack/modal/focus paths bypassed | High |
| Hit registration as experienced by a player | Server rules covered; no end-to-end input → authoritative hit → client feedback gate | Critical |
| VFX selection, retained lifecycle, and pixels | Catalog/source guards and isolated helpers; no visual comparisons | High |
| Boss phase presentation and combat | Strong server controller tests; one spawn/topology browser gate | High |
| Flake discipline | Some deterministic helpers; confirmed full-vs-isolated failure and ad hoc map cleanup | High |
| CI composition | Broad checks, Windows build, real stack browser run | Medium-high |

## Test posture and coverage gaps by risk

### P0 — presentation selection remains convention-driven

`ArenaScene.addBlob` selects whole-art presentation only when the character ID starts with `proto-`; otherwise it takes the ordinary rig/gear path (`packages/client/src/scenes/ArenaScene.ts:4358-4400`). The state-sync rebuild repeats the same prefix decision independently (`packages/client/src/scenes/ArenaScene.ts:8988-9025`). The current live gate hard-codes only the three prototypes (`e2e/tests/char-proto.spec.ts:7-10`, `e2e/tests/char-proto.spec.ts:94-95`) and checks their identity, six frames, positions, and bob (`e2e/tests/char-proto.spec.ts:223-257`). This catches the known regression for today's three IDs, but it does not make “whole-art” a catalog invariant. A future whole-art character without that prefix can take the boilerplate route silently.

The E2E also destroys and remounts the rig through private `addBlob` to exercise the branch (`e2e/tests/char-proto.spec.ts:115-116`). It does not prove that normal initial join, remote-player join, or a mid-session character change reaches the right rebuild exactly once. `SpriteRig` tests thoroughly exercise boilerplate/gear behavior, which is precisely the wrong side of the decision boundary for this failure class.

Required contract: a catalog-backed presentation resolver must return whole-art versus composed, sprite identity, manifest, and gear policy. Every selectable character must participate in a table test. For whole-art rows, assert `rigSpriteId === character`, body/head frames belong to that manifest, and no default gear is equipped. For composed rows, assert the expected base model and gear. A live test must cover local initial join, remote join, and character swap without calling private mount methods; assert the old rig is destroyed once and both clients see the selected identity.

### P0 — reconciliation is tested as math, not as a client state machine

The pure predictor is explicitly separated from Arena ownership (`packages/client/src/net/prediction.ts:55-75`) and has valuable latency, knockback, recoil, teleport, freeze, stall, preview, stance, roll, input-gate, and correction tests (`packages/client/src/net/prediction.test.ts:127-384`, `packages/client/src/net/prediction.test.ts:449-539`, `packages/client/src/net/prediction.test.ts:613-684`). Snapshot interpolation/extrapolation, ordering, bursts, and reset are likewise covered (`packages/client/src/net/snapshots.test.ts:7-118`).

The high-risk wiring is effectively uncovered. `ArenaScene` creates buffers and predictors and reconciles them from room patches (`packages/client/src/scenes/ArenaScene.ts:15273-15339`), then samples/sends input on a fixed loop (`packages/client/src/scenes/ArenaScene.ts:15368-15462`). Beam prediction adds a second accept/reject/fade state machine (`packages/client/src/scenes/ArenaScene.ts:15489-15557`, `packages/client/src/scenes/ArenaScene.ts:15651-15770`). No Vitest invokes this patch/input/reconciliation seam. The real Colyseus integration test proves matchmaking, initial schema, one input acknowledgement, and leave/rejoin, but not prediction or gameplay reconciliation (`packages/server/src/integration.test.ts:123-199`).

Required contract: a scene-component harness should drive fake Colyseus patches and a controllable clock through the actual wiring. Assert command sequence allocation, acknowledgement pruning, replay order, teleport hard-snap, map/reconnect reset, stale-generation callback rejection, remote-buffer reset after fall/teleport, and beam prediction acceptance/rejection without duplicate rows or lingering visuals. Then add a two-browser impaired-network gate with deterministic latency/reordering: both clients must converge within a stated positional tolerance after movement, knockback, roll, and reconnect.

### P0 — no live hit-registration treaty

Server hit rules have many unit tests, and weapon E2Es inspect muzzle/animation/art, but the critical player treaty is not gated: a physical attack input produces exactly one authoritative hit on the intended target, both clients agree on HP and hit identity, and the predicted audiovisual feedback is reconciled rather than duplicated. Many live weapon specs call private `stepNetInput` or send room messages directly, so they validate downstream systems while bypassing browser/Phaser input sampling.

Add a deterministic two-client hit-registration gate for one melee, one hitscan/beam, and one projectile weapon. Use actual mouse input; put one target and all players on a flat fixture; assert the emitted input edge, server event/sequence, HP delta exactly once, attacker and observer agreement, correct target under overlap, and predicted VFX replacement. Repeat with controlled latency, one dropped client packet, and a miss beside the target. This should be a merge-blocking “critical live” lane, not an evidence-only probe.

### P1 — input coverage stops short of browser and focus behavior

The pure input treaty is well covered (`packages/client/src/input-routing.ts:21-66`, `packages/client/src/input-routing.ts:118-152`; `packages/client/src/input-routing.test.ts:21-218`). The movement live gate is a strong exception: it uses real key down/up and asserts direction, distance, duration, reconciliation, one-frame Space, jump, and pound (`e2e/tests/v7-move-live-gate.spec.ts:545-952`). The jitter probe also uses actual key events (`e2e/tests/movement-jitter.probe.spec.ts:147-173`).

There is no comparable browser-level coverage for RMB attack, LMB parry/brace, pickup/cycle, modal suppression, blur/focus recovery, or stuck-key release, and no gamepad path. Add one physical-input treaty spec that observes the exact network command edges while opening/closing level-up and menu UI, blurring the page, and pressing/releasing mouse buttons. Assert no attack or movement leaks through a modal, no repeated edge after focus returns, and held keys are cleared on blur.

### P1 — VFX tests do not prove pixels or complete lifecycles

Several VFX helpers are behaviorally tested, including beam rendering, blade extension, jump effects, screen transforms, recipes, and selected character effects. Critical orchestrators such as `fx-composer.ts`, `projectile-factory.ts`, `weapon-effect-vfx.ts`, `caster-vfx.ts`, `ultimate-vfx.ts`, and `worm-boss-vfx.ts` have no same-module behavioral harness. Their protection is often source inspection: the W4G guard scans 37 `particleBurst` call sites and requires a nearby `scaleContract:` token (`tests/w4g-systemic-owner-orders.test.ts:71-88`), while other panels inspect tween syntax and factory source.

Static search found screenshot capture in the browser suite but zero `toHaveScreenshot` assertions. Captured PNGs are evidence artifacts, not regression gates. Add fake-Phaser lifecycle tests for representative retained effects: assert texture/frame, origin, depth, scale, timeline updates, late-asset fallback, reduced-motion behavior, and complete destruction of sprites/tweens/timers. Add a deliberately small visual matrix—whole-art/composed characters, one melee trail, one projectile/impact, one beam, and one boss telegraph—with stable pixel or alpha-mask comparison. Do not snapshot the entire weapon catalog.

### P1 — boss logic is covered; phase experience is not

Shared/server coverage is substantive: phase thresholds and bullet walls (`tests/boss.test.ts:4-65`), primitive planning and telegraph/AOE co-location (`tests/boss-primitives.test.ts:41-227`), and controller selection, windup, budgets, hazards, melee, blink, determinism, Serraketh, and Vastaghar (`packages/server/src/rooms/BossController.test.ts:111-341`, `packages/server/src/rooms/BossController.test.ts:526-604`, `packages/server/src/rooms/BossController.test.ts:711-812`).

The only boss browser gate proves Serraketh activation, segment topology, and boss-bar appearance (`e2e/tests/serraketh-worm.spec.ts:26-144`). It never crosses a phase threshold or asserts telegraph → resolve timing, damage/dodge/parry, death cleanup, or bar/VFX teardown. The client pose/telegraph application seam starts at `packages/client/src/scenes/ArenaScene.ts:5366` and has no direct behavior test.

Add a deterministic flagship boss gate with a development seam for HP/phase setup. Assert authoritative phase and sequence increment, matching client geometry during telegraph, no early damage, resolve damage at the stated time, successful dodge/parry immunity where allowed, observer agreement, and cleanup of hazards, VFX, boss bar, and controller state on death. Exercise one conventional boss and the worm topology.

## Test quality: behavioral coverage versus source grep

The main quantitative smell is concentrated and actionable:

- Six test files read or enumerate `ArenaScene.ts` as text.
- They contain 10 test cases whose Arena assertions are source-text assertions.
- Only one Vitest test invokes an `ArenaScene` method: the dual-wield test constructs an object from the prototype and calls `equipWeapons` (`packages/client/src/scenes/ArenaScene.dualwield.test.ts:104-151`).
- Five additional `ArenaScene.training` cases exercise only the exported numeric `summonMenuLayout` helper; the file expressly avoids render-module behavior (`packages/client/src/scenes/ArenaScene.training.test.ts:4-5`, `packages/client/src/scenes/ArenaScene.training.test.ts:66-129`).

The 10 source-text cases are:

| File | Arena source cases | What they claim |
|---|---:|---|
| `tests/flourish-implementation-panel.test.ts` | 5 | equip convergence, lazy-art ordering, raw input capture, desired-axis forwarding, cancellation ordering (`:57-73`, `:99-167`) |
| `tests/driftblade-model-panel.test.ts` | 1 | active swing fallback token (`:354-374`) |
| `tests/owner-notes-nr-redo.test.ts` | 1 | Tesla warp departure/arrival calls (`:107-126`) |
| `tests/w4g-systemic-owner-orders.test.ts` | 1 | nearby `scaleContract:` for every burst call (`:71-88`) |
| `packages/client/src/ui/remote-gear.test.ts` | 1 | dual-wield field names and absence of top-level gear access (`:39-73`) |
| `packages/client/src/camera-shake.test.ts` | 1 | exact list of source files containing shake calls (`:11-32`) |

These checks are brittle in different ways. The clearest CRLF failure is an exact multiline `toContain` with a literal LF and indentation (`tests/flourish-implementation-panel.test.ts:145-147`). The W4G check depends on a 900-character proximity window and the current exact total of 37 calls. The camera-shake test treats a source-file census as proof of feedback. The remote-gear and warp checks prove field/call spelling, not what a remote player sees. All can pass when arguments, timing, lifecycle, or runtime branching are wrong; all can fail after harmless extraction, formatting, renaming, or line-ending conversion.

Conversion order:

1. Convert all five Arena flourish cases first. Instantiate the rig/input owner with fake clock and pointer state; assert that attack/parry/move cancels the flourish on the same frame, lazy art does not restart the outgoing draw, and weapon equip completes once with the selected manifest.
2. Convert remote gear next. Apply actual remote-player state for single and dual wield, then inspect equipped sprite IDs and ensure stale primary gear is removed.
3. Convert Tesla warp and driftblade swing. Feed the state transition and assert emitted VFX events/positions and chosen active-swing pose rather than source tokens.
4. Replace the burst-proximity and camera-shake file censuses with typed APIs. A burst factory can require `scaleContract` structurally; a fake camera can assert intensity/duration/call count for representative attacks.

Source-based architecture checks should be rare and limited to properties that cannot reasonably be observed at runtime, such as a forbidden dependency edge. If retained, parse an AST and assert symbols/structure; never assert whitespace, raw newlines, character windows, or an exact source-file list.

## Census and expectation guards

The current census posture mixes valuable completeness laws with churn magnets.

The worst example is not merely a test: `weapon-resource.ts` throws at import time unless the catalog is exactly 343 total, 334 active, and 9 archived (`packages/shared/src/weapon-resource.ts:308-321`). The same totals are duplicated across archive and weapon panels (`tests/w4a-weapon-archive.test.ts:41-47`, `tests/v61-brutalist-greatswords.test.ts:35-41`, `tests/weapon-resource.test.ts:21-40`). A valid catalog addition can therefore break application startup until several unrelated constants are edited.

The routing census is a second form of duplication. `tests/driftblade-model-panel.test.ts` carries a large hand-authored classification table and pins `arc/default` at 121 (`tests/driftblade-model-panel.test.ts:179-306`). The recent 120 → 121 merge fix is an expected consequence: the default bucket changes whenever another item is added, whether or not the routing behavior regressed.

Other examples include:

- Exact caster totals and beam totals alongside otherwise useful recipe completeness checks (`tests/caster-vfx-recipes.test.ts:13-37`, `tests/caster-vfx-recipes.test.ts:79-81`).
- Inferred lever/pump/pistol totals whose candidates are derived from the same catalog naming/tag rules (`tests/v3g-gun-handling.test.ts:11-76`).
- Curated finite baselines such as bolt-action IDs and katana adopters (`tests/v8-bolt-action.test.ts:19-40`, `tests/v7-katana-drift-model.test.ts:119-130`); these are defensible only when the roster itself is a reviewed product contract.

Keep guards that assert relationships: every active weapon has exactly one route/profile/asset, no archived ID is active, keys are a bijection, no orphan recipe exists, and explicitly exceptional IDs match a small reviewed set. Remove global raw totals and default-bucket totals. If a count is a product promise or protocol limit, give it one source-owned manifest/version and have consumers derive from it. Counts used only as progress telemetry belong in generated reports, not import-time throws or merge blockers.

## Flakiness and fixture discipline

### Confirmed full-versus-isolated failure

The full Vitest run failed `retargets a guaranteed flight when its collector disconnects without losing or duplicating value` at `packages/server/src/rooms/GameRoom.test.ts:2713-2737`: it expected the echo to retarget player 1 but selected player 2. The exact test passed alone. This is direct evidence that the suite is sensitive to full-run RNG/state or to an incompletely controlled spatial fixture.

The test positions players relative to generated map state but does not flatten that state. Across the room tests, many cases clear `map.pois.length` directly (`packages/server/src/rooms/GameRoom.test.ts:846`, `packages/server/src/rooms/GameRoom.test.ts:2374`, `packages/server/src/rooms/GameRoom.test.ts:7032`). That does not rebuild the immutable collision index created from the original POI array (`packages/shared/src/mapgen.ts:1238-1250`) and queried later (`packages/shared/src/mapgen.ts:791-792`). Tests can therefore believe POIs are gone while collision still sees them.

The historical explosive-gun flake documents the same fixture class: randomized dummy spawn, line-blocking POIs, and pits under pinned coordinates combined to change the expected hit (`docs/NIGHT_REPORT_2026-07-16.md:33-35`). Current probabilistic cases remain, including an augment test that samples `Math.random` 400 times and asserts it observed the entire pool (`tests/augments.test.ts:96-100`). Even with low miss probability, coverage by chance is not a contract.

### E2E masking and timing risk

Playwright retries every CI failure once (`e2e/playwright.config.ts:9-15`). The movement-jitter probe adds an explicit retry because host scheduling can perturb the measurement (`e2e/tests/movement-jitter.probe.spec.ts:54-56`). A passing retry is reported as a successful workflow, so a real intermittent regression can be normalized as noise. Long sleeps and FPS/timing thresholds are additionally exposed to shared-runner load; retained traces are not uploaded by the workflow.

### Required fixture discipline

Create and mandate a single deterministic arena fixture for spatial server tests:

- Fill collision tiles with known ground; clear pits, POIs, and clusters; rebuild `poiCollisionIndex`.
- Place players, enemies, drops, and projectiles at fixture-owned coordinates.
- Disable unrelated directors/spawns and advance a fake clock explicitly.
- Inject a seeded RNG per room/test; forbid direct `Math.random` in tests that assert membership, routing, targets, drops, or damage.
- Restore mocks, timers, globals, and rooms in `afterEach`; assert no pending timer/socket remains.
- Prefer event/condition polling to wall-clock sleeps in E2E.
- Run a randomized-order/repeat lane in CI or nightly, but keep merge-blocking tests deterministic. Treat a retry-success as flaky and fail or quarantine it with an owner and expiry.

The test-janitor reports are not a reliable green signal. One report says no flakes while its own two runs contain 4 and 3 failures (`docs/janitor/2026-07-22T17-39-24-117Z.md:8-14`), and the latest run was deferred because the repository was not quiet (`docs/janitor/latest.md:3-10`). The janitor should distinguish stable failures, flaky failures, and infrastructure deferrals, and it should never summarize “no flakes” as suite health when neither run is green.

## Environmental parity: LF in Git, CRLF/mixed in the Windows worktree

There is no root `.gitattributes` or `.editorconfig`, and Biome's formatter configuration does not state a line ending (`biome.json:22-26`). At audit time, `git ls-files --eol` reported 128 tracked files with CRLF worktree content and 32 mixed, even though the TypeScript examples inspected are stored as LF in the index. This includes production, test, E2E, configuration, and generated-adjacent files. That is enough to make raw-source tests platform-dependent and to make `pnpm lint` disagree between a Windows checkout and Ubuntu CI.

The discrepancy is reproduced locally: `pnpm lint` failed after checking 560 files, reporting 342 errors, 792 warnings, and 62 infos. CRLF formatting was a major contributor, but not the only one: the repo-wide `biome check .` command (`package.json:24-25`) also traverses committed evidence/data that violates formatting or the 1 MiB file limit despite the existing exclusions (`biome.json:8-20`). Therefore “CI is green” and “the documented local command is red” are currently compatible states, which makes the gate untrustworthy to contributors.

Durable fix:

1. Add root `.gitattributes` with `* text=auto eol=lf`; explicitly mark binary art/audio/font/archive formats `-text`; preserve CRLF only for files that require it, such as `*.bat text eol=crlf`.
2. Perform one reviewed `git add --renormalize .` migration. Do not mix semantic edits into that commit.
3. Set Biome's line ending explicitly to LF and narrow its include set to first-party source/configuration. Exclude generated/evidence payloads by policy or lint them with a purpose-built validator.
4. Add a CI checkout-normalization guard (for example, reject tracked CRLF/mixed text) and document Windows Git settings (`core.autocrlf=false` or `input`) so checkout does not reverse the contract.
5. Remove newline-sensitive source tests regardless. Normalized line endings solve parity; they do not turn string matching into behavioral testing.

## E2E “live gate” assessment

The stack itself is now credible. Global setup starts production Colyseus on an ephemeral port and a source-serving Vite process (`e2e/helpers/spec-stack.ts:111-155`), and startup errors fail rather than silently skip (`e2e/helpers/global-stack.ts:7-19`). Tests share that stack but get fresh pages/contexts.

What is meaningfully live-gated today:

- Boot/menu/training and selected UI flows.
- Keyboard movement feel, roll/jump/pound, reconciliation, and a jitter probe.
- Three `proto-*` characters and ordinary drifter presentation.
- Beam lifecycle/anchors/structure and a broad set of weapon muzzle/animation/art probes.
- XP echoes, level-up, Serraketh spawn/topology, and a performance/frame probe.

What is not live-gated, or is commonly bypassed:

- Catalog-complete character presentation through normal join/swap paths.
- Physical mouse attack/parry through hit registration and observer feedback.
- Reconciliation under latency, loss, reordering, and reconnect.
- Focus loss, modal input suppression, and gamepad.
- Boss phase transitions and a full telegraph/dodge/hit/death lifecycle.
- Extraction, settlement, wardrobe persistence, dual-wield persistence, and ultimate/metagame journeys.
- Stable pixels for characters, attacks, VFX, or boss telegraphs; static search found no Playwright screenshot comparison.

Character render, movement feel, and hit registration should all be live-gated, but with different shapes. Movement already has the best gate and should remain a short deterministic critical spec. Character render should be catalog-derived and exercise normal state flow, with a small visual comparison. Hit registration should become the next highest-priority gate because it spans physical input, network transport, authority, prediction, and feedback.

Do not make every art probe a merge blocker. Define:

- `e2e:critical`: boot, one character of each presentation type, physical movement, melee/projectile/beam hit registration, reconnect convergence, and one boss phase. No retries; target under two minutes.
- `e2e:catalog`: the larger weapon/character/evidence matrix, sharded in CI with artifacts.
- `e2e:soak`: jitter, performance, repeated reconnect, and randomized-order runs on schedule or pre-release.

## CI pipeline soundness

The workflow has good breadth. Ubuntu runs frozen install, shared build, downstream typechecks, lint, generated-file drift, asset integrity, Vitest, and non-desktop builds (`.github/workflows/ci.yml:24-39`). Windows builds/packages the desktop (`.github/workflows/ci.yml:41-59`). A real-stack Chromium job runs `pnpm e2e` (`.github/workflows/ci.yml:61-80`). These gates catch compile breakage, generator drift, missing manifest assets, much server/shared behavior, packaging errors, and gross browser boot/runtime errors.

It does not yet catch what matters most reliably:

1. **No coverage signal.** Vitest is Node-only and has no coverage collection or risk-based threshold (`vitest.config.ts:7-10`). Test count can grow while Arena wiring remains untouched.
2. **The E2E “smoke” job runs the entire serial suite.** Playwright is one worker, non-parallel, Desktop Chromium only, with 120-second per-test timeout (`e2e/playwright.config.ts:6-29`), yet the CI job has a five-minute cap (`.github/workflows/ci.yml:61-63`). The name, scope, and budget are inconsistent.
3. **Retries conceal intermittent regressions.** CI retry is global (`e2e/playwright.config.ts:15`); no workflow step fails on a flaky retry.
4. **No browser artifacts are uploaded.** Traces are retained in a local output directory (`e2e/playwright.config.ts:16-21`) but the workflow has no upload step, so failed-run diagnostics disappear with the runner.
5. **No visual gate.** Chromium runs are valuable, but none compares rendered output.
6. **A real test file is outside every test command.** The six Node tests in `tools/artkit/lib/gear-replacement-contract.test.mjs` (`:28-213`) do not match Vitest's include patterns and `package.json` has no `node --test` step (`vitest.config.ts:7-10`, `package.json:19-27`).
7. **No line-ending/parity enforcement.** Ubuntu can be green while the Windows checkout's documented lint command is red.
8. **Transport scope is shallow.** The real Colyseus unit integration is one 20-second scenario (`packages/server/src/integration.test.ts:123-199`); there is no impaired-network or reconciliation treaty.
9. **Janitor/flake status is not a required, truthful signal.** Stable failures, flakes, and deferrals are conflated.

Recommended CI shape: keep the current static/generator/asset/build checks; add explicit Node artkit tests and targeted coverage for shared/server/pure client modules; run deterministic critical E2E without retries; shard catalog E2E with uploaded traces/screenshots/logs; move soak/perf to scheduled repeated runs; add a Windows lint/parity check until `.gitattributes` migration is proven. Chromium is appropriate for the merge-critical Phaser lane, while one additional scheduled browser/renderer configuration is sufficient to detect browser-specific WebGL regressions.

## QA hardening plan

### A. Tests to add — highest risk first

1. **P0: catalog-backed character presentation contract.** Table every selectable character through the real presentation resolver. Assert whole-art/composed mode, exact sprite/manifest, gear policy, frame ownership, local/remote parity, and one rebuild on swap. Add a normal-flow browser gate for one of each mode plus roster census-by-bijection, not prefix/count.
2. **P0: end-to-end hit registration treaty.** Actual mouse input for melee, projectile, and beam; flat deterministic map; two clients; exactly one authoritative HP delta and event; observer convergence; predicted feedback replaced rather than duplicated; controlled latency/drop and deliberate miss cases.
3. **P0: Arena reconciliation harness.** Drive real patch/input wiring with fake clock and fake room. Assert seq/ack/replay, teleport, fall, map reset, reconnect generation, remote buffers, beam accept/reject/fade, and zero stale callbacks.
4. **P0: deterministic two-client reconnect/latency gate.** Shape delay/reordering, move/roll/knockback, disconnect/rejoin, then assert convergence tolerance, new session ownership, and no ghost entity.
5. **P1: physical input treaty.** Mouse attack/parry, pickup/cycle, modal open/close, blur/focus, and held-key cleanup. Assert exact network edges and blocked-state silence.
6. **P1: boss phase encounter gate.** Conventional boss plus Serraketh: threshold transition, telegraph geometry/timing, no early hit, dodge/parry behavior, observer agreement, phase sequence, death teardown.
7. **P1: VFX retained-lifecycle tests.** Representative composer/projectile/weapon/caster/ultimate/worm effects with fake Phaser; assert creation, update, fallback, reduced motion, and destruction.
8. **P1: small visual regression matrix.** Whole-art/composed rigs, melee trail, projectile impact, beam, boss telegraph. Compare stable crop/mask or pixel output; keep environment/fonts/renderer pinned.
9. **P2: metagame journey gates.** Extraction → settlement persistence, wardrobe/character persistence, dual wield, and ultimate unlock/use across reconnect.

### B. Tests to strengthen or convert

1. Convert the five Arena flourish source cases (`tests/flourish-implementation-panel.test.ts:57-167`) to fake-clock behavioral tests.
2. Convert remote gear (`packages/client/src/ui/remote-gear.test.ts:39-73`), Tesla warp (`tests/owner-notes-nr-redo.test.ts:107-126`), and active-swing fallback (`tests/driftblade-model-panel.test.ts:354-374`) to state-transition/render assertions.
3. Replace the 37-call VFX proximity census (`tests/w4g-systemic-owner-orders.test.ts:71-88`) with a typed factory requirement and representative runtime assertions.
4. Replace the camera-shake exact-file census (`packages/client/src/camera-shake.test.ts:11-32`) with fake-camera intensity/duration/call-count behavior.
5. Extend the real Colyseus test beyond one acknowledgement (`packages/server/src/integration.test.ts:162-199`) to owner-private messages, rejected/stale sequence handling, disconnect cleanup, and gameplay patches.
6. Make every spatial GameRoom test use the deterministic arena fixture; rewrite the confirmed flight retarget case first (`packages/server/src/rooms/GameRoom.test.ts:2713-2737`).
7. Replace random sampling in augment/loot/drop tests with injected seeded sequences or exhaustive deterministic tables.

### C. Tests and patterns to prune

1. Remove exact global weapon totals from production and duplicate tests (`packages/shared/src/weapon-resource.ts:308-321`; `tests/w4a-weapon-archive.test.ts:41-47`; `tests/v61-brutalist-greatswords.test.ts:35-41`).
2. Remove default-bucket totals such as 121 from the routing census (`tests/driftblade-model-panel.test.ts:179-306`). Keep only explicit exceptional-set equality and per-item completeness.
3. Remove redundant caster/gun category counts when key-set bijection already proves coverage (`tests/caster-vfx-recipes.test.ts:13-37`; `tests/v3g-gun-handling.test.ts:11-76`).
4. Ban raw source `toContain`/regex checks for runtime behavior, whitespace/newlines, character-distance windows, and exact source-file lists.
5. Remove dead skip/fallback E2E plumbing once the mandatory shared stack is the only supported path; global setup already treats a skipped stack as an error (`e2e/helpers/global-stack.ts:11-14`).
6. Stop treating captured evidence screenshots or retry-passes as test assertions.

### D. Process and tooling fixes

1. Land `.gitattributes`, one-time renormalization, explicit Biome LF, scoped lint inputs, and a checkout EOL guard. Verify `pnpm lint` on both Ubuntu and Windows.
2. Introduce the deterministic `flattenArena`/room builder that rebuilds collision indices; seeded RNG and fake clock are mandatory fixture inputs.
3. Split Playwright into critical/catalog/soak lanes. Critical has no retries; catalog is sharded; soak repeats. Upload trace, screenshot, video-on-failure, server log, seed, and room-state snapshot.
4. Make retry-success visible and failing for merge gates. Quarantined flakes require owner, issue, seed/reproduction command, and expiry.
5. Add the artkit `node --test` suite to root/CI, plus a coverage report mapped to risk-owned modules rather than a repository-wide vanity percentage.
6. Add a PR checklist for changes to character catalog, networking, input, VFX, boss controllers, and weapon routing. Each asks for the relevant behavioral contract, not a count bump.
7. Make the janitor machine-truthful: report clean/stable-fail/flaky/infra-deferred separately, save failing seeds/order, and never label a non-green pair of runs healthy.
8. Establish a release live gate that requires character presentation, movement feel, hit registration, reconnect convergence, and one full boss phase on a production build.

## Bottom line

The project does not have a test-volume problem; it has a boundary-coverage and signal-quality problem. Pure rules are often excellent, but too many merge blockers inspect source spelling or catalog totals while the actual Phaser/Colyseus assembly seams remain unexecuted. The immediate priorities are the character presentation contract, live hit registration, scene reconciliation wiring, deterministic spatial fixtures, and LF parity. Converting those boundaries into behavioral gates will prevent another “all tests green, wrong thing rendered” failure far more effectively than adding another panel census.

Verdict: NOT QA-HARDENED — strong core logic coverage, but critical shipped-runtime seams and deterministic CI parity are not yet reliably protected.
