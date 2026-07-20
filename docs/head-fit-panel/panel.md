# Head-fit panel — rider sockets and full-head overlays

Date: 2026-07-20  
Branch: `feat/v0.118-metagame`  
Owner order: “Glasses and 'facial hair' don't line up with the head, also 'cowls' are literally an entire head so its like putting a head on top of a head and really weird.. Get a panel of Sols on lining up the armory items better onto the head.”

## Panel verdict

The owner report is confirmed on both counts.

1. The recent `HEAD_MOUNT_SCALE = 0.85` change is not, by itself, the remaining rider bug. Arena and wardrobe both scale the final baked head card, so the base/replacement head, glasses, and facial hair all inherit the same final scale. The remaining bug is one stage earlier: `PhaserGearTextureBakeBackend` stamps every 1024×1024 head layer at the same absolute canvas origin. Rider metadata still describes the old canonical face at `face.eyes = (552.96,363.52)` and `face.mouth = (568.32,409.6)`, while the newly rendered replacement heads put their semantic face features elsewhere. No receiver delta is applied during the bake.
2. Face receivers must be content data for the winning head, not one global promise that every creative replacement happens to honor. The shared bake recipe must translate a rider from its authoring pivot to the winning head's calibrated eye or mouth receiver before cropping the fixed head frame. Because arena and wardrobe acquire the same recipe from the same cache, this one correction covers both surfaces.
3. Five current `hat` images are complete heads: Ash-Walker's Cowl, Crusader's Cowl, Thornwatch Plume, Zero-Latency Cap, and Magnus Pressure Hat. Their catalog rows must move to `head`; stale accounts that equipped one through `equippedGear.hat` must migrate that exact ID to `equippedGear.head`; and the sanitizer must never leave any of those IDs in `hat`.
4. The other seven launch hats are genuine overlays and remain in `hat`. All twelve glasses images remain isolated eye riders, and all twelve `facialHair` images remain isolated lower-face riders—even when the fiction calls the item tusks, cord, stubble, or a scarf rather than literal hair. Their generated alpha bounds are constrained to the face envelopes, so none is a whole-head image.
5. The render fleet is already running. This unit will not start or interrupt art rendering. The five reclassified heads need post-fleet replacement-head renders; the code can safely enforce their slot truth now and use the bare-head fallback until conforming art exists.

## Perspective 1 — the Rig surgeon

### Exact transform chain

The source and display transforms are:

1. All authored parts live on the untrimmed `1024×1024` socket canvas. The body root is `R = (512,512)` and one body-height unit is `L = 512` source pixels.
2. The fixed head bake frame is `F = [290,40,508,552]`. The head pivot is `P = (512,300)`, therefore the saved `508×552` RenderTexture uses origin `(222/508,260/552) = (0.4370078740,0.4710144928)`.
3. The head socket is `(512,317.44)`, or `(0,-0.38L)` from the body root. At the runtime target body height of `76`, the base source-to-display scale is `b = 76/512 = 0.1484375`; the head pivot therefore rests `194.56b = 28.88` display pixels above the body pivot.
4. The head card then receives `HEAD_MOUNT_SCALE = 0.85`, so source pixels inside the head card use `h = b × 0.85 = 0.126171875` display pixels per source pixel.
5. Today the baker stamps the winning head and both riders at `(-F.left,-F.top)` with no per-layer translation. A rider source point `A` therefore lands at `(A.x-F.left,A.y-F.top)` in the bake and at `(A-P)h` relative to the final head pivot.
6. The rig's root owns facing. For semantic-right facing `f = +1`; for mirrored semantic-left `f = -1`. With no rotation, a calibrated source point `Q` must land at `world = headPivot + (f(Q.x-P.x)h,(Q.y-P.y)h)`. Rotation and the floating-head spring are applied to this already-correct local vector and do not change its length.

The repair is to add a layer translation `D = Q - A` when stamping a glasses or facial-hair layer. Cropping remains fixed. The recipe/cache key must include `D`, otherwise an old misaligned RenderTexture can survive a calibration change.

### Numeric trace — Ash-Walker + Emberglass Lenses + Mercy Muttonchops

