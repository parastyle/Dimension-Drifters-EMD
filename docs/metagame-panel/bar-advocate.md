# Resource Bar — Devil's Advocate

`DECISIONS.md` is binding. Ammo, thrown charges, durability, and beam heat retire into one constantly recharging weapon-resource bar. Big weapons spend more. Holding a beam drains the bar and emptying it is the natural overheat lock. This review does not reopen that direction.

The direction is viable only if the bar is treated as one global debt system, not as a new skin over four old meters. The dangerous implementation is “delete magazines, add `resourceCost` to 316 rows, regenerate at a constant rate.” That ships melee starvation, hide-and-refill play, swap-cycling as the optimal rotation, double-billed pairs, a second invisible beam meter, and encounter damage windows tuned for an economy that no longer exists.

## 1. The melee question is the fault line

There are two coherent choices and no harmless compromise.

| Rule | What it preserves | What it breaks |
|---|---|---|
| Melee is free | Immediate basic attacks, current survivors-like flow, an escape from an empty bar | The bar becomes a ranged tax. Emptying a cannon or beam and swapping to melee is the new reload cancel. Melee ignores resource gear, heavy melee gets its power without paying the new universal price, and dual melee becomes the safest sustained damage in the game. |
| Melee spends | One honest weapon economy; heavy arcs, quakes, finishers, guns, throws, and beams can be compared on one budget | A poor tune makes the player press attack and receive nothing while a horde closes. Fast melee is punished repeatedly, and an empty bar can remove the game's basic verb. |

**Recommendation: armed melee spends resource, including fists.** Free melee is not a safety valve; it is a dominant swap target. The safety valve must instead be a mathematical sustain guarantee:

```text
For every baseline melee weapon at neutral stats and legal baseline cadence:

    costPerSwing / effectiveSwingInterval <= guaranteedRegenFloor

At zero resource:

    timeToNextBaselineSwing <= that weapon's normal effectiveSwingInterval
```

This means a normal cleaver can swing forever at its honest cadence without draining the bar. A greatsword still costs more per swing because its interval and load are larger. Quakes, finishers, extra targets, and other signature payloads add load and therefore create drawdown. Faster attack-recovery modifiers must recompute the accepted cost from the effective interval so “attack faster” does not secretly become “run dry faster.”

The sustain guarantee is a floor, not a promise that every melee build is resource-neutral. Heavy, AoE, dual-wield, proc-dense, and burst melee may drain. The invariant is that the naked baseline never becomes a non-attacking spectator because the resource economy was tuned around a cannon.

## 2. Constant recharge needs an anti-turtle law

Literal full-speed regeneration in every live state rewards leaving the pressure envelope, circling a landmark, and returning with a full burst. It also makes boss transitions, level-up folios, shop interactions, and long ultimates free reload booths. Fully pausing regeneration after attacks creates the opposite failure: the empty player cannot engage to earn recovery.

Use two rates and one explicit pause state:

- **Guaranteed floor regeneration** runs whenever the player is alive and the combat simulation is accepting movement. It is never removed by taking damage, being low on health, or having an empty bar. This is the melee sustain guarantee.
- **Engaged bonus regeneration** is available only when the player is under real pressure and the global recovery debt is clear. “Pressure” should be server-owned and cover-agnostic: a living hostile inside a broad threat radius, a recent combat receipt, or an encounter-director flag. Do not use line of sight; hiding behind one POI must not toggle the economy.
- **Disengaged regeneration** falls back to the floor after roughly two seconds outside pressure while enemies remain alive. Hiding still recovers, so the bar remains constantly recharging, but it is the slowest way to rebuild a heavy burst.
- **Zero regeneration** is reserved for downed/dead state and simulation-paused modal state. A scripted boss transition or punish phase must declare its intended mode explicitly rather than inheriting a menu rule by accident.

This is the anti-turtle law: full recovery is earned by staying in the fight and creating a real attack gap, while retreat still provides a nonzero recovery floor. No “recent hit dealt” requirement may gate the floor, because an empty player would enter a death spiral.

## 3. G-01 reincarnates as global recovery debt

The current G-01 fix persists cooldown, reload, and charge debt across swaps and applies a shared 150 ms draw lock. Removing private ammo does not remove the exploit family. It changes the attack:

1. Spend the bar with the expensive weapon.
2. Swap to the cheapest sustainable weapon.
3. Deal baseline damage while the bar refills.
4. Swap back for the next expensive burst.

Because all three weapons now share the refill, this rotation is more attractive than today's separate magazines. A shared bar alone does not close it.

The successor ledger must have three independent truths:

