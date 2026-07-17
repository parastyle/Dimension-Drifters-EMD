# Pet system v1 — user rulings (binding)

Recorded 2026-07-17 from the user's answers to the panel's six blocking questions.
Implementation briefs cite this file; where a panel doc conflicts with a ruling, the ruling wins.

## Tech doc's three (account / balance / eligibility)

1. **Account authority: local offline trust** — same posture as today's META_UPGRADES persistence.
   No authenticated store, no signed snapshots. Server still sanitizes claimed payloads
   (clamp/derive per the tech doc's validation table) but does not authenticate them.
   **Pending Bond XP across disconnect: implement the rejoin-settlement only if it is cheap** —
   the user explicitly waived it if it's a big lift. If the reservation/rebind machinery costs more
   than a trivial addition, pending XP from an abandoned connection is simply lost with the run.

2. **Balance contract: the roster is approved AS-IS and stacking is LEGAL.** The four advocate
   hotspots (Verdant Wing regen+capacity, Copper's 13th slot, Gecko's scrip mint, Brass reload)
   ship as designed. Same-budget character-quirk + pet pairings are legal and stack; no pre-run
   rejection UI.

3. **Award eligibility: ALL Bond XP earned counts, regardless of outcome.** Wins, losses,
   extractions, abandons — whatever XP the run generated banks at settlement. No victory gate.
   (Slate Tortoise's terminal-victory roll still requires its victory by its own definition.)

## Advocate's three (set-in-stone / authority line / progression shape)

1. **"Set in stone" means deterministic identity, not frozen numbers.** Each pet has a fixed,
   predetermined identity: which stats/bonuses it has and how they upgrade per level is authored
   and never random. Numeric tuning within that identity remains patchable (the advocate's
   bounded-balance-patch reading), no gacha anywhere.

2. **v1 ships passive-only; actives are welcome as a follow-up "if it can be managed."**
   The passive authority line (server-owned buffs, client-cosmetic follower) is approved for v1.
   Design the bonus plumbing so an active/positional pet tier (a real 20Hz entity) can be added
   later without reworking v1 — but do not build the entity now.

3. **Progression shape approved as proposed:** one account-wide level per pet, only the selected
   pet earns Bond XP, ~4–6h median to level 10, thresholds 0/120/300/540/840/1200/1620/2100/2700/3600,
   stages 1-3/4-7/8-10, capstone at 10, pet locked from ready-up for the whole run.

## Carried requirements

- Pet v1 adopts the **fusion-readiness requirements** from docs/petfusion-panel/visual-tech.md
  (normalized part slots, anchor discipline, fusion-aware account schema) so the approved-in-principle
  fusion/evolution v2 is an extension, not a migration.
- Schema slot: orchestrator-assigned next-available at code-wave launch (after the roll and slide waves).
