# Devil's Advocate — Jump Feel Panel (higher jump + ground pound; crouch distance jump)

Panel: jump feel (satisfying quick jump · optional ground pound · crouch-charged distance jump). Role:
adversarial review. This document modifies no source. Everything below is grounded in the current code:
`packages/shared/src/movement.ts` (`stepVertical`, lines 193–201), `packages/shared/src/constants.ts`
(§5 jump block, lines 372–400), `packages/server/src/rooms/GameRoom.ts` (jump message ~1123, buffered
jump ~2482, pitfall ~2351, `applyBossQuake` ~4586), `packages/client/src/net/prediction.ts` (the whole
file — the binding reconciliation model), `packages/client/src/scenes/ArenaScene.ts` (~3038, SPACE is
`JustDown` → `jumpQueued` rides the next 50ms command), `packages/shared/src/mapgen.ts`
(`MAP_MAX_JUMP_TILES`, `classifyPitRegions`), `packages/shared/src/bosses.ts` (Vastaghar footfall
quakes 858–920, Serraketh RibQuake 990–1017), and `docs/enemycombo-panel/` (the juggle grammar and its
G-series guardrails).

The current numbers everyone else on this panel is building on: quick jump is `vh = 303` under
`GRAVITY = 1350` → **0.449s airtime, 34px peak, 144px reach at full run (1.8 tiles of 80px)**.
Cooldown 0.7s, input buffer 0.25s. Pit fall = 15% max-HP chip + snap-back + 0.6s grace **that is also
0.6s of `invuln`**. Hold that last fact — it comes back to bite us in §8.

---

## 1. Input ambiguity — tap vs hold on one key is a self-inflicted wound

### 1a. The threshold trap

The proposal puts two verbs on Space: tap = quick jump, hold = crouch-charge. Any implementation of
that has to pick a hold threshold T, and every value of T is wrong:

- **T low (100–150ms):** ordinary human keypresses under stress run 60–150ms. A player sprinting at a
  pit who holds Space **60ms too long** gets a crouch — a full-body root — instead of the hop they
  demanded, *directly in front of the hazard the hop was for*. That is the single worst possible
  failure: the safety verb transformed into a death verb by 60ms of finger latency.
- **T high (250ms+):** now the *crouch* is laggy — a quarter second of "did it register?" before any
  visible squat. In a game whose whole netcode brags that "the hop starts the frame you press SPACE —
  no round-trip" (ArenaScene ~6349), the new verb ships with built-in input lag.
- **Any T at all** breaks the current contract: today jump fires on `JustDown` (ArenaScene:3038) and
  rides the *next* 50ms command. If tap-vs-hold must be disambiguated **before** firing, the quick
  jump — the quake dodge, the pit hop, the most latency-sensitive verb in the game — inherits T
  milliseconds of delay on **every single press forever**. You cannot wait to see if a press becomes a
  hold and also fire the jump instantly. Pick one. The panel must not hand-wave this.

**The only honest resolutions:**

