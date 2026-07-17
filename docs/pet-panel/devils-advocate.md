# Pet System Panel — Devil's Advocate

Panel role: devil's advocate. Scope: design only. No implementation is authorized by this document.
The directive is accepted: one pet may accompany a player from the start of a run, it follows like a
MAG, and account progression levels one or two fixed benefits associated with that pet.

## Verdict

**Conditional approval.** A pet can be a strong visible piece of account identity. It cannot become a
second character quirk, a portable augment tree, or a moving proc dispenser. The safe v1 is:

- one dedicated pet slot, chosen before readying and immutable for the whole run;
- one account-wide level record per pet, with no pet copies or per-loadout levels;
- one narrow numeric specialty per pet; a capstone may deepen that specialty, not introduce an
  unrelated second axis;
- server-authoritative passive modifiers whose outcome never depends on the pet's rendered position;
- a client-cosmetic, non-targetable follower with no collision, pickup, attack, aura, or hitbox.

I reject the green butterfly example **as a single pet exactly as phrased**. An HP-regeneration
multiplier is one survival axis; an extra weapon charge is a second resource/DPS axis. Paying one pet
choice for both is precisely how permanent loadout power escapes its budget. Those are two valid pet
concepts, not one valid pet.

## 0. Ground truth and hidden premises

| Existing contract | Consequence for pets |
|---|---|
| Permanent upgrades already buy three levels of Vitality, Fortune, and Power with Scrip (`packages/shared/src/meta.ts`). Vitality can add 60 max HP; Fortune and Power feed stats that already scale loot/crit and damage. | A pet is another permanent combat input, not harmless collection flavor. It must be budgeted with maxed upgrades, not against a fresh account. |
| Persistence is currently an MVP: Scrip and upgrade levels live in client `localStorage`; `GameRoom.onJoin` accepts them only behind dev-tools because a public client could forge the account (`ArenaScene.ts:9527-9557`, `GameRoom.ts:2244-2267`). | Secure pet XP cannot honestly ship as a public meta economy until an authenticated account store owns it. Sanitizing a client level cap prevents crashes, not cheating. |
| The character merge is already represented in `character-classes.ts`: one quirk per character, including pickup attraction, cooldown reset, magazine size, reload-on-roll, regen shutdown, loot, and shop rules. Several are deliberately inert until their authoritative seam exists. | A pet must not quietly implement the same rule first or give every character a weaker copy of a character's only identity. |
| Augments are stackable in-run modifiers. Overcharge is +25% cast damage per stack; Vented Coils is +25% beam cooling per stack; Second Wind stacks CON-scaled healing (`augments.ts`). | “Only 5% more” at the pet layer is not only 5% after six augment picks. |
| Arsenal composition already grants ×1.08 at two and ×1.18 at three matching weapon disciplines (`weapons.ts:339-359`). Loot rarity and affixes multiply again; a Blessed Cursed weapon contributes ×2.4 damage (`loot.ts:40-80`, `:122-130`). | No pet may multiply the already-final damage or cooldown result. |
| G-01 stores `{ cooldown, reload, charges }` per arsenal slot server-side; stowed debts continue to age and only the active `charges/maxCharges` are replicated (`state.ts:8-20`, `GameRoom.ts:1531-1653`). | “One extra charge” is a ledger migration problem and an exploit surface, not a tooltip-only stat. |
| The authoritative sim is 20 Hz. A measured legal stress patch averages about 4.29 KB; 80 moving enemies alone cost 1,126 B/patch (`structure-latency-panel/netcode-latency.md:103-123`). | A moving authoritative pet row has an observable forever-tax even if its AI is trivial. |
| The render hierarchy protects exact telegraph geometry on dedicated depths 3 and 99997; actors are y-sorted. Paper motion is explicitly scarce, and `PROCEDURAL_JIGGLE` is client-cosmetic (`ArenaScene.ts:906-911`, `:1814-1823`; `constants.ts:62-72`; `paper-panel/devils-advocate.md`). | Pet charm never outranks a danger edge, enemy silhouette, pickup, or downed body. |
| The redesigned weapon dock enlarges only while awake; the Backpack/Trading Post already carries weapons, ammo, set bonus, Scrip, permanent upgrades, and interaction copy (`dockux-panel/designer.md`). | The pet does not get squeezed into an arsenal card, Backpack cell, or another permanent Trading Post row. |

