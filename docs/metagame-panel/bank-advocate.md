# WEAPON BANKING — Devil's Advocate

**Role:** accept the binding loss ruling and find the implementation shapes that would make it unfair,
fake, or economically self-defeating.

**Verdict: conditional approval.** Weapons can be persistent stakes only if the player chooses the stake.
The faithful reading is a safe between-run **Stash** and a separate **Carried Bag** committed to one
expedition. Death deletes every weapon committed to that expedition. Extraction returns every surviving
carried weapon and every newly carried find to the Stash. Nothing below proposes insurance, a protected
favorite, a recovery token, or a post-death floor.

The rejected reading is “the persistent bank is automatically the run bag.” That makes one wipe erase the
entire weapon history, leaves no loadout decision, and forces the persistent capacity to be no larger than
`BAG_CAP`. It is a streak inventory, not a bank. “All **carried** weapons” has useful force only when some
owned weapons were deliberately not carried.

---

## 1. The bank and the bag must be different nouns

Use these names and sizes in schema, menus, telemetry, and player copy:

| Container | Launch size | In the run | Lost on terminal defeat |
|---|---:|---|---|
| **Stash** | **48 weapon instances** | No; account-private between runs | No |
| **Active slots** | **3** | Yes | Yes |
| **Carried Bag** | **12** (`BAG_CAP`) | Yes; any entry can be dragged into an active slot | Yes |
| **Extraction Tray** | Temporary overflow only | No next embark until resolved | No; extraction already succeeded |

The maximum exposure is therefore **15 weapons: 3 active plus 12 in the Carried Bag**. Empty active and
bag slots are legal. Forty-eight is a launch target, not a monetization surface: it is four bagfuls, large
enough to maintain distinct builds and replacements but small enough that duplicates still create a sell
decision. A successful extraction that would exceed 48 puts the excess into an Extraction Tray; the player
must move, sell, or discard items before embarking again. “Extraction keeps everything” is never resolved
by silently deleting overflow.

The existing Copper Snail can make the run bag 13. If that capstone remains, the UI and all risk math must
say **13**, and the maximum exposure is 16. Otherwise retune the pet. Calling the bag “12” while one account
silently carries 13 is exactly the sort of exception that breaks settlement and capacity tests. Gear,
prestige hats, and paid upgrades must not expand either container.

### The run-start transaction

Ready-up performs one atomic move, not a copy:

```text
Stash --commit selected instance ids--> Expedition Escrow
Expedition Escrow --terminal extraction/victory--> Stash + extracted finds
Expedition Escrow --terminal defeat/forfeit--> deleted
```

The escrow is the authoritative definition of **carried**. Slot and bag placement are run-time views of
those same instance ids. A weapon cannot exist in Stash and escrow at once. A retry, reconnect, duplicate
terminal message, stale browser tab, or result-screen refresh must replay the same idempotent settlement,
not copy or delete the set twice.

### Bringing all twelve is sometimes rational, and that is fine

Every reserve weapon adds a counter, another full resource ledger, and another chance that a swap prevents
a wipe. For a veteran with a low estimated wipe rate, filling all 12 bag cells can be rational. It also:

- exposes twelve more item values to the same terminal loss;
- consumes every collection slot, so a new find requires a sale, floor drop, or replacement;
- makes the total-at-risk number grow while the marginal tactical coverage shrinks; and
- denies those instances to a second build safely waiting in the Stash.

That is the intended loadout decision. Do not add auto-fill, “best 12,” or a default that carries the whole
Stash. The embark screen should start from Last Carried, visibly mark every selected card **AT RISK**, show
`3 active + N bag = N+3 weapons exposed`, show aggregate sell value only as a warning rather than an
insurance promise, and require a fresh confirmation after adding a high-tier or paired item. Remembering a
loadout is convenience; silently replacing a missing instance from the Stash after a wipe is insurance and
is forbidden.

---

## 2. Co-op death is a terminal settlement, not `alive = false`

