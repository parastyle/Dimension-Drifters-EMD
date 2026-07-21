import type { WeaponDef } from "@dd/shared";
import { PARTICLE_PACKS } from "./particle-manifest.js";

/** A scale request stated in display units instead of raw 96-pack texture multipliers. */
export type PaintedParticleScaleContract =
  | Readonly<{ basis: "display-px"; sizePx: number }>
  | Readonly<{
      basis: "relative";
      referencePx: number;
      dominance: number;
      minPx?: number;
      maxPx?: number;
    }>;

export function paintedParticleDisplaySize(contract: PaintedParticleScaleContract): number {
  if (contract.basis === "display-px") return Math.max(1, contract.sizePx);
  return Math.max(
    contract.minPx ?? 1,
    Math.min(contract.maxPx ?? Number.POSITIVE_INFINITY, contract.referencePx * contract.dominance),
  );
}

export function paintedParticleScale(
  packId: string,
  contract: PaintedParticleScaleContract,
): number {
  const frameWidth = PARTICLE_PACKS[packId]?.frameWidth ?? 96;
  return paintedParticleDisplaySize(contract) / Math.max(1, frameWidth);
}

export const paintedParticlePixels = (sizePx: number): PaintedParticleScaleContract =>
  Object.freeze({ basis: "display-px", sizePx });

export const paintedParticleDominance = (
  referencePx: number,
  dominance: number,
  minPx = 1,
  maxPx = Number.POSITIVE_INFINITY,
): PaintedParticleScaleContract =>
  Object.freeze({ basis: "relative", referencePx, dominance, minPx, maxPx });

export const PAINTED_SWING_DOMINANCE_BY_WEAPON: Readonly<Record<string, number>> = Object.freeze({
  "x2-gravechain-scythe": 0.34,
  "x2-godsbone-pillar": 0.26,
});

/** Display width contract for the 96-pack ribbon consumer; no texture-pixel multiplier escapes it. */
export function paintedSwingDisplayWidth(def: WeaponDef | undefined): number {
  if (!def) return 22;
  const sizeDefault = { S: 0.22, M: 0.24, L: 0.26, XL: 0.28 }[def.tags.size] ?? 0.24;
  const dominance = PAINTED_SWING_DOMINANCE_BY_WEAPON[def.id] ?? sizeDefault;
  return Math.max(14, Math.min(96, def.displayLength * dominance));
}
