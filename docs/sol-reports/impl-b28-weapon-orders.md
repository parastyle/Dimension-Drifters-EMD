# B28 — Weapon owner orders

Branch: `sol/b28-weapon-orders`

Evidence target: `docs/owner-notes-audit-v11-evidence/b28-weapon-orders/`

## Initial system map and implementation plan

The ten orders cross four existing data/presentation paths:

1. Curated Weaponsmith suites are authored in `tools/weaponsmith/assignments/*.json`, aggregated into
   `tools/weaponsmith/assignments.json`, and baked with `tools/artkit/weapon-vfx-overrides.json` into
   `packages/client/src/vfx/weapon-vfx.generated.ts`.
2. Expansion weapon stats, behavior, grip points, performance, recipes, and archive state are authored in
   `data/weapon-concepts-300.json`, validated by `tools/artkit/gen-weapon-expansion.mjs`, and emitted into
   `packages/shared/src/weapons-expansion.generated.ts`. `WeaponDef.archived` already drives active-catalog,
   acquisition, drop, Testing Grounds, portal, and Weaponsmith exclusion while retaining save-safe identity.
3. Thrown payload orientation is resolved from shared weapon behavior and rendered in the projectile
   factory/update path. The current policies are `spin` and `point-forward`; B28 will add a declarative
   `barrel-roll` policy whose heading remains velocity-aligned while the art paper-mirrors around its long
   axis.
4. Dustreaper's generated-image fire dragon currently spawns at the actor root and sweeps through the
   weapon's damage envelope. The retained blade-extension system already exposes the final held-blade
   affine after all pose/facing transforms. B28 will consume that sampled affine for a multiplier-1 overlay
   without adding extension reach.

No synced state field is planned, so no network schema bump is required. If implementation proves a synced
field unavoidable, the bump will be from the then-current `SCHEMA_VERSION` and every numeric pin will move
with it.

## Pre-cut VFX inventory

### `drift-greatkatana-tempest-regent`

Current enabled Weaponsmith layers:

- `edge-trail` — gold storm edge, reach `1.46`, colour `0.15`, length `1.22`.
- `arc-bolt` — gold jagged bolt, colour `0.15`, jaggedness `0.34`.
- `aura-pulse` — two gold pulse rings centered on the wielder.
- `painted-impact` — paint family `3`, nine impact pieces at size `0.92`.

Plan: keep only `edge-trail` as the single coherent gold tempest-edge treatment. Remove `arc-bolt`,
`aura-pulse`, and `painted-impact`. This also removes the player-centered aura and scattered impact pattern;
no ambient/radial fallback layer will replace them.

### `drift-nodachi-gatebreaker`

Current enabled Weaponsmith layers:

- `slash-arc` — hot breaker arc, reach `1.16`, width `8`, colour `0.1`.
- `edge-trail` — second overlapping edge path, reach `1.28`, colour `0.1`, length `0.62`.
- `cleave-flash` — impact flash at intensity `0.9`.
- `hit-spark` — 34-hit spark burst, colour `0.1`.

Plan: keep the stronger `slash-arc` set only. Remove the overlapping `edge-trail` set plus
`cleave-flash` and `hit-spark`, so the weapon emits one readable breaker arc rather than two path
treatments and a second impact treatment.

### `x2-thunderhead-voulge`

Current layers/paths:

- Large generated blue image layer:
  `packages/client/public/vfx/weapons/v7/thunderhead-voulge-blue-effect.png`, registered by
  `tools/artkit/weapon-vfx-overrides.json` as painted swing `b10:thunderhead-voulge-blue`, sized to the
  full 230 px melee envelope.
- Catalog recipe:
  `thunderhead-electric-codex`, a blade-emitted painted-swing recipe that selects that large image layer.
- Electricity:
  authoritative `chainLightning` behavior with four jumps, 200 px jump range, 6 primary chain damage, and
  `0.8` falloff; client chain rendering follows this behavior independently of the painted swing image.

Plan: remove the large painted-swing override and its catalog recipe/emitter/timing fields. Keep the
chain-lightning behavior and its electric rendering unchanged. No generic swing or radial fallback is added.

## Per-order plan and progress

