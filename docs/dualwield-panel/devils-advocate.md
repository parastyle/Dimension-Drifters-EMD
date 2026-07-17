# Devil's Advocate — Dual Wield for Same-Class One-Handers

**Panel role:** adversarial review. My job is to find where this feature breaks the game, not to design it.
**Directive under review (verbatim):** *"a dual wield system for one handed weapons of the same class."*

**Verdict up front:** as specified, this feature is a two-identity weapon state grafted onto an engine whose
every load-bearing system — schema, cooldown-debt ledger, combo selection, set bonuses, VFX keying, the dock —
assumes **one weapon identity in hand**. Verified in code: `PlayerState.weapon` is a single
`@type("string")` (`packages/shared/src/state.ts:42`), the loot identity is a single
`weaponRarity`/`weaponAffix` pair (`state.ts:85-86`), each `ArsenalSlot` carries exactly one weapon plus one
server-private resource ledger row (`state.ts:8-21`), combos key off one family
(`packages/shared/src/melee.ts:162`, `MELEE_COMBO_SEQUENCES[family]`), and the set-bonus law counts weapon ids
in slots (`packages/shared/src/weapons.ts:344-360`). Meanwhile **authored dual weapons already exist and
already deliver the fantasy**: `grip: "1H" | "2H" | "dual" | "mounted"` is in the tag contract
(`weapons.ts:262`), `twin-bowie-fangs` ships with `dual: true` (`weapons.ts:740-760`), the expansion roster
has more `grip: "dual"` entries (e.g. `x2-coyote-s-grin`, `weapons-expansion.generated.ts:59,75`), and
SpriteRig already renders and alternates two hands for them (`packages/client/src/entities/SpriteRig.ts:1948-1998`,
alternating rakes/crosses/scissor at `:1026`, `:4608-4640`). The burden of proof is on the pairing system to
show what it buys that *authoring more duals* doesn't — at a fraction of the blast radius.

Below, every place the runtime-pairing version breaks, then the guardrails and the checklist any
implementation must pass.

---

## 1. The slot-economy fork — both answers break something. Enumerate honestly.

The arsenal is **3 slots + a 12-cap bag** (`ARSENAL_SLOTS = 3`, `BAG_CAP = 12`,
`packages/shared/src/constants.ts:351,357`), with swap keys 1/2/3, Q/E cycle, and
`bagStore`/`bagEquip`/`sellWeapon` messages (`packages/server/src/rooms/GameRoom.ts:895-985`). A dual pair
must live somewhere in that economy. There are only two answers and each is a trap:

### 1a. A pair occupies ONE slot
- **Free power.** Two weapons' worth of output in one slot leaves two slots open — a paired player carries
  effectively 4 weapon identities in a 3-slot arsenal. The 3-slot cap is the game's core build constraint
  (§29/§30); this quietly raises it to 4.
- **Bag-pressure relief inflates loot value.** Every one-hander drop is now potentially "half a pair," and
  pairing two bag weapons into one slot frees bag space. Loot drops from every enemy; anything that makes
  drops compress into fewer slots inflates the value of *every* common drop and deflates the tension the
  bag cap exists to create. The salvage/sell economy (`sellWeapon`, earned-provenance flag `state.ts:13`)
  reprices overnight.
- **The set-bonus function silently miscounts.** `classCount` iterates slot ids (`weapons.ts:345-349`). One
  slot holding two melee weapons counts as 1 — or you special-case it to count 2 — and either choice is a
  hidden rule the player can't read off the dock.
- **Schema lies.** `ArsenalSlot` has one `weapon`, one `rarity`, one `affix`, one earned flag, one cooldown
  ledger row. A pair in one slot means either a second parallel field set (schema surgery, see §9) or the
  off-hand's identity/debt is *unrepresented* — which is exactly the class of bug the per-weapon cooldown-debt
  fix just killed.

### 1b. A pair occupies TWO slots
- **The arsenal collapses to 2 effective loadouts.** Pair + one spare. The whole §29 swap grammar — three
  situational answers on 1/2/3 — dies for any player who pairs.
- **Swap grammar becomes undefined.** What does pressing the off-hand slot's number do? Unpair? No-op? Swap
  the pair as a unit? Q/E cycle "through the NON-EMPTY slots" (`GameRoom.ts:908-918`) — does the pair count
  as one stop or two? Every answer needs new server messages, new prediction handling, new dock affordances.
