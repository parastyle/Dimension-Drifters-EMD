# ULTIMATE Abilities — VFX / Spectacle Director's Script

Panel seat: VFX / SPECTACLE. Mandate: "pinnacle special effects" for the new ULTIMATE kit,
built entirely from what already ships (Codex image generation is EXHAUSTED until Aug 15 —
zero new rendered assets in v1; a deferred wishlist closes this doc).

Everything below is grounded in the actual client code as of `feat/v0.117-feel-and-colossus`.

---

## 0. Inventory — the instruments we already own

| Instrument | Where | What it gives an ultimate |
|---|---|---|
| Staged FX packs (12) | `packages/client/src/vfx/fx-composer.ts` + `fx-pack-*.ts` | Full painted eruptions with per-island timelines: `core / hot / rings / shrapnel / wisps / ground` bands. Deterministic scale: **110 px radius = authored 1×**, clamped 0.28–2.4×. Frame budget: **10 pack plays / render frame** (shared, WeakMap per scene). |
| Blast-tier dispatch | `scenes/arena/vfx.ts` `explosionPack()` | `<100px` = procedural stack only; `100–159` = element pack (`ember-eruption`, `frost-nova`, `lightning-ball`, `void-implosion`, `holy-smite`, `toxic-burst`); **≥160 px = the universal NUKE beat** (`fx-pack-nuke`: mushroom stages, double ring, dust wall). Ultimates are exactly what this tier was reserved for. |
| Painted particles (96 packs) | `vfx/particle-manifest.ts` + `vfx/particles.ts` | 12 elements × 8 shapes (`bolt/mote/orb/ring/shard/spark/splat/wisp`), 96px cells. `particleBurst(scene, id, x, y, opts)` — count/dir/spread/speed/scale/life/additive/sink/depth. Degrades to no-op if unloaded. `elementPack(element, shape)` resolves with steel fallback. |
| Painted-Edge Ribbon (PER) + procedural sheets | `vfx/vfx-render.js` (canonical, shared with Weaponsmith) | Rope-strip ribbons in 8 element paints (S/M/L/XL body widths 14–38), `hotRamp()` fire cooling ramp, and three free procedural textures: `vfx-soft` (radial glow), `vfx-streak` (capsule), `vfx-spark` (hot-cored streak). |
| Beam techniques | `vfx/BeamRenderer.ts` | Pooled retained ropes (body+lip per player, depths 9991/9992), element paint table, `groundLight` warm ellipse underneath (depth 2). The charge→ignite→sustain→release phase grammar is the best in-repo model for a charged ultimate. |
| Impact flipbooks | `scenes/arena/vfx.ts` `spawnImpactFlipbook` | 8 element sheets, 256px × 6 frames, 270 ms, additive, depth 99500, sized to the victim's diameter. |
| Explosion composite | `scenes/arena/vfx.ts` `spawnExplosion(x,y,radius,element)` | The full §41 stack: pack + painted shards/motes/wisps/ring + **lingering scorch (0.55r, depth 2, 2.6 s fade)** + radius-scaled prioritized shake (cap 0.02). WYSIWYG: ring = server hitbox. |
| Paper-cutout body language | `entities/SpriteRig.ts` | `playSpawnUnfold(clock, ms)` (arrival unfold), `deathPop` treatments (`crumple/flutter/tear/lite/pit` — P4 flutter crosses edge-on via signed scale), signature channels (`attackLiftPx`, `attackScaleY`, paper-twist, shadow channels) that move paper only, never the hurtbox. |
| Camera discipline | `scenes/ArenaScene.ts` | `shakeCam(dur, intensity)` — prioritized, weaker never stomps stronger. `hitStop(ms, priority)` — leaky bucket **250 ms per 1000 ms**; `priority=true` bypasses (sacred skill beats). Camera zoom base = `RENDER_DPR` — any zoom punch must be **multiplicative on current zoom**, never absolute. Reference magnitudes: boss slam 200/0.014, colossus entrance 700/0.02, footfall quake 280/0.03, quake connect `hitStop(130, true)`. |
| Fresh pattern references | `vfx/xp-motes.ts`, `vfx/worm-boss-vfx.ts` | Fixed-pool, tween-free, typed-array renderers. Worm: `PARTICLE_CAP 56`, one Graphics per band, `localShake` with **760 px distance falloff + 700 ms duty gap** — the exact template for "someone else's spectacle near me". |
| Audio | `audio/AudioBus.ts` | 100% procedural Web Audio; per-event recipes in one switch; `MAX_VOICES 24`; throttle map; world-x panning; `amt` magnitude scaling. New ult sounds are new recipes — zero assets. Best references: `beam:charge` (rising anticipation), `parry` (the crispest transient), `bossslam` (sub boom). |
| Decal/residue precedent | scorch in `spawnExplosion` (depth 2), fx-pack `ground` islands (depth 5+), `decal-manifest.ts` floor props | Residue lives in the **ground band, depths 2–5**, always under `telegraphGroundGfx`. |

