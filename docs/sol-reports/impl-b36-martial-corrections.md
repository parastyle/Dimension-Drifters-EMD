# B36 martial/melee corrections — `impl-b36-martial-corrections`

## Desync diagnosis

The post-combo offset was authoritative root-motion reconciliation drift. Several kung-fu beats scheduled server-owned lunges while the client continued predicting/interpolating ordinary movement and presenting the combo from its local pose clock. When the queued lunge completed—or when the next authoritative position replaced the predicted position—the two clocks reconciled to different character origins. That produced the reported post-combo offset or visible snap.

B36 removes the conflicting character-translation channel from all five weapons. The hit envelopes, accepted combo cadence, paper turns, flips, stretch poses, hold silhouettes, and other presentation-only choreography remain. A non-displacing punch now publishes B33 `InputSlow` for the following movement tick at the intended `0.75` ratio, so an attacker can still walk during the combo without stacking or reconciling a second movement source.

## Implemented owner orders

1. **Kung-fu displacement removed**
   - Muay Thai, Wing Chun, Drunken Fist, Iron Palm, and Emberfist have no authored `rootMotion` and no `performance.forwardDrift`.
   - Full combo lengths remain 5, 5, 5, 4, and 8 beats respectively. Theatrical fields are preserved.
   - The accepted-cadence grace covers five-beat theatrical chains, and the server retains one modest B33 input-slow movement tick even when a short melee envelope ages out later in the same 20 Hz simulation step.
   - Unit coverage now proves every beat resolves in place in both facings, no pending lunge is scheduled, damage multipliers remain, walking advances the player, and post-combo position is stable.

2. **Wyrmskull hold-open**
   - Schema v40 adds the watchdog-filtered authoritative `fireInputHeld` bit.
   - The scene treats firing-frame weapons as held-fire inputs, the rig samples the replicated held bit, and the legacy B13 accepted-tick window remains as a compatibility fallback.
   - The firing-frame weapon identity survives a late release patch, so the mouth remains open for an arbitrarily long hold and closes deterministically on release for owner and observers.

3. **Reverent Broadsword two-beat martial combo**
   - Beat 1 is a lead-hand forward capsule stab with the free hand using the existing opposing-hand pose.
   - Beat 2 is a lead-hand capsule impalement during a full in-place paper-flip revolution.
   - Both envelopes have zero angular sweep and no root motion. The combo is authoritatively fixed at exactly two beats.
   - Retained render telemetry records the raw requested paper rotation because Phaser normalizes the public container angle into ±π; this lets the live gate prove the complete 2π turn without changing the animation.

4. **Sparkmitt boxer idle**
   - The pose-language registry now includes `boxer-guard`: both hands forward at chin height, a tight movement scale, and planted combat feet.
   - Coyote Trickster's Sparkmitt and its Emberfist sibling both select the shared pose.

## Live-gate design

- The B36 Playwright gate launches the real generated client/server stack only on private ephemeral ports and explicitly rejects `5180` and `2567`.
- It captures every wrap in both facings: full stationary combo, zero displacement, walking during a punch at the `0.75` input-slow ratio, zero `RootMotion` samples, and stable position after the combo.
- It captures Wyrmskull held beyond the legacy 280 ms window and after release, both Broadsword beats plus raw 2π render telemetry, and both boxer-idle weapons in both facings.
- The private training fixtures only expose deterministic evidence receipts; production movement and held-input behavior remain covered through the normal simulation/watchdog paths in unit tests.
- Evidence is written to `docs/owner-notes-audit-v11-evidence/b36-martial-corrections/`.

## Verification

- `pnpm gen` — passed.
- `pnpm gen:check` — passed; generated weapon expansion and all available generated artifacts are in sync.
- `pnpm typecheck` — passed.
- `pnpm build` — passed.
- Focused martial, firing-frame, and Broadsword tests — passed.
- Full `pnpm test` — passed: 189 files, 2,332 tests.
- Private-port B36 full live gate — passed in 6.5 minutes on client/server ports `56730/56729`; neither protected port was used.
- Live movement result — all 10 wrap/facing captures recorded exactly `0 px` stationary displacement, `0 px` post-combo drift, a `0.75` walking input ratio, and `0` root-motion mode samples.
- Live Broadsword result — both facings rendered beat order `0 → 1`, raw rotation `2π`, and `0 px` character travel.
- Evidence inventory — 32 PNGs, `live-gate.json`, and `README.md`.
- `git diff --check` — passed; all changed text files use LF.

## Files touched

- Weapon source/generated data: `data/weapon-concepts-300.json`, `packages/shared/src/weapons-expansion.generated.ts`.
- Shared schema/combo/type surfaces: `packages/shared/src/constants.ts`, `melee.ts`, `state.ts`, and `weapons.ts`.
- Client behavior and tests: `SpriteRig.ts`, `ArenaScene.ts`, firing-frame and pose-language modules, continuity/glove/frame tests, and the new Reverent Broadsword test.
- Server behavior and tests: `GameRoom.ts`, B25/B33 martial coverage, schema metadata pins, boss/progression pins, and watchdog-held-fire coverage.
- Generation and compatibility tests: weapon-expansion generator plus affected schema/data integrity tests.
- Live verification: B13/B25 migrated gates, private stack buffer sizing, the new B36 live gate, and the complete evidence directory.
- Handoff: this implementation report.

VERDICT: displacement removed (5 weapons); desync cause named: authoritative root-motion reconciliation drift; Wyrmskull hold-open; Reverent Broadsword two-beat stab/360-stab; Sparkmitt + Emberfist boxer idle; evidence: docs/owner-notes-audit-v11-evidence/b36-martial-corrections/; files touched: weapon data/generated registry, shared schema/melee/types, server authority/tests, client rig/scene/pose/frame/tests, generator/schema pins, private live gates/helpers, evidence/report.
