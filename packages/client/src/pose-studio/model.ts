export const COMBO_MOTIONS = [
  "slash",
  "overhead",
  "shoulder-chop",
  "reverse-chop",
  "rising-chop",
  "execution-slam",
  "rake",
  "scissor",
  "jab",
  "cross",
  "hook",
  "haymaker",
  "lunge",
  "disengage",
  "impale",
  "fulcrum-flip",
  "stinger",
  "elbow",
  "knee-strike",
  "roundhouse-kick",
  "chain-punch",
  "sway-jab",
  "weave-cross",
  "gourd-haymaker",
  "iron-knuckle",
  "iron-palm",
  "teep-kick",
  "spinning-back-elbow",
  "oblique-kick",
  "double-palm",
  "weave-backfist",
  "sweeping-leg",
  "falling-haymaker",
  "crushing-palm",
  "stomp-kick",
  "windup-palm",
  "quake-double-palm",
  "backflip-head-kick",
  "frontflip-heel-drop",
  "mantis-double-hook",
  "spin-release",
  "pommel-bash",
  "true-charged-slam",
  "falling-gate",
  "backswing-wheel",
  "runaway-cleave",
  "highland-gate",
  "rising-ward",
  "bind-break-cast-off",
  "long-reap",
  "shaft-switch",
  "compass-rose",
  "headsmans-drop",
  "hook-and-haul",
  "gallows-turn",
  "draw-cut",
  "guard-check",
  "sentence-fall",
  "choked-turn",
  "petalfall",
  "coil-drag",
  "thunder-fall",
  "splinter-fall",
  "rest-downswing",
  "waist-orbit",
] as const;

export const COMBO_PATHS = ["sweep", "fan", "dual-sweep", "capsule"] as const;
export const RIBBON_PROFILES = [
  "massed-wedge",
  "hooked-comma",
  "open-c",
  "guard-plane",
  "rising-plane",
  "broken-cross",
  "outer-crescent",
  "reverse-hairpin",
  "open-annulus",
  "head-wedge",
  "inward-hook",
  "heavy-sickle",
] as const;
export const IDLE_HAND_POSES = [
  "secondary-grip",
  "mirror-guard",
  "boxer-guard",
  "low-guard",
  "casting-gesture",
  "hip-rest",
  "praying-mantis",
  "crane-guard",
] as const;

export interface GripAnchor {
  x: number;
  y: number;
}

export interface SecondaryGripAnchor extends GripAnchor {
  role: string;
}

export type TransformableElementId =
  | "head"
  | "hand-l"
  | "hand-r"
  | "foot-l"
  | "foot-r"
  | `part-${number}`;
export type ElementTransformPose = "idle" | "held";
export type ElementTransformScope = "beat" | "pose" | "hold";

export interface ElementTransform {
  dx: number;
  dy: number;
  rotationRad: number;
  scale: number;
}

export type ElementTransformMap = Partial<Record<TransformableElementId, ElementTransform>>;

export interface ElementTransforms {
  hold?: ElementTransformMap;
  poses?: Partial<Record<ElementTransformPose, ElementTransformMap>>;
  beats?: Partial<Record<number, ElementTransformMap>>;
}

export const IDENTITY_ELEMENT_TRANSFORM: Readonly<ElementTransform> = Object.freeze({
  dx: 0,
  dy: 0,
  rotationRad: 0,
  scale: 1,
});

export function isTransformableElementId(value: string): value is TransformableElementId {
  return (
    value === "head" ||
    value === "hand-l" ||
    value === "hand-r" ||
    value === "foot-l" ||
    value === "foot-r" ||
    /^part-[1-9]\d*$/.test(value)
  );
}

export interface ComboTiming {
  activeStart: number;
  activeEnd: number;
  impact: number;
  followEnd: number;
  secondaryActiveStart?: number;
  secondaryActiveEnd?: number;
}

export interface ComboPath {
  kind: (typeof COMBO_PATHS)[number];
  arcMultiplier: number;
  deltaAngle?: number;
  rangeMultiplier: number;
  damageMultiplier: number;
  knockback: number;
}

