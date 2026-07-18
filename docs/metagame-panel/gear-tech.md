# Gear overhaul — technical implementation plan

Role: TECH PLANNER, GEAR panel. Status: design only. Binding source: `docs/metagame-panel/DECISIONS.md`.
There are no sibling gear documents in `docs/metagame-panel/` at the time of this plan.

The target is one fixed `drifter` boilerplate rig wearing permanent account gear. Character selection,
unlocking, switching, stat identity, and runtime character skins retire. Pets remain as shipped. Weapons
remain a separate persistent-but-losable system. Gear uses the same cached scalar-modifier and rare
descriptor-hook pattern already used by character quirks and pet run snapshots; it does not introduce a
second effect engine.

## 1. Shipped baseline and non-negotiable invariants

- `packages/shared/src/characters.ts` currently contains 40 `CHARACTER_KITS`, each with a sum-10
  STR/DEX/INT/CON/LUK spread and one quirk id. `packages/shared/src/character-classes.ts` contains the
  closed `QUIRKS` table, scalar `QuirkMods`, and `onParrySuccess` / `onRollEnd` / `onKill` descriptor hooks.
- `GameRoom` resolves one quirk into `CombatState` and reads its scalar at the computation site. Rare hooks
  return descriptors that `GameRoom` interprets. Gear must feed these same seams; gear ids must never grow
  branches through the 20 Hz loop.
- `MetaAccountV2` is a locally trusted, versioned client blob. `sanitizeMetaAccountV2` drops unknown ids,
  clamps numeric progress, derives pet level from XP, validates the selected pet is owned, and sends a
  canonical owner-only replacement. This is data-shape safety, not anti-cheat. Gear keeps that authority
  posture exactly: a local user can claim ownership, but cannot inject arbitrary stats, functions, or
  effects because the server derives all numbers from its shared catalog.
- Pet P1 established the pure catalog/account shape and server run snapshot. Pet P2 established normalized
  part sockets, source pivots, planes, springs, lazy texture loading, and deterministic retained rigs.
  `pet-parts.ts` and `PetRig` are direct precedents, not code to subclass.
- `SpriteRig` renders a manifest-driven body plus detached hands and feet. `equipLoadout` mounts held or
  worn weapons on final hand transforms and rebuilds their local stack. Gear becomes additional retained
  parts on those same body/hand/foot transforms.
- `SCHEMA_VERSION` is 27 today. No gear number is reserved in this document. The schema wave reads the
  version actually committed at launch, appends after the fields physically present, and takes exactly the
  next available number once for all gear fields.
- Colyseus field order is append-only. Old decorated fields may become tombstones but may not be removed,
  reordered, or reused with an incompatible wire type.

## 2. Shared gear catalog

### 2.1 Closed ids, slots, and catalog rows

Add `packages/shared/src/gear.ts`, exported through `packages/shared/src/index.ts`. It is pure data in the
style of `pets.ts`; neither server nor client owns a duplicate catalog.

```ts
export const GEAR_SLOTS = [
  "hat", "glasses", "facialHair", "shirt",
  "gloves", "pants", "boots", "cloak",
] as const;

export const GEAR_CLASSES = ["bruiser", "duelist", "caster", "warden", "scoundrel"] as const;

export const GEAR_CATALOG = {
  "legacy-drifter-hat": {
    id: "legacy-drifter-hat",
    netCode: 1,
    name: "Drifter Hat",
    slot: "hat",
    gearClass: "bruiser",
    stats: {},
    quirkRef: "unwritten",
    artKey: "legacy-drifter-hat",
    legacySetId: "legacy-drifter",
  },
  // ...all rows are literal catalog data...
} as const satisfies Record<string, GearDef>;
```

`GearDef` contains only immutable identity and authored server truth:

- stable string `id` for accounts, UI, receipts, logs, and content references;
- stable positive `netCode` for compact room cosmetics; codes are append-only and never recycled;
- `slot`, display name, `gearClass`, rarity/drop metadata, and optional legacy-set provenance;
- `stats: Partial<Record<Attr, number>>` for authored attribute pips;
- optional `quirkRef: QuirkId`; v1 permits it only on `hat` rows, so exactly one equipped item can own the
  old signature-quirk budget;
- optional source-neutral scalar/class-bonus refs, never callbacks that mutate a room;
- `artKey`, which selects a client manifest row but carries no geometry in the shared gameplay catalog.

The module also exports `GEAR_IDS`, `GearId`, `GearSlot`, `GearClassId`, `isGearId`, `isGearSlot`,
`gearForNetCode`, `STARTER_GEAR_LOADOUT`, `GEAR_CATALOG_VERSION`, and pure loadout resolution helpers.
All lists and catalogs use `as const`; `satisfies` checks totality without widening literal ids.

### 2.2 Eight logical slots, six body socket groups

The binding wardrobe has eight independently equipped categories. They map to six normalized boilerplate
socket groups plus the rig's already-moving hand nodes.

| Equip slot | Render receiver | Parts per item | Legacy base-stat budget | Rule |
|---|---|---:|---:|---|
| `hat` | `head` | 1, exceptionally 2 | 0 | The only v1 quirk-bearing slot; owns the hat spring. |
| `glasses` | `face.eyes` | 1 | 0 | May coexist with facial hair and hats. |
| `facialHair` | `face.mouth` | 1 | 0 | Lower-face layer; the category may include masks/face wraps where literal hair is inappropriate. |
| `shirt` | `torso` | 1-2 | 1 pip | Torso front; a second near strap is allowed. |
| `gloves` | final `hand-l` and `hand-r` nodes | exactly 2 | 1 pip | Uses the worn-weapon mount precedent, not a static body socket. |
| `pants` | `legs` | 1 | 1 pip | Lower-body overlay on the body card. |
| `boots` | final `foot-l` and `foot-r` nodes | exactly 2 | 1 pip | Each boot follows its own procedural foot. |
| `cloak` | `back` | 1-2 | 1 pip | Far cloth behind the body; an optional near clasp may cross the torso. |