The code's room ceiling is currently ten players even though the product target here is four
(`constants.ts:282`). Pet presentation therefore needs an explicit four-visible-pet contract; relying on
“the room will never exceed four” leaves a dev, spectator, or later mode able to create ten followers.

## 1. Stacking axes: give every system one job

The panel needs a taxonomy before it needs a pet roster.

| System | Exclusive job | It must not steal |
|---|---|---|
| Character quirk | One rule the character bends | Generic permanent coefficients, pet levels, or another selectable rule-bender |
| Meta upgrades | Broad permanent base-stat growth bought with Scrip | Conditional procs, companion identity, or in-run drafting |
| Pet | One narrow permanent specialty selected in one pet slot | New verbs, action resets, pickup AI, loot rules, augment/ultimate manipulation, or set counting |
| Augment | Conditional, stackable in-run proc/modifier | Permanent account power |
| Set bonus | Reward for equipped weapon composition | Companion or character identity |
| Ultimate | Active in-run burst verb and its own charge law | Passive permanent throughput |

### The one-axis/one-budget law

Every pet definition must declare exactly one `budgetKey`, such as `sustain.regen` or
`resource.ammo-efficiency`. All ordinary levels and the terminal level spend that same budget. A pet may
have at most two tooltip clauses only when clause two is the capstone expression of clause one.

- Valid shape: “+flat baseline regeneration; at max, regeneration continues briefly after taking a hit.”
  Both clauses are sustain and can be evaluated in one recovery budget.
- Valid shape with scrutiny: “Every twelfth accepted ammo/throw spend refunds one charge to that same
  slot; at max, every tenth spend does.” Both clauses are ammo efficiency and retain debt.
- Invalid shape: “Regeneration multiplier; at max, +1 weapon charge.” Survival and weapon output cannot
  be compared or tuned as one choice.
- Invalid shape: “Pickup motes; at max, extra loot roll.” That duplicates Bryda's pickup rule and Odette's
  loot rule, creates position authority, and changes the economy.

Pets never touch these quirk-owned or system-owned keys in v1: pickup attraction, Scrip minting, drop
chance/rarity, shop offers, arsenal/Backpack capacity, roll/parry charges or i-frames, cooldown resets,
draw-lock, enemy targeting, telegraph timing, set counts, augment drafts/stacks, ultimate meter/charge,
extra projectiles, friendly zones, decoys, or teammate-wide auras.

### Multiplicative-creep audit

These are not hypothetical “maybe strong” interactions; they follow current or in-flight numbers.

| Stack | Failure | Required ruling |
|---|---|---|
| **Regen pet × CON × healing quirks/augments.** Base regen is `6 + 0.7 × (CON-1)` HP/s. The class-merge ceiling of 62 CON yields 48.7 HP/s before a pet. A ×1.5 butterfly makes that 73.05 HP/s, alongside Second Wind, parry-chain healing, Graveside Manner, ally healing, and up to +60 permanent max HP. | The multiplier rewards the same CON investment twice and erases attrition. Damage must jump to remain threatening, punishing everyone without the pet. | A regen pet adds to the **6 HP/s baseline only**, never multiplies CON-derived regen or event heals. At max it may improve net recovery by at most 10% in the max-CON/max-meta sustain fixture. Zero stays zero: Hollow Oath's “regen stops” cannot be resurrected by operation order. |
| **Pet damage × rarity/affix × set × augments × quirk × crit.** Blessed Cursed is ×2.4; a 3-set is ×1.18; six Overcharges are ×2.5. That is ×7.08 before attributes or crit. Add the proposed low-HP Hollow Oath ×1.3 and a ×2 crit and the peak is ×18.408. A modest final ×1.10 pet makes it ×20.249. | A “small” final multiplier adds 1.84 base attacks at the legal peak and makes pet choice mandatory for damage builds. | No final damage multiplier or cooldown/fire-rate multiplier on a v1 pet. If offense pets are introduced later, add them into a named additive source budget before existing final multipliers and test the full legal cross-product. |
| **Charge capstone × two-shot weapons × Bandoliers × Coldsnap.** A Coffin Shotgun has two shells and a 1.6s reload. Flat +1 is +50% immediate burst. The planned Bandoliers quirk adds 50% magazine capacity; naïve rounding plus a pet can take two shells to four, doubling the base burst. Coldsnap can then erase a reload by rolling. | Capacity is nonlinear on small magazines and reset mechanics. “+1” is not remotely equal across a 2-shell shotgun, 3-charge cleaver, and 50-round gatling. | The universal +1 capstone is not approved. Any ammo pet must be cycle-normalized per weapon and remain below the output guards below. Capacity, refunds, and reload triggers all operate on the same slot ledger. |
| **Cooling pet × Vented Coils × Pressurized.** Beam recovery already computes `(1 + 0.25 × stacks) × 1.25` for Tinker-Magnus (`GameRoom.ts:3785-3803`, `:3998-4024`). | A third recovery multiplier makes channel duty cycle outrun the beam power estimator and turns one character rule into a generic pet stack. | No pet cooling/overheat multiplier while those effects multiply. A future pet must enter the same additive cooling pool and preserve the authored minimum recovery/lock. |
| **Economy pet × Fortune/LUK × The House/Posted/Snake Oil/Crowmantle.** | Permanent power accelerates the acquisition of more permanent power; co-op loot ownership also becomes contested. | Pet XP, Scrip, loot count, rarity, salvage, and shop prices receive exactly 0% pet modification in v1. |