- **Set bonus double-dips by construction** — see §2. Two same-class slots is *literally the SET_BONUS_2
  trigger condition*; pairing them adds a second reward on the identical game state.
- **Ammo/cooldown ledger ambiguity.** Each slot keeps its own G-01 debt row. When the pair is "in hand,"
  which slot's cooldown gates the attack? Both? The stow/restore path (`GameRoom.ts:1342-1415`) assumes one
  active slot mirrors the live held weapon (`GameRoom.ts:1475-1478`, `loadoutIds` at `:1573-1578` reads
  `player.weapon` for the active slot). Two active slots breaks the mirror invariant.

**There is a third answer** (the one I defend, §13): a pair is **one weapon identity** — either authored
(`grip: "dual"`, already shipped) or produced by an explicit **fusion** that consumes two one-handers and
yields a single dual-grip weapon instance. One slot, one id, one ledger row, no new schema. The "1 slot free
power" objection is then answered in the statline, not the slot math: the fused def is balanced as one weapon.

## 2. Set-bonus stacking — pick a law, because right now you'd pay twice for the same fact

`SET_BONUS_2 = 0.08`, `SET_BONUS_3 = 0.18` (`weapons.ts:341-342`) already reward "I carry 2/3 weapons of one
class." Dual-wield-same-class rewards *the same fact about the same loadout*. If pairing grants any output
increase (alternation cadence, stat merge, second projectile) **and** the two ids still count toward
`classCount`, the player double-dips one axis: "carry two melee weapons" pays out as +8% class damage AND the
dual bonus. Then 3-of-class + a pair = SET_BONUS_3 AND dual — the axis pays three times.

**The law must be explicit, one of:**
- **(A) Pairing consumes the set-bonus contribution.** A fused/paired unit counts as 1 toward `classCount`.
  Dual's payoff is its own cadence/statline; the set bonus is for *distinct* situational picks. (My pick —
  it also keeps `classCount` untouched under fusion, since a fused pair is genuinely one id.)
- **(B) Pairing IS the 2-of-class payoff** — dual grants no independent output bonus; it's presentation +
  cadence flavor on top of SET_BONUS_2.
- Anything else — "counts as 2 and gets a dual bonus" — is a balance dominance loop: same-class dual becomes
  strictly correct, build diversity dies, and the §30 Brotato-parity intent (set bonuses turn 3 slots into a
  *build*) inverts into "always pair, always same class."

## 3. The authored-dual collision — the quad problem

`twin-bowie-fangs` **is already a dual weapon**: one id, `dual: true`, `grip: "dual"`, one slot, one cooldown,
one combo family, two rendered blades (`weapons.ts:740-760`). The expansion roster contains more. So the
system meets authored duals on day one:

- **Can you pair two twin-bowies? That's four knives.** SpriteRig has two hands and two sprite-part
  attachments (`SpriteRig.ts:1984`). There is no rig for four. If the answer is "renders as two but hits as
  four," the render-truth law the codebase visibly enforces (meleeReach floors at sprite tip,
  `weapons.ts:328-336`; gun barrel truth `weapons.ts:304-317`) is violated in the player's own hands.
- **Can a `grip: "dual"` weapon join a pair with a 1H weapon?** Three weapons, two hands.
- **What is the eligibility predicate, exactly?** The directive says "one handed weapons." The tag contract
  says `grip: "1H"`. If eligibility is anything other than `grip === "1H"` **strictly**, every authored dual
  and every future `mounted` weapon is a latent edge case.
- **Fists.** The unarmed baseline and worn-dual claws (`SpriteRig.ts:1996-1998`) already occupy the two-hand
  render space. Pair eligibility must exclude them explicitly, not accidentally.

**Guardrail:** pairing inputs are `grip === "1H"` only; `dual`, `2H`, `mounted`, and fists are ineligible as
inputs *and* as pair partners. No exceptions, no "for now."

## 4. Balance blast radius per classPool — each pool breaks differently

Eligibility is "same class," and one-handed variants exist in all three pools (`classPool: "melee" | "ranged"
| "caster"`, `weapons.ts:267`). So this is not a melee feature; it's three features:

