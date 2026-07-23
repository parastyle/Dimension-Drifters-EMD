import Phaser from "phaser";
import {
  resolveFanHybridVfxRecipe,
  type FanHybridVfxRecipe,
} from "./fan-hybrid-vfx-recipes.js";
export { FAN_HYBRID_VFX_RECIPES, resolveFanHybridVfxRecipe } from "./fan-hybrid-vfx-recipes.js";

interface FanHybridVfxAuditEvent {
  readonly kind: "projectile" | "impact";
  readonly weaponId: string;
  readonly style: string;
  readonly x: number;
  readonly y: number;
}

function auditFanHybridVfx(event: FanHybridVfxAuditEvent): void {
  const audit = globalThis as unknown as {
    __ddB3FanHybridVfxAudit?: FanHybridVfxAuditEvent[];
  };
  if (!audit.__ddB3FanHybridVfxAudit) return;
  audit.__ddB3FanHybridVfxAudit.push(event);
  if (audit.__ddB3FanHybridVfxAudit.length > 256) audit.__ddB3FanHybridVfxAudit.shift();
}

function drawIronGust(graphics: Phaser.GameObjects.Graphics, recipe: FanHybridVfxRecipe): void {
  graphics.lineStyle(4, recipe.primaryColor, 0.94);
  graphics.beginPath().arc(-8, 0, 25, -0.68, 0.68).strokePath();
  graphics.lineStyle(2, recipe.accentColor, 0.75);
  graphics.beginPath().arc(-14, 0, 31, -0.48, 0.48).strokePath();
  graphics.lineBetween(-30, -5, -6, -2);
  graphics.lineBetween(-30, 5, -6, 2);
}

function drawEmberShard(graphics: Phaser.GameObjects.Graphics, recipe: FanHybridVfxRecipe): void {
  graphics.fillStyle(recipe.primaryColor, 0.98).fillTriangle(15, 0, -8, -5, -2, 5);
  graphics.fillStyle(recipe.accentColor, 0.96).fillTriangle(9, 0, -3, -2, 0, 2);
  graphics.fillStyle(0x611d16, 0.9).fillTriangle(-4, 0, -12, -3, -9, 3);
}

function drawStormArc(graphics: Phaser.GameObjects.Graphics, recipe: FanHybridVfxRecipe): void {
  graphics.lineStyle(6, 0x17395e, 0.86);
  graphics.beginPath().arc(-7, 0, 24, -0.88, 0.88).strokePath();
  graphics.lineStyle(3, recipe.primaryColor, 0.98);
  graphics.beginPath().arc(-7, 0, 24, -0.82, 0.82).strokePath();
  graphics.lineStyle(1.5, recipe.accentColor, 0.96);
  graphics.beginPath().arc(-7, 0, 19, -0.72, 0.72).strokePath();
}

/** Build the visible payload for one server-replicated B3 projectile row. */
export function makeFanHybridProjectile(
  scene: Phaser.Scene,
  projectile: Readonly<{ x: number; y: number; vx: number; vy: number }>,
  weaponId: string,
): Phaser.GameObjects.Container | null {
  const recipe = resolveFanHybridVfxRecipe(weaponId);
  if (!recipe) return null;
  const graphics = scene.add.graphics();
  const trail =
    recipe.projectile === "ember-shard-trail"
      ? scene.add
          .ellipse(-17, 0, 31, 7, recipe.primaryColor, 0.34)
          .setBlendMode(Phaser.BlendModes.ADD)
      : recipe.projectile === "storm-returning-arc"
        ? scene.add
            .ellipse(-15, 0, 34, 5, recipe.primaryColor, 0.2)
            .setBlendMode(Phaser.BlendModes.ADD)
        : scene.add.ellipse(-15, 0, 32, 3, recipe.primaryColor, 0.18);
  if (recipe.projectile === "iron-gust") drawIronGust(graphics, recipe);
  else if (recipe.projectile === "ember-shard-trail") drawEmberShard(graphics, recipe);
  else drawStormArc(graphics, recipe);
  const payload = scene.add
    .container(0, 0, [trail, graphics])
    .setRotation(Math.atan2(projectile.vy, projectile.vx));
  const container = scene.add
    .container(projectile.x, projectile.y, [payload])
    .setDepth(99100)
    .setData("fanHybridPayload", payload)
    .setData("fanHybridProjectileStyle", recipe.projectile)
    .setData("fanHybridWeaponId", weaponId)
    .setData("ang", Math.atan2(projectile.vy, projectile.vx));
  auditFanHybridVfx({
    kind: "projectile",
    weaponId,
    style: recipe.projectile,
    x: projectile.x,
    y: projectile.y,
  });
  return container;
}

/** Projectile-removal punctuation stays distinct for steel wind, ember chips, and folding storm arcs. */
export function spawnFanHybridImpact(
  scene: Phaser.Scene,
  weaponId: string | undefined,
  x: number,
  y: number,
  angle = 0,
  reducedMotion = false,
): boolean {
  const recipe = resolveFanHybridVfxRecipe(weaponId);
  if (!recipe) return false;
  const graphics = scene.add.graphics().setPosition(x, y).setDepth(99200);
  graphics.setData("fanHybridImpactStyle", recipe.impact);
  graphics.setData("fanHybridWeaponId", weaponId);
  if (recipe.impact === "iron-gust-fray") {
    graphics.lineStyle(2, recipe.primaryColor, 0.85);
    for (let index = -2; index <= 2; index++)
      graphics.lineBetween(
        Math.cos(angle) * -5 - Math.sin(angle) * index * 3,
        Math.sin(angle) * -5 + Math.cos(angle) * index * 3,
        Math.cos(angle) * (17 + Math.abs(index) * 3) - Math.sin(angle) * index * 5,
        Math.sin(angle) * (17 + Math.abs(index) * 3) + Math.cos(angle) * index * 5,
      );
  } else if (recipe.impact === "ember-chip-burst") {
    for (let index = 0; index < (reducedMotion ? 5 : 9); index++) {
      const a = angle + Math.PI + (index / 8 - 0.5) * 2;
      const radius = 9 + (index % 3) * 6;
      graphics
        .fillStyle(index % 2 ? recipe.primaryColor : recipe.accentColor, 0.94)
        .fillTriangle(
          Math.cos(a) * radius,
          Math.sin(a) * radius,
          Math.cos(a + 0.18) * (radius + 7),
          Math.sin(a + 0.18) * (radius + 7),
          Math.cos(a - 0.14) * (radius + 4),
          Math.sin(a - 0.14) * (radius + 4),
        );
    }
  } else {
    graphics.lineStyle(4, recipe.primaryColor, 0.9);
    graphics.beginPath().arc(0, 0, 23, angle + 1.9, angle + 4.4).strokePath();
    graphics.lineStyle(2, recipe.accentColor, 0.92);
    graphics.beginPath().arc(0, 0, 15, angle - 1.2, angle + 1.2).strokePath();
  }
  auditFanHybridVfx({
    kind: "impact",
    weaponId: weaponId ?? "",
    style: recipe.impact,
    x,
    y,
  });
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    scaleX: reducedMotion ? 1.08 : 1.35,
    scaleY: reducedMotion ? 1.04 : 1.22,
    duration: recipe.impact === "storm-arc-fold" ? 300 : 220,
    ease: "Quad.easeOut",
    onComplete: () => graphics.destroy(),
  });
  return true;
}
