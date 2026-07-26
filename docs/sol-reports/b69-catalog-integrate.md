# B69 catalog integration

## Result

The merged B63/B66 batch now integrates cleanly at 379 catalog weapons, 359 active weapons, and 20 archived weapons. I kept every census assertion as a literal loss/drift tripwire: deriving an expected count from the same catalog under test would make silent deletion self-validating. Each changed pin names or comments the B69 catalog growth.

The checkout initially exposed 28 deterministic assertion failures plus seven collection failures caused by the gun-SFX import guard. Repairing that guard exposed two additional count assertions that had not been able to run, for 30 deterministic failing tests fixed in total. The seven collection failures are not counted again as test assertions.

No test was deleted, skipped, or loosened. In particular, the recoil, named-pose, mechanism-cycle, hit-envelope, muzzle-derivation, and gun-mechanism ownership laws still sweep their complete cohorts.

## Failure split

| Test | Failure kind | What changed | Why |
| --- | --- | --- | --- |
| `tests/b24-radial-hunt.test.ts` — resolver cohort | count growth | Pinned the final cohort at 340, its active subset at 322, and the blade-trail bucket at 302. | B63/B66 add 17 eligible resolver rows. Restored authored Rimegut VFX remains correctly excluded. |
| `tests/b24-radial-hunt.test.ts` — archive census | count growth | Active catalog 339 -> 359. | Twenty net active catalog rows were deliberately added; archives remain 20. |
| `tests/b30-expunged-vfx-envelope-audit.test.ts` | count growth | Envelope cohort 323 -> 340. | All 340 candidates still satisfy visible-extent equals damage-extent; only the cohort grew. |
| `tests/b30-recovered-orders.test.ts` | count growth | Active catalog 339 -> 359. | The B30 archive contract is unchanged while the active catalog grew. |
| `tests/b31-recovered-art-integrator.test.ts` | count growth | Total 359 -> 379, active 339 -> 359, active expansion 310 -> 330. | The recovered-art law is unchanged; all three live censuses gained the deliberate batch. |
| `tests/b45-gun-recoil.test.ts` | count growth | Ranged-gun cohort 114 -> 130. | All 130 ranged guns, including every new B63 gun, have positive recoil; all four beams recoil and melee/caster roots remain planted. |
| `tests/b48-gun-holds.test.ts` | count growth | Mechanism census 29 -> 30. | The new authored B63 bolt mechanism joins the census; pump 11, lever 10, and revolver/fan 19 ownership pins remain unchanged. |
| `packages/client/src/entities/SpriteRig.ranged.test.ts` | count growth | Tagged mechanism-cycle cohort 29 -> 30. | Every accepted tagged shot, including the new bolt action, still starts exactly one immediate cycle. |
| `tests/b50-caster-vfx.test.ts` | count growth | Active 339 -> 359 and active expansion 310 -> 330. | Cinderquill remains archived and excluded; only the live catalog grew. |
| `tests/b6-weapon-archives.test.ts` | count growth | Total 359 -> 379, active 339 -> 359, active expansion 310 -> 330, resource rows 359 -> 379. | The exact 20-row archive set is unchanged. |
| `tests/b62-legibility.test.ts` | count growth | Active catalog 339 -> 359. | All 359 active weapons resolve player-facing behavior copy. |
| `packages/client/src/audio/gun-sfx.test.ts` — census | count growth | Active guns 122 -> 138. | Sixteen active gun rows joined the exact mapping census. |
| `packages/client/src/audio/gun-sfx.test.ts` and seven importing suites | real defect | Mapped `semi-auto carbine` and `anti-materiel-rifle` to the existing `long-rifle` sound family. | Patriot first exposed an unmapped family, making the import guard throw and preventing collection in the audio, B30, ArenaScene, and MenuScene suites. All 138 active guns now map intentionally. |
| `packages/client/src/sprites/pose-language.test.ts` | real defect | Added the eight new B63/B66 ranged families to the intentional ranged-pose vocabulary. | The new families were falling through instead of receiving named ranged poses. The no-fallback assertion is unchanged and now passes for every current weapon ID. |
| `tests/b66-rimechoir-chime-rack.test.ts` | real defect | Restored Rimechoir's held-sprite manifest entry. | The merged weapon referenced installed art but its manifest row was absent. |
| `tests/b66-rimegut-ice-tongs.test.ts` | real defect | Restored Rimegut's source VFX override and regenerated `weapon-vfx.generated.ts`. | The merge omitted its re-bake-safe hero VFX recipe, which incorrectly admitted it to fallback processing. |
| `tests/data-consistency.test.ts` | real defect | Corrected `data/weapon-concepts-300.json` `byType` to melee 135, ranged 128, caster 97. | The header metadata no longer matched its 360 source rows after the merge. No weapon rows were reordered or reformatted. |
| `tests/v6g-systemic-owner-orders.test.ts` | real defect | Made the muzzle allocator reserve the next catalog row's authored override when selecting a non-overridden frame. | The preceding Anvil hash selection collided with Hailbarrel's mandated `shard` frame. Hailbarrel keeps its authored variant and the no-adjacent-duplicate law passes catalog-wide. |
| `tests/driftblade-model-panel.test.ts` | count growth | Added Miremaw's authored route to the signature golden and moved `arc/default` 122 -> 124. | B66 contributes an intentional shears route and B63/B66 contribute two ordinary arc routes; no authored route was collapsed. |
| `tests/v3g-gun-handling.test.ts` | count growth | Pistol census 32 -> 33. | The new sidearm is included and remains a gun/beam as required. |
| `tests/v3x-auto-rifles.test.ts` | count growth | Portal active count 339 -> 359. | Regeneration publishes Testing Grounds links for the expanded active catalog. |
| `tests/v5g-gun-muzzle-alpha.test.ts` | count growth | Muzzle-definition count and minimum point count 147 -> 163. | Sixteen new gun/muzzle definitions participate in the unchanged art-space derivation law; failures remain empty. |
| `tests/v61-brutalist-greatswords.test.ts` — catalog census | count growth | Total 359 -> 379, active 339 -> 359, resources 359 -> 379. | The six-slab line and 20 archives are unchanged; the surrounding catalog grew. |
| `tests/v61-brutalist-greatswords.test.ts` — portal census | count growth | Portal active count 339 -> 359. | The generated Testing Grounds census tracks the deliberate active batch. |
| `tests/w4a-weapon-archive.test.ts` — catalog census | count growth | Total 359 -> 379, active 339 -> 359, active expansion 310 -> 330, resources 359 -> 379. | All 20 durable archive IDs remain excluded from every active acquisition path. |
| `tests/w4a-weapon-archive.test.ts` — portal/Weaponsmith census | count growth | Portal count, search label, and ARIA set size 339 -> 359; updated the matching static Weaponsmith labels. | The active tool listings grew while archived IDs remain rejected. |
| `tests/weapon-resource.test.ts` — coverage census | count growth | Resource rows 359 -> 379; type census to melee 181, thrown 27, gun 139, cast 5, beam 23, zone 4. | Every catalog row still has exactly one deterministic profile. |
| `tests/weapon-resource.test.ts` — distribution pins | count growth | Gun median 12 -> 10.75 and cast max 30 -> 42. | The added profiles legitimately move the frozen population statistics; formula coefficients and bounds were not changed. |
| `tests/weapon-tiers.test.ts` | count growth | Tier distribution `[70, 73, 65, 67, 64]` -> `[75, 77, 68, 74, 65]`. | All twenty net active additions retain authored tiers and every tier remains populated and bounded. |
| `packages/server/src/rooms/GameRoom.economy-bank.test.ts` | count growth | Testing Grounds roster 339 -> 359. | Paging includes all active weapons; every archived ID is still rejected. |
| `packages/server/src/rooms/GameRoom.test.ts` | count growth | Testing Grounds roster 339 -> 359. | The duplicate server contract now covers the expanded active roster with archive rejection unchanged. |

