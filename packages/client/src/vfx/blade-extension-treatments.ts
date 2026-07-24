import {
  MIRAGE_HARDLIGHT_SABER_ID,
  BRUTALIST_GREATSWORD_IDS as SHARED_BRUTALIST_GREATSWORD_IDS,
  type BladeExtensionWeaponId as SharedBladeExtensionWeaponId,
  type BrutalistGreatswordId as SharedBrutalistGreatswordId,
} from "@dd/shared";
import type Phaser from "phaser";

export const BRUTALIST_GREATSWORD_IDS = SHARED_BRUTALIST_GREATSWORD_IDS;

export type BrutalistGreatswordId = SharedBrutalistGreatswordId;
export type BladeExtensionWeaponId = SharedBladeExtensionWeaponId;
export type BrutalistGreatswordElement = "ice" | "fire" | "electricity" | "void" | "light" | "rock";

export interface BrutalistGreatswordExtensionTreatment {
  readonly weaponId: BrutalistGreatswordId;
  readonly kind: "image";
  readonly element: BrutalistGreatswordElement;
  readonly name: string;
  readonly textureKey: string;
  readonly url: string;
}

export interface HardlightExtensionRecipe {
  readonly textureWidth: number;
  readonly textureHeight: number;
  readonly outerGlow: string;
  readonly edge: string;
  readonly blade: string;
  readonly core: string;
  readonly tip: string;
}

export interface MirageHardlightExtensionTreatment {
  readonly weaponId: typeof MIRAGE_HARDLIGHT_SABER_ID;
  readonly kind: "procedural-hardlight";
  readonly element: "hardlight";
  readonly name: string;
  readonly textureKey: string;
  readonly recipe: HardlightExtensionRecipe;
}

export type BladeExtensionTreatment =
  | BrutalistGreatswordExtensionTreatment
  | MirageHardlightExtensionTreatment;

export const BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS = Object.freeze([
  Object.freeze({
    weaponId: "x2-rimewrit-grave-slab",
    kind: "image",
    element: "ice",
    name: "Frost Crystal Edge",
    textureKey: "greatsword-extension:frost",
    url: "vfx/brutalist-greatswords/frost-crystal-edge.png",
  }),
  Object.freeze({
    weaponId: "x2-pyre-gallows-brand",
    kind: "image",
    element: "fire",
    name: "Roaring Flame Blade",
    textureKey: "greatsword-extension:fire",
    url: "vfx/brutalist-greatswords/roaring-flame-blade.png",
  }),
  Object.freeze({
    weaponId: "x2-stormrail-colossus",
    kind: "image",
    element: "electricity",
    name: "Crackling Arc Edge",
    textureKey: "greatsword-extension:shock",
    url: "vfx/brutalist-greatswords/crackling-arc-edge.png",
  }),
  Object.freeze({
    weaponId: "x2-nullwake-ordinance",
    kind: "image",
    element: "void",
    name: "Hollow Void Rim",
    textureKey: "greatsword-extension:void",
    url: "vfx/brutalist-greatswords/hollow-void-rim.png",
  }),
  Object.freeze({
    weaponId: "x2-dawnwall-testament",
    kind: "image",
    element: "light",
    name: "Radiant Daylight Blade",
    textureKey: "greatsword-extension:light",
    url: "vfx/brutalist-greatswords/radiant-daylight-blade.png",
  }),
  Object.freeze({
    weaponId: "x2-cairnfall-monolith",
    kind: "image",
    element: "rock",
    name: "Jagged Stone Blade",
    textureKey: "greatsword-extension:rock",
    url: "vfx/brutalist-greatswords/jagged-stone-blade.png",
  }),
] as const satisfies readonly BrutalistGreatswordExtensionTreatment[]);

/** The source saber already owns the emitter and short cyan blade. This recipe paints only the
 * blade-local extension: a translucent cyan field, crisp energized edge, and white-hot core/tip. */
