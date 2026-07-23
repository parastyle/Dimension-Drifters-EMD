# Drifter Head v2

## Understanding

The v1 split works mechanically and is on-style, but the detached drifter head is too shallow below the hat brim and the floating-head motion can open a visible gap above the headless pill body. This pass is limited to the drifter: make the generated head visibly taller while keeping its face fully concealed, then tighten the head-only float so the taller head overlaps the body shoulder line through the complete bob cycle. The body, hands, feet, and their animation must remain unchanged.

The live owner stack on ports 5180/2567 is out of bounds. Visual proof will use an ephemeral private stack and retain v1-before plus v2 rest/top/bottom evidence under `docs/owner-notes-audit-v8-evidence/drifter-head-v2/`.

## Plan

1. Inspect the v1 report, drifter art brief, generation/slicing/install commands, current installed sprites, and floating-head anchor/tuning.
2. Preserve a v1 reference capture and measure the current head sprite and rig geometry.
3. Change only the drifter head wording, regenerate only the drifter through the real generation pipeline, and install the resulting split assets.
4. Adjust only the head rest/float parameters so overlap remains positive at both bob extremes.
5. Run the required generation/asset checks if applicable, typecheck, server boot verification, and full `pnpm test`.
6. Launch an ephemeral stack, capture v2 rest and bob extremes, measure height increase and minimum overlap, and visually confirm the result before recording the verdict.

## Work Log

- 2026-07-22: Created this report before implementation; no project files inspected or changed yet.
- 2026-07-22: Audited commit `f1f56a6`, the v1 report/e2e proof, the canonical Cordell brief, the actual `drifter` ArtKit prompt, `slice.mjs`, `harvest-install.mjs`, generated manifest geometry, and the retained floating-head spring path.
- 2026-07-22: Measured the v1 installed head at 134×82 px (tight alpha bounds also 134×82) against a 141×168 px body. Recorded the unchanged-part SHA-256 baseline: body `73F5A84B…85C6A`, hand-l `CC002F91…4451`, hand-r `999E46C6…E69C`, foot-l `F28EFC45…8278`, foot-r `6E48FB35…36D3`.
- 2026-07-22: Preserved the v1 installed art, identity master/keyed source, source geometry, runtime rest frame, all six v1 bob frames, and v1 capture telemetry under `docs/owner-notes-audit-v8-evidence/drifter-head-v2/`. Also retained the v1 raw body/hand/foot slices in ignored ArtKit scratch so the final install can keep those five sprites byte-identical while accepting only the newly generated head.
- 2026-07-22: Measured the v1 painted-silhouette relationship across all 175 retained runtime samples rather than relying only on rectangular sprite bounds. The best aligned opaque head-bottom/body-top columns still had a gap throughout the trace: worst/top gap 6.69 px and best/bottom gap 1.40 px. This quantifies the visible decapitated read in the v1 screenshots.
- 2026-07-22: Changed only the Drifter head clauses in Cordell’s canonical `artBrief`, its existing concept projection, and the executable ArtKit `drifter` subject. The new constraint requires a complete tall concealed head with substantial opaque mass beneath the brim, approximately matching the crown height, and explicitly rejects a thin shadow sliver. All body/hand/foot, palette, style, orientation, and six-island language remains unchanged.
- 2026-07-22: Ran the real isolated ArtKit generator with `PARALLEL=1`, `CANDIDATES=3`, and `--only=drifter`, using the approved v1 identity as the existing `styleRef`. Exactly three real candidates were harvested and keyed; no other subject was generated.
- 2026-07-22: Ran the real connected-component slicer on all three candidates. Each produced exactly six parts. Candidate 3 was promoted because it best retains the v1 tilted hat/duster rendering while adding a full opaque head mass with no biological face. Its generated raw head is 419×286 px versus v1’s 360×220 px.
- 2026-07-22: Installed the selected head through the real slice/install/atlas path. The install input intentionally retained the v1 raw body, hands, feet, canvas, and offsets, substituting only candidate 3’s generated `head.png`; this enforces the owner’s “head only” invariant. Final body/hand/foot SHA-256 hashes are byte-for-byte identical to v1.
- 2026-07-22: The installed v2 head is 155×106 px versus v1’s 134×82 px: +24 px / +29.3% height. The body remains 141×168 px and headless.
- 2026-07-22: Tightened only the floating-head channel: vertical follower ceiling 4→1.75 px, horizontal ceiling 4→3 px, velocity ceiling 72→48, walk bob 1.15→0.55 px, and the dash/slide/air/landing/attack head contributions were reduced. Added a 4.5 px neutral rest inset only for character-owned manifest heads; boilerplate/wardrobe socket geometry and every body/hand/foot animation path are unchanged.
- 2026-07-22: Added focused rest-inset coverage and a private-stack visual gate that records exact rendered top/bottom extrema, source dimensions, bob range, sprite-envelope overlap, and alpha-silhouette overlap. A conservative projection of the new art/inset against the entire old larger-amplitude trace is already positive at +3.67 px; direct v2 runtime measurement remains the final gate.
- 2026-07-22: The real private-stack gate passed on dynamically assigned client/server ports 51760/51758. It sampled 61 distinct rendered poses across the complete six-second idle cycle and saved the exact lowest-overlap and highest-overlap canvas frames. Owner port 5180 remained owned by the original process; neither 5180 nor 2567 was targeted.
- 2026-07-22: Direct v2 telemetry measured a 3.1798 px full bob range, down 1.1579 px / 26.7% from v1’s 4.3377 px. Minimum painted alpha-silhouette overlap across every sample is **5.9045 px** and minimum rectangular sprite-envelope overlap is 13.3412 px. Both remain positive at the top extreme.
- 2026-07-22: Visually inspected the v2 rest, exact top, and exact bottom captures at original resolution. The detached head has an unmistakably fuller concealed shadow mass below the brim, its lower silhouette stays seated into the duster collar at the highest point, and there is no visible air gap, biological face, egg-stump, or launched/decapitated read.
- 2026-07-22: The shared branch concurrently acquired an incomplete out-of-lease chakram catalog change (343 source rows while its runtime guard was deliberately left at 342), so a generator invocation there stopped at that external census guard. Per the lease, no weapon/chakram file was edited to resolve it. All required validation was rerun in a clean detached worktree containing only this Drifter pass.

