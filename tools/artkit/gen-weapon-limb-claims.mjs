#!/usr/bin/env node
// Derive presentation-only held/combo limb ownership from the compiled canonical weapon catalog.
// The compiled join is intentional: it gives this pass the exact shared combo resolver, including family,
// signature-variant, choreography-hand, and generated combo-bar routing, without duplicating those laws.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, isCheck } from "./lib/emit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(ROOT, "..", "..");
const OVERRIDES_SRC = join(REPO, "data", "weapon-limb-claim-overrides.json");
const OUT = join(REPO, "packages", "shared", "src", "weapon-limb-claims.generated.ts");

// A normal `pnpm gen` may have just added a catalog row while this generated file is still one pass old.
// Let the compiled join omit only those stale declarations during this import; ordinary runtime imports
// remain fail-fast, and this pass immediately regenerates the complete registry.
globalThis.__DD_GENERATING_WEAPON_LIMB_CLAIMS__ = true;
const { meleeComboSelectionFor, WEAPONS } = await import("../../packages/shared/dist/index.js");

const LIMBS = new Set(["hand-l", "hand-r", "foot-l", "foot-r", "head", "body-lean"]);
const RELEASE_POLICIES = new Set(["snap", "handoff"]);
const HANDOFF = (limb) => ({ limb, release: "handoff" });
const BOTH_HANDS = () => [HANDOFF("hand-l"), HANDOFF("hand-r")];

function heldClaimsFor(weapon) {
  if (
    weapon.tags.classPool === "caster" ||
    weapon.cast ||
    weapon.beam ||
    weapon.glovePair
  ) {
    return BOTH_HANDS();
  }
  switch (weapon.tags.grip) {
    case "1H":
      return [HANDOFF("hand-r")];
    case "2H":
    case "dual":
    case "mounted":
      return BOTH_HANDS();
    default:
      throw new RangeError(`${weapon.id}: unsupported grip ${JSON.stringify(weapon.tags.grip)}`);
  }
}

function beatClaimsFor(step) {
  const side = step.choreography?.hand ?? step.hand;
  const limb = step.limb ?? "hand";
  if (limb === "hand") {
    if (side === "both") return BOTH_HANDS();
    return [HANDOFF(side === "off" ? "hand-l" : "hand-r")];
  }
  if (limb === "foot") {
    if (side === "both") return [HANDOFF("foot-l"), HANDOFF("foot-r")];
    return [HANDOFF(side === "off" ? "foot-l" : "foot-r")];
  }
  throw new RangeError(`unsupported combo limb ${JSON.stringify(limb)}`);
}

function claimListKey(claims) {
  return JSON.stringify(claims);
}

function validateClaims(claims, path) {
  if (!Array.isArray(claims)) throw new TypeError(`${path} must be an array`);
  const seen = new Set();
  for (let index = 0; index < claims.length; index++) {
    const claim = claims[index];
    const claimPath = `${path}[${index}]`;
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      throw new TypeError(`${claimPath} must be an object`);
    }
    const keys = Object.keys(claim);
    if (keys.length !== 2 || !keys.includes("limb") || !keys.includes("release")) {
      throw new TypeError(`${claimPath} must contain exactly limb + release`);
    }
    if (!LIMBS.has(claim.limb)) {
      throw new RangeError(`${claimPath}.limb is invalid: ${JSON.stringify(claim.limb)}`);
    }
    if (!RELEASE_POLICIES.has(claim.release)) {
      throw new RangeError(`${claimPath}.release is invalid: ${JSON.stringify(claim.release)}`);
    }
    if (seen.has(claim.limb)) throw new RangeError(`${path} claims ${claim.limb} twice`);
    seen.add(claim.limb);
  }
}

const declarations = Object.fromEntries(
  Object.entries(WEAPONS).map(([id, weapon]) => {
    const selection = meleeComboSelectionFor(weapon);
    return [
      id,
      {
        held: heldClaimsFor(weapon),
        comboBeats: selection?.sequence.map(beatClaimsFor) ?? [],
      },
    ];
  }),
);

