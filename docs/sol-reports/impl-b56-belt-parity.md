# B56 belt-mode parity restoration

## Outcome

Belt deep-links now enter the shared ArenaScene without waiting for a camera-fade event, SELF uses
one retained world-space presentation source before the belt render projection, and chest/prompt
anchors now share that render projection. The permanent gates run the standing movement/combat
matrix, B52 part continuity, B53-style flip/aim continuity, and the owner-facing smoke in belt mode
alongside their top-down controls.

No belt redesign, scene split, schema change, weapon catalog change, or chest/relic rules change was
made. `SCHEMA_VERSION` is untouched for the b54/b55 merge.

## Reproduction before repair

The raw reproduction summary is
[`reproduction.json`](../owner-notes-audit-v12-evidence/b56-belt-parity/reproduction.json).

- **Boot:** the orchestrator's headless load remained in MenuScene for approximately 12 seconds with
  DOM status `connecting…`, inactive ArenaScene, and no console error. A subsequent Sol attempt
  completed, identifying the failure as timing-dependent rather than a deterministic room rejection.
  Source inspection showed the cold URL route armed `launching` and then waited for
  `camerafadeoutcomplete`; a throttled render loop could prevent that event forever.
- **Missing UI:** while that route was hung, none of ArenaScene's HUD could exist. Once a pre-repair
  load did reach ArenaScene, all seven requested objects were constructed. The primary missing-UI
  failure was therefore boot reachability. The parity sweep separately found that the interaction
  prompt and chest were using different Y planes in belt mode.
- **Aim:** the Barrett control already produced approximately `1e-8` painted-axis error in both modes
  across both facings. Rusty Cleaver carries the same authored approximately 12-degree pose offset in
  both modes. The owner-visible belt aim failure was the correctly aimed weapon moving under a SELF
  root that alternated coordinate planes, not a second cursor conversion formula.
- **Phasing:** the pre-repair 17-sample trace measured a `502.508 px` maximum root step and
  `165.653 px` maximum belt-projection error. Root Y alternated around `2151.222` and `1985.570`.

## Root cause and repair

`interpolate()` produced a predicted position in simulation/world space. Later in the same frame,
`projectBelt()` replaced the live rig's Y with belt-render Y. On the next frame, B51's
`constrainRenderStep(blob.x, blob.y, candidate.x, candidate.y, …)` treated that projected root as the
prior world position. The fake Y delta entered the presentation gate and was rotated into X, so SELF
visibly alternated between two positions. The hit-stop `foldError(selfRig - predictor)` path had the
same mixed-space feedback.

ArenaScene now retains `selfPresentedWorldX/Y`, uses that pair as the only prior input to
`constrainRenderStep`, updates it from the accepted presentation result, resets it at scene and
teleport edges, and uses it for hit-stop folding. `projectBelt()` remains a render-only post-pass and
can no longer feed itself.

The parity sweep also added chests to the tracked belt projection pass and projects pickup/chest
interaction targets before drawing their ring and prompt. The live smoke requires chest art, prompt,
camera visibility, and authority coordinates to agree before opening the chest.

The MenuScene cold belt URL route still resolves the same AudioBus/meta/matchmaking readiness
contract, but starts ArenaScene directly after that promise. Interactive menu launches retain the
authored fade.

## Missing-UI enumeration

Seven owner-listed surfaces are restored/reachable, with the objective HUD checked as an additional
control:

1. Weapon dock: three slots, held Rusty Cleaver, and Drive pips.
2. Backpack: `[Tab] Backpack` affordance and the opened panel.
3. Money: run money copy in the weapon dock.
4. Health: bar plus `100 / 100` text.
5. Relic/trinket row: populated `RELICS MV` row.
6. Floor counter: `F1` on the first corporate floor.
7. Prompts: projected `[E] OPEN CHEST` prompt anchored to a visible projected chest.

[`belt-full-hud.png`](../owner-notes-audit-v12-evidence/b56-belt-parity/belt-full-hud.png)
is the live full-surface capture, and
[`belt-backpack-open.png`](../owner-notes-audit-v12-evidence/b56-belt-parity/belt-backpack-open.png)
shows the open inventory panel. The objective plate was also visible with `Advance to the next room`.

## Full parity table

