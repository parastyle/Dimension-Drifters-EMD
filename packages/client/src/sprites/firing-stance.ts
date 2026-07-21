import { isWornWeapon, type WeaponDef, weaponHasHandlingTag } from "@dd/shared";

/** Hand-target coordinates are body-height ratios in rig-local space; negative Y is upward. */
export const FIRING_FACE_LINE_Y = -0.22;
export const FIST_GUN_CHEST_CAP_Y = -0.06;

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
 * Presentation truth beside the painted-art geometry seam. Values are deliberately well below the
 * old global eye-line target (-0.27H): even the highest long-gun sample remains below -0.22H.
 */
export const FIRING_STANCES: Readonly<Record<FiringStanceFamily, FiringStanceSpec>> = {
  pistol: {
    family: "pistol",
    yBand: [-0.12, -0.04],
    lead: { x: 0.22, y: -0.08, aimReach: 0.025 },
    off: { x: 0.15, y: -0.06, aimReach: 0.02 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.012,
    bodyTurn: 0.025,
    aimed: true,
  },
  "long-gun": {
    family: "long-gun",
    yBand: [-0.16, -0.08],
    lead: { x: 0.15, y: -0.12, aimReach: 0.02 },
    off: { x: 0.1, y: -0.105, aimReach: 0.015 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.014,
    bodyTurn: 0.035,
    aimed: true,
  },
  scattergun: {
    family: "scattergun",
    yBand: [-0.12, -0.04],
    lead: { x: 0.15, y: -0.085, aimReach: 0.018 },
    off: { x: 0.1, y: -0.065, aimReach: 0.014 },
    twoHandSpacing: 0.34,
    bodyAdvance: 0.016,
    bodyTurn: 0.06,
    aimed: true,
  },
  "rapid-gun": {
    family: "rapid-gun",
    yBand: [-0.13, -0.05],
    lead: { x: 0.2, y: -0.085, aimReach: 0.022 },
    off: { x: 0.14, y: -0.07, aimReach: 0.018 },
    twoHandSpacing: 0.33,
    bodyAdvance: 0.012,
    bodyTurn: 0.025,
    aimed: true,
  },
  launcher: {
    family: "launcher",
    yBand: [-0.16, -0.08],
    lead: { x: 0.14, y: -0.12, aimReach: 0.015 },
    off: { x: 0.09, y: -0.105, aimReach: 0.012 },
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
    yBand: [FIST_GUN_CHEST_CAP_Y, 0.02],
    lead: { x: 0.28, y: -0.04, aimReach: 0.02 },
    off: { x: 0.22, y: -0.035, aimReach: 0.018 },
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
const LONG_GUN_FAMILY = /^(?:lever-rifle|marksman-rifle|railgun|scrap-cannon)$/i;

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
