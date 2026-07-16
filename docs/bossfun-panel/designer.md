# Flagship boss instance: Vastaghar, the World-Tread — The Last Crossing

## Decision

Elevate the existing **`world-titan` / Vastaghar, the World-Tread** into the flagship encounter.

Vastaghar is the better foundation than Gorogoth for one complete fight. Gorogoth already covers the broad “largest bullet-heaven boss” space with craters, beams, rings, radial bursts, and adds. Vastaghar has the rarer and more ownable promise: the art is framed at `renderScale: 13` so only the lower body fits, the sliced rig already has a body and four separate feet, and `footfallQuake` already has the game's most interesting boss counter—**jump over the ground hit or parry it**. That can carry an entire encounter if it grows from a single learned beat into a co-op rhythm, an arena-routing problem, and finally a mastery exam.

No new boss render is required. Use the installed `world-titan` body/feet, procedural transforms, the existing painted packs and particle sheets, the exact telegraph renderer, Painted Edge Ribbon, paper-fold/tear motion, and XP Echoes.

This document scopes one top-down arena instance. Belt mode should keep the current World-Titan definition until its lane/depth geometry receives a separate authored pass; do not squeeze this circular, pit-driven encounter into the belt projection.

## The fight in one sentence

> A mountain is walking through the current dimension; the squad learns its step, breaks its stride, turns the collapsing arena against it, survives one final four-foot tread, and brings the whole sheet of reality down with the giant.

The desired first-clear duration is **140–190 seconds** at depth 1, with **two to four earned knockdowns**. A practiced, high-damage squad may clear in 100–130 seconds. A low-damage squad should see more repetitions, not faster attacks or an opaque hard enrage.

## Non-negotiable encounter rules

1. **The foot is the weapon.** Every quake or sweep begins in one authored foot, not in a detached circle.
2. **One major body action at a time.** Vastaghar never blends two contradictory full-body casts. Secondary target circles may appear only during a named sequence's authored recovery.
3. **Phase escalation changes the verb, not just the numbers.** Body speed, base damage, glint lead, and single-step wind-up do not tighten by HP.
4. **White always means parryable.** Dodge-only attacks never borrow a white release flash. The stone cracks keep their material color even when the foot rim and exact timing edge are white.
5. **A successful read creates offense.** Jumping and parrying are not merely damage avoidance; they build a visible Stride Break and earn a real punish window.
6. **The procedural arena matters but never decides the seed.** Pits and POIs change routes and risk. Every seed retains a valid response, and no landmark is allowed to masquerade as quake cover.
7. **The final hit immediately becomes a reward sentence.** Cancel danger, collapse the paper giant, vacuum the XP Echo field, catch the crown, unfold the squad, then open the extraction/rift choice.

## Implementation basis and required encounter seam

The existing authority model is the right base: `BossController` advances deterministic casts at 20 Hz, a primitive computes warning and payload from the same fixed coordinates, resolved rows are observed at `t=1`, and phase/death cancellation removes rows without impact. Preserve all of that.

The current World-Titan definition is not sufficient for the flagship because its phase modules run on independent cooldowns and its `count: 2/3` quake aftershocks resolve simultaneously. This fight needs authored rhythm and recovery. Give Vastaghar a small deterministic **encounter sequencer** that still emits ordinary `CastPlan`s through `BossEmitSink`:

```text
VastagharRuntime {
  phase
  action
  actionStartTick
  deckIndex
  focusPlayerId
  stridePips
  breakEndTick
  destroyedPoiIndexes[2]
  desperationStarted
}
```

All **authoritative gameplay** timings below are multiples of the 50 ms server tick. Client-only paper/VFX envelopes may retain their existing millisecond recipes. The sequencer selects the next card only after the current card's recovery. It may call the existing one-count `footfallQuake`, `landingZone`, `summonAdds`, and active-hazard plumbing; it does not need a parallel damage system.

Synchronize the encounter's frozen scaled max HP (or a normalized authoritative HP fraction) for the boss bar and phase ticks. Looking up the roster's base `hp: 1900` on the client is not sufficient after player-count and depth scaling; a bar clamped at 100% until the boss falls below base HP would hide early progress and make the 70/35/8% plan unreadable.

Heel Reap and Worldwheel need a limb-sweep descriptor derived directly from the `SwingDescriptor` doctrine:

```text
BossLimbSwingDescriptor {
  startTick
  poseSeconds
  activeStartSeconds
  activeEndSeconds
  impactSeconds
  sourcePart
  origin / startAngle / deltaAngle
  innerRange / outerRange / halfWidth
  damage / knockback
  danger
  rearmEveryRadians       // 2π for Worldwheel
}
```

Freeze this descriptor at authoritative action acceptance. Server hit sampling, foot pose, glint, exact moving footprint, Painted Edge Ribbon, audio rise, and recovery all sample the same clock. This is the boss analogue of the accepted melee clock, not a client animation triggered when a patch happens to arrive.

The boss remains planted for every source-rooted wind-up and active sweep. Movement happens only in neutral locomotion or an authored March/Landmark Break path. This preserves the current WYSIWYG plant rule that already protects boss melee.

