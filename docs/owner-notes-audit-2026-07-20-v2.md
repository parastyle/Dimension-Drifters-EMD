# Owner playtest notes — audit ledger v2 (2026-07-20 evening batch)

Source: `data/owner-notes.jsonl`, 49 notes after watermark `18:10:40Z` through `21:26:54Z`.
Waves: NG (game) first, then NB (bugs), NR (redo of wave-1 work), NW (new weapon orders).

## NG — GAME NOTES (wave 1)

- **NG1 — BEAM ANCHORING REGRESSION (top priority):** "Beam weapon beams are still not anchored to
  the weapon. Need that to happen." The G1 fix (d6175ea) passed unit tests but the owner does not
  see it in-game. Requires LIVE verification (Playwright against the running client), root-cause of
  the test/reality gap, and a fix proven by live capture.
- **NG2 — Gloves replace hands:** glove WEAPONS render in place of the hand blobs (full replacement
  like the gear model), never overlaid on top.

## NB — BUG INVESTIGATIONS

| Weapon | Report |
|---|---|
| Galvanic Overcasters | "first couple shots were small and yellow? Investigate" (+ order: fire in bursts of 4) |
| Tombwarden Claymore | smoke VFX persists on the map FOREVER (leak); dark slash ~2% of sword size — scale to blade; REMOVE the old explosion VFX entirely |
| Arcanist's Lance | holding fire only emits a projectile every 2 shots — cadence bug |
| Permafrost Bardiche | whirlwind VFX way too small |
| Quicksilver Skinning Cleaver | chroma-key artifacts in sprite; also convert to thrown |

## NR — REDO / ITERATE on wave-1 work

| Weapon | Order |
|---|---|
| Cinderchoke Brazier-Orb | overhead hold ONLY at strike start, jiggle ~0.5s, then swing |
| Sparkknuckle Hex-Mitt | aura = codex-image tiny sparks, NOT overwhelming; punch combo needs to be far more expressive |
| Fulgurite Storm-Sphere | aura VFX codex-image driven |
| Cairn of Hollow Names | held further forward — character must stay visible |
| Cogwright's Tesla-Rod | warp needs VFX |
| Riftcleaver Greatblade | particles from the blade at swing MIDPOINT (in front); combo cooler still |
| Gravesinger's Hex-Wand | held like an RPG launcher over the shoulder; shoots something big and explody |
| Bogwater Twinbits | real throw motion: hands wind back, lurch forward on release |
| Boothill Hatchet | held upright |

## NW — NEW WEAPON ORDERS

### NW-MELEE (stances + combos; "no VFX" means none added)
| Weapon | Order |
|---|---|
| Godsbone Pillar | drags behind at the user's feet at rest |
| Cinderbrand Cleaver | downward strike; VFX from the blade |
| Sanctified Headsman | 35% bigger; holy slash codex VFX |
| Glacier Headtaker | fast 1-2 down-up chop; freezes enemies |
| Hollowmoon Reaver | melee with a cool combo |
| Iron Vow Bearded Axe | Garen spin, continuous hold |
| Dustdevil Glaive | jab-slash combo, no VFX |
| Quarry-Splitter Bardiche | blood spatter on hit (replaces VFX) |
| Mournveil Scythe | VFX radius = weapon radius; hold to fan-spin around self |
| Saintspar Lochaber | 1-2 chop (down then swing), no VFX |
| Pale Horizon Nodachi | both hands on hilt |
| Moonwake Great Katana | bespoke codex VFX |
| Wickfire Fauchard | held upright forward, knight-style |
| Quicksilver Censer | hangs on chain; 1-2 combo up then down |
| Voltfang Tachi | both hands on hilt; combo swing 2 goes UPWARD |
| Buckhorn Boarspear | blood spatter on hit |
| Venomtongue Trident | green chain lightning, poison damage (DEFAULT: 3 chain hops) |

### NW-THROWN
| Weapon | Order |
|---|---|
| Coilshot Meteor | full hand-twirl revolution before throwing |
| Boothook Harpoon | no spin in flight (point-first) |
| Carrion Cudgel | thrown, poison, ricochets to nearest target (DEFAULT: 1 ricochet hop) |

### NW-CASTER
| Weapon | Order |
|---|---|
| Permafrost Cryo-Bracer | shoots the icicle head off the weapon (weapon sprite as codex reference) |
| Galvanic Liber of Storms | spin weapon, lightning cloud spins around character (codex) |
| Thunderhead Stormfists | blue codex energy VFX; punch winds up behind then lurches character forward ~3 fist-lengths |
| Frostknuckle Rimewrap | scatter farther + tighter knit; shots from weapon tip |
| Voidwell Idol | lobs purple explosion bombs |
| Spitfire Censer-Wand | +50% size |
| Locust-Glass Plague-Orb | spawns bugs that waft into enemies and explode (bug from the weapon's head sprite as codex reference) |
| Gravewax Twin Idols | bullets clearly FIRE; weapon overlays ABOVE the hands |
| Sporebound Witchglobe | overhead vibrating channel; bio damage aura |
| Marshlight Bog-Censer Wand | continuous jiggle while attack streams out |

## DEFAULTS FLAGGED (no blocking questions)
- Venomtongue Trident chain: 3 hops. Carrion Cudgel: 1 ricochet. Stormfists lurch: authored lunge
  ~3 fist-lengths, server-validated displacement.

Watermark: all notes ≤ 2026-07-20T21:26:54Z ledgered.

## STATUS: ALL 49 NOTES CLOSED (2026-07-20 late)

NG wave: 951fb62 (beams live-proven + gloves replace hands). NB+NR: 32a3ae2 (5 bugs
root-caused, 9 redos). NW: this commit (20 melee/thrown + 10 casters). Suite 1460 green.
The beam-anchor e2e gate (e2e/tests/beam-anchor.spec.ts) now guards the live behavior.
