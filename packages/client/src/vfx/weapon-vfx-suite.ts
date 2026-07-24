import { meleeDamageEnvelopeFor, type SwingDescriptor, WEAPONS, type WeaponDef } from "@dd/shared";
import "./vfx-layers.js";
import {
  WEAPON_VFX,
  type WeaponVfx,
  type WeaponVfxLayer,
  type WeaponVfxPaintedAura,
  type WeaponVfxPaintedQuake,
  type WeaponVfxPaintedSwing,
} from "./weapon-vfx.generated.js";

export type WeaponVfxSuite = WeaponVfx["suite"];
export type WeaponVfxAnchor = "character" | "weapon" | "muzzle" | "flight" | "target";

export const HIT_CLASS_TRIGGERS = Object.freeze(["hit", "impact", "blast", "slam"] as const);
export const RIFTCALLER_DELETED_AURA_LAYERS = Object.freeze([
  "shockwave-ring",
  "sigil-ring",
] as const);
/** Legacy generic primitives retained in the dev palette but forbidden from every resolved live suite. */
export const GENERIC_IMPACT_RING_LAYER_IDS = Object.freeze([
  "shockwave-ring",
  "sigil-ring",
] as const);
export const CIRCLE_IMPACT_LAYER_IDS = GENERIC_IMPACT_RING_LAYER_IDS;
/** V6.3 owner-ledger exceptions whose pre-existing fallback hit cue was explicitly ordered on-target. */
export const EXPLICIT_FALLBACK_IMPACT_WEAPON_IDS = Object.freeze([
  "x2-wendigo-claws",
  "x2-revenant-knuckle",
] as const);

export const ELEMENT_HUE: Readonly<Record<string, number>> = Object.freeze({
  physical: 0.55,
  fire: 0.03,
  frost: 0.54,
  shock: 0.63,
  holy: 0.13,
  toxic: 0.32,
  void: 0.8,
  arcane: 0.72,
});

export const ELEMENT_PAINT: Readonly<Record<string, number>> = Object.freeze({
  physical: 0,
  fire: 1,
  frost: 2,
  shock: 3,
  holy: 4,
  toxic: 5,
  void: 6,
  arcane: 7,
});

function paintedImpact(element: string, count = 6, size = 0.72): WeaponVfxLayer {
  return {
    on: true,
    params: { paint: ELEMENT_PAINT[element] ?? 0, count, size },
  };
}

/** Replace every old impact ring with installed element-splat art before a suite reaches live rendering. */
export function replaceGenericImpactRings(suite: WeaponVfxSuite, element: string): WeaponVfxSuite {
  let replaced = false;
  const resolved: WeaponVfxSuite = {};
  for (const [layerId, layer] of Object.entries(suite)) {
    if ((GENERIC_IMPACT_RING_LAYER_IDS as readonly string[]).includes(layerId)) {
      replaced ||= layer.on;
      continue;
    }
    resolved[layerId] = layer;
  }
  if (replaced && !resolved["painted-impact"]?.on)
    resolved["painted-impact"] = paintedImpact(element, 7, 0.78);
  return resolved;
}

function explicitFallbackImpactSuite(weaponId: string): WeaponVfxSuite {
  switch (weaponId) {
    case "x2-wendigo-claws":
      return {
        "hit-spark": { on: true, params: { count: 16, color: ELEMENT_HUE.frost ?? 0.54 } },
        "impact-flash": { on: true, params: { intensity: 0.5 } },
      };
    case "x2-revenant-knuckle":
      return { "painted-impact": paintedImpact("void", 8, 0.84) };
    default:
      return {};
  }
}

export function buildWeaponFallbackSuite(
  _element: string,
  _style: SwingDescriptor["style"],
  _tags?: WeaponDef["tags"],
): WeaponVfxSuite {
  // B24 owner correction: no un-authored weapon may manufacture a painted particle ribbon. The shared
  // PER fallback was the source of the tiny radial/ant particles across the catalog. Explicit named impact
  // exceptions are merged separately below, and every authored suite/effect recipe remains untouched.
  return {};
}

