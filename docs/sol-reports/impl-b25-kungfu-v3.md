# B25 Kung-Fu v3 — Theatrical Martial Arts

## Owner contract

B25 keeps Wing Chun as the locked fast/simple baseline and removes its B23 root drift completely. Muay Thai, Drunken Fist, and Iron Palm are rebuilt as compressed action-movie combo bars with server-owned, navigation-validated displacement; whole-body rotation/flip presentation; exaggerated signature-limb stretch; readable silhouette holds between selected beats; and a held finisher pose. Wrap PNGs, base character art, player-aura law, fans/tornadoes, B20/B24 surfaces, pets, and parry paths remain untouched.

The authored displacement values below are signed character-root travel in world pixels. Forward values follow facing; lateral values are perpendicular to facing. Presentation offsets and remote reconciliation consume the authoritative player position rather than predicting a separate cosmetic teleport.

## Planned beat charts

### Wing Chun Wraps — locked baseline

| Beat | Move | Cadence | Root motion | Showcase/presentation |
| --- | --- | ---: | ---: | --- |
| 1 | Centerline Chain I | 0.12s | 0px | Existing compact lead-hand punch |
| 2 | Centerline Chain II | 0.12s | 0px | Existing compact off-hand punch |
| 3 | Centerline Chain III | 0.12s | 0px | Existing compact lead-hand punch |
| 4 | White Oblique Cut | 0.12s | 0px | Existing short oblique kick |
| 5 | Mantis Palm Burst | 0.12s | 0px | Existing double palm and praying-mantis language |

Only the five root-motion entries change: all become absent/zero so a full combo has exactly zero drift in both facings.

### Muay Thai Wraps — forward rocket

| Beat | Move | Cadence | Root motion | Showcase/presentation |
| --- | --- | ---: | ---: | --- |
| 1 | Dragon-Rocket Teep | 0.18s | +288px forward | Long telegraph silhouette, then nav-validated body rocket with a 2.15x foot stretch |
| 2 | Crossing Spear Elbow | 0.18s | +28px forward | Shoulder-led elbow snap |
| 3 | Eight-Limbs Back Elbow | 0.18s | +32px forward | Whole-body paper-rotate/mirror turn through the elbow |
| 4 | Clinch Comet Knee | 0.18s | +44px forward | Rising knee with a held clinch silhouette |
| 5 | Crimson Wheel Roundhouse | 0.18s | +36px forward | Whole-body paper-rotate roundhouse, 2.0x foot stretch, then held champion guard |

Planned full-combo net advance: **428px**. Nominal damage/cooldown target: **3.6 / 0.18s = 20 DPS**.

### Drunken Fist Wraps — sideways chaos and front flip

| Beat | Move | Cadence | Root motion | Showcase/presentation |
| --- | --- | ---: | ---: | --- |
| 1 | Corkscrew Cup Jab | 0.16s | +18px forward, +88px lateral | Violent stagger left with extended wrist |
| 2 | Falling-Gourd Cross | 0.16s | -12px forward, -112px lateral | Full-body counter-weave right |
| 3 | Moon-Sway Backfist | 0.16s | +24px forward, +104px lateral | Broad sideways fling and snap-back hand stretch |
| 4 | Tavern-Floor Sweep | 0.16s | +10px forward, -128px lateral | Low whole-body sweep with an intentional crane silhouette hold |
| 5 | Heaven-Spilling Front-Flip Heel | 0.16s | +156px forward, +40px lateral | Full forward somersault heel drop, 2.2x foot stretch, then held one-leg crane finisher |

Planned full-combo net: **+196px forward / -8px lateral**, with **more than 590px** of traveled path. Nominal damage/cooldown target: **3.2 / 0.16s = 20 DPS**.

### Iron Palm Wraps — advancing weight

