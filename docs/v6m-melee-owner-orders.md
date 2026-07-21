# V6M melee owner orders

Implementation ledger for `owner-notes-audit-2026-07-21-v6.md` section V6M.

| Weapon | Delivered behavior | Damage / cadence note |
|---|---|---|
| Coyote Trickster's Sparkmitt | Eight-beat authored monk flurry at 0.12 s per punch, with alternating hands and unmistakable punch paths. | DPS-neutral: 3 / 0.34 = 1.0588235294 / 0.12 = 8.824 edge DPS. |
| Glasswidow Hexweave | Display length increased exactly 77%, from 52 px to 92.04 px. | Presentation only. |
| Abyssal Apocrypha | Converted from caster to melee: full-rotation spin, 240 px / full-circle mechanical coverage, and a purple weapon-motion vortex. | Intentional delivery conversion: the new direct melee edge is 10 / 0.7 = 14.286 DPS; the retired scatter/explosion caster packet is not retained. |
| Cinderbrand Cleaver | Continuous hold alternates left/right authored chops at 3/s while server-valid movement drifts the wielder forward at 72 px/s. | DPS-neutral: cooldown and every edge/scatter/explosion source were scaled by 25/54. |
| Coilshot Meteor | The draw twirl now registers a server-authoritative 150 px, full-revolution melee arc before projectile release. | Nominal total stays 24 DPS: 4 twirl + 8 projectile per 0.5 s, replacing the old 12-damage projectile. Range now determines which portion connects. |
| Hollow Harvest | Replaced the undersized blobs with a 24-particle organic fire splat pack, weapon-scaled and distributed around the swing. | Presentation only; no shake added. |
| Hailspur Sickle | Uses the thrown-melee grenade arc with a 112 px apex. | Damage unchanged. |
| Rusty Cleaver | Uses the thrown-melee grenade arc with a 124 px apex. | Damage unchanged. |
| Hangman's Gavel | Uses the thrown-melee grenade arc with a 132 px apex. | Damage unchanged. |
| Snakebite Morningstar | Converted to a spinning thrown weapon (620 px/s, 480 px range, 3 charges, 1.2 s refill). | Per-hit burst remains 9 / 0.5 = 18 DPS; the new thrown resource/range gate can change sustained uptime. |
| Dustdevil Glaive | Carries upright and angled forward; authored two-step combo is overhead chop then impale. | Damage unchanged. |
| Kagewake | Archived through the standard archive flag, together with its Hushglass partner, Hushglass Wakizashi. | Removed from active pools and katana assignments. |
| Cinderfang Wakizashi Pair | Swing and source VFX are offset 38 px forward, away from the body. | Damage unchanged. |
| Stormthread Tachi | Display length doubled from 136 px to 272 px. | Presentation only. |
| Saintspar Lochaber | Authoritative two-step combo is overhead down, then `rising-chop` with direction -1 and a reversed mechanical arc. | Damage unchanged; live probe verifies the accepted second-step upward frame. |
| Reaper's Tithe | Restructured to hit 1 `rest-downswing`, hit 2 the retained waist-level full orbit. | One accepted hit per cadence beat; damage unchanged. |
| Rimethorn Naginata | Display length doubled to 290 px; its swing plane is frozen from the cursor aim vector, including vertical/up aim. | Presentation/aim plane only. |
| Drowned Anchor | Display length increased 1.5x to 247.5 px; water-splat pack increased from 5 to 150 painted particles (30x). | Presentation only; no shake added. |
| Galvanic Lancepole | Direct hit is toxic/poison typed; chain receipts remain shock/electric typed. | Numeric damage unchanged. |
| Pyreclap Mauler | Cadence accelerated from 0.85 s to 0.55 s. | DPS-neutral: edge 6 -> 3.8823529412 and quake 9 -> 5.8235294118 (both scaled 11/17). |

## Systemic-law compliance

- Large motion effects use explicit weapon-motion origins and full/simple radial geometry; they do not fake impact anchoring.
- Painted particle sizes remain recipe-scale inputs consumed by the existing world-scale contract.
- V6M adds no camera shake, so it spends none of the shake budget.
- The new server damage paths (Coilshot twirl, Cinderbrand drift, Galvanic split typing) have direct room tests.

## Live evidence

- `owner-notes-audit-v6-evidence/v6m/saintspar-second-hit-start.png`
- `owner-notes-audit-v6-evidence/v6m/saintspar-second-hit-upward.png`
- `owner-notes-audit-v6-evidence/v6m/saintspar-second-hit.json`
