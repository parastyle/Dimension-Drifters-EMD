# W4G systemic audit — 2026-07-21

This is the implementation ledger for owner work order W4G. Live probes used the running dev client at `http://localhost:5180`; the JSON files retain the measured frames and the PNGs are the visual captures.

## W4G1 — pistol idle twirl (LIVE)

The pre-fix probe accepted a real pistol shot, released fire, and sampled 27 frames over about 1.5 seconds. Rotation moved only `0.00916 rad` (`0.00146` turns) and had no detectable onset. Evidence: [before JSON](owner-notes-audit-v4-evidence/pistol-twirl-w4g1-before.json) and the adjacent `before-{450,650,850,1050}ms.png` captures.

There were four cooperating faults:

1. `sampleFlourish` subtracted the idle-settle angle from itself, algebraically producing zero.
2. The idle channel could arm but a lingering ranged-aim owner prevented its sample from reaching the weapon in the same frame.
3. The delay used the freeze-aware presentation clock, so recoil/aim freezes stretched the requested half-second wall-clock wait.
4. The timer reset from indirect locomotion/aim state rather than the actual fire-intent release edge.

The sampler now preserves the full turn, quiet pistol settle may supersede only the lingering ranged-aim pose, the trigger keys from the fire-release edge using wall time, and animation sampling remains presentation-clock based. The ordered delay is `500 ms`; dual pistols play both hands with a `55 ms` stagger.

The post-fix live probe measured `6.86875 rad` (`1.0932` turns) with onset at `626.2 ms` and no unexpected browser errors. Evidence: [after JSON](owner-notes-audit-v4-evidence/pistol-twirl-w4g1-after.json) and `after-{450,650,850,1050}ms.png`. `e2e/tests/pistol-twirl.spec.ts` permanently gates one-hand visibility, timing, and dual-hand stagger.

## W4G2 — systemic tiny-VFX diagnosis

The tiny effect is a **painted bitmap particle sprite cut from a 96×96 spritesheet cell**. The shared particle consumer treated recipe `scale` as a raw Phaser texture multiplier. Thus Fulgurite's `0.15` always became a 14.4-pixel sprite, independent of the weapon or effect it was meant to dominate. The painted cells' occupied alpha bounds are generally near the full cell, so transparent padding was not the systemic cause. A second fixed-size path in the PER ribbon renderer capped large weapon effects at 38–42 pixels.

The common contract now expresses either an exact display-pixel size or a dominance ratio against a named reference such as `weapon.displayLength`. All 22 `particleBurst` consumers declare that contract. Retained auras, caster projectile bodies, weapon swing identity particles, and the fallback painted PER ribbon use the same display-unit helpers. Recipe min/max clamps remain explicit where composition needs them.

| Owner sighting | Before | Before dominance | After | After dominance | Contract/reference |
| --- | ---: | ---: | ---: | ---: | --- |
| Dustreaper slash | 44.16 px | 19.2% of 230 px | 78.20 px | 34% | swing identity / `displayLength` |
| Fulgurite aura | 14.40 px | 17.1% of 84 px | 36.96 px | 44% | retained aura / `displayLength` |
| Gravechain spin | 30.00 px | 16.7% of 180 px | 61.20 px | 34% | painted PER ribbon / `displayLength` |
| Godsbone feather | 38.00 px | 11.2% of 340 px | 88.40 px | 26% | painted PER ribbon / `displayLength` |

The W4G systemic test scans every shared burst call for an explicit `scaleContract` and asserts all four dominance results.

## W4G3 — shotgun stance v2

The scattergun stance now holds the stock low on the shoulder (`lead.y = -0.085`, `off.y = -0.065`), with the trigger hand under the receiver and the secondary hand on the pump/fore-end. Pump handling tags now select this stance even when catalog family naming is nonstandard.

All 17 shotgun/pump sprites were reviewed and authored in normalized sprite coordinates:

| Weapon | Trigger `(x,y)` | Pump/foregrip `(x,y)` | Role |
| --- | --- | --- | --- |
| Coffin Shotgun | `.24,.60` | `.55,.64` | pump |
| Rustwidow Pump-Rifle | `.31,.62` | `.56,.66` | pump |
| Buckshot Briar | `.31,.64` | `.63,.70` | pump |
| Bonepicker Coachgun | `.38,.66` | `.60,.70` | pump |
| Frostbore Scattergun | `.36,.62` | `.61,.70` | pump |
| Galvanic Coachgun | `.37,.69` | `.58,.69` | pump |
| Quicksilver Streetsweeper | `.34,.63` | `.63,.76` | pump |
| Hallowbore Coachgun | `.35,.72` | `.56,.69` | pump |
| Twin-Maw Greenerbore | `.25,.67` | `.55,.63` | pump |
| Slughammer Breachgun | `.31,.68` | `.56,.64` | pump |
| Caustic Drum Sweeper | `.23,.75` | `.69,.78` | pump |
| Emberfan Pumpgun | `.23,.68` | `.52,.67` | pump |
| Carom Coachgun | `.39,.66` | `.61,.65` | pump |
| Boomstick Saddlegun | `.30,.74` | `.60,.66` | pump |
| Tesla Drumbore | `.31,.68` | `.70,.58` | pump |
| Dustdevil Riotgun | `.30,.74` | `.80,.78` | vertical foregrip |
| Buckshot Avalanche | `.27,.75` | `.68,.68` | pump |

