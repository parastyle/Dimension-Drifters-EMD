/**
 * §10/§13 IN-RUN LOOT (v0.104, audit C5/H7/M3) — rarity tiers, the single Terraria affix, drop rolls,
 * and the power-budget curation for the expansion arsenal. PURE + data-driven: the server rolls with
 * `Math.random()` inputs, the client renders from the synced results; nothing here touches engine or
 * network types.
 *
 * Canon (§10 [LOCKED]): SEVEN rarity tiers (Common → Uncommon → Rare → Really Rare → Legendary →
 * Ultimate → Cursed); rarity affects the weapon's own numbers; CURSED is the high-variance gamble tier
 * telegraphed ghostly-purple BEFORE pickup; exactly ONE affix per weapon, rolled on drop (rarity never
 * changes affix count); no pity system. §11: LUK reads into rarity — this is where the dormant attribute
 * finally scales something. §13: drops telegraph type+rarity but hide identity until grab (mystery);
 * bosses guarantee a drop; loot is squad-shared.
 */

import { beamDescriptorFor } from "./combat.js";
import {
  BEAM_AGGREGATE_TARGET_CAP,
  BEAM_MAX_RANGE,
  BEAM_MAX_WIDTH,
  BEAM_RECOVERY_SECONDS,
  LUK_RARITY_PER,
  SCRIP_BY_RARITY,
} from "./constants.js";
import { clamp } from "./math.js";
import { katanaExpectedMechanic } from "./melee.js";
import type { WeaponDef } from "./weapons.js";
import { WEAPONS } from "./weapons.js";

/** One rarity tier. `dmg` multiplies every damage source of the weapon; `weight` is the base drop odds
 *  share (LUK up-weights the higher tiers); `salvage` is the tier's carried-salvage value; `color` is the
 *  tier cue used on pickups/cards (cursed's ghostly purple is the §10 pre-pickup telegraph). */
export interface RarityDef {
  id: string;
  name: string;
  weight: number;
  dmg: number;
  salvage: number;
  color: number;
}

/** Index into RARITIES is the synced `rarity` value (uint8) — 0 = Common. */
export const RARITIES: readonly RarityDef[] = [
  { id: "common", name: "Common", weight: 46, dmg: 1.0, salvage: 1, color: 0x9aa5b1 },
  { id: "uncommon", name: "Uncommon", weight: 26, dmg: 1.08, salvage: 2, color: 0x59c96b },
  { id: "rare", name: "Rare", weight: 14, dmg: 1.18, salvage: 3, color: 0x4aa3ff },
  { id: "really-rare", name: "Really Rare", weight: 7, dmg: 1.3, salvage: 5, color: 0x2fd6c3 },
  { id: "legendary", name: "Legendary", weight: 4, dmg: 1.45, salvage: 8, color: 0xffa53a },
  { id: "ultimate", name: "Ultimate", weight: 1.6, dmg: 1.65, salvage: 12, color: 0xff4a6a },
  { id: "cursed", name: "Cursed", weight: 1.4, dmg: 1.5, salvage: 4, color: 0xa06bff },
] as const;

export const RARITY_COMMON = 0;
export const RARITY_CURSED = RARITIES.length - 1;

/** The §10 single affix (Terraria model): multipliers on the held weapon's damage + cooldown. Rolled
 *  ONCE on drop; cursed drops roll from the EXTREME table instead (great-but-dangerous or a dud). */
export interface AffixDef {
  id: string;
  name: string;
  weight: number;
  dmg: number;
  cd: number;
}

export const AFFIXES: readonly AffixDef[] = [
  { id: "", name: "", weight: 30, dmg: 1, cd: 1 }, // plain — no affix line on the card
  { id: "keen", name: "Keen", weight: 14, dmg: 1.12, cd: 1 },
  { id: "swift", name: "Swift", weight: 14, dmg: 1, cd: 0.82 },
  { id: "heavy", name: "Heavy", weight: 10, dmg: 1.25, cd: 1.2 },
  { id: "light", name: "Light", weight: 10, dmg: 0.88, cd: 0.75 },
  { id: "balanced", name: "Balanced", weight: 8, dmg: 1.06, cd: 0.92 },
  { id: "brutal", name: "Brutal", weight: 6, dmg: 1.35, cd: 1.35 },
  { id: "worn", name: "Worn", weight: 5, dmg: 0.9, cd: 1 }, // the dud tail — no pity, some drops just shrug
  { id: "sluggish", name: "Sluggish", weight: 3, dmg: 1, cd: 1.18 },
] as const;

