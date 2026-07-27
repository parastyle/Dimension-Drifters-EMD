# B77 dead-code audit

Date: 2026-07-26

Branch: `sol/b77-deadcode-audit`

Audited HEAD: `71dae9e0` (`canon: L09 — movement is stupid simple, feel comes from animation`)

## Owner decision summary

This audit found a small, safe production-code cut and a much larger test/deployment cleanup. The
best payoff-to-risk order is:

| Rank | Owner action | Payoff | Risk |
| ---: | --- | ---: | --- |
| 1 | Delete the reintroduced monolithic `GameRoom.test.ts`; keep the B43 split suites. | 7,408 test LOC and 256 duplicate test executions | Low after one full-suite comparison |
| 2 | Delete the two B20 e2e specs, the retired remote-gear unit suite, and the vacuous level-cadence assertion. | 440 test LOC and 6 dead test cases | Low |
| 3 | Take the eight surgical “confidently dead” cuts below. | 624 source LOC; removes a hazardous in-place art tool and misleading B20/class residue | Low if kept surgical |
| 4 | Remove or relocate the ashlands route tile, banned-whip parts, retired XP/level audio, and unused icon packs. | 48 files / 0.64 MiB | Low |
| 5 | Move legacy portraits and presentation art out of `public/` after confirming durable art provenance. | 75 files / 14.72 MiB | Medium: several files are useful authoring references |
| 6 | Consolidate B43 test harness/import scaffolding and choose one concept-catalog source of truth. | About 7,069 duplicated source/test LOC | Medium; mechanical but broad |
| Keep | Ultimates, Belt, Wardrobe compatibility/fallback code, reserved schema slots, and the B74 compatibility alias. | Prevents destructive over-pruning | Deleting these would violate a ruling or compatibility contract |

No files were deleted in this lane. The report-first order is appropriate because the largest
findings cross compatibility or asset-provenance boundaries.

## 1. Confidently dead

These are ranked by payoff divided by removal risk. “LOC” is the exact physical source span that
can be removed, excluding the dead tests catalogued separately in section 5.

