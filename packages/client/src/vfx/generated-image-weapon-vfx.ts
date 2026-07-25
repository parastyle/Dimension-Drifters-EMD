import {
  bladeAngleAt,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  projectileDamageEnvelopeFor,
  type SwingDescriptor,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";
import Phaser from "phaser";
import type { WeaponBladeAttachmentPose } from "../entities/SpriteRig.js";
import {
  fanTornadoProjectileGeometryFor,
  type GeneratedImageWeaponVfxRecipe,
  generatedImageHeldBladeOverlayTransform,
  generatedImageMeleeGeometryFor,
  generatedImageProjectileGeometryFor,
  resolveGeneratedImageWeaponVfxRecipe,
} from "./generated-image-weapon-vfx-recipes.js";

export {
  FAN_TORNADO_WEAPON_VFX_IDS,
  FAN_TORNADO_WEAPON_VFX_RECIPES,
  fanTornadoFrameIndexAtTick,
  fanTornadoProjectileGeometryFor,
  GENERATED_IMAGE_WEAPON_VFX_IDS,
  GENERATED_IMAGE_WEAPON_VFX_RECIPES,
  generatedImageHeldBladeOverlayTransform,
  generatedImageMeleeGeometryFor,
  generatedImageProjectileGeometryFor,
  generatedImageVfxReplacesProceduralRecipe,
  generatedImageWeaponAudioCue,
  resolveGeneratedImageWeaponVfxRecipe,
} from "./generated-image-weapon-vfx-recipes.js";

interface GeneratedImageVfxAuditEvent {
  readonly kind:
    | "swing"
    | "chain-burst"
    | "projectile"
    | "projectile-impact"
    | "fan-tornado-projectile";
  readonly weaponId: string;
  readonly recipeKind: string;
  readonly subject: string;
  readonly textureKey: string;
  readonly proceduralLayers: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly angle?: number;
  readonly visibleForwardExtent?: number;
  readonly damageForwardExtent?: number;
  readonly heldBladeAttachmentError?: number;
  readonly heldBladePhysicalLength?: number;
  readonly visibleHalfWidth?: number;
  readonly damageHalfWidth?: number;
  readonly projectileTipExtent?: number;
  readonly projectileDamageTipExtent?: number;
  readonly poolSize?: number;
  readonly damageMode?: "server-projectile";
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  readonly damageWidth?: number;
  readonly damageHeight?: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly speed?: number;
  readonly range?: number;
  readonly upright?: boolean;
  readonly rotation?: number;
  readonly flipX?: boolean;
  readonly scalePulseMin?: number;
  readonly scalePulseMax?: number;
  readonly frameCount?: number;
  readonly frameRate?: number;
}

function auditGeneratedImageVfx(event: GeneratedImageVfxAuditEvent): void {
  const audit = globalThis as unknown as {
    __ddB11GeneratedImageVfxAudit?: GeneratedImageVfxAuditEvent[];
    __ddB22FanTornadoAudit?: GeneratedImageVfxAuditEvent[];
  };
  const frozen = Object.freeze(event);
  if (audit.__ddB11GeneratedImageVfxAudit) {
    audit.__ddB11GeneratedImageVfxAudit.push(frozen);
    if (audit.__ddB11GeneratedImageVfxAudit.length > 256)
      audit.__ddB11GeneratedImageVfxAudit.shift();
  }
  if (event.kind === "fan-tornado-projectile" && audit.__ddB22FanTornadoAudit) {
    audit.__ddB22FanTornadoAudit.push(frozen);
    if (audit.__ddB22FanTornadoAudit.length > 256) audit.__ddB22FanTornadoAudit.shift();
  }
}

function authoritativeSweepArc(weapon: WeaponDef, swing: SwingDescriptor): number {
  const sequence = meleeComboSelectionFor(weapon)?.sequence;
  const indexed =
    swing.comboStep === undefined ? undefined : sequence?.[swing.comboStep % sequence.length];
  const step = indexed ?? sequence?.find((candidate) => candidate.motion === swing.motion);
  return step?.path.deltaAngle ?? weapon.swingArc * (step?.path.arcMultiplier ?? 1);
}

function activeTiming(swing: SwingDescriptor): {
  readonly delayMs: number;
  readonly durationMs: number;
} {
  return Object.freeze({
    delayMs: Math.max(0, Math.round(swing.activeStartSeconds * 1000)),
    durationMs: Math.max(1, Math.round((swing.activeEndSeconds - swing.activeStartSeconds) * 1000)),
  });
}

function tweenSweep(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Image | Phaser.GameObjects.Container,
  weapon: WeaponDef,
  swing: SwingDescriptor,
  aimAngle: number,
  recipe: GeneratedImageWeaponVfxRecipe,
): void {
  const timing = activeTiming(swing);
  const sweepArc = authoritativeSweepArc(weapon, swing);
  target.setVisible(false);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    delay: timing.delayMs,
    duration: timing.durationMs,
    ease: "Sine.inOut",
    onStart: () => target.setVisible(true).setAlpha(0.98),
    onUpdate: (tween) => {
      const progress = tween.getValue() ?? 0;
      target.setData("generatedImageSweepProgress", progress);
      target.setRotation(bladeAngleAt(aimAngle, sweepArc, progress));
      target.setAlpha(Math.min(0.98, 0.74 + Math.sin(progress * Math.PI) * 0.24));
    },
    onComplete: () => {
      scene.tweens.add({
        targets: target,
        alpha: 0,
        duration: Math.max(70, recipe.lifeMs - timing.durationMs),
        ease: "Cubic.in",
        onComplete: () => target.destroy(true),
      });
    },
  });
}

