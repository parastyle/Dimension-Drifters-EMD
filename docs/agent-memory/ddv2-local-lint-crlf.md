---
name: ddv2-local-lint-crlf
description: "DDv2 — `pnpm lint` fails locally on Windows due to CRLF; it's environmental, not a real regression"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
---

In the DDv2 (Dimension Drifters) repo on this Windows machine, `pnpm lint` (`biome check .`) reports
~88 "errors" across ALL files, including untouched ones. Cause: `git config core.autocrlf=true` + no
`.gitattributes`, so files check out with **CRLF**, but biome's formatter expects **LF** (no
`lineEnding` override in biome.json). CI runs on Linux/LF and passes.

**Do NOT treat local lint failures as a regression, and do NOT run `biome format --write`** (it would
rewrite every line ending → a massive spurious diff). To check whether YOUR edits are actually clean,
lint LF-normalized content via stdin:
`sed 's/\r$//' <file> | npx biome lint --stdin-file-path=<file> -` (and `biome format` diff likewise).
Note: multi-byte chars like `⚠` render as `!` in that stdin/diff path — a display artifact, ignore it.

Committing is safe: autocrlf normalizes CRLF→LF on commit, so the stored diff is clean LF.

Stack: Phaser 4 client · Colyseus 0.16 server · TS strict · pnpm monorepo · Biome · Vitest.
Run: `pnpm dev:desktop` (Electron) or `pnpm dev` (browser at localhost:5180). Gates:
`pnpm typecheck && pnpm lint && pnpm test && pnpm build`. See [[ddv2-project-context]].
