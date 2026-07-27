# B86 diagnostic HUD threshold retune

## Result

The six owner-named HUD metrics now enter AMBER when player-visible softness begins and RED when the
symptom is plainly perceptible. All comparisons remain strict `>` checks.

| Metric | GREEN | AMBER | RED |
|---|---:|---:|---:|
| Frame time, current and rolling p99 | <=20 ms | >20 ms | >50 ms |
| Render-to-commit divergence | <=1 px | >1 px | >4 px |
| Input latency | <=20 ms | >20 ms | >50 ms |
| Prediction pending depth or 10 s growth | <=4 | >4 | >16 |
| Server tick absolute drift | <=8 ms | >8 ms | >20 ms |
| Entity load: enemies | <=48 | 49–80 | >80 |
| Entity load: combined projectiles | <=187 | 188–312 | >312 |
| Entity load: active VFX surfaces | <=7 | 8–12 | >12 |

The context-only particle bands within the entity-load row remain >192 AMBER and >384 RED because
that count has no canonical entity cap. Room RTT, heap, and HUD self-cost bands are also unchanged.

Stalls retain their independent >250 ms RED trigger. This required naming `stallRedMs` separately
from the newly lowered `frameRedMs`; otherwise an ordinary >50 ms visible hitch would have been
miscounted as a force-resync-class stall. SELF corrections remain canon L10: any Smooth is AMBER and
any Snap is RED.

## Constants and rationale

Every band lives in the threshold block at `packages/client/src/dev/diagnostic-hud.ts`: the exported
`DIAGNOSTIC_THRESHOLDS` object plus its adjacent `ENTITY_LOAD_AMBER_FRACTION`, so another entity-load
percentage retune is one line. The comment immediately above the object records the owner's perception
rationale: a 50 ms frame spans three 60 Hz frame budgets and is plainly visible, 4 px of render/commit
disagreement is a perceptible twitch at the owner's resolution, and 50 ms of physical input latency is
where a responsive game starts feeling soft.

The cap-backed entity counts use integer first-AMBER values derived from 60% of each cap. Red remains
a strict cap violation, not merely reaching the cap.

## B85 sequencing and mapping

The branch was fetched and rebased against `origin/feat/v0.118-metagame` before editing. A final fetch
still showed that remote at `71c8bb62`; b85 was available only as the unmerged local
`sol/b85-hud-wire` commit `14da21eb`. I inspected that completed HUD restructure read-only. It retains
the same threshold object and metric identifiers while adding truthful sampling and unavailable
states, so all six mappings above apply directly and no b85-added metric needed interpretation. This
branch does not absorb b85's gameplay/prediction changes.

## Noise check

The private dev server and dev-gated Vite client started successfully on ports 2573 and 5186. Browser
runtime discovery returned an empty backend list, so ordinary healthy play and a HUD screenshot were
not available in this environment. No claim is made from the pre-b85 zero readings, and no metric was
identified as permanently AMBER or RED. The focused telemetry fixture remains fully GREEN at the new
exact boundaries, but that synthetic check is not a substitute for the requested real-play sample.

## Verification

- `pnpm gen:check`: PASS. Existing warnings noted that untracked VFX reference artifacts and some
  character scale measurements were unavailable; the command exited 0 and all tracked generators
  reported in sync.
- `pnpm typecheck`: PASS.
- Focused HUD test: PASS, 1 file / 5 tests.
- Full `pnpm test`, pass 1: PASS, 246 files / 2,935 passed / 20 skipped.
- Full `pnpm test`, pass 2: PASS, 246 files / 2,935 passed / 20 skipped.

verdict: metrics retuned 6, constants location `packages/client/src/dev/diagnostic-hud.ts` threshold block, permanently amber/red: none identified (browser unavailable for real-play measurement), 2x test results: PASS — 246 files / 2,935 passed / 20 skipped each
