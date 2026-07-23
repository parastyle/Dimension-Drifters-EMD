# Pet 5 — Systems & Integration

## 1am summary

The game ships **8 pets**, not 24; the portal's 24 is eight pets times three visual bands. Keep every existing ID and Bond XP row, move the eight current mechanics into reusable function profiles so the 16 proposed pets can share them exactly, and store evolution/fusion as stable form recipes—not image filenames—around the old progress. Use one parent pet as a fusion's Heart, never combine powers or consume parents, and migrate accounts once to V5 while old saves still round-trip safely. Add the renderer, account version, real pet-purchase path, and roster waves behind flags first; only after they work together should the manifest counts, tests, generated portal, and release census change, preventing the repo's two real failure modes: a half-refactor that erases saves and a stale pinned census that crashes boot.

## Assumptions log

- This is planning only. No product code, assets, catalogs, generated files, or tests will be edited.
- The shipped count will be reported from executable shared definitions, while any larger number found in plans or portal copy will be labeled planned content rather than shipped content.
- Existing stable pet IDs, bond XP, and normalized part-slot semantics are compatibility boundaries.
- The default recommendation will optimize for personal expression and safe migration, even if it accepts deliberate mechanical duplication.

## Investigation log

- Report initialized before codebase investigation, as required.
- Read `docs/sol-reports/README.md`; this file is being updated after each completed investigation block so it remains useful if the run is interrupted.

## Verified shipped pet substrate

The executable catalog is `packages/shared/src/pets.ts`, and it contains **8 shipped pet definitions**, not 24: `verdant-wing`, `hearth-newt`, `lodestar-moth`, `copper-snail`, `gilded-gecko`, `brass-crab`, `pale-firefly`, and `slate-tortoise`. Twenty-four is not a shipped-pet count in this system; the installed art manifest happens to contain 24 visual stage entries (8 pets × 3 bands), which is another reason not to repeat “24 pets” without qualification.

- Bond has 10 levels with cumulative thresholds `0, 120, 300, 540, 840, 1200, 1620, 2100, 2700, 3600`; XP is floored and clamped to `0…3600`.
- The three shipped visual bands are Hatchling at levels 1–3, Awakened at 4–7, and Ascendant at 8–10. The capstone activates only at level 10, not merely on entering band 3.
- `PET_CATALOG_VERSION` is `1`. The code says numeric tuning is resolved once at a run boundary and the active run retains its joined version and values.
- `PetMods` is a source-neutral, server-consumed result object. Each catalog entry owns one `budgetKey`, one per-level bonus definition, and one level-10 capstone definition; `petModsForLevel` resolves those authored clauses into the fixed modifier fields.

| Shipped pet | `budgetKey` | Scaling bonus | Level-10 capstone |
|---|---|---|---|
| Verdant Wing | `sustain.regen-ammo` | +5% passive **HP** regen per level | defines +1 thrown-gun charge capacity |
| Hearth Newt | `sustain.healing` | +2% healing received per level | heal 15% max HP on descent |
| Lodestar Moth | `economy.xp-collection` | +18 XP-mote reach per level | 600-radius boundary echo sweep |
| Copper Snail | `economy.weapon-carry` | earned-pickup reach (`46 + 4 × level`) | +1 bag capacity |
| Gilded Gecko | `economy.earned-sale` | +2% sale rate and +2 cap per level | sale cap becomes 30 |
| Brass Crab | `resource.reload-refill` | −1% reload duration per level | 1.25× stowed reload rate |
| Pale Firefly | `sustain.revive` | +6 revive reach per level | revive at 40% HP |
| Slate Tortoise | `sustain.ground-hazard` | −1.5% ground-hazard damage per level | 1.5× pit regen for 3 seconds |

The table above is the catalog contract, but runtime consumption is not perfectly aligned with it. `GameRoom` actively reads HP regen, healing/descent heal, XP reach/boundary sweep, earned-pickup reach/bag capacity, sale rate/cap, revive reach/HP, and ground-hazard/pit-regen fields. It does **not** currently read `weaponChargeCapacityAdd`, `reloadDurationMultiplier`, or `stowedReloadRate`; the server tests explicitly pin that Verdant's retired charge capstone cannot fork the newer Drive resource and Brass Crab cannot accelerate retired reload debt. Thus Verdant's scaling bonus is live but its capstone is dormant, while Brass's defined package is presently dormant. Phase 1 must either reconnect/redefine those effects at valid Drive seams or keep new pets off those profiles; duplicating a no-op would create exactly the trap this expansion is meant to avoid.

