export type WackyProjectileStyle =
  | "none"
  | "fish"
  | "present"
  | "bubble"
  | "confetti"
  | "own-sprite-return";
export type WackyImpactStyle =
  | "none"
  | "wet-slap"
  | "squeak-ring"
  | "confetti-burst"
  | "bubble-pop";
export type WackyImpactTrigger = "none" | "receipt" | "projectile-death";

export interface WackyWeaponVfxRecipe {
  readonly signature: string;
  readonly projectile: WackyProjectileStyle;
  readonly impact: WackyImpactStyle;
  readonly impactTrigger: WackyImpactTrigger;
  readonly shotAudio?: string;
  readonly impactAudio?: string;
}

/** B2's visual identity ledger. Mechanical uniqueness lives in WeaponDef; these signatures prove the art layer too. */
export const WACKY_WEAPON_VFX_RECIPES: Readonly<Record<string, WackyWeaponVfxRecipe>> =
  Object.freeze({
    "x2-unicorn-rainbow-beam": Object.freeze({
      signature: "anchored-broad-five-strand-rainbow-ribbon",
      projectile: "none",
      impact: "none",
      impactTrigger: "none",
    }),
    "x2-fish-launcher": Object.freeze({
      signature: "tumbling-fish-cone-wet-slap",
      projectile: "fish",
      impact: "wet-slap",
      impactTrigger: "receipt",
      impactAudio: "wacky:wet-slap",
    }),
    "x2-squeaky-mallet": Object.freeze({
      signature: "short-overhead-mauler-squeak-ring",
      projectile: "none",
      impact: "squeak-ring",
      impactTrigger: "receipt",
      impactAudio: "wacky:squeak-hit",
    }),
    "x2-exploding-present-lobber": Object.freeze({
      signature: "arced-present-confetti-detonation",
      projectile: "present",
      impact: "confetti-burst",
      impactTrigger: "projectile-death",
    }),
    "x2-bubble-wand-swarm-caster": Object.freeze({
      signature: "five-drifting-bubbles-small-pop-aoe",
      projectile: "bubble",
      impact: "bubble-pop",
      impactTrigger: "projectile-death",
    }),
    "x2-boomerang-boot": Object.freeze({
      signature: "own-sprite-spinning-boot-return-flight",
      projectile: "own-sprite-return",
      impact: "none",
      impactTrigger: "none",
    }),
    "x2-confetti-cannon": Object.freeze({
      signature: "seven-shard-chaotic-shotgun-burst",
      projectile: "confetti",
      impact: "confetti-burst",
      impactTrigger: "projectile-death",
      shotAudio: "wacky:confetti-shot",
    }),
  });

export function resolveWackyWeaponVfxRecipe(
  weaponId: string | undefined,
): WackyWeaponVfxRecipe | undefined {
  return weaponId ? WACKY_WEAPON_VFX_RECIPES[weaponId] : undefined;
}

export function wackyWeaponShotAudioCue(
  weaponId: string | undefined,
  fallback: string,
): string {
  return resolveWackyWeaponVfxRecipe(weaponId)?.shotAudio ?? fallback;
}
