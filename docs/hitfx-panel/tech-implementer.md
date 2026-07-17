# Hit-FX Panel — Tech Implementer: The Hit Event Pipeline

Status: architecture spec (no source files modified). Companion docs in this folder (feel / audio / vfx)
author the *content* of each feedback layer; this doc is the plumbing they all land on.

Ground truth read for this spec (all paths absolute):

- `C:\Users\Exped\DDv2\packages\shared\src\state.ts` — `CombatReceiptState` (lines 318–334), ring on
  `ArenaState.combatReceipts` (line 468, schema v18).
- `C:\Users\Exped\DDv2\packages\shared\src\constants.ts` — `COMBAT_RECEIPT_CAP = 32` (line 356),
  `TICK_RATE = 20`, `CombatDelivery` taxonomy in `combat.ts` (Melee/Gun/Cast/Thrown/Beam/Quake/Chain/Parry/Scatter).
- `C:\Users\Exped\DDv2\packages\server\src\rooms\GameRoom.ts` — `writeCombatReceipt` (line 2111), ring
  alloc in `onCreate` (line 678), tick-locked patches (`setPatchRate(0)`, line 1230; broadcast at end of
  every 20Hz tick), all `damageEnemy`/`damageWormSlots` call sites.
- `C:\Users\Exped\DDv2\packages\client\src\scenes\ArenaScene.ts` — the current consumers: death-recap
  reader `captureSyncedDamageReceipts` (line 6944), hp-diff hit FX `updateCombatFx` (line 7100), predicted
  fire feedback in the attack path (lines 6400–6557), `hitStop` leaky bucket (line 6848,
  `FREEZE_BUDGET_MS=250/1000ms`), prioritized `shakeCam` (line 6868), `HIT_VFX_BUDGET=10` /
  `DAMAGE_NUMBER_BUDGET=24` per-frame budgets (lines 188–189).
- `C:\Users\Exped\DDv2\packages\client\src\audio\AudioBus.ts` — 24-voice cap with low/normal/critical
  priority tiers (`claim`, line 167), per-event `throttled()` rate limits, the single `play(event, opts)`
  dispatcher.
- `C:\Users\Exped\DDv2\packages\client\src\vfx\VfxPlayer.ts` + `fx-composer.ts` — pooled VFX surfaces.
- `C:\Users\Exped\DDv2\packages\client\src\entities\SpriteRig.ts` — freeze-aware animation clock
  (lines 1589–1608), single reschedulable `flash()` timer (line 2372).

---

## 1. What exists today (and why it isn't enough)

**Server.** Every player-attributed hit on an enemy already writes one row into the fixed 32-slot
`combatReceipts` ring — not just kills. `writeCombatReceipt` is fed by `damageEnemy` (line 5112, ALL
deliveries: melee edges, gun projectiles, beam ticks, chain hops, quakes, parry counters, scatter,
thrown) and `damageWormSlots` (line 5044, worm segments). Each row carries:
`seq (uint32, monotonic, never 0)`, `tick`, `targetId`, `sourcePlayerId` (== sessionId, set at line 1962),
`weaponId`, `delivery (uint8)`, `element`, `dirX/dirY` (unit source→target), `damage (post-crit/brand)`,
`crit`, `finalBlow`. Training dummies never set `finalBlow` (line 5110: `enemy.kind !== "dummy"`), so the
kill-confirm layer can't false-fire in training. Patches are tick-locked (patchRate 0, broadcast at the
end of each 20Hz tick), so a receipt reaches the client one half-RTT after the tick that dealt the hit.

**Client.** Three disconnected feedback drivers exist:

1. **hp-diff driver** (`updateCombatFx`, line 7113): `enemy.hp < prev` → flash + damage number + hit
   audio + sparks. It *aggregates* every hit in a patch into one delta, attributes the blow direction to
   the *nearest player rig* (a heuristic, wrong in melee scrums), infers crit from the `critFlash`
   counter (saturates at 1 crit/patch), and cannot tell YOUR hit from a teammate's.
