# B18 Fan Tornado Integrator Report

## Understanding

B18 extends the shipped B11 generated-image weapon-VFX catalog pattern for exactly three B3 fan weapons:

- `x2-iron-war-fan`: make the authored fan sweep visibly open and widen outward, then release the installed `vfx-tornado-iron-gale` subject from the swept edge with an iron-gale whoosh.
- `x2-ember-fan`: make the authored flame-fan sweep visibly open and widen outward, then release the installed `vfx-tornado-ember-fire` subject from the swept edge with a fire roar.
- `x2-storm-fan`: preserve the paired dual-sweep identity while making both fans visibly open outward; alternate the releasing side/beat for the installed `vfx-tornado-storm-shock` subject and punctuate it with a thunder crack.

The tornadoes are attack presentation, not independent damaging projectiles. They originate inside the existing melee sweep, travel only a short visual distance beyond the swept edge, and dissipate quickly. The existing server-authoritative damage, cadence, range, knockback, and hit-envelope numbers therefore remain unchanged, and nominal DPS remains exactly at baseline. Each single-frame tornado will read as animated through rapid rotation/flip changes, a restrained scale pulse, and alpha dissipation at combat scale.

Scope is limited to these three fan weapons, their three installed tornado sprites, the generated-image weapon-VFX catalog/runtime, their attack presentation, bespoke audio, focused tests, and B18 evidence. No B2/B3 non-fan weapon, B11/B12/B13 surface, kung-fu wrap, character, or pet behavior is included.

## Per-fan motion and tornado plan

### Iron War Fan

- Retain the existing authored combo timing and fan/dual-sweep path.
- Strengthen the opening read with a narrow-to-wide reveal across the attack phase, an outward-growing ribbon width, and a swept-edge release accent rather than moving the whole painted fan as a rigid plane.
- Spawn one compact iron-gale tornado at the active fan edge, bias it along facing plus the current sweep tangent, rotate/flip and pulse it, then fade it after a short outward travel.
- Route a bespoke layered metal-air gale cue through `AudioBus`.

### Ember Fan

- Retain all authored attack timing and gameplay constants.
- Use a hotter narrow-to-wide reveal and outward-flaring ribbon treatment so the fan opening remains readable beneath the flame palette.
- Spawn one compact ember-fire tornado at the swept edge, send it a short facing-aware distance outward, animate the single frame with spin/flip plus a light scale pulse, and dissipate it without adding a second damage source.
- Route a bespoke low fire-roar and flame-whoosh cue through `AudioBus`.

### Storm Fan

- Retain the paired fan combo and dual-sweep beats.
- Give the two sweep lanes mirrored narrow-to-wide reveals and outward-growing ribbons so the paired fans read as opening independently.
- Alternate the tornado release lane/vertical bias from one attack event to the next, while keeping one compact storm-shock tornado per attack. Animate it with rotation/flip, pulse, lightning-readable alpha flicker, short outward travel, and fast dissipation.
- Route a bespoke sharp thunder-crack and charged-air tail through `AudioBus`.

## Integration plan

1. Measure all three installed PNGs and add `weapon-vfx` manifest rows with their actual pixel dimensions.
2. Add the three fan ownership rows to `tools/artkit/weapon-vfx-overrides.json`, extend the generated schema only as needed for a fan-tornado treatment, and regenerate `packages/client/src/vfx/weapon-vfx.generated.ts`.
3. Add pure catalog/runtime recipe data for outward-reveal geometry, tornado subject, combat-scale render size, short travel, spin/pulse/dissipation, storm lane alternation, and audio cue.
4. Integrate the treatment at the existing fan combo/ribbon emission point while preserving all gameplay constants and suppressing only displaced fan presentation layers when necessary.
5. Add focused tests for per-fan catalog references, manifest/asset dimensions, outward-widening motion, visible tornado travel bounded to the non-damaging presentation contract, unchanged hit envelopes, exact nominal DPS parity, and bespoke audio routing.
6. Run generation/check, typecheck, the full unit suite, and asset checks. Then run the live gate on private ephemeral ports with `proto-cowboy-hidden-face`, exercise all three fans in both facings, and retain captures plus machine-readable observations under `docs/owner-notes-audit-v10-evidence/b18-fan-tornado/`.

## Progress

- Recorded the B18 contract and per-fan implementation plan before implementation.

## Implemented shared treatment

- Extended the B11 generated-image schema with a supplementary `fan-tornado` recipe. The closed B11 replacement catalog remains unchanged; the three B18 recipes deliberately retain the procedural fan ribbon and shipped B3 hybrid projectile.
- Added a shared folded-to-open smoothstep consumed by both held fan length and retained ribbon width. All nine authored fan combo steps now carry explicit opening endpoints; Iron and Ember use `fan` paths, while Storm retains `dual-sweep`.
- Added a pure swept-edge release plan. Each vortex begins overlapping the authoritative melee reach, travels only 40–50 px, owns `damageMode: "presentation-only"`, and dissipates through rotation, alternating flips, scale pulse, and alpha fade.
- Added direct-load `weapon-vfx` manifest handling to both the atlas packer and asset checker so the large source PNGs are validated loose without inflating the boot atlas.
- Added three synthesized `AudioBus` cues: `b18:iron-gale-whoosh`, `b18:ember-fire-roar`, and `b18:storm-thunder-crack`.
- Left `packages/shared/src/hit-envelope.ts` unchanged. The tornadoes own no damage extent, all original melee/hybrid damage sources remain authoritative, and all three nominal totals remain 20 DPS.