| Beat | Move | Cadence | Root motion | Showcase/presentation |
| --- | --- | ---: | ---: | --- |
| 1 | Mountain-Gate Crushing Palm | 0.24s | +52px forward | Heavy palm extension and planted recoil |
| 2 | Furnace Stomp Advance | 0.24s | +112px forward | Body-weight stomp that visibly carries the fighter |
| 3 | Iron Wheel Roundhouse | 0.24s | +72px forward | Full-body paper-rotate roundhouse with 1.9x plated-foot stretch |
| 4 | Mantis Double-Hook Breaker | 0.24s | +96px forward | Both hands stretch to 2.1x reach, snap into opposed hooks, then hold the mantis finisher |

Planned full-combo net advance: **332px**. Nominal damage/cooldown target: **4.8 / 0.24s = 20 DPS**; this remains the heaviest/slower theatrical cadence.

## Implementation journal

- 2026-07-24: Read `impl-b23-kungfu-v2.md`. The requested `docs/sol-reports/impl-b23-integrator.md` is not present in this isolated worktree, so implementation proceeds from the available B23 ship report and the generated/runtime/test sources it names.
- 2026-07-24: Recorded the v3 contract before runtime edits. Planned values intentionally multiply B23 travel (Muay Thai 39px, Drunken path roughly 56px, Iron Palm 30px) while keeping Wing Chun at a literal zero.

### Wing Chun implementation

- Removed all five `rootMotion` blocks from the generated source row. The server therefore schedules no weapon lunge and makes no navigation correction for any Wing Chun beat.
- Kept the B23 five moves, normalized timings, `2.4 / 0.12s` stats, path multipliers, reach, VFX, praying-mantis idle language, and presentation sampler unchanged.
- Preserved the B23 redistributed per-beat damage multipliers independently of root motion, so removing displacement does not silently flatten or change its damage sentence.

### Muay Thai implementation

- Rebuilt the bar at `3.6 / 0.18s` (20 nominal DPS): Dragon-Rocket Teep, Crossing Spear Elbow, Eight-Limbs Back Elbow, Clinch Comet Knee, and Crimson Wheel Roundhouse.
- Authored server root motion of `288 + 28 + 32 + 44 + 36 = 428px` forward. The 288px opener traverses its validated segment over 0.14s through the existing weapon-lunge stepper.
- Added a 2.15x teep stretch, full paper mirror-turn on the back elbow, full paper mirror-turn plus 2.0x foot stretch on the roundhouse, a clinch silhouette pause, and a held champion-guard finish.

### Drunken Fist implementation

- Rebuilt the bar at `3.2 / 0.16s` (20 nominal DPS): Corkscrew Cup Jab, Falling-Gourd Cross, Moon-Sway Backfist, Tavern-Floor Sweep, and Heaven-Spilling Front-Flip Heel.
- Authored violent signed displacement `(18,+88), (-12,-112), (24,+104), (10,-128), (156,+40)px`. Net travel is `+196px forward / -8px lateral`; total traveled path exceeds 590px.
- Replaced the B23 backflip with a full forward somersault using the movement-kit tumble rotation, added 1.65–2.2x signature limb stretch, and holds the one-leg crane silhouette after the sweep and as the finisher.

### Iron Palm implementation

- Rebuilt the heaviest bar at `4.8 / 0.24s` (20 nominal DPS): Mountain-Gate Crushing Palm, Furnace Stomp Advance, Iron Wheel Roundhouse, and Mantis Double-Hook Breaker.
- Authored `52 + 112 + 72 + 96 = 332px` of weighted forward advance, including a 112px stomp and 96px finisher drive.
- Added a full paper mirror-turn plus 1.9x plated-foot stretch on the roundhouse, 2.1x opposed hand stretch on the double hook, and a praying-mantis hold that resolves continuously into the style's new mantis idle silhouette.

### Shared implementation

