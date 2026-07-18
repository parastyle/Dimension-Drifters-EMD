# Weapon orientation panel diagnosis

Date: 2026-07-17

Scope: read-only diagnosis of the installed client art and rig. No source file or asset was changed. The measurement script is scratch-only at `.tmp-bin/measure-weapon-orientation.mjs`; its machine-readable output is `tools/artkit/out/orientation/weapon-axis-report.json`.

## Executive finding

The rig's functional weapon axis is local **+X/right**. This is proven by all of the independent geometry: `gripFrac` is an X-origin fraction, display scale divides by part width, the second two-handed grip is placed along `(cos(weaponAngle), sin(weaponAngle))`, orbit art is rotated onto its radial vector, and tip flashes are projected from the image origin toward the image's right edge.

The dominant reported rest bug is therefore in the rig, not in most art. For every non-gun definition the ordinary idle angle is intentionally:

```text
restA = -π/2 + 0.16 + lookY * 0.6
      = -80.83° + lookY * 34.38°
weaponAngle = restA + sin(time) * 2.29°
```

That makes correctly authored +X art stand almost upright. It affects **202 non-gun weapon definitions**. The 114 gun definitions take a separate absolute aim branch. Eighteen of the 202 non-guns are worn fists/claws/gloves, so the same upright idle policy also explains “the direction a fist would go” being wrong at rest.

The installed art is much more consistent than the complaint initially suggests. Across 317 manifest `part-1.png` weapon sprites, directed global PCA gives:

| PCA cluster | Count | Share | Interpretation after hand validation |
|---|---:|---:|---|
| right / within ±22.5° | 307 | 96.8% | Consistent with the rig's +X contract |
| up-right / 22.5°..67.5° | 7 | 2.2% | Six L-shaped firearms plus one tall-headed idol; global silhouette PCA is diagonal, but the visible muzzle/business direction is still right |
| up / 67.5°..112.5° | 1 | 0.3% | Hexbloom book silhouette, PCA axis confidence 0.033; not a reliable directional weapon axis |
| down / -112.5°..-67.5° | 2 | 0.6% | Emberleaf book and Riftglass lantern; both are non-directional/ambiguous for a “tip” correction |

There are **10 raw PCA outliers**, but **zero are safe automatic `artAngle` corrections after semantic/visual cross-checking**. The report preserves those raw measurements and marks guns, tomes, worn/irregular shapes, and low-confidence cases for manual treatment. Median absolute PCA deviation is 1.76° and the 90th percentile is 11.02°.

The “up while attacking forward” observation has two rig-side causes:

1. An attack angle is an absolute semantic replacement, not `rest + aim`; several styles intentionally spend windup/hold time in an overhead angle.
2. `chop`, `arc` overhead, orbit windup, combo holds, enemy offer/settle, and brace contain hard-coded up/guard angles. A screenshot during those phases can remain upward even though the damage aim is forward.

The seven open-tome images have horizontal PCA axes (-3.35°..+2.62°), but they inherit the same melee `weaponAngle`, the closed texture's left-side origin, and a width normalization that forces the open spread to be no wider than the closed art. The open major-axis span is only **0.882x..0.987x** the closed span (median **0.960x**), while visible alpha area changes from **0.562x** to **1.418x**. This is the concrete tome size/orientation pop.

## 1. The rig's actual contract

### Data consumed

`packages/client/src/sprites/manifest.ts:6-23` defines `SpritePart` and `SpriteManifest`. For weapon mounting, `SpriteRig.equipWeapon` uses:

- `manifest.parts[0]` for the lead weapon and `parts[1]` only for an eligible dual weapon (`SpriteRig.ts:2211-2213`);
- the part role/file to resolve the texture;
- `part.w` in `wScale = def.displayLength / part.w` (`SpriteRig.ts:2205`);
- `WeaponDef.displayLength` and `WeaponDef.gripFrac` from shared weapon data (`weapons.ts:56,77`), not from the generated sprite manifest.

The weapon mount does **not** consume the weapon part's `cx`, `cy`, `ox`, `oy`, or `h` to infer orientation or a two-dimensional grip. Those fields describe sliced geometry, but the held weapon is simply given origin `(gripFrac, 0.5)` and scaled by width. Consequently, diagonal, vertical, or off-center business geometry cannot correct itself through the manifest.

There are 317 manifest weapon sprites, 316 runtime weapon definitions excluding fists, and 315 distinct runtime sprite IDs. `gravediggers-spade` borrows `tombstone-greatsword`; `x2-galvanic-crackwhip` and `x2-psalmstone-beadwhip` are currently unused manifest art.

