# Damage Numbers — Design Spec (Designer Seat)

**Directive:** damage numbers ALWAYS showing up (optional turn-off in settings), legible, readable, industry best practice.

**Ground truth read before designing** (all paths absolute in repo):

- Implementation: `packages/client/src/scenes/arena/vfx.ts:1125-1265` — pooled `Phaser.GameObjects.Text`, same-frame aggregation keyed by enemy id, magnitude bands, pop-in tween.
- Spawn path: `packages/client/src/scenes/ArenaScene.ts:7098-7187` — authoritative hp-diff per patch → one label per enemy per frame, `DAMAGE_NUMBER_BUDGET = 24`, visible-first stable sort only when hits exceed `HIT_VFX_BUDGET`.
- Crit identity (shipped, §30): synced `critFlash` counter → gold number `#ffe27a`, stroke `#ff9e2c` width 4, `"{n}!"`, min 30px, 1.9× pop, gold rig flash, extra hit-stop. `CRIT_MULT = 2` (`packages/shared/src/leveling.ts:54`).
- Beam curtain: `docs/improve2-panel/polish.md` finding 9 — beams deal damage on a 50–250ms cadence (`packages/shared/src/combat.ts:88`), every flush becomes a fresh small label + hit thunk. `BEAM_CRIT_QUANTUM_SECONDS = 0.25` (`packages/shared/src/constants.ts:155`).
- Receipt ring: `CombatReceiptState` (`packages/shared/src/state.ts:320-334`) — `targetId, sourcePlayerId, weaponId, delivery, element, damage, crit, finalBlow`. This is the attribution/element/kill hook the hp-diff path lacks.
- DPR: `packages/client/src/render-dpr.ts` — `RENDER_DPR = min(2, devicePixelRatio)`; world camera zoom == `RENDER_DPR`, so 1 world unit == 1 CSS px. HUD text elsewhere calls `.setResolution(...)` (`ArenaScene.ts:5055`, `card-art.ts:577`); **damage numbers do not** — they raster at resolution 1 and get zoom-scaled soft on every hi-DPI display.
- Damage reality: weapon hits 2.5–18 base (`packages/shared/src/weapons.ts`), crits ×2, explosions ~15, beams DPS-metered; bosses 1300–1900 HP. The shipped band edges (8 / 20 / 40) fit this economy — keep them.
- Settings reality: no settings menu exists; the precedent is the MenuScene audio row + `dd.*` localStorage keys (`AudioBus.ts:51-55`, `ArenaScene.ts:8528`).

Everything below is numbers-first spec. No source files were modified.

---

## 1. Typography — legible at our camera distance

The camera is zoomed out and characters are small; the number is a UI receipt, not a world object. It must win contrast against a painterly HD floor.

| Property | Spec | Why |
|---|---|---|
| Font | Add one self-hosted display face for combat text: a heavy rounded/condensed sans with **tabular (monospaced) numerals** — e.g. Nunito ExtraBold / Changa One class. `@font-face` in `index.html`, preloaded via `document.fonts.load()` before `ArenaScene` starts. Fallback stack: `"DDNum", system-ui, sans-serif` bold. | Phaser's default Courier is thin-stemmed and serif-footed — the worst case at 14px. Tabular numerals stop the accumulator (see §4) from jittering horizontally as digits change. Zero font infrastructure exists today, so this is one file + one preload line, not a system. |
| Weight | Bold/800 only. One weight; hierarchy comes from size + color, never weight. | Weight variation at 14–30px is invisible at this zoom. |
| Minimum size | **14 CSS px floor** (raise the base band 13 → 14). All sizes below are CSS px == world units (identity holds because camera zoom == `RENDER_DPR`). | 13px Courier bold is at the legibility floor on 1080p and below it on 4K laptops. 14px in a heavy face reads. |
| Resolution | `.setResolution(Math.max(2, Math.ceil(RENDER_DPR)))` on every pooled label, matching `ArenaScene.ts:5055`. **This is the single biggest legibility win available and it is one line.** | Today the Text canvas rasters at 1× and the DPR-2 camera zoom scales it up — every damage number is soft exactly when the rest of the frame is crisp (§28). |
| Outline | Every number, every band: dark outline `#1a140f` at width 3 (small bands) / 4 (big + crit), plus `setShadow(0, 2, "rgba(0,0,0,0.45)", 2)`. Crit keeps its `#ff9e2c` stroke — the dark outline moves *under* it conceptually: use the warm stroke as the visible ring and rely on shadow for separation, exactly as shipped. | Today the two small bands have stroke width 0 — white-gold on a sun-lit paper floor disappears. Outline+shadow is the Hades/Brotato answer: the number must read on *any* floor luminance. |
| Digits only | Round to integer, min 1 (shipped). Never show decimals. `!` suffix stays crit-exclusive. | Sub-integer noise (2.5-damage claws) reads as clutter; the suffix is the crit's typographic signature. |

