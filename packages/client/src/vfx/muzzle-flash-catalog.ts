import { WEAPONS } from "@dd/shared";

export const MUZZLE_FLASH_SHEET = Object.freeze({
  key: "vfx:v6g-muzzle-flashes",
  url: "particles/v6g-muzzle-flashes.png",
  frameWidth: 192,
  frameHeight: 192,
  originX: 0.07,
});

export const HAILBARREL_MUZZLE_FLASH = Object.freeze({
  key: "vfx:hailbarrel-sledcaster-muzzle",
  url: "particles/hailbarrel-sledcaster-muzzle.png",
  originX: 0.25,
});

export const MUZZLE_FLASH_VARIANTS = Object.freeze([
  "needle",
  "crown",
  "fork",
  "bloom",
  "split",
  "shard",
] as const);
export type MuzzleFlashVariant = (typeof MUZZLE_FLASH_VARIANTS)[number];

export interface MuzzleFlashAssignment {
  readonly weaponId: string;
  readonly variant: MuzzleFlashVariant;
  readonly frame: number;
}

function hashId(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const STYLE_BIAS: Readonly<Record<string, number>> = Object.freeze({
  punch: 0,
  heavy: 1,
  spark: 2,
  boom: 3,
  rapid: 4,
  artillery: 5,
});

const MUZZLE_FLASH_VARIANT_OVERRIDES: Readonly<
  Partial<Record<string, MuzzleFlashVariant>>
> = Object.freeze({
  "x2-hailbarrel-sledcaster": "shard",
});

const gunCatalog = Object.values(WEAPONS).filter((weapon) => !!weapon.gun && !weapon.archived);
let previousFrame = -1;
export const MUZZLE_FLASH_ASSIGNMENTS: Readonly<Record<string, MuzzleFlashAssignment>> =
  Object.freeze(
    Object.fromEntries(
      gunCatalog.map((weapon, index) => {
        const style = weapon.gun?.muzzle ?? "heavy";
        const override = MUZZLE_FLASH_VARIANT_OVERRIDES[weapon.id];
        let frame = override
          ? MUZZLE_FLASH_VARIANTS.indexOf(override)
          : (hashId(weapon.id) + (STYLE_BIAS[style] ?? 0)) % MUZZLE_FLASH_VARIANTS.length;
        // Catalog neighbors are the guns most likely to be compared in the armory. Never let them share a
        // silhouette, even when their semantic style/hash proposal collides. A non-overridden row also
        // reserves the next row's authored override so that Hailbarrel can keep its mandated shard.
        if (!override) {
          const nextOverride = MUZZLE_FLASH_VARIANT_OVERRIDES[gunCatalog[index + 1]?.id ?? ""];
          const nextOverrideFrame = nextOverride
            ? MUZZLE_FLASH_VARIANTS.indexOf(nextOverride)
            : -1;
          while (frame === previousFrame || frame === nextOverrideFrame)
            frame = (frame + 1) % MUZZLE_FLASH_VARIANTS.length;
        }
        previousFrame = frame;
        return [
          weapon.id,
          Object.freeze({
            weaponId: weapon.id,
            variant: MUZZLE_FLASH_VARIANTS[frame] ?? "crown",
            frame,
          }),
        ];
      }),
    ),
  );

export function muzzleFlashAssignmentFor(
  weaponId: string | undefined,
  style = "heavy",
): MuzzleFlashAssignment {
  const assigned = weaponId ? MUZZLE_FLASH_ASSIGNMENTS[weaponId] : undefined;
  if (assigned) return assigned;
  const frame = STYLE_BIAS[style] ?? 1;
  return {
    weaponId: weaponId ?? "unassigned",
    variant: MUZZLE_FLASH_VARIANTS[frame] ?? "crown",
    frame,
  };
}