Replicate one compact boss-action presentation state: `actionSeq`, action id, source-foot index, start/impact/end ticks, captured aim, Focus id, and resolve/cancel edge. Geometry remains in ordinary telegraph rows. The current single-boss client can infer the owner, but it cannot honestly infer which of four feet owns a cast or reconstruct a moving `4π` heel path from a terminal row.

POI destruction likewise needs a synchronized index mask/event. Apply it in the same patch to server collision, client prediction collision, and the renderer's fold. A server-only `destroyedPoiIndexes` array or a client-only cosmetic fold would create invisible collision disagreement.

## Arc at a glance

| Beat | HP / duration | New player verb | Primary content | Emotional turn |
|---|---:|---|---|---|
| Entrance | 0–4.35 s | **Witness, then answer once** | Page tear, 620 ms titan unfold, one generous Crownstep | “That is not scenery. It is attacking.” |
| Phase I — Learn the Weight | 100–70% | **Read → answer → punish** | Crownstep, Heel Reap, Shed Mountain; first earned Stride Break | The giant becomes learnable rather than arbitrary. |
| Phase II — Break the Stride | 70–35% | **Route → bait → break** | Threefold March, Landmark Break, evolving POI lanes, pit routes | The squad starts controlling where the giant walks. |
| Phase III — Under the Heel | 35–8% | **Relay → rescue → control** | Twin Tread, Worldwheel, one authored add wave | Different players solve different pressure at the same time. |
| Desperation — Final Tread | 8–0% | **Keep the beat or interrupt it** | Four-foot cadence into Worldbreak | Vastaghar spends the last of its body on one impossible step. |
| Kill / reward | 0–0.90 s | **Claim** | Paper collapse, quake/void/nuke punctuation, XP crown and cleanup vacuum | The fight stops cleanly and becomes treasure. |

## Encounter-space setup

The fight remains in the run's generated 4,800 × 4,800 arena. It does not teleport the squad to a bespoke map or raise an invisible circular wall.

On boss spawn:

- Stop new horde pressure. Retire remaining ordinary trash through the existing muted-removal path so it pays no XP and does not create a corpse storm. Vastaghar's authored adds are the only non-boss enemies until death.
- Use the boss's safe spawn as the encounter anchor. Survey a **1,100 px interest radius** for nearby pits and POIs; this is an attack-selection region, not a leash.
- Choose at most **two intact POIs**, preferably in different quadrants and 320–760 px from the anchor, as Landmark Break candidates. Store their stable map indexes. If the seed offers fewer, the card falls back to a ground charge without destruction.
- Prefer one hoppable pit edge within 900 px as a routing feature, but never create a new pit. The encounter is fully solvable on a flat seed.
- Ordinary camera following remains. Do not hard-center or zoom-lock co-op players away from their own bodies.

### Pits

- A pit does **not** block a quake. Exact quake edges and cracks draw across it, so there is no false “the void is cover” read.
- Jumping a narrow pit gap while a quake resolves is a high-expression double answer: the same airborne state clears both hazards.
- Vastaghar remains pit-immune, as the current boss rule requires.
- Adds may be knocked into pits for immediate control and no XP. That is an intentional choice: safe space now versus a collectible later.
- No card intentionally centers a high-knockback landing circle within 120 px of a downed ally during their mercy window.

### POIs

- POIs block players and ordinary projectiles until destroyed. They never block quakes or Vastaghar's body.
- Landmark Break clearly targets an intact POI. On resolve, reverse its existing bottom-hinge pop-up over **220 ms**, tear/fold its visible sheet, and remove its collider on the same authoritative event. A cosmetic fold with an invisible surviving collider is forbidden.
- Destroy no more than two POIs in the fight. Each destruction opens a route; deleting the whole arena would erase positioning instead of evolving it.
- The exact attack rails remain visible over/around the landmark. The POI art is spectacle, not the hitbox.

### Anti-kite rule

If every living drifter stays more than **900 px** from Vastaghar for **2.00 s**, the next eligible card is Threefold March. There is no teleport, invisible leash, or off-screen unavoidable hit. The giant simply walks the fight back into view.

## Core counter loop: Stride Break

Display **three cracked-stone pips** beneath the boss bar. These are posture, not another health bar.

At each parryable boss impact, evaluate only living players actually threatened by that footprint:

- At least half of threatened players avoid it by jump or parry: **+1 pip**.
- At least one threatened player parries: **+1 bonus pip**.
- Nobody threatened, or fewer than half answer correctly: **0 pips**.
- Clamp to three. One perfect solo parry therefore gives two; a solo jump gives one. In co-op, the squad earns the result together rather than farming one pip per body.

At three pips, finish the current resolve, cancel any queued secondary, and enter **Stride Break**:

- duration: **3.20 s**;
- boss movement and contact damage: off;
- body pose: one inner foot buckles, opposite feet splay, body folds to `scaleY 0.86` and holds;
- incoming player damage: **×1.20**;
- boss source telegraphs: none;
- recovery tell: feet replant during the last **0.45 s**, with a dark stone inhale but no danger edge.