### The protected danger layer (verified)

`ArenaScene.create()`:

- `telegraphGroundGfx` — **depth 3** — the mathematically literal ground danger (red footprints).
- `telegraphGfx` — **depth 99997** — "thin response boundaries and compact source cues stay above beams/XP, below HUD" (white tells, parry timing edges).
- `dangerVignette` — depth 99998 (screen-space). HUD begins at 100000.
- During the paper-world fold the ground truth is *raised* to 99989 ("exact ground danger remains mathematically literal above the page").
- Quake danger ellipse draws at 99998; worm edge-direction tell at 99900 (screen-space).

**Rule for every ultimate: spectacle never enters ≥99900.** Air-band spectacle caps at **99700**;
ground residue caps at **depth 2** (strictly under the depth-3 ground truth). Screen-space accents
(speed-lines, ready glints pinned to HUD) cap at **99850**. Note two pre-existing squatters at
99997 (level-up ring, hit-streak lines, `ArenaScene.ts:7372–7483`) — do **not** copy them; they
predate the protected-band contract and are small/brief enough to tolerate, but ultimates are
neither small nor brief.

---

## 1. The spectacle grammar (applies to every ultimate, present and future)

Every ultimate is a **three-act paper-theatre beat** with a fixed timing envelope:

```
ANTICIPATION  220–380 ms   inhale — energy CONVERGES, body coils, audio rises
EXECUTION     ≤ 900 ms     exhale — the only window allowed the nuke tier, the one camera accent,
                           the one (local-only) priority hit-stop
AFTERMATH     ≤ 2600 ms    settle — residue on the ground band, wisps up, audio tail decays
```

Grammar laws:

1. **Convergence precedes explosion.** Anticipation particles always move *inward/upward toward
   the drifter* (spawn on a ring, tween to center — the `emitRegrowth` pattern in
   `worm-boss-vfx.ts`), never outward. Outward = payoff. This is what makes the payoff land.
2. **The body is the first effect.** Before any particle: a SpriteRig signature pose
   (`attackLiftPx`, `attackScaleY` squash, paper-twist). Paper coils, then the world reacts.
   Cheapest frame we own, biggest read.
3. **One nuke-tier pack per ultimate, in EXECUTION only.** `playFxPack` at intensity ≥160 is the
   crown jewel; anticipation and aftermath use single bands (a lone ring frame, a lone wisp), never
   full stacks.
4. **One camera accent per ultimate.** Either a shake OR a zoom pulse OR a flash — never all
   three. Priority `hitStop` is allowed **only for the LOCAL player's own ultimate**, once, at the
   connect beat (the quake precedent: only if it actually CONNECTED).
5. **Ally ultimates are weather, not events.** Remote ults route shake through the worm's
   distance-falloff pattern (÷760 px, 700 ms duty gap), never flash the camera, never hit-stop,
   and drop their screen-space accents entirely.
6. **Element speaks through the existing dialect.** Color from the shared `ELEMENT_COLOR` /
   `EXPLODE_TINT` tables; painted matter from `elementPack(element, shape)`; the pack from the
   `explosionPack` family. A new ultimate never invents a new palette.
