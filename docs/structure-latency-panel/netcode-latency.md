# Reviewer 3 — netcode structure and perceived-latency audit

## Scope, baseline, and verdict

This review is against the committed client, not the in-flight working-tree edits: every `ArenaScene.ts` and `AudioBus.ts` citation below was read with `git show HEAD:<path>`. Server/shared files are the current tracked files. No source was changed.

The core architecture is sound: the local player predicts motion, melee, gun muzzle/audio, beam charge anticipation, parry brace, and jump physics; the server runs fixed 50 ms substeps; patches are broadcast at the end of the simulation batch rather than from an independently phased patch timer; and remote bodies use tick-stamped interpolation. The main avoidable delays are narrower:

- a remote melee pose is deliberately held an extra **120 ms after its acceptance patch is received**;
- movement, jump, and beam intent can wait **0–50 ms** for the client's command mint, then another **0–50 ms** for the server tick;
- beam prediction has an update-order race that can assign the predicted start to the command *after* the fire command that the server actually accepts;
- local jump displacement does not begin until a command is minted, despite comments calling it same-frame;
- at entity ceilings, schema churn is approximately **4.48 KB/patch at 20 Hz per client**, with projectile `x/y` the largest avoidable component.

All concrete budgets below use **100 ms RTT / 50 ms one-way**, **60 fps**, and an uncongested WebSocket unless stated otherwise. They are parameterized so another RTT can be substituted:

- `C = 0–50 ms` client command-phase wait, mean 25 ms;
- `S = 0–50 ms` server tick-phase wait, mean 25 ms;
- `F = 0–16.7 ms` one render/input frame, mean 8.3 ms;
- `O = RTT/2` one-way transit;
- `I = 120 ms` remote body interpolation delay.

“Real” means authority or information reaches the other machine earlier. “Perceived” means local/observer feedback begins earlier while authoritative timing is unchanged.

## Complete input-to-action pipeline

| Stage | What actually happens | Delay budget | Evidence |
|---|---|---:|---|
| 1. Physical input reaches Phaser | WASD is sampled in `stepNetInput`; Space is latched into `jumpQueued`; RMB/LMB are sampled by the per-frame attack/parry methods. | `F` for action RPCs; up to `C` for command-bound edges | `packages/client/src/scenes/ArenaScene.ts:3058-3060`, `:6410-6419`, `:6587-6596`, `:9779-9782` |
| 2. Command mint | `TICK_RATE=20`, therefore `TICK_MS=50`; the accumulator mints at most three sequence commands in a frame. | `C = 0–50`, mean 25 | `packages/shared/src/constants.ts:15-18`; `packages/client/src/scenes/ArenaScene.ts:9529-9531`, `:9790-9814` |
| 3. Local prediction | Each minted command advances the pure predictor by one exact 50 ms step; between mints, `renderPos` applies a non-accumulating fractional preview. | Movement: next render. Jump: only after mint. | `packages/client/src/net/prediction.ts:213-242`, `:360-381`; `packages/client/src/scenes/ArenaScene.ts:5824-5848` |
| 4. Message serialization | Colyseus prefixes the string message type and MessagePack-encodes the object synchronously before `connection.send`. Measured payloads are 104 B input, 64 B attack, and 7 B parry. | Normally sub-ms; bandwidth/HOL cost under load | `packages/client/node_modules/colyseus.js/lib/Room.js:91-105` |
| 5. Transport | Production uses `WebSocketTransport`; all commands and patches therefore share a reliable ordered TCP stream. | `O` each way; a lost packet can add roughly another RTT through HOL | `packages/server/src/index.ts:9-12`; `packages/client/node_modules/colyseus.js/lib/Room.js:91-105` |
| 6. Server admission and budgets | Input has four tokens/tick; action RPCs share eight tokens/tick. Input validates a wrap-aware monotonic seq and pushes to a queue capped at eight. | Handler work is immediate on arrival; over-budget traffic is dropped | `packages/shared/src/constants.ts:127-137`; `packages/server/src/rooms/GameRoom.ts:748-756`, `:817-847` |
| 7. Queue consumption | At phase 0 the server refills budgets, drops an input backlog to the newest command, consumes one command, updates `ackSeq`, aim, and jump buffer. | `S = 0–50`, mean 25 | `packages/server/src/rooms/GameRoom.ts:2291-2340` |
| 8. State mutation | Movement runs in phase 1. Buffered parry/jump and attacks run in phase 4; jump is seeded before vertical integration; accepted attacks stamp `attackSeq/attackTick`. An off-cooldown parry is exceptional: it executes directly inside the message callback. | Same consuming tick; direct parry has no `S` | `packages/server/src/rooms/GameRoom.ts:2349-2401`, `:2548-2663`, `:2936-2941`, `:896-916` |
| 9. Patch encoding/broadcast | The room interval is 50 ms. The independent Colyseus patch timer is disabled, and `broadcastPatch()` runs once after all fixed substeps in the callback. | Approximately 0 ms after the batch; no old `0–50 ms` phase drift | `packages/server/src/rooms/GameRoom.ts:1313-1318`, `:2267-2288` |
| 10. Client receipt | `onStateChange` only calls `onPatch`; the callback stamps the timeline, pushes remote snapshots, and reconciles self. It does not move rigs. | `O`, then next render | `packages/client/src/scenes/ArenaScene.ts:2925-2936`, `:9459-9508` |
| 11. Presentation | Self draws from prediction. Remote player/enemy positions sample tick-stamped rings at `server estimate − 120 ms`; projectiles and beams instead read current schema rows and dead-reckon/draw immediately. | Self: `F`; remote bodies: `I + F`; projectile/beam rows: `F` | `packages/client/src/scenes/ArenaScene.ts:5824-5848`, `:4496-4631`, `:9633-9702`; `packages/client/src/net/snapshots.ts:72-76` |

