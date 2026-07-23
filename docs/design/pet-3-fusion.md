# Pet 3 — Fusion as Expression

## 1am summary

Fusion is a free, non-destructive creature maker: combine any two owned pets, take one body and choose the other pet's wings, limbs, tail, crown, shell, aura, or other registered groups, then name the result, tint it, and give it a statless keepsake. Both parents remain, the result is a new saved companion that can be edited or fused again, and it uses one chosen parent's full existing function/Bond track—never mixed or weakened stats—so the player can choose entirely for looks. Every result is assembled from reusable same-band slot assets, not bespoke art for hundreds of pairs; the target feeling is “I made Cinderwink and no one else chose quite this creature.”

## Verified baseline

The shipped catalog is **8 pet identities, not 24**. `packages/shared/src/pets.ts:6-15` contains exactly Verdant Wing, Hearth Newt, Lodestar Moth, Copper Snail, Gilded Gecko, Brass Crab, Pale Firefly, and Slate Tortoise. The generated portal really does label its pet category `count: 24` (`tools/portal/index.html:215`), but its generator flat-maps every `PET_ID` across all three stage bands (`tools/portal/gen-portal.mjs:295-317`): that number is **8 × 3 = 24 form cards**, not 24 species. The matching test says “all 24 forms” and then asserts eight manifest pets (`packages/client/src/sprites/pet-parts.test.ts:14-17`). Pet-1's separate proposal makes 24 identities a future roster target; this report never presents that target as shipped truth.

The shared gameplay definition already establishes three bands—Hatchling levels 1-3, Awakened 4-7, Ascendant 8-10—and explicitly says stable normalized slots are intended to let later fusion/evolution manifests replace parts without account migration (`packages/shared/src/pets.ts:26-33`). Today that public vocabulary is only `core`, `primary`, and `secondary`. The generated art data is already richer: `PET_SOCKET_FRAME_V1` defines `side.far`, `side.near`, `side.paired`, `rear`, `crown`, `shell`, `dorsal`, `ventral`, plus child socket `tailTip` (`packages/client/public/sprites/pets/pet-parts-manifest.json:3-128`). It reports all 72 expected parts installed and no missing, extra, or invalid assets (`pet-parts-manifest.json:136-137,7434-7436`).

The present eight prove that the socket language covers a useful mutation range, though they do not yet prove every cross-pair visually: Verdant Wing, Lodestar Moth, Brass Crab, and Pale Firefly use paired side mounts; Hearth Newt and Gilded Gecko use rear/tail mounts; Copper Snail and Slate Tortoise use shell/dorsal/ventral accessories; Ascendants add crowns, halos, feelers, or tail-tip ornaments. Assembly is data-driven: each loose part carries a receiver anchor, pivot, rest angle, mount scale, depth plane, and optional spring (`packages/client/src/sprites/pet-parts.ts:14-34`), and `assemblePetStage` resolves the transforms and bounds from those values (`pet-parts.ts:141-223`). One implementation caveat matters to the handoff: current texture keys and URLs assume every part belongs to the selected pet id (`pet-parts.ts:118-124,231-278`), so a fusion recipe will need to retain each part's donor identity rather than merely copying its texture name.

Mechanically, every shipped pet has one `budgetKey`, one per-level bonus, and one level-10 capstone (`packages/shared/src/pets.ts:56-121`). The functions cover ammo regeneration, healing received, XP reach, pickup reach/bag capacity, sale economy, reload, revive, and ground-hazard survival. Nothing in that contract requires visual ancestry to select function, which is the opening fusion should exploit.

## Fusion model: the Bondweave Studio

The player is not breeding for an outcome or feeding pets into a recipe. They are **composing a saved creature** in a live-preview studio. Pick two owned pets, choose which body establishes the silhouette, then choose parent A, parent B, or empty for each compatible part group. The renderer assembles the saved recipe from the same loose, socketed assets used by ordinary evolution forms. There is no bespoke `A+B` sprite: eight pets already imply 28 unordered pairs, and a 24-pet target implies 276; at three bands that would be 828 pair-band renders before branches. Shared sockets keep the authoring cost proportional to pets and parts, not pairs.

