# Audit Orchestration Synthesis

## Reading notes and evidence map

- Read in full: `audit-structure.md` — nominal package layering is sound, but `ArenaScene`, `GameRoom`, and `SpriteRig` concentrate ownership; character presentation and wardrobe are entangled; generated checks can skip; protocol/cooldown contracts diverge (`docs/sol-reports/audit-structure.md:26-37,45-135,238-246`).
- Read in full: `audit-movement.md` — ordinary WASD is sound, but owner recoil is outside replay, movement/cancel policy is duplicated, reconciliation can hide large debt, and cosmetic hit-stop advances simulation behind a frozen owner (`docs/sol-reports/audit-movement.md:28-39,66-175,241-255`).
- Read in full: `audit-weapons.md` — melee and ordinary point-blank gun paths are credible, but projectile collision bypasses the shared envelope, fast thrown rows can tunnel, and Seraph presents a damage-looking beam different from authority (`docs/sol-reports/audit-weapons.md:9-17,21-57,140-160`).
- Read in full: `audit-qa.md` — 1,790 tests favor pure logic over Phaser/Colyseus assembly; the full suite exposed an isolated-pass/full-run failure; source-text tests, retries, missing live treaties, and EOL drift weaken the green signal (`docs/sol-reports/audit-qa.md:18-36,40-60,82-169,201-217`).
- Skimmed outstanding owner batches B1-B13 and their file ownership/acceptance clauses. The ledger proposes 13 integrators plus 15 one-subject art Sols and warns that B2, B3, and B5-B13 share catalog/generated surfaces (`docs/sol-reports/notes-ledger-v9.md:87-323`).
- Reviewed orchestration: implementation Sols are intended to use isolated worktrees, while report-only Sols write distinct main-tree reports (`tools/sol/worktree.sh:2-16`; `docs/sol-reports/README.md:1-10`). The helper nevertheless hard-codes a base, auto-stages everything, masks checkout failure, and force-removes work (`tools/sol/worktree.sh:23-53`).
- Reviewed janitor and CI: janitor defers on a busy tree and always exits green for test/generator findings; it also restores tracked drift with a broad checkout (`tools/janitor/run-janitor.mjs:11,55-83,108-124,149-182`). CI has broad static/build coverage, but its only browser lane runs the full serial suite under a five-minute cap and uploads no diagnostic artifacts (`.github/workflows/ci.yml:24-39,61-80`; `docs/sol-reports/audit-qa.md:201-217`).
- Confirmed the art law: each image subject gets a fresh agent/context and unique subject key; one context cannot generate another weapon, character, VFX subject, pet, or form (`docs/design/pet-robotic-gate.md:34-44`). The ledger maps this to exactly 15 art subjects across B2, B3, B11, B12, and B13 (`docs/sol-reports/notes-ledger-v9.md:105-131,257-299`).

## Executive recommendation

Do not launch the 15-subject art/content fleet yet. Run a stabilization program first:

1. Establish truthful, deterministic merge gates and repository parity.
2. Land explicit character-render, owner-movement/replay, and damage-envelope contracts, fixing B1 and B4 inside those contracts.
3. Decompose the hot runtime seams and retire wardrobe/protocol debt.
4. Harden the weapon platform before processing the remaining catalog batches.
5. Merge catalog batches serially; art subjects may be generated in parallel only after their governing render/hit contracts are frozen.

The core rule is **parallelize evidence and disjoint modules; serialize mutation ownership and generated catalogs**. Worktrees prevent file clobbering, but they do not make two divergent edits to `ArenaScene.ts`, `GameRoom.ts`, `SpriteRig.ts`, or generated registries semantically mergeable. The four audits repeatedly locate defects at those exact seams (`docs/sol-reports/audit-structure.md:45-56`; `docs/sol-reports/audit-movement.md:66-175`; `docs/sol-reports/audit-weapons.md:21-57`; `docs/sol-reports/audit-qa.md:40-60`).

## 1. Cross-cutting themes and ranked systemic risks

### 1 — Critical: green checks do not execute the shipped boundary

This is the strongest four-audit consensus. Character tests exercised rig pieces but not the catalog-to-normal-join decision; movement tests exercised predictor math but not `ArenaScene` patch/input wiring; projectile tests compared shared authoring with itself without proving `GameRoom` used it; current generated checks can explicitly skip comparisons and still pass. Ten Arena-related cases inspect source spelling, and CI retries browser failures once (`docs/sol-reports/audit-structure.md:74-105`; `docs/sol-reports/audit-movement.md:251-253`; `docs/sol-reports/audit-weapons.md:21-35,154-158`; `docs/sol-reports/audit-qa.md:40-60,82-111,201-217`). This is the systemic form of “green tests, wrong runtime.”

**Program consequence:** every high-risk fix needs a production-path LIVE treaty that starts from physical/browser input or normal state flow and observes authority plus local/remote presentation. Source grep and helper-only tests may supplement that treaty but cannot accept the work.

### 2 — Critical: damage truth can disagree with damage-looking pixels

Three independent paths violate one trust contract:

- all friendly projectile rows should sweep a shared, art-derived damage envelope, but later thrown/scatter steps use discrete radius-10 samples (`docs/sol-reports/audit-weapons.md:21-35`; `packages/server/src/rooms/GameRoom.ts:12955-12972,13087-13168`);
- Seraph’s owner beam replaces the replicated, lagged authority angle with the live cursor angle (`docs/sol-reports/audit-weapons.md:37-45`; `packages/client/src/vfx/BeamRenderer.ts:617-634`);
- roll avoidance is call-site-dependent rather than an explicit hit policy, so visually similar threats differ in whether the safe window applies (`docs/sol-reports/audit-movement.md:131-141`; `packages/server/src/rooms/GameRoom.ts:9990-10012,11957-11973,13050-13070`).

Art-derived `characterScale` also reaches authoritative muzzle geometry while melee follows a different scale policy (`docs/sol-reports/audit-structure.md:66-72`; `packages/server/src/rooms/GameRoom.ts:6717-6726,8443-8467,10646-10670`). Until these are unified, adding projectile, hybrid, beam, VFX-extension, or character art multiplies untrusted exceptions.

**Program consequence:** freeze B2, B3, B7, B11, and B12 integration until projectile sweep/envelopes, beam truth, tracked gameplay sockets, and the two-client hit treaty are green.

### 3 — Critical: owner movement effects are outside one deterministic replay timeline