export const MIRAGE_HARDLIGHT_EXTENSION_TREATMENT = Object.freeze({
  weaponId: MIRAGE_HARDLIGHT_SABER_ID,
  kind: "procedural-hardlight",
  element: "hardlight",
  name: "Mirage Cyan Hardlight",
  textureKey: "blade-extension:mirage-hardlight",
  recipe: Object.freeze({
    textureWidth: 528,
    textureHeight: 96,
    outerGlow: "rgba(24, 230, 255, 0.24)",
    edge: "rgba(0, 183, 220, 0.82)",
    blade: "rgba(35, 232, 255, 0.94)",
    core: "rgba(229, 255, 255, 0.98)",
    tip: "rgba(255, 255, 255, 1)",
  }),
} as const satisfies MirageHardlightExtensionTreatment);

export const ALL_BLADE_EXTENSION_TEXTURES = Object.freeze([
  ...BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS,
] as const);

export const ALL_BLADE_EXTENSION_TREATMENTS = Object.freeze([
  ...BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS,
  MIRAGE_HARDLIGHT_EXTENSION_TREATMENT,
] as const satisfies readonly BladeExtensionTreatment[]);

const BRUTALIST_TREATMENT_BY_ID = new Map(
  BRUTALIST_GREATSWORD_EXTENSION_TREATMENTS.map((treatment) => [treatment.weaponId, treatment]),
);

const TREATMENT_BY_ID = new Map(
  ALL_BLADE_EXTENSION_TREATMENTS.map((treatment) => [treatment.weaponId, treatment]),
);

export function brutalistGreatswordExtensionFor(
  weaponId: string,
): BrutalistGreatswordExtensionTreatment | undefined {
  return BRUTALIST_TREATMENT_BY_ID.get(weaponId as BrutalistGreatswordId);
}

export function weaponSupportsBladeExtension(weaponId: string): boolean {
  return TREATMENT_BY_ID.has(weaponId as BladeExtensionWeaponId);
}

/** One resolver feeds every authored material treatment into the shared geometry/clock seam. */
export function bladeExtensionTreatmentFor(weaponId: string): BladeExtensionTreatment | undefined {
  return TREATMENT_BY_ID.get(weaponId as BladeExtensionWeaponId);
}

function drawHardlightBand(
  context: CanvasRenderingContext2D,
  recipe: HardlightExtensionRecipe,
  inset: number,
  tipShoulder: number,
  color: string,
): void {
  const { textureWidth: width, textureHeight: height, tip } = recipe;
  const centerY = height * 0.5;
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.82, color);
  gradient.addColorStop(1, tip);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(0, inset);
  context.lineTo(width - tipShoulder, inset);
  context.lineTo(width - 1, centerY);
  context.lineTo(width - tipShoulder, height - inset);
  context.lineTo(0, height - inset);
  context.closePath();
  context.fill();
}

/** Materialize the Mirage recipe once in Phaser's texture manager. The retained renderer stretches this
 * blade-local texture to the exact shared geometry and alpha-measured held-blade width. */
export function ensureProceduralBladeExtensionTextures(scene: Phaser.Scene): void {
  const treatment = MIRAGE_HARDLIGHT_EXTENSION_TREATMENT;
  if (scene.textures.exists(treatment.textureKey)) return;
  const recipe = treatment.recipe;
  const texture = scene.textures.createCanvas(
    treatment.textureKey,
    recipe.textureWidth,
    recipe.textureHeight,
  );
  if (!texture) throw new Error(`Unable to create ${treatment.name} texture`);
  const context = texture.getContext();
  context.clearRect(0, 0, recipe.textureWidth, recipe.textureHeight);
  context.save();
  context.globalCompositeOperation = "lighter";
  drawHardlightBand(context, recipe, 2, 42, recipe.outerGlow);
  drawHardlightBand(context, recipe, 11, 34, recipe.edge);
  drawHardlightBand(context, recipe, 18, 27, recipe.blade);
  drawHardlightBand(context, recipe, 32, 17, recipe.core);
  context.restore();
  texture.refresh();
}
