---
name: ddv2-colyseus-reflection-law
description: "DDv2 client decodes Colyseus state by REFLECTION — server-side compatibility getters don't exist on client rows; read nested schema rows directly"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
---

DDv2's client joins with `client.joinOrCreate<ArenaState>(ROOM_NAME, opts)` — a TYPE
parameter only, no root-schema constructor — so Colyseus decodes state by reflection.
Decoded client rows carry ONLY real `@type` wire fields. The plain TS compatibility
getters on `PlayerState` in `packages/shared/src/state.ts` (gearUpper, gearLower,
prestige, weaponResource, pairBaseSeq, offCharges…) exist ONLY on server-constructed
instances.

**Why:** Client code calling those getters gets `undefined` (crash on `.length`/member
reads, silent NaN on arithmetic). Unit tests never catch it — they use real server
instances; only the live wire path (e2e/manual play) fails. This black-screened every
arena join the night of the metagame overhaul (2026-07-18).

**How to apply:** Client code reads the nested row directly with guards:
`player.dualWield?.gearUpper ?? ""`, `self.dualWield?.weaponResource?.valueQ` — the
idiom is documented in ArenaScene.addBlob and ui/loadout-entry-view.ts. When a Sol
wave adds client reads of new PlayerState tail fields, put the reflection law in the
prompt. Related: [[ddv2-codex-sol-delegation]], [[ddv2-project-context]].
