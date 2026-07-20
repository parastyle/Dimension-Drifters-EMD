# Hit Registration Panel

Date: 2026-07-20  
Branch: `feat/v0.118-metagame`  
Authority under review: `packages/server`

## Panel ruling

Both reports reproduce in the authoritative simulation. They are registration defects, not damage tuning.

- Melee has two geometry regressions in belt mode: the shared reach omits the two-hand orbit's 22.8 px root-to-grip displacement, and the belt lane rejects a target whose collider clips the blade tip because forward acceptance stops at the target centre (`fx > sw.range`).
- Friendly projectiles against ordinary enemies move before collision and test only their new endpoint. A projectile born inside a collider can leave it during the first 50 ms step without ever producing an overlap. Long muzzle offsets make that deterministic at point blank against large bodies. Worm segments already use a swept capsule and do not have this particular defect.
- No damage constants, scaling, crit, armor, pierce, or cooldown values are to change.

The visual/damage contract is numerical:

1. The solid melee business-end tip and the authoritative centreline endpoint must differ by no more than **0.5 world px**. The shared two-hand orbit displacement is exactly `76 * 0.30 = 22.8 px` at fixed belt weapon scale.
2. Contact around that centreline keeps the existing **21 px** blade half-width. A target clips the tip when its circle is within `targetRadius + 21 px`; this is collision tolerance, not additional painted reach.
3. Belt depth remains the approved player-fairness band: **90 px + target radius**, reduced only by the existing intentional active-dodge multiplier. The boundary is inclusive. Camera zoom and belt projection remain client-only and cannot enter hit math.
4. A gun/cast projectile's authoritative contact for every tick is the swept capsule from its pre-step position to its post-step position, with the existing **10 px** projectile radius. Every friendly projectile receives that swept test on tick one. On the first tick of a gun/cast, the sweep also includes the barrel segment from the authoritative player origin to the muzzle so a muzzle placed inside or past a collider cannot erase a legitimate point-blank shot. Thrown/scatter behavior after tick one is intentionally unchanged.

## 1. Forensics lead: reproduce before theory

### Instrumentation and fixtures

Append-only server tests were added under `GameRoom - hit registration regressions` in `packages/server/src/rooms/GameRoom.test.ts:6818-6986`. They use direct authoritative state and private test-harness access; no client prediction or visual event can satisfy the assertions.

The pre-fix targeted run was:

```text
npx vitest run packages/server/src/rooms/GameRoom.test.ts -t "hit registration regressions"
3 failed, 2 passed
```

Observed reproductions:

- `registers a belt melee edge-of-arc hit at the maximum rendered weapon reach` failed: Stormpetal Odachi hit a stationary dummy at the exact rendered-tip capsule and exact depth-band boundary, but HP remained `100000`.
- `deals full point-blank gun damage when a long muzzle starts inside a colossus collider` failed: Sunbreaker Railgun metadata carried `4.5` damage, but the colossus stayed at `100000` instead of `99995.5`.
- `counts a friendly projectile that spawns inside a collider as a tick-one hit` failed: a `37` damage projectile began overlapping a 170 px colossus and exited on its first step; HP remained `100000` instead of `99963`.

Controls:

- `keeps a from-range projectile as a full-damage control` passed at exactly `37` damage. Damage routing, metadata, and the target are therefore healthy when an endpoint happens to overlap.
- `registers spawn-inside contact against a live multi-segment worm collider` passed. The worm path already sweeps from the projectile's previous position through its current position (`GameRoom.ts:11998`; `BossController.ts:505-528`). Segment armor may reduce applied HP loss, but contact is non-zero at point blank.

This evidence isolates registration. It rules out a global boss immunity, zero weapon damage, a broken `damageEnemy`, and a universal projectile lifecycle failure.

## 2. Geometry auditor: weapon reach truth and belt depth

### Prior art and regression

The prior weapon-reach fix lives in `meleeReach` (`packages/shared/src/weapons.ts:376-391`): it floors authored range at `(1 - gripFrac) * displayLength`. The dagger/claw program's reach law is also explicit: solid business ends stay inside shared reach; target radius and blade half-width are fairness tolerances, not art budget (`docs/dagger-anim-panel/devils-advocate.md`, “Hard guardrails”).

The old fix no longer covers current two-hand orbit presentation. `SpriteRig` places the orbit grip `TARGET_BODY_H * 0.3` from the root (`packages/client/src/entities/SpriteRig.ts:9259-9262`). With `TARGET_BODY_H = 76`, the visible business end can be **22.8 px** beyond `meleeReach`. The existing audit had already identified this exact maximum (`docs/VFX_HITBOX_AUDIT.md`, ML-3); the belt conversion then made the mismatch functional because the server uses the fixed shared reach (`packages/server/src/rooms/GameRoom.ts:7308-7322`).

The belt-specific hit path is a second mismatch. Top-down uses `bladeHitsCircle`, a segment-versus-circle test that includes target radius plus `MELEE_BLADE_HALFWIDTH=21`. Belt mode instead accepts only `fx <= sw.range` (`packages/server/src/rooms/GameRoom.ts:8154-8164`), so even the target's collider edge is discarded when its centre sits beyond the tip. Its broad phase likewise ends at `sw.range` (`GameRoom.ts:8147-8151`).

### Depth-band audit