### Default rules

| Question | Default | Expression/low-regret reason |
|---|---|---|
| What can fuse? | **Any two owned pets across any family**, including two with the same function. No biological/family compatibility chart. | A weird combination is the reward. Family gates turn taste into a lookup puzzle. |
| Band gate? | Parts are selected **within the same visual band**. A donor's Hatchling/Awakened/Ascendant parts unlock when that donor reaches that band; locked later forms may be previewed as silhouettes but not saved. | Same-band anchors and detail density stay coherent, while raising a pet still reveals expressive vocabulary. This is an unlock rule, not a family rule. |
| Are inputs consumed? | **Never.** No pet, Bond XP, part, or function is destroyed. Preview, cancel, rename, and re-edit cost nothing; the default proposal also charges no crafting currency. | A player should try the funny wings without fearing the loss of a beloved companion. |
| What is created? | The first commit creates a **new named fused-pet instance** alongside both sources. It is a real selectable companion identity, not a skin that overwrites either parent. | The player can say “this is Mallow” rather than “this is my modified catalog slot.” |
| Can it fuse again? | **Yes.** Open `Mallow + donor`, edit Mallow in place, or save a copy. Imported slot provenance is flattened; recipes never form a recursive parent graph. | Iteration can accumulate taste from many pets without fragile ancestry chains. |
| What happens to level/function? | Choose one parent's canonical **Heart**. The fused pet uses that Heart pet's existing Bond XP, full `budgetKey`, per-level bonus, and capstone. It stores no separate power progression. | Creating a look never resets a level and cannot transfer a level-10 capstone to an unraised function. |
| Can the Heart change? | Yes, but only to the other current parent's canonical Heart; switching changes which existing Bond track is read and loses nothing. The editor defaults to keeping the current Heart. | Function choice remains reversible and never splices two budgets. |

“Owned pet” includes a catalog pet and a saved fusion. When a fused pet is used as a visual donor, the Studio copies its already-flattened stable part references. When it is used as a Heart donor, it contributes only its canonical `heartPetId`. Deleting or re-editing the donor later therefore cannot break children.

### What recombines

Each band recipe has exactly one required `body` source and optional swappable groups. The body supplies the body bitmap, axis/root, and receiver sockets; every graft supplies its own donor asset, pivot, receiver anchor, depth plane, mount scale, and spring. Current manifest inspection confirms that all 24 shipped body/band records advertise the same eight body sockets, so the art is already laid out for cross-body mounting.

Pet-2's in-flight `PET_FORM_SLOTS_V1` is the authority, so fusion adopts it rather than inventing a parallel vocabulary:

| Fusion group | Manifest mapping | Rule |
|---|---|---|
| `body` | `body` | Required, exactly one source form. Sets silhouette and receiver frame, but does not dictate function. |
| `face`, `core` | New overlay slots; `core` may initially fall back to `ventral` | Swappable when authored as a closed overlay. A form may mark either `withBody` when it is inseparable anatomy—the Manymoon Oracle's whole eyelid-ring or Moonmilk Ooze's internal star should not leave a hole. |
| `side`, `side.secondary`, `side.tertiary` | Existing paired side sockets plus new second/third pairs | Swap each authored pair atomically. A claw, wing, fin, extra arm, or ear set can occupy a pair; never strand one half unless a form is explicitly authored asymmetric. |
| `rear` | `rear`, including dependent `tailTip` children | Swap the parent and children as a subtree. A tail-tip charm may be replaced separately only after its parent tail is installed. |
| `crown` | `crown` | Crest, antennae, antlers, halo, hat-like mutation. |
| `shell` | `shell` | Shell, saddle, carapace, large back mass. Optional only when the body art is closed underneath; otherwise mark it `withBody`. |
| `dorsal` | `dorsal` | Spines, banners, plates, foliage, coin ribbons. |
| `ventral` | `ventral` | Belly lens, pouch, lantern, chest plate. |
| `rider` | New `rider` | A tiny sprout, ghost, doll, or homunculus passenger; separately swappable only if its platform remains valid. |
| `orbit.back`, `orbit.front` | New far/near root-relative cards | Satellites, eye swarms, petals, tiny ghosts. No anatomical seam, so these are universally useful donors. |
| `aura.back`, `aura.front` | New far/near root-relative fields | Wisps, sparks, mist, flame veil. They are ideal cross-family identity and always non-mechanical. |
| player `signature` | New universal keepsake overlay, outside the evolution form slots | One player-chosen neutral accessory—bell, bow, sheriff star, tiny candle, ribbon, lucky coin—not inherited from either parent and never mechanical. |

