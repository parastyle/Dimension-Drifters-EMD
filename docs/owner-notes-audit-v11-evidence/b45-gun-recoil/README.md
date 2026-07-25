# B45 real gun recoil — private two-client live gate

A real Colyseus server used OS-assigned loopback port 49153; protected ports 5180 and 2567 were untouched.

- `live-summary.json` contains the compact assertion matrix and per-weapon displacement.
- `live-telemetry.json` contains every owner/observer tick, impulse velocity, motion epoch/source, and B42 correction counter.
- The owner fired a pistol, shotgun, heavy howitzer, and sustained gatling through the real input/attack transport.
- Every recoil run entered `weapon-fire-recoil`, the observer matched authority within 0.01 px, and the movement-correction counter never advanced.