Today `PlayerState.alive = false` means **downed and revivable**; the body and arsenal remain, and the run
ends only when no player is still up (`GameRoom.ts` around the down/wipe path). Weapon banking must not
reuse that Boolean as an account-deletion edge.

| Event | Weapon settlement |
|---|---|
| Player is downed | None. Escrow, active slots, bag, pair, and ledgers remain intact. |
| Player is revived | Resume the same run inventory. No refill, copy, or re-import from Stash. |
| Squad extracts or wins, including a downed member | Settle victory once; all participants' carried and newly acquired weapons bank. Extraction keeps everything. |
| Squad wipe / authoritative terminal defeat | Delete every participant's full escrow, active and bag alike. |
| Explicit **Abandon Expedition** | Show the exact 15-or-fewer doomed instances, require confirmation, then settle as defeat. |
| Transport disconnect | No settlement. Keep a durable reservation and permit rejoin. The later authoritative run result decides it. |
| Server fault with no terminal receipt | Roll back the commit from the journal. Infrastructure failure is not game death. |

The current `onLeave` deletes the player and its run maps immediately. That behavior cannot own a
persistent stake: disconnecting would either save weapons by removing the participant before a wipe or
destroy them because Wi-Fi blinked. The account needs a reconnectable expedition reservation independent
of the live Colyseus player row.

Local/offline trust cannot distinguish a process crash from a dashboard quit. Prefer safe journal rollback
when no terminal result exists; the local-trust model is already save-editable, while deleting a legitimate
bank after a crash is permanent support debt. Public authoritative rooms can treat the explicit abandon
message as forfeit and ordinary transport loss as a reservation.

### The teammate-feeding rage vector

No settlement rule can make a shared wipe feel personal when one stranger intentionally stops playing.
The stakes make existing co-op shortcuts much more dangerous:

- one living player must not be able to commit the whole squad to a deeper dimension;
- a host kick must not be able to delete another account's escrow;
- being disconnected or downed must not make a player disappear from terminal settlement; and
- no player may sell, drop, pair, or overwrite another player's persistent instance.

Before high-value public matchmaking, the game needs a pre-run risk card per player, explicit ready locks,
a reconnect reservation, and a post-boss decision in which non-consent defaults to extraction. The clean
policy is personal extraction at the gate: consenting players may form the continuing party, while everyone
else banks and exits. If party splitting is out of scope, deeper descent must require unanimity and time out
to extraction; a single “continue” channel is not informed consent. Mid-run host kicks should be disabled
or handled only by neutral server policy, because both “kick saves” and “kick destroys” are exploitable.

Until those controls exist, persistent-bank runs belong in solo and invited parties, not anonymous public
rooms. This is not insurance. It is preventing another client from having account-deletion authority.

---

## 3. Pair links need instance identity across runs

The current dual-wield pair is a run link from an active slot to another occupied slot. Slot indices are
not durable identities, and two copies of the same weapon definition are not interchangeable once rarity,
affix, provenance, and resource debt differ.

Use a stable, opaque `weaponInstanceId` for every copy. A pair is a symmetric account relation between two
instance ids, never between definition ids and never between slot numbers.

- **Binding persists** in the Stash and through successful extractions. A paid shop service should not
  evaporate merely because a run ended.
- The player may carry one half alone. It behaves as a solo weapon; the pair link is dormant, which
  preserves choose-what-to-risk.
- Carrying both halves permits activation only when both occupy legal active slots. The existing law still
  applies: an off hand is another of the three slots, never a free fourth weapon and never a bag weapon.
- If one half is lost on defeat, sold, discarded, or consumed by prestige, the surviving half is
  atomically unbound. There is no refund and no dangling id.
- If both halves are carried, defeat deletes both because both were carried. If one stayed in the Stash,
  that survivor remains but loses only the relationship.
- Unbind remains free. No flow may duplicate a pair fee, resource row, or off-hand card by moving either
  half between Stash, bag, and slot.

