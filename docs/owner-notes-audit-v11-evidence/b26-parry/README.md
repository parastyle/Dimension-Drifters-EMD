# B26 directional parry live gate

Real Testing Grounds gate on private ephemeral client/game ports 49307/49306.
Character: `proto-cowboy-hidden-face`. Guard weapon: `x-sword-neon-katana` (`melee:sword`).
A real `boothill` supplied 8-damage hostile rounds.
The three-shot cycle used a real `dust-ranger` at its production cadence.

- `from-below-air-lift.png`: existing authoritative lift route.
- `from-left-slide.png`: 32.00 px away from the shot.
- `from-right-slide.png`: 32.00 px away from the shot.
- `from-above-brace.png`: compressed brace, no authoritative displacement.
- `burst-1-high.png`, `burst-2-mid.png`, `burst-3-low.png`: deterministic 0→1→2 guard cycle.
- `live-gate.json`: ports, incidence vectors, authoritative before/after state, rig pose geometry, and assertions.

The harness used `startSpecStack`, so ports 5180 and 2567 were neither bound nor touched.
