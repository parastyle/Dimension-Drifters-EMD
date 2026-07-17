# Tough Enemy Melee Combos — Devil's Advocate Brief

Role: attack every failure mode of the directive before a line of it ships. The directive is good fantasy
— leap-to-front openers, parry-aware pressure steps, air juggles — and every one of its three pillars has
a way to become the worst thing in the game if we hand-wave the laws. This document is the list of ways it
goes wrong, argued from the code as it exists today, ending with measurable guardrails and a
non-negotiable checklist.

Code ground truth used throughout (verified, not assumed):

- Tough flag: `EnemyState.tough` (`packages/shared/src/state.ts:165`), `TOUGH_HP_MULT = 4`,
  `TOUGH_DAMAGE_MULT = 1.7` (`packages/shared/src/constants.ts:445-446`), chance scales with players and
  depth (`packages/shared/src/enemies.ts:683`).
- The combo machine: `stepDuelists` phases `idle → (leapwind → leap) → windup → … → recover`
  (`packages/server/src/rooms/GameRoom.ts:5489-5635`), strike geometry captured at
  `MELEE_LOCK_PHASE = 0.65` (`GameRoom.ts:278`, `GameRoom.ts:5583`) and never re-acquired — this is the
  telegraph panel's Lock law made executable.
- A leap already ships: vault-ronin `leap: { range: 540, windup: 0.5, airTime: 0.28, cooldown: 3.4 }`
  (`packages/shared/src/enemies.ts:448`), landing coordinates `lx/ly` frozen at leap-wind START
  (`GameRoom.ts:5537-5538`), red circle marker, then a constant-speed ground slide to the spot
  (`GameRoom.ts:5557-5568`). No arc, no height — a slide.
- Parry: i-frames 0.52 s, buffer 0.2 s, chain CD 0.12 s, riposte-stagger at chain 3
  (`constants.ts:608-636`). `resolveParry` knocks the attacker back `PARRY_KNOCKBACK × 1.6 ≈ 154 px` as an
  **instant position write in one tick** — not an impulse (`GameRoom.ts:5736-5745`) — scaled further by
  Iron Stance stacks, then launches the *player* upward (`PARRY_LAUNCH = 420`, cap 640).
- Player air state: real height axis, `GRAVITY = 1350`, `JUMP_VELOCITY = 303` (hop ≈ 34 px, ≈ 0.45 s),
  pure `stepVertical` (`packages/shared/src/movement.ts:193-201`), full horizontal control while airborne
  (nothing gates `stepSteeredMovement` on height), airborne clears quakes and pits
  (`GameRoom.ts:2364`, `GameRoom.ts:4584`).
