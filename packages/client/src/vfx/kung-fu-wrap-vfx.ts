import type Phaser from "phaser";
import {
  type KungFuWrapVfxRecipe,
  resolveKungFuWrapVfxRecipe,
} from "./kung-fu-wrap-vfx-recipes.js";

export {
  KUNG_FU_WRAP_VFX_RECIPES,
  resolveKungFuWrapVfxRecipe,
} from "./kung-fu-wrap-vfx-recipes.js";

export interface KungFuWrapVfxAuditEvent {
  readonly kind: "swing" | "impact";
  readonly weaponId: string;
  readonly style: string;
  readonly x: number;
  readonly y: number;
  readonly timeMs: number;
  readonly comboStep?: number;
  readonly motion?: string;
}

function auditKungFuWrapVfx(event: KungFuWrapVfxAuditEvent): void {
  const audit = globalThis as unknown as {
    __ddB14KungFuVfxAudit?: KungFuWrapVfxAuditEvent[];
  };
  if (!audit.__ddB14KungFuVfxAudit) return;
  audit.__ddB14KungFuVfxAudit.push(event);
  if (audit.__ddB14KungFuVfxAudit.length > 512) audit.__ddB14KungFuVfxAudit.shift();
}

function fadeAndDestroy(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject,
  duration: number,
  scale: number,
): void {
  scene.tweens.add({
    targets: target,
    alpha: 0,
    scaleX: scale,
    scaleY: scale,
    duration,
    ease: "Quad.easeOut",
    onComplete: () => target.destroy(),
  });
}

function drawSwing(
  graphics: Phaser.GameObjects.Graphics,
  recipe: KungFuWrapVfxRecipe,
  dx: number,
  dy: number,
  angle: number,
  reducedMotion: boolean,
): void {
  if (recipe.swing === "red-eight-limbs-aura") {
    graphics.lineStyle(5, recipe.accentColor, 0.44);
    graphics.strokeCircle(0, 0, 25);
    graphics.lineStyle(2, recipe.primaryColor, 0.9);
    graphics
      .beginPath()
      .arc(0, 0, 31, angle - 1.05, angle + 1.05)
      .strokePath();
    graphics.fillStyle(recipe.primaryColor, 0.22).fillCircle(dx, dy, 14);
  } else if (recipe.swing === "white-centerline-flash") {
    const length = Math.max(18, Math.hypot(dx, dy));
    graphics.lineStyle(6, recipe.accentColor, 0.28).lineBetween(0, 0, dx, dy);
    graphics.lineStyle(2, recipe.primaryColor, 0.98).lineBetween(0, 0, dx, dy);
    graphics.fillStyle(0xffffff, 0.96).fillCircle(dx, dy, reducedMotion ? 4 : 7);
    graphics.lineStyle(1, 0xffffff, 0.82);
    graphics.lineBetween(
      dx - Math.cos(angle) * length * 0.08,
      dy - Math.sin(angle) * length * 0.08,
      dx + Math.cos(angle) * 10,
      dy + Math.sin(angle) * 10,
    );
  } else if (recipe.swing === "mist-purple-sway-sweep") {
    graphics.fillStyle(recipe.primaryColor, 0.14);
    graphics.fillEllipse(-10, -6, 42, 25);
    graphics.fillEllipse(dx * 0.45, dy * 0.45 + 7, 51, 22);
    graphics.lineStyle(8, recipe.primaryColor, 0.22);
    graphics
      .beginPath()
      .arc(dx * 0.5, dy * 0.5, 35, angle - 1.35, angle + 1.15)
      .strokePath();
    graphics.lineStyle(2, recipe.accentColor, 0.78);
    graphics
      .beginPath()
      .arc(dx * 0.5, dy * 0.5, 39, angle - 1.25, angle + 1.2)
      .strokePath();
  } else {
    graphics.lineStyle(7, 0x25282b, 0.62).lineBetween(0, 0, dx, dy);
    graphics.lineStyle(2, recipe.primaryColor, 0.86).lineBetween(2, -2, dx, dy);
    graphics.fillStyle(recipe.accentColor, 0.72).fillCircle(dx, dy, reducedMotion ? 6 : 9);
  }
}

