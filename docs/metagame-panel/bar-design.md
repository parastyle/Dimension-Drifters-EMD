# Resource Bar — systems design and technical plan

Status: design lock proposal, 2026-07-18. `DECISIONS.md` is binding. This brief adopts the Resource Bar
advocate's guardrails and the bank/gear panels' instance, budget, and run-boundary laws. It describes the
new-room economy only; an old live room is never numerically converted in place.

# SYSTEMS

## 1. Locked shape: one Drive bar, one separate Ultimate meter

The weapon resource is named **Drive**. Every player has one global **100-point Drive bar** shared by all
three active weapons, the Pack, paired hands, and fists. Armed melee, including fists, spends Drive.
Ultimate Charge remains the shipped, separate 0–100 earned meter: damage, kills, and parries fill it; Drive
regen, spends, restores, gear, and empty states never read or write it. An ultimate spends no Drive and
restores no Drive. During an ultimate, only the guaranteed Drive floor may run; cinematic time never earns
the engaged bonus implicitly.

Its shipped accounting remains intact: a private normalized float feeds the quantized 0–100 mirror; 30
applied damage grants one displayed point, a final blow grants 0.3, a successful parry grants 4, and one
20Hz tick admits at most 4 before the existing family/temper modifiers. Dummy/training damage and Ultimate
delivery remain excluded. None of those receipts is a Drive receipt.

At neutral gear:

| Quantity | Locked value | 20Hz consequence |
|---|---:|---:|
| Capacity | 100 | Fixed launch capacity; no generic capacity gear |
| Guaranteed floor regen | 20/s | 1 point per simulation tick |
| Engaged bonus regen | +15/s | Full engaged rate is 35/s, or 1.75 points/tick |
| Pressure memory | 2.0s | Recent real combat remains engaged briefly |
| Threat radius | 640 px | Broad, cover-agnostic, and equal to the beam range ceiling |
| Cost quantum | 0.25 | Costs round down to preserve the melee time guarantee |

The floor runs whenever the player is alive and the combat simulation is accepting movement. It never
waits for a post-shot delay and is never removed for taking damage, missing, or being low on health. Regen
is zero only while downed/dead or in an explicitly simulation-paused modal state. Level folios and the
authoritative shop modal are explicitly paused, so neither is a free reload booth. Boss transitions default
to floor regen unless their director explicitly declares `forceEngaged`; they never inherit full recovery
from distance, invulnerability, or UI state.

The extra 15/s requires both conditions:

1. global recovery debt is clear; and
2. the server owns evidence of pressure: a living hostile within 640 px, an incoming/outgoing/parry combat
   receipt in the last 2 seconds, or an encounter-director `forceEngaged` flag.

Line of sight is deliberately irrelevant. A player behind a POI remains under pressure. When enemies still
exist but none of the three predicates holds, regen falls to 20/s rather than stopping. This is the
anti-turtle law: retreat remains a nonzero recovery option, but staying in danger and taking a genuine gap
between attacks rebuilds at 35/s. Continuous cheap attacks do not earn the engaged bonus.

## 2. The successor to G-01: value, cadence debt, and recovery debt

The shared fill alone does not close swap cycling. The complete ledger has three independent truths:

- **Drive value is player-global.** Swap, equip, bind, unbind, Pack movement, a new pickup, down/revive,
  rift descent, shop entry, reconnect, and character/gear presentation changes never initialize or credit
  it. A fresh expedition starts at 100; reconnect resumes the exact live float; terminal settlement does
  not persist it to the account.
- **Cadence debt is weapon-instance-local.** The effective attack cooldown continues aging while stowed and
  follows the bank panel's stable `instanceId` through Active/Pack moves. The arena carousel uses the same
  law through its temporary weapon-id adapter. The 150 ms shared draw lock remains and is never shortened by
  a faster incoming weapon. A genuinely new pickup gets a fresh cadence row, never a fresh bar.
- **Recovery debt is player-global.** An accepted tap with effective interval `T` and actual debit `C`
  performs `debt = max(debt, T, C / 20)`. Debt ages in real seconds and no topology operation changes it.
  While it is positive, regen is the 20/s floor even if the player is surrounded.

