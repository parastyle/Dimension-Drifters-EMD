# Gear / Wardrobe / Closet audit

Audit snapshot: 2026-07-19, branch `feat/v0.118-metagame`. The Vite server at
`http://localhost:5180` and Colyseus at `ws://localhost:2567` were left running.

## Verdict

The owner's connected/necked-head report was **confirmed during this audit**. The exact cause was a
generated-manifest/client frame mismatch that made `GEAR_PARTS_MANIFEST` null and forced the legacy
compatibility scaffold, `packages/client/public/sprites/drifter/body.png`.

The parallel pairs-wiring Sol corrected the client's frozen body/head frames at 23:05 while this
audit was running. The production manifest now validates, and the final code path selects the new
neckless six-part Drifter. A focused 35-test render/preview run passes without the fatal manifest
warning. Therefore the connected head is **no longer expected in the final workspace after the page
reloads**, although a real-game screenshot could not be captured in this session.

At the final report snapshot (the render fleet was still running):

- the generated manifest was schema 2 and contained 11 heads plus 6 torsos;
- the live server returned non-empty `player.dualWield.gearUpper` and
  `player.dualWield.gearLower`, with no root compatibility getters;
- all 6/6 boilerplate URLs and all 17/17 currently manifested head/torso URLs returned HTTP 200;
- public wiring contained 11 heads and 6 torsos, and the retired `shirt/` and `pants/` directories
  were gone;
- the boilerplate head and every installed replacement head had `mountScale: 0.85`.

The requested real-game screenshot pass is blocked because the browser runtime reported **no browser
backend available** twice. No screenshot files were created. The diagnosed defect was nevertheless
definitive: the production import emitted the exact `[gear-bake] replacement manifest invalid or
unavailable; preserving the compatibility rig` warning before the concurrent fix, and the rejected
frame tuples were deterministic.

## Pass / fail matrix

| Area | Result | Evidence | Remaining gap |
|---|---|---|---|
| Base rig selects wardrobe path | **PASS after concurrent fix** | `ArenaScene.ts:3988-4014` reads only nested `dualWield` strings. Live Colyseus returned both strings non-empty; the corrected production manifest now validates. | Live canvas screenshot blocked. |
| Naked body and separate head | **PASS (code/test/protocol)** | Six-part install is atomic at `SpriteRig.ts:2176-2259`; body/head are separate at `:2187-2199`. All 6 assets serve 200 and the focused production-manifest run is clean. | Visual proof blocked. |
| Head bob/jiggle | **PASS (test-backed)** | Spring code is at `SpriteRig.ts:6962-7032`; floating-head tests are at `SpriteRig.boilerplate.test.ts:292-371`. | Motion capture blocked. |
| `?closet=1` opens | **PARTIAL** | HTTP 200; dev closet grants all `GEAR_IDS` locally at `MenuScene.ts:341-346`. This route does not connect until a run is launched. | Browser console and rendered layout blocked. |
| Closet roster / no pants | **PASS** | `GEAR_SLOTS` is exactly hat, glasses, facialHair, head, torso, gloves, boots, cloak at `packages/shared/src/gear.ts:5-16`; the UI iterates that array at `MenuScene.ts:867-892`. Catalog: 113 rows, zero pants. Retired public `pants/` and `shirt/` directories are absent. | Visual label check blocked. |
| Installed pair full replacement / no base double-draw | **PASS (test-backed)** | `gear-parts.ts:1154-1184` selects one winning torso/head; five complete pairs are manifested and all 17 current head/torso URLs serve. | Visual comparison blocked. |
| Closet preview matches arena | **PASS (shared-path/test-backed)** | Preview/arena use the same bake recipe (`ui/wardrobe/preview.ts:278-327`, `SpriteRig.ts:2428-2451`); preview tests pass after production manifest validation was restored. | Pixel comparison blocked. |
| Every `?dev=gear:<id>` page responds | **PASS, 113/113** | Direct HTTP sweep: 113/113 returned 200. Counts were hat 13, glasses 16, facialHair 13, head 13, torso 16, gloves 16, boots 13, cloak 13. | This proves route availability, not Phaser completion. |
| Deep link equips canonical slot | **PARTIAL** | Account/server state is correct: `devInspectionAccount` writes the catalog's canonical slot at `MenuScene.ts:106-122`, its test passed, and a live Unbending sample round-tripped through nested strings. The production manifest now validates. | Browser sweep blocked. |
| Five installed pairs + three fallback visuals | **BLOCKED** | All 17 current head/torso URLs serve and fallback resolution is covered at `gear-parts.ts:953-992,1154-1159`; production manifest validation is restored. | Eight visual inspections/screenshots unavailable. |
| Glasses/facial hair on sprung head | **PASS (test-backed)** | Baked into the winning head at `gear-parts.ts:1100-1116,1165-1184`; final-head parenting at `SpriteRig.ts:7035-7060`; rider test passes. | Live motion/facing capture blocked. |
| Hat overlay and jiggle | **PASS (test-backed)** | Overlay/spring code at `gear-parts.ts:1256-1303` and `SpriteRig.ts:7176-7208`; focused render run passes. | Live motion capture blocked. |
| Cloak, gloves, boots, both facings | **PASS (test-backed)** | Attachment/mirror code at `gear-parts.ts:1117-1253` and `SpriteRig.ts:7063-7111,7460-7478`; focused render run passes. | Visual sanity check blocked. |
| Equip survives disconnect/rejoin | **PASS (unit/static), browser E2E blocked** | Menu saves immediately at `MenuScene.ts:955-965`; Arena reads/sends/saves the account at `ArenaScene.ts:1740,3862-3893`; the server sanitizes/snapshots gear at `GameRoom.ts:4040-4075`. | A real `?closet=1` equip/reload/rejoin was not run. Reloading the same `?dev=gear:` URL would be invalid evidence because it re-equips on every load. |
| Stale expedition settles as defeat at join | **PASS (server regression)** | Settlement/clear is at `progression.ts:357-400`; fresh-join handling is at `GameRoom.ts:4096-4117`. `GameRoom.test.ts:6766-6814` passed and proves a new carry is accepted without bricking the account. | No browser UI exposes the defeat receipt; consequence-only browser proof is blocked. |