function spawnFireDragonSweep(
  scene: Phaser.Scene,
  weapon: WeaponDef,
  recipe: GeneratedImageWeaponVfxRecipe,
  sourceBladePose: (() => WeaponBladeAttachmentPose | undefined) | undefined,
): boolean {
  const geometry = generatedImageMeleeGeometryFor(weapon);
  const initialPose = sourceBladePose?.();
  const initialTransform =
    initialPose?.weaponId === weapon.id
      ? generatedImageHeldBladeOverlayTransform(initialPose, recipe)
      : undefined;
  if (
    !geometry ||
    !initialPose ||
    !initialTransform ||
    !scene.textures.exists(recipe.textureKey)
  )
    return false;
  const image = scene.add
    .image(initialTransform.rootX, initialTransform.rootY, recipe.textureKey)
    .setName(`generated-image-vfx:${weapon.id}:fire-dragon`)
    .setOrigin(0, 0.5)
    .setDisplaySize(initialTransform.displayLength, initialTransform.displayWidth)
    .setRotation(initialTransform.angle)
    .setDepth(initialTransform.depth);
  image.setScale(image.scaleX, image.scaleY * initialTransform.normalSign);
  const syncToHeldBlade = (): void => {
    const pose = sourceBladePose?.();
    if (!pose || pose.weaponId !== weapon.id) return;
    const transform = generatedImageHeldBladeOverlayTransform(pose, recipe);
    if (!transform) return;
    image
      .setPosition(transform.rootX, transform.rootY)
      .setRotation(transform.angle)
      .setDepth(transform.depth)
      .setDisplaySize(transform.displayLength, transform.displayWidth);
    image.setScale(image.scaleX, Math.abs(image.scaleY) * transform.normalSign);
  };
  scene.events.on("postupdate", syncToHeldBlade);
  image.once("destroy", () => scene.events.off("postupdate", syncToHeldBlade));
  auditGeneratedImageVfx({
    kind: "swing",
    weaponId: weapon.id,
    recipeKind: recipe.kind,
    subject: recipe.subject,
    textureKey: recipe.textureKey,
    proceduralLayers: Object.freeze([]),
    x: initialTransform.rootX,
    y: initialTransform.rootY,
    angle: initialTransform.angle,
    visibleForwardExtent: initialTransform.displayLength,
    damageForwardExtent: geometry.forwardExtent,
    heldBladeAttachmentError: Math.hypot(
      initialTransform.tipX - initialPose.x,
      initialTransform.tipY - initialPose.y,
    ),
    heldBladePhysicalLength: initialPose.physicalBladeLength,
    visibleHalfWidth: initialTransform.displayWidth / 2,
    damageHalfWidth: geometry.halfWidth,
    poolSize: 1,
  });
  scene.tweens.add({
    targets: image,
    alpha: 0,
    delay: Math.max(0, recipe.lifeMs - 120),
    duration: Math.min(120, recipe.lifeMs),
    ease: "Cubic.in",
    onComplete: () => image.destroy(),
  });
  const liveGate = globalThis as unknown as {
    __ddB28PauseGeneratedImageWeaponId?: string;
  };
  if (liveGate.__ddB28PauseGeneratedImageWeaponId === weapon.id) scene.scene.pause();
  return true;
}

