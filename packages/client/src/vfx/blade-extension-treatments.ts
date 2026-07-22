import {
  BRUTALIST_GREATSWORD_IDS as SHARED_BRUTALIST_GREATSWORD_IDS,
  type BrutalistGreatswordId as SharedBrutalistGreatswordId,
} from "@dd/shared";
import {
  HEADSMAN_PROTOTYPES,
  type HeadsmanPrototype,
  headsmanPrototypeFromSearch,
  SANCTIFIED_HEADSMAN_ID,
} from "./headsman-prototypes.js";

export const BRUTALIST_GREATSWORD_IDS = SHARED_BRUTALIST_GREATSWORD_IDS;

export type BrutalistGreatswordId = SharedBrutalistGreatswordId;
export type BrutalistGreatswordElement = "ice" | "fire" | "electricity" | "void" | "light" | "rock";

export interface BrutalistGreatswordExtensionTreatment {
  readonly weaponId: BrutalistGreatswordId;
  readonly element: BrutalistGreatswordElement;
  readonly name: string;
  readonly textureKey: string;
  readonly url: string;
}

export type BladeExtensionTreatment = HeadsmanPrototype | BrutalistGreatswordExtensionTreatment;

export const BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS = Object.freeze([
  Object.freeze({
    weaponId: "x2-rimewrit-grave-slab",
    element: "ice",
    name: "Frost Crystal Edge",
    textureKey: "greatsword-extension:frost",
    url: "vfx/brutalist-greatswords/frost-crystal-edge.png",
  }),
  Object.freeze({
    weaponId: "x2-pyre-gallows-brand",
    element: "fire",
    name: "Roaring Flame Blade",
    textureKey: "greatsword-extension:fire",
    url: "vfx/brutalist-greatswords/roaring-flame-blade.png",
  }),
  Object.freeze({
    weaponId: "x2-stormrail-colossus",
    element: "electricity",
    name: "Crackling Arc Edge",
    textureKey: "greatsword-extension:shock",
    url: "vfx/brutalist-greatswords/crackling-arc-edge.png",
  }),
  Object.freeze({
    weaponId: "x2-nullwake-ordinance",
    element: "void",
    name: "Hollow Void Rim",
    textureKey: "greatsword-extension:void",
    url: "vfx/brutalist-greatswords/hollow-void-rim.png",
  }),
  Object.freeze({
    weaponId: "x2-dawnwall-testament",
    element: "light",
    name: "Radiant Daylight Blade",
    textureKey: "greatsword-extension:light",
    url: "vfx/brutalist-greatswords/radiant-daylight-blade.png",
  }),
  Object.freeze({
    weaponId: "x2-cairnfall-monolith",
    element: "rock",
    name: "Jagged Stone Blade",
    textureKey: "greatsword-extension:rock",
    url: "vfx/brutalist-greatswords/jagged-stone-blade.png",
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