### Painted axis assumed by the rig

The assumed business axis is local +X/right:

- origin X is `gripFrac`, documented as “0 = left tip”; origin Y is fixed at 0.5;
- the business-side length used by close-blade math is `(1 - mountOrigin) * displayLength`;
- the rear two-handed grip is placed at `front + (cos weaponAngle, sin weaponAngle) * haft` (`SpriteRig.ts:6041-6042`);
- orbit writes `w.img.rotation = rot` so local +X lies on the radial vector (`SpriteRig.ts:6206-6241`);
- normal rendering writes the semantic `weaponAngle` directly to image rotation (`SpriteRig.ts:6314-6320`);
- source/tell anchors measure `(1 - originX) * image width` and project it along `image.rotation` (`SpriteRig.ts:1876-1901,2443-2450`).

For a right-facing character, with no per-art correction, the painted business direction is:

```text
screen direction = semantic weaponAngle + painted local Phaser angle
```

The report uses Cartesian screen angles (`0°=right`, `+90°=up`). A sprite measured at `+45°` has a Phaser-local vector of `-45°`; adding an `artAngle` of `+45°` to image rotation turns that paint clockwise onto semantic +X. The root's signed X scale mirrors the corrected result for left-facing characters.

### Rest, aim, and swing composition

The root chooses facing, then mirrors the whole container. World aim is converted into local mirrored space as:

```ts
aimLocal = atan2(sin(aimWorld), cos(aimWorld) * facing)
```

The angle paths then behave as follows.

| Path | Angle behavior |
|---|---|
| Gun (`SpriteRig.ts:5262-5267`) | Absolute `aimLocal`; this is the cleanest expression of the +X contract |
| Ordinary non-gun rest (`SpriteRig.ts:5274-5275`) | Absolute `-80.83° + lookY*34.38°`, plus ±2.29° idle sway |
| Enemy melee tell rest (`SpriteRig.ts:5159`) | Absolute -80.83° |
| Arc | Replaces rest with an aim-centered sweep; ordinary start/end are roughly `aimLocal - 0.55*swingArc` to `aimLocal + 0.45*swingArc`; overhead variants use an explicit raised angle |
| Chop (`SpriteRig.ts:5415-5488`) | Explicit raise at -138.70° and slam at +48.70° plus a small vertical-look term; not an additive aim correction |
| Thrust (`SpriteRig.ts:5746-5796`) | Sets `weaponAngle = aimLocal` while the hand/body lunges |
| Punch (`SpriteRig.ts:5657-5745`) | Fist angle follows `aimLocal` plus hook/haymaker travel while active; inactive/rear implements can return to upright `restA` |
| Pivot | Close-blade sampler returns absolute front/back angles around frozen aim; fallback rake also uses absolute aim/rest angles |
| Orbit/spin (`SpriteRig.ts:5407-5413,6190-6241`) | Later render pass replaces position, angle, length, and depth using a projected radial orbit; orbit begins behind the damage arc, so early windup is intentionally not forward |
| Brace (`SpriteRig.ts:5904-5911`) | Blends every prior result toward -11.46° |

Among the 202 non-gun definitions that reach the melee/rest branch, the resolved style counts are: 82 arc, 54 orbit, 37 chop, 14 punch, 10 thrust, 4 pivot, and 1 spin. These numbers explain why an upward windup/guard is common even with horizontal art. The style angle **replaces** `weaponAngle`; there is no current per-sprite `artAngle` at any stage.

Late enemy presentation adds more absolute/upward targets: duel offer mixes toward `aimLocal + 90°` and landing settle mixes toward -80.83° (`SpriteRig.ts:4529,4546`). Those must be part of a forward-rest policy audit.

### Worn mounts

`isWornWeapon` is shared (`packages/shared/src/melee.ts:1357-1363`). It returns true for `gauntlet`/`fist` families or names matching claws, talons, mitts, gloves, vambraces, gauntlets, knuckles, cestus, or fists.

Worn art is mounted at origin X 0.4 instead of `gripFrac` (`SpriteRig.ts:2206`) and is layered over the hand. Dual worn pieces are each layered over their hand; a single worn piece is also above its hand. There are 24 worn definitions: 18 non-guns and 6 guns. Non-gun worn gear still receives the nearly vertical rest angle; gun-worn gear is intercepted by the gun aim branch.

## 2. Measurement method and raw report