export interface ComboBeat {
  name: string;
  motion: (typeof COMBO_MOTIONS)[number];
  limb?: "hand" | "foot";
  direction: -1 | 0 | 1;
  hand: "lead" | "off" | "both";
  timing: ComboTiming;
  path: ComboPath;
  ribbon?: {
    profile: (typeof RIBBON_PROFILES)[number];
    radialStart: number;
    radialEnd: number;
    widthMultiplier: number;
    end: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WeaponAuthoringRow {
  id: string;
  name: string;
  type: "melee" | "ranged" | "caster";
  family: string;
  grip: string;
  sprite?: string;
  comboFamily?: string;
  comboVariant?: string;
  comboBar?: ComboBeat[];
  comboChoreography?: Array<Record<string, unknown>>;
  stats: {
    damage: number;
    range: number;
    halfArc: number;
    cooldown: number;
    displayLength: number;
    swingArc: number;
    gripFrac: number;
    [key: string]: unknown;
  };
  gripPoints?: {
    primary: GripAnchor;
    secondary?: SecondaryGripAnchor;
  };
  poseLanguage?: {
    idle?: (typeof IDLE_HAND_POSES)[number];
    feet?: string;
  };
  elementTransforms?: ElementTransforms;
  behavior?: {
    kind?: string;
    recoil?: number;
    [key: string]: unknown;
  };
  performance?: Record<string, unknown>;
  archived?: boolean;
  [key: string]: unknown;
}

export interface WeaponSummary {
  id: string;
  name: string;
  type: string;
  family: string;
  grip: string;
  comboBeats: number;
  hasGripPoints: boolean;
}

export const cloneRow = (row: WeaponAuthoringRow): WeaponAuthoringRow => structuredClone(row);

export function rowFingerprint(row: WeaponAuthoringRow): string {
  return JSON.stringify(row);
}

function finiteIn(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
): string | undefined {
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? undefined
    : `${label} must be between ${minimum} and ${maximum}.`;
}

export function validateEditableRow(row: WeaponAuthoringRow): string | undefined {
  const statError =
    finiteIn(row.stats.displayLength, 40, 400, "Display length") ??
    finiteIn(row.stats.gripFrac, 0.05, 0.9, "Grip fraction");
  if (statError) return statError;

  if (row.gripPoints) {
    const gripError =
      finiteIn(row.gripPoints.primary.x, 0, 1, "Primary grip X") ??
      finiteIn(row.gripPoints.primary.y, 0, 1, "Primary grip Y") ??
      (row.gripPoints.secondary
        ? (finiteIn(row.gripPoints.secondary.x, 0, 1, "Secondary grip X") ??
          finiteIn(row.gripPoints.secondary.y, 0, 1, "Secondary grip Y"))
        : undefined);
    if (gripError) return gripError;
  }
  if (row.poseLanguage?.idle === "secondary-grip" && !row.gripPoints?.secondary) {
    return "The secondary-grip idle requires an authored secondary grip point.";
  }

  const validateTransformMap = (
    transforms: ElementTransformMap | undefined,
    label: string,
  ): string | undefined => {
    if (!transforms) return undefined;
    for (const [element, transform] of Object.entries(transforms)) {
      if (!isTransformableElementId(element)) return `${label} has unsupported element ${element}.`;
      if (!transform) return `${label}.${element} must be a transform.`;
      const error =
        finiteIn(transform.dx, -512, 512, `${label}.${element}.dx`) ??
        finiteIn(transform.dy, -512, 512, `${label}.${element}.dy`) ??
        finiteIn(
          transform.rotationRad,
          -Math.PI * 2,
          Math.PI * 2,
          `${label}.${element}.rotationRad`,
        ) ??
        finiteIn(transform.scale, 0.1, 5, `${label}.${element}.scale`);
      if (error) return error;
    }
    return undefined;
  };
  const holdTransformError = validateTransformMap(row.elementTransforms?.hold, "Hold transform");
  if (holdTransformError) return holdTransformError;
  for (const pose of ["idle", "held"] as const) {
    const poseTransformError = validateTransformMap(
      row.elementTransforms?.poses?.[pose],
      `${pose} pose transform`,
    );
    if (poseTransformError) return poseTransformError;
  }
  for (const [beatKey, transforms] of Object.entries(row.elementTransforms?.beats ?? {})) {
    const beatIndex = Number(beatKey);
    if (!Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex >= (row.comboBar?.length ?? 0)) {
      return `Beat transform ${beatKey} must identify an authored combo beat.`;
    }
    const beatTransformError = validateTransformMap(transforms, `Beat ${beatIndex + 1} transform`);
    if (beatTransformError) return beatTransformError;
  }

  for (const [index, beat] of (row.comboBar ?? []).entries()) {
    const { activeStart, activeEnd, impact, followEnd } = beat.timing;
    if (
      !(
        activeStart >= 0 &&
        activeStart < activeEnd &&
        impact >= activeStart &&
        impact <= activeEnd &&
        activeEnd <= followEnd &&
        followEnd <= 1
      )
    ) {
      return `Beat ${index + 1} timing must satisfy activeStart < activeEnd, impact inside active, and activeEnd <= followEnd <= 1.`;
    }
    const pathError =
      finiteIn(beat.path.arcMultiplier, -2, 2, `Beat ${index + 1} arc multiplier`) ??
      finiteIn(beat.path.rangeMultiplier, 0.5, 1.5, `Beat ${index + 1} range multiplier`) ??
      finiteIn(beat.path.damageMultiplier, 0.5, 2, `Beat ${index + 1} damage multiplier`) ??
      (beat.path.deltaAngle === undefined
        ? undefined
        : finiteIn(
            beat.path.deltaAngle,
            -Math.PI * 2,
            Math.PI * 2,
            `Beat ${index + 1} delta angle`,
          ));
    if (pathError) return pathError;
  }
  return undefined;
}
