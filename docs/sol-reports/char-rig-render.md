# Sol report: whole-art character rig rendering

## Initial understanding and plan

The three whole-art prototype characters already have six authored PNG parts and matching manifest
geometry, but Phaser never loads those PNGs. `ArenaScene` can select the character id as the rig target,
yet the current rig texture resolver only has the wardrobe `boilerplate`/gear-bake path available and
therefore paints the boilerplate art.

Loader path discovery is in progress. The first inspection targets are
`packages/client/src/sprites/gear-parts.ts`, `gear-texture-baker.ts`, the scene preload flow, and
`SpriteRig`'s per-part texture resolution.

Plan:

1. Trace how the six boilerplate parts enter Phaser's texture manager and how `SpriteRig` resolves each
   part's texture and manifest offsets.
2. Add an on-demand whole-art loader keyed by manifest-backed character entries, with a ready barrier so
   rigs are not built against fallback art.
3. Route all six rig display objects to the character textures while preserving the existing floating
   head motion and leaving the wardrobe/gear path unchanged.
4. Run generation/assets checks if applicable, typecheck, and the full test suite.
5. Boot the real stack on private ephemeral ports and retain per-character texture-manager proof,
   rig-part texture-key proof, and in-game/bob-frame captures under
   `docs/owner-notes-audit-v8-evidence/char-rig-render/`.

## Loader and overwrite path found

- `MenuScene.preload()` loads the canonical six wardrobe base files using
  `boilerplate:<part>` keys. `ensureBoilerplateTextures()` in `sprites/gear-parts.ts` provides the same
  load-on-demand path, and `SpriteRig.installBoilerplateIfReady()` atomically retargets its retained
  body/head/hands/feet once all six are present.
- Ordinary manifest parts resolve through `partTexture()`: it prefers the shared `dd-sprites` multiatlas
  frame `<sprite-id>/<role>` and otherwise returns the old loose `<sprite-id>:<role>` key. The three
  prototype frames are present in the atlas, which explains why filtering top-level TextureManager keys
  for their names returned nothing.
- The decisive overwrite was in `ArenaScene.syncBlobs()`. Although `addBlob()` omitted gear for a
  `proto-*` rig, every later sync frame still called `equipSyncedGear()` unconditionally. That installed
  the boilerplate and then replaced all six retained nodes with `gear-bake:*` textures.

## Implementation

- Added an explicit whole-art id registry validated against `kind: "character"` plus all six required
  manifest roles. The current generated manifest has no render-mode bit and legacy Drifter/cc-* wardrobe
  scaffolds also contain six parts, so treating every six-part character as whole-art would break the
  required legacy path. Future whole-art ids have one clear registry seam instead of scattered prefix checks.
- Added a six-file on-demand loader with stable `char:<id>:<role>` keys and per-TextureManager
  pending/failure bookkeeping.
- `ArenaScene.addBlob()` now waits until all six textures are ready before constructing a whole-art rig.
  `syncBlobs()` naturally retries each frame, so no reload is needed and no boilerplate rig is flashed.
- `partTexture()` prefers the inspectable `char:*` loose key when loaded. Whole-art rigs remain on their
  manifest `ox`/`oy` geometry and the existing character-owned floating-head spring.
- `syncBlobs()` now rebuilds before crossing into or out of whole-art mode and never invokes
  `equipSyncedGear()` for a whole-art rig. The legacy wardrobe path is unchanged for non-whole-art
  characters.

## Focused verification

- Added loader-contract coverage for the three registered prototypes, the six exact texture keys/URLs,
  ready-barrier behavior, and explicit proof that Drifter/cc-* remain outside whole-art mode.
- Added `SpriteRig` coverage for all three prototypes. Each assertion inspects the retained
  body/head/hand-l/hand-r/foot-l/foot-r nodes and requires the six `char:<id>:<role>` texture keys; it
  also drives the existing floating-head spring and confirms bounded bob motion.
- Focused Vitest result after the Arena render-mode regression additions: 3 files passed, 26 tests
  passed.
- Root `pnpm typecheck`: passed after building `@dd/shared`.
- All touched sources and evidence/report files are LF-only.

## Full-suite and live-stack status

- `pnpm test` was run in full. Character-render tests passed, and the final run reached 1793 passing tests.
  The checkout initially lacked `tools/artkit/node_modules`; installing the locked ArtKit dependencies
  cleared five unrelated asset-suite failures. Three unrelated baseline checks remain:
  `gen-weapon-muzzles.mjs --check` reports stale generated muzzle data,
  `tools/artkit/out/orientation/weapon-axis-report.json` is absent, and
  `tools/artkit/out/dust-ranger/candidate-1.keyed.png` is absent. These ignored/generated weapon outputs
  were not changed as part of the character-rig fix.
- The real server and Vite client booted successfully on private ports 60417 and 60418. Neither owner
  port 2567 nor 5180 was used.
- Live browser capture is currently blocked by the browser-control environment: after the required
  browser setup and prescribed discovery recovery, the available-browser list is empty. The browser
  workflow explicitly forbids substituting an unrelated automation backend, so no screenshot or
  TextureManager claim is being fabricated. Live JSON/canvas captures remain outstanding until that
  browser surface is available.
- Updated the retained `e2e/tests/char-proto.spec.ts` gate to remove its old manual gear-field blanking
  workaround. It now keeps synced wardrobe fields populated, waits for six live `char:*` TextureManager
  keys, requires the six rig nodes to use them with zero gear attachments, rejects every `gear-bake:*`
  key, and writes the requested per-character JSON/rest/bob artifacts to
  `docs/owner-notes-audit-v8-evidence/char-rig-render/`. The spec typechecks after the real server build.
- Added direct `ArenaScene.syncBlobs()` regression coverage: each prototype skips `equipSyncedGear()`,
  Drifter still calls it, and a legacy-to-whole-art transition rebuilds before any wardrobe write.

## Files touched and retained proof

- Runtime: `packages/client/src/sprites/whole-art-character.ts`,
  `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/scenes/ArenaScene.ts`.
- Unit regression coverage: `packages/client/src/sprites/whole-art-character.test.ts`,
  `packages/client/src/entities/SpriteRig.boilerplate.test.ts`,
  `packages/client/src/scenes/ArenaScene.dualwield.test.ts`.
- Live regression/capture harness: `e2e/tests/char-proto.spec.ts`.
- Durable reporting/evidence status: this report and
  `docs/owner-notes-audit-v8-evidence/char-rig-render/README.md`.
- Per-character automated rig proof passed for `proto-sheriff`, `proto-samurai`, and `proto-witch`:
  each retained node set is exactly `char:<id>:{body,head,hand-l,hand-r,foot-l,foot-r}`, contains no
  gear attachment, and retains bounded floating-head bob motion.
- Intended live capture paths are
  `docs/owner-notes-audit-v8-evidence/char-rig-render/<id>-capture.json`,
  `<id>-rest.png`, and `<id>-bob.png`. They are not present because no browser was available to the
  required capture surface.

Verdict — the six-part load + render path is built and direct rig tests prove all three prototypes use their own six `char:*` textures with floating heads while Drifter gear remains unchanged; the exact live TextureManager/rig proof and nine capture files remain the one follow-up blocked by the unavailable browser session, with the retained gate ready to write them under `docs/owner-notes-audit-v8-evidence/char-rig-render/`.