The boilerplate contributes the universal `{ str:1, dex:1, int:1, con:1, luk:1 }` floor. Each legacy
outfit contributes exactly five additional pips, one each from shirt, gloves, pants, boots, and cloak.
For the initial mechanical conversion, expand `oldSpread - universalFloor` in stable `ATTRS` order and put
those five pips into those five slots in the order above. Hats carry the old quirk; glasses and facial hair
are cosmetic/class pieces. Consequences:

- every complete legacy outfit exactly reproduces its former sum-10 spread and single quirk;
- every mixed legacy loadout still begins with exactly ten total attribute points and no attribute below 1;
- no player can stack several former quirks, because only one hat can be equipped;
- later progression gear may exceed the legacy budget only when its catalog row says so; that is visible
  authored power, not a client claim.

The final `GEAR_CATALOG` is explicit data. A one-shot scaffold may expand the migration table below, but
runtime code must not synthesize item definitions from character ids, and CI must check the committed
catalog rather than depend on ignored `tools/artkit/out` inputs.

### 2.3 Gear classes and effect aggregation

`CHARACTER_LINEAGE` becomes migration provenance and the five `GearClassId` values. Every legacy item
inherits its former character's class. `GEAR_CLASS_BONUSES` is another `as const` table keyed by class and
threshold; it refers to the same source-neutral scalar fields/effect descriptors as quirks. It contains no
`if (gearClass === ...)` behavior in `GameRoom`.

Resolve once at the join/run boundary into a server-private `GearRunRuntime`:

```ts
interface GearRunRuntime {
  catalogVersion: number;
  idsBySlot: Readonly<Record<GearSlot, GearId>>;
  baseStats: Readonly<Record<Attr, number>>;
  classCounts: Readonly<Record<GearClassId, number>>;
  mods: Readonly<RuntimeMods>;
  quirk: QuirkDef;
  hookSources: readonly RuntimeHookSource[];
}
```

Composition law is deterministic and shared with pets:

- sum additive stat/capacity values, multiply multipliers, OR boolean rules, choose the minimum authored
  incoming-hit cap, then apply the computation site's clamp/round once;
- class thresholds are resolved once from the eight validated ids, not recounted at 20 Hz;
- the one hat quirk remains a direct cached definition; rare class hooks are a small cached source list;
- descriptors retain `sourceKind`, source id, and cap key so two effects cannot accidentally share a
  per-second ledger;
- gear and pet stacking is legal. Additions combine, multipliers multiply, and the shared site clamps once.

### 2.4 Mechanical migration of all 40 kits

Each row below expands to eight ids named `<new set prefix>-<slot>`. Its spread is split by the rule in
section 2.2, its quirk moves to the hat, and all eight items receive the listed class.

| Former character id | New set prefix | Class | STR/DEX/INT/CON/LUK | Hat quirk |
|---|---|---|---|---|
| `drifter` | `legacy-drifter` | bruiser | 2/2/2/2/2 | `unwritten` |
| `cc-asha-the-ash-walker` | `legacy-asha-the-ash-walker` | bruiser | 2/2/2/3/1 | `mend-the-broken` |
| `cc-bastion-vance` | `legacy-bastion-vance` | warden | 3/1/1/4/1 | `planted` |
| `cc-brother-cassian-the-ashen-crusader` | `legacy-brother-cassian` | warden | 3/1/1/4/1 | `habit-and-prayer` |
| `cc-brother-tendo-of-the-still-bell` | `legacy-brother-tendo` | warden | 3/2/1/3/1 | `one-perfect-strike` |
| `cc-bryda-houndcall` | `legacy-bryda-houndcall` | bruiser | 3/3/1/2/1 | `the-pack-finds-you` |
| `cc-buzzard-jeptha-hale` | `legacy-buzzard` | scoundrel | 3/2/1/2/2 | `overstuffed-bandoliers` |
| `cc-cinderpyre` | `legacy-cinderpyre` | caster | 2/1/4/2/1 | `molten-core` |
| `cc-cogwarden` | `legacy-cogwarden` | warden | 3/1/1/4/1 | `does-not-stop` |
| `cc-cordell-coldsnap-vane` | `legacy-cordell-coldsnap-vane` | scoundrel | 1/3/1/2/3 | `coldsnap` |
| `cc-corvane-the-crimson-draught` | `legacy-corvane` | caster | 1/1/4/3/1 | `the-crimson-draught` |
| `cc-crowmantle-sel` | `legacy-crowmantle-sel` | duelist | 1/3/1/1/4 | `a-better-owner` |
| `cc-dame-veyra-of-the-thornwatch` | `legacy-dame-veyra` | duelist | 2/4/1/2/1 | `insufferably-graceful` |
| `cc-deepfall-korr` | `legacy-deepfall-korr` | bruiser | 3/1/2/3/1 | `mag-boots` |
| `cc-doctor-phineas-quill-esq` | `legacy-doctor-phineas-quill` | caster | 1/2/3/1/3 | `snake-oil` |
| `cc-dunkel-the-coinblade` | `legacy-dunkel` | scoundrel | 2/2/1/2/3 | `hazard-rates` |
| `cc-elias-parson-thorne` | `legacy-elias-parson-thorne` | scoundrel | 2/2/2/1/3 | `graveside-manner` |
| `cc-gravewake` | `legacy-gravewake` | caster | 2/1/2/3/2 | `already-dead` |
| `cc-grix-boltcaster` | `legacy-grix-boltcaster` | scoundrel | 3/1/1/3/2 | `braced` |
| `cc-halcyon-7` | `legacy-halcyon-7` | warden | 1/3/2/2/2 | `half-projection` |
| `cc-hollowmaw` | `legacy-hollowmaw` | bruiser | 2/1/4/2/1 | `whispered-rites` |
| `cc-iridia-of-the-nine-veils` | `legacy-iridia` | caster | 1/2/4/1/2 | `sees-every-future` |
| `cc-kuro-oni-the-demon-mask` | `legacy-kuro-oni` | duelist | 3/2/1/3/1 | `temple-wall` |
| `cc-magdalene-the-ledger-crowe` | `legacy-magdalene-ledger-crowe` | scoundrel | 2/3/1/2/2 | `posted` |
| `cc-mawkin-sourgrin-the-hex-witch` | `legacy-mawkin-sourgrin` | caster | 1/1/4/2/2 | `bottled-spite` |
| `cc-mei-ling-of-the-jade-ribbon` | `legacy-mei-ling` | duelist | 1/4/2/1/2 | `ribbon-step` |
| `cc-mirelurk-caine` | `legacy-mirelurk-caine` | bruiser | 3/2/1/3/1 | `bog-patience` |
| `cc-neon-mirage` | `legacy-neon-mirage` | duelist | 1/4/1/2/2 | `package-deal` |
| `cc-pyra-cinderhowl-the-flame-caster` | `legacy-pyra-cinderhowl` | caster | 2/2/4/1/1 | `let-it-out` |
| `cc-quickfinger-odette-lacroix` | `legacy-quickfinger-odette` | scoundrel | 1/2/1/2/4 | `the-house` |
| `cc-raijin-k-the-storm-fist` | `legacy-raijin-ko` | bruiser | 4/2/1/2/1 | `thunder-behind` |
| `cc-s-jiro-the-wayward-blade` | `legacy-sojiro` | duelist | 3/4/1/1/1 | `iai` |
| `cc-sable-cipher` | `legacy-sable-cipher` | scoundrel | 1/4/2/1/2 | `ice-breaker` |
| `cc-sir-galloway-the-unbending` | `legacy-sir-galloway` | warden | 2/1/1/4/2 | `the-unbending` |
| `cc-sir-mordrane-the-hollow-oath` | `legacy-sir-mordrane` | warden | 3/1/2/3/1 | `hollow-oath` |
| `cc-the-bandida-la-sombra` | `legacy-bandida-la-sombra` | scoundrel | 2/3/1/1/3 | `a-shape-in-the-dust` |
| `cc-the-hollow-mask` | `legacy-the-hollow-mask` | duelist | 1/4/1/1/3 | `porcelain` |
| `cc-thornroot` | `legacy-thornroot` | bruiser | 2/1/2/4/1 | `regrow` |
| `cc-tinker-magnus-brasswick` | `legacy-tinker-magnus` | caster | 1/2/4/2/1 | `pressurized` |
| `cc-yuki-the-hollow-smile` | `legacy-yuki` | duelist | 2/4/1/1/2 | `fox-dance` |