The Overcasters bug is not a weapon-only defect. Client burst callbacks mutate predictor velocity on render time, pending replay contains no recoil event, authority applies rounds on fixed simulation ticks, and reconciliation overwrites/replays only movement commands (`docs/sol-reports/audit-movement.md:66-87`; `packages/client/src/scenes/ArenaScene.ts:10438-10472`; `packages/client/src/net/prediction.ts:1209-1282`). The same seam explains divergent cancels, invisible post-roll parry lock, local hit-stop debt, weapon-agnostic attack cooldown, and later attack-authored root motion risk (`docs/sol-reports/audit-movement.md:99-163`; `docs/sol-reports/audit-structure.md:58-64`; `docs/sol-reports/notes-ledger-v9.md:133-160`).

**Program consequence:** land one shared fixed-tick movement/action transition plus journaled owner events and authority receipts before B4, and require B4 before B5. Do not hide the defect by raising snap thresholds or adding presentation clamps.

### 4 — Very high: the three god files turn orchestration concurrency into regression risk

`ArenaScene` is about 15.8k lines/597 members, `GameRoom` about 14.2k/414, and `SpriteRig` about 10.9k/445. They mix networking, simulation, combat, UI, rendering, equipment, and pose state (`docs/sol-reports/audit-structure.md:19-24,45-56`; `packages/client/src/scenes/ArenaScene.ts:1176-15800`; `packages/server/src/rooms/GameRoom.ts:1049-14234`; `packages/client/src/entities/SpriteRig.ts:1929-10911`). Movement, weapons, structure, and QA audits all cite failures at cross-responsibility transitions inside these files.

**Program consequence:** first add characterization/live gates, then extract one mutation owner at a time. No wave may assign two simultaneous implementation Sols to the same god file region. A worktree is isolation, not a merge strategy.

### 5 — Very high: character rendering is not a stable platform for more content

Whole-art selection and later reconciliation each repeat a `proto-` prefix branch; gear sync can reinstall boilerplate parts, and presentation scale is mixed with gameplay geometry (`docs/sol-reports/audit-structure.md:66-89`; `packages/client/src/scenes/ArenaScene.ts:4358-4397,8993-9017`; `packages/client/src/entities/SpriteRig.ts:2887-2959`). The live gate covers only three prototype IDs and invokes a private remount instead of normal join/swap flow (`docs/sol-reports/audit-qa.md:40-46`; `e2e/tests/char-proto.spec.ts:94-116,223-257`).

**Program consequence:** introduce `CharacterRenderSpec`, `AvatarVisual`, explicit sockets, and catalog completeness before wardrobe deletion or any new character/content platform work. Then retire wardrobe persistence-to-authority-to-client, preserving wire tombstones until a protocol reset (`docs/sol-reports/audit-structure.md:74-89,123-135`).

### 6 — High: reproducibility and local/CI parity are not trustworthy

`gen:check` can skip character/VFX comparisons because canonical inputs are untracked; the generated manifest installer parses generated TypeScript as its database and fails open; the Windows worktree had 128 CRLF and 32 mixed tracked files while Ubuntu CI remained plausible-green; one full Vitest run failed a case that passed alone (`docs/sol-reports/audit-structure.md:91-105,171-177`; `docs/sol-reports/audit-qa.md:18-23,129-169`). CI therefore cannot reliably distinguish a stale artifact, a platform formatting difference, a deterministic failure, and a flake.

**Program consequence:** make tracked canonical inputs and fail-closed checks mandatory, normalize LF in one isolated commit, and require deterministic fixtures/seeds before interpreting repeat-run results.

### 7 — High: contracts are stringly, duplicated, or guarded by historical counts

Schema compatibility is detected after subscription and does not disconnect; roughly 30 handlers are registered inline with inconsistent action budgets; decoded client rows expose server-only getters; cooldown, bound-pair bonuses, payload semantics, acquisition roles, and exact catalog counts have multiple truths (`docs/sol-reports/audit-structure.md:107-121,147-177`; `docs/sol-reports/audit-weapons.md:47-123`). This makes content additions change runtime, UI, and tests in ways the type system cannot prove.

**Program consequence:** introduce typed/versioned messages, early schema negotiation, structural client DTOs, shared ready/loadout/payload resolvers, and relational catalog invariants before the catalog expansion wave.

## 2. Prioritized program

### Dependency spine

```text
Wave 0: truthful gates and reproducible tree
  ├─> Wave 1A: B1 screen truth ───────────────────────────────┐
  ├─> Wave 1B: CharacterRenderSpec + AvatarVisual ─> wardrobe │
  ├─> Wave 1C: shared movement stepper ─> B4 ─> B5            ├─> catalog waves
  └─> Wave 1D: projectile/beam/hit truth ─> B2/B3/B7/B11/B12  │
                                                               │
Wave 2: typed seams, god-file extraction, wardrobe retirement ─┤
Wave 3: weapon scheduler/loadout/payload/catalog invariants ───┘

Wave 4: B5-B10 correctness and maintenance, one catalog merge at a time
Wave 5: B2/B3/B11-B13 content/art, one catalog merge at a time
Wave 6: measured polish, scale, and optional-mode cleanup
```

The ordering intentionally differs from the ledger’s request-order sequence: its safe-merge advice remains valid, but the audits establish that new content should not precede the runtime contracts it will exercise. B1 still precedes left/right content gates, B4 still precedes B5, and B10 still precedes B12 (`docs/sol-reports/notes-ledger-v9.md:301-321`).

### Wave 0 — Make “green” mean reproducible and behaviorally relevant

