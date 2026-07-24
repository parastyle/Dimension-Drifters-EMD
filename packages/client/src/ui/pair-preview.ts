import {
  dualOffhandDamageMultiplier,
  lootCooldownMult,
  lootDamageMult,
  PAIR_TEMPO,
  pairDamagePerUse,
  pairEligible,
  WEAPONS,
  weaponAttackCooldown,
  weaponDamageSources,
  weaponSetBonus,
} from "@dd/shared";

export type PairPreviewItem = {
  weaponId: string;
  rarity: number;
  affix: string;
  earned: boolean;
};

export type PairPreview = {
  eligible: boolean;
  fee: number;
  leadDamage: number;
  offDamage: number;
  combinedDamage: number;
  combinedDps: number;
  leadGapSeconds: number;
  offGapSeconds: number;
  averageGapSeconds: number;
  cycleSeconds: number;
  offhandMultiplier: number;
  matchedFamily: boolean;
  separateMagazines: boolean;
};

export type PairPreviewInput = {
  lead: PairPreviewItem;
  off: PairPreviewItem;
  loadoutIds: readonly string[];
};

const EMPTY_PREVIEW: Omit<PairPreview, "fee"> = {
  eligible: false,
  leadDamage: 0,
  offDamage: 0,
  combinedDamage: 0,
  combinedDps: 0,
  leadGapSeconds: 0,
  offGapSeconds: 0,
  averageGapSeconds: 0,
  cycleSeconds: 0,
  offhandMultiplier: 0,
  matchedFamily: false,
  separateMagazines: false,
};

/** Deterministic, no-roll preview of the exact identities and shared pair tuning the server consumes. */
export function pairPreview(input: PairPreviewInput): PairPreview {
  const lead = WEAPONS[input.lead.weaponId];
  const off = WEAPONS[input.off.weaponId];
  const fee = 0;
  if (!lead || !off || !pairEligible(lead, off)) return { ...EMPTY_PREVIEW, fee };

  const leadRaw =
    pairDamagePerUse(lead) * lootDamageMult(input.lead.rarity, input.lead.affix);
  const offRaw =
    pairDamagePerUse(off) * lootDamageMult(input.off.rarity, input.off.affix);
  const offhandMultiplier = dualOffhandDamageMultiplier(lead, off, leadRaw, offRaw);
  const sourceTotal = (weapon: typeof lead, item: PairPreviewItem) =>
    weaponDamageSources(weapon).reduce(
      (total, source) =>
        total + source.base * source.count * lootDamageMult(item.rarity, item.affix),
      0,
    );
  const leadDamage =
    sourceTotal(lead, input.lead) * weaponSetBonus(input.loadoutIds, input.lead.weaponId);
  const offDamage =
    sourceTotal(off, input.off) *
    weaponSetBonus(input.loadoutIds, input.off.weaponId) *
    offhandMultiplier;
  // The lead affix owns cadence for both hands. Each gap is based on the incoming hand's authored
  // cooldown, matching `resolveHandAttack`; no off-hand speed affix is compounded into the result.
  const cadenceMult = lootCooldownMult(input.lead.affix);
  const leadGapSeconds = PAIR_TEMPO * weaponAttackCooldown(lead) * cadenceMult;
  const offGapSeconds = PAIR_TEMPO * weaponAttackCooldown(off) * cadenceMult;
  const cycleSeconds = leadGapSeconds + offGapSeconds;
  const combinedDamage = leadDamage + offDamage;

  return {
    eligible: true,
    fee,
    leadDamage,
    offDamage,
    combinedDamage,
    combinedDps: cycleSeconds > 0 ? combinedDamage / cycleSeconds : 0,
    leadGapSeconds,
    offGapSeconds,
    averageGapSeconds: cycleSeconds / 2,
    cycleSeconds,
    offhandMultiplier,
    matchedFamily: lead.tags.family === off.tags.family,
    separateMagazines: !!lead.gun && !!off.gun,
  };
}
