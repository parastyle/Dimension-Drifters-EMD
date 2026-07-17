# PSO2-MAG-style pets - technical implementation plan

Role: TECH IMPLEMENTER. Design only; this document authorizes no source change.

Target stack: Phaser 4 client, Colyseus 0.16 server, 20 Hz authoritative simulation with local-player
prediction, pnpm monorepo.

The live tree is on schema 21 while class-merge wave 21a is still settling. `PlayerState.runCharacter` and
the run identity snapshot exist, and the in-flight `character-classes.ts` already contains the beginning of
the quirk modifier/effect table described by `docs/classmerge-panel/tech.md`. Several declared modifier
keys are not consumed yet. Pet work must rebase on the finished 21a contract; it must not copy the in-flight
table into a second framework.

The implementation shape is:

> One pet is selected before readying and snapshotted for the whole run. Its gameplay effects are resolved
> by the server from canonical account progress. Its follower is a client-only, non-targetable cutout
> derived from the owner's existing rendered player pose. Pet motion sends zero position bytes and creates
> no server entity.

The systems specification supplies an exact eight-pet launch roster. The devil's-advocate review disputes
several of those effects, especially Verdant Wing combining regeneration with a flat charge capstone,
Copper Snail adding capacity, and Gilded Gecko minting Scrip. This plan maps the systems roster faithfully
to real code seams, but treats that content conflict as a P0 product/balance decision. No implementer should
quietly substitute a different effect after players have invested Bond XP.

---

## 1. Authority split and trust boundary

### 1.1 Ownership

| Concern | Authority | Contract |
|---|---|---|
| Pet ownership, Bond XP, exact level, acquisition pity, selected-pet preference | Authenticated account service | Canonical and durable. The client may request a selection, never assert earned progress. |
| Run pet id, exact run level, resolved modifiers, capstone state, per-run counters | `GameRoom` private runtime | Validated and snapshotted once. Rift descent, down/revive, reconnect, and inventory changes do not reread the account or change the snapshot. |
| Bonus outcomes: HP, revive, reload/refill debt, charge capacity, pickup eligibility, Scrip, pet XP | Server | Applied at the existing authoritative computation or transaction seam. |
| Public follower descriptor | `PlayerState.petId` plus `petLevelBand` | Two nearly static fields. Other clients do not receive exact XP or exact level. |
| Follower position, spring, stage cutout, jiggle, idle, palette and LOD | Each client | Cosmetic only. Self follows the predicted player render root; remotes follow their interpolated render roots. |
| Pet selection draft and account display cache | Owner client | A cache for menus. A canonical server record/revision always wins in production. |

The pet has no server x/y, velocity, health, collision, targetability, threat, pathfinding, pickup ownership,
or entry in `EnemyState`. It consumes neither `MAX_ENEMIES = 80` nor any projectile/zone cap. The room can
hold `MAX_PLAYERS = 10`, so follower lifecycle and performance tests must not assume the normal four-player
product target is a technical cap.

Gameplay bonuses suspend while the owner is downed. Static run structure remains attached: existing
magazine capacity, remaining charges, a thirteenth Copper Snail bag row, cooldown/reload debt, milestone
receipts, and once-per-run counters are not destroyed, clamped, refilled, or reset by down/revive. Event
hooks and passive ticking require an alive owner; already-established debt continues under the base rules.

### 1.2 What meta persistence does today

Today's permanent-upgrade path is a local MVP, not an authenticated account:

1. `ArenaScene` reads `dd.beltScrip` and `dd.beltUpgrades` from browser `localStorage`.
2. It sends join options containing `{ scrip, up }`.
3. `GameRoom.onJoin` clamps Scrip and passes upgrade claims through `sanitizeMetaLevels` /
   `META_UPGRADES`.
4. The room honors those claims only for belt mode when `devToolsEnabled()` is true. Production normally
   ignores the claimed account and starts from defaults.
5. Shop purchases are authoritative inside that room: proximity, identity, cost, balance, and level are
   checked server-side. The resulting synced values are then copied back into `localStorage` by the client.

Therefore:

- Production does not currently trust client meta; it mostly declines to load it.
- Local/dev persistence does trust a bounded client claim.
- Clamping unknown ids, XP, or levels prevents malformed state and overflow. It does not prove that a pet,
  level, or amount of Scrip was earned.
- Adding `sanitizePets` alone would preserve today's cheat boundary, not improve it.

Production posture for pets:

1. `onAuth` or equivalent resolves a stable `accountId`.
2. A server-owned `MetaAccountStore` loads the canonical record and revision.
3. Join options contain only the requested `selectedPetId`. The server verifies that the catalog id is
   owned, reads Bond XP from the account, derives level/band, snapshots the definition version, and ignores
   any client-authored level or XP.
4. Account mutations use atomic, revisioned, idempotent transactions. The room sends the owner a canonical
   snapshot/receipt after join, purchase, and result settlement.
5. `localStorage` becomes a fast display cache. It cannot authorize combat power or economy changes.

A signed account snapshot is an acceptable alternative to a direct store read only if the server validates
signature, account id, expiry, nonce/revision, catalog ids, XP bounds, and ownership. Browser JSON signed by
the browser is still a client claim.

Local development may send a versioned pet account payload behind `devToolsEnabled()`. The room sanitizes it
again and labels the session as local/trusted-for-testing. If pets ship publicly before authenticated
storage exists, the honest choices are to disable gameplay bonuses or label the build as offline/local
client-trusted progression; the server must not pretend that a clamped level is secure.

### 1.3 Which bonuses require server spatial behavior

The follower can remain cosmetic whenever gameplay is calculated from the authoritative owner and existing
room objects:

