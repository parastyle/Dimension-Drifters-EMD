import { TICK_MS } from "./constants.js";
import type { WeaponDef } from "./weapons.js";
import { weaponHasHandlingTag } from "./weapons.js";

export const BREAK_ACTION_OPEN_START = 0.08;
export const BREAK_ACTION_OPEN_END = 0.28;
export const BREAK_ACTION_EJECT_END = 0.56;
export const BREAK_ACTION_CLOSE_END = 0.82;

export type BreakActionPhase = "closed" | "opening" | "eject" | "closing";

export interface BreakActionClockSample {
  active: boolean;
  angleRad: number;
  ejectStrength: number;
  elapsedTicks: number;
  muzzleAllowed: boolean;
  phase: BreakActionPhase;
  progress: number;
  totalTicks: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number): number {
  const q = clamp01(value);
  return q * q * (3 - 2 * q);
}

export function isBreakActionWeapon(weapon: WeaponDef | undefined): weapon is WeaponDef & {
  breakAction: NonNullable<WeaponDef["breakAction"]>;
  gun: NonNullable<WeaponDef["gun"]>;
} {
  return (
    !!weapon?.breakAction &&
    !!weapon.gun &&
    weapon.gun.magazine === 2 &&
    weaponHasHandlingTag(weapon, "break")
  );
}

/** Sample the replicated attack/reload clock. No render-wall timer enters the pose, so local and remote
 * clients resolve the same phase from the same authoritative tick pair and public two-shell resource row. */
export function sampleBreakActionClock(
  weapon: WeaponDef | undefined,
  acceptedTick: number,
  clockTick: number,
  charges: number,
  maxCharges: number,
): BreakActionClockSample {
  const totalTicks = isBreakActionWeapon(weapon)
    ? Math.max(1, Math.round((weapon.gun.reloadSeconds * 1_000) / TICK_MS))
    : 0;
  const elapsedTicks = (clockTick - acceptedTick) >>> 0;
  const active =
    isBreakActionWeapon(weapon) &&
    maxCharges === weapon.gun.magazine &&
    charges === 0 &&
    elapsedTicks < totalTicks;
  const progress = active ? clamp01(elapsedTicks / totalTicks) : 1;
  let phase: BreakActionPhase = "closed";
  let angleRad = 0;
  let ejectStrength = 0;

  if (active && progress >= BREAK_ACTION_OPEN_START && progress < BREAK_ACTION_OPEN_END) {
    phase = "opening";
    angleRad =
      weapon.breakAction.openAngleRad *
      smoothstep01(
        (progress - BREAK_ACTION_OPEN_START) / (BREAK_ACTION_OPEN_END - BREAK_ACTION_OPEN_START),
      );
  } else if (active && progress >= BREAK_ACTION_OPEN_END && progress < BREAK_ACTION_EJECT_END) {
    phase = "eject";
    angleRad = weapon.breakAction.openAngleRad;
    const ejectProgress =
      (progress - BREAK_ACTION_OPEN_END) / (BREAK_ACTION_EJECT_END - BREAK_ACTION_OPEN_END);
    ejectStrength = Math.sin(clamp01(ejectProgress) * Math.PI);
  } else if (active && progress >= BREAK_ACTION_EJECT_END && progress < BREAK_ACTION_CLOSE_END) {
    phase = "closing";
    angleRad =
      weapon.breakAction.openAngleRad *
      (1 -
        smoothstep01(
          (progress - BREAK_ACTION_EJECT_END) / (BREAK_ACTION_CLOSE_END - BREAK_ACTION_EJECT_END),
        ));
  }

  return {
    active,
    angleRad,
    ejectStrength,
    elapsedTicks,
    muzzleAllowed: angleRad <= 1e-6,
    phase,
    progress,
    totalTicks,
  };
}

/** Two accepted shells share one fire interval plus one break-reload interval between cycle openers. */
export function breakActionNominalDps(weapon: WeaponDef | undefined): number {
  if (!isBreakActionWeapon(weapon)) return 0;
  const triggerDamage = weapon.gun.damage * Math.max(1, weapon.gun.pellets ?? 1);
  return (triggerDamage * 2) / (weapon.gun.fireRate + weapon.gun.reloadSeconds);
}
