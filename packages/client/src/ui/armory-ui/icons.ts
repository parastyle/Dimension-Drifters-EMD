import type Phaser from "phaser";
import { ARMORY_COLORS, type ArmoryArtStatus } from "./tokens.js";

export type ArmoryIcon =
  | "hat"
  | "glasses"
  | "facialHair"
  | "head"
  | "torso"
  | "gloves"
  | "boots"
  | "cloak"
  | "check"
  | "hourglass"
  | "warning"
  | "artless"
  | "lock"
  | "eye"
  | "risk"
  | "vault";

/** Draw one icon on the canonical 24px line grid. */
export function drawArmoryIcon(
  graphics: Phaser.GameObjects.Graphics,
  icon: ArmoryIcon,
  x: number,
  y: number,
  color: number = ARMORY_COLORS.textSecondary,
  scale: number = 1,
): void {
  const s = scale;
  const line = Math.max(1.5, 2 * s);
  graphics.lineStyle(line, color, 1).fillStyle(color, 1);
  if (icon === "check") {
    graphics.lineBetween(x - 8 * s, y, x - 2 * s, y + 6 * s).lineBetween(x - 2 * s, y + 6 * s, x + 9 * s, y - 7 * s);
  } else if (icon === "hourglass") {
    graphics.strokeRect(x - 7 * s, y - 9 * s, 14 * s, 18 * s);
    graphics.lineBetween(x - 7 * s, y - 9 * s, x + 7 * s, y + 9 * s).lineBetween(x + 7 * s, y - 9 * s, x - 7 * s, y + 9 * s);
  } else if (icon === "warning") {
    graphics.strokeTriangle(x, y - 10 * s, x + 10 * s, y + 9 * s, x - 10 * s, y + 9 * s);
    graphics.lineBetween(x, y - 4 * s, x, y + 3 * s).fillCircle(x, y + 6 * s, 1.3 * s);
  } else if (icon === "artless") {
    graphics.strokeCircle(x, y, 9 * s);
  } else if (icon === "lock") {
    graphics.strokeRoundedRect(x - 8 * s, y - 1 * s, 16 * s, 11 * s, 2 * s);
    graphics.beginPath();
    graphics.arc(x, y - s, 5 * s, Math.PI, 0);
    graphics.strokePath();
  } else if (icon === "eye") {
    graphics.beginPath();
    graphics.arc(x, y, 10 * s, Math.PI * 0.12, Math.PI * 0.88);
    graphics.arc(x, y, 10 * s, Math.PI * 1.12, Math.PI * 1.88);
    graphics.strokePath().fillCircle(x, y, 2.5 * s);
  } else if (icon === "hat") {
    graphics.lineBetween(x - 10 * s, y + 7 * s, x + 10 * s, y + 7 * s).strokeRoundedRect(x - 7 * s, y - 7 * s, 14 * s, 14 * s, 3 * s);
  } else if (icon === "glasses") {
    graphics.strokeCircle(x - 6 * s, y, 5 * s).strokeCircle(x + 6 * s, y, 5 * s).lineBetween(x - s, y, x + s, y);
  } else if (icon === "facialHair") {
    graphics.beginPath();
    graphics.moveTo(x - 9 * s, y - 4 * s).lineTo(x, y + 10 * s).lineTo(x + 9 * s, y - 4 * s).lineTo(x, y + 3 * s).closePath().strokePath();
  } else if (icon === "head") {
    graphics.strokeCircle(x, y - 2 * s, 8 * s).lineBetween(x - 8 * s, y - 2 * s, x - 5 * s, y + 10 * s).lineBetween(x + 8 * s, y - 2 * s, x + 5 * s, y + 10 * s);
  } else if (icon === "torso") {
    graphics.strokeRoundedRect(x - 8 * s, y - 9 * s, 16 * s, 19 * s, 3 * s).lineBetween(x - 8 * s, y - 6 * s, x - 12 * s, y + 4 * s).lineBetween(x + 8 * s, y - 6 * s, x + 12 * s, y + 4 * s);
  } else if (icon === "gloves") {
    graphics.strokeRoundedRect(x - 10 * s, y - 5 * s, 8 * s, 14 * s, 3 * s).strokeRoundedRect(x + 2 * s, y - 5 * s, 8 * s, 14 * s, 3 * s);
  } else if (icon === "boots") {
    graphics.strokeRoundedRect(x - 9 * s, y - 9 * s, 7 * s, 17 * s, 2 * s).strokeRoundedRect(x + 2 * s, y - 9 * s, 7 * s, 17 * s, 2 * s);
  } else if (icon === "cloak") {
    graphics.beginPath();
    graphics.moveTo(x, y - 10 * s).lineTo(x - 9 * s, y + 10 * s).lineTo(x, y + 6 * s).lineTo(x + 9 * s, y + 10 * s).closePath().strokePath();
  } else if (icon === "risk") {
    graphics.strokeCircle(x - 4 * s, y, 5 * s).strokeCircle(x + 4 * s, y, 5 * s).lineBetween(x - 8 * s, y + 7 * s, x + 8 * s, y - 7 * s);
  } else if (icon === "vault") {
    graphics.strokeRoundedRect(x - 10 * s, y - 9 * s, 20 * s, 18 * s, 3 * s).strokeCircle(x, y, 5 * s).lineBetween(x, y - 5 * s, x, y + 5 * s);
  }
}

export function artStatusIcon(status: ArmoryArtStatus): ArmoryIcon {
  return status === "ready"
    ? "check"
    : status === "rendering"
      ? "hourglass"
      : status === "unavailable"
        ? "warning"
        : "artless";
}