7. **WYSIWYG is sacred.** Wherever an ultimate deals area damage, an exact ring/ellipse at the
   authoritative radius renders at full opacity *before* any decorative art (the
   `spawnQuakeDangerEllipse` precedent). Spectacle decorates truth; it never replaces it.
8. **Predict the anticipation, confirm the payoff.** Button-press starts ANTICIPATION locally on
   the click (the §4 predicted-muzzle-flash pattern); the authoritative state change triggers
   EXECUTION; a rejection simply lets the anticipation fizzle (a 120 ms deflate — reads as
   "not ready", honest and cheap).

### READY-state idle aura ("ultimate available")

Must read at a glance in a 200-enemy horde without adding battlefield noise. Precedent: the parry
ring (depth 99989) and grab ring (99988) — quiet, local, under the white-tell layer.

- **Ground ember ring** at the drifter's feet: one retained ellipse (belt-projected), element
  `mid` color, alpha breathing 0.16→0.30 over a 1.8 s sine, lineStyle 2 px. Depth **rig.y − 1**
  (sorts with the body, under telegraphs). No additive blend at rest.
- **One mote per ~1.6 s**: a single `elementPack(el,"mote")` particle (scale 0.28, life 700 ms)
  drifting up from the weapon hand. One. It's a pilot light, not a fire.
- **Paper glint**: every ~4 s the rig's weapon quad gets a 90 ms white lip-highlight pulse
  (existing observed-source-flash channel in SpriteRig) — the cutout itself says "charged".
- **Local vs ally**: allies render the ground ring only, at 0.6× alpha. The mote and glint are
  self-only.
- **Charging (not ready)**: no aura. A partial aura would blur the binary read. The HUD meter
  owns progress; the world owns readiness.
- Budget: 1 retained Graphics ellipse + ≤1 transient sprite per ready player. Effectively free.

---

## 2. Archetype scripts

Depths below: GROUND = 2 (residue) / body band = rig.y ± / AIR = 99500–99700 / accents ≤ 99850.
All sounds are new `AudioBus` recipes (procedural, one switch case each); names given inline.

### 2.1 PHASE ATTACK — "between the pages" (void)

The drifter slips out of the world's paper plane, passes *through* the horde, and the cut arrives
before the body does.

**ANTICIPATION (280 ms)**
- Body: rig coils — `attackScaleY 0.86` squash, paper-twist 12°, shadow holds full (the body is
  still *here*).
- Ground: friendly cool ellipse marks the exit lane (void `mid` 0xb14bff, alpha ≤0.3, depth 2 —
  visually disjoint from enemy red/orange, see §4).
- Particles: 8 × `void-mote` spawned ON a 60 px ring, tweened INWARD to the chest over 240 ms
  (converge pattern), additive, scale 0.3.
- Air: one `FX_VOID_IMPLOSION` ring island (index 3, the inward-authored ring) played alone,
  scale-down 1.2→0.4, additive, depth 99510.
- Audio `ult:phase:in` — band-passed noise sweep DOWN (2.4k→180 Hz, 260 ms) + a soft sub tick.
  The sound of air closing around a page turn.

**EXECUTION (≤ 620 ms)**
1. *The flip (90 ms)*: rig signed-scaleX crosses through 0 — the P4 flutter-death edge-on trick,
   reused as a live pose. At scaleX≈0 the cutout IS invisible: the character has left the plane.
   Shadow alpha → 0.25 (the tell that keeps co-op readable: a ghost shadow slides along the lane).
2. *The passage*: no body. Three **afterimage stamps** at 0/33/66% of the lane — each a 2-quad
   tinted silhouette (torso+head ellipses, void mid, additive, alpha 0.45→0, 260 ms), depth 99560.
   A single `vfx-streak` stretched along the lane (length = dash distance, height 18 px, void
   tint, additive, alpha 0.5→0, 200 ms) is the ribbon — one image, not a rope.
3. *The strikes*: each enemy crossed gets `spawnImpactFlipbook(void)` at its diameter + 3 ×
   `void-spark` directional burst along the travel angle. Damage numbers already handled.
4. *Re-entry (last 120 ms)*: rig scaleX crosses back through 0 at the exit point; ONE
   `playFxPack("void-implosion", exitX, exitY, { intensity: 120 })` full stack fires as the world
   claps shut behind them.