The trace uses the current `ash-walker-head.png`, current rider files, target body height `76`, and `HEAD_MOUNT_SCALE = 0.85`.

Ash-Walker's visible eye highlight was measured from the installed pixels at `Qeyes = (680.05,237.83)`. The lower-face/jaw receiver is calibrated at `Qmouth = (681,342)`. Emberglass was authored around `Aeyes = (553,364)`; Mercy Muttonchops was authored around `Amouth = (568,410)`.

| Rider | Current stamped point in 508×552 bake | Expected point in bake | Current semantic-right offset from head pivot | Expected semantic-right offset | Display miss | Semantic-left miss |
|---|---:|---:|---:|---:|---:|---:|
| Emberglass | `(263,324)` | `(390.05,197.83)` | `(5.17,8.08)` | `(21.20,-7.84)` | `(+16.03,-15.92)` px | `(-16.03,-15.92)` px |
| Mercy Muttonchops | `(278,370)` | `(391,302)` | `(7.07,13.88)` | `(21.32,5.30)` | `(+14.26,-8.58)` px | `(-14.26,-8.58)` px |

Including the rest head socket, the current right-facing Emberglass anchor is about `(5.17,-20.80)` relative to the body pivot, but the eye is at `(21.20,-36.72)`. Mirroring correctly negates X; it cannot repair a bad source-space receiver. This is why a test that only proves “riders follow the sprung/scaled head” passed while the owner still saw a visibly wrong face fit.

### Facing invariant

The shared bake is authored once in semantic-right space. The root mirror must be the only facing operation. Tests therefore need to assert both:

- right: `x = +(Q.x-P.x)h`, `y = (Q.y-P.y)h`;
- left: `x = -(Q.x-P.x)h`, `y = (Q.y-P.y)h`.

The absolute X magnitudes must match within tolerance, Y must be identical, and no second rider-specific mirror or pre-flip is permitted.

## Perspective 2 — the Content taxonomist

The audited hat contact sheet is `tools/artkit/out/gear/hat-contact-sheet.png`. “Overlay” means the file contains only a topper/face-band that can truthfully sit over an already complete head. If the file already supplies the cranium, face void, helmet shell, hood, or lower head silhouette, it is a head replacement regardless of its display name.

| Catalog ID | Display name | Art verdict | Disposition |
|---|---|---|---|
| `ash-walker-hat` | Ash-Walker's Cowl | Complete wrapped head and face opening | Move `hat → head`; migrate stale equipped hat |
| `ashen-crusader-hat` | Crusader's Cowl | Complete hood, face void, coif, and lower silhouette | Move `hat → head`; migrate stale equipped hat |
| `molten-core-hat` | Cinder Crown | Crown/topper only | Keep `hat` overlay |
| `coldsnap-hat` | Rimebrim Stetson | Brimmed hat only | Keep `hat` overlay |
| `graveside-hat` | Sexton's Hat | Brimmed hat only | Keep `hat` overlay |
| `nine-veils-hat` | Nine-Veil Circlet | Circlet/upper-face veil band only; no cranium or jaw | Keep `hat` overlay |
| `demon-mask-hat` | Oni Crown | Horned crown band only; the demon mask remains the separate head | Keep `hat` overlay |
| `thornwatch-hat` | Thornwatch Plume | Complete helmet shell, face void, jaw edge, and plume | Move `hat → head`; migrate stale equipped hat |
| `neon-mirage-hat` | Zero-Latency Cap | Complete closed cyber helmet and lower wrap | Move `hat → head`; migrate stale equipped hat |
| `house-edge-hat` | Quickfinger's Boater | Boater/topper only | Keep `hat` overlay |
| `unbending-hat` | Keepwall Crest | Crest/plume mount only; no helmet shell | Keep `hat` overlay |
| `pressurized-hat` | Magnus Pressure Hat | Complete pressure helmet, viewport, and lower band | Move `hat → head`; migrate stale equipped hat |

After migration, the invariant is categorical rather than name-based: every ID legal in `hat` is a genuine `overlay-hat`; every complete cowl/hood/helmet ID is legal only in `head`. A stale record cannot produce a full-head hat segment, and prestige/tower composition cannot select one because tower legality is derived from the catalog's canonical `hat` slot.

