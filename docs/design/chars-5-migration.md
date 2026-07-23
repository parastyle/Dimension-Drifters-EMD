# Character Wardrobe Retirement: Migration and Systems Plan

## 1am summary

Do not delete the 113 rows first: today they are account data, character stats, combat modifiers, server join identity, remote-render wire data, menu state, developer routes, and art-test truth as well as failed clothing. First introduce a character-owned runtime and account field behind a new-room flag, recover the three paid Scrip upgrade ranks from old gear ownership, and make new rooms use a retained character's unchanged kit while old rooms keep running. The current roster handoff retains 32 of 40 live IDs, so the same seam must reject/remap the eight cuts without transferring their stats or quirks. Then make wardrobe gear visual-only, land whole-body plus character-owned-head rendering on the existing bob spring, replace Wardrobe with Characters while preserving the independent Armory, weapon bank, prestige, Drive bar, and Ultimate systems, and only after compatibility has drained remove the pairing catalog, assets, code, generated portal rows, and count tests together. This ordering deliberately prevents the two failure modes that matter most here: a half-refactor that leaves combat or saves broken, and a stale exact-count/census guard that crashes the server during boot.

## Working mandate

Retire the 113-piece modular wardrobe and the torso+head pairing catalog without preserving their visual assets, while keeping the game playable throughout the transition. This report separates wardrobe visuals from gear-derived mechanics, preserves only the per-character head-bob rig boundary, inventories all 40 legacy kits, carries the 32 identities retained by Chars-1 without redesigning their stats, safely retires the other eight, and coordinates sequencing with the concurrent stat-simplification work. It is a plan only: no product code, assets, generated files, tests, or live services will be changed.

## Safety constraints and working assumptions

- The wardrobe decision is final; deleted wardrobe art is not migrated or archived as a product feature.
- Whole-prompted characters retain a character-owned head solely for secondary bob motion; heads are never interchangeable.
- Existing body animation work (combo movesets, hands, dodge roll/tumble) remains in scope to preserve.
- Migration phases must leave the client and server mutually compatible and bootable; census guards are treated as release gates, not incidental cleanup.
- Character stat/quirk redesign belongs to the stat-simplification panel. This track inventories and sequences those dependencies but does not decide replacement balance.

_Investigation log and final disposition will be appended below as code and data are verified._

## Verification checkpoint 1: the dependency shape

- `docs/sol-reports/README.md` requires a durable report from the start and incremental updates; this design report is the requested report of record for this panel.
- `packages/shared/src/gear.ts` is both visual catalog and gameplay truth. It defines eight wardrobe slots, gear ids/net codes, art keys/face receivers, stat transfers (`spreadMoves`), quirk references, scalar combat modifiers, starter loadout behavior, and loadout resolution. Those concerns must be split before the file can be removed.
- `packages/shared/src/meta.ts` persists `equippedGear` in the current account shape and derives/sanitizes it during account creation and migration. Removing the catalog first would therefore invalidate saved accounts before the UI is involved.
- `packages/server/src/rooms/GameRoom.ts` calls `resolveGearLoadout(account.equippedGear)` while establishing player identity/runtime modifiers. This is the principal server combat boundary to neutralize before visual removal.
- Client dependencies are broader than `MenuScene`: `SpriteRig.ts`, `sprites/gear-parts.ts`, `sprites/gear-texture-baker.ts`, `ui/remote-gear.ts`, and `ui/wardrobe/{model,preview}.ts` consume the modular loadout. Their tests deliberately pin eight-slot assembly, encoding, previews, mixed sets, and fallback behavior.
- Weapon “set bonus” references (`weaponSetBonus`, `classCount`) are a separate three-weapon arsenal mechanic, not a wardrobe-set bonus. They must remain; naming alone is not grounds for deletion.
- `packages/shared/src/characters.ts` remains the source of per-character starting spread and quirk id, while `packages/shared/src/character-classes.ts` resolves those kits and explicitly labels each quirk `active`, `partial`, or `inert`. The roster identity seam already exists independently of wardrobe visuals.

This confirms the safe order: establish character-owned identity and a non-gear runtime path, neutralize wardrobe mechanics, stop writing wardrobe persistence/wire state, switch rendering, then retire catalogs/assets and update censuses last.

## Verification checkpoint 2: gameplay and persistence are coupled to wardrobe

The 113 rows divide exactly into eight blank starter pieces, 96 launch pieces (12 named sets × eight slots), and nine former meta-upgrade ranks. The 12 sets are `ash-walker`, `ashen-crusader`, `molten-core`, `coldsnap`, `graveside`, `nine-veils`, `demon-mask`, `thornwatch`, `neon-mirage`, `house-edge`, `unbending`, and `pressurized` (`packages/shared/src/gear.ts`, `GEAR_IDS`/`LAUNCH_GEAR_IDS`). Their mechanical content is not a conventional full-set threshold bonus: `GEAR_CLASS_BONUSES` is deliberately empty. Instead, set identity is distributed across each loadout: all 12 torsos perform stat-spread moves; 12 hats/full heads reference a signature quirk; 23 pieces carry scalar modifiers; and six of the nine upgrade pieces add flat stats. `legacySetId` otherwise drives filtering, completion display, and visual fallbacks. The three-weapon `weaponSetBonus` mechanic is independent and stays.

Current server behavior makes removal order critical:

