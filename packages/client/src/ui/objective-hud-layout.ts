export type ObjectiveHudMode = "arena" | "belt" | "bossrush" | "training";

export interface ObjectiveHudCopyInput {
  mode: ObjectiveHudMode;
  dimensionName: string;
  depth: number;
  bossActive: boolean;
  portalOpen: boolean;
  bossEtaSeconds: number;
  carriedSalvage: number;
  bankedSalvage: number;
  beltRoomName?: string;
  beltLocked?: boolean;
  lagging?: boolean;
}

export interface ObjectiveHudCopy {
  objective: string;
  location: string;
  economy?: string;
  notice?: string;
  accent: number;
  color: string;
}

export interface ObjectiveHudRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectiveHudLayoutInput {
  screenWidth: number;
  uiScale: number;
  showEconomy: boolean;
  showNotice: boolean;
}

export interface ObjectiveHudLayout {
  objective: ObjectiveHudRect;
  location: ObjectiveHudRect;
  economy?: ObjectiveHudRect;
  notice?: ObjectiveHudRect;
  progressTop: number;
  progressWidth: number;
}

const BOSS_RUSH_TOTAL = 10;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** The objective timer is a compact clock, never a prose duration. */
export function objectiveTimer(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Pure copy model: no controls or build trivia can leak back into the objective cluster. */
export function objectiveHudCopy(input: ObjectiveHudCopyInput): ObjectiveHudCopy {
  const depth = Math.max(1, Math.floor(input.depth));
  const location =
    input.mode === "belt"
      ? input.beltRoomName || "Sky Carrier"
      : input.mode === "training"
        ? `${input.dimensionName} · Testing Grounds`
        : `${input.dimensionName} · Depth ${depth}`;
  const economy =
    input.mode === "arena" || input.mode === "bossrush"
      ? `⛏ ${Math.max(0, Math.floor(input.carriedSalvage))} carried · ${Math.max(0, Math.floor(input.bankedSalvage))} banked`
      : undefined;

  let objective: string;
  let accent = 0x8ba7b8;
  let color = "#f1e8cf";
  if (input.mode === "training") {
    objective = "Experiment freely";
    accent = 0x33e6ff;
    color = "#9eefff";
  } else if (input.mode === "belt") {
    objective = input.bossActive
      ? "Defeat the boss"
      : input.beltLocked
        ? "Clear this room"
        : "Advance to the next room";
    accent = input.bossActive ? 0xff5d3b : 0x7fb0d8;
    color = input.bossActive ? "#ff9b78" : "#b9d9f1";
  } else if (input.portalOpen) {
    objective = "Choose a gate · Bank & end or push deeper";
    accent = 0xb478ff;
    color = "#d2b3ff";
  } else if (input.mode === "bossrush") {
    const bossNumber = Math.min(depth, BOSS_RUSH_TOTAL);
    objective = input.bossActive
      ? `Boss ${bossNumber}/${BOSS_RUSH_TOTAL} · Cut it down`
      : `Boss ${bossNumber}/${BOSS_RUSH_TOTAL} · Incoming in ${objectiveTimer(input.bossEtaSeconds)}`;
    accent = 0xff5d3b;
    color = "#ff9b78";
  } else if (input.bossActive) {
    objective = "Defeat the boss to open the gates";
    accent = 0xff5d3b;
    color = "#ff9b78";
  } else {
    objective = `Survive · Boss in ${objectiveTimer(input.bossEtaSeconds)}`;
  }

  return {
    objective,
    location,
    economy,
    notice: input.lagging ? "⚠ Connection lag" : undefined,
    accent,
    color,
  };
}

/**
 * Responsive retained-HUD geometry. The objective owns one constrained two-line plate; every supporting
 * fact owns a separate one-line chip. At laptop widths the restart control retains a 140px side lane.
 */
export function objectiveHudLayout(input: ObjectiveHudLayoutInput): ObjectiveHudLayout {
  const scale = clamp(input.uiScale, 1, 2.1);
  const margin = 12 * scale;
  const available = Math.max(120, input.screenWidth - margin * 2);
  const restartLane = input.screenWidth >= 640 ? 280 * scale : 150 * scale;
  const objectiveWidth = Math.min(680 * scale, Math.max(120, available - restartLane));
  const objective: ObjectiveHudRect = {
    x: (input.screenWidth - objectiveWidth) / 2,
    y: 10 * scale,
    width: objectiveWidth,
    height: 48 * scale,
  };

  const chipGap = 8 * scale;
  const chipHeight = 26 * scale;
  const chipTop = objective.y + objective.height + 7 * scale;
  const chipCount = 1 + Number(input.showEconomy) + Number(input.showNotice);
  const chipContentWidth = Math.max(
    100,
    Math.min(680 * scale, available) - chipGap * (chipCount - 1),
  );
  const weights = input.showEconomy
    ? input.showNotice
      ? [0.32, 0.43, 0.25]
      : [0.43, 0.57]
    : input.showNotice
      ? [0.58, 0.42]
      : [1];
  const widths = weights.map((weight) => chipContentWidth * weight);
  const rowWidth = chipContentWidth + chipGap * (chipCount - 1);
  let chipX = (input.screenWidth - rowWidth) / 2;
  const location: ObjectiveHudRect = {
    x: chipX,
    y: chipTop,
    width: widths[0] ?? chipContentWidth,
    height: chipHeight,
  };
  chipX += location.width + chipGap;
  const economy = input.showEconomy
    ? {
        x: chipX,
        y: chipTop,
        width: widths[1] ?? 0,
        height: chipHeight,
      }
    : undefined;
  if (economy) chipX += economy.width + chipGap;
  const noticeIndex = input.showEconomy ? 2 : 1;
  const notice = input.showNotice
    ? {
        x: chipX,
        y: chipTop,
        width: widths[noticeIndex] ?? 0,
        height: chipHeight,
      }
    : undefined;

  return {
    objective,
    location,
    economy,
    notice,
    progressTop: chipTop + chipHeight + 22 * scale,
    progressWidth: Math.min(520 * scale, available),
  };
}