| Rank | Finding | Why it is dead | Size | Removal risk / recipe |
| ---: | --- | --- | ---: | --- |
| 1 | Standalone in-place outline mutator, `tools/artkit/gen-outlines.mjs` | The 396-line command has no package script, import, or caller. Its old `tools/artkit/out/outlines` restore archive is absent. The surviving gear pipeline performs registration, generated outlines, validation, and manifest emission inside `gen-gear.mjs` (for example `:1205-1215`, `:1661-1694`, and `:2645-2649`). | **396 LOC / 1 file** | **Low.** Delete the command only; do not alter installed art. This also removes an attractive but obsolete command that mutates public sprites in place. |
| 2 | Dissolved character-lineage taxonomy in `packages/shared/src/character-classes.ts:18,75-153,468-470` | Commit `1a21222e` dissolved classes. The file itself says the buckets are non-gating; `CharacterLineage`, `CHARACTER_LINEAGE`, and `lineageForCharacter` have no outside reader. `QUIRKS`, `characterKit`, and `quirkForCharacter` are live and are not part of this cut. | **83 LOC / 1 file** | **Low if surgical; high if the whole module is removed.** Delete only the type, map, and accessor. |
| 3 | Retired per-patch remote gear cache, `packages/client/src/ui/remote-gear.ts` | Its only importer is its own test. The Wardrobe retirement plan explicitly says to stop the otherwise unused per-patch `syncedGearLoadouts` cache (`plan-wardrobe-retire.md:65`); ordinary play now uses authoritative whole-art character identity. | **43 LOC / 1 file** | **Low.** Delete the module and its 74-line test together. Do not remove the explicit asset-failure/old-row gear fallback. |
| 4 | Four generated icon manifest modules under `packages/client/src/sprites/icon-manifest-*.ts` | The four modules have zero importers and no runtime string-key lookup. Their 35 images also have no loader; see section 2. This was independently identified by the earlier prune audit and remains unchanged. | **51 LOC / 4 files** | **Low.** Stop generating the modules and move/delete the public icon packs as one change. |
| 5 | XP receipt audio dispatcher branches, `AudioBus.ts:1679-1717` | `xpTick` and `xpCadence` have no emitter after B20. The locked B20 ruling says in-run level/XP is deleted (`design-lock-b20.md:10-11,48`), implemented by `9e4641c2`. The branches can only be reached by an arbitrary string call that no production caller makes. | **39 LOC / 1 file** | **Low.** Remove both cases with the nine retired samples in section 2; keep pet **Bond XP**, which is a separate live account system. |
| 6 | B20 stat/level declarations: `SIGNATURE_INTERVAL`, `SECOND_WIND_PER_CON`, `EMBERGUARD_PER_INT`, `AttrValues`, and the unused `ATTRS` value import in `gear.ts` | Runtime chest augments use flat `SECOND_WIND_BASE` and `EMBERGUARD_BASE_DMG`; nothing reads the two stat scalars. Only a self-referential stale test reads `SIGNATURE_INTERVAL`. B20 locked out levels, stats, scaling, and requirements (`design-lock-b20.md:10-11,44-48`; teardown `9e4641c2`). `Attr` itself remains required by authored metadata and dormant ultimate variants. | **5 LOC / 3 files** | **Low.** Delete exactly these declarations/import token and update their comments; retain `Attr`, flat crit, augment drafting, and chest trinkets. |
| 7 | Shopkeeper generation row, `tools/artkit/gen-sprint2.mjs:51-54` | B20 locked “No shopkeeper” and says the art is archived, not deleted (`design-lock-b20.md:26-27`; L3 `05fda7a1`). This row can still recreate/overwrite a public portrait for a system that may not return. | **4 LOC / 1 file** | **Low.** Remove only the `misc` row. Retain or relocate the portrait according to the explicit archive ruling. |
| 8 | Unused matchmaking getter, `packages/client/src/net/matchmaking.ts:52-54` | `setLaunchIntent` and the internal `launchIntent` read in matchmaking are live, but no repository code imports or calls `getLaunchIntent`. All packages are private workspace packages, so there is no published external API consumer. | **3 LOC / 1 file** | **Very low.** Delete the export; keep the setter and internal closure state. |

**Confidently dead subtotal: 8 items, 624 LOC across 13 files.**

Not counted as confidently dead: `RoomState.elapsedLegacy` is unread but explicitly reserves the
former wire slot; removing it is a schema-compatibility decision, not a dead-local cleanup.

## 2. Orphaned assets

`packages/client/public/**` is copied into Vite/Desktop output even when no loader requests a file.
“Orphan” here means no active game load/render path; it does not mean the only high-quality source
copy is safe to erase. The scan followed URL construction, generated manifests, frame variants,
audio replacement keys, dev deep links, and artkit inputs rather than relying on filename grep
alone.

