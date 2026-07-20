# Weapons armory audit

Audit run: 2026-07-19 EDT on `feat/v0.118-metagame`  
Surfaces: game `http://localhost:5180`, Colyseus `ws://localhost:2567`, Weaponsmith `http://localhost:5050`  
Method: headless Playwright against the running game and tool, using physical keyboard/mouse input for gameplay actions. Runtime probes recorded the decoded Colyseus row, the live `SpriteRig`, attack sequence, VFX pools, damage-number renderer, flourish channels, console errors, and page errors.

## Result

The catalog, deep links, weapon art, attack path, VFX, damage numbers, drift-katana stances, exact pickup path, and Weaponsmith catalog/status/edit flow pass. Two game defects remain: dual-wield is accepted by server state but is never rendered by the arena client (3/3 sampled pairs), and the incoming draw flourish is absent for two of the 16 interaction samples. No game code was changed.

One small Weaponsmith-only 404 was fixed: the combined preview referenced two actor sheets that do not exist. The URLs now point at the existing Dust Ranger and Dummy sheets, with an append-only regression test.

## Pass/fail matrix

| Category | Result | Evidence |
| --- | --- | --- |
| Shared catalog/API cardinality | **PASS — 326/326** | 119 melee, 108 ranged, 99 caster; no missing or extra IDs |
| `?dev=weapon:<id>` resolution | **PASS — 326/326** | Every route reached active Testing Grounds with `player.weapon` and `rig.heldWeaponDef(0)` equal to the requested ID |
| Deep-link console/page errors | **PASS — 326/326 clean** | No console error or uncaught page error on any final row |
| Weapon sprite alpha | **PASS — 326/326 non-blank** | Exact live Phaser texture frame sampled down to 64x64; every weapon had non-zero opaque pixels |
| Visual sample | **PASS — 16/16** | Two weapons per class plus all ten `drift-*` katanas manually reviewed from screenshots |
| Attack input dispatch | **PASS — 16/16** | Physical RMB emitted `attack`; server `attackSeq` advanced |
| Attack VFX | **PASS — 16/16** | Swing, projectile, beam, or muzzle activity observed as appropriate |
| Damage numbers | **PASS — 16/16** | `DamageNumberRenderer.add` and a live number observed after attacks |
| Stance / size class | **PASS — 16/16** | Runtime pose captured for all samples; all ten drift katanas matched authored `sizeClass` |
| Great/colossal katana tip-drag | **PASS — 3/3** | Both great katanas and the colossal odachi had the expected reversed/downward resting blade delta |
| Flourish stow + draw | **FAIL — 14/16** | All ten drift katanas pass; Hailshot Hand Maul and Codex of Forked Tongues stow but never enter incoming draw |
| `T` then exact pickup | **PASS — 1/1** | `T` entered Testing Grounds; physical `E` sent the selected `pickupId`; held weapon exactly matched that pickup |
| Weaponsmith listing | **PASS — 326/326** | API and shared catalog sets match exactly |
| Weaponsmith status truth | **PASS — 326/326** | 18 bespoke-file, 295 generated-default, 13 none; zero mismatches against `tools/weaponsmith/assignments/` |
| Weaponsmith filters | **PASS — 4/4** | Bespoke/generated/none filters and `drift-katana` search returned the exact expected sets |
| Weaponsmith bespoke edit | **PASS — 1/1** | `driftblade` loaded its assignment, form, engine preview, combined preview, and Save flow |
| Dual-wield server bind | **PASS — 3/3** | Nested `player.dualWield?.offhandSlot` became `1` and both exact slot identities were present |
| Dual-wield render / stance | **FAIL — 0/3** | Rig held only the lead weapon; no off-hand image or off-hand pose family, with no console error |

## Catalog integrity and visual sample

The sweep performed a fresh real page load for every catalog ID. A row passed only when the canvas was ready, Arena was active in `training` mode, the decoded player and live rig both held the requested ID, its exact texture frame contained opaque pixels, and console/page-error capture was empty.

Four rows initially overlapped live Vite/Colyseus source restarts (`x2-hollow-harvest`, `x2-frostbite-volley-gun`, `x2-rustwidow-pump-rifle`, and `x2-glasswidow-punchgun`). Each passed its first isolated retry. Ten rows recorded aborted navigation/HMR requests during the concurrent rebuilds, so the raw `networkClean` diagnostic is 316/326; these were request aborts rather than HTTP error responses and did not produce a console/page error or a final load failure. Final product result: **326/326 route-clean and 326/326 sprite-nonblank**.

Raw evidence:

- [`catalog-sweep-summary.json`](../../tools/artkit/out/audit-armory/catalog-sweep-summary.json)
- [`catalog-sweep.json`](../../tools/artkit/out/audit-armory/catalog-sweep.json)

Class sample screenshots:

