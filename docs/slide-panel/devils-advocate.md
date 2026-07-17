# Slide-hop: Devil's Advocate

Panel role: devil's advocate. Scope: design only. This document does not authorize source changes.

## 0. The collision is not hypothetical

The desired mechanic is clear: a moving player can drop into a fast, low slide, jump out while retaining horizontal momentum, land, and repeat the sentence. Correct execution sustains travel above ordinary running speed. That last clause is not incidental flavor. It is the reason to learn the technique.

It also contradicts three pieces of the current game at once.

- `packages/shared/src/constants.ts` still names `MOVE_SPEED = 320` as the locked flat-speed law with “no sprint layer.” The distance jump was deliberately balanced around that law: `372 px / (0.15 s detection + 0.50 s crouch + 0.60 s flight) = 297.6 px/s`, below walking even before its 2.5 s cooldown.
- Space is not free. `SpaceGestureClassifier` in `packages/client/src/net/prediction.ts` emits a grounded tap-jump on **release**, turns a hold into `crouchHeld` at 150 ms, and turns an airborne press into pound. The server then roots `STANCE_CROUCH` for ten 50 ms ticks before launching `STANCE_DASH`. Damage and fire can force-cancel that commitment, with `stanceSeq` providing the soft-resync edge.
- Shift is not truly free design space. The classmerge roll proposal has already claimed Shift-tap, stance 4, and the exact “cross space fast now” role: 188 px over 0.40 s, with five ticks of contact-test i-frames and a 3.0 s bill. It is queued rather than present in source—the current shared `MoveStance` union contains only 0–3—but treating it as nonexistent would evade the panel's actual conflict.

One version detail should be recorded accurately. The stance machine was appended in the schema-20 wave; the current branch reports `SCHEMA_VERSION = 21` because `runCharacter` was appended afterward. A slide implementation that adds wire state would be the next schema change, not a second “schema 20” feature.

My thesis is blunt: **a real Megabonk-style slide-hop is a new mastered gait, not another cooldown dash.** If the game wants it, the game must repeal the flat-speed law in a named, bounded way and remove one competing movement verb. Hiding the speed inside a short burst, a cooldown, or a stamina bar until its cycle average falls below 320 would preserve the old law by deleting the requested feature.

## 1. Verb grammar: there is no clever binding that makes five meanings feel like three

The live grammar is already:

| Context | Space | Shift |
|---|---|---|
| Grounded, release before 150 ms | normal jump | queued roll wants immediate keydown |
| Grounded, hold at least 150 ms | enter rooted crouch; after 0.50 s, distance jump | classmerge suggests tap-roll and has floated hold-distance-jump |
| Airborne, press | ground pound | roll is grounded-only |
| Committed crouch / distance flight / pound | stance-specific denial or cancel rules | roll proposal denies these committed roots |

A slide-hop needs two edges: **enter slide** and **jump from slide**. Trying to make one already-overloaded edge imply both is where every “simple” mapping becomes dishonest.

### 1.1 Every practical assignment family and its casualty

