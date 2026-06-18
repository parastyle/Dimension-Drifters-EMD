# Art Tooling Research — How Survivor-Likes Were Built & What Software Could Speed Up Our Art Loop

*Synthesized for Dimension Drifters (Phaser 4.1 + Colyseus 0.16 + TypeScript + pnpm + Vite, solo dev + AI agent). Art pipeline: OpenAI Codex/gpt-image → flat-cel "limbless pill-grunt" on a `#00ff00` chroma field → connected-component slicer → presize → codegen'd TypeScript sprite manifest. Existing in-house tools: **artkit** (`orchestrate.mjs` render, `harvest-install.mjs` slice+install), **Weaponsmith** (per-weapon VFX authoring), and a **review** web UI.*

---

## 1. TL;DR

- **You are already on the genre's proven stack, validated at the top.** Vampire Survivors was built solo in Phaser 3 + HTML5 + TypeScript — exactly like us. That's the headline endorsement *and* the cautionary tale: it later migrated to Unity because single-threaded JS hit a CPU wall at thousands of entities. Lesson: keep weapon/enemy/dimension **definitions as plain JSON/TS** (you already do) so they survive any future port, and keep the authoritative sim in the **Colyseus Node process**, off the render thread.
- **No survivor-like dev built an art tool.** VS bought a ~£1,100 Castlevania-style asset pack; Halls of Torment used one 3D artist; Brotato/20 Minutes Till Dawn used flat sprites. Volume came from **data permutation over a modest art set**, not industrialized art generation. **Your Codex→slice→manifest pipeline is more sophisticated than what the genre's biggest hits used.** The risk isn't lacking art tooling — it's *over-investing* in it.
- **The single highest-leverage technical win is not a new app — it's fixing the asset-loading shape.** Today `ArenaScene.ts:231` issues one `load.image()` per sliced part (body, hand-l, hand-r per subject) plus per-card/decal/POI loads → hundreds-to-thousands of HTTP requests and separate GPU textures. **Pack everything into a Phaser multiatlas** (free, MIT `free-tex-packer-core`, bolted onto the existing `harvest-install.mjs` codegen). This collapses draw calls and is the **prerequisite** for Phaser 4's `SpriteGPULayer` to batch the swarm into ~one draw call.
- **The "editor" that ships hundreds of balanced entries is a spreadsheet, every time.** Halls of Torment: "a lot of spreadsheets." A sheet→JSON step (one team cut monster setup from 8h → 30min) is the right bulk-balance surface for 300+ weapons — complementing, not replacing, your JSON source of truth.
- **For live feel-tuning, drop in a tweak-panel (Tweakpane) bound to live game objects** + lean on **Vite HMR** for hot-reloading weapon/VFX JSON and the codegen'd sprite manifest. This is the "tools as part of the build" / immediate-mode philosophy achieved cheaply on your stack. You also already own a **free WebGL frame profiler**: Spector.js is embedded in Phaser's debug build (`captureNextFrame()`).
- **Biggest AI-art upgrade: move generation to a local, scriptable ComfyUI graph + a house-style LoRA** trained on your already-approved sprites, so every new subject comes out on-model instead of relying on prompt luck. Cheaper drop-ins: **rembg/BiRefNet** as an alpha-matting fallback when chroma-keying fringes, and treating your already-sliced parts as a **DragonBones cutout puppet** for free skeletal motion.
- **Legal reality shapes the pipeline more than any tool.** Per the Jan 2025 US Copyright Office report, pure prompt output is largely uncopyrightable; Steam *requires* disclosing AI assets that ship in the build. Both favor your **local, human-in-the-loop, own-data** approach over a black-box cloud API — keep the curate/slice/review human steps, train LoRAs on *your* art, and plan to tick the Steam disclosure.
- **For phone review (how Mike actually works): build a tiny pick/flag gallery, not a DAM.** Two proven patterns fit our "3 candidates per subject, 297-subject manifest": a **blind pairwise/ELO picker** (open-source `elopix`) to choose the winner per subject, and a **Tinder-style swipe approve/reject** pass — both written back into the same manifest JSON the slicer reads. Serve JPEG, not RGBA-PNG.

---

## 2. How Similar Games Were Built (the dev-tooling story)

The consistent pattern across the genre's biggest hits is **radical separation of data from logic**, with a **thin authoring layer** (usually a spreadsheet) and **no bespoke art tool**.

