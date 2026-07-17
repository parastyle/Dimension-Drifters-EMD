/* biome-ignore-all lint/style/noNonNullAssertion: fixed-cap particle/trail indices are bounded by their loops. */
import Phaser from "phaser";

const PARTICLE_CAP = 56;

enum ParticleKind {
  Dust = 1,
  Scrap = 2,
  Debris = 3,
  Mote = 4,
}

function hash01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Shared, allocation-free spectacle layers for Serraketh. Every transient borrows a row from one fixed
 * particle table and every visual is drawn into a small persistent Graphics set (no tweens or emitters).
 */
export class WormBossVfx {
  readonly ground: Phaser.GameObjects.Graphics;
  private readonly particles: Phaser.GameObjects.Graphics;
  private readonly glint: Phaser.GameObjects.Graphics;
  private readonly edgeTell: Phaser.GameObjects.Graphics;

  private readonly kind = new Uint8Array(PARTICLE_CAP);
  private readonly x = new Float32Array(PARTICLE_CAP);
  private readonly y = new Float32Array(PARTICLE_CAP);
  private readonly vx = new Float32Array(PARTICLE_CAP);
  private readonly vy = new Float32Array(PARTICLE_CAP);
  private readonly age = new Float32Array(PARTICLE_CAP);
  private readonly life = new Float32Array(PARTICLE_CAP);
  private readonly size = new Float32Array(PARTICLE_CAP);
  private readonly angle = new Float32Array(PARTICLE_CAP);
  private readonly spin = new Float32Array(PARTICLE_CAP);
  private readonly originX = new Float32Array(PARTICLE_CAP);
  private readonly originY = new Float32Array(PARTICLE_CAP);
  private readonly radiusLimit = new Float32Array(PARTICLE_CAP);
  private cursor = 0;
  private lastShakeAt = -10_000;

  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(2);
    this.particles = scene.add.graphics().setDepth(99_200);
    this.glint = scene.add.graphics().setDepth(99_350).setBlendMode(Phaser.BlendModes.ADD);
    this.edgeTell = scene.add.graphics().setScrollFactor(0).setDepth(99_900);
  }

  private borrow(): number {
    for (let offset = 0; offset < PARTICLE_CAP; offset++) {
      const index = (this.cursor + offset) % PARTICLE_CAP;
      if (this.kind[index] === 0) {
        this.cursor = (index + 1) % PARTICLE_CAP;
        return index;
      }
    }
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % PARTICLE_CAP;
    return index;
  }

  private seedParticle(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifeMs: number,
    size: number,
    angle: number,
    spin: number,
    radiusLimit = 0,
  ): void {
    const index = this.borrow();
    this.kind[index] = kind;
    this.x[index] = x;
    this.y[index] = y;
    this.vx[index] = vx;
    this.vy[index] = vy;
    this.age[index] = 0;
    this.life[index] = lifeMs;
    this.size[index] = size;
    this.angle[index] = angle;
    this.spin[index] = spin;
    this.originX[index] = x;
    this.originY[index] = y;
    this.radiusLimit[index] = radiusLimit;
  }

  emitDiveDust(x: number, y: number, seed: number): void {
    for (let i = 0; i < 7; i++) {
      const a = hash01(seed + i * 19) * Math.PI * 2;
      const speed = 28 + hash01(seed + i * 31) * 54;
      this.seedParticle(
        ParticleKind.Dust,
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed * 0.58,
        300 + hash01(seed + i * 43) * 260,
        2.4 + hash01(seed + i * 59) * 4.2,
        a,
        0,
      );
    }
  }

  emitSever(x: number, y: number, tangent: number, seed: number): void {
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const a = tangent + side * (0.62 + hash01(seed + i * 37) * 1.05);
      const speed = 58 + hash01(seed + i * 53) * 110;
      this.seedParticle(
        ParticleKind.Scrap,
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        420 + hash01(seed + i * 67) * 330,
        3.8 + hash01(seed + i * 71) * 7,
        a,
        side * (2.8 + hash01(seed + i * 83) * 5.2),
      );
    }
  }

  emitEruption(x: number, y: number, claimRadius: number, seed: number): void {
    for (let i = 0; i < 22; i++) {
      const a = hash01(seed + i * 41) * Math.PI * 2;
      const startRadius = 12 + hash01(seed + i * 47) * claimRadius * 0.34;
      const speed = 110 + hash01(seed + i * 61) * 170;
      const px = x + Math.cos(a) * startRadius;
      const py = y + Math.sin(a) * startRadius;
      this.seedParticle(
        ParticleKind.Debris,
        px,
        py,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        360 + hash01(seed + i * 73) * 330,
        2.5 + hash01(seed + i * 89) * 5.5,
        a,
        (hash01(seed + i * 97) * 2 - 1) * 7,
        Math.max(8, claimRadius - 8),
      );
      this.originX[this.cursor === 0 ? PARTICLE_CAP - 1 : this.cursor - 1] = x;
      this.originY[this.cursor === 0 ? PARTICLE_CAP - 1 : this.cursor - 1] = y;
    }
  }

  emitRegrowth(x: number, y: number, seed: number): void {
    for (let i = 0; i < 8; i++) {
      const a = hash01(seed + i * 29) * Math.PI * 2;
      const radius = 30 + hash01(seed + i * 43) * 28;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      this.seedParticle(
        ParticleKind.Mote,
        px,
        py,
        (x - px) * 2.5,
        (y - py) * 2.5,
        360 + hash01(seed + i * 61) * 180,
        2 + hash01(seed + i * 71) * 3,
        a,
        0,
      );
    }
  }

  beginGroundFrame(): void {
    this.ground.clear();
  }

  drawBurrowTrail(
    xs: Float32Array,
    ys: Float32Array,
    count: number,
    head: number,
    nowMs: number,
    projectionOriginY: number,
    projectionScale: number,
  ): void {
    if (count < 2) return;
    const first = (head - count + xs.length) % xs.length;
    for (let logical = 1; logical < count; logical++) {
      const a = (first + logical - 1) % xs.length;
      const b = (first + logical) % xs.length;
      const pulse = 0.5 + Math.sin(nowMs * 0.012 + logical * 1.7) * 0.5;
      const ay = projectionOriginY + (ys[a]! - projectionOriginY) * projectionScale;
      const by = projectionOriginY + (ys[b]! - projectionOriginY) * projectionScale;
      this.ground.lineStyle(22, 0x241b24, 0.12 + pulse * 0.04);
      this.ground.lineBetween(xs[a]!, ay, xs[b]!, by);
      this.ground.lineStyle(2.2, 0xc7a66c, 0.25 + pulse * 0.16);
      this.ground.lineBetween(xs[a]!, ay, xs[b]!, by);
    }
  }

  /** Decorative material inhale only. The generic telegraph owns the exact red 145 px truth edge. */
  drawEruptionPaint(
    x: number,
    y: number,
    radius: number,
    phase: number,
    projectionOriginY: number,
    projectionScale: number,
  ): void {
    const py = projectionOriginY + (y - projectionOriginY) * projectionScale;
    const projectedRadiusY = radius * projectionScale;
    this.ground.fillStyle(0x221821, 0.08 + phase * 0.08);
    this.ground.fillEllipse(x, py, radius * 1.78, projectedRadiusY * 1.78);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.16 * Math.sin(i * 2.31);
      const inner = 24 + (i % 3) * 5;
      const outer = radius * (0.7 + (i % 4) * 0.055);
      this.ground.lineStyle(2.1, 0xb59a70, 0.16 + phase * 0.22);
      this.ground.lineBetween(
        x + Math.cos(a) * inner,
        py + Math.sin(a) * inner * projectionScale,
        x + Math.cos(a) * outer,
        py + Math.sin(a) * outer * projectionScale,
      );
    }
  }

  drawGlint(
    x: number,
    y: number,
    tangent: number,
    progress: number,
    crest: boolean,
    projectionOriginY: number,
    projectionScale: number,
  ): void {
    this.glint.clear();
    const py = projectionOriginY + (y - projectionOriginY) * projectionScale;
    const nx = -Math.sin(tangent);
    const ny = Math.cos(tangent) * projectionScale;
    const radius = crest ? 17 : 10 + progress * 4;
    for (let pass = 0; pass < 2; pass++) {
      this.glint.lineStyle(
        pass === 0 ? 5 : crest ? 3 : 1.8,
        pass === 0 ? 0x17120f : 0xffffff,
        pass === 0 ? 0.72 : crest ? 1 : 0.42 + progress * 0.42,
      );
      this.glint.beginPath();
      this.glint.moveTo(x + nx * radius, py + ny * radius);
      this.glint.lineTo(x + nx * radius * 0.3, py + ny * radius * 0.3);
      this.glint.moveTo(x - nx * radius, py - ny * radius);
      this.glint.lineTo(x - nx * radius * 0.3, py - ny * radius * 0.3);
      this.glint.strokePath();
    }
    if (crest) this.glint.fillStyle(0xffffff, 0.98).fillCircle(x, py, 3.4);
  }

  clearGlint(): void {
    this.glint.clear();
  }

  drawEdgeDirection(x: number, y: number, color: number): void {
    this.edgeTell.clear();
    const camera = this.scene.cameras.main;
    const sx = (x - camera.scrollX) * camera.zoom;
    const sy = (y - camera.scrollY) * camera.zoom;
    const width = camera.width;
    const height = camera.height;
    if (sx >= 28 && sx <= width - 28 && sy >= 28 && sy <= height - 28) return;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const dx = sx - cx;
    const dy = sy - cy;
    const scale = Math.min(
      Math.abs(dx) > 0.001 ? (cx - 42) / Math.abs(dx) : Number.POSITIVE_INFINITY,
      Math.abs(dy) > 0.001 ? (cy - 42) / Math.abs(dy) : Number.POSITIVE_INFINITY,
    );
    const ex = cx + dx * scale;
    const ey = cy + dy * scale;
    const a = Math.atan2(dy, dx);
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const bx = ex - Math.cos(a) * 19;
    const by = ey - Math.sin(a) * 19;
    this.edgeTell.fillStyle(0x17120f, 0.78);
    this.edgeTell.fillTriangle(
      ex + Math.cos(a) * 5,
      ey + Math.sin(a) * 5,
      bx + nx * 10,
      by + ny * 10,
      bx - nx * 10,
      by - ny * 10,
    );
    this.edgeTell.lineStyle(2.4, color, 0.92);
    this.edgeTell.lineBetween(bx - nx * 8, by - ny * 8, ex, ey);
    this.edgeTell.lineBetween(ex, ey, bx + nx * 8, by + ny * 8);
  }

  clearEdgeDirection(): void {
    this.edgeTell.clear();
  }

  localShake(x: number, y: number, nowMs: number, duration: number, intensity: number): void {
    // A 700 ms admission gap keeps ordinary worm shake below the advocate's rolling duty-cycle budget.
    if (nowMs - this.lastShakeAt < 700) return;
    const camera = this.scene.cameras.main;
    const cx = camera.worldView.centerX;
    const cy = camera.worldView.centerY;
    const falloff = clamp01(1 - Math.hypot(x - cx, y - cy) / 760);
    if (falloff <= 0) return;
    const host = this.scene as Phaser.Scene & {
      shakeCam?: (duration: number, amount: number) => void;
    };
    if (host.shakeCam) host.shakeCam(duration, intensity * falloff);
    else camera.shake(duration, intensity * falloff, true);
    this.lastShakeAt = nowMs;
  }

  update(deltaMs: number, projectionOriginY: number, projectionScale: number): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1000));
    this.particles.clear();
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const kind = this.kind[i]!;
      if (kind === 0) continue;
      this.age[i] = this.age[i]! + deltaMs;
      if (this.age[i]! >= this.life[i]!) {
        this.kind[i] = 0;
        continue;
      }
      const q = clamp01(this.age[i]! / this.life[i]!);
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      this.angle[i] = this.angle[i]! + this.spin[i]! * dt;
      if (
        kind === ParticleKind.Dust ||
        kind === ParticleKind.Scrap ||
        kind === ParticleKind.Debris
      ) {
        this.vx[i] = this.vx[i]! * Math.max(0, 1 - dt * 2.2);
        this.vy[i] = this.vy[i]! * Math.max(0, 1 - dt * 2.2);
      }
      if (kind === ParticleKind.Scrap || kind === ParticleKind.Debris) {
        this.vy[i] = this.vy[i]! + 115 * dt;
      }
      const limit = this.radiusLimit[i]!;
      if (limit > 0) {
        const dx = this.x[i]! - this.originX[i]!;
        const dy = this.y[i]! - this.originY[i]!;
        const distance = Math.hypot(dx, dy);
        if (distance > limit) {
          const scale = limit / Math.max(0.001, distance);
          this.x[i] = this.originX[i]! + dx * scale;
          this.y[i] = this.originY[i]! + dy * scale;
          this.vx[i] = this.vx[i]! * -0.16;
          this.vy[i] = this.vy[i]! * -0.16;
        }
      }
      const px = this.x[i]!;
      const py = projectionOriginY + (this.y[i]! - projectionOriginY) * projectionScale;
      const alpha = 1 - q;
      const size = this.size[i]!;
      if (kind === ParticleKind.Dust) {
        this.particles.fillStyle(0xc3a374, alpha * 0.34);
        this.particles.fillCircle(px, py, size * (0.7 + q * 1.25));
      } else if (kind === ParticleKind.Mote) {
        this.particles.fillStyle(0xbff4e6, alpha * 0.72);
        this.particles.fillCircle(px, py, size * (1 - q * 0.35));
      } else {
        const a = this.angle[i]!;
        const ux = Math.cos(a) * size;
        const uy = Math.sin(a) * size * projectionScale;
        const nx = -Math.sin(a) * size * 0.48;
        const ny = Math.cos(a) * size * 0.48 * projectionScale;
        this.particles.fillStyle(kind === ParticleKind.Scrap ? 0xd8cfba : 0x76655b, alpha * 0.86);
        this.particles.fillTriangle(
          px + ux,
          py + uy,
          px - ux + nx,
          py - uy + ny,
          px - ux - nx,
          py - uy - ny,
        );
      }
    }
  }

  destroy(): void {
    this.ground.destroy();
    this.particles.destroy();
    this.glint.destroy();
    this.edgeTell.destroy();
  }
}