| Assignment | What it buys | What it breaks |
|---|---|---|
| **Moving hold-Space becomes slide; stationary hold-Space remains charged distance jump; release from slide hops** | “Slide is moving crouch” is semantically elegant and the roll can remain on Shift | Slide cannot begin until the existing 150 ms classifier resolves. A tiny WASD sample decides between two radically different commitments. The player cannot press the held key again to hop, so hop must move to release. At 0.50 s the same hold currently auto-launches the distance jump, placing an arbitrary deadline inside the slide. It also makes the charged jump unreliable whenever the stick or a key is not exactly neutral. This is related to Megabonk, but it cannot feel immediate or stable. |
| **Space tap/double-tap starts slide; Space otherwise jumps** | No new key | The first tap already emits jump on release. Preventing that requires a double-tap wait before every normal jump, or undoing a jump after it starts. Mid-air, the second press is pound. This mapping is non-viable. |
| **Space down starts slide while moving; Space release hops** | Immediate slide and a natural press-release gesture | It removes the current immediate intent of grounded Space, makes ordinary jump contingent on motion noise, and leaves no clean way to hold the rooted distance charge. It also changes tap-jump from one delayed action into two possible actions before release. |
| **Shift tap = roll, Shift hold = slide** | Both ground verbs on the conventional movement key | The classmerge roll explicitly fires on keydown because a reactive dodge cannot spend 150 ms discovering that it was a tap. If roll fires on keydown, every slide begins with a roll and its cooldown. If classification waits, the roll loses its admission ticket. Both cannot own the same first edge. |
| **Shift tap = slide, Shift hold = roll** | Slide wins the fast edge | The defensive roll becomes a delayed hold action, precisely the latency failure its design rejects. A hold is also a poor panic gesture. |
| **Shift with WASD = slide; neutral Shift = roll** | No timing discriminator | A directional roll is the common roll. This mapping makes it impossible, while movement-key jitter can convert an intended roll into an unprotected slide. Last-heading fallbacks make the ambiguity worse, not better. |
| **Single Shift = slide; double-Shift = roll** | Both technically exist | A double press delays or contaminates the first action, is unreliable while Shift is held, invites false rolls during slide rhythm, and aggravates the Windows Sticky Keys risk already discussed by classmerge. |
| **Shift+Space chord enters slide** | Keeps each single key's nominal meaning | Key ordering inside a render frame and then a 50 ms command bucket decides whether jump, crouch, pound, roll, or slide wins. Adding a chord grace period delays at least one reaction verb. It is also awkward to repeat while steering with the same hand. |
| **Shift starts slide; Space hops; roll is removed** | Both required slide-hop edges are immediate and independently repeatable; current Space meanings can remain outside the slide context | The queued roll yields. Space becomes context-sensitive on **keydown** during slide even though ordinary grounded jump still fires on release. This needs an explicit consumed-until-release latch so one press cannot hop and then pound. This is the cleanest grammar if the user directive has priority. |
| **Dedicated Ctrl/C/V/X/G starts slide; Space hops; Shift remains roll** | All three verbs coexist without timing discrimination | It creates a fifth movement verb, costs a finger or a second pinky binding during WASD, has poor controller parity, and still leaves two rapid ground-displacement answers plus the distance leap. Ctrl also creates dangerous browser/OS chords; C/V/X/G are reachable but not effortless. This is the only honest all-three option, and its cost is complexity rather than latency. |
| **Double-tap a movement direction starts slide** | Shift and Space survive intact | Continuous kiting already involves releases and micro-re-presses, so false positives are routine. Sliding in the direction already held requires release-tap-tap. This is unacceptable for a free, repeatable gait and worse for accessibility. |
| **Auto-slide on landing, at speed, or whenever crouch is held** | Easy chaining | It removes the authored rhythm, converts the technique into the default locomotion animation, and makes the speed law apply to everyone all the time. It is suitable only as an optional accessibility assist with a lower ceiling, not as the core grammar. |
| **Move distance jump to hold-Shift, keep roll on tap, and place slide on Space-hold or another chord** | Frees part of Space on paper | Tap-roll versus hold-distance still contradicts the roll's immediate-keydown contract, and slide inherits the Space ambiguity described above. Moving the labels does not remove either discriminator. |

### 1.2 The moving-crouch proposal

The slide should look like a crouch and may reuse crouch artwork, but it should **not** be implemented as “the current crouch, except movement is allowed.” The current crouch is a ten-tick rooted offer that can be cancelled by damage or firing and automatically resolves into a 620 px/s, 372 px airborne dash. Its timer, aim capture, cooldown, cancel rules, and promise are those of a charged route verb.

A slide is the opposite: it moves on acceptance, carries current heading, can resolve into an ordinary jump almost immediately, and is meant to repeat. Sharing a pose is sensible. Sharing `STANCE_CROUCH` or its timer is a state-machine trap. Give slide its own stance and transition rules.

### 1.3 Coexistence ruling

I would ship **slide + slide-hop + the charged distance jump, and I would remove the queued dodge roll.** In this collision, the roll yields.

That is not a dismissal of the classmerge design. Its own signed collapse rule says the roll earns a separate slot through a unique latency/i-frame combination and otherwise should merge. The new directive takes the roll's other half—instant ground displacement and geometry correction—and makes it a repeatable movement language. Keeping both would produce:

- an unlimited early reposition through slide;
- a cooldown late reposition with i-frames through roll;
- a long planned pit-crossing reposition through distance jump;
- normal jump and pound on the same Space family;
- parry as the existing universal defensive timing verb.

