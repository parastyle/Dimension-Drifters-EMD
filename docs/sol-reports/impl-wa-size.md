# Implementation Report — `whole-art-size`

## Implementation notes

- The whole-art visual-envelope correction will be computed in the client-only whole-art character module and composed into `SpriteRig` at the existing rig-scale application point.
- Legacy Drifter/boilerplate rigs will retain a multiplier of `1`; shared `characterScale`, collision, reach, and server/authority geometry will remain unchanged.
- The deterministic derivation will compare each whole-art rig's full static rendered part-height envelope with the retained Drifter reference envelope, with tests covering every whole-art id and construction of all six part textures plus the head mount.

## Implemented

- `whole-art-character.ts` now sources candidates from the shared playable roster's `proto-*` subset instead of maintaining a second handwritten membership list. The existing six-role manifest qualification remains the asset/render-mode guard.
- `characterStaticEnvelopeHeight` measures `max(part.oy + part.h / 2) - min(part.oy - part.h / 2)`, normalized by authored body height. At SpriteRig's existing 76px body target, the measured envelopes are:
  - Drifter reference: `328.58 / 168 * 76 = 148.643333px`
  - Samurai: `380.12 / 168 * 76 = 171.959048px`
  - Sheriff: `436.90 / 168 * 76 = 197.645238px`
  - Witch: `426.15 / 168 * 76 = 192.782143px`
- The scale law is `Drifter envelope / whole-art envelope * bounded art-direction fraction`. Fractions `0.980`, `0.970`, and `0.958` compensate for the prototypes' broad authored head silhouettes while remaining bounded to `[0.95, 1]`. The resulting root multipliers are Samurai `0.847123014`, Sheriff `0.729509270`, and Witch `0.738659251`; corrected static heights are `145.670467px`, `144.184033px`, and `142.400313px`.
- `SpriteRig` retains the caller's ordinary rig scale separately and applies `callerRigScale * visualEnvelopeScale` as the one final root/base scale. Existing weapon counter-scaling, WYSIWYG aura sizing, animation/pose math, the local-player marker, ground shadow, and child VFX therefore consume the same composed transform. No shared/server scaling or authority geometry changed.

## Deterministic verification

- `packages/client/src/sprites/whole-art-character.test.ts` proves the client candidates match the shared `proto-*` roster subset, every qualified whole-art id receives a bounded non-`1` correction near the audited target, corrected envelopes remain within the bounded Drifter reference fraction, and Drifter/legacy/boilerplate ids return `1`.
- `packages/client/src/entities/SpriteRig.boilerplate.test.ts` constructs each whole-art rig from all six character-owned textures, preserves the authored floating-head mount and spring, asserts every body/head/hand/foot remains parented to the same root, measures the sheriff at exactly `0.970` of the constructed Drifter static envelope, proves Drifter and retained boilerplate roots start at `1`, and proves a caller scale composes multiplicatively with the sheriff correction.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, `146` test files and `1846` tests.
- Per instruction, no live-stack boot or live visual gate was run.

Verdict: Samurai=`0.847123014`, Sheriff=`0.729509270`, Witch=`0.738659251`; reference math=`(328.58/168*76) / (character full-part-height/168*76) * bounded fraction`, giving Drifter `148.643333px` and sheriff `144.184033px`; `packages/client/src/sprites/whole-art-character.test.ts` proves bounded non-1 corrections/reference math/legacy `1`, while `packages/client/src/entities/SpriteRig.boilerplate.test.ts` proves constructed sheriff-to-Drifter height, all six textures plus head mount, coherent caller-scale composition, legacy Drifter/boilerplate scale `1`, and that no body, head, hand, or foot detaches.