The visual system is already the right foundation. `PET_PART_SLOTS` deliberately stabilizes the logical contract as `core`, `primary`, `secondary`, with the explicit comment that later evolution/fusion manifests can replace parts **without migrating accounts**. Separately, `packages/client/public/sprites/pets/pet-parts-manifest.json` is schema v1, socket frame `PET_SOCKET_FRAME_V1`, and currently complete: 8 pet entries, 24 stage entries, 72 installed parts, with empty `missing`, `extras`, and `invalid` lists. Its render vocabulary is richer than the three logical save slots: `body`, `crown`, `dorsal`, `rear`, `shell`, `side.far`, `side.near`, `side.paired`, `tailTip`, and `ventral` sockets/classes. `packages/client/src/sprites/pet-parts.ts` fetches that manifest, resolves an entry by `(petId, stageBand)`, assembles parented parts by normalized sockets, constrains each band to a display envelope, and loads only the chosen form's loose textures.

That split is the enabling architecture: accounts should persist stable identity/choice keys, not filenames or socket coordinates. Unlike a human wardrobe, creature mutations do not promise that arbitrary sleeves, torsos, and hands meet at natural seams; an extra wing, off-center shell, floating halo, or donor tail reads as intentional evolution. Authored recipes can therefore exploit reusable sockets and modular cutouts while still being visually validated as whole creatures.

## Verified accounts, persistence, and authority

The current account record is `MetaAccountV4` in `packages/shared/src/meta.ts`. Its pet surface is:

```ts
interface PersistedPet {
  bondXp: number; // lifetime total
}

interface MetaAccountV4 {
  version: 4;
  revision: number;
  // scrip, gear, prestige, weapon bank omitted
  pets: Partial<Record<PetId, PersistedPet>>;
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number;
}
```

Presence of a canonical ID in `pets` is the ownership bit; `selectedPetId === ""` is the supported no-pet accessibility choice. `verdant-wing` is always restored as the starter when a cache is missing or damaged. The V2, V3, and V4 sanitizers iterate the compiled `PET_IDS`, clamp Bond XP, discard unknown IDs/fields, require the selected pet to be owned, and preserve pet rows through the existing V2→V3→V4 migrations.

`packages/client/src/ui/pet-select.ts` stores the complete sanitized V4 blob in local storage key `dd.metaAccount.v4`, migrates `dd.metaAccount.v2` plus older belt keys, and writes complete replacement account messages received from the server. This is an MVP local/offline cache, not yet a durable authenticated account database. `packages/server/src/rooms/GameRoom.ts` explicitly trusts client-authored progression only in the enabled developer/belt context; a public deploy starts from defaults until an authenticated account store owns progression. That is a real delivery cost for any promise of durable collection/fusion across devices.

At join/ready, `GameRoom.snapshotPetRun` derives level and band from the owned row, calls `petModsForLevel`, and stores an immutable run snapshot containing pet ID, level, band, catalog version, resolved mods, and accrual counters. Only `PlayerState.petId` and `petLevelBand` are public on the Colyseus schema (`packages/shared/src/state.ts`); exact XP and level remain owner-private. At a terminal victory/defeat seam, `bankPetBondXp` awards at most 500 XP, changes only the selected owned pet, reports band/capstone transitions, and the server commits the account once with a bumped revision and complete replacement message.

Compatibility consequence: adding a pet definition needs no conceptual new ownership field—add a stable ID to `PET_IDS`/`PET_CATALOG`, grant `{ bondXp: 0 }`, and the existing map semantics work—but old compiled sanitizers do not know that ID and will drop its row when they rewrite a full account. A roster rollout therefore needs a minimum compatible client/account schema gate or server-owned persistence before grants begin. This silent unknown-ID stripping is the save-breaking edge that an apparently “additive” catalog change must not ignore.

There is also no generic acquisition transaction today. Outside tests, the only runtime writes that add an owned row are the developer-portal projection in `packages/client/src/scenes/MenuScene.ts` and Slate Tortoise's terminal-victory pity award in `packages/server/src/rooms/GameRoom.ts`; the menu displays “160 Scrip egg · Companion shop” for the other locked pets but has no corresponding purchase handler. A larger catalog is not real merely because it is typed and rendered: it needs a server-authoritative, idempotent grant/purchase seam with revision checks, price/unlock data, receipts, and tests.

## Verified census, portal, and duplicated catalogs

