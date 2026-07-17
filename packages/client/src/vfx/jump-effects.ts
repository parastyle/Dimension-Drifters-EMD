import type Phaser from "phaser";

const RING_MAX = 24;
const DUST_MAX = 96;
const SKID_MAX = 24;
const TAU = Math.PI * 2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Fixed pools + retained Graphics: jump-feel presentation creates no objects in steady state. */
export class JumpEffectRenderer {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly live: Phaser.GameObjects.Graphics;
  private readonly effects: Phaser.GameObjects.Graphics;

  private readonly ringActive = new Uint8Array(RING_MAX);
  private readonly ringTruth = new Uint8Array(RING_MAX);
  private readonly ringX = new Float32Array(RING_MAX);
  private readonly ringY = new Float32Array(RING_MAX);
  private readonly ringAge = new Float32Array(RING_MAX);
  private readonly ringLife = new Float32Array(RING_MAX);
  private readonly ringFrom = new Float32Array(RING_MAX);
  private readonly ringTo = new Float32Array(RING_MAX);
  private readonly ringColor = new Uint32Array(RING_MAX);
  private readonly ringScaleY = new Float32Array(RING_MAX);
  private ringCursor = 0;

  private readonly dustActive = new Uint8Array(DUST_MAX);
  private readonly dustScrap = new Uint8Array(DUST_MAX);
  private readonly dustX = new Float32Array(DUST_MAX);
  private readonly dustY = new Float32Array(DUST_MAX);
  private readonly dustVx = new Float32Array(DUST_MAX);
  private readonly dustVy = new Float32Array(DUST_MAX);
  private readonly dustAge = new Float32Array(DUST_MAX);
  private readonly dustLife = new Float32Array(DUST_MAX);
  private readonly dustRadius = new Float32Array(DUST_MAX);
  private readonly dustLimit = new Float32Array(DUST_MAX);
  private readonly dustLimitYScale = new Float32Array(DUST_MAX);
  private readonly dustOriginX = new Float32Array(DUST_MAX);
  private readonly dustOriginY = new Float32Array(DUST_MAX);
  private readonly dustColor = new Uint32Array(DUST_MAX);
  private dustCursor = 0;

  private readonly skidActive = new Uint8Array(SKID_MAX);
  private readonly skidX = new Float32Array(SKID_MAX);
  private readonly skidY = new Float32Array(SKID_MAX);
  private readonly skidDx = new Float32Array(SKID_MAX);
  private readonly skidDy = new Float32Array(SKID_MAX);
  private readonly skidAge = new Float32Array(SKID_MAX);
  private skidCursor = 0;

  constructor(scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(4);
    this.effects = scene.add.graphics().setDepth(99991);
    this.live = scene.add.graphics().setDepth(99992);
  }

  /** Clear only the continuous frame channels; pooled impacts are redrawn by update(). */
  beginFrame(): void {
    this.ground.clear();
    this.live.clear();
  }

