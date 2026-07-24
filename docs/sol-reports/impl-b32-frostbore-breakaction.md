# B32 Frostbore Break-Action Implementation Report

## Stage 0 — plan

### Surgical cut

- Preserve the sanctioned `x2-frostbore-scattergun/part-1.png` source before editing and inspect its alpha bounds at native resolution.
- Cut at the receiver hinge immediately ahead of the trigger housing, where the snowflake receiver plate meets the barrel band.
- Keep the stock/receiver and double-barrel layers on identical native-size transparent canvases so their closed-state composite remains registration-safe.
- Assign shared hinge coordinates to the two registered parts; retain original pixels and palette everywhere except for the smallest cut-edge continuation needed to avoid hollow edges while open.
- Add an automated closed-composite pixel-diff check against the preserved source.

### Mechanism design

- Extend `SpriteRig`'s `GunHandlingMechanism` family with a reusable `break` mechanism selected only by the Frostbore weapon definition.
- Drive the two-shot open/eject/close phase from the authoritative attack/reload clock, not a local render timer, so local and remote players resolve the same pose.
- Pivot the registered barrel layer down roughly 30 degrees around the authored hinge for both facings, and derive the muzzle point from the transformed barrel only while the action is closed.
- Keep the support-hand anchor attached to the rotating fore-wrap during the cycle.
- Wire existing shotgun/mechanical accents to the open and snap-shut phase transitions without generating new audio unless no shipped fit exists.
- Preserve nominal DPS within the requested ±10% band by calculating the two-shot burst plus reload-cycle contract from the existing Frostbore cadence and documenting the final values.

## Stage 1 — registered image surgery

- Added `tools/artkit/cut-frostbore-break-action.mjs` as the one-off reproducible Sharp operation.
- Preserved the harvested source as `tools/artkit/fixtures/x2-frostbore-scattergun-closed.png`.
- Cut line: native X `785`; hinge: native `(785, 243)` / normalized `(0.4341814159, 0.5294117647)`.
- `part-1.png` retains stock, snowflake receiver, and trigger housing; `part-2.png` retains the complete double-barrel/breech assembly.
- Both outputs retain the original `1808×459` canvas and original source pixels/palette. Their closed composite differs from the preserved source by zero RGBA channels (maximum delta `0`), so no destructive cut-edge repaint was necessary.

## Stage 2 — mechanism and cadence

- Added data-driven `breakAction` hinge/open-angle metadata and the reusable `break` member of SpriteRig's `GunHandlingMechanism` family.
- The registered part-2 layer pivots `π/6` radians (`30°`) around the receiver hinge. The support hand resolves its secondary fore-wrap anchor through the same rigid hinge rotation.
- Open/eject/close sampling consumes only `attackTick`, room `tick`, `charges`, and `maxCharges`. The `0.9 s` reload is `18` authoritative 50 ms ticks: opening begins at 8%, full-open/eject spans 28–56%, closing spans 56–82%, then the action rests closed.
- Muzzle rows are two cycling art points on part 2. Client muzzle writes reject the open barrel, and shared authority treats the registered barrel as the lead-hand attachment rather than an off-hand weapon.
- Existing `ui-dock-open` / `ui-dock-close` shipped mechanical clips back `gun:break-open` / `gun:break-close`, with bounded synthesized mechanical fallbacks.
- Cadence: `7 damage × 6 pellets × 2 shells / (0.5 s inter-shot + 0.9 s reload) = 60 DPS`. Previous live continuous nominal was `5 × 6 / 0.5 = 60 DPS`; drift is `0%`.

## Stage 3 — focused verification

- Focused tests prove zero-diff closed compositing, the 60 DPS contract, authoritative phase timing, two cycling bores for both facings, support-hand hinge registration, the generic handling-family selection, and server admission of exactly two shells before fixed-clock refill.
- Focused result: 3 test files / 7 tests passed.

## Stage 4 — full verification

- `pnpm gen`: passed; expansion, muzzle, roster, manifest, VFX, and portal outputs regenerated.
- `pnpm gen:check`: passed; tracked generated outputs are in sync. The check retained its existing warnings for unavailable untracked Artkit reference artifacts.
- `pnpm typecheck`: passed for shared, client, and server workspaces.
- `pnpm test`: passed, 179 test files / 2,255 tests.
- `pnpm assets:check`: passed, validating 478 sprite entries / 1,008 parts plus atlas, cards, POIs, decals, projectile, particle, and weapon-VFX URLs.
- `git diff --check`: passed.

## Stage 5 — private live gate

- Added `e2e/tests/b32-frostbore-breakaction.spec.ts`, which boots only the spec stack and binds OS-assigned loopback ports.
- Final capture used client port `64401` and game port `64399`; protected ports `5180` and `2567` were not used.
- Live fixture: `proto-cowboy-hidden-face` with `x2-frostbore-scattergun`.
- Captured local right-facing and observed remote left-facing break-open, shell-eject, and snap-shut frames. Each still uses its own authoritative two-shell reload cycle so PNG encoding cannot advance past the requested 0.9-second pose window.
- Live clock samples landed at opening tick 4–5, eject tick 6, and closing tick 13–14 of the 18-tick reload. Both registered cycling bore points were distinct and valid closed; both were rejected throughout every nonzero barrel-angle sample.
- Evidence JSON and six visually inspected PNGs are under `docs/owner-notes-audit-v11-evidence/b32-frostbore-breakaction/`.

Verdict: sprite cut registered at hinge (785,243); break mechanism live at 30° over 18 authoritative ticks (open/eject/close); DPS 60 versus prior 60, 0% drift and inside the ±10% band; closed-composite fidelity exact at max RGBA delta 0; evidence path `docs/owner-notes-audit-v11-evidence/b32-frostbore-breakaction/`; files touched: 36 across Frostbore data/art, shared generation/clocking, server resource authority, SpriteRig/audio/client wiring, tests, evidence, and this report.
