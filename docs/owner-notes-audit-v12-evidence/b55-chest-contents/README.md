# B55 live-gate evidence

Captured on 2026-07-25 against `proto-cowboy-hidden-face` with the production
Colyseus room and a real `colyseus.js` client.

## Ports

- Vite client: `5195`
- Colyseus game server: `2591`
- Evidence-only local control endpoint: `2592`
- Reserved ports `5180` and `2567` were not used.
- All three private ports were closed after capture.

## Result

[`live-network-evidence.json`](./live-network-evidence.json) records:

- actual `openChest` messages and authoritative `chestOpened` receipts for money,
  a weapon, a plain trinket, an HP potion, and a pet;
- a second trinket carrying Hollow-Points, including its player-facing name,
  description, stack count, and the synchronized `player.augments` CSV;
- a real Revolver Cannon attack that hit both collinear dummy targets, proving the
  granted `+1` pierce changed authoritative combat;
- a 35 HP potion heal on a 100-max-HP player;
- Slate Tortoise replacing Verdant Wing as the one active run pet; and
- ultimate archetype, charge, and phase all remaining zero/locked.

The harness stages deterministic room seeds so every content type can be exercised
without relying on manual random repetition. Chests are still opened through the
normal client message path and rewards are rolled and applied by production room
code. The control endpoint exists only in
[`live-gate-server.ts`](./live-gate-server.ts); it does not alter the shipped
server.

## Browser limitation

The required in-app Browser was initialized according to its skill instructions,
but `getForUrl()` reported that no browser was available. Its troubleshooting
documentation was consulted and the single permitted browser inventory check
returned an empty list. Therefore no honest HUD screenshot could be captured in
this environment. The disabled HUD/input contract is instead covered by source,
client unit tests, server unit tests, and the zeroed live network state above.
No standalone browser fallback was used.

## Reproduction

From the repository root, in separate shells:

```powershell
$env:DD_LIVE_GAME_PORT = 2591
$env:DD_LIVE_CONTROL_PORT = 2592
pnpm --filter @dd/server exec tsx docs/owner-notes-audit-v12-evidence/b55-chest-contents/live-gate-server.ts
```

```powershell
pnpm --filter @dd/client exec vite --host 127.0.0.1 --port 5195
```

```powershell
pnpm --filter @dd/server exec tsx C:\Users\Exped\ddv2-wt\b55-chest-contents\docs\owner-notes-audit-v12-evidence\b55-chest-contents\live-network-gate.ts
```
