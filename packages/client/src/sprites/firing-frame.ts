import { ATTACK_HELD_WINDOW, TICK_MS, type WeaponDef } from "@dd/shared";
import { SPRITES, type SpriteFrameVariant, type SpriteManifest } from "./manifest.js";

/** Compatibility clock for frame users that predate the replicated raw held-fire intent. */
export const FIRING_FRAME_RELEASE_WINDOW_MS = ATTACK_HELD_WINDOW * TICK_MS;

export interface ResolvedWeaponFiringFrame {
  readonly spriteId: string;
  readonly manifest: SpriteManifest;
  readonly registration: SpriteFrameVariant;
}

/**
 * Select only from the synced server domain. The held-input bit owns modern open/close state for both owner
 * and observers; the old half-open attack latch remains only as compatibility for callers without that bit.
 */
export function firingFrameSpriteAt(
  weapon: Pick<WeaponDef, "firingFrame"> | undefined,
  authoritativeAcceptedTick: number | undefined,
  authoritativeClockTick: number | undefined,
  authoritativeInputHeld?: boolean,
): string | undefined {
  if (
    !weapon?.firingFrame ||
    authoritativeAcceptedTick === undefined ||
    authoritativeClockTick === undefined
  )
    return undefined;
  if (authoritativeInputHeld !== undefined)
    return authoritativeInputHeld ? weapon.firingFrame : undefined;
  const elapsedTicks = (authoritativeClockTick - authoritativeAcceptedTick) >>> 0;
  return elapsedTicks < ATTACK_HELD_WINDOW ? weapon.firingFrame : undefined;
}

/** Resolve and validate the manifest-side registration contract once when a held weapon is equipped. */
export function resolveWeaponFiringFrame(
  weapon: Pick<WeaponDef, "firingFrame">,
  baseSpriteId: string,
): ResolvedWeaponFiringFrame | undefined {
  const spriteId = weapon.firingFrame;
  if (!spriteId) return undefined;
  const manifest = SPRITES[spriteId as keyof typeof SPRITES] as SpriteManifest | undefined;
  const registration = manifest?.frameVariant;
  if (
    !manifest ||
    !registration ||
    registration.base !== baseSpriteId ||
    !(registration.sourceScale > 0) ||
    !Number.isFinite(registration.originX) ||
    !Number.isFinite(registration.originY)
  ) {
    return undefined;
  }
  return { spriteId, manifest, registration };
}
