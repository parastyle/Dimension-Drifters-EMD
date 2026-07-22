# V7 Blade-Extension Unification — Sol Report

## Status

- **2026-07-22 — Work started.** Read the owner ruling in `V7.1 — BLADE-EXTENSION UNIFICATION` and the completed V7 muzzle architecture report before implementation. The governing contract is one blade-owned affine transform: extension geometry must be computed in blade-local space and transformed with the blade, with no independent pose resolution.
- Scope is Sanctified Headsman's Pale Procession and all six brutalist greatswords routed through `blade-extension-treatments`. Extension width will be derived from the live blade width in that same local space. Reveal will ignite once at combo start, stay full across combo hits, retract when the combo ends or drops, and scale the authoritative hit reach during emergence without changing damage.
- Exclusive writes and sibling-owned read-only files are recorded from the work order. No `SpriteRig` or `ArenaScene` edits will be made; if the existing blade-tip contract cannot supply the required geometry, this report will stop at the exact accessor requirement.
- Validation target: permanent live capture during real swings, across multiple aim angles and both facings, measuring axial and lateral extension-to-blade error over the whole swing; combo ignition count/hold; and reveal-scaled reach. Owner listeners on ports 5180/2567 will not be stopped, killed, or replaced.

## Investigation log

- **2026-07-22 — Work resumed after owner handoff.** The movement Sol's released commit `1e97c9a` clears the prior sibling boundary: `packages/client/src/entities/SpriteRig.ts` and `packages/client/src/scenes/ArenaScene.ts` are now explicit exclusive writes for this work order. The implementation will first carry the existing blade attachment through `flushObservedSignature` / `spawnSlash`, establish a hand-indexed accessor or a proved lead-only invariant, and attach a stable per-wielder combo identity; it will then remove extension-side pose resolution, derive width from the sampled blade geometry, and make reveal/collision combo-scoped.
- The earlier status bullet saying no `SpriteRig` or `ArenaScene` edits would be made records the original block and is now superseded by this grant. The requirement to stop if a genuinely new `SpriteRig` accessor is needed remains active; the granted work is limited to the three already-documented handoffs.

- Owner ruling: do not bake a merged flat asset. Compose `physicalBlade + extension * reveal` in blade-local space (or parent extension under the blade node), inherit rotation/mirror/recoil/pose terms by construction, and hide the join by starting the rise inside the blade.
- Muzzle precedent: the successful fix removed parallel world-space reconstruction and made all consumers read one canonical affine. The same architectural test applies here: any extension path that independently resolves aim, facing, interpolation, or attack pose is a defect even if it matches at rest.
- Current self-player seam: `ArenaScene` passes `() => rig.leadWeaponTipPose()` to `VfxPlayer`, and `VfxPlayer` samples it after rig animation. However, the accessor returns only world tip, angle, physical length, and depth. It does **not** expose the blade-local/world affine or the blade's measured local width. `VfxPlayer` therefore currently uses per-weapon authored `thicknessScale` values from `hit-envelope.ts`, which directly violates the V7.1 derived-width ruling.
- Current remote seam: both real remote swing dispatches in `SpriteRig.flushObservedSignature` and `SpriteRig.flushCrossfallRibbon` call `scene.spawnSlash` without a blade-pose callback. `VfxPlayer` then falls back to its own actor origin plus `bladeExtensionPoseAt`, exactly the forbidden second pose-resolution path and the same root-cause class as the muzzle drift.
- Current combo seam: `bladeExtensionReveal` grows and drops within each individual swing. `VfxPlayer` allocates/releases the extension with each swing surface, and its callback has no stable wielder/combo identity. It cannot retain one ignition across hits or retract specifically at combo expiry without conflating simultaneous players using the same weapon.
- **Core unification implemented; focused gates pending.** The existing `leadWeaponTipPose` accessor is now hand-indexed and returns the final held-image world basis, alpha-measured width at the extension join, source/hand identity, and the retained combo generation/start/expiry. Self dispatch captures the active hand; both `flushObservedAttackSignature` and `flushCrossfallRibbon` carry that same callback through `spawnSlash`. All seven extension weapons are currently two-handed lead-slot weapons, but the callback contract no longer relies on that catalog invariant.
- `VfxPlayer` no longer imports or calls `bladeExtensionPoseAt` for extension presentation and contains no actor/aim/physical-length/thickness fallback. A retained `(sourceId, hand)` surface samples only the rig callback after final animation, composes its root/length in the blade basis, derives display width from the measured blade width, survives per-swing VFX surface release, and retracts only when the combo lifetime lapses. A new combo generation resets ignition exactly once.
- Shared collision now uses a 100 ms smooth per-combo opening rise. Later combo motions/steps are fully lit, and timed reach is the literal `grip + (physicalBlade + emergedBlade * reveal) * poseLengthScale`; damage values are untouched. The old seven authored `thicknessScale` values and all four Headsman prototype thickness values were deleted. Shared half-width remains the existing melee edge because authority has no sprite-alpha input; no replacement authored width ratio was introduced.
- First compile checkpoint: `pnpm typecheck` passed across shared, client, and server after the structural rewrite.