1. `drift-greatkatana-tempest-regent` — **planned**. Reduce four enabled layers to the one
   blade-following gold `edge-trail`; document the three removals in this report and pin the exact suite in
   focused tests.
2. `drift-nodachi-gatebreaker` — **planned**. Keep the stronger `slash-arc`; remove the overlapping
   `edge-trail`, `cleave-flash`, and `hit-spark`; test that exactly one layer remains.
3. `twin-bowie-fangs` — **planned**. Double `displayLength` from `62` to `124` and preserve the old
   `62` collision length so the order remains render-only. Do not alter dual-wield/off-hand rig code.
4. `x2-thunderhead-voulge` — **planned**. Delete the large blue painted image treatment and its explicit
   recipe fields while preserving the shock chain behavior/electricity.
5. `x2-sidewinder-spontoon` — **planned**. Add explicit thrown rotation policy `barrel-roll`; keep the
   projectile long axis on `atan2(vy, vx)` and apply a periodic signed paper-flip scale on its normal axis.
   Add shared policy and client transform tests without touching shuriken/chakram/kunai paths.
6. `x2-venomtongue-trident` — **planned**. Author a two-times lunge through the existing delayed
   nav-validated weapon-lunge path. Pin both displacement and collision timing so the hit envelope is
   resolved from the authoritative post-lunge player position.
7. `x2-squeaky-mallet` — **planned**. Increase `displayLength` by 33% from `116` to `154.28`, retaining
   `collisionLength: 90`. Move both normalized grip anchors from below the handle to opaque handle pixels
   centered near `y=0.55`, with primary and secondary contacts separated along the wrapped/wooden haft.
8. `x2-boomerang-boot` — **planned**. Set canonical `archived: true`; migrate archive census pins and add
   a direct assertion that it is absent from active catalog, curated cycle, drop/acquisition, and pack-facing
   pools while its canonical/resource identity remains resolvable.
9. `x2-dustreaper-zweihander` — **planned**. Re-register the fire-dragon image from actor-root sweep to
   the live held-blade affine. Draw from physical blade root to tip at an overlay multiplier of `1`, follow
   every pose/facing frame, and leave `meleeDamageEnvelopeFor` equal to the base sword envelope.
10. `x2-buckshot-bramble-bow` — **planned**. Change the simultaneous gun volley from six projectiles at
    4 damage to three projectiles at 8 damage. Total nominal volley damage remains `24` and nominal DPS is
    unchanged.

## Verification plan

- Focused unit tests will pin all ten orders, VFX layer inventories, render/collision separation, archive
  exclusion, barrel-roll transform, nav-clamped lunge/hit origin, held-blade overlay registration, and
  three-arrow DPS invariance.
