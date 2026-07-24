# B20 L4 private live-gate evidence

The isolated live stack used Vite client port `52249` and Colyseus game port `52248`. The protected
ports `5180` and `2567` were neither bound nor touched. Both private listeners were shut down after
the gate.

## Deterministic pack receipt

`pack-gate.mts` opened a Pet Pack with seed `77` against a V5 account whose only locked pet was
`pale-firefly`. The retained `pack-observations.json` records all three card results:

1. Rare Pale Firefly — new unlock.
2. Rare Pale Firefly — `duplicate -> +50 money`.
3. Rare Pale Firefly — `duplicate -> +50 money`.

The 120-money purchase started at 500, refunded 100 on the two duplicate flips, and persisted a
480 balance plus the Pale Firefly unlock through a JSON/sanitizer round trip.

## Private live run

`live-gate.mts` joined two V5 accounts to real room `I_8YHH2Gy` through the private WebSocket
listener and retained 38.87 seconds of schema-37 server authority. The first synchronized chest was
a weapon cache on valid arena ground. Its per-account receipts awarded:

- `x2-gravechill-nodachi`
- `x-sword-bone`

Both weapons belong to the 74-item starter-unlocked pool. The same run also exposed owner-instanced
enemy pickups for `twin-bowie-fangs` and `x-sword-buzzsaw`, also unlocked. The deliberately locked
catalog target `x2-sandsong-saber` appeared in neither chest receipts nor pickup rows.
`allWeaponRewardsUnlocked` is `true`, `lockedTargetObserved` is `false`, and there were no chest
denials.

## Visual-browser limitation

The Browser skill runtime initialized, selection failed, the required bootstrap recovery guide was
read, and the one permitted discovery check returned an empty browser list. Therefore no connected
browser surface existed for the requested menu screenshot. The Browser skill expressly prohibits
substituting a separate headless browser, so this evidence set records `screenshotCaptured: false`
instead of presenting a synthetic capture. The deterministic pack receipt and real transport run
remain valid, but the visual screenshot portion of the requested gate was unavailable in this
session.

The private stack's server/client error streams were empty during the gate.
