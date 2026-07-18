# Weapon banking — technical implementation plan

Status: design only. `DECISIONS.md` is binding. This plan also incorporates `bank-systems.md`,
`bank-advocate.md`, the sibling gear account plan, the shipped pet account/settlement precedent, and the
schema-27 dual-wield implementation.

## 0. Verdict and binding interpretation

Implement banking as an account-private **Stash** plus an atomically committed **Carry**. Selected entries
leave the Stash and enter expedition escrow at run commit. A terminal defeat deletes that escrow; an
accepted extraction or terminal victory returns surviving carried entries and finds to Stash or `INTAKE`.
Downing is not death, rift descent is not settlement, and disconnect is never extraction.

The target sizes and nouns come from `bank-systems.md`:

| Container | Bound | Capacity accounting | At risk |
|---|---:|---|---|
| Stash | 72 entries initially; six `+12` shelves; 144 maximum | Single = 1 entry; pair = 1 entry | No |
| Active | 3 physical positions | Single = 1; pair = 2 | Yes after commit |
| Pack | 12 physical positions | Single = 1; pair = 2 | Yes after commit |
| Intake | At most one run's logical returns | Pair remains 1 entry; physical members remain bounded by that run's Carry | No; blocks ready |

The existing level-10 Copper Snail adds one Pack position. Pets are bindingly retained as shipped, so the
technical hard ceiling is **16 physical carried weapons** until product explicitly retunes that capstone.
All validators and the Intake bound must use `carryCapacity(snapshotPet)`, not assume 15. Gear, prestige,
and shelf purchases never add Carry positions.

There is one conflict that cannot be hidden in implementation: `bank-systems.md` proposes a reusable,
protected Home-Issue Rusty Cleaver, while binding ruling #1 says **no insurance floor**. The protected copy
must not ship unless `DECISIONS.md` is amended. Under the binding file as written, an empty-bank run starts
with fists and uses the advocate's guaranteed low-pressure Common pickup opportunity; the current automatic
Common/plain `rusty-cleaver` seed retires. A normal earned cleaver is an ordinary losable instance.

## 1. Shipped seams this plan extends

### Arsenal and loot identity

`PlayerState` already exposes three `ArsenalSlot` rows, `activeSlot`, and a 12-row `bag`. The active row is
mirrored through `player.weapon`, `weaponRarity`, and `weaponAffix`. Each `ArsenalSlot` currently carries:

```ts
weapon: string;
rarity: uint8;
affix: string;
earned: boolean;
```

Its undecorated `resourceWeapon`, `resourceReady`, `cooldown`, `reload`, and `resourceCharges` fields are
run debt only. `syncActiveSlot`, `loadSlot`, `copySlot`, `grabIntoArsenal`, `bagStore`, `bagEquip`,
`dropHeldWeapon`, `sellWeapon`, and `salvageWeapon` are every topology edge that banking must make
instance-aware. The binding shared-resource overhaul will retire ammo/charges/durability; none of those
values enters the account in the interim.

Loot has seven stable rarity ids and two disjoint affix families:

- `common`, `uncommon`, `rare`, `really-rare`, `legendary`, and `ultimate` use exactly one id from the
  normal affix table: plain `""`, `keen`, `swift`, `heavy`, `light`, `balanced`, `brutal`, `worn`, or
  `sluggish`.
- `cursed` uses exactly one of `blessed`, `frenzied`, `doomed`, or `hollow`. It may not be plain or use a
  normal affix.

`DROP_POOL` excludes fists, rez/support weapons, and expansion weapons whose `effectivePower` is outside
`0.60–2.20×` their class median. `rollDropWeapon` is uniform today. `dropLoot` rolls a hidden base id plus
rarity/affix; its generic rates are 1.2% trash, 5.5% tough, and the authored boss guarantee. The separate
known-wielder path currently uses 2% ordinary, 6% tough, and 100% for an eligible shifter outside the boss
anti-farm lock. `maybeDropWeapon` can therefore emit a known wielded id even when the mystery selector did
not choose it. Both paths mark the pickup earned.
The bank sanitizer therefore validates against a closed **acquisition catalog**, not merely
`Object.hasOwn(WEAPONS, id)`: random loot must be in `DROP_POOL`; known wielded, boss, and tutorial rewards
must be in explicit server-owned direct-drop allowlists.

The home sale table remains `4 / 9 / 18 / 34 / 60 / 60 / 60` for the seven rarities. Affix does not affect
price. Field sale retires; only safe Stash/Intake entries can be sold.

### Pair link

Schema 27 already stores dual-wield as `PlayerState.dualWield`, with `offhandSlot`, `pairBaseSeq`,
`offCharges`, and `offMaxCharges`. A live pair is two occupied arsenal positions and the off hand is a link,
not a fourth weapon. `pairEligible` already rejects identical definitions, fists, non-`1H`, authored duals,
thrown weapons, beams, mismatched classes, and mismatched live delivery.