## Iron War Fan result

- Installed `vfx-tornado-iron-gale` at its native 839×1380 dimensions and renders it at 44×72 combat size.
- Its three combo ribbons open from 0.24/0.20/0.16 to 1.04/1.08/1.12, and its formerly generic sweep rows now declare the intended fan path without changing any numeric combat field.
- The iron gale releases at 76% of the active sweep, travels 42 px, and uses the layered metal-air whoosh.
- Both-facing live captures show the opened metal fan and compact silver vortex moving away from the wielder.

## Ember Fan result

- Installed `vfx-tornado-ember-fire` at its native 468×768 dimensions and renders it at 46×76 combat size.
- Its three fan ribbons open from 0.20/0.16/0.12 to 1.08/1.12/1.18, preserving the shipped timing, damage, range, and hybrid fire roll.
- The ember vortex releases at 78% of the active sweep, travels 46 px, and uses the layered flame roar.
- Both-facing live captures show the flame fan opening around a distinct orange fire vortex.

## Storm Fan result

- Installed `vfx-tornado-storm-shock` at its native 901×1444 dimensions and renders it at 48×76 combat size.
- Its paired dual-sweep ribbons open from 0.22/0.16/0.12 to 1.06/1.10/1.16; the retained suite resolves to `twin-slash`.
- The storm vortex releases at 74% of the active sweep, travels 48 px, and uses the sharp thunder crack plus charged tail.
- The pure release contract alternates `lead` and `off` lanes by combo-step parity. Both-facing live captures validate legal paired lanes and show both fans opening around the blue shock vortex.

## Tests and evidence

- `tests/b18-fan-tornado.test.ts` locks the three catalog references, real PNG dimensions, direct-load asset policy, all nine fan-opening curves, short swept-edge travel, Storm lane alternation, unchanged envelopes, exact 20 DPS totals, bespoke cues, and spin/flip/pulse runtime.
- `e2e/tests/b18-fan-tornado-live-gate.spec.ts` uses the real Arena client plus Colyseus server on ephemeral ports, equips `proto-cowboy-hidden-face`, fires all three fans in both facings, and retains six screenshots plus `live-gate.json`.
- Final retained live gate: client `61753`, game `61752`; protected ports `5180` and `2567` were unused. All live assertions passed, including three subjects, both-facing outward travel, >3× folded-to-open rig spread, presentation-only envelope overlap, and paired Storm release lanes.
- Visual review confirms each screenshot contains the correct opened fan art and distinct compact elemental tornado without screen clutter.
- Evidence: `docs/owner-notes-audit-v10-evidence/b18-fan-tornado/`.

## Verification

- `pnpm gen` — passed. The unavailable gitignored ArtKit reference cache caused the non-check VFX-subject generator to emit an unrelated empty scratch result; the tracked subject queue was restored unchanged.
- `pnpm gen:check` — passed; its documented fresh-worktree VFX-subject check skipped because 338 gitignored references are unavailable.
- `pnpm typecheck` — passed.
- `pnpm test` — passed after mirroring the three gitignored test fixtures from the primary worktree: 164 files, 2222 tests.
- `pnpm assets:check` — passed: 477 sprite entries, 1006 parts, 3 direct-loaded weapon-VFX parts, 635 atlas frames, and 9 weapon-VFX URLs.
- Private-port Playwright live gate — passed: 1 test, 6 retained facing captures.

verdict: 3 fans fanning outward, 3 elemental tornadoes live, DPS within band (20 each), envelope aligned (presentation-only overlap; no hit-envelope change), evidence path `docs/owner-notes-audit-v10-evidence/b18-fan-tornado/`, files touched: `data/weapon-concepts-300.json`; `packages/client/src/{audio/AudioBus.ts,entities/SpriteRig.ts,sprites/manifest.ts,vfx/VfxPlayer.ts,vfx/generated-image-weapon-vfx-recipes.ts,vfx/generated-image-weapon-vfx.ts,vfx/vfx-render.js,vfx/weapon-vfx-suite.ts,vfx/weapon-vfx.generated.ts}`; `packages/shared/src/{melee.ts,weapons-expansion.generated.ts}`; `tools/artkit/{build-weapon-vfx.mjs,check-assets.mjs,gen-weapon-expansion.mjs,pack-atlas.mjs,weapon-vfx-overrides.json}`; `tests/b18-fan-tornado.test.ts`; `e2e/tests/b18-fan-tornado-live-gate.spec.ts`; this report; and the B18 evidence directory.