That is movement creep, not richness. The roll could still be distinguished on a threat matrix, but every encounter would now have to price a 1.4× gait **and** a 188 px panic correction **and** five defensive ticks. Non-sliding players would absorb the resulting enemy escalation.

The distance jump survives because a hard range boundary can protect it: slide-hop must never clear the charged leap's four-tile class. The distance jump remains the slow, premeditated, 372 px route tool. The slide becomes the immediate, repeatable, sub-three-tile mastery tool. If those distances converge, the distance jump should also be removed rather than defended by its old animation.

## 2. The speed economy: repeal the law by name

The collision should be written as a replacement law:

> `MOVE_SPEED = 320` remains the maximum ordinary commanded movement speed. Slide-derived carry is the sole player-authored exception. Correct slide-hop chaining may sustain carry above `MOVE_SPEED`, subject to a 1.40× hard cap and deterministic decay. No encounter may require that exception.

The current enemies make the stakes obvious. Authored move speeds in `packages/shared/src/enemies.ts` range up to roughly 225 px/s, while common hostile projectile speeds are 300, 320, and 350 px/s. A 448 px/s player does not merely kite melee better; they can run away from projectiles that were authored around a 320 px/s ceiling. Increasing all enemies and bullets to catch the expert would make ordinary walking non-viable. Leaving them untouched makes broad families of pressure optional for the expert.

There are three honest economic shapes:

1. **Momentum decay only:** preserves an unlimited mastery gait, but without a cap any repeatable injection eventually breaks collision, camera, prediction correction, and encounter geometry.
2. **Stamina or heat:** gives designers a finite chase budget, but converts rhythmic mastery into meter management. Once the meter forces the cycle average near 320, it ceases to be the requested sustained technique. A generous meter merely delays the same balance problem.
3. **Cap-and-decay:** accepts that skilled travel is faster, bounds every downstream system to one number, and makes missed rhythm visibly shed the advantage.

I defend **cap-and-decay, with no stamina bar**. A starting deterministic law worth prototyping is:

- Player-authored slide carry is capped at `1.40 × MOVE_SPEED = 448 px/s`. Knockback/recoil may add their existing impulse separately, but external impulse can never be converted into renewable slide carry.
- A grounded slide with meaningful movement input adds 96 px/s along the accepted heading, capped at 448. From ordinary full speed the first slide reaches 416; a clean next cycle can reach the cap.
- While sliding or airborne from a slide-hop, only the excess above 320 decays, multiplied by **0.96 per 50 ms tick**. At the cap, one ordinary 0.55 s hop averages about 420 px/s and travels about 231 px horizontally—materially faster than walking, but below a three-tile/240 px hard route boundary.
- Grounded outside a slide, excess is multiplied by **0.70 per tick**. A broken chain therefore returns close to ordinary speed in a few tenths rather than becoming a permanent hidden stat.
- Excess momentum retains its vector. Input can bend it only at an authored angular rate; a reversal or a turn beyond 90 degrees discards the excess instead of rotating 448 px/s for free. This preserves the “carry” in momentum and prevents orbiting enemies at sprint speed.
- Starting a slide requires grounded movement input. It is not a dash from rest, cannot cross walls, uses the normal body radius, and falls into pits while still grounded.

These numbers are prototype bounds, not a claim about Megabonk's private constants. The defendable law is the shape: **one explicit cap, slow decay while the sentence is alive, fast decay when the sentence breaks, and no meter that pretends sustained speed is not the point.**

### 2.1 What still breaks under the bounded law

**Kiting and projectile pressure.** At 416–448 px/s, ordinary chasers are even less able to close and several projectiles can be outrun. Do not globally buff speeds. Content must continue to be beatable at 320, while anti-run pressure comes from lead aim, crossfire, bounded lanes, and area denial. Any lead calculation must see carried velocity; `GameRoom` currently leads some combo aim with `target.mvx + target.vx`, so storing carry somewhere else without adding it to that query would silently under-lead experts.

**Negotiated leaps.** Tough combo leaps freeze a landing promise for six offer ticks plus seven air ticks: 0.65 s before touchdown. The server deliberately never retargets it, and it treats leaving the original footprint as a complete answer. A capped slide-hopper can move roughly 270–290 px during that promise; the leap becomes an almost automatic whiff. The solution is **not** a homing marker, enlarged footprint, or last-tick correction. Those violate the combo's G3/G4/G5 promise. Preserve the honest whiff and change admission: leap-speaking enemies may choose a grounded opener or wait for a chain break when a target already carries excess speed. Telemetry must measure leap offers and whiffs separately for walkers and slide-hoppers. If experts suppress nearly every leap, that enemy archetype has lost pressure and needs a different fair sentence, not a cheating leap.