2. **predicted fire feedback** (attack path, ~6479): muzzle flash + shot audio + recoil shake on the
   *click*; melee swing VFX + whoosh at swing start; quake even does a local "connected" scan before
   spending priority hit-stop (line 6470). This is *fire* feedback, not *contact* feedback — nothing
   plays at the moment your bullet visibly touches an enemy.
3. **death-recap receipt reader** (`captureSyncedDamageReceipts`, line 6944): already scans the ring
   per frame with a per-slot seq map — but only for rows where *you are the target*, which the current
   ring never produces (see §7 gap #1). It's a forward-compat reader for a server wave that hasn't landed.

So today: contact feedback arrives a round-trip late, coalesced, mis-attributed, and there is no
own-hit confirm channel at all. The receipts fix all of that with **zero new wire** — nobody consumes
them for hits yet.

---

## 2. Pipeline shape — one dispatcher, two inlets, three outlets

New module: **`packages/client/src/combat-feedback.ts`** — a Phaser-free class (`CombatFeedback`) owned
by ArenaScene, unit-testable in vitest without a scene. ArenaScene wires its sinks at create.

```
                    ┌─────────────────────────────────────────────┐
 (a) PREDICTED      │            CombatFeedback                   │   AUDIO outlet
 local contacts ───▶│  predictLedger ── dedup law ── channel      │──▶ AudioBus.play("confirm…")
 (same frame,       │       ▲                        token        │
 self only)         │       │ match/upgrade          buckets      │   VFX outlet
                    │       │                          │          │──▶ spark/flash/accent sinks
 (b) AUTHORITATIVE  │  receiptReader (ring law §4) ────┘          │
 combatReceipts ───▶│  self hits ▸ upgrade/confirm                │   FEEL outlet
 (tick + ½RTT)      │  mate hits ▸ ambient accents                │──▶ arena.hitStop / shakeCam /
                    └─────────────────────────────────────────────┘    rig.flash (existing gates)
```

**Inlet (a) — predicted contacts** (`onPredictedContact(e)`), emitted by ArenaScene only for the LOCAL
player, at the frame the contact is visually true:

- **Melee**: at `swing.impactSeconds` after the predicted swing starts (the same descriptor the rig and
  VfxPlayer already consume), sweep-test the swing arc (shared `meleeReach`/`swingEdgeProgress` from
  `@dd/shared`) against interpolated enemy circles — exactly the pattern the quake path already uses at
  line 6470. Emit one event with the strongest overlapped target (or `targetId: ""` for a whiff — the
  feel doc may want whiff audio).
- **Projectiles**: in `moveProjectiles` (line 4588), when a dead-reckoned OWN bullet's circle first
  overlaps an enemy circle, emit once per projectile id. (Ownership: the nearest-shooter capture that
  `syncProjectiles` already does at line 4515.)
- **Quake / cast / thrown**: quake reuses its existing connected scan; cast/thrown contact predicts off
  the same dead-reckoned projectile row.

Predicted events carry NO damage and NO crit — the client can't know either (crit is rolled server-side
in `damageEnemy`). They exist purely to buy back the round-trip.

**Inlet (b) — receipts** (`drainReceipts(rows, selfId)`), the ring reader of §4. Rows split:

- `sourcePlayerId === selfId` → the hit-confirm path (dedup law §3).
- other players' hits → ambient path only (world sparks/flash for visible targets; never the confirm
  tick — CoD law: the tick means *you*).

**Outlets.** The dispatcher never talks to Phaser directly; ArenaScene injects three sink interfaces:

```ts
interface FeedbackSinks {
  audio(event: string, opts: { x?: number; amt?: number }): void;      // → AudioBus.play
  vfx(kind: HitAccentKind, x: number, y: number, e: HitEvent): void;   // → spawnHitSpark/ring/flipbook…
  feel(kind: "hitstop" | "shake" | "flash", e: HitEvent): void;        // → hitStop/shakeCam/rig.flash
}
```

Existing global governors are NOT bypassed: AudioBus keeps its voice cap + per-event throttles as the
final audio guard; `hitStop`'s 250ms/1s leaky bucket and `shakeCam`'s intensity-priority gate stay
authoritative for feel; the per-frame `HIT_VFX_BUDGET` stays the VFX ceiling. The dispatcher's token
buckets (§5) sit *upstream* — they shape intent so the governors rarely have to clip.

