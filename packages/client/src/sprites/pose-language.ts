import { isWornWeapon, meleeComboSelectionFor, swingStyleFor, type WeaponDef } from "@dd/shared";
import { firingStanceFamilyFor } from "./firing-stance.js";

export type WeaponPoseFamily =
  | "one-hand-blade"
  | "close-blade"
  | "one-hand-blunt"
  | "fists"
  | "pistol"
  | "fist-gun"
  | "long-gun"
  | "thrown"
  | "focus"
  | "tome"
  | "two-hand-sword"
  | "two-hand-heavy"
  | "polearm";

export type OffHandVerb =
  | "oppose"
  | "ward"
  | "guard"
  | "recoil-catch"
  | "spot"
  | "frame"
  | "page"
  | "support"
  | "hard-grip";

export type PistolPoseVariant = "sternum-guard" | "firing-clasp";
export type OneHandBladePoseVariant = "duelist-wing" | "chest-guard";
export type TwoHandPoseAuthority = "metadata" | "art";

export interface PoseVariantSelection {
  pistol: PistolPoseVariant;
  oneHandBlade: OneHandBladePoseVariant;
  twoHandAuthority: TwoHandPoseAuthority;
}

export const DEFAULT_PISTOL_POSE_VARIANT: PistolPoseVariant = "sternum-guard";
export const DEFAULT_ONE_HAND_BLADE_POSE_VARIANT: OneHandBladePoseVariant = "duelist-wing";
/** The panel recommends preserving the geometry boolean/current painted-art behavior. */
export const DEFAULT_TWO_HAND_POSE_AUTHORITY: TwoHandPoseAuthority = "art";

export const POSE_PISTOL_VARIANT_REGISTRY_KEY = "pose-language:pistol";
export const POSE_ONE_HAND_BLADE_VARIANT_REGISTRY_KEY = "pose-language:one-hand-blade";
export const POSE_TWO_HAND_AUTHORITY_REGISTRY_KEY = "pose-language:two-hand-authority";

export const DEFAULT_POSE_VARIANTS: Readonly<PoseVariantSelection> = Object.freeze({
  pistol: DEFAULT_PISTOL_POSE_VARIANT,
  oneHandBlade: DEFAULT_ONE_HAND_BLADE_POSE_VARIANT,
  twoHandAuthority: DEFAULT_TWO_HAND_POSE_AUTHORITY,
});

export function createPoseVariantSelection(): PoseVariantSelection {
  return { ...DEFAULT_POSE_VARIANTS };
}

export function pistolPoseVariantFrom(value: unknown): PistolPoseVariant {
  return value === "firing-clasp" ? value : DEFAULT_PISTOL_POSE_VARIANT;
}

export function oneHandBladePoseVariantFrom(value: unknown): OneHandBladePoseVariant {
  return value === "chest-guard" ? value : DEFAULT_ONE_HAND_BLADE_POSE_VARIANT;
}

export function twoHandPoseAuthorityFrom(value: unknown): TwoHandPoseAuthority {
  return value === "metadata" ? value : DEFAULT_TWO_HAND_POSE_AUTHORITY;
}

export interface AimRelativeAnchor {
  /** Positive is toward aim. Units are normalized by body height. */
  readonly forward: number;
  /** Positive is to the character's local right before the selected hand-side sign is applied. */
  readonly lateral: number;
}

export interface WeaponPoseSpec {
  readonly family: WeaponPoseFamily;
  readonly offHandVerb: OffHandVerb;
  readonly idle: AimRelativeAnchor;
  readonly moveTighten: AimRelativeAnchor;
  readonly anticipation: AimRelativeAnchor;
  readonly active: AimRelativeAnchor;
  readonly recovery: AimRelativeAnchor;
  readonly offHandBlend: number;
  readonly microForward: number;
  readonly microLateral: number;
  readonly microHz: number;
  readonly bodyForward: number;
  readonly bodyLateral: number;
  readonly bodyTurn: number;
  readonly frontFoot: AimRelativeAnchor;
  readonly backFoot: AimRelativeAnchor;
  /** Normalized hard-haft spacing. It is ignored unless the resolver selects hard 2H geometry. */
  readonly gripSpacing: number;
}

interface MutableWeaponPoseSpec extends Omit<WeaponPoseSpec, "family" | "offHandVerb"> {
  family: WeaponPoseFamily;
  offHandVerb: OffHandVerb;
}

function freezeAnchor(anchor: AimRelativeAnchor): AimRelativeAnchor {
  return Object.freeze(anchor);
}

function poseSpec(spec: MutableWeaponPoseSpec): WeaponPoseSpec {
  return Object.freeze({
    ...spec,
    idle: freezeAnchor(spec.idle),
    moveTighten: freezeAnchor(spec.moveTighten),
    anticipation: freezeAnchor(spec.anticipation),
    active: freezeAnchor(spec.active),
    recovery: freezeAnchor(spec.recovery),
    frontFoot: freezeAnchor(spec.frontFoot),
    backFoot: freezeAnchor(spec.backFoot),
  });
}

