# Combo-stage bridge implementation — `anim-fix-combo-bridge`

## Work-order understanding and staged plan

This is an implementation and live-proof order on `feat/v0.118-metagame`. The diagnosed defect is the existing combo-stage presentation bridge, not the approved combo data: it sizes its lifetime from the generic swing descriptor instead of the selected combo step's authoritative active start, captures an incomplete set of presentation channels, and is especially visible on remote rigs. The implementation must preserve combo order, choreography, timing, path, hit windows, `attackSeq`, `attackTick`, combo selection, prediction, interpolation delay, `swingStart`, and authoritative/world root position.

The authority split is binding. The visible weapon affine, attacking/grip hands, blade extensions, and any parent transform that moves the damage silhouette remain on the authored accepted clock. In particular, `root.rotation` cannot be added to the blanket bridge because it carries the weapon; it stays sharp/authored unless a separate non-hit visual pivot already exists. Safe body and attack-shadow presentation channels may bridge, but every residual must be gone by the selected step's authoritative `activeStart × poseSeconds`. Impact, parry, recoil hit, roll/tumble takeover, downed/death, render-depth flips, and true weapon identity changes remain sharp.

Implementation order:

1. Stage 1 — compute the combo bridge deadline from the selected step timing used by the server and correct the continuity unit test to assert that exact step deadline. Mutation-check by deliberately restoring the wrong deadline and recording the red test before restoring the fix.
2. Stage 2 — classify transition capture/apply channels into combat-truth and presentation-only lanes. Remove weapon/hit-carrier transforms from the bridge, keep weapon-carrying root rotation authored, and add only safe attack-shadow/body presentation coverage. Add focused tests for coverage and exclusions.
3. Stage 3 — prove the same accepted-epoch treatment on real remote rigs without adding any delay or changing the remote interpolation timeline. Build a permanent private-stack live gate across melee, greatsword, dagger/claw, polearm, and dual wield for local and remote actors.
4. Stage 4 — optional only. Consider velocity-continuous handoff only if stages 1–3 land cleanly and the permanent gate still fails the owner's teleportation threshold. Stop after stage 3 if the threshold is met.

The permanent gate will retain before/after evidence, enforce the predeclared per-part discontinuity multiple, the V7 `1 px` active-envelope tolerance for authoritative geometry (with written catalog-specific known-baseline exclusions rather than threshold changes), exact `rigAttackSeq - authority attackSeq === 0`, and no extra remote onset delay. It will use ephemeral private ports and will not touch `5180` or `2567`.

## Stage 1 — authoritative combo-step deadline

Implemented in `packages/client/src/entities/SpriteRig.ts` and `SpriteRig.combo-continuity.test.ts`.

- `comboStageTransitionDurationMs` now accepts the selected swing descriptor and derives its anticipation from `comboTiming.activeStart × poseSeconds` when combo timing exists. The generic `activeStartSeconds` remains only as the non-combo fallback.
- The representative continuity assertion now compares the bridge against the selected step's deadline, and a catalog-wide test traverses every current weapon/step promoted by `weaponUsesAuthoritativeEnvelopeCombo`.
- No descriptor, combo data, server timing, path, hit window, cooldown, damage, `attackSeq`, or accepted epoch changed.

Mutation proof: after the corrected test passed, I deliberately changed the helper back to `swing.activeStartSeconds`. The focused suite went red with 3 failures: Dustreaper step 1 requested `80 ms` against `59.904 ms`, Stillwater Edict step 1 requested `60.0908 ms` against `32.768 ms`, and Pale Horizon step 1 requested `80 ms` against `61.44 ms`. Restoring the step-derived formula returned the suite to green. The later catalog-wide assertion makes this coverage broader still.

## Stage 2 — combat-truth and presentation channel split

Implemented in `packages/client/src/entities/SpriteRig.ts` with focused pure-transform coverage in `SpriteRig.combo-continuity.test.ts`.

- Weapon images are no longer captured or blended at combo boundaries. Their final visible/canonical affine stays on the current authored accepted step on every frame.
- `root.rotation` is also not blended. It parents every equipped weapon in this rig, so blending it would rotate hit geometry and violate the authority law. The transition captures root rotation/scale only as a presentation-space basis; safe body children are rebased under the newly authored root so their screen pose is continuous while the root and weapon remain exact.
- The grounded attack shadow and halo are captured and restored through the same presentation-only basis after their actual final writer. They carry no hit geometry.
- Parent/root x/y are absent from the helper and state. Movement and netcode remain their only owners.
- A root scale/facing change invalidates the residual rather than interpolating a render-depth/mirror event. Parry acquisition, non-idle movement takeover, damage recoil, downed state, and ultimate takeover also cancel it in-frame so those information-bearing changes stay sharp.
- The same rig path serves owner and remote actors; no receipt-time clock or additional delay was introduced.

Focused proof after this stage: `SpriteRig.combo-continuity.test.ts` passes 20/20 tests, including both root facing signs and exact screen-position/orientation continuity at elapsed zero followed by exact authored target recovery at the deadline. `pnpm typecheck` also passes. Live/local+remote proof remains Stage 3 and is not claimed here.

## Stage 3 — remote presentation and permanent live gate

Product implementation remains in the shared `SpriteRig` path used by owners and observers. A remote accepted step now latches its presentation residual at the first observed presentation time but receives only the time remaining to the original accepted-epoch bridge deadline. It does not start a fresh full-duration blend, change `swingStart`, or delay the weapon: `acceptedAtMs`, `startedAtMs`, and `deadlineAtMs` are retained separately, and an already-expired deadline skips the residual in favor of authored truth.

