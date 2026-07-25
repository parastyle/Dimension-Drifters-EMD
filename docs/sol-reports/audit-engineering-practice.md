# Engineering-practice audit

**Date:** 2026-07-25

**Branch/worktree:** `sol/audit-engineering-practice` / isolated worktree

**Scope:** failure and recovery, persistence integrity, runtime performance, asset/memory behavior, observability, determinism/replay, risk-relative testing, and build/release practice. This audit deliberately excludes the already-owned rig/presentation architecture (B54), netcode feel (B42/B51), and monolith split (B43).

## Executive result

DDv2 has more engineering discipline than its speed of delivery suggests in several important places: meta accounts have explicit v2-v5 migrations; bank rows are rebuilt through a strict canonical boundary; maps, chests, and the boss controller have deterministic seeded paths; server collision uses a spatial grid and fixed scratch buffers; enemies/projectiles have hard caps; damage numbers are pooled; expansion weapon art and audio samples are fetched lazily; and ArenaScene has unusually thorough shutdown cleanup.

The ship-risk gaps are concentrated at boundaries rather than content implementation. A normal transport loss cannot reconnect to the run, terminal rewards exist only in room memory until an unacknowledged client `localStorage` write, the current online account is still a client-authored claim, and the production dev gate is fail-open unless the launcher supplies an environment variable that the checked-in start command does not set.

Severity means:

- **Critical:** routine failure can irreversibly lose a run/account result; ship-blocking.
- **High:** credible security/economy compromise or a player-ending failure with no recovery; normally ship-blocking.
- **Medium:** material frame-time, memory, diagnosis, test, or release risk; should have an explicit ship budget.
- Effort is **XS** (<1 day), **S** (1-2 days), **M** (3-5 days), or **L** (account/replay infrastructure).

## Ranked findings (severity x effort)

| Rank | Finding | Best practice versus current behavior | Severity / player impact | Minimal effort |
|---:|---|---|---|---:|
| 1 | **F1 — Reconnection is not implemented; the apparent reservation cannot be reached by an ordinary rejoin** | Preserve the Colyseus seat with `allowReconnection`, persist the reconnection token, and show reconnect state. The client retries only initial matchmaking; the server removes the player and keys a reservation by the departed session id, while a fresh join receives a different id. | **Critical — player-visible, run/loot loss on Wi-Fi blip, refresh, or browser transport reset** | M |
| 2 | **F2 — Run and terminal account settlement are memory-only and non-transactional** | Commit outcome and account changes durably under an idempotency key before acknowledging victory. DDv2 mutates room maps, marks the account settled, sends messages, and relies on the browser to write the result. | **Critical — irreversible bank/scrip/pet/unlock loss; server or room crash can turn a victory into later defeat** | L |
| 3 | **F3 — Production dev tools are fail-open** | Debug authority must require an explicit positive production-safe capability. DDv2 enables it whenever `NODE_ENV !== "production"`, while the checked-in production start command does not set `NODE_ENV`; the production client also honors `?dev`. | **High — ship-blocking authority/configuration defect** | XS |
| 4 | **F4 — The online meta economy accepts current client-authored ownership and balances** | An authenticated server store owns balances/unlocks; clients submit commands, not account snapshots. DDv2 accepts v3-v5 accounts in every environment and only canonicalizes their claimed catalog ids and amounts. | **High — ship-blocking economy/unlock fabrication and no cross-device ownership** | L |
| 5 | **F5 — Local save recovery prevents a brick by silently erasing or rolling back progress** | Version, validate, quarantine, back up, and report failed writes. Versions/migrations exist, but parse errors return a fresh account, invalid bank content becomes an empty bank, and quota/blocked writes are swallowed. | **High — account/bank data loss with no warning or recovery path** | S |
| 6 | **F6 — Client/room exceptions have neither a player recovery boundary nor post-session telemetry** | Capture client global/scene errors, render a safe recovery UI, quarantine failed rooms, and emit structured crash events. A scene throw can permanently black-screen; the server logs an uncaught room exception and continues a potentially partial tick. | **High — player-visible session death; invisible to the developer after the session** | M |
| 7 | **F7 — Projectile/VFX hot paths allocate and destroy at swarm cadence** | Pool bounded transient render objects and reuse frame scratch. Projectiles create/destroy Phaser containers, painted bursts create one image+tween per particle, and multiple frame paths allocate sets/maps/arrays; local projectile feedback scans all enemies. | **Medium — GC/frame hitches during the exact high-spectacle workload** | M |
| 8 | **F8 — The enemy cap is safe, but the director banks unbounded spawn debt while capped** | Apply backpressure at capacity and bound work admitted per tick. DDv2 never exceeds 80 effective bodies, but `spawnAccum` keeps increasing at the cap and can immediately refill every newly freed slot. | **Medium — no breathing room after an AoE clear and a burst of server/entity work** | XS |
| 9 | **F9 — Boot/deploy assets and retained decoded media have no residency budget** | Separate authoring assets from production, load content by encounter/loadout, and evict cold textures/audio. The production tree is 280.8 MiB; menu loads a ~43 MiB mipmapped atlas, Arena queues ~49 MiB of mipmapped particle sheets, and decoded samples/weapon textures have no LRU. | **Medium — slow first use, desktop/package bloat, mobile/low-VRAM eviction and long-session memory growth** | M |
| 10 | **F10 — Performance is measured but never gated** | CI should fail on agreed frame, long-task, heap, entity, and bundle budgets. The perf spec writes summaries and proves the workload exists, but asserts no timing threshold and samples the heaviest phase for only eight frames; the build only warns on oversized chunks. | **Medium — regressions remain green until a player notices** | S |
| 11 | **F11 — Determinism stops at map/chest/boss islands; there is no combat replay** | Route authoritative decisions through named seeded streams or stateless event rolls and retain build/seed/command/checksum data. Thirty-five gameplay calls still use global `Math.random`, including crits, enemy/drop rolls, scatter travel, and pet pity. | **Medium — “this weapon broke” cannot be reproduced from a report** | L |
| 12 | **F12 — Test count is high, but failure-boundary coverage and aggregate reliability are thin** | Test the most expensive failures end-to-end and make a retry-success visible. Pack/boss/economy logic is strong; reconnect, process-death settlement, corrupt/quota storage, and restart leaks are not. The canonical unit run passed all assertions but still exited nonzero on a worker RPC timeout. | **Medium — high confidence in content rules, low confidence at data-loss/recovery seams** | M |
| 13 | **F13 — Releases are builds, not identifiable/promotable artifacts** | Pin one runtime, stamp commit/version, configure endpoint/source-map handling, enforce artifact budgets, and promote a saved artifact. `.nvmrc` says `2`, CI uses Node 24, packages are `0.0.0`, WebSocket origin is compiled to host:2567, and CI uploads no client/server/debug artifacts. | **Medium — environment drift, difficult rollback, and unactionable production stacks** | S |

