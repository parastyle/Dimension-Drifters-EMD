# Jump Feel Panel — Animation / VFX Design

Role: ANIMATION/VFX DESIGNER. Scope: the two jumps (higher standard jump + optional ground pound;
crouch-pause direction-locked distance jump), frame-by-frame, built entirely from existing
procedural drawing + the painted packs already on disk (image generation is exhausted — nothing
here requires a new asset).

All frame counts are at 60 fps (1 frame ≈ 16.7 ms). All body measures are in `H` =
`TARGET_BODY_H` = 76 px (`packages/client/src/entities/SpriteRig.ts:84`). Where the mechanics
designer owns a number (airtime, AoE radius, cooldowns) I express the beat as a fraction of that
number so the anim spec survives tuning.

---

## 0. What exists today (verified against source)

**The current hop.** Server integrates a real height axis: `stepVertical` in
`packages/shared/src/movement.ts:193` under `GRAVITY = 1350`, seeded by `JUMP_VELOCITY = 303`
(`packages/shared/src/constants.ts:390-391`) → airtime ≈ 0.45 s, peak ≈ 34 px
(`JUMP_HOP_HEIGHT`). Cooldown 0.7 s, input buffer 0.25 s. `PlayerState.height` is synced
(`packages/shared/src/state.ts:93`) and `airborne` gates §17 pit-clearing.

**How height renders.** The rig container/hurtbox stays grounded; only the ART lifts.
`setHop(px)` sets `hopTarget`; each frame `hopPx += (target − hopPx)·(1 − e^(−22·dt))`
(`SpriteRig.ts:3693`) — the ease that de-stair-steps the 20 Hz sync. After all parts are posed,
every part is lifted by `hopPx` uniformly (`SpriteRig.ts:5085-5096`), with a small apex stretch
`body.scaleY *= 1 + min(0.12, hopPx/300)`. The **shadow is the truth channel**: it never lifts,
it shrinks/fades with height — `shrink = max(0.42, 1 − hopPx/420)`, alpha `0.30·shrink`
(`SpriteRig.ts:5127-5146`).

**Landing today.** Detected purely visually: `prevHop > 6 && hopPx ≤ 6 && hopTarget < 1` →
`landSquash = 1`, decays over 110 ms, applied as `scaleY *= 1 − 0.14·landSquash`
(`SpriteRig.ts:3692-3697, 5101`), plus a downward hand-spring impulse `JIGGLE_LAND_HAND_KICK
= 48` (`SpriteRig.ts:4757`) and a foot-spring rebase on `(landed && planted)`
(`SpriteRig.ts:4875`). Feet already switch spring regimes mid-air: `JIGGLE_FOOT_AIR_W = 12,
Z = 0.38` (floppy dangle) vs `PLANT_W = 34, Z = 1` (dead plant) — constants.ts:56-59.

**Sync + prediction.** Self rides the local predictor (`selfPredHeight` — the hop starts the
frame SPACE is pressed, `ArenaScene.ts:3036-3038, 6349-6353`); remotes ride synced
`pl.height` smoothed by the setHop ease. Reconciliation replays buffered jumps and only
hard-adopts beyond `HEIGHT_ADOPT_PX = 12` (`packages/client/src/net/prediction.ts`).
**Anything new that remotes must SEE (pound, crouch-charge) needs one synced channel** — see §4.3.

**Dust/particle infrastructure.**
- `spawnPoof` (expanding 8 px ring, 260 ms) and `spawnFallStreak` (sinking dark puff + 6
  dropping motes) in `packages/client/src/scenes/arena/vfx.ts:1267-1313`.
- The worm's allocation-free particle table (`packages/client/src/vfx/worm-boss-vfx.ts`):
  Dust (soft tan circles, 0xc3a374, grow as they fade), **Scrap (paper triangles with
  115 px/s² gravity + spin — our paper-scraps idiom)**, Debris, Mote. Cap 56, one Graphics.