/** Frozen, body-height-normalized family equilibria. Attack owners still compose after this table. */
export const WEAPON_POSE_SPECS: Readonly<Record<WeaponPoseFamily, WeaponPoseSpec>> = Object.freeze({
  "one-hand-blade": poseSpec({
    family: "one-hand-blade",
    offHandVerb: "oppose",
    idle: { forward: -0.07, lateral: 0.17 },
    moveTighten: { forward: -0.045, lateral: 0.128 },
    anticipation: { forward: 0.025, lateral: 0.095 },
    active: { forward: -0.075, lateral: 0.205 },
    recovery: { forward: -0.085, lateral: 0.21 },
    offHandBlend: 0.86,
    microForward: 0.006,
    microLateral: 0.018,
    microHz: 0.62,
    bodyForward: 0,
    bodyLateral: 0.008,
    bodyTurn: 0.045,
    frontFoot: { forward: 0.05, lateral: 0.018 },
    backFoot: { forward: -0.05, lateral: -0.05 },
    gripSpacing: 0.42,
  }),
  "close-blade": poseSpec({
    family: "close-blade",
    offHandVerb: "ward",
    idle: { forward: 0.12, lateral: 0.1 },
    moveTighten: { forward: 0.115, lateral: 0.09 },
    anticipation: { forward: 0.135, lateral: 0.085 },
    active: { forward: 0.12, lateral: 0.1 },
    recovery: { forward: 0.13, lateral: 0.09 },
    offHandBlend: 0.92,
    microForward: 0.015,
    microLateral: 0.004,
    microHz: 0.68,
    bodyForward: 0.018,
    bodyLateral: 0,
    bodyTurn: 0.025,
    frontFoot: { forward: 0.055, lateral: 0.055 },
    backFoot: { forward: -0.07, lateral: -0.065 },
    gripSpacing: 0.42,
  }),
  "one-hand-blunt": poseSpec({
    family: "one-hand-blunt",
    offHandVerb: "guard",
    idle: { forward: 0.035, lateral: 0.11 },
    moveTighten: { forward: 0.045, lateral: 0.095 },
    anticipation: { forward: 0.055, lateral: 0.075 },
    active: { forward: -0.065, lateral: 0.1 },
    recovery: { forward: 0.01, lateral: 0.133 },
    offHandBlend: 0.91,
    microForward: 0.004,
    microLateral: 0.012,
    microHz: 0.74,
    bodyForward: 0.008,
    bodyLateral: 0,
    bodyTurn: 0.018,
    frontFoot: { forward: 0.035, lateral: 0.07 },
    backFoot: { forward: -0.08, lateral: -0.075 },
    gripSpacing: 0.42,
  }),
  fists: poseSpec({
    family: "fists",
    offHandVerb: "guard",
    idle: { forward: 0.065, lateral: 0.145 },
    moveTighten: { forward: 0.08, lateral: 0.13 },
    anticipation: { forward: 0.075, lateral: 0.115 },
    active: { forward: 0.055, lateral: 0.12 },
    recovery: { forward: 0.075, lateral: 0.14 },
    offHandBlend: 0.94,
    microForward: 0.006,
    microLateral: 0.015,
    microHz: 0.78,
    bodyForward: 0.012,
    bodyLateral: 0,
    bodyTurn: 0,
    frontFoot: { forward: 0.035, lateral: 0.08 },
    backFoot: { forward: -0.035, lateral: -0.08 },
    gripSpacing: 0.42,
  }),
  pistol: poseSpec({
    family: "pistol",
    offHandVerb: "recoil-catch",
    idle: { forward: 0.04, lateral: 0.12 },
    moveTighten: { forward: 0.06, lateral: 0.092 },
    anticipation: { forward: 0.065, lateral: 0.095 },
    active: { forward: 0.105, lateral: 0.058 },
    recovery: { forward: 0.055, lateral: 0.105 },
    offHandBlend: 0.92,
    microForward: 0.004,
    microLateral: 0.01,
    microHz: 0.61,
    bodyForward: 0.008,
    bodyLateral: 0,
    bodyTurn: 0.025,
    frontFoot: { forward: 0.04, lateral: 0.025 },
    backFoot: { forward: -0.06, lateral: -0.04 },
    gripSpacing: 0.34,
  }),
  "fist-gun": poseSpec({
    family: "fist-gun",
    offHandVerb: "guard",
    idle: { forward: 0.075, lateral: 0.15 },
    moveTighten: { forward: 0.09, lateral: 0.13 },
    anticipation: { forward: 0.095, lateral: 0.12 },
    active: { forward: 0.06, lateral: 0.135 },
    recovery: { forward: 0.075, lateral: 0.155 },
    offHandBlend: 0.94,
    microForward: 0.006,
    microLateral: 0.012,
    microHz: 0.82,
    bodyForward: 0.006,
    bodyLateral: 0,
    bodyTurn: 0,
    frontFoot: { forward: 0.025, lateral: 0.09 },
    backFoot: { forward: -0.025, lateral: -0.09 },
    gripSpacing: 0.42,
  }),
  "long-gun": poseSpec({
    family: "long-gun",
    offHandVerb: "support",
    idle: { forward: 0.105, lateral: 0.105 },
    moveTighten: { forward: 0.115, lateral: 0.09 },
    anticipation: { forward: 0.13, lateral: 0.078 },
    active: { forward: 0.142, lateral: 0.072 },
    recovery: { forward: 0.112, lateral: 0.1 },
    offHandBlend: 0.95,
    microForward: 0.01,
    microLateral: 0.003,
    microHz: 0.72,
    bodyForward: 0.014,
    bodyLateral: 0,
    bodyTurn: 0.035,
    frontFoot: { forward: 0.055, lateral: 0.065 },
    backFoot: { forward: -0.095, lateral: -0.075 },
    gripSpacing: 0.36,
  }),
  thrown: poseSpec({
    family: "thrown",
    offHandVerb: "spot",
    idle: { forward: 0.145, lateral: 0.07 },
    moveTighten: { forward: 0.135, lateral: 0.06 },
    anticipation: { forward: 0.175, lateral: 0.065 },
    active: { forward: 0.035, lateral: 0.075 },
    recovery: { forward: 0.115, lateral: 0.13 },
    offHandBlend: 0.93,
    microForward: 0.018,
    microLateral: 0.006,
    microHz: 0.58,
    bodyForward: 0.015,
    bodyLateral: 0.006,
    bodyTurn: 0.04,
    frontFoot: { forward: 0.08, lateral: 0.04 },
    backFoot: { forward: -0.1, lateral: -0.055 },
    gripSpacing: 0.42,
  }),
  focus: poseSpec({
    family: "focus",
    offHandVerb: "frame",
    idle: { forward: 0.035, lateral: 0.11 },
    moveTighten: { forward: 0.05, lateral: 0.095 },
    anticipation: { forward: 0.03, lateral: 0.135 },
    active: { forward: 0.085, lateral: 0.145 },
    recovery: { forward: 0.02, lateral: 0.135 },
    offHandBlend: 0.89,
    microForward: 0.012,
    microLateral: 0.02,
    microHz: 0.65,
    bodyForward: 0.006,
    bodyLateral: 0,
    bodyTurn: 0.012,
    frontFoot: { forward: 0.015, lateral: 0.045 },
    backFoot: { forward: -0.015, lateral: -0.045 },
    gripSpacing: 0.38,
  }),
  tome: poseSpec({
    family: "tome",
    offHandVerb: "page",
    idle: { forward: 0.035, lateral: 0.1 },
    moveTighten: { forward: 0.04, lateral: 0.085 },
    anticipation: { forward: 0.085, lateral: 0.075 },
    active: { forward: 0.18, lateral: 0.105 },
    recovery: { forward: 0.025, lateral: 0.115 },
    offHandBlend: 0.95,
    microForward: 0.012,
    microLateral: 0.015,
    microHz: 0.6,
    bodyForward: 0.004,
    bodyLateral: 0,
    bodyTurn: 0,
    frontFoot: { forward: 0.005, lateral: 0.06 },
    backFoot: { forward: -0.005, lateral: -0.06 },
    gripSpacing: 0.42,
  }),
  "two-hand-sword": poseSpec({
    family: "two-hand-sword",
    offHandVerb: "hard-grip",
    idle: { forward: 0, lateral: 0 },
    moveTighten: { forward: 0, lateral: 0 },
    anticipation: { forward: 0, lateral: 0 },
    active: { forward: 0, lateral: 0 },
    recovery: { forward: 0, lateral: 0 },
    offHandBlend: 0,
    microForward: 0.008,
    microLateral: 0,
    microHz: 0.54,
    bodyForward: 0.006,
    bodyLateral: 0.01,
    bodyTurn: 0.035,
    frontFoot: { forward: 0.08, lateral: 0.075 },
    backFoot: { forward: -0.1, lateral: -0.08 },
    gripSpacing: 0.42,
  }),
  "two-hand-heavy": poseSpec({
    family: "two-hand-heavy",
    offHandVerb: "hard-grip",
    idle: { forward: 0, lateral: 0 },
    moveTighten: { forward: 0, lateral: 0 },
    anticipation: { forward: 0, lateral: 0 },
    active: { forward: 0, lateral: 0 },
    recovery: { forward: 0, lateral: 0 },
    offHandBlend: 0,
    microForward: 0.012,
    microLateral: 0,
    microHz: 0.48,
    bodyForward: 0.004,
    bodyLateral: 0,
    bodyTurn: 0.018,
    frontFoot: { forward: 0.055, lateral: 0.09 },
    backFoot: { forward: -0.12, lateral: -0.095 },
    gripSpacing: 0.48,
  }),
  polearm: poseSpec({
    family: "polearm",
    offHandVerb: "support",
    idle: { forward: -0.15, lateral: 0.085 },
    moveTighten: { forward: -0.13, lateral: 0.075 },
    anticipation: { forward: -0.175, lateral: 0.08 },
    active: { forward: -0.105, lateral: 0.065 },
    recovery: { forward: -0.17, lateral: 0.09 },
    offHandBlend: 0.96,
    microForward: 0.01,
    microLateral: 0.002,
    microHz: 0.56,
    bodyForward: 0.008,
    bodyLateral: 0.012,
    bodyTurn: 0.06,
    frontFoot: { forward: 0.1, lateral: 0.065 },
    backFoot: { forward: -0.12, lateral: -0.085 },
    gripSpacing: 0.46,
  }),
});

const PISTOL_CLASP_SPEC = poseSpec({
  ...WEAPON_POSE_SPECS.pistol,
  family: "pistol",
  offHandVerb: "support",
  idle: { forward: -0.025, lateral: 0.14 },
  moveTighten: { forward: 0, lateral: 0.11 },
  anticipation: { forward: 0.06, lateral: 0.075 },
  active: { forward: 0.185, lateral: 0.035 },
  recovery: { forward: -0.03, lateral: 0.15 },
  offHandBlend: 0.91,
  microForward: 0.005,
  microLateral: 0.014,
});

const ONE_HAND_BLADE_CHEST_GUARD_SPEC = poseSpec({
  ...WEAPON_POSE_SPECS["one-hand-blade"],
  family: "one-hand-blade",
  offHandVerb: "guard",
  idle: { forward: 0.035, lateral: 0.115 },
  moveTighten: { forward: 0.045, lateral: 0.095 },
  anticipation: { forward: 0.055, lateral: 0.078 },
  active: { forward: -0.035, lateral: 0.105 },
  recovery: { forward: 0.015, lateral: 0.13 },
  offHandBlend: 0.92,
  microForward: 0.004,
  microLateral: 0.012,
});

