# Overnight session summary — 2026-07-23

Autonomous run while the owner slept. Everything below is committed + **pushed** to
`origin/feat/v0.118-metagame`. Full suite green at wrap: **144 files / 1831 tests**, typecheck clean.

## Landed + pushed

### Character rendering (the main frustration — FIXED)
- **Whole-art characters now render their own art.** New `whole-art-character.ts` + `SpriteRig`/
  `ArenaScene` changes: a character whose id starts with `proto-` loads its own six part textures
  (`char:<id>:{body,head,hand-l,hand-r,foot-l,foot-r}`) and bypasses the wardrobe gear bake.
- **Verified LIVE by me** (not a Sol self-report): probed the running client for all three —
  proto-sheriff / proto-samurai / proto-witch each render `char:<id>:*` on the rig with **zero**
  `gear-bake`/`boilerplate`, floating head bobbing. Use `?dev=char:proto-sheriff` (hard-reload first).

### Game-notes program (ledger `docs/sol-reports/notes-ledger-v9.md`)
403 owner notes → 243 normalized intents → **211 already done**, 32 outstanding, batched B1–B13.
Landed 7 of the mechanical batches (game-first):
- **B1** — damage numbers stay screen-upright through the real transform chain; 22 asymmetric
  projectiles (incl. holy skull) mirror instead of rotating through π.
- **B4** — Galvanic Overcasters moving-fire regression fixed (rig/authority 444px→48px, live-gated at
  low + 150ms latency).
- **B5** — Sparkknuckle Hex-Mitt baked-movement removed (0px drift); Thunderhead Stormfists is now a
  server-authored destination-dash (480px in 0.025s, endpoint-locked punch).
- **B6** — Coffin-Nail Carbine + Psalter of the Burning Halo archived (out of all pools, save-safe).
- **B9** — Idol 1.4x, Dervish 2x, Mournveil 1.3x, Gravewind 2x (added `collisionLength` so display size
  never changes gameplay reach/muzzle); Prismhex mirrored (thumb correct both facings).
- **B10** — Fulgurite blue + no dead annulus; Tombstone bone particles removed (stones+smoke kept);
  Thunderhead Voulge big blue; Sanctified Headsman extendo-blade VFX/override fully removed.
- **B8** — pose/grip/combo for 8 weapons: Gravewarden continuous beyblade spin, Saint-Bough one-hand
  walking staff, Nullspike 3-thrust combo, Voltedge near-ear stab, Sunbreaker/Fool's-Gold grip fixes,
  Hollowbarrel horn-to-face. (Landed after `continue`: reconciled the 2 invariance tests its intentional
  routing/reclassification changes broke — verified only the 3 intended weapons moved.)

### Audits (5-Sol read-only fleet) — `docs/sol-reports/audit-*.md`
structure, movement, weapons, QA, and an orchestration synthesis. Headline: the codebase has a
"green tests, wrong runtime" boundary-coverage gap (exactly what let the character-render bug ship
untested). See `audit-orchestration.md` for the recommended wave program.

### Test-infra root fix
Hardened a whole class of **RNG-stream flakes**: GameRoom tests depended on global `Math.random`
stream position, so any catalog change reshuffled it and flipped position-sensitive assertions
(§16/§46/§50/V6M all tripped as batches landed). Now seeded per-test via `makeRng` in a module-scope
`beforeEach`. audit-qa had flagged this exact gap.

## Deferred (NOT merged) — with reasons

### On branches, ready for completion
- **B7 thrown conversions** (`sol/b7-thrown`) — Sidewinder Spontoon / Stormcrow Twin-Hatchets /
  Boothook Harpoon. The implementing Sol **hung twice** on this task; the branch has code-only WIP with
  **no tests and no verification**, and it branched from before the wave landed so it conflicts heavily
  with current main — do not merge as-is. Cleanest path: re-implement fresh from current main (or by
  hand) with a thrown-behavior test + live gate. THE ONLY mechanical batch not landed.

### Need generated art + owner aesthetic review (queued in ledger)
- **B2** seven "wacky" weapons (unicorn rainbow beam + fish launcher, rubber-chicken flail, etc.)
- **B3** fan melee/projectile hybrids (min 3)
- **B11** generated-image VFX; **B12** Mirage extension; **B13** Wyrmskull mouth-open 2nd frame.
Deliberately NOT auto-shipped overnight — new content + art needs your eye (per the "one image subject
per agent" law and past art-bleed lessons).

## Suggested next moves
1. Try the sheriff/samurai/witch in-game (`?dev=char:proto-*`) and confirm they read right.
2. Reconcile B8's two invariance tests → merge `sol/b8-pose` (fast, high value — 8 weapons).
3. Complete + verify B7 (`sol/b7-thrown`).
4. Review/kick off the art batches (B2/B3/B11/B12/B13) when you can art-direct.
