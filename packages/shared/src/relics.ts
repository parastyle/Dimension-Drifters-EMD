import {
  DRIVE_CAPACITY,
  MOVE_SPEED,
  PARRY_RADIUS,
  REVIVE_HP_FRAC,
  ROLL_COOLDOWN,
} from "./constants.js";
import { rollSpeedAtTick } from "./movement.js";

export const RELIC_COMMON_STACK_CAP = 20 as const;

export const COMMON_RELIC_IDS = [
  "energy-pool",
  "energy-regen",
  "parry-reach",
  "dodge-recovery",
  "move-speed",
  "hp-regen",
  "luck",
  "crit",
  "jump-count",
] as const;
export type CommonRelicId = (typeof COMMON_RELIC_IDS)[number];

export const RARE_RELIC_IDS = [
  "dodge-shuffle",
  "dodge-ninja-flip",
  "dodge-phase-step",
  "dodge-bloodhound-step",
  "revive",
  "one-shot-protection",
] as const;
export type RareRelicId = (typeof RARE_RELIC_IDS)[number];
export type DodgeRelicId = Extract<RareRelicId, `dodge-${string}`>;

export interface RelicStacks {
  energyPool: number;
  energyRegen: number;
  parryReach: number;
  dodgeRecovery: number;
  moveSpeed: number;
  hpRegen: number;
  luck: number;
  crit: number;
  jumpCount: number;
  activeDodge?: string;
}

export const EMPTY_RELIC_STACKS: Readonly<RelicStacks> = Object.freeze({
  energyPool: 0,
  energyRegen: 0,
  parryReach: 0,
  dodgeRecovery: 0,
  moveSpeed: 0,
  hpRegen: 0,
  luck: 0,
  crit: 0,
  jumpCount: 0,
  activeDodge: "",
});

export interface CommonRelicDef {
  id: CommonRelicId;
  label: string;
  hud: string;
  value: number;
}

export const COMMON_RELIC_DEFS: readonly CommonRelicDef[] = [
  { id: "energy-pool", label: "Capacitor", hud: "EN", value: 10 },
  { id: "energy-regen", label: "Kinetic Coil", hud: "RG", value: 0.8 },
  { id: "parry-reach", label: "Wide Guard", hud: "PR", value: 8 },
  { id: "dodge-recovery", label: "Light Soles", hud: "DG", value: 0.06 },
  { id: "move-speed", label: "Roadrunner Spur", hud: "MV", value: 0.03 },
  { id: "hp-regen", label: "Mending Thread", hud: "HP", value: 0.25 },
  { id: "luck", label: "Lucky Tooth", hud: "LK", value: 0.05 },
  { id: "crit", label: "Keen Edge", hud: "CR", value: 0.02 },
  { id: "jump-count", label: "Skyhook", hud: "JP", value: 1 },
] as const;

export interface RareRelicDef {
  id: RareRelicId;
  label: string;
  hud: string;
}

export const RARE_RELIC_DEFS: readonly RareRelicDef[] = [
  { id: "dodge-shuffle", label: "The Shuffle", hud: "SH" },
  { id: "dodge-ninja-flip", label: "Ninja Flip", hud: "NF" },
  { id: "dodge-phase-step", label: "Phase Step", hud: "PH" },
  { id: "dodge-bloodhound-step", label: "Bloodhound Step", hud: "BH" },
  { id: "revive", label: "Second Wind", hud: "RV" },
  { id: "one-shot-protection", label: "Death Ward", hud: "DW" },
] as const;

export const RELIC_ENERGY_POOL_PER_STACK = 10 as const;
export const RELIC_ENERGY_REGEN_PER_STACK = 0.8 as const;
export const RELIC_PARRY_REACH_PER_STACK = 8 as const;
export const RELIC_DODGE_RECOVERY_PER_STACK = 0.06 as const;
export const RELIC_MOVE_SPEED_PER_STACK = 0.03 as const;
export const RELIC_HP_REGEN_PER_STACK = 0.25 as const;
export const RELIC_LUCK_PER_STACK = 0.05 as const;
export const RELIC_CRIT_PER_STACK = 0.02 as const;
export const DEATH_WARD_HP_THRESHOLD = 0.35 as const;
export const DEATH_WARD_COOLDOWN_SECONDS = 90 as const;

function boundedStacks(value: number): number {
  return Math.max(0, Math.min(RELIC_COMMON_STACK_CAP, Math.floor(Number(value) || 0)));
}

export function commonRelicStacks(relics: Readonly<RelicStacks>, id: CommonRelicId): number {
  switch (id) {
    case "energy-pool":
      return boundedStacks(relics.energyPool);
    case "energy-regen":
      return boundedStacks(relics.energyRegen);
    case "parry-reach":
      return boundedStacks(relics.parryReach);
    case "dodge-recovery":
      return boundedStacks(relics.dodgeRecovery);
    case "move-speed":
      return boundedStacks(relics.moveSpeed);
    case "hp-regen":
      return boundedStacks(relics.hpRegen);
    case "luck":
      return boundedStacks(relics.luck);
    case "crit":
      return boundedStacks(relics.crit);
    case "jump-count":
      return boundedStacks(relics.jumpCount);
  }
}

export function relicEnergyCapacity(relics: Readonly<RelicStacks>): number {
  return DRIVE_CAPACITY + boundedStacks(relics.energyPool) * RELIC_ENERGY_POOL_PER_STACK;
}