Reset pips when the boss stands. Do not reduce break duration in later phases. Escalation comes from earning the window under harder patterns.

This is where player melee systems get to sing. Vastaghar's 230 px body makes edge contact reliable, Painted Edge Ribbons remain legible against the collapsed silhouette, and multi-revolution spin weapons legitimately re-arm their hit set every completed `2π`. A two-turn whirlwind should damage twice during the knockdown. Do not special-case the boss back to one hit per button press.

Vastaghar's mass converts boss-parry knockback into Stride pips and a source-foot recoil; never displace the 230 px boss body with the ordinary enemy parry shove. Footfall parries negate, flash, sound, and score Stride but do not feed the close-melee heal chain. Heel Reap and Worldwheel are true melee contacts: they may refresh/feed the standard parry chain and player launch, but still convert the attacker's positional knockback into Stride/recoil.

## Focus, aggro, and co-op roles

Vastaghar chooses a **Focus** player between cards and locks that target through Claim, active, and recovery. Never retarget a planted foot halfway through a warning.

Use a bounded score rather than nearest-only targeting:

| Factor | Score |
|---|---:|
| Current focus survives into the next selection | +40 |
| Recent boss-damage share over 4 s | 0–35 |
| Parried the most recent titan impact | +25 |
| Proximity, linear from 720 px to contact | 0–30 |
| Inside a fresh downed ally's mercy bubble | −100 |

Ties resolve by stable session id. The attacking foot's weight shift and source-facing identify the Focus; do not add a raid-style overhead marker unless playtests cannot read the body.

This produces soft roles without class locks:

- **Anchor:** stays readable near the front feet, baits March/Landmark lines away from a downed ally, and often earns Focus through parries.
- **Breaker:** commits melee, especially spins and heavy finishers, during the 3.20 s collapse.
- **Cleaner:** removes the one authored mote wave or knocks it into pits while the Anchor keeps the foot cadence stable.
- **Rescuer:** reaches the fallen body with a REZ weapon's existing 96 px range and answers any crossing quake rather than receiving a free immunity bubble.

On down:

- Vastaghar never selects the downed body.
- For **2.50 s**, no new target-space landing circle may be centered within **180 px** of that body.
- Source-centered quakes and already-committed geometry still resolve. The rescuer must use the same jump/parry language as everyone else.
- If only one drifter remains alive, suppress new add waves and schedule Crownstep next, followed by its full 0.95 s recovery. Do not reduce damage or make the boss inert; give the clutch player one clean read.

## Attack cards

Damage values below are base values before the existing depth multiplier. Player-count scaling remains HP-only. All parry glints begin **150 ms / three server ticks** before the relevant contact. The parry buffer is 200 ms, so the glint is an actionable crest, not a decorative after-flash.

### 1. Crownstep — the fundamental footfall

- **Use:** entrance tutorial, Phase I bread-and-butter, solo-clutch reset.
- **Clock:** 1.05 s wind-up → instant quake resolve → 0.95 s recovery.
- **Geometry:** circle centered on the selected planted foot, radius **360 px**.
- **Payload:** `footfallQuake`, damage **24**, knockback **900**.
- **Response:** jump or parry inside the circle; walking out is valid if already near the edge.
- **Pose:** chosen foot rises 0.18 body-heights; the body shifts 0.10 body-heights onto the support feet; all gait stops. The foot drops vertically, never slides across its fixed warning.
- **Punish:** full recovery is safe offense; correct answers feed Stride Break.

The first Crownstep of the instance uses a **1.20 s** wind-up and **1.15 s** recovery. All later Crownsteps use the standard clock.

### 2. Heel Reap — close-range melee test

- **Use:** Phase I establishes that not every foot attack is a circle.
- **Clock:** 0.80 s anticipation → 0.45 s active sweep → 0.65 s planted recovery.
- **Geometry:** a **2.20 rad** swept capsule from inner radius **220 px** to outer radius **520 px**, half-width **34 px**.
- **Payload:** damage **20**, knockback **520**, once per player for the action.
- **Response:** leave the swept side, cross behind the planted leg, or parry the heel at contact.
- **Pose:** the rear outer foot draws back; the body counter-leans like the iconic heavy smash anticipation; the heel then leads hand/body-equivalent motion through the path.
- **VFX:** steel/stone Painted Edge Ribbon retains only the latest **0.60 rad**. The narrow ADD lip exists only while the exact heel capsule is active.
- **Punish:** 0.65 s at the finished side; parry adds the bonus Stride pip.

This is not an instant cone. Server sampling and the moving exact footprint must follow the same limb descriptor as the ribbon.

### 3. Shed Mountain — target-space movement pressure

