import { DRIVE_CAPACITY, type WeaponResourceProfile, weaponResourceProfile } from "@dd/shared";

export const DRIVE_COST_PIP_COUNT = 5;

export interface DriveHudInput {
  valueQ: number;
  regenMode: number;
  beamLockEndTick: number;
  tick: number;
  weaponId: string;
  beamRequireRelease?: boolean;
}

export interface DriveCostView {
  cost: number;
  pips: number;
  pipText: string;
  copy: string;
  branch: WeaponResourceProfile["branch"];
}

export interface DriveHudView {
  value: number;
  fraction: number;
  debitFraction: number;
  affordable: boolean;
  locked: boolean;
  low: boolean;
  chevrons: 0 | 1 | 2;
  overlay: string;
  cost: DriveCostView;
}

export function driveCostView(weaponId: string): DriveCostView {
  const profile = weaponResourceProfile(weaponId) ?? weaponResourceProfile("fists");
  if (!profile) throw new Error("Drive resource profile catalog is missing the fists fallback");
  const cost = profile.branch === "beam" ? profile.ignitionCost : profile.neutralCost;
  const pips = Math.max(
    1,
    Math.min(DRIVE_COST_PIP_COUNT, Math.ceil(cost / (DRIVE_CAPACITY / DRIVE_COST_PIP_COUNT))),
  );
  return {
    cost,
    pips,
    pipText: `${"◆".repeat(pips)}${"◇".repeat(DRIVE_COST_PIP_COUNT - pips)}`,
    copy:
      profile.branch === "beam"
        ? `${profile.ignitionCost} + ${profile.grossDrainPerSecond}/s`
        : Number.isInteger(cost)
          ? String(cost)
          : cost.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""),
    branch: profile.branch,
  };
}

export function driveHudView(input: DriveHudInput): DriveHudView {
  const value = Math.max(0, Math.min(DRIVE_CAPACITY, Math.floor(Number(input.valueQ) || 0) / 100));
  const cost = driveCostView(input.weaponId);
  const locked =
    cost.branch === "beam" &&
    (input.beamRequireRelease === true || input.beamLockEndTick > input.tick || value <= 0);
  const affordable = value + 1e-9 >= cost.cost && !locked;
  return {
    value,
    fraction: value / DRIVE_CAPACITY,
    debitFraction: Math.min(value, cost.cost) / DRIVE_CAPACITY,
    affordable,
    locked,
    low: value <= Math.max(25, cost.cost),
    chevrons: input.regenMode === 2 ? 2 : input.regenMode === 1 ? 1 : 0,
    overlay: locked ? "LOCKED · RELEASE" : affordable ? "" : "EMPTY · WAIT",
    cost,
  };
}