- Run `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, full `pnpm test`, and `pnpm assets:check`.
- Run the real client/server live gate only on private ephemeral ports, never `5180` or `2567`, using
  `proto-cowboy-hidden-face`.
- Fire all nine surviving weapons facing right and left; capture visual and runtime evidence for every
  order and prove the boot is absent from active and pack pools under
  `docs/owner-notes-audit-v11-evidence/b28-weapon-orders/`.

## Incremental implementation log

### Source and focused-test pass

1. `drift-greatkatana-tempest-regent` — **implemented**. The generated suite contains only
   `edge-trail`. Removed `arc-bolt`, player-centered `aura-pulse`, and `painted-impact`; the assignment
   note records the cut and no fallback was added.
2. `drift-nodachi-gatebreaker` — **implemented**. The generated suite contains only the stronger
   `slash-arc`. Removed the overlapping `edge-trail`, `cleave-flash`, and `hit-spark`.
3. `twin-bowie-fangs` — **implemented**. `displayLength` is `124` (exactly `62 × 2`) with
   `collisionLength: 62`; no composed-pairing or off-hand path changed.
4. `x2-thunderhead-voulge` — **implemented**. Removed the blue painted-swing override and
   `thunderhead-electric-codex` recipe. `suppressVfx: true` closes the generic fallback path, while the
   authoritative four-jump electric chain remains at 200 px, 6 damage, and 0.8 falloff.
5. `x2-sidewinder-spontoon` — **implemented**. New `barrel-roll` policy holds rotation to projectile
   velocity and applies a signed cosine paper mirror-turn on the normal axis. Right/left pure-transform
   tests pass.
6. `x2-venomtongue-trident` — **implemented**. Authored a 128 px, 0.28 s destination-impact lunge.
   Server authority test proves one nav validation, a full 128 px endpoint, delayed collision, and the
   melee swing origin moving to that endpoint.
7. `x2-squeaky-mallet` — **implemented**. `displayLength` is `154.28` (`116 × 1.33`) while
   `collisionLength` stays `90`; both grip contacts are pinned along the painted handle at
   `(0.14, 0.55)` and `(0.38, 0.55)`.
8. `x2-boomerang-boot` — **implemented**. Canonical `archived: true` moves the census to 342 active /
   15 archived and 313 active expansion rows. Focused tests prove absence from active, drop, selectable,
   and weapon booster-pack candidates while retaining its durable catalog definition.
9. `x2-dustreaper-zweihander` — **implemented**. The fire-dragon recipe now declares held-blade
   `lengthMultiplier: 1` and `widthMultiplier: 1`; rendering samples the rig's final blade affine every
   frame from physical root to tip in either facing. The old 300 × 54 damage override is removed, so
   maximum reach/width equal the base sword envelope.
10. `x2-buckshot-bramble-bow` — **implemented**. The volley is three arrows at 8 damage each instead
    of six at 4; total shot damage remains 24 and nominal DPS remains exactly unchanged.

Focused result: 3 files / 15 assertions green (`b28-weapon-orders`, barrel-roll transform, and
nav-authoritative Venomtongue lunge). `pnpm gen` completed successfully with 342 active portal weapons.

### Live gate

- Ran the real client/server stack on private ports `64430` (Vite) and `64429` (Colyseus) with
  `proto-cowboy-hidden-face`; this B28 gate never used `5180` or `2567`.
- Fired all nine surviving weapons facing right and left: 18 accepted authoritative attacks.
- The captured receipts prove the two one-layer suites, doubled Fangs render length, electric-only Voulge,
  path-aligned positive/negative Spontoon paper turns, 128 px Trident endpoint, enlarged two-handle Mallet,
  sub-pixel Dustreaper blade-tip attachment with base `234.4` damage reach, and three-arrow Bramble volley.
- Direct `devEquip` of `x2-boomerang-boot` was rejected. Static pool tests also prove exclusion from active,
  drop, selectable, and weapon booster-pack pools.
- Evidence is under `docs/owner-notes-audit-v11-evidence/b28-weapon-orders/`: 18 screenshots,
  `live-gate.json`, `live-gate-summary.md`, and the evidence README. Both private listeners were stopped
  after capture; unrelated processes were untouched.

### Final verification

- `pnpm gen` — PASS; 342 active weapons generated.
- `pnpm gen:check` — PASS. The pre-existing unavailable-art/character-measurement notices remained
  warnings, not drift.
- `pnpm typecheck` — PASS across shared, client, and server.
- `pnpm test -- --silent --reporter=dot` — PASS, 177 files / 2,261 tests.
- `pnpm assets:check` — PASS, 478 sprite entries / 1,007 parts, 635 atlas frames, and 320 cards.
- No synced field was added, so the current network schema and every schema pin remain unchanged.

### Files touched

The final change set contains 60 files: 35 existing authored/generated/runtime/test files, four new
report/test/live-harness files, and 21 live-evidence files (18 PNGs plus the README, JSON receipt, and
summary). Runtime work is limited to shared weapon metadata/geometry, thrown projectile rendering,
generated-image held-blade registration, weapon VFX resolution, and the existing authoritative lunge
path. No dual-wield/off-hand, shuriken/chakram/kunai/revolver-hammer, kung-fu, parry, fan, chest/pack,
character, or pet implementation surface was changed.

verdict: 10 orders done (drift-greatkatana-tempest-regent, drift-nodachi-gatebreaker, twin-bowie-fangs, x2-thunderhead-voulge, x2-sidewinder-spontoon, x2-venomtongue-trident, x2-squeaky-mallet, x2-boomerang-boot, x2-dustreaper-zweihander, x2-buckshot-bramble-bow), boot archived, evidence path docs/owner-notes-audit-v11-evidence/b28-weapon-orders/, files touched: 60 (35 existing source/generated/test files; 4 new report/test/live-harness files; 21 evidence files).