Persistence upgrades the relationship without changing combat identity: one pair is **one bank entry with
two distinct weapon instances**, fixed lead/off roles, and two physical Carry positions. It is not a fused
weapon definition. The current `offhandSlot` remains its active runtime projection.

### Account and settlement

`MetaAccountV2` is a local/offline client claim containing revision, Scrip, upgrades, pets, selection, and
pity. `sanitizeMetaAccountV2` clamps known fields and derives pet strength from the closed catalog. The
room keeps the sanitized account in `metaAccounts`; owner-only `metaAccount` messages replace the browser
cache. This proves bounded shape, not that progress was earned.

The sibling gear plan proposes the next meta account version with gear ownership/equipment. Banking should
join that same launch account rather than create an unrelated save island. If gear v3 has not shipped,
gear and weapons publish one combined v3 migration. If it has shipped, weapons bump the outer account to
v4. `WeaponBankV1` below remains independently versioned either way, and the **outer account revision** is
the only transaction revision.

`enterTerminalOutcome` is the correct common seam. Normal extraction reaches it through
`beginXpBoundary("extract") -> completeExtraction`; belt victory and boss-rush victory also converge on
it; a squad wipe calls it with defeat; descent does not. Today it invokes `settlePetAccounts` before
teardown. Replace that narrow call with one idempotent meta settlement that handles pets, Scrip, weapon
escrow, pair cleanup, and account revision together.

## 2. Durable data contract

### 2.1 The weapon instance

Persist exactly the following gameplay-bearing fields and no others:

```ts
type WeaponInstanceId = string; // server-minted: /^wi_[A-Za-z0-9_-]{22}$/
type WeaponPairEntryId = string; // server-minted: /^wp_[A-Za-z0-9_-]{22}$/

type WeaponRarityId =
  | "common" | "uncommon" | "rare" | "really-rare"
  | "legendary" | "ultimate" | "cursed";

type WeaponAffixId =
  | "" | "keen" | "swift" | "heavy" | "light" | "balanced"
  | "brutal" | "worn" | "sluggish"
  | "blessed" | "frenzied" | "doomed" | "hollow";

type WeaponProvenance =
  | "enemy-drop"
  | "boss-drop"
  | "tutorial-drop"
  | "migration-earned";

interface WeaponInstanceV1 {
  instanceId: WeaponInstanceId; // per copy; duplicates never share it
  weaponId: string;             // exact key in the server's acquisition catalog
  rarity: WeaponRarityId;
  affix: WeaponAffixId;
  provenance: WeaponProvenance;
  sourceWorldTier: number;      // exact integer 0..30, stamped on mint
}
```

`instanceId` is identity, not evidence of authority under local trust. `weaponId`, rarity, affix, sale
value, pair eligibility, class, tags, damage, art, and realized power are all resolved from server-owned
catalogs. The record never stores stats, price, cooldown, resource fill, charges, ammo, durability, heat,
computed power, favorite state, kill count, or pair bonus.

Only earned acquisitions enter the bank. Training, gallery, preview, debug, conjured carousel weapons, and
the empty-hand fists fallback never mint `WeaponInstanceV1`. `migration-earned` exists only for a rolling
deployment that explicitly converts a still-live old room's `earned=true` entries at a successful terminal
extraction; normal v2/v3 account migration begins with an empty bank.

### 2.2 One bank entry, including a pair

```ts
interface SingleWeaponEntryV1 {
  kind: "single";
  entryId: WeaponInstanceId; // exactly weapon.instanceId
  weapon: WeaponInstanceV1;
}

interface PairedWeaponEntryV1 {
  kind: "pair";
  entryId: WeaponPairEntryId;
  lead: WeaponInstanceV1;
  offhand: WeaponInstanceV1;
}

type WeaponBankEntryV1 = SingleWeaponEntryV1 | PairedWeaponEntryV1;
```

A pair is persisted once as the composite entry above, not as flags duplicated onto two single rows and not
as a generated `WeaponDef`. The two member ids must be distinct and globally unique. The pair resolver
reruns `pairEligible(WEAPONS[lead.weaponId], WEAPONS[offhand.weaponId])`; lead/off rarity, affix,
provenance, and tier remain independent. Its run minimum is `max(sourceWorldTierA, sourceWorldTierB)`.

Binding replaces two singles with one pair entry atomically and debits the better half's current base sale
value. Unbinding replaces the pair with two singles only when the destination has one additional logical
Stash entry or one additional physical Carry position. Selling a pair consumes the composite and pays the
sum of its two member values. Loss, discard, prestige, and field drop act on the composite; there is no
half-pair receipt or fee refund.

### 2.3 Account extension, locations, and bounds