The developer portal does not claim 24 base pets in its generator. `tools/portal/gen-portal.mjs` builds `pets` by flat-mapping each `PET_ID` over `PET_STAGE_DEFS`, then reports `catalogs.pets.length`; `tools/portal/index.html` is its committed generated output. The displayed **24** is therefore **24 companion-stage rows = 8 species × 3 bands**. The portal imports `packages/shared/dist/index.js`, so a stale shared build can also generate stale rows. Its pet launch URL carries only `/?dev=pet:<petId>`; `MenuScene.devInspectionAccount` grants/selects that base ID and has no branch/fusion selector.

The art source duplicates the roster independently. `tools/artkit/gen-pets.mjs` owns a literal eight-row `PETS` array, every stage/part job and prompt, the socket table, stage names, and the expected file set. It derives `expectedPartCount` from `JOBS.length` and `installedPartCount` from validated files; the committed runtime `packages/client/public/sprites/pets/pet-parts-manifest.json` currently says 72/72. Missing rows appear in `missing` but the generator exits nonzero only for render failures, extras, or invalid files—not for a validate-only manifest that is merely incomplete—so rollout needs a separate completeness gate.

`packages/client/src/sprites/pet-parts.test.ts` is presently the only direct pet-manifest test. It is explicitly pinned to “all 24 forms,” `manifest.pets` length 8, and a 2–4 part range, then spot-checks Verdant Wing and Gilded Gecko socket math. All three assertions become stale under a larger, more divergent roster. `tools/artkit/check-assets.mjs`, despite being the CI `assets:check`, does **not** inspect the pet JSON manifest or its loose PNG paths today.

There is no current pet-specific import-time count guard. The repository's demonstrated crash pattern is visible in `packages/shared/src/weapon-resource.ts`: module initialization throws unless the hard-coded 336 total and 327-active/9-archived censuses match. Because `@dd/shared` is imported before the server starts, one forgotten integer can crash boot. Do not introduce that pattern for pets. Pet consistency checks should prove set equality and referential integrity from canonical data; any human-readable release target (for example 24 base pets) belongs in a test/release assertion updated atomically with the catalog, never in an unconditional production import throw.

## Complete synchronized touch-list

The following surfaces must move in one compatibility-reviewed change before a new roster flag is exposed:

| Surface | Files | What changes or must be checked |
|---|---|---|
| Canonical identity/function | `packages/shared/src/pets.ts`; export route through `packages/shared/src/meta.ts` and `packages/shared/src/index.ts` | IDs/type union, definitions, catalog epoch, shared function-profile references, form keys/slots, resolver exhaustiveness, and set-equality checks. The **shipped base count** is `PET_IDS.length`. |
| Account schema | `packages/shared/src/meta.ts`; `packages/client/src/ui/pet-select.ts`; `packages/server/src/rooms/progression.ts`; `packages/server/src/rooms/GameRoom.ts` | V5 creation/sanitize/migrate, local-storage key and fallback, owned rows, selected Heart/appearance, branch choices, fusion instances, grants, run snapshot, Bond banking, revision/idempotency, and old-account round trips. |
| Public protocol | `packages/shared/src/state.ts`; `packages/shared/src/constants.ts`; `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/entities/PetRig.ts`; schema pins throughout `packages/server/src/rooms/GameRoom.test.ts` | Dynamic appearance/form recipe must reach every client; append fields, bump `SCHEMA_VERSION` (currently 33), retain no-pet fallback, and stop assuming `(petId, band)` completely identifies art. |
| Mechanical seams | `packages/shared/src/pets.ts`; `packages/server/src/rooms/GameRoom.ts`; `packages/client/src/scenes/MenuScene.ts`; `packages/client/src/scenes/ArenaScene.ts` | Existing `PetMods` hooks can be reused wholesale. Remove ID-specific display/prediction assumptions (`petBonusCopy` switch, Copper-only local reach derivation) in favor of resolved profiles. Preserve one immutable run snapshot. |
| Acquisition and collection UI | `packages/client/src/scenes/MenuScene.ts`; `packages/client/src/ui/pet-select.ts`; `packages/server/src/rooms/GameRoom.ts` | Implement the currently missing purchase/grant transaction. Replace the fixed one-row, 52-pixel-step chip strip—which will not fit 24 pets—with a scroll/page/filter collection. Preload/fallback portrait paths and lock copy must cover every ID. |
| Art source and generated manifest | `tools/artkit/gen-pets.mjs`; `tools/artkit/out/pets/pet-parts-manifest.json` (scratch); `packages/client/public/sprites/pets/pet-parts-manifest.json`; `packages/client/public/sprites/pets/<petId>/...` | Literal pet/prompt specs, forms/branches, slot/socket grammar, donor provenance, jobs, expected/installed counts, empty missing/extra/invalid lists, and all installed cutouts. Do not count stage entries as species. |
| Runtime manifest/renderer | `packages/client/src/sprites/pet-parts.ts`; `packages/client/src/entities/PetRig.ts` | Read manifest v1 and v2 during rollout; resolve `(petId, band, formKey)`; load textures by each part's donor/source path rather than the selected pet ID; support richer slot groups/part counts and data-driven motion; preserve Hatchling fallback. |
| Pet manifest tests/assets gate | `packages/client/src/sprites/pet-parts.test.ts`; `tools/artkit/check-assets.mjs` | Replace hard-coded 8/24/2–4 assumptions with catalog↔manifest set equality, three required default bands per pet, branch/form uniqueness, source-path existence, bounds/socket/parent validity, and declared per-form budgets. Add the pet manifest to `assets:check`. |
| Account/mechanics tests | `packages/server/src/rooms/progression.test.ts`; `packages/server/src/rooms/GameRoom.test.ts`; `packages/client/src/scenes/MenuScene.dev-links.test.ts`; add focused client account/recipe tests beside `pet-select.ts`/`pet-parts.ts` | Update “all eight” goldens into eight **function-profile** goldens plus a loop proving every pet resolves one profile; add V4→V5 round trips, unknown form/fusion handling, non-consuming parents, branch defaults, clone equivalence, acquisition, public recipe, and deep-link coverage. |
| Portal | `tools/portal/gen-portal.mjs`; generated `tools/portal/index.html`; root `package.json`; `.github/workflows/ci.yml` | Emit separate, clearly labeled species and form counts; add form/branch rows and a bounded set of fusion fixtures, not every user combination; version deep links; rebuild shared first; regenerate static HTML. `pnpm gen:check` already checks portal drift in CI, but there is no current pet-count test. |

