# V13 ImageGen Material Variants Handoff

Use `corporate_grid_v13_imagegen_material_variants.ldtk` as the source map.

Required runtime assets are in `tilesets/`:

- `v13_imagegen_material_variant_modules_60.png`
- `v13_city_parallax_backdrop_60.png`

The LDtk project contains three levels:

- `Office_Red_Carpet_Gallery`
- `Office_Random_Dude_Portrait_Hall`
- `Office_Marble_Gallery`

Render tile layers bottom to top:

- `Parallax_City_Backdrop`
- `Office_Material_Tiles`

Gameplay data:

- `Collision_IntGrid` for solid/end blockers
- `Gameplay_Markers` for spawns, camera bounds, combat lanes, and elevator markers

This handoff folder intentionally excludes previews, native render exports, indexed reference sheets, and source-generation art.
