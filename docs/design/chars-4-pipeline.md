# Character Generation Pipeline (`chars-4-pipeline`)

## 1am summary

Replace wardrobe assembly with a controlled whole-character production line: each roster entry starts from its canonical concept, is generated with one locked occult-western house-style prompt plus a small character-specific identity slot, and is accepted only after a face-law, rig-readiness, palette, proportion, and cast-coherence review. The Drifter is produced and owner-approved first as the visual reference; every later character is prompted against that lock, with its unique head and body delivered as separate transparent layers that overlap without a neck so the existing head-bob rig and body animation work survive. Any visible face is an automatic rejection and regeneration, never a cleanup exception and never a shippable asset.

## Mandate and working assumptions

This report defines the prompt system and production method that turns the canonical roster, concealment law, and separated-head rig contract into reviewable generated character art. It plans only; it does not generate or modify product assets. Working assumptions pending repository verification: whole characters remain bespoke; heads are character-bound rather than interchangeable; the only art separation is head from body; and final acceptance requires human owner sign-off at the style-lock and character-identity gates.

## Verification log

### Reporting and scope

- `docs/sol-reports/README.md` requires a report-of-record to exist from the first action and to be updated throughout the run. This work order instead explicitly names `docs/design/chars-4-pipeline.md` and permits no other write, so this file is the report of record; no `docs/sol-reports/` duplicate is created.
- The worktree recognizes this report as a new untracked file. No product code, generated output, catalog, asset, test, or live process has been touched.

### Existing art generation idiom

- `tools/artkit/README.md` describes a two-phase, Codex-driven pipeline: canonical subject data plus a project style produces multiple `identity-ref` candidates; a human promotes one candidate; later generation uses that approved image as the identity lock. The documented DD alpha workflow deliberately asks for a pure `#00ff00` field and chroma-keys it, rather than trusting model-produced transparency.
- `tools/artkit/orchestrate.mjs` implements the resumable `canonical source -> candidate generation -> promoted identity-ref -> downstream generation` flow. It skips existing artifacts, supports `--only`, uses bounded parallelism, and attaches approved style references. Its current general character anchor pool includes the Drifter and other approved characters, although it randomly samples one or two anchors; this report will tighten that strategy for a locked cast.
- `tools/artkit/lib/prompts.mjs` centralizes a shared style-canon block, chat-isolation law, reference-image semantics, subject/palette slots, hard render rules, and feedback folded into a subsequent attempt. It explicitly calls reference-image generation the strongest consistency lever and separates “style/build only” anchors from subject identity.
- `tools/artkit/lib/codex.mjs` gives every generation its own Codex home/chat to prevent cross-subject visual contamination, attaches reference images, harvests generated PNGs, keeps logs, cleans successful chat homes, and reaps child processes. This is reusable production infrastructure, not a reason to invent a second generator.
- `tools/artkit/gen-character-concepts.mjs` is the closest existing character path. It attaches real sprite-part references, issues literal rig/style laws, creates resumable per-concept renders, retries up to three times, and writes an owner contact sheet. It is obsolete in one important respect: it asks for a fused head and was built for the abandoned blank wardrobe mannequin. The new whole-character path should retain its isolation, references, retry, and sheet idioms while replacing that art contract with a unique separated head/body pair.
- `tools/artkit/gen-particle-packs.mjs` demonstrates the established generated-art “gen then deterministic check/transform” half: raw Codex render, green-key/despill, connected-component validation, fixed-cell packaging, and manifest emission. `tools/artkit/lib/emit.mjs` separately provides write-or-check synchronization for canonical generated code. Character generation should likewise retain raw attempts and machine-verifiable geometry/alpha metadata before human acceptance.
- `tools/artkit/gen-character-roster.mjs` proves the roster is generated from installed character manifests plus canonical names, and enforces a deliberate kit for every playable id. It also computes normalized footprint and caps compensating scale at `1.25`; this is a downstream correction, not permission for generation-time proportion drift.

### Canonical roster and concept data

- `data/character-concepts.json` was read in full. It declares and contains **50** records with `name`, `archetype`, `theme`, `palette`, `artBrief`, and `flavor`; it does not contain ids. `tools/artkit/subjects.concepts.json` supplies slugged `cc-*` ids for those concepts, but is a broader 164-subject art manifest rather than playable truth.
- `packages/shared/src/characters.ts` contains exactly **40** playable ids: `drifter` plus 39 promoted `cc-*` concepts. All 40 stat spreads sum to 10. `data/character-concepts.json` has no Drifter record, so the Drifter needs an explicit owner-authored generation job rather than a fabricated lookup. The 11 rich concepts not in the playable roster are Greta Ironbraid, Hrothgar Snowfang, Skitch Wren, Vesper Lux, Vellichor the Ash-Robed, Old Quill Grathmar, Old Gen, Snarekeeper Vossel, Doctor Quillane, Warden Ashlock, and Snarlfang; they must not leak into this queue unless the roster track explicitly promotes one.
- `packages/shared/src/character-classes.ts` treats old class buckets as non-gating lineage metadata. Its quirk table currently contains 8 `active` rows including the unused `none` row, 1 `partial` row, and 32 `inert` rows; therefore concept art may use a quirk as identity flavor, but the production prompt must not promise an inert mechanic visually or mechanically.
- Many source briefs conflict with the new law and cannot be interpolated literally. Examples include Corvane's exposed profile and eye, Mawkin's eye/warts/stitched grin, Veyra's raised visor, Tendo's bare head, held weapons/props, emitted smoke/fire, and blowing cloth. The compilation step must preserve identity/material/palette while explicitly resolving those conflicts under face, rig, empty-hand, neutral-pose, and no-baked-VFX laws.
- The current roster track (`docs/design/chars-1-roster.md`) recommends a **32-character** production roster (Drifter plus 31) and names eight cuts. Volume estimates below use `N = 32`, while retaining a formula for an owner decision to keep all 40.