```ts
interface CarryPlacementV1 {
  entryId: string;
  zone: "active" | "pack";
  start: number; // active 0..2; pack 0..carryPackCapacity-1
}

interface LastCarryV1 {
  placements: CarryPlacementV1[];
  activeEntryId: string | "";
}

interface ExpeditionEntryV1 {
  entry: WeaponBankEntryV1;
  stakeOrigin: "committed" | "found";
  location: "active" | "pack" | "field";
  start: number; // 0..2, 0..12/13, or 255 for field
}

interface WeaponExpeditionReservationV1 {
  runId: string;             // bounded opaque id, at most 64 ASCII chars
  commitRevision: number;
  status: "committed";
  entries: ExpeditionEntryV1[];
}

interface WeaponBankV1 {
  version: 1;
  shelfUpgrades: number;     // integer 0..6; Stash cap = 72 + 12 * value
  stash: WeaponBankEntryV1[];
  intake: WeaponBankEntryV1[];
  lastCarry: LastCarryV1;
  expedition: WeaponExpeditionReservationV1 | null;
}

interface MetaAccountWithWeaponBank /* extends the launch gear account */ {
  version: number;           // coordinated outer version, not independently guessed here
  revision: number;          // one revision for pets, gear, Scrip, prestige, and weapons
  prestige: number;          // integer 0..30; progression World Tier is the same value
  weaponBank: WeaponBankV1;
}
```

Capacity is validated by logical entries and physical members separately:

- `stash.length <= 72 + 12 * shelfUpgrades <= 144`;
- Intake contains at most one completed run's returns and at most 16 physical members under the current
  Copper ceiling;
- a live reservation has at most 3 Active plus 12/13 Pack physical members;
- a pair consumes one Stash/Intake logical entry but two reservation positions;
- an instance id appears exactly once across all Stash, Intake, and expedition member records;
- an entry id is unique across all three locations; and
- unresolved Intake blocks ready, shelf purchase does not auto-move entries, and no overflow is deleted.

With 144 all-pair Stash entries plus the largest legal Intake/reservation state, the defensive ceiling is
304 component instances. Bound identifiers are 25 characters, `weaponId` is capped at 64 characters,
rarity/affix/provenance strings at 24, arrays at the cardinalities above, `WeaponBankV1` encoded JSON at
192 KiB, and the complete account/join payload at **256 KiB**. Reject the payload before recursive walking
when its encoded size exceeds the cap. These are safety ceilings, not targets; normal accounts are far
smaller.

The expedition copy is the local-trust journal: committed entries are moved out of `stash`, never copied.
An authoritative deployment should keep the same record in a revisioned store outside the room. A client
cache is still useful for recovery/rejoin, but it cannot make one id simultaneously safe and live.

## 3. Sanitization: local trust, never nonsense

Use one pure `sanitizeWeaponBankV1` on client load, server join, account mutation, and terminal response.
It returns a canonical bank plus diagnostics. Extra fields are dropped. Any invalid weapon/pair/location or
unsupported bank version makes ready/commit fail as a unit; do not silently embark with a partially erased
high-value manifest. Valid earlier outer accounts migrate explicitly to an empty `WeaponBankV1`; an unknown
future outer version blocks play and asks for a newer client instead of being partially interpreted.

Validation order is cheap to expensive:

1. Enforce raw byte, array, string, integer, enum, and cardinality bounds.
2. Build one global set of entry and instance ids; reject duplicates and cross-location aliases.
3. Resolve every `weaponId` through the closed acquisition catalog for its provenance. Fists and
   training/gallery/debug definitions are never bankable.
4. Validate the exact rarity/affix family. Never coerce an unknown or illegal affix to plain and never clamp
   an out-of-range rarity into Legendary.
5. Validate provenance and integer `sourceWorldTier` in `0..30`. The field is server-derived during honest
   acquisition; local trust cannot prove its history.
6. Validate pairs with the current shared `pairEligible`, member uniqueness, and fixed lead/off roles.
7. Validate Stash/Intake limits, reservation run id/status/revision, exact non-overlapping placement, pair
   span, Active/Pack bounds, and `lastCarry` as references only. Missing Last Carry ids become visible empty
   outlines; no substitution occurs.
8. Ignore client-authored damage, stats, sale values, resource state, catalog version, world-tier damage,
   pair multiplier, or ownership booleans. Only the canonical fields survive.

### Forged-legendary rejection table