5. Camera: `shakeCam(140, 0.008)`. Local-only `hitStop(90, true)` **only if ≥3 enemies were
   crossed** (a whiffed phase gets no freeze — honesty like the quake).
6. Audio `ult:phase:out` — the `:in` sweep REVERSED (180→2.4k) + `bossslam`-family sub thump at
   0.5 amt, panned at exit.

**AFTERMATH (≤ 2 s)**
- Lane residue: the exit-lane ellipse fades over 900 ms; 2 × `void-wisp` (non-additive, life
  900 ms) curl up from the entry and exit points.
- Ground: `FX_GRAVE_CALL` ground island (index 8, the stain) at the exit, alpha 0.4→0, 1.8 s,
  depth 2.
- Audio tail: airy shimmer — two detuned high sines beating, −18 dB, 700 ms decay.

### 2.2 FAR TELEPORT ON CURSOR — "the fold-through" (arcane)

The paper world folds the distance away. This one's craft problem is the **destination marker**:
it must be unmistakably FRIENDLY (see §4 for the anti-telegraph styling contract).

**ANTICIPATION (260 ms)**
- Destination: a cool arcane reticle at the cursor — double ellipse (belt-projected), 0x8f6aff,
  **stroke-only, counter-rotating, converging 1.4×→1.0×**, alpha 0.5, depth 2. Everything enemy
  telegraphs are not: cool hue, thin, shrinking, no fill.
- Body: rig folds — `attackScaleY` 1→0.9, arms tuck (grip channels), a reversed
  `playSpawnUnfold` feel: the arrival unfold played backward via the same envelope mirrored.
- Particles: 6 × `arcane-mote` converge inward at origin (converge tween, 220 ms).
- Audio `ult:blink:charge` — rising two-note pad (soft saw, 320→480 Hz, 240 ms) with a light
  noise shimmer.

**EXECUTION (instant beat, ~360 ms of dressing)**
1. Origin pop: rig snaps edge-on (scaleX→0 in 60 ms) and vanishes; 1 × `arcane-splat` frame
   punched up (scale 0.9, additive, 160 ms) + 4 × `arcane-shard` radial (speed 200, sink 10)
   where they stood. Shadow snaps out with the body.
2. The fold-line: ONE `vfx-streak` image stretched origin→destination (alpha 0.42, arcane tint,
   additive, 160 ms fade, depth 99540). Under reduced-flash it renders solid non-additive at 0.3.
3. Destination bloom: rig arrives via a true `playSpawnUnfold(clock, 220)` (the shipped arrival
   moment — already perfect), + `playFxPack("lightning-ball" → no)` — **no pack**; instead:
   1 × `arcane-ring` frame punch (scale = 0.8, additive, 300 ms) + 8 × `arcane-spark` radial +
   the reticle flares once (alpha 0.5→0.9→0, 180 ms) and dies.
4. Camera (LOCAL ONLY): multiplicative zoom pulse `cam.zoom × 0.985 → ×1` over 110 ms
   (Sine.inOut) — a blink, not a shake. Allies see nothing camera-wise.
5. Audio `ult:blink` — two panned halves: origin = short square blip pitching UP (an octave,
   60 ms); destination = soft chord bloom + `xpCadence`-family resolve, 80 ms later. The ear
   travels with the body.

**AFTERMATH (≤ 1.4 s)**
- Origin: 1 × `arcane-wisp` (life 800 ms) rising where they left; a faint ground ellipse
  (alpha 0.2, 700 ms fade, depth 2).
- Destination: 2 × `arcane-mote` orbiting the drifter for 600 ms (satellite pattern from
  xp-motes), then release.
- Audio tail: the chord's release ring, 500 ms.

### 2.3 ALPHA-STRIKE MULTI-DASH — "the shredder" (steel/shock, per character element)

N chained dashes through marked targets, each one a paper-blur, ending on a finisher.

**ANTICIPATION (300 ms + one 90 ms dilation)**
- The lock-on: local-only `hitStop(90, true)` the moment targets resolve — the world catches its
  breath ONCE. (This is the "time dilation?" answer: yes, but as the existing freeze primitive,
  priority, once, local.)