| Rank | Orphan group | Evidence | Files | Bytes | Removal risk / action |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | Ashlands worn-route `tiles/ashlands/tile-1.png` | `floor-renderer.ts:227-235` documents the exact orphan: `zoneVariants` now has base/cluster/edge only, and POI/wear routes were removed by `48f8f7f`. Tile 1 is in no style role. | 1 | 54,745 | **Low.** Delete if routes are not returning soon; otherwise move outside `public/` with a named dormant-route allowlist. |
| 2 | Banned whip loose sprites (`x2-galvanic-crackwhip`, `x2-psalmstone-beadwhip`) | `gen-weapon-expansion.mjs:1675-1677` cuts `banned: true` concepts from `WEAPONS`, but both stale sprite manifests survive. Arena preload treats missing `WEAPONS[id]?.expansion` as falsy and therefore boot-loads the three parts at `ArenaScene.ts:1931-1939`; no weapon can render them. | 3 | 48,068 | **Low.** Remove the two manifest rows and three public parts; preserve the banned concept records. Do not edit `data/weapon-concepts-300.json` in this lane. |
| 3 | Retired level/XP samples (`levelup-*`, `xp-mote-catch-*`, `xp-cadence-resolve-*`) | Nine files remain in the sample manifest, but level-up has no dispatcher and the only XP dispatch branches have no callers. Samples are lazy-fetched, so they ship but do not sound. B20 is the governing deletion. | 9 | 98,614 | **Low.** Remove with the two dead `AudioBus` cases. Do not match generic “xp”; pet Bond XP and its presentation are live. |
| 4 | Class/emote/rarity/stat UI icon packs | All 35 PNGs are represented only by the four unimported manifest modules. No client preload, dynamic URL builder, or deep-link surface addresses `ui/icons/**`. | 35 | 467,121 | **Low.** Delete from production public output; retain prompt specs outside `public/` only if useful. |
| 5 | Old title/banner/border/splash presentation art | The 11 root title/banner/border files and 7 `ui/splash` files have no source filename reference or runtime URL. The only active public-UI URL family is `ui/menu/${dimensionId}.jpg` (`MenuScene.ts:461`), whose five files are excluded. | 18 | 12,150,911 | **Medium.** Largest byte win. Confirm none is the sole owner-approved source, then archive outside `public/` or delete. |
| 6 | Legacy portrait directory, `public/ui/portraits/**` | None of 57 portraits has a runtime URL after whole-art Characters replaced Wardrobe. Nine filenames remain artkit gear-manifest references, so “not rendered” is certain but “safe to erase” is not. | 57 | 3,280,430 | **Medium-high.** Move authoring references to an art archive and update those nine paths before removing public copies. |
| 7 | `public/ui/shopkeeper.jpg` | No runtime loader exists; the only creator is the dead generator row above. B20 explicitly requires archival rather than deletion. | 1 | 91,832 | **Do not delete outright.** Move it out of deployment while preserving the archived master. |

**Orphan subtotal: 124 files, 16,191,721 bytes (15.44 MiB).** Ultimates assets are deliberately
excluded because they are dormant, not orphaned. The five active dimension menu JPEGs, Belt assets,
gear/fallback sprites, muzzle/VFX reference pages, generated frame variants, and `?dev=` assets are
also excluded.

`pnpm assets:check` passed and covered 500 sprite entries / 1,032 parts, 635 atlas frames, 320 cards,
9 decals, 33 projectile URLs, 96 particle URLs, and 20 weapon-VFX URLs. Its scope does not cover
arbitrary `public/ui` or retired audio, which is why the load-path audit above is still necessary.

## 3. Dormant, not dead

| Rank | System | Evidence and size | Required disposition |
| ---: | --- | --- | --- |
| Keep | Ultimates | B55 commit `6b63880a` made the shared `ULTIMATES_ENABLED` constant false. `impl-b55-chest-contents.md:10-16` explicitly says the implementation and detailed tests remain dormant and return with a one-line change. There are **1,207 LOC in three dedicated client modules**, substantial integrated server/client/schema branches across 86 source files, **26 `ultimate-*.mp3` files / 412,824 bytes**, and 20 intentionally skipped implementation tests in the full suite. | **Do not delete, prune, or count its assets as orphans.** Keep the single shared gate and the disabled-contract test. If the owner later cancels ultimates permanently, audit it as one vertical slice rather than trimming individual branches. |

Dormant subtotal: **1 system**.

## 4. Duplicated / superseded systems

