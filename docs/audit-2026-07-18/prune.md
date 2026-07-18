# Dimension Drifters legacy-system prune audit

Audit date: 2026-07-18. Scope: repository-wide legacy/superseded systems on `feat/v0.118-metagame`; no runtime, server, fleet, or source files were changed. Counts are physical LOC unless marked approximate, and binary sizes are MiB (1,048,576 bytes). The live gear fleet can change generated counters after this snapshot, so its retirement gate is expressed as a repeatable condition rather than a date. The known repository-wide Biome/CRLF debt is deliberately excluded.

## P0 findings

### P0-1 — The folded `META_UPGRADES` path is still a live, inconsistent shop, not removable tombstone code

- **Evidence / who still references it:** the old three-track catalog still exists at `packages/shared/src/meta.ts:9-30`; its levels remain wire fields at `packages/shared/src/state.ts:191-195`; Belt still renders prices from those fields and sends `buyUpgrade` at `packages/client/src/scenes/ArenaScene.ts:13069-13145`; the server instead derives a gear rank, grants `LEGACY_UPGRADE_GRANTS`, and returns without incrementing those fields for a gear-seeded run at `packages/server/src/rooms/GameRoom.ts:1784-1818`. Current V4 clients therefore display `0/3` and the level-one price while the server may charge or reject at a higher owned-gear rank. Legacy storage is also still read/written in `packages/client/src/ui/pet-select.ts:34-67` and `packages/client/src/scenes/ArenaScene.ts:11955-11985`.
- **Scale:** approximately 350 direct LOC across catalog/migrations, the server handler, client shop/persistence, and three wire fields; no assets.
- **WHY:** the same click is priced from two different progression models, so pruning only one side can lose purchases while keeping both sides can misstate the amount charged.
- **Retirement precondition:** decide the gear-era Trading Post behavior (sell the nine ordinary grant items, present their actual owned ranks, or remove this band), ship that UI, and keep a V2-to-V4 account migration boundary for at least the chosen legacy-cache support window.
- **Concrete removal recipe:** (1) immediately hide `renderUpgradeBand` for gear-seeded/V4 runs or derive its rank and price from `account.ownedGear`; (2) move `MetaAccountV2`, `sanitizeMetaAccountV2`, `LEGACY_UPGRADE_GRANTS`, and the V2 branch at `packages/shared/src/meta.ts:91-100,202-269,331-337` into an isolated input-only migration module; (3) delete the `buyUpgrade` message/handler, `META_UPGRADES`, `nextUpgradeCost`, `upVitality/upFortune/upPower`, the Arena `saveUpgrades` helpers/signature, `dd.beltUpgrades`, `dd.beltScrip`, and `dd.metaAccount.v2` compatibility writes; (4) replace their progression/GameRoom/client tests with one fixture proving an old V2 blob becomes the expected owned gear exactly once.
- **Schema/data implications:** removing the three `PlayerState` fields requires the next coordinated `SCHEMA_VERSION` bump (31 to 32 or later); removing V2 deserialization is an account-data support decision and should be a later, separately measurable cut.
- **Risk:** **high**—saved local accounts and Scrip value are the failure domain; the smallest safe step is fixing/hiding the split-brain UI before deleting any migration code.

### P0-2 — Do not prune schema-v1 gear rendering or old-format files until the replacement manifest is complete