`empty` is a valid choice for every optional group. That is not missing content: subtraction is authorship, and a shell-less snail with moth wings may be exactly the player's pet. Part groups, not individual filenames, are the saved unit; paired and parent/child assets remain structurally valid.

The shared `core / primary / secondary` identifiers remain the stable coarse compatibility groups, but fusion cannot meaningfully expose only three buttons. Pet-2's exact mapping is adopted: `core → body + face + core`; `primary → side + side.secondary + side.tertiary + shell`; `secondary → rear + crown + dorsal + ventral + rider + orbit.* + aura.*`. The named form slots are stable fusion targets. A recipe stores form/group provenance, never a PNG path.

Every form slot carries `fusionPolicy: free | withBody`. `free` is the default and means A/B/empty is legal subject to parent/child integrity. `withBody` is the narrow escape hatch for pet-1's core-bound identities—the Pallbearer's walking coffin, Hungry Boot's L-shaped anatomy, Moonmilk Ooze's puddle, or Manymoon Oracle's bell mantle. Any pair of pets can still fuse; this metadata constrains a specific cutout, never the families that may meet.

### Authoring flow

1. Pick **Current** and **Donor**. Either may be a saved fusion; neither is changed.
2. Pick the required body source and preview the active band. A three-tab strip previews Hatchling, Awakened, and Ascendant recipes; only unlocked source forms can be committed.
3. For each group, tap `Current`, `Donor`, or `Empty`. Paired sides and rear subtrees switch as a single readable card. The preview updates immediately and shows a simple silhouette/bounds warning, never a random result.
4. Pick the Heart on a separate, visually quieter card. The UI says the complete function in plain language and makes explicit that appearance selections do not alter it.
5. Add a name, accent treatment, and signature accessory, then save as a new companion. Later visits default to editing that companion in place; `Save copy` is secondary.

If an evolution band has not been explicitly composed, it starts from that band's chosen body form and carries forward equivalent donor group choices where those groups exist; absent groups simply remain empty. The player can tune each band independently. Evolution still transforms the fused creature—the recipe changes from folded pair to spread pair, adds a crown, or grows a tail-tip ornament—instead of scaling one frozen collage.

## Function overlap is permission, not waste

A fused pet resolves to exactly one canonical Heart. At run snapshot, the server should behave as if it had equipped that Heart pet at that Heart's current Bond level: one full `budgetKey`, one full per-level bonus, and its normal capstone. Do **not** combine both parents at half rate, average numbers, roll a hybrid perk, or make certain visual slots carry stats. Those options invite optimization spreadsheets and make the cutest choice suspect.

The rule is deliberately boring: **form recipe → no stats; `heartPetId` → all stats**. If future Verdant Wing and another pet both use `sustain.regen-ammo`, either Heart can sit under the same fused form with no cosmetic penalty. Overlap expands the number of looks a player can choose while keeping the function they enjoy; it is therefore content freedom, not redundant design.

## Expression layer: the last 10% that makes it “mine”

The graft is the large choice; three cheap, readable controls make the result personal rather than merely combinatorial.

