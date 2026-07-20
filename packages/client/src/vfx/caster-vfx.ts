import Phaser from "phaser";
import { partTexture } from "../entities/SpriteRig.js";
import { SPRITES } from "../sprites/manifest.js";
import type { CasterVfxRecipe } from "./caster-vfx-recipes.js";
import { PARTICLE_PACKS } from "./particle-manifest.js";
import { elementPack, particleBurst } from "./particles.js";

export const CASTER_VFX_BUDGET = Object.freeze({
  punctuationEventsPerFrame: 8,
  paintedParticlesPerFrame: 24,
  projectileChildren: 4,
});

interface CasterFrameSpend {
  frame: number;
  events: number;
  particles: number;
}

const FRAME_SPEND = new WeakMap<Phaser.Scene, CasterFrameSpend>();

function punctuationAllowance(scene: Phaser.Scene, requestedParticles: number): number {
  // Phaser's wall clock is monotonic during a scene. A 60 Hz bucket keeps simultaneous patch edges bounded
  // without allocating in the update path or coupling presentation to the server's 20 Hz tick.
  const frame = Math.floor(scene.time.now / (1000 / 60));
  let spend = FRAME_SPEND.get(scene);
  if (!spend) {
    spend = { frame, events: 0, particles: 0 };
    FRAME_SPEND.set(scene, spend);
  } else if (spend.frame !== frame) {
    spend.frame = frame;
    spend.events = 0;
    spend.particles = 0;
  }
  if (spend.events >= CASTER_VFX_BUDGET.punctuationEventsPerFrame) return -1;
  spend.events++;
  const allowed = Math.max(
    0,
    Math.min(requestedParticles, CASTER_VFX_BUDGET.paintedParticlesPerFrame - spend.particles),
  );
  spend.particles += allowed;
  return allowed;
}

function localX(x: number, cosine: number, sine: number, lx: number, ly: number): number {
  return x + lx * cosine - ly * sine;
}

function localY(y: number, cosine: number, sine: number, lx: number, ly: number): number {
  return y + lx * sine + ly * cosine;
}

function localLine(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  graphics.lineBetween(
    localX(x, cosine, sine, ax, ay),
    localY(y, cosine, sine, ax, ay),
    localX(x, cosine, sine, bx, by),
    localY(y, cosine, sine, bx, by),
  );
}

function drawDiamond(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  radius: number,
): void {
  localLine(graphics, x, y, angle, radius, 0, 0, radius * 0.72);
  localLine(graphics, x, y, angle, 0, radius * 0.72, -radius, 0);
  localLine(graphics, x, y, angle, -radius, 0, 0, -radius * 0.72);
  localLine(graphics, x, y, angle, 0, -radius * 0.72, radius, 0);
}

function drawStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  radius: number,
  arms: number,
): void {
  for (let i = 0; i < arms; i++) {
    const a = angle + (i * Math.PI * 2) / arms;
    localLine(graphics, x, y, a, radius * 0.28, 0, radius, 0);
  }
}