## Necked-head diagnosis

The exact legacy-retention chain is:

1. `ArenaScene.ts:3988-4007` uses the wardrobe rig only when `GEAR_PARTS_MANIFEST` is non-null and
   both `player.dualWield?.gearUpper` and `.gearLower` are non-empty. Otherwise it constructs the
   legacy character body.
2. `gear-parts.ts:681-692` requires every generated bake frame to match the client's frozen tuple;
   `replacementBakeFrame` performs exact comparison at `:397-418`.
3. Even after the wardrobe path is selected, `SpriteRig.ts:2176-2185` preserves the legacy pixels
   until body, head, both hands, and both feet are all loaded. `:2186-2199` then swaps the body and
   shows the separate head atomically.
4. `ArenaScene.ts:8107-8118` (Arena reconciliation) reads the nested fields again and upgrades a rig
   that was created before the nested row arrived.

The historical mismatch was concrete:

- generator contract `tools/artkit/lib/gear-replacement-contract.mjs:32-33`: body
  `[268,180,488,544]`, head `[290,40,508,552]`;
- client before the concurrent fix, `gear-parts.ts:338-351`: body `[344,324,336,376]`, head
  `[352,112,384,456]`. The current file now contains the generator tuples at those lines.

Before 23:05 the first two tuples failed the exact check, validation returned null, and the warning
at `gear-parts.ts:735-741` fired. `ArenaScene.ts:3995-4007` then deliberately chose the legacy
connected body. This is the definitive explanation for the owner's report. The parallel fix changed
the client tuples to match the generator; the same focused import no longer warns, so the current
workspace should select the separate head after reload.

Visual source evidence (not gameplay screenshots):

- new body: `packages/client/public/sprites/boilerplate/body.png`;
- new separate head: `packages/client/public/sprites/boilerplate/head.png`;
- old connected scaffold: `packages/client/public/sprites/drifter/body.png`.

## Pending art (not defects)

Manifest state was 90/102 installed at the final report snapshot. These catalog rows intentionally
fall back:

