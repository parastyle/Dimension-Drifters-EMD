# Sol report: fix-weapon-stall

## Understanding

The client predictor increments `localPredictedAttackSeq` for a discrete attack before the server has accepted it. Its current Drive-affordability guard applies only to thrown, gun, and warp weapons, even though the server charges Drive for additional discrete weapons such as melee and caster weapons. A rejected melee or caster attack therefore leaves the predicted sequence one step ahead of `self.attackSeq`, and the unbounded prediction-lead guard permanently refuses every later attack.

The fix is client-only. It must preserve the Overcasters recoil-isolation behavior and the normal one-speculative-beat limit, while ensuring that client prediction uses the same Drive-billing set as the server and that a stranded lead heals after a short bounded interval.

## Plan

1. Inspect the local attack predictor and the shared/server weapon-resource billing logic.
2. Extend the pre-increment Drive-affordability check to all discrete weapons billed by the server, without changing beams, channels, auras, costs, or server behavior.
3. Track how long a prediction lead remains unacknowledged; keep blocking during normal latency, then resynchronize the local sequence to the authoritative sequence and permit a retry.
4. Add deterministic regression coverage for melee and caster recovery plus a source assertion for their Drive precheck coverage.
5. Run the focused test, `pnpm typecheck`, and full `pnpm test`; inspect the diff and commit on `sol/fix-weapon-stall`.

## Implementation

- `packages/client/src/scenes/ArenaScene.ts:10244` now routes the outstanding local attack sequence through a bounded lead gate and records the speculative beat timestamp at `packages/client/src/scenes/ArenaScene.ts:10278`.
- `packages/client/src/scenes/ArenaScene.ts:10257` now derives the Drive precheck from the weapon's positive shared cost for every discrete attack, including melee and caster, before the predicted sequence increments. Beam, channel, and aura early-outs remain unchanged.
- `packages/client/src/scenes/arena/local-attack-prediction.ts:1` contains the deterministic 250 ms lead budget, uint32 resynchronization, and floored public-Drive affordability check.
- No server resource spend, Drive cost formula, economy behavior, or Overcasters recoil path changed.

## Verification

- Focused regression: `pnpm exec vitest run packages/client/src/scenes/arena/local-attack-prediction.test.ts` — 4/4 passed.
- Static validation: `pnpm typecheck` — passed for shared, client, and server.
- Full suite: `pnpm test` — 147 files and 1,848 tests passed, including existing Overcasters recoil-isolation coverage.
- Line endings: all changed and added files are LF.

VERDICT: `packages/client/src/scenes/ArenaScene.ts:10244-10278` now applies every discrete weapon's positive Drive cost before prediction and self-heals a stranded lead after 250 ms via `packages/client/src/scenes/arena/local-attack-prediction.ts:1-46`; `packages/client/src/scenes/arena/local-attack-prediction.test.ts:35-117` proves melee and caster remain single-beat bounded, resynchronize after a Drive rejection, and fire again once Drive regenerates—melee and caster now recover instead of stalling permanently.