## Detailed findings and minimal-fix sketches

### F1 — Reconnection is not implemented

**Best practice.** An unexpected leave and a consented leave are different state transitions. On unexpected transport loss, Colyseus should reserve the existing seat for a short bounded window with `await this.allowReconnection(client, seconds)`. The client should persist `room.reconnectionToken` in `sessionStorage`, attach `onLeave`/`onError` handlers, call `client.reconnect(token)` with bounded backoff, and present “reconnecting / recovered / run ended” state. Only a timeout or explicit quit should abandon the run.

**What DDv2 does.**

- `ArenaScene.connect()` constructs a new client and retries `joinOrCreate`/`create` up to 30 times only during cold startup (`packages/client/src/scenes/ArenaScene.ts:4263-4298`, `packages/client/src/scenes/ArenaScene.ts:4454-4467`). After success it installs message and state callbacks, but no room `onLeave` or `onError` callback and no reconnect token (`packages/client/src/scenes/ArenaScene.ts:4308-4455`).
- Server leave stores the private body/combat snapshot under `client.sessionId`, then immediately deletes the synchronized player, input, movement, and combat rows (`packages/server/src/rooms/room/room-progression.ts:3258-3289`).
- Server join restores that reservation only if the *new* `client.sessionId` is the old key (`packages/server/src/rooms/room/room-progression.ts:2945-2962`). The real-transport test explicitly proves an ordinary rejoin gets a different session id (`packages/server/src/integration.test.ts:173-199`).
- There is no `allowReconnection`, `reconnectionToken`, client `reconnect()`, `onDispose`, or `autoDispose` override in the runtime. If the last player disconnects, the default room lifecycle also removes the only in-memory reservation.
- A deliberate scene exit is clean: callbacks are detached before `room.leave()` (`packages/client/src/scenes/ArenaScene.ts:1984-2030`). That hygiene does not recover an accidental leave.

**Observed failure modes.**

| Event | Current outcome |
|---|---|
| Brief socket/Wi-Fi loss | Server removes the player; client has no transition/retry UI. A peer may keep the room alive, but the player cannot reclaim the old session through normal join. |
| Browser refresh | New scene and new session id; the old run is not reattached. The open local expedition is later handled as abandonment. |
| Last player disconnects | No durable reservation/checkpoint; room state is disposable. |
| Background tab | Better than the other cases: a >250 ms wake gap drops input backlog and force-resyncs prediction (`packages/client/src/scenes/ArenaScene.ts:14424-14431`), and Electron uses a non-rAF loop when appropriate (`packages/client/src/main.ts:30-39`). The browser run continues server-side while rAF is parked, however, and any resulting transport timeout falls into the no-reconnect path. |

**Minimal fix sketch.**

1. Make `onLeave(client, consented)` async. If not consented, `await allowReconnection(client, 30)` and return on success without deleting run ownership; perform the existing abandon/cleanup only after timeout.
2. Save the token and `{roomId, runId}` in `sessionStorage`; attach leave/error handlers immediately after joining; reconnect with capped jittered backoff and a full-screen non-destructive overlay.
3. Add a real transport test that terminates the socket (not `room.leave()`), reconnects with the token, and asserts the same session id, run id, escrow, HP, position, and no duplicate settlement.
4. Treat refresh as the same recovery while the token is valid. Provide an explicit “Abandon run” action for consented leave.