Count vocabulary for all release notes and guards must be explicit: **base species**, **authored form rows**, **installed part files**, **saved player fusions**, and **portal cards** are five different numbers. At the pet-1 target, the first number becomes 24; it does not imply 24 forms or 24 files.

## Recommended function attachment: reusable profiles, one Heart

Function should be decoupled from **form data**, but v1 should not add a second global function loadout. Extract the eight existing mechanical packages into stable, versioned `PetFunctionProfile` records; each canonical pet references one `functionId`. Every evolution form and branch of that pet keeps the reference. A fused creature chooses one parent as its **Heart** and resolves that Heart's full profile and Bond level. It never averages, splices, stacks, or inherits stats from visual slots.

Conceptually:

```ts
type PetFunctionId =
  | "sustain.regen-ammo.v1"
  | "sustain.healing.v1"
  | "economy.xp-collection.v1"
  | "economy.weapon-carry.v1"
  | "economy.earned-sale.v1"
  | "resource.reload-refill.v1"
  | "sustain.revive.v1"
  | "sustain.ground-hazard.v1";

interface PetFunctionProfile {
  id: PetFunctionId;
  budgetKey: string;
  bonus: PetBonusDef;
  capstone: PetCapstoneDef;
  bonusCopyKey: string;
  capstoneCopyKey: string;
}

interface PetDefV2 {
  id: PetId;
  name: string;
  functionId: PetFunctionId;
  evolutionTreeId: string;
  motionProfileId: string;
  unlock: PetUnlockDef;
}
```

Yes, a new pet can reuse an existing `budgetKey`, bonus, and capstone **wholesale**—and should do so by pointing at the same `functionId`, not by copying three fields that can drift apart. Sharing only a `budgetKey` while changing values or capstones is not wholesale reuse; it creates a new balance package in the same budget lane and needs new goldens and stacking review. `PetMods` itself does not need to grow for exact overlap, and all eight authoritative server seams remain reusable.

For the proposed 24-base-pet target, the clean target is two additions per existing profile. That makes exactly three visual identities per mechanical package, including the shipped source:

| Exact function profile | Shipped identity | New identities with identical numbers/capstone |
|---|---|---|
| `sustain.regen-ammo.v1` | Verdant Wing | Biscuit Jackalope, Manymoon Oracle |
| `sustain.healing.v1` | Hearth Newt | Chapelback Bison, Moonmilk Ooze |
| `economy.xp-collection.v1` | Lodestar Moth | Ghost Coyote Pup, Ragwing Vulture |
| `economy.weapon-carry.v1` | Copper Snail | Rivet Mule, Hungry Boot |
| `economy.earned-sale.v1` | Gilded Gecko | Thimble Deputy, Rambleroot |
| `resource.reload-refill.v1` | Brass Crab | Gravewick Beetle, Rattlesmoke Wyrm |
| `sustain.revive.v1` | Pale Firefly | Crowned Pronghorn, Tollwater Ray |
| `sustain.ground-hazard.v1` | Slate Tortoise | Brimstone Imp, Little Pallbearer |

