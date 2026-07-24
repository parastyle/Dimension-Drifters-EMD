# B26 — Directional Parry Reactions

Status: implementation and verification complete on `sol/b26-parry`.

## Stage 0 — Design contract

### Incidence model

The server will derive a normalized incoming direction pointing from the attack source toward the
defender. Classification uses the dominant axis so the four reactions cover the full circle
without gaps:

- dominant vertical, incoming motion upward: attack is **from below** and routes to the existing
  parry air-lift behavior;
- dominant vertical, incoming motion downward: attack is **from above** and applies a short
  server-owned brace state without displacement;
- dominant horizontal, incoming motion rightward: attack is **from left** and slides the defender
  right, away from incidence;
- dominant horizontal, incoming motion leftward: attack is **from right** and slides the defender
  left, away from incidence.

Exact diagonal tie-breaking and coordinate signs will be locked to the existing world-coordinate
convention once the combat path is traced, then covered by boundary tests.

### Side-slide curve

Planned curve: `clamp(preventedDamage * pxPerDamage, minimumSlidePx, maximumSlidePx)`. The constants
will be chosen against the repository's movement scale, centralized beside the reaction router,
and recorded here after validation. The server will request a navigation-valid endpoint along the
away vector; collision/pit validation may shorten the move but never extend it.

### Weapon sub-type taxonomy

The cycle key will come from the shared catalog's existing `family` / `classPool` taxonomy rather
than display names or individual weapon IDs. The natural stable sub-type key will be selected after
catalog inspection and documented here with examples. This keeps weapons that share handling and
silhouette on the same three-pose vocabulary while avoiding bespoke per-item state.

### Three-pose cycle

Each player owns a server-authoritative parry-success counter and last-success timestamp. Successful
parries select guard poses `0 → 1 → 2 → 0`; inactivity for a short reset interval restarts at pose
`0`. The selected pose and directional reaction are replicated through the existing combat/player
state so every client renders the same guard and motion. Failed parries do not advance the cycle.
Existing parry timing, eligibility, and damage negation remain untouched.

### Feel and presentation

The implementation will reuse the current parry hitstop/flash and VFX/SFX hooks. The held weapon
and hands will snap to one of three guard placements, followed by the directional reaction. No new
particle system, aura, radial/ambient effect, chain, or tassel will be added.

## Stage 1 — Existing-path trace

- The legacy melee success seam is `GameRoom.resolveParry`. It currently increments `parriedSeq`,
  refreshes FLOW, adds `PARRY_LAUNCH` vertical velocity, adds an away impulse, resolves attacker
  recoil/riposte, then applies the existing heal/augment/quirk rewards.
- Projectile success is `GameRoom.reflectProjectile`; it has its own receipt/reward tail after
  preserving the existing deflect/reflect behavior.
- Boss melee routes into the shared melee seam when an enemy row exists; the fixed-root flagship
  response has one separate personal-reward helper.
- `PlayerState.parriedSeq` already supplies a deterministic success edge to all clients. The client
  consumes it for the existing white flash, parry SFX, local hitstop, and combo pop. The new selected
  guard pose and reaction kind can travel beside that receipt; no new VFX hook is needed.
- `SpriteRig.triggerBrace` and its brace envelope already own the parry pose path independently from
  melee combo-step definitions. The three successful-guard variants will extend this path only.
- Navigation already has a swept, two-pixel sampled segment check for weapon lunges. The parry slide
  will share an extracted pure segment clamp so it cannot tunnel through a POI or pit.

### Taxonomy decision

The sub-type key is `${weapon.tags.classPool}:${weapon.tags.family}`. `family` is the catalog's
natural silhouette/handling subtype (`ranged:pistol`, `melee:sword`, `caster:staff`, and so on);
prefixing it with `classPool` prevents accidental collision if a family label is ever reused across
the melee/ranged/caster pools. Display names and weapon IDs are intentionally excluded. The server
stores cycle state by this composite key and synchronizes only the chosen `0..2` pose required by
clients.

## Stage 2 — Implementation

- Added one append-only schema-v35 byte, `PlayerState.parryPresentation`. The existing
  `parriedSeq` remains the success edge; the byte packs the four-way reaction and selected guard
  pose, so timing/damage/parry eligibility semantics are unchanged.
- Added a shared pure router. World/screen coordinates use `+x = right`, `+y = down`; exact 45°
  diagonals resolve horizontally, and a degenerate vector resolves to the safe no-displacement
  above brace.
- Extracted the pre-B26 vertical velocity plus away-impulse code into the below-only legacy lift
  helper. No new lift math was introduced.