const FALLBACK_CACHE = new Map<string, WeaponVfxSuite>();

export function weaponVfxSuiteFor(
  weaponId: string,
  element: string,
  style: SwingDescriptor["style"],
): { readonly suite: WeaponVfxSuite; readonly authored: boolean; readonly vfx?: WeaponVfx } {
  if (WEAPONS[weaponId]?.suppressVfx) return { suite: {}, authored: true };
  const vfx = WEAPON_VFX[weaponId];
  const authored = !!(vfx?.suite && Object.keys(vfx.suite).length > 0);
  if (authored) return { suite: replaceGenericImpactRings(vfx.suite, element), authored, vfx };
  if (vfx?.suppressFallback) return { suite: {}, authored: true, vfx };
  const key = weaponId || `el:${element}:${style}`;
  let suite = FALLBACK_CACHE.get(key);
  if (!suite) {
    const built = buildWeaponFallbackSuite(element, style, WEAPONS[weaponId]?.tags);
    const explicitImpact = explicitFallbackImpactSuite(weaponId);
    const deleted =
      weaponId === "x2-riftcaller-naginata"
        ? new Set<string>(RIFTCALLER_DELETED_AURA_LAYERS)
        : undefined;
    suite = Object.fromEntries(
      Object.entries({ ...built, ...explicitImpact }).filter(([layerId]) => !deleted?.has(layerId)),
    ) as WeaponVfxSuite;
    FALLBACK_CACHE.set(key, suite);
  }
  return { suite, authored, vfx };
}

export function weaponPaintedAuraFor(
  weaponId: string | undefined,
): WeaponVfxPaintedAura | undefined {
  return weaponId ? WEAPON_VFX[weaponId]?.paintedAura : undefined;
}

export function weaponPaintedSwingFor(
  weaponId: string | undefined,
): WeaponVfxPaintedSwing | undefined {
  return weaponId ? WEAPON_VFX[weaponId]?.paintedSwing : undefined;
}

export interface WeaponPaintedSwingGeometry {
  readonly displayWidth: number;
  readonly forwardExtent: number;
  readonly backwardOverlap: number;
}

/** Size directional painted art so its farthest visible tip is the authoritative melee reach. */
export function weaponPaintedSwingGeometryFor(
  weapon: WeaponDef,
  treatment = weaponPaintedSwingFor(weapon.id),
): WeaponPaintedSwingGeometry | undefined {
  if (!treatment) return undefined;
  const originX = Math.max(0, Math.min(0.95, treatment.originX));
  const forwardExtent = meleeDamageEnvelopeFor(weapon).maxReach * treatment.extentMultiplier;
  const displayWidth = forwardExtent / (1 - originX);
  return Object.freeze({
    displayWidth,
    forwardExtent,
    backwardOverlap: displayWidth * originX,
  });
}

export function weaponPaintedQuakeFor(
  weaponId: string | undefined,
): WeaponVfxPaintedQuake | undefined {
  return weaponId ? WEAPON_VFX[weaponId]?.paintedQuake : undefined;
}

export function weaponVfxLayerAnchor(layerId: string): WeaponVfxAnchor {
  const anchor = globalThis.VFXLAYERS?.LAYERS[layerId]?.anchor;
  if (!anchor) throw new Error(`Weapon VFX layer ${layerId} has no anchor classification`);
  return anchor;
}

export function splitWeaponVfxSuite(suite: WeaponVfxSuite): {
  readonly source: WeaponVfxSuite;
  readonly target: WeaponVfxSuite;
} {
  const source: Record<string, WeaponVfxLayer> = {};
  const target: Record<string, WeaponVfxLayer> = {};
  for (const [layerId, layer] of Object.entries(suite)) {
    if (!layer.on) continue;
    (weaponVfxLayerAnchor(layerId) === "target" ? target : source)[layerId] = layer;
  }
  return { source, target };
}