- **Dual GUNS.** If both fire per trigger pull, that's ~2× fire rate or ~2× projectiles — a damage doubling
  no affix or rarity tier in the game approaches. If they alternate at each weapon's own cooldown, the
  effective rate is governed by *whose* cooldown? The per-weapon debt ledger (`GameRoom.ts:1352-1415`) keeps
  two independent cooldown/reload/charge rows — interleaving them halves effective downtime unless the law
  says the pair shares ONE merged cooldown. Reload choreography for two guns with independent `reload` debt
  has no design anywhere.
- **Dual CASTERS.** Two beams is the nightmare case. The overheat law is explicit and load-bearing:
  *"simulation and feedback cadence cannot change throughput. V1 uses heat for staves and guns alike"*
  (`weapons.ts:18`), with `heatPerSecond` / `ignitionHeat` / `restartHeat` (`weapons.ts:28-34`), and the
  server keeps the beam resource ledger alive across swaps precisely *"so heat debt cannot be bypassed"*
  (`GameRoom.ts:396`). Two beams from one player = either double throughput (law broken) or two heat pools
  to juggle-alternate around overheat (law bypassed by interleaving — the exact exploit shape the
  swap-debt fix closed). Also: the beam channel runtime is single (`beam` state on the combat struct); a
  second simultaneous swept capsule is new server simulation, new Tier-1 sync, new VFX.
- **Dual MELEE.** The alternation cadence already exists *inside* authored duals as presentation
  (`SpriteRig.ts:4476` — "every signed reverse/dual/overhead comboPose below is presentation-only"). A
  pairing system that makes alternation *mechanical* — left weapon swing, right weapon swing, each on its own
  cooldown — collides with per-weapon cooldown debt (interleave two 0.3s-cooldown sabers = 0.15s effective
  cadence, i.e. the swap-exploit reborn inside one slot) and with combo selection: `MELEE_COMBO_SEQUENCES` is
  keyed by ONE family (`melee.ts:162,1077`). Pair a saber with a cleaver (same classPool, different family) —
  whose combo runs? Whose lunge? Whose finisher? Every answer is either "primary wins" (off-hand is a stat
  stick — then why is this a system?) or a combinatorial matrix of family×family combo tables nobody will
  author.

**If dual only works within the same family, say so now** — but then note the roster of same-family 1H
one-handers is small, and the feature shrinks toward... exactly what authored duals already cover.

## 5. Mixed-rarity / mixed-affix pairing math — every blend rule is a farm incentive

Weapons carry loot identity: rarity (uint8) + affix + earned provenance (`state.ts:9-13`, mirrored on the
player at `:85-86`). Pair a common saber with a legendary saber:

- **Max/average blend** → common weapons become legendary-carriers. Optimal play: farm ANY same-class
  common to strap onto your legendary. Loot value inverts — commons of your class outvalue rares of others.
- **Min blend** → pairing punishes your legendary; nobody pairs; dead feature.
- **Each contributes its own stats** → two rarity fields, two affix fields, two earned flags in flight —
  schema surgery (§6) plus a shop/salvage pricing problem (`sellWeapon` prices one identity; what's a pair
  worth? Does unpairing launder the `earned` flag from a drop-earned weapon onto a shop-bought one?).
- **Affix interactions are worse than rarity.** Two affixes on one attack stream is a new stacking axis
  nobody has audited (two lifesteal affixes? affix + affix synergy loops?). And whichever rule is chosen
  creates a *pair-shopping* meta: the optimal affix pairing table becomes homework.

**Guardrail:** if pairing exists at all, the pair has ONE loot identity, derived by a rule with no upgrade
path — e.g. fusion requires equal rarity and produces that rarity, primary's affix only, `earned` =
`earnedA && earnedB`. Any rule where output identity > min(input identities) is a farmable printer.

## 6. UI / dock readability — the junction card just got redesigned; a pair breaks its grammar

The dock's card grammar is one card = one weapon identity (name, rarity frame, affix, charges, cooldown
wheel). A pair needs: two names, two rarities, potentially two charge counts and two cooldown states, plus a
"paired" affordance, in the same footprint — *right after* a redesign shipped. And the arena carousel path
has **no ArsenalSlot rows at all**; its debt is keyed by weapon identity string (`GameRoom.ts:364-366`) —
a pair literally has no representation there. Every surface that renders "the weapon" (dock, junction card,
kill feed, loot compare tooltip, shop sell row, spectator view) needs a pair variant. That's not polish debt;
that's a second render path through every weapon-facing UI, indefinitely.

## 7. Input honesty — one button, two weapons, zero player agency