The scratch measurement ran over every installed `packages/client/public/sprites/<weapon>/part-1.png` whose manifest kind is `weapon`, plus all seven mapped `open.png` files. It used the art actually rendered by the client, not uncropped generation masters.

For each PNG:

1. Sharp decoded RGBA to raw pixels.
2. Pixels with alpha below 32 were discarded; retained pixels were weighted by alpha/255.
3. An alpha-weighted covariance matrix produced principal eigenvalues and the long-axis eigenvector.
4. PCA is unsigned. Both terminal 20.8% regions were scored for taper and alpha mass. A lower score is visually sparser/pointier.
5. Hand validation exposed the classic failure: a narrow sword hilt or gun grip can be sparser than its actual business end. Therefore, when runtime mount geometry clearly locates the origin near one PCA end, the end farther from the exact runtime origin wins. Pointiness is a supporting/tie-breaking vote, not an authority. Unused art with no runtime mount remains canonical-right and low-confidence.
6. `measuredAngleDeg` is the resulting directed **global PCA** angle. `tipCentroid.rayAngleDeg` separately records the runtime-origin-to-outer-shell ray; it is diagnostic only because an L-shaped gun barrel can be parallel-offset from its pivot.
7. Axis confidence is normalized eigenvalue separation. Direction confidence is mount asymmetry adjusted for pointiness agreement/conflict. Overall confidence is their geometric mean: high ≥0.65, medium ≥0.35, low otherwise.

The report clusters at 45° centers using ±22.5° boundaries. It intentionally preserves raw PCA even when semantic validation says not to use it as a correction. `correctionDisposition` is the guardrail for the fixer.

### Ten-sprite hand cross-check

The sample spans a thin blade, broad blade, staff, long gun, handgun, diagonal-PCA handgun, vertical prop, two books, and worn gear. `w×h`, `gripFrac`, and effective runtime origin were read from manifest/weapon geometry, then the installed images were visually inspected.

| Sprite | Manifest geometry / origin | PCA | Validation result |
|---|---|---:|---|
| `driftblade` | 640×44; grip/origin 0.05 | -0.42°, high | Thin blade visibly points right; heuristic agrees |
| `tombstone-greatsword` | 256×124; 0.10 | -0.38°, high | Broad tombstone blade points right. Pointiness alone voted for the sparse hilt; mount geometry correctly reverses that vote |
| `x-staff-arcane-lance` | 256×38; 0.12 | +0.03°, high | Spearhead visibly right. Pointiness alone again preferred the narrow butt; mount geometry fixes direction |
| `x-gun-coffin-shotgun` | 256×103; 0.14 | +4.41°, high | Twin muzzles visibly right; PCA is usable |
| `x-gun-revolver-cannon` | 256×136; 0.16 | +15.29°, medium | Barrel is visually horizontal; PCA is pulled upward by the L-shaped grip. Do not auto-rotate from global PCA |
| `x2-ashfall-peacemaker` | 256×129; 0.16 | +22.97°, high | Same L-shape limitation: raw silhouette enters the up-right bin, but muzzle/business direction is right |
| `x2-riftglass-prism-lantern` | 126×256; 0.12 | -89.91°, low direction | A vertical, symmetric prop with no unique forward business end; requires manual mount/art policy, not PCA rotation |
| `x2-hexbloom-scattergrimoire` | 229×256; 0.12 | +70.27°, low | Nearly square book/fanned-page silhouette; axis confidence only 0.033 and tip ray is approximately right. PCA is not actionable |
| `x2-emberleaf-chapbook` | 251×256; 0.15 | -89.34°, low | Square closed book; axis confidence 0.020. No reliable directed long axis |
| `x2-blightgrip-spore-mitt` | 256×168; authored grip 0.14, worn origin 0.40 | +2.42°, low | Knuckles visibly face right and the effective 0.40 worn origin is essential. Broad silhouette keeps correction confidence low |

The cross-check validates PCA for slender shaft/blade art, validates the mount prior over a naive sparse-end heuristic, and rejects blind PCA-to-`artAngle` conversion for L-shaped guns and non-directional props.

## 3. Tome orientation and size

### Current open-state mount

The seven open companions are looked up through `tome-open-art.ts` and initialized by `setupTomeVisual` (`SpriteRig.ts:1915-1962`). When the loose open texture becomes ready:

```ts
openBaseScale = displayLength / openTexture.realWidth
```

(`SpriteRig.ts:2074`.) `setTexture(openTextureKey)` changes only the texture (`SpriteRig.ts:2087`): the image retains the closed mount origin `(gripFrac, 0.5)` and the same semantic `weaponAngle`. It does not receive an open-state angle, origin, or width multiplier.