### Vampire Survivors (poncle) — our exact stack, validated and then outgrown
Luca "poncle" Galante built the original solo in **Phaser 3 / HTML5 / TypeScript** (itch.io, March 2021). After it blew up, the team spent ~a year migrating to **Unity** (cutover Aug 2023). The stated reasons are concrete and directly relevant to us:
- JavaScript + Phaser run on the browser's **single main thread** and "could not efficiently handle [the] massive CPU load" once stages push thousands of entities with constant collision checks + particles → frame drops/stutter.
- Native code was required to ship optimized **Steam + Nintendo Switch/console** builds.
- Development was famously ad-hoc — Galante grabbed sprites from a Castlevania-style asset pack and "coded attack patterns on the spot." The signature enemy-shoving is an *emergent* property of treating every enemy as a Phaser dynamic physics body — a "feature" that came free from the engine.
- Asked if he'd use Unity again by choice: *"lol no thank you!"* — he liked Phaser; the port was pragmatism, not preference.

**Takeaway for us:** the most successful game in the genre IS our stack (solo + Phaser + TS), which validates the choice — but it also maps the wall. The single-threaded CPU ceiling is the specific risk for a 1-10p co-op horde. Mitigate early: object pooling, batched/instanced rendering, and keep the authoritative sim in the **Colyseus Node process** (separate from the browser render thread). Keep definitions engine-agnostic so a future port survives.

### Soulstone Survivors — the cleanest published "hundreds of entries" blueprint
Unity case study (~1,400 small single-responsibility scripts). **Data is separated from logic:** ~110+ "Data" scripts are plain serializable C# objects holding only data, wrapped by Components. Skills/achievements/characters/levels are hundreds of **ScriptableObjects** organized by inheritance (e.g. a base `AchievementDefinitionSO`). Each actor's `Entity.cs` **caches references to every component once** so the horde loop never does per-frame `GetComponent` lookups across hundreds of enemies.

**Takeaway:** content = inert serializable definition objects; behavior = small components reading them — exactly your weapon-JSON + server-logic split. The reusable insight: **precompute/cache per-entity capability tables; no per-frame lookups in the horde loop.** Inheritance-of-definitions is a model for organizing 300+ weapons into families.

### Halls of Torment (Chasing Carrots) — "a lot of spreadsheets," Godot, hot code off the main thread
From a GodotFest talk + interviews. **Content/balance is driven by spreadsheets**, not a custom editor: *"We have a lot of spreadsheets… that tell us how we should tweak certain values."* Enemies are individual Godot `.tres` resource files. Thousands of sprites caused unplayable slowdowns, fixed by moving "calculation-heavy parts to **C++**" and running "some of the code in **separate threads**."

**Takeaway:** (1) The "editor" that actually ships hundreds of balanced entries is a spreadsheet. (2) Horde performance = batched rendering + hot loops off the single thread. We have no C++ escape hatch, but the equivalent moves are **object pooling, batched/`SpriteGPULayer` rendering, and the sim in the Node process** (and potentially a worker thread).

### Brotato & 20 Minutes Till Dawn — content as data files, composable effects, no custom editor
**Brotato** (solo, Godot): every weapon/item/enemy is a discrete `.tres` data file in a directory tree; effects are small composable classes; **item descriptions are generated dynamically from stats**, not hardcoded. **20 Minutes Till Dawn** (solo CS-grad, Unity, ~2 months): upgrades/synergies are **composable data-defined effects** with prerequisites — 12 synergies fall out of upgrade *combinations* rather than bespoke per-upgrade code.

**Takeaway:** one data file per entry + composable effect objects + **descriptions derived from the same data the sim reads** (so 300 weapon tooltips never drift). Encode upgrade **prerequisites + effect composition as data** so new synergies are content, not code — applies straight to your augment registry.

### The horde-rendering pattern (the universal performance answer)
Every survivor-like answers "how do you draw thousands of entities at 60fps?" the same way: **batched/instanced draws + aggressive object pooling**. Godot uses `MultiMeshInstance2D`/`RenderingServer` (one batched draw for thousands of instances). The **Phaser equivalents** are batched primitives (`Blitter`/Bobs, `ParticleEmitter`, and in Phaser 4 **`SpriteGPULayer`**), a **shared texture atlas** so the WebGL batcher issues few draw calls, off-screen culling, and reusing a fixed pool. (Caveat: Megabonk and Boneraiser Minions are commercial hits but have **no substantive public technical postmortems** — their lessons are about solo-dev reach/marketing, not architecture.)

### The art-volume reality check (most important framing)
**No survivor-like dev built an art-authoring or sprite-slicing tool.** VS used a bought pack; Halls of Torment used pre-rendered 3D from one artist; Brotato/20MTD used flat sprites. Volume came from **data variety over a modest art set**. Your AI-CLI → connected-component slicer → presize → TS-manifest pipeline (plus artkit/Weaponsmith) is **a genuine differentiator** — more than the genre's biggest hits used. So the high-value tooling work is on the **data/iteration side** (fast phone review, balance spreadsheets, hot-reload of defs) — **not yet more art machinery.**