| Class | Samples |
| --- | --- |
| Melee | [`gravediggers-spade`](../../tools/artkit/out/audit-armory/combat-gravediggers-spade.png), [`x2-sandsong-saber`](../../tools/artkit/out/audit-armory/combat-x2-sandsong-saber.png) |
| Ranged | [`x-gun-revolver-cannon`](../../tools/artkit/out/audit-armory/combat-x-gun-revolver-cannon.png), [`x2-hailshot-hand-maul`](../../tools/artkit/out/audit-armory/combat-x2-hailshot-hand-maul.png) |
| Caster | [`x-staff-arcane-lance`](../../tools/artkit/out/audit-armory/combat-x-staff-arcane-lance.png), [`x2-codex-of-forked-tongues`](../../tools/artkit/out/audit-armory/combat-x2-codex-of-forked-tongues.png) |

### Drift-katana verification

All ten deep links loaded cleanly, rendered non-blank art, dispatched attacks, spawned VFX and damage numbers, and completed stow/draw flourishes. Runtime `sizeClass` exactly matched the authored value. The expected rest deltas were short `-0.56`, standard `-0.26`, long `-0.10`, great `2.75`, and colossal `3.02` radians; observed angle error was zero within floating-point precision.

| Weapon | Size | Pose result | Screenshot |
| --- | --- | --- | --- |
| `drift-wakizashi-kagewake` | short | one-hand blade, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-wakizashi-kagewake.png) |
| `drift-wakizashi-hushglass` | short | one-hand blade, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-wakizashi-hushglass.png) |
| `drift-katana-stillwater-edict` | standard | two-hand sword, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-katana-stillwater-edict.png) |
| `drift-katana-stormthread` | standard | two-hand sword, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-katana-stormthread.png) |
| `drift-katana-riftstep` | standard | two-hand sword, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-katana-riftstep.png) |
| `drift-nodachi-pale-horizon` | long | two-hand sword, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-nodachi-pale-horizon.png) |
| `drift-nodachi-gatebreaker` | long | two-hand sword, match | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-nodachi-gatebreaker.png) |
| `drift-greatkatana-moonwake` | great | two-hand sword, **tip-drag** | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-greatkatana-moonwake.png) |
| `drift-greatkatana-tempest-regent` | great | two-hand sword, **tip-drag** | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-greatkatana-tempest-regent.png) |
| `drift-colossal-world-seam` | colossal | two-hand sword, **tip-drag** | [`combat`](../../tools/artkit/out/audit-armory/combat-drift-colossal-world-seam.png) |

Full interaction evidence: [`interaction-combat.json`](../../tools/artkit/out/audit-armory/interaction-combat.json).

## Defects

### ARM-WPN-01 — dual-wield state is accepted but the client equips only the lead weapon

- Severity: **High (P1)**
- Result: **FAIL — 0/3 render, despite 3/3 accepted binds**
- Repro:
  1. Equip the two listed one-handed, same-class weapons into slots 0 and 1.
  2. Use the weapons shop pair action while slot 0 is active.
  3. Inspect the decoded row: `player.dualWield?.offhandSlot === 1`, and both slot weapon IDs are exact.
  4. Inspect/play the arena rig: `heldWeaponDef(0)` is the lead, `heldWeaponDef(1)` is null, only one weapon image exists, and there is no off-hand pose family.
- Samples:
  - `rattler-sabre` + `x-sword-neon-katana`
  - `x-gun-revolver-cannon` + `x-gun-nailgun`
  - `x-gun-nailgun` + `x-gun-ricochet-pistol`
- Root location: `packages/client/src/scenes/ArenaScene.ts:3147-3193`. `equipWeapons()` reads only `player.weapon`, constructs one definition/manifest, and calls `rig.equipWeapon(...)` at line 3183. It never reads `player.dualWield?.offhandSlot`, resolves the linked arsenal row, or calls the dual-aware `SpriteRig.equipLoadout(...)` available at `packages/client/src/entities/SpriteRig.ts:4012`.
- Eligibility source: `packages/shared/src/weapons.ts:409`; all three samples returned eligible.
- Console/page errors: none. This is a missing client render/stance path, not a black screen.
- Evidence: [`interaction-dual.json`](../../tools/artkit/out/audit-armory/interaction-dual.json), [`melee screenshot`](../../tools/artkit/out/audit-armory/dual-melee-rattler-sabre-x-sword-neon-katana.png), [`ranged A screenshot`](../../tools/artkit/out/audit-armory/dual-ranged-a-x-gun-revolver-cannon-x-gun-nailgun.png), [`ranged B screenshot`](../../tools/artkit/out/audit-armory/dual-ranged-b-x-gun-nailgun-x-gun-ricochet-pistol.png).

### ARM-WPN-02 — two weapons miss the incoming draw flourish

- Severity: **Medium (P2)**
- Result: **FAIL — 14/16 sampled swaps complete both channels**
- Affected:
  - `x-gun-revolver-cannon` -> `x2-hailshot-hand-maul`: outgoing stow proxy present; no incoming `draw` channel for its `long-gun` flourish.
  - `x-staff-arcane-lance` -> `x2-codex-of-forked-tongues`: outgoing stow proxy present; no incoming `draw` channel for its `tome` flourish.