- **Evidence / who still references it:** the audit snapshot is already manifest schema 2, but only `22/105` items and `22/107` role textures are installed, with 85 missing and `compositeProof.ready: false` at `tools/artkit/out/gear/gear-parts-manifest.json:1254-1259` and `tools/artkit/out/gear/gear-parts-manifest.json:444`; validation explicitly accepts both schema 1 and 2 and accepts still-rendering slots at `packages/client/src/sprites/gear-parts.ts:683-714`; `assembleGearLoadout` retains its v1 branch at `packages/client/src/sprites/gear-parts.ts:1487-1524`, `SpriteRig` retains the v1 loose-part branch at `packages/client/src/entities/SpriteRig.ts:2193-2277`, and the generator can still emit schema 1 at `tools/artkit/gen-gear.mjs:2104`. The selection overload is explicitly labeled v1-only at `packages/client/src/sprites/gear-parts.ts:825-850`.
- **Scale:** about 80 clearly branch-exclusive runtime LOC plus dual-schema types/tests; public gear currently contains 96 PNGs/13.89 MiB—22 intentional v2 overlays/cloaks (5.69 MiB) and 74 old-format fleet targets (8.20 MiB).
- **WHY:** `schemaVersion: 2` currently means “contract selected,” not “catalog installed,” so using the version bit as the deletion gate would strand 83 rerender items and remove deliberate overlay art.
- **Retirement precondition:** regenerate until `installedItemCount === expectedItemCount`, `installedRoleTextureCount === expectedRoleTextureCount`, `installedPartCount === expectedPartCount`, `missing.length === 0`, `invalid.length === 0`, and `compositeProof.ready === true`; run the bake/cache/SpriteRig tests against the real generated manifest rather than only synthetic v2 clones; then make `gen-gear.mjs` incapable of emitting v1.
- **Concrete removal recipe:** delete schema-1 acceptance in `validateGearPartsManifest`, the `AlternativeHeadTextureSelection` overload/fallback, only the v1 half of `assembleGearLoadout`, and only the non-replacement branch in `SpriteRig.equipGearLoadout`; retain `assemblyPart`, `ensureGearPartFrame`, `syncGearArt`, and attachment positioning because v2 still uses them for cloaks, overlay hats, and prestige caps (`packages/client/src/entities/SpriteRig.ts:2152-2156`, `packages/client/src/sprites/gear-parts.ts:1260-1342`). Remove v1 fixtures after adding a real-manifest completeness test.
- **Schema/data implications:** no Colyseus bump; this is an art-manifest contract break. Do not bulk-delete `public/sprites/gear`: the fleet writes replacements to those same paths, and the final manifest should drive an exact unreferenced-file sweep after the fleet stops.
- **Risk:** **critical if early, low after the gate**—the smallest honest step now is adding a checked `--require-complete` build gate, not deleting compatibility code or files.

## P1 findings

### P1-1 — The 40-character kit system is compatibility identity, not yet dead; retire it as one vertical slice

- **Evidence / who still references it:** 40 playable IDs and 40 stat/quirk kits remain at `packages/shared/src/characters.ts:6-56`; `PlayerState.character` and `runCharacter` remain wire identity at `packages/shared/src/state.ts:97-98,219-221`; the server still accepts/cycles characters and snapshots their spreads at `packages/server/src/rooms/GameRoom.ts:1519-1521,1833-1840,3026-3107`, and joins without a V3/V4 gear account still take the character path at `packages/server/src/rooms/GameRoom.ts:3943-3987`. The client deliberately constructs a legacy character rig when gear strings are absent at `packages/client/src/scenes/ArenaScene.ts:3880-3917`, and the portal still lists `CHARACTER_KITS` at `tools/portal/gen-portal.mjs:34-36,82-85`.
- **Scale:** at least 460 direct identity/fallback LOC (including the 304-line generated roster, server snapshot/join code, client fallback, and portal); 39 `cc-*` rig directories contain 193 PNGs/1.86 MiB and their 39 matching portraits add 2.06 MiB raw, before the shared 5.38 MiB atlas is repacked.
- **WHY:** piecemeal deletion would make old joins, character-cycle messages, stat seeding, muzzle reach, and rendering disagree about the player's authoritative body.
- **Retirement precondition:** require a sanitized V4 account on every supported join; replace the portal/deep-link character picker with a wardrobe loadout; finish the gear fleet; and copy any portrait/body identity references needed for future rerenders out of `packages/client/public` into an art-source location before deleting runtime rigs.
- **Concrete removal recipe:** in one schema release, reject V2/character-only joins, remove `cycleCharacter`/character dev-equip handling, `snapshotRunCharacter` and the fallback half of `snapshotRunIdentity`, `character`/`runCharacter`, `gearSeeded`/`spreadSeeded`, `CHARACTER_KITS`, `PLAYABLE_CHARACTERS`, `nextCharacter`, `characterName`, `characterScale`, the Arena `charOf` and `addBlob` legacy branch, and the portal rows; make muzzle reach use the boilerplate scale; regenerate `manifest.ts` and `dd-sprites.*` after deleting the 39 `cc-*` sprite directories and only the 39 migrated portraits. Move the still-live quirk table to a gear-owned module rather than deleting it.
- **Schema/data implications:** coordinated schema bump required; old clients must be refused cleanly. Account V2 migration should be handled before identity construction, not by preserving character wire fields.
- **Risk:** **high**—old clients/dev deep links and art-fleet provenance are the risks; the safe removal unit is the entire fallback slice, not `CHARACTER_KITS` alone.

