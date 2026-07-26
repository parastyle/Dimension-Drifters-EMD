import {
  INTERP_EXTRAP_MAX_MS,
  INTERP_SNAP_PLAYER,
  MOVEMENT_CORRECTION_SMOOTH_MAX_MS,
  MovementCorrectionBand,
  type MoveStance,
  movementCorrectionBand,
  type PlayerState,
  SLIDE_PHASE_OFF,
  type SlidePhase,
  SNAPSHOT_DEPTH,
  STANCE_NONE,
  TICK_MS,
} from "@dd/shared";
import type { RigAnim } from "./rig-core.js";

export interface PresentationFrame {
  /** Render-frame identity. Every consumer of an actor sees this exact value. */
  readonly frame: number;
  /** One freeze-aware, monotonic presentation clock for gait, springs, mechanisms, and root sampling. */
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly deltaSeconds: number;
  /** Phaser's monotonic scene clock, sampled once for remote timeline conversion. */
  readonly wallNowMs: number;
  readonly wallDeltaMs: number;
  readonly cut: boolean;
}

interface MutablePresentationFrame {
  frame: number;
  nowMs: number;
  deltaMs: number;
  deltaSeconds: number;
  wallNowMs: number;
  wallDeltaMs: number;
  cut: boolean;
}

/** The sole frame clock. It can pause for hit-stop but can never run backward or fork by subsystem. */
export class PresentationFrameClock {
  private readonly value: MutablePresentationFrame = {
    frame: 0,
    nowMs: 0,
    deltaMs: 0,
    deltaSeconds: 0,
    wallNowMs: 0,
    wallDeltaMs: 0,
    cut: true,
  };
  private lastWallNowMs = -1;

  advance(wallNowMs: number, reportedDeltaMs: number, running: boolean): PresentationFrame {
    const safeWallNow = Math.max(this.lastWallNowMs, Number.isFinite(wallNowMs) ? wallNowMs : 0);
    const wallDelta = this.lastWallNowMs < 0 ? reportedDeltaMs : safeWallNow - this.lastWallNowMs;
    const rawDelta = Number.isFinite(reportedDeltaMs) ? Math.max(0, reportedDeltaMs) : wallDelta;
    const cut = this.lastWallNowMs < 0 || wallDelta < 0 || wallDelta > 100;
    const deltaMs = running ? rawDelta : 0;
    this.lastWallNowMs = safeWallNow;
    this.value.frame++;
    this.value.nowMs += deltaMs;
    this.value.deltaMs = deltaMs;
    this.value.deltaSeconds = deltaMs / 1000;
    this.value.wallNowMs = safeWallNow;
    this.value.wallDeltaMs = Math.max(0, wallDelta);
    this.value.cut = cut;
    return this.value;
  }

  reset(): void {
    this.lastWallNowMs = -1;
    this.value.frame = 0;
    this.value.nowMs = 0;
    this.value.deltaMs = 0;
    this.value.deltaSeconds = 0;
    this.value.wallNowMs = 0;
    this.value.wallDeltaMs = 0;
    this.value.cut = true;
  }
}

/**
 * Final root-only guard. Predictor/authority debt may move the presentation target faster than the actor's
 * declared locomotion plus recoil channels; retain that debt in root space instead of differentiating it
 * into pose. Teleports still cut immediately.
 */
export function limitPresentedRootStep(
  previousX: number,
  previousY: number,
  targetX: number,
  targetY: number,
  elapsedMs: number,
  declaredSpeed: number,
  snapDistance: number,
): Readonly<{ x: number; y: number }> {
  const dx = targetX - previousX;
  const dy = targetY - previousY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1e-6 || distance >= snapDistance) return { x: targetX, y: targetY };
  const maxStep = Math.max(2, (Math.max(0, declaredSpeed) * Math.max(0, elapsedMs)) / 1000 + 2);
  if (distance <= maxStep) return { x: targetX, y: targetY };
  const scale = maxStep / distance;
  return { x: previousX + dx * scale, y: previousY + dy * scale };
}

export interface PresentedUltimateState {
  archetype: number;
  phase: number;
  startTick: number;
  resolveTick: number;
  endTick: number;
}

/**
 * One coherent actor sample per render frame. Root position and every pose channel are captured together;
 * root correction is intentionally absent from `moveX/moveY/speed`.
 */
export interface PresentedActorState extends RigAnim {
  frame: PresentationFrame;
  /** Simulation row represented by this render snapshot (current self tick or delayed remote cursor). */
  tick: number;
  actorId: PlayerState["id"];
  weaponId: PlayerState["weapon"];
  weaponAffix: PlayerState["weaponAffix"];
  rootX: number;
  rootY: number;
  height: number;
  hp: number;
  alive: boolean;
  revivedSeq: number;
  juggledSeq: number;
  poundSeq: number;
  attackSeq: number;
  attackTick: number;
  attackHeld: boolean;
  charges: number;
  maxCharges: number;
  dualFireHeld: boolean;
  weaponChargeActive: boolean;
  teleportSeq: number;
  ultimate: PresentedUltimateState;
}