function spawnPurpleCrystalSweep(
  scene: Phaser.Scene,
  weapon: WeaponDef,
  recipe: GeneratedImageWeaponVfxRecipe,
  actorX: number,
  actorY: number,
  aimAngle: number,
  swing: SwingDescriptor,
  target?: Readonly<{ x: number; y: number }>,
): boolean {
  const geometry = generatedImageMeleeGeometryFor(weapon);
  if (!geometry || !scene.textures.exists(recipe.textureKey)) return false;
  const poolSize = Math.max(4, recipe.poolSize | 0);
  const aimProjection = target
    ? (target.x - actorX) * Math.cos(aimAngle) + (target.y - actorY) * Math.sin(aimAngle)
    : geometry.forwardExtent;
  const targetCenter = Phaser.Math.Clamp(
    aimProjection,
    geometry.halfWidth,
    geometry.forwardExtent - geometry.halfWidth,
  );
  const centers = [
    geometry.halfWidth * 0.62,
    geometry.forwardExtent * 0.22,
    geometry.forwardExtent * 0.4,
    geometry.forwardExtent * 0.58,
    targetCenter,
    geometry.forwardExtent - geometry.halfWidth,
  ];
  const children: Phaser.GameObjects.Image[] = [];
  for (let index = 0; index < poolSize; index++) {
    const main = index === poolSize - 1;
    const radius = main ? geometry.halfWidth : geometry.halfWidth * (0.58 + (index % 3) * 0.08);
    const yBudget = Math.max(0, geometry.halfWidth - radius);
    const y = main ? 0 : (index % 2 === 0 ? -1 : 1) * yBudget * 0.72;
    const x = Phaser.Math.Clamp(
      centers[index % centers.length] ?? targetCenter,
      radius,
      geometry.forwardExtent - radius,
    );
    children.push(
      scene.add
        .image(x, y, recipe.textureKey)
        .setName(`generated-image-vfx:${weapon.id}:crystal-${index}`)
        .setDisplaySize(radius * 2, radius * 2)
        .setRotation(index * 0.73)
        .setAlpha(0.94),
    );
  }
  const container = scene.add
    .container(actorX, actorY, children)
    .setName(`generated-image-vfx:${weapon.id}:crystal-pool`)
    .setDepth(100145);
  const startAngle = bladeAngleAt(aimAngle, authoritativeSweepArc(weapon, swing), 0);
  container.setRotation(startAngle);
  auditGeneratedImageVfx({
    kind: "swing",
    weaponId: weapon.id,
    recipeKind: recipe.kind,
    subject: recipe.subject,
    textureKey: recipe.textureKey,
    proceduralLayers: Object.freeze([]),
    x: actorX,
    y: actorY,
    angle: startAngle,
    visibleForwardExtent: geometry.forwardExtent,
    damageForwardExtent: geometry.forwardExtent,
    visibleHalfWidth: geometry.halfWidth,
    damageHalfWidth: geometry.halfWidth,
    poolSize,
  });
  tweenSweep(scene, container, weapon, swing, aimAngle, recipe);
  return true;
}

/** Spawn a generated-image melee treatment. B22 fan rows claim the swing without drawing: their sole
 * visual is created from the replicated server projectile at the authored impact epoch. */
export function spawnGeneratedImageWeaponSwing(
  scene: Phaser.Scene,
  weapon: WeaponDef,
  actorX: number,
  actorY: number,
  aimAngle: number,
  swing: SwingDescriptor,
  target?: Readonly<{ x: number; y: number }>,
  sourceBladePose?: () => WeaponBladeAttachmentPose | undefined,
): boolean {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weapon.id);
  if (!recipe) return false;
  if (recipe.kind === "fire-dragon-sweep")
    return spawnFireDragonSweep(scene, weapon, recipe, sourceBladePose);
  if (recipe.kind === "purple-crystal-burst")
    return spawnPurpleCrystalSweep(scene, weapon, recipe, actorX, actorY, aimAngle, swing, target);
  if (recipe.kind === "fan-tornado") return true;
  return false;
}

