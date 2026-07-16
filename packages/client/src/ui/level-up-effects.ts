import Phaser from "phaser";
import { PARTICLE_PACKS } from "../vfx/particle-manifest.js";

/** Bounded, card-local confirmation that keeps painted particles in fixed screen space. */
export function spawnLevelConfirmEffect(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: number,
  particlePack: string,
  reducedMotion: boolean,
): void {
  const stamp = scene.add.graphics().setScrollFactor(0).setDepth(100020);
  const stampWidth = Math.min(width + 14, 280);
  const stampHeight = Math.min(height + 14, 190);
  stamp
    .lineStyle(4, accent, 0.95)
    .strokeRoundedRect(x - stampWidth / 2, y - stampHeight / 2, stampWidth, stampHeight, 12);
  stamp.lineStyle(2, 0xfff2c0, 0.9);
  stamp.lineBetween(x - 10, y, x - 2, y + 8);
  stamp.lineBetween(x - 2, y + 8, x + 14, y - 10);

  if (reducedMotion) {
    scene.tweens.add({
      targets: stamp,
      alpha: 0,
      duration: 100,
      onComplete: () => stamp.destroy(),
    });
    return;
  }

  stamp.setScale(0.86).setAlpha(0.95);
  scene.tweens.add({
    targets: stamp,
    scale: 1.08,
    alpha: 0,
    duration: 240,
    ease: "Cubic.easeOut",
    onComplete: () => stamp.destroy(),
  });

  const pack = PARTICLE_PACKS[particlePack];
  const texture = `ptcl:${particlePack}`;
  if (!pack || !scene.textures.exists(texture)) return;
  const count = 5;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2 + (Math.random() - 0.5) * 0.28;
    const distance = 34 + Math.random() * 34;
    const mote = scene.add
      .image(x, y, texture, Math.floor(Math.random() * pack.count))
      .setScrollFactor(0)
      .setDepth(100019)
      .setScale(0.16 + Math.random() * 0.08)
      .setRotation(Math.random() * Math.PI * 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: mote,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: 0,
      scale: mote.scale * 0.55,
      angle: mote.angle + (Math.random() - 0.5) * 90,
      duration: 210 + Math.random() * 90,
      ease: "Quad.easeOut",
      onComplete: () => mote.destroy(),
    });
  }
}
