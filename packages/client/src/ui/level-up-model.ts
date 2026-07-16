import {
  type Attr,
  AUG_CAST_DMG_PER,
  AUG_CAST_SPLIT_MAX,
  AUG_CAST_SPLIT_PER,
  AUG_GUN_BOUNCE_PER,
  AUG_GUN_PIERCE_PER,
  AUG_PROJECTILE_DAMAGE,
  AUGMENTS,
  BRAND_DAMAGE_MULT,
  BRAND_DURATION,
  BULWARK_SHIELD,
  CONFLAG_DELAY,
  classCount,
  classForCharacter,
  countAugment,
  critChanceFor,
  type DamageSource,
  deriveStats,
  EMBERGUARD_BASE_DMG,
  EMBERGUARD_PER_INT,
  effectiveDamageMult,
  HAIRTRIGGER_MAX,
  HARVEST_CAP,
  HARVEST_PER_LUK,
  hasAugment,
  IRON_STANCE_IFRAME_PER,
  IRON_STANCE_KNOCKBACK_PER,
  LUK_RARITY_PER,
  lootDamageMult,
  PARRY_IFRAMES,
  type PlayerState,
  SECOND_WIND_BASE,
  SECOND_WIND_PER_CON,
  WEAPONS,
  type WeaponDef,
  weaponDamageSources,
  weaponSetBonus,
} from "@dd/shared";

export interface LevelChoiceView {
  id: string;
  name: string;
  category: string;
  icon: string;
  accent: number;
  outcome: string;
  context: string;
  particlePack: string;
}

export interface LevelBuildContext {
  autoAttribute: Attr;
  automaticGrowth: string;
  delivery: "PARRY" | "GUN" | "CAST";
  rail: string;
  compactRail: string;
}

const ATTR_ACCENT: Record<Attr, number> = {
  str: 0xff8a2b,
  dex: 0x6fd6ff,
  int: 0xb07bd6,
  con: 0x9cff3b,
  luk: 0xffd479,
};

const ATTR_PARTICLE: Record<Attr, string> = {
  str: "fire-spark",
  dex: "frost-spark",
  int: "arcane-mote",
  con: "nature-mote",
  luk: "holy-spark",
};

const TAG_ACCENT: Record<string, number> = {
  riposte: 0xff8a2b,
  aegis: 0x9cff3b,
  hex: 0xb07bd6,
};

function attrsOf(self: PlayerState): Record<Attr, number> {
  return {
    str: self.str,
    dex: self.dex,
    int: self.int,
    con: self.con,
    luk: self.luk,
  };
}

function loadoutIds(self: PlayerState): string[] {
  const ids: string[] = [];
  for (let i = 0; i < self.slots.length; i++) {
    ids.push(i === self.activeSlot ? self.weapon : (self.slots[i]?.weapon ?? ""));
  }
  return ids;
}

function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function sourcesForPreview(weapon: WeaponDef): DamageSource[] {
  if (weapon.cast) {
    return [
      {
        label: "bolt",
        base: weapon.cast.damage,
        grades: weapon.cast.scalingGrades ?? weapon.scalingGrades,
        count: 1,
      },
    ];
  }
  return weaponDamageSources(weapon);
}

function heldSourceDamage(
  self: PlayerState,
  weapon: WeaponDef,
  source: DamageSource,
  attrs: Record<Attr, number>,
  overchargeStacks = countAugment(self.augments, "overcharge"),
): number {
  const loadout = loadoutIds(self);
  const castMultiplier = weapon.cast ? 1 + AUG_CAST_DMG_PER * overchargeStacks : 1;
  return (
    source.base *
    effectiveDamageMult(weapon, source.grades, attrs) *
    lootDamageMult(self.weaponRarity, self.weaponAffix) *
    weaponSetBonus(loadout, self.weapon) *
    castMultiplier
  );
}

function requirementContext(
  weapon: WeaponDef,
  before: Record<Attr, number>,
  after: Record<Attr, number>,
): string | undefined {
  const beforePenalty = effectiveDamageMult(weapon, {}, before);
  const afterPenalty = effectiveDamageMult(weapon, {}, after);
  if (beforePenalty < 1 && afterPenalty >= 1) return "REQUIREMENT MET • FULL POWER";
  if (afterPenalty > beforePenalty) {
    return `REQ POWER ${pct(beforePenalty)} → ${pct(afterPenalty)}`;
  }
  return undefined;
}

