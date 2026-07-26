# B70 — reconnect trap: orchestrator repro evidence

Captured live against `341d5f0` on 2026-07-26 via the in-app browser, before `b70-reconnect-trap`
reported. Recorded so the Sol's root-cause conclusion can be checked against observed state rather
than argued from code.

## Owner report (verbatim)

> "so when i test the game, I like to refresh my webpage and when I do you have a reconnect current
> session thing which basically locks me into a map with no enemies, I cant press T or go to lobby and
> I cant move from the beginning circle"

and, after being told to close the tab:

> "well when i refresh the local host i keep getting the same thing, stuck in a blue beginner circle"

## What was ruled out

- **Not a server-reachability problem.** A raw `new WebSocket('ws://localhost:2567')` from the page
  opens cleanly.
- **Not a stale dev server.** Restarted; logs show `debug authority: enabled` and a healthy
  `+join ... (1 online)`.
- **Not the DOM status text.** `index.html:187` ships `<span id="status">connecting…</span>` as static
  initial markup. At the menu it simply has not been replaced yet. It is misleading during diagnosis
  but is not the defect. (Worth fixing separately — it reads as a hang.)
- **My first hypothesis was wrong.** I assumed sessionStorage surviving refresh was itself the bug.
  It is the *trigger*, not the cause: a correct reconnect into a healthy room would be fine.

## Observed state — FRESH launch (control)

`menu.launch('ashlands')`, sampled after 5s:

```
status : "connected · you are -Eb5"
scenes : menu inactive, arena ACTIVE
room   : attached
players: 1
enemies: 4
outcome: "active"
mode   : "arena"
```

Fresh runs are healthy. Enemies spawn, the run is live.

## Observed state — AFTER REFRESH (the defect)

sessionStorage before refresh held:

```json
{"token":"4iqCZH5WZ:EeCqMR8ag","roomId":"4iqCZH5WZ","runId":"run_8zKFwk1UOfdE2p4l"}
```

Hard-reloaded the page, sampled after 6s:

```
status : "connected · you are -Eb5"
scenes : menu inactive, arena ACTIVE      <-- menu skipped, auto-reattached
room   : attached
players: 1
enemies: 0                                <-- no enemies
outcome: "defeat"                         <-- THE RUN IS ALREADY OVER
mode   : "arena"
```

## Root cause as observed

**The client reconnects into a room whose run has already been SETTLED AS DEFEAT.**

Refresh drops the socket → the server's unexpected-leave path resolves the run to `defeat` → the
reconnect token then reattaches the client to that dead room. Every owner symptom follows directly
from `outcome: "defeat"`:

| Symptom | Explanation |
| --- | --- |
| "map with no enemies" | `enemies: 0` — the run is over, the spawner is stopped |
| "cant move from the beginning circle" | the player is in a terminal/defeated state on the spawn ring |
| "cant press T" | `toggleTraining` is refused outside a live run |
| "cant go to lobby" | no escape affordance is presented in this state |

The player is a corpse in a finished run, with no exit.

## Notes for the fix

- The 30s `allowReconnection` seat reservation and the settle-on-leave path appear to be racing, or
  the leave path is settling before the reconnection window is honoured. Establish which.
- Relevant: `room-progression.ts` deliberately settles a still-open expedition as defeat, and B62
  (durable settlement) added `!recoveredSettlement` guarding so a committed receipt wins. Check
  whether that guard covers THIS path.
- **A reconnect that would attach the player to a non-`active` run must refuse and fall back to a
  fresh session.** Validate resumability before committing the player to the room.
- There must always be an escape hatch that works even when the room is unusable.
