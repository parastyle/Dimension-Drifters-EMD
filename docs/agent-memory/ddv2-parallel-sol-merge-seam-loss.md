---
name: ddv2-parallel-sol-merge-seam-loss
description: "Merging parallel Sol branches can silently drop one Sol's call site while keeping its module — unit tests still pass"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-27T18:21:24.530Z
---

When two Sols touch the same file in parallel worktrees, a merge can keep branch A's new
module/method and branch B's older version of the *call site*, leaving the new code never invoked.
Unit tests still pass, because they drive the module directly rather than through the scene.

Real case (2026-07-27): `b83-input-alias` fixed render/commit aliasing in `prediction.ts` and measured
31.36px -> 0.000px. The `b84-debug-hud` merge retained b84's older `ArenaScene` accumulator, which
never called b83's new frame sampler. The owner tested a build where the fix was inert and reported
"still warping". Found only because `b85` re-derived the seam.

**Why:** Sol verification is per-branch. Nothing in the harness proves the integration point survived
a merge, and the passing test suite reads as confirmation that it did.

**How to apply:** After merging parallel branches that touch a shared file, grep that the new API is
actually *called* from the consumer (`grep -n "thing\." consumer.ts`), not merely defined. Ask each
Sol to add a source-contract test that asserts the call site exists as a string in the consumer file —
`b85` did exactly this for the 11 HUD intake seams and it is the right pattern. See
[[ddv2-codex-sol-delegation]].
