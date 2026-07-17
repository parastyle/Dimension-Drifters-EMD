# Pet fusion visual and rig proposal

## Verdict

The hypothesis is sound, with one important correction: the existing separated art is necessary but not sufficient. The 28 unordered two-pet pairings can ship with **zero pair-specific creature renders**, and both inheritance orientations of each pair can be assembled from the same sources, only if pet v1 adopts a shared socket frame, palette-role data, and fixed variant pivots before any final art is approved. The current plan records each pet's own pivots after slicing; arbitrary per-pet pivots would still produce 28 flavors of bad shoulder joint.

The readable inheritance law is:

> **The scaling-bonus parent supplies the body. The capstone parent supplies every non-body cutout.**

The body is the stable mass and face of the repeatable scaling effect. The complete appendage kit—wings, tail, shell, claws, sensory crown, and carried plates—is the silhouette of the inherited capstone. This is deterministic, works at every stage, never chooses anatomy randomly, and keeps every fusion at the existing two-to-four runtime part budget. An unordered pair has two possible visual orientations if the player may reverse which parent supplies scaling versus capstone; those are still assembly recipes, not new renders.

This is an art/rig capability assessment, not permission to grant all 28 mechanical recipes. A balance catalog may expose a fixed whitelist and one fixed inheritance orientation per approved pair; it should use the same grammar rather than commissioning a second art path. Building and validating the complete cross-assembly matrix now prevents a later whitelist expansion from becoming an asset retrofit.

## 1. The part-mix grammar

### Five semantic classes, nine concrete sockets

The roster reduces to five player-readable classes: **body**, **paired side limbs/wings**, **tail/trailing limb**, **antennae/crown**, and **accessory**. The rig needs slightly more precise socket names so a shell does not mount where a belly lens belongs.

| Semantic class | Manifest slot | Meaning |
|---|---|---|
| Body | `body` | The only root. It owns the face, body axis, overall scale, shadow, and every body-mounted socket. |
| Wings / paired limbs | `side.paired`, or `side.far` + `side.near` | A folded Hatchling card, or the split near/far wings and claws used from stage 2 onward. Claws use the same side sockets as wings; the class describes attachment topology, not taxonomy. |
| Tail / trailing limb | `rear` | A single flexible silhouette trailing from the rump. Pale Firefly's ventral ribbon-feeler card uses this motion class even though it is not anatomically a tail. |
| Antennae / crown | `crown` | Antenna crest, flame crest, astrolabe, compass rim, ticking halo, or another head/back sensory silhouette. |
| Accessory | `shell`, `dorsal`, `ventral`, `tailTip` | Weight-bearing shell and plate cards, belly lenses, panniers, ribbons, shutters, and children mounted to another donor part. `tailTip` is a child socket on the tail rather than on the body. |

Normalized at Apex, the eight native rigs are:

| Pet | `body` | Side limbs | `rear` | `crown` | Accessories | Non-body kit count |
|---|---|---|---|---|---|---:|
| Verdant Wing | bud thorax | near/far leaf wings | — | antenna crest | — | 3 |
| Hearth Newt | charcoal head-body | — | heavy curled tail | flame crest | belly lens at `ventral` | 3 |
| Lodestar Moth | dark thorax | near/far compass wings | — | astrolabe ring | — | 3 |
| Copper Snail | low bean body | — | — | compass rim | coin shell at `shell`; double pannier at `ventral` | 3 |
| Gilded Gecko | wedge body | — | curled tail | — | dorsal coin-ribbon; balance pan at the tail's `tailTip` | 3 |
| Brass Crab | clockwork shell-body | near/far gauge claws | — | ticking halo | — | 3 |
| Pale Firefly | lantern body | near/far wing cases | ribbon-feeler card | — | — | 3 |
| Slate Tortoise | mask-head body | — | — | — | shell cap at `shell`; cairn plate at `dorsal`; core shutter at `ventral` | 3 |

At Hatchling, `side.paired` replaces near/far where the source roster calls for one folded card or claw yoke. At stage 2 it resolves to `side.far` and `side.near`. Every other newly unlocked cutout retains the same slot and parent through Apex. A slot's semantic name is stable even when the paint evolves.