1. **Normalize repository text in a dedicated commit.** Add root `.gitattributes` with LF for text and explicit binary exclusions; set Biome LF; scope lint inputs; run `git add --renormalize .` with no semantic edits; add an EOL guard and verify lint on Ubuntu and Windows. This must merge alone because it mechanically touches broad history (`docs/sol-reports/audit-qa.md:157-169`; `biome.json:8-26`; `.github/workflows/ci.yml:24-39`).
2. **Create one deterministic arena/room fixture.** It must flatten tiles, pits, POIs and clusters, rebuild the immutable POI collision index, disable unrelated directors, inject seeded RNG and fake time, and enforce teardown. Rewrite the confirmed flight-retarget flake first (`docs/sol-reports/audit-qa.md:129-155`; `packages/shared/src/mapgen.ts:791-792,1238-1250`; `packages/server/src/rooms/GameRoom.test.ts:2713-2737`).
3. **Make generation reconstructible and fail closed.** Track canonical character geometry/VFX descriptors; create a generated-artifact registry; fail `--check` on missing inputs; stop parsing generated TypeScript as source; replace exact content totals with relational invariants (`docs/sol-reports/audit-structure.md:91-105,163-177`; `tools/artkit/gen-character-roster.mjs:23-30`; `tools/artkit/harvest-install.mjs:181-232`).
4. **Split test lanes.** Add `e2e:critical` with no retry, `e2e:catalog` sharded with artifacts, and scheduled `e2e:soak`; add the omitted ArtKit Node suite; preserve server logs, traces, screenshots, seed, and room snapshot on failure (`docs/sol-reports/audit-qa.md:171-217,252-261`; `.github/workflows/ci.yml:61-80`; `tools/artkit/lib/gear-replacement-contract.test.mjs:28-213`).
5. **Harden orchestration helpers and janitor status.** Record the actual base/ref at worktree creation, refuse dirty/out-of-scope merges, remove masked failures and implicit commits, protect unmerged work on removal, and make janitor outcomes machine-distinct: `clean`, `stable-fail`, `flaky`, `generator-fail`, `infra-deferred`. Details are in section 4.

**Wave gate:** both OS lint checks pass; `gen:check` reports zero skips and reconstructs every registered output; the deterministic fixture passes in randomized order/repeat; critical E2E has no global retry and uploads failure artifacts; worktree and janitor dry runs refuse unsafe states. This wave changes infrastructure, not gameplay behavior.

### Wave 1 — Repair ship-blocking runtime truth

Merge these tracks in the order below. They may be developed in parallel only when their leases are disjoint; any branch touching the same region of `ArenaScene`, `GameRoom`, or `SpriteRig` rebases and reruns LIVE gates before merge.

1. **B1 screen-truth contract.** Fix damage-number parent/camera transforms and asymmetric projectile facing first so every later left/right gate inherits the same contract. Gate the holy skull and manifest-declared asymmetric projectiles under pan, zoom, nested containers, and both directions (`docs/sol-reports/notes-ledger-v9.md:91-103`; `packages/client/src/ui/damage-numbers.ts`; `packages/client/src/scenes/arena/projectile-factory.ts`).
2. **Character render and gameplay geometry contract.** Add catalog-backed `CharacterRenderSpec` and `AvatarVisual` implementations for articulated/whole characters; make wardrobe an optional decorator; replace prefix branching; add explicit tracked collision/socket geometry; keep `presentationScale` client-only. Do not begin wardrobe deletion until this gate is green (`docs/sol-reports/audit-structure.md:66-89`; `packages/client/src/scenes/ArenaScene.ts:4358-4397,8993-9017`; `packages/server/src/rooms/GameRoom.ts:6717-6726,10646-10670`).
3. **Shared movement/action stepper.** Extract pure fixed-tick stance, buffer, cancel, impulse, and effect-intent transitions used by both predictor and authority. Add golden 100+ tick traces before moving mutation ownership (`docs/sol-reports/audit-movement.md:99-129`; `packages/client/src/net/prediction.ts:551-752,978-1030`; `packages/server/src/rooms/GameRoom.ts:4765-5520`).
4. **B4 Overcasters on that stepper.** Journal every burst recoil as `{attackSeq, roundIndex, simTick, target, impulse}`; apply after movement integration; add per-round authority receipts; replay unconfirmed events; never mutate rollback state from render-clock callbacks (`docs/sol-reports/audit-movement.md:66-87`; `docs/sol-reports/notes-ledger-v9.md:133-145`; `packages/client/src/scenes/ArenaScene.ts:10438-10472`).
5. **Projectile and beam truth.** Resolve shared projectile capsules into spawn metadata and sweep every friendly row every tick; make Seraph render the replicated damage line or change authority to the declared aiming policy; add explicit `PlayerHitPolicy` at the hostile-hit resolver rather than call-site immunity (`docs/sol-reports/audit-weapons.md:21-45`; `docs/sol-reports/audit-movement.md:131-141`; `packages/shared/src/hit-envelope.ts:338-353`; `packages/server/src/rooms/GameRoom.ts:12955-13168`; `packages/client/src/vfx/BeamRenderer.ts:617-634`).

**Wave gate:**

- character: every selectable ID resolves through the catalog; normal local join, remote join, and mid-session swap rebuild once; whole-art never requests boilerplate/gear; client sockets and tracked authority origins stay within the declared tolerance (`docs/sol-reports/audit-qa.md:40-46`);
- B4: ten bursts in four directions plus hard reversals at 100/200 ms RTT with jitter; peak owner rig/authority error `<=64 px`, steady `<=32 px`, return to `<=4 px` within 250 ms, no rejected/cancelled recoil (`docs/sol-reports/audit-movement.md:66-87`);
- hit treaty: actual mouse input, two clients, one melee/one projectile/one beam, exactly one authoritative HP delta, observer agreement, deliberate miss, packet loss/latency, and predicted VFX replacement rather than duplication (`docs/sol-reports/audit-qa.md:56-60`);
- projectile specifics: Kunai cannot tunnel through a Mote Swarm, Hand Mortar collision matches its damaging alpha bounds, and Seraph owner/observer/damage geometry is identical (`docs/sol-reports/audit-weapons.md:21-45`).

### Wave 2 — Create stable ownership seams, then retire coupled systems