/** Replace Mesa-Heart's old procedural chain bolt with image-family bursts at every authoritative node. */
export function spawnGeneratedImageCrystalChain(
  scene: Phaser.Scene,
  weaponId: string,
  nodes: readonly Readonly<{ x: number; y: number }>[],
  lifeMs: number,
): boolean {
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weaponId);
  if (
    recipe?.kind !== "purple-crystal-burst" ||
    nodes.length === 0 ||
    !scene.textures.exists(recipe.textureKey)
  )
    return false;
  const weapon = WEAPONS[weaponId];
  if (!weapon) return false;
  const radius = meleeDamageEnvelopeFor(weapon).maxHalfWidth;
  for (const [index, node] of nodes.entries()) {
    const displayRadius = radius * (index === 0 ? 0.72 : 0.84);
    const image = scene.add
      .image(node.x, node.y, recipe.textureKey)
      .setName(`generated-image-vfx:${weaponId}:chain-${index}`)
      .setDisplaySize(displayRadius * 2, displayRadius * 2)
      .setRotation(index * 0.81)
      .setDepth(100155)
      .setAlpha(0.92);
    scene.tweens.add({
      targets: image,
      alpha: 0,
      scaleX: image.scaleX * 1.16,
      scaleY: image.scaleY * 1.16,
      duration: Math.max(180, lifeMs),
      ease: "Cubic.out",
      onComplete: () => image.destroy(),
    });
    auditGeneratedImageVfx({
      kind: "chain-burst",
      weaponId,
      recipeKind: recipe.kind,
      subject: recipe.subject,
      textureKey: recipe.textureKey,
      proceduralLayers: Object.freeze([]),
      x: node.x,
      y: node.y,
      visibleHalfWidth: displayRadius,
      poolSize: nodes.length,
    });
  }
  return true;
}

