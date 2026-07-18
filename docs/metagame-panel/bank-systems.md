# Weapon banking — what stays home, what goes over the edge

Status: systems specification. `DECISIONS.md` is binding. No `bank-advocate.md` is present in this checkout, so there is no advocate-specific world-tier proposal to adopt; the narrow tier gate below answers the persistent-power problem without locking a lucky weapon the player legitimately extracted.

The ruling is literal: **the Stash is safe because it is absent; the Carry is useful because it is at stake.** A run never has remote access to the Stash. Death never reaches backward into it, and extraction never happens early because a player disconnected, sold an item, descended, or touched an open portal.

## 0. Shipped facts this design replaces or extends

- The live arsenal has **3 active slots** and a base **12-item bag**. `1/2/3` and `Q/E` change the active weapon; a bag weapon can be moved into any slot mid-run.
- The live starter is `rusty-cleaver`; `fists` are the zero-slot fallback. New players currently receive one Common/plain, unearned cleaver in slot 1.
- An earned weapon carries a base id, one of **7 rarities**, exactly one affix, and earned provenance. The current sale table is **4 / 9 / 18 / 34 / 60 Scrip**; because the table has five entries, Legendary, Ultimate, and Cursed all currently pay 60.
- Current enemy weapon-drop chances are **1.2% trash**, **5.5% tough**, and **100% boss**. The drop curator first excludes fists, rez weapons, and expansion outliers outside **0.60–2.20×** their class median, then chooses uniformly from the survivors.
- Current HP-zero is **DOWNED**, not item-destroying death. A downed body keeps its arsenal; a Spade swing within **96 px** revives the nearest eligible ally at **30% max HP**. Only a solo down or every squad member being down produces `outcome="defeat"`.
- A live bound pair links **two occupied active slots**. It alternates at `0.72×` the incoming hand's cooldown, is capped at **1.37×** lead throughput (**1.45×** for a matched family), and contributes the same two slot ids to the existing +8%/+18% class set count. Banking must not erase that two-slot cost.

The persistent weapon account does not exist in today's code. The following is the target law, not a claim that the current local Scrip payload already provides it.

## 1. The Stash and the Carry

### 1.1 One weapon instance

A bankable weapon is one server-minted instance:

```text
instance id · base weapon id · rarity · affix · earned provenance · source world tier
```

Rarity and affix survive banking. Combat cooldown, resource-bar fill, and transient effects do not; a new run starts every carried weapon at the authored run-start resource state. Durability, charges, and per-weapon ammo are retiring under the binding shared-resource ruling and are not new persistence fields.

### 1.2 Stash capacity

The home Stash begins at **72 logical entries**: six shelves of 12, deliberately generous relative to a 15-position expedition. The shopkeeper sells six permanent shelf additions of **+12 entries** at **◈60, ◈120, ◈180, ◈240, ◈360, and ◈480**, for a maximum Stash of **144 entries**. Purchased shelves survive prestige because they are home infrastructure, not weapon power.

- A single weapon uses 1 Stash entry.
- An exact duplicate uses another entry. The UI may collapse identical rows and show `×3`, but all 3 instances still consume capacity and can be lost independently.
- A bound pair uses **1 Stash entry**, while retaining both component instance ids.
- The protected starter blade uses **0 Stash entries**.
- Stash capacity never deletes an accepted extraction. If extraction would exceed the cap, up to that run's **15 logical returns** sit in a persistent `INTAKE` tray. The account cannot ready another run until it sells, discards, binds, or makes room for every Intake entry.

Stashed means unavailable. No shop, rift, teammate, death state, or backpack button may pull an item from home after the run commits.

### 1.3 Carry capacity

The Carry is the exact run manifest:

- **3 active positions**;
- **12 backpack positions**;
- therefore at most **15 physical weapon positions** at risk.