| Rank | Duplicate | Survivor and evidence | Scale | Payoff / risk |
| ---: | --- | --- | ---: | --- |
| 1 | Reintroduced monolithic server regression suite plus the B43 split suites | Commit `af090b3` deleted `GameRoom.test.ts` and created ten independently runnable split files; report `7093f3cc` records the move-only split. The monolith is back at 7,408 lines. Every one of its **256 test titles** exists in the ten split files; the split files contain eight newer B55 cases the monolith lacks. **Survivor: the ten split suites.** | 7,408 fully duplicate LOC; the split suites total 12,666 LOC | **Very high payoff / low risk.** Delete the monolith, run the full suite, and compare counts. |
| 2 | Ten copies of the B43 `GameRoom` test harness/import prelude | The move-only split intentionally duplicated helpers so every file stood alone. Current first-describe offsets total 5,595 lines; retaining one shared fixture would remove about **5,033 repeated lines**. **Survivor: a shared fixture module plus focused split suites.** | ~5,033 redundant LOC across 10 files | **High payoff / medium risk.** Extract mechanically after the monolith deletion; fixture mutation or module-state leakage is the main risk. |
| 3 | Retired Wardrobe UI beside whole-art Characters, including two Wardrobe generations inside `MenuScene` | `MenuTab` has only Characters/Armory/Packs/Run; `MenuScene.character-tab.test.ts:37-45` proves Wardrobe is neither built nor preloaded. The contiguous Wardrobe methods at `MenuScene.ts:1806-2892` contain both `buildWardrobeWorkspace` and the older `buildWardrobePanel`. `impl-wa-char-menu.md:45` and `plan-wardrobe-retire.md:261` deliberately retain this as archive code. **Survivor: whole-art Characters plus explicit old-row/asset-failure fallback.** | At least **2,111 dormant production LOC**: 1,087 in `MenuScene`, 313 layout LOC, and 711 preview LOC, plus model portions and parity tests | **High payoff / high current policy risk.** Do not cut now. After the compatibility window, move the live prestige helper out of `wardrobe/model.ts`, preserve one explicit fallback probe, then remove the two unreachable menu implementations and retired-only UI modules. |
| 4 | Two old concept catalogs duplicated into the active art-subject catalog | `data/character-concepts.json` has 50 rows / 411 lines and `data/weapon-concepts.json` has 107 rows / 1,625 lines. All 157 names occur in `tools/artkit/subjects.concepts.json`; current generators and the review tool read the subject file, not the two data catalogs. **Survivor is not yet owner-designated**: the tools currently treat `subjects.concepts.json` as canonical, while the data files may be the better creative source. | **2,036 duplicate source LOC / 106,312 bytes** | **Medium payoff / high provenance risk.** Choose a canonical source and generate the other representation. Do not delete creative inventory merely because runtime has no reader. |

The B43 production extraction also copied very broad import preludes into `SpriteRig` plus six rig
modules and `GameRoom` plus five room modules. A diagnostic `tsc --noUnusedLocals` probe reported
1,853 client and 3,134 server unused-declaration/import diagnostics, overwhelmingly in those copied
headers. TypeScript erases unused imports, so this is source clarity/build-work rather than a second
runtime system; clean it mechanically after higher-payoff cuts.

Duplicated/superseded subtotal: **4 systems** (the test suite and its repeated harness are counted as
one owner action in the summary but kept separate here because they have different risk).

## 5. Dead tests

| Rank | Dead test artifact | Why it is dead or vacuous | Cases | LOC | Action |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | `packages/server/src/rooms/GameRoom.test.ts` | All titles are duplicated by the B43 split suites; running it adds no behavior coverage. | 256 | 7,408 | Delete; keep the ten split suites and their eight newer tests. |
| 2 | `e2e/tests/level-up-window.spec.ts` | Asserts kill XP, numeric levels, a level-up allocation window, and attribute cards deleted by B20. It is still discovered by `e2e/playwright.config.ts`, but root `pnpm test` does not run Playwright. | 1 | 209 | Delete. |
| 3 | `e2e/tests/xp-echoes.spec.ts` | Asserts `xpEchoes`, latch/flight, squad XP, and numeric `player.xp/level`, all deleted by B20. | 1 | 149 | Delete; remove the now-unneeded optional XP/level probe fields from its helper if no other e2e uses them. |
| 4 | `packages/client/src/ui/remote-gear.test.ts` | Its three tests are the only consumer of the retired cache module. They prove isolated transformations for runtime behavior that no longer exists. | 3 | 74 | Delete with `remote-gear.ts`; retain Wardrobe fallback/parity tests named by the retirement plan. |
| 5 | `tests/augments.test.ts:154-161` signature-cadence case | It proves “every fifth level gives six picks” entirely from `SIGNATURE_INTERVAL`; no runtime level or acquisition path participates. It passes vacuously while preserving behavior B20 deleted. | 1 | 8 | Delete the case and constant. Keep chest augment drafting/effect tests. |

