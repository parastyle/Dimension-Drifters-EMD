# Owner playtest notes — audit ledger v8 (2026-07-22 day/evening batch)

Source: `data/owner-notes.jsonl`, 20 notes `03:36:32Z` – `20:11:40Z`, all after the v7 watermark
(`2026-07-22T02:35:18.940Z`). Combined here with the **28 unstarted Wave D rows carried over from
v7**, because they contend for the same monolithic files and must be ordered as one queue.

Standing rules in force: new special effects are **codex-generated bitmap art** unless the owner says
otherwise; server authority and nominal DPS are preserved unless an order says otherwise; visual
orders close on **live evidence + a permanent gate**, never on "tests pass"; every Sol keeps a
durable incremental report under `docs/sol-reports/`.

---

## WAVE A — REGRESSIONS AND REPEATS (launched first, ahead of all new content)

These are things the owner has already reported, or that used to work and no longer do. They rank
above new weapons: a broken promise costs more than a missing feature.

| # | Weapon | Order | Repeat status |
|---|---|---|---|
| A1 | **Galvanic Overcasters** | "character movement and bullet origins go crazy when you continuously fire and walk at the same time" | **THIRD report.** v7 row said investigate; commit `4662c4a` claimed an authority/prediction fix plus the permanent `e2e/tests/burst-origin-moving.spec.ts` gate. **That gate is green and the owner still sees the bug**, so the gate is measuring the wrong thing. Do not trust it. |
| A2 | **Bone Sword** (`x-sword-bone`) | "the VFX regressed…we used to have actual magma balls come out of this one what happened?" | **Regression.** Magma-ball projectiles existed previously. Find the commit that removed them (candidates around the v4/v5 note waves, `c4532ef`/`f738040`), and restore behaviour rather than authoring a lookalike. |
| A3 | **Buzzard's Burnout** | "misaligned bullets with barrel" | **Repeat class.** Wave A of v7 shipped the muzzle-in-art-space law with a sampled muzzle gate. This weapon still misses, so either it is outside the gate's weapon set or its art-space muzzle point is wrong. |

**A1 gate-honesty requirement.** Before any fix, live-probe the real game while *continuously firing
and strafing* for several consecutive bursts and record where rounds spawn versus the rendered muzzle.
Then explain in the report why `burst-origin-moving.spec.ts` passes anyway. Strengthen that gate until
it reproduces the owner's complaint, then fix. Never weaken it.

---

## WAVE B — NEW MECHANIC: BOLT ACTION (systemic, owner-generalized)

| Weapon | Order |
|---|---|
| **Tracer-Saint Carbine** | "this is a bolt action rifle. Needs bolt action animation, (back down up forward)" |
| **ALL bolt-action guns** | "This extends to all guns that are bolt action" — the owner explicitly generalized it |
| **NEW WEAPON** | "Make a bolt action 50 cal barretta sniper rifle" — full pipeline: catalog, generated art, VFX, muzzle, card |
| **Sidewinder Twin Rifles** | "This is dual wield lever action, but hands will need to lever animate" — lever mechanism on BOTH hands while dual-wielding |

This is the same seam as the shipped v7 pump/lever work (`v7-hands-affine`): an explicit
accepted-shot mechanism phase layered on the shared grip/pose surface. Bolt action is a **four-phase**
cycle (back → down → up → forward), richer than pump or lever. Dual-wield lever is the first
mechanism that must drive two hands independently. Census every bolt-action weapon in the catalog —
the owner asked for the rule, not one weapon.

---

## WAVE C — WEAPON ORDERS (new, this batch)

