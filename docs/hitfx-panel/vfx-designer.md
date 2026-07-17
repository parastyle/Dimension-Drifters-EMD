# Hit FX Panel — VFX Designer: The Visual Hit Language (SIGHT)

**Directive:** "make hit effects satisfying including all our senses." This document owns SIGHT.
**Hard constraint:** image generation is exhausted — every recipe below composes ONLY from assets and
primitives that already exist in the repo. No source files are modified by this document.

## 0. What exists today (audit summary, with file truth)

| System | Where | What it gives us |
|---|---|---|
| Victim flash | `SpriteRig.flash(ms, color)` — `packages/client/src/entities/SpriteRig.ts:2372` | FILL-tint all parts, timer-guarded; called white/gold from `updateCombatFx` (`ArenaScene.ts:7141`) |
| Hit detection (client) | `ArenaScene.updateCombatFx()` `:7100` | hp-delta per enemy + synced `critFlash` counter; attacker/element guessed by **nearest player** (`:7159-7177`) |
| Authoritative receipts | `CombatReceiptState` — `packages/shared/src/state.ts:320`; written in `GameRoom.ts:2118`; `COMBAT_RECEIPT_CAP = 32` (`constants.ts:356`) | per-hit: target, sourcePlayer, weapon, delivery (Melee/Gun/Cast/Thrown/Beam/Quake/Chain/Parry/Scatter), element, **normalized dirX/dirY**, damage, crit, finalBlow. **Client only consumes this for self-damage attribution (`ArenaScene.ts:6946`) — enemy hit FX does not read it yet.** |
| Painted particles | 96 packs, 12 elements × 8 shapes (bolt/mote/orb/ring/shard/spark/splat/wisp), ~10-12 frames each, 96px — `vfx/particle-manifest.ts`; `particleBurst()` + `elementPack()` in `vfx/particles.ts` | directional cone bursts, per-particle spin/fade/sink, graceful no-op |
| Impact flipbooks | 8 elements × 6 frames × 256px, additive, 270ms — `spawnImpactFlipbook` in `scenes/arena/vfx.ts:394`, depth 99500 | the per-element contact bloom, sized to victim diameter |
| Component FX packs | 12 packs (nuke, frost-nova, quake-burst, grave-call…) — `vfx/fx-composer.ts`, 10-per-frame budget | big-moment island choreography (core/hot/rings/shrapnel/wisps/ground) |
| Procedural hit stack | `spawnHitSpark` (directional sliver fan + white core, `:7307`), `spawnImpactRing` (`:7286`), `spawnSpeedLines` (converging focus streaks, `:7364`) | the current per-hit / big-hit / crit beats |
| Paper deaths | `deathPop` treatments crumple/flutter/tear/lite/pit — `SpriteRig.ts:1296`; budgets 12 full / 10 ordinary (`ArenaScene.ts:190`); tough gets `tear` | the kill moment's body language |
| Kill accents | `spawnPoof` + `spawnWeaponKillFx` (storm-call/buzzsaw-wake/tide-crash for semantic families) — `scenes/arena/vfx.ts:759` | family-flavored kill garnish |
| Beams | `BeamRenderer.ts` — 4-layer capsule + painted wisp/bolt ropes; endpoint white circle (`:351-354`); per-target damage cadence 50–250ms | sustained-contact delivery |
| Worm boss | `WormRig.ts` — 92ms white card tint on integrity drop (`:1017-1018`) | boss-segment hit feedback (tint only today) |
| Budgets | `HIT_VFX_BUDGET = 10` full stacks/frame, `DAMAGE_NUMBER_BUDGET = 24`, fx-pack 10/frame, hit-stop leaky bucket 250ms/1000ms | pooling idioms to mirror |
| Layer bands | ground 0–9 · beams 9990–9992 · VfxPlayer bloom root 99000 · flipbooks/particles 99500 · grab 99988 · parry 99989 · **telegraphGfx 99997 (protected)** · dangerVignette 99998 · edge/pit 99999 | the discipline to codify — with one violation found (§8) |