Dead-test subtotal: **262 duplicate/dead test cases in 5 artifacts, 7,848 LOC**.

## 6. Unused dependencies

No unused dependency was found in any `package.json` (28 declarations / 20 unique package names).

| Manifest | Result |
| --- | --- |
| Root | Biome, Playwright, Node types, concurrently, pngjs, sharp, TypeScript, Vitest, and workspace `@dd/shared` are all used by scripts, tests, or generators. |
| `packages/client` | `@dd/shared`, `colyseus.js`, Phaser, TypeScript, and Vite are all imported or invoked. |
| `packages/server` | Colyseus schema/transport/server, `@dd/shared`, Node types, `tsx`, and TypeScript are all imported or invoked. |
| `packages/shared` | Colyseus schema and TypeScript are both required. |
| `packages/desktop` | Workspace client staging, Electron, and electron-builder are all script/config inputs. |
| `tools/artkit` | `free-tex-packer-core` is used by atlas packing and `sharp` by image generation/validation. |

Unused-dependency subtotal: **0**.

## Guardrails and negative findings

- **Belt is not dead.** It remains an active URL/matchmaking mode with substantial source and assets,
  and the owner explicitly said not to treat the B57 collapse roadmap as completed.
- **Wardrobe compatibility is not a free deletion.** Ordinary UI is unreachable, but the retirement
  plan preserves old-row parsing, dev/archive probes, and the asset-failure fallback.
- **B74 movement teardown is clean.** No old player acceleration, deceleration, turn-hitch, or
  backpedal scalar remains. `PROCEDURAL_JIGGLE` is a one-line deprecated source-compatibility alias
  to live `PROCEDURAL_LIMB_PHYSICS`; keep until consumers have had a compatibility window.
- **Weapon `scalingGrades` and `requirements` are clean.** They occur only in negative canon tests,
  not definitions or generators.
- **Shopkeeper runtime is clean.** Remaining code references are negative canon/e2e assertions and
  the archived art recipe/portrait reported above.
- **POI/wear-route teardown is clean except ashlands tile 1.**
- **`sol/b59-spec-reconcile` and `sol/diag-rb-*` are unmerged branch history, not shipped-tree dead
  code.** They were not used as deletion evidence.
- Dynamic loaders, manifest/frame-variant indirection, LDtk/codegen inputs, reference pages, and
  `?dev=` routes were checked before classifying assets. The protected weapon concept expansion
  file and the parallel lava/walkability/skate/reverse-bullet areas were not modified.

## Verification

- `pnpm assets:check` — PASS.
- `pnpm gen:check` — PASS. The check reported its existing unavailable untracked VFX-reference and
  character-scale measurement warnings, but every tracked generated output was in sync.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS: **235/235 files, 2,850 passed, 20 intentionally skipped, 2,870 total**.
  One full run was required and run because this lane deletes nothing.

## Lane disposition

This lane intentionally commits only this report. Recommended first implementation batch:
`GameRoom.test.ts`, the two B20 e2e specs, `remote-gear.ts` plus its test, the stale augment cadence
case, and the eight surgical source cuts. That batch should run the full suite twice because it
would delete code, even though this report-only lane needs one run.

VERDICT: 8 confidently-dead items (624 LOC), 124 orphaned assets (15.44 MiB), 1 dormant system, 4 duplicated/superseded systems, 262 dead/redundant test cases in 5 artifacts, 0 unused dependencies; actually deleted: nothing (report only); tests: gen:check PASS, typecheck PASS, full test PASS once (235 files, 2,850 passed, 20 skipped).