### Existing rig and output constraints

- `packages/client/src/entities/SpriteRig.ts` normalizes the body to **76 px** on screen and already drives a distinct head with a bounded spring: `8.4 rad/s`, damping `0.48`, at most `4 px` in each axis, at most `72 px/s`, `1.15 px` walk bob, dash/slide lag, air hang, landing dip, and attack lead. Final head synchronization happens after body/combo presentation, so approved combo, hand placement, and tumble work can remain body-owned.
- `packages/client/src/sprites/gear-parts.ts` defines the verified fallback `HEAD_MOUNT_SCALE = 0.85`; `SpriteRig.syncBoilerplateHeadPose()` multiplies final body scale by that value. The current source frame is `1024x1024`, body-height unit is `512`, body root is `(512,512)`, and the head socket is `(xL=0, yL=-0.38)` / raw `(512,317.44)` in `tools/artkit/out/gear/gear-parts-manifest.json`.
- The abandoned gear generator contains the predecessor proportion baseline, but the completed head-rig handoff now supersedes it for new art: normalized body unit `B`, fixed socket `(0,-0.38B)`, head pivot target `(u=.50,v=.55)`, mounted head height `0.44-0.48B`, mounted head width `0.70-0.77` of shoulder/torso width, torso W:H `0.90-1.00`, and resting overlap `0.16-0.20B` with a worst-case `0.10B` vertical / `45%` lower-head-width overlap.
- A critical implementation gap is verified in `tools/artkit/guards/slice.mjs`: its current character classifier assumes the largest component is a body with the head already fused, then classifies every other component above the lower body edge as a hand. A new separated head would be mislabeled. The successor path needs a versioned playable-character-v2 classifier (central component above the torso = head, lateral components = hands, lower components = feet) or fixed guide regions; silently reusing the old classifier is not viable.
- The generated raw plate still needs the existing detached hands and feet because procedural hand/foot movement survives. “Only the head is separated” means the head is the only **new character-identity separation** and the only retained wardrobe-like boundary; it does not fuse away the already-approved procedural hand/foot rig.
- `tools/artkit/guards/chroma-key.mjs` is the pinned alpha method and emits both transparent `.keyed.png` and charcoal review previews. `guards/contact-sheet.mjs` emits labeled, flattened owner review sheets. `gen-outlines.mjs` supplies a deterministic `#101014` exterior rim with a base radius of 4 px at a 512 px canvas scale. `check-assets.mjs` verifies every sprite-manifest file and atlas frame exists, but it does not inspect faces, proportions, or head separation; those require new gates below.

### Neighbor-track handoffs consumed so far

- `docs/design/chars-2-facelaw.md` supplies the binding 32-id concealment map and literal face-law block. Its strict semantic rule is no biological face; semi-transparent/smoke/light treatments require an independent opaque backstop, and every treatment must survive the full `±4 px` head motion, all body presentation states, mirror, and pale roll tint.
- `docs/design/chars-3-headrig.md` freezes the successor geometry and exact prompt suffix: a `1920x1080` exploded green-field plate, six islands, at least `0.08B_source` key clearance, fixed normalized socket, `0.85` mount, `0.18B` target overlap, closed shoulder roof, and no daylight at any 3x3 spring extreme. It retains the existing follower while removing alternative-head/loadout selection.
- `docs/design/chars-5-migration.md` confirms art activation must follow a new character-owned identity path and wardrobe-mechanics neutralization; deleting current catalogs first would break persistence/server resolution. Generated art can be produced earlier, but cannot be made the runtime default out of sequence.

## Concrete production plan: canonical source -> gen -> check -> promote

The implementation should extend `tools/artkit/` rather than create an unrelated image script. Names below are proposed so an implementation Sol can build the path without guessing.

### 1. Freeze machine-readable inputs

Create one small, owner-reviewable `data/character-art-plan.json` keyed by playable id. It is the decision layer that the current sources lack, not a replacement for them. Every retained row contains:

```json
{
  "id": "cc-kuro-oni-the-demon-mask",
  "sourceConcept": "Kuro-Oni, the Demon Mask",
  "productionRank": 2,
  "identityRead": "immovable temple enforcer",
  "silhouetteRead": "top-heavy lamellar body; horned mask",
  "concealment": {
    "mode": "rigid-mask-over-void",
    "positive": "sealed horned oni mask backed by opaque charcoal void",
    "forbidden": "no skin or biological eyes through the slits"
  },
  "palette": ["#101014", "#22252B", "#3A4049", "#9E3B36", "#C49A5A"],
  "sourceConflictsRemoved": ["held tetsubo", "bared biological mouth"]
}
```

This table consumes the roster selection from chars-1, the per-id concealment solution from chars-2, and the geometry version from chars-3. It must fail closed: an active id without a row, an unpromoted concept accidentally included, a missing face treatment, an unfrozen palette, or an unresolved source conflict stops compilation.

Keep the shared prompt in a versioned `tools/artkit/style.characters-v1.json`, beside the existing `style.json`. Add a strict `gen-character-jobs.mjs` analogous to `gen-weapon-expansion.mjs`: read the roster + concept JSON + art plan, list **all** authoring errors, and emit/check `tools/artkit/character-jobs.generated.json`. Never hand-edit that generated job file.

