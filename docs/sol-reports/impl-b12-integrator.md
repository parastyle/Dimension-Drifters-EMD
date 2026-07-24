# B12 Mirage Hardlight Saber blade-extension integration

## Understanding and decisions

- Owner request: add `x2-mirage-hardlight-saber` to the unified blade-extension technique without
  changing its damage, cadence, range, DPS, scaling, grip, size, or other weapon balance.
- Census shape: retain `BRUTALIST_GREATSWORD_IDS` as the six-member 2H greatsword family and define
  `BLADE_EXTENSION_WEAPON_IDS` as a frozen tuple containing those six IDs plus Mirage. Mirage remains
  a 1H, size-M saber; consumers that only care about brutalist greatswords do not learn about it.
- Headsman boundary: `x2-sanctified-headsman` remains absent from the extension census and treatment
  resolver. Unit coverage will pin that absence.
- Asset inspection: `packages/client/public/sprites/x2-mirage-hardlight-saber/` contains only
  `part-1.png`. The 256x34 sprite already depicts its emitter and a short cyan hardlight blade; there
  is no `part-2.png` extension asset.
- Visual approach: use the shipped `part-1.png` as the held source and add a bespoke procedural
  hardlight extension treatment rather than borrowing a brutalist material blade. The extension will
  preserve the source blade's cyan-white core language with emissive cyan edge/glow treatment, while
  the existing retained blade-extension renderer continues to derive its root, axis, width, facing,
  ignition, hold, and retraction from the shared held-blade affine.
- Geometry/authority: author Mirage with the existing `extensionAuthoring()` builder and shared
  `BLADE_EXTENSION_LENGTH_MULTIPLIER`, `BLADE_EXTENSION_OVERLAP_FRACTION`,
  `BLADE_EXTENSION_IGNITION_SECONDS`, and `BLADE_EXTENSION_RETRACTION_SECONDS`. Confirm the resulting
  1H combat-scale reach numerically and through the live gate; no weapon balance field will change.

## Plan

1. Extend the shared census and legacy hit-envelope override; add unit assertions for the exact
   seven-member census, Mirage geometry/reveal timing, 1H reach, and Headsman absence.
2. Add a distinct Mirage hardlight treatment and integrate it through the existing preload/resolver
   path without widening the brutalist-only type or family.
3. Verify `SpriteRig`'s existing hand-indexed `leadWeaponTipPose()` sample correctly measures and
   returns Mirage's final held-image affine and join width on both facings; make only a narrow
   integration adjustment if the 1H sample exposes a real defect.
4. Extend the existing blade-extension live gate fixture to all seven census members, explicitly use
   `proto-cowboy-hidden-face`, and retain local/remote right/left evidence plus authoritative visible
   reach diagnostics under
   `docs/owner-notes-audit-v10-evidence/b12-mirage-extension/`.
5. Run focused tests, generation/check, typecheck, full unit suite, asset check, formatting/lint on
   touched files, and the live gate on its private ephemeral stack. Append outcomes and evidence to
   this report after each stage, then commit the completed work on `sol/b12-integrator`.

## Stage log

- 2026-07-23: Worktree confirmed clean on `sol/b12-integrator`. Read the B12 ledger acceptance signal,
  shared hit-envelope law, treatment registry, SpriteRig blade attachment seam, existing extension
  unit coverage, and live-gate fixture. Confirmed there is no Mirage `part-2.png`; selected the
  procedural bespoke hardlight route above.
- 2026-07-23: Shared authoring implemented. `BRUTALIST_GREATSWORD_IDS` remains the original frozen
  six-member tuple; `BLADE_EXTENSION_WEAPON_IDS` is now a frozen seven-member tuple formed from the
  six brutalists plus `MIRAGE_HARDLIGHT_SABER_ID`. Mirage has a
  `LEGACY_WEAPON_HIT_ENVELOPE_OVERRIDES` entry produced by the same `extensionAuthoring()` builder.
- 2026-07-23: Client treatment implemented. The six existing image treatments retain their generated
  material sheets. Mirage resolves to a separate procedural-hardlight treatment whose runtime canvas
  paints a cyan translucent field, energized teal edge, and white-hot core/tip; it contains no hilt
  pixels and is stretched only by the retained shared extension renderer. `VfxPlayer.preloadAssets`
  materializes that texture once.
- 2026-07-23: Coverage updated. Shared tests pin the exact census, the separate brutalist family,
  Headsman absence, unchanged Mirage balance fields, and Mirage's 1H geometry (`95.7 px` physical,
  `287.1 px` full 3x blade, `2.11x` its pre-existing `136 px` base reach). SpriteRig/VfxPlayer tests
  cover the narrow 1H measured-width sample and exact blade-owned joins on both facings. The live gate
  now consumes the shared seven-member census, equips `proto-cowboy-hidden-face` locally and remotely,
  rejects ports `5180`/`2567`, and writes captures/diagnostics to the B12 v10 evidence directory.
- 2026-07-23: The 1H live sample exposed the hilt orbit offset that a 2H-only, local-axis extension
  does not need to reconcile. Mirage now preserves the exact SpriteRig-held affine and solves only the
  procedural extension's local-axis draw length against the shared authoritative radial reach. The
  fit is reveal-blended for continuous ignition and includes the existing step-2 `1.08` range
  multiplier. The six brutalist image treatments and their pose/scale paths are unchanged.
- 2026-07-23: Authority was consolidated after the live finding:
  `bladeExtensionDamageReachForReveal()` is exported by shared hit-envelope code and consumed by the
  client fit/audit path, so presentation and server damage do not maintain competing geometry laws.
  Mirage remains `grip="1H"` and `size="M"` with unchanged damage `7`, range `136`, cooldown `0.28`,
  display size `110`, and grip fraction `0.13`.
- 2026-07-23: Final verification passed: `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, full
  `pnpm test` (`163` files / `2,215` tests), `pnpm assets:check`, focused blade-extension tests
  (`24` tests), Biome, and `git diff --check`. Generation needed the worktree-local Artkit dependency
  install and ignored canonical reference fixtures; tracked generated outputs remained unchanged.
- 2026-07-23: Final private live gate passed all seven weapons in `2.4m` on ephemeral client/server
  ports `59953`/`59952`. It retained 56 facing/window PNGs and seven frame summaries over `1,973`
  blade-owned frames. All weapons covered local/remote right/left cases and combo steps 0/1/2 with
  one ignition, no relight drops, full later-hit ownership, and retraction. Mirage visible-tip versus
  authoritative-radius error was at most `3.41e-13 px`; worst all-family affine/reveal error remained
  floating-point noise. Evidence details are in the adjacent evidence README.

Verdict: Mirage added to extension census; Headsman absent; visible == authoritative; evidence: `docs/owner-notes-audit-v10-evidence/b12-mirage-extension/`; files touched: shared hit envelope, Mirage treatment/VfxPlayer/SpriteRig integration, client/shared/server/live-gate tests, B12 evidence, and this report.
