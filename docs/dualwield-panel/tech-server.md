# Dual-Wield — Server Tech Spec (pair model, fire paths, wire, migration)

**Panel:** dual-wield ("pair two different one-handed weapons of the same class") · **Role:** server tech
implementer · **Read surface:** `GameRoom.ts` (6,690 lines, all arsenal/fire/receipt paths), `state.ts`,
`weapons.ts`, `melee.ts`, `combat.ts`, `loot.ts`, `constants.ts`, `progression.ts`, `augments.ts`, plus the
enemy-combo / jumpfeel / ultimate panel docs for the schema ledger.

---

## 0. Verdict up front

**The pair is a LINK BETWEEN TWO OCCUPIED ARSENAL SLOTS, not a new storage row.** One appended
`offhandSlot: uint8` pointer (255 = unpaired) on `PlayerState` names which slot rides in the off hand while
`activeSlot` stays the lead. Everything falls out of this choice:

- `player.weapon` remains exactly what it is today — the lead hand's live mirror — so the **~130
  server-side consumers of `player.weapon` keep working unmodified** unless they genuinely need the second
  hand (the fire dispatcher, the damage-mult helper, receipts). The migration is additive, not a rename.
- The off-hand weapon's identity (`weapon`/`rarity`/`affix`/`earned`) is **already synced** — it lives in
  its `ArsenalSlot` row, which is decorated schema. Zero new identity wire fields.
- The off-hand's cooldown/reload/ammo debt **already has a home**: the slot's server-private
  (undecorated) ledger fields `cooldown`/`reload`/`resourceCharges` (G-01). While paired, the live off-hand
  fire path decrements those fields **in place**. Pairing and unpairing therefore move **zero** resource
  state — the debt law holds *by construction*, which is the whole answer to the swap-exploit resurrection
  the advocate will raise (§5.3).

Rejected alternatives, for the record:

| Model | Why rejected |
|---|---|
| `offhandWeapon`/`offhandRarity`/`offhandAffix`/`offhandEarned` appended to PlayerState (a 4th storage) | Duplicates identity already synced in slots; invents a 4th carry location every slot/bag/sell/drop/loadout consumer must learn; `loadoutIds()` and the set-bonus counting law break (is the offhand a 4th loadout entry? — §8 says it must not be); needs its own debt ledger, reopening the exploit surface `ArsenalSlot` already closed. |
| A separate `pairs` table (MapSchema of pair rows) | A whole new schema collection for what is one uint8 of relationship; nothing else in the codebase models player-owned relationships out-of-line. |
| Pair-as-item (a fused weapon id) | Explodes the weapon catalog combinatorially (123 one-handed expansion weapons alone); breaks loot identity (two rarities/affixes), sell, salvage, and the drop curator's per-weapon power banding. |

**Nastiest consumer migration:** `stepStowedWeaponResources` (GameRoom.ts:1447) — it steps **every
non-active slot's** debt each tick. If the off slot is not excluded while paired, its cooldown drains
**twice** per tick (once by the stowed step, once by the live off-hand fire path), a silent ~2× fire-rate
exploit that no existing test would catch. See §11 row 3 and the dedicated drain-rate test in §12.

---

## 1. Ground truth (what the code actually does today)

Recorded here so the panel argues against reality, not memory. File/line refs are current as of
`feat/v0.117-feel-and-colossus`.

**Arsenal model (belt mode).** `PlayerState.slots` = 3 × `ArsenalSlot`, `activeSlot` names the hand,
`bag` (cap 12) is overflow (state.ts:123–135). The held weapon is the active slot's *live mirror*:
`player.weapon`/`weaponRarity`/`weaponAffix` are the authoritative held identity; `syncActiveSlot`
(GameRoom.ts:1477) writes them back into the slot before any topology change, `loadSlot` (:1493) mirrors a
slot out into the hand. Messages: `swapSlot`, `cycleSlot`, `bagStore`, `bagEquip`, `sellWeapon`,
`grabWeapon`→`grabIntoArsenal`, `dropWeapon`, `salvageWeapon` (:895–1056). Arena (non-belt) mode has no
slot semantics — a Q/E carousel with a `weaponLedger` map keyed by weapon id (:365).

**The per-weapon debt law + draw gate (the swap-exploit fix, G-01).** Each `ArsenalSlot` carries
undecorated `resourceWeapon`/`resourceReady`/`cooldown`/`reload`/`resourceCharges` (state.ts:14–20) —
server-private combat ledger. `saveWeaponResource` (:1353) persists the live `c.cd`/`c.reloadCd`/
`player.charges` into the slot before identity changes; `restoreWeaponResource` (:1376) restores them —
**only a `genuinelyNewPickup` may initialize a fresh row**. Every network-reachable swap also arms
`c.drawLock = WEAPON_DRAW_LOCK_SECONDS` (0.15s, constants.ts:354), and the attack gate is
`c.attackBuffer > 0 && c.cd <= 0 && c.drawLock <= 0` (:2514). Stowed debts keep aging in real time via
`stepStowedWeaponResources` → `stepStoredSlot` (:1447–1473): "swapping changes identity, never the passage
of time." Beam heat has its own parallel ledger (`beamLedger`, :3044) with the same never-erased law.

**Fire dispatch (tick section 4, :2455–2562).** One branch chain per player per tick off
`weapon = WEAPONS[player.weapon]`: beam → `stepPlayerBeam`; gun → `fireGun` + ammo/reload + accumulating
`c.cd += fireRate × lootCooldownMult(player.weaponAffix)`; thrown → `throwWeapon` + charges; cast →
`fireCast` + flat cd; else melee → `swingDescriptorFor(weapon, cooldown × cdMul)` + `resolveSwing` +
`c.cd = swing.effectiveCooldown`. Every acceptance calls `stampAttackBeat` (:2824): `attackSeq++`,
`attackTick = tick`, `attackHeld = true` (cleared after `ATTACK_HELD_WINDOW` = 3 ticks, :2209).

