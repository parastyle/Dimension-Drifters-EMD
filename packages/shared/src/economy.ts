import { TICK_RATE } from "./constants.js";
import { WEAPONS, type WeaponDef, type WeaponTier } from "./weapons.js";

export const DISASSEMBLY_HOLD_SECONDS = 0.4 as const;
export const DISASSEMBLY_HOLD_TICKS = Math.ceil(DISASSEMBLY_HOLD_SECONDS * TICK_RATE);
export const DISASSEMBLY_VALUE_MIN = 4 as const;
export const DISASSEMBLY_VALUE_MAX = 60 as const;
export const DISASSEMBLY_VALUE_BY_TIER = {
  1: 4,
  2: 8,
  3: 16,
  4: 32,
  5: 60,
} as const satisfies Readonly<Record<WeaponTier, number>>;

/** B20's authored tier is the single value source for floor and bag disassembly. */
export function weaponDisassemblyValue(weapon: Readonly<WeaponDef> | string): number {
  const definition = typeof weapon === "string" ? WEAPONS[weapon] : weapon;
  if (!definition) return 0;
  return DISASSEMBLY_VALUE_BY_TIER[definition.tier];
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
