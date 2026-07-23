import type { WeaponSecondaryGripRole } from "@dd/shared";

/** Mechanism/handle grips must leave the supporting hand visibly above the painted weapon layer. */
export function secondaryGripHandRendersAbove(role: WeaponSecondaryGripRole | undefined): boolean {
  return (
    role === "bolt" ||
    role === "pump" ||
    role === "lever" ||
    role === "crank" ||
    role === "vertical-foregrip" ||
    role === "handle"
  );
}