- On join, a supplied V3/V4 account is resolved through `resolveGearLoadout`; `GameRoom.snapshotGearRun` then seeds `baseStats`, sets character/runCharacter to Drifter, installs the gear quirk/mods, zeros `upVitality/upFortune/upPower`, adds gear max HP, and emits `gearUpper`/`gearLower` (`packages/server/src/rooms/GameRoom.ts:4229-4274`, `3338-3365`). Character kits are only the compatibility path for older accounts.
- Active consumers include damage, every weapon recovery category, draw lock, max HP, healing received, hazard damage, incoming-hit cap, regeneration, crit chance, parry frames/cooldown/knockback/chain behavior, beam vent/lock, harvest, and quirk event hooks. `rollCooldownMult` and `pickupReachMult` are defined in the runtime shape but have no server reader found in the current sweep.
- Level allocation and ultimate ranking branch on `PlayerState.gearSeeded`; max-HP re-derivation adds `gearMaxHpAdd` (`packages/server/src/rooms/progression.ts`, `packages/shared/src/state.ts`). These server-only flags must be collapsed onto character identity or deleted only after every branch is replaced.
- Account V2’s three paid Scrip tracks (`vitality`, `fortune`, `power`) migrate into the nine gear rows via `LEGACY_UPGRADE_GRANTS`; V3/V4 persist `ownedGear` and `equippedGear` (`packages/shared/src/meta.ts`). A new migration must recover the highest owned rank in each track before discarding those arrays, or already-spent Scrip/progression is lost.
- `GameRoom`'s `buyUpgrade` handler also infers the current rank from those owned gear ids, spends Scrip, and adds the next grant. It must be changed to read/write the independent rank in the same release that character-v2 becomes canonical; otherwise the UI may charge Scrip for an item the new account immediately discards.
- Weapon banking, account revision, pets, prestige, and Scrip share the same V4 blob. The wardrobe migration must therefore preserve all non-gear fields byte-for-semantics and never reset the entire account merely because old gear ids become unknown.
- The public schema currently carries `gearUpper` and `gearLower` inside `DualWieldState`, while `gearSeeded` and `gearMaxHpAdd` are server-only. Deprecate the strings through a compatibility window; do not reorder/remove live Colyseus fields in the same release that new clients arrive.

Safe default for paid upgrades: re-home their rank as explicit non-gear meta progression in the successor account schema (or the stat panel’s chosen equivalent) and preserve the existing Scrip costs/effects until that panel deliberately changes them. Wardrobe set ownership has no stated currency refund requirement and the owner has abandoned it; do not manufacture compensation. This preserves the Scrip economy without preserving wardrobe inventory.

## Verification checkpoint 3: pairing, presentation, UI, and tooling boundaries

The old "pair" system is broader than one torso matched to one head. The generated contract contains 12 torsos and 17 complete replacement heads (the 12 set heads plus five former full-head hats), while the runtime permits arbitrary mixing across all eight slots. `legacySetId` provides matching, filtering, and fallback behavior; `faceReceivers`, the socket-frame contract, and the texture baker make eyes, mouth, hat, facial-hair, and torso layers compose (`tools/artkit/out/gear/gear-parts-manifest.json`, `tools/artkit/gen-gear.mjs`, `packages/client/src/sprites/gear-parts.ts`). All of that is pairing-specific and should be deleted after the new renderer is established.

The reusable bob is much smaller and cleanly separable. `SpriteRig.ts` owns the floating-head spring state, sampling/stepping functions, reduced-motion limit, pose synchronization after the weapon/combo pass, tint/LOD handling, and atomic body/head texture updates. The current mount scale is `HEAD_MOUNT_SCALE = 0.85` in `packages/client/src/sprites/gear-parts.ts`; it must move into a character-rig contract rather than remain imported from deleted wardrobe code. The bob should receive a character-owned `head` texture and `headSocket`, never an interchangeable gear id. Existing character manifests currently list body/hands/feet but no head role, so the character pipeline must add that role and its atlas frame before the wardrobe fallback can go away (`packages/client/src/sprites/manifest.ts`).

The wardrobe UI is also carrying unrelated meta-game behavior. `MenuScene.ts` defaults to a Wardrobe tab and owns wardrobe browsing/equipping, presets, completion, and gear developer links. Those are deleted. The weapon Armory is independent and stays. Prestige ceremony and weapon-bank-at-stake logic currently live in `ui/wardrobe/model.ts`; they must be moved to a dedicated prestige module or the Run/Armory flow before that module is removed. The V4 account's Scrip, pets, pity, prestige, revision, and `weaponBank` must retain their current semantics. The wardrobe preset key `dd.wardrobe.presets.v1` may become an ignored tombstone; outfits do not need migration.

The count blast radius is explicit. `packages/server/src/rooms/progression.test.ts` pins 96 authored launch rows and 113 total rows; wardrobe and rig tests pin eight-slot assembly, eight-piece completion, wire encoding, and art completeness; `MenuScene.dev-links.test.ts` pins the gear developer route. `tools/portal/gen-portal.mjs` generates a 113-item Gear category and `?dev=gear:<id>` links into `tools/portal/index.html`; the same portal currently labels and counts 40 "Legacy Characters," which must become the retained 32. The main `assets:check` does not currently census loose wardrobe gear, but it will census the new character head role/atlas once that role is added; the separate gear generator and completeness tests enforce the old manifest. Therefore catalog/assets/tests/generated portal output must change together at the end, after all imports are gone. A changed exact-count assertion must not execute as an import-time server boot guard. The repository already contains an example of fatal import-time resource census enforcement in `packages/shared/src/weapon-resource.ts`; repeating that pattern during a transitional zeroing of gear could crash the server before a room starts.

