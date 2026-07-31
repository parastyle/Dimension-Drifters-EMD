import Phaser from "phaser";
import { PARRY_CHAIN_RIPOSTE_AT } from "@dd/shared";

/**
 * The parry's on-screen identity, shared by every mode that has a parry.
 *
 * Moved out of `ArenaScene` unchanged so the squad autobattler shows the SAME parry rather than a lookalike
 * — the owner's report was that the new mode "still doesn't have the exact same parry feel", and it did not,
 * because it was drawing its own approximation of this. Behaviour here is byte-for-byte the arena's; the
 * only addition is an optional `layer`, because a scene that lays its actors out inside a transformed
 * container needs these to land in that container rather than at scene root.
 */

/** Where a spawned effect should be parented. Omit for scene root (the arena's original behaviour). */
export type VfxLayer = Phaser.GameObjects.Container | undefined;

function place(
  scene: Phaser.Scene,
  layer: VfxLayer,
  object: Phaser.GameObjects.GameObject & { setDepth(v: number): unknown },
  depth: number,
): void {
  if (layer) layer.add(object);
  else object.setDepth(depth);
}

/** The white catch: a snapping ring, a soft core flash, and six radial sparks. */
export function spawnParrySpark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  layer?: VfxLayer,
  scale = 1,
): void {
  const ADD = Phaser.BlendModes.ADD;
  const ring = scene.add.circle(x, y, 16 * scale).setStrokeStyle(4 * scale, 0xffffff, 0.95).setBlendMode(ADD);
  place(scene, layer, ring, 99996);
  scene.tweens.add({
    targets: ring,
    scale: 2.6,
    alpha: 0,
    duration: 260,
    ease: "Quad.easeOut",
    onComplete: () => ring.destroy(),
  });
  const flash = scene.add.circle(x, y, 22 * scale, 0xffffff, 0.5).setBlendMode(ADD);
  place(scene, layer, flash, 99995);
  scene.tweens.add({
    targets: flash,
    scale: 1.4,
    alpha: 0,
    duration: 160,
    onComplete: () => flash.destroy(),
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = scene.add
      .rectangle(x, y, 13 * scale, 2.4 * scale, 0xffffff, 0.95)
      .setRotation(a)
      .setBlendMode(ADD);
    place(scene, layer, s, 99996);
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * 34 * scale,
      y: y + Math.sin(a) * 34 * scale,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeOut",
      onComplete: () => s.destroy(),
    });
  }
}

/**
 * §8 v0.114 PARRY COMBO pop — a floating "PARRY xN" that punches up over the drifter, growing bolder as the
 * chain climbs and flipping to a gold "RIPOSTE!" once the chain reaches the counter-strike threshold.
 */
export function spawnComboPop(
  scene: Phaser.Scene,
  x: number,
  y: number,
  chain: number,
  layer?: VfxLayer,
  scale = 1,
): void {
  const riposte = chain >= PARRY_CHAIN_RIPOSTE_AT;
  const label = riposte ? `RIPOSTE ×${chain}` : `PARRY ×${chain}`;
  const color = riposte ? "#ffd479" : "#bfefff";
  const size = Math.min(15 + chain * 3, 34) * scale;
  const txt = scene.add
    .text(x, y - 42 * scale, label, {
      fontFamily: "monospace",
      fontSize: `${size}px`,
      color,
      fontStyle: "bold",
      stroke: "#0a0a12",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setScale(0.5);
  place(scene, layer, txt, 99998);
  scene.tweens.add({
    targets: txt,
    y: y - 78 * scale,
    scale: 1,
    duration: 260,
    ease: "Back.easeOut",
  });
  scene.tweens.add({
    targets: txt,
    alpha: 0,
    delay: 480,
    duration: 320,
    onComplete: () => txt.destroy(),
  });
}