### F2 — Settlement is memory-only and non-transactional

**Best practice.** The authoritative service durably commits `(account id, run id, outcome, resulting account revision, receipt)` in one transaction with a unique idempotency key. Receipt delivery happens after commit and may be retried/acknowledged. A room process can die at any instruction without changing the result.

**What DDv2 does.**

- Account, exact weapon escrow, disconnected reservations, settlement receipts, pet state, and “already settled” markers are process-local maps/sets (`packages/server/src/rooms/GameRoom.ts:574-589`). The server package has only Colyseus/runtime dependencies and starts a WebSocket process; there is no account/database/checkpoint component (`packages/server/package.json:12-20`, `packages/server/src/index.ts:8-24`).
- A terminal transition calls `settleMetaAccounts()` before setting the wire outcome (`packages/server/src/rooms/room/room-progression.ts:2599-2605`).
- Settlement sets `petSettledAccounts` *before* it mutates money, pets, pity, weapons, revision, and sends four possible messages (`packages/server/src/rooms/room/room-economy.ts:1785-1842`). The idempotency marker and receipts are themselves volatile. A throw after line 1789 can leave a partial account that a retry skips.
- The only durable step is indirect: the browser receives `"metaAccount"` and immediately calls `savePetMetaAccount()` (`packages/client/src/scenes/ArenaScene.ts:4309-4313`). There is no acknowledgement to the server.
- If the browser still has an open expedition on a later new join, the server intentionally settles it as defeat because the old settlement lived only in the old room (`packages/server/src/rooms/room/room-progression.ts:3060-3069`). This anti-duplication choice is coherent, but it means a crash after legitimate extraction and before client persistence can convert banked victory loot into defeat.

**Severity.** This is the largest data-loss window in the codebase. Server crash, room crash, deploy/restart, a throw during settlement, socket loss during receipt delivery, tab kill after receipt but before storage, or a blocked local write can lose the account result. It is ship-blocking for a bank/extraction game because success is not committed at the moment the game tells the player it succeeded.

**Minimal fix sketch.**

- Introduce a small authenticated durable store; SQLite with WAL is enough for a single-node solo-dev deployment. Use tables for account snapshots and settlements, with a unique `(account_id, run_id)` constraint.
- In one transaction: load expected account revision, compute the terminal result, insert the immutable receipt/idempotency key, update the account revision/snapshot, then commit. Only then set `state.outcome` and send the receipt.
- On reconnect/new join, return the committed receipt/account from storage; never infer defeat merely from an old client blob if a committed terminal record exists.
- Add failpoints after every settlement phase and a process-kill integration test. Re-running the same `runId` must produce one identical receipt and balance.

### F3 — Production dev tools are fail-open

**Best practice.** Production authority should default closed. Debug RPCs should require an explicit `DD_DEV_TOOLS=1` (and preferably authenticated operator identity), with a startup assertion/log showing the resulting mode. Absence or misspelling of deployment configuration must not grant authority.

**What DDv2 does.**

- `devToolsEnabled()` returns true when `DD_DEV_TOOLS === "1"` **or** `NODE_ENV !== "production"` (`packages/server/src/rooms/room/room-progression.ts:1630-1637`).
- The checked-in production start command is simply `node dist/index.js` and sets neither variable (`packages/server/package.json:6-10`). Root scripts and CI build commands likewise do not establish a production runtime environment (`package.json:11-28`, `.github/workflows/ci.yml:24-39`).
- These RPCs include training mode, disk-backed owner notes, immediate boss/boss-def spawn, debug attack state, and arbitrary validated enemy batches (`packages/server/src/rooms/room/room-progression.ts:2335-2380`, `packages/server/src/rooms/room/room-progression.ts:2399-2420`, `packages/server/src/rooms/room/room-progression.ts:2435-2501`).
- The client-side `?dev` parameter is checked outside `import.meta.env.DEV`; production still skips the menu and starts Arena with a dev payload (`packages/client/src/scenes/MenuScene.ts:553-570`). Only the local account inspection inside that branch is dev-fenced.

**Severity.** The RPC validation and entity caps limit some abuse, but the first joiner is “host,” not an authenticated operator. A default `pnpm --filter @dd/server start` deployment therefore grants gameplay/debug authority. This should block a public ship.

**Minimal fix sketch.**

```ts
const devToolsEnabled = process.env.DD_DEV_TOOLS === "1";
```

Additionally strip the production `?dev` launch path, print one structured startup field (`devToolsEnabled: false`), and add a smoke test that starts the exact checked-in `start` command with both variables absent and proves every debug RPC is rejected. A staged playtest explicitly opts in.

### F4 — Current online accounts are client-authored

