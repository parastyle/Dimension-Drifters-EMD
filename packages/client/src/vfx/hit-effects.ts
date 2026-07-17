import Phaser from "phaser";

export const IMPACT_RING_DEPTH = 99820;
export const SPARK_CORE_DEPTH = 99830;
export const SHIMMER_DEPTH = 99835;
export const SPARK_SLIVER_DEPTH = 99840;
export const CRIT_STAR_DEPTH = 99845;
export const SPEED_LINE_DEPTH = 99850;
export const RECEIPT_VFX_MAX_DEPTH = 99860;

const MAX_STARS = 12;
const MAX_CORES = 32;
const MAX_SLIVERS = 128;
const MAX_SHIMMERS = 32;

export type ContactVisualMode = "discrete" | "thinned" | "shimmer";

export type HitEffectTargetResolver = (targetId: string, out: { x: number; y: number }) => boolean;

interface ContactHistory {
  lastAt: number;
  averageInterval: number;
  quickHits: number;
  parity: number;
  lastStarAt: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Fixed pools for receipt-driven contact primitives. No Phaser Tweens or per-contact GameObjects. */
export class HitEffectRenderer {
  private readonly starContainers: Phaser.GameObjects.Container[] = [];
  private readonly starActive = new Uint8Array(MAX_STARS);
  private readonly starAge = new Float32Array(MAX_STARS);
  private readonly starRotation = new Float32Array(MAX_STARS);
  private readonly starReduced = new Uint8Array(MAX_STARS);
  private starCursor = 0;

  private readonly cores: Phaser.GameObjects.Arc[] = [];
  private readonly coreActive = new Uint8Array(MAX_CORES);
  private readonly coreAge = new Float32Array(MAX_CORES);
  private readonly coreLife = new Float32Array(MAX_CORES);
  private readonly coreReduced = new Uint8Array(MAX_CORES);
  private coreCursor = 0;

  private readonly slivers: Phaser.GameObjects.Rectangle[] = [];
  private readonly sliverActive = new Uint8Array(MAX_SLIVERS);
  private readonly sliverAge = new Float32Array(MAX_SLIVERS);
  private readonly sliverLife = new Float32Array(MAX_SLIVERS);
  private readonly sliverVx = new Float32Array(MAX_SLIVERS);
  private readonly sliverVy = new Float32Array(MAX_SLIVERS);
  private readonly sliverSpin = new Float32Array(MAX_SLIVERS);
  private readonly sliverReduced = new Uint8Array(MAX_SLIVERS);
  private sliverCursor = 0;

  private readonly shimmers: Phaser.GameObjects.Rectangle[] = [];
  private readonly shimmerActive = new Uint8Array(MAX_SHIMMERS);
  private readonly shimmerLastAt = new Float64Array(MAX_SHIMMERS);
  private readonly shimmerDripAt = new Float64Array(MAX_SHIMMERS);
  private readonly shimmerDirX = new Float32Array(MAX_SHIMMERS);
  private readonly shimmerDirY = new Float32Array(MAX_SHIMMERS);
  private readonly shimmerColor = new Uint32Array(MAX_SHIMMERS);
  private readonly shimmerTargets = new Array<string>(MAX_SHIMMERS).fill("");
  private readonly shimmerByTarget = new Map<string, number>();
  private shimmerCursor = 0;

