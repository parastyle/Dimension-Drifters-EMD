# Sol Report: Drifter Character Art

## Understanding

- Produce exactly one subject: the Drifter.
- Ship two real bitmap PNG layers: a headless body and a separate low-brim, fully face-concealing head.
- Treat this artwork and its authored record as the canonical house-style reference for all later characters.
- Keep all writes inside the user-specified lease; do not wire the assets into the live game.

## Plan

1. Read the binding owner decisions, character-art pipeline, head-rig geometry, roster entry, and Drifter concept data.
2. Lock the canonical canvas, proportions, palette, head anchor, overlap offset, and generation prompts.
3. Generate only the Drifter body and head on flat chroma-key backgrounds, remove the key locally, and inspect both transparent layers.
4. Regenerate or refine any layer that violates face concealment, separation, silhouette, or style requirements.
5. Write `data/characters-v2.json` and the evidence checklist, then verify file scope, PNG alpha, dimensions, and final authored values.

## Assumptions

- The exact authored dimensions and rig offsets will be derived from the binding design documents before generation.
- A fully opaque, hard-surface sprite silhouette is suitable for the required built-in chroma-key transparency workflow.

## Progress

- Started: read the required image-generation workflow; built-in generation with flat chroma-key removal is the selected path.
- Read the binding owner, roster, pipeline, and head-rig specifications. Confirmed branch `feat/v0.118-metagame` and found no pre-existing v2 Drifter lease files.
- Confirmed `data/character-concepts.json` has no canonical Drifter record; the explicit Drifter job in `chars-4-pipeline.md` is the source of truth.
- Locked reference geometry: 1024x1024 canonical source canvas; `B_source=512`; runtime body height 76 px; body root `(512,512)`; head socket `(0,-0.38B)`; pivot `(0.50,0.55)`; mount scale `0.85`; resting overlap `0.18B`.
- Locked palette: outline `#101014`, void `#22252B`, duster tan `#C49A5A`, bone-dust highlight `#CFC6AE`, faded indigo `#4E5C73`, oxblood `#A8482E`.
- Locked style: shallow high three-quarter/right-facing arena read; compact no-neck paper-cut figure; bold imperfect near-black contour; flat base plus one hard shadow and at most one hard highlight per material; grim occult-western wear; sparse detail that remains legible at 76 px.
- Delivery adaptation: the work order requires exactly two final layers, so all torso/arm/hand/leg/foot pixels remain in `body.png`; only the head is separated. A single coherent two-island source plate will keep the layers stylistically matched.
- Generated one coherent Drifter-only two-island plate with Codex built-in image generation, using the legacy Drifter only as a contour/material reference and explicitly rejecting its obsolete visible eye.
- Chroma-keyed with soft matte and despill, split the two groups, and normalized the body alpha height to the shared 512 px source unit. Final body is `576x544`; final head is `576x320`.
- Visual inspection passed: the head is a closed opaque low-brim/featureless-shadow mass; the body is headless with a closed shoulder roof and no neck art; the rest composite reads clearly at the canonical 76 px body scale.
- Nine-position bob proof passed at runtime offsets `x,y in {-4,0,+4}` px. Every sample retained physical alpha overlap; the smallest measured intersection was 6,853 opaque pixels in the canonical source proof.
- Final validation passed: exactly two files in the asset lease, PNG/RGBA modes, transparent corners, expected alpha bounds, JSON parse and one-record subject audit, SHA-256 match, and LF-only text files. The live game and runtime wiring were untouched.

Verdict - Drifter body+head shipped; face-law checklist PASS (no skin, eye/eye mark, nose, mouth, jaw, facial hair, ear, expression, or readable profile; opaque Eclipse Brim; separable head; no neck; nine bob extremes pass); EXACT REFERENCE DATA TO INHERIT - palette {outline:#101014, voidDeepShadow:#22252B, weatheredDusterTan:#C49A5A, boneDustHighlight:#CFC6AE, fadedIndigoCloth:#4E5C73, oxbloodLeather:#A8482E}; proportions {sourceCanvasPx:[1024,1024], bodyHeightUnitPx:512, runtimeBodyHeightPx:76, bodyRootPx:[512,512], torsoWidthToHeightTarget:0.95, torsoWidthToHeightBand:[0.90,1.00], mountedHeadHeightB:0.46, mountedHeadHeightBandB:[0.44,0.48], mountedHeadWidthToShoulderTarget:0.73, mountedHeadWidthToShoulderBand:[0.70,0.77], allCharactersSameSize:true}; headAnchor {socketB:[0,-0.38], socketPxOnCanonicalCanvas:[512,317.44], pivotUV:[0.50,0.55], pivotPx:[288,176], mountScale:0.85, restOverlapB:0.18, restOverlapSourcePx:92.16, restOverlapRuntimePx:13.68, bobLimitRuntimePx:[4,4], worstCaseMinimumOverlapB:0.10, noNeck:true}; houseStylePreamble "Match DRIFTER_STYLE_LOCK_V1: one same-scale compact no-neck paper-cut figure in a shallow high three-quarter, screen-right arena read; bold slightly imperfect #101014 contour; restrained 4-6-color matte palette; flat base plus one hard shadow and at most one hard highlight per material; grim occult-western wear; sparse detail that remains legible at 76 px; one bespoke opaque face-concealing head overlapping a closed shoulder roof; no visible biological face, neck, props, VFX, gradients, or soft, photoreal, anime, pixel-art, or 3D rendering."