The fixed-step accumulator can execute several 50 ms substeps and emit only the final patch. That is a good encoding-cost trade during a short stall, but it means snapshot timestamps can be 100–150 ms apart in a catch-up batch (`packages/server/src/rooms/GameRoom.ts:2267-2288`). The client can interpolate across such a gap; it does not fabricate intermediate snapshots.

After the browser audio context is running, committed `AudioBus.play()` dispatches or schedules its synth/sample path synchronously and adds no intentional network-scale delay (`packages/client/src/audio/AudioBus.ts:404-420`, `:638-673`). The first browser gesture/autoplay resume is a separate cold-start case (`packages/client/src/audio/AudioBus.ts:100-156`) and is excluded from steady combat budgets.

## What each button looks like locally and to a teammate

### Movement

Locally, WASD changes `curDx/curDy` before the frame's interpolation call, and the fractional predictor preview applies it without waiting for a minted command. The own avatar therefore begins moving on the next rendered frame: approximately **8 ms typical**, independent of RTT (`packages/client/src/scenes/ArenaScene.ts:3131-3161`, `:5824-5840`; `packages/client/src/net/prediction.ts:360-381`). The server does not see that direction until `C + O + S`: **100 ms typical at 100 ms RTT**. A teammate sees it after the return transit and body interpolation: `C + RTT + S + I + F`, or **278 ms typical (220–337 ms range)**.

### Melee swing / accepted attack beat

RMB is sampled every frame, the owning rig receives a locally incremented predicted beat, and swing pose/VFX/audio start immediately before the `attack` RPC is sent. Own-screen onset is approximately **8 ms** (`packages/client/src/scenes/ArenaScene.ts:6410-6443`, `:6544-6568`, `:6581`). The server handler latches a 150 ms attack buffer, then phase 4 decrements cooldown/buffer and accepts it on the first eligible tick; acceptance stamps `attackSeq`, `attackTick`, and `attackHeld` (`packages/server/src/rooms/GameRoom.ts:853-890`, `:2612-2662`, `:2936-2941`). Authority therefore accepts at `F + O + S`: **83 ms typical**.

On a teammate, the acceptance patch arrives after approximately **142 ms**, and source audio plays immediately when the edge is routed (`packages/client/src/scenes/ArenaScene.ts:2436-2487`). The *visual pose* is intentionally mapped to the delayed body timeline and starts another 120 ms later (`packages/client/src/scenes/ArenaScene.ts:2377-2385`, `:2390-2433`): **262 ms typical (220–303 ms)**. This is the clearest case of rendering at more delay than is necessary for perceived responsiveness.

### Gun shot

The owner gets muzzle flash, camera kick, and shot audio on the RMB frame, approximately **8 ms**, while damage/projectile state remains authoritative (`packages/client/src/scenes/ArenaScene.ts:6497-6524`). The server accepts in the same phase-4 attack path, spawns the projectile, and then advances every projectile by a full 50 ms later in that same simulation step (`packages/server/src/rooms/GameRoom.ts:2618-2631`, `:4934-4995`, `:2756-2759`, `:6780-6787`). Thus the first networked bullet can already be one simulation step downrange.