const RAPIER_DUELIST_SPEC = poseSpec({
  ...WEAPON_POSE_SPECS["one-hand-blade"],
  family: "one-hand-blade",
  offHandVerb: "oppose",
  idle: { forward: -0.045, lateral: 0.145 },
  moveTighten: { forward: -0.03, lateral: 0.11 },
  anticipation: { forward: 0.035, lateral: 0.085 },
  active: { forward: -0.055, lateral: 0.175 },
  recovery: { forward: -0.06, lateral: 0.185 },
  microLateral: 0.014,
  bodyTurn: 0.055,
});

const SCATTER_LAUNCHER_POSE_SPEC = poseSpec({
  ...WEAPON_POSE_SPECS["long-gun"],
  family: "long-gun",
  offHandVerb: "support",
  moveTighten: { forward: 0.12, lateral: 0.086 },
  anticipation: { forward: 0.14, lateral: 0.07 },
  active: { forward: 0.148, lateral: 0.066 },
  microForward: 0.006,
  bodyForward: 0.018,
  frontFoot: { forward: 0.065, lateral: 0.075 },
  backFoot: { forward: -0.115, lateral: -0.085 },
  gripSpacing: 0.35,
});

const RAPID_GUN_POSE_SPEC = poseSpec({
  ...WEAPON_POSE_SPECS["long-gun"],
  family: "long-gun",
  offHandVerb: "support",
  idle: { forward: 0.1, lateral: 0.1 },
  moveTighten: { forward: 0.11, lateral: 0.085 },
  anticipation: { forward: 0.125, lateral: 0.078 },
  active: { forward: 0.138, lateral: 0.072 },
  microForward: 0.008,
  microHz: 0.9,
  bodyForward: 0.012,
  frontFoot: { forward: 0.045, lateral: 0.065 },
  backFoot: { forward: -0.07, lateral: -0.07 },
  gripSpacing: 0.33,
});

const BOOK_FAMILY =
  /^(?:almanac|bestiary|chapbook|codex|compendium|grimoire|ledger|manuscript|psalter|spellbook|tome)$/i;
const FOCUS_FAMILY = /^(?:focus|orb|relic\/totem|rod|scepter|wand)$/i;
const POLEARM_FAMILY = /^(?:glaive|halberd|naginata|partisan|spear|staff)$/i;
const BLADE_FAMILY = /^(?:broadsword|energy-blade|greatsword|katana|nodachi|rapier|saber|sword)$/i;
const BLUNT_FAMILY = /^(?:axe|cleaver|flail|mace|maul|spade|warhammer)$/i;
const RANGED_FAMILY =
  /^(?:blunderbuss|concussion-cannon|exotic-ranged|gun|hand-cannon|heavy-ordnance|lever-rifle|machine-pistol|marksman-rifle|nailgun|pistol|railgun|scrap-cannon|shotgun)$/i;
const CLAW_WORDS = /\b(?:claws?|talons?|rakes?|fangs?)\b/i;
const BLADE_WORDS =
  /\b(?:blade|claymore|greatblade|katana|nodachi|sabre|saber|sword|zweihander)\b/i;
const HEAVY_WORDS = /\b(?:axe|bardiche|cleaver|flail|hammer|maul|spade)\b/i;

export function twoHandedPoseFor(
  def: WeaponDef,
  authority: TwoHandPoseAuthority = DEFAULT_TWO_HAND_POSE_AUTHORITY,
): boolean {
  return authority === "metadata"
    ? def.tags.grip === "2H" || def.twoHanded === true
    : def.twoHanded === true;
}

interface FamilyResolution {
  family: WeaponPoseFamily;
  fallback: boolean;
}

function resolveWeaponPoseFamily(
  def: WeaponDef,
  variants: Readonly<PoseVariantSelection>,
): FamilyResolution {
  const family = def.tags.family.toLowerCase();
  const nameAndFamily = `${family} ${def.name.toLowerCase()}`;
  const hardTwoHanded = twoHandedPoseFor(def, variants.twoHandAuthority);
  const style = swingStyleFor(def);
  const combo = meleeComboSelectionFor(def, style);

  if (def.thrown || def.tags.delivery === "thrown" || family === "thrown" || family === "harpoon") {
    return { family: "thrown", fallback: false };
  }

  const worn = isWornWeapon(def);
  const hasRangedDelivery =
    !!(def.gun || def.beam || def.cast) ||
    def.tags.classPool === "ranged" ||
    /^(?:beam|projectile|spread)$/.test(def.tags.delivery);
  if (hasRangedDelivery && worn) return { family: "fist-gun", fallback: false };

  if (BOOK_FAMILY.test(family)) return { family: "tome", fallback: false };

  const closeBladeShape =
    family === "fist-blade" ||
    combo?.variant === "dagger" ||
    combo?.variant === "claw" ||
    (combo?.family === "rake" && (style === "pivot" || CLAW_WORDS.test(nameAndFamily))) ||
    CLAW_WORDS.test(nameAndFamily);
  if (!hasRangedDelivery && closeBladeShape) {
    return { family: "close-blade", fallback: false };
  }
  if (!hasRangedDelivery && (family === "fist" || combo?.family === "punch" || worn)) {
    return { family: "fists", fallback: false };
  }

  if (hasRangedDelivery || def.tags.classPool === "caster") {
    const firingFamily = firingStanceFamilyFor(def);
    if (firingFamily === "pistol" || firingFamily === "rapid-gun") {
      return {
        family: firingFamily === "pistol" ? "pistol" : "long-gun",
        fallback: !RANGED_FAMILY.test(family) && def.tags.classPool !== "caster",
      };
    }
    if (firingFamily === "fist-gun") return { family: "fist-gun", fallback: false };
    if (firingFamily === "tome") return { family: "tome", fallback: false };
    if (firingFamily === "wand" || FOCUS_FAMILY.test(family)) {
      return { family: "focus", fallback: false };
    }
    if (firingFamily === "staff") {
      return { family: hardTwoHanded ? "polearm" : "focus", fallback: false };
    }
    return {
      family: "long-gun",
      fallback: !RANGED_FAMILY.test(family) && def.tags.classPool !== "caster",
    };
  }

  if (closeBladeShape) {
    return { family: "close-blade", fallback: false };
  }

  if (family === "fist" || combo?.family === "punch" || worn) {
    return { family: "fists", fallback: false };
  }

  if (POLEARM_FAMILY.test(family)) return { family: "polearm", fallback: false };

  if (hardTwoHanded) {
    if (BLADE_FAMILY.test(family) || BLADE_WORDS.test(nameAndFamily)) {
      return { family: "two-hand-sword", fallback: false };
    }
    if (BLUNT_FAMILY.test(family) || family === "exotic-melee" || HEAVY_WORDS.test(nameAndFamily)) {
      return { family: "two-hand-heavy", fallback: false };
    }
    return {
      family: style === "thrust" || style === "orbit" ? "polearm" : "two-hand-heavy",
      fallback: true,
    };
  }

  if (BLADE_FAMILY.test(family) || (family === "exotic-melee" && BLADE_WORDS.test(nameAndFamily))) {
    return { family: "one-hand-blade", fallback: false };
  }
  if (BLUNT_FAMILY.test(family) || family === "exotic-melee") {
    return { family: "one-hand-blunt", fallback: false };
  }

  if (def.tags.classPool === "melee") {
    return { family: style === "thrust" ? "one-hand-blade" : "one-hand-blade", fallback: true };
  }
  return {
    family: def.tags.grip === "1H" || def.tags.grip === "dual" ? "pistol" : "long-gun",
    fallback: true,
  };
}

export interface WeaponPoseResolution {
  readonly family: WeaponPoseFamily;
  readonly usedFallback: boolean;
  readonly hardTwoHanded: boolean;
  readonly beamOverlay: boolean;
  readonly dualOverlay: boolean;
}

export function weaponPoseResolutionFor(
  def: WeaponDef,
  variants: Readonly<PoseVariantSelection> = DEFAULT_POSE_VARIANTS,
): WeaponPoseResolution {
  const resolved = resolveWeaponPoseFamily(def, variants);
  return {
    family: resolved.family,
    usedFallback: resolved.fallback,
    hardTwoHanded: twoHandedPoseFor(def, variants.twoHandAuthority),
    beamOverlay: !!def.beam,
    dualOverlay: def.dual === true || def.tags.grip === "dual",
  };
}