An approval ledger such as `data/character-art-approvals.json` records `{id, selectedAttempt, promptSha256, referenceSha256s, reviewer, ownerApprovedAt, notes}`. It follows `weapon-vfx-overrides.json`'s useful rule: human decisions merge **after** generation and can never be clobbered by a re-bake. Generated PNG existence is not approval.

### 2. Generate isolated attempts

Add a resumable `gen-character-art.mjs --only=<id> [--force-attempt=<n>]` using the existing `configureCodex()` / `runCodexExec()` wrapper. Each attempt:

1. Concatenates the byte-identical house preamble below with the generated per-character block.
2. Attaches the fixed reference bundle; never randomly samples the current `CHAR_ANCHORS` pool.
3. Runs in a fresh isolated chat and asks for exactly **one** image. Three candidates therefore mean three independent calls, avoiding multi-image harvest ambiguity and cross-attempt visual contamination.
4. Writes immutable provenance under `tools/artkit/out/characters-v2/<id>/attempt-01/`: `prompt.txt`, `prompt.sha256`, `references.json` with hashes, `codex.log`, `raw.png`, generator/model metadata when available, and later gate results.
5. Skips complete attempts on rerun. A revision opens a new attempt and appends the precise rejection note through the existing feedback-block idiom; it never overwrites a rejected raw.

The current wrapper exposes no image seed. Accordingly, the production lock is the exact prompt + exact reference hashes + isolated chat, not a fictitious deterministic seed. Record `seed: null` today; if a future Codex surface exposes a provider seed, store it as provenance and reuse it for controlled revisions, but do not make reproducibility depend on it.

### 3. Produce transparent, role-labelled parts

The model generates one coherent **1024x1024** source plate on exact `#00ff00`, matching the current gear source frame and the proven chroma workflow. It shows six pieces from the same character in fixed guide regions: one head, one torso/body card, two existing procedural hand blobs, and two existing procedural feet. The source head floats above the body with a clean green gap so the pieces can be recovered; a compositor then mounts it at the head socket with the authored overlap. This is still one whole-character prompt and one identity, not six independently generated costume parts.

Run the pinned chroma key/despill, then a new `playable-character-v2` slicing mode. It identifies the central-above-body component as `head`, lateral middle components as hands, and lower components as feet; it rejects rather than guesses when roles are ambiguous. All decorations must be alpha-connected to their owning part (horns to head, coat tails to body, cuffs to hands), so halos, smoke, loose charms, and VFX cannot become stray seventh components.

Deliver role files with real alpha—`head.png`, `body.png`, `hand-l.png`, `hand-r.png`, `foot-l.png`, `foot-r.png`—plus source-centroid offsets/pivots. Run the existing deterministic `#101014` outline pass after slicing, pack only after promotion, and retain the original raw/keyed plate for audit.

### 4. Check before a human sees it

Machine gates should emit one JSON verdict per attempt and a labeled preview, but must never auto-promote art:

- exact square source, decodable PNG, uniform opaque green field at all four corners, no checkerboard/fake alpha, and successful despill;
- exactly six semantic components at or above the existing `0.05%` minimum-area floor, with no unexplained seventh component or loose particle;
- head/body/hands/feet in their guide regions; all alpha bounds inside the safe canvas envelope; no clipped silhouette;
- closed head bottom and closed body/shoulder top, no neck, connector peg, cropped-open surface, or transparent hole in either part;
- chars-3 proportion bands and socket metadata pass; until superseded, use the verified core targets `0.92-1.00` torso W:H, `0.82-0.90` core-head:torso width, `0.36-0.39` head-zone share, and `8-12%` vertical head/body overlap in the rest composite. Costume extensions may exceed the core outline only inside the fixed total-head envelope (current normalization allows up to `1.35x` base width);
- at mounted `0.85` head scale and 76 px body height, render rest, mirror, pale roll tint, and a 3x3 `x/y = -4, 0, +4 px` motion strip. No pose may reveal a neck/cut seam or make the head read as another character;
- palette clustering excludes alpha-edge blends and the deterministic outline, allows only the row's swatches plus standardized one-band shadow/one highlight, limits meaningful clusters to 4-6, and flags if less than 90% of opaque interior pixels fall within a tolerant color-distance band. Palette checking is a rejection/inspection signal, never an automatic recolor that conceals drift;
- no baked floor, ground/contact shadow, held weapon/prop, radiating light, particles, smoke, or motion trail.

`check-assets.mjs` and atlas checks remain the final installation gates, not substitutes for these generation gates.

### 5. Review and promote

For each mechanically valid attempt, build one review card containing: raw plate; transparent parts; rest composite; 76 px gameplay composite; grayscale silhouette; palette swatches and measured clusters; left/right mirror; nine head extremes; pale roll tint; the concept text; the exact concealment law; and the reference trio. Build a batch contact sheet from those cards using the existing flattened-review idiom.

Promotion states are explicit: `generated -> mechanical-pass -> art-review-pass -> owner-approved -> installed`. A failed attempt remains in the ledger with a reason code such as `FACE_LEAK`, `HEAD_NOT_SEPARABLE`, `OFF_PALETTE`, `CAMERA_DRIFT`, or `PROPORTION_DRIFT`. Copy/install only an owner-approved winner whose prompt and reference hashes still match the approval record.

## Locked house-style preamble

This is the invariant text injected byte-for-byte before every retained character. The raw green field is intentional: the **delivered** role PNGs are transparent, produced by the repository's tested keyer rather than by trusting model alpha.

