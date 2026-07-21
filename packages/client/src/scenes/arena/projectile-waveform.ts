import {
  projectileWaveformPositionAt,
  type ProjectileWaveformDef,
  type ProjectileWaveformSample,
} from "@dd/shared";

/** Reconstruct the immutable launch origin from one authoritative curve sample, then extrapolate with
 * the same shared waveform used by the server. This keeps correction on the curve instead of cutting
 * straight across its lateral twizzle. */
export function sampleProjectileWaveformFromAuthoritative(
  projectile: Readonly<{ x: number; y: number; vx: number; vy: number }>,
  waveform: ProjectileWaveformDef,
  authoritativeElapsedSeconds: number,
  displayElapsedSeconds: number,
): ProjectileWaveformSample {
  const relative = projectileWaveformPositionAt(
    0,
    0,
    projectile.vx,
    projectile.vy,
    authoritativeElapsedSeconds,
    waveform,
  );
  return projectileWaveformPositionAt(
    projectile.x - relative.x,
    projectile.y - relative.y,
    projectile.vx,
    projectile.vy,
    displayElapsedSeconds,
    waveform,
  );
}
