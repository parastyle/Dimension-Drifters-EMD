import type { WeaponDef, WeaponGripPoints } from "@dd/shared";

/**
 * Safe presentation fallback for two-hand firearms that predate authored grip metadata.
 * The secondary hand sits on the forward underside of the receiver/barrel lane, never on
 * the central magazine lane. Authored points remain authoritative whenever they exist.
 */
const DEFAULT_TWO_HAND_GUN_GRIPS: Readonly<WeaponGripPoints> = Object.freeze({
  primary: Object.freeze({ x: 0.3, y: 0.66 }),
  secondary: Object.freeze({ x: 0.7, y: 0.68, role: "two-hand-rifle" }),
});

export function resolvedGunGripPoints(
  definition: Pick<WeaponDef, "beam" | "gripPoints" | "gun" | "tags">,
): Readonly<WeaponGripPoints> | undefined {
  if (definition.gripPoints) return definition.gripPoints;
  if (!definition.gun && !definition.beam) return undefined;
  if (definition.tags.grip !== "2H" && definition.tags.grip !== "mounted") return undefined;
  return DEFAULT_TWO_HAND_GUN_GRIPS;
}
