import Phaser from "phaser";
import { PROJECTILE_SPRITES } from "../sprites/projectile-manifest.js";
import {
  resolveWackyWeaponVfxRecipe,
  type WackyImpactTrigger,
} from "./wacky-weapon-vfx-recipes.js";

export {
  resolveWackyWeaponVfxRecipe,
  WACKY_WEAPON_VFX_RECIPES,
  wackyWeaponShotAudioCue,
} from "./wacky-weapon-vfx-recipes.js";

function confettiColors(): readonly number[] {
  return [0xff3d5a, 0xffd23f, 0x4dd77b, 0x4f8cff, 0xb65cff];
}

interface WackyVfxAuditEvent {
  readonly kind: "projectile" | "impact";
  readonly weaponId: string;
  readonly style: string;
  readonly x: number;
  readonly y: number;
  readonly visualVariant?: number;
  readonly textureKey?: string;
}

function auditWackyVfx(event: WackyVfxAuditEvent): void {
  const audit = globalThis as unknown as {
    __ddB2WackyVfxAudit?: WackyVfxAuditEvent[];
  };
  if (!audit.__ddB2WackyVfxAudit) return;
  audit.__ddB2WackyVfxAudit.push(event);
  if (audit.__ddB2WackyVfxAudit.length > 256) audit.__ddB2WackyVfxAudit.shift();
}

export function preloadWackyWeaponProjectileArt(scene: Phaser.Scene): void {
  for (let variant = 1; variant <= 5; variant++) {
    const sprite =
      PROJECTILE_SPRITES[`exploding-present-variant-${variant}` as keyof typeof PROJECTILE_SPRITES];
    const textureKey = `wacky:present:${variant}`;
    if (sprite && !scene.textures.exists(textureKey)) scene.load.image(textureKey, sprite.url);
  }
}

/** Wacky projectile identity uses installed art when supplied and keeps procedural fallbacks for legacy rows. */
export function makeWackyProjectile(
  scene: Phaser.Scene,
  projectile: Readonly<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    visualVariant?: number;
  }>,
  weaponId: string,
): Phaser.GameObjects.Container | null {
  const style = resolveWackyWeaponVfxRecipe(weaponId)?.projectile;
  if (!style || style === "none" || style === "own-sprite-return") return null;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  if (style === "present") {
    const visualVariant = Phaser.Math.Clamp(Math.trunc(projectile.visualVariant ?? 1), 1, 5);
    const textureKey = `wacky:present:${visualVariant}`;
    if (scene.textures.exists(textureKey)) {
      // Every authored frame shares one 640x512 registration canvas. A fixed canvas size preserves the
      // supplier's intentionally larger part-5 silhouette instead of normalizing the big payload away.
      const image = scene.add.image(0, 0, textureKey).setDisplaySize(64, 51.2);
      const payload = scene.add.container(0, 0, [image]).setRotation(angle);
      const container = scene.add
        .container(projectile.x, projectile.y, [payload])
        .setDepth(99000)
        .setData("arcPayload", payload)
        .setData("wackyProjectileStyle", style)
        .setData("wackyWeaponId", weaponId)
        .setData("visualVariant", visualVariant)
        .setData("projectileTextureKey", textureKey);
      auditWackyVfx({
        kind: "projectile",
        weaponId,
        style,
        x: projectile.x,
        y: projectile.y,
        visualVariant,
        textureKey,
      });
      return container;
    }
  }
  const graphics = scene.add.graphics();
  if (style === "fish") {
    graphics.fillStyle(0x315f68, 1).fillEllipse(0, 0, 28, 12);
    graphics.fillStyle(0x7fb7ad, 1).fillTriangle(-12, 0, -23, -9, -23, 9);
    graphics.fillStyle(0xd5eadf, 0.9).fillEllipse(4, -2, 11, 4);
    graphics.fillStyle(0x11171b, 1).fillCircle(9, -2, 1.8);
  } else if (style === "present") {
    graphics.fillStyle(0x7b2f43, 1).fillRect(-10, -9, 20, 18);
    graphics.fillStyle(0xe4b84a, 1).fillRect(-2, -9, 4, 18);
    graphics.fillRect(-10, -2, 20, 4);
    graphics.fillTriangle(-2, -9, -9, -16, 0, -12);
    graphics.fillTriangle(2, -9, 9, -16, 0, -12);
  } else if (style === "bubble") {
    graphics.fillStyle(0x75e8ee, 0.17).fillCircle(0, 0, 11);
    graphics.lineStyle(2, 0x8ff4ff, 0.9).strokeCircle(0, 0, 10);
    graphics.lineStyle(1, 0xff8de4, 0.8).beginPath().arc(0, 0, 7.5, 3.55, 5.05).strokePath();
    graphics.fillStyle(0xffffff, 0.95).fillCircle(-3, -4, 2);
  } else {
    const colors = confettiColors();
    for (let index = 0; index < 3; index++) {
      graphics
        .fillStyle(colors[(index + Math.abs(Math.round(projectile.vy))) % colors.length]!, 0.95)
        .fillRect(-8 + index * 5, -2 + index * 2, 8, 3);
    }
  }
  const trailColor =
    style === "fish"
      ? 0x73cddd
      : style === "bubble"
        ? 0x8fefff
        : style === "present"
          ? 0xe4b84a
          : 0xff6ca8;
  const trail = scene.add
    .ellipse(-17, 0, 24, style === "bubble" ? 6 : 4, trailColor, 0.26)
    .setBlendMode(Phaser.BlendModes.ADD);
  const payload = scene.add.container(0, 0, [trail, graphics]).setRotation(angle);
  const container = scene.add
    .container(projectile.x, projectile.y, [payload])
    .setDepth(99000)
    .setData("arcPayload", payload)
    .setData("wackyProjectileStyle", style)
    .setData("wackyWeaponId", weaponId);
  auditWackyVfx({
    kind: "projectile",
    weaponId,
    style,
    x: projectile.x,
    y: projectile.y,
  });
  return container;
}

