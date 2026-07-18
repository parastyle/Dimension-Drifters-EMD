# Gear replacement rendering blueprint

Status: **binding implementation brief for v0.118**  
Owner ruling: `docs/metagame-panel/DECISIONS.md`, “Gear rendering — REPLACEMENT, not layering”  
Scope: design only; this document does not authorize a ninth gear slot, a wire-schema change, or a return to garment stickers.

## Five-sentence model

1. The rig keeps exactly six animated character sprites—torso, floating head, two hands, and two feet—but each sprite receives one loadout-baked texture instead of wearing shirt, pants, glove, boot, glasses, or facial-hair sprites on top.
2. Shirt and pants are transparent, exact-frame coverage patches composited over the canonical torso in the fixed order base → pants → shirt, while gloves and boots are complete dressed-blob replacements and masks or helmets are complete head replacements.
3. Glasses and facial hair are baked into whichever head card won, whereas cloaks remain one structural behind-body drape and hats remain the only stack-on-top wardrobe sprites.
4. One scene-scoped, ref-counted RenderTexture cache produces the same six-part result for local rigs, remote rigs, and the wardrobe preview only when a loadout or source-art revision changes.
5. Missing or still-loading art preserves the last complete bake or falls back to the relevant boilerplate part, so a character is never invisible and never presents a half-old, half-new outfit.

## 0. Existing seams that this design keeps

- `SpriteRig` already promotes the fixed untrimmed boilerplate into six retained nodes and drives the floating head, hand, foot, facing, tint, hop, death, and LOD behavior independently of gear. Texture replacement must attach to those nodes; it must not create a second animation skeleton.
- `resolveLoadoutHeadTexture` is the correct helmet seam. It becomes manifest-driven instead of requiring an ad hoc caller-supplied alternative, but retains the rule “unresolved head art means `boilerplate:head`.”
- `gearUpper` and `gearLower` already encode all eight equipped catalog IDs, and public `prestige` already rides beside them in `player.dualWield`. Those three wire fields are sufficient because head-replacement classification is deterministic manifest data.
- The reflection law is unchanged: decoded client rows expose wire fields, not `PlayerState` compatibility getters. Every client read remains `player.dualWield?.gearUpper ?? ""`, `gearLower`, and `prestige`; no implementation may read `player.gearUpper` or add baked texture keys, art roles, or tower physics to the wire.
- `WardrobeCharacterPreview` already uses the socket manifest, but it independently reconstructs loose layers. It must be reduced to a consumer of the same bake service and the same cloak/hat-extra assembly as `SpriteRig`.
- All art remains authored semantic-right in `GEAR_SOCKET_FRAME_V1`; the root container owns the complete left-facing mirror.

## 1. Part-texture model

### 1.1 The decision

Use **per-part, per-loadout RenderTexture compositing at equip/change time**. A resolved loadout yields six texture handles:

| Retained rig node | Inputs that affect its baked texture | Runtime sprite count |
|---|---|---:|
| `body` | boilerplate body + pants patch + shirt patch | 1 |
| `head` | boilerplate or replacement head + facial-hair patch + glasses patch | 1 |
| `hand-l` | boilerplate left hand or left glove card | 1 |
| `hand-r` | boilerplate right hand or right glove card | 1 |
| `foot-l` | boilerplate left foot or left boot card | 1 |
| `foot-r` | boilerplate right foot or right boot card | 1 |

The optional cloak and visible hat segments are not among those six textures. The cloak is one behind-body structural card; hats are retained spring-chain cards. No other equipped slot is allowed to allocate a visible attachment sprite.

The bake is alpha-over into fixed, cropped part frames. It happens only after a loadout or art-revision key changes, never in `animate()`, so the steady-state rig retains one texture sample and one transform write per body part with no coincident garment planes, z-fighting, or per-frame composition cost.

### 1.2 Exact headwear routing inside the existing `hat` slot

There are still eight catalog slots. Manifest schema v2 adds a visual role to each nonblank hat item:

- `overlay-hat`: all current hat items except the two IDs below; it mounts on the sprung head and supplies every repeated prestige segment.
- `replace-head`: exactly `demon-mask-hat` and `unbending-hat`; it supplies a complete alternative-head texture and consumes the base headwear position instead of drawing over the boilerplate head.
- Each replacement-head item also owns a separate `prestige-cap` variant—a small, valid `HAT_STACK_BAND_V1` topper derived from the item’s crest/horns/helm language. This is a real hat-like tower segment, not a second head or mask.

This resolves the current “one hat ID plus prestige count” wire without lying about what stacks:

- For an `overlay-hat`, visible stack segments are `min(prestige + 1, 30)` before the 12-segment readability cap, exactly as today.
- For a `replace-head`, the alternative head occupies position zero and topper count is `min(prestige, 29)`; at prestige zero there is no overlay, and at prestige 30 the visual still represents 30 total headwear positions (one replacement head plus 29 toppers).
- The screen-visible cap is 12 total headwear positions. Therefore an overlay hat may show 12 segments, while a replacement head may show the head plus at most 11 topper segments; `+N` counts only hidden topper segments.
- Until persisted tower composition ships, normal remote/local fallback repeats the selected overlay hat or the selected replacement head’s topper. If an optional local `towerComposition` is supplied, only `overlay-hat` IDs are accepted as segments; a replacement-head ID is never stacked and falls back to the selected item’s legal segment.

