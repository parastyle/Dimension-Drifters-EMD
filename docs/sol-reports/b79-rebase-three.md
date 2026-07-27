# B79 — rebase and repair three stale branches

Base: `982ea8d5`

Combined branch: `sol/b79-rebase-three`

## B65 — weapon subclass taxonomy and Testing-Grounds paging

Status: **PASS** (`28b9d90b`)

### What broke

The stale branch treated its authored family rules as an exhaustive catalog. Weapon batches added after
that snapshot had no matching rule, so `weaponTaxonomyFor` threw while `weapons.ts` was being imported.
That converted one new family into a repository-wide module-load failure.

### Repair

- Moved the authored taxonomy rules into validated generator input and generated TypeScript.
- Kept authored rules authoritative, but made an unseen family non-fatal: its `family` is split on
  whitespace, `_`, `/`, and `-`, then title-cased into a deterministic derived subclass label.
- Applied the owner singleton law after a catalog-wide raw-subclass census. A derived or authored
  subclass with one catalog member resolves to class `Special` and subclass `Special`; a derived family
  with two or more members remains in its source class under the derived label.
- Kept ambiguity strict: a weapon matching multiple authored rules still throws because that is invalid
  taxonomy data, not an ordinary future-family case.
- Added the invariant test that every catalog weapon has exactly one non-empty subclass and class, each
  subclass belongs to one class, and no singleton subclass remains outside `Special`.
- Kept Testing Grounds at one active-subclass page per page, ordered by class order and then subclass
  label, with the class/subclass label visible in the gallery UI.

Unseen-family behavior: **derive a readable subclass from `family`, never throw merely because the
family is new, then resolve a one-member result to `Special/Special`.** This preserves useful grouping
when a batch adds peers while obeying the owner ruling for a genuinely standalone weapon.

### Verification

- Focused taxonomy and Testing-Grounds tests passed.
- Full checkpoint after B65: **239/239 files; 2,899 passed; 20 skipped**.
- `pnpm gen`, `pnpm gen:check`, and `pnpm typecheck` passed.

## B62 — accessibility panel and authoritative pause

Status: **PASS** (`91a9569c`)

### What broke

The stale merge lost the `pauseVote` send path while resolving a heavily rewritten `ArenaScene`. Its
remaining test searched source text for one exact call expression, so it described a spelling rather
than the input and authority behavior that had to survive the rebase.

### Repair

- Rebuilt one MenuScene accessibility panel containing all 11 persisted settings: damage numbers,
  number style, number scale, hit-confirm audio, confirm volume, hit sparks, screen shake, hit stop,
  flashes, colorblind assist, and render scale.
- Added server-owned `paused` and `pauseVotes` state. Solo confirmation is unanimous immediately;
  multiplayer stays live until every connected player confirms, and one withdrawal resumes the room.
- Made the server update path discard its fixed-step accumulator and return while paused. Tests hold
  tick, elapsed time, player HP, enemy position, and enemy attack sequence constant across a simulated
  five-second pause, proving the simulation—not only the camera—stops.
- Reapplied the Arena pause/vote UI to the current scene. Only the synchronized `paused` bit blocks
  gameplay; a pending multiplayer vote does not predict a pause.
- Replaced the brittle source-text assertion with behavior tests around the pure pause-frame router.
  They cover live Escape vote confirmation, pending consensus, authoritative resume, and modal ownership
  of Escape so pause never steals live input.
- Bumped the wire schema from 48 to 49 and updated every pinned schema test.

### Verification

- Focused MenuScene, Arena pause-routing, solo tick-halt, and multiplayer consensus tests passed.
- Full checkpoint after B62: **241/241 files; 2,908 passed; 20 skipped**.
- `pnpm typecheck` passed.

## B67 — flashlight and laser pointer toggle

Status: **PASS** (`055e67b5`)

### What broke

The stale branch conflicted with the current Arena presentation pipeline, the post-B74 constants, and
the expanded weapon registry. Its original render call used pre-B68 animation state and raw room rows,
and its first prompt-derived capability parser also misread Anvil .50's long negative accessory clause.

### Repair

- Added the capability/mode contract (`neither`, `light`, `laser`, `both`) with an honest absent default
  and capability-aware cycling.
- Added a rate-limited server `toggleWeaponUtility` handler and a run-persistent `weaponUtilityMode`
  player field. Unsupported weapons and downed players do not change state.
- Bumped the wire schema from 49 to 50 and updated every pinned schema test.
- Integrated the utility mode into B68's single `PresentedActorState`, including the remote discrete
  snapshot buffer. Rendering consumes the same sampled actor/weapon/aim row as the rig.
- Added a retained renderer whose flashlight consists only of forward triangles and whose laser is a
  forward line. Both obtain their origin from `SpriteRig.writeWeaponMuzzle`, then rotate along the local
  or sampled aim vector. No player/root coordinate is accepted by the pure geometry contract, and no
  radial/circular player primitive exists.
- Kept `V` inside the existing live-gameplay input gate. Open modals and an authoritative pause block it;
  unsupported hardware sends no false toggle request.
- Extended generation to recognize explicit capabilities, positive laser/light pair wording, and the
  B63 unambiguous small-boxy-combination-unit wording. Full-clause negation handling keeps long
  “no ... laser/light unit” constraints absent.
- The currently integrated B63 subset resolves as 19 equipped guns plus the scoped Varmint Bolt and
  Anvil .50 exclusions. The roster-driven test evaluates later B63 rows as they arrive, so the queued
  scoped Zenith Photon DMR cannot gain a toggle without failing the test.
- Added behavior coverage for cycling, capability intersection, server validation, coherent remote
  snapshot sampling, muzzle-origin geometry, strict generation, current catalog census, and the B63
  yes/no roster.

No deleted movement constants were restored. The B68 unified actor/clock pipeline, B74/B75 limb and stop
behavior, and B76 accepted-trigger aim snapshots remain intact. No weapon-concept, lava-dimension, or
walkability-painter file was changed.

### Verification

- Focused B67, presentation-buffer, Arena training, and authoritative server tests passed.
- Full checkpoint after B67: **242/242 files; 2,915 passed; 20 skipped**.
- `pnpm gen`, `pnpm gen:check`, and `pnpm typecheck` passed.

## Final combined verification

- `pnpm gen`: **PASS**
- `pnpm gen:check`: **PASS**
- `pnpm typecheck`: **PASS**
- `tools/diag-rb-telemetry.mts`: **PASS**, 111/111 scenarios:
  - top-down: 55 scenarios, 0 correction requests, 0 nonzero corrections, 0 snaps
  - belt: 56 scenarios, 0 correction requests, 0 nonzero corrections, 0 snaps
- Full suite run 1: **242/242 files; 2,915 passed; 20 skipped**
- Full suite run 2, consecutive with no source change: **242/242 files; 2,915 passed; 20 skipped**

VERDICT: b65 PASS; b62 PASS; b67 PASS; unseen-family behaviour = title-cased family-derived subclass with singleton census to Special/Special and no import throw; telemetry = PASS 111/111 (top-down 55, belt 56), zero corrections in both modes; 2x tests = PASS + PASS (242 files, 2,915 passed, 20 skipped each).
