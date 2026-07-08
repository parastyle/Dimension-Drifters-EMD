# Brotato → Dimension Drifters parity assessment

> Research + recommendations from the v0.117 overnight pass. TL;DR: DD is **not** a wave-survivor —
> it's a dimension-chain roguelite with a bespoke boss framework, roaming shifters, and loot-swap
> weapons. So Brotato's systems don't port wholesale; they need adaptation, and a few would be a
> **redesign you should sign off on** rather than an overnight bolt-on. This doc separates "already
> better than Brotato", "cheap high-value parity", and "big decisions for you".

## How DD already differs from Brotato (important context)

| Axis | Brotato | Dimension Drifters (today) |
|---|---|---|
| Structure | 20 fixed waves + shop between each | Dimension chain: survive → boss at ~120s → **extract or descend** deeper (risk/reward) |
| Difficulty | Danger 0–5 preset ladder | Scales by **run time × player count × chain depth** (continuous, no waves) |
| Weapons | 6 auto-firing slots, dup→tier-up, class set-bonuses | Held weapon(s) you **swap via loot drops**; WYSIWYG melee/gun/thrown, augment layers |
| Economy | Materials = XP **and** gold; field pickups + vacuum | XP is **squad-shared per kill** (no material pickups); weapons grabbed with R |
| Progress screen | Combined shop + 4-card level-up between waves | Level-ups + augment picks happen in-run (level windows) |
| Bosses | 2 base bosses, 2–3 phases | **11 bespoke data-driven bosses**, phase machine + telegraph DSL — richer than Brotato |
| Defense | Dodge %, armor, few i-frames | **Parry** (i-frames + knockback + chain + riposte + now projectile-reflect) — DD's signature |

**Where DD already beats Brotato:** the data-driven boss/phase/telegraph framework, the parry skill
layer, and the greed loop (extract vs descend) are all more interesting than Brotato's equivalents.

## Already present in DD (no work needed)

Knockback ✓ · damage numbers ✓ · screen shake (trauma-ish) ✓ · hit-stop ✓ · enemy hit-flash ✓ ·
death effects ✓ · combo pops ✓ · elite/tough tier (≈ Brotato elites) ✓ · multi-phase telegraphed
bosses ✓. DD is already juicy.

---

## Cheap, high-value parity (fits DD without a redesign) — ranked

1. **Crit system** — ✅ **DONE (§30, v0.118).** `critChanceFor(luk,dex)` (5% base, +2%/LUK, +0.8%/DEX,
   cap 75%) + `CRIT_MULT=2`, rolled server-side per damage source in `damageEnemy`; a crit doubles the
   hit, bumps the synced `EnemyState.critFlash`, and the client renders a bold GOLD `N!` number + gold
   flash + shock ring + extra hit-stop.