  private readonly histories = new Map<string, ContactHistory>();
  private readonly targetPoint = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolveTarget: HitEffectTargetResolver,
  ) {
    const add = Phaser.BlendModes.ADD;
    for (let i = 0; i < MAX_STARS; i++) {
      const long = scene.add.rectangle(0, 0, 46, 3, 0xffdb63, 1).setBlendMode(add);
      const short = scene.add
        .rectangle(0, 0, 26, 3, 0xffdb63, 1)
        .setRotation(Math.PI / 2)
        .setBlendMode(add);
      const core = scene.add.circle(0, 0, 5, 0xffffff, 0.9).setBlendMode(add);
      this.starContainers.push(
        scene.add.container(0, 0, [long, short, core]).setDepth(CRIT_STAR_DEPTH).setVisible(false),
      );
    }
    for (let i = 0; i < MAX_CORES; i++) {
      this.cores.push(
        scene.add
          .circle(0, 0, 5, 0xffffff, 0.85)
          .setBlendMode(add)
          .setDepth(SPARK_CORE_DEPTH)
          .setVisible(false),
      );
    }
    for (let i = 0; i < MAX_SLIVERS; i++) {
      this.slivers.push(
        scene.add
          .rectangle(0, 0, 12, 2.2, 0xfff2c0, 0.95)
          .setBlendMode(add)
          .setDepth(SPARK_SLIVER_DEPTH)
          .setVisible(false),
      );
    }
    for (let i = 0; i < MAX_SHIMMERS; i++) {
      this.shimmers.push(
        scene.add
          .rectangle(0, 0, 18, 5, 0xfff2c0, 0.5)
          .setBlendMode(add)
          .setDepth(SHIMMER_DEPTH)
          .setVisible(false),
      );
    }
  }

  registerContact(
    targetId: string,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: number,
    presentationMs: number,
  ): ContactVisualMode {
    let history = this.histories.get(targetId);
    if (!history) {
      history = {
        lastAt: -1e9,
        averageInterval: 1000,
        quickHits: 0,
        parity: 0,
        lastStarAt: -1e9,
      };
      this.histories.set(targetId, history);
    }
    const interval = presentationMs - history.lastAt;
    if (interval > 0 && interval < 600) {
      history.averageInterval =
        history.averageInterval >= 600
          ? interval
          : history.averageInterval * 0.55 + interval * 0.45;
      history.quickHits = interval < 125 ? history.quickHits + 1 : 0;
    } else {
      history.averageInterval = 1000;
      history.quickHits = 0;
    }
    history.lastAt = presentationMs;
    history.parity ^= 1;

    const existing = this.shimmerByTarget.get(targetId);
    if (existing !== undefined || (history.quickHits >= 2 && history.averageInterval < 125)) {
      const slot = existing ?? this.acquireShimmer(targetId);
      const shimmer = this.shimmers[slot]!;
      this.shimmerLastAt[slot] = presentationMs;
      this.shimmerDirX[slot] = dirX;
      this.shimmerDirY[slot] = dirY;
      this.shimmerColor[slot] = color;
      shimmer.setPosition(x, y).setRotation(Math.atan2(dirY, dirX)).setFillStyle(color, 0.5);
      return "shimmer";
    }
    if (history.averageInterval < 240) return history.parity === 0 ? "thinned" : "shimmer";
    return "discrete";
  }

  spark(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    color: number,
    crit: boolean,
    reducedFlash: boolean,
    scale = 1,
  ): void {
    const direction = Math.atan2(dirY, dirX);
    const coreSlot = this.coreCursor++ % MAX_CORES;
    const core = this.cores[coreSlot]!;
    this.coreActive[coreSlot] = 1;
    this.coreAge[coreSlot] = 0;
    this.coreLife[coreSlot] = 130;
    this.coreReduced[coreSlot] = Number(reducedFlash);
    core
      .setPosition(x, y)
      .setRadius((crit ? 7 : 5) * scale)
      .setAlpha(reducedFlash ? 0.47 : 0.85)
      .setScale(1)
      .setVisible(true);

    const count = crit ? 6 : 4;
    for (let i = 0; i < count; i++) {
      const slot = this.sliverCursor++ % MAX_SLIVERS;
      const phase = ((slot * 0.61803398875 + i * 0.173) % 1) - 0.5;
      const angle = direction + phase * (crit ? 1.6 : 1.2);
      const speed = (crit ? 250 : 205) * scale * (0.85 + ((slot * 37) % 23) / 100);
      const sliver = this.slivers[slot]!;
      this.sliverActive[slot] = 1;
      this.sliverAge[slot] = 0;
      this.sliverLife[slot] = 150 + ((slot * 29) % 90);
      this.sliverVx[slot] = Math.cos(angle) * speed;
      this.sliverVy[slot] = Math.sin(angle) * speed;
      this.sliverSpin[slot] = phase * 2.4;
      this.sliverReduced[slot] = Number(reducedFlash);
      sliver
        .setPosition(x, y)
        .setSize(12 * scale, 2.2 * scale)
        .setRotation(angle)
        .setFillStyle(crit ? 0xffdb63 : color, reducedFlash ? 0.52 : 0.95)
        .setVisible(true);
    }
  }

