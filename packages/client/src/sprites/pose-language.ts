import {
  type IdleFootPose,
  type IdleHandPose,
  isWornWeapon,
  type MeleeComboFamily,
  type MeleeComboMotion,
  type MeleeComboStep,
  meleeComboSelectionFor,
  resolvedGunGripPoints,
  type SwingStyle,
  swingStyleFor,
  type WeaponDef,
  type WeaponStanceId,
  weaponHasHandlingTag,
} from "@dd/shared";
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

export type HandSemanticRole =
  | "hard-constrained"
  | "action-owned"
  | "recovering"
  | "authored-idle"
  | "absent-replaced"
  | "explicit-test-failure";

export const FACING_SIDE_FLOOR_BODY_FRAC = 0.03;

export interface IdleHandPoseSpec {
  readonly pose: IdleHandPose;
  /** Absolute canonical facing-local X, normalized by body height. */
  readonly facingX: number;
  /** Screen Y relative to the body, normalized by body height. */
  readonly screenY: number;
  /** Optional rear-hand silhouette; omitted keeps the ordinary shared placement. */
  readonly offFacingX?: number;
  readonly offScreenY?: number;
  /** Worn-hand art rotations used only by the two martial idle silhouettes. */
  readonly leadAngleRad?: number;
  readonly offAngleRad?: number;
  readonly aimBiasX: number;
  readonly aimBiasY: number;
  readonly movementScale: number;
}

function idleHandSpec(spec: IdleHandPoseSpec): IdleHandPoseSpec {
  return Object.freeze(spec);
}

/** Neutral hand vocabulary. `secondary-grip` is a semantic hard constraint, never a free target. */
export const IDLE_HAND_POSE_SPECS: Readonly<Record<IdleHandPose, IdleHandPoseSpec>> = Object.freeze(
  {
    "secondary-grip": idleHandSpec({
      pose: "secondary-grip",
      facingX: 0.03,
      screenY: 0,
      aimBiasX: 0,
      aimBiasY: 0,
      movementScale: 0,
    }),
    "mirror-guard": idleHandSpec({
      pose: "mirror-guard",
      facingX: 0.51,
      screenY: -0.13,
      aimBiasX: 0.012,
      aimBiasY: 0.018,
      movementScale: 0.42,
    }),
    "boxer-guard": idleHandSpec({
      pose: "boxer-guard",
      facingX: 0.48,
      screenY: -0.24,
      offFacingX: 0.32,
      offScreenY: -0.19,
      leadAngleRad: 0.18,
      offAngleRad: -0.14,
      aimBiasX: 0.006,
      aimBiasY: 0.008,
      movementScale: 0.24,
    }),
    "low-guard": idleHandSpec({
      pose: "low-guard",
      facingX: 0.52,
      screenY: 0.035,
      aimBiasX: 0.01,
      aimBiasY: 0.012,
      movementScale: 0.5,
    }),
    "casting-gesture": idleHandSpec({
      pose: "casting-gesture",
      facingX: 0.52,
      screenY: -0.055,
      aimBiasX: 0.014,
      aimBiasY: 0.024,
      movementScale: 0.35,
    }),
    "hip-rest": idleHandSpec({
      pose: "hip-rest",
      facingX: 0.5,
      screenY: 0.13,
      aimBiasX: 0.006,
      aimBiasY: 0.006,
      movementScale: 0.28,
    }),
    "praying-mantis": idleHandSpec({
      pose: "praying-mantis",
      facingX: 0.49,
      screenY: -0.28,
      offFacingX: 0.25,
      offScreenY: -0.08,
      leadAngleRad: 1.02,
      offAngleRad: -0.72,
      aimBiasX: 0,
      aimBiasY: 0,
      movementScale: 0.24,
    }),
    "crane-guard": idleHandSpec({
      pose: "crane-guard",
      facingX: 0.48,
      screenY: -0.24,
      offFacingX: 0.29,
      offScreenY: -0.17,
      leadAngleRad: 0.58,
      offAngleRad: -0.48,
      aimBiasX: 0,
      aimBiasY: 0,
      movementScale: 0.22,
    }),
  },
);

export interface IdleFootPoseSpec {
  readonly pose: IdleFootPose;
  readonly frontX: number;
  readonly frontY: number;
  readonly backX: number;
  readonly backY: number;
  readonly gaitFade: number;
}

export const IDLE_FOOT_POSE_SPECS: Readonly<Record<IdleFootPose, IdleFootPoseSpec>> = Object.freeze(
  {
    "loose-plant": Object.freeze({
      pose: "loose-plant",
      frontX: 0.025,
      frontY: 0.035,
      backX: -0.025,
      backY: -0.035,
      gaitFade: 0.68,
    }),
    "combat-plant": Object.freeze({
      pose: "combat-plant",
      frontX: 0.055,
      frontY: 0.06,
      backX: -0.075,
      backY: -0.07,
      gaitFade: 0.58,
    }),
    "wide-plant": Object.freeze({
      pose: "wide-plant",
      frontX: 0.085,
      frontY: 0.075,
      backX: -0.11,
      backY: -0.09,
      gaitFade: 0.5,
    }),
    "crane-one-leg": Object.freeze({
      pose: "crane-one-leg",
      frontX: 0.12,
      frontY: -0.48,
      backX: -0.08,
      backY: 0.02,
      gaitFade: 0.8,
    }),
  },
);

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
const FAN_FAMILY = /^(?:paired-war-fan|war-fan)$/i;
const BLADE_FAMILY = /^(?:broadsword|energy-blade|greatsword|katana|nodachi|rapier|saber|sword)$/i;
const BLUNT_FAMILY = /^(?:axe|cleaver|flail|mace|maul|spade|warhammer)$/i;
const RANGED_FAMILY =
  /^(?:auto-rifle|blunderbuss|concussion-cannon|exotic-ranged|grenade-launcher|gun|hand-cannon|heavy-ordnance|lever-rifle|machine-pistol|marksman-rifle|nailgun|pistol|railgun|scrap-cannon|shotgun)$/i;
const CLAW_WORDS = /\b(?:claws?|talons?|rakes?|fangs?)\b/i;
const BLADE_WORDS =
  /\b(?:blade|claymore|greatblade|katana|nodachi|sabre|saber|sword|zweihander)\b/i;
const HEAVY_WORDS = /\b(?:axe|bardiche|cleaver|flail|hammer|maul|spade)\b/i;

