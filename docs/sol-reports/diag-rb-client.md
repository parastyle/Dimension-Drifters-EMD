# Client prediction/reconciliation rubberband audit

## Result

The client is not bit-identical to the authoritative movement step in all modes. Ten intentionally
failing reproductions cover eight mismatch groups. The highest-frequency defects are unpredicted
B45 weapon recoil, missing attack-phase speed scalars, correction debt being cancelled or topped up
by subsequent patches, and a real round-trip race in the server-motion epoch echo.

No game code was changed.

## Audited paths

| # | Path | Result |
|---:|---|---|
| 1 | Ordinary arena steering | Shared step and focused baseline tests agree |
| 2 | B33 `InputSlow` arena steering | Shared attack multiplier agrees |
| 3 | Ordinary belt steering | Post-navigation result agrees in sampled authored levels |
| 4 | B33 `InputSlow` belt steering | X argument positions agree; belt Y values are not passed |
| 5 | Ground distance jump | Existing focused parity tests pass |
| 6 | Slide/roll | Existing focused parity tests pass |
| 7 | Pound | Existing focused parity tests pass |
| 8 | Relic air jump | Mismatch: client cannot launch a server-legal air jump |
| 9 | Beam charge/channel steering | Mismatch: client has no phase speed scalar |
| 10 | Ultimate windup/owned movement | Sunspite scalar is absent; authority-owned motion is otherwise an intentional cut |
| 11 | Weapon recoil/impulse | Mismatch: direct-shot and ranged-beam recoil are not predicted |
| 12 | Map, POI, belt, and live gate collision | Mismatch: predictor has no live closed-gate state |
| 13 | Owner correction bands | Mismatches: quiet-patch cancellation and active-patch top-up |
| 14 | Remote-player snapshots | Silent/smooth/large policy is wired |
| 15 | Enemy snapshots | Interpolation and snap discontinuities are independent of owner reconciliation |
| 16 | Teleport, fall, pause, and stall reset paths | Intended hard-cut/purge paths are wired |
| 17 | B44 owner gun presentation bound | Mismatch: the bound can bypass the B42 medium band |
| 18 | Server-motion epoch echo/adoption | Mismatch: unseen short epochs reject post-epoch owner reports |

## Mismatches

### 1. B45 recoil never reaches local prediction

`SelfPredictor.addPredictedImpulse()` exists in `packages/client/src/net/prediction.ts`, but no
production caller uses it. `ArenaScene.sendAttack()` predicts camera, rig, and muzzle presentation
only. The server calls `applyWeaponFireRecoil()` for accepted gun shots, adds the impulse immediately,
and opens a `weapon-fire-recoil` server-motion window.

Ranged beams also apply continuous recoil on the server while active, but the predictor has neither
the weapon/beam phase nor equivalent per-tick impulse logic. For `x2-mirage-coilrifle`, one 50 ms
active tick produces authoritative `vx = -1.55`; prediction remains at `vx = 0`.

Consequence: every recoiling shot begins with deterministic position/velocity disagreement. The
owner sees it only through state correction.

Reproductions:

- `wires B45 gun recoil from the accepted local shot edge into SelfPredictor`
- `applies ranged-beam recoil on the same predicted tick as authority`

### 2. Server attack-phase movement scalars are absent from prediction

The server computes `beamSpeed` from charge/channel descriptor multipliers and the Sunspite windup
multiplier before calling `stepPlayerAttackMovement()`. The client calls the same helper with only
`relicMoveSpeed(relics)` and `attackMoveMode`; `ServerView` does not carry a phase speed scalar.

With initial `mvx = 320`, one Mirage coil-rifle channel tick predicts `x = 1016`, while the shared
step at the server's channel speed reaches `x = 1005.6`.

Consequence: beam charge/channel and Sunspite windup cannot be bit-identical. During server-owned
motion the divergence is corrected; where owner reports are admissible, a client report can also
erase the intended slowdown.

Reproduction: `uses the server beam-channel movement scalar in the predicted shared step`.

### 3. Relic air jumps are server-only

The server accepts a jump while airborne when `airJumpsRemaining > 0`, consumes the relic charge,
and launches the distance-jump stance. `stepPredictionTick()` requires
`height <= GROUND_EPSILON` and the client state does not track remaining air-jump charges.

Consequence: a valid air jump remains a falling, non-dash state locally until authority corrects it.

Reproduction: `launches a server-legal relic air jump instead of waiting for correction`.

### 4. Belt authority context is incomplete

The B33/B34 hand-merged call keeps X arguments in the correct positions by passing two `undefined`
placeholders, but its values are not identical to the server call:

- Server: `BELT_Y0`, `BELT_Y0 + DEPTH_MAX`, `minBeltX`, `maxBeltX`.
- Client: default arena Y bounds, then authored belt X bounds.

The later `resolveBeltNavigation()` masked the Y difference in sampled final positions across the
current authored levels, so the missing Y values are a latent shared-call contract drift rather than
an independently observed final-position delta.

