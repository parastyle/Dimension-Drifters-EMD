# B33 — commitment-based melee enemies

Implementation owner: Sol `impl-b33-commit-melee`
Branch/worktree: `sol/b33-commit-melee` / `C:/Users/Exped/ddv2-wt/b33-commit-melee`
Owner approval source: chat, 2026-07-24

## Initial inventory and locked implementation design

### Current cone and AI inventory

- `packages/shared/src/enemies.ts`
  - `effectiveMelee()` gives explicit melee definitions to duelists/leapers/shifters and derives a
    single-hit lunge for the `rusher`, `swarm`, and `zoner` contact archetypes.
  - The current derived/explicit definitions preserve each kind's HP, damage, speed, reach, hit count,
    wind-up, recovery, and step distance. B33 will not rebalance those stats.
  - The Wild West `critter` is the shipped wolf rig used by the required live gate.
- `packages/server/src/rooms/GameRoom.ts`
  - Ordinary melee uses `stepDuelists()`. At `MELEE_LOCK_PHASE = 0.65`, it samples a future lunge
    origin/aim, creates `TelegraphState` id `melee:<enemyId>` with `TgShape.Cone`, and later snaps the
    enemy to that origin before `duelistSwing()` calls `inMeleeArc()`.
  - Tough combo melee independently performs the same lock/cone/arc pattern per authored beat through
    `stepComboEnemy()` and `comboSwing()`.
  - The hit therefore depends on the player's position inside the cone at resolve. Walking or strafing
    can leave it, which is the retired behavior.
  - Ordinary melee has no attack-token cap. Tough combo elites already use `duelTokens`, with one
    authored performance per target and an arena-wide `COMBO_MAX_ACTIVE = 4`.
  - Successful parries already feed B26 directional reaction presentation through
    `applyDirectionalParryReaction()`/`parryPresentation`. Legacy melee only receives the full stagger
    on a high parry-chain riposte; B33 will give every parried committed lunge a brief attacker stagger.
  - Enemy death, pit death, transient clearing, and tough-combo recovery already have cleanup seams that
    B33 can extend for ordinary attack tokens.
- `packages/client/src/scenes/ArenaScene.ts` and `packages/client/src/entities/SpriteRig.ts`
  - The client samples `EnemyState.windup`, reconstructs a melee aim, draws a selected full ground
    range/cone tell, and uses the rig's weapon-glint/tell pose. Synced `melee:*` cone rows are rendered
    through the generic floor-telegraph pipeline.
  - `SpriteRig.restTint()` is the existing whole-rig tint authority for downed, ultimate, and Brand
    states. B33 will add the enemy attack tint there; it will not add particles, auras, chains, or radial
    ambience.
- Player movement
  - Server movement currently runs before attack acceptance each fixed tick at full
    `relicMoveSpeed()`, except for stance roots and beam/ultimate-specific multipliers.
  - Authored melee displacement already exists through `pendingWeaponLunges`: explicit weapon lunges,
    combo-step `rootMotion`, and legacy `forwardDrift` all move server-authoritatively.
  - There is no general active-swing input slowdown. Because input movement and pending authored
    displacement are integrated in different phases, they currently stack. B33 will reconcile this to
    the locked replacement rule.

### Token design

- Add a server-private per-target token table:
  `Map<playerId, Set<enemyId>>`.
- `MELEE_ATTACK_TOKEN_CAP = 3` is the single tunable ordinary-melee cap.
- An ordinary melee enemy acquires a token immediately before entering its first wind-up. If all three
  slots on that target are held, it remains in chase/posture behavior and cannot enter attack commit.
- A holder retains its slot across its authored multi-beat ordinary combo, then releases it on final
  impact resolution, cancellation, holder death/pit death, target loss, transient clear, or forced
  parry stagger.
- Tough/shifter elites keep their existing separate budget: one duel performance per target and
  `COMBO_MAX_ACTIVE = 4` arena-wide. They do not consume ordinary slots. This preserves the authored
  one-opponent tough choreography while giving elites a documented independent budget.
- Bosses ignore horde attack tokens and retain authored boss pattern ownership. B33 does not redesign
  boss telegraphs or stationary authored melee arcs.

### Timing and locked-lunge design

- Add one shared `ENEMY_MELEE_COMMIT_SECONDS = 0.2` constant, exactly four 20 Hz server ticks.
- A kind's existing first-hit `windup` and follow-up `swingGap` become its accent-ramp duration. Tough
  combo `windupTicks` likewise remains the personality ramp for that beat.
- At ramp completion the server:
  1. samples the target once;
  2. locks a normalized lunge vector and nav-valid endpoint;
  3. increments an appended `EnemyState.commitSeq` wire edge;
  4. begins exactly four ticks of bounded travel.
- Damage resolves only after those four ticks. Ordinary walking is not consulted as an evasion test.
  The committed target is hit by identity unless a defensive verb is authoritative at impact:
  roll i-frames, parry, airborne jump, or authored player displacement that has carried the target
  beyond the locked reach.