**Best practice.** A network economy uses an authenticated stable account id and server-owned balances, bank entries, pity counters, pets, gear, prestige, and unlock grants. The client can cache/display a snapshot, but cannot submit ownership as truth.

**What DDv2 does.**

- The join payload sends the complete local meta account (`packages/client/src/scenes/ArenaScene.ts:4283-4292`).
- Server code dev-gates only *legacy* fields. Any supplied v3, v4, or v5 account is accepted in production and passed through the sanitizer (`packages/server/src/rooms/room/room-progression.ts:2976-3008`).
- Sanitization correctly rejects invented stats and unknown ids, but deliberately trusts valid catalog ownership claims, balances, gear, pets, prestige, and unlock presence (`packages/shared/src/meta.ts:304-354`, `packages/shared/src/meta.ts:442-464`). A modified client can claim every valid id and the maximum clamped scrip/revision.

**Severity.** This does not permit arbitrary code or arbitrary weapon stats; the closed catalog is a valuable boundary. It does make an online bank/unlock economy unenforceable, lets a client fabricate collection completion, and makes browser data deletion the account-deletion mechanism.

**Minimal fix sketch.** Add anonymous/device authentication first if full identity is not ready, mint an opaque account id plus refresh credential, store canonical v5 server-side, and change join to submit only the credential plus a carry command at an expected revision. Permit a one-time, visibly marked import of the existing local account if desired; after import, server state wins.

### F5 — Corruption and write failure silently erase/rollback progress

**Best practice.** Keep schema versioning/migrations, but load through diagnostics, retain the last known-good snapshot, quarantine the corrupt blob, and surface failed persistence. Save a canonical snapshot and a backup/journal with checksum/revision; verify the write before advancing UI state.

**What DDv2 does well.**

- Account versions 2-5 are explicit (`packages/shared/src/meta.ts:101-180`) and migrations v2→v3, v3→v4, and v4→v5 are present (`packages/shared/src/meta.ts:281-301`, `packages/shared/src/meta.ts:357-364`, `packages/shared/src/meta.ts:426-433`).
- The current boundary returns diagnostics and migrates old records (`packages/shared/src/meta.ts:467-515`).
- Weapon-bank validation is strict and reconstructs canonical fields; it rejects the complete bank on any invalid row (`packages/shared/src/bank.ts:390-410`, `packages/shared/src/bank.ts:567-579`).

**The missing recovery behavior.**

- The browser does not use diagnostics. Bad JSON/blocked storage returns a new v5 account; an invalid bank silently becomes the sanitizer’s empty fallback (`packages/client/src/ui/pet-select.ts:49-62`).
- Save makes two independent `localStorage.setItem` calls, catches every failure, reports nothing, and still returns the in-memory advanced account (`packages/client/src/ui/pet-select.ts:65-74`). On reload that “successful” purchase/settlement can roll back.
- `localStorage.setItem` is atomic for one key, so a torn byte-level write is not the main concern. The real risks are corruption/import incompatibility, quota/security exceptions, no backup, and the server-to-client settlement window from F2.
- The only direct local meta test is a happy-path companion-selection write (`packages/client/src/scenes/MenuScene.character-tab.test.ts:123-136`); it does not cover malformed JSON, an invalid bank row, unavailable storage, or quota failure.

**Minimal fix sketch.**

1. Read through `sanitizeMetaAccountV5WithDiagnostics`. If parsing/validation fails, do not overwrite; copy raw data to `dd.metaAccount.corrupt.<timestamp>`, try `dd.metaAccount.v5.backup`, and show an export/reset/recover dialog.
2. Save `{revision, checksum, account}` to a temporary/backup key, read-verify it, then replace current and retain the prior current as backup. IndexedDB gives a cleaner transaction but is not required for the first safety improvement.
3. Return a persistence result, not just an account. Do not show a purchase/settlement as durable until the canonical write verifies.
4. Add migration fixtures for every old version and failure-injection tests for quota, security, malformed/truncated JSON, one bad bank row, and backup restore.

### F6 — Exceptions have no recovery boundary or telemetry

**Best practice.** Install global `error` and `unhandledrejection` capture before boot, wrap scene failure into a minimal DOM recovery surface independent of Phaser, and report a privacy-safe structured event with build, scene, room/run id, tick, seeds, account revision, recent commands, and stack. Server room failures should be observable and fail closed rather than continue from an unknown partial tick.

**What DDv2 does.**

- The composition root constructs Phaser and exposes a production debug handle, but installs no global error/rejection handler or recovery UI (`packages/client/src/main.ts:14-84`).
- Arena’s own comment records the actual failure class: an unguarded first-patch read threw each frame and caused a permanent black screen (`packages/client/src/scenes/ArenaScene.ts:4530-4533`).
- Server `onUncaughtException` converts a room exception into one `console.error` and then permits the room to continue (`packages/server/src/rooms/room/room-progression.ts:3305-3311`). If the throw occurred after some mutations, the next tick starts from a partially advanced state.
- Runtime observability is free-form console output—startup, join/leave, boss, terminal result, and errors (`packages/server/src/index.ts:20-24`, `packages/server/src/rooms/room/room-progression.ts:3255-3311`). There is no structured logger, health/readiness route, crash reporter, metrics/export, durable session event log, or production build identity in the server/client dependencies (`packages/server/package.json:12-20`, `packages/client/package.json:12-20`).

