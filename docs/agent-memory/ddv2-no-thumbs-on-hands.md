---
name: ddv2-no-thumbs-on-hands
description: DDv2 character hand sprites must not show thumbs or any digit that implies palm direction
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-24T00:56:28.749Z
---

Whole-art character HAND sprites must be ambiguous ovals — no thumbs, no fingers, no palm indicators.
The hand should read equally well as "palm-facing-us" or "palm-facing-away" so the rig can face
either direction without the painted digits contradicting the facing.

**Why:** Owner note (2026-07-23, ledger v10 row 412): "Many hands are placed correctly on the weapons,
however their orientation doesn't make sense given the direction of their thumbs." Rather than build
a per-hand rotation system (a whole subsystem to reconcile art with facing), the owner authored a
no-thumb hand style that eliminates the mismatch at the source. Cheaper, simpler, and generalizes.

**How to apply:**
- When generating or authoring character sprites (proto-*), hands must be plain oval mitts with NO
  thumb, NO fingers, NO knuckle detail that implies a specific palm direction.
- The 37 new no-thumb characters from `char-rig-batch3` (37 whole-art roster, `proto-cowboy-hidden-face`
  is DEFAULT_CHARACTER) are the authoritative reference for the current hand style.
- If a new sprite ever shows a thumb, REJECT it and ask for a re-render.
- Weapons ARE allowed to show grip-adjustments/finger positions on their held art — EXCEPT
  glove/wrap-type weapons that REPLACE the hand (kung-fu wraps, mitts): those must be finger-free
  blobs matching the character mitt style. Owner (2026-07-23): "our characters hands are blobs,
  why do ours include fingers?" Also: generate ONE single-hand wrap and let the rig duplicate it
  per hand — never a fused pair sprite (Muay Thai's fused pair rendered 4 fists on one character).
- Retire proto-sheriff and proto-witch — they had thumb-having hands and no no-thumb version was
  authored. `char-rig-batch3` removes them from the active roster.

Related: [[ddv2-characters-are-pill-grunts]] · [[ddv2-no-chain-physics]]
