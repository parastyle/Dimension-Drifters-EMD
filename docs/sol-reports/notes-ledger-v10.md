# Owner Notes Ledger v10

## Method and plan

This is a read-only ledger update. The only artifact written is this report. The audit method is:

1. Read the shipped v9 ledger to preserve its intent and batch framing.
2. Parse `data/owner-notes.jsonl` rows 404–413 and reproduce every new note with its timestamp, subject, and verbatim text.
3. Test each new note against the main-tree implementation, commit history, generated data, and shipped Sol reports; call it **DONE** only when concrete commit/report evidence closes the exact intent, otherwise call it **OUTSTANDING**.
4. Reconcile the standing B1–B13 view with the supplied landed commits and add B14–B17 for work introduced by v10.
5. Recommend a serial merge order for outstanding catalog-touching work, explicitly identify generated-art work, and record coordination with `dead-parts-panel` and `char-rig-batch2`.

The unit counted in the new-note verdict is one JSONL row (ten total), even when a row contains multiple observations. A row is **DONE** only if its complete actionable intent is closed; partial overlap is described but remains **OUTSTANDING**.

## Accounting and evidence boundary

`data/owner-notes.jsonl` parses as 413 valid JSON rows. Rows 404–413 contain eight weapon records and two game records, all between `2026-07-23T15:55:06.993Z` and `2026-07-23T16:22:47.831Z`.

The v9 normalization remains authoritative. Six new weapon rows reopen existing weapon bundles (Brimstone Rocket Tube, Mournveil Scythe, Gravewarden Buster, Drowned Anchor, Rusty Cleaver, and Tombstone Greatsword). Ironbrand Heatfist and Hellmouth Palmcaster create two first-time weapon bundles, and the two game rows create two new game bundles. Therefore v10 has **247 normalized intent bundles**: v9's 243 plus four genuinely new bundles.

At v9, 211 bundles were DONE/SKIP and 32 were outstanding. Shipping B1 and B4–B10 closed 25 of those 32, leaving the seven art-family/art-treatment bundles B2, B3, and B11–B13. The six post-ship weapon overrides reopen six closed bundles, and the four new bundles are outstanding. The current normalized split is therefore **230 DONE/SKIP and 17 OUTSTANDING**.

The latest relevant implementation commits predate or do not address the new reports. In particular, `d2f1a9d` repairs the discrete-attack Drive prediction gate and bounded sequence recovery; it does not change projectile flight. `7c3dcdd`/`eaa45e2` normalize whole-art **character** envelopes; they do not replace weapon bitmaps. No current report or commit closes any complete row 404–413 intent, so there are no DONE calls among the ten new rows.

## Rows 404–413 — exact notes and dispositions

### Row 404 — Brimstone Rocket Tube (`x2-brimstone-rocket-tube`)

- Timestamp: `2026-07-23T15:55:06.993Z`
- Verbatim: “why does the rocket fly forward then just...dip down just a little bit while still going forward? is that supposed to be a discrete application of gravity?”
- Disposition: **OUTSTANDING.**
- Evidence: the current gun definition authors a constant `projectileSpeed: 600` and no ballistic/gravity field. Server authority advances ordinary projectiles linearly at `pr.x += pr.vx * dt` and `pr.y += pr.vy * dt` in `packages/server/src/rooms/GameRoom.ts`; the client separately dead-reckons/interpolates snapshots in `packages/client/src/scenes/ArenaScene.ts`. The accepted ranged pass `2dcbb4d` and `docs/sol-reports/ranged-orders.md` close the earlier trigger/forward-placement and explosion orders, not this observed in-flight dip. The weapon-stall fix `d2f1a9d`/`docs/sol-reports/fix-weapon-stall.md` changes pre-admission Drive/sequence prediction only. There is no post-note straight-flight live gate or correction.
- Required closure: reproduce a horizontal Brimstone shot, trace authority and rendered Y separately, and prove zero unintended vertical curvature/correction. This is a post-ship projectile-correctness amendment, not a claim that gravity is intended.

### Row 405 — Mournveil Scythe (`x2-mournveil-scythe`)

