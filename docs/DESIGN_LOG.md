# Design log

Append-only. Each entry: what was decided, why, and what it rules OUT. Never rewrite an entry —
supersede it with a newer one that cites it. This exists so a decision is made once; if you find
yourself re-arguing something here, the entry was incomplete, so extend it rather than re-deciding.

This is NOT a plan and NOT a backlog. It is the record of choices. See `DIMENSION_DRIFTERS_MASTER_SPEC.md`
for locked laws, and `tools/sol/GUARDRAILS.md` for the constraints every Sol brief carries.

---

## 2026-07-28 — THE PIVOT: squad autobattler, not bullet-heaven

**Owner, verbatim:** *"After battling technical limitations and trying to go with what youre good at
...I've lost artistic direction and the game is not fun."*

The bullet-heaven shape is abandoned. The new shape: a **sequence of discrete fights in a Slay the
Spire structure**, with thinking time between them. Each fight is an **interactive optional
autobattler** — your squad on the left, enemy team or boss on the right, 2.5D, closest reference
point Clair Obscur. The player is an orchestrator watching the fight who may take over any unit at
any time.

**Why this was the right call, recorded so it is not re-litigated:**

- **395 weapons stop being noise and become the game.** In a bullet-heaven you hold 3 and never see
  the rest, so a large catalog is bloat. In a squad you re-equip constantly and every weapon is a
  decision. Same logic promotes 154 whole-art characters from decoration to recruitable content.
- **Most of the netcode burden disappears.** Client prediction, L10, L11 and the whole warp chain
  exist because continuous free-roam needs continuous authoritative sync. Discrete fights do not.
- **Animation becomes affordable.** 200 rigs forced compromises; ~12 units does not.
- Diagnosis that prompted it: 68 constants governed parry/roll/slide/jump/pound/crouch, and exactly
  ONE governed pickups. A high-execution action kit with no reward economy — which is why 395 weapons
  and 13 bosses were not fun.

**Ruled out:** the VS-style bullet-heaven loop, the 200-runner horde as the core fantasy, and any
design that needs continuous 20Hz authoritative self-position.

---

## 2026-07-28 — Time model: beats, with parry and movement off-beat

**Owner:** *"I think we could still work in a beat to help the netcode. The only thing out of beat
would be the parry and the movement."*

Combat resolves on **beats**. Movement and parry are continuous. Everything else — attacks, damage,
evasion rolls, AI decisions — is evaluated at beat boundaries against a position snapshot.

**Why:** a parry stops needing frame-level agreement and only needs to land in the right beat, so the
sync tolerance becomes the beat length rather than the frame time. It also makes the AI a per-beat
state machine that can be logged, replayed and tested — worth more than the netcode saving for a
one-person team — and it gives takeover and slow-mo a natural place to happen.

**Starting value: ~500ms beat.** Not yet validated. Too long and parry feels disconnected from the
visuals; too short and frame-sync problems return.

**Accepted consequence:** because positions resolve on the beat, **evasion is positioning, not
reflex**. "Units naturally dodge" means "they were standing somewhere sensible when it landed." A
unit's evasion stat must be read in that light.

---

## 2026-07-28 — Parry: interpose on a specific projectile

Parry targets **a specific incoming projectile**, not a beat or an area. Selection is by
**interposition** — the melee unit must physically be in the line between the bolt and its target,
then parry with direction. Not a click, not an auto-catch.

**Why:** it makes off-beat movement load-bearing (movement is *how you choose your target*, not
cosmetic drift), and it produces the core tension for free — three bolts incoming, you can only stand
in one line. Netcode-wise "I parried projectile #4821" is a verifiable claim the server can check
against a deterministic, server-authored path; no timing-tolerance argument.

Reuses B26's directional parry (knockback slide / brace / launch, three-pose cycle), which was built
for the abandoned shape and lands perfectly here.

**Locked constraints:**
- **Threat density must exceed maximum parry coverage.** Owner: *"There should be enough projectiles
  that even the parry godking cant block them all."* Parry is triage, not a wall. This keeps support
  and evasion relevant and makes failure a gradient ("4 of 7") rather than pass/fail.
- **The parry arc must be narrow enough that two lines cannot be covered at once.** A generous arc or
  target-snapping collapses the choice into mashing.
- **The difficulty dial is threat count and line spacing**, not damage numbers. Two far-apart bolts
  are harder than three close ones. Hundreds of encounters from tuning this, with no new code.
- **Telegraph the projectile's TARGET, not just the projectile.** The player must read "that one's for
  your healer". Reading "there are three bolts" is useless; ranking them by consequence is the game.
  This is judged the single most important piece of UI in the design.

**Reflection is an UPGRADE, not baseline.** It gives the tank a scaling axis he otherwise lacks.
Open: how it is gated — perfect-timing only, per-fight budget, or charges a resource. Ungated it
snowballs hardest in fights already being won.

---

## 2026-07-28 — Roster: permadeath, drafted recruits, weapons outlive people

- **Units die permanently** and are replaced through the draft.
- **Recruit rarity scales with run depth.** This is deliberately an anti-death-spiral device: a late
  loss is survivable because better bodies are available.