- **Use:** stops the squad from standing permanently at one ankle.
- **Clock:** 1.00 s wind-up → simultaneous landings → 0.65 s recovery.
- **Geometry:** one circle on the Focus player plus one on the least-recently-targeted living player in co-op; maximum **two**, radius **155 px**.
- **Payload:** ordinary dodge-only landing zones, damage **20**, knockback **650**.
- **Response:** relocate; these are not jump/parry counters.
- **Pose:** Vastaghar's off-screen mass shudders; all four feet brace. Stone motes fall from the top of the camera toward the fixed circles.
- **Fairness:** muted vermilion broken edges from Claim; quake cracks remain absent; no white foot rim or white resolve flash.
- **Punish:** ranged-safe pressure only. The boss does not move during the cast.

### 4. Threefold March — the Phase II rhythm

- **Use:** routing, anti-kite, and jump/parry cadence.
- **Clock:** first impact at **0.95 s**, then impacts at **1.70 s** and **2.45 s**; 1.15 s recovery after the third.
- **Geometry:** three fixed foot circles, radius **340 px**, laid along a locked heading. Centers advance **150 px** per step. Show all three perimeters at Claim; only the current step carries the strong inward cadence.
- **Payload per step:** quake damage **22**, knockback **850**.
- **Response:** jump/parry on a **0.75 s** beat. This deliberately clears the 0.70 s jump cooldown and 0.60 s parry cooldown without demanding frame-perfect chaining.
- **Pose:** alternate outer-left → outer-right → inner/front foot according to facing. The body root advances with collision-safe authoritative movement; each foot still plants on its precomputed center.
- **Arena use:** a hoppable pit crossing is a desirable route, not a requirement. An unhopppable pit never becomes the only path to the next footprint.
- **Punish:** the 1.15 s exhausted plant is the largest non-break opening in Phase II.

### 5. Landmark Break — make the giant change the room

- **Use:** Phase II, at most twice per fight.
- **Selection:** choose an intact marked POI roughly between Vastaghar and Focus. If none is valid, run the same charge to a clear, safe-spawn-adjusted endpoint without POI destruction.
- **Clock:** 1.15 s wind-up → 0.50 s charge → 1.25 s recovery.
- **Geometry:** exact dodge-only rails from boss to endpoint, length **320–620 px**, half-width **135 px**.
- **Payload:** active lane damage **24**, knockback **720**. The current implementation treats the full lane as dangerous throughout a dash, so the underlay must tell that truth unless hit authority is changed to a traveling capsule.
- **Response:** leave the rails; do not parry.
- **Pose:** outer feet splay, inner feet compress, body pitches backward, then drives through the line.
- **World:** dust pulls toward the source during Load. The target POI folds flat and tears only on resolve.
- **Fairness:** no white glint. The far end cap remains visible even behind the landmark.

### 6. Twin Tread — co-op relay

- **Use:** Phase III opener and recurring pressure.
- **Clock:** left/front impact at **1.00 s**, right/front impact at **1.75 s**, then 1.00 s recovery.
- **Geometry:** two fixed circles of radius **350 px**, centers separated by **260–380 px** according to the four-foot pose. Both appear from Claim; each has its own 150 ms glint and current-step cadence.
- **Payload per step:** quake damage **24**, knockback **900**.
- **Response:** one player may parry the near step while another jumps the far step; squad success is scored independently for each impact.
- **Pose:** weight visibly transfers across the lower body. The second foot may not begin lowering until the first has visibly contacted.
- **Punish:** short safe pocket between impacts is movement time, not DPS time; the full 1.00 s recovery is offense.

### 7. Worldwheel — the iconic Phase III melee move

Worldwheel adapts the charged one-revolution hero-spin language into a titan pivot with **two authored revolutions**. It is not a persistent circular AoE.

- **Clock:** 1.05 s charge → 1.50 s active (0.75 s per revolution) → 0.75 s recovery.
- **Geometry:** the leading outer foot sweeps from inner radius **230 px** to outer radius **590 px**, half-width **38 px**, `deltaAngle: 4π`.
- **Payload:** damage **16** and knockback **380** per revolution. Clear the per-player hit set exactly when signed angular travel crosses each completed `2π`—the same WYSIWYG rule as player spin damage.
- **Response:** retreat beyond 590 px, thread behind the moving heel, or parry each passing contact. A single parry does not null the second revolution.
- **Anticipation:** body tucks, outer feet draw inward, and the planted pair compress. The complete future annular path is shown as a dim forecast, not as current danger.
- **Active truth:** one exact moving capsule and one recent Painted Edge Ribbon segment travel with the heel. Do not light the full donut as though it all hurts simultaneously.
- **Paper motion:** body and feet turn through signed scale, crossing edge-on each half-revolution; depth swaps happen only at the zero crossing. The grounded shadow stays broad and does not spin like a coin.
- **Parry cue:** a white rim/glint lives on the leading heel and reaches any angular contact **150 ms** before it. The traveling exact capsule uses the same white inward rhythm. Stone dust remains brown/gray.
- **Punish:** the body overshoots 0.12 rad, feet skid, and all four parts hold a readable positive-facing recovery for 0.75 s.

### 8. Final Tread / Worldbreak — the desperation sequence

At 8% HP, cancel the current card and begin this sequence after a 0.60 s breath. Vastaghar remains damageable. A high-output squad may interrupt the Final Tread by killing the boss; death cancellation removes every unfinished footprint and produces no phantom quake.

