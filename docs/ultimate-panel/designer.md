# ULTIMATES BY ALLOCATION FREQUENCY — Senior Ability Designer Panel Doc

Role: Senior Ability Designer (ultimate-economy pedigree, top-down co-op PvE). Scope: the unlock
law, the full roster with numbers, ceremony, and the tuning envelope. Co-op PvE only. No source
changes — this is the design contract the implementation panel builds against.

---

## 0. Ground truth this design is built on (verified in code)

| Fact | Where |
|---|---|
| The five attributes are exactly `str, dex, int, con, luk` | `packages/shared/src/leveling.ts` (`ATTRS`, §11) |
| Each level grants **3 points: 2 auto (classAttr + reqAttr from the worn character's class) + 1 FLEX the player picks** in a 5s invincible window | `packages/server/src/rooms/progression.ts` (`levelUpPlayer`, `allocate`), `LEVELUP_WINDOW_SECONDS = 5` |
| The FLEX pick arrives via the `chooseAttribute` message; server validates with `isAttr` and calls `allocate(player, attr, 1)` | `packages/server/src/rooms/GameRoom.ts` (~line 1196) |
| Level cap 30; XP curve `6 × 1.15^(L−1)`; a real run is **~L13–15 at the first boss** (≈12–14 flex spends), L30 only on a deep dimension chain | `leveling.ts` (`XP_BASE`, `XP_GROWTH`, `LEVEL_CAP`) |
| Five character classes bias the 2 auto points: Bruiser STR+CON, Duelist DEX+LUK, Caster INT+CON, Warden CON+STR, Scoundrel LUK+DEX | `packages/shared/src/character-classes.ts` |
| Damage scaling is per-weapon Elden-Ring grades; per-point coefficients S=0.10, A=0.08, B=0.06, C=0.045 | `packages/shared/src/weapons.ts` (`GRADE_DMG_COEFF`) |
| Crit: 5% base, +2%/LUK, +0.8%/DEX, cap 75%, ×2 | `leveling.ts` (`critChanceFor`) |
| Verb economy: WASD @ 320 px/s · Space hop (0.7s CD, 0.45s airtime, ~144px reach) · RMB fire · LMB parry (0.52s i-frames, 0.6s CD, 135px radius, chain heal/riposte) · E interact · R grab/salvage · F shop · Q inspect · T/B dev | `constants.ts`, `ArenaScene.ts` key map |
| Channel precedent: beams charge 0.65s, heat 0.6/s, overheat lock 1.5s, range 520–640px | `constants.ts` (`BEAM_*`) |
| Damage scale of the world: weapon swings 4–18, fodder 1–9 HP, mid enemies 36–48, elites 300–480, dimension bosses 1300–1900. Player 100 HP base, +8/CON | `weapons.ts`, `enemies.ts`, `leveling.ts` |
| Signature augments (every 5 levels) and weapon class set-bonuses (+8%/+18%) are **separate economies** — the ultimate is not an augment and must not double-dip them | `progression.ts` (§8), `weapons.ts` (`SET_BONUS_*`) |

**Input**: the ultimate lives on **G** (currently unbound; R/F/T/B/Q/E/C/M are all taken). One key,
no modifier, hold-nothing — an ultimate you have to chord is an ultimate you fumble at 20Hz.

---

## 1. THE UNLOCK LAW

### 1.1 What counts: FLEX allocations only

The law reads **only the player's FLEX picks** — the 1-of-3 point they consciously choose each
level via `chooseAttribute`. The 2 auto points are excluded.

Why: auto points are 2/3 of all income and are fully determined by the worn character's class. If
they counted, every Caster would get the fireball every run and the "frequency" mechanic would be a
character-select screen with extra steps. Counting flex only makes the ultimate the **player's
authored build statement** — two Casters in the same squad can attune differently, and the pick
window (already the game's one contemplative beat) gains a second meaning: you're not just buying
+1 INT, you're voting for your ultimate. The class still matters — it sets tie-breaks (1.4) and the
raw attr totals that scale the ultimate's damage — it just doesn't cast your vote for you.

AFK/auto-resolve rule: if the 5s window expires and the server auto-resolves the flex point, that
auto-resolved attribute **counts as a flex allocation** for the law. Every player attunes by the
same level, even the one who never opens the menu.

Tracking cost: one `Record<Attr, uint8>` of flex counts per player (5 bytes of schema), incremented
inside the existing `chooseAttribute` handler. No new messages.

### 1.2 The matrix: PRIMARY = family, SECONDARY = variant

- **PRIMARY** (most-flexed attribute) picks the **FAMILY** — the verb, the silhouette, the VFX
  budget, the muscle memory. Five families, one per attribute.
- **SECONDARY** (second-most-flexed) picks the **VARIANT** — a numeric/behavior modifier kit on the
  family. Four variants per family (the other four attributes).

That is a 5×4 = **20-cell matrix**, built as **5 hero kits × 4 modifier grammars** so the asset and
tuning cost is 5 + 20-rows-of-numbers, not 20 bespoke abilities. Primary-as-family is the right
polarity because the family is the expensive axis (animation, netcode shape, counterplay teaching)
and the primary attribute is the *slow, high-inertia* signal — it takes many picks to change.
The variant is cheap (numbers), matching the *fast, low-inertia* secondary signal.

### 1.3 Timing: attune at the 5th flex spend, temper at the 10th

| Beat | Trigger | What locks |
|---|---|---|
| **ATTUNEMENT** (the ceremony, §3.1) | The moment the player's **5th flex point** is allocated (≈ level 6, first third of dimension 1) | **Family locks forever** (for the run). Variant is provisional. |
| **DRIFT window** | Flex spends 6–9 | Variant **re-evaluates after every flex spend**: if a different attribute overtakes the current secondary by ≥1, the variant swaps (mini-ceremony, §3.1). Family never re-evaluates. |
| **TEMPER** | The **10th flex spend** (≈ level 11) | **Variant locks forever.** The kit is now fully yours; the meter gains its +10% temper bonus (max charge 100 → the fill sources pay +10%). |

Why 5: earlier and the sample is noise (2–3 picks); later and the ultimate misses the first-boss
rehearsal window (players should have 3–6 uses banked *before* the L13–15 boss so the boss is the
ultimate's exam, not its tutorial). Why family locks at attunement but variant drifts: shifting
ratios mid-run *should* matter (the user asked for evolution), but re-skinning the player's core
verb at level 14 destroys learned timing. Evolving the *numbers* is delight; evolving the *verb* is
vertigo. Answer to "does it evolve?": **yes — the variant evolves during the drift window; the
family does not.**

### 1.4 Tie-breaks (deterministic, replay-stable, no RNG)

Evaluated at attunement, and at each drift re-evaluation, in order:

1. **Higher flex count** wins (the law itself).
2. Tie → higher **raw attribute total** (auto points included — the class breaks the tie toward
   the character fantasy: a Caster splitting flex 2/2/1 attunes INT).
3. Still tied → the worn character's **classAttr**, then **reqAttr**.
4. Still tied → `ATTRS` declaration order (`str, dex, int, con, luk`) — the final court.

Degenerate case (all 5 flex into one attribute): primary is trivially that attribute; secondary
falls through rule 2→3 to the highest raw non-primary attr — for a mono-flex Bruiser that's CON.
Every cell in the matrix is reachable and every player state resolves to exactly one cell.

---

## 2. THE ROSTER — 5 families × 4 variants

Conventions used throughout:

- **Scaling**: every ultimate's damage scales like a weapon — `× (1 + 0.10 × (primaryAttr − 1) +
  0.045 × (secondaryAttr − 1))` (S-grade primary, C-grade secondary, reusing `GRADE_DMG_COEFF`).
  At the first boss a focused build sits ~18–22 primary → ×2.7–3.1 on the base numbers below.
  All listed damage is **base** (level-1-attr) unless noted.
- **Charge**: one meter, 0 → 100 points, banked at 100 (no decay, no double-bank). Sources (§2.6).
- **Crit**: ultimates roll `critChanceFor` per damage instance like any source (LUK builds feel it).
- **No PvP**: counterplay is expressed as *enemy-design levers* — what §20/§36 monster and boss
  kits do about each ultimate — plus the friction inside the kit itself.

### 2.1 STR — **SEISMARCH** (the worldsplitter slam)

*Fantasy*: the Bruiser answer — you become the meteor. A short leap, an armored descent, and the
arena floor becomes your weapon. (The hammer front-flip super-slam that just shipped is the
100-damage-scale big sibling of this; Seismarch is squad-visible terrain authorship.)

**Mechanics (base)**
- Press G: 0.35s crouch (armored — 60% damage reduction, knockback-immune), then leap to cursor,
  max 380px, airtime 0.5s (**i-frames during airtime only**, 0.5s).
- Impact: inner ring 160px — **60 damage** + 1.2s stun. Mid ring 300px — **32 damage** + 40% slow
  for 2.5s. Outer ring 440px — **14 damage** + a flat knockback of 96px away from epicenter
  (deliberately equal to `PARRY_KNOCKBACK` — same readable shove language).
- Leaves a **fissure decal** 3s: enemies crossing it take 6 damage/s (fodder-sweeper, not boss DPS).
- Total base payload on a single target standing at ground zero: 60. At first-boss scaling ×2.9 ≈
  174 ≈ **13% of a 1300 HP boss** — a chunk, not a phase-skip.

**Charge economy**: standard sources (§2.6) with **damage-TAKEN weighted ×1.5** — the Bruiser
fills by brawling in the pile. Anti-exploit: the taken-side cap (§2.6) stops face-tank idling.

**Counterplay / enemy levers**: the stun and slow respect elite **Unstoppable phases** (bosses
already run HP-gated phases — a phase can flag `ccImmune`, taking full damage but no stun). Flying
zoners hover outside the 440px ring. The 0.35s armored crouch is interruptible by nothing but
*positionally* punishable — a boss slam telegraph landing where you crouch still hits at 40%.

**Stat-owner synergy**: STR already scales most melee edges, so the Seismarch player's ult and
weapon grow off the same picks; the stun window is the squad's burst window (co-op payoff: a 1.2s
all-weapons-free window on a 300–480 HP elite ≈ a guaranteed elite delete for a 3-player squad).

**Variants (secondary attr)**

| Secondary | Name | Modifier kit (numbers replace/add to base) |
|---|---|---|
| DEX | **Aftershock Step** | Leap range 380→520px; rings shrink 20%; impact refunds the Space-hop cooldown and grants 0.6s of +30% move speed; meter cost effectively −15% (fill sources pay +15%) |
| INT | **Magma Verdict** | Fissure becomes a magma seam: 12 damage/s (was 6), 5s (was 3), and enemies killed on it explode for 10 in 60px |
| CON | **Bulwark Epicenter** | Allies inside 440px at impact gain a **20-HP overshield, 6s**; your own landing grants 1.0s of 40% damage reduction; inner damage 60→48 |
| LUK | **Jackpot Fault** | Every enemy hit rolls your crit chance ×1.5 for the ult only; each ult-crit kill +40% chance to drop an XP mote burst (server-rolled) |

### 2.2 DEX — **ALPHA STRIKE** (the Master Yi cell, by name)

*Fantasy*: you stop being a body and become a verdict. Untargetable, the screen stutters with
paper-cutout after-images, six enemies learn simultaneously.

**Mechanics (base)**
- Press G with cursor over/near enemies: you vanish (**untargetable + intangible, full duration**)
  and strike up to **6 targets** within a 420px chain radius of each previous target, 0.13s per
  hop (max ~0.9s total). Fewer targets = proportionally shorter.
- **22 damage per strike** (132 total if 6 targets; a single isolated target eats only ONE strike
  +50% = 33 — single-target dumping is deliberately weak, this is a *crowd* verdict).
- **Execute rider**: strikes against enemies below 15% max HP deal ×2.5 (fodder at 1–9 HP simply
  evaporates — this is the wave-delete ult).
- Reappear adjacent to the **last target** (cursor-side), with 0.25s post-strike i-frame landing
  grace. Cannot parry/fire during (you have no body).
- If cast with zero valid targets in 600px: fizzles into a 200px dash with 0.3s i-frames and
  refunds 60 of the 100 charge — an escape valve priced at 40 charge.

**Charge economy**: standard, with **kill-side weighted ×1.5** — the Duelist fills by finishing.
Anti-exploit: fodder kills pay 0.3 each (§2.6), so shepherding a swarm is fine but can't loop the
meter faster than the intended 75s floor.

**Counterplay / enemy levers**: the chain needs targets within 420px of each other — **spread
formations** (zoner rings) cap it at 2–3 strikes. Elites can carry a **riposte brand**: an elite
struck by Alpha Strike marks the reappearance point during the hops and fires a parryable counter
bolt at it — the LMB parry stays live *after* the ult, so the ult chains into the verb kit instead
of replacing it. Bosses take max 2 strikes per cast.

**Stat-owner synergy**: DEX feeds finesse-weapon grades and +0.8%/pt crit — Alpha Strike's 6
instances all roll crit, so the DEX/LUK Duelist's ult expected damage rises ~35% by first boss from
crit alone.

**Variants**

| Secondary | Name | Modifier kit |
|---|---|---|
| STR | **Guillotine Chain** | 6 strikes→4, damage 22→38 per strike, each hit +0.5s stagger — the elite-hunter cut |
| INT | **Phantom Reprise** | Each struck enemy detonates in an arcane echo 1.5s later: 8 damage, 80px — the crowd gets a second act |
| CON | **Iron Wake** | Reappearance grants 15-HP overshield ×(strikes landed ÷ 2), 5s; post-strike grace 0.25→0.6s |
| LUK | **Deathmark Gambit** | Execute threshold 15%→25%; every kill during the ult adds +1 max strike to the NEXT Alpha Strike (cap +3) |

### 2.3 INT — **SUNSPITE COMET** (the fireball, by name)

*Fantasy*: the Caster's thesis statement — one huge, slow, screen-lighting projectile you *aim*,
with a fire-field aftermath the squad fights around. The one ultimate visible from across the map.

**Mechanics (base)**
- Press G: 0.4s overhead conjure (move at 55% — the beam-charge feel, `BEAM_CHARGE_MOVE_MUL`
  precedent), then the comet launches at the cursor. Range up to **1100px** (≈ 2× beam max range),
  speed 520 px/s — slow enough to lead, fast enough to land.
- Direct impact (first enemy or cursor point): **48 damage** in a 96px core, plus **26 damage** in
  a 220px blast, plus **Ignite: 8 damage/s for 4s** on everything struck.
- Leaves a **scorch pool**, 150px, 5s: 9 damage/s, enemies inside are ignite-refreshed. (Decal +
  floor-renderer pipeline already exists for this kind of persistent mark.)
- Total base on a ground-zero elite: 48 + 26 + 32 ignite + pool time ≈ **~120 base**, ×2.9 at
  first boss ≈ 350 ≈ 25% of a 1300 boss **if it eats everything including full pool uptime** —
  the headline number, paid for by the aim requirement and the boss simply walking out of the pool.

**Charge economy**: standard, with **damage-DEALT weighted ×1.25** (the Caster fills by casting).
Anti-exploit: per-enemy credit cap (§2.6) — you cannot pump the meter into one bullet-sponge; the
overkill exclusion means fodder pops credit ≤ their HP.

**Counterplay / enemy levers**: it's a projectile — **shield-rank enemies** block it bodily
(soaking the core hit for the ranks behind), and it can be *pre-detonated* by boss projectile-
clear pulses. The pool is area denial that cuts both ways: §36 bosses that relocate force the squad
to abandon their own pool. Travel time is the tax — a 1100px cast arrives in ~2.1s.

**Stat-owner synergy**: INT casters' weapons (scatter orbs, chain lightning INT grades) share the
attribute; ignite + weapon burn augments (§8 signature lane) stack additively, never
multiplicatively — the gate rule in §5.

**Variants**

| Secondary | Name | Modifier kit |
|---|---|---|
| STR | **Meteor Sunder** | Comet drops from above at cursor (no travel line, 0.9s fall telegraph shadow); core 48→70, no pool — the fireball becomes a slam-caster hybrid |
| DEX | **Twinflare** | Splits into 2 comets (55% numbers each) with independent cursor + 0.4s re-aim between; speed 520→680 px/s |
| CON | **Hearthfall** | Scorch pool heals allies 6 HP/s instead of nothing (still burns enemies); blast 26→20 — the co-op anchor cell |
| LUK | **Solar Roulette** | Ignite ticks can crit; every ignite kill extends pool duration +0.6s (cap +3s) and pops a 40px ember for 6 damage |

### 2.4 CON — **EVENT HORIZON** (the phase attack, by name)

*Fantasy*: the Warden stops obeying the dimension. You become a slow-walking eclipse — intangible,
unkillable, and everything you pass through comes apart. The bullet-heaven inverts: the bullets
pass through *you*.

**Mechanics (base)**
- Press G: instant. For **2.6 seconds** you are **phased**: immune to all damage and CC, no
  collision (walk through enemies and low barriers; **pits still kill** — the ground is not
  negotiable, and this keeps map design meaningful), move speed fixed at 320 (no slows, no buffs).
- You cannot fire, parry, or jump while phased — the verbs are the price. (Mirror of the beam
  channel contract: commitment buys power.)
- Enemies you overlap take **12 damage per 0.4s tick** while overlapped and gain **Unravel: +20%
  damage taken from all sources for 4s** (max 1 application per cast per enemy). Walking a line
  through a swarm ≈ 24–36 to each body crossed — fodder dies, mids get softened and branded.
- Exit (timer or early re-press): a 170px collapse shockwave, **26 damage** + 96px knockback.
  Early exit refunds 8 charge per unused full second.
- Anti-grief clarity: phased players can still be *seen* (paper-cutout silhouette at 40% alpha +
  event-horizon ring) so squadmates track the tank.

**Charge economy**: standard, with **damage-TAKEN weighted ×2** — the ult that saves your life is
charged by the hits that threaten it. Anti-exploit: the taken-side hard cap (§2.6) plus the fact
that HP lost is the currency — regen (6+0.7/CON per s) is the real gate; you cannot buy charge with
HP you don't have. Self-damage sources credit nothing.

**Counterplay / enemy levers**: phase ignores damage, **not geometry or objectives** — a boss that
channels a pylon or eats a downed ally's revive timer doesn't care that you're intangible; you
watch, immune and useless, verbs locked. **Null-field elites** (§2.6's charge-suppressor) can be
tuned to also slow Unravel application. Bosses take tick damage but never Unravel (flag).

**Stat-owner synergy**: CON per point is +8 max HP +0.7 regen — the Warden who flexes CON has both
the biggest HP pool feeding the taken-side charge and the most survivable exit. Squad calculus:
2.6s of a body that herds enemies (they still chase you) while immune = a living lure; the Unravel
brand is the tank's damage contribution done honestly.

**Variants**

| Secondary | Name | Modifier kit |
|---|---|---|
| STR | **Crushing Horizon** | Tick 12→18, exit shockwave 26→44 and stuns 0.8s; duration 2.6→2.0s |
| DEX | **Slipstream** | Move speed while phased 320→430; duration 2.6→2.2s; exit grants Space-hop reset + 0.4s i-frames |
| INT | **Accretion** | Enemies within 120px (not just overlapped) take a 6/0.4s pull-tick and drift 40 px/s toward you — a walking singularity; exit wave 26→20 |
| LUK | **Probability Veil** | Unravel +20%→+28%; each enemy that dies while Unraveled refunds +3 charge (cap +24 per cast) |

### 2.5 LUK — **DIMENSION DOOR** (the far teleport on cursor, by name)

*Fantasy*: the Scoundrel cheats. Everyone else crosses the arena; you simply decline to. It's the
dimension-drifting theme made into a button — a personal rift, a lie left behind, and a return
ticket if the lie gets found out.

**Mechanics (base)**
- Press G: **instant blink to cursor, up to 1400px** (≈ full screen diagonal), through enemies,
  barriers, and pits. Arrival grants **0.5s i-frames** + 25% move speed for 2.5s.
- Origin point leaves a **Rift Decoy**, 2.5s: taunts enemies within 300px (they attack it — it has
  40 HP ×squad-size scaling), then detonates: **34 damage, 200px**. If enemies kill it early, it
  detonates early.
- **Return ticket**: re-press G within 4s to snap back to the decoy point (consumes the decoy
  without detonation). The round trip is the outplay: dive, delete, ghost.
- **Gambit rider** (the LUK identity): your next **3 attacks within 4s** of arrival are
  **guaranteed crits** (respects the ×2 `CRIT_MULT`; counts per swing/shot, server-rolled as
  chance=1 so all existing crit juice fires).
- Fizzle guard: a blink targeting an out-of-bounds/void cursor clamps to the nearest valid ground
  along the ray (the `MAP_MAX_JUMP_TILES` reachability rules already define "valid").

**Charge economy**: standard, with a **flat +8 charge on any loot/rarity event you trigger**
(chest, elite drop, shrine — LUK's existing loot identity feeds its ultimate). Anti-exploit: loot
events are finite world objects; the +8 is a garnish (≤15% of a bar per dimension), not a loop.

**Counterplay / enemy levers**: **Rift-latch hunters** — a §20 enemy kind that, if within 200px of
your departure, follows you through 0.8s later (telegraphed rift crack at your arrival point,
parryable lunge on arrival — feeds the parry combo machine). Decoys do nothing to bosses (flagged
taunt-immune); the boss keeps facing the squad, so the Door is repositioning, not aggro-wipe.
The 3-crit rider is melee-range bait: you must *attack* to spend it, pulling the Scoundrel into
the fight the blink just removed them from.

**Stat-owner synergy**: LUK is crit + loot; the guaranteed-crit rider converts a defensive blink
into the highest single-target burst enabler for slow heavy weapons (an 18-damage slug ×2 crit ×3
shots = 108 weapon damage authored by the ult without the ult dealing it — the ultimate amplifies
the verb kit instead of replacing it, the LoL-ultimate lesson).

**Variants**

| Secondary | Name | Modifier kit |
|---|---|---|
| STR | **Breach Door** | Arrival is an impact: 28 damage + knockback in 140px; crit rider 3→2 attacks; range 1400→1100px |
| DEX | **Double Door** | Return-ticket window 4→6s; using the return grants a second (short, 500px) blink charge within 3s — the triangle play |
| INT | **Riftburn Door** | Decoy detonation 34→50 and leaves a 100px scorch (6 damage/s, 3s); departure AND arrival each pulse 10 damage in 90px |
| CON | **Bastion Door** | Decoy HP 40→90 and taunt radius 300→420px (a real tank-summon beat); arrival i-frames 0.5→0.9s; crit rider removed, replaced by 15-HP overshield on arrival |

### 2.6 The charge economy (shared law)

**Meter**: 0→100 points, one bank (no storing two casts), no decay, persists across dimension
pushes like levels do (fresh run resets).

**Sources (base rates before per-family weights):**

| Source | Rate | Anti-exploit clamp |
|---|---|---|
| Damage dealt | +1 per 30 damage (post-mitigation; **overkill excluded**) | Per-enemy credit cap = that enemy's max HP (you can't milk a sponge past its pool); **training dummies credit 0** (training mode `T` disables all charge gain) |
| Kills | fodder +0.3 · mid +3 · elite +10 · boss phase-break +18 | Kill credit goes to the killer only; XP stays squad-shared, charge does not (prevents one farmer feeding four meters) |
| Damage taken | +1 per 5 HP actually lost | **Hard cap 20 points per bar** from this source; self-inflicted and pit damage credit 0 |
| Time alive in combat | +0.15/s (combat = dealt or took damage in last 5s) | Zero while idle/out of combat — no AFK charging |

**Design targets, not constants**: tune the four rates to hit **time-to-fill 75s ± 15s at median
squad-member DPS**, measured mid-dimension-1. Early run ≈ 100–120s per fill; late run ≈ 55–70s as
DPS scales. Expected **6–10 casts across a 12–15 minute dimension chain**. The rates above are the
opening bid that hits this at ~20 sustained DPS + normal wave-kill tempo.

**Why hybrid**: any single source is exploitable — dealt-only farms sponges, kill-only rewards
kill-stealing (poison for co-op), taken-only rewards face-tanking, time-only rewards hiding. The
mix with per-source clamps means the fastest way to charge is *the way the game wants you to play*,
and each family's ×-weight (taken ×1.5–2 for STR/CON, kills ×1.5 for DEX, dealt ×1.25 for INT,
loot garnish for LUK) makes the meter itself feel class-flavored.

**Enemy-side lever (global counterplay)**: one late-dimension elite kind, the **Null Warden** —
a slow zoner projecting a 240px field in which charge gain is 0 and ready ultimates cannot be cast
(meter greys, no drain). Kill it or leave the bubble. This gives encounter design a dial against
ultimate tempo without ever touching the player's banked meter (never steal what's earned —
suppress, don't refund).

---

## 3. CEREMONY

The game already owns two sacred pauses: the invincible 5s level-up window and the every-5th-level
signature draft. The ultimate gets **three beats of ceremony and one of aftermath**, sized to never
exceed the paper-cutout language the art direction just shipped.

### 3.1 The unlock reveal (ATTUNEMENT)

Fires the instant the 5th flex point lands — which is *inside* the pick window, so the player is
already invincible and already looking at UI. Sequence (~2.2s total, skippable after 0.8s):

1. The flex panel's chosen attribute chip **tears away** (paper-rip) and slams center-screen.
2. A full-width **attunement folio** unfolds (same folio language as the level shell): family
   sigil in the attribute's color, name in display caps — "ATTUNED — SUNSPITE COMET", variant
   subtitle beneath ("Twinflare · DEX drift"), and one line of mechanics ("G — hurl the comet.
   Charge by dealing damage.").
3. Squad-wide toast + bark: "**Odette attuned: DIMENSION DOOR**" — co-op legibility is the point;
   your squad should know what's coming before it comes.
4. The meter UI is born empty at this moment (bottom-center, ring around a G keycap) — starting
   at 0 makes the *first* fill a second, self-paced ceremony.

**Variant drift** (spends 6–9, §1.3) plays a 0.9s mini-beat: the subtitle line tears and re-stamps
("Twinflare → Hearthfall"), one chime, no folio. **Temper** (10th spend) plays a gold edge-stamp
on the meter ring + "TEMPERED" chip.

### 3.2 Ready state

- Meter ring fills clockwise, attribute-colored. At 100: a **single low chord** (per family — five
  chords, learnable by ear across the squad), the ring solidifies, and the player gains a **quiet
  idle aura**: a 1px paper-cut ring at the feet pulsing at 0.5 Hz, ~25% alpha. Visible to the
  squad at a glance, dim enough to never fight the bullet-field for attention.
- After 12s sitting on a full bar, the aura adds a slow ember drift — a nudge, not a nag (no decay,
  no penalty; hoarding for the boss is a legitimate strategy and the drift *marks* the hoard).
- HUD: keycap "G" inside the ring brightens only at 100 — the affordance appears exactly when true.

### 3.3 Activation punch

Per family, but a shared spine: **freeze (60–80ms local hitstop) → paper flash (3-frame cutout
pop of the family sigil) → the verb → color-desaturation pulse** radiating from the caster (80ms,
world briefly loses 30% saturation so the ult's own colors own the frame). Camera: 4px shake for
Seismarch/Meteor cells only — teleports and phases get *silence* instead of shake (absence as
punch). One bark line per family per character-voice bucket.

Server truth: cast is a single `castUltimate` message; the server validates meter=100, applies,
zeroes. All damage/CC server-side like every other source; the client ceremony is fire-and-forget.

### 3.4 Aftermath beat

- The meter **shatters** (paper confetti falls into the empty ring) and begins refilling — the
  emptiness is the receipt.
- 2s after the effect ends, a small tally chip rises from the meter: "**COMET — 23 hit · 14 down**"
  (hits + kills). This is the ultimate's scoreboard heartbeat and the tuning telemetry surfaced as
  delight.
- World receipts persist: fissure/scorch/rift decals through the existing decal manifest, 3–5s.
- Squad receipt: kills your ultimate scores flash your attribute color on their death pop — the
  squad *sees* whose ult cleaned the wave.

---

## 4. TUNING PHILOSOPHY

**The prime directive: run-defining, never verb-erasing.** The parry chain, the beam heat dance,
the hop, and weapon swings are the game. The ultimate is the exclamation point that appears 6–10
times per run — if any player's optimal loop becomes "wait for G," the numbers below are wrong.

**The numeric envelope:**

| Metric | Target | Red line |
|---|---|---|
| Ultimate share of total squad run damage | **8–14%** | >18% = nerf charge rate or payload |
| Casts per 12–15 min run | 6–10 | >12 = it's a cooldown spell, not an ultimate |
| Time-to-fill at median DPS | 75s ± 15s | <50s sustained = clamp the abused source |
| Single-cast damage vs a dimension boss (1300–1900 HP) | ≤ 15% of max HP | One ult must never skip an HP-gated phase (clamp: a single cast can't cross more than one phase floor) |
| Single-cast fodder clear | 100% inside the core shape | This is the fantasy; don't tax it |
| i-frame uptime from ultimates | ≤ 4% of combat time (e.g. 2.6s phase / 75s fill ≈ 3.5%) | The parry (0.52s per 0.6s, skill-gated) must remain the i-frame economy's centerpiece |
| CC on elites per cast | ≤ 1.2s hard CC | Chain-stun via squad ult-stacking is capped by a shared 3s elite CC-immunity window after any ult stun |
| Ceremony time cost | ≤ 2.2s once, ≤ 0.9s per drift | Never open a modal during boss last-stands |

**Interaction gates**: ultimates read attribute scaling and crit, but are **excluded from** weapon
set-bonuses (`weaponSetBonus`), signature augment damage multipliers, and parry-riposte triggers —
one scaling spine (attrs + crit), no multiplicative towers. Any future augment that touches the
meter (e.g. "+10% charge from kills") lives in its own §8 gate lane and is capped at +25% total
charge-rate from all augments.

**Co-op stacking**: no combo-multipliers between simultaneous ultimates (they already stack
additively and that's enough spectacle); the shared elite CC-immunity window (above) is the only
cross-player governor. Squad size scales *enemy counts* (existing), which organically scales charge
income — verify fill-time targets at 1p and 4p separately; clamp kill-credit rates at 4p if fill
drops below 55s.

**Tuning order of operations** when a family over/under-performs: (1) charge weights, (2) variant
deltas, (3) base payload, (4) shape sizes — in that order. Charge is the cheapest, least
feel-destroying dial; geometry is the most learned and should move last (the §14 WYSIWYG ruling —
sizes never scale in-run — applies to tuning patches in spirit: players memorize shapes).

**What ships first (M-slice)**: the law + meter + ONE family per attribute at base kit (5
ultimates, no variants), variants stubbed to base. The drift/temper system ships with the variant
wave. This gets the ceremony and the economy under real telemetry before the 20-cell matrix costs
its full art budget.