## W4G4 — foregrip, not magazine

The full firearm roster audit covers 140 definitions:

| Audit disposition | Count | Result |
| --- | ---: | --- |
| One-hand or dual | 56 | No support-hand anchor is required; any authored support anchor must still be forward of the trigger. |
| Authored two-hand support anchor | 34 | Sprite-specific normalized anchor retained/reviewed. |
| Legacy two-hand without metadata | 50 | Systemic fallback resolves trigger at `.30,.66` and support hand at `.70,.68` with role `two-hand-rifle`, on the forward underside rather than the central magazine lane. |

Authored-support audit set (34): Coffin Shotgun; Dustline Lever-Action; Coffin-Nail Carbine; Hollowpoint Repeater; Thunderhead Lever-Gun; Venomspine Repeater; Rustwidow Pump-Rifle; Brasswork Volley Rifle; Boneash Scattergun-Rifle; Buckshot Briar; Bonepicker Coachgun; Frostbore Scattergun; Galvanic Coachgun; Quicksilver Streetsweeper; Hallowbore Coachgun; Slughammer Breachgun; Caustic Drum Sweeper; Emberfan Pumpgun; Carom Coachgun; Boomstick Saddlegun; Tesla Drumbore; Dustdevil Riotgun; Thunderhead Repeater Cannon; Brimstone Rocket Tube; Buckshot Avalanche; Hailstorm Coilgun; Boneyard Ricochet Mortar; Widowmaker Arbalest; Embernail Repeater; Thunderhead Spikecaster; Cinderquill Dart-Caster; Gravedog Auto-Rifle; Stormspur Coil Carbine; Brimstone Gallows-Rifle.

Legacy fallback audit set (50): Hand Mortar; Gatling; Gravelthroat Repeater; Buzzard's Eye Marksman; Sunbreaker Railgun; Quicksilver Slugthrower; Cinderbore Longrifle; Tracer-Saint Carbine; Ironhide Buffalo Gun; Mirage Coilrifle; Ghostwind Spectre-Rail; Gravelung Punt-Rifle; Pale-Horse Longgun; Hexbore Witchrifle; Cinderchoke Blunderbuss; Spore-Spitter Blunderbuss; Hollowpoint Voidgun; Wyrmgut Blunderbuss; Pearlbreech Volleygun; Hellbore Gatling; Widowmaker Cannon; Powderkeg Mortar; Graveshot Grenade Gun; Doomsday Drum Cannon; Mauler Slug-Thrower; Plaguespitter Flak Gun; Sanctus Siege Bombard; Hexbore Voidmaw; Stormcaller Tesla Gatling; Calamity Howitzer; Cinderfan Dragoon; Permafrost Siege Lobber; Quill Storm Repeater; Leviathan Harpoon Gun; Hornet's Nest Bolter; Ghostbolt Crossbow; Frostfang Speargun; Buckshot Bramble Bow; Grave-Anchor Harpoon; Tidehook Bombarpoon; Psalter of the Burning Halo; Frostquill Compendium; Gravesinger's Hex-Wand; Sunmote Reliquary Staff; Mesa-Spine Thunder Stave; Pearl-of-Penance Censer; Saintskull Monstrance; Voidwell Idol; Sanctum Brazier Staff; Galvanic Overcasters.

The named collision review used explicit magazine rectangles:

| Weapon | Magazine rectangle `(left..right, top..bottom)` | New support anchor | Result |
| --- | --- | --- | --- |
| Gravedog Auto-Rifle | `.42..60, .56..92` | `.72,.74` vertical foregrip | outside, forward |
| Stormspur Coil Carbine | `.39..56, .50..90` | `.61,.79` vertical foregrip | outside, forward; display length `116 → 168.2` (+45%) |
| Dustdevil Riotgun | `.40..64, .56..96` | `.80,.78` vertical foregrip | outside, forward |
| Tesla Drumbore | `.32..60, .40..90` | `.70,.58` pump | outside, forward |
| Brimstone Gallows-Rifle (additional find) | `.42..63, .55..96` | `.77,.72` vertical foregrip | outside, forward |