| Weapon | Order |
|---|---|
| Dustreaper Zweihander | Fire dragon VFX (generated) |
| Sword Whirlwind | 2× bigger |
| Mournveil Scythe | 1.3× bigger |
| Hailstorm Coilgun | Grip is wrong: stock should sit **under the shoulder, not held**; the stock hand moves **forward of the barrels** as a support hand |
| Hexbore Voidmaw | Re-render the gun art **completely flat side profile**; keep existing VFX. (Also carries the v7 row: −20% size, one-handed pistol) |
| Thunderhead Lever-Gun | Blue **helix** shots |
| Ironhide Buffalo Gun | 50-cal shots (v7 row said anti-tank 50-cal shell — **repeat**, verify it landed) |
| Brimstone Rocket Tube | Gun slightly more **forward**, one hand on trigger (v7 row said one hand on trigger — **repeat**) |
| Thunderhead Repeater Cannon | Circle energy shots — "like a smoke ring from a mouth" |
| Ironhail Pepperbox | Hand on the trigger |
| Mesa Heart-Geodes | Lots of purple crystal VFX everywhere |
| Arcane Lance Staff | Needs **image** VFX to replace current VFX (generated, not procedural) |
| Mirage Hardlight Saber | Give this the **blade-extension technique** (the unified blade-basis transform + per-combo ignition from `852d9d0`) |

---

## WAVE D — CARRIED OVER FROM v7, NOT YET STARTED (28 rows)

Ownership per `docs/sol-reports/plan-v7-remaining.md`. Five of nine v7 Sols shipped
(hands, beams, generated art, movement, katanas); these four remain.

- **`v7-stars-archive-catalog`** — 4 new throwing stars (iron/fire/ice/void, full pipeline);
  archive Coffin-Nail Carbine; archive Psalter of the Burning Halo. *(3 rows)*
- **`v7-ranged-orders`** — 18 rows: Brimstone Gallows-Rifle (flaming crosses), Brimstone Rocket Tube,
  Mesa Hand-Cannon, Tesla Faradayer, Plaguespitter Flak Gun, Sanctus Siege Bombard, Stormcaller Tesla
  Gatling (6 beams, repeat), Sidewinder Spitfire, Gravelung Punt-Rifle, Ironhide Buffalo Gun,
  Galvanic Coachgun, Ricochet Pistol, Hailspitter Pepperbox, Dustline Lever-Action, Hexbore Voidmaw,
  Gravelthroat Repeater, Tesla Drumbore, Frostfang Speargun.
- **`v7-melee-caster-orders`** — 9 rows: Gravewarden Buster, Sidewinder Spontoon, Fulgurite
  Storm-Sphere, Boothook Harpoon, Tombstone Greatsword, Saint-Bough Frost Crozier, Thunderhead Voulge,
  Nullspike Pike, Idol of the Pale Verdict.
- **`v7-remaining-qualification`** — read-only audit of every closed row.

---

## Merge decisions (v8 into the v7 queue)

The new notes are **not** a separate program. They fold into the existing serialized chain, because
they contend for the same monolithic files (`GameRoom.ts`, `ArenaScene.ts`, `SpriteRig.ts`, the
weapon catalog):

1. **Wave A regressions run FIRST**, ahead of everything, as their own Sol.
2. **Wave B bolt action** joins the mechanism/hands lineage; it owns `SpriteRig` mechanism phases and
   lands before ranged content that depends on firing hands.
3. **Wave C ranged/grip rows** merge into `v7-ranged-orders`. Overlapping weapons (Hexbore Voidmaw,
   Ironhide Buffalo Gun, Brimstone Rocket Tube) are ONE row each carrying both the v7 and v8 orders —
   do not implement them twice.
4. **Wave C melee/caster rows** (Dustreaper, Whirlwind, Mournveil, Mesa Heart-Geodes, Arcane Lance,
   Mirage Hardlight Saber) merge into `v7-melee-caster-orders`.
5. The new **bolt-action 50-cal sniper** and the **4 throwing stars** are both new-weapon pipelines
   and share the `v7-stars-archive-catalog` catalog lease.

Row accounting: 28 carried v7 rows + 20 v8 notes, with 3 overlaps collapsed and 2 v8 notes
(bolt-action generalization + "extends to all bolt guns") being one systemic order.

Watermark: all notes ≤ `2026-07-22T20:11:40.781Z` ledgered.