1. **The resource value is player-global.** Equip, swap, bind, unbind, bag equip, new pickup, death, and reconnect never initialize or refill it.
2. **Weapon cadence debt remains slot or identity local.** Existing cooldown debt continues aging while stowed. Swapping never erases a slow attack's recovery. The shared draw lock also survives and is never overwritten by a shorter weapon cooldown.
3. **Recovery debt is player-global.** Every accepted weapon action stamps debt for at least its effective action interval; resource spent above the sustainable floor extends it proportionally. While debt is live, only floor regeneration applies. A cheap attack stamps debt too. Swapping changes neither the debt nor its clock.

With the cost floor in §1, a continuously used cheap weapon spends at least its floor regeneration over time. It can maintain baseline output, but it cannot both attack continuously and refill the heavy reserve. A player may still weave weapons, but the profitable gap is a real gap in attacks, not an inventory trick.

This ledger must be one code path for the three-slot belt and the arena carousel. Recreating a per-slot bar in one mode or an identity-keyed refill exception in the other simply revives G-01 under different storage.

## 4. Dual-wield must not be billed twice

Today's pair already has a throughput ceiling of roughly `1.37x`, or `1.45x` for a matched pair, and alternates accepted hand actions. Under the bar, a pair should drain faster only because it produces more capped throughput, not because the economy charges two weapons for one beat.

The law should be:

- One accepted hand action creates one debit, derived from that hand's final post-cap contribution.
- Alternation naturally creates more debits per second. The resulting sustained spend should track the pair's actual `1.37x–1.45x` output, not jump to `2x`.
- Never charge both native weapon costs on every alternating beat. That is a double bill layered on top of the throughput cap.
- An authored `dual: true` weapon is one authored action. Its cost derives from the combined weapon definition and effective power, not `2 ×` an imagined single blade.
- Insufficient resource waits on the next legal hand. It does not skip to a cheaper hand, reset parity through bind/unbind, or mint a fresh draw beat.
- The existing single-channel beam exclusion remains. A pair does not create a second bar, second reactor, or second beam.

Separate off-hand magazines and `offCharges/offMaxCharges` die. The hand identity, pair tempo, per-hand cooldown, effects, muzzle, and receipts survive as behaviors that spend the one bar.

## 5. Beam law must be translated, not approximated

Players have learned a very specific current rhythm. The runtime clamps a fresh beam to at least 25% ignition heat, at least 60% heat per active second, at most 1.25 seconds of channel, at least a 1.5-second overheat lock, at most 35% cooling per second, and restart at no more than 35% heat. A full fresh channel therefore reaches overheat exactly after about 1.25 active seconds. The current lock also requires a release edge before a restart.

The direct one-bar translation is:

```text
resourceFraction = 1 - legacyHeat

ignition cost                 = 25 bar points
base active net drain         = 60 bar points per second
fresh full channel            = about 1.25 active seconds
empty                         = overheat edge
restart resource threshold    = at least 65 bar points, calibrated with the lock
release required              = yes
```

Because the bar is constantly regenerating, the authored gross beam drain must include the concurrent base regeneration if the desired **net** drain is 60 points per second. Otherwise a global regen or gear change silently lengthens every channel. The migration should calculate this relationship; it must not copy `heatPerSecond` into `resourceDrainPerSecond` and hope.

Empty-lock is equivalent in trigger but not in consequence. Today overheat locks only the beam; the player's other weapons retain their own ammo and cooldown economies. Under the ruling, a beam that reaches empty starves all three weapons until the shared bar rebuilds. That is a much larger penalty even if the red flash and 1.5-second lock look identical. Every beam must be retested against the baseline-melee time-to-next-swing guarantee, not merely against its old cycle DPS.

Preserve these semantics without preserving a second heat economy:

- Ignition is a discrete spend. Cancel-before-ignition, voluntary vent, forced cancel, and full overheat each need one explicit resource/debt rule.
- Voluntary release retains the remaining bar and keeps the short recovery beat. It is still the mastery play.
- Empty starts the beam-specific minimum lock and `requireRelease`. The beam cannot restart until both the lock and the resource threshold clear.
- The old `restartHeat=0.35` becomes a resource restart threshold near 65%, then is calibrated so the earliest unmodified restart matches the current learned cold-overheat cycle. There is no second cooling float behind it.
- Vent, lock, and restart gear may modify this cycle only through the shared resource budget and hard caps. A restore proc cannot bypass `requireRelease` or the minimum lock.
- Beam redline audio, shaft escalation, and muzzle distress derive from shared bar fraction while a beam is active. They remain beam presentation, not beam resource state.

The current private `beamLedger.heat`, synchronized `BeamState.heat`, independent heat arc, and heat percentage are redundant under Ruling #2. Keeping any of them as an authoritative gameplay value would mean the one-bar migration did not actually happen.

## 6. Ultimate charge stays separate