**Scar and pit pricing.** The arena generator's mandatory hop proof is built around two tiles, and Scar earns danger through denser pits and constrained crossings. A 231 px slide-hop discounts that risk and creates optional near-three-tile shortcuts. That is acceptable only if it stays a mastery shortcut. Mandatory connectivity, boss exits, loot access, and co-op regroup paths must remain valid for the ordinary jump. Add a simulation assertion that one slide-hop under the carry law travels **less than 240 px**, while the committed distance jump retains its 372 px monopoly. A grounded slide over a pit still triggers the existing 15% max-HP fall and snap-back; only the actual airborne hop clears it.

**Co-op pacing.** Over ten seconds of open travel, a strong chain can put one player about a thousand pixels ahead of a walker. The front player can claim aggro, trigger duel offers, alter spawn geometry, and reach interactions while the rest of the squad is still routing around Scar. Shared encounters and progression must use quorum or squad-safe activation, never the first expert crossing an invisible line. Do not add a rubber-band sprint to everyone; that makes slide-hop mandatory indirectly. Test one expert, one novice, and two mixed-latency players as the primary case, not four synchronized experts.

**The classmerge roll economy.** Its 3.0 s cooldown proved that a 470 px/s burst remained a burst rather than a gait. Slide-hop deliberately invalidates that argument by removing the bill. This is the decisive reason the two designs cannot be balanced by copying the roll's speed schedule and simply deleting its i-frames.

## 3. Netcode: prediction needs a momentum memory

The current predictor does not “just steer from commands.” It rebases `x/y`, steering velocity, impulse velocity, height, and vertical velocity, then replays pending 50 ms commands while restoring private stance snapshots: crouch timer and aim, dash direction/base direction/speed/steer, distance-jump cooldown, pound state, recovery, and aim. That is why the distance jump can survive reconciliation.

Slide carry is new persistent predictor state. Unlike the existing distance-jump `dashSpeed`, it survives the slide stance, survives into ordinary airborne vertical phases, lands still above `MOVE_SPEED`, and affects the next slide. If it is reconstructed loosely from current input, server and client will disagree after a correction, a forced cancel, a collision, or an unacknowledged landing.

The implementation contract should therefore be:

- Add a slide edge/held intent to the numbered input command, not an action message. The exact accepted tick must be acknowledged and replayable.
- Put the complete cap-and-decay step in `packages/shared`: position/steering state, carry vector, stance tick, hop retention, turn loss, and decay must be a pure deterministic function used by server and predictor.
- Rebase from authoritative carry state. Reusing only `mvx/mvy` is safe **only** if those values fully encode the carry vector and the shared step requires no hidden age or retention timer. The proposed rhythm window does require stance age, so synchronize a start/remaining-tick anchor or another sufficient representation. Do not infer it from animation time.
- Snapshot every private carry field in each pending predictor command, just as the current predictor snapshots the distance-jump fields. On `stanceSeq` force-cancel, strip pending slide causes and their stale rebase points; never let replay resurrect a denied chain.
- Keep player-authored carry out of `vx/vy`. Those fields are the impulse channel for recoil and knockback, with their own exponential friction and cap. Combining them would let combat impulses become renewable travel and would make collision corrections indistinguishable from skill momentum.
- Ensure wall/POI/belt collision modifies or cancels the same carry vector on both sides. A visual correction that glides the player out while preserving impossible momentum will produce repeated wall rubber-banding.

### 3.1 The 20 Hz honesty limit

At 20 Hz, one simulation decision is 50 ms. A render-frame input waits between almost 0 and almost 50 ms for its next command bucket before local predicted movement advances. A one-tick boundary therefore moves the accepted rhythm by three frames on a 60 Hz display or six frames on a 120 Hz display. Network latency does not need to add press-to-motion delay when prediction is healthy, but reconciliation can still correct which authoritative tick owned a landing or cancel.

It can be responsive and satisfying. It cannot be literally frame-perfect in the single-player sense, and the panel should not promise that “exactly like Megabonk” includes identical input timing. The honest target is mechanical identity—burst, low profile, hop carry, repeatable rhythm—with a tick-tolerant timing envelope.

