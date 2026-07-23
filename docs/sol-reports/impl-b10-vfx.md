# B10 — Weapon VFX cleanup/reuse

Branch: `sol/b10-vfx`

Authoritative source: `docs/sol-reports/notes-ledger-v9.md`, section B10.

## Initial system map and plan

The live weapon-effects system has three relevant paths:

1. Generated Weaponsmith suites are sourced from `tools/weaponsmith/assignments.json` plus
   `tools/artkit/weapon-vfx-overrides.json`, baked into
   `packages/client/src/vfx/weapon-vfx.generated.ts`, and resolved/anchored by
   `packages/client/src/vfx/weapon-vfx-suite.ts`.
2. Catalog `effectRecipe` values resolve through
   `packages/client/src/vfx/weapon-effect-recipes.ts`; caster aura recipes are also resolved there and use
   the installed generated particle packs.
3. Blade extensions are a separate retained client treatment. Texture/treatment selection lives in
   `packages/client/src/vfx/blade-extension-treatments.ts`, geometry and the authoritative damage override
   live in `packages/shared/src/hit-envelope.ts`, and `VfxPlayer` owns the one-time ignition/retraction
   lifecycle. Headsman additionally has prototype compatibility helpers in
   `packages/client/src/vfx/headsman-prototypes.ts`.

Existing approved assets to reuse (no new art):

- `packages/client/public/vfx/weapons/v7/fulgurite-blue-fill.png`
- `packages/client/public/vfx/weapons/v7/tombstone-stone-smoke.png`
- `packages/client/public/vfx/weapons/v7/thunderhead-voulge-blue-effect.png`

Implementation plan:

- Add an explicit generated-art treatment seam whose authored dimensions/placement can be asserted against
  the matching gameplay envelope, then preload/render only the three existing V7 assets.
- Recompose Fulgurite as overlapping centered blue fill layers spanning from the owner through its 450 px
  aura radius, retaining its blue chain/aura palette and nominal damage.
- Replace Tombstone's quake-particle treatment with its existing stones-and-smoke-only asset and add a
  particle census that rejects bones while retaining both requested subjects.
- Replace Thunderhead Voulge's small spark recipe with its existing large blue electrical treatment, sized
  from the 230 px melee damage envelope rather than an unrelated decorative constant.
- Remove Headsman's catalog recipe, recipe-table entry, treatment/texture support, legacy hit-envelope
  override, and extension ignition eligibility while preserving its ordinary edge weapon stats and normal
  sword animation.
- Regenerate all derived files, add focused owner-note/client/server gates, retain live evidence under
  `docs/owner-notes-audit-v9-evidence/b10-vfx/`, then run `pnpm gen`, `pnpm gen:check`,
  `pnpm assets:check`, `pnpm typecheck`, full `pnpm test`, and a private-port server boot.

## Per-weapon progress

- Fulgurite Storm-Sphere (`x2-fulgurite-storm-sphere`): planned; existing blue fill asset located, current
  aura radius confirmed as 450 px.
- Tombstone Greatsword (`tombstone-greatsword`): planned; existing stone/smoke asset located.
- Thunderhead Voulge (`x2-thunderhead-voulge`): planned; existing blue electrical asset located, current
  melee range confirmed as 230 px.
- Sanctified Headsman (`x2-sanctified-headsman`): planned; all recipe/treatment/envelope/ignition seams
  identified.

## Implementation update 1 — generated reuse contracts

The source override catalog now declares three existing-art treatments and the generator emits their
typed metadata:

- Fulgurite: two overlapping, owner-centered layers of `fulgurite-blue-fill.png`; the outer layer's width
  is exactly the 900 px authoritative aura diameter and the inner layer reinforces center-to-rim coverage.
  Existing blue spark/bolt punctuation remains above the fill.
- Tombstone: `tombstone-stone-smoke.png` is the only quake hero/particle subject treatment. Its generated
  census is `stone + smoke`, with `bone` explicitly in `removedSubjects`; the old grave-call pack is bypassed
  for this treatment.
- Thunderhead Voulge: `thunderhead-voulge-blue-effect.png` replaces the small shock-spark burst. Its far
  painted tip is derived from the shared 230 px melee envelope, with explicit cyan tint and no synthesized
  fallback suite.

## Implementation update 2 — Sanctified Headsman removal

Headsman now has `suppressVfx: true` and no `effectRecipe`, emitter, or timing in catalog source. The
`sanctified-holy-slash` recipe id/table entry is removed. Headsman is absent from the shared extension ID
list and legacy hit-envelope overrides, absent from client treatment/texture loading, and its prototype
resolver/geometry/ignition module has been removed. Its damage, cooldown, range, display length, grip, edge
behavior, and normal weapon animation authoring are unchanged.

## Implementation update 3 — regression gates

Focused B10 and superseded-owner tests now pass: 10 files / 78 tests. The gates decode the reused PNGs and
prove Fulgurite has no alpha dead annulus through 90% of normalized radius, the two blue treatments have
blue-dominant pixels, Tombstone's generated census is exactly stone + smoke with bone removed, and
Thunderhead's forward art extent equals its shared 230 px melee reach. Client catalog/treatment tests prove
Headsman has no recipe, generated suite, extension geometry, texture treatment, or ignition hook. The
server collision gate hits a target at its ordinary physical-blade edge while leaving a target in the old
extension-only zone untouched.