function bestDamageDelta(
  self: PlayerState,
  before: Record<Attr, number>,
  after: Record<Attr, number>,
): { label: string; before: number; after: number; count: number } | undefined {
  const weapon = WEAPONS[self.weapon];
  if (!weapon) return undefined;
  let best: { label: string; before: number; after: number; count: number } | undefined;
  for (const source of sourcesForPreview(weapon)) {
    const oldDamage = heldSourceDamage(self, weapon, source, before);
    const newDamage = heldSourceDamage(self, weapon, source, after);
    if (newDamage <= oldDamage + 0.001) continue;
    if (!best || newDamage - oldDamage > best.after - best.before) {
      best = {
        label: source.label.toUpperCase(),
        before: oldDamage,
        after: newDamage,
        count: source.count,
      };
    }
  }
  return best;
}

function damageOutcome(delta: NonNullable<ReturnType<typeof bestDamageDelta>>): string {
  const count = delta.count > 1 ? `${delta.count}× ` : "";
  return `${count}${delta.label} ${fmt(delta.before)} → ${fmt(delta.after)} (+${fmt(delta.after - delta.before)})`;
}

export function attributeChoiceViews(self: PlayerState, squadBestLuk: number): LevelChoiceView[] {
  const attrs: Attr[] = ["str", "dex", "int", "con", "luk"];
  return attrs.map((attr) => {
    const before = attrsOf(self);
    const after = { ...before, [attr]: before[attr] + 1 };
    const weapon = WEAPONS[self.weapon];
    const damage = bestDamageDelta(self, before, after);
    const req = weapon ? requirementContext(weapon, before, after) : undefined;
    let outcome: string;
    let context: string;

    if (attr === "con") {
      const oldStats = deriveStats(before);
      const newStats = deriveStats(after);
      outcome = `HP ${fmt(self.maxHp)} → ${fmt(newStats.maxHp)} (${newStats.maxHp >= self.maxHp ? "+" : ""}${fmt(newStats.maxHp - self.maxHp)})`;
      context =
        req ??
        `REGEN ${fmt(oldStats.regen)}/s → ${fmt(newStats.regen)}/s (+${fmt(newStats.regen - oldStats.regen)})`;
    } else if (damage) {
      outcome = damageOutcome(damage);
      if (attr === "dex" || attr === "luk") {
        const oldCrit = critChanceFor(before.luk, before.dex);
        const newCrit = critChanceFor(after.luk, after.dex);
        context =
          req ??
          `CRIT ${pct(oldCrit)} → ${pct(newCrit)} (+${((newCrit - oldCrit) * 100).toFixed(1)}pp)`;
      } else {
        context = req ?? `${attr.toUpperCase()} ${before[attr]} → ${after[attr]} • HELD SCALING`;
      }
    } else if (attr === "dex" || attr === "luk") {
      const oldCrit = critChanceFor(before.luk, before.dex);
      const newCrit = critChanceFor(after.luk, after.dex);
      outcome = `CRIT ${pct(oldCrit)} → ${pct(newCrit)} (+${((newCrit - oldCrit) * 100).toFixed(1)}pp)`;
      if (attr === "luk") {
        const oldHarvest = Math.min(HARVEST_CAP, HARVEST_PER_LUK * (squadBestLuk - 1));
        const nextBest = Math.max(squadBestLuk, after.luk);
        const newHarvest = Math.min(HARVEST_CAP, HARVEST_PER_LUK * (nextBest - 1));
        context =
          newHarvest > oldHarvest
            ? `SQUAD HARVEST ${pct(oldHarvest)} → ${pct(newHarvest)}`
            : `HIGH-TIER WEIGHT BASE +${Math.round(LUK_RARITY_PER * 100)}%`;
      } else {
        context = req ?? "NO HELD DAMAGE • CRIT ONLY";
      }
    } else if (attr === "int" && hasAugment(self.augments, "emberguard")) {
      const oldFire = EMBERGUARD_BASE_DMG + EMBERGUARD_PER_INT * Math.max(0, before.int - 1);
      const newFire = EMBERGUARD_BASE_DMG + EMBERGUARD_PER_INT * Math.max(0, after.int - 1);
      outcome = `FIRE WAVE ${oldFire} → ${newFire} (+${newFire - oldFire})`;
      context = req ?? "EMBERGUARD OWNED • SIGNATURE SCALING";
    } else {
      outcome = `${attr.toUpperCase()} ${before[attr]} → ${after[attr]} (+1)`;
      context = req ?? "NO HELD-WEAPON SCALING";
    }

    return {
      id: attr,
      name: attr.toUpperCase(),
      category: "ATTRIBUTE",
      icon: attr,
      accent: ATTR_ACCENT[attr],
      outcome,
      context,
      particlePack: ATTR_PARTICLE[attr],
    };
  });
}