- Timestamp: `2026-07-23T16:01:25.881Z`
- Verbatim: “weapon is blurry at this size, can we upscale it? maybe hand it to codex and ask for an upscaled version? idk ur the expert”
- Disposition: **OUTSTANDING.**
- Evidence: B9 commit `8116f00` and `docs/sol-reports/impl-b9-size.md` changed presentation length from 280 to 364 and live-proved the requested 1.3× ratio. The installed Mournveil part remains a 256×128 texture (`packages/client/src/sprites/manifest.ts` and `packages/client/public/sprites/x2-mournveil-scythe/part-1.png`), so B9 enlarged the existing raster; it did not install a higher-resolution replacement. The whole-art size work `7c3dcdd`/`eaa45e2` is character-only and cannot close weapon blur.
- Required closure: one Mournveil-only upscale/restoration art subject, preserving the exact silhouette, palette, grip/pivot registration, transparent bounds, and left/right behavior; then replace the source part and prove improved native pixel density at the unchanged 364 px presentation size. This is generated/restoration art and obeys one image subject per art Sol.

### Row 406 — Gravewarden Buster (`gravediggers-spade`)

- Timestamp: `2026-07-23T16:02:02.200Z`
- Verbatim: “ask was misinterpretted, i liked the frontflipping beyblade. I was hoping it could continue in that fashion as you hold it.”
- Disposition: **OUTSTANDING.**
- Evidence: B8 commits `8bff040`/`5c8173d` and `docs/sol-reports/impl-b8-pose.md` deliberately replaced the frontflip with `twirl.plane: "ground-whirlwind"`. The current base definition and tests lock that ground-plane held whirl. The new note explicitly rejects that interpretation and restores the frontflipping full-body language while retaining the “continue while held” part. The B8 live seam proof therefore validates the wrong plane for this new override.
- Required closure: amend the shipped B8 lane so held input produces a continuous, loop-seam-safe sequence of the approved frontflipping beyblade action, without changing authoritative reach, damage, active timing, or cadence.

### Row 407 — Drowned Anchor (`x-sword-anchor`)

- Timestamp: `2026-07-23T16:03:09.967Z`
- Verbatim: “remove VFX”
- Disposition: **OUTSTANDING.**
- Evidence: the current base definition still authors `effectRecipe: "drowned-anchor-deluge"`. `packages/client/src/vfx/weapon-effect-recipes.ts` resolves that recipe to 150 `water-splat` swing particles, and `tests/v6m-melee-owner-orders.test.ts` still positively asserts the 30× water treatment. B10 commits `a87f465`/`237080f` did not include Drowned Anchor. This new note supersedes its older `2026-07-21T17:56:13.854Z` “1.5x as big, increase VFX by 30x” order.
- Required closure: remove the Drowned recipe/emitter/timing and generated/fallback spawn eligibility while retaining size, damage, reach, and animation. Because this has an explicit runtime recipe and positive regression tests, it is a B10 amendment adjacent to B15 rather than one of B15's two data-only subjects.

### Row 408 — Rusty Cleaver (`rusty-cleaver`)

- Timestamp: `2026-07-23T16:04:02.617Z`
- Verbatim: “remove VFX”
- Disposition: **OUTSTANDING.**
- Evidence: B10 did not include Rusty Cleaver, and the base definition has no explicit `suppressVfx: true` no-effect contract. No exact no-VFX regression proves that held, release, flight, and impact paths remain clean. Its shipped thrown arc from `ee27031` remains separate and should be preserved.
- Required closure: B15 data-only suppression plus a negative VFX census covering throw release, in-flight presentation, and impact, without changing the own-cleaver projectile or its 124 px cosmetic arc.

### Row 409 — Tombstone Greatsword (`tombstone-greatsword`)

- Timestamp: `2026-07-23T16:04:19.615Z`
- Verbatim: “remove vfx”
- Disposition: **OUTSTANDING.**
- Evidence: B10 commits `a87f465`/`237080f`, `docs/sol-reports/impl-b10-vfx.md`, and `tests/b10-vfx-owner-orders.test.ts` removed the bone subject but intentionally retained `tombstone-stone-smoke.png`; the current generated census is stone + smoke with bone removed. The new note is broader and supersedes that partial-removal order.
- Required closure: B15 must suppress all Tombstone special VFX and remove its `paintedQuake` generated entry/override while leaving authoritative quake damage/radius and normal sword animation unchanged.

