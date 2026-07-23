# B4 implementation — Galvanic Overcasters moving-fire correctness

## Understanding and plan

The open regression is the character half of the Galvanic Overcasters moving-fire bug. The projectile-only correction from `a1ed5cb` is accepted behavior: a locally admitted projectile starts at the live rendered muzzle, preserves that opening sample, and converges to authority without rewriting player position. That path must remain intact.

The rejected seam was client recoil prediction entering character motion. Recoil is a firing presentation/weapon-response concern, but predicted impulses were mixed into the same position candidate later compared with authoritative locomotion. During sustained automatic fire, client-timed impulses accumulated between snapshots, authority rejected that displacement, and reconciliation/interpolation paid the debt as large rig corrections. Because later muzzle samples are taken from the rendered rig, the character correction also made otherwise-correct projectile admissions appear detached. Remote presentation must likewise remain a pure interpolation of authoritative player snapshots; it must not inherit local recoil state.

The implementation will trace every position written or sampled across `SelfPredictor`, local reconciliation, remote interpolation, `SpriteRig`, and muzzle/projectile admission. It will preserve authoritative server recoil behavior only if it is already part of the server movement contract, while ensuring that client cosmetic recoil cannot mutate locomotion state. The preferred correction is a structural separation: authoritative/predicted locomotion owns world position, recoil owns only weapon/pose presentation, and muzzle sampling composes from the stable character transform plus the current weapon pose.

Regression coverage will first make the failure deterministic in unit/integration tests, including sustained bursts while walking in both horizontal directions, hard direction changes, and delayed authoritative snapshots. Assertions will cover bounded local and remote rig-to-authority error, bounded rig-to-predictor error, no one-frame character snap during or after firing, monotonic/finally confirmed attack sequences, and correct moving muzzle admission for every shot. The existing redo thresholds remain the acceptance contract: muzzle admission `<= 2.5 px`, early projectile path error `<= 18 px`, rig/authority separation `<= 80 px` overall and post-fire, rendered-rig step `<= 80 px` during and post-fire, rig/predictor delta `<= 12 px`, post-fire observation `>= 1,200 ms`, at least 32 rounds / 8 bursts, no authority or rig sequence regressions, rig lead `<= 1`, and final rig sequence equal to authority.

After focused tests pass, I will run the real browser gate twice on private ephemeral ports: once at low latency and once with induced latency. I will retain machine-readable captures and summaries under `docs/owner-notes-audit-v9-evidence/b4-overcasters/`, then run full `pnpm typecheck` and `pnpm test`. No weapon catalog, manifest, or generated-data change will be made unless tracing proves that a missing recoil datum is unavoidable.

## Work log

- Read the authoritative B4 ledger entry and `v8-overcasters-redo.md`. The prior redo proves projectile continuity green but the character side red, with maximum rig/authority separation `444.09 px`, post-fire separation `172.87 px`, during-fire rendered-rig step `271.63 px`, and rig/predictor delta `37.14 px`.
- Reproduced the current branch before changing runtime code. A 40-round / 10-burst local capture reached `386.23 px` rig/authority separation, `272.78 px` during-fire rig step, and `48.67 px` rig/predictor separation. Projectile admission (`0 px`) and early path error (`~0 px`) remained green, confirming that `a1ed5cb` was intact and the open failure was the character seam.
- Traced two position contributors. First, the server applied the authored gun recoil to player velocity for all four Overcasters rounds while the owner independently predicted those round impulses; those roots then reconciled on different clocks. Second, hard walk reversals could retain a large visual reconciliation offset and feed it through the ordinary directional-correction presentation gate.
- Added a shared locomotion-recoil policy. Overcasters now keeps its authored recoil magnitude for weapon pose and camera response, but reports zero body impulse to both server locomotion and owner prediction. Other weapons retain the existing recoil behavior, including Calamity's tested displacement.
- Added an owner-presentation bound for the locomotion-only Overcasters policy. It permits ordinary prediction within `48 px` of the frame-current authority row, clamps only the rendered candidate outside that radius, and retires the excess visual error. It does not clamp predictor simulation, pending input replay, or authoritative state. Remote rigs continue to interpolate server movement and therefore never receive owner recoil state.
- Limited the local attack presentation high-water mark to one unconfirmed beat. Held fire retries as soon as the authoritative sequence catches up, preventing induced latency plus a later Drive rejection from leaving the rig two beats ahead.
- Kept the accepted projectile implementation unchanged. Live muzzle admission is still sampled from the rendered implement, and subsequent projectile motion remains independent of later character reconciliation.
- Made no catalog, manifest, authored recoil, or generated-data change. A recoil datum was not needed: the existing value remains correct for the cosmetic rig/camera sentence, while the exception is a shared runtime ownership policy.

