# B18 fan tornado evidence

The live gate ran the real Arena client and Colyseus server with `proto-cowboy-hidden-face` on private ephemeral ports:

- client: `61753`
- game: `61752`
- protected ports not used: `5180`, `2567`

## Captures

- [Iron War Fan — right](./x2-iron-war-fan-right.png)
- [Iron War Fan — left](./x2-iron-war-fan-left.png)
- [Ember Fan — right](./x2-ember-fan-right.png)
- [Ember Fan — left](./x2-ember-fan-left.png)
- [Storm Fan — right](./x2-storm-fan-right.png)
- [Storm Fan — left](./x2-storm-fan-left.png)
- [Machine-readable live observations](./live-gate.json)

Each capture contains an open fan at attack scale and the correct compact tornado at its swept edge. `live-gate.json` records facing-aware outward travel, opening/ribbon samples, presentation-only damage ownership, melee-envelope overlap, subjects, dimensions, and source audio cues.

## Gameplay contract

- Tornadoes are presentation-only and add no damage source.
- Existing melee and B3 hybrid envelopes are unchanged.
- Nominal DPS remains exactly 20 for each fan.
- Storm lead/off alternation is locked by the pure release-plan unit test; live captures validate legal paired release lanes independently of screenshot latency.

## Verification

- `pnpm gen`: passed
- `pnpm gen:check`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed — 164 files / 2222 tests
- `pnpm assets:check`: passed
- private-port Playwright gate: passed — 1 test / 6 captures
