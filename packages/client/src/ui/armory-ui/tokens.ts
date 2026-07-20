import type Phaser from "phaser";

/** Armory / Wardrobe visual contract. Keep these literals in sync with docs/armory-ui-panel/spec.md. */
export const ARMORY_COLORS = {
  bg: 0x080a0d,
  surface0: 0x0e1117,
  surface1: 0x11141a,
  surface2: 0x171a21,
  surface3: 0x20242c,
  border: 0x39414d,
  stitch: 0x59616d,
  textPrimary: 0xf4ead7,
  textSecondary: 0xb9b2a6,
  textMuted: 0x8f8a84,
  accent: 0x49d9e8,
  action: 0xf2c66d,
  success: 0x8ee28f,
  warning: 0xffaa55,
  danger: 0xff6b6b,
} as const;

export const ARMORY_CSS_COLORS = Object.fromEntries(
  Object.entries(ARMORY_COLORS).map(([key, value]) => [
    key,
    `#${value.toString(16).padStart(6, "0")}`,
  ]),
) as Record<keyof typeof ARMORY_COLORS, string>;

export const ARMORY_SPACING = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const ARMORY_MIN_TEXT_PX = 14;
export const ARMORY_MIN_TARGET_PX = 44;
export const ARMORY_FONT = '"Segoe UI Variable", "Segoe UI", Arial, sans-serif';
export const ARMORY_MONO_FONT = '"Cascadia Mono", Consolas, monospace';

export const ARMORY_TYPE = {
  display: { size: 32, lineHeight: 36, weight: "bold" },
  pageTitle: { size: 24, lineHeight: 30, weight: "bold" },
  section: { size: 18, lineHeight: 24, weight: "bold" },
  body: { size: 16, lineHeight: 22, weight: "bold" },
  secondary: { size: 14, lineHeight: 20, weight: "bold" },
} as const;

export type ArmoryRarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Really Rare"
  | "Legendary"
  | "Ultimate"
  | "Cursed";

export interface ArmoryRarityToken {
  readonly label: string;
  readonly color: number;
  readonly diamonds: number;
  readonly hollow: boolean;
}

export const ARMORY_RARITIES: Readonly<Record<ArmoryRarityName, ArmoryRarityToken>> = {
  Common: { label: "COMMON", color: 0x9aa5b1, diamonds: 1, hollow: false },
  Uncommon: { label: "UNCOMMON", color: 0x59c96b, diamonds: 2, hollow: false },
  Rare: { label: "RARE", color: 0x4aa3ff, diamonds: 3, hollow: false },
  "Really Rare": { label: "REALLY RARE", color: 0x2fd6c3, diamonds: 4, hollow: false },
  Legendary: { label: "LEGENDARY", color: 0xffa53a, diamonds: 5, hollow: false },
  Ultimate: { label: "ULTIMATE", color: 0xff4a6a, diamonds: 6, hollow: false },
  Cursed: { label: "CURSED", color: 0xa06bff, diamonds: 6, hollow: true },
};

export type ArmoryArtStatus = "ready" | "rendering" | "unavailable" | "artless";

export const ARMORY_ART_STATUS: Readonly<
  Record<ArmoryArtStatus, { label: string; color: number; icon: "check" | "hourglass" | "warning" | "artless" }>
> = {
  ready: { label: "READY", color: ARMORY_COLORS.success, icon: "check" },
  rendering: { label: "ART RENDERING…", color: ARMORY_COLORS.warning, icon: "hourglass" },
  unavailable: { label: "ART UNAVAILABLE", color: ARMORY_COLORS.danger, icon: "warning" },
  artless: { label: "INTENTIONALLY ARTLESS", color: ARMORY_COLORS.textMuted, icon: "artless" },
};

/** Consumes the explicit manifest notice; it never guesses from texture presence. */
export function armoryArtStatusFromNotice(notice: string | null): ArmoryArtStatus {
  if (notice === null) return "ready";
  if (notice.includes("INTENTIONALLY ARTLESS")) return "artless";
  if (notice.includes("ART UNAVAILABLE")) return "unavailable";
  return "rendering";
}

export function rarityToken(name: string): ArmoryRarityToken {
  return ARMORY_RARITIES[name as ArmoryRarityName] ?? ARMORY_RARITIES.Common;
}

export function rarityMark(name: string): string {
  const token = rarityToken(name);
  return `${token.label} ${(token.hollow ? "◇" : "◆").repeat(token.diamonds)}`;
}

export function armoryTextStyle(
  role: keyof typeof ARMORY_TYPE,
  color: keyof typeof ARMORY_CSS_COLORS = "textPrimary",
  mono = false,
): Phaser.Types.GameObjects.Text.TextStyle {
  const type = ARMORY_TYPE[role];
  return {
    fontFamily: mono ? ARMORY_MONO_FONT : ARMORY_FONT,
    fontSize: `${Math.max(ARMORY_MIN_TEXT_PX, type.size)}px`,
    color: ARMORY_CSS_COLORS[color],
    fontStyle: type.weight,
    lineSpacing: Math.max(0, type.lineHeight - type.size),
  };
}

export function drawArmoryPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { selected?: boolean; major?: boolean; fill?: number; accent?: number } = {},
): void {
  const radius = options.major === false ? 8 : 12;
  const stroke = options.selected ? 2 : 1;
  graphics
    .fillStyle(options.fill ?? ARMORY_COLORS.surface1, 0.985)
    .fillRoundedRect(x, y, width, height, radius)
    .lineStyle(stroke, options.accent ?? (options.selected ? ARMORY_COLORS.accent : ARMORY_COLORS.border), 1)
    .strokeRoundedRect(x, y, width, height, radius)
    .lineStyle(1, ARMORY_COLORS.stitch, 0.34);
  const inset = 7;
  const dash = 7;
  const gap = 6;
  for (let px = x + inset; px < x + width - inset; px += dash + gap) {
    graphics.lineBetween(px, y + inset, Math.min(x + width - inset, px + dash), y + inset);
  }
}
