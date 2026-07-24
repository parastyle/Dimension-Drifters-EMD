# B23 Kung-Fu Corrections

## Understanding

B23 corrects the four B19 martial-art wrap weapons without changing their final PNG art, their 2+2 worn-limb model, or server-authoritative root displacement. The owner rejected character-enveloping weapon aura/glow layers, oversized worn hands and feet, slow and body-bound attacks, and choreography that did not visibly communicate the named martial arts. This implementation therefore removes every cosmetic player aura from worn-weapon VFX and establishes a permanent weapon-law test against future character-wrapping auras; sizes worn wrap mounts from the character's actual hand and foot presentation scale; shortens every wrap cadence while preserving Wing Chun -> Drunken Fist -> Muay Thai -> Iron Palm from fastest to heaviest and rebalances hit damage to remain within 18-22 nominal DPS; extends both visible limb travel and its matching hit envelope; and adds recognizable showcase moves and held stances through the existing pose/idle language.

Impact flashes, strike trails, and hand/foot-anchored effects remain legal because they describe the strike rather than wrapping the whole player. The existing B19 signed forward/lateral displacement remains server owned and nav validated. Fans, B20 surfaces, base character sprites, pets, and all wrap PNGs remain out of scope. The standing bans are no player auras, no chains or tassels, and no thumbs.

## Per-style correction plan

### Muay Thai Wraps

- Remove any player-root glow or aura while retaining limb-anchored crimson strike accents and impacts.
- Render the duplicated hand and foot wraps at proportional character hand/foot scale.
- Shorten the five-beat bar and compensate damage so the style stays near 20 nominal DPS while remaining slower than Drunken Fist and faster than Iron Palm.
- Increase visible forward extension and matching hit reach on every strike.
- Replace the B19 spinning back-elbow showcase with a large, readable roundhouse kick whose foot sweeps away from the body on a broad arc.

### Wing Chun Wraps

- Remove any player-root glow or aura while retaining compact hand/foot strike accents and impacts.
- Render the duplicated wraps at proportional character hand/foot scale.
- Keep Wing Chun the fastest style with a materially shorter chain-punch cadence and compensated per-hit damage near 20 nominal DPS.
- Push centerline punches, oblique kick, and palm burst outward with matching hit envelopes.
- Add a held praying mantis stance between/after combo beats using hooked-hand silhouettes in the shared pose-language/idle-stance machinery.

### Drunken Fist Wraps

- Remove any player-root glow or aura while retaining limb trails, impacts, and the B19 signed lateral weave.
- Render the duplicated wraps at proportional character hand/foot scale.
- Shorten the five-beat sway cadence and compensate damage near 20 nominal DPS, remaining slower than Wing Chun and faster than Muay Thai.
- Increase visible strike travel and matching hit reach without removing the server-authoritative forward/back/lateral motion.
- Replace the falling finisher with a backflip head kick, reusing movement-kit flip presentation so the striking foot travels overhead and outward.
- Add a held crane stance through the shared pose/idle language: one leg raised with guarded arms.

### Iron Palm Wraps

- Remove any player-root glow or aura while retaining palm/foot impacts and quake strike accents.
- Render the duplicated plated wraps at proportional character hand/foot scale.
- Shorten the four-beat heavy cadence and compensate hit damage near 20 nominal DPS while keeping it the slowest style.
- Extend palm, stomp, and quake presentations away from the body with matching hit envelopes.
- Preserve its planted, heavy identity and authored advance/retreat rather than borrowing the acrobatic showcases assigned to other styles.

## Showcase assignment

- Roundhouse kick: Muay Thai.
- Backflip head kick: Drunken Fist.
- Praying mantis pose: Wing Chun.
- Crane pose: Drunken Fist.

## Verification plan

Regenerate shared data, verify generated sources are clean, typecheck, run the full test suite, and validate assets. Then use only private ephemeral client/game ports for a live `proto-cowboy-hidden-face` gate, execute all four full combos facing right and left, and retain screenshots plus telemetry proving zero player auras, proportional wrapped limbs, faster ordered cadences, extended visible/matched reach, the roundhouse, backflip head kick, praying mantis pose, and crane pose under `docs/owner-notes-audit-v11-evidence/b23-kungfu-v2/`.

## Per-style implementation results

### Muay Thai Wraps

- Removed the glove-pair player aura metadata and renamed the old aura-coded recipe to the strike-local `crimson-roundhouse-arc`; no source-centered glow is drawn.
- Set damage/cooldown to `8 / 0.40s`, exactly 20 nominal DPS. Live mean end-to-end beat cadence was 470.8ms, down from the B19 750ms authored cooldown plus the same input/replication pipeline.
- Extended authored step envelopes to 108.56-136.16px and drove visible foot/hand travel from those same values.
- Replaced the final spinning elbow with `Crimson Wheel Roundhouse`: a foot-owned, broad lateral sweep using a 1.5x arc and 1.48x reach. Both-facing showcase screenshots are captured.

### Wing Chun Wraps

- Removed all player-root aura metadata/layers while retaining centerline flashes and impact punctuation.
- Set damage/cooldown to `2.4 / 0.12s`, exactly 20 nominal DPS and the fastest cadence. Live mean end-to-end cadence was 229.2ms.
- Extended authored step envelopes to 111.80-129.00px, with the visible punching/palm receivers consuming the exact shared reach.
- Added the `praying-mantis` idle language. Both wrapped hands now survive the generic performance-pose pass, hold distinct high/low targets, and rotate into opposed hooked silhouettes. Both-facing stance screenshots are captured.

### Drunken Fist Wraps