| Bonus class | Server work and wire cost |
|---|---|
| Owner scalar/capacity: regen, healing received, reload/refill, max charges, bag admission | One cached modifier read at an existing event/tick site. No pet position state. Ordinary HP/ammo/inventory diffs already sync. |
| Owner-centred reach: XP Echo or weapon pickup radius, revive reach | Existing server distance checks use the player's x/y. XP Echoes are capped at 48 and already use `xpMoteReach` / nearest-collector logic. No follower row is needed. |
| Existing-object latch: Lodestar's boundary sweep | The server selects existing Echo rows and writes their existing collector/flight fields. Cost is bounded by the Echo cap at a rare transition. |
| Owner-centred aura | Server player-to-player range queries, normally bounded by ten players. The fiction and tooltip must say owner-centred; the unsynced pet cannot be its origin. No launch pet needs an aura. |
| Pickup magnet motion | Server must choose/latch a target. XP Echoes already have a cheap immutable flight descriptor. Moving weapon pickups every tick would add hot x/y patches, target policy, and pickup-by-player scans; reject for v1. |
| Pet-centred collection, attack, blocking, decoy, aggro, collision, projectile, zone or switch interaction | Requires an authoritative 20 Hz pet entity, lifecycle, interpolation, teleport epoch, spatial queries, AoI and a hard cap. This is a separate architecture and is out of scope. |
| Predicted locomotion changes | Must be reproduced by client prediction and server validation from the same exact modifier. A coarse public band is insufficient. V1 pets do not alter speed, roll, acceleration or collision. |
| XP, Scrip, drops, purchases or pity | Server reward/account transaction. No client calculation is authoritative. |

If a future design makes the rendered pet's location decide eligibility, that pet crosses the authority
line. Four hot `{x,y}` rows would be modest bandwidth in isolation, but attacks and collection immediately
add target/action state and server queries. Such a feature needs a separate schema/cap/performance proposal;
it must not be smuggled into `PetRig`.

---

## 2. State, persistence and protocol

### 2.1 Shared catalog and account blob

Add a closed, pure catalog in `packages/shared/src/pets.ts`:

```ts
type PetId =
  | "verdant-wing"
  | "hearth-newt"
  | "lodestar-moth"
  | "copper-snail"
  | "gilded-gecko"
  | "brass-crab"
  | "pale-firefly"
  | "slate-tortoise";

type PetStageBand = 1 | 2 | 3;

interface PetDef {
  id: PetId;
  name: string;
  budgetKey: string;
  maxLevel: 10;
  stages: readonly PetStageDef[];
  modsForLevel(level: number): PetMods;
  capstone?: PetCapstoneSpec;
}
```

The stage mapping is fixed:

| Band | Player-facing stage | Levels |
|---:|---|---:|
| 1 | Hatchling | 1-3 |
| 2 | Awakened | 4-7 |
| 3 | Ascendant | 8-10 |

The creature document's “Grown/Apex” working labels map to Awakened/Ascendant in code and UI; do not create
two stage vocabularies.

Extend permanent meta into one versioned account record:

```ts
interface PersistedPet {
  bondXp: number; // lifetime total; presence in the map means owned
}

interface MetaAccountV2 {
  version: 2;
  revision: number;
  scrip: number;
  upgrades: MetaLevels;
  pets: Partial<Record<PetId, PersistedPet>>;
  selectedPetId: PetId | "";
  slateTortoisePityMisses: number; // 0..7
}
```

Store XP, not a redundant mutable level or capstone flag. `petLevelForXp` derives the exact level from the
shared curve; `petStageBandForLevel` derives the public band. The sanitizer:

- reuses `sanitizeMetaLevels` for `META_UPGRADES`;
- drops unknown pet keys and non-object records;
- clamps/floors Bond XP to `0..3600`;
- clamps/floors Scrip to its account range and pity to `0..7`;
- clears an unowned selection, then applies the starter fallback policy;
- rejects unsupported future versions rather than partially interpreting them.

Verdant Wing is granted once on onboarding and selected for a new account. Migration from the current
local keys imports `dd.beltScrip` and `dd.beltUpgrades`, grants Verdant Wing at 0 XP, and writes one
versioned cache such as `dd.metaAccount.v2`. Leave legacy keys intact for rollback. Storage exceptions are
non-fatal.

The account stores only identity/progress. Numeric pet definitions remain server/catalog data. A room also
snapshots a `PET_CATALOG_VERSION` so a deployment cannot mutate an active run. Balance patches update the
catalog between runs; they do not fork stronger grandfathered online versions.

### 2.2 Room-synced state: two small fields

Append to the physical end of `PlayerState`, in this order:

```ts
@type("string") petId = "";
@type("uint8") petLevelBand = 0; // 0 none, 1 Hatchling, 2 Awakened, 3 Ascendant
```

This is the complete steady room descriptor for the follower. Exact level, XP and numeric strength remain
private to the server and owning account UI.

Wire cost is trivial, but not literally zero: the id is its short UTF-8 string plus Colyseus field overhead;
the band is one payload byte plus overhead. Both are written at join/run snapshot and remain unchanged
through the run. At ten players this is only a few hundred initial bytes and effectively 0 B/s steady-state.
Follower position itself is exactly 0 B/patch because every client reuses the already-rendered PlayerState
position.

Do not add `PetState`, `ArenaState.pets`, pet x/y/vx/vy, HP, animation phase, or an `EnemyState` row.

There are two sparse owner-only protocol exceptions, neither a 20 Hz schema field:

- canonical `metaAccount` / `petProgressReceipt` messages carry the owner's exact progression;
- Copper Snail needs correct client grab prompting even though earned provenance currently lives only in
  `GameRoom.earnedPickups`. Send Copper owners a bounded add/remove/snapshot of eligible pickup ids, or
  generalize that into a targeted pickup-eligibility receipt. Do not expose hidden weapon identity and do
  not add an always-replicated `PickupState.earned` field merely for one pet.

### 2.3 Private per-run state

Key gameplay state by stable account/player-run identity, not by the cosmetic rig:

```ts
interface PetRunRuntime {
  runId: string;
  accountId: string;
  petId: PetId;
  level: number;
  stageBand: PetStageBand;
  catalogVersion: number;
  mods: Readonly<PetMods>;
  pendingBondXp: number;
  paidDimensionMask: number;
  dimensionPresenceSeconds: number;
  acceptedActionsThisDimension: number;
  geckoFraction: number;
  geckoMinted: number;
  tortoisePitRegenSeconds: number;
}
```

The actual implementation can embed hot combat fields in `CombatState` and keep account/settlement fields
in a room map. The contract is more important than the container:

- snapshot once when the run becomes ready/active;
- retain it through rift descent;
- never reread a level after a feed/purchase/result during that run;
- retain pending milestone receipts across downing and a qualifying disconnect;
- remove or archive it only after one idempotent terminal settlement or explicit abandon;
- reconnect restores the room snapshot, not a newer account selection/level.

Current `onLeave` deletes `PlayerState` and `CombatState` immediately and has no account-level resume path.
If reconnect is a launch requirement, a pet-only patch cannot promise it: the room needs a general
account-to-run reservation/rebind mechanism. Until then, define disconnect as abandon or retain a detached
settlement record with a bounded reconnect window; never let reconnect create a second pet runtime.