export function twoHandedPoseFor(
  def: WeaponDef,
  authority: TwoHandPoseAuthority = DEFAULT_TWO_HAND_POSE_AUTHORITY,
): boolean {
  // A glove pair occupies the 2H equipment slot but still mounts one independent part on each hand.
  if (def.glovePair) return false;
  // Ranged grip metadata is physical muzzle geometry, not an art-style preference. In particular,
  // generated 2H guns synthesize a support grip from this tag, so the pose must consume that grip too.
  if (def.gun || def.beam) {
    return def.tags.grip === "2H" || def.tags.grip === "mounted" || def.twoHanded === true;
  }
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
  if (FAN_FAMILY.test(family)) return { family: "two-hand-sword", fallback: false };

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

export interface IdleHandPoseResolution {
  readonly pose: IdleHandPose;
  readonly usedFallback: boolean;
}

/** Family defaults cover the live catalog; `usedFallback` is reserved as an explicit authoring alarm. */
export function idleHandPoseResolutionFor(def: WeaponDef): IdleHandPoseResolution {
  if (def.poseLanguage?.idle) return { pose: def.poseLanguage.idle, usedFallback: false };
  const resolution = weaponPoseResolutionFor(def);
  if (resolution.hardTwoHanded) return { pose: "secondary-grip", usedFallback: false };
  switch (resolution.family) {
    case "one-hand-blade":
    case "close-blade":
      return { pose: "mirror-guard", usedFallback: false };
    case "one-hand-blunt":
    case "pistol":
    case "thrown":
    case "long-gun":
      return { pose: "low-guard", usedFallback: false };
    case "focus":
    case "tome":
    case "fist-gun":
      return { pose: "casting-gesture", usedFallback: false };
    case "two-hand-sword":
    case "two-hand-heavy":
    case "polearm":
      return { pose: "secondary-grip", usedFallback: false };
    case "fists":
      // Both hands are equipment surfaces, so this named resolution is diagnostic-only and never applied.
      return { pose: "low-guard", usedFallback: false };
    default:
      return { pose: "low-guard", usedFallback: true };
  }
}

export function idleHandPoseFor(def: WeaponDef): IdleHandPose {
  return idleHandPoseResolutionFor(def).pose;
}

export function idleFootPoseFor(def: WeaponDef): IdleFootPose {
  if (def.poseLanguage?.feet) return def.poseLanguage.feet;
  switch (weaponPoseFamilyFor(def)) {
    case "pistol":
    case "fist-gun":
    case "focus":
    case "tome":
    case "fists":
      return "loose-plant";
    case "two-hand-sword":
    case "two-hand-heavy":
      return "wide-plant";
    default:
      return "combat-plant";
  }
}

export interface HandSemanticFrameState {
  readonly phase: PoseActionPhase;
  readonly phaseT: number;
  readonly strikingHand?: 0 | 1;
  readonly dualEquipped?: boolean;
  readonly pairedAimed?: boolean;
  readonly bothHandsOwned?: boolean;
  readonly actionOwnedHands?: readonly [boolean, boolean];
  readonly visibleHands?: readonly [boolean, boolean];
  readonly replacedHands?: readonly [boolean, boolean];
}

/** Exhaustive, priority-ordered semantic classification for every rendered hand. */
export function classifyHandRole(
  def: WeaponDef | undefined,
  frame: HandSemanticFrameState,
  hand: 0 | 1,
): HandSemanticRole {
  if (frame.visibleHands?.[hand] === false || frame.replacedHands?.[hand] === true) {
    return "absent-replaced";
  }

  const terminalRecovery = frame.phase === "recovery" && frame.phaseT >= 1;
  const thrownAction = !!def?.thrown && frame.phase !== "idle" && !terminalRecovery;
  if (thrownAction) {
    return frame.phase === "recovery" ? "recovering" : "action-owned";
  }

  // A true 1H worn weapon occupies one hand regardless of whether its idle pose was explicitly authored.
  // Treating the entire `fists` family as paired left the free hand on an unowned manifest socket.
  const singleWornGlove =
    !!def &&
    def.glovePair === undefined &&
    def.dual !== true &&
    def.tags.grip === "1H" &&
    frame.dualEquipped !== true &&
    frame.pairedAimed !== true &&
    isWornWeapon(def) &&
    weaponPoseFamilyFor(def) === "fists";
  if (singleWornGlove) {
    if (hand === 1) return "authored-idle";
    if (frame.phase === "idle" || terminalRecovery) return "hard-constrained";
    return frame.phase === "recovery" ? "recovering" : "action-owned";
  }

  const paired =
    frame.dualEquipped === true ||
    frame.pairedAimed === true ||
    def?.dual === true ||
    def?.tags.grip === "dual" ||
    def?.glovePair !== undefined;
  const hardTwoHanded = !!def && twoHandedPoseFor(def);
  const hasPhysicalSecondary =
    !!def && (hardTwoHanded || resolvedGunGripPoints(def)?.secondary !== undefined);
  if (paired || (hand === 0 && !!def) || (hand === 1 && hasPhysicalSecondary)) {
    return "hard-constrained";
  }

  if (frame.bothHandsOwned || frame.actionOwnedHands?.[hand]) return "action-owned";
  if (frame.phase === "anticipation" || frame.phase === "active") return "action-owned";
  if (frame.phase === "recovery" && !terminalRecovery) return "recovering";
  if (frame.phase === "idle" || terminalRecovery) return "authored-idle";
  return "explicit-test-failure";
}

export interface IdleHandTargetInput {
  readonly bodyX: number;
  readonly bodyY: number;
  readonly bodyHeight: number;
  readonly aimLocal: number;
  readonly movementX?: number;
  readonly movementY?: number;
  readonly microX?: number;
  readonly microY?: number;
  /** Real manifest evidence is accepted deliberately but cannot influence the absolute target. */
  readonly manifestSocketX?: number;
  /** Facing-local hand identity. Martial silhouettes use distinct hooked/guarded targets. */
  readonly hand?: 0 | 1;
  readonly recoveryT?: number;
  readonly recoveryForward?: number;
  readonly recoveryLateral?: number;
}

export interface IdleHandTarget {
  x: number;
  y: number;
}

/** Absolute canonical target. Movement/micro-motion compose first; the facing-side floor clamps last. */
export function resolveIdleHandTarget(
  def: WeaponDef,
  input: IdleHandTargetInput,
  out: IdleHandTarget,
): IdleHandTarget {
  const spec = IDLE_HAND_POSE_SPECS[idleHandPoseFor(def)];
  const offHand = input.hand === 1;
  const facingX = offHand ? (spec.offFacingX ?? spec.facingX) : spec.facingX;
  const screenY = offHand ? (spec.offScreenY ?? spec.screenY) : spec.screenY;
  const aimCos = Math.cos(input.aimLocal);
  const aimSin = Math.sin(input.aimLocal);
  let targetX =
    input.bodyX +
    (facingX + aimCos * spec.aimBiasX) * input.bodyHeight +
    (input.movementX ?? 0) * spec.movementScale +
    (input.microX ?? 0);
  let targetY =
    input.bodyY +
    (screenY + aimSin * spec.aimBiasY) * input.bodyHeight +
    (input.movementY ?? 0) * spec.movementScale +
    (input.microY ?? 0);

  if (
    input.recoveryT !== undefined &&
    input.recoveryT < 1 &&
    input.recoveryForward !== undefined &&
    input.recoveryLateral !== undefined
  ) {
    const t = smoothstep01(input.recoveryT);
    const recovery = aimRelativePoint(
      input.recoveryForward,
      input.recoveryLateral,
      input.aimLocal,
      { x: 0, y: 0 },
    );
    targetX = mix(input.bodyX + recovery.x * input.bodyHeight, targetX, t);
    targetY = mix(input.bodyY + recovery.y * input.bodyHeight, targetY, t);
  }

  targetX = Math.max(input.bodyX + FACING_SIDE_FLOOR_BODY_FRAC * input.bodyHeight + 1e-9, targetX);
  out.x = targetX;
  out.y = targetY;
  return out;
}

export function isMartialIdleHandPose(
  pose: IdleHandPose | undefined,
): pose is "boxer-guard" | "praying-mantis" | "crane-guard" {
  return pose === "boxer-guard" || pose === "praying-mantis" || pose === "crane-guard";
}

export function martialIdleHandAngleFor(
  def: WeaponDef | undefined,
  hand: 0 | 1,
): number | undefined {
  const pose = def?.poseLanguage?.idle;
  if (!isMartialIdleHandPose(pose)) return undefined;
  const spec = IDLE_HAND_POSE_SPECS[pose];
  return hand === 0 ? spec.leadAngleRad : spec.offAngleRad;
}

export interface FootPoseOffset {
  x: number;
  y: number;
}

/** Exactly one neutral profile contributes a bounded posture bias; named stances replace this selection. */
export function resolveFootPoseOffset(
  pose: IdleFootPose,
  front: boolean,
  gait: number,
  bodyHeight: number,
  out: FootPoseOffset,
): FootPoseOffset {
  const spec = IDLE_FOOT_POSE_SPECS[pose];
  const blend = 1 - clamp01(gait) * spec.gaitFade;
  out.x = (front ? spec.frontX : spec.backX) * bodyHeight * blend;
  out.y = (front ? spec.frontY : spec.backY) * bodyHeight * blend;
  return out;
}

export type FlourishMoment = "draw" | "stow" | "after-attack" | "idle-settle";
export type FlourishPhase = "anticipation" | "statement" | "catch";
export type BladeSizeClass = "short" | "standard" | "long" | "great" | "colossal";

export type MovementPostureKey = "sword" | "gunner" | "caster" | "weighted";

/**
 * Presentation-only walk vocabulary. Distances are rig-local pixels at 1x body scale; rotations are radians.
 * The class-pool table is the base truth, while genuinely large implements resolve to the weighted overlay.
 */
export interface MovementPostureSpec {
  readonly key: MovementPostureKey;
  readonly strideLengthPx: number;
  readonly bodyBobPx: number;
  readonly bodyStepDipPx: number;
  readonly bodyBounceX: number;
  readonly bodyBounceY: number;
  readonly runLeanRad: number;
  readonly inertiaLeanRad: number;
  readonly counterLeanRad: number;
  readonly handSwingPx: number;
  readonly handBobPx: number;
  readonly handTrailXPx: number;
  readonly handTrailYPx: number;
  readonly weaponCarryForwardPx: number;
  readonly weaponCarryUpPx: number;
  readonly weaponTrailSwayPx: number;
  readonly footStridePx: number;
  readonly footLiftPx: number;
  readonly footTrailXPx: number;
  readonly footTrailYPx: number;
  readonly footPivotRad: number;
  readonly headBobPx: number;
}

function movementPosture(spec: MovementPostureSpec): MovementPostureSpec {
  return Object.freeze(spec);
}

/** One authored posture per shared classPool. No weapon id enters the walk-cycle implementation. */
export const CLASS_POOL_MOVEMENT_POSTURES: Readonly<
  Record<WeaponDef["tags"]["classPool"], MovementPostureSpec>
> = Object.freeze({
  melee: movementPosture({
    key: "sword",
    strideLengthPx: 142,
    bodyBobPx: 7.5,
    bodyStepDipPx: 1.1,
    bodyBounceX: 0.03,
    bodyBounceY: 0.045,
    runLeanRad: 0.17,
    inertiaLeanRad: 0.28,
    counterLeanRad: 0.075,
    handSwingPx: 8.5,
    handBobPx: 1.6,
    handTrailXPx: 29,
    handTrailYPx: 23,
    weaponCarryForwardPx: 0,
    weaponCarryUpPx: 0,
    weaponTrailSwayPx: 0.8,
    footStridePx: 12,
    footLiftPx: 15,
    footTrailXPx: 18,
    footTrailYPx: 10,
    footPivotRad: 0.13,
    headBobPx: 0.9,
  }),
  ranged: movementPosture({
    key: "gunner",
    strideLengthPx: 166,
    bodyBobPx: 4.2,
    bodyStepDipPx: 0.4,
    bodyBounceX: 0.016,
    bodyBounceY: 0.024,
    runLeanRad: 0.09,
    inertiaLeanRad: 0.16,
    counterLeanRad: 0,
    handSwingPx: 3.8,
    handBobPx: 0.8,
    handTrailXPx: 16,
    handTrailYPx: 13,
    weaponCarryForwardPx: 5.5,
    weaponCarryUpPx: 1.4,
    weaponTrailSwayPx: 2.1,
    footStridePx: 8,
    footLiftPx: 9,
    footTrailXPx: 12,
    footTrailYPx: 7,
    footPivotRad: 0.065,
    headBobPx: 0.6,
  }),
  caster: movementPosture({
    key: "caster",
    strideLengthPx: 150,
    bodyBobPx: 6.2,
    bodyStepDipPx: 0.6,
    bodyBounceX: 0.022,
    bodyBounceY: 0.034,
    runLeanRad: 0.075,
    inertiaLeanRad: 0.18,
    counterLeanRad: 0.018,
    handSwingPx: 5.2,
    handBobPx: 1.8,
    handTrailXPx: 20,
    handTrailYPx: 17,
    weaponCarryForwardPx: -3.2,
    weaponCarryUpPx: 2.8,
    weaponTrailSwayPx: 1.1,
    footStridePx: 9.5,
    footLiftPx: 12,
    footTrailXPx: 15,
    footTrailYPx: 8,
    footPivotRad: 0.09,
    headBobPx: 1.8,
  }),
});

/** Large 2H/XL implements override their class pool with slower, planted, visibly inertial weight. */
export const WEIGHTED_MOVEMENT_POSTURE: MovementPostureSpec = movementPosture({
  key: "weighted",
  strideLengthPx: 192,
  bodyBobPx: 5.4,
  bodyStepDipPx: 3.2,
  bodyBounceX: 0.038,
  bodyBounceY: 0.058,
  runLeanRad: 0.13,
  inertiaLeanRad: 0.4,
  counterLeanRad: 0.045,
  handSwingPx: 3.2,
  handBobPx: 1.1,
  handTrailXPx: 35,
  handTrailYPx: 27,
  weaponCarryForwardPx: -2.4,
  weaponCarryUpPx: 0.6,
  weaponTrailSwayPx: 1.4,
  footStridePx: 13,
  footLiftPx: 10.5,
  footTrailXPx: 27,
  footTrailYPx: 14,
  footPivotRad: 0.1,
  headBobPx: 0.75,
});

export function movementPostureFor(def: WeaponDef): MovementPostureSpec {
  const family = weaponPoseFamilyFor(def);
  const sizeClass = bladeSizeClassFor(def);
  const weightedSword =
    family === "two-hand-sword" && (sizeClass === "great" || sizeClass === "colossal");
  const weightedImplement =
    family === "two-hand-heavy" ||
    weightedSword ||
    (def.tags.size === "XL" && (def.twoHanded === true || def.tags.grip === "2H"));
  return weightedImplement
    ? WEIGHTED_MOVEMENT_POSTURE
    : CLASS_POOL_MOVEMENT_POSTURES[def.tags.classPool];
}

export interface MovementPostureInput {
  spec: MovementPostureSpec;
  facing: number;
  moveX: number;
  lagX: number;
  lagY: number;
  gait: number;
  stridePhase: number;
  reducedMotion: boolean;
}

export interface MovementPostureSample {
  localMoveX: number;
  localLagX: number;
  bodyRotationRad: number;
  bodyBobPx: number;
  bodyBounce: number;
  handSwingPx: number;
  handBobPx: number;
  handTrailXPx: number;
  handTrailYPx: number;
  weaponCarryForwardPx: number;
  weaponCarryUpPx: number;
  weaponTrailSwayPx: number;
  footStridePx: number;
  footLiftPx: number;
  footTrailXPx: number;
  footTrailYPx: number;
  footPivotRad: number;
  headBobPx: number;
}

export function createMovementPostureInput(): MovementPostureInput {
  return {
    spec: CLASS_POOL_MOVEMENT_POSTURES.melee,
    facing: 1,
    moveX: 0,
    lagX: 0,
    lagY: 0,
    gait: 0,
    stridePhase: 0,
    reducedMotion: false,
  };
}

export function createMovementPostureSample(): MovementPostureSample {
  return {
    localMoveX: 0,
    localLagX: 0,
    bodyRotationRad: 0,
    bodyBobPx: 0,
    bodyBounce: 0,
    handSwingPx: 0,
    handBobPx: 0,
    handTrailXPx: 0,
    handTrailYPx: 0,
    weaponCarryForwardPx: 0,
    weaponCarryUpPx: 0,
    weaponTrailSwayPx: 0,
    footStridePx: 0,
    footLiftPx: 0,
    footTrailXPx: 0,
    footTrailYPx: 0,
    footPivotRad: 0,
    headBobPx: 0,
  };
}

/** Allocation-free walk-cycle sampler; all outputs are rig-local and the root owns the one final mirror. */
export function sampleMovementPosture(
  input: Readonly<MovementPostureInput>,
  out: MovementPostureSample,
): MovementPostureSample {
  const facing = input.facing < 0 ? -1 : 1;
  const gait = Math.max(0, Math.min(1, input.gait));
  const accent = input.reducedMotion ? 0 : gait;
  const strideSin = Math.sin(input.stridePhase);
  const strideCos = Math.cos(input.stridePhase);
  const stepBeat = Math.sin(input.stridePhase * 2);
  const spec = input.spec;
  out.localMoveX = input.moveX * facing;
  out.localLagX = input.lagX * facing;
  out.bodyRotationRad =
    out.localMoveX * spec.runLeanRad * gait +
    out.localLagX * spec.inertiaLeanRad * (input.reducedMotion ? 0 : 1) -
    strideSin * spec.counterLeanRad * accent;
  out.bodyBobPx =
    accent === 0
      ? 0
      : stepBeat * spec.bodyBobPx * accent + Math.abs(strideSin) * spec.bodyStepDipPx * accent;
  out.bodyBounce = accent === 0 ? 0 : stepBeat * accent;
  out.handSwingPx = accent === 0 ? 0 : strideCos * spec.handSwingPx * accent;
  out.handBobPx = accent === 0 ? 0 : Math.abs(strideSin) * spec.handBobPx * accent;
  out.handTrailXPx = input.reducedMotion ? 0 : -out.localLagX * spec.handTrailXPx;
  out.handTrailYPx = input.reducedMotion ? 0 : -input.lagY * spec.handTrailYPx;
  out.weaponCarryForwardPx = spec.weaponCarryForwardPx * gait;
  out.weaponCarryUpPx = spec.weaponCarryUpPx * gait;
  out.weaponTrailSwayPx =
    accent === 0 ? 0 : (-out.localLagX * 0.62 + strideSin * 0.38) * spec.weaponTrailSwayPx * accent;
  out.footStridePx = accent === 0 ? 0 : strideCos * spec.footStridePx * accent;
  out.footLiftPx = accent === 0 ? 0 : Math.max(0, strideSin) * spec.footLiftPx * accent;
  out.footTrailXPx = input.reducedMotion ? 0 : -out.localLagX * spec.footTrailXPx;
  out.footTrailYPx = input.reducedMotion ? 0 : -input.lagY * spec.footTrailYPx;
  out.footPivotRad = accent === 0 ? 0 : strideCos * spec.footPivotRad * accent;
  out.headBobPx = accent === 0 ? 0 : -stepBeat * spec.headBobPx * accent;
  return out;
}

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

export interface NamedWeaponStance extends BladeSizeStance {
  readonly id: WeaponStanceId;
  /** Screen guards stay physically named; aim guards follow the cursor while retaining named handwork. */
  readonly angleReference: "screen" | "aim";
  readonly handReference: "screen" | "aim";
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
  const afterAttack = flourishBeat(
    durations[2],
    arcs[2],
    family === "two-hand-sword" ? 14 : family === "pistol" ? 12 : 11,
    accents,
    afterCuts?.[0],
    afterCuts?.[1],
  );
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
    afterAttack,
    // V3G2 reuses the existing pistol twirl performance verbatim after its one-second idle gate.
    idleSettle: family === "pistol" ? afterAttack : flourishBeat(durations[3], 0, 0, accents),
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

export const PISTOL_END_HOOK_PIVOT = Object.freeze({ x: 0.073, y: 0.5 });

/** Kunai keeps its thrown pose family, but draw and post-throw reuse the shipped pistol-twirl beats. */
export const PISTOL_END_HOOK_FLOURISH_SPEC: WeaponFlourishSpec = Object.freeze({
  ...WEAPON_FLOURISH_SPECS.thrown,
  draw: WEAPON_FLOURISH_SPECS.pistol.draw,
  afterAttack: WEAPON_FLOURISH_SPECS.pistol.afterAttack,
});

export function weaponFlourishPivotFor(
  def: WeaponDef | undefined,
  moment: FlourishMoment,
  active: boolean,
): Readonly<{ x: number; y: number }> | undefined {
  return active &&
    def?.performance?.flourishStyle === "pistol-end-hook" &&
    (moment === "draw" || moment === "after-attack")
    ? PISTOL_END_HOOK_PIVOT
    : undefined;
}

export interface RevolverHammerBeatSample {
  active: boolean;
  weaponRotationRad: number;
  weaponForward: number;
  weaponLateral: number;
  handForward: number;
  handLateral: number;
}

export function createRevolverHammerBeatSample(): RevolverHammerBeatSample {
  return {
    active: false,
    weaponRotationRad: 0,
    weaponForward: 0,
    weaponLateral: 0,
    handForward: 0,
    handLateral: 0,
  };
}

/** Preserve every authored cadence while fitting one pull/release silhouette inside each accepted shot. */
export function revolverHammerBeatDurationMs(fireRateSeconds: number | undefined): number {
  if (!fireRateSeconds || fireRateSeconds <= 0) return 180;
  return Math.min(180, Math.max(92, fireRateSeconds * 1000 - 12));
}

/** Painted-space hammer pulse. The gun rotates around its grip so the rear hammer moves visibly; the
 * rendered thumb/paired hand then reaches backward and upward without dragging the gun or muzzle with it. */
export function sampleRevolverHammerBeat(
  def: WeaponDef | undefined,
  elapsedMs: number,
  displayLength: number,
  reducedMotion: boolean,
  out: RevolverHammerBeatSample,
): RevolverHammerBeatSample {
  out.active = false;
  out.weaponRotationRad = 0;
  out.weaponForward = 0;
  out.weaponLateral = 0;
  out.handForward = 0;
  out.handLateral = 0;
  if (!def?.gun || !weaponHasHandlingTag(def, "revolver") || elapsedMs < 0) return out;
  const durationMs = revolverHammerBeatDurationMs(def.gun.fireRate);
  if (elapsedMs >= durationMs) return out;
  const q = clamp01(elapsedMs / durationMs);
  const cock = q <= 0.38 ? smoothstep01(q / 0.38) : 1 - smoothstep01((q - 0.38) / 0.62);
  const motionScale = reducedMotion ? 0.38 : 1;
  const pairedScale = def.dual || def.gripPoints?.secondary?.role === "hammer" ? 1 : 0.55;
  out.active = true;
  out.weaponRotationRad = -0.14 * cock * motionScale;
  out.weaponForward = -displayLength * 0.025 * cock * motionScale;
  out.weaponLateral = -displayLength * 0.018 * cock * motionScale;
  out.handForward = -displayLength * 0.12 * pairedScale * cock * motionScale;
  out.handLateral = -displayLength * 0.09 * pairedScale * cock * motionScale;
  return out;
}

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

/** Kenjutsu and grip guards authored once so future blades can opt in by stable stance id. */
export const NAMED_WEAPON_STANCES: Readonly<Record<WeaponStanceId, NamedWeaponStance>> =
  Object.freeze({
    "hasso-no-kamae": Object.freeze({
      ...BLADE_SIZE_STANCES.long,
      id: "hasso-no-kamae",
      angleReference: "screen",
      handReference: "screen",
      restAngleRad: -Math.PI / 2,
      handForward: 0.12,
      handLateral: -0.2,
      gripSpacing: 0.32,
      bodyTurn: 0.08,
    }),
    "tachi-no-tori": Object.freeze({
      ...BLADE_SIZE_STANCES.standard,
      id: "tachi-no-tori",
      angleReference: "screen",
      handReference: "screen",
      restAngleRad: -2.14,
      handForward: -0.1,
      handLateral: -0.15,
      gripSpacing: 0.48,
      bodyTurn: -0.06,
    }),
    "blade-forward-high-hilt": Object.freeze({
      ...BLADE_SIZE_STANCES.standard,
      id: "blade-forward-high-hilt",
      angleReference: "aim",
      handReference: "screen",
      restAngleRad: 0,
      handForward: -0.06,
      handLateral: -0.34,
      gripSpacing: 0.28,
      bodyTurn: 0.07,
    }),
    "near-ear-blade-up": Object.freeze({
      ...BLADE_SIZE_STANCES.standard,
      id: "near-ear-blade-up",
      angleReference: "screen",
      handReference: "screen",
      restAngleRad: -Math.PI / 2,
      handForward: 0.08,
      handLateral: -0.3,
      gripSpacing: 0.2,
      bodyForward: -0.015,
      bodyTurn: 0.09,
      frontFootForward: 0.11,
      frontFootLateral: 0.08,
      backFootForward: -0.14,
      backFootLateral: -0.09,
    }),
    "two-hands-on-hilt": Object.freeze({
      ...BLADE_SIZE_STANCES.standard,
      id: "two-hands-on-hilt",
      angleReference: "aim",
      handReference: "aim",
      restAngleRad: -0.2,
      gripSpacing: 0.18,
    }),
    "low-close-hilt": Object.freeze({
      ...BLADE_SIZE_STANCES.standard,
      id: "low-close-hilt",
      angleReference: "aim",
      handReference: "aim",
      restAngleRad: -0.2,
      handForward: -0.03,
      handLateral: 0.18,
      gripSpacing: 0.13,
      bodyTurn: 0.055,
    }),
  });

export function namedWeaponStanceFor(def: WeaponDef | undefined): NamedWeaponStance | undefined {
  return def?.stance ? NAMED_WEAPON_STANCES[def.stance] : undefined;
}

/** A named/blade stance replaces the family foot profile; the two can never be accumulated. */
export function resolveWeaponFootPoseOffset(
  def: WeaponDef,
  stance: BladeSizeStance | NamedWeaponStance | undefined,
  front: boolean,
  gait: number,
  bodyHeight: number,
  out: FootPoseOffset,
): FootPoseOffset {
  if (!stance) return resolveFootPoseOffset(idleFootPoseFor(def), front, gait, bodyHeight, out);
  const blend = 1 - clamp01(gait) * 0.5;
  out.x = (front ? stance.frontFootForward : stance.backFootForward) * bodyHeight * blend;
  out.y = (front ? stance.frontFootLateral : stance.backFootLateral) * bodyHeight * blend;
  return out;
}

/** A combo's authored motion wins over its broad family when the two intentionally diverge. */
export function comboPresentationStyleFor(
  family: MeleeComboFamily | "none",
  motion: MeleeComboMotion,
): SwingStyle {
  if (motion === "impale" || motion === "jab" || motion === "lunge" || motion === "disengage")
    return "thrust";
  if (motion === "rest-downswing") return "chop";
  if (motion === "waist-orbit") return "spin";
  if (motion === "rake" || motion === "scissor") return "pivot";
  if (family === "rake") return "pivot";
  return family === "none" ? "arc" : family;
}

/** Flip across the sprite's semantic blade axis, leaving its +X tip and grip fixed in both facings. */
export function edgeLeadScaleY(edgeLeadFlip: boolean | undefined): 1 | -1 {
  return edgeLeadFlip ? -1 : 1;
}

/** Image-origin transform that pins the physical shaft midpoint to the character centre at every angle. */
export function shaftMidpointPivotTransform(
  centerX: number,
  centerY: number,
  angle: number,
  shaftLength: number,
  gripFrac: number,
): { x: number; y: number; rotation: number } {
  const originToMidpoint = (0.5 - gripFrac) * shaftLength;
  return {
    x: centerX - Math.cos(angle) * originToMidpoint,
    y: centerY - Math.sin(angle) * originToMidpoint,
    rotation: angle,
  };
}

export function twirlDirectionForBeat(
  direction: "forward" | "alternate",
  attackBeat: number,
): -1 | 1 {
  return direction === "alternate" && (attackBeat & 1) === 0 ? -1 : 1;
}

export type ContinuousTwirlAxis = "pitch" | "yaw";

/** Semantic full-body axis for the two continuous spin families. Screen-circle is weapon-only. */
export function continuousTwirlAxisFor(
  spec: WeaponPerformanceSpec | undefined,
): ContinuousTwirlAxis | undefined {
  if (spec?.action !== "spin") return undefined;
  if (spec.twirl?.plane === "continuous-frontflip") return "pitch";
  if (spec.twirl?.plane === "ground-whirlwind") return "yaw";
  return undefined;
}

/** Cadence-locked phase shared by held ground-plane whirls and vertical frontflips. */
export function continuousWhirlPhase(
  spec: WeaponPerformanceSpec | undefined,
  fireHeld: boolean,
  reducedMotion: boolean,
  timeS: number,
  cadenceSeconds: number,
): number {
  if (continuousTwirlAxisFor(spec) === undefined || !fireHeld || reducedMotion) return -1;
  const cadence = Math.max(0.1, cadenceSeconds);
  return (((timeS / cadence) % 1) + 1) % 1;
}

/** Unwrapped fixed-rate whirl angle. Integer turns make phase 0/1 visually identical while preserving
 * the same derivative on both sides of the modulo seam. */
export function continuousWhirlAngle(
  phase: number,
  turns: number,
  direction: -1 | 1,
  originAngle: number,
): number {
  return originAngle + direction * Math.max(1, turns) * Math.PI * 2 * phase;
}

/** Forward somersault around the side-view pitch axis. Facing mirrors the rotation direction so the
 * head always pitches toward travel; integer turns close with identical position and velocity. */
export function continuousFrontflipAngle(
  phase: number,
  turns: number,
  direction: -1 | 1,
  facing: -1 | 1,
): number {
  return direction * facing * Math.max(1, turns) * Math.PI * 2 * phase;
}

/** A reverse rising chop turns the painted axe head over before the upward return swipe. */
export function comboWeaponThicknessSign(
  step: Pick<MeleeComboStep, "motion" | "direction"> | undefined,
): -1 | 1 {
  return step?.motion === "rising-chop" && step.direction < 0 ? -1 : 1;
}

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
  if (def.performance?.flourishStyle === "pistol-end-hook")
    return PISTOL_END_HOOK_FLOURISH_SPEC;
  const family = weaponPoseFamilyFor(def);
  let spec = WEAPON_FLOURISH_SPECS[family];
  if (family === "two-hand-sword") spec = SIZED_SWORD_FLOURISH_SPECS[bladeSizeClassFor(def)];
  if (family === "long-gun") {
    const firingFamily = firingStanceFamilyFor(def);
    if (firingFamily in LONG_GUN_FLOURISH_SPECS) {
      spec = LONG_GUN_FLOURISH_SPECS[firingFamily as keyof typeof LONG_GUN_FLOURISH_SPECS];
    }
  }
  const resolved = def.beam ? BEAM_FLOURISH_SPECS[spec.family] : spec;
  if (!weaponHasHandlingTag(def, "pistol")) return resolved;
  const pistolTwirl = WEAPON_FLOURISH_SPECS.pistol.afterAttack;
  if (resolved.idleSettle === pistolTwirl) return resolved;
  // Compact automatics can use a long-gun firing pose, but their authored pistol tag still grants the
  // same idle twirl. Preserve the firing family's other beats (especially beam recovery).
  return Object.freeze({ ...resolved, idleSettle: pistolTwirl });
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
  // Idle settle is a real authored performance, not a pose-only ownership handoff. The previous
  // `angle + -angle` expression zeroed every pistol idle-twirl sample in the same frame it was armed.
  out.weaponRotationRad = angle * sign;
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

export type WeaponPerformanceSpec = NonNullable<WeaponDef["performance"]>;

export interface WeaponPerformanceInput {
  spec: WeaponPerformanceSpec;
  timeS: number;
  aimLocal: number;
  phase: PoseActionPhase;
  phaseT: number;
  fireHeld: boolean;
  reducedMotion: boolean;
  gait: number;
  stridePhase: number;
}

export interface WeaponPerformanceSample {
  active: boolean;
  weaponAngle: number;
  backWeaponAngle: number;
  handX: number;
  handY: number;
  handBlend: number;
  backHandX: number;
  backHandY: number;
  backHandBlend: number;
  offsetX: number;
  offsetY: number;
  ownership: number;
  wholeBodyRotation: number;
  wholeBodyLift: number;
  bodyForward: number;
  bodyLateral: number;
  bodyTurn: number;
  frontFootForward: number;
  frontFootLateral: number;
  backFootForward: number;
  backFootLateral: number;
  footBlend: number;
}

export function weaponPerformanceSpecFor(
  def: WeaponDef | undefined,
): WeaponPerformanceSpec | undefined {
  return def?.performance;
}

export function createWeaponPerformanceInput(): WeaponPerformanceInput {
  return {
    spec: { hold: "steady", action: "hold" },
    timeS: 0,
    aimLocal: 0,
    phase: "idle",
    phaseT: 0,
    fireHeld: false,
    reducedMotion: false,
    gait: 0,
    stridePhase: 0,
  };
}

export function createWeaponPerformanceSample(): WeaponPerformanceSample {
  return {
    active: false,
    weaponAngle: 0,
    backWeaponAngle: Number.NaN,
    handX: 0,
    handY: 0,
    handBlend: 0,
    backHandX: 0,
    backHandY: 0,
    backHandBlend: 0,
    offsetX: 0,
    offsetY: 0,
    ownership: 0,
    wholeBodyRotation: 0,
    wholeBodyLift: 0,
    bodyForward: 0,
    bodyLateral: 0,
    bodyTurn: 0,
    frontFootForward: 0,
    frontFootLateral: 0,
    backFootForward: 0,
    backFootLateral: 0,
    footBlend: 0,
  };
}

function clearWeaponPerformanceSample(out: WeaponPerformanceSample): void {
  out.active = false;
  out.weaponAngle = 0;
  out.backWeaponAngle = Number.NaN;
  out.handX = 0;
  out.handY = 0;
  out.handBlend = 0;
  out.backHandX = 0;
  out.backHandY = 0;
  out.backHandBlend = 0;
  out.offsetX = 0;
  out.offsetY = 0;
  out.ownership = 0;
  out.wholeBodyRotation = 0;
  out.wholeBodyLift = 0;
  out.bodyForward = 0;
  out.bodyLateral = 0;
  out.bodyTurn = 0;
  out.frontFootForward = 0;
  out.frontFootLateral = 0;
  out.backFootForward = 0;
  out.backFootLateral = 0;
  out.footBlend = 0;
}

/**
 * Allocation-free authored hold/action sampler. Every overhead and shake performance enters this one
 * vocabulary; weapon records only tune its amplitude/frequency or select the downswing phase.
 */
export function sampleWeaponPerformance(
  input: WeaponPerformanceInput,
  out: WeaponPerformanceSample,
): WeaponPerformanceSample {
  clearWeaponPerformanceSample(out);
  const { spec } = input;
  const phaseT = clamp01(input.phaseT);
  let angle = input.aimLocal - 0.12;
  let handX = Math.cos(input.aimLocal) * 0.12;
  let handY = Math.sin(input.aimLocal) * 0.12 - 0.04;

  switch (spec.hold) {
    case "upright":
      angle = spec.carryAngleRad ?? -Math.PI / 2;
      handX = 0.08 + (spec.carryForwardPx ?? 0) / 76;
      handY = -0.08;
      break;
    case "walking-staff": {
      angle = -Math.PI / 2;
      handX = 0.11;
      const tap = Math.max(0, Math.cos(input.stridePhase + (spec.strideTap?.phaseOffset ?? 0)));
      handY = -0.06 + (tap * (spec.strideTap?.amplitudePx ?? 8) * clamp01(input.gait)) / 76;
      // Both hands actually close on the shaft: the lower grip follows the same planted staff line.
      out.backHandX = handX;
      out.backHandY = handY + 0.22;
      out.backHandBlend = 1;
      break;
    }
    case "one-hand-walking-staff": {
      angle = -Math.PI / 2;
      handX = 0.13;
      const tap = Math.max(0, Math.cos(input.stridePhase + (spec.strideTap?.phaseOffset ?? 0)));
      handY = -0.08 + (tap * (spec.strideTap?.amplitudePx ?? 8) * clamp01(input.gait)) / 76;
      break;
    }
    case "horn-to-face": {
      angle = input.aimLocal;
      const cosine = Math.cos(input.aimLocal);
      const sine = Math.sin(input.aimLocal);
      const forward = 0.06;
      const lateral = -0.25;
      handX = cosine * forward - sine * lateral;
      handY = sine * forward + cosine * lateral;
      out.backHandX = cosine * -0.12 + sine * -0.13;
      out.backHandY = sine * -0.12 - cosine * -0.13;
      out.backHandBlend = 1;
      break;
    }
    case "hanging-chain":
      angle = Math.PI / 2;
      handX = 0.1;
      handY = -0.05;
      break;
    case "drag-at-feet":
      angle = input.aimLocal + Math.PI;
      handX = -Math.cos(input.aimLocal) * 0.2;
      handY = 0.3;
      break;
    case "aim-forward":
      angle = input.aimLocal;
      handX = Math.cos(input.aimLocal) * 0.15;
      handY = Math.sin(input.aimLocal) * 0.15 - 0.08;
      break;
    case "overhead":
      angle = -Math.PI / 2;
      handX = 0;
      handY = -0.4;
      break;
    case "shoulder-launcher":
      angle = input.aimLocal;
      handX = -0.08;
      handY = -0.32;
      break;
    default:
      break;
  }
  if (spec.throwStyle === "engaged" && input.phase === "idle") {
    const cosine = Math.cos(input.aimLocal);
    const sine = Math.sin(input.aimLocal);
    const readyForward = 0.13;
    const readyLateral = -0.2;
    angle = input.aimLocal - 0.48;
    handX = cosine * readyForward - sine * readyLateral;
    handY = sine * readyForward + cosine * readyLateral - 0.035;
    out.backHandX = cosine * 0.07 - sine * 0.14;
    out.backHandY = sine * 0.07 + cosine * 0.14 - 0.035;
    out.backHandBlend = 0.94;
    out.bodyForward = 0.018;
    out.bodyLateral = -0.018;
    out.bodyTurn = -0.065;
    out.frontFootForward = 0.075;
    out.frontFootLateral = 0.085;
    out.backFootForward = -0.095;
    out.backFootLateral = -0.09;
    out.footBlend = 0.72;
  } else if (spec.throwStyle === "two-hand-overhead" && input.phase === "idle") {
    const cosine = Math.cos(input.aimLocal);
    const sine = Math.sin(input.aimLocal);
    const readyForward = -0.18;
    const readyLateral = -0.28;
    angle = input.aimLocal + 0.68;
    handX = cosine * readyForward - sine * readyLateral;
    handY = sine * readyForward + cosine * readyLateral - 0.04;
    out.backHandX = cosine * -0.12 - sine * -0.24;
    out.backHandY = sine * -0.12 + cosine * -0.24 - 0.04;
    out.backHandBlend = 1;
    out.bodyForward = -0.018;
    out.bodyLateral = 0;
    out.bodyTurn = -0.08;
    out.frontFootForward = 0.055;
    out.frontFootLateral = 0.09;
    out.backFootForward = -0.1;
    out.backFootLateral = -0.1;
    out.footBlend = 0.78;
  }
  if (spec.carryAngleRad !== undefined && spec.hold !== "upright") angle = spec.carryAngleRad;
  const restAngle = angle;
  const restHandX = handX;
  const restHandY = handY;

  if (spec.frontflip && input.phase !== "idle") {
    const flipProgress =
      input.phase === "anticipation"
        ? phaseT * 0.18
        : input.phase === "active"
          ? 0.18 + phaseT * 0.6
          : 0.78 + phaseT * 0.22;
    const easedFlip = flipProgress - Math.sin(flipProgress * Math.PI * 2) / (Math.PI * 2);
    out.wholeBodyRotation = input.reducedMotion ? 0 : -Math.PI * 2 * easedFlip;
    out.wholeBodyLift = Math.sin(Math.PI * flipProgress) * 0.26;
  }

  // Upright records preserve their ordinary authored attack and only replace the neutral equilibrium.
  if (spec.action === "default-swing" && input.phase !== "idle") return out;

  let actionOwn = input.phase === "idle" ? 0.88 : 1;
  let shakeWeight = 0;
  if (spec.action === "overhead-downswing") {
    if (input.phase === "anticipation") {
      const raise = smoothstep01(phaseT / 0.14);
      handX = mix(restHandX, 0, raise);
      handY = mix(restHandY, -0.4, raise);
      angle = mix(restAngle, -Math.PI / 2, raise);
      shakeWeight = smoothstep01((phaseT - 0.12) / 0.16);
    } else if (input.phase === "active") {
      const swing = smoothstep01(phaseT);
      handX = mix(0, Math.cos(input.aimLocal) * 0.16, swing);
      handY = mix(-0.4, Math.sin(input.aimLocal) * 0.16 - 0.03, swing);
      angle = mix(-Math.PI / 2, input.aimLocal + 0.7, swing);
    } else if (input.phase === "recovery") {
      const settle = smoothstep01(phaseT);
      handX = mix(Math.cos(input.aimLocal) * 0.16, restHandX, settle);
      handY = mix(Math.sin(input.aimLocal) * 0.16 - 0.03, restHandY, settle);
      angle = mix(input.aimLocal + 0.7, restAngle, settle);
      actionOwn = 1 - settle;
    }
  } else if (spec.action === "throw-release" && input.phase !== "idle") {
    const engaged = spec.throwStyle === "engaged";
    const twoHandOverhead = spec.throwStyle === "two-hand-overhead";
    const wind = input.phase === "anticipation";
    const release = input.phase === "active";
    const e = smoothstep01(phaseT);
    const forward = twoHandOverhead
      ? wind
        ? mix(-0.18, -0.36, e)
        : release
          ? mix(-0.36, 0.52, e)
          : mix(0.52, -0.18, e)
      : engaged
      ? wind
        ? mix(0.13, -0.38, e)
        : release
          ? mix(-0.38, 0.52, e)
          : mix(0.52, 0.13, e)
      : wind
        ? mix(0.1, -0.3, e)
        : release
          ? mix(-0.3, 0.46, e)
          : mix(0.46, 0.12, e);
    const lateral = twoHandOverhead
      ? wind
        ? mix(-0.28, -0.38, e)
        : release
          ? mix(-0.38, -0.03, e)
          : mix(-0.03, -0.28, e)
      : engaged
      ? wind
        ? mix(-0.16, 0.23, e)
        : release
          ? mix(0.23, 0.02, e)
          : mix(0.02, -0.16, e)
      : wind
        ? mix(0.08, 0.15, e)
        : release
          ? mix(0.15, 0.035, e)
          : mix(0.035, 0.08, e);
    const cosine = Math.cos(input.aimLocal);
    const sine = Math.sin(input.aimLocal);
    handX = cosine * forward - sine * lateral;
    handY = sine * forward + cosine * lateral - 0.04;
    const supportForward = twoHandOverhead
      ? wind
        ? mix(-0.12, -0.28, e)
        : release
          ? mix(-0.28, 0.42, e)
          : mix(0.42, -0.12, e)
      : engaged
      ? wind
        ? mix(0.05, 0.18, e)
        : release
          ? mix(0.18, -0.14, e)
          : mix(-0.14, 0.07, e)
      : forward;
    const supportLateral = twoHandOverhead
      ? wind
        ? mix(-0.24, -0.32, e)
        : release
          ? mix(-0.32, 0.02, e)
          : mix(0.02, -0.24, e)
      : engaged
        ? -0.14
        : -lateral;
    out.backHandX = cosine * supportForward - sine * supportLateral;
    out.backHandY = sine * supportForward + cosine * supportLateral - 0.04;
    out.backHandBlend = 1;
    if (engaged || twoHandOverhead) {
      out.bodyForward = wind
        ? mix(0.018, -0.055, e)
        : release
          ? mix(-0.055, 0.105, e)
          : mix(0.105, 0.018, e);
      out.bodyLateral = wind
        ? mix(-0.018, 0.035, e)
        : release
          ? mix(0.035, -0.02, e)
          : mix(-0.02, -0.018, e);
      out.bodyTurn = wind
        ? mix(-0.065, -0.2, e)
        : release
          ? mix(-0.2, 0.17, e)
          : mix(0.17, -0.065, e);
      const stepForward = wind
        ? mix(0.075, -0.12, e)
        : release
          ? mix(-0.12, 0.19, e)
          : mix(0.19, 0.075, e);
      const braceForward = wind
        ? mix(-0.095, 0.055, e)
        : release
          ? mix(0.055, -0.15, e)
          : mix(-0.15, -0.095, e);
      out.frontFootForward = stepForward;
      out.frontFootLateral = 0.09;
      out.backFootForward = braceForward;
      out.backFootLateral = -0.105;
      out.footBlend = input.phase === "recovery" ? 1 - e * 0.28 : 0.96;
    }
    const throwLift = (spec.throwHeightPx ?? 0) / 76;
    const heightEnvelope = wind ? e : release ? 1 : 1 - e;
    handY -= throwLift * heightEnvelope;
    out.backHandY -= throwLift * heightEnvelope;
    const drawTurns = (spec.preThrowRevolutions ?? 0) * Math.PI * 2;
    // A turn that only changes angle aliases at its start/end. Orbit the in-hand grip through the same
    // authored revolution so Coilshot's complete twirl and the thrown release both read between key poses.
    if (wind && drawTurns > 0) {
      const orbitEnvelope = Math.sin(Math.PI * e);
      // One sixth of a body-height was too easy to read as hand jitter at the old 51ms draw. The authored
      // windup now exposes the entire path; this broad orbit makes the meteor head visibly circle the hand.
      const orbit = 0.2 * orbitEnvelope;
      const orbitAngle = input.aimLocal + e * drawTurns;
      const orbitX = Math.cos(orbitAngle) * orbit;
      const orbitY = Math.sin(orbitAngle) * orbit;
      handX += orbitX;
      handY += orbitY;
      out.backHandX -= orbitX * 0.42;
      out.backHandY -= orbitY * 0.42;
    }
    angle = wind
      ? mix(input.aimLocal - 0.15, input.aimLocal + Math.PI * 0.72 + drawTurns, e)
      : input.aimLocal;
    out.backWeaponAngle = wind ? angle - 0.22 : input.aimLocal - 0.12;
  } else if (spec.action === "recoil" && input.phase !== "idle") {
    const kick = input.phase === "active" ? Math.sin(Math.PI * phaseT) : 1 - smoothstep01(phaseT);
    out.offsetX -= Math.cos(input.aimLocal) * 0.065 * kick;
    out.offsetY -= Math.sin(input.aimLocal) * 0.065 * kick;
  } else if (spec.action === "spin") {
    // A frontflip rotates the shared rig root, so the buster stays locked to both hands instead of
    // independently twirling inside the somersault.
    if (input.fireHeld && !input.reducedMotion && spec.twirl?.plane !== "continuous-frontflip")
      angle += input.timeS * Math.PI * 4.4;
  } else if (spec.action === "lunge-punch" && input.phase !== "idle") {
    const eased = smoothstep01(phaseT);
    const forward =
      input.phase === "anticipation"
        ? mix(0.12, -0.34, eased)
        : input.phase === "active"
          ? mix(-0.34, 0.48, eased)
          : mix(0.48, 0.12, eased);
    const lateral = input.phase === "anticipation" ? mix(0.08, 0.15, eased) : 0.06;
    const cosine = Math.cos(input.aimLocal);
    const sine = Math.sin(input.aimLocal);
    handX = cosine * forward - sine * lateral;
    handY = sine * forward + cosine * lateral - 0.04;
    out.backHandX = cosine * forward + sine * lateral;
    out.backHandY = sine * forward - cosine * lateral - 0.04;
    out.backHandBlend = 1;
    angle = input.aimLocal;
    out.backWeaponAngle = input.aimLocal;
  } else if (spec.action === "jab" && input.phase !== "idle") {
    const eased = smoothstep01(phaseT);
    const leadForward =
      input.phase === "anticipation"
        ? mix(0.1, -0.18, eased)
        : input.phase === "active"
          ? mix(-0.18, 0.42, eased)
          : mix(0.42, 0.1, eased);
    const supportForward = leadForward - 0.28;
    const cosine = Math.cos(input.aimLocal);
    const sine = Math.sin(input.aimLocal);
    const lateral = 0.045;
    handX = cosine * leadForward - sine * lateral;
    handY = sine * leadForward + cosine * lateral - 0.04;
    out.backHandX = cosine * supportForward + sine * lateral;
    out.backHandY = sine * supportForward - cosine * lateral - 0.04;
    out.backHandBlend = 1;
    angle = input.aimLocal;
    out.backWeaponAngle = input.aimLocal;
  } else if (spec.action === "shake") {
    shakeWeight = spec.continuous ? (input.fireHeld ? 1 : 0) : input.phase === "idle" ? 0 : 1;
  }

  if (spec.shake && shakeWeight > 0 && !input.reducedMotion) {
    const omega = input.timeS * Math.PI * 2 * spec.shake.frequencyHz;
    const amplitude = (spec.shake.amplitudePx / 76) * shakeWeight;
    const lateralX = -Math.sin(input.aimLocal);
    const lateralY = Math.cos(input.aimLocal);
    const tremor = Math.sin(omega);
    out.offsetX += lateralX * amplitude * tremor;
    out.offsetY += lateralY * amplitude * tremor;
    angle += Math.cos(omega * 0.83) * spec.shake.rotationRad * shakeWeight;
  }

  out.active = true;
  out.weaponAngle = angle;
  out.handX = handX;
  out.handY = handY;
  out.handBlend = 1;
  out.ownership = actionOwn;
  return out;
}

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