function augmentOutcome(self: PlayerState, id: string): { outcome: string; context?: string } {
  const owned = countAugment(self.augments, id);
  const weapon = WEAPONS[self.weapon];
  switch (id) {
    case "counterblade":
      return {
        outcome: owned
          ? "BLADE PROJECTILE • NO NEW EFFECT"
          : `NEW • ${AUG_PROJECTILE_DAMAGE}-DMG BLADE`,
      };
    case "twin-fang": {
      const before = countAugment(self.augments, "counterblade") + owned;
      return { outcome: `BASE BLADES ${before} → ${before + 1} (+1)` };
    }
    case "hair-trigger":
      return {
        outcome: owned
          ? "PARRY STREAK • NO NEW EFFECT"
          : `NEW • STREAK BLADE (CAP ${HAIRTRIGGER_MAX})`,
      };
    case "deflector":
      return { outcome: owned ? "BULLET RETURN • NO NEW EFFECT" : "NEW • BULLETS GLANCE → RETURN" };
    case "iron-stance": {
      const ironBefore = PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * owned);
      const ironAfter = PARRY_IFRAMES * (1 + IRON_STANCE_IFRAME_PER * (owned + 1));
      const hasBulwark = hasAugment(self.augments, "bulwark");
      const before = hasBulwark ? Math.max(BULWARK_SHIELD, ironBefore) : ironBefore;
      const after = hasBulwark ? Math.max(BULWARK_SHIELD, ironAfter) : ironAfter;
      return {
        outcome:
          after > before
            ? `I-FRAMES ${fmt(before)}s → ${fmt(after)}s`
            : `I-FRAMES ${fmt(before)}s • BULWARK LONGER`,
        context: `KNOCKBACK +${Math.round(IRON_STANCE_KNOCKBACK_PER * 100)}% THIS STACK`,
      };
    }
    case "second-wind": {
      const perStack = SECOND_WIND_BASE + SECOND_WIND_PER_CON * Math.max(0, self.con - 1);
      return { outcome: `HEAL ${owned * perStack} → ${(owned + 1) * perStack} HP/PARRY` };
    }
    case "bulwark":
      return {
        outcome: owned ? "ABSORB WINDOW • NO NEW EFFECT" : `NEW • ABSORB ${fmt(BULWARK_SHIELD)}s`,
      };
    case "emberguard": {
      const damage = EMBERGUARD_BASE_DMG + EMBERGUARD_PER_INT * Math.max(0, self.int - 1);
      return { outcome: owned ? "FIRE WAVE • NO NEW EFFECT" : `NEW • FIRE WAVE ${damage} DMG` };
    }
    case "brand":
      return {
        outcome: owned
          ? "DAMAGE MARK • NO NEW EFFECT"
          : `NEW • ×${BRAND_DAMAGE_MULT.toFixed(1)} DMG / ${BRAND_DURATION}s`,
      };
    case "conflagration":
      if (owned) return { outcome: "SECOND FIRE WAVE • NO NEW EFFECT" };
      if (!hasAugment(self.augments, "emberguard")) {
        return { outcome: "INACTIVE UNTIL EMBERGUARD", context: "REQUIRES EMBERGUARD" };
      }
      return {
        outcome: `FIRE WAVES 1 → 2 (+1)`,
        context: `EMBERGUARD ✓ • DELAY ${fmt(CONFLAG_DELAY)}s`,
      };
    case "hollowpoints": {
      const before = (weapon?.gun?.pierce ?? 1) + AUG_GUN_PIERCE_PER * owned;
      return { outcome: `PIERCE ${before} → ${before + AUG_GUN_PIERCE_PER} (+1)` };
    }
    case "ricochet-rounds": {
      const before = (weapon?.gun?.bounces ?? 0) + AUG_GUN_BOUNCE_PER * owned;
      return { outcome: `BOUNCES ${before} → ${before + AUG_GUN_BOUNCE_PER} (+1)` };
    }
    case "overcharge": {
      if (!weapon?.cast) return { outcome: "NO CAST WEAPON EFFECT" };
      const source = sourcesForPreview(weapon)[0];
      if (!source) return { outcome: "CAST DAMAGE +25%" };
      const attrs = attrsOf(self);
      const before = heldSourceDamage(self, weapon, source, attrs, owned);
      const after = heldSourceDamage(self, weapon, source, attrs, owned + 1);
      return { outcome: `BOLT ${fmt(before)} → ${fmt(after)} (+${fmt(after - before)})` };
    }
    case "arc-split": {
      const before = Math.min(AUG_CAST_SPLIT_MAX, AUG_CAST_SPLIT_PER * owned);
      const after = Math.min(AUG_CAST_SPLIT_MAX, AUG_CAST_SPLIT_PER * (owned + 1));
      return after > before
        ? { outcome: `FORKS ${before} → ${after} (+${after - before})` }
        : { outcome: `FORKS ${before} • CAPPED`, context: "NO FURTHER EFFECT" };
    }
    default:
      return { outcome: AUGMENTS[id]?.desc.toUpperCase() ?? id.toUpperCase() };
  }
}