Show all planned circles immediately, with the current one strongest:

| Contact | Time from sequence start | Source | Radius | Damage | Knockback |
|---|---:|---|---:|---:|---:|
| 1 | 1.10 s | outer-left foot | 350 | 22 | 850 |
| 2 | 1.85 s | outer-right foot | 350 | 22 | 850 |
| 3 | 2.60 s | inner-left foot | 350 | 22 | 850 |
| 4 | 3.35 s | inner-right foot | 350 | 22 | 850 |
| Worldbreak | 4.45 s | full body/foot cluster | 960 | 26 | 1,000 |

Every contact is jumpable/parryable and has its own source-part glint from `−0.15 s` to impact. The 0.75 s cadence is identical to Threefold March; desperation tests mastery instead of secretly changing the rules.

Worldbreak's full exact perimeter appears at 3.35 s, giving a 1.10 s final decision. All four feet rise only after their individual steps have landed; the body then folds upward against gravity and crashes flat. Resolve uses the nuke-tier **quake-burst**, not the `nuke` pack reserved for death.

If Vastaghar survives, hold a **1.40 s** collapsed recovery and then return to Twin Tread → Worldwheel. Do not loop Final Tread back-to-back.

## Phase script

### Entrance spectacle — 0.00 to 4.35 s

1. **0.00–0.13:** two dark screen-paper halves tear apart by 34 px. Input remains active; this is a reveal, not a cutscene.
2. **0.13–0.75:** Vastaghar unfolds with the colossus 620 ms two-piece bottom-hinge treatment. Lower feet rise first; body crosses edge-on 110 ms later. The existing permanent lower-body frame keeps the torso beyond the top of the picture.
3. **0.44:** at the upper crop's zero crossing, play one `quake-burst` at the spawn point, a 700 ms/0.020 camera quake, and the intro AudioBus stinger. This is non-damaging.
4. **0.80:** title strip: `VASTAGHAR, THE WORLD-TREAD` and subtitle `THE LAST CROSSING`.
5. **1.45:** compact teaching strip: `JUMP or PARRY the WHITE footfall`. It never replaces the foot/edge language.
6. **2.00:** begin the tutorial Crownstep with 1.20 s wind-up.
7. **3.20:** first authoritative quake. The boss has been damageable since 0.75 s; there is no intro HP shield.
8. **4.35:** the tutorial's 1.15 s recovery ends and Phase I deck begins.

### Phase I — Learn the Weight, 100–70%

Fixed deck:

```text
Crownstep → 0.55 neutral → Heel Reap → 0.55 neutral
→ Shed Mountain → 0.70 neutral → repeat
```

The verb is **answer, then punish**. Crownstep teaches the binary response, Heel Reap transfers the white language to moving melee, and Shed Mountain proves that a red target-space attack must be dodged instead. Vastaghar chases at its existing 40 px/s only during neutral periods; `speedMult` remains 1.

The phase should normally produce the first Stride Break. If the party reaches 70% without earning one, the transition begins with one standard Crownstep before the spectacle, giving another readable chance rather than awarding a free knockdown.

### 70% transition — The Stuck Step, 1.65 s

Cancel unresolved casts. Vastaghar's leading foot catches beside the first marked POI or in bare ground. Reverse-fold that landmark if present, but do not damage players. The body pitches forward, holds edge-on for 80 ms, then tears the route open. Use one `quake-burst` pack at resolve and a dedicated phase stinger. The boss remains damageable throughout.

### Phase II — Break the Stride, 70–35%

Authored deck:

```text
Threefold March → 0.75 neutral
→ Landmark Break (if available; else Heel Reap) → 0.65 neutral
→ Shed Mountain → 0.70 neutral → repeat
```

The verb is **route, bait, break**. The three-step rhythm invites deliberate pit hops. Focus control lets an Anchor point the March away from a rescue. Landmark Break removes one familiar piece of cover and creates a wider punish lane. This is new spatial work, not Phase I with a shorter cooldown.

Do not add bullet fans here. Parryable slugs would compete with the far more important white foot glint and dilute the encounter's identity.

### 35% transition — Turn the World, 2.25 s

Vastaghar plants the inner feet and performs one slow, non-damaging through-plane half-turn. At edge-on, depth-swap the feet/body and use a restrained `void-implosion` to pull dust inward. Tear **`min(livingPlayers + 1, 4)` mote-swarm adds** from the folded scraps or four ground markers. Their point warnings resolve only after the boss is broadside again.

This wave is authored once. A second wave may occur at 18% only if every authored add is dead and at least 20 s have elapsed; it is never a six-second add faucet.

### Phase III — Under the Heel, 35–8%

Deck:

```text
Twin Tread → 0.60 neutral → Worldwheel → 0.90 neutral
→ Shed Mountain → 0.70 neutral → repeat
```

The verb is **relay, rescue, control**. Twin Tread asks the squad to answer two places. Worldwheel creates a moving white melee problem while Cleaners manage the small add wave. Shed Mountain forces a new formation after the spin rather than allowing everyone to remain stacked on the break point.

