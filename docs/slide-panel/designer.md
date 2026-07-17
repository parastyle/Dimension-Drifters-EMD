# The Slide-Hop — Movement-Feel Designer

Panel: Megabonk-style crouch/slide tech. Role: movement feel. Design only; no source changes and no git operations.

## Design thesis: copy the sentence, not uncontrolled 3D physics

The part worth copying from Megabonk is a four-beat sentence: **commit low and get an immediate speed pop → jump before the slide bleeds out → carry that speed through the hop → touch down low and repeat.** Its default slide input is Ctrl, and community descriptions consistently call out crouch/slide plus repeated landing jumps as the way to preserve or build momentum; players also describe the timing as forgiving when jump and slide are on convenient buttons ([Megabonk Wiki controls](https://megabonk.wiki/wiki/Main_Page), [controller account](https://www.reddit.com/r/MegabonkOfficial/comments/1o8e8vl), [Steam movement-tech account](https://steamcommunity.com/app/3405340/discussions/0/600790523214679178/)). That is the target feel.

The literal 3D implementation cannot be copied honestly. Dimension Drifters has no slopes to feed kinetic energy, no mouse-look air acceleration, a fixed top-down camera, 20 Hz authority, shared co-op encounter pacing, and a synchronized height channel whose gameplay meaning is already pits and ground attacks. This design therefore authors the same input rhythm and momentum ownership, but replaces unbounded slope/strafe acceleration with one deterministic recurrence and a hard ceiling. The player gets a real mastery gait above `MOVE_SPEED`; they do not get infinite acceleration.

## 0. Input ruling and unresolved panel handoff

`docs/slide-panel/devils-advocate.md` did **not** exist at drafting time. My proposal is therefore **Left Ctrl = slide/crouch-tech**, matching Megabonk's default and avoiding the planned roll's Shift key. This is explicitly provisional panel territory: if the advocate assigns Ctrl elsewhere or rules for a shared crouch channel, the input must be reconciled before implementation. Do **not** silently move slide onto Shift; the wave-21b roll is specified to fire on Shift keydown, so “tap Shift = roll / hold Shift = slide” would either delay the reactive roll or fire a roll every time the player wanted to slide.

The input grammar is:

- **Space tap/hold from ordinary grounded movement:** shipped standard jump / 150 ms hold detection into the committed distance-jump crouch. Unchanged.
- **Ctrl while grounded and moving at least 256 px/s:** slide immediately.
- **Space keydown while already sliding:** slide-hop. The active slide disambiguates the gesture, so this path fires on keydown and never waits 150 ms to ask whether the player meant a distance jump.
- **Shift keydown:** planned dodge roll. Separate finger, separate job.
- If Ctrl slide acceptance and the Space hold threshold would occur on the same simulation tick, the stance that was accepted first owns the player. An accepted slide turns that Space edge into a hop; an accepted distance-crouch is committed and ignores Ctrl.

The stance is command-stream state and must be locally predicted/replayed like the shipped jump machine. That is a feel requirement: a 100 ms round-trip before the pose and speed pop would destroy the feature.

---

## 1. THE SLIDE

### 1.1 Entry: low, immediate, committed

A **cold slide** is accepted when all of the following are true on a server tick:

- grounded (`height <= GROUND_EPSILON`), alive, not downed, not in pound recovery, not in the distance-jump crouch, and not inside another authored movement root;
- planar speed is **at least 256 px/s = 0.80 × `MOVE_SPEED 320`**;
- there is a non-zero movement heading; and
- Ctrl is pressed, or was held while landing into the chain law in §2.2.

The cold-slide arm is available by default. Completing/breaking a slide or missing a landing chain disarms another full cold pop until the player has spent **300 ms = 6 ticks** grounded and moving at least 256 px/s. The re-arm is not a displayed cooldown; it is the small run-up that prevents “Ctrl every tick” from being a faster, easier gait than the hop rhythm. A valid chain landing bypasses this re-arm.

On acceptance, the heading locks to current velocity (movement input is the fallback only if synchronized velocity is degenerate), the cutout folds low on the predicted tick, and speed becomes **544 px/s = 1.70 × `MOVE_SPEED`**. No anticipation frame precedes displacement. The first simulated slide step is already the fastest one.

### 1.2 Speed schedule, duration, and distance

Slide speed is a scalar along the slide heading:

`S(k) = S(0) × 0.97^k`, once per 50 ms tick.

For a cold slide, `S(0) = 544`. The ten movement ticks are **544.0, 527.7, 511.8, 496.5, 481.6, 467.2, 453.1, 439.5, 426.4, 413.6 px/s**. A full uncancelled slide lasts **500 ms = 10 ticks**, covers **238.1 px**, and then returns to ordinary movement, normalizing toward 320 with the shipped `MOVE_RECOVER_ACCEL / MOVE_STOP_DECEL = 2600 px/s²` laws.

This is deliberately front-loaded. The first 100 ms covers 53.6 px and gives the hand an unmistakable answer; waiting out the whole slide is still useful displacement, but the speed visibly and audibly drains. The player learns to jump near the front rather than treating Ctrl as a passive crouch toggle.

The slide has **150 ms of ground commitment** against ordinary cancels. Releasing Ctrl during those first three ticks does not retract the move. The slide-hop is the privileged exception: Space pressed in the first 100 ms is buffered and launches at 100 ms, because “slide, then immediately hop” is the signature sentence rather than an evasion cancel.

### 1.3 Steering: a carve, not a second dodge

Held movement may rotate the slide heading by at most **90°/s = 4.5° per tick**. The player can carve around a pack over the half-second, but cannot reverse or snap sideways. Aim remains fully independent; turning the weapon does not turn the slide. Input beyond the steering limit supplies direction only—never extra acceleration—so there is no camera-strafe speed exploit to reproduce in top-down form.

The slide uses the ordinary 24 px player collision circle and the ordinary shared wall/POI/body solver. It cannot pass through enemies, landmarks, walls, or allies. A head-on collision resolves along the existing collision normal and removes the blocked velocity component; if the resulting planar speed falls below 256, the slide and its chain break. Sliding over a pit is a grounded pit fall. These losses are important: route choice and a clean tangent are the skill, not merely alternating two buttons.

### 1.4 The low profile means posture, not protection

The cutout is visibly lower, but its authoritative `PLAYER_RADIUS = 24`, damage tests, projectile tests, melee sectors, and grounded state are **unchanged**. There are:

- no i-frames;
- no damage reduction or armor;
- no smaller collision circle;
- no immunity to contact, beams, projectiles, white attacks, red areas, quakes, pools, or pit falls; and
- no “high attack passes over me” rule in this proposal.

Because the advocate's slide-specific channel ruling was absent, I am making **no hurtbox carve-out**. The low silhouette is postural communication—“this player is committed to speed”—not a free dodge disguised as animation.

### 1.5 What remains legal

- **Fire and melee attack:** allowed. The player keeps aim independence and receives no damage, reach, rate, or knockback bonus from speed. Any attack that already authors a movement root or forced displacement wins and ends the slide.
- **Jump:** allowed only through the slide-hop law in §2.
- **Parry:** always available as an emergency exit, but acceptance cancels the slide, clears chain momentum, and normalizes planar speed toward 320. This preserves parry responsiveness without creating a 465 px/s mobile parry.
- **Dodge roll:** Shift may cash the slide out into the planned roll. The roll starts its own authored schedule, inherits no slide speed, and clears the chain. Spending the defensive cooldown is the price of correcting a greedy line.
- **Grab, salvage, interact, revive, shop:** denied until the slide ends. These are planted actions and must not travel 238 px while resolving.

The slide exits on hop launch; 500 ms expiry; accepted parry/roll/forced-root action; death/down; pit fall; hostile knockback; speed below 256 after collision; or Ctrl release after the 150 ms commitment. Damage without knockback does not mysteriously stand the character up, but it also receives no mitigation.

---

## 2. THE SLIDE-HOP

### 2.1 Launch and the compressed arc

Space keydown during a slide schedules a hop at the first legal tick. The legal window is **100–400 ms after slide start**; a press during ticks 0–1 buffers to tick 2. A press after 400 ms becomes an ordinary buffered jump at slide end and does **not** carry slide momentum. This gives a broad 300 ms execution window while preserving the visible low beat before takeoff.

At launch:

- vertical velocity becomes **285 px/s** and then rides the shipped three-zone gravity unchanged (`1250 / 900 / 2200 px/s²`, apex band 80);
- the resulting continuous arc is approximately **33.5 px apex, 0.47 s airtime, and 371.5 px/s landing speed**; at 20 Hz the authored expectation is **10 airborne ticks = 500 ms**;
- horizontal speed becomes **96% of the slide's current speed** once at liftoff, then keeps that magnitude through the flight unless steering, collision, or hostile displacement reduces it; and
- horizontal heading may rotate by at most **120°/s = 6° per tick** in air. Air input redirects carried momentum; it never adds magnitude.

This hop is intentionally compressed against the standard jump (**285 vs 335 vertical kick, 33.5 vs about 47 px apex, 0.50 vs about 0.55 s tick-level airtime**). It reads as a stone skipping, not a new terrain leap. A cold hop at the ideal 100 ms point leaves the slide at 511.8 px/s, carries **491.4 px/s** into the air, and travels about **245.7 px** during the 500 ms flight. That can improvise a roughly three-tile crossing, but it remains materially shorter and less aimable than the committed distance jump's 372 px / 4.65-tile route tool.

The hop remains a shipped jump in every defensive respect: height clears pits and ground-coupled low attacks, but grants no i-frames and does not escape ordinary 2D melee, projectile, or beam tests.

### 2.2 Landing law: generous inputs, exact ticks

A slide-hop landing opens a **150 ms = 3 tick chain window**. A Ctrl edge in the **100 ms = 2 ticks before landing** is buffered, and held Ctrl counts, so a player may prepare the crouch before contact just as Megabonk players do. If Ctrl is accepted at landing or during the next three ticks, the chain slide restores **95% of the cached landing momentum** and adds a small **72 px/s scrape kick**, capped at the global 544 px/s slide ceiling:

`nextSlideStart = min(544, 0.95 × landingSpeed + 72)`.

The actual grounded velocity may begin obeying ordinary friction while the three-tick window is open; the cached landing value is what the acceptance formula uses. This prevents a one-tick sampling accident from stealing speed. Space has a matching **100 ms pre-landing buffer**: if a fresh Space edge is buffered while Ctrl has armed the landing slide, it launches when that slide reaches its 100 ms minimum. Holding Space does not auto-hop forever; every hop requires a new edge, but the edge may be early.

If the 150 ms chain window expires, the cache is discarded, speed normalizes to at most 320 under the existing 2600 px/s² movement law, the chirp ladder resets, and the full cold pop re-arms only after six grounded run-up ticks. There is no frame-perfect cliff at 149/151 ms: all comparisons are integer tick ages, and the two pre-buffers let intent land on the correct side of the network sample.

### 2.3 Chain math and the new speed economy

Let `T_n` be slide speed immediately before hop `n`. Perfect play spends exactly two ground ticks sliding, loses 4% once at liftoff, retains 95% on the next landing, receives the 72 px/s chain kick, and spends two slide-decay ticks before the next hop:

`T_(n+1) = 0.97² × (0.95 × 0.96 × T_n + 72)`

`T_(n+1) = 0.8581008 × T_n + 67.7448`.

The fixed point is **T = 477.4 px/s before liftoff**. At that fixed point, the landing re-slide starts at 507.4, the two ground ticks cover about 50.0 px, the hop carries 458.3 px/s for about 229.1 px, and the full 600 ms rhythm averages **465.2 px/s = 1.45 × `MOVE_SPEED`**. A cold first cycle is hotter—about **498.8 px/s average**—then converges downward. Repetition cannot increase it beyond the fixed point; only the initial 544 pop is higher.

Timing degrades continuously rather than switching success off:

| Repeated ground rhythm | Takeoff-speed equilibrium | Whole-cycle average | Meaning |
|---|---:|---:|---|
| **2 ticks = 100 ms** | **477.4 px/s** | **465.2 px/s (1.45× walk)** | clean chain |
| **3 ticks = 150 ms** | **392.0 px/s** | **385.6 px/s (1.21×)** | one tick late, still rewarded |
| **4 ticks = 200 ms** | **330.9 px/s** | **329.0 px/s (1.03×)** | two ticks late, advantage nearly gone |
| **5 ticks = 250 ms** | **285.1 px/s** | **286.7 px/s (0.90×)** | sloppy chain is slower than walking |

A single late cycle causes one dip and can recover; the table shows the equilibrium if that timing is repeated. This is the rhythm reward in numerical form. Smooth turns, clean lanes, and two-tick plants sustain speed. Late plants, collisions, reversals, parry, roll, pound, or hostile knockback can only take energy out.

This **explicitly re-prices** the distance-jump panel's “full-cycle speed must remain below `MOVE_SPEED`” philosophy. The distance jump keeps that law because it is a safe, aimed, 372 px terrain bypass with a committed crouch. The slide-hop exists specifically to be a learned locomotion gait, so perfect play is allowed to average 45% above walking. Its payment is ongoing input rhythm, low steering authority, full vulnerability, collision risk, no interaction while sliding, and a hard economy bound: **544 px/s instantaneous, about 491 px/s in the first hop, about 465 px/s sustained over the perfect cycle.** Map guarantees, enemy wind-ups, objective clocks, and mandatory traversal remain tuned for 320; slide-hop is advantage, never admission price.

---

## 3. FEEL

### 3.1 Paper-cutout slide pose

On the acceptance tick, the rig snaps into a **0.62× height / 1.08× width** fold with a **0.14 rad** lean into travel. The forward foot becomes the card's low leading corner; the rear foot and weapon trail along the tangent. The contact shadow widens 12% along motion and compresses 18% across it. There is no slow crouch anticipation—the speed pop and silhouette change arrive together.

The wake is deliberately cheap:

- local player: one pooled material-tinted dust/scuff mote every **100 ms**, at most **5 alive**;
- each visible teammate: one every **200 ms**, at most **2 alive**;
- at speed above **400 px/s**, two short tapered speed lines trail behind the body, never extending ahead of the hurtbox or across a hostile telegraph;
- all slide spectacle sits at or below the established spectacle ceiling (speed-line band no higher than depth 99850), never in the protected telegraph band; and
- reduced-motion mode removes wake animation and speed lines, keeps the low pose and a static ground scuff, and applies no camera motion.

The hop unfolds only partway: a quick 0.90× vertical compression at launch, then a low forward spear pose with feet tucked and the weapon trailing. Its shadow only shrinks to about **0.90×** at apex, versus the stronger standard-jump lift, making the compressed arc readable even in peripheral vision. Landing squashes to **0.76× height for one 50 ms tick**, immediately feeding the next low slide rather than standing fully upright between beats.

### 3.2 Camera: continuous velocity, never per-hop shake

Only the local player's sustained speed drives camera treatment. From **400 to 544 px/s**, blend a velocity envelope from 0 to 1 over **150 ms**:

- zoom out by at most **2.5%**;
- let the camera center trail the player by at most **10 px** opposite velocity with a **90 ms** time constant, putting a little more screen in front of the runner; and
- return zoom/offset over **250 ms** when momentum breaks.

There is **no routine camera shake** on slide start, hop, or chain landing. This verb can repeat every 600 ms; spending the prioritized shake channel at that cadence would fatigue the camera and mask real impacts. The tiny zoom/lag is continuous across hops rather than pulsing each landing, stays beneath boss/hit treatments, never affects remote players' cameras, and is disabled with reduced motion. Belt/room cameras with authored zoom may opt out entirely.

### 3.3 Audio: material scrape, chirp ladder, broken-chain punctuation

The existing movement samples define five floor palettes: `footstep-dust`, `footstep-snow`, `footstep-moss`, `footstep-cinder`, and `footstep-chrome`. Sliding suppresses discrete footsteps and uses matching manifest-ready loops:

- `player-slide-scrape-dust`
- `player-slide-scrape-snow`
- `player-slide-scrape-moss`
- `player-slide-scrape-cinder`
- `player-slide-scrape-chrome`

Each is a seamless **1.0 s**, `loop: true`, one-variation movement entry. Playback rate maps from **0.90 at 320 px/s to 1.15 at 544 px/s**; gain maps from 0.45 to 0.75 of the local movement bus. Start with a 25 ms fade-in, stop with an 80 ms fade-out, and keep remote loops at 40% gain so four players do not become sandpaper noise.

The hop one-shot is `player-slide-hop-chirp` (**0.18 s**, `loop: false`, 2 variations): a paper flick plus a small rising air whistle, lighter than `player-jump`. Successful chains step its pitch **+2 semitones on chains 2 and 3, then cap**. The chain-loss one-shot is `player-slide-chain-break` (**0.20 s**, 2 variations): a dry low scuff with no bass. These IDs are new manifest entries, not aliases for `player-dodge` or `player-roll-whoosh`; defensive whooshes and speed-tech scrapes must not teach the same sound.

### 3.4 How the player knows the chain broke

No combo counter is needed. On loss, four channels agree within the same tick:

1. the scrape pitch falls and fades;
2. the chirp ladder resolves with `player-slide-chain-break` and resets;
3. the two speed lines collapse and the cutout unfolds from 0.62× toward normal; and
4. the camera eases back over 250 ms while the first ordinary material footstep returns.

On successful landing, the opposite happens: the low landing squash flows directly into the 0.62× slide fold, a small forward dust stamp marks contact, and the next hop chirp rises. Momentum is heard and seen as a held phrase; losing it sounds like the phrase ending.

---

## 4. INTERPLAY

### 4.1 Distance-jump crouch: planned route versus kinetic route

Both survive without changing the shipped Space grammar:

- **Hold Space while ordinarily grounded** → after 150 ms, the existing 500 ms committed crouch charges the 620 px/s, 372 px distance jump. It is planned, aimed, taller, and clears a four-tile gap.
- **Ctrl while already moving at least 256** → instant 544 px/s slide; Space during that accepted slide → the lower, roughly 246 px flight. It is kinetic, steer-limited, and needs a run line.

The distance jump therefore remains the reliable four-tile terrain verb and the slide-hop becomes the risky two-to-three-tile improvisation. Starting the distance crouch first is a commitment and blocks slide. Starting the slide first makes Space a hop and can never fall through into a distance charge. The player never waits to discover which move the game chose.

### 4.2 Dodge roll: defense versus speed tech

Keep both, under a strict treaty:

| Verb | Input/job | Protection | Shape | Economy |
|---|---|---|---|---|
| **Roll** | Shift tap; reactive geometry answer | planned 0.25 s contact-test i-frames; no ground-area immunity | 188 px / 0.40 s, heading locked, own vulnerable tail | one charge, 3.0 s cooldown |
| **Slide** | Ctrl while moving; route and momentum mastery | **none** | 238 px / 0.50 s cold slide, steerable carve, can become hop | free only while rhythm/run-up law is met |

The roll cancels bad commitment and spends a defensive resource. The slide creates the commitment and asks the player not to need defense. A slide may cash out into roll, but momentum is discarded and the roll never inherits the 544 cap. A parry likewise ends the chain. This keeps roll as “I read danger late” and slide-hop as “I chose a clean route early.”

If the advocate or combat panel removes the roll's i-frames entirely, I concede the redundancy objection: merge its animation into the slide family or cut the roll. Two grounded displacement buttons distinguished only by distance and cooldown are not worth the input load.

### 4.3 Slide-hop into pound: the intentional cash-out

A grounded slide cannot pound. After the slide-hop rises above the shipped `POUND_MIN_HEIGHT = 24 px`, a second Space edge may trigger the existing pound. Pound zeroes forward velocity exactly as it does for the distance jump, clears the slide chain, and pays its 250 ms recovery. This is a satisfying sentence—**skim → hop → fold → slam**—but never a way to carry 491 px/s through an AoE. The low 33.5 px hop gives a shorter pound-input window than the standard jump; that compact timing is appropriate for an optional flourish.

### 4.4 Cover landmarks: no sliding under in v1

No. Current Cover landmarks are shared circular/compound-circle body blockers and projectile cover; they do not encode an overhead-clearance channel, and large structures explicitly avoid inventing walk-through arches. Lowering only the sprite while passing through those circles would break WYSIWYG collision and prediction. Slide collides exactly like walking.

A future landmark could support under-slide traversal only if its shared metadata, server collision, predictor, art opening, and projectile-cover rules all describe the same high-only span. That is a separate geometry feature, not a benefit smuggled into the player hurtbox, and it is outside this panel while the advocate's channel ruling is absent.

### 4.5 Enemy combos: let speed refuse a frame, then answer the lane honestly

Slide does not null any authored hit. White melee still wants parry; red ground attacks still want jump or position; ordinary 2D strikes still hit the airborne slide-hopper. What speed changes is whether a narrow locked wedge can retain the target after Lock. That is earned counterplay, but the Negotiated Leap needs a high-momentum dialect so a slide-hopper cannot erase the entire tough tier by orbiting at 465 px/s.

Enemy-side answer: when the chosen target is moving above **400 px/s** at the Leap Offer, compute the visible landing ring from a **300 ms velocity lead capped at 140 px**, then freeze it at the existing Lock. The ring and chord show that exact intercept from the first offer tick; there is no mid-air homing. After settle, weight a broad delayed **Gate** opener: a lateral sector across the target's current travel lane with at least **450 ms wind-up**, ordinary Lock timing, and ordinary white/parry language. Because jump has no general i-frames, the hopper must bend early, leave the lane, parry and lose momentum, or roll and spend cooldown. The enemy reads velocity once and negotiates a lane; it never deletes momentum, accelerates offscreen, or tracks after commitment.

Do not give every trash enemy anti-hop cadence. The mastery reward is routing through the horde. The intercept dialect belongs to combo-capable toughs and bosses whose job is to ask for a deliberate answer.

### 4.6 Co-op pacing

At equilibrium a perfect hopper gains about **145 px/s** over a walking teammate—roughly 725 px over five uninterrupted seconds. That is enough to scout, flank, or reach a downed ally, but not enough to cross the 4800 px arena before the squad can react. Co-op rules:

- encounter gates, objective timers, pit guarantees, and tutorial routes remain completable at 320; never require hopping;
- no teammate's slide changes another player's camera, FOV, audio pitch ladder, or movement;
- revive/channel/interact breaks the chain, and downed players cannot slide, so speed helps reach the rescue but does not make the rescue mobile;
- hostile knockback breaks cached momentum rather than feeding it—no co-op explosion-boost economy;
- remote wake and scrape budgets are reduced as in §3, while the full-body low pose remains visible so allies can read who is committed and unlikely to stop; and
- enemy target selection does not automatically punish the fastest player. A hopper who runs 700 px ahead accepts ordinary isolation and aggro risk; the director does not teleport the squad or rubber-band the mover.

The cap is the pacing protection. The team may split because a player chose mastery movement, but content cannot assume the team does so.

---

## Full number table

| Quantity | Final proposal | Tick/economy meaning |
|---|---:|---|
| Simulation tick | **50 ms (20 Hz)** | every window below is integer ticks |
| Proposed input | **Left Ctrl** | provisional: slide advocate file absent; never overload Shift roll |
| Cold entry speed floor | **256 px/s (0.80× 320)** | grounded, non-rooted, non-zero heading |
| Cold arm after a broken chain | **300 ms (6 ticks)** moving at/above 256 | first slide armed by default; valid chain bypasses |
| Cold slide initial speed | **544 px/s (1.70× `MOVE_SPEED`)** | instantaneous acceptance-tick pop |
| Global slide-speed cap | **544 px/s** | no repeated or external stacking beyond it |
| Slide decay | **×0.97 per tick (−3% / 50 ms)** | deterministic scalar decay |
| Cold speed schedule | **544.0, 527.7, 511.8, 496.5, 481.6, 467.2, 453.1, 439.5, 426.4, 413.6 px/s** | ticks 0–9 |
| Full slide duration / distance | **500 ms (10 ticks) / 238.1 px** | uncancelled cold slide |
| Ordinary-cancel commitment | **150 ms (3 ticks)** | hop is privileged at 100 ms |
| Slide steering | **90°/s (4.5°/tick)** | aim independent; no reverse snap |
| Collision/break speed floor | **256 px/s** | blocked component resolved normally; below floor ends chain |
| Slide exit normalization | **2600 px/s² toward max 320** | shipped recovery/stop law |
| Authoritative slide hurtbox | **24 px radius, unchanged** | zero i-frames, armor, shrink, or high-miss channel |
| Slide-hop input window | **100–400 ms after slide start** | early Space buffers to tick 2; later press is non-carry jump |
| Hop vertical kick | **285 px/s** | shipped three-zone gravity unchanged |
| Hop apex / continuous airtime | **≈33.5 px / ≈0.47 s** | compressed vs standard ≈47 px / ≈0.55 s |
| Hop tick-level airtime | **500 ms (10 ticks)** | cadence/math budgeting value |
| Hop landing vertical speed | **≈371.5 px/s** | ordinary landing, no special immunity |
| Horizontal carry at liftoff | **96%** | one-time transfer, then magnitude preserved unless reduced |
| Cold ideal takeoff / air speed | **511.8 / 491.4 px/s** | hop after 100 ms |
| Cold ideal air distance | **≈245.7 px** | 491.4 × 0.50 s; about 3.1 tiles |
| Hop air steering | **120°/s (6°/tick)** | redirects, never accelerates |
| Ctrl pre-landing buffer | **100 ms (2 ticks)** | held Ctrl also arms chain |
| Space pre-landing buffer | **100 ms (2 ticks)** | fresh edge; no auto-hop from holding |
| Post-landing chain window | **150 ms (3 ticks)** | integer tick-age comparison |
| Landing momentum retention | **95%** | applied to cached air landing speed |
| Per-chain scrape kick | **+72 px/s** | before slide decay; capped at 544 |
| Chain re-slide formula | **min(544, 0.95 × landing speed + 72)** | accepted inside landing window |
| Perfect takeoff recurrence | **T′ = 0.8581008T + 67.7448** | includes 96% air carry, 95% landing retention, +72, and 2 decay ticks |
| Perfect takeoff fixed point | **477.4 px/s** | repeated 100 ms ground rhythm |
| Perfect equilibrium slide start | **507.4 px/s** | before two slide-decay ticks |
| Perfect cycle | **100 ms ground + 500 ms air = 600 ms** | about 100 hops/minute |
| Perfect sustained average | **465.2 px/s (1.45× walk)** | ≈50.0 ground px + 229.1 air px per cycle |
| Cold first-cycle average | **≈498.8 px/s (1.56× walk)** | hot opening converges down to 465.2 |
| Repeated 1-tick-late equilibrium | **392.0 takeoff / 385.6 avg px/s (1.21×)** | 150 ms ground, 650 ms cycle |
| Repeated 2-tick-late equilibrium | **330.9 takeoff / 329.0 avg px/s (1.03×)** | 200 ms ground, 700 ms cycle |
| Repeated 3-tick-late equilibrium | **285.1 takeoff / 286.7 avg px/s (0.90×)** | 250 ms ground, slower than walk |
| Slide pose | **0.62× H / 1.08× W / 0.14 rad lean** | acceptance-tick fold |
| Hop landing squash | **0.76× H for 50 ms** | flows into next low fold |
| Local / remote wake cadence | **100 / 200 ms; max 5 / 2 alive** | pooled and visibility-gated |
| Speed-line threshold/count | **>400 px/s / 2 lines** | removed in reduced motion; spectacle depth ≤99850 |
| Camera activation range | **400→544 px/s** | local continuous envelope only |
| Camera zoom / trail | **max 2.5% out / 10 px** | no per-hop shake |
| Camera attack / lag / return | **150 / 90 / 250 ms** | disabled with reduced motion |
| Slide scrape rate | **0.90 at 320 → 1.15 at 544** | per-material 1.0 s loops |
| Slide loop fades | **25 ms in / 80 ms out** | remote gain 40% |
| Hop chirp / chain break lengths | **0.18 / 0.20 s** | 2 variations each |
| Hop chirp ladder | **+2 semitones on chains 2 and 3, then cap** | resets on any chain break |
| Tough high-speed read floor | **400 px/s** | enables honest intercept dialect |
| Negotiated-Leap lead | **300 ms, capped 140 px** | displayed from Offer, frozen at Lock |
| Gate-opener minimum wind-up | **450 ms (9 ticks)** | broad lane answer, never homing |

**The one thing I would cut first if the tech overwhelms the game:** set the **+72 px/s per-landing scrape kick to zero**. The cold slide, low pose, momentum-carry hop, generous buffers, sound, and chain rhythm all survive, but every chain then decays instead of sustaining a 1.45× mastery gait.