- Removed all player-root aura metadata/layers while preserving purple strike sweeps, hit punctuation, and the signed lateral sway.
- Set damage/cooldown to `6 / 0.30s`, exactly 20 nominal DPS. Live mean end-to-end cadence was 379.1ms.
- Extended authored step envelopes to 113.28-144.00px while preserving B19's server-owned signed root motion.
- Replaced the falling haymaker with `Upside-Down Gourd Head Kick`. The foot arcs overhead while the complete SpriteRig consumes the movement kit's existing tumble rotation and lift machinery. Both-facing showcase screenshots are captured.
- Added `crane-guard` hands plus `crane-one-leg` feet. The live stance holds one foot more than 20px above its mate and opposing guarded hand angles.

### Iron Palm Wraps

- Removed all player-root aura metadata/layers while retaining planted strike and quake accents.
- Set damage/cooldown to `11 / 0.55s`, exactly 20 nominal DPS and the slowest/heaviest cadence. Live mean end-to-end cadence was 611.1ms.
- Extended authored step envelopes to 115.20-142.08px, with visible palms/stomp and server hit paths sharing the same multipliers.
- Preserved the four-beat planted choreography, 48px finisher knockback, and server-authoritative displacement.

## Cross-cutting corrections

- Removed `auraColor`/`auraRadius` from the glove-pair schema, generator, all six glove-pair catalog rows, and the SpriteRig worn-weapon rendering path. This also removes the cosmetic player auras that had leaked into Sparkknuckle and Coyote Sparkmitt. Explicit gameplay Aura-delivery definitions remain server-authoritative; ordinary weapon/wrap VFX cannot opt into a character-wrapping aura.
- Replaced held-prop `displayLength` scaling for four-limb wraps with receiver-relative fit against the live hand/foot SpriteRig envelope. The live maximum wrap-to-receiver ratios were 1.174 for hands and 1.132 for feet.
- Bound presentation and authority to `meleeReach(weapon) * comboStep.path.rangeMultiplier`; the generic old-range target can no longer clip wrap trails. Live measured endpoints spanned 106.14-144.48px and remained within 18px of the exact authority value at every sampled network frame.
- Kept B19 root displacement, signed Drunken lateral motion, navigation validation, limb mix, impact flashes, and hand/foot strike accents.
- Did not modify wrap PNGs, fan work, B20 surfaces, base character sprites, or pets.

## Verification results

- `pnpm gen`: pass.
- `pnpm gen:check`: pass. The check reported the existing isolated-worktree warning that untracked `tools/artkit/out` references are unavailable and therefore skipped the subject-cache comparison; the tracked subject catalog was restored byte-identically.
- `pnpm typecheck`: pass.
- `pnpm test`: pass, 167 files / 2,244 tests.
- `pnpm assets:check`: pass, 478 sprite entries / 1,007 parts plus atlases, cards, projectiles, particles, and weapon VFX.
- Private live gate: pass on client `51412`, game `51409`; neither protected port `5180` nor `2567` was used.
- Live subject: `proto-cowboy-hidden-face`; four complete combos in both facings, eight telemetry captures, 28 PNG screenshots, and one JSON audit.
- Live assertions: zero player-aura samples; proportional 2+2 wrap mounts; exact motion/limb signatures; faster Wing Chun < Drunken Fist < Muay Thai < Iron Palm cadence; extended visible/authority reach; authoritative travel; roundhouse, backflip head kick, praying mantis, and crane evidence.
- Evidence: `docs/owner-notes-audit-v11-evidence/b23-kungfu-v2/`.

## Files touched

- Catalog/generation/shared contracts: `data/weapon-concepts-300.json`, `tools/artkit/gen-weapon-expansion.mjs`, `packages/shared/src/weapons-expansion.generated.ts`, `packages/shared/src/weapons.ts`, `packages/shared/src/melee.ts`.
- Runtime presentation: `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/entities/kung-fu-wrap-pose.ts`, `packages/client/src/scenes/ArenaScene.ts`, `packages/client/src/sprites/pose-language.ts`, `packages/client/src/vfx/kung-fu-wrap-vfx-recipes.ts`, `packages/client/src/vfx/kung-fu-wrap-vfx.ts`, `packages/client/src/vfx/weapon-effect-recipes.ts`.
- Unit/server tests: `packages/client/src/entities/SpriteRig.glove-pair.test.ts`, `packages/client/src/entities/kung-fu-wrap-pose.test.ts`, `packages/client/src/sprites/pose-language.test.ts`, `packages/client/src/vfx/kung-fu-wrap-vfx-recipes.test.ts`, `packages/server/src/rooms/GameRoom.b23-kungfu-v2.test.ts`, `tests/b23-kungfu-v2.test.ts`, `tests/data-consistency.test.ts`, `tests/owner-notes-nr-redo.test.ts`, `tests/v3c-caster-owner-orders.test.ts`, `tests/weapon-conversions.test.ts`, `tests/weapon-vfx-owner-notes.test.ts`.
- Live gate/report/evidence: `e2e/tests/b23-kungfu-v2-live-gate.spec.ts`, this report, and `docs/owner-notes-audit-v11-evidence/b23-kungfu-v2/`. The B14/B19-named wrap unit, server, and live-gate files were migrated to B23 names.

VERDICT: auras gone, scale fixed, speed up, reach out, roundhouse + backflip + mantis + crane live, DPS bands all exactly 20 (within 18-22), evidence path `docs/owner-notes-audit-v11-evidence/b23-kungfu-v2/`, files touched catalog/generator/shared contracts, SpriteRig/pose/reach/VFX runtime, migrated unit/server/live gates, report, and evidence.
