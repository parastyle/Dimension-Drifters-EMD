import { meleeReach, WEAPONS } from "@dd/shared";
import type Phaser from "phaser";
import { pageProjectileArtFor } from "./page-projectile-art.js";
import { paintedParticlePixels, particleBurst } from "./particles.js";
import {
  TESLA_WARP_VFX_RECIPE,
  type WeaponEffectRecipe,
  weaponEffectRadialPoints,
  weaponSwingIdentityScale,
  weaponSwingIdentitySizePx,
} from "./weapon-effect-recipes.js";
import {
  weaponPaintedSwingFor,
  weaponPaintedSwingGeometryFor,
} from "./weapon-vfx-suite.js";

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
    particleBurst(scene, "shock-splat", x, y, {
      count: 2,
      dirRad: angle,
      spread: Math.PI * 2,
      speed: 34,
      scaleContract: paintedParticlePixels(54),
      lifeMs: 300,
      additive: true,
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
  if (recipe.paintedSwing) {
    spawnPaintedWeaponSwing(scene, recipe, x, y, angle);
    return;
  }
  const cuePack = recipe.impactAnchor === "target" ? recipe.impactPack : recipe.swingPack;
  if (cuePack)
    particleBurst(scene, cuePack, x, y, {
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

/** Existing directional art is rooted back at the wielder and ends exactly at the damage envelope. */
export function spawnPaintedWeaponSwing(
  scene: Phaser.Scene,
  recipe: WeaponEffectRecipe,
  emitterX: number,
  emitterY: number,
  angle: number,
): void {
  const weapon = WEAPONS[recipe.weaponId];
  const treatment = weaponPaintedSwingFor(recipe.weaponId);
  if (!weapon || !treatment || !scene.textures.exists(treatment.textureKey)) return;
  const geometry = weaponPaintedSwingGeometryFor(weapon, treatment);
  if (!geometry) return;
  const reach = meleeReach(weapon);
  const actorX = emitterX - Math.cos(angle) * reach * 0.78;
  const actorY = emitterY - Math.sin(angle) * reach * 0.78;
  const source = scene.textures.get(treatment.textureKey).getSourceImage();
  const finalScale = geometry.displayWidth / Math.max(1, source.width);
  const image = scene.add
    .image(actorX, actorY, treatment.textureKey)
    .setName(`weapon-painted-swing:${recipe.weaponId}`)
    .setOrigin(treatment.originX, 0.5)
    .setRotation(angle)
    .setTint(treatment.tint)
    .setDepth(100100)
    .setScale(finalScale * 0.72)
    .setAlpha(0.12);
  const audit = globalThis as unknown as {
    __ddB10VfxCapture?: boolean;
    __ddB10VfxEvents?: Array<Record<string, unknown>>;
  };
  if (audit.__ddB10VfxCapture) {
    audit.__ddB10VfxEvents ??= [];
    audit.__ddB10VfxEvents.push({
      kind: "painted-swing",
      weaponId: recipe.weaponId,
      textureKey: treatment.textureKey,
      subjects: treatment.subjects,
      x: actorX,
      y: actorY,
      angle,
      displayWidth: geometry.displayWidth,
      forwardExtent: geometry.forwardExtent,
      damageExtent: meleeReach(weapon),
      tint: treatment.tint,
    });
  }
  scene.tweens.add({
    targets: image,
    scaleX: finalScale,
    scaleY: finalScale,
    alpha: 0.96,
    duration: Math.round(treatment.lifeMs * 0.28),
    ease: "Cubic.easeOut",
  });
  scene.tweens.add({
    targets: image,
    alpha: 0,
    delay: Math.round(treatment.lifeMs * 0.5),
    duration: Math.round(treatment.lifeMs * 0.5),
    ease: "Cubic.easeIn",
    onComplete: () => image.destroy(),
  });
}

export function spawnWeaponRadialIdentity(
  scene: Phaser.Scene,
  recipe: WeaponEffectRecipe,
  x: number,
  y: number,
  radius: number,
  phase: number,
  bladeLength = 0,
): void {
  if (recipe.radialDistribution !== "full-circle" || !recipe.swingPack) return;
  const points = weaponEffectRadialPoints(x, y, radius, recipe.swingCount ?? 12, phase);
  const paintedSize = weaponSwingIdentitySizePx(recipe, bladeLength);
  for (const point of points) {
    particleBurst(scene, recipe.swingPack, point.x, point.y, {
      count: 1,
      dirRad: point.angle + Math.PI / 2,
      spread: 0.7,
      speed: 82,
      scaleContract: paintedParticlePixels(paintedSize),
      lifeMs: 440,
      additive: recipe.additive,
      sink: recipe.additive ? 0 : 16,
    });
  }
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

/** Literal Codex-rendered page sprites along Twin Whispervolumes' chain path. */
export function spawnScatteredPages(
  scene: Phaser.Scene,
  nodes: readonly { x: number; y: number }[],
  lifeMs: number,
  weaponId = "x2-twin-whispervolumes",
): void {
  const art = pageProjectileArtFor(weaponId);
  if (!art || !scene.textures.exists(art.textureKey)) return;
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
        .image(
          from.x + (to.x - from.x) * t + nx * lateral,
          from.y + (to.y - from.y) * t + ny * lateral,
          art.textureKey,
        )
        .setDisplaySize(art.displayWidth, art.displayHeight)
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
