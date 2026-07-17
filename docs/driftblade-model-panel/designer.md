# Driftblade-Model Panel — Combat Animation / VFX Design

## Charge and decision

Directive: Driftblade's combo and VFX become a **model** for two-handed swords — like-combos and like-VFX, not the same combo or the same asset — applied to **about 40% of them**, not all.

Decision: adopt the Driftblade structural language on **four** two-handed swords — **Gravechill Nodachi, Stormpetal Odachi, Hailwidow Katana, Voltfang Tachi** — each with its own three-beat chain and its own PER ribbon identity built strictly from the existing painted-edge-ribbon and painted-fleck infrastructure. Every other two-handed sword keeps its shipped identity untouched (§ Do-not-touch).

The model + 4 adopters = 5 of the 14 two-handed swords in `WEAPONS` (36%), or 5 of the 12 that can physically carry a discrete three-beat sword grammar (42%) once the two grammar-incompatible blades (Dervish's continuous spin, Buzzcutter's powered saw) are set aside. That is "like 40%."

Everything below is Stage-1 presentation on the shared descriptor clock. Damage stays the single accepted centered server sweep; `path` fields are dormant authoring, exactly as in the shipped big-sword panel (`docs/bigsword-combos-panel/`).

---

## 1. The model — what Driftblade actually is, in numbers

Driftblade (`driftblade`: XL `sword`, `displayLength 320`, `range 300`, `cooldown 0.62`, `swingArc 2.3`, `gripFrac 0.05`) resolves to the `greatsword` variant in `packages/shared/src/melee.ts`:

| Beat | Step | activeStart | activeEnd | impact | followEnd | path | rangeMult | dmgMult | kb |
|---|---|---|---|---|---|---|---|---|---|
| 1 | shoulder chop (`chop[0]`) | 0.24 | 0.52 | 0.52 | 0.66 | sweep ×0.75 | 1.00 | 1.00 | 0 |
| 2 | pommel bash | 0.12 | 0.30 | 0.28 | 0.44 | capsule | 0.55 | 0.75 | 28 |
| 3 | true charged step-slash | 0.46 | 0.64 | 0.61 | 0.80 | fan ×0.72 | 1.12 | 1.25 | 96 |

Pose = `0.62 × SWING_WINDOW_FRAC 0.64 = 0.3968 s` per beat. Rendering: beat 1 rides the chop pose branch; beats 2–3 are the bespoke `applyPommelBash()` / `applyTrueChargedSlam()` branches in `packages/client/src/entities/SpriteRig.ts` (hand spacing 0.42H → 0.24H → 0.34H, finisher `weaponLengthScale 1 → 0.22 → 1.04` recoil, depth swaps, 0.03-pose deformation beat at 0.61–0.64, planted hold to 0.80).

PER baseline (live pipeline, `packages/client/src/vfx/vfx-render.js` + `VfxPlayer.ts`): reach = `meleeReach` = max(300, 0.95×320) = **304 px**; XL band → body **38 px**, lip **9 px**; historyAngle = min(2.3×0.34, 0.85, artCap 0.88) = **0.782 rad**; orbit-style alphas body ≤ **0.72**, lip ≤ **0.54**; follow fade = clamp(active×0.22, 0.035–0.09 s).

### The extracted rules (what adopters inherit)

These are the structural invariants — the "like" in like-combo. Fantasy, direction, motion names, and ribbon shape are what each adopter must make its own.

