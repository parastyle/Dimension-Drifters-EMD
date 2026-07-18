# Tooling, assets, and pipeline audit — 2026-07-18

Scope: `tools/**`, `data/*.json`, `packages/client/public/**`, root scripts, `.github/workflows/ci.yml`, `.gitignore`, and `docs/**` on `feat/v0.118-metagame`. This was a read-only audit; the running dev server and render fleet were not touched. The known repo-wide Biome/CRLF baseline is intentionally omitted.

## Measured inventory

`packages/client/public` contains 2,001 files / 202.48 MiB:

| Category | Files | MiB | Audit read |
|---|---:|---:|---|
| `sprites/` | 966 | 64.55 | 5.51 MiB atlas, 5.49 MiB duplicate core loose parts, 13.37 MiB on-demand expansion parts, plus gear/pets/boilerplate/Seam-Eater |
| `belt/` | 15 | 38.92 | largest format hotspot; every file is effectively opaque |
| `cards/` | 312 | 34.33 | disciplined JPEG set; count matches `CARD_ART_IDS` |
| `vfx/` | 131 | 17.92 | hero images, impacts, and packs; only a subset is covered by `assets:check` |
| `ui/` | 116 | 16.40 | only `ui/menu/*` (1.15 MiB) has a client URL consumer; 15.25 MiB is unreachable |
| `tiles/` | 26 | 12.43 | selected dimension kit plus the legacy Wild-West ground |
| `particles/` | 100 | 9.89 | 96 manifest packs plus four explicitly referenced PER wisps |
| `audio/` | 257 | 3.91 | 256 MP3s plus runtime manifest; authoring/public manifests currently agree |
| `pois/` | 31 | 3.00 | 6 base plus 25 themed assets |
| `decals/` | 47 | 1.14 | 9 base plus 38 themed assets |

Other scope counts: `tools/artkit` has 37 top-level `.mjs` commands plus six production `lib/` modules; `docs` has 133 files / 3.58 MiB, including 35 `*-panel` directories (117 files); `data` has five JSON catalogs.

### Tool lifecycle classification

| Class | Files | Disposition |
|---|---|---|
| Living commands/gates | `build-weapon-vfx`, `check-assets`, `gen-art-geometry`, `gen-card-manifest`, `gen-character-roster` (temporary legacy), `gen-dimensions`, `gen-dimension-subjects`, `gen-gear`, `gen-pets`, `gen-vfx-subjects`, `gen-weapon-expansion`, `harvest-install`, `install-cards`, `map-art-qa`, `orchestrate`, `pack-atlas` | Keep, but make every deterministic gate depend only on tracked inputs; retire `gen-character-roster` with the old character runtime. |
| Living asset recipes | `gen-belt-backdrops`, `gen-belt-decks`, `gen-card-factory`, `gen-decals`, `gen-particle-packs`, `gen-ribbon-sheets`, `gen-seam-eater`, `gen-seam-eater-materials`, `gen-terrain-kits`, `gen-tiles`, `gen-tome-open`, `pad-map-decals`, `remediate-map-art`, `slice-scatter` | Keep reproducibility, but move under `tools/artkit/recipes/` so they are not mistaken for normal gates. |
| Finished campaigns to archive/split | `gen-character-concepts`, `gen-final-sprint`, `gen-sprint2`, `key-impacts`, `final-run-day1.cmd`, `final-run-day2.cmd`, `final-run-fx.cmd` | Preserve under `tools/artkit/campaigns/2026-07-final/` only after extracting any still-useful recipe into a named living command. |
| Prune now | `gen-outlines`, `card-mock`, `build-border-chooser` | Retired or throwaway; they either conflict with the replacement bake or support unreachable assets. |

### `data/*.json` classification

| File | Actual role | Disposition |
|---|---|---|
| `weapon-concepts-300.json` | Living source for expansion codegen and card/VFX recipes (`tools/artkit/gen-weapon-expansion.mjs:20`, `tools/artkit/gen-card-factory.mjs:30`). | Keep as canonical data. |
| `dimensions-design.json` | Living source for dimension runtime codegen and art subjects (`tools/artkit/gen-dimensions.mjs:17`, `tools/artkit/gen-dimension-subjects.mjs:15`). | Keep as canonical data, but mark narrative-only fields explicitly. |
| `dimension-shifters.json` | Living source paired with dimensions (`tools/artkit/gen-dimensions.mjs:18`, `tools/artkit/gen-dimension-subjects.mjs:16`). | Keep as canonical data. |
| `character-concepts.json` | Provenance catalog; production character names/prompts are instead read from `tools/artkit/subjects.concepts.json` (`tools/artkit/gen-character-roster.mjs:14,33`). | Archive as provenance after the gear migration, or generate the subject projection from it; do not keep two editable truths. |
| `weapon-concepts.json` | Unimplemented design inbox; its only active declaration is the open promotion item (`BACKLOG.md:39`), with no tools/packages/tests consumer. | Move to `data/incubator/` with an owner/status header, or delete once the promotion decision is closed. |