const overrideDocument = JSON.parse(readFileSync(OVERRIDES_SRC, "utf8"));
if (overrideDocument?.schemaVersion !== 1 || !Array.isArray(overrideDocument?.overrides)) {
  throw new TypeError("weapon-limb-claim-overrides.json must be schemaVersion 1 with an overrides array");
}
const overrideKeys = new Set();
for (let index = 0; index < overrideDocument.overrides.length; index++) {
  const override = overrideDocument.overrides[index];
  const path = `overrides[${index}]`;
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    throw new TypeError(`${path} must be an object`);
  }
  const allowed = new Set(["weaponId", "scope", "beat", "claims", "reason"]);
  for (const key of Object.keys(override)) {
    if (!allowed.has(key)) throw new TypeError(`${path} has unknown key ${key}`);
  }
  if (override.scope !== "held" && override.scope !== "comboBeat") {
    throw new RangeError(`${path}.scope must be held or comboBeat`);
  }
  if (typeof override.reason !== "string" || override.reason.trim().length < 12) {
    throw new TypeError(`${path}.reason must explain the authored exception`);
  }
  validateClaims(override.claims, `${path}.claims`);
  const declaration = declarations[override.weaponId];
  if (!declaration) throw new RangeError(`${path} references unknown weapon ${override.weaponId}`);
  const beat = override.scope === "comboBeat" ? override.beat : undefined;
  if (
    override.scope === "comboBeat" &&
    (!Number.isInteger(beat) || beat < 0 || beat >= declaration.comboBeats.length)
  ) {
    throw new RangeError(`${path}.beat is outside ${override.weaponId}'s combo`);
  }
  if (override.scope === "held" && override.beat !== undefined) {
    throw new TypeError(`${path}.beat is forbidden for a held override`);
  }
  const overrideKey = `${override.weaponId}:${override.scope}:${beat ?? "-"}`;
  if (overrideKeys.has(overrideKey)) throw new RangeError(`duplicate override ${overrideKey}`);
  overrideKeys.add(overrideKey);
  const inferred =
    override.scope === "held" ? declaration.held : declaration.comboBeats[beat];
  if (claimListKey(inferred) === claimListKey(override.claims)) {
    throw new RangeError(`${overrideKey} is redundant with inference`);
  }
  if (override.scope === "held") declaration.held = override.claims;
  else declaration.comboBeats[beat] = override.claims;
}

for (const [id, declaration] of Object.entries(declarations)) {
  validateClaims(declaration.held, `${id}.held`);
  declaration.comboBeats.forEach((claims, beat) =>
    validateClaims(claims, `${id}.comboBeats[${beat}]`),
  );
}

const banner =
  "// AUTO-GENERATED by tools/artkit/gen-weapon-limb-claims.mjs — DO NOT EDIT.\n" +
  "// Derived from the compiled canonical weapon/combo catalog plus the reviewed override ledger.\n" +
  "// Claims are presentation metadata only; held + active combo-beat claims form the effective union.\n";
const body =
  'import type { WeaponLimbClaims } from "./weapons.js";\n\n' +
  `export const GENERATED_WEAPON_LIMB_CLAIMS = ${JSON.stringify(declarations, null, 2)} as const ` +
  "satisfies Readonly<Record<string, WeaponLimbClaims>>;\n";
emit(OUT, `${banner}\n${body}`, "weapon-limb-claims.generated.ts");

if (!isCheck) {
  const comboBeats = Object.values(declarations).reduce(
    (sum, declaration) => sum + declaration.comboBeats.length,
    0,
  );
  console.log(
    `wrote weapon-limb-claims.generated.ts — ${Object.keys(declarations).length} weapons / ` +
      `${comboBeats} combo beats / ${overrideDocument.overrides.length} override(s)`,
  );
}