This mapping is deliberately many-to-one and can be reshuffled before content IDs ship. Once released, a pet's function assignment becomes player-facing identity and should not be silently swapped; numeric tuning can still patch the shared profile behind the catalog epoch. The balance implication is positive: there are still only eight packages to test, and a player choosing between a chapel bison, soft ooze, or ember newt loses **zero** power for taste. Repetition is not filler here; it is how one function stops having one mandatory silhouette.

The table is contingent on Phase 1 restoring or replacing the dormant Verdant capstone and Brass profile with valid, bounded effects. If that work is deferred, remap those four proposed clones across the seven live packages; an uneven number of looks per function is preferable to shipping a cosmetic choice whose advertised mechanic does nothing.

Why not let every player pick any function under any base form immediately? It would require deciding whether a run's Bond XP goes to the visible pet, the function donor, or both; it would also separate visual-band unlocks from mechanical level and add another selection/error state to every account, join, receipt, and UI. The one-Heart rule preserves the shipped meaning of Bond and the immutable run snapshot. Fusion still demonstrates genuine form/function separation because body, wings, crown, shell, and tint do not dictate the selected parent's Heart. If playtests later show three visual choices per profile are still too restrictive, the account shape below can loosen `heartPetId` beyond the two fusion parents without another format change.

## Concrete data contract for pets, forms, and fusion

### A new base pet

A base pet is shippable only when all of the following exist together:

1. A permanent kebab-case `PetId`, display/localization keys, one `functionId`, one evolution-tree ID, a data-driven motion/personality profile, and a real acquisition rule. For example, `biscuit-jackalope` points to `sustain.regen-ammo.v1`; it does not duplicate Verdant Wing's formula.
2. Three required default form records for Hatchling/Awakened/Ascendant with stable `formKey`s, plus all referenced manifest groups and installed textures. A roster row without these is catalogued but visually incomplete.
3. An account grant of `pets["biscuit-jackalope"] = { bondXp: 0 }` performed by an authoritative, revision-checked transaction. Definition presence is not ownership.
4. Selection, collection-grid, locked/unlocked, receipt, menu portrait, in-run rig, dev-link, portal, completeness, and profile-resolution coverage.

No account version bump is required merely because the `pets` map gains a recognized ID **after** V5-capable clients/server own persistence. During the mixed-version rollout, however, grants must remain disabled because V4 clients will sanitize the new key away.

### A new evolution form or branch

Do not add a fourth power stage for this expansion. Add more dramatic forms and optional cosmetic branches *inside* the existing three bands. A form definition is resolved by a stable key, not by array position:

```ts
interface PetFormDef {
  formKey: string;             // e.g. "lodestar-moth:s3:undertaker-lantern"
  petId: PetId;
  band: 1 | 2 | 3;
  branchKey: string;           // "default" or a named cosmetic branch
  manifestFormKey: string;
  motionProfileId: string;
}
```

A non-branching replacement requires **no account write**: the resolver maps `(petId, band, "default")` to the new manifest recipe, so all owners see the improved art. A branch needs only a stable choice key on that pet row; it never stores body filenames, part IDs, pivots, or sockets:

```ts
interface PersistedPetV5 {
  bondXp: number;
  formChoices?: Partial<Record<"1" | "2" | "3", string>>;
}
```

For example, a level-8 Lodestar Moth could store `{ formChoices: { "3": "undertaker-lantern" } }`; the manifest may later replace its lantern body, shovel antennae, and undertaker wing cutouts without changing that account. Missing choice means `default`. Renamed forms require a catalog alias/tombstone, not silent deletion. Branch choice is cosmetic and cannot change `functionId`, `PetMods`, thresholds, or capstone.

If a future design truly adds band 4, that is not “just art.” It requires extending `PetStageBand`, `PET_STAGE_DEFS`, max level/XP thresholds and clamping, progression receipts, all manifest and envelope logic, public band validation, menus/copy, account round-trip fixtures, and schema/version gates. Old clients currently clamp XP at 3600 and accept bands only 1–3, so enabling band 4 without a minimum-client cutover would lose progress and suppress art.

### A fused creature

Use one additive V5 account migration, then let manifests evolve without later account migration:

