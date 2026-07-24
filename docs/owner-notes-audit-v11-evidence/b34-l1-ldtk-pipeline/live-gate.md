# B34 Lane 1 private live gate

Date: 2026-07-24

## Stack isolation

- Colyseus: `ws://127.0.0.1:56341`
- Vite: `http://127.0.0.1:56342`
- Forbidden owner ports `2567` and `5180` were already occupied by separate processes and were
  neither started, stopped, nor reused by this gate.
- Both private listeners were released after the probes.

## Live results

- Vite returned HTTP 200 for `/`, the transformed `ArenaScene.ts` module, and both generated
  corporate-grid tileset URLs.
- Three real Colyseus rooms were created with `beltLevel` set directly to `corporate-grid`,
  `corporate-grid-portrait-hall`, and `corporate-grid-marble-gallery`.
- Every room joined in belt arena mode with `proto-cowboy-hidden-face`, used the authored floor
  `PlayerSpawn`, entered `Reception Wing`, and locked at the first room gate (`x=1440`).
- A 120 ms floor-1 sample observed all four wave members to the right of the player. The generated
  anchors used by that wave were in the authored first-room range.
- Forty-six real upward input commands reached `ackSeq=46`; the player stopped at authoritative
  `y=2224`, exactly `BELT_Y0 + lane.minY + PLAYER_RADIUS`.
- Copied public PNG SHA-256 values match their LDtk source tilesets byte-for-byte; see
  `asset-copy-sha256.txt`.

## Screenshot gate

The required browser-control surface connected successfully to its runtime, but browser discovery
returned no available browser instances, including after the prescribed recovery check. The browser
workflow forbids substituting an unrelated automation backend, so no screenshot or rendered-canvas
claim is fabricated here. The requested hallway, top clamp, both camera ends, right-wave, and
three-floor screenshots remain blocked on browser availability. Server and HTTP evidence is recorded
in this directory so the orchestrator can re-run only the visual capture when a browser is available.
