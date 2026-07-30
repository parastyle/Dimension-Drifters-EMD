---
name: ddv2-characters-are-pill-grunts
description: "DDv2 characters are floating Madness-flash pill grunts (body + stub hands/feet + head), not figures"
metadata: 
  node_type: memory
  type: reference
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-23T02:13:33.578Z
---

DDv2 characters are **Madness-Combat-flash floating PILL grunts**, NOT detailed anatomical figures.
Each character sprite is a small set of floating parts: `body` (a pill/bust — hooded or hatted torso,
NO drawn legs, NO drawn arms; see `packages/client/public/sprites/cc-gravewake/body.png`,
`sprites/drifter/body.png`), plus floating STUB `hand-l`, `hand-r`, `foot-l`, `foot-r`. The rig floats
these with gaps; animations rely on this part layout.

**The head-separation change (owner, 2026-07-23):** add the HEAD as its OWN sprite so it floats/bobs
just like a hand — each character becomes max 6 parts: body, head, hand-l, hand-r, foot-l, foot-r.
Everything else stays identical.

**How art is actually made:** the prompt is the `artBrief` in `data/character-concepts.json` (e.g.
"...wide-brim slouch hat over a shadowed face, one DETACHED HAND hanging loose..., the other resting
flat. Flat hand-painted CEL art, bold readable outline, side-profile facing right..."). The detached
HANDS in the prompt are why hands slice into separate sprites. Pipeline: `tools/artkit/
gen-character-roster.mjs` + `harvest-install.mjs` + slicer `tools/artkit/guards/slice.mjs` →
`out/<id>/parts/parts.json`. To separate the head: REUSE the artBrief prompt, add a "detached head
floating above the shoulders" clause (mirror the detached-hand language), teach the slicer a `head`
role (top-most detached component), and rig the head as a floating part.

**Two mistakes I made and must never repeat:** (1) generating a detailed AAA standing figure with
drawn legs/arms/boots/duster — completely off-model; (2) proposing to chop the head off an existing
body.png — looks like a child's collage. Correct: reuse the existing generation prompt + pipeline,
modified only to emit a separate head. Faces stay concealed (shadow/hood/mask) — see the no-face rule.
Relates to [[ddv2-art-gen-one-subject-per-agent]].