export function weaponPoseFamilyFor(
  def: WeaponDef,
  variants: Readonly<PoseVariantSelection> = DEFAULT_POSE_VARIANTS,
): WeaponPoseFamily {
  return resolveWeaponPoseFamily(def, variants).family;
}

export function weaponPoseSpecFor(
  def: WeaponDef,
  variants: Readonly<PoseVariantSelection> = DEFAULT_POSE_VARIANTS,
): WeaponPoseSpec {
  const family = weaponPoseFamilyFor(def, variants);
  if (family === "pistol" && variants.pistol === "firing-clasp") return PISTOL_CLASP_SPEC;
  if (family === "one-hand-blade" && variants.oneHandBlade === "chest-guard") {
    return ONE_HAND_BLADE_CHEST_GUARD_SPEC;
  }
  if (family === "one-hand-blade" && def.tags.family.toLowerCase() === "rapier") {
    return RAPIER_DUELIST_SPEC;
  }
  if (family === "long-gun") {
    const firingFamily = firingStanceFamilyFor(def);
    if (firingFamily === "scattergun" || firingFamily === "launcher") {
      return SCATTER_LAUNCHER_POSE_SPEC;
    }
    if (firingFamily === "rapid-gun") return RAPID_GUN_POSE_SPEC;
  }
  return WEAPON_POSE_SPECS[family];
}

export type FlourishMoment = "draw" | "stow" | "after-attack" | "idle-settle";
export type FlourishPhase = "anticipation" | "statement" | "catch";
export type BladeSizeClass = "short" | "standard" | "long" | "great" | "colossal";
export const FLOURISH_DUAL_DRAW_ECHO_MS = 50;
export const FLOURISH_DUAL_STOW_ECHO_MS = 45;
export const FLOURISH_DUAL_AFTER_ECHO_MS = 55;

export interface FlourishTiming {
  readonly durationMs: number;
  readonly statementAtMs: number;
  readonly catchAtMs: number;
}

export interface FlourishBeatSpec {
  readonly timing: FlourishTiming;
  /** Signed semantic arc. The sampler deliberately leaves it unwrapped. */
  readonly rotationRad: number;
  readonly overshootRad: number;
  readonly handForward: number;
  readonly handLateral: number;
  readonly bodyForward: number;
  readonly bodyLateral: number;
  readonly bodyTurn: number;
  readonly footForward: number;
  readonly footLateral: number;
  readonly paperHop: number;
  readonly headForwardPx: number;
  readonly headLateralPx: number;
}

export interface WeaponFlourishSpec {
  readonly family: WeaponPoseFamily;
  readonly draw: FlourishBeatSpec;
  readonly stow: FlourishBeatSpec;
  readonly afterAttack: FlourishBeatSpec;
  readonly idleSettle?: FlourishBeatSpec;
  readonly streakThreshold: number;
}

export interface BladeSizeStance {
  readonly sizeClass: BladeSizeClass;
  /** Semantic angle added to aim. Positive great/colossal values put the tip behind the body. */
  readonly restAngleRad: number;
  readonly handForward: number;
  readonly handLateral: number;
  readonly gripSpacing: number;
  readonly bodyForward: number;
  readonly bodyTurn: number;
  readonly frontFootForward: number;
  readonly frontFootLateral: number;
  readonly backFootForward: number;
  readonly backFootLateral: number;
  readonly movementTrailRad: number;
}

function frozenTiming(
  durationMs: number,
  statementAtMs = Math.max(40, Math.round(durationMs * 0.15)),
  catchAtMs = Math.round(durationMs * 0.74),
): FlourishTiming {
  return Object.freeze({ durationMs, statementAtMs, catchAtMs });
}

type BeatAccents = Omit<FlourishBeatSpec, "timing" | "rotationRad" | "overshootRad">;

function flourishBeat(
  durationMs: number,
  rotationRad: number,
  overshootDeg: number,
  accents: BeatAccents,
  statementAtMs?: number,
  catchAtMs?: number,
): FlourishBeatSpec {
  return Object.freeze({
    timing: frozenTiming(durationMs, statementAtMs, catchAtMs),
    rotationRad,
    overshootRad: rotationRad === 0 ? 0 : (overshootDeg * Math.PI) / 180,
    ...accents,
  });
}

const LIGHT_ACCENTS: BeatAccents = Object.freeze({
  handForward: 0.12,
  handLateral: 0.16,
  bodyForward: 0.012,
  bodyLateral: 0.014,
  bodyTurn: 0.055,
  footForward: 0.035,
  footLateral: 0.035,
  paperHop: 0.008,
  headForwardPx: 1.7,
  headLateralPx: 2.1,
});
const CLOSE_ACCENTS: BeatAccents = Object.freeze({
  handForward: 0.1,
  handLateral: 0.1,
  bodyForward: 0.018,
  bodyLateral: 0.01,
  bodyTurn: 0.045,
  footForward: 0.04,
  footLateral: 0.03,
  paperHop: 0,
  headForwardPx: 1.2,
  headLateralPx: 1.6,
});
const HEAVY_ACCENTS: BeatAccents = Object.freeze({
  handForward: 0.18,
  handLateral: 0.12,
  bodyForward: 0.034,
  bodyLateral: 0.018,
  bodyTurn: 0.09,
  footForward: 0.05,
  footLateral: 0.045,
  paperHop: 0.034,
  headForwardPx: 2.4,
  headLateralPx: 2.5,
});
const RANGED_ACCENTS: BeatAccents = Object.freeze({
  handForward: 0.1,
  handLateral: 0.13,
  bodyForward: 0.01,
  bodyLateral: 0.012,
  bodyTurn: 0.05,
  footForward: 0.035,
  footLateral: 0.03,
  paperHop: 0,
  headForwardPx: 1.4,
  headLateralPx: 1.8,
});
const MAGIC_ACCENTS: BeatAccents = Object.freeze({
  handForward: 0.13,
  handLateral: 0.14,
  bodyForward: 0.016,
  bodyLateral: 0.01,
  bodyTurn: 0.04,
  footForward: 0.025,
  footLateral: 0.035,
  paperHop: 0.012,
  headForwardPx: 1.8,
  headLateralPx: 1.7,
});

function flourishSpec(
  family: WeaponPoseFamily,
  durations: readonly [number, number, number, number],
  arcs: readonly [number, number, number],
  accents: BeatAccents,
  threshold = 0,
): WeaponFlourishSpec {
  const drawCuts = family === "tome" ? ([70, 250] as const) : undefined;
  const afterCuts =
    family === "tome"
      ? ([55, 235] as const)
      : family === "pistol"
        ? ([50, 255] as const)
        : undefined;
  return Object.freeze({
    family,
    draw: flourishBeat(
      durations[0],
      arcs[0],
      family === "two-hand-sword" ? 14 : 10,
      accents,
      drawCuts?.[0],
      drawCuts?.[1],
    ),
    stow: flourishBeat(durations[1], arcs[1], 9, accents),
    afterAttack: flourishBeat(
      durations[2],
      arcs[2],
      family === "two-hand-sword" ? 14 : family === "pistol" ? 12 : 11,
      accents,
      afterCuts?.[0],
      afterCuts?.[1],
    ),
    idleSettle: flourishBeat(durations[3], 0, 0, accents),
    streakThreshold: threshold,
  });
}

