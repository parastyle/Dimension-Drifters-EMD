# V7 Blade-Extension Unification — Sol Report

## Status

- **2026-07-22 — Work started.** Read the owner ruling in `V7.1 — BLADE-EXTENSION UNIFICATION` and the completed V7 muzzle architecture report before implementation. The governing contract is one blade-owned affine transform: extension geometry must be computed in blade-local space and transformed with the blade, with no independent pose resolution.
- Scope is Sanctified Headsman's Pale Procession and all six brutalist greatswords routed through `blade-extension-treatments`. Extension width will be derived from the live blade width in that same local space. Reveal will ignite once at combo start, stay full across combo hits, retract when the combo ends or drops, and scale the authoritative hit reach during emergence without changing damage.
- Exclusive writes and sibling-owned read-only files are recorded from the work order. No `SpriteRig` or `ArenaScene` edits will be made; if the existing blade-tip contract cannot supply the required geometry, this report will stop at the exact accessor requirement.
- Validation target: permanent live capture during real swings, across multiple aim angles and both facings, measuring axial and lateral extension-to-blade error over the whole swing; combo ignition count/hold; and reveal-scaled reach. Owner listeners on ports 5180/2567 will not be stopped, killed, or replaced.

## Investigation log

- Owner ruling: do not bake a merged flat asset. Compose `physicalBlade + extension * reveal` in blade-local space (or parent extension under the blade node), inherit rotation/mirror/recoil/pose terms by construction, and hide the join by starting the rise inside the blade.
- Muzzle precedent: the successful fix removed parallel world-space reconstruction and made all consumers read one canonical affine. The same architectural test applies here: any extension path that independently resolves aim, facing, interpolation, or attack pose is a defect even if it matches at rest.
- Current self-player seam: `ArenaScene` passes `() => rig.leadWeaponTipPose()` to `VfxPlayer`, and `VfxPlayer` samples it after rig animation. However, the accessor returns only world tip, angle, physical length, and depth. It does **not** expose the blade-local/world affine or the blade's measured local width. `VfxPlayer` therefore currently uses per-weapon authored `thicknessScale` values from `hit-envelope.ts`, which directly violates the V7.1 derived-width ruling.
- Current remote seam: both real remote swing dispatches in `SpriteRig.flushObservedSignature` and `SpriteRig.flushCrossfallRibbon` call `scene.spawnSlash` without a blade-pose callback. `VfxPlayer` then falls back to its own actor origin plus `bladeExtensionPoseAt`, exactly the forbidden second pose-resolution path and the same root-cause class as the muzzle drift.
- Current combo seam: `bladeExtensionReveal` grows and drops within each individual swing. `VfxPlayer` allocates/releases the extension with each swing surface, and its callback has no stable wielder/combo identity. It cannot retain one ignition across hits or retract specifically at combo expiry without conflating simultaneous players using the same weapon.

## Required sibling handoff — blocking (explicit work-order stop)

The existing `SpriteRig` attachment contract must be widened before the exclusive files can implement the ruling honestly. No sibling-owned file was edited.

1. Extend/generalize the existing `leadWeaponTipPose()` contract (do not add a parallel pose solver) so one sample exposes the final held-blade affine or blade node **and** the measured blade width at the extension join in that same local space. Minimum data if returning a value object: world affine basis/translation, physical blade tip/root local coordinates, measured blade width, and depth. Returning/parenting to the final held blade node is also sufficient if the client can measure the join width from that node's real texture/frame and transform.
2. Pass that same attachment callback through `SpriteRig.flushObservedSignature` into `scene.spawnSlash`. The structural `RigAttackPresentationScene.spawnSlash` declaration must accept it. This removes the current remote fallback pose. If crossfall can ever carry a blade-extension weapon off-hand, the existing accessor must be generalized to a hand-indexed form and `flushCrossfallRibbon` must pass hand `1`; otherwise document the invariant and keep the lead-only form.
3. Provide a stable per-wielder combo attachment identity/lifetime through the same source contract (for example `sourceId`, combo-chain generation/start epoch, and combo expiry/active state). A callback allocated per press is not a stable identity. `VfxPlayer` needs this solely to retain the one blade-local extension surface across accepted hits and retract on the actual chain drop; shared reveal/collision code will still own the numeric ignition curve.

Once that handoff lands, the exclusive implementation can remove `bladeExtensionPoseAt` and all synthetic actor fallback use from `VfxPlayer`, replace authored extension thickness with the measured width, make reveal combo-scoped, and add the required axial/lateral whole-swing live gate.

## Validation

- Blocked before implementation by the explicit sibling-owned `SpriteRig`/`ArenaScene` attachment requirement above. No thresholds were selected or weakened, no private listener was started, and no live evidence was claimed.
