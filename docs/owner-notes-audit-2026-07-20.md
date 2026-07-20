# Owner playtest notes — audit ledger (2026-07-20)

Source: `data/owner-notes.jsonl`, 42 notes through `2026-07-20T18:10:40Z`. This ledger is the work
order; Sols reference it by section id. Game notes execute first (owner's standing order), then
weapon waves.

## GAME NOTES (wave 1 — launched)

- **G1 — Beam anchoring:** beams must anchor to the weapon's beam origin; moving while firing moves
  the entire beam with the shooter.
- **G2 — Locomotion:** (a) facing right + walking right = lurch forward; facing left + walking left
  = "dragged by the weapon" — an asymmetric facing/locomotion bug. (b) Per-weapon-class movement
  posture: a gunner walks differently than a swordsman.
- **G3 — Combo warp:** melee combos must never teleport/warp the character mid-combo to set up the
  next swing (reported specifically on Dustreaper Zweihander).
- **G4 — Thrown truth:** every thrown weapon throws ITS OWN sprite (some throw other weapons;
  specifically reported on Bogwater Twinbits, Saloon Tomahawk).
- **G5 — Beam distinction:** all beam weapons read as copy/paste; each needs visual identity.

## WEAPON WAVES (wave 2+, after game wave)

### W-SIZE — scalars
| Weapon | Order |
|---|---|
| Hand Mortar | bullet size +400% |
| Throne-of-Ash Coal-Scepter | 3x bigger |
| Dustdevil Whirlbits | 2x bigger |
| Saloon Tomahawk | 2x bigger (+ G4 own-sprite throw) |
| Gravesinger's Hex-Wand | "way too small" — DEFAULT: scale to caster family median unless owner overrides |

### W-POSE — hold/stance language
| Weapon | Order |
|---|---|
| Cairn of Hollow Names | held upright |
| Rotgrove Totem | held upright |
| Coffin-Nail Rosary Orb | held hanging down (chain) at all times |
| Emberleaf Chapbook | held not swung; pages flip continuously while fireballs emit |
| Tallowtongue Pyre-Stave | continuous fire hold; staff shakes in place, never swung |
| Hollowbarrel Spell-Scattergun Staff | projectiles from the SPOUT; aim-forward pose + recoil pushback |
| Hexbloom Scattergrimoire | book shakes while continuously firing |
| Cinderchoke Brazier-Orb | raise + shake overhead, then swing down, then VFX |
| Fulgurite Storm-Sphere | hold overhead + shake; garlic-style damage aura around character, cost/second (Q2) |

### W-ZONE — procedural ground AoE (shared system: codex-art textures, procedural growth, NO engine circles)
| Weapon | Order |
|---|---|
| Gravewax Seance-Globe | floor AoE grows while held (nether-style codex textures); NOT a beam |
| Snakeoil Tincture Scepter | hold-down channel; growing poison AoE (codex art) |
| Frostquill Compendium | leaves slowing ice zone |
| Carrion Effigy | convert to thrown grenade leaving poison AoE |

### W-CONVERT — mechanic changes
| Weapon | Order |
|---|---|
| Verdigris Grand Grimoire | melee; keep animation; open-book frames size-parity with rest sprite; PAGES are the damaging VFX |
| Coyote Trickster's Sparkmitt | 2-handed glove pair (one per hand); held = continuous punch combo; small lightning aura |
| Sparkknuckle Hex-Mitt | same glove-pair treatment; aura color matches the glove gem |
| Permafrost Bardiche | whirlwind weapon (Garen spin) |
| Tesla Faradayer | ranged electricity shooter, not melee |
| Gallows Splitter | thrown weapon |
| Boothill Hatchet | thrown weapon |
| Cogwright's Tesla-Rod | NEW FUNCTION: warp user to cursor (Q1 — pending owner) |

### W-VFX — projectile/effect reworks
| Weapon | Order |
|---|---|
| Galvanic Overcasters | shot blue + bigger; explodes into electricity |
| Riftglass Prism-Lantern | tons of randomly aimed prismatic rainbow beams |
| Twin Whispervolumes | projectiles = pages in random scatters |
| Riftcleaver Greatblade | projectiles spawn from blade; add 3rd combo hit; crystal-shard projectiles with the old orbs' appeal |
| Verdict Longsword | VFX from weapon point; more elaborate combo with more forward lurch |
| Tombwarden Claymore | dark-slash codex VFX projectile on swing (replace old) |
| Choir-Iron Greataxe | flame-slash codex VFX (replace current) |
| Hangman's Greatcleaver | blood-spatter VFX (no gore) |
| Dustreaper Zweihander | smooth the combo (no warp — G3 covers the mechanism) |

## QUESTIONS — ANSWERED (owner, 2026-07-20)

- **Q1 (Tesla-Rod):** FULL CURSOR DISTANCE, no range cap. The note said "new function," so the warp
  REPLACES the old attack; a small electric burst at arrival using its existing damage stat keeps it
  a weapon (default — flag for owner review in the wave summary).
- **Q2 (Storm-Sphere):** confirmed — aura drains the weapon-resource bar per second.
- **Q3 (Hex-Wand):** confirmed — scale to caster-family median.

Processed watermark: all notes ≤ 2026-07-20T18:10:40Z are in this ledger.

## STATUS: ALL 42 NOTES CLOSED (2026-07-20)

Game wave: 45e7bb2 (G2 locomotion), d6175ea (G1/G3/G4/G5). Weapon waves: 52a5ca1
(W-SIZE/POSE/ZONE, 18 weapons), 8dd2fc9 (W-CONVERT/VFX, 17 weapons). Suite 1406 green.
Owner-review flag: Tesla-Rod arrival burst was a default, not an explicit ruling.
