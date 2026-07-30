---
name: ddv2-big-visual-changes-contract
description: "DDv2 rule for large visual/map/perspective changes — incremental, all surfaces enumerated, playable after every merge"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-24T02:08:31.305Z
---

When the owner asks for a large visual or map change (perspective shift, tileset overhaul, prop
rework), it is a RENDER-LAYER change, never a world rebuild.

**Why:** A past attempt at a map/perspective change went off the rails: an unrelated artifact got
built, the new map dropped the existing assets/weapons, and the training room was never migrated
(still flat when the owner checked). Owner (2026-07-24): "What I'm scared of is you going crazy and
redoing all our shit because we're tweaking how maps work."

**How to apply:**
- The game stays FULLY playable after every merge — same weapons, characters, systems. A merge that
  drops arsenal/roster wiring is rejected at the orchestrator merge gate.
- Sol briefs must say "modify the existing render path," never "rebuild"/"new scene."
- Enumerate EVERY surface in the brief (ArenaScene, training room, belt mode, dev-portal deep
  links) and require per-surface screenshot proof before merge. Half-migrated surfaces (the
  training-room-still-flat bug) are the known failure mode.
- Orchestrator verifies with own eyes (screenshots, weapons firing), never Sol self-report — same
  rule as [[ddv2-project-context]] character-rig verification.

Related: [[ddv2-codex-sol-delegation]]