export function augmentChoiceViews(self: PlayerState): LevelChoiceView[] {
  return self.sigOffer
    .split(",")
    .filter(Boolean)
    .flatMap((id) => {
      const def = AUGMENTS[id];
      if (!def) return [];
      const owned = countAugment(self.augments, id);
      const exact = augmentOutcome(self, id);
      const defaultContext = def.stacks
        ? `OWNED ×${owned} → ×${owned + 1}`
        : owned > 0
          ? "OWNED • NO NEW EFFECT"
          : "NEW";
      return [
        {
          id,
          name: def.name,
          category: (def.weapon ?? def.tag).toUpperCase(),
          icon: def.icon,
          accent: TAG_ACCENT[def.tag] ?? 0xb9975b,
          outcome: exact.outcome,
          context: exact.context ?? defaultContext,
          particlePack:
            id === "emberguard" || id === "conflagration"
              ? "fire-spark"
              : def.tag === "hex"
                ? "arcane-mote"
                : def.tag === "aegis"
                  ? "nature-mote"
                  : "steel-spark",
        },
      ];
    });
}

export function levelBuildContext(self: PlayerState): LevelBuildContext {
  const cls = classForCharacter(self.character);
  const weapon = WEAPONS[self.weapon];
  const loadout = loadoutIds(self);
  const classPool = weapon?.tags.classPool;
  const sameClass = classPool ? classCount(loadout, classPool) : 0;
  const setBonus = weapon ? weaponSetBonus(loadout, self.weapon) : 1;
  const grades = weapon?.cast?.scalingGrades ??
    weapon?.gun?.scalingGrades ??
    weapon?.scalingGrades ?? { str: "B" };
  const gradeText = Object.entries(grades)
    .map(([attr, grade]) => `${attr.toUpperCase()} ${grade}`)
    .join("/");
  const setText = classPool
    ? `${classPool.toUpperCase()} ${sameClass}/3${setBonus > 1 ? ` (+${Math.round((setBonus - 1) * 100)}%)` : ""}`
    : "NO SET";
  return {
    autoAttribute: cls.classAttr,
    automaticGrowth: `AUTO-GROWTH APPLIED: +1 ${cls.classAttr.toUpperCase()} • +1 ${cls.reqAttr.toUpperCase()}`,
    delivery: weapon?.cast ? "CAST" : weapon?.gun ? "GUN" : "PARRY",
    rail: `HELD: ${weapon?.name ?? self.weapon} • ${gradeText} • ${setText} • WORLD LIVE`,
    compactRail: `${weapon?.cast ? "CAST" : weapon?.gun ? "GUN" : "PARRY"} • ${weapon?.name ?? self.weapon} • WORLD LIVE`,
  };
}