  drawDistanceIndicator(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    clamped: boolean,
    nowMs: number,
    reducedMotion: boolean,
    alpha = 0.55,
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len <= 1) return;
    const nx = dx / len;
    const ny = dy / len;
    const color = clamped ? 0x8a4a3a : 0xc7a66c;
    this.ground.lineStyle(1.5, color, alpha);
    for (let d = 0; d < len; d += 9) {
      const e = Math.min(len, d + 5);
      this.ground.beginPath();
      this.ground.moveTo(x0 + nx * d, y0 + ny * d);
      this.ground.lineTo(x0 + nx * e, y0 + ny * e);
      this.ground.strokePath();
    }
    const pulse = reducedMotion ? 1 : 1.04 + Math.sin((nowMs / 1000) * TAU * 3) * 0.04;
    this.ground.lineStyle(1.8, color, Math.min(0.9, alpha + 0.2));
    this.ground.strokeEllipse(x1, y1, 46 * pulse, 17 * pulse);
    const cx = x0 + dx * (2 / 3);
    const cy = y0 + dy * (2 / 3);
    const px = -ny;
    const py = nx;
    this.ground.fillStyle(color, alpha + 0.15);
    this.ground.fillTriangle(
      cx + nx * 7,
      cy + ny * 7,
      cx - nx * 5 + px * 4,
      cy - ny * 5 + py * 4,
      cx - nx * 5 - px * 4,
      cy - ny * 5 - py * 4,
    );
  }

  drawPoundStreak(
    x: number,
    y: number,
    height: number,
    fallSpeed: number,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion || fallSpeed <= 0) return;
    const length = Math.min(46, fallSpeed * 0.06);
    const top = y - height - 28;
    this.live.lineStyle(5, 0x251d18, 0.48).lineBetween(x, top - length, x, top + 4);
    this.live.lineStyle(1.8, 0xf7ead0, 0.72).lineBetween(x, top - length, x, top + 4);
    this.live.lineStyle(1.2, 0xd8c7aa, 0.28);
    this.live.lineBetween(x - 18, top - length * 0.72, x - 18, top - 4);
    this.live.lineBetween(x + 18, top - length * 0.72, x + 18, top - 4);
  }

  /** Retained-frame wake: two sparse paper strokes, never a particle allocation. */
  drawSlideWake(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    slideT: number,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) return;
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    const px = -ny;
    const py = nx;
    const fade = clamp01(1 - slideT / 0.5);
    this.live.lineStyle(3, 0xeadfc9, 0.2 + fade * 0.26);
    this.live.lineBetween(
      x - nx * 20 + px * 8,
      y - ny * 20 + py * 8,
      x - nx * 48 + px * 11,
      y - ny * 48 + py * 11,
    );
    this.live.lineStyle(1.5, 0x796a58, 0.14 + fade * 0.18);
    this.live.lineBetween(
      x - nx * 15 - px * 7,
      y - ny * 15 - py * 7,
      x - nx * 37 - px * 10,
      y - ny * 37 - py * 10,
    );
  }

  /** Shift/Ctrl-down acceptance: a compact launch scuff and low paper-dust fan from the fixed pools. */
  spawnSlideBurst(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    reducedMotion: boolean,
    projectionYScale = 1,
  ): void {
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    this.spawnRing(x, y, 3, 10, 150, 0xd9c8aa, false, projectionYScale);
    if (reducedMotion) return;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lateral = side * (18 + i * 2);
      this.spawnDust(
        x - nx * 8,
        y - ny * 8,
        -nx * (48 + i * 7) - ny * lateral,
        -ny * (48 + i * 7) + nx * lateral,
        190 + i * 18,
        1.4 + (i % 3) * 0.45,
        0xd5c6ac,
        0,
        projectionYScale,
        i >= 4,
      );
    }
    this.spawnSkid(x, y, nx, ny, -5);
    this.spawnSkid(x, y, nx, ny, 5);
  }

  /** Vulnerable-tail handoff: two short heel marks and a low dust settle. */
  spawnSlidePlant(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    reducedMotion: boolean,
    projectionYScale = 1,
  ): void {
    const length = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / length;
    const ny = dirY / length;
    this.spawnRing(x, y, 2, 8, 130, 0xb8a587, false, projectionYScale);
    this.spawnSkid(x, y, nx, ny, -4);
    this.spawnSkid(x, y, nx, ny, 4);
    if (reducedMotion) return;
    for (let i = 0; i < 3; i++)
      this.spawnDust(
        x,
        y,
        -nx * (26 + i * 8) - ny * (i - 1) * 11,
        -ny * (26 + i * 8) + nx * (i - 1) * 11,
        180 + i * 22,
        1.6,
        0xbcae95,
        0,
        projectionYScale,
        false,
      );
  }

  /** An attack crossed an i-frame: pale, deliberately quieter than the white parry reward burst. */
  spawnSlideWhiff(x: number, y: number, projectionYScale = 1): void {
    this.spawnRing(x, y, 5, 15, 115, 0xeee5d2, false, projectionYScale);
  }

  /** Rejected Shift/Ctrl: a tiny ochre scuff, never an apparent successful slide. */
  spawnSlideDry(x: number, y: number, projectionYScale = 1): void {
    this.spawnRing(x, y, 2, 6, 100, 0x856f52, false, projectionYScale);
  }

  spawnLanding(
    x: number,
    y: number,
    tier: 1 | 2 | 3,
    dirX: number,
    dirY: number,
    distanceJump: boolean,
    reducedMotion: boolean,
    projectionYScale = 1,
  ): void {
    const radius = tier === 1 ? 9 : tier === 2 ? 14 : 20;
    this.spawnRing(x, y, radius * 0.45, radius, 240, 0xcfc6ae, false, projectionYScale);
    const count = reducedMotion ? 0 : tier === 1 ? 3 : tier === 2 ? 6 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / Math.max(1, count)) * TAU + tier * 0.37;
      const speed = 30 + tier * 14 + (i % 3) * 7;
      this.spawnDust(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.58,
        240 + (i % 4) * 24,
        1.5 + (i % 2),
        0xcfc6ae,
        0,
        projectionYScale,
        false,
      );
    }
    if (distanceJump) {
      const len = Math.hypot(dirX, dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      for (let i = 0; i < 2; i++) {
        const slot = this.skidCursor++ % SKID_MAX;
        this.skidActive[slot] = 1;
        this.skidAge[slot] = 0;
        this.skidX[slot] = x - nx * (8 + i * 7) + -ny * (i === 0 ? -5 : 5);
        this.skidY[slot] = y - ny * (8 + i * 7) + nx * (i === 0 ? -5 : 5);
        this.skidDx[slot] = -nx * 18;
        this.skidDy[slot] = -ny * 18;
      }
    }
  }

  /** The truth ring reaches exactly `radius` and never renders energetic geometry outside it. */
  spawnPoundImpact(
    x: number,
    y: number,
    radius: number,
    color: number,
    reducedMotion: boolean,
    projectionYScale = 1,
  ): void {
    this.spawnRing(x, y, radius * 0.3, radius, 130, color, true, projectionYScale);
    const count = reducedMotion ? 0 : 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + 0.19;
      const speed = 90 + (i % 5) * 14;
      const scrap = i >= 8;
      this.spawnDust(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.58,
        scrap ? 430 : 320,
        scrap ? 3.2 : 2.2,
        scrap ? 0xb59a70 : 0xcfc6ae,
        Math.max(0, radius - 8),
        projectionYScale,
        scrap,
      );
    }
  }

  update(deltaMs: number): void {
    const dt = Math.max(0, Math.min(100, deltaMs));
    const dtSec = dt / 1000;
    this.effects.clear();
    for (let i = 0; i < RING_MAX; i++) {
      if (this.ringActive[i] === 0) continue;
      const age = (this.ringAge[i] ?? 0) + dt;
      this.ringAge[i] = age;
      const q = clamp01(age / (this.ringLife[i] || 1));
      if (q >= 1) {
        this.ringActive[i] = 0;
        continue;
      }
      // Truth rings spend their final readable frames exactly on the authoritative boundary.
      const eased = this.ringTruth[i] !== 0 && q >= 0.82 ? 1 : 1 - (1 - q) ** 3;
      const radius =
        (this.ringFrom[i] ?? 0) + ((this.ringTo[i] ?? 0) - (this.ringFrom[i] ?? 0)) * eased;
      const alpha = 1 - q;
      const ringX = this.ringX[i] ?? 0;
      const ringY = this.ringY[i] ?? 0;
      const ringScaleY = this.ringScaleY[i] ?? 1;
      const ringColor = this.ringColor[i] ?? 0xcfc6ae;
      if (this.ringTruth[i] !== 0) {
        this.effects.lineStyle(5, 0x251d18, alpha * 0.72);
        this.effects.strokeEllipse(ringX, ringY, radius * 2, radius * 2 * ringScaleY);
        this.effects.lineStyle(2.5, ringColor, alpha * 0.95);
      } else {
        this.effects.lineStyle(2, ringColor, alpha * 0.45);
      }
      this.effects.strokeEllipse(ringX, ringY, radius * 2, radius * 2 * ringScaleY);
    }
    for (let i = 0; i < DUST_MAX; i++) {
      if (this.dustActive[i] === 0) continue;
      const age = (this.dustAge[i] ?? 0) + dt;
      this.dustAge[i] = age;
      const q = clamp01(age / (this.dustLife[i] || 1));
      if (q >= 1) {
        this.dustActive[i] = 0;
        continue;
      }
      let nx = (this.dustX[i] ?? 0) + (this.dustVx[i] ?? 0) * dtSec;
      let ny = (this.dustY[i] ?? 0) + (this.dustVy[i] ?? 0) * dtSec;
      const limit = this.dustLimit[i] ?? 0;
      if (limit > 0) {
        const ox = nx - (this.dustOriginX[i] ?? 0);
        const oy = ny - (this.dustOriginY[i] ?? 0);
        const limitYScale = this.dustLimitYScale[i] || 1;
        const distance = Math.hypot(ox, oy / limitYScale);
        if (distance > limit) {
          const clampScale = limit / distance;
          nx = (this.dustOriginX[i] ?? 0) + ox * clampScale;
          ny = (this.dustOriginY[i] ?? 0) + oy * clampScale;
          this.dustVx[i] = -(this.dustVx[i] ?? 0) * 0.18;
          this.dustVy[i] = -(this.dustVy[i] ?? 0) * 0.18;
        }
      }
      this.dustX[i] = nx;
      this.dustY[i] = ny;
      const alpha = (1 - q) * (this.dustScrap[i] !== 0 ? 0.72 : 0.48);
      this.effects.fillStyle(this.dustColor[i] ?? 0xcfc6ae, alpha);
      const r = (this.dustRadius[i] ?? 1) * (1 + q * 0.7);
      if (this.dustScrap[i] !== 0) {
        const spin = age * 0.012 + i;
        this.effects.fillTriangle(
          nx + Math.cos(spin) * r * 1.8,
          ny + Math.sin(spin) * r * 1.8,
          nx + Math.cos(spin + 2.2) * r,
          ny + Math.sin(spin + 2.2) * r,
          nx + Math.cos(spin - 2.2) * r,
          ny + Math.sin(spin - 2.2) * r,
        );
      } else {
        this.effects.fillCircle(nx, ny, r);
      }
    }
    for (let i = 0; i < SKID_MAX; i++) {
      if (this.skidActive[i] === 0) continue;
      const age = (this.skidAge[i] ?? 0) + dt;
      this.skidAge[i] = age;
      const q = clamp01(age / 300);
      if (q >= 1) {
        this.skidActive[i] = 0;
        continue;
      }
      this.effects.lineStyle(1.5, 0x2b241d, (1 - q) * 0.35);
      const skidX = this.skidX[i] ?? 0;
      const skidY = this.skidY[i] ?? 0;
      this.effects.lineBetween(
        skidX,
        skidY,
        skidX + (this.skidDx[i] ?? 0),
        skidY + (this.skidDy[i] ?? 0),
      );
    }
  }

  clear(): void {
    this.ringActive.fill(0);
    this.dustActive.fill(0);
    this.skidActive.fill(0);
    this.ground.clear();
    this.live.clear();
    this.effects.clear();
  }

  destroy(): void {
    this.ground.destroy();
    this.live.destroy();
    this.effects.destroy();
  }

  private spawnRing(
    x: number,
    y: number,
    from: number,
    to: number,
    life: number,
    color: number,
    truth: boolean,
    projectionYScale: number,
  ): void {
    const slot = this.ringCursor++ % RING_MAX;
    this.ringActive[slot] = 1;
    this.ringTruth[slot] = Number(truth);
    this.ringX[slot] = x;
    this.ringY[slot] = y;
    this.ringAge[slot] = 0;
    this.ringLife[slot] = life;
    this.ringFrom[slot] = from;
    this.ringTo[slot] = to;
    this.ringColor[slot] = color;
    this.ringScaleY[slot] = projectionYScale;
  }

  private spawnDust(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    radius: number,
    color: number,
    radiusLimit: number,
    radiusLimitYScale: number,
    scrap: boolean,
  ): void {
    const slot = this.dustCursor++ % DUST_MAX;
    this.dustActive[slot] = 1;
    this.dustScrap[slot] = Number(scrap);
    this.dustX[slot] = x;
    this.dustY[slot] = y;
    this.dustOriginX[slot] = x;
    this.dustOriginY[slot] = y;
    this.dustVx[slot] = vx;
    this.dustVy[slot] = vy;
    this.dustAge[slot] = 0;
    this.dustLife[slot] = life;
    this.dustRadius[slot] = radius;
    this.dustLimit[slot] = radiusLimit;
    this.dustLimitYScale[slot] = radiusLimitYScale;
    this.dustColor[slot] = color;
  }

  private spawnSkid(x: number, y: number, dirX: number, dirY: number, side: number): void {
    const slot = this.skidCursor++ % SKID_MAX;
    this.skidActive[slot] = 1;
    this.skidAge[slot] = 0;
    this.skidX[slot] = x - dirY * side;
    this.skidY[slot] = y + dirX * side;
    this.skidDx[slot] = -dirX * 16;
    this.skidDy[slot] = -dirY * 16;
  }
}