The entire input surface for attacking is one attack input + aim (`GameRoom.ts:763-775`, attack buffering,
`attackSeq`/`attackTick`/`attackHeld` on PlayerState `state.ts:146-150`). With two live weapons the player
controls... what, exactly?

- If alternation is automatic, the off-hand is a passive proc — the player made a *loadout* choice, not a
  *combat* choice. Then the honest design is a stat/statline (i.e., a fused single weapon), not a "system."
- If the player can choose which hand fires (new input), that's a new button on a game whose combat grammar
  (attack / parry / dodge / jump / swap) is deliberately tight — and it must round-trip through prediction.
- Held-trigger semantics (`attackHeld`) for two weapons with different fireModes (`tap-charge` exists in the
  expansion tags) are undefined: hold-to-charge the saber while the pistol autofires? The attack-buffer
  de-clunk work (`GameRoom.ts:340-344`) was tuned for ONE cooldown stream; two streams re-clunk it.

Prediction risk is concrete: `packages/client/src/net/prediction.ts` already special-cases dual for
presentation. Mechanical dual means the client must predict *two* cooldown streams and the server must ack
them; every mismatch is a felt misfire on a 20Hz authoritative loop.

## 8. Netcode / schema surgery — the single-string weapon field is the keystone

- `PlayerState.weapon` is one string; `weaponRarity`/`weaponAffix` one each (`state.ts:42,85-86`). Everything
  binds to it: SpriteRig equip (`SpriteRig.ts:1948`), VFX keyed per weapon id
  (`weapon-vfx.generated.ts`), attack beat/combo systems key off ONE weapon id, the set-bonus loadout
  reader substitutes `player.weapon` for the active slot (`GameRoom.ts:1573-1578`), the mirror invariant
  syncs held↔slot (`GameRoom.ts:1475-1478`).
- Adding `weaponOff`/`weaponOffRarity`/`weaponOffAffix` (+ ArsenalSlot twins, + bag twins) touches
  `SCHEMA_VERSION` (`state.ts:2`), every client binder, prediction, and replay/interp of attack events.