### P1-2 — Drive made seven wire fields and three private ledgers obsolete, but `BeamState.heat` is still a client API

- **Evidence / who still references it:** Drive is the authoritative row at `packages/shared/src/state.ts:46-53`, and the HUD says ammo/reload/heat UI retires at `packages/client/src/scenes/ArenaScene.ts:10731-10759`. Nevertheless, `PlayerState.charges/maxCharges` remain at `packages/shared/src/state.ts:133-135`, dual-wield charge rows at `packages/shared/src/state.ts:62-72`, and they are only zeroed server-side (for example `packages/server/src/rooms/GameRoom.ts:2433-2438,2771-2772,3687-3695`) before being copied through `packages/client/src/ui/loadout-entry-view.ts:63-73`. `flexTimerLegacy` and `elapsedLegacy` have no reader beyond their declarations at `packages/shared/src/state.ts:118-120,603-604`. By contrast, `BeamState.heat` is populated as a Drive compatibility alias at `packages/server/src/rooms/GameRoom.ts:7622-7623` and is actively consumed by beam VFX/audio at `packages/client/src/vfx/BeamRenderer.ts:294,349-352,405,485,634` and `packages/client/src/scenes/ArenaScene.ts:13753-13760`.
- **Scale:** approximately 120 touched LOC across ten obsolete definitions/zero-writes/accessors/UI signatures/tests and 98 total legacy-field references including tests; no assets.
- **WHY:** zero-valued wire rows consume schema budget and maintain false ammo semantics, while deleting `heat` today would silently remove beam redline feedback.
- **Retirement precondition:** none for server-private `CombatState.reloadCd` and `ArsenalSlot.reload/resourceCharges`; a coordinated schema bump for charge/timer rows; and, for heat, first derive normalized pressure from `BeamState.ownerId -> PlayerState.weaponResource.valueQ` (or append a generic pressure row) and pass it into `BeamRenderer`/audio.
- **Concrete removal recipe:** first delete `reloadCd`, `ArsenalSlot.reload`, `ArsenalSlot.resourceCharges`, their zero assignments, and zero-only tests; at schema 32 delete player/offhand charge fields, compatibility getters, `loadout-entry-view` fields, Arena signatures, `flexTimerLegacy`, `elapsedLegacy`, and their assertions; in a later or same coordinated client change replace all `row.heat` reads, then remove the server alias and `BeamState.heat`.
- **Schema/data implications:** remove the decorated fields only with a version bump and simultaneous client/server deploy. Keep `WeaponDef.gun.magazine` and `WeaponDef.thrown.charges`: Drive still uses them as authoring inputs at `packages/shared/src/weapon-resource.ts:209-213`.
- **Risk:** **medium**—charge/timer rows are low-risk tombstones; beam heat is medium-high visual/audio regression risk until its consumer is migrated.