## Required sibling handoff — blocking (explicit work-order stop)

The existing `SpriteRig` attachment contract must be widened before the exclusive files can implement the ruling honestly. No sibling-owned file was edited.

1. Extend/generalize the existing `leadWeaponTipPose()` contract (do not add a parallel pose solver) so one sample exposes the final held-blade affine or blade node **and** the measured blade width at the extension join in that same local space. Minimum data if returning a value object: world affine basis/translation, physical blade tip/root local coordinates, measured blade width, and depth. Returning/parenting to the final held blade node is also sufficient if the client can measure the join width from that node's real texture/frame and transform.
2. Pass that same attachment callback through `SpriteRig.flushObservedSignature` into `scene.spawnSlash`. The structural `RigAttackPresentationScene.spawnSlash` declaration must accept it. This removes the current remote fallback pose. If crossfall can ever carry a blade-extension weapon off-hand, the existing accessor must be generalized to a hand-indexed form and `flushCrossfallRibbon` must pass hand `1`; otherwise document the invariant and keep the lead-only form.
3. Provide a stable per-wielder combo attachment identity/lifetime through the same source contract (for example `sourceId`, combo-chain generation/start epoch, and combo expiry/active state). A callback allocated per press is not a stable identity. `VfxPlayer` needs this solely to retain the one blade-local extension surface across accepted hits and retract on the actual chain drop; shared reveal/collision code will still own the numeric ignition curve.

Once that handoff lands, the exclusive implementation can remove `bladeExtensionPoseAt` and all synthetic actor fallback use from `VfxPlayer`, replace authored extension thickness with the measured width, make reveal combo-scoped, and add the required axial/lateral whole-swing live gate.

## Validation

- **Superseded.** The bullet below records the FIRST pass, which stopped at the sibling boundary. That
  boundary was released by movement commit `1e97c9a`, the implementation landed (see investigation log),
  and the Sol then stalled before running its own gate. Orchestrator harvested and validated it.
- ~~Blocked before implementation by the explicit sibling-owned `SpriteRig`/`ArenaScene` attachment
  requirement above.~~

### Orchestrator validation (2026-07-22, post-harvest)

- `pnpm typecheck` clean. Unit suite **1717/1717** after re-pointing two stale source-text assertions
  in `tests/v61-brutalist-greatswords.test.ts` (they pinned the deleted `sourceBladePose?.()` line and
  the old depth expression; they now pin the architecture — no `bladeExtensionPoseAt`, no
  `thicknessScale`, width from measured `bladeWidth`).
- **Live gate PASSED for all 7 extension weapons** (`e2e/tests/v7-blade-extension-live-gate.spec.ts`,
  2.6 min). Headsman sample: 251 frames, both facings, ~pi angle span local and remote, combo steps
  0–4, 1 ignition transition, 0 remote relight drops.