1. **Name.** A fused pet receives a player name on first save (default suggestion made from the two parent names, freely replaceable). Store a trimmed, filtered display name of at most 24 graphemes. Inspection may show a quiet lineage subtitle such as `Hearth Newt body · Pale Firefly sides`, but normal HUD/world presentation uses the chosen name.
2. **Two-color treatment.** `Coat wash` is one of eight restrained, low-strength curated tints applied to the full assembly; `spark color` is one of twelve brighter swatches applied only to neutral-authored aura/orbit/keepsake layers. `Original` is always available. Do not launch with arbitrary RGB, per-part hue sliders, or forced palette matching: mismatched donor colors can be charming, while unrestricted recolor multiplies art QA and muddies ink values.
3. **Signature keepsake.** One statless, neutral-authored accessory is independent of ancestry: bell, bow, deputy star, candle, ribbon, lucky coin, tiny kerchief, pressed flower. Start everyone with a small useful set and let later activities add options permanently; keepsakes are never consumed and never imply a bonus.

This is the PSO2-MAG ownership feeling translated into this game: the player raised the source forms, chose each visible mutation, named the result, and gave it a recurring personal mark. The system remembers a sequence of taste decisions. It does not need an optimal feeding chart or exclusive power to create attachment.

## Four example fusions

All four are manifest recipes, not new pair-specific paintings.

| Player pet | Slot recipe | What reads on screen | Heart/function |
|---|---|---|---|
| **Cinderwink** — Hearth Newt + Pale Firefly | Hearth Newt Ascendant `body`, `ventral` belly lens, and `crown` flame crest; Pale Firefly `side` wing pair and `rear` ribbon feeler; pale-blue spark color; tiny kerchief | A plump red salamander-lantern struggling adorably under broad translucent funeral wings, with one cool ribbon streaming behind its warm flame crest. Cute first, faintly spooky second. | **Hearth Newt Heart:** full healing-received bonus and descent-heal capstone. The Firefly appearance does not force revive mechanics. |
| **Clinkminster** — Copper Snail + Brass Crab | Copper Snail Ascendant `body`, coin `shell`, and pannier `ventral`; Brass Crab `side` claw pair and `crown` ticking halo; dusk coat wash; lucky coin | A tiny merchant siege engine: snail face low to the ground, enormous coin shell, two fussy clockwork claws, and a halo ticking like a pocket watch. Weird/cute. | **Copper Snail Heart:** full pickup reach and bag-capacity capstone. |
| **Mossbishop** — Slate Tortoise + Verdant Wing | Slate Tortoise Ascendant `body`, shell cap, cairn `dorsal`, and core shutter; Verdant Wing `side` wings and `crown` antenna crest; green spark motes; candle keepsake | A solemn flying reliquary tortoise whose stone cairn hangs under leaflike wings; the crest gives it a gentle mitre silhouette and the candle makes it feel cared for. Majestic/warm. | **Slate Tortoise Heart:** full ground-hazard mitigation and pit-regeneration capstone. |
| **Comet-Kite** — Gilded Gecko + Lodestar Moth | Gilded Gecko Ascendant `body`, curled `rear` tail and balance-pan child; Lodestar Moth `side` wings and astrolabe `crown`; cool coat wash; deputy star | A long gold gecko suspended inside an astrolabe, its moth wings turning the curled tail and dangling balance pan into a celestial kite. Majestic, strange, a little ridiculous. | **Lodestar Moth Heart:** full XP reach and boundary-echo capstone. |

The same recipe can choose the other parent's Heart without changing one pixel. That visible separation is the point: another player can make Cinderwink a revive helper because that is the function they enjoy, and neither version is the “correct” build.

## Why modularity is a strength here

