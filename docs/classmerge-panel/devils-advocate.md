# Devil's Advocate — the class merge is three decisions wearing one trenchcoat

Panel: classmerge (universal kit — every character parries AND dodge rolls; classes stop gating
anything; characters differ by base stats + one signature quirk). Role: devil's advocate. This
document is analysis only; it modifies no source. All file/line claims verified against the working
tree on `feat/v0.117-feel-and-colossus` (SCHEMA_VERSION = 18, `packages/shared/src/constants.ts:13`).

## Ruling

The directive is confirmed and I will not relitigate the *decision*. I will relitigate the
*bundle*. "Merge the classes" is actually **three separable changes** that arrived stapled
together, and two of them are far more dangerous than the headline:

1. **Add a dodge roll to everyone.** A brand-new defensive verb with i-frames, landing in the same
   quarter as three other verb waves, into a combat grammar (`docs/enemycombo-panel/designer.md`)
   whose entire curriculum was authored against parry-or-position.
2. **Delete class auto-allocation.** This is a *progression economy* change, not a class change —
   and a downstream panel (`docs/ultimate-panel/designer.md`) has already written law on top of the
   exact semantics being deleted.
3. **Add per-character base stats + quirks.** This is *new content* (40 characters × spreads ×
   quirks), not a simplification, and it collides with a live mid-run mechanic (the C key).

The headline itself — "everyone can parry" — is **already true**. That's the first thing the panel
needs to hear.

---

## 0. What the code actually says (premise corrections)

Before anyone designs against the spec-in-people's-heads, the spec-in-the-repo:

| Claimed premise | What's actually shipped | Where |
|---|---|---|
| "Parry is the melee class signature" | Parry is **universal today**. The `"parry"` handler checks alive/budget/window/cooldown — never weapon class, never character class. "Melee signature" is a comment fossil. | `packages/server/src/rooms/GameRoom.ts:808-829` |
| "The caster mechanic is a class property" | The cast mechanic **already rides the weapon** (`classPool: "caster"`, RMB arcane bolt, INT-scaled via its own grades). What the character class supplies is only the *INT auto-growth feed* that makes those weapons pay off. | `packages/shared/src/weapons.ts:192-214, 1012-1081` |
| "Class-gated signature augment drafts" | Augment gates are **weapon-delivery gates**, not character-class gates: `augmentGateForWeapon` reads `def.tags.classPool`/`delivery` → `parry`/`gun`/`cast`/`beam`/`cast+beam`. Character class never enters. | `packages/shared/src/augments.ts:286-300`, snapshot at `progression.ts:54-55` |
| "Characters differ by class" | Characters today have **zero stat differences** — no base stats, no per-character numbers except a render scale. Class = growth bias (`classAttr`/`reqAttr` +1 each per level) + a HUD label + a card blurb. | `packages/shared/src/character-classes.ts:23-71`, `characters.ts:1-4` ("purely visual for M0"), `progression.ts:42-48` |
| "Dodge exists somewhere" | It explicitly does **not**, by written law: the jump is "PURE MOVEMENT, NOT a dodge — no i-frames (**the parry stays the only defensive tool, so the two never overlap**)". | `packages/shared/src/constants.ts:372-373` |

So the honest scope of "merge classes" is: **delete ~90 lines of growth-bias data** (`character-classes.ts`),
**rewrite the allocation economy**, **author a new defensive verb**, and **author 40 stat
spreads + 40 quirks**. Only the first item is small.

One more shipped law that the dodge roll directly repeals: the telegraph danger-channel contract —
**channel 0 = parryable (WHITE), channel 1 = unparryable (RED, dodge-by-moving)**
(`constants.ts:565`). Today "dodge" means *positioning*. A dodge button with i-frames redefines the
RED channel from a spatial problem into a timing button. That is the single most consequential line
in this whole feature and nobody put it in the directive.

---

## 1. Verb inflation — the input surface audit

### 1.1 The keyboard as it will exist after the in-flight waves

Current bindings (`ArenaScene.ts:1674-1704`, handlers ~3006-3104):

