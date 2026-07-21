import Phaser from "phaser";
import { paintedParticlePixels, particleBurst } from "./particles.js";
import {
  TESLA_WARP_VFX_RECIPE,
  type WeaponEffectRecipe,
  weaponSwingIdentityScale,
  weaponSwingIdentitySizePx,
} from "./weapon-effect-recipes.js";

export { weaponSwingIdentityScale, weaponSwingIdentitySizePx };

export function spawnTeslaWarpDeparture(scene: Phaser.Scene, x: number, y: number): void {
  for (const [index, pack] of TESLA_WARP_VFX_RECIPE.departurePacks.entries()) {
    particleBurst(scene, pack, x, y, {
      count: index === 0 ? 11 : 7,
      dirRad: -Math.PI / 2,
      spread: index === 0 ? 0.75 : Math.PI * 2,
      speed: index === 0 ? 235 : 145,
      scaleContract: paintedParticlePixels(index === 0 ? 40.32 : 26.88),
      lifeMs: index === 0 ? 260 : 330,
      additive: true,
    });
  }
}

export function spawnTeslaWarpArrival(scene: Phaser.Scene, x: number, y: number): void {
  for (const [index, pack] of TESLA_WARP_VFX_RECIPE.arrivalPacks.entries()) {
    particleBurst(scene, pack, x, y, {
      count: index === 0 ? 14 : 9,
      dirRad: 0,
      spread: Math.PI * 2,
      speed: index === 0 ? 185 : 245,
      scaleContract: paintedParticlePixels(index === 0 ? 46.08 : 36.48),
      lifeMs: index === 0 ? 420 : 300,
      additive: true,
    });
  }
}

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
    scaleContract: paintedParticlePixels(40.32),
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
  bladeLength = 0,
): void {
  if (!recipe) return;
  if (recipe.swingPack)
    particleBurst(scene, recipe.swingPack, x, y, {
      count: recipe.swingCount ?? 6,
      dirRad: angle,
      spread: recipe.noGore ? 0.75 : 0.42,
      speed: recipe.noGore ? 105 : 170,
      scaleContract: paintedParticlePixels(weaponSwingIdentitySizePx(recipe, bladeLength)),
      lifeMs: recipe.noGore ? 420 : 330,
      additive: recipe.additive,
      sink: recipe.noGore ? 18 : 0,
    });
  if (recipe.musicalNotes) spawnMusicalNoteParticles(scene, x, y, angle);
}

/** Bell notation is a small procedural particle family so it stays readable without a bespoke bitmap. */
export function spawnMusicalNoteParticles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
): void {
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  for (let i = 0; i < 7; i++) {
    const side = i - 3;
    const note = scene.add
      .text(x + nx * side * 7, y + ny * side * 7, i % 3 === 0 ? "♫" : "♪", {
        color: i % 2 === 0 ? "#fff4cf" : "#e8e4d8",
        fontFamily: "serif",
        fontSize: `${13 + (i % 3) * 2}px`,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(99501)
      .setRotation(-0.2 + i * 0.07);
    scene.tweens.add({
      targets: note,
      x: note.x + Math.cos(angle) * (30 + i * 5) + nx * side * 3,
      y: note.y + Math.sin(angle) * (30 + i * 5) + ny * side * 3 - 18,
      alpha: 0,
      scale: 1.25,
      duration: 430 + i * 35,
      ease: "Sine.easeOut",
      onComplete: () => note.destroy(),
    });
  }
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