```ts
type PetAppearanceRef =
  | { kind: "pet"; petId: PetId }
  | { kind: "fusion"; fusionId: string };

interface FusionGroupSourceV1 {
  formKey: string;  // stable authored donor form
  group: PetFormGroupId;
}

interface FusionBandRecipeV1 {
  body: FusionGroupSourceV1;
  groups: Partial<Record<PetFormGroupId, FusionGroupSourceV1 | null>>;
}

interface PersistedFusionV1 {
  schemaVersion: 1;
  fusionId: string;
  name: string;
  sourcePetIds: PetId[]; // deduplicated, flattened base provenance
  heartPetId: PetId;     // exactly one owned source in v1
  bands: Record<"1" | "2" | "3", FusionBandRecipeV1>;
}

interface MetaAccountV5 extends Omit<MetaAccountV4, "version" | "pets"> {
  version: 5;
  pets: Partial<Record<PetId, PersistedPetV5>>;
  selectedPetId: PetId | "";       // retained: selected Heart / compatibility anchor
  selectedAppearance?: PetAppearanceRef; // absent means the selected base pet
  fusions: Record<string, PersistedFusionV1>;
}
```

Keep `selectedPetId` rather than half-renaming it across the stack: for a base pet it is the selected identity; for a fusion it is the Heart. `selectedAppearance` defaults to that base pet on every V2/V3/V4 migration, so old saves are behavior-identical. At run snapshot the server resolves mechanics only from `selectedPetId` and its Bond XP, while it resolves art only from `selectedAppearance` and the active band's flattened recipe.

The saved source unit is a **stable form group**, not an installed PNG. Pet-2's proposed logical groups (`body`, `face`, `core`, side pairs, rear subtree, crown, shell, dorsal, ventral, rider, orbit, aura) map to whichever concrete parts the current manifest supplies. A later manifest can replace three wing images with six or move a crown's pivot; accounts still name the same form/group. A `null` optional group means deliberately empty, not missing data.

Fusions never consume source pets, never copy or reset Bond XP, never store a second power level, and never recursively reference another fusion. Using a saved fusion as a donor flattens its base `formKey/group` sources and deduplicated `sourcePetIds` into the new recipe. Therefore deleting or editing “Mallow” cannot orphan a child made from Mallow, and retiring one texture cannot orphan any account as long as its stable form/group remains resolvable or aliased.

A concrete saved result might be **Mallow**, with a Biscuit Jackalope Ascendant body/ear-antler crown, Verdant Wing's multi-pinion side group, Manymoon Oracle's eye-orbit group, and Verdant Wing as Heart. Mallow runs the exact `sustain.regen-ammo.v1` profile at Verdant Wing's Bond level; none of its visible donor choices has stats. Its three band recipes remain individually authored so Hatchling is not merely the Ascendant collage scaled down.

Bound the local/offline payload before implementation: recommend at most 32 saved fusions, names of at most 24 Unicode code points, known enum/group/form sources only, no arbitrary URLs/coordinates, and a canonical serialized-account size below the server's existing 256 KiB join limit. The sanitizer should reject the individual invalid fusion while preserving valid parents and Bond rows; it must never reset the whole account because one recipe is bad.

### Public runtime descriptor

Other players must be able to render a custom fusion; an owner-private account ID is insufficient. Append a bounded appearance descriptor to `PlayerState` and bump `SCHEMA_VERSION`. Keep `petId` as the current body donor species and `petLevelBand` as a safe default-render fallback, then add a stable `petFormKey` plus a compact server-resolved current-band recipe for dynamic fusions. Exact Bond XP, full account inventory, parent ownership, and Heart choice remain private. On version mismatch the existing client already tells the player to hard-reload.

The manifest loader must use each resolved part's donor/source path. Current `petTextureUrl(petId, band, texture)` assumes every cutout lives under the selected pet; that works for base pets and fails for a Jackalope body wearing Verdant wings. The public recipe should reference approved form groups, the client should resolve those against its installed manifest, and an invalid/missing group should fall back to the body donor's default form for that band—not make the pet or player disappear.

## Phased migration: playable at every step

