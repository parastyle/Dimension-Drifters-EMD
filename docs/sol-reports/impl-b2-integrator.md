# B2 Catalog Integrator

## Understanding

Wire the seven installed B2 art assets into the shipped weapon catalog as complete, playable `WeaponDef` entries. Each weapon must have a behavior and visual/mechanical signature distinct from the other six and from palette-swap equivalents. The integration includes authored concepts, generated/shared definitions and muzzle data, client sprite manifests, shipped VFX behavior, regression coverage, asset/census checks, and private-port live-gate evidence. No standing rope, chain, tassel, or other unsupported physics is introduced.

Target census: 325 -> 332 weapons.

## Planned behavior signatures

- `x2-unicorn-rainbow-beam`: continuously anchored broad beam, rendered as five parallel rainbow-colour ribbon strands from the visible horn business end; beam damage cadence rather than projectile travel.
- `x2-fish-launcher`: gun-style multi-projectile cone whose fish payloads travel outward and produce a wet-slap hit treatment.
- `x2-squeaky-mallet`: short-reach blunt quake-mauler swing with high per-hit damage, a long recovery, and a squeak impact treatment.
- `x2-exploding-present-lobber`: single arced grenade-like gift projectile with delayed/contact detonation and a confetti-shrapnel burst.
- `x2-bubble-wand-swarm-caster`: multi-bubble caster volley with gentle homing/drift toward the cursor line and small pop AoE on contact.
- `x2-boomerang-boot`: own-sprite thrown projectile with outbound travel and a returning phase toward its owner.
- `x2-confetti-cannon`: loud, high-recoil shotgun discharge with a chaotic close-range confetti-shrapnel spread.

## Plan

1. Read all seven art-Sol reports, beam-structure guidance, owner notes, and the authored/generated catalog paths.
2. Select existing shipped behavior families that preserve each required signature without introducing unsupported physics.
3. Add complete concept rows with coherent art metadata, balanced cadence/damage/range values, texture references, projectile/VFX settings, and visible-business-end muzzle coordinates.
4. Regenerate derived weapon, muzzle, and manifest data; add any required client VFX recipes/dispatch.
5. Extend catalog tests for all seven expansion rows, signature uniqueness, textures, dimensions, and visible alpha bounds.
6. Run generation checks, typecheck, full tests, and asset checks.
7. Run the gallery/live gate on private ephemeral ports, capture both facings and combat/VFX evidence under `docs/owner-notes-audit-v10-evidence/b2-wacky/`.
8. Append per-weapon implementation and verification results, then commit on `sol/b2-integrator`.

## Implemented weapons

### Unicorn Rainbow Beam

- Authored as the existing server-owned `beam` delivery, with `20 DPS`, `0.1 s` ticks, `520 px` range, a `64 px` gameplay width, `0.65 s` charge, and `0.12` sweep lag.
- The visible horn tip is authored at source pixel `(383, 99)` on the native `384 x 217` sprite.
- `BeamRenderer` retains the authoritative muzzle/world transform and adds a broad dark underlay plus five independently coloured parallel ribbon strands. The live audit records a sub-pixel muzzle delta, `61.70-62.22 px` visible width, five strands, and the same five-colour palette on both facings.

### Fish Launcher

- Authored as a `gun` delivery firing four `5`-damage fish in a `0.36 rad` cone every `0.9 s`, with `720 px/s` travel and a four-round magazine.
- The launch mouth is authored at `(767, 109)` on the native `768 x 218` sprite.
- Procedural fish payloads and wet-slap impacts are dispatched through the B2 VFX recipe; the wet slap also has a dedicated synthesized audio cue.

### Squeaky Mallet

- Authored through the shipped rigid `maul` / `quake-mauler` family: `15` direct damage plus a `7.5`-damage, `90 px` quake on a long `1.5 s` recovery, with short `82 px` reach.
- The native `384 x 241` sprite remains a melee-held texture and intentionally has no projectile muzzle.
- Its custom contact signature is a squeak cue layered over the existing physical aftershock recipe. No rope, tassel, chain, or flexible physics was introduced.

### Exploding Present Lobber

- Authored as a `heavy-ordnance` grenade gun: `8` direct damage, `120 px` arc, and an `11`-damage `58 px` detonation every `0.9 s`.
- The wrapping-paper barrel end is authored at `(511, 103)` on the native `512 x 224` sprite.
- The projectile uses a gift-box treatment and detonates into the dedicated present-confetti burst.

### Bubble Wand Swarm Caster

- Added the generated/shared `cast` delivery contract and authored five `520 px/s` orb projectiles in a `0.2 rad` fan. A `20 px / 1.4 Hz` waveform supplies gentle cursor-line drift, and each bubble pops into a small `36 px` AoE.
- Direct plus pop damage yields `22.22` nominal DPS while splitting the authored damage pool across the five projectiles.
- The ring tip is authored at `(299, 70)` on the native `300 x 221` sprite; the held size remains on the established `90 px` caster baseline.

### Boomerang Boot

