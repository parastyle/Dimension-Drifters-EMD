# B14 Catalog Integrator

## Understanding

B14 adds four close-range, dual-hand kung-fu wrap weapons to the expansion catalog. Each weapon must use its installed art, expose an impact-frame striking-hand centroid as its generated muzzle, reuse the established glove-pair pose vocabulary (including `mirror-guard` for the passive hand), and ship with a mechanically and visually distinct melee combo. The implementation must preserve all existing weapon behavior and avoid changes to whole-art characters, pets, B2/B3 weapons, and the B17 pose-language schema.

All four styles target nominal sustained DPS in the 18–22 range while expressing that output differently:

- **Muay Thai Wraps** — a close, deliberate elbow/knee/heavy-kick sequence with slower cadence, large individual hits, heavy dust, and a red aura.
- **Wing Chun Wraps** — an ultra-short, straight-line three-hit chain-punch blitz with the fastest cadence, low damage per hit, precise white flashes, and high hit frequency.
- **Drunken Fist Wraps** — a medium-cadence sway/duck/weave sequence with subtle forward drift, an occasional wide haymaker, misty-purple haze, and a broad sweep.
- **Iron Palm Wraps** — the slowest, hardest-hitting iron-knuckle sequence with visible spike-led impacts, metallic sparks, a clang character, and a shockwave.

## Planned combo signatures

| Weapon | Beat signature | Passive-hand pose | Intended feel |
| --- | --- | --- | --- |
| Muay Thai Wraps | elbow → knee/foot-rig strike → heavy kick/finisher | `mirror-guard` | brutal, compact, high commitment |
| Wing Chun Wraps | lead straight → rear straight → chain-punch finisher | `mirror-guard` | rapid, precise, linear blitz |
| Drunken Fist Wraps | weaving jab → ducking cross → wide gourd-wrist haymaker | `mirror-guard` | irregular sway with forward drift |
| Iron Palm Wraps | iron-knuckle drive → guarded reset → crushing palm/knuckle finisher | `mirror-guard` | slow, metallic, maximum per-hit force |

## Plan

1. Census the shipped B2/B3 integration pattern, B14 art reports and PNG metadata, existing glove-pair pose language, generator muzzle inputs, server melee sequencing, VFX recipes, and catalog tests.
2. Add four GRIP/dual-hand concept rows with close range and style-specific stat tradeoffs.
3. Add exact-dimension sprite manifest entries, preserving paired part-1/part-2 art, and author impact-frame striking-hand centroid muzzle inputs.
4. Add four shared combo definitions and wire the server to execute each distinct cadence, hit sequence, hand/foot posing, and Drunken Fist micro-movement without changing existing combos.
5. Add four distinct client VFX recipes and integration coverage for rows, signatures, textures, alpha bounds, and nominal DPS.
6. Run generation, checks, typecheck, full tests, and asset validation; then exercise all four weapons in both facings on the whole-art default character using private ephemeral ports and retain evidence under `docs/owner-notes-audit-v10-evidence/b14-kungfu/`.
7. Append per-weapon implementation results and finish this report with the required census/verdict line.

## Shared integration

- Extended the expansion generator with the `impactMuzzle` contract, the nine B14 combo motions, and validated per-beat forward-drift multipliers. The muzzle generator now derives impact centroids for every authored wrap part.
- Added shared melee motion vocabulary and four generated authoritative combo bars. The server consumes those shared bars and applies Drunken Fist's bounded per-beat displacement through the existing server-owned lunge seam.
- Added a pure, allocation-free full-body wrap pose sampler. `SpriteRig` routes the four scrolls through one shared dual-hand combo chain, animates both weapon hands, and owns body and foot-rig channels for knees, kicks, sways, planted knuckles, and the two-hand palm. The passive hand retains B17's existing `mirror-guard` language.
- Added procedural swing and confirmed-impact VFX recipes, impact-frame muzzle placement, combat-receipt routing, and a sample-first `kungfu:iron-clang` cue with a synthesized fallback.
- Added catalog, alpha-bound, no-dangle, muzzle, DPS, combo, pose, server-drift, census, and private-stack integration coverage. Existing weapon combo definitions were not modified.

## Muay Thai Wraps

- Catalog: `2H`, glove-pair, `M`, close range; 15 damage / 0.75 s cooldown / 72 range = 20 nominal DPS.
- Combo signature: `elbow → knee-strike → roundhouse-kick`. The knee and roundhouse explicitly own front-foot lift/extension, while the passive wrap stays in `mirror-guard`.
- Art and impact origin: one native 384×323 part; striking-hand centroid `(196, 161.3)`.
- VFX: crimson eight-limbs swing aura plus a heavy dust-cloud confirmed impact.

