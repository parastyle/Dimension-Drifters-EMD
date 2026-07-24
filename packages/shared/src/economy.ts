import { placeholderWeaponBudget } from "./chests.js";
import { TICK_RATE } from "./constants.js";
import { WEAPONS, type WeaponDef } from "./weapons.js";

export const DISASSEMBLY_HOLD_SECONDS = 0.4 as const;
export const DISASSEMBLY_HOLD_TICKS = Math.ceil(DISASSEMBLY_HOLD_SECONDS * TICK_RATE);
export const DISASSEMBLY_VALUE_MIN = 4 as const;
export const DISASSEMBLY_VALUE_MAX = 60 as const;
export const DISASSEMBLY_BUDGET_DIVISOR = 4 as const;

/**
 * B20 L3 placeholder economy curve. L5 may replace the underlying tier/budget
 * model, but floor and bag actions must continue to call this one shared seam.
 */
export function weaponDisassemblyValue(weapon: Readonly<WeaponDef> | string): number {
  const definition = typeof weapon === "string" ? WEAPONS[weapon] : weapon;
  if (!definition) return 0;
  return Math.max(
    DISASSEMBLY_VALUE_MIN,
    Math.min(
      DISASSEMBLY_VALUE_MAX,
      Math.round(placeholderWeaponBudget(definition) / DISASSEMBLY_BUDGET_DIVISOR),
    ),
  );
}

export interface WeaponDisassemblyReceipt {
  source: "floor" | "bag";
  pickupId: string;
  weaponId: string;
  value: number;
  x: number;
  y: number;
}

export interface MoneyBankReceipt {
  outcome: "defeat" | "victory";
  banked: number;
  previousBank: number;
  bankTotal: number;
}