### Row 410 — game: kung-fu wraps weapon family

- Timestamp: `2026-07-23T16:12:26.405Z`
- Verbatim: “we want a few different kung fu wraps as weapons, animates hands and feet in different types of kung fu per weapon. kinda like how the old game rumble fighter had scrolls with wildy different animations.”
- Disposition: **OUTSTANDING.**
- Evidence: the current monk-glove lane supplies a shared punch vocabulary to qualifying worn weapons; it does not provide a new obtainable wraps family whose hands **and feet** use distinct per-weapon choreography. No new wrap subjects, catalog IDs, animation signatures, or acceptance gallery exists.
- Required closure: B14, defined below. The external game reference is an idiom for mechanical/animation variety, not permission to copy branded names, frames, or assets.

### Row 411 — Ironbrand Heatfist (`x2-ironbrand-heatfist`)

- Timestamp: `2026-07-23T16:19:28.842Z`
- Verbatim: “im seeing two hands punching, even though this weapon is just 1 glove.”
- Disposition: **OUTSTANDING.**
- Evidence: catalog data correctly says `grip: "1H"`, but `isMonkGloveWeapon` includes Ironbrand and the generic punch lane permits lead/off-hand punch choreography independently of a one-glove occupancy contract. `packages/client/src/entities/SpriteRig.glove-pair.test.ts` positively includes Ironbrand in that systemic monk lane. No current pose gate proves only the equipped glove hand attacks.
- Required closure: B16 must distinguish one-glove occupancy from paired gloves/fists in both data and `SpriteRig`, leaving the unused hand in the policy selected by `dead-parts-panel`.

### Row 412 — game: hand rotation versus painted thumbs

- Timestamp: `2026-07-23T16:20:22.943Z`
- Verbatim: “Many hands are placed correctly on the weapons, however their orientation doesnt make sense given the direction of their thumbs...What can we do that about proper hand rotation?”
- Disposition: **OUTSTANDING.**
- Evidence: B9's Prismhex fix is an asset-level `imageFacing: "mirror-x"` exception and does not establish a systemic hand-to-grip tangent/thumb orientation contract. Current pose code has extensive hand-position language, but no catalog-wide thumb-direction datum or both-facing rotation acceptance census. Therefore correct hand coordinates do not prove correct hand orientation.
- Required closure: B17, after the findings in `docs/sol-reports/panel-dead-body-parts.md` are final. This ledger intentionally does not pre-empt that panel's systemic answer.

### Row 413 — Hellmouth Palmcaster (`x2-hellmouth-palmcaster`)

- Timestamp: `2026-07-23T16:22:47.831Z`
- Verbatim: “Many one handed weapons are leaving the unused hand on the other side of the character's orientation. Making it look weird, both hands should be on the side of the character he/she is facing during these times they would otherwise be idle. Get a team of Sol's understanding when our characters have dead (unused) body parts, and what they should be doing”
- Disposition: **OUTSTANDING.**
- Evidence: Hellmouth is correctly catalogued `grip: "1H"`, but there is no shipped unused-limb policy or live both-facing proof satisfying this note. `docs/sol-reports/panel-dead-body-parts.md` is the explicitly in-flight design panel for this exact report; its current main-tree artifact records the same owner request and marks findings as pending. No implementation commit exists.
- Required closure: consume—not redesign here—the panel's ruling in B16's systemic extension and validate Hellmouth plus a representative one-handed census. The unused hand must remain on the character's facing side in the requested idle/dead-part cases.

## Standing numbered-batch view

The phrase “7 of the 8 mechanical batches landed” is resolved by the main-tree history and the supplied batch list: **all eight listed mechanical batches are present**—B1 and B4–B10. B2/B3 were never mechanical-landed, and B11–B13 remain the five v9 art-heavy batches together with B2/B3.