### P1-3 — BELT is publicly shelved but remains a second game mode with a large compiled and asset surface

- **Evidence / who still references it:** the menu records the ruling and keeps BELT URL-only at `packages/client/src/scenes/MenuScene.ts:291-295,351`; the client still contains dedicated floor/projection/camera/gate code at `packages/client/src/scenes/ArenaScene.ts:7982-8360` and arsenal/shop/bag/upgrade UI at `packages/client/src/scenes/ArenaScene.ts:11955-13179`; the server retains Belt room waves at `packages/server/src/rooms/GameRoom.ts:11937-12011` and approximately 90 Belt references, including a legacy World-Titan finale at `packages/server/src/rooms/GameRoom.ts:1002`. Matchmaking still exposes a Belt filter through `packages/server/src/index.ts:18` and `packages/client/src/net/matchmaking.ts:34,62,90-91`.
- **Scale:** at least 2,200 dedicated LOC (320 shared map + 1,604 contiguous Arena blocks + 75 server room lines + 201 generators), plus 145 Arena and 90 GameRoom condition sites; `public/belt` is 15 files/38.92 MiB and Belt-named art workbench output is 54.68 MiB.
- **WHY:** leaving a URL-only mode inline makes every movement/combat/economy refactor pay two-mode complexity and copies 38.92 MiB into the deploy artifact even though top-down is the declared product.
- **Retirement precondition:** first decide whether top-down must inherit Belt's shopkeeper, three-slot/bag selling, Scrip, banking/send-home, and room-gate loop; port the desired economy/arsenal flows before deleting the mode that currently hosts their only full UI.
- **Concrete removal recipe:** smallest step: remove `?belt=` launch and public matchmaking filter, put Belt construction behind a dev-only dynamic import, and move Belt images out of unconditional `public`; full shelf: remove `belt-map.ts`, Belt scene data/asset preload, projection/camera/floor/gate/shop UI, GameRoom `this.belt` branches/room director/legacy boss fallback, three synced Arena Belt fields at `packages/shared/src/state.ts:653-659`, matchmaking types, the two generators, tests, and assets. Preserve generic arsenal, weapon-bank, Scrip, and account code that top-down also owns.
- **Schema/data implications:** full removal needs a schema bump for `beltLockX`, `beltRoomName`, and `beltShopX`; saved account/bank data is mode-independent and must not be deleted.
- **Risk:** **very high for full deletion, low for hiding/lazy isolation**—the recommended first cut is to stop shipping/exposing it while retaining the source until top-down economy parity is explicit.

## P2 findings

### P2-1 — The two banned whip weapons are absent from gameplay but still boot-load derived art

- **Evidence / who still references it:** `x2-galvanic-crackwhip` and `x2-psalmstone-beadwhip` are marked banned at `data/weapon-concepts-300.json:3562-3563,12907-12908`, and gameplay codegen deliberately skips them at `tools/artkit/gen-weapon-expansion.mjs:327-329`; however, they remain sprite-manifest entries at `packages/client/src/sprites/manifest.ts:8285-8286,10861-10862` and art/VFX subjects at `tools/artkit/subjects-300.json:1704,5757` and `tools/artkit/subjects-vfx-300.json:585-588,1957-1960`. The preload condition at `packages/client/src/scenes/ArenaScene.ts:1707-1713` skips only `WEAPONS[id]?.expansion`; an absent banned `WEAPONS` row is falsy, so its loose sprite is queued instead of skipped.
- **Scale:** roughly 70 derived JSON/TS lines plus 3 public PNGs/0.046 MiB; their workbench derivatives occupy about 16.97 MiB (overlapping the outline archive count below).
- **WHY:** a content ruling currently removes mechanics but not generated payload, so banned assets keep reappearing and are needlessly requested at boot.
- **Retirement precondition:** none beyond retaining the two `banned: true` source records as the historical/content-policy source of truth.
- **Concrete removal recipe:** change preload to require a real playable weapon definition (prefer iterating the active weapon roster rather than all `SPRITES`); make subject/VFX/harvest generators filter `banned`; regenerate `subjects-300.json`, `subjects-vfx-300.json`, and `manifest.ts`; delete both public sprite directories and their `tools/artkit/out/<id>` trees plus outline/orientation records; add a consistency test asserting every banned ID is absent from gameplay, sprite, card, and VFX derived manifests.
- **Schema/data implications:** none; retain the source rows, delete only derived artifacts.
- **Risk:** **low**—the only preservation concern is intentional source/history, which the banned catalog rows already provide.

