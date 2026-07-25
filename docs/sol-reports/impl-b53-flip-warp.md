# impl-b53-flip-warp

## Verdict

Confirmed and fixed a render-only facing discontinuity. The simulation turn-hitch behavior and
the B51/B52 correction path were not involved.

Before the fix, the rendered root's signed horizontal scale could cover most or all of a mirror
in one render update. On an ordinary pose, the exponential blend was frame-duration dependent:
a long render frame moved `facingBlend` from one side through edge-on in one update, translating
every pivot-offset child. The aimed-gun path was worse because it replaced the blended scale with
`facing * baseScale` immediately. Authored B47 element offsets also changed on committed facing
rather than on the visual mirror side. Rapid A/D interruption changed the exponential derivative
abruptly instead of carrying turn velocity through the interruption.

The paper action flip-progress path was not the movement-direction root cause. The probe records
the movement-facing `flipProgress` as `(facingBlend + 1) / 2`; its discontinuity tracked the root
mirror behavior above.

## Fix

- Added a render-only, critically damped facing state with retained velocity, 120 Hz internal
  substeps, and a 3.5 signed-scale-units/second cap. An interrupted flip therefore continues from
  its current visual value and velocity.
- Kept authored facing-local element layout on the currently visible side and rebased it only as
  the mirror crosses edge-on, where horizontal offset rebasing is visually collapsed.
- Removed the aimed-gun full-sign root-scale bypass so guns use the same continuous parent mirror.
- Reset the retained facing velocity with the rig's other secondary motion state.
- Left movement constants, shared authority, prediction, reconciliation, and netcode untouched.

## Regression coverage

`e2e/tests/b53-flip-warp.probe.spec.ts` is the permanent headless gate. It captures real rendered
world transforms every frame for the root, body, head, both hands, both feet, and held weapon,
plus local positions, facing, `facingBlend`, signed root scale, and `flipProgress`.

The gate sweeps 24 scenarios:

- 3 characters: hidden-face cowboy, Drifter, and Samurai
- 4 states: unarmed, one-handed gun, two-handed melee held, and mid-combo
- 2 direction patterns: single reversal and rapid ADADAD

Mid-combo coverage enters one attack pose before each tested direction change. This avoids
synthetic 90 ms attack spam advancing unrelated combo stages between slow headless samples.
Each part's world position is measured relative to the rendered root and normalized to a 60 Hz
frame. The permanent limit is 6 px; root translation has a separate 11.5 px movement allowance.

The matching full captures show:

| Metric | Before | After |
| --- | ---: | ---: |
| Sweep | 24/24 recorded | 24/24 passed |
| Maximum normalized part step | 13.3333 px | 3.1623 px |
| Raw step at the maximum | 93.2798 px / 116.6 ms | 25.2732 px / 133.2 ms |
| Part steps over 6 px | 90 | 0 |
| Root threshold violations | 0 | 0 |

The after maximum is ordinary continuous hand/pose travel in Drifter's two-handed melee ADADAD
case. The pre-fix maximum is the front hand translating across the signed root mirror on the
committed direction-change frame.

`SpriteRig.facing-continuity.test.ts` additionally verifies the mirror speed bound, exact settling,
velocity-preserving interruption, bounded rapid reversal, and edge-on layout-side handoff.

## Verification

- `pnpm typecheck` — passed.
- `pnpm test` — passed: 217 files, 2,778 tests.
- `node tools/b53-flip-warp-probe.mjs after` — passed: 24/24 scenarios, zero discontinuities.
- `git diff --check` — passed.

Evidence, raw traces, and screenshots:
`docs/owner-notes-audit-v12-evidence/b53-flip-warp/`.