The live closed-room gate is a concrete delta: the server additionally clamps to `beltLockX`, but
the predictor receives only the static `BeltLevel`. At the first Sky Carrier closed gate, one right
tick predicts `x = 1881.5` beyond the authoritative right bound `x = 1876`.

Reproductions:

- `passes the server belt depth bounds into the hand-merged movement call`
- `keeps local belt prediction behind the current closed room gate`

### 5. A quiet state patch aborts the 140 ms correction

`applyMovementCorrection()` correctly classifies silent, medium, and large errors at entry. A medium
error starts a 140 ms deadline. However, `reconcile()` unconditionally clears `errX`, `errY`, and
`correctionRemainingSec` whenever the next relaxed-authority patch has no changed correction
sequence, motion epoch, active-motion flag, or teleport.

In the reproduction, a 40 px correction decays for 40 ms and has 100 ms remaining. A normal patch
with the same correction sequence sets the remaining duration and error to zero.

Consequence: at ordinary patch rates, the advertised 140 ms medium band can last only until the next
quiet patch and then snap.

Reproduction: `lets a medium correction finish its 140ms band across ordinary state patches`.

### 6. Active recoil patches re-target correction debt every tick

While `serverMotionActive` is true, every patch sets `correctionRequested`, recomputes the residual
from the current visual position, and overwrites the correction vector. The deadline itself does not
restart, but the magnitude can be topped up each patch.

The reproduction starts a 60 px active-motion correction, decays it for 100 ms to about 17.14 px,
then receives the next active patch 20 px farther away. Debt grows to about 37.14 px.

Consequence: correction presentation fights an ongoing recoil impulse and then snaps whatever debt
remains at the original deadline.

Reproduction: `does not re-target or top up correction debt on every active recoil patch`.

### 7. B44 gun presentation bounding bypasses the B42 correction band

`ArenaScene` invokes `boundLocomotionPresentation()` whenever a gun is equipped, not only at a
firing edge. The method clamps the rendered owner to a 48 px authority radius and mutates correction
debt directly, without going through `movementCorrectionBand()`.

For a 60 px medium correction, B42 initially preserves the current visual `x = 1000` and intends to
glide it. The B44 bound immediately moves it to `x = 1012`.

Consequence: the visible behavior no longer follows the selected silent/smooth/instant correction
band on that render path.

Reproduction: `keeps the B44 gun presentation bound from bypassing the B42 medium band`.

### 8. Server-motion epoch echo has a real round-trip race

The predictor can echo only the last `serverMotionEpoch` received in a server patch. The server
accepts an owner movement report only when the echoed epoch exactly matches its current epoch and
`serverMotionActive` is false.

An epoch can open and close before its patch completes server-to-client transit. The client's first
post-epoch heartbeat still echoes the prior value, so the server silently rejects otherwise
post-motion movement until the new epoch travels to the client and its echo returns. This is at
least a patch-plus-return-trip owner-authority blackout; there is no correction-sequence bump for
the rejection itself.

The race is trivially reachable for one-tick parry motion. B45 fire recoil lasts
`SERVER_MOTION_IMPULSE_TICKS = 12`, or 600 ms at the 50 ms simulation tick, so the same race is real
for recoil whenever the patch/round-trip delay exceeds that window. Separate shots can create
successive epochs and repeat the blackout.

Reproduction: `does not leave post-epoch owner reports stale for a full return trip`.

## Correction wiring that did match

- Owner correction entry uses the shared `< 3 px` silent band, medium smoothing, and large instant
  snap classification.
- Remote-player `SnapshotBuffer` applies silent collapse, a maximum 140 ms medium span, and large
  snap/cut behavior.
- Teleport, pit/fall, pause, and stall recovery paths intentionally purge history or hard resync.
- `constrainRenderStep()` and hit-stop error folding return through the correction-band helper.

These matches do not neutralize mismatches 5–7 because those paths subsequently clear, replenish,
or directly mutate the selected correction debt.

## Tests and validation

Diagnostic file:
`packages/client/src/net/prediction.diag-rb-client.test.ts`

Expected diagnostic result:

```text
pnpm exec vitest run packages/client/src/net/prediction.diag-rb-client.test.ts --reporter=dot
1 file failed, 10 tests failed
```

The failures are intentional reproductions and are left red as requested.

Focused pre-existing baseline:

```text
pnpm exec vitest run packages/client/src/net/prediction.test.ts packages/client/src/net/prediction.b33.test.ts packages/client/src/net/prediction.b41.test.ts packages/client/src/net/prediction.b42.test.ts packages/client/src/net/snapshots.test.ts --reporter=dot
5 files passed, 49 tests passed
```

Static validation:

```text
pnpm --filter @dd/client typecheck
passed

pnpm exec biome check packages/client/src/net/prediction.diag-rb-client.test.ts
passed
```

## Verdict

18 paths audited, 8 mismatch groups named. The round-trip/server-motion-epoch race is real.
