# Sol Report — Owner Notes Quickfix

## Understanding

Implement the 2026-07-24 owner-notes quickfix batch in the isolated
`sol/notes-quickfix` worktree without changing unrelated weapons or B20 systems.

The required outcomes are:

1. Archive `x2-glimmerdust-prospector-wand` while retaining its definition and assets.
2. Archive `x2-tumbleweed-flail` while retaining its definition and assets.
3. Remove pump handling from `x2-dustdevil-riotgun` so its support hand remains planted on the
   authored `vertical-foregrip` secondary grip throughout firing in both facings, without stat
   changes.
4. Make every `x2-nullspike-pike` attack deliver three fast authoritative thrust hits while
   keeping nominal DPS within ±10%.
5. Make every `x2-cinderbrand-pike` attack deliver three fast authoritative jab hits while
   keeping nominal DPS within ±10%.
6. Replace `x2-reliquary-lantern-wand` projectile presentation with an element-appropriate
   shipped particle-pack treatment while preserving server authority, damage, cadence, and a
   readable damaging path.

Standing visual bans remain in force: no chains or tassels, no player auras, and no thumbs on
character hands.

## Per-order plan

1. Find and apply the established catalog archive flag/pool-filter precedent; update census tests.
2. Apply the same archive treatment to the flail and verify both definitions/assets remain.
3. Remove only the riotgun's `pump` handling tag; add or update tests proving no pump mechanism
   and a planted authored secondary grip.
4. Verify the existing authoritative melee multi-hit model, configure three tightly spaced
   Nullspike hits, and rebalance per-hit damage so cycle DPS remains within tolerance.
5. Apply the same fast three-hit attack contract to Cinderbrand with its own DPS-preserving
   values.
6. Select a shipped particle factory pack and bind it to the lantern projectile presentation
   without changing projectile gameplay values.

## Verification plan

- Run generation and generated-file checks.
- Run type checking, the full unit test suite, and asset validation.
- Run the live gate on private ephemeral ports only, using `proto-cowboy-hidden-face`.
- Capture evidence for both facings of the planted riotgun foregrip, both triple-hit pikes,
  lantern particle projectiles, and archived-weapon active-pool exclusion under
  `docs/owner-notes-audit-v11-evidence/notes-quickfix/`.
- Commit the completed batch on `sol/notes-quickfix`.

## Order results

### 1. Glimmerdust Prospector Wand archived

- Added the established `archived: true` catalog flag without deleting or changing its definition
  or assets.
- Confirmed the live training active-pool path rejects a dev-equip request for the archived ID.
- Updated the archive and active-pool census from 346 active / 11 archived to 344 active / 13
  archived.

### 2. Tumbleweed Flail archived

- Added the same established `archived: true` catalog flag while retaining its definition and
  assets.
- Confirmed the live training active-pool path rejects a dev-equip request for the archived ID.

### 3. Dustdevil Riotgun de-pumped

- Removed only the `pump` handling tag. Damage, cadence, spread, recoil, and the Wave-4 grip
  coordinates are unchanged.
- Preserved the secondary grip exactly as
  `{ x: 0.8, y: 0.78, role: "vertical-foregrip" }`.
- Unit coverage resolves no handling mechanism and zero handling offset. The private live gate
  sampled the whole accepted fire cycle in both facings: the maximum support-hand/grip delta was
  `0.0000643 px` right and `0.0000642 px` left, with a null mechanism and zero flourish throughout.

### 4. Nullspike Pike fast triple stab

- Added three immutable impact fractions at `0.22`, `0.42`, and `0.62` of one accepted pose.
- Added a shared triple-extension/retraction presentation envelope and three separate server-owned
  forward collision pulses. A coarse server tick crossing multiple pulses still resolves all
  contacts.
- Each pulse deals exactly one third of the prior headline hit, so nominal cycle damage and DPS are
  unchanged rather than merely within the allowed ±10%.
- The live render trace measured three peaks at pose progress `0.2125`, `0.425`, and `0.625`, spanning
  `168.96 ms` inside one accepted attack.

### 5. Cinderbrand Pike fast triple jab

- Applied the same three authoritative impact fractions and DPS-neutral one-third pulse damage.
- The live render trace measured three peaks at pose progress `0.2125`, `0.425`, and `0.625`, spanning
  `179.52 ms` inside one accepted attack.

### 6. Reliquary Lantern Wand particle projectiles

- Routed its caster projectile identity through four frames of the shipped `holy-spark` particle
  pack.
- Removed the ordinary procedural shell/trail/glow from this projectile branch. The particles live
  only on the authoritative projectile container; no player-centered aura is created.
- Server scatter count, spread, speed, range, direct damage, explosion damage/radius, and cooldown
  are unchanged.
- The live factory receipt records four particle frames at exactly the authoritative projectile
  origin (`0 px` origin delta).

## Verification

- `pnpm gen` — passed. The isolated worktree lacks the ignored weapon identity-reference cache, so
  the unrelated VFX-subject registry emitted empty during generation and was restored unchanged.
- `pnpm gen:check` — passed; it explicitly skipped only the unavailable 338-reference cache-backed
  VFX-subject check.
- `pnpm typecheck` — passed.
- Full suite: `pnpm run test -- --maxWorkers=4` — 168 files / 2,242 tests passed. The bounded worker
  count avoids machine-wide CPU oversubscription; no tests were filtered.
- `pnpm assets:check` — passed: 478 sprite entries, 1,007 parts, 320 cards, 24 projectile URLs, and
  96 particle URLs.
- Private live gate:
  `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/tests/owner-notes-quickfix-live-gate.spec.ts`
  — passed on client port `63830` and game port `63828`; neither reserved port was used.
- `git diff --check` — passed.

## Files touched

- Catalog/generation/shared authority:
  `data/weapon-concepts-300.json`, `tools/artkit/gen-weapon-expansion.mjs`,
  `packages/shared/src/weapons-expansion.generated.ts`, `packages/shared/src/weapons.ts`,
  `packages/shared/src/melee.ts`, `packages/shared/src/weapon-resource.ts`.
- Client/server behavior:
  `packages/client/src/entities/SpriteRig.ts`,
  `packages/client/src/vfx/caster-vfx-recipes.ts`,
  `packages/client/src/vfx/caster-vfx.ts`, `packages/server/src/rooms/GameRoom.ts`.
- Unit/census tests:
  `tests/owner-notes-quickfix.test.ts`, `tests/b6-weapon-archives.test.ts`,
  `tests/w4a-weapon-archive.test.ts`, `tests/v61-brutalist-greatswords.test.ts`,
  `tests/v3g-gun-handling.test.ts`, `tests/v3x-auto-rifles.test.ts`,
  `packages/client/src/entities/SpriteRig.ranged.test.ts`,
  `packages/server/src/rooms/GameRoom.b8-pose.test.ts`,
  `packages/server/src/rooms/GameRoom.test.ts`.
- Generated/tool censuses: `tools/portal/index.html`, `tools/weaponsmith/public/index.html`.
- Live gate/report/evidence: `e2e/tests/owner-notes-quickfix-live-gate.spec.ts`, this report, and the
  seven files under `docs/owner-notes-audit-v11-evidence/notes-quickfix/`.

FINAL verdict: 2 archived, riotgun de-pumped, 2 pikes triple, wand particles, evidence path: `docs/owner-notes-audit-v11-evidence/notes-quickfix/`, files touched: 30 files listed above.