For a baseline weapon, `C = 20T`: attacking continuously replaces exactly what it spends, keeps recovery
debt alive, and cannot refill a prior heavy-weapon deficit. A heavy shot stamps a longer debt. Swapping to a
cheap weapon preserves both that debt and the heavy weapon's cooldown; the cheap weapon can provide honest
baseline output, but it cannot simultaneously recharge the heavy reserve. A profitable refill therefore
requires a real attack gap, not inventory cycling. The zero-draw-lock hat removes only the 150 ms draw gate,
not cadence debt, recovery debt, or Drive cost.

## 3. One derivation covers the 316-weapon catalog

The current registry contains 316 real weapons plus the non-loot `fists` fallback:

| Delivery | Count | Resource branch |
|---|---:|---|
| Melee | 167 | Derived tap cost |
| Thrown | 10 | Derived tap cost with legacy burst retention |
| Gun | 114 | Derived tap cost with legacy burst retention |
| Cast bolt | 2 | Derived tap cost |
| Beam | 23 | Mechanically derived ignition and continuous drain |

No weapon receives a hand-authored `resourceCost` field. A formula-versioned generator reads canonical
`WeaponDef`s and emits a reviewable profile for every one of the 316 ids. Fists use the same formula at
runtime but are not a banked/catalog row.

### 3.1 Effective accepted interval and repaired power

`T0` is the weapon's neutral **accepted** solo interval, not merely its authored literal. The cadence helper
must reproduce the room's 20Hz behavior: resetting melee/thrown/cast cooldowns use the next legal 50 ms
tick, while accumulating gun cadence preserves its sub-tick remainder. `T` is that same helper after legal
affix, gear, pair-hand, and recovery modifiers. Faster attack recovery lowers per-use cost in proportion to
`T`, so it remains a benefit instead of secretly increasing resource drain.

The generator uses a repaired `resourceEffectivePower` rather than the legacy shell `damage` field:

```text
pierceTargets(p) = 1 + 0.6 * (min(6, p or 1) - 1)
reachCredit(r)   = 1 + min(0.4, r / 2500)

melee damage budget =
    edge damage
  + quake damage
  + 0.6 * chain damage * jumps
  + 0.7 * scatter damage * count
  + one scatter explosion

thrown damage budget = thrown damage * pierceTargets(pierce)

gun damage budget =
  (0.85 * gun damage * pellets * pierceTargets(pierce) + one explosion)
  * (1 + 0.5 * bounces)

cast damage budget = cast damage * pierceTargets(pierce)

P = damageBudget / T0 * reachCredit(effective range)
```

The bounded 0.6 chain/pierce, 0.7 scatter, 0.85 pellet, bounce, explosion, range, and beam-coverage terms are
the existing drop-curation grammar made complete. The repair must read `cast.damage/cooldown`, remove the
retiring gun reload and thrown refill time from `T0`, and use the shipped early-vent/full-overheat beam
cycle estimator for beam review power. An authored `dual: true` definition is already one combined action;
`P` never blindly doubles it. Dynamic paired weapons are handled after the throughput cap in section 6.

`Pmed` is the frozen median for the weapon's `classPool × live delivery` bucket. Formula v1 freezes the
current medians so adding one future weapon cannot reprice the existing catalog:

| Bucket | Frozen `Pmed` |
|---|---:|
| melee × melee | 21.4000 |
| melee × thrown | 54.4768 |
| ranged × gun | 58.7520 |
| caster × cast | 126.8185 |
| caster × melee | 51.0720 |
| caster × gun | 61.0667 |
| ranged × beam | 31.0259 |
| caster × beam | 20.9549 |

The two small beam/cast buckets are goldens, not permission to recompute medians at boot.

### 3.2 Cost formula and coefficients

For each non-beam weapon:

```text
B       = 100
Rfloor  = 20
loadMax = 2.50

sizeFactor(S/M/L/XL) = 0.90 / 1.00 / 1.15 / 1.30
load = clamp(1, loadMax, (P / Pmed)^0.75 * sizeFactor)

powerCost(T) = Rfloor * T * load

legacyNeutral =
    B / magazine * 0.35     for guns
    B / maxCharges * 0.45   for thrown weapons
    0                        otherwise

legacyCost(T) = legacyNeutral * T / T0

cost(T) = floorToQuarter(max(powerCost(T), legacyCost(T)) * override)
```

