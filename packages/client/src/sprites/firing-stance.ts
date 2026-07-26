import { isWornWeapon, type WeaponDef, weaponHasHandlingTag } from "@dd/shared";

/** Hand-target coordinates are body-height ratios in rig-local space; negative Y is upward. */
export const FIRING_FACE_LINE_Y = -0.22;
export const FIST_GUN_CHEST_CAP_Y = -0.17;
/** Combat-scale cheek-weld tuning in rig-local pixels/radians. The full 18 px drop is about 20% of
 * proto-cowboy-hidden-face's rendered head height; short guns retain half that shoulder dip. */
export const GUN_HEAD_DROP_PX = {
  short: 9,
  sightedLong: 18,
} as const;
export const GUN_HEAD_NOD_RAD = {
  short: 0.07,
  sightedLong: 0.11,
} as const;

export type GunCheekWeldClass = keyof typeof GUN_HEAD_DROP_PX;

export interface GunCheekWeldPose {
  readonly weaponClass: GunCheekWeldClass;
  readonly dropPx: number;
  readonly nodRad: number;
}

const GUN_CHEEK_WELD_POSES: Readonly<Record<GunCheekWeldClass, GunCheekWeldPose>> = {
  short: {
    weaponClass: "short",
    dropPx: GUN_HEAD_DROP_PX.short,
    nodRad: GUN_HEAD_NOD_RAD.short,
  },
  sightedLong: {
    weaponClass: "sightedLong",
    dropPx: GUN_HEAD_DROP_PX.sightedLong,
    nodRad: GUN_HEAD_NOD_RAD.sightedLong,
  },
};

/**
 * Catalog-to-aiming-fiction mapping for the visible cheek weld. Rifle-family and railgun art has a
 * sighted long-barrel silhouette; `handling:bolt` also promotes sniper/anti-materiel definitions whose
 * family is broader (for example heavy ordnance). All other guns use the compact/hip-fire half profile.
 */
export function gunCheekWeldPoseFor(def: WeaponDef | undefined): GunCheekWeldPose | undefined {
  if (!def?.gun) return undefined;
  const sightedLong =
    /(?:^|-)rifle$/i.test(def.tags.family) ||
    /^railgun$/i.test(def.tags.family) ||
    weaponHasHandlingTag(def, "bolt");
  return GUN_CHEEK_WELD_POSES[sightedLong ? "sightedLong" : "short"];
}

export type FiringStanceFamily =
  | "pistol"
  | "long-gun"
  | "scattergun"
  | "rapid-gun"
  | "launcher"
  | "shoulder-launcher"
  | "fist-gun"
  | "wand"
  | "staff"
  | "tome"
  | "thrown";

export interface FiringHandAnchor {
  readonly x: number;
  readonly y: number;
  readonly aimReach: number;
}

export interface FiringStanceSpec {
  readonly family: FiringStanceFamily;
  /** Inclusive authored band for every sampled grip target in this family. */
  readonly yBand: readonly [min: number, max: number];
  readonly lead: FiringHandAnchor;
  readonly off: FiringHandAnchor;
  /** A free casting hand replaces the rear grip while a one-piece tome is firing. */
  readonly castingHand?: FiringHandAnchor;
  readonly twoHandSpacing: number;
  readonly bodyAdvance: number;
  readonly bodyTurn: number;
  /** Thrown implements use the authored throw clock, never the retained aimed-pose envelope. */
  readonly aimed: boolean;
}

/**
 * Presentation truth beside the painted-art geometry seam. Guns sit on a shoulder-height lane just
 * below the face line, leaving room for the head to meet the sights without intersecting the weapon.
 */
