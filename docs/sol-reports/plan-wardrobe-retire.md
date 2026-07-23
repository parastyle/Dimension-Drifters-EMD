# Wardrobe retirement and whole-art character delivery plan

Date: 2026-07-23  
Role: Sol `plan-wardrobe-retire` (read-only planner; this report is the only mutation)

## System map

### Executive finding

The default-spawn defect is not one constant. Four defaults/overrides currently converge on the wardrobe dummy:

1. The generated shared roster declares `DEFAULT_CHARACTER = "drifter"`.
2. `PlayerState.character` and `PlayerState.runCharacter` initialize to `"drifter"`.
3. A normal V3/V4 account join resolves `equippedGear`, creates a `gearRuns` entry, and calls `snapshotGearRun`, which explicitly rewrites both character fields to `"drifter"` and publishes encoded gear cosmetics.
4. The client fallback `PLAYER_SPRITE` is `"drifter"` and `ArenaScene.addBlob` chooses it whenever synced gear is present for a non-whole-art character.

Therefore a client-only `PLAYER_SPRITE` edit is insufficient. The server must establish a validated whole-art identity before it snapshots the run, and ordinary joins must stop selecting the gear-owned identity path. The client fallback must change in the same ordered delivery so a missing/old character value still resolves to whole art.

There is also a naming collision in the requested “armory/wardrobe UI” retirement. The menu’s **WARDROBE** surface edits the 113-piece character gear catalog. The adjacent **ARMORY / CARRY** surface operates on `WeaponBankEntryV1` and the weapon bank, not character gear. Minimal safe retirement removes/replaces the Wardrobe entry point and its asset preload, but preserves Armory / Carry and the in-run backpack. Shared `armory-ui` visual tokens may remain because the weapon UI still consumes them.

### Default character and spawn authority

| Concern | Authority and current behavior |
|---|---|
| Generated default | `tools/artkit/gen-character-roster.mjs:18-23` derives the playable roster from the sprite manifest; `:81-86` special-cases every `proto-*` to scale `1`; `:153-205` emits the generated roster, default, names, and scale table. The emitted default literal is `"drifter"` at `:173`. Any durable default/registry change must update this generator and regenerate, not hand-edit only its output. |
| Shared roster/default | `packages/shared/src/characters.ts:6-50` contains 43 playable ids, including `proto-samurai`, `proto-sheriff`, and `proto-witch` at `:47-49`. `DEFAULT_CHARACTER` is `"drifter"` at `:105`; `nextCharacter` cycles the entire legacy-plus-prototype roster at `:107-110`; names are at `:124-168`. |
| Schema defaults | `packages/shared/src/state.ts:86-99` initializes `PlayerState.character = "drifter"`; `:219-221` initializes the run-bound identity `runCharacter = "drifter"`. These are compatibility defaults on the wire as well as constructor defaults. |
| Server fresh join | `packages/server/src/rooms/GameRoom.ts:4199-4229` enters `onJoin` and constructs `new PlayerState`. Account V3/V4 detection and sanitization are at `:4241-4264`. |
| Server normal V3/V4 override | `GameRoom.ts:4280-4284` resolves `account.equippedGear`, records `gearRuns`, and calls `snapshotGearRun`; `:4285-4293` uses `snapshotRunCharacter` only for the legacy/no-V3-account branch. Current ordinary clients send V4, so the gear branch is the real default path. |
| Server gear identity rewrite | `GameRoom.ts:3347-3376` is `snapshotGearRun`; it sets `player.character`, `player.runCharacter`, and combat identity to `"drifter"` at `:3355-3369`, sets `gearSeeded`, and encodes `gearUpper`/`gearLower`. `:3379-3392` gives a present `gearRuns` entry precedence at every run-identity snapshot. |
| Server character fallback | `GameRoom.ts:3311-3339` validates `player.character`, but unknown values fall back to the literal `"drifter"` at `:3317`; it then clears gear cosmetics and installs the character kit. This should use the shared whole-art default rather than another literal. |
| Client connection handoff | `packages/client/src/scenes/ArenaScene.ts:1821-1844` defines scene launch data; it currently carries pet and weapon carry choices but no character. `:4267-4297` builds `joinOpts` with the V4 account, pet, carry, dimension, and mode, again with no character field. |
| Client fallback origin | `ArenaScene.ts:380-381` declares `const PLAYER_SPRITE = "drifter"`. |
| Client spawn renderer | `ArenaScene.ts:4421-4426` selects `player.character` if it has a manifest, otherwise `PLAYER_SPRITE`. `:4432-4464` detects synced gear, exempts whole-art ids, chooses `PLAYER_SPRITE` for gear, constructs `SpriteRig`, equips the synced wardrobe, and applies `characterScale(charId)`. |
| Client later reconciliation | `ArenaScene.ts:9060-9096` rebuilds rigs when crossing the whole-art boundary, but continues calling `equipSyncedGear` on every non-whole-art rig. Normal play can also re-enter the legacy roster because server `cycleCharacter` uses `nextCharacter` at `GameRoom.ts:2023-2031`. |

Required contract: define one shared `WHOLE_ART_CHARACTER_IDS`/array and `DEFAULT_CHARACTER = "proto-sheriff"` in the roster generator/output; validate an optional join selection against that whole-art subset; default missing/invalid values to the sheriff; snapshot character identity for ordinary runs; and limit/retire normal `cycleCharacter` so it cannot walk back into `drifter`/`cc-*` wardrobe characters. Keep legacy ids valid for save/dev compatibility, but not selectable through ordinary player flows.