The legacy coefficients retain 35% of a gun magazine's and 45% of a thrown stock's old from-full burst
shape without preserving ammo counters. They are delivery-level constants, not per-weapon knobs. Damage
scaling, rarity, ordinary damage gear, requirements, and crit do not increase cost; earned power is earned
efficiency. Size and accepted interval make a physically large/slow weapon pay more per action even when an
odd damage line understates it. The 2.5 load ceiling keeps every current tap comfortably below the bar cap.

Formula v1 has one audited hand-tune exception: **Gravedigger's Spade uses `override = 1.15`** because a
successful swing can revive and that utility has no damage statistic. All other tap weapons use 1.00. Beam
translation is a formula branch, not an override. Every future override must be in `0.85..1.15`, carry a
written reason and golden, and remain on an explicit list. If the list exceeds 15 weapons (roughly 5% of
316), the formula fails review and is revised instead of normalizing hand tuning.

A dry run against today's registry produces these calibration bands:

| Delivery | Neutral cost range | Median | Important examples |
|---|---:|---:|---|
| Melee | 4–35 | 13.75 | Fists 7; Bowie Fangs 4; Tombstone 20.75; Wyrmtooth 33.5 |
| Thrown | 11.25–22.5 | 15 | Rusty Cleaver 15; Railspike 22.5 |
| Gun | 1.25–35 | 10.75 | Gatling 1.5; Revolver Cannon 10; Coffin Shotgun 17.5; Hand Mortar 19 |
| Cast | 7–14.75 | 14.75 | Storm Rod 7; Arcane Lance 14.75 |
| Beam | 25 ignition + continuous | — | 80/s neutral gross, 60/s net |

The generated review table also reports gross/net spend per second, actions from full, zero-to-next-action,
hold-to-empty, repeated-cycle power, size, bucket, formula branch, and override. These values are review
outputs; runtime consumes the generated profile plus live `T` and never trusts a client cost.

## 4. Melee answer: costed, with a mathematical baseline

Armed melee and fists spend Drive. Free melee would become the optimal reload-cancel destination and would
exclude melee, heavy arcs, and dual melee from resource gear and balance.

The `load = 1` branch is the neutral baseline. Because cost rounds down,
`cost / acceptedInterval <= 20/s`; continuous neutral use is indefinitely sustainable on floor regen, and
from zero the next baseline action becomes affordable no later than its next legal accepted interval. Fists
are the universal non-loot baseline: their effective 350 ms interval costs 7. Heavy, XL, quake, chain,
scatter, revive, high-coverage, intrinsic-dual, and runtime-paired melee can derive `load > 1` and draw the
bar down. The guarantee is deliberately not a promise that every burst melee build is neutral.

The generator asserts the inequality for fists and every `load = 1` melee row at neutral stats. Runtime
fixtures repeat it after every legal attack-recovery modifier using the recomputed `T`. A future modifier
may not speed the cooldown while leaving the old larger debit behind.

## 5. Guns, throws, cooldowns, and the reload decision

**Reload disappears as a gameplay gate; it does not survive as a hidden cadence texture.** A hard reload
counter would remain a second affordability clock, require the same G-01 topology ledger, and make the HUD
lie after ammo was declared retired. Gun `fireRate`, recoil, muzzle, pellets, spread, pierce, bounce,
projectile behavior, and ordinary per-instance cooldown survive. `magazine` remains authoring-only input to
the 0.35 legacy burst floor. `reloadSeconds` is ignored by new-room runtime and retired reload-trigger gear
is reauthored into the shared recovery budget or remains visibly unavailable.

Thrown `charges` and `refillSeconds` likewise stop gating attacks. `charges` remains authoring-only input to
the 0.45 legacy floor; the thrown cooldown, projectile, range, pierce, and effects survive. Durability had
only display scaffolding and retires with no conversion.