/** Returns true when the weapon owns the impact punctuation for this trigger. */
export function spawnWackyWeaponImpact(
  scene: Phaser.Scene,
  weaponId: string | undefined,
  trigger: Exclude<WackyImpactTrigger, "none">,
  x: number,
  y: number,
  angle = 0,
  reducedMotion = false,
): boolean {
  const recipe = resolveWackyWeaponVfxRecipe(weaponId);
  if (!recipe || recipe.impact === "none" || recipe.impactTrigger !== trigger) return false;
  const graphics = scene.add
    .graphics()
    .setPosition(x, y)
    .setDepth(99200)
    .setData("wackyImpactStyle", recipe.impact)
    .setData("wackyWeaponId", weaponId);
  auditWackyVfx({
    kind: "impact",
    weaponId: weaponId ?? "",
    style: recipe.impact,
    x,
    y,
  });
  const countScale = reducedMotion ? 0.55 : 1;
  if (recipe.impact === "wet-slap") {
    graphics.lineStyle(3, 0x8ce7ed, 0.9).strokeEllipse(0, 0, 34, 15);
    graphics.fillStyle(0x4eb6c9, 0.84);
    for (let index = 0; index < Math.ceil(7 * countScale); index++) {
      const a = angle + Math.PI + (index / 6 - 0.5) * 1.5;
      graphics.fillCircle(Math.cos(a) * (14 + index * 2), Math.sin(a) * (10 + index), 2.5);
    }
  } else if (recipe.impact === "squeak-ring") {
    graphics.lineStyle(5, 0xff668d, 0.86).strokeEllipse(0, 0, 42, 24);
    graphics.lineStyle(2, 0xffd2de, 0.96).strokeEllipse(0, 0, 26, 14);
    graphics.fillStyle(0xffffff, 0.9).fillTriangle(-3, -14, 3, -14, 0, -25);
  } else if (recipe.impact === "bubble-pop") {
    graphics.lineStyle(3, 0x8ff4ff, 0.92).strokeCircle(0, 0, 22);
    graphics.lineStyle(2, 0xff8de4, 0.82).strokeCircle(0, 0, 15);
    graphics.fillStyle(0xffffff, 0.92);
    for (let index = 0; index < Math.ceil(6 * countScale); index++) {
      const a = (Math.PI * 2 * index) / 6;
      graphics.fillCircle(Math.cos(a) * 28, Math.sin(a) * 28, 2);
    }
  } else {
    const colors = confettiColors();
    const count = Math.ceil((weaponId === "x2-exploding-present-lobber" ? 18 : 10) * countScale);
    for (let index = 0; index < count; index++) {
      const a = angle + Math.PI + (Math.PI * 2 * index) / count;
      const radius = 12 + (index % 5) * 7;
      graphics
        .fillStyle(colors[index % colors.length]!, 0.95)
        .fillRect(Math.cos(a) * radius - 4, Math.sin(a) * radius - 1.5, 8, 3);
    }
  }
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    scaleX: reducedMotion ? 1.15 : 1.45,
    scaleY: reducedMotion ? 1.08 : 1.28,
    duration: recipe.impact === "confetti-burst" ? 380 : 240,
    ease: "Quad.easeOut",
    onComplete: () => graphics.destroy(),
  });
  return true;
}