- Extended the generated combo schema with presentation-only `paperTurns`, `flip`, `limbStretch`, `holdPose`, and `holdStart` channels while leaving `rootMotion`, `path`, and damage authority separate.
- Raised the generated per-beat root-motion authoring band to the existing Stormfist-scale 480px ceiling.
- The SpriteRig consumes paper turns through an invertible whole-root scale-through-plane, front flips through the movement kit's retained tumble helper, and stretch through the independent worn-hand/worn-foot mounts. Every stretch channel resets to exactly 1.
- Routed all four foot-wrapped styles through the accepted server combo selector, rather than replaying opener authority through the ordinary melee fallback. Per-step root motion and damage multipliers now advance together.
- The server and owner-predicted client share the same theatrical combo grace calculation. Remote rigs consume the replicated accepted sequence and the same generated beat, while root position continues to reconcile from the server-owned, navigation-validated player transform.
- Added allocation-free render high-water evidence to SpriteRig. This is reset by the live gate and records only theatrics actually sampled by a rendered rig frame; apex screenshots freeze the scene on the exact paper-turn, mid-flip, stretch, and finisher-hold frames.

## Verification

- `pnpm gen`: green; regenerated 336 weapons and 37 combo bars.
- `pnpm gen:check`: green. The existing missing local weapon-reference-art warning correctly skipped only the unrelated VFX-subject comparison.
- `pnpm typecheck`: green across shared, client, and server.
- `pnpm test`: green, **167 files / 2,199 tests**.
- `pnpm assets:check`: green, **478 sprite entries / 1,007 parts**, including expansion and loose weapon-VFX checks.
- Focused B25 verification: **78 tests** across the generated catalog, pose sampler, SpriteRig wrap ownership, VFX recipes, pose language, and server authority/navigation. The server suite includes exact full combos in both facings, the accepted live selector chain, multi-slice 288px rocket motion, and pit-edge nav clamping.
- Private live gate: green on client `61012` / game `61011`; neither protected port was used. Character: `proto-cowboy-hidden-face`. Eight full captures cover all four wraps in both facings.
- Observed median live cadence: Wing Chun **183.4ms**, Drunken Fist **200ms**, Muay Thai **250ms**, Iron Palm **275ms**. The authored cadence remains 120/160/180/240ms respectively, and the rebuilt styles are more than 20% faster than their B23 live baselines.
- Observed navigation-valid travel: Wing Chun **0px path and net** in both facings; Muay Thai **424.7–428px** forward; Drunken Fist **208.7–218.8px net** with **463.3–530.8px sampled zig-zag path**; Iron Palm **309.4–332px** forward. Server tests separately prove the exact authored step vectors before legitimate navigation correction.
- Render evidence recorded full-root mirror scales of `-1`, a **6.28-radian** Drunken front-flip frame, **2.0–2.2x** signature limb stretch, and the champion-guard, crane-one-leg, and praying-mantis holds.
- Evidence: `docs/owner-notes-audit-v11-evidence/b25-kungfu-v3/live-gate.json` plus 36 stance/limb/showcase/finisher PNG captures and incremental `live-gate-progress.json`.

VERDICT: Wing Chun pinned baseline zero-drift at 0.12s and 0px; Muay Thai theatrical at 0.18s / 428px with dragon-rocket teep, paper-turn back elbow and roundhouse, stretch, clinch and champion guard; Drunken Fist theatrical at 0.16s / +196px forward, -8px lateral and >590px authored path with violent weaves, front-flip heel drop, stretch and crane finisher; Iron Palm theatrical at 0.24s / 332px with stomp advance, paper-turn roundhouse, stretched mantis double hook and mantis finisher; all four nominal DPS bands are exactly 20; evidence: `docs/owner-notes-audit-v11-evidence/b25-kungfu-v3/`; files touched: weapon concept/generated combo data and generator schema, shared melee types/grace, SpriteRig and kung-fu pose/VFX/Arena client paths, GameRoom combo/root/damage authority, migrated B25 unit/server/live tests, this report, and B25 evidence.
