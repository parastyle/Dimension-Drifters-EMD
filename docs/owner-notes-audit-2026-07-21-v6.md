# Owner playtest notes — audit ledger v6 (2026-07-21 evening batch)

Source: `data/owner-notes.jsonl`, 50 notes `17:33Z`–`18:01Z`. Waves: V6G (systemic + escalated
repeats, LIVE-verified) first, then V6A (art programs incl. owner prototypes), V6M (melee), V6C
(caster/ranged). Standing rules apply: repeats get live probes; projectile/identity art is
GENERATED, never cropped.

## V6G — SYSTEMIC + ESCALATED REPEATS

- **V6G1 — IMPACT-ANCHOR ESCALATION (LIVE — owner: "I think I had already asked you to do this"):**
  the V5 sweep missed a family. Wendigo Claws VFX not on the target area; Revenant Knuckle's circle
  aura ("a few weapons have it and I dont like it") must fire on the ATTACKED area — find every
  weapon sharing that circle-aura recipe; Riftcaller Naginata self-aura on attack REMOVED;
  Seraph's Knuckle-Reliquary beam endpoint at the cursor; Dustreaper flame hits at cursor
  direction/placement (+30x more flame per its row). Re-run the anchor sweep with the fist/claw/
  gauntlet family explicitly included, live-probe the named five, permanent coverage test.
- **V6G2 — Katana bespoke slash program:** every katana (the 10 drift-* line + hailwidow + any
  katana-tagged) gets a codex-image slash VFX, each visually DISTINCT by color or slash language.
- **V6G3 — Simple-geometry audit:** hunt visible primitive shapes in VFX (the Brimstone explosion
  shows a clean circle — "that kinda stuff ruins immersion"). Audit all effect recipes for
  unmasked geometric primitives; replace with painted/organic treatments.
- **V6G4 — Muzzle-flash program:** codex-GENERATED muzzle flash images (many variations, assigned
  so guns don't feel identical); doubles as cover for barrel seams.
- **V6G5 — Forward-staff grip law:** staves pointed at the cursor are held with TWO hands, one
  further up the shaft (grip data law, sweep the staff family).

## V6A — ART PROGRAMS

- **Sanctified Headsman — HOLY BLADE EXTENSION PROTOTYPES (owner decision loop):** replace VFX with
  a holy-magic blade extension giving swings 3x the blade length. Owner: "Give me some prototypes
  on this one. I think we'll use this one alot." Produce 3-4 distinct prototype treatments
  (e.g. solid radiant edge, translucent gold ghost-blade, particle-woven arc, cathedral-glass
  shard blade), implement behind a dev toggle, and deliver a comparison the owner can view
  (?dev=weapon deep links per variant + a contact sheet). DO NOT pick the winner — the owner picks.
- **Gravedigger's Spade -> Buster Sword:** keep the beloved frontflip animation, replace the ART
  with a buster-sword equivalent (simple, heroic, NO trademark likeness), wider AoE. Codex render.
- **Verdigris Grand Grimoire + Twin Whispervolumes — REAL PAGES (repeat, escalated):** "what the
  fuck VFX am I even looking at? Are those supposed to be pages? If so use actual images." Generate
  page art via codex; both books shoot recognizable pages.
- **Coyote's Grin:** projectile asset MISSING — generate it; and ensure NO thrown weapon carries
  the yellow circle marker over it (find + remove that overlay recipe).

## V6M — MELEE

| Weapon | Order |
|---|---|
| Coyote Trickster's Sparkmitt | punches must be FAST and numerous — full monk flurry animation |
| Glasswidow Hexweave | +77% size |
| Abyssal Apocrypha | melee conversion, Garen spin, purple vortex around the spin, big AoE |
| Cinderbrand Cleaver | hold = alternating L/R chops, ~0.3s each (3/sec), character walks forward during |
| Coilshot Meteor | the pre-throw twirl DEALS DAMAGE |
| Hollow Harvest | fire VFX "look like little turds" — bigger, organically shaped (V6G3 applies) |
| Hailspur Sickle | throw in ARC motion |
| Rusty Cleaver | throw in ARC motion |
| Hangman's Gavel | throw in ARC motion |
| Snakebite Morningstar | thrown weapon |
| Dustdevil Glaive | held upright angled forward; combo chop then stab |
| Kagewake | ARCHIVE (+ archive the hushglass combo partner) |
| Cinderfang Wakizashi Pair | attack + VFX forward, away from the body |
| Stormthread Tachi | 2x size |
| Saintspar Lochaber | second combo hit swings UPWARD (currently two downswings — repeat order, live-verify) |
| Reaper's Tithe | current swing becomes hit 2; hit 1 is a downswing from rest |
| Rimethorn Naginata | 2x size; swipe follows cursor (aim up = swipe up) |
| Drowned Anchor | 1.5x size; VFX 30x |
| Galvanic Lancepole | poison AND electric damage |
| Pyreclap Mauler | faster animation |

## V6C — CASTER/RANGED

| Weapon | Order |
|---|---|
| Hexbloom Scattergrimoire | farther projectiles |
| Null Grimoire | beam black with purple outline |
| Glyphward Manuscript | projectiles = the holy feather assets we have, LOTS, medium range |
| Dust-Devil Cyclone Orb | keep VFX, make purple |
| Fulgurite Storm-Sphere | VFX blue |
| Thunderhead Stormfists | the lunge is way too slow — SUPER fast |
| Hexbolt Spitter-Mitt | purple projectiles |
| Hexpost Charm-Pole | jab, not swing |
| Thunderpost Fetish | jab, not swing |
| Ghostbolt Crossbow | arrow 3x bigger |
| Brimstone Rocket Tube | bigger explosion (again — and V6G3's circle-free treatment) |
| Calamity Howitzer | knockback on user 2x |
| Tidehook Bombarpoon | much bigger ICE explosion |

Watermark: all notes ≤ 2026-07-21T18:01:07Z ledgered.