The permanent test checks those rectangles and requires a resolved forward support anchor for every two-hand firearm.

## W4G5 — wavy beam identities

The beam recipe now declares waveform amplitude, frequency, and optional phase. The renderer supports sine, cosine, saw, pulse, stutter, and a phase-separated double helix. Choices across the full 22-beam roster are:

| Beam | Wave | Amplitude | Frequency | Identity note |
| --- | --- | ---: | ---: | --- |
| Voltcaster Machine Pistol | stutter | authored | 8.0 | hot, electrical red chatter |
| Stormcaller Tesla Gatling | stutter | authored | 7.0 | six-barrel electrical chatter |
| Mirage Coilrifle | double helix | .42 | 4.0 | continuous purple double strand, phase π/2 |
| Null Grimoire / Hollow Page | sine | authored | 3.5 | occult page-current |
| Psalter / Burning Halo | pulse | authored | 6.0 | devotional flare cadence |
| Frostquill Compendium | sine | authored | 2.5 | slow frozen ribbon |
| Brinequill Tidescepter | double helix | authored | 3.0 | tidal braid |
| Sunmote Reliquary Staff | steady | authored | 1.5 | disciplined solar ray |
| Carrion Roost Necro-Scepter | stutter | authored | 5.5 | carrion twitch |
| Auroral Filament Wand | cosine | authored | 4.0 | phase-distinct aurora |
| Mesa-Spine Thunder Stave | saw | authored | 5.0 | jagged lightning ramp |
| Gilded Hourglass Frost Scepter | pulse | authored | 4.0 | clocked frost pulse |
| Riftglass Prism-Lantern | saw | authored | 6.5 | fractured prism edge |
| Quartzlight Wayfinder | pulse | authored | 5.0 | navigational beacon |
| Pearl-of-Penance Censer | steady | authored | 1.0 | solemn continuous line |
| Smoldering Eye of Perdition | pulse | authored | 3.0 | infernal heartbeat |
| Nullsaint Reliquary | steady | authored | 2.0 | restrained void ray |
| Saintskull Monstrance | saw | authored | 4.5 | reliquary teeth |
| Sanctum Brazier Staff | sine | authored | 3.5 | brazier heat-wave |
| Seraph's Knuckle Reliquary | stutter | authored | 7.5 | close electrical interruption |
| Voidgrasp Null-Gauntlet | double helix | authored | 4.5 | grasping void braid |
| Glasswidow Hexweave | stutter | authored | 8.5 | webbed hex flicker |

Mirage was moved from discrete gun delivery to a held beam (`30 DPS`, `0.1 s` tick, `640 px` range, `18 px` width, `0.65 s` charge, `0.16 s` sweep lag). Its recipe is purple and braided.

## W4G6 — barrel alignment (LIVE)

The data generator had a separate systemic fault: it emitted gun spread only for multi-pellet recipes. Coyote's authored single-projectile spread therefore disappeared from generated truth. Spread emission now retains any authored spread; Coyote changed from `0.10 rad` to the owner-ordered less-accurate `0.18 rad`.

Shared local muzzle offsets are consumed by both server spawn/channel rows and client presentation:

| Weapon | Authored painted offset(s) `(forward,lateral)` | Live result |
| --- | --- | --- |
| Voltcaster | `(-1,-14)` | red beam; 5 moving frames, max replicated-rope-to-painted-tip delta `0.0551 px` |
| Stormcaller | `(-9,11)`, `(-9,22)`, `(-9,32)`, `(-4,11)`, `(-4,22)`, `(-4,32)` | all six lanes sampled over 30 moving frames; max delta `0.0786 px` |
| Coyote Stinger | `(-1,-7)` | recovered authoritative bullet origin delta `0.00804 px`; sampled shot angle `-0.16005 rad` under `0.18 rad` spread |
| Hollowpoint Hex | `(-1,-5)` | recovered authoritative bullet origin delta `0.02899 px` |

Evidence: [Voltcaster JSON](owner-notes-audit-v4-evidence/beam-anchor-w4g6-after-voltcaster.json), [Stormcaller JSON](owner-notes-audit-v4-evidence/beam-anchor-w4g6-after-stormcaller.json), [Coyote JSON](owner-notes-audit-v4-evidence/gun-barrel-w4g6-after-coyote.json), and [Hollowpoint JSON](owner-notes-audit-v4-evidence/gun-barrel-w4g6-after-hollowpoint.json), each with a same-stem PNG. The original Voltcaster reproduction is retained at `owner-notes-audit-v2-evidence/beam-anchor-w4g6-before-voltcaster.{json,png}`. The permanent beam e2e now compares the replicated beam rope against the transformed authored painted muzzle, rather than the old geometric center tip.