- Painted component packs via `playFxPack` (`packages/client/src/vfx/fx-composer.ts`) —
  `quake-burst` (core/chunks/ring/crack/plume) is the natural big-tier pound hit; sized by
  gameplay radius (`110 px = 1×`, clamp 0.28–2.4), frame budget 10 packs/frame.
- Ground-tell reference: `WormBossVfx.drawEruptionPaint` — dark inhale ellipse + 12 radial
  hairlines, phase-driven, **explicitly decorative while "the generic telegraph owns the exact
  red truth edge"** (worm-boss-vfx.ts:207). That division of labor is law here too.

**Camera-shake budget** (all through prioritized `shakeCam`, `ArenaScene.ts:6863-6874`):
gun recoil ≤ 70 ms / ~0.0017; hit 100 / 0.005; pit-fall 150 / 0.006; boss slam 200·s / 0.014·s
(s = radius/150, clamp 0.8–1.7); quake 280 / 0.03 (ceiling); worm ambient gated by a 700 ms
admission gap + 760 px distance falloff (`localShake`). UI events never shake (§7 rule,
ArenaScene.ts:4899).

**Paper-cutout vocabulary already shipped** (reuse, don't reinvent):
- *Spawn-unfold*: `paperPopScaleX/Y/Rotation` (`SpriteRig.ts:169-186`) — scaleY rises from
  −0.04 **through zero** (the card unfolds edge-on) with a counter-rotation shear substitute.
- *Scale-through-zero flip*: the hammer front-flip (`applyFulcrumFlip`, `SpriteRig.ts:3092`)
  drives `attackScaleY = signedClamp(cos(2π·e), 0.12)` — the body card passes edge-on twice =
  one readable front-flip, with `signedClamp` floor 0.12 preventing the invisible frame. Its
  shadow work during flight (shrink 0.42×, alpha −0.45 at apex, re-fatten on the fall,
  `SpriteRig.ts:3181-3211`) is exactly the choreography a jump wants.
- *Death treatments*: crumple/flutter/tear/lite/pit (`PaperDeathTreatment`, SpriteRig.ts:858).

**Audio.** `AudioBus.play(event)` dispatches synth recipes by case name (existing: `hit`,
`bighit`, `parry`, `fall`, `bossslam`, `hurt`, …). **No jump/land cue exists today.** The
sample bank (`packages/client/src/audio/sample-bank.ts`) reads
`tools/soundkit/sfx-manifest.json` → `public/audio/sfx/manifest.json`; each entry carries a
`replaces` key naming the AudioBus event it upgrades. So: add synth cases now, manifest
entries later, zero wiring change.

**Reduced motion.** `prefersReducedPaperMotion()` (`ArenaScene.ts:236`) already gates paper
spawns, mote scatter, and the full/lite tell tier (`ArenaScene.ts:3414`).

---

## 1. STANDARD JUMP (raised — "satisfying")

Assume mechanics raises peak to `H_pk ≈ 56–60 px` (~0.75·H) and airtime `T ≈ 0.55 s`. All
beats below are phrased against `T` and `H_pk`.

**Feel law: zero added latency.** The predictor lifts the rig the same frame SPACE lands
(ArenaScene.ts:3036). Anticipation squash therefore OVERLAPS the first rising frames —
squash-in-motion, never squash-then-move.

### Frame-by-frame

| Beat | Frames (ms) | Body | Limbs / springs | Shadow |
|---|---|---|---|---|
| **Anticipation squash** | f0–f2 (0–33) | `scaleY 0.90, scaleX 1.06`, blending out by f6. Height is ALREADY rising underneath — the squash reads as the push-off, not a delay. | Both feet get a one-frame plant kick (reuse turn-kick impulse, `JIGGLE_TURN_FOOT_KICK`-sized, downward). | +4% scale for 2 frames (weight pressing) — then begins shrinking. |
| **Launch stretch** | f3–f8 (50–133) | Replace the static `1 + min(0.12, hopPx/300)` with **velocity-driven stretch**: `scaleY = 1 + 0.16·clamp01(vh/JUMP_VELOCITY)`, `scaleX = 2 − scaleY` area-preserving. Strongest leaving the ground, self-erasing at apex. (Self knows `vh` from the predictor; remotes derive `vh ≈ Δheight/Δt` from the eased hopPx — same signal, free.) | Hands: upward spring impulse −Y ≈ 30 at f3 (arms trail down = body shoots up). Feet: FOOT_AIR regime dangles them naturally — no authored pose needed. | Shrink toward apex value. Retune shadow curve for the taller jump: `shrink = max(0.34, 1 − hopPx/560)` so apex reads ~0.55×, not the current floor-slam 0.42. |
| **APEX HANG — the readable floaty beat** | ~f14–f20 (230–330), the window where \|vh\| < 0.25·JUMP_VELOCITY | Stretch has returned to ~1.02. Add the hang: `scaleY 1.02 → 1.04 → 1.02` over the window (a breath, not a bounce). Body rotation eases to 0 (perfectly level card — stillness IS the hang). | Hands drift up to +Y equilibrium −2 px (weightless fingers); feet at their loosest dangle (FOOT_AIR already does this — just do not fight it). | **The shadow tells the apex**: smallest scale (~0.55×), lowest alpha, plus the blur trick (§1.1). |
| **Asymmetric fall** | f21–f31 (350–520) | Falling reads heavier than rising: `scaleY = 1 − 0.06·clamp01(−vh/JUMP_VELOCITY)` (slight compress-anticipation) + a 0.05 rad forward lean along the move direction. | Feet tuck: raise foot equilibrium Y by −6 px (knees-up silhouette). Hands float up relative to the drop (they lag — springs get no impulse, physics does it). | Re-fattens on the way down; alpha recovers. The player tracks the landing by the shadow — never dim it below alpha 0.10. |
| **Landing squash** | touchdown +0–9 (0–150) | Scale the squash by fall height: `squash = min(0.22, 0.10 + peakHopPx/450)`, applied as `scaleY *= 1 − squash·env`, `scaleX *= 1 + 0.6·squash·env`; envelope: 1 at f0, easing out over 140 ms with a `backOut` overshoot to +0.03 at the tail (the paper card pops back). Current fixed 0.14/110 ms stays as the floor. | Hand kick scales too: `JIGGLE_LAND_HAND_KICK · (0.75 + peakHopPx/H_pk·0.5)`. Feet: keep the existing plant rebase — it is correct (a landing is a cut, not energy). | One-frame shadow overshoot to 1.06× then settle to 1.0 (the ground "catches"). |
| **Dust ring** | touchdown f0 | `spawnPoof`-family ring at the feet, radius `6 + 8·(peakHopPx/H_pk)` px, tan 0xcfc6ae alpha 0.45, expand ×2.6 over 240 ms — plus 4–6 worm-table Dust motes kicked outward at 30–60 px/s, ±0.58 vertical squish (top-down perspective, same ratio worm dive dust uses). | | |

### 1.1 Shadow choreography — the truth channel

At our zoom the shadow does more work than the sprite. Spec, per height `h` (px):

- **Offset:** none. Light is authored straight-down everywhere in this game (shadow sits at
  `TARGET_BODY_H·0.42` under the root, SpriteRig.ts:5139); introducing a sun-angle offset
  would decouple the shadow from the landing point and violate the truth-channel role. The
  shadow marks **where you land**, always.
- **Scale:** `shrink = max(0.34, 1 − h/560)`, both axes (attack channels multiply on top,
  unchanged).
- **"Blur":** an ellipse cannot blur, so fake it with the two-ellipse trick — add one soft
  halo ellipse (same pool, alpha `0.05·(1 − shrink)`, scale `shrink·1.9`) that only becomes
  visible as the core shrinks. Cost: one extra ellipse per player rig, invisible at rest.
- **Alpha:** core `0.30·shrink`, floor 0.10.
- Detail worth one line of code while in here: the lift at SpriteRig.ts:5087-5090 is uniform
  across parts despite the comment promising "feet lift most". Give feet `lift·1.10` and the
  body `lift·0.98` — the 5 px shear opens daylight under the silhouette for free.

---

## 2. GROUND POUND (optional move; SPACE again mid-air)

Assumed mechanics (their doc owns the numbers): rise cancels, ~90 ms hover, descent at ~3×
gravity, authoritative AoE radius `R` (say 90 px baseline), landing damage + brief recovery.
Contact arrives like a boss-slam contact row (a `TelegraphKindTag.Slam`-shaped event carrying
`x, y, R`) so the client renders the hit from authoritative data, never from local guess.

### Frame-by-frame

**Tuck / flip — the paper-cutout fold** (input +0 → 120 ms, 7 frames)
- The proven idiom: drive `attackScaleY = signedClamp(cos(2π·e), 0.14)` across the beat —
  the body card flips edge-on twice = one crisp front-flip (identical math to the shipped
  hammer `applyFulcrumFlip`, SpriteRig.ts:3171).
- Layer the FOLD on top: at each edge-on crossing (e ≈ 0.25, 0.75) pinch `scaleX` to 0.80 for
  2 frames — the card visibly folds in half as it turns, unmistakably paper.
- Hands and feet pull to grip points at body center (`attackGrip*` channels, blend 1) — a
  cannonball tuck; weapon depth −1 (behind) for the first half-flip.
- Vertical: height freezes (mechanics), art adds `attackLiftPx = 6·sin(π·e)` — a hitch UP
  before the drop (Nielsen anticipation, sold without touching the sim).

**Hover beat — the aim/tell** (120–210 ms)
- Body at 1.04 scale, dead level, 1 px 8 Hz tremble (skip under reduced motion).
- **The shadow pulses once**: scale 1.0 → 1.18 → 1.0 over the 90 ms, alpha +0.08. Players
  under a pound learn to read the ground, not the sky — the shadow IS the warning.

**Descent streak** (hover end → contact, ~150–200 ms depending on height)
- Pose: feet-first spike — foot equilibria pulled to +10 px below body, hands trailing at
  −8 px above; `scaleY 1.18, scaleX 0.88` stretch (velocity-driven formula from §1 covers
  this automatically since |vh| is ~2× JUMP_VELOCITY — just raise the stretch clamp to 0.18
  for downward vh).
- Streak: NO new textures — a worm-glint-style two-pass painted stroke (dark 5 px under,
  white 1.8 px core, `worm-boss-vfx.ts:drawGlint` pattern) drawn vertically above the body,
  length `min(46, fallSpeed·0.06)` px, alpha 0.5, cleared on contact. Two flanking 12 px
  speed-lines at ±0.35·H, alpha 0.25. All on one retained Graphics — zero allocation.
- Shadow: grows from apex-small toward full at a rate matching the AUTHORITATIVE height so
  the landing instant is readable; tint the core 2 shades darker in the last 80 ms.

**Landing hit** (contact frame f0 → +400 ms) — **WYSIWYG law**
- **Truth ring first**: a stroked circle expanding 0.3·R → exactly `R` over 130 ms
  (`Cubic.easeOut`), 2.5 px paper-white stroke over a 5 px dark under-stroke, alpha 0.9 → 0.
  `R` comes from the contact row — the same field the server damaged with, exactly like
  `spawnExplosion(this, c.x, impactY, Math.max(24, c.a))` at ArenaScene.ts:4229. Dust and
  scraps may live INSIDE the ring or drift decoratively upward, but nothing energetic ever
  renders beyond `R` (the worm's "decorative inhale vs telegraph truth edge" contract).
- Radial dust: 10–14 worm-table Dust motes, outward 90–150 px/s with `radiusLimit = R − 8`
  (the table already clamps + rebounds at a radius limit — built for this).
- **Paper scraps**: 6–8 Scrap triangles (gravity + spin, the shipped idiom) popped upward at
  60–120 px/s — the ground itself tears.
- Painted upgrade tier: when `R ≥ 70` and the frame budget allows, `playFxPack(scene,
  "quake-burst", x, y, { radius: R })` — its plan is core/chunks/ring/crack/plume and its
  `ground` island leaves the lingering crack (1.15 s). Below that, procedural only.
- Scorch fallback: 5 radial hairlines (drawEruptionPaint pattern, 2 px, 0xb59a70 alpha 0.3)
  fading over 900 ms.
- **Camera punch**: `shakeCam(150·k, 0.012·k)` with `k = clamp(R/150, 0.6, 1.2)` — deliberately
  one notch under the boss slam (200/0.014) so bosses stay the loudest thing in the room.
  Local player only at full strength; for REMOTE pounds use the worm falloff pattern
  (`localShake`: 760 px linear falloff) so a teammate pounding across the arena is a thump,
  not a quake. Never exceed the quake ceiling 0.03.
- Hit-stop: none. Pound is an AoE, and the §7 rule keeps freeze frames for direct melee contact.

**Recovery pop** (landing +80 → +280 ms)
- Deep squash 0.78 held 70 ms (the recovery cost made visible), then release through
  `paperPopScaleY` — the same −0.04-through-zero unfold as spawn, at 60% amplitude: the
  character un-crumples from their own impact. Hand kick ×1.6.

---

## 3. DISTANCE JUMP (crouch-pause → direction-locked low fast arc over pits)

Assumed mechanics: hold (min ~260 ms) crouch that locks direction at press, launch on release
(or auto at full charge), low arc (peak ~22 px), high horizontal speed, landing point
soft-locked and server-validated (clamped at walls/ledges).

### Frame-by-frame

**Crouch fold — the charge tell** (hold f0 → f16, 0–260 ms)
- This is a PAPER crouch, not a smooth squat: `scaleY` steps down in two discrete creases —
  1.0 → snap to 0.86 (f3, one frame), hold; → snap to 0.72 (f9, one frame), hold; ease to
  0.62 by f16. `scaleX` widens 1.0 → 1.12 in the same steps. Two crease-snaps read as
  folding paper from across the arena — this IS the tell teammates and enemies learn.
- Feet spread to a wide plant (foot targets ±0.16·H, blend 1, PLANT regime); hands chamber
  behind the body along the locked direction (grip targets −0.14·H·dir); body leans 0.10 rad
  INTO the locked direction — the coil points where the player will go.
- Shadow: +8% scale, +0.05 alpha (weight pressing into the ground).
- Holding past full charge: a 1-frame scaleX shimmer (±0.02 at 2 Hz) — "loaded". Skip under
  reduced motion.

**Direction indicator — coordinate with the advocate's betrayal concern.** The player (and
everyone else) MUST see the landing before commit:
- A dashed ground line (5 px dashes, 4 px gaps, 1.5 px wide) from the feet to the soft-locked
  landing point, drawn on the ground layer (depth ~2–5, under actors, with the scene's floor
  projection like the worm trail) in trail-gold 0xc7a66c; local player alpha 0.55, remote 0.30.
- At the destination: a **landing oval the exact size and shape of the player's shadow
  ellipse** — outline only, pulsing 1.0 ↔ 1.08 at 3 Hz. The shadow is the height-truth
  channel; borrowing its silhouette says "your shadow will be HERE" in the game's own grammar.
- One chevron at 2/3 distance pointing along travel.
- If the server-validated landing differs from the aimed point (wall clamp, max range), the
  line bends/stops at the CLAMPED point and the oval tints red-brown 0x8a4a3a — the indicator
  never promises a landing the sim will not honor (WYSIWYG applies to futures too).
- Under reduced motion: line + oval stay (this is gameplay information, not garnish); the
  pulse and chevron animation freeze to static.

**Launch — extreme but brief stretch** (release f0–f5, 0–83 ms)
- f0–f1: the two creases unfold in ONE frame each (reverse-order snap 0.62 → 0.86 → into
  stretch) — the paper snap-release is the signature frame of the whole move.
- f1–f2: extreme stretch along travel: `scaleY 1.30, scaleX 0.72` for exactly 2 frames, then
  ease to 1.10 by f5. (Longer than 2 frames reads rubber, not paper.)
- Kick-back: 3–4 Dust motes + one 10 px ring puff BEHIND the plant feet, opposite the travel
  direction; feet springs get a hard backward impulse (they leave last).
- Audio `leap:launch` on this frame; the crouch had `leap:coil` at each crease snap.

**Low-arc dash silhouette** (flight, ~300–380 ms)
- Body pitched into travel: rotation up to 0.22 rad toward the move vector (the character is
  a thrown card, not a lifted one); `scaleY ~1.06` sustained.
- Limbs trail: hands at −0.10·H behind, feet in FOOT_AIR dangle swept back by one backward
  impulse at launch. No afterimages needed — the pose is the speed.
- **Shadow: the low-arc signature.** Shrink barely (floor ~0.85 — the arc is LOW and the
  shadow says so), but stretch it along the travel axis (`scaleX·1.18` in travel space,
  approximated by attackShadowScaleX/Y since the ellipse cannot rotate freely — at our zoom
  axis-aligned stretch reads fine). A big shrink here would lie about clearance height over
  the pit; the pit crossing is sold by the shadow sliding OVER the void while the art barely
  rises.
- Over a pit: the shadow alpha dips to 0.12 while over void tiles (nothing to catch it) and
  snaps back over ground — one conditional, huge read.

**Landing skid** (touchdown f0 → +180 ms)
- Momentum visibly spends: body leans BACK 0.12 rad, front foot planted forward at +0.14·H,
  rear foot trailing; `landSquash` at 0.7 strength (lighter than a pound — energy went
  sideways).
- Dust trail: 3 small puffs at 40 ms intervals strung behind the skid, each 60% the size of
  the last, plus two 18 px dark skid lines (1.5 px, alpha 0.35) fading over 300 ms on the
  ground layer.
- Audio `leap:skid` (gritty noise slide, 140 ms).
- No camera shake at all — this move is about the PLAYER's grace, and the shake budget is
  reserved for impacts.

---

## 4. SHARED SYSTEMS

### 4.1 Sound hooks (AudioBus cases now, soundkit manifest later)

New `AudioBus.play` cases (synth recipes in the house style — tone + noise slice, throttled,
panned by x; local `amt` 1.0, remote ~0.35, matching the beam convention at
ArenaScene.ts:9357-9404):

| Cue | Beat | Recipe sketch | Priority |
|---|---|---|---|
| `jump` | standard launch f0 | 280→420 Hz triangle sweep, 90 ms, gain 0.14 | normal |
| `land` | any touchdown | 120 Hz sine thump 70 ms + noise tick; `amt` = peak-height fraction scales gain/pitch | normal |
| `pound:tuck` | flip start | short 500→700 Hz whip, 60 ms | normal |
| `pound:drop` | descent start | 600→180 Hz falling sine whistle riding the descent (~180 ms) | normal |
| `pound:hit` | contact | 55 Hz sine boom 200 ms + lowpass noise slam; `amt = R/150`; shares family with `bossslam` (AudioBus.ts:533) but pitched a third higher so player ≠ boss | critical (local), normal (remote) |
| `leap:coil` | each crouch crease snap | dry 900 Hz 18 ms tick + paper-rustle noise slice — twice, stepping down a tone | low |
| `leap:launch` | release | 200→90 Hz pluck + airy noise whoosh 120 ms | normal |
| `leap:skid` | skid | bandpassed noise slide 140 ms, gain 0.12 | low |

Soundkit manifest (`tools/soundkit/sfx-manifest.json`) gains matching entries with
`replaces: "jump" | "land" | "pound:hit" | …` so generated samples upgrade each cue with zero
call-site changes (`sample-bank.ts` contract). Suggested categories: `movement` (jump/land/leap),
`combat` (pound). `pound:hit` wants 2 variations; `land` wants 3 (it will fire constantly).

### 4.2 Reduced-motion variants (`prefersReducedPaperMotion()`, ArenaScene.ts:236)

- Keep: all squash/stretch ≤ current shipped amplitudes, the landing dust ring (single ring,
  no motes), the direction indicator (static, no pulse), the truth ring at exact `R`,
  the shadow choreography (it is information, not motion).
- Drop: descent streak + speed lines, scrap triangles, the hover tremble and charge shimmer,
  shadow pulse, the two-frame extreme launch stretch (use 1.12 smooth), `playFxPack` upgrade
  tier (matches the existing `full = visible && !reducedMotion && …` gate, ArenaScene.ts:3414).
- Camera: pound punch at 40% intensity, everything else zero (pit-fall precedent keeps its
  own 150/0.006).

### 4.3 Remote players — how jumps sync (verified) and what the new moves need

Standard jump: already fully synced — remotes render from `pl.height` through the setHop
ease; the 22/s ease costs ~45 ms of apex lag at 20 Hz, invisible at our zoom. Landing squash,
dust, hand-kick all trigger off the same eased signal (`landed` detection is rig-local), so
**remote standard jumps get every §1 beat for free**.

Pound and distance jump have client-side phases (tuck, hover, crouch-charge) that height alone
cannot express. Minimum sync surface (engineer's call on shape, but the pattern exists):
- One synced byte on PlayerState — `moveKind` (0 none / 1 pound / 2 leap-crouch / 3 leap-dash)
  or a `poundSeq`/`leapSeq` counter in the style of `fellSeq` (state.ts:96, synced purely as a
  VFX trigger). Remotes drive the exact same rig channels from it; the crouch tell and the
  landing oval MUST render for remotes (enemies and teammates read them — that is the point
  of a tell).
- The pound's landing hit renders from the server contact row (like boss slam contacts), so
  the AoE ring is authoritative for everyone by construction.

### 4.4 LOD

- Rigs already skip jiggle outside `worldView + JIGGLE_LOD_MARGIN_PX` (SpriteRig.ts:3679-3685)
  — all new spring impulses inherit that for free. Pose channels (squash/flip/crouch) are
  arithmetic on already-driven scalars: keep them (they are the synced silhouette), they cost
  nothing.
- Off-view pound hits: keep the truth ring + `land`/`pound:hit` audio pan (cheap, and audio
  carries the info), skip motes/scraps/pack — mirror the
  `REMOTE_SIGNATURE_LOD_MARGIN_PX = 220` policy (SpriteRig.ts:105).
- `playFxPack` self-budgets at 10/frame; the pound's procedural fallback ensures the truth
  ring never gets budget-dropped (draw it directly, not through the pack).
- Indicator lines: cap at one per player (they replace, never stack); worm ground Graphics
  precedent shows retained-Graphics redraw is the right cost model.

---

**The three signature frames.** One: the standard jump's apex hang — the stretched paper card
floating dead-level at the top of the arc over its smallest, softest shadow, everything still
for six frames. Two: the ground pound's edge-on fold — the body card caught mid-flip as a
one-pixel line pinched at the middle, white descent streak already forming above it. Three:
the distance jump's loaded coil — the character double-creased into a squat wide cutout, lean
pointed down a dashed gold line to a pulsing shadow-shaped oval on the far side of the pit.