The abandoned human wardrobe had to preserve recognizable human anatomy, cloth cuts, poses, and tight sleeve/neck/waist seams. A proportion mismatch reads as broken clothing. A pet fusion makes the opposite promise: an oversized moth wing on a tortoise, an off-center halo, an extra limb pair, a shell on a newt, or a floating crown reads as growth, machinery, magic, or affectionate weirdness. The existing body-relative sockets, full-canvas pivots, hidden collars, depth planes, child sockets, and springs give that mutation a disciplined attachment grammar. Registration still matters; exact anatomical sameness does not. Fusion turns controlled mismatch into expressive silhouette.

## Exact account and runtime handoff to pet-5

Current `MetaAccountV4` stores canonical pets as `Partial<Record<PetId, { bondXp }>>` and selection as `PetId | ""` (`packages/shared/src/meta.ts:88-127`). Preserve that map unchanged. Add fused identities beside it, not inside the closed `PetId` catalog:

```ts
type FusionPetId = string; // server-issued opaque instance id

interface FusionPartSource {
  donorPetId: PetId;       // canonical art lineage, even when copied from a fusion
  formKey: string;         // stable pet-2 evolution form key
  slot: PetFormSlotV1;     // stable semantic slot, never a PNG/file name
}

interface FusionBandRecipe {
  body: FusionPartSource;
  slots: Partial<Record<Exclude<PetFormSlotV1, "body">, FusionPartSource | null>>;
}

interface PersistedFusionPetV1 {
  schemaVersion: 1;
  id: FusionPetId;
  name: string;
  heartPetId: PetId;
  bands: Record<PetStageBand, FusionBandRecipe>;
  coatWashId: string;
  sparkColorId: string;
  signatureAccessoryId: string | null;
}

type SelectedCompanion =
  | { kind: "none" }
  | { kind: "catalog"; petId: PetId }
  | { kind: "fusion"; fusionPetId: FusionPetId };
```

Band is implied by the `bands` map key, so it need not be repeated on every source. `fusionPolicy`, socket positions, pivots, planes, springs, texture paths, palette definitions, and parent/child dependency rules belong in catalog/manifest data and must not be copied into accounts. This is what lets art be replaced later without migrating every player.

Pet-5 must validate a save server-side: instance/name bounds, known Heart, ownership and band unlock for each source form, known slot/form IDs, exactly one body, legal `withBody` behavior, atomic side pairs, valid rear-child relationships, valid cosmetic IDs, recipe size, and a maximum saved-fusion count chosen as a storage/UI guardrail rather than an in-world sacrifice. A re-fusion flattens copied sources to the canonical `donorPetId/formKey/slot` tuples above.

When a fusion is equipped, Bond XP accrual and capstone checks target `account.pets[heartPetId]`; the fusion record has no Bond XP field. The run snapshot should carry `heartPetId`, resolved level/band/function, fusion instance ID, and the resolved current-band appearance recipe. Remote clients currently receive only canonical `petId` plus band, so pet-5 also needs a compact public appearance descriptor or recipe-table key for other players to render the fusion. An old client that cannot resolve it should show the canonical Heart pet, not drop the fusion record or reject the account.

## Cost and scope

| Work | Cost/risk | Boundary |
|---|---|---|
| Stable fusion recipe + resolver | Medium | Resolve donor/form/slot to the current manifest, flatten imports, enforce atomic/dependent groups, and teach texture loading to use each part's donor instead of the selected body pet. |
| Account migration, authority, and remote replication | Medium–large | New additive collection plus selection union, sanitization, compatibility fallback, server-owned save IDs, run snapshot, Bond receipt routing, and a compact public visual descriptor. Pet-5 notes that current local/offline V4 storage is not yet durable authenticated cross-device persistence, so that infrastructure remains a separate launch dependency. |
| Bondweave Studio UI | Medium | Two-parent picker, three band tabs, live assembly, A/B/empty slot cards, Heart card, naming, tint, keepsake, bounds warnings, save/edit/copy. No randomized outcome screen. |
| Existing art retrofit | Small–medium | The shipped 72 parts are already registered; add stable form-slot IDs/policies and optional neutral aura/keepsake layers. Legacy forms need not gain every new slot. |
| New pet/evolution art | Already charged to pet-1/2/4 | Every new form supplies registered independent cutouts once. **No pair-specific art.** A 24-pet roster would otherwise create 276 pairs and 828 pair-band compositions before branches. |
| Validation | Medium and automation-heavy | Contract tests for source resolution/dependencies, assembly bounds at gameplay scale, all-body socket checks, max-extent stress recipes, and sampled visual matrices. Do not promise hand review of every combinatorial result. |