## P0

No P0 finding was substantiated in this territory.

## P1

### P1-1 — `gen:check` can report green after skipping the checks that need a clean checkout most

**Evidence:** root `gen:check` advertises character, VFX-subject, weapon-VFX, and portal drift checks (`package.json:21`), but `tools/artkit/out/` is globally ignored (`.gitignore:11`); `gen-character-roster` explicitly exits 0 when ignored part reports are absent (`tools/artkit/gen-character-roster.mjs:6,23-29`), `gen-vfx-subjects` does the same for 297 reference images (`tools/artkit/gen-vfx-subjects.mjs:73-79`), and `build-weapon-vfx` exits 0 when the binary authoring artifacts used by its committed output are absent (`tools/artkit/build-weapon-vfx.mjs:32-53`).

**Why it matters:** CI's green `gen:check` is not proof that several committed generated artifacts are reproducible or current.

**Smallest honest fix:**

1. Split `gen:check` into strict tracked-input codegen and an optional `art:check`; a strict command must never use “SKIPPED” as success.
2. Make `gen-character-roster` derive scale/geometry from the tracked sprite manifest, or remove it from `gen:check` now and delete it when legacy character selection retires.
3. Make `build-weapon-vfx` generate semantic TS from `assignments/*.json` plus a tracked promoted-asset registry; leave binary copying to a separate install command, then fail if a referenced promoted asset is missing.
4. Treat `gen-vfx-subjects` as an art-queue recipe, not a CI codegen gate, unless its style-reference existence contract is moved to tracked sources.
5. Keep portal checking strict after the shared build; missing `dist` should be a failure in CI, not an exit-0 branch (`tools/portal/gen-portal.mjs:18-25`).

### P1-2 — Load-bearing runtime/test manifests live under a directory declared disposable and ignored

**Evidence:** `.gitignore:1,11` says nothing load-bearing belongs in `tools/artkit/out/`, yet the client directly imports `out/gear/gear-parts-manifest.json` (`packages/client/src/sprites/gear-parts.ts:3`) and three client tests read the same path (`packages/client/src/sprites/gear-parts.test.ts:21`, `packages/client/src/sprites/gear-texture-baker.test.ts:22`, `packages/client/src/ui/wardrobe/preview.test.ts:29`); the geometry generator and Vitest also consume `out/orientation/weapon-axis-report.json` (`tools/artkit/gen-art-geometry.mjs:11-14`, `tests/weapon-orientation-fixer.test.ts:8-12`).

**Why it matters:** these files must be force-tracked against the ignore rule, so ordinary staging hides their changes and a cleanup of “disposable output” can break builds or tests.

**Smallest honest fix:** move the gear contract to `tools/artkit/manifests/gear-parts-manifest.json` (or a generated JSON beside `gear-parts.ts`) and the reviewed orientation input to `data/reviewed/weapon-axis-report.json`; update the two generators and all imports, then leave only raw renders/logs under `out/`—do not paper over this with more `!` exceptions.

### P1-3 — CI checks the five-part code gauntlet, but its asset gate omits most dynamic asset families and all audio

**Evidence:** CI does cover shared/downstream TypeScript (`.github/workflows/ci.yml:27-28`), Biome (`:29`), Vitest (`:35`), production builds (`:38-39`), and browser E2E (`:78-80`); however `check-assets` registers only six source manifests (`tools/artkit/check-assets.mjs:11-18`) and currently reports only 6 POIs/9 decals even though the runtime imports all five POI and decal manifests (`packages/client/src/scenes/arena/floor-renderer.ts:21-30`) and disk contains 31/47; root `assets:check` is only that one script (`package.json:22`), while the existing sound checker is absent from root scripts/CI and intentionally passes with missing P2+ files or orphans (`tools/soundkit/check-sfx.mjs:5,89-99,122-136`).

**Why it matters:** a PR can delete themed terrain/POI/decal, gear, pet, Seam-Eater, tome, menu, belt, impact, or audio files and still pass the advertised asset gate.

