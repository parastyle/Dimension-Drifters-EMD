# B61 Reconnection and fail-closed dev tools

## F3 — production dev tools are fail-closed

Server debug authority now requires the exact positive capability `DD_DEV_TOOLS=1`. `NODE_ENV` is
deliberately irrelevant to that authorization decision, so an absent, misspelled, development, or test
environment cannot enable debug RPCs. Startup logs the resulting authority mode.

The checked-in server commands now use separate launchers:

- `pnpm --filter @dd/server dev` selects `development.ts`, which explicitly opts in.
- `pnpm --filter @dd/server start` runs the compiled `production.js`, which establishes
  `NODE_ENV=production` before importing the server and does not opt into debug authority.

The production client's `?dev` path is also fail-closed. Both `MenuScene` and `ArenaScene` honor a dev
payload only when the bundle was explicitly built/served with `VITE_DD_DEV_TOOLS=1`. The real-stack and
spec-stack developer test harnesses set both explicit capabilities and restore the caller's environment.
Unit coverage proves absent, misspelled, and `NODE_ENV`-only server configurations stay disabled, and
that only the exact server/client values enable the gates.

I built the server and started the exact checked-in command with `DD_DEV_TOOLS` absent on private port
2572. Its startup log reported `debug authority: disabled`.

## F1 — an interrupted transport can reclaim the run

`GameRoom.onLeave(client, consented)` now separates explicit departure from unexpected loss. An
unexpected loss awaits `allowReconnection` for a bounded 30-second window and returns without deleting
the player, combat state, account, run escrow, input ownership, or session id when the seat is reclaimed.
An explicit leave still performs the existing cleanup immediately; an expired reservation performs that
same cleanup after the timeout. The existing `autoDispose` behavior remains enabled: Colyseus holds the
last-client room while `allowReconnection` owns its reserved seat, then allows normal disposal after a
failed/expired reservation. No settlement persistence or durability model was changed.

The client now stores `{token, roomId, runId}` in `sessionStorage`, installs room leave/error handlers
before its state and gameplay message listeners, and replaces the stored token after every successful
join or reconnect. After installing its message handlers it explicitly requests the existing weapon
manifest, closing the `onJoin` delivery race and populating the authoritative run id. Browser refresh
boots directly from the menu into seat recovery. Unexpected leave
uses `client.reconnect(token)` with exponential jitter, a four-second per-delay cap, 12 attempts, and the
same 30-second overall deadline. It never falls through to `joinOrCreate`, which prevents a duplicate run
while the original reservation exists. Explicit scene shutdown clears the reservation before its
consented leave.

The reconnect status surface is a full-viewport, `pointer-events: none` overlay whose only visible
element is a compact top status pill. It reports reconnecting, recovered, or run ended without a modal,
backdrop, focus capture, or gameplay input interception.

`SCHEMA_VERSION` remains 47 because this change adds no synchronized schema field and changes no wire
shape; the shared reconnection-window constant is runtime policy only.

## Real transport proof

The integration test starts the actual Colyseus WebSocket server, joins with an escrowed weapon, pins
authoritative HP and position, and captures the session id, run id, and full expedition escrow. It then
finds the server-side WebSocket and calls `socket.terminate()`—never `room.leave()`—before reconnecting
with `room.reconnectionToken`. It asserts the same room and session id, same run id and escrow, same HP
and position, and then invokes the terminal settlement path twice while asserting exactly one receipt,
one escrow clear, and one returned stash item.

For the live check, I launched a private development server on port 2571 and a source client on port
5190, started a fresh wild-west run with the shipped Colyseus client, sent real movement and stop inputs,
and waited for their authoritative acknowledgements. I killed the client transport by calling
`room.connection.transport.ws.terminate()` on the live WebSocket. Reconnection with the saved token
returned room `kbUoUFYIk` and session `-s9uD7TJ0`, matching the pre-kill values. HP remained 100 and
position remained `(2445.04443359375, 2389.503173828125)`; the recovered room issued a rotated
reconnection token. The server independently logged `reconnected -s9uD7TJ0`. I then left consensually
and stopped the private processes. The in-app browser backend was unavailable in this environment, so
the live proof used the shipped network client against the running game server; the pointer-transparent
overlay was verified from its DOM/CSS implementation and automated client checks.

## Verification

- `pnpm gen` — passed.
- `pnpm gen:check` — passed (the existing unavailable VFX-reference warning remained non-failing).
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 223 files, 2,770 passed, 20 skipped, 2,790 total.
- `pnpm --filter @dd/server build` — passed.
- Exact production start command with no debug capability — started on port 2572 and reported disabled.
- Real transport socket-termination integration test — passed.
- Live socket-termination and token reconnection — passed with room/session/HP/position intact.

Verdict: F3 fixed with exact explicit server/client dev-tool capabilities and a safe production launcher; F1 fixed with a bounded server seat reservation, persisted token recovery, capped jittered reconnects, and a non-blocking status overlay; the socket-termination transport test passed with session/run/escrow/HP/position preserved and no duplicate settlement; the live socket kill recovered the same room/session/HP/position; `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, and the full test suite passed (2,770 passed, 20 skipped).