Both replacement heads must expose the same face accessory sockets and hat mount as the boilerplate head. Glasses, facial hair, and prestige hats therefore remain compatible without any loadout-specific offsets.

### 1.3 Cloak rule

Keep the cloak as one separate `cloakFar` card anchored to the final body transform and ordered behind feet, hands, body, and head. A cloak intentionally extends beyond the torso silhouette, can trail visually as a drape, and would be cropped or flattened incorrectly if baked into the torso frame; it is a structural receiver, not a sticker attempting to dress the torso. It has no duplicate base-body pixels, no near-body second panel, and no independent gameplay transform; the current no-spring body-follow behavior remains unless separately approved later.

### 1.4 Alternatives considered and rejected

| Alternative | Honest benefit | Why it loses here |
|---|---|---|
| Keep one sprite per loose garment | Minimal code change and independently movable pieces | It is the retired system: undersized layers reveal the base, duplicate outlines, increase draw count, and make torso ordering a permanent visual seam. |
| Store a full precomposed body for every shirt/pants pair | Perfectly deterministic pixels with no runtime bake | `15 × 12` torso combinations already require 180 bodies, and future catalog growth multiplies rather than adds; head accessories have the same combinatorial problem. |
| Let shirt or pants replace the whole body directly | Zero composition machinery | Whichever slot writes last destroys the other slot; neither can represent a legal mixed-set outfit. |
| Multi-texture shader composition every frame | No RenderTexture allocation and instant source changes | It spends texture reads and shader state every frame, complicates batching/tints/outlines, and produces a second rendering truth for the non-WebGL/test path. |
| CPU canvas composition | Straightforward pixel masking and headless tests | Main-thread upload stalls and browser canvas/color behavior are avoidable; CPU pixel checks belong in the art pipeline, while the client uses GPU RenderTextures. |

## 2. Art-authoring contract for Bot 2

### 2.1 Frozen source and bake frames

Every source remains an untrimmed 1024×1024 RGBA PNG in `GEAR_SOCKET_FRAME_V1`, semantic-right, with the current source pivots and `BODY_ROOT_SOURCE=(512,512)`. Bot 2 adds the following fixed bake frames to manifest schema v2; these rectangles are source-space `[left, top, width, height]`, never recomputed from an individual item’s alpha bounds:

| Target part | Fixed bake frame | Pivot source | Output origin |
|---|---:|---:|---:|
| `body` | `[344,324,336,376]` | `(512,512)` | `(168/336,188/376)` |
| `head` | `[352,112,384,456]` | `(512,300)` | `(160/384,188/456)` |
| `hand-l` | `[294,432,180,180]` | `(384,522)` | `(90/180,90/180)` |
| `hand-r` | `[550,432,180,180]` | `(640,522)` | `(90/180,90/180)` |
| `foot-l` | `[353,641,190,190]` | `(448,736)` | `(95/190,95/190)` |
| `foot-r` | `[481,641,190,190]` | `(576,736)` | `(95/190,95/190)` |

The wider head frame deliberately contains the current face-accessory envelope (through approximately x=720/y=547) while keeping a stable origin. The blob frames retain room for cuffs and footwear identity, but the validator—not runtime scaling—decides whether a replacement fits. Runtime crops these exact rectangles after composition; it never tight-trims a baked result.

### 2.2 Canonical body masks and the torso seam

Bot 2 derives masks from the registered **pre-outline** boilerplate body, then freezes their hashes and rules in the manifest:

- `bodyFill` is the body’s pre-outline alpha support at alpha ≥64.
- Normalize vertical position over the frozen body frame as `v=(sourceY-324)/375`.
- `shirtRequired = bodyFill ∩ (v ≤ 0.62)` and `shirtAllowed = bodyFill ∩ (v ≤ 0.72)`.
- `pantsRequired = bodyFill ∩ (v ≥ 0.60)` and `pantsAllowed = bodyFill ∩ (v ≥ 0.52)`.
- Pixels outside an allowed mask must be transparent. Pixels in a required mask must be opaque garment material; the 0.52–0.72 overlap is the authored waistband/hem allowance, and shirt wins the final 0.60–0.62 overlap because body composition order is base → pants → shirt.

The shirt and pants PNGs contain **garment pixels only**. They do not contain oatmeal body pixels, a copied body card, transparent “holes” intended to reveal an invented undershirt, or an automatically dilated outer outline. The base body supplies all deliberately uncovered canvas; an equipped garment completely covers its required zone, and its optional hem/waist shape may use only its allowed-minus-required band. Because both patches are clipped to `bodyFill`, the final body alpha silhouette equals `body.png` exactly and the one existing outer ink rim remains the only exterior outline.

This is the fit-by-construction answer to the undersized-jacket failure: an item that fails to cover the required upper torso cannot be installed, regardless of whether it looks plausible in isolation.

### 2.3 Per-slot contract

