# Owner playtest notes — audit ledger v3 (2026-07-20 night batch)

Source: `data/owner-notes.jsonl`, 75 notes `23:10Z`–`23:48Z`. Waves: V3G (game-wide gun-handling
systems) first, then V3M (melee/stances), V3C (caster redos+new), V3R (ranged per-gun), V3X (VFX
variants + new content). Standing damage discipline: DPS-neutral unless a mechanic forces
redistribution (document it).

## V3G — GAME-WIDE GUN-HANDLING SYSTEMS (wave 1)

- **V3G1 — Dual pistols offset:** dual-wielded pistols hold one hand slightly above the other so
  both guns read.
- **V3G2 — Pistol idle twirl:** EVERY pistol does a twirl after 1s of not firing (extends the
  flourish idle-settle system).
- **V3G3 — Lever-action law:** any rifle with a lever gets a hand ON the lever + a lever-crank
  animation after each shot (named: Thunderhead Repeater Cannon — also slower cadence + blue
  projectiles + hand-on-lever; Boneash Scattergun-Rifle; Venomspine Repeater).
- **V3G4 — Shotgun pump law:** shotguns always have one hand on the pump + pump animation after
  each shot; the pump hand renders ABOVE the gun layer so it's visible (named: Buckshot Briar,
  Carom Coachgun).
- **V3G5 — Grip truth (per-gun grip points as data):** many guns render without correct hands —
  Hexpost Charm-Pole 2-hands-like-a-rifle; Embernail Repeater second hand under barrel; Widowmaker
  Arbalest second hand on the crank; Thunderhead Spikecaster one hand on handle; Hailstorm Coilgun
  at least one hand on handle; Dustdevil Riotgun handle + vertical foregrip; Cinderquill
  Dart-Caster 2 hands (+2x size); Boneyard Ricochet Mortar both hands; Brimstone Rocket Tube held
  on the shoulder behind the head, actual-RPG style.

## V3M — MELEE / STANCES / COMBOS