### 2.4 Selection and messages

- MenuScene passes a requested `selectedPetId` with scene/join data. It is not a matchmaking filter.
- Authenticated join loads the account, validates ownership, derives level/band/mods, writes the two public
  fields, and returns the canonical owner snapshot.
- Local/dev join may additionally carry the sanitized v2 cache behind `devToolsEnabled()`.
- There is no `changePet` message in an active run. Character cycling, shop use, rift descent, death,
  revive and reconnect cannot change it.
- A result-earned level/evolution/capstone becomes active next run, when all combat/resource ledgers are
  initialized from scratch.

---

## 3. Bonus plumbing on the 21a hook table

### 3.1 One source-neutral modifier/effect contract

Reuse the wave-21a pattern:

1. Cache definitions at the identity boundary.
2. Read scalar modifiers only at the site already computing that quantity.
3. Invoke rare named hooks at authoritative event seams.
4. Return data descriptors; `GameRoom` interprets them through existing machinery.
5. Keep pet ids in the catalog/art registry, not in `if (petId === ...)` branches in `GameRoom`.

After 21a settles, export source-neutral `RuntimeMods`, `RuntimeEventContext` and `RuntimeEffect` shapes
from the final character-kit module. `QuirkDef` and `PetDef` expose compatible subsets. Keep
`combat.quirk` and `combat.pet` separate and combine at the computation site without allocating a merged
object:

- multiply multipliers, then apply the site's authored clamp once;
- add additive values, then clamp once;
- define ordering for capacity and rounding;
- call quirk and pet descriptor hooks separately and preserve source attribution/caps;
- add a new hook name only when no existing authoritative event represents the authored behavior.

`applyQuirkEffects`, `applyParryQuirk` and `applyKillQuirk` become a generalized effect interpreter/dispatcher.
Pets do not borrow a character's unique trigger. The launch taxonomy is limited to sustain and economy:

| Allowed specialty | Landing seam |
|---|---|
| Passive regeneration | Living-player regen tick |
| Explicit non-regen healing received | Central server heal helper |
| Revive reach / return HP | `tryRez` |
| Environmental recovery/hazard mitigation | Dimension transition and typed player-damage seam |
| Gun/thrown endurance | Per-holder weapon resource ledger |
| XP Echo collection | `xpMoteReach` and accepted boundary cleanup |
| Earned weapon pickup/carry | `grabWeapon` and bag admission |
| Legitimate shop sale receipts | `sellWeapon` plus account Scrip transaction |

V1 pets do not modify damage, crit, attack projectiles/targets, general cooldown/fire rate, movement, roll,
parry, rarity/drop chance, set counting, augments, ultimates, threat, or teammates. They create no aura,
zone, projectile, pickup or entity.

### 3.2 Exact launch roster and seams

| Pet | Levels 1-10 | Level-10 capstone | Authoritative seam |
|---|---|---|---|
| Verdant Wing | Passive HP regen x`(1 + 0.05L)` = x1.05..x1.50 | +1 maximum use in each gun magazine and thrown pool | Regen tick; per-holder effective max |
| Hearth Newt | Non-regen healing received x`(1 + 0.02L)` = x1.02..x1.20 | On accepted descent, heal 15% max HP | Central heal helper; `transitionDimension` |
| Lodestar Moth | XP Echo reach `180 + 18L` = 198..360 | Before accepted descent/extraction/victory cleanup, latch eligible live Echoes within 600 | `xpMoteReach`; `beginXpBoundary` |
| Copper Snail | Earned-weapon pickup radius `46 + 4L` = 50..86 | Bag admission cap 13 instead of 12 | `grabWeapon`; all bag-add paths |
| Gilded Gecko | Earned sale bonus `2L%`; fractional bucket; minted bonus cap `2L` per run | Minted cap becomes 30 instead of 20; rate remains 20% | `sellWeapon`; account Scrip session |
| Brass Crab | Gun reload/thrown refill duration x`(1 - 0.01L)` = x0.99..x0.90 | Stowed reload/refill debt advances at x1.25; cooldown debt remains x1 | Reload/refill assignment; stowed ledgers |
| Pale Firefly | Owner's revive-effect reach `96 + 6L` = 102..156 | Allies revived by owner return at 40% HP instead of 30% | `tryRez` |
| Slate Tortoise | Pit and authored neutral ground-hazard damage x`(1 - 0.015L)` = x0.985..x0.85 | After surviving a pit snap-back, passive regen x1.5 for 3 s; refresh, no stack | Typed `damagePlayer`; pit recovery; regen tick |

`L` is the exact server-derived run level. Capstones are fixed at level 10 and are absent below it.

The table is an implementation mapping, not final balance approval. Before P1 freezes the catalog, product
must resolve the reviewer's one-axis objection, the +1 capacity envelope on two-shell weapons, permanent
Scrip/capacity objections, and whether a pet may overlap the chosen character quirk's budget key. If the
answer changes a pet, change the shared definition before players can earn XP; do not patch a different
effect under the same tooltip later.

### 3.3 Healing and regeneration

There is one passive regen site today:

```ts
player.hp = Math.min(
  player.maxHp,
  player.hp + deriveStats({ con: derivedCon }).regen * dt,
);
```

Resolve Verdant Wing there:

```ts
regenPerSecond =
  derivedRegen
  * quirkRegenMultiplier
  * verdantRegenMultiplier
  * activeTortoisePitMultiplier;
```

The existing quirk `regenMult` is declared in 21a but not yet consumed; both sources must use this one site.
A quirk multiplier of zero remains zero regardless of pet order. The tick already ignores downed players.
The Tortoise timer decrements only in active run time and applies only while alive.

Verdant does not scale Second Wind, parry-chain heals, projectile-parry heal, `heal-self` /
`heal-nearest-ally` descriptors, revive HP, Vitality headroom, boss-rush intermission healing, or Hearth's
descent capstone. Those are not passive regen.

Hearth requires a source-neutral helper such as:

```ts
applyHeal(target, rawAmount, {
  kind: "event" | "intermission" | "descent" | "revive" | "meta-headroom",
  sourcePlayerId,
  applyReceivedMultiplier,
});
```