/** Draw one form/grade glyph into an existing retained Graphics object (also used by BeamRenderer). */
export function drawCasterGlyph(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  recipe: CasterVfxRecipe,
  alpha = 1,
  progress = 1,
  nowMs = 0,
  reducedMotion = false,
): void {
  const p = Math.max(0.15, Math.min(1, progress));
  const r = recipe.source.radius * (0.68 + p * 0.32);
  const orbit = reducedMotion ? 0 : Math.sin(nowMs * 0.008) * 0.12;
  const a = angle + orbit;
  const midAlpha = Math.max(0, Math.min(1, alpha)) * (0.52 + p * 0.32);
  graphics.lineStyle(recipe.source.lineWidth, recipe.palette.mid, midAlpha);

  switch (recipe.source.glyph) {
    case "circle":
      graphics.strokeCircle(x, y, r);
      graphics.lineStyle(1, recipe.palette.core, midAlpha * 0.8).strokeCircle(x, y, r * 0.58);
      for (let i = 0; i < 4; i++)
        localLine(graphics, x, y, a + (i * Math.PI) / 2, r * 0.72, 0, r * 1.12, 0);
      break;
    case "pages":
      localLine(graphics, x, y, a, -r * 0.88, -r * 0.55, 0, -r * 0.14);
      localLine(graphics, x, y, a, -r * 0.88, -r * 0.55, -r * 0.82, r * 0.62);
      localLine(graphics, x, y, a, -r * 0.82, r * 0.62, 0, r * 0.2);
      localLine(graphics, x, y, a, r * 0.88, -r * 0.55, 0, -r * 0.14);
      localLine(graphics, x, y, a, r * 0.88, -r * 0.55, r * 0.82, r * 0.62);
      localLine(graphics, x, y, a, r * 0.82, r * 0.62, 0, r * 0.2);
      break;
    case "diamond":
      drawDiamond(graphics, x, y, a + Math.PI / 2, r);
      drawDiamond(graphics, x, y, a + Math.PI / 2, r * 0.55);
      break;
    case "line":
      localLine(graphics, x, y, a, -r, 0, r * 1.45, 0);
      localLine(graphics, x, y, a, -r * 0.2, -r * 0.55, -r * 0.2, r * 0.55);
      graphics.strokeCircle(x, y, r * 0.42);
      break;
    case "orbit":
      graphics.strokeCircle(x, y, r * 0.62);
      graphics
        .lineStyle(1, recipe.palette.core, midAlpha * 0.8)
        .strokeEllipse(x, y, r * 2, r * 0.75);
      for (let i = 0; i < 3; i++) {
        const q = a + (i * Math.PI * 2) / 3;
        graphics
          .fillStyle(recipe.palette.core, midAlpha)
          .fillCircle(x + Math.cos(q) * r, y + Math.sin(q) * r * 0.38, 1.8);
      }
      break;
    case "star":
      drawStar(graphics, x, y, a, r, 6);
      graphics.strokeCircle(x, y, r * 0.34);
      break;
    case "ward":
      graphics.strokeCircle(x, y, r);
      drawDiamond(graphics, x, y, a, r * 0.68);
      localLine(graphics, x, y, a, -r * 0.45, 0, r * 0.45, 0);
      break;
    case "palm":
      graphics.strokeCircle(x, y, r * 0.52);
      for (let i = -2; i <= 2; i++) {
        localLine(
          graphics,
          x,
          y,
          a,
          r * 0.2,
          i * r * 0.14,
          r * (0.78 + (2 - Math.abs(i)) * 0.08),
          i * r * 0.22,
        );
      }
      break;
  }

  graphics.lineStyle(
    Math.max(1, recipe.source.lineWidth * 0.72),
    recipe.palette.core,
    midAlpha * 0.92,
  );
  switch (recipe.signature) {
    case "arcane-lance-line":
      localLine(graphics, x, y, a, -r * 1.7, 0, r * 2.35, 0);
      localLine(graphics, x, y, a, r * 1.55, -r * 0.18, r * 2.35, 0);
      localLine(graphics, x, y, a, r * 1.55, r * 0.18, r * 2.35, 0);
      break;
    case "forked-page-flutter":
      localLine(graphics, x, y, a - 0.26, -r * 0.15, -r * 0.85, r * 0.75, -r * 1.12);
      localLine(graphics, x, y, a + 0.26, -r * 0.15, r * 0.85, r * 0.75, r * 1.12);
      break;
    case "hollow-page-aperture":
      drawDiamond(graphics, x, y, a + Math.PI / 4, r * 0.82);
      graphics.fillStyle(recipe.palette.shadow, midAlpha * 0.62).fillCircle(x, y, r * 0.22);
      break;
    case "sunmote-corona":
      graphics.strokeCircle(x, y, r * 1.25);
      drawStar(graphics, x, y, a, r * 1.55, 8);
      break;
    case "mesa-lightning-crown":
      localLine(graphics, x, y, a, -r, -r * 0.45, -r * 0.42, -r * 0.8);
      localLine(graphics, x, y, a, -r * 0.42, -r * 0.8, 0, -r * 0.42);
      localLine(graphics, x, y, a, 0, -r * 0.42, r * 0.45, -r * 0.9);
      localLine(graphics, x, y, a, r * 0.45, -r * 0.9, r, -r * 0.42);
      break;
    case "obsidian-maw": {
      const cosine = Math.cos(a);
      const sine = Math.sin(a);
      const leftX = localX(x, cosine, sine, -r * 1.2, -r * 0.7);
      const leftY = localY(y, cosine, sine, -r * 1.2, -r * 0.7);
      const rightX = localX(x, cosine, sine, -r * 1.2, r * 0.7);
      const rightY = localY(y, cosine, sine, -r * 1.2, r * 0.7);
      const tipX = localX(x, cosine, sine, r * 0.15, 0);
      const tipY = localY(y, cosine, sine, r * 0.15, 0);
      graphics.fillStyle(recipe.palette.shadow, midAlpha * 0.75);
      graphics.fillTriangle(leftX, leftY, tipX, tipY, x, y - r * 0.12);
      graphics.fillTriangle(rightX, rightY, tipX, tipY, x, y + r * 0.12);
      break;
    }
  }
}

