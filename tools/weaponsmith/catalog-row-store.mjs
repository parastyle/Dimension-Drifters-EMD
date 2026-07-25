import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEAPON_CONCEPTS_PATH = resolve(HERE, "../../data/weapon-concepts-300.json");

const COMBO_MOTIONS = new Set([
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
]);
const COMBO_PATHS = new Set(["sweep", "fan", "dual-sweep", "capsule"]);
const RIBBON_PROFILES = new Set([
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
]);
const IDLE_HAND_POSES = new Set([
  "secondary-grip",
  "mirror-guard",
  "boxer-guard",
  "low-guard",
  "casting-gesture",
  "hip-rest",
  "praying-mantis",
  "crane-guard",
]);
const SECONDARY_GRIP_ROLES = new Set([
  "under-barrel",
  "bolt",
  "lever",
  "hammer",
  "crank",
  "pump",
  "horizontal-foregrip",
  "vertical-foregrip",
  "shoulder-RPG",
  "two-hand-rifle",
  "shaft",
  "handle",
]);
const ELEMENT_TRANSFORM_SCOPES = new Set(["hold", "poses", "beats"]);
const ELEMENT_TRANSFORM_POSES = new Set(["idle", "held"]);
const ELEMENT_TRANSFORM_KEYS = new Set(["dx", "dy", "rotationRad", "scale"]);

const clone = (value) => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function objectAt(root, path) {
  let value = root;
  for (const segment of path) value = value?.[segment];
  return value;
}

function changedPaths(before, after, prefix = "") {
  if (same(before, after)) return [];
  if (
    before === null ||
    after === null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return [prefix || "<row>"];
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) return [prefix || "<row>"];
    return before.flatMap((value, index) =>
      changedPaths(value, after[index], `${prefix}[${index}]`),
    );
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) =>
    changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key),
  );
}

function supportedEditPath(path) {
  return (
    path === "stats.displayLength" ||
    path === "stats.gripFrac" ||
    path === "gripPoints" ||
    /^gripPoints\.primary\.(x|y)$/.test(path) ||
    /^gripPoints\.secondary\.(x|y|angleRad)$/.test(path) ||
    path === "poseLanguage" ||
    path === "poseLanguage.idle" ||
    path === "elementTransforms" ||
    path.startsWith("elementTransforms.") ||
    /^comboBar\[\d+\]\.name$/.test(path) ||
    /^comboBar\[\d+\]\.motion$/.test(path) ||
    /^comboBar\[\d+\]\.timing\.(activeStart|activeEnd|impact|followEnd)$/.test(path) ||
    /^comboBar\[\d+\]\.path\.(kind|arcMultiplier|deltaAngle|rangeMultiplier|damageMultiplier)$/.test(
      path,
    ) ||
    /^comboBar\[\d+\]\.ribbon\.profile$/.test(path)
  );
}

function finiteIn(value, minimum, maximum, path, errors) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    errors.push(`${path} must be a finite number from ${minimum} to ${maximum}`);
  }
}

function elementIdValid(value) {
  return (
    value === "head" ||
    value === "hand-l" ||
    value === "hand-r" ||
    value === "foot-l" ||
    value === "foot-r" ||
    /^part-[1-9]\d*$/.test(value)
  );
}