| Slot | Target/render role | What the authored PNG contains | Transparency and coverage law | Compose/draw order | Missing-art result |
|---|---|---|---|---:|---|
| `shirt` | `body-patch` | Only the dressed upper-torso material at the exact body frame; collars, lapels, closures, sleeve roots, and hem are painted into the patch. | Alpha 0 outside `shirtAllowed`; opaque across `shirtRequired`; optional pixels only in the lower hem band; no boilerplate fill and no automatic exterior rim. | Bake body layer 3 | Boilerplate remains in the shirt zone. |
| `pants` | `body-patch` | Only the continuous lower-bean garment and waistband; never two legs. | Alpha 0 outside `pantsAllowed`; opaque across `pantsRequired`; optional pixels only in the upper waistband band; no boilerplate fill and no automatic exterior rim. | Bake body layer 2 | Boilerplate remains in the pants zone. |
| `gloves` | `replace-hand` (two components) | Two complete, final dressed blob cards, each including its own single outer ink contour and all visible material; no bare hand pixels. | Each card covers at least 98% of the corresponding boilerplate hand core (base fill eroded 4 px), stays inside its fixed 180×180 frame, and has exactly one connected primary island; alpha elsewhere is 0. | Direct source for baked hand | Corresponding boilerplate hand. |
| `boots` | `replace-foot` (two components) | Two complete, final dressed foot-blob cards with one outer contour; no bare foot pixels, toes, heel block, or leg. | Each card covers at least 98% of its boilerplate foot core, stays inside its fixed 190×190 frame, and has exactly one connected primary island; alpha elsewhere is 0. | Direct source for baked foot | Corresponding boilerplate foot. |
| `glasses` | `head-accessory` | One semantic-right lens/frame and temple arm, including its own intentional local ink edge; no head pixels. | Must stay inside the fixed head frame and the face-eyes envelope, cover the `face.eyes` pivot with material, and contain no second frontal lens; alpha elsewhere is 0. | Bake head layer 3 | No glasses; winning head remains. |
| `facialHair` | `head-accessory` | One near-side cheek/jaw attachment—hair, tusk, cord, or named equivalent—with local contour; no head pixels. | Must stay inside the fixed head frame and mouth/jaw envelope, cover the `face.mouth` attachment stock, and contain no mirrored far cheek; alpha elsewhere is 0. | Bake head layer 2 | Clean winning head remains. |
| `hat` / ordinary | `overlay-hat` | One complete hat-only prestige segment with its existing final outline and no head pixels. | Must pass `HAT_STACK_BAND_V1`, stack envelope, central crown path, pivot-stock, profile, and miniaturized-read checks. | Separate cards above head | No hat segments; head remains. |
| `hat` / Demon Mask or Unbending Greathelm | `replace-head` + `prestige-cap` | A complete final alternative-head card in `heads/{id}.png`, plus a separate hat-like topper in `hats/{id}.png`; neither file contains the other role. | Head covers ≥98% of default head core, stays in the fixed head frame, preserves face sockets and hat mount, and has one final outer contour; topper independently passes `HAT_STACK_BAND_V1`. | Head base layer 1; toppers separate | Default head plus any valid accessories; no illegal mask overlay. |
| `cloak` | `cloak-far` | One full drape-only profile card with its own final outline; no body pixels, near-side lapel, or second panel. | Alpha outside the cloak is 0; current back pivot, safe canvas inset, profile, and containment gates remain. | Separate plane behind all six parts | No cloak; six-part rig remains. |

Blank Drifter catalog rows continue to have no PNG and mean “use the boilerplate/no accessory.” They are not missing-art errors.

### 2.4 Outline law

- The installed outline remains `#101014`, radius 8 at 1024 source pixels.
- Complete cards—replacement head, replacement hands/feet, hats, and cloak—receive the automatic outline pass exactly once after registration.
- Torso patches do **not** receive silhouette dilation. They may contain authored interior ink lines, but their alpha is clipped to `bodyFill`; the boilerplate body’s existing exterior rim survives the bake.
- Head accessories retain their own local contour because they are discrete objects, but they are composited once into the head RenderTexture and never rendered as coincident sprites.
- Runtime does not run an outline shader or dilate a RenderTexture. Tints, fill flashes, and multiply effects apply to the final six sprites plus cloak/hat extras exactly as they do to current images.

### 2.5 Automatic validation gates

An item is installed and emitted to the manifest only if all applicable gates pass:

1. **File/frame:** 1024×1024 RGBA PNG, untrimmed socket canvas, semantic-right metadata, fixed pivot in ordinary opaque stock, emergency inset, and alpha entirely inside the role’s allowed frame/envelope.
2. **Role:** manifest role agrees with the exact catalog ID classification; only `demon-mask-hat` and `unbending-hat` may emit `replace-head`, and both must emit a separately valid `prestige-cap`.
3. **Torso containment:** every alpha>8 patch pixel lies in its allowed mask; at least 99.5% of required-mask pixels have alpha≥240; no connected transparent hole larger than 4 pixels exists in the required mask; composing the patch over base produces zero alpha-support XOR against the canonical body silhouette.
4. **Full replacement coverage:** replacement-head/hand/foot alpha covers at least 98% of the corresponding base core, no alpha escapes the fixed frame, primary-island count is one per part, and width/height/centroid remain within the role envelope rather than being repaired by runtime scaling.
5. **Face compatibility:** replacement heads include opaque support beneath both canonical face attachment zones and preserve the canonical hat mount within 4 source pixels; glasses and facial hair stay inside their named face envelopes and the fixed head frame.
6. **Paired parts:** gloves and boots contain exactly two separated components, each registered to its own current pivot; neither component crop contains pixels from its sibling.
7. **Outline:** complete cards have exactly one generated exterior rim; torso patches have zero generated rim; accessories have no duplicate head/body contour.
8. **Hat/readability:** every ordinary hat and prestige cap passes the existing stack band plus contact-sheet checks at stack scales 1.0, 0.82, and 0.24.
9. **Composite proof:** the generator emits contact sheets for blank, same-set, and adversarial mixed-set combinations, including every shirt with three representative pants; for each replacement head, the nine-pair Cartesian product of `{blank, set-matched, widest}` glasses × `{blank, set-matched, tallest}` facial hair (18 head composites total); and both replacement-head prestige towers at 0, 1, 11, and 30.

Registration may translate/scale a raw image into the frozen socket frame before validation, as today. It may not nudge, scale, or fill an already installed item to make a failed coverage gate pass; that item must be re-rendered.

## 3. Runtime engine specification for Bot 3

### 3.1 Shared bake API and manifest shape

Manifest schema v2 adds:

- `replacementContract.id = "GEAR_REPLACEMENT_V1"`;
- the six fixed part frames and canonical mask hashes;
- item `renderRole` values from the table;
- a source revision/hash for every compositable role;
- `replacementTexture` for replacement-head items while their existing hat texture field names the prestige-cap variant;
- explicit composition orders (`body,pants,shirt` and `head,facialHair,glasses`).

`gear-parts.ts` validates those fields and resolves a loadout into two products:

1. `GearBakeRecipe`: six fixed-frame part recipes with ordered, ready/missing/pending source dependencies.
2. `GearExtraAssembly`: zero or one cloak plus legal ordinary/prestige hat segments, tower totals, visible count, and overflow.

No shirt, pants, glove, boot, glasses, facial-hair, or replacement-head descriptor may enter `GearExtraAssembly`. `resolveLoadoutHeadTexture` reads the selected hat item’s manifest role and returns its ready replacement texture or the boilerplate default; production callers no longer construct an alternative-head selection themselves.

Create `GearTextureBakeCache`, shared by `SpriteRig` and wardrobe preview. Its acquire result is a lease containing six `{textureKey, frame, origin}` handles, extras, readiness/fallback diagnostics, and `release()`.

### 3.2 Loadout-change pipeline

On initial equip or a real local/remote loadout signature change:

1. Decode/validate the same eight slot IDs already used for stats.
2. Resolve the manifest roles, six bake recipes, cloak, legal tower segment source, prestige count, and optional local composition.
3. Queue only required source textures. Blank rows contribute no dependency; a known failed texture is `missing`, not perpetually `pending`.
4. While any required source is pending, retain the rig’s prior complete lease. A newly created rig continues showing its installed six boilerplate textures.
5. When the request settles, discard the result if its monotonically increasing request generation is stale; otherwise acquire/create all six cached outputs and atomically retarget the six retained sprites in one method.
6. Update both slide-afterimage textures to the new baked body, apply the resolved head to the existing floating-head node, reapply resting tint, rebuild only the cloak/hat render stack, then release the previous lease.

“Atomically” means no frame can show new pants with old shirt, one boot with the other still bare, or a replacement head with accessories from the prior loadout. A missing source is a valid settled fallback and does not block the other legal parts from baking.

`equipSyncedGear` keeps its current cheap string/prestige diff, so Arena’s every-frame reconciliation performs no bake work when the wire signature is unchanged. Self and remote rigs call the same `equipGearLoadout`/cache path; the only difference remains where their already-synced prestige value comes from.

### 3.3 Cache key, memory, and lifecycle

Cache **per part recipe**, not per whole outfit, so changing boots does not duplicate an identical body/head:

- body key: contract/schema revision + base-body hash + pants ID/hash-or-missing + shirt ID/hash-or-missing;
- head key: contract/schema revision + winning base/replacement-head ID/hash-or-fallback + facial-hair ID/hash-or-missing + glasses ID/hash-or-missing;
- each hand key: contract/schema revision + side + glove ID/component hash-or-fallback;
- each foot key: contract/schema revision + side + boot ID/component hash-or-fallback.

Do not include facing, prestige, cloak, hat, jiggle state, tint, player ID, or local/remote identity in a baked-part key. Do not bake mirrored variants.

The cache is scene-scoped and has a 48 MiB soft budget measured as `frameWidth × frameHeight × 4` per RenderTexture. Entries carry `refCount` and an acquire/release LRU epoch; after every release or creation, evict zero-ref entries from oldest to newest until at or below budget. Active leases are never evicted; if active entries alone exceed 48 MiB, keep them and issue one diagnostic rather than destroying an in-use texture. Scene shutdown releases all leases, destroys all RenderTexture objects, removes their TextureManager keys, clears pending callbacks, and clears the cache.