/** Accepted swing punctuation. Source is the generated art-space hand centroid; impact is predicted reach. */
export function spawnKungFuWrapSwing(
  scene: Phaser.Scene,
  weaponId: string,
  sourceX: number,
  sourceY: number,
  impactX: number,
  impactY: number,
  angle: number,
  comboStep: number | undefined,
  motion: string | undefined,
  reducedMotion = false,
): boolean {
  const recipe = resolveKungFuWrapVfxRecipe(weaponId);
  if (!recipe) return false;
  const graphics = scene.add.graphics().setPosition(sourceX, sourceY).setDepth(100120);
  const dx = impactX - sourceX;
  const dy = impactY - sourceY;
  drawSwing(graphics, recipe, dx, dy, angle, reducedMotion);
  graphics.setData("kungFuWrapSwingStyle", recipe.swing);
  graphics.setData("kungFuWrapWeaponId", weaponId);
  auditKungFuWrapVfx({
    kind: "swing",
    weaponId,
    style: recipe.swing,
    x: impactX,
    y: impactY,
    timeMs: scene.time.now,
    comboStep,
    motion,
  });
  fadeAndDestroy(
    scene,
    graphics,
    recipe.swing === "white-centerline-flash" ? 105 : 260,
    reducedMotion ? 1.04 : 1.18,
  );
  return true;
}

function drawImpact(
  graphics: Phaser.GameObjects.Graphics,
  recipe: KungFuWrapVfxRecipe,
  angle: number,
  reducedMotion: boolean,
): void {
  if (recipe.impact === "heavy-dust-cloud") {
    const clouds = reducedMotion ? 4 : 8;
    for (let index = 0; index < clouds; index++) {
      const a = angle + Math.PI + (index / Math.max(1, clouds - 1) - 0.5) * 1.9;
      const radius = 7 + (index % 3) * 7;
      graphics
        .fillStyle(index % 2 ? 0x8b6651 : 0xb0916a, 0.58)
        .fillEllipse(Math.cos(a) * radius, Math.sin(a) * radius, 17 + index * 2, 11 + index);
    }
    graphics.lineStyle(4, recipe.primaryColor, 0.82).strokeCircle(0, 0, 23);
  } else if (recipe.impact === "precise-white-flash") {
    graphics.fillStyle(0xffffff, 0.98).fillCircle(0, 0, reducedMotion ? 5 : 8);
    graphics.lineStyle(2, recipe.primaryColor, 0.94);
    graphics.lineBetween(-20, 0, 20, 0);
    graphics.lineBetween(0, -13, 0, 13);
    graphics.lineStyle(1, recipe.accentColor, 0.72).strokeCircle(0, 0, 15);
  } else if (recipe.impact === "misty-purple-wide-sweep") {
    graphics.fillStyle(recipe.primaryColor, 0.18).fillEllipse(-8, 5, 58, 35);
    graphics.fillStyle(recipe.accentColor, 0.13).fillEllipse(15, -7, 47, 29);
    graphics.lineStyle(7, recipe.primaryColor, 0.3);
    graphics
      .beginPath()
      .arc(0, 0, 34, angle - 1.5, angle + 1.45)
      .strokePath();
    graphics.lineStyle(2, recipe.accentColor, 0.88);
    graphics
      .beginPath()
      .arc(0, 0, 39, angle - 1.4, angle + 1.4)
      .strokePath();
  } else {
    graphics.lineStyle(6, 0x33383c, 0.8).strokeCircle(0, 0, 18);
    graphics.lineStyle(3, recipe.primaryColor, 0.88).strokeCircle(0, 0, 29);
    graphics.lineStyle(1, recipe.accentColor, 0.72).strokeCircle(0, 0, 42);
    const sparks = reducedMotion ? 5 : 10;
    for (let index = 0; index < sparks; index++) {
      const a = angle + (index / sparks) * Math.PI * 2;
      const inner = 12 + (index % 2) * 4;
      const outer = 28 + (index % 3) * 7;
      graphics
        .lineStyle(index % 2 ? 2 : 3, index % 2 ? recipe.primaryColor : 0xf7f1d0, 0.92)
        .lineBetween(
          Math.cos(a) * inner,
          Math.sin(a) * inner,
          Math.cos(a) * outer,
          Math.sin(a) * outer,
        );
    }
  }
}

/** Confirmed contact punctuation, kept separate from accepted-swing feedback for honest hit readability. */
export function spawnKungFuWrapImpact(
  scene: Phaser.Scene,
  weaponId: string | undefined,
  x: number,
  y: number,
  angle: number,
  reducedMotion = false,
): boolean {
  const recipe = resolveKungFuWrapVfxRecipe(weaponId);
  if (!recipe || !weaponId) return false;
  const graphics = scene.add.graphics().setPosition(x, y).setDepth(100180);
  drawImpact(graphics, recipe, angle, reducedMotion);
  graphics.setData("kungFuWrapImpactStyle", recipe.impact);
  graphics.setData("kungFuWrapWeaponId", weaponId);
  auditKungFuWrapVfx({
    kind: "impact",
    weaponId,
    style: recipe.impact,
    x,
    y,
    timeMs: scene.time.now,
  });
  fadeAndDestroy(
    scene,
    graphics,
    recipe.impact === "precise-white-flash" ? 120 : 310,
    reducedMotion ? 1.08 : 1.35,
  );
  return true;
}