1. **Extract in characterization-sized commits.** From `ArenaScene`: connection, entity presentation, combat presentation, HUD, and armory overlay. From `GameRoom`: typed router, simulation pipeline, player combat, enemy/combo, projectile/zone, and run director. From `SpriteRig`: pure pose computation, pose application, weapon composition, and optional avatar decoration. Each commit moves one mutation owner and proves behavior before/after (`docs/sol-reports/audit-structure.md:45-56`; `packages/client/src/scenes/ArenaScene.ts:2013-2332,4204-4862,10130-10462`; `packages/server/src/rooms/GameRoom.ts:1390-2336,5306-6331,6476-9220`; `packages/client/src/entities/SpriteRig.ts:8109-10910`).
2. **Type and version the wire boundary.** Define versioned shared message maps and runtime validators; make budget policy explicit on registration; negotiate schema/protocol before state subscription and disconnect on mismatch; give clients structural decoded DTOs rather than server-only getters (`docs/sol-reports/audit-structure.md:107-121,147-161`; `packages/client/src/scenes/ArenaScene.ts:4307-4323`; `packages/server/src/rooms/GameRoom.ts:1390-2336`).
3. **Retire wardrobe in strict migration order.** Add the account migration/replacement identity source; remove gear-derived combat and server snapshots; publish empty wardrobe wire values; switch every character to `AvatarVisual`; then delete menu/runtime/baker/catalog/assets/generator. Preserve decorated schema positions as named tombstones until a major reset (`docs/sol-reports/audit-structure.md:123-135,227-236`; `packages/shared/src/meta.ts:111-313`; `packages/shared/src/state.ts:61-75`).
4. **Close movement/action P1s on the shared stepper.** Journal attack/parry edges, publish one cancel matrix, centralize roll hit policy, separate hit-stop animation time from owner transform time, and bound reconciliation by error magnitude/age. Tune acceleration only after these are green (`docs/sol-reports/audit-movement.md:89-175,241-249`; `packages/client/src/net/prediction.ts:1284-1483`; `packages/client/src/scenes/ArenaScene.ts:4802-4838`).
5. **Prune only after ownership moves.** Remove unpaired legacy endpoints and either isolate belt behind a mode strategy or delete it through a versioned change. Do not delete current wire tombstones (`docs/sol-reports/audit-structure.md:179-217,227-236`; `packages/shared/src/state.ts:118-122,692-737`).

**Wave gate:** production-path character, physical-input, reconnect/reordering, B4, hit-registration, and one boss-phase gates remain green; schema mismatch is rejected before state use; old account fixtures migrate without losing unrelated progression; no production import escapes into ignored ArtKit output. Source-text tests for moved behavior are replaced with behavioral tests (`docs/sol-reports/audit-qa.md:221-249`).

### Wave 3 — Harden weapon scheduling and catalog semantics

1. Share one accepted-attack interval/ready-state descriptor, including class/grip modifiers, per-instance cooldown debt, and draw lock; rebase owner prediction on identity change (`docs/sol-reports/audit-structure.md:58-64`; `docs/sol-reports/audit-weapons.md:47-57`; `packages/server/src/rooms/GameRoom.ts:2977-3093,5824-5854`).
2. Move effective bound-pair loadout calculation to shared code and use it in authority, HUD, level-up, and previews (`docs/sol-reports/audit-weapons.md:69-79`; `packages/server/src/rooms/GameRoom.ts:3439-3448`; `packages/client/src/ui/pair-preview.ts:85-126`).
3. Declare `payloadSemantics` and use one seeded volley builder; make row-cap admission atomic or damage-preserving; remove gameplay `Math.random` on fixed-gun spread (`docs/sol-reports/audit-weapons.md:81-91`; `packages/server/src/rooms/GameRoom.ts:10492-10501,10695-10737`).
4. Replace historical totals with explicit `ACTIVE`, `GALLERY`, `DROP`, `CURATED_CYCLE`, and `ARCHIVED` membership rules plus relational invariants (`docs/sol-reports/audit-weapons.md:115-123`; `docs/sol-reports/audit-structure.md:163-169`; `packages/shared/src/weapon-resource.ts:283-320`).
5. Add the 141-weapon live-pose muzzle matrix at representative facing/aim/recoil/dual/belt states, with explicit pose-family metadata replacing name regexes as exceptions appear (`docs/sol-reports/audit-weapons.md:93-103`; `packages/shared/src/weapons.ts:884-935`; `packages/client/src/entities/SpriteRig.ts:3318-3373`).

**Wave gate:** no ghost/late attack across swaps; preview and server agree on set bonuses/Drive; neutral DPS and Drive-per-damage snapshots are deterministic; catalog roles are bijective/intentional without global count crashes; every ranged pose stays inside the declared origin tolerance.

### Wave 4 — Process outstanding correctness/maintenance batches B5-B10

With B1 and B4 already closed in Wave 1, merge the remaining non-new-art correction batches in this order:

1. **B5 attack-authored root movement:** Sparkknuckle has no attack drift; Stormfists uses a collision-safe server dash and endpoint-only hit/VFX. This depends on the shared movement/action event contract (`docs/sol-reports/notes-ledger-v9.md:147-160`).
2. **B6 archives:** archive the two specified IDs without breaking old-save resolution; this depends on explicit catalog roles rather than hard totals (`docs/sol-reports/notes-ledger-v9.md:162-175`).
3. **B7 thrown conversions:** convert the three specified weapons after continuous projectile collision is universal (`docs/sol-reports/notes-ledger-v9.md:177-191`).
4. **B8 pose/grip/combo language:** seven requested pose/combo corrections through explicit metadata and authoritative hit gates (`docs/sol-reports/notes-ledger-v9.md:193-220`).
5. **B9 size/orientation:** apply presentation multipliers and Prismhex mirror without changing gameplay reach/damage (`docs/sol-reports/notes-ledger-v9.md:222-238`).
6. **B10 VFX cleanup:** reuse/remove the named effects and remove Headsman’s extension from both presentation and envelope census. B10 must be green before B12 (`docs/sol-reports/notes-ledger-v9.md:240-255,321`).

**Wave gate:** each batch’s ledger acceptance signal is a required LIVE test, plus catalog generation, asset referential integrity, deterministic DPS/hit envelopes, and old-save fixtures. These six catalog-touching branches merge strictly one at a time.

### Wave 5 — Add content only on the hardened platform

Merge in this order:

1. **B2:** seven wacky weapons, backed by seven one-subject art Sols.
2. **B3:** three fan melee/projectile hybrids, backed by three one-subject art Sols.
3. **B11:** Fire Dragon, Purple Crystal, and Arcanist Lance image-VFX subjects, backed by three art Sols.
4. **B12:** Mirage hardlight extension, one art Sol; depends on B10’s removal of Headsman.
5. **B13:** Wyrmskull mouth-open registered frame, one art Sol.

Evidence and acceptance details are authoritative in the ledger (`docs/sol-reports/notes-ledger-v9.md:105-131,257-299`). All 15 art subjects may be generated/reviewed in parallel after B1, render-spec, facing, envelope, and provenance contracts freeze. Integrators must consume approved assets but may not ask an art Sol to alter catalog/server/client code.