**Severity.** A solo developer cannot answer “which build, room, seed, tick, and weapon failed?” after the player closes the tab. On the client the failure is a black screen; on the server the failure can be a silently damaged room.

**Minimal fix sketch.**

- Before `new Phaser.Game`, capture `window.error`/`unhandledrejection`, render a plain-DOM recovery panel, persist one bounded crash envelope locally, and offer restart scene/reload/export diagnostics.
- Emit JSON logs on the server with `event`, `level`, `build`, `roomId`, `runId`, `tick`, and outcome; suppress routine logs in tests.
- On an uncaught room exception, mark the room failed, stop simulation, persist/checkpoint if safe, notify clients, and dispose/recover. Do not promise continued correctness from a partial tick.
- Add a lightweight hosted error sink (or Sentry-equivalent) and counters for active rooms, unexpected leaves, reconnect success, room exceptions, settlement latency/failure, tick p95, and schema encode size. Add `/healthz` and `/readyz`.

### F7 — Swarm VFX/projectiles allocate at hot-path cadence

**Best practice.** At bounded entity caps, allocate the maximum renderer objects once (or grow to a high-water mark), reuse them, and reuse frame scratch. Collision/presentation queries should use replicated contact receipts or a client spatial index rather than `projectiles × enemies`.

**Positive controls already present.**

- Enemy separation uses a spatial grid and fixed typed-array correction buffers instead of an O(n²) all-pairs scan (`packages/server/src/rooms/GameRoom.ts:536-554`, `packages/server/src/rooms/room/room-enemies.ts:578-647`).
- Friendly projectile authority queries the same grid (`packages/server/src/rooms/room/room-combat.ts:5273-5309`).
- Damage-number state and BitmapText objects are pooled/preallocated (`packages/client/src/ui/damage-numbers.ts:102-179`, `packages/client/src/ui/damage-numbers.ts:502-539`).
- The hard rails are 80 enemies and 120 hostile projectiles (`packages/shared/src/constants.ts:374-377`, `packages/shared/src/constants.ts:681-688`).

**Remaining hot allocations.**

- Each new authoritative projectile builds a new Phaser container/recipe visual; removal destroys it (`packages/client/src/scenes/ArenaScene.ts:6551-6635`, `packages/client/src/scenes/ArenaScene.ts:6755-6873`).
- Every painted particle creates a new image, tween object, callback closure, and destruction event. There are 39 runtime `particleBurst` call sites/occurrences across seven client files, and each burst defaults to six such objects (`packages/client/src/vfx/particles.ts:50-88`).
- Per-frame reconciliation creates new sets for pickups, projectile launch cues, and charged muzzles (`packages/client/src/scenes/ArenaScene.ts:2932-2943`, `packages/client/src/scenes/ArenaScene.ts:6551-6556`, `packages/client/src/scenes/ArenaScene.ts:6978-7012`). HUD creates arrays, a Set, and a Map every frame (`packages/client/src/scenes/ArenaScene.ts:12166-12197`). These paths are called from the frame loop (`packages/client/src/scenes/ArenaScene.ts:4906-4923`).
- Local friendly projectile feedback scans all enemies until contact (`packages/client/src/scenes/ArenaScene.ts:7198-7221`). Caps bound it, but roughly 200 projectiles × 80 enemies is still up to ~16,000 distance tests per frame before other rendering.

**Minimal fix sketch.** Create recipe-keyed projectile pools and fixed particle pools with high-water metrics; reset/disable objects rather than destroy. Reuse scene-owned `Set`/`Map` scratch. Replace contact scanning with authoritative compact combat receipts already used for other feedback, or a small client spatial grid. Add allocation/heap-delta measurements to the heavy-room perf gate.

### F8 — Cap backpressure banks spawn debt

**Best practice.** A cap is both a correctness ceiling and a backpressure boundary. When at capacity, cap accumulated spawn credit and cap successful spawns per simulation tick so a long saturated period cannot create an immediate refill wave.

**What DDv2 does.** `runSpawnDirector` adds `dt` before checking capacity and subtracts time only for successful spawns (`packages/server/src/rooms/room/room-enemies.ts:2993-3005`). At 80 effective bodies, `spawnAccum` grows for as long as the swarm is capped. A large AoE clear can therefore be refilled to 80 in the next update, subject only to spawn-position acceptance. Admission itself is correctly guarded in normal spawn and the worm’s multi-body capacity check (`packages/server/src/rooms/room/room-enemies.ts:3078-3123`, `packages/server/src/rooms/room/room-enemies.ts:3234-3242`).

**Minimal fix sketch.**

```ts
if (effectiveEnemyBodies() >= MAX_ENEMIES) {
  spawnAccum = Math.min(spawnAccum, interval);
  return;
}
```

