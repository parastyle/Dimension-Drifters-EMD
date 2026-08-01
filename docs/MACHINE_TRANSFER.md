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

## Before you clone: one Windows setting

```bash
git config --global core.longpaths true
```

The deepest tracked path is 140 characters (`docs/owner-notes-audit-v11-evidence/...`). Windows caps
paths at 260, so the clone directory must stay under ~120 characters. `C:\Users\<you>\DDv2` is fine
with room to spare; a deep temp directory is not — a clone into a ~120-char path failed mid-checkout
with `Filename too long`. The setting above removes the limit entirely.

Line endings need no setting: `.gitattributes` pins the repo to LF, so a checkout is correct even on
a machine with the Windows default `core.autocrlf=true`. That matters because several suites are
source-contract tests that hash or string-match file contents — before the pin, a fresh clone failed
three suites that pass in an LF working copy, with nothing wrong in the code.

## First run on the new machine

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm gen
```

```bash
pnpm typecheck && pnpm test
```

Expect **253 test files / 3014 passing**. This exact sequence was run against a clean clone with
`core.autocrlf=true` forced, and is green — so anything red on the laptop is a genuine local problem,
not a transfer artifact.

Then start the dev server through the Browser-pane preview (`.claude/launch.json` has the `dev`
entry) rather than a bare terminal command.

## Verifying the battle prototype came across

```bash
pnpm dev
```

Open `localhost:5180/?battle=1`. You should get the 4v4 on the Overgrown Ruin; press `1` to take over
a Drifter, `F` for widescreen. The 18MB of ruin art is tracked, so it needs no separate copy.