**Wave gate:** each subject passes provenance/alpha/registration; each batch passes its distinct behavior signature and normal-flow LIVE gallery; every damaging visible lobe matches authority; left/right/remote presentation inherits B1; no two B2 weapons share the same mechanical-plus-visual signature; each fan proves both close melee and its own authoritative projectile.

### Wave 6 — Measured polish and scale, not release blockers for content

After correctness data is stable, A/B movement acceleration/deceleration, pit coyote, traversal exits, camera target, co-op body policy, adaptive snapshot delay, and alternate aim accessibility. Separately measure patch bytes/entity budgets before StateView/AOI or larger player/entity targets, and add full boss-phase/VFX lifecycle gates (`docs/sol-reports/audit-movement.md:177-239`; `docs/sol-reports/audit-weapons.md:105-113`; `docs/sol-reports/audit-structure.md:195-209`; `docs/sol-reports/audit-qa.md:68-80`). These are safe parallel tracks once they operate behind the Wave 2 ownership seams.

## 3. Sol fleet design

### Fleet-wide role rules

- **Implementation Sol:** one bounded behavior/ownership change in an isolated worktree; may edit code/tests only inside its declared lease; creates its durable report first and appends validation last (`tools/sol/worktree.sh:2-16`; `docs/sol-reports/README.md:1-10`).
- **Art-only Sol:** one image subject, one fresh generation context, one subject asset/provenance lease, and no catalog/manifest/gameplay edits. Its branch is not merged directly; the batch integrator consumes the reviewed asset commit so assets and references land atomically (`docs/design/pet-robotic-gate.md:34-44`; `docs/sol-reports/notes-ledger-v9.md:301-303`).
- **Read-only acceptance Sol:** uses the main tree only because it changes no code/tests and writes a unique `docs/sol-reports/<gate>.md`; reruns production-path gates and reviews the diff against the work order. It cannot waive a red gate.
- **Catalog integrator:** the only Sol allowed to touch catalog source, generated weapon output, shared manifests, or catalog census for its batch. Only one catalog integrator may be merge-active at a time.
- **Lease collision rule:** two implementation Sols may run concurrently only if `git diff --name-only` ownership is disjoint or their shared files have non-overlapping, predeclared generated/append-only ownership. `ArenaScene.ts`, `GameRoom.ts`, `SpriteRig.ts`, `state.ts`, weapon concept source, and generated manifests default to exclusive leases.

### Recommended composition by wave

| Wave | Implementation Sols | Read-only acceptance Sols | Art-only Sols | Concurrency and merge rule |
|---|---:|---:|---:|---|
| 0 — truth infrastructure | 5 | 1 | 0 | LF normalization merges alone first. Fixture, generator, CI-lanes, and orchestration-tooling Sols may then run in parallel on disjoint leases; CI-lanes merges after commands/helpers exist. |
| 1 — runtime truth | 7 | 3 | 0 | B1, character render, movement stepper, B4, projectile envelope, beam truth, and hit-policy/treaty. Develop disjoint tests/modules in parallel; serialize god-file merges in the listed Wave 1 order. |
| 2 — seams/retirement | 8 | 2 | 0 | Arena extraction, GameRoom extraction, SpriteRig extraction, protocol/schema, wardrobe persistence/server, wardrobe client/assets, movement/correction, legacy/belt. Core extractions and wardrobe stages must serialize; extracted modules permit later parallelism. |
| 3 — weapon platform | 5 | 1 | 0 | Ready scheduler, effective loadout, volley/payload, catalog roles, and live-muzzle matrix. Shared resolver/catalog merges serialize; test-matrix work may run in parallel. |
| 4 — B5-B10 | 6 catalog integrators | 2 | 0 | One integrator per batch, but only one is implementation-active against the catalog head at a time. Read-only fixture/acceptance preparation can be parallel. |
| 5 — B2/B3/B11-B13 | 5 catalog integrators | 2 | 15 | All art Sols may run in parallel after contracts freeze. Integrators merge strictly one at a time and absorb their own reviewed art commits. |
| 6 — measured polish | 6 | 2 | 0 | Movement feel, aim/accessibility, AOI/replication, boss phase, VFX lifecycle, and scheduled browser/soak lanes can run in parallel behind extracted interfaces. |

The numbers are roles, not a recommendation to keep all roles active simultaneously. With limited capacity, prioritize one mutation-owner Sol, one disjoint gate/tooling Sol, and one read-only verifier. Adding more Sols to a shared god file or catalog does not shorten the critical path.

### Wave 0 fleet detail

1. `eol-parity` — implementation worktree; only `.gitattributes`, formatter/lint policy, EOL guard, and the mechanical normalization commit.
2. `deterministic-arena-fixture` — implementation worktree; fixture builder, seeded RNG/fake clock, teardown, and the first flaky spatial test conversion.
3. `generated-registry` — implementation worktree; canonical tracked inputs, fail-closed registry/check, manifest-source repair, relational census guards.
4. `ci-live-lanes` — implementation worktree; critical/catalog/soak commands, no-retry critical config, artifacts, ArtKit Node test step, coverage reporting.
5. `sol-tooling-truth` — implementation worktree; worktree state manifests/preflights and janitor result schema.
6. `wave0-witness` — read-only main-tree report; independently verifies both-OS CI results, zero skipped generators, repeated deterministic fixture, safe worktree refusal paths, and truthful janitor exit/status.

The Wave 0 acceptance gate is predominantly command/CI evidence because the work is process infrastructure; it must nevertheless exercise the real commands rather than grep their YAML spelling (`docs/sol-reports/audit-qa.md:201-217`).

### Wave 1 fleet detail