| System | Top-down | Belt | Verdict |
|---|---|---|---|
| Boot | Arena starts after readiness; interactive menu keeps fade | Direct corporate URL starts after the same readiness contract without a render-event dependency; all three corporate floors passed | PASS — fixed |
| Movement / SELF position | Predictor candidate is constrained from retained world position | Same predictor/constrain path, then one render-only Y projection; 17-sample trace has `0 px` unexplained motion | PASS — fixed |
| Aim / facing | Screen pointer converts through camera; Barrett painted axis tracks four points and both facings | Identical render-space aim contract; maximum final flip-probe axis error `2.3e-8` and both facing signs | PASS |
| Attack | RMB and all representative weapon families produce accepted attack receipts | Same RPC/authority route; smoke attack seq `0 → 3`, and all belt gun/melee/combo telemetry scenarios passed | PASS |
| Parry | LMB brace plus four-direction successful-parry telemetry | Same input, authority, presentation, and SFX route; four belt directions passed and smoke observed a positive brace cooldown | PASS |
| Dodge | Shift enters authoritative stance 4 and shared slide presentation | Same stance/phase route; smoke observed stance 4 and belt dodge telemetry passed | PASS |
| Jump / pound | Space gesture, predictor, authority height, landing, and pound receipts | Same path with belt-render lift/ground anchors; smoke observed over `58 px` height; jump-pound and slide-hop telemetry passed | PASS |
| Camera | Smoothed two-axis follow/spectate | Authored horizontal corporate follow and fixed deck band, reading the same single SELF X source | PASS |
| HUD | Shared health/weapon/objective surfaces | Seven requested surfaces plus objective are live; backpack opens and relic/floor rows are populated | PASS — boot restored |
| Pickups / prompts | World anchors, nearest-target prompt, shared interaction RPC | Pickup art uses tracked projection and prompt target now uses projected Y; live prompt is camera-visible and aligned | PASS — fixed |
| Chests | Authority row, individual open receipt, renderer state | Same receipt/reward path; chest art was added to belt projection and a corporate chest was opened live | PASS — fixed |
| Damage numbers | Combat receipts resolve against rendered rig targets | Same renderer resolves projected belt rigs; worm fallback explicitly projects world Y | PASS |
| VFX anchoring | Receipt/player/projectile render targets | Actors, projectiles, pickups, zones, money, ultimates, hit effects, jump effects, and newly chests/prompts use the belt projection contract; B52 3×3 part sweep passed | PASS |
| SFX | Shared AudioBus cues and X-based listener panning | Same attack/parry/dodge/jump/chest/combat cues; no belt-muted or alternate cue branch found | PASS |

Parity table size: **14 systems**.

## Permanent gates

- **Telemetry:** `tools/diag-rb-telemetry.mts` now runs the standing 42-scenario matrix once
  top-down and once on `corporate-grid`; the existing belt elevator is belt scenario 43. Acceptance
  requires exactly 42 top-down + 43 belt. The captured run passed all 85 with zero correction
  requests, nonzero corrections, or snaps on private port 62478.
- **B52 part snap:** `b52-part-snap.probe.spec.ts` retains the top-down 3-character × 3-pose sweep and
  adds the same sweep on corporate belt using a validated belt corridor. Both paired tests passed.
- **B53 flip:** `b56-belt-flip.probe.spec.ts` pairs top-down and belt rapid-facing controls. Belt
  requires discrete facing, blend sign, root scale, one root projection, cursor aim, and no flip-owned
  position change.
- **Belt owner smoke:** `b56-belt-parity.smoke.spec.ts` requires active belt ArenaScene, all three
  corporate floor deep-links, all seven HUD surfaces, projected prompt/chest alignment, real chest
  opening, exact gun aim at four cursor positions and two facings, attack/parry/dodge/jump receipts,
  and a single-source 17-sample walk.
- **Source invariants:** `prediction.b56-belt-parity.test.ts` prevents projected-root feedback,
  projected hit-stop folding, fade-dependent direct boot, and omission of chest/prompt projection.

## Verification

- `pnpm gen` — PASS.
- `pnpm gen:check` — PASS. The existing VFX-subject check reported its documented skip because the
  untracked reference-art directory is unavailable; no generated VFX file was retained.
- `pnpm typecheck` — PASS.
- Full `pnpm test` — PASS: 217 files, 2,779 tests.
- `pnpm e2e --grep "B56"` — PASS: 5/5 paired boot/smoke/aim/flip tests.
- `pnpm e2e --grep "B52 (sweep|belt sweep)"` — PASS: 2/2 paired part-snap sweeps.
- Telemetry command — PASS: 85/85, mode split 42/43, zero corrections/snaps.

The complete evidence index is
[`docs/owner-notes-audit-v12-evidence/b56-belt-parity/`](../owner-notes-audit-v12-evidence/b56-belt-parity/README.md).

VERDICT: boot fixed; 7 UI surfaces restored; aim fixed; phasing root cause: projected SELF root was fed back as world-space into B51 constrainRenderStep/foldError; parity table size: 14 systems; belt gates added: 43-scenario belt telemetry, B52 belt part-snap, paired B53 belt flip, boot/HUD/aim/single-position/action/chest smoke, source invariants; evidence path: docs/owner-notes-audit-v12-evidence/b56-belt-parity/; files touched: ArenaScene.ts, MenuScene.ts, arena-harness.ts, b52-part-snap.probe.spec.ts, b56-belt-flip.probe.spec.ts, b56-belt-parity.smoke.spec.ts, prediction.b56-belt-parity.test.ts, diag-rb-telemetry.mts, this report, and B56 evidence.