### Exact task #64 cut line

| Pairing/mix-and-match specific: delete after fallback drains | Character-owned bob specific: keep/re-home |
|---|---|
| Shared `GearSlot`/catalog/net-code/loadout encoding, `legacySetId`, `faceReceivers`, pants/full-head migrations, and starter loadout. | `FloatingHeadSpringState`, input/tuning types, `FLOATING_HEAD_SPRING_TUNING`, `sampleFloatingHeadWalkBob`, and `stepFloatingHeadSpring` in `SpriteRig.ts`. |
| Generated `GEAR_REPLACEMENT_V2`/`GEAR_SOCKET_FRAME_V1`, `gear-parts-manifest.json`, 12-torso/17-head fleet data, `gen-gear.mjs`, `lib/gear-catalog.mjs`, and `lib/gear-replacement-contract.mjs`. | Existing spring law: 8.4 rad/s, damping 0.48, 4 px per-axis displacement cap, 72 px/s velocity cap, 50 ms integration cap, and reduced-motion cap 0.35 px. Chars-3 owns any future tuning. |
| `gear-parts.ts` manifest validation, torso/head normalization, set fallback, hat/face layer composition, `AlternativeHeadTextureSelection`, `resolveLoadoutHeadTexture`, and `assembleGearLoadout`; all of `gear-texture-baker.ts` after its callers are gone. | The dedicated head image/spring lifecycle, discontinuity rebase, offscreen/LOD wake behavior, tint/death participation, and atomic body/head texture commit. Rename `boilerplateHead` terminology to character head; do not delete the behavior with the name. |
| `SpriteRig.equipGearLoadout`/`equipSyncedGear`, gear cache keys, `gearAssembly.rigSockets.head`, alternative-head arguments, eight-slot fixtures, and the `ArenaScene` gear-first Drifter scaffold. | `syncBoilerplateHeadPose`'s presentation ordering after the final body/weapon/combo transform, including attack/flourish lead, walk counter-bob, air/landing response, slide/dash lag, and reduced motion. |
| Wardrobe preview's arbitrary torso/head combinations and all `gearUpper`/`gearLower` visual decoding after the wire window. | One character-owned `head.png`, a normalized `headSocket`, pivot, and mount scale in the character manifest. Move the verified 0.85 scale out of `gear-parts.ts`; never expose a head-selection API. |

## Verified legacy identity contract

`packages/shared/src/characters.ts` contains 40 live characters. Every current spread has five values (`str`, `dex`, `int`, `con`, `luk`) summing to 10, and every character names one signature quirk. `packages/shared/src/character-classes.ts` is the resolver and explicitly records implementation availability. `data/character-concepts.json` contains 50 concepts, so it is not itself the live roster: Drifter plus 39 promoted concepts are live and 11 remain unpromoted (Greta Ironbraid, Hrothgar Snowfang, Skitch Wren, Vesper Lux, Vellichor the Ash-Robed, Old Quill Grathmar, Old Gen, Snarekeeper Vossel, Doctor Quillane, Warden Ashlock, and Snarlfang). The completed Chars-1 handoff recommends a 32-character production roster (Drifter plus 31), not all 40; Chars-2 and Chars-4 now use the same 32-ID baseline.

For this migration, each of the 32 retained spread/quirk pairs carries over unchanged. The eight cut kits remain inventory evidence during compatibility but are not transferred to another character. That is a compatibility bridge, not a claim that the five-stat design is final. It prevents an art-system retirement from silently becoming a balance redesign, and it gives damage, HP, crit, cooldown, and progression code a complete non-gear identity immediately. Whole-prompted art must not activate an inert quirk as a side effect.

The implementation status verified in `character-classes.ts` is:

| Availability | Character -> quirk | Migration treatment |
|---|---|---|
| Active (7) | Drifter -> `unwritten`; Asha -> `mend-the-broken`; Neon Mirage -> `package-deal`; Tinker-Magnus -> `pressurized`; Brother Cassian -> `habit-and-prayer`; Marshal Galloway -> `the-unbending`; Elias -> `graveside-manner` | The six retained kits carry unchanged. Galloway is cut; `the-unbending` becomes an orphan candidate and is not transferred to Cassian. |
| Partial (1) | Kuro-Oni -> `temple-wall` | Carry unchanged. The shove behavior exists; the enemy-stun half still lacks an enemy-status seam. |
| Declared but inert (32) | Listed below | Carry the 25 retained ids without inventing runtime behavior; leave the seven cut quirks orphaned. |

