# Sol Report — B35 Gun Presentation Corrections

Branch: `sol/b35-gun-corrections`

## Initial stray-hand root-cause hypothesis

The shared one-handed gun presentation path is likely leaving the support-hand limb visible after B27's composed-dual removal. The most probable mechanism is that the weapon pose resolver falls back to an idle/support-hand target whenever a weapon does not explicitly consume both hands, so the off hand inherits a stale or generic rear-side pose instead of returning to the normal body/idle pose. I will confirm this in the shared pose/render pipeline and fix the class rather than hiding a hand per weapon.

## Per-order plan

1. `x2-riftglass-prism-lantern`: set weapon render scale to 50% of current and beam visual scale/width to 120% of current through metadata/config only.
2. Stray-hand class: trace hand target selection through composed/one-handed/two-handed pose resolution; remove stale off-hand fallback; verify cinderpalm, gatling, and a one-handed weapon sweep.
3. `x2-voltvein-conductors`: add deterministic shot-by-shot firing-hand alternation and matching outstretched-hand pose.
4. `x2-voidgrasp-null-gauntlet`: derive/set base beam width to match the rendered cannon mouth.
5. `x2-prismhex-diffraction-gauntlet`: correct the presentation mirror axis without editing source PNGs.
6. `x2-iron-vow-bearded-axe`: increase render size by 35%.
7. `x2-permafrost-bardiche`: define a support-hand grip at the blue gem near the weapon midpoint.
8. Laser law: remove beam aim smoothing/interpolation so every laser beam uses the weapon's current aim transform each frame.
9. `x2-cinderbore-longrifle`: route attacks through a visible physical bullet projectile.
10. `x2-voltcaster-machine-pistol`: keep laser-beam visuals but use discrete semi-automatic shots and magazine-style timing.
11. `x2-coyote-stinger`: attach projectile spawn to the configured barrel muzzle socket.
12. `x2-ghostwind-spectre-rail`: add shipped-family purple chain-lightning hit presentation, without radial/ambient chains.
13. `x2-quicksilver-fanner`: implement one-cost, one-press six-shot sequential fanning rather than a cone volley.
14. `x2-fool-s-gold-revolver`: move the primary hand grip to the handle.
15. `x2-mauler-slug-thrower`: upgrade muzzle and impact effects using existing shipped effect families.
16. `x2-hexbore-voidmaw`: move the primary hand grip to the handle and reduce render size by 13%.
17. `x2-tesla-faradayer`: make projectile visuals purple and very large while preserving damage/DPS.
18. Gun stance: raise the shared gun-hold baseline to shoulder level and apply a small aim-facing-aware head nod, checking both facings for head clipping.

## Progress log

- Initialized report before gameplay changes; implementation and evidence pending.
- Confirmed stray-hand root cause (class, not per-weapon art): `classifyHandRole` treated every worn fist-family weapon as a paired-hand weapon, even a true 1H item such as Cinderpalm, so its unconstrained off hand remained on a stale manifest socket. Separately, ranged weapons tagged `grip: "2H"` could synthesize a physical support grip while `twoHandedPoseFor` still declined the 2H pose unless the redundant `twoHanded` flag was also set; Gatling therefore classified the support hand as constrained without ever placing it. The shared fix will make true 1H worn weapons release the off hand to the ordinary idle pose and make ranged 2H grip metadata authoritative for support-hand posing.

## Implementation results by order

1. Riftglass: changed presentation length `92 -> 46`, retained the `92` collision envelope, and changed beam width `48 -> 57.6`.
2. Stray-hand class: fixed the two shared classification defects named above. Cinderpalm now releases its true 1H free hand; Gatling now enters the ranged 2H support pose. Both facings plus Revolver Cannon and Nailgun 1H sweeps are clean in the live gate.
3. Voltvein: retained the authored dual/cycle muzzle set and wired accepted shot source parts through the rig; live recoil-hand captures are `0, 1` in both facings.
4. Voidgrasp: set base beam width to `19`, matching the rendered cannon-mouth aperture contract.
5. Prismhex: removed the erroneous per-sprite `mirror-x`; the actor root now supplies the sole horizontal facing mirror, with no vertical inversion.
6. Iron Vow: changed presentation length `128 -> 172.8` while preserving collision metadata.
7. Permafrost Bardiche: moved the support grip to normalized `(0.54, 0.52)`, on the center blue gem.
8. Laser law: authoritative `stepBeamAngle` and client `BeamRenderer` now use the current target angle directly. Legacy sweep datums remain valuation-only so this presentation law does not rebalance beam power.
9. Cinderbore: changed projectile art to the shipped `barrett-50cal-round` physical bullet family.
10. Voltcaster: converted the channel beam to semi-auto `bulletKind: "laser"` pulses at unchanged nominal `6 / 0.08 = 75` DPS, with a 24-round magazine.
11. Coyote: appended wire muzzle-part attribution and routes each client spawn/flash/recoil through the exact accepted barrel part.
12. Ghostwind: added three-hop purple chain lightning. The live gate caught and fixed a second receipt-color seam that had ignored authored chain hue; authoritative hit hops now use `0xb07bd6`.
13. Quicksilver Fanner: converted the six-pellet cone to one accepted press/resource spend followed by six `0.05s` sequential shots, wire ordinals `0..5`.
14. Fool's Gold: moved the primary grip to normalized `(0.22, 0.66)` on the handle, superseding B30.
15. Mauler: assigned the shipped `artillery` orange muzzle family and `fire-splat` impact pack.
16. Hexbore: changed presentation length `112 -> 97.44` and moved the primary grip to normalized `(0.22, 0.62)` on the handle.
17. Tesla Faradayer: retained purple `0xb14bff` and changed projectile visual scale `1 -> 3.5`.
18. Gun stance: raised shared pistol/rifle/heavy/fist anchors to the shoulder lane and applied the facing-aware head nod continuously while a gun is held; both facings remain clear of the head.

## Live gate

- Character: `proto-cowboy-hidden-face`.
- Private Vite/game pairs: `62714/62712` and `50399/59382`; never `5180/2567`.
- Evidence: `docs/owner-notes-audit-v11-evidence/b35-gun-corrections/`.
- Captures: every order in both facings, four-weapon stray-hand class sweep, alternating gloves, active laser fast swings, exact Coyote barrel parts, purple Ghostwind hit hops, six Fanner ordinals, and shoulder/head-nod stance.

## Verification

- `pnpm gen`: passed.
- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 189 files / 2,337 tests.
- `pnpm assets:check`: passed, 479 sprite entries / 1,011 parts, 635 atlas frames, 320 cards, 6 POIs, 9 decals, 24 projectile URLs, 96 particle URLs, and 8 weapon-VFX URLs.
- Private live gate: passed on `proto-cowboy-hidden-face`; both facings and all dedicated captures are indexed by `live-gate.json`.

Verdict: 18 orders done; stray-hand root cause named (worn-pair overclassification plus ranged-2H pose omission); laser law enforced; stance shipped; evidence path `docs/owner-notes-audit-v11-evidence/b35-gun-corrections/`; files touched: weapon data/generation, shared combat/schema/tiering, server projectile authority, client rig/render/VFX, migrated tests, and audit documentation.