The quirk's current `active` / `partial` / `inert` status migrates unchanged. Moving an inert quirk onto a
hat does not invent its missing subsystem. Wardrobe cards must disclose the same availability state until
the named seam actually ships.

## 3. Account v3 and sanitization

### 3.1 Shape and local persistence

Replace the v2 cache with a v3 record. Preserve pet fields and Scrip; fold old upgrade ownership into
normal gear grants and remove live upgrade levels from the v3 shape.

```ts
interface MetaAccountV3 {
  version: 3;
  revision: number;
  scrip: number;
  pets: Partial<Record<PetId, PersistedPet>>;
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number;
  ownedGear: GearId[];
  equippedGear: Record<GearSlot, GearId>;
}
```

Ownership is an id set serialized as a deduplicated array; there is no per-item client-authored stat row.
The loadout is a readable slot-keyed record in the account blob. The two compact positional strings are a
room-wire concern only and never become the persistence format.

Use `dd.metaAccount.v3`. Client load, save, wardrobe selection, and every server owner response pass through
the same shared sanitizer. Storage exceptions remain non-fatal. Leave `dd.metaAccount.v2`,
`dd.beltScrip`, and `dd.beltUpgrades` intact for rollback, but stop writing the two legacy belt keys after a
successful v3 migration.

### 3.2 Sanitization table

| Input | Canonical v3 behavior |
|---|---|
| Non-object, array, missing/unknown version | Fresh v3 starter account. Do not partially interpret a future version. |
| Valid v2 record | Run the explicit v2-to-v3 migrator, preserving sanitized Scrip, pets, selected owned pet, pity, and revision before applying gear grants. The server repeats this migration defensively. |
| `revision` | Finite integer clamped to `0..0xffffffff`. |
| `scrip` | Finite integer clamped to `0..65535`. |
| `pets` / `selectedPetId` / pity | Same pet-v2 rules: known object rows only, Bond XP clamped, starter pet restored, selection must be empty or owned, pity `0..7`. |
| `ownedGear` not an array | Replace with starter ownership. |
| Each `ownedGear` member | Accept strings for which `isGearId` is true; drop unknown/non-string ids; deduplicate in catalog order; cap at `GEAR_IDS.length`. |
| Starter gear | All eight starter ids are restored even if the cache is partially corrupt. |
| `equippedGear` not an object | Use the full starter loadout. |
| Each equipped slot | Iterate `GEAR_SLOTS`, never input keys. The id must exist, be present in sanitized ownership, and have `GEAR_CATALOG[id].slot === slot`; otherwise use that slot's starter id. |
| Duplicate equipped id | Reject the later slot. The catalog normally prevents cross-slot reuse, but the sanitizer does not assume it. |
| Claimed stats, mods, class counts, quirk ids, net codes, art keys, catalog version, or extra keys | Drop unconditionally. The server derives all of them from its own catalog. |
| Old `upgrades` in v2 | Read once only through `LEGACY_UPGRADE_GRANTS`; v3 never stores or applies invisible upgrade levels. |

