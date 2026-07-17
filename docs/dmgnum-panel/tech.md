# Damage Numbers — Tech Implementation Spec (dmgnum panel)

Role: TECH IMPLEMENTER. Directive: damage numbers always on (settings opt-out), legible, readable,
best-practice. This document specifies the data source, renderer, aggregation engine, depth contract,
settings system, co-op filtering, touch list, tests, and the server-wave follow-ups. No source files are
modified by this panel.

All line numbers are against the working tree on `feat/v0.117-feel-and-colossus` at the time of reading.

---

## 1. What exists today (read end to end)

### 1.1 Current damage-number pipeline (hp-delta driven)

- **Detection** — `ArenaScene.updateCombatFx()` (`packages/client/src/scenes/ArenaScene.ts:7100`)
  runs per render frame, diffs `enemy.hp` against the `this.enemyHp` map, and treats any drop as a hit.
  `prev - hp` is therefore *already an aggregate* of every damage source delivered in that server patch.
  Crit detection is a diff on the synced `enemy.critFlash` wrap-around counter
  (`ArenaScene.ts:7121`) — a boolean "some hit in this patch crit", with **no attacker attribution and no
  per-hit granularity**.
- **Budgets** — `HIT_VFX_BUDGET = 10`, `DAMAGE_NUMBER_BUDGET = 24` (`ArenaScene.ts:188-189`); when hits
  exceed the budget the array is stable-sorted visible-first (`ArenaScene.ts:7138`) so on-camera enemies
  win labels. One label per enemy per frame is enforced by `damageNumberEnemies` (`ArenaScene.ts:7144`).
- **Rendering** — `spawnDamageNumber()` (`packages/client/src/scenes/arena/vfx.ts:1189`): pooled
  `Phaser.GameObjects.Text` with a per-scene free list (`DAMAGE_NUMBER_POOLS` WeakMap, `vfx.ts:1138`),
  same-frame aggregation by enemy key (`pool.sameFrame`), magnitude bands in `styleDamageNumber()`
  (`vfx.ts:1153`): 13px `#d9b45a` base, ≥8 → 17px, ≥20 → 22px, ≥40 → 28px + red stroke, crit → ≥30px
  gold `#ffe27a` + orange stroke + `!` suffix. Two chained **tweens** per label (rise + fade,
  `vfx.ts:1243-1264`) — each tween is a heap allocation per number.
- **Depth** — labels sit at `setDepth(100000)` (`vfx.ts:1224`), i.e. *inside the HUD band and above the
  danger band* (see §5). This is the placement bug this panel fixes.
- **No settings gate** — numbers are unconditional; there is no toggle anywhere.

### 1.2 The combat-receipt ring (per-hit, attributed — already shipped, v18)

`CombatReceiptState` (`packages/shared/src/state.ts:318-334`) is a fixed 32-slot ring
(`COMBAT_RECEIPT_CAP = 32`, `packages/shared/src/constants.ts:356`) allocated once at room creation
(`packages/server/src/rooms/GameRoom.ts:678`). Each row carries:

```
seq (uint32, monotonic, wraps, never re-0), tick, targetId, sourcePlayerId, weaponId,
delivery (CombatDelivery enum, combat.ts:36), element, dirX/dirY (unit hit vector),
damage (float32, post-crit post-Brand applied damage), crit (bool), finalBlow (bool)
```

**Critical finding: the ring is per-hit, not kill-only.** `writeCombatReceipt()`
(`GameRoom.ts:2111-2145`) is called from `damageEnemy()` for **every** player-sourced enemy hit
(`GameRoom.ts:5112`) and from the worm-segment route (`GameRoom.ts:5044`). Every player damage path
funnels through `damageEnemy` with full attribution — melee edge (`:3669`, `:3753`), beam (`:3592`),
chain (`:2959`), blast/scatter (`:5274`), parry riposte (`:5319`), projectiles (`:5968`). The receipt
`damage` field is the *applied* value (crit ×2 and Brand ×mult folded in), so it sums exactly to the hp
delta for player-sourced damage.

Two gaps, both by design:

1. `writeCombatReceipt` early-outs on empty `sourcePlayerId` (`GameRoom.ts:2124`) — non-player damage
   to enemies produces **no receipt** (rare for enemies, but exists).
2. 32 slots per ring, broadcast is tick-locked once per sim batch (`setPatchRate(0)`,
   `GameRoom.ts:1230`; broadcast-per-batch comment at `:2189`, up to 3 sub-steps under load). A horde
   AoE frame can write >32 receipts inside one patch window → **ring wrap = silently skipped seqs**.

**The client already consumes this ring** — but only for rows targeting *self* (death recap):
`captureSyncedDamageReceipts()` (`ArenaScene.ts:6944-6974`) with per-slot seq dedup
(`damageReceiptSeqBySlot`, `ArenaScene.ts:1025`, cap-64 map reset at `:6956`). That dedup pattern
(slot → last seq, ignore seq 0, ignore unchanged) is the proven law the new consumer reuses.

### 1.3 What the client knows locally ("predicted hits"?)

`packages/client/src/net/prediction.ts` is **movement-only** (header, lines 21-42: horizontal
rebase+replay, vertical jump prediction — pure module, no combat). Player projectiles are
server-authoritative `ProjectileState` rows (`state.ts:276`, `:389`); melee swings resolve entirely on
the server; there is **no client-side hit simulation of any kind**. `PredictedBeamCharge`
(`BeamRenderer.ts:29`) predicts a *charge visual*, not hits. Therefore "local predicted hit numbers" is
not a wiring task — it would require a new client combat sim (hit tests against interpolated enemies,
mispredict reconciliation). Latency of the authoritative path is one-way network + ≤1 sim batch
(~50-150ms typical LAN/regional) and — decisively — **the number appears on the same frame the enemy's
hp bar and hit-flash react**, because all three read the same patch. Perceptual sync beats absolute
latency here.

### 1.4 Pooled-rendering pattern references

- `packages/client/src/vfx/xp-motes.ts` — the house style for zero-steady-state-allocation rendering:
  fixed pools sized by a shared cap, parallel typed arrays (`Float32Array`/`Uint8Array`) for per-slot
  state, generation-stamped visibility reconciliation, **no tweens** — every animation samples
  age/curves inside `update(deltaMs)` (header comment at `:57-60` states this explicitly). Receipt
  sub-pool (16 rings/halos) with a cursor (`:82-142`).
- `packages/client/src/vfx/BeamRenderer.ts` — keyed pool of Rope pairs, seq-based phase edges, element
  color tables.
- **Anti-pattern to retire**: the current `spawnDamageNumber` tweens and the ad-hoc `+N XP` labels in
  `updateXpReceiptLabels()` (`ArenaScene.ts:3235-3253`) which `scene.add.text(...)` + `destroy()` per
  label — allocation per event.

### 1.5 DPR

`packages/client/src/render-dpr.ts`: `RENDER_DPR = min(2, devicePixelRatio)`. The world camera is zoomed
by `RENDER_DPR`; any texture authored at 1× and shown at scale 1 in world space gets magnified → soft.
Phaser `Text` objects handle this via their `resolution`, but raw textures (our glyph atlas, §3) must be
rasterized at `size × RENDER_DPR` and displayed at `setScale(k / RENDER_DPR)`.

### 1.6 Settings persistence today

There is **no settings module**. Persistence is four ad-hoc localStorage keys, each with its own
try/catch:

- `dd.audio.vol`, `dd.audio.muted` — `AudioBus` (`packages/client/src/audio/AudioBus.ts:16-17`),
  UI = MenuScene bottom-left row (`MenuScene.ts:182-229`) + `M` mute key (`ArenaScene.ts:3077`).
- `dd.beltScrip` (`ArenaScene.ts:8528`), `dd.beltUpgrades` (`ArenaScene.ts:8546`) — meta progression.
- OS-level `prefers-reduced-motion` is read live (`ArenaScene.ts:236`) and threaded into paper/mote
  renderers — an accessibility precedent the damage-number renderer must also respect.

---

## 2. Data-source architecture

### 2.1 Verdict

**Receipts-primary, hp-delta-residual fallback. No client hit prediction in this wave.**