Count-pin accounting treats each changed exact assertion or exact census/golden object as one pin. That yields 44 pins; generated/static presentation text updated to satisfy those assertions does not add extra pins.

## Real defects found and fixed

1. Two new gun families had no SFX classification. Added intentional `long-rifle` mappings for `semi-auto carbine` and `anti-materiel-rifle`; the active-gun map is now exact.
2. Eight new ranged families were absent from the named-pose vocabulary. Added `anti-materiel-rifle`, `automatic-shotgun`, `battle-rifle`, `light machine gun`, `pistol-calibre-carbine`, `puck-launcher`, `seed-launcher`, and `semi-auto carbine`; no fallback exemption was introduced.
3. Rimechoir Chime-Rack was missing its held-sprite manifest row. Restored the installed 256 x 111 art entry.
4. Rimegut Ice-Tongs was missing its source VFX override. Restored the hero-skin recipe and regenerated the checked-in VFX catalog.
5. Hailbarrel Sledcaster's authored `shard` muzzle override collided with its preceding catalog neighbor. The allocator now avoids consuming an immediately following authored frame, preserving both the override and the adjacency law.
6. The source concept file's `byType` header was stale. Corrected it to match the unchanged row data without reformatting or reordering the file.

The new-weapons behavioral checks are green: 130/130 ranged guns recoil, every current weapon has an intentional named pose, all 30 tagged mechanisms cycle once per accepted shot, all 340 envelope candidates satisfy the hit-envelope law, all 163 muzzle-bearing weapons derive valid art-space points, and no melee/caster root gains recoil.

## Flake verdict

`packages/server/src/settlement-restart.integration.test.ts` was not a catalog failure: it passed the initial runs, the isolated two-file integration run, and both final full suites. One separate `packages/server/src/integration.test.ts` reconnect case timed out once at its five-second limit under parallel suite load. It passed in 278 ms when run with settlement-restart in isolation and passed in both final full suites. Verdict: known parallel-load reconnect flake, unrelated to B69 catalog integration.

## Verification

- `pnpm gen` — pass; final generation is stable at 314 VFX subjects with 46 intentionally skipped missing-reference rows.
- `pnpm gen:check` — pass.
- `pnpm typecheck` — pass.
- `pnpm test` run 1 — 231 files passed; 2,820 tests passed, 20 skipped.
- `pnpm test` run 2 — 231 files passed; 2,820 tests passed, 20 skipped.
- `git diff --check` — pass.
- Off-limits owner-map paths changed — none.

verdict: 30 tests fixed, 44 count-pins bumped, 6 real defects found+fixed, flake verdict: unrelated parallel-load reconnect timeout; settlement-restart green, 2x test results: 231/231 files and 2,820 passed / 20 skipped each run.
