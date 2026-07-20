import { type WeaponDef, weaponAttackCooldown } from "@dd/shared";

/** Held-fire scheduling shares the delivery-specific cooldown used by server acceptance. */
export function localAttackCooldownSeconds(
  weapon: WeaponDef | undefined,
  cooldownMultiplier: number,
): number {
  return (weapon ? weaponAttackCooldown(weapon) : 0.3) * cooldownMultiplier;
}