export function createPresentedActorState(frame: PresentationFrame): PresentedActorState {
  return {
    frame,
    tick: 0,
    actorId: "",
    weaponId: "",
    weaponAffix: "",
    rootX: 0,
    rootY: 0,
    height: 0,
    hp: 0,
    alive: true,
    revivedSeq: 0,
    juggledSeq: 0,
    poundSeq: 0,
    attackSeq: 0,
    attackTick: 0,
    attackHeld: false,
    charges: 0,
    maxCharges: 0,
    dualFireHeld: false,
    weaponChargeActive: false,
    teleportSeq: 0,
    ultimate: { archetype: 0, phase: 0, startTick: 0, resolveTick: 0, endTick: 0 },
    moveX: 0,
    moveY: 0,
    speed: 0,
    aimX: 0,
    aimY: 0,
    aimDir: 0,
    isSelf: false,
    recoilX: 0,
    recoilY: 0,
    jumpVh: 0,
    moveStance: STANCE_NONE,
    slidePhase: SLIDE_PHASE_OFF,
    slideTick: 0,
    fireHeld: false,
  };
}

interface ActorPatch {
  t: number;
  actorId: PlayerState["id"];
  weaponId: PlayerState["weapon"];
  weaponAffix: PlayerState["weaponAffix"];
  x: number;
  y: number;
  height: number;
  hp: number;
  vh: number;
  moveX: number;
  moveY: number;
  speed: number;
  recoilX: number;
  recoilY: number;
  aimDir: number;
  moveStance: MoveStance;
  slidePhase: SlidePhase;
  slideTick: number;
  alive: boolean;
  revivedSeq: number;
  juggledSeq: number;
  poundSeq: number;
  attackSeq: number;
  attackTick: number;
  attackHeld: boolean;
  charges: number;
  maxCharges: number;
  dualFireHeld: boolean;
  weaponChargeActive: boolean;
  teleportSeq: number;
  fireHeld: boolean;
  ultimate: PresentedUltimateState;
}