Recommended feel law:

- Shift acceptance starts the predicted slide on the next command tick.
- A two-tick airborne Shift buffer may start a slide on the first grounded tick; it never creates an air slide.
- Space on slide **keydown** is consumed as the hop. It bypasses the ordinary 150 ms Space classifier and is latched until release so it cannot become pound in the next airborne frame.
- Slide ticks 2–5 are a full-retention plateau. A hop requested on ticks 0–1 buffers to tick 2; a later hop still occurs but has already lost more excess. Skill is rewarded continuously rather than by a one-tick pass/fail cliff.
- All windows are whole ticks and shown by animation/audio. There is no client-only coyote success that authority can later deny.

This four-tick plateau is deliberately not frame-perfect. It is the price of making a rhythm verb trustworthy on a 50 ms authoritative grid.

## 4. Lowered profile must be a rule, not a squash tween

If sliding changes no hit test, “lowered profile” is cosmetic advertising. If it shrinks the universal player circle or grants generic projectile immunity, it becomes a near-continuous dodge roll with better economy than the queued roll. Neither is acceptable.

I would make profile meaningful through a narrow authored channel:

> While `STANCE_SLIDE` is active, attacks explicitly tagged **high/overhead** pass above the player. Standard projectiles, low shots, body contact, melee sectors, beams, ground AoE, zones, quake rings, pits, and walls behave normally.

This is i-frame-adjacent power and needs the same channel discipline as the roll proposal.

- Never write or consult parry `invuln`; a high shot that passes over gives no `parriedSeq`, heal, knockback, chain, deflect, stagger, or other reward.
- Never grant a generic “projectile miss.” Each eligible attack must be authored and visibly elevated, with a separated shadow/flight cue. Untagged current projectiles continue to hit.
- Never shrink `PLAYER_RADIUS` for body, wall, pickup, melee, or pit collision. The paper pose changes its vertical profile, not its ground footprint.
- The lowered state exists only during grounded slide ticks. A slide-hop relies on the existing airborne/grounded rules; it does not carry overhead immunity through the whole jump chain.
- Ship at least one readable high attack in the same wave or stop claiming functional lowered profile. A data channel with no authored exam is dead complexity; a squash tween alone is cosmetic.

Because slide is repeatable, high attacks must be designed as crouch checks rather than a large share of ambient bullets. Otherwise optimal play becomes permanent low-profile spam and the nominal distinction from i-frames is academic.

## 5. Paper animation and battlefield readability

A fast sliding cutout can become a moving paper splinter exactly when the player needs to read rings, lanes, pit lips, and enemy locks. The roll proposal's edge-on/reverse-face language is wrong here: it communicates invulnerability and makes the body disappear twice. Slide needs a distinct, continuously trackable silhouette.

- Fold the lower half into an accordion crouch and pitch the torso forward, but keep the head/upper ink mass at no less than roughly 70% of its normal screen height. Do not rotate the whole card edge-on.
- Keep one high-contrast ink anchor at the head/shoulder and a compact ground shadow at the authoritative body center. The pose may lead the center visually; the shadow may not.
- Use a narrow two-tick paper-scrape wake and a small crease snap on hop. No opaque afterimage train, camera shake, or broad dust ribbon. A chainable gait will otherwise paint over telegraphs continuously.
- Keep exact danger rims and pit hot lips visible above the nonessential trail. The player's outline may cross them; the trail and fold effects may not erase them.
- Distinguish the functional profile window from mere carry: folded silhouette while grounded means “high shots pass”; airborne upright/arc means normal jump rules; a speed streak alone means momentum, not protection.
- Remote players need the stance and heading, but their trail should be quieter than the local player's. Four simultaneous full-strength paper wakes would turn co-op into visual combing.
- Sound must survive repetition: one soft scrape onset and one hop crease, with no bass and aggressive concurrency limits. A technique used every second cannot consume the combat mix.

Readability is also a collision promise. Sliding into an enemy still respects ordinary body separation; the art must not imply ghosting through a pack. Sliding into a wall should visibly crumple/scrape and shed excess momentum rather than let the cutout continue its full-speed animation against a stopped body.

## 6. Skill ceiling, accessibility, and the movement-creep admission

A sustained faster gait becomes mandatory tech for anyone optimizing travel. There is no tuning trick that makes it both materially faster and never optimal. The panel should say that out loud.