- Target pips: each victim gets a small white chevron pip (Graphics, 8 px, alpha 0.8, depth
  **99700** — deliberately below the 99997 tell band; these are OUR marks, not danger).
- Body: deep crouch — `attackScaleY 0.8`, `attackLiftPx` −2, shadow widens (weight drops).
- Screen accent (local only): 4 corner speed-line slivers (`vfx-streak`, screen-space,
  scrollFactor 0, depth 99850, alpha 0.35) leaning toward the first target.
- Audio `ult:alpha:lock` — N rapid ascending ticks (one per marked target, 30 ms apart,
  square blips walking up a pentatonic) — the count IS the telegraph.

**EXECUTION (70 ms per dash, ≤ 8 dashes → ≤ 560 ms + 130 ms finisher)**
Per dash leg:
1. Rig blurs: body stretches along travel (`scaleX 1.35 / scaleY 0.8` oriented to the leg —
   the paper-sword foreshorten trick applied to the whole cutout), then snaps.
2. One afterimage stamp at the leg's origin (tinted silhouette, element mid, alpha 0.4→0,
   200 ms, depth 99560). Cap: **4 live afterimages** — older ones are reused (ring buffer).
3. Leg ribbon: `vfx-spark` stretched along the leg (hot-cored, additive, 130 ms). One per leg.
4. On each victim: `spawnImpactFlipbook(element)` + 3 × `elementPack(el,"spark")` directional +
   the standard hit spark. Audio: per-dash tick continuing the ascending run, `amt` rising.
Finisher (last target):
5. `playFxPack("buzzsaw-wake")` if the kit is bladed, else the element pack, at intensity 130,
   on the final victim. If the run killed ≥3, escalate to intensity 170 (**nuke tier**) — the
   crowd-clear earns the mushroom.
6. Local `hitStop(130, true)` + `shakeCam(200, 0.012)` on the final connect only.
7. Audio `ult:alpha:finish` — `bighit` recipe + a short downward gliss answering the ascending
   run (call-and-response; the run resolves).

**AFTERMATH (≤ 2 s)**
- The dash polyline lingers as a fading Graphics stroke (element mid, alpha 0.25→0, 700 ms,
  depth 2 — it drops to the GROUND band, becoming a skid mark).
- Casings/debris: 4 × `steel-shard` with `sink: 18` at the finisher.
- 1 × element wisp per corpse (cap 4).
- Audio tail: metallic ring-out (high damped sine, 600 ms) — the blade still humming.

### 2.4 FIREBALL — "the comet" (fire)

A charged, thrown sun. The only projectile ultimate in the first four, so it owns the
travel-phase grammar for the rest of the roster.

**ANTICIPATION (350 ms)**
- Body: both grips converge (attackGripBoth), weapon lifts, `attackLiftPx` +3 — the wind-up of
  the hammer super-slam family, but held.
- The gather: a `vfx-soft` orb at the hands scaling 6→26 px (additive, fire hot 0xffd0a0) while
  10 × `fire-mote` converge inward over 300 ms and 2 × `fire-wisp` shimmer upward (heat haze).
- Ground: a warm breathing ellipse under the drifter (fire mid, alpha 0.15, depth 2).
- Audio `ult:fire:charge` — the `beam:charge` recipe re-tuned: noise through a rising band-pass
  + a swelling low sine, 340 ms.
- WYSIWYG: the moment the server has a committed impact point (cursor-aimed), the exact blast
  ring pre-draws at the destination via the friendly styling (§4) — cool-rimmed amber, stroke
  only. If the projectile is free-flying (no fixed point), skip — truth arrives with the ring
  at detonation.

**EXECUTION (launch + travel + impact, ≤ 900 ms total at max range)**
1. Launch: `spawnMuzzleFlash(style:"boom")` in fire color at size 40 + recoil pose (body rocks
   back 6°, one step). `shakeCam(90, 0.006)` local.
