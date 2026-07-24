# B29 Ranged/Thrown Presentation Implementation

- Agent: Sol `impl-b29-ranged-presentation`
- Branch: `sol/b29-ranged-presentation`
- Date: 2026-07-24
- Scope: presentation only; damage, cadence, and range remain unchanged.
- Guardrails: no auras, chains, tassels, radial/ambient effects, or changes to kung-fu, parry reactions, fans, chests/packs, characters, pets, or B28 weapons.

## Order 1 — Shurikens and Chakrams

Catalog enumeration (active catalog):

- `x2-iron-throwing-star` — Iron Throwing Star
- `x2-fire-throwing-star` — Fire Throwing Star
- `x2-ice-throwing-star` — Ice Throwing Star
- `x2-void-throwing-star` — Void Throwing Star
- `x2-iron-chakram` — Iron Chakram

Count: 4 shurikens/throwing stars + 1 chakram = 5 affected weapons.

Animation plan:

- Increase both held-weapon and in-flight projectile render scale through presentation length while pinning the previous collision length, damage, cadence, charge, refill, speed, and range values.
- Add a catalog-authored engaged-throw marker. Its sampler will deepen the wind-up, rotate/lean the body into the cast, step the lead foot forward while the rear foot braces, extend both hand channels through release, and settle cleanly in recovery.
- Give these five records a readier neutral hand/weapon equilibrium and planted throwing stance.
- Preserve left/right mirroring and validate both facings at combat scale.

## Order 2 — Kunai

Catalog enumeration:

- `x2-kunai` — Kunai (one active catalog weapon; size remains `displayLength: 72`).

Animation plan:

- Preserve kunai held and projectile size.
- Add a catalog-authored end-hook flourish marker that reuses the shipped pistol draw and after-attack beats.
- During those two flourish channels only, pivot the kunai around the normalized ring-pommel/end-hook point; its ordinary held pivot remains unchanged.
- Play the flourish on draw and after each accepted throw while preserving throw cadence and damage.

## Order 3 — Authored Dual Guns

Catalog enumeration (active, pre-made `grip: "dual"` physical firearms):

- `x2-coyote-stinger` — Coyote Stinger
- `x2-sidewinder-twin-rifles` — Sidewinder Twin-Rifles
- `x2-twin-maw-greenerbore` — Twin-Maw Greenerbore
- `x2-scattershell-duster` — Scattershell Duster
- `x2-pinwheel-caromer` — Pinwheel Caromer

Count: 5 authored dual firearms. Excluded gun-delivery non-firearms: `x2-whisperbarb-hand-crossbow`, `x2-gravewax-twin-idols`, and `x2-voltvein-conductors`.

Animation plan:

- During aimed firing, apply a clear screen-vertical split between the two authored gun sprites through the shared deterministic grip/muzzle pose.
- Keep each muzzle anchored to its transformed gun in both client and authority so projectile origins track the visible barrels.
- Do not reintroduce the removed composed-pairing system.

## Order 4 — Revolver Hammer Beats

One-handed revolver enumeration (active catalog family/fiction):

- `x-gun-revolver-cannon` — Revolver Cannon
- `x-gun-ricochet-pistol` — Ricochet Pistol / Bankshot (shipped art fiction: snub revolver)
- `x2-ashfall-peacemaker` — Ashfall Peacemaker
- `x2-grit-snubnose` — Grit Snubnose
- `x2-mesa-hand-cannon` — Mesa Hand-Cannon
- `x2-hailspitter-pepperbox` — Hailspitter Pepperbox
- `x2-sunbrand-hogleg` — Sunbrand Hogleg
- `x2-gravewind-rimfire` — Gravewind Rimfire
- `x2-fool-s-gold-revolver` — Fool's Gold Revolver
- `x2-quicksilver-fanner` — Quicksilver Fanner
- `x2-brimstone-bull` — Brimstone Bull
- `x2-tumbleweed-skipper` — Tumbleweed Skipper
- `x2-hollowpoint-hex` — Hollowpoint Hex
- `x2-iron-marshal` — Iron Marshal
- `x2-ironhail-pepperbox` — Ironhail Pepperbox
- `x2-carom-king` — Carom King
- `x2-ricochet-roulette` — Ricochet Roulette

Count: 17 one-handed revolver-fiction weapons.

Two-handed/paired revolver enumeration:

- `x2-twin-maw-greenerbore` — Twin-Maw Greenerbore (explicit owner-designated pistol/fan-hammer reference)

Count: 1 paired fan-hammer weapon. Other dual derringer/shotgun definitions lack revolver fiction and are not classified as revolvers.

Animation plan:

- Add an explicit `revolver` handling tag to this census instead of inferring presentation from every pistol.
- One-handed revolvers: add a visible per-shot hammer-end rotation/offset pulse plus thumb-hand micro-motion, duration-clamped inside each weapon's existing cadence.
- Two-handed revolver pairs: alternate the same pulse per fired gun and move that gun's rendered hand toward its pin hammer without moving the gun/muzzle off its shared authored mount.
- Use `x2-twin-maw-greenerbore` as the paired reference treatment and preserve existing cadence/damage.

## Verification Log