| Claimed row | Result | Reason |
|---|---|---|
| Unknown `weaponId`, Legendary/Brutal | Reject entry and block commit | No real catalog definition/acquisition route |
| `fists`, Legendary/Brutal | Reject | Empty hands can never be a bank instance |
| Real but non-curated expansion id with `enemy-drop` | Reject | Not in `DROP_POOL` or an explicit direct-drop allowlist |
| Real id, `rarity="legendary"`, `affix="blessed"` | Reject | Blessed is Cursed-only |
| Real id, `rarity="cursed"`, `affix="keen"` | Reject | Cursed must use the extreme table |
| Real id, `rarity="cursed"`, `affix=""` | Reject | Cursed can never be plain |
| Real id, `rarity="legendary"`, unknown affix | Reject | Unknown ids are not normalized to plain |
| Real id, numeric rarity `4`, or rarity `99` | Reject | Persistence uses the exact closed rarity-id union |
| Real id, legal tuple, tier `-1`, `31`, fractional, or `NaN` | Reject | Source tier is an integer `0..30` |
| Two rows with the same valid instance id | Reject the bank | One physical copy cannot occupy two entries |
| Pair with same member twice or ineligible definitions | Reject pair and block commit | No self-pair or catalog-rule bypass |
| Real drop id, Legendary/Brutal, valid ids/tier/provenance | **Structurally accept** | It is legal data. Local trust cannot prove it was earned |
| Legal instance plus client `damage: 999999` / `price: 65535` | Accept canonical instance, drop extras | Power and price are server-derived |

The last two rows are the honest security boundary. Sanitization prevents crashes, impossible combinations,
arbitrary effect injection, overflows, dangling pairs, and aliasing. It does not make an offline JSON bank
competitive-grade proof. Public trade, verified leaderboards, or an “earned only” claim requires a real
account store and server-issued acquisition/settlement receipts.

## 4. Wardrobe to join to materialized Carry

The Wardrobe's `ARMORY` tab stages references; it does not mutate Stash. Intake must be resolved first.
`Last Carry` is an exact-id convenience list independent of gear presets. Missing ids stay empty. The risk
summary counts physical component weapons and server-derived sale value; a pair displays as one joined card
but counts two at risk.

The join option adds only a bounded selection beside the complete locally trusted account:

```ts
interface CarrySelectionV1 {
  requestId: string;       // idempotency token, bounded opaque ASCII
  expectedRevision: number;
  placements: CarryPlacementV1[];
  activeEntryId: string | "";
  requestedWorldTier: number;
}

interface GameJoinOptions {
  metaAccount: MetaAccountWithWeaponBank;
  carry: CarrySelectionV1;
  // existing gear/pet/dimension/mode options remain
}
```

Server flow, before adding `PlayerState`:

1. Enforce payload bounds, sanitize/migrate the entire account, and reject a stale or live expedition.
2. Snapshot the selected pet first because it determines whether Pack is 12 or 13. Resolve gear separately.
3. Validate each placement references a unique Stash entry; spans do not overlap; singles use one physical
   cell; pairs use two contiguous cells; Active uses at most three; Pack uses the pet-derived cap; empty is
   legal; `activeEntryId` names an Active entry. Reject Intake or illegal tier state.
4. Compute run tier as at least the account's prestige tier, every selected entry's source-tier maximum,
   and the lobby's co-op maximum. Reject a requested tier below that value; never downscale the weapons.
5. Atomically move selected entries from Stash to an expedition reservation keyed by stable account id and
   run id, record `commitRevision`, update Last Carry, and increment the outer revision once. A canceled
   lobby before this commit never moves anything.
6. Send the owner the canonical `metaAccount` showing the committed reservation. A stale tab/retry with the
   same request returns that reservation; a different request against the old revision is rejected.
7. Create the three `ArsenalSlot`s and bag rows from canonical reservation entries. Convert rarity id to the
   existing numeric wire index and derive `earned` from provenance. Empty Active cells load fists. Do not
   seed a free persistent weapon.
8. For a pair, project its members into two adjacent rows, set the lead active when selected, and set the
   existing `offhandSlot` only while both members occupy legal Active positions. In Pack it spans two cells
   and remains one owner-facing `Q/E` stop.
9. Initialize the new-run shared weapon resource state. Never import old cooldown/ammo/charge/heat debt.

The room keeps a private `RunWeaponLedger` keyed by `instanceId`/pair `entryId`. Arsenal rows may carry an
undecorated instance key, or the room may map row identity externally; either way, `copySlot` and every
topology helper must preserve it. The owner receives a sparse `weaponManifest` snapshot after join and
topology changes, containing at most 16 physical locations and pair grouping. This solves duplicate-id and
joined-Pack UI without broadcasting private Stash history.

## 5. At-stake ledger and terminal settlement

### 5.1 Runtime ownership

The reservation, not `PlayerState.slots` alone, defines the stake. Every server-accepted mutation updates
the private ledger and its public view atomically:

- An accepted world pickup reveals the legal tuple, mints one `instanceId`, stamps the run tier and
  provenance, and enters the first legal Active/Pack position or the explicit replace flow. It joins escrow
  immediately with `stakeOrigin="found"`.
- A replaced or manually dropped entry moves to `location="field"`; it remains part of the owner's defeat
  stake but does not bank on victory unless re-carried.
- A player-owned field entry remains owner-qualified at launch. Other clients cannot re-home, sell, pair,
  overwrite, or destroy it. Ordinary unowned loot becomes owned by the first server-accepted grabber after
  any curator owner lock expires. Cross-account weapon trading is out of scope.