1. `screen-truth-b1` — client rendering worktree; no catalog. LIVE gate is the ledger’s left/right holy-skull and damage-number pan/zoom/container capture (`docs/sol-reports/notes-ledger-v9.md:91-103`).
2. `character-render-contract` — character data/client worktree; exclusive `ArenaScene`/`SpriteRig` lease. LIVE gate covers normal local/remote join and swap for all render kinds, not private remount (`docs/sol-reports/audit-qa.md:40-46`).
3. `movement-kit-stepper` — shared/client/server worktree; exclusive predictor/GameRoom movement lease. Gate is bit-for-bit golden traces over commands, collisions, cancels, and reconciliation (`docs/sol-reports/audit-movement.md:99-107`).
4. `overcasters-b4` — client/server worktree after stepper; no catalog. LIVE 100/200 ms RTT+jitter thresholds from Wave 1 (`docs/sol-reports/audit-movement.md:66-87`; `docs/sol-reports/notes-ledger-v9.md:133-145`).
5. `projectile-envelope` — shared/server worktree; continuous capsule sweep and alpha-envelope regressions. LIVE projectile hit treaty plus Kunai/Hand Mortar cases (`docs/sol-reports/audit-weapons.md:21-35`).
6. `beam-authority-truth` — shared/client/server worktree after projectile merge/rebase; data-driven Seraph policy and owner/observer geometry equality (`docs/sol-reports/audit-weapons.md:37-45`).
7. `player-hit-policy` — shared/server/client worktree; centralized roll/parry/airborne/persistent taxonomy and exact safety cue. LIVE transient/persistent hazard matrix (`docs/sol-reports/audit-movement.md:131-141`).
8. `render-witness`, `netcode-witness`, `combat-witness` — three read-only reports. Each reruns its LIVE treaty on the final integrated Wave 1 head; unit/source evidence alone is insufficient.

### Wave 2 fleet detail

- Three extraction Sols own `ArenaScene`, `GameRoom`, and `SpriteRig` in sequence. Each moves only one documented responsibility group per commit and leaves a facade compatible with the next Sol (`docs/sol-reports/audit-structure.md:45-56`).
- One protocol Sol owns the typed router, validators, budgets, schema negotiation, and structural decoded DTOs after the connection/router seams exist (`docs/sol-reports/audit-structure.md:107-121,147-161`).
- Two wardrobe Sols serialize: persistence/authority migration first, then client/assets/generator deletion. They may not delete decorated schema positions (`docs/sol-reports/audit-structure.md:123-135,227-236`).
- One movement-policy Sol closes cancel buffering, hit-stop clocks, and correction bands on the Wave 1 stepper (`docs/sol-reports/audit-movement.md:89-175`).
- One legacy-mode Sol removes unpaired endpoints and implements the owner’s belt keep/isolate or remove decision; if that product decision is not available, isolate the already-proven dead endpoints and leave belt unchanged rather than guessing (`docs/sol-reports/audit-structure.md:179-217`).
- Two witnesses: `protocol-migration-witness` runs mismatched-version, old-account, reconnect, and ingress-budget fixtures; `runtime-seams-witness` reruns all Wave 1 LIVE gates plus one boss phase.

The three extraction Sols are not a simultaneous fan-out. They are a queue that creates the module boundaries on which protocol, movement, and later weapon work can safely parallelize.

### Wave 3 fleet detail

Five worktree Sols own, respectively, attack readiness, bound-pair effective loadout, deterministic volley/payload semantics, explicit catalog roles/relational invariants, and the live-pose muzzle matrix. Only the matrix Sol is safely parallel from the start; the four resolver/catalog Sols merge serially because they share `weapons.ts`, `GameRoom`, or catalog contracts (`docs/sol-reports/audit-weapons.md:47-123`).

One read-only `weapon-platform-witness` must use physical input and authority/observer state to verify swaps, previews, payload, and origin truth. A catalog count or source-branch assertion is not acceptance.

### Wave 4 fleet detail

Use six worktree integrators, exactly one per B5-B10. Do not start them all against the same generated base. A Sol may prepare a read-only evidence matrix while waiting, but implementation begins only after it rebases on the prior accepted catalog head:

`B5 -> B6 -> B7 -> B8 -> B9 -> B10`

Two read-only witnesses divide acceptance:

- `notes-gameplay-witness`: authoritative root position, archive migration, thrown damage, combo-hit semantics;
- `notes-visual-witness`: local/remote left/right grips, size ratios, facing, VFX pixels/extents, and no stale effect lifecycle.

Each witness reports after every batch, but a batch is not accepted until both relevant LIVE and deterministic catalog gates pass (`docs/sol-reports/notes-ledger-v9.md:147-255`).

### Wave 5 fleet detail and the art law

Use five worktree catalog integrators and exactly 15 art-only worktrees:

- B2: 1 integrator + 7 art Sols, one weapon subject each;
- B3: 1 integrator + 3 art Sols, one fan subject each;
- B11: 1 integrator + 3 art Sols, one VFX subject each;
- B12: 1 integrator + 1 Mirage extension subject;
- B13: 1 integrator + 1 Wyrmskull open-mouth subject.

Every art branch records `subjectKey`, unique `agentRunId`, reference hashes, alpha/provenance results, and its report; it cannot touch another subject or any catalog/gameplay file (`docs/design/pet-robotic-gate.md:34-44`). The batch integrator reviews and cherry-picks/consumes only accepted subject commits into its worktree. Unused/rejected art never lands on main.

Two read-only witnesses divide the final LIVE gates:

- `content-behavior-witness`: distinct mechanics, authority damage, DPS/resource invariants, hybrid melee+projectile, extension reach;
- `content-visual-witness`: registration, left/right/remote frames, alpha, beam/muzzle anchoring, effect pixels, and cleanup.

Catalog merge order is:

`B2 -> B3 -> B11 -> B12 -> B13`

This is safe only because B1, B4, B5-B10, render/hit contracts, and weapon platform hardening already landed. B12 remains strictly after B10 (`docs/sol-reports/notes-ledger-v9.md:321`).

### Catalog-touching merge protocol

For every Wave 3-5 catalog merge:

1. Record the accepted catalog head SHA and generated-artifact registry digest.
2. Create/rebase the batch worktree on exactly that head; fail if the main worktree or branch base differs.
3. Consume only the batch’s approved art commits, if any; never merge art branches directly.
4. Edit canonical source, run generation exactly once, and inspect generated diff. Reject unrelated reorder/count/manifest churn.
5. Run `gen:check` with zero skips, asset referential integrity, relational catalog roles, deterministic DPS/envelope snapshots, old-save migration where relevant, focused unit tests, and the batch LIVE gate.
6. Have the read-only witness verify the committed branch/head, not an uncommitted worktree.
7. Merge the batch atomically, record the new catalog head/digest, then release the next integrator.

This operationalizes the ledger’s warning that B2, B3, and B5-B13 may touch the same catalog/manifest surfaces (`docs/sol-reports/notes-ledger-v9.md:321`) while avoiding its original content-before-correctness priority.

## 4. Process fixes

### 4.1 Worktree flow: make state explicit and unsafe shortcuts impossible

