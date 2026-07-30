---
name: ddv2-no-chain-physics
description: "DDv2 weapons must not require chain/tassel/rope/string physics for immersion — we don't have that simulation"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-23T18:45:35.808Z
---

Weapon designs must NOT include chains, tassels, ropes, strings, or any flexible dangling
element that would require dynamic physics to look right in motion. We don't have chain-physics
simulation in DDv2's engine, so those elements read as broken/rigid on-screen.

**Why:** Owner rejected the "Rubber-Chicken Flail" concept from the B2 wacky-weapons list
specifically because a flail requires chain physics. The visual immersion fails without it.

**How to apply:**
- When proposing new weapon concepts (v9 planner Sols, B2/B3/B14 art Sols, etc.), REJECT
  anything with visible chains/tassels/ropes/yo-yo strings/whip cords/pendulum lines.
- Existing weapons that have modeled tassels/chains as authored STATIC art are fine (they don't
  move) — the ban is on designs whose CORRECT motion requires physics we don't have.
- Rigid single-piece bludgeons/blades/launchers/projectiles are always safe.
- Beams, thrown objects, ballistic projectiles, and gas/cone/arc effects don't need physics.
- If ever unsure, pick a rigid substitute.

Related: [[ddv2-project-context]] · [[ddv2-art-gen-one-subject-per-agent]]