/** The CURSED gamble table (§10 "great-but-dangerous or straight-up a dud"). */
export const CURSED_AFFIXES: readonly AffixDef[] = [
  { id: "blessed", name: "Blessed", weight: 35, dmg: 1.6, cd: 0.85 },
  { id: "frenzied", name: "Frenzied", weight: 15, dmg: 1.9, cd: 1.5 },
  { id: "doomed", name: "Doomed", weight: 35, dmg: 0.55, cd: 1.6 },
  { id: "hollow", name: "Hollow", weight: 15, dmg: 0.4, cd: 0.7 },
] as const;

/** Weighted pick: map a uniform roll [0,1) over `defs` by weight. PURE. */
function weightedPick<T extends { weight: number }>(defs: readonly T[], roll: number): T {
  const total = defs.reduce((s, d) => s + d.weight, 0);
  let r = Math.min(0.999999, Math.max(0, roll)) * total;
  for (const d of defs) {
    r -= d.weight;
    if (r < 0) return d;
  }
  return defs[defs.length - 1] as T;
}

/** Roll a rarity index from a uniform [0,1) roll + the squad's best LUK (§11 — each LUK point above 1
 *  up-weights every tier above Common multiplicatively, tier-compounding so the top tiers gain the most;
 *  no pity, pure chance). CURSED's exponent is CAPPED at 3: without the cap a max-LUK build turns the
 *  troll-gamble tier into ~43% of all drops and farms its favorable Blessed EV (adversarial-verify) —
 *  capped, luck builds chase Legendary/Ultimate while cursed stays a rare knowing gamble. PURE. */
export function rollRarity(roll: number, luk = 1): number {
  const boost = 1 + LUK_RARITY_PER * (Math.max(1, luk) - 1);
  const boosted = RARITIES.map((r, i) => ({
    weight: r.weight * boost ** (i === RARITY_CURSED ? 3 : i),
    idx: i,
  }));
  return weightedPick(boosted, roll).idx;
}

/** Roll the §10 single affix from a uniform [0,1) roll. Cursed weapons roll the EXTREME table. PURE. */
export function rollAffix(roll: number, rarity: number): AffixDef {
  return weightedPick(rarity === RARITY_CURSED ? CURSED_AFFIXES : AFFIXES, roll);
}

/** Resolve an affix id (synced string) back to its definition — unknown/empty = plain. PURE. */
export function affixById(id: string): AffixDef {
  return (
    AFFIXES.find((a) => a.id === id) ??
    CURSED_AFFIXES.find((a) => a.id === id) ??
    (AFFIXES[0] as AffixDef)
  );
}

/** The TOTAL damage multiplier a held weapon's loot identity contributes (rarity × affix) — the server
 *  multiplies every damage source of the HELD weapon by this; the card shows the same number (WYSIWYG). */
export function lootDamageMult(rarity: number, affixId: string): number {
  return (RARITIES[rarity]?.dmg ?? 1) * affixById(affixId).dmg;
}

/** The held weapon's cooldown/fire-rate multiplier from its affix (rarity never touches speed). */
export function lootCooldownMult(affixId: string): number {
  return affixById(affixId).cd;
}

/** §13 carried-salvage value of salvaging an EARNED weapon of this rarity. */
export function salvageValue(rarity: number): number {
  return RARITIES[rarity]?.salvage ?? 1;
}

/** §29 v0.118 SCRIP paid at a shopkeeper for SELLING a weapon. Only earned (enemy-dropped) weapons pay —
 *  conjured/gallery weapons sell for nothing (the same anti-launder rule as salvage). */
export function scripValue(rarity: number, earned: boolean): number {
  if (!earned) return 0;
  return SCRIP_BY_RARITY[Math.min(rarity, SCRIP_BY_RARITY.length - 1)] ?? SCRIP_BY_RARITY[0];
}

/**
 * M3 — the pure "effective power" estimator: Σ over the weapon's damage sources of base × count, divided
 * by the source's real cadence (gun fire-rate / weapon cooldown), with a mild reach credit (range is
 * survivability — a 600px gun at equal DPS is stronger than a 120px knife). Deliberately coarse: it exists
 * to catch ORDER-OF-MAGNITUDE outliers before they enter the drop pool, not to fine-balance.
 */
/** Expected targets hit per projectile with `pierce` points at horde density: the first hit is certain,
 *  each further pierce lands ~60% of the time (the line thins out). A pierce-6 bolt is ~4 targets, not 2 —
 *  the old flat min(2,…) cap under-rated high-pierce guns into the pool (adversarial-verify). */