```text
# DIMENSION DRIFTERS PLAYABLE CHARACTER RIG SOURCE — HOUSE STYLE V1 — LOCKED

Generate exactly ONE original, character-owned 1024x1024 raster rig source plate for the single entity named in CHARACTER JOB below. This is one coherent whole-character design shown as its animation-ready pieces, not a wardrobe kit, costume catalogue, portrait, sprite sheet, scene, or collection of alternate characters.

REFERENCE LAW
The attached approved images govern rendering, camera, contour weight, body grammar, head scale, and part layout. Match those axes exactly. They do not grant permission to copy another character's clothes, palette, headwear, or motifs. The CHARACTER JOB governs identity. If a source concept conflicts with this locked block, this locked block wins.

CAMERA AND GAME READ
Use the game's shallow high three-quarter/top-down arena view while the character semantically faces screen-right: mostly side-profile for instant combat readability, with only a small consistent view of top planes on hat, shoulders, hands, and feet. Never face the viewer. Never use a low camera, frontal portrait, deep perspective, foreshortening, or isometric view. Neutral upright planted idle only, weight on both feet; no run, lunge, crouch, jump, attack, recoil, dramatic twist, or gesture.

HOUSE SILHOUETTE AND RIG GRAMMAR
Use the same no-neck little-figure species as the approved Drifter: a compact rounded squat torso/body card with no waist and no realistic anatomy; one large character-specific head; two detached simple mitten/bean hand blobs; two detached chunky foot blobs. No painted arms, full legs, fingers, thumbs, knuckles, or anatomical joints.

Render exactly SIX semantic art islands in the attached guide regions: HEAD, BODY, LEFT HAND, RIGHT HAND, LEFT FOOT, RIGHT FOOT. Every costume feature belongs to and physically touches its owning island. No loose seventh component. Keep clear pure-green source gaps between all six islands so deterministic slicing can recover them.

The HEAD is unique to this character and never interchangeable. Draw it as a complete closed shape with a fully painted lower edge. Draw the BODY as a complete closed shoulder/collar shape with a fully painted upper edge. Absolutely no neck, throat, skin cylinder, connector post, collar peg, cut-open seam, or head-sized hole. The source plate shows a green gap for slicing; the game mounts the head at 0.85 scale so its lower edge overlaps the body's upper edge by 8-12% and can bob by ±4 gameplay pixels. Both closed silhouettes must still look intentional if that bob briefly opens space between them.

Keep core proportions locked to the guide: torso width:height 0.92-1.00; shoulder:hip width 0.95-1.05; core head width 0.82-0.90 of torso width; head zone 0.36-0.39 of assembled head-plus-body height. Costume identity may extend within the guide envelope, but may not replace the shared underlying body grammar.

HARD FACE LAW — ZERO TOLERANCE
The biological face zone is unavailable canvas. Cover it edge-to-edge with the opaque concealment treatment named in CHARACTER JOB. The treatment must be self-contained on the head and remain complete without a hand, weapon, prop, body pose, VFX, lighting trick, or camera crop. A dark void must be solid matte near-black; a mask/helm/veil must be opaque material backed by solid darkness. Abstract painted slits, sigils, or inanimate mask fangs are permitted only when the job explicitly names them and they reveal no anatomy.

Never draw visible facial skin or a biological eye, eye white, iris, pupil, eyelid, eyelash, eyebrow, nose bridge, nose, nostril, cheek, lips, mouth, teeth, tongue, jaw, beard, moustache, expression, or facial contour beneath shadow. No half-mask, open or raised visor, transparent/translucent veil, eye cutout showing an eye, mouth opening, lifted brim with a readable face, rim light revealing a profile, or shadow with facial details inside it. A beautiful render that leaks any face is wrong.

RENDERING
Grim occult-western dark-comic tone: gallows dust, grave iron, brimstone wear, battered cloth, tarnished metal, carved bone. Original HD 2D paper-cutout/Flash-era arena art with bold chunky readable shapes, heavy grimy ink, and a slightly imperfect hand-painted feel. One uniform near-black exterior contour, visually equivalent to #101014 at the approved reference weight; simple interior marks only. Flat cel rendering only: one base tone plus ONE hard shadow band and AT MOST ONE hard highlight per material. Matte surfaces, decisive shapes, a few edge nicks. No gradients, airbrush, ambient occlusion, photoreal texture, 3D render, soft anime shading, vector-clean clipart, pixel art, toy/mascot finish, or detail denser than the Drifter.

Use 4-6 meaningful colors from the exact CHARACTER JOB palette, plus antialiasing. The fixed outline and void are #101014 and #22252B. Use at most one bright/neon accent and draw it as a flat solid color with no bloom or cast light. Do not invent off-palette hues.

TRANSPARENT-BACKGROUND DELIVERY CONTRACT
The raw plate must use a perfectly flat, fully opaque, exact #00ff00 field for every non-art pixel, right up to every edge. No gradient, texture, lighting variation, checkerboard, fake transparency, floor, ground oval, contact/cast shadow, reflection, frame, border, caption, label, logo, signature, UI, or watermark. Never use #00ff00 or near-key green in the character. Downstream chroma-key/despill produces the required true-transparent head/body/hand/foot PNGs.

EMPTY AND EFFECT-FREE
Hands are empty. Do not draw any held weapon, shield, staff, book, card, bottle, tool, talisman, spell, or prop; the game equips weapons and places hands procedurally. No aura, smoke, steam, fire, sparks, lightning, particles, floating glyphs, orbiting objects, dust trail, motion trail, glow cloud, or baked runtime VFX. Worn holsters, closed pouches, attached scabbards, and body-connected costume motifs are allowed only when the CHARACTER JOB names them.

FINAL SELF-CHECK BEFORE RETURNING
One character; one 1024x1024 PNG; exact green field; exactly six separated, unclipped, role-readable islands; coherent matching costume across every part; right-facing shallow top-down read; neutral planted pose; no neck; closed head and body edges; rig proportions; 4-6 exact colors; flat cel; empty hands; no prop/VFX/ground/text; and absolutely no visible biological face or facial feature. If any item fails, correct it before returning the single image.
```

