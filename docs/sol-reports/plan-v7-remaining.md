# V7 remaining work — Sol fleet orchestration plan

## Understanding recorded before planning

- Baseline is `feat/v0.118-metagame` at `4662c4a`, clean, with the complete serial unit suite at 1,718/1,718. This document is planning-only; no game implementation or commit belongs to this Planner Sol.
- Remaining scope is Wave B (`V7-MOVE`, `V7-HANDS`, `V7-BEAM`), Wave C (a visibly bespoke choreography for every active katana while preserving rest stances), and Wave D (the audit table's weapon orders, including the new four-weapon throwing-star line, generated flaming-cross and pictured-harpoon art, and two archives). Source-note reconciliation found 33 actual Wave D table rows. The apparent “34” is accounted for by the named Thunderhead Lever-Gun weapon note owned under `V7-HANDS`; there is no missing Wave D weapon to invent.
- Wave A did more than fix individual weapons. It made `packages/shared/src/weapon-muzzle.ts` the shared art-space-to-world affine and made `SpriteRig` consume the same family/hand/recoil firing pose used by authority. `packages/shared/src/hit-envelope.ts` is now the collision-law seam. The Overcasters correction also predicts each delayed recoil round and admits authoritative rows at the current rendered muzzle. Those are foundational contracts for the remaining work, not convenient code to fork.
- `V7-HANDS` is therefore the highest collision-risk item. Pump/lever support-hand travel must be expressed as an explicit phase layered onto the shipped shared grip/pose surface; it must not recreate offsets inside `SpriteRig`, mutate muzzle points to compensate for hand art, or let client-only timing disagree with accepted server fire cadence. It gets sole ownership of the pose-affine/SpriteRig surface and lands before any Wave D gun group that depends on firing hands, scaling, multi-projectile muzzle geometry, recoil, or lever cadence.
- Repeated owner failures require live proof, not only static/unit coverage. At minimum the repeated/invisible rows (Stormcaller six beams, gloves already closed, katana distinction/twirl lineage, beam structures, and any repeat order such as Rocket Tube explosion) need a before/after live probe, retained frame/JSON evidence, and a permanent Playwright gate. Every other Sol still needs an order-specific live gate or inclusion in a permanent catalog gate; “tests pass” is not closure when the requested behavior is visual.
- Server authority and DPS neutrality are default laws. Geometry, counts, cadence, knockback, size, carry, and projectile identity can change only as ordered. If an order changes cadence or pellet/projectile count, the owning Sol must preserve aggregate DPS by redistributing per-hit damage unless the order explicitly forces a damage/tempo outcome, then document the exact redistribution or exception. Visual launch origins must continue to use the Wave A muzzle affine, and damaging art must remain inside or deliberately expand the shared hit envelope.
- Generated special-effect art is mandatory unless the owner says otherwise. The generated cross, Faradayer projectile, and Frostfang pictured harpoon need source provenance, transparent production assets, artkit/codegen integration, and live validation. Procedural substitutions are not acceptable for those identity effects. New throwing-star weapon art is likewise a full catalog/codegen/art pipeline, not four recolored runtime primitives.
- Every implementation Sol must create `docs/sol-reports/<slug>.md` as its first write, append work/decisions as it proceeds, and append validation last. Reports and evidence are disjoint per slug. Sols must use the existing 5180/2567 owner stack without stopping, replacing, or killing it; private listeners may be used only through the repository's isolation idiom on non-owner ports and must clean up only their own processes.

## Recommendation

Launch **nine Sols**. Only the first three run concurrently; the remaining implementation Sols are deliberately serialized around the repo's monolithic catalog, `GameRoom`, `ArenaScene`, and `SpriteRig` files. Nine is the minimum I trust: fewer would make the remaining catalog Sol too broad to verify honestly, while more would buy mostly merge conflicts and conductor overhead.

The plan merges Frostquill into the beam Sol, Hailwidow's size order into the katana Sol, both archives into the new-line catalog Sol, and all generated Wave D identity art into one render farm. It does not fund a second Overcasters implementation because `4662c4a` already contains the authority/prediction fix, permanent moving-burst gate, and before/after evidence.

## Ledger accounting

Wave C means the **14 active katana-family weapons**: Neon Katana; the eight active Drift line blades (all except archived Kagewake and Hushglass); Hailwidow; Gravechill; Voltfang; Cinderfang; and Stormpetal. The two archived Drift wakizashis retain their durable definitions and current art but do not receive expensive new unreachable choreography.

| Ledger scope | Owning Sol | Accounting |
|---|---|---:|
| V7-HANDS, including Thunderhead Lever-Gun | `v7-hands-affine` | 1 systemic + 1 named weapon note |
| V7-BEAM + Frostquill Compendium | `v7-beam-structures` | 1 systemic + 1 Wave D row |
| V7-MOVE | `v7-move-tumble-longjump` | 1 systemic |
| V7-KATANA + Hailwidow 1.5x | `v7-katana-bespoke` | 14 active katanas + 1 Wave D row |
| Throwing Stars NEW + Coffin-Nail archive + Psalter archive | `v7-stars-archive-catalog` | 3 Wave D rows / 4 new weapons |
| Ranged catalog orders | `v7-ranged-orders` | 18 Wave D rows |
| Melee/caster/carry catalog orders | `v7-melee-caster-orders` | 9 Wave D rows |
| Galvanic Overcasters | `v7-remaining-qualification` | 1 Wave D row, verification-only (already implemented) |

The 33 Wave D rows therefore reconcile as `1 + 1 + 3 + 18 + 9 + 1 = 33`. The generated-art Sol supplies assets but closes no gameplay row itself.

### Exact Wave D allocation

| Owner | Weapon rows |
|---|---|
| `v7-beam-structures` | Frostquill Compendium |
| `v7-katana-bespoke` | Hailwidow Katana |
| `v7-stars-archive-catalog` | THROWING STARS (NEW) — iron/fire/ice/void; Coffin-Nail Carbine; Psalter of the Burning Halo |
| `v7-ranged-orders` | Brimstone Gallows-Rifle; Brimstone Rocket Tube; Mesa Hand-Cannon; Tesla Faradayer; Plaguespitter Flak Gun; Sanctus Siege Bombard; Stormcaller Tesla Gatling; Sidewinder Spitfire; Gravelung Punt-Rifle; Ironhide Buffalo Gun; Galvanic Coachgun; Ricochet Pistol; Hailspitter Pepperbox; Dustline Lever-Action; Hexbore Voidmaw; Gravelthroat Repeater; Tesla Drumbore; Frostfang Speargun |
| `v7-melee-caster-orders` | Gravewarden Buster; Sidewinder Spontoon; Fulgurite Storm-Sphere; Boothook Harpoon; Tombstone Greatsword; Saint-Bough Frost Crozier; Thunderhead Voulge; Nullspike Pike; Idol of the Pale Verdict |
| `v7-remaining-qualification` | Galvanic Overcasters |

## Conductor protocol and file locks

1. Before every launch, require the Sol's report to be its first write. Give the Sol only the write lease listed below; every unlisted file is read-only unless Claude explicitly transfers the lease.
2. At each group barrier, read the durable report, inspect `git diff --name-only`, reject out-of-lease edits, run `git diff --check`, and commit the completed group before transferring a central-file lease. Never have two live Sols with the same future write target even if one claims it will “probably not need it.”
3. Serialize all browser/live-probe activity through one conductor-controlled lane. Code work in Group 1 may overlap, but Playwright and owner-stack probes may not; Wave A reports showed that parallel browsers starve short visual windows and corrupt conclusions.
4. The owner stack on **5180/2567 is untouchable**. A Sol may observe it or use a live probe against it, but may not stop, replace, seize, or kill either listener. Permanent gates use `runArenaSpec`/`startSpecStack` ephemeral ports and tear down only processes they started.
5. Any catalog writer runs the canonical source-to-output path, never hand-edits generated output alone: `pnpm gen`, then `pnpm gen:check`, `pnpm assets:check`, focused tests, typecheck, and the required live gate. Final qualification owns the full serial Vitest and exact CI-policy E2E aggregate.
6. Counts and cadence are trigger-packet economics. Multi-shot orders split the prior trigger damage over the new projectile count; Mesa's new `old fireRate + 0.5s` cadence redistributes total per-trigger damage (including the new explosion) to preserve prior DPS. Any ordered reach/knockback change is documented without an unrelated damage trim.
7. A newly requested special effect uses Codex-generated bitmap art. Existing generated sprites may be reused when they already express the order, but no Sol may close an effect row with a new procedural stand-in merely because it is cheaper to wire.

### Central lease transfer order

| Central surface | Exclusive write order |
|---|---|
| `data/weapon-concepts-300.json`, `packages/shared/src/weapons-expansion.generated.ts` | HANDS → KATANA → STARS/ARCHIVE → RANGED → MELEE/CASTER |
| `packages/client/src/entities/SpriteRig.ts` | HANDS → MOVE → KATANA → RANGED → MELEE/CASTER |
| `packages/server/src/rooms/GameRoom.ts` | MOVE → KATANA → RANGED → MELEE/CASTER |
| `packages/client/src/scenes/ArenaScene.ts` | MOVE → RANGED → MELEE/CASTER |
| `packages/shared/src/weapons.ts`, `packages/shared/src/melee.ts` | KATANA → RANGED → MELEE/CASTER |
| `packages/client/src/sprites/projectile-manifest.ts` | STARS/ARCHIVE → RANGED |
| `tools/weaponsmith/assignments.json`, `packages/client/src/vfx/weapon-vfx.generated.ts` | STARS/ARCHIVE → MELEE/CASTER |

`packages/shared/src/weapon-muzzle.ts` is **not transferable** in this program: every Sol reads it only. Ranged may author checked, reasoned entries in `data/weapon-muzzle-overrides.json` and regenerate `weapon-muzzles.generated.ts`, but may not change affine construction/composition or add a parallel offset path.

## Launch order and concurrency groups

| Group | Launches | Barrier reason |
|---:|---|---|
| 1 — parallel | `v7-hands-affine`, `v7-beam-structures`, `v7-generated-identity-art` | Disjoint runtime/art surfaces. HANDS alone owns `SpriteRig` and the catalog in this group; BEAM owns renderer/beam art; ART owns only new asset paths. Live gates still run one at a time. |
| 2 — solo | `v7-move-tumble-longjump` | Waits for HANDS because both write `SpriteRig`; movement rewrites authority, prediction, input, and presentation as one atomic sentence. |
| 3 — solo | `v7-katana-bespoke` | Waits for MOVE's `SpriteRig`/`GameRoom` convergence and for HANDS' final pose ordering. |
| 4 — solo | `v7-stars-archive-catalog` | Waits for generated star art and the last prior catalog codegen; establishes the new catalog/archive census before per-weapon waves. |
| 5 — solo | `v7-ranged-orders` | Waits for HANDS, ART, and STARS; owns all muzzle-sensitive gun integration in one pass. |
| 6 — solo | `v7-melee-caster-orders` | Waits for KATANA/RANGED and takes the final `SpriteRig`, `GameRoom`, catalog, and VFX leases. |
| 7 — solo | `v7-remaining-qualification` | Independent read-only product audit after every implementation report is complete. Failures return to the owning Sol; the verifier never patches gameplay. |

## Sol 1 — `v7-hands-affine`

**Mission and rows.** Make every tagged pump support hand travel visibly **back then forward**, every lever hand travel **down then up**, improve pump contact placement, and start the mechanism cycle immediately after every accepted shot. Owns `V7-HANDS`, including the Thunderhead Lever-Gun note.

**Exclusive writes.** `docs/sol-reports/v7-hands-affine.md`; `docs/owner-notes-audit-v7-evidence/hands/**`; `data/weapon-concepts-300.json`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/entities/SpriteRig.ranged.test.ts`; `packages/client/src/sprites/secondary-grip.ts`; `tests/v3g-gun-handling.test.ts`; new `e2e/tests/v7-hands-live-gate.spec.ts`. It may adjust only existing pump/lever `gripPoints` rows in the catalog.

**Read only.** `packages/shared/src/weapon-muzzle.ts`, `packages/shared/src/weapons.ts` (especially `weaponMuzzleGripOffset`), `packages/shared/src/weapon-muzzles.generated.ts`, `packages/client/src/sprites/firing-stance.ts`, `packages/client/src/sprites/pose-language.ts`, `packages/client/src/scenes/ArenaScene.ts`, `packages/server/src/rooms/GameRoom.ts`, and all Wave A reports/gates. If the shared affine appears wrong, stop and prove it; do not compensate with a second offset.

**Live/verification gate.** Capture before/after natural frames for at least Thunderhead Lever-Gun plus two other levers and three pump/vertical-foregrip guns. The permanent gate must associate motion with accepted `attackSeq`, prove cycle start within one rendered frame/≤70 ms, assert the ordered extremum shape (pump rear→home, lever down→home), minimum travel relative to body width, visible support hand above art, and unchanged muzzle-to-authority error ≤2.5 px while stationary and strafing. Run the existing sampled muzzle gate on those weapons.

**Risk and mitigation.** The late Wave A aimed-hand mount can overwrite support-hand work, and the old generic flourish can delay/cancel it like a pistol twirl. Layer the mechanism only after the canonical primary grip is sampled, resolve the secondary point in weapon art space, key the clock to accepted beats, and keep the primary hand/weapon/muzzle affine unchanged.

**Claude work-order outline.**

- Live-probe current pump/lever frames before editing and record the actual overwrite/timing path.
- Replace the generic loop flourish with explicit accepted-shot mechanism phases on the existing secondary-grip seam.
- Tune catalog pump anchors only where alpha/art contact proves the hand misses the mechanism.
- Add catalog unit laws, the permanent live gate, muzzle non-regression checks, and append validation last.

## Sol 2 — `v7-beam-structures`

**Mission and rows.** Give beams visibly different overall silhouettes—segmented arcs, converging strands, pulse trains, flame tongues, and related families—rather than changing only internal waveforms. Also make Frostquill Compendium's beam entirely ice-particle art. Owns `V7-BEAM` and the Frostquill Wave D row.

**Exclusive writes.** `docs/sol-reports/v7-beam-structures.md`; `docs/owner-notes-audit-v7-evidence/beams/**`; `packages/client/src/vfx/BeamRenderer.ts`; `packages/client/src/vfx/BeamRenderer.test.ts`; `packages/client/src/vfx/caster-vfx-recipes.ts`; `packages/client/src/vfx/caster-vfx-recipes.test.ts`; new `packages/client/src/vfx/beam-structure-art.ts`; new `packages/client/public/vfx/beams/v7-structure/**`; new `tools/artkit/gen-v7-beam-structures.mjs`; new `e2e/tests/v7-beam-structure-live-gate.spec.ts`.

**Read only.** `packages/shared/src/hit-envelope.ts`, `packages/shared/src/weapon-muzzle.ts`, `packages/shared/src/weapons.ts`, `packages/server/src/rooms/GameRoom.ts`, `packages/client/src/entities/SpriteRig.ts`, and existing beam anchor/lifecycle gates. Authority width/range/origin and the shared muzzle affine are fixed inputs.

**Live/verification gate.** Codex-generate the structure sheets and retain prompts/outcomes/contact sheet. The permanent gate must live-equip a representative of every structure family plus Frostquill, collect screenshots and renderer telemetry, prove at least four non-equivalent longitudinal occupancy/silhouette signatures, prove Frostquill uses no non-ice core/body texture, and reassert moving muzzle attachment and beam lifecycle. A thin continuous readable damage core or dense particle coverage must keep the entire authoritative capsule visually legible; energetic pixels stay inside its width/range.

**Risk and mitigation.** Merely renaming `widthProfile` would repeat the owner's “one tube” complaint; letting arcs/particles overhang would violate the VFX-collision law. Gate the actual rendered occupancy, not recipe metadata, and fit generated structure art inside the authoritative capsule instead of silently widening server reach.

**Claude work-order outline.**

- Inventory active beam recipes and choose a balanced family distribution with clear silhouette contrast.
- Generate/install reusable transparent beam structure sheets, then make `BeamRenderer` compose them from authoritative pose/width/range.
- Special-case Frostquill through recipe data, not a weapon-id branch in the renderer.
- Add renderer laws and a multi-weapon live visual gate; rerun anchor/lifecycle gates and append validation.

## Sol 3 — `v7-generated-identity-art`

**Mission and rows.** Produce all new bitmap identity/effect art needed by Wave D so later integrators never substitute procedural geometry. This is an asset supplier and closes no gameplay row.

**Exclusive writes.** `docs/sol-reports/v7-generated-identity-art.md`; `docs/owner-notes-audit-v7-evidence/generated-art/**`; new `tools/artkit/subjects-v7-remaining.json`; new `tools/artkit/gen-v7-remaining-art.mjs`; `tools/artkit/out/v7-remaining/**`; new `packages/client/public/projectiles/v7/**`; new `packages/client/public/vfx/explosions/v7/**`; new `packages/client/public/vfx/weapons/v7/**`; and exactly the four new sprite directories `packages/client/public/sprites/x2-iron-throwing-star/**`, `x2-fire-throwing-star/**`, `x2-ice-throwing-star/**`, `x2-void-throwing-star/**`.

Required jobs are: flaming cross; Faradayer hand-drawn bolt; Plaguespitter green shot; Stormcaller electric strand; Ironhide anti-tank shell; Coachgun electric slug; Ricochet icicle; Drumbore electric particle; Frostfang pictured harpoon; Mesa detonation; larger Rocket Tube explosion treatment; Fulgurite blue fill; Tombstone stone-and-smoke treatment; Thunderhead Voulge blue effect; Nullspike finisher accent; and four distinct throwing-star weapon sprites. The thrown-star sprite itself is also its in-flight art under the existing thrown-weapon truth.

**Read only.** All manifests, TypeScript, catalog/generated definitions, existing production assets, and Wave A muzzle/hit surfaces. Weapon sprites may be passed as generation references but may not be cropped or traced into “new” projectile art.

**Live/verification gate.** Use Codex image generation through the artkit idiom, chroma-key/alpha scrub, silhouette/aspect/green-spill validation, and a labeled contact sheet. Each production file must have prompt, source-reference, attempt outcome, dimensions, alpha bounds, and accepted candidate recorded. This supplier has no standalone gameplay live gate and claims no ledger closure; each consuming Sol must prove the installed texture live before its row can close.

**Risk and mitigation.** A broad render farm can silently accept duplicated silhouettes or generated backgrounds. Require distinctness checks for the four stars, projectile direction/readability at game scale, no baked glow/background, and survivor semantics so a failed retry never overwrites an accepted asset.

**Claude work-order outline.**

- Write the report and exact job manifest before launching any generation.
- Generate in parallel through isolated Codex homes; validate and reject per asset, preserving accepted survivors.
- Install only transparent, right-facing, game-scale-readable outputs into the leased new paths.
- Produce the contact sheet and machine-readable outcome table for downstream Sols; do not wire code.

## Sol 4 — `v7-move-tumble-longjump`

**Mission and rows.** Replace the current Megabonk slide-hop with a quick fixed-distance cooldown dodge roll that visibly tumbles, and make the existing distance jump fire immediately as the default Space jump with no crouch/charge delay. Owns `V7-MOVE`.

**Exclusive writes.** `docs/sol-reports/v7-move-tumble-longjump.md`; `docs/owner-notes-audit-v7-evidence/movement/**`; `packages/shared/src/constants.ts`; `packages/shared/src/movement.ts`; `packages/shared/src/state.ts`; `packages/server/src/rooms/GameRoom.ts`; `packages/server/src/rooms/GameRoom.test.ts`; `packages/client/src/net/prediction.ts`; `packages/client/src/net/prediction.test.ts`; `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/vfx/jump-effects.ts`; `packages/client/src/vfx/jump-effects.test.ts`; `tests/movement.test.ts`; new `e2e/tests/v7-move-live-gate.spec.ts`.

**Read only.** Every weapon/catalog/VFX recipe, `weapon-muzzle.ts`, `weaponMuzzleGripOffset`, `firing-stance.ts`, `secondary-grip.ts`, and HANDS' report/gate. Reuse append-only stance/phase channels where safe; do not reorder Colyseus schema fields.

**Live/verification gate.** Drive real Shift/Ctrl and Space input through authority and prediction. The permanent gate proves an unobstructed roll's distance is fixed across cardinal/diagonal directions, its duration is quick, an immediate repeat is rejected and a post-cooldown repeat accepted, the rendered card completes a readable tumble, and predictor/server position remains within the existing reconciliation envelope. A one-frame Space tap must enter distance-jump flight without `STANCE_CROUCH` or the old 650 ms hold/commit, reach the authored long-jump band, and preserve pit, pound, freeze, and landing behavior.

**Risk and mitigation.** This is the widest behavioral rewrite: the old slide has contact-only dodge rules, hop chaining, buffers, input treaties, prediction replay state, and schema history. Preserve the current defensive boundary (contact/projectile/locked-melee opening only; no AoE immunity or parry rewards), replace the chain with one server-owned fixed sentence, and share pure step/timing math between server and predictor.

**Claude work-order outline.**

- Capture before behavior and enumerate every slide/distance-jump state consumer before deleting semantics.
- Specify one fixed roll sentence and immediate long-jump sentence in shared deterministic math.
- Migrate server, predictor, input, schema mirrors, presentation, and effects atomically; preserve append-only wire layout.
- Add authority/replay/input unit coverage plus the real-input live gate, then validate without touching 5180/2567.

## Sol 5 — `v7-katana-bespoke`

**Mission and rows.** Give each of the 14 active katana-family weapons a mechanically and visually distinguishable combo choreography while preserving every existing rest stance. Merge Hailwidow's ordered 1.5× weapon size. Owns Wave C and the Hailwidow Wave D row.

**Exclusive writes.** `docs/sol-reports/v7-katana-bespoke.md`; `docs/owner-notes-audit-v7-evidence/katana-movesets/**`; `data/weapon-concepts-300.json`; `tools/artkit/gen-weapon-expansion.mjs`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/shared/src/melee.ts`; `packages/shared/src/weapons.ts`; `packages/server/src/rooms/GameRoom.ts`; new `packages/server/src/rooms/GameRoom.v7-katana.test.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/entities/SpriteRig.combo-continuity.test.ts`; `tests/katana-line.test.ts`; new `tests/v7-katana-movesets.test.ts`; new `e2e/tests/v7-katana-movesets-live-gate.spec.ts`.

**Read only.** `packages/client/src/sprites/pose-language.ts` and all named/size rest-stance tables; `packages/client/src/vfx/katana-slash.generated.ts`; `packages/client/public/particles/katana-slash-*.png`; all Weaponsmith katana assignments; `weapon-muzzle.ts`; `hit-envelope.ts`. This order asks for moves, so retain the already distinct generated slash art rather than funding another VFX redo.

**Live/verification gate.** The catalog gate cycles all 14 active IDs, drives enough accepted beats to cover every bar, records hand/weapon/body/foot/root trajectories, and fails if two weapons share the same normalized motion+timing fingerprint. Retain frame sequences for the headline side slash, wave-shaped weapon path, backflip paper motion, knees-bent stab, and lunge. Assert idle/rest transforms before and after are unchanged, Hailwidow is exactly 1.5×, every damaging beat uses the authoritative combo clock, and nominal DPS is unchanged.

**Risk and mitigation.** Existing combos are data-distinct but render too similarly because many motions collapse into the same `SpriteRig` branch. Add a small reusable choreography vocabulary with meaningful body/foot/weapon trajectories, not 14 weapon-id conditionals. Any actual root travel uses server-owned combo/performance movement; a backflip may rotate the paper card without inventing client-only displacement.

**Claude work-order outline.**

- Snapshot the 14 active rest poses and current live trajectory fingerprints before authoring.
- Design 14 recognizable bars using reusable side-cut/stab/lunge/aerial/low-stance primitives and distinct rhythms.
- Make the same accepted combo clocks drive authority and presentation; apply Hailwidow's size in source data/codegen.
- Add all-catalog distinctness/rest/DPS laws and the permanent frame-trace gate; append visual review last.

## Sol 6 — `v7-stars-archive-catalog`

**Mission and rows.** Add four production-ready throwing-star weapons (iron, fire, ice, void) through the complete catalog/art/resource/acquisition pipeline and archive Coffin-Nail Carbine plus Psalter of the Burning Halo. Owns those three Wave D rows.

**Exclusive writes.** `docs/sol-reports/v7-stars-archive-catalog.md`; `docs/owner-notes-audit-v7-evidence/stars-archive/**`; `data/weapon-concepts-300.json`; `tools/artkit/gen-weapon-expansion.mjs`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/shared/src/weapon-resource.ts`; `packages/client/src/sprites/manifest.ts`; `packages/client/src/sprites/projectile-manifest.ts`; `tools/artkit/subjects-300.json`; `tools/artkit/subjects-vfx-300.json`; four new `tools/weaponsmith/assignments/x2-*-throwing-star.json`; `tools/weaponsmith/assignments.json`; `packages/client/src/vfx/weapon-vfx.generated.ts`; `tools/portal/index.html`; `tools/weaponsmith/public/index.html`; `tests/w4a-weapon-archive.test.ts`; `tests/weapon-resource.test.ts`; `tests/data-consistency.test.ts`; new `tests/v7-throwing-stars.test.ts`; new `e2e/tests/v7-throwing-stars-live-gate.spec.ts`.

**Read only.** The four accepted star sprite directories from ART; `packages/server/src/rooms/GameRoom.ts`; `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/shared/src/weapon-muzzle.ts`; `packages/shared/src/hit-envelope.ts`. Use the existing server-authoritative thrown-weapon path and “weapon throws itself” sprite truth; no bespoke runtime branch.

**Live/verification gate.** Live-equip and throw each star, assert the in-flight texture is its own held sprite, launch is accepted/server-owned, contact damage and range/charges/refill are correct, and the four silhouettes/elements are visibly distinct. Archive tests must prove both retired IDs remain durable/resource-resolvable while absent from active catalog, drops, direct acquisition, Testing Grounds, portal, Weaponsmith, enemy pools, and join inventory. Expected post-wave census is 339 durable, 328 active, 11 archived, subject to codegen confirming the baseline math.

**Risk and mitigation.** New content can pass definition tests while missing a roster, manifest, resource profile, or actual throw art. Reuse the prior auto-rifle full-pipeline idiom, run every generator/check, and make the live gate traverse the real dev-equip/attack path. Balance the four new entries into the existing thrown band and document comparators; there is no prior DPS to “preserve.”

**Claude work-order outline.**

- Add four source definitions and the two archive flags, then regenerate every derived roster/census.
- Wire the accepted ART sprites through ordinary held/thrown manifests and generic thrown authority.
- Update archive/resource/data-consistency laws and add a four-star balance/distinctness suite.
- Prove all four throws live and all archive surfaces closed; run full codegen checks before handoff.

## Sol 7 — `v7-ranged-orders`

**Mission and rows.** Implement the 18 assigned gun/projectile rows as one muzzle-affine-aware, DPS-accounted ranged pass. Owns every ranged row listed in the allocation table; it does not own Overcasters.

**Exclusive writes.** `docs/sol-reports/v7-ranged-orders.md`; `docs/owner-notes-audit-v7-evidence/ranged/**`; `data/weapon-concepts-300.json`; `data/weapon-muzzle-overrides.json`; `tools/artkit/gen-weapon-expansion.mjs`; `tools/artkit/gen-weapon-muzzles.mjs`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/shared/src/weapon-muzzles.generated.ts`; `packages/shared/src/weapons.ts`; `packages/server/src/rooms/GameRoom.ts`; new `packages/server/src/rooms/GameRoom.v7-ranged.test.ts`; `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/scenes/arena/projectile-factory.ts`; `packages/client/src/vfx/gun-projectile-art.ts`; `packages/client/src/vfx/projectile-explosion-vfx-recipes.ts`; `packages/client/src/vfx/weapon-effect-recipes.ts`; `packages/client/src/vfx/weapon-effect-vfx.ts`; `packages/client/src/sprites/projectile-manifest.ts`; new `tests/v7-ranged-orders.test.ts`; new `e2e/tests/v7-ranged-catalog-live-gate.spec.ts`; new `e2e/tests/v7-stormcaller-six-beam-live-gate.spec.ts`.

**Read only.** All ART production directories; `packages/shared/src/weapon-muzzle.ts`; `packages/shared/src/hit-envelope.ts`; `packages/client/src/net/prediction.ts`; `e2e/tests/burst-origin-moving.spec.ts`; HANDS implementation/gate. Muzzle overrides are allowed only for honest multi-bore/recessed art failure cases with reasons; no world-space offset or transform fork.

**Live/verification gate.** The catalog gate fires every assigned weapon and records accepted trigger packets: count, per-projectile damage, art key/scale, initial art-space muzzle, direction/cone, parallel spacing, detonation radius/damage, cadence, and user recoil. It must explicitly prove Rocket Tube's repeated bigger explosion and trigger-hand placement, Mesa's new cadence/explosion, all cone/parallel orders, and every generated texture. The separate repeat gate must capture **six simultaneously visible Stormcaller beams**, each matched to a distinct barrel point within 2.5 px while stationary and strafing. Rerun sampled muzzle, moving burst, and HANDS gates.

**Risk and mitigation.** Pellet/parallel changes can multiply DPS; size/grip changes can break Wave A's muzzle; visual-only Stormcaller beams can disagree with authority; Mesa's cadence plus explosion can double-count. Produce a before→after trigger-total/DPS table first, split packet damage deliberately, regenerate muzzle points after size changes, and compare every rendered origin to the canonical art point—not player center.

**Claude work-order outline.**

- Baseline all 18 definitions, DPS packets, muzzle points, and live failure signatures before editing.
- Wire generated identity assets and author data-driven counts/cones/parallel barrels/explosions/grips through shared authority.
- Regenerate catalog+muzzles and add server packet/economy laws plus the all-row live catalog gate.
- Treat Stormcaller and Rocket as repeat escalations with dedicated retained evidence; rerun Wave A non-regressions.

## Sol 8 — `v7-melee-caster-orders`

**Mission and rows.** Implement the nine assigned melee/caster/carry orders, including server-owned thrown/combo motion and generated VFX integration. Owns every row in its allocation table.

**Exclusive writes.** `docs/sol-reports/v7-melee-caster-orders.md`; `docs/owner-notes-audit-v7-evidence/melee-caster/**`; `data/weapon-concepts-300.json`; `tools/artkit/gen-weapon-expansion.mjs`; `packages/shared/src/weapons-expansion.generated.ts`; `packages/shared/src/weapons.ts`; `packages/shared/src/melee.ts`; `packages/shared/src/hit-envelope.ts`; `packages/server/src/rooms/GameRoom.ts`; new `packages/server/src/rooms/GameRoom.v7-melee-caster.test.ts`; `packages/client/src/scenes/ArenaScene.ts`; `packages/client/src/entities/SpriteRig.ts`; `packages/client/src/sprites/pose-language.ts`; `packages/client/src/vfx/caster-vfx-recipes.ts`; `packages/client/src/vfx/quake-vfx-recipes.ts`; `packages/client/src/vfx/weapon-effect-recipes.ts`; `packages/client/src/vfx/weapon-effect-vfx.ts`; the nine corresponding files under `tools/weaponsmith/assignments/` plus `tools/weaponsmith/assignments.json`; `packages/client/src/vfx/weapon-vfx.generated.ts`; new `tests/v7-melee-caster-orders.test.ts`; new `e2e/tests/v7-melee-caster-live-gate.spec.ts`.

**Read only.** ART production assets; `packages/shared/src/weapon-muzzle.ts`; `packages/client/src/net/prediction.ts`; BeamRenderer and BEAM's structure art/recipes except the explicitly leased `caster-vfx-recipes.ts` integration pass; KATANA's rest/moveset evidence. Do not alter katana rows or beam structure families.

**Live/verification gate.** Exercise all nine rows through real accepted attacks. Required measurements: Gravewarden angle continuity across chained revolutions; Spontoon throws itself; Boothook clears an over-shoulder apex; Saint-Bough remains one-hand upright and walks with the staff idiom; Nullspike performs rapid stab/stab/finisher with the far hand on the painted purple bandage and no actual launch; Fulgurite fills inward in blue; Voulge's larger blue damaging silhouette agrees with the shared envelope; Tombstone emits stones/smoke and zero bone particles; Idol is exactly 1.4×. Record DPS/reach changes and frame evidence.

**Risk and mitigation.** Client-only acrobatics can lie about thrown/combo motion, continuous spin can reset between accepted beats, and a larger Voulge effect can violate the collision law. Use server thrown/performance/authoritative-combo seams, phase-continuous integer revolutions, and make Voulge's shared envelope match its damaging generated art while leaving damage/cooldown unchanged. Use visual-only knock-up flavor for Nullspike as the audit explicitly permits.

**Claude work-order outline.**

- Reproduce/capture each row and map it to generic thrown, combo, carry, aura, quake, or generated-VFX seams.
- Implement data-first; add only reusable pose/combo primitives where the current vocabulary cannot express the order.
- Synchronize damaging VFX geometry through `hit-envelope.ts`, preserving numeric DPS unless explicitly ordered.
- Add the nine-row live gate and focused authority/presentation laws, then run codegen/full static gates.

## Sol 9 — `v7-remaining-qualification`

**Mission and rows.** Independently certify every Wave B/C/D row, with special ownership of the Galvanic Overcasters verification-only row and the final closure matrix. It must not implement fixes.

**Exclusive writes.** `docs/sol-reports/v7-remaining-qualification.md`; `docs/owner-notes-audit-v7-evidence/qualification/**`; new `docs/sol-reports/v7-remaining-ledger.json`; new `e2e/tests/v7-remaining-qualification.spec.ts` only if a thin cross-row assertion is missing. All game, catalog, generator, existing test, and existing evidence files are read-only.

**Read only.** The entire repository outside those four paths, especially all nine preceding reports, Wave A reports, product code, and permanent gates.

**Live/verification gate.** First verify every ledger row has a report, focused law, live evidence, and owner-stack-safe permanent gate. Re-run repeat/invisibility gates for HANDS, BEAM, all 14 katanas, Stormcaller, Rocket Tube, movement, and the already-shipped Overcasters moving burst; compare Overcasters to its retained 12-round/3-burst ≤2.5 px contract. Then run `pnpm gen:check`, `pnpm assets:check`, `pnpm typecheck`, a complete serial Vitest invocation, and exact `CI=1 pnpm e2e` with the repository retry policy. Keep browser runs serial and use private stacks.

**Risk and mitigation.** A giant final run can rotate sampling flakes or hide a missing row behind aggregate green. Qualify row-by-row before aggregate execution, retain the exact failing trace, retry only under existing policy, and return real product failures to the named owning Sol. The verifier never weakens thresholds, patches code, or labels harness contention as green.

**Claude work-order outline.**

- Build the machine-readable 34-named-weapon closure matrix (33 Wave D table rows plus Thunderhead under V7-HANDS), alongside the three Wave B systemics and 14-active-katana Wave C matrix, from durable reports and diffs.
- Re-run all permanent gates serially, emphasizing repeats and the Wave A affine/hit non-regressions.
- Run canonical codegen/assets/type/unit/e2e aggregates on a quiet private stack.
- Publish pass/fail evidence per row; return failures to the owning Sol and qualify again after its committed fix.

## Deferred and deliberately merged work

- **Defer the three post-watermark notes** at `03:36Z+` (Dustreaper fire-dragon VFX, Dervish Greatblade 2×, Mournveil Scythe 1.3×). They are outside the v7 watermark `02:35:18Z` and belong in the next audited ledger.
- **Defer new choreography for archived Kagewake and Hushglass.** Their durable definitions remain valid, but they are intentionally absent from every active acquisition/playtest surface. Reopen only if the owner unarchives them.
- **Do not launch an Overcasters fixer.** Wave A already fixed and permanently gated it; the independent qualifier re-proves the row. A failure goes back to that shipped surface, not to a speculative duplicate Sol.
- **Merge Frostquill with BEAM and Hailwidow with KATANA.** Each merge removes a second writer on the exact renderer/catalog row and lets one live gate prove both requirements together.
- **Merge both archives with the new throwing-star line.** All three change catalog/resource/portal/Weaponsmith census, so one regeneration is safer and cheaper than three.
- **Merge all non-beam generated identity art into one render farm, but not gameplay wiring.** Generation parallelizes well; integration and balance do not.
- **Do not add a separate katana design or generic final-fix Sol.** The katana owner records design before implementation in its durable report; qualification returns defects to the original owner so file ownership remains intelligible.
