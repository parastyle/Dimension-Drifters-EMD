# B40 flourish regression

Branch: `sol/b40-flourish-regression`

## Diagnosis

The B35 and B38 diffs do not touch Kunai metadata, its `thrown` pose family, the
`pistol-end-hook` flourish spec, or the accepted `triggerSwing` call that arms it.

- B35 (`0797234`) made two relevant changes. Its stray-hand classifier fix correctly releases true
  1H worn free hands and makes physical 2H ranged grips authoritative; that fix is retained. Its
  `SpriteRig` change also keeps every held gun in the ranged-aim owner continuously, by calling
  `holdRangedAim` whenever `hasGunHeld` is true. The flourish owner gate still treated any positive
  `rangedAimBlend` as stronger than an armed flourish. Consequently pistol/long-gun streak
  flourishes could arm but never start.
- B38 (`8a157b9`) adds only an edge-triggered render-stack reorder for the active revolver hammer
  hand. It does not read or mutate flourish channels, arms, streaks, pose ownership, or Kunai state.

The orchestrator's Kunai telemetry pinpoints a second shared-state defect:
`earliestStartMs: -1e9` is written only by `clearFlourishActivity`; a flourish that starts normally
sets `armed` false but leaves its earned epoch finite. Thus the accepted Kunai attack did arm and a
subsequent presentation-clock discontinuity erased the arm. The clock-cut path reused the full
semantic reset even though a frame hitch/root correction is not player cancellation. It could also
drop an already-started `after-attack` channel.

Together, B35 made the shared arming/ownership defects observable on current integration load:
persistent aim starved gun arms, while a stressed render-clock cut erased or dropped accepted
after-attack punctuation. The deterministic suspect-commit regression is B35; the exact Kunai
`-1e9` signature is the older shared reset defect rather than a Kunai metadata change. B38 is not
the culprit.

## Root fix

`SpriteRig` now separates transient presentation cuts from semantic flourish cancellation.

- A timing cut clears partial render channels and stow proxies, but retains pending accepted arms.
- If the cut lands after an `after-attack` channel started, the channel is converted back to an
  immediate accepted arm so the punctuation restarts cleanly on the next eligible idle frame.
- Actual attack/movement cancellation, weapon swaps, offscreen cleanup, downed/ultimate state,
  unequip, and destroy still clear arms.
- B35's shoulder-level gun aim remains the default owner. It yields only on an idle frame while an
  earned flourish is armed or active, then resumes after the flourish. The B35 stray-hand
  classification and B38 hammer-hand render layering are unchanged.

## Test migration

- Added focused coverage for the B35 persistent-aim handoff.
- Added focused coverage proving a timing cut preserves pending arms, re-arms an active
  `after-attack` channel, clears partial visual state, and retains the original semantic-reset
  behavior.
- Added optional `DD_E2E_EVIDENCE_DIR` routing to the B29, pistol-twirl, and Coilshot gates so both
  private-port verification passes can retain independent B40 evidence without overwriting the
  historical owner evidence.
- No gate assertion or timing threshold was weakened.

## Verification

- Focused flourish/unit sweep: PASS, 4 files / 55 tests.
- Private-port flourish gates: PASS twice each, with no assertion or timing changes:
  - Run 1: B29 1/1 on client/game `58365/58363`; pistol + Coilshot 3/3 on a separate
    `startSpecStack` allocation (game `55412`).
  - Run 2: B29 1/1 on client/game `59899/59898`; pistol + Coilshot 3/3 on a separate
    `startSpecStack` allocation (game `50165`).
  - Both B29 runs captured active Kunai end-hook flourishes in both facings with finite earned
    epochs. Both pistol runs exceeded one full revolution for the one-hand and both authored-dual
    hands. Both Coilshot runs exceeded 1.35 turns before release.
- `pnpm typecheck`: PASS.
- Full `pnpm test`: PASS, 189 files / 2,347 tests.
- The isolated worktree initially lacked Artkit's ignored test prerequisites. I installed the
  declared `tools/artkit` dependencies and copied the canonical ignored orientation/actor fixtures
  into this worktree; the unchanged full suite then passed. These bootstrap files remain ignored
  and are not part of the commit.
- Evidence: `docs/owner-notes-audit-v11-evidence/b40-flourish-regression/`.

Verdict: culprit commit `0797234` (B35)—permanent gun-aim ownership vetoed earned gun flourishes, while the shared clock-cut semantic reset produced the Kunai `-1e9` disarm; the fix preserves/re-arms accepted punctuation across timing cuts and narrowly yields idle gun aim without reverting B35 stray-hand or B38 hammer layering; B29, pistol-twirl, and Coilshot gates are 2x green, plus typecheck and 189/2,347 tests; files touched: `SpriteRig.ts`, `SpriteRig.ranged.test.ts`, the three flourish gate specs, this report, and B40 evidence.