2. Travel (the comet): the projectile sprite is the gather orb handed off — `vfx-soft` core
   (26 px) + `vfx-spark` stretched behind it (64 px tail) + one `fire-bolt` particle dripped
   every 40 px of travel (life 300 ms, additive, cap 12 live) + a warm `groundLight` ellipse
   tracking beneath it (BeamRenderer pattern, depth 2, alpha 0.18). Depth 99520.
3. Impact: `spawnExplosion(x, y, R, "fire")` **is the payoff and already complete** — at R ≥160
   it dispatches `fx-pack-nuke` (mushroom, double ring, dust wall) + painted shards past the rim
   + smoke wisps + ring punch + scorch + radius-scaled prioritized shake (cap 0.02). Add nothing
   on top except: local `hitStop(110, true)` if ≥1 enemy was inside the ring.
4. Audio `ult:fire:impact` — layered: `bossslam` sub boom (amt 0.9) + a noise "whump" with a
   40 ms attack + 3 sparse crackle pops trailing 300–700 ms, panned at impact.

**AFTERMATH (≤ 2.6 s — mostly free, already shipped)**
- The `spawnExplosion` scorch (0.55R, 2.6 s) is the residue anchor.
- Add 3 × `fire-mote` embers drifting up from the scorch over 1.2 s (staggered) and 1 ×
  `fire-wisp` + 1 × `sand-wisp` (grey ash read) rising 900 ms.
- Ring of 4 tiny ember glows (`vfx-soft`, 4 px, additive, alpha 0.4) pulsing once at the rim,
  600 ms.
- Audio tail: low rumble decay (filtered noise, 700 ms) under the crackle pops.

---

## 3. Performance budgets

Hard context: fx-composer already gates **10 pack plays/frame**; hit-stop bucket is
250 ms/1000 ms (priority exempt); AudioBus caps 24 voices; room ceiling is `MAX_PLAYERS = 10`
but the design worst case for simultaneity is **4 players ulting in the same second**.

Per-ultimate caps (one player, whole three-act script):

| Resource | Cap | Notes |
|---|---|---|
| Full fx-pack plays | 1 | EXECUTION only. Anticipation/aftermath use single islands (≤3 extra images). |
| Transient particle sprites | ≤ 36 | Sum of all `particleBurst` calls. Fireball's `spawnExplosion` interior (~20) counts. |
| Afterimage stamps | ≤ 4 live | Ring-buffered, reused not destroyed. |
| Retained Graphics | ≤ 2 | Lane/ground + accent; cleared, not recreated. |
| Tweens | ≤ 14 | Prefer the worm/xp-motes typed-array pattern for anything per-frame. |
| Camera | 1 accent | shake OR zoom OR flash. Priority hitStop: local caster only, ≤130 ms, connect-gated. |
| Audio | 1 critical voice + 1 low tail | Recipes self-throttle via the existing `lastAt` map, key `ult:*` at 90 ms. |

4-player worst case: ≤144 transient sprites + 4 pack stacks — under the existing pack frame
budget (4 < 10) and comparable to a busy horde clear today. Rules that make it degrade
gracefully instead of clipping:

