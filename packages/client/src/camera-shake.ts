/** Camera-origin classes are deliberately exhaustive: adding a shake requires declaring whether it came
 * from a player weapon or the world. The mixer is the one amplitude choke point for both classes. */
export type CameraShakeSource = "player-weapon" | "world";

/** Owner ruling V5G1 (2026-07-21): player-weapon camera motion is capped at 5% of authored amplitude. */
export const PLAYER_WEAPON_SHAKE_SCALE = 0.05;

export function budgetedCameraShakeIntensity(
  rawIntensity: number,
  source: CameraShakeSource,
): number {
  const safeRaw = Math.max(0, Number.isFinite(rawIntensity) ? rawIntensity : 0);
  return source === "player-weapon" ? safeRaw * PLAYER_WEAPON_SHAKE_SCALE : safeRaw;
}