### Whole-art registry, texture path, and scale diagnosis

| Concern | Authority and current behavior |
|---|---|
| Whole-art qualification | `packages/client/src/sprites/whole-art-character.ts:4-13` defines the six required roles. `:16-25` hard-codes the three prototype ids in a client-only set because the generated manifest has no render-mode field. `:44-60` verifies the id and all six manifest parts. This is a second registry beside the shared playable roster. |
| Lazy texture loading | `whole-art-character.ts:63-75` defines `char:<id>:<role>` keys and loose texture URLs; `:78-138` queues/guards all six files. |
| Texture selection | `packages/client/src/entities/SpriteRig.ts:220-243` makes whole-art loose textures take precedence over atlas/legacy loose frames. |
| Base part normalization (shared by both modes) | `SpriteRig.ts:245-246` defines `TARGET_BODY_H = 76`. The constructor at `:2422-2447` computes `this.scale = 76 / manifest.body.h`, positions every part using that factor, and marks whole-art rigs only for authored hand spread. There is no smaller whole-art base scale here. |
| Rig-level scale | `SpriteRig.ts:4126-4135` stores a uniform `baseScale` through `setRigScale`; animation reapplies it. `ArenaScene.addBlob` calls `rig.setRigScale(characterScale(charId))` at `ArenaScene.ts:4463-4464` for both legacy and whole-art characters. The shared scale table returns `1` for all prototypes because they have no entries (`packages/shared/src/characters.ts:170-192`). |
| Legacy boilerplate normalization | `SpriteRig.ts:2619-2638` installs the boilerplate assembly only when a gear manifest is supplied. `packages/client/src/sprites/gear-parts.ts:888-924` separately normalizes that assembly with `targetBodyHeight / socketFrame.bodyHeightL`; `SpriteRig.ts:2684-2705` swaps the retained nodes to the normalized boilerplate. |
| Source geometry | `packages/client/src/sprites/manifest.ts:3039-3113` gives Drifter a 168-source-pixel body and a full static part envelope of about 328.9 source px. Prototype bodies are also exactly 168 px, but their complete envelopes are much taller: Samurai about 388.3 (`:4303-4377`), Sheriff about 450.5 (`:4379-4453`), Witch about 445.1 (`:4455-4529`). Body normalization therefore produces roughly 176 px, 204 px, and 201 px full figures versus Drifter’s roughly 149 px. |
| Generator assumption causing the miss | `tools/artkit/gen-character-roster.mjs:55-86` can measure complete normalized footprints, but `:81-83` bypasses that logic and returns `1` for every prototype under the assumption that a canonical 76 px body implies a canonical full-character footprint. The manifest numbers disprove that assumption. |

The size correction should be presentation-only. Do **not** put sub-1 prototype values into the existing shared `characterScale` without auditing authority, because the server uses `characterScale(player.character)` in combat/weapon geometry (for example `GameRoom.ts:6736`, `:8543`, `:10752`, and `:10945`). A safe client helper should derive or declare a whole-art visual-envelope multiplier and compose it only in `ArenaScene`/`SpriteRig`. Using Drifter’s full static envelope as the target yields initial audit values of approximately Samurai `0.847`, Sheriff `0.730`, and Witch `0.739`; live play must tune/approve the final values against enemies and the boilerplate dummy.

### Wardrobe/gear data, bake pipeline, and active render path