1. **Jump always fires on keydown, no exceptions.** Then hold-Space *cannot* start a ground crouch
   from the same press (you're already airborne 50ms later). Crouch therefore needs its **own input**:
   a chord (e.g., hold S/"down"/Ctrl + Space) or a separate key. Yes, a chord is less "elegant." It is
   also the only design where zero quick jumps are ever stolen.
2. If the panel insists on one key: **tap = jump on keyUP under T** is the classic alternative, and it
   is worse — it adds up-to-T latency to every jump. Reject it.

**Law I-1: the quick jump fires on keydown, unconditionally, with today's latency. Any design that
adds ≥1 tick of disambiguation delay to the plain jump is dead on arrival.**

**Law I-2: no press-duration disambiguation on the primary traversal key. Crouch-jump gets a distinct
input (chord or key). If playtests demand single-key, the threshold is ≥300ms, the crouch is cancelable
for its entire wind (see §2), and entering crouch never eats the jump that already fired.**

Also note Space already triple-serves as menu/prompt confirm (ArenaScene ~5166, ~5383). A hold verb on
Space must be inert while any pick-rail/prompt is focused or you'll crouch-launch out of a loot prompt.

### 1b. The pound collides with the mid-air jump buffer — this is a real, existing feature conflict

`JUMP_BUFFER_SECONDS = 0.25` exists specifically so that **a Space press while airborne is queued**
and fires the instant you land (constants:380–384; consume gate GameRoom:2482). This was a deliberate
de-clunk fix — it killed the 0.25s post-landing dead window. The obvious pound input — "press
jump/attack again while airborne" — **is the exact same input the buffer already owns.** Ship pound on
mid-air Space and every player who buffers their next hop (which good players do constantly, because
the game trained them to) gets a slam they didn't ask for, pointed at whatever is under them,
including the pit they were hopping.

**Law I-3: the buffered-jump semantics of mid-air Space are untouchable. The pound is a distinct
mid-air input (the same chord/key as crouch — one "down" modifier for both down-verbs is actually a
clean grammar: down+Space grounded = crouch-charge, down/down+Space airborne = pound).**

**Law I-4 (buffer law): each verb buffers only into itself.** A buffered quick jump never promotes
into a crouch or a pound on consume; a pound pressed during the last 3 ticks of descent buffers as a
pound *for this landing only* and is discarded on touch (never carried to the next jump); crouch does
not buffer at all (a root you queued 250ms ago and forgot is a root the game imposed on you).

---

## 2. The crouch pause is a self-stun in a bullet heaven — argue it down or kill it

### 2a. "About a second" is not a number, it is a death sentence

Run the second against the actual pressure in this codebase:

- **Vastaghar phase 3:** footfall quake every **1.4s** with a 0.7s windup (bosses.ts:912–916). A 1.0s
  crouch fits between quakes only if started within a ~0.4s window after a quake resolves — and while
  crouched you are grounded (`height ≤ GROUND_EPSILON`) and rooted, i.e., **guaranteed flattened** by
  the next footfall. The verb designed to cross the arena cannot be unusable in the fight that defines
  ground pressure.
- **Serraketh late phases:** RibQuake sequences at cadence 30–40 ticks (1.5–2s), *paired* with a
  5-tick gap (bosses.ts:1008–1017). Same math, tighter.
- **The horde:** every melee kind telegraphs a parryable lunge (constants §8/§20, "UNIVERSAL LUNGE");
  spitter projectiles fly at 300px/s. Rooting for 1.0s donates 320px of repositioning (MOVE_SPEED) and
  eats every lunge whose windup started as you squatted.
- **The game's own vocabulary of "long":** the parry chain window, the 0.6s pit grace, the 0.45s
  airtime, the 0.25s buffer. One full second of self-imposed helplessness is longer than *any*
  self-inflicted state in the game. It's longer than the pit fall punishment it exists to avoid.

**The honest number: 0.25–0.35s (5–7 ticks at 20Hz), full stop.** That still *reads* as a
crouch-and-spring (it's 1.5× the turn-hitch beat, half a lunge windup — visible, committal, priced)
without being an invitation to be executed. If 0.3s doesn't feel weighty enough on camera, add weight
with animation (squash, dust, brow-lower) — not with wall-clock helplessness. If someone on this panel
wants a charge *meter* (hold longer → farther), cap the useful hold at 0.35s; anything past that is
tuning theater paid for in player corpses.

### 2b. Cancel rules — it must never feel like the game killed you

Every cancel question has a wrong default. Take them one at a time:

- **Does damage cancel it?** **No.** If chip damage cancels the crouch, the verb is unusable at
  exactly the horde pressure it was built for (any grazing tick refunds you into place, jump wasted or
  not even launched). You crouch, you accept the 0.3s of exposure, you launch. That's the price and
  it's an honest one *at 0.3s* — at 1.0s it would be indefensible, which is another argument for 2a.
- **Do movement keys cancel it?** **They cannot — they are the aim.** The soft-lock direction has to
  come from somewhere, and WASD is the only directional input on the movement hand (aim/mouse belongs
  to weapons and parry). If WASD both steers the lock *and* cancels the crouch, the verb contradicts
  itself. Movement keys steer the intended launch line during crouch; they never cancel.
- **What does cancel it?** **Releasing the input before the minimum charge** (if hold-to-charge:
  release before 0.15s = stand up, nothing spent, cooldown untouched — a "never mind" must be free) —
  and **nothing else**. One cancel path, learnable in one attempt.
- **Knockback during crouch?** Impulses (`stepImpulse`) keep acting on the body — a quake shove or
  lunge hit *displaces* the crouching player but does not cancel the charge. The launch then departs
  from the displaced position along the locked line. Deterministic, predictable, and it means enemy
  pressure bends your jump rather than deleting it. (If the panel instead rules "big hits cancel,"
  then the cancel must refund the cooldown 100% — a canceled charge that also burns the cooldown is
  the game killing you twice.)
- **Is the crouch a full root?** Prefer **a slow crawl (25–30% MOVE_SPEED) over a hard root**. A body
  that still creeps never reads as "stunned," and it gives the player micro-agency to not die to a
  puddle edge. A hard root is acceptable *only* at ≤0.3s duration.

**Law C-1: crouch charge ≤ 0.35s to launch. Law C-2: damage does not cancel; early release cancels
free; nothing else cancels. Law C-3: movement input during crouch steers the lock, never cancels.
Law C-4: if any forced cancel exists, it fully refunds the cooldown.**

---

## 3. Soft-lock betrayal — a direction lock that launches you into the pit

"Direction-soft-locked" hides the two questions that decide whether this verb is trusted or hated:
**when is the direction sampled, and what does the player see before they're committed?**

### 3a. When is direction locked?

- **Sampled at crouch start:** betrayal. The player initiates the crouch while running (WASD held from
  the approach), then adjusts — and the game ignores the adjustment. Worse: at 20Hz over a 50ms
  command cadence, "crouch start" is whichever tick consumed the press; the sampled WASD may be the
  *previous* heading (the turn they were mid-way through). Launching along last tick's heading is the
  canonical "the game aimed for me" complaint.
- **Sampled at launch (release/expiry):** better, but has its own trap — a player charging in place
  has *released* WASD (they stopped to crouch). Zero input at sample time means launching along...
  facing? Aim? Last non-zero heading? Whatever fallback is picked, it must be **drawn on the ground**
  the whole time, or the fallback is a slot machine.
- **The soft part:** "soft lock" implies limited steering. Define it exactly: direction = the WASD
  vector, continuously re-sampled during crouch, **hard-latched at launch tick**; after launch the
  player retains a small steer authority (≤15°/s bend or ±10% lateral drift — pick one, write it in
  the shared stepper) and nothing else. Mid-flight WASD beyond that is ignored, and the tutorialization
  must say so, because every player will try to air-steer at full authority on jump one.

### 3b. What is telegraphed pre-launch?

**A live landing reticle, not an arrow.** During crouch, draw the *computed landing point* (the same
deterministic range the server will integrate — see §4) on the floor at the end of the locked line,
updated every frame as WASD steers. At the latch tick it hardens (color/weight change). Three states,
all mandatory:

1. **Green/solid:** landing cell is ground. Trust it.
2. **Red/broken over a pit:** the current line + range lands *in* the pit. The game shows the truth
   and lets you launch anyway (or re-steer). **Never silently auto-clamp** the jump to "nearest ground
   along the ray" — an invisible undershoot that parks you flat-footed at a pit lip inside a horde is
   a different betrayal, not a fix. If the panel wants assistance, make it visible assistance: the
   reticle *snaps* to the far lip when the honest landing point is within ~24px of clearing, and the
   snap is drawn (the reticle visibly jumps to the lip). Hidden correction is betrayal; shown
   correction is generosity.
3. **No reticle = no launch.** If for any reason the landing can't be previewed (level window, dead,
   stalled connection), the crouch refuses to start.

**Law S-1: direction is re-sampled from WASD every tick of the crouch and latched exactly at the
launch tick — never at crouch start. Law S-2: zero-input at launch aborts the launch (stand up, free
cancel) rather than guessing a heading. Law S-3: the landing point is drawn live from crouch start,
computed by the same shared function the server integrates, and pit landings are shown, not silently
corrected.**

And the flight itself: at plausible numbers (launch ~640px/s horizontal to clear 4 tiles in ~0.5s),
one 20Hz tick is **32px of travel**. The pit check runs on grounded ticks only (GameRoom:2364,
`height > GROUND_EPSILON` → immune), so the landing tick is the whole ballgame: the descent must be
tuned so the first `height ≤ GROUND_EPSILON` tick occurs *at or past* the reticle point, not one tick
(32px) short of it on the pit lip's wrong side. That's a shared-stepper determinism requirement, not a
tuning nicety — write a test that walks every launch speed × every gap width 2–4 tiles and asserts the
landing tile equals the reticle tile.

---

## 4. Prediction and netcode — the crouch state machine is new synced state; say so out loud

The predictor's model (prediction.ts:29–42) is explicit: **horizontal is predicted + reconciled by
replaying pending commands through input-driven steering; vertical is local-first and only adopted on
divergence** (`HEIGHT_ADOPT_PX = 12`, line 98). Both new jumps stress exactly the parts that model
keeps thin:

1. **The distance jump breaks the horizontal replay's core assumption.** Today `stepHorizontal`
   (prediction.ts:133) derives velocity from *this command's* dx/dy every tick. A direction-locked
   ballistic flight is horizontal motion that **ignores current input**. When a patch arrives
   mid-flight, `reconcile()` rebases from synced `{x, y, mvx, mvy, vx, vy}` and replays pending
   commands through input steering — which would steer the flight, diverge from the server's locked
   line every patch, and grind the error offset all flight long. The locked launch velocity **cannot
   ride the impulse channel either** (`stepImpulse` decays under `IMPULSE_FRICTION` and caps at
   `IMPULSE_MAX = 780` — a decaying launch means the landing point depends on friction, and the
   reticle lies). This needs: a **launched flag + locked launch vector as synced PlayerState fields**,
   a shared stepper branch that integrates the lock instead of steering while launched, and the
   predictor replaying with the same branch. That is new server schema and a new shared-sim mode.
   Anyone on this panel claiming "it's just a bigger vh" has not read prediction.ts.
2. **The crouch state machine must live in the pending-command rebase, like jumpCd/jumpBuf do.** The
   predictor already stores `jumpCdBefore/jumpBufBefore` per pending command precisely because the
   server doesn't sync those timers (prediction.ts:79–86). The crouch adds: phase (idle/crouch/
   launched), charge timer, latched direction. Either (a) all of it is command-deterministic and gets
   the same before-state treatment in `PendingPredCmd` + `stepPredictedVertical`'s twin, or (b) it's
   synced schema. It must be (a) for the state machine and (b) for the launch vector — and the panel's
   tech doc must enumerate the fields, because "we'll reconcile it" is where the §26 retro says desyncs
   are born. **`PredCmd`/`InputCmd` grow new bits** (crouchHeld/pound — GameRoom:288–301 and
   prediction.ts:45–50 must stay twins).
