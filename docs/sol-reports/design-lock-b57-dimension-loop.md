# B57 Design Lock — The Dimension Loop (grind rooms · timed portals · boss sequences)

Locked with the owner in chat, 2026-07-25. This is the game's **core structure** and supersedes
the endless-corporate-tower framing from B34. It composes with (does not replace) the B20 economy
lock — chests, trinkets, disassembly, banking, and booster packs continue exactly as locked there.

Rules marked **LOCKED** are owner decisions. Items marked *default* are orchestrator-recommended
starting values, tunable without re-approval.

---

## 1. The loop

A run is a chain of **dimensions**. Each dimension is one big procedurally generated room — the
endless mob fight, the meat and potatoes of the game. You fight there until one of two things
happens:

- **You die.** Run over; money banks (B20).
- **You take a portal.** It tunnels you through a short authored **boss sequence**, and you come
  out in a *new* big room, harder than the last.

There is no hub, no home base, no persistent mid-run space, and no crystal currency. Portals are
the tunnels; taking one is the only way forward.

```
[ big procedural room: grind ] --portal--> [ boss sequence: 2-3 authored scenes + boss ]
          ^                                              |
          |______________ new, harder big room __________|
```

---

## 2. LOCKED rules

1. **No hub.** Nothing persists inside a run except the player's loadout and relics/trinkets.
2. **No crystals / no portal currency.** Portals are not bought or unlocked; they appear.
3. **Grind rooms are the primary content** — big, sprawling, procedurally generated, dangerous
   from the moment you arrive.
4. **Boss portals spawn at random positions as time-limited events.** They open somewhere in the
   room, are visible, and close if unused.
5. **Unlimited concurrent portals.** Two open at once is lucky; three is luckier. No cap.
6. **Portal TYPE selects both the boss sequence and the destination.** Different portal = different
   authored sequence + different kind of big room on the far side. This is the branching in
   "Dimension Drifters".
7. **Portal type is visible before committing** *(recommended and accepted in-chat)* — the tell is
   part of the portal's art/VFX. Choosing a distant, better portal over a near, worse one under a
   closing timer is the core decision.
8. **Ignoring every portal is survivable but losing.** Escalation kills you: more enemies, faster
   enemies, tougher enemies.
9. **A closing gas circle is the guaranteed kill.** Every room ends. The shrink turns the late room
   into a crescendo: tighter space, thicker enemies, concentrated decisions.
10. **Boss rewards: a cool weapon** carried onward into the run. (No crystal — the portal you took
    already delivered you to the next dimension.)
11. **Difficulty escalates per dimension** as the run chains onward.

## 3. Orchestrator-recommended defaults (tunable)

- **Portal spawn floor** — a guaranteed minimum cadence so RNG can never trap a player in a room
  with no exit. Mirror the shipped B20 chest rubber-band (a weapon-bearing chest is guaranteed
  every 2.5 min); *default:* at least one portal opportunity per N minutes, N tuned so a dry
  streak is impossible.
- **Portals keep spawning inside the safe zone once gas is closing**, so the crescendo stays
  playable. Portals already open outside the zone remain enterable — a dare, not a lockout.
- **Portal lifetime** long enough to cross the room from most positions, short enough that the
  choice hurts.
- Escalation curve drives spawn rate, enemy tier (B20 L5 weapon/enemy tier machinery), and gas
  timing from the same room clock.

---

## 4. The mode collapse (this is why the vision is also the refactor)

**LOCKED (owner):** "Im not sure why they are different modes when the other material difference
is the shape of the map which could have been anything in the first place."

Correct, and historical accident: belt began as its own prototype (#8), was folded into ArenaScene
to share systems (#14), and the mode flag was never collapsed. Today there are ~221 `belt`
references in `ArenaScene.ts`, 68 in `net/prediction.ts`, 26 in `room-movement.ts`, and 78 explicit
`if (belt…)` branches. That flag doubles the behavior surface without doubling the test surface —
it is the direct cause of the belt regressions (missing UI, aim not tracking cursor, double-position
phasing) that shipped "green" because every gate ran the top-down branch only.

**Target:** there is ONE map system. A map is data:

| Property | Big grind room | Boss-sequence scene |
| --- | --- | --- |
| Source | procedural mapgen | authored LDtk modules |
| Bounds | wide open, full 2D | shallow depth band |
| Camera | follow, full 2D | constrained/side framing |
| Exit | timed portals | sequence advance -> boss -> exit portal |
| Waves | escalating + gas | authored, scripted |

No `belt` flag. No "belt mode" name anywhere in the codebase or UI. Both shapes run the same
movement, aim, HUD, combat, netcode, and rig paths, and every gate runs against both.

**Content mapping:** the corporate-grid LDtk floors + elevator sequence (B34) become the template
for **boss sequences** — they already are "a couple of sequenced scenes before you get back out".
The existing arena mapgen becomes the **grind rooms**.

---

## 5. Dispositions

| System | Disposition |
| --- | --- |
| B20 economy (chests, trinkets, disassembly, banking, packs) | KEEP unchanged; chests live in grind rooms |
| B55 chest contents (trinkets/augments/weapons/pets/potions) | KEEP; the grind room is where they drop |
| B34 corporate floors + elevator loop | RE-CAST as a boss-sequence template, not an endless mode |
| "Belt mode" as a concept/name | DELETE — collapses into map data |
| Ultimates | Remain OFF (owner ruling, B55) |
| Crystals (earlier draft) | NEVER BUILT — cut in design |
| Hub / base-building (earlier draft) | NEVER BUILT — cut in design |

---

## 6. Implementation lanes (serial; each independently shippable)

1. **L1 — Mode collapse.** Delete the `belt` flag; express both shapes as map data (bounds, camera
   profile, spawn rules, source). One code path for movement/aim/HUD/combat/netcode/rig. Every
   standing gate (telemetry harness, part-snap probe, flip probe, smoke) runs against BOTH map
   shapes. *Prereq: B56 belt parity lands first so we collapse onto a working baseline.*
2. **L2 — Portals.** Server-authoritative timed portal events: spawn cadence + floor guarantee,
   random valid placement, unlimited concurrency, visible type, lifetime/expiry, entry handoff.
3. **L3 — Room escalation + gas.** Escalating spawn rate/speed/tier on the room clock; the
   shrinking lethal circle; portal/gas interaction per §3.
4. **L4 — Boss sequences.** Portal type -> authored sequence (LDtk modules) -> boss -> weapon
   reward -> exit into the next dimension at increased difficulty.
5. **L5 — Dimension variety.** Multiple portal types with distinct destinations; the branch table.

Each lane: full gen/typecheck/test green, both-shape gates, and an orchestrator screenshot gate
before merge — per the standing `ddv2-big-visual-changes-contract`, which this program is bound by.