**Position resolution.** Receipts carry no target x/y. The dispatcher resolves `targetId` → enemy rig
position; `worm:<slot>:<gen>` ids resolve via the worm renderer's slot table. To survive the
died-and-despawned-same-patch case, `drainReceipts` MUST run in ArenaScene's update *before* enemy-rig
removal/`syncProjectiles` teardown for the frame, and the dispatcher keeps a tiny `lastKnownPos`
(id → x,y, cap 64, cleared on run reset) refreshed by the receipt/predict traffic itself. Fallback:
the local player's position + `dir * 40` (the receipt's unit vector makes this decent).

---

## 3. The dedup law (predicted then confirmed — never both in full)

A single hit may surface twice: once from inlet (a) instantly, once from inlet (b) ~50–125ms later.
The law:

> **Predicted plays the cheap instant layer. The receipt plays only the *delta*: magnitude, crit, kill.
> A receipt that matches a live prediction never replays the instant layer; a receipt with no matching
> prediction plays the full stack itself.**

Concretely, the instant layer (prediction-triggered, self only) is: the light confirm tick
(`confirm` audio), a small contact spark, `rig.flash(80)` on the target. The upgrade layer
(receipt-triggered) is: damage number (always authoritative — never predicted), `confirm:crit` /
`confirm:kill` stingers, gold crit flash + shock ring + speed lines, crit hit-stop, big-hit shake.

**The ledger.** `predictLedger: Map<string, PredictEntry>` keyed by

```ts
key = `${targetId}|${deliveryGroup}`   // deliveryGroup: melee|gun|cast|thrown|quake — one bucket per
                                       // delivery family so a sword hit can't consume a bullet's receipt
```

with `PredictEntry { atMs, charges }` — `charges` because one shotgun click predicts one contact but
may produce several pellet receipts on the same target; melee combo edges likewise. Matching rule:

1. On predicted contact: play instant layer, `charges++` (fresh entry `charges = 1`), stamp `atMs`.
2. On own receipt: look up key. If entry exists and `now - atMs <= PREDICT_TTL_MS` (default **250ms**
   = 2.5 ticks + generous jitter; tunable): consume one charge, play upgrade layer only.
3. No entry / expired / zero charges: play the FULL stack (instant + upgrade) from the receipt — this
   is the graceful path for chain-lightning hops, burn re-pulses, beam ticks, riposte counters, and any
   delivery the client never predicts. Higher latency, never silence.
4. Sweep entries older than `PREDICT_TTL_MS` each update; an expired unconsumed prediction is a
   **miss** — nothing to roll back, because the instant layer is deliberately non-committal (a tick and
   a spark claim "contact", not damage). This is why damage numbers are receipt-only.

**Interlock with the legacy hp-diff driver.** Until the hp-diff loop is retired, double feedback is
prevented by a one-frame set: `drainReceipts` records every enemy id it played FX for this frame in
`receiptTouched: Set<string>`; `updateCombatFx`'s enemy loop skips its audio/spark/number spend for ids
in that set (still updates its `enemyHp`/`enemyCrit` bookkeeping). Receipts and the hp drop for the
same hit arrive in the *same patch* (both written in the same tick, patch broadcast at tick end), so
one frame of suppression is exactly right. End state (cleanup wave): the hp-diff loop keeps only
non-player-attributed damage (receipts can't exist for it — `writeCombatReceipt` early-returns on empty
`sourcePlayerId`, line 2124) and off-state fallbacks.

---

## 4. Receipt-ring consumption contract (the reader law)

The ring is 32 preallocated rows overwritten in cursor order; `seq` is uint32, monotonic, wraps
skipping 0 (server: lines 2127–2129). Colyseus syncs row *mutations*, so the client sees changed rows
each patch but must impose ordering itself. The reader:

```ts
// wrap-aware: is a newer than b on the uint32 circle?
const seqAfter = (a: number, b: number) => a !== b && ((a - b) >>> 0) < 0x8000_0000;

drainReceipts(rows, selfId):
  fresh: HitReceipt[] = []
  rows.forEach(row => { if (row.seq !== 0 && seqAfter(row.seq, lastSeenSeq)) fresh.push(copyOf(row)) })
  fresh.sort((x, y) => (seqAfter(x.seq, y.seq) ? 1 : -1))       // ascending, wrap-aware
  for (r of fresh) dispatch(r)
  if (fresh.length) lastSeenSeq = fresh[fresh.length - 1].seq
```

Laws:

1. **Full scan, no per-row seq map.** Scan all 32 rows every frame (trivial cost). The death-recap
   reader's per-slot map (line 6955) is fine for "latest damage to me" but cannot give total order;
   the hit dispatcher needs order (a kill receipt must not play before the hit that preceded it).
2. **Baseline on attach, play nothing.** On room join / run restart / scene reset, set
   `lastSeenSeq = max over rows (wrap-aware)` WITHOUT dispatching — a mid-run joiner otherwise replays
   up to 32 stale hits as a burst. (The seq counter is room-lifetime; it survives run restarts.)
3. **Overflow is coalescence, not error.** >32 receipts written in ONE tick (4 players × AoE horde
   clear can do it: patches go out every tick, so the window is exactly one tick) means the oldest
   rows were overwritten before broadcast. The reader observes a seq *gap*
   (`fresh.minSeq != lastSeenSeq + 1`). Law: count it (debug overlay metric `receiptsDropped`), never
   stall or error — the rate compressors would have squashed those extra events anyway. No server-side
   cap raise needed at current content scale.
4. **Copy out, then dispatch.** Never hold references to schema rows across frames — the row will be
   overwritten under you.
5. **Reset law:** `lastSeenSeq = 0` + ledger/pos-cache clear when the room object changes; re-baseline
   per law 2 on the first frame with rows.

---

## 5. Rate-compression primitives (shared by all three channels)

One primitive, three instances, thresholds owned by the designer docs (values below are placeholders
they overwrite):

```ts
class TokenBucket {
  constructor(public capacity: number, public refillPerSec: number) {}
  tryTake(nowMs: number, cost = 1): boolean;   // refill-by-elapsed, then spend or reject
}
```

Per-channel policy inside the dispatcher (each also **coalesces within a frame**: events rejected by
the bucket in frame N fold their `count`/`totalDamage` into the next accepted event's `amt`, so
magnitude survives compression — the CoD trick where a 6-hit burst reads as ONE fatter tick):

| Channel | Bucket (placeholder) | Coalesce rule | Final governor (unchanged) |
|---|---|---|---|
| audio confirm ticks | cap 4, refill 14/s | fold hits/frame into one tick, `amt = min(1, Σdmg/45)`; streak counter for the audio doc's pitch-ramp | AudioBus voice cap + `throttled()` |
| vfx accents | cap 8, refill 20/s | one accent per target per frame | `HIT_VFX_BUDGET=10`/frame, visibility sort |
| feel (stop/shake/flash) | cap 3, refill 6/s | strongest event of the frame wins | freeze leaky bucket + `shakeCam` intensity priority |

Crit/kill upgrades bypass the confirm bucket but pay into it (skill beats are sacred — same philosophy
as `hitStop(priority)`), and kill confirms additionally rate-limit themselves (existing
`lastKillStop >= 110ms` pattern, line 3438).

New AudioBus vocabulary (client file we own): `confirm`, `confirm:crit`, `confirm:kill` recipes —
short, dry, high-passed ticks at `normal`/`critical` priority per the audio doc. Everything else
reuses the existing `hit`/`bighit` palette.

---

## 6. Latency budget

| Layer | Trigger | Budget |
|---|---|---|
| instant (tick + spark + flash) | predicted contact, inlet (a) | **same frame as visual contact — ≤1 render frame (16.7ms), zero network** |
| authoritative upgrade (number, crit/kill accents) | receipt, inlet (b) | tick quantization (≤50ms) + ½RTT + 1 render frame ≈ 60–130ms after contact |
| fire feedback (muzzle/swing/recoil) | already shipped, on click | 0 frames (unchanged) |