**Recommendation: keep ultimate charge separate.** It is a 0–100 earned-and-banked climax meter fed by combat receipts, kills, parries, and authored caps. The weapon bar is short-horizon exertion that continuously refills and is repeatedly spent. They have different fantasies, anti-exploit laws, pacing, and failure states.

Merging them would let waiting and resource-regeneration gear charge an ultimate, or make an ultimate cast remove the player's basic attacks. It would also invalidate the ultimate meter's anti-trash, per-tick, training, and no-double-bank laws. The ultimate cast should neither spend nor restore weapon resource, and weapon-resource gear must never alter ultimate gain. Its existing HUD ring remains beside the new bar as the only second meter.

An ultimate's untargetable or cinematic time must not silently grant engaged bonus regeneration. The ordinary floor may continue if the world simulation continues; any stronger recovery is an explicit family-level balance decision.

## 7. Resource recovery is the most dangerous gear stat

Universal regeneration improves guns, throws, beams, heavy melee, dual wield, and every future signature simultaneously. It is ammo capacity, reload speed, heat venting, and sustained damage in one affix. It also crosses thresholds: a small percentage can buy an extra shotgun blast, another beam pulse, or a full Vastaghar punish action. Face-value percentages underprice it.

Use one **resource-economy budget group** for all of the following:

- regeneration rate;
- maximum resource;
- cost reduction;
- flat or percentage restores;
- beam vent or restart acceleration;
- attack recovery when combined with any of the above.

The budget test is the actual change in three-second burst, repeated-cycle DPS, actions from full, time from empty to baseline swing, and beam restart time. Two improvements to the numerator and downtime of the same cycle are priced together, never as unrelated affixes.

Generic non-signature gear should retain the existing proposed `+18%` total recovery ceiling across the entire equipped loadout, pets, set bonuses, augments, and the full prestige hat tower. Cost reduction and restore procs consume the same ceiling by their simulated throughput equivalent. Multipliers combine once and clamp once. A signature may exceed the generic line only in its named delivery and only after worst-case fixtures; it cannot become universal regeneration by wording.

Do not put random resource regeneration on weapon affixes. Use fixed, authored gear values with a server-derived aggregate. A 30-hat account must hit the same hard cap as a one-hat account; otherwise prestige becomes exponential weapon uptime rather than a visible joke and badge.

## 8. Boss and encounter tuning has a wide blast radius

Average DPS parity is not enough. The old economies create weapon-specific burst and downtime windows; the shared bar synchronizes every weapon onto the same player-level reservoir.

- **Vastaghar:** a Stride Break is 64 ticks, or 3.2 seconds, at `1.2x` damage. The response window is only five ticks, while neutral gaps between attacks are roughly 0.55–1.0 seconds. If the bar refills too quickly during the dance, every Stride Break begins with the same universal full dump. If it refills too slowly, the player earns a break and has no weapon action to cash it. Measure resource at break start, affordable actions inside 3.2 seconds, and recovery during every phase deck.
- **Serraketh:** split punish is 24 ticks, split state lasts 160 ticks, and regrowth resolves over 110 ticks. Segment armor and exposed-core multipliers make damage timing more valuable than paper sustained DPS. A shared bar changes whether players can clear pressure, break a segment, and still exploit exposure. Measure bar state at split, sever, regrow, dive return, and terminal core windows.
- **Ordinary waves:** the survivors-like horde is the melee starvation fixture. A player at zero must still re-enter a baseline swing cadence while surrounded. Testing only on a stationary boss will miss the worst failure.
- **Co-op:** four players no longer bring twelve independently timed magazines/reactors; they bring four shared reservoirs. Coordinated burst becomes more synchronized, so phase floors, add clears, and invulnerability edges can amplify far beyond solo cycle-DPS estimates.

Encounter directors need an explicit regeneration-mode hook for authored transitions and punish windows. No boss should accidentally inherit “disengaged,” “modal pause,” or “full recovery” from distance alone. Re-capture Vastaghar and Serraketh with representative light melee, heavy melee, gun, throw, beam, and dual loadouts before accepting HP or window tuning.

## 9. HUD deletions and surviving information

The HUD should show one weapon-resource bar and the separate ultimate ring. The following current elements die rather than stack around it:

- gun ammo pips and large-magazine numerics;
- low-ammo amber/red treatment and `Reloading` copy;
- thrown charge pips and refill copy;
- the dual-wield off-hand ammo readout;
- the compact beam heat arc;
- the beam restart-heat marker;
- independent `Heat N%` and `Cooling N%` copy.

Beam `Locked` remains a state, but it is presented on the shared bar as a beam-specific red lock overlay and release prompt, not as another filling meter. The shared bar may preview the next action's debit and show the guaranteed floor versus engaged bonus rate. Weapon cooldown tells, pair-hand identity, beam charge anticipation, and signature VFX remain because they explain behavior, not a second economy.