/** Predicted/accepted source punctuation. Damage and admission remain completely server-side. */
export function spawnCasterCast(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  recipe: CasterVfxRecipe,
  reducedMotion: boolean,
): boolean {
  const requested = reducedMotion ? Math.min(2, recipe.source.particles) : recipe.source.particles;
  const allowed = punctuationAllowance(scene, requested);
  if (allowed < 0) return false;
  const graphics = scene.add
    .graphics()
    .setPosition(x, y)
    .setDepth(99510)
    .setBlendMode(Phaser.BlendModes.ADD);
  drawCasterGlyph(graphics, 0, 0, 0, recipe, 1, 1, scene.time.now, reducedMotion);
  const flutter = !reducedMotion && recipe.signature === "forked-page-flutter" ? 0.16 : 0;
  graphics.setScale(reducedMotion ? 1 : 0.72);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    scale: reducedMotion ? 1 : 1.28,
    rotation: flutter,
    y: reducedMotion ? y : y - (recipe.form === "tome" || recipe.form === "codex" ? 7 : 2),
    duration: reducedMotion ? 150 : 260,
    ease: "Quad.easeOut",
    onComplete: () => graphics.destroy(),
  });
  if (allowed > 0) {
    particleBurst(scene, elementPack(recipe.element, recipe.source.particleShape), x, y, {
      count: allowed,
      dirRad: angle,
      spread: recipe.form === "lance" ? 0.2 : 0.58,
      speed: reducedMotion ? 45 : 82 + (recipe.grade === "pinnacle" ? 20 : 0),
      scale: reducedMotion ? 0.17 : 0.22,
      lifeMs: reducedMotion ? 170 : 300,
      additive: true,
      depth: 99520,
    });
  }
  return true;
}