`syncTomeVisual` then assumes the painted spine is at texture X=0.5 and computes it as `(0.5 - originX) * displayWidth` from the hand (`SpriteRig.ts:2110-2124`). With grip fractions 0.09..0.15, the open spine is displaced roughly 35%..41% of the entire spread width to the right of the held hand. The images visibly place the spine near the middle/bottom, so a left-edge origin at Y=0.5 is not a coherent open-book grip.

All seven open PCA axes are horizontal: -3.35° to +2.62°. They look vertical at rest because the non-gun rest angle rotates horizontal +X art to -80.83°, not because the open paint is authored vertically.

### Effective on-screen size

`gen-tome-open.mjs:54-61` trims each open render and caps it inside 256×256. Every installed open texture is width 256 (heights 156..205). Five closed textures are also width 256; Emberleaf is 251 and Hexbloom is 229. The 256px source cap is **not by itself a display-size bug**, because the rig divides by that same width. It does, however, enforce this behavior:

```text
open on-screen canvas width = openWidth * (displayLength / openWidth) = displayLength
```

Thus an open two-page spread is forced to exactly the same nominal width as the closed art. The measured major-axis span confirms that every open state is actually slightly shorter, not wider.

| Tome | displayLength | Closed on-screen canvas | Open on-screen canvas | Open/closed height | Open/closed PCA span | Open/closed alpha area |
|---|---:|---:|---:|---:|---:|---:|
| Codex of Forked Tongues | 92 | 92×69.36 | 92×71.16 | 1.026 | 0.960 | 0.700 |
| Emberleaf Chapbook | 55 | 55×56.10 | 55×44.04 | 0.785 | 0.944 | 0.562 |
| Hexbloom Scattergrimoire | 96 | 96×107.32 | 96×68.63 | 0.639 | 0.882 | 0.571 |
| Maledict Tome of Salt-Lines | 138 | 138×95.41 | 138×92.72 | 0.972 | 0.963 | 0.733 |
| Null Grimoire of the Hollow Page | 94 | 94×64.99 | 94×61.32 | 0.944 | 0.987 | 0.794 |
| Pyroglyph Spellbook | 90 | 90×75.59 | 90×68.91 | 0.912 | 0.979 | 0.662 |
| Verdigris Grand Grimoire | 240 | 240×96.56 | 240×146.25 | 1.515 | 0.945 | 1.418 |

Across the seven, median open/closed height is 0.944, median major-axis span is 0.960, and median alpha-area ratio is 0.700. Six opens lose 20.6%..43.8% visible alpha area; Verdigris grows by 41.8%. That discontinuity is the visible state-change size pop.

There is also a data outlier independent of texture resolution. The seven `displayLength` values are 55, 90, 92, 94, 96, 138, and 240; median is 94. Verdigris is **2.55x the median** and Maledict is 1.47x. Since width always resolves to `displayLength`, Verdigris really is drawn 240px wide in both states before any orbit foreshortening.

## 4. Fix design

This needs two separate fixes. An art correction alone cannot undo the hard-coded upright rest policy.

### A. Make semantic rest point forward

For forward-facing idle, use local semantic angle 0 (or a separately approved small guard), not `-π/2 + 0.16`. The ordinary hook is `SpriteRig.ts:5274`; the enemy tell rest is `SpriteRig.ts:5159`. Also audit the late enemy offer/settle targets at `SpriteRig.ts:4529,4546` so they cannot reintroduce a permanent vertical hold after the main weapon pass.

Keep attack choreography intentional: thrust/punch contact can remain aim-locked and arc/chop/orbit can still sweep through overhead windup. If the product requirement is stronger—“point forward throughout the whole attack”—that is a swing-path redesign, especially for 37 chop and 54 orbit definitions, not an art-angle patch. At minimum, test active/contact frames separately from anticipation and cadence-hold frames.

### B. Add generated, client-only art geometry

Recommended architecture:

```ts
// packages/client/src/sprites/weapon-art-geometry.generated.ts
export const WEAPON_ART_GEOMETRY = {
  "some-directional-sprite": {
    closed: { artAngle: 0.123 }, // radians added to semantic Phaser rotation
    // Optional manual fields only where measurement proves they are needed:
    originX: 0.12,
    originY: 0.5,
    open: { artAngle: 0, originX: 0.5, originY: 0.85, displayLengthMul: 1.7 },
  },
} as const;
```