The current helper has the right isolation intent but unsafe lifecycle details: a hard-coded default base, suppressed install output, implicit `git add -A`/commit, masked base checkout failure, and forced worktree/branch deletion (`tools/sol/worktree.sh:23-53`). Replace those behaviors with:

1. **Explicit creation record.** Require `create <name> --base <ref>` or default to the current checked-out branch/HEAD without a repository-specific literal. Record immutable base SHA, branch, worktree path, role, allowed path lease, report path, and catalog digest in a run manifest.
2. **Validated paths.** Resolve worktree paths and require them to be direct children of the configured worktree root. Refuse an existing path/branch. Never fall back from a failed safe removal to a raw recursive delete.
3. **No hidden install failure.** Capture `pnpm install --prefer-offline` output in a run log and fail creation if install fails; do not redirect all diagnostics away (`tools/sol/worktree.sh:34`).
4. **Intentional commit only.** `merge` must require a clean, already-committed Sol branch and an in-scope diff. Never stage or commit on behalf of the Sol, and never swallow commit failure (`tools/sol/worktree.sh:39-41`).
5. **Base/head preflight.** Verify main is on the recorded target branch, its HEAD is the expected catalog/base head or a reviewed descendant, the main worktree is clean except distinct read-only reports, and the Sol report has completed validation. Abort on checkout/base mismatch; remove `|| true` (`tools/sol/worktree.sh:43-44`).
6. **Preserve work by default.** `remove` refuses uncommitted changes, unpushed/unmerged commits, or an unarchived report. An explicit `discard --confirm <branch-sha>` is required for destructive cleanup; ordinary cleanup uses non-force worktree removal and branch deletion only after ancestry proves merge (`tools/sol/worktree.sh:51-53`).
7. **Catalog mutex.** Store the accepted catalog head/digest centrally. A catalog integrator cannot create or merge if another lease is active or its recorded base is stale.

Add shell-level lifecycle tests for stale base, dirty branch, out-of-lease path, merge conflict, unmerged removal, and catalog-lock contention. A comment claiming isolation is not the acceptance gate.

### 4.2 Durable reports: make them resumable evidence, not prose afterthoughts

Keep the existing first-action/update/validation-last convention because it directly addresses killed stdout and hung agents (`docs/sol-reports/README.md:1-10`). Tighten every implementation report to a machine-checkable minimum:

- work order, role, exact base SHA, worktree, exclusive path lease, and catalog digest;
- assumptions/dependencies and explicit non-goals;
- append-only decision log with timestamp or ordered checkpoint;
- files changed, generated outputs, assets consumed, and art subject/provenance IDs;
- commands run with exit status, focused unit/integration results, LIVE gate metrics, artifact paths, and tested commit SHA;
- unresolved risks/known red gates;
- final disposition: `ready`, `not-ready`, `aborted`, or `superseded`.

Reject merge if the report contains `Pending`, omits tested SHA, reports a red required gate, or claims a LIVE result from source inspection. Read-only acceptance reports must identify both implementation commit and integrated main HEAD. Art reports must include the unique `subjectKey`, `agentRunId`, and reference hashes required by the one-subject law (`docs/design/pet-robotic-gate.md:34-44`).

Generate a small run index from report front matter/status rather than treating stdout or branch names as the fleet ledger. Preserve reports and failure artifacts even when a Sol is killed; never overwrite another run’s report.

### 4.3 LF/CRLF parity: one policy, one mechanical migration

The QA audit measured 128 tracked CRLF worktree files and 32 mixed files with no root EOL policy; raw-source tests and `biome check .` can therefore disagree between Windows and Ubuntu (`docs/sol-reports/audit-qa.md:157-169`; `biome.json:8-26`). The durable fix is:

```gitattributes
* text=auto eol=lf
*.bat text eol=crlf
*.png -text
*.jpg -text
*.jpeg -text
*.gif -text
*.webp -text
*.ogg -text
*.mp3 -text
*.wav -text
*.woff -text
*.woff2 -text
*.zip -text
```

Extend binary exclusions to every tracked binary/archive type actually present. Then:

1. set Biome’s line ending explicitly to LF and narrow it to first-party source/config rather than evidence/large generated payloads;
2. land `git add --renormalize .` in a dedicated reviewed commit with no semantic changes;
3. document Windows Git as `core.autocrlf=false` or `input`;
4. add a CI guard over `git ls-files --eol` that rejects CRLF/mixed text except declared exceptions;
5. run the documented lint command on Ubuntu and Windows until parity is demonstrated.

Still delete newline/whitespace-sensitive runtime tests. EOL normalization removes platform variance; it does not make `toContain` a behavioral contract (`docs/sol-reports/audit-qa.md:82-111`).

### 4.4 Deterministic fixtures and truthful flake handling

Create one supported spatial fixture API rather than letting tests mutate generated arrays:

- known walkable tiles; no pits/POIs/clusters unless a test opts in;
- POI collision index rebuilt from the chosen POIs, not stale after `map.pois.length = 0`;
- fixture-owned coordinates for players/enemies/projectiles/drops;
- seeded room RNG; direct `Math.random` forbidden in deterministic gameplay tests;
- fake clock/tick advancement and disabled unrelated directors;
- mandatory teardown assertion for timers, rooms, sockets, mocks, and globals.

This directly addresses the full-suite-only flight-retarget failure and stale collision index (`docs/sol-reports/audit-qa.md:129-155`; `packages/shared/src/mapgen.ts:791-792,1238-1250`).

Run merge-blocking tests deterministically once; run randomized order/repeat in scheduled or pre-merge characterization. Every failure record includes commit, test ID, seed, order, fixture, and command. A retry-pass in the critical lane is a failure requiring ownership/quarantine, not a green result (`docs/sol-reports/audit-qa.md:139-155`; `e2e/playwright.config.ts:9-15`).

Move janitor execution into a fresh detached/disposable worktree so it never regenerates or broadly checks out files in main. The current `git checkout -- .` restoration is too broad even with a quiet-tree preflight (`tools/janitor/run-janitor.mjs:108-124`). Emit JSON plus Markdown and distinguish:

- `clean`: every run green, no generator drift/failure;
- `stable-fail`: same test fails every run;
- `flaky`: a test passes and fails across identical inputs;
- `generator-fail` or `drift`;
- `infra-deferred`: no characterization occurred.