---

## 3. Software to Interact With the Art

*Format: what it is — why it fits us — cost.*

### (a) Sprite create / edit (the touch-up tier — not primary creation)
Because the art is AI-generated, hand editors are a **correction bench** (fix a chroma-bleed edge, a hand seam, draw one VFX frame), not an authoring tool for 300 subjects.

- **Aseprite** — de-facto pixel editor with a **real batch CLI** (`-b --sheet --data --format json-hash --sheet-pack --split-tags --split-slices --trim`) that exports a packed sheet + Phaser-loadable JSON headlessly; animation tags map to Phaser via `anims.createFromAseprite()`. *Why us:* the one hand-tool worth buying — it folds into the same scripted bake as everything else; its `--split-slices`/`--trim` mirror your slicer's mental model. *Cost: $20 one-time.*
- **Krita** — free full painting app; native `Export Animation → Sprite Sheet`. *Why us:* fits the flat-cel/painterly look better than pixel editors, for painterly weapon-glow touch-ups. *Cost: free.*
- **Piskel** — free, browser-based instant scratchpad for a quick frame/placeholder. *Cost: free.*
- **LibreSprite / Pixelorama** — free Aseprite-fork / Godot-based editors. *Why (not) us:* LibreSprite lacks the **slices + rich CLI** that matter for a scripted pipeline, so just buy Aseprite. *Cost: free.*
- **ShoeBox** — free legacy GUI "extract sprites from a sheet" toolbox. *Why us:* only as an emergency manual rescue for a rogue render the auto-slicer chokes on; unmaintained, depends on deprecated Adobe AIR. *Cost: free, high friction.*
- **Pyxel Edit / Tiled** — tileset/tilemap tools, **orthogonal** to the character pipeline. Scoped OUT: you already have a Codex tile generator and deterministic mapgen. *Cost: low, low value here.*

### (b) Slice / atlas / pack (the real performance lever)
Phaser's WebGL renderer **batches by texture** and flushes the batch whenever it hits a texture not already bound (3.50+ binds up to ~16 textures and draws them in one call). Packing many PNGs into a few **trimmed atlases** collapses a screen full of distinct enemies/weapons/bullets into a handful of bound textures and draw calls. *This is THE finding for a bullet-heaven.*

- **`free-tex-packer-core`** (MIT) — Node library + CLI; exports Phaser multiatlas with trimming/rotation/multipack (auto-splits pages). Phaser consumes it natively via `load.multiatlas()`. *Why us:* bolts straight onto `harvest-install.mjs` — after slicing, pack all parts and emit **frame keys instead of file paths**. No GUI, no runtime dep shipped to players, and it's the **precondition for `SpriteGPULayer`**. *Cost: free.*
- **TexturePacker (CodeAndWeb)** — pro packer; real value is **CLI + SmartFolders + incremental rebuild** (only re-packs sheets whose inputs changed), native "Phaser 3"/multi-atlas exporters. *Why us:* graduate to this only if the build needs scripted incremental re-packing or atlas count gets unwieldy; SmartFolders scale cleanly to hundreds of subjects. *Cost: ~$55 perpetual Pro (Essential free tier disables multipack/polygon; CI/Docker is a separate recurring license).*
- **Phaser atlas formats to standardize on** — **JSON Hash** (single sheet) and the **multi-atlas/multipack** format via `load.multiatlas()` (one JSON, many pages) once you exceed one 4096px sheet. Aseprite, TexturePacker, and free-tex-packer all emit these, so the codegen targets one canonical format. *Cost: free (format choice).*

### (c) Animation
- **Phaser 4 `SpriteGPULayer`** (built-in) — stores all per-sprite render data in a static GPU buffer, draws the whole layer in **~one draw call** with GPU-computed position/rotation/scale/alpha easing + frame-cycling. Phaser cites ~1M sprites; explicitly **not** for objects with complex per-frame runtime logic. *Why us:* perfect for the enemy/bullet/decal swarm; keep player/bosses/parry-tells on the normal path. Requires shared atlas (see §b). *Cost: free (already on 4.1).*
- **DragonBones** (free, open-source) — cutout/puppet skeletal animation: attach separate PNG parts to a bone hierarchy and animate the bones. *Why us:* you **already emit body/hands/feet as separate parts** — that's exactly its input. One reusable rig animates every weapon by re-parenting the weapon to the hand bone, sidestepping the "bespoke per-weapon swing is out of scope" memory. *Cost: free (needs a Pixi/Phaser runtime integration; CONSIDER, not adopt — see §4).*
- **Spine** — official `spine-phaser-v4` runtime, higher quality, but **you legally cannot ship the runtime without an editor license** ($69–$329) and it forces a manual rigging step per subject. *Why (not) us:* off-pipeline; revisit only for hand-authored boss animation. *Cost: $69–$329 + manual rigging.*
- **Theatre.js** — editor-first timeline that overlays the running app and records keyframes to JSON; `@theatre/studio` (dev) + `@theatre/core` (runtime, studio stripped from prod). *Why us:* the **architecture to copy for Weaponsmith** (dev tool stripped from shipped build, emits JSON the game loads), even if not adopted directly (most at home with Three.js). *Cost: free.*

