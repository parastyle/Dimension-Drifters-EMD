# v8 Thrown Weapons and Plain Sniper

Owner: Sol `v8-thrown-and-sniper`  
Branch: `feat/v0.118-metagame`  
Started: 2026-07-23

## Understanding

This work ships six new weapons without replacing the existing Barrett: four throwing stars (iron, fire, ice, and void), one kunai, and one deliberately plain modern-military .50-cal bolt-action anti-materiel rifle. The thrown weapons must reuse the established `throw` / `throw-release` / `thrown` animation and server-authoritative delivery path, including its throw origin. The sniper must reuse the repository's shipped bolt-action mechanism and shared art-space muzzle affine, with no occult, saint, or crusader motifs.

Every weapon needs a real generated bitmap asset, catalog/card/gallery integration, sane class-relative DPS, and synchronized updates to every pinned weapon census guard and count test so boot remains safe. Generated outputs will only be changed through the repository generators. Character and pet data/assets are explicitly out of scope.

## Plan

1. Read the owner decisions, bolt-action report, reporting guidance, image-generation instructions, and existing thrown/Barrett implementation and tests.
2. Generate and integrate distinct bitmap art for the four stars, kunai, and plain sniper using the established asset pipeline.
3. Add the six catalog definitions, reuse the thrown delivery configuration for stars/kunai, and reuse bolt-action configuration plus the shared muzzle affine for the sniper.
4. Update all catalog census guards, count tests, portal/gallery expectations, cards, and generated artifacts through `pnpm gen`.
5. Add or extend permanent focused and live coverage for throw-origin launch behavior and stationary/strafing sniper muzzle and bolt-cycle behavior without weakening thresholds.
6. Run `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, focused tests, isolated live gates on ephemeral private ports, full `pnpm test`, and `pnpm typecheck`; retain visual/live evidence under `docs/owner-notes-audit-v8-evidence/thrown-and-sniper/`.
7. Append findings, implementation details, DPS rationale, exact gate thresholds/results, and boot confirmation here. Finish with the required explicit verdict.

## Progress log

- 2026-07-23: Created this report as the first repository edit and recorded the implementation/proof plan.
- Read the binding owner decisions, complete bolt-action report, durable-reporting contract, and image-generation workflow. No `AGENTS.md` exists in the repository. The pre-existing untracked pet/character documents are unrelated user work and will remain untouched.
- Traced the expansion pipeline from `data/weapon-concepts-300.json` through `gen-weapon-expansion.mjs`, the held-sprite harvester/atlas packer, alpha-derived ranged muzzle generator, card installer/manifest, Weaponsmith aggregate, and portal generator. Generated TypeScript/HTML/manifest outputs will only be updated by those canonical tools.
- Traced thrown authority through `GameRoom.throwWeapon` and `thrown:<weapon-id>` identity resolution, with the client resolving the exact weapon sprite and `throw-release` providing the hand/weapon presentation. Boothook Harpoon is currently a thrown weapon; Sidewinder Spontoon is still authored as an edge weapon despite the work order describing it as an existing thrown example. This order remains scoped to the six requested additions and reuses Boothook/the normalized thrown path without silently rebalancing Sidewinder as a seventh change.
- The client currently gives guns a live muzzle-origin presentation offset but admits thrown projectiles at the already-advanced authoritative row. The permanent gate therefore needs a parallel throw-hand admission anchor using `SpriteRig.handWorldAnchor`, while retaining the same server-authoritative projectile and convergence path.
- Current pinned censuses are 336 durable, 327 active, 298 active expansion, 18 thrown, 117 gun, and 140 ranged muzzle records. Six active additions require synchronized pins of 342 durable, 333 active, 304 active expansion, 23 thrown, 118 gun, and 141 ranged muzzle records.

## Balance decision

The existing authored thrown line spans roughly 8.82–35.29 raw damage/cooldown DPS, with most direct implements in the 20–30 range. The new line will remain inside that established band: Iron Star 25.00, Fire Star 23.81, Ice Star 22.22, Void Star 24.00, and Kunai 30.00 raw DPS before requirements/scaling, with charges/refill/pierce differentiating burst utility. The plain M-50 rifle will use 32 damage on a 1.05 s accepted-shot cadence (30.48 raw DPS), five rounds, 2.6 s reload, and four pierce: adjacent to the Barrett's 34 / 1.15 s (29.57 raw DPS), not an upgrade in every dimension.

## Source and art implementation

- Added `x2-iron-throwing-star`, `x2-fire-throwing-star`, `x2-ice-throwing-star`, `x2-void-throwing-star`, and `x2-kunai` as active expansion definitions. Each owns a `thrown` block, weapon-specific damage/speed/range/charges/refill/pierce, exact `throw-release` performance, an in-flight rotation policy, and its own stable `thrown:<weapon-id>` identity through the existing server-authoritative path.
- Added `x2-m50-anti-materiel-rifle` alongside the retained Barrett. It is a fictional plain modern service rifle with `bolt` handling, an authored receiver-side bolt hand anchor, five-round magazine, generated projectile mapping, and no western/gothic/occult/saint/crusader/religious motif in the catalog prompt or finished art.
- Used the built-in image generator for thirteen separate project-bound bitmaps: six held-weapon identities, six portrait cards, and the M-50's standalone .50-cal cartridge. Chroma-keyed held/projectile sources were alpha-cleaned with the installed imagegen helper, then inspected. The canonical harvester sliced/presized the six held sprites, regenerated `sprites/manifest.ts`, and repacked the atlas; the projectile job validated the 192x41 alpha PNG and regenerated `projectile-manifest.ts`; cards were fitted to the shipped 600x840 JPEG contract and registered by the canonical card-manifest generator.
- Runtime inspection confirms four distinct readable star silhouettes, a point-forward ring-pommel kunai, and an olive-drab/matte-black M-50 with conventional scope, chassis, bipod, box magazine, visible swept bolt, and multi-port brake. The generated M-50 card is a plain desert firing range with no religious/fantasy decoration.
- Generalized new projectile admission so thrown rows begin at `SpriteRig.throwWorldAnchor()` for the accepted beat's rendered release hand, record `spawnAnchorKind: "throw"` plus `spawnThrowX/Y`, and reuse the shipped short-lived source-to-authority convergence. Server projectile origin, velocity, damage, pierce, cadence, and hit authority remain unchanged.
- Advanced every located pinned census together: 342 durable, 333 active, nine archived, 304 active expansion, 23 thrown, 118 gun, and 141 ranged muzzle definitions. The portal remained generator-owned; the static Weaponsmith accessibility shell was advanced to 333 while its runtime list size remains data-driven.

## Generation validation

- `pnpm gen` passed: 321 generated expansion weapons, 141 derived ranged muzzles, 319 cards, and 333 portal weapons.
- `pnpm gen:check` passed with generated expansion, dimensions, card manifest, Weaponsmith aggregate, weapon VFX, and portal all current.
- `pnpm assets:check` passed: 422 sprite entries / 761 parts, 412 atlas frames, 319 cards, 14 projectile URLs, 96 particle URLs, and no missing runtime art. It emitted only the repository's documented availability skips for ten untracked weapon-reference artifacts and one untracked character sprite-parts artifact.

## Focused and live proof

- Focused Vitest coverage passed 29/29 checks across the new six-weapon catalog/art contract, the complete six-entry bolt census, generated M-50 muzzle/projectile data, all five deferred authoritative throw releases, own-sprite projectile identity, weapon-resource distribution, the 342/333 durable/active census, and the 333-row portal/Weaponsmith shell.
- The permanent thrown gate `e2e/tests/v8-thrown-origin-live-gate.spec.ts` passed its final visual-QA run against a private stack on port 59971. For every star and the kunai it deep-linked through the real Testing Grounds, accepted attack sequence 1, observed server source identity `thrown:<weapon-id>`, compared the newly rendered projectile with the live release-hand result, and retained an unobscured release screenshot. Both release-anchor and launch-metadata error were exactly 0 px against a 0.25 px maximum. Outbound rendered travel ranged from 133.33 to 231.00 px against an 18 px minimum; the first authoritative rows were already 54.16–61.37 px downrange, proving the presentation actually rewound them to the hand rather than restating server position.
- The permanent M-50 gate `e2e/tests/v8-m50-live-gate.spec.ts` passed against a private stack on port 61870. It captured three complete accepted bolt cycles spanning stationary and strafing modes; every strict BACK→DOWN→UP→FORWARD phase cleared the 0.06-body-width floor (observed minimum 0.1703), maximum onset was 54.2 ms / one rendered frame against 70 ms / one frame, hand return error was effectively zero, and the support hand stayed visible above and overlapping the receiver art. Stationary and strafing muzzle errors were both exactly 0 px against the retained 2.5 px cap, and owner strafe travel was 169.09 px against a 12 px floor.
- No live threshold was reduced. The first thrown-gate attempt revealed that screenshot encoding outlived the short projectile row; the harness was corrected to accumulate live travel continuously during evidence capture, retaining its 18 px floor. Two attempts to add M-50 to the older multi-weapon bolt gate separately encountered its unrelated sampling-sensitive Sidewinder and Tracer assertions. The legacy gate was restored unchanged, and the scoped M-50 gate now proves the new rifle without depending on unrelated weapon sampling.
- Evidence is retained under `docs/owner-notes-audit-v8-evidence/thrown-and-sniper/`: five live release PNGs, `thrown-live-capture.json`, the M-50 bolt-phase PNG, and `m50-live-capture.json` with thresholds and raw measurements.

## Final validation

- Required generation order completed: `pnpm gen` passed, then `pnpm gen:check` passed, then `pnpm assets:check` passed, followed by focused tests and typecheck. A final `pnpm gen:check` remained green after integration; the final asset census was 422 sprite entries / 762 parts, 413 atlas frames, 319 cards, 14 projectile URLs, and no missing runtime art.
- The expanded focused regression set passed 70/70 after the last hidden catalog pins were found: bolt handling is now six, total tagged gun mechanisms 32, non-adopter default arc routing 119, and every remaining 327 portal pin is gone. The one-line flourish source assertion was advanced from the concurrently renamed `syncBoilerplateHeadPose` seam to its same-function `syncFloatingHeadPose` name without touching character or pet data/art.
- Final full `pnpm test` passed 1,775/1,775 tests across 135 files. Final `pnpm typecheck` passed shared, server, and client. `git diff --check` reported no whitespace errors, and the explicit byte audit found LF-only line endings in every authored V8 text file.
- Server boot is proven repeatedly: the thrown gate booted on private port 59971, the M-50 gate booted on private port 61870, and the final full suite's real Colyseus integration server booted on private port 55264. All stacks were owned by their harness and torn down; ports 5180 and 2567 were never touched.

VERDICT — SHIPPED Iron, Fire, Ice, and Void Throwing Stars, Kunai, and the plain M-50 Anti-Materiel Rifle while retaining the Barrett; UPDATED every catalog guard to 342 durable / 333 active / 304 active expansion / 23 thrown / 118 gun / 141 muzzles (plus six bolt tags and 32 handling mechanisms); PASSED throw-origin ≤0.25 px with ≥18 px flight and M-50 muzzle ≤2.5 px stationary+strafing with ≤70 ms / ≤1-frame bolt onset, ≥0.06-body phases, and >12 px strafe; CONFIRMED the server still boots.