- **Weapons survive their wearer** and return to the pool. Losing both is double punishment and would
  make the player hoard rather than experiment, which is the opposite of the churn that makes a
  395-weapon catalog valuable. Fiction and rule: *weapons persist, people are fragile.*
- **Recruits appear in the same three-choice draft as weapons.** Taking a recruit means not taking a
  weapon, which is how you "refuse" a recruit. **Relics/trinkets are NOT in that draft** and are the
  most powerful reward tier — kept out precisely so they never flatten the other two options.
- **Recruits have genuinely differentiated stats**, not cosmetic variation, so swapping is a live
  decision and not only a response to death.

**Owner ruling on the power curve:** a legendary with one upgrade beats a maxed common.

**Flagged consequence, unresolved:** under that curve, losing a heavily-invested unit late in a run is
*good news*, so permadeath stops biting exactly where tension should peak. It also pushes roster
choice toward "field the highest rarity" and encourages hoarding upgrades. Suggested lever, not yet
adopted: let rarity grant **distinct capability** (a unique ability, an extra slot, a second role)
rather than flat superiority, so a maxed common can out-stat an unupgraded legendary while the
legendary does something nobody else can.

**Recommended non-comparable stat axes** (differentiation only creates decisions if units are good at
*different* things, not more of the same):
- **How much protection a unit NEEDS** — the most valuable axis, because it changes the shape of the
  parry problem rather than sitting beside it. A glass evasive sniper barely needs you but dies to one
  leak; a slow tanky ranged unit soaks attention when focused.
- **Weapon aptitude** — which classes a unit uses well. Makes the recruit and weapon drafts talk to
  each other, justifies a huge catalog ("no weapon is bad, it's bad *for who you have*"), and breaks
  rarity dominance for free.
- **Positional discipline** — how reliably a unit holds a safe lane vs drifting into fire. An AI
  behaviour expressed as a stat; directly makes the nanny's job harder or easier.

---

## 2026-07-28 — Fire Emblem influence: growth rates first

Owner reference: Fire Emblem, unplayed. The relevant mechanism is not that characters are unique on
paper but that they become uniquely *yours* through play.

**Adopt first: growth rates.** Per-character, per-stat chances to improve on level-up, so two units of
the same class diverge within a run. Cheapest of the FE mechanisms, produces the attachment that
permadeath needs, and organically solves rarity dominance a third time — a common with lucky growths
can beat a legendary with poor ones without hand-tuning.

**Deferred: supports/bonds.** Units who fight together gaining bonuses is a real design decision, not
a freebie, because it cuts against live swapping: swap for capability, stay for synergy. Only worth
building once growths prove players form the attachment at all.

**Cheap and high value: show each unit's history** — battles survived, kills, what they carry. A
number on a portrait is the difference between losing "ranged unit 3" and losing *Vesh*.

---

## 2026-07-28 — Multiplayer shape

**Each player takes over one unit; the rest of the squad auto-battles.** 2-4 friends, one shared
squad, everyone picks their own moment to intervene. No coordination overhead, forgiving of latency,
and not obviously done elsewhere.

**Takeover must be situationally better, never globally better.** If manual control always wins,
"optional" is a lie and the chill dies; if it always loses, it is decoration. The intended edge is
*timing*: the AI plays safe and eats 60% of a boss wind-up, a human deflecting on frame takes 0%.
Takeover is a spike tool for the moment that matters, not a mode you live in.

---

## 2026-07-30 — Roles have subclasses; the subclass owns the weapon category

**Owner, verbatim:** *"each role will have subclasses with bonuses to their thing"*.

The three roles (vanguard / support / ranged) are the *job*. A **subclass** is how that job is done, and
it is what binds a unit to a weapon category. Vanguard is specified:

| Subclass | Weapons | How it holds the line |
|---|---|---|
| **Defender** | shield | Straight block. The only true parry. |
| **Fighter** | two-handed | Off-tank. Melees, and parries as a *block* — cannot hard-block. |
| **Rogue** | throwing, 1H, dual-wield | Crosses the midline for a second at a time. |

**Why this matters more than it looks:** it is the first mechanism that makes the 395-weapon catalog
load-bearing. Rarity and raw stats do not decide what a unit can carry — its subclass does — which is the
"weapon aptitude" axis the roster entry (2026-07-28) called for, now with a concrete owner.

It also gives the midline a second job. The Rogue is defined *by* being the one who can be across it
briefly, so the sling stops being a boundary rule and becomes a class fantasy.

**Not built yet.** Recorded so it is designed once. The abilities framework in `battle-stats.ts` exists to
receive it: a subclass is a named set of ability ids plus stat biases, so adding one should not touch the
simulation.

**Open:** whether the Rogue's crossing is a timed dash with its own cooldown or simply a weaker sling, and
whether Defender's hard block costs a resource.

---

## Open questions — do not guess

- **What the orchestrator does while not taking over.** Watching is only fun with micro-decisions:
  focus-fire calls, brace orders, a limited intervention resource. Without this the "optional" mode is
  passive. This is the largest unanswered design hole.
- **Exact beat length**, and the parry window inside it.
- **Reflect gating** (perfect-timing / budget / resource).
- **Whether rarity grants distinct capability or flat superiority** — see the flagged consequence above.
- **Roster size, and whether running short-handed is a viable strategic choice.**
- **Whether supports/bonds exist at all.**
