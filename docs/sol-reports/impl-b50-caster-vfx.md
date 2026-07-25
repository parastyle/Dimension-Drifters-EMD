# Sol report — B50 caster/VFX corrections

Branch: `sol/b50-caster-vfx`  
Owner notes: 2026-07-24/25  
Schema: CURRENT retained; no schema-version change was required.

## Delivered

1. Hexbinder's Iron Orrery now uses the shipped held-beam authority and renderer:
   - 130 DPS, 0.1 s tick, 320 range, 56 width, 0.65 s charge, 0.28 s sweep lag.
   - Its former eight-pellet + explosion ceiling was 133.333 DPS, so the new ratio is 97.5%.
   - A distinct purple braided/double-helix recipe uses the shipped converging-strands structure, arcane particles, and no ambient/player aura, chain, or radial ring.
2. Emberleaf Chapbook now holds its painted open frame for the replicated charged-projectile state:
   - The charge state is ingested through the existing authoritative rig clock for local and remote actors.
   - The growing fireball resolves the final open-tome bitmap center through the live affine, including mirrored facing; the prior muzzle is only a load-window fallback.
3. Verdigris Grand Grimoire now uses the open book plus painted page projectiles as its complete look:
   - Generic brown page-turn quads and scraps are suppressed.
   - Nine deterministic lanes start within 16 px of the live book center and travel in a forward ±0.42 rad cone.
   - The seven-times page projectile scale and 400 server reach remain pinned.
4. Cinderquill Almanac is archived:
   - Removed from starter unlocks, active catalog/expansion IDs, drop pool, locked pack candidates, portal, Weaponsmith, and live `devEquip`.
   - Retained in the durable catalog/resource profile for old receipts and census safety.

## Census migration

- Durable weapons: 358
- Active weapons: 338
- Archived weapons: 20
- Active expansion weapons: 309
- Starter weapons: 73 across 57 families
- Resource delivery: 178 melee, 27 thrown, 122 gun, 4 cast, 23 beam, 4 zone
- Installed gun/beam muzzle rows: 146

## Verification

- `pnpm gen` — pass
- `pnpm gen:check` — pass (the existing fresh-worktree VFX-subject check skipped because untracked reference art is unavailable)
- `pnpm typecheck` — pass
- `pnpm test` — pass, 212 files / 2,734 tests
- `pnpm assets:check` — pass, 479 sprite entries / 1,011 parts
- `pnpm exec playwright test --config=e2e/playwright.config.ts b50-caster-vfx-live-gate.spec.ts` — pass
  - Private ports: client 65082 / game 65081; default 5180/2567 avoided.
  - Both facings captured for Orrery, Emberleaf, and Verdigris.
  - Live receipts pin Orrery phase/length/width/structure, Emberleaf open texture and zero-pixel center error, Verdigris nine cone lanes and zero visible generic page/scrap shapes, and Cinderquill rejection.
- `git diff --check` — pass

## Evidence

`docs/owner-notes-audit-v12-evidence/b50-caster-vfx/`

The directory contains six facing-specific PNGs, `live-gate.json`, and a concise README.

verdict: 4 orders done, evidence path docs/owner-notes-audit-v12-evidence/b50-caster-vfx/, files touched 46.