### Hard balance envelope

Every maxed pet is tested against no pet over all weapon families and the legal extremes of character
quirk, 0/max meta, 0/max relevant augments, 0/8%/18% set bonus, common/peak loot, and low/max relevant
attributes. A pet fails if any one fixture exceeds:

- **+8% sustained single-target output** over a complete fire/reload or action/recovery cycle;
- **+15% damage in any rolling three-second burst window**;
- **+10% effective survivability or net recovery**, including passive regen, shields, event heals, max HP,
  and damage reduction—not 10% in each subcategory;
- **zero additional projectiles, targets, zones, pickups, loot rolls, Scrip, XP, set counts, augment stacks,
  ultimate charge, or inventory slots** in v1;
- **no pet that improves the same `budgetKey` as the selected character quirk.** The loadout screen must
  reject that pairing with plain copy, not silently cap one effect. If this produces too many rejections,
  the pet roster is occupying the quirk axis and must be redesigned.

An average-case DPS spreadsheet is insufficient. The lowest-magazine weapon, max-CON build, strongest
loot identity, six-stack augment case, and each reset/reload quirk are the acceptance cases.

## 2. “Set in stone” is a trust law, not a promise never to balance

Players will spend hours for a terminal effect. Changing “extra charge” into “5% reload speed” after they
finish is a bait-and-switch even if the new pet has the same internal power score. Conversely, promising
that a numeric exploit can never be nerfed is incompatible with authoritative co-op balance.

The contract should be stated before anyone earns pet XP:

1. **Identity is immutable.** A pet's `budgetKey`, trigger, eligible weapon/effect family, capstone topology,
   silhouette, and fantasy do not change. The butterfly remains a sustain pet; it never becomes crit or
   ammo because sustain was nerfed.
2. **Numbers are balanceable inside disclosed bounds.** Ordinary numeric tuning may move by at most 10%
   relative per patch and never outside the power envelope. Tooltips show live authoritative values, not
   copied prose.
3. **Material nerfs compensate.** More than a 10% value reduction, a new eligibility exclusion, or any
   capstone behavior change refunds 100% of invested pet XP into an account bond reserve and grants one
   free pet reselection before the next run. No expiry.
4. **No grandfathered combat versions.** Old overpowered pets cannot remain stronger in online co-op.
   Accounts store `{petId, level}`, not frozen coefficients. A room snapshots one definition version at
   run start; a deployment does not mutate a live run.
5. **Emergency disable is explicit.** An exploitable effect may be server-disabled, but the pet card says
   “Effect temporarily disabled,” progression pauses without loss, and the compensation rule applies if
   the disable survives the next patch.
6. **“Set in stone” means no rerolls.** No random skills, nature rolls, feed outcomes, rarity rolls, or
   rotating terminal bonuses. The exact level-one effect and exact max-level capstone are previewed before
   the first XP is invested.

Anything weaker teaches players that pet descriptions are temporary advertisements.

## 3. Meta-progression pacing without a farm trap

### Account shape

There is one canonical account record per pet id. Its level follows the player across characters, modes,
and loadout presets. The selected pet slot is only a reference to that record. There are no per-character
pets, no per-slot duplicates, and no “same butterfly, but this copy is level 3” inventory.

