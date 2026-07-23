# Weapon regression bisect

## Reproduction plan

- Add a small deterministic assertion using the repository's existing combat test harness.
- Equip a representative melee weapon (`gravediggers-spade` or `rusty-cleaver`).
- Plant a stationary enemy, issue about 15 attacks with the required simulation ticks, and record damage after every attack.
- Assert that later attacks still deal damage, so the assertion fails if the weapon stops working after only a few swings.
- Confirm that the assertion fails at the bad branch tip before using it as the bisect driver.

## Baseline and bisect plan

- Record the original branch tip and keep the repro assertion as the only intentional worktree change.
- Test progressively older revisions, starting before the recent weapon-related merge wave, until the same assertion passes.
- Mark the passing revision good and the recorded branch tip bad, then run `git bisect` with the deterministic repro command.
- Inspect the first-bad commit and identify the state transition that plausibly prevents later attacks.
- Reset the bisect and return to branch `sol/diag-weapon-bisect` at its original tip.

## Bisect log

- Bad tip recorded as `3ed60d8fac767f13c77491f80af625b9c355a06e`
  (`docs(plan): wardrobe retirement + whole-art default + char-select — 4-Sol wave plan`).
- A Gravewarden Buster control landed all 15 spaced melee swings at HEAD, so it was rejected as a
  non-reproducing fixture.
- The final focused fixture uses Sidewinder Spontoon (`x2-sidewinder-spontoon`), a melee-pool spear
  converted during the wave. It attacks a stationary dummy 15 times at a deterministic 20 Hz cadence.
- HEAD result: **FAIL**. Per-attempt damage was
  `[6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 6.104, 0, 6.104]`;
  attack 14 was rejected and dealt no damage.
- Repro command:
  `pnpm --filter @dd/shared build && pnpm exec vitest run packages/server/src/rooms/GameRoom.weapon-repro.test.ts --reporter=verbose`
- Known-good baseline: `9bb49aa` (`Merge branch 'sol/ranged-orders' into feat/v0.118-metagame`).
  The same assertion **PASS**ed after rebuilding `@dd/shared` at that revision.
- Bisect range: good `9bb49aa`, bad `3ed60d8`.

### Automated bisect steps

| Revision | Result | Subject |
| --- | --- | --- |
| `fa6deb7` | good | Merge branch `sol/b4-overcasters` |
| `df0fd58` | good | overnight session summary; B7/B8 deferred |
| `4a6607b` | good | B8 landed; B7 deferred |
| `b54f602` | bad | reconcile after B7 thrown merge |
| `c4c6066` | bad | Convert B7 weapons to thrown delivery |

`git bisect run powershell.exe -NoProfile -File tools/diag-weapon-bisect.ps1` identified
`c4c60661501ba6d38e083a8489c5bfaa7ff4247b` as the first bad commit. Its direct parent
`4a6607b` passes the same assertion.

## Attribution

The first-bad B7 source hunk changes Sidewinder Spontoon from `behavior.kind: "edge"` to a thrown
payload at `data/weapon-concepts-300.json:2716-2723` (`damage: 14`, `charges: 3`,
`refillSeconds: 1.92`, `pierce: 2`). Generation consequently changes its delivery from melee to
thrown and adds that payload at `packages/shared/src/weapons-expansion.generated.ts:2308-2338`.

That delivery change silently reprices the weapon through the existing Drive formula:

- Parent (`4a6607b`): melee profile, neutral cost `7`, load `1.0`, net spend `0/s`,
  `14` actions from a full bar.
- First bad (`c4c6066`): thrown profile, neutral cost `15`, load `1.326`, net spend
  `22.857/s`, only `6` actions from a full bar.

The causal state transition is not a stuck swing/lunge map. The new three-charge thrown payload
selects the thrown legacy-cost branch in `packages/shared/src/weapon-resource.ts:241-246`, doubling
the per-beat Drive price while retaining the weapon's fast `0.32s` cadence. At the deterministic
test cadence the bar loses about seven more points per accepted attack than it regenerates. Once
available Drive falls below the `15`-point debit, `GameRoom.trySpendWeaponResource` returns an
unaccepted result at `packages/server/src/rooms/GameRoom.ts:4692-4695`; no attack beat or damage is
created. The next attempt can resume only after the rejected attempt has allowed more Drive to
accumulate. This is why the trace deals damage 13 times, produces a zero-damage attack 14, then
briefly recovers on attack 15.

The B7 commit is cohesive but functionally entangled: a straight revert would restore the sustainable
melee profile, but it would also undo the wanted Sidewinder and Stormcrow thrown conversions, their
throw presentation, Boothook presentation corrections, generated catalog output, and B7 contracts.
It is therefore suitable only as an emergency rollback of B7, not as a targeted final fix.

The bisect was reset and the worktree was returned to branch `sol/diag-weapon-bisect` at original tip
`3ed60d8fac767f13c77491f80af625b9c355a06e`. A final HEAD run reproduced the same failure.

Verdict: FIRST BAD COMMIT `c4c60661501ba6d38e083a8489c5bfaa7ff4247b` — `Convert B7 weapons to thrown delivery` (B7); suspect hunk `data/weapon-concepts-300.json:2716` converts fast melee Sidewinder to a 3-charge thrown payload, which reprices Drive from 7 to 15 and causes `GameRoom.ts:4695` to reject later attacks; a straight revert is mechanically possible but not a viable targeted fix because it removes the wanted B7 thrown conversions and presentation/contracts with it.