Return a nonzero status for stable failures, flakes above policy, generator failure, drift, or janitor failure. Scheduled CI may treat `infra-deferred` as neutral, but dashboards must not display it as suite health. The present always-zero contract and “No flakes observed” wording are insufficient (`tools/janitor/run-janitor.mjs:11,149-152`; `docs/sol-reports/audit-qa.md:155`).

### 4.5 Generated artifact and catalog discipline

Build a machine-readable registry containing every generated output, canonical tracked inputs, generator, check command, owning package, and whether the output is runtime-consumed. `gen:check` enumerates that registry and fails on:

- missing canonical input;
- skipped comparison;
- generated banner outside the registry;
- output that cannot be reconstructed;
- manifest/source parse error;
- untracked runtime input;
- unexpected generated diff after a check run.

The need is concrete: character/VFX checks currently skip with missing ignored inputs, and `harvest-install` can erase existing manifest rows after a swallowed parse error (`docs/sol-reports/audit-structure.md:91-105`; `tools/artkit/gen-character-roster.mjs:23-30`; `tools/artkit/harvest-install.mjs:181-232`). Put authored character kits/geometry in tracked data, keep generated outputs package-local/named consistently, write via validate-then-atomic-replace, and never treat generated TypeScript as the source database.

Replace import-time global totals with relational laws and explicit role sets. For a catalog batch, generate one census/delta report from canonical source; marketing/release totals may assert that artifact in one place but must not crash ordinary module import (`docs/sol-reports/audit-structure.md:163-177`; `docs/sol-reports/audit-weapons.md:115-123`).

### 4.6 CI: align job names, budgets, artifacts, and merge policy

Retain the existing frozen install, shared/downstream builds, lint, generation, assets, Vitest, desktop packaging, and real-stack browser foundation (`.github/workflows/ci.yml:24-80`). Reshape it:

1. **Static/unit job:** both typecheck/build directions, scoped lint, EOL guard, zero-skip generated registry, assets, ArtKit `node --test`, Vitest, and risk-module coverage.
2. **Windows parity job:** lint/EOL plus existing desktop packaging until the LF migration proves stable.
3. **Critical LIVE job:** production stack; no retries; target under two minutes; boot, one character per render kind, physical movement/B4, physical melee/projectile/beam hit treaty, reconnect convergence, and one boss phase.
4. **Catalog LIVE job:** sharded character/weapon/pose/VFX matrix; merges upload trace, screenshots/masks, video-on-failure, server/client logs, seed, and room snapshot.
5. **Scheduled soak job:** jitter, loss/reordering, repeat reconnect, performance, randomized test order, and one additional browser/renderer configuration.

The current “browser-e2e-smoke” name masks that it runs the entire serial suite with a five-minute workflow cap, and it uploads no retained diagnostics (`.github/workflows/ci.yml:61-80`; `docs/sol-reports/audit-qa.md:201-217`). Separate fast merge treaties from catalogs and soak so a required gate is both meaningful and affordable.

Coverage thresholds should target risk-owned pure modules and extracted scene components, not a repository-wide vanity percentage. Branch protection should require critical LIVE with no retry; catalog/soak policy can depend on touched leases and release stage.

### 4.7 LIVE acceptance matrix

| Contract | Real stimulus | Authority observation | Presentation observation | Merge lane |
|---|---|---|---|---|
| Character render | normal local/remote join and catalog-driven swap | selected character/spec ID | exact visual kind/assets, one rebuild, no boilerplate for whole-art | Critical |
| Movement/replay | physical keys + B4 firing at 100/200 ms RTT+jitter | receipts, position, impulse, ack/replay | local/remote error bands, no snap/vibration | Critical |
| Hit registration | physical mouse melee/projectile/beam, hit and miss | one event and exact HP delta | attacker/observer target and VFX agree, no duplicate | Critical |
| B1 screen truth | left/right shot under pan/zoom/container | velocity/identity | upright damage text and asymmetric projectile top | Critical |
| Reconnect/schema | disconnect/reorder/rejoin and mismatched version | old session removed; mismatch rejected before state | no ghost/stale callback; blocking incompatibility UI | Critical |
| Boss phase | deterministic HP threshold and physical dodge/parry | phase/sequence/timed damage | telegraph geometry/timing and complete teardown | Critical |
| Catalog/pose/VFX | data-derived gallery, both facings, local/remote | payload/envelope/ready state | muzzle, grip, frame, alpha, effect lifecycle | Catalog |

This matrix closes the exact blind spots identified by QA (`docs/sol-reports/audit-qa.md:40-80,171-199`) and gives every implementation Sol a gate chosen by observed contract rather than file ownership.

### Highest-leverage process fix

The single highest-leverage change is the **deterministic, no-retry, production-path critical LIVE lane with authority-and-presentation assertions plus retained failure artifacts**. It converts the project’s recurring failure mode—green pure/source tests around a wrong runtime assembly—into an immediate merge blocker across character rendering, movement/replay, hit registration, reconnect, and boss timing. LF normalization, deterministic fixtures, and lane splitting are prerequisites that make this gate trustworthy, not substitutes for it (`docs/sol-reports/audit-qa.md:40-60,171-217,252-261`).

## Report validation

- Read all four source audits in full and reviewed B1-B13, worktree/janitor/report conventions, the one-subject art law, and CI.
- Confirmed all 13 owner-note batches are assigned to a wave and all 15 required art subjects retain one-subject ownership.
- Confirmed the report contains source-audit, ledger, tooling, and underlying runtime `file:line` evidence; no synthesis placeholder remains.
- Byte-checked this report: LF only, zero CRLF and zero bare CR.
- Reviewed repository status: this Sol created only `docs/sol-reports/audit-orchestration.md`; no code or test file was edited by this synthesis. No runtime test was run because the work order is report-only.

The owner should pause catalog expansion, land Wave 0 as a clean infrastructure program, then land Wave 1’s B1/render, shared movement+B4, and projectile/beam/hit contracts. Only after those gates are green should the fleet decompose the god files, retire wardrobe/protocol debt, harden weapon semantics, and process B5-B10 followed by B2/B3/B11-B13.

verdict: Top-3 systemic risks are (1) green checks that miss the shipped Phaser/Colyseus boundary, (2) damage-looking pixels that disagree with authoritative hit geometry, and (3) owner movement effects outside deterministic replay; run Wave 0 truthful/reproducible gates first and Wave 1 runtime-truth contracts second, with a deterministic no-retry production-path critical LIVE lane as the highest-leverage process fix.
