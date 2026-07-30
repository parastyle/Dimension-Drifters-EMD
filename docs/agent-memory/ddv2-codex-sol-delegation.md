---
name: ddv2-codex-sol-delegation
description: Working pattern + gotchas for delegating DDv2 implementation work to Codex GPT-5.6-Sol
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-23T07:13:17.256Z
---

Proven pattern (2026-07-15, audit waves 1–6): delegate scoped mechanical fixes to Codex Sol
(`codex exec -m gpt-5.6-sol --dangerously-bypass-approvals-and-sandbox "$(cat prompt.txt)"`), keep
trust-boundary/architectural work local, review every diff like a PR, verify independently, commit
with `Co-Authored-By: Codex GPT-5.6-Sol <noreply@openai.com>`.

**Why:** Sol produced high-quality diffs across 6 delegations (client leaks, boss hazard math, scene
lifecycle P0s, allocation diet, server spatial grid, CI pipeline checks, code splitting) — including
catching things not in the prompt (WeaponDef.sprite borrows, the sticky belt flag).

**How to apply:**
- Prompt via file + `"$(cat file)"`; ALWAYS `< /dev/null` on background runs — codex exec blocks
  forever reading piped stdin otherwise.
- Give each Sol a hard file whitelist; run parallel Sols only on disjoint files.
- Existing test files are the acceptance gate: forbid Sol from editing them (it may CREATE new test
  files, or extend a unit's own test file without weakening assertions).
- NEVER run the vitest suite while a Sol is mid-edit on a file it covers — vitest transforms the
  half-saved file and produces phantom failures (bit us twice).
- `tsx watch` dev server hot-reloads every incremental Sol save → the live server can transiently run
  broken intermediates. Restart the preview server after a Sol lands before any live verification.

Related: [[ddv2-project-context]]

**Addendum (2026-07-17, later):** the user PURCHASED a Codex subscription — `-m gpt-5.6-sol`
works again and is the standing preference: Sol does heavy implementation, Claude orchestrates,
reviews diffs, verifies serially, commits. (During the gap, Claude Agent-tool subagents ran the
same role-prompt panel pattern successfully — a proven fallback if quota dies again. Note Claude
session limits can also kill in-flight subagents mid-edit; on any agent death, audit `git status`
for partial residue before relaunching, and have the successor AUDIT the partial diff against the
docs rather than trusting or blindly reverting it.)

**Addendum (2026-07-16 night):** deterministic-looking harness tests can flake via MAP RNG —
projectiles collide with randomly-placed POIs and pinned coordinates can land on pit tiles. Any
GameRoom test with projectile flight paths or fixed positions must clear `room.map.pois` and
`room.map.tiles.fill(TILE_GROUND)` (or use forcePit deliberately). The per-run Math.random stream
differs between full/isolated runs, so these flakes masquerade as scheduler contention.

**Reporting (added 2026-07-21 after three report-loss incidents):** NEVER pipe `codex exec` through `tail -N` — it truncates the report of record in the task log. Every Sol brief must include the docs/sol-reports/<slug>.md incremental-file reporting clause (see that README in-repo): understanding first, sections as completed, validation last. Sols hang AFTER finishing work (~0 CPU zombies) — file-write recency is the liveness signal, not CPU; on a suspected hang, harvest the tree + the report file, verify independently, commit, then kill.

**Planner-Sol consult (owner order 2026-07-22, at 98% Claude weekly usage):** For EACH new ask, before launching fleets, consult a PLANNER SOL: send it the ask + repo context pointers + standing constraints; it returns the wave plan (Sol count, file partition, risks, brief outlines) to docs/sol-reports/plan-<slug>.md. Claude reviews cheaply, adjusts minimally, launches per plan. Claude's role shrinks to: read owner notes -> planner consult -> launch -> harvest reports -> verify -> commit. Keep Claude messages lean; heavy thinking lives in Sols.

**Worktree isolation (owner order 2026-07-23):** every IMPLEMENTATION (mutating) Sol runs in its OWN git worktree, so unrelated Sols never clobber shared files. Shared-tree orchestration bit us twice in one night (weapons+head-split entangled; had to STOP chakram to run drifter-head because both touch the sprite manifest). Root cause: all Sols edited one working copy, and `packages/client/src/sprites/manifest.ts` lists BOTH weapons AND characters, plus the packed atlas + census guards are global. Helper: `tools/sol/worktree.sh {create|merge|remove} <name>` — creates `../ddv2-wt/<name>` on branch `sol/<name>`, runs `pnpm install --prefer-offline` (~5s; content-addressable store only links; `@dd/shared` links to the WORKTREE source = real isolation), typecheck/tests run INSIDE the worktree, then merge sol/<name> back (conflicts SURFACE instead of silently clobbering). DESIGN/RESEARCH Sols (write only their own docs/*/<slug>.md report) stay in the main tree — naturally isolated, skip the worktree cost. Run `codex exec` with cwd = the worktree path.

**RNG-stream flake ROOT-FIX (2026-07-23, after whack-a-mole across a merge wave):** `packages/server/src/rooms/GameRoom.test.ts` (and sibling GameRoom test files) draw map-gen/spawn/nav/spread from the GLOBAL `Math.random`. Position-sensitive assertions (px windows, ceiling/parry counts, boss-rush advance, whirlwind re-hits) are stream-position dependent, so ANY catalog change (new/edited weapon) reshuffles the full-suite stream and flips a DIFFERENT latent-flaky test each merge — they all PASS in isolation, fail only in the full 140+-file run. Per-test hardening (clear pois + `tiles.fill(TILE_GROUND)`, or seeding one test) does NOT converge: each fix reshuffles and exposes the next. THE FIX: a module-scope `beforeEach(() => { const rng = makeRng(FIXED); vi.spyOn(Math,"random").mockImplementation(() => rng.next()); })` + `afterEach(() => vi.restoreAllMocks())` at the TOP of the test file. Tests that need a specific roll still `vi.spyOn` their own (installed later, wins); tolerant tests are unaffected. `makeRng` is exported from `@dd/shared` (`rng.ts`). This stabilizes ALL subsequent catalog-changing merges. audit-qa flagged this as the #1 RNG-parity gap. Landed in `4f1f523`.

**Sol hang reality (2026-07-23):** most impl Sols finished + hung (zombie), harvestable by committing the worktree diff to their branch then merging. But two failure modes need judgment, not blind merge: (a) a task that hangs the Sol TWICE with a code-only stub and NO tests/verification (e.g. B7 thrown-conversions) — DEFER, preserve branch, don't merge unverified behavior; (b) a Sol that implements correctly but hangs before RECONCILING invariance/census tests its intentional changes broke (e.g. B8 pose changed Voltedge routing + reclassified staves → `driftblade-model-panel` routing table + `v6g` staff-count fail) — DEFER unless the reconciliation is a trivial, unambiguous number/exclusion update. Merge only when the FULL suite is green after independent regen+verify (B10 VFX cleanup harvested clean this way).
