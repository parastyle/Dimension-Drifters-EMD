# B70 reconnect trap

Date: 2026-07-26
Branch: `sol/b70-reconnect-trap`

## Outcome

Refreshing an active game now starts a new private room and a new run. A genuine WebSocket loss in
the same live page still uses Colyseus's 30-second seat reservation, but the recovered room is not
installed until the client has received a complete state tick and a request-correlated server
resumability verdict. Arena always exposes a DOM-owned route to the lobby, and every reconnect status
surface exposes a second DOM-owned `Abandon & Start Fresh` action.

## Refresh policy

The policy is **refresh means fresh by default**. `sessionStorage` is still useful as a reload marker,
but it is no longer authority to reconnect:

- `MenuScene` consumes and deletes a page-surviving `dd.reconnect.v1` reservation, then launches a
  newly created private room.
- `ArenaScene` reconnects only from the reservation held in that live scene instance after its own
  unexpected `onLeave`. A page reload destroys that in-memory authority.
- Refresh uses `create`, not `joinOrCreate`, so it cannot be matched into the just-abandoned room
  while that room is holding a reserved seat.

This fits the game's primary refresh-to-retest loop while preserving B61's recovery for an actual
transport interruption. There is no automatic refresh-resume path or hidden opt-in.

## Trap diagnosis

This was a compound lifecycle bug, not a spawner that needed to be restarted.

First, the old client treated a successful Colyseus JOIN response as proof that the room was
playable. It never checked the authoritative outcome, player row, simulation progress, run identity,
input runtime, combat runtime, escrow runtime, or host identity. A terminal room legitimately has
its enemies cleared and its normal run simulation gated, yet the client would still adopt it and
report recovery. That accounts for the empty arena and movement lock.

Second, `allowReconnection` kept the last player's body and host id reserved but left the empty room
available to `joinOrCreate`. A fresh browser session could therefore enter beside the disconnected
ghost as a new session id. The ghost remained host; the visible player was non-host; host-gated
`toggleTraining` was silently refused. The real transport integration now reproduces this boundary
and proves that fresh matchmaking cannot enter a room while its only live socket is seat-reserved.
The server locks that room during the empty reservation and unlocks it only after the real client
reclaims the seat. An expired solo reservation stays locked and disposes normally.

The reconnect overlay already used `pointer-events: none`, so it was not the component consuming
movement or `T`. The trap came from adopting an invalid/terminal room, the matchable ghost-host
window, and the absence of a room-independent escape.

For valid recovery, the server now answers `reconnectProbe` with the exact room/session/run and host
identity plus a verdict over:

- active outcome;
- retained player row;
- retained input and combat runtime;
- matching live run and durable expedition escrow;
- solo-player host authority.

The client correlates that reply to its request, waits for a completed state tick, verifies schema,
room, session, run, player, and outcome, and only then assigns the room to the scene. Any failure is
logged as an unplayable reconnect rejection, shown on the status surface, abandoned, and replaced
with a private fresh session. The new probe message contract bumps `SCHEMA_VERSION` to 48.

## Escape hatch

The escape controls are ordinary fixed DOM buttons rather than Phaser/modal controls:

- `⌂ Exit to Lobby` is visible for the entire Arena lifecycle, including initial connection,
  reconnect attempts, validation, and broken-room states.
- `Abandon & Start Fresh` is visible on every reconnect status state.
- Their handlers invalidate pending connection work, remove room callbacks, clear the reservation,
  leave whichever installed or validating room exists, and navigate immediately.

Neither control depends on the simulation loop, synced player state, WebSocket health, host status,
keyboard focus, or the reconnect overlay's status timer. The overlay remains non-modal,
view-preserving, and non-input-blocking.

## Genuine reconnect and settlement

The strict real-socket integration still terminates the underlying WebSocket and asserts the same
room id, session id, run id, exact escrow, HP, and authoritative position. It additionally proves:

- a fresh `joinOrCreate` cannot enter the reserved ghost room;
- the server's resumability verdict reports the same run and retained host;
- a post-recovery movement command is acknowledged and advances the same body;
- host-gated `T` works after recovery and creates real training dummies;
- a terminal room receives an explicit `run-not-active` refusal;
- settlement emits exactly one receipt, clears expedition escrow, and banks the carried item once.

Durable settlement behavior remains covered by the full suite.

## Full-suite flake

The flaky test used a 5-second wait budget around real TCP/WebSocket events while Vitest's parallel
workers could starve the event loop longer than that. Its exact state and settlement assertions were
already deterministic in isolation. The transport wait budget is now 15 seconds and the test budget
45 seconds; no identity, state, escrow, position, movement, host, or settlement assertion was
removed or relaxed. The authoritative pinned position was moved to the generated map's guaranteed
clear spawn point so unrelated collision correction cannot perturb it under load.

The strengthened test passed in each of three consecutive full-suite runs.

## Live Chromium observations

The real Playwright/Chromium harness started private Vite and Colyseus processes and exercised all
three flows in one browser test (`1 passed`, 55.6 seconds):

1. **Refresh:** started a run with live enemies, reloaded the document, and observed a different
   room id, session id, and run id. Enemies spawned, `D` advanced the player, `T` entered Testing
   Grounds and produced dummies, and the fixed lobby button returned to a live menu.
2. **Transport loss:** started an active run, closed the real Colyseus WebSocket, observed the
   reconnect surface and `Connection recovered`, then observed the same room id, session id, and run
   id with a live self row and positive HP. The body remained local rather than respawning; movement
   and host-gated `T` both worked. The server integration separately pins HP and position exactly.
3. **Reconnect escape:** closed the transport, observed the reconnect surface and visible
   `Abandon & Start Fresh`, invoked that DOM control, and observed a different room id, session id,
   and run id. Movement, `T`, and the route back to the lobby all worked in the replacement session.

Captures:

- `docs/sol-reports/b70-evidence/after-refresh.png`
- `docs/sol-reports/b70-evidence/after-transport-loss.png`
- `docs/sol-reports/b70-evidence/escape-hatch.png`

## Verification

- `pnpm gen:check` — passed.
- `pnpm typecheck` — passed.
- Targeted reconnection and real transport tests — 2 files, 6 tests passed.
- Browser regression — 1 test passed in 55.6 seconds.
- Full `pnpm test` pass 1 — 233 files passed; 2,828 tests passed; 20 skipped; 20.29 seconds.
- Full `pnpm test` pass 2 — 233 files passed; 2,828 tests passed; 20 skipped; 18.93 seconds.
- Full `pnpm test` pass 3 — 233 files passed; 2,828 tests passed; 20 skipped; 19.90 seconds.

VERDICT: refresh policy = fresh private session by default; trap root cause = terminal/unvalidated room adoption plus a matchable reserved ghost host; escape hatch = permanent lobby button and reconnect-owned fresh-session button independent of room health; flake fix = load-tolerant real-transport deadlines with exact assertions retained and strengthened; 3x tests = green (233 files, 2,828 passed, 20 skipped each); captures = `after-refresh.png`, `after-transport-loss.png`, `escape-hatch.png`.