- Side reactions move along the incoming travel vector (away from its source) with the curve
  `clamp(preventedDamage × 4 px, 24 px, 120 px)`. Examples: 2 damage → 24 px, 8 damage → 32 px,
  18 damage → 72 px, and 30+ damage → 120 px. Arena travel samples the entire segment every 2 px
  and stops at the last bounds/POI/pit-valid point; belt travel uses the existing swept-safe
  endpoint path.
- Above reactions add no server displacement and select the synchronized compress-brace
  presentation for `0.34s`, inside the requested `0.25–0.4s` beat.
- Guard state is held per player in a map keyed by `${classPool}:${family}`. Only a success advances
  `0 → 1 → 2 → 0`; a gap longer than 3 seconds resets that subtype to pose 0.
- `SpriteRig` extends only the existing parry brace path: the three poses move the held weapon and
  both hands through high/mid/low contacts, including both held sprites for dual wield. Above adds
  a stronger body compression. The success edge reuses the existing flash/audio/hitstop/VFX path
  and briefly fills the held weapon white; no particle or ambient system was added.

## Stage 3 — Verification

### Automated coverage

- `tests/parry-reactions.test.ts` adds 16 pure unit tests for all four incidence quadrants,
  zero/axis/diagonal boundary handling, slide floor/linear/cap values, the per-subtype
  `0 → 1 → 2 → 0` sequence, the exact three-second reset boundary, packed wire values, taxonomy
  separation, and swept navigation clamping.
- `GameRoom.test.ts` exercises the server receipt seam directly: below retains the legacy lift,
  a 20-damage side parry moves exactly 80 px, above holds position, packed directions are correct,
  and one subtype cycles `0 → 1 → 2` before resetting after inactivity.
- Projectile and melee call sites now pass their actual incoming vectors and prevented damage into
  the same server-owned reaction seam. Projectile routing captures its original damage before the
  existing reflection mutation.
- The client delays the successful-pose envelope until the first renderable rig frame after
  hitstop, so a short hitstop cannot consume the guard pose before it is drawn.

### Required gates on the final source state

- `pnpm gen` — PASS.
- `pnpm gen:check` — PASS; every available tracked output is synchronized. The command reported its
  existing skip for unavailable untracked weapon reference art. The resulting empty VFX projection
  was restored to the baseline, leaving the B24-owned surface untouched.
- `pnpm typecheck` — PASS across shared, server, and client.
- `pnpm test` — PASS: 168 test files, 2,209 tests.
- `git diff --check` — PASS.

The isolated worktree initially could not run the checked-in generators because their scripts
import `sharp` while the root workspace did not declare it. `sharp` is now an explicit root
development dependency, with the lockfile updated, so `pnpm gen` is reproducible from this
worktree.

## Stage 4 — Private live gate

The live gate ran the real client and server through the repository Playwright stack on ephemeral
ports `49307` (client) and `49306` (game); forbidden ports `5180` and `2567` were not bound or
touched. It used `proto-cowboy-hidden-face` with `x-sword-neon-katana`, whose catalog subtype key is
`melee:sword`.

- A real `boothill` fired 8-damage rounds from below, left, right, and above. The captures record
  legacy air lift from below, 32 px slides on both sides (`8 × 4`), and zero displacement plus a
  compressed body pose from above.
- A real `dust-ranger` fired the three-parry burst at production cadence. The replicated pose
  sequence was `0, 1, 2`; final weapon rotations were `-0.829`, `-0.209`, and `+0.371` radians with
  high/mid/low hand placements.
- Evidence lives in `docs/owner-notes-audit-v11-evidence/b26-parry/`: seven PNG captures,
  `live-gate.json` with authoritative before/impact/after state and rig geometry, and `README.md`
  with the run manifest.

### Files touched

- Shared contract: `packages/shared/src/parry-reactions.ts`, `packages/shared/src/index.ts`,
  `packages/shared/src/constants.ts`, `packages/shared/src/state.ts`.
- Server authority and tests: `packages/server/src/rooms/GameRoom.ts`,
  `packages/server/src/rooms/GameRoom.test.ts`, `packages/server/src/rooms/BossController.test.ts`,
  `packages/server/src/rooms/progression.test.ts`.
- Client presentation: `packages/client/src/entities/SpriteRig.ts`,
  `packages/client/src/scenes/ArenaScene.ts`.
- Verification/evidence: `tests/parry-reactions.test.ts`,
  `e2e/tests/b26-parry-live-gate.spec.ts`,
  `docs/owner-notes-audit-v11-evidence/b26-parry/`.
- Build/report: `package.json`, `pnpm-lock.yaml`, `docs/sol-reports/impl-b26-parry.md`.

VERDICT: 4 directional reactions live, 3-anim cycle per sub-type, slide curve documented, evidence path `docs/owner-notes-audit-v11-evidence/b26-parry/`, files touched listed above.