3. **The pound must reconcile under the existing adopt rule with zero new carve-outs.** Pound descent
   at, say, 900px/s is **45px/tick — nearly 4× `HEIGHT_ADOPT_PX`**. One tick of client/server
   disagreement about *when the pound started* (e.g., the client fires it from a buffered press the
   server's consume gate rejects) and every reconcile adopts, producing a visible mid-slam pop. The
   pound trigger must therefore be exactly as deterministic as the jump: intent rides the sequenced
   command, the consume gate's conditions (airborne? min height? not already pounding?) are mirrored
   bit-for-bit in the predictor, and **the denied-pound case is the tested path**, because denial is
   where adopt-pops live. The pound's *impact* (AoE damage, enemy knockback, camera hit) is
   server-authoritative and un-predicted — fine, that's the existing pattern — but the *descent curve*
   is either identical on both sides or the verb feels like rubber.
4. **What explicitly needs new server state** (flag it now, not in review): launched flag + launch
   vector (synced, for rebase); crouch phase/charge (server combat record, command-deterministic
   client twin); pound-active flag (synced — remote clients must render a teammate's slam, and
   `applyBossQuake`/juggle arbitration needs to test it, §6); distance-jump cooldown (server record +
   predictor mirror, like `jumpCd`); a landing event (`poundSeq`-style counter for VFX, like
   `fellSeq`/`parriedSeq`). Six fields minimum. Budget them.
5. **Teleport interaction:** a failed distance jump into a pit ends in the snap-back teleport
   (`zeroMoveVel` bumps `teleportSeq`, predictor hard-snaps — already correct). But the *launched
   flag* must be cleared server-side on that same tick or the predictor replays a flight from the
   snap-back point. Every early-exit from the launched state (death, level window, pit, belt clamp)
   must zero the lock. List them exhaustively; the level-window freeze (`inLevelWindow` skips pit
   checks and movement, GameRoom:2355) mid-flight is the one everyone will forget.

**Law N-1: both new verbs' state machines are command-deterministic in the shared sim; the predictor
gains no new adopt thresholds and no carve-outs from the adopt-on-divergence rule. Law N-2: the launch
lock is synced schema, integrated by a shared stepper branch, never faked through the impulse channel.
Law N-3: every server-side early-exit from crouch/flight/pound zeroes the lock and is covered by a
reconciliation test (the prediction.test.ts mock-server pattern).**

---

## 5. Ground pound power creep — a free AoE on a movement key will eat the weapon game

The pound is damage bolted to a verb with no ammo, no draw lock, no ledger, no aim requirement. The
existing economy it threatens:

- **Weapons** pay in cooldowns, magazines, reload, drawLock, and the whole G-01 resource-ledger
  apparatus. A pound that clears trash on a 0.7s-class cooldown makes the early-wave weapon game
  optional.
- **The quake-parry dance** (applyBossQuake, GameRoom:4586) is the colossus's entire rhythm: jump the
  shockwave or parry it for the white flash + chain feed. If the pound *also* answers ground pressure —
  or worse, deals its own quake while dodging Vastaghar's — the most legible boss rhythm in the game
  gains a third answer that requires no timing read at all.
- **The pit synergy is the real creep, and nobody has priced it:** enemies over a pit **die instantly,
  free** (GameRoom:2700–2705, "terrain kills are free crowd control"). A pound with radial knockback
  next to any pit lip is a mass-execute button: kite, hop, slam, entire pack shoved in. That single
  interaction obsoletes every crowd weapon in the Scar dimension. The parry already does this
  one-enemy-at-a-time as a *skill* payoff; the pound would do it wholesale as a *cooldown* payoff.

**Laws (pound economy):**

- **P-1: the pound is CC, not DPS.** Damage ≤ ~0.5× a starting-weapon swing, or zero. Its payload is a
  short stagger/interrupt (which also gives it a real job: interrupting lunge windups — priced by P-4).
- **P-2: no radial displacement, or displacement ≤ 40px with `addImpulse` (capped, decaying) — never a
  position write.** A pound must not be able to shove a healthy enemy from ground into a pit more than
  one bodywidth away. If playtests want a bigger shove for feel, then pit-edges get a pound-shove
  exemption (enemies stagger at the lip) — pick the boring rule, not the exploit.
- **P-3: cooldown ≥ 3× JUMP_COOLDOWN (≥2s) and it shares no cooldown with the quick jump** (a spent
  pound must never lock out the quake-dodge hop — see §8).
- **P-4: the pound never grants i-frames, at any point of the descent or landing.** The parry is the
  only negate; the jump is the only positional dodge; the pound is the only slam. Three verbs, three
  jobs, zero overlap — this is the same law the §5 jump block already wrote for itself
  (constants:372–375). The moment the pound descent is invulnerable, it becomes the dodge, the jump,
  and the attack simultaneously.
- **P-5: pound kills grant XP normally but pit-deaths stay XP-free** (already true — keep it, it
  self-limits the shove exploit's reward).

---

## 6. The juggle collision — one displacement authority, decided now

The enemycombo panel's juggle grammar writes the player's `vh` directly: launcher **sets** vh = 480,
air-keeps **set** vh = 360, capped at `PARRY_LAUNCH_MAX = 640` (designer.md §4; guardrails G9/G11).
The pound writes vh hard negative. Two systems now write the same scalar in opposite directions, and
"whoever writes last this tick" is not a design — it's a race.

The bad outcomes, both ways:

- **Pound beats launcher:** the pound is a free, zero-timing juggle escape. The enemycombo panel
  priced juggle escape carefully (air parry alters vh and de-times follow-ups — G11; DI preserved; the
  launcher is refusable at the door). A slam that cancels any juggle for a 2s cooldown undercuts that
  entire economy and turns every juggle-capable elite into a pound-check.
- **Launcher beats pound:** a mid-descent re-loft silently deletes the player's committed slam — input
  eaten, AoE never fires, and under prediction (§4) the client showed a slam the server replaced with
  a loft, a guaranteed adopt-pop *plus* a betrayal.

**Law J-1 (single displacement authority): enemy launch/keep writes win over self-writes,
unconditionally and visibly.** An enemy launcher connecting during pound descent converts the pound
into the juggle state (pound canceled, cooldown **fully refunded** per C-4's spirit, cancel telegraphed
with the launcher's own white wedge — the player was hit by a parryable move they chose not to answer;
that's fair). The pound is *not* an escape: while airborne from an enemy launch (`vh` externally set —
track a 1-bit "lofted by enemy" flag, which the juggle implementation needs anyway for its keep logic),
the pound input is refused (buffered per I-4 if within landing ticks). Conversely the pound may only
initiate from a *self-jump* apex. One flag, one rule, both panels cite it.

**Law J-2: all vh writes remain sets-with-cap (never additive) per the juggle panel's G9, pound
included** — a pound descent is `vh = -POUND_SPEED`, one write, no stacking with gravity tricks.

---

## 7. The distance jump vs the Scar zone — don't let the verb delete the level design

Pits are the Scar's price, and the price is *already gentle*: falling costs 15% max HP, a snap-back,
and 0.6s of grace (GameRoom:2388–2401). There is no death, no rescue mini-game, no downed state — the
worst case of any botched jump is a chip and a teleport. Now add a verb that clears wide gaps on
demand and ask what's left:

- **The map generator's whole connectivity contract** is built on 2-tile hoppability
  (`MAP_MAX_JUMP_TILES = 2`, derived from 144px reach — constants:203–209; mapgen `reachable()`
  bridges anything wider). Pits wider than 2 tiles exist *specifically* as "go around" features, and
  `classifyPitRegions` (mapgen:1241–1251) drives a **width-keyed rim vocabulary**: thin lip = "hop
  me", chevrons = "go around". A distance jump that clears 4–6 tiles makes every chevron rim a lie.
  The floor renderer's danger language must gain a third tier ("crouch-jump me") or the distance jump's
  reach must sit *below* the widest generated pit — otherwise the map is teaching rules the movement
  system repealed.
- **Routing collapses quietly.** The cost can't be "risk," because §3's reticle (correctly) removes
  the risk, and §2's crouch (correctly) is short. Cooldowns don't price *routing* — out of combat, an
  8s cooldown is zero cost; you just wait at the lip. So be honest about what the verb costs and where:
  - **Reach cap is the real lever: ≤ 3.5 tiles (~280px).** Wide "go around" features (4+ tiles)
    survive as go-around. This single number is the difference between "a better hop" and "the Scar's
    terrain is decorative."
  - **In combat, the crouch root is the price** (0.3s of exposure — real under pressure, per §2).
  - **Out of combat, accept that there is no price and design accordingly:** never gate a reward
    behind a pit *assuming* the player can't cross; assume they can, and put the interesting decision
    (enemies, quake timing) on the far lip instead.
- **Belt mode** (1-D x-range pits, `beltPitAtX`): a distance jump along the belt axis trivializes
  authored gap rooms sized against the 144px hop. Either the verb is disabled on the belt or every
  authored gap is re-audited against the new reach. Silence on this = a broken carrier level.
- **A cheap failure begets spam:** since a shortfall costs only 15% + snap-back, players will gamble
  max-range jumps constantly. Fine — but then the snap-back's `lastGround` bookkeeping and
  `teleportSeq` path is about to run 10× more often than today (§4.5), and the 0.6s invuln it grants
  becomes a *combat resource* (§8). The failure being cheap is a choice; know what it buys.

**Law D-1: distance-jump reach ≤ 3.5 tiles, hard cap, and the generator/rim vocabulary is updated in
the same change that ships the verb. Law D-2: the verb ships disabled in belt mode until every authored
gap is re-audited. Law D-3: no pickup/objective may be placed assuming a gap is uncrossable.**

---

## 8. Quake interaction — two jump verbs = two dodge timings, plus an invuln exploit already in the code

`applyBossQuake` has exactly one airborne test: `height > GROUND_EPSILON` → immune (GameRoom:4599).
Both new verbs interact with it, and one existing line makes it worse:

- **The distance jump trivially dodges quakes for longer.** A higher/longer arc means a bigger immunity
  window with a *smaller* timing read. Vastaghar's rhythm is tuned against a 0.449s hop that demands
  the jump be *timed*; a 0.7–0.9s arc turns "read the stomp" into "be vaguely airborne." Two answers:
  either the distance jump's airtime stays ≤ the quick jump's (make it *flat*: more horizontal speed,
  not more height — which also keeps the 34px visual language intact), or quakes gain a max-height
  clip only for the exotic arc. The first is simpler and better: **the distance jump is a long, LOW
  arc; the quick jump stays the vertical verb.** That also keeps the readability story clean: one
  silhouette (high hop) = quake dodge, one silhouette (low dart) = gap crossing. Two verbs whose
  silhouettes encode their jobs — that's how co-op teammates read each other at a glance.
- **The crouch is a quake magnet and will be blamed on the game.** Crouching = grounded + (mostly)
  stationary during the exact windup a footfall telegraphs. A player who initiates a 0.3s crouch as
  Vastaghar's 0.7s windup starts still launches in time; at 1.0s they are flattened *while performing
  a jump input* — "I pressed jump and the jump killed me." §2's duration law is also a quake law.
- **The pit-grace invuln is an accidental quake auto-parry — this is in the code today.** Pit fall
  sets `c.invuln = 0.6` (GameRoom:2399); `applyBossQuake` treats *any* `invuln > 0` as a PARRY:
  `parriedSeq++`, parry-cooldown reduction to the chain rate, **`applyParryAugments`**, and
  `acceptWormParry` feeding the worm's parry logic (GameRoom:4600–4607). Today pit falls are rare
  enough that nobody noticed. Ship a spammable distance jump (§7's cheap failure) and "deliberately
  shortfall into the pit for 15% HP → get flashed back with 0.6s of quake-auto-parry + augment procs
  timed onto Serraketh's *paired* RibQuakes (5-tick gap — one grace covers both)" is a build. Fix the
  seam before the verb ships: distinguish parry-invuln from mercy-invuln in the quake resolve (only
  parry-window invuln gets the white flash/augment path; mercy invuln just negates damage).

**Law Q-1: distance jump is a low arc — its peak ≤ the quick jump's 34px and its airtime within
~0.55s — so there is exactly one aerial quake-dodge timing to learn. Law Q-2: `applyBossQuake` (and
any future quake resolve) must distinguish parry i-frames from pit-grace/mercy i-frames before either
new verb ships.**

---

## 9. Co-op grief — the pound is a screen-shake generator next to a timing game

The parry game runs on reading **white flashes and windup poses at 20Hz**. A teammate's pound is, by
design, the loudest thing on screen: camera shake, dust, radial VFX, probably hit-stop. Land one next
to a teammate mid-parry-read and:

- The **visual noise masks the lunge windup / white wedge** they were timing. The paper-cutout VFX
  budget must treat pound impact as *local* to the pounder's screen (full shake for me, reduced/no
  shake for teammates — the same discipline the codebase already applies to snap thresholds and
  budgets elsewhere).
- If the pound **staggers or displaces** an enemy mid-lunge, the teammate's parry whiffs through an
  attack that no longer arrives — their chain (`parryChain`, which lapses on a gap, GameRoom:2468)
  breaks through no fault of theirs. P-1/P-2 already bound this; add the co-op rider: **a pound's
  stagger does not cancel an in-flight lunge whose windup completed** (the lunge lands or is parried;
  the stagger applies after resolution). Interrupting *windups* is the pound's job (P-1); deleting
  *committed* attacks a teammate is answering is grief.
- **Displacement grief:** shoving enemies out of a teammate's melee arc or *toward* a downed teammate.
  P-2's 40px cap is the fix; hold the line on it.

**Law G-1: pound screen-shake/hit-stop is self-only (teammates get a dust ring, no shake). Law G-2:
pound stagger never cancels a committed (post-windup) lunge.**

---

## 10. Hard guardrails (consolidated)

| # | Guardrail | Enforced where |
|---|---|---|
| I-1 | Quick jump fires on keydown with today's latency; no disambiguation delay, ever | client input + predictor twin |
| I-2 | No press-duration split on Space; crouch/pound get a distinct input (one "down" modifier for both) | client input |
| I-3 | Mid-air Space = buffered quick jump, unchanged | GameRoom consume gate + predictor |
| I-4 | Verbs buffer only into themselves; pound buffer discarded on landing; crouch never buffers | server + predictor |
| C-1 | Crouch ≤ 0.35s (5–7 ticks); charge past that adds nothing | shared constants |
| C-2/3/4 | Damage doesn't cancel; early release cancels free; WASD steers, never cancels; any forced cancel refunds cooldown | server sim |
| S-1/2/3 | Direction latched at launch tick from live WASD; zero-input aborts; landing reticle drawn from shared fn, pit landings shown not silently clamped | shared fn + client + server |
| N-1/2/3 | Command-deterministic state machines; no new adopt carve-outs; launch lock is synced schema in a shared stepper branch; every early-exit zeroes the lock, with reconciliation tests | prediction.ts + GameRoom + schema |
| P-1..5 | Pound = CC not DPS (≤0.5× starter swing); shove ≤40px via capped impulse; cooldown ≥2s, separate from quick jump; zero i-frames; pit kills stay XP-free | server sim |
| J-1/2 | Enemy vh-writes beat self-writes (pound→juggle conversion, cooldown refunded); pound refused while enemy-lofted; all vh writes are capped sets | server sim, shared with enemycombo panel |
| D-1/2/3 | Distance reach ≤3.5 tiles; rim vocabulary updated same change; belt-disabled until gap audit; no content assumes uncrossable gaps | constants + mapgen + floor-renderer |
| Q-1/2 | Distance jump is a LOW arc (peak ≤34px, airtime ≤~0.55s) — one aerial quake timing; quake resolve splits parry-invuln from mercy-invuln first | shared constants + GameRoom |
| G-1/2 | Pound shake self-only; stagger never cancels committed lunges | client VFX + server sim |

## Ship checklist (the tests I will ask for in review)

- [ ] **Stolen-jump test:** scripted input holds Space 60–200ms across the threshold sweep; assert
      the quick jump fired on keydown in 100% of cases and zero crouches were entered unintended.
- [ ] **Buffer-integrity test:** Space pressed at every tick offset of a jump arc; assert buffered hop
      fires on landing exactly as on current master (regression against GameRoom:2482 semantics).
- [ ] **Reticle honesty test:** for every launch speed × gap width 2–4 tiles × approach angle, the
      landing tile computed by the reticle fn equals the tile of the first grounded tick server-side
      (the 32px/tick quantization walk from §3).
- [ ] **Reconciliation suite** (prediction.test.ts pattern): crouch-launch under 100–300ms latency
      with a denied launch (level window opened mid-crouch); pound denied by the consume gate; patch
      arriving mid-flight — assert zero adopt-pops (no `HEIGHT_ADOPT_PX` breaches, no error-offset
      grind above today's ceiling).
- [ ] **Juggle-arbitration test:** enemy launcher connects at every tick of a pound descent; assert
      pound converts to juggle, cooldown refunded, no double vh write, client adopts cleanly.
- [ ] **Pit-shove exploit test:** pound at a pit lip with a 12-enemy pack; assert ≤1 bodywidth of
      displacement and no enemy crosses from ground to pit from the shove alone.
- [ ] **Quake-timing audit:** Vastaghar phase 3 (1.4s cadence) with only distance jumps; assert the
      low-arc law keeps the dodge read identical to the quick jump; crouching through a windup at the
      C-1 duration escapes, at 1.0s does not (documenting why C-1's number is load-bearing).
- [ ] **Mercy-invuln test:** pit fall grace active during a quake; assert damage negated *without*
      `parriedSeq++`/augment procs/`acceptWormParry` (the §8 seam, fixed).
- [ ] **Belt audit:** every authored belt gap re-measured against the new reach or the verb asserted
      disabled in belt mode.
- [ ] **Rim-vocabulary check:** every generated map, every pit region: the rim tier shown matches
      crossability under the final reach numbers (no chevron lies).