| Input | Today | + in-flight panel claims |
|---|---|---|
| WASD | move | — |
| Mouse aim + LMB/RMB | aim, parry (LMB via `"parry"`), fire/cast | authored dual weapons use the same input contract |
| SPACE | jump (tap, buffered) | **triple-booked**: tap = jump, hold ≥150ms = crouch→distance-dash, air-press = pound (`docs/jumpfeel-panel/tech.md` §1.1-1.3) |
| Q / E | cycle weapon | belt slot interactions |
| R | grab (tap) / salvage (hold 0.6s) | — |
| F | **shop interact when `nearShop`** (`ArenaScene.ts:3097`) | **ultimate** (`docs/ultimate-panel/tech-client.md:215` — "· F ult"). F is now double-booked with a proximity-contextual verb. An ult panic-press next to the shopkeeper opens a shop. |
| C | cycle character **live mid-run** (`ArenaScene.ts:3104`) | — |
| T / B / M / TAB / 1-5 | training, boss, map, summon, slots | — |
| **(unassigned)** | — | **dodge roll needs a key.** SHIFT is the only ergonomic survivor — and it's not even in the `addKeys` list yet. |

Post-merge verb count on the defensive/mobility axis alone: **jump, crouch-dash, pound, parry,
dodge roll** — five verbs, four of which live on two inputs (Space, Shift), two of which are
sub-150ms tap/hold discriminations. This is a *bullet heaven* whose median player is holding WASD
and tracking 80 enemies (`constants.ts` enemy cap), not a character-action game.

### 1.2 The learning surface: which verb answers what threat?

The game's teaching contract is the threat→answer matrix. Fill it in post-merge and the problem is
visible:

| Threat | Today's answer | Post-merge answer |
|---|---|---|
| WHITE telegraph (parryable) | parry (heal/riposte/deflect/launch reward ladder) | parry **or dodge** |
| RED telegraph (unparryable) | move / jump / positioning | **dodge** (or move) |
| Parry-bait return (K3/H3/T2, gold two-stage at depth 7+) | read the bait, parry the *return* | **dodge** (no read needed) |
| Juggle launcher | parry it at the door | parry **or dodge** |
| Juggle air-keeps | DI/escape system (`enemycombo designer.md` §4) | **dodge?** (must be answered — see §2) |
| Projectile hail | position, parry-deflect (v0.117, `constants.ts:638-656`) | **dodge** |
| Pits | jump | jump (dodge across?? must be answered) |
| Scar/zone geography (`mapgen.ts:893`, mapzones) | positioning | positioning **or dodge through** |

Every row where "dodge" appears twice is a row where the player no longer needs to *identify the
threat* before answering it. The matrix collapses toward one column. That is the definition of verb
redundancy: not "two buttons do things", but "one button answers questions the other verbs were
designed to ask."

### 1.3 Verdict on inflation

**Fatal as bundled; manageable with a channel-split law.** The kit can absorb one more verb only if
the dodge is *not* a universal answer — see §2's acceptable rule. And the panel must resolve the F
double-booking and the Space triple-booking **before** adding a Shift verb, or the input layer ships
three contextual ambiguities simultaneously.

---

## 2. Does dodge-with-i-frames trivialize the shipped and in-flight combat design?

Take each system the enemy-combo panel authored, in its own terms.

### 2.1 The parry-bait return — YES, trivialized as specced

The bait's whole mechanism (`enemycombo-panel/designer.md` §3) is *punishing the parry timing*: the
feint draws the parry, the 154px-knockback-truth return arrives when your parry is spent
(PARRY_COOLDOWN 0.6s on a whiff, `constants.ts:609`). The counterplay is a *read*: don't parry the
feint, parry the return. A dodge roll with i-frames answers the bait **without the read** — you
dodge on the feint, you're invincible through the return, and the entire §3 choreography (including
the depth-7+ gold two-stage returns whose "chain math means this always meets a riposte-ready
player") becomes optional flavor. The bait only baits players who choose to engage with the parry
minigame. A rational player never does: dodge is strictly lower-risk (no whiff cooldown that
matters, no timing read) for equal safety.