export function relicEnergyRegenAdd(relics: Readonly<RelicStacks>): number {
  return boundedStacks(relics.energyRegen) * RELIC_ENERGY_REGEN_PER_STACK;
}

export function relicParryRadius(relics: Readonly<RelicStacks>): number {
  return PARRY_RADIUS + boundedStacks(relics.parryReach) * RELIC_PARRY_REACH_PER_STACK;
}

export function relicMoveSpeed(relics: Readonly<RelicStacks>): number {
  return MOVE_SPEED * (1 + boundedStacks(relics.moveSpeed) * RELIC_MOVE_SPEED_PER_STACK);
}

export function relicHpRegenAdd(relics: Readonly<RelicStacks>): number {
  return boundedStacks(relics.hpRegen) * RELIC_HP_REGEN_PER_STACK;
}

export function relicLuckMultiplier(relics: Readonly<RelicStacks>): number {
  return 1 + boundedStacks(relics.luck) * RELIC_LUCK_PER_STACK;
}

export function relicCritAdd(relics: Readonly<RelicStacks>): number {
  return boundedStacks(relics.crit) * RELIC_CRIT_PER_STACK;
}

export function relicJumpCount(relics: Readonly<RelicStacks>): number {
  return boundedStacks(relics.jumpCount);
}

export interface DodgeProfile {
  id: "" | DodgeRelicId;
  label: string;
  distanceMultiplier: number;
  cooldownSeconds: number;
  presentation: "roll" | "shuffle" | "flip" | "phase" | "bloodhound";
}

export const DODGE_PROFILES: Readonly<Record<"" | DodgeRelicId, DodgeProfile>> = {
  "": {
    id: "",
    label: "Combat Roll",
    distanceMultiplier: 1,
    cooldownSeconds: ROLL_COOLDOWN,
    presentation: "roll",
  },
  "dodge-shuffle": {
    id: "dodge-shuffle",
    label: "The Shuffle",
    distanceMultiplier: 0.78,
    cooldownSeconds: 2.1,
    presentation: "shuffle",
  },
  "dodge-ninja-flip": {
    id: "dodge-ninja-flip",
    label: "Ninja Flip",
    distanceMultiplier: 1.12,
    cooldownSeconds: 3.35,
    presentation: "flip",
  },
  "dodge-phase-step": {
    id: "dodge-phase-step",
    label: "Phase Step",
    distanceMultiplier: 1,
    cooldownSeconds: 2.8,
    presentation: "phase",
  },
  "dodge-bloodhound-step": {
    id: "dodge-bloodhound-step",
    label: "Bloodhound Step",
    distanceMultiplier: 1.35,
    cooldownSeconds: 3.8,
    presentation: "bloodhound",
  },
};

export function isDodgeRelicId(value: unknown): value is DodgeRelicId {
  return (
    value === "dodge-shuffle" ||
    value === "dodge-ninja-flip" ||
    value === "dodge-phase-step" ||
    value === "dodge-bloodhound-step"
  );
}

export function dodgeProfileFor(value: unknown): DodgeProfile {
  return DODGE_PROFILES[isDodgeRelicId(value) ? value : ""];
}

export function relicDodgeCooldown(relics: Readonly<RelicStacks>): number {
  return Math.max(
    0.65,
    dodgeProfileFor(relics.activeDodge).cooldownSeconds -
      boundedStacks(relics.dodgeRecovery) * RELIC_DODGE_RECOVERY_PER_STACK,
  );
}

export function relicRollSpeedAtTick(relics: Readonly<RelicStacks>, tick: number): number {
  return rollSpeedAtTick(tick) * dodgeProfileFor(relics.activeDodge).distanceMultiplier;
}

export function isRareRelicId(value: unknown): value is RareRelicId {
  return (RARE_RELIC_IDS as readonly unknown[]).includes(value);
}

export function hasRareRelic(ownedCsv: string, id: RareRelicId): boolean {
  return `,${ownedCsv},`.includes(`,${id},`);
}

export function appendRareRelic(ownedCsv: string, id: RareRelicId): string {
  if (hasRareRelic(ownedCsv, id)) return ownedCsv;
  return ownedCsv ? `${ownedCsv},${id}` : id;
}

export interface OneShotProtectionResult {
  hp: number;
  triggered: boolean;
}

export interface RelicReviveResult {
  revived: boolean;
  hp: number;
  available: boolean;
}

/** Pure once-per-run revive edge; positioning and nearby-enemy cleanup remain server-owned. */
export function resolveRelicRevive(
  maxHp: number,
  owned: boolean,
  available: boolean,
): RelicReviveResult {
  if (!owned || !available) return { revived: false, hp: 0, available };
  return {
    revived: true,
    hp: Math.max(1, Math.round(Math.max(1, maxHp) * REVIVE_HP_FRAC)),
    available: false,
  };
}

/** Pure lethal-hit edge. Cooldown ownership remains with the caller's authoritative tick clock. */
export function resolveOneShotProtection(
  hp: number,
  maxHp: number,
  incomingDamage: number,
  owned: boolean,
  ready: boolean,
): OneShotProtectionResult {
  const current = Math.max(0, hp);
  const maximum = Math.max(1, maxHp);
  const damage = Math.max(0, incomingDamage);
  const lethal = damage + 1e-9 >= current;
  const aboveThreshold = current / maximum + 1e-9 >= DEATH_WARD_HP_THRESHOLD;
  if (!owned || !ready || !lethal || !aboveThreshold) {
    return { hp: Math.max(0, current - damage), triggered: false };
  }
  return { hp: 1, triggered: true };
}