The teammate does **not** wait for body interpolation: the new projectile creates a visual and a muzzle flash at the rendered remote rig on the first patch, then dead-reckons every frame (`packages/client/src/scenes/ArenaScene.ts:4496-4580`, `:4608-4631`). Typical teammate onset is `F + RTT + S + F` = **142 ms (100–183 ms)**. The bullet itself originates from current authoritative coordinates while the muzzle flash is on a body rendered 120 ms in the past, so a full-speed remote shooter can show roughly `320 px/s × .12 s = 38 px` of source separation before accounting for the bullet's same-tick 50 ms advance.

### Beam charge and ignition

Beam fire rides `fireHeld` in the 50 ms input command, not the action RPC (`packages/server/src/rooms/GameRoom.ts:317-329`; `packages/client/src/scenes/ArenaScene.ts:9795-9813`). The owner gets charge audio and a zero/progress charge preview on the frame where `updateBeams` observes RMB rising (`packages/client/src/scenes/ArenaScene.ts:9633-9702`), so the first cue is about **8 ms**. Meaningful predicted progress normally begins at the next mint, about **33 ms typical including display**.

There is a phase-order defect: `stepNetInput` runs at `ArenaScene.ts:3132`, while `updateBeams` does not establish `beamPredictionStartSeq` until `:3172` and `:9645-9653`. If RMB rises on a frame that also mints, that already-sent command carries `fireHeld=true`, but prediction records `(lastMintedInputSeq + 1)`. The server can start from the earlier sequence (`packages/server/src/rooms/GameRoom.ts:3220-3241`), so the authoritative `row.startSeq` never matches the prediction epoch checked at `ArenaScene.ts:9558-9595`. This is phase-alignment luck, not network jitter.

The server advances charge by 50 ms in the same tick that creates it, and switches to active when accumulated charge reaches the descriptor duration (`packages/server/src/rooms/GameRoom.ts:3262-3307`). With the 650 ms minimum (`packages/shared/src/constants.ts:138-150`), the active edge is broadcast about **600 ms after the consuming tick**, because the first 50 ms is credited immediately. Current owner and teammate ignition both wait for that active patch: `C + RTT + S + 600 + F` = **758 ms typical (700–817 ms)**. Only the harmless charge is predicted; active geometry and ignite feedback are authoritative (`packages/client/src/scenes/ArenaScene.ts:9564-9568`, `:9705-9728`).

### Parry

The owner gets the white timing ring and brace immediately, approximately **8 ms** (`packages/client/src/scenes/ArenaScene.ts:6584-6600`, `:6615-6644`). If server cooldown is clear, `executeParry` runs directly in the message callback—no tick wait—and grants the private invulnerability window at arrival (`packages/server/src/rooms/GameRoom.ts:896-916`, `:5502-5523`). Real protection therefore begins at `F + O`: **58 ms typical** at 100 ms RTT. If still on cooldown, the press is buffered, cooldown is decremented, and the buffer is consumed in the first eligible phase-4 tick; it is not an extra tick late (`packages/server/src/rooms/GameRoom.ts:2560-2574`).

There is no synced *parry-press* epoch in `PlayerState`; only `parriedSeq` for a successful enemy-contact result exists (`packages/shared/src/state.ts:101-103`). Therefore a teammate never sees the base brace/window at any latency. They see the success spark/audio only if a later enemy resolution increments `parriedSeq` (`packages/client/src/scenes/ArenaScene.ts:7214-7234`). “Never” is an observability gap, not a large numeric delay.

### Jump

Space sets `jumpQueued`, but prediction consumes it only in the next minted command (`packages/client/src/scenes/ArenaScene.ts:3058-3060`, `:9790-9814`). The horizontal fractional preview cannot invent a jump impulse; it only integrates the current height/vertical velocity (`packages/client/src/net/prediction.ts:360-381`). Local liftoff onset is therefore `C + F`: **33 ms typical, 0–67 ms**, not “the frame you press Space.” Once minted, prediction and server both latch, age, fire, and integrate jump in the same fixed step (`packages/client/src/net/prediction.ts:100-124`; `packages/server/src/rooms/GameRoom.ts:2333-2338`, `:2563-2586`).