function pierceTargets(pierce: number | undefined): number {
  return 1 + 0.6 * (Math.min(6, pierce ?? 1) - 1);
}

export const BeamPowerCycle = {
  EarlyVent: "early-vent",
  FullOverheat: "full-overheat",
} as const;
export type BeamPowerCycleValue = (typeof BeamPowerCycle)[keyof typeof BeamPowerCycle];

/** G-04 cycle-normalized aggregate output for one beam commitment. The numerator uses real beam DPS and
 * active time. The denominator prices charge, chosen/forced vent debt, overheat lock, and cooling back to
 * restart heat. Width/range estimate honest crowd coverage but never exceed the shared three-target budget. */
export function beamCyclePower(def: WeaponDef, cycle: BeamPowerCycleValue): number {
  if (!def.beam) return 0;
  const beam = beamDescriptorFor(def, 0, 0);
  const early = cycle === BeamPowerCycle.EarlyVent;
  const heatLimit = early ? 0.85 : 1;
  const heatActive = Math.max(0, (heatLimit - beam.ignitionHeat) / beam.heatPerSecond);
  const activeSeconds = Math.min(beam.maxChannelSeconds, heatActive);
  if (activeSeconds <= 0) return 0;
  const endingHeat = early
    ? Math.min(heatLimit, beam.ignitionHeat + activeSeconds * beam.heatPerSecond)
    : 1;
  const coolDebt = Math.max(0, endingHeat - beam.restartHeat);
  const coolingSeconds =
    beam.coolPerSecond > 0 ? coolDebt / beam.coolPerSecond : Number.POSITIVE_INFINITY;
  const ventSeconds = (early ? BEAM_RECOVERY_SECONDS : beam.lockSeconds) + coolingSeconds;
  const widthNorm = Math.min(1, beam.width / BEAM_MAX_WIDTH);
  const rangeNorm = Math.min(1, beam.range / BEAM_MAX_RANGE);
  // A narrow/ranged beam only realizes that theoretical coverage if the player can actually sweep it onto
  // new bodies. Price lag and turn cap independently so one cannot hide the other at the aggregate cap.
  // This is an efficiency discount only: control can never inflate authored DPS or the three-target budget.
  const sweepControl =
    0.55 * clamp(0.16 / Math.max(0.04, beam.sweepLagSeconds), 0.65, 1) +
    0.45 * clamp(beam.maxTurnRate / 8, 0.65, 1);
  const coverage = Math.min(
    BEAM_AGGREGATE_TARGET_CAP,
    1 + (BEAM_AGGREGATE_TARGET_CAP - 1) * (0.55 * widthNorm + 0.45 * rangeNorm) * 0.65,
  );
  const cycleSeconds = beam.chargeSeconds + activeSeconds + ventSeconds;
  return Number.isFinite(cycleSeconds)
    ? (beam.damagePerSecond * activeSeconds * coverage * sweepControl) /
        Math.max(0.05, cycleSeconds)
    : 0;
}

export function effectivePower(def: WeaponDef): number {
  if (def.beam) {
    // Players may deliberately early-vent or accept the forced lock. Curate against the stronger honest
    // repeatable cycle so a beam cannot enter the pool on its misleading legacy shell values.
    return Math.max(
      beamCyclePower(def, BeamPowerCycle.EarlyVent),
      beamCyclePower(def, BeamPowerCycle.FullOverheat),
    );
  }
  const katana = katanaExpectedMechanic(def);
  let perUse = def.damage * katana.averageDamageMultiplier + katana.averageBurstDamage;
  if (def.thrown) perUse = def.thrown.damage * pierceTargets(def.thrown.pierce);
  if (def.quake) perUse += def.quake.damage;
  if (def.chainLightning) perUse += def.chainLightning.damage * def.chainLightning.jumps * 0.6;
  if (def.scatter) {
    perUse += def.scatter.count * def.scatter.damage * 0.7; // cone — not every pellet lands
    if (def.scatter.explode) perUse += def.scatter.explode.damage;
  }
  let cadence = Math.max(0.12, def.cooldown);
  if (def.thrown) {
    // Charge downtime: fold the refill into the cadence (3 throws then a 1.5s wait isn't a machine gun).
    cadence += def.thrown.refillSeconds / Math.max(1, def.thrown.charges);
  }
  if (def.gun) {
    const burstCount = def.gun.burst?.count ?? 1;
    perUse =
      def.gun.damage * (def.gun.pellets ?? 1) * burstCount * 0.85 * pierceTargets(def.gun.pierce);
    if (def.gun.explode) perUse += def.gun.explode.damage * burstCount;
    // A ricochet carom re-arms the pierce set per leg — each bounce is most of a fresh bullet.
    perUse *= 1 + 0.5 * (def.gun.bounces ?? 0);
    cadence = Math.max(0.05, def.gun.fireRate);
    // Magazine downtime: fold the reload into the cadence (a 6-shot 1.4s-reload revolver isn't a beam).
    const mag = Math.max(1, def.gun.magazine);
    cadence += def.gun.reloadSeconds / mag;
  }
  const reach = def.gun?.range ?? def.thrown?.range ?? def.range * katana.maxReachMultiplier;
  const reachCredit = 1 + Math.min(0.4, reach / 2500);
  return (perUse / cadence) * reachCredit;
}