| Surface | Authority and current behavior | Minimal archive status |
|---|---|---|
| 113-piece catalog | `packages/shared/src/gear.ts:97-1930` defines catalog rows and net codes; `:1977-2093` declares all 113 `GEAR_IDS` and 96 launch ids; `:2095-2115` declares the eight blank Drifter starter pieces; `:2267-2355` resolves runtime stats and encodes/decodes cosmetics. | Retain intact as compatibility/tombstone data. Do not renumber, reorder, or delete ids/net codes. Mark runtime use archived via a separate policy/flow, not catalog surgery. |
| Account persistence | `packages/shared/src/meta.ts:104-127` includes `ownedGear` and `equippedGear` in V3/V4. Creation and starter loadout are at `:167-187`; V2 gear migration is at `:235-261`; V3/V4 sanitization and migration preserve/filter gear at `:264-367`. | Continue reading, sanitizing, round-tripping, and sending these fields. Do not bump/account-migrate solely to erase them. They become retained inert legacy state. Pets in the same account remain untouched. |
| Authoritative gear identity | `GameRoom.ts:3347-3392` makes a gear loadout own stats, quirk, Drifter identity, and cosmetics. `:4280-4284` activates it on ordinary V3/V4 join. Legacy upgrade purchases still award owned gear at `:1973-2020`. | Stop activating `gearRuns`/`snapshotGearRun` for ordinary new runs; use selected/default whole-art character kits. Retain parsing/helpers for old data and explicit compatibility tests. Reconcile the legacy upgrade reward path so it does not silently charge currency for an invisible retired reward. |
| Generated art manifest | `tools/artkit/out/gear/gear-parts-manifest.json:2` is schema V2; `:718` begins the boilerplate contract; `:1192` begins installed gear slots/items. It is generated by `tools/artkit/gen-gear.mjs` from `GEAR_CATALOG`. | Retain file and generator for reproducibility, archive diagnostics, and census stability. Do not load it in normal menu/arena play. |
| Typed manifest/assembly | `packages/client/src/sprites/gear-parts.ts:1-36` imports shared gear and defines bake roles; `:710-809` validates and exposes `GEAR_PARTS_MANIFEST`; `:813-924` resolves textures and boilerplate assembly; `:1409-1764` resolves replacement bake recipes/loadouts; `:1818-1921` handles retained frames and texture loading. | Keep code as dormant compatibility infrastructure. No hard delete in this wave. |
| Scene bake cache | `packages/client/src/sprites/gear-texture-baker.ts:18-58` defines the 48 MiB cache and lease API; `:90-239` loads sources/composes Phaser textures; `:270-482` owns cache acquisition/leases/eviction; `:484-496` creates one cache per scene. | Retain implementation/tests, but eliminate normal-production call sites and preloads. |
| `SpriteRig` gear path | `SpriteRig.ts:2619-2705` installs the blank boilerplate; `:2910-3000` decodes synced gear, requests the boilerplate, and starts replacement baking or legacy assembly; later attachment/sync code continues through `:3188`. | Preserve callable compatibility code, but no ordinary whole-art player should construct with `gearManifest` or call `equipSyncedGear`. |
| Arena activation | `ArenaScene.ts:4427-4462` reads `gearUpper`/`gearLower`, swaps the character to `PLAYER_SPRITE`, passes `GEAR_PARTS_MANIFEST`, and equips gear. `:9068-9095` repeats the sync path. `:15391-15407` also decodes every patch into an otherwise unused `syncedGearLoadouts` cache. | Gate/remove these normal call sites after the server/default contract is whole-art. Retain a deliberate legacy fallback only for old/explicit compatibility rows; never let it be the missing-character fallback. Stop the unused per-patch cache work. |
| Wardrobe UI model | `packages/client/src/ui/wardrobe/model.ts:17-18` owns preset persistence; `:347-409` sanitizes/loads/saves presets; `:423-579` equips gear and builds slot/catalog/set/preview views. | Retain files and stored preset compatibility. No normal UI entry point or writes after retirement. |
| Wardrobe preview | `packages/client/src/ui/wardrobe/preview.ts:158-214` computes fixed bounds; `:216` begins `WardrobeCharacterPreview`, which shares the gear bake cache. | Retain dormant with its parity tests; do not instantiate from the active menu. |
| Menu gear preload | `packages/client/src/scenes/MenuScene.ts:325-361` preloads the boilerplate plus all manifest gear textures before normal menu use. | Stop this preload in active menu flow; it is a material load/VRAM win and proof the archive is actually inactive. |
| Menu entry point | `MenuScene.ts:215-243` defines `MenuTab = "wardrobe" | "armory" | "run"` and defaults to Wardrobe. `:373-424` resets that state; `:518-545` owns Wardrobe keyboard grammar; `:596-603` builds both workspaces and opens Wardrobe. `:1035-1076` builds/shows the tabs. `:1079-2000` is the active Wardrobe workspace/panel/equip implementation. | Replace the visible Wardrobe tab with Characters, stop building/showing the Wardrobe workspace, and keep the old methods/files retained but unreachable. Remove obsolete normal-input routing and copy from active paths. |
| Dev-only gear entry | `MenuScene.ts:140-167` projects `?dev=gear:*` into an account; `:426-439` uses dev deep links. `ArenaScene.ts:15223-15272` applies/labels dev gear. `tools/portal/gen-portal.mjs:196-215` generates gear portal rows. | May remain as clearly dev-only archive inspection coverage, or be grouped/labelled “archived”; it must not be presented as a player wardrobe. Keeping it is safer than deleting the only live compatibility probe. |

### Roster and character-selection sources

The current roster contract is split:

- Shared playable/stat registry: `packages/shared/src/characters.ts:6-110`, generated by `tools/artkit/gen-character-roster.mjs`.
- Shared untrusted-id guard and character kit fallback: `packages/shared/src/character-classes.ts:6-17` and `:435-451`.
- Client-only whole-art render registry: `packages/client/src/sprites/whole-art-character.ts:16-60`.
- Installed character geometry: `packages/client/src/sprites/manifest.ts` (Drifter `:3039`, prototypes `:4303`, `:4379`, `:4455`).

The character menu must enumerate the whole-art registry, not `PLAYABLE_CHARACTERS`, because most `cc-*` ids are still legacy six-part wardrobe scaffolds. Move/emit the whole-art subset into shared generated data (while allowing the client helper to confirm that six textures exist), then use the same subset for menu choices, join validation, defaulting, and normal character cycling. At present there is no `selectedCharacter` in `MetaAccountV4`, `MenuScene` launch data, `ArenaScene` launch data, or `GameRoom.onJoin` options.

For minimum migration risk, persist the menu choice under a new bounded client key (parallel to the retained Wardrobe preset key), pass `selectedCharacterId` through `MenuScene -> ArenaScene.init -> joinOpts -> GameRoom.onJoin`, and validate it against the shared whole-art subset. Do not add it to V4 merely to ship this wave: a V5 account migration would entangle pets, weapon banking, gear tombstones, revision handling, and server rejection semantics. The server remains authoritative and defaults missing/invalid selections to `proto-sheriff`.

### Menu tab construction and the Armory distinction