A teammate's jump height bypasses the position snapshot ring: `animateBlobs` reads raw `PlayerState.height` for remotes, while only ground `x/y` comes from the delayed snapshot buffer (`packages/client/src/scenes/ArenaScene.ts:5824-5848`, `:6370-6375`). Remote onset is consequently `C + RTT + S + F` = **158 ms (100–217 ms)**, but it is attached to a body 120 ms behind in horizontal time. `SpriteRig` then applies a `22 s⁻¹` exponential filter—time constant about 45 ms—to all hop targets (`packages/client/src/entities/SpriteRig.ts:1273-1277`, `:4038-4046`), reaching 63% of the new target around **203 ms typical** for the teammate and around **78 ms** for the owner.

## Interpolation: actual depth, actual delay, and over-delay

The ring holds **8 snapshots**, while the server interval is **50 ms** (`packages/shared/src/constants.ts:15-18`, `:163-171`). Its nominal capacity is `8 × 50 = 400 ms`, but the time span from oldest to newest is at most **7 intervals = 350 ms**. That storage depth is not the render delay. The render cursor is independently fixed at **120 ms behind the estimated server clock** (`packages/client/src/net/snapshots.ts:20-76`).

At 20 Hz, 120 ms is 2.4 tick intervals: enough for a surrounding pair plus about 20 ms beyond two intervals. On a steady low-jitter path this is conservative; on a bursty TCP path it is reasonable. The correct optimization is an adaptive delay (for example a 75–90 ms floor plus a measured late-arrival percentile), not globally hard-coding 75 ms and accepting constant extrapolation. Sampling already supports bounded 60 ms extrapolation and then holds (`packages/client/src/net/snapshots.ts:140-168`).

Render timing by class is inconsistent:

| Class | Publication | Render time | Audit judgment |
|---|---:|---:|---|
| Remote players and ordinary enemies | 20 Hz | `server − 120 ms` | Smooth, but 30–45 ms more than needed on stable links; adaptive target recommended. |
| Remote melee pose | 20 Hz acceptance edge | Delayed to the same `server − 120 ms` body epoch | More delay than necessary. Start/seek the discrete action immediately on receipt at the rendered rig. |
| Enemy/boss telegraphs | 20 Hz direct state | Current patch, no body delay | Correct for reaction safety; fixed world promises should not be made stale. `packages/shared/src/state.ts:202-215`. |
| Projectiles | 20 Hz `x/y`, then client dead-reckon | Current patch, no 120 ms | Responsive, but can be spatially ahead of its remote source. |
| Player beams | 20 Hz exact row | Current patch, no 120 ms | Correct for damaging WYSIWYG geometry; cosmetic source anchoring should hide body/beam separation. |
| Jump height | 20 Hz raw player row | Current patch plus ~45 ms rig filter | Faster than the remote ground body and therefore phase-incoherent. |
| Worm segments | **10 Hz** pose publication | Same 120 ms render cursor | Only 1.2 publication intervals of history; retain a ≥100 ms worm-specific floor even if ordinary bodies become adaptive. |

The worm split is intentional: authority remains 20 Hz while moving centers publish every two ticks (`packages/shared/src/constants.ts:539-543`); `BossController` stamps `poseTick` and the twelve `float32 x/y` rows only on those ticks (`packages/server/src/rooms/BossController.ts:1377-1409`). The client ring ignores inert 20 Hz room patches and extrapolates stable surface segments for at most 60 ms (`packages/client/src/entities/WormRig.ts:212-231`, `:300-334`).

## Schema-v19 patch size and churn

### Measured ceiling

I instantiated schema v19 in memory and encoded with the installed `@colyseus/schema` encoder. The legal worm stress case contained 10 players (`MAX_PLAYERS`), 69 `EnemyState` rows including the worm owner plus 12 worm segment bodies (80 effective enemy bodies), 120 hostile projectiles (`BOSS_PROJECTILE_BUDGET`), 10 active beams, 32 preallocated receipts, and 35 XP echoes as a dense-event sample. The caps are at `packages/shared/src/constants.ts:267`, `:285`, `:355-356`, and `:532-563`; the worm-aware cap check is at `packages/server/src/rooms/GameRoom.ts:1967-1968`, and the root collections are at `packages/shared/src/state.ts:394-481`.