The default migration policy in this plan is: a pre-v3 account is grandfathered the 40 shipped legacy
outfits because all 40 characters were already available, while a genuinely fresh v3 account starts with
the Drifter outfit. `LEGACY_UPGRADE_GRANTS` maps each old Vitality/Fortune/Power level to ownership of
ordinary catalog gear. Those grants do not remain as invisible stacked stats. This policy needs the product
confirmation in section 11.

### 3.3 Canonical account mutations

Gear unlocks are server-session account mutations just like pet progression in the local-trust model:

1. server accepts the authored gear award/pickup outcome;
2. add a known id if not already owned, bump revision once, and send owner-only `metaAccount` plus a small
   `gearUnlockReceipt`;
3. client replaces its local cache with the sanitized canonical response;
4. the new gear is selectable next run; it never mutates the active `GearRunRuntime`.

No exact ownership list, class count, stats, or quirk strength belongs in `PlayerState`. If clothes must be
visible as world drops, give them a dedicated bounded descriptor in the later loot wave; do not overload
weapon-specific `PickupState.weaponPublic`, rarity/affix, bag, or death-loss semantics.

## 4. Join-time authority and effect plumbing

### 4.1 Exact join/run snapshot flow

The wardrobe writes `equippedGear` inside the v3 account. `ArenaScene.connect` sends that complete account
blob; a second unversioned `selectedGear` join option is unnecessary.

1. `GameRoom.onJoin` calls `sanitizeMetaAccountV3` before constructing gameplay values. The returned account
   is the only account object retained in `metaAccounts`.
2. Iterate all eight slots, validate existence, ownership, and slot match again through the canonical
   resolver, then resolve `GearRunRuntime` from server catalog data. Never trust a client aggregate.
3. Snapshot the pet exactly as shipped. Cache gear and pet separately, then compose them only at named
   computation sites without allocating a merged object per tick.
4. Seed attributes from universal 1/1/1/1/1 plus the five validated legacy pips and any explicitly authored
   progression-gear stats. Derive max HP after gear is known. Initialize weapon capacity/reload ledgers only
   after both pet and gear runtimes exist.
5. Cache the hat quirk, resolved class thresholds, scalar mods, and rare hook sources in `CombatState` or a
   `gearRuns` map keyed by player id. Record `GEAR_CATALOG_VERSION` on the private snapshot.
6. Encode only the validated ids into the two public cosmetic strings in section 5, add the player, and send
   the canonical owner-only v3 account.
7. Death, revive, rift descent, level-up, weapon swap, C key, and account receipts do not reread the loadout.
   A fresh run in the same room reuses the account's canonical equipped ids. A returned-to-menu launch may
   carry a newly saved wardrobe. Testing Grounds may expose a dev-only validated preview message, but it
   must be visibly non-persistent unless it also performs the normal account mutation.

This replaces both `snapshotRunCharacter` and `applyMetaUpgrades`. There is one identity snapshot, not a
character spread followed by invisible permanent deltas.

### 4.2 Existing scalar and descriptor seams

| Runtime field/hook | Shipped authoritative site | Gear action |
|---|---|---|
| `ballastFollowsChoice` | `progression.applyAllocationChoice`; mirrored in `level-up-model.allocationPreview` | Replace `quirkForCharacter(runCharacter)` with the frozen gear runtime / decoded validated gear cosmetics. |
| `drawLockMult` | All three `WEAPON_DRAW_LOCK_SECONDS` assignments in `GameRoom` | Reuse; multiply gear and any other source, then assign once. |
| `parryIFrameMult` | `executeParry` and Vastaghar's parry-window calculation | Reuse both; one shared helper should prevent the two paths drifting. |
| `parryKnockbackMult` | `executeParry` area shove and `resolveParry` successful-parry shove | Reuse both. |
| `regenMult` | Living-player regeneration tick beside pet passive regen | Reuse; gear x pet x temporary pit multiplier, clamp once. |
| `beamVentMult` | Inactive beam cooling, normal recovery, and cancel recovery | Reuse all three sites. |
| `beamOverheatLockMult` | `finishBeam` overheat lock assignment | Reuse. |
| `incomingDamageCapFrac` | Central `damagePlayer` after typed hazard multiplier | Reuse. Strongest cap wins before HP/shield handling. |
| `parryChainNeverExpires` | Chain timer aging and reset-on-damage | Reuse both halves of the rule. |
| `critChanceAdd` | Declared today, but `weaponCritChance` currently returns only `critChanceFor(luk,dex)` | Add the missing server seam there and the matching client display helper; clamp to the shared crit cap once. Do not apply it to ultimate ranking or generic non-weapon rolls. |
| `harvestMult` | Declared today, but `completeExtraction` currently reads only squad LUK | Add the missing seam around the computed harvest rate/value, with one final authored cap and rounding. |
| `rollCooldownMult` | No shipped player-roll machine exists; `dodgedSeq` is only a cosmetic edge | Keep inert. Never connect it to enemy `dodgeState`, slide, dash, or jump. |
| `onParrySuccess` | Three shipped success paths call `applyParryQuirk`: normal melee, Vastaghar, and the additional parry path | Generalize the dispatcher name and invoke each cached gear/class source through the same descriptor interpreter. |
| `onKill` | `damageEnemy` final-blow branch via `applyKillQuirk` | Reuse with source attribution and existing per-second cap ledger. |
| `onRollEnd` / `reload-held-gun` | Declared but not invoked/interpreted | Remain inert until an authoritative player roll and qualified roll-end receipt ship. |

The existing `QuirkAvailability` contract remains useful. Rename the shared file to a source-neutral home
such as `runtime-effects.ts` or `gear-effects.ts`; keep `QUIRKS`, `QuirkDef`, contexts, and descriptors, but
delete character accessors after the migration.

### 4.3 New seams required by gear-class bonuses

The five former lineages can become gear-class set bonuses, but only through audited fields. Recommended
launch lanes and their plumbing are:

