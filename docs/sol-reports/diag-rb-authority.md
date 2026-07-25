# Sol diagnosis: B42/B45 server-motion authority

Scope: static and unit-level diagnosis only. No runtime or game-code fix is included.

## Executive finding

The B42 numeric and navigation envelope is internally consistent, and every legal peak is either inside
its computed per-tick budget or deliberately ignored while `serverMotionActive` is true. The audit found
two server-motion contract mismatches:

1. `SERVER_MOTION_IMPULSE_TICKS = 12` supplies only **11 future protected integration ticks** to a motion
   registered after the current tick's movement phase. A capped or near-capped impulse needs 12 future
   integrations to settle. The twelfth displacement is therefore made after the timed epoch expires.
2. Four direct-placement sources write `PlayerState.x/y` before the call that opens the epoch. These writes
   are atomic in the current single-threaded fixed step, so no intermediate patch is presently emitted,
   but they violate the requested "register before displacement lands in state" ordering invariant.

The first mismatch's exposed tail is small: a capped 780 px/s impulse moves 0.276253 px on the unowned
twelfth tick. It is below B42's 3 px continuity slack and therefore does not by itself prove the owner's
reported pose will be rejected. The placement-order findings are likewise contract/order findings rather
than proof of an observable intermediate snapshot. They remain real gaps in the stated epoch protocol.

## B42 envelope census

The pure gate is `evaluateClientMovementEnvelope` in
`packages/shared/src/movement-authority.ts:56-104`. The room applies it at
`packages/server/src/rooms/room/room-progression.ts:3608-3649`.

| Check | Actual rule | Consequence |
| --- | --- | --- |
| Epoch freshness | Report epoch and correction sequence must equal current wire values | Stale reports are ignored, not adopted or counted as a fresh rejection |
| Server motion | Numeric and navigation checks run only when `serverMotionActive` is false | Every classified peak is admitted unconditionally during its epoch |
| Finite | Report `x/y/mvx/mvy/vx/vy` and all envelope inputs must be finite | Reject reason `NonFinite` |
| Move speed | `hypot(mvx,mvy) <= maxMoveSpeed + 24` | Reject reason `MoveSpeed` |
| Impulse speed | `hypot(vx,vy) <= maxImpulseSpeed + 24` | Reject reason `ImpulseSpeed` |
| Total speed | `hypot(mvx+vx,mvy+vy) <= maxMoveSpeed + maxImpulseSpeed + 24` | Reject reason `TotalSpeed` |
| Continuity | displacement `<= (maxMoveSpeed + maxImpulseSpeed) * dt + authoredDisplacementPx + 3` | Reject reason `Continuity` |
| Navigation | Full segment sweep through arena/belt bounds, pits, POIs, belt obstacles, lanes, and gates | Failed sweep increments `movementCorrectionSeq` |

At the server call site, `maxMoveSpeed` is the maximum of relic walk speed, the actual server movement
vector, the 620 px/s distance-jump speed, and the exact current roll-curve sample.
`maxImpulseSpeed` is the impulse magnitude captured before the server integrates it. No caller supplies
`authoredDisplacementPx`; direct authored placements depend entirely on the active-epoch bypass.

Peak checks at the 50 ms fixed step:

- Capped impulse: `780 * .05 = 39 px`; admitted because the epoch is active. On the exposed final tail,
  `5.525059 * .05 = 0.276253 px`, which is also inside the ordinary continuity budget.
- Fastest dodge: Bloodhound's `680 * 1.35 = 918 px/s`, or `45.9 px/tick`; active bypass applies, and the
  fallback movement budget also uses the exact roll sample.
- Distance jump: `620 px/s`, or `31 px/tick`; active bypass applies, with an exact 620 fallback budget.
- Parry slide: at most 120 px in one direct placement; `beginServerMotion(..., 1, "parry-slide")` executes
  before the assignment, so the otherwise-too-large cut is bypassed.
- Maximum direct gun recoil: 233 px/s, or 11.65 px on its first integration. Sustained catalog recoil
  peaks below the cap; combined-source impulses can reach the 780 px/s rail.
- Ranged beam recoil: at most 38 px/s applied as `38 * .05 = 1.9 px/s` of impulse per tick. Its steady
  pre-integration impulse is `1.9 / (1 - exp(-.45)) = 5.2432 px/s`, only `0.2622 px/tick`.

## Motion-source census

Expected window means the epoch is registered before the first state displacement and remains active
through every authored displacement/decay sample. "Actual window" uses the real ordering and the strict
expiry test: `state.tick < untilTick`.

