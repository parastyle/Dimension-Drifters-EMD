# B8 Gravewarden Amendment Implementation

## Understanding

The shipped Gravewarden Buster (`gravediggers-spade`) attack currently reads as a ground-plane
whirlwind. The intended action is instead a continuous frontflipping beyblade: while the attack is
held or looping, the full body and weapon rotate forward at a fixed rate around the pitch axis.
The animation must remain seamless at its loop boundary and must preserve the existing buster-spade
identity, damage, cadence, attack coverage, hit envelope, and B17 idle-hand law.

## Plan

1. Trace the Gravewarden concept data through pose-language selection and SpriteRig animation.
2. Prefer naming the intended family in weapon concept data and existing pose vocabulary; add only
   the smallest action-owned SpriteRig primitive if continuous pitch rotation is not expressible.
3. Add a focused regression test for fixed-rate, seamless pitch rotation and absence of yaw spin.
4. Regenerate derived artifacts, inspect the diff for scope and LF endings, then run generation
   checks, typechecking, the focused test, and the full test suite.
5. Commit the verified implementation on `sol/b8-gravewarden-spin`.

## Implementation

The trace found no Gravewarden row in `data/weapon-concepts-300.json`: that catalog owns expansion
weapons, while `gravediggers-spade` is an authoritative base weapon in
`packages/shared/src/weapons.ts`. Its B8 datum now selects `twirl.plane:
"continuous-frontflip"` instead of `ground-whirlwind`. The shared type and concept-data validator
both accept that named family, so the same vocabulary remains available to generated weapons.

`pose-language.ts` resolves continuous twirls to an explicit semantic axis. Ground whirlwinds remain
`yaw`; the new Gravewarden family resolves to `pitch`. Its cadence-locked phase feeds a fixed-rate
frontflip angle with one integer revolution per accepted 0.6-second beat. Facing reverses the signed
rotation so the head pitches forward in either direction. The frontflip path also suppresses the
spin action's independent local weapon twirl, keeping the buster spade locked to its two-hand grip.

`SpriteRig.ts` applies pitch twirls to the shared rig root, rotating the full body, limbs, and weapon
as one unit. It deliberately does not arm `orbitSpin`, so the rejected ground-plane ellipse,
foreshortening, depth swap, and signed `scaleX` yaw turn do not run. Existing yaw choreography for
other whirlwind weapons is unchanged. No damage, reach, half-arc, swing arc, timing swing arc,
cooldown, rez behavior, hit envelope, combo selection, or idle-hand law changed.

## Focused proof

`SpriteRig.gravewarden-frontflip.test.ts` proves:

- the authored family resolves to pitch and is not `ground-whirlwind`;
- quarter-turn signs mirror with facing, preserving a forward somersault;
- the cadence modulo seam has the same orientation at phase 0/1 and the same angular velocity on
  both sides, with no ease, reset, or jitter;
- damage 8, range 210, half-arc 0.95, cooldown 0.6, full-circle attack coverage, and the legacy
  active-start/active-end timing remain unchanged.

The existing B8 owner-order and V6A art contracts were amended to lock the corrected plane and
retain the same gameplay/art identity.

## Verification

- Focused pose gate: 5 files, 71 tests passed.
- `pnpm gen` passed. The isolated worktree required the intentionally separate
  `tools/artkit/package-lock.json` install for its `sharp` runtime; no dependency manifest changed.
- `pnpm gen:check` passed. Its expected unavailable-reference warning skipped only the unchanged
  324-entry VFX subject catalog.
- `pnpm typecheck` passed for shared, client, and server.
- Full `pnpm test` passed: 154 files, 1,984 tests.
- No live stack was booted.
- `git diff --check` passed, and all touched text files are LF-only.

Verdict: continuous frontflip vs old whirlwind — PASS; seamless loop proven at identical orientation and angular velocity with pitch-only SpriteRig routing; files touched — `packages/shared/src/weapons.ts`, `packages/client/src/sprites/pose-language.ts`, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/entities/SpriteRig.gravewarden-frontflip.test.ts`, `tools/artkit/gen-weapon-expansion.mjs`, `tests/owner-notes-weapon-pose.test.ts`, `tests/v5m-melee-owner-orders.test.ts`, `tests/v6a-art-owner-orders.test.ts`, `docs/sol-reports/impl-b8-gravewarden.md`.