/** Frozen family punctuation. Radians describe semantic prop travel; hand/body/foot/head accents sell it. */
export const WEAPON_FLOURISH_SPECS: Readonly<Record<WeaponPoseFamily, WeaponFlourishSpec>> =
  Object.freeze({
    "one-hand-blade": flourishSpec(
      "one-hand-blade",
      [300, 155, 360, 220],
      [Math.PI * 1.5, Math.PI * 0.65, Math.PI * 2],
      LIGHT_ACCENTS,
    ),
    "close-blade": flourishSpec(
      "close-blade",
      [235, 135, 290, 190],
      [Math.PI * 0.8, Math.PI * 0.42, Math.PI],
      CLOSE_ACCENTS,
    ),
    "one-hand-blunt": flourishSpec(
      "one-hand-blunt",
      [325, 170, 330, 230],
      [Math.PI * 1.25, Math.PI * 0.45, Math.PI * 1.5],
      HEAVY_ACCENTS,
    ),
    fists: flourishSpec("fists", [210, 120, 250, 180], [0, 0, 0], CLOSE_ACCENTS),
    pistol: flourishSpec(
      "pistol",
      [270, 145, 340, 210],
      [Math.PI * 1.5, Math.PI * 0.45, Math.PI * 2],
      RANGED_ACCENTS,
      3,
    ),
    "fist-gun": flourishSpec("fist-gun", [240, 135, 290, 200], [0, 0, 0], CLOSE_ACCENTS, 4),
    "long-gun": flourishSpec(
      "long-gun",
      [335, 180, 315, 250],
      [Math.PI * 0.52, Math.PI * 0.32, 0],
      RANGED_ACCENTS,
      2,
    ),
    thrown: flourishSpec(
      "thrown",
      [255, 140, 350, 220],
      [Math.PI * 0.65, Math.PI * 0.3, Math.PI],
      LIGHT_ACCENTS,
      1,
    ),
    focus: flourishSpec(
      "focus",
      [280, 150, 320, 240],
      [Math.PI * 0.65, Math.PI * 0.4, 0],
      MAGIC_ACCENTS,
      3,
    ),
    tome: flourishSpec(
      "tome",
      [350, 175, 320, 250],
      [Math.PI, Math.PI * 0.5, Math.PI * 0.55],
      MAGIC_ACCENTS,
      3,
    ),
    "two-hand-sword": flourishSpec(
      "two-hand-sword",
      [360, 190, 440, 290],
      [Math.PI * 1.5, Math.PI * 0.7, Math.PI * 2],
      HEAVY_ACCENTS,
    ),
    "two-hand-heavy": flourishSpec(
      "two-hand-heavy",
      [395, 195, 420, 280],
      [Math.PI * 0.7, Math.PI * 0.42, Math.PI * 1.5],
      HEAVY_ACCENTS,
    ),
    polearm: flourishSpec(
      "polearm",
      [350, 180, 395, 250],
      [Math.PI * 1.35, Math.PI * 0.55, Math.PI * 1.5],
      HEAVY_ACCENTS,
    ),
  });

function retimeBeat(
  beat: FlourishBeatSpec,
  durationMs: number,
  largeAfter = false,
): FlourishBeatSpec {
  return Object.freeze({
    ...beat,
    timing: frozenTiming(
      durationMs,
      largeAfter ? 70 : undefined,
      largeAfter ? Math.round(durationMs * 0.76) : undefined,
    ),
  });
}

function sizedSwordSpec(sizeClass: BladeSizeClass): WeaponFlourishSpec {
  const source = WEAPON_FLOURISH_SPECS["two-hand-sword"];
  const drawDuration = { short: 320, standard: 350, long: 370, great: 390, colossal: 420 }[
    sizeClass
  ];
  const afterDuration = { short: 380, standard: 420, long: 440, great: 460, colossal: 480 }[
    sizeClass
  ];
  return Object.freeze({
    ...source,
    draw: retimeBeat(source.draw, drawDuration),
    afterAttack: retimeBeat(
      source.afterAttack,
      afterDuration,
      sizeClass === "great" || sizeClass === "colossal",
    ),
  });
}

const SIZED_SWORD_FLOURISH_SPECS: Readonly<Record<BladeSizeClass, WeaponFlourishSpec>> =
  Object.freeze({
    short: sizedSwordSpec("short"),
    standard: sizedSwordSpec("standard"),
    long: sizedSwordSpec("long"),
    great: sizedSwordSpec("great"),
    colossal: sizedSwordSpec("colossal"),
  });

function thresholdVariant(source: WeaponFlourishSpec, threshold: number): WeaponFlourishSpec {
  return Object.freeze({ ...source, streakThreshold: threshold });
}

const LONG_GUN_FLOURISH_SPECS = Object.freeze({
  "long-gun": thresholdVariant(WEAPON_FLOURISH_SPECS["long-gun"], 2),
  "rapid-gun": thresholdVariant(WEAPON_FLOURISH_SPECS["long-gun"], 5),
  scattergun: thresholdVariant(WEAPON_FLOURISH_SPECS["long-gun"], 1),
  launcher: thresholdVariant(WEAPON_FLOURISH_SPECS["long-gun"], 1),
});

function beamFlourishSpec(source: WeaponFlourishSpec): WeaponFlourishSpec {
  return Object.freeze({
    ...source,
    afterAttack: Object.freeze({
      ...source.afterAttack,
      rotationRad: 0,
      overshootRad: 0,
    }),
    streakThreshold: 0,
  });
}

const BEAM_FLOURISH_SPECS: Readonly<Record<WeaponPoseFamily, WeaponFlourishSpec>> = Object.freeze({
  "one-hand-blade": beamFlourishSpec(WEAPON_FLOURISH_SPECS["one-hand-blade"]),
  "close-blade": beamFlourishSpec(WEAPON_FLOURISH_SPECS["close-blade"]),
  "one-hand-blunt": beamFlourishSpec(WEAPON_FLOURISH_SPECS["one-hand-blunt"]),
  fists: beamFlourishSpec(WEAPON_FLOURISH_SPECS.fists),
  pistol: beamFlourishSpec(WEAPON_FLOURISH_SPECS.pistol),
  "fist-gun": beamFlourishSpec(WEAPON_FLOURISH_SPECS["fist-gun"]),
  "long-gun": beamFlourishSpec(WEAPON_FLOURISH_SPECS["long-gun"]),
  thrown: beamFlourishSpec(WEAPON_FLOURISH_SPECS.thrown),
  focus: beamFlourishSpec(WEAPON_FLOURISH_SPECS.focus),
  tome: beamFlourishSpec(WEAPON_FLOURISH_SPECS.tome),
  "two-hand-sword": beamFlourishSpec(WEAPON_FLOURISH_SPECS["two-hand-sword"]),
  "two-hand-heavy": beamFlourishSpec(WEAPON_FLOURISH_SPECS["two-hand-heavy"]),
  polearm: beamFlourishSpec(WEAPON_FLOURISH_SPECS.polearm),
});

export const BLADE_SIZE_STANCES: Readonly<Record<BladeSizeClass, BladeSizeStance>> = Object.freeze({
  short: Object.freeze({
    sizeClass: "short",
    restAngleRad: -0.56,
    handForward: -0.015,
    handLateral: 0.15,
    gripSpacing: 0.34,
    bodyForward: 0,
    bodyTurn: 0.03,
    frontFootForward: 0.045,
    frontFootLateral: 0.035,
    backFootForward: -0.045,
    backFootLateral: -0.04,
    movementTrailRad: (7 * Math.PI) / 180,
  }),
  standard: Object.freeze({
    sizeClass: "standard",
    restAngleRad: -0.26,
    handForward: -0.035,
    handLateral: 0.135,
    gripSpacing: 0.38,
    bodyForward: 0.008,
    bodyTurn: 0.05,
    frontFootForward: 0.055,
    frontFootLateral: 0.05,
    backFootForward: -0.065,
    backFootLateral: -0.055,
    movementTrailRad: (10 * Math.PI) / 180,
  }),
  long: Object.freeze({
    sizeClass: "long",
    restAngleRad: -0.1,
    handForward: -0.05,
    handLateral: 0.12,
    gripSpacing: 0.4,
    bodyForward: 0.012,
    bodyTurn: 0.06,
    frontFootForward: 0.05,
    frontFootLateral: 0.058,
    backFootForward: -0.08,
    backFootLateral: -0.065,
    movementTrailRad: (11 * Math.PI) / 180,
  }),
  great: Object.freeze({
    sizeClass: "great",
    restAngleRad: 2.75,
    handForward: -0.075,
    handLateral: 0.105,
    gripSpacing: 0.42,
    bodyForward: 0.018,
    bodyTurn: 0.075,
    frontFootForward: 0.04,
    frontFootLateral: 0.065,
    backFootForward: -0.1,
    backFootLateral: -0.08,
    movementTrailRad: (12 * Math.PI) / 180,
  }),
  colossal: Object.freeze({
    sizeClass: "colossal",
    restAngleRad: 3.02,
    handForward: -0.11,
    handLateral: 0.085,
    gripSpacing: 0.48,
    bodyForward: 0.04,
    bodyTurn: 0.1,
    frontFootForward: 0.025,
    frontFootLateral: 0.075,
    backFootForward: -0.12,
    backFootLateral: -0.09,
    movementTrailRad: (17 * Math.PI) / 180,
  }),
});