- 2026-07-24: repository remote has no `main` ref. The task branch is already at `origin/feat/v0.118-metagame` commit `6a46328`, whose head is the B27 authored-dual merge and whose first parent includes B28 (`5d4460f`). No rebase delta was required.
- 2026-07-24: catalog census and implementation plan completed before code changes.
- 2026-07-24, order 1 complete: the four throwing stars now render at lengths `76`, `78`, `78`, and `82` (previously `56`, `58`, `58`, and `60`); the Iron Chakram now renders at `104` (previously `76`). Their old lengths remain pinned as collision lengths. All five carry the authored engaged-throw marker and use the new ready idle, whole-body wind-up, lean/step release, and recovery channels.
- 2026-07-24, order 2 complete: `x2-kunai` remains length `72`; its authored end-hook marker selects the existing pistol-twirl timing on draw and after attack while a kunai-specific normalized pivot (`0.073`, `0.5`) moves the flourish around the pommel ring.
- 2026-07-24, order 3 complete: the five authored dual physical firearms use a shared deterministic `0.085`-body-height split while firing. The split is applied to grip transforms consumed by both weapon sprites and muzzle resolution, preserving per-barrel projectile origins.
- 2026-07-24, order 4 complete: all 17 one-handed revolvers carry an explicit `revolver` handling tag and receive a cadence-bounded weapon/hammer-end pulse plus thumb micro-motion on every observed shot, including the first held shot. Twin-Maw Greenerbore carries explicit pistol/revolver fiction and alternates the stronger hand-to-hammer motion per fired gun through the existing B27 authored-dual hand sequence.
- 2026-07-24: no damage, cadence, charge, refill, projectile speed, range, or wire/schema values changed. Because the new fields are optional catalog presentation metadata rather than protocol/schema data, the current schema version and all pins remain unchanged.
- 2026-07-24: `pnpm gen` passed and regenerated the weapon expansion from its source catalog.
- 2026-07-24: `pnpm gen:check` passed.
- 2026-07-24: `pnpm typecheck` passed.
- 2026-07-24: full `pnpm test` passed: 177 test files, 2,257 tests.
- 2026-07-24: `pnpm assets:check` passed: 478 sprite entries / 1,007 parts, 635 atlas frames, 320 cards, 6 POIs, 9 decals, 24 projectile URLs, 96 particle URLs, and 8 weapon-VFX URLs.
- 2026-07-24: `git diff --check` passed and all 13 changed text files were byte-checked as LF-only.
- 2026-07-24: the Playwright live gate passed on private ephemeral client/game ports `63858`/`63857`, never `5180`/`2567`, using `proto-cowboy-hidden-face`. It produced 22 combat-scale captures across both facings plus machine-readable pose, transform, muzzle, projectile, and per-hand receipts under `docs/owner-notes-audit-v11-evidence/b29-ranged-presentation/`.

## Files Touched

- `data/weapon-concepts-300.json`
- `packages/shared/src/weapons.ts`
- `packages/shared/src/weapons-expansion.generated.ts`
- `tools/artkit/gen-weapon-expansion.mjs`
- `packages/client/src/sprites/pose-language.ts`
- `packages/client/src/entities/SpriteRig.ts`
- `packages/client/src/entities/SpriteRig.ranged.test.ts`
- `tests/b29-ranged-presentation.test.ts`
- `tests/v3g-gun-handling.test.ts`
- `e2e/tests/b29-ranged-presentation-live-gate.spec.ts`
- `docs/owner-notes-audit-v11-evidence/b29-ranged-presentation/` (22 PNG captures, `live-gate.json`, and `live-gate-summary.md`)
- `docs/sol-reports/impl-b29-ranged-presentation.md`

VERDICT: PASS — 5 shuriken/chakram weapons resized and re-animated (`x2-iron-throwing-star`, `x2-fire-throwing-star`, `x2-ice-throwing-star`, `x2-void-throwing-star`, `x2-iron-chakram`); kunai end-hook twirl complete (`x2-kunai`, size unchanged); vertical fire offset and muzzle tracking complete for 5 authored dual guns (`x2-coyote-stinger`, `x2-sidewinder-twin-rifles`, `x2-twin-maw-greenerbore`, `x2-scattershell-duster`, `x2-pinwheel-caromer`); revolver hammer beats complete for 17 1H weapons (`x-gun-revolver-cannon`, `x-gun-ricochet-pistol`, `x2-ashfall-peacemaker`, `x2-grit-snubnose`, `x2-mesa-hand-cannon`, `x2-hailspitter-pepperbox`, `x2-sunbrand-hogleg`, `x2-gravewind-rimfire`, `x2-fool-s-gold-revolver`, `x2-quicksilver-fanner`, `x2-brimstone-bull`, `x2-tumbleweed-skipper`, `x2-hollowpoint-hex`, `x2-iron-marshal`, `x2-ironhail-pepperbox`, `x2-carom-king`, `x2-ricochet-roulette`) and the 2H paired list (`x2-twin-maw-greenerbore`); evidence: `docs/owner-notes-audit-v11-evidence/b29-ranged-presentation/`; files touched: catalog/generator/generated registry, shared weapon presentation and muzzle helpers, client pose/rig presentation, focused/unit/live-gate tests, evidence artifacts, and this report.