The permanent gate is `e2e/tests/anim-combo-bridge-live-gate.spec.ts`, with isolated config at `docs/design/anim-evidence/combo-bridge/playwright.config.ts`. It uses `runArenaSpec` and a real second Colyseus client on ephemeral ports. Coverage is Hailwidow katana, Verdict ordinary melee, Dustreaper greatsword, Wendigo claws/dual wield, Dustdevil polearm, and Twin Bowie dagger pair/dual wield, all local and remote. It captures final rendered body/head/hands/feet/shadow transforms, blade affines, accepted/mapped epochs, transition identity/deadline, and rig/authority sequence values, and retains local/remote screenshots plus raw/summary JSON.

The in-app browser plugin was initialized as required for local visual work, but the runtime reported no available browser backends even after the prescribed discovery/troubleshooting path. The repository's established isolated Playwright route was therefore used.

### Live result — gate remains red; thresholds unchanged

Four private-stack iterations were used to correct the proof path, not to tune thresholds:

- The first reproduced the existing headless ~95 ms cadence and went red on presentation discontinuity.
- Browser launch throttling flags improved cadence and brought the remote onset observation below 70 ms on one run.
- The local driver was corrected from raw room messages to the actual held-pointer/`stepNetInput` prediction path. This exposed real predicted frames before the authoritative row catches up; prediction itself was not changed.
- The result-of-record run used the permanent gate after the accepted-deadline remote residual change. It bound private server port `53495`, completed every expected step for all 12 actor/weapon rows, captured 640 frames, and wrote the evidence under `docs/design/anim-evidence/combo-bridge/`.

Result-of-record fixed gates:

- Presentation discontinuity: fail — 76 combo-boundary part flags (44 local, 32 remote) at `>= 4 px AND >= 6×` the 15-boundary local median, or `>= 0.12 rad AND >= 6×` that median. No threshold was lowered. The run's median rendered cadence was 51.59 ms (p95 54.26 ms); Hailwidow step 1 becomes active after 23.04 ms, so an intermediate presentation frame cannot be both displayed and finished before authority on this stack. Late authored truth correctly wins.
- Active deadline: pass in evidence — 0 authoritative-active samples retained a transition. The bridge is finished/skipped before every captured active sample.
- Active geometry: two explicit known-baseline exclusions at the unchanged `1 px` tolerance. Hailwidow and Dustdevil are red while `transitionActive === false`; their authored weapon affines/path debt predates this bridge change and is retained in the evidence rather than hidden. Non-excluded active failures: 0. The result run captured 19 active samples, below the gate's fixed `>20` volume floor, so the volume assertion would also remain red after the first failure.
- Sequence identity: fail across the literal whole capture — 246 local predicted presentation frames preceded the authoritative row confirmation. This is existing product prediction behavior and was intentionally not changed. The older katana gate proves an authority-confirmed sample for every step; despite its report wording, its code does not assert equality on every predicted frame.
- Remote onset: fail on the result run — 27 remote accepted beats observed; worst first-render onset was 75.19 ms against the fixed `<=70 ms` ceiling. The weapon is excluded from the residual and receives no added animation delay, but the measured first eligible headless frame exceeded the wall-time cap.

Stage 3 therefore implemented the safe shared remote treatment and permanent proof, but it did not meet the owner's no-teleport closure bar on this live stack. Stage 4 is not attempted: stages 1–3 did not land cleanly, and velocity shaping cannot create an intermediate rendered frame inside a 23.04 ms authority deadline on a 51.59 ms median capture cadence without violating the accepted clock.

## Validation

- `pnpm exec vitest run packages/client/src/entities/SpriteRig.combo-continuity.test.ts --reporter=dot`: pass, 20/20.
- Deadline mutation check: pass as a proof exercise—the focused suite failed on the deliberately restored generic deadline, then returned to 20/20 after restoring the combo-step deadline.
- `pnpm typecheck`: pass.
- First `pnpm test`: 1,754 passed and 2 failed in untouched server tests (XP Echo retarget and Stormcaller waveform position). The Stormcaller file and the XP Echo case each passed focused reruns. A second complete `pnpm test` then passed 133/133 files and 1,756/1,756 tests.
- Permanent private live gate: executed on server port `53495`; red at the unchanged visual/sequence/onset/volume assertions described above. It never bound, stopped, or replaced ports `5180` or `2567`.
- Evidence retained: `after-summary.json`, `after-frames.json`, `after-local-greatsword.png`, and `after-remote-greatsword.png` under `docs/design/anim-evidence/combo-bridge/`. The prior panel's before evidence remains under `docs/design/anim-evidence/measure/`.
- `git diff --check`: pass. All files written by this implementation contain LF only. No generated output changed, so `pnpm gen`, `pnpm gen:check`, and `pnpm assets:check` were not applicable.

VERDICT: Stage 1 shipped; Stage 2 shipped; Stage 3's authority-safe local/remote implementation and permanent gate shipped but visual closure did not—76 discontinuity flags, 246 literal whole-capture sequence mismatches from existing local prediction, 75.19 ms worst remote onset, and only 19 active samples remain unproved/red; Stage 4 did not ship. Exact gate thresholds: position discontinuity `>=4 px AND >=6×` the part's 15-boundary local median; rotation discontinuity `>=0.12 rad AND >=6×` that median; V7 active-envelope tolerance `<=1 px` with explicit Hailwidow/Dustdevil known-baseline exclusions; active-sample volume `>20`; `rigAttackSeq - authority attackSeq === 0` for every captured frame; remote onset `<=70 ms`; and no transition active at any authoritative active sample.
