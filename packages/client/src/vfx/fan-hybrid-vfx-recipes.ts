export type FanHybridProjectileStyle =
  | "iron-gust"
  | "ember-shard-trail"
  | "storm-returning-arc";

export type FanHybridImpactStyle = "iron-gust-fray" | "ember-chip-burst" | "storm-arc-fold";

export interface FanHybridVfxRecipe {
  readonly signature: string;
  readonly projectile: FanHybridProjectileStyle;
  readonly impact: FanHybridImpactStyle;
  readonly primaryColor: number;
  readonly accentColor: number;
}

/** B3's three code-native fan recipes. Runtime authority is carried by WeaponDef.hybridProjectile. */
export const FAN_HYBRID_VFX_RECIPES: Readonly<Record<string, FanHybridVfxRecipe>> = Object.freeze({
  "x2-iron-war-fan": Object.freeze({
    signature: "knife-thin-steel-gust-with-fraying-wind-edges",
    projectile: "iron-gust",
    impact: "iron-gust-fray",
    primaryColor: 0xc8d0d3,
    accentColor: 0x68777d,
  }),
  "x2-ember-fan": Object.freeze({
    signature: "three-cinder-blade-shards-with-hot-ember-trails",
    projectile: "ember-shard-trail",
    impact: "ember-chip-burst",
    primaryColor: 0xff6a24,
    accentColor: 0xffc14f,
  }),
  "x2-storm-fan": Object.freeze({
    signature: "narrow-blue-storm-crescent-that-turns-and-folds-home",
    projectile: "storm-returning-arc",
    impact: "storm-arc-fold",
    primaryColor: 0x73d7ff,
    accentColor: 0xc9f5ff,
  }),
});

export function resolveFanHybridVfxRecipe(
  weaponId: string | undefined,
): FanHybridVfxRecipe | undefined {
  return weaponId ? FAN_HYBRID_VFX_RECIPES[weaponId] : undefined;
}