| Slice changed in one patch | Encoded bytes, including one protocol byte | Main churn |
|---|---:|---|
| Full initial state at that population | 14,918 B | All identities/defaults, 32 receipt rows, maps, worm rows, echoes |
| 10 moving players | 316 B | `x/y`, `mvx/mvy`, `ackSeq`, plus `tick` |
| 80 moving enemies | 1,126 B | `x/y`, plus `tick` |
| 120 moving projectiles | 1,793 B | `x/y`, plus `tick` |
| 10 active beams | 516 B | origins, previous origins/angles/lengths, angle, lengths, heat, plus `tick` |
| 12 worm segments on its 10 Hz pose tick | 183 B | `poseTick`, twelve `float32 x/y`, plus `tick` |
| Three XP launches | 59 B | collector id and launch/collect ticks, plus `tick` |
| Eight XP deliveries | 48 B | event booleans, plus `tick` |
| Worst 32-receipt overwrite | 1,794 B | repeated string identities, direction, damage, flags, plus `tick` |

A 2,000-tick warmed combined benchmark of that legal worm stress case measured **4,292.4 B/patch mean**, encoder **0.031 ms mean / 0.055 ms p95 / 0.067 ms p99** on this machine. At 20 Hz that is **85.8 KB/s received per client** and **858 KB/s (6.87 Mbit/s) of shared application payload sent by a full 10-client room**, before WebSocket/TCP/IP overhead. The separate 80-enemy row in the table is the legal non-worm enemy ceiling. Encoding itself is cheap; egress serialization, queueing, fragmentation, and TCP HOL are the scale risks.

The server encoder creates one shared patch and reuses it for every joined client because no filters are active (`node_modules/.pnpm/@colyseus+core@0.16.24_@colyseus+schema@3.0.76_@pm2+io@6.1.0/node_modules/@colyseus/core/build/serializer/SchemaSerializer.js:91-101`). The transport explicitly disables per-message deflate (`node_modules/.pnpm/@colyseus+ws-transport@0.16.5_@colyseus+core@0.16.24_@colyseus+schema@3.0.76_@pm2+io@6.1.0_/node_modules/@colyseus/ws-transport/build/WebSocketTransport.js:47-52`).

### What is necessary and what is not

| Schema area | Churn assessment | Recommendation |
|---|---|---|
| `ArenaState.tick` | Deliberately changes every 20 Hz patch and is the interpolation/attack clock (`packages/shared/src/state.ts:451-455`). | Keep. It guarantees reconciliation cadence and a clock stamp. |
| Player `x/y` | Necessary remote pose. | Keep 20 Hz; quantize type. |
| Player `ackSeq`, `mvx/mvy`, `vh` | Necessary to the owner predictor, unnecessary to every teammate (`packages/shared/src/state.ts:109-122`). `ackSeq` and usually `mvx/mvy` churn every tick. | Move to an owner-only view/row or filter; keep public `x/y/height`. |
| Enemy `x/y` | Necessary for current body interpolation; about 1.1 KB at 80. | Keep 20 Hz for nearby entities; AoI/filter distant horde after adding a relevance margin. |
| Projectile `x/y` | Largest avoidable steady churn. Velocity is already synced and the client already dead-reckons (`packages/shared/src/state.ts:283-304`; `ArenaScene.ts:4608-4631`). | Spawn descriptor + occasional correction/bounce epoch, or publish correction at 10 Hz. Do not send every projectile's `x/y` every tick. |
| Beam row | Exact current/previous capsule is useful, but `effectiveLength` duplicates `length`, `seq` duplicates `startSeq`, and `halfWidth` derives from `width` (`packages/shared/src/state.ts:306-329`; `packages/server/src/rooms/GameRoom.ts:3471-3492`). Only changing duplicates cost steady bytes; constants cost only at add. | Remove wire duplicates on the next schema bump. Consider reconstructing previous geometry from the prior received row, with a cut on skipped ticks. |
| Combat receipts | Event-driven, not idle churn, but every hit rewrites three repeated ID strings plus weapon/element strings (`packages/shared/src/state.ts:331-347`; `packages/server/src/rooms/GameRoom.ts:2203-2238`). | Use compact entity/player indices and enums, or aggregate same-target/same-tick hits before writing. |
| Worm boss | Good split: motion is 10 Hz; coordinates are already `float32`; integrity/armor are `uint8` (`packages/shared/src/state.ts:349-391`). | Keep. Give worm its own interpolation floor if normal actors go below 100 ms. |
| XP echoes | Good event descriptor: resting and flying rows do not stream `x/y`; client motion derives from launch/collect ticks. Only disconnect retarget writes a sampled position (`packages/shared/src/state.ts:264-281`; `packages/server/src/rooms/GameRoom.ts:4178-4219`, `:4344-4416`). | Keep. |
| Timers | `flexTimerDs` is explicitly 10 Hz and elapsed is 1 Hz (`packages/server/src/rooms/GameRoom.ts:2240-2251`). | Keep; this is the right 10/20 Hz split pattern. |