## Per-character prompt template

`gen-character-jobs.mjs` fills this block from the art plan. Bracketed text is data, not prose that the generation operator improvises.

```text
# CHARACTER JOB
ID: [playable id]
NAME: [display name]
ARCHETYPE READ: [one short player-fantasy phrase]
IDENTITY NORTH STAR: [one sentence: what must read at 76 px]

BODY/SILHOUETTE: [torso mass, garment/material blocking, one signature body motif; neutral and empty-handed]
HEAD SILHOUETTE: [unique head mass, attached adornment, closed lower edge]
FACE CONCEALMENT — POSITIVE: [exact opaque treatment and what the face zone contains]
FACE CONCEALMENT — CHARACTER-SPECIFIC FORBIDDEN: [ways this concept is likely to leak]

EXACT PALETTE — no substitutions:
- outline: #101014
- void/deep shadow: #22252B
- [material swatch 1]
- [material swatch 2]
- [identity accent]
- [optional sixth color]

MATERIALS: [2-4 concise materials]
CONCEPT DETAILS TO KEEP: [identity motifs retained from canonical source]
SOURCE CONFLICTS REMOVED: [visible-face phrases, held props, anatomy, VFX, dynamic cloth/pose]
QUIRK FLAVOR, NOT A MECHANIC PROMISE: [optional visual mood only]

The result must read first as [short silhouette phrase], second as a member of the exact same cast as the approved references.
```

## Three literal example prompts

Each production stdin payload is the exact locked preamble above followed immediately by exactly one block below. There is no hidden rewriting. During Drifter calibration, the references are the current legacy Drifter composite plus the chars-3 geometry guide. For Kuro-Oni and Iridia, Image 1 becomes the approved new Drifter. After all three are approved, their fixed, hash-pinned cast board is attached to every remaining roster job.

### Example 1 — The Drifter

```text
# CHARACTER JOB
ID: drifter
NAME: The Drifter
ARCHETYPE READ: shadow-faced occult-western road ghost
IDENTITY NORTH STAR: At 76 px, read instantly as a battered low-brim hat over a completely black face void, above a lean dust-worn duster body.

BODY/SILHOUETTE: Compact rounded torso under a weathered tan duster that hugs the body and ends in two short body-connected angular coat tails; a small faded-indigo shirt block, oxblood belt and closed holster, and bone-dust edge wear. Keep both mitten hands empty and relaxed in their guide regions; the holster is worn and closed, never held.
HEAD SILHOUETTE: Oversized battered slouch hat with a low wide diagonal brim and a wrapped high cowl beneath it; hat, cowl, and enclosed void form one alpha-connected head island with a complete rounded lower edge.
FACE CONCEALMENT — POSITIVE: The brim and high cowl enclose the entire face zone as one solid matte #22252B void. No eye dots; the darkness itself is the face treatment.
FACE CONCEALMENT — CHARACTER-SPECIFIC FORBIDDEN: Do not lift the brim, light the profile, show skin between brim and cowl, draw an eye glint, nose, mouth, stubble, beard, or bandana-shaped facial contour inside the void.

EXACT PALETTE — no substitutions:
- outline: #101014
- void/deep shadow: #22252B
- weathered duster tan: #C49A5A
- bone-dust highlight: #CFC6AE
- faded indigo cloth: #4E5C73
- oxblood leather: #A8482E

MATERIALS: cracked matte leather, sun-faded cotton, alkali-dusted paper-cut cloth, dull iron hardware
CONCEPT DETAILS TO KEEP: low slouch brim, duster, closed holster, secondhand trail wear, quiet upright posture
SOURCE CONFLICTS REMOVED: no held revolver, no visible face, no wind-blown long coat, no dust cloud
QUIRK FLAVOR, NOT A MECHANIC PROMISE: Unwritten — visually plain enough to feel like the cast's baseline, never generic enough to lose the road-ghost identity.

The result must read first as “shadow under a battered western brim,” second as a member of the exact same cast as the approved references.
```

### Example 2 — Kuro-Oni, the Demon Mask

```text
# CHARACTER JOB
ID: cc-kuro-oni-the-demon-mask
NAME: Kuro-Oni, the Demon Mask
ARCHETYPE READ: immovable oni-masked temple enforcer
IDENTITY NORTH STAR: At 76 px, read as a broad black-iron lamellar body crowned by one horned crimson demon mask, with brass studs as the only warm sparkle.

BODY/SILHOUETTE: Top-heavy compact torso broadened by two alpha-connected blackened-iron lamellar shoulder masses over an oxblood-lacquer body shell; thick empty gauntlet blobs and planted armored foot blobs. Keep the center clean and bold; no club.
HEAD SILHOUETTE: One large sealed crimson oni mask with two attached swept horns and attached black hood backing. The mask, horns, hood, and brass mask-fangs are one alpha-connected head island with a closed lower edge; the horns may extend within the fixed head envelope.
FACE CONCEALMENT — POSITIVE: A fully rigid opaque demon mask backed everywhere by a solid #22252B void. Narrow eye slits are painted dark shapes, not holes. Brass fangs are sculpted inanimate mask ornaments, not biological teeth.
FACE CONCEALMENT — CHARACTER-SPECIFIC FORBIDDEN: No human skin around mask edges, no eyes inside slits, no open mouth, tongue, gums, biological teeth, cheek, jaw, beard, or mask lifted/turned aside.

EXACT PALETTE — no substitutions:
- outline: #101014
- void/deep shadow: #22252B
- blackened iron: #3A4049
- oxblood/crimson lacquer: #9E3B36
- tarnished brass: #C49A5A

MATERIALS: matte blackened iron, chipped oxblood lacquer, tarnished brass studs, soot-dark cloth
CONCEPT DETAILS TO KEEP: massive temple-wall stance, lamellar shoulders, horned oni mask, brass studs and sculpted mask-fangs
SOURCE CONFLICTS REMOVED: no held tetsubo, no action pose, no exposed wearer, no VFX
QUIRK FLAVOR, NOT A MECHANIC PROMISE: Temple Wall — planted and unyielding in silhouette.

The result must read first as “horned crimson mask over a temple wall,” second as a member of the exact same cast as the approved references.
```