**Smallest honest fix:**

1. Replace the hard-coded `manifestPaths` object with one asset-registry module covering base + themed POI/decal manifests, terrain/menu/belt patterns, gear and pet JSON, Seam-Eater roles, tome URLs, impact strips, weapon-VFX packs, and the atlas.
2. Add `"sfx:check": "node tools/soundkit/check-sfx.mjs --strict"`, make strict mode fail on any missing/orphan/malformed entry, and run it after `assets:check` in CI.
3. Filter the sound check's installed set to `*.mp3`; today it always calls its own `manifest.json` an orphan because `readdirSync(DST)` admits every file (`tools/soundkit/check-sfx.mjs:79-83,122-123`).
4. Add reverse ownership: every public file must be claimed by exactly one registry/manifest or an explicit allowlist; make orphan atlas frames failures rather than warnings (`tools/artkit/check-assets.mjs:183-187`).

### P1-4 — 15.25 MiB of `public/ui` is unreachable, and the remaining portal entry for its border experiment is broken

**Evidence:** the only client URL under `public/ui` is the five level-select images (`packages/client/src/scenes/MenuScene.ts:207-220`); nevertheless `gen-final-sprint` installed 57 portraits, 7 future boss splashes, 3 title alternatives, and 2 outcome banners (`tools/artkit/gen-final-sprint.mjs:25-42,47-68,73-89`), while `build-border-chooser` says the six 8.03-MiB borders merely await wiring and writes its chooser to ignored `out/border-chooser.html` (`tools/artkit/build-border-chooser.mjs:140-155`) but the portal links Vite at `/border-chooser.html` (`tools/portal/gen-portal.mjs:120`), where no file exists.

**Why it matters:** Vite copies 15.25 MiB of unused experiments into every client artifact while the one discovery link that suggests they are live cannot resolve.

**Smallest honest fix:** move `portraits/`, `splash/`, `title-*.jpg`, `banner-*.jpg`, `shopkeeper.jpg`, `icons/`, and `border-*.png` to `assets/archive/ui-2026-07-final/` (or delete after owner sign-off), remove the four unused `icon-manifest-*.ts` files, remove the Border Chooser portal row and builder, and delete/archive `gen-final-sprint`; keep only the five `ui/menu/*.jpg` files in public until code actually claims another family.

### P1-5 — Belt art is 19% of all public bytes because photo-like opaque frames are encoded as PNG

**Evidence:** the backdrop generator explicitly removes alpha and writes compression-level-9 PNG (`tools/artkit/gen-belt-backdrops.mjs:90-91`), the deck generator also writes PNG (`tools/artkit/gen-belt-decks.mjs:73-74,101`), and ArenaScene selects only one level's pair (or the four sky-carrier frames) at load time (`packages/client/src/scenes/ArenaScene.ts:1686-1704`); metadata inspection found all 15 files opaque, including four deck PNGs carrying an all-255 alpha channel.

**Why it matters:** 38.92 MiB of deployment/repository weight is spent on an encoding mismatch, not additional content.

**Smallest honest fix:** first change the five `bg-*` outputs and URLs to WebP and visually approve quality 82 (measured 12.30 MiB → 0.45 MiB); then convert the remaining ten, including stripping the redundant deck alpha, which measured 38.92 MiB → 2.47 MiB total (36.46 MiB / 94% smaller), retaining the PNG sources only in non-public authoring storage if lossless masters are desired.

## P2

### P2-1 — The packed core atlas ships beside all 411 loose source frames

**Evidence:** `pack-atlas` reads every non-`x2-` loose part from `public/sprites` and writes the atlas back to the same directory (`tools/artkit/pack-atlas.mjs:17-18,23,36-43,64-67`); ArenaScene boot-loads only the multiatlas (`packages/client/src/scenes/ArenaScene.ts:1676-1680`), yet the loose files remain as a fallback (`packages/client/src/entities/SpriteRig.ts:155-172`).

**Why it matters:** the 5.49 MiB core loose set and 5.51 MiB packed atlas are two deployed copies of the same 411 frames, blurring source-versus-runtime ownership.

**Smallest honest fix:** move non-expansion loose masters to `assets/sprites/core/`, have `harvest-install` and `pack-atlas` use that tracked source, keep only `dd-sprites.{json,png}` in public for core rigs, and retain loose public files solely for the 332 genuinely on-demand expansion parts; update `check-assets` to validate source parts plus shipped frames separately.