The single most valuable structural move for SIGHT: **switch enemy-hit visual dispatch from
hp-delta + nearest-player guessing to the combat-receipt ring.** Every recipe below assumes the
receipt is the input: it supplies true attacker, true weapon/element, true direction, crit, and
final-blow — the exact fields the visual language needs. (This completes improve2-panel finding #7
on the client side; the server half already shipped.)

---

## 1. Victim reaction — the first 150 milliseconds

The victim IS the hit effect. Particles decorate; the body confirms. Three stacked reactions,
all driven from one receipt:

### 1a. Hit flash — two-phase, element-coded

Today's flash is a flat white/gold FILL for 80–150ms. Upgrade to a **two-phase flash** using the
existing `flash()` plumbing (one extra delayed tint swap, zero new objects):

- **Phase 1 — POP (0–50ms):** pure white `0xffffff` FILL on every part. White is the universal
  "contact" frame; it must stay white for every element or reads die in a horde.
- **Phase 2 — HUE (50ms → end):** swap FILL to the element's flash color (table below), then
  `restTint()` at expiry. The hue phase is what tells you *what* hit it after the pop tells you
  *that* it hit.

| Tier | Total duration | Phase-2 color |
|---|---|---|
| T0 tick (dmg < 6) | 60ms | none — white pop only |
| T1 normal (6–17) | 80ms | element flash color |
| T2 heavy (18–39) | 120ms | element flash color |
| T3 big (≥ 40) | 120ms | element, plus §2 ring |
| CRIT (modifier) | 150ms | always gold `0xffdb63` — crit outranks element |

Element flash colors (reuse the canonical `ELEMENT_SPARK` / `ELEMENT_COLOR` hexes so melee sparks,
bullets, and flashes agree): fire `0xff6a2a`, frost `0x6fd6ff`, shock `0xffe24a`, holy `0xffe6a0`,
toxic `0x9cff3b`, void `0xb14bff`, arcane `0x8f6aff`, physical/steel `0xd6dde6`.

**Anti-strobe cap:** a rig may begin at most **4 flashes per second**; the 5th+ hit inside the
window *extends* the current hue phase instead of re-popping white. This is both the epilepsy
guard and the entry ramp to the rapid-hit compression law (§5).

### 1b. Directional squash — the paper snaps toward the blow

The receipt's `(dirX, dirY)` is the blow vector (attacker → victim). One-frame reaction, recovering
over 90ms, on the rig's existing procedural scale/rotation channels (the same vocabulary as
`landSquash` and the §20 momentum flinch — no new machinery class, a new small input to it):

