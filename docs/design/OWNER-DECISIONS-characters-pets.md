# Owner design decisions — characters & pets (2026-07-23)

Binding decisions from the owner. Implementation Sols MUST honor these over any panel recommendation.

## ⚠️ STANDING ART-GENERATION LAW (owner, 2026-07-23) — applies to ALL image generation

**One image-generation SUBJECT per agent. Never batch multiple subjects in one agent.**

Owner's diagnosis, confirmed: when a single agent generates more than one image subject, earlier
subjects BLEED into later ones — theme/style/content contaminates across subjects in the same context.
This is why `x2-barrett-50-cal-sniper` came out crusader/blood-themed: the bolt-action Sol generated
it in the same agent as 5 occult-themed rifles, and their theme bled onto it.

RULE:
- Each character, each weapon, each pet form, each VFX subject gets its OWN agent for its image
  generation. No agent produces art for two subjects.
- COHERENCE is preserved NOT by sequential same-context generation but by a SHARED REFERENCE: generate
  the anchor/base subject first (e.g. the Drifter), then give every other subject's isolated agent that
  reference image + the house-style preamble. Shared reference = cohesion without bleed.
- Retroactive: the batched Barrett art (and any other batched art) is suspect and should be
  regenerated in isolation.

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
10. **Ricocheting chakrams** — build chakrams as a thrown weapon whose projectile RICOCHETS/bounces.
    The ricochet mechanic already exists in the catalog (`ricochetHops`, `ricochetRange`, `bounces`;
    see `x-gun-ricochet-pistol`, `x2-ricochet-roulette`), and thrown delivery exists — combine them.
    Queued right behind the thrown+sniper Sol to avoid a weapon-catalog collision.

## Note: the ".50cal bleed" question (2026-07-23)

Investigated: there is **no `bleed` status or mechanic** on the Barrett, the Ironhide 50-cal, or ANY
of the 327 weapons — `hitStatus`/`status` are both `undefined` on the Barrett, and zero weapon defs
contain the string "bleed". The only "bleed" in the codebase is graphics jargon: "full-bleed" card
art (a layout term) and a VFX alpha that "bleeds past the tear-off". So whatever the owner saw is
VISUAL (red hit particles or blood in the generated Barrett art), not a gameplay bleed — consistent
with the owner also flagging the Barrett's art as unwantedly "crusader"-themed. The new PLAIN sniper
avoids that theming.
