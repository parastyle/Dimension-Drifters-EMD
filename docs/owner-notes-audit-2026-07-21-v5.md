# Owner playtest notes — audit ledger v5 (2026-07-21 afternoon batch)

Source: `data/owner-notes.jsonl`, 55 notes `13:51Z`–`15:14Z`. Waves: V5G (systemic) first, then
V5A (projectile art generation), V5M (melee), V5R (ranged/caster). NEW STANDING RULES from this
batch: (1) projectile identity art is GENERATED via codex from the weapon as reference — never
cropped (owner rejected crops on Saintskull, Hexbore, Leviathan, Quill Storm); (2) any order
appearing for the 2nd+ time gets LIVE-probe verification, not just unit tests.

## V5G — SYSTEMIC

- **V5G1 — Screen shake -95%:** "Reduce all screen shake made by player weapons by 95%." A 98% cut
  shipped in v0.117; either regressed or new weapons added shake outside the clamp. Find the paths,
  apply a global player-weapon shake budget so future weapons cannot exceed it.
- **V5G2 — IMPACT-ANCHOR LAW:** "All VFX that are currently spawning on the character should be at
  cursor impact within radius." Sweep every weapon effect recipe: anything anchored to the
  character that represents a HIT belongs at the impact/cursor point (clamped to weapon radius).
  Named: Hexbloom Rapier, Sermon Bell (notes ON impact AT impact), Tombwarden slash to cursor,
  Hangman's Greatcleaver spatter on cursor, Cinderbrand Pike magma at impact.
- **V5G3 — Coilshot Meteor twirl (LIVE, 3rd order):** "should twirl in hand before being thrown" —
  ordered three times now. Live-probe the draw phase, prove rotation visibly reads, permanent gate.
- **V5G4 — Barrel-spawn regression cluster (LIVE):** the three new rifles (Brimstone Gallows,
  Gravedog, Stormspur) spawn bullets off-barrel; Hellbore Gatling misaligned too. The W4G sweep
  missed new-weapon registration — extend the live barrel probe to cover them + a catalog-wide
  muzzle-sanity test so future weapons can't ship misaligned.

## V5A — PROJECTILE ART GENERATION (codex renders; NO cropping)

| Weapon | Order |
|---|---|
| Saintskull Monstrance | holy skull gets its OWN generated image (not a weapon crop); big single-shot attack, not semi-auto |
| Quill Storm Repeater | generate its arrow image from the weapon reference |
| Mesa Hand-Cannon | big 50-cal bullets (generate); spawn slightly higher on the barrel |
| Hand Mortar | generate a real projectile image (replace the VFX blob) |
| Ghostbolt Crossbow | full arrow treatment (generated) |
| Leviathan Harpoon Gun | shoots its harpoon — GENERATE, do not crop |
| Hexbore Voidmaw | redo projectile NO CROPPING; grip: one hand handle, one higher on barrel |
| Brimstone Rocket Tube | trim the projectile to just the warhead; much bigger explosion |
| Widowmaker Arbalest | arrow 3x bigger (owner upgraded 2x -> "actually, 3x") |

## V5M — MELEE

| Weapon | Order |
|---|---|
| Reverent Broadsword | combo further forward, away from the body |
| Sanctified Headsman | lots more VFX, bigger |
| Mirage Hardlight Saber | held BACKWARDS — flip so the edge faces forward |
| Voltfang Tachi | both hands on handle, closer together, a bit lower |
| Frostfang Rakes | elaborate combo that carries the player forward |
| Gravechain Scythe | the purple smoke is anchored left-of-character in one spot — emit it around the FULL spin radius |
| Hollow Harvest | VFX in a full circle |
| Mournveil Scythe | faster spin |
| Quicksilver Chainblade | ARCHIVE (the archive system exists now) |
| Iron Vow Bearded Axe | rest: upright, slightly forward |
| Reliquary Halberd | rest upright slightly forward; attack 1 downward slash, attack 2 a SEAMLESS stab |
| Frostgig Harpoon | thrown from above the shoulders |
| Marrowpike Ranseur | triple-stab attack |
| Nullspike Pike | far hand on the purple handle |
| Cinderbrand Pike | magma VFX at impact (V5G2 named) |
| Gravedigger's Spade | attack = full character FRONTFLIP with 360 damage |
| Anvil-Drop | no debris VFX, just the smoke cloud |
| Sunlance Javelin-Pike | projectile no spin; thrown over shoulder |

## V5R — RANGED/CASTER

| Weapon | Order |
|---|---|
| Galvanic Liber of Storms | bigger AoE, bigger storm effects |
| Thunderhead Stormfists | forward attack grants IFRAMES + travels 4x as far (explicit owner order — implement server-side invuln window during the lunge; document duration) |
| Frostbite Snowglobe | leaves a frozen slow zone (zone system) |
| Cinderchoke Brazier-Orb | impact explosion VFX at the END of the strike (replace current) |
| Locust-Glass Plague-Orb | bugs render upside down when firing LEFT — fix mirroring |
| Gilded Hourglass Frost Scepter | beam -> slowdown zone weapon |
| Idol of the Pale Verdict | it FLOATS — hands must hold it |
| Sporebound Witchglobe | damage radius +20% |
| Stormcaller Rod | blue projectile, twizzle/wacky flight (waveform idiom on projectiles) |
| Tesla Faradayer | bullet 10x size |
| Calamity Howitzer | smoke plume per shot; big battleship shell, big boom; BIG energy cost + high cooldown (mechanics redistribution — document) |
| Tidehook Bombarpoon | projectile +40% |
| Permafrost Siege Lobber | VFX needs a lot of work — polish pass on the ice stream |
| Mauler Slug-Thrower | projectile = big fire plume |
| Graveshot Grenade Gun | fires an M203-style arced grenade shot |

Watermark: all notes ≤ 2026-07-21T15:14:06Z ledgered.