### 2.2 The juggle escape — YES, and it deletes the DI system

The juggle grammar is: launcher (parryable at the door) → air-keeps → 1.6s landing punish, with an
escape/DI system so "the juggle must be leavable at every beat" (§4). Two failure modes:

- If dodge is usable while juggled: the DI system — designed *this session* — is dead on arrival.
  Nobody DIs when a button exits the juggle.
- If dodge is NOT usable while juggled: fine, but then the air-parry juggle escape the combo panel
  designed must remain the *only* aerial defensive verb — which means dodge is ground-only, which
  must be written down now, because "dodge but not in the air" is exactly the kind of rule that
  gets lost between waves.

### 2.3 Telegraph dodging (the RED channel) — YES, it redefines the channel

RED = unparryable = "move your body" (`constants.ts:565`, telegraph panel). This is a *spatial*
skill: reading AoE footprints, boss slams, zoner puddles. An i-frame dodge converts it to a
*timing* skill — stand in the slam, roll on the flash. Every boss telegraph tuned for
reposition-time (windup durations, AoE radii) is now mistuned: the effective answer window is the
i-frame duration, not the escape distance. Either every RED telegraph gets re-tuned for i-frame
timing (Souls-style), or dodge i-frames must not apply to the RED channel's AoE/DoT damage — pick
one, in writing.

### 2.4 The Scar-zone / positioning game — PARTIALLY

Zone geography (`mapgen.ts:893`, mapzones panel) rewards route-planning and standing in the right
place. A dodge with generous displacement is a positioning eraser (bad positioning becomes
refundable), but this is the least-damaged system *if* the dodge's displacement is modest
(≤ the crouch-dash the jump panel is already shipping) and the i-frames don't cover DoT ground
(puddles/pits). Note the deeper redundancy: the jump panel's **crouch-commit distance dash IS
already a dodge roll without i-frames** (stance 2 "dashing", `jumpfeel-panel/tech.md` §1.4). The
roadmap is about to ship two dash verbs in back-to-back waves whose only difference is i-frames.
That is indefensible as a kit. Seriously consider: **the dodge roll IS the crouch-dash, upgraded**
— one verb, one stance, one animation family — rather than a fifth mobility verb.

### 2.5 The acceptable rule (my price for withdrawing the objection)

> **Parry answers WHITE. Dodge answers RED-projectile and repositioning. Nothing answers both.**
>
> Concretely: dodge i-frames apply to **projectiles and melee sector tests only during the roll**,
> do **not** apply to AoE/DoT ground effects (puddles, slams, pits — the RED channel's area
> subclass), are **unusable while juggled** (DI stays the escape), and a dodge executed during an
> enemy's bait-return window does **not** grant the parry's reward ladder (no heal, no riposte, no
> deflect, no launch). Dodge buys safety and distance; parry buys safety **plus tempo plus
> resources**. Cooldown: dodge ≥ 2× PARRY_COOLDOWN so chain-parry stays the high-skill sustain and
> dodge stays the panic/reposition verb.

If the panel can't stomach a rule of this shape, the honest alternative is **no i-frames at all**
(pure displacement burst — merge it with the crouch-dash and ship nothing new).

---

## 3. Identity loss — what is a character worth after the merge?

### 3.1 The uncomfortable math of base-stat spreads

Today's identity: 5 class fantasies, each with a blurb, a growth direction, and a build payoff
("a Caster's levels feed INT-scaled weapons", `character-classes.ts:8`). It's thin, but it's
*directional* — it compounds every level for 30 levels.

Base stats don't compound. A real run reaches **L13-15 at the first boss** (ultimate panel's own
table, `designer.md:16`) — that's 39-45 allocated points post-merge. A base-stat spread big enough
to still be felt at L13 (say ±4-5 points) is big enough to break L1-3 balance, where 5 attribute
points is the difference between one-shotting and whiffing. A spread small enough to be safe early
(±1-2) is statistical noise by the second dimension. Base stats are a *character-select tooltip*,
not an identity. The **quirk carries the entire roster's appeal** post-merge — which means:

