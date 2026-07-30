---
name: ddv2-sol-guardrails
description: Every Sol brief must carry the G1-G10 guardrail block from tools/sol/GUARDRAILS.md
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77d4384-de26-420e-a954-33923a9ca83d
  modified: 2026-07-28T22:29:40.222Z
---

Owner request 2026-07-28: codify a "don't fuck with" list for Sols. Locked as canon.

**Paste `tools/sol/GUARDRAILS.md` verbatim into every Sol brief.** The master spec owns the text
(section "Sol guardrails"); `tests/sol-guardrails.test.ts` pins the two byte-identical so a brief can
never cite a drifted rule. Do not paraphrase the rules into a brief — paste them.

The ten, in one line each: G1 no new filter between prediction and the drawn root. G2 a tolerance
constant needs a derivation. G3 art and hitbox never diverge silently. G4 no retry-then-throw where a
guarantee is required. G5 never grade your own live verification. G6 never fix feel with easing.
G7 assume the merge dropped your call site. G8 aggregates cannot see single-frame events. G9 hard
no-touch list. G10 follow the evidence over the brief's hypothesis.

**Why:** in one session five batches each fixed a genuine defect and the owner still could not walk
in a straight line. The cause was accumulation — every batch added a layer that hid the previous one,
and the eventual fix was DELETING a layer. Rules that live only in the orchestrator's head do not
survive into a subagent's context.

**How to apply:** brief structure that works — verbatim owner quote, verified facts with file:line so
the Sol does not re-derive, deliverables, explicit out-of-scope, the guardrail block, verification
with hard numbers, and a report ending in a one-line verdict. See
[[ddv2-codex-sol-delegation]] and [[ddv2-parallel-sol-merge-seam-loss]].