The rig owns one lease. A `createPaperCopy` clone acquires a secondary lease and releases it when its returned container is destroyed, preventing an LRU eviction from invalidating a live decoy. Slide afterimages and death tears live under the rig lease and need no additional reference. Wardrobe hover changes release stale preview leases through the same generation-token rule.

### 3.4 Fallback matrix

| Failure | Settled bake result |
|---|---|
| Shirt missing | Base torso remains in shirt zone; valid pants still bake. |
| Pants missing | Base torso remains in pants zone; valid shirt still bakes. |
| One/both glove components missing | Missing side uses its own boilerplate hand; valid side may replace. |
| One/both boot components missing | Missing side uses its own boilerplate foot; valid side may replace. |
| Replacement head missing | Boilerplate head wins, then any valid glasses/facial hair bake onto it. |
| Glasses or facial hair missing | Winning head remains without that accessory. |
| Cloak missing | No cloak card. |
| Hat/cap missing | No illegal placeholder and no invisible head; render the legal segments that exist and keep overflow honest to rendered segments. |
| Manifest invalid/unavailable | Preserve the current compatibility rig/boilerplate behavior and report once. |

Missing-art fallback must never assign an unresolved key and must never hide a retained part. Blank items are silent intentional fallbacks; missing nonblank items set diagnostics for preview/dev logs.

### 3.5 Animation, flip, LOD, outline, and render order

- **Jiggle/springs:** body, sprung head, hand, and foot transforms are unchanged because only each node’s texture changes. Accessories baked into the head inherit the exact final head spring. Replacement hands/feet inherit existing limb springs without receiver attachments.
- **Facing:** root `scaleX` mirrors the semantic-right complete assembly. Baked textures, cloak, hats, pivots, weapon anchors, and face sockets all remain in semantic-right local space.
- **LOD:** baking/loading is event-driven and does not enter the animation LOD loop. Offscreen rigs may finish a requested bake; LOD sleep still resets only secondary motion, and wake does not rebake.
- **Tint/flash:** existing multiply/fill operations apply to the six retained sprites and to cloak/hat extras. Removed garment attachment loops disappear; no tint operation addresses a destroyed sticker.
- **Outline:** the offline single-outline law in section 2.4 is final. RenderTextures are plain alpha-over results and receive no runtime outline pass.
- **Afterimages/copies/death:** body afterimages use the baked torso texture; paper copies clone the final six textures plus cloak/hats under a cache lease; tear/death code continues to move the final retained images.
- **Per-frame cost:** no `RenderTexture.draw`, texture load, key construction, allocation, or cache LRU walk occurs in `animate()`.

Back-to-front character order is:

1. shadow/slide echoes;
2. cloak far card;
3. baked feet;
4. back weapon/hand ordering using the existing worn-weapon law, with the baked back hand standing where base hand + glove used to stand;
5. baked body;
6. baked head;
7. legal hat/prestige spring-chain segments and overflow tassel;
8. front weapon/hand ordering using the existing worn-weapon law;
9. protected VFX, pair glint, and label.

The hat chain’s excitation, spring integration, miniaturization, top-socket following, reduced-motion behavior, and dash/landing inputs remain unchanged. Only segment selection/count differs for replacement-head base items as specified in section 1.2.

### 3.6 Network and reflection-law proof

- Do not modify `packages/shared/src/state.ts`, `packages/shared/src/gear.ts`, schema version, `gearUpper`, `gearLower`, or `prestige` encoding.
- Do not modify `ArenaScene`’s nested `dualWield` reads. Existing `addBlob` and `syncBlobs` calls already deliver local/remote signatures to `SpriteRig`.
- A remote `demon-mask-hat` resolves to the same replacement-head recipe as local because the role comes from the bundled manifest, not account-private state.
- `towerComposition` remains optional local/future input and is not inferred to be synced. Public remote rendering continues to use the deterministic selected-item repetition law.
- RenderTexture keys and cache state are presentation-only and never enter simulation, prediction, snapshots, persistence, or messages.

## 4. Wardrobe specification for Bot 4

`WardrobeCharacterPreview` must delete its independent loose-garment composition logic. It acquires a six-part lease from `GearTextureBakeCache`, lays those six textures onto the static boilerplate transforms from `assembleBoilerplate`, and asks the same extras resolver for cloak and hats. It may omit gameplay spring integration in the static menu pose, but it may not reimplement texture selection, crop frames, head classification, composition order, fallback, tower count, or top-socket math.

Preview behavior:

- `refresh(equippedLoadout, prestige, previewId?)` creates a draft copy of the loadout. If `previewId` is a valid catalog row for the currently browsed slot, only that draft slot changes; the account and stats remain untouched.
- Hovering or keyboard-focusing any wardrobe card, owned or locked, previews its replaced part live when art exists. “Locked” still blocks equip and remains stated in the inspector; preview is not ownership.
- Pointer/focus exit returns to the equipped loadout. Clicking an owned item still persists through the existing equip flow, after which the same pixels remain but the caption becomes equipped truth.
- Rapid browsing uses request generations and lease release: a late texture completion from item A may not replace the newer item B preview.
- While a draft bake is pending, keep the last complete preview. On first construction use the six boilerplate parts; on settled missing art show the same base fallback as the game and a nonblocking “some art unavailable” status.
- Bounds and centering use the six fixed bake frames plus cloak/hat bounds. They must not examine loose shirt/pants/accessory alpha bounds.