No timings or base damages accelerate. The pressure rises because the team has simultaneous jobs and a changed arena.

### Desperation — Final Tread, 8–0%

Music drops out for 0.60 s, dust hangs, and each foot tightens toward the body. Run Final Tread/Worldbreak exactly as specified. The boss remains killable. If the party interrupts it, the loaded feet buckle into the death rather than completing the attack. If it resolves, the 1.40 s collapse is the best final damage window in the fight.

## Telegraph and parry-glint matrix

| Attack | Response class | Attacker wind-up | Painted foreshadow | Exact fairness carrier | Parry moment / resolve |
|---|---|---|---|---|---|
| Crownstep | White: jump or parry | One named foot rises; body loads support side | Dust inhales, pebbles lift, quake crack grows under foot | Full 360 px circle from Claim; inward white cadence | Foot sole/rim glints for final 150 ms; quake at `t=1` |
| Heel Reap | White: evade or parry | Heel draws back, body counter-leans | Dust pulled opposite sweep | Dim future path during wind-up; exact moving capsule active | Leading heel and ribbon lip turn white 150 ms before contact |
| Shed Mountain | Dodge-only | Whole lower body braces under falling mass | Sparse stone motes descend into target points | Full 155 px broken vermilion circles | Stone-colored resolve only; never white |
| Threefold March | White sequence | Feet visibly alternate; next foot lifts only after prior contact | Three fixed crack beds, current one energized | All circles visible; one current inward cadence | Separate 150 ms glint on each named foot |
| Landmark Break | Dodge-only | Four-foot launch brace and backward mass shift | Dust pulls toward source; POI hinge strains | Two exact lane rails and far cap | Warm/stone launch flash; no white |
| Twin Tread | White sequence | Weight transfers left to right | Two crack beds with separate cadence | Both exact circles from Claim | Each foot owns its own 150 ms glint |
| Worldwheel | White moving melee | Charged tuck and planted inner feet | Circular dust draw; no early impact pack | Dim path forecast, then one exact moving capsule | Traveling heel glint/contact notch; once per revolution |
| Final Tread | White mastery sequence | All four feet author a readable order | Five crack beds; Worldbreak inhales the arena | Every future perimeter from sequence start | Five source/edge glints on the learned 150 ms rule |

The attacking foot is the “weapon” for glint purposes. Never whiten Vastaghar's entire body. If the relevant foot is occluded, retain a compact foot-anchored bracket and the exact inward cadence; do not promote the floor fill back to primary.

## Paper-cutout spectacle plan

Paper motion is reserved for state changes, not sprayed onto every hit.

| Beat | Paper treatment | Existing material used | Gameplay relationship |
|---|---|---|---|
| Arrival | 620 ms two-piece boss unfold behind torn screen halves | Existing body + four feet | Non-damaging; tutorial starts after broadside read |
| Landmark Break | Reverse 220 ms bottom-hinge fold, then two scrap flutters | Existing POI image | Collider disappears on the same authoritative event |
| 70% | Foot catches; body pitches through a brief edge-on crease | Existing rig parts | No attack hidden in transition |
| 35% | One slow through-plane half-turn with depth swap at zero | Existing rig parts | Add markers wait for broadside completion |
| Worldwheel | Signed scale through zero each half-revolution | Existing body/feet | Descriptor angle remains damage authority |
| Successful Stride Break | Buckle and folded hold, not rubber squash | Existing rig parts/shadow | Exactly matches 3.20 s punish window |
| Death | Four-foot accordion collapse, body two-piece tear | Existing boss death/tear vocabulary | All danger has already been cancelled |
| Squad restore | Downed rigs reverse-unfold at existing 30% revive fraction | Existing player rigs | Post-clear celebration only |

Do not add beige paper overlays. Planarity, hinges, edge-on swaps, crop seams, and flutter communicate paper while preserving the dimension palette.

## VFX spectacle and budget

### Repeated combat

- Telegraph anticipation uses the retained pool: one quake crack or source core per row, plus milestone particles at `t=.30/.65/.90`.
- Ordinary Crownstep/Twin/March impacts use procedural exact rings, dust, and at most one `quake-burst` call per impact frame. The 0.75 s sequence spacing naturally avoids pack-frame collisions.
- Heel Reap and Worldwheel use Painted Edge Ribbon. NORMAL paint carries mass; the ADD lip is narrow, white only for the parryable live edge, and absent outside the descriptor's active interval.
- Shed Mountain uses small steel/stone shards and the standard impact explosion. Do not spend `nuke` or `void-implosion` on routine circles.
- Post-impact cracks may remain visually for **2.00 s**, but lose every danger cadence at resolve. They are scars, not lingering damage.

### Hero beats

1. **Arrival zero-crossing:** one `quake-burst`, radius driver 280; no `nuke`.
2. **70% landmark break:** one `quake-burst`, radius 220.
3. **35% world turn:** one `void-implosion`, radius 230.
4. **Worldbreak:** one `quake-burst`, radius 280, plus the exact 960 px procedural ring.
5. **Death:** stagger packs across frames—`quake-burst` at 0 ms, `void-implosion` at 160 ms, `nuke` at 330 ms. Never start all three in one render frame.