- Worst-case error across all 7 weapons, over the whole swing:

  | metric | tolerance | worst observed |
  |---|---|---|
  | axial join | 0.25 px | 4.5e-13 px |
  | lateral join | 0.25 px | 5.9e-13 px |
  | width | 0.25 px | 7.1e-15 px |
  | angle | 0.002 rad | 1.1e-15 rad |

  These are floating-point epsilon, not a tuned match — the extension is derived from the blade basis
  rather than reconstructed alongside it, so desync is impossible by construction. Same class of fix
  as the muzzle-in-art-space correction.

## Final validation — complete

- **Architecture:** `SpriteRig.leadWeaponTipPose(hand)` is the sole presentation attachment. It exposes the
  final held-image affine, alpha-measured join width, explicit hand, and stable per-wielder combo generation /
  start / expiry. Self, remote observed signatures, and Crossfall's off hand all pass that callback through
  `ArenaScene.spawnSlash`. `VfxPlayer` contains no extension call to `bladeExtensionPoseAt`, no synthetic actor
  origin, and no aim/facing/length/thickness fallback. Its retained `(sourceId, hand)` image is composed only in
  the sampled blade basis after rig animation.
- **Width and lifetime:** the extension display width is the measured opaque blade span transformed by the
  blade's own normal scale. All seven shared `thicknessScale` overrides and four Headsman prototype thickness
  fields are gone. A combo generation ignites over the shared 100 ms curve once, remains lit across accepted
  hits, and retracts over 90 ms after chain expiry. Headsman's orbit style receives the same stable chain
  identity without inventing a visual combo pose family.
- **Collision:** `meleeDamageReachAt` uses the same reveal in the literal
  `grip + (physicalBlade + emergedBlade * reveal) * poseLengthScale` law. Opening reach is short during the rise,
  later combo steps start at full reach, all three brutalist motion/foreshortening paths remain shared with the
  server, and damage values are unchanged. Authority retains the pre-existing base melee half-width because it
  has no sprite-alpha input; no authored replacement ratio was introduced.
- **Historical before capture:** detached commit `faadfb159155699c7f025b375fb42f5f8bcec49d` ran on private
  ephemeral listeners with a real remote wielder for all seven weapons. Each facing traversed at least 2.900 rad.
  The old second pose path measured 239.59–313.00 px maximum axial error and 167.87–204.57 px maximum lateral
  error per weapon. The sampler directly observed 23 re-ignitions across 48 per-swing extension surfaces.
- **After live gate:** `e2e/tests/v7-blade-extension-live-gate.spec.ts` passed 7/7 in 2.8 minutes on private
  listeners. It sampled 1,651 whole-swing frames (747 from a real second Colyseus client), local and remote,
  right-up and left-up. Minimum facing/observer angle traversal was 3.09160596275514 rad. With the fixed
  thresholds of 0.25 px join/width, 0.002 rad angle, and 0.002 reveal/reach, aggregate maxima were:
  axial `4.54745621887899e-13 px`, lateral `4.54702040108402e-13 px`, width
  `7.105427357601e-15 px`, angle `1.11022302462516e-15 rad`, and reveal/reach
  `3.33066907387547e-16`. Every local combo sampled exactly one rise and full hold across later hits. Remote
  observers sampled zero or one initial transition (depending on whether the accepted swing arrived after the
  100 ms rise), then zero reveal drops/re-ignitions after full.
- **Permanent evidence:** `docs/owner-notes-audit-v7-evidence/blade-extension/README.md` indexes the fixed
  thresholds and aggregate comparison. Every weapon directory contains before/after both-facing screenshots,
  remote after screenshots, and full per-frame before/after JSON.
- **Repeatable checks:** `pnpm typecheck` passed; the focused Vitest run passed 25/25 across six files
  (`SpriteRig.blade-extension`, `VfxPlayer.blade-extension`, owner orders, brutalist catalog, V7 hit-envelope
  law, and `GameRoom.v7-hit`); Biome passed the eight changed/new leaf targets. No threshold was weakened. The
  owner's listeners on 5180/2567 were never stopped, killed, or replaced. No git commit was created.
