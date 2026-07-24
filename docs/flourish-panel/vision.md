# Weapon Flourishes: the taste contract

## The promise

A Dimension Drifters flourish is punctuation, not an action. It makes the player look delighted to own the
weapon, then gets out of combat's way. The weapon, both floating hands, the body card, feet, and sprung head
perform one readable thought together. A rotating prop over a motionless character fails even if the prop
path is technically impressive.

This panel inherits the pose language's hard truths: no elbows, no root travel, exact two-hand geometry,
aimed-gun height bands, close-blade lunge ownership, dual parity, and the rule that authored action targets
retract before their velocity is returned to the springs. `docs/flourish-panel/OWNER-NOTES.md` is binding.

## The flourish grammar in five lines

1. **DRAW**: the incoming family declares itself immediately - blades arc in from the back, guns spin up
   from the hip, tomes flip open - while the outgoing stow may still be leaving.
2. **STOW**: the old weapon exits fast and characterfully; it never gates, queues, or delays the new draw.
3. **AFTER-ATTACK**: finishing a real sequence earns one signature full-body catch, flip, twirl, or snap;
   continuing combat spends that reward without showing it.
4. **IDLE-SETTLE**: after a true lull, a family may make one small adjustment and become still again; this
   is punctuation, never a looping fidget engine.
5. **LAW**: combat, movement intent, brace, dodge, jump, death, and another swap cancel a flourish at once;
   there is no protected first frame, no input lock, and no flourish queue.

## Taste laws

### Combat never waits

The cancel window is open at flourish time `0 ms` and never closes. A new actionable input is sampled before
the flourish pose writer. At 60 fps no flourish-owned transform may survive more than one rendered frame
(`16.7 ms`) after that input; at 30 fps the ceiling is one frame (`33.4 ms`). Cancellation is based on player
intent, not server acceptance, so a rejected or cooldown-buffered attack still clears the flourish locally.
Cursor drift alone does not cancel a melee flourish, but attack/fire, a new movement onset or hard direction
change, dash, jump, brace/parry, interaction, down/death, and weapon selection do. Steady gait that already
existed when a draw began may continue underneath it; movement never waits, and a new movement decision still
cancels. An aimed family also cancels when renewed aim hold would otherwise fight the flourish.

There is never a recovery tax. Flourish time does not alter cooldowns, `canAct`, hit timing, projectile
direction, movement, collision, or network state. The largest full-motion flourish is `480 ms`; draw is at
most `420 ms`; stow is at most `200 ms`; idle-settle is at most `340 ms`. Those are visual ceilings, not
locks.

### One confident arc

Every rotational flourish has three readable clauses:

- anticipation changes the silhouette for at least `40 ms` before the main rotation;
- the statement is one monotonic, committed arc, normally `270-360 degrees`, with no pause at the top and no
  second revolution;
- the catch passes home by `8-18 degrees`, then returns once.

A weapon that rotates in place at constant speed is a hover-spin and fails. A good flip moves the gripping
hand, counter-hand, body, and head around the arc. Large weapons recruit a foot pivot or paper hop; small
weapons recruit a shoulder/body-card counter-tilt. The authoritative root remains fixed.

### Full-body, paper-body performance

Hands make the path; the mounted weapon makes its business edge legible; the body card supplies weight; feet
confirm the plant; the head reacts last. Head motion is an authored offset into the existing floating-head
spring, never a direct head tween. A draw gets a small head dip, a stow gets a diagonal follow, and a circle
flip gets a follow arc of at most `3.5 px`, inside the shipped `4 px` head-spring ceiling. Helmets, masks, and
head gear therefore inherit the performance.

Body translation stays within `0.05H`, body turn within `0.12 rad`, hand travel within `0.24H`, and a paper
hop within `0.05H`. Feet may shuffle within `0.07H`. These are silhouette accents, not simulated travel.
Two-handed weapons keep both mitten grips geometrically true unless an existing named action already owns a
different grip. A flourish never invents elbows, finger spins, wrist bones, or a detached hand socket.

### Spring handoff