A bound pair remains one identity but contains two physical weapons, so it spans **2 active positions** when equipped or **2 backpack positions** when packed. It appears as one joined card and one `Q/E` stop. This preserves today's cost: an active pair leaves only 1 active position for a spare, and binding cannot inflate 15 positions into 30 weapons.

Empty active positions are legal and mean fists. The issued starter may occupy one active position but never a backpack position; replacing it simply sends that run's issued copy away rather than creating a sixteenth carry position.

### 1.4 Wardrobe flow

The existing between-run Wardrobe gains an `ARMORY` tab beside outfit and companion selection:

1. **STASH** is the left rail, showing `Safe at home: N / 72–144`. Filters are base type, class, rarity, affix, pairable, and duplicate.
2. **ACTIVE 1–3** and **PACK 0/12** are the right rail. Dragging from Stash only stages a manifest; the instance remains safe until run commit. A pair can enter Active only if 2 positions are available.
3. The center summary always states component count and current face value: `AT STAKE · 7 weapons · ◈129` and `SAFE · 41 entries`. The starter is labeled `HOME ISSUE · ◈0 · RETURNS` and is excluded from the at-risk count.
4. `Last Carry` remembers exact instance ids for convenience, independently of the six gear presets. A lost or sold instance becomes a visible empty outline; the game never silently substitutes another rarity, affix, duplicate, or pair half.
5. `[Enter] Ready` opens one concise risk receipt whenever the manifest changed. Hold for **0.75 seconds** to accept it. Canceling ready or leaving the lobby before commit changes nothing.
6. **Commit** is the server's accepted expedition-start transaction, not the first click on Ready. At commit, all selected instances move atomically from Stash to a run escrow keyed by account and run. From that instant they are Carried and at stake.

The three active weapons remain the primary play grammar. During the run, any backpack weapon can still be dragged into Active. That changes where it is carried, never whether it is at risk.

## 2. Death, extraction, and disconnect law

### 2.1 Terminal definitions

| Event | Weapon result |
|---|---|
| HP reaches 0; `alive=false` | **Downed only. Lose 0.** Body and full Carry remain in run escrow. |
| Revived | Resume with the same Carry; the current baseline is 30% HP at 96 px. |
| Solo player downed | This is also a squad wipe: run loss, so delete that player's entire Carry. |
| Every squad member down simultaneously | `outcome="defeat"`: delete every participant's entire Carry. |
| Squad extracts while an owner is downed | Bank that owner's Carry with everyone else's. Downed is not permanent death. |
| Explicit future personal perma-death state | Delete that owner's entire Carry when the server commits the irrecoverable state; other players continue. No such personal state exists today. |
| Intentional abandon, active-run restart, or return-home after commit | Run loss for the abandoning manifest; no weapon is banked. A host action cannot launder the squad's Carry. |
| Deeper rift | **No bank.** The existing 1.6-second descent carries the same manifest and all found weapons deeper. |
| Accepted extraction or terminal game victory | Atomically return all still-Carried instances, including found ones, to Stash/Intake. |

“Lose everything Carried” means all 3 active positions, all 12 backpack positions, and every owned weapon instance currently lying on the run's field because its owner dropped or swapped it out. There is no best-three rescue, random survivor, insurance fee, corpse recovery, or post-loss buyback. The issued starter is the sole exception described in §8; it is not a bank instance.

### 2.2 When extraction is real

Portal-open is not extraction. In the current production route the gate has a **90 px** radius, arms for **0.8 seconds**, and then requires a living player to hold it for **0.75 seconds**. Only the server's accepted terminal extraction after that sequence settles weapons. Boss-rush or final-game victory routes that end directly in `victory` use the same settlement transaction.

One living player can complete the squad extraction. Settlement includes every still-participating or validly reserved account, whether living or downed; a downed player does not need to crawl into the circle. An unclaimed mystery drop, or a weapon deliberately left on the field, is not Carried and does not bank.

