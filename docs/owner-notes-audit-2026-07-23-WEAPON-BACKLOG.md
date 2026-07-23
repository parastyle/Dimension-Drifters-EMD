# Outstanding weapon-order backlog (consolidated 2026-07-23)

The V7 `v7-ranged-orders` (18) and `v7-melee-caster-orders` (9) Sols + the archives + the qualification
pass NEVER RAN — they were serialized behind katana and the queue got interrupted by feel-fixes and the
character/pet pivot. Plus the V8 Wave C weapon rows. Owner correctly flagged this (Gravelthroat still
`directions:"radial"` = 360, not the ordered CONE). This ledger tracks EVERY outstanding weapon order so
nothing is lost again. Each batch is AUDIT-then-IMPLEMENT (verify current WeaponDef first; skip anything
already satisfied) and runs in its OWN git worktree, SERIAL on the shared weapon catalog (merge between).

## Confirmed ALREADY DONE (do not redo — audit to confirm)
- 4 throwing stars (iron/fire/ice/void) — shipped (v8-thrown-and-sniper).
- Hailwidow Katana +1.5x — shipped (v7-katana).
- Galvanic Overcasters — PROJECTILE half shipped (a1ed5cb); CHARACTER-movement half still OPEN (separate netcode fix).
- Frostquill Compendium ice-particle beam / Stormcaller 6 beams — AUDIT: may be covered by v7-beam-structures; verify, implement if not.

## BATCH R — Ranged orders (worktree `ranged-orders`)
- Gravelthroat Repeater — random spread constrained to the muzzle CONE, not 360 (currently radial/360).
- Plaguespitter Flak Gun — more green projectiles at once, random patterns WITHIN A CONE.
- Brimstone Gallows-Rifle — shoots tiny FLAMING CROSSES (generated art), barrel-aligned.
- Brimstone Rocket Tube — one hand on trigger; gun slightly more FORWARD; bigger explosion.
- Mesa Hand-Cannon — explosion on detonation; +0.5s between shots (redistribute DPS).
- Tesla Faradayer — hand-drawn (generated) projectiles.
- Sanctus Siege Bombard — 5x player knockback.
- Stormcaller Tesla Gatling — 6 beams visible (not 3), barrel-aligned (AUDIT vs beam-structures first).
- Sidewinder Spitfire — two parallel bullets.
- Gravelung Punt-Rifle — bullet 2x size.
- Ironhide Buffalo Gun — anti-tank 50-cal shell / 50-cal shots (v7+v8 same order).
- Galvanic Coachgun — blue electrical bullets.
- Ricochet Pistol — icicle shots.
- Hailspitter Pepperbox — 7 tight parallel shots spanning the barrel width.
- Dustline Lever-Action — gun +60% size.
- Hexbore Voidmaw — -20% size, one-handed pistol; re-render art COMPLETELY FLAT side profile (keep VFX).
- Tesla Drumbore — shoots electric particles.
- Frostfang Speargun — shoots its pictured harpoon (generated).
- Thunderhead Lever-Gun — blue HELIX shots.
- Thunderhead Repeater Cannon — circle energy shots ("smoke ring from a mouth").
- Ironhail Pepperbox — hand on the trigger.
- Hailstorm Coilgun — grip fix: stock UNDER the shoulder (not held); stock hand FORWARD of the barrels as support.

## BATCH M — Melee / caster / carry orders (worktree `melee-caster-orders`)
- Gravewarden Buster — frontflip becomes continuous smooth beyblade spin.
- Sidewinder Spontoon — thrown weapon.
- Fulgurite Storm-Sphere — blue VFX; fill dead space between aura and player.
- Boothook Harpoon — thrown over the shoulder.
- Tombstone Greatsword — stones + smoke only, delete the bone particles.
- Saint-Bough Frost Crozier — one-hand upright walking-staff carry + walking-staff anim (Reaper's Tithe idiom).
- Thunderhead Voulge — blue VFX, much bigger.
- Nullspike Pike — far hand on purple-bandages midpoint; 3-hit combo (Xin Zhao Q idiom, no real launch).
- Idol of the Pale Verdict — +1.4x size.
- Dustreaper Zweihander — fire dragon VFX (generated).
- Sword Whirlwind — 2x bigger.
- Mournveil Scythe — 1.3x bigger.
- Mesa Heart-Geodes — lots of purple crystal VFX everywhere.
- Arcane Lance Staff — image (generated) VFX to replace current procedural VFX.
- Mirage Hardlight Saber — the blade-extension technique (unified blade-basis + per-combo ignition, 852d9d0).

## BATCH A — Archives (fold into whichever catalog Sol; census)
- Coffin-Nail Carbine — ARCHIVE.
- Psalter of the Burning Halo — ARCHIVE.

## Standing laws for these
Generated bitmap art for new VFX (flaming crosses, fire dragon, purple crystal, harpoon, Faradayer,
image staff VFX) — ONE SUBJECT PER AGENT. Preserve nominal DPS unless an order changes cadence/count
(then redistribute per-hit and document). Muzzle-in-art-space affine for all gun projectile origins.
Update EVERY census guard so the server boots. Visual orders close on a live gate + retained evidence.
Each batch merges to a clean, verified tree before the next batch's worktree is branched.