### Assembly law: body tells scaling, kit tells capstone

For a fusion recipe `F(scaleParent, capstoneParent, visualStage)`:

1. Resolve a single `visualStage` and sample both parents at that stage. Never mount an Apex kit on a Hatchling body. If progression permits parents at unequal stages, the visual stage is the highest stage unlocked by both parents.
2. Take only `body` from `scaleParent`. Its face mark, main material, branch body mark, and body spring/follow personality remain intact.
3. Take every non-body part present at that stage from `capstoneParent`, including its parent-child graph. This is the **capstone kit**. A Gilded balance pan therefore remains parented to the Gilded tail; it is never mounted directly to a foreign body.
4. Mount each kit root to the receiver body's socket of the same name. Child sockets inside the kit remain donor-authored.
5. Run palette harmonization, then fit the completed alpha bounds once to the 30/37/44 px stage ceiling. Do not separately squeeze a wing, tail, or shell to make it fit after assembly.

This makes the visual promise inspectable. A Hearth body with Verdant wings, for example, always means Hearth's scaling bonus plus Verdant's capstone. Reversing the inheritance produces a Verdant body with Hearth's tail/lens/crest. Randomly alternating individual parts between parents would destroy that read and is not allowed.

### `PET_SOCKET_FRAME_V1`: scale and anchor normalization

Pet v1 needs a named registration standard: **`PET_SOCKET_FRAME_V1`**. It applies the worm kit's pivot-pinning discipline to a compact body with several optional connectors.

- The body-local origin is its authored root centroid; the pet faces `+X` (screen-right). `L` is the manifest's rump-to-face body-axis length before trim. All socket positions and extents are stored in units of `L`, not in trimmed-texture pixels.
- Every body declares all body-mounted sockets, even when its native kit does not use them. Unused sockets are metadata only—no dots, holes, or generic mechanical collars appear in the art.
- Nominal socket centers are `side.far (-0.08,-0.14)`, `side.near (-0.05,+0.14)`, `side.paired (-0.065,0)`, `rear (-0.45,+0.05)`, `crown (+0.25,-0.20)`, `shell (-0.12,-0.05)`, `dorsal (-0.06,-0.20)`, and `ventral (+0.03,+0.20)`, expressed as `(x/L,y/L)`. A species may move a center by at most `0.035L` to keep it inside painted body stock; the exact receiver socket—not the nominal—is runtime truth.
- Each socket records local position, rest angle, mount scale, and compositing plane. Each part records its pivot in untrimmed source coordinates, its compatible slot, its source-body `L`, and its parent.
- A root kit part is uniformly scaled by `clamp(receiverL / donorL, 0.85, 1.15)` before its pivot is pinned to the receiver socket. A child part inherits its donor parent transform. No non-uniform scaling is permitted; fern lobes must not become rubber sheets.
- After stage 1 establishes a pet's socket and pivot, every later stage, branch, palette pass, and damage-free edit reuses the exact numeric anchor. Source-art drift tolerance is at most 4 raw pixels and 2 degrees, tighter than the base spec's current 12-pixel registration allowance.
- Every body/kit seam contains 10–12% hidden painted overlap beyond the pivot. The body art must cover the full allowed socket zone. As with the worm's fixed connectors, a material or branch edit may change paint but may not change connector geometry.
- Tooling rejects a part whose root collar does not overlap the receiver body mask after the maximum allowed socket shift. A contact-sheet test mounts every stage-3 kit on all eight bodies in both near/far depth orders; review it at 44 px and 22 px, not only at source resolution.

The final whole-creature fit may reduce an especially broad fusion to the stage envelope, but it preserves the body-to-kit ratio. This means a winged Slate fusion may be slightly smaller overall than native Slate, not a Slate body with comically tiny wings.

### Palette law: body structure, capstone chroma

Do not average the parents' RGB values. That creates mud and makes green/brown combinations look accidentally dirty. Fusions use the sharp **Body-Structure / Kit-Chroma law**:

1. Source art is tagged with six flat palette roles: `ink`, `structureDark`, `structureMid`, `paperLight`, `signature`, and `core`.
2. The scaling parent supplies `ink`, `structureDark`, `structureMid`, and `paperLight` for the **entire assembled creature**, including the capstone kit.
3. The capstone parent supplies `signature` and `core` only on its kit. Its characteristic green, ember, cobalt, copper, gold, cyan, teal, or pale-blue note therefore survives where the eye reads the inherited capstone.
4. A 10–12% attachment collar on each kit root is remapped to the body's `structureMid`, visually sewing the materials together. One narrow capstone-color stitch may cross that collar; it is not a glow.
5. The result may contain at most five visible colors plus the owner's tiny attribution tab. Saturated `signature + core` pixels across the completed creature remain at or below 8% of alpha area. Telegraph red, full parry white, gradients, additive bloom, and palette animation remain forbidden.

Because the pet art is flat cel color, tooling can perform this as an exact palette-role lookup while packing or through one indexed-palette shader. These are deterministic derived textures, not bespoke image-generation passes. If indexed rendering is not ready, build-time recolored atlas frames are acceptable cache output; source control still owns only donor parts and palette recipes, never hand-painted pair PNGs.

## 2. Where bespoke renders are still worth it

### The fusion ceremony

Spend bespoke art on the moment, not on 28 nearly redundant world sprites. Create one reusable paper-cutout **Seam Loom** ceremony set: a dark tabletop/dimensional aperture plate, two registration clamps, a short stitch ribbon, and a restrained seam-flash mask. The two parent portraits and the resulting fused creature are assembled from approved live parts.

The 1.8–2.2 second sequence should make the inheritance law legible:

1. Both parent portrait cards fold edge-on into the two clamps.
2. The scaling parent's body unfolds at center while its non-body parts remain in its clamp.
3. The capstone parent's kit detaches as actual cutouts, crosses on short paper arcs, and pins to the visible receiver sockets one part at a time—far part, body-level part, near part.
4. The palette resolves from raw donor colors to Body-Structure / Kit-Chroma along the stitch ribbon.
5. Both chosen aspect marks press into place; the completed rig gives one bounded spring settle and its normal chirp pair. No loot beam, combat-white flash, or healing ring is used.

This requires a small reusable ceremony asset set and choreography, not a fused illustration per pair. A large UI portrait can be captured from the assembled high-resolution masters after the reveal.

### Later bespoke Apex pair families

Only a few pairs have a concept strong enough to justify a true Apex blend pass after the modular system proves popular:

- **Verdant Wing × Pale Firefly** — fern-wing lantern pollinator; the support pairing has a naturally coherent botanical silhouette.
- **Hearth Newt × Slate Tortoise** — a walking cairn-hearth with a banked coal core; excellent material continuity between basalt, slate, moss, and ember.
- **Lodestar Moth × Brass Crab** — a clockwork orrery familiar whose wing eyes, gauge claws, and astrolabe can share one instrument language.
- **Copper Snail × Gilded Gecko** — a tiny trail merchant/pack-scale creature; the shell, pannier, curled tail, and balance pan already tell one story without coins or shop UI symbols.

These should remain cosmetic edits of an assembled recipe and preserve the body-versus-kit read, socket anchors, part count, envelope, and palette roles. If both inheritance orientations remain legal, a full bespoke skin costs **two Apex rig cards per pair**, not one; four pair families therefore mean up to eight creature renders plus any separately approved portraits. That cost is why these belong after launch telemetry, not in the base 28-pair promise.

## 3. Evolution branches as persistent aspects

The stage-2 choice should read as a small authored conviction, not a fourth species. Use two art grammars whose final systems names may change:

This document assigns no combat mechanic to either aspect. They are mechanically identical visual ids by default and should be freely selectable out of run; if a systems proposal later attaches mechanics, the preview, respec, and balance rules must be settled there without changing the part contract.