/** Median of a number list (empty → 0). Local helper. */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

/** The ACTIVE (non-expansion, non-fists) arsenal's power medians, per weapon class — the M3 yardstick.
 *  MEDIAN-anchored (not min/max) so the base arsenal's own outliers can't stretch the gate open. A class
 *  with no base representatives (caster) falls back to the all-base median. Computed once. */
const baseByClass = new Map<string, number[]>();
const allBase: number[] = [];
for (const w of Object.values(WEAPONS)) {
  if (w.expansion || w.archived || w.id === "fists") continue;
  const p = effectivePower(w);
  allBase.push(p);
  const cls = w.tags.classPool;
  baseByClass.set(cls, [...(baseByClass.get(cls) ?? []), p]);
}
export const BASE_POWER_MEDIAN = median(allBase);
/** Eligibility window around the class median — a drop is neither a best-in-slot printer (>2.2×) nor a
 *  dead stick (<0.6×). Coarse on purpose: it catches order-of-magnitude outliers, not fine balance. */
export const DROP_BAND_LOW = 0.6;
export const DROP_BAND_HIGH = 2.2;

/** The M3 yardstick for one class: the base arsenal's median power for that class. A class with NO base
 *  representatives (caster) anchors to its OWN full population's median instead — the melee-dominated
 *  all-base fallback sat 8% under the caster median and cut every caster above 1.1× its own middle while
 *  admitting hypothetical weaklings at 0.4× of it (adversarial-verify). Self-anchoring admits the healthy
 *  middle and trims both tails, which is exactly what an outlier gate is for. */
export function classPowerMedian(classPool: string): number {
  const base = median(baseByClass.get(classPool) ?? []);
  if (base > 0) return base;
  const own = median(
    Object.values(WEAPONS)
      .filter((w) => w.tags.classPool === classPool && w.id !== "fists" && !w.archived)
      .map(effectivePower),
  );
  return own > 0 ? own : BASE_POWER_MEDIAN;
}

/** M3 gate: may this weapon enter the in-run drop pool? ACTIVE arsenal weapons always may (they're the
 *  shipped baseline); an EXPANSION weapon must sit inside the class-median band. Rez/support weapons are
 *  deliberate picks, not RNG. PURE. */
export function isDropEligible(def: WeaponDef): boolean {
  if (def.archived) return false;
  if (def.rez) return false; // support/rez weapons (Gravedigger's Spade) are deliberate picks, not RNG
  if (!def.expansion) return true;
  const anchor = classPowerMedian(def.tags.classPool);
  const p = effectivePower(def);
  return p >= anchor * DROP_BAND_LOW && p <= anchor * DROP_BAND_HIGH;
}

/**
 * H7 — the IN-RUN DROP POOL: the active arsenal + every expansion weapon whose effective power sits
 * inside its class's M3 band. This is the "curated in waves" mechanism made automatic: the power budget
 * IS the curation — an expansion weapon joins the pool by being tuned into the band, never by fiat.
 * Computed once at load; identical on server + client (same WEAPONS data).
 */
export const DROP_POOL: readonly string[] = Object.values(WEAPONS)
  .filter((w) => w.id !== "fists" && isDropEligible(w))
  .map((w) => w.id);

/** Pick a drop identity from the pool (uniform [0,1) roll). PURE. */
export function rollDropWeapon(roll: number): string {
  return (
    DROP_POOL[Math.floor(Math.min(0.999999, Math.max(0, roll)) * DROP_POOL.length)] ??
    "rusty-cleaver"
  );
}