| Weapon | Order |
|---|---|
| Hollow Harvest | full 360 twirl (over head, under feet); longer hold = more swings |
| Gravechain Scythe | hands on the shaft; Garen back-and-forth continuous hold |
| Mournveil Scythe | REDO twirl: perfect circle, shaft midpoint pivoting on character center, spins while held; remove all VFX except the red circle |
| Reaper's Tithe | held upright like a walking staff; walking animation taps it on the ground step after step |
| Quarry-Splitter Bardiche | VFX 4x size |
| Dustdevil Glaive | 2x longer; 2-hit combo |
| Blightfork Glaive | jab attack animation |
| Hailspur Sickle | thrown weapon |
| Frostgig Harpoon | throw starts behind the shoulders; 2x size; projectile flies POINT-FIRST (no tumble — the owner's two notes reconcile to: missile-style, no axe-spin) |
| Saintspar Lochaber | 2-hit: chop, then mirrored flip swiping UP |
| Reliquary Halberd | down-slash then stab, continuous motion across two inputs; remove VFX |
| Wyrmskull Reliquary | combos like a sword |
| Stillwater Edict | 2x size; both hands on hilt |
| Riftstep Katana | default stance: 2 hands, blade forward, hilt behind the ears (samurai) |
| Pale Horizon Nodachi | resting pose = Hassō-no-kamae (eight-direction stance) |
| Hailwidow Katana | tachi-no-tori resting stance; 3-hit combo |
| Thunderhead Voulge | 66% size; held UPRIGHT (currently gun-style); lots of electrical codex VFX |
| Wickfire Fauchard | resting stance angled more forward |
| Sermon Bell | musical-note VFX (replace) |
| Nullspike Pike | VFX circle spawns ON the enemy on hit |

## V3C — CASTER REDOS + NEW

| Weapon | Order |
|---|---|
| Hexbloom Scattergrimoire | book OPENING faces the projectile direction |
| Galvanic Liber of Storms | REDO: Garen-style spin WITH the character (whirlwind idiom), more thunderclouds |
| Coffin-Nail Rosary Orb | swung when attacking (keep chain hang at rest) |
| Coyote Trickster's Sparkmitt | monk-fist punching combo; remove aura, tiny sparks only (mirror the Hex-Mitt NR treatment) |
| Witherleaf Bestiary | vibrates like shaking the book, not swung; VFX from the tip |
| Hailshard Resonator | twirls in hand as a channel; shards spray sporadic 360 |
| Arcanist's Lance | triple shot (DEFAULT: 3-projectile volley, damage split, DPS unchanged) |
| Snakeoil Tincture Scepter | green sparks from the tip when attacking |
| Carrion Roost Necro-Scepter | 2x size |
| Sporebound Witchglobe | wider damage circle; bigger VFX |
| Cairn of Hollow Names | purple explosion VFX (replace); held a little MORE forward still |
| Vagrant's Wishing Marble | purple explosion VFX (replace) |
| Thunderpost Fetish | more combo |
| Carrion Effigy | bigger AoE explosion |

## V3R — RANGED PER-GUN (beyond the V3G laws)

| Weapon | Order |
|---|---|
| Gatling | bullets from the TOP barrel |
| Grave-Anchor Harpoon | shoots the harpoon from its front — projectile derived from the weapon sprite |
| Widowmaker Arbalest | projectile = arrow derived from reference via codex |
| Brimstone Rocket Tube | projectile = actual missile from reference |
| Quill Storm Repeater | arrows, not bullets |
| Hailshot Hand-Maul | shoots a cannonball, NO explosion |
| Sanctus Siege Bombard | massive cannonball |
| Boneyard Ricochet Mortar | projectiles are fireballs |
| Reliquary Nailcaster | bullets spawn from its 3 tips sequentially (1-2-3 cycle) |
| Brimstone Bull | two bullets at once, parallel |
| Hallowbore Coachgun | two bullets (two barrels) |
| Sunbreaker Railgun | 2 parallel bullets per barrel; much faster; sonic-boom ring at the barrel per shot |
| Stormcaller Tesla Gatling | six tiny beams, one per barrel tip |
| Voltcaster Machine Pistol | beam from barrel TIP; much thinner laser |
| Scattershell Duster | ART FIX: currently one image containing two pistols — split to a single-pistol sprite (crop from existing art), make it a default dual-wield pair; 2 bullets per gun (4 dual) |
| Spore-Spitter Blunderbuss | attack = growing poison smoke ring (zone-system idiom) |
| Snakebite Dart-Slinger | 2x size |
| Frostbore Scattergun | +40% size |
| Ashfall Peacemaker | +33% size |

## V3X — VFX VARIANTS + NEW CONTENT

- **Anvil-Heart quake VFX family:** the owner: "Whatever VFX this is, we use it on ALOT of weapons.
  We need more variants of this on them that use this one." Identify every weapon sharing the
  quake/impact VFX, author several distinct variants over the particle packs, and distribute so no
  large group shares one look.
- **Auto rifles with foregrips (NEW content):** "could use a few auto rifles" — DEFAULT: 3 new
  ranged weapons (concept + codex art + codegen defs + the V3G5 foregrip grip), balanced into the
  existing ranged band.

## DEFAULTS FLAGGED
Arcane Lance triple = split volley, DPS unchanged. Frostgig = point-first no-tumble. Auto rifles = 3
new weapons. All else verbatim.

Watermark: all notes ≤ 2026-07-20T23:48:31Z ledgered.

## STATUS: ALL 75 NOTES CLOSED (2026-07-21 early)

V3G+V3M: 8a49904. V3C+V3R: 8f3d939. V3X: this commit — quake-VFX variant family
distributed, catalog grows 326 -> 329 with the three foregrip auto rifles (Brimstone
Gallows Rifle, Stormspur Coil-Carbine, and kin), fully rendered + registered. Suite
1545 green, beam e2e green, all codegen/asset checks in sync.