function drawProjectileBody(graphics: Phaser.GameObjects.Graphics, recipe: CasterVfxRecipe): void {
  const r = recipe.projectile.coreRadius;
  graphics.fillStyle(recipe.palette.shadow, 0.72);
  graphics.lineStyle(1.2, recipe.palette.core, 0.96);
  switch (recipe.projectile.silhouette) {
    case "bolt":
      graphics.fillTriangle(r * 2.7, 0, -r * 1.25, -r, -r * 1.25, r);
      graphics.lineBetween(-r * 1.4, 0, r * 2.8, 0);
      break;
    case "leaf":
      graphics.fillTriangle(r * 2, 0, -r, -r * 1.45, -r * 0.3, 0);
      graphics.fillTriangle(r * 2, 0, -r, r * 1.45, -r * 0.3, 0);
      graphics.lineBetween(-r, 0, r * 2, 0);
      break;
    case "diamond":
      graphics.fillTriangle(r * 2.2, 0, 0, -r * 1.35, -r * 1.25, 0);
      graphics.fillTriangle(r * 2.2, 0, 0, r * 1.35, -r * 1.25, 0);
      drawDiamond(graphics, 0, 0, 0, r * 2.1);
      break;
    case "lance":
      graphics.fillRect(-r * 2.8, -r * 0.46, r * 5.2, r * 0.92);
      graphics.fillTriangle(r * 3.5, 0, r * 1.8, -r, r * 1.8, r);
      graphics.lineBetween(-r * 3.2, 0, r * 3.55, 0);
      break;
    case "sphere":
      graphics.fillCircle(0, 0, r * 1.8);
      graphics.strokeCircle(0, 0, r * 2.35);
      graphics.strokeEllipse(0, 0, r * 5.4, r * 1.7);
      break;
    case "prism":
      graphics.fillTriangle(r * 2.1, 0, -r * 1.3, -r * 1.55, -r * 1.3, r * 1.55);
      graphics.lineBetween(-r * 1.3, -r * 1.55, r * 0.15, 0);
      graphics.lineBetween(-r * 1.3, r * 1.55, r * 0.15, 0);
      break;
    case "seal":
      graphics.fillCircle(0, 0, r * 1.45);
      graphics.strokeCircle(0, 0, r * 2.25);
      drawStar(graphics, 0, 0, 0, r * 2.05, 4);
      break;
    case "fist":
      graphics.fillRoundedRect(-r * 1.25, -r * 1.15, r * 3, r * 2.3, r * 0.55);
      for (let i = -1; i <= 1; i++)
        graphics.lineBetween(r * 0.2, i * r * 0.58, r * 2.15, i * r * 0.48);
      break;
  }
  graphics.fillStyle(recipe.palette.core, 0.98).fillCircle(r * 0.25, 0, r * 0.58);

  switch (recipe.signature) {
    case "arcane-lance-line":
      graphics.lineStyle(1.4, recipe.palette.core, 0.92).lineBetween(-r * 7, 0, r * 5.5, 0);
      break;
    case "forked-page-flutter":
      graphics.lineStyle(1.2, recipe.palette.core, 0.88);
      graphics.strokeRect(-r * 1.6, -r * 2.3, r * 1.5, r * 1.1);
      graphics.strokeRect(-r * 0.5, r * 1.2, r * 1.5, r * 1.1);
      break;
    case "hollow-page-aperture":
      graphics.fillStyle(0x05030a, 0.9).fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      graphics.lineStyle(1.4, recipe.palette.core, 0.9).strokeRect(-r, -r, r * 2, r * 2);
      break;
    case "sunmote-corona":
      graphics.lineStyle(1.4, recipe.palette.core, 0.92).strokeCircle(0, 0, r * 2.8);
      drawStar(graphics, 0, 0, 0, r * 3.4, 8);
      break;
    case "mesa-lightning-crown":
      graphics.lineStyle(1.5, recipe.palette.core, 0.95);
      graphics.lineBetween(-r * 2.5, -r * 1.5, -r * 0.8, -r * 2.4);
      graphics.lineBetween(-r * 0.8, -r * 2.4, 0, -r * 1.2);
      graphics.lineBetween(0, -r * 1.2, r * 1.2, -r * 2.5);
      break;
    case "obsidian-maw":
      graphics.fillStyle(0x07030b, 0.92);
      graphics.fillTriangle(r * 2.4, 0, -r * 2.4, -r * 2.2, -r * 0.4, -r * 0.25);
      graphics.fillTriangle(r * 2.4, 0, -r * 2.4, r * 2.2, -r * 0.4, r * 0.25);
      break;
  }
}