- Repro:
  1. Enter Testing Grounds with the first weapon in either sequence.
  2. Equip the second weapon through the Testing Grounds carousel/dev-equip path.
  3. Observe the outgoing weapon stow, followed by the new weapon appearing without its authored draw motion.
  4. Attacking still dispatches, advances `attackSeq`, creates weapon VFX, deals damage, and displays damage numbers.
- Source chain: `packages/client/src/scenes/ArenaScene.ts:3147-3193` begins the swap, takes the lazy-art equip path, and calls `equipWeapon`; flourish completion/draw is handled at `packages/client/src/entities/SpriteRig.ts:2828-2913` and `4018-4156`. Every current weapon is expected to have an authored flourish spec by `packages/client/src/sprites/pose-language.test.ts:258-269`.
- Evidence: the event arrays in [`interaction-combat.json`](../../tools/artkit/out/audit-armory/interaction-combat.json), [`Hailshot screenshot`](../../tools/artkit/out/audit-armory/combat-x2-hailshot-hand-maul.png), [`Codex screenshot`](../../tools/artkit/out/audit-armory/combat-x2-codex-of-forked-tongues.png).

### ARM-WPN-03 — Weaponsmith combined preview requested missing actor sheets (fixed)

- Severity: **Low (P3), resolved in audit**
- Before: opening a bespoke edit emitted 404 console errors for `/art/drifter/candidate-1.keyed.png` and `/art/critter/candidate-1.keyed.png`; neither file exists.
- Fix: `tools/weaponsmith/public/app.js:69` now uses the existing `/art/dust-ranger/candidate-1.keyed.png` and `/art/dummy/candidate-1.keyed.png` sheets.
- Regression test: `tests/weaponsmith-preview-actors.test.ts` parses both `engine.setActors` URLs and asserts that each resolves beneath the Weaponsmith `/art` mount.
- After: bespoke editor and both canvases load with zero browser errors.
- Evidence: [`Weaponsmith audit`](../../tools/artkit/out/audit-armory/weaponsmith-audit-summary.json), [`all 326`](../../tools/artkit/out/audit-armory/weaponsmith-all-326.png), [`driftblade edit`](../../tools/artkit/out/audit-armory/weaponsmith-driftblade-edit.png).

## Exact pickup regression

The test started in normal Arena, sent physical `T`, verified the room changed to `training`, selected a concrete gallery pickup, moved into its 46 px grab radius, and sent physical `E`. The client sent:

```text
grabWeapon { pickupId: "pk:1:8:6:x2-hexbinder-s-iron-orrery" }
```

The pickup row named `x2-hexbinder-s-iron-orrery`, and the held weapon after pickup was exactly `x2-hexbinder-s-iron-orrery`. This exercises the fixed exact-ID path at `packages/client/src/scenes/ArenaScene.ts:4231-4241` and the server handler at `packages/server/src/rooms/GameRoom.ts:1920-1963`.

Evidence: [`interaction-pickup.json`](../../tools/artkit/out/audit-armory/interaction-pickup.json), [`before E`](../../tools/artkit/out/audit-armory/pickup-before-e.png), [`after E`](../../tools/artkit/out/audit-armory/pickup-after-e.png).

## Weaponsmith

The API returned the same 326 IDs as the shared catalog. Status verification enumerated the 18 JSON files under `tools/weaponsmith/assignments/` and independently derived the expected status for every weapon: 18 bespoke-file, 295 generated-default, and 13 none, with zero mismatches. All three status filters returned their exact expected ID sets; the `drift-katana` search returned the exact three matching weapons. Opening `driftblade` loaded the file-backed badge, assignment values, weapon render, engine preview, combined preview, and Save flow without offering a new-assignment path.

Evidence: [`full Weaponsmith result`](../../tools/artkit/out/audit-armory/weaponsmith-audit.json) and [`summary`](../../tools/artkit/out/audit-armory/weaponsmith-audit-summary.json).

## Colyseus reflection-law review

No arena black screen occurred. Live client reads of the nested reflected row in `ArenaScene.ts` use optional access, including `player.dualWield?.gearUpper`, `gearLower`, `prestige`, and `weaponResource` at lines 3993-4013, 8112-8117, 9264, 10980, and 13692-13694. `packages/client/src/ui/loadout-entry-view.ts:46-55` also uses `self.dualWield?.offhandSlot` and `?.pairBaseSeq`. Lines 72-73 read the row directly only inside the already-established paired branch. ARM-WPN-01 is therefore an omission in `equipWeapons()`, not a reflection-law dereference crash.

## Validation and change scope

- `node --check tools/weaponsmith/public/app.js` — pass
- `pnpm exec vitest run tests/weaponsmith-preview-actors.test.ts` — pass, 1/1
- `pnpm typecheck` — pass across shared/client/server
- `pnpm exec vitest run --reporter=dot` — pass, 74/74 files and 1,298/1,298 tests
- Services were left running on ports 5180, 2567, and 5050.
- No commit was created.
- No game-code defect was modified.