The flourish owns exact authored placement during anticipation and the main statement. During the catch it
first retracts its targets toward the current family/size stance. Only after the grip is within `0.03H` and
the weapon within `0.18 rad` of its next equilibrium may ownership fade. The existing spring then inherits
the bounded terminal velocity and supplies one soft settle. It must not be fed continuous velocity or a new
spring.

On cancellation into an attack, the attack owner takes the hand/weapon channels directly and the hidden
spring state synchronizes to that exact point. On cancellation into locomotion or idle, the family stance
becomes the equilibrium immediately and the existing springs catch it. Neither path runs a cleanup tween.

### Stow and draw overlap

The outgoing weapon is snapshotted as a short-lived stow proxy on the accepted equipment identity edge. The
incoming weapon is attached and begins draw on that same rendered frame. The character's real hand belongs
to the incoming draw; the outgoing proxy completes its path behind the body and is gone within `200 ms`.
That brief overlap is the visual smear of a fast swap, not two equipped weapons. A combat cancel destroys the
proxy immediately.

The old stow may therefore overlap the new draw by `80-160 ms`. It may never put the new draw in a queue. If
new art is still lazy-loading, the stow may finish into empty hands, but loading - not the old animation - is
the only reason the draw can start later.

### Dual pairs alternate

Dual draws, stows, and earned flips are **alternating**, not synchronized. The semantic lead hand starts and
the off hand echoes `45-60 ms` later; stow clears the off hand first and the lead follows. Alternation keeps
two weapon silhouettes separable, honors the shipped lead/off parity, and makes the pair feel faster than a
symmetrical cheerleader motion. Synchronized rotation turns two readable props into one noisy wheel.

Crossfall remains the deliberate both-hand combat exception. Even after Crossfall, the flourish itself
alternates: the hand that will lead the next bar goes first. Mixed pairs retain each hand's own family verb;
they share the body beat but do not impersonate one another.

## The family performances

Timings below are full-motion target durations. Each uses roughly `15%` anticipation, `60%` statement, and
`25%` catch unless the described beat says otherwise. `I` is optional idle-settle.