Recommended linear shape: **10 levels**. Level 1 grants a useful core at 60% of its max numeric value;
levels 2-9 improve it in visible increments; level 10 grants the disclosed capstone. There are no dead
levels. The capstone may consume at most 40% of the pet's total power budget, so an unmaxed pet is not a
deliberately bad item the player is forced to carry.

Pacing acceptance target from first equip to level 10:

- median **4-6 active hours**;
- roughly **six successful full runs or ten ordinary mixed-outcome attempts**;
- never below three hours through an optimized shallow farm;
- 90th-percentile engaged player finishes within eight hours;
- no single run grants more than 20% of a pet's total XP.

Those are telemetry gates, not launch-day guesses. Costs must be tuned from observed boss-clear and run
duration data before the terminal level is enabled.

### What awards pet XP

Do not put pet XP on trash, XP motes, last hits, elapsed time, damage dealt, pickups, or steps traveled.
Each creates the behavior it measures: circle a safe trash spawn, steal last hits, idle, ignore the boss,
or deliberately prolong a won room.

Use end-state milestones only:

- each **unique depth boss clear in that run** awards a banked bond amount once;
- each deeper clear is worth at least 1.5× the prior depth, so descending is more efficient than resetting;
- extraction adds a 25% bonus to that run's cleared-boss bond; a wipe keeps cleared-boss bond but loses
  the extraction bonus;
- leaving before the first boss clear awards zero;
- the equipped pet receives the bond after the run result, never during combat.

This makes throwing after a clear worse than extracting, makes deeper play better than shallow loops, and
does not erase all progress on a failed deep attempt. The exploit metric is hard: the best scripted
reset/throw route may not exceed the intended full-run bond per active minute by more than 10%.

Only the selected pet levels. That preserves “bond with the companion you bring” without a second spendable
XP currency. A maxed pet should still show post-run bond as `Maxed` and discard it; adding an overflow
wallet solely to avoid that feeling creates yet another economy and encourages always wearing the strongest
pet to level pets never used.

## 4. The one-pet slot: real commitment, not a hotbar

The pet slot lives in pre-run loadout and locks when the player readies. It cannot change at a shopkeeper,
Backpack, level-up, rift, death, revive, or reconnect. Reconnect restores the room's snapshotted pet id,
level, and definition version; it does not reread the account. Testing Grounds may switch pets only by
resetting the test run and every combat/resource ledger.

Mid-run switching is indefensible:

- equip regen only while injured, then swap to damage;
- equip capacity before a reload or pickup, then remove it while preserving surplus charges;
- equip loot immediately before a boss death;
- equip pickup attraction only while collecting;
- cycle capstones to reset their once-per-run or per-slot counters.

One selection at run start turns the pet into a build commitment and makes every modifier snapshot stable.
It also gives co-op peers one readable companion per owner instead of an identity that changes during a
fight.

Choice pressure must not become FOMO. All pet cards preview level-one and level-ten behavior; no pet has
time-limited power, daily XP, login streaks, paid XP boosts, or season-exclusive stats. Cosmetics may be
limited only if they are mechanically identical skins. Same-pet squads are allowed—forcing four players to
negotiate unique picks is social friction—but owner marking must keep duplicates attributable.

## 5. Authority line and the price of a follower

### Model A — recommended v1: cosmetic body, authoritative passive

The server snapshots `petId`, pet level, and definition version at run start and resolves the pet's passive
at the same authoritative seams as stats, damage, regen, or weapon resource spending. The client renders a
follower from the owner's already-replicated/predicted player pose.

The rendered pet position has **no gameplay meaning**. It may trail, bob, overshoot, teleport-rebase, pass
through walls, overlap an enemy, or be hidden without changing a single outcome. The client sends no pet
movement or pet-action messages.

Cost target:

- steady-state pet-position wire: **0 B/patch**; only pet identity/level changes once on join/run setup;
- server: no pet collection, no pet broad-phase entry, no pathfinding, no per-tick target scan; passive
  arithmetic occurs only at existing player/event seams;
- client: at four visible pets, at most 12 pet sprite parts total, no steady allocation, and no more than
  0.25 ms p95 / 0.5 ms p99 incremental CPU+GPU frame cost on the reference minimum-spec capture.

Local pets follow the predicted local render root; remote pets follow the same interpolated remote player
sample as their owner. On reconciliation snap, pit fall, rift, respawn, or join, the follower cuts/rebases
instead of sweeping across the screen.

### Model B — only if pet position affects play

The exact authority boundary is simple:

