---
name: ddv2-owner-notes-workflow
description: "The \"audit my notes\" workflow — in-game G/T notes land in data/owner-notes.jsonl; Claude builds a ledger, asks questions, then orchestrates Sols"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-20T16:31:43.230Z
---

The owner captures playtest notes IN-GAME (training room): G = general game note, T = weapon note auto-tagged with the held weapon (id + name). The server appends each to `data/owner-notes.jsonl` — schema per line: `{ ts, session, mode, type: "game"|"weapon", weaponId?, weaponName?, note }`.

**Why:** The owner's standing workflow (established 2026-07-20): they playtest and dump notes without leaving the game, then later say "audit my notes" in the desktop app.

**How to apply:** On "audit my notes" (or similar): (1) read `data/owner-notes.jsonl`; (2) build a ledger — per-weapon sections (grouped by weaponId, with the requested modifications distilled) plus a general game-notes section; (3) present the ledger AND a short list of clarifying questions BEFORE starting work; (4) after answers, orchestrate Sol squads — game-note items FIRST, then weapon-note items (owner-specified order). Mark processed notes somehow (e.g. record the last-processed timestamp in the ledger doc, don't rewrite the jsonl). Related: [[ddv2-codex-sol-delegation]], [[ddv2-project-context]].