| Batch | v10 status | Commit/report evidence and v10 qualification | Generated art |
|---|---|---|---|
| **B1 — facing/screen truth** | **SHIPPED for v9 scope**; row 404 is a new projectile-trajectory amendment | `09d7eaa` implemented it; `42fe52f` merged it; `docs/sol-reports/impl-b1-facing.md` live-proves upright damage labels and 22 asymmetric projectile facings. Brimstone's rendered-Y dip is a separate post-ship observation. | No |
| **B2 — seven wacky weapons** | **OUTSTANDING** | No seven-weapon catalog/art delivery exists. The v9 subjects remain Unicorn Rainbow Beam, fish launcher, rubber-chicken flail, exploding-present lobber, bubble-wand swarm caster, boomerang boot, and confetti cannon. | **Yes: 7 subjects** |
| **B3 — fan melee/projectile hybrids** | **OUTSTANDING** | No three-weapon hybrid family exists. The v9 minimum remains iron war fan, ember fan, and storm fan, each with authoritative melee plus projectile behavior. | **Yes: 3 subjects** |
| **B4 — Galvanic Overcasters** | **SHIPPED** | `b930931` implemented recoil/locomotion isolation; `fa6deb7` merged it; `docs/sol-reports/impl-b4-overcasters.md` records low- and induced-latency live gates. | No |
| **B5 — attack-root movement** | **SHIPPED** | Implementation is in `179c721`, merged by `fc702b2`; `docs/sol-reports/impl-b5-attackroot.md` proves Sparkknuckle 0 px attack drift and Stormfists' endpoint-locked 480 px/0.025 s dash. | No |
| **B6 — archives** | **SHIPPED** | `c823f2f` archived both IDs; `7a8eef4` merged it; `docs/sol-reports/impl-b6-archives.md` and its census prove pool absence plus exact-ID save safety. | No |
| **B7 — thrown conversions** | **SHIPPED** | `c4c6066` converted the weapons and `b54f602` reconciled generated output; `docs/sol-reports/impl-b7-thrown-v3.md` proves the classifications, own-sprite payloads, DPS preservation, and Boothook over-shoulder/no-spin language. Its documented Stormcrow chain-on-hit limitation is a separate follow-up, not an unshipped B7 classification. | No |
| **B8 — pose/grip/combo** | **SHIPPED for v9 scope**; row 406 is a new owner correction | `8bff040` merged the implementation and `5c8173d` reconciled tests/generated subjects; `docs/sol-reports/impl-b8-pose.md` plus `docs/owner-notes-audit-v9-evidence/b8-pose/` cover the seven-weapon gate. The new Gravewarden note supersedes only its whirl plane. | No |
| **B9 — weapon size/mirror** | **SHIPPED for v9 scope**; row 405 is a new asset-quality follow-up | `8116f00` implements and live-proves the four weapon sizes plus Prismhex mirror in `docs/sol-reports/impl-b9-size.md`. `eaa45e2` is the later merge of the distinct whole-art **character** size correction; it does not upscale Mournveil's bitmap. | New follow-up: **Yes, 1 Mournveil subject** |
| **B10 — VFX cleanup/reuse** | **SHIPPED for v9 scope**; rows 407–409 supersede/extend it | `a87f465` implemented and `237080f` merged the four-weapon cleanup; `docs/sol-reports/impl-b10-vfx.md` proves blue Fulgurite, big blue Voulge, bone-free Tombstone stone/smoke, and zero Headsman special VFX. Drowned was outside B10; Rusty was outside B10; Tombstone's new note removes the retained treatment. | No new art |
| **B11 — generated-image VFX** | **OUTSTANDING** | Dustreaper fire dragon, Mesa-Heart purple crystals, and Arcanist's Lance replacement remain undelivered. | **Yes: 3 subjects** |
| **B12 — Mirage blade extension** | **OUTSTANDING** | Mirage is still absent from the unified blade-extension treatment census. | **Yes: 1 subject** |
| **B13 — Wyrmskull second frame** | **OUTSTANDING** | No registered mouth-open firing frame exists. | **Yes: 1 subject** |
| **B14 — kung-fu wraps** | **OUTSTANDING / NEW** | Four-subject family defined below from row 410. | **Yes: 4 subjects** |
| **B15 — small VFX removals** | **OUTSTANDING / NEW** | Two data-only subjects: Rusty Cleaver and Tombstone Greatsword. The Drowned explicit-recipe amendment travels in the same serialized VFX window but is not counted as a data-only subject. | No |
| **B16 — one-handed pose fix** | **OUTSTANDING / NEW** | Ironbrand is the primary weapon; Hellmouth/unused-limb acceptance waits on `dead-parts-panel`. | No |
| **B17 — hand rotation versus painted thumb** | **OUTSTANDING / NEW** | Systemic grip-orientation work waits on `dead-parts-panel`. | No |