/** Canonical migration order: richer tag, explicit Driftblade truth, then the current S/M/L/XL field. */
export function bladeSizeClassFor(def: WeaponDef): BladeSizeClass {
  const tags = def.tags as typeof def.tags & { readonly sizeClass?: BladeSizeClass };
  const explicit = tags.sizeClass;
  if (
    explicit === "short" ||
    explicit === "standard" ||
    explicit === "long" ||
    explicit === "great" ||
    explicit === "colossal"
  )
    return explicit;
  // The parallel catalog generator currently stages this field at WeaponDef root. Accept that emitted
  // shape without weakening the documented tags-first contract.
  const emitted = (def as WeaponDef & { readonly sizeClass?: BladeSizeClass }).sizeClass;
  if (
    emitted === "short" ||
    emitted === "standard" ||
    emitted === "long" ||
    emitted === "great" ||
    emitted === "colossal"
  )
    return emitted;
  if (def.id === "driftblade") return "great";
  switch (tags.size) {
    case "S":
      return "short";
    case "L":
      return "great";
    case "XL":
      return "colossal";
    default:
      return "standard";
  }
}

export function weaponFlourishSpecFor(def: WeaponDef): WeaponFlourishSpec {
  const family = weaponPoseFamilyFor(def);
  let spec = WEAPON_FLOURISH_SPECS[family];
  if (family === "two-hand-sword") spec = SIZED_SWORD_FLOURISH_SPECS[bladeSizeClassFor(def)];
  if (family === "long-gun") {
    const firingFamily = firingStanceFamilyFor(def);
    if (firingFamily in LONG_GUN_FLOURISH_SPECS) {
      spec = LONG_GUN_FLOURISH_SPECS[firingFamily as keyof typeof LONG_GUN_FLOURISH_SPECS];
    }
  }
  return def.beam ? BEAM_FLOURISH_SPECS[spec.family] : spec;
}

export interface FlourishInput {
  spec: FlourishBeatSpec;
  moment: FlourishMoment;
  elapsedMs: number;
  aimLocal: number;
  hand: 0 | 1;
  reducedMotion: boolean;
  rotationSign: -1 | 1;
}

export interface FlourishSample {
  active: boolean;
  phase: FlourishPhase;
  phaseT: number;
  ownership: number;
  settleOnly: boolean;
  /** Unwrapped semantic rotation, including one separately exposed catch overshoot. */
  weaponRotationRad: number;
  catchOvershootRad: number;
  handForward: number;
  handLateral: number;
  supportHandForward: number;
  supportHandLateral: number;
  bodyForward: number;
  bodyLateral: number;
  bodyTurn: number;
  footForward: number;
  footLateral: number;
  paperHop: number;
  headForwardPx: number;
  headLateralPx: number;
  proxyForward: number;
  proxyLateral: number;
  proxyRotationRad: number;
  proxyAlpha: number;
}

export function createFlourishInput(): FlourishInput {
  return {
    spec: WEAPON_FLOURISH_SPECS["one-hand-blade"].draw,
    moment: "draw",
    elapsedMs: -1,
    aimLocal: 0,
    hand: 0,
    reducedMotion: false,
    rotationSign: 1,
  };
}

export function createFlourishSample(): FlourishSample {
  return {
    active: false,
    phase: "anticipation",
    phaseT: 0,
    ownership: 0,
    settleOnly: false,
    weaponRotationRad: 0,
    catchOvershootRad: 0,
    handForward: 0,
    handLateral: 0,
    supportHandForward: 0,
    supportHandLateral: 0,
    bodyForward: 0,
    bodyLateral: 0,
    bodyTurn: 0,
    footForward: 0,
    footLateral: 0,
    paperHop: 0,
    headForwardPx: 0,
    headLateralPx: 0,
    proxyForward: 0,
    proxyLateral: 0,
    proxyRotationRad: 0,
    proxyAlpha: 0,
  };
}

function clearFlourishSample(out: FlourishSample): FlourishSample {
  out.active = false;
  out.phase = "anticipation";
  out.phaseT = 0;
  out.ownership = 0;
  out.settleOnly = false;
  out.weaponRotationRad = 0;
  out.catchOvershootRad = 0;
  out.handForward = 0;
  out.handLateral = 0;
  out.supportHandForward = 0;
  out.supportHandLateral = 0;
  out.bodyForward = 0;
  out.bodyLateral = 0;
  out.bodyTurn = 0;
  out.footForward = 0;
  out.footLateral = 0;
  out.paperHop = 0;
  out.headForwardPx = 0;
  out.headLateralPx = 0;
  out.proxyForward = 0;
  out.proxyLateral = 0;
  out.proxyRotationRad = 0;
  out.proxyAlpha = 0;
  return out;
}

function flourishStatementEase(value: number): number {
  const q = clamp01(value);
  // Strictly increasing: derivative is 1 + .08*pi*cos(pi*q), whose minimum remains positive.
  return q + 0.08 * Math.sin(Math.PI * q);
}

function flourishGestureAt(elapsedMs: number, timing: FlourishTiming): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs < timing.statementAtMs) {
    return -0.35 * smootherstepFlourish(elapsedMs / timing.statementAtMs);
  }
  if (elapsedMs < timing.catchAtMs) {
    const q = (elapsedMs - timing.statementAtMs) / (timing.catchAtMs - timing.statementAtMs);
    return -0.35 + 1.35 * flourishStatementEase(q);
  }
  const fadeAtMs = Math.round(timing.durationMs * 0.82);
  return 1 - smootherstepFlourish((elapsedMs - timing.catchAtMs) / (fadeAtMs - timing.catchAtMs));
}

function smootherstepFlourish(value: number): number {
  const q = clamp01(value);
  return q * q * q * (q * (q * 6 - 15) + 10);
}

function reducedFlourishDuration(moment: FlourishMoment): number {
  switch (moment) {
    case "draw":
      return 120;
    case "stow":
      return 100;
    case "after-attack":
      return 150;
    default:
      return 0;
  }
}

/** Keep one 30 fps frame of exact home placement before spring ownership starts to fade. */
const FLOURISH_HANDOFF_HOME_DWELL_MS = 35;

function nearestFlourishHomeAngle(rotationRad: number): number {
  return Math.round(rotationRad / (Math.PI * 2)) * Math.PI * 2;
}

/**
 * Allocation-free flourish sampler. The statement angle is a single unwrapped monotonic arc; catch adds
 * one overshoot and returns before ownership fades. Reduced motion takes a separate direct-settle path.
 */
