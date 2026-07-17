# Tough-Enemy Combo Language — Senior Combat Encounter Designer

Panel: enemy combos (negotiated leap · combo grammar · parry-baits · juggles). Role: combat encounter design (Sekiro/Nioh pedigree, translated to top-down 20Hz co-op). This document is design only; it modifies no source.

## Design thesis

The user's ask is a single insight worth building an entire enemy tier around: **familiarity is the difficulty knob**. Sekiro is hard but fair because every fight opens from a known spatial frame — the enemy squares up, you know the distance, you know the rhythm families, and mastery is recognizing *which* rhythm this is, fast. Our toughs currently inherit trash behavior with bigger numbers (`TOUGH_HP_MULT` / `TOUGH_DAMAGE_MULT` in `GameRoom.ts`). This panel gives the tough flag a *language*: a canonical opening position (the Negotiated Leap), a small set of authored rhythms per weapon family (the Combo Grammar), and two advanced dialects that treat the player's own defensive verbs as choreography inputs (Parry-Baits and Juggles).

Everything below is authored on the existing rails and cites them:

- The duelist state machine `idle → leapwind → leap → windup → recover` with per-step Lock geometry commit at `MELEE_LOCK_PHASE = 0.65` (`packages/server/src/rooms/GameRoom.ts:278`, `:5581-5624`).
- The diegetic telegraph beats Claim `0–0.15` / Load `0.15–0.65` / Lock `0.65–0.88` / Release `0.88–1.0` normalized over each wind-up (`docs/telegraph-panel/combat-designer.md`), with the weapon **glint** at 280 ms lead / 60 ms crest (`packages/client/src/entities/SpriteRig.ts:96-97`).
- Parry physics: attacker instantly displaced `PARRY_KNOCKBACK × 1.6 ≈ 154 px` away (`GameRoom.ts:5736-5745`), chain ≥ 3 adds +96 px and a 1.0 s stagger (`:5761-5780`); the parrier is lofted `PARRY_LAUNCH = 420 px/s` (cap 640) and shoved `PARRY_PUSH = 130` (`constants.ts:679-681`).
- Vertical physics: `GRAVITY = 1350 px/s²`, `stepVertical` height axis (`packages/shared/src/movement.ts:193-201`), parry window `PARRY_IFRAMES = 0.52` + `PARRY_BUFFER_SECONDS = 0.2` + `PARRY_CHAIN_CD = 0.12`.
- Server tick = 50 ms. **Every timing below is a multiple of 0.05 s** so authored beats land on ticks, and every inter-impact gap is ≥ 0.25 s so a chain-parry (0.12 s chain CD + 0.2 s buffer) is always physically possible. That is the fairness floor for this whole document.

---

## 1. The Negotiated Leap — one spatial frame for every combo

### Why "negotiated"

The existing `vault-ronin` leap is an *attack*: it lands ON your coordinates under a red dodge marker (`GameRoom.ts:5534-5541`). The Negotiated Leap is the opposite verb — it is a **duel offer**. The tough leaps not at you, but to the *canonical engagement point in front of you*, so that every combo in this document begins from the same distance, the same relative angle, and the same settle rhythm. Familiar frame → learnable timing → the player's attention goes to *reading the rhythm*, not to re-solving spatial chaos. It also solves top-down melee's chronic problem: combos that start from random ranges have wildly different effective reaction times.

### The canonical frame

At leap commit the server samples the target player's position **and facing** (aim direction — already authoritative for swings) and computes:

- **Landing point** = `player.pos + facing × D_canon`, where `D_canon = 0.80 × opener range` of the combo about to run (katana `range 138` → **110 px** dead ahead; heavy `range 150` → **120 px**; thrust `range 145` → **116 px**).
- **Landing angle** = facing the player (enemy aim = `−facing`), so the opening wedge always arrives from the player's 12 o'clock.
- Arena-clamped; if the clamp moves the point > 40 px, slide the point around the player's front 90° arc to the nearest valid spot and extend the settle beat by +0.10 s (an honest "awkward landing").
- **No mid-air retarget.** The point is committed at leap-Lock exactly like a strike's geometry. If the player sprints or turns after commit, the tough lands on the stale frame and its *per-step* Lock samples (existing machine) re-acquire honestly. Rotating your facing during the wind-up is legitimate counterplay — you're refusing the duel frame — and the tough pays for a misaligned opener.

