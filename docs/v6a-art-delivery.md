# V6A art delivery notes

## Gravewarden Buster

- Stable catalog/gameplay id: `gravediggers-spade`.
- Proposed display name: **Gravewarden Buster**. This is intentionally documented for owner review; changing the label does not migrate the stable id.
- Generated sprite id: `gravewarden-buster` (original coffin-tapered western-gothic greatblade; no trademark likeness).
- Installed render: 256×73 transparent PNG through the normal artkit weapon slicer and base atlas.
- Full-frontflip behavior preserved: `frontflip: true`, `cooldown: 0.6`, `swingArc: 2π`, and `timingSwingArc: 2.7` are unchanged.
- Complete-circle melee/AoE radius widened from **150 px to 210 px** (+40%). Damage, rez radius, and attack timing are unchanged.

## Real page images

- Twin Whispervolumes now uses `projectiles/twin-whisper-page.png` (192×124 installed asset) for a recognizable lead-page volley on every attack and for its extra scattered chain-path projectiles.
- Verdigris Grand Grimoire now uses `projectiles/verdigris-grand-page.png` (240×111 installed asset) for its melee page-flutter projectiles.
- Verdigris retains the earlier **7× page scale**: the live page footprint is 98×70 px versus the 14×10 px ordinary-page basis. Its server-owned melee damage/range contract is unchanged.

## Coyote's Grin and thrown overlays

- Root cause of the missing Coyote projectile: the old Codex held-art master was a six-panel knife sheet. The slicer registered the panel-border component as `parts[0]`, and the generic thrown renderer blindly used that first part, so the launched payload appeared blank.
- Fix: a newly generated standalone projectile, `projectiles/coyotes-grin-throwing-blade.png` (192×73), is registered as `coyotes-grin-throwing-blade` and selected only for `x2-coyote-s-grin`.
- Yellow-circle root cause: `makeThrownWeapon` unconditionally added a 76×76 amber ellipse (`0xffb23b`) behind every thrown payload. It was not the pickup targeting ring. The shared ellipse was removed, so no thrown weapon receives that overlay.

## Headsman render outcomes

See [headsman-prototypes.md](headsman-prototypes.md) for the decision table, contact sheet, and live links. Installed prototype renders all passed alpha/coverage/green-spill validation:

- Radiant Verdict: 528×86
- Pale Procession: 528×134
- Woven Litany: 528×108
- Cathedral Ruin: 528×121

The live probe captured all four tip-attached variants plus the buster, both page treatments, and Coyote under `docs/owner-notes-audit-v6-evidence/v6a/`.
