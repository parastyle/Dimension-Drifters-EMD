# V3M melee implementation notes

## Hold and combo damage math

Hollow Harvest uses the ordinary server-owned weapon cooldown as its held cadence. A hold of `T` seconds produces

`N(T) = 1 + floor(T / 0.66)`

accepted full-circle swings. Each accepted revolution retains the weapon's authored 12 damage, so its single-target base DPS remains `12 / 0.66 = 18.1818…`. The growing swing count comes from continuing to hold, not from client animation or client hit tests.

Hailwidow's three-hit sequence redistributes one neutral three-hit damage budget. Hits one and two deal `0.85D`; hit three deals `1.30D`, where `D` is the weapon's authored damage. The average is `(0.85 + 0.85 + 1.30)D / 3 = D`, so the combo's base DPS is unchanged.

All authored melee arcs and combo hit decisions are resolved on the server. Twirl, named-stance, impact-anchor, and particle fields only describe presentation or select an existing authoritative cadence.