### Example 3 — Iridia of the Nine Veils

```text
# CHARACTER JOB
ID: cc-iridia-of-the-nine-veils
NAME: Iridia of the Nine Veils
ARCHETYPE READ: occult astral seer hidden behind ritual cloth
IDENTITY NORTH STAR: At 76 px, read as a serene indigo bell body beneath a layered veiled head and thin attached gold halo, with one small violet sigil accent.

BODY/SILHOUETTE: Compact rounded torso wrapped in stacked indigo and midnight cloth bands that hug the body and end in a clean bell hem; pale-gold star-leaf marks are sparse and large. Two empty covered mitten hands hover open but neutral in their guide regions; no constellation or spell between them.
HEAD SILHOUETTE: A deep indigo cowl wrapped by overlapping opaque silver-white ritual blindfold and veil bands, suggesting nine layers without nine loose pieces. A thin pale-gold halo ring touches and is structurally attached to the veil crown at two points so the whole head remains one island. Closed dark lower edge, no neck.
FACE CONCEALMENT — POSITIVE: Beneath the cowl is a solid #22252B void; opaque blindfold and veil bands cover the full face zone edge-to-edge. One small flat arc-violet sigil may be painted on the blindfold, with no glow.
FACE CONCEALMENT — CHARACTER-SPECIFIC FORBIDDEN: No transparent gauze, skin through cloth, eye under/above the blindfold, nose ridge, lips, readable profile, face-shaped lighting, lifted veil, or separate floating veil/halo component.

EXACT PALETTE — no substitutions:
- outline: #101014
- void/deep shadow: #22252B
- deep indigo cloth: #30345E
- silver-white veil: #E8E4D8
- pale-gold leaf and halo: #C49A5A
- flat sigil accent: #B14BFF

MATERIALS: matte heavy ritual cloth, chalky opaque veil fabric, worn gold leaf
CONCEPT DETAILS TO KEEP: layered veils, seer serenity, attached halo, sparse star-leaf, indigo/pale-gold contrast
SOURCE CONFLICTS REMOVED: no orbiting constellation, no aura, no floating cloth pieces, no transparent veil, no glow, no wind-blown trails
QUIRK FLAVOR, NOT A MECHANIC PROMISE: Sees Every Future — still, remote, and unreadable rather than expressive.

The result must read first as “veiled indigo seer under a gold ring,” second as a member of the exact same cast as the approved references.
```

## Coherence strategy: prevent “32 different games”

### Style-lock calibration

1. **Drifter lock:** generate four isolated Drifter attempts against the current legacy Drifter art and the chars-3 geometry guide. Mechanical/face gates remove invalid takes. The owner selects or rejects the survivors. The selected transparent parts, rest composite, 76 px composite, palette, prompt hash, and reference hashes become `DRIFTER_STYLE_LOCK_V1`.
2. **Range anchors:** generate Kuro-Oni and Iridia against that exact lock. They deliberately stress opposite ends of the roster—wide armored mass and light veiled caster—without changing the preamble or camera. The owner approves both beside Drifter, not individually in a vacuum.
3. **Fixed cast reference:** create one flattened cast board from the three approved composites. Hash-pin Drifter parts, the geometry guide, and this board as `CHARACTER_REFERENCE_BUNDLE_V1`. Every remaining character receives the same bundle in the same order. Do not use `orchestrate.mjs`'s current random one-or-two-character sampling for this fleet.
4. **Version discipline:** pin the image model/version when the surface reports it. The house preamble, geometry guide, reference bundle, keyer settings, slicer version, and outline settings are a single style version. Changing any binding input bumps the version and invalidates unapproved attempts; changing the visual lock after promotion requires a roster-board regression review, not silent mixed-version output.

This approach uses the Drifter as the north star but avoids turning every character into a duster clone: the stable three-character board teaches the allowed breadth, while each job supplies only identity, exact palette, and concealment.

### Palette discipline

Every job receives exact hex swatches, never an adjective-only palette. The shared pool remains the current DD palette (`#22252B`, `#3A4049`, `#5A6472`, `#E8E4D8`, `#CFC6AE`, `#A8482E`, `#C49A5A`, `#6E7042`, `#9E3B36`, `#3C6E6A`, plus the five existing neon accents), with fixed `#101014` outline. A concept-specific hue outside that pool is allowed only as one explicit, owner-approved identity swatch in `character-art-plan.json`; it is then just as binding as a house swatch. This preserves identities such as faded indigo or jade without letting the model improvise an unrelated rainbow.