| Pose family | Draw | Stow | Earned after-attack | Idle-settle |
| --- | --- | --- | --- | --- |
| **1H blade** | `280-320 ms`: grip disappears behind the weapon shoulder, blade draws one bright forward arc, free hand opens opposite the cut. | `140-165 ms`: hilt crosses the ribs; blade leaves behind the shoulder on a shallow reverse arc. | `340-380 ms`: one circle-flip around the weapon hand; free hand closes for the catch, head follows, body overshoots once. | `220 ms`: thumb-less hilt check - grip dips, blade answers, duelist wing reopens. |
| **Close blade / claw** | `220-250 ms`: low reverse-grip scoop from the hip into the existing forward ward. | `125-145 ms`: blade folds under the guarding hand and vanishes low. | `270-310 ms`: compact half-wheel into a reverse catch; the ward never leaves the danger line. | `190 ms`: alternating in/out guard click, never both hands together. |
| **1H blunt** | `300-340 ms`: heavy pendulum up from behind the hip; chest guard tightens before the head clears the body. | `155-180 ms`: tool head drops under its own weight and exits behind the hip. | `310-350 ms`: head falls through one under-palm roll, body checks the weight, chest hand catches the ribs. | `230 ms`: a single weight-test dip and guarded recovery. |
| **Fists / empty hands** | `190-230 ms`: both guards come up asymmetrically, rear then lead, with a small body square-up. | `110-130 ms`: guard folds to the ribs; no theatrical empty-hand spin. | `230-270 ms`: mittens knock once across center, recoil to unequal boxing guard, head gives a tiny nod. | `180 ms`: one lead-hand probe, rear hand stays home. |
| **Pistol** | `250-285 ms`: hand drops to the hip, pistol spins upward through one `270 degree` arc and locks below the face line; free fist catches at sternum. | `135-155 ms`: muzzle tips safe-up, hand cuts to hip, outgoing prop disappears before completing a circle. | `320-350 ms`: after three consecutive accepted shots, one `360 degree` Deadeye twirl with a `12 degree` catch overshoot. | `210 ms`: one chamber-height check with no full rotation. |
| **Fist-gun** | `220-260 ms`: emitting fist rises from ribs while the other guard frames it; no detached gun spin. | `125-145 ms`: emitter folds across the body and the opposite guard covers. | `270-310 ms`: alternating charge shake, cross-body vent, snap back to two-fisted guard. | `200 ms`: one restrained charge pulse. |
| **Long gun / scatter / rapid / launcher** | `300-370 ms`: stock sweeps from the back into shoulder/support line; support mitten clamps before the muzzle settles. | `165-190 ms`: muzzle rises clear, support releases, stock slips behind body. | `290-340 ms`: family-weighted stock check - rapid gun magazine slap, long gun shoulder roll, scatter/launcher deep support re-clamp. No full rifle pinwheel. | `230-280 ms`: one fore-end compression and release. |
| **Thrown implement** | `235-270 ms`: implement rises underhand from belt/back while the spotting mitten is already pointing. | `130-150 ms`: short palm-drop behind the hip. | `330-370 ms`: spotting hand sights the return; implement makes one readable half-turn, lands low, then the hand springs into ready. | `220 ms`: small toss of no more than `0.06H`, immediate catch. |
| **Compact focus** | `255-300 ms`: focus draws from the sleeve/hip through a crescent as the free mitten opens a spell frame. | `135-160 ms`: frame closes over the focus and both fold toward the body. | `300-340 ms`: casting mitten seals one rune circle around a stable focus, then peels away. | `240 ms`: one buoyant frame pulse, no orbit loop. |
| **Tome** | `330-370 ms`: closed book comes up edge-on, flips open once, page hand catches the lower edge, head reads down. | `165-185 ms`: page hand claps the cover and the closed book slips behind the body. | `300-330 ms`: **Last Word** - page hand traces, the book half-claps, one page snaps across, book reopens to its stable chest plane. | `250 ms`: trace then tap, synchronized to the existing page event if one is pending. |
| **2H sword** | `330-420 ms` by size: both grips pull from behind; the rear hand loads leverage before the blade clears. | `175-200 ms`: both hands steer the blade behind the weapon shoulder; the rear hand releases last only after the outgoing proxy owns the exit. | `400-470 ms`: one full-body steering circle, both grips true, front foot pivots, head follows the high quadrant, catch lands in the size stance. | `260-320 ms`: one rear-hand leverage slide and weight settle. |
| **2H heavy** | `365-410 ms`: low haul, visible weight test, rear hand drags the head into ready. | `185-200 ms`: tool head falls behind the body; hands guide rather than toss it. | `390-440 ms`: one haft roll into a low planted catch, with body squash and rear-foot haul. | `280 ms`: downward weight test and lift. |
| **Polearm** | `325-370 ms`: shaft enters from behind as front guide and rear pivot spread along the real haft. | `165-190 ms`: front hand guides the head back while rear hand reels the shaft behind. | `370-410 ms`: one `270 degree` guide/pivot pass; hands slide but never detach or cross accidentally. | `250 ms`: one opposed grip slide. |
| **Beam overlay** | Use the base family's draw; charge may tighten the support hand only after draw has yielded. | Use the base stow and kill beam tremor on frame zero. | Channel end gets the base family's catch with a short stung-hand breakaway; overheat never adds a second spin. | None while charging, channeling, overheated, or cooling. |
| **Dual overlay** | Lead draw, then off echo `50 ms` later; the existing bind ceremony is absorbed into this beat, not stacked on top. | Off exits, then lead `45 ms` later; both gone by `200 ms`. | Each earned hand performs its own family beat, next-lead first, off echo `55 ms` later. Crossfall does not license synchronized flips. | One alternating grip check only; mixed pairs use the quieter of their two beats. |

## Size-true blade stances

Length changes the sentence, not just the sprite scale. The short sword says "ready"; the standard sword
says "measured"; the great sword says "carried"; the colossal sword says "hauled."

