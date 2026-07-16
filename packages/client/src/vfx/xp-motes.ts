import { INTERP_DELAY_MS, MAX_XP_ECHOES, TICK_MS, type XpEchoState } from "@dd/shared";
import Phaser from "phaser";

const LEADER_DEPTH = 99982;
const TRAIL_DEPTH = 99981;
const RECEIPT_DEPTH = 99993;
const PAINTED_FRAME_PX = 96;
const MAX_SATELLITES = MAX_XP_ECHOES * 2;
const MAX_RECEIPTS = 16;

const BODY_DIAMETER = [12, 15, 20, 28, 36] as const;
const POP_RADIUS_MIN = [18, 22, 28, 36, 44] as const;
const POP_RADIUS_MAX = [28, 36, 44, 54, 68] as const;
const RING_DIAMETER = [34, 34, 46, 46, 60] as const;

export interface XpMotePoint {
  x: number;
  y: number;
}

export interface XpMoteReceipt {
  value: number;
  collectorId: string;
  x: number;
  y: number;
  tier: number;
}

export interface XpMoteCallbacks {
  /** Resolve the collector's current rendered chest socket into caller-owned scratch. */
  target(collectorId: string, out: XpMotePoint): boolean;
  /** Project a resting authoritative world point (belt depth projection is client-only). */
  project(x: number, y: number, out: XpMotePoint): void;
  /** One authoritative delivered edge; ArenaScene owns squad HUD/audio/label aggregation. */
  receipt(event: XpMoteReceipt): void;
}

type EchoRows = Iterable<[string, XpEchoState]> & { size: number };