Most hot coordinates use schema type `"number"`, which emits an integer compactly, a tagged float32 when precision permits, or a tagged float64 otherwise. Explicit `float32` removes the dynamic number tag; a more aggressive `uint16` at 1/8-pixel units covers the 4,800 px arena (`packages/shared/src/constants.ts:176-180`) with 0.125 px resolution. Position `uint16 × 8`, velocity `int16` at a declared scale, and angle `uint16` would cut hot numeric values substantially, but this is a schema bump and must be validated against collision/VFX tolerances. Worm and receipt direction/damage fields already demonstrate explicit compact types (`packages/shared/src/state.ts:342-345`, `:349-365`).

The full-state ceiling exceeds the schema encoder's default 8 KB buffer. The installed encoder detects overflow, allocates a larger buffer, and re-encodes (`packages/shared/node_modules/@colyseus/schema/src/encoder/Encoder.ts:17-18`, `:123-143`). Set `Encoder.BUFFER_SIZE` to at least 32 KB before room construction to avoid the warning/re-encode on large full snapshots; this is a join/reconnect micro-cost, not a steady-tick bottleneck.

## Colyseus-level costs and rate mismatches

- **Simulation:** Colyseus invokes a real-delta `setInterval` at 50 ms; the room accumulates that real delta into exact 50 ms substeps (`node_modules/.pnpm/@colyseus+core@0.16.24_@colyseus+schema@3.0.76_@pm2+io@6.1.0/node_modules/@colyseus/core/build/Room.js:339-350`; `packages/server/src/rooms/GameRoom.ts:2267-2281`). This preserves prediction determinism.
- **Patch encoding:** `setPatchRate(0)` removes Colyseus's second interval, and manual broadcast encodes once then calls `raw()` for every client (`packages/server/src/rooms/GameRoom.ts:1313-1318`; installed `SchemaSerializer.js:91-101`). This has already removed a former random **0–50 ms**, mean 25 ms, patch wait. Do not regress it.
- **Message serialization:** input's verbose MessagePack object is 104 B at 20 Hz, about 2.08 KB/s/player; ten clients contribute about 20.8 KB/s inbound. Numeric message types plus `sendBytes` and a fixed packed command could be roughly 16–24 B (`packages/client/node_modules/colyseus.js/lib/Room.js:91-140`). This is bandwidth/CPU work, not a meaningful latency win on an uncongested link.
- **Input phase:** client command and server sim are both 50 ms but unsynchronized. Their waits add, rather than cancel: mean `25 + 25 = 50 ms`, worst **100 ms**, before counting network. Equal frequencies do not imply phase alignment.
- **Buffered actions:** there is no confirmed avoidable +1 server tick in the accept paths. Phase 4 decrements cooldowns first, then checks parry/jump/attack buffers in the same tick (`packages/server/src/rooms/GameRoom.ts:2548-2615`). A consumed jump is seeded before vertical integration (`:2575-2586`). The beam *client prediction* race described above is the genuine phase-order defect.
- **Reliable queue semantics:** server drain-to-newest prevents an already-arrived queue from replaying stale directions (`packages/server/src/rooms/GameRoom.ts:2293-2317`), but it cannot defeat TCP HOL: a missing segment prevents the newest command from arriving at all.

## Ranked latency findings

Estimates use the 100 ms RTT / 60 fps baseline. Conditional congestion/loss numbers say so explicitly. Priorities follow the panel rule: **P0 is any double-digit millisecond or whole-tick opportunity**.