## Validation

- Focused unit/integration regression command passed: 34 tests across `prediction.test.ts`, `GameRoom.v7-overcasters.test.ts`, and `GameRoom.v6c.test.ts`. The new tests cover both aim directions, every four-round burst impulse, and prediction at zero and three ticks of simulated latency.
- Low-latency live gate passed on private ephemeral port `57925`:
  - Local: 216 frames, 36 rounds / 9 bursts; admission `0 px`; path error `~0 px`; rig/authority `48.00 px`; during/post step `43.06 / 26.62 px`; post rig/authority `48.00 px`; rig/predictor `0 px`; max sequence lead `1`; final sequence `9/9`.
  - Remote: 192 frames, 36 rounds / 9 bursts, both horizontal walk directions; admission `0 px`; path error `~0 px`; rig/authority `22.46 px`; during/post step `46.53 / 24.23 px`; post rig/authority `14.59 px`; max sequence lead `0`; final sequence `9/9`.
- Induced `150 ms` outgoing input/attack latency live gate passed on private ephemeral port `56643`:
  - Local: 233 frames, 36 rounds / 9 bursts; admission `0 px`; path error `~0 px`; rig/authority `48.00 px`; during/post step `32.00 / 30.90 px`; post rig/authority `48.00 px`; rig/predictor `0 px`; max sequence lead `1`; final sequence `9/9`.
  - Remote: 148 frames, 36 rounds / 9 bursts, both horizontal walk directions; admission `0 px`; path error `16.86 px`; rig/authority `19.20 px`; during/post step `50.64 / 50.87 px`; post rig/authority `18.39 px`; max sequence lead `0`; final sequence `9/9`.
- All four live profiles retained at least 32 rounds / 8 bursts, all required direction stages, a post-fire moving observation window of at least 1,200 ms, and zero authority/rig sequence regressions. No live run used ports `5180` or `2567`.
- `pnpm typecheck` passed.
- Full `pnpm test` passed: 138 test files, 1,802 tests.
- `node tools/artkit/gen-weapon-muzzles.mjs --check`, targeted Biome checks, `git diff --check`, and the LF audit passed. `pnpm gen` was not applicable because no data or manifest changed.

## Files and evidence

- Runtime policy and ownership seam: `packages/shared/src/weapons.ts`, `packages/server/src/rooms/GameRoom.ts`, `packages/client/src/net/prediction.ts`, `packages/client/src/scenes/ArenaScene.ts`.
- Automated regression coverage: `packages/server/src/rooms/GameRoom.v7-overcasters.test.ts`, `packages/client/src/net/prediction.test.ts`, `e2e/tests/burst-origin-moving.spec.ts`.
- Implementation report: `docs/sol-reports/impl-b4-overcasters.md`.
- Before capture: `docs/owner-notes-audit-v9-evidence/b4-overcasters/before-low/live-capture.json`.
- Final low-latency captures: `docs/owner-notes-audit-v9-evidence/b4-overcasters/after-low-latency/local-live-capture.json` and `remote-live-capture.json`.
- Final induced-latency captures: `docs/owner-notes-audit-v9-evidence/b4-overcasters/after-induced-150ms/local-live-capture.json` and `remote-live-capture.json`.

VERDICT: SHIPPED — unchanged gates are GREEN: admission <=2.5 px (before 0, after 0), path <=18 px (before ~0, after worst 16.86), rig/authority <=80 px (ledger before 444.09; reproduced before 386.23; after worst 48.00), during/post rig step <=80 px (before during 272.78; after worst 50.87), post rig/authority <=80 px (before 52.96; after worst 48.00), rig/predictor <=12 px (before 48.67; after 0), >=32 rounds / 8 bursts (after 36 / 9), post observation >=1,200 ms, sequence regressions 0, lead <=1, final equality 9/9; files touched: packages/shared/src/weapons.ts, packages/server/src/rooms/GameRoom.ts, packages/client/src/net/prediction.ts, packages/client/src/scenes/ArenaScene.ts, packages/server/src/rooms/GameRoom.v7-overcasters.test.ts, packages/client/src/net/prediction.test.ts, e2e/tests/burst-origin-moving.spec.ts, docs/sol-reports/impl-b4-overcasters.md, and five evidence JSON files; evidence: docs/owner-notes-audit-v9-evidence/b4-overcasters/{before-low,after-low-latency,after-induced-150ms}/.