## Perspective 3 — the Pipeline pragmatist

### Fixable in code/data now

- Add winning-head `face.eyes` and `face.mouth` calibrations to checked-in catalog/content data.
- Carry rider authoring pivots and computed source-pixel translations in the shared bake recipe.
- Stamp translated riders in the one Phaser texture backend used by arena and wardrobe; include the translation in recipe identity.
- Change the five complete-head catalog rows from `hat` to `head`.
- Add the explicit old-hat-to-head migration list beside `LEGACY_PANTS_TO_TORSO`; preserve ownership IDs and move an equipped stale cowl into `head` during sanitization.
- Make `sanitizeEquippedGear` reject every reclassified ID from `hat`, prefer an equipped legacy cowl for `head`, and retain only genuine overlays in `hat`.
- Preserve each migrated cowl's signature effect by letting a head-slot quirk win the existing singular quirk seam; a genuine overlay-hat quirk remains the fallback when the head has none.
- Update the art generator's role projection so future runs emit the five IDs as `replace-head`, never `overlay-hat`.
- Add append-only placement and no-head-on-head regression tests.

### Requires art after the running fleet drains

The following files were authored and validated as stack-band hats, not fixed-frame replacement heads. They must be rerendered into `sprites/gear/heads/` under the `replace-head` gates after the current pairs fleet drains:

1. `ash-walker-hat` — current alpha starts at `y=30`, already outside the widened head frame's `y=40` top; rerender required.
2. `ashen-crusader-hat` — current alpha starts at `y=30` and includes a torso-like tabard tail; rerender required.
3. `thornwatch-hat` — complete helmet must be reframed around pivot `(512,300)` and pass replacement core/face socket coverage.
4. `neon-mirage-hat` — complete helmet must be reframed and pass replacement core/face socket coverage.
5. `pressurized-hat` — complete helmet must be reframed and pass replacement core/face socket coverage.

No rider rerender is required for the fit correction: the existing accessory-only pixels are usable once translated to the winning head's calibrated receiver. A later art review may still choose to redraw a specific cross-set combination for taste, but that is not required to make the transform mathematically correct.

## Validation record

Implemented and verified on 2026-07-20:

- `pnpm typecheck` — pass across shared, client, and server.
- `npx vitest run` — **76 test files, 1,313 tests passed, 0 failed** in the current shared worktree. The head-fit unit contributes two append-only regressions beyond the supplied baseline: the `0.85` both-facings placement proof and the full-head cowl slot invariant.
- `node --test tools/artkit/lib/gear-replacement-contract.test.mjs` — **4 passed, 0 failed**, including the 12 normal pairs + 5 queued cowl-head plan.
- Catalog parser smoke check — 113 rows read; 18 head rows including the blank; all 18 carry face receivers; exactly the five audited cowl IDs are head-slot IDs ending in `-hat`.
- Browser screenshots — gracefully skipped. Browser runtime setup succeeded, but the available-session list was empty, so no screenshots were fabricated through another surface.
- Render safety — no render command was started and no Node/Codex process was stopped. The pre-existing torso fleet remained active throughout implementation and validation.

### Implemented file groups

- Panel/audit: `docs/head-fit-panel/panel.md`.
- Runtime/content: `packages/shared/src/gear.ts`, `packages/shared/src/meta.ts`, `packages/client/src/sprites/gear-parts.ts`, `packages/client/src/sprites/gear-texture-baker.ts`.
- Pipeline/queue contract: `tools/artkit/gen-gear.mjs`, `tools/artkit/lib/gear-catalog.mjs`, `tools/artkit/lib/gear-replacement-contract.mjs`.
- Regression and compatibility coverage: `packages/client/src/sprites/gear-parts.test.ts`, `packages/server/src/rooms/progression.test.ts`, `packages/client/src/sprites/gear-parts.completeness.test.ts`, `packages/client/src/entities/SpriteRig.boilerplate.test.ts`, `packages/client/src/ui/remote-gear.test.ts`, `packages/client/src/ui/wardrobe/model.test.ts`, `packages/client/src/ui/wardrobe/preview.test.ts`, and `tools/artkit/lib/gear-replacement-contract.test.mjs`.