### P2-2 — `classForCharacter` is already gone; only lineage metadata is dead, while quirks and gear classes are live

- **Evidence / who still references it:** there is no `classForCharacter` symbol repository-wide. The module itself says classes are dissolved at `packages/shared/src/character-classes.ts:1-4`; `CHARACTER_LINEAGE` is explicitly non-gating at `packages/shared/src/character-classes.ts:76-121`, and its only outside reference is a definedness assertion at `packages/server/src/rooms/progression.test.ts:205`. `QUIRKS`, however, is read by gear at `packages/shared/src/gear.ts:381`, while `spreadForCharacter`/`quirkForCharacter` still serve the identity fallback at `packages/shared/src/combat.ts:207,230` and `packages/server/src/rooms/progression.ts:77`.
- **Scale:** approximately 51 immediately dead LOC (lineage type/map/accessor/test); no assets in this finding.
- **WHY:** keeping a dead fantasy taxonomy beside live gear quirks invites a fix-bot to delete the whole module and break gear behavior.
- **Retirement precondition:** none for lineage; character spread/quirk helpers wait on P1-1.
- **Concrete removal recipe:** now delete `CharacterLineage`, `CHARACTER_LINEAGE`, `lineageForCharacter`, their comments, and the progression definedness assertion; when P1-1 lands, move `QUIRKS`/`QuirkDef` to `gear-quirks.ts`, switch `gear.ts` imports, and then delete `characterKit`, `spreadForCharacter`, and `quirkForCharacter`. Do not remove or rename live `GearClass`/weapon `classPool` as part of this prune.
- **Schema/data implications:** none for lineage; the later identity-helper cut shares P1-1's schema release.
- **Risk:** **low now, medium if over-broad**—the exact small cut is lineage only.

### P2-3 — The retired standalone outline mutator is orphaned; its rollback archive is the only reason not to delete it immediately

- **Evidence / who still references it:** `tools/artkit/gen-outlines.mjs:1-17` is a 396-line standalone in-place mutator/restore tool; repository scripts/imports do not call it. The replacement gear pipeline performs its own outline/install validation at `tools/artkit/gen-gear.mjs:1316-1349` and emits the live outline contract at `tools/artkit/gen-gear.mjs:2126`. The runtime validates that contract at `packages/client/src/sprites/gear-parts.ts:689-705`, so the outline *contract* is live even though the global mutator is not.
- **Scale:** 396 LOC; `tools/artkit/out/outlines` is 863 files/48.84 MiB, of which the originals archive is 862 files/48.24 MiB.
- **WHY:** an unused in-place art mutator is dangerous to leave discoverable, but deleting its only original-byte archive without a source backup makes prior outline operations irreversible.
- **Retirement precondition:** verify canonical unoutlined masters exist outside this workbench or copy the originals archive to the owner's durable art storage.
- **Concrete removal recipe:** after that copy/check, delete `gen-outlines.mjs` and `tools/artkit/out/outlines/**`; remove any instructions that tell artists to run it; retain `gen-gear.mjs`'s integrated outline code and `GearPartsManifest.outlinePass` validation.
- **Schema/data implications:** none; repack the atlas only if restoring/changing public source pixels before deletion.
- **Risk:** **medium** because the archive may be the only rollback source; low once externally preserved.

