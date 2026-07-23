# Sol Report: `char-rig-batch2`

## Understanding

Install the owner's ten authored green-chroma whole-art characters without regenerating or restyling them. For each exact `proto-*` id, reuse the repository's existing soft-matte/despill keyer, slice the keyed art with `tools/artkit/guards/slice.mjs` into `head`, `body`, `hand-l`, `hand-r`, `foot-l`, and `foot-r`, preserve authored part positions, normalize through the existing 76 px body-height manifest convention, register all six textures plus the head mount, and add the id to the generator input that emits both `PLAYABLE_CHARACTERS` and `WHOLE_ART_CHARACTERS`.

This implementation will not alter `SpriteRig` scale logic, `ArenaScene`, menu tabs, server contracts, or gear archival. Verification is deterministic only; no live stack will be booted.

## Initial classification assumptions

- `proto-masked-oval-fighter`: the top-most detached oval/masked component is the head; the largest central component is the body; mid-height left/right components are `hand-l`/`hand-r`; bottom left/right components are `foot-l`/`foot-r`.
- `proto-blob-bruiser`: the top-most detached blob component is the head; the largest central blob is the body; mid-height left/right components are hands; bottom left/right components are feet.
- `proto-capsule-tactical-unit`: the top-most detached capsule/helmet component is the head; the largest central tactical unit is the body; mid-height side components are hands; bottom side components are feet.
- `proto-armored-bean-heavy`: the top-most detached armored component is the head; the largest central bean/heavy component is the body; mid-height side components are hands; bottom side components are feet.
- `proto-hooded-rogue`: the top-most detached hood/head component is the head; the largest central cloaked component is the body; mid-height side components are hands; bottom side components are feet.
- `proto-soft-mascot-fighter`: the top-most detached mascot head is the head; the largest central soft body is the body; mid-height side components are hands; bottom side components are feet.
- `proto-geometric-robot-pod`: the top-most detached robot head/pod component is the head; the largest central geometric component is the body; mid-height side components are hands; bottom side components are feet.
- `proto-mutant-lump`: the top-most detached mutant head component is the head; the largest central lump is the body; mid-height side components are hands; bottom side components are feet.
- `proto-paper-cutout-fighter`: the top-most detached paper head component is the head; the largest central cutout component is the body; mid-height side components are hands; bottom side components are feet.
- `proto-helmeted-enforcer`: the top-most detached helmet/head component is the head; the largest central enforcer component is the body; mid-height side components are hands; bottom side components are feet.

Left/right roles are named from the viewer's perspective, matching the intake template and shipped prototype convention. Each assumption will be checked against connected-component bounds and the keyed image before installation, and an actual classification record will be appended after each character.

## Plan