| Gear class lane | Existing reuse | New seam or guard |
|---|---|---|
| Bruiser: flat HP or weapon/melee power | Stat snapshot; central `heldDamageMult` already composes grade, requirement, loot, and weapon set | Add `maxHpAdd` to every max-HP re-derivation, including CON allocation. If class damage is approved, add one `outgoingWeaponDamageMult` in `heldDamageMult`; explicitly exclude ultimate damage and hostile/reflected sources. |
| Duelist: parry cadence/force | Parry iframe and knockback rows above | A parry-cooldown multiplier may apply only where `PARRY_COOLDOWN` is assigned. Roll bonuses remain inert until a real roll exists. |
| Caster: cast/beam economy | Beam vent/lock rows above | If cast cooldown is approved, create one `effectiveWeaponCooldown` helper used by held, paired, cast, gun, thrown, and stowed ledgers. Do not scatter another four assignments. |
| Warden: sustain/mitigation | Regen and central `damagePlayer` cap | Reuse. Any healing-received or hazard modifier composes at the pet-established `applyHeal` / typed `damagePlayer` seams. |
| Scoundrel: crit/harvest | `weaponCritChance` and extraction | Wire the two declared-but-missing seams above. Loot rarity remains squad LUK unless a separately authored owner trigger exists. |

Capacity and reload bonuses can reuse pet-established `effectiveMaxWeaponCharges` and reload/refill debt
seams. Any movement-speed, roll-distance, or other predicted motion bonus is out of v1: it requires a pure
loadout resolver on both client and server, prediction/replay inputs, and reconciliation tests. No gear
class may affect weapon-derived augment gates, `sigGateQueue`, threat, matchmaking, or pet selection.

## 5. Room schema for remote cosmetics

Append exactly two strings to the physical end of `PlayerState` in the schema wave:

```ts
@type("string") gearUpper = ""; // hat,glasses,facialHair,shirt,cloak
@type("string") gearLower = ""; // gloves,pants,boots
```

Each token is the catalog row's positive `netCode` encoded base-36; `0` means empty/fallback. Commas are
safe because codes contain only `[0-9a-z]`. The order is fixed by comments and shared encode/decode helpers.
Accounts continue to store stable string ids. Unknown codes decode to the starter/invisible part and never
become gameplay input.

Why two strings instead of `ArraySchema<string>` or eight schema fields:

- two fields keep schema surface small and allow upper/lower texture reconciliation independently;
- base-36 codes keep the current 320-row legacy expansion at one or two bytes per token, instead of syncing
  long character-derived slugs;
- arrays add index/collection patch overhead and mutable collection lifecycle for a loadout that is frozen.

Payload estimate at the initial 320-item catalog: at most 16 code characters plus six commas, approximately
22 UTF-8 payload bytes, plus two string lengths and field tags. Budget 32-40 bytes per player on join, or
roughly 0.3-0.4 KB for ten players. The fields remain unchanged during normal play, so steady-state cost is
effectively 0 B/s. A dev wardrobe change resends only the changed string.

`PlayerState.character`, `runCharacter`, `upVitality`, `upFortune`, and `upPower` retain their committed
wire slots and types but become deprecated constants (`"drifter"` or zero). They are not counted as gear
fields and no runtime behavior may read them.

At schema-wave launch, read the actual `SCHEMA_VERSION` (27 is merely the current committed landscape),
append both strings after every then-present field, bump once to the next available value, and add a field-
order fixture. Do not call the wave “schema 28” in branches or comments until the orchestrator assigns it.

## 6. Rendering and the art-program contract

### 6.1 Boilerplate rig and normalized socket frame

The runtime character sprite is always the installed `drifter` kit: body, hand-l/r, foot-l/r, shadow, and
procedural pose. The other 39 full-body rigs are references for gear extraction, not mix-and-match layers.
A whole old body image cannot be worn over the boilerplate because its anatomy, hand positions, body scale,
and painted occlusion differ.

Create a generated `gear-parts-manifest.json` and typed loader patterned after `pet-parts.ts`. Its contract:

```text
schemaVersion: 1
socketFrame.id: GEAR_SOCKET_FRAME_V1
source canvas: untrimmed 1024x1024 RGBA
receiver units: boilerplate body heights L, origin at the drifter body centroid
facing: semantic right; SpriteRig owns mirroring
```

Freeze these receiver ids before any batch art:

| Receiver | Proposed normalized rest point | Parent transform |
|---|---|---|
| `head` | `(0.00L, -0.38L)` | final body card |
| `face.eyes` | `(+0.08L, -0.29L)` | final body card |
| `face.mouth` | `(+0.11L, -0.20L)` | final body card |
| `torso` | `(0.00L, -0.04L)` | final body card |
| `legs` | `(0.00L, +0.29L)` | final body card |
| `back` | `(-0.12L, -0.04L)` | final body card |
| `hand-l`, `hand-r` | local `(0,0)` | each final procedural hand image |
| `foot-l`, `foot-r` | local `(0,0)` | each final procedural foot image |

The proposed points are a render-spec seed, not values to eyeball independently in every asset. The art
wave overlays them on the shipped Drifter, corrects them once if needed, then freezes the frame id. Each
manifest part records `slot`, `parent`, source pivot, normalized receiver anchor, rest angle, mount scale,
integer plane, optional spring preset, alpha bounds, and image dimensions—the same information that makes
pet assembly deterministic.

### 6.2 Art deliverables and validation

Each catalog item delivers only its wearable pixels:

- no baked boilerplate body, skin, hands, feet, shadow, held weapon, VFX, background, label, or portrait;
- untrimmed transparent master with the source pivot on opaque connector pixels; runtime may atlas it, but
  the manifest geometry remains source-space stable;
- gloves and boots are paired left/right files; cloaks may use far-cloth plus near-clasp; shirts may use a
  torso panel plus near strap; all other slots are normally one part;