Also enforce a small `MAX_SPAWNS_PER_TICK` and instrument cap time, deferred credits, and spawn count. If instant refill is a deliberate difficulty law, encode and test it explicitly rather than obtaining it from an unbounded accumulator.

### F9 — Assets and decoded media lack a residency budget

**Measured production facts.**

- `packages/client/public` contains 2,712 files / 276.95 MiB: 213.33 MiB PNG, 56.58 MiB JPG, 4.51 MiB MP3. A fresh `pnpm --filter @dd/client build` produced 2,719 files / **280.8 MiB** because Vite copies `public` into `dist`.
- This is deploy/package size, not automatic browser transfer. It still means desktop and a naïve deploy carry all authoring/runtime public content, including the 14.9 MiB `muzzle-reference` developer output (its generator deliberately writes under public: `tools/gen-muzzle-reference.mjs:6-7`).
- The single atlas is 4,096×2,054 RGBA (`packages/client/public/sprites/dd-sprites.json:2-10`), 10.60 MiB compressed and about 32.1 MiB decoded, ~42.8 MiB with mipmaps. Menu queues it on cold boot (`packages/client/src/scenes/MenuScene.ts:442-467`) before a run.
- Arena queues every particle-pack sheet (`packages/client/src/scenes/ArenaScene.ts:1851-1866`, `packages/client/src/vfx/particles.ts:22-26`). The manifest has 96 sheets (`packages/client/src/vfx/particle-manifest.ts:9-16`, `packages/client/src/vfx/particle-manifest.ts:100-107`); measured together they are 9.85 MiB compressed, ~37.1 MiB RGBA, ~49.4 MiB with mipmaps.
- Expansion weapon sprite parts are correctly lazy-loaded (`packages/client/src/scenes/ArenaScene.ts:1906-1914`, `packages/client/src/scenes/ArenaScene.ts:3314-3349`), but Phaser’s texture cache is game-wide and there is no eviction; the reset code explicitly follows that cache (`packages/client/src/scenes/ArenaScene.ts:2109-2112`).
- Audio is also correctly fetched/decoded on first use (`packages/client/src/audio/sample-bank.ts:493-526`) and voices are capped at 12 sample plus 24 synthetic voices (`packages/client/src/audio/sample-bank.ts:154-167`, `packages/client/src/audio/AudioBus.ts:48-50`). The manifest nevertheless represents 155 entries / 316 buffers / 279.1 declared variation-seconds. If all are visited, 44.1 kHz stereo float decoding is approximately 93.9 MiB. `SampleBank.dispose()` can drop buffers (`packages/client/src/audio/sample-bank.ts:417-430`), but the singleton has no runtime caller (`packages/client/src/audio/sample-bank.ts:530-534`).

**Leak/restart judgment.** I did **not** find a broad scene-listener leak. Arena detaches DOM/scale/input/network callbacks and destroys its long-lived renderers on shutdown (`packages/client/src/scenes/ArenaScene.ts:1984-2030`, `packages/client/src/scenes/ArenaScene.ts:2330-2360`); Menu removes its scale transport listener (`packages/client/src/scenes/MenuScene.ts:611-624`). The material risk is retained game-wide texture/audio caches and up-front content, not forgotten per-restart listeners.

**Minimal fix sketch.**

1. Move `muzzle-reference` and other authoring/reference pages outside production `public`; assemble a production allowlist rather than copying the source public tree wholesale.
2. Split the core/menu atlas from gameplay rigs; menu should load portraits/small previews, not the full combat atlas.
3. Load particle packs by active weapon elements/encounter and keep a small shared fallback pack. Add an LRU/refcount for expansion textures and decoded samples with explicit memory ceilings.
4. Add a 20-run/restart browser memory smoke and a long “visit every weapon/sound” soak; assert heap, texture count, AudioBuffer duration, and GPU-estimated pixels return below a high-water budget.

### F10 — Measurements are not budgets

**Best practice.** Performance and content budgets are explicit, versioned, hardware/profile-aware assertions: frame p95/p99 and >33 ms share, scene update/render time, long tasks, server tick time, heap growth, object count, compressed boot bytes, largest chunk, decoded texture pixels, and maximum replicated state size.

**What DDv2 does.**

- The heavy Playwright probe computes frame/update/render percentiles, missed-frame rates, subsystem time, entity peaks, and long tasks (`e2e/tests/v7-perf-coop-frame.spec.ts:473-518`).
- Its assertions only prove that at least 5 players, 40 enemies, 6 beams, and 2 zones existed and that eight heavy frames were collected (`e2e/tests/v7-perf-coop-frame.spec.ts:640-698`). No timing, long-task, or memory value can fail the test.
- Vite has manual vendor chunks but no source-map, asset, or chunk budget (`packages/client/vite.config.ts:26-39`). The measured build passed while warning about 627.23 kB ArenaScene, 1,615.09 kB index, and 1,656.26 kB Phaser minified chunks.
- The enemy and boss caps are authored constants rather than measurements tied to a server tick/encode target (`packages/shared/src/constants.ts:374-377`, `packages/shared/src/constants.ts:681-688`).