Productionize the scratch analyzer as a tools script that reads the raw JSON, accepts a small reviewed override file, and emits the generated TS. Auto-emit `artAngle` only for high/medium-confidence, semantically directional shaft/blade families. Guns require a barrel-specific measurement/manual value; tomes, worn gear, whips/flails, orbs/idols, and low-confidence near-square art require explicit review. The current 10 >22.5° PCA outliers yield zero safe automatic corrections under those rules.

Why a separate generated table:

- `artAngle` is client presentation data, not server weapon balance/state.
- `manifest.ts` is regenerated by `harvest-install.mjs`; hand augmentation will be overwritten unless the slicing schema and generator are widened.
- Open tome art is not a `SpriteManifest.parts` entry, so a part-only manifest field cannot express closed/open differences cleanly.
- A generated table can key the actual `sprite` override identity rather than duplicating values on multiple `WeaponDef`s.

Manifest augmentation is viable only if the artkit owns the new schema end to end and open-state geometry is added as a first-class manifest state. Adding `artAngle` to shared `WeaponDef` is the least attractive option because it mixes client-only generated art metadata into authoritative shared weapon data.

### Exact rig hook points

1. **Resolve once at equip:** in `equipWeapon` around `SpriteRig.ts:2198-2213`, look up geometry by `spriteId` and retain closed `artAngle`/origin on each weapon record. Do not recompute in `animate`.
2. **Keep semantic math uncorrected:** hand positions, combo paths, orbit projection, damage aim, and `weaponAngle` should continue to mean functional +X. Do not add `artAngle` inside every swing branch.
3. **Apply once, late:** after the normal/signature/orbit writer, late enemy pose, jump offsets, and spawn rotation, add the state-selected `artAngle` to each image immediately before `syncTomeVisual`/`syncObservedSourceFlash` (`SpriteRig.ts:6383-6385`). Every frame already rewrites semantic rotation, so this late addition will not accumulate.
4. **Correct tip consumers:** `syncObservedSourceFlash` and `getMeleeTellAnchor` currently project the right edge along `image.rotation` (`SpriteRig.ts:1891-1893,2448-2450`). After a late art correction, use `semanticRotation = image.rotation - activeArtAngle` for functional tip/tell direction, or store the semantic rotation explicitly. Otherwise VFX will be rotated by the correction even though the painted business end is not.
5. **Treat tome state separately:** retain closed origin/scale; on open, apply reviewed `open.artAngle`, open origin (the painted spine, not inherited `gripFrac`), and `displayLengthMul`. Restore closed origin on close. With an open origin at the spine, `syncTomeVisual`'s spine offset should become zero or use the generated spine coordinate directly.
6. **Measure dual parts before applying broadly:** this requested audit measured `part-1` only. The rig can render `parts[1]` for dual weapons, and 27 weapon manifests contain multiple parts. Extend the production script to every actually mounted dual part before copying the lead correction to the rear image.

### When to rerender art

Rerender or manually normalize art when no single rotation can make the business geometry match +X:

- near-square/symmetric books, lanterns, orbs, idols, and other non-directional props;
- L-shaped firearms where global PCA follows grip-to-body mass rather than the barrel tangent;
- chain/whip/flail silhouettes with multiple competing axes;
- sprites whose painted grip is not at `(originX, 0.5)`, because an angle alone cannot repair the pivot;
- any closed/open pair whose physical spine, scale, or projection changes cannot be represented by state-specific origin/scale.

For normalized rerenders, require the business end toward image-right, grip marker on a documented horizontal axis, tight transparent crop, and closed/open tome states authored to a shared physical scale. That should be the exception: 307/317 installed part-1 PCA axes are already within ±22.5° of +X.

## Handoff summary

- Rig assumed painted axis: **local +X/right**.
- Main rest defect: **202 non-gun definitions** are deliberately assigned about **-80.83°** at neutral, with up/down look and sway; this includes 18 non-gun worn weapons.
- Raw part-1 PCA: **307 right, 7 up-right, 1 up, 2 down**. The 10 outliers are semantic/manual cases, not safe bulk rotations.
- Tome open art: all seven open PCA axes are horizontal, but the state inherits the wrong melee rest, inherited left origin, and fixed-width normalization.
- Tome size: open major-axis span median **0.960x** closed and alpha area median **0.700x**; Verdigris is the opposite outlier at **1.418x** area and a **240px displayLength (2.55x median)**.
- Fix: change semantic rest separately; generate client-only per-sprite/per-state art geometry; apply `artAngle` once in the final render seam; compensate semantic tip consumers; give tomes state-specific origin and scale; rerender only irrecoverable shapes.