- **T — timing skeleton.** Beat 2's anticipation ≈ 0.5× beat 1's (0.12 vs 0.24) and its contact fraction ≈ 0.55× beat 1's (0.28 vs 0.52): the middle beat accelerates the phrase. Beat 3's anticipation ≥ 1.75× beat 1's (0.46 vs 0.24) and its impact sits inside the last 20% of its active window (0.61 in 0.46–0.64): the finisher is *loaded*, not just bigger. Follow ≥ 0.14 pose on every beat; finisher follow ≥ 0.16 with a planted hold.
- **C — step contrast with causality.** Silhouette classes go **large → compact → enormous**; attack class changes every beat (edge → short blunt/reversal → committed line); hand spacing changes every beat; at least one direction or grip reversal; each beat's held exit is the next beat's entry (the pommel's 0.44–1.00 follow *is* the finisher's load).
- **F — earned finisher.** dmgMult 1.20–1.25, the family's biggest knockback, one fake-3D projection trick (foreshorten / depth swap / hand slide), a ≤ 0.03-pose deformation beat at impact, and a hold that reads "planted," never a bounce back to idle.
- **R — ribbon follows blade truth.** Width comes from `PER_SIZE[tags.size]`, reach from `meleeReach`, history from `swingArc × size.history` (art-capped); alpha crests only at authored impact; **the compact beat never gets a full body ribbon** (Driftblade's pommel paints nothing — that silence is part of the model); one dominant business edge per accepted sweep, setup travel only as `neutral-dim` echo (shipped PER ribbon rule).

Driftblade's per-step ribbon evolution, made explicit so adopters can vary it: beat 1 = full crescent, plain end; beat 2 = **silence**; beat 3 = the widest, brightest paint of the cycle with the crest pinned to 0.61 and the longest visible follow. Adopters keep the *silence-then-crescendo* arc and change everything else.

---

## 2. Adopter selection — the ~40%

Census of two-handed swords in `WEAPONS` (base `weapons.ts` + `weapons-expansion.generated.ts`, grip `2H`, sword-shaped families): driftblade, tombstone-greatsword, x-sword-whirlwind (Dervish), x-sword-buzzsaw (Buzzcutter), x-sword-anchor (Drowned Anchor), x-sword-coffin (Reaper's Lid), x-sword-bone (Wyrmtooth), x2-hailwidow-katana, x2-gravechill-nodachi, x2-voltfang-tachi, x2-tombwarden-claymore, x2-riftcleaver-greatblade, x2-dustreaper-zweihander, x2-stormpetal-odachi — **14 total**.

**Adopters (4):**

| Weapon | Data | Today | Why it fits the model |
|---|---|---|---|
| `x2-gravechill-nodachi` | nodachi XL, dLen 330, cd 0.66, quake | routed to Driftblade's literal `greatsword` sequence via `bigSwordPanelVariantFor` | Nodachi-adjacent long precision cutter — but it is currently a *clone*, which is exactly what the directive forbids. It needs a like-combo, not the same combo. |
| `x2-stormpetal-odachi` | nodachi XL, dLen 335, cd 0.64 | same literal clone | Same lineage, same problem. |
| `x2-hailwidow-katana` | katana M, dLen 128, cd 0.30 | `orbit` → **no combo at all** (katana misses every variant regex) | A fast two-handed edge-precision cutter with no chain — the purest adopter; proves the skeleton is scale-free at a 0.192 s pose. |
| `x2-voltfang-tachi` | katana M, dLen 126, cd 0.32 | `orbit` → **no combo at all** | Same lane, distinct element fantasy (volt vs hail). |

**Divergence from a pure fantasy-fit reading, justified.** A pure "edge-precision cutter" reading would also claim `x2-riftcleaver-greatblade` (an energy blade *sounds* like a precision cutter) and possibly `x-sword-buzzsaw` (fast edge). Both are excluded: Riftcleaver's stats read heavy-wide-slow (dLen 142, swingArc 3.0, cd 0.70) and it ships with the Momentum flywheel identity — moving it would repaint a shipped weapon for a naming coincidence; Buzzcutter's fantasy is continuous grind, which has no discrete beats to hang the T-skeleton on (the shipped panel already ruled it needs a powered-saw grammar). Conversely, Gravechill is included despite `quake:true` and a `chop` descriptor because the ship list already asserts it belongs in the Driftblade lane — the fix is giving it its own chain, not evicting it.

**Routing.** All four get explicit `comboVariant` metadata (the seam the shipped panel names as correct ownership): `nodachi-coldcourt`, `nodachi-petalfall`, `katana-threehails`, `katana-thunderlag`. Gravechill and Stormpetal leave the `greatsword` case of `bigSwordPanelVariantFor`; Driftblade's own `greatsword` sequence stays byte-for-byte.

**New motion vocabulary (8, with shared chassis):** `draw-cut`, `guard-check` (shared by Gravechill + Hailwidow beats 2), `choked-turn`, `coil-drag`, `sentence-fall` and `thunder-fall` (one parameterized hang-then-fall SpriteRig chassis, two paints), `petalfall`, `splinter-fall` (light overhead chassis). Openers reuse existing motions (`shoulder-chop`, `slash`) with new frozen step objects carrying adopter timing — the same construction pattern the `greatsword` variant itself uses.

---

## 3. Adopter A — Gravechill Nodachi: "Cold Court" (`nodachi-coldcourt`)

**Fantasy:** the executioner's nodachi from a frozen courtroom. Where Driftblade *flows*, Gravechill *deliberates*: every beat has a held stillness before it, and the finisher is a sentence being carried out. Ice paint, crystalline edges, frost that lingers where the blade was.

Pose = 0.66 × 0.64 = **0.4224 s**. Descriptor style `chop` (quake): active 0.30–0.52, impactSeconds at 0.52 of pose; PER chop alphas body ≤ 0.78, lip ≤ 0.36, crest window ±0.03 s at impact. Reach = max(300, 0.95×330) = **313.5 px**; XL band 38/9; historyAngle = min(2.4×0.34 = 0.816, 0.85, artCap 0.85) = **0.816 rad**.

| Beat | Step | Motion | Dir | activeStart | activeEnd | impact | followEnd | path | rangeMult | dmgMult | kb |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Drawn Frost | `draw-cut` | −1 | 0.26 *(DB 0.24)* | 0.54 | 0.54 *(DB 0.52)* | 0.68 | sweep ×−0.78 | 1.00 | 1.00 | 0 |
| 2 | Tsuba Check | `guard-check` | +1 | 0.14 *(DB 0.12)* | 0.30 | 0.30 *(DB 0.28)* | 0.46 | capsule | 0.50 *(DB 0.55)* | 0.70 | 24 |
| 3 | The Sentence | `sentence-fall` | +1 | 0.50 *(DB 0.46)* | 0.66 | 0.63 *(DB 0.61)* | 0.84 *(DB 0.80)* | fan ×0.68 | 1.12 | 1.25 | 96 |

Skeleton check: beat-2 anticipation 0.54× beat 1's; beat-3 anticipation 1.92× beat 1's; impact at 0.81 of the finisher window; every follow ≥ 0.16. Everything shifted 0.02–0.04 *later* than Driftblade — the whole chain breathes heavier, which is the grave-cold identity expressed inside the model, not despite it.

- **Beat 1 — Drawn Frost.** A *reversed* opener (dir −1 vs Driftblade's forehand +1): rising draw-cut from a low near-hip line to high across aim, blade broadside the whole way (contrast rule C satisfied by mirroring, not by copying). Hand spacing 0.44H, wide and formal. Exit: blade high on the off side — directly over the Tsuba Check's start.
- **Beat 2 — Tsuba Check.** Compact guard-punch: grip chokes 0.44H → 0.22H, the crossguard leads a short body-driven jab down aim. It is *not* Driftblade's pommel — the weapon does not reverse (`angle` stays near aim, guard forward), the body stays tall (no 0.92 scaleX crunch), and the exit travels *upward* into the two-hand executioner's raise rather than into a rear load. Follow 0.30–0.46 lifts the blade overhead; hold pose keeps it there — the courtroom pause.
- **Beat 3 — The Sentence.** Hang-then-fall chassis: hands overhead, `attackLiftPx` up to 0.06H, low-amplitude tremor during 0.50-loading (reuse the TCS tremor generator at 0.6× amplitude), then a `p²` vertical fall to a centered low plant. One fake-3D trick only: `weaponLengthScale 1 → 0.30 → 1.03` through the overhead-to-forward projection (the blade is briefly seen point-on from above). Deformation beat 0.63–0.66 (0.03 pose, same width as DB's 0.61–0.64). Hold to 0.84 — the longest planted hold in the family: the court adjourns slowly.
- **Quake honesty.** The server quake still detonates once per accepted attack on the `chop` descriptor's impactSeconds (0.52 of pose). Reuse the fulcrum-flip contact-remap seam so the visible ground-crack rides each step's *authored* impact (0.54 / suppressed on the check / 0.63); never let The Sentence's hang leave a shockwave firing on an empty frame.

**VFX (PER + flecks only):**

- Ribbon geometry keyed to the blade: body 38 px × per-step `widthMultiplier`; radial band per step below; history 0.816 rad × per-step multiplier. Ice element paint.
- **Beat 1:** `rising-plane`-family profile, radialStart 0.34 → radialEnd 1.0, widthMult **1.00**, end `clean`. Frost identity = lip-forward: author `lipAlpha 0.60` over the chop default 0.36 while capping `bodyAlpha 0.64` — a thin bright crystalline edge over a pale body. History ×**1.10** (cold air holds the trail).
- **Beat 2:** **no body ribbon** (rule R). One radial lip flash at the guard (clearance radius, ≤ 25% of the beat-1 edge opacity, neutral steel) — the shipped crossguard-spark budget from Rising Ward.
- **Beat 3:** `head-wedge`-family profile, radialStart 0.30 → 1.0, widthMult **1.28**, end `squared`. During the 0.34–0.50 hang, a `neutral-dim` setup echo paints the held overhead edge at ≤ 20% alpha. **Finisher signature — freeze-and-shatter:** at impact the ribbon *freezes* (hold `historyScale` at its impact value for 0.06 pose instead of the standard follow fade), then collapses at 2× fade speed. Impact accents: hoarfrost bloom = the existing radial dust tick in ice paint + 3–4 painted chips aligned with the fall line. No full shockwave ring; the quake crack is the ground's job.

---

## 4. Adopter B — Stormpetal Odachi: "Petalfall" (`nodachi-petalfall`)

**Fantasy:** wind through a flowering tree. The longest blade in the game moves like it weighs nothing; damage arrives as a gust, and the finisher scatters petals. Everything Gravechill does late, Stormpetal does slightly *early*.

Pose = 0.64 × 0.64 = **0.4096 s**. Descriptor `orbit` (like Driftblade): PER alphas body ≤ 0.72, lip ≤ 0.54. Reach = max(300, 0.95×335) = **318.25 px** — the longest reach of the family; XL band 38/9; historyAngle = min(0.816, 0.85, artCap 0.84) = **0.816 rad**.

| Beat | Step | Motion | Dir | activeStart | activeEnd | impact | followEnd | path | rangeMult | dmgMult | kb |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Crosswind | `slash` (reused) | +1 | 0.22 *(DB 0.24)* | 0.52 | 0.50 *(DB 0.52)* | 0.66 | sweep ×0.90 *(DB 0.75)* | 1.00 | 1.00 | 0 |
| 2 | Leaf Turn | `choked-turn` | −1 | 0.10 *(DB 0.12)* | 0.26 | 0.26 *(DB 0.28)* | 0.42 | capsule | 0.60 *(DB 0.55)* | 0.70 | 16 |
| 3 | Petalfall | `petalfall` | +1 | 0.44 *(DB 0.46)* | 0.62 | 0.59 *(DB 0.61)* | 0.82 | fan ×0.80 | 1.10 | 1.22 | 80 *(DB 96)* |

Skeleton check: beat-2 anticipation 0.45× beat 1's, contact fraction 0.52× beat 1's — the fastest middle beat in the family; beat-3 anticipation 2.0× beat 1's; impact at 0.83 of the finisher window.

- **Beat 1 — Crosswind.** Flat, *wide* horizontal forehand (arcMult 0.90 vs Driftblade's 0.75 — wind sweeps broad where the executioner chops narrow). Contact lands 0.02 before the edge stops: the breeze passes *through* the target rather than into it. Torso stays tall (0.96y at contact); reach comes from the 335 px art, not a lunge.
- **Beat 2 — Leaf Turn.** The compact beat is a **blade flip, not a strike-with-the-hilt**: grip chokes 0.42H → 0.20H and the odachi twirls once about the grip, `weaponLengthScale` dipping to 0.50 at the edge-on frame — the model's fake-3D budget deliberately relocated from beat 3 to beat 2 (an adopter-owned redistribution; the finisher then earns its size with travel, not projection). Direction −1; exit leaves the blade reversed and low behind the off hip.
- **Beat 3 — Petalfall.** A single-window S-cut: the blade rises reverse for the first 40% of active travel and falls forehand through aim for the rest (one continuous visual path; the accepted sweep is untouched, bright paint clipped to the legacy region per the shipped Stage-1 rule). Finisher flourish: two-frame blade overshoot `1.00 → 1.04 → 0.99` and a slow exhale settle — no plant, no crunch; the hold at 0.82–1.00 is a light high guard with one visible breath (spring settle), the anti-Sentence.

**VFX:**

- **Family identity: the thinnest, longest, most transparent ribbon on the biggest blade.** Body width ×**0.92** on every step (35 px effective vs Driftblade's 38 on a longer reach — airy); `bodyAlpha` capped **0.64** (vs 0.72); history ×**1.25** (art-capped — the longest trail in the family). Wind/petal paint (weapon element).
- **Beat 1:** full crescent, radial 0.30 → 1.0, end `clean`; `normalWobble` 1.5 px on the body rope (the only adopter that wobbles its ordinary cut — breeze).
- **Beat 2:** no body ribbon; a single thin lip streak (lip rope only, 0.4 alpha) tracing the twirl's edge-on flash.
- **Beat 3 — finisher signature: petal tear.** Radial 0.28 → 1.0, widthMult **1.20**, end `torn` shaped as three lobes (the torn-end budget from Runaway Cleave, re-proportioned smaller and triple). Wobble 0 until impact — the S-path itself is the interest. Impact accents: **3–5 painted petal flecks that drift down-aim** (directional, never radial — a gust, not a blast), using the existing painted-fleck channel. Post-impact fade is the standard follow fade — petals linger via flecks, not via ribbon.

---

## 5. Adopter C — Hailwidow Katana: "Three Hails" (`katana-threehails`)

**Fantasy:** staccato. Hail does not flow — it *arrives*, three times. This adopter proves the Driftblade skeleton is scale-free: pose = 0.30 × 0.64 = **0.192 s**, half Driftblade's, and every fraction still lands.

Descriptor `orbit`. Reach = max(140, 0.89×128) = **140 px**; **M band: body 22 px, lip 6 px** (ribbon width keyed to blade class — a 128 px katana must never paint a 38 px XL ribbon); historyAngle = min(2.3×0.22 = 0.506, cap 0.50) = **0.50 rad**.

| Beat | Step | Motion | Dir | activeStart | activeEnd | impact | followEnd | path | rangeMult | dmgMult | kb |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Hail | `shoulder-chop` (reused) | +1 | 0.24 *(= DB)* | 0.50 | 0.48 *(DB 0.52)* | 0.62 | sweep ×0.70 | 1.00 | 1.00 | 0 |
| 2 | Widow's Knock | `guard-check` (shared) | +1 | 0.12 *(= DB)* | 0.28 | 0.26 *(DB 0.28)* | 0.40 | capsule | 0.50 | 0.70 | 12 |
| 3 | Splinter | `splinter-fall` | +1 | 0.42 *(DB 0.46)* | 0.60 | 0.56 *(DB 0.61)* | 0.76 | fan ×0.75 | 1.10 | 1.20 | 48 |

Skeleton check: beat-2 anticipation 0.50× beat 1's, contact 0.54× beat 1's; beat-3 anticipation **1.75×** beat 1's — the rule's floor, deliberately: at a 0.192 s pose a Driftblade-scale 0.46 hang is an 88 ms hitch that would read as input lag, so the earned-finisher rule adapts by hitting its minimum rather than its maximum. Impact at 0.78 of the finisher window; follows compress to 0.14 exactly.

- **Beat 1 — First Hail.** Reuses the chop pose branch verbatim at katana scale; contact pulled to 0.48 so the cut *snaps* (impact 0.02 before activeEnd rather than on it — hail strikes and is gone).
- **Beat 2 — Widow's Knock.** Shares the `guard-check` chassis with Gravechill's Tsuba Check — at this pose the active window is **27 ms**, a pure stutter-frame, which *is* the hail fantasy; differentiation from Gravechill is carried entirely by paint and accents (rule: shared compact-beat chassis, distinct VFX). Exit rises into a short high load.
- **Beat 3 — Splinter.** Light overhead chassis: a compact overhead drop with a *half-scale* fake-3D trick (`weaponLengthScale 1 → 0.6 → 1.0` — the model's projection language at katana proportions), deformation beat 0.56–0.585 (0.025 pose), and a *short sharp* plant that releases by 0.76 — planted, but briskly, because the next accepted attack is only ~110 ms away.

**VFX:**

- **Family identity: crisp and terse.** History ×**0.60** (trail dies fast — staccato); `bodyAlpha` up to 0.72 but the follow fade uses the minimum 0.035 s clamp naturally at this speed. Ice-chip paint.
- **Beat 1:** crescent, radial 0.32 → 1.0, widthMult 1.0 (22 px), end `clean`; impact accent: **2 ice-chip flecks** at the exit point.
- **Beat 2:** silence — not even a guard spark (the beat is too short to read one; silence *is* the read).
- **Beat 3 — finisher signature: the splinter.** Radial 0.30 → 1.0, widthMult **1.15**, end `torn`. On the first follow frame the history strip **splits into two thin offset strips** — reuse the twin-profile rear-lobe mechanism (`updateArcRope` second strip at −0.39 body-width offset, 0.42 alpha) for the follow fade only. One ribbon cracks into two as it dies: hail splitting on stone. Impact accents: 3 ice-chip flecks, radial spread ≤ 30°.

---

## 6. Adopter D — Voltfang Tachi: "Fang, Then Thunder" (`katana-thunderlag`)

**Fantasy:** lightning leads, thunder follows. The strike is always slightly *before* you expect it, and the visual payoff always slightly *after*. Voltfang inverts Gravechill: contact early, paint late.

Pose = 0.32 × 0.64 = **0.2048 s**. Descriptor `orbit`. Reach = max(142, 0.88×126) = **142 px**; M band 22/6; historyAngle = min(2.4×0.22 = 0.528, cap 0.50) = **0.50 rad**. Note: the PER energy-family regex keys off `tags.family` ("katana"), so volt alphas must be authored via `params.bodyAlpha`/`params.lipAlpha`, not inherited.

| Beat | Step | Motion | Dir | activeStart | activeEnd | impact | followEnd | path | rangeMult | dmgMult | kb |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fang | `slash` (reused) | +1 | 0.20 *(DB 0.24)* | 0.46 | 0.44 *(DB 0.52)* | 0.60 | sweep ×0.72 | 1.00 | 1.00 | 0 |
| 2 | Coil | `coil-drag` | −1 | 0.14 | 0.30 | 0.30 *(DB 0.28)* | 0.48 *(DB 0.44)* | capsule | 0.50 | 0.70 | 12 |
| 3 | Thunder | `thunder-fall` | +1 | 0.48 *(DB 0.46)* | 0.62 | 0.56 *(DB 0.61)* | 0.78 | fan ×0.70 | 1.12 | 1.25 | 72 |

Skeleton check: beat-2 anticipation 0.70× beat 1's (the loosest in the family — allowed because beat 1 already fired early, so the *phrase* still accelerates); beat-3 anticipation **2.4×** beat 1's — the longest relative hang of any adopter, earned by beat 2's humming exit. Impact at 0.57 of the finisher window — the earliest in the family, on purpose: the fang lands early even on the finisher, and the *thunder* (paint, accents, hold) fills the remaining 0.22.

- **Beat 1 — Fang.** Standard forehand with everything pulled 0.04–0.08 early. The earliest contact fraction in the entire model family (0.44) — the signature stated in the first beat.
- **Beat 2 — Coil.** A reversed drag-*back*: the blade pulls in and low across the body (capsule, dir −1) while the grip chokes to 0.26H. The follow (0.30–0.48, longer than any other compact beat) carries a **low-amplitude tremor** — the TCS charge tremor at 0.4× amplitude — so the exit audibly "hums" into Thunder's load. This is the model's charge vocabulary relocated to beat 2's *exit* instead of beat 3's entry: causality rule C, adopter-owned.
- **Beat 3 — Thunder.** Shares the hang-then-fall chassis with Gravechill's Sentence (one SpriteRig branch, parameterized): shorter hang (0.48 vs 0.50), earlier fall, deformation beat 0.56–0.585, and a hold to 0.78 in a low forward point rather than a plant. Fake-3D: single depth swap on the fall; no length collapse (the length collapse stays Driftblade's and Gravechill's — Voltfang's trick is temporal, below).

**VFX:**

- **Family identity: lip leads, body lags.** On every step the **lip rope leads the body ribbon** by 0.03 of the active window (bright edge line first), and the body's alpha ramp is delayed: `smooth01((q − 0.12) / 0.15)` instead of `smooth01(q / 0.15)`. Author `lipAlpha 0.66`, `bodyAlpha 0.60`. Volt paint; `normalWobble` **2 px with phase jitter on the lip rope only** — a jagged bright filament over a smooth dim body.
- **Beat 1:** crescent, radial 0.32 → 1.0, end `open` (arcs bleed past the tear-off rather than tapering).
- **Beat 2:** no body ribbon; during the 0.30–0.48 humming follow, a `neutral-dim` echo of the coiled blade at ≤ 20% alpha with the 2 px lip jitter — the charge is visible but never reads as a hit.
- **Beat 3 — finisher signature: thunderlag.** Radial 0.30 → 1.0, widthMult **1.18**, end `open`. The body ribbon's **peak alpha lags the blade by 0.04 pose** (crest at 0.60 for a 0.56 impact): lightning (lip, on time) then thunder (body mass, late). History ×0.80 but the *follow fade* is stretched to the 0.09 s clamp maximum — the boom rolls out. Impact accents: **two short jagged filaments** drawn with `updateLinearRope` (wobble 3 px, 0.5 alpha, ≤ 0.35× reach long) forking from the impact point — painted flecks in rope form, not a chain-lightning mechanic and never a damage implication.

---

## 7. Cross-family contrast table (the four must never blur)

| | Gravechill | Stormpetal | Hailwidow | Voltfang |
|---|---|---|---|---|
| Tempo vs model | late (+0.02..0.04) | early beat 1, longest mid-silence | model-exact, compressed 2× | earliest contacts, latest paint |
| Compact beat | guard punch, rises | blade flip, edge-on flash | 27 ms stutter, silent | drag-back that hums |
| Finisher | overhead sentence, freeze-shatter | S-cut, petal tear | brisk splinter drop, ribbon splits | early fang, lagging thunder |
| Ribbon body | 38 px ×1.28, squared | 35 px ×1.20, triple-torn | 22 px ×1.15, torn→split | 22 px ×1.18, open + lag |
| History | 0.816 rad ×1.10 | ×1.25 (longest) | 0.50 rad ×0.60 (shortest) | ×0.80, stretched fade |
| Accent grammar | hoarfrost bloom + chips | 3–5 down-aim petals | 2–3 radial ice chips | 2 jagged fork filaments |

Review gates are the shipped panel's §9 verbatim, plus one addition: **play each adopter back-to-back with Driftblade at the four cardinal aims; a reviewer must name the weapon from beats 2 and 3 with VFX off, and from the ribbon alone with poses hidden.** If either test fails, the adopter has drifted into clone territory and its divergences (direction, tempo shift, compact-beat class) must widen.

---

## 8. DO-NOT-TOUCH

These keep their current combos and VFX **as-is**. No timing, ribbon, routing, or pose changes.

| Weapon(s) | Keeps | Why |
|---|---|---|
| `driftblade` | `greatsword` sequence, byte-for-byte | It is the model, not a patient. Any edit moves the benchmark under the four adopters. |
| `tombstone-greatsword`, `x-sword-coffin`, `x-sword-bone`, `x2-riftcleaver-greatblade` | Momentum (`greatsword-momentum`) | Shipped flywheel identity — carried turns and the runaway cleave are the *opposite* thesis to Driftblade's stop-and-load precision. Riftcleaver stays despite its energy-blade name: stats (dLen 142, arc 3.0, cd 0.70) read heavy-wide, and repainting a shipped identity for a naming coincidence is churn. |
| `x2-tombwarden-claymore`, `x2-dustreaper-zweihander` | Breach (`claymore-breach`) | Heavy formal guard-breakers; their crossguard/barricade grammar is deliberately un-nodachi. |
| `x-sword-whirlwind` (Dervish Greatblade) | explicit `spin` | The one continuous-spin sword; the shipped panel already names it a deliberate exception. |
| `x-sword-buzzsaw` (Buzzcutter) | plain orbit, no combo | Needs a powered-saw grammar (continuous grind), which the three-beat skeleton cannot express. Leaving it comboless is better than a false nodachi costume. |
| `x-sword-anchor` (Drowned Anchor) | current quake/chop lane | A crusher, not a cutter; the shipped panel earmarks a future anchor/mauler chain. Out of this model's scope. |
| `gravediggers-spade` | current behavior | Family `spade`; it only borrows sword placeholder art. |
| All glaives/voulges/fauchards (Compass) and bardiches (Hookbreak) | shipped families | Not swords; their panel identities (empty-center radial ribbons, head-heavy hooks) are load-bearing contrasts that make the sword ribbons legible. |
| All non-sword 2H melee (axes, cleavers, mauls, hammers, flails, scythes, polearms) | current lanes incl. `quake-mauler`/`pommel` fallbacks | The directive is scoped to two-handed swords. The fulcrum flip stays hammer-only per the shipped guardrail. |

**Net effect on current routing:** exactly two weapons *change* behavior (Gravechill, Stormpetal — from clone to like-combo) and two *gain* behavior (Hailwidow, Voltfang — from no combo to a chain). Nothing else in the game moves.

## Code references reviewed

- `packages/shared/src/melee.ts` — `MELEE_COMBO_SEQUENCES`, `greatsword` variant steps, `MeleeComboRibbon` authoring seam, `bigSwordPanelVariantFor`, descriptor clock.
- `packages/shared/src/weapons.ts`, `packages/shared/src/weapons-expansion.generated.ts` — Driftblade data and the full 2H sword census (grip/family/size, stats used for all keyed numbers).
- `packages/client/src/entities/SpriteRig.ts` — `applyPommelBash`, `applyTrueChargedSlam` (tremor, length collapse, deformation beat, planted hold), hand-spacing and depth channels.
- `packages/client/src/vfx/vfx-render.js` — `PER_SIZE`, `samplePerClock` (alpha ramps, crest, follow fade), `renderPer` (history/artCap math), `updateLinearRope` (wobble filaments), twin rear-lobe mechanism.
- `packages/client/src/vfx/VfxPlayer.ts` — PER meta wiring (`meleeReach`, `swingArc`, size/family/paint, `edgeProgress`/`angleAt`).
- `docs/bigsword-combos-panel/designer.md` — shipped Momentum/Breach/Compass/Hookbreak grammar, PER ribbon rule, Stage-1 honesty rules, review gates.
