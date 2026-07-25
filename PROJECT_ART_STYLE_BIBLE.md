# Project Art Style Bible

Last updated: 2026-07-25

This is the current canon for the game's character, environment, and destructible asset style. Use it before making new characters, props, map tiles, DLC assets, or handoff prompts.

## One-Line Style Target

Dark-comic corporate arcade action: chunky modular sprites, thick black ink outlines, scuffed cel shading, compact readable silhouettes, shallow 2.5D environment depth, and clean game-ready separation between base maps and destructible foreground objects.

## Canon Asset Sources

Use these folders as the current visual truth:

- Character skill: `C:\Users\Exped\.codex\skills\generate-modular-action-sprites`
- Character style contract: `C:\Users\Exped\.codex\skills\generate-modular-action-sprites\references\style-contract.md`
- Character prompt patterns: `C:\Users\Exped\.codex\skills\generate-modular-action-sprites\references\prompt-patterns.md`
- Canon character batch: `concept-art/side-profile-ambiguous-hands-recreations/final-canonical-1080p`
- Additional 20-character batch: `concept-art/side-profile-more-20/final-1080p`
- Corporate CEO and robot goons: `concept-art/corporate-ceo-generic-robots-nosleeves-v2/final-edged-1080p`
- Current LDtk office map handoff: `concept-art/map-concepts/corporate-grid-flush-endwall-skyline-hallway-v8/ldtk-v13-imagegen-material-variants-handoff`
- Current rooftop helipad handoff: `concept-art/map-concepts/corporate-grid-flush-endwall-skyline-hallway-v8/ldtk-v14-rooftop-helipad-handoff`
- Current destructible prop handoff: `concept-art/destructible-office-props-v3-oblique-perspective-handoff`
- Current cubicle pod handoff: `concept-art/cubicle-pod-v2-split-from-full-handoff`

Superseded or reference-only folders:

- `concept-art/destructible-office-props-v1*`: too isometric/angled.
- `concept-art/destructible-office-props-v2-flat-perspective*`: useful collision/debug comparison, but too flat for final art.
- `concept-art/cubicle-wall-set-v1-oblique-handoff`: superseded by the full-cubicle-first workflow in `cubicle-pod-v2-split-from-full-handoff`.

## Character Rules

Final character assets use the `generate-modular-action-sprites` skill.

Non-negotiables:

- One character per image.
- Final review/import asset is exact `1920x1080`.
- Flat pure `#00ff00` chroma-key background.
- Strict right-facing side profile for left/right movement.
- Detached no-neck head.
- Separate compact body.
- Two separate smooth blob hands.
- Two separate smooth boot-blob feet.
- Visible green gaps between head, body, hands, and feet.
- Mouthless or fully hidden mouth.
- No weapons, held props, backpacks, books, staffs, shields, familiars, drones, or tools.
- No arms, full legs, elbows, knees, wrists, ankles, fingers, thumbs, toes, claws, laces, toe caps, or sole grooves.
- Hands must not overlap the body.
- Body must not touch, hide, sit on, tuck over, or overlap the feet.
- No shadows, floor marks, labels, UI, or watermark.

Character art direction:

- Rough indie arcade combat sprite concept art.
- Chunky, readable silhouette first.
- Thick black outline.
- Scuffed cel shading and hard-edged color planes.
- Dark-comic attitude rather than cute toy collectible rendering.
- Costume identity lives on the head/body surface: collars, masks, helmets, cowls, trim, buckles, rivets, printed suit lines, belts, patches, occult markings, fabric wear, panel seams.
- For corporate suit characters, do not draw sleeves or arms. Suit identity should be printed or embedded on the compact body: lapel marks, shirt insert, tie stripe, collar band, buttons, rank strips.
- Influences are broad mood/silhouette references only. Avoid direct likenesses, signature outfits, exact color-plus-silhouette combinations, logos, or protected character reads.

Character prompt base:

```text
Create one original compact <archetype> side-profile modular sprite for a 2D action game.
Facing right, mouthless/hidden face, detached no-neck head, separate body, separate smooth oval blob hands, separate smooth boot-blob feet, visible #00ff00 gaps between all parts.
Flat pure #00ff00 chroma-key background, no shadows, no floor, no text.
Style: rough indie arcade combat sprite, thick black outline, scuffed cel shading, chunky readable silhouette, dark-comic action tone.
Costume: <3-5 silhouette/palette/details>.
No weapons, no held items, no props, no arms, no full legs, no fingers, no toes, no overlaps.
```

Character repair prompts:

- If hands become fists: `Each hand must be a plain smooth oval bean, like a featureless floating ball. No glove-fist silhouette, no finger bumps, no thumb bump, no knuckle creases.`
- If feet gain detail: `Each foot is a single smooth boot blob. No toe cap, laces, sole grooves, heel separation, toes, or digit marks.`
- If body overlaps feet: `Leave a clear #00ff00 gap above both feet. The body must float above the feet and must not touch, cover, sit on, or tuck over them.`
- If the face has a mouth: `Use a fully hidden mouth: black face void, visor, mask, cowl, scarf, or helmet. No lips, teeth, nose, skin, or human expression.`
- If too close to an existing character: change silhouette first, then color placement.

## Environment Camera

Current maps use a horizontal side-scrolling combat layout with low 2.5D depth:

- The wall/background is mostly front-facing and readable.
- The floor has a shallow oblique/low-isometric diamond-tile read.
- The playable lane must remain open for constant combat.
- Obstructions are not baked into base maps. Cubicles, plants, chairs, desks, crates, and other clutter should be placed as separate destructible props/entities.
- End walls/elevators should be flush with tile lining.
- Long corridors should be procedural-friendly: repeat middle modules, cap with left/right end modules.

Do not make maps feel like top-down tactical rooms, marketing hero art, or realistic interior renders. They should read as side-scrolling action arenas with enough vertical floor depth for up/down movement.

## Map And Tile Rules

Current office map canon:

- Primary LDtk handoff: `ldtk-v13-imagegen-material-variants-handoff`
- Source LDtk: `corporate_grid_v13_imagegen_material_variants.ldtk`
- Runtime tilesets:
  - `tilesets/v13_imagegen_material_variant_modules_60.png`
  - `tilesets/v13_city_parallax_backdrop_60.png`
- Levels:
  - `Office_Red_Carpet_Gallery`
  - `Office_Random_Dude_Portrait_Hall`
  - `Office_Marble_Gallery`
- Render order:
  - `Parallax_City_Backdrop`
  - `Office_Material_Tiles`
- Gameplay layers:
  - `Collision_IntGrid`
  - `Gameplay_Markers`

Tile art rules:

- Base floor tiles should be pristine and clean.
- Avoid unique scuffs, stains, scratches, or diagonal squiggles that make repeated tiles obvious.
- Tile linework should be smooth, bold, and intentional.
- Use clean cel-shaded material planes, not MS Paint-flat geometry.
- Avoid baked lighting gradients, glow passes, or shadows that break tiling.
- Add wear later as optional decal/destructible layers, not as part of base repeat tiles.
- Keep background windows transparent when parallax is desired.

Parallax rule:

- Hallway/window maps should use a separate city backdrop layer under transparent windows.
- The current rooftop helipad pass is baked into `v14_rooftop_helipad_stage_60.png`. If rooftop skyline motion becomes important, split sky/city into a separate parallax layer later.

## Environment Material Language

Core palette:

- Charcoal black and dark gray for structure.
- Muted corporate burgundy/red for trim, path lines, fabric bands, alerts, and identity accents.
- Smoky gray glass for windows, cubicle glass strips, and framed panels.
- Brushed steel and gunmetal for elevators, columns, and industrial details.
- Muted brass/gold only as small hardware caps, fasteners, or corner pieces. Avoid gilded/luxury gold reads.
- Off-white and pale gray marble/floor panels for high-value office floors.
- Bright scenic sky/city only as background/parallax, not as dominant foreground color.

Avoid:

- One-note purple/blue or beige/brown palettes.
- Overly themed departments.
- Fantasy ornamentation unless a character archetype explicitly needs it.
- Heavy soft lighting, bloom, global filters, blur, or painterly atmospheric overlays.

## Destructible Props

Current prop canon:

- Preferred handoff: `concept-art/destructible-office-props-v3-oblique-perspective-handoff`
- Current included props:
  - stacked shipping crates
  - reinforced corporate crate
  - potted office plant
  - tall lobby plant
  - office cubicle segment
  - rolling office chair
  - breakroom desk with microwave and coffee pot
  - water cooler

Prop projection rule:

- Use shallow 2.5D oblique/cabinet projection.
- Front faces stay readable.
- Vertical edges stay vertical.
- Top planes are visible.
- Side/depth edges follow one consistent shallow angle aligned to the hallway diamond floor.
- Do not make props fully flat unless they are placeholders.
- Do not rotate props into a full isometric wall-facing angle.
- No cast shadows or contact shadows baked under the objects.
- Use transparent PNG cutouts for game placement.