- The floor `melee:*` cone row and the client fallback range/cone drawing are deleted. `atkSeq` remains
  the authoritative impact edge.

### Tint, pop, squash, and SFX pipeline

- Add an explicit shared accent lookup for every melee kind. The Wild West wolf (`critter`) uses a
  hot red accent; Frostfell uses ice cyan, Verdant uses acid/leaf accents, Ashlands uses ember orange,
  Neon-Cyber uses magenta/cyan, and named duelists/shifters receive their own palette accent.
- During wind-up, `EnemyState.windup` remains a 0→1 ramp. `SpriteRig` multiplies every enemy body part
  from neutral white toward the kind accent, preserving the underlying sprite palette.
- The appended `commitSeq` edge triggers one crisp 50–60 ms full-rig white fill plus a small,
  hue-independent anticipation squash. The rig then holds its committed pose while authoritative
  snapshots carry the locked lunge.
- The same edge plays a short per-kind cue selected from shipped sample-backed melee families
  (`melee:light`, `melee:claw`, `melee:blunt`, `melee:heavy`, or `melee:arcane`).

### Player attack movement reconciliation

- Add `PLAYER_ATTACK_INPUT_SPEED_MULT = 0.75`.
- During active attack frames with no authored root motion, input steering runs at 75% of its normal
  speed.
- During an authored lunge/combo root-motion interval, input contribution is zero and the authored
  server displacement replaces it. It never stacks with WASD.
- Server and local prediction will share a small pure movement-policy helper and test the three cases:
  idle/full input, active unauthored swing/75%, authored root motion/0%.

## Element 1 — remove the melee hit cone

Implemented.

- Ordinary and tough melee no longer create `melee:<enemyId>` `TelegraphState` rows.
- `duelistSwing()` and `comboSwing()` no longer call `inMeleeArc()` or select incidental players from
  a spatial sector. Resolution is against the player identity captured at the pop.
- Passive contact damage is disabled for kinds handled by `effectiveMelee()`, so their threat now comes
  only from committed attacks.
- ArenaScene no longer calls its ground range-ring or implement-bracket fallback and treats the generic
  telegraph collection only as authored boss/leap/area geometry.
- Deleted/migrated cone-behavior tests:
  - ordinary fixed-sector/bystander test → four-tick identity lock, walk non-evasion, bystander immunity;
  - tough `Lock=0.65` sector test → per-beat pop/lock/four-tick impact;
  - return-cone placement test → return `commitSeq`, locked return, second parry.
  Catalog `halfArc` values remain unchanged as compatibility data but are no longer ordinary/tough
  melee hit-test inputs. Boss primitives retain their authored tells and arc patterns.

## Element 2 — attack tokens

Implemented.

- `MeleeAttackTokens` owns a per-target holder set plus an O(1) holder-to-target reverse index.
- The ordinary cap is `MELEE_ATTACK_TOKEN_CAP = 3`. A full-budget enemy keeps chasing/posturing in a
  deterministic tangent circle and cannot enter wind-up.
- Ordinary multi-hit enemies hold one token for the whole string. Resolution, target loss, parry
  stagger, holder death/pit retirement, shifter phase-out, player down, and run teardown release it.
- Unit/integration coverage pins cap admission, death release, independent player budgets, target
  teardown, and a six-critter authority case with exactly three wind-ups.
- Tough enemies/shifters retain the independent exclusive-per-target `duelTokens` choreography and
  arena-wide `COMBO_MAX_ACTIVE = 4`; bosses ignore horde tokens.

## Element 3 — two-channel telegraph

Implemented.

- Shared `enemyMeleeAccent()` maps installed melee kinds to palette accents; the Wild West wolf/critter
  ramps toward `0xff4438` red.
- `SpriteRig.restTint()` now applies the enemy's 0→1 multiply tint to all body/head/gear parts.
- Appended `EnemyState.commitSeq` drives a universal one-server-frame white fill and a 5%/8% anticipation
  squash at the ramp boundary. The presentation is hue-independent.
- The same edge selects a short shipped sample-backed cue with `enemyMeleeCommitCue()`:
  light, claw, blunt, heavy, or arcane.
- No particle system, aura, chain, or radial ambience was added.

## Element 4 — fixed commit window and locked lunge

Implemented.

- `ENEMY_MELEE_COMMIT_SECONDS = 0.2` and `ENEMY_MELEE_COMMIT_TICKS = 4` are the sole shared timing
  contract.
- At pop, ordinary/tough authority captures target id, start, nav-validated endpoint, normalized aim,
  original target position, range, and the authored-escape latch. Wind-up may track; commit cannot.