export function sampleFlourish(input: FlourishInput, out: FlourishSample): FlourishSample {
  clearFlourishSample(out);
  const { elapsedMs, moment, spec } = input;
  if (elapsedMs < 0) return out;

  if (input.reducedMotion) {
    const durationMs = reducedFlourishDuration(moment);
    if (durationMs === 0 || elapsedMs >= durationMs) return out;
    const q = clamp01(elapsedMs / durationMs);
    const settle = 1 - smootherstepFlourish(q);
    const side = input.hand === 0 ? 1 : -1;
    out.active = true;
    out.phase = "catch";
    out.phaseT = q;
    out.ownership = moment === "stow" ? 0 : q < 0.82 ? 1 : settle;
    out.settleOnly = true;
    out.handForward = -spec.handForward * 0.22 * settle;
    out.handLateral = -spec.handLateral * side * 0.22 * settle;
    out.supportHandForward = spec.handForward * 0.1 * settle;
    out.supportHandLateral = spec.handLateral * side * 0.12 * settle;
    out.bodyForward = -spec.bodyForward * 0.35 * settle;
    out.bodyLateral = -spec.bodyLateral * side * 0.35 * settle;
    out.bodyTurn = -spec.bodyTurn * input.rotationSign * 0.35 * settle;
    out.footForward = spec.footForward * 0.2 * settle;
    out.footLateral = spec.footLateral * side * 0.2 * settle;
    out.proxyForward = -spec.handForward * 0.65 * q;
    out.proxyLateral = -spec.handLateral * side * 0.65 * q;
    out.proxyAlpha = moment === "stow" ? 1 - smootherstepFlourish(q) : 0;
    return out;
  }

  const { timing } = spec;
  if (elapsedMs >= timing.durationMs) return out;
  const fadeAtMs = Math.round(timing.durationMs * 0.82);
  const side = input.hand === 0 ? 1 : -1;
  const sign = input.rotationSign;
  let gesture: number;
  let angle: number;
  let overshoot = 0;

  out.active = true;
  out.proxyAlpha = 1;
  if (elapsedMs < timing.statementAtMs) {
    out.phase = "anticipation";
    out.phaseT = elapsedMs / timing.statementAtMs;
    const q = smootherstepFlourish(out.phaseT);
    gesture = -0.35 * q;
    angle = -spec.rotationRad * 0.06 * q;
  } else if (elapsedMs < timing.catchAtMs) {
    out.phase = "statement";
    out.phaseT = (elapsedMs - timing.statementAtMs) / (timing.catchAtMs - timing.statementAtMs);
    const q = flourishStatementEase(out.phaseT);
    gesture = -0.35 + 1.35 * q;
    angle = -spec.rotationRad * 0.06 + spec.rotationRad * 1.06 * q;
  } else {
    out.phase = "catch";
    out.phaseT = (elapsedMs - timing.catchAtMs) / (timing.durationMs - timing.catchAtMs);
    const exactCatchMs = Math.max(1, fadeAtMs - timing.catchAtMs);
    const catchQ = clamp01((elapsedMs - timing.catchAtMs) / exactCatchMs);
    const homeAngle = nearestFlourishHomeAngle(spec.rotationRad);
    const catchDirection =
      Math.sign(homeAngle - spec.rotationRad) || Math.sign(spec.rotationRad) || 1;
    const signedOvershoot = spec.overshootRad * catchDirection;
    if (catchQ < 0.5) {
      const q = smootherstepFlourish(catchQ * 2);
      angle = spec.rotationRad + (homeAngle + signedOvershoot - spec.rotationRad) * q;
      overshoot = signedOvershoot * q;
    } else {
      const q = 1 - smootherstepFlourish((catchQ - 0.5) * 2);
      angle = homeAngle + signedOvershoot * q;
      overshoot = signedOvershoot * q;
    }
    gesture = 1 - smootherstepFlourish(catchQ);
  }

  const ownershipFadeAtMs = Math.min(
    timing.durationMs - 1,
    fadeAtMs + FLOURISH_HANDOFF_HOME_DWELL_MS,
  );
  const ownershipFade =
    elapsedMs < ownershipFadeAtMs
      ? 1
      : 1 -
        smootherstepFlourish(
          (elapsedMs - ownershipFadeAtMs) / (timing.durationMs - ownershipFadeAtMs),
        );
  out.ownership = moment === "stow" ? 0 : ownershipFade;
  out.weaponRotationRad = (angle + (moment === "idle-settle" ? -angle : 0)) * sign;
  out.catchOvershootRad = overshoot * sign;
  out.handForward = spec.handForward * gesture;
  out.handLateral = spec.handLateral * gesture * side;
  out.supportHandForward = -spec.handForward * gesture * 0.48;
  out.supportHandLateral = spec.handLateral * gesture * side * -0.62;

  const bodyGesture = flourishGestureAt(elapsedMs - 28, timing);
  out.bodyForward = spec.bodyForward * bodyGesture;
  out.bodyLateral = spec.bodyLateral * bodyGesture * side;
  out.bodyTurn = spec.bodyTurn * bodyGesture * sign;
  out.footForward = spec.footForward * bodyGesture;
  out.footLateral = spec.footLateral * bodyGesture * side;
  out.paperHop = spec.paperHop * Math.max(0, bodyGesture);

  const headGesture = flourishGestureAt(elapsedMs - 35, timing);
  let headForward = spec.headForwardPx * headGesture;
  let headLateral =
    spec.headLateralPx *
    side *
    (out.phase === "statement" ? Math.sin(Math.PI * out.phaseT) : headGesture * 0.55);
  const headMagnitude = Math.hypot(headForward, headLateral);
  if (headMagnitude > 3.5) {
    const headScale = 3.5 / headMagnitude;
    headForward *= headScale;
    headLateral *= headScale;
  }
  out.headForwardPx = headForward;
  out.headLateralPx = headLateral;
  out.proxyForward = spec.handForward * gesture;
  out.proxyLateral = spec.handLateral * gesture * side;
  out.proxyRotationRad = out.weaponRotationRad;
  if (moment === "stow") {
    out.proxyAlpha = 1 - smootherstepFlourish(elapsedMs / timing.durationMs);
  }
  return out;
}

export type PoseActionPhase = "idle" | "anticipation" | "active" | "recovery";
export type PoseBeamPhase = "charging" | "active" | "overheated" | "cooling";

export interface PoseLanguageInput {
  spec: WeaponPoseSpec;
  timeS: number;
  gait: number;
  moveAmount: number;
  phase: PoseActionPhase;
  phaseT: number;
  strikingHand: 0 | 1;
  freeHand: 0 | 1 | -1;
  reducedMotion: boolean;
  beamPhase?: PoseBeamPhase;
}

export interface PoseLanguageSample {
  offForward: number;
  offLateral: number;
  offBlend: number;
  offOwn: number;
  bodyForward: number;
  bodyLateral: number;
  bodyTurn: number;
  frontFootForward: number;
  frontFootLateral: number;
  backFootForward: number;
  backFootLateral: number;
  footBlend: number;
  gripSpacing: number;
}

export function createPoseLanguageInput(): PoseLanguageInput {
  return {
    spec: WEAPON_POSE_SPECS["one-hand-blade"],
    timeS: 0,
    gait: 0,
    moveAmount: 0,
    phase: "idle",
    phaseT: 0,
    strikingHand: 0,
    freeHand: 1,
    reducedMotion: false,
  };
}