### Telegraph of intent (this is a white event, not a red one)

The existing leap marker is red = dodge. The Negotiated Leap must read as *"combo incoming, parry language begins"*:

| Beat | Duration | Attacker layer | World layer | Underlay |
|---|---:|---|---|---|
| **Offer** (leapwind) | **0.30 s** (6 ticks) | Deep crouch, weapon drawn across the body, head snaps to the target — the §40 chamber pose driven by `enemy.windup` | Dust inhales at the enemy's feet | Thin **white** perimeter ring (enemy radius + 10 px) fades in at the landing point from the first tick — full footprint from Claim, never grown from zero |
| **Arc** (leap) | **0.35 s** fixed (7 ticks) | Ballistic hop; render height via a cosmetic arc (peak ~48 px, matching `stepVertical` feel) | Shadow blob travels ground track | Ring holds; a faint chord line from launch to landing |
| **Landing + settle** | **0.25 s** (5 ticks) | Land in the combat stance, one knee dip, weapon settles to guard | **Landing dust burst** (paper-cutout poof, quake-crack component 6 at low count), pebble tick SFX | Ring collapses inward and dies — the "duel accepted" beat |

Air time is **fixed at 0.35 s regardless of distance** (speed varies, arrival time doesn't — the existing leap already integrates distance/time-left, `GameRoom.ts:5557-5568`). Fixed arrival is the metronome: *offer → one-count → land → half-count → first wind-up* is identical from 200 px or 540 px away. Leap trigger envelope: distance ∈ (`approach`, 560], cooldown 4.0 s, one leap per combo.

**Total pre-combo runway:** 0.30 + 0.35 + 0.25 = **0.90 s** of unambiguous announcement before the first strike's wind-up even begins. That's the price of the familiarity payoff — the leap is a gift, and it should feel like one.

### The settle beat is sacred

Nothing damages during the 0.25 s settle. No contact damage tick (toughs running this language should keep `contactDamage: 0`, like the ronin). The settle is where the player chooses: hold ground and parry, pre-turn to break the frame, or dodge-jump out. Every combo below counts its step-1 wind-up **from the end of settle**.

---

## 2. Combo Grammar — the rhythm families

Toughs wield real weapons (`ENEMY_MELEE_POOL`, `packages/shared/src/enemies.ts:494-506`), so the grammar is authored per **weapon family**, mirroring the player-side `MeleeComboFamily` vocabulary (`packages/shared/src/melee.ts`) — the player already *knows* these shapes from their own hands. Four families cover the pool:

- **Katana/Sabre** (arc): `x-sword-neon-katana`, `rattler-sabre`, `driftblade`
- **Heavy** (chop): `rusty-cleaver`, `x-sword-anchor`, `x-sword-coffin`, `x-sword-bone`, `tombstone-greatsword`, `x-sword-buzzsaw`
- **Thrust**: `x-sword-railspike`
- **Dual/Rake**: `twin-bowie-fangs`

Every step obeys the existing contract: `enemy.windup` ramps 0→1 (white rhythm ring + chamber pose), wedge telegraph commits at Lock 0.65 with exact geometry (`addMeleeTelegraphRow`), glint crests 280 ms before impact, strike resolves from the advertised Lock coordinates. Parry windows are therefore *implicit and honest*: any white step parried within `PARRY_IFRAMES` is negated. Steps marked **RED** are dodge/jump-only sweeps and never glint.

Notation: `windup / step-advance px / damage ×` (damage × is relative to the kind's base `melee.damage`, before `TOUGH_DAMAGE_MULT` and `depthDamageScale`).

### Katana — the teaching family

**K1 · Sanren (fast-fast-slow).** The bread-and-butter three, the rhythm every player should be able to hum.
1. Forehand cut — **0.40 s** / 66 px / 1.0× (white)
2. Reverse backhand — **0.30 s** / 66 px / 1.0× (white)
3. Overhead finisher — **0.75 s** / 96 px / 1.25×, knockback `HIT_KNOCKBACK_IMPULSE × 1.3` (white, **gold-tinted glint** to mark "finisher")
Recover **1.10 s**. The long third beat is the parry-chain trainer: two quick parries build the chain, the slow gold third is the free riposte setup (chain hits 3 exactly here → 1.0 s stagger). This combo is *designed to be beaten completely* by a player who knows it.

**K2 · Drawn Moon (delayed iai).** One strike, all nerve.
1. Sheath hold — **0.95 s** wind-up in a motionless iai crouch, white shimmer running the scabbard through Load, wedge (halfArc 1.4 — nearly a half-moon) commits at Lock 0.62 s, glint at 0.67 s → release: instant wide cut, 1.5×, 84 px step.
Recover **1.30 s**. The delayed-thrust rhythm in arc form: the danger is the *stillness*. Punishes panic-parry (0.52 s i-frames spent at 0.4 s leaves you naked at 0.95 s); rewards the disciplined single read.

**K3 · Gale Cross** — parry-bait, defined in §3.

**K4 · Sky Hook** — juggle launcher, defined in §4.

### Heavy — the weight family

**H1 · Sweep-into-Overhead.** The mixed-verb classic.
1. Low sweep — **0.55 s** / 40 px / 0.9× — **RED**, 260° low arc, jump-over or back out (this is the one step in the core grammar that is not parryable; it teaches that red-on-a-tough means *feet*, mirroring `footfallQuake`'s jumpable language)
2. Overhead slam — **0.65 s** / 78 px / 1.35×, small ground crack decal (white, parryable — and because the sweep pushed you to jump, the overhead lands as you do: jump → land → parry is the intended two-verb sentence; gap between impacts 0.65 s, comfortably ≥ 0.25 s floor)
Recover **1.25 s**.

**H2 · Anchor Drag (delayed yank).**
1. Drag — the weapon scores the ground for **0.90 s** (crack line paints along the pull path through Load — pure world-layer foreshadow), then a rising yank: 1.3×, 90 px advance, white, glint on the blade as it leaves the dirt.
Recover **1.20 s**. Heavy's iai — the drag *sound* (stone scrape) is the timing channel as much as the visuals.

**H3 · Gravedigger** — parry-bait return, §3.

**H4 · Coffin Lid** — heavy juggle, §4 (depth-gated).

### Thrust — the line family

**T1 · Rail Sequence (fast-fast-slow).**
1. Jab — **0.35 s** / 50 px / 0.85× (white, narrow capsule wedge)
2. Jab — **0.25 s** / 50 px / 0.85× (white — the 0.25 s gap is exactly the chain-parry floor; this is the tightest legal beat in the grammar)
3. Step-through impale — **0.60 s** / 110 px / 1.3× (white, gold glint)
Recover **1.00 s**. Thrust wedges are thin: sidestep is as valid as parry, and the combo drifts past a strafing player — lateral movement is this family's built-in answer.

**T2 · Switchback** — parry-bait, §3.

### Dual — the flurry family

**D1 · Fang Flurry (the chain-parry exam).**
1–4. Alternating lead/off rakes — **0.35 / 0.25 / 0.25 / 0.55 s**, 40 px each, 0.7× each (all white)
Recover **1.15 s**. Four crests, each individually cheap, collectively lethal. Built for `PARRY_CHAIN_CD`: parry all four and the chain reward (heal ×4 stacks, riposte from hit 3) pays out the fight's biggest defensive jackpot. The final 0.55 s beat is the exhale.

**D2 · Scissor Lift** — dual juggle launcher, §4.

---

## 3. Parry-Baited Combos — choreographed around the 154 px truth

### The core trick

The parry displaces the attacker by a **known constant**: `PARRY_KNOCKBACK × 1.6 ≈ 154 px` straight away from the parrier, applied instantly (`GameRoom.ts:5736-5745`). Today that ends the exchange. A parry-bait combo *authors the knockback into the choreography*: the baited step exists to be parried, the enemy is knocked to a position it already planned for, and it converts the recoil into a **return** — a longer-telegraphed, stronger re-entry that closes the exact displacement plus margin.

Return math: after the parry the enemy sits ~154 px + its prior engagement distance (~110 px) ≈ **264 px** out. Player drift budget during the return wind-up (0.85 s at up to `MOVE_SPEED`) is large — so the return is a **dash-lunge**: 0.85 s wind-up in place (Lock samples the player at 0.55 s as usual), then a 0.30 s dash covering up to **300 px** (~1000 px/s, inside the `INTERP_SNAP_ENEMY = 260`/tick envelope at 50 px/tick) ending in the strike. If the player has left the 300 px envelope, the return whiffs into full recover — running away *is* an answer, just not a profitable one.

### Escalation grammar — it must read as intentional

A player who parries and then sees the enemy come back harder must instantly know this was the *enemy's plan*, not a glitch or rubber-banding. Three channels, all firing on the knockback tick:

- **Visual:** the enemy **skid-lands** the knockback (leans into it, one foot dragging a dust wake — a paper-cutout skid pose, not a ragdoll shove), and its weapon edge shifts **white → gold** for the entire return wind-up. Gold = "escalated but still parryable" (it already marks finishers in §2, one vocabulary). The return uses a **double glint**: crests at −0.45 s and −0.28 s (each 60 ms). Two flashes = second wind. Ordinary knockback (non-bait steps) keeps the current stumble — only baits skid.
- **Audio:** parry connect plays its normal clang, then immediately a low string/bass swell rises through the return wind-up, capped by a blade-scrape "shing" at the double glint. The swell starting *at the moment of your success* is the tell that your success was priced in.
- **Rhythm:** the return wind-up (0.85 s) is the **longest white beat in that combo** — escalation buys the player MORE read time, not less. Stronger = slower = fairer. Non-negotiable.

### The honest counterplay (both answers must be real)

1. **Parry again.** The return is white. Parrying it knocks the enemy back *another* 154 px and — because bait + return = 2 parries, on top of any earlier combo steps — the chain is at or past `PARRY_CHAIN_RIPOSTE_AT = 3`, triggering the +96 px shove and **1.0 s stagger** (`GameRoom.ts:5761-5780`). Design rule: after a parried return, the combo may NOT bait again — it enters an authored **1.50 s recover** (vs the standard ~1.1 s), the largest punish window in the tough language. Parrying the whole sentence is the mastery payout.
2. **Reposition.** The return's dash lane commits at its Lock; sidestep > 90° off the lane and it whiffs into the same 1.50 s recover. Cheaper to execute, smaller reward (no chain heal/riposte, no stagger).

One return per combo, hard cap (depth 6+ Warden variant: two-stage return, see §5). If the baited step is *not* parried, it simply lands as a normal hit and the combo continues its normal script — the bait branch only exists on the parry event, so no player ever sees an unexplained speed-up.

### The authored baits

**K3 · Gale Cross (katana).**
1. Bait cut — **0.45 s** / 66 px / 0.9× (white; deliberately the most parryable-looking step in the game: square-on, big glint)
2a. *If parried:* skid → gold **return dash-cut** — **0.85 s** wind-up + 0.30 s dash / 1.5× / knockback 1.5× → recover 1.50 s
2b. *If it lands:* ordinary backhand — 0.35 s / 66 px / 1.0× → recover 1.10 s
The asymmetry is the message: the scary branch is the one YOUR button created — and it hands you the bigger prize.

**H3 · Gravedigger (heavy).**
1. Overhead bait — **0.60 s** / 70 px / 1.1× (white, gold glint — smells like a finisher, is actually an opener)
2a. *If parried:* the knockback slides the heavy back on its heels → it **hurls its weight forward**: gold return **shoulder-charge + slam**, 0.95 s wind-up + 0.30 s dash / 1.6× / big knockback; the charge track paints a cracked-earth lane through Load → recover 1.60 s
2b. *If it lands:* rising cut — 0.50 s / 60 px / 1.0× → recover 1.25 s

**T2 · Switchback (thrust).**
1. Deep lunge bait — **0.50 s** / 90 px / 1.0× (white)
2a. *If parried:* knocked onto its back foot → gold **rail-dash impale**: 0.80 s wind-up + 0.30 s dash along a thin painted rail / 1.45× → recover 1.40 s. The thin lane makes the reposition answer trivially readable for the family whose identity is lines.
2b. *If it lands:* disengage hop-back 80 px (no damage) → combo ends. Thrust baits are hit-and-run.

---

## 4. Juggle Combos — fall-compensation as choreography

### The physics we're composing against

Player verticality is a real height axis: `stepVertical(height, vh, dt)` under `GRAVITY = 1350` (`movement.ts:193-201`). The launcher writes the player's `vh` the same way the parry-launch already does (`pc.vh` kick, `GameRoom.ts:5749`). Key numbers:

| Kick (vh, px/s) | Apex height | Time to apex | Full airtime (to h=0) |
|---:|---:|---:|---:|
| 303 (player jump) | 34 px | 0.22 s | 0.45 s |
| 360 | 48 px | 0.27 s | 0.53 s |
| **480 (launcher)** | **85 px** | **0.36 s** | **0.71 s** |
| 640 (cap) | 152 px | 0.47 s | 0.95 s |

Melee arc tests are 2D ground-plane (`inMeleeArc`), so an airborne player is still strikeable — the height axis is presentation + pit logic. That's exactly what a top-down juggle needs: the *fiction* is aerial, the *fairness* stays in the readable ground wedge.

### The juggle sentence

**Launcher** (white, parryable — the whole juggle is refusable at the door): a rising cut that, on a clean hit, deals its damage **and sets the player's `vh` to +480** (set, not add — deterministic apex) plus a modest 120 px/s horizontal impulse along the strike (decays under `IMPULSE_FRICTION`, so drift is front-loaded and predictable).

**Air-keeps**: the enemy *repositions under the falling player* and strikes at the moment the player has fallen back into "reach". Air-keep strikes deal reduced damage and **reset `vh` to +360** (not additive — respects the 640 cap philosophy and keeps every re-loft identical).

Fall-compensation math (conceptual, all on the 50 ms grid):

- After the 480 launch, the player falls back through **h = 27 px at t ≈ 0.65 s** (`h(t) = 480t − 675t²`). Air-keep 1 is authored to **impact at +0.65 s** after the launcher: wind-up 0.40 s beginning at +0.25 s, Lock at +0.51 s, glint at +0.37 s before... i.e. crest at +0.37 s? No — glint leads impact by 0.28 s → crest at **+0.37 s**. The enemy spends the first 0.25 s dash-stepping to the player's *ground shadow* (its chase step at 1.6× speed, capped 90 px — "repositioning under the falling player").
- The 360 reset from h≈27 px returns the player to h = 27 px at **+0.60 s** — so air-keep 2 impacts **0.60 s after air-keep 1**, same wind-up shape. The cadence the player hears is *launch … one-count … keep … keep*: 0.65 s, then 0.60 s — near-isochronous, learnable, and every beat carries its own white wedge + glint.
- **Max juggle length: launcher + 2 air-keeps** (≈ 1.9 s airborne, 3 total hits). Hard cap regardless of success. Depth < 5 runs launcher + 1 keep (see §5).

**The landing punish**: after the final keep, the enemy holds a spent follow-through for a **1.60 s recover** — kneeling, weapon buried or arms dropped. That is the longest vulnerability in the tough roster. A juggle that connects fully must hand back the biggest counter-window, or it's a slot machine instead of a duel.

### Escape and DI (the juggle must be leavable at every beat)

1. **Air-parry** — the parry has no grounded requirement, and every air-keep is white. Parrying a keep fires the full existing stack: the *juggler* is knocked back 154 px (its under-you positioning is destroyed → juggle ends by geometry, no special-case code needed), and the *player* gets `PARRY_LAUNCH` (vh +420 toward cap 640) + `PARRY_PUSH 130` away — you convert their juggle into your ride, ascending out of the string exactly like the §8 flurry-riding fantasy. This is the signature interaction of the whole panel: **the enemy's juggle grammar and the player's parry-launch grammar are the same physics, fighting over who owns your `vh`.**
2. **Directional influence** — the height axis never suspends WASD; a "juggled" player keeps full ground-plane control. Each air-keep's wedge commits at Lock (0.26 s into its 0.40 s wind-up), so ~0.39 s of full-speed movement (~100+ px) is available between keeps — holding a direction *walks you out of the next wedge*. DI is not a bonus mechanic; it falls out of the existing Lock honesty. The keep's pre-Lock tracking (the 0.25 s reposition dash) is what makes lazy drift insufficient while committed strafing escapes.
3. **The launcher itself** is a single ordinary white step — parry it, jump it, or don't be in the wedge.

### The authored juggles

**K4 · Sky Hook (katana; the flagship).**
1. Rising crescent launcher — **0.60 s** / 70 px / 1.0× (white; vh → 480; blade visibly sweeps ground-to-sky, dust kicked UP not out — the vertical read)
2. Air-keep "first heaven" — impact +0.65 s / 0.7× (white; vh → 360; enemy pirouettes under the shadow)
3. Air-keep "second heaven" — impact +0.60 s / 0.7× (white; no re-loft — the finisher lets you fall)
4. Recover **1.60 s**, kneeling iai sheath.

**D2 · Scissor Lift (dual).**
1. Both-blade scissor launcher — **0.55 s** / 60 px / 0.9× (white; vh → 480)
2. Single air-keep — impact +0.65 s / 0.75× (white; NO re-loft) → recover **1.30 s**. The short-form juggle: teaches the vocabulary at lower stakes, appears earlier in the depth curve.

**H4 · Coffin Lid (heavy; depth 6+ only).**
1. Under-scoop launcher — **0.70 s** / 60 px / 1.1× (white; vh → 480)
2. Air-keep golf-swing — impact +0.65 s / 0.9× (white; vh → 360 **plus** 200 px/s horizontal — the heavy bats you TOWARD its ally or a wall; the only juggle that moves you somewhere on purpose)
3. Recover **1.60 s**. Co-op nightmare fuel, honestly priced.

---

## 5. Roster, depth tiering, co-op

### Which toughs speak which dialect

The `tough` flag is rolled on spawn (`toughChance`, ramping with time, players, and depth). The combo language binds to **tough duelist-machine archetypes** (duelist, leaper) and the dimension shifters; tough contact trash (rusher/zoner) keeps its derived single lunge — the language stays special.

| Kind | Weapon family | Opens with Negotiated Leap? | Combo deck |
|---|---|---|---|
| **tough ronin** (duelist) | Katana | No (walks in — the grounded duelist) | K1 Sanren, K2 Drawn Moon; +K3 Gale Cross at depth 3 |
| **tough vault-ronin** (leaper) | Katana | **Yes — always** (its red assault-leap is replaced by the white negotiated leap when tough) | K1 Sanren; +K4 Sky Hook at depth 5 |
| **Shifter tier 1 · Marshal** | Sabre (katana grammar) | Yes | K1 only — the tutorial for the whole language |
| **Shifter tier 2 · Ronin** | Katana | Yes | K1, K2, K3 |
| **Shifter tier 3 · Warden** | Heavy | Yes | H1, H2, H3; +H4 at depth 6 |
| **tough dimension duelists** (generated kinds wielding pool blades) | By wielded weapon: `twin-bowie-fangs` → Dual (D1; +D2 at depth 4); `x-sword-railspike` → Thrust (T1; +T2 at depth 3); heavies → Heavy (H1; +H2 depth 2, +H3 depth 4) | Leapers yes, duelists no | As listed |

Deck selection per combo: weighted random with a **no-repeat rule** (never the same combo twice in a row) and the bait/juggle entries capped at ≤ 40% of picks — the plain rhythms must stay the statistical spine or familiarity dies.

### Depth tiering (the §6 chain)

Damage and HP already scale (`depthDamageScale`, `depthHpScale`, `DEPTH_TOUGH_PER` elite density). The combo language scales by **vocabulary, not speed** — wind-ups never tighten below the authored values (the telegraph panel's "escalation changes the verb, not the clock" law):

- **Depth 1–2 · Nouns.** Core rhythms only (K1/H1/T1/D1). Combos truncate to their first 2 steps. No baits, no juggles. Negotiated Leap active from the first tough — the frame is the first thing learned.
- **Depth 3–4 · Sentences.** Full-length core combos; K2/H2 delayed rhythms; baits unlock (K3/T2, then H3). Scissor Lift (D2) at depth 4 introduces the juggle verb in its 1-keep form.
- **Depth 5–6 · Poetry.** Sky Hook (K4) at 5; Coffin Lid (H4) at 6. Bait returns gain their gold double-glint second stage everywhere.
- **Depth 7+ · The Warden dialect.** Two-stage bait returns (parry the return → ONE more gold re-return at 1.0 s wind-up, then the 1.50 s forced recover — chain math means this always meets a riposte-ready player), and juggle keeps at full 2-keep length on all juggle-capable kinds. Still zero wind-up compression.

### Co-op behavior (juggling one player while the other answers)

- **Duel token:** at most **one** tough may run the combo language against a given player at a time; a second combo-capable tough targeting the same player holds at a 260 px "ring-out" orbit (visibly circling — the Nioh crowd courtesy) until the token frees. Max **two** simultaneous active combos per squad regardless of size. Trash keeps swarming independently — the toughs are the melody over that noise.
- **Juggle interrupts:** a juggle is a commitment. During launcher-through-final-keep, the juggler takes a stagger check: **accumulating ≥ 8% of its max HP** from any OTHER player breaks the string (0.8 s stagger, player falls normally, keeps `vh`). Parry-riposte stagger (1.0 s) from the victim also breaks it, per §4. The juggler is also fully body-committed — it never retargets mid-string, so the free player attacks it with impunity from behind. Juggling player A is therefore a *bet* that player B is out of position: correct co-op play converts every juggle attempt into a two-player punish.
- **Bait returns in co-op:** the return dash-lane can cross the ally — it damages only its parried target's lane occupant check (first body in the lane). An ally standing IN the gold lane can eat the return for the parrier (tank trade), or parry it themselves (the parry check is per-player-in-arc already, `GameRoom.ts:5696-5704`) — emergent bodyguard play at zero extra code.
- **Familiarity in duos:** the Negotiated Leap frame is per-target (front of the *chosen* player). The white landing ring tells the ally instantly who was challenged and from where — the ring is co-op communication as much as personal telegraph.

### Tuning appendix (one table to argue about)

| Constant (proposed) | Value | Anchor |
|---|---:|---|
| Leap offer wind-up / air / settle | 0.30 / 0.35 / 0.25 s | 6/7/5 ticks; total 0.90 s runway |
| Canonical distance | 0.80 × opener range | 110–120 px by family |
| Leap cooldown / max range | 4.0 s / 560 px | vs existing 3.4 s / 540 |
| Fastest inter-impact gap | 0.25 s | = parry buffer 0.2 + chain CD 0.12 overlap floor |
| Bait return wind-up + dash | 0.80–0.95 s + 0.30 s | dash ≤ 300 px, ≤ 50 px/tick (interp-snap safe) |
| Post-parried-return recover | 1.50–1.60 s | biggest punish in the tier |
| Launcher / keep vh | set 480 / set 360 | apex 85 / 48 px; airtime 0.71 / 0.53 s |
| Keep cadence | +0.65 s, +0.60 s | h ≈ 27 px at strike; near-isochronous |
| Max juggle | launcher + 2 keeps | +1 keep only below depth 5–6 |
| Juggle ally-interrupt threshold | 8% max HP | during string only |
| Duel tokens | 1 per player / 2 per squad | trash unaffected |

The through-line: every advanced trick in this language spends MORE telegraph time than the move it escalates from, every escalation is announced in one consistent gold/double-glint/bass-swell grammar, and both the parry and the walk-away remain complete answers to everything white. Familiar frame, honest clock, priced-in counterplay — that's the whole design.