**Minimal fix sketch.** Keep the rich probe, collect at least several hundred steady-state heavy frames, and fail on broad initial budgets (for example p95 frame interval, >33 ms percentage, long-task count, and heap delta). Add `size-limit`/a small manifest script for gzip/brotli boot JS and production-tree allowlist. Add a headless server stress fixture for tick p95 and schema bytes at max clients/entities. Store baseline artifacts in CI and require an explicit budget update when they move.

### F11 — Combat is not reproducible/replayable

**Best practice.** A run has one recorded root seed and independent named substreams—or stateless hashes of `(runSeed, tick, entity, event sequence)`—for every gameplay-bearing roll. The server retains accepted commands and periodic state checksums with the content schema/build id. A bug report can replay headlessly or at least reproduce the decisive roll sequence.

**What DDv2 does well.**

- Shared `makeRng`/`mixSeeds` is stable and portable (`packages/shared/src/rng.ts:1-52`).
- The four map seeds are synchronized and regenerate byte-identical arenas (`packages/shared/src/state.ts:674-684`, `packages/server/src/rooms/room/room-progression.ts:4789-4807`).
- Chest cadence/rewards derive from those seeds (`packages/server/src/rooms/room/room-economy.ts:917-927`, `packages/server/src/rooms/room/room-economy.ts:1136-1156`).
- BossController enforces its no-global-RNG contract in a deterministic test (`packages/server/src/rooms/BossController.test.ts:339-355`).
- Some newer weapon rolls derive from map seed plus attack/projectile sequence (`packages/server/src/rooms/room/room-combat.ts:4061-4103`).

**The gap.** Thirty-five actual authoritative code lines still call global `Math.random()`. Examples include enemy kind/tough/position (`packages/server/src/rooms/room/room-enemies.ts:3078-3097`), scatter heading/speed and crits (`packages/server/src/rooms/room/room-combat.ts:4475-4489`, `packages/server/src/rooms/room/room-combat.ts:4653-4664`), enemy weapon drops and Slate Tortoise pity (`packages/server/src/rooms/room/room-economy.ts:1043-1056`, `packages/server/src/rooms/room/room-economy.ts:1772-1782`), and next-dimension choice (`packages/server/src/rooms/room/room-progression.ts:4839-4855`). Consumption order changes with entity iteration, accepted commands, and prior rolls. No runtime command log, gameplay RNG state, checksum, replay file, or build id is retained.

**Minimal fix sketch.**

- Mint and persist a `runSeed`; derive named streams (`spawn`, `crit`, `drop`, `pet`, `scatter`, `dimension`) or event hashes so adding a cosmetic/independent roll cannot reshuffle other systems.
- Remove global RNG from `GameRoom`; inject a room RNG service and expose serializable counters/state.
- Keep a bounded server ring of accepted player commands and important authoritative decisions; checksum a canonical subset every N ticks. On crash/report, retain `{build, schemaVersion, catalogs hash, runId, runSeed, commands, checksums}`.
- Add a headless replay test: same build+seed+commands yields identical terminal outcome, balances, entity/checksum sequence, and weapon receipt.

### F12 — Risk-relative test gaps and flake behavior

**What is strong.** The canonical command collected exactly **216 files / 2,775 tests**. Booster packs test seeded receipts, duplicate refunds, insufficient funds, persistence, migration, and unlock-pool filtering (`tests/booster-packs.test.ts:29-71`, `tests/booster-packs.test.ts:124-202`). BossController tests deterministic output, and chest tests simulate authored distributions. Server bank/combat coverage is extensive.

**What is thin relative to loss/risk.**

- The one real transport test validates matchmaking/patching and explicitly expects a normal rejoin to get a fresh session id (`packages/server/src/integration.test.ts:123-199`); there is no unexpected-socket-loss/reconnection test.
- Local meta storage has only the happy companion-selection write noted in F5, not corrupt/quota/backup/migration UI behavior.
- There is no process-kill test around settlement, no durable idempotency test, no production-start smoke with environment absent, no client scene-error recovery test, and no multi-restart heap/listener assertion.
- Vitest has include/environment settings but no coverage provider or thresholds, so test count cannot show whether these seams execute (`vitest.config.ts:3-10`).
- Playwright runs one serial Chromium project and retries every CI failure once (`e2e/playwright.config.ts:6-28`). A retry-success is not made a failing/flaky signal, and retained traces are not uploaded by the workflow (`.github/workflows/ci.yml:61-80`).

