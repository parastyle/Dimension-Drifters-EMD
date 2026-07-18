import { FISTS_WEAPON, type PlayerState } from "@dd/shared";

/** The dock-facing projection of the authoritative active loadout entry. */
export type LoadoutEntryView = {
  leadId: string;
  leadSlot: number;
  rarity: number;
  affix: string;
  earned: boolean;
  charges: number;
  maxCharges: number;
  offId?: string;
  offSlot?: number;
  offRarity?: number;
  offAffix?: string;
  offEarned?: boolean;
  offCharges?: number;
  offMaxCharges?: number;
  nextHand: 0 | 1;
  pairKey: string;
};

type LoadoutPlayer = Pick<
  PlayerState,
  | "activeSlot"
  | "attackSeq"
  | "charges"
  | "dualWield"
  | "maxCharges"
  | "pairBaseSeq"
  | "slots"
  | "weapon"
  | "weaponAffix"
  | "weaponRarity"
>;

/**
 * One pure authority boundary for dock, detail-card, and arsenal presentation.
 * Off-hand identity intentionally comes from `slots[dualWield.offhandSlot]`; the nested dual-wield row
 * only carries the link and its live resource mirror.
 */
export function loadoutEntryView(self: LoadoutPlayer): LoadoutEntryView {
  const leadSlot = self.activeSlot;
  const storedLead = self.slots[leadSlot];
  const leadId = self.weapon;
  const offSlot = self.dualWield?.offhandSlot ?? 255;
  const storedOff = offSlot >= 0 && offSlot < self.slots.length ? self.slots[offSlot] : undefined;
  const paired =
    leadId !== FISTS_WEAPON &&
    offSlot !== 255 &&
    offSlot !== leadSlot &&
    !!storedOff?.weapon &&
    storedOff.weapon !== leadId;
  // Reflection law: decoded rows carry only wire fields — pairBaseSeq lives on the nested row.
  const delta = (self.attackSeq - (self.dualWield?.pairBaseSeq ?? 0)) >>> 0;

  return {
    leadId,
    leadSlot,
    rarity: self.weaponRarity,
    affix: self.weaponAffix,
    earned: storedLead?.earned ?? false,
    charges: self.charges,
    maxCharges: self.maxCharges,
    ...(paired
      ? {
          offId: storedOff.weapon,
          offSlot,
          offRarity: storedOff.rarity,
          offAffix: storedOff.affix,
          offEarned: storedOff.earned,
          offCharges: self.dualWield.offCharges,
          offMaxCharges: self.dualWield.offMaxCharges,
        }
      : {}),
    nextHand: paired ? ((delta & 1) as 0 | 1) : 0,
    pairKey: paired ? `${leadId}|${storedOff.weapon}` : leadId,
  };
}