| Rank | Priority and type | Finding and estimated saving | Fix | Effort | Risk |
|---:|---|---|---|:---:|:---:|
| 1 | **P0 perceived — 120 ms** | Remote melee visual pose waits the full interpolation delay after its acceptance patch. Audio is already immediate, proving the edge is known. | Start/seek the discrete remote attack pose immediately on receipt at the rendered rig; keep continuous body motion interpolated. Preserve authoritative `attackTick` only for animation age/dedup. | M | M |
| 2 | **P0 perceived — 100–150 ms on affected presses; ~33–50 ms expected** | Beam rising is initialized after the input loop. On a mint frame, the server accepts seq `N` while prediction claims `N+1`, so the harmless preview cannot reconcile to the authoritative row. | Establish the rising epoch inside `stepNetInput` from the actual minted `cmd.seq`, or run beam-edge setup before input minting. Add a test for RMB rising exactly on a mint frame. | S | L |
| 3 | **P0 real under loss — about one RTT, 100+ ms** | Input, actions, and patches share one reliable ordered WebSocket/TCP stream. One lost segment stalls newer intent and state despite server drain-to-newest. | Long term, put high-rate movement/aim on QUIC/WebTransport datagrams and retain reliable ordered action/inventory traffic. Short term, measure retransmit/HOL before changing transport. | XL | H |
| 4 | **P0 perceived — about 50 ms** | Beam clients wait for the *active* patch even though the first accepted charging row plus `phaseStartTick` and the shared weapon descriptor predicts the ignition deadline hundreds of milliseconds ahead. | Schedule a non-damaging ignite cue/VFX from the accepted charging epoch, cancel on release/reject, and let the active patch confirm exact damaging geometry. | M | M |
| 5 | **P0 real defensive effectiveness — up to 50 ms one-way** | Local parry looks immediate, but real i-frames begin only when the RPC reaches the server. A reaction valid on the player's screen can lose solely during outbound transit. | If playtests show unfair misses, add a narrowly bounded 50 ms server rewind/grace for parryable enemy resolutions, keyed to accepted monotonic client input—not a general damage rewind. | L | H |
| 6 | **P0 perceived — about 40 ms** | Camera focus has a fixed 130 ms time constant after the predicted avatar moves, so world motion communicates input more slowly than the avatar itself (`packages/shared/src/constants.ts:107-109`; `packages/client/src/scenes/ArenaScene.ts:6271-6288`). | Gain-schedule follow on a fresh local direction edge (for example 70–90 ms briefly, then 130 ms); preserve teleport cuts. | S | M |
| 7 | **P0 perceived — 30–45 ms on stable links** | Fixed remote delay is 120 ms even when arrival jitter is far below its 20–45 ms margin. | Make ordinary player/enemy delay adaptive with a 75–90 ms floor and late-arrival percentile. Keep worm at ≥100 ms and expose extrapolation/hold telemetry. | M | M-H |
| 8 | **P0 real — mean 25 ms, worst 50 ms** | Direction changes, jump, and beam edges wait for the next 20 Hz client mint. This is independent of the unavoidable server tick wait. | Send immediately on direction/edge change, retain a 20 Hz held-state heartbeat, and keep predictor integration fixed-step. Rate-budget headroom is already 4 input messages/tick. | M | L-M |
| 9 | **P0 perceived — mean 25 ms, worst 50 ms** | Local jump liftoff waits for that mint; the fractional preview cannot apply the queued impulse. | Apply a one-shot local vertical prediction edge on Space down and attach it to the next sequence command for reconciliation. Implement with rank 8 to avoid double-sending. | S-M | M |
| 10 | **P0 perceived — about 20–25 ms to a comparable rise** | The universal hop target filter has a 45 ms time constant even for the owner's already-predicted jump. | Use a faster/self-specific rise constant while retaining the softer remote/landing filter, or snap only the first few pixels of liftoff. | S | L-M |
| 11 | **P0 conditional real — roughly 15–25 ms/patch on a 1 Mbit/s constrained path** | Streaming all projectile `x/y` accounts for 1.79 KB in the cold slice and more when dynamic numbers need float64. It consumes roughly half the ceiling patch despite client dead reckoning. | Replace per-tick projectile positions with spawn tick/velocity plus 10 Hz or event corrections (bounce, deflect, teleport, impact). | L | M-H |
| 12 | **P0 real authority — mean 12.5 ms, worst 25 ms** | The remaining server phase wait is intrinsic to 20 Hz. Fast defensive/combat edges pay it even after immediate client send; parry is the only off-tick exception. | Only if metrics justify it, run a deterministic 40 Hz *action-admission* substep or the whole sim at 40 Hz while keeping patch publication separately budgeted. Do not casually execute ordinary attacks in callbacks. | XL | H |
| 13 | **P0 conditional real — 10–30 ms when egress queues** | No `StateView`/AoI means all clients receive all 80 enemies and 120 projectiles; the schema itself notes filtering is not wired (`packages/shared/src/state.ts:27-30`). | Add relevance-filtered views with generous projectile/telegraph margins and always include squad/boss/global receipts. Benchmark per-view encode cost against saved egress. | L-XL | H |
| 14 | **P0 conditional real — 10–15 ms on dense AoE/constrained links** | A 32-hit receipt patch measured 1.79 KB, dominated by repeated target/player/weapon/element identities. | Compact IDs/enums and aggregate compatible same-target/same-tick damage receipts while retaining final-blow/crit edges. | M | M |
| 15 | **P1 conditional — about 5–9 ms/patch on slow links; 0 ms uncongested** | Hot `"number"` fields can carry tagged float32/float64 values. Hundreds of positions churn per tick. | On the next schema bump, use explicit float32 first; evaluate `uint16` 1/8-pixel positions and scaled `int16` velocities with golden collision/render tests. | L | M-H |
| 16 | **P1 conditional — about 1–3 ms/patch on slow links** | Owner-only rebase fields (`ackSeq`, `mvx/mvy`, often `vh`) are sent to every teammate and churn at input rate. | Split/filter owner reconciliation state from public pose state. Measure the extra per-view encoding work before rollout. | M-L | M |
| 17 | **P2 bandwidth/CPU — <1 ms normally** | Input commands are 104 B because every 20 Hz command repeats a string type and MessagePack property names. | Use numeric message IDs and a fixed packed byte command after protocol-versioning it. Keep validation identical. | M | M |
| 18 | **P2 bandwidth — <1 ms normally** | Beam `length/effectiveLength`, `seq/startSeq`, and `width/halfWidth` are wire duplicates; the changing length duplicate costs steady bytes. | Remove duplicates on the next append/bump migration; derive half-width and retain one canonical epoch/length. | S-M | L-M |