Replace direct HP additions at the descriptor interpreter, Second Wind, melee/ranged parry heals,
boss-rush recovery and other explicit healing paths. The multiplier belongs to the receiver's pet, not the
healer's. Passive regen remains outside the helper. `meta-headroom` and `revive` use their dedicated rules.
The level-10 descent capstone is a final 15% max-HP receipt and does not multiply itself through Hearth's
ordinary scalar; this keeps “15%” true. If design wants 18% at level 10, that wording/order must be changed
before catalog freeze.

### 3.4 Verdant Wing charge capstone and the real debt ledger

The only safe reading of “an extra charge per weapon use” for the specified roster is:

> At level 10, each gun magazine and thrown-weapon charge pool has one additional accepted trigger
> pull/throw before its normal reload/refill. It is not a refund after every use, a duplicated projectile,
> or a resource for melee/cast/beam weapons.

The real resource state is split between:

- active `PlayerState.charges/maxCharges`;
- arena `CombatState.weaponLedger` rows containing `{ cooldown, reload, charges }`;
- belt `ArsenalSlot` private resource fields for held/stowed arsenal and bag weapons.

Replace `maxWeaponCharges(weaponId)` with one pure per-holder source,
`effectiveMaxWeaponCharges(weaponId, combat)`. Ordering is:

> authored gun/thrown base -> character capacity modifier and its documented rounding -> pet +1 at
> Verdant level 10 -> final non-negative integer clamp.

Use it at every boundary, not only the HUD:

- join and `restartRun` initial resource setup;
- `restoreWeaponResource`, new-row initialization and defensive clamp;
- genuinely new pickup initialization;
- live gun reload and thrown refill completion;
- `stepStowedWeaponResources` arena ledger completion;
- `stepStoredSlot` for inactive arsenal and bag rows;
- 21b's `reload-held-gun` descriptor when that hook becomes active;
- drop/regrab, Q/E, 1/2/3, bag store/equip, sell and direct identity transitions;
- dual-wield lead and off-hand ledgers after wave 24.

Thread owner combat/runtime into both stowed helpers; their current id-only call to `maxWeaponCharges` would
otherwise refill to the base cap while stowed. Saving preserves remaining charges. Restoring clamps to the
same run-stable effective maximum. Only a genuinely new pickup initializes full. Swap, revive, reconnect,
selection, stage change and returning to a weapon never top up or erase cooldown/reload debt.

Downing does not recompute a smaller maximum or clamp away the extra existing charge. The owner cannot
attack while down, so it grants no new benefit. A new run without Verdant starts fresh at the ordinary
maximum.

If pets land before dual-wield, publish this helper as a dependency and require wave 24 to use it for each
hand. If pets land after 24, audit both hand ledgers in the pet wave. The client continues to gate sends on
synced charges and render synced `charges/maxCharges`; no prediction field is needed.

### 3.5 Remaining six landing details

**Lodestar Moth.** Make `xpMoteReach(player)` read the owner's exact cached level. At
`beginXpBoundary(kind)`, before the ordinary bounded cleanup starts, level-10 Moths may claim currently
eligible, unlatched Echoes within 600 of their owner for `descent`, `extract`, `belt-victory` and
`bossrush-victory`. With multiple Moths, nearest distance then stable player id wins. Do not sweep on wipe.
Use existing collector/flight fields and caps; the cosmetic Moth coordinate is irrelevant.

**Copper Snail.** In `grabWeapon`, compute the allowed radius per candidate pickup: expanded only when
`earnedPickups.has(id)`, base `PICKUP_RADIUS` otherwise. Preserve nearest-distance/tie policy. Mirror the
same eligible set to the owner client with the sparse private receipt described in section 2 so the R prompt
and ring match server acceptance without revealing weapon identity. Replace every `BAG_CAP` admission check
with `canAddToBag(player, runtime)`. At level 10 the cap is 13. If a player begins a later run without Copper
while retaining 13 rows, keep all rows but reject additions until length is below the ordinary cap of 12.
Never delete or auto-sell overflow.

**Gilded Gecko.** Only a legitimate earned sale with positive base `scripValue` contributes. Add
`basePayout * 0.02L` to a private per-run fraction, mint whole bonus Scrip up to `2L` that run, and retain
the fraction below one. At level 10 the capstone changes the mint ceiling from 20 to 30; it does not change
the 20% rate. Unearned sales, purchases, upgrades and previous Gecko bonus do not compound. Account Scrip,
`player.scrip` and the receipt commit atomically; duplicate sell messages cannot mint twice.

**Brass Crab.** Apply x`(1 - 0.01L)` once when a gun reload or thrown refill duration is assigned, held or
stowed. Do not multiply an already-reduced debt again on restore. At level 10, stowed `reload` decrements by
`dt * 1.25` while the owner is alive; stowed `cooldown` decrements by `dt`. When downed, existing debt still
ages at the base x1 rate; do not lengthen debt that was already authored while alive. One completion edge
fills from `effectiveMaxWeaponCharges`.

**Pale Firefly.** `tryRez` uses `weapon.rez.radius + 6L` for this existing revive effect, whose current base
is 96, and keeps nearest-down-player selection deterministic. At level 10, the rezzer's pet changes the
target HP assignment from `REVIVE_HP_FRAC = 0.30` to 0.40. It does not depend on the target's pet and does
not multiply other heals.

**Slate Tortoise.** `damagePlayer(player, amount)` currently loses damage provenance. Add a closed
`PlayerDamageKind` (or an equivalent typed context) and label every call site. Only `pit` and explicitly
catalogued neutral/authored `ground-hazard` kinds receive the Tortoise multiplier. Enemy contact,
projectiles, bosses, enemy-created zoner puddles in `stepZones`, self-costs and other damage remain
unchanged. After the pit snap-back applies damage, if the player survives, set
`tortoisePitRegenSeconds = 3`; another survival refreshes to 3, never stacks. No timer is granted on lethal
fall or generic hazard damage.

### 3.6 Downed and structural invariants

All pet event dispatch starts with “owner is alive and run outcome active.” Exceptions are retained state,
not active benefits:

- Verdant's effective maximum remains the run maximum, but no regen or attack occurs while down.
- Hearth, Moth, Gecko, Firefly and Tortoise cannot trigger while down.
- Copper retains inventory rows; admission is closed while down.
- Brass debt continues at ordinary base passage of time, with no x1.25 stowed acceleration.
- Pending Bond receipts already qualified remain bankable on terminal wipe.
- Down/revive/reconnect never resets reload, cooldown, charges, Gecko buckets, pity, dimension receipts, or
  once-per-run state.

---