The canonical source expected from the parallel katana wave is
`WeaponDef.tags.sizeClass?: "short" | "standard" | "great" | "colossal"`. Today `weapons.ts` exposes
`tags.size: "S" | "M" | "L" | "XL"`, `displayLength`, `gripFrac`, `twoHanded`, and family. Until the richer
field lands, resolve `S -> short`, `M -> standard`, `L -> great`, `XL -> colossal`, with one explicit
migration truth: **Driftblade resolves to `great`, not `colossal`, despite its current `XL` tag**. Once
`tags.sizeClass` exists it wins and the migration override disappears. `displayLength` is a sanity check,
never the primary classifier; painted overhang and gameplay reach make length heuristics untrustworthy.

| Size class | Stable silhouette | Hands, body, and feet | Movement behavior | Combat handoff |
| --- | --- | --- | --- | --- |
| **Short** | Current Driftblade-like quick raised carry: blade forward, `25-40 degrees` high/weapon-side, hilt close to shoulder. This is the wakizashi home. | Compact one- or two-hand grip as authored; open duelist wing; body only `0.02-0.04 rad` side-on; narrow fencing split. | Blade stays high and loses only `5-8 degrees` to gait; hand is comparatively stiff. | Existing attack anticipation takes ownership from nearly-ready geometry; quickest visual handoff. |
| **Standard** | Mid guard: tip forward, `8-22 degrees` high, hilt at mid chest/weapon side. | Ordinary grip spacing; body `0.04-0.06 rad` side-on; balanced lead/rear split. | One bounded `8-12 degree` trail on acceleration, then spring catch. | Forward-ready law remains continuous into attacks. |
| **Great** | **Driftblade's new home:** hilt low beside the body, blade axis `150-165 degrees` away from aim so the tip trails behind like a huge sword. The rear silhouette is the point. | Both grips remain true at `0.38H-0.46H`; body leans `0.06-0.09 rad` into the carried weight; rear foot is visibly planted. | Above `0.2` gait, bias the carried blade toward the reverse movement vector, add `8-14 degrees` of spring lag, and deepen body bob. Optional distance-spaced tip dust may mark the drag rail. | Attack/brace input overrides the rear carry in the same frame and moves directly into the existing anticipation. Raising the blade is presentation inside that action, never pre-action delay. |
| **Colossal** | Near-rear haul: blade axis `165-178 degrees` behind, grip at hip, tip visually pinned to a low drag rail. It should look inconvenient on purpose. | Widest truthful two-hand spacing, body advance up to `0.04H`, deepest visual crouch, rear foot `0.12H` back. No fake one-hand flourish. | Strongest angular lag (`12-18 degrees`), shorter-looking paper stride, one body settle after stopping; actual movement speed is unchanged. | Combat owner cuts directly from haul to authored load. No intermediate "pick it up" lock and no extra hit delay. |

The rear-pointing great/colossal carry is the deliberate size-stance exception to the earlier neutral
weapon-forward law. Business direction becomes forward as soon as attack, brace, or other combat ownership
begins. It must never leak into hit geometry or an aimed gun stance.

The same law extends by physical verb, not by label. Great and colossal mauls keep the head low and drag the
weight while the rear hand hauls; rapiers stay point-forward even when long because length is reach, not
head-mass; polearms increase guide/pivot separation rather than sagging like swords; short guns ride compact
at the hip/chest while long guns widen support spacing; tome size changes the brace and page-hand reach, not
the book's readable open plane.

## Reduced motion and LOD

Reduced motion preserves the semantic endpoint and removes the spectacle:

- no weapon rotation, scale-through-plane flip, hop, dust, cyclic head offset, or idle-settle;
- draw becomes a `100-140 ms` direct placement from a small (`<=0.03H`) family offset;
- stow becomes a `80-110 ms` direct exit/fade with no rotation;
- after-attack becomes a `120-160 ms` catch-to-home only if the action left the weapon displaced;
- body relaxes, hands return to their jobs, and the head follows its ordinary critically damped reduced path.

Outside the existing paper-view LOD, keep only the final size/family stance. Do not simulate or bank a
flourish offscreen, and do not replay it when the rig wakes. Destroy an outgoing stow proxy before LOD sleep.

## The three hero beats