## Wing Chun Wraps

- Catalog: `2H`, glove-pair, `S`, close range; 4 damage / 0.20 s cooldown / 62 range = 20 nominal DPS.
- Combo signature: lead `chain-punch →` off-hand `chain-punch →` lead `chain-punch`, all straight capsules with 1.08/1.12/1.16 short-reach multipliers. It is the narrowest, fastest, lowest-per-hit style.
- Art and impact origins: native 512×208 and 511×208 paired parts; alternating striking-hand centroids `(264.5, 106.5)` and `(264.2, 106.7)`.
- VFX: three rapid white centerline flashes and precise white confirmed-impact punctuation.

## Drunken Fist Wraps

- Catalog: `2H`, glove-pair, `M`, close range; 10 damage / 0.50 s cooldown / 86 range = 20 nominal DPS.
- Combo signature: `sway-jab → weave-cross → gourd-haymaker`. The first two beats lean to opposite sides; the gourd wrist finishes on a wide 1.28× sweep.
- Server micro-movement: 42 px/s for 0.14 s with 0.65/1.05/1.45 beat multipliers, yielding bounded forward drifts of approximately 3.82/6.17/8.53 px.
- Art and impact origins: native 512×235 and 468×228 paired parts; centroids `(249, 123.2)` and `(246.4, 120)`.
- VFX: mist-purple sway haze plus a broad purple confirmed-impact sweep.

## Iron Palm Wraps

- Catalog: `2H`, glove-pair, `M`, close range; 18 damage / 0.90 s cooldown / 78 range = 20 nominal DPS. This is the slowest cadence and highest per-hit damage of the four.
- Combo signature: `iron-knuckle → iron-knuckle → iron-palm`; the last beat drives both plated hands from a deep plant and carries 42 knockback.
- Art and impact origins: native 512×264 and 511×267 paired parts; iron-spike centroids `(250.2, 130.2)` and `(249.4, 134.3)`.
- VFX/audio: black-iron drive, clanging sparks, concentric shockwave, and the dedicated iron-plate clang cue.

## Verification and retained evidence

- `pnpm gen`: passed; 336 generated expansion definitions, 37 generated combo bars, 155 derived muzzle definitions, and 346 active portal weapon rows.
- `pnpm gen:check`: passed. Its existing VFX-subject check reported the expected skip for 24 unavailable untracked artkit reference artifacts; all tracked generated artifacts were in sync.
- `pnpm typecheck`: passed across shared, server, and client.
- `pnpm test`: passed, 162 files / 2,203 tests.
- `pnpm assets:check`: passed, 474 sprite entries / 1,002 parts, including all seven B14 PNG parts with visible alpha-bound and impact-anchor coverage.
- Private live gate: passed on game port 51461 and client port 51463, never 5180/2567, using `proto-cowboy-hidden-face`. Eight PNGs cover all four weapons facing both right and left. The retained JSON proves canonical 0→1→2 motions, four swing styles, four impact styles, confirmed contacts for every weapon, and observed mean cadences of Wing Chun 254.15 ms, Drunken Fist 524.98 ms, Muay Thai 787.45 ms, and Iron Palm 916.63 ms.
- Evidence: `docs/owner-notes-audit-v10-evidence/b14-kungfu/`.

## Files touched

- Catalog/generation: `data/weapon-concepts-300.json`, `data/weapon-muzzle-overrides.json`, generated expansion/muzzle artifacts, generator validation, muzzle derivation reports, portal output, and Weaponsmith/catalog census text.
- Shared/server: melee motion types, weapon contracts, resource census, `GameRoom` combo drift execution, and server coverage.
- Client: sprite manifest, full-body wrap pose sampler, `SpriteRig`, `ArenaScene`, two wrap VFX modules, `AudioBus`, and client pose tests.
- Integration/audit: B14 catalog test, census regression updates, private-port Playwright gate, eight facing PNGs, live-gate JSON, and this report.

verdict: 4 wired, 4 distinct combo signatures, 20 nominal DPS each (within the 18–22 ballpark), evidence path `docs/owner-notes-audit-v10-evidence/b14-kungfu/`, files touched catalog/generator/shared/server/client/VFX/audio/tests/e2e/report/census, weapon-count census concepts 334→338, durable runtime 353→357, active runtime 342→346, active expansion 313→317.