export function xpEchoTier(value: number): number {
  if (value <= 1) return 0;
  if (value <= 4) return 1;
  if (value <= 15) return 2;
  if (value <= 35) return 3;
  return 4;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Fixed-pool renderer for the synchronized XP Echo map. Phaser Tweens never own an Echo: birth, rest,
 * curved flight, trails, and receipts all sample the server tick descriptor plus deterministic seed.
 */
export class XpMoteRenderer {
  private readonly leaders: Phaser.GameObjects.Image[] = [];
  private readonly satellites: Phaser.GameObjects.Image[] = [];
  private readonly rings: Phaser.GameObjects.Arc[] = [];
  private readonly halos: Phaser.GameObjects.Ellipse[] = [];
  private readonly trails: Phaser.GameObjects.Graphics;
  private readonly slotById = new Map<string, number>();
  private readonly ids = new Array<string>(MAX_XP_ECHOES).fill("");
  private readonly collectors = new Array<string>(MAX_XP_ECHOES).fill("");
  private readonly active = new Uint8Array(MAX_XP_ECHOES);
  private readonly delivered = new Uint8Array(MAX_XP_ECHOES);
  private readonly seen = new Uint32Array(MAX_XP_ECHOES);
  private readonly launchSeen = new Float64Array(MAX_XP_ECHOES);
  private readonly c1x = new Float32Array(MAX_XP_ECHOES);
  private readonly c1y = new Float32Array(MAX_XP_ECHOES);
  private readonly lastX = new Float32Array(MAX_XP_ECHOES);
  private readonly lastY = new Float32Array(MAX_XP_ECHOES);
  private readonly free = new Uint8Array(MAX_XP_ECHOES);
  private freeCount = MAX_XP_ECHOES;
  private generation = 0;

  private readonly receiptAge = new Float32Array(MAX_RECEIPTS);
  private readonly receiptTier = new Uint8Array(MAX_RECEIPTS);
  private readonly receiptActive = new Uint8Array(MAX_RECEIPTS);
  private readonly receiptX = new Float32Array(MAX_RECEIPTS);
  private readonly receiptY = new Float32Array(MAX_RECEIPTS);
  private readonly receiptCollectors = new Array<string>(MAX_RECEIPTS).fill("");
  private receiptCursor = 0;

  private readonly origin = { x: 0, y: 0 };
  private readonly targetPoint = { x: 0, y: 0 };
  private receiptEvent: XpMoteReceipt = {
    value: 0,
    collectorId: "",
    x: 0,
    y: 0,
    tier: 0,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: XpMoteCallbacks,
  ) {
    for (let i = 0; i < MAX_XP_ECHOES; i++) {
      this.free[i] = MAX_XP_ECHOES - 1 - i;
      this.launchSeen[i] = -1;
      this.leaders.push(
        scene.add
          .image(0, 0, "ptcl:arcane-mote", 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(LEADER_DEPTH)
          .setVisible(false),
      );
    }
    for (let i = 0; i < MAX_SATELLITES; i++) {
      this.satellites.push(
        scene.add
          .image(0, 0, "ptcl:arcane-mote", 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(LEADER_DEPTH - 1)
          .setVisible(false),
      );
    }
    this.trails = scene.add.graphics().setDepth(TRAIL_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < MAX_RECEIPTS; i++) {
      this.rings.push(
        scene.add
          .circle(0, 0, 6)
          .setStrokeStyle(2, 0xcffaff, 1)
          .setFillStyle(0x8eefff, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(RECEIPT_DEPTH)
          .setVisible(false),
      );
      this.halos.push(
        scene.add
          .ellipse(0, 0, 34, 42, 0x9cf7ff, 0.24)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(RECEIPT_DEPTH - 2)
          .setVisible(false),
      );
    }
  }

  /** Estimate the undelayed server clock; contact itself remains gated by the delivered patch. */
  static renderTick(serverTimelineMs: number): number {
    return (serverTimelineMs + INTERP_DELAY_MS) / TICK_MS;
  }

  update(rows: EchoRows, renderTick: number, deltaMs: number, reducedMotion: boolean): void {
    this.generation = (this.generation + 1) >>> 0;
    if (this.generation === 0) {
      this.seen.fill(0);
      this.generation = 1;
    }
    this.trails.clear();
    let flightRank = 0;
    for (const [id, echo] of rows) {
      const slot = this.slotById.get(id) ?? this.acquire(id);
      if (slot < 0) continue;
      this.seen[slot] = this.generation;
      if (echo.delivered) {
        if (this.delivered[slot] === 0) this.fireReceipt(slot, echo);
        this.hideEcho(slot);
        continue;
      }
      this.delivered[slot] = 0;
      const isFlight = echo.collectorId !== "";
      this.renderEcho(
        slot,
        echo,
        renderTick,
        reducedMotion,
        rows.size,
        isFlight ? flightRank++ : -1,
      );
    }
    for (let slot = 0; slot < MAX_XP_ECHOES; slot++) {
      if (this.active[slot] !== 0 && this.seen[slot] !== this.generation) this.release(slot);
    }
    this.updateReceipts(deltaMs);
  }

  clear(): void {
    for (let slot = 0; slot < MAX_XP_ECHOES; slot++) {
      if (this.active[slot] !== 0) this.release(slot);
    }
    for (let i = 0; i < MAX_RECEIPTS; i++) {
      this.receiptActive[i] = 0;
      this.rings[i]?.setVisible(false);
      this.halos[i]?.setVisible(false);
    }
    this.trails.clear();
  }

  destroy(): void {
    this.slotById.clear();
    for (const image of this.leaders) if (image.active) image.destroy();
    for (const image of this.satellites) if (image.active) image.destroy();
    for (const ring of this.rings) if (ring.active) ring.destroy();
    for (const halo of this.halos) if (halo.active) halo.destroy();
    if (this.trails.active) this.trails.destroy();
  }

  private acquire(id: string): number {
    if (this.freeCount <= 0) return -1;
    const slot = this.free[--this.freeCount] ?? -1;
    if (slot < 0) return -1;
    this.active[slot] = 1;
    this.delivered[slot] = 0;
    this.ids[slot] = id;
    this.collectors[slot] = "";
    this.launchSeen[slot] = -1;
    this.lastX[slot] = Number.NaN;
    this.lastY[slot] = Number.NaN;
    this.slotById.set(id, slot);
    return slot;
  }

  private release(slot: number): void {
    const id = this.ids[slot] ?? "";
    if (id) this.slotById.delete(id);
    this.ids[slot] = "";
    this.collectors[slot] = "";
    this.active[slot] = 0;
    this.delivered[slot] = 0;
    this.hideEcho(slot);
    this.free[this.freeCount++] = slot;
  }

  private hideEcho(slot: number): void {
    this.leaders[slot]?.setVisible(false);
    this.satellites[slot * 2]?.setVisible(false);
    this.satellites[slot * 2 + 1]?.setVisible(false);
  }

  private renderEcho(
    slot: number,
    echo: XpEchoState,
    renderTick: number,
    reducedMotion: boolean,
    liveCount: number,
    flightRank: number,
  ): void {
    const tier = xpEchoTier(echo.value);
    const leader = this.leaders[slot];
    if (!leader) return;
    this.callbacks.project(echo.x, echo.y, this.origin);
    let x = this.origin.x;
    let y = this.origin.y;
    let rotation = 0;
    let stretch = 1;
    let cross = 1;
    let phaseScale = 1;
    const ageMs = Math.max(0, (renderTick - echo.bornTick) * TICK_MS);

    if (!echo.collectorId) {
      const angle = ((echo.seed % 4096) / 4096) * Math.PI * 2;
      const radius =
        (POP_RADIUS_MIN[tier] ?? 18) +
        (((echo.seed >>> 4) & 255) / 255) *
          ((POP_RADIUS_MAX[tier] ?? 28) - (POP_RADIUS_MIN[tier] ?? 18));
      const scatterRadius = reducedMotion ? Math.min(6, radius) : radius;
      if (ageMs < 110) {
        const u = clamp01(ageMs / 110);
        const r = scatterRadius * (1 - (1 - u) ** 3);
        x += Math.cos(angle) * r;
        y += Math.sin(angle) * r - (reducedMotion ? 2 : 8 + tier * 2) * 4 * u * (1 - u);
        phaseScale = ageMs < 65 ? 0.45 + (1.18 - 0.45) * (ageMs / 65) : 1.18;
      } else if (ageMs < 260) {
        const v = clamp01((ageMs - 110) / 150);
        const r = scatterRadius * (1 - v) ** 2 * Math.cos(Math.PI * 1.25 * v);
        x += Math.cos(angle) * r;
        y += Math.sin(angle) * r;
        phaseScale = 1.18 + (1 - 1.18) * smoothstep(v);
      } else {
        const phase =
          renderTick * TICK_MS * 0.001 * Math.PI * 3.4 + (echo.seed / 65536) * Math.PI * 2;
        y += Math.sin(phase) * 2.5;
        phaseScale = 1 + Math.sin(phase) * 0.035;
        rotation = Math.sin(phase * 0.7) * 0.12;
      }
    } else if (this.callbacks.target(echo.collectorId, this.targetPoint)) {
      if (this.launchSeen[slot] !== echo.launchTick || this.collectors[slot] !== echo.collectorId) {
        this.captureLaunch(slot, echo, this.targetPoint.x, this.targetPoint.y);
      }
      const span = Math.max(1, echo.collectTick - echo.launchTick);
      // Never visibly contact before the authoritative delivered edge. A late patch holds just off the chest.
      const t = Math.min(0.96, clamp01((renderTick - echo.launchTick) / span));
      if (reducedMotion) {
        const glide = smoothstep((t - 0.55) / 0.45);
        x += (this.targetPoint.x - x) * glide;
        y += (this.targetPoint.y - y) * glide;
      } else {
        const q = t ** 2.2;
        const dx = this.targetPoint.x - this.origin.x;
        const dy = this.targetPoint.y - this.origin.y;
        const distance = Math.hypot(dx, dy);
        const inv = distance > 1e-6 ? 1 / distance : 0;
        const fx = dx * inv;
        const fy = dy * inv;
        const nx = -fy;
        const ny = fx;
        const sign = (echo.seed & 1) === 0 ? -1 : 1;
        const c2x =
          this.targetPoint.x -
          fx * Math.min(84, distance * 0.3) -
          nx * sign * Math.min(28, distance * 0.08);
        const c2y =
          this.targetPoint.y -
          fy * Math.min(84, distance * 0.3) -
          ny * sign * Math.min(28, distance * 0.08);
        const a = 1 - q;
        const bx =
          a ** 3 * this.origin.x +
          3 * a * a * q * (this.c1x[slot] ?? 0) +
          3 * a * q * q * c2x +
          q ** 3 * this.targetPoint.x;
        const by =
          a ** 3 * this.origin.y +
          3 * a * a * q * (this.c1y[slot] ?? 0) +
          3 * a * q * q * c2y +
          q ** 3 * this.targetPoint.y;
        const w = smoothstep((t - 0.68) / 0.32);
        const angle = sign * Math.PI * 0.7 * w;
        const rx = bx - this.targetPoint.x;
        const ry = by - this.targetPoint.y;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        x = this.targetPoint.x + rx * c - ry * s;
        y = this.targetPoint.y + rx * s + ry * c;
        const px = this.lastX[slot] ?? Number.NaN;
        const py = this.lastY[slot] ?? Number.NaN;
        if (Number.isFinite(px) && Number.isFinite(py)) rotation = Math.atan2(y - py, x - px);
        stretch = 1 + 0.28 * q;
        cross = 1 - 0.16 * q;
        if (flightRank >= 0 && flightRank < 16) this.drawTrail(x, y, px, py, tier, flightRank < 8);
      }
    }

    const diameter = BODY_DIAMETER[tier] ?? 12;
    const baseScale = diameter / PAINTED_FRAME_PX;
    const texture = tier >= 2 ? "ptcl:arcane-orb" : "ptcl:arcane-mote";
    const frame = echo.seed % 10;
    leader
      .setTexture(texture, frame)
      .setPosition(x, y)
      .setRotation(rotation)
      .setScale(baseScale * phaseScale * stretch, baseScale * phaseScale * cross)
      .setAlpha(0.9 + tier * 0.02)
      .setVisible(true);
    this.lastX[slot] = x;
    this.lastY[slot] = y;
    this.renderSatellites(slot, echo, tier, x, y, rotation, baseScale, liveCount, reducedMotion);
  }

  private captureLaunch(slot: number, echo: XpEchoState, targetX: number, targetY: number): void {
    const dx = targetX - this.origin.x;
    const dy = targetY - this.origin.y;
    const distance = Math.hypot(dx, dy);
    const inv = distance > 1e-6 ? 1 / distance : 0;
    const fx = dx * inv;
    const fy = dy * inv;
    const nx = -fy;
    const ny = fx;
    const sign = (echo.seed & 1) === 0 ? -1 : 1;
    this.c1x[slot] =
      this.origin.x -
      fx * Math.min(16, distance * 0.06) +
      nx * sign * Math.min(72, distance * 0.24);
    this.c1y[slot] =
      this.origin.y -
      fy * Math.min(16, distance * 0.06) +
      ny * sign * Math.min(72, distance * 0.24);
    this.launchSeen[slot] = echo.launchTick;
    this.collectors[slot] = echo.collectorId;
    this.lastX[slot] = this.origin.x;
    this.lastY[slot] = this.origin.y;
  }

  private renderSatellites(
    slot: number,
    echo: XpEchoState,
    tier: number,
    x: number,
    y: number,
    rotation: number,
    baseScale: number,
    liveCount: number,
    reducedMotion: boolean,
  ): void {
    let wanted = tier <= 0 ? 0 : tier <= 2 ? 1 : 2;
    if (reducedMotion) wanted = 0;
    else if (liveCount > 40 && tier < 3) wanted = 0;
    else if (liveCount > 24 && tier < 2) wanted = 0;
    for (let i = 0; i < 2; i++) {
      const image = this.satellites[slot * 2 + i];
      if (!image) continue;
      if (i >= wanted) {
        image.setVisible(false);
        continue;
      }
      const orbit = 7 + tier * 1.6 + i * 3;
      const angle = echo.collectorId
        ? rotation + Math.PI + (i === 0 ? -0.42 : 0.42)
        : ((echo.seed + i * 19001) / 65536) * Math.PI * 2 + this.scene.time.now * 0.002;
      image
        .setTexture("ptcl:arcane-mote", (echo.seed + i * 3 + 1) % 10)
        .setPosition(x + Math.cos(angle) * orbit, y + Math.sin(angle) * orbit)
        .setRotation(angle)
        .setScale(baseScale * (0.52 + i * 0.08))
        .setAlpha(0.72)
        .setVisible(true);
    }
  }

  private drawTrail(
    x: number,
    y: number,
    previousX: number,
    previousY: number,
    tier: number,
    twoSegments: boolean,
  ): void {
    if (!Number.isFinite(previousX) || !Number.isFinite(previousY)) return;
    const dx = x - previousX;
    const dy = y - previousY;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.5) return;
    const max = tier >= 4 ? 46 : tier >= 2 ? 34 : 24;
    const length = Math.min(max, Math.max(8, distance * 1.8));
    const inv = 1 / distance;
    const tx = x - dx * inv * length;
    const ty = y - dy * inv * length;
    this.trails.lineStyle(tier >= 3 ? 3 : 2, 0xa6f7ff, 0.42);
    this.trails.beginPath();
    this.trails.moveTo(x, y);
    this.trails.lineTo(tx, ty);
    this.trails.strokePath();
    if (!twoSegments) return;
    this.trails.lineStyle(1, 0xffffff, 0.24);
    this.trails.beginPath();
    this.trails.moveTo(x, y);
    this.trails.lineTo(x - dx * inv * length * 0.58, y - dy * inv * length * 0.58);
    this.trails.strokePath();
  }

  private fireReceipt(slot: number, echo: XpEchoState): void {
    this.delivered[slot] = 1;
    const tier = xpEchoTier(echo.value);
    if (!this.callbacks.target(echo.collectorId, this.targetPoint)) {
      this.targetPoint.x = this.lastX[slot] ?? 0;
      this.targetPoint.y = this.lastY[slot] ?? 0;
    }
    const receiptSlot = this.receiptCursor++ % MAX_RECEIPTS;
    this.receiptActive[receiptSlot] = 1;
    this.receiptAge[receiptSlot] = 0;
    this.receiptTier[receiptSlot] = tier;
    this.receiptX[receiptSlot] = this.targetPoint.x;
    this.receiptY[receiptSlot] = this.targetPoint.y;
    this.receiptCollectors[receiptSlot] = echo.collectorId;
    this.rings[receiptSlot]
      ?.setPosition(this.targetPoint.x, this.targetPoint.y)
      .setScale(1)
      .setVisible(true);
    this.halos[receiptSlot]
      ?.setPosition(this.targetPoint.x, this.targetPoint.y)
      .setScale(0.7)
      .setVisible(true);

    this.receiptEvent.value = echo.value;
    this.receiptEvent.collectorId = echo.collectorId;
    this.receiptEvent.x = this.targetPoint.x;
    this.receiptEvent.y = this.targetPoint.y;
    this.receiptEvent.tier = tier;
    this.callbacks.receipt(this.receiptEvent);
  }

  private updateReceipts(deltaMs: number): void {
    for (let i = 0; i < MAX_RECEIPTS; i++) {
      if (this.receiptActive[i] === 0) continue;
      const age = (this.receiptAge[i] ?? 0) + deltaMs;
      this.receiptAge[i] = age;
      const ring = this.rings[i];
      const halo = this.halos[i];
      if (!ring || !halo) continue;
      const collector = this.receiptCollectors[i] ?? "";
      if (collector && this.callbacks.target(collector, this.targetPoint)) {
        halo.setPosition(this.targetPoint.x, this.targetPoint.y);
      }
      const tier = this.receiptTier[i] ?? 0;
      const ringT = clamp01(age / 120);
      const diameter = RING_DIAMETER[tier] ?? RING_DIAMETER[0];
      ring
        .setPosition(this.receiptX[i] ?? 0, this.receiptY[i] ?? 0)
        .setScale(1 + (diameter / 12 - 1) * smoothstep(ringT))
        .setAlpha(1 - ringT);
      const haloT = clamp01(age / 90);
      halo.setScale(0.7 + haloT * 0.7).setAlpha((1 - haloT) * 0.34);
      if (age < 120) continue;
      this.receiptActive[i] = 0;
      ring.setVisible(false);
      halo.setVisible(false);
    }
  }
}