Consequently `charges/maxCharges`, `reloadCd`, `resourceCharges`, paired off-hand ammo, magazine pips, and
reload/refill copy are not alternate mirrors of Drive. New rooms stop reading them. Existing schema slots
may remain zeroed tombstones for append-only safety until a later protocol break, but they are never
gameplay truth.

## 6. Dual-wield billing under the throughput cap

The shipped 1.37× general and 1.45× matched-family throughput ceilings remain. One accepted hand action
creates one debit from that hand's **final post-cap contribution**:

```text
lead debit    = derived solo debit of the lead action
off-hand debit = derived solo debit of the off-hand action
                 * (post-cap off-hand contribution / honest solo contribution)
```

The same multiplier that trims or modestly boosts off-hand damage therefore trims or boosts its debit.
Alternation naturally creates more debits per second, so pair spend follows admitted 1.37×–1.45× output
instead of jumping to 2×. Never debit both native costs on one alternating beat. The six-beat melee
`both` pose remains one authoritative lead sweep and one debit. An authored `dual: true` item is one
definition, action, and debit.

If Drive is insufficient, the planned hand waits. The server does not skip to a cheaper hand, change
parity, or let bind/unbind mint a new beat. Per-hand cooldown and the global hand gate continue aging; pair
topology changes preserve them and global recovery debt. Beams remain pair-ineligible and cannot create a
second reactor.

## 7. Beam heat becomes the bar

For every current beam, `Drive fraction = 1 - legacy heat`. The 23 definitions share today's normalized
curve, so the neutral translation is exact:

| Current beam law | Drive law |
|---|---|
| 0.65s minimum charge | Charge anticipation remains; it spends nothing |
| 0.25 ignition heat | Discrete 25-point ignition debit |
| 0.60 heat/s | 60 Drive/s **net** active drain |
| Concurrent floor regen | Neutral gross debit is `60 + 20 = 80/s`; runtime gross includes the actual concurrent floor |
| 1.25s max fresh channel | `(100 - 25) / 60 = 1.25s`, exactly 25 active ticks |
| 1.5s overheat lock | Empty stamps the beam-specific minimum lock and global recovery debt |
| Restart heat 0.35 | Raw resource threshold is 65; v1 calibrates it to **68** for 20Hz cycle equivalence |
| Cooling 0.35/s after lock | Old 30 lock ticks + 38 cooling ticks = 68 ticks; new floor regen reaches 68 in the same 3.4s |
| Early-cancel heat 0.20 | Forced/pre-ignition cancel debits 20 and stamps the short recovery beat |
| Recovery 0.35s | Voluntary release keeps remaining Drive and retains the 350 ms restart beat |
| Release required | Still required after empty or cancel; restoration never synthesizes the edge |

Active beam ticks keep recovery debt live, so the engaged bonus cannot lengthen the channel. Generic gear
also cannot silently extend it: gross drain is recomputed as `60 + concurrent permitted regen`, preserving
60/s net. Empty is the natural overheat edge. It does not create a second heat value. Other weapons share
the depleted bar and become usable only as Drive rebuilds; a baseline melee action can recover on its
guaranteed timetable, but continuously using it consumes the 20/s floor and prevents the bar from climbing
back to the beam's 68-point restart threshold. That is both the global-starvation consequence and the
swap-cycling closure.

Normal release during Active adds no cancel debit. Releasing during charge, swapping, parrying, teleporting,
or another forced cancellation pays the 20-point commitment and 350 ms recovery; reaching zero by cancel
does not invent a full-overheat lock. A held beam that drains to zero does. Restart requires all three:
release observed, minimum lock elapsed, and Drive at least 68. A restore proc may help the threshold but
cannot bypass release or the minimum lock.

The server-private `beamLedger.heat`, descriptor heat/cool values as live gates, and any independent heat
float retire. During a compatibility wave, `BeamState.heat` may be written only as the derived alias
`1 - Drive/100`; it is never read by gameplay. It then becomes a zeroed legacy schema tombstone. Beam phase,
geometry, charge anticipation, redline audio, shaft escalation, release, and lock presentation survive.
They derive intensity from the shared Drive fraction. The compact heat arc and `Heat/Cooling N%` copy
retire: **the dock bar is the heat**.

## 8. Resource recovery as a gear budget

