# B11 VFX Integrator Report

## Understanding

B11 replaces, rather than layers onto, the existing procedural weapon effects for exactly three owner weapons:

- `x2-dustreaper-zweihander`: use the installed fire-dragon image as a bespoke swing sweep. The dragon must travel with its head at the leading edge, the authoritative damage reach must agree with the visible damaging dragon, and the attack needs a distinct low roar/fire-whoosh.
- `x2-mesa-heart-geodes`: use the installed purple-crystal-family image for dense, aim-controlled crystal bursts and fragments. The treatment must not resolve to simple circles, its authoritative fragment radius must agree with the visible damaging cluster, and the attack needs a distinct glass-crack/hum.
- `x-staff-arcane-lance`: replace the procedural staff projectile with the installed runic lance image while preserving the existing shot cadence and projectile count. The projectile hit envelope must terminate at the visible lance tip.

This is a visual integration only: damage, cadence, range, projectile count, and DPS remain unchanged. The displaced procedural layers must not fire beneath the generated-image subjects, and no B2, B3, B14, whole-art character, or pet scope is included.

## Replacement plan

1. Read the shipped B2 catalog/recipe/generator integration and the complete B11 v9 ledger acceptance, then trace the current three weapon recipes, runtime emitters, SFX hooks, and shared hit envelopes.
2. Add three distinct generated-image recipe subjects to the existing catalog/generation pattern and make each weapon ID resolve authoritatively to its subject with no procedural fallback.
3. Replace each old effect at its emission point: a facing-aware animated dragon sweep, pooled/scattered crystal-family bursts, and the existing-cadence/count lance projectile with image-aligned tip handling.
4. Update only the shared visual hit-envelope metadata required for the dragon reach and crystal fragment radius, keeping gameplay balance constants unchanged.
5. Extend catalog, generation, VFX, asset, and hit-envelope tests; run generation/check, typecheck, full tests, and asset checks.
6. Run the live acceptance gate on private ephemeral ports with `proto-cowboy-hidden-face`, both facings and all three weapons, retaining captures and observations under `docs/owner-notes-audit-v10-evidence/b11-vfx/`.

## Progress

- Initial contract and per-weapon replacement plan recorded before implementation.

## Dustreaper Zweihander

- Added the authoritative `fire-dragon-sweep` generated-image recipe for `vfx-fire-dragon`, with an empty VFX suite and `suppressFallback: true`.
- Preloads and renders the installed 768×276 serpentine dragon from the wielder root through the accepted swing arc. The image’s rightmost dragon head is the leading edge in both facings.
- Removed `dustreaper-continuous-edge` from weapon source data, generated weapon data, the recipe catalog, and the recipe type/generator allowlist. The displaced 150 `fire-wisp` treatment no longer resolves or emits.
- Added a bespoke low roar plus layered fire-whoosh cue, `b11:fire-dragon-sweep`.
- Authored one shared 300×108 damage/visual contract: 300 forward extent and 54 half-width. The image reads those exact values from `meleeDamageEnvelopeFor`, so the rendered dragon and authoritative envelope cannot drift independently.

## Mesa-Heart Geodes

- Added the authoritative `purple-crystal-burst` generated-image recipe for `vfx-purple-crystal-family`, with an empty VFX suite and `suppressFallback: true`.
- Replaced the generic caster source and procedural chain graphics with six pooled, non-circular image-family clusters distributed along the accepted sweep and concentrated around the clamped aim/target projection. Chain contacts use smaller image-family bursts at their authoritative nodes.
- The generated-image ownership check makes `resolveCasterVfxRecipe` return no procedural caster recipe for Mesa, and the chain renderer returns before allocating its former `Phaser.Graphics` bolt.
- Added the bespoke high glass crack plus two-tone crystalline hum cue, `b11:crystal-crack-hum`.
- Authored a 58-pixel shared fragment half-width while preserving the existing 360 range. The visible pooled centers and fragment radii are clamped inside that same authoritative envelope.

## Arcanist's Lance