The composer caps full pack starts at ten per frame and clamps its radius tier. These choices stay far below that cap and preserve the pack semantics: quake is ground failure, void is dimensional pull, nuke is the one final impossible release.

### Death composition — 0 to 900 ms

- **0–80 ms:** final hit-stop presentation; all telegraphs, active hazards, contact damage, and add attacks are cancelled server-side.
- **80–240 ms:** feet buckle outer-to-inner; ground shadow spreads to `1.30x / 0.68y`; `quake-burst` fires.
- **160 ms:** `void-implosion` pulls dust and loose scraps toward the body, explaining the coming tear.
- **240–520 ms:** body crop splits at its broadest seam; the two halves cross edge-on and peel in opposite directions. Feet remain planted long enough to sell weight.
- **330 ms:** one `nuke` pack blooms behind the paper halves. The NORMAL smoke/debris remains behind the readable silhouette; additive core/rings crest for less than 300 ms.
- **520–900 ms:** parts flutter down/out, camera shake decays, XP crown becomes the brightest stable object in the scene.

## Music and AudioBus score

The current `AudioBus` is a safe procedural one-shot synth with spatial pan, throttling, a 24-voice cap, and existing `bossslam`, `parry`, `revive`, `loot`, and `extract` recipes. Keep every sound in that bus so volume/mute and browser recovery remain coherent.

Add a small boss-music layer inside `AudioBus`, not scene-owned oscillators. Reserve at most **four music voices**, route them through a `bossMusicGain`, and let combat SFX keep priority.

### Music states

| State | Pulse | Arrangement | Transition |
|---|---:|---|---|
| Entrance | free time | 48 Hz drone, distant filtered paper/stone noise | Start at page tear; duck 6 dB for first quake |
| Phase I | 60 BPM | Low pulse on beats 1/3, one dry high tick on 4 | Enter after tutorial recovery |
| Phase II | 80 BPM | Step pulse every 0.75 s, alternating stereo feet | Phase stinger lands on the first March Claim |
| Phase III | 80 BPM | Same tempo, add offbeat 120 Hz tom and thin dissonant fifth | Complexity rises without a cheap tempo multiplier |
| Final Tread | no bed for 0.60 s, then 80 BPM | The five real foot contacts are the percussion | Music never obscures the learned impact timing |
| Death | stop pulse at authoritative death | 90 ms near-silence → falling 55–28 Hz body tone → ascending clear chord | Reward pings enter only when XP begins catching |

### Event recipes

| Event | Audio behavior | Rule |
|---|---|---|
| `boss:titan:intro` | 52→30 Hz sine over 0.9 s + 110 Hz filtered noise | Once, non-spatial center weight |
| `boss:titan:lift` | Quiet 85→130 Hz strain + inward dust noise | Claim only; throttle 300 ms |
| `boss:titan:glint` | Short 900→1,350 Hz triangle, low gain | Exactly 150 ms before valid parry contact; distinct from success |
| `boss:titan:step` | Extend `bossslam`: 52→26 Hz + low noise, panned to foot x | One per authoritative resolve |
| existing `parry` | Crisp 1,400/2,100 Hz response | Success only; never on glint |
| `boss:titan:phase` | Descending minor third then one upward fifth | 70% and 35%, once from server phase edge |
| `boss:titan:break` | Stone crack followed by 220 ms low release | Three-pip collapse |
| `boss:titan:death` | 45→22 Hz body fall, paper-noise tear, delayed clear fifth | Once on death, not row removal |

Spatialize foot lifts/steps by their world x. Do not pan the music bed. Duck the bed 4–6 dB for Worldbreak, successful Stride Break, death, and the first boss XP crown catch.

## Kill, XP Echo, loot, and celebration

The current boss is worth **110 XP**, already a top-tier `36+` Echo crown. Preserve that value and the one-physical-collector/squad-wide grant rule.

On authoritative death:

1. `damageEnemy` creates the 110-value Echo at the exact boss corpse position before the body row disappears.
2. Replace the immediate normal-arena `openPortal` with `beginXpBoundary("boss-clear")`. Freeze new pressure and keep the stored death position for the eventual gates/loot.
3. Let the crown complete its tier-4 **380 ms** pop/arm read. Existing field Echoes begin value-descending cleanup launches, up to six per tick.
4. The crown flies to the nearest eligible living drifter over the existing **240–520 ms** distance clock. Every client sees the same collector; all players, including downed players, receive the XP on contact.
5. Catch tick owns the chest halo, rising `loot`/XP pitch, `+110 XP` aggregation, bar pulse, and any level-up folio. Nothing advances early.
6. At **650 ms maximum**, fold any cleanup tail into the final visible packet, catch it, and complete `boss-clear`.
7. On boundary completion, unfold every downed squadmate at `REVIVE_HP_FRAC = 0.30`. This is post-encounter restoration, not a substitute for mid-fight rez: if the last living player falls before the kill, the squad still wipes.
8. Drop the existing guaranteed boss-tier loot at the corpse and let its page-flip shimmer become visible as the `nuke` smoke clears.
9. Pay the existing `5 × depth` carried-salvage wage, then open the amber extraction portal and violet deeper rift at/near the death point.

