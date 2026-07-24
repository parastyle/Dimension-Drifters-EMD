# B27 pre-made duals private live gate

Real Testing Grounds + arena gate on private ephemeral client/game ports 59920/59918.
Character: `proto-cowboy-hidden-face`. Authored dual: `x2-knucklebone-talons`.
Independent same-class 1H slots: `rattler-sabre` and `x2-sandsong-saber`.

- `authored-dual-two-sprites.png`: both parts from the one authored definition are live.
- Six accepted melee beats routed `lead/off/lead/off/lead/both` with two render pieces throughout.
- `independent-one-hand-slots.png`: each selected 1H slot renders exactly one weapon; no pairing fields exist.
- `relic-pickup-compat-container.png`: a real `openChest` message applied the deterministic relic receipt.
- `live-gate.json`: ports, render pieces, accepted combo beats, independent slot state, tombstones, unrelated tenants, and relic before/after state.

The harness used `startSpecStack`, so ports 5180 and 2567 were neither bound nor touched.