- Binding two carried singles consumes both ledger entries and creates one pair entry without changing
  their instance ids. Unbind is the inverse only when capacity exists. A paired drop moves the whole
  composite to the field.
- Salvage/discard consumes the exact entry for zero Stash value. There is no field sale and no “send home”
  message. Home sale is section 7.
- Slot/Pack moves preserve instance identity and all live resource debt. Reconnect restores the existing
  room ledger rather than materializing the account a second time.

`earnedPickups: Set<pickupId>` is no longer sufficient by itself. Add private pickup metadata containing
the hidden loot tuple, eventual instance identity, owner account id when applicable, pair entry when the
field object is a pair, and owner-lock expiry. Do not expose hidden identity through Schema.

### 5.2 Death law

Apply the systems definitions exactly:

| Runtime event | Ledger action |
|---|---|
| `hp <= 0` sets `alive=false` | None. Downed is recoverable; Carry, field stakes, pair, and debt remain. |
| Revive / `revivedSeq` | None. Resume the same ledger; no refill or account reread. |
| Solo down or `anyAlive=false` squad wipe | Terminal defeat; delete every participant's reservation, including its field stakes. |
| Accepted squad extraction, owner downed | Victory for that valid participant; return its carried Active/Pack entries, not field entries. |
| Future explicit personal perma-death | Settle defeat for that account only; no such state exists today. |
| Explicit abandon, active restart, or return-home after commit | Defeat for that manifest. A host action cannot settle another account. |
| Rift descent | No settlement; same reservation and found entries continue. |
| Belt/final-game/boss-rush terminal victory | Same weapon-victory transaction as extraction. |

One living player may complete the current squad extraction. All still-participating or validly reserved
accounts settle, including downed owners. Portal-open, the 0.8-second arm, the 0.75-second hold, a boss
death, or an XP boundary start is not independently a weapon receipt; only the terminal acceptance is.

### 5.3 Reuse the pet settlement seam

Generalize the start of `enterTerminalOutcome` to:

```text
settleMetaRun(accountId, runId, terminalCause, settlementVersion)
  = pet Bond/pity + gear receipts + weapon escrow + Scrip + one revision
```

Use `(accountId, runId, terminalCause, settlementVersion)` as the idempotency key. The transaction closes
escrow before crediting Stash/Intake:

- victory moves every `active`/`pack` entry into Stash until its logical cap, then Intake; deletes `field`
  entries; clears expedition; and returns a bounded `weaponSettlementReceipt`;
- defeat deletes all expedition entries including field stakes, clears expedition, and leaves safe Stash/
  Intake untouched;
- pair entries move or delete atomically;
- pet progress follows its binding outcome rules in the same commit; and
- the outer account revision advances exactly once.

Repeated terminal ticks, cleanup, result refresh, reconnect, or retry return the original canonical account
and receipt. Durable work must be journaled/retried outside the 50 ms simulation step; teardown does not
wait on storage. In local/offline mode, persist the canonical committed reservation at run start and the
terminal receipt before replacing the browser cache.

### 5.4 Co-op and disconnect

Weapon stakes require a stable account-to-run identity; `sessionId` alone is not enough. A transport leave
does **not** call weapon settlement. Preferred launch behavior is a reservation/rebind for the remainder of
the run: keep the body, ledger, pair, and debts; reconnect rebinds a new Colyseus session to them; terminal
results settle even while the client is absent. A deliberate `abandonExpedition` message is distinct and
immediately forfeits only that account's escrow after the exact loss confirmation.

If the pet-waived cheap reservation is not implemented, follow `bank-systems.md` literally: leaving loses
that connection's pending run state and the UI must say so before commit. It must still be an explicit
forfeit transaction keyed by account/run; deleting `PlayerState` in `onLeave` without closing or rolling
back escrow is invalid. A duplicate reconnect may never create another runtime.

Host kick cannot save or destroy somebody else's escrow. Until neutral kick policy and depth consent exist,
bank-enabled public runs should be limited to solo/invited parties. A later personal extraction split is
compatible with per-account reservations; absent that feature, descent should require unanimous committed
consent and timeout toward extraction.

## 6. Bank-aware curator and world-tier hooks

### 6.1 Frozen run-start input

Keep `isDropEligible`/`DROP_POOL`, rarity odds, affix rules, and drop rates unchanged. Add only a final
identity weight. At commit, build one server-private summary per account from safe Stash, staged Carry,
Intake, and both pair members:

```ts
interface WeaponBankCuratorInputV1 {
  accountId: string;
  worldTier: number;
  copiesByWeaponId: ReadonlyMap<string, number>; // each component counts; bounded by account limits
  runIssuedByWeaponId: Map<string, number>;      // private mutable run counter, starts at zero
}
```

