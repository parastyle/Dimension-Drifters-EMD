# B7 thrown conversion implementation

## Schema understanding and plan

The canonical catalog pattern uses `behavior.kind: "thrown"` with projectile `speed`, `range`,
`damage`, `charges`, `refillSeconds`, and `pierce`, plus `performance.hold: "steady"`,
`performance.action: "throw-release"`, `performance.suppressSwing: true`, and a carry angle.
Thrown nominal sustained DPS is computed as `damage * charges / refillSeconds`; conversions will
retain each source weapon's pre-change nominal DPS within 1%. Sidewinder Spontoon and Stormcrow
Twin-Hatchets will reuse their own held sprite as the projectile. Boothook Harpoon will retain its
existing thrown behavior, speed, and no-spin setting while receiving an over-the-shoulder carry pose.

Per-weapon plan:

1. Read the B7 owner notes and compute Sidewinder's existing sustained DPS, then select plausible
   thrown speed/range/charges/refill/damage values that preserve it.
2. Compute Stormcrow's existing sustained DPS and convert it likewise, retaining its electric/chain
   on-hit semantics only if the existing thrown schema expresses them cleanly.
3. Adjust only Boothook's performance pose data, preserving its existing thrown behavior, speed,
   and zero-spin requirement.
4. Generate derived data and add focused built-`@dd/shared` unit coverage, including encoded
   pre-change DPS constants and any mechanically necessary delivery-lane census updates.

## DPS math

For each conversion, the invariant is:

`pre-change sustained DPS = post-change damage * charges / refillSeconds`

## Incremental implementation log

- Sidewinder Spontoon complete: `edge` base DPS was `7 / 0.32 = 21.875`; the own-sprite thrown payload is `14 * 3 / 1.92 = 21.875` DPS (720 px/s, 600 px range, 2 pierce), with the canonical steady `throw-release`/suppressed-swing performance.
- Stormcrow Twin-Hatchets complete: `chainLightning` base cadence DPS was `5 / 0.30 = 16.6667`; the own-sprite thrown payload is `8 * 4 / 1.92 = 16.6667` DPS (700 px/s, 560 px range, 2 pierce), with matching throw-release performance. Follow-up: the catalog accepts only one behavior discriminator, and the authoritative projectile-chain path currently requires `weapon.gun`, so thrown chain-on-hit cannot be retained without a broader behavior/server change; the weapon retains its shock element identity.
- Boothook Harpoon complete: behavior remains thrown at 760 px/s and `12 * 3 / 1.8 = 20` DPS; performance now carries at -1.2217 rad with a 28 px over-shoulder release lift, while zero pre-throw revolutions and point-forward flight preserve the no-spin requirement.

The frozen Drive delivery census changed mechanically from melee 173 / thrown 24 to melee 171 / thrown 26; gun 118, cast 2, beam 22, and zone 4 are unchanged.

The expansion-source behavior census changed from edge 60 / thrown 22 / chain-lightning 18 to edge 59 / thrown 24 / chain-lightning 17.

## Verification

- `pnpm gen`: passed after installing the ArtKit's locked local dependencies; unrelated missing-reference-art churn was discarded.
- `pnpm gen:check`: passed; its documented isolated-worktree skips reported 324 unavailable untracked weapon references and 43 unavailable untracked character sprite-part references.
- `pnpm assets:check`: passed (426 sprite entries / 781 parts, 24 projectile URLs).
- `pnpm typecheck`: passed for shared, client, and server.
- Focused B7/census/server rerun: 13/13 tests passed across `b7-thrown.test.ts`, `weapon-resource.test.ts`, and `GameRoom.v6m.test.ts`.
- Full `pnpm test`: run after the census correction; 144/146 test files and 1838/1839 tests passed. The only remaining failures are the isolated-worktree's pre-existing ignored-art fixture gaps: missing `tools/artkit/out/orientation/weapon-axis-report.json` and missing Dust Ranger/Dummy Weaponsmith preview images. All GameRoom/server and B7 tests passed. No live server, Vite, Playwright, or ephemeral stack was started.

VERDICT: IMPLEMENTATION PASS (full suite fixture-limited) — Sidewinder Spontoon: edge 21.875 DPS -> thrown 21.875 DPS; Stormcrow Twin-Hatchets: chainLightning base 16.6667 DPS -> thrown 16.6667 DPS, shock retained and thrown-chain-on-hit documented as follow-up; Boothook Harpoon: thrown 20 DPS -> thrown 20 DPS with 760 speed, over-shoulder -1.2217 rad/28 px release, and no spin; census: expansion edge 60->59, thrown 22->24, chainLightning 18->17, built Drive melee 173->171 and thrown 24->26; files touched: data/weapon-concepts-300.json, packages/shared/src/weapons-expansion.generated.ts, tools/portal/index.html, tests/b7-thrown.test.ts, tests/weapon-resource.test.ts, docs/sol-reports/impl-b7-thrown-v3.md.