- `packages/client/src/scenes/MenuScene.ts:215` is the tab union; `:240-242` stores active tab/buttons.
- `MenuScene.ts:596-603` creates tab row, destinations, Wardrobe, Armory, companions, and selects Wardrobe.
- `MenuScene.ts:660-699` (`makeMenuChip`) is the reusable tab/control construction primitive.
- `MenuScene.ts:1035-1048` declares the three current tab labels and builds their chips.
- `MenuScene.ts:1050-1076` centralizes selected styling and panel visibility.
- `MenuScene.ts:2821-2840` lays out full-screen workspaces and refreshes the active one.
- `MenuScene.ts:2865-2904` commits the weapon carry and launches Arena; this is where the selected character must be included in scene data.

The new tab should follow that exact pattern: add `"characters"` to `MenuTab`, replace the Wardrobe row, create a character root/grid/preview, show it in `setMenuTab`, include it in full-screen layout, and default the menu to it. The three prototypes are the current minimum candidates; future whole-art additions flow from the shared subset automatically.

Do **not** retire the adjacent Armory / Carry system:

- `packages/client/src/ui/armory/model.ts:1-35` is typed around `WeaponBankEntryV1`.
- `:272-380` reads `account.weaponBank` and produces stash/intake/carry state.
- `MenuScene.ts:1038` labels the tab `ARMORY / CARRY`; `:2050-2335` implements the active weapon workspace.
- `ArenaScene.ts:4555-4598` routes the in-run backpack/shop modal.

Those are weapon-risk/banking workflows and are independent of the 113 wardrobe pieces. Only gear-specific Wardrobe use of shared `armory-ui` tokens becomes inactive; the shared token/grid/icon modules remain live for weapon Armory.

### Tests and guardrails already coupled to this change

- `packages/server/src/rooms/progression.test.ts:437-467` asserts the 96-launch/113-total gear census and net-code laws. Preserve it unchanged as an archive census, or rename its description without changing the counts.
- `packages/client/src/sprites/gear-parts.completeness.test.ts:34-65` checks the generated art manifest against every gear id. Keep it as archive reproducibility coverage.
- `packages/client/src/sprites/gear-parts.test.ts:611-677` and `gear-texture-baker.test.ts:93-496` cover typed manifest/bake stability. These are retained-code tests, not candidates for deletion.
- `packages/server/src/rooms/GameRoom.test.ts:5669-5745` currently asserts gear-owned join identity and stats; this must be rewritten to assert retained account compatibility plus **inactive** gear runtime and whole-art character authority.
- `GameRoom.test.ts:3831-3873` assumes Drifter is the initial character and that `cycleCharacter` enters legacy `cc-*`; reconcile it with the shared whole-art subset/default.
- `GameRoom.test.ts:3926-3930` and schema constructor tests assume a Drifter `runCharacter` default. If schema defaults change, preserve wire ordering/schema version unless a real field is appended; a literal default change alone does not justify a schema bump.
- `packages/client/src/scenes/ArenaScene.dualwield.test.ts:235-275` proves prototypes bypass gear but explicitly expects the legacy Drifter gear path to stay active. Replace the “ordinary Drifter unchanged” expectation with “legacy fallback is explicit-only/dormant,” while retaining a compatibility unit test.
- `packages/client/src/sprites/whole-art-character.test.ts:11-59` is the natural home for shared-registry parity and visual-envelope scale assertions.
- `packages/client/src/entities/SpriteRig.boilerplate.test.ts:269-290` proves six whole-art textures survive construction; add a scale/envelope assertion without deleting the retained boilerplate suite.
- `packages/client/src/scenes/MenuScene.dev-links.test.ts:1-31` covers dev gear projection. Keep if the archived dev probe remains; add separate character-selection model/menu tests.

Pets are intentionally absent from every proposed archive boundary. `MetaAccountV4.pets`/`selectedPetId`, `MenuScene.buildCompanionRow` (`MenuScene.ts:2543-2627`), `ArenaScene` pet selection/rigs, shared pet data, and server pet snapshot/progression remain unchanged.

## Minimal safe definition of “archive”

Archive means **disable-and-retain**, with one explicit degraded fallback. It does not mean deleting the catalog, save fields, generated art, or compatibility implementations.

| Surface | Action in this delivery |
|---|---|
| Shared 113-piece catalog, net codes, starter ids, codecs | Retain unchanged. Add no new active gear. Preserve ordering/counts. |
| V3/V4 `ownedGear` and `equippedGear` | Continue sanitize/migrate/round-trip. Treat as inert legacy state. Do not erase a player’s collection. |
| Server `gearRuns` / `snapshotGearRun` | Retain implementation, but stop populating/calling it for ordinary joins and run snapshots. Character kit owns identity. |
| `gearUpper` / `gearLower` schema tail | Retain fields/accessors and wire order. Ordinary whole-art joins leave them empty. |
| `gear-parts.ts`, generated manifest, `gear-texture-baker.ts` | Retain code/data/tests. Remove normal menu preload and arena call sites. |
| `SpriteRig` boilerplate/gear methods | Retain for archive diagnostics and controlled compatibility tests. Do not call from ordinary player creation/sync. |
| Wardrobe model/layout/preview/presets | Retain source, tests, and stored local data. Remove the visible tab, input grammar, construction, and writes from normal play. |
| Dev Portal gear probes | Retain but label/group as archived diagnostic inventory if portal copy is touched. They are not a player entry point. |
| Boilerplate/Drifter base art | Retain as a last-resort **asset-failure** fallback and for archive tests. It must not be the no-selection/default path. A fallback activation should log/announce the missing whole-art asset. |
| Armory / Carry and backpack | Retain active. They are weapon-bank systems, not Wardrobe gear. |
| Pets | No code, data, art, menu behavior, storage, or tests changed except incidental assertions that they remain intact. |

