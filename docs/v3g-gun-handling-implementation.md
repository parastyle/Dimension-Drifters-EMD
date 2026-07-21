# V3G gun-handling implementation

V3G laws are catalog data, not client weapon-ID exceptions. Generated weapon concepts author normalized
`gripPoints` and `handlingTags`; the strict weapon expansion generator validates and emits both fields.
The rig retains its legacy placement when `gripPoints.secondary` is absent.

## Thunderhead Repeater Cannon DPS redistribution

Thunderhead's shot interval is slowed from `0.28s` to `0.42s` (2.38 shots/s instead of 3.57). To keep its
unscaled sustained damage neutral, direct damage moves from `9` to `13.5` and blast damage from `5` to
`7.5`:

`(9 + 5) / 0.28 = (13.5 + 7.5) / 0.42 = 50 base DPS`

The authored projectile and muzzle tint is `#33E6FF`; the server carries the generic color suffix in the
projectile kind so the client renders the blue tracer without a Thunderhead-specific branch.