### 1. Driftblade: Horizon Wheel

The terminal combo leaves the great blade low. Both hands keep the hilt true; the front foot turns, the body
leans under the rising steel, and the blade draws one enormous circle around the paper body. The head follows
the high quadrant a beat late. The catch passes the new rear carry by `14 degrees`, breathes through the hand
and head springs, and lands with the tip dragging behind. It is a full-body feat, not a tossed prop.

### 2. Pistol: Three-Count Deadeye

Three accepted shots earn it. After the recoil owner releases and the player declines the next shot, the gun
hand drops a fraction toward the hip, the sternum fist tightens, and the pistol makes one crisp `360 degree`
twirl. The body card counters by `0.05 rad`, the head tracks a tiny opposite arc, and the muzzle locks back
under the face line. With two pistols, each hand earns three; next-lead twirls first and the off hand answers
`55 ms` later.

### 3. Tome: Last Word

The page mitten traces the bottom edge, snaps upward as the book half-claps, and sends one visible page across
the open plane. The body draws tall, the head dips to read the result, and the book reopens with a small
overshoot before the existing page/close scheduler resumes. It feels like finishing a sentence, not shaking
a rectangle.

## Coolness rubric: the acceptance test

The feature ships only if every bar passes.

1. **Gameplay silhouette:** with trails, muzzle flashes, pages, dust, glints, and particles hidden, every
   family draw and after-attack beat reads at gameplay zoom and still reads in a 50%-scale capture.
2. **Full-body causality:** every rotational flourish visibly recruits the weapon hand, the other hand's
   named job, body lean, at least one foot/plant response, and a bounded head-spring response. Weapon-only
   rotation fails.
3. **One-arc confidence:** the unwrapped main rotation is monotonic and no more than one revolution;
   anticipation is at least `40 ms`, catch overshoot is `8-18 degrees`, and there is no hover, pause, or
   constant-speed idle spin.
4. **Zero latency:** the cancel window is open from `0 ms`; actionable input wins before flourish sampling;
   no transform survives beyond one rendered frame and no cooldown, command, or accepted action waits for a
   flourish.
5. **Duration ceiling:** full-motion draw is `<=420 ms`, stow `<=200 ms`, after-attack `<=480 ms`, and
   idle-settle `<=340 ms`. A stow proxy is destroyed by `200 ms` even if the new draw is still active.
6. **Swap overlap:** on an authoritative weapon identity change the new draw begins on the same frame as the
   old stow (or within `16.7 ms` at 60 fps). The old stow may overlap; it may never enqueue the draw.
7. **Combat truth unchanged:** existing swing descriptors, active/impact timing, close-blade reach, two-hand
   grip geometry, `AUTHORED_DUAL_MELEE_BAR`, Crossfall, muzzle direction, face-line/chest caps, root position,
   collision, and server state are byte-for-byte behaviorally unchanged.
8. **Clean spring handoff:** authored targets retract to within `0.03H`/`0.18 rad` before ownership fades;
   release inherits only the existing bounded handoff velocity. No pop, buzz, continuous impulse, or stale
   velocity survives swap, cancel, LOD sleep, down/death, or clock cut.
9. **Earned, not spammed:** melee triggers only on the terminal step of the live sequence; pistol twirl
   requires three consecutive accepted shots per hand; immediate re-engagement discards the armed flourish.
   Idle-settle never loops and cannot occur during charge, aim hold, channel, combo grace, or movement.
10. **Authored-dual clarity:** pre-made dual flourishes alternate by `45-60 ms` and preserve semantic
    lead/off routing from their one weapon definition. Crossfall remains the only deliberate simultaneous
    two-hand combat convergence.
11. **Size truth:** short blades retain the quick raised carry; standard blades hold forward mid guard;
    Driftblade resolves to `great` and visibly tip-drags behind; colossal blades look hauled. Attack input
    overrides rear carry in the same frame.
12. **Reduced-motion dignity:** reduced motion keeps the final stance and a `<=160 ms` settle, with zero
    decorative rotation, hop, dust, cyclic head motion, or idle flourish. It never falls back to limp hands.
