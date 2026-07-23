# Character Prototype Installation Report

## Understanding

Install the owner's three authored green-chroma prototype characters without regenerating, recoloring, or restyling them:

- `proto-sheriff`
- `proto-samurai`
- `proto-witch`

Each source image must be keyed with the repository's existing soft-matte/despill pipeline, sliced through the existing six-part slicer, normalized to the roster's 76 px body unit, registered with a `head` part, added to the selectable character roster, and exercised with the existing floating-head spring rig.

## Plan

1. Trace and reuse the existing head-split chroma-key, slicer, normalization, manifest, roster, and floating-head rig paths.
2. Key and slice each authored source while preserving its six-part relative layout and recording any classification assumptions.
3. Install the six PNG parts per character, update the canonical manifest/roster sources, and run the repository generators.
4. Verify generated assets, types, server character census, and the full test suite.
5. Launch an isolated ephemeral game stack on ports other than 5180/2567, capture assembled and bob frames for all three characters, and audit transparency, part placement, scale, and head overlap.

## Progress

- Report initialized before implementation, as required.
- Reused the existing soft-matte/despill algorithm in `tools/artkit/guards/chroma-key.mjs` unchanged. Removed background coverage was 87.5% for sheriff, 86.3% for samurai, and 86.4% for witch.
- Reused `tools/artkit/guards/slice.mjs` for connected-component slicing. The first pass exposed that the sheriff and witch authored heads are larger islands than their torsos, so the slicer's body classifier was corrected to honor its documented largest-central-body rule when a substantial, center-aligned torso sits below a large detached head.
- Confirmed six classified source parts for every prototype:
  - Sheriff: body `302x271`, head `490x322`, hands `100x130` / `97x128`, feet `154x113` / `150x112`.
  - Samurai: body `344x350`, head `336x337`, hands `113x139` / `104x138`, feet `159x108` / `161x106`.
  - Witch: body `342x292`, head `474x355`, hands `106x141` / `105x141`, feet `140x101` / `143x99`.
- Installed all three through `tools/artkit/harvest-install.mjs`. The canonical presizer normalized every shipped body texture to `168px`, which the runtime's `TARGET_BODY_H = 76` renders at the same 76 px body unit as the existing roster.
- Added opt-in `--in-place` / `--preview=0` plumbing to the existing keyer and `--post-key=1` to the existing installer. This reruns the same repository keyer after Lanczos normalization so resize-created, low-alpha green samples are removed instead of creating a second keying implementation. Default ArtKit behavior is unchanged.
- Audited every nontransparent pixel in all 18 installed part PNGs after normalization. Sheriff has 78,578 visible pixels, samurai 52,168, and witch 74,122; all three report `exactKey=0`, `keyable=0`, and `greenDominant=0`.
- Added installed `proto-*` entries to the canonical character-roster generator. All three use the neutral Drifter prototype kit (`2/2/2/2/2`, `unwritten`) so this visual prototype addition does not invent new gameplay identity.
- Excluded `proto-*` from the roster's optional thin-silhouette presentation bump. All three therefore retain the exact canonical `1.0x` render scale after the shared 76 px body-height normalization; no prototype-specific scale override is emitted.
- Registered the three IDs in the required character-lineage census as non-gating `bruiser` prototypes. The generated roster now contains 43 selectable characters: Drifter, 39 `cc-*` characters, and the 3 prototypes.
- Generated `kind: "character"` manifest entries with `body`, `head`, `hand-l`, `hand-r`, `foot-l`, and `foot-r` for every prototype. Authored offsets were retained; no production `SpriteRig` change was needed because character-owned `head` parts already enter the existing `FLOATING_HEAD_SPRING_TUNING` path.

## Verification

