import type Phaser from "phaser";
import { isThrownProjectileKind, WEAPONS } from "@dd/shared";
import { makeCasterProjectile } from "../../vfx/caster-vfx.js";
import { resolveCasterVfxRecipe } from "../../vfx/caster-vfx-recipes.js";
import { makeGeneratedImageWeaponProjectile } from "../../vfx/generated-image-weapon-vfx.js";
import { resolveWeaponEffectRecipe } from "../../vfx/weapon-effect-recipes.js";
import { makeWackyProjectile } from "../../vfx/wacky-weapon-vfx.js";
import {
  baseKind,
  GUN_FX,
  gunFx,
  makeBullet,
  makeCounter,
  makeEmberleafFireball,
  makeGunIdentityProjectile,
  makeMagma,
  makeRimechoirPressureWedge,
  makeSpit,
  makeThrownWeapon,
} from "./projectile-factory.js";

/**
 * ONE place that decides what a projectile looks like.
 *
 * This selection chain used to live inline in `ArenaScene.syncProjectiles`. The squad autobattler was
 * calling only two of its branches, so it drew generic tracers where the arena draws the authored art —
 * the owner's report that "we're not using the same projectiles we've authored from the other mode". A
 * second copy would have drifted the same way again, so both scenes now call this.
 *
 * Order matters and is preserved exactly from the arena: bespoke one-off kinds first, then per-weapon
 * authored art (generated image, "wacky", gun identity), then recipe-driven treatments, then the generic
 * fallbacks. Each entry is `?? next`, so any weapon without authored art degrades to the same tracer the
 * arena would show — never to nothing.
 */
export interface ProjectileSnapshot {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly kind: string;
  /** Authored per-projectile size. Synced state carries it; a serverless caller may omit it. */
  readonly visualScale?: number;
}

export function makeProjectileArt(
  scene: Phaser.Scene,
  pr: ProjectileSnapshot,
  sourceWeaponId: string,
  reducedMotion = false,
): Phaser.GameObjects.Container {
  const sourceWeapon = WEAPONS[sourceWeaponId];
  const weaponEffectRecipe = resolveWeaponEffectRecipe(sourceWeapon);
  const projectileKind = baseKind(pr.kind);
  const comet = projectileKind === "fireball";
  const casterOwnsKind =
    sourceWeapon?.tags.classPool === "caster" &&
    !comet &&
    ((!!sourceWeapon.cast && projectileKind === "orb") ||
      (!!sourceWeapon.scatter && projectileKind === "magma") ||
      (!!sourceWeapon.gun && projectileKind === baseKind(sourceWeapon.gun.bulletKind)));
  const casterRecipe = casterOwnsKind ? resolveCasterVfxRecipe(sourceWeapon) : undefined;
  const fx = comet ? gunFx("orb:fire") : GUN_FX[projectileKind];
  /** Each gun authors its own projectile size; never substitute a blanket scale for it. */
  const visualScale = sourceWeapon?.gun?.projectileVisualScale ?? 1;
  const gunIdentity = sourceWeapon?.gun
    ? makeGunIdentityProjectile(scene, pr, sourceWeaponId, visualScale)
    : null;
  const wackyIdentity = sourceWeapon ? makeWackyProjectile(scene, pr, sourceWeapon.id) : null;
  const generatedImageIdentity = sourceWeapon
    ? makeGeneratedImageWeaponProjectile(scene, pr, sourceWeapon.id)
    : null;

  return (
    (pr.kind === "emberleaf-fireball"
      ? makeEmberleafFireball(scene, { ...pr, visualScale: pr.visualScale ?? 1 })
      : null) ??
    (pr.kind === "rimechoir-pressure-wedge"
      ? makeRimechoirPressureWedge(scene, { ...pr, visualScale: pr.visualScale ?? 1 })
      : null) ??
    generatedImageIdentity ??
    wackyIdentity ??
    gunIdentity ??
    (weaponEffectRecipe?.projectile === "electric-bolt"
      ? makeBullet(scene, pr, visualScale, weaponEffectRecipe)
      : weaponEffectRecipe?.projectile === "crystal-shard-orb"
        ? makeMagma(scene, pr, weaponEffectRecipe)
        : casterRecipe
          ? makeCasterProjectile(scene, pr, casterRecipe, reducedMotion, visualScale)
          : fx
            ? makeBullet(scene, pr, visualScale)
            : isThrownProjectileKind(pr.kind)
              ? makeThrownWeapon(scene, pr)
              : baseKind(pr.kind) === "magma"
                ? makeMagma(scene, pr)
                : pr.kind === "counter" || pr.kind === "deflect"
                  ? makeCounter(scene, pr)
                  : makeSpit(scene, pr))
  );
}

/**
 * The projectile kind a weapon fires when nothing authoritative supplies one.
 *
 * The arena gets `kind` from synced server state. A standalone scene has no server, so it has to derive the
 * same value from the weapon itself, or every caster would fall through to the generic tracer.
 */
export function defaultProjectileKind(weaponId: string): string {
  const def = WEAPONS[weaponId];
  if (def?.gun?.bulletKind) return def.gun.bulletKind;
  if (def?.cast) return "orb";
  if (def?.scatter) return "magma";
  return "spark";
}