- 8-12% of a connector may hide beneath its receiver to prevent seams, matching the pet collar discipline;
- connector tolerance is at most 4 source pixels and 2 degrees against `GEAR_SOCKET_FRAME_V1`;
- painted silhouette is tested at facing both ways, idle, full stride, jump apex/landing, crouch/slide,
  parry, close-blade attacks, two-handed grip, dual wield, worn gauntlets, orbit far/near, and downed pose;
- art may not use telegraph red, parry white, extraction instruction color, rarity halos, or combat rings as
  a large silhouette feature.

The generator validates exact canvas, RGBA alpha, known slot/socket/plane, unique item/part ids, paired-part
completeness, visible alpha bounds, connector occupancy, absence of extra files, manifest/catalog totality,
and an atlas frame for every promoted part. Missing art renders the boilerplate with that slot invisible;
it never exposes a raw texture key or removes the player's whole rig.

Legacy portraits in `packages/client/public/ui/portraits` become temporary wardrobe-set reference cards or
art QA references. They stop representing runtime character selection. The final wardrobe should preview a
live boilerplate composite; the portrait generator is repurposed to gear/item cards or retired.

### 6.3 Z-order law

The rig must use named plane anchors and one `rebuildRenderStack()` instead of allowing gear and weapons to
race with `bringToTop` calls. Back-to-front law:

1. existing shadow and slide echoes;
2. cloak far cloth;
3. base feet, then each boot directly over its foot;
4. far held weapon when an orbit/signature says “behind body”;
5. back hand, back glove, then a worn back-hand weapon if present;
6. boilerplate body;
7. pants, shirt, optional cloak clasp;
8. facial hair, glasses, hat;
9. a normal held weapon below its owning front hand;
10. front hand, front glove, then a worn front-hand weapon;
11. protected source tells, pair glint, gameplay VFX anchors, and label.

Dynamic weapon depth switches target the named `behindBody` / `frontWeapon` sentinels, not `body` directly.
This preserves the current weapon rule: held art tucks under the hand; a worn gauntlet overlays the hand.
When cosmetic gloves and a worn weapon coexist, order is base hand -> glove -> worn weapon. A two-handed
weapon remains above the body and below both visible gripping hands/gloves.

### 6.4 SpriteRig extension

Extend rather than replace `SpriteRig`:

- constructor always builds the Drifter boilerplate and plane sentinels;
- `equipGearLoadout(validatedIds, manifest)` diffs retained `GearAttachment` rows by slot/part, creates or
  destroys only on a descriptor edge, and calls `rebuildRenderStack()` together with weapon equip;
- body-mounted gear copies the final body transform plus its normalized socket; gloves/boots copy the final
  hand/foot transform after all direct pose and spring writers; weapon mounts then use the same final hands;
- gear images join paper death/copy/tint/alpha/fold handling so the dressed silhouette does not leave naked
  attachments behind;
- no per-frame arrays, closures, Tweens, manifest searches, texture lookups, or object allocation. Cache all
  attachment rows and scalar spring state. Offscreen LOD skips attachment writes and rebases on wake;
- a gear string change updates attachments in place. It does not destroy/recreate `SpriteRig`, camera state,
  prediction history, pet ownership, or the player blob map.

This combines two shipped precedents: `pet-parts.ts` supplies normalized sockets/source pivots/planes and
spring metadata; `SpriteRig.equipLoadout` supplies hand attachment, worn-vs-held rules, retained lifetime,
and explicit z-stack reconstruction.

### 6.5 Hat jiggle spring

Every hat has one retained angular position/velocity pair. Default manifest preset:

```text
frequency 5.2 Hz; damping ratio 0.58; maximum 9 degrees; drag gain 0.70
```

Its equilibrium is the authored rest angle at `head`. Excitation comes from the already-conditioned rig
acceleration, hard-turn commit, landing impulse, and body rotation—not raw network position deltas. Integrate
with clamped frame time, reset energy on equip/teleport/LOD wake/paper fold, and let direct scripted death or
ultimate poses own the part when necessary. Reduced-motion mode sets drag/landing excitation to zero and
eases to rest; the hat remains attached and readable. No hat state is synchronized.

## 7. Character and META_UPGRADES retirement

### 7.1 Consumer-by-consumer migration

