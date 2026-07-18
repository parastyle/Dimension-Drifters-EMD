import type { ColorblindAssistMode } from "../settings.js";

export const MELEE_FIRST_GLINT_LEAD_MS = 450;
export const MELEE_FINAL_GLINT_LEAD_MS = 280;

export type ElementAssistPattern =
  | "bars"
  | "triangles"
  | "diamonds"
  | "zigzag"
  | "crosses"
  | "dots"
  | "squares"
  | "stars";

export function colorblindShapesEnabled(mode: ColorblindAssistMode | undefined): boolean {
  return mode === "shapes";
}

/** Empowered returns already double-glint; Shapes extends that non-hue rhythm to ordinary parry tells. */
export function meleeTellUsesDoublePulse(
  mode: ColorblindAssistMode | undefined,
  empowered: boolean,
): boolean {
  return empowered || colorblindShapesEnabled(mode);
}

/** Two bounded timing crests for retained generic parry geometry. */
export function parryDoublePulseStrength(t: number): number {
  const phase = Math.max(0, Math.min(1, t));
  const pulse = (center: number): number => Math.max(0, 1 - Math.abs(phase - center) / 0.055);
  return Math.max(pulse(0.72), pulse(0.9));
}

/** A stable shape vocabulary for hue-tinted beam material when Shapes is enabled. */
export function elementAssistPattern(element: string): ElementAssistPattern {
  switch (element) {
    case "fire":
    case "solar":
      return "triangles";
    case "frost":
    case "water":
      return "diamonds";
    case "shock":
      return "zigzag";
    case "holy":
      return "crosses";
    case "toxic":
    case "nature":
      return "dots";
    case "void":
    case "shadow":
      return "squares";
    case "arcane":
      return "stars";
    default:
      return "bars";
  }
}