function validateElementTransformMap(value, path, errors) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an element transform map`);
    return;
  }
  for (const [element, transform] of Object.entries(value)) {
    const elementPath = `${path}.${element}`;
    if (!elementIdValid(element)) {
      errors.push(`${elementPath} is not a transformable rendered element`);
      continue;
    }
    if (!transform || typeof transform !== "object" || Array.isArray(transform)) {
      errors.push(`${elementPath} must be a transform object`);
      continue;
    }
    if (Object.keys(transform).some((key) => !ELEMENT_TRANSFORM_KEYS.has(key))) {
      errors.push(`${elementPath} contains an unsupported key`);
    }
    for (const key of ELEMENT_TRANSFORM_KEYS) {
      if (transform[key] === undefined) errors.push(`${elementPath}.${key} is required`);
    }
    finiteIn(transform.dx, -512, 512, `${elementPath}.dx`, errors);
    finiteIn(transform.dy, -512, 512, `${elementPath}.dy`, errors);
    finiteIn(
      transform.rotationRad,
      -Math.PI * 2,
      Math.PI * 2,
      `${elementPath}.rotationRad`,
      errors,
    );
    finiteIn(transform.scale, 0.1, 5, `${elementPath}.scale`, errors);
  }
}

function validateElementTransforms(value, comboLength, errors) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("elementTransforms must be an object");
    return;
  }
  if (Object.keys(value).some((key) => !ELEMENT_TRANSFORM_SCOPES.has(key))) {
    errors.push("elementTransforms contains an unsupported scope");
  }
  validateElementTransformMap(value.hold, "elementTransforms.hold", errors);
  if (value.poses !== undefined) {
    if (!value.poses || typeof value.poses !== "object" || Array.isArray(value.poses)) {
      errors.push("elementTransforms.poses must be an object");
    } else {
      if (Object.keys(value.poses).some((key) => !ELEMENT_TRANSFORM_POSES.has(key))) {
        errors.push("elementTransforms.poses contains an unsupported pose");
      }
      for (const pose of ELEMENT_TRANSFORM_POSES) {
        validateElementTransformMap(value.poses[pose], `elementTransforms.poses.${pose}`, errors);
      }
    }
  }
  if (value.beats !== undefined) {
    if (!value.beats || typeof value.beats !== "object" || Array.isArray(value.beats)) {
      errors.push("elementTransforms.beats must be an object");
    } else {
      for (const [beatKey, transforms] of Object.entries(value.beats)) {
        const beatIndex = Number(beatKey);
        if (!Number.isInteger(beatIndex) || beatIndex < 0 || beatIndex >= comboLength) {
          errors.push(`elementTransforms.beats.${beatKey} must identify an authored combo beat`);
          continue;
        }
        validateElementTransformMap(transforms, `elementTransforms.beats.${beatKey}`, errors);
      }
    }
  }
}

/**
 * Validate only the schema surfaces that Pose Studio is authorized to mutate. Every other changed path
 * is rejected, which keeps recoil, displacement, aura, chain, and future mechanics owned by their systems.
 */
export function validatePoseStudioRow(next, baseline) {
  const errors = [];
  if (!next || typeof next !== "object" || Array.isArray(next)) {
    return ["row must be an object"];
  }
  if (next.id !== baseline?.id) errors.push("row id cannot change");

  for (const path of changedPaths(baseline, next)) {
    if (!supportedEditPath(path)) errors.push(`${path} is not editable in Pose Studio`);
  }

  finiteIn(next.stats?.displayLength, 40, 400, "stats.displayLength", errors);
  finiteIn(next.stats?.gripFrac, 0.05, 0.9, "stats.gripFrac", errors);

  if (next.gripPoints !== undefined) {
    const gripKeys = Object.keys(next.gripPoints);
    if (gripKeys.some((key) => key !== "primary" && key !== "secondary")) {
      errors.push("gripPoints contains an unsupported key");
    }
    const primary = next.gripPoints?.primary;
    if (!primary) errors.push("gripPoints.primary is required when gripPoints exists");
    else {
      finiteIn(primary.x, 0, 1, "gripPoints.primary.x", errors);
      finiteIn(primary.y, 0, 1, "gripPoints.primary.y", errors);
    }
    const secondary = next.gripPoints?.secondary;
    if (secondary) {
      finiteIn(secondary.x, 0, 1, "gripPoints.secondary.x", errors);
      finiteIn(secondary.y, 0, 1, "gripPoints.secondary.y", errors);
      if (secondary.angleRad !== undefined) {
        finiteIn(secondary.angleRad, -Math.PI, Math.PI, "gripPoints.secondary.angleRad", errors);
      }
      if (!SECONDARY_GRIP_ROLES.has(secondary.role)) {
        errors.push("gripPoints.secondary.role must remain a supported authored role");
      }
    }
  }

  if (
    next.poseLanguage !== undefined &&
    Object.keys(next.poseLanguage).some((key) => key !== "idle" && key !== "feet")
  ) {
    errors.push("poseLanguage contains an unsupported key");
  }
  if (next.poseLanguage?.idle !== undefined && !IDLE_HAND_POSES.has(next.poseLanguage.idle)) {
    errors.push(`poseLanguage.idle does not support ${JSON.stringify(next.poseLanguage.idle)}`);
  }
  if (next.poseLanguage?.idle === "secondary-grip" && !next.gripPoints?.secondary) {
    errors.push("poseLanguage.idle secondary-grip requires gripPoints.secondary");
  }
  validateElementTransforms(next.elementTransforms, next.comboBar?.length ?? 0, errors);

  if (next.comboBar !== undefined) {
    if (!Array.isArray(next.comboBar) || next.comboBar.length < 1 || next.comboBar.length > 8) {
      errors.push("comboBar must retain 1 to 8 authored beats");
    } else {
      for (const [index, beat] of next.comboBar.entries()) {
        const root = `comboBar[${index}]`;
        if (!beat || typeof beat !== "object") {
          errors.push(`${root} must be an object`);
          continue;
        }
        if (typeof beat.name !== "string" || beat.name.trim().length === 0) {
          errors.push(`${root}.name must be non-empty`);
        }
        if (!COMBO_MOTIONS.has(beat.motion)) {
          errors.push(`${root}.motion does not support ${JSON.stringify(beat.motion)}`);
        }
        const timing = beat.timing ?? {};
        finiteIn(timing.activeStart, 0, 1, `${root}.timing.activeStart`, errors);
        finiteIn(timing.activeEnd, 0, 1, `${root}.timing.activeEnd`, errors);
        finiteIn(timing.impact, 0, 1, `${root}.timing.impact`, errors);
        finiteIn(timing.followEnd, 0, 1, `${root}.timing.followEnd`, errors);
        if (
          !(
            timing.activeStart < timing.activeEnd &&
            timing.impact >= timing.activeStart &&
            timing.impact <= timing.activeEnd &&
            timing.activeEnd <= timing.followEnd
          )
        ) {
          errors.push(
            `${root}.timing must satisfy activeStart < activeEnd, impact inside active, activeEnd <= followEnd`,
          );
        }
        const path = beat.path ?? {};
        if (!COMBO_PATHS.has(path.kind)) {
          errors.push(`${root}.path.kind does not support ${JSON.stringify(path.kind)}`);
        }
        finiteIn(path.arcMultiplier, -2, 2, `${root}.path.arcMultiplier`, errors);
        finiteIn(path.rangeMultiplier, 0.5, 1.5, `${root}.path.rangeMultiplier`, errors);
        finiteIn(path.damageMultiplier, 0.5, 2, `${root}.path.damageMultiplier`, errors);
        if (path.deltaAngle !== undefined) {
          finiteIn(path.deltaAngle, -Math.PI * 2, Math.PI * 2, `${root}.path.deltaAngle`, errors);
        }
        if (beat.ribbon?.profile !== undefined && !RIBBON_PROFILES.has(beat.ribbon.profile)) {
          errors.push(
            `${root}.ribbon.profile does not support ${JSON.stringify(beat.ribbon.profile)}`,
          );
        }
      }
    }
  }
  return [...new Set(errors)];
}

export function readWeaponCatalog(path = WEAPON_CONCEPTS_PATH) {
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  if (!catalog || !Array.isArray(catalog.weapons)) {
    throw new TypeError("weapon-concepts-300.json must contain a weapons array");
  }
  return catalog;
}

export function readWeaponRow(id, path = WEAPON_CONCEPTS_PATH) {
  const row = readWeaponCatalog(path).weapons.find((candidate) => candidate.id === id);
  return row ? clone(row) : undefined;
}

export function writeWeaponRow(id, next, path = WEAPON_CONCEPTS_PATH) {
  const catalog = readWeaponCatalog(path);
  const index = catalog.weapons.findIndex((candidate) => candidate.id === id);
  if (index < 0) throw new RangeError(`unknown weapon row ${JSON.stringify(id)}`);
  const baseline = catalog.weapons[index];
  const errors = validatePoseStudioRow(next, baseline);
  if (errors.length > 0) {
    const error = new TypeError(errors.join("\n"));
    error.validationErrors = errors;
    throw error;
  }
  catalog.weapons[index] = clone(next);
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return readWeaponRow(id, path);
}

export function poseStudioCatalogSummary(path = WEAPON_CONCEPTS_PATH) {
  return readWeaponCatalog(path)
    .weapons.filter((row) => row.archived !== true)
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      family: row.family,
      grip: row.grip,
      comboBeats: Array.isArray(row.comboBar) ? row.comboBar.length : 0,
      hasGripPoints: !!row.gripPoints,
      recoil: objectAt(row, ["behavior", "recoil"]),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