Cooldown, reload, charge, heat, and the new shared-resource state are **run ledgers**, keyed by instance id
while the expedition is live. They are not durable weapon attributes. Every committed instance starts a
new run at the canonical full/ready state, then keeps its own debt through bag and slot moves. Extraction
does not serialize half-cooled beams into the account, and reconnect restores the live run ledger rather
than reinitializing it.

---

## 4. Persistence deforms the drop and Scrip economies

The current drop curator proves only that a base weapon definition sits in a broad class power band, then
rolls uniformly from `DROP_POOL` (`packages/shared/src/loot.ts`). It does not know that an account already
owns six better copies, and its power check does not include the rolled rarity/affix combination. That is
adequate for run-scoped loot. It is not adequate for a persistent item economy.

### Day-ten drop blindness

A veteran who can bring a Blessed, Ultimate, or Legendary answer for several classes will treat most
Common drops as floor litter. More definitions do not solve that; they increase the number of nominally
new but dominated cards.

Keep the global eligibility gate, then add an owner-aware weighting pass using a **run-start snapshot** of
that player's Stash plus escrow:

1. Rotate a designated recipient for each personal weapon receipt.
2. Up-weight missing weapon identities and meaningful class/behavior gaps.
3. Compare the realized instance, including rarity and affix cadence, with that recipient's best relevant
   stored copy; down-weight dominated duplicates but never reduce them to zero.
4. Give the receipt a short owner lock. A bank-curated shared pickup that a different player can take was
   curated against the wrong account.
5. Do not reread the account after every sale or reconnect. That creates deterministic reroll exploits and
   makes two clients disagree about the pool.

Novelty is not enough; a new Common knife can still be trash beside an Ultimate knife. Conversely, a
duplicate definition with a different affix may be the real upgrade. The curator therefore needs compact
bank summaries such as best realized power per definition and class, not just an owned-id set. It must
remain a weighting system, not guaranteed best-in-slot delivery.

### Scrip can bypass both loss and progression pacing

Current earned-weapon sale values are `4 / 9 / 18 / 34 / 60` by rarity. Twelve bag entries therefore
represent **48 to 720 Scrip**, or **60 to 900** across the full 15-weapon exposure, before pet sale bonuses.
Those numbers were tuned around a run-scoped haul and the old shop. They cannot be inherited unchanged
after weapons, Scrip, gear, and pets all persist.

Two separate failures need blocking:

1. **Mid-run mini-extraction.** If selling a carried weapon immediately increments permanent Scrip, a shop
   lets the player cash out the stake before the dangerous room. Mid-run proceeds must be provisional run
   Scrip and bank only on extraction/victory; defeat deletes the provisional balance. A sold instance is
   still gone from escrow immediately, so it cannot be used after sale.
2. **Stash replay printing.** A Stash sale must atomically tombstone one instance id and credit Scrip once
   under an account revision. Retrying the request returns the original receipt. A stale tab cannot sell the
   same id again, extraction cannot resurrect it, and pair cleanup belongs in the same transaction.

Selling an already extracted Stash weapon once is a valid irreversible conversion, not an exploit. The
faucet becomes a problem when sale yield overwhelms permanent gear/pet sinks, when a field shop banks it
early, or when local rollback repeats the conversion. Balance Scrip against expected **extracted instances
per hour**, not raw drop count, and publish the sink/source budget before retaining today's values.

---

## 5. Persistent high rolls create a difficulty ratchet

Rarity and affix multiply each other. The current global power curator evaluates the base definition, while
an Ultimate or favorable Cursed affix can turn the realized copy into several times the base stream. Once
that roll persists, early dimensions are no longer balanced against the drop pool's median; they are
balanced against the best roll the account has ever preserved.

Use two bounds rather than silently weakening the weapon:

- Every instance stores a server-derived `minimumWorldTier` from the world tier in which it was earned.
  Embarking with it selects at least that tier. In co-op, the highest carried minimum is the lobby's tier,
  shown before ready-up. A high-tier weapon cannot smurf downward.
