# B35 private live-gate evidence

All captures use `proto-cowboy-hidden-face` on private ephemeral stacks. Vite/game port pairs were
`62714/62712` and `50399/59382`; reserved ports `5180/2567` were not used.

- `order-*` images cover every weapon-specific order in both facings.
- `dedicated-alternating-hands-*` records Voltvein firing hands `0, 1` in each facing.
- `dedicated-laser-rigid-lock-*` records seven rapid active-beam angle reversals per facing with
  `renderAngle === targetAngle` on every sampled renderer frame.
- `dedicated-coyote-barrel-origin-*` records both wire muzzle parts and barrel-origin shots.
- `dedicated-ghostwind-purple-chain-hit-*` records authoritative dummy contacts after the receipt
  path was corrected to consume Ghostwind's authored purple chain hue.
- `dedicated-fanner-*` records ordinals 0 through 5 from one accepted press in each facing.
- `dedicated-shoulder-stance-head-nod-*` records the two-handed shoulder lane and 0.08-radian
  live head-nod delta in each facing.

Machine-readable measurements and the complete facing matrix are in `live-gate.json`.