### 3.2 Forty quirks is a content cliff, not a data edit

5 classes → 40 characters × 1 signature quirk = 40 designed, balanced, netcode-honest,
VFX-supported mini-mechanics. The roster was generated as cosmetic skins
(`characters.ts:1-4`, "purely visual for M0"); the class system was deliberately a 5-bucket
overlay so the generator couldn't clobber it (`character-classes.ts:11`). If quirks are per-
*character*, the merge multiplies design surface by 8×. Counter-proposal for the panel: quirks per
**former archetype bucket** (5 quirks, the existing `CHARACTER_CLASS` map re-labeled "lineage") —
you keep the roster's flavor grouping, lose the gating, and don't sign up for 40 mechanics.

### 3.3 The C key is now a live respec exploit

`cycleCharacter` swaps your character **mid-run, mid-combat** (`ArenaScene.ts:3104`,
server-authoritative cycle). Today that's safe *because* characters have no stats — class growth is
read live per level-up and only re-aims *future* points (`progression.ts:42-45`). The moment
characters carry base stats and quirks, the C key is: swap to the tank quirk before the boss slam,
swap to the LUK spread before the extraction Harvest bonus (`HARVEST_PER_LUK`,
`constants.ts:362-365`), swap to the INT spread while your meteor DoT is mid-flight. Either base
stats apply only at spawn (then the C key silently lies about your stats), or cycling re-bases live
(exploit), or the C key dies and character choice moves to a lobby screen (a UX regression this
panel must own explicitly). There is no fourth option; pick in writing.

---

## 4. Auto-allocation removal — the fallout nobody priced

### 4.1 Decision fatigue, quantified

Today: 3 points/level, 2 auto-allocated by class, **1 flex pick** in a 5s invincible window
(`progression.ts:42-48`, `LEVELUP_WINDOW_SECONDS = 5`). A run to the first boss = ~13-15 flex
decisions. Post-merge with all points player-chosen: **~39-45 decisions**, i.e. 3 picks inside each
5s window, in a genre whose fantasy is *flow*. The options: extend the window (more invincible
downtime per player — and the window already blocks parry, `GameRoom.ts:813-819`, so more downtime
= more queued-verb weirdness), let picks queue past the window (allocation debt UI), or add a
"spend 3" macro button (which reinvents auto-allocation with extra clicks). The level-up UI
(`packages/client/src/ui/level-up-model.ts:380-397`) currently renders ONE chip choice plus an
"AUTO-GROWTH APPLIED: +1 STR • +1 CON" banner — the flow was *designed* around one decision.
Tripling decisions/minute in a bullet heaven is a real cost; the panel should consider keeping
**2 auto + 1 flex but moving the bias onto the character** (each character carries `growA`/`growB`
— the exact data shape of `classAttr`/`reqAttr`, minus the class). That achieves "classes stop
gating anything" without touching the allocation economy at all.

### 4.2 The orphaned default