For a designated recipient, `n = copiesByWeaponId[id] + runIssuedByWeaponId[id]` and the exact identity
weight is `3.00` at zero copies, `1.00` at one, `0.55` at two, and `0.25` at three or more. Multiply any
authored dimension/class weight, normalize across eligible ids, and choose. Increment the recipient's
issued count when the hidden drop is minted, not when revealed. Rarity and affix do not change breadth;
duplicates never get zero weight; pair components each count.

Current world loot is squad-shared, so rotate the designated recipient deterministically and keep the
pickup owner-locked briefly. Server grab validation and sparse per-client eligibility messages are enough;
do not add public bank ownership or hidden identity to `PickupState`. After the lock expires, ordinary
unowned loot may be grabbed by anyone, but the run-issued count remains on the account whose summary
curated it. Never reread the account on sale, reconnect, or every pickup; next run gets a new snapshot.

### 6.2 World tier

`prestige` is progression World Tier `0..30`. Every minted instance receives the accepted run tier.
Carry readiness requires `runTier >= sourceWorldTier` for every single and
`runTier >= max(member tiers)` for a pair. A co-op progression room runs at least the maximum account tier
and selected Carry requirement in the party. Lower-tier weapons may climb; high-tier weapons never enter a
lower progression room. Training/exhibition cannot mint bank instances or Scrip.

No rarity is locked, no item is downscaled, and tier never changes sale value. The source-tier hook is
eligibility and lobby disclosure only. The global curator should also gain a pure realized-cycle-power
fixture over every legal rarity/affix combination so a same-tier high roll cannot skip a boss's first tell;
that test is balance validation, not another stored field or adaptive enemy scaler.

## 7. Home shop messages and validation

Field `sellWeapon` retires for bankable instances. The between-run home shopkeeper owns this account
transaction:

```ts
interface SellStashEntryMessage {
  requestId: string;
  expectedRevision: number;
  entryId: string;
  from: "stash" | "intake";
}
```

The client never sends price, rarity, affix, quantity, pair members, or Scrip result. The server/account
service:

1. rate-limits and bounds the message, loads/sanitizes the current account, and requires no active
   expedition;
2. compare-and-swaps `expectedRevision` and finds exactly one entry in the named safe location;
3. resolves every component from the closed catalog, requires bankable provenance, and computes
   `scripValue(rarityIndex, true)` per component;
4. removes the single or whole pair, credits the summed payout with the 65,535 cap, clears stale Last Carry
   references, and advances the outer revision once;
5. journals `requestId` so retry returns the same `stashSaleReceipt` and canonical `metaAccount` without a
   second credit.

An illegal/zero-value row is not silently consumed. Discard is a separate confirmed message paying zero.
Selling a pair pays the component sum; unbinding first is optional only when capacity allows. There is no
automatic Intake sale or buyback.

Shelf purchase is a sibling revisioned home transaction with exact costs `60/120/180/240/360/480`, maximum
six, and no effect on Carry. Binding/unbinding uses the same account transaction at home; the authored
in-run outpost bind may operate on carried entries and debit banked Scrip, but the resulting pair remains in
escrow and banks only on victory.

## 8. Prestige reset

`FAREWELL THE ARMORY` is an explicit between-run transaction after the current World Tier's game-clear
receipt. It is never an automatic side effect of victory. The request carries an idempotency token,
expected revision, and the displayed consequence digest; the server recomputes the digest.

The transaction requires no active expedition, then atomically:

1. records the cosmetic Armory Plaque summary;
2. deletes every Stash and Intake entry, both members of every pair, and all Last Carry references;
3. increments prestige/World Tier by one, capped at 30, and grants the next hat slot;
4. retains gear, pets, Scrip, purchased shelf capacity, codex/cosmetics, and other permanent journey state;
5. pays zero Scrip and grants no heirloom, protected favorite, or replacement weapon.

Staged-but-uncommitted UI selection is only references into Stash and disappears with it. A committed
expedition blocks prestige. Because binding ruling #1 disallows an insurance floor, the post-prestige run
starts with fists unless the binding decisions are explicitly amended to allow the systems document's
Home-Issue exception.

## 9. Migration from today's run-scoped bag

There is no persistent weapon array to import from v2. The account migration creates the approved Stash
capacity/shelf state, empty Stash/Intake/expedition, and empty Last Carry. It preserves Scrip, pets, gear,
prestige inputs, and the outer revision through the coordinated gear migration.

Roll out behind a room-creation feature epoch:

- rooms created before the epoch finish under old run-scoped semantics and never emit bank receipts;
- rooms created after it commit account instances and use only the new terminal settlement;
- do not reinterpret an arbitrary browser's last observed `PlayerState.slots`/`bag` as ownership;
- an old live room may convert only `earned=true` slot/bag items on an accepted extraction, stamping them
  `migration-earned`; unearned starter/gallery/conjured entries do not bank;