## 2. Motion grammar

Shipped motion is already close to convention (pop-overshoot → rise → ease-out fade). Codify and extend:

- **Spawn point:** target's head anchor (`rig.y - 26`, shipped) with jitter **x ±10px, y ±4px** (widen from the shipped ±6 x-only). Jitter alternates sign per spawn on the same target (flip a per-target bit) so consecutive numbers ladder left-right instead of overprinting.
- **Pop:** scale from 1.6 (big) / 1.9 (crit) / **1.25 (normal — new; today normals spawn at 1.0 with no pop)** back to 1.0 over 120–140ms `Back.easeOut`. The overshoot is what makes a hit feel *stamped*.
- **Rise:** normals rise 30px over the pop, then drift a further 14px during fade (shipped). Give the drift a per-spawn horizontal component of ±8px matching the jitter sign — a slight arc, not a column.
- **Gravity:** none for normals (straight ease-out rise reads cleaner at this zoom — Hades convention, not Diablo's arcs; arcs need bigger glyphs than we can afford). Crits get the one exception: 60ms **hang** at scale 1.0 before the fade starts — the crit "sits" for a beat.
- **Lifetime:** normal 600ms total (120 pop + 480 fade, shipped), big 760ms, crit 820ms (with hang). Hard cap under 1s — at horde density anything longer becomes fog.
- **Fade:** alpha → 0 with `Cubic.easeOut` (shipped — correct; the number is fully readable in its first 60% of life and politely leaves).
- **No world-tracking:** numbers do NOT follow moving targets after spawn (shipped behavior — keep; tracking numbers smear during knockback and cost per-frame writes). The one exception is the accumulator label (§4), which is pinned to its target while live.

## 3. Semantic ladder

Rule: **hue = meaning, size = magnitude.** One hue change must mean one gameplay fact. The shipped ladder uses gold for *everything*, which spends the crit's color before the crit arrives. Fix by moving normals to parchment-white and reserving gold for crits — this *strengthens* the shipped gold-crit identity rather than replacing it.

| Tier | Trigger | Fill | Stroke/outline | Size | Motion |
|---|---|---|---|---|---|
| Normal | any enemy damage < 8 | `#f2ead6` parchment white | dark outline 3 | 14 | standard |
| Solid | 8–19 | `#ffe9b0` warm white | dark outline 3 | 17 | standard |
| Heavy | 20–39 | `#ffc95e` | dark outline 3 | 21 | standard |
| Crushing | ≥ 40, non-crit | `#fff2c0` | `#ff5a3c` stroke (shipped) | 26 | 1.6× pop |
| **Crit** | `critFlash` / receipt `crit` | **`#ffe27a` (shipped, untouchable)** | **`#ff9e2c` w4 (shipped)** | **max(30, band)** | **1.9× pop + 60ms hang + `!`** |
| Elemental tint | receipt `element` ≠ physical | fill stays per-band | outline tinted toward element (reuse `ArenaScene.ELEMENT_SPARK` hues at ~40% blend with the dark outline) | — | — |
| Healing | self HP gain ≥ 1 (potion/riposte/revive) | `#7ddf7d` | dark outline 3 | 16 | straight rise, no jitter, no pop — calm |
| **Damage taken (self)** | local player HP drop | `#ff6a5e` | dark outline 4 | **18 min** | spawns at own head, drops 6px then rises; never pooled with enemy numbers; exempt from the per-target budget |
| Resist/immune | hit lands for 0 / heavily-resisted (future hook) | `IMMUNE` / `RESIST` small-caps `#9aa0a8` | dark outline 3 | 13 | fade-only, throttled to 1 per target per second |

Element goes on the **outline**, never the fill: six element hues in the fill space would collide with the heal-green / taken-red / crit-gold channels, which carry gameplay-critical meaning. The elemental outline is flavor; the fill ladder is law.

**Kill payoff (final blow):** consume `CombatReceiptState.finalBlow`. The killing number gets **+20% size over its band, an 80ms hang, and fades 30% slower**; if the final blow crit, both treatments stack (this is the jackpot frame). No new color — the poof, XP echo, and audio already own the kill moment; the number's job is to be the *legible receipt* of what closed it. Do not add "KILL" text — number-only keeps the horde readable.

## 4. AGGREGATION LAW — the fix for the beam curtain

Two layers, the first already shipped:

**Layer 1 (shipped, keep):** same-frame merge per target — all damage delivered to one enemy in one patch is one number (`vfx.ts:1203-1216`).

**Layer 2 (new): per-target token bucket + rolling accumulator.**

- Each target has a token bucket: **capacity 4, refill 4 tokens/sec.** A discrete number costs 1 token.
- While tokens remain, hits spawn discrete numbers (full motion grammar). Bursty weapons — shotguns, hammer slams, 2–3-hit melee strings at 2.5–18 damage — never exhaust it, so the moment-to-moment game is unchanged.
- When the bucket is empty (sustained beams at 50–250ms cadence, flamethrower cones, stacked DoTs), the stream **latches a single accumulator label** pinned ~30px above the target:
  - It shows the running sum since latch and **ticks up in place** (tabular numerals — no width jitter), re-passing `styleDamageNumber` bands as it grows: a beam held on a tough visibly climbs 12 → 47 → 130, escalating through Solid → Heavy → Crushing styling. The number getting *bigger and hotter as you hold the beam* is the payoff the curtain was stealing.
  - Every update refreshes its lifetime; each tick gives a 1.08× scale pip (50ms) so accumulation is felt, not just read.
  - A **crit tick flashes the accumulator gold** (`#ffe27a` + `#ff9e2c`, 150ms) and bumps the pip to 1.25× — no separate label. This aligns 1:1 with `BEAM_CRIT_QUANTUM_SECONDS = 0.25`: the beam's crit quantum becomes a visible gold pulse on one climbing number.
  - **Release:** 300ms after the last contribution (> the 250ms max beam cadence, so a held beam never flickers between modes), the accumulator plays the standard settle: pop at its final band scale → rise → fade. If the stream killed the target, apply the final-blow treatment to the release.
- **DoT/burn grouping:** damage-over-time never spawns discrete numbers — it routes straight to the accumulator at max 1 visual update per 250ms. Burn is ambience; the ignition hit was the event.
- Audio note for the engineering seat: the same token bucket should gate the generic hit thunk (polish.md finding 9's other half) — one law, two symptoms.

**Global caps (keep + tighten):** `DAMAGE_NUMBER_BUDGET = 24` new spawns/frame stays; add a live-label ceiling of **40 on screen** — beyond it, new discrete requests convert to accumulator updates on their target. Numbers must never become the particle system.

## 5. Stacking / collision avoidance

- Jitter + alternating sign (§2) handles the common two-hit case.
- **Per-target vertical ladder:** while a target has live discrete labels, each new one spawns 14px above the highest live one, up to 3 slots; a 4th concurrent request force-latches the accumulator instead. Cheap (one per-target counter), and it converts the worst overprint case into the aggregation path that already exists for it.
- No global collision solver. Cross-target overlap at horde density is acceptable and self-clearing (<1s lifetimes); a physics pass on text is engineering spend with no readability return at this zoom.

## 6. Off-screen policy

**Hard cull:** never spawn a number for a target outside `cameras.main.worldView` padded by 48px (today off-screen targets are merely *deprioritized* — `ArenaScene.ts:7138` — and can still consume budget on quiet frames). Padding lets a half-visible enemy at the edge still receipt. No edge-clamped arrows or off-screen indicators: damage numbers are receipts, not radar — the XP echo and kill audio already confirm off-screen progress. Accumulators whose target walks off-screen release immediately with a fast 200ms fade.

## 7. Co-op law

**Recommendation: everyone's numbers ON by default; yours full-size, teammates' at 75% size / 60% alpha and a halved token bucket (2/sec/target).**

Reasoning: in a 4-player bullet-heaven the shared screen *is* the power fantasy — a silent teammate half feels desynced, and Deep Rock/V Rising-style "self-only by default" fits extraction pacing, not horde pacing. But full-parity teammate numbers double to quadruple label volume without informing *your* decisions (your DPS, your crit build, your kill credit). Shrink + dim keeps the party's contribution ambient while your own receipts stay the foreground — the same self/other mix already shipped for parry audio (`ArenaScene.ts:7198`, full for yours, 0.4 for a mate's). Attribution comes from `CombatReceiptState.sourcePlayerId`; where a receipt is unavailable (hp-diff fallback path), treat the hit as "mine" — over-showing beats mis-hiding. A `Mine only` setting covers players who want the quiet screen.

Damage-taken red numbers are **self-only, always** — a teammate's pain is their vignette, not your clutter (their HP bar under the rig already tells you when to rez).

## 8. Scale-with-zoom policy

Numbers live in world space and the world camera zoom is currently fixed at `RENDER_DPR`, so world px == CSS px and no correction is needed **today**. Write the law now so future dynamic zoom (the belt fold already renders through a second scaled camera, `ArenaScene.ts:2494`) can't silently shrink them: **damage numbers are screen-legibility-first** — effective on-screen size = `band_size × (baseZoom / currentZoom)`, clamped so no number ever renders below 14 CSS px or above 44 CSS px. If a cinematic zoom-out would push numbers below floor, they clamp at floor; they do not scale with the world, because they are UI wearing a world costume.

## 9. Settings surface — exactly what ships

Persisted to localStorage under `dd.dmgnum.*` (matching `dd.beltScrip` / AudioBus precedent), surfaced next to the shipped audio row (MenuScene bottom-left row / future pause overlay). Four controls, no more:

| Setting | Key | Values | Default |
|---|---|---|---|
| Damage numbers | `dd.dmgnum.enabled` | on / off | **on** |
| Show | `dd.dmgnum.whose` | everyone / mine only | **everyone** |
| Style | `dd.dmgnum.style` | detailed / aggregate-only | **detailed** |
| Size | `dd.dmgnum.size` | 80–140% slider, steps of 10 (multiplies every band size; the 14px floor still applies after scaling) | **100%** |

- **Off** means off — all floating combat text including heals and self-damage disappears (HP bars, flashes, shake, and the damage vignette carry that information redundantly; a player who turns numbers off has asked for the quiet screen and gets it).
- **Aggregate-only** routes *every* hit through the §4 accumulator (token capacity 0): one climbing number per target, released on stream end. This is the "I want totals, not confetti" mode — and it doubles as the low-end-hardware mode.
- No per-tier toggles, no element-tint toggle, no crit-only mode: every extra switch is a support surface and a QA matrix row. Four controls cover the real player intents (off / quiet / totals / bigger).
- Defaults satisfy the directive: numbers **always show up** out of the box; the settings are the opt-outs.

## 10. Priority order for the engineering seat

1. `setResolution` + dark outline + 14px floor + font face — pure legibility, zero behavior risk (§1).
2. Token bucket + accumulator — kills the beam curtain, the one P1 on file (§4).
3. Ladder recolor (normals to white, gold reserved for crit) + damage-taken/heal numbers via the receipt ring (§3).
4. Off-screen hard cull + vertical ladder + co-op sizing (§5–7).
5. Settings row (§9) — last, because defaults are the product.