  critStar(
    targetId: string,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    presentationMs: number,
    reducedFlash: boolean,
  ): boolean {
    const history = this.histories.get(targetId);
    if (history && presentationMs - history.lastStarAt < 250) return false;
    if (history) history.lastStarAt = presentationMs;
    const slot = this.starCursor++ % MAX_STARS;
    const star = this.starContainers[slot]!;
    this.starActive[slot] = 1;
    this.starAge[slot] = 0;
    this.starRotation[slot] = Math.atan2(dirY, dirX);
    this.starReduced[slot] = Number(reducedFlash);
    star
      .setPosition(x, y)
      .setRotation(this.starRotation[slot]!)
      .setScale(1)
      .setAlpha(reducedFlash ? 0.7 : 1)
      .setVisible(true);
    return true;
  }

  update(deltaMs: number, presentationMs: number, reducedFlash: boolean): void {
    const dt = Math.max(0, Math.min(100, deltaMs));
    const dtSec = dt / 1000;
    for (let slot = 0; slot < MAX_STARS; slot++) {
      if (this.starActive[slot] === 0) continue;
      const age = (this.starAge[slot] ?? 0) + dt;
      this.starAge[slot] = age;
      const q = clamp01(age / 90);
      if (q >= 1) {
        this.starActive[slot] = 0;
        this.starContainers[slot]!.setVisible(false);
        continue;
      }
      const alpha = 1 - q;
      this.starContainers[slot]!.setScale(1 - q * 0.8)
        .setRotation(this.starRotation[slot]! + q * 0.35)
        .setAlpha(alpha * (this.starReduced[slot] !== 0 ? 0.7 : 1));
    }
    for (let slot = 0; slot < MAX_CORES; slot++) {
      if (this.coreActive[slot] === 0) continue;
      const age = (this.coreAge[slot] ?? 0) + dt;
      this.coreAge[slot] = age;
      const q = clamp01(age / this.coreLife[slot]!);
      if (q >= 1) {
        this.coreActive[slot] = 0;
        this.cores[slot]!.setVisible(false);
        continue;
      }
      this.cores[slot]!.setScale(1 + q * 0.8).setAlpha(
        (1 - q) * (this.coreReduced[slot] !== 0 ? 0.47 : 0.85),
      );
    }
    for (let slot = 0; slot < MAX_SLIVERS; slot++) {
      if (this.sliverActive[slot] === 0) continue;
      const age = (this.sliverAge[slot] ?? 0) + dt;
      this.sliverAge[slot] = age;
      const q = clamp01(age / this.sliverLife[slot]!);
      const sliver = this.slivers[slot]!;
      if (q >= 1) {
        this.sliverActive[slot] = 0;
        sliver.setVisible(false);
        continue;
      }
      sliver.x += this.sliverVx[slot]! * dtSec;
      sliver.y += this.sliverVy[slot]! * dtSec;
      sliver.rotation += this.sliverSpin[slot]! * dtSec;
      sliver.setAlpha((1 - q) * (this.sliverReduced[slot] !== 0 ? 0.52 : 0.95));
    }
    for (let slot = 0; slot < MAX_SHIMMERS; slot++) {
      if (this.shimmerActive[slot] === 0) continue;
      const elapsed = presentationMs - this.shimmerLastAt[slot]!;
      if (elapsed >= 300) {
        const shimmer = this.shimmers[slot]!;
        this.spark(
          shimmer.x,
          shimmer.y,
          this.shimmerDirX[slot]!,
          this.shimmerDirY[slot]!,
          this.shimmerColor[slot]!,
          false,
          reducedFlash,
          1.15,
        );
        this.releaseShimmer(slot);
        continue;
      }
      const targetId = this.shimmerTargets[slot]!;
      if (this.resolveTarget(targetId, this.targetPoint))
        this.shimmers[slot]!.setPosition(this.targetPoint.x, this.targetPoint.y);
      const alpha = reducedFlash
        ? 0.5
        : 0.5 + Math.sin((presentationMs / 1000) * Math.PI * 4) * 0.15;
      this.shimmers[slot]!.setAlpha(alpha);
      if (presentationMs - this.shimmerDripAt[slot]! >= 500) {
        this.shimmerDripAt[slot] = presentationMs;
        this.spawnDrip(slot, reducedFlash);
      }
    }
  }

