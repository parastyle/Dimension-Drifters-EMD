import { activeWeaponUtilityMode, type WeaponDef, WeaponUtilityMode } from "@dd/shared";
import type Phaser from "phaser";
import type { SpriteRig } from "../../entities/SpriteRig.js";

const FLASHLIGHT_COLOR = 0xfff1c2;
const LASER_COLOR = 0xff4054;
const FLASHLIGHT_LENGTH = 520;
const LASER_DEFAULT_LENGTH = 760;
const LASER_MAX_LENGTH = 900;

interface WeaponUtilityVisual {
  readonly cone: Phaser.GameObjects.Graphics;
  readonly laser: Phaser.GameObjects.Rectangle;
  readonly muzzle: { x: number; y: number };
}

export interface WeaponUtilityTransform {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly laserLength: number;
}

/**
 * Pure geometry contract for both effects. The sole origin is the weapon muzzle; player/root
 * coordinates are deliberately not accepted.
 */
export function weaponUtilityTransform(
  muzzleX: number,
  muzzleY: number,
  aimX: number,
  aimY: number,
  targetX: number,
  targetY: number,
): WeaponUtilityTransform {
  let laserLength = LASER_DEFAULT_LENGTH;
  if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
    laserLength = Math.min(
      LASER_MAX_LENGTH,
      Math.max(12, Math.hypot(targetX - muzzleX, targetY - muzzleY)),
    );
  }
  return {
    x: muzzleX,
    y: muzzleY,
    angle: Math.atan2(aimY, aimX),
    laserLength,
  };
}

/**
 * Retained, transform-only utility presentation. Geometry is painted once when a player first enables a
 * supported unit; frame updates mutate visibility/position/rotation/scale only. There is no render target,
 * shader, frame-time object creation, or player-centred primitive.
 */
export class WeaponUtilityRenderer {
  private readonly visuals = new Map<string, WeaponUtilityVisual>();

  constructor(private readonly scene: Phaser.Scene) {}

  private ensure(ownerId: string): WeaponUtilityVisual {
    const retained = this.visuals.get(ownerId);
    if (retained) return retained;

    const cone = this.scene.add.graphics().setVisible(false);
    // Three low-alpha directional wedges approximate a soft falloff without a shader or radial source glow.
    cone.fillStyle(FLASHLIGHT_COLOR, 0.025);
    cone.fillTriangle(6, 0, FLASHLIGHT_LENGTH, -142, FLASHLIGHT_LENGTH, 142);
    cone.fillStyle(FLASHLIGHT_COLOR, 0.035);
    cone.fillTriangle(6, 0, FLASHLIGHT_LENGTH * 0.9, -82, FLASHLIGHT_LENGTH * 0.9, 82);
    cone.fillStyle(FLASHLIGHT_COLOR, 0.045);
    cone.fillTriangle(6, 0, FLASHLIGHT_LENGTH * 0.78, -34, FLASHLIGHT_LENGTH * 0.78, 34);
    cone.setName(`weapon-utility:${ownerId}:flashlight`);

    const laser = this.scene.add
      .rectangle(0, 0, 1, 1.4, LASER_COLOR, 0.68)
      .setOrigin(0, 0.5)
      .setVisible(false)
      .setName(`weapon-utility:${ownerId}:laser`);

    const visual = { cone, laser, muzzle: { x: 0, y: 0 } };
    this.visuals.set(ownerId, visual);
    return visual;
  }

  update(
    ownerId: string,
    retainedMode: number,
    weapon: WeaponDef | undefined,
    rig: SpriteRig,
    aimX: number,
    aimY: number,
    alive: boolean,
    projectionOriginY: number,
    projectionYScale: number,
    groundDepth: number,
    targetX: number,
    targetY: number,
  ): void {
    const mode = alive ? activeWeaponUtilityMode(weapon, retainedMode) : WeaponUtilityMode.Off;
    let visual = this.visuals.get(ownerId);
    if (mode === WeaponUtilityMode.Off || rig.heldWeaponDef(0)?.id !== weapon?.id) {
      visual?.cone.setVisible(false);
      visual?.laser.setVisible(false);
      return;
    }
    visual ??= this.ensure(ownerId);
    if (!rig.writeWeaponMuzzle(0, visual.muzzle)) {
      visual.cone.setVisible(false);
      visual.laser.setVisible(false);
      return;
    }
    if (projectionYScale !== 1) {
      visual.muzzle.y =
        projectionOriginY + (visual.muzzle.y - projectionOriginY) * projectionYScale;
    }

    const transform = weaponUtilityTransform(
      visual.muzzle.x,
      visual.muzzle.y,
      aimX,
      aimY,
      targetX,
      targetY,
    );
    const depth = Math.round(groundDepth) - 1;
    const lightOn = (mode & WeaponUtilityMode.Light) !== 0;
    const laserOn = (mode & WeaponUtilityMode.Laser) !== 0;
    visual.cone
      .setVisible(lightOn)
      .setPosition(transform.x, transform.y)
      .setRotation(transform.angle)
      .setDepth(depth);

    visual.laser
      .setVisible(laserOn)
      .setPosition(transform.x, transform.y)
      .setRotation(transform.angle)
      .setScale(transform.laserLength, 1)
      .setDepth(depth);
  }

  remove(ownerId: string): void {
    const visual = this.visuals.get(ownerId);
    if (!visual) return;
    visual.cone.destroy();
    visual.laser.destroy();
    this.visuals.delete(ownerId);
  }

  destroy(): void {
    for (const visual of this.visuals.values()) {
      visual.cone.destroy();
      visual.laser.destroy();
    }
    this.visuals.clear();
  }
}