| Shipped consumer | Fate |
|---|---|
| `packages/shared/src/characters.ts`: `PLAYABLE_CHARACTERS`, `PlayableCharacter`, `DEFAULT_CHARACTER`, `CHARACTER_KITS`, names, `nextCharacter`, per-character scale | Delete as runtime APIs after the gear catalog lands. Keep one `BOILERPLATE_SPRITE_ID = "drifter"` in a render-appropriate shared/client constant. The 40 kit values move through section 2.4, not a second table. |
| `tools/artkit/gen-character-roster.mjs` | Retire character-roster generation. Repurpose its audited inputs/check mode for the gear catalog/manifest, or replace it with a gear-specific generator that never reads ignored `out/*/parts.json` to produce gameplay truth. |
| `packages/shared/src/character-classes.ts` | Rename to a source-neutral effects module. Keep `QUIRKS`, modifier/effect types, descriptors, and availability. Move lineage values to gear class data. Delete `isPlayableCharacter`, `lineageForCharacter`, `spreadForCharacter`, and `quirkForCharacter`. |
| `packages/shared/src/combat.ts` ultimate tie-break helpers | Accept the frozen run base-stat vector, not a character id. Delete the character import. |
| `PlayerState.character` and `runCharacter` | Keep as append-only wire tombstones set to `drifter`; stop reading or mutating them. Never reclaim their positions. |
| `GameRoom.snapshotRunCharacter`, `CombatState.identityCharacter`, character imports | Replace with the validated gear snapshot. `CombatState.quirk` is sourced from the equipped hat; class sources sit beside it. |
| `cycleCharacter` server message | Delete. There is no mid-run wardrobe mutation. Keep action-budget coverage for the messages that remain. |
| C key in `ArenaScene` | Stop sending `cycleCharacter`. In the pre-run menu it opens/focuses Wardrobe; in a live run it may open a read-only loadout panel or be unbound. Testing Grounds may use a separate explicit dev-preview action. |
| `ArenaScene.addBlob`, `charOf`, `syncBlobs` character rebuild | Always construct the Drifter rig, delete `charOf`, and reconcile gear strings into retained attachments. A cosmetic change no longer destroys the rig. |
| `characterScale` at rig setup and client/server beam muzzle reach | Replace with the one boilerplate render scale. Keep client/server muzzle math identical; remove comments promising per-character scale. |
| Level-up preview and server allocation | Read the frozen gear rule; maintain client/server ballast parity. |
| Menu/select screen | The shipped `MenuScene` has dimension selection and the pet folio but no completed character grid; the old character-select backlog is closed by a `WARDROBE` surface adjacent to `COMPANION`, with eight slots, owned/locked catalog, stats, class thresholds, quirk availability, and live composite preview. |
| Dev portal generator and committed `tools/portal/index.html` | Replace “Characters” and `?dev=char:<id>` with “Gear”, slot/class/stat/quirk chips, and `?dev=gear:<gearId>` or a full-set preset. Server validates ids and restricts mutation to Testing Grounds. |
| Character portraits and `gen-final-sprint.mjs` portrait batch | Re-source as temporary legacy-set references, then repurpose to gear cards or retire. HUD/player identity no longer selects a portrait. |
| `data/character-concepts.json`, `subjects.concepts.json`, installed `cc-*` sprites | Keep as art/provenance inputs during conversion. Once every legacy set passes composite QA, remove the 39 old playable rigs from runtime preload/atlas/manifest; archive source references outside runtime. Keep Drifter. |
| Character/progression/GameRoom tests and e2e deep links | Replace character totality/cycle/resnapshot assertions with catalog, v3 sanitizer, gear snapshot, dev gear, and no-mid-run-mutation assertions. |
| Backlog/spec/help text | Close character-select and character-unlock work; rewrite C-key, character class, “wear character,” and portrait language to Wardrobe/gear. |

### 7.2 Folding META_UPGRADES into gear

`META_UPGRADES`, `MetaUpgradeId`, `MetaUpgrade`, `MetaLevels`, `EMPTY_META`, `sanitizeMetaLevels`, and
`nextUpgradeCost` retire after the v2-to-v3 migrator. `META_VITALITY_HP`, `META_FORTUNE_LUK`, and
`META_POWER_STR` become authored values on the normal gear granted by `LEGACY_UPGRADE_GRANTS`, or retire if
the conversion catalog uses different balance.

Server/UI migration:

- delete `buyUpgrade`, `applyMetaUpgrades`, `syncAccountFromPlayer` upgrade writes, and the belt shop's three
  permanent-upgrade rows;
- replace the shop rows with gear acquisition/tailor rows only if the gear economy calls for Scrip purchases;
  run drops remain the primary binding source;
- keep decorated `upVitality`, `upFortune`, and `upPower` fields as zero tombstones;
- max HP and all attributes derive from the gear snapshot plus run allocations. No hidden v2 level is added
  afterward;
- the v2 migrator grants normal item ownership once, marks no separate upgrade entitlement, and is
  idempotent under repeated sanitize/load/save cycles.

This leaves the account sentence intact: gear is who you are, pets are who is with you, and weapons are
what you hold and can lose.

## 8. Ultimate and allocation guards

1. `allocRun` remains the only family/variant primary ranking input. Gear cannot add to it, reset it, or
   count an unlock as a level allocation.
2. Replace `ultimateRankingForAllocation(allocRun, runCharacter, raw)` and
   `ultimateVariantForAllocation(...)` with a frozen `baseStats` argument from `GearRunRuntime`. Ordering
   remains allocation totals -> frozen base-stat bias -> raw total -> `ATTRS` order.
3. A wardrobe change after returning to menu can affect the next run's tie-break. No active-run message,
   C-key action, account receipt, gear drop, rift descent, or cosmetic decode may rerank an already locked
   family/variant.
4. Gear base stats remain in raw attributes, so ultimate damage sees them exactly as it saw old character
   spreads. Gear scalar damage/crit/cooldown/class multipliers do not enter `ultimateDamageScale`, ultimate
   charge accrual, family selection, or tempering unless a later ultimate-specific design says so.
5. Server allocation reads the cached `ballastFollowsChoice`; client preview derives the same rule from the
   synced validated gear codes and shared catalog. Unknown/missing art never changes the rule.
6. Weapon-derived augment gates stay weapon-derived. Gear class, hat quirk, wardrobe slot, and cosmetics
   never alter `augmentGateForWeapon` or an already queued `sigGateQueue` entry.
7. Any future predicted movement bonus is blocked until it is a pure function of the synced gear descriptor
   on both ends and passes prediction/replay/reconciliation tests.

## 9. Implementation waves