**Melee sweep.** `resolveSwing` (:2834) registers one swept blade in `this.meleeSwings` **keyed by
`player.id`** ("Replaces any in-flight swing") carrying `{swing, aim0, range, swingArc, halfWidth,
edgeDamage, weaponId, elapsed, hit:Set}`; `stepMeleeSwings` (:3626) advances it. Layers (chain / quake /
scatter / rez) fire at swing acceptance with per-source grades. `SwingDescriptor` (melee.ts:1335) is the
immutable per-swing clock; `MeleeComboStep.hand: "lead"|"off"|"both"` already exists **cosmetically**
(melee.ts:103) and `comboStepForChain` (melee.ts:1442) derives client presentation from the synced
`attackSeq` stream.

**Damage scaling.** `heldDamageMult(weapon, grades, player)` (:1552) =
`effectiveDamageMult(weapon, grades, player)` × `lootDamageMult(player.weaponRarity, player.weaponAffix)`
× `weaponSetBonus(this.loadoutIds(player), player.weapon)`. Note it hard-reads the **held** loot identity
and the **held** weapon id — the single most load-bearing consumer to parameterize (§9).

**Set bonus.** `loadoutIds` (:1575) = the 3 slot ids (active reads live `player.weapon`);
`classCount`/`weaponSetBonus` (weapons.ts:345–360) give +8%/+18% at 2/3-of-a-class. Bag weapons never
count.

**Receipts (v18 ring).** `writeCombatReceipt` (:2111) stamps `sourcePlayerId` + `weaponId` + `delivery` +
direction + damage into the fixed 32-row ring; every fire path already threads the firing `weapon.id`
through `damageEnemy`/`fireProjectile`/`detonate`/`damageWormSlots`. **Attribution is already
per-weapon-id, not per-player-held-weapon** — dual wield needs only that each hand pass its own id.

**Signature gate (G-09).** `levelUp` snapshots `augmentGateForWeapon(WEAPONS[player.weapon])` into
`sigGateQueue` at the level edge (progression.ts:54); swap-during-window cannot reroll (:4313).

**Loot.** `DROP_POOL` (loot.ts:298) is the automatic power-band curator — per-weapon `effectivePower`
inside the class-median band; `rollDropWeapon` picks uniformly. Drops are single weapons with one rolled
rarity+affix. Sell: `scripValue(rarity, earned)` per slot/bag row (:970–991).

**Weapon taxonomy.** `tags.grip: "1H" | "2H" | "dual" | "mounted"`. Base roster: 8 × 1H; expansion: 123 ×
1H, 146 × 2H, 22 × authored-`dual` (e.g. `twin-bowie-fangs`, grip `"dual"`, `dual: true` = one *item*
drawn as two pieces). Authored duals are **not** this feature and are excluded by the grip check.

**Schema ledger.** `SCHEMA_VERSION = 18` committed (constants.ts:13). **19 = enemy-combo** (implementing
NOW; owns GameRoom/state/constants/enemies/combat — appends `EnemyState` fields + `PlayerState.juggledSeq`
per docs/enemycombo-panel/tech-implementer.md:344,415). **20 = claimed by the jump panel**
(docs/jumpfeel-panel/tech.md:176 — PlayerState stance/juggle fields). **Ultimate panel** claims
"next free at merge time" with 9 PlayerState appends (docs/ultimate-panel/tech-server.md:446). We take
next-available — see §14.

---

## 2. Feature scope (server contract)

Pairing puts a **second, different one-handed weapon of the same class** in the off hand. Both hands fire
under one attack-request stream with deterministic alternation. The pair is a *runtime relationship*, not
an item: it is formed and dissolved freely (gated by validation + the draw gate) and both weapons remain
individually stashable/sellable/droppable *after* unpairing.

v1 is **belt-mode only** (`this.belt`): the pair pointer names arsenal slots, which only have gameplay
meaning in belt play. Arena-carousel dual wield would need a `weaponLedger`-keyed variant — deferred,
noted in §13.