The guaranteed 20/s floor is immutable; generic gear modifies only full, pressure-earned recovery after
global debt clears. This preserves the baseline no-positive-refill law while allowing recovery gear to
improve every delivery's real attack-gap cycle. A `+6% resource recovery` line is **1 BU**. Generic effects
multiply the 35/s engaged rate once and share one hard **+18%** ceiling across gear, pets, augments, sets,
and the entire prestige hat tower; the maximum generic engaged rate is 41.3/s. Hiding remains at 20/s.

Capacity, cost reduction, flat/percentage restores, beam vent/restart acceleration, and attack recovery
when combined with any of those consume the same resource-economy group by their simulated throughput
equivalent. They are tested on three-second burst, repeated-cycle DPS, actions from full, zero-to-baseline,
and beam restart, not added as face-value independent percentages. Generic capacity gear and random weapon
affixes are out for launch. Multipliers compose once and clamp once.

Named signatures may exceed the generic line only in their delivery. Pressurized may keep its beam-only
25% vent and 0.5× empty-lock clauses after the full beam-cycle fixtures; it does not become universal
regen. Rimebrim's 12-point dodge restore remains bounded by its 4s cooldown, consumes the resource-economy
budget, and cannot bypass beam release/minimum lock. Cordell restores Drive rather than magazines. Coldsnap,
Bandoliers, reload-held-gun, extra-charge, and capacity effects must use this group, be reauthored, or remain
unavailable. Ultimate Charge is excluded absolutely.

## 9. HUD consolidation

The fixed weapon dock receives one always-truthful horizontal **DRIVE** bar in its non-fading truth layer.
The same component anchors to the weapon rail in belt mode. It shows authoritative fill, a translucent
preview of the next accepted debit, and one/two recovery chevrons for floor versus engaged mode. Low fill
changes color; a beam empty state adds a red `LOCKED · RELEASE` overlay to this bar. No independent restart
notch or percentage meter returns.

The following elements retire together: gun pips/numerics, low-ammo treatment, `Reloading`, thrown pips and
refill copy, dual off-hand ammo bars, beam heat arc, restart-heat marker, `Heat N%`, and `Cooling N%`.
Weapon cooldown/hand identity, beam charge anticipation, signature VFX, and the next-hand marker remain
because they explain behavior rather than affordability. Cards show the generated neutral Drive debit (or
`25 + 80/s` for a beam), never ammo. The separate Ultimate ring remains visually and verbally distinct as
**Ultimate Charge**.

## 10. Encounter acceptance

Average DPS parity is not enough. Encounter directors receive an explicit regen-mode hook and the release
captures bar state at authored windows:

- Vastaghar: Drive at every five-tick response, at Stride Break start, and affordable actions inside the
  64-tick/3.2s 1.2× punish.
- Serraketh: Drive at split start, the 24-tick split punish, sever, the 160-tick split state, the 110-tick
  regrow, dive return, exposed core, and terminal core windows.
- Ordinary horde: zero-Drive surrounded-player fixtures prove the baseline melee timetable.
- Co-op: four players' synchronized reservoirs are captured at phase floors, add clears, and exposure
  windows with light melee, heavy melee, gun, throw, beam, and capped dual loadouts.

No boss receives engaged, disengaged, or paused regen accidentally from range or a cinematic. HP and punish
windows are retuned only after these captures, not from paper sustained DPS.

# TECH

## 11. Authority, schema, and runtime ownership

Drive truth is a server-private float in `CombatState`/the run runtime:

```ts
interface DriveRuntime {
  valueF: number;                 // clamped 0..100; only spend/regen/restore code writes it
  recoveryDebtF: number;          // player-global seconds
  pressureUntilTick: number;      // receipt memory
  regenMode: 0 | 1 | 2;           // paused / floor / engaged
  beamLockEndTick: number;
  beamRecoveryEndTick: number;
  beamRequireRelease: boolean;
  tickCreditF: number;            // one 20Hz integration accumulator
  tickDebitF: number;
}
```

Append one nested `WeaponResourceState` to `PlayerState` at the **merge-time next available schema version**
(currently that would be 28; do not reserve the number if gear lands first):