**Flake evidence and cause.** The known full-suite flight-retarget class came from generated spatial state plus a process-global RNG. Current room tests mitigate cross-file order by replacing `Math.random` before each test (`packages/server/src/rooms/GameRoom.combat.test.ts:86-95`), while the retarget test still drives a generated room and calls `onLeave` directly (`packages/server/src/rooms/GameRoom.combat.test.ts:753-775`). A remaining augment test samples global randomness 400 times and asserts complete pool observation (`tests/augments.test.ts:96-100`). The canonical `pnpm test` run for this audit passed all 2,775 assertions, but Vitest reported an unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"` and exited 1; the run also emitted repeated schema-buffer warnings and thousands of room `console.log` lines. Thus this audit did not reproduce the old assertion mismatch, but did reproduce an aggregate-gate flake/failure with an all-green assertion summary.

**Minimal fix sketch.**

1. Build one deterministic room fixture that injects RNG/time/map/coordinates and tears down timers, clients, rooms, and globals. Do not repair runtime nondeterminism solely with a process-global test spy.
2. Add failure-injection suites in this order: reconnect token; crash during each settlement phase; local storage parse/quota/backup; exact production start env; scene exception recovery; 20 scene restarts with listener/heap counters.
3. Silence routine runtime logging in tests and resolve the worker RPC/schema-buffer errors; run the full suite repeatedly with randomized order in a non-merge lane.
4. Make Playwright retry-success a visible failing/quarantined flake with owner and expiry. Upload trace/log/perf artifacts on failure.
5. Add risk-based coverage thresholds for persistence/recovery/economy modules rather than a repository-wide vanity percentage.

### F13 — Build/release artifacts are not identifiable or promotable

**Best practice.** One pinned runtime builds once; CI stamps semver+commit+schema/content hashes, tests the exact production launcher/config, saves immutable client/server/desktop artifacts and private source maps, and promotes those artifacts. Runtime reports expose the same version. Endpoint and deployment mode are environment configuration with fail-closed validation.

**What DDv2 does well.** CI freezes the lockfile, typechecks, lints, verifies generators/assets, runs unit tests, builds non-desktop workspaces, and performs a Windows desktop packaging smoke (`.github/workflows/ci.yml:10-59`). The production client build completed successfully in this audit.

**The missing release contract.**

- `.nvmrc` contains `2` (`.nvmrc:1`), package engines allow any Node ≥22 (`package.json:6-9`), and CI uses Node 24 (`.github/workflows/ci.yml:19-22`). Local/release parity is accidental.
- Root, client, and server versions are all `0.0.0` (`package.json:1-5`, `packages/client/package.json:1-4`, `packages/server/package.json:1-4`). No commit/build/catalog hash is compiled into client state/logs.
- The production WebSocket URL is compiled as `wss?://location.hostname:DEFAULT_PORT`, with only a dev-only port override (`packages/client/src/scenes/ArenaScene.ts:4263-4273`). This cannot express a standard same-origin `/ws`, a separate service hostname, or a platform-assigned TLS endpoint without rebuilding/changing code.
- Vite has no source-map policy or size assertions (`packages/client/vite.config.ts:26-39`); the measured production output emitted zero `.map` files and only warnings for oversized chunks.
- CI builds in place but has no artifact upload, checksum/SBOM, release tag/version step, deployment, rollback metadata, or upload of Playwright traces (`.github/workflows/ci.yml:24-80`). Its browser job has a five-minute cap while all specs are serial (`.github/workflows/ci.yml:61-80`, `e2e/playwright.config.ts:9-16`), leaving little capacity for the current 75 browser tests and retained diagnostics.

**Minimal fix sketch.**

1. Set `.nvmrc` to the chosen major (22 or 24), narrow `engines`, and validate it in CI.
2. Generate a build manifest `{version, commit, builtAt, schemaVersion, contentHash}` and expose it in client error envelopes, server startup/health, and the result screen.
3. Configure `VITE_GAME_SERVER_URL` (or same-origin `/ws`) and fail the build/startup when production configuration is missing. Make `NODE_ENV=production` explicit in the launcher, while retaining F3’s fail-closed debug gate.
4. Produce private/hidden source maps for error symbolication, not public discovery; upload immutable client/server/desktop artifacts plus checksums, perf JSON, and failure traces.
5. Gate chunk/boot/deploy size and test the saved artifact with the exact production command before promotion.

## Verification record

- Worktree was clean before the audit; no runtime/source changes were made.
- `pnpm test`: **2,775/2,775 assertions passed in 216/216 files**, but command **exited 1** because Vitest reported one unhandled worker RPC timeout. This is reported in F12 rather than represented as green.
- `pnpm --filter @dd/client build`: **passed**; Vite warned on three >500 kB chunks. Measured output was **280.8 MiB / 2,719 files / zero source maps**.
- Static payload measurement: public **276.95 MiB / 2,712 files**; atlas **4,096×2,054**; all queued particle sheets **9.85 MiB compressed / ~49.4 MiB estimated RGBA+mips**; audio manifest **155 entries / 316 buffers / ~93.9 MiB estimated if every declared variation is decoded at 44.1 kHz stereo float**.
- No fixes or refactors are included in this branch; only this report is intended for commit.

Verdict: 13 findings; top three by severity: nonfunctional run reconnection, memory-only/non-transactional settlement, and fail-open production dev tools.