- The receipt ring is already per-hit, per-attacker, per-weapon, with authoritative crit/finalBlow —
  strictly better than the hp-delta diff on every axis that matters (attribution for co-op filtering,
  crit-per-hit instead of crit-per-patch, kill accent, element/delivery for styling).
- "Instant" is satisfied because numbers, hit-flash, and hp bars all derive from the same patch — there
  is no earlier client-known moment to anchor to (§1.3). A predicted-hit layer is a real project
  (client combat sim + mispredict retraction of shown numbers — retracting numbers is worse UX than
  100ms of latency) and is explicitly out of scope; the bus API below leaves a seam for it
  (`confidence: "authoritative" | "predicted"`).
- The hp-delta path is retained as a *residual* detector so no damage is ever silently unnumbered:
  it covers (a) non-player-sourced enemy damage (no receipt by design), (b) receipt-ring wrap during
  horde AoE storms, (c) old/mid-rollout servers.

### 2.2 The shared combat-feedback event bus (COORDINATION with docs/hitfx-panel/)

A hit-effects panel is concurrently designing impact effects off the same ring. Two independent ring
consumers means two seq-dedup maps, two residual computations, and divergent dedup bugs. **Proposal:
one dispatcher, N subscribers.**

New file `packages/client/src/combat/feedback-bus.ts` — pure TypeScript, no Phaser import (unit-testable
in node, same discipline as `prediction.ts`):

```ts
export interface HitFeedbackEvent {
  targetId: string;            // enemy id | "worm:{slot}:{gen}" | player id
  sourcePlayerId: string;      // "" = unattributed (residual path)
  selfHit: boolean;            // sourcePlayerId === localPlayerId
  weaponId: string;
  delivery: number;            // CombatDelivery value (0 on residual)
  element: string;
  dirX: number; dirY: number;  // 0,0 on residual
  damage: number;
  crit: boolean;
  finalBlow: boolean;
  tick: number;
  confidence: "authoritative" | "residual"; // "predicted" reserved for a future wave
}

export class CombatFeedbackBus {
  /** Called once per render frame by ArenaScene, BEFORE subscribers' update(). */
  ingest(rows: SyncedCombatReceiptRows | undefined, enemyHpDeltas: ReadonlyMap<string, number>,
         localPlayerId: string, stateTick: number): void;
  subscribe(fn: (e: HitFeedbackEvent) => void): () => void;
}
```

Laws (each is a unit test, §8):

1. **Seq dedup** — per-slot last-seen seq, exactly the proven `captureSyncedDamageReceipts` pattern
   (`ArenaScene.ts:6953-6958`): ignore `seq === 0`, ignore unchanged, bounded map with reset. One event
   per receipt, ever.
