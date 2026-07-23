# B1 — Screen-true damage numbers and projectile facing

## Initial understanding and plan

- Owner note: damage numbers must remain screen-upright on hits even after the real world, camera, and container transforms are applied.
- Directional projectile art must retain its authored upright axis. Left/right travel should use horizontal facing or mirroring instead of rotating asymmetric art through π.
- Scope is client rendering only. The weapon catalog is explicitly out of scope.
- The holy skull and every projectile marked asymmetric in the projectile manifest must be audited.
- The real transform chain is pending repository trace. I will record its concrete stages here as soon as it is identified, then verify screen-space text baselines, sprite top orientation for left/right holy skull shots, and unchanged projectile velocity through the live stack.

Plan:

1. Read the authoritative B1 ledger section and repository guidance.
2. Trace projectile and damage-number rendering through the actual world/camera/container hierarchy.
3. Audit asymmetric projectile manifest entries and implement a client-only facing policy.
4. Add or extend regression coverage without weakening existing assertions.
5. Run generation checks if applicable, typecheck, the full test suite, and a real-stack transform-chain proof on private ephemeral ports.
6. Retain evidence under `docs/owner-notes-audit-v9-evidence/b1-facing/`, append findings throughout, and commit on `sol/b1-facing`.

## Transform-chain trace

The prior `2b4ea1f` fix only changed a top-level glyph from `setScale(scale)` to
`setScale(screenTrueScaleX(1, 1, scale), abs(scale))`. Both parent scale arguments were constants, so
the live matrix was unchanged. Its regression asserted only a synthetic positive scale determinant and
explicitly required `parentContainer === null`; it never exercised the camera or a container.

The runtime chain now traced is:

1. An authoritative damage event supplies a world hit point; anchored accumulators resolve the current
   target world point in `ArenaScene`.
2. `DamageNumberRenderer` converts that point into main-camera-relative coordinates using the live
   `scrollX`/`scrollY`.
3. A dedicated depth-sorted Phaser container with scroll factor zero retains every pooled bitmap glyph.
4. Phaser applies the real main-camera zoom/rotation to that overlay during rendering; each glyph
   counter-rotates the live camera rotation and counter-reflects any camera determinant.
5. The canvas DPR presentation remains the final positive CSS/display transform.

This makes the hit position follow camera pan/zoom while the screen-space baseline remains left-to-right
and upright. The revised transform regression starts with a local hit socket inside rotated, nonuniform,
reflected nested source containers, then checks the actual renderer-owned overlay/camera/glyph chain.

## Projectile audit and implementation

The generated projectile manifest previously carried dimensions and provenance only. The factory applied
`atan2(vy, vx)` directly to every generated image, so a horizontal left shot rotated side-profile art by
pi. The audit contact sheet is retained at
`docs/owner-notes-audit-v9-evidence/b1-facing/projectile-manifest-audit-contact-sheet.png`.

The generator now records both an explicit `asymmetric` flag and a facing mode. Twenty-two directional
side-profile sprites with a meaningful authored top use `mirror-upright`; the spinning Coyote's Grin
throwing blade and the rotational Thunderhead smoke ring remain `rotate`. For mirrored art, right travel
uses the authored image and left travel uses negative X scale plus the heading with the half-turn removed.
The forward axis therefore still exactly matches authoritative velocity, while residual art rotation
never exceeds a quarter turn.

## Live transform-chain proof

`e2e/tests/b1-facing-live-gate.spec.ts` boots production Colyseus and source-serving Vite on private
ephemeral ports. It re-enters the real dev-equip flow for each one-round Saintskull shot, drives the real
client input aim, and inspects both the authoritative projectile row and the painted image's complete
world/camera matrix.

The retained passing capture at
`docs/owner-notes-audit-v9-evidence/b1-facing/b1-facing-live-capture.json` records:

- right skull: velocity `(560, 0)`, art rotation `0`, positive X scale, forward/velocity dot `1`, screen
  top `(0, -1)`;
- left skull: velocity `(-560, 0)`, art rotation `0`, negative X scale, forward/velocity dot `1`, screen
  top `(0, -1)`;
- damage source: determinant `-0.9875` after the real reflected/rotated/nonuniform nested containers;
- camera: nonzero pan, `1.35` zoom, and `0.22` rad rotation;
- damage glyph: normalized screen baseline `(1, ~0)`, positive screen determinant, scroll-free root, and
  a normal `7.67 px` presentation rise/drift from the source point.

Visual evidence:

- `holy-skull-right.png`
- `holy-skull-left.png`
- `damage-number-transform.png`
- `projectile-manifest-audit-contact-sheet.png`

The focused live gate passes with no browser console errors or page errors.

## Validation

- `pnpm gen`: PASS; regenerated the projectile manifest from the changed generator.
- `pnpm gen:check`: PASS; all generated outputs current, 24 projectile sprites installed.
- `pnpm assets:check`: PASS; 426 sprite entries, 781 parts, 24 projectile URLs, and 96 particle
  URLs validated. The checker retained its informational skips for unavailable ignored weapon-reference
  and sprite-part artifacts.
- `pnpm typecheck`: PASS across shared, client, and server.
- `pnpm test`: PASS, 139 files and 1,804 tests.
- Touched-file Biome check and `git diff --check`: PASS. Existing non-null assertions in the damage
  number pool remain warnings only.
- LF/UTF-8 byte audit: PASS for every changed or added text artifact.
- Real-stack Playwright gate: PASS, one test in 26 seconds on private ephemeral server/client ports
  `51114`/`51115`; owner ports `2567`/`5180` were not used.

## Files touched

- `packages/client/src/ui/damage-numbers.ts`
- `packages/client/src/ui/damage-numbers.transform.test.ts`
- `packages/client/src/scenes/arena/projectile-factory.ts`
- `packages/client/src/scenes/arena/projectile-facing.ts`
- `packages/client/src/scenes/arena/projectile-facing.test.ts`
- `packages/client/src/sprites/projectile-manifest.ts`
- `tools/artkit/gen-w4r-projectiles.mjs`
- `e2e/tests/b1-facing-live-gate.spec.ts`
- `docs/owner-notes-audit-v9-evidence/b1-facing/` (capture JSON, right/left skull screenshots,
  transformed damage-number screenshot, and manifest audit contact sheet)
- `docs/sol-reports/impl-b1-facing.md`

Verdict: PASS — B1 owner note resolved: damage numbers now remain screen-upright through the real nested-world/main-camera/scroll-free-overlay chain; Saintskull and all 22 asymmetric manifest projectiles preserve authored top via horizontal mirroring while authoritative velocity remains unchanged; evidence is retained under `docs/owner-notes-audit-v9-evidence/b1-facing/`; files touched are the client renderer/factory/facing helper, their tests, generated projectile manifest and generator, live gate, evidence, and this report; weapon catalog untouched; follow-ups: none.
