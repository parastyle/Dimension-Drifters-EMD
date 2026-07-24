# B38 hammer-hand layering

## Outcome

Implemented the requested layering-only correction on top of the current B35 integration head
(`1f0bda5`). The repository has no remote `main` ref; `origin/feat/v0.118-metagame` is the current
integration branch, and `sol/b38-hammer-layering` was already up to date with it before edits.

During an accepted revolver hammer beat, `SpriteRig` now re-pushes the currently animated retained
hand (plus its receiver attachment) after every held weapon layer. That gives 1H hammer thumbs the
same explicit above-art treatment as pump/lever/crank mechanism hands. It also guarantees that an
alternating Twin-Maw rear hand clears both the rear and lead gun art. The retained render stack is
rebuilt only on start, paired-hand alternation, and end; the ordinary layer is restored at beat end.

No hammer timing, rotation, translation, cadence, pose sample, weapon affine, muzzle, or gameplay
value changed.

## Test migration

`SpriteRig.ranged.test.ts` now covers:

- inactive → lead-hand promotion → alternate-hand promotion → inactive restoration;
- either active Twin-Maw hand sorting after both weapon sprites;
- the rear paired hand returning below the lead weapon in the ordinary rest stack.

The existing B29 census/sample coverage still exercises all 17 1H revolvers plus Twin-Maw without
any motion-value changes.

## Verification

- `pnpm typecheck` — PASS.
- Focused B29/SpriteRig tests — PASS, 35/35.
- Full `pnpm test` — PASS, 189 files and 2,345 tests.
- LF verification — PASS for both edited TypeScript files (`git ls-files --eol`: `i/lf w/lf`).
- `git diff --check` — PASS.

The first full-suite run exposed only absent ignored ArtKit prerequisites in this isolated worktree
(`pngjs`, the orientation report, and Weaponsmith preview actors). They were copied from the shared
repository as ignored verification fixtures; no product or tracked source changed. The final full
run is green.

## Live gate

A real private stack started successfully on client/game ports `64016/64017`, avoiding `5180/2567`.
The required visual gate could not proceed because the in-app browser runtime reported
`No browser is available` and browser discovery returned no available browser. Per the browser-control
runtime's required fallback policy, no unrelated browser automation was substituted. Both private
listeners were stopped and verified closed.

The attempt is recorded at
`docs/owner-notes-audit-v11-evidence/b38-hammer-layering/live-gate-blocked.md`. It explicitly makes
no screenshot/pass claim.

## Files touched

- `packages/client/src/entities/SpriteRig.ts`
- `packages/client/src/entities/SpriteRig.ranged.test.ts`
- `docs/owner-notes-audit-v11-evidence/b38-hammer-layering/live-gate-blocked.md`
- `docs/sol-reports/impl-b38-hammer-layering.md`

verdict: hammer hand above art (0 weapons live-verified; 4 requested weapon contracts await browser capture), evidence path `docs/owner-notes-audit-v11-evidence/b38-hammer-layering/`, files touched: `SpriteRig.ts`, `SpriteRig.ranged.test.ts`, `live-gate-blocked.md`, `impl-b38-hammer-layering.md`.
