# Owner playtest notes — audit ledger v4 (2026-07-21 late-night batch)

Source: `data/owner-notes.jsonl`, 53 notes `01:59Z`–`02:29Z`. Waves: W4G (systemic, live-verified)
+ W4A (archive/redo) first, then W4M (melee/caster iterations), W4R (ranged). Damage discipline
standing: DPS-neutral unless mechanics force documented redistribution.

## W4G — SYSTEMIC (live evidence required where marked LIVE)

- **W4G1 — PISTOL TWIRL STILL MISSING (LIVE):** "Pistols still don't have the pistol twirl after
  consecutive shots... about .5 seconds after they're done firing... 1 handed AND dual wielding."
  The V3G2 implementation passed tests but does not manifest — reproduce live (Playwright frame
  capture), root-cause the test/reality gap, fix, prove with capture. Trigger moves to ~0.5s.
- **W4G2 — TINY-VFX DIAGNOSIS (owner's explicit ask):** on Dustreaper: "VFX are way way too small,
  like ant stuff... diagnose what type of VFX im talking about so we can isolate it and increase it
  for every weapon." Related sightings: Fulgurite "particles are like ants", Gravechain "1/40 of
  the visual dominance", Godsbone feather undersized. Identify the shared render path scaling
  painted particles tiny, fix at the SYSTEM level, sweep every consumer.
- **W4G3 — Shotgun stance law v2:** stock rests LOW on the shoulder, one hand on trigger, other on
  the pump under the main barrel (many currently stock+handle).
- **W4G4 — Foregrip-not-magazine law:** "Lots of guns that have foregrips are instead being held by
  their magazine." Audit every gun's secondary anchor; magazines are never grips. Named: Gravedog
  Auto-Rifle (hand on mag -> vertical foregrip), Stormspur Coil Carbine (same, +45% size),
  Dustdevil Riotgun (trigger + vertical foregrip), Tesla Drumbore (under-barrel + trigger).
- **W4G5 — Wavy beams:** "Some beams should do wavey shit like sine cosine etc, helix beams...the
  lot" — beam waveform system (sine/cosine/helix/etc. as recipe parameters), distributed tastefully
  across the beam roster. Named: Mirage Coilrifle = purple HELIX continuous beam.
- **W4G6 — Barrel alignment cluster (LIVE):** Stormcaller Tesla Gatling beams don't line up with
  barrels; Voltcaster beam off-barrel (+ make it RED); Coyote Stinger misaligned (+ less accurate);
  Hollowpoint Hex bullets from barrel. Verify muzzle math live, fix the offsets.

## W4A — ARCHIVE + REDO

- **Archive (6):** Mistral Kusarigama, Snakebite Lash, Ferrous Serpent, Dust-Devil Flail, Locust
  Flail, Nine-Tail Razorlash — all chain/flail-type (no physics engine). Build a proper archive
  mechanism: removed from drops/shops/portal/testing pages, catalog rows marked archived (codegen
  survives), owned instances auto-salvage to scrip at next join (pants-migration idiom). DEFAULT
  flagged.
- **Widowmaker Wrecking-Ball — REDO:** "redo weapon in likeness, but without any chains or
  disconnect (we dont have physics)" — re-render the art as a rigid maul/ball-on-haft in its
  likeness, rework mechanics accordingly.

## W4M — MELEE/CASTER ITERATIONS

| Weapon | Order |
|---|---|
| Voltvein Conductors | alternating fists: 1 fist forward per shot, alternate each shot |
| Locust-Glass Plague-Orb | VFX = the bug alone (not amber-locked), fix facing |
| Fulgurite Storm-Sphere | BIG visible VFX (W4G2), 3x damage radius |
| Saintskull Monstrance | beam -> character-sized holy skull projectile |
| Cairn of Hollow Names | purple only (no nuke stack), closer to player, 20-degree forward lean |
| Wyrmskull Reliquary | spear-like JABS |
| Gravesinger's Hex-Wand | 2x size; REAL artwork for projectile + explosion (render) |
| Bogwater Twinbits | +10% size; held 20-degree upright |
| Dustreaper Zweihander | the W4G2 poster child — verify post-fix |
| Coilshot Meteor | full in-hand twirl before throw (repeat order — verify it exists, make it read) |
| Riftstep Katana | combo OPENS with a stab; research the pose |
| Godsbone Pillar | feather sized to match other shards; 2x VFX count |
| Reaper's Tithe | bottom hand ON the weapon |
| Gravechain Scythe | way more VFX (W4G2), spin continuously ONE direction (currently ping-pongs) |
| Hailspur Sickle | needs a throw animation |
| Verdigris Grand Grimoire | pages 7x bigger, 2x range |
| Thunderhoof Splittingaxe | Garen-spin whirlwind |
| Hangman's Gavel | thrown weapon |

## W4R — RANGED

| Weapon | Order |
|---|---|
| Tracer-Saint Carbine | +30% size |
| Quicksilver Fanner | 2x size; fires 6 shots at a time |
| Ricochet Pistol | blue lightning bullets + chain lightning |
| Tumbleweed Skipper | blue bullets |
| Gravelthroat Repeater | full-auto, random 1-10 pellets per shot in random directions |
| Mirage Coilrifle | purple helix continuous beam (W4G5) |
| Hexbore Voidmaw | shoots purple runes like the ones on its barrel (sprite-derived) |
| Widowmaker Cannon | massive gray cannonballs |
| Permafrost Siege Lobber | ice flamethrower (continuous cone stream) |
| Buckshot Avalanche | 4 big bullets at a time |
| Doomsday Drum Cannon | magma in a cone wave |
| Tidehook Bombarpoon | shoots its harpoon — ammo from reference image |
| Whisperbarb Hand-Crossbow | crossbows +50%; shoots arrows |
| Widowmaker Arbalest | REDO arrow: GENERATE the art via codex, don't crop from the weapon |
| Tesla Faradayer | purple lightning bullets |

## DEFAULTS FLAGGED
Archive mechanism: retired from drops/catalog UIs, owned copies auto-salvage to scrip at next join.
Gravelthroat randomness server-seeded. All else verbatim.

Watermark: all notes ≤ 2026-07-21T02:29:31Z ledgered.