### (d) AI-art generation + consistency
- **ComfyUI** (headless API) — node-graph SD/FLUX runner; POST a versioned workflow JSON to `127.0.0.1:8188/prompt`, poll `/history`, fetch the PNG. *Why us:* near drop-in for `orchestrate.mjs` (same script→image→chroma→slice→manifest shape) but **free per image, private, seed-deterministic**, with ControlNet/IP-Adapter/LoRA wired in to enforce the pill-grunt silhouette structurally. *Cost: free per image; needs a 12GB+ NVIDIA GPU (used RTX 3060 ~$400) + one-time ~4-8h to build the first workflow.*
- **House-style LoRA** — small fine-tune trained on **your already-approved sprites** (10–30 imgs for style) that biases every new subject toward the established look. *Why us:* the **single highest-leverage consistency upgrade**, and you already have the perfect curated training set on the green field. *Cost: cheap/free locally; hosted (Layer ~$10 credit, Scenario ~$29/mo) removes the GPU need.*
- **ControlNet + IP-Adapter** — condition generation on **structure** (fixed pose/mask so parts land where the slicer expects) and on a **reference image** (new enemy "in THIS drifter's style"). *Why us:* de-risks the most fragile part of the current pipeline — that the AI happens to produce something the slicer can cut cleanly. *Cost: free ComfyUI nodes; ride along with local gen.*
- **FLUX.1 Kontext / Qwen-Image-Edit** — instruction-edit models that produce on-model **variants from one reference** ("same drifter, desert palette / holding an axe / corrupted boss"). *Why us:* arguably a better fit than full LoRA training for your **one-canonical-sprite → N dimension reskins** model. *Cost: open weights (beefy GPU) or pay-per-image API ~$0.01–0.04.*
- **rembg / BiRefNet / SAM** — local batch background remover with true alpha matting on soft edges (hair, glow). *Why us:* a **fallback/quality pass** for when the `#00ff00` chroma key fringes on glows/soft auras/anti-aliased edges; batch CLI over the same staging folder, **zero architecture change**. *Cost: free (`pip install rembg`, runs on CPU).*
- **PixelLab / Scenario / Layer.ai / Retro Diffusion** — hosted game-art platforms wrapping the SD/LoRA stack. *Why us:* the **no-self-hosting off-ramp** if a local GPU pipeline is too much ops. PixelLab natively does **skeleton-rig animation + 4/8-directional top-down** views via a Python SDK `orchestrate.mjs` could call. *Cost: low to try, recurring + vendor lock-in + cloud (IP leaves the machine).*

### (e) Asset review / management (tailored to phone review)
- **`elopix`** (open-source, Next.js + TS, `eloranker`) — ranks a folder of images by **pairwise "this-or-that" ELO** votes, exports the winner per subject as JSON. *Why us:* near-exact match — you already render ~3 candidates per subject; vote a few rounds on the phone, feed the winner back to the slicer. Lift the `eloranker` logic into the existing review UI. *Cost: free (MIT-style).*
- **Blind A/B pairwise pattern** (Artificial Analysis Image Arena / LM Arena) — show candidates **anonymously** so the choice is "which sprite reads best at game scale," not "which seed I expected." *Why us:* a 3-candidate best-of-3 is a 2–3 comparison mini-tournament; a **design spec to bake into the in-house picker.** *Cost: free pattern.*
- **Tinder-style swipe culling** (Slidebox / SwipeWipe) — swipe-right approve / swipe-left reject for fast binary triage on a phone. *Why us:* the right **interaction** for clearing the +300 backlog from the couch; writes a boolean back to the manifest entry. *Cost: free pattern (~few dozen lines with pointer events).*
- **ImageMagick `montage` + static HTML gallery** — `montage *.png -tile 8x5 -label '%f' contact.png` makes a labeled proof sheet in one command; glowinthedark's generator makes a self-contained lightbox gallery. *Why us:* `orchestrate.mjs` can append a `montage` call to spot chroma-bleed/bad-slice across 297 subjects at a glance; serve **JPEG** thumbnails per phone-review preference. *Cost: free.*
- **Immich / Photoview / Lychee** — self-hosted LAN galleries with real mobile UX (Immich has native apps). *Why us:* good for browsing/triage, but **read-only** — they don't write approve/reject back into the pipeline JSON, so they complement, not replace, the pick UI. *Cost: free, Docker setup (medium).*
- **Perforce Helix DAM** — pro web DAM (thumbnail-first browsing, **drag-between-pipeline-stages**, **draw-on-image annotation**). *Why us:* overkill to adopt, but the **canonical reference for three primitives to steal** into the review UI: status pipeline (concept→approved→rejected→sliced), thumbnail-first browse, and on-image markup ("kill the green halo here"). *Cost: high/poor-fit to adopt; ideas are free.*
- **Notion / Airtable** — lightweight asset trackers (status enum, asset↔variant, tags via API). *Why us:* mostly redundant — your source of truth is already JSON the slicer reads, so a second DB is **double-bookkeeping**. Useful only as a **schema blueprint** to mirror in the manifest JSON. *Cost: low start, medium ongoing + per-seat.*

