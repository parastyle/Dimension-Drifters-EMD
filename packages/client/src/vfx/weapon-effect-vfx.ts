import Phaser from "phaser";
import { particleBurst } from "./particles.js";
import type { WeaponEffectRecipe } from "./weapon-effect-recipes.js";

export function spawnWeaponProjectileImpact(
  scene: Phaser.Scene,
  recipe: WeaponEffectRecipe | undefined,
  x: number,
  y: number,
  angle: number,
): void {
  if (!recipe?.impactPack) return;
  particleBurst(scene, recipe.impactPack, x, y, {
    count: recipe.projectile === "electric-bolt" ? 12 : 8,
    dirRad: angle,
    spread: recipe.projectile === "electric-bolt" ? Math.PI : 1.4,
    speed: recipe.projectile === "electric-bolt" ? 210 : 150,
    scale: 0.42,
    lifeMs: 360,
    additive: recipe.additive,
  });
  if (recipe.projectile === "electric-bolt") {
    const ring = scene.add.circle(x, y, 12).setStrokeStyle(3, 0x2f8fff, 0.9).setDepth(99501);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: ring,
      scale: 3.1,
      alpha: 0,
      duration: 260,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }
}

export function spawnWeaponSwingIdentity(
  scene: Phaser.Scene,
  recipe: WeaponEffectRecipe | undefined,
  x: number,
  y: number,
  angle: number,
): void {
  if (!recipe?.swingPack) return;
  particleBurst(scene, recipe.swingPack, x, y, {
    count: recipe.swingCount ?? 6,
    dirRad: angle,
    spread: recipe.noGore ? 0.75 : 0.42,
    speed: recipe.noGore ? 105 : 170,
    scale: recipe.noGore ? 0.34 : 0.46,
    lifeMs: recipe.noGore ? 420 : 330,
    additive: recipe.additive,
    sink: recipe.noGore ? 18 : 0,
  });
}

/** Procedural loose sheets match the existing tome/page glyph vocabulary; no bitmap asset is needed. */
export function spawnScatteredPages(
  scene: Phaser.Scene,
  nodes: readonly { x: number; y: number }[],
  lifeMs: number,
): void {
  for (let link = 0; link < nodes.length - 1; link++) {
    const from = nodes[link];
    const to = nodes[link + 1];
    if (!from || !to) continue;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const count = Math.max(3, Math.min(8, Math.ceil(distance / 42)));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.2 + Math.random() * 0.6) / count;
      const lateral = (Math.random() - 0.5) * 42;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      const page = scene.add
        .rectangle(
          from.x + (to.x - from.x) * t + nx * lateral,
          from.y + (to.y - from.y) * t + ny * lateral,
          10,
          7,
          0xe8e4d8,
          0.95,
        )
        .setStrokeStyle(1, 0x5a6472, 0.9)
        .setRotation(angle + (Math.random() - 0.5) * 1.2)
        .setDepth(99500);
      scene.tweens.add({
        targets: page,
        x: page.x + Math.cos(angle) * (18 + Math.random() * 28) + nx * lateral * 0.5,
        y: page.y + Math.sin(angle) * (18 + Math.random() * 28) + ny * lateral * 0.5,
        angle: page.angle + (Math.random() < 0.5 ? -160 : 160),
        alpha: 0,
        duration: lifeMs * (0.75 + Math.random() * 0.45),
        ease: "Sine.easeOut",
        onComplete: () => page.destroy(),
      });
    }
  }
}