### P2-4 — Two old concept catalogs duplicate the active art-subject catalog but have no tool consumer

- **Evidence / who still references it:** `data/character-concepts.json` (50 records/411 lines) and `data/weapon-concepts.json` (107 records/1,625 lines) have exact name matches for all 157 records in `tools/artkit/subjects.concepts.json` (1,706 lines), but repo-wide references to the two `data/` files are documentation/backlog only. Current tools read the duplicate instead: `gen-character-roster` reads `subjects.concepts.json` at `tools/artkit/gen-character-roster.mjs:12-20,31-35`, and Weaponsmith includes it at `tools/weaponsmith/server.mjs:30-40`. `BACKLOG.md:39-40` still calls the data catalogs future promotion sources even though the 40-character runtime and wardrobe arc superseded that plan.
- **Scale:** 2,036 source-catalog LOC/0.103 MiB duplicated into a 1,706-line/0.082 MiB active subject file.
- **WHY:** two editable sources for the same names/prompts let art generation and planning drift without any check noticing.
- **Retirement precondition:** the owner must classify the 107 non-overlapping old weapons and 11 unpromoted character concepts as either archived ideas or future content; they do **not** overlap the separate 297-row expansion catalog.
- **Concrete removal recipe:** if still canonical, add `gen-concept-subjects.mjs --check` that deterministically emits the 157 subject rows from the two data files while preserving the seven non-catalog enemy/boss subjects, then stop hand-editing duplicates; if retired, archive the two data files outside runtime, remove their 157 subject rows and stale `BACKLOG.md:39-40` promises, and update `gen-character-roster`, `gen-gear`, `gen-final-sprint`, and Weaponsmith inputs accordingly.
- **Schema/data implications:** no game schema; this is an authoring-source migration. Keep `data/weapon-concepts-300.json`, `data/dimensions-design.json`, and `data/dimension-shifters.json`, which have active generators/tests.
- **Risk:** **medium-high** because deletion can erase unpromoted creative inventory; the smallest step is establishing one generated source before removing either copy.

### P2-5 — Four generated UI-icon packs and 11 public portraits are deployment orphans

- **Evidence / who still references it:** the four generated modules declare class/stat/rarity/emote arrays at `packages/client/src/sprites/icon-manifest-classes.ts:1-13`, `packages/client/src/sprites/icon-manifest-stats.ts:1-14`, `packages/client/src/sprites/icon-manifest-rarity.ts:1-12`, and `packages/client/src/sprites/icon-manifest-emotes.ts:1-12`; no client/server/shared file imports any array or references any generated icon ID. Their generator definitions remain at `tools/artkit/gen-decals.mjs:216-238`. Separately, 11 portrait files (`cc-doctor-quillane`, `cc-greta-ironbraid`, `cc-hrothgar-snowfang`, `cc-old-gen-the-drunken-crane`, `cc-old-quill-grathmar-the-rune-scribe`, `cc-skitch-wren`, `cc-snarekeeper-vossel`, `cc-snarlfang`, `cc-vellichor-the-ash-robed`, `cc-vesper-lux`, `cc-warden-ashlock`) are absent from the 39-ID roster at `packages/shared/src/characters.ts:6-47` and have no sprite/gear-manifest consumer; their only code-adjacent references are art subjects such as `tools/artkit/subjects.concepts.json:1252,1549,1585`.
- **Scale:** icon packs are about 75 generated/config LOC and 35 PNGs/0.445 MiB; the 11 portraits add 0.743 MiB. Total public prune candidate: 46 files/1.19 MiB.
- **WHY:** putting art-workbench outputs under `public` copies them into deploys even when no runtime loader can address them.
- **Retirement precondition:** confirm the four icon packs are not reserved for an imminent UI and decide whether the 11 unpromoted concepts remain art provenance.
- **Concrete removal recipe:** delete the four manifest modules, four `public/ui/icons/*` directories, and their pack definitions (or move prompt specs to non-public art docs); move retained unpromoted portraits to `tools/artkit/references/characters`, update subject/art generators to that path, then delete the 11 public copies. Add a build check that every `public/ui` generated pack has at least one source import or an explicit `art-reference-only` allowlist outside `public`.
- **Schema/data implications:** none; moving portrait references requires updating artkit paths but not game/account data.
- **Risk:** **low** for icons, **medium** for portraits if they are the sole high-quality source image.

