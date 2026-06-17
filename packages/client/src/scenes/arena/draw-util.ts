import type Phaser from "phaser";

/** Small drawing helpers shared by the arena VFX modules (projectile factory, effects) and the scene's
 *  own chain-bolt renderer. Pure math/graphics — no scene state. */

/** Blend two 0xRRGGBB colours by `t` (0 = c1, 1 = c2). Used for the muzzle-flash hot inner streak. */
export function blendHex(c1: number, c2: number, t: number): number {
  const r = Math.round(((c1 >> 16) & 0xff) * (1 - t) + ((c2 >> 16) & 0xff) * t);
  const g = Math.round(((c1 >> 8) & 0xff) * (1 - t) + ((c2 >> 8) & 0xff) * t);
  const b = Math.round((c1 & 0xff) * (1 - t) + (c2 & 0xff) * t);
  return (r << 16) | (g << 8) | b;
}

/** Jagged polyline between two WORLD points — the world-space twin of vfx-render's local arc-bolt jag.
 *  Walks along the segment, offsetting each interior node perpendicular by ±(segLen × jag). */
export function boltPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  jag: number,
): Array<{ x: number; y: number }> {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len; // perpendicular unit
  const py = dx / len;
  const steps = Math.max(4, (len / 22) | 0); // ~22px segments
  const pts: Array<{ x: number; y: number }> = [{ x: x0, y: y0 }];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (Math.random() - 0.5) * len * jag * 0.4;
    pts.push({ x: x0 + dx * t + px * off, y: y0 + dy * t + py * off });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

export function strokeBolt(
  g: Phaser.GameObjects.Graphics,
  pts: Array<{ x: number; y: number }>,
): void {
  if (pts.length === 0) return;
  g.beginPath();
  let started = false;
  for (const p of pts) {
    if (started) g.lineTo(p.x, p.y);
    else {
      g.moveTo(p.x, p.y);
      started = true;
    }
  }
  g.strokePath();
}
