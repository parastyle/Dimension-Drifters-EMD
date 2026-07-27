# B76 — Reverse bullets

Date: 2026-07-26
Branch: `sol/b76-reverse-bullets`

## Outcome

The inversion path was found and reproduced without trying to encounter it through play.

A discrete attack carried both a direction vector and a cursor world point. Authority normalized the
vector when the message arrived, but `aimDir()` preferred the world point and subtracted the
player's position later, when the buffered attack was accepted. B74 correctly moves an ordinary
walking player at `320 px/s`, or `16 px` per server tick. If a player fired toward a cursor point
less than one or two movement ticks ahead and crossed that point while the attack waited for its
cooldown, the later subtraction changed sign:

```text
trigger receipt: target.x - player.x = +8   (forward)
acceptance:      target.x - player.x = -24  (backward)
```

`fireGun()` converted that later vector directly to the projectile velocity angle. The result was a
real authoritative projectile launched 180 degrees from the commanded aim. It existed in the same
`ArenaScene` authority used by top-down and belt modes.

Two related inversion-capable paths were also present:

- A newer held-input heartbeat could replace `c.aim` and `c.target` while an older trigger was
  buffered, so a same-tick opposite sample could retarget the eventual shot.
- A zero-length aim was replaced with unconditional `+X`. If the last valid commanded direction was
  `-X`, the fallback itself invented a 180-degree reversal. Extremely large finite components could
  overflow `Math.hypot` to infinity and collapse the held aim to `(0, 0)`, feeding the same fallback.

Delayed burst rows had an additional exposure: every owed round called `fireGun()` later and
recomputed against the original cursor point. A burst could therefore begin forward and finish
backward after the player crossed that point.

## Pre-fix proof

The adversarial tests were written and run before the fix. The focused run failed in the following
ways:

- A Revolver Cannon shot commanded along `+X`, buffered through `0.1 s`, and moved past an
  eight-pixel-ahead cursor. Its normalized velocity was exactly `-1` on X in top-down.
- The identical scenario produced normalized X velocity `-1` in belt mode.
- Later owed Galvanic Overcasters burst rows reversed after movement crossed the trigger's cursor.
- A forward trigger followed by an opposite heartbeat before acceptance launched opposite the
  trigger.
- A zero-length command following a valid `-X` aim produced `vx = +900`.

The existing seeded golden tick test provided independent evidence. Its player `p1` starts beyond
planted enemy `c1` and repeatedly commands `+X`, away from that enemy. The old golden expected both
planted enemies to die because `p1` crossed its stale one-pixel fallback target and its supposedly
rightward attacks reversed left. After the fix, `c1` correctly remains alive. Both copies of the
golden contract now state that corrected result and explain why.

## Fix

Cursor-point correction still exists, preserving the historical §37 guarantee that an authored
cursor point beats a contradictory raw vector. Its timing is now explicit:

1. On attack-message receipt, authority validates the raw aim and target.
2. It resolves the cursor point relative to the authoritative body exactly once.
3. It stores that unit direction and cursor target as the immutable buffered trigger epoch.
4. When cooldown acceptance occurs, the discrete attack restores that epoch rather than consuming
   any later heartbeat's live aim.
5. `aimDir()` normalizes the accepted direction; it no longer subtracts a stale point from a later
   body position.
6. An accepted gun burst snapshots the same direction and supplies it to every owed follow-up row.

Degenerate attack input now retains the last finite direction. The held-input normalizer also
requires the result of `Math.hypot` to be finite, preventing large finite wire components from
turning into a zero aim through division by infinity. Projectile velocity receives a final finite
normalization at the launch seam.

This does not freeze ordinary presentation steering indefinitely. Heartbeats may update the live
aim while cooldown drains; only the accepted discrete trigger is restored at its acceptance edge.
The next input continues normally.

## Hypothesis audit

### 1. Facing versus aim disagreement

Verdict: not the primary direction source, but tested as an adversarial state.

The authoritative velocity path does not read `flipX`, rig mirror state, `player.aimDir`, or movement
heading. `player.aimDir` is a replicated presentation angle synchronized from the accepted aim. A
Coyote Stinger test sets presentation facing to `π`, movement to `-320 px/s`, and command aim to
`+X`; both alternating shots remain inside the weapon's authored spread around `+X`. The test runs
in both top-down and belt.

The live `rapid-flip-attack` scenario now uses a gun, alternates AD and aim every tick, and fires on
five alternating flip phases. Both modes emitted `+900, -900, +900, -900, +900` X velocities, with
an aim dot of exactly `1` for every row.

### 2. Mirrored muzzle transform

Verdict: ruled out as a velocity inversion source.

Muzzle derivation chooses projectile origin using the accepted aim and authored weapon geometry.
Launch velocity is calculated separately from the accepted aim angle. Client-side B68
`PresentedActorState` and mirrored part transforms do not create authoritative projectile rows; the
client presents the replicated `vx/vy`.

