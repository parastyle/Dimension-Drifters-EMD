# B33 commitment-melee private live gate

Real Testing Grounds gate on private ephemeral client/game ports 58136/58134.
Character: `proto-cowboy-hidden-face`. Enemy body: `critter`.

- `a-wolf-accent-ramp.png`, `a-wolf-white-pop.png`, `a-wolf-landed-lunge.png`: red body ramp, universal white fill/squash, then four-tick impact against a walking player.
- `b-wolf-roll-evade.png`: the same commit answered at its exact pop by the real roll machinery; the first impact receipt keeps HP unchanged and advances `dodgedSeq`.
- `c-wolf-parried-directional-stagger.png`: the same commit parried at its exact pop; the packed directional reaction matches the rig and the authoritative 0.4 s attacker stagger is unit-pinned.
- `d-six-wolves-three-commit.png`: six live wolves, exactly three active commitments and three posturing non-holders.
- `e-player-attack-input-slow.png`: Sparkknuckle's real active movement tick reports mode 1 and 75.0% displacement against that tick's normal-speed projection.
- `live-gate.json`: authoritative ticks, positions, HP/receipt edges, tint/fill/squash state, token-cap sample, movement frames, and private ports.

Exact-pop roll/parry arming and the attack-movement receipt are one-shot training fixtures gated behind dev tools. They call or observe the production defense/movement machinery and cannot be armed in production rooms.
Because Playwright cannot serialize a page screenshot inside the real 50 ms pop, the white-pop PNG locally re-holds the already-fired rig presentation for 5,000 ms after recording its real edge/timing, then clears it before the client scene resumes. Server authority is not paused or modified.

The harness used `startSpecStack`; ports 5180 and 2567 were neither bound nor touched.