Do not spend a component FX pack on the Echo. Its painted arcane orb/motes, analytic hook/spiral, catch ring, and AudioBus pitch stream are already the correct reward language. Combat-scale lightning or mushroom clouds would make the prize look dangerous.

The end frame should contain, in descending salience: living/revived squad, the caught XP pulse, the guaranteed flipping loot, then the two greed gates. The dead boss art and smoke are already receding.

## Tuning locks

- Phase thresholds: **70%, 35%, 8%**.
- Body speed multiplier: **1.00 in every phase**.
- Parry glint lead: **150 ms everywhere**.
- Rhythmic step separation: **750 ms everywhere**.
- Stride Break: **3 pips, 3.20 s, ×1.20 damage**.
- Full authored add waves: at 35%; optional one at 18% under the stated clear/time conditions.
- Max encounter adds: **4**, regardless of the global cap of 12.
- Max destroyed POIs: **2**.
- Max simultaneous target-space landing circles: **2**.
- No random selection may repeat the same major card twice; the flagship deck is authored, with only conditional Landmark fallback.
- No full FX pack in anticipation. Full packs are resolve/state punctuation only.

## Ship gates and playtest questions

### Authority and fairness

- Capture every card at Claim, Load, Lock, `−150 ms`, resolve, first active frame, active end, and recovery at 0/100/200 ms simulated RTT.
- A late patch samples the current descriptor phase; it never restarts a foot lift at zero or extends the hit.
- Phase transition or death below `t=1` produces no impact, pack, shake, sound, or damage.
- Foot anchor, fixed warning, boss plant, resolve point, exact hit test, and impact pack agree within one rendered frame.
- Worldwheel clears its player hit set exactly at each `2π`, deals at most two hits, and the ribbon never paints unswept future angle.
- All danger geometry passes top-down exact-edge tests. This instance does not ship in belt mode by approximation.

### Readability

- With underlays hidden, first-time players identify Crownstep versus Heel Reap versus Shed Mountain from the boss at least 8/10 times after the tutorial.
- With painted art disabled, exact edges, foot pose, and white/dodge cadence retain the same success rate.
- In grayscale, white inward cadence/glint remains distinct from warm broken dodge edges.
- No dodge-only attack creates a white flash at resolve. No parryable attack relies on cracks alone.
- All four planned Final Tread feet remain distinguishable at the 13× lower-body framing.

### Co-op and arena

- Test 1, 2, and 4 players with a down during every card. Focus never locks a dead player, never retargets mid-cast, and respects the 2.50 s mercy rule for new target circles.
- A rescuer can enter 96 px rez range, answer one crossing quake, and complete the rez without a guaranteed follow-up circle on the corpse.
- Test at least 20 arena seeds: flat, pit-heavy, zero nearby POI, one POI, and two valid POIs. Every deck remains complete.
- POI art, collision, and server selection disappear on the same event. No invisible stump remains.
- Quake edges remain visible across pits/POIs; neither appears to grant false cover.
- Solo-clutch behavior suppresses adds and schedules one clean Crownstep without reducing its damage.

### Fun targets

- At least 80% of first-time players successfully answer the tutorial Crownstep.
- First-clear groups earn at least two Stride Breaks; if most earn none, scoring is too strict, not the damage too low.
- At least one player voluntarily uses a pit hop during Phase II on seeds that offer one.
- Worldwheel produces a clear choice between leaving, threading, and parrying; if every melee player simply tanks it, per-revolution damage is too low or contact read is late.
- Median death sources distribute across missed step, routing/POI collision, rescue pressure, and Worldwheel. One attack should not exceed 35% of all downs.
- Phase transitions plus kill spectacle consume less than 7% of total fight time and never remove control longer than the 90 ms death punctuation.
- After the kill, the XP crown is the object players mention—not the portal UI appearing early or a leftover hostile tell.

## Explicit cuts

- No generic bullet fan, gaze beam, corrosive pool, or periodic six-second add summon. Those belong to other bosses and weaken the footfall identity.
- No new titan illustration, unique weapon, bespoke arena tileset, or cinematic camera asset.
- No HP-gated invulnerability. Final Tread can be interrupted by a real kill.
- No shrinking wind-ups or speed multiplier masquerading as escalation.
- No white nuke flash on dodge-only attacks.
- No landmark that blocks quake damage.
- No automatic mid-fight revive. The 30% unfold happens only after a legitimate clear.
- No reward grant before the XP Echo reaches its collector.

The intended memory is not “the very large enemy had more circles.” It is: **we learned its step; our parrier broke its stride; we jumped a pit on the three-beat march; the giant folded the landmark out from under us; its heel turned through the page twice; then all four feet came down, the sheet tore, and the XP crown flew out of the collapse.**