/** Build a bounded visual container for one authoritative caster-owned projectile row. */
export function makeCasterProjectile(
  scene: Phaser.Scene,
  projectile: { x: number; y: number; vx: number; vy: number },
  recipe: CasterVfxRecipe,
  reducedMotion: boolean,
  visualScale = 1,
): Phaser.GameObjects.Container {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const trailLength = recipe.projectile.trailLength * (reducedMotion ? 0.76 : 1);
  const trail = scene.add
    .ellipse(
      -Math.cos(angle) * trailLength * 0.44,
      -Math.sin(angle) * trailLength * 0.44,
      trailLength,
      recipe.projectile.trailWidth,
      recipe.palette.mid,
      0.48,
    )
    .setRotation(angle)
    .setBlendMode(Phaser.BlendModes.ADD);
  const glowRadius = recipe.projectile.coreRadius * 3.1;
  const glow = scene.add
    .ellipse(0, 0, glowRadius * 2.2, glowRadius * 1.45, recipe.palette.mid, 0.28)
    .setRotation(angle)
    .setBlendMode(Phaser.BlendModes.ADD);
  const children: Phaser.GameObjects.GameObject[] = [trail, glow];
  const spriteRecipe = recipe.spriteProjectile;
  if (spriteRecipe) {
    const manifest = SPRITES[spriteRecipe.spriteId as keyof typeof SPRITES];
    const part = manifest?.parts.find((candidate) => candidate.role === spriteRecipe.partRole);
    const texture = partTexture(scene, spriteRecipe.spriteId, spriteRecipe.partRole);
    if (part && scene.textures.exists(texture.key)) {
      const crop = spriteRecipe.crop;
      const sprite = scene.add
        .image(0, 0, texture.key, texture.frame)
        .setCrop(crop.x, crop.y, crop.width, crop.height)
        .setOrigin((crop.x + crop.width * 0.5) / part.w, (crop.y + crop.height * 0.5) / part.h)
        .setScale(spriteRecipe.displayLength / crop.width)
        .setRotation(angle);
      if (!reducedMotion && spriteRecipe.flutterRadians && spriteRecipe.flutterMs) {
        scene.tweens.add({
          targets: sprite,
          rotation: angle + spriteRecipe.flutterRadians,
          duration: spriteRecipe.flutterMs,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      }
      children.push(sprite);
    }
  }
  if (!spriteRecipe || children.length === 2) {
    const packId = elementPack(recipe.element, recipe.projectile.particleShape);
    const pack = PARTICLE_PACKS[packId];
    if (pack && scene.textures.exists(`ptcl:${packId}`)) {
      const painted = scene.add
        .image(0, 0, `ptcl:${packId}`, (Math.random() * pack.count) | 0)
        .setScale(recipe.projectile.bodyScale)
        .setRotation(angle)
        .setBlendMode(Phaser.BlendModes.ADD);
      children.push(painted);
    }
    const body = scene.add.graphics().setRotation(angle).setBlendMode(Phaser.BlendModes.ADD);
    drawProjectileBody(body, recipe);
    children.push(body);
  }
  const payload = scene.add.container(0, 0, children);
  const container = scene.add
    .container(projectile.x, projectile.y, [payload])
    .setDepth(99000)
    .setScale(visualScale);
  container.setData("casterRecipe", recipe);
  container.setData("ang", angle);
  container.setData("arcPayload", payload);
  return container;
}

function drawImpactBlossom(graphics: Phaser.GameObjects.Graphics, recipe: CasterVfxRecipe): void {
  const r = recipe.impact.radius;
  graphics
    .lineStyle(recipe.source.lineWidth, recipe.palette.mid, 0.92)
    .strokeCircle(0, 0, r * 0.52);
  graphics.lineStyle(1.2, recipe.palette.core, 0.9);
  switch (recipe.impact.blossom) {
    case "radial":
      drawStar(graphics, 0, 0, 0, r, 8);
      break;
    case "pages":
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const cosine = Math.cos(a);
        const sine = Math.sin(a);
        const px = localX(0, cosine, sine, r * 0.3, -r * 0.2);
        const py = localY(0, cosine, sine, r * 0.3, -r * 0.2);
        graphics.strokeRect(px - r * 0.18, py - r * 0.12, r * 0.55, r * 0.3);
      }
      break;
    case "square":
      drawDiamond(graphics, 0, 0, Math.PI / 4, r);
      drawDiamond(graphics, 0, 0, 0, r * 0.62);
      break;
    case "axis":
      graphics.lineBetween(-r * 1.25, 0, r * 1.25, 0);
      graphics.lineBetween(0, -r * 0.55, 0, r * 0.55);
      break;
    case "rings":
      graphics.strokeCircle(0, 0, r);
      graphics.strokeEllipse(0, 0, r * 2.25, r * 0.72);
      break;
    case "star":
      drawStar(graphics, 0, 0, Math.PI / 8, r, 8);
      break;
    case "ward":
      graphics.strokeCircle(0, 0, r);
      drawDiamond(graphics, 0, 0, 0, r * 0.7);
      break;
    case "burst":
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const cosine = Math.cos(a);
        const sine = Math.sin(a);
        const outer = r * (i % 2 ? 0.78 : 1.12);
        graphics.lineBetween(
          localX(0, cosine, sine, r * 0.42, 0),
          localY(0, cosine, sine, r * 0.42, 0),
          localX(0, cosine, sine, outer, 0),
          localY(0, cosine, sine, outer, 0),
        );
      }
      break;
  }
  graphics.fillStyle(recipe.palette.core, 0.95).fillCircle(0, 0, Math.max(2.5, r * 0.13));
  if (recipe.signature === "obsidian-maw") {
    graphics.fillStyle(0x07030b, 0.88);
    graphics.fillTriangle(r, 0, -r * 0.85, -r * 0.75, -r * 0.2, -r * 0.08);
    graphics.fillTriangle(r, 0, -r * 0.85, r * 0.75, -r * 0.2, r * 0.08);
  } else if (recipe.signature === "sunmote-corona") {
    graphics.strokeCircle(0, 0, r * 1.15);
    drawStar(graphics, 0, 0, 0, r * 1.28, 8);
  } else if (recipe.signature === "mesa-lightning-crown") {
    graphics.lineBetween(-r, -r * 0.3, -r * 0.25, -r * 0.82);
    graphics.lineBetween(-r * 0.25, -r * 0.82, r * 0.08, -r * 0.2);
    graphics.lineBetween(r * 0.08, -r * 0.2, r, -r * 0.75);
  }
}

