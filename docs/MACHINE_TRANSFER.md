# Moving to another machine

`git clone` + `pnpm install` gives you a working repo: all source, all installed sprites
(`packages/client/public/sprites`, ~113MB, tracked), all generated data, all docs. The pack is
~1.3GB, so expect the clone to take a while.

## What git does NOT carry, and what to do about each

| Item | Size | Do |
| --- | --- | --- |
| `.env` | tiny | **Recreate by hand.** Secrets are gitignored on purpose. Do not commit it. |
| `data/owner-notes.jsonl` | 132K, 576 entries | **Copy manually.** This is your authored in-game note ledger (G/T keys) — irreplaceable playtest history. |
| `data/accounts.sqlite*` | 1.5M | Copy only if you want your local save/progression. Regenerates empty otherwise. |
| `tools/artkit/out/**` | **6.2G** | Intermediate art-generation output. Installed art is already in the repo. Copy only if you need to re-derive something from a raw render. |
| `node_modules/`, `dist/`, `packages/desktop/release/` | large | Ignore. `pnpm install` + `pnpm gen` + build rebuilds them. |

## Now carried in the repo (previously outside it, would have been lost)

- `docs/sol-briefs/` — 197 Sol briefs. The briefing patterns are real IP; they were living in a
  session temp directory that gets cleaned.
- `docs/agent-memory/` — 18 memory files, the cross-session project rules (Sol guardrails, delegation
  patterns, art laws, owner rulings). These normally live in `~/.claude/` per-machine.
  **On the new machine, copy `docs/agent-memory/*` into that machine's Claude memory directory** so
  the assistant starts with the same rules instead of relearning them.

## First run on the new machine

```bash
pnpm install
pnpm gen
pnpm typecheck && pnpm test
```

Then start the dev server through the Browser-pane preview (`.claude/launch.json` has the `dev`
entry) rather than a bare terminal command.