The suspected too-tight z/depth band is **not** the reproduced cause. `DEPTH_TOL_PLAYER` is 90 (`packages/shared/src/constants.ts:345-351`), and belt melee adds the full target radius (`GameRoom.ts:8161-8164`). The failing test places the target exactly at `90 + targetRadius`, which passes the narrow-phase depth comparison. It still misses because forward reach/broad-phase excludes it.

Ruling: preserve the 90 px depth value. Extend shared two-hand reach by the exact 22.8 px visual root-to-grip offset, and make belt forward broad/narrow phases use the same `targetRadius + 21 px` capsule tolerance as top-down. This is WYSIWYG registration, not a damage or cadence buff.

## 3. Projectile lifecycle analyst: point-blank zero damage

Suspects were evaluated in the ordered mandate.

### (a) Muzzle spawn inside or past the boss collider — confirmed

`fireGun` spawns at `player + aim * gunMuzzleReach` (`packages/server/src/rooms/GameRoom.ts:9819-9876`). The Sunbreaker fixture has 210 px muzzle reach. In the reproduction, the authoritative player is 40 px left of a 170 px-radius colossus; the muzzle is therefore at `bossX + 170`, inside the combined colossus/projectile overlap. The 1,400 px/s shot moves 70 px on the first 50 ms step and lands at `bossX + 240`.

Ordinary-enemy collision sees only that post-step location, so the overlap at spawn is lost. A muzzle that is already past a smaller collider has the same family of defect; including the authoritative player-to-muzzle barrel segment on tick one closes both cases without moving the synced visual spawn.

### (b) Arming delay/grace in ticks or distance — eliminated

Projectile metadata (`packages/server/src/rooms/GameRoom.ts:1039-1068`) contains TTL, damage, side, pierce/hit state, bounce state, crit/source, and delivery. It has no age, arming tick, grace distance, self-hit delay, or minimum travel gate. The friendly hit branch applies damage immediately whenever its collision test succeeds (`GameRoom.ts:11928-11970`). There is no intentional arming mechanic to preserve or retune.

### (c) First-tick collision skipped because integration runs first — confirmed co-root

Pre-fix, `stepProjectiles` snapshotted `projectileFrom`, then immediately integrated `pr.x/pr.y += velocity * dt` (the current lifecycle is at `packages/server/src/rooms/GameRoom.ts:11818-11840`). Ordinary enemies were broad-phased around only `pr.x/pr.y` and tested with endpoint distance. Unlike beams, ultimates, and worm segments, they never tested the swept interval. This is why the from-range control worked while the exiting spawn-inside fixture did not; the corrected broad/narrow branch is now at `GameRoom.ts:11928-11970`.

Ruling: gun/cast projectiles use continuous swept-circle contact every tick. Every friendly delivery receives a swept first-tick test, so spawn overlap is included because a capsule includes both endpoints. First-tick gun/cast collision begins at the authoritative shooter origin and ends at the integrated projectile position; subsequent gun/cast ticks begin at the prior projectile position. Thrown/scatter endpoint behavior after tick one remains unchanged to avoid altering unrelated balance.

### (d) Client visual/server projectile divergence — eliminated as root cause

The failing assertions call the server's `fireGun`/`fireProjectile` and `stepProjectiles` directly. No client projectile exists in the reproduction. Gun damage is created only through the authoritative server projectile path, while the client consumes synced `ProjectileState` rows for presentation. Client timing may make the miss look stranger, but it cannot cause these zero-HP-change failures.

## Implementation and acceptance plan

- Add a shared 22.8 px two-hand orbit reach term to `meleeReach`; both server registration and client reach consumers receive the same truth.
- Expand belt melee forward broad phase and exact test by `target radius + MELEE_BLADE_HALFWIDTH`; keep the 90 px depth band unchanged.
- Use `pointSegmentDistanceSq` over every gun/cast tick sweep and every friendly projectile's first tick; retain the established thrown/scatter endpoint path after tick one.
- Record a first-tick collision origin for muzzle-spawned gun/cast projectiles so the barrel segment cannot jump a point-blank collider. Clear it after the first simulation step. Do not add arming/grace behavior.
- Keep damage values and all damage plumbing unchanged.
- Required validation: targeted regressions, `pnpm typecheck`, then `npx vitest run` with zero new failures over the 1301-green baseline plus the appended tests.

## Post-implementation evidence

- The focused run passes all five appended hit-registration tests, and the existing golden tick digest passes in the same run (`6 passed`).
- The full `GameRoom.test.ts` file passes all **270** tests. This includes exact full-damage assertions for the long-muzzle colossus shot (`4.5`), direct spawn-inside shot (`37`), and from-range control (`37`), plus the live Serraketh multi-segment contact assertion.
- `pnpm typecheck` passes across shared, server, and client.
- The latest full `npx vitest run` executed **1313** tests: **1311 passed / 2 failed**. Both failures were in concurrent head/gear work (`gear-parts.completeness.test.ts` pending-art list and `gear-parts.test.ts` exact floating-point fixture); all 270 authoritative `GameRoom` tests passed. A subsequent isolated recheck shows the floating-point fixture is fixed and only the render-fleet/pending-art completeness check remains. No hit-registration test failed.
- The browser skill found no in-app browser session (`No browser is available`), so the optional point-blank damage-number capture was skipped without starting or disturbing the running dev/render processes.
