export type KungFuWrapSwingStyle =
  | "crimson-roundhouse-arc"
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
      signature: "teep-elbow-clinch-roundhouse-with-crimson-strike-arc-and-heavy-dust",
      swing: "crimson-roundhouse-arc",
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
      signature: "alternating-mist-purple-weaves-foot-sweep-backflip-head-kick-and-crane",
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

/** Every martial art owns a sample-backed source whoosh; contact remains a separate impact layer. */
export function kungFuWrapBeatAudioCue(
  weaponId: string | undefined,
  _limb: "hand" | "foot" | undefined,
  _motion: string | undefined,
): string | undefined {
  if (!weaponId || !KUNG_FU_WRAP_VFX_RECIPES[weaponId]) return undefined;
  if (weaponId === "x2-muay-thai-wraps") return "kungfu:muay-thai";
  if (weaponId === "x2-wing-chun-wraps") return "kungfu:wing-chun";
  if (weaponId === "x2-drunken-fist-wraps") return "kungfu:drunken-fist";
  return "kungfu:iron-palm";
}