/** Replace the generic projectile with its complete generated-image payload on the authoritative row. */
export function makeGeneratedImageWeaponProjectile(
  scene: Phaser.Scene,
  projectile: Readonly<{ x: number; y: number; vx: number; vy: number }>,
  weaponId: string,
): Phaser.GameObjects.Container | null {
  const weapon = WEAPONS[weaponId];
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weaponId);
  if (!weapon || !recipe || !scene.textures.exists(recipe.textureKey)) return null;
  if (recipe.kind === "fan-tornado") {
    const geometry = fanTornadoProjectileGeometryFor(weapon);
    const hybrid = weapon.hybridProjectile;
    if (!geometry || !hybrid) return null;
    const flipX = projectile.vx < 0;
    const frameTextureKeys = recipe.frames.map((frame) => frame.textureKey);
    const image = scene.add
      .image(0, 0, frameTextureKeys[0] ?? recipe.textureKey)
      .setName(`generated-image-vfx:${weaponId}:fan-tornado-image`)
      .setOrigin(0.5)
      .setDisplaySize(geometry.displayWidth, geometry.displayHeight)
      .setRotation(0)
      .setFlipX(flipX)
      .setFlipY(false);
    const container = scene.add
      .container(projectile.x, projectile.y, [image])
      .setName(`generated-image-vfx:${weaponId}:fan-tornado-projectile`)
      .setDepth(99100)
      .setRotation(0)
      .setData("fanTornadoImage", image)
      .setData("fanTornadoBaseScaleX", image.scaleX)
      .setData("fanTornadoBaseScaleY", image.scaleY)
      .setData("fanTornadoPulse", recipe.scalePulse)
      .setData("fanTornadoPulseSeconds", 0)
      .setData("fanTornadoFacing", flipX ? -1 : 1)
      .setData("fanTornadoFrameRate", recipe.frameRate)
      .setData("fanTornadoFrameTextureKeys", frameTextureKeys)
      .setData("fanTornadoFrameIndex", 0)
      .setData("generatedImageWeaponId", weaponId)
      .setData("generatedImageRecipe", recipe)
      .setData("ang", 0);
    auditGeneratedImageVfx({
      kind: "fan-tornado-projectile",
      weaponId,
      recipeKind: recipe.kind,
      subject: recipe.subject,
      textureKey: recipe.textureKey,
      proceduralLayers: Object.freeze([]),
      x: projectile.x,
      y: projectile.y,
      poolSize: recipe.poolSize,
      damageMode: "server-projectile",
      displayWidth: geometry.displayWidth,
      displayHeight: geometry.displayHeight,
      damageWidth: geometry.damageWidth,
      damageHeight: geometry.damageHeight,
      velocityX: projectile.vx,
      velocityY: projectile.vy,
      speed: hybrid.speed,
      range: hybrid.range,
      upright: true,
      rotation: 0,
      flipX,
      scalePulseMin: 1,
      scalePulseMax: 1 + recipe.scalePulse,
      frameCount: frameTextureKeys.length,
      frameRate: recipe.frameRate,
    });
    return container;
  }
  if (recipe.kind !== "arcane-lance-projectile") return null;
  const geometry = generatedImageProjectileGeometryFor(weapon);
  if (!geometry) return null;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const image = scene.add
    .image(0, 0, recipe.textureKey)
    .setName(`generated-image-vfx:${weaponId}:projectile`)
    .setOrigin(0.5)
    .setDisplaySize(geometry.displayWidth, geometry.displayHeight);
  const payload = scene.add.container(0, 0, [image]).setRotation(angle);
  const container = scene.add
    .container(projectile.x, projectile.y, [payload])
    .setDepth(99050)
    .setData("arcPayload", payload)
    .setData("ang", angle)
    .setData("generatedImageWeaponId", weaponId)
    .setData("generatedImageRecipe", recipe);
  auditGeneratedImageVfx({
    kind: "projectile",
    weaponId,
    recipeKind: recipe.kind,
    subject: recipe.subject,
    textureKey: recipe.textureKey,
    proceduralLayers: Object.freeze([]),
    x: projectile.x,
    y: projectile.y,
    angle,
    projectileTipExtent: geometry.tipExtent,
    projectileDamageTipExtent: geometry.tipExtent,
    visibleHalfWidth: geometry.displayHeight / 2,
    damageHalfWidth: projectileDamageEnvelopeFor(weapon, "cast").radius,
    poolSize: 1,
  });
  return container;
}

/** Image-owned projectile death punctuation; returning true suppresses the old caster/bullet impact. */
export function spawnGeneratedImageWeaponProjectileImpact(
  scene: Phaser.Scene,
  weaponId: string | undefined,
  x: number,
  y: number,
  angle: number,
): boolean {
  const weapon = weaponId ? WEAPONS[weaponId] : undefined;
  const recipe = resolveGeneratedImageWeaponVfxRecipe(weaponId);
  if (weapon && recipe?.kind === "fan-tornado") return true;
  if (
    !weapon ||
    recipe?.kind !== "arcane-lance-projectile" ||
    !scene.textures.exists(recipe.textureKey)
  )
    return false;
  const geometry = generatedImageProjectileGeometryFor(weapon);
  if (!geometry) return false;
  const image = scene.add
    .image(x, y, recipe.textureKey)
    .setName(`generated-image-vfx:${weapon.id}:impact`)
    .setOrigin(0.72, 0.5)
    .setDisplaySize(geometry.displayWidth * 0.58, geometry.displayHeight * 0.58)
    .setRotation(angle)
    .setDepth(99520)
    .setAlpha(0.82);
  scene.tweens.add({
    targets: image,
    alpha: 0,
    scaleX: image.scaleX * 1.12,
    scaleY: image.scaleY * 1.12,
    duration: recipe.lifeMs,
    ease: "Cubic.out",
    onComplete: () => image.destroy(),
  });
  auditGeneratedImageVfx({
    kind: "projectile-impact",
    weaponId: weapon.id,
    recipeKind: recipe.kind,
    subject: recipe.subject,
    textureKey: recipe.textureKey,
    proceduralLayers: Object.freeze([]),
    x,
    y,
    angle,
    projectileTipExtent: geometry.tipExtent,
    projectileDamageTipExtent: geometry.tipExtent,
    poolSize: 1,
  });
  return true;
}