The 32 inert declarations and their missing seams are: Bastion/`planted` (stationary duration), Tendo/`one-perfect-strike` and Sojiro/`iai` (qualified attack receipts), Bryda/`the-pack-finds-you` (pickup attraction), Buzzard/`overstuffed-bandoliers` (per-holder magazine), Cinderpyre/`molten-core` and Pyra/`let-it-out` (enemy burn status), Cogwarden/`does-not-stop`, Cordell/`coldsnap`, Crowmantle/`a-better-owner`, Grix/`braced`, Halcyon-7/`half-projection`, Mei-Ling/`ribbon-step`, and Yuki/`fox-dance` (dodge-roll receipt), Corvane/`the-crimson-draught` (cast-reset input), Veyra/`insufferably-graceful` (parry-window outcome), Deepfall/`mag-boots` (impulse-source policy), Phineas/`snake-oil` (shop offers), Dunkel/`hazard-rates` (variable-arsenal schema), Gravewake/`already-dead` (death grace), Hollowmaw/`whispered-rites` (brand ownership), Iridia/`sees-every-future` (private telegraph preview), Magdalene/`posted` (per-enemy damage credit), Mawkin/`bottled-spite` (attacker identity), Mirelurk/`bog-patience` (target cloak), Odette/`the-house` (loot trigger ownership), Raijin/`thunder-behind` (melee finisher receipt), Sable/`ice-breaker` (enemy fire lock), Mordrane/`hollow-oath` (conditional damage modifier), La Sombra/`a-shape-in-the-dust` (dodge-roll receipt), The Hollow Mask/`porcelain` (dimension life token), and Thornroot/`regrow` (friendly damage zone). Seven of these inert kits are cut (Cordell, Buzzard, Dunkel, Deepfall, Halcyon-7, Grix, and Pyra), leaving the retained 32 at 6 active, 1 partial, and 25 inert.

The eight production cuts and their non-mechanical fallback aliases are:

| Retired live id | Orphan quirk | Character-v2 fallback id |
|---|---|---|
| `cc-cordell-coldsnap-vane` | `coldsnap` | `drifter` |
| `cc-buzzard-jeptha-hale` | `overstuffed-bandoliers` | `cc-the-bandida-la-sombra` |
| `cc-dunkel-the-coinblade` | `hazard-rates` | `cc-brother-cassian-the-ashen-crusader` |
| `cc-deepfall-korr` | `mag-boots` | `cc-bastion-vance` |
| `cc-halcyon-7` | `half-projection` | `cc-sable-cipher` |
| `cc-grix-boltcaster` | `braced` | `cc-bastion-vance` |
| `cc-pyra-cinderhowl-the-flame-caster` | `let-it-out` | `cc-cinderpyre` |
| `cc-sir-galloway-the-unbending` | `the-unbending` (active) | `cc-brother-cassian-the-ashen-crusader` |

These aliases are only a safe identity/render fallback for a stale selection or client. Once an id falls back, the retained target supplies its own spread and quirk. Never attach the cut spread/quirk to the target, and never imply that Cassian inherited `the-unbending`. Because current V4 does not persist a selected character, most accounts need only the default selection; the alias table still protects legacy join options, dev links, training state, and any saves created during the compatibility release.

## Mechanical demolition ledger

These mechanics are intentionally removed as wardrobe mechanics; they are not converted into invisible equipment:

- 12 torso spread transfers: `ash-walker-shirt`, `ashen-crusader-shirt`, `molten-core-shirt`, `coldsnap-shirt`, `graveside-shirt`, `nine-veils-shirt`, `demon-mask-shirt`, `thornwatch-shirt`, `neon-mirage-shirt`, `house-edge-shirt`, `unbending-shirt`, and `pressurized-shirt`.
- 12 gear quirk sources: the corresponding 12 `*-hat` ids. A selected character supplies its own one quirk after migration; a hat never supplies or replaces it.
- 23 scalar-mod rows: `ash-walker-shirt`, `ash-walker-gloves`, `ash-walker-cloak`, `ashen-crusader-gloves`, `molten-core-gloves`, `molten-core-cloak`, `coldsnap-gloves`, `coldsnap-cloak`, `graveside-shirt`, `graveside-gloves`, `nine-veils-gloves`, `nine-veils-cloak`, `demon-mask-gloves`, `thornwatch-gloves`, `thornwatch-cloak`, `neon-mirage-gloves`, `house-edge-gloves`, `house-edge-cloak`, `unbending-gloves`, `pressurized-cloak`, `mended-workshirt`, `reinforced-workshirt`, and `shopkeeps-sunday-best`.
- Nine legacy shop rows: the three workshirts represent +20/+40/+60 max HP, the Readers represent +1/+2/+3 LUK, and the Gloves represent +1/+2/+3 STR. The rows and art are deleted. Only the paid rank is recovered into account progression so Scrip already spent is not erased.
- `GEAR_CLASS_BONUSES` has no entries for any class. There is therefore no hidden eight-piece threshold buff to preserve. Eight-piece "set" state is catalog/completion/visual grouping, while the mechanics above apply per item.

Neutral defaults must be explicit in the successor runtime: zero additive stats/HP, multiplier 1 for damage/recovery/healing/hazard/parry/beam/harvest modifiers, false/empty for conditional hooks, then apply the selected character's spread and one quirk. Leaving fields `undefined` and relying on scattered `??` expressions would make this migration much harder to audit.

## Disposition table

