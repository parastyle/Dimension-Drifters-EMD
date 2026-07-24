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
      signature: "teep-elbow-clinch-spin-with-crimson-eight-limbs-aura-and-heavy-dust",
      swing: "red-eight-limbs-aura",
      impact: "heavy-dust-cloud",
      primaryColor: 0xd74737,
      accentColor: 0x6f1d25,
    }),
    "x2-wing-chun-wraps": Object.freeze({
      signature: "three-white-centerline-flashes-oblique-foot-cut-double-palm-burst",
      swing: "white-centerline-flash",
      impact: "precise-white-flash",
      primaryColor: 0xf8f7f2,
      accentColor: 0xc9d4d8,
    }),
    "x2-drunken-fist-wraps": Object.freeze({
      signature: "alternating-mist-purple-weaves-foot-sweep-and-falling-haymaker",
      swing: "mist-purple-sway-sweep",
      impact: "misty-purple-wide-sweep",
      primaryColor: 0x8d63b7,
      accentColor: 0xd1afd9,
    }),
    "x2-iron-palm-wraps": Object.freeze({
      signature: "crushing-palm-stomp-windup-double-palm-iron-quake",
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

/** Reuse B14's sample-backed melee palette while making hand, foot, speed, and weight audible per beat. */
export function kungFuWrapBeatAudioCue(
  weaponId: string | undefined,
  limb: "hand" | "foot" | undefined,
  motion: string | undefined,
): string | undefined {
  if (!weaponId || !KUNG_FU_WRAP_VFX_RECIPES[weaponId]) return undefined;
  if (limb === "foot") return "melee:blunt";
  if (weaponId === "x2-wing-chun-wraps") return "melee:light";
  if (weaponId === "x2-drunken-fist-wraps") return "melee:arcane";
  if (weaponId === "x2-iron-palm-wraps")
    return motion === "quake-double-palm" ? "melee:heavy" : "melee:blunt";
  return "melee:heavy";
}