The wardrobe is therefore a second pose consumer, not a second renderer.

## 5. Migration and render plan for Bot 5/orchestrator

### 5.1 What survives

- Preserve the approved boilerplate `identity-master.png`, `body.png`, `head.png`, both hands, both feet, their installed public copies, and `socket-reference.png`. Their current pivots and alpha bounds define the replacement contract and must not be regenerated.
- Preserve the 10 true overlay hats as art: Ash-Walker, Ashen Crusader, Molten Core, Coldsnap, Graveside, Nine Veils, Thornwatch, Neon Mirage, House Edge, and Pressurized. Revalidate them against the existing profile/stack gates and the new manifest role, but do not spend a creative rerender.
- Preserve all 12 cloaks as separate behind-body drapes. Revalidate profile, pivot, inset, alpha, and “no body pixels”; do not bake them and do not rerender them merely because the replacement model changed.
- Do not preserve any current shirt, pants, glove, boot, glasses, facial-hair, Demon Mask hat, or Unbending Greathelm pixels as shipped replacement art. Those 83 catalog items enter the new render fleet; old files may serve only as identity references.

### 5.2 Exact render counts

| Batch | Catalog items | AI render calls | Installed component parts | Result |
|---|---:|---:|---:|---|
| Shirts | 15 | 15 | 15 | torso patches |
| Pants | 12 | 12 | 12 | torso patches |
| Gloves | 15 | 15 paired renders | 30 | full left/right hand cards |
| Boots | 12 | 12 paired renders | 24 | full left/right foot cards |
| Glasses | 15 | 15 | 15 | head-accessory patches |
| Facial hair | 12 | 12 | 12 | head-accessory patches |
| Replacement heads | 2 | 2 | 2 | full Demon Mask/Greathelm heads |
| Replacement-head prestige caps | 2 | 2 | 2 | legal tower toppers |
| **Total rerender fleet** | **83 unique catalog items** | **85 calls** | **112 component parts** | replacement contract |
| Preserved overlay hats | 10 | 0 | 10 existing parts | validation/contact sheet only |
| Preserved cloaks | 12 | 0 | 12 existing parts | validation/contact sheet only |
| **Final nonblank catalog** | **105 unique catalog items** | **85 calls** | **134 manifest parts** | **107 installed role textures** |

The final nonblank catalog still has 105 items: 83 rerendered items + 10 preserved overlay hats + 12 preserved cloaks. It has 107 installed source textures because each of the two replacement-head catalog items owns its normal `hats/{id}.png` prestige-cap texture plus one additional `heads/{id}.png` replacement texture.

Exact rerender IDs:

- Shirts: `ash-walker-shirt`, `ashen-crusader-shirt`, `molten-core-shirt`, `coldsnap-shirt`, `graveside-shirt`, `nine-veils-shirt`, `demon-mask-shirt`, `thornwatch-shirt`, `neon-mirage-shirt`, `house-edge-shirt`, `unbending-shirt`, `pressurized-shirt`, `mended-workshirt`, `reinforced-workshirt`, `shopkeeps-sunday-best`.
- Pants: `ash-walker-pants`, `ashen-crusader-pants`, `molten-core-pants`, `coldsnap-pants`, `graveside-pants`, `nine-veils-pants`, `demon-mask-pants`, `thornwatch-pants`, `neon-mirage-pants`, `house-edge-pants`, `unbending-pants`, `pressurized-pants`.
- Gloves: `ash-walker-gloves`, `ashen-crusader-gloves`, `molten-core-gloves`, `coldsnap-gloves`, `graveside-gloves`, `nine-veils-gloves`, `demon-mask-gloves`, `thornwatch-gloves`, `neon-mirage-gloves`, `house-edge-gloves`, `unbending-gloves`, `pressurized-gloves`, `work-gloves`, `knuckled-gloves`, `ironhand-gloves`.
- Boots: `ash-walker-boots`, `ashen-crusader-boots`, `molten-core-boots`, `coldsnap-boots`, `graveside-boots`, `nine-veils-boots`, `demon-mask-boots`, `thornwatch-boots`, `neon-mirage-boots`, `house-edge-boots`, `unbending-boots`, `pressurized-boots`.
- Glasses: `ash-walker-glasses`, `ashen-crusader-glasses`, `molten-core-glasses`, `coldsnap-glasses`, `graveside-glasses`, `nine-veils-glasses`, `demon-mask-glasses`, `thornwatch-glasses`, `neon-mirage-glasses`, `house-edge-glasses`, `unbending-glasses`, `pressurized-glasses`, `brass-readers`, `lucky-readers`, `loaded-readers`.
- Facial hair: `ash-walker-facial-hair`, `ashen-crusader-facial-hair`, `molten-core-facial-hair`, `coldsnap-facial-hair`, `graveside-facial-hair`, `nine-veils-facial-hair`, `demon-mask-facial-hair`, `thornwatch-facial-hair`, `neon-mirage-facial-hair`, `house-edge-facial-hair`, `unbending-facial-hair`, `pressurized-facial-hair`.
- Replacement-head pairs: `demon-mask-hat` and `unbending-hat`, each rendered once to `heads/` and once to its `hats/` prestige-cap path.