export function createPoseLanguageSample(): PoseLanguageSample {
  return {
    offForward: 0,
    offLateral: 0,
    offBlend: 0,
    offOwn: 0,
    bodyForward: 0,
    bodyLateral: 0,
    bodyTurn: 0,
    frontFootForward: 0,
    frontFootLateral: 0,
    backFootForward: 0,
    backFootLateral: 0,
    footBlend: 0,
    gripSpacing: 0.42,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function activeOwnershipFor(verb: OffHandVerb): number {
  switch (verb) {
    case "hard-grip":
      return 1;
    default:
      return 1;
  }
}

/** Allocation-free family sampler. Static placement survives reduced motion; only periodic accents vanish. */
export function samplePoseLanguage(
  input: PoseLanguageInput,
  out: PoseLanguageSample,
): PoseLanguageSample {
  const { spec } = input;
  const move = clamp01(Math.max(input.gait, input.moveAmount));
  const phaseT = clamp01(input.phaseT);
  const moveEase = smoothstep01(move);
  const baseForward = mix(spec.idle.forward, spec.moveTighten.forward, moveEase);
  const baseLateral = mix(spec.idle.lateral, spec.moveTighten.lateral, moveEase);
  let offForward = baseForward;
  let offLateral = baseLateral;
  let offOwn = 0;

  if (input.phase === "anticipation") {
    const change = smoothstep01(phaseT);
    offForward = mix(baseForward, spec.anticipation.forward, change);
    offLateral = mix(baseLateral, spec.anticipation.lateral, change);
    offOwn = activeOwnershipFor(spec.offHandVerb) * 0.35 * change;
  } else if (input.phase === "active") {
    const change = smoothstep01(phaseT / 0.35);
    offForward = mix(spec.anticipation.forward, spec.active.forward, change);
    offLateral = mix(spec.anticipation.lateral, spec.active.lateral, change);
    offOwn = activeOwnershipFor(spec.offHandVerb);
  } else if (input.phase === "recovery") {
    const retract = smoothstep01(phaseT);
    offForward = mix(spec.recovery.forward, baseForward, retract);
    offLateral = mix(spec.recovery.lateral, baseLateral, retract);
    offOwn = activeOwnershipFor(spec.offHandVerb) * (1 - smoothstep01(phaseT * 1.16));
  }

  if (input.beamPhase === "charging") {
    offForward += 0.012 * (1 - phaseT);
    offLateral *= 0.84;
    offOwn = Math.max(offOwn, 0.72);
  } else if (input.beamPhase === "active") {
    offForward += 0.015;
    offLateral *= 0.9;
    offOwn = Math.max(offOwn, 0.9);
  } else if (input.beamPhase === "overheated" || input.beamPhase === "cooling") {
    const breakaway = 1 - smoothstep01(phaseT);
    offForward -= 0.018 * breakaway;
    offLateral += 0.05 * breakaway;
    offOwn = Math.max(offOwn, 0.74 * breakaway);
  }

  const hardGrip = spec.offHandVerb === "hard-grip" || input.freeHand < 0;
  const handPhase = input.freeHand === 0 ? Math.PI : 0;
  let microForward = 0;
  let microLateral = 0;
  if (!input.reducedMotion) {
    const omega = input.timeS * Math.PI * 2 * spec.microHz + handPhase;
    const moveSuppression = 1 - move;
    const actionSuppression =
      input.phase === "idle"
        ? 1
        : input.phase === "recovery"
          ? mix(0.45, 1, smoothstep01(phaseT))
          : 0.18;
    const microScale = moveSuppression * actionSuppression;
    if (spec.offHandVerb === "page") {
      const trace = Math.max(0, Math.sin(omega));
      microForward = trace * trace * spec.microForward * microScale;
      microLateral = Math.sin(omega * 0.5) * spec.microLateral * microScale;
    } else if (spec.offHandVerb === "frame") {
      microForward = Math.sin(omega) * spec.microForward * microScale;
      microLateral = Math.cos(omega) * spec.microLateral * microScale;
    } else if (spec.offHandVerb === "support" || spec.offHandVerb === "hard-grip") {
      microForward = Math.sin(omega) * spec.microForward * microScale;
    } else if (spec.offHandVerb === "guard" || spec.offHandVerb === "recoil-catch") {
      microLateral = Math.sin(omega) * spec.microLateral * microScale;
      microForward = Math.cos(omega) * spec.microForward * microScale;
    } else {
      microForward = Math.sin(omega) * spec.microForward * microScale;
      microLateral = Math.cos(omega) * spec.microLateral * microScale;
    }
    if (input.beamPhase === "active") {
      microLateral += Math.sin(omega * 1.7) * Math.min(0.008, spec.microLateral || 0.008);
    }
  }

  const side = input.freeHand === 0 ? 1 : -1;
  out.offForward = offForward + microForward;
  out.offLateral = (offLateral + microLateral) * side;
  out.offBlend = clamp01(hardGrip ? 0 : spec.offHandBlend);
  out.offOwn = clamp01(hardGrip ? 0 : offOwn);

  const actionWeight =
    input.phase === "anticipation"
      ? 0.7 + 0.2 * phaseT
      : input.phase === "active"
        ? 1.25
        : input.phase === "recovery"
          ? mix(1.15, 1, smoothstep01(phaseT))
          : 1;
  out.bodyForward = spec.bodyForward * actionWeight;
  out.bodyLateral = spec.bodyLateral * actionWeight;
  out.bodyTurn = spec.bodyTurn * actionWeight;
  out.frontFootForward = spec.frontFoot.forward;
  out.frontFootLateral = spec.frontFoot.lateral;
  out.backFootForward = spec.backFoot.forward;
  out.backFootLateral = spec.backFoot.lateral;
  out.footBlend = clamp01(input.phase === "active" ? 1 : 0.78 + move * 0.16);
  let gripSpacing = spec.gripSpacing;
  if (hardGrip && input.phase === "anticipation") {
    const loadSlide =
      spec.family === "two-hand-sword" ? 0.04 : spec.family === "polearm" ? 0.035 : 0.025;
    gripSpacing += loadSlide * smoothstep01(phaseT);
  } else if (hardGrip && input.phase === "active") {
    const contactCompression = spec.family === "two-hand-heavy" ? 0.022 : 0.014;
    gripSpacing -= contactCompression * Math.sin(Math.PI * phaseT);
  } else if (hardGrip && input.phase === "recovery") {
    gripSpacing += (spec.family === "polearm" ? 0.025 : 0.018) * (1 - smoothstep01(phaseT));
  }
  out.gripSpacing = Math.max(0.18, gripSpacing + (hardGrip ? microForward : 0));
  return out;
}

export interface AimRelativePoint {
  x: number;
  y: number;
}

/** Determinant-safe local-axis conversion; the container's existing signed scale owns the world flip. */
export function aimRelativePoint(
  forward: number,
  lateral: number,
  aimLocal: number,
  out: AimRelativePoint,
): AimRelativePoint {
  const forwardX = Math.cos(aimLocal);
  const forwardY = Math.sin(aimLocal);
  const sideX = -forwardY;
  const sideY = forwardX;
  out.x = forwardX * forward + sideX * lateral;
  out.y = forwardY * forward + sideY * lateral;
  return out;
}

/** Higher-priority action owners fade only the generic layer; close blades/Crossfall can suppress it fully. */
export function poseBlendUnderOwnership(
  blend: number,
  ownership: number,
  hardSuppressed = false,
): number {
  return hardSuppressed ? 0 : clamp01(blend) * (1 - clamp01(ownership));
}

/** A retained edge timestamp makes recoil catch a one-shot spring impulse, never continuous force. */
export function poseImpulsePending(nowMs: number, edgeMs: number, consumedEdgeMs: number): boolean {
  return edgeMs > -1e8 && nowMs >= edgeMs && edgeMs !== consumedEdgeMs;
}

/** Dual parity assigns the family job to the non-striking hand; hard/both-hand owners have no free hand. */
export function poseSupportHandFor(
  strikingHand: 0 | 1,
  actionActive: boolean,
  hardTwoHanded: boolean,
  bothHandsOwned: boolean,
  pairedAimed: boolean,
): 0 | 1 | -1 {
  if (hardTwoHanded || bothHandsOwned || pairedAimed) return -1;
  return actionActive && strikingHand === 1 ? 0 : 1;
}

export interface PoseShowroomOption {
  readonly value: string;
  readonly label: string;
}

export interface PoseShowroomVariantSet {
  readonly registryKey?: string;
  readonly defaultValue: string;
  readonly options: readonly PoseShowroomOption[];
}

export function nextPoseShowroomOption(
  variants: PoseShowroomVariantSet,
  current: unknown,
): PoseShowroomOption | undefined {
  const currentIndex = variants.options.findIndex((option) => option.value === current);
  if (currentIndex >= 0) return variants.options[(currentIndex + 1) % variants.options.length];
  return (
    variants.options.find((option) => option.value === variants.defaultValue) ?? variants.options[0]
  );
}

const PISTOL_SHOWROOM_SET: PoseShowroomVariantSet = Object.freeze({
  registryKey: POSE_PISTOL_VARIANT_REGISTRY_KEY,
  defaultValue: DEFAULT_PISTOL_POSE_VARIANT,
  options: Object.freeze([
    Object.freeze({ value: "sternum-guard", label: "pistols: sternum guard (A)" }),
    Object.freeze({ value: "firing-clasp", label: "pistols: firing clasp (B)" }),
  ]),
});

const BLADE_SHOWROOM_SET: PoseShowroomVariantSet = Object.freeze({
  registryKey: POSE_ONE_HAND_BLADE_VARIANT_REGISTRY_KEY,
  defaultValue: DEFAULT_ONE_HAND_BLADE_POSE_VARIANT,
  options: Object.freeze([
    Object.freeze({ value: "duelist-wing", label: "1H blades: duelist wing (A)" }),
    Object.freeze({ value: "chest-guard", label: "1H blades: chest guard (B)" }),
  ]),
});

const TWO_HAND_SHOWROOM_SET: PoseShowroomVariantSet = Object.freeze({
  registryKey: POSE_TWO_HAND_AUTHORITY_REGISTRY_KEY,
  defaultValue: DEFAULT_TWO_HAND_POSE_AUTHORITY,
  options: Object.freeze([
    Object.freeze({ value: "metadata", label: "2H authority: metadata grip (A)" }),
    Object.freeze({ value: "art", label: "2H authority: current art (B)" }),
  ]),
});

/** Select the one contested review call that can materially change the currently held weapon. */
export function poseShowroomVariantSetFor(def: WeaponDef): PoseShowroomVariantSet | undefined {
  const twoHandDisagrees = (def.tags.grip === "2H") !== (def.twoHanded === true);
  if (twoHandDisagrees) return TWO_HAND_SHOWROOM_SET;
  const family = weaponPoseFamilyFor(def);
  if (family === "pistol") return PISTOL_SHOWROOM_SET;
  if (family === "one-hand-blade") return BLADE_SHOWROOM_SET;
  if (def.tags.grip === "2H" || def.twoHanded) return TWO_HAND_SHOWROOM_SET;
  return undefined;
}
