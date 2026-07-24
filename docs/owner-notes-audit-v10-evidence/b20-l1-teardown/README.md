# B20 L1 private-stack evidence

- Candidate stack started on private ports `64045` (Vite client) and `64046` (Colyseus server);
  neither protected port `5180` nor `2567` was used.
- Client HTTP response: `200`.
- Server startup: `[dd-server] listening on ws://localhost:64046`.
- The connected browser-control runtime reported zero available browser surfaces after its required
  recovery check. Consequently no UI/gameplay screenshots could be captured, and the visual
  playability gate remains blocked rather than being claimed as passed.
- The private client/server processes were stopped after the listener/HTTP smoke check.

Machine-readable port and listener results are in `ports.json` and `stack-smoke.json`.