- **Build a shared `UltVfx` pool** (new file `packages/client/src/vfx/ult-vfx.ts`) modeled
  byte-for-byte on `WormBossVfx`: fixed typed-array table (cap **64 rows shared across ALL
  casters**), one Graphics per band, no tweens in the hot path. When the table is full, new
  requests steal the oldest row (worm's `borrow()` cursor) — spectacle softens, never spikes.
- Remote casters render at **spectator tier** automatically: afterimages 4→2, particle counts
  ×0.6, no screen-space accents, shake via the 760 px falloff + 700 ms duty gap, zero hit-stop,
  zero camera flash. Distance does the LOD for free.
- The pack frame-budget already serializes pathological same-frame stacks; ultimates must treat
  a `playFxPack === false` return as "procedural core only" (every call site in §2 has a
  procedural floor under it, same as `spawnExplosion`).
- Nothing allocates in `update`: all per-frame drawing goes through the pooled Graphics; images
  are pre-created invisible (xp-motes constructor pattern).

---

## 4. Telegraph readability — the friendly/hostile contract

Enemy danger must stay readable through four simultaneous ultimates. Three mechanisms:

1. **Depth (the hard guarantee).** Danger geometry renders above spectacle, verified in code:
   ground truth at depth 3 > our residue at 2; tells at 99997 > our air band ≤99700 > our
   screen accents ≤99850 < worm edge tell 99900 < vignette 99998. No ultimate object may be
   created in [99900, 100000). During the paper fold, ground truth rises to 99989 — ult residue
   does NOT follow (it belongs to the world page being folded away).
2. **Styling (the semiotic guarantee).** Player-owned ground marks are: **cool or desaturated
   hue (never the red/amber/warning family), stroke-only (no filled interiors), thin (≤2.5 px),
   converging or static (never expanding)**. Enemy telegraphs are filled, warm, expanding.
   A squadmate at a glance: expanding warm fill = leave; thin cool ring = a friend is about
   to be awesome.
3. **Contrast headroom (the photometric guarantee).** Within 120 px of any live telegraph edge,
   ultimate additive layers cap cumulative alpha at ~0.6 (in practice: skip the `hot` band of a
   pack when its center lands on an active telegraph — one `if` at the call site). The white
   tell (alpha up to 0.9+, pulsing) always wins the local contrast fight.

---

## 5. Reduced-flash / accessibility variants

Existing hooks: `prefersReducedPaperMotion()` (`ArenaScene.ts:236`, `prefers-reduced-motion`)
already gates paper cinema and xp-mote scatter. There is **no reduced-flash setting yet** —
add one: `dd.vfx.reducedFlash` in localStorage (the `dd.audio.*` persistence pattern), default
= the `prefers-reduced-motion` media query, toggle in the pause/settings surface.

Under reduced-flash, every ultimate keeps its full **information** and loses its **strobe**:

| Full | Reduced |
|---|---|
| `cameras.main.flash(...)` | never; replaced by a 120 ms dangerVignette-style edge pulse in the element color, alpha ≤0.25 |
| Additive core/hot bands at alpha ~1 | alpha capped 0.55; `hot` band skipped entirely |
| Multi-pulse / flicker (dash speed-lines, teleport streak flicker) | single steady element, one fade |
| Zoom pulse (teleport) | dropped |
| Shake | ×0.5 intensity (duration unchanged — the beat survives) |
| Hit-stop | unchanged (it is stillness, not flash — and it's a competitive-integrity beat) |
| Afterimages, ribbons, wisps, residue, audio | unchanged — these carry the read |

Reduced-motion (already-shipped query) additionally: converge particles teleport to 30% travel
(xp-motes' `scatterRadius` clamp pattern), afterimage count 4→2, comet drip 12→6.

---

## 6. Asset plan — compose now, render later

**Zero new rendered assets required.** Every script above is built from: the 12 fx packs, the
96 particle packs, the 8 impact flipbooks, `vfx-soft/streak/spark` procedural textures, PER
ropes, SpriteRig pose channels, Graphics, and new AudioBus recipes (procedural). New CODE files:
`vfx/ult-vfx.ts` (shared pool) and ~6 new switch cases in `AudioBus`.

**Deferred wishlist (Codex resets Aug 15)** — nice-to-haves that would upgrade, not unlock:

1. `fx-pack-phase-rift` — a torn-page void rift spread (entry/exit mouths) for Phase Attack;
   until then void-implosion + streaks carry it.
2. `fx-pack-arcane-gate` — a fold-out origami gate for the teleport destination (would replace
   the procedural reticle flare).
3. A 6-frame **comet flipbook** (256 px, fire) for the fireball travel core; the vfx-soft +
   spark composite is the stand-in.
4. **Crater decal set** (3 painted craters, trimmed PNGs, `decals/` pipeline) so nuke-tier
   aftermath leaves painted earth instead of a flat scorch circle.
5. Per-character **ult cut-in card** art (the card-art pipeline exists in
   `scenes/arena/card-art.ts`) — a 400 ms paper cut-in for the caster's face on activation;
   pure luxury, panel can debate whether it fights the top-down readability.
6. A dedicated **wisp sheet for heat-haze** (transparent refraction-look ripples) — fire/phase
   shimmer currently borrows `fire-wisp`/`void-wisp`.