- **Outgrown aspect:** one silhouette-breaking paper spur, notch, curl, or tab on an already moving carrier part. It moves the species accent toward the extremity and may add at most 1 degree to that donor part's cosmetic spring ceiling.
- **Inlaid aspect:** one recessed plate, vein, bezel, or rune cut within the existing silhouette. It moves the species accent inward and does not alter motion.

Per species, keep the mark specific and non-iconic:

| Pet | Outgrown carrier/motif | Inlaid carrier/motif |
|---|---|---|
| Verdant Wing | one stronger fern spur on a wing/body bud edge | a pale dew-vein notch, never an eye or heal symbol |
| Hearth Newt | a forked card-stock wick at the tail/body edge | a thicker belly-coal bezel |
| Lodestar Moth | one asymmetric cathedral wing point | one extra compass meridian, not a reticle |
| Copper Snail | a sturdy pannier/shell edge tab | a recessed magnet notch, not a pickup arrow |
| Gilded Gecko | a longer counterweight curl | a flat scale-tick inlay, not currency |
| Brass Crab | one gauge-claw vane | one inner timing bezel, not a cooldown dial |
| Pale Firefly | a petal-tip wing tab | a dull-teal lantern band clasp, no medical cross |
| Slate Tortoise | one offset cairn ledge | one recessed rune wedge, no shield emblem |

### Art price and branch delta format

Price this as **8 pets × 2 branches = 16 image-generation renders**. Each `{pet, aspect}` render is one 1024×1024 `ASPECT_DELTA` source card containing exactly two isolated cutouts on green:

- `bodyPatch`, registered to the pet's `aspect.body` socket; and
- `kitPatch`, registered to the pet's declared primary kit carrier (near wing/claw, tail, shell/pannier, or cairn).

The build step flattens those patches into derived body/part variants, so an aspect does not add a fifth or sixth runtime Image. The same approved patches persist through Apex; stage 3 adds its normal crest/ring/pan/shutter while retaining the stage-2 decision. Portraits use the composed parts and do not require 16 more bespoke portrait renders unless UI polish later budgets them.

An unfused pet may display both of its matching patches. A fused pet displays the scaling parent's `bodyPatch` on the inherited body and the capstone parent's `kitPatch` on the inherited appendage kit. Thus both branch histories survive fusion without violating the inheritance silhouette. Patch pixels obey the same palette roles: the body patch resolves through the scaling palette, and the kit patch through capstone `signature/core` plus body structure colors.

## 4. The mixed-part `PetRig`

### Recipe and retained part model

Keep the planned purpose-built `PetRig`; do not subclass combat `SpriteRig`. Extend its descriptor input from one `petId + band` to a resolved visual recipe containing:

```text
visualStage
bodyDonorId, bodyAspectId
kitDonorId, kitAspectId
paletteLawId = body-structure-kit-chroma-v1
```

Other clients need either those public visual fields or a stable catalog recipe ID that deterministically expands to them. A fused recipe selects one body texture and the kit donor's one-to-three non-body textures from existing packed frames. Construction resolves the attachment graph once; update mutates fixed scalar state only. No per-frame manifest search, array creation, texture generation, or child reparenting is acceptable.

### Donor springs are feasible, with a manifest change

The butterfly wings must keep butterfly motion on any receiver body. That is technically feasible with the current animation foundation, but it is not already data-driven end to end:

- `SpriteRig`'s exact damped-oscillator helper already accepts frequency, damping, limits, impulses, and rebase state as call parameters. The solver is therefore capable of different tuning per retained part.
- The current generated `SpriteManifest` stores role, file, bounds, centroid, and offsets only. Character hands/feet choose shared constants in `SpriteRig`; spring parameters do **not** currently come from the manifest.
- `PetRig` should reuse the stable scalar-oscillator pattern, not the combat rig class, and add an angular `PetPartSpringDef` to each donor part: `preset`, `hz`, `damping`, `maxDeg`, `dragGain`, and optional `idlePhaseBias`. Convert `hz` to angular frequency once when the manifest loads.