What can be prevented is **combat mandatory** and **content mandatory**:

- Every required gap, telegraph escape, boss exit, revive route, and progression timer remains solvable at ordinary `MOVE_SPEED` plus the existing normal jump.
- No enemy speed, projectile speed, or lock timing is globally raised to “keep up with sliders.” That would tax novices for experts' power.
- No damage, crit, loot, XP, cooldown, invulnerability, or parry reward scales with chain speed. Faster positioning is already the reward.
- No slide-hop-only pit crossing appears on a mandatory route. Optional shortcuts may exist inside the sub-240 px bound.
- Shared encounter activation and departure cannot be won by the first slider arriving; co-op gates must leave walkers agency.
- The tutorial teaches one forgiving two-beat sentence—Shift, then Space during the visible fold—not a hidden cancel. Input is remappable and the full-retention window spans several ticks.
- An optional hold-to-prime-landing-slide assist may exist, but it should not auto-press hop or steer momentum. If an assist reproduces an infinite perfect chain, the “skill” is merely an accessibility tax and should become the default instead.

Mastery can still live in conserving heading, choosing when not to slide near pits, hitting the retention plateau, and routing through telegraphs without losing aim. Missing the ideal timing should degrade speed, not eat the jump. The technique should make a skilled player faster and riskier, not give them private encounter rules.

The movement-creep stop condition is measurable: if telemetry or mixed-skill co-op tests show that non-sliders take unavoidable hits, miss shared decisions, or spend most fights catching up, cap-and-decay has not contained the feature. Do not respond with enemy inflation. Lower the carry cap/retention or abandon sustained slide-hop.

## 7. Hard guardrails

1. **Named law change:** replace “flat move speed, no sprint layer” with the sole slide-carry exception. Do not leave contradictory comments or cycle-speed tests behind.
2. **One bound:** player-authored carry never exceeds 448 px/s; external impulse is separate and cannot refill carry.
3. **One route ceiling:** a standard slide-hop travels less than 240 px under the shared simulation. The 372 px charged distance jump keeps the long-gap role.
4. **One deterministic source:** server and predictor call the same pure carry/decay/collision step on 50 ms ticks, and authority exposes enough state to rebase mid-chain.
5. **No generic immunity:** slide only avoids explicitly tagged high/overhead attacks. It never touches parry invulnerability or reward channels.
6. **No radius fraud:** walls, enemies, pickups, pits, and ordinary hit tests keep the normal player footprint.
7. **No root laundering:** slide cannot start during committed crouch, distance flight, pound/gather/recovery, level-up freeze, downed state, or another authored root. A forced cancel bumps the existing soft-resync edge.
8. **No homing retaliation:** negotiated leap markers and locked enemy geometry never retarget because the player is fast. Change fair admission or enemy sentence choice instead.
9. **No content tax:** normal-speed players remain the baseline for required routes and dodge budgets; slide-hop creates advantage, never eligibility.
10. **No stacked ground escape:** the queued roll does not ship alongside this v1. Stance 4 belongs to slide unless the team later proves a dedicated binding, controller mapping, and non-stacking combat matrix in playtest.
11. **No accidental pound:** the Space press consumed by slide-hop is suppressed until release. Airborne Space outside that consumed press remains pound.
12. **No invisible profile:** functional ducking requires an explicit high-attack tag and matching altitude tell; otherwise call the pose cosmetic.

## 8. Recommendation and decisions required

**Input recommendation:** grounded Shift keydown plus non-zero movement starts `STANCE_SLIDE`; Space keydown during that stance performs the standard-height slide-hop and carries the bounded momentum. Outside slide, Space stays exactly as shipped—grounded tap on release is normal jump, a 150 ms hold enters the 0.50 s rooted distance charge, and a fresh airborne press is pound. Shift may buffer for two ticks before landing but never creates an air slide. The dodge roll yields; slide, normal jump/pound, and the 372 px distance jump remain.

1. Do you accept removing the queued Shift dodge roll so slide can own the immediate ground-movement edge?
2. Do you want lowered profile to avoid only explicitly authored high/overhead attacks, with no generic projectile immunity or i-frames?
3. Do you accept a bounded mastery gait—prototype cap 448 px/s and sub-240 px standard hop range—even though optimized travel will make slide-hop effectively mandatory for speed-focused players?