- The curator and balance fixtures evaluate **realized cycle power** after rarity and affix, not definition
  power alone. Within a world tier, a great extraction may make the next opening dimension easier; that is
  the earned victory lap. It must remain a bounded advantage, not an order-of-magnitude skip.

Do not downscale a card behind the player's back, and do not make every enemy continuously match the best
weapon; both erase the pleasure of extracting it. Broad world tiers, visible lobby promotion, bounded item
multipliers, and the prestige reset are enough. If a same-tier Legendary still deletes an early boss before
its first tell, the rarity/affix envelope failed its fixture.

---

## 6. Weapon accounts are not pet accounts with a larger array

The pet account stores closed species ids and bounded XP integers. A weapon account stores duplicate
instances with definition identity, rarity, affix, provenance, tier, pair topology, location, and a live
expedition transaction. It needs a separate versioned surface even if it shares the same local/offline
trust posture.

Recommended durable shape:

```text
WeaponInstance = {
  instanceId, definitionId, rarityId, affixId,
  originKind, minimumWorldTier
}

WeaponBank = {
  version, revision,
  stash[0..47], extractionTray[],
  pairLinks[{aInstanceId, bInstanceId}],
  expeditionReservation { runId, commitRevision, instanceIds, status }
}
```

The account never stores damage, cooldown, price, tags, art paths, computed power, resource level, or pair
bonuses. The server derives those from closed catalogs. The whole Stash is owner-private and must not be
added to `PlayerState`; only the selected run instances need replicated public presentation fields. This
avoids broadcasting account history and inflating a player schema already carrying the three slots, bag,
dual state, and combat presentation.

### Honest sanitization posture

The sanitizer must reject or repair all of the following before a run can ready:

- unknown definition, rarity, affix, origin, or tier ids;
- rarity/affix combinations outside the closed loot rules;
- duplicate instance ids, excessive cardinality, invalid strings, and impossible numeric ranges;
- an id present in two locations, in two expeditions, or in both Stash and escrow;
- self-pairs, multi-pairs, unknown pair members, illegal weapon families, and dangling links;
- client-authored stats, prices, computed power, resource values, or sell eligibility; and
- a stale revision attempting to overwrite a newer terminal or sale receipt.

This produces a bounded, internally consistent payload. It does **not** prove that a structurally valid
Brutal Ultimate was earned. Under local trust, a player can forge 48 legal legendaries, edit Scrip, or
roll back a sale. No clamp, checksum, obfuscated local storage, or instance-id format changes that fact.

The product must choose its claim honestly. Offline and invited play may be honor-based and modifiable,
with competitive records explicitly unverified. Public progression, trading, leaderboards, or matchmaking
that promises earned banks requires an authoritative account store and server-issued acquisition and
settlement receipts. Do not advertise the pet-style sanitizer as anti-cheat merely because forged payloads
no longer crash the room.

---

## 7. Empty Stash is a real game state

A new player and a player immediately after a total wipe or prestige have no bank. A recurring free weapon
placed directly into the Stash would be the forbidden insurance floor. Starting with only unusable fists,
hidden bag controls, and ordinary random drop timing would instead make the first lesson feel like a bug.

The empty-Stash expedition needs an authored path:

- fists are fully viable for the onboarding room, with the same resource-bar teaching as weapons;
- the first low-pressure combat beat guarantees a visible Common weapon **pickup opportunity** from a
  small tutorial pool, with one sentence explaining that it is now carried and at risk;
- the first post-boss choice explicitly contrasts **Extract: bank this weapon** with **Descend: keep risking
  it**; and
- after a wipe, the Stash screen says `No banked weapons — embark with fists` and never implies corruption
  or auto-restores Last Carried.

The guaranteed opportunity is access to the stakes, not retention. It can be lost in that same run and it
does not reappear in the account. This flow also repeats cleanly after prestige without inventing a
protected starter heirloom.

---

## 8. Prestige should reset the bank, deliberately

Endorse the sketch and remove “may”: **committing a prestige resets every weapon instance.** Otherwise the
new difficulty tier begins with the previous tier's best persistent rolls, the early-tier difficulty gate
does nothing, and the hat is granted without renewing the weapon stakes.