## 4. Bond XP, terminal settlement, acquisition and feeding

### 4.1 Exact level curve

Only the selected run pet earns Bond XP. There are no copies, duplicate pets, per-character levels,
prestige, respec, overflow wallet, pet food XP, kill XP, damage XP, time XP, loot XP, difficulty multiplier
or last-hit award.

| Current level | XP to next | Lifetime XP at level start |
|---:|---:|---:|
| 1 | 120 | 0 |
| 2 | 180 | 120 |
| 3 | 240 | 300 |
| 4 | 300 | 540 |
| 5 | 360 | 840 |
| 6 | 420 | 1,200 |
| 7 | 480 | 1,620 |
| 8 | 600 | 2,100 |
| 9 | 900 | 2,700 |
| 10 | Max | 3,600 |

A maxed pet discards new Bond XP and shows `Maxed`. Do not introduce a spendable overflow currency.

### 4.2 Award receipts and qualification

Accumulate server-private milestone receipts:

| Milestone in one run | Bond XP |
|---|---:|
| First qualifying dimension clear | 100 |
| Second qualifying dimension clear | 140 |
| Third qualifying dimension clear | 180 |
| Terminal extraction/victory | 80 |
| Per-run maximum | 500 |

Each dimension epoch can pay once, only the first three clears pay, and rift loops/repeated callbacks cannot
re-award. A player qualifies for a dimension receipt by being present in that dimension for at least 60
seconds and recording at least three accepted combat/support actions there. Downing after qualification
does not revoke it. The exact accepted-action whitelist is a P0 answer; count server-accepted outcomes, not
raw messages, input ticks, movement or animation.

The 100/140/180 receipts become pending at their authoritative boss/dimension-clear seams. They are not
written to the account during combat and do not alter the run pet. On a normal extraction or any accepted
terminal victory, add 80, cap the run at 500, and bank. On wipe, bank already-qualified clear receipts but
add no 80. Leaving/abandoning before terminal settlement forfeits pending Bond XP unless the reconnect
policy explicitly retains the account-run reservation.

### 4.3 One terminal settlement path

`enterTerminalOutcome(outcome)` is the central result/teardown seam:

- normal extraction reaches `beginXpBoundary("extract") -> completeExtraction() ->
  enterTerminalOutcome("victory")`;
- boss-rush reaches `beginXpBoundary("bossrush-victory") -> completeBossRushVictory() -> victory`;
- belt victory reaches `beginXpBoundary("belt-victory") -> victory`;
- squad wipe reaches `enterTerminalOutcome("defeat")` directly;
- `descent` is not terminal and must not bank.

Add a one-shot settlement call at the start of `enterTerminalOutcome`, before private runtime is cleared.
Use an idempotency key such as `accountId/runId/petId/resultVersion`. The room result can transition
immediately; durable settlement should be an account-store transaction/retry, not a long await in the
50 ms simulation step. The transaction:

1. verifies the stored pet still exists/owned;
2. adds the clamped pending Bond XP;
3. derives old/new level and band;
4. performs an eligible Slate Tortoise terminal-victory roll;
5. increments account revision exactly once;
6. returns a receipt for result UI and cache replacement.

Retain a bounded settlement job until success or durable queue handoff. Account-store failure must not
partially change XP, pity, Scrip, or revision. Client disconnect cannot erase a production settlement.
Repeated terminal ticks, cleanup, restart and transaction retry must return the same result without
duplicating XP or egg rolls.

### 4.4 Pet acquisition and the Scrip path

- Verdant Wing: free starter, granted once.
- Hearth Newt, Lodestar Moth, Copper Snail, Gilded Gecko, Brass Crab and Pale Firefly: deterministic eggs,
  each costing `◈ 160 Scrip` in a dedicated `Companions` shop row. Total deterministic roster cost is 960
  Scrip, in addition to the existing 895-Scrip permanent-upgrade track.
- Slate Tortoise: one account-specific roll on an eligible terminal victory. Chance is 8% after zero misses,
  then +8 percentage points per miss, guaranteed on the eighth attempt. On failure increment the clamped
  pity counter; on success grant once and reset/retire pity. No duplicate, bag item or tradeable egg.

For deterministic eggs, add a request such as `buyPetEgg({ petId })`. The client sends no cost or ownership
claim. The server checks action budget, active belt/shop context, alive state, `SHOP_RADIUS`, allowed
catalog id, not already owned, canonical Scrip and account revision. One transaction debits 160, grants the
record at 0 XP, and returns the account snapshot. The new pet can be selected next run, never mid-run.

This exposes a broader production requirement: sales, upgrades, egg purchases and any future feed must all
write through the same canonical Scrip account session. Retaining server-room checks but relying on the
browser to save the result would leave the pet economy forgeable between sessions.

### 4.5 Feeding alternative - specified but not recommended for launch

The systems recommendation is automatic end-of-run Bond XP only. Launch with no feeding, food item, feed
currency, random growth, mood, nature or pet inventory.

If a later Scrip catch-up sink is approved, its safe protocol is:

```ts
room.send("feedPet", { petId });
```

The client sends neither price, XP, quantity nor target level. A catalog entry defines one fixed Scrip cost
and one fixed Bond-XP packet. The server checks active belt/shop context, alive/proximity/action budget,
owned valid pet, below max, canonical balance and account revision. An atomic transaction debits Scrip and
adds XP once; on failure, neither changes. Rate-limit/replay-protect the message.

Feeding any owned pet may update the account and result/menu display, but it cannot change the current run
snapshot, public stage band, bonuses, capacity or ledgers. Copy should say `Available next run`.

Recommendation: ship terminal banking, not feeding. Feeding competes with already scarce upgrade/egg
Scrip, weakens the bond-with-the-equipped-pet loop, and is insecure until the same account store is already
solving the harder production problem.

---

## 5. Client-only follower: PetRig

### 5.1 Lifecycle and part model

Build a small purpose-specific `PetRig` rather than subclassing the combat `SpriteRig`. Reuse its proven
paper-cutout idioms:

- one retained Phaser Container and a small ground/shadow child;
- packed-atlas part lookup through a declarative stage manifest;
- 2-4 retained cutout parts per creature: body/core plus only the authored wing, feeler, tail, shell, claw
  or head pieces from the creature specification;
- stable phase, handedness and owner mark derived from owner id + pet id;
- scalar spring/jiggle state, clamped dt, no per-frame array/closure/Tween allocation;
- signed-scale paper turns and depth/texture changes only near edge-on;
- one deterministic `destroy()` that releases all images and removes map references.