  targetGone(targetId: string): void {
    this.histories.delete(targetId);
    const shimmer = this.shimmerByTarget.get(targetId);
    if (shimmer !== undefined) this.releaseShimmer(shimmer);
  }

  clear(): void {
    this.histories.clear();
    this.shimmerByTarget.clear();
    this.starActive.fill(0);
    this.coreActive.fill(0);
    this.sliverActive.fill(0);
    this.shimmerActive.fill(0);
    for (const object of this.starContainers) object.setVisible(false);
    for (const object of this.cores) object.setVisible(false);
    for (const object of this.slivers) object.setVisible(false);
    for (const object of this.shimmers) object.setVisible(false);
  }

  destroy(): void {
    this.clear();
    for (const object of this.starContainers) if (object.active) object.destroy();
    for (const object of this.cores) if (object.active) object.destroy();
    for (const object of this.slivers) if (object.active) object.destroy();
    for (const object of this.shimmers) if (object.active) object.destroy();
  }

  private acquireShimmer(targetId: string): number {
    let slot = -1;
    for (let i = 0; i < MAX_SHIMMERS; i++) {
      if (this.shimmerActive[i] === 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) slot = this.shimmerCursor++ % MAX_SHIMMERS;
    if (this.shimmerActive[slot] !== 0) this.releaseShimmer(slot);
    this.shimmerActive[slot] = 1;
    this.shimmerTargets[slot] = targetId;
    this.shimmerByTarget.set(targetId, slot);
    this.shimmerDripAt[slot] = -1e9;
    this.shimmers[slot]!.setVisible(true);
    return slot;
  }

  private releaseShimmer(slot: number): void {
    const targetId = this.shimmerTargets[slot]!;
    if (this.shimmerByTarget.get(targetId) === slot) this.shimmerByTarget.delete(targetId);
    this.shimmerTargets[slot] = "";
    this.shimmerActive[slot] = 0;
    this.shimmers[slot]!.setVisible(false);
  }

  private spawnDrip(shimmerSlot: number, reducedFlash: boolean): void {
    const slot = this.sliverCursor++ % MAX_SLIVERS;
    const shimmer = this.shimmers[shimmerSlot]!;
    const dirX = this.shimmerDirX[shimmerSlot]!;
    const dirY = this.shimmerDirY[shimmerSlot]!;
    const angle = Math.atan2(dirY, dirX);
    this.sliverActive[slot] = 1;
    this.sliverAge[slot] = 0;
    this.sliverLife[slot] = 280;
    this.sliverVx[slot] = dirX * 45;
    this.sliverVy[slot] = dirY * 45 + 16;
    this.sliverSpin[slot] = 1.2;
    this.sliverReduced[slot] = Number(reducedFlash);
    this.slivers[slot]!.setPosition(shimmer.x, shimmer.y)
      .setSize(8, 2)
      .setRotation(angle)
      .setFillStyle(this.shimmerColor[shimmerSlot]!, reducedFlash ? 0.45 : 0.8)
      .setVisible(true);
  }
}