- Added the authoritative `arcane-lance-projectile` generated-image recipe for `vfx-arcanist-lance`, with an empty VFX suite and `suppressFallback: true`.
- Replaced the caster orb/trail/impact route with the complete runic-lance image on each replicated authoritative projectile. The old caster resolver deliberately returns no recipe for this weapon, generic muzzle/projectile/impact layers are suppressed, and the image treatment owns its small image-derived death punctuation.
- Preserved the existing cast values unchanged: 0.62-second cast cooldown, 16 combined damage, 620 speed, 720 projectile range, and three projectiles at 0.16 spread.
- Added `b11:arcane-lance-cast` source punctuation.
- Authored a 17-radius, 55-half-length cast capsule. The displayed 144×34 lance therefore has a 72-pixel visible tip extent, exactly equal to the authoritative `55 + 17` capsule tip.

## Catalog, integration, and regression coverage

- Extended the generated weapon-VFX schema with a typed generated-image treatment and generated all three override rows from `tools/artkit/weapon-vfx-overrides.json`.
- Added a pure three-entry generated-image catalog for ownership, subject, audio, and envelope geometry, plus the Phaser runtime for melee sweeps, chain bursts, projectiles, and impacts.
- `VfxPlayer` preloads each generated-image URL; `ArenaScene` dispatches image-owned effects before procedural paths and stops after a successful replacement.
- Updated the asset checker to recognize both TypeScript and JSON-quoted asset property keys, so `assets:check` now validates the generated-image URLs in `weapon-vfx.generated.ts`.
- Added B11 catalog/asset/alpha/non-circle/envelope/balance/audio tests and migrated the older Dustreaper tests and V6 live probe from the deliberately removed wisp contract to the dragon ownership contract.

## Verification

- `pnpm gen`: passed; generated weapon expansion and weapon-VFX catalog updated.
- `pnpm gen:check`: passed; generated outputs are synchronized.
- `pnpm typecheck`: passed for shared, server, and client.
- `pnpm test`: passed, 163 files / 2,210 tests.
- `pnpm assets:check`: passed, including all 6 weapon-VFX catalog URLs (the three B11 image URLs among them).
- Focused B11/owner/envelope/caster tests: passed.
- Private live gate: passed on client `58769` and game server `58768`; protected ports `5180` and `2567` were not used.
- Live subject: `proto-cowboy-hidden-face`.
- Captures: all three weapons fired right and left. The audit records each generated subject, empty `proceduralLayers`, no old V6 recipe events, unchanged Arcanist three-projectile volleys, and equal visual/damage extents.
- Evidence: `docs/owner-notes-audit-v10-evidence/b11-vfx/` contains six PNG captures and `live-gate.json`.

## Files touched

- Catalog/generation: `tools/artkit/weapon-vfx-overrides.json`, `tools/artkit/build-weapon-vfx.mjs`, `packages/client/src/vfx/weapon-vfx.generated.ts`.
- Image recipes/runtime: `packages/client/src/vfx/generated-image-weapon-vfx-recipes.ts`, `packages/client/src/vfx/generated-image-weapon-vfx.ts`, `packages/client/src/vfx/VfxPlayer.ts`, `packages/client/src/vfx/caster-vfx-recipes.ts`, `packages/client/src/vfx/weapon-effect-recipes.ts`.
- Runtime/audio: `packages/client/src/scenes/ArenaScene.ts`, `packages/client/src/audio/AudioBus.ts`.
- Authority/data: `packages/shared/src/hit-envelope.ts`, `packages/shared/src/weapons.ts`, `data/weapon-concepts-300.json`, `tools/artkit/gen-weapon-expansion.mjs`, `packages/shared/src/weapons-expansion.generated.ts`.
- Gates/probes: `tools/artkit/check-assets.mjs`, `tools/v6g-impact-anchor-live-probe.mjs`, `e2e/tests/b11-vfx-live-gate.spec.ts`.
- Tests: `tests/b11-generated-image-vfx.test.ts`, caster, owner-note, V6G, V7 hit-envelope, W4G, and W4M regression suites.
- Evidence/report: `docs/owner-notes-audit-v10-evidence/b11-vfx/`, `docs/sol-reports/impl-b11-integrator.md`.

VERDICT: 3 replaced, old procedural absent, hit-envelope aligned, evidence path `docs/owner-notes-audit-v10-evidence/b11-vfx/`, files touched recorded above.