function capturePatch(t: number, player: PlayerState): ActorPatch {
  const speed = Math.hypot(player.mvx, player.mvy);
  return {
    t,
    actorId: player.id,
    weaponId: player.weapon,
    weaponAffix: player.weaponAffix,
    x: player.x,
    y: player.y,
    height: player.height,
    hp: player.hp,
    vh: player.vh,
    moveX: speed > 0.001 ? player.mvx / speed : 0,
    moveY: speed > 0.001 ? player.mvy / speed : 0,
    speed,
    recoilX: player.vx,
    recoilY: player.vy,
    aimDir: player.aimDir,
    moveStance: player.moveStance as MoveStance,
    slidePhase: player.slidePhase as SlidePhase,
    slideTick: player.slidePhaseTick,
    alive: player.alive,
    revivedSeq: player.revivedSeq,
    juggledSeq: player.juggledSeq,
    poundSeq: player.poundSeq,
    attackSeq: player.attackSeq,
    attackTick: player.attackTick,
    attackHeld: player.attackHeld,
    charges: player.charges,
    maxCharges: player.maxCharges,
    dualFireHeld: player.dualWield?.fireInputHeld === true,
    weaponChargeActive: player.weaponChargeActive,
    teleportSeq: player.teleportSeq,
    fireHeld: player.attackHeld || player.weaponChargeActive,
    ultimate: {
      archetype: player.ultimate.archetype,
      phase: player.ultimate.phase,
      startTick: player.ultimate.startTick,
      resolveTick: player.ultimate.resolveTick,
      endTick: player.ultimate.endTick,
    },
  };
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixAngle(a: number, b: number, t: number): number {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

/** Full player-presentation ring: no root/newest-pose split is possible. */
export class PresentedActorBuffer {
  private readonly values: Array<ActorPatch | undefined> = new Array(SNAPSHOT_DEPTH);
  private head = 0;
  private size = 0;

  private index(logicalIndex: number): number {
    return (this.head + logicalIndex) % SNAPSHOT_DEPTH;
  }

  push(t: number, player: PlayerState): void {
    if (this.size > 0 && t <= (this.values[this.index(this.size - 1)]?.t ?? t)) return;
    let index: number;
    if (this.size < SNAPSHOT_DEPTH) {
      index = this.index(this.size++);
    } else {
      index = this.head;
      this.head = (this.head + 1) % SNAPSHOT_DEPTH;
    }
    this.values[index] = capturePatch(t, player);
  }

  reset(t: number, player: PlayerState): void {
    this.head = 0;
    this.size = 1;
    this.values[0] = capturePatch(t, player);
  }

  sampleInto(
    t: number,
    frame: PresentationFrame,
    out: PresentedActorState,
  ): PresentedActorState | null {
    if (this.size === 0) return null;
    const first = this.values[this.head];
    const last = this.values[this.index(this.size - 1)];
    if (!first || !last) return null;
    out.tick = Math.max(0, Math.floor(t / TICK_MS));
    if (t <= first.t) return this.write(first, first, 0, frame, out);
    if (t >= last.t) {
      if (this.size < 2) return this.write(last, last, 0, frame, out);
      const previous = this.values[this.index(this.size - 2)];
      if (!previous) return this.write(last, last, 0, frame, out);
      const span = last.t - previous.t;
      const distance = Math.hypot(last.x - previous.x, last.y - previous.y);
      if (
        span <= 0 ||
        movementCorrectionBand(distance, INTERP_SNAP_PLAYER) !== MovementCorrectionBand.Smooth
      )
        return this.write(last, last, 0, frame, out);
      const ahead = Math.min(t - last.t, INTERP_EXTRAP_MAX_MS);
      return this.write(last, last, 0, frame, out, {
        x: last.x + ((last.x - previous.x) * ahead) / span,
        y: last.y + ((last.y - previous.y) * ahead) / span,
      });
    }
    for (let i = this.size - 1; i > 0; i--) {
      const b = this.values[this.index(i)];
      const a = this.values[this.index(i - 1)];
      if (!a || !b) continue;
      if (t < a.t || t > b.t) continue;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (movementCorrectionBand(distance, INTERP_SNAP_PLAYER) !== MovementCorrectionBand.Smooth)
        return this.write(b, b, 0, frame, out);
      const span = b.t - a.t;
      const smoothSpan = Math.min(span, MOVEMENT_CORRECTION_SMOOTH_MAX_MS);
      const smoothStart = b.t - smoothSpan;
      if (t <= smoothStart) return this.write(a, a, 0, frame, out);
      return this.write(a, b, (t - smoothStart) / smoothSpan, frame, out);
    }
    return this.write(last, last, 0, frame, out);
  }

  private write(
    a: ActorPatch,
    b: ActorPatch,
    blend: number,
    frame: PresentationFrame,
    out: PresentedActorState,
    rootOverride?: Readonly<{ x: number; y: number }>,
  ): PresentedActorState {
    const k = Math.max(0, Math.min(1, blend));
    out.frame = frame;
    out.rootX = rootOverride?.x ?? mix(a.x, b.x, k);
    out.rootY = rootOverride?.y ?? mix(a.y, b.y, k);
    out.height = mix(a.height, b.height, k);
    out.jumpVh = mix(a.vh, b.vh, k);
    const moveX = mix(a.moveX, b.moveX, k);
    const moveY = mix(a.moveY, b.moveY, k);
    const moveLength = Math.hypot(moveX, moveY);
    out.moveX = moveLength > 0.001 ? moveX / moveLength : 0;
    out.moveY = moveLength > 0.001 ? moveY / moveLength : 0;
    out.speed = mix(a.speed, b.speed, k);
    out.recoilX = mix(a.recoilX, b.recoilX, k);
    out.recoilY = mix(a.recoilY, b.recoilY, k);
    out.aimDir = mixAngle(a.aimDir, b.aimDir, k);
    // Discrete edges become visible only when their own snapshot time reaches the render cursor.
    const discrete = k >= 1 ? b : a;
    out.actorId = discrete.actorId;
    out.weaponId = discrete.weaponId;
    out.weaponAffix = discrete.weaponAffix;
    out.hp = discrete.hp;
    out.moveStance = discrete.moveStance;
    out.slidePhase = discrete.slidePhase;
    out.slideTick = discrete.slideTick;
    out.alive = discrete.alive;
    out.revivedSeq = discrete.revivedSeq;
    out.juggledSeq = discrete.juggledSeq;
    out.poundSeq = discrete.poundSeq;
    out.attackSeq = discrete.attackSeq;
    out.attackTick = discrete.attackTick;
    out.attackHeld = discrete.attackHeld;
    out.charges = discrete.charges;
    out.maxCharges = discrete.maxCharges;
    out.dualFireHeld = discrete.dualFireHeld;
    out.weaponChargeActive = discrete.weaponChargeActive;
    out.teleportSeq = discrete.teleportSeq;
    out.fireHeld = discrete.fireHeld;
    out.ultimate.archetype = discrete.ultimate.archetype;
    out.ultimate.phase = discrete.ultimate.phase;
    out.ultimate.startTick = discrete.ultimate.startTick;
    out.ultimate.resolveTick = discrete.ultimate.resolveTick;
    out.ultimate.endTick = discrete.ultimate.endTick;
    return out;
  }
}
