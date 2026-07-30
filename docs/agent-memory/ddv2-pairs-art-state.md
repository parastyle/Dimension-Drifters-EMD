---
name: ddv2-pairs-art-state
description: "Torso+head pairs art status as of 2026-07-20 shutdown — heads 12/12, torsos 7/12, gate conflict blocks the rest"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-20T06:33:04.437Z
---

As of 2026-07-20 (overnight session end): the torso+head pairs migration is live in-game — heads 12/12 rendered, torsos 7/12 (ash-walker, coldsnap, demon-mask, graveside, house-edge, molten-core, unbending). Heads render at HEAD_MOUNT_SCALE 0.85 (owner-ordered 15% shrink, display-only, in gen-gear.mjs manifest emit — keep it OUT of render-context hashes).

**Why:** The 5 missing torsos (ashen-crusader, nine-veils, thornwatch, neon-mirage, pressurized) systematically fail BOTH the 132px silhouette envelope AND the 90% core-coverage gate across 20+ attempts — the gates are in tension with flowing/ornate designs. Do NOT burn more renders; it needs an owner design ruling (options in BACKLOG.md "Overnight handoff 2026-07-20").

**How to apply:** Client loads pair art from packages/client/public/sprites/gear/<slot>/ (gen-gear syncs on install; catch-up via `--reuse-only --validate-only`). The client FREEZES the crop-frame tuples in gear-parts.ts and nulls the whole manifest on mismatch (falls back to the legacy necked rig) — any change to PART_FRAMES in gear-replacement-contract.mjs must be mirrored there. Re-render queue: 5 reclassified cowls (docs/head-fit-panel/panel.md) + thornwatch/unbending boots. Related: [[ddv2-colyseus-reflection-law]], [[ddv2-project-context]].
