# V6C caster/ranged owner orders

Implemented from section V6C of `owner-notes-audit-2026-07-21-v6.md`.

| Weapon | Authored result | Balance / systemic note |
|---|---|---|
| Hexbloom Scattergrimoire | Projectile travel increased from 230 px to 420 px. | Count, damage, explosion, and 0.48 s cadence are unchanged. |
| Null Grimoire | Beam recipe now draws a near-black 48% core inside purple 68%/100% inset layers. | Damage band and beam DPS are unchanged; all visual widths remain inside the authoritative beam. |
| Glyphward Manuscript | Converted to ten existing `fx-holy-smite-07` feather projectiles in a 0.56 rad, 420 px medium-range fan. | Ten is the authored scatter cap and the global 192-friendly-projectile cap still admits rows. Per-feather damage is 1.5435, so the 15.435 maximum payload equals the former `6 × (1 + .85 + .85²)` three-hop chain payload. |
| Dust-Devil Cyclone Orb | Existing double-ripple/lightning-ball motion is retained and tinted purple; supporting painted particles use the arcane-purple family. | Gameplay remains shock-typed; quake radius, damage, cadence, and shake recipe are unchanged. |
| Fulgurite Storm-Sphere | Chain hue and caster-source palette are explicitly blue. | Shock typing, chain payload, aura DPS/radius, and shake budget are unchanged. |
| Thunderhead Stormfists | The 480 px server lunge now completes in **50 ms** (formerly 200 ms). | Its iframe is exactly one 50 ms server tick and exists only during the lunge. Damage/cadence remain 17.5 base payload DPS. |
| Hexbolt Spitter-Mitt | Projectile tint is explicit arc-violet (`#B14BFF`). | Damage and 0.18 s cadence are unchanged. |
| Hexpost Charm-Pole | Authored aim-forward, two-hand jab pose replaces the generic swing pose. | Server damage geometry and payload are unchanged. |
| Thunderpost Fetish | Authored aim-forward, two-hand jab pose replaces the generic swing pose. | Existing five-beat cadence and all 1× damage multipliers are retained. |
| Ghostbolt Crossbow | Existing generated arrow renders at 3× scale: 72 px → 216 px. | Presentation-only scale; the fixed server projectile collision radius is unchanged. |
| Brimstone Rocket Tube | Explosion radius increased from 140 px to 220 px. The blast uses an asymmetrical ember eruption, extra shards/wisps/splats, and no halo layer. | Explosion damage remains 13. The authoritative radius still drives art scale; player-weapon shake remains routed through the 5% budget. |
| Calamity Howitzer | Added a 2× server-owned user displacement multiplier. | Camera/pose recoil remains 0.004, so the shake budget is not doubled. Projectile and blast payload are unchanged. |
| Tidehook Bombarpoon | Ice explosion radius increased from 64 px to 220 px with a frost-nova/ice-bloom recipe. | Explosion damage remains 10; the large radius cannot fall through to the generic nuke art. |

Brimstone and Tidehook are explicit large-blast authoring exceptions capped at 220 px by codegen validation. Visual-scale-only orders never alter server hit geometry.