| Phase | Land behind the existing game | Compatibility/release gate |
|---|---|---|
| **0. Pin the baseline** | Add round-trip fixtures for representative V2/V3/V4 accounts; catalog↔manifest set checks; default-form resolution; cold import/server boot; current eight profile goldens. No player-visible change. | Prove an existing V4 byte-equivalent account still selects the same pet, level, band, mods, and art. Capture the current 8 species / 24 default forms / 72 parts vocabulary explicitly. |
| **1. Extract and audit function profiles** | Move the existing eight bonus+capstone packages behind `functionId` references while preserving `petModsForLevel` output exactly. Make UI copy profile-driven and motion data-driven. Resolve the dormant Verdant charge capstone and Brass reload/stowed-reload fields against the current Drive system, or mark those profiles unavailable to new pets. | Every advertised field has an authoritative consumption test; no function clone ships as a no-op. Existing active hook goldens remain unchanged. `PET_CATALOG_VERSION` changes if tuning changes, not merely for file movement. |
| **2. Teach the renderer forms before adding content** | Introduce manifest v2 and a dual-reader for v1/v2. Resolve stable form keys, richer groups, optional parts, donor provenance, and default fallbacks. Keep the committed v1/default eight visually unchanged. | Manifest set equality, source-path existence, parent-cycle checks, 30/37/44 envelope QA, and memory/performance measurements pass. No account field refers to v2 yet. |
| **3. Migrate accounts once** | Add `MetaAccountV5`, V2/V3/V4→V5 migrations, `dd.metaAccount.v5`, `selectedAppearance`, optional `formChoices`, and empty `fusions`. Continue reading v4 for rollback; never let a V5-aware client overwrite the v4 key until V5 sanitize succeeds. Add the public appearance tail and bump schema 33. | Minimum compatible client/server handshake is live. Round-trip tests prove every old pet row, exact Bond XP, selection/no-pet state, Scrip/gear/prestige/bank, and revision survives. New-ID grants remain disabled. |
| **4. Make collection acquisition real; stage Wave A dark** | Add server-authoritative purchase/grant requests and receipts, then add pet-1 Wave A's eight IDs, exact shared function references, default forms, portraits, and manifests behind a disabled roster flag. Replace the fixed chip strip with the collection grid. | Old clients cannot join a new-roster session. Every staged ID has all three defaults, a real unlock route, profile, motion, and art. Missing assets fall back safely; no staged ID is grantable until the complete wave passes. |
| **5. Enable evolution choices and Wave B** | Turn on optional cosmetic branch keys for forms supplied by pet-2; stage and validate Wave B the same way. Branch selection is an atomic account mutation outside a run and does not touch Bond XP or function. | Unknown/retired branch aliases fall back to default without losing the stored pet row. A run already in progress retains its joined appearance snapshot. |
| **6. Enable Bondweave fusion** | Add the bounded Studio/editor, non-consuming flattened recipes, one-parent Heart selection, current-band public descriptor, rename/edit/delete, and curated cross-family compatibility fixtures. Start with a small allowlisted group vocabulary while the full roster remains available as bodies/Hearts. | No recursive recipes, arbitrary paths, double mods, parent consumption, or over-limit payloads. A corrupt fusion is quarantined individually. Four-player unique-fusion texture/memory and join-payload tests pass. |
| **7. Update census and portal last, atomically** | Once runtime, accounts, art, and flags are ready, regenerate the portal from a fresh shared build. Show `24 base pets` separately from `3N + extra branch forms`; add form deep links and a few named fusion fixtures. Commit generator, static portal, manifest counters, tests, and release flag together. | Run shared build, typecheck, lint, pet manifest completeness, `gen:check`, `assets:check`, unit tests, client build, cold server boot, portal deep links, and real-stack smoke before opening the flag. |

This order deliberately lets new definitions and assets exist additively without changing any existing account or active run. Portal/census comes last because it is a declaration of what is actually testable, not a promise that gets ahead of the game.

### The two known ways this rollout fails

**Half-refactor that breaks saves.** The dangerous sequence is to add `selectedAppearance`/fusions or new IDs in one layer while another layer still sanitizes complete V4 blobs against the old `PET_IDS`. The old client then receives or loads the account, strips unknown IDs/fields, writes the smaller object back to `dd.metaAccount.v4`, and silently erases collection state. Another variant renames `selectedPetId` before `GameRoom`, receipts, and local storage agree, resetting selection or awarding Bond to the wrong row. Prevention: one new versioned boundary, dual-read migration, complete-replacement round-trip fixtures, minimum-client gating before grants, stable IDs/tombstones, and keeping `selectedPetId` as the compatibility/Heart anchor.

**Stale pinned census that crashes boot.** A production module-level integer assertion can throw during `@dd/shared` import before Colyseus opens a room, exactly as the existing weapon census guard is capable of doing when its catalog and pinned totals diverge. Prevention: no production pet integer guard; derive counts from canonical sets; keep target totals in tests/release metadata; regenerate portal and manifests from a fresh shared build; and make cold shared import plus cold server boot mandatory in the same change that updates any pinned release count.

## Cost and operational truth

