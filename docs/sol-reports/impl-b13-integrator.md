# B13 Wyrmskull two-frame firing animation integration

## Initial understanding

The shipped `x2-wyrmskull-reliquary` sprite is the closed-mouth idle/default
frame. The shipped `x2-wyrmskull-reliquary-open` sprite is a same-registration
variant that must appear only during the authoritative attack release window.
The render state must return to the closed frame deterministically after release,
must agree for local and remote players in both facings, and must leave gameplay
balance and the `wyrmskull-spear-jabs` combo untouched.

## Frame-metadata schema decision

I will add one reusable, optional firing-frame reference to the normal weapon
definition/manifest metadata rather than special-case Wyrmskull in
`ArenaScene`. `SpriteRig` (or the shared held-weapon render path it delegates to)
will resolve that reference from the authoritative attack clock's existing
release-window state. Weapons without this metadata will retain their current
single-frame behavior. The open variant will reuse the base weapon's transform
and muzzle registration unless repository conventions require an explicit
same-value override.

## Plan

1. Audit the generated manifest/catalog types, held-weapon renderer, authoritative
   attack timing state, muzzle overrides, and relevant tests.
2. Register the open asset and reusable firing-frame metadata, then regenerate
   derived artifacts.
3. Implement a clock-derived frame selector and wire it into the shared
   held-weapon texture path without changing transform or muzzle calculations.
4. Add exact-boundary unit coverage for idle, release, post-release, and weapons
   without a firing frame.
5. Run generation checks, typecheck, the full test suite, and asset validation.
6. Run the game on private ephemeral ports and capture local/remote,
   left/right idle-release-return evidence under
   `docs/owner-notes-audit-v10-evidence/b13-wyrmskull/`.

## Stage log

- Initial understanding, schema direction, and verification plan recorded before
  implementation.
- Repository audit found the existing authoritative release latch:
  `attackSeq`/`attackTick` plus `ATTACK_HELD_WINDOW` (three 20 Hz ticks, 150 ms).
  The firing-frame selector therefore compares the replicated accepted attack
  tick with the replicated room tick and deliberately excludes owner prediction
  and client wall time.
- Added reusable catalog metadata (`WeaponDef.firingFrame`) and manifest
  registration metadata (`SpriteManifest.frameVariant`). The open art is a 3x
  source frame, so metadata registers its pivot at `(0.1, 0.4388888888888889)`
  and scales it by `1/3`; the closed grip maps to the same source/world point.
- Registered Wyrmskull's mouth muzzle at canonical base pixel `(200, 56)`,
  mapping to open-frame pixel `(600, 168)`. The existing `tip` emitter now makes
  this weapon's scatter originate inside the visible open mouth without changing
  damage, cadence, range, DPS, or combo metadata.
- Wired `SpriteRig` to retain closed/open texture handles, swap from the
  authoritative tick pair only, scale source muzzle points through the active
  frame registration, and restore the closed texture at the exact release
  boundary. Texture swaps preserve the already-written pose scale immediately;
  root position, rotation, actor facing, and hand mount remain shared.
- Focused verification passed: shared build, client typecheck, and 27 tests
  across the firing-frame clock, direct `SpriteRig` swap, registration/muzzle
  equivalence in both facings, and existing ranged behavior.
- Full static verification passed: `pnpm gen`, `pnpm gen:check`,
  `pnpm typecheck`, `pnpm assets:check`, and `pnpm test`. The full Vitest run
  completed with 165 files and 2,219 tests passing. The isolated worktree used
  ignored junctions to the canonical checkout's art-test fixtures and the local
  cached `pngjs` package; these are test-environment inputs, not tracked changes.
- The first live trace exposed a real release-window edge: hit-stop could skip
  `animate()` while the three authoritative ticks elapsed. Frame sampling now
  also runs when authoritative clock/beat state is ingested, so hit-stop cannot
  suppress the open frame or delay the closed return.
- A second diff review caught retained-image scale lag during that same
  animation freeze. The swap now applies the source-scale ratio directly to the
  existing image scale, preserving any current pose multiplier without waiting
  for another animation frame.
- Private-port live gate passed on client `57213` / game `57212` using
  `proto-cowboy-hidden-face`. Four accepted cycles cover local and remote,
  right and left: all idle frames closed, all release frames open, and all
  post-release frames closed. Normalized grip drift was below `4e-15 px`, muzzle
  drift was `0 px`, and displayed weapon width remained continuous.
- Evidence is indexed at
  `docs/owner-notes-audit-v10-evidence/b13-wyrmskull/`; `live-gate.json`
  contains authoritative sequence/tick, texture, transform, muzzle, registration,
  port, and screenshot records.

## Files touched

- Catalog/generation: `data/weapon-concepts-300.json`,
  `data/weapon-muzzle-overrides.json`,
  `tools/artkit/gen-weapon-expansion.mjs`,
  `tools/artkit/gen-weapon-muzzles.mjs`, and
  `tools/artkit/harvest-install.mjs`.
- Generated/shared metadata:
  `packages/shared/src/weapons-expansion.generated.ts`,
  `packages/shared/src/weapon-muzzles.generated.ts`,
  `packages/shared/src/weapons.ts`,
  `docs/sol-reports/v7-muzzle-derivation.json`, and
  `docs/sol-reports/v7-muzzle-derivation-table.md`.
- Client integration: `packages/client/src/sprites/manifest.ts`,
  `packages/client/src/sprites/firing-frame.ts`,
  `packages/client/src/entities/SpriteRig.ts`, and
  `packages/client/src/scenes/ArenaScene.ts`.
- Tests: `packages/client/src/sprites/firing-frame.test.ts`,
  `packages/client/src/entities/SpriteRig.firing-frame.test.ts`, and
  `e2e/tests/b13-wyrmskull-firing-frame.spec.ts`.
- Report/evidence: this report plus 12 PNGs, `README.md`, and `live-gate.json`
  under `docs/owner-notes-audit-v10-evidence/b13-wyrmskull/`.

verdict: two-frame firing cycle wired, registration drift-free, deterministic return, evidence path `docs/owner-notes-audit-v10-evidence/b13-wyrmskull/`, files touched: catalog/generators, generated weapon/muzzle metadata, manifest/firing-frame/SpriteRig/Arena render path, unit/live tests, this report, and 14 evidence artifacts listed above.
