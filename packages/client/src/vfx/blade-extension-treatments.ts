import {
  HEADSMAN_PROTOTYPES,
  headsmanPrototypeFromSearch,
  SANCTIFIED_HEADSMAN_ID,
  type HeadsmanPrototype,
} from "./headsman-prototypes.js";

export const BRUTALIST_GREATSWORD_IDS = Object.freeze([
  "x2-rimewrit-grave-slab",
  "x2-pyre-gallows-brand",
  "x2-stormrail-colossus",
  "x2-nullwake-ordinance",
  "x2-dawnwall-testament",
  "x2-cairnfall-monolith",
] as const);

export type BrutalistGreatswordId = (typeof BRUTALIST_GREATSWORD_IDS)[number];
export type BrutalistGreatswordElement = "ice" | "fire" | "electricity" | "void" | "light" | "rock";

export interface BrutalistGreatswordExtensionTreatment {
  readonly weaponId: BrutalistGreatswordId;
  readonly element: BrutalistGreatswordElement;
  readonly name: string;
  readonly textureKey: string;
  readonly url: string;
  readonly thicknessScale: number;
}

export type BladeExtensionTreatment = HeadsmanPrototype | BrutalistGreatswordExtensionTreatment;

export const BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS = Object.freeze([
  Object.freeze({
    weaponId: "x2-rimewrit-grave-slab",
    element: "ice",
    name: "Frost Crystal Edge",
    textureKey: "greatsword-extension:frost",
    url: "vfx/brutalist-greatswords/frost-crystal-edge.png",
    thicknessScale: 0.42,
  }),
  Object.freeze({
    weaponId: "x2-pyre-gallows-brand",
    element: "fire",
    name: "Roaring Flame Blade",
    textureKey: "greatsword-extension:fire",
    url: "vfx/brutalist-greatswords/roaring-flame-blade.png",
    thicknessScale: 0.48,
  }),
  Object.freeze({
    weaponId: "x2-stormrail-colossus",
    element: "electricity",
    name: "Crackling Arc Edge",
    textureKey: "greatsword-extension:shock",
    url: "vfx/brutalist-greatswords/crackling-arc-edge.png",
    thicknessScale: 0.38,
  }),
  Object.freeze({
    weaponId: "x2-nullwake-ordinance",
    element: "void",
    name: "Hollow Void Rim",
    textureKey: "greatsword-extension:void",
    url: "vfx/brutalist-greatswords/hollow-void-rim.png",
    thicknessScale: 0.44,
  }),
  Object.freeze({
    weaponId: "x2-dawnwall-testament",
    element: "light",
    name: "Radiant Daylight Blade",
    textureKey: "greatsword-extension:light",
    url: "vfx/brutalist-greatswords/radiant-daylight-blade.png",
    thicknessScale: 0.4,
  }),
  Object.freeze({
    weaponId: "x2-cairnfall-monolith",
    element: "rock",
    name: "Jagged Stone Blade",
    textureKey: "greatsword-extension:rock",
    url: "vfx/brutalist-greatswords/jagged-stone-blade.png",
    thicknessScale: 0.46,
  }),
] as const satisfies readonly BrutalistGreatswordExtensionTreatment[]);

const BRUTALIST_TREATMENT_BY_ID = new Map(
  BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS.map((treatment) => [treatment.weaponId, treatment]),
);

export const ALL_BLADE_EXTENSION_TEXTURES = Object.freeze([
  ...HEADSMAN_PROTOTYPES,
  ...BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS,
] as const);

export function brutalistGreatswordExtensionFor(
  weaponId: string,
): BrutalistGreatswordExtensionTreatment | undefined {
  return BRUTALIST_TREATMENT_BY_ID.get(weaponId as BrutalistGreatswordId);
}

export function weaponSupportsBladeExtension(weaponId: string): boolean {
  return (
    weaponId === SANCTIFIED_HEADSMAN_ID ||
    BRUTALIST_TREATMENT_BY_ID.has(weaponId as BrutalistGreatswordId)
  );
}

/** One resolver feeds the Headsman and its elemental sibling family into the same geometry/clock seam. */
export function bladeExtensionTreatmentFor(
  weaponId: string,
  search = "",
  hash = "",
): BladeExtensionTreatment | undefined {
  if (weaponId === SANCTIFIED_HEADSMAN_ID) return headsmanPrototypeFromSearch(search, hash);
  return brutalistGreatswordExtensionFor(weaponId);
}