- Extended the shared thrown contract with the strict `returning: true` signature. The native `246 x 256` weapon sprite travels outward at `680 px/s`, spins, reverses after the outbound range, clears its outbound hit ledger, re-arms its pierce budget, and homes back to its living owner.
- The projectile uses its own weapon sprite rather than a generic bullet. Server tests and the live gate both observe outbound damage, reversal, return travel, and owner catch/removal.

### Confetti Cannon

- Authored as a rigid `scrap-cannon` with a mechanically shotgun-like seven-pellet `0.55 rad` cone, `3` damage per shard, `0.9 s` cadence, two-round magazine, and `2.2x` user knockback.
- The rigid painted foregrip remains a horizontal support grip rather than falsely claiming a pump action.
- The bell muzzle is authored at `(1379, 291)` on the native `1380 x 693` sprite. The dedicated shot/impact recipe produces chaotic confetti shards and bursts, with loud boom/recoil audio treatment.

## Distinct signatures and balance

| Weapon | Mechanical signature | Visual/audio signature | Nominal DPS |
| --- | --- | --- | ---: |
| Unicorn Rainbow Beam | anchored broad beam | five-strand rainbow ribbon | 20.00 |
| Fish Launcher | four-projectile gun cone | fish payloads + wet slap | 22.22 |
| Squeaky Mallet | short quake-mauler | physical aftershock + squeak | 15.00 |
| Exploding Present Lobber | arced grenade detonation | gift projectile + present-confetti burst | 21.11 |
| Bubble Wand Swarm Caster | five drifting cast projectiles + pop AoE | translucent bubbles + bubble pop | 22.22 |
| Boomerang Boot | own-sprite outbound/returning throw | spinning boot with return phase | 16.67 |
| Confetti Cannon | seven-shard close spread + heavy recoil | chaotic confetti burst + loud boom | 23.33 |

The catalog test serializes the complete mechanics and combines that value with each authored VFX signature. Both the mechanical set and the visual-signature set contain exactly seven members, so no two B2 rows share the same visual/mechanical signature.

## Catalog and generated census

- Requested ledger target: `325 -> 332`.
- The isolated branch actually began with `324` concept rows and now contains `331` (`123` melee, `111` ranged, `97` caster). This is the same exact `+7` delta; there was no pre-existing B2 stub to replace.
- Generated expansion definitions: `329`; active expansion rows: `310`.
- Durable runtime catalog: `343 -> 350`; active runtime catalog/gallery: `332 -> 339`; archived rows remain `11`.
- Delivery census is now `172 melee`, `27 thrown`, `121 gun`, `3 cast`, `23 beam`, and `4 zone`.

## Verification and retained evidence

- `pnpm gen`: passed; expansion, muzzle, dimension, card, projectile, Weaponsmith, VFX, and portal outputs regenerated.
- `pnpm gen:check`: passed. Its existing fresh-worktree warning notes unavailable ignored weapon-reference artifacts and skips only that reference-dependent VFX-subject check.
- `pnpm typecheck`: passed for shared, server, and client.
- `pnpm test`: passed, `156` files / `2,003` tests.
- `pnpm assets:check`: passed, `443` sprite entries / `848` parts, including `357` loose expansion parts.
- `pnpm e2e -- e2e/tests/b2-wacky-live-gate.spec.ts`: passed on private ports `54462` (game) and `54463` (client); neither reserved port was used, and the temporary stack was stopped afterward.
- Live assertions: fourteen captures retained; both facings for every weapon; every facing dealt damage; authored projectile/impact VFX observed; rainbow beam muzzle anchoring, broad width, and five strands proved; Boomerang Boot own-sprite return proved.
- Evidence: `docs/owner-notes-audit-v10-evidence/b2-wacky/live-gate.json` plus fourteen labeled PNG captures in the same directory.
- `git diff --check`: passed.

## Files touched

- Catalog/generation: `data/weapon-concepts-300.json`, `data/weapon-muzzle-overrides.json`, `tools/artkit/gen-weapon-expansion.mjs`, `tools/artkit/gen-weapon-muzzles.mjs`, generated expansion/muzzle outputs, muzzle derivation reports, portal, and Weaponsmith census.
- Shared/server: `packages/shared/src/weapons.ts`, `packages/shared/src/weapon-resource.ts`, generated weapon data, `packages/server/src/rooms/GameRoom.ts`, and its authority tests.
- Client: sprite manifest; `ArenaScene`; `AudioBus`; beam, caster, quake, and B2 wacky VFX recipes/renderers/tests.
- Acceptance: catalog/census/alpha-bound tests, `e2e/tests/b2-wacky-live-gate.spec.ts`, fourteen live PNGs, `live-gate.json`, and this report.

VERDICT: 7 wired, 7 distinct behavior signatures, DPS ballpark 15.00-23.33, evidence path `docs/owner-notes-audit-v10-evidence/b2-wacky/`, files touched catalog/generator/shared/server/client/VFX/tests/e2e/report, weapon-count census 325 -> 332 (requested ledger; isolated worktree observed concepts 324 -> 331, durable runtime 343 -> 350, active runtime 332 -> 339).