- remove the unconditional Common cleaver seed for bank-enabled rooms; empty active positions mean fists;
- `PlayerState.slots` and `bag` remain the replicated **view of escrow**, not the account store;
- `earned` becomes a runtime derivation from canonical provenance, not a second persistent truth;
- `cycleWeapon` remains training/non-bank only; and
- resource debt is initialized new at commit and never migrates across account versions or runs.

Inventory handlers migrate together. An instance-aware `copySlot` is prerequisite to enabling bank commit;
there must be no mixed window where grab/drop/bag/pair paths can strip the private id while settlement is
live. Field selling is disabled in the same feature epoch so an old `publishAccountMutation` cannot bank a
mid-run sale.

## 10. Wire and schema cost

The committed landscape is `SCHEMA_VERSION = 27`; dual wield is already the nested schema-27 addition and
`PlayerState` is at Colyseus's direct-field ceiling. This feature **requires no synchronized schema field**:

- public runtime weapon identity already exists in Active/Pack `ArsenalSlot` rows;
- remote active pair identity already resolves through `offhandSlot` and the two rows;
- Stash, Intake, instance ids, provenance, tiers, reservation status, and account revision are owner-private;
  and
- per-copy ids/pair grouping use the private ledger plus sparse owner-only messages.

Protocol additions, none at 20 Hz:

- join option `carry: CarrySelectionV1` (at most 16 physical placements);
- owner-only canonical `metaAccount` after commit/mutation/settlement;
- owner-only `weaponManifest` after join and topology edges;
- owner-only `weaponSettlementReceipt`, `stashSaleReceipt`, and shelf/bind/prestige receipts;
- sparse pickup owner-lock/eligibility messages.

Normal steady-state weapon wire cost is therefore **0 additional bytes per patch**. Full join cost is the
bounded local-trust account claim plus at most 16 placement references; private manifest messages are a few
kilobytes worst case and occur only on topology changes.

Do not reserve “schema 28.” The sibling gear render wave may take the next number for its cosmetic strings.
If implementation later proves a public pair/instance field unavoidable, append it in one coordinated
schema wave after every then-present field and take the orchestrator-assigned next available number at that
wave's launch.

## 11. Implementation waves

| Wave | Scope | Exit gate |
|---|---|---|
| B0 — contract freeze | Resolve section 13, binding starter conflict, Copper Carry cap, account outer version, and stable account/run identity. | Capacities, loss copy, and version ownership signed off. |
| B1 — pure bank/account | Instance/entry/bank types, acquisition catalog, rarity-affix validator, v2/gear migration, size guards, source-tier helpers, sale/shelf/prestige transactions, fuzz/property tests. No schema. | Forged table, cardinality, alias, pair, revision, and migration tests green. |
| B2 — Wardrobe and commit journal | Armory staging, Last Carry, Intake resolution, risk receipt, join payload, revisioned expedition commit, canonical cache replacement, local/authoritative store adapters. | Cancel is no-op; commit is move-not-copy; stale/retry fixtures green. |
| B3 — instance-aware arsenal | Private `RunWeaponLedger`, instance-preserving slot/Pack helpers, pair composite projection, field metadata, replace flow, owner-only manifest, shared-resource initialization. | Every topology permutation conserves exact ids and pair position cost. |
| B4 — terminal/reconnect | Generalize pet settlement into one meta transaction; extraction/win/wipe/abandon/restart/descent matrix; Intake; reservation/rebind or explicit waived-forfeit path. | Every terminal route settles once; down/rez/disconnect matrix green. |
| B5 — curator/tier/economy | Frozen bank summaries, recipient rotation/owner lock, exact copy weights, source-tier lobby promotion, home sales/shelves/bind, world-tier fixtures. | No field cash-out, duplicate weighting exploit, tier smurf, or retry mint. |
| B6 — prestige and hardening | Farewell transaction/ceremony receipt, rolling-room epoch, co-op consent policy, fault injection, size/perf/wire capture, migration soak. | No account loss on fault, no insurance restore, no schema churn, and full e2e approved. |

B1 must coordinate with the gear account wave so only one outer account migration ships. B3 is an exclusive
`GameRoom` window because every arsenal topology helper must move together. B4 lands only after the commit
journal exists; otherwise a terminal callback can destroy data without an idempotent recovery record.

## 12. Test strategy

### Pure data, sanitizer, and capacity

- Golden-test all seven rarity families and every affix; property-test that normal rarities reject every
  cursed affix and Cursed rejects every normal/plain affix.
- Exercise the forged table, prototype-like keys, huge strings/arrays, duplicate ids, cross-location alias,
  future versions, malformed revisions, all tier bounds, and ignored client stats/prices.
- Test 72 plus each `+12` shelf to 144, maximum all-pair Stash, Intake, base 15 and Copper 16 physical Carry,
  pair span, and 192/256 KiB rejection before deep traversal.
- Pair validation covers every real catalog input class, fixed lead/off identity, no reroll, one logical
  Stash entry, two Carry cells, sum sale, and unbind capacity refusal.

### Commit and materialization

