import { ATTACK_HELD_WINDOW, TICK_MS, type WeaponDef } from "@dd/shared";
import { SPRITES, type SpriteFrameVariant, type SpriteManifest } from "./manifest.js";

/** The firing frame is owned by the same short server latch published with every accepted attack beat. */
export const FIRING_FRAME_RELEASE_WINDOW_MS = ATTACK_HELD_WINDOW * TICK_MS;

export interface ResolvedWeaponFiringFrame {
  readonly spriteId: string;
  readonly manifest: SpriteManifest;
  readonly registration: SpriteFrameVariant;
}

/**
 * Select only from the synced server tick domain. Callers deliberately omit speculative/local input clocks,
 * so owner and observer sample the same half-open release window: [acceptedTick, acceptedTick + latch).
 */
export function firingFrameSpriteAt(
  weapon: Pick<WeaponDef, "firingFrame"> | undefined,
  authoritativeAcceptedTick: number | undefined,
  authoritativeClockTick: number | undefined,
): string | undefined {
  if (
    !weapon?.firingFrame ||
    authoritativeAcceptedTick === undefined ||
    authoritativeClockTick === undefined
  )
    return undefined;
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