### 5.3 Batch order and QA gates

Run in this order so failures localize cleanly:

1. **Contract dry run:** emit schema v2 with existing boilerplate/preserved art; validate exact role counts (10 overlay hats, 2 replacement heads, 12 cloaks), fixed frames, mask hashes, and zero extra/missing catalog IDs apart from the declared rerender fleet.
2. **Torso batch:** shirts then pants; require per-item mask gates, then same-set and adversarial mixed shirt/pants contact sheets. Reject any oatmeal leak inside a required zone, changed outer silhouette, double outline, frontal garment, or two-leg read.
3. **Blob batch:** gloves then boots; inspect both paired crops at rig scale and in hand-with-weapon poses. Reject base-blob peeking, sibling pixels in a crop, fingers/thumb/toe/heel anatomy, pivot drift, or silhouette smaller than the core coverage gate.
4. **Head batch:** glasses, facial hair, replacement heads, then caps; inspect every replacement head with blank accessories, its set accessories, cross-set extremes, and prestige 0/1/11/30. Reject lost X/face readability where the item should preserve it, socket drift, accessory clipping, mask-over-base pixels, or a head-shaped tower segment.
5. **Preserved extras:** regenerate contact sheets—not art—for the 10 overlay hats and 12 cloaks under manifest v2. Any preserved file that fails is a hard batch failure and must be explicitly returned to its slot render queue; it may not be silently grandfathered.
6. **Runtime composite sheet:** capture blank, every full legacy set, the exact mixed loadout from the existing v0.118 tests, both replacement heads with mixed accessories, missing-art fallbacks, mirrored facing, reduced motion, and maximum visible towers in game and wardrobe poses.
7. **Completeness:** manifest reports 105/105 nonblank catalog items, 107 installed role textures, no extras, no invalid rows, no temporary missing-art allowlist, and all public/master hashes agree.

Do not promote a batch merely because every image-generation call returned a PNG. Promotion follows the pixel gates and the contact-sheet review.

## 6. Disjoint bot file ownership

No implementation bot edits this blueprint or another bot’s files. Generated-file ownership belongs only to Bot 5, even though Bot 2’s generator defines their content.

| Bot | Files it may touch | Files it must not touch |
|---|---|---|
| **Bot 1 — blueprint (this bot)** | `docs/gear-replacement-panel/blueprint.md` only | All code, tests, generated files, and art. |
| **Bot 2 — authoring contract/generator** | `tools/artkit/gen-gear.mjs`; new `tools/artkit/lib/gear-replacement-contract.mjs`; new `tools/artkit/lib/gear-replacement-contract.test.mjs` | `tools/artkit/out/gear/**`, `packages/client/public/sprites/**`, and all client runtime/UI files. |
| **Bot 3 — runtime engine** | `packages/client/src/sprites/gear-parts.ts`; `packages/client/src/sprites/gear-parts.test.ts`; new `packages/client/src/sprites/gear-texture-baker.ts`; new `packages/client/src/sprites/gear-texture-baker.test.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/entities/SpriteRig.boilerplate.test.ts`; `packages/client/src/ui/remote-gear.test.ts` | Generator, generated manifest/art, wardrobe preview/MenuScene, shared schema/catalog, and ArenaScene. |
| **Bot 4 — wardrobe consumer** | `packages/client/src/ui/wardrobe/preview.ts`; new `packages/client/src/ui/wardrobe/preview.test.ts`; `packages/client/src/scenes/MenuScene.ts` | Runtime baker/rig/manifest loader, generator, generated art, and shared schema/catalog. |
| **Bot 5 — orchestrator/render migration** | `tools/artkit/out/gear/gear-parts-manifest.json`; `tools/artkit/out/gear/gear-replacement-contact-sheet.png`; `tools/artkit/out/gear/hat-contact-sheet.png`; the exact master/install/log families below; `packages/client/src/sprites/gear-parts.completeness.test.ts`; new `packages/client/src/sprites/gear-replacement-assets.test.ts` | Generator source, runtime/wardrobe production files, boilerplate masters/public parts, shared schema/catalog, and this blueprint. |

Bot 5’s exact generated families are:

- For every shirt, pants, gloves, boots, glasses, and facial-hair ID listed in section 5.2: `tools/artkit/out/gear/masters/{slot-directory}/{id}.png`, `packages/client/public/sprites/gear/{slot-directory}/{id}.png`, `tools/artkit/out/gear/logs/{slot-directory}/{id}.codex.log`, and `tools/artkit/out/gear/logs/{slot-directory}/{id}.install.json`, where slot directories are exactly `shirt`, `pants`, `gloves`, `boots`, `glasses`, and `facial-hair`.
- For `demon-mask-hat` and `unbending-hat`: the same four files under `hats/` for each prestige cap, and the same four files under `heads/` for each replacement head.
- No cloak, preserved ordinary-hat, or boilerplate PNG/log is part of Bot 5’s creative render writes; their existing files are read-only validation inputs.