Use 4-6 meaningful colors per character, at most one neon accent, and the same value hierarchy: outline/void darkest; material shadows dark; body midtones subdued; one small accent highest. A whole-roster palette board is reviewed after each batch so near-duplicates can be caught before all 32 are rendered.

### Proportion and camera discipline

The attached geometry guide, not prose alone, fixes source regions, body mass, head socket, overlap, and shallow top-down camera. Every candidate is measured against the same guide before subjective review. Distinction comes from outer costume/head silhouette inside the envelope—not a different anatomy system, line language, camera, or detail density. The 76 px and grayscale views are binding evidence: a character that works only as a 1024 px illustration does not work in this game.

## Face law at generation and review time

Reliable concealment uses **positive construction plus exhaustive negatives**. “No face” by itself is too weak. Every prompt therefore says what opaque material fills the face zone, what solid darkness backs it, that the coverage is intrinsic to the head, and that no opening exposes anatomy. It then enumerates the common leaks: skin, biological eyes, nose bridge/nostrils, cheeks, lips/mouth/teeth, jaw, facial hair, expression, transparent cloth, half-mask, open visor, rim-lit profile, and moving-prop coverage.

The per-character line is equally important. For Kuro-Oni, for example, “narrow slits are painted dark shapes, not holes” is more reliable than merely forbidding eyes. For Iridia, “opaque blindfold and veil over a solid void” defeats the model's tendency to render gauze with a pretty face beneath it. For the Drifter, “no eye dots; darkness itself is the treatment” preserves the original north star.

Face review is never delegated to generic face-detection automation; stylized faces, masks, and eye slits make false negatives inevitable. An optional second isolated vision audit may flag suspicious regions, but a human reviews the head at source size, 76 px, mirror, pale roll tint, and all nine spring extremes. If any reviewer can identify or reasonably infer biological anatomy, mark `FACE_LEAK`, reject the entire attempt, and generate a fresh attempt with the exact leak named in feedback. Do not paint it over, crop it away, hide it with runtime VFX, approve it as “barely visible,” or ship it provisionally.

## Generation review checklist (the release gate)

The review card and approval ledger must make every box answerable from retained evidence.

### Provenance and source

- [ ] Id is in the chars-1 production roster and maps to exactly one canonical concept, or to the explicit Drifter job.
- [ ] Prompt hash, house-style version, geometry version, model metadata, and every attached reference hash are recorded.
- [ ] Character art-plan row contains an exact palette, a positive concealment construction, character-specific forbidden leaks, and explicit source-conflict removals.
- [ ] Attempt is new/immutable; it did not overwrite a previous rejection.

### Mechanical output

- [ ] Raw is one decodable 1024x1024 PNG on uniform exact `#00ff00`; final role files have true alpha and clean despilled edges.
- [ ] Exactly six intended semantic islands are recovered and labeled correctly: head, body, two hands, two feet. Nothing is clipped; no stray ornament, prop, shadow, or VFX becomes another part.
- [ ] Head lower edge and body upper edge are independently closed and painted. There is no neck, peg, socket art, cut-open seam, or transparent head hole.
- [ ] Core proportion, safe-envelope, pivot, socket, head-scale, and rest-overlap measurements pass the current chars-3 geometry version.
- [ ] At 76 px body height and 0.85 head mount scale, rest, mirror, roll tint, and all nine ±4 px head positions remain intentional; body animation/hand positions are unobstructed.

### Hard face law

- [ ] The entire biological face zone is covered edge-to-edge by the assigned opaque treatment and solid backing void.
- [ ] At 200% source inspection there is no facial skin, eye/eye-white/iris/pupil, lid/brow/lash, nose/nostril, cheek, lip/mouth/biological tooth/tongue, jaw, facial hair, or expression.
- [ ] Mask/helm/veil openings are painted/opaque or backed by featureless darkness; no anatomy is visible or implied through them.
- [ ] Concealment is part of the head itself and does not depend on a hand, weapon, prop, pose, crop, shadow direction, VFX, or another body layer.
- [ ] Mirror, pale roll tint, and every head-bob extreme reveal no face. Any doubt is a failure and regeneration.

### House style and identity

- [ ] Shallow top-down/right-facing camera matches the reference board; neutral planted pose, compact no-waist body, and detached blob hands/feet match the cast grammar.
- [ ] Exterior contour is consistent `#101014` weight; interior linework is sparse; rendering uses flat base + one hard shadow + at most one hard highlight per material.
- [ ] Measured palette is on the exact job swatches within tolerance, 4-6 meaningful colors, no invented hue, and at most one small bright accent.
- [ ] No baked floor/contact shadow, held object, runtime VFX, gradient, soft rendering, photoreal/3D/anime/pixel treatment, text, or watermark.
- [ ] At 76 px and in grayscale, the character still reads as the job's named silhouette and is not confusable with an already approved roster neighbor.
- [ ] Beside the fixed three-anchor board, the candidate looks drawn for the same game—not merely “good art” in isolation.

### Promotion

- [ ] Mechanical gate JSON is green and linked on the review card.
- [ ] Human art reviewer signs the face, rig, palette, and identity verdict; rejection reasons are written, not implicit.
- [ ] Owner approves the promoted winner on a batch sheet.
- [ ] Approval hash still matches the candidate copied to install; atlas/manifest generation and `assets:check` pass after installation.

## Volume, iteration, and production order

Use three single-image attempts per character, except four for the Drifter style lock. Initial call count is therefore `3N + 1`: **97 calls for the chars-1 recommendation of 32**, or **121 calls if all 40 remain**. Budget another 0.75-1.5 attempts per character for face leaks, separation mistakes, and style/palette drift: approximately **121-145 total calls for 32**, or **151-181 for 40**. This is a planning range, not a promise that attractive but illegal faces will be waved through to hit a quota.