- `lockedLungePointAt()` samples only that immutable segment. Damage occurs on the fourth 50 ms tick.
- Walk/strafe position is intentionally absent from `committedMeleeEvaded()`. Parry, roll i-frames,
  airborne jump, and beyond-reach authored player movement are the accepted answers.
- Every parried committed attacker now enters at least a `PARRY_ENEMY_STAGGER_SECONDS = 0.4` recovery
  through the existing directional reaction/parry machinery.
- Tough combo total impact cadence is preserved: the last four ticks of each existing `windupTicks`
  interval are now the universal commit window. Return tells use the same reservation.

## Element 5 — player attack-slow/root-motion replacement

Implemented.

- Before B33, no general swing slow existed and `stepPendingWeaponLunges()` ran after ordinary input,
  so authored attack displacement stacked with WASD.
- Appended `DualWieldState.attackMoveMode` publishes Normal/InputSlow/RootMotion.
- Active melee frames without authored movement use `PLAYER_ATTACK_INPUT_SPEED_MULT = 0.75`.
- A live authored `pendingWeaponLunge` publishes RootMotion, contributes zero input speed, and remains
  the only attack displacement channel. Roll/dash stance movement keeps its own verb authority.
- `SelfPredictor` consumes the same helper during tick replay and frame preview. Pure, predictor, and
  server attack-root tests cover all three modes.

## Verification and retained evidence

Complete.

- Schema advanced from 37 to 38. All executable schema pins were migrated; the appended fields are
  `EnemyState.commitSeq` and nested `DualWieldState.attackMoveMode`.
- `pnpm gen` — PASS. The generator refreshed its checked muzzle derivation outputs; the unavailable
  art/character measurement notices remained warnings.
- `pnpm gen:check` — PASS.
- `pnpm typecheck` — PASS across shared, server, and client.
- `pnpm test -- --silent --reporter=dot` — PASS, 180 files / 2,272 tests.
- Permanent private live gate
  `e2e/tests/b33-commit-melee-live-gate.spec.ts` — PASS in 2.1 minutes using Vite/Colyseus ports
  `58136`/`58134`. It used `proto-cowboy-hidden-face` and never bound or touched `5180`/`2567`.

### Live receipts

- Walking wolf: ramp sampled at `0.4347826` toward accent `0xff4438`; walking command/ack were both
  sequence `241` before pop; committed lunge resolved after four ticks and damaged the walker. No
  ordinary `melee:*` floor row existed.
- White pop: the real `commitSeq` edge was retained separately from its client render. The PNG records
  fill tint `0xffffff`, fill mode `1`, and anticipation squash. Because Playwright cannot serialize a
  page screenshot inside 50 ms, the already-fired production rig method is locally re-held for 5,000 ms
  for that PNG only, then cleared before the client scene resumes. Server authority is never paused or
  altered by this presentation capture.
- Roll: the exact-pop training fixture invoked the production roll path; the first committed impact
  kept HP unchanged and advanced `dodgedSeq`.
- Parry: the exact-pop training fixture invoked the production parry path; `parriedSeq` advanced,
  packed directional presentation matched the rig reaction, and the attacker received the unit-pinned
  0.4 s stagger.
- Token cap: a six-wolf authority sample contained exactly three ramping holders and three posturing
  non-holders.
- Attack slow: Sparkknuckle's real active tick reported mode `1`, input speed `240` versus normal `320`,
  and actual/projected distances `12`/`16` — exactly `0.75`. The training/dev-only one-shot receipt
  observes the production movement calculation and cannot be armed in production rooms.
- Evidence is retained under `docs/owner-notes-audit-v11-evidence/b33-commit-melee/`: seven PNGs,
  `live-gate.json`, and an instrumentation README.

### Final file inventory

- Shared contract/data: `packages/shared/src/constants.ts`, `enemy-melee.ts`, `enemies.ts`, `index.ts`,
  `state.ts`, and regenerated `weapon-muzzles.generated.ts`.
- Server: `packages/server/src/rooms/GameRoom.ts`, `MeleeAttackTokens.ts`, and the updated/new
  GameRoom, attack-root, boss, progression, and token tests.
- Client: `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/net/prediction.ts`,
  `packages/client/src/scenes/ArenaScene.ts`, and the B33 prediction test.
- Cross-package tests/gate: `tests/enemy-melee.test.ts` and
  `e2e/tests/b33-commit-melee-live-gate.spec.ts`.
- Documentation/evidence: this report, the B33 evidence directory, and the generator-refreshed
  `docs/sol-reports/v7-muzzle-derivation.{json,md}` outputs.

Verdict: cone removed; tokens live (N=3); two-channel telegraph live; fixed window 200 ms; lunge lock live; attack-slow rule live; evidence path docs/owner-notes-audit-v11-evidence/b33-commit-melee/; files touched: shared melee/constants/enemy/state/muzzle contract, GameRoom/token authority and tests, SpriteRig/ArenaScene/prediction and tests, B33 live gate, report/evidence, muzzle derivation outputs.