| Source | Expected window | Actual window | Verdict |
| --- | --- | --- | --- |
| `dodge-roll` | Before sample 1 through all 8 roll samples; peak 45.9 px/tick | Registered before stance movement for `ROLL_DURATION_TICKS + 1 = 9`; all 8 samples owned | Clean |
| `distance-jump` | Before launch through all 12 horizontal flight samples; peak 31 px/tick | Registered before state displacement for `ceil(.6/.05)+1 = 13`; launch defers the first horizontal sample and the 12 samples remain owned | Clean |
| `slide-hop` | Any authored hop must register before motion and cover its full arc | Census-only/dormant B44 token; no production call or displacement exists | Clean (inactive) |
| `parry-slide` | Before the one direct swept-valid placement, up to 120 px | Registered for 1 tick before `player.x/y = destination` | Clean |
| `parry-launch` | Before horizontal/vertical launch; horizontal impulse through settlement | Registered for 16 ticks before adding the 130 px/s push and vertical velocity; 16 exceeds the 8-tick isolated horizontal decay | Clean |
| `enemy-contact-hit` | Every resulting impulse integration, including a capped composite rail | Registered after the current movement phase for 12 ticks, protecting only the next 11 integrations; contact alone settles safely, but a composite `>=705.875` px/s needs a twelfth | **Mismatch: capped tail** |
| `enemy-commit-hit` | Every resulting impulse integration, including authored boss knockback at/over the cap | Registered after impulse assignment for 12 ticks, protecting 11 future integrations; authored 720-1000 px/s boss values can directly enter the 12-integration range/cap | **Mismatch: capped tail** |
| `enemy-commit-launch` | Before launch and through horizontal impulse settlement | Registered for 16 ticks after velocity assignment but before its first future integration; even a capped horizontal rail settles by integration 12 | Clean |
| `hostile-projectile-hit` | Every resulting impulse integration, including composition with existing velocity | Registered after impulse assignment for 12 ticks, protecting 11 future integrations; isolated 300 px/s settles at 10, but a composite `>=705.875` needs 12 | **Mismatch: capped tail** |
| `pit-snapback` | Epoch opened before safe-ground `x/y` assignment | Both belt and arena paths assign the safe position, then call `zeroMoveVel`, which opens a 1-tick epoch | **Mismatch: post-placement registration** |
| `elevator-boarding` | Epoch opened before every car/spawn reassertion and continuous through departure/arrival | `positionCorporateParty` assigns `x/y`, then opens/extends `ticksLeft + 1`; duration is continuous but the first assignment precedes registration | **Mismatch: post-placement registration** |
| `revive-placement` | Before any placement/velocity mutation | Current revive paths do not reposition; `zeroMoveVel` opens 1 tick before zeroing the synchronized movement fields | Clean |
| `teleport-placement` | Epoch opened before testing-ground, restart, and rift-descent `x/y` assignments | Each audited path assigns `x/y`, then calls `zeroMoveVel(..., "teleport-placement")`; `teleportSeq` is bumped only afterward | **Mismatch: post-placement registration** |
| `ultimate` | Before every ultimate-owned direct or progressive root displacement, through the complete moving phase | Seismarch, Alpha Strike, and Event Horizon are dynamically owned while active. Dimension Door outbound/return assigns `x/y` before its 1-tick `zeroMoveVel("ultimate")` registration | **Mismatch: Dimension Door post-placement registration** |
| `weapon-fire-recoil` | Before recoil velocity is observable and through every impulse integration | Registered after velocity assignment but before the first future position integration. Isolated/sustained catalog recoil settles inside the window; a capped composite gets only 11 protected integrations | **Mismatch: capped composite tail** |

Parry brace is not a sixteenth source: the above/below brace changes reaction presentation and does not
write player root position or impulse. The census is therefore complete at 15.

## Why 12 configured ticks become 11 protected future ticks

`beginServerMotion` stores `until = currentTick + duration`. `stepSim` increments the tick and calls
`refreshServerMotionState` before integrating player movement. The timed predicate is
`currentTick < until`, not inclusive. For an impulse registered late on tick `N`, the position was already
integrated on `N`; ticks `N+1` through `N+11` are active, and tick `N+12` expires before integration.

Impulse decay is `v[n+1] = v[n] * exp(-9 * .05)`, with the velocity snapped to zero only after decay when
its component is below 5 px/s. For an axial cap:

```text
decay                         = exp(-0.45) = 0.6376281516
velocity before sample 12     = 780 * decay^11 = 5.52505896 px/s
sample-12 displacement        = 5.52505896 * 0.05 = 0.27625295 px
post-sample velocity          = 3.5229 px/s -> snapped to zero
12-sample threshold           = 5 / decay^11 = 705.874820 px/s
```

