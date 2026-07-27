# B60 Vastaghar charge surgical restore

## Restored

- Restored Vastaghar's deleted phase-two charge as `SunderCharge = 5`, preserving its wire value.
- Restored the original action tuning: 23 windup ticks, 10 active ticks, 25 recovery ticks,
  `Body`, 24 damage, 720 knockback, 0–620 range, 135 half-width, zero sweep, one target,
  and empty step-offset/radius arrays.
- Restored `SunderCharge` between `ThreefoldMarch` and `ShedMountain` in `phaseTwoDeck`, bringing
  the deck back to three actions, and restored cooldown/neutral time 13.
- Restored and renamed the server path to `startSunderCharge` / `stepSunderCharge`. The lane aims
  at the selected player, commits a rectangular telegraph, translates Vastaghar along that line,
  and applies ten damage/knockback slices totaling the authored 24/720.
- Restored the client windup rotation/squash branch under `SunderCharge`. The restored telegraph tag
  is named `TitanCharge = 11`, not the deleted landmark name.
- Bumped `SCHEMA_VERSION` from 47 to 48 and updated every exact test pin.

## Landmark residue kept removed

- Did not restore `VastagharArenaMutationKind.LandmarkBreak = 2`; `StuckStep = 1` and
  `WorldTurn = 3` keep their wire values and the enum retains the intentional gap.
- Did not restore the end-of-charge arena-mutation emit.
- Did not restore `maxDestroyedPois`, `destroyedPoiCount`, destroyed-POI gates, POI constructor
  targeting, `VASTAGHAR_POI_NONE`, or POI use of `stepFoot[0]`.
- Left the merged dimension POI deletion work and the parallel ashlands/artkit-owned paths untouched.

## Coverage and verification

- Replaced the deleted landmark-mutation regression with a charge regression that pins action value 5,
  the three-card deck, cooldown 13, 23/10/25 timing, lane translation on every active tick, ten
  `damageRect` calls at 2.4 damage and 72 knockback, and totals of 24 damage / 720 knockback.
- `pnpm gen`: passed. Missing local reference artifacts caused its VFX-subject pass to generate
  `subjects-vfx-300.json` empty, so that unrelated generator side effect was reverted.
- `pnpm gen:check`: passed with the existing missing-reference skip warning.
- `pnpm typecheck`: passed.
- Full `pnpm test`: 220 files passed; 2,765 tests passed and 20 skipped.

## Live fight

Ran the production Colyseus room loop on private local ports with multiple real transport clients.
The squad dealt authoritative weapon damage to move Vastaghar from phase one into phase two. With
damage then withheld, the synchronized phase-two deck played three distinct actions in order:
`ThreefoldMarch (4)`, `SunderCharge (5)`, and `ShedMountain (3)`.

For the charge, synchronized ticks showed a 23-tick windup and 10-tick active lane. Vastaghar began
at `(330.08, 875.18)` and translated along the committed lane during the active ticks. A focused
player held zero movement input in the lane; contact changed HP from `100` to `99.415` before regen
and displaced the player from `(548.743, 1267.956)` to `(549.438, 1268.969)`, confirming live damage
and authoritative knockback. The deterministic server regression separately pins the complete
24-damage / 720-knockback lane totals.

verdict: action restored + renamed, residue removed, phaseTwoDeck size 3, test result 2,765 passed / 20 skipped, live result three actions observed with charge damage + knockback