The systems work is not a catalog append. It is one account-version migration, one network schema bump, a manifest v2 dual-reader, dynamic donor texture resolution, a collection UI that scales to 24, the missing acquisition transaction, fusion editing/sanitization/public sync, portal semantics, completeness tooling, and a broad save/protocol test matrix. The source-neutral `PetMods` seams are the major saving, but the dormant Verdant/Brass fields are real repair work. After that audit, exact function reuse reduces balance proof to eight profile goldens plus a catalog-wide resolver loop.

Content cost remains substantial. Pet-1's representative transformative cadence is about 240 files for the 16 additions before shipped-pet reworks or branches, versus 144 files at today's timid 2/3/4 cadence. The portal/form count is `3 × base species + extra branch forms`, not a fixed 72 if branches exist. Fusion must stay recipe-based: 24 pets imply 276 unordered parent pairs, so bespoke pair art or portal enumeration is not viable.

Runtime art also needs a budget. The current loose textures are untrimmed 1024×1024 RGBA canvases; GPU residency is roughly 4 MiB per decoded texture before overhead. Four players each showing a unique 6–8-part Ascendant can approach 96–128 MiB for pet cutouts alone, and Phaser's texture cache does not automatically forget old forms when a rig rebuilds. Phase 2 therefore needs an explicit measured cap, atlas/trim strategy that preserves pivot metadata, or an LRU/lease policy before six-wing/swarm forms are accepted. Lazy-loading only the current form remains mandatory.

Finally, the current “account” is a local/offline client cache accepted only in developer/belt conditions; production joins default until authenticated persistence exists. The V5 shape can be implemented locally for development, but durable collection/fusion across devices and tamper-resistant purchases require an authenticated server account store. Do not market permanent cloud companions before that transport/authority handoff lands.

## Handoffs required from the other four tracks

| Track | Required handoff to systems |
|---|---|
| **Pet-1 roster** | Freeze the 16 exact IDs and display/localization keys; approve Wave A/B membership; supply acquisition category/cost/unlock intent for every pet; approve or reshuffle the two-new-pets-per-profile mapping before any ID ships. The proposed forms are expression content, not reasons to invent mechanics. |
| **Pet-2 evolution** | For every species, deliver stable form and branch keys by band, exactly one default per band, branch unlock/choice rules, lineage fallback/alias policy, motion-profile needs, and the mapping from coarse `core/primary/secondary` compatibility roles to its richer `PET_FORM_SLOTS_V1`. Confirm branches are cosmetic. |
| **Pet-3 fusion** | Freeze the one-Heart rule, parent eligibility, editable/deletable semantics, max saved count/name constraints, which groups swap atomically (side pairs, rear subtrees), empty-slot rules, flattening behavior, and a bounded curated compatibility fixture set. No recursive ancestry or stat-bearing visual slot. |
| **Pet-4 art pipeline** | Own manifest v2's canonical source, donor provenance, source URLs, sockets/planes/springs, per-form part budgets, hidden-collar tolerances, motion metadata, complete-file validation, 64-pixel silhouette review, and the runtime memory/atlas strategy. Emit machine-readable form/group records rather than asking accounts to remember generated filenames. |

Systems then owns the later implementation handoff: function-profile extraction, V5 migration and storage, account authority/acquisition, run snapshot, public descriptor/schema version, renderer integration, collection/fusion UI plumbing, portal generation, synchronized census language, and release gates.

## Owner decisions

No owner answer blocks this direction. I am proceeding with these reversible assumptions: keep three bands; make branches cosmetic; ship exact mechanical overlap; allow one parent Heart per fusion; do not consume parents; cap local saved fusions at 32; and treat 24 as the target base roster, never the current shipped count. The only future product decision with architectural weight is whether function should become globally selectable independent of every base form. This plan intentionally leaves that door open without paying its Bond-progression complexity in v1.

## Validation

- Re-read the executable `PET_IDS` block and confirmed exactly 8 shipped IDs: Verdant Wing, Hearth Newt, Lodestar Moth, Copper Snail, Gilded Gecko, Brass Crab, Pale Firefly, and Slate Tortoise.
- Re-parsed the installed pet manifest: 8 pet entries, 24 stage entries, 72 expected/72 installed parts, and zero missing, extra, or invalid rows.
- Re-checked the generated portal: its pet category count is 24, and its generator derives that number with `PET_IDS.flatMap(...PET_STAGE_DEFS.map...)`; it is a form-card census, not a base-pet census.
- Confirmed every concrete repository path named in the synchronized touch-list exists. Confirmed the report has one H1, all required sections, and balanced Markdown code fences.
- Verified the report is the only file this track wrote. It remains untracked at `docs/design/pet-5-systems.md`; no product code, asset, manifest, catalog, generated file, or test was edited, and the live services on ports 5180/2567 were not touched.