`ArenaScene` owns `Map<playerId, PetRig>` beside the existing player `blobs` map. Reconcile after player
schema changes: create for a non-empty descriptor, update descriptor on id/band change, destroy on player
removal/empty id, clear all on scene shutdown. Never insert the rig into player/enemy/projectile/pickup
schema collections.

### 5.2 Follow anchor and spring

Sample the owner's final rendered root after local prediction or remote interpolation. Let `F` be the last
stable movement direction, falling back to aim then facing, and `R` its right vector. With a stable party
slot/owner side:

```text
anchor =
  owner
  - stageRearOffset * F
  + shoulderSign * 20 * R
  + 10*cos(theta) * R
  - 6*sin(theta) * F
```

Use rear offsets 48/58/68 px for Hatchling/Awakened/Ascendant, producing the creature target's approximate
52/62/72 px trail read once the orbit is included. Seed the 2.8-second orbit by owner/pet id so a squad
does not synchronize. Party shoulder signs alternate; later slots may sit another 6 px rearward, with at
most 14 px collision/readability separation.

Presentation tuning from the creature specification:

- feed the anchor through about 100 ms of visual transform lag; smooth heading over 140 ms;
- positional spring 4.25 Hz, damping ratio 0.78, speed cap 340 px/s, acceleration cap 2,600 px/s2;
- settle to under 5 px error in about 260 ms;
- root turns through only 18% of the owner's heading delta;
- normal appendage motion uses the authored preset: flutter 8.5 Hz/0.35 damping, antenna 6.5/0.38,
  tail 5.2/0.55, or weighty 4.8/0.70, normally 4-7 degrees.

When anchor error exceeds 78 px, use the cosmetic catch-up dart: about 60 ms compression, 120-170 ms travel
up to 920 px/s, land within 14 px behind the live anchor, and emit at most two paper slivers. For a true
teleport/reconciliation/rift cut, fold to alpha 0 over 70 ms, snap hidden 64 px behind the destination,
then perform the short dart at 0.75 alpha. Rebase spring velocity on first frame, tab resume, LOD wake and
stage replacement. Never sweep across the map or replay hidden distance.

After 1.8 s owner idle, an authored idle may occur every 6 s +/-1.5, last 0.45-0.75 s, and displace at most
12 px. Reduced motion disables orbit flourish, jiggle, dart slivers and idle displacement while retaining
the readable positional follow.

In belt mode keep private world y, run the spring in world space, project once for display, and depth-sort
from world y. Never feed projected y back into the integrator.

### 5.3 LOD, readability, depth and palette

**LOD and room cap.** Track every player's descriptor. If owner and target are outside the camera world view
expanded by `JIGGLE_LOD_MARGIN_PX` / one body height, hide the root and skip spring, orbit, part solver and
child writes. On wake, rebase. The normal acceptance capture is four visible pets; also stress all ten
visible because the room permits ten. Above four visible, suppress remote idle flourishes and particles
before dropping silhouettes. Visibility settings `All / Mine / Hidden` and “No pet” affect rendering only.

**Size and depth.** Face-on envelope is at most 30/37/44 px by stage. Root depth derives from follower
ground-world-y but is clamped at least one actor band behind the owner and below protected telegraphs,
parry/grab response, downed labels and HUD. Shadow stays small and first in local order; hover never changes
gameplay/depth y. Suggested alpha is 0.88 for self, 0.68 for remote, and 0.42 on actor overlap.

**Telegraph law.** Pet pixels never obscure a live danger edge. Expand known truth bands by 14 px and allow
the cosmetic anchor to detour at most 28 px. If it cannot clear, fade toward 0.12. Render the exact
telegraph/mask above the pet with an 8 px feather. Pet presentation can be hidden without changing play.

**Palette.** Use a warm-black 2 px cut keyline, muted 70-80% body colors, one accent covering at most 8%,
and a persistent 3-5 px owner-color tab/tail so duplicate species remain attributable. Avoid telegraph red,
parry white, extraction/rift instruction colors, loot beams/halos, rarity frames, additive bloom, combat
rings and large particles. Stage-three core light is a small material accent, not a gameplay glow.

**Downed owner.** Park beside the persistent body, stop flourish/jiggle, droop authored parts, desaturate and
set alpha about 0.35. The pet does not die, explode, become a pickup token or follow a spectator camera.
Revive unfolds the same rig and snapshot.

### 5.4 Evolution texture swap

`PetStageDef` maps each band to texture keys, part pivots, local depth order, envelope and jiggle preset.
Other clients select it solely from `petId + petLevelBand`. The owner gets exact level/XP from account
messages, not schema.

Evolution earned at terminal result is celebrated in result/menu UI and appears on the next run. A normal
active run never swaps stage. `setDescriptor` still supports reconnect, patch recovery and Testing Grounds:
swap art at the edge-on midpoint of a restrained paper turn, preserve the follower root, and reset part
springs. Preload all small stage manifests before arena entry; a missing texture falls back to that pet's
Hatchling silhouette, never a raw texture id.

---

## 6. UI surfaces and dockux language

### 6.1 Pre-run selection

`MenuScene` currently chooses launch intent/dimension; in-run C cycling is not a real character-select
flow. Pets should land with the character-select redesign, in a shared pre-run `Loadout` region:

- Character card on the primary side.
- Adjacent `COMPANION` slot/card, not nested in weapon or character stats.
- Selecting the slot opens the owned/locked pet folio.
- Ready/launch snapshots the pet. No switch exists at shop, Backpack, rift, death, revive or reconnect.
- Same-pet squads are allowed.
- A new account has Verdant Wing pre-equipped; do not block the first run with a mandatory modal.
- Invalid/stale cached selection visibly falls back before launch rather than letting the server silently
  equip another combat bonus.

The main-menu `Companions` view owns roster management, levels, Bond progress, exact current/next effect,
level-10 preview, acquisition rules, companion visibility and reduced-motion/no-pet options. Locked pets
remain visible with deterministic unlock copy.

### 6.2 Card and result content

Use dockux grammar: uppercase only for short structural titles, sentence-case body copy, opaque dark backing
plates, existing DPR treatment, at least 10 CSS px text, redundant icon/text/color communication.

Example card:

```text
COMPANION
Verdant Wing · Lv 7/10
1,860 / 2,100 Bond XP
HP regeneration x1.35
Next: x1.40
Level 10: +1 use before gun reload / thrown refill
Stage: Awakened
```