- **Compression:** scale the body **0.90 on the axis closest to the blow** — practically, since rigs
  expose scaleX/scaleY: `|dirX| > |dirY|` → scaleX ×0.90, else scaleY ×0.90 — with the complementary
  axis ×1.05 (paper conserves area; it buckles, it doesn't shrink).
- **Rotation kick:** ±0.06 rad, sign = `sign(dirX) × sign(dirY-ish)` so the sheet visibly *tips away*
  from the attacker. Crit doubles the kick to 0.12 and adds one overshoot oscillation (a single
  `sin` ruffle, matching the deathPop ruffle idiom).
- **Recovery:** smoothstep back over 90ms (T1) / 130ms (T2+). Cap the accumulated squash at 0.80
  scale so a beam can't iron an enemy flat.
- **Momentum handoff:** additionally feed `dir × min(damage, 40) × 4` px/s into the existing Stage-A
  flinch impulse so heavy hits also *shove* the lean, unifying knockback and hit react.

### 1c. Paper-cutout flinch — the identity beat

The art identity is "painted paper on a top-down table." The flinch that sells it: on T2+ hits, the
body does a **half-frame edge-on flicker** — scaleX (or Y) dips through 0.35 for exactly one frame
before the squash recovery, like a card catching the light as it's struck. This is one extra scale
keyframe inside 1b, costs nothing, and is unmistakably *this game*. Suppressed when
`prefersReducedPaperMotion()` is true (flag already exists and already gates paper deaths).

**Boss segments (WormRig):** keep the 92ms white card tint, add a **3% card pinch** (scale 0.97 on
the hit card only, 1-frame, recovering over 80ms) driven by the same integrity-drop edge at
`WormRig.ts:1017`. Cards are pooled images; this is two multiplies. No rotation kick — a 12-segment
body wobbling per hit reads as noise.

---

## 2. Impact burst — directional truth from the receipt

Replace the nearest-player direction guess in `spawnHitSpark` with the receipt's `(dirX, dirY)`.
The burst cone's **bisector must be the receipt vector** and its origin must sit on the victim
within ~8px — this single rule is most of "causality" (§6).

Per-element burst recipe — all from existing `PARTICLE_PACKS` via `elementPack()`, all through the
existing `particleBurst()` (counts are the T1 baseline):

| Element | Primary pack (shape) | Secondary | Blend | Notes |
|---|---|---|---|---|
| physical/steel | `steel-shard` ×2 | `steel-spark` ×1 add | — | steel bites, sparks fly |
| fire | `fire-shard` ×2 | `fire-spark` ×1 add | add | embers ride the slivers |
| frost | `frost-shard` ×3 | — | normal | ice chips, no glow — frost is *matte* |
| shock | `shock-bolt` ×2 | — | add | jagged bolts, high speed (×1.3) |
| holy | `holy-spark` ×2 | — | add | rising drift: sink −6 (floats up) |
| toxic | `toxic-splat` ×2 | — | normal | wet, low speed (×0.7), sink 16 |
| void | `void-mote` ×3 | — | add | **inverted**: spawn at cone end, converge inward (negative speed) — void swallows |
| arcane | `arcane-mote` ×2 | `arcane-spark` ×1 add | add | — |

Damage-tier sizing (multiplies the baseline):

| Tier | Count | Scale | Life | Extras |
|---|---|---|---|---|
| T0 tick | 0 | — | — | flash only — ticks must stay cheap and quiet |
| T1 normal | ×1 | 0.38 | 300ms | white core pop (existing, 5px) |
| T2 heavy | ×2 | 0.46 | 340ms | + procedural sliver fan (existing, 4) |
| T3 big | ×2 | 0.55 | 380ms | + `spawnImpactRing` + one `elementPack(el,"ring")` frame, additive, 0.5→1.0 scale over 240ms |
| CRIT | as tier | +20% | +40ms | + §3 signature; slivers go gold |

The **impact flipbook** (`spawnImpactFlipbook`) stays exactly where it is — T1+ full-stack hits,
sized to victim diameter, gated by `HIT_VFX_BUDGET`. It is the painted "bloom"; the particles are
the directional "debris." Bloom radial + debris directional = one hit that reads both *where* and
*from whom*.

---

## 3. Crit distinction — a shape, not a size

Everything else in the game is radial (rings, blooms, poofs) or a cone fan. The crit signature must
be recognizable in **one frame** from a shape class nothing else uses: the **four-point gold star**
(the classic "glint"), oriented to the blow.

Recipe (pure primitives — two rectangles, zero assets):

- Two crossed additive rectangles, gold `0xffdb63`, one aligned to the receipt direction
  (long: 46×3px) and one perpendicular (short: 26×3px), plus the existing white core at 1.4×.
- **Spawn at FULL size, frame one.** Shrink-and-rotate out over 90ms (scale→0.2, rotation +0.35 rad,
  alpha→0). Growing effects need three frames to read; a shape that *starts* complete reads in one.
- Layer order: star above the flipbook, below the protected band (§8).
- Keep the existing crit stack around it: gold flash (§1), gold damage number, converging speed
  lines, +70ms hit-stop. The star is the *identifier*; the rest is the *weight*.

Never use the star for anything else — not level-ups, not parries (parry is the white ring language,
§8 white-tell), not loot. One shape, one meaning: **you rolled the spike.**

---

## 4. Kill pop — the accent layer per size tier

The paper deaths (crumple/flutter/tear/pit) are already excellent body language. What's missing is
the **accent** that scales the ceremony to the corpse. Driven by the receipt's `finalBlow` flag —
which also finally gives the corpse launch and kill-FX the TRUE killer's direction and weapon
(replacing the nearest-living-player approximation at `ArenaScene.ts:3381-3400`).

| Tier | Body (exists) | Accent (new, composed) | Budget note |
|---|---|---|---|
| **Normal** | crumple/flutter/tear + poof | 3× `elementPack(killerElement, "mote")` drifting UP (sink −8, life 500ms, scale 0.3) — "the spirit leaves the paper" | inside the existing full-stack budget; skipped when the paper death degrades to `lite` |
| **Tough** | reserved `tear` treatment | + one `elementPack(el, "ring")` additive ring at 1.2× body (240ms) + 5 shards along the finalBlow direction + the existing `spawnWeaponKillFx` family pack | tough kills are ≤2 concurrent by the paper-death reservation — safe |
| **Boss segment** (worm sever / boss death) | worm sever visuals + boss ceremony | one **component FX pack** by element: void→`grave-call`, frost→`frost-nova`, shock→`lightning-ball`, holy→`holy-smite`, toxic→`toxic-burst`, fire/physical→`ember-eruption`, at `radius = segment renderScale × 40` — plus priority hit-stop (bypasses the bucket, like parry) | fx-composer's 10/frame gate already bounds this |

Rule of rungs: each tier adds **one** new element over the tier below. Normal = motes. Tough =
motes + ring + directional shards. Boss = all that + a composed pack + priority freeze. Never
scale by "same thing but bigger" alone — players habituate to size in minutes but not to *new
members joining the chord*.

---

## 5. Rapid-hit visual compression — the exact law

Beams tick each target every 50–250ms; fast melee (dual daggers, buzzsaw) lands 5–10 hits/s.
Discrete per-hit bursts at that rate are strobe + object spam + meaning loss. The law, per victim,
measured from receipt inter-arrival time `Δ` (a 3-hit rolling average):

| Regime | Condition | Presentation |
|---|---|---|
| **DISCRETE** | Δ ≥ 240ms (≤ ~4 hits/s) | full per-hit stack (§1–§3), unchanged |
| **THINNED** | 125ms ≤ Δ < 240ms (4–8 hits/s) | burst on **every second receipt** (seq parity) at 70% scale; flash obeys the 4/s cap (extends hue, no re-pop) |
| **SHIMMER** | Δ < 125ms (> 8 hits/s) | discrete bursts STOP. One pooled **contact shimmer** anchors to the victim: a single additive element-tinted quad (existing `spark` pack frame, scale 0.5) at the contact point, alpha oscillating 0.35–0.65 at **2Hz sinusoidal** (never per-hit), dripping 2 shards/second along the current receipt direction. Victim holds a steady phase-2 hue tint (no white re-pops). |
| **RELEASE** | 300ms with no receipt | shimmer closes with **one full T2 burst** — the "letting go" beat that gives sustained contact a punctuation mark it otherwise never gets |

Break-through events (always render regardless of regime): **crit** (star + gold flash, though the
star at >8 hits/s is rate-limited to 1 per 250ms), **finalBlow** (full kill pop), **T3 first entry**
(the first ≥40 hit in a shimmer window still rings).

Why 125ms/240ms: 240ms is just above the flash-cap period (4/s) so DISCRETE and the anti-strobe cap
agree; 125ms is the beam's fastest damage cadence's double — any beam at min cadence lands in
SHIMMER by its third tick, which is the intent: beams should *look* like sustained contact, not
machine-gun confetti.

Worst-case math (the panel's stress case): **4 players × beam × 6 enemies = 24 sustained contacts.**
Uncompressed: 24 targets × up to 20 ticks/s × ~8 objects/burst ≈ **3,800 objects/s**. Under the law:
24 shimmer anchors (1 quad each) + 48 drip shards/s + 24 held tints ≈ **75 live objects** steady-state.
Pool: **32 shimmer anchors** (mirrors `COMBAT_RECEIPT_CAP`), steal-oldest, same idiom as VfxPlayer's
surface pool.

---

## 6. Muzzle-to-victim causality — does the eye connect action to reaction?

The chain the eye must never lose: **input → muzzle/blade → trajectory → contact → victim react.**
Audit of each delivery:

| Delivery | Trajectory truth today | Gap | Fix (composition only) |
|---|---|---|---|
| Gun | projectile sprites fly; bullet impact at death point (`spawnBulletImpact`) | none structural | keep; burst dir from receipt |
| Melee | painted ribbon matches descriptor active window (§44) | contact burst direction was *guessed* | receipt dir; ribbon tip and burst origin already coincide via server hit |
| Beam | 4-layer capsule + endpoint circle | endpoint circle marks the beam END, not each victim | shimmer (§5) anchors per-victim; endpoint circle stays as the "beam terminus" cue |
| Cast/Thrown | projectile death = burst origin | none | keep |
| Chain | ArenaScene bolt via bloom root | hops can outrun the eye | on each receipt with `delivery=Chain`, the victim's white pop is delayed 30ms × hop index — the flash *travels*, restoring sequence |
| Quake | cursor-epicenter VFX | victims at the rim react simultaneously with no vector | quake receipts carry dir from epicenter — bursts point radially out; that's already what the receipt's source→target vector encodes |

Two global rules:

1. **The cone points away from the cause.** Burst bisector = receipt dir, always. A player watching
   any fight can trace every spray of shards backwards to its attacker.
2. **Ownership brightness.** Receipts where `sourcePlayerId === self`: full alpha/scale. Teammate
   receipts: 75% alpha, 85% scale, and teammate crits show the star but skip the speed lines +
   extra hit-stop. In 4-player play *your* damage must pop out of the pile — co-op satisfaction is
   knowing which hits were yours.

---

## 7. Off-screen edge feedback — your hits landing beyond the frame

New, small, screen-space, receipt-driven. When `sourcePlayerId === self` and the target is outside
`cameras.main.worldView`:

- Draw a **10px element-tinted wedge** (triangle, 2 primitives) on the screen edge where the line
  self→target exits, `setScrollFactor(0)`, alpha 0.5, expiring over 150ms.
- **Crit:** gold, 1.4×, 220ms. **Kill:** wedge + a 6px white square that does a 150ms crumple-spin
  (scale 1→0.3, rotation +1.2 rad) — the paper-death glyph in miniature.
- **Compression:** hits within ±10° bearing inside 200ms merge into one wedge that brightens
  (alpha +0.15 per merge, cap 0.9) instead of stacking. Pool of 6 wedges, steal-oldest.
- Depth: 99860 (top of spectacle band) — visible over the world, under telegraphs/vignette/HUD.
- Damage numbers stay on-screen-only exactly as today; the wedge replaces nothing, it adds the
  "your DoT/turret/beam is still working out there" heartbeat that bullet-heavens live on.

---

## 8. Layer & depth discipline — danger above spectacle, codified

Current truth: exact ground danger at depth 3 (`telegraphGroundGfx`), response edges/source cues at
**99997** (`telegraphGfx`, documented "Protected response-edge/source layer above combat VFX and
below HUD"), parry ring 99989, grab 99988, danger vignette 99998, pit markers 99999.

**Violation found:** the hit stack currently invades the protected band —
`spawnSpeedLines` at **99997** (ties the protected telegraph layer; same-depth resolves by display
list order, so a speed line created after the telegraph redraw can sit ON the response edge),
`spawnHitSpark` slivers 99996 / core 99995, `spawnImpactRing` 99994 — all above the parry ring
(99989). A crit celebration can occlude the parry glint. This contradicts the established
hierarchy (bigsword panel: "hostile danger first, confirmed consequence second, weapon flavor
third").

**The band law (prescriptive):**

| Band | Depth | Contents |
|---|---|---|
| Ground truth | 0–9 | floor, scorch, ground danger gfx, fx-pack `ground` islands, beam ground light |
| Actors | 10–9989 | rigs, worm, pickups |
| Beams | 9990–9992 | exact damaging capsules (never culled) |
| **SPECTACLE** | **99000–99860** | VfxPlayer root (99000), flipbooks/particles (99500), fx-pack bands (99470–99520), and — MOVED DOWN — impact ring → 99820, spark core → 99830, slivers → 99840, crit star → 99845, speed lines → 99850, edge wedges → 99860 |
| **PROTECTED** | **99880–99999** | grab 99988, parry 99989, fold-mode ground danger 99989, telegraphGfx 99997, danger vignette 99998, pit/edge 99999 |
| HUD | 100000+ | text, bars, banners |

Nothing receipt-driven may exceed **99860**. The gap 99861–99879 stays empty as the firebreak.
Budgets stay on the existing idioms: `HIT_VFX_BUDGET` 10 full stacks/frame (receipt consumption
sorts on-camera first, exactly like today's stable sort), fx-composer 10/frame, shimmer pool 32,
wedge pool 6, hit-stop leaky bucket untouched.

---

## 9. Reduced-flash variants

`prefersReducedPaperMotion()` exists (gates paper deaths/motes); there is **no flash-reduction
setting yet** (only audio settings persist via the registry). Add a persisted `reduceFlash` toggle
next to the audio row; when ON:

- Victim flash: phase-1 white becomes soft `0xdedede` at 60% intensity; the 4/s cap tightens to 2/s.
- Impact flipbooks + additive bursts render at 0.55 alpha; crit star **keeps full shape but drops
  to 0.7 alpha** — meaning lives in the shape (§3), so reduced-flash players lose zero information.
- `cameras.main.flash(...)` sites (boss entrance, rift) reduce to 40% duration, 50% RGB.
- Shimmer's 2Hz pulse becomes a steady 0.5-alpha glow (zero oscillation).
- Speed lines and the edge-on paper flicker (§1c) turn off; squash/rotation stay (motion, not flash).
- Danger/telegraph/parry layers are NEVER dimmed — safety information is exempt by definition.

---

## 10. Ship list — composed entirely from existing assets

No image generation required anywhere in this design:

1. **Receipt-driven dispatch** — read `state.combatReceipts` (dedupe by `seq`), replace hp-delta
   direction/element/attacker guessing. Unlocks §1, §2, §4 direction truth, §6, §7.
2. **Two-phase element flash + anti-strobe cap** — `SpriteRig.flash` extension (tints only).
3. **Directional squash + paper flicker** — rig scale/rotation channels, no new objects.
4. **Element burst table (§2)** — `particleBurst` + `elementPack` over the 96 existing packs.
5. **Crit star** — two additive rectangles.
6. **Kill accents (§4)** — motes/rings/shards from packs + existing `spawnWeaponKillFx` +
   fx-composer packs for boss tiers.
7. **Compression law + shimmer pool (§5)** — one pooled quad per contact using existing spark
   frames; VfxPlayer-style steal-oldest pool.
8. **Edge wedges (§7)** — screen-space triangles.
9. **Depth re-banding (§8)** — constants-only change to five `setDepth` calls.
10. **`reduceFlash` setting (§9)** — registry-persisted toggle, same pattern as AudioBus settings.

Priority if the panel must cut: 1 → 2 → 5 → 7 → 9 (causality, victim truth, crit identity,
horde survival, safety discipline). Everything else is garnish on a correct skeleton.