Prop styling:

- Match dark corporate material language.
- Thick black outlines.
- Cel-shaded material planes.
- Moderate internal detail, readable at game scale.
- Props should look destructible and entity-like, not baked into the room.

Destructible prop prompt base:

```text
Create <prop list> as separated 2D game destructible props on a perfectly flat solid #ff00ff chroma-key background.
Style: dark corporate comic/cel-shaded action-game asset art, thick black outlines, charcoal and dark gray materials, muted burgundy red accents, smoky glass, brushed steel, small muted brass hardware.
Perspective: shallow 2.5D oblique projection aligned to the hallway floor tiles. Front faces readable, verticals vertical, visible top planes, consistent side/depth angle.
No cast shadows, no contact shadows, no floor plane, no labels, no text, no people, no weapons.
Keep every prop isolated with generous padding for transparent cutout export.
```

Use `#ff00ff` for props with green plants so chroma removal does not damage foliage.

## Cubicle Pod Rules

Current cubicle canon:

- Preferred handoff: `concept-art/cubicle-pod-v2-split-from-full-handoff`
- Full reference: `reference/cubicle-pod-v2-full-coherent-transparent.png`
- Split wall sprites:
  - `transparent/01-near-front-wall.png`
  - `transparent/02-far-back-wall.png`
  - `transparent/03-left-side-wall.png`
  - `transparent/04-right-side-wall.png`

Cubicle workflow:

1. Generate one coherent full cubicle pod first.
2. Make sure it reads as a low open-top office partition pod, not a room.
3. Split or generate separated wall sprites only after the full pod perspective and corner logic are solved.

Cubicle rules:

- Low open-top partition walls.
- Not full-height room walls.
- Not a maze, corridor, or backrooms-like enclosure.
- Same material language as props: charcoal metal, red fabric center band, smoky glass upper strip, black/gray posts, muted brass caps.
- Shallow 2.5D oblique projection.
- No desks/chairs/people inside unless requested as separate props.
- No baked shadows.

## Rooftop Stage

Current rooftop canon:

- Handoff: `concept-art/map-concepts/corporate-grid-flush-endwall-skyline-hallway-v8/ldtk-v14-rooftop-helipad-handoff`
- LDtk: `corporate_grid_v14_rooftop_helipad.ldtk`
- Runtime asset: `tilesets/v14_rooftop_helipad_stage_60.png`
- Level: `Rooftop_Helipad`
- Render layer: `Rooftop_Helipad_Tiles`

Rooftop stage rules:

- Same corporate tower universe as the office interiors.
- Keep broad open combat space.
- Use parapets, skyline, helipad markings, rooftop access structures, and corporate tower material language.
- Current background is baked into the stage art. Split parallax later only if needed.

## Asset Export Rules

Characters:

- Raw ImageGen dimensions are not reliable.
- Save raw generations as source only.
- Run `generate-modular-action-sprites/scripts/finalize_chroma_sprites.py`.
- Ship/review only finalized exact `1920x1080` chroma-key PNGs.

Props and modular environment assets:

- Generate on flat chroma key.
- Remove chroma locally to transparent PNG.
- Validate alpha corners are transparent.
- Save individual cutouts and a contact sheet.
- Include a manifest with dimensions and suggested collision shapes.
- Use bottom-center or bottom-midline origins for most placeable objects, then tune in engine.

LDtk/map handoffs:

- Handoff folders should contain only runtime assets, LDtk project files, and concise docs.
- Keep raw ImageGen sources, debug previews, and exploratory iterations outside clean handoff folders.

## Acceptance Checklist

Characters:

- Right-facing side profile.
- One character per 1920x1080 final PNG.
- Detached no-neck head.
- Separate body.
- Smooth digitless blob hands.
- Smooth digitless boot-blob feet.
- Visible gaps; no overlaps.
- Mouth hidden.
- No weapons, props, shadows, or labels.

Maps:

- Open combat lane.
- Repeating middle modules work cleanly.
- End caps/elevators align flush with tile lines.
- Floor tiles are clean, pristine, and not uniquely marked.
- Parallax city is separate when windows need moving skyline.
- Props are not baked into base floor/wall maps.

Props:

- Shallow 2.5D oblique perspective, not flat and not full isometric.
- Top planes visible.
- Verticals vertical.
- No baked shadows.
- Transparent cutouts.
- Contact sheet and manifest included.

Cubicles:

- Full pod solved first.
- Low open-top office partition read.
- Split walls derive from the coherent pod.
- Avoid backrooms/room/maze feeling.