Use `◈ 160 Scrip`, never `160 ◈`. Say “Bond XP,” not generic account XP, and say “use before
reload/refill,” not ambiguous “charge.” The client derives displayed numbers through shared pure catalog
helpers, but server outcomes remain authoritative.

Post-run result shows one selected-pet receipt:

- each paid milestone;
- total `+N Bond XP` or `Maxed`;
- old/new level and stage;
- capstone/evolution ceremony;
- Slate egg/pity outcome when eligible;
- account-save pending/error state without granting local progress optimistically.

There is no combat Bond-XP bar or popup. Pause/run details may show the read-only snapshotted pet and exact
effect. The weapon dock gets no pet card. Backpack does not treat pets as weapons/items. The belt shop may
have a dedicated collapsed `Companions` purchase row for the six deterministic eggs; it is not a fourth
`META_UPGRADES` row. Feeding UI is absent at launch.

---

## 7. Planned file/touch list

| File/module | Planned responsibility |
|---|---|
| `packages/shared/src/pets.ts` (new) | Closed ids, eight definitions, exact curve, stages, modifiers/capstones, acquisition data, pure derivation/sanitizers. |
| `packages/shared/src/meta.ts` | Versioned account shape, pet records, selection and Slate pity while preserving `META_UPGRADES` / `sanitizeMetaLevels`. |
| Final 21a character-kit module (currently `character-classes.ts`) | Export source-neutral modifier/event/effect contracts. Pet content remains in `pets.ts`. |
| `packages/shared/src/state.ts` | Append `PlayerState.petId` then `petLevelBand` only. |
| `packages/shared/src/constants.ts` | One orchestrator-assigned next schema bump; cross-runtime limits only. |
| `packages/shared/src/index.ts` | Export pet/meta public APIs. |
| `packages/server/src/meta/MetaAccountStore.ts` (new) and bootstrap/auth wiring | Canonical load, revisioned transaction, idempotent settlement, local-dev adapter. |
| `packages/server/src/rooms/GameRoom.ts` | Join snapshot, private runtime, generalized hook dispatch, heal/damage typing, all eight seams, ledger helper, XP receipts, account/Scrip/acquisition settlement. |
| Server tests, including `GameRoom.test.ts` and focused meta/pet tests | Trust, bonus, lifecycle, debt, economy, terminal and retry cases. |
| `packages/client/src/meta-store.ts` (new) | Legacy migration, local display cache, canonical revision replacement, storage failure. |
| `packages/client/src/entities/PetRig.ts` plus pure follow helper (new) | 2-4-part retained cutout, anchor/spring, LOD, depth, telegraph avoidance, stage swap, cleanup. |
| Pet atlas source/manifest and generated packed assets | Three stage manifests per species through the existing art pipeline; do not hand-edit generated outputs. |
| `packages/client/src/scenes/MenuScene.ts` | Character/companion loadout, Companions page/card, selection validation and scene payload. |
| `packages/client/src/scenes/ArenaScene.ts` | Join selection, account/receipt handling, PetRig map/update/projection, Copper eligibility cache, result UI and shop egg row. |
| `packages/client/src/net/matchmaking.test.ts` | Selection survives join/retry but never changes room filtering. |
| Client unit/e2e/render tests | Store migration, menu, follower traces/LOD/stages, two-client descriptor behavior, result receipts and screenshots. |

No v1 change belongs in `EnemyState`, `ArenaState.enemies`, enemy/projectile caps, input command schema,
player movement snapshots, collision grids or server actor interpolation.

---

## 8. Wave plan and schema ordering

| Pet wave | Scope | Parallelism / ownership |
|---|---|---|
| P0 - decisions and contract freeze | Answer section 10; resolve panel balance conflict; freeze ids, exact effects, overlap policy, action qualification and account/reconnect posture. | Can happen now; no code lock. |
| P1 - pure shared/meta | `pets.ts`, XP/stage/mod helpers, v2 account types/sanitizers/migration fixtures. No schema bump. | Can run beside 21b/23/24 once final 21a source-neutral types are known. Serialize edits to `meta.ts` / `index.ts`. |
| P2 - independent art/rig | Stage manifests, pure follow solver, `PetRig`, LOD/telegraph/render tests with mock descriptors. | Parallel with server train; no ArenaScene integration. |
| P3 - account authority | Auth identity, `MetaAccountStore`, transactions/idempotency, client `MetaStore`. | Parallel with combat work. Production progression is gated on this; local-dev rig playtest is not. |
| P4 - schema descriptor | Append the two PlayerState fields and bump schema once. | Orchestrator-owned merge slot after rebasing onto the fields actually present. |
| P5a - server sustain/economy | Run snapshot, hook composition, healing/damage typing, non-weapon pets, milestone/terminal/acquisition transactions. | Exclusive `GameRoom` window, preferably after 21b/23/24 stop editing those seams. |
| P5b - resource ledger | Verdant and Brass helpers across held/stowed/bag and both dual-wield hands. | Land after 24, or publish the effective-max/debt API first and make 24 consume it. Do not implement two incompatible ledger abstractions. |
| P6 - client integration/UI | Menu selection, Companions/card/result, join/cache messages, Arena PetRig reconciliation, Copper private eligibility. | Rig work is already parallel; serialize `ArenaScene` / `MenuScene` merges behind active owners. |
| P7 - hardening/balance | Four-/ten-player stress, wire capture, cross-system matrix, telemetry, accessibility and migration soak. | Required before public progression. |
| Deferred | Optional `feedPet` catch-up; any authoritative moving/spatial pet. | Separate product/balance/schema proposal. |

Schema landscape when this plan was written:

- 21: class-merge identity / wave 21a in flight;
- 22: dodge roll / 21b claimed;
- 23: ultimates claimed;
- 24: dual-wield claimed.

If those land in that order, pets project to schema 25. That is not a reservation. Final ordering is
orchestrator-decided: P4 reads the current `SCHEMA_VERSION` at merge time, appends after the fields
physically present, and takes exactly the next number. If the orchestrator inserts pets earlier, later waves
renumber/rebase. Never reorder old schema fields to preserve a provisional number. Both pet fields land in
one bump.

---

## 9. Test strategy by piece

### 9.1 Shared catalog and account