The ultimate ring stays visually and spatially distinct. Calling both bars “charge” would recreate ambiguity, so the weapon bar needs a neutral name such as **Drive**, **Flux**, or **Arsenal** while the ultimate retains **Ultimate Charge**.

## 10. Migration needs a derivation formula for all 316 weapons

Hand-authoring one cost field per weapon guarantees arbitrary outliers and makes every future balance change a two-row edit. The cost must be derived from the same weapon definition and effective-power model used to curate drops, with family-level coefficients and rare audited overrides.

Recommended first formula:

```text
B       = bar capacity
Rfloor  = guaranteed resource per second
T       = effective accepted action interval after legal recovery modifiers
P       = base effective power, including bounded coverage/control/downtime credit
Pmed    = median P for the weapon's class and delivery
S       = size factor from S/M/L/XL tags

load    = clamp(1, loadMax, (P / Pmed)^0.75 * S)
powerCostPerUse = Rfloor * T * load

legacyUnitCost =
    B / magazine       for legacy guns
    B / maxCharges     for legacy thrown weapons
    0                  otherwise

costPerUse = quantize(max(powerCostPerUse, legacyUnitCost * burstRetention))
```

`effectivePower` must first be repaired to price every delivery, signature payload, beam duty cycle, pierce, bounce, AoE, control, and dual cap honestly. `S` enforces the ruling that physically big weapons pay more even when an odd statline understates them. `burstRetention` is a single delivery-level coefficient, not 316 knobs. Rarity, attributes, and ordinary damage gear do not raise cost; they are earned efficiency. Attack-recovery modifiers change `T` so their tooltip remains a benefit rather than a hidden resource penalty.

Continuous beams derive mechanically from their retired heat curve:

```text
ignitionCost     = B * legacyIgnitionHeat
grossDrainPerSec = concurrentBaseRegen + B * legacyHeatPerSecond
restartResource  = B * (1 - legacyRestartHeat), calibrated with minimum lock
```

The derivation tool must emit a review table for all 316 weapons: cost, gross and net spend per second, actions from full, time from zero to next action, time to empty under hold, repeated-cycle power, size, delivery, and the formula branch used. Any override needs a written reason, a bounded range such as `0.85–1.15`, and a golden test. If more than roughly 5% of the roster needs overrides, the formula is wrong and must be revised instead of normalizing hand-tuning.

Do not translate an in-progress room's three independent ammo/heat ledgers into one number. There is no fair mapping. Version-gate rooms: old rooms finish under the old economy; new rooms start with the bar. Persistent weapon identities in the bag survive, while transient magazine, reload, off-hand charge, and beam-heat debt expires at the room boundary. The schema migration removes or stops writing those mirrors only after every HUD and server consumer reads the bar.

## Guardrails

1. One authoritative player resource float; no per-weapon ammo, durability, charge, or heat float survives as gameplay truth.
2. Ultimate charge is a separate meter and never reads weapon-resource regeneration, capacity, cost, or restores.
3. Armed melee spends resource, and every neutral baseline melee satisfies the sustained-swing and time-to-next-swing invariants.
4. Resource value and recovery debt are global; cooldown debt remains per weapon; draw lock remains shared.
5. Continuous cheap-weapon use cannot produce positive net refill while dealing baseline damage.
6. Full regeneration requires engagement and cleared recovery debt; disengagement falls to the nonzero floor; only downed/dead or simulation pause reaches zero.
7. Dual wield pays once per accepted hand contribution and is priced by final capped throughput, never by a blanket `2x` debit.
8. Beam ignition, net drain, empty edge, release requirement, minimum lock, and restart threshold receive equivalence fixtures against today's learned cycle.
9. Emptying a beam is tested as a global weapon-starvation event, not merely a beam DPS cycle.
10. Generic resource-economy gear shares one simulated throughput budget and hard cap across gear, pets, augments, sets, and prestige hats.
11. One derivation function covers the 316-weapon catalog; overrides are bounded, explained, and rare.
12. Vastaghar and Serraketh acceptance includes bar-state captures at every punish, exposure, transition, and add-pressure window.
13. The HUD contains one weapon bar and one separate ultimate ring; beam heat, ammo, thrown charges, and off-hand ammo have no independent meter.
14. Old live rooms are not numerically converted mid-run; the economy changes only at a versioned room boundary.

## Three questions for the panel

1. Do we lock **costed armed melee**, including fists, with the invariant that neutral baseline swings are indefinitely sustainable and zero-to-next-swing is no slower than the normal cadence?
2. Do we lock **ultimate charge as separate**, with no weapon-resource gear, restore, spend, or regen interaction?
3. Do we lock the two-rate anti-turtle model: nonzero floor while alive, engaged bonus only under server-owned pressure with cleared global recovery debt, and zero only while downed/dead or simulation-paused?