Eligibility (server-enforced regardless of what the client offers — final thresholds are the systems
designer's; these are the *server invariants*):

1. Both slots occupied (`slot.weapon !== ""`), distinct indices, off ≠ active.
2. Both `tags.grip === "1H"`. This excludes 2H, mounted, and authored-`dual` twins automatically.
3. Same `tags.classPool` (the user directive: "one handed weapons of the same class").
4. Neither has `beam` delivery (§7.4, the single-channel law).
5. Player alive, not in the level-up window, belt mode, action budget (`takeAction`).

Encode 1–4 as a **pure shared predicate** `pairEligible(lead: WeaponDef, off: WeaponDef): boolean` in
`weapons.ts` so client UI and server validation cannot drift (the "one shared function" law), and so the
systems designer can tighten it (e.g. a cooldown-band constraint for mixed-speed pairs) in one place.

---

## 3. THE PAIR MODEL — state shape

### 3.1 Appended `PlayerState` fields (Colyseus append-only; one SCHEMA_VERSION bump)

```ts
// ── §54 DUAL-WIELD PAIR: the off hand is a LINK to another arsenal slot, never new storage. APPENDED
// after every field the enemy-combo (v19) / jump (v20) / ultimate waves land — see the version ledger. ──
/** Slot index riding in the OFF hand (paired with the active slot's lead). 255 = not paired. */
@type("uint8") offhandSlot = 255;
/** attackSeq value at pair acceptance — the hand-parity epoch (§7): the Nth paired attack's hand is
 *  ((attackSeq − pairBaseSeq − 1) & 1), 0 = lead. Restamped on every pair acceptance. */
@type("uint32") pairBaseSeq = 0;
/** Off-hand ammo/charge readout (the lead keeps charges/maxCharges). Mirrors the off slot's private
 *  resource ledger while paired; 0/0 when unpaired or the off weapon has no magazine/charges. */
@type("uint8") offCharges = 0;
@type("uint8") offMaxCharges = 0;
```

Wire cost: 10 bytes of payload across 4 fields, delta-synced (they change on pair/unpair, and
`offCharges` per off-hand shot — comparable to the existing `charges` churn). The off-hand's *identity*
costs nothing: clients read `slots[offhandSlot].weapon/rarity/affix`, which already sync. No `ArenaState`
changes. No new collections.

`uint8` magazines: current max magazine in the catalog is well under 255 (largest gun mags are ~40);
assert at load (`maxWeaponCharges ≤ 255`) so a future authoring mistake fails loudly instead of wrapping.

### 3.2 `CombatState` additions (server-private, no wire)

```ts
/** Dual-wield: seconds until EITHER hand may fire again (the interleave stagger, §6.2). Ages every
 *  tick like cd; deliberately NOT reset by pair/unpair so parity-cycling can't mint an extra beat. */
handGate: number;        // init 0
/** Off-hand identity the live off ledger belongs to — the off-hand twin of lastWeapon: detects the
 *  off slot's content changing under the pair (bagEquip into it is blocked, but defense in depth). */
offLastWeapon: string;   // init ""
```

The off hand needs **no** `cd`/`reloadCd`/`charges` twins on `CombatState`: while paired the live off-hand
ledger IS the off slot's private `cooldown`/`reload`/`resourceCharges` fields, mutated in place (§5.2).
`c.cd`/`c.reloadCd`/`player.charges` remain lead-only, untouched semantics.

### 3.3 Which consumers see the pair vs the lead only

The decision rule: **anything that means "the weapon in your hand" keeps seeing the lead; anything that
means "a damage/fire event" becomes hand-parameterized; anything that means "carried inventory" was
already slot-shaped and needs only unpair guards.** Full table in §11. Highlights:

- *Correctly lead-only, no change:* `sigGateQueue` capture (G-09 — the earned lane is the held weapon's;
  same class anyway by rule 3), `aimDir` (both hands share aim), parry offense attribution (:5437,
  :5470 — parry is a body action, lead id is fine), `transitionWeapon`/`lastWeapon` (lead identity
  transitions), prediction/reconciliation (movement-only), pickups/drop of the *held* weapon,
  `cycleWeapon` (arena mode; belt swaps go through pair guards), beam resource stepping keyed on
  `player.weapon`.
- *Pair-aware:* the tick-4 fire dispatcher, `heldDamageMult` (→ `handDamageMult`, §9), `meleeSwings`
  keying, `stepStowedWeaponResources` (exclusion!), the eight arsenal-topology handlers (unpair guard),
  restart/training/death resets, `writeCombatReceipt` callers (already parameterized — verify only).

---

## 4. Messages

```ts
// Pair the ACTIVE slot (lead) with another occupied slot (off). Idempotent no-op when already
// paired to that slot. Re-pairing to a different slot = implicit unpair + pair (both draw-gated).
this.onMessage("pairSlots", (client, message: { off?: number }) => { ... });

// Dissolve the pair. The off weapon stays exactly where it is (its slot), debts intact.
this.onMessage("unpairSlots", (client) => { ... });
```

`pairSlots` validation order (cheap → expensive, mirroring existing handlers):

1. `takeAction(client)` budget; `player?.alive`; `this.belt`; `!this.inLevelWindow(player)`.
2. `off = Math.floor(message?.off ?? -1)`; range `[0, ARSENAL_SLOTS)`; `off !== player.activeSlot`.
3. `syncActiveSlot(player, c)` — capture the live lead into its slot first (existing invariant: the slots
   array reflects reality before any topology read).
4. `pairEligible(WEAPONS[player.slots[player.activeSlot].weapon], WEAPONS[player.slots[off].weapon])`.
5. Accept: `player.offhandSlot = off`; `player.pairBaseSeq = player.attackSeq`;
   `c.offLastWeapon = slots[off].weapon`; mirror `offCharges/offMaxCharges` from the off slot's ledger
   (initializing the ledger via the *existing* restore rules if `!resourceReady` — a never-yet-drawn
   weapon starts full, exactly as `restoreWeaponResource` would grant it);
   `c.drawLock = Math.max(c.drawLock, WEAPON_DRAW_LOCK_SECONDS)` — **the shared draw gate applies to the
   pair edge like every other swap**; cancel any active beam channel (defensive — rule 4 should make this
   unreachable, but `cancelBeam` on transition is the established pattern at :1430).

`unpairSlots`: alive + budget; if `offhandSlot === 255` no-op; else `offhandSlot = 255`,
`offCharges = offMaxCharges = 0`, `c.offLastWeapon = ""`, draw gate. **No ledger writes** — the off
slot's debt fields are already current (they were mutated in place), and from the next tick
`stepStowedWeaponResources` resumes aging them as a stowed weapon. `c.handGate` is deliberately left
running (§5.3).

**Implicit unpair** (`unpairSlots` internals extracted as `private dissolvePair(player, c)`) fires at the
top of every handler that can move/destroy either paired slot's content — the guard list in §11 rows
5–12: `swapSlot`, `cycleSlot`, `bagStore`, `bagEquip` (targeting either paired slot), `sellWeapon`
(slot-form targeting either paired slot), `grabIntoArsenal` (when overflow rewrites the active slot),
`dropWeapon`/`salvageWeapon` (they empty the lead), `devEquip`, `toggleTraining`, room restart, and the
lead-death → fists path if one exists in the restart flow. Rule of thumb enforced by a single helper
call: **a pair never survives any mutation of either of its slots.** Downed (`alive=false`) players keep
their pair — the body keeps its arsenal (§6 law), and the `acting` gate already idles both hands.

---

## 5. The debt law across pair topology

### 5.1 Lead hand — unchanged

`c.cd`/`c.reloadCd`/`player.charges` + `saveWeaponResource`/`restoreWeaponResource` exactly as today.
Pairing does not touch the lead's ledger.

### 5.2 Off hand — the slot row is the live ledger

While paired, tick section 4 (per player) does, for the off slot `s = player.slots[player.offhandSlot]`:

- age: `s.cooldown = max(0, s.cooldown − dt)`; run its reload exactly like `stepStoredSlot` does today
  (refill `s.resourceCharges` on completion) — **but via the live path, with the stowed loop skipping
  this slot** (§5.4);
- fire (when the interleave grants the off hand a beat, §6): spend `s.resourceCharges`, set
  `s.cooldown += fireRate × lootCooldownMult(s.affix)` (guns, accumulating like the lead) or
  `s.cooldown = cooldown × cdMul` (melee/thrown/cast), start `s.reload` on empty;
- mirror `player.offCharges = s.resourceCharges` (and `offMaxCharges` from the def) when changed.

Because the same physical fields hold the debt whether the weapon is stowed, paired, or (after an
unpair + swap) drawn as a lead, **there is no save/restore seam at the pair boundary to get wrong**.

### 5.3 The exploit the advocate will name — and the three locks

*The attack:* rapid `pair → fire off-hand → unpair → re-pair` cycling to (a) reset a cooldown/reload,
(b) refill a magazine, or (c) re-align hand parity so the fast hand fires twice in a row.

- **(a)/(b) are dead by construction:** no code path at the pair edge writes the off slot's ledger except
  the `!resourceReady` first-draw initialization, which is the same grant `restoreWeaponResource` gives a
  genuinely-new pickup today (and `resourceReady` flips true the moment it's initialized, so it fires once
  per weapon acquisition, not per pair). Cycling changes *which stepper* ages the debt (live vs stowed) —
  both age at exactly `dt` per tick.
- **(c)** is blunted twice: every pair acceptance costs the `WEAPON_DRAW_LOCK_SECONDS` draw gate (cycling
  is strictly slower than waiting out the beat), and `c.handGate` (§6.2) is not reset by pair topology —
  the stagger you owe from the last accepted attack survives the cycle. Restamping `pairBaseSeq` re-bases
  *which* hand is next but cannot create an attack acceptance the per-hand cooldowns + handGate wouldn't
  have granted anyway.
- Beam heat: rule 4 keeps beams out of pairs, and the beam ledger (`beamLedger`) is untouched by pair
  edges — a beam lead paired with a non-beam off is impossible, and a non-beam pair never touches heat.

### 5.4 The stowed-step exclusion (P0 correctness)

`stepStowedWeaponResources` (:1447) must skip `i === player.offhandSlot` in addition to
`i === player.activeSlot` **whenever the player is paired** — otherwise the off slot's cooldown drains
2× per tick (stowed step + live step). This is the single most dangerous line of the whole feature; it
gets its own drain-rate test (§12.2) because nothing visible fails when it's wrong — DPS just silently
doubles on the off hand.

---

## 6. Per-hand fire-path execution

### 6.1 Dispatch restructure (tick section 4)

Today's per-player block resolves ONE weapon. Paired players resolve a **hand**, selected
deterministically, then run the existing delivery branch with hand-scoped inputs. Extract the current
branch chain into:

```ts
/** Resolve one accepted attack for `hand` (0 = lead, 1 = off). All identity/ledger/loot inputs come
 *  from the hand: weapon def, rarity, affix, cd-ledger accessors, charges accessors, muzzle geometry. */
private resolveHandAttack(player, c, hand: 0 | 1, dt): void
```

Unpaired players call it with hand 0 and lead accessors — a pure refactor, behavior-identical (the
existing GameRoom tests are the regression net).

Gate for a paired player (replacing the single `canAct`):

```ts
const nextHand = ((player.attackSeq - player.pairBaseSeq) >>> 0) & 1; // 0 = lead's turn
const handCd   = nextHand === 0 ? c.cd : offSlot.cooldown;
const canAct   = acting && c.attackBuffer > 0 && handCd <= 0 && c.drawLock <= 0 && c.handGate <= 0;
```

Strict alternation: the *only* hand that may fire is `nextHand`. That is what makes hand-from-seq
deterministic (§7). Consequence the combat designer must own: a mixed-speed pair beats at the rhythm of
its slower member (each hand waits for its own cooldown AND its turn). If that's undesirable, the
eligibility predicate is the lever (require a cooldown band), not the parity law.

Ammo gating per delivery, per hand, mirrors today: a gun hand additionally requires its own
`charges > 0`; its empty-reload runs every tick regardless of turn (reloads are time, not turns) — the
lead's via the existing `c.reloadCd` block, the off's via §5.2 aging.

**Held-trigger starvation rule:** if `nextHand` is a gun mid-reload (or an empty thrown) while the other
hand is ready, the pair would deadlock under strict alternation. Rule: a hand whose *resource* (not
cooldown) cannot possibly fire yields its turn — implemented as: when `nextHand` is resource-blocked
(`charges ≤ 0` with reload running) and the other hand is fully ready, stamp the beat to the other hand
(the parity stream stays truthful because hand is *derived from the accepted seq*, and the yield consumes
one seq slot for the hand that actually fired — see §7's derivation note). Cooldown-blocked hands do NOT
yield (that would collapse alternation into fastest-hand spam).

### 6.2 The stagger (`c.handGate`)

On every accepted paired attack: `c.handGate = firedWeapon.cooldown × cdMul × PAIR_STAGGER_FRAC`, with
`PAIR_STAGGER_FRAC = 0.5` (constants.ts, tuning). This is what makes two 0.3s cleavers *feel* like a
0.15s interleave instead of two simultaneous 0.3s beats: L at t=0, R at t≥0.15, L at t≥0.3 (its own cd),
… The gate ages with dt in the same block as `c.cd` (:2462) and, per §5.3, survives pair/unpair.

### 6.3 Melee — interleaved sweeps, two in-flight blades

- Each accepted melee beat builds `swingDescriptorFor(handWeapon, handWeapon.cooldown × cdMul(handAffix))`
  — **each weapon's own SwingDescriptor**, own style/pose/active window.
- `this.meleeSwings` re-keys from `player.id` to `` `${player.id}:${hand}` `` so an off-hand sweep can
  overlap the lead's follow-through (the dual-wield fantasy; with stagger 0.5 the overlap is real for any
  pair whose active window outlasts half its cooldown). `stepMeleeSwings` (:3626) iterates entries and
  resolves `player = players.get(pid.split(":")[0])` — a two-line change; each entry keeps its own `hit`
  set, so both hands may hit the same enemy once each per their own swings (intended: that IS the DPS of
  dual wielding).
- "Replaces any in-flight swing" now applies per hand key. Death/unpair sweeps both keys
  (`meleeSwings.delete(pid+":0"/":1")` in the existing cleanup sites; grep count: 3 delete sites).
- Layers (chain/quake/scatter/rez) fire per accepted hand from **that hand's** def and grades — no
  sharing, no merging. A quake off-hand pairs legally with a chain lead; each beat brings its own layers.

### 6.4 Guns — alternating `fireGun`, per-weapon ammo/reload debt

`fireGun`/`fireCast`/`throwWeapon` already take `weapon: WeaponDef` and thread `weapon.id` into
projectiles and receipts — they need only (a) the damage-mult call parameterized (§9) and (b) charges
spent from the firing hand's ledger by the caller (they don't touch charges today; the tick block does —
keep it there). Muzzle reach (`gunMuzzleReach(weapon)`) is already per-def. Recoil per shot is authored
per gun and stays per-shot — a heavy/light pair kicks asymmetrically, which is correct and free.

