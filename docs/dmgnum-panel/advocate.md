# Damage Numbers — Devil's Advocate

**Panel:** damage-numbers · **Role:** devil's advocate
**Directive under attack:** "damage numbers always on (settings opt-out), legible, readable, industry best practice."

My job is to break the comfortable version of this feature before the horde does. "Always on" is easy to say and catastrophic to ship naively: the current implementation already collapses under one sustained beam, sits **above the protected danger layer**, and rides a receipt ring that mathematically cannot carry per-hit truth at squad scale. Everything below is evidence-first, with hard numbers and hard guardrails. No source files are modified by this document.

---

## 0. What exists today (read before arguing with me)

| Piece | Where | Fact |
|---|---|---|
| Spawn path | `packages/client/src/scenes/ArenaScene.ts:7100-7148` (`updateCombatFx`) | Numbers are driven off **authoritative HP diffs** per render frame, not events. Per-frame budget `DAMAGE_NUMBER_BUDGET = 24` (`:189`), full-FX budget `HIT_VFX_BUDGET = 10` (`:188`), stable-sorted so on-camera enemies spend the budget first (`:7138`). |
| Label pool | `packages/client/src/scenes/arena/vfx.ts:1125-1265` (`spawnDamageNumber`) | Pooled `Phaser.GameObjects.Text`, same-frame aggregation by enemy id, generation-guarded recycle, `setDepth(100000)`, ~600 ms (small) / ~760 ms (big) lifetime, two chained tweens per spawn. |
| Magnitude ladder | `vfx.ts:1153-1185` | 13px `#d9b45a` → 17px `#ffe08a` (≥8) → 22px `#ffab3b` (≥20) → 28px `#fff2c0`+red stroke (≥40); crit ≥30px gold `!` + orange stroke. Stroke is **0** on the two smallest bands. |
| Beam cadence | `packages/shared/src/combat.ts:88` (tickRate clamp 50–250 ms), `packages/server/src/rooms/GameRoom.ts:3554-3568` (accumulate + flush), `:3576-3624` (`flushBeamDamage` → `damageEnemy` per target) | Shipped beam weapons flush at **0.1 s** (a few at 0.15 s — `weapons-expansion.generated.ts`). Every contacted enemy takes a discrete HP drop 10×/sec per beaming player. |
| Receipts | `packages/shared/src/state.ts:318-334`, `constants.ts:356` (`COMBAT_RECEIPT_CAP = 32`), `GameRoom.ts:2111-2145`, written from the single damage seam `damageEnemy` (`:5112`) and worm route (`:5044`) | **Every hit** (not kills only) writes a ring row: `sourcePlayerId`, `weaponId`, `delivery`, `damage`, `crit`, `finalBlow`, direction. 32 fixed rows, overwritten by cursor, `seq` monotonic. |
| Depth law | `ArenaScene.ts:1645` (exact danger footprints depth 3, ground), `:1648` (protected response-edge/source layer **99997**), `:1655` (danger vignette 99998), first-session finding #5 | The telegraph panel's settled discipline: exact geometry on the ground plane, thin response edges + glints protected at 99997, "never quality-gated" (`:817-820`). |
| Prior findings | `docs/improve2-panel/polish.md` #9; `docs/improve2-panel/first-session.md` #5, #6 | Beams already turn numbers into a "tick-rate curtain"; the layers most likely to vanish at peak spectacle are the ones that say "leave this area"; 50-enemy telegraph noise is a live problem. |
| Settings today | `AudioBus.ts` (localStorage `dd.audio.vol` / muted), `ArenaScene.ts:225-230` (OS reduced-motion only) | There is **no settings surface** for damage numbers. "Settings opt-out" is currently vaporware; the toggle has nowhere to live. |
| Parallel panel | `docs/hitfx-panel/audio-designer.md` | The hit-confirm audio layer is being spec'd off the **same receipt ring**, owner-gated by `sourcePlayerId`, with its own rapid-fire and beam-cadence laws. |

---

## 1. Attack: the worst-case math — the curtain is real, and the existing budget does not stop it

Compute it honestly. Beam flush = 10 Hz per beaming player (`tickRate: 0.1`). Beams hit **every** contacted enemy (damage dilutes past 3 targets — `beamStepDamage`, `combat.ts:139-142` — but the *count of HP-drop events does not shrink*; dilution makes MORE, SMALLER numbers, the worst possible trade for readability).

**Server-side damage events:**

- 1 player, wide beam through 20 enemies: 20 targets × 10 Hz = **200 hits/sec**.
- 4 players, all beaming overlapping packs of 20: 4 × 200 = **800 hits/sec** authoritative. (`MAX_ENEMIES = 80` — `constants.ts:285` — and the menu sells 1–10 player co-op, so this is not a strawman; it is a Tuesday.)

