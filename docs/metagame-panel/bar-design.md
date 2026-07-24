# Drive resource — post-B27 dual-weapon delta

Status: current delta over the 2026-07-18 Drive design. B27 does not rebalance Drive, beams, guns,
throws, melee, recovery, or any weapon definition.

## One equipped definition, one resource path

The selected Active position supplies exactly one weapon definition to the attack pipeline. Drive
cost is derived from that definition through the existing shared profile and accepted interval.
Other occupied positions do not contribute damage, cadence, or cost until selected.

An authored pre-made dual is still one definition and one accepted action. Its catalog-authored
combo, muzzle/part routing, and presentation hand may alternate, but the server executes the same
single-weapon resource path as any other weapon. There is no second instance contribution,
secondary cost multiplier, pair tempo, pair throughput cap, or topology-dependent debit.

## Compatibility

- Drive remains player-global and retains its existing quantized public mirror.
- Per-weapon cooldown debt remains position-local.
- Switching positions does not refill Drive or reset recovery debt.
- Beam ignition, drain, release, lock, and restart behavior are unchanged.
- Authored thrown-charge, magazine, and beam inputs remain economic derivation inputs where the
  existing profile code uses them.
- The nested compatibility row stays at schema 37 with `weaponResource` at index 6.

The obsolete secondary charge/reload readout and all component-composition billing hooks are
removed rather than mapped onto Drive.