Hit-stop stays receipt/parry/quake-gated (a mispredicted freeze feels worse than a late one); flash,
spark, and the confirm tick are cheap enough to risk on prediction. The dispatcher's `update()` runs
once per render frame from ArenaScene's update, before enemy-rig teardown (§2 position law).

---

## 7. Wire cost — zero new sync, with three named gaps

**Confirmed:** the ring already carries EVERY hit you land — non-kill hits included — with damage,
crit, finalBlow, weaponId, delivery, element, and direction. The entire hit-confirm feature ships with
**no schema change and no new messages.**

Gaps found (none blocks this feature; all become follow-up waves, §10):

1. **Enemy→player damage is NOT in the ring.** `writeCombatReceipt` requires a non-empty
   `sourcePlayerId` (line 2124) and is only called from enemy-damage paths, so "you got hit" receipts
   don't exist — the death recap survives on PlayerState attribution fields + inference
   (`capturePlayerDamageAttribution` / `inferDamageAttribution`). Irrelevant for own-hit confirm; if
   the audio doc wants an incoming-hit layer on the same bus, that's the server follow-up: either relax
   the guard with a `sourceKind` discriminator or (cleaner) the dedicated `damageReceipts` ring the
   recap reader already anticipates (line 6946).
2. **No target x/y on the row.** Client resolves via `targetId` with the §2 fallbacks. A two-field
   append (`targetX/targetY float32`) would delete the edge case — schema append + `SCHEMA_VERSION`
   bump, follow-up wave only.
3. **Orphaned sources drop receipts.** A beam whose owner disconnected passes `sourcePlayerId: ""`
   (line 3598) → no receipt. Cosmetic, ignore.
4. **Overflow at >32 hits/tick** silently drops oldest (§4 law 3) — accepted, monitored.

---

## 8. Settings surface — ONE shared shape with the damage-numbers panel

Today's precedent: AudioBus persists `dd.audio.vol`/`dd.audio.muted`; MenuScene renders the row. Rather
than each panel minting keys, propose **one** blob + accessor module both panels import:

New module `packages/client/src/feedback-settings.ts`, localStorage key **`dd.feedback.v1`** (JSON,
sanitized on read, every field optional with defaults):

```ts
export interface FeedbackSettings {
  hitConfirmAudio: boolean;            // the CoD tick layer            (default true)
  hitSparks: boolean;                  // contact/accent VFX            (default true)
  hitStop: boolean;                    // feedback-driven freezes       (default true)
  screenShakeScale: 0 | 0.5 | 1;       // scales every shakeCam intensity (default 1)
  reducedFlash: boolean;               // photosensitivity: no full-screen/gold strobes (default false)
  // ---- damage-numbers panel's slice (they own semantics; shape reserved here) ----
  damageNumbers: "off" | "self" | "all";   // default "all"
  damageNumberScale: number;               // 0.75–1.5, default 1
}
export function getFeedbackSettings(): FeedbackSettings;      // cached, sanitized
export function updateFeedbackSettings(p: Partial<FeedbackSettings>): void;  // persist + notify
export function onFeedbackSettingsChange(cb: (s: FeedbackSettings) => void): () => void;
```

The dispatcher consults it at dispatch time (no restart needed); AudioBus's master volume/mute stays
separate and global. `prefers-reduced-motion` (already respected by paper deaths, line 236) implies
`hitStop: false`-equivalent damping unless the user explicitly re-enables. **Coordination note:** the
damage-numbers panel writes the same file/key — whoever lands first creates the module, the other
extends the interface; no second key, no second menu row style.

---

## 9. File / function touch list

New files (parallel-safe, no owner conflicts):

- `packages/client/src/combat-feedback.ts` — `CombatFeedback` class: `onPredictedContact`,
  `drainReceipts`, `update(nowMs)`, `TokenBucket`, predict ledger, seq reader, `FeedbackSinks`.
- `packages/client/src/feedback-settings.ts` — §8 shared settings (coordinate with damage-numbers panel).
- `packages/client/src/combat-feedback.test.ts` — §11.

Edited files (client only):