### 6.5 Casters — alternating `fireCast`; the beam single-channel law

Non-beam casters (`cast` delivery) alternate exactly like guns minus ammo. **Beam weapons cannot be
paired** (eligibility rule 4): the entire beam runtime is single-channel by design — one
`BeamState` per owner id in `state.beams`, one `c.beamDescriptor`, one heat ledger entry active at a
time, and the WYSIWYG swept-capsule contract assumes one ribbon per player. Two simultaneous channels is
a netcode + VFX + balance project of its own; a beam + bolt pair ("channel with one hand, pepper with the
other") violates the one-attack-stream/one-seq model too. If the systems designer wants it later it is a
new panel, not a rider.

### 6.6 What does not change

`attackBuffer` stays one buffer (one trigger); parry/jump untouched; `aimDir` shared (both hands point at
the cursor — the client rig may fan the off hand cosmetically); enemy-facing systems see only receipts and
damage events, which are already weapon-id-attributed.

---

## 7. `attackSeq` semantics with two hands — the parity spec

**One stream, no new per-attack wire.** `stampAttackBeat` still bumps the single `attackSeq` exactly once
per accepted attack, whichever hand fired. Hand identity is **derived, never transmitted**:

```
paired   := offhandSlot !== 255
delta    := (attackSeq − pairBaseSeq) >>> 0        // wrap-safe uint32, like every seq math here
hand(N)  := (delta − 1) & 1  for the attack whose accepted seq is N   // 0 = LEAD, 1 = OFF
nextHand := delta & 1                               // the hand the NEXT acceptance belongs to
```

- `pairBaseSeq` is stamped to the *current* `attackSeq` at pair acceptance, so the first paired attack
  (seq = base+1) is the **lead** hand. Deterministic for every observer: owners, remotes, late joiners,
  and replays all compute the same hand from two synced uint32s — the combat designer's
  "deterministic hand-from-seq" requirement.
- The server *enforces* what the formula *describes*: only `nextHand` may fire (§6.1), so derivation and
  reality cannot diverge. The one exception — the resource-yield rule (§6.1) — preserves the invariant by
  definition: the yielded beat is accepted *as* the other hand's seq slot, i.e. when a yield happens the
  server flips `pairBaseSeq` by restamping it (`pairBaseSeq = attackSeq`) *before* stamping the beat, so
  the accepted seq still satisfies `hand(N) = firing hand`. Restamping is wire-cheap (one uint32, only on
  yields) and keeps the formula the single source of truth. Test-pinned in §12.3.
- Unpaired players: formula unused; everything reads as today.
- Client presentation: `comboStepForChain` (melee.ts:1442) advances a weapon's combo chain on
  `advance === 1` of the global seq — under alternation a given hand's consecutive beats arrive with
  advance 2, so paired weapons will (correctly, conservatively) restart at their opener every beat until
  the client learns hand-aware chains. That is a cosmetic client follow-up (the `MeleeComboHand` vocabulary
  already exists at melee.ts:103); flagged for the combat designer, zero server work.
- `attackTick`/`attackHeld` stay shared: `attackHeld` means "this player is attacking", which is true
  regardless of hand, and the 3-tick window (`ATTACK_HELD_WINDOW`) refreshes on either hand's beat.

---

## 8. Set-bonus counting law

**Law: pairing never changes `classCount`.** The off weapon already occupies a loadout slot, so
`loadoutIds(player)` (:1575) is **unchanged** — 3 entries, the 3 slots, active reads live. Pairing two of
your three carried melee weapons yields the same `classCount = 2..3` you already had by carrying them.
Explicit non-goals, enforced by the model:

- No 4th loadout entry from pairing (rejected model A would have had to answer this; slot-link makes the
  question unaskable).
- No bag weapon can be an off hand (`pairSlots` names slots only) — bag weapons keep counting for
  nothing, as today.
- Per-hand bonus resolution: each hand's damage calls `weaponSetBonus(loadout, thatHandWeaponId)`
  (§9). Eligibility rule 3 (same class) makes the two multipliers equal in v1, but resolving by the
  firing hand's id is the correct law if cross-class pairing ever loosens — and it is what keeps the
  card/HUD WYSIWYG display honest per hand.

---

## 9. Damage attribution — `heldDamageMult` → `handDamageMult`, receipts per hand

The load-bearing helper (:1552) hard-reads `player.weaponRarity`/`weaponAffix`/`player.weapon`. It becomes:

```ts
/** Per-source damage multiplier for a HAND: grades × §11 req penalty × loot(rarity,affix) × set bonus,
 *  all resolved from the FIRING hand's identity. Lead hand: the live mirror fields (unchanged math).
 *  Off hand: the paired slot's rarity/affix/id. */
private handDamageMult(weapon: WeaponDef, grades, player, rarity: number, affix: string): number {
  return effectiveDamageMult(weapon, grades, player)
       * lootDamageMult(rarity, affix)
       * weaponSetBonus(this.loadoutIds(player), weapon.id);
}
```

`heldDamageMult` remains as a one-line lead-bound wrapper so its ~14 existing call sites (edge, chain,
quake, scatter×2, gun×2, cast, thrown, and the card-parity paths) migrate mechanically; off-hand
resolution passes the off slot's `rarity`/`affix`. `requirementPenalty` is already per-def inside
`effectiveDamageMult`; crit (`critChanceFor(player.luk, player.dex)`) is per-player and stays shared.

**Receipts:** nothing structural. `writeCombatReceipt` (:2111) already records the `weaponId` each caller
passes; the element column derives from that id (:2139). The only work is an audit that every off-hand
path passes the off id: melee via `meleeSwings[...].weaponId` (set per hand in §6.3), projectiles via
`fireProjectile(..., weapon.id, delivery)` (already parameterized), quake via `pendingQuakes[].
sourceWeaponId` (set at acceptance from the firing hand), chain via the `weapon.id` argument at :2949/
:2966. **Two weapon ids now appear in a paired player's receipt stream — that is the feature working**,
and the client's receipt renderer keys per-row `weaponId`, so kill-feed/hit-FX attribution is correct with
zero client changes. Parry receipts keep the lead id (:5437, :5470) — parry is a body action.

---

## 10. Loot, shop, drop curator

- **Selling:** a pair is not sellable *as* a pair — `sellWeapon` targets one slot/bag row, and the
  implicit-unpair guard (§4) dissolves the link first; each weapon then sells at its own
  `scripValue(rarity, earned)`. No pair pricing, no new message.
- **Drop/salvage:** `dropWeapon`/`salvageWeapon` act on the lead (as today) after `dissolvePair` — the
  off weapon stays safely in its slot. A paired lead dropped on death-restart follows the existing
  restart reset, which now also clears `offhandSlot`.
- **Drop curator:** `DROP_POOL`/`isDropEligible` (loot.ts:284–300) stay per-weapon. The curator does
  **not** evaluate pairs: pair synergy is player-composed at runtime, and the power-band gate's job is
  outlier trimming of individual drops, not build evaluation. One real interaction to hand the systems
  designer: 123 of the 291 expansion weapons are 1H — the band already governs whether each enters the
  pool, and pairing roughly doubles the ceiling DPS a pocket of cheap 1H drops can reach. If tuning shows
  pair-driven inflation, the lever is `DROP_BAND_HIGH` for the 1H population or a stagger/cooldown floor
  in `pairEligible` — not curator pair-awareness.
- **Mystery drops / grabs:** untouched; `grabIntoArsenal` fills empties first and only rewrites the
  active slot on total overflow, which is a §4 guard site.

---

## 11. Migration safety — every consumer, disposition

From `grep player.weapon | p.weapon` (223 hits: GameRoom.ts 88, GameRoom.test.ts 87, progression.ts 1,
augments.ts 1, client level-up-model.ts 10, client ArenaScene.ts 36) plus the slot/ledger machinery:

| # | Consumer (site) | Disposition |
|---|---|---|
| 1 | Tick-4 fire dispatch (:2455–2562) | **Rework** → `resolveHandAttack` + parity gate (§6.1). The refactor is behavior-identical for unpaired players. |
| 2 | `heldDamageMult` (:1552) + 14 call sites | **Parameterize** → `handDamageMult` (§9); lead wrapper keeps call sites mechanical. |
| 3 | `stepStowedWeaponResources` (:1447) | **Exclude the off slot while paired** (§5.4). P0; dedicated test. |
| 4 | `meleeSwings` map + `stepMeleeSwings` (:2850, :3626) + 3 delete sites | **Re-key** `${id}:${hand}` (§6.3); per-entry `weaponId` already per-hand. |
| 5–12 | `swapSlot` :897, `cycleSlot` :909, `bagStore` :927, `bagEquip` :945, `sellWeapon` :970, `grabIntoArsenal` :1518, `dropWeapon`/`dropHeldWeapon` :1031/:1299, `salvageWeapon` :1041 | **Guard**: `dissolvePair` before mutating either paired slot (§4). One helper, one call each. |
| 13 | `devEquip` (:865) | Guard: dissolve on lead identity edit (class could diverge). |
| 14 | `toggleTraining` (:1595) / restart / boss-rush reset (:1786–1805 charge resets) | Reset `offhandSlot = 255`, `pairBaseSeq/offCharges/offMaxCharges = 0`, `c.handGate = 0` alongside the existing `resourceReady = false` sweeps. |
| 15 | `transitionWeapon` / `saveWeaponResource` / `restoreWeaponResource` / `lastWeapon` (:1353–1444, :2496) | **No change** — lead-only by design; the off hand never flows through them (§5.2). |
| 16 | `syncActiveSlot` / `loadSlot` (:1477, :1493) | No change; called under guards that have already dissolved the pair. |
| 17 | `loadoutIds` / `weaponSetBonus` (:1575, weapons.ts:353) | **No change** (§8 law). Off-hand damage resolves the bonus by its own id via §9. |
| 18 | Sig gate: `levelUp` (progression.ts:54), `tickLevelWindows` (:4313), `consumeSignatureGate` (:4349) | **Lead-only, correct**: the earned lane is the held weapon's; same class by rule 3 so the gate family cannot even diverge in v1. Document, don't touch. |
| 19 | `augmentGateForWeapon` (augments.ts:288) | Pure; no change. |
| 20 | `stampAttackBeat` / `attackHeld` lapse (:2824, :2209) | No change; parity derived (§7); `pairBaseSeq` restamp on yield only. |
| 21 | Beam paths (:2502, :3053, :3267–3302, beams map) | No change; beams excluded from pairs (rule 4); pair acceptance cancels a live channel defensively. |
| 22 | Receipts (:2111) + parry attribution (:5437, :5470, :5481, :6078) | Audit-only: verify each off-hand path passes the off id (§9); parry stays lead. |
| 23 | Charges HUD (`player.charges/maxCharges`) | Lead-only as today; off hand mirrors via appended `offCharges/offMaxCharges` (§3.1). |
| 24 | Cooldown affix mult (:2516, :3124) | Per hand: lead `player.weaponAffix`, off `slots[offhandSlot].affix`. |
| 25 | Client: ArenaScene (36), level-up-model (10), card art, SpriteRig | Client panel's surface. The wire contract suffices: identity from `slots[offhandSlot]`, hand from §7 parity, ammo from `offCharges`. The rig's existing `dual: true` two-piece path (parts 1&2) is the rendering precedent — here it draws each weapon's part-1 in each hand. |
| 26 | GameRoom.test.ts (87) | Untouched semantics for unpaired players — the suite is the refactor's regression net; new paired coverage in §12. |

---

## 12. Deterministic test strategy (`GameRoom.test.ts` — new `describe("dual wield")`)

House rules observed: pin `Math.random` (`vi.spyOn(Math,"random")` — the established anti-flake pattern
at :1420/:1500/:2907, and the §50 stacked-RNG lesson), drive the room by fixed `dt` ticks, assert on
synced state + receipts only.

1. **Debt across pair/unpair cycling (the exploit test).** Off-hand gun: pair, fire to empty (assert
   `offCharges === 0`, reload started), unpair, immediately re-pair ×3 within the reload window; assert
   `offCharges` still 0 every cycle and the refill completes on the **same tick** as a control room that
   never unpaired. Repeat for a mid-cooldown melee off hand (cooldown remaining monotonically decreases
   through cycles, never resets). Also: first-ever pair of a never-drawn weapon grants a full magazine
   exactly once (`resourceReady` law).
2. **Stowed-step exclusion drain rate.** Pair; put the off slot at `cooldown = 1.0`; run 10 ticks
   (0.5s) with no attacks; assert exactly `0.5` drained (±ε), not `1.0`. Then unpair and verify the
   stowed stepper resumes at 1× (no dead slot).
3. **Interleave cadence math + parity.** Pair cooldowns (0.3, 0.5) with `PAIR_STAGGER_FRAC = 0.5`; hold
   the trigger 3 s; collect `(attackSeq, attackTick)` and receipts. Assert: strict hand alternation via
   the §7 formula against receipt `weaponId`; per-hand gaps ≥ that hand's cooldown in ticks; inter-beat
   gaps ≥ stagger; total beat count equals the closed-form expectation for the (0.3, 0.5, 0.5-stagger)
   alternation. Yield rule: empty the off gun, assert the lead legally takes consecutive beats and
   `pairBaseSeq` restamps keep §7's formula = actual firing hand for every receipt.
4. **Set-bonus counting law.** Slots = [melee, melee, ranged]: `classCount(melee) === 2` before pairing,
   after pairing, and after unpairing (assert damage receipts carry the ×1.08 on both hands' hits);
   a bag melee never changes it. Pair the 2 melee: damage unchanged vs unpaired carry (the law: pairing
   buys cadence, not multiplier).
5. **Receipt attribution per hand.** Kill one dummy with each hand (pin RNG, no crit); assert the two
   `finalBlow` receipts carry the two distinct `weaponId`s and the correct `delivery` per def; assert
   element column follows each id.
6. **Validation rejections.** 2H off, beam either side, cross-class, empty slot, `off === active`, bag
   index, dead player, level window, non-belt room: all leave `offhandSlot === 255` and mint no beat.
7. **Guards.** Each of §11 rows 5–14: perform the op on a paired player; assert `offhandSlot === 255`
   afterward, both weapons and their ledgers intact (nothing destroyed, debts preserved), and the draw
   gate armed.
8. **Melee overlap.** Two slow 1H melee: accept lead beat, advance to inside its active window, accept
   off beat; assert two live `meleeSwings` entries, each hitting a straddling dummy once (2 total hits,
   not 1, not 4).

Shared-package tests (`weapons.test.ts` or new `pair.test.ts`): `pairEligible` truth table over the real
catalog (8 base 1H + expansion samples; asserts authored-`dual` and `mounted` grips excluded), and the
§7 parity formula as a pure-function property test across uint32 wrap.

---

## 13. File / function touch list

**packages/shared/src/constants.ts** — `SCHEMA_VERSION` bump (§14); `PAIR_STAGGER_FRAC = 0.5`;
(optional tuning) `PAIR_OFFHAND_DAMAGE_MULT = 1.0` — reserved lever the systems designer may want; wire
it into `handDamageMult` from day one so tuning never needs a code change.
**packages/shared/src/state.ts** — 4 appended `PlayerState` fields (§3.1).
**packages/shared/src/weapons.ts** — `pairEligible(lead, off)` pure predicate + load-time
`magazine ≤ 255` assert.
**packages/shared/src/melee.ts** — nothing required (hand vocabulary exists); optional comment pointing
hand-aware combo chains at §7.
**packages/server/src/rooms/GameRoom.ts** — `pairSlots`/`unpairSlots` handlers; `dissolvePair`,
`handDamageMult` (+ lead wrapper), `resolveHandAttack` extraction + parity/stagger gate + yield rule;
off-slot live ledger aging + `offCharges` mirroring; `stepStowedWeaponResources` exclusion;
`meleeSwings` re-key; guards in the §11 rows 5–14 sites; reset sweeps.
**packages/server/src/rooms/GameRoom.test.ts** — §12 suite.
**packages/server/src/rooms/progression.ts** — no change (documented lead-only, §11 row 18).
**Client (other implementer):** ArenaScene/SpriteRig off-hand render from `slots[offhandSlot]` + §7 hand
parity; HUD dual ammo from `offCharges`; pair/unpair UI sending the two messages; card UI pair readout.
Arena-carousel (non-belt) dual wield: deferred — needs a `weaponLedger`-keyed off ledger; out of v1.

---

## 14. Wave plan + schema-version ordering

Hard constraint: Colyseus appends are order-sensitive, and **schema 19 (enemy-combo) owns
GameRoom/state/constants/enemies/combat RIGHT NOW** — its wave appends `EnemyState` fields and
`PlayerState.juggledSeq` and reshapes parts of the tick. Nothing here may land, or even be rebased for
review, until 19 is merged; this doc plans strictly against post-19 code.

The ledger as claimed today: **18** committed · **19** enemy-combo (in flight) · **20** jump panel
(claimed, `PlayerState` stance/jump appends — docs/jumpfeel-panel/tech.md:176) · **ultimate panel**
"next free at merge time", 9 `PlayerState` appends (docs/ultimate-panel/tech-server.md:446–447).

**This feature takes next-available at merge time — provisionally `SCHEMA_VERSION = 21`, yielding to 22
if the ultimate panel merges first** (their doc reserves merge-time claiming exactly as ours does; both
waves append to `PlayerState`, so whichever lands second appends after the other's fields and renumbers
its claim — never reorder, never renumber theirs). Proposed ledger ordering, to be pinned in whichever
coordination doc the panels share: `19 enemy-combo → 20 jump → 21/22 ultimate & dual-wield in merge
order`. Our four fields are independent of jump's and ultimate's (no shared semantics), so ordering
between us and them is pure bookkeeping — but the *append position* in `state.ts` must reflect the final
merge order, which is why D2 (the schema wave) rebases last.

Waves (each independently shippable, tests green at every seam):

- **D1 — pure shared groundwork** (after 19 lands; no schema bump): `pairEligible` + truth-table tests;
  `PAIR_*` constants; the `resolveHandAttack` extraction refactor with **no behavior change** (existing
  suite is the net). Small, reviewable, unblocks the client panel's UI mocks.
- **D2 — the pair (schema bump, claim next-available):** §3.1 fields; `pairSlots`/`unpairSlots` +
  validation + guards (§4, §11 rows 5–14); off-slot live ledger + stowed exclusion; `offCharges`
  mirroring; tests §12.1/12.2/12.6/12.7. After D2 a pair exists, fires **lead-only** (off hand inert) —
  wire-complete for client work, exploit-law-complete for the advocate.
- **D3 — per-hand fire:** parity/stagger/yield gates; melee re-key + overlap; per-hand
  `handDamageMult`/receipts audit; tests §12.3/12.4/12.5/12.8. The feature is live.
- **D4 — polish riders:** curator/1H-band review with the systems designer (§10), hand-aware client
  combo chains (combat designer, cosmetic), arena-carousel variant decision.

Collision notes for the panel: jump's stance fields and ultimate's charge fields both live on
`PlayerState` beside ours — no field interacts, but all three waves touch the tick's player loop, so D3
(which restructures the fire dispatch) should merge in a quiet window and re-run the enemy-combo and
receipts suites, not just its own.