2. **Residual law** — per target per frame:
   `residual = hpDelta − Σ(receipt.damage for that target ingested this frame)`. If
   `residual > 0.5` emit one `confidence:"residual"` event carrying the residual, `sourcePlayerId:""`,
   `crit:false` (the critFlash diff is claimed by the receipts when any receipt for that target crit;
   if zero receipts arrived for the target, the critFlash-diff crit bit rides the residual event —
   preserves today's behavior on old servers). Receipts alone (no hp delta yet, e.g. patch ordering)
   still emit — the receipt is authoritative.
3. **Wrap detection** — track global max seq; if the gap between consecutive ingests exceeds the number
   of new rows seen, receipts were lost to ring wrap → the residual law automatically covers the missing
   damage (it is *why* the residual law exists); the bus additionally sets a `droppedReceipts` counter
   readable by debug overlays.
4. **Self-damage rows** (`targetId === localPlayerId`) are emitted like any other event; the existing
   death-recap consumer keeps its own path for now (migration = follow-up, §9), and the hitfx panel can
   subscribe for incoming-hit effects.
5. **Zero allocation steady-state** — the bus reuses one scratch event object per emit
   (subscribers must not retain it; documented in the interface), matching `xp-motes.ts`'s
   `receiptEvent` reuse (`xp-motes.ts:92`).

ArenaScene wiring: `updateCombatFx()` keeps its hp-diff loop (it already computes per-enemy deltas and
owns hit-flash budgets) but stops calling `spawnDamageNumber` directly; it hands the delta map + state
rows to `bus.ingest()`. Damage numbers, hitfx impact effects, and (later) hit audio become subscribers.
The bus is the **single consumer of the ring** on the client feedback side.

---

## 3. Renderer

### 3.1 BitmapText vs Text — the reasoning

| | Pooled `Text` (today) | `BitmapText` / glyph atlas |
|---|---|---|
| `setText` cost | Re-rasterizes an offscreen canvas + re-uploads a GL texture **per label per change** | Re-indexes quads into an existing texture — no raster, no upload |
| Tick-up-in-place (§4) | Worst case: 24 labels × value change every ~50ms = constant canvas raster + texture churn | Free — this is exactly what bitmap glyphs exist for |
| Batching | One texture per label → breaks the sprite batch per label | One shared atlas → all labels in one draw call |
| DPR | `resolution` param handles it | Author atlas at `size × RENDER_DPR` |
| Styling (stroke, per-band color) | Arbitrary canvas styling | Stroke baked into glyphs; color via tint per glyph |
| Asset cost | none | none, **if generated at runtime** |

The deciding constraint is the aggregation engine: tick-up-in-place mutates label text continuously.
Canvas-`Text` re-raster on every mutation is the one cost that scales with exactly the horde scenario we
must survive. **Verdict: bitmap glyphs from a runtime-generated atlas.**

No bitmap font asset exists in the repo (zero grep hits for `BitmapText`/`bitmapFont`), and the project
already generates textures at runtime (card-art, decals, `ptcl:` particles) — so we generate the atlas
at scene create: render the glyph set `0123456789!+x.` per style band into one `CanvasTexture` at
`bandFontPx × RENDER_DPR`, with the band's fill/stroke baked in (stroke thickness from
`styleDamageNumber`'s bands, `vfx.ts:1158-1177`). Preferred wrapper: `RetroFont.Parse` over the fixed
grid → real `Phaser.GameObjects.BitmapText` objects (dynamic per-glyph layout for free). **Verify
RetroFont survives in Phaser 4 at implementation time**; the fallback is the same atlas composed from
pooled `Image` glyphs positioned manually (a ~40-line layout function — max 7 glyphs per label). Either
way the texture, batching, and DPR story is identical.

### 3.2 Pool + zero steady-state allocation

Follow `xp-motes.ts` exactly:

- `MAX_DAMAGE_LABELS = 32` (headroom over the 24/frame budget; labels live ~600-900ms so concurrency
  peaks near budget × lifetime / patch cadence, clamped by per-target aggregation to ~one label per
  visible target).
- Per-slot parallel typed arrays: `age: Float32Array`, `x/y/vy: Float32Array`,
  `value/displayValue: Float64Array`, `flags: Uint8Array` (crit | finalBlow | self | teammate |
  residual), `band: Uint8Array`, plus `targetIds: string[]` and the label objects.
- **No tweens.** Rise/pop/fade sample age curves in `update(deltaMs)` (the codebase already migrated xp
  motes off tweens for this reason, `xp-motes.ts:57-60`). This also removes the two-allocations-per-
  number cost of today's implementation.
- Free-list acquire/release with generation stamps (the existing `entry.generation` guard in
  `vfx.ts:1229-1258` shows why: pooled object reuse must invalidate in-flight animations).
- Scene `SHUTDOWN` teardown identical to `DAMAGE_NUMBER_POOLS`' handler (`vfx.ts:1146`).

### 3.3 Legibility (the directive's "legible, readable")

- Keep the proven magnitude bands as defaults (13/17/22/28px, crit ≥30px gold) — **final values are the
  designer's** (docs/dmgnum-panel/designer.md); the renderer takes them as a `DamageNumberStyleSpec`
  table so design iterates without touching pool code.
- Bake a 3-4px dark stroke into every band's glyphs (today only big/crit bands get strokes — small gold
  numbers on bright floors is the main current legibility failure).
- Deterministic horizontal jitter (seeded per slot, replacing `Math.random()` at `vfx.ts:1236`) and a
  per-target spawn-angle rotation so rapid sequential labels on one target don't stack — but §4's
  aggregation means sequential labels on one target are rare by construction.
