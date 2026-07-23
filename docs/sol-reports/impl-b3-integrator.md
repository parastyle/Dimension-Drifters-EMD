# B3 Catalog Integrator — Fan Projectile Hybrids

## Understanding

This branch owns the catalog and runtime integration for the three shipped B3 fan assets. Each fan is a two-handed, fan-forward melee weapon whose accepted authored combo beat must retain normal authoritative close-range melee resolution and additionally spawn a real server-owned projectile. Client VFX are presentation only; projectile creation, travel, collision, and damage remain authoritative on the server.

The integration will preserve B2, whole-art characters, B17 pose-language schema, and pets. Fan art will use its reported native dimensions, a leading-edge muzzle, static painted ribbon guards, and no standing chain, tassel, or rope.

## Per-weapon behavior signatures

### Iron War Fan (`x2-iron-war-fan`)

- Rigid steel-blade close melee combo.
- Only the accepted third-hit finisher emits its hybrid projectile.
- Projectile signature: short, narrow, forward cutting gust spawned from the fan leading edge after the close swing lands.
- Target sustained profile: approximately 15 melee DPS plus 5 projectile DPS.

### Ember Fan (`x2-ember-fan`)

- Close sweeping melee combo.
- Each accepted authored release beat emits its hybrid projectile coincident with the sweep.
- Projectile signature: short cinder-blade cone made from several small authoritative ember shards spread from the fan leading edge.
- Target sustained profile: approximately 15 melee DPS plus 5 projectile DPS.

### Storm Fan (`x2-storm-fan`)

- Crossed-fan paired-X melee strike.
- The accepted crossed strike emits its hybrid projectile in the same authored beat.
- Projectile signature: narrow authoritative slash arc that travels outward, reverses after roughly 250–350 ms, and returns toward its owning player.
- Target sustained profile: approximately 15 melee DPS plus 5 projectile DPS.

## Plan

1. Trace the shipped B2 catalog, pose, muzzle, VFX, authoritative projectile, and test patterns.
2. Add the three catalog concepts, exact sprite manifest entries, and leading-edge muzzle definitions.
3. Add shared hybrid-combo metadata and server execution for finisher gust, cone shards, and returning arc.
4. Add distinct client VFX recipes and catalog/runtime coverage, including visible texture alpha bounds and DPS assertions.
5. Run generation checks, typecheck, full tests, and asset validation.
6. Exercise every fan on private ephemeral live-gate ports and retain melee plus projectile event evidence.
7. Append implementation and proof per weapon, record the 332 → 335 census, commit the branch, and finish with the required verdict line.

## Implemented weapons

### Iron War Fan (`x2-iron-war-fan`)

- Cataloged as a `2H`, medium, close-range `war-fan` with the B17 `secondary-grip` idle and `combat-plant` feet. The pose classifier intentionally maps the fan family into the existing two-hand sword grammar; the B17 schema itself is unchanged.
- The three-step `arc/iron-war-fan-threefold` chain deals a normal authoritative `12`-damage, `90 px` melee cut on every accepted beat. Only the accepted third step schedules the hybrid payload at that swing's authored impact.
- The finisher spawns one `12`-damage, `760 px/s`, `180 px` narrow cutting gust from source pixel `(246, 172)` on the native `247 x 256` fan art.
- Client treatment is the thin steel `iron-gust` projectile with an `iron-gust-fray` impact. The runtime gives point-blank hybrid rows one replicated muzzle patch before collision, so the server-owned hit remains visible instead of being created and consumed between patches.
- Nominal sustained profile: `12 / 0.8 = 15.00` melee DPS plus `12 / (3 * 0.8) = 5.00` projectile DPS, `20.00` combined.
- Private live proof: three accepted beats produced three melee receipts totaling `9.945` scaled live damage; the third beat then produced a separate HybridProjectile receipt for `3.315` scaled live damage against the same dummy, four server ticks after its paired melee receipt.

### Ember Fan (`x2-ember-fan`)

- Cataloged as a `2H`, medium, close-range `war-fan` with `secondary-grip` / `combat-plant` fan-forward posture.
- Every step of `arc/ember-fan-cinder-sweeps` retains its authoritative `12`-damage, `88 px` melee sweep and schedules three real server projectiles at the authored impact.
- The `4`-damage payload is split across three `620 px/s` cinder shards in a `0.34 rad` short cone from source pixel `(255, 151)` on the native `256 x 215` art. Each shard owns its own server collision row and damage receipt.
- Client treatment is the triangular `ember-shard-trail` projectile with an `ember-chip-burst` impact, visually and mechanically separate from the steel gust and storm arc.
- Nominal sustained profile: `12 / 0.8 = 15.00` melee DPS plus `4 / 0.8 = 5.00` projectile DPS, `20.00` combined.
- Private live proof: one accepted sweep produced one melee receipt for `6.630` scaled live damage and three separate HybridProjectile shard receipts totaling `1.4733` scaled live damage against that same dummy; the first shard receipt followed the melee by four server ticks.

### Storm Fan (`x2-storm-fan`)

