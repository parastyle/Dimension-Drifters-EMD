# Janitor report — 2026-07-22T17:40:48.004Z

HEAD: `1e97c9a feat(movement): V7 movement gate closed — tumble proven at 2pi, immediate jump, two input hazards fixed`
Runs: 1 · fully clean runs: 0/1
Never commits, never pushes, never edits game logic.

> **Worktree was DIRTY (16 files) when this ran.** These results characterize uncommitted in-flight work, not the committed baseline. Re-run on a clean tree before trusting the flake table.


## 1. Flake characterization

| Test | Failed runs | Rate |
|---|---:|---:|
| V7-HIT standing VFX-collision law > keeps collision on shared timing while presentation reads only the final rig attachment | 1/1 | 100% |
| V6.1 brutalist greatsword line > uses six distinct generated sheets through the one overlapping 3x blade-tip geometry | 1/1 | 100% |
| V6.1 Headsman ship decision > roots the extension under the physical blade, masks the alpha inset, and preserves the 3x endpoint | 1/1 | 100% |

A test failing in SOME but not all runs is nondeterministic. 100% means a real, stable failure — escalate that, do not treat it as a flake.

<details><summary>Per-run totals</summary>

- run 1: 1714 passed, 3 failed

</details>

## 2. Derived-artifact drift

- OK   — weapon codegen check
- OK   — asset manifest check
- OK   — vfx reference sheet
- OK   — dev portal

Worktree files changed by regeneration: **0** (was 16 dirty before, 16 after).
No drift: every generated artifact matches what is committed.

## Escalate to a real Sol if

- any test shows a 100% failure rate (that is a break, not a flake)
- a generator FAILED rather than merely drifted
- drift appears in `packages/shared/src/*.generated.ts` (catalog/codegen desync has taken the game down before)