## Highest-leverage change and full budget table

The single highest-leverage change is to **send movement changes and jump/beam edges immediately while retaining the 20 Hz held-state heartbeat and fixed-step predictor**. It removes a real, deterministic **25 ms mean / 50 ms worst** from three action families, fixes local jump's same-frame promise when paired with the one-shot vertical edge, and gives beam prediction the actual minted sequence rather than a guessed next one. It is broader and safer than raising simulation rate or globally shrinking interpolation.

| Action / visible milestone | Own screen, current | Server authority, current | Teammate screen, current | Typical formula at 100 ms RTT | Best–worst at 100 ms RTT | After highest-leverage change |
|---|---:|---:|---:|---|---:|---:|
| Movement begins | **8 ms** predicted | **100 ms** | **278 ms** | own `F`; authority `C+O+S`; mate `C+RTT+S+I+F` | own 0–17; authority 50–150; mate 220–337 | authority **75 ms**; mate **253 ms** typical |
| Melee first cue | **8 ms** predicted | **83 ms** accepted | **142 ms audio** | `F+RTT+S+F` for mate cue | 100–183 | unchanged |
| Melee visual attack beat | **8 ms** predicted | **83 ms** accepted | **262 ms pose** | `F+RTT+S+I+F` | 220–303 | unchanged; rank 1 separately saves 120 ms |
| Gun muzzle/shot begins | **8 ms** predicted | **83 ms** projectile spawn | **142 ms** projectile + muzzle cue | `F+RTT+S+F` | 100–183 | unchanged |
| Beam charge first cue | **8 ms audio / ~33 ms normal progress** | **100 ms** charge start | **158 ms** charge row | authority `C+O+S`; mate `C+RTT+S+F` | mate 100–217 | authority **75 ms**; mate **133 ms**; affected seq-race removed |
| Beam ignition / damage begins | **758 ms** authoritative ignition (charge cue already local) | **700 ms** | **758 ms** | `C+RTT+S+600+F` | 700–817 | **733 ms** typical; deadline-scheduled cosmetic cue can separately save ~50 ms |
| Parry brace/ring | **8 ms** predicted | **58 ms** i-frames, off cooldown | **Never synced**; success only | authority `F+O`; no server tick wait | own 0–17; authority 50–67 | unchanged |
| Jump liftoff onset | **33 ms** predicted | **100 ms** | **158 ms** raw-height target | own `C+F`; authority `C+O+S`; mate `C+RTT+S+F` | own 0–67; authority 50–150; mate 100–217 | own **8 ms**; authority **75 ms**; mate **133 ms** |
| Jump reaches ~63% of target after rig filter | **78 ms** | n/a | **203 ms** | liftoff onset + ~45 ms filter time constant | add ~45 ms to onset ranges | own **53 ms** with send change alone; rank 10 can reduce further |