| System or data | Disposition | What breaks if removed early | Planned fix / release gate |
|---|---|---|---|
| 113 `GEAR_CATALOG` rows, eight slots, net codes, art keys, face receivers | **Delete** | Account sanitization, join resolution, wire encode/decode, wardrobe UI, portal, generator, and tests import the closed catalog. | Keep through compatibility; remove only after V4 migration, server readers, client fallback, generator, and portal routes no longer import it. |
| 12 eight-piece visual sets and set completion | **Delete** | Wardrobe filtering, completion copy, missing-slot UI, preview fallback, and prestige hat-stack language fail. | Remove those surfaces with the Wardrobe tab. Do not replace them with an invisible set system. |
| `spreadMoves`, gear `stats`, quirk refs, and 23 scalar-mod rows | **Delete as gear mechanics** | `snapshotGearRun` currently supplies all base stats and many combat fields; immediate removal can yield wrong HP/damage/cadence or missing hooks. | Add character-owned `IdentityRuntime`, default every modifier, seed it from current character kit, then switch new rooms before deleting the resolver. |
| Three paid Power/Fortune/Vitality tracks encoded as nine gear ids | **Re-home** | Deleting `ownedGear` loses purchased ranks and changes Scrip value; retaining the rows retains wardrobe coupling. | In V5 infer the highest id owned in each grant family, store rank independently, preserve cost/effect until the stat panel changes it, then drop all nine ids. |
| `GEAR_CLASS_BONUSES` | **Delete** | Nothing at runtime; it is empty. Misreading it as active could create unnecessary compensation work. | Remove with `gear.ts`; document that no eight-piece threshold effect existed. |
| Three-weapon `weaponSetBonus` / weapon class counts | **Keep** | A name-based cleanup would damage arsenal damage/cadence behavior. | Leave weapon resolver, state, tests, and UI untouched; rename later only if confusion warrants it. |
| 40 live character spreads and quirk ids | **Keep 32 unchanged; retire 8 without transfer** | Removing every kit with gear leaves no identity source; silently merging cut mechanics would change retained balance. | Character-v2 seeds only the Chars-1 32. Keep the eight legacy kits readable in gear-v1 compatibility, apply cosmetic fallback ids at the character-v2 boundary, then remove cut kits after old mode drains. |
| Character concept data | **Keep as prompt input** | Treating all 50 concepts as live would accidentally add 11 unapproved characters; treating all 40 promoted concepts as new production would ignore Chars-1's eight cuts. | Chars-1 supplies the canonical 32 mapping; Chars-2 supplies 32 face-law rows. Keep the 11 unpromoted and eight cut concepts out of the generation queue. |
| Torso/head pairing catalog (task #64), `legacySetId`, socket-frame replacement contract, face riders, hat tower, texture baking | **Delete** | Sprite assembly, preview, fallback, and generated-manifest imports fail if assets/catalog disappear first. | Land character manifest/head renderer first; then remove pair-specific code and assets in one cleanup wave. |
| Floating-head spring and pose sync in `SpriteRig` | **Keep and re-home** | Deleting pair code indiscriminately loses the owner-approved bob, remote parity, reduced motion, tint, and LOD behavior. | Make it consume character `head`, `headSocket`, and scale. Move the current 0.85 default out of `gear-parts.ts`; allow per-character authored scale if Chars-3 requires it. |
| Body combo, hand placement, dodge roll/tumble | **Keep** | Replacing the whole rig would regress shipped animation. | Preserve body animation ordering; apply head pose only after the final weapon/combo body transform, as Chars-3 specifies. |
| `GameRoom.gearRuns`, `snapshotGearRun`, gear join precedence, `gearSeeded`, `gearMaxHpAdd` | **Replace, then delete** | Join currently forces a geared player to Drifter and progression branches on the flags. Removing one side creates mismatched HP/stats/ultimate ballots. | Add a versioned character snapshot path, move progression to identity-neutral fields, shadow/fixture compare, switch new rooms, then delete gear branches. |
| Damage/crit/heal/regen/hazard/parry/beam/harvest readers | **Keep behavior, remove gear inputs** | Undefined or stale mod values can change combat or produce NaN/zero multipliers. | Centralize neutral `IdentityRuntime` construction and retain focused tests for every active consumer while deleting wardrobe-specific expected values. |
| Drive resource bar and Ultimate Charge (task #63) | **Keep, isolate from migration** | Gear recovery/draw/beam modifiers affect combat feel around Drive, but Drive authority is player-global; resetting or re-deriving it during identity changes would break the shipped bar. | Preserve `weaponResource`, Drive debt/regen/state, HUD, Ultimate, and weapon resource formula. Gear modifiers fall to neutral defaults; character selection is pre-run and never resets live Drive. |
| V4 account (`ownedGear`, `equippedGear` plus Scrip/pets/prestige/bank) | **Migrate to V5** | Catalog deletion can make sanitization reject the blob and indirectly wipe unrelated progress. | Read V2/V3/V4, recover upgrade ranks first, add `selectedCharacterId`, preserve every non-gear field, stop writing gear, and test idempotence. Never reset an account because gear is malformed. |
| `gearUpper`/`gearLower` Colyseus fields | **Tombstone, then delete in a later schema** | Removing/reordering decorated fields while mixed clients exist can corrupt schema interpretation and remote visuals. | New clients ignore empty strings and render `player.character`; server emits legacy strings only for old identity mode. Retain field positions for at least the compatibility release. |
| Wardrobe tab, preview, presets, ownership/equip flows | **Delete** | Menu currently defaults there; removing it without replacement leaves no character choice and can orphan input/audio lifecycle. | Add Characters tab/select flow first, make it the default, stop preset/account writes, then remove wardrobe modules and `dd.wardrobe.presets.v1` handling. |
| Weapon Armory and weapon bank | **Keep** | "Armory" is independent of gear, but shares menu/account space. Broad deletion would remove carry/bank/extraction progression. | Preserve `ui/armory`, carry selection, settlement, and `weaponBank`; include them in every account migration fixture. |
| Prestige ceremony/world tier/bank-at-stake code in wardrobe model | **Re-home** | Deleting the wardrobe model can silently delete prestige confirmation, receipts, or weapon-bank wipe semantics. | Move to `ui/prestige` or Run/Armory before wardrobe deletion. Keep World Tier and bank consequences; retire wardrobe hat reward/copy unless another track explicitly replaces it. |
| Current C-key character/customization behavior | **Replace** | It is mostly cosmetic outside training and not durable account selection; using it as-is can desync visuals and run stats or cycle into one of eight unproduced cuts. | Persist `selectedCharacterId`, validate against the retained 32, alias stale cut ids, send it at join, and freeze identity for the run. Disable production mid-run kit switching. |
| Remote gear decoding and gear-first rendering in `ArenaScene`/`SpriteRig` | **Replace, then delete** | Old/new clients can render different bodies or force Drifter when gear strings exist. | Prefer versioned character rendering, keep gear fallback only for legacy rooms/clients, then remove `remote-gear.ts` and gear-first branches after the support window. |
| Gear generator, manifest, loose gear sprites, asset tests | **Delete last** | Direct JSON imports and texture bake validation can fail build/black-screen before gameplay code is reached. | Remove imports/code first; delete generated manifest/assets/generator together only after character head manifests and atlases pass. |
| Dev portal Gear category, `?dev=gear:` links, and 40-character row | **Delete/regenerate** | Generated HTML and `MenuScene` dev-link tests pin 113 gear rows; stale links enter removed UI; cut character links can request unproduced art. | Remove gear generator category/deeplinks, filter characters to the retained 32, rename "Legacy Characters" to the approved roster label, and regenerate portal output in final cleanup. |
| Exact-count and completeness tests | **Rewrite/delete at final census** | Old 113/96/eight-slot expectations fail; a runtime count throw can prevent server boot. | Replace wardrobe tests with character head/body/bob/remote/persistence laws. Keep transitional count checks offline/test-only and update all generated counts atomically. |

The concrete test cleanup map is:

- Delete wardrobe-only expectations in `ui/wardrobe/{model,layout,preview}.test.ts`, `sprites/gear-parts.test.ts`, `sprites/gear-parts.completeness.test.ts`, and `sprites/gear-texture-baker.test.ts` only with their product modules.
- Rewrite `entities/SpriteRig.boilerplate.test.ts` from eight-slot assembly to character-owned body/head, socket, bob extremes, reduced motion, tint/LOD, and local/remote parity. Keep unrelated combo/hand/dodge rig suites.
- Replace `ui/remote-gear.test.ts` with character-id remote rendering and cut-id fallback coverage; remove `MenuScene.dev-links.test.ts` gear cases and add retained-32 character routes.
- Split wardrobe sections out of `server/src/rooms/progression.test.ts` and `GameRoom.test.ts`: retire 113/96/catalog/sanitization/gear-precedence/mod cases, but keep new V2/V3/V4 -> V5 rank/account preservation, selected-character snapshots, neutral-mod consumer coverage, Drive, bank, prestige, and schema tombstone laws.

## Successor account and runtime contract

The exact names may follow repository convention, but the ownership boundary should be this clear:

```ts
interface MetaAccountV5 {
  version: 5;
  revision: number;
  scrip: number;
  pets: /* unchanged V4 shape */;
  selectedPetId: /* unchanged */;
  slateTortoisePityMisses: number;
  prestige: /* unchanged */;
  weaponBank: /* unchanged */;
  selectedCharacterId: RetainedCharacterId;
  legacyMetaRanks: { vitality: 0 | 1 | 2 | 3; fortune: 0 | 1 | 2 | 3; power: 0 | 1 | 2 | 3 };
}
```

`ownedGear` and `equippedGear` do not survive in V5. Migration scans each `LEGACY_UPGRADE_GRANTS` family before the gear arrays are dropped and takes the maximum recognized rank. Invalid/duplicate gear ids are ignored; valid non-gear V4 fields are still retained. V2 can migrate directly from its numeric ranks, while V3/V4 infer ranks from the grant ids. Sanitizing V5 twice must produce the same result, and a V4 -> V5 -> save -> reload round trip must retain Scrip, pets, pity, prestige, revision, and every weapon-bank record.

For Phases 1-3, V5 is a derived candidate, not a destructive replacement for the only durable V4 blob. Keep V4 canonical while the gear-v1 rollback exists and derive character-v2 runtime/ranks in memory; a staged character choice can use a small versioned side key until Phase 4 folds it into V5. The other acceptable implementation is an explicit dual-written rollback envelope, but never attempt to reconstruct gear by down-migrating V5. Only Phase 4, after character-v2 has soaked, writes V5 as the sole canonical account.

At run start, a single character-owned runtime should replace gear precedence. It contains the character id, base spread, resolved quirk, and fully initialized neutral modifier row. Meta ranks are then applied at one explicit seam. It must not own Drive, weapon inventory/bank, Ultimate charge, or body presentation. Presentation reads the same validated character id but independently resolves body/head assets, preventing a missing texture from altering server stats.

For the public room schema, prefer the existing `player.character` identity for remote selection. Keep `dualWield.gearUpper` and `gearLower` in their current positions as empty compatibility tombstones until minimum-client support permits a schema release; do not reuse those indices for character data.

## Phased migration: playable at every step

| Phase | Change | What players can do safely | Exit/rollback gate |
|---|---|---|---|
| 0. Freeze and fixture | Introduce a named room/session mode such as `gear-v1` vs `character-v2`; capture V2/V3/V4 account fixtures, matching/mixed gear combat snapshots, upgrade purchases, Drive, prestige, bank, and remote cosmetics. Make no player-visible change. | Existing game remains exactly as shipped. | Baseline tests pass; flag defaults off. No catalog or asset deletion. |
| 1. Add the successor beside gear | Add V5 migration, retained-32 `selectedCharacterId`, the explicit eight-id alias table, independent legacy meta ranks, and character `IdentityRuntime` seeded from the retained kits. Old accounts still retain readable gear and all 40 legacy kits during this phase. | Old rooms use gear-v1. Internal/dev character-v2 rooms use the new stats path with old visuals as fallback. | Account round trips, cut-id fallback fixtures, and all active combat-consumer tests pass. Switching the flag off restores gear-v1 without rolling saves backward. |
| 2. Neutralize gear gameplay for new rooms | In character-v2 only, ignore equipped wardrobe when seeding stats/quirks/modifiers; use selected character plus recovered meta ranks. Continue emitting/reading wardrobe strings solely as a temporary visual fallback. | New rooms have intentional character-based balance; old-mode rooms stay unchanged. Scrip purchases/ranks, bank, pets, Drive bar, Ultimate, and progression remain functional. | Damage/HP/crit/cadence/heal/parry/beam/harvest/level-up fixtures contain no `undefined`/NaN and match the approved character baseline. Rollback is a new room in gear-v1, never a mid-run flip. |
| 3. Land whole characters alongside old rendering | Chars-4 supplies 32 per-character body/head assets and manifest records; Chars-3 points the existing spring at character `headSocket`; Chars-2 face-law QA passes. Add Characters menu/select and render character-v2 from `player.character`. Keep gear rendering only for gear-v1. | Players select a whole character before a run; head bobs; combos/hands/dodge survive. Legacy room replay/clients still have gear assets. | All 32 retained identities have body/head/atlas entries, concealed faces, no neck seam at gameplay scale, local/remote parity, reduced-motion behavior, and missing-asset fallback; all eight cut-id aliases are tested. |
| 4. Stop wardrobe writes and deprecate | Make V5 canonical, remove Wardrobe tab/equip/preset/dev interactions, and re-home prestige. Server still accepts V2/V3/V4 and ignores their wardrobe selection after migration. Gear wire fields remain tombstones. | Menu is Characters + Armory/Run; existing accounts retain non-gear progress and can play. | Production telemetry/soak shows no V5 migration resets, bank loss, or unknown character ids. Minimum client/room drain policy is recorded. |
| 5. Remove runtime pairing and gear dependencies | After old-mode rooms and supported clients have drained, remove gear-first Arena/SpriteRig branches, `remote-gear`, baker/assembly, gear server runtime/flags/resolver, and pair-specific generator contract. Keep the extracted bob and body rig. | Character-v2 is the only room path and remains fully playable. | Repository search finds no product import of gear catalog/manifest and no server read of gear modifiers. Isolated server/client boot and representative co-op run pass. |
| 6. Delete assets/catalog and update census last | Delete the 113 catalog rows, public gear art, generated gear manifest, obsolete generators, wardrobe tests, and gear portal route; regenerate portal/character manifests/atlases and update tests together. | Same character-only game, now without dead wardrobe payload. | `pnpm` generation/check/test/typecheck/build gates pass; isolated server boots. Exact-count assertions are offline tests, not module-import throws. Only after this gate may the old files disappear. |
| 7. Remove wire tombstones later | In a separately announced schema release, remove `gearUpper`/`gearLower` and any last compatibility parsing once the minimum client guarantee is real. | No visible change. | Mixed-version protocol tests prove safe rejection/upgrade. This is not coupled to art launch. |

Never flip an in-progress room from gear-v1 to character-v2: base stats, HP, cooldowns, quirk hooks, Drive context, and remote presentation are snapshot identity. Flags are captured at room creation. Each phase should be deployed and smoke-tested on isolated ports/processes; the live owner sessions on 5180/2567 are not a verification target and must not be stopped or replaced.

## Coordination with the stat-simplification panel

The wardrobe decision supersedes the gear-preservation portions of all three options, but not their character-stat analysis:

- **Option A (`design-option-a-conservative.md`)** can ship directly on this bridge: retain the five attributes and the 32 retained sum-10 spreads; leave cut kits only in gear-v1 compatibility until it drains. Its earlier work to update gear copy/effects is removed from scope because gear dies.
- **Option B (`design-option-b-consolidate.md`)** may later convert the 32 retained character spreads to Power/Vitality/Fortune and decide how the three paid ranks map. Do not spend time converting eight cut kits, the 12 torso `spreadMoves`, or six flat-stat rows as that option previously contemplated; those are deletion-only now.
- **Option C (`design-option-c-radical.md`)** may later resolve each character to Frame + Signature. Do not build a gear Frame resolver. Its middle-step hidden compatibility values can live inside character `IdentityRuntime` if selected.
- **Research (`design-research-legibility.md`)** remains relevant to choosing the final character contract and player-facing descriptions, not to rescuing wardrobe mechanics.

The sequencing decision is: establish character-only identity with the current five-stat kits first unless the owner has already selected B or C before Phase 1 implementation begins. Reserve the V5 rank field behind a small adapter so the chosen stat option can map it once, rather than forcing a V6 save immediately. Never combine a stat-model flip and wardrobe retirement in existing live rooms. Art pipeline work and bob extraction can run in parallel; final combat baselines for Phase 2 need the stat-panel contract or must explicitly use Option A as the temporary bridge.

## Cost and handoffs

This is a systems migration, not a file deletion. A planning estimate for one experienced implementation owner is **16-27 engineering days plus character-art generation/QA and at least two compatibility release windows**: 3-5 days for account/shared/server identity, 3-5 for menu/selection/prestige re-home, 4-7 for renderer/bob compatibility and remote presentation, 2-4 for tool/portal/asset cleanup, and 4-6 for migrations, regression fixtures, co-op soak, and release hardening. The selected stat redesign is additional work. Parallel ownership can shorten calendar time, but compatibility windows cannot be compressed into one unsafe deploy.

Required handoffs from the other four character tracks:

| Track | Required handoff to migration | This track owes back |
|---|---|---|
| **Chars-1 roster/identity** (`chars-1-roster.md`) | Its handoff is now concrete: 32 retained ids, eight cuts, and eight cosmetic fallback aliases. It must keep the 11 extra concept records out of scope unless the owner changes the roster. | V5 persistence/join contract, proof each retained id seeds its own legacy spread/quirk, and proof each cut id resolves to an alias without transferring the cut kit. |
| **Chars-2 face law** (`chars-2-facelaw.md`) | Binding concealed-face brief and gameplay-scale acceptance criteria for the retained 32, plus the rule that four face-exposing cuts can never use their old art as a temporary character-v2 fallback. | Renderer fallback must use an approved retained pair (Drifter if necessary), never expose an underlying face layer; pair-era eyes/mouth receivers are deleted. |
| **Chars-3 head rig** (`chars-3-headrig.md`) | Character head asset/socket/scale schema, ownership of the floating spring, pose order, reduced-motion and seam QA. | Clean deletion boundary: all mix-and-match/face/hat assembly dies; spring, atomic body/head commit, tint/LOD, and body animation ordering stay. |
| **Chars-4 art pipeline** (`chars-4-pipeline.md`) | Generated body/head files, manifest/atlas contract, missing-asset policy, and regenerated census procedure for all approved ids. | Exact point at which gear assets/generator imports may be deleted, plus portal/test cleanup list. |

The stat panel additionally owns the final shape and balance of character attributes, inert-quirk implementation policy, and final mapping of the three paid meta ranks. This migration owns only preservation and sequencing.

## Boot, save, and half-refactor hazards

- **Boot crash:** no current import-time 113-gear fatal guard was found; the exact 113/96 values live mainly in tests, generated portal output, and gear generation/completeness logic. That does not make deletion safe. A stale manifest import can fail the client/build, and introducing a transitional runtime count throw can stop the server at module load. Update/remove catalog, generator, portal, assets, and tests atomically in Phase 6; keep census enforcement in offline generation/test commands until the new final count is stable.
- **Save loss:** sanitization must be field-tolerant and migrate gear before dropping it. An unknown gear id is not permission to recreate an account. Golden fixtures must include malformed/duplicate gear, all three upgrade ranks, a nonempty weapon bank, prestige, pets, Scrip, and a nonzero revision.
- **Combat half-state:** do not remove `gearSeeded` without replacing every progression branch, and do not remove `GearRuntime` fields one at a time while server consumers still read them. Construct one complete neutral runtime and switch one versioned snapshot seam.
- **Client black screen:** do not delete loose sprites or the generated manifest while `gear-parts.ts` imports it. Character head roles and atlas frames must pass first.
- **Protocol mismatch:** do not reclaim `gearUpper`/`gearLower` schema positions. Empty tombstones are cheap; a mixed-client schema corruption is not.
- **Meta-game regression:** Wardrobe code currently shelters prestige and shares the account with bank/pets/Scrip. Move those functions and test them before deleting UI files. Drive/Ultimate/weapon set bonuses are out of the wardrobe deletion scope.

## Assumptions and owner questions

No question blocks this plan. Implementation can proceed with these explicit assumptions:

- The production baseline is Chars-1's current 32 retained / eight cut recommendation, already consumed by Chars-2 and Chars-4. If the owner overrides that roster, the alias table, V5 validator, asset census, and Phase 3 gate must change together; the 11 extra concepts are never silently promoted.
- All wardrobe visuals, ownership, completion, presets, and per-piece mechanics disappear without item-by-item refunds. The only recovered value is the already-paid Power/Fortune/Vitality rank.
- Current character spreads and quirk availability remain unchanged for the migration bridge; the stat panel may deliberately change them later.
- Character choice is pre-run and fixed for that run. Training-only cycling may remain a developer tool, but production cycling cannot change authoritative stats mid-run.
- Prestige keeps World Tier progression and the weapon-bank farewell/wipe contract. The wardrobe hat-stack reward and related copy retire; a replacement prestige cosmetic/reward requires a separate owner decision and is not invented here.
- Compatibility fields remain for at least one measured client release and until gear-v1 rooms are drained. The owner can choose the exact support duration without changing the architecture.