| Wave | Scope | Exit gate |
|---|---|---|
| G0 — decisions/content freeze | Answer section 11; freeze slot order, single-hat quirk law, class thresholds, v2 grants, and unlock timing. | Catalog schema and migration policy signed off; no source lock. |
| G1 — data + account | Add `gear.ts`, effect-source types, 40-set migration data, starter loadout, net codes, `MetaAccountV3`, sanitizer, v2 migrator, local v3 store, and pure tests. Retire no runtime path yet. No schema bump. | All 40 set aggregates reproduce `CHARACTER_KITS`; sanitizer/adversarial fixtures green. |
| G2 — server effects | Add gear run snapshot, validated join flow, attribute seed, scalar/hook composition, class seams, account receipts, and META_UPGRADES retirement behind focused server tests. Continue writing old character fields as Drifter tombstones. | Forged effects ignored; join/restart/level/ultimate/resource matrices green. |
| G3 — wardrobe UI | Replace the unbuilt character-select direction with Wardrobe in `MenuScene`; owned/locked filters, eight slots, composite placeholder, stat/quirk/class preview, v3 join payload, canonical replacement handling, dev portal gear entries. | No unowned/wrong-slot equip path; launch/retry preserves canonical loadout. |
| G4 — rig rendering + schema | At launch take the then-next schema number, append the two strings once, add decode/field-order tests, gear manifest loader, `SpriteRig` attachments/stack/spring/LOD, and placeholder fixtures. | Two-client late join and pose/z-order render matrix green; no steady allocation or wire churn. |
| G5 — art program | Freeze `GEAR_SOCKET_FRAME_V1`; convert/redraw the 40 legacy outfits into item-only parts; validate/promote/atlas them in resumable batches; replace placeholders; then remove old runtime character rigs and repurpose portraits. | Catalog-manifest-atlas totality, all-set composite review, ten-player stress, and golden screenshots approved. |
| G6 — hardening/migration soak | Exercise v2/v3 rollback, corrupt local storage, duplicate unlocks, all pets x gear classes, all weapon mount modes, reduced motion, and production asset caching. | No data loss, schema mismatch, naked-pose regression, or hidden character/META_UPGRADES consumer remains. |

The art generator may prototype after the socket frame freezes, but bulk promotion follows the tested rig
contract. Do not generate hundreds of parts against guessed pivots and ask runtime code to compensate later.

## 10. Test strategy

### Shared catalog and account

- Exactly eight unique slots; unique string ids and positive append-only net codes; every code round-trips.
- Every catalog stat key is an `Attr`, every quirk ref exists, every art key is non-empty, every legacy item
  has the expected class/set, and only hats carry v1 quirks.
- For all 40 section-2.4 sets: universal floor plus five slot pips equals the former spread exactly; total is
  10; all attrs are at least 1; hat quirk matches; mixed legacy loadouts always add five pips.
- Fuzz unknown ids, wrong-slot owned ids, duplicate ids, prototype-like keys, huge arrays/numbers, NaN,
  arrays-as-records, missing starters, corrupt pets, and future versions through `sanitizeMetaAccountV3`.
- Golden v2 migrations at every 0-3 upgrade combination preserve pets/Scrip/pity, grant exactly the approved
  gear, are idempotent, and never reapply invisible stats.

### Server authority and effect seams

- A forged loadout containing real-but-unowned, wrong-slot, unknown, duplicate, or client-authored effect
  rows falls back canonically; server runtime and public cosmetics contain only validated catalog data.
- Join initialization order proves gear/pet capacity exists before weapon ledgers and that base stats/max HP
  are applied once on join and fresh-run restart, never on rift/death/revive.
- One focused test per row in section 4.2, including every duplicate parry/beam/draw-lock site. Pin the two
  newly live crit/harvest seams and the still-inert roll fields.
- Gear x pet matrices prove additive/multiplicative order, one final clamp, resource debt conservation,
  healing/hazard typing, and source-specific descriptor caps.
- Unlock receipts mutate ownership/revision once; duplicate/retry is idempotent; active effects stay frozen
  until the next run.

### Allocation and ultimate

- Server choice, timeout choice, and client preview choose identical ballast for every hat and all five attrs.
- Family and variant tie fixtures use frozen gear base stats, survive cosmetic/account changes mid-run, and
  still obey allocation -> base -> raw -> `ATTRS` ordering.
- Gear stats affect raw ultimate damage; gear scalar damage/crit/class bonuses do not affect family, variant,
  charge, or ultimate multiplier. Weapon signature gates remain byte-identical.

### Schema, client, and rendering

- Schema fixture pins all old field indices, the two new fields at the physical end, one version bump, late
  join decode, unknown-code fallback, and no normal-play gear patch after join.
- Wardrobe tests cover storage failure, v2 migration, owned/locked state, per-slot replacement, stat/class/
  quirk preview, launch freeze, retry, canonical server replacement, keyboard/focus, and gamepad access.
- Pure gear-manifest assembly tests mirror `pet-parts.test`: source pivot to normalized receiver, paired
  parts, bounds, scale, plane sort, missing texture fallback, and no mutation of manifest data.
- `SpriteRig` tests pin held vs worn weapons with gloves, two-handed and dual-wield stacks, orbit far/near,
  cloak/body/face order, facing flip, slide/jump/parry/downed/paper death, and loadout diff without rig rebuild.
- Hat spring traces cover impulse, dt clamp, maximum angle, settle, teleport/LOD reset, reduced motion, and
  deterministic no-allocation stepping.
- Render captures: all 40 complete sets plus adversarial mixed silhouettes at the key poses; four-player
  normal capture and ten-player stress. Offscreen rigs perform no child writes; steady visible rigs allocate
  no heap per frame.

### Retirement tripwires

After G5, CI grep/test fails on live uses of `CHARACTER_KITS`, `PLAYABLE_CHARACTERS`, `nextCharacter`,
`characterScale`, `quirkForCharacter`, `spreadForCharacter`, `cycleCharacter`, `?dev=char`,
`META_UPGRADES`, `buyUpgrade`, or non-tombstone reads of `character`, `runCharacter`, and `up*`. Generated
manifest checks also fail if a retired `cc-*` playable rig re-enters runtime or a catalog art row is absent.

## 11. Three implementation questions

1. **Loadout power law:** Approve the recommended one-hat/one-quirk rule, five fixed legacy stat-pip slots,
   and one gear-class threshold per loadout; if approved, what exact five class bonus effects and threshold
   count ship in G2?
2. **Existing-account migration:** Approve grandfathering all 40 shipped legacy outfits to any valid v2
   account, Drifter-only ownership for a fresh v3 account, and converting each old upgrade level into the
   corresponding normal item grants with no invisible bonus left behind?
3. **Clothing award boundary:** Does a run-dropped clothing item unlock permanently on accepted pickup, only
   on successful extraction, or on terminal settlement regardless of outcome; and what does a duplicate
   award become (nothing, Scrip, or another authored currency)?