### P2-2 — The new gear bake parses an exact Markdown table hidden inside one of 35 panel directories

**Evidence:** `gen-gear` names `docs/metagame-panel/gear-systems.md` as an input (`tools/artkit/gen-gear.mjs:84`), locates the launch table and a heading with string searches, then parses cells with a regex (`tools/artkit/gen-gear.mjs:323-357`), even though it separately has a proper AST reader for the authoritative runtime catalog (`tools/artkit/lib/gear-catalog.mjs:35-70`); the generator records both panel documents as manifest sources (`tools/artkit/gen-gear.mjs:2103-2113`).

**Why it matters:** a prose edit, heading rename, pipe character, or future docs archive can break a production art bake, making research notes an undeclared schema.

**Smallest honest fix:** create `tools/artkit/gear-art-descriptions.json` keyed by canonical `GEAR_CATALOG` id, migrate the 96 descriptions and source-character mappings, validate exact ID coverage against `gear.ts`, and render the Markdown launch table from that data (or leave it historical); then add `docs/README.md` with `canonical`, `active-spec`, `decision-record`, and `archived-panel` statuses and move completed raw panels to `docs/archive/YYYY-MM/<topic>/` only after code references are removed.

### P2-3 — The retired global outline mutator remains executable beside the replacement bake that now owns outlines

**Evidence:** `gen-outlines` recursively targets all public sprite PNGs and selected VFX (`tools/artkit/gen-outlines.mjs:35-52,137-153`), writes modified bytes in place and stores originals only below ignored `out/outlines` (`tools/artkit/gen-outlines.mjs:10,37-40,243-248,319,373`); the replacement bake now keys, registers, outlines, validates, and installs each asset itself (`tools/artkit/gen-gear.mjs:662,975-1020,1307-1349`) under the single-outline contract (`docs/gear-replacement-panel/blueprint.md:123-127`).

**Why it matters:** accidentally running the old command can double-outline or mutate tracked installed assets with its only automatic recovery copy in disposable storage.

**Smallest honest fix:** delete `gen-outlines.mjs` now; if historical reproducibility is required, preserve its text in `tools/artkit/campaigns/retired/README.md` or repository history, not as an executable top-level command.

### P2-4 — Artkit's flat command namespace does not distinguish gates, reusable recipes, and completed campaigns

**Evidence:** top-level filenames include self-described “Throwaway” (`tools/artkit/card-mock.mjs:1-3`), “FINAL SPRINT” (`tools/artkit/gen-final-sprint.mjs:2-4`), “last-window odds and ends” (`tools/artkit/gen-sprint2.mjs:2-4`), and a Day-2 batch file that only echoes TODO commands (`tools/artkit/final-run-day2.cmd:2-5,12-35`) next to actual CI generators referenced from `package.json:20-22`; the current README still presents only the original two-pass card pipeline (`tools/artkit/README.md:5-22`).

**Why it matters:** a maintainer cannot tell which of 37 commands is supported, destructive, API-spending, obsolete, or required after changing an input.

**Smallest honest fix:** apply the lifecycle table at the top of this report: retain stable entry points in `tools/artkit/commands/`, asset regeneration in `recipes/`, dated work in `campaigns/`, delete the three “prune now” scripts, and add `tools/artkit/COMMANDS.md` with columns for input, output, network/API use, destructive writes, resumability, and gate membership.

### P2-5 — Canonical data and render-subject data remain parallel editable catalogs

**Evidence:** runtime expansion generation reads `data/weapon-concepts-300.json` (`tools/artkit/gen-weapon-expansion.mjs:20`), but art rendering uses the separate 301-row `tools/artkit/subjects-300.json`; character generation reads `tools/artkit/subjects.concepts.json`, not `data/character-concepts.json` (`tools/artkit/gen-character-roster.mjs:14,33`), while the two dimension subject catalogs correctly have a checked generator (`tools/artkit/gen-dimension-subjects.mjs:2-16`).

**Why it matters:** names, prompts, palettes, tags, and card actions can diverge without changing runtime codegen or failing CI.

**Smallest honest fix:** copy the dimension pattern: add checked generators for `subjects-300.json` and the `cc-*` portion of `subjects.concepts.json` from canonical `data` records, keep only genuinely hand-authored non-catalog subjects as a small overlay file, and move the unused 107-weapon catalog to `data/incubator/` until it is promoted.

### P2-6 — Image-processing laws are duplicated with different thresholds, and gear/pet install primitives are duplicated too

