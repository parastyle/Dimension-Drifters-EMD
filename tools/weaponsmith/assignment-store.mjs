import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const ROOT = process.env.WEAPONSMITH_DATA_DIR
  ? resolve(process.env.WEAPONSMITH_DATA_DIR)
  : DEFAULT_ROOT;

export const ASSIGNMENTS_DIR = join(ROOT, "assignments");
export const ASSIGNMENTS_AGGREGATE = join(ROOT, "assignments.json");

// Keep the compatibility aggregate in its historical order so rebuilding it does not churn the
// downstream weapon-vfx.generated.ts snapshot. Newly-authored ids follow in lexical order.
const LEGACY_ORDER = [
  "x-sword-buzzsaw",
  "driftblade",
  "rattler-sabre",
  "x-sword-anchor",
  "x-sword-coffin",
  "x-sword-neon-katana",
  "x-sword-bone",
  "x-sword-railspike",
];
const LEGACY_ORDER_INDEX = new Map(LEGACY_ORDER.map((id, index) => [id, index]));
const WEAPON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertWeaponId(id) {
  if (!WEAPON_ID.test(id)) throw new Error(`invalid weapon id: ${JSON.stringify(id)}`);
}

function assignmentPath(id) {
  assertWeaponId(id);
  return join(ASSIGNMENTS_DIR, `${id}.json`);
}

function parseAssignment(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must contain one JSON object`);
  }
  return value;
}

function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${process.pid}-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, text);
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function compareIds(a, b) {
  const ai = LEGACY_ORDER_INDEX.get(a);
  const bi = LEGACY_ORDER_INDEX.get(b);
  if (ai != null || bi != null) {
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

export function readAssignment(id) {
  const path = assignmentPath(id);
  return existsSync(path) ? parseAssignment(path) : null;
}

export function readAssignments() {
  if (!existsSync(ASSIGNMENTS_DIR)) return {};
  const ids = readdirSync(ASSIGNMENTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -".json".length));
  for (const id of ids) assertWeaponId(id);
  ids.sort(compareIds);
  return Object.fromEntries(ids.map((id) => [id, parseAssignment(assignmentPath(id))]));
}

export function writeAssignment(id, assignment) {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) {
    throw new Error(`assignment for ${id} must be a JSON object`);
  }
  atomicWrite(assignmentPath(id), `${JSON.stringify(assignment, null, 2)}\n`);
}

export function aggregateAssignmentsText() {
  return `${JSON.stringify(readAssignments(), null, 2)}\n`;
}

export function writeAssignmentsAggregate() {
  const text = aggregateAssignmentsText();
  atomicWrite(ASSIGNMENTS_AGGREGATE, text);
  return text;
}