### Dev-time UI primitives (the iteration loop)
- **Tweakpane** — dependency-free JS tweak/monitor panel; bind directly to live object props, folders/tabs, FPS graph blade, **import/export state as a preset**. *Why us:* the single best fit for an in-game dev panel — bind it to spawn-director knobs, player tuning (move speed/friction/parry window), and per-weapon VFX params with zero custom widget code; the preset export captures a balance pass. Drop into the dev Testing Grounds tab. *Cost: free (`pnpm add tweakpane`).* (Alternatives: `lil-gui` if Tweakpane feels heavy; **avoid `dat.GUI`** as stale; skip `leva` unless React.)
- **Vite HMR** — `import.meta.hot.accept()` hot-reloads code **and data** without losing run state. *Why us:* put weapon/enemy/dimension JSON and the codegen'd sprite manifest behind accept handlers → edit a weapon's stats/VFX or swap re-rendered art **live mid-run**. *Cost: free (already in your Vite setup).*
- **Spector.js** — embedded in **Phaser's debug build**; `captureNextFrame()` dumps the full draw-call list/textures/shaders; works on mobile. *Why us:* a **no-install profiler you already own** — bind a hotkey to see whether the AI-art sprite batches are breaking the 10-player horde budget. *Cost: free.*
- **Spreadsheet → JSON pipeline** — author bulk balance in a sheet, export to the JSON the game loads (one team cut monster setup 8h→30min). *Why us:* a sheet is a better **bulk-edit** surface than any hand-rolled panel for 300+ weapons (sort/filter/formula across all at once); a ~30-line CSV→JSON script plugs into your existing validator. Complements Tweakpane (sheet = bulk balance, Tweakpane = live feel). *Cost: free.*
- **LDtk** — Dead Cells director's standalone editor: emits documented JSON + live-reload. *Why us:* the clearest **shipped-game precedent for your exact pattern** (separate tool whose only contract with the game is JSON + a file-watcher) — validates artkit/Weaponsmith. Drop-in if you ever need authored arena/boss-room layouts. *Cost: free.*
- **`samme/phaser-plugin-debug-draw`** — overlays GameObject origins/bounds/hit-areas (+ an arcade-physics variant for body shapes/velocities). *Why us:* WYSIWYG melee-hitbox / bullet-origin visualization, replacing ad-hoc debug Graphics. *Cost: free (one npm dep + one line per scene).*
- **`rexUI` / `phaser3-rex-plugins`** — production-ready layout/UI (Sizer, Dialog, **virtualized GridTable**, Toast, ShakePosition, FX shaders). *Why us:* time-saver for the augment/level-up pick UI, weapon-cycle HUD, Testing-Grounds summon menu, and a **GridTable is ideal for browsing a 300+-weapon list**. *Cost: free — cherry-pick + verify Phaser 4.1 compat per plugin.*
- **Phaser Editor 2D — its MCP server, not the scene editor.** Exposes 40+ tools (create particle emitter, reorganize layers) to a Claude agent. *Why us:* since you work *with* an AI agent, this lets the agent author/tweak Phaser particle emitters programmatically. **Do NOT take a dependency on its scene format** — the game is data-driven from JSON. *Cost: ~$12/mo, auto-cancelable; trial only.*

---

## 4. Tailored Recommendations for THIS Stack

Three buckets, opinionated. The guiding principle (GDC tools-team math, the Dear ImGui ethos): **for a solo dev, tool-building is the highest-leverage code you write, because you are 100% of the team eating every slow iteration** — but only on loops you actually run hundreds of times.

### ADOPT NOW — high value, low effort, fits Phaser + Codex + artkit