```ts
class WeaponResourceState extends Schema {
  @type("uint16") valueQ = 10_000;       // hundredths of a point, floor(valueF * 100)
  @type("uint8") regenMode = 1;          // HUD affordance only
  @type("uint32") beamLockEndTick = 0;   // late-join-safe lock overlay
}
```

The nested row costs one direct `PlayerState` field and respects its direct-field ceiling. Capacity is fixed,
so no max mirror is needed. The server spends and tests affordability against `valueF`, never `valueQ`.
The mirror is floored so a client never displays more affordability than authority. It updates after the
fixed tick's mutations. Old charge/off-charge fields stay zeroed tombstones during the append-only era.

The fixed-step integrator computes the tick's permitted regen credit once, lets accepted actions accumulate
debits through the single spend seam, then commits `clamp(value + credit - debit, 0, 100)`. This simultaneous
credit/debit ordering preserves one floor point on the beam ignition tick and produces exactly 3 net points
of active beam drain per tick. Regen, beam drain, pair alternation, and catch-up substeps are never integrated
from render delta or message arrival.

The Drive runtime belongs to the player/run reservation, not a slot. Per-instance cadence rows live in the
bank panel's `RunWeaponLedger`; Active/Pack rows are projections. Reconnect rebinds the same runtime. A new
room initializes it once at 100. Old rooms retain their old economy until teardown.

## 12. One authoritative spend seam

Every player weapon fire path must call one function before it stamps `attackSeq`, spawns a projectile,
registers a sweep, creates secondary payloads, or writes damage receipts:

```ts
trySpendWeaponResource(player, combat, {
  weaponInstanceId,
  weaponId,
  delivery,
  hand,
  effectiveInterval,
  pairContribution,
  continuousDt,
  reason, // tap | beam-ignite | beam-active | beam-cancel
}): SpendResult
```

The request carries identity/context, never a client-authored amount. The function resolves the generated
profile, canonical weapon, live `T`, pair post-cap multiplier, beam branch, lock/release gates, finite/clamp
checks, and recovery-debt stamp. It returns accepted/rejected, committed debit, and beam-empty edge. A reject
creates no attack beat, projectile, sweep, quake, chain, scatter, rez, pet accepted action, ultimate gain, or
receipt. Secondary sources are included in the initiating profile and never billed again.

Required callers are:

- the solo gun, thrown, cast, and melee branches in the tick dispatcher;
- `resolveHandAttack` for each accepted paired hand, after computing the throughput-cap contribution;
- beam ignition, every 50 ms active contact step, and forced/pre-ignition cancel;
- fists through the same melee branch.

Voluntary beam release changes gates/debt but has no extra debit. Resource restores use one separate
`creditWeaponResource` authority seam because they are credits, not fires; it caps at 100, applies the
resource-budget rules, and cannot clear beam release or minimum-lock state.

The spend happens atomically before effects. A dry buffered tap is consumed rather than firing later after
the player's aim/context changed; a held trigger may present a fresh intent on its normal cadence. A dry
paired beat preserves the planned hand/parity. No swap, bind, unbind, bag move, new pickup, revive, rift,
reconnect, Zero-Latency draw-lock rule, or carousel transition calls either initialization or credit.

## 13. Cadence and legacy-ledger retirement

Extract one shared `effectiveAcceptedWeaponInterval` used by formula generation, solo cooldown assignment,
paired hand gates, stowed cadence aging, client affordance, and tests. This removes the current scatter of
gun/cast/melee/thrown assignments. Bank-enabled rooms key cooldown by `weaponInstanceId`; training carousel
compatibility keys it by definition id. Stowing changes identity, never elapsed time.

In the new economy, delete runtime reads/writes of gun/thrown `charges`, `reloadCd`, slot `reload`, slot
`resourceCharges`, `effectiveMaxWeaponCharges`, paired `offCharges/offMaxCharges`, and reload/refill stepping.
Do not replace them with an undisclosed shot counter. The authored magazine/charge values are generator
inputs only. The G-01 transition matrix continues for instance cooldown, global draw lock, Drive value, and
global recovery debt.

## 14. Beam conversion and predictor implications

