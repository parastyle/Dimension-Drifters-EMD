import type { ProjectileSpriteManifestEntry } from "../../sprites/projectile-manifest.js";

export interface ProjectileArtTransform {
  readonly rotation: number;
  readonly scaleX: 1 | -1;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Resolve directional art independently from authoritative velocity.
 *
 * Rotational art follows the full travel angle. Asymmetric side-profile art is authored facing right:
 * rightward travel keeps the texture as-is, while leftward travel mirrors it horizontally and removes
 * the half-turn from its rotation. The resulting residual tilt stays within a quarter turn, so the
 * projectile still points exactly along velocity without ever putting its authored top on the bottom.
 */
export function projectileArtTransform(
  vx: number,
  vy: number,
  facing: ProjectileSpriteManifestEntry["facing"],
): ProjectileArtTransform {
  const heading = Math.atan2(vy, vx);
  if (facing !== "mirror-upright" || vx >= 0) {
    return { rotation: heading, scaleX: 1 };
  }
  return {
    rotation: normalizeAngle(heading - Math.PI),
    scaleX: -1,
  };
}