- Cataloged as a `2H`, large, close-range `paired-war-fan` with the crossed-fan `secondary-grip` idle and a `wide-plant`.
- Every accepted `arc/storm-fan-crossed-return` X-strike retains its authoritative `12`-damage, `92 px` melee hit and launches one real returning projectile from source pixel `(383, 99)` on the native `384 x 224` paired-fan art.
- The narrow arc travels at `700 px/s`, reverses after the authored `0.300 s`, clears and re-arms its hit ledger, and steers back to its living owner. It deals `2` damage on each eligible leg.
- Client treatment is the nested electric `storm-returning-arc` with a folding `storm-arc-fold` impact; live projectile samples prove the velocity-vector reversal.
- Nominal sustained profile: `12 / 0.8 = 15.00` melee DPS plus two `2`-damage contacts per `0.8 s = 5.00` projectile DPS, `20.00` combined.
- Private live proof: one accepted crossed strike produced one melee receipt for `3.315` scaled live damage and two HybridProjectile receipts totaling `1.105` scaled live damage against the same dummy. The first projectile receipt followed the melee by three server ticks, and four projectile samples proved the return-leg velocity reversal.

## Shared authority and presentation

- `HybridProjectileDef` is a generated/shared weapon contract with a distinct style, trigger (`each-swing` or `combo-finisher`), combo length, count, spread, speed, range, damage, pierce, scaling, and optional return time.
- `CombatDelivery.HybridProjectile = 14` is append-only wire identity. Server receipts therefore distinguish the hybrid hit from `CombatDelivery.Melee = 1`; the projectile is never inferred from VFX.
- Accepted solo fan inputs pass through the existing server-owned combo tracker. `resolveSwing` always creates the normal swept melee edge, while its authored step/impact epoch schedules the fan payload. The payload then enters the shared friendly projectile collision rail from the painted leading-edge muzzle.
- Hybrid damage participates in shared damage-source, resource, loot-power, pair-power, and DPS calculations. The Iron finisher contribution is amortized over three accepted beats; Ember and Storm apply on every accepted beat.
- All three concepts specify static painted ribbon guards. No standing chain, tassel, rope, dangling simulation, whole-art character, B2 weapon, pet, or B17 schema change was introduced.

## Catalog, art, and behavior census

| Weapon | Native art | Leading-edge muzzle | Authoritative signature | Nominal DPS |
| --- | ---: | ---: | --- | ---: |
| Iron War Fan | `247 x 256` | `(246, 172)` | third melee finisher → one cutting gust | `15 + 5 = 20` |
| Ember Fan | `256 x 215` | `(255, 151)` | every melee sweep → three-shard cinder cone | `15 + 5 = 20` |
| Storm Fan | `384 x 224` | `(383, 99)` | every crossed melee strike → 300 ms returning arc | `15 + 5 = 20` |

- Requested owner-ledger census: `332 → 335`.
- This isolated branch actually began with `331` concept rows and now contains `334`; generated expansion definitions are `332`. This preserves the requested exact `+3` delta without inventing a missing pre-existing row.
- Durable runtime catalog: `350 → 353`; active runtime catalog/gallery: `339 → 342`; active expansion rows: `310 → 313`; archived rows remain unchanged.
- Delivery census: `175 melee`, `27 thrown`, `121 gun`, `3 cast`, `23 beam`, and `4 zone`.
- Catalog tests prove three active expansion rows, distinct serialized mechanics/VFX, exact native dimensions, existing textures, non-empty visible alpha bounds, authored leading-edge muzzles, B17 pose participation, standing-element bans, and the `15 + 5 ≈ 20` nominal DPS target.

## Verification and retained evidence

- `pnpm gen`: passed; expansion, muzzle, dimension, card, projectile, Weaponsmith, VFX, and portal outputs regenerated.
- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed for shared, server, and client.
- `pnpm test`: passed, `159` files / `2,016` tests.
- `pnpm assets:check`: passed, including all three new textures and alpha-bound checks.
- `pnpm e2e -- e2e/tests/b3-fan-hybrid-live-gate.spec.ts`: passed against the real client/server stack on private ephemeral ports `62474` (client) and `62473` (game); reserved ports `5180` and `2567` were never used, and the stack shut down afterward.
- Live assertions prove three captures, three distinct signatures, positive melee plus positive HybridProjectile damage on the same planted dummy, melee receipt ordering before projectile receipt, distinct projectile/impact VFX, and Storm's return leg.
- Evidence: `docs/owner-notes-audit-v10-evidence/b3-fan-hybrids/live-gate.json` plus one labeled PNG per fan in the same directory.
- `git diff --check`: passed.

## Files touched

- Catalog/generation: `data/weapon-concepts-300.json`, `data/weapon-muzzle-overrides.json`, expansion/muzzle generators and generated outputs, muzzle derivation reports, portal and Weaponsmith census outputs.
- Shared/server: `packages/shared/src/combat.ts`, `weapons.ts`, resource/loot power consumers, generated weapon/muzzle data, `packages/server/src/rooms/GameRoom.ts`, and authority/census tests.
- Client: sprite manifest, B17 family routing in `pose-language.ts`, `ArenaScene`, and the fan hybrid VFX recipe/renderer/test files.
- Acceptance/evidence: `tests/b3-fan-hybrids.test.ts`, `e2e/tests/b3-fan-hybrid-live-gate.spec.ts`, three live PNGs, `live-gate.json`, census/invariance updates, and this report.

VERDICT: 3 wired, 3 distinct hybrid signatures, melee + authoritative projectile proof per weapon, DPS ballpark `15 melee + 5 projectile = 20` each, evidence path `docs/owner-notes-audit-v10-evidence/b3-fan-hybrids/`, files touched catalog/generator/shared/server/client/VFX/tests/e2e/report, weapon-count census `332 → 335` (requested ledger; isolated worktree observed concepts `331 → 334`, durable runtime `350 → 353`, active runtime `339 → 342`).