- Precedent for scripted multi-step actions: Serraketh's `actionKind/actionSeq/actionStartTick/
  actionResolveTick` on `WormBossState` (`packages/shared/src/state.ts:368-372`) — synced ticks, client
  renders deterministically.
- Sim scale: 20 Hz (`TICK_RATE = 20`), `MAX_ENEMIES = 80`, telegraphs are a synced `MapSchema` with no
  hard row cap today (`GameRoom.ts:4400-4424`).

---

## 1. The negotiated leap will read as a TELEPORT unless we buy it an arc

The directive says "LEAP to a negotiated X,Y matching up with the player's front." The existing leap is
the cautionary tale, not the template. Do the arithmetic: 540 px range over 0.28 s of air time is
1,929 px/s — **96 px per server tick**, five to six snapshots total. The client interpolates enemies
between 20 Hz snapshots with a delay buffer; a 96 px/tick mover is already a blur-slide, and one dropped
snapshot doubles it to 192 px — above the hard-snap heuristic band the codebase itself documents
(`constants.ts:92-96` calls out ~154 px/tick as the teleport-vs-motion boundary for parry knockback).
Result on a 100 ms connection: the tough winks out near its origin and materializes in your face with the
combo already winding. That is a teleport with extra steps, and players will call it one.

Failure modes stacked inside this one feature:

1. **Arc time floor.** If leap duration is authored per-enemy as a constant (`airTime: 0.28`) while range
   varies up to 540 px, short leaps look floaty and long leaps look instant. Air time must be a function
   of distance with a floor — never faster than a perceivable arc.
2. **No vertical fiction.** The server slides the enemy on the ground plane. Without a client-rendered
   height arc keyed to authoritative start/land ticks (the Serraketh action-tick pattern), the "leap" is
   indistinguishable from a dash, and a dash through the horde reads as clipping through bodies.
3. **Stale negotiation.** Today `lx/ly` freeze at leap-wind START — 0.5 s windup + 0.28 s air = **0.78 s
   of player movement** (up to ~230 px at `MOVE_SPEED`) between the promise and the landing. "Matching up
   with the player's front" negotiated that early is matching up with where the player's front *was*.
   Conversely, if we re-aim at launch or mid-air, we violate the no-retargeting law and the landing marker
   lies. There is no third option: **negotiate late (at leap launch, marker appears at launch), or accept
   whiffs (marker appears early, player escapes).** Pick one per enemy kind; never blend.
4. **"The player's front" is a lie at 20 Hz + RTT.** `aimDir` is mouse-driven and changes every input
   command; the server's view of it is RTT/2 stale, and the player can spin 180° during any windup. A leap
   negotiated to "front" lands at the player's *back* whenever they turn — which players will read as the
   enemy cheating behind them. The negotiation anchor must be something slow: movement heading, or the
   player-to-enemy bearing at negotiation time. Never live `aimDir`.
5. **Cancel rules.** If the player moves more than R px from the negotiated spot during windup, does the
   tough leap anyway? Landing on empty ground must be an authored WHIFF with a fat punish window
   (recovery ≥ the current `recover: 0.85 s`), not an auto-correct. An auto-correcting leap is retargeting
   by another name. A cancel (abort the leap, return to idle) is acceptable only during windup — never
   after launch — and must refund nothing: the cooldown is spent.

**The hidden cost nobody has priced:** the landing spot must ALSO obey the no-false-safe-pocket rule from
the telegraph contract. The current marker is a circle of radius `m.range` at the frozen spot; if the
combo that follows uses committed lunge steps (`step: 66-72 px` per swing), the true threatened region
over the full combo is larger than the landing circle. Advertising the landing while hiding the combo
footprint is a false safe pocket at one remove.

## 2. Combo lock-in vs the Lock law: pick the law now, both answers cost fairness

The telegraph panel's law is absolute: geometry COMMITS at Lock, no retargeting. A 3-step combo forces the
question the panel never had to answer: **is Lock per-step or per-combo?**

- **Law A — re-negotiate every step (today's behavior).** Each windup samples the target fresh at 65%
  phase (`planDuelistStrike` per swing). Fair per-hit, but it makes the combo a *homing* sequence: three
  independent trackers with 0.3-0.34 s gaps means walking away never works; only parry/jump answers it.
  The directive's "familiar, so you are prepared" is weakened — the combo's shape depends on where you ran,
  so no two performances look alike. And each re-negotiation is another chance for the stale-aim problem
  in §1.
- **Law B — commit all steps at leap-land.** The whole 3-step choreography (relative offsets, aims,
  timings) freezes when the tough lands. Maximally familiar, maximally readable — and maximally whiffable:
  a player who dodge-rolls once invalidates steps 2-3, so 60% of the authored content resolves against
  air. Toughs become pinatas that perform kata at nothing. It also interacts terribly with the parry
  knockback: a fully-committed step 3 aimed at the pre-parry geometry after step 2 shoved the tough 154 px
  away is geometrically absurd.
- **The only defensible hybrid:** commit the *choreography* (step identities, timings, relative pattern) at
  leap-land — that is what makes it learnable — but let each step's *aim* re-sample at its own Lock beat
  (65% of that step's windup), exactly as today. Displacement steps (the comeback lunge, the re-close) get
  their travel targets sampled at their own Lock, capped by a max-travel constant. Write this down as law
  and test it; anything vaguer will drift per-enemy until "no retargeting" means nothing.

Whatever is picked: the parry-riposte interrupt (`resolveParry` forcing `phase = "recover", t = 1` at
chain 3, `GameRoom.ts:5761-5769`) must remain able to cancel any committed step. A "committed" combo that
cannot be interrupted by the game's own mastery mechanic is a cutscene.

## 3. Parry-compensation steps: one branch away from "random damage inflation"

The idea — a step authored knowing it will be parried, eating the knockback, coming back in stronger — is
the most fragile pillar, because it is invisible unless the grammar carries it.

- **It is a branch, and branches read as dice.** The tough must behave differently when step 2 is parried
  (knocked back 154 px, comeback lunge) versus when it lands (normal step 3 from point-blank). A player who
  cannot see *why* the enemy sometimes does a fourth, harder attack experiences it as random damage
  inflation — precisely the "arbitrary red rectangle" class of complaint the telegraph panel was convened
  to kill. The escalation must be legible **before** it happens: the parry-baiting step wears a distinct
  tell (authored pose difference plus an escalated glint — e.g. a double glint at Lock) that trained
  players read as "this one bites back." Same tell, same consequence, every time, per enemy kind.
- **The comeback is a full attack, not a continuation.** It must run the complete Claim→Load→Lock→Release
  cadence with a windup no shorter than the enemy's authored `swingGap` floor (≥ 0.3 s ≈ 6 ticks). A
  shortened "surprise" comeback is unparryable in practice: parry chain CD is 0.12 s, but human
  re-recognition is not, and the whole point of the design is that the player parries it *again*.
- **The knockback distance is not a constant — stop authoring as if it is.** Iron Stance multiplies
  knockback per stack (`GameRoom.ts:5735`), the riposte adds a second shove, and arena clamping truncates
  it at walls. A comeback lunge authored as "travel 154 px back in" over-shoots or under-shoots constantly.
  The comeback must be computed from actual displacement at comeback-Lock time, with a hard travel cap.
- **Pits delete the design.** A parry can knock an enemy into a pit for an instant kill — the code
  celebrates this (`GameRoom.ts:2701`). Every parry-compensated tough near a pit dies on step 2, forever,
  and players will farm it. Either accept the cheese as mastery (my recommendation — do not break a
  beloved interaction to protect authored content) or keep parry-bait combos out of pit dimensions. Do NOT
  make combo-toughs pit-immune; that is physics dishonesty to protect a script.
- **The riposte-stagger self-defeat is a feature — but budget for it.** Parrying three steps in the chain
  window triggers the stagger that cancels the comeback. Against a good player the "come back in stronger"
  finisher will literally never execute. That is correct (mastery ends the combo) — but it means the most
  expensive authored beat is the least seen. Author accordingly: the comeback should be a remix of
  existing step assets, not bespoke content.

## 4. Physics honesty: no rubber-banding — and the parry knockback is ALREADY a rubber band

Hard truth from the code: `resolveParry` teleports the attacker ~154 px in a single position write
(`GameRoom.ts:5736-5745`). For a swarm grunt at 20 Hz nobody notices. For a tough that is the sole focus
of the player's attention, whose next move is *coming back from* that displacement, the sequence
"snap-away → snap-back-in" is elastic-band nonsense, and it will be blamed on the new combo system even
though the snap predates it.

- The knocked-back tough must spend a **visible recovery at the displaced position** — minimum 0.4 s
  (8 ticks) of authored stagger pose — before its comeback windup may begin. The stagger is not dead time;
  it is the proof the parry had mass.
- The comeback travel must be **bounded-velocity motion** (lunge or leap under the §1 arc rules, capped at
  the same px/tick ceiling as the leap), never a position write. If the tough re-closes faster than any
  player-visible thing in the game moves, it is teleporting, whatever we call it.
- Convert tough parry knockback itself from a 1-tick position write to a 2-3 tick impulse while you are in
  there — the client interpolation stops having to hard-snap, and the comeback reads as recovery from real
  force. (Grunts can keep the cheap write.)
- Note the existing swing-commit snap: at resolve the enemy is position-written to the Lock-committed
  lunge spot, up to 72 px (`GameRoom.ts:5601-5603`). Small enough to hide today; a combo system that chains
  three of these plus a knockback plus a comeback is five snaps in four seconds on one actor. The per-tick
  displacement budget in the guardrails below exists to cap the *sum*, not each event.

## 5. Juggles: the single highest frustration risk in the directive

"Launch the player, then KEEP ATTACKING to keep them in the air" is, verbatim, the design of chain-stun —
the mechanic every action game eventually patches out of its enemies. Loss of control is the cardinal sin
of co-op survival games: the player's screen keeps happening while their inputs don't matter.

What the code says about air: players keep FULL horizontal control while airborne (nothing gates movement
on height), and the parry is usable in air — in fact parry-launch stacking (`PARRY_LAUNCH = 420`, cap 640,
`GameRoom.ts:5749`) means a juggled player who parries the juggle hits *rides them upward*. That is a
genuinely great escape valve and must be the centerpiece: **the counter to the juggle is the parry, and a
mid-juggle parry changes the player's `vh`, which desynchronizes the enemy's pre-timed follow-ups so they
whiff.** The enemy must NOT re-time to compensate — that would be retargeting the clock. Parry defeats the
juggle by breaking its math. Ship that or ship nothing.

Everything else needs caps:

- **Max juggle hits: 2 air hits per combo, then the finisher must be groundable/dodgeable.** With
  `vh` capped like `PARRY_LAUNCH_MAX` (640 px/s against gravity 1350), each kick buys ≤ 0.95 s of air; two
  kicks ≈ 1.6-1.9 s of reduced agency. That is the ceiling of tolerable.
- **Max cumulative loss-of-control: 2.0 s** from launch to guaranteed landing, enforced server-side (if
  the cap is hit, follow-ups whiff regardless of geometry).
- **DI is sacred:** never reduce airborne horizontal control to "make the juggle connect." If the juggle
  only works against a player holding still, that is correct difficulty.
- **Landing mercy: ≥ 0.3 s of contact/melee invulnerability on touchdown** from an enemy-initiated launch
  (not from the player's own jump), so a juggle cannot chain into the horde's contact damage the instant
  gravity wins.
- **One juggler per victim — attack tokens.** Two toughs juggling one player alternately is infinite
  stun-lock; in co-op it WILL happen by accident. A per-player "aerial pressure token" (one tough may hold
  it; others must attack grounded targets or wait) is non-optional.
- **Co-op rescue window:** a juggled player's teammates must be able to end it — parry-knockback on the
  juggler, or damage-stagger. If the juggler is immune to interruption during its air-string, downed-ally
  spirals follow.
- **Damage cap:** at `TOUGH_DAMAGE_MULT = 1.7` × depth scaling, a 3-hit juggle at ronin-class damage
  (13/hit) exceeds 66 pre-depth — most of a fresh player's HP with zero counterplay after the launch
  connects. Total combo damage from launch to landing must be capped at ≤ 40% of the victim's max HP; the
  launcher hit itself should be cheap (the launch IS its payload).

Also: airborne currently dodges quakes and pits, but nothing in `duelistSwing` checks player height — the
launch state is cosmetically airborne to ground melee. If juggle follow-ups are "air attacks," define
which attacks can touch an airborne player at all, or the first patch after ship is "why did a ground
sweep hit me at jump apex."

## 6. Stat-check imbalance and the low-level player

Tough chance scales with player count and depth; tough damage is a flat ×1.7 on top of depth scaling. A
combo system multiplies EXPOSURE (three-plus hits per engagement instead of one) without touching the
multipliers, so the effective tough threat curve steepens exactly where fresh and low-level players live.
The parry answers everything on paper (0.52 s i-frames is generous) — but "the parry answers it" is a
stat-check on the *player's knowledge*, not their build, and a level-1 player facing a leap-opener into a
parry-bait comeback into a juggle finisher is being examined on three lessons in four seconds.

- Gate the vocabulary by depth: leap-openers exist from early depths (they are the *readable* part);
  parry-bait steps unlock at mid depth; juggle strings at late depth. One new lesson at a time.
- Never stack all three pillars on one enemy kind's default combo. Leap+juggle or leap+parry-bait; the
  triple is a boss's privilege.
- The dodge must always be a complete answer for a player who never parries: every step's committed
  geometry must be escapable at `MOVE_SPEED` from the moment its telegraph appears. If a step is authored
  to be un-walkable (pursuit steps), the *combo as a whole* still needs a walk-out beat.

## 7. Co-op target ambiguity: whose front?

`nearestPoint` picks the target per tick. In a 4-player scrum "nearest" flickers between bodies; a leap
negotiated against player A's front that lands as player B walks through the spot hits B, who never saw a
tell aimed at them (the marker is on the ground, but the *reading* — "it leaps to YOUR front" — was A's).

- Target selection must COMMIT at negotiation, same law as geometry. The combo belongs to one victim; the
  landing marker plus a victim-side cue (the existing white cadence ring on the target) says whose fight it
  is. Splash on bystanders keeps the hitbox honest, but the choreography aims at one player, period.
- Two toughs negotiating fronts of the *same* player simultaneously produce a committed crossfire where
  the dodge from one lands in the other's frozen sector — unreactable by construction. The front-slot is a
  token: one tough may claim a given player's front at a time; the second takes a flank bearing or queues.
- "Front" for negotiation purposes must be the same slow anchor from §1 (movement heading or approach
  bearing), identically for all toughs, or two enemies will visibly disagree about where your front is.

## 8. Wire and CPU budget: N toughs running combo state machines

CPU is a non-issue at this scale: `stepDuelists` already iterates all 80 enemies per tick and
`duelistSwing` scans all players; a richer per-tough state machine adds constant work on the handful of
toughs alive. The honest costs are elsewhere:

- **Wire — resist decorating `EnemyState`.** The Serraketh precedent (actionKind u8 + actionSeq u16 +
  start/resolve/end ticks u32) is 5 fields on ONE singleton. Copying it onto `EnemyState` for 80 entities
  is schema bloat on the hottest sync path, delta-churned every 6-10 ticks per active tough. The client
  already gets `windup` (0→1), `atkSeq`, and telegraph rows — that trio carries today's combos fully.
  Budget: at most ONE new synced field on `EnemyState` (a packed u8 action descriptor: kind ≪ 2 | step) —
  everything else (landing spot, air arc timing) rides the existing telegraph row schema or a small
  separate MapSchema keyed only by combo-active tough ids.
- **Telegraph row exhaustion.** Rows are an unbounded synced MapSchema; every combo tough can hold a
  landing marker plus a melee wedge concurrently, on top of boss rows. Ten toughs mid-combo is 20 rows of
  churn plus the client draw cost. Cap concurrent combo performances (state machines allowed past `idle`)
  at 4; excess toughs stalk instead. This is also a READABILITY cap — four simultaneous choreographies is
  already past what a player can parse.
- **The juggle timing math must stay pure.** `stepVertical` is deterministic; the server can precompute a
  victim's landing tick at launch. Keep it that way — no per-tick "is the player still airborne, adjust my
  swing" polling, which is both CPU noise and retargeting.

---

## Hard measurable guardrails

| # | Guardrail | Number | Enforced where |
|---|---|---|---|
| G1 | Leap air-time floor | `airTime ≥ max(0.35 s, distance / 1200 px/s)`; never resolves in < 7 ticks | server leap plan |
| G2 | Leap per-tick displacement | ≤ 90 px/tick sustained; total motion path continuous (no position writes > 100 px in one tick from any combo source, knockback included) | server + replay test |
| G3 | Landing marker lead time | full authoritative landing circle visible ≥ 0.4 s before touchdown; marker never moves after it appears | telegraph row |
| G4 | Landing whiff rule | player > marker radius at touchdown ⇒ authored whiff, recovery ≥ 0.85 s, no auto-correct | server |
| G5 | Combo law | choreography (steps, timings) commits at combo start; per-step aim commits at that step's Lock (65% of its windup); no aim change after Lock, ever | shared law + test |
| G6 | Step windup floor | every damaging step, including comebacks and air follow-ups: windup ≥ 0.3 s (6 ticks) with full Claim→Lock cadence | authored data lint |
| G7 | Parry-bait tell | escalating step wears a distinct authored tell (pose + double glint) — identical every performance per enemy kind | client + ship gate |
| G8 | Comeback recovery | knocked-back tough holds stagger pose ≥ 0.4 s at displaced position before comeback windup; comeback travel computed from actual displacement, velocity-bounded per G2 | server |
| G9 | Juggle caps | ≤ 2 air hits per combo; ≤ 2.0 s launch-to-landing loss of control; combo total ≤ 40% victim max HP; victim `vh` cap = `PARRY_LAUNCH_MAX` | server |
| G10 | Landing mercy | ≥ 0.3 s melee/contact invuln on touchdown from enemy-initiated launch | server |
| G11 | Air agency | airborne horizontal control never reduced; parry usable in air; mid-juggle parry alters `vh` and enemy does NOT re-time (follow-ups whiff) | shared movement law |
| G12 | Tokens | 1 aerial-pressure token per victim; 1 front-claim token per victim; ≤ 4 concurrent combo performances arena-wide | server scheduler |
| G13 | Wire budget | ≤ 1 new synced field on `EnemyState`; landing/arc data rides telegraph rows or a combo-only MapSchema; measure snapshot bytes/tick with 4 toughs mid-combo ≤ +10% over current | schema review |
| G14 | Interrupt supremacy | parry-chain riposte stagger cancels ANY committed step including comebacks and juggle finishers | server (already true — keep it) |
| G15 | Depth gating | leap combos from early depth; parry-bait mid; juggles late; never all three pillars on one non-boss kind | authored data lint |

## Non-negotiable checklist (ship gates)

- [ ] **Teleport test:** 150 ms simulated RTT + 5% loss, record a full leap-combo: no rendered frame shows
      the tough displacing more than the interpolation snap threshold; the leap reads as an arc, not a slide.
- [ ] **Marker truth test:** effects hidden, the landing circle and every step wedge match server hit
      geometry at the boundary; no step ever damages outside a shown edge; the marker never moves.
- [ ] **Turn-around test:** negotiate a "front" leap, spin the player 180° during windup: landing is where
      the marker said, and the marker was placed from the slow anchor (heading/bearing), not live aimDir.
- [ ] **Whiff test:** walk out of the marker at `MOVE_SPEED` after it appears: escape succeeds, tough lands
      and performs its whiff recovery — no correction, no slide-tracking.
- [ ] **Branch legibility test:** a playtester who has seen the parry-bait combo three times can state,
      before pressing parry, that the enemy will come back after the knockback — 8/10 correct.
- [ ] **Rubber-band test:** frame-step a parried comeback: knockback displacement, ≥ 8 ticks of visible
      stagger at the displaced spot, then bounded-velocity return with a full new telegraph. Zero position
      writes on the return path.
- [ ] **Juggle escape test:** a juggled player who parries the first air follow-up rides upward and the
      remaining string whiffs; a player who never parries lands within 2.0 s, ≤ 40% max HP lost, with
      touchdown mercy applied.
- [ ] **Chain-stun test:** two toughs + one victim for 5 minutes of AI soak: no sequence ever exceeds the
      loss-of-control cap; the token system provably serializes their offense.
- [ ] **Pit test:** parry a parry-bait tough beside a pit: it falls in and dies. (The cheese is legal;
      the combo must not make toughs pit-immune.)
- [ ] **Riposte test:** chain-parry three steps: the stagger interrupts whatever step was committed,
      including a comeback or juggle finisher, exactly as `resolveParry` does today.
- [ ] **Budget test:** 4 concurrent combo toughs + Serraketh + 10-player load: snapshot bytes/tick within
      +10% of current baseline; telegraph row count bounded; no new `EnemyState` field beyond the one
      packed action byte.
- [ ] **Low-level test:** a fresh depth-1 character meets the depth-appropriate combo vocabulary only
      (G15) and can survive it with dodge alone, never having parried.

If any box is unchecked, the feature is a demo, not a system. The directive's fantasy is worth building —
built lawless, it is a teleporting stun-lock machine with a red circle under it.
