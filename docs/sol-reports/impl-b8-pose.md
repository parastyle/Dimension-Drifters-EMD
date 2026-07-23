# B8 — Weapon pose, grip, and combo language

## Scope and system plan

B8 is a pose-only implementation pass for seven weapon IDs and eight owner notes. It will not edit
weapon VFX recipes or generated VFX assets. Catalog-authored pose metadata remains the source of truth:
normalized `gripPoints` locate painted contact points, `performance` selects held/action language, and
authoritative melee combo data defines the server-visible strike count and hit path. `pose-language.ts`
owns reusable held/locomotion vocabulary; `SpriteRig.ts` resolves weapon-specific pose and continuous
animation samples without changing combat authority.

Catalog input changes in `data/weapon-concepts-300.json` will be regenerated into
`packages/shared/src/weapons-expansion.generated.ts` with `pnpm gen`. Base-catalog changes remain in
`packages/shared/src/weapons.ts`. Regression coverage will pin exact metadata, held/action language,
continuous loop math, authoritative hit count/path, nominal damage/cadence, and the B8 census in
`tests/owner-notes-weapon-pose.test.ts` plus focused client/shared tests.

The live evidence gate will use private ephemeral ports only, with VFX disabled. Its left/right gallery
will capture grip markers and requested actions for all seven IDs. Evidence will be retained under
`docs/owner-notes-audit-v9-evidence/b8-pose/`, including loop-seam measurements for Gravewarden,
three-hit authority for Nullspike, and a stab-aligned Voltedge hit-envelope trace.

## Per-weapon plan

- **Gravewarden Buster (`gravediggers-spade`) — planned.** Replace the reset-prone frontflip with a
  fixed-rate continuous full-body/weapon rotation whose cycle endpoints are identical modulo one turn.
  Preserve its buster-sword identity, existing full-circle attack coverage, active timing, damage, and
  cooldown. Add mathematical loop-continuity and live seam evidence.
- **Saint-Bough Frost Crozier (`x2-saint-bough-frost-crozier`) — planned.** Add a dedicated one-hand
  upright walking-staff hold and locomotion sample, explicitly avoiding generic two-hand forward-staff
  inheritance. Pin one-hand catalog metadata and left/right live posture.
- **Nullspike Pike (`x2-nullspike-pike`) — planned.** Move the secondary normalized grip onto the
  painted midpoint purple wrap. Author exactly three authoritative capsule thrusts: short setup,
  driving second thrust, empowered third thrust. Preserve nominal total DPS by retaining base damage
  and cadence while making hit count and progression explicit.
- **Voltedge (`x-sword-neon-katana`) — planned.** Replace the superseded side-cut/wave-cut/lunge bar
  with stab-only attack language and a near-ear blade-up ready pose, while retaining polished katana
  rest quality. Align the authoritative hit envelope with the thrust and preserve nominal DPS.
- **Sunbreaker Railgun (`x2-sunbreaker-railgun`) — planned.** Add explicit primary/support anchors,
  placing the support hand on the painted horizontal foregrip immediately before the barrels. Pin the
  foregrip role and both-facing marker placement.
- **Fool's Gold Revolver (`x2-fool-s-gold-revolver`) — planned.** Override the generic pistol fraction
  with an explicit primary grip at the painted trigger. Pin the anchor and left/right marker placement.
- **Hollowbarrel Spell-Scattergun Staff (`x2-hollowbarrel-spell-scattergun-staff`) — planned.** Add
  horn-to-face held/action language with hands placed to play and aim the horn. Preserve its existing
  spout emitter, recoil behavior, damage, and cadence; do not route it through generic forward staff.

## Incremental implementation log

- **Gravewarden Buster — implemented.** Replaced `frontflip` with the shared held
  `ground-whirlwind` path: one forward revolution per unchanged 0.6 s cadence, continuous trigger
  scaling, full body paper-turn, and no generic swing reset. The rig now consumes a pure unwrapped
  fixed-rate angle helper; tests prove phase 0/1 have identical sine/cosine and equal one-sided angular
  velocity. Existing 210 reach, 2π coverage, legacy active window, 8 damage, and 0.6 s cooldown remain
  unchanged. Live seam capture remains pending.
- **Saint-Bough Frost Crozier — implemented.** Reclassified the generated record as one-hand grip,
  placed its sole hand at normalized `(0.2, 0.68)` on the painted green wrap, and assigned the new
  reusable `one-hand-walking-staff` hold with a distance-driven 10 px stride tap. The sampler keeps the
  crook upright through idle/locomotion and leaves the far hand unclaimed, while `default-swing` yields
  to its unchanged quake attack. Damage, radius, cooldown, and display length are unchanged. Codegen and
  live left/right checks remain pending.
- **Nullspike Pike — implemented.** Moved the secondary shaft anchor from `x=0.45` to `x=0.34`, the
  center of the painted purple midpoint wrap. Added a generated, authoritative three-beat thrust bar:
  compact setup (`0.86×` reach), full driving second thrust, and a longer `1.12×`/88-knockback impale
  finisher. Every beat is a single capsule path with a `1.0` damage multiplier, so the sequence has
  exactly three accepted hits without changing base damage or 0.64 s cadence. Codegen, server hit
  census, and live marker/action evidence remain pending.
- **Voltedge — implemented.** Replaced the `side-cut`/`wave-cut`/hero-spin route with the explicit
  `voltedge-stab` thrust family and promoted all three accepted beats to authoritative capsule paths.
  Added the reusable `near-ear-blade-up` screen guard (hilt beside the ear, blade vertical) and a
  stab-only presentation bar (`lunge`, `knee-stab`, `lunge`). All three path damage multipliers remain
  `1.0`; the third reads as empowered through `1.08×` reach and 64 knockback. Base 5.5 damage and 0.28 s
  cadence are unchanged. Live stab-envelope evidence remains pending.
- **Sunbreaker Railgun — implemented.** Added explicit painted-art anchors: the firing hand at
  `(0.43, 0.67)` on the receiver/trigger grip and the support hand at `(0.55, 0.64)` on the short
  horizontal foregrip immediately before the twin rails. Added `horizontal-foregrip` as a typed
  secondary role whose hand renders above the weapon layer. Gun damage, fire rate, range, recoil, and
  all muzzle behavior remain unchanged. Codegen and both-facing marker evidence remain pending.
- **Fool's Gold Revolver — implemented.** Replaced the legacy `gripFrac=0.16` render fallback with an
  explicit primary anchor at `(0.53, 0.72)`, centered on the painted trigger inside the oversized
  trigger guard. This moves only the hand/pivot; the 10-damage shot, 0.38 s fire rate, six-round
  magazine, recoil, and muzzle definition are unchanged. Codegen and both-facing trigger-marker
  evidence remain pending.
- **Hollowbarrel Spell-Scattergun Staff — implemented.** Reclassified the hold from generic
  `aim-forward` staff to the reusable `horn-to-face` pose. The lead hand now raises the mouthpiece to
  face height while the far hand supports/plays the tube; art anchors move to `(0.28, 0.5)` on the
  wrapped mouthpiece and `(0.54, 0.5)` on the central handle. The existing `spout` emitter, recoil
  action, eight-projectile scatter, damage, range, and cooldown are unchanged. Codegen and left/right
  face-height evidence remain pending.