The in-world economy cost defaults to zero: fusion consumes no pets, XP, parts, or currency. If ceremony is wanted later, use an unlock quest or studio arrival moment, not a repeat tax that discourages experimentation.

## Handoffs to the other four tracks

### Pet-1 — roster

For every base/evolution identity hook, label whether it is a detachable donor group or `withBody`. Favor donor-rich hooks—ears/horns, wings, tails, crowns, shells, flowers, lanterns, bells, halos, orbiters—without forcing core-bound silhouettes such as Walking Coffin, Hungry Boot, Moonmilk Ooze, or Manymoon Oracle to come apart. Function assignments may overlap freely; no fusion compatibility family is needed.

### Pet-2 — evolution and slot authority

Freeze stable `formKey` values and `PET_FORM_SLOTS_V1`; publish the exact legacy group mapping already proposed. Each band/branch recipe must identify slot group membership, paired cardinality, rear children, and `fusionPolicy: free | withBody`. Define same-band equivalents so a saved donor choice can seed the next-band fusion recipe without saving texture paths. Evolution owns what forms exist; fusion owns which unlocked form groups the player recombines.

### Pet-4 — art/generation pipeline

Emit donor identity, stable `formKey`, semantic form slot, parent/child group, and fusion policy in the generated manifest. Every `free` cutout needs the shared receiver contract, a hidden collar/overlap, correct plane/spring, and a closed receiving body underneath optional mass. Author neutral keepsakes and aura/orbit cards for safe accent tinting. Add automated assembly/bounds checks and a small adversarial body×part visual suite; never generate flattened art for a named parent pair.

### Pet-5 — systems/persistence

Own the additive `PersistedFusionPetV1` collection, opaque IDs, selection union, sanitizer/authority, donor unlock validation, recipe-count/size limits, flattened provenance, Heart-routed Bond XP, immutable run snapshot, remote appearance replication, and old-client fallback. Canonical `{ petId: { bondXp } }` rows stay the only mechanical progression source. Do not persist texture paths, coordinates, resolved numbers, nested parent IDs, or copied Bond XP.

## Owner decisions

No owner decision blocks this direction. Defaults are explicit: any two owned pets; same-band part unlocks but no family gate; non-consuming and zero repeat cost; new named fused identity; unlimited edits/re-fusion operations with only the number of simultaneously saved companions capped; one reversible full-strength parent Heart; restrained tint plus one statless keepsake; no bespoke pair art. The only later product tuning choice is the number of saved fusion slots, which changes storage/UI scale but not the model.

## Validation

- Static evidence pass confirmed 8 canonical pet IDs, 3 bands, 24 portal **form cards**, 72/72 installed loose parts, the shared three-slot compatibility layer, the richer socket frame, donor metadata, assembly behavior, and current account/selection shapes in the cited files.
- Programmatic manifest inspection confirmed that all 24 current pet-band bodies expose the same eight root socket IDs and that all 72 current parts carry a non-empty donor pet ID; no runtime or pairwise visual claim was inferred beyond that evidence.
- Report structure check: one 1am summary, concrete default rules, exact recombination groups, function resolution, expression controls, four example fusions, costs, all four track handoffs, account data, and non-blocking owner assumptions are present. The single TypeScript sketch fence is balanced.
- Scope check: `git status --short -- docs/design/pet-3-fusion.md` reports only this new report for this track. No product code, asset, catalog, generated file, test, or live service was changed or exercised.
