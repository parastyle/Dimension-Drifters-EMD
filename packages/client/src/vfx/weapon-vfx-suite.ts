import { type SwingDescriptor, WEAPONS, type WeaponDef } from "@dd/shared";
import "./vfx-layers.js";
import { WEAPON_VFX, type WeaponVfx, type WeaponVfxLayer } from "./weapon-vfx.generated.js";

export type WeaponVfxSuite = WeaponVfx["suite"];
export type WeaponVfxAnchor = "character" | "weapon" | "muzzle" | "flight" | "target";

export const HIT_CLASS_TRIGGERS = Object.freeze(["hit", "impact", "blast", "slam"] as const);
export const RIFTCALLER_DELETED_AURA_LAYERS = Object.freeze([
  "shockwave-ring",
  "sigil-ring",
] as const);
export const CIRCLE_IMPACT_LAYER_IDS = Object.freeze(["shockwave-ring", "sigil-ring"] as const);

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

const ELEMENT_COLOR: Readonly<Record<string, number>> = Object.freeze({
  physical: 0xd6dde6,
  fire: 0xff6a2a,
  frost: 0x6fd6ff,
  shock: 0xffe24a,
  holy: 0xffe6a0,
  toxic: 0x9cff3b,
  void: 0xb14bff,
  arcane: 0x8f6aff,
});

function elementFlourish(element: string, hue: number): WeaponVfxSuite {
  switch (element) {
    case "fire":
      return {
        "ember-rain": { on: true, params: { count: 14, color: hue } },
        "impact-flash": { on: true, params: { intensity: 0.6 } },
      };
    case "shock":
      return {
        "arc-bolt": { on: true, params: { color: hue } },
        "shockwave-ring": { on: true, params: { color: hue } },
      };
    case "frost":
      return {
        "hit-spark": { on: true, params: { count: 16, color: hue } },
        "impact-flash": { on: true, params: { intensity: 0.5 } },
      };
    case "holy":
      return {
        "sigil-ring": { on: true, params: { color: hue, size: 1 } },
        "impact-flash": { on: true, params: { intensity: 0.65 } },
      };
    case "toxic":
      return {
        "ember-rain": { on: true, params: { count: 12, color: hue } },
        "hit-spark": { on: true, params: { count: 10, color: hue } },
      };
    case "void":
      return {
        "shockwave-ring": { on: true, params: { color: hue } },
        "sigil-ring": { on: true, params: { color: hue, size: 1.1 } },
      };
    case "arcane":
      return {
        "sigil-ring": { on: true, params: { color: hue, size: 1.2 } },
        "arc-bolt": { on: true, params: { color: hue } },
      };
    default:
      return {};
  }
}

export function buildWeaponFallbackSuite(
  element: string,
  style: SwingDescriptor["style"],
  tags?: WeaponDef["tags"],
): WeaponVfxSuite {
  const hue = ELEMENT_HUE[element] ?? 0.55;
  const heavy =
    style === "chop" || (tags?.grip === "2H" && (tags?.size === "L" || tags?.size === "XL"));
  const reachy = style === "thrust";
  const dual = tags?.grip === "dual";
  const energy = /energy|plasma|laser|beam|photon|volt|light|neon/.test(
    (tags?.family ?? "").toLowerCase(),
  );
  const blunt = /mace|maul|warhammer|hammer|gauntlet|fist|knuckle/.test(
    (tags?.family ?? "").toLowerCase(),
  );
  const perParams = {
    reach: 1,
    paint: ELEMENT_PAINT[element] ?? 0,
    history: 1,
    bodyAlpha: energy ? 0.52 : heavy || blunt ? 0.78 : 0.72,
    lipAlpha: energy ? 0.72 : heavy || blunt ? 0.36 : reachy ? 0.58 : 0.54,
    lipColor: ELEMENT_COLOR[element] ?? 0xd6dde6,
    color: hue,
  };
  let base: WeaponVfxSuite;
  if (dual) base = { "twin-slash": { on: true, params: perParams } };
  else if (reachy) base = { "thrust-streak": { on: true, params: perParams } };
  else if (heavy)
    base = {
      "blade-trail": { on: true, params: perParams },
      "cleave-flash": { on: true, params: { intensity: 0.85 } },
      "shockwave-ring": { on: true, params: { color: hue } },
    };
  else base = { "blade-trail": { on: true, params: perParams } };
  if (energy) base["impact-flash"] = { on: true, params: { intensity: 0.6 } };
  return { ...base, ...elementFlourish(element, hue) };
}

const FALLBACK_CACHE = new Map<string, WeaponVfxSuite>();

export function weaponVfxSuiteFor(
  weaponId: string,
  element: string,
  style: SwingDescriptor["style"],
): { readonly suite: WeaponVfxSuite; readonly authored: boolean; readonly vfx?: WeaponVfx } {
  const vfx = WEAPON_VFX[weaponId];
  const authored = !!(vfx?.suite && Object.keys(vfx.suite).length > 0);
  if (authored) return { suite: vfx.suite, authored, vfx };
  const key = weaponId || `el:${element}:${style}`;
  let suite = FALLBACK_CACHE.get(key);
  if (!suite) {
    const built = buildWeaponFallbackSuite(element, style, WEAPONS[weaponId]?.tags);
    const deleted =
      weaponId === "x2-riftcaller-naginata"
        ? new Set<string>(RIFTCALLER_DELETED_AURA_LAYERS)
        : undefined;
    suite = Object.fromEntries(
      Object.entries(built).filter(([layerId]) => !deleted?.has(layerId)),
    ) as WeaponVfxSuite;
    FALLBACK_CACHE.set(key, suite);
  }
  return { suite, authored, vfx };
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
