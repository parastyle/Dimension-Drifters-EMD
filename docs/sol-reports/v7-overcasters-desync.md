# V7 Overcasters Desync Sol Report

## Scope

- Branch: `feat/v0.118-metagame`
- Weapon: `x2-galvanic-overcasters`
- Goal: reproduce, root-cause, and fix moving burst projectile origins without disrupting concurrent V7-HIT or V7-GLOVE work.

## Live reproduction

- 2026-07-21: Investigation started. Browser-driven live repro on the existing 5180/2567 stack is the first implementation activity; no gameplay source changes made yet.
- The in-app browser backend exposed no browser instance. Per its supported recovery path, the repository's Playwright live-probe idiom is being used against the already-running stack.
- Added `tools/v7-overcasters-live-probe.mjs` to capture rendered and authoritative character positions, the final rendered weapon muzzle, and recovered authoritative origin for each newly observed Overcasters projectile across at least three held-fire bursts while strafing.
- **Before capture reproduced the bug:** 80 render frames, 12 ordered rounds / 3 bursts, 1,025.18 px of continuous strafe/recoil travel, no browser errors. Origin-to-visible-muzzle delta grew from 40.01 px on burst 1 round 1 to 290.23 px on burst 3 round 4 (`burst-origin-before.json` / `.png`).

## Root cause

- Server scheduling is already live-positioned: `stepGunBurst` calls `fireGun(player, ...)` on each due tick, and `fireGun` derives every muzzle from the current authoritative `player.x/y` before applying that round's recoil.
- The live data instead exposes prediction/presentation divergence. Server recoil is applied after each of the four rounds and integrated before the next round. The self predictor adopts those authoritative impulse velocities during reconciliation, but deliberately folds the resulting positional correction into a slowly decaying visual error. During continuous strafe, the bounded sideways correction cannot keep up with four new recoil impulses per burst. By burst 3 the authoritative body was about 200-275 px off the rendered strafe lane, so correct authoritative projectile origins appeared detached from the visible character/muzzle.
- A smaller first-burst residual also exists because the server projectile row first arrives already advanced by one 50 ms tick while the final rendered held-weapon pose is client-authored. The permanent gate must measure the client presentation anchor as well as the authoritative recovered origin.
- Predicting the shared per-round recoil contract reduced the same live capture's max recovered-authority-to-visible-muzzle miss from 290.23 px to 96.43 px. This confirms accumulated unpredicted recoil as the dominant drift, while leaving the expected network/presentation residual that must be handled at the rendered projectile admission edge.

## Changes

- Added one shared gun-round recoil calculation and made the owning self predictor apply it for the trigger round plus every delayed burst round. Follow-up burst punctuation now re-samples current aim/rig state rather than retaining the trigger pose.
- New authoritative gun rows are admitted at a live rendered muzzle anchor before ordinary dead reckoning converges them downrange. Authoritative simulation/damage remain untouched.
- Added `GameRoom.v7-overcasters.test.ts`: a moving four-round Overcasters authority regression that compares every recovered origin with the shared muzzle transform evaluated at that round's live server position/recoil phase, plus a catalog-wide translation-invariance sweep for gun volleys/sequential patterns.
- Added a four-round moving recoil prediction regression to `prediction.test.ts` (focused file: 29/29 green).
- Coordination note: the concurrent V7 muzzle architecture changed during this Sol. An intermediate missing-export state and the later addition of recoil-phase geometry were both consumed without restoring a legacy calculation path.
- Muzzle handoff consumed: server gun rounds now use `weaponMuzzleWorldPointsForShot`; client projectile admission and predicted follow-up punctuation use `SpriteRig.writeWeaponMuzzleForShot` / the same accepted-beat art-point selection. No legacy offset/reach derivation was added by this Sol.

## Validation

- Focused self-prediction regression: 29/29 green.
- Focused server authority + catalog volley sweep: 2/2 green.
- Permanent Playwright gate `burst-origin-moving.spec.ts`: green against the final warm owner stack (1/1, 31.3 s). It captures 12 rounds across three distinct bursts while the owner travels continuously and requires every rendered spawn origin to remain within 2.5 px of its recorded live muzzle.
- `pnpm typecheck`: green after consuming the shared V7 muzzle transform.
- First full `npx vitest run`: 1,716/1,717 green; the only miss was the concurrent muzzle generator subprocess exceeding Vitest's 5 s per-test default under full-suite contention. The same gate passes alone (3/3; generator check 851 ms).
- Final serial full Vitest snapshot: 1,715/1,718 green. One failure was this Sol's test retaining a pre-handoff assumption that the muzzle itself was recoil-phase invariant; it was corrected to assert against the shared live round transform and is now green. The two remaining failures are outside this Sol: the existing 30 s mapgen timeout and the concurrent muzzle architecture's actor-scale expectation. Final focused Overcasters/prediction result after correction and formatting: 31/31 green, so this Sol contributes zero remaining/new unit failures.
- First full e2e invocation was cut off by the outer command's 5-minute wrapper before Playwright emitted its aggregate result. The repository has 17 serialized specs with 120 s per-test limits. The owner stack was not stopped or replaced.
- A second aggregate e2e invocation also produced no final Playwright output before a 15-minute outer ceiling, so validation moved to explicit spec shards against the same owner stack. First shard: Overcasters, beam lifecycle, and black-screen smoke green; the concurrent `beam-anchor.spec.ts` gate failed because it captured 0/8 active rendered beam frames. This is outside the new burst gate but inside the shared muzzle consumer surface, and is being tracked while the remaining specs run.
- Complete explicit e2e sweep: 14/20 tests green. The six red tests are outside this Sol's regression: moving beam anchor (0/8 active frames), Coilshot's existing `<600 ms` wall-clock bound (observed 891 ms), the in-progress catalog muzzle sweep (many shared-affine failures, then `devEquip` did not settle), movement probe bookkeeping/navigation, the legacy V6.1 Headsman subprocess, and the V6M Saintspar capture timeout. Overcasters passed in the same first shard and the catalog probe independently reported `x2-galvanic-overcasters: 0.00 px` before failing on a later weapon. The complete e2e matrix is therefore not green at this shared-worktree snapshot; the fix-specific permanent gate is green repeatedly.
- During those long shared-stack probes, the Vite listener on 5180 disappeared while the original server continued listening on 2567; no stop/kill command was issued. Only the missing client listener was restored in a hidden background Vite process on 5180. The authoritative server was never stopped or replaced.
- Final hygiene: targeted Biome check is clean, scoped `git diff --check` is clean, and both required listeners are alive at handoff (5180 client / 2567 server). No commit was created.

## Evidence

- Target directory: `docs/owner-notes-audit-v7-evidence/overcasters/`
- Before: `burst-origin-before.json` / `.png` (290.23 px max mixed authority-vs-visible drift).
- After: `burst-origin-after.json` / `.png` (final post-handoff capture: 79 frames, 12 rounds / 3 bursts, 12/12 rendered spawn anchors at 0 px, 1,256.92 px character travel, no browser errors). The JSON retains the mixed-time recovered-authority comparison separately for diagnosis rather than mislabeling a different prediction/authority clock as a presentation failure; live authoritative origin correctness is asserted directly by the server regression.