**Client-side label spawns:** `updateCombatFx` coalesces per enemy per render frame (aggregateKey = enemy id), and HP arrives in 20 Hz patches. So the coalescing floor is: *distinct damaged enemies × patch rate*. 20 damaged enemies × 20 Hz = **400 label spawns/sec**. At 50 on-screen enemies under multi-beam + AoE: up to **1,000 spawns/sec** requested.

**Concurrency (what's actually on screen):** spawns/sec × lifetime. 400 × 0.6 s ≈ **240 simultaneous floating Text objects**; the 50-enemy case ≈ **600**. For comparison, a readable ceiling in every genre reference (Hades, Risk of Rain 2 with stacking, Diablo with merge rules) is on the order of **30–50 concurrent glyph clusters**.

**And here is the trap:** `DAMAGE_NUMBER_BUDGET = 24` looks like protection but is a **per-frame spawn budget**. 400 spawns/sec at 60 fps is only ~7 spawns/frame — *the budget never engages*. It was designed for a single-frame AoE storm and is silently useless against sustained cadence, which is exactly polish.md #9's point. Anyone who says "we already have a budget" has not done this multiplication.

**Guardrail (non-negotiable):** the cap that matters is **concurrent labels on screen** and **labels per target**, not spawns per frame. Demand: ≤ 40 concurrent labels total, ≤ 1 live label per enemy at any instant (an anchored accumulator that re-styles, not a new spawn — polish #9's rolling number), sustained-contact restyle cadence 220–300 ms. Keep the 24/frame spawn budget as the burst backstop underneath.

## 2. Attack: the depth law is being violated *right now*, by the feature we are polishing

Damage numbers render at **depth 100000** (`vfx.ts:1224`). The protected response-edge/source layer — the thin boundaries and glints that tell you where death is — sits at **99997** (`ArenaScene.ts:1648`), the danger vignette at 99998, the parry ring at 99989. The telegraph panel fought for "never quality-gated, never occluded" and the damage numbers are the **only combat cosmetic above it**.

At horde scale that means 240 gold rectangles float directly over dodge edges, boss glints, and the parry-state ring at the precise moment they matter. First-session finding #5's verdict applies verbatim: the layer most likely to disappear at peak spectacle is the one that says "leave this area" — except now it's not beams doing the burying, it's our own arithmetic confetti.

Numbers are **information, not danger**. The depth law must be written down and enforced:

- Damage numbers live **below 99997**, above actor rigs — claim a band (e.g. **99900–99949**) and document it next to the telegraph depth comments.
- They must also never sit above the death-recap/HUD text or the low-HP vignette, and never inside the ground-danger plane (depth 3) where they'd read as geometry.
- Spawn offset discipline: `rig.y - 26` rising 30–44 px parks the label exactly across the enemy's windup/tell band. Cap the rise so numbers drift **up-and-away from the danger side** (bias the jitter away from the local player's dodge axis is over-engineering; simply keeping them *under* the edge layer is the 90% fix).
- A colossus/boss with segment tells (worm slots, `state.ts:337+`) gets numbers anchored to the **hit segment**, never across the head/tell.

**Checklist item:** screenshot test at 50 enemies + 2 beams + boss telegraph: every response edge pixel-visible through the number field, or the build fails review.

## 3. Attack: pooling is necessary but nowhere near sufficient — Phaser Text is the wrong object

The pool (`vfx.ts:1138-1150`) correctly recycles GameObjects and the generation guard is sound. But every `spawnDamageNumber` and every same-frame aggregation calls `setText/setFontSize/setColor/setStroke` (`styleDamageNumber`), and **each of those re-rasterizes the Text's private canvas and re-uploads a GPU texture**. Phaser `Text` = one canvas + one texture per object. 400 restyles/sec = 400 canvas rasterizations + 400 texture uploads/sec, plus 2 tween allocations per spawn (`scene.tweens.add` twice, `:1243-1263`) — **800 tween objects/sec of steady-state garbage**. "Pooled" is true and misleading; the expensive part was never the GameObject.

The industry answer is boring and known: **BitmapText or a hand-rolled digit-atlas blitter**. The glyph set is tiny — `0-9`, `!`, `×`, maybe `k` — one prebaked atlas per style band (4 sizes × ~4 colors), zero rasterization at runtime, batched in one draw call. Phaser 4 `BitmapText`/`DynamicBitmapText` or a `Blitter` of digit frames both qualify.

**Hard budget (measure, don't vibe):**

- **Zero steady-state allocation**: no `tweens.add` per spawn (pooled counters updated in one `update()` sweep, like `xp-motes.ts` does for its receipts), no string concat per restyle where avoidable (digit-blit sidesteps `String(dmg)` entirely; if BitmapText is used, accept the small string).
- Worst case (40 concurrent labels, 24 spawns in one frame): **≤ 0.5 ms** client main-thread per frame on the mid-tier target, **0 canvas rasterizations** after warmup, **≤ 1 texture bind** for the whole number layer.
- Pool prewarmed to the concurrency cap at scene create (the current pool grows on demand — first horde frame pays the allocation spike).
- The existing `SHUTDOWN` cleanup discipline (`vfx.ts:1146-1148`) carries over unchanged — scene restarts must not leak the atlas pool.

## 4. Attack: information honesty — pick the law, and the receipt ring already picked it for you

The panel must choose: **(a)** predicted numbers instantly, never corrected, or **(b)** authoritative-only with ~1 patch of latency. Here is why (b) is the only defensible law in this codebase, argued from data availability:

1. **The receipt ring cannot carry per-hit truth at scale.** 32 rows (`COMBAT_RECEIPT_CAP`), overwritten by cursor, snapshot to clients at ~20 Hz. Ceiling: 32 × 20 = **640 receipts/sec** before rows are overwritten *between two patches* and silently vanish. Section 1's worst case is 800 hits/sec. The ring overflows **exactly when numbers matter most**. Receipts are for *ownership, crit flavor, final-blow, and the confirm-audio layer* — they are provably not a lossless per-hit number feed, and any design that spawns numbers per receipt row is lying at horde scale. (The hitfx audio panel survives this because ears integrate rate; eyes reading digits do not.)
2. **HP diffs are loss-proof by construction.** `enemy.hp` is state, not an event: whatever happens between patches arrives as one delta, coalescing is automatic, nothing can be dropped, and the displayed sum always equals server truth. The current `updateCombatFx` diff approach is already the honest channel.
3. **Prediction would lie in specific, player-visible ways.** Crits are server-rolled (`damageEnemy`, `GameRoom.ts:5104`), Brand multiplies server-side (`:5109`), beam dilution depends on server contact count (`combat.ts:141`), worm armor bands resolve in `BossController`. A client-predicted number is wrong whenever any of these fire — i.e., constantly. "Show predicted, never correct" means the number on screen routinely disagrees with the HP bar next to it, in a game whose stated law is "one shared function, server and VFX cannot diverge."

**The recommended honesty law: *predicted sparkle, authoritative arithmetic.*** Hit-sparks, flashes, and impact flipbooks stay client-predicted for feel (already true); **every digit on screen comes from authoritative HP deltas** (already true) and is therefore never corrected because it was never guessed. Latency cost is one server tick + half RTT (~75–125 ms) — masked completely by the predicted impact VFX that lands at 0 ms. Use receipts to **decorate** the authoritative number (owner tint, crit style, final-blow pop) with graceful degradation when the ring wrapped: an undecorated number is honest; a fabricated one is not.

## 5. Attack: "always showing up" vs aggregation — merge, never drop, and make the sum auditable

The user's directive says numbers *always* appear. Aggregation (mine included, §1) merges per-hit events. Does the player still trust that every hit counted? Only under one rule, so write it as law:

> **Damage is never dropped, only merged; a displayed number always equals the exact sum of the authoritative deltas it merged.** (HP-diff sourcing gives this for free — one more reason for §4's law. A receipt-sourced design cannot even state this rule.)

Consequences:

- The per-frame budget (`:7144`) currently **drops** labels for over-budget enemies (their flash still fires, but the number is gone forever). Under the law, over-budget damage must **bank into that enemy's accumulator** and surface on its next label, not evaporate. Off-screen enemies may bank indefinitely (numbers for enemies you can't see are worth zero).
- Sustained contact shows one anchored rolling total per target (polish #9), restyled at 220–300 ms — the *displayed* number visibly climbs, which reads as "counting" rather than "sampling." Kills and crit quanta get their separate authored pop so the beam's texture isn't a slot machine.
- No fake precision: if aggregation ever quantizes ("1.2k"), it quantizes display only; the accumulator stays exact.

## 6. Attack: co-op noise — four players' arithmetic is not one player's feedback

HP diffs are ownership-blind: today every client renders **identical full-strength numbers for all four players' damage**. At squad scale that quadruples §1's curtain with digits that are, to you, someone else's homework. Meanwhile the confirm-audio panel is already owner-gating on `sourcePlayerId`. If audio is owner-first and numbers are ownership-blind, the two "did I hit?" channels disagree — incoherent.

Law: **your damage is loud, squad damage is ambient.** Own hits (receipt `sourcePlayerId === myId`, fallback: nearest-attacker attribution already computed at `:7163-7175`) get the full ladder; teammates' numbers render one band smaller, desaturated, and are the **first casualties of the concurrency cap** (drop teammate labels before banking your own). When the ring wrapped and ownership is unknown, default to ambient styling — see §4, decorate-don't-fabricate.

## 7. Attack: the "legible" claim — the current ladder fails its own adjective

- **No stroke below 20 damage** (`styleDamageNumber` sets stroke thickness 0 on the two smallest bands). A 13px unstroked `#d9b45a` glyph over sand/parchment floors (this game's paper-cutout palette!) is invisible. Industry floor: every label carries a ≥ 2px dark stroke or drop shadow, always.
- **13px is below readable at gameplay distance.** With DPR scaling and camera zoom, the floor band should be ~16–18px effective. If a hit is too small to deserve 16px, it's an accumulator tick, not a label.
- **Colorblind: the entire ladder lives in one hue family.** Gold → light gold → orange → cream-with-red-stroke, crit = gold-with-orange-stroke. Under deutan/protan simulation the ≥40 band and the crit band are near-identical. The saving grace is that magnitude is size-coded and crit is shape-coded (`!`) — so make that the law: **color is always redundant; size, shape (`!`, final-blow burst), and motion carry every semantic alone.** Add the tritan/deutan/protan simulator pass to the checklist, and align element tinting (if ever added) with the telegraph palette accessibility work (first-session #20) rather than inventing a second palette.
- Overlap: with ≤ 1 label per enemy plus horizontal jitter (`:1236`) collisions are rare; forbid any label-vs-label collision resolution system (it's how other games ended up with numbers orbiting the screen).

## 8. Attack: the settings toggle — don't ship a lonely checkbox while the audio panel ships another

"Always on, settings opt-out" plus the hitfx panel's confirm-audio toggle plus the existing reduced-motion query plus the audio row in `MenuScene` = four feedback preferences in three idioms. That's how settings screens rot. One coherent **Feedback** group, one persistence idiom (the `dd.*` localStorage pattern `AudioBus` already uses):

| Key | Values | Default |
|---|---|---|
| `dd.feedback.dmgnum` | `full` / `aggregate` (own hits full, squad merged) / `off` | `full` — the directive's "always on" |
| `dd.feedback.hitconfirm` | `on` / `off` (hitfx panel's layer) | `on` |
| `dd.feedback.shake` | inherits/overrides OS reduced-motion | OS |

Rules: the damage-number toggle changes **rendering only** — accumulators, receipts, and recap capture keep running so toggling mid-run costs nothing and the death recap (first-session #6) never loses data. `off` must not disable crit/final-blow *audio* (channels are independent — a player who hates visual clutter still deserves the confirm tick). Both panels reference this same table or the shapes will diverge in review.

## 9. Hard guardrails (the review checklist)

**Scale & readability**
- [ ] ≤ **40** concurrent damage labels on screen; ≤ **1** live label per enemy (anchored accumulator, restyle 220–300 ms under sustained contact); 24/frame spawn backstop retained.
- [ ] Soak test: 4 simulated beam owners × 20 contacted enemies × 60 s — label concurrency graph never exceeds cap; every response edge and glint visibly unoccluded in capture.

**Depth**
- [ ] Number layer depth in a documented band **< 99997** (below protected telegraph edges, danger vignette, parry ring) and above actor rigs; comment placed beside `ArenaScene.ts:1645-1655` depth ledger.
- [ ] Boss/worm numbers anchor to the struck segment, never the tell.

**Performance**
- [ ] BitmapText/digit-atlas rendering: **zero** canvas rasterization and **zero** `tweens.add` in steady state; pool prewarmed to cap; ≤ 0.5 ms main-thread worst case; scene-restart leak test passes.

**Honesty**
- [ ] All digits derive from authoritative HP deltas; receipts decorate (owner, crit, final blow) and are never the sole spawn trigger; ring-wrap degradation = undecorated, never fabricated.
- [ ] Merge-never-drop: over-budget damage banks per target; displayed totals always equal server deltas exactly (unit-testable off `combat.ts` math).

**Co-op & accessibility**
- [ ] Own vs squad styling implemented; teammate labels shed first under the cap.
- [ ] All semantics survive with color removed (size/shape/motion); deutan/protan/tritan simulation pass; every band has a ≥ 2px stroke; effective minimum glyph height ≥ 16px.

**Settings**
- [ ] `dd.feedback.*` group shared with the hitfx panel; toggle is render-only; recap/receipt capture unaffected when `off`.

If the implementation can't check every box, cut scope from the ladder's decoration, never from the honesty or depth laws — a plain, truthful, correctly-layered number beats a gorgeous lie sitting on top of the dodge edge.