- `prefers-reduced-motion` (`ArenaScene.ts:236`): shorter rise, no pop-scale overshoot, same lifetimes.

---

## 4. Aggregation engine

Per-target accumulators, tick-up-in-place. Thresholds/timings below are engine defaults **subordinate to
the designer's numbers** — every one is a named field in one `DamageNumberTuning` object.

- **Accumulator map** — `targetId → slot`. While a target's label is in its *hold* phase (first
  ~450ms of life), any new event for that target folds in: `value += damage`, `crit ||= crit`,
  band recomputed from the new total, label position re-anchored to the target's rig (soft-follow,
  lerp ~12%/frame — a tick-up label glued to a moving enemy reads as "this enemy is taking damage";
  a stranded one reads as noise).
- **Tick-up-in-place** — `displayValue` approaches `value` exponentially (~90ms time constant),
  glyphs re-indexed **only when `round(displayValue)` changes** (bounded glyph churn, zero raster —
  this is what §3's renderer buys). A fold-in also re-triggers a small scale pulse (capped frequency
  ~1/80ms so machine-gun weapons don't strobe).
- **Flush laws** (each a unit test):
  1. `finalBlow` → immediate flush: label detaches (stops following), plays the kill accent (bigger
     pop, brief hold), accumulator entry cleared. Next hit on a same-id respawn starts fresh.
  2. Hold expiry → label enters float+fade (~450ms, matching today's 480/620ms feel), accumulator
     cleared; subsequent hits open a new label.
  3. Crit arriving into a non-crit accumulator upgrades styling in place (gold + `!`) — never spawns a
     second label (crit styling wins, same precedence as `vfx.ts:1208`).
  4. Target despawn (rig removed) → detach and finish fading in place; accumulator cleared.
  5. Same-frame multi-hit (one patch, N receipts, one target) collapses into one fold — subsumes and
     replaces the current `pool.sameFrame` map (`vfx.ts:1203`).
- **Budgets preserved** — the 24-labels-per-frame spend and visible-first stable sort remain in
  ArenaScene exactly as today (`ArenaScene.ts:7136-7148`); aggregation makes the budget dramatically
  harder to hit since a target holds at most one live label.
- **Residual events** fold into the same accumulator as attributed ones (the player perceives one
  damage stream per enemy); the `residual` flag only matters for co-op filtering (§7).

---

## 5. Depth / layer placement

Measured bands (`ArenaScene.ts:1648-1972`, `xp-motes.ts:4-6`):

```
100000-100012  HUD / screen-space UI (scrollFactor 0)
 99998         dangerVignette          ← protected danger band
 99997         telegraphGfx (aerial)   ← protected danger band
 99996         +N XP labels
 99993         xp receipt rings
 99989-99990   parry/grab/ground-telegraph gfx
 y-sorted      actor rigs, world vfx
```

Current damage numbers at `100000` (`vfx.ts:1224`) sit *inside the HUD band and above the danger
overlays* — a wall of crit numbers can occlude an active telegraph. **New contract:
`DAMAGE_NUMBER_DEPTH = 99995`** — above actor rigs and xp receipt rings, below the `+N XP` labels
(kill/damage info outranks xp garnish is arguable, but xp labels are rarer; if the designer disagrees,
swap 99995/99996 — both stay under the danger band), and strictly **under 99997/99998** so telegraphs
and the danger vignette are never occluded by feedback text. Define it (plus the atlas key) in the new
module, not in `constants.ts` (file lock, §9 — and it's client-only, so shared constants are wrong
anyway).

---

## 6. Settings system

None exists (§1.6). Spec — new file `packages/client/src/settings.ts`, **one settings shape for all
combat feedback** so the hitfx panel adds fields, not files:

```ts
export interface FeedbackSettings {
  damageNumbers: "all" | "own" | "off";   // default "all"  ← always-on directive
  damageNumberScale: 0.85 | 1 | 1.25;     // default 1 (designer's a11y sizes)
  // reserved for the hitfx panel (same shape, one migration story):
  hitSparks: boolean;                      // default true
  screenShake: number;                     // 0..1, default 1
  hitStop: boolean;                        // default true
  flashes: "full" | "reduced";             // default "full" (photosensitivity)
}
export interface ClientSettings { version: 1; feedback: FeedbackSettings; }

export function loadSettings(): ClientSettings;            // safe-parse, defaults on any failure
export function updateSettings(patch: DeepPartial<ClientSettings>): void;  // merge + persist
export function onSettingsChange(fn: (s: ClientSettings) => void): () => void;
```

- **Storage**: single key `dd.settings.v1`, JSON, try/catch on both ends (private-mode law already
  followed by every existing caller, `AudioBus.ts:54`). Unknown fields preserved on write (forward
  compat between waves). `version` gates future migrations.
- **Defaults are the directive**: `damageNumbers: "all"` — always on unless the player opts out.
  `"off"` exists because opt-out is the directive's own carve-out; `"own"` is the co-op noise valve.
- **Not migrated in this wave**: `dd.audio.*` stays owned by AudioBus, `dd.beltScrip`/`dd.beltUpgrades`
  stay as-is. Folding audio into `ClientSettings` is a mechanical follow-up once the module ships.
- **UI**: extend the existing MenuScene bottom-left row pattern (`MenuScene.ts:182`) with a
  `DMG: ALL/OWN/OFF` cycler; in-arena, reuse the `M`-key toast pattern (`ArenaScene.ts:3076-3078`) if
  the designer wants a hotkey. The renderer subscribes via `onSettingsChange` — `"off"` releases all
  live slots immediately (no half-faded orphans).
- The `prefers-reduced-motion` OS signal is **not** a settings field; it keeps being read live
  (`ArenaScene.ts:236`) and composes with whatever the settings say.

---

## 7. Co-op filtering

Receipt `sourcePlayerId` vs the local session id (the same self-id ArenaScene already passes to
`captureSyncedDamageReceipts`, `ArenaScene.ts:7217`):

| Event class | `"all"` (default) | `"own"` |
|---|---|---|
| Own hits (`selfHit`) | full styling | full styling |
| Teammate hits | rendered at 0.8 scale, 0.75 alpha, no kill-accent pop (their kill, your info) | hidden |
| Residual/unattributed | full styling minus crit gold (attribution unknown) | hidden (cannot prove it's yours) |
| Own hits **on teammates' targets mid-accumulation** | fold normally — the accumulator is per *target*; mixed-attribution accumulators style as "own" if any folded event was yours | only own events fold; teammate damage never inflates your number |

The `"own"` accumulator law (last row) is the subtle one: in `"own"` mode the bus still emits teammate
events (hitfx may want them) but the damage-number subscriber filters *before* folding — so the shown
total is honestly "your damage", not "damage while you were also shooting".

---

## 8. Test strategy

House pattern: colocated `*.test.ts`, vitest, pure modules kept Phaser-free (`prediction.test.ts`,
`snapshots.test.ts` precedent in `packages/client/src/net/`).

1. **`combat/feedback-bus.test.ts`** (pure, node): seq dedup (unchanged seq, seq 0, slot reuse, uint32
   wrap of seq itself); residual math (receipts sum == delta → no residual; partial coverage → exact
   residual; delta with zero receipts → full residual + critFlash-diff crit bit); ring-wrap gap →
   residual covers, `droppedReceipts` increments; self vs teammate classification; scratch-object reuse
   (subscriber that retains sees mutation — documents the contract).
2. **`ui/damage-numbers.test.ts`** (pure aggregation core extracted from the renderer — the
   accumulator/flush state machine takes `(event, nowMs)` and returns slot commands, no Phaser): all
   five flush laws of §4; crit precedence; tick-up display-value convergence and glyph-change gating;
   `"own"`-mode fold filtering (§7); budget interaction (25 targets, 1 frame → 24 labels, visible-first).
3. **`settings.test.ts`** (pure, jsdom localStorage or injected storage): round-trip, corrupt JSON →
   defaults, unknown-field preservation, subscriber notification, private-mode throw → in-memory
   fallback.
4. **Renderer** stays a thin adapter (atlas build + glyph indexing + curve sampling) — verified via the
   `verify` skill/manual horde run (dummy + `B` boss spawn already exist as in-game test levers),
   watching for: one draw call for all labels (spector/renderer debug), zero GC churn in performance
   profile during sustained beam fire on a dummy (`enemy.kind === "dummy"` never dies —
   `GameRoom.ts:5126` — making it the perfect tick-up soak target).

---

## 9. File/function touch list

**New files (client only, this wave):**

| File | Contents |
|---|---|
| `packages/client/src/combat/feedback-bus.ts` | `CombatFeedbackBus`, `HitFeedbackEvent`, seq/residual laws (§2.2). Shared with hitfx panel. |
| `packages/client/src/combat/feedback-bus.test.ts` | §8.1 |
| `packages/client/src/ui/damage-numbers.ts` | `DamageNumberRenderer` (pool, atlas, curves) + exported pure `DamageNumberEngine` (accumulators/flush) + `DamageNumberTuning`/`StyleSpec` defaults + `DAMAGE_NUMBER_DEPTH` |
| `packages/client/src/ui/damage-numbers.test.ts` | §8.2 |
| `packages/client/src/settings.ts` | `ClientSettings`, load/update/subscribe (§6) |
| `packages/client/src/settings.test.ts` | §8.3 |

**Modified:**

- `packages/client/src/scenes/ArenaScene.ts` — construct bus + renderer in `create()`; in
  `updateCombatFx()` (`:7100`) replace the direct `spawnDamageNumber` call (`:7147`) with
  `bus.ingest(...)`; call `renderer.update(deltaMs)` from the scene update alongside
  `XpMoteRenderer`; keep flash/spark/audio paths untouched (they migrate to bus subscription in the
  hitfx wave); wire settings into the renderer; scene shutdown/restart cleanup (`:1453-1560` block).
- `packages/client/src/scenes/arena/vfx.ts` — `spawnDamageNumber`/`styleDamageNumber`/pool
  (`:1125-1265`) deleted **after** the new path ships (same PR, second commit), or kept one wave behind
  a dead-code flag if the panel wants a revert lever. No other exports in the file are touched.
- `packages/client/src/scenes/MenuScene.ts` — settings row extension (§6, small).

**Explicitly NOT touched (file lock):** `packages/server/src/rooms/GameRoom.ts`,
`packages/shared/src/state.ts`, `packages/shared/src/constants.ts` — owned by the running enemy-combo
wave. Nothing in this wave requires them: per-hit receipt coverage already exists (§1.2).

**Follow-up wave (server, spec only — hand to the wave that owns GameRoom/state/constants):**

1. Raise `COMBAT_RECEIPT_CAP` 32 → 64 (`constants.ts:356`) — horde AoE wrap is the only case where
   numbers degrade to unattributed residuals. Pure constant bump; ring is preallocated, cost is
   64 × ~60B of schema rows.
2. Optional: receipts for non-player enemy damage (relax the `sourcePlayerId` guard,
   `GameRoom.ts:2124`, + a `sourceKind` byte) — retires the residual path's last legitimate producer.
3. Optional: `targetX/targetY` on the receipt row — lets numbers render for hits on enemies whose rigs
   the client hasn't spawned (off-AoI later, worm segments already encode position via slot).
4. Migrate the death-recap consumer (`captureSyncedDamageReceipts`) onto the bus (client-only but
   touches recap logic — separate change for blame clarity).

---

## 10. Notes for the other panelists

- **Designer**: every threshold in §3.3/§4 is a named tuning field; the engine ships with today's
  proven bands as defaults. The one hard constraint from tech: per-target aggregation with tick-up is
  load-bearing for the horde budget — a design that wants one label per individual hit at horde scale
  contradicts the 24-label budget and the receipt-ring capacity.
- **Hitfx panel** (`docs/hitfx-panel/`): §2.2 is the proposed shared contract — one
  `CombatFeedbackBus`, you subscribe with the same `HitFeedbackEvent`; the §6 `FeedbackSettings` shape
  reserves your toggles (`hitSparks`, `screenShake`, `hitStop`, `flashes`) so we ship ONE settings
  surface. Flag any field you need on the event that isn't there (knockback magnitude? it's derivable
  from `dirX/dirY` + delivery).
