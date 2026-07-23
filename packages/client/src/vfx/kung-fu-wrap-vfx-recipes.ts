export type KungFuWrapSwingStyle =
  | "red-eight-limbs-aura"
  | "white-centerline-flash"
  | "mist-purple-sway-sweep"
  | "black-iron-drive";

export type KungFuWrapImpactStyle =
  | "heavy-dust-cloud"
  | "precise-white-flash"
  | "misty-purple-wide-sweep"
  | "iron-sparks-shockwave";

export interface KungFuWrapVfxRecipe {
  readonly signature: string;
  readonly swing: KungFuWrapSwingStyle;
  readonly impact: KungFuWrapImpactStyle;
  readonly primaryColor: number;
  readonly accentColor: number;
  readonly impactAudio?: string;
}

export const KUNG_FU_WRAP_VFX_RECIPES: Readonly<Record<string, KungFuWrapVfxRecipe>> =
  Object.freeze({
    "x2-muay-thai-wraps": Object.freeze({
      signature: "heavy-dust-cloud-impact-with-crimson-eight-limbs-aura",
      swing: "red-eight-limbs-aura",
      impact: "heavy-dust-cloud",
      primaryColor: 0xd74737,
      accentColor: 0x6f1d25,
    }),
    "x2-wing-chun-wraps": Object.freeze({
      signature: "three-precise-white-centerline-flashes-at-rapid-cadence",
      swing: "white-centerline-flash",
      impact: "precise-white-flash",
      primaryColor: 0xf8f7f2,
      accentColor: 0xc9d4d8,
    }),
    "x2-drunken-fist-wraps": Object.freeze({
      signature: "mist-purple-sway-haze-ending-in-a-wide-gourd-sweep",
      swing: "mist-purple-sway-sweep",
      impact: "misty-purple-wide-sweep",
      primaryColor: 0x8d63b7,
      accentColor: 0xd1afd9,
    }),
    "x2-iron-palm-wraps": Object.freeze({
      signature: "clanging-iron-knuckle-sparks-with-a-concentric-shockwave",
      swing: "black-iron-drive",
      impact: "iron-sparks-shockwave",
      primaryColor: 0xd9c38b,
      accentColor: 0x8e969b,
      impactAudio: "kungfu:iron-clang",
    }),
  });

export function resolveKungFuWrapVfxRecipe(
  weaponId: string | undefined,
): KungFuWrapVfxRecipe | undefined {
  return weaponId ? KUNG_FU_WRAP_VFX_RECIPES[weaponId] : undefined;
}