Consequently, the constant's nominal 12 ticks cover a pure 233 px/s gun kick (settles in 9), a 300 px/s
projectile hit (10), and the worst isolated rapid-fire catalog stream (10), but not a capped or sufficiently
large composite impulse.

## B45 recoil audit

### Guns and retriggering

`fireGun` adds recoil late in the combat phase, after that tick's movement integration.
`applyWeaponFireRecoil` writes `vx/vy` and then calls `beginServerMotion(..., 12,
"weapon-fire-recoil")`. A retrigger while active extends `untilTick` but does not increment
`serverMotionEpoch`; an epoch is minted only on an inactive-to-active edge. This is correct for rapid fire:
successive shots form one continuous ownership interval and do not manufacture correction/rebase edges.

The heaviest single catalog recoil is Calamity Howitzer at 233 px/s and settles in 9 integrations. A
catalog cadence simulation at 50 ms, including burst sub-rounds and a deliberately aggressive
`0.70 * 0.94^3` cooldown multiplier, found the worst sustained gun peak at approximately 325.556 px/s
(`x2-plaguespitter-flak-gun`), settling in 10 integrations after release. Burst candidates, including the
six-round Quicksilver and four-round Buzzard patterns, remained below that peak. Thus no gun reaches the
expiry race in isolation.

The mismatch becomes reachable when recoil composes with an existing enemy/contact/projectile impulse.
`addImpulse` caps the vector at 780 px/s, and the recoil registration can become the last source to extend
the epoch. That combined state needs sample 12, while the recoil epoch releases immediately before it.

### Beams

Ranged beams call the same method every active tick with `recoilPerSecond * dt`. At the catalog maximum
38 px/s, each call adds 1.9 px/s. The geometric steady peak is 5.2432 px/s and the maximum displacement is
about 0.2622 px/tick. Every channel tick extends the same epoch; after release, the last beam impulse
settles in one integration. Beam-only recoil has no expiry mismatch and is far inside the B42 numeric
envelope.

## Interaction audit

| Interaction | Result |
| --- | --- |
| Recoil during dodge | Same epoch; recoil changes the diagnostic source and extends `until` to current tick + 12. Bloodhound roll plus the largest direct recoil can sum to 1151 px/s (`57.55 px/tick`), but active ownership bypasses B42. Even a hypothetical numeric check has exact 918 move and 233 impulse budgets plus 3 px slack. Clean except for the general capped-composite tail. |
| Parry slide during recoil | `parry-slide` registers before its direct placement, preserves the existing later recoil `until`, and does not mint a new epoch. The 120 px cut stays owned. Clean except for any already-capped impulse tail. |
| Belt X-clamp plus recoil | `stepImpulse` receives belt playable X bounds, so a 39 px capped step is clamped before state publication; belt navigation/pit resolution follows. Existing B45 belt coverage and the focused suite pass. No clamp-specific mismatch. |

## Unit reproductions

`packages/server/src/rooms/GameRoom.diag-rb-authority.test.ts` is the diagnosis deliverable. Its eight
`it.fails` cases encode the desired contract and fail against current runtime behavior:

- four parameterized capped-impulse cases assert that
  `enemy-contact-hit`, `enemy-commit-hit`, `hostile-projectile-hit`, and `weapon-fire-recoil` own every
  non-zero integration sample;
- four instrumented ordering cases capture position at the first registration and assert that
  `pit-snapback`, `elevator-boarding`, `teleport-placement`, and Dimension Door `ultimate` register before
  the state cut.

Passing controls verify rapid fire reuses/extends one epoch, recoil during dodge extends the existing
epoch, and a parry slide cannot shorten a live recoil window. Existing B45 coverage supplies the belt
clamp and beam boundary controls.

Verification commands:

```text
pnpm exec vitest run packages/server/src/rooms/GameRoom.diag-rb-authority.test.ts
pnpm exec vitest run packages/shared/src/movement-authority.test.ts packages/server/src/rooms/GameRoom.b42-relaxed-authority.test.ts packages/server/src/rooms/GameRoom.b45-gun-recoil.test.ts tests/b44-no-weapon-drift.test.ts tests/b45-gun-recoil.test.ts
pnpm typecheck
```

Results: Biome passed for the diagnostic test; the focused matrix passed 6 files / 54 tests; typecheck
passed for all workspaces; the full suite passed 212 files / 2,741 tests. The diagnostic file contributes
11 tests: 8 expected-failure reproductions and 3 passing interaction controls.

verdict: 15 sources audited, 8 mismatches named.
