---
name: ddv2-art-gen-one-subject-per-agent
description: "DDv2 art law — one image-generation subject per agent, or subjects bleed into each other"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-23T01:40:54.102Z
---

For DDv2 Codex art generation: **one image-generation SUBJECT per agent. Never batch multiple
subjects (multiple characters/weapons/pets/VFX) into one agent's run.**

**Why:** the owner observed, and it was confirmed, that when a single agent generates more than one
image subject, earlier subjects BLEED into later ones — theme/style/content contaminates across
subjects sharing the agent's context. Concrete case: `x2-barrett-50-cal-sniper` came out with an
unwanted crusader/blood theme because the bolt-action Sol generated it in the same agent as 5
occult-themed rifles.

**How to apply:** give each subject its own agent. Preserve cohesion via a SHARED REFERENCE, not
sequential same-context generation — generate the anchor/base subject first (e.g. the Drifter for
characters), then hand every other subject's isolated agent that reference image + the shared
house-style preamble. Shared reference = cohesion without bleed. This means for N art subjects you
launch ~N agents (the owner endorsed "as many Sols as you need to do this correct"). Batched art from
before this rule (the Barrett, etc.) is suspect and should be regenerated in isolation. See
[[ddv2-owner-notes-workflow]] and the binding note in docs/design/OWNER-DECISIONS-characters-pets.md.
