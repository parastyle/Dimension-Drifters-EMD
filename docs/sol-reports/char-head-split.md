# Sol report: character head split

## Understanding

- Scope is the Drifter only. Preserve the existing Madness-flash floating-pill character design and current body/hand/foot pipeline.
- Add exactly one new floating part: `head`. The source render must show the concealed head clearly detached and floating slightly above the body, while retaining the Drifter's hat-shadow face concealment.
- Extend the existing slicer, generated sprite manifest, and `SpriteRig` part-rendering/bob path surgically; do not create a replacement character-art or animation system.
- Preserve the owner's services on ports 5180 and 2567. Use private ephemeral ports for runtime proof.
- Retain before/after art and runtime captures under `docs/owner-notes-audit-v8-evidence/head-split/`.

## Plan

1. Audit the Drifter/Cordell art briefs, ArtKit generation/harvest/slice flow, manifest generation, current sprite assets, and `SpriteRig` floating-part path.
2. Save the current Drifter baked-head art as before evidence.
3. Update the Drifter prompt with explicit detached-head language and concealed-face constraints.
4. Add the `head` role to component classification, part emission, manifest typing/generation, and the existing rig rendering/bob path.
5. Regenerate and install only the Drifter; inspect the source and all six sliced parts, iterating if the result is off-style or collage-like.
6. Run generation/asset checks, typecheck, and server census/boot checks.
7. Launch a private ephemeral stack, capture runtime proof frames showing the floating head and bob, and record exact evidence paths.

## Assumptions

- Existing repository scripts and environment credentials/configuration are the authoritative generation route.
- If an existing head-spring implementation from `chars-3` is present, it will be reused rather than duplicated.

## Log

- 2026-07-22: Created this report before implementation edits, per task requirement.
- 2026-07-22: Audited the existing five-part Drifter source and installed assets. Confirmed `body.png` contains the hat/masked head and `parts.json` contains only body, two hands, and two feet.
- 2026-07-22: Preserved the before source, keyed source, installed baked-head body, and part manifest under `docs/owner-notes-audit-v8-evidence/head-split/`.
- 2026-07-22: Confirmed `chars-3` already landed a bounded floating-head spring in `SpriteRig`; it was wired only to the boilerplate gear head. The implementation now lets a sliced manifest `head` enter that same retained node and late spring/bob path, while the boilerplate gear path remains compatible.
- 2026-07-22: Updated the canonical Cordell `artBrief`, its ArtKit subject projection, and the actual `drifter` ArtKit prompt with explicit six-island floating-pill language, detached head placement, opaque face concealment, and prohibitions on anatomy/collage output.
- 2026-07-22: Extended the existing connected-component slicer so the top-most qualifying detached component above the largest body is emitted as `head.png`; legacy baked-head inputs retain the old five-part classification.
- 2026-07-22: Verified the old baked-head Drifter still classifies as exactly five parts and the client typecheck passes before regeneration.
- 2026-07-22: Ran the existing isolated ArtKit generator with `PARALLEL=1`, `CANDIDATES=3`, and `--only=drifter`, attaching the archived current Drifter as `styleRef`. The pipeline harvested exactly three real image-generation candidates; no other character was generated.
- 2026-07-22: All three candidates sliced mechanically into exactly six components. Rejected candidate 1 for a visible eye and candidate 2 for excessive brim/proportion drift. Promoted candidate 3: compact charcoal pill/bust, opaque shadow head, familiar duster/boots, and native detached stubs.
- 2026-07-22: Candidate 3 sliced to `body`, `head`, `hand-l`, `hand-r`, `foot-l`, and `foot-r` without hand cutting. `harvest-install.mjs --ids=drifter` presized the body to 168 source pixels, installed all six files, emitted the Drifter `head` row in `SpriteManifest`, and repacked the atlas with `drifter/head`.
- 2026-07-22: Added focused coverage proving the sliced Drifter head enters the existing bounded spring without a gear manifest, stays outside the generic body/limb list, follows the final body transform, and responds to the existing bob input within the 4 px bound.
- 2026-07-22: `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, and full workspace `pnpm typecheck` pass. The focused `SpriteRig.boilerplate.test.ts` suite passes 15/15. `gen:check` reports only its existing skip notices for untracked ArtKit source artifacts; every generated file it could evaluate is in sync.
- 2026-07-22: Booted the real Vite + Colyseus stack on private ephemeral ports 58016/56266. Ports 5180/2567 remained owned by the owner's processes throughout and were never targeted.
- 2026-07-22: The current v4 metagame account deliberately overlays wardrobe gear on character identities. The proof therefore remounted the same live, decoded Drifter row through `ArenaScene.addBlob`'s existing legacy character compatibility branch after clearing only the browser-local decoded gear-tail strings. No production wardrobe behavior or server state was changed.
- 2026-07-22: The Playwright live gate passed. The packed atlas mounted `dd-sprites/drifter/body` and `dd-sprites/drifter/head`; the rig retained two hands and two feet, kept the head above the body, and recorded a 4.3377 px relative-Y bob over 175 live samples. The private stack was then stopped; the final census showed only the untouched owner listeners on 5180/2567.

## Evidence

- Before: `docs/owner-notes-audit-v8-evidence/head-split/before-body-baked-head.png`, `before-identity-ref.png`, `before-identity-ref-keyed.png`, and `before-parts.json`.
- Generation review: `generation-candidates.jpg`; rejected candidates remain in the isolated ArtKit output directory, while candidate 3 is the installed master.
- After art/parts: `after-identity-ref.png`, `after-identity-ref-keyed.png`, `after-identity-ref-preview.png`, `after-body-headless.png`, `after-head.png`, `after-installed-body.png`, `after-installed-head.png`, and `after-parts.json`.
- Runtime: `runtime-drifter-head-rest.png`, `runtime-drifter-head-bob-01.png` through `runtime-drifter-head-bob-06.png`, and `runtime-drifter-head-capture.json`.

verdict — drifter regenerated as body+head+hands+feet, head floats above body, still on-style pill (not a collage, not a figure), with the evidence screenshot path `docs/owner-notes-audit-v8-evidence/head-split/runtime-drifter-head-rest.png`.
