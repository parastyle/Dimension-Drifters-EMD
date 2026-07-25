# B47 Studio V2 — full element transforms

## Outcome

Studio V2 can now select every rendered head, hand, foot, and weapon part and author a uniform affine
overlay without modifying the underlying art. Move is available by dragging the selected body and by
arrow-key nudging (Shift uses a 10 px step); rotation is available from the rotation handle or angle
field; scale is available from all four corner handles or the uniform-scale field. The transform
editor provides current-beat, idle/held-pose, and whole-hold scopes plus copy-to-other-facing,
reset-element, and reset-all controls.

The shared weapon schema is version 45. `elementTransforms` is optional, contains no character/body
displacement channel, and is keyed only by `head`, `hand-l`, `hand-r`, `foot-l`, `foot-r`, and
`part-N`. Whole-hold, pose, and beat transforms compose in that order: translations and rotations add,
while scale multiplies. Rig application is a final overlay on the computed pose. Left facing mirrors
`dx` and `rotationRad`; `dy` and scale remain unchanged.

## Runtime and compatibility

- `rig-pose` applies authored overlays after its computed pose to the head, both hands, both feet,
  regular weapon parts, break-action barrel parts, and wrap-foot weapon parts. Head transforms happen
  before gear synchronization so attached head gear follows it.
- Stable element identities are carried by the rig-core/rig-gear limb objects, while `SpriteRig`
  exposes live rendered bounds for Studio selection and gizmo placement.
- Pose Studio rebuilds its live `WeaponDef` from the edited authoring row, so dragging or field edits
  enter the active animation loop immediately. Idle versus held preview follows the selected pose
  scope; beat scope follows the selected combo step.
- The overlay writer is never entered for definitions without `elementTransforms`. The B47 census
  covers every current weapon in idle and held samples facing both directions and proves byte-identical
  render-transform snapshots for unauthored definitions.
- The generator validates and emits all three scopes, strict transform keys and bounds, valid rendered
  element IDs, and beat references. Test-only output overrides let the generator fixture prove the
  emitted object without changing checked-in generated files. `gen:check` is clean.
- The B46 save validator and catalog writer round-trip the new optional object. Existing protected
  recoil and melee-displacement surfaces remain protected; no B45 recoil surface or art asset changed.

## Proof

The private-port proof ran the weaponsmith API at 57642 and Pose Studio at 57643. It snapshotted
`x2-blightfork-glaive`, saved distinct move/rotate/scale values for `part-1` at whole-hold scope and
`hand-r` at held-pose and beat-0 scopes, then reloaded the row. The saved response and reload matched
the authored object exactly. Snapshot restore matched the initial row, and
`data/weapon-concepts-300.json` was restored to exact Git HEAD bytes.

Evidence is retained under
`docs/owner-notes-audit-v11-evidence/b47-studio-transforms/round-trip.json`; the API and UI returned
HTTP 200, and both server error logs were empty.

The connected Browser runtime was unavailable: initialization returned `No browser is available` and
the documented troubleshooting listing returned no browsers. Its instructions prohibit a standalone
automation fallback, so the requested interaction screenshot could not honestly be produced. This
environment limitation is recorded in the evidence README rather than hidden or replaced with a fake
image. The implementation itself is verified through compilation, the real private-port save/reload
exercise, and automated resolver/generator/census tests.

## Verification

- `pnpm gen` — PASS
- `pnpm gen:check` — PASS
- `pnpm typecheck` — PASS
- `pnpm --filter @dd/client build` — PASS
- `pnpm test` — PASS, 211 files and 2,730 tests
- `pnpm vitest run tests/b47-studio-transforms.test.ts tests/pose-studio-roundtrip.test.ts tests/data-consistency.test.ts` — PASS, 391 tests
- `git diff --check` — PASS

## Files touched

- Shared model: `packages/shared/src/weapons.ts`, `packages/shared/src/constants.ts`
- Rig: `packages/client/src/entities/SpriteRig.ts`,
  `packages/client/src/entities/rig/{rig-core,rig-gear,rig-pose}.ts`
- Studio: `packages/client/pose-studio.html`, `packages/client/src/pose-studio/{main,model,stage}.ts`,
  `packages/client/src/pose-studio/style.css`
- Authoring and generation: `tools/weaponsmith/catalog-row-store.mjs`,
  `tools/artkit/gen-weapon-expansion.mjs`
- Tests and schema pins: `tests/{b47-studio-transforms,data-consistency,pose-studio-roundtrip}.test.ts`,
  eight schema-pinned room/progression tests under `packages/server/src/rooms/`
- Audit: this report and `docs/owner-notes-audit-v11-evidence/b47-studio-transforms/`

VERDICT: schema live; gizmos live (move/rotate/scale × beat/pose/whole-hold scope); backward-compat proven; round-trip proven; evidence path `docs/owner-notes-audit-v11-evidence/b47-studio-transforms/`; files touched are shared weapon schema/version, client rig and Studio, generator/save validation, tests/schema pins, and B47 audit artifacts.