Settlement is idempotent on `(account id, run id, terminal result)`. It first closes the run escrow, then writes Stash/Intake. A retry may finish the same write but cannot create a second copy.

### 2.3 Disconnect follows the pet precedent

Disconnect is never extraction.

- Before expedition commit, disconnect has no weapon consequence.
- A consensual leave after commit is immediate abandon and loses that account's Carry.
- For an accidental disconnect, use the pet ruling exactly: if reservation/rebind is cheap, reserve the exact player body, Carry, and run escrow for the **remainder of that run**. Rejoin restores the same state; it neither banks nor refreshes anything. If the squad extracts while the reservation is valid, that account settles like a downed player.
- If reservation machinery is not available, the abandoned connection loses its pending run state. Today's `onLeave` deletes the player immediately and has no reservation; until that changes, the honest UI warning is `Leaving this run loses N carried weapons`.
- A dimension checkpoint or server recovery may resume the run escrow. It may not copy the escrow into Stash “for safety.” If recovery cannot resume and no reservation survives, the Carry is lost, matching the waived pet rejoin-settlement.

This is harsh but non-exploitable: killing the client, losing Wi-Fi, reconnecting twice, and replaying a settlement callback can never turn one carried instance into a safe copy plus a live copy.

## 3. Found weapons: useful immediately, at stake immediately

The current mystery reveal remains: type and rarity are readable on the ground; base identity and affix reveal on accepted pickup. The banking change begins at that accepted pickup:

1. A found weapon takes the first open Active position, then the first open Pack position. It becomes Carried immediately and receives a unique instance id and the run's world-tier stamp.
2. If all 15 physical positions are full, pickup opens a non-pausing replace choice for the nearest candidate: `Replace one carried entry` or `Leave`. A pair requires 2 free/replaced positions and is never produced by the curator.
3. Replaced or manually dropped weapons remain field stakes. They bank only if somebody is carrying them when extraction settles; otherwise they are lost with the field.
4. A found weapon cannot be sent home, mailed, converted to Scrip, or “marked for extraction” from inside the run. An outpost shopkeeper may bind eligible carried singles, but may not sell them.
5. Extraction returns the starting Carry and every kept find. A wipe deletes both categories identically. `Found` is provenance, not insurance.

The pressure happens twice: in the field, decide what deserves one of 15 positions; after extraction, decide what deserves Stash space versus a finite sale. There is no risk-free mid-run cash-out.

## 4. Economy and the bank-aware curator

### 4.1 Identity weighting

The existing eligibility gate remains. Fists and rez/support weapons still do not roll; expansion weapons still need effective power inside **0.60–2.20×** their class median. Current drop-rate and rarity rolls also remain **1.2% / 5.5% / boss-guaranteed** and independent of Stash size.

Only the final base-id choice changes. At run commit, the server counts each base weapon id across safe Stash, staged Carry, Intake, and both halves of every pair. The protected starter makes `rusty-cleaver` known once but is not a saleable copy. Let `n` be that count plus copies of the id already issued by the current run:

| Copies `n` | Curator identity weight |
|---:|---:|
| 0 | **3.00×** |
| 1 | **1.00×** |
| 2 | **0.55×** |
| 3 or more | **0.25×** |

The server increments the run-issued count when it mints the hidden drop, not when the player reveals it, so two unrevealed drops cannot both claim the 3.00× discovery weight. Other authored dimension/class weights multiply normally. Thus an unseen eligible id is 3× as likely as a one-copy id and 12× as likely as a three-copy id, but duplicates never reach zero.

The curator reads current breadth, not a permanent codex flag. Selling or losing the last copy makes that id eligible for 3.00× again next run. Rarity and affix do not affect breadth; three variants of one base id are still `n=3`. Pair compression never fools the count because both components are counted.

### 4.2 Sale table and location

Only a weapon that has completed extraction and now exists in safe Stash/Intake may be sold, and only through the **home shopkeeper**:

| Rarity | Scrip |
|---|---:|
| Common | **4** |
| Uncommon | **9** |
| Rare | **18** |
| Really Rare | **34** |
| Legendary | **60** |
| Ultimate | **60** |
| Cursed | **60** |

This deliberately preserves today's `SCRIP_BY_RARITY` behavior; affixes do not change sale price. Scrip remains capped at **65,535**. A sale removes the exact instance and credits the account in one revision. There is no field sale, automatic overflow sale, death payout, prestige payout, duplicate-to-Scrip toggle, or buyback.

The anti-printer laws are mechanical:

- only server-minted, earned instances have positive value; starter, training, gallery, preview, debug, and invalid migration records pay **0**;
- extraction records each instance id once;
- sale consumes that id once;
- binding and unbinding preserve both component ids and mint **0** Scrip;
- discard, wipe, and farewell consume instances for **0**;
- reconnect and transaction retries reuse the original run/sale key.

Duplicates therefore have three honest uses: keep a backup for a future death, carry a differently rolled rarity/affix, or extract and sell the finite instance. Hoarding never generates a periodic dividend.

## 5. Bound pairs are one loss identity

Keep today's eligibility and combat model: the two weapons must be different ids, genuine `grip:"1H"` weapons of the same `classPool` and live delivery; fists, thrown weapons, beams, authored duals, mismatched classes, and cross-delivery combinations are refused.

Binding still costs the better half's current sale value: **4 / 9 / 18 / 34 / 60 Scrip**, with no refund. Unbinding is free. Both are shopkeeper services; an in-run bind operates only on two Carried singles and the resulting pair is immediately at stake.

Persistence refines the live slot link into an atomic composite:

- The pair stores lead instance id, off-hand instance id, both rarities, both affixes, both provenance flags, and both source tiers. It rerolls nothing.
- It occupies **1 Stash entry** but **2 Carry positions**. In Active those are the existing lead and `offhandSlot`; in Pack the card spans 2 cells.
- It remains one `Q/E` stop and one death/drop/extraction transaction. A wipe deletes both halves. Extraction banks both. A field drop drops the joined pair, not a safe off-hand.
- Its minimum allowed run tier is the higher of its two source tiers.
- Curator breadth and the active class set bonus see both component weapons, exactly as today's two occupied slots do.
- Selling the composite pays the sum of its two legal component values. Example: a Legendary earned lead plus Rare earned off-hand pays **◈78**. The bind fee is not returned, so bind/sell cycling is strictly lossy.
- Unbinding needs 1 additional free Stash entry or 1 additional free Carry position, depending on location. If there is no room, it is refused rather than spilling or deleting a half.

Pairs never drop from the curator. They remain player-authored commitments made from two real single-weapon instances.

## 6. World tiers: endorse a source-tier gate, reject rarity locks

Hard rarity gating is not endorsed. If a World Tier 0 player beats a boss, extracts an Ultimate, and is then told the item cannot be used until two prestiges later, extraction has lied. Within the current tier, accumulated and losable weapon power is the intended reward.

Use a narrower law:

- Prestige count `P` sets the account's progression **World Tier P**, from **0 to 30**.
- Every found weapon is stamped with the run's tier `T`.
- A banked instance may enter a run only when `selected run tier >= source tier`. Lower-tier weapons may climb; higher-tier weapons cannot be brought down to flatten early difficulty.
- A pair uses `max(sourceTierA, sourceTierB)`.
- A co-op progression run uses at least the highest account tier in the party and the highest selected Carry requirement. Lower-prestige friends may bring their lower-tier bank upward; a high-prestige account cannot smurf its bank downward.
- Training or an explicitly lower-tier exhibition may provide the issued starter and gallery weapons, but mints **0 bankable weapons and 0 Scrip**.