1. Registry is a closed set of eight unique ids; every level is 1-10; thresholds are exactly
   0/120/300/540/840/1200/1620/2100/2700/3600; stage coverage is 1-3/4-7/8-10; capstone resolves only at 10.
2. Golden values cover every roster formula at levels 1, 9 and 10.
3. Unknown ids, duplicate/malformed records, negative/fractional/NaN/huge XP, invalid pity, unowned
   selection and future versions sanitize safely. Level is derived only from sanitized XP.
4. Legacy Scrip/upgrades migrate once, grant Verdant once, preserve values, and tolerate blocked/throwing
   storage.
5. Catalog definitions remain immutable and a live run retains its definition-version snapshot.

### 9.2 Authority, lifecycle and schema

6. Production ignores a forged max-level join and loads canonical account data; unowned/unknown selection
   follows explicit fallback. Dev mode accepts only bounded local payload.
7. Only id/band are public. Exact level remains server-private; rift, character cycle, shop, down/revive and
   reconnect cannot change the snapshot.
8. Schema compatibility test verifies append order and one version bump. Wire capture shows two initial
   descriptor writes and 0 B/patch follower motion.
9. Downed owners gain no active pet effects; revive/reconnect does not reset capacity, debt, counters,
   pending receipts or stage.
10. Two sessions for one account cannot settle or buy concurrently past the account revision.

### 9.3 Bonus seams

11. Verdant regen matches 20 Hz integration, max-HP clamp and x1.05/x1.50 boundaries; zero-regen quirk stays
    zero; discrete heals remain unchanged.
12. Hearth scales each intended event-heal kind once based on receiver, excludes regen/meta/revive, and
    grants exactly 15% final max HP on accepted level-10 descent.
13. Lodestar tests reach 198/360, nearest/tie behavior, cap-48 Echo bounds, 600 capstone latching at the four
    accepted boundaries, multiple owners and no wipe sweep.
14. Copper tests earned versus unearned radius, client/server prompt parity, nearest selection, every bag
    add path, cap 13, and safe retention/locked additions on a later no-Copper run.
15. Gecko tests fractional accumulation, legitimate earned provenance, per-level cap, level-10 cap 30,
    uint/account clamp, duplicate sell message and cross-session transaction retry.
16. Brass tests held/stowed gun and thrown duration, no double multiplication, x1.25 reload-only advancement,
    ordinary cooldown, completion once, downed base aging and restore.
17. Firefly tests 102/156 reach, deterministic nearest revive, non-owner target pet irrelevance, 30% below
    max and exactly 40% at max.
18. Tortoise labels every `damagePlayer` call; only pit/neutral authored ground hazard scale, zoner/enemy/boss
    damage does not; surviving pit starts/refreshes a non-stacking three-second regen window.

### 9.4 Resource debt matrix

19. Cover two-shell shotgun, low-charge thrown weapon and 50-round gun at base and level-10 Verdant.
20. Fire to empty, reload/refill, swap away/back, stowed completion, bag store/equip, active sell, drop/regrab,
    genuinely new pickup, restart, down/revive and reconnect.
21. Cross with Bandoliers/capacity rounding, Coldsnap reload hook, loot affixes and Brass; then repeat for
    dual-wield lead/off-hand. One hand never borrows or resets the other.
22. Property assertion: no sequence containing only non-attack identity/inventory operations increases
    available charges or reduces debt, except one legitimate authored reload/refill completion and the
    known new-run/new-pickup initialization.

### 9.5 Bond XP, Scrip and acquisition

23. Qualification rejects 59.95 seconds, two accepted actions, raw-message spam and repeated dimension
    epoch; accepts 60 seconds + three whitelisted outcomes once.
24. Exact totals: early wipe 0; one-clear wipe 100; three-clear wipe 420; three-clear victory 500; terminal
    bonus without a paid clear follows the frozen design rule; max pet discards.
25. Normal extract, belt victory, boss-rush victory and wipe each settle once; descent, cleanup, repeated
    terminal ticks, restart and store retry do not.
26. Disconnect/account-store failure/retry follows the selected policy without partial XP/Scrip/pity.
27. Six eggs validate exact ids/cost/proximity/alive/not-owned and commit debit+grant atomically. Slate tests
    8/16/24/.../64% through guaranteed eighth attempt, one roll per eligible result, no duplicate.
28. If feeding is later enabled, forged cost/XP, flood, wrong mode, far/dead, unowned/maxed and insufficient
    balance are no-ops; a valid feed changes next-run account progress only.

### 9.6 Client, UI and performance

29. Selection survives Menu -> Arena retry but never enters matchmaking filters; a higher canonical account
    revision replaces stale local cache.
30. Golden follow traces cover start/turn/stop, predicted self, interpolated remote, dt clamp, 78 px dart,
    teleport/rift cut, tab resume, offscreen sleep/wake and belt projection without y drift.
31. Stage swap preserves root and resets part energy; missing art falls back; reduced motion and
    All/Mine/Hidden do not change gameplay.
32. Render screenshots cover every stage/dimension, duplicate pets, downed body, smallest viewport and exact
    telegraphs. No pet pixel obscures a protected edge.
33. Reconcile/remove/shutdown leaves zero rig children/maps/Tweens. Four visible pets meet the normal
    client budget; ten visible 2-4-part pets allocate no steady heap, offscreen rigs perform no child writes,
    and remote flourish degradation is deterministic.
34. Two-browser e2e shows each pet attached to the correct predicted/interpolated owner, server-equal
    regen/ammo/revive outcomes, private progression only for the owner, and one result receipt.

---

## 10. Three answers implementation needs first

1. **Production account authority and reconnect:** Is launch backed by an authenticated, revisioned account
   store, a server-validated signed snapshot, or explicitly local/offline trust? Must a disconnected player
   rejoin the same run, and if so what reservation window/account-to-player rebind owns pending Bond XP?
2. **Which balance/content contract wins:** Is the systems roster above approved despite the adversarial
   one-axis objections - especially Verdant Wing's regen plus flat +1 capacity, Copper's thirteenth slot,
   Gecko's Scrip mint, and Brass reload speed? Are same-budget character/pet pairings legal and stacked, or
   rejected in pre-run UI? This must be frozen before durable XP is earnable.
3. **Award eligibility edge rules:** Which server-accepted combat/support outcomes count toward the three
   actions, does an eligible “terminal victory” include arena extraction, belt victory and boss-rush for
   Slate's roll, and is disconnect without returning an abandon? These answers define exploit tests and the
   idempotent settlement key.