Two legacy behaviors need an explicit stop rather than silent inertness:

1. `buyUpgrade` (`GameRoom.ts:1973-2020`) must not charge scrip for an invisible retired gear reward. Disable that old purchase seam or preserve its non-gear upgrade behavior without awarding/activating wardrobe pieces; do not invent a new progression economy in this wave.
2. Prestige is coupled to the Wardrobe UI even though World Tier is not wardrobe gear. Server prestige authority lives at `GameRoom.ts:1857-1891`; the active menu transport/drawer lives at `MenuScene.ts:689-985` and is embedded in Wardrobe layout. The character-menu Sol must relocate the existing World Tier/prestige access to Destinations (or a neutral menu control) and remove hat-tower copy. Simply making Wardrobe unreachable would strand a live progression transaction.

## Wave plan

Recommended staffing is four implementation Sols. Every Sol owns a disjoint file partition; generated output travels with its generator owner. Sols 2–4 may be prepared after Sol 1’s contract lands, but all merges remain serial.

### Wave 1 — establish whole-art authority before retiring any renderer

#### Sol 1 — `whole-art-contract-server`

**Scoped file partition**

- `tools/artkit/gen-character-roster.mjs`
- `packages/shared/src/characters.ts` (generated output only)
- `packages/shared/src/character-classes.ts` only if a shared whole-art guard is placed there
- `packages/shared/src/state.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/server/src/rooms/progression.test.ts`

**Outline**

1. Teach the roster generator to emit a typed `WHOLE_ART_CHARACTERS` subset from installed `proto-*` ids and set the generated `DEFAULT_CHARACTER` to `proto-sheriff`. Keep the full `PLAYABLE_CHARACTERS` array and legacy `nextCharacter` for compatibility; add a whole-art-only guard/cycler for ordinary play.
2. Change schema constructor defaults to the shared default without adding/reordering wire fields.
3. Extend `GameRoom.onJoin` options with bounded `selectedCharacterId?: unknown`; validate against the shared whole-art subset and assign the sheriff on missing/invalid input before the initial snapshot.
4. For every ordinary account version, retain account gear sanitation but call `snapshotRunCharacter`, not `resolveGearLoadout -> gearRuns -> snapshotGearRun`. Leave gear cosmetics empty and make character kit/quirk the authoritative run identity.
5. Use `DEFAULT_CHARACTER` in `snapshotRunCharacter` instead of another `"drifter"` literal.
6. Make the normal C-key route cycle only the whole-art subset (or retire the shortcut outside Testing Grounds). Dev-only explicit legacy character inspection may remain.
7. Neutralize the legacy `buyUpgrade` gear reward seam so it never charges for an invisible archived reward. Preserve existing account rows and helper code.
8. Rewrite gear-join tests as archive tests: a supplied V4 with all 113-compatible gear fields remains sanitized/round-tripped, but no `gearRuns` entry is created, `gearSeeded` is false, cosmetics are empty, and the chosen/default whole-art kit owns combat.

**Risk note**

This intentionally changes gameplay authority: gear-derived spreads, quirks, and modifiers stop applying. The current three prototypes all use the flat `2/2/2/2/2` + `unwritten` kit, so initial whole-art choices are cosmetic-equivalent. Tests must make that loss of gear power explicit rather than accidentally preserving half of the retired system. Do not touch pets while editing the shared account/join path.

**Verification owned by this Sol**

- Generator check proves generated output is current.
- Unit cases: no selection -> sheriff; each valid prototype accepted; legacy/unknown selection -> sheriff; V4 gear survives account response but is runtime-inert; normal cycling never enters Drifter/`cc-*`; schema field ordering/version unchanged; existing pet selection and pet snapshot assertions remain green.
- Boot a private server once after tests to catch census/module-init failures.

### Wave 2 — independent visual sizing track

#### Sol 2 — `whole-art-size`

**Scoped file partition**

- `packages/client/src/sprites/whole-art-character.ts`
- `packages/client/src/sprites/whole-art-character.test.ts`
- `packages/client/src/entities/SpriteRig.ts`
- `packages/client/src/entities/SpriteRig.boilerplate.test.ts`

**Outline**

1. Import/confirm the shared whole-art subset instead of maintaining a divergent hand-written client set; keep the six-part manifest qualification as the asset guard.
2. Add a client-only whole-art visual-envelope scale. Prefer a deterministic full-part-height calculation against the retained Drifter reference envelope, with bounded explicit overrides only if live review needs art-direction tuning. Initial geometry audit targets are Samurai about `0.847`, Sheriff about `0.730`, Witch about `0.739`.
3. Compose that multiplier inside `SpriteRig`’s rig-scale application, not shared `characterScale`. Preserve the caller’s gameplay/render-scale value separately if needed so weapon counter-scaling, WYSIWYG effects, and animation math use a coherent final transform.
4. Add tests that all whole-art ids have a bounded non-1 correction, the sheriff’s rendered static envelope is near the Drifter reference, legacy rigs remain `1`, and all six whole-art textures/head mounts still survive construction.

**Risk note**

Uniform root scaling also touches child shadows/VFX while weapon code deliberately counter-scales several held assets. Audit melee reach, muzzle placement, aura diameters, “you” marker, and ground shadow live. Do not alter server `characterScale`, collision radius, attack reach, or authority geometry in a visual-size task.

**Verification owned by this Sol**

