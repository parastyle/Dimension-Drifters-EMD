# Owner design decisions — characters & pets (2026-07-23)

Binding decisions from the owner. Implementation Sols MUST honor these over any panel recommendation.

## Characters (whole-prompted, no-face, bobbing head)

1. **Roster: cut all 8.** Drop Cordell, Buzzard, Dunkel, Deepfall, Halcyon-7, Grix, Pyra, and Sir
   Galloway. The roster is the remaining **32 identities**, Drifter as the shadow-faced anchor.
2. **All characters are the SAME SIZE.** No size tiers, no archetype-based scaling. The 3-tier
   proposal is REJECTED. One shared body scale for the whole cast. (Head-ratio and silhouette grammar
   from chars-3 still apply; only the size-tier idea is dropped.)
3. **No visible face, ever** (unchanged): shadow/mask/cowl/hood/helm/visor/veil, Drifter's
   shadow-covered face is the north star. See `docs/design/chars-2-facelaw.md`.
4. Head is a SEPARATE layer purely so it can BOB (no neck, overlaps the body). 2-layer depth trick.
   See `docs/design/chars-3-headrig.md`.

## Pets

5. **Branching evolution: pilot on 4 pets** (2 opposite Ascendant forms each) to start. See
   `docs/design/pet-2-evolution.md`.
6. **Layered-texture pets** (owner ask): give pets the SAME bobbing feel characters get, via a 2-layer
   trick — one image on top of another representing a different depth. Design task in progress.

## Weapons (owner ask, 2026-07-23)

7. Throwing stars (iron/fire/ice/void) were NEVER built (`v7-stars-archive-catalog` still queued). Build them.
8. **Kunai** — add as a thrown weapon (does not exist yet).
9. **Plain .50-cal sniper** — add a normal, non-occult .50-cal bolt sniper ALONGSIDE the existing
   crusader-themed `x2-barrett-50-cal-sniper` (keep the Barrett).