**Evidence:** the nominal canonical keyer uses `g > 140`, dominance tolerance 90, and red/blue caps (`tools/artkit/guards/chroma-key.mjs:28-34`); decals copy that rule (`tools/artkit/gen-decals.mjs:249-267`), particles instead key solely on dominance and add a soft-alpha band (`tools/artkit/gen-particle-packs.mjs:64-77`), Seam-Eater uses ratio thresholds (`tools/artkit/gen-seam-eater.mjs:85-91`), and the gear and pet generators each implement their own `alphaBounds`, `nearestVisible`, and install pipeline (`tools/artkit/gen-gear.mjs:878-948,975-1055,1307`; `tools/artkit/gen-pets.mjs:531-617`).

**Why it matters:** the stated pinned chroma/registration contract produces family-specific edge and pivot behavior, so a fix in one generator does not protect the others.

**Smallest honest fix:** extract pure `lib/chroma.mjs` and `lib/rgba-registration.mjs` functions with explicit named presets only where differences are intentional, migrate gear + pets first, add fixture tests for alpha bounds/pivot/green despill, then migrate decals/particles/Seam-Eater; keep prompt and job orchestration in the individual recipes.

### P2-7 — `pnpm gen` can regenerate the portal from stale shared output

**Evidence:** the portal imports `packages/shared/dist/index.js`, not source (`tools/portal/gen-portal.mjs:9-10,18-25`), while root `gen` first rewrites shared generated source and calls the portal last without rebuilding shared (`package.json:20`); CI avoids this only because it builds shared before `gen:check` (`.github/workflows/ci.yml:25-32`).

**Why it matters:** a normal local `pnpm gen` after a weapon/dimension change can commit an internally stale portal even though each individual command succeeds.

**Smallest honest fix:** insert `pnpm --filter @dd/shared build` immediately before `gen-portal` in the write path, or better have the portal read the same tracked JSON/TS AST sources as the other generators; make non-check mode fail with an explicit “build shared first” message if dist is absent or older than its inputs.

## P3

### P3-1 — The isolated artkit has two conflicting lockfiles and stale setup documentation

**Evidence:** the README permits either pnpm or npm (`tools/artkit/README.md:14-18`), while both `pnpm-lock.yaml` and a 951-KiB `package-lock.json` exist; the pnpm lock contains only Sharp while `package.json` also requires `free-tex-packer-core` (`tools/artkit/package.json:12-15`), and the README still says the DD chroma guard is TODO although it exists (`tools/artkit/README.md:12`, `tools/artkit/guards/chroma-key.mjs:2`).

**Why it matters:** installs are not reproducible across the two documented package-manager paths, and the primary operator guide no longer describes the current pipeline.

**Smallest honest fix:** choose pnpm to match the monorepo, delete `package-lock.json`, regenerate the isolated pnpm lock from `package.json`, add `packageManager: "pnpm@9.12.0"`, and replace the stale README status section with the command lifecycle/index described above.

### P3-2 — CI has the full gauntlet, but developers have no single command that means the same thing

**Evidence:** root exposes separate `typecheck`, `test`, `build`, `e2e`, and `lint` scripts (`package.json:16,19,23-27`), while CI manually composes their optimized equivalents across three jobs (`.github/workflows/ci.yml:25-39,55-60,78-80`) and its header comment omits browser E2E (`.github/workflows/ci.yml:1`).

**Why it matters:** “the gauntlet passed” can mean different subsets locally even though CI itself currently covers Vitest + TypeScript + build + E2E + Biome.

**Smallest honest fix:** add a documented root `verify` script for the canonical local order (`typecheck`, strict codegen/assets/SFX checks, Vitest, build, E2E, Biome) and update the CI comment to name all jobs; keep CI's current de-duplicated implementation rather than invoking the slower wrapper there.

## Executive summary

- No tooling/assets P0 was found; the urgent risks are false-green generation checks and load-bearing files hidden under ignored scratch.
- CI does run Vitest, TypeScript, build, browser E2E, and Biome, but asset coverage is narrow and soundkit is not gated.
- Pruning/moving unreachable UI removes 15.25 MiB, while WebP conversion of the 38.92-MiB belt set has a measured 36.46-MiB opportunity.
- Delete the retired outline mutator and border/card throwaways; archive dated campaigns, but retain named recipes needed to reproduce shipped art.
- Establish tracked manifest locations, one canonical data projection path, and indexed `commands/recipes/campaigns` plus `docs/archive` conventions.