- Live private-port captures of `?dev=char:proto-sheriff`, `proto-samurai`, and `proto-witch` beside the same enemy roster/zoom.
- Record before/after screenshots and confirm no detached hands, feet, weapons, shadows, or head spring.
- Compare sheriff full height to a controlled legacy Drifter/boilerplate diagnostic, not only to the viewport.

### Wave 3 — disconnect normal client gear rendering, with fallback already safe

#### Sol 3 — `whole-art-client-runtime`

**Scoped file partition**

- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/scenes/ArenaScene.dualwield.test.ts`
- Other `ArenaScene.*.test.ts` files only where an existing fixture directly asserts player character creation

**Outline**

1. Make `PLAYER_SPRITE` derive from the shared `DEFAULT_CHARACTER` (`proto-sheriff`).
2. Extend `ArenaScene.init` data and `joinOpts` with `selectedCharacterId`, passed through untouched for server validation.
3. Resolve ordinary player render ids against the shared whole-art subset. Missing, unknown, Drifter, or legacy `cc-*` state from an older server resolves visually to the sheriff rather than the dummy.
4. Construct ordinary players without `GEAR_PARTS_MANIFEST`, never call `equipSyncedGear`, and remove the per-patch `syncedGearLoadouts` decode/cache work. Keep gear imports only where the dev-only archived gear probe still needs them.
5. Preserve the texture-ready barrier. If a qualified whole-art texture load reaches a terminal `missing` state, log a clear asset failure and render the retained Drifter base as a degraded fallback rather than leaving the player invisible forever. This exception is not used for no-selection.
6. Simplify `syncBlobs` around whole-art character changes: rebuild when the authoritative whole-art id changes; never re-enter a normal wardrobe sync.
7. Replace tests that celebrate an active Drifter wardrobe path with tests for (a) sheriff fallback, (b) selected whole-art creation, (c) no gear calls even when legacy gear tails are present, (d) explicit asset-failure visibility fallback, and (e) whole-art-to-whole-art rebuild.

**Risk note**

Mixed-version rooms are the danger seam. New server + old current client is safe because the shipped client already understands prototype whole art; new client + old server must map Drifter/legacy values to sheriff. A terminal texture failure must show a visible fallback, but a merely pending load must not flash the dummy for one frame.

**Verification owned by this Sol**

- Live normal launch with a fresh/cleared character-selection key: server state and visible rig are sheriff without any dev query.
- Live launch with an old V4 account containing equipped gear: account remains valid, visible rig is whole art, and no gear textures/bakes occur.
- Live two-client room: remote whole-art ids render correctly; an injected legacy/missing id degrades to sheriff rather than boilerplate.
- Browser console/network inspection shows no normal `gear-bake` warnings and no normal gear texture fetch set.

### Wave 4 — replace the Wardrobe tab with character selection

#### Sol 4 — `character-menu`

**Scoped file partition**

- `packages/client/src/scenes/MenuScene.ts`
- `packages/client/src/scenes/MenuScene.dev-links.test.ts` only if dev archive labelling changes
- New `packages/client/src/ui/character-select.ts`
- New `packages/client/src/ui/character-select.test.ts`
- New menu character-preview helper/test if needed, under `packages/client/src/ui/characters/`
- A focused new `MenuScene.character-tab.test.ts` if Phaser-facing tab behavior needs a separate fixture

**Outline**

1. Add a small pure selection model with a new versioned local key (for example `dd.character.selected.v1`). Sanitize all stored values against shared `WHOLE_ART_CHARACTERS`; missing/corrupt/legacy values become `DEFAULT_CHARACTER`. Do not change MetaAccount V4.
2. Replace the visible `wardrobe` tab descriptor with `characters`, default the menu to Characters, and follow the existing `makeMenuChip -> build root -> setMenuTab -> layout` pattern.
3. Build cards for every shared whole-art id, currently the three prototypes. Show readable name, selected state, and whole-art preview/portrait. Load only the six-part textures needed for this small roster; do not preload the boilerplate plus the gear manifest.
4. Save on selection and include `selectedCharacterId` in the `scene.start("arena", ...)` payload. Keep server validation authoritative.
5. Stop building/showing the Wardrobe workspace and remove Wardrobe keyboard routing from normal play. Retain Wardrobe modules/methods/preset storage as dormant archive code unless cleanup can remove dead methods without widening risk; no hard delete is required.
6. Keep `ARMORY / CARRY` visible and functional. Keep the companion selector active on the Characters tab so pet selection behavior is unchanged.
7. Relocate the existing prestige/World Tier transaction to a neutral Destinations control/drawer and remove “hat tier/tower grows” copy. Do not change the server transaction or World Tier semantics.
8. Update title/subtitle/copy that says “GEAR IS WHO YOU ARE” or “drifters” where it would falsely present retired Wardrobe identity.

**Risk note**

`MenuScene.ts` is large and Wardrobe currently owns companion visibility plus prestige UI, so hiding only the tab would accidentally hide pets and strand prestige. The Sol must test those two preserved behaviors explicitly. Avoid deleting `armory-ui` tokens or the Armory root; they remain live weapon UI.

**Verification owned by this Sol**

- Live private-port menu: Characters is the initial tab, exactly the shared whole-art roster appears, all previews fit, keyboard/pointer selection works, refresh persists the choice, and Armory / Carry plus Destinations remain reachable.
- Select each prototype, launch, and confirm the authoritative player id/visible art matches.
- Confirm companions still select/save and appear in the launched run.
- Confirm eligible prestige remains reachable outside Wardrobe and no active copy promises hat rewards.
- Network panel shows the old full gear art preload is absent on a normal menu visit.

## File-partition and dependency matrix

| Sol | Shared character render path? | Can develop independently? | Merge constraint |
|---|---|---|---|
| 1 — contract/server | Yes: authoritative id/default and run identity | Must start first | Merge first. It makes sheriff authoritative before client gear removal. |
| 2 — size | Yes: `SpriteRig` transform, client-only | After the shared registry contract, independent of Menu and Arena edits | Merge second so later runtime/live checks exercise final scale. |
| 3 — client runtime | Yes: `ArenaScene.addBlob`/`syncBlobs` and join handoff | Independent of Menu file edits after Sol 1 | Merge after Sols 1–2. This is the active gear-render disconnect. |
| 4 — menu | No Arena render-path files; UI/persistence only | Can be built in parallel after Sol 1 against the agreed payload name | Merge last, after Arena accepts the payload. It closes the old UI entry point. |

Sols 1, 2, and 3 are ordered character-path mutations and must not be merged concurrently. Sol 4 is an independent UI track at the file level, but its final integration depends on the shared registry and Arena payload receiver.

## Safe serial merge order

1. **Merge Sol 1 (`whole-art-contract-server`).** At this point every ordinary missing/invalid selection spawns authoritatively as sheriff. The already-shipped whole-art client path can render it, so the change is deployable before any client cleanup.
2. **Merge Sol 2 (`whole-art-size`).** The sheriff and other prototypes now fit the game scale while the old gear renderer still exists as a dormant escape hatch.
3. **Merge Sol 3 (`whole-art-client-runtime`).** Remove active gear-bake calls only after the server/default guarantee is present. Healthy whole-art loads never touch the dummy; terminal asset failure still has a visible retained fallback.
4. **Merge Sol 4 (`character-menu`).** Replace the Wardrobe player entry point, pass choices through the already-landed client/server contract, preserve weapon Armory, companions, and prestige.
5. On the integrated main tree, rerun the full gate, private-port live matrix, a fresh-account launch, an old V4 gear-account launch, and a two-client remote-character pass before release.

Do not merge Sol 3 before Sol 1. That ordering creates the exact failure the owner warned about: old server defaults/gear snapshots can still publish Drifter while the normal client gear renderer has already been disconnected.

## Risks and mitigations

### 1. Biggest risk: gear is currently gameplay identity, not only art

`snapshotGearRun` installs stats, quirks, max-HP modifiers, and combat runtime mods. Retiring only overlays would leave invisible gear power and contradict “whole-art characters replace Wardrobe”; retiring runtime identity removes meaningful existing builds. The plan chooses the latter because it matches the owner’s request, but makes it explicit:

- Whole-art character kit owns new-run identity.
- Retained gear account rows are inert compatibility data.
- Existing gear owners lose active gear-derived spread/quirk/mod effects when starting a new run.
- The current prototypes are all flat/unwritten, so the first release intentionally has no character gameplay differentiation.
- No automatic salvage, compensation, or new character-power migration is invented here; that is a separate product/economy decision.

Mitigation is test clarity plus non-destructive persistence: no data is erased, so a later migration/compensation pass still has the complete ownership record.

### 2. Archiving without breaking player visibility

Failure modes include missing selection, invalid legacy id, V4 gear forcing Drifter, asynchronous whole-art loads, and a missing texture that currently causes endless `addBlob` retries.

Mitigation:

- Land server/default authority first.
- Validate/select from one shared whole-art subset.
- Map missing/legacy client values to sheriff.
- Distinguish `pending` from terminal `missing`; wait without a dummy flash while pending, use a logged retained-base fallback only on terminal failure.
- Test local and remote creation plus mixed-version cases.
- Keep Drifter/boilerplate assets and compatibility code in the archive for at least one release; do not use them as the standing/default model.

### 3. Save/load and census fallout

Deleting catalog rows, net codes, V3/V4 fields, starter gear, manifest items, or schema tail fields would invalidate old local saves and many census/completeness tests.

Mitigation:

- Keep all 113 ids and the 96 launch rows exactly stable.
- Keep account sanitizers/migrations and gear codecs.
- Keep `gearUpper`/`gearLower` wire positions.
- Reframe tests from “active equipment works” to “archived data remains valid and inert.”
- Keep manifest/baker suites green even though normal play no longer calls them.
- Run generation checks in the generator-owning worktree so hand-edited generated output cannot drift.

### 4. Legacy purchases and prestige are embedded in Wardrobe-era progression

`buyUpgrade` can consume currency and grant owned gear; prestige UI/copy exposes hat tower growth from the Wardrobe workspace.

Mitigation:

- Disable charging for an archived invisible reward; do not silently leave the handler active.
- Preserve `prestige` as World Tier and relocate its existing transaction to Destinations.
- Remove only hat/gear presentation from prestige, not server authority or account value.
- Add live tests for eligible prestige after Wardrobe is unreachable.

### 5. “Armory” could be over-archived

Deleting the menu Armory because of its name would remove the weapon stash/intake/carry contract and could block launch when intake is full (`MenuScene.ts:2865-2873`).

Mitigation:

- Preserve `ui/armory/model.ts`, `ARMORY / CARRY`, in-run backpack, shared armory visual tokens, and launch carry.
- Archive only Wardrobe-specific calls and gear assets.
- Include an integrated old-account launch with weapon bank contents in the live matrix.

### 6. Boilerplate base remains useful, but only as a fallback

A hard delete would remove the safest visible response to broken/missing whole-art files and destroy archive probes/tests. Keeping it without policy risks accidentally becoming the default again.

Mitigation:

- Retain code/assets.
- Require an explicit terminal asset-error condition to enter it.
- Emit a diagnostic/banner so fallback use is observable.
- Add a test that no-selection does **not** enter fallback and a separate test that terminal texture failure does.

### 7. Visual scale can desynchronize presentation from authority

The root multiplier is intentionally client-only while server `characterScale` remains `1` for prototypes. Some visual children counter-scale to maintain gameplay truth; others may inherit the smaller root.

Mitigation:

- Test/capture held weapons, muzzle anchors, melee reach read, shadows, auras, labels, and head spring.
- Do not edit collision/attack radii as part of the size correction.
- Prefer one visual-envelope helper with documented reference bounds over scattered per-scene magic numbers.

### 8. Registry drift and future whole-art additions

Today the shared roster and client whole-art set are separate hard-coded lists. A fourth whole-art character could render by deep link but be absent from the menu/default guard, or vice versa.

Mitigation:

- Emit/export the subset from the roster generator.
- Require client manifest qualification for all shared whole-art ids.
- Test set parity and six required roles.
- Drive menu enumeration and server validation from the same shared subset.

### 9. Pets share account/menu/join plumbing

Broad edits to MetaAccount, Menu defaults, `onJoin`, or companion visibility can regress pets despite the archive being unrelated.

Mitigation:

- Do not alter pet types, sanitizers, storage, art, snapshot, runtime, rewards, or UI model.
- Keep companion selection visible on Characters.
- Carry `selectedPetId` through unchanged beside the new character field.
- Include existing pet suites plus one live select/launch confirmation in Sols 1 and 4.

## Standing laws for every implementation Sol

1. Create each mutating Sol in its **own git worktree** with `tools/sol/worktree.sh create <name> <main-branch>`; install/test/commit inside that worktree. Never let two Sols edit the main working tree or share a worktree.
2. Respect the scoped file partition. If an unexpected file is required, stop that Sol’s mutation, record the dependency, and hand it to the owning Sol rather than creating overlap.
3. Preserve LF endings, including generated TypeScript/JSON. Inspect diffs for whole-file CRLF churn before commit.
4. Every Sol runs `pnpm test` and `pnpm typecheck` green in its worktree. Sol 1 also runs `pnpm gen:check`; artifact-owning changes run the relevant focused generation/asset check. After all merges, run the full commands again on main.
5. Keep the server booting throughout. Run a private server boot after server/shared/catalog changes so module-scope census guards fail before merge. The already-landed GameRoom module-scope `Math.random` seeding fix means catalog edits should not reshuffle the RNG-stream tests; do not “fix” failures by rebaselining random expectations.
6. Every visual/user-flow Sol performs live verification on **private ephemeral ports**, never client `5180` or server `2567`. Allocate two free ports, set client `PORT` and server `DD_PORT`, and open the client with `?port=<private-server-port>` (or append `&port=` to a dev link). Stop both processes and release the ports after evidence is captured.
7. Live evidence is mandatory for: all three whole-art sizes; a normal no-selection sheriff spawn; each menu character selection through authoritative join; the character tab layout/input/persistence; companions remaining functional; and the absence of normal gear asset/bake activity.
8. Do not hard-delete archived gear code/data/tests in this delivery. Do not renumber catalog entries, change schema field order, erase local saves, or make old-account sanitation reject previously valid gear.
9. Pets are out of scope. A diff touching shared pet definitions, pet art/runtime, pet reward math, or pet tests beyond an unchanged-behavior assertion is a scope violation.
10. Preserve the weapon Armory / Carry and backpack. “Armory” in those modules means weapon bank/carry, not the retired Wardrobe.

## Integrated acceptance checklist

- Fresh account, no stored character, no query: menu defaults to Characters with Sheriff selected; launch produces authoritative `player.character === player.runCharacter === "proto-sheriff"` and visible whole art.
- Corrupt/legacy stored selection and invalid join payload: sheriff, never Drifter dummy.
- Samurai/Sheriff/Witch selection persists across refresh and survives menu -> Arena -> server -> remote-client rendering.
- Whole-art visual envelope matches the Drifter/enemy roster scale; sheriff no longer dwarfs enemies.
- Ordinary V4 account with owned/equipped gear still sanitizes and returns intact, but creates no active gear runtime/cosmetics/bake.
- Normal menu/arena navigation does not preload/fetch the gear catalog or emit gear-bake work.
- Wardrobe is absent from active tabs and input; Characters, Armory / Carry, Destinations, companions, and World Tier/prestige remain usable.
- The 113/96 gear census, net codes, manifest validation, account migrations, codecs, schema compatibility, and archive unit suites remain green.
- Terminal whole-art asset failure yields a visible, diagnosed retained-base fallback; healthy no-selection never does.
- `pnpm test`, `pnpm typecheck`, relevant generation checks, private-port server boot, and all live visual checks are green on integrated main.
- Pet selection, launch handoff, visible pet rig, progression, and existing pet tests are unchanged.

Verdict: recommended Sol count = 4; safe merge order = whole-art-contract-server -> whole-art-size -> whole-art-client-runtime -> character-menu; single biggest risk = retiring `snapshotGearRun` removes active gear-derived stats/quirks/modifiers, not merely wardrobe art, so compatibility data must be retained while the gameplay authority change is made explicit and tested.