Beam gameplay reads Drive only. Replace `beamResource()`/the per-weapon heat map with the one global runtime;
replace heat comparisons with ignition affordability, empty edge, minimum lock, release, and the calibrated
68 threshold. `BeamDescriptor` keeps immutable geometry/damage/charge/steering values but no authoritative
heat curve. `finishBeam` and `cancelBeam` translate to the explicit Drive rules in section 7. During one
compatibility schema, `BeamState.heat` is a derived alias; the HUD and gameplay must stop reading it before
it is frozen as a tombstone.

Client prediction remains affordance only:

1. The quantized mirror rebases a local visual shadow; the HUD may interpolate toward expected regen but
   affordability never authorizes server damage.
2. Tap prediction uses the generated profile, shared effective-interval helper, authoritative pair link,
   and next-hand contribution to preview/subtract a pending debit. `attackSeq` confirmation removes pending
   taps; a patch rebases and replays only the unconfirmed visual tail.
3. A predicted-dry press still sends ordinary intent at the bounded local cadence. It shows a dry fizzle and
   withholds optimistic attack/contact VFX; if authority has enough Drive, the authoritative `attackSeq`
   starts the action. Stale low mirrors therefore cannot eat a valid server action.
4. A predicted-affordable tap may start local pose/muzzle/contact presentation, never projectile authority,
   damage, reward, ultimate gain, pet action, or receipt. Rejection receives no `attackSeq` and the harmless
   prediction expires.
5. Beam input remains `fireHeld` in the 20Hz input command. The owner may predict only the non-damaging
   charge knot/aim. Ignition, active shaft, drain, empty, lock, and restart come from Drive plus the
   authoritative `BeamState`; there is no client heat simulation.
6. Swaps and pair topology never reset the local shadow. A topology patch changes only the next debit and
   hand identity; the next Drive patch rebases value.
7. Movement prediction/replay is unchanged. Drive is not a movement input and is never reconstructed from
   render frames.

## 15. Migration waves

| Wave | Work | Exit gate |
|---|---|---|
| R0 — formula table generation | Add repaired pure power/accepted-interval helpers, freeze formula constants and medians, generate all 316 profiles plus review table, and pin the single override. No runtime behavior change. | Totality, representative goldens, distribution bands, and override cap green. |
| R1 — server spend seams | Add next-available nested schema, private Drive/debt/pressure runtime, one spend and one credit seam, instance cadence integration, and shadow accounting beside old gates. Then version-gate new rooms and atomically retire gun/thrown ammo/reload gates. | Every fire path accounts once; old rooms remain old; G-01 and dual matrices green. |
| R2 — HUD | Add the dock Drive bar, debit preview, regen mode, dry feedback, and card costs. Remove ammo/throw/off-hand/reload presentation. Keep the legacy beam arc temporarily only for parity comparison. | One bar plus Ultimate ring; owner/late-join/spectator layouts and accessibility green. |
| R3 — beam retirement | Move ignition/drain/cancel/lock/restart to Drive, derive the compatibility heat alias, retire heat authority and the arc, reauthor beam gear, and run encounter captures. | Old→new channel/restart equivalence, global-starvation, gear caps, and boss-window acceptance green. |

No deployment translates three independent magazines/charge rows/heat ledgers into one value. The room's
economy epoch is fixed at creation. Persistent weapon instances cross the boundary; transient resource and
cadence state does not.

## 16. Test strategy

### Formula and totality

- Assert exactly 316 non-fists ids, no missing/extra profile, 167/10/114/2/23 delivery census, finite values,
  costs in `(0, 100]`, frozen medians, and deterministic output order/hash.
- Golden the formula constants, all active examples in section 3, min/median/90th/max bands, beam profiles,
  and the one 1.15 Spade override. Fail if an override is out of range or the list exceeds 15.
- Mutation tests change damage, accepted cooldown, size, magazine/charges, pierce, bounce, quake, scatter,
  cast, and beam fields and prove the intended profile column changes. Rarity/attributes/ordinary damage
  gear must not change neutral cost; legal attack recovery must change `T` and per-use cost together.