- `packages/client/src/scenes/ArenaScene.ts`
  - create/reset the dispatcher (`create`, run-reset path near `resetDeathRecap`);
  - update loop: call `feedback.drainReceipts(state.combatReceipts, sessionId)` +
    `feedback.update(now)` BEFORE enemy despawn processing;
  - attack path (~6400–6557): schedule the melee predicted-contact sweep at `swing.impactSeconds`
    (mirror the quake `connected` scan); route quake's connected result through the dispatcher;
  - `moveProjectiles` (4588): own-bullet overlap test → `onPredictedContact`;
  - `updateCombatFx` (7100): skip audio/spark/number for `receiptTouched` ids (one-frame interlock);
  - wire `FeedbackSinks` to `audio.play` / `spawnHitSpark`/`spawnImpactRing`/`spawnSpeedLines`/
    `spawnDamageNumber` / `hitStop`/`shakeCam`/`rig.flash`.
- `packages/client/src/audio/AudioBus.ts` — add `confirm`, `confirm:crit`, `confirm:kill` recipes
  (+ streak pitch input via `amt`/a new opt, per the audio doc).
- `packages/client/src/scenes/arena/vfx.ts` — any new accent primitives the vfx doc specifies.

NOT touched: `state.ts`, `constants.ts`, `GameRoom.ts`, anything in `packages/server` (§10),
`SpriteRig.ts` (its `flash` + freeze-aware clock already do the job), `VfxPlayer.ts` (pooled surfaces
consumed as-is).

---

## 10. File-lock wave plan

- **LOCKED by the running enemy-combo wave:** `packages/server/src/rooms/GameRoom.ts`,
  `packages/shared/src/state.ts`, `packages/shared/src/constants.ts`. Nothing in this feature's ship
  wave touches them — every §7 gap fix is a **follow-up wave queued behind enemy-combo**, namely:
  (w2a) `targetX/targetY` receipt append + `SCHEMA_VERSION` bump; (w2b) player-taken-damage receipts
  (the `damageReceipts` ring the recap reader already sniffs for). Both are schema APPENDS per the
  codebase's field-order law (state.ts line 463 comment).
- **This wave (parallel-safe, client-only):** the §9 list. Single contention risk is `ArenaScene.ts`
  with the damage-numbers panel — sequence the two client waves or land the shared
  `feedback-settings.ts` + dispatcher first so their wave consumes it.
- **Doc waves (this panel):** feel/audio/vfx designers fill the placeholder thresholds in §5 and the
  accent vocabulary; no code contention.

---

## 11. Test strategy

The dispatcher is deliberately Phaser-free (constructor takes sinks + a clock), so everything below is
plain vitest in `packages/client` (which already runs `prediction.test.ts`/`snapshots.test.ts`):

1. **Ring reader law:** feed a fake 32-row array — baseline-on-attach plays nothing; ascending
   dispatch order across a wrapped cursor; uint32 seq wrap (0xFFFFFFFE → 2, skipping 0); overflow gap
   counted, not fatal; seq=0 rows ignored; rows copied not referenced.
2. **Dedup law:** predict→receipt inside TTL upgrades once (no double instant layer); shotgun
   multi-receipt consumes charges; receipt-only (chain/burn/beam) plays full stack; expired prediction
   dispatches nothing on sweep; teammate receipts never reach the confirm sink.
3. **TokenBucket:** refill timing, burst cap, frame coalescence folding `amt`, crit/kill bypass-but-pay.
4. **Settings:** sanitize garbage JSON, defaults, change notification, per-channel gating at dispatch.
5. **Server contract (existing, verify only):** `GameRoom.test.ts` already exercises receipt writes;
   add an assertion that a non-kill hit lands `crit`/`finalBlow=false` rows (guards gap-regression) —
   **queued to the enemy-combo wave owner**, since that file is locked.
6. **Manual feel pass:** training dummy (confirms fire, no false kill-confirm — dummy law), 200ms
   simulated latency (predicted tick leads receipt number; no doubles), 4-player horde clear
   (compression audible as fatter-not-more ticks; `receiptsDropped` overlay stays sane).
