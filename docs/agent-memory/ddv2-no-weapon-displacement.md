---
name: ddv2-no-weapon-displacement
description: "DDv2 weapons must never move the character — no drift, lunges, or root motion from attacks"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-25T01:05:36.093Z
---

MELEE weapon attacks must NEVER displace the player character. No forward drift, no lunge
travel, no combo root motion. Players move themselves ("Players can move while attacking for the
same effect anyway"). Flips/spins happen in place; lunge-fiction weapons get their reach from
the hit envelope, not body travel.

EXCEPTION (owner, same day): "When guns fire their knockback should be real" — GUN RECOIL is
wanted: firing pushes the shooter back, scaled by weapon heft, implemented as a CLASSIFIED
server-motion source under the relaxed-authority model (never unclassified, or it rubberbands).

**Why:** Owner rulings 2026-07-24: kung-fu displacement "is messing up player positioning after
the combo is done" (B36 removed it from wraps), then after the sparkmitt's legacy forwardDrift
caused violent rubberbanding under relaxed movement authority (B42): "we don't want any drift or
displacement in our weapons anymore, too much for the server apparently." B44 removed it
game-wide.

**How to apply:**
- New weapon defs: never author `forwardDrift`, `rootMotion`, or `performance.lunge` character
  travel. A census test enforces zero weapon-attack motion sources.
- NON-weapon motion is fine and must be classified as server-motion epochs under the relaxed
  authority model: parry reactions, dodge/jump/slide, pit snap-back, elevator boarding, revive,
  enemy commit lunges (enemy-side).
- If an owner note asks for a "lunge/dash attack", deliver it as reach/envelope + animation, or
  confirm first — do not reintroduce body travel.

Related: [[ddv2-no-player-auras]] · [[ddv2-no-chain-physics]]