- Assert fists and every load-1 melee satisfy `cost/T <= 20` and zero-to-afford at 20Hz is no later than
  its accepted interval. Heavy/AoE/dual rows are reported rather than silently clamped into baseline.

### Anti-turtle and recovery debt

- Simulate continuous baseline melee for 60 seconds: Drive is stable within one cost quantum, debt never
  clears, and no engaged bonus leaks in. Stop under pressure and prove 20/s until debt clears, then 35/s.
- With no threat/receipt/director flag, prove 20/s forever; a POI/line-of-sight change does nothing. Verify
  the 2-second receipt memory and 640 px boundary. Only downed/dead or declared pause yields zero.
- Fire a heavy action, swap through all slots while using a cheap baseline, and prove value/debt cannot rise;
  take a real attack gap and prove recovery resumes. Ultimate phases receive floor only.

### Swap-cycling/G-01 closure

- Cover Active↔Active, Active↔Pack, pickup replace, drop/regrab, bind/unbind, pair dissolve, carousel Q/E,
  new pickup, down/revive, rift, shop, reconnect/rebind, and zero-draw-lock topology. Drive and global debt
  never initialize; exact instance cooldown follows the instance and ages once.
- Repeated/replayed topology messages, a newly minted instance, duplicate base ids with different instance
  ids, and pair moves cannot mint fill, shorten global debt, double-age cadence, or create a fresh beat.

### Beam equivalence

- At 20Hz from full: charge for the same accepted epoch, debit 25 at ignition, net-drain 3/tick for exactly
  25 active ticks, and reach zero at 1.25 active seconds.
- Golden old versus new full-overheat restart: old 30 lock + 38 cooling ticks; new release + 1.5s minimum
  lock + 20/s floor to 68; both first restart on tick 68 (3.4s). Test early release, pre-ignition cancel,
  forced cancel, stale held-input watchdog, restore during lock, and require-release.
- Generic engaged bonus never extends Active; permitted regen is included in gross drain. Pressurized and
  capped generic recovery alter only their approved recovery rows. No heat float can reject or accept fire.
- Emptying a beam is a global zero-bar fixture: other weapons wait for their cost; continuous baseline melee
  cannot rebuild to 68; an actual attack gap can.

### Dual billing and fire-path completeness

- For matched/unmatched, melee/gun/cast, weak/strong off hand, rarity/affix/requirements, and solo-cover
  histories, assert one accepted hand contribution produces one debit scaled by the same post-cap multiplier.
  Pair sustained spend tracks admitted 1.37×/1.45× throughput and never 2×.
- A `both` pose and an authored `dual: true` item debit once. Dry next hand preserves parity. Bind/unbind
  cannot bypass cost, hand gate, cooldown, draw lock, or recovery debt.
- Instrument the single spend seam and assert solo melee, gun, throw, cast, fists, paired hands, beam
  ignition/active/cancel each hit it exactly as specified; secondary quake/chain/scatter/rez never double bill.

### HUD, migration, and encounters

- Owner/remote/late join/reconnect see the quantized value, regen mode, and lock epoch; prediction is never
  reward authority. Ammo, reload, thrown, off-hand, and heat meters have zero live consumers.
- Mixed economy versions cannot join one room; old rooms finish unchanged and new rooms never initialize old
  ledgers. Schema mismatch forces the existing hard reload.
- Capture the Vastaghar, Serraketh, ordinary-horde, and 1/4-player matrices from section 10 before accepting
  HP/window changes.

## 17. Three implementation questions

1. **Bank dependency:** will bank wave B3's stable `weaponInstanceId` ledger land before R1? Recommended: yes
   for banked rooms; otherwise R1 needs an explicit training-only definition-id adapter that cannot ship as
   the persistent topology key.
2. **Regen-mode owner:** which reducer owns paused/floor/engaged declarations from level folios, shop UI,
   ultimates, and encounter directors? Recommended: one `GameRoom` reducer consumes explicit subsystem flags;
   no caller writes `regenMode` or Drive directly.
3. **Wire visibility:** should `WeaponResourceState` remain public for spectator/replay and remote beam tells,
   or become owner-filtered when StateView arrives? Recommended: public quantized state for v1, with the
   private float/debt/pressure inputs permanently server-only.