`GameRoom.ts:4334`: an expired flex window auto-resolves the point into
`classForCharacter(player.character).classAttr`. If classes dissolve and all points are flex, the
AFK/disconnect path needs a new law (highest current attr? weapon's scaling attr? random?) — and
whatever it is feeds directly into §4.3's law, because the ultimate panel counts auto-resolved
points as flex picks (`ultimate-panel/designer.md:45-46`).

### 4.3 The ultimate panel's flex-only law MUST be re-based — the named amendment

The ultimate panel keys family/variant unlocks off **flex-pick frequency precisely because the 2
auto points pollute the signal** (`designer.md` §1.1: "Counting flex only makes the ultimate the
player's" — explicitly contrasted against class auto-growth). The merge changes the denominator
under the law:

- **Pacing**: attunement at the **5th flex spend ≈ level 6**, temper at the **10th ≈ level 11**
  (§1.3 table) assumes 1 flex/level. At 3 flex/level those become **level ~2-3 and ~4-5** — the
  ceremony fires before the player has met a tough enemy, and the drift window (spends 6-9)
  compresses into ~90 seconds.
- **Tie-breaks**: rule 2 leans on auto points "break[ing] the tie toward the character fantasy: a
  Caster splitting flex 2/2/1 attunes INT", and rule 3 is literally "the worn character's
  **classAttr**, then **reqAttr**" (§1.4). Both reference a concept being deleted.

**Required amendment, by name:** `docs/ultimate-panel/designer.md` — §1.1 (what counts: either all
3 points count and the "pollution" rationale is rewritten, or the player designates one
"attunement pick" per level), §1.3 (re-base attune/temper triggers to the 15th/30th spend *or* to
level thresholds L6/L11 directly), §1.4 (tie-break rules 2-3 re-based to the character's base-stat
bias or to raw totals only), and §1.1's AFK clause (re-based to §4.2's new default). This
amendment must land **before** any ultimate implementation wave starts, or the ultimate ships
implementing a law its foundation no longer defines.

---

## 5. The caster mechanic — already a weapon property; what actually breaks

Good news the panel should bank: there is **no code migration** for the cast mechanic itself. The
RMB bolt, cooldown, pierce, and INT grades all live on `classPool: "caster"` weapons
(`weapons.ts:192-214, 1012+`), and the augment lane already gates off the *wielded weapon*
(`augments.ts:288-300`). What breaks is the **economy**: the design's stated payoff loop is "a
Caster character's auto-grown INT finally has a payoff" (`weapons.ts:1013`). Post-merge, nobody
auto-grows INT. A player who never flexes INT finds every cast weapon (and the INT-scaled meteor
sub-hits, `weapons.ts:928`) permanently under-graded — the cast pool becomes a trap lane for 4/5 of
builds, *worse* than today, where at least 8 roster characters fed it for free. Mitigations to
choose from (pick one, in the doc): cast weapons get a floor grade so they're never dead; the
character base-stat spreads include INT-forward spreads that seed (not grow) the lane; or weapon
grades re-read the player's *highest* attr for hybrid-tagged weapons. "It'll sort itself out
through flex picks" is not an answer — the flex UI gives zero information about which attr your
*next* weapon drop will scale from.

## 6. Augment-draft re-gating — generalize, don't special-case

The beam wave already generalized the gate machinery: `augmentGateForWeapon` → `sigGateQueue`
snapshot at earn-time (`progression.ts:51-56`, the G-09 anti-swap rule) → `augmentDeliveriesForGate`
at draft-open. Character-class merge should touch **none of this** — and that's exactly the risk:
someone "cleaning up classes" greps `class` and hits `classPool`, `classCount` (weapon set bonuses,
`weapons.ts:338-360`) and `augmentGateForWeapon`'s classPool reads. **Guardrail:
the deletion is `CharClassId`/`CHAR_CLASSES`/`classForCharacter` and their call sites
(progression.ts:45, GameRoom.ts:4334, level-up-model.ts:380, ArenaScene.ts:7808) — nothing named
`classPool`/`classCount` may change in this wave.** Edge cases that DO need answers: the parry-lane
augments are "universal" today because parry is universal (`augments.ts:263-265`) — if dodge gets
its own augment lane later, the gate enum grows; reserve the string now or don't, but decide.
Weapon-class SET bonuses and authored-dual build identity survive untouched — they never read
character class. They become the *only* build-identity system, which raises their balance stakes.

## 7. Dodge-roll netcode honesty — the parry precedent laws applied

The parry earned its trustworthiness through specific, hard-won laws (parry panel + v0.105/v0.114
de-clunk): server grants i-frames **immediately on the accepted message** (`GameRoom.ts:808-829`),
on-cooldown presses are **buffered, never dropped** (`PARRY_BUFFER_SECONDS`, `constants.ts:632`),
the window is generous for 20Hz (0.52s ≈ 10 ticks), the client renders a local mirror but the
server owns the window. A dodge roll is *harder* than all of that, because parry is stationary and
dodge is a **movement verb**:

1. **It cannot be an `onMessage` action.** Roll displacement must be predicted or the player's own
   avatar rubber-bands on every roll. It has to ride the seq'd `InputCmd` path like jump/crouch
   (`jumpfeel-panel/tech.md` §1.2-1.3 is the template: a one-shot edge flag, server-stepped in
   shared movement code, replayed by the predictor byte-exact). That means the dodge **belongs to
   the jump wave's stance machine** (stance 0-3 shipping as normal/crouch/dash/pound) — dodge is
   stance 4, or *is* stance 2 with i-frames (§2.4). It structurally cannot land before the jump
   wave without building the same machinery twice.
2. **I-frame honesty at 20Hz**: a 0.3s roll is 6 ticks; the i-frame window must be granted from the
   server-consume tick of the flagged command, and the client's "I am invincible" render must be
   derived from the *predicted* consume tick, reconciled by the jump wave's `stanceSeq` primitive
   (that's what it's for — a forced cancel/desync resync). If the roll can be hit-canceled
   server-side, `stanceSeq` bumps; the predictor adopts. No new reconciliation concept needed IF
   this lands after the jump wave. A second reason the ordering is forced.
3. **Collision during the roll**: the shared solver separates overlapping circles symmetrically
   (`packages/shared/src/collision.ts:39-45`). Rolling *through* enemies needs a per-entity
   exemption flag in that solver, mirrored in client prediction, or the roll shoves a 154px-tuned
   knockback ecosystem around nondeterministically. Cheapest honest answer: **no pass-through** —
   the roll respects collision, i-frames only negate damage. Pass-through is a second feature;
   price it separately.
4. **The lag-compensation question parry never had to answer**: a rolling player's *position*
   matters to enemy sector tests (`inMeleeArc` is a ground-plane point test). At 100ms RTT the
   server sees the roll start ~2 ticks after the player did. If i-frames don't cover that gap, the
   roll feels like it "didn't work" exactly like the pre-v0.117 parry complaints; if they do
   (grant on receipt + a small backdated grace like the parry buffer), fine — write the number
   down. Steal the parry's answer: generous window, immediate grant, buffered input.

## 8. Migration risk to shipped content

Surfaces that reference character class today (all verified): `character-classes.ts` (the file),
`progression.ts:45-47` (auto points), `GameRoom.ts:4334` (AFK default), `GameRoom.ts:63` (import),
`level-up-model.ts:380-397` (auto-growth banner + class name), `ArenaScene.ts:7808` (HUD
"[Bruiser] — grows STR" line), the character-card blurbs (`CHAR_CLASSES[x].blurb`), the master spec
§38, and the ultimate panel's law (§4.3 above). Portraits/sprites/roster ids are untouched
(`PLAYABLE_CHARACTERS`, `isPlayableCharacter` guards, dev deep-links via `devEquip` validate
against the roster, not the class map — `GameRoom.ts` devEquip block). The character-select/cycle
UX is the real migration: today's card sells a class fantasy; post-merge it must sell a stat
spread + quirk, which is a *new card design*, and the C-key live-cycle question (§3.3) gates
whether selection stays in-run at all. Budget the card redesign or the roster reads as 40
identical hats — the exact "purely aesthetic" state §38 was built to escape.

## 9. Sequencing — the ordering that doesn't deadlock

Claims on the table: master at 17; working tree at **18** (receipt ring + sig-gate); enemy-combo
wave (implementing NOW, server) takes **19** (`juggledSeq`); jump wave takes **20** (`stanceSeq`,
stance fields) — both asserted in `jumpfeel-panel/tech.md:173-176`. All three waves plus this one
touch `GameRoom.ts`, `constants.ts`, `state.ts`, movement/prediction. The ordering that works:

1. **Enemy-combo wave (schema 19)** — finishes first; it's mid-implementation. Its juggle/DI/bait
   content must ship against the *current* verb set and be re-validated after dodge (§2 rules).
2. **Jump wave (schema 20)** — lands the stance machine + `stanceSeq`. Dodge needs both (§7).
3. **Class-merge wave (schema 21)** — in TWO sub-waves, deliberately:
   - **21a — the economy**: delete class growth, new allocation semantics, character base stats,
     level-up UI, AFK default. No new verb. This unblocks the ultimate re-base.
   - **21b — the dodge**: stance 4 (or upgraded stance 2), i-frame law from §2.4, netcode per §7.
     Gated on 20 being stable.
4. **Ultimate panel doc amendment (§4.3) lands between 21a and any ultimate implementation.** The
   ultimate wave is the flex law's *consumer*; it must not start building on §1.1/§1.3/§1.4 until
   they're re-based. The F-key conflict (§1.1 table) gets resolved in the ultimate wave, not here.

Deadlock warning: if 21b starts before 20 lands, two teams invent stance machinery in the same
files; if the ultimate implementation starts before 21a, it builds attunement pacing on a
denominator this wave deletes. The two gates above are the whole schedule.

---

## Hard guardrails

1. **The channel-split law (§2.4) or no i-frames.** Dodge never grants the parry's reward ladder;
   unusable while juggled; i-frames don't cover AoE/DoT ground; cooldown ≥ 2× PARRY_COOLDOWN.
   Written into constants comments like `constants.ts:372-373` is today — repeal that line
   explicitly, don't orphan it.
2. **Do not ship two dash verbs.** Either dodge = crouch-dash + i-frames (one stance), or justify
   both in one written paragraph the panel signs.
3. **`classPool`/`classCount`/`augmentGateForWeapon` are untouchable in this wave.** The merge
   deletes character-class symbols only (§6 list).
4. **Base-stat spreads capped at ±2 points at L1** until a balance pass proves bigger is safe; the
   C-key decision (§3.3) made explicitly, in the doc, before implementation.
5. **Quirks per lineage bucket (5), not per character (40)**, unless someone signs up for the 8×
   content bill by name.
6. **21a before ultimate implementation; 20 before 21b** (§9). Schema numbers claimed in this
   panel's tech doc before implementation, per the jump panel's coordination-statement precedent.
7. **Dodge rides the InputCmd/prediction path** (jump pattern), never `onMessage`; i-frames granted
   at server consume with a receipt-side grace; roll respects collision (no pass-through in v1).
8. **Auto-resolve default (§4.2) defined before `GameRoom.ts:4334` is deleted**, and the ultimate
   panel's AFK clause updated in the same commit as the doc amendment.

## Ship checklist

- [ ] Directive decomposed: economy (21a) and verb (21b) scoped as separate waves with owners.
- [ ] `docs/ultimate-panel/designer.md` §1.1 / §1.3 / §1.4 / AFK clause amended and re-signed.
- [ ] Dodge answer-matrix (§1.2) filled in and pinned: one written answer per threat row.
- [ ] `constants.ts:372-373` ("parry stays the only defensive tool") explicitly repealed/rewritten.
- [ ] Enemy-combo baits/juggles/DI re-validated in playtest *with* dodge; bait pick-rates checked
      (if bait combos stop killing anyone, §2.1 came true — re-tune or restrict dodge).
- [ ] C-key ruling (spawn-only stats / live re-base / lobby select) written and implemented.
- [ ] Level-up flow prototyped at 3 picks/window before committing to full manual allocation;
      the 2-auto-on-character fallback (§4.1) kept alive as the escape hatch.
- [ ] Caster INT-feed mitigation (§5) chosen and shipped in 21a, not deferred.
- [ ] Cast/beam/gun gate tests green post-merge (`sigGateQueue` snapshot untouched).
- [ ] Schema 21 claimed; `stanceSeq`/stance-4 integration reviewed by the jump wave's implementer.
- [ ] HUD/level-up/character-card class strings replaced (ArenaScene.ts:7808,
      level-up-model.ts:396-397, card blurbs) — no "[Bruiser]" ghosts.
- [ ] Master spec §38 rewritten to describe the universal kit + lineage quirks.
