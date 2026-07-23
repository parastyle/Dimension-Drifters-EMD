# B1 amendment — Brimstone Rocket Tube trajectory

## Diagnosis

Owner-note row 404 (`2026-07-23T15:55:06.993Z`) asks why the Brimstone rocket “fly[s] forward then just...dip[s] down just a little bit while still going forward” and whether that is gravity. It is not authored gravity.

`data/weapon-concepts-300.json:8410-8424` defines `x2-brimstone-rocket-tube` with constant `projectileSpeed: 600`, `range: 880`, and the existing explosion payload, but no `arcHeight`, gravity, ballistic, or waveform field. The generated definition likewise has no trajectory override. `packages/server/src/rooms/GameRoom.ts:10713-10714` derives a constant lifetime from range/speed, and `packages/server/src/rooms/GameRoom.ts:13024-13027` advances non-waveform authority with `pr.x += pr.vx * dt` and `pr.y += pr.vy * dt`. A horizontal authoritative shot therefore has constant Y.

The identity-art factory does not bend the flight path: `packages/client/src/scenes/arena/projectile-factory.ts:350-354` only rotates/scales the generated warhead to its velocity, and `packages/client/src/scenes/arena/projectile-factory.ts:371-378` places that payload at the supplied projectile position. The generic cosmetic payload arc at `packages/client/src/scenes/ArenaScene.ts:7226-7232` is gated by `pr.arcHeight > 0`, so it is inactive for Brimstone.

The mismatch is the live-muzzle presentation seam in `packages/client/src/scenes/ArenaScene.ts:6873-6893` plus its later correction in `packages/client/src/scenes/ArenaScene.ts:7165-7182`. The client replaces the synced projectile position with the current rendered muzzle, integrates that independent presentation line for 400 ms, then applies a bounded two-dimensional correction vector toward the authoritative snapshot. Any perpendicular Y component between those two lines becomes a visible curve/dip even though server authority remains linear. Precisely: authority is straight in `GameRoom.ts:13024-13027`; render bends at `ArenaScene.ts:7165-7182`.

## Plan

Keep the amendment catalog-free and scoped to Brimstone. Preserve the existing weapon definition and all damage, range, speed, cadence, explosion, muzzle, and manifest geometry. Add a small pure client trajectory sampler that rebases Brimstone to each newly observed authoritative flight tick and only extrapolates between snapshots along the synced velocity vector. Mark only `x2-brimstone-rocket-tube` for that path, bypassing the live-muzzle convergence offset while leaving authored `arcHeight` and waveform paths untouched.

Add a focused unit test that independently advances the server’s constant-velocity formula for N ticks, feeds those snapshots through the client sampler, proves tick-boundary position equality within tolerance, and proves every between-tick rendered sample has zero cross-track curvature (including constant Y for the owner’s horizontal-shot case). Then run focused tests, `pnpm typecheck`, full `pnpm test`, and LF/diff checks. No data edit is planned, so generation is not expected to be required.

## Implementation and evidence

- Added `packages/client/src/scenes/arena/projectile-trajectory.ts:1-47`. The selector is explicitly limited to `x2-brimstone-rocket-tube` with no authored arc. Its sampler snaps to every newly observed `flightAgeTicks` authority position, then extrapolates only by `(vx, vy) * dt` between snapshots.
- Wired that sampler at `packages/client/src/scenes/ArenaScene.ts:6821-6824`, `packages/client/src/scenes/ArenaScene.ts:6881`, and `packages/client/src/scenes/ArenaScene.ts:7162-7180`. Brimstone retains its existing identity-art factory and muzzle calculation, but its visible flight no longer adopts the separate live-muzzle convergence path. Every other gun, thrown projectile, authored payload arc, and waveform retains the existing path.
- Added `packages/client/src/scenes/arena/projectile-trajectory.test.ts:10-70`. The contract fixture pins damage `14`, speed `600`, range `880`, cadence `0.85`, magazine/reload `2/2.8`, and explosion `220/13`, plus the absence of `arcHeight`. The trajectory fixture advances the independent server formula over 18 ticks and 54 between-tick render samples: tick-boundary X/Y match to 10 decimal places, every continuous sample matches the authoritative formula to 10 decimal places, and horizontal Y remains exactly `640`.
- No catalog/data, generated output, muzzle point, projectile art/geometry, or manifest file changed. Therefore `pnpm gen` and `pnpm gen:check` were not required. The ignored `data/owner-notes.jsonl` authority was read from the primary worktree because isolated worktrees intentionally omit that runtime file.

## Verification

- Focused: `pnpm exec vitest run packages/client/src/scenes/arena/projectile-trajectory.test.ts` — 2/2 passed.
- Type safety: `pnpm typecheck` — passed for shared, client, and server.
- Full gate: `pnpm test` — 154 files, 1,983 tests passed. The first attempt exposed only missing ignored artkit test prerequisites in this isolated worktree; after a local `tools/artkit` dependency install and copying the three ignored prerequisite artifacts from the primary worktree, all nine formerly blocked suites passed focused (36/36) and the unchanged full command passed without exclusions. None of those ignored prerequisites is part of the commit.
- Formatting/LF: focused Biome check passed for both new TypeScript files; `git diff --check` passed; all four touched files contain zero CR bytes.

Verdict: root-cause `packages/client/src/scenes/ArenaScene.ts:6881-6901` plus `:7191-7208` overrode server-linear `packages/server/src/rooms/GameRoom.ts:13025-13026`; minimal fix is the Brimstone-only authoritative tick rebase/velocity extrapolator at `packages/client/src/scenes/arena/projectile-trajectory.ts:18-47`, evidenced by 18-tick/54-frame 10-decimal parity, typecheck, and 1,983/1,983 tests; files touched are `docs/sol-reports/impl-b1-brimstone.md`, `packages/client/src/scenes/ArenaScene.ts`, `packages/client/src/scenes/arena/projectile-trajectory.ts`, and `packages/client/src/scenes/arena/projectile-trajectory.test.ts`.