2. **Weapon class set-bonuses** — ✅ **DONE (§30, v0.118).** `weaponSetBonus(loadout, heldId)` off
   `tags.classPool`: +8% at 2-of-a-class, +18% at 3 (scaled to DD's 3-slot loadout). Folded into
   `heldDamageMult`; the belt arsenal HUD shows `⚔ SET +N%`.
3. **Harvesting-style end-of-fight bank bonus** — DD already banks salvage at the portal; a small
   "harvest" stat that pays a scaling bonus at extract would reward the econ/greed axis. *Low effort.*
4. **Pickup magnet** — Brotato's signature dopamine loop. **Does not map today**: DD has no material
   pickups (XP is per-kill). Only relevant if you add a currency-pickup economy (see below). *Skip
   unless you want the economy change.*

## Big decisions for you (redesign-scale — do NOT want me doing these unprompted)

- **Wave mode + shop phase.** Brotato's fight→shop→fight rhythm is its whole identity, but DD's
  identity is the *dimension chain*. Bolting waves on would fight the existing design. If you want a
  **separate "Arena/Horde" game mode** alongside the dimension run, that's a real, fun addition — but
  it's a feature-sized decision, not an overnight tweak. I left it untouched.
- **Material economy (XP = gold dual-use) + between-run shop.** Same story — a genuine economy layer
  is great but it reshapes the loot/progression loop you already have. Worth a design chat first.
- **6-slot auto-fire inventory + dup→tier-up.** DD's loot-swap + WYSIWYG-hold model is deliberate and
  different. Converting to Brotato's inventory is a rewrite of the weapon core, not parity.

My recommendation: do **crit (#1)** and **set-bonuses (#2)** next — they add the most build depth for
the least disruption and slot into systems DD already has. Hold the wave/shop/economy items for a
design conversation.

---

## Appendix — full Brotato research report

<details><summary>Mechanics deep-dive (waves, stats, weapons, shop, economy, bosses, leveling, juice, danger)</summary>

Sourced from the Brotato wiki (spellsandguns / Fandom), brotato-builds.com, Steam, community guides.

### Core loop
20 waves; timers 20s→ +5s/wave → capped 60s (wave 20 = 90s boss wave). Enemies spawn from all edges
with a ~1s "X" edge telegraph before materializing; spawn budget rises through a wave so pressure
peaks near the end. Enemy HP = base + perWave×(wave−1), then ×danger multiplier.

### Stats (~16)
Max HP, HP Regen, Life Steal (cap 10 HP/s), Damage %, Melee/Ranged/Elemental Damage (flat adds),
Attack Speed (cap ~12/s), Crit Chance, Engineering (structures only; % Damage does NOT touch them),
Range (melee gains half), Armor (~6.66% more effective HP per point, diminishing), Dodge (cap 60%),
Speed, Luck (drop/rarity meta), Harvesting (mats+XP at wave end, self-+5%). Damage pipeline:
`(base + typeFlat) × (1+dmg%)`, roll crit → ×critMult; armor: `taken = incoming/(1+0.0666×armor)`.

### Weapons
6 slots, auto-target/auto-fire. Tiers 1–4; **buying 2 identical same-tier auto-combines → tier+1**
(the upgrade path). Classes (Blade/Blunt/Precise/Heavy/Elemental/Medical/Support/Ethereal/Primitive/
Gun/Explosive/Tool/Medieval/Unarmed/Legendary) grant escalating set bonuses at 2/3/4/5/6 held. Some
weapons carry 2 classes. Melee = arc, scales Melee Dmg, knockback; ranged = projectile, scales Ranged.

### Shop / items
Up to 4 offers between waves (weapons + passive items). Rarity T1–4 with per-item minWave + a
per-wave chance ramping to a cap; Luck shifts higher tiers up. Price `round(base + wave + base×0.1×
wave)`. Reroll cost scales with wave (~`floor(w×0.75)+floor(w×0.4)`, +`floor(w×0.4)` each). Buying all
4 = free reroll. **Lock** any offer to persist across rerolls at its locked price. Recycle for 25%.

### Economy
Materials = the one currency; each grants **1 XP and 1 gold**. From kills, field pickups, and
Harvesting (paid at wave end). Field cap **50** (excess merges value into existing blobs). "Bag"
catch-up adds uncollected mats to later drops. Drop-chance decays from wave 5 (−1.5%/wave, floor 50%);
horde waves drop ×0.65.

### Enemies / elites / bosses
~21 archetypes. Elites on Elite Waves (Danger 2+): one phase-shifting elite amid the wave, mutating at
HP-threshold **or** time (whichever first); killing one drops a **legendary crate + 100 HP heal**.
Bosses at wave 20 (2 on Danger 5): Predator (dash + orbiting ring → omnidirectional bursts), Invoker
(ground-AoE zones → denser → +150% speed spinning bullet walls). Screen-filling feel = regular enemies
STILL spawn during the boss + orbiting rings + expanding hazards.

### Leveling
XP = mats collected; `XP_needed(level) = (level+3)²`. Level-up = +1 Max HP now + a queued **1-of-4
upgrade card** (4 tiers, rarity keyed to your level + Luck) shown on the wave-end/shop screen.

### Juice
Pickup vacuum/magnet (items fly in; +range items; all vacuum at wave end) — a core dopamine loop.
Knockback pushes enemies **away from the player** (not along projectile). Damage numbers (crits
distinct). Screen shake. Enemy flash/death poofs. **Everything toggleable** for readability at bullet-
heaven density — design juice with an intensity slider.

### Danger / pacing
Danger 0–5: dmg/HP +0/+0/+0/+12/+26/+40%; elite/horde waves at slots {11–12},{14–15},{17–18}
(1/1/3 by tier; 40% horde / 60% elite). Horde = big extra swarm, ×0.65 mats. Endless: rising factor,
HP scales ~2.25× harder than damage.

</details>