If a failed generation creates a timestamped file under `tools/artkit/out/gear/rejected/`, Bot 5 owns that failure artifact for the run, but rejected files are never manifest inputs and are not promoted.

## 7. Append-only test shapes

### Bot 2

Add contract tests without weakening existing generator checks:

- synthetic body masks prove shirt/pants required coverage, allowed containment, overlap order, and exact final alpha-silhouette equality;
- full replacements fail at 97.9% core coverage, frame escape, extra island, wrong pivot, or accidental torso-patch outline;
- exact role classification is 10 overlay hats + 2 replacement heads, with a required valid cap for both replacement IDs;
- catalog-derived counts pin 15/12/15/12/15/12/2/2 calls and 112 component parts;
- validation-only mode accepts preserved cloaks/hats without writing them.

### Bot 3

Append `describe` blocks to existing gear/rig tests and add the baker test file:

- recipe routing proves shirt/pants/accessories/replacement heads never enter visible extras, while cloak and legal hats do;
- body bake order is base → pants → shirt and head order is winning head → facial hair → glasses;
- fallback tests cover every row in section 3.4 and assert six nonempty handles;
- cache tests pin part-level key reuse, 48 MiB zero-ref LRU eviction, active-entry protection, decoy secondary leases, scene teardown, stale async generation rejection, and no mirror/prestige/player ID in keys;
- rig tests assert one retained sprite per replaced part, atomic six-texture commit, afterimage body retarget, unchanged weapon/hand ordering, tint/flash propagation, LOD wake without rebake, and legal replacement-head tower counts;
- append a remote test proving identical encoded strings/prestige resolve to identical recipe keys, while reads stay on nested `dualWield` data.

### Bot 4

Add preview tests around a fake shared baker:

- equipped and hover-draft loadouts request exactly the same recipe keys as a rig;
- hovering each slot changes only that slot, including locked-item visual preview without account mutation;
- a late A completion cannot overwrite newer B, and leases release on hover exit/shutdown;
- missing art produces the same base fallback and six visible nodes;
- replacement head + accessories and normal/replacement prestige towers use shared extras/counts, with no loose garment node creation;
- bounds derive from fixed bake frames and extras, not loose garment alpha bounds.

### Bot 5

Retire the nine-ID temporary missing-art allowlist in `gear-parts.completeness.test.ts`, then append asset-contract coverage in the new test file:

- exactly 105 nonblank catalog items and 107 role textures are installed, with no blank-row art;
- every v2 manifest hash matches its PNG and every fixed crop lies inside 1024×1024;
- role/count assertions match section 5.2, paired component counts total 54, and total component parts equal 112 for the rerender fleet;
- pixel gates rerun against promoted files, not only masters/logs;
- preserved boilerplate hashes remain the pre-migration hashes, proving Bot 5 did not regenerate the rig identity;
- no `TEMP`/allowlist path can make a missing nonblank replacement asset pass.

Except for emptying the obsolete temporary allowlist, these tests are additive; no bot deletes unrelated coverage to make the migration green.

## 8. Three sharp risks and mitigations

1. **Torso/head compatibility can still fail combinatorially even when isolated items pass.** A shirt hem can erase a waistband, or a legal beard can clip a replacement mask; mitigate with hard required/allowed masks, preserved face sockets, deterministic layer order, and the adversarial mixed-composite matrix before promotion.
2. **High-diversity remote lobbies can turn “bake once” into GPU-memory growth or eviction churn.** Mitigate with fixed cropped frames, per-part rather than whole-loadout keys, source-hash reuse, a measured 48 MiB zero-ref LRU, active/decoy leases, one over-budget diagnostic, and a stress test that cycles more unique loadouts than the budget holds.
3. **The dual-role hat slot can desync visual prestige or accidentally stack masks if routing is implicit.** Mitigate by pinning the two replacement IDs in manifest validation, giving each a separately validated hat-like cap, defining replacement-head-visible capacity as head + 11 caps, deriving local and remote behavior from the same manifest, and leaving all role data off the reflection-law wire.

## 9. Definition of done

- An equipped mixed set renders six dressed part sprites, optional one cloak, and legal hats; inspecting the display list finds no shirt, pants, glove, boot, glasses, facial-hair, or mask attachment sprite.
- Every equipped slot visibly changes the correct part in both Arena and wardrobe preview, including hover browsing, and both consumers produce identical texture recipe keys.
- Demon Mask and Unbending Greathelm remove the boilerplate head rather than overlaying it; accessories bake into the replacement and prestige stacks only cap/hat segments.
- A missing asset, failed load, rapid selection, offscreen LOD transition, mirror, flash, death, or paper copy never makes a base part invisible and never references a destroyed cached texture.
- Remote cosmetics remain driven solely by nested `dualWield.gearUpper`, `gearLower`, and `prestige`, with no schema/catalog-slot change.
- Art completeness is 105/105 nonblank items and 107 role textures, all generator/manifest/runtime/preview tests pass, and the boilerplate identity hashes are unchanged.
