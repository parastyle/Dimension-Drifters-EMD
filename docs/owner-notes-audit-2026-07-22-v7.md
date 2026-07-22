# Owner playtest notes — audit ledger v7 (2026-07-21/22 night batch)

Source: `data/owner-notes.jsonl`, 46 notes `21:19Z`–`02:35Z`. All Sols run under the durable-report
regime (docs/sol-reports/<slug>.md incremental). NEW STANDING RULE (owner): "when I ask for a
special effect, it should be made via codex image generation unless otherwise said so."

## WAVE A — PRIORITY (launched first)

- **V7-HIT — THE VFX-COLLISION LAW (owner sized: 5-bot program):** "All VFX should hurt enemies on
  collision as a rule. The extended swords we just made, their new VFX doesnt even do damage."
  Program: (1) design+system Sol — a server-authoritative rule that damage-bearing weapon VFX
  geometry IS hit geometry (the blade extensions first: the 3x magic blade must damage at its
  visual reach — this reverses the earlier visual-only default by owner order); (2) melee/extension
  sweep Sol; (3) ranged/caster/zone sweep Sol; then (4) live-verification Sol probing visual-vs-
  damage agreement on a spread; (5) balance-audit Sol documenting every reach/damage change.
- **V7-GLOVE (ESCALATED, 3rd order, LIVE):** "The glove weapons are not moving, I want moving fist
  combos. Been asking for a while now" + "should look like kungfu." Whatever shipped is not
  visible in play. Live-probe first, root-cause the invisibility, build real kung-fu fist combos
  (alternating strikes, body rotation, forward drift), prove with frame captures.

## WAVE B — SYSTEMICS

- **V7-MOVE:** dodge roll = quick fixed-distance "tumbly tumble" (Lost Saga cowboy reference) with
  a cooldown between rolls; the long jump REPLACES the default jump, no delay/charge.
- **V7-HANDS:** pump vs lever animation distinction — shotgun pump hand moves BACK then FORWARD;
  lever hand moves DOWN then UP; better pump hand placement; lever cranks after EVERY shot
  immediately (no 0.5s pistol-style wait — named: Thunderhead Lever-Gun).
- **V7-BEAM:** beam STRUCTURE variety beyond the internal waveforms — "not just one long tube"
  (segmented arcs, converging strands, pulse trains, flame-tongue... vary the silhouette).

## WAVE C — KATANA MOVESETS (creative program)

"I can't tell any distinction between them. We need different moves like side slashes, waves,
backflips... knees bent stabs, lunges. Go crazy on this one. Make some cool unique movesets PER
katana. Each one gets a different one... the at rest stances are cool though we keep those."
Every katana gets a bespoke moveset (combo choreography, not just VFX); rest stances preserved.

## WAVE D — WEAPONS

| Weapon | Order |
|---|---|
| Brimstone Gallows-Rifle | shoots tiny FLAMING CROSSES (codex-generated), aligned with barrel |
| Gravewarden Buster | frontflip becomes continuous smooth beyblade spin |
| Sidewinder Spontoon | thrown weapon |
| THROWING STARS (NEW) | "various throwing stars as weapons" — DEFAULT: 4 new stars (iron, fire, ice, void), full pipeline |
| Brimstone Rocket Tube | one hand on trigger; bigger explosion (again) |
| Mesa Hand-Cannon | explosion on detonation; +0.5s between shots |
| Tesla Faradayer | hand-drawn (generated) projectiles |
| Plaguespitter Flak Gun | more green projectiles at once, random patterns (within cone) |
| Sanctus Siege Bombard | 5x player knockback |
| Stormcaller Tesla Gatling | REPEAT+LIVE: only 3 beams visible — must be 6, barrel-aligned |
| Sidewinder Spitfire | two parallel bullets |
| Coffin-Nail Carbine | ARCHIVE |
| Gravelung Punt-Rifle | bullet 2x |
| Ironhide Buffalo Gun | anti-tank 50-cal shell |
| Galvanic Coachgun | blue electrical bullets |
| Ricochet Pistol | icicle shots |
| Hailspitter Pepperbox | 7 tight parallel shots spanning the barrel width |
| Dustline Lever-Action | gun +60% |
| Frostquill Compendium | beam made entirely of ice particles |
| Fulgurite Storm-Sphere | blue VFX; fill the dead space between aura and player |
| Boothook Harpoon | thrown over the shoulder |
| Hexbore Voidmaw | -20% size, one-handed pistol |
| Gravelthroat Repeater | random spread constrained to the muzzle CONE, not 360 |
| Tesla Drumbore | shoots electric particles |
| Tombstone Greatsword | stones + smoke only, delete the bone particles |
| Galvanic Overcasters | BUG: knockback while moving desyncs bullets vs character on following shots — investigate |
| Psalter of the Burning Halo | ARCHIVE |
| Saint-Bough Frost Crozier | one-hand upright walking-staff carry + the walking-staff animation (Reaper's Tithe idiom) |
| Thunderhead Voulge | blue VFX, much bigger |
| Hailwidow Katana | +1.5x size |
| Nullspike Pike | far hand on the purple bandages midpoint; 3-hit combo like Xin Zhao's Q (rapid double-stab into a knock-up-flavored finisher, no actual launch unless trivial) |
| Frostfang Speargun | shoots its pictured harpoon (generated) |
| Idol of the Pale Verdict | +1.4x size |

Watermark: all notes ≤ 2026-07-22T02:35:18Z ledgered.