> If eligibility, range, timing, target choice, collision, collection, damage, blocking, or aura coverage
> depends on where the pet appears to be, the server owns the pet's position and behavior at 20 Hz.

A pet that flies to and collects an XP mote is Model B. So is a pet that attacks the nearest enemy, blocks
a projectile, body-blocks, emits an aura around itself, presses a switch, or carries a drop. Calling its
sprite “cosmetic” does not make a client-decided pickup authoritative. A plain owner pickup-radius modifier
can remain Model A only if the server tests radius around the **player**, and the tooltip does not pretend
the rendered pet collected it.

Model B requires a capped row keyed by owner, authoritative follow integration, server collision/query
logic, interpolation, teleport epochs, disconnect cleanup, and event sequencing. Projecting from the
measured 80-enemy movement patch (1,126 B), four hot `{x,y}` rows cost roughly **56 B/patch**, or **1.1
KB/s received per client** at 20 Hz, before pet identity/action fields and protocol overhead. Four clients
then receive roughly 4.5 KB/s of aggregate pet-position payload. Ten room occupants would raise both the
row count and recipient multiplier sharply.

The bandwidth is affordable in isolation; the precedent is not. Every later attack animation asks for an
action seq, every collector asks for a target id, and every aura asks for exact geometry. If Model B is
chosen, enforce:

- maximum one authoritative pet row per live player and four visible rows per client;
- pet subsystem ≤0.10 ms p95 / 0.25 ms p99 of a 50 ms server step at four players;
- no pet-created projectile, zone, add, pickup, or physics body in v1;
- spatial queries use retained buffers and existing grids, with zero steady-state allocation;
- all pet rows count in wire/entity telemetry and have a hard removal path on leave/wipe/reset.

The recommendation remains Model A. Model B buys mechanics that collide with quirks while spending network,
CPU, readability, and test budget.

## 6. Four-pet readability bill

The visual hierarchy is self → bullets/danger → enemies → loot → scenery. A companion belongs with self,
but below the owner's body and below every protected telegraph edge. It must never borrow the enemy or
pickup language.

### Silhouette and palette law

- Maximum face-on pet envelope: **28×28 world px**, no more than roughly one-third of the 76 px player-body
  height. A pet has one asymmetric read—wings, tail, pennant, or offset ear—not a generic circle/blob.
- Every pet has a 2 px warm-black cut keyline and a persistent 3-5 px owner-color paper tab/tail. The
  owner mark remains when teammate pets are dimmed and disambiguates duplicate species.
- Pets never use a red filled ring/cone, a pure-white timing flash, enemy health bar, enemy contact shadow,
  aggro line, or impact recoil. Red and white remain danger/parry instruction channels.
- Pets never use pickup grammar: no vertical loot beam, halo, rarity-colored border, spinning mystery
  reveal, grab ring, label plate, gold sparkle shower, or perpetual up/down pickup float.
- Pet palettes may echo their fantasy—the green butterfly can be green—but must preserve the owner tab and
  pass grayscale silhouette tests against every dimension. Color alone is not allegiance.

### Depth, motion, and LOD law

- Pet root depth is `ownerDepth - 1` and guarded against redundant depth writes. It can never render above
  the protected response layer at 99997, HUD, grab/parry rings, or a downed-state label.
- While overlapping any live danger footprint, pet alpha drops to at most 0.25; the exact boundary remains
  fully opaque above it. A pet never casts a large ground shadow that masks the depth-3 footprint.
- Self pet: full approved motion. Teammate pets: at most 60% alpha and no secondary flourish. Provide
  `Companions: All / Mine / Hidden`; default to **Mine + dim teammates**. Visibility never changes buffs.
- At most three cutout parts per pet and one composed follow transform. One restrained wing/tail hinge may
  borrow the paper-doll feel; do not instantiate a full `SpriteRig`, particle emitter, filter, mask, light,
  render texture, or perpetual Phaser tween per pet.
- `PROCEDURAL_JIGGLE` may influence the cosmetic hinge through the existing frame update, but combat has no
  pet spring ownership. No scale-through-zero flaps during live combat: edge-on disappearance reads as a
  despawn or pickup. Reduced motion disables hinge/jiggle and retains only positional follow.
- Four-pet stress approval occurs with 80 enemies, 120 hostile projectiles, four beams, XP echoes, ambient
  motes, all protected telegraphs, max hit VFX, and the minimum viewport. An empty-room beauty capture is
  not evidence.