- `pnpm gen`: passed.
- `pnpm gen:check`: passed. The only notices were pre-existing fresh-worktree skips for untracked reference art.
- `pnpm assets:check`: passed with 425 manifest entries, 780 parts, and 431 atlas frames.
- `pnpm typecheck`: passed for shared, client, and server.
- Full `pnpm test` was run repeatedly to separate intermittent room-timing noise. The settled JSON run passed 1,768 of 1,770 tests. The two remaining failures are outside this change: a source-text formatting assertion in `flourish-implementation-panel.test.ts`, and `weaponsmith-preview-actors.test.ts` expecting the absent untracked file `tools/artkit/out/art/dust-ranger/candidate-1.keyed.png`. Character, manifest, asset, and floating-head tests pass.
- `pnpm e2e -- e2e/tests/char-proto.spec.ts`: passed 3 of 3 on an ephemeral Colyseus server (`54606`) and ephemeral Vite origin (`54607`); neither owner port 5180 nor 2567 was targeted.
- The live probes confirmed each selected ID, all six atlas frames, five generic rig parts (body plus four limbs), a separate manifest head, two hands, two feet, a canonical-scale body in the 70–80 px idle-squash range, and a live head above the body. Rest/max head gaps were sheriff `2.936/2.863px`, samurai `1.096/1.034px`, and witch `4.848/5.529px`; observed stationary bob ranges were `7.619px`, `6.710px`, and `6.806px`, respectively.
- Visual inspection of the retained rest and bob PNGs confirms complete silhouettes, transparent keyed edges without green fringe, authored placement, roster-scale bodies, and no decapitated head gap:
  - Sheriff: `docs/owner-notes-audit-v8-evidence/char-proto/proto-sheriff-rest.png`, `docs/owner-notes-audit-v8-evidence/char-proto/proto-sheriff-bob.png`, plus `proto-sheriff-capture.json`.
  - Samurai: `docs/owner-notes-audit-v8-evidence/char-proto/proto-samurai-rest.png`, `docs/owner-notes-audit-v8-evidence/char-proto/proto-samurai-bob.png`, plus `proto-samurai-capture.json`.
  - Witch: `docs/owner-notes-audit-v8-evidence/char-proto/proto-witch-rest.png`, `docs/owner-notes-audit-v8-evidence/char-proto/proto-witch-bob.png`, plus `proto-witch-capture.json`.
- Classification assumption: sheriff and witch have top detached head islands larger than their torsos, so the substantial center-aligned component immediately below each head was classified as the body. Samurai naturally selected its largest central torso. Left/right hands and feet follow authored image-space centroids.

Verdict — the 3 prototypes are installed and selectable: `proto-sheriff` = body/head/hand-l/hand-r/foot-l/foot-r, green removal confirmed, captures at `docs/owner-notes-audit-v8-evidence/char-proto/proto-sheriff-{rest,bob}.png`; `proto-samurai` = body/head/hand-l/hand-r/foot-l/foot-r, green removal confirmed, captures at `docs/owner-notes-audit-v8-evidence/char-proto/proto-samurai-{rest,bob}.png`; `proto-witch` = body/head/hand-l/hand-r/foot-l/foot-r, green removal confirmed, captures at `docs/owner-notes-audit-v8-evidence/char-proto/proto-witch-{rest,bob}.png`; classification assumption: the sheriff and witch heads are the largest top islands, so their substantial center-aligned lower islands are bodies, while samurai follows the ordinary largest-central-body rule and all left/right roles follow authored centroids.

## FIX PASS

- Missing-left-hand root cause: both hand textures were mounted, visible, and present in the display list, but the inherited generic one-hand idle pose always selected hand 1 as its support hand. Its `offBlend` pulled the prototype `hand-l` from the authored outer rest position (sheriff rig x approximately `-62`) to x approximately `+7`, fully behind the torso. `SpriteRig` now preserves the owner-authored hand spread only for `proto-*` characters while the pose phase is `idle`; attack/action pose ownership remains unchanged.
- Head seating changes:
  - `proto-sheriff`: head `oy -191.56 -> -177.91`
  - `proto-samurai`: head `oy -167.52 -> -158.88`
  - `proto-witch`: head `oy -199.07 -> -180.08`
- Rest recaptures overwritten:
  - `docs/owner-notes-audit-v8-evidence/char-proto/proto-sheriff-rest.png`
  - `docs/owner-notes-audit-v8-evidence/char-proto/proto-samurai-rest.png`
  - `docs/owner-notes-audit-v8-evidence/char-proto/proto-witch-rest.png`
- Verification: `pnpm typecheck` passed; focused `SpriteRig` tests passed 26/26; `e2e/tests/char-proto.spec.ts` passed 3/3 against an ephemeral server and asserted both hand centers remain visibly outside the torso plus the exact seated head offsets; `e2e/tests/char-head-split.spec.ts` passed 1/1 and confirmed the Drifter floating-head path remains healthy.

Verdict — both hands render on all 3, heads seated close, sheriff cohesive.