export const FIRING_STANCES: Readonly<Record<FiringStanceFamily, FiringStanceSpec>> = {
  pistol: {
    family: "pistol",
    yBand: [-0.205, -0.135],
    lead: { x: 0.22, y: -0.18, aimReach: 0.025 },
    off: { x: 0.15, y: -0.16, aimReach: 0.02 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.012,
    bodyTurn: 0.025,
    aimed: true,
  },
  "long-gun": {
    family: "long-gun",
    yBand: [-0.21, -0.16],
    lead: { x: 0.15, y: -0.19, aimReach: 0.02 },
    off: { x: 0.1, y: -0.175, aimReach: 0.015 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.014,
    bodyTurn: 0.035,
    aimed: true,
  },
  scattergun: {
    family: "scattergun",
    yBand: [-0.205, -0.145],
    lead: { x: 0.15, y: -0.18, aimReach: 0.018 },
    off: { x: 0.1, y: -0.16, aimReach: 0.014 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.016,
    bodyTurn: 0.06,
    aimed: true,
  },
  "rapid-gun": {
    family: "rapid-gun",
    yBand: [-0.205, -0.14],
    lead: { x: 0.2, y: -0.18, aimReach: 0.022 },
    off: { x: 0.14, y: -0.16, aimReach: 0.018 },
    twoHandSpacing: 0.33,
    bodyAdvance: 0.012,
    bodyTurn: 0.025,
    aimed: true,
  },
  launcher: {
    family: "launcher",
    yBand: [-0.21, -0.155],
    lead: { x: 0.14, y: -0.19, aimReach: 0.015 },
    off: { x: 0.09, y: -0.17, aimReach: 0.012 },
    twoHandSpacing: 0.35,
    bodyAdvance: 0.008,
    bodyTurn: 0.03,
    aimed: true,
  },
  "shoulder-launcher": {
    family: "shoulder-launcher",
    yBand: [-0.36, -0.21],
    lead: { x: -0.08, y: -0.32, aimReach: 0.008 },
    off: { x: 0.04, y: -0.23, aimReach: 0.006 },
    twoHandSpacing: 0.3,
    bodyAdvance: -0.012,
    bodyTurn: 0.08,
    aimed: true,
  },
  "fist-gun": {
    family: "fist-gun",
    yBand: [FIST_GUN_CHEST_CAP_Y, -0.122],
    lead: { x: 0.28, y: -0.15, aimReach: 0.02 },
    off: { x: 0.22, y: -0.14, aimReach: 0.018 },
    twoHandSpacing: 0.42,
    bodyAdvance: 0.006,
    bodyTurn: 0,
    aimed: true,
  },
  wand: {
    family: "wand",
    yBand: [-0.1, -0.02],
    lead: { x: 0.2, y: -0.055, aimReach: 0.018 },
    off: { x: 0.14, y: -0.045, aimReach: 0.015 },
    twoHandSpacing: 0.36,
    bodyAdvance: 0.008,
    bodyTurn: 0.015,
    aimed: true,
  },
  staff: {
    family: "staff",
    yBand: [-0.03, 0.05],
    lead: { x: 0.13, y: 0, aimReach: 0.015 },
    off: { x: 0.08, y: 0.01, aimReach: 0.012 },
    twoHandSpacing: 0.38,
    bodyAdvance: 0.006,
    bodyTurn: 0.015,
    aimed: true,
  },
  tome: {
    family: "tome",
    yBand: [-0.08, 0.02],
    lead: { x: 0.14, y: -0.02, aimReach: 0 },
    off: { x: 0.1, y: -0.015, aimReach: 0 },
    castingHand: { x: 0.21, y: -0.055, aimReach: 0.018 },
    twoHandSpacing: 0.42,
    bodyAdvance: 0.004,
    bodyTurn: 0,
    aimed: true,
  },
  thrown: {
    family: "thrown",
    yBand: [0, 0],
    lead: { x: 0, y: 0, aimReach: 0 },
    off: { x: 0, y: 0, aimReach: 0 },
    twoHandSpacing: 0.42,
    bodyAdvance: 0,
    bodyTurn: 0,
    aimed: false,
  },
};

const BOOK_FAMILY =
  /^(?:almanac|bestiary|chapbook|codex|compendium|grimoire|ledger|manuscript|psalter|spellbook|tome)$/i;
const WAND_FAMILY = /^(?:focus|orb|relic\/totem|rod|scepter|wand)$/i;
const SCATTER_FAMILY = /^(?:blunderbuss|shotgun)$/i;
const RAPID_FAMILY = /^(?:gun|machine-pistol|nailgun)$/i;
const LONG_GUN_FAMILY =
  /^(?:lever-rifle|marksman-rifle|pistol-calibre-carbine|railgun|scrap-cannon)$/i;

function gunLaunchesPayload(def: WeaponDef): boolean {
  if (!def.gun) return false;
  if (def.gun.explode || /grenade|rocket|mortar/i.test(def.gun.bulletKind)) return true;
  if (/concussion-cannon/i.test(def.tags.family)) return true;
  return /\b(?:bombard|howitzer|launcher|mortar)\b/i.test(`${def.id} ${def.name}`);
}

/** Resolve art stance from real delivery data first, then the authored class/family/grip tags. */
export function firingStanceFamilyFor(def: WeaponDef): FiringStanceFamily {
  const { delivery, family, grip, classPool, fireMode } = def.tags;
  if (def.thrown || delivery === "thrown") return "thrown";
  if ((def.gun || def.beam) && isWornWeapon(def)) return "fist-gun";
  if (def.gripPoints?.secondary?.role === "shoulder-RPG") return "shoulder-launcher";
  if (def.performance?.hold === "shoulder-launcher") return "shoulder-launcher";

  if (classPool === "caster") {
    if (BOOK_FAMILY.test(family)) return "tome";
    if (/^staff$/i.test(family)) return "staff";
    if (WAND_FAMILY.test(family)) return "wand";
    return grip === "2H" || grip === "mounted" ? "staff" : "wand";
  }

  if (def.gun) {
    if (
      delivery === "spread" ||
      (def.gun.pellets ?? 1) > 1 ||
      SCATTER_FAMILY.test(family) ||
      weaponHasHandlingTag(def, "pump")
    ) {
      return "scattergun";
    }
    if (gunLaunchesPayload(def)) return "launcher";
    if (LONG_GUN_FAMILY.test(family)) return "long-gun";
    const compactGrip = grip === "1H" || grip === "dual";
    if (
      RAPID_FAMILY.test(family) ||
      /nail/i.test(def.gun.bulletKind) ||
      (compactGrip &&
        (/tracer/i.test(def.gun.bulletKind) || fireMode === "auto" || def.gun.fireRate <= 0.2))
    ) {
      return "rapid-gun";
    }
  }

  if (grip === "1H" || grip === "dual") return "pistol";
  return "long-gun";
}

export function firingStanceFor(def: WeaponDef): FiringStanceSpec {
  return FIRING_STANCES[firingStanceFamilyFor(def)];
}

export function usesAimedFiringStance(def: WeaponDef): boolean {
  return (
    firingStanceFor(def).aimed &&
    !!(def.gun || def.beam || def.cast || def.groundZone?.trigger === "channel")
  );
}

export type FiringHandRole = "lead" | "off" | "casting";

/** Pure final hand target, including the hard fist-gun chest cap. */
export function firingHandTarget(
  def: WeaponDef,
  role: FiringHandRole,
  aimLocal: number,
): { x: number; y: number } {
  const stance = firingStanceFor(def);
  const anchor = role === "casting" ? (stance.castingHand ?? stance.off) : stance[role];
  const x = anchor.x + Math.cos(aimLocal) * anchor.aimReach;
  let y = anchor.y + Math.sin(aimLocal) * anchor.aimReach;
  if (stance.family === "fist-gun") y = Math.max(y, FIST_GUN_CHEST_CAP_Y);
  return { x, y };
}

/** Alternating worn emitters sell each accepted shot as a punch: the firing fist leads while its mate
 * reloads behind the chest line. Coordinates stay body-relative so the rig can apply them at final scale. */
export function fistGunShotHandOffset(
  hand: 0 | 1,
  strikingHand: 0 | 1,
  aimLocal: number,
  shotEnvelope: number,
): { x: number; y: number } {
  const strength = Math.max(0, Math.min(1, shotEnvelope));
  const distance = (hand === strikingHand ? 0.2 : -0.055) * strength;
  return {
    x: Math.cos(aimLocal) * distance,
    y: Math.sin(aimLocal) * distance,
  };
}