/** Contact punctuation at the authoritative row's final rendered position. */
export function spawnCasterImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  recipe: CasterVfxRecipe,
  reducedMotion: boolean,
): boolean {
  const requested = reducedMotion ? Math.min(2, recipe.impact.particles) : recipe.impact.particles;
  const allowed = punctuationAllowance(scene, requested);
  if (allowed < 0) return false;
  const graphics = scene.add
    .graphics()
    .setPosition(x, y)
    .setRotation(angle)
    .setDepth(99500)
    .setBlendMode(Phaser.BlendModes.ADD);
  drawImpactBlossom(graphics, recipe);
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    scale: reducedMotion ? 1.05 : 1.42,
    rotation: reducedMotion ? angle : angle + 0.2,
    duration: reducedMotion ? 170 : 330,
    ease: "Quad.easeOut",
    onComplete: () => graphics.destroy(),
  });
  if (allowed > 0) {
    particleBurst(scene, elementPack(recipe.element, recipe.impact.particleShape), x, y, {
      count: allowed,
      dirRad: angle,
      spread: recipe.form === "lance" ? 0.44 : Math.PI,
      speed: reducedMotion ? 55 : 105 + recipe.impact.radius * 1.5,
      scale: reducedMotion ? 0.17 : 0.2 + recipe.impact.radius / 260,
      lifeMs: reducedMotion ? 190 : 360,
      additive: recipe.form !== "tome" && recipe.form !== "relic",
      sink: recipe.form === "tome" || recipe.form === "codex" ? 8 : 0,
      depth: 99510,
    });
  }
  return true;
}