At roughly 2-6 machine minutes per isolated generation, the 32-character plan is about 4-15 serial machine-hours before queue/rate-limit delays; bounded lanes can reduce wall time, but Drifter and the two range anchors are deliberately sequential because each freezes the next reference stage. Human preparation and review is the real cost: approximately 10-15 minutes to normalize each concept/job, 8-12 minutes to compare candidates, and 8-15 minutes for face/rig/gameplay evidence and ledger work. Expect **14-22 human production hours for 32**, plus **2-4 hours for style-lock and final cast reviews**. The one-time implementation of the compiler, v2 slicer, geometry/palette gates, review-card builder, and approval/install path is roughly **3-5 engineering days** before fleet production begins.

Recommended order:

1. Freeze chars-1 roster/order, chars-2 concealment table, and chars-3 geometry guide. Compile all jobs; zero missing/error rows is the entry gate.
2. Generate four Drifters, pass gates, and obtain owner sign-off on `DRIFTER_STYLE_LOCK_V1`.
3. Generate Kuro-Oni and Iridia; obtain owner sign-off on the three-character breadth board and freeze `CHARACTER_REFERENCE_BUNDLE_V1`.
4. Finish an eight-character stress pilot by adding The Hollow Mask (flat mask), Cinderpyre (non-human), Bastion Vance (wide armor), Neon Mirage (slim tech), and Brother Cassian (closed helm). This exercises concealment and silhouette extremes before volume work.
5. Produce the remaining retained identities in **three mixed batches of eight** following chars-1's production rank. Mix archetypes/palettes within each batch; do not run 8 similar cowls or armored bodies in a row, which hides drift until too late.
6. After every batch, review 76 px color, grayscale, and palette boards against all previously approved characters. Owner promotes winners in the batch sheet; failed rows re-enter only their own attempt queue.
7. Finish with one full 32-character gameplay-scale cast board, extreme-head-motion spot checks, and final owner sign-off. Only then hand approved assets to chars-5's runtime migration sequence.

Automation owns completeness, hashes, alpha/keying, component count/roles, geometry, palette flags, preview generation, manifest synchronization, and asset existence. A production art reviewer owns face/no-neck/camera/style verdicts. The owner is needed at three irreversible taste gates: Drifter selection, three-anchor breadth lock, and every batch's promoted winners/final cast board. The owner does not need to inspect mechanically invalid raws.

## Cost and dependencies on the other four tracks

| Handoff | This pipeline requires | Cost/risk if late or changed |
|---|---|---|
| **chars-1-roster** | Final retained ids, production rank, 76 px identity phrase, silhouette signature, and palette intent. Current recommendation is 32. | Queue size and job rows change. An id cut after approval strands its art; an id added later costs a full character cycle. |
| **chars-2-facelaw** | One positive opaque concealment construction and character-specific forbidden-leak list per retained id, plus rulings on any abstract mask/light marks. | A concealment change invalidates that character's generated attempts; face review cannot be “fixed downstream.” |
| **chars-3-headrig** | Versioned 1024 guide, exact semantic roles, core proportion bands, source pivots/socket, mount scale, overlap range, safe envelope, and extreme-motion compositor. | Geometry changes can invalidate every sliced head/body pair. This is the most expensive late dependency. |
| **chars-5-migration** | Character-owned runtime manifest/file contract, activation flag/fallback behavior, persistence-safe switchover, and the point at which wardrobe catalogs/assets may be retired. | Art can be approved out of runtime, but early installation risks breaking saved accounts, server modifiers, or the approved body animation path. |

This track costs the one-time 3-5 engineering days above, 121-145 expected generation calls and roughly 16-26 combined production/style-review hours for the 32-character plan, plus owner review time of roughly 2-3 hours when batched. It depends additionally on keeping the existing Codex wrapper, chroma keyer, outline pass, contact-sheet idiom, asset checker, and approved body animation stable through the migration.

## Assumptions and open owner questions

No question blocks planning. The report proceeds with these explicit assumptions:

- chars-1's 32-character recommendation is the production baseline; all formulas show the 40-character fallback if the owner retains everyone.
- Abstract **inanimate** mask marks, painted slits, sigils, or a non-biological light band are allowed only when chars-2 assigns them; biological eyes or inferred anatomy are never allowed. The Drifter uses no eye marks.
- Hands remain empty because weapon/hand placement is runtime-owned. A concept whose old identity depended on a held prop must move that read into attached costume silhouette or be reconsidered by chars-1.
- The current `0.85` head scale and measured proportion/overlap bands are the implementation baseline, but chars-3's frozen successor guide is authoritative before generation starts.
- One exact concept-specific hue outside the current house palette is allowed when chars-1/owner freezes it in the art plan; adjective-only palette improvisation is not.
- Owner approvals may be batched, but no character is installed without a winner-specific approval hash.

## Validation of this report

- Read the required reporting README, all 50 concept records, the live 40-character roster and kit data, the complete quirk module, the relevant `SpriteRig` head follower/final pose path, current gear socket/proportion manifests, the existing character concept generator, general art orchestrator/prompt/Codex wrapper, green-key/slice/contact/outline guards, particle factory, weapon codegen, VFX override source, and asset checker.
- Cross-checked this plan against all four concurrent panel reports available under `docs/design/`.
- Wrote only `docs/design/chars-4-pipeline.md`; no code, asset, catalog, generated output, test, or live process was changed, and no image generation was invoked.