Prestige must be an explicit between-run action after beating the game, not an automatic side effect of
the victory receipt. The confirmation shows the Stash, Extraction Tray, dormant pair links, and total item
count that will be erased. On commit, one transaction:

1. verifies that no expedition is live;
2. increments prestige and world tier and grants the hat slot;
3. deletes Stash instances, tray overflow, and all pair links;
4. retains gear, pets, Scrip already banked, weapon codex/discovery history, and cosmetic records; and
5. starts the next tier at Empty Stash.

There is no reset compensation, buyback, mailed favorite, or carry-one exception. Selling weapons before
prestige is allowed because it irreversibly gives up their combat power; the reset itself does not mint
Scrip. Keeping codex history preserves the collection memory without weakening the new tier's stakes.

---

## Hard guardrails

| # | Guardrail | Required proof |
|---:|---|---|
| B1 | Choice defines risk | Only selected instance ids enter escrow; no auto-fill or whole-Stash embark path |
| B2 | Exact exposure | Three active plus `BAG_CAP` reserve are carried and all are deleted on terminal defeat |
| B3 | Extraction is absolute | Every carried/found instance returns; overflow enters a blocking Extraction Tray, never deletion |
| B4 | No insurance by convenience | Wipe never restores Last Carried, a favorite, one Common, a pair half, or a replacement copy |
| B5 | Down is not terminal | `alive=false`, revive, spectate, and downed extraction cause no defeat settlement |
| B6 | One terminal receipt | Defeat, extraction, abandon, sale, reconnect, and retry are revisioned and idempotent |
| B7 | Disconnect cannot decide ownership | Run reservation survives the live player row; no `onLeave` bank mutation |
| B8 | Other clients lack deletion authority | No unilateral descend, host kick, trade, sell, or drop path can destroy another account's instances |
| B9 | Instance identity is canonical | Duplicate definitions have unique ids; locations are mutually exclusive; run ledgers key by instance id |
| B10 | Pair topology cannot dangle | Links persist on success and atomically unbind when either exact instance disappears |
| B11 | Resource debt stays run-scoped | Bag/slot swaps and reconnect restore debt; new runs never import or duplicate old resource rows |
| B12 | Curator sees the intended owner's bank | Weighting uses a run-start summary and realized rarity/affix power; targeted loot has an owner lock |
| B13 | Shops are not extraction portals | Mid-run sale proceeds are provisional and lost on defeat; Stash sales consume one id once |
| B14 | High-tier weapons cannot smurf | Carried minimum tier promotes the run and is disclosed before every player locks ready |
| B15 | Local trust is labeled honestly | Sanitization claims structural validity only; no earned-bank, trade, or leaderboard promise without authority |
| B16 | Prestige renews stakes | Commit clears every weapon instance and pair link, retains the permanent journey, and grants no compensation |

**Kill criteria for the implementation shape:** stop and redesign the bank transaction if one instance can
appear in Stash and a live run, if a disconnect changes loss outcome, if a mid-run sale banks permanent
Scrip before extraction, if a stranger can commit another player's bank to deeper risk, or if the product
claims that sanitizing a client-authored legendary proves it was earned.

---

## Three implementation questions

1. **Will the launch contract adopt Stash 48, active 3, Carried Bag 12, and a blocking Extraction Tray?**
   Recommended: yes, with Copper Snail either declared as the sole 13th-bag exception or retuned before the
   capacity schema is frozen.
2. **Which durable service owns expedition reservations and co-op terminal receipts?** Recommended: a
   revisioned journal outside the live player row, with explicit abandon as defeat, transport loss as
   reconnectable, fault-without-receipt as rollback, and non-consent at a depth gate defaulting to personal
   extraction.
3. **Is a forged but structurally valid weapon bank acceptable in public co-op?** Recommended: answer yes
   only if the mode is visibly honor-based and unverified; otherwise authoritative acquisition, sale, and
   settlement receipts are a launch dependency, not a later anti-cheat enhancement.