## Evidence

- V1 before: `docs/owner-notes-audit-v8-evidence/drifter-head-v2/v1-runtime-rest.png`, `v1-runtime-bob-01.png` through `v1-runtime-bob-06.png`, `v1-runtime-capture.json`, `v1-installed-head.png`, and `v1-identity-ref.png`.
- V2 generation/art: `v2-generation-candidates.jpg`, `v2-generated-identity-ref.png`, `v2-generated-identity-ref-keyed.png`, `v2-generated-head-raw.png`, `v2-installed-head.png`, and `v2-installed-body.png`.
- V2 runtime: `v2-runtime-rest.png`, `v2-runtime-bob-top.png`, `v2-runtime-bob-bottom.png`, and `v2-runtime-capture.json`.

## Validation

- Drifter-only ArtKit: `PARALLEL=1 CANDIDATES=3 node orchestrate.mjs --only=drifter` — passed; three candidates, one subject.
- Real slice/install/atlas path — passed; six components, installed head 155×106, non-head hashes identical to v1.
- `pnpm gen` — passed in the clean Drifter validation worktree.
- `pnpm gen:check` — passed; only the documented ignored-ArtKit skip notices.
- `pnpm assets:check` — passed: 422 sprite entries, 762 parts, 413 atlas frames.
- `pnpm typecheck` — passed, including a final post-suite run.
- Focused `SpriteRig.boilerplate.test.ts` — 15/15 passed.
- Private visual gate `drifter-head-v2.spec.ts` — passed; client/server ports 51760/51758; rest plus exact bob extrema retained.
- Full `pnpm test` — 135 files / 1775 tests passed.

verdict — head height increased 82→106 px (+24 px, +29.3%); minimum painted head-to-body overlap across the full bob is 5.9045 px (>0); rest and exact bob-extreme captures are `docs/owner-notes-audit-v8-evidence/drifter-head-v2/v2-runtime-rest.png`, `v2-runtime-bob-top.png`, and `v2-runtime-bob-bottom.png`; on-style confirmed: taller fully concealed head, sits close, no gap, no stump.