The alternating-muzzle test forces Coyote parts `0` and `1` while facing and movement disagree with
aim. Both muzzle parts launch in the commanded hemisphere in both modes. Thus a dual or mirrored
muzzle can change the origin, not reverse the launch vector.

### 3. One-frame stale aim

Verdict: confirmed.

There were two stale-state variants:

- The cursor point was fresh at message receipt but stale relative to the body at cooldown
  acceptance or a later burst row. Crossing it inverted the subtraction.
- A held-input heartbeat arriving after the trigger but before acceptance could overwrite the live
  aim/target. The buffered trigger had no identity of its own.

The trigger snapshot fixes both. Tests cover movement across the point, a same-tick opposite
heartbeat, delayed burst rows, and live alternating flip-and-fire.

### 4. Zero or degenerate normalization

Verdict: confirmed as a second inversion-capable path and hardened.

The old zero fallback always chose `+X`; a last valid `-X` aim therefore reversed. A finite
`Number.MAX_VALUE` pair also made `Math.hypot` overflow to infinity in the held-input path.

Top-down and belt tests now cover exact zero aim/target, overflowing attack components, and
overflowing held input followed by a degenerate trigger. Every resulting velocity is finite and
preserves the last valid `-X` direction.

### 5. Dual-wield or alternating-hand muzzle selection

Verdict: ruled out as the cause.

Coyote's cycle selects both authored muzzle part indices in order. Direction remains tied to the
accepted trigger for both rows, even with opposite presentation facing and movement. Galvanic's
delayed multi-row trigger separately proves every owed burst round keeps one accepted direction.

## Assertions left in place

The server regression suite now forces:

- forward walk plus forward fire across a nearby cursor in top-down and belt;
- a facing-change/opposite-heartbeat edge before buffered acceptance in both modes;
- zero-length and overflowing attack input in both modes;
- overflowing held-input normalization in both modes;
- aim exactly opposite movement and presentation facing with both alternating muzzles in both
  modes;
- movement across the cursor between sequential burst rounds;
- the existing §37 cursor-point-over-raw-vector behavior;
- the seeded golden case that formerly depended on an inverted attack.

Direction assertions use a dot threshold greater than `0.999999` where the weapon has no spread.
The Coyote assertion admits only its explicit authored spread and also pins muzzle parts `[0, 1]`.

`tools/diag-rb-telemetry.mts` now extends `rapid-flip-attack` beyond position continuity. It equips a
Revolver Cannon, alternates AD and commanded aim every tick, fires at steps
`0, 13, 26, 39, 52`, captures each authoritative projectile's initial velocity, and requires all
five rows plus an aim dot greater than `0.999999`.

## Standing laws and prior-work guarantees

- B74 remains unchanged: ordinary movement is still one constant `320 px/s` speed. The reproduction
  deliberately uses that exact law.
- B68's presentation clocks, root debt, limb priority, and transform ownership are unchanged.
- B53 facing continuity and the B51/B52 projected-root corrections are not used to derive authority
  velocity.
- B56 belt parity is covered through the same authority with mode-specific regression instances and
  the complete belt telemetry matrix.
- Weapon attacks add no displacement. Existing sanctioned gun recoil remains the only relevant
  weapon impulse.
- No aura, modal, schema, lava-dimension, map, walkability-painter, skate/pit, or
  `data/weapon-concepts-300.json` change was made.

## Verification

- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- Focused projectile suite: 41/41 passed.
- Cursor-point and movement focused suite: 28/28 passed.
- Full `pnpm test`, consecutive final run 1: 235/235 files passed; 2,863 passed, 20 skipped.
- Full `pnpm test`, consecutive final run 2: 235/235 files passed; 2,863 passed, 20 skipped.
- `tools/diag-rb-telemetry.mts`: 101/101 scenarios passed, split 50 top-down and 51 belt.

| Telemetry mode | Scenarios | Requests | Applications/nonzero | Snaps | Corrected pixels | Rapid-flip shots | Minimum aim dot |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Top-down | 50 | 0 | 0 | 0 | `0.000` | 5/5 | `1.000000` |
| Belt | 51 | 0 | 0 | 0 | `0.000` | 5/5 | `1.000000` |

VERDICT: inversion path found = yes; trigger = a buffered or delayed-burst shot recomputed direction after movement crossed its stale cursor point, with later input overwrite and zero-to-+X fallback as additional inversion-capable edges; fix = resolve and snapshot finite aim at trigger receipt, restore it at acceptance, and lock it through every burst row; assertions added = cursor crossing, same-tick flip/input, zero/overflow, opposite movement/facing, alternating muzzles, burst rows, golden-state correction, and projectile-dot telemetry; modes covered = top-down + belt; test results = gen:check/typecheck clean, 235/235 files with 2,863 passed and 20 skipped twice, telemetry 101/101 with zero corrections and minimum aim dot 1.0.