## 7. Downed, death, revive, and disconnect

The pet has no HP, cannot be targeted, cannot die separately, and cannot be revived. A second health model
would demand targeting, damage, UI, grief rules, and pet-loss progression the feature did not request.

When the owner becomes downed:

- the selection, account level, and static derived capacities remain attached to the player record so
  revive does not mutate max HP or max charges;
- every pet-triggered effect and all passive ticking stop behind the same `player.alive` gate as ordinary
  acting/regen; there is no downed aura, collection, proc, or squad benefit;
- cooldown, reload, ammo, per-slot refund counters, and once-per-run state keep their existing debt. Downing,
  reviving, disconnecting, or spectating never refills or resets them;
- cosmetically the pet settles beside the persistent downed body, desaturates, and becomes still. It does
  not explode, become a pickup-looking token, follow the spectator camera, or obscure the revive target;
- revive reactivates the same snapshot and ledger. A reconnect restores room state, never account-fresh
  state.

On a squad wipe, pet visuals can leave only after the authoritative defeat state. They do not add a separate
death ceremony ahead of the persistent downed-body read.

## 8. The extra-charge example versus G-01

“An extra charge per weapon use” is too ambiguous to implement safely.

- If it means **gain one charge whenever a weapon is used**, ammo can never decrease. Rejected.
- If it means **+1 maximum charge/magazine**, it is +50% burst on two-charge weapons and nearly irrelevant
  on a 50-round gun. Rejected as a universal capstone under the balance envelope.
- If it means **one extra attack projectile per charge**, that is a damage/target-count effect, not ammo,
  and violates the v1 entity/output law. Rejected.

The least dangerous descendant is a cycle-normalized refund tied to the exact slot that paid: for example,
“every twelfth accepted gun/throw charge spend refunds one charge to that slot, never above its effective
maximum.” Even that requires per-slot counters, full-roster cycle modeling, and a maxed-pet budget check;
it is a proposal, not automatic approval.

Any resource pet must preserve these invariants:

1. One accepted authoritative attack spends exactly one charge before any bounded refund. Rejected/buffered
   attacks do not advance the pet counter.
2. The active weapon mirrors its slot row; stow, Q/E, 1/2/3 swap, Backpack equip, drop/grab, shop sell,
   future pair/unpair, and direct server identity changes preserve `{cooldown, reload, charges, petCounter}`.
3. Only a genuinely new pickup initializes a fresh row. Pet selection, pet level, character change, revive,
   reconnect, and returning to a weapon never initialize or top up.
4. Stowed cooldown/reload continues to age exactly once. A pet cannot create a second reload-complete edge.
5. A refund never sets cooldown or reload to zero, never cancels draw-lock, never exceeds the effective max,
   and never applies to melee/cast weapons with no authored charge resource.
6. Capacity order is explicit: authored base → character-specific capacity rule → pet adjustment → clamp.
   Each stage uses the same pure effective-max function for spawn, new pickup, reload completion, HUD, and
   restore. No call site may read raw `gun.magazine` or `thrown.charges` as the player's final max.
7. The run snapshots pet level, so a post-run pet level cannot resize a live ledger. Patch migration occurs
   between runs only.
8. Tests cover two-shell shotgun, two-charge thrown weapon, 50-round gatling, depleted/reloading states,
   Bandoliers, Coldsnap, Swift/Light/Heavy/Brutal affixes, down/revive, disconnect/rejoin, and every swap/storage
   path. The exploit assertion is: no sequence of non-attack actions increases total available charges or
   reduces existing cooldown/reload debt.

Until those tests and the per-weapon cycle report exist, “extra charge” cannot be promised as the terminal
reward players will grind toward.

## 9. Progression-system sprawl and UI ownership

Pets are not merely another icon. A new player is being asked to parse character quirks, permanent Scrip
upgrades, pets, run-only augments, arsenal set bonuses, and an ultimate unlock/charge system. If every one
gets a meter and panel during minute one, the game reads like six progression games stapled together.

Use one sentence consistently:

> **Your character bends one rule. Your companion supplies one permanent specialty. Scrip upgrades raise
> base stats. Augments and weapon sets shape this run. Your ultimate awakens during the run.**

UI ownership is strict:

| Surface | Pet content |
|---|---|
| Pre-run character/loadout | One `COMPANION` slot beside—not inside—the character card. Shows pet art, current level, exact live effect, and locked max-level capstone. Switching takes at most two actions. Ready locks it. |
| Main-menu `Companions` page | Roster, account levels, progress to next level, full effect preview, patch/trust notice, and visibility setting. This is the only leveling/collection management surface. |
| First run | A starter pet is pre-equipped; no mandatory pet-selection modal. One compact callout explains the single permanent specialty. The full page is introduced on the first post-run result. |
| Post-run result | One bond-XP receipt for the selected pet, milestone breakdown, level-up/capstone ceremony. No mid-combat XP popups or meter. |
| Pause/run details | Read-only pet name and its exact snapshotted effects. No switch button. |
| Weapon dock | Nothing. The dock's truth layer belongs to active weapon name/ammo and its awake focus card. |
| Backpack/Trading Post | Nothing beyond existing permanent Scrip upgrades. A pet is neither a weapon, pack item, sellable object, nor a fourth upgrade row. |
| Combat HUD | No new persistent bar. The world follower and optional small companion glyph beside the character/quirk line are enough. |

Do not add pet food, pet rarity, pet equipment, breeding, mood, energy, evolution branches, daily care,
separate inventory, or a second spendable currency. Linear levels plus one previewed capstone are already the
fourth progression axis; every extra noun multiplies onboarding and save migration.

## 10. Non-negotiable ship checklist

- [ ] Exactly one dedicated pet is snapshotted at ready/run start; no mid-run switch or account reread.
- [ ] Each pet declares one `budgetKey`; at most two clauses spend that same budget.
- [ ] No pet duplicates the selected character quirk's budget key; the loadout rejects the pairing visibly.
- [ ] The full legal stacking matrix passes +8% sustained, +15% three-second burst, and +10% total
      survivability/recovery ceilings.
- [ ] No final damage, cooldown, regen-total, beam-recovery, loot, XP, or Scrip multiplier exists on a v1 pet.
- [ ] Pet progression is one account record per pet, never per character, slot, or copy.
- [ ] Level 10 takes 4-6 median active hours, cannot be shallow-farmed below three, and no run grants >20%.
- [ ] Pet XP comes only from unique boss/depth outcomes plus extraction bonus; trash, motes, time, last hits,
      and damage award zero.
- [ ] The identity/tuning/compensation trust law is shown before investment and enforced by definition
      versioning between runs.
- [ ] Public pet progression is owned by an authenticated account store; local client claims are not trusted.
- [ ] V1 rendered pet position has no gameplay meaning and contributes 0 steady-state position bytes.
- [ ] If any position-dependent behavior is approved, it moves to Model B with authoritative 20 Hz state,
      hard row/entity caps, interpolation, cleanup, and measured CPU/wire budgets before content production.
- [ ] Pet visuals are non-targetable, non-colliding, non-pickup, and cannot spawn projectiles/zones/entities.
- [ ] Four visible pets total ≤12 sprite parts, allocate nothing steadily, and remain within the 0.25 ms p95
      / 0.5 ms p99 reference client delta.
- [ ] Pet silhouettes pass grayscale ally/enemy/pickup tests in every dimension and retain an owner marker.
- [ ] Protected telegraph edges, parry/RED color language, grab rings, and downed bodies always outrank pets.
- [ ] Reduced-motion and `All / Mine / Hidden` companion visibility paths preserve gameplay exactly.
- [ ] Down/revive/reconnect never resets cooldown, reload, charges, counters, or once-per-run pet state.
- [ ] Any ammo/charge effect passes the complete G-01 transition matrix and cannot create resource through
      non-attack actions.
- [ ] Pet UI stays in pre-run loadout, Companions, post-run result, and read-only pause details—not dock or
      Backpack/Trading Post.
- [ ] First-session copy can explain character, companion, meta upgrades, augments/set, and ultimate in the
      one-sentence ownership model without exposing a new currency or skill tree.

## Three questions the user must answer before implementation

1. Does “set in stone” mean immutable effect identity with bounded numeric balance patches and full-XP compensation for material nerfs, or do you intend even the numbers to be permanently immutable?
2. Do you approve the passive-only v1 authority line—server-owned buffs, client-cosmetic follower, and no pet-position gameplay—or is collecting, attacking, blocking, or aura behavior essential enough to pay for a real 20 Hz pet entity now?
3. Do you approve one account-wide level per pet, selected pet only earning boss/depth bond XP, a 4-6 hour median to level 10, and the pet locked from ready-up through the entire run?
