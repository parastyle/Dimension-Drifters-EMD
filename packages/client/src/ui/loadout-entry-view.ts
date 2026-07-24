import type { PlayerState } from "@dd/shared";

/** The dock-facing projection of the authoritative active loadout entry. */
export type LoadoutEntryView = {
  leadId: string;
  leadSlot: number;
  rarity: number;
  affix: string;
  earned: boolean;
  charges: number;
  maxCharges: number;
};

type LoadoutPlayer = Pick<
  PlayerState,
  | "activeSlot"
  | "charges"
  | "maxCharges"
  | "slots"
  | "weapon"
  | "weaponAffix"
  | "weaponRarity"
>;

/**
 * One pure authority boundary for dock, detail-card, and arsenal presentation. The active slot contributes
 * exactly one weapon; any authored second sprite is resolved later from that weapon's definition.
 */
export function loadoutEntryView(self: LoadoutPlayer): LoadoutEntryView {
  const leadSlot = self.activeSlot;
  const storedLead = self.slots[leadSlot];
  return {
    leadId: self.weapon,
    leadSlot,
    rarity: self.weaponRarity,
    affix: self.weaponAffix,
    earned: storedLead?.earned ?? false,
    charges: self.charges,
    maxCharges: self.maxCharges,
  };
}