- Empty, partial, full, pair-heavy, Last Carry, missing-id outline, overlapping placement, stale revision,
  canceled ready, duplicate request, Intake-blocked, and tier-promoted manifests.
- Assert one instance is in exactly one of Stash/Intake/expedition before and after every operation. Commit
  removes selected entries from Stash before materialization and never copies them.
- Materialization round-trips exact id/rarity/affix/provenance/tier into the existing wire identity, keeps
  instance ids private, projects an active pair through `offhandSlot`, and groups a packed pair as one stop.
- New run resources start canonical; slot/Pack swaps conserve live debt; extraction never persists it.

### Stake ledger and topology

- Found pickup mints once on accepted grab; two unrevealed/duplicate callbacks do not; replace and manual
  drop move to field; re-grab restores; victory excludes field; defeat deletes field and carried alike.
- Every `swapSlot`, `cycleSlot`, `bagStore`, `bagEquip`, grab, replace, drop, salvage/discard, bind, unbind,
  and dev/training boundary conserves or intentionally consumes the exact entry id.
- Pair fixtures cover Active↔Pack atomic moves, joined field drop/re-grab, no half overwrite, two class-set
  contributors, link persistence across extraction, and both members lost on defeat/prestige.
- Co-op tests prove owner-qualified field stakes cannot be mutated by another client and designated loot
  owner locks expire without exposing hidden identity.

### Settlement on every outcome

- Normal extraction, belt victory, final-game victory, boss-rush victory, solo down, squad wipe, explicit
  abandon, active restart, return-home, and future personal-death hook each produce their specified result.
- Rift descent, portal-open, arm/hold start, boss death, XP cleanup, repeated terminal tick, room cleanup,
  and result refresh do not independently settle.
- A downed owner extracts with the squad and banks; down→revive preserves exact ids, pair, locations, and
  debt; down→wipe loses the complete reservation.
- Victory fills Stash then Intake without deletion; full Stash/no Carry plus maximum finds blocks ready
  until resolved. Defeat never touches safe Stash/Intake.
- Pet Bond/pity, Scrip, weapon move/delete, pair cleanup, and revision commit atomically once under the
  shared idempotency key. Inject failure before/after each write and replay the transaction.

### Disconnect, co-op, and faults

- Rebind, if implemented, restores one body/runtime/ledger without reinitializing resources; terminal while
  absent settles once; duplicate reconnect cannot clone it.
- Waived-reservation mode explicitly forfeits on leave and shows the pre-commit warning; raw `onLeave`
  deletion cannot leave a live escrow or safe copy.
- Voluntary abandon differs from transport loss; host leave/kick cannot settle another account. Unanimous
  descent/personal extraction policy is covered before public banked matchmaking.
- Server fault before terminal receipt follows the selected journal recovery policy without inferring
  victory from disconnect or portal state.

### Curator, economy, tier, prestige, migration, and wire

- Per-account copy counts include Stash, staged/committed Carry, Intake, and both pair members; exact weights
  are 3/1/.55/.25; issued count advances at hidden mint; no duplicate ever reaches zero.
- The summary freezes at commit, recipient rotation is deterministic, reconnect/sale cannot reroll it, and
  training mints no instance/Scrip.
- Home single/pair sales pay exact 4/9/18/34/60/60/60 component values once; stale revision, wrong location,
  active expedition, illegal provenance, duplicate request, and Scrip cap are covered. No field sale path
  remains.
- Source tiers 0/30, pair max tier, co-op max promotion, lower-tier climb, high-tier down-entry rejection,
  and no tier effect on stats/sale all have fixtures.
- Prestige requires no expedition, deletes Stash/Intake/pairs/Last Carry, preserves shelves/Scrip/gear/pets,
  increments tier/hat once, records a zero-power plaque, and pays zero.
- v2/gear migration creates no invented ownership; rolling old rooms convert only earned extracted rows;
  old/new room epochs never double-settle.
- Schema remains 27 unless a separately assigned wave adds fields; a two-client capture shows unchanged
  steady patches and owner-private account/manifest/receipt messages only.

## 13. Three implementation questions

1. **Binding conflict and Carry ceiling:** Does ruling #1 remain absolute, removing the systems document's
   protected Home-Issue cleaver in favor of fists plus a guaranteed in-run pickup opportunity? Also confirm
   that shipped Copper Snail makes the hard Carry/Intake ceiling 16 rather than silently retuning it to 15.
2. **Reservation owner:** What stable local account id and journal owns expedition commit/rebind/terminal
   receipts across Colyseus session replacement, and is the pet-waived cheap reconnect reservation required
   for bank launch or does a warned transport leave explicitly forfeit?
3. **Account/version and co-op launch line:** Will gear and banking ship in one outer account migration, and
   are banked runs limited to solo/invited parties until neutral kick plus unanimous-descent/personal-
   extraction policy prevents another client from controlling somebody else's loss?