1. Locate and reproduce the exact shipped-prototype keyer, slicer, manifest, mount, normalization, and roster-generator conventions.
2. Process each intake PNG through the existing soft-matte/despill keyer, verify that no green background/fringe remains, then slice and classify its six components.
3. Install the six part PNGs under `packages/client/public/sprites/<id>/`, append that character's classification and asset evidence here, and register the manifest/roster entries using existing patterns.
4. Add deterministic tests covering all ten ids, all six textures, head mounts, whole-art resolution, the 13-character whole-art roster, and `SpriteRig` construction without missing parts.
5. Run `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, `pnpm typecheck`, and full `pnpm test`; confirm LF endings, finalize this report, and commit on `sol/char-rig-batch2`.

## Per-character implementation log

### `proto-masked-oval-fighter`

- Source copied byte-for-byte from the owner intake (SHA-256 `0A64CF28CAEF9EB19E09798544C5AE7B47BC3ADEC8C254D61164E985F3122D69`).
- Existing keyer removed 92.2% of the 1672x941 canvas; preview inspection confirms the green field is transparent with the authored dark outline intact.
- Existing slicer found exactly six substantial connected components. The 232x261 largest central component is the body; the 189x257 top-most oval mask at offset `(22,-283)` is the head; 94x121 / 93x121 mid-height side components are left/right hands; 116x87 / 112x86 bottom components are left/right feet. This confirms the initial classifier assumption, with left/right assigned by image-space centroid.

### `proto-blob-bruiser`

- Source copied byte-for-byte from the owner intake (SHA-256 `3502759FEB8DE15AEA5577B2623D119AE01687433DAEAEFF428C3A94EF302436`).
- Existing keyer removed 87.8% of the 1672x941 canvas; preview inspection confirms transparent inter-part/background gaps and no visible green fringe.
- Existing slicer found exactly six substantial components. The 325x281 largest central wrapped torso is the body; the 314x293 top-most smiling blob at offset `(6,-325)` is the head; 103x132 / 101x131 side components are left/right hands; 148x107 / 148x106 bottom components are left/right feet. The geometry confirms the initial assumption and preserves the slightly right-shifted authored head position.

### `proto-capsule-tactical-unit`

- Source copied byte-for-byte from the owner intake (SHA-256 `4D7F21FA8E471210EF93C6220B1EEF148F0F1F6CAFEB40BB6374DC822F0B97DF`).
- Existing keyer removed 90.5% of the 1672x941 canvas; preview inspection confirms the green field and gaps were removed without disturbing the cyan authored accents.
- Existing slicer found exactly six substantial components. The 246x248 central armored capsule is the body; the 235x275 top helmet at offset `(12,-293)` is the head; 85x120 / 85x119 mid-height side pods are left/right hands; 146x104 / 148x104 bottom boots are left/right feet. The initial assumption is confirmed, including the authored asymmetric hand/foot spacing.

### `proto-armored-bean-heavy`

- Source copied byte-for-byte from the owner intake (SHA-256 `898AD6B96A42B3128A63DC92ED6CBD34780F407AF4D19FA4301FED43F373EBA9`).
- Existing keyer removed 88.8% of the 1672x941 canvas; preview inspection confirms a clean transparent field around the dark armor and gold accents.
- Existing slicer found exactly six substantial components. The 311x270 largest central armored bean is the body; the 262x255 top helmet at offset `(24,-286)` is the head; 116x142 / 114x141 side gauntlets are left/right hands; 157x106 / 158x105 bottom boots are left/right feet. The assumption is confirmed, and the intentionally wide hand spacing remains encoded in offsets `-276/+291`.

### `proto-hooded-rogue`

- Source copied byte-for-byte from the owner intake (SHA-256 `88C3DEF00B4EB84AD2BD8FD36787F60AE01C6AFB5C9B78B7C140705E385EA622`).
- Existing keyer removed 90.1% of the 1672x941 canvas; preview inspection confirms clean transparency around the purple/red silhouette and its black face opening.
- Existing slicer found exactly six substantial components. The authored hood is a visually larger top island, so the slicer's established lower-central-body safeguard correctly selects the substantial 281x265 torso below it as body and the 316x304 hood at offset `(7,-302)` as head. The 82x117 / 84x118 side components are left/right hands, and the 125x84 / 125x83 bottom components are left/right feet. This refines the initial assumption with the same large-head classification case used by the shipped sheriff and witch.

### `proto-soft-mascot-fighter`

- Source copied byte-for-byte from the owner intake (SHA-256 `BC27550D3578B253971AC5738396D0F1CAC2F7AE28431AD84EBD22676F833984`).
- Existing keyer removed 90.2% of the 1672x941 canvas; preview inspection confirms clean transparency around the cream fabric while preserving its olive-gray and gold details.
- Existing slicer found exactly six substantial components. The 258x247 central scarfed torso is the body; the broad 283x243 top mascot head at offset `(3,-273)` is the head; 97x129 / 96x129 side mitts are left/right hands; 135x97 / 133x96 bottom shoes are left/right feet. The assumption is confirmed and the nearly centered head plus asymmetric foot spacing are preserved.

### `proto-geometric-robot-pod`

- Source copied byte-for-byte from the owner intake (SHA-256 `04A75F8DE75CB130EEE5DBC0E0B7B37744FEE8E98A4731E8ABDCF5A21ACF950C`).
- Existing keyer removed 88.7% of the 1672x941 canvas; preview inspection confirms transparent gaps and clean teal/gold edges.
- Existing slicer found exactly six substantial components. The 331x280 central geometric pod (including its connected antenna) is the body; the 277x227 top eye pod at offset `(28,-308)` is the head; matching 109x154 side pods are left/right hands; 171x110 / 174x110 bottom pods are left/right feet. The initial assumption is confirmed, and connected authored details remain with their intended component.

### `proto-mutant-lump`

- Source copied byte-for-byte from the owner intake (SHA-256 `F882684EEA337AD59CC79AB9FAD15A1F131C371723BCA190293DEBB7ECCED817`).
- Existing keyer removed 90.1% of the 1672x941 canvas; preview inspection confirms clean transparency without removing olive flesh or purple mutations.
- Existing slicer found exactly six substantial components. The 291x291 largest central scarfed lump is the body; the 278x272 top mutant head at offset `(31,-284)` is the head; 89x118 / 92x118 side components are left/right hands; 136x91 / 138x90 bottom components are left/right feet. The assumption is confirmed, including the intentionally right-shifted head and asymmetric painted mutations.

### `proto-paper-cutout-fighter`

- Source copied byte-for-byte from the owner intake (SHA-256 `10BABBB09500D8A6A0600FEC6FA67EFAF1F8977B25FF78CFBC2EC0624A9F8EAA`).
- Existing keyer removed 90.9% of the 1672x941 canvas; preview inspection confirms clean transparency around the cream/red paper edges and black cutout details.
- Existing slicer found exactly six substantial components. The 258x243 central red cutout is the body; the tall 255x333 top paper mask at offset `(10,-290)` is the head; 96x124 / 97x123 side cutouts are left/right hands; 142x94 / 138x93 bottom cutouts are left/right feet. The initial assumption is confirmed, and the head's authored irregular height is preserved rather than normalized independently.

### `proto-helmeted-enforcer`

- Source copied byte-for-byte from the owner intake (SHA-256 `7C308339AB42268192131DB11E3AC5E9530F44DEF4D82372F46820FAD5EFA2FE`).
- Existing keyer removed 88.6% of the 1672x941 canvas; preview inspection confirms clean transparency around the charcoal/red armor.
- Existing slicer found exactly six substantial components. The 323x302 largest central plated torso is the body; the 255x250 top helmet at offset `(12,-294)` is the head; 107x137 / 104x136 upper-side gauntlets are left/right hands; 150x97 / 146x96 bottom boots are left/right feet. The assumption is confirmed; the hands are intentionally 11 source pixels above the body centroid and retain that authored mount.

## Installation and registration

- Installed all ten characters through `tools/artkit/harvest-install.mjs --kind=character --post-key=1`. The canonical Lanczos presizer made every installed body texture exactly 168 px high while scaling all centroids and offsets by the identical factor; unchanged `SpriteRig` normalization therefore renders every body in the existing 76 px unit.
- The same pinned chroma keyer ran after presizing with full despill, removing the faint green samples introduced by resampling. A deterministic audit of all 655,145 nontransparent installed pixels across the 60 part PNGs reports `exactKey=0`, `keyable=0`, and `greenDominant=0` for every character.
- `packages/client/src/sprites/manifest.ts` now contains a `kind: "character"` entry for each exact id, with exactly `body`, `head`, `hand-l`, `hand-r`, `foot-l`, and `foot-r`; each head retains its negative authored `oy` mount.
- The atlas was repacked to 491 frames. `pnpm assets:check` sees 436 sprite entries and 841 manifest parts.
- The roster generator now owns display names and neutral prototype kits for the ten ids. Generated `PLAYABLE_CHARACTERS` contains 53 ids and generated `WHOLE_ART_CHARACTERS` contains the 3 shipped plus 10 new prototypes in manifest order. The required non-gating lineage census classifies the new visual prototypes as `bruiser`, matching the shipped prototypes.
- No production changes were made to `SpriteRig`, `ArenaScene`, menu tabs, server selection logic/contracts, or gear archival. Only deterministic tests that had hard-coded the old three-id roster/cycle order were updated.

## Deterministic verification

- Focused whole-art contract, `SpriteRig`, and Arena resolver suites: 3 files / 79 tests passed. Coverage fixes the exact 13-id roster, verifies every new manifest has exactly six roles and real loose PNGs, requires `body.h = 168` and a head mount, proves `resolveOrdinaryPlayerCharacterId` returns each whole-art id, and constructs every rig from its own six `char:proto-*:*` texture keys without gear or missing parts.
- `pnpm gen`: passed; generated 53 playable ids and 13 whole-art ids.
- `pnpm gen:check`: passed. Its only notices were documented fresh-worktree skips for unavailable ignored ArtKit weapon references and legacy scale scratch inputs.
- `pnpm assets:check`: passed with 436 sprite entries / 841 parts / 491 atlas frames.
- `pnpm typecheck`: passed for shared, client, and server.
- Full `pnpm test`: passed 150 test files / 1,963 tests.
- Changed text files pass `git diff --check` and a raw-byte LF audit; no CRLF sequences were found.
- No live stack was booted.

## Files touched

- Owner intake: the 10 raw PNGs plus their 10 keyed PNGs and 10 charcoal previews under `data/character-proto-intake/`.
- Shipped art: 60 part PNGs under `packages/client/public/sprites/<id>/`, plus `packages/client/public/sprites/dd-sprites.{json,png}`.
- Registration/generation: `packages/client/src/sprites/manifest.ts`, `packages/shared/src/characters.ts`, `packages/shared/src/character-classes.ts`, `tools/artkit/gen-character-roster.mjs`, and `tools/portal/index.html`.
- Deterministic coverage: `packages/client/src/sprites/whole-art-character.test.ts`, `packages/client/src/scenes/ArenaScene.dualwield.test.ts`, `packages/server/src/rooms/progression.test.ts`, and `packages/server/src/rooms/GameRoom.test.ts`.
- Report: `docs/sol-reports/impl-char-rig-batch2.md`.

Verdict: 10 chars keyed/sliced/installed/registered — `packages/client/public/sprites/proto-masked-oval-fighter/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-blob-bruiser/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-capsule-tactical-unit/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-armored-bean-heavy/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-hooded-rogue/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-soft-mascot-fighter/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-geometric-robot-pod/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-mutant-lump/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, `packages/client/public/sprites/proto-paper-cutout-fighter/{body,head,hand-l,hand-r,foot-l,foot-r}.png`, and `packages/client/public/sprites/proto-helmeted-enforcer/{body,head,hand-l,hand-r,foot-l,foot-r}.png`; green removal confirmed on all 655,145 visible installed pixels (`exactKey=0`, `keyable=0`, `greenDominant=0`); roster now 13 whole-art ids; files touched are the 30 intake assets, 60 installed part assets, atlas/manifest/roster/generator/lineage/portal outputs, four deterministic test files, and this report; `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, `pnpm typecheck`, focused 79/79, full `pnpm test` 1,963/1,963, and LF checks pass.