The prestige bank reset in §7 does most of the balance work: old-tier Ultimates do not cross the ascent at all. The stamp is defense in depth for co-op, recovery, migrations, and any future lower-tier replay. It changes eligibility only—never damage, rarity, affix, or sale value.

## 7. Prestige: farewell to the armory

Endorse the sketch's weapon-bank reset. Gear and pets are the real journey; an ever-growing inherited armory would make the next difficulty tier begin solved.

After beating the game at World Tier `P`, the result screen offers **FAREWELL THE ARMORY**. Prestige is optional until confirmed. The confirmation names all consequences and requires a **2-second hold**:

```text
WORLD TIER P → P+1
HAT SLOTS +1 (maximum 30)
WEAPON ENTRIES LOST: N
SCRIP PAID: 0
GEAR, PETS, SCRIP, AND ARMORY SHELVES KEPT
```

The ceremony lasts about **8 seconds**: up to 12 favorite/highest-tier entries mount on the paper armory wall, remaining entries collapse into a `+N` rack, pair silhouettes cross as one plaque, and the whole wall tears upward into the new spring-linked hat position. The account keeps a cosmetic Armory Plaque recording prestige number, weapon-entry count, distinct base-id count, highest rarity, and favorite weapon by run-use time. The plaque grants **0 stats, 0 Scrip, and 0 future drop weight**.

Confirmation atomically:

1. deletes every Stash, Intake, and staged weapon instance, including both halves of every pair;
2. clears `Last Carry` weapon references;
3. increments World Tier by 1;
4. grants the binding **+1 hat slot**, up to 30;
5. retains gear, pets, Scrip, purchased Stash capacity, cosmetics, and the protected starter.

There is no heirloom weapon, rarity carry-over, insurance token, mass-sale receipt, or “choose one to keep.” A player may deliberately sell finite instances before confirming prestige, but the ceremony itself never converts a hoard into currency.

## 8. First session: fists and one blade

The new account begins with:

- Stash **0/72**;
- Active slot 1: a Common/plain **Home-Issue Rusty Cleaver**;
- Active slots 2–3 empty;
- Pack **0/12**;
- fists always available by clearing or dropping the active weapon.

The Home-Issue blade is the one explicit exception required by the first-session ruling. It is a reusable baseline entitlement, not a weapon-bank instance: sell value **0**, Stash cost **0**, source tier **0**, no binding, no duplicate conversion, and no prestige deletion. If dropped or replaced, it may be gone for the rest of that run, but the Wardrobe can issue exactly one fresh copy next run.

An earned `rusty-cleaver` drop is still a normal, separate instance with normal rarity/affix, Stash cost, risk, and sale value. The curator treats the baseline id as already known once so it does not overweight the same cleaver as a first discovery.

This is the **fists-and-one-blade floor**, not insurance: after a wipe the player gets none of the 1–15 banked weapons they chose to risk back. They get only fists, the weakest Common/plain issue blade, permanent gear, and their pet—the stable journey from which another armory can be built.

## 9. Worked outcomes

- A player owns 40 Stash entries, stages 3 active and 6 backpack singles, and commits. **31 entries are safe; 9 weapons are at stake.** They find 4 more, for 13 carried. A solo down deletes all 13; the 31 at home remain.
- Two players commit. One is downed carrying 7 weapons; the other completes the accepted portal hold. All 7 bank for the downed player, because `alive=false` was recoverable and the squad reached victory.
- A pair made from a Rare and a Legendary occupies 1 of 72 Stash entries, but 2 of 15 Carry positions and 2 of the 3 active slots. A wipe deletes both. Extraction restores the single composite Stash entry. Selling it later at home pays **◈78** once.
- A full 72-entry Stash sends no banked weapon and extracts with 11 finds. The 11 are safe in Intake, the account reads **83/72 over cap**, and Ready remains disabled until the player reaches 72 or fewer through sales, discards, binds, or a shelf purchase.
