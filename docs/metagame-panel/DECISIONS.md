# Meta-game overhaul — user rulings (binding)

Recorded 2026-07-18. The confirmed direction, overriding conflicting panel output.

## The shape

- **One boilerplate blank-slate character** (Madness-Combat flash style). Character unlocking/switching
  retires. The 40 characters' spreads/quirks become GEAR.
- **Gear is meta progression, permanently unlocked, customized between runs**: boots, gloves, shirt,
  pants, cloaks, glasses, facial hair, hats (hats especially). Gear carries the stats and abilities
  characters used to.
- **Pets stay meta progression** (as shipped).
- **Weapons are persistent-but-losable**: everything you extract with banks into a persistent bag you
  bring every run; you can drag any bag weapon into the active 3 slots mid-run, but primarily play
  your 3. **Death loses ALL carried weapons — no insurance floor (RULING #1: confirmed; the real
  journey is gear, pets, and beating the game; weapons are the stakes).**
- **Charges/durability/ammo retire → one constantly-recharging resource bar.** Big weapons cost more
  resource. **RULING #2: beams overheat NATURALLY through the bar — holding the beam drains it;
  empty = the lock.** Signature weapon behaviors survive as ways of SPENDING the bar, not separate
  economies.
- Runs drop clothes (meta unlock), pets (meta), and weapons (persistent/losable).
- Orchestrator note carried from the pitch discussion: fold META_UPGRADES into gear so ownership
  stays one sentence — gear is who you are, pets are who's with you, weapons are what you hold and
  can lose.

## Prestige — the hat tower (user direction, 2026-07-18)

- Prestige stacks hats: each prestige grants **+1 hat slot stacked on top of the last** (the ARAM
  joke played straight), capped ~30. The tower IS the prestige badge — worn, visible, absurd.
- Orchestrator design sketch to be refined by the gear panel's implementation brief:
  - Prestige trigger: beating the game (the ruling's "real journey"); each prestige raises a
    difficulty tier (NG+-style) and may reset the weapon bank (stakes reset, gear/pets never).
  - The tower renders as a SPRING CHAIN — each hat a jiggle-linked segment (the worm-follow /
    jiggle-stack idiom), lagging and wobbling with movement, toppling lean on dashes. Peak
    flash-animation comedy, nearly free on the existing rig tech.
  - Readability law: the tower miniaturizes as it grows and never occludes telegraphs; render-cap
    with a "+N" tassel beyond ~12 visible hats if perf or clarity demands.
  - One account int (prestige count) + the equipped tower composition; same local-trust model.

## The boilerplate identity — STITCH-SEAM DUMMY (user ruling, 2026-07-18 morning)

- The approved base character is the **stitch-seam training dummy** concept
  (tools/artkit/out/character-concepts/stitch-seam-dummy.png): oatmeal canvas, one vertical
  charcoal stitch seam up the torso midline, a darker-weave shoulder patch, a cross-stitch X face.
- **Design-language amendments (binding, two fronts):**
  1. Hands AND feet are **nearly indistinguishable soft blobs** — no fingers/thumb lobe, no
     wedge/heel/toe foot shape. One shared lump language for all four extremities.
  2. The head is a **fully floating object with NO neck** — exactly like Madness. The head must
     bob and jiggle independently ("we were missing the feel because the head wasn't jiggling").
- Consequence embraced by the ruling: **helmets become ALTERNATIVE HEADS** in the wardrobe — a
  head-replacement gear class alongside stack-on-top hats.
- Rig kit: six fully detached parts — torso bean (no legs), floating head, 2 blob hands,
  2 blob feet — all riding the SpriteRig jiggle skeleton.