The post-update numbered-batch count is **17**: eight shipped v9 mechanical batches, nine currently outstanding numbered batches (B2, B3, B11–B17), plus explicit v10 amendments attached to the already-shipped B1, B8, B9, and B10 lanes.

## Other shipped work since v9

These main-tree changes are real and remain closed, but none is evidence for closing rows 404–413:

- Whole-art character rendering: `a2c6bf4` and loader follow-up `802c35a`; see `docs/sol-reports/char-rig-render.md`.
- Whole-art character envelope correction: `7c3dcdd`, merged by `eaa45e2`; see `docs/sol-reports/impl-wa-size.md`.
- Server/shared whole-art contract and `DEFAULT_CHARACTER = "proto-sheriff"`: merge `3b1878e`; see `docs/sol-reports/impl-wa-contract-server.md`.
- Ordinary wardrobe render disconnect: `27f18e4`; client contract is recorded in `docs/sol-reports/impl-wa-client-runtime.md`.
- Characters menu tab and persisted selection: `86cda48`, merged by `0c68a51`; see `docs/sol-reports/impl-wa-char-menu.md`.
- Weapon-stall regression fix: `d2f1a9d` with diagnostic/report commit `72738be`; it expands the Drive precheck to all discrete billed attacks and heals a stranded predicted sequence after 250 ms, as recorded in `docs/sol-reports/fix-weapon-stall.md`.

## New v10 batches

### B14 — Kung-fu wraps

**Count: four new obtainable weapons / four distinct animation subjects.** “A few” is made testable as four. These are initial production labels, not copied move sets or final marketing names:

1. **Tiger-Brand Wraps** — alternating claw/forearm entries, a driving palm, and a low sweep kick.
2. **Crane-Silk Wraps** — raised one-leg guard, narrow hand strikes, and a snapping front kick.
3. **Stone-Ox Wraps** — compact planted guard, short body punches, and a heavy stamping heel.
4. **Gale-Serpent Wraps** — winding hand feints, a turning elbow, and a hook-kick finish.

Every subject must visibly animate both hands and feet, and the four complete hand/foot timing signatures must remain distinct even with VFX disabled. The existing shared monk lane can be reused as infrastructure but cannot be the final choreography for all four.

**One-subject law:** each named wrap plus its one animation identity is a separate subject assigned to a separate art/animation Sol. No Sol receives a multi-wrap sheet or a prompt containing several weapons. One B14 integrator alone owns catalog/generator/server/rig integration and consumes the four isolated deliveries.