## P3 findings

### P3-1 — The old carousel implementation is gone; the remaining prune is stale naming and 917 lines of completed design history

- **Evidence / who still references it:** current runtime code describes and builds the mirrored-L dock at `packages/client/src/scenes/ArenaScene.ts:11208-11216`, but still names the live types/fields/methods `CarouselDock`, `buildCarousel`, and `updateCarousel` at `packages/client/src/scenes/ArenaScene.ts:485-512,1596,11209`; the layout retains one “carousel” tie-behavior comment at `packages/client/src/ui/weapon-dock-layout.ts:219`. Meanwhile `BACKLOG.md:42,47` still says the L dock/arsenal carousel is pending. `docs/carousel-panel` is 630 physical lines and `docs/dockux-panel` is 287; both describe completed iterations with stale line references.
- **Scale:** no dead gameplay block was found; rename surface is roughly 30 identifiers/comments, while historical docs total 917 physical lines (635 nonblank); no assets.
- **WHY:** stale “carousel” names and backlog text make audits repeatedly mistake the current dock for an unimplemented or duplicate system.
- **Retirement precondition:** none; decide whether completed panel reports are deleted or moved under a clearly historical archive.
- **Concrete removal recipe:** rename `CarouselDock*` to `WeaponDock*`, `build/update/wake/fadeCarousel*` to `*WeaponDock`, update card-art comments, mark the L-dock parts of `CODE-19`/`CODE-5` complete, and delete or archive `docs/carousel-panel/**` plus `docs/dockux-panel/**`. Do not delete the current dock renderer.
- **Schema/data implications:** none.
- **Risk:** **low**—mechanical rename/documentation cleanup only; behavior should remain unchanged.

## Explicit keep list (prevents over-pruning)

- Keep `QUIRKS` until it is moved to gear ownership: gear resolves hat quirks from it at `packages/shared/src/gear.ts:381`.
- Keep `GearClass` and weapon `classPool`: these are active equipment/loot taxonomies, not dissolved character classes.
- Keep `gun.magazine` and `thrown.charges` authoring fields: Drive converts them into costs at `packages/shared/src/weapon-resource.ts:209-213`; only their old runtime counters retire.
- Keep the 22 v2-preserved public gear assets (10 overlay hats and 12 cloaks) identified by the generated migration plan at `tools/artkit/out/gear/gear-parts-manifest.json:275`; they remain v2 extras.
- Keep `data/weapon-concepts-300.json`, `data/dimensions-design.json`, and `data/dimension-shifters.json`: active generators consume them at `tools/artkit/gen-weapon-expansion.mjs:18-20` and `tools/artkit/gen-dimensions.mjs:17-18`.

## Executive summary

- Fix the V4 shop's displayed rank/price first; its old fields and new gear grants currently disagree on live purchases.
- Gate gear-v1 retirement on 105/105 items, 107/107 role textures, zero missing/invalid rows, and completed composite proof—not on `schemaVersion: 2` alone.
- Retire character identity and Drive tombstones only in coordinated schema releases; preserve gear quirks and Drive's magazine/charge authoring inputs.
- Hide/lazy-isolate BELT now, but do not delete its economy surface until top-down has an explicit replacement; it costs at least 2.2k LOC and 38.92 MiB public art.
- Low-risk cleanup can reclaim the banned derivatives, dead lineage, icon packs, stale docs, and—after backup—the 48.84 MiB outline workbench.