- Head: `coldsnap-head`.
- Torso: `ashen-crusader-shirt`, `graveside-shirt`, `nine-veils-shirt`,
  `thornwatch-shirt`, `neon-mirage-shirt`, `pressurized-shirt`.
- Boots rejected by the current pivot-alpha gate: `thornwatch-boots`, `unbending-boots`.
- Glasses not installed: `brass-readers`, `loaded-readers`, `lucky-readers`.

The five complete installed pairs are `ash-walker`, `molten-core`, `demon-mask`, `house-edge`, and
`unbending`. Eight `blank-drifter-*` rows are intentionally artless. The legacy-upgrade torsos
`mended-workshirt`, `reinforced-workshirt`, and `shopkeeps-sunday-best` are intentionally excluded
from the pair manifest, not pending renders.

## Defects

No unresolved gear-code defect was proven in the current post-fix workspace. One production defect
was confirmed and resolved concurrently during the audit:

### P0 (resolved concurrently) — generated bake frames were rejected by the client

Repro:

1. Run `npx vitest run` (or import the production `GEAR_PARTS_MANIFEST`).
2. Observe `[gear-bake] replacement manifest invalid or unavailable; preserving the compatibility rig`.
3. In the failing snapshot the generator used body `[268,180,488,544]` and head
   `[290,40,508,552]`, while the client still froze body `[344,324,336,376]` and head
   `[352,112,384,456]` at `packages/client/src/sprites/gear-parts.ts:338-351`.
4. `replacementBakeFrame` rejected them at `gear-parts.ts:397-418`; manifest validation returned null
   at `:681-692`; Arena selected the connected legacy body at `ArenaScene.ts:3995-4007`.

Impact before the concurrent fix: the base separate head, every installed torso/head pair, fallback
six-part body, all hats/accessories, and the closet preview were unreachable. The item ids still
persisted and serialized, which made state-only tests appear green while wardrobe art did not render.

Resolution observed during audit: the pairs-wiring Sol updated the client frozen frames and synthetic
fixture to the generator values. The focused 35-test production/render run then passed with no fatal
warning. This audit did not modify game code.

Coverage gap: `gear-parts.test.ts:21-31` validates a synthetic fixture, not the imported production
manifest. `gear-parts.completeness.test.ts:41-69` inspects production item rows but never calls
`validateGearPartsManifest`, so the full 1,297-test suite passes while printing the fatal runtime
warning.

Audit-environment blocker: no browser backend was available, so gameplay screenshots, browser
console capture, live facing comparisons, and the end-to-end persistence run could not be collected.

## Verification log

- Relevant focused Vitest pass before final validation: 11 passed, 267 skipped across
  `SpriteRig.boilerplate.test.ts`, `remote-gear.test.ts`, and gear/stale-expedition cases in
  `GameRoom.test.ts`.
- Wardrobe/deep-link/baker focused run: 38 passed; one manifest-completeness assertion failed during
  the render fleet's in-progress burn-down rewrite. The parallel wiring work subsequently updated
  that allowlist.
- Local route sweep: 113/113 gear URLs returned the Vite app with HTTP 200; `?closet=1` returned 200.
- Live Colyseus sample: nested gear strings present, root getters absent, and an Unbending head/torso
  decoded back into the correct canonical slots.
- Served asset sweep: 6/6 boilerplate and 17/17 currently manifested head/torso URLs returned 200.
- `pnpm typecheck`: pass.
- Pre-fix `npx vitest run`: pass, 73 files / 1,297 tests, but it emitted the fatal
  production-manifest warning described above; those tests did not fail on it.
- Post-fix focused armory run: pass, 4 files / 35 tests, with no production-manifest warning.
- Post-fix exact full command, `npx vitest run`: armory suites pass and 1,297/1,298 tests pass, but
  the repository-wide run is not green. One attempt hit an unrelated XP Echo collector-order
  assertion at `GameRoom.test.ts:2696` (the exact test passed immediately in isolation). A second
  attempt cleared that case and timed out in `tests/mapgen.test.ts:363` at 32.6 seconds against its
  30-second limit while the render fleet was still consuming CPU. That mapgen case had passed in
  22.6 seconds in the earlier full run. No unrelated test timeout or game code was changed by this
  audit.