At runtime the part carries its donor definition unchanged. Verdant/Lodestar/Pale wings remain `flutter 8.5 Hz / 0.35`; antennae and light rims remain `antenna 6.5 / 0.38`; Hearth/Gecko/Firefly trailing parts remain `tail 5.2 / 0.55`; shells, claws, lenses, pans, and plates remain `weighty 4.8 / 0.70`. Receiver body scale affects positional lever length, not frequency or damping. Aspect Outgrown may raise only that donor part's `maxDeg` by 1 degree; it never changes gameplay or the root follow spring.

Rebase every part spring on construction, stage/aspect swap, LOD wake, teleport, and recipe replacement. A palette swap or atlas-frame change adds no spring energy. Reduced motion pins parts to rest angles while preserving assembled anchors.

### Local composition and world depth

The pet root keeps the existing y-sort and remains at least one actor band behind its owner and below protected telegraphs. Mixed anatomy changes only the stable local stack:

| Local plane | Typical content |
|---:|---|
| `-40` | ground shadow |
| `-20` | `side.far`, rearward halo/ring portions |
| `-10` | `rear`, back shell/cairn layer |
| `0` | body |
| `+10` | shell surface, dorsal/ventral lens, body aspect patch after flattening |
| `+20` | `side.near`, foreground tail child/pan |
| `+30` | crown/front sensory part when its manifest declares foreground |

Each socket supplies a default plane and each donor part may apply only a bounded `-1/0/+1` plane bias. Sort once by `(plane, canonicalSlotOrder, donorPartIndex)`. During a signed-scale paper turn, swap only the paired `side.near`/`side.far` planes at the edge-on midpoint; never y-sort children independently every frame. The body covers the root of far parts, while near parts and surface accessories cover their own root collar. Parent-child accessories inherit their parent's plane unless explicitly promoted one plane.

The completed alpha bounds—not the body alone—drive stage scale and overlap fading. Shadow size comes from the receiver body footprint, preventing giant wing shadows, and the exact telegraph punch-out still applies to every child pixel.

## 5. Fusion-ready render pipeline

### Required deltas to the base pet prompt

Keep the base camera, paper style, chroma field, bay separation, no-VFX rule, and one-pet/one-stage isolation. Add this block to every v1 `RIG_SHEET` ticket:

```text
FUSION REGISTRATION — PET_SOCKET_FRAME_V1 — REQUIRED
- The body faces +X/screen-right and uses the supplied body root and rump-to-face axis L exactly.
- Design the body as continuous painted card stock beneath every supplied socket zone, including sockets this native pet does not use. Do not draw socket marks, holes, guides, or generic joints.
- The exact socket table for this ticket is: {BODY_SOCKET_TABLE_WITH_RAW_X_Y_ANGLE_SCALE_PLANE}.
- For every separated non-body part, the exact normalized slot, parent, source pivot, rest angle, and hidden collar are: {PART_ATTACHMENT_TABLE}.
- Paint 10–12% hidden root material beyond each pivot. The collar must be ordinary species material and wide enough to remain covered at the socket's full allowed shift.
- Preserve every existing socket and pivot within 4 raw pixels and 2 degrees of the approved earlier stage/branch reference. New stage parts may add a socket child but may not move old connectors.
- Keep all flat colors on the supplied palette-role swatches: ink, structureDark, structureMid, paperLight, signature, core. Do not introduce near-duplicate shades or gradients.
- A material, stage, or branch edit may change paint and outer silhouette only where explicitly allowed; it may not change connector geometry.
```

`{PART_LIST_WITH_PARENT_PIVOT_SPRING_AND_BAY}` in the existing template must become the machine-readable attachment table above, not prose such as “wing somewhere behind body.” The body still begins near `(512,510)` and the three non-body kit parts still occupy the three outer bays. The prompt shows no guides in output; the ticket provides numbers and the installer records the same numbers.

The base registration allowance must change from 12 raw pixels to 4 for sockets/pivots. Component slicing still occurs before resizing. After trim, tooling transforms each untrimmed pivot into trimmed-texture coordinates rather than guessing the pivot from the alpha centroid.

### Validation gates

For every approved stage/branch source:

1. Chroma-key, despill, connected-component slice, and trim as today.
2. Verify exact part count, palette-role membership, pivot containment, 10–12% collar depth, and no alpha in another bay.
3. Reassemble the native pet and compare it with the approved contact pose.
4. At stage 3, assemble an 8×8 body/kit matrix. The diagonal is native; the 56 off-diagonal cells cover both orientations of all 28 pairs. Reject floating seams, face occlusion, a kit outside the 44 px read, or any result that needs a hand-authored offset.
5. Apply all 64 body/kit palette recipes and enforce the five-color and 8% accent ceilings automatically.
6. Review at 44 px, remote-pet alpha, and 22 px thumbnail scale. A fusion passes only if the body species and capstone kit species are independently identifiable without UI text.

### Manifest and asset layout

Keep source ownership with the donor pet; do not copy PNGs into pair folders:

```text
sprites/pets/{petId}/s{1|2|3}/
  body.png
  {donor-part}.png
  parts.json

sprites/pets/{petId}/aspects/{outgrown|inlaid}/
  body-patch.png
  kit-patch.png
  delta.json

sprites/pets/_shared/
  pet-socket-frame-v1.json
  palette-roles-v1.json
  fusion-rules-v1.json
```

`parts.json` needs, at minimum:

```text
body: { axisLength, sockets[], paletteRoles }
part: {
  id, texture, donorPetId, stage, class, slot, parent,
  pivotSource, pivotTrimmed, restAngle, mountScale, plane,
  spring: { preset, hz, damping, maxDeg, dragGain },
  paletteRoles, alphaBounds
}
```

`delta.json` identifies the `body` and primary-kit carrier sockets, palette roles, legal stages (`2..3`), and flattening transforms. `fusion-rules-v1.json` owns the inheritance law and palette remap. A runtime or catalog-generated recipe references donor frame keys and these manifests; it does not need 56 checked-in recipe files. If build-time palette variants are required, place them in generated atlas/cache output keyed by a recipe hash, never in the source-art hierarchy.

World rigs and UI portraits both consume the same resolved recipe. A portrait renderer assembles full-resolution donor masters into the neutral hover pose, avoiding 28 or 56 new portrait generations. Only the reusable ceremony environment and explicitly approved later Apex families receive bespoke fusion art.

## Fusion-readiness requirements for pet v1

- [ ] Adopt `PET_SOCKET_FRAME_V1` before approving final Hatchling art; every body declares every body-mounted socket, including unused ones.
- [ ] Freeze one right-facing normalized body axis, exact socket table, compatible zones, and source-to-trim pivot transform in tooling.
- [ ] Tighten stage/variant connector registration from 12 raw pixels to 4 raw pixels and 2 degrees.
- [ ] Require 10–12% hidden painted collar overlap on every body/kit seam and validate it against receiver masks.
- [ ] Normalize all roster parts to `body`, side, rear, crown, shell/dorsal/ventral, and child `tailTip` slots with explicit parents.
- [ ] Preserve the hard inheritance law: scaling parent = body; capstone parent = complete non-body kit; no random per-part mixing.
- [ ] Resolve both donors at one shared visual stage and keep every assembled rig within the existing 2–4 retained-part budget.
- [ ] Add palette-role masks/swatches and ship the Body-Structure / Kit-Chroma remap with automated five-color and 8% accent checks.
- [ ] Put spring frequency, damping, limit, and drag gain on each donor part manifest; rebase springs on every discontinuity.
- [ ] Add stable local composition planes and near/far turn behavior; never independently y-sort mixed child parts per frame.
- [ ] Generate the 8×8 cross-assembly contact matrix at Apex and reject any pairing that needs a manual offset, crop, or non-uniform scale.
- [ ] Price stage-2 branching as 16 `ASPECT_DELTA` renders and flatten body/kit patches so branches add no runtime Images.
- [ ] Make fused portraits and the ceremony reveal from actual resolved parts; do not commission pair PNGs for the base 28.
- [ ] Fail the asset build on missing required sockets, pivots, palette roles, spring data, or native/cross-assembly validation.