**Likely ownership/files:** `data/weapon-concepts-300.json`, catalog generator and `packages/shared/src/weapons-expansion.generated.ts`, shared melee/combo definitions, `packages/server/src/rooms/GameRoom.ts`, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/sprites/pose-language.ts`, sprite/manifest assets, weapon-resource/drop/shop censuses, and a four-weapon VFX-disabled live gallery.

**Generated art:** **YES — four weapon subjects**, one per art Sol. Any generated motion reference for a wrap stays with that same single subject; animation implementation remains code-owned by the integrator.

**Acceptance signal:** four active non-archived IDs, four distinct authoritative behavior/combo signatures, four distinct hand-and-foot pose traces, asset provenance/alpha/registration gates, both facings, and damage events aligned to the visible contact limb. A signature test must reject two wraps that differ only by palette, VFX, or timing scalar.

### B15 — Small VFX removals

**Core count: two data-only subjects:** Rusty Cleaver (`rusty-cleaver`) and Tombstone Greatsword (`tombstone-greatsword`).

Set the explicit no-VFX contract on both base catalog definitions. Remove Tombstone's painted-quake override/generated treatment so `packages/client/src/vfx/weapon-vfx.generated.ts` has no Tombstone treatment; ensure Rusty cannot enter a generated or fallback release/impact suite. Extend `tests/data-consistency.test.ts` or the equivalent base-catalog consistency gate and add an exact two-ID negative VFX census. Preserve Rusty's own-sprite throw/arc and Tombstone's authoritative quake damage/radius.

**Adjacent B10 amendment:** the same VFX integrator should remove Drowned Anchor's explicit `drowned-anchor-deluge` recipe, emitter/timing fields, recipe-table row, and superseded positive tests in the same serialized VFX window. Drowned is not counted among B15's two quick data-only subjects because its runtime recipe makes it a wider B10 correction.

**Generated art:** No. Delete/suppress existing treatments only.

**Acceptance signal:** all three owner-requested weapons produce zero special VFX in held, accepted-action, projectile where applicable, and impact phases; `WEAPON_VFX`/recipe resolution returns no treatment; gameplay damage, reach, cadence, Rusty arc, and Tombstone quake authority are unchanged.

### B16 — One-handed pose fix

**Primary count: one weapon:** Ironbrand Heatfist (`x2-ironbrand-heatfist`). The systemic acceptance extension includes Hellmouth Palmcaster and a representative one-handed census after the panel ruling.

Author one-glove occupancy explicitly enough that `SpriteRig` cannot alternate attacks onto an unequipped glove/hand. The equipped Heatfist hand performs the punch; the other hand follows the final dead/unused-limb policy. Do not convert Ironbrand into a glove pair and do not change its damage, quake, cadence, or one-hand catalog identity.

This batch may extend from the weapon-specific data/pose correction into a reusable one-handed “used versus unused” rule, but that extension must consume `docs/sol-reports/panel-dead-body-parts.md`; this ledger does not design the rule. Hellmouth is the named both-facing acceptance fixture for the panel-informed idle policy.

**Likely ownership/files:** `data/weapon-concepts-300.json`, generated catalog, shared worn/glove classification, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/sprites/pose-language.ts`, glove/pose tests, and a VFX-disabled both-facing live gate.

**Generated art:** No.

**Acceptance signal:** Ironbrand shows exactly one attacking glove/hand through every accepted beat; the unused hand never becomes a second punch. Hellmouth and the one-handed census place unused hands according to the panel ruling on both facings, with no hand disappearance, cross-body side inversion, or change to weapon muzzle/grip registration.

### B17 — Hand rotation versus painted thumb

**Count: one systemic game intent**, validated across a representative grip census rather than treated as a list of one-off weapon mirrors.

Wait for `docs/sol-reports/panel-dead-body-parts.md`, then implement the panel-selected hand-orientation contract at the reusable grip/pose seam. The gate must distinguish hand **position** from hand **rotation**, derive the expected thumb/hand orientation from the painted grip direction and facing, and preserve deliberate exceptions. B9's Prismhex `mirror-x` remains an image-facing exception; it is evidence that asset mirroring alone is not the catalog-wide hand solution.

**Likely ownership/files:** weapon/grip metadata if the panel calls for it, `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/sprites/pose-language.ts`, sprite manifest/facing helpers, grip-marker tests, and a VFX-disabled two-facing rotation gallery.

**Generated art:** No. Rotate/place existing rig hands; do not regenerate weapons to hide the systemic problem.

**Acceptance signal:** a catalog-spanning sample of one-hand, two-hand, gun, staff, and worn/glove grips has correct thumb direction at idle and action contacts on both facings; position-only correctness cannot pass the rotation assertions.

## Post-ship amendments without new batch numbers

Only B14–B17 are added as new numbered batches. The other v10 rows amend the shipped lineage that introduced or previously closed their behavior:

- **B1 amendment:** Brimstone Rocket Tube rendered/authoritative straight-flight diagnosis and correction.
- **B8 amendment:** Gravewarden changes from the shipped ground-plane whirlwind to the owner's clarified continuous frontflipping beyblade.
- **B9 amendment:** Mournveil receives one higher-resolution restoration subject at the already-approved 364 px display length.
- **B10 amendment:** Drowned Anchor's explicit deluge removal; integrate in the B15 VFX window.
- **B16 panel extension:** Hellmouth is the named acceptance fixture for the in-flight unused-body-part ruling.

## Serial merge order and Sol fan-out

Art-only preparation may run in parallel, but repository integration must be serial. In particular, B15–B17, B2, B3, B14, and B11–B13 touch or may regenerate the weapon catalog, manifests, VFX output, or shared rig data. Each integrator must rebase on the preceding merge, regenerate exactly once from authoritative source, reject unrelated generated churn, and rerun catalog/asset referential-integrity gates.

Recommended serial merge train:

1. **B1 amendment — Brimstone trajectory.** Diagnose authority versus render Y first; keep it catalog-free unless evidence proves an authored trajectory field is necessary.
2. **B9 amendment — Mournveil restoration.** Accept the one-subject upscale, preserve registration, and update asset/manifest evidence without changing its approved display/gameplay lengths.
3. **B10 amendment + B15.** Remove Drowned's explicit recipe, then land the two data-only Rusty/Tombstone suppressions in one VFX-owned merge.
4. **Coordination gate:** allow `dead-parts-panel` to finish and land or freeze `char-rig-batch2`; rebase all subsequent `SpriteRig`/pose work on that exact main-tree state.
5. **B8 amendment — Gravewarden.** Restore the continuous frontflipping plane after the character-rig baseline is stable.
6. **B17 — systemic hand rotation.** Land the panel-informed grip/thumb transform contract before weapon-specific one-hand acceptance consumes it.
7. **B16 — Ironbrand + Hellmouth acceptance.** Apply one-glove occupancy and the panel-informed unused-hand policy.
8. **B2 — seven wacky weapons.**
9. **B3 — three fan hybrids.**
10. **B14 — four kung-fu wraps.**
11. **B11 — three generated-image VFX subjects.**
12. **B12 — Mirage extension.**
13. **B13 — Wyrmskull mouth-open frame.**

The ordering keeps correctness and regressions ahead of new content, keeps all catalog-generating merges single-filed, lets B11 compose after the three new-weapon families settle, and retains B10-before-B12's clean blade-extension census.

For **v10-introduced/corrective work**, use **seven implementation lanes**: Brimstone amendment, Gravewarden amendment, Mournveil integration, and one integrator each for B14–B17. The B15 integrator also owns Drowned's adjacent B10 amendment; the B16 integrator consumes Hellmouth acceptance. Add **five one-subject art Sols**: four B14 wraps and one Mournveil restoration. That is **12 bounded new-work roles**. `dead-parts-panel` and `char-rig-batch2` are already in flight and are not double-counted.

For the **entire remaining program**, add the five v9 art-batch integrators (B2, B3, B11, B12, B13) to obtain **12 implementation lanes**, and retain the v9 15 art subjects plus four B14 subjects plus Mournveil for **20 one-subject art Sols**: 32 bounded remaining roles in total. Art Sols deliver isolated subject assets only; integrators alone merge catalog/runtime changes.

`char-rig-batch2` currently shares the main-tree base at `0c68a51` and is expected to overlap character-part/rig surfaces. B8, B16, and B17 must not merge against its stale base or overwrite its `SpriteRig`/pose changes. `dead-parts-panel` is the semantic dependency for B16/B17 and the Hellmouth clause; this ledger cites and waits for it rather than inventing a competing unused-limb policy.

Verdict: 247 total normalized v10 intents = 230 DONE/SKIP + 17 OUTSTANDING; the 10 new notes are 0 DONE / 10 OUTSTANDING; 17 numbered batches post-update (8 shipped for v9 scope, 9 outstanding, with B1/B8/B9/B10 carrying post-ship amendments); recommended v10 new-work fan-out is 7 implementation lanes + 5 one-subject art Sols = 12 bounded roles; interactions: B16/B17/Hellmouth wait for `dead-parts-panel`, while B8/B16/B17 must rebase after `char-rig-batch2`.