1. **Multiatlas codegen in `harvest-install.mjs` (`free-tex-packer-core`, free/MIT).** This is the single biggest technical win and the one I'd do first. Today `ArenaScene.ts:231` loops `this.load.image()` per sliced part (`body`, `hand-l`, `hand-r` per subject) plus per-card/decal/POI loads → hundreds-to-thousands of requests and GPU textures. After your slicer emits parts, pack them into a Phaser multiatlas and have the codegen emit **frame keys instead of `/sprites/<id>/<file>` paths**; swap the per-part `load.image` loop for one `load.multiatlas()`. Build-time only, no runtime dep, fits the AI-art pipeline, and it's the **prerequisite for everything else performance-related.**

2. **`SpriteGPULayer` for the swarm (free, built into Phaser 4.1).** Once the atlas exists, move enemies/projectiles/decals/pit-poofs onto a `SpriteGPULayer` (static GPU buffer + GPU easing, ~one draw call). Keep the local player, bosses (OLD RUST phases), and parry-tells on the normal render path. This is the genre-standard fix for exactly the single-thread stutter that pushed VS off Phaser — and the highest-value defense for 10-player horde counts. *(Pairs with #1 — they're a package.)*

3. **Tweakpane dev panel + Vite HMR on data/manifest (free).** Bind Tweakpane to spawn-director, player-feel, and per-weapon VFX params in the Testing Grounds tab; wrap weapon/enemy/dimension JSON and the codegen'd sprite manifest in `import.meta.hot.accept()` so edits and re-rendered art swap **live mid-run** without losing the session. An afternoon; pays back on every balance/feel pass across 300+ weapons.

4. **Phone-friendly pick + swipe pass in the existing review UI (free).** Extend the `review/` web tool with (a) a **blind pairwise/ELO picker** (lift `eloranker` from `elopix`) to choose the winner per subject's ~3 candidates, and (b) a **swipe approve/reject** view for the +300 backlog — both writing decisions **back into the manifest JSON** the slicer/codegen reads. Serve JPEG per your phone-review preference. Closes the curate→slice loop with no database.

5. **`rembg`/BiRefNet as a chroma-key fallback (free).** Add it as a second pass (or a fallback when `#00ff00` keying yields a low-confidence mask) over the same staging folder. Zero architecture change; rescues exactly the soft-glow/anti-aliased cases your guards fringe on. Your README already flags the `#00ff00` chroma-key guard as TODO — this is the robust version of that.

6. **Spreadsheet → JSON for bulk weapon/enemy balance (free).** A ~30-line CSV/sheet→JSON exporter into your existing data validator. The sheet becomes the bulk-balance surface (sort/filter/formula across all 300 at once); Tweakpane stays for live feel. Genre-universal; one team got 8h→30min on this.

7. **Spector.js capture hotkey + `phaser-plugin-debug-draw` (free).** You already own Spector via Phaser's debug build — bind `captureNextFrame()` to a dev key to see if AI-art batches break. Add debug-draw for WYSIWYG melee hitboxes / bullet origins. Both are minutes of wiring.

### CONSIDER — worth a spike

- **Local ComfyUI + house-style LoRA** trained on your approved sprites. The biggest *art-quality/consistency* upgrade and a near drop-in for `orchestrate.mjs` (same script shape, free per image, private, seed-deterministic, ControlNet/IP-Adapter to keep silhouettes sliceable). The cost is real: a 12GB+ GPU and one-time workflow build + ongoing model/ops burden. **Spike it** when art *consistency* (not volume) becomes the bottleneck, or generation cost/privacy starts to bite. If self-hosting is too much, **Layer/Scenario** give the LoRA win via API without a GPU — at the cost of cloud + recurring fees + the legal caveats below.
- **FLUX.1 Kontext / Qwen-Image-Edit** for dimension reskins. If your model is "one canonical sprite → N dimension variants," instruction-edit-from-one-reference may beat full LoRA training and slices the same way. Spike alongside ComfyUI (same backend).
- **DragonBones cutout rig (free).** Your already-sliced body/hands/feet parts are exactly its input — one reusable rig could give procedural swing/run/idle/hit for *every* weapon by re-parenting to the hand bone, working *around* the "bespoke per-weapon animation is out of scope" memory rather than against it. The spike cost is a Pixi/Phaser runtime integration + building the first rig. Worth a timeboxed prototype only if the current part-offset/tween motion feels too flat; `SpriteGPULayer`'s GPU easing may already cover what you need.
- **Phaser Editor 2D MCP server (~$12/mo, cancelable).** Since you pair with an AI agent, a one-month trial to let the agent author Phaser particle emitters/VFX could complement Weaponsmith. Trial the **MCP server + particle tools only** — do not adopt its scene format.
- **TexturePacker Pro (~$55).** Graduate from free-tex-packer to this *only if* the build needs scripted incremental re-packing (SmartFolders + rebuild-only-changed) once atlas count/size gets unwieldy at full fleet scale.
- **Aseprite ($20).** Cheap touch-up bench whose CLI folds into the bake. Buy it when you find yourself needing to hand-fix seams/edges regularly; until then it's optional.

### SKIP / not worth it (and why)

- **Spine for skeletal animation** — you legally can't ship the runtime without a $69–$329 editor license, *and* it forces a manual rig per AI-generated subject, breaking the automated pipeline. Wrong tool for flat-cel pill-grunts; revisit only for hand-authored boss animation. (DragonBones is the free alternative if you go skeletal at all — see CONSIDER.)
- **A heavyweight DAM (Perforce Helix DAM) or Notion/Airtable as the asset DB** — your source of truth is already JSON the slicer reads; a second store is double-bookkeeping and sync surface. Steal Helix's three *workflow ideas* (status pipeline, thumbnail-first browse, on-image annotation) into the review UI instead.
- **Self-hosted galleries (Immich/Photoview/Lychee) as the review surface** — they're read-only and can't write approve/reject back into the pipeline. Your custom pick/swipe UI (ADOPT #4) does the loop they can't. Fine as a casual browser if you already run one, but don't stand one up for this.
- **Tiled / Pyxel Edit** — orthogonal to the AI-art character pipeline. You have a Codex tile generator and deterministic seeded mapgen, so Tiled is redundant unless you switch to hand-authored arenas; Pyxel Edit duplicates the tile generator. (LDtk earns a back-pocket mention only if you ever want authored boss rooms.)
- **`leva` / `dat.GUI`** — `leva` assumes React (your tools are plain Node+browser); `dat.GUI` is effectively unmaintained. Use Tweakpane (or `lil-gui`).
- **ShoeBox as a pipeline component** — your connected-component slicer already does what it does, headlessly and better. Emergency manual fallback only.
- **Don't gold-plate the art-generation tooling.** The genre's biggest hits shipped on bought packs and one artist; your pipeline already exceeds them. The proven move is making a modest art set go far via **data permutation** — so keep new tooling investment on the **data/iteration/review** side, not more art machinery.

### Cross-cutting: legal + platform constraints (process, not purchase)
This shapes pipeline choices more than any tool, and it *reinforces* the local/human-in-the-loop direction you're already on:
- **Copyrightability (US Copyright Office, Jan 2025):** pure prompt output is largely uncopyrightable/public-domain; **human selection/arrangement/modification earns protection.** Your curate → slice → manifest → review (+ any manual cleanup) steps are exactly the "sufficient human authorship" that qualifies — keep a visible human-edit step.
- **Steam disclosure (policy since Jan 2024, clarified 2026):** you **must disclose** AI-generated assets that ship in the build; behind-the-scenes efficiency tools are exempt; Valve can reject if you can't show rights to training data. **Prefer LoRAs trained on YOUR own curated outputs** (provenance you can prove) over scraped-base-model output, document dataset provenance, and plan to tick the content-survey disclosure.

---

## 5. Sources

**Survivor-like dev/tooling postmortems**
- Vampire Survivors — open-source-fueled dev story: https://www.gamedeveloper.com/design/vampire-survivors-development-sounds-like-an-open-source-fueled-fever-dream
- VS Phaser→Unity migration reasons: https://www.linkedin.com/posts/tagir-shaikhiev_gamedev-phaser3-unity3d-activity-7383442564571500544-DHE7 · https://www.gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17/
- VS "lol no thank you" on Unity: https://www.gamesradar.com/vampire-survivors-dev-asked-if-hell-ever-use-unity-again-lol-no-thank-you/
- VS online co-op case study: https://coherence.io/blog/tradecraft/vampire-survivors-online-coop-case-study
- Soulstone Survivors architecture (data/logic split, ScriptableObjects): https://medium.com/@simon.nordon/unity-case-study-soulstone-survivors-f46ecf968845 · https://medium.com/@simon.nordon/unity-architecture-scriptable-object-pattern-0a6c25b2d741
- Halls of Torment — "Peek Under the Hood" (spreadsheets, C++/threads): https://godotfest.com/talks/a-peek-under-the-hood-technical-learnings-from-halls-of-torment/ · https://fullcleared.com/features/inside-halls-of-torment-an-interview-with-chasing-carrots/
- Brotato (Godot resources, composable effects): https://godotengine.org/showcase/brotato/ · https://brotato.wiki.spellsandguns.com/Modding_Notes
- 20 Minutes Till Dawn (solo, synergy-as-data): https://en.wikipedia.org/wiki/20_Minutes_Till_Dawn · https://howtomarketagame.com/2022/06/14/20-minutes-till-dawn/
- Horde rendering (Godot MultiMesh ↔ Phaser batching): https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html

**Phaser rendering / atlas / loaders**
- Phaser advanced rendering (texture batching): https://phaser.io/tutorials/advanced-rendering-tutorial/part2 · https://phaser.io/news/2020/12/phaser-350-released
- Phaser 4 `SpriteGPULayer`: https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance · https://phaser.io/tutorials/phaser-4-rendering-concepts
- `load.multiatlas()` + loader concepts: https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Loader.LoaderPlugin-multiatlas · https://docs.phaser.io/phaser/concepts/loader
- Texture/atlas formats: https://docs.phaser.io/phaser/concepts/textures

**Packers / sprite tools**
- free-tex-packer (core lib + CLI): https://github.com/odrick/free-tex-packer · https://github.com/odrick/free-tex-packer-cli · https://free-tex-packer.com/
- TexturePacker (CLI, licensing): https://www.codeandweb.com/texturepacker/documentation/commandline · https://www.codeandweb.com/texturepacker/licenses-comparison
- Aseprite CLI: https://www.aseprite.org/docs/cli/ · Phaser+Aseprite: https://saricden.github.io/aseprite-sprites-in-phaser3-5
- Krita sprite-sheet export: https://docs.krita.org/en/reference_manual/render_animation.html

**Dev-time UI / iteration**
- Tweakpane: https://tweakpane.github.io/docs/ · web game dev tools overview: https://www.webgamedev.com/engines-libraries/dev-tools
- Vite HMR API: https://vite.dev/guide/api-hmr · Phaser+Vite template: https://phaser.io/news/2024/01/phaser-vite-template
- Spector.js in Phaser debug build: https://github.com/phaserjs/phaser/blob/v3.60.0/changelog/3.60/Spector.md · https://spector.babylonjs.com/
- Dear ImGui "tools as part of the build": https://github.com/ocornut/imgui
- LDtk (JSON + live reload precedent): https://ldtk.io/ · https://deepnight.net/tools/ldtk-2d-level-editor/
- Theatre.js (editor-first, studio/core split): https://www.theatrejs.com/
- Spreadsheet→JSON content pipeline: https://www.gamedeveloper.com/programming/orbitect-spreadsheets-and-json
- Phaser debug-draw plugin: https://github.com/samme/phaser-plugin-debug-draw
- rexUI / rex plugins: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/ui-overview/ · https://www.npmjs.com/package/phaser3-rex-plugins
- Phaser Editor 2D (MCP server, features): https://phaser.io/editor · https://help-v3.phasereditor2d.com/intro/main-features.html

**AI-art pipeline**
- ComfyUI as headless asset backend: https://www.strayspark.studio/blog/comfyui-game-asset-pipeline-indie-2026 · https://www.runflow.io/blog/comfyui-api-developer-guide
- Style/character LoRA training: https://help.scenario.com/en/articles/train-a-style-model/ · https://help.layer.ai/en/articles/14094114-how-to-train-a-custom-model-lora
- ControlNet + IP-Adapter consistency: https://stable-diffusion-art.com/ip-adapter/ · https://stable-diffusion-art.com/consistent-character-view-angle/
- FLUX.1 Kontext / Qwen-Image-Edit: https://fal.ai/learn/tools/flux-vs-qwen-image
- rembg / BiRefNet alpha matting: https://github.com/danielgatis/rembg
- DragonBones / Spine skeletal: https://dragonbones.github.io/en/animation.html · http://en.esotericsoftware.com/spine-phaser · https://esotericsoftware.com/spine-purchase
- PixelLab (skeleton rig + directional, API): https://www.pixellab.ai/pixellab-api · https://www.pixellab.ai/docs/tools/animate-with-skeleton
- Retro Diffusion: https://www.retrodiffusion.ai/

**Asset review / management**
- elopix (ELO image picker): https://github.com/SouthBridgeAI/elopix · eloranker: https://www.npmjs.com/package/eloranker
- Blind pairwise leaderboards: https://artificialanalysis.ai/image/leaderboard/text-to-image · https://lmarena.ai/
- ImageMagick montage / static gallery: https://usage.imagemagick.org/thumbnails/ · https://github.com/glowinthedark/create-image-gallery
- Swipe-cull UX: https://www.makeuseof.com/swipewipe-declutter-photos-app/
- Self-hosted galleries: https://github.com/immich-app/immich · https://github.com/photoview/photoview
- Perforce Helix DAM (workflow primitives): https://www.perforce.com/products/helix-dam
- Scenario (AI game-art platform): https://www.scenario.com/

**Legal / platform**
- US Copyright Office AI report (Jan 2025): https://www.copyright.gov/ai/ · https://journals.law.harvard.edu/jsel/2025/03/u-s-copyright-office-grants-registration-to-ai-generated-artwork/
- Steam AI disclosure: https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/ · https://partner.steamgames.com/doc/gettingstarted/contentsurvey