- The attack event stream (`attackSeq`, `attackTick`) is one sequence. Two weapons attacking on independent
  cadences either share the sequence (client can't tell whose swing to animate without more synced data) or
  need a second sequence (more schema).
- This is the highest-blast-radius schema change since the arsenal itself, in service of a feature the
  authored-dual path delivers with **zero** schema changes.

## 9. Progression warping — dual unlock timing vs the ultimate lane

If dual-wield is a progression unlock, it lands on the same escalation lane the ultimate system (in design)
is supposed to own — two "your kit fundamentally upgrades" moments compete, and dual (a permanent passive
throughput jump) will overshadow an active ultimate. If it's available from minute one, early-game balance
resets: two starter one-handers beat every 2H drop until 2H numbers are re-anchored — note
`classPowerMedian` anchors loot pricing per class (`packages/shared/src/loot.ts:270-287`); a systemic
same-class pairing bonus skews the real power of every 1H weapon relative to its anchor, silently
mispricing the whole shop/salvage economy. Either answer forces a tuning pass across all 1H/2H weapon defs.

## 10. Exploit surface — pair/unpair cycling vs the fresh cooldown-debt law

The swap-exploit fix just established the law: *weapon debt follows the weapon; only a genuinely new pickup
initializes a fresh resource row* (`GameRoom.ts:1375-1380`, stash/restore `:1352-1415`, G-01 ledger
`state.ts:14-20`). A pairing system adds a new identity transition — pair/unpair — that must NOT be a
debt-laundering doorway:

- Does pairing create a "new" combined identity with a fresh ledger row? Then pair→unpair→repair = the swap
  exploit reborn (dump both cooldowns/reloads by cycling).
- Does unpairing split debt back? Which weapon inherits the pair's heat/reload/cooldown? If either side can
  come out cleaner than it went in, mid-combat unpair-repair is free downtime removal.
- Bag interactions multiply the surface: `bagStore` a paired slot (does the pair travel? split? refuse?),
  `bagEquip` onto half a pair, `sellWeapon` one half — each is a state transition through the ledger that
  the current handlers (`GameRoom.ts:927-985`) were never written to survive.
- Death/drop/pickup of "half a pair" and the level-up window's `resourceReady` sweep
  (`GameRoom.ts:1785-1800`) are further transitions, each needing an answer and a test.

**Fusion sidesteps ALL of this**: fusion is irreversible (or salvage-only), so there is no unpair transition
to launder through, and the fused weapon is one id with one ledger row under the existing law.

---

## 11. Hard guardrails (if the panel proceeds with ANY dual system)

1. **One id law.** At any instant, exactly one weapon identity is live per player. A dual pair is a single
   weapon def instance (authored or fused). `PlayerState.weapon` stays a single string. No off-hand fields.
2. **Eligibility law.** Fusion/pairing inputs: `tags.grip === "1H"` and same `classPool` — and same `family`
   for melee (combo integrity). Authored duals (`grip: "dual"`), 2H, mounted, fists: ineligible. No quads.
3. **One axis, one reward.** A fused pair counts as ONE weapon toward `classCount`. The dual payoff lives in
   the fused statline, never as a multiplier stacked on `SET_BONUS_2/3`.
4. **Throughput law survives.** Dual casters: one beam, one heat pool — the fused def gets a dual *statline*
   (e.g. wider capsule), never a second simultaneous channel. Dual guns: one merged cooldown/reload stream,
   tuned as one weapon. The `weapons.ts:18` cadence-cannot-change-throughput comment is a law, not a comment.
5. **No identity upgrade through fusion.** Equal-rarity inputs only; output rarity = input rarity; one affix
   (primary's); `earned = earnedA && earnedB`. Output sell value ≤ combined input value.
6. **Irreversible (or salvage-only) fusion.** No unpair. No transition through which cooldown, reload,
   charge, or heat debt can be shed. Fusion is refused while any input has nonzero debt, or the fused row is
   initialized to the max of both inputs' debt.
7. **Alternation is presentation.** Two-hand swing choreography stays in SpriteRig (where it already lives);
   the server sees one cooldown, one attack stream, one damage event cadence.
8. **Slot math untouched.** Fused pair = 1 slot. `ARSENAL_SLOTS`, `BAG_CAP`, swap keys, Q/E cycle,
   `bagStore`/`bagEquip`/`sellWeapon` behavior: zero changes.
9. **No schema version bump** without a panel-level sign-off; the one-id law makes it unnecessary.

## 12. Non-negotiable checklist (every box, before merge)

- [ ] Written answer: does a pair occupy 1 slot or 2, and why the other answer's failure modes don't apply.
- [ ] Written law for `classCount`/`weaponSetBonus` interaction, with a test: fused pair + 1 melee spare must
      NOT yield SET_BONUS_2 unless the law explicitly says it does.
- [ ] Test: `twin-bowie-fangs` (and every `grip:"dual"` expansion weapon) is rejected as a fusion input.
- [ ] Test: fists / unarmed rejected as input and partner.
- [ ] Per-classPool damage audit: fused DPS within ±10% of the class 1H median × an agreed dual coefficient;
      `classPowerMedian` pricing re-checked (`loot.ts:270-287`).
- [ ] Test: caster fusion produces exactly one beam channel and one heat pool; interleaved-fire throughput
      equals single-weapon throughput within tolerance.
- [ ] Test: fusion with mismatched rarity/affix is refused (or follows the written identity rule exactly);
      output sell value ≤ combined inputs.
- [ ] Exploit test: fuse→salvage→refuse cycling cannot reduce any debt (cooldown, reload, charges, heat)
      below what honest waiting yields. Same shape as the existing swap-debt tests.
- [ ] Test: `bagStore`/`bagEquip`/`sellWeapon`/death-drop on a fused weapon behave identically to any other
      single weapon (because it IS one).
- [ ] Prediction: no new predicted state; client misfire rate on fused weapons equals baseline.
- [ ] Dock/junction card renders the fused weapon on the existing one-card grammar (a "twin" glyph is
      allowed; a second card is not).
- [ ] Combo audit: fused melee pair maps to exactly one `MELEE_COMBO_SEQUENCES` family; the choreography
      review (alternation reads correctly) is sign-off, not code.
- [ ] Progression placement decided against the ultimate-system design doc, in writing, before tuning.

---

*Devil's advocate, closing:* the directive's fantasy is real and the codebase already half-owns it — as
**authored dual weapons**. The dangerous version is the runtime two-identity pairing system. If the panel
ships anything beyond "author more duals," it should be fusion-into-one-identity under the guardrails above,
and the first PR that adds a second weapon string to `PlayerState` should be treated as the failure signal.
