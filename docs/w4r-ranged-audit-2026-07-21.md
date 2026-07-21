# W4R ranged owner-note implementation audit — 2026-07-21

Source of truth: section W4R of `owner-notes-audit-2026-07-21-v4.md`. This pass builds on the W4G grip, painted-particle scale, waveform, and barrel-alignment contracts.

## Per-weapon disposition

| Weapon | Implementation | Damage discipline |
|---|---|---|
| Tracer-Saint Carbine | Held length `116 → 150.8` (+30%). Shared held geometry moves both the rendered muzzle and authoritative spawn tip. | Size only; unchanged. |
| Quicksilver Fanner | Held length `56 → 112`; six simultaneous projectiles in a `0.22 rad` fan. Each pellet is `1` instead of the old single `6`. | `6 × 1 / 0.12 = 50 DPS`, equal to `6 / 0.12 = 50 DPS`. |
| Ricochet Pistol | Blue `spark` lightning bullet, shock element, and a server-owned three-hop chain using the Venomtongue nearest-target idiom. Chain receipts draw brief blue lightning links. | Direct DPS remains `8 / 0.34 = 23.529`. The `3, 2.25, 1.6875` chain is explicitly additional multi-target utility. |
| Tumbleweed Skipper | Projectile override `#3f9dff` for blue bullets. | Visual identity only; unchanged. |
| Gravelthroat Repeater | Full-auto at `0.15s`; server-owned roll of 1–10 projectiles from the server-minted room seed and accepted attack epoch, with independent headings across the full circle. The arena admits rows before allocation and enforces a 192-friendly-projectile cap again at spawn. | One `6`-damage trigger pool is divided by the requested roll. Uncapped total is always `6 / 0.15 = 40 DPS`, equal to old `6 pellets × 4 / 0.6 = 40 DPS`; cap truncation can only lower it. |
| Mirage Coilrifle | Verified W4G implementation: continuous 30-DPS purple double-helix beam with the authored waveform recipe. | Already W4G-neutral/documented; no duplicate rewrite. |
| Hexbore Voidmaw | Bounded crop of one purple barrel rune, launched with purple trail/glow. | Projectile presentation only; unchanged. |
| Widowmaker Cannon | Painted cannonball delivery, neutral gray tint, `4×` projectile visual scale. | Presentation only; unchanged. |
| Permafrost Siege Lobber | Reusable continuous cone-stream delivery, ice flavor, `0.42 rad` half-angle, `440` range, 100ms damage cadence. | `25 DPS`, equal to old `(10 + 9) / 0.76 = 25 DPS`. |
| Buckshot Avalanche | Four large slug projectiles per trigger, `2×` visual scale; per-projectile direct/blast changed to `9 + 6.75`. | `4 × (9 + 6.75) / 0.72 = 87.5 DPS`, equal to old `9 × (4 + 3) / 0.72 = 87.5 DPS`. |
| Doomsday Drum Cannon | Same reusable cone-stream delivery, magma flavor, `0.48 rad` half-angle, `560` range, 100ms cadence. | `38.235 DPS`, equal to old `(7 + 6) / 0.34`. |
| Tidehook Bombarpoon | New reference-guided loose bomb-harpoon sprite, registered as generated projectile art; never cropped from the weapon. | Presentation only; unchanged. |
| Whisperbarb Hand-Crossbow | Held length `66 → 99` (+50%); painted arrow projectile. | Size/presentation only; unchanged. |
| Widowmaker Arbalest | Owner-rejected crop removed. New reference-guided siege arrow generated and registered as standalone projectile art. Held length `150 → 225` (+50%). | Size/presentation only; unchanged. |
| Tesla Faradayer | Purple `#b14bff` `spark` projectile rendered as a lightning bolt. | Visual identity only; unchanged. |

The full crossbow-family sweep is data-derived rather than name-hardcoded: Widowmaker Arbalest `150 → 225`, Quill Storm Repeater `110 → 165`, Ghostbolt Crossbow `144 → 216`, Buckshot Bramble Bow `116 → 174`, and Whisperbarb Hand-Crossbow `66 → 99`. Every member uses arrow ammunition; the Arbalest uses its new generated arrow while the other four use the shared painted arrow pack.

## Generated projectile art

`tools/artkit/gen-w4r-projectiles.mjs` is the reproducible Codex artkit pipeline. Each isolated render receives the installed weapon sprite only as a style/material reference, generates onto chroma green, then artkit removes the key, trims, downsizes, pads, validates alpha/aspect/green spill, and installs the transparent runtime PNG.

- Widowmaker Arbalest: prompt includes the owner's exact ruling, “Generate the picture of an arrow; do not crop from the weapon art.” Outcome is a new broad-headed iron siege arrow with dark shaft, pale fletching, brass collars, and no weapon pixels.
- Tidehook Bombarpoon: outcome is a new white-steel barbed bomb-harpoon with a round depth-charge collar, teal bands, and cyan ice accents. It is likewise generated, not extracted.
- Hexbore remains intentionally sprite-derived: a bounded registration crops a barrel rune from its own installed part, matching the separate owner instruction for rune ammunition.

Runtime registration is centralized in `GUN_GENERATED_PROJECTILES`; Arena preload and projectile construction resolve the same keys. Tests require both installed PNGs, wide RGBA output, and valid registrations.

## Reusable cone-stream delivery

Cone streams specialize the existing server-authoritative beam lifecycle instead of creating a second channel system:

1. The normal 0.65s charge, Drive spend/overheat, aim lag, range clipping, and replicated beam row remain authoritative.
2. `BeamDescriptor.coneHalfAngle` switches collision from a fixed capsule to circle-vs-sector geometry. Previous-to-current beam poses are still swept, and one widened AABB query feeds exact per-sample sector tests for enemies and worm segments.
3. Live damage accumulates from actual simulation `dt` and flushes at each weapon's 100ms tick cadence. The existing aggregate target cap and receipt path remain intact.
4. The server replicates the cone's end diameter through the beam row. The client draws inset widening sheets and advancing transverse ribs inside that authoritative footprint, with ice or magma palettes supplied by the W4G recipe registry.

The same seam supports future continuous cone weapons by authoring only `halfAngle`, flavor, beam DPS/range/width, and the standard beam lifecycle values.

## Regression coverage

Append-only W4R tests cover server-seed repeatability and varied radial rolls, pre-allocation and spawn-time caps, per-roll damage splitting, both cone flavors' real 100ms authority ticks, cone geometry, Ricochet shock-chain receipts, the complete crossbow data sweep, DPS equations, Hexbore crop bounds, Mirage waveform retention, and generated-art files/registrations. The obsolete V3R list was minimally corrected to replace the now-rejected Arbalest crop with the new Hexbore crop order.
