import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  addImpulse,
  BELT_Y0,
  type BeltLevel,
  beltPlayableXBounds,
  beltSafeX,
  DEPTH_MAX,
  DIST_JUMP_AIRTIME,
  DIST_JUMP_COOLDOWN,
  DIST_JUMP_LANDING_SPEED_MULT,
  DIST_JUMP_MAX_STEER_RADIANS,
  DIST_JUMP_REACH,
  DIST_JUMP_SPEED,
  DIST_JUMP_STEER_RADIANS_PER_SECOND,
  DIST_JUMP_VERTICAL_VELOCITY,
  EMPTY_RELIC_STACKS,
  GROUND_EPSILON,
  INPUT_MSGS_PER_TICK,
  JUMP_BUFFER_SECONDS,
  MOVEMENT_CORRECTION_SMOOTH_MAX_MS,
  MovementCorrectionBand,
  type MovementCorrectionBandValue,
  type MoveStance,
  movementCorrectionBand,
  PLAYER_RADIUS,
  PlayerAttackMoveMode,
  POUND_GATHER_SECONDS,
  POUND_JUMP_COOLDOWN,
  POUND_MIN_HEIGHT,
  POUND_RECOVERY_SECONDS,
  POUND_SPEED,
  PRED_PENDING_MAX,
  type RelicStacks,
  ROLL_ATTACK_CANCEL_SECONDS,
  ROLL_DURATION_TICKS,
  ROLL_PARRY_LOCK_SECONDS,
  relicDodgeCooldown,
  relicJumpCount,
  relicMoveSpeed,
  relicRollSpeedAtTick,
  resolveBeltNavigation,
  SLIDE_PHASE_GROUND,
  SLIDE_PHASE_OFF,
  type SlidePhase,
  STANCE_CROUCH,
  STANCE_DASH,
  STANCE_NONE,
  STANCE_POUND,
  STANCE_SLIDE,
  safeSpawnPos,
  shortestAngleDelta,
  slideContactInvulnerable,
  stepImpulse,
  stepPlayerAttackMovement,
  stepVertical,
  TICK_MS,
} from "@dd/shared";

/** L10 SELF stall recovery is deliberately shorter than the shared remote/ordinary Smooth window.
 *  Eighty milliseconds is five 60 Hz frames: visibly graded, but too short to become a 140 ms chase. */
export const SELF_STALL_RECOVERY_MS = 80;

/**
 * §4 v0.107 CLIENT-SIDE PREDICTION for the local player (docs/NETCODE_DESIGN.md is the binding spec).
 *
 * PURE module — no Phaser, no Colyseus imports — so the whole reconciliation loop is unit-testable in
 * node against a mock server running the SAME shared steppers. ArenaScene owns the wiring: it mints one
 * sequence-numbered command per 50ms, sends it, feeds it to `tick()`, applies `reconcile()` on every
 * patch, and renders `renderPos()` each frame.
 *
 * Model (per the adversarially-reviewed design):
 * - HORIZONTAL is predicted + reconciled: each patch is tick-locked server truth for the tick that
 *   consumed `ackSeq`, so we REBASE (adopt x/y + steering mv + impulse v — all synced) and REPLAY the
 *   still-pending commands with exact 50ms steps. Player-player pushes/knockback arriving mid-window
 *   surface as a residual that GLIDES out through a decaying error offset. A stale replay resync always
 *   uses Smooth, regardless of size; only a `teleportSeq` bump (the server bumps it inside zeroMoveVel at
 *   every authored placement site) hard-snaps.
 * - VERTICAL is predicted LOCALLY and only ADOPTED on divergence: jumps are deterministic off the
 *   command stream (buffer/cooldown mirrored from the shared constants), so reconciliation rebases at
 *   the server's acked height/vh and replays every pending jump step. Only a residual beyond the height
 *   threshold hard-snaps (a denied jump / parry-launch we didn't predict).
 * - Prediction PAUSES (and hard-resyncs) while dead.
 */

/** One minted input command — the client-side twin of the server's InputCmd. */
export interface PredCmd {
  seq: number;
  dx: number;
  dy: number;
  jump: boolean;
  crouchHeld?: boolean;
  pound?: boolean;
  slide?: boolean;
  slideHeld?: boolean;
  /** Present on ArenaScene's real command; optional keeps the pure predictor usable in small tests. */
  aimX?: number;
  aimY?: number;
  fireHeld?: boolean;
}

/** The slice of the synced PlayerState the predictor needs each patch (kept structural so tests can
 *  feed plain objects and ArenaScene can pass the schema row directly). */
export interface ServerView {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
  height: number;
  vh: number;
  ackSeq: number;
  teleportSeq: number;
  moveStance?: MoveStance;
  stanceSeq?: number;
  momentumX?: number;
  momentumY?: number;
  slidePhase?: number;
  slidePhaseTick?: number;
  attackMoveMode?: number;
  /** B42 fields are optional only for compact legacy unit fixtures. Production schema 43 always supplies. */
  movementCorrectionSeq?: number;
  serverMotionEpoch?: number;
  serverMotionActive?: boolean;
  /** Runtime relic charge mirrored from the synced nested relic row. */
  airJumpsRemaining?: number;
  alive: boolean;
}

export type SelfCorrectionCause = "stall-resync" | "envelope-violation" | "teleport";

export interface SelfCorrectionEvent {
  magnitudePx: number;
  band: MovementCorrectionBandValue;
  cause: SelfCorrectionCause;
}

interface PredState {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
  momentumX: number;
  momentumY: number;
}

/** A pending command plus the local jump-control state immediately before its tick. The server does not
 * sync cooldown/buffer timers, so retaining this deterministic rebase point lets reconciliation replay
 * the exact buffered-jump phase over an authoritative height/vh without mistaking an un-acked hop for
 * divergence. */
interface PendingPredCmd extends PredCmd {
  /**
   * Frame-rate input slices that make up this 50ms command window. They are client-only replay data:
   * the B42 movement report carries the resulting pose on the existing wire.
   */
  inputSamples: PredInputSample[];
  jumpCdBefore: number;
  jumpBufBefore: number;
  airJumpsBefore: number;
  moveSpeedMultiplierBefore: number;
  continuousRecoilXBefore: number;
  continuousRecoilYBefore: number;
  beltLockXBefore: number;
  stanceBefore: MoveStance;
  crouchTBefore: number;
  crouchPrevHeldBefore: boolean;
  crouchAimXBefore: number;
  crouchAimYBefore: number;
  dashDirXBefore: number;
  dashDirYBefore: number;
  dashBaseDirXBefore: number;
  dashBaseDirYBefore: number;
  dashSpeedBefore: number;
  dashSteerBefore: number;
  distCdBefore: number;
  poundUsedBefore: boolean;
  poundGatherTBefore: number;
  recoveryTBefore: number;
  momentumXBefore: number;
  momentumYBefore: number;
  slidePhaseBefore: SlidePhase;
  slidePhaseTickBefore: number;
  slidePrevHeldBefore: boolean;
  rollCdBefore: number;
  slideParryLockTBefore: number;
  aimXBefore: number;
  aimYBefore: number;
}

interface PredInputSample {
  dx: number;
  dy: number;
  dt: number;
}

interface PredVerticalState {
  height: number;
  vh: number;
  jumpCd: number;
  jumpBuf: number;
  airJumpsRemaining: number;
}

interface PredStanceState {
  stance: MoveStance;
  crouchT: number;
  crouchPrevHeld: boolean;
  crouchAimX: number;
  crouchAimY: number;
  dashDirX: number;
  dashDirY: number;
  dashBaseDirX: number;
  dashBaseDirY: number;
  dashSpeed: number;
  dashSteer: number;
  distJumpCd: number;
  poundUsed: boolean;
  poundGatherT: number;
  recoveryT: number;
  slidePhase: SlidePhase;
  slidePhaseTick: number;
  slidePrevHeld: boolean;
  rollCd: number;
  slideParryLockT: number;
  aimX: number;
  aimY: number;
}

/** Allocation-free result reused by ArenaScene's frame sampler. */
export interface SpaceGestureResult {
  jump: boolean;
  pound: boolean;
  crouchHeld: boolean;
}

/** Shift and Ctrl are intentionally identical slide inputs; exported so the input treaty is unit-tested. */
export function slideHeldFromBindings(shiftDown: boolean, ctrlDown: boolean): boolean {
  return shiftDown || ctrlDown;
}

export function slidePressedFromBindings(shiftPressed: boolean, ctrlPressed: boolean): boolean {
  return shiftPressed || ctrlPressed;
}

/** Pure Space edge classifier: grounded keydown is the immediate distance jump; airborne keydown is pound. */
export class SpaceGestureClassifier {
  private consumedUntilRelease = false;
  private readonly result: SpaceGestureResult = { jump: false, pound: false, crouchHeld: false };

  reset(): void {
    this.consumedUntilRelease = false;
    this.result.jump = false;
    this.result.pound = false;
    this.result.crouchHeld = false;
  }

  sample(
    _nowMs: number,
    _isDown: boolean,
    justDown: boolean,
    justUp: boolean,
    airborne: boolean,
    enabled = true,
    _slideGround = false,
  ): SpaceGestureResult {
    this.result.jump = false;
    this.result.pound = false;
    if (!enabled) {
      this.reset();
      return this.result;
    }
    // Phaser can coalesce a short down→up between loaded render samples: the physical key is already up,
    // but `JustUp` may no longer be observable. Treat the stable released state as the same latch-clear edge
    // so a later real press is never suppressed forever. `justDown` wins below for a fresh same-sample tap.
    if ((justUp || (!_isDown && !justDown)) && this.consumedUntilRelease) {
      this.consumedUntilRelease = false;
    }
    if (justDown && !this.consumedUntilRelease) {
      this.consumedUntilRelease = true;
      if (airborne) this.result.pound = true;
      else this.result.jump = true;
    }
    this.result.crouchHeld = false;
    return this.result;
  }
}

export interface DistanceJumpIndicator {
  rawX: number;
  rawY: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  clamped: boolean;
}

/** Exact client twin of J1's landing-validation order. The caller supplies a retained `out` record. */
export function writeDistanceJumpIndicator(
  out: DistanceJumpIndicator,
  x: number,
  y: number,
  dx: number,
  dy: number,
  fallbackX: number,
  fallbackY: number,
  map?: ArenaMap,
  belt?: BeltLevel,
): boolean {
  let len = Math.hypot(dx, dy);
  if (len <= 1e-4) {
    dx = fallbackX;
    dy = fallbackY;
    len = Math.hypot(dx, dy);
  }
  if (len <= 1e-4) return false;
  dx /= len;
  dy /= len;
  out.dirX = dx;
  out.dirY = dy;
  out.rawX = x + dx * DIST_JUMP_REACH;
  out.rawY = y + dy * DIST_JUMP_REACH;
  const beltX = belt ? beltPlayableXBounds(belt) : undefined;
  const boundedX = Math.max(
    (beltX?.minX ?? 0) + PLAYER_RADIUS,
    Math.min((beltX?.maxX ?? ARENA_WIDTH) - PLAYER_RADIUS, out.rawX),
  );
  const boundedY = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, out.rawY));
  if (belt) {
    const safeX = beltSafeX(belt, boundedX, x);
    const resolved = resolveBeltNavigation(belt, safeX, boundedY, PLAYER_RADIUS);
    out.x = resolved.x;
    out.y = resolved.y;
  } else if (map) {
    const safe = safeSpawnPos(map, boundedX, boundedY);
    out.x = safe.x;
    out.y = safe.y;
  } else {
    out.x = boundedX;
    out.y = boundedY;
  }
  out.clamped = Math.hypot(out.x - out.rawX, out.y - out.rawY) > 0.5;
  return Math.hypot(out.x - x, out.y - y) > 1e-4;
}

const DT = TICK_MS / 1000;

/** One heartbeat plus these change/edge commands fits the server's four-message input budget. */
export const IMMEDIATE_INPUT_SEND_CAP = Math.max(0, INPUT_MSGS_PER_TICK - 1);

/** Retained, allocation-free transport gate. It changes command timing only; predictor steps stay commands. */
class ImmediateInputSendGate {
  private lastDx = 0;
  private lastDy = 0;
  private lastCrouchHeld = false;
  private lastSlideHeld = false;
  private lastFireHeld = false;
  private extrasSinceHeartbeat = 0;

  shouldMint(
    dx: number,
    dy: number,
    jump: boolean,
    crouchHeld: boolean,
    pound: boolean,
    slide: boolean,
    slideHeld: boolean,
    fireHeld: boolean,
    ultimatePressed: boolean,
  ): boolean {
    const changed =
      dx !== this.lastDx ||
      dy !== this.lastDy ||
      crouchHeld !== this.lastCrouchHeld ||
      slideHeld !== this.lastSlideHeld ||
      fireHeld !== this.lastFireHeld ||
      jump ||
      pound ||
      slide ||
      ultimatePressed;
    if (!changed || this.extrasSinceHeartbeat >= IMMEDIATE_INPUT_SEND_CAP) return false;
    this.extrasSinceHeartbeat++;
    this.recordHeld(dx, dy, crouchHeld, slideHeld, fireHeld);
    return true;
  }

  noteHeartbeat(
    dx: number,
    dy: number,
    crouchHeld: boolean,
    slideHeld: boolean,
    fireHeld: boolean,
  ): void {
    this.extrasSinceHeartbeat = 0;
    this.recordHeld(dx, dy, crouchHeld, slideHeld, fireHeld);
  }

  private recordHeld(
    dx: number,
    dy: number,
    crouchHeld: boolean,
    slideHeld: boolean,
    fireHeld: boolean,
  ): void {
    this.lastDx = dx;
    this.lastDy = dy;
    this.lastCrouchHeld = crouchHeld;
    this.lastSlideHeld = slideHeld;
    this.lastFireHeld = fireHeld;
  }
}

/** Height divergence (px) beyond which the local vertical prediction adopts the server's arc. */
const HEIGHT_ADOPT_PX = 12;
const PRED_PRESENT_MAX_COMMAND_DELTA = Math.PI / 18;
/** A locomotion-only firing presentation may lead authority, but stale correction debt never gets a
 * multi-character leash. This leaves 32 px of margin under B4's unchanged 80 px live bound. */
export const LOCOMOTION_ONLY_AUTHORITY_RADIUS_PX = 48;

function sanitizePredMomentum(p: PredState, relics: Readonly<RelicStacks>): void {
  const raw = Math.hypot(p.momentumX, p.momentumY);
  if (raw > 1e-4 && Number.isFinite(raw)) {
    const scale = Math.min(raw, relicRollSpeedAtTick(relics, 0)) / raw;
    p.momentumX *= scale;
    p.momentumY *= scale;
  } else {
    p.momentumX = 0;
    p.momentumY = 0;
  }
}

function clearCommittedStance(s: PredStanceState): void {
  s.stance = STANCE_NONE;
  s.crouchT = 0;
  s.crouchAimX = 0;
  s.crouchAimY = 0;
  s.dashDirX = 0;
  s.dashDirY = 0;
  s.dashBaseDirX = 0;
  s.dashBaseDirY = 0;
  s.dashSpeed = 0;
  s.dashSteer = 0;
  s.poundGatherT = 0;
}

function clearSlide(p: PredState, s: PredStanceState, relics: Readonly<RelicStacks>): void {
  p.mvx = 0;
  p.mvy = 0;
  p.momentumX = 0;
  p.momentumY = 0;
  s.slidePhase = SLIDE_PHASE_OFF;
  s.slidePhaseTick = 0;
  s.rollCd = Math.max(s.rollCd, relicDodgeCooldown(relics));
  clearCommittedStance(s);
}

function steerDistanceJump(s: PredStanceState, cmd: PredCmd, dt: number): void {
  const len = Math.hypot(cmd.dx, cmd.dy);
  if (len <= 1e-4) return;
  const base = Math.atan2(s.dashBaseDirY, s.dashBaseDirX);
  const desired = Math.atan2(cmd.dy, cmd.dx);
  const target = Math.max(
    -DIST_JUMP_MAX_STEER_RADIANS,
    Math.min(DIST_JUMP_MAX_STEER_RADIANS, shortestAngleDelta(base, desired)),
  );
  const maxStep = DIST_JUMP_STEER_RADIANS_PER_SECOND * dt;
  s.dashSteer += Math.max(-maxStep, Math.min(maxStep, target - s.dashSteer));
  const angle = base + s.dashSteer;
  s.dashDirX = Math.cos(angle);
  s.dashDirY = Math.sin(angle);
}

/** One horizontal sim step — the same phase order as the server's movement block: steer+integrate+clamp,
 *  impulse on top. NOT replicated (server-only, corrections absorb them): pit teleports
 *  (teleportSeq hard-snap) and player-player BODY collisions — under sustained mutual contact the
 *  ~16px/patch pushout correction converges to a STABLE self-view offset of roughly 35-70px into the
 *  other player (no jitter/oscillation; verified by the adversarial review). Acceptable for co-op PvE;
 *  a predicted push-out against remote snapshot positions is the follow-up if it reads badly in play. */
function stepHorizontal(
  s: PredState,
  dx: number,
  dy: number,
  relics: Readonly<RelicStacks>,
  dt: number,
  attackMoveMode: number,
  moveSpeedMultiplier: number,
  belt?: BeltLevel,
  beltLockX = 0,
): PredState {
  const beltX = belt ? beltPlayableXBounds(belt) : undefined;
  const beltMaxX =
    belt && beltLockX > 0
      ? Math.min(beltX?.maxX ?? ARENA_WIDTH, beltLockX)
      : (beltX?.maxX ?? ARENA_WIDTH);
  const moved = stepPlayerAttackMovement(
    { x: s.x, y: s.y },
    { vx: s.mvx, vy: s.mvy },
    { dx, dy },
    dt,
    relicMoveSpeed(relics) * moveSpeedMultiplier,
    attackMoveMode,
    belt ? BELT_Y0 : undefined,
    belt ? BELT_Y0 + DEPTH_MAX : undefined,
    (beltX?.minX ?? 0) + PLAYER_RADIUS,
    beltMaxX - PLAYER_RADIUS,
  );
  const imp = stepImpulse(
    moved,
    { vx: s.vx, vy: s.vy },
    dt,
    (beltX?.minX ?? 0) + PLAYER_RADIUS,
    beltMaxX - PLAYER_RADIUS,
  );
  let x = imp.x;
  let y = imp.y;
  if (belt) {
    // §29 belt: route out of deck obstacles + clamp DEPTH to the authored floor profile (mirrors the
    // server's belt collision so local prediction lands where the server puts you — no edge rubber-band).
    const resolved = resolveBeltNavigation(belt, x, y, PLAYER_RADIUS);
    x = Math.min(resolved.x, beltMaxX - PLAYER_RADIUS);
    y = resolved.y;
  }
  return {
    x,
    y,
    mvx: moved.vx,
    mvy: moved.vy,
    vx: imp.vx,
    vy: imp.vy,
    momentumX: s.momentumX,
    momentumY: s.momentumY,
  };
}

/**
 * Integrate ordinary locomotion through the frame-rate direction slices captured inside one command
 * window. Every non-zero slice still uses the canonical constant speed; reversals only change heading.
 * Impulse remains one exact fixed-tick step so its server/predictor decay law is unchanged.
 */
function stepAliasedInputHorizontal(
  p: PredState,
  inputSamples: readonly PredInputSample[],
  relics: Readonly<RelicStacks>,
  dt: number,
  attackMoveMode: number,
  moveSpeedMultiplier: number,
  belt?: BeltLevel,
  beltLockX = 0,
): PredState {
  const beltX = belt ? beltPlayableXBounds(belt) : undefined;
  const beltMaxX =
    belt && beltLockX > 0
      ? Math.min(beltX?.maxX ?? ARENA_WIDTH, beltLockX)
      : (beltX?.maxX ?? ARENA_WIDTH);
  let x = p.x;
  let y = p.y;
  let mvx = p.mvx;
  let mvy = p.mvy;
  let elapsed = 0;

  for (const sample of inputSamples) {
    const sampleDt = Math.min(Math.max(sample.dt, 0), Math.max(0, dt - elapsed));
    if (sampleDt <= 1e-9) continue;
    const moved = stepPlayerAttackMovement(
      { x, y },
      { vx: mvx, vy: mvy },
      { dx: sample.dx, dy: sample.dy },
      sampleDt,
      relicMoveSpeed(relics) * moveSpeedMultiplier,
      attackMoveMode,
      belt ? BELT_Y0 : undefined,
      belt ? BELT_Y0 + DEPTH_MAX : undefined,
      (beltX?.minX ?? 0) + PLAYER_RADIUS,
      beltMaxX - PLAYER_RADIUS,
    );
    x = moved.x;
    y = moved.y;
    mvx = moved.vx;
    mvy = moved.vy;
    if (belt) {
      const resolved = resolveBeltNavigation(belt, x, y, PLAYER_RADIUS);
      x = Math.min(resolved.x, beltMaxX - PLAYER_RADIUS);
      y = resolved.y;
    }
    elapsed += sampleDt;
  }

  const imp = stepImpulse(
    { x, y },
    { vx: p.vx, vy: p.vy },
    Math.min(dt, elapsed),
    (beltX?.minX ?? 0) + PLAYER_RADIUS,
    beltMaxX - PLAYER_RADIUS,
  );
  x = imp.x;
  y = imp.y;
  if (belt) {
    const resolved = resolveBeltNavigation(belt, x, y, PLAYER_RADIUS);
    x = Math.min(resolved.x, beltMaxX - PLAYER_RADIUS);
    y = resolved.y;
  }
  return {
    x,
    y,
    mvx,
    mvy,
    vx: imp.vx,
    vy: imp.vy,
    momentumX: p.momentumX,
    momentumY: p.momentumY,
  };
}

function stepStanceHorizontal(
  p: PredState,
  s: PredStanceState,
  cmd: PredCmd,
  relics: Readonly<RelicStacks>,
  dt: number,
  attackMoveMode: number,
  moveSpeedMultiplier: number,
  belt?: BeltLevel,
  beltLockX = 0,
  deferDashDisplacement = false,
): PredState {
  const activeSlide = s.stance === STANCE_SLIDE && s.slidePhase === SLIDE_PHASE_GROUND;
  if (s.stance !== STANCE_DASH && !activeSlide) {
    const rooted = s.stance === STANCE_CROUCH || s.stance === STANCE_POUND || s.recoveryT > 0;
    return stepHorizontal(
      p,
      rooted ? 0 : cmd.dx,
      rooted ? 0 : cmd.dy,
      relics,
      dt,
      attackMoveMode,
      moveSpeedMultiplier,
      belt,
      beltLockX,
    );
  }
  let mvx: number;
  let mvy: number;
  const beltX = belt ? beltPlayableXBounds(belt) : undefined;
  const beltMaxX =
    belt && beltLockX > 0
      ? Math.min(beltX?.maxX ?? ARENA_WIDTH, beltLockX)
      : (beltX?.maxX ?? ARENA_WIDTH);
  if (s.stance === STANCE_DASH) {
    steerDistanceJump(s, cmd, dt);
    mvx = s.dashDirX * s.dashSpeed;
    mvy = s.dashDirY * s.dashSpeed;
  } else {
    const directionLength = Math.hypot(p.momentumX, p.momentumY);
    if (directionLength <= 1e-4) {
      clearSlide(p, s, relics);
      return stepHorizontal(
        p,
        cmd.dx,
        cmd.dy,
        relics,
        dt,
        attackMoveMode,
        moveSpeedMultiplier,
        belt,
        beltLockX,
      );
    }
    const slideSpeed = relicRollSpeedAtTick(relics, s.slidePhaseTick);
    p.momentumX = (p.momentumX / directionLength) * slideSpeed;
    p.momentumY = (p.momentumY / directionLength) * slideSpeed;
    mvx = p.momentumX;
    mvy = p.momentumY;
  }
  let x = deferDashDisplacement
    ? p.x
    : Math.max(
        (beltX?.minX ?? 0) + PLAYER_RADIUS,
        Math.min(beltMaxX - PLAYER_RADIUS, p.x + mvx * dt),
      );
  let y = deferDashDisplacement
    ? p.y
    : Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, p.y + mvy * dt));
  const imp = stepImpulse(
    { x, y },
    { vx: p.vx, vy: p.vy },
    dt,
    (beltX?.minX ?? 0) + PLAYER_RADIUS,
    beltMaxX - PLAYER_RADIUS,
  );
  x = imp.x;
  y = imp.y;
  if (belt) {
    const resolved = resolveBeltNavigation(belt, x, y, PLAYER_RADIUS);
    x = Math.min(resolved.x, beltMaxX - PLAYER_RADIUS);
    y = resolved.y;
  }
  if (activeSlide && s.stance === STANCE_SLIDE) {
    s.slidePhaseTick++;
    const length = Math.hypot(p.momentumX, p.momentumY);
    if (length > 1e-4) {
      const nextSpeed = relicRollSpeedAtTick(relics, s.slidePhaseTick);
      p.momentumX = (p.momentumX / length) * nextSpeed;
      p.momentumY = (p.momentumY / length) * nextSpeed;
    }
    mvx = p.momentumX;
    mvy = p.momentumY;
  }
  return {
    x,
    y,
    mvx,
    mvy,
    vx: imp.vx,
    vy: imp.vy,
    momentumX: p.momentumX,
    momentumY: p.momentumY,
  };
}

function consumeStanceInput(
  p: PredState,
  v: PredVerticalState,
  s: PredStanceState,
  cmd: PredCmd,
  relics: Readonly<RelicStacks>,
): void {
  const aimLen = Math.hypot(cmd.aimX ?? 0, cmd.aimY ?? 0);
  if (aimLen > 1e-4) {
    s.aimX = (cmd.aimX ?? 0) / aimLen;
    s.aimY = (cmd.aimY ?? 0) / aimLen;
  }
  if (
    cmd.fireHeld &&
    s.stance === STANCE_SLIDE &&
    s.slidePhaseTick * (TICK_MS / 1000) + 1e-9 >= ROLL_ATTACK_CANCEL_SECONDS
  ) {
    clearSlide(p, s, relics);
  }
  if (cmd.pound) {
    if (
      v.height > POUND_MIN_HEIGHT &&
      !s.poundUsed &&
      (s.stance === STANCE_NONE || s.stance === STANCE_DASH)
    ) {
      s.poundUsed = true;
      s.poundGatherT = POUND_GATHER_SECONDS;
      v.vh = 0;
      p.mvx = 0;
      p.mvy = 0;
      s.dashSpeed = 0;
      s.stance = STANCE_POUND;
    } else if (v.height > GROUND_EPSILON && v.height <= POUND_MIN_HEIGHT) {
      v.jumpBuf = JUMP_BUFFER_SECONDS;
    }
  }

  s.slidePrevHeld = cmd.slideHeld === true;

  if (
    cmd.slide &&
    v.height <= GROUND_EPSILON &&
    s.stance === STANCE_NONE &&
    s.recoveryT <= 0 &&
    s.rollCd <= 0
  ) {
    let dx = cmd.dx;
    let dy = cmd.dy;
    let length = Math.hypot(dx, dy);
    if (length <= 1e-4) {
      dx = p.mvx;
      dy = p.mvy;
      length = Math.hypot(dx, dy);
    }
    if (length <= 1e-4) {
      dx = s.aimX;
      dy = s.aimY;
      length = Math.hypot(dx, dy);
    }
    if (length > 1e-4) {
      const speed = relicRollSpeedAtTick(relics, 0);
      p.momentumX = (dx / length) * speed;
      p.momentumY = (dy / length) * speed;
      p.mvx = p.momentumX;
      p.mvy = p.momentumY;
      s.slidePhase = SLIDE_PHASE_GROUND;
      s.slidePhaseTick = 0;
      s.slideParryLockT = ROLL_PARRY_LOCK_SECONDS + TICK_MS / 1000;
      s.stance = STANCE_SLIDE;
    }
  }
  s.crouchPrevHeld = false;
}

function launchDistanceJump(
  p: PredState,
  v: PredVerticalState,
  s: PredStanceState,
  cmd: PredCmd,
  indicator: DistanceJumpIndicator,
  map?: ArenaMap,
  belt?: BeltLevel,
): void {
  let dx = cmd.dx;
  let dy = cmd.dy;
  let len = Math.hypot(dx, dy);
  if (len <= 1e-4) {
    dx = s.aimX;
    dy = s.aimY;
  }
  if (!writeDistanceJumpIndicator(indicator, p.x, p.y, dx, dy, s.aimX, s.aimY, map, belt)) {
    clearCommittedStance(s);
    return;
  }
  dx = indicator.x - p.x;
  dy = indicator.y - p.y;
  len = Math.hypot(dx, dy);
  if (len <= 1e-4) {
    clearCommittedStance(s);
    return;
  }
  s.dashDirX = dx / len;
  s.dashDirY = dy / len;
  s.dashBaseDirX = s.dashDirX;
  s.dashBaseDirY = s.dashDirY;
  s.dashSteer = 0;
  s.dashSpeed = Math.min(DIST_JUMP_SPEED, len / DIST_JUMP_AIRTIME);
  s.distJumpCd = DIST_JUMP_COOLDOWN;
  v.vh = DIST_JUMP_VERTICAL_VELOCITY;
  p.mvx = s.dashDirX * s.dashSpeed;
  p.mvy = s.dashDirY * s.dashSpeed;
  s.stance = STANCE_DASH;
}

/** Mirror J1's consume → movement → timer/stance → vertical phase order for one command tick. */
function stepPredictionTick(
  p: PredState,
  v: PredVerticalState,
  s: PredStanceState,
  cmd: PredCmd,
  relics: Readonly<RelicStacks>,
  dt: number,
  attackMoveMode: number,
  moveSpeedMultiplier: number,
  continuousRecoilX: number,
  continuousRecoilY: number,
  indicator: DistanceJumpIndicator,
  map?: ArenaMap,
  belt?: BeltLevel,
  beltLockX = 0,
  inputSamples?: readonly PredInputSample[],
): PredState {
  if (cmd.jump) {
    const rollTail =
      s.stance === STANCE_SLIDE ? (ROLL_DURATION_TICKS - s.slidePhaseTick + 2) * dt : 0;
    v.jumpBuf = Math.max(JUMP_BUFFER_SECONDS, rollTail);
  }
  consumeStanceInput(p, v, s, cmd, relics);
  v.jumpCd = Math.max(0, v.jumpCd - dt);
  v.jumpBuf = Math.max(0, v.jumpBuf - dt);
  s.distJumpCd = Math.max(0, s.distJumpCd - dt);
  let launchedDistanceJump = false;
  if (
    s.stance === STANCE_NONE &&
    s.recoveryT <= 0 &&
    v.jumpBuf > 0 &&
    s.distJumpCd <= 0 &&
    (v.height <= GROUND_EPSILON || v.airJumpsRemaining > 0)
  ) {
    const airJump = v.height > GROUND_EPSILON;
    v.jumpBuf = 0;
    launchDistanceJump(p, v, s, cmd, indicator, map, belt);
    // launchDistanceJump mutates s.stance; read it widened so the STANCE_NONE narrowing above
    // doesn't make this (correct) comparison look impossible. Mirrors GameRoom's launch check.
    const stanceAfterLaunch: number = s.stance;
    launchedDistanceJump = stanceAfterLaunch === STANCE_DASH;
    if (airJump && launchedDistanceJump) v.airJumpsRemaining--;
  }

  const aliasesOrdinaryMovement =
    inputSamples !== undefined &&
    inputSamples.length > 0 &&
    !launchedDistanceJump &&
    s.stance === STANCE_NONE &&
    s.recoveryT <= 0;
  const next = aliasesOrdinaryMovement
    ? stepAliasedInputHorizontal(
        p,
        inputSamples,
        relics,
        dt,
        attackMoveMode,
        moveSpeedMultiplier,
        belt,
        beltLockX,
      )
    : stepStanceHorizontal(
        p,
        s,
        cmd,
        relics,
        dt,
        attackMoveMode,
        moveSpeedMultiplier,
        belt,
        beltLockX,
        launchedDistanceJump,
      );
  if (cmd.fireHeld && Math.hypot(continuousRecoilX, continuousRecoilY) > 1e-9) {
    const recoil = addImpulse(next, continuousRecoilX * dt, continuousRecoilY * dt);
    next.vx = recoil.vx;
    next.vy = recoil.vy;
  }

  s.recoveryT = Math.max(0, s.recoveryT - dt);
  s.rollCd = Math.max(0, s.rollCd - dt);
  s.slideParryLockT = Math.max(0, s.slideParryLockT - dt);
  if (s.slideParryLockT <= 1e-9) s.slideParryLockT = 0;
  if (
    s.stance === STANCE_SLIDE &&
    s.slidePhase === SLIDE_PHASE_GROUND &&
    s.slidePhaseTick >= ROLL_DURATION_TICKS
  ) {
    const length = Math.hypot(next.momentumX, next.momentumY);
    const dirX = length > 1e-4 ? next.momentumX / length : 0;
    const dirY = length > 1e-4 ? next.momentumY / length : 0;
    clearSlide(next, s, relics);
    const moveSpeed = relicMoveSpeed(relics);
    next.mvx = dirX * moveSpeed;
    next.mvy = dirY * moveSpeed;
  }

  const wasAirborne = v.height > GROUND_EPSILON;
  const landingStance = s.stance;
  if (s.stance === STANCE_POUND) {
    if (s.poundGatherT > 0) {
      s.poundGatherT = Math.max(0, s.poundGatherT - dt);
      v.vh = s.poundGatherT <= 0 ? -POUND_SPEED : 0;
    } else {
      v.vh = -POUND_SPEED;
      v.height = Math.max(0, v.height - POUND_SPEED * dt);
      if (v.height <= GROUND_EPSILON) {
        v.height = 0;
        v.vh = 0;
      }
    }
  } else {
    const vert = stepVertical(v.height, v.vh, dt);
    v.height = vert.height;
    v.vh = vert.vh;
  }
  if (wasAirborne && v.height <= GROUND_EPSILON) {
    if (landingStance === STANCE_POUND) {
      v.jumpCd = Math.max(v.jumpCd, POUND_JUMP_COOLDOWN);
      s.recoveryT = POUND_RECOVERY_SECONDS;
    } else if (landingStance === STANCE_DASH) {
      v.jumpCd = Math.max(v.jumpCd, 0.4);
      const moveSpeed = relicMoveSpeed(relics);
      next.mvx = s.dashDirX * moveSpeed * DIST_JUMP_LANDING_SPEED_MULT;
      next.mvy = s.dashDirY * moveSpeed * DIST_JUMP_LANDING_SPEED_MULT;
    }
    if (landingStance !== STANCE_NONE) clearCommittedStance(s);
    s.poundUsed = false;
    v.airJumpsRemaining = relicJumpCount(relics);
  }
  return next;
}

export class SelfPredictor {
  private pred: PredState;
  private relics: Readonly<RelicStacks> = EMPTY_RELIC_STACKS;
  private readonly previewPred: PredState = {
    x: 0,
    y: 0,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    momentumX: 0,
    momentumY: 0,
  };
  private readonly constrainedRenderPos = { x: 0, y: 0 };
  private readonly authorityBoundRenderPos = { x: 0, y: 0 };
  private readonly pending: PendingPredCmd[] = [];
  /** Frame-rate direction history for the not-yet-committed 50ms movement window. */
  private inputSamples: PredInputSample[] = [];
  private inputSampleSeconds = 0;
  private readonly immediateInputGate = new ImmediateInputSendGate();
  private map?: ArenaMap;
  /** §29 belt level (floor profile + obstacles) for predicted authored navigation. */
  private belt?: BeltLevel;
  private lastTeleportSeq: number;
  private lastStanceSeq: number;
  private lastMovementCorrectionSeq: number;
  private lastServerMotionEpoch: number;
  private attackMoveMode: number;
  /** Server phase context not represented by the generic attack input mode. */
  private moveSpeedMultiplier = 1;
  private continuousRecoilX = 0;
  private continuousRecoilY = 0;
  private beltLockX = 0;
  /** Visual error offset — reconciliation corrections land here and decay (glide, don't pop). */
  private errX = 0;
  private errY = 0;
  /** Remaining wall-clock budget for the current correction. Ordinary Smooth uses the shared 140 ms
   * ceiling; stale SELF recovery uses the shorter L10 deadline below. */
  private correctionRemainingSec = 0;
  /** Only stale-resync recovery may bypass the final ordinary locomotion limiter. L10 previously leaked
   * this bypass to every Smooth envelope correction, making unrelated corrections feel more elastic. */
  private fastStallRecoveryActive = false;
  private selfCorrectionCount = 0;
  private correctionObserver?: (event: Readonly<SelfCorrectionEvent>) => void;
  private correctionEvent?: SelfCorrectionEvent;
  private readonly movementReport = {
    x: 0,
    y: 0,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    serverMotionEpoch: 0,
    movementCorrectionSeq: 0,
  };
  /** Set when a frame/pending stall makes replay stale. The next patch rebases simulation immediately
   * while preserving the current SELF presentation and retiring its residual through Smooth. */
  private needResync = false;
  /** One-shot bypass so an authored teleport remains a cut instead of being folded into presentation. */
  private presentationSnapPending = false;
  /** True while dead — prediction pauses and renders server truth directly. */
  private paused = false;
  /** True while the connection has STALLED (pending overflowed with no ack) — the predictor FREEZES
   *  (stops advancing; dead-reckoning seconds into the dark is worse than holding still) and the scene
   *  shows a connection hint; the next patch rebases and Smooth-recovers SELF (L10). */
  private stalled = false;
  /** A forced cancel while Space is still physically held must not invent a fresh press before release. */
  private suppressCrouchUntilRelease = false;
  /** Denial/forced-cancel law: the same physical slide hold cannot resurrect a rejected chain. */
  private suppressSlideUntilRelease = false;

  // Vertical (local-first, adopt-on-divergence).
  private height: number;
  private vh: number;
  private jumpCd = 0;
  private jumpBuf = 0;
  private airJumpsRemaining: number;
  private stance: PredStanceState;
  private readonly indicatorScratch: DistanceJumpIndicator = {
    rawX: 0,
    rawY: 0,
    x: 0,
    y: 0,
    dirX: 1,
    dirY: 0,
    clamped: false,
  };
  private readonly previewCmd: PredCmd = {
    seq: 0,
    dx: 0,
    dy: 0,
    jump: false,
    crouchHeld: false,
    pound: false,
    slide: false,
    slideHeld: false,
  };
  private readonly previewStance: PredStanceState = {
    stance: STANCE_NONE,
    crouchT: 0,
    crouchPrevHeld: false,
    crouchAimX: 0,
    crouchAimY: 0,
    dashDirX: 0,
    dashDirY: 0,
    dashBaseDirX: 0,
    dashBaseDirY: 0,
    dashSpeed: 0,
    dashSteer: 0,
    distJumpCd: 0,
    poundUsed: false,
    poundGatherT: 0,
    recoveryT: 0,
    slidePhase: SLIDE_PHASE_OFF,
    slidePhaseTick: 0,
    slidePrevHeld: false,
    rollCd: 0,
    slideParryLockT: 0,
    aimX: 1,
    aimY: 0,
  };

  /** Last minted command seq (the scene increments through `mintCmd`). */
  private seq = 0;

  constructor(server: ServerView) {
    this.pred = {
      x: server.x,
      y: server.y,
      mvx: server.mvx,
      mvy: server.mvy,
      vx: server.vx,
      vy: server.vy,
      momentumX: server.momentumX ?? 0,
      momentumY: server.momentumY ?? 0,
    };
    sanitizePredMomentum(this.pred, this.relics);
    this.height = server.height;
    this.vh = server.vh;
    this.airJumpsRemaining = Math.max(0, Math.floor(server.airJumpsRemaining ?? 0));
    this.lastTeleportSeq = server.teleportSeq;
    this.lastMovementCorrectionSeq = server.movementCorrectionSeq ?? 0;
    this.lastServerMotionEpoch = server.serverMotionEpoch ?? 0;
    this.attackMoveMode = server.attackMoveMode ?? PlayerAttackMoveMode.Normal;
    const serverStance = server.moveStance ?? STANCE_NONE;
    this.lastStanceSeq = server.stanceSeq ?? 0;
    const speed = Math.hypot(server.mvx, server.mvy);
    const dirX = speed > 1e-4 ? server.mvx / speed : 0;
    const dirY = speed > 1e-4 ? server.mvy / speed : 0;
    this.stance = {
      stance: serverStance,
      crouchT: 0,
      crouchPrevHeld: false,
      crouchAimX: 0,
      crouchAimY: 0,
      dashDirX: serverStance === STANCE_DASH ? dirX : 0,
      dashDirY: serverStance === STANCE_DASH ? dirY : 0,
      dashBaseDirX: serverStance === STANCE_DASH ? dirX : 0,
      dashBaseDirY: serverStance === STANCE_DASH ? dirY : 0,
      dashSpeed: serverStance === STANCE_DASH ? speed : 0,
      dashSteer: 0,
      distJumpCd: 0,
      poundUsed: serverStance === STANCE_POUND,
      poundGatherT: 0,
      recoveryT: 0,
      slidePhase: (server.slidePhase ?? SLIDE_PHASE_OFF) as SlidePhase,
      slidePhaseTick: server.slidePhaseTick ?? 0,
      slidePrevHeld: false,
      rollCd: 0,
      slideParryLockT: 0,
      aimX: speed > 1e-4 ? dirX : 1,
      aimY: speed > 1e-4 ? dirY : 0,
    };
    this.paused = !server.alive;
  }

  /** Predict deterministic owner-authored impulses (currently gun recoil) at their local round edge.
   * Hostile/contact knockback remains server-only and continues to glide through reconciliation. */
  addPredictedImpulse(ix: number, iy: number, maxImpulse?: number): void {
    if (this.paused || this.stalled) return;
    const impulse = addImpulse(this.pred, ix, iy, maxImpulse);
    this.pred.vx = impulse.vx;
    this.pred.vy = impulse.vy;
  }

  /** The client-side arena map, regenerated from synced seeds for pit-safe distance-jump endpoints. */
  setMap(map: ArenaMap | undefined): void {
    this.map = map;
  }

  /** §29 set the belt level so prediction uses the authored floor/obstacle collision. */
  setBeltLevel(level: BeltLevel | undefined): void {
    this.belt = level;
  }

  /** Mirror the live belt gate that post-navigation authority applies after the shared movement step. */
  setBeltLockX(lockX: number | undefined): void {
    this.beltLockX = Number.isFinite(lockX) && (lockX ?? 0) > 0 ? (lockX as number) : 0;
  }

  /**
   * Mirror server-only phase context using already-synced beam/ultimate rows. Continuous recoil is a
   * px/s vector added after movement each fixed tick, matching the authoritative beam phase order.
   */
  setServerMovementContext(
    moveSpeedMultiplier: number,
    continuousRecoilX = 0,
    continuousRecoilY = 0,
  ): void {
    this.moveSpeedMultiplier =
      Number.isFinite(moveSpeedMultiplier) && moveSpeedMultiplier >= 0 ? moveSpeedMultiplier : 1;
    this.continuousRecoilX = Number.isFinite(continuousRecoilX) ? continuousRecoilX : 0;
    this.continuousRecoilY = Number.isFinite(continuousRecoilY) ? continuousRecoilY : 0;
  }

  /** Keep client locomotion and dodge prediction aligned with server-owned relic effects. */
  setRelics(relics: Readonly<RelicStacks> | undefined, airJumpsRemaining?: number): void {
    const previousJumpCount = relicJumpCount(this.relics);
    this.relics = relics ?? EMPTY_RELIC_STACKS;
    const jumpCount = relicJumpCount(this.relics);
    if (Number.isFinite(airJumpsRemaining)) {
      this.airJumpsRemaining = Math.max(
        0,
        Math.min(jumpCount, Math.floor(airJumpsRemaining as number)),
      );
    } else if (jumpCount > previousJumpCount) {
      this.airJumpsRemaining = Math.min(
        jumpCount,
        this.airJumpsRemaining + jumpCount - previousJumpCount,
      );
    } else {
      this.airJumpsRemaining = Math.min(this.airJumpsRemaining, jumpCount);
    }
  }

  /** True when a held-state change or one-shot edge should mint before the next 20Hz heartbeat. */
  shouldMintImmediateInput(
    dx: number,
    dy: number,
    jump: boolean,
    crouchHeld: boolean,
    pound: boolean,
    slide: boolean,
    slideHeld: boolean,
    fireHeld: boolean,
    ultimatePressed: boolean,
  ): boolean {
    return this.immediateInputGate.shouldMint(
      dx,
      dy,
      jump,
      crouchHeld,
      pound,
      slide,
      slideHeld,
      fireHeld,
      ultimatePressed,
    );
  }

  /** Re-open the bounded extra-send allowance without changing predictor state or sequence numbering. */
  noteInputHeartbeat(
    dx: number,
    dy: number,
    crouchHeld: boolean,
    slideHeld: boolean,
    fireHeld: boolean,
  ): void {
    this.immediateInputGate.noteHeartbeat(dx, dy, crouchHeld, slideHeld, fireHeld);
  }

  /** Mint the next sequence-numbered command from this frame's sampled input. */
  mintCmd(
    dx: number,
    dy: number,
    jump: boolean,
    crouchHeld = false,
    pound = false,
    aimX?: number,
    aimY?: number,
    slide = false,
    slideHeld = slide,
  ): PredCmd {
    this.seq = (this.seq + 1) >>> 0;
    return { seq: this.seq, dx, dy, jump, crouchHeld, pound, slide, slideHeld, aimX, aimY };
  }

  /** Add one physical-frame direction slice to the pending command window. */
  sampleInputFrame(dx: number, dy: number, elapsedSeconds: number): void {
    if (this.paused || this.stalled) return;
    const dt = Math.min(
      Math.max(Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0, 0),
      Math.max(0, DT - this.inputSampleSeconds),
    );
    if (dt <= 1e-9) return;
    const last = this.inputSamples[this.inputSamples.length - 1];
    if (last && last.dx === dx && last.dy === dy) {
      last.dt += dt;
    } else {
      this.inputSamples.push({ dx, dy, dt });
    }
    this.inputSampleSeconds += dt;
  }

  /** Drop an incomplete frame-sampled window when scene time is intentionally reset. */
  resetInputFrameWindow(): void {
    this.inputSamples = [];
    this.inputSampleSeconds = 0;
  }

  private takeInputFrameWindow(cmd: PredCmd): PredInputSample[] {
    if (this.inputSamples.length === 0) return [];
    const remaining = DT - this.inputSampleSeconds;
    if (remaining > 1e-9) {
      const last = this.inputSamples[this.inputSamples.length - 1];
      if (last && last.dx === cmd.dx && last.dy === cmd.dy) last.dt += remaining;
      else this.inputSamples.push({ dx: cmd.dx, dy: cmd.dy, dt: remaining });
    } else if (remaining < -1e-9) {
      const last = this.inputSamples[this.inputSamples.length - 1];
      if (last) last.dt = Math.max(0, last.dt + remaining);
    }
    const samples = this.inputSamples;
    this.inputSamples = [];
    this.inputSampleSeconds = 0;
    return samples;
  }

  /** Advance one exact 50ms tick. Frame-sampled steering commits into the existing B42 pose report while
   *  the scene sends `cmd` as the final held direction on the unchanged input wire. */
  tick(cmd: PredCmd): void {
    const inputSamples = this.takeInputFrameWindow(cmd);
    if (this.paused || this.stalled) return; // dead/stalled — don't advance into the dark
    const physicalCrouchHeld = cmd.crouchHeld === true;
    if (this.suppressCrouchUntilRelease && !physicalCrouchHeld)
      this.suppressCrouchUntilRelease = false;
    const predictedCrouchHeld = this.suppressCrouchUntilRelease ? false : physicalCrouchHeld;
    const physicalSlideHeld = cmd.slideHeld === true;
    if (this.suppressSlideUntilRelease && !physicalSlideHeld)
      this.suppressSlideUntilRelease = false;
    const predictedSlideHeld = this.suppressSlideUntilRelease ? false : physicalSlideHeld;
    const pending: PendingPredCmd = {
      ...cmd,
      inputSamples,
      crouchHeld: predictedCrouchHeld,
      slide: this.suppressSlideUntilRelease ? false : cmd.slide,
      slideHeld: predictedSlideHeld,
      jumpCdBefore: this.jumpCd,
      jumpBufBefore: this.jumpBuf,
      airJumpsBefore: this.airJumpsRemaining,
      moveSpeedMultiplierBefore: this.moveSpeedMultiplier,
      continuousRecoilXBefore: this.continuousRecoilX,
      continuousRecoilYBefore: this.continuousRecoilY,
      beltLockXBefore: this.beltLockX,
      stanceBefore: this.stance.stance,
      crouchTBefore: this.stance.crouchT,
      crouchPrevHeldBefore: this.stance.crouchPrevHeld,
      crouchAimXBefore: this.stance.crouchAimX,
      crouchAimYBefore: this.stance.crouchAimY,
      dashDirXBefore: this.stance.dashDirX,
      dashDirYBefore: this.stance.dashDirY,
      dashBaseDirXBefore: this.stance.dashBaseDirX,
      dashBaseDirYBefore: this.stance.dashBaseDirY,
      dashSpeedBefore: this.stance.dashSpeed,
      dashSteerBefore: this.stance.dashSteer,
      distCdBefore: this.stance.distJumpCd,
      poundUsedBefore: this.stance.poundUsed,
      poundGatherTBefore: this.stance.poundGatherT,
      recoveryTBefore: this.stance.recoveryT,
      momentumXBefore: this.pred.momentumX,
      momentumYBefore: this.pred.momentumY,
      slidePhaseBefore: this.stance.slidePhase,
      slidePhaseTickBefore: this.stance.slidePhaseTick,
      slidePrevHeldBefore: this.stance.slidePrevHeld,
      rollCdBefore: this.stance.rollCd,
      slideParryLockTBefore: this.stance.slideParryLockT,
      aimXBefore: this.stance.aimX,
      aimYBefore: this.stance.aimY,
    };
    const vert: PredVerticalState = {
      height: this.height,
      vh: this.vh,
      jumpCd: this.jumpCd,
      jumpBuf: this.jumpBuf,
      airJumpsRemaining: this.airJumpsRemaining,
    };
    this.pred = stepPredictionTick(
      this.pred,
      vert,
      this.stance,
      pending,
      this.relics,
      DT,
      this.attackMoveMode,
      pending.moveSpeedMultiplierBefore,
      pending.continuousRecoilXBefore,
      pending.continuousRecoilYBefore,
      this.indicatorScratch,
      this.map,
      this.belt,
      pending.beltLockXBefore,
      pending.inputSamples,
    );
    this.height = vert.height;
    this.vh = vert.vh;
    this.jumpCd = vert.jumpCd;
    this.jumpBuf = vert.jumpBuf;
    this.airJumpsRemaining = vert.airJumpsRemaining;
    this.pending.push(pending);
    if (this.pending.length > PRED_PENDING_MAX) {
      this.pending.shift();
      // The connection STALLED (~3.2s of un-acked commands): FREEZE prediction (tick() short-circuits
      // from now on), then rebase simulation and Smooth-recover SELF when truth arrives.
      this.needResync = true;
      this.stalled = true;
    }
  }

  /** B42 post-prediction pose attached to the same sequence-numbered input heartbeat. Caller must consume
   * immediately; the allocation-free object is reused on the next call. */
  clientMovementReport(): Readonly<{
    x: number;
    y: number;
    mvx: number;
    mvy: number;
    vx: number;
    vy: number;
    serverMotionEpoch: number;
    movementCorrectionSeq: number;
  }> {
    this.movementReport.x = this.pred.x;
    this.movementReport.y = this.pred.y;
    this.movementReport.mvx = this.pred.mvx;
    this.movementReport.mvy = this.pred.mvy;
    this.movementReport.vx = this.pred.vx;
    this.movementReport.vy = this.pred.vy;
    this.movementReport.serverMotionEpoch = this.lastServerMotionEpoch;
    this.movementReport.movementCorrectionSeq = this.lastMovementCorrectionSeq;
    return this.movementReport;
  }

  private stanceFromServer(server: ServerView): PredStanceState {
    const serverStance = server.moveStance ?? STANCE_NONE;
    const speed = Math.hypot(server.mvx, server.mvy);
    const dirX = speed > 1e-4 ? server.mvx / speed : 0;
    const dirY = speed > 1e-4 ? server.mvy / speed : 0;
    return {
      stance: serverStance,
      crouchT: 0,
      crouchPrevHeld: false,
      crouchAimX: 0,
      crouchAimY: 0,
      dashDirX: serverStance === STANCE_DASH ? dirX : 0,
      dashDirY: serverStance === STANCE_DASH ? dirY : 0,
      dashBaseDirX: serverStance === STANCE_DASH ? dirX : 0,
      dashBaseDirY: serverStance === STANCE_DASH ? dirY : 0,
      dashSpeed: serverStance === STANCE_DASH ? speed : 0,
      dashSteer: 0,
      distJumpCd: 0,
      poundUsed: serverStance === STANCE_POUND,
      poundGatherT: 0,
      recoveryT: 0,
      slidePhase: (server.slidePhase ?? SLIDE_PHASE_OFF) as SlidePhase,
      slidePhaseTick: server.slidePhaseTick ?? 0,
      slidePrevHeld: this.stance.slidePrevHeld,
      rollCd:
        serverStance !== STANCE_SLIDE && this.stance.stance === STANCE_SLIDE
          ? Math.max(this.stance.rollCd, relicDodgeCooldown(this.relics))
          : this.stance.rollCd,
      slideParryLockT: this.stance.slideParryLockT,
      aimX: speed > 1e-4 ? dirX : this.stance.aimX || 1,
      aimY: speed > 1e-4 ? dirY : this.stance.aimY,
    };
  }

  private stanceFromPending(cmd: PendingPredCmd | undefined): PredStanceState {
    if (!cmd) return { ...this.stance };
    return {
      stance: cmd.stanceBefore,
      crouchT: cmd.crouchTBefore,
      crouchPrevHeld: cmd.crouchPrevHeldBefore,
      crouchAimX: cmd.crouchAimXBefore,
      crouchAimY: cmd.crouchAimYBefore,
      dashDirX: cmd.dashDirXBefore,
      dashDirY: cmd.dashDirYBefore,
      dashBaseDirX: cmd.dashBaseDirXBefore,
      dashBaseDirY: cmd.dashBaseDirYBefore,
      dashSpeed: cmd.dashSpeedBefore,
      dashSteer: cmd.dashSteerBefore,
      distJumpCd: cmd.distCdBefore,
      poundUsed: cmd.poundUsedBefore,
      poundGatherT: cmd.poundGatherTBefore,
      recoveryT: cmd.recoveryTBefore,
      slidePhase: cmd.slidePhaseBefore,
      slidePhaseTick: cmd.slidePhaseTickBefore,
      slidePrevHeld: cmd.slidePrevHeldBefore,
      rollCd: cmd.rollCdBefore,
      slideParryLockT: cmd.slideParryLockTBefore,
      aimX: cmd.aimXBefore,
      aimY: cmd.aimYBefore,
    };
  }

  private copyStance(out: PredStanceState, source: PredStanceState): void {
    out.stance = source.stance;
    out.crouchT = source.crouchT;
    out.crouchPrevHeld = source.crouchPrevHeld;
    out.crouchAimX = source.crouchAimX;
    out.crouchAimY = source.crouchAimY;
    out.dashDirX = source.dashDirX;
    out.dashDirY = source.dashDirY;
    out.dashBaseDirX = source.dashBaseDirX;
    out.dashBaseDirY = source.dashBaseDirY;
    out.dashSpeed = source.dashSpeed;
    out.dashSteer = source.dashSteer;
    out.distJumpCd = source.distJumpCd;
    out.poundUsed = source.poundUsed;
    out.poundGatherT = source.poundGatherT;
    out.recoveryT = source.recoveryT;
    out.slidePhase = source.slidePhase;
    out.slidePhaseTick = source.slidePhaseTick;
    out.slidePrevHeld = source.slidePrevHeld;
    out.rollCd = source.rollCd;
    out.slideParryLockT = source.slideParryLockT;
    out.aimX = source.aimX;
    out.aimY = source.aimY;
  }

  /** stanceSeq adopt law: erase every still-pending stance cause + its stale rebase point, never errX/Y. */
  private stripPendingStanceBits(adopted: PredStanceState): void {
    for (const cmd of this.pending) {
      cmd.crouchHeld = false;
      cmd.pound = false;
      cmd.slide = false;
      cmd.slideHeld = false;
      cmd.stanceBefore = adopted.stance;
      cmd.crouchTBefore = adopted.crouchT;
      cmd.crouchPrevHeldBefore = false;
      cmd.crouchAimXBefore = adopted.crouchAimX;
      cmd.crouchAimYBefore = adopted.crouchAimY;
      cmd.dashDirXBefore = adopted.dashDirX;
      cmd.dashDirYBefore = adopted.dashDirY;
      cmd.dashBaseDirXBefore = adopted.dashBaseDirX;
      cmd.dashBaseDirYBefore = adopted.dashBaseDirY;
      cmd.dashSpeedBefore = adopted.dashSpeed;
      cmd.dashSteerBefore = adopted.dashSteer;
      cmd.distCdBefore = adopted.distJumpCd;
      cmd.poundUsedBefore = adopted.poundUsed;
      cmd.poundGatherTBefore = adopted.poundGatherT;
      cmd.recoveryTBefore = adopted.recoveryT;
      cmd.momentumXBefore = 0;
      cmd.momentumYBefore = 0;
      cmd.slidePhaseBefore = adopted.slidePhase;
      cmd.slidePhaseTickBefore = adopted.slidePhaseTick;
      cmd.slidePrevHeldBefore = false;
      cmd.rollCdBefore = adopted.rollCd;
      cmd.slideParryLockTBefore = adopted.slideParryLockT;
      cmd.aimXBefore = adopted.aimX;
      cmd.aimYBefore = adopted.aimY;
    }
  }

  /** Dev diagnostics are opt-in at the scene seam; production never installs this observer. */
  setCorrectionObserver(
    observer: ((event: Readonly<SelfCorrectionEvent>) => void) | undefined,
  ): void {
    this.correctionObserver = observer;
    if (observer && !this.correctionEvent) {
      this.correctionEvent = {
        magnitudePx: 0,
        band: MovementCorrectionBand.Silent,
        cause: "envelope-violation",
      };
    }
  }

  private reportSelfCorrection(
    magnitudePx: number,
    band: MovementCorrectionBandValue,
    cause: SelfCorrectionCause,
  ): void {
    const event = this.correctionEvent;
    if (!this.correctionObserver || !event) return;
    event.magnitudePx = magnitudePx;
    event.band = band;
    event.cause = cause;
    this.correctionObserver(event);
  }

  /** Reconcile against a fresh patch (call from room.onStateChange — data only, never touch rigs here). */
  private applyMovementCorrection(
    dx: number,
    dy: number,
    cause?: SelfCorrectionCause,
    forcedBand?: MovementCorrectionBandValue,
  ): void {
    this.errX = dx;
    this.errY = dy;
    const magnitudePx = Math.hypot(dx, dy);
    // A new named correction before a stale-resync glide has settled is evidence that the first target is
    // already obsolete. Do one honest resettle instead of stacking/chasing another visual glide.
    const resettleFastRecovery =
      cause !== undefined && this.fastStallRecoveryActive && this.correctionRemainingSec > 0;
    const band = resettleFastRecovery
      ? MovementCorrectionBand.Snap
      : forcedBand !== undefined && Number.isFinite(magnitudePx)
        ? forcedBand
        : movementCorrectionBand(magnitudePx);
    if (cause) this.reportSelfCorrection(magnitudePx, band, cause);
    if (band === MovementCorrectionBand.Smooth) {
      if (magnitudePx <= 1e-9) {
        this.errX = 0;
        this.errY = 0;
        this.correctionRemainingSec = 0;
        this.fastStallRecoveryActive = false;
        return;
      }
      if (cause === "stall-resync") {
        this.correctionRemainingSec = SELF_STALL_RECOVERY_MS / 1000;
        this.fastStallRecoveryActive = true;
      } else if (this.correctionRemainingSec <= 0) {
        this.correctionRemainingSec = MOVEMENT_CORRECTION_SMOOTH_MAX_MS / 1000;
        this.fastStallRecoveryActive = false;
      }
      return;
    }
    this.errX = 0;
    this.errY = 0;
    this.correctionRemainingSec = 0;
    this.fastStallRecoveryActive = false;
    this.presentationSnapPending = true;
  }

  reconcile(server: ServerView): void {
    this.attackMoveMode = server.attackMoveMode ?? PlayerAttackMoveMode.Normal;
    const teleported = server.teleportSeq !== this.lastTeleportSeq;
    const relaxedAuthority =
      server.movementCorrectionSeq !== undefined &&
      server.serverMotionEpoch !== undefined &&
      server.serverMotionActive !== undefined;
    const correctionChanged =
      server.movementCorrectionSeq !== undefined &&
      server.movementCorrectionSeq !== this.lastMovementCorrectionSeq;
    const serverMotionChanged =
      server.serverMotionEpoch !== undefined &&
      server.serverMotionEpoch !== this.lastServerMotionEpoch;
    const correctionRequested =
      !relaxedAuthority || (correctionChanged && !serverMotionChanged && !teleported);
    if (relaxedAuthority && (correctionChanged || serverMotionChanged || teleported))
      this.selfCorrectionCount++;
    this.lastTeleportSeq = server.teleportSeq;
    this.lastMovementCorrectionSeq = server.movementCorrectionSeq ?? this.lastMovementCorrectionSeq;
    this.lastServerMotionEpoch = server.serverMotionEpoch ?? this.lastServerMotionEpoch;
    const stanceSeq = server.stanceSeq ?? 0;
    const stanceChanged = stanceSeq !== this.lastStanceSeq;
    this.lastStanceSeq = stanceSeq;
    const pauseNow = !server.alive;

    // Trim everything the server has consumed — WRAP-AWARE (uint32 delta space, matching the server's
    // monotonic gate): `seq ≤ ack` ⇔ the uint32 forward distance from seq to ack is < 2³¹.
    const acked = (s: number) => (server.ackSeq - s) >>> 0 < 0x80000000;
    let acknowledgedSlideEdge = false;
    while (this.pending.length > 0 && acked((this.pending[0] as PredCmd).seq)) {
      const consumed = this.pending.shift();
      if (consumed?.slide) acknowledgedSlideEdge = true;
    }
    const slideDenied =
      acknowledgedSlideEdge &&
      (server.moveStance ?? STANCE_NONE) !== STANCE_SLIDE &&
      (server.slidePhase ?? SLIDE_PHASE_OFF) === SLIDE_PHASE_OFF;
    const slideAuthorityEnded =
      this.stance.stance === STANCE_SLIDE &&
      (server.moveStance ?? STANCE_NONE) !== STANCE_SLIDE &&
      (server.slidePhase ?? SLIDE_PHASE_OFF) === SLIDE_PHASE_OFF &&
      !this.pending.some((cmd) => cmd.slide === true);

    if (stanceChanged || slideDenied) {
      // A force-cancel is a mode correction, not a teleport: adopt the wire stance and make replay unable
      // to resurrect it, while the position residual below keeps its ordinary glide treatment.
      this.suppressCrouchUntilRelease =
        this.stance.crouchPrevHeld || this.pending.some((cmd) => cmd.crouchHeld === true);
      this.suppressSlideUntilRelease =
        this.stance.slidePrevHeld ||
        this.pending.some((cmd) => cmd.slideHeld === true) ||
        slideDenied;
      this.stance = this.stanceFromServer(server);
      this.stance.slidePrevHeld = false;
      this.stripPendingStanceBits(this.stance);
    }

    // Where the player is DRAWN right now (pred + offset) — corrections preserve this, then glide.
    const visX = this.pred.x + this.errX;
    const visY = this.pred.y + this.errY;

    if (teleported) {
      this.reportSelfCorrection(
        Math.hypot(visX - server.x, visY - server.y),
        MovementCorrectionBand.Snap,
        "teleport",
      );
    }

    if (serverMotionChanged || teleported) {
      // Server-owned placements/motion are authoritative cuts, not client-error corrections. Retire any
      // older smooth debt without routing the authored displacement through the correction bands.
      this.errX = 0;
      this.errY = 0;
      this.correctionRemainingSec = 0;
      this.fastStallRecoveryActive = false;
      this.presentationSnapPending = true;
    }

    // REBASE from synced truth (tick-locked: this is the state of the tick that consumed ackSeq).
    this.pred = {
      x: server.x,
      y: server.y,
      mvx: server.mvx,
      mvy: server.mvy,
      vx: server.vx,
      vy: server.vy,
      momentumX: server.momentumX ?? 0,
      momentumY: server.momentumY ?? 0,
    };
    sanitizePredMomentum(this.pred, this.relics);

    if (teleported || this.needResync || pauseNow || this.paused) {
      // Replay-reset family — but the error-offset treatment differs by CAUSE:
      // - a TELEPORT SNAPS (a rift/pit/restart is an authored cut): err = 0;
      // - a stale SELF prediction rebase preserves the visible position and recovers through Smooth;
      // - ENTERING a downed pause FOLDS the visual lead into the offset so the rig
      //   GLIDES back instead of popping backward by ~RTT×speed;
      // - mid-freeze reconciles PRESERVE the decaying offset (re-zeroing would undo the fold).
      const enteringPause = pauseNow && !this.paused;
      if (teleported) {
        this.errX = 0;
        this.errY = 0;
        this.correctionRemainingSec = 0;
        this.fastStallRecoveryActive = false;
        this.presentationSnapPending = true;
      } else if (this.needResync) {
        // L10: a frame/pending stall is stale prediction, never a server-authored placement. Rebase
        // simulation now, but force the SELF presentation residual through the existing Smooth window
        // even when its magnitude would ordinarily classify as Snap.
        this.applyMovementCorrection(
          visX - server.x,
          visY - server.y,
          "stall-resync",
          MovementCorrectionBand.Smooth,
        );
      } else if (correctionRequested) {
        this.applyMovementCorrection(visX - server.x, visY - server.y, "envelope-violation");
      } else if (enteringPause) {
        this.applyMovementCorrection(visX - server.x, visY - server.y);
      }
      // else: staying paused / resuming — keep the (already-decayed) offset as-is.
      this.pending.length = 0;
      this.needResync = false;
      this.stalled = false; // truth arrived — the stall (if any) is over
      this.height = server.height;
      this.vh = server.vh;
      this.airJumpsRemaining = Math.max(
        0,
        Math.floor(server.airJumpsRemaining ?? this.airJumpsRemaining),
      );
      this.jumpBuf = 0;
      this.stance = this.stanceFromServer(server);
      this.paused = pauseNow;
      return;
    }

    // REPLAY the still-pending window (exact 50ms steps — the server integrates the same way).
    // Vertical starts at the acked authoritative height/vh, not the already-predicted tip of the arc:
    // otherwise a normal pre-jump patch sees the first ~15px hop as divergence and eats it.
    const replayVert: PredVerticalState = {
      height: server.height,
      vh: server.vh,
      jumpCd: this.pending[0]?.jumpCdBefore ?? this.jumpCd,
      jumpBuf: this.pending[0]?.jumpBufBefore ?? this.jumpBuf,
      airJumpsRemaining:
        this.pending[0]?.airJumpsBefore ?? server.airJumpsRemaining ?? this.airJumpsRemaining,
    };
    let replayStance = this.stanceFromPending(this.pending[0]);
    if (
      (server.moveStance ?? STANCE_NONE) === STANCE_SLIDE ||
      slideDenied ||
      slideAuthorityEnded ||
      (this.pending.length === 0 && replayStance.stance !== (server.moveStance ?? STANCE_NONE))
    )
      replayStance = this.stanceFromServer(server);
    for (const cmd of this.pending) {
      this.pred = stepPredictionTick(
        this.pred,
        replayVert,
        replayStance,
        cmd,
        this.relics,
        DT,
        this.attackMoveMode,
        cmd.moveSpeedMultiplierBefore,
        cmd.continuousRecoilXBefore,
        cmd.continuousRecoilYBefore,
        this.indicatorScratch,
        this.map,
        this.belt,
        cmd.beltLockXBefore,
        cmd.inputSamples,
      );
    }

    // Fold the correction into the error offset so it GLIDES out; teleport-sized error snaps.
    const correctionX = visX - this.pred.x;
    const correctionY = visY - this.pred.y;
    if (correctionRequested) {
      this.applyMovementCorrection(correctionX, correctionY, "envelope-violation");
    }

    // Vertical: only a residual AFTER authoritative rebase + pending replay is real divergence (a denied
    // jump / an unpredicted launch). Adopt the replayed present, never the older acked-tick height.
    if (Math.abs(replayVert.height - this.height) > HEIGHT_ADOPT_PX) {
      this.height = replayVert.height;
      this.vh = replayVert.vh;
    }
    this.jumpCd = replayVert.jumpCd;
    this.jumpBuf = replayVert.jumpBuf;
    this.airJumpsRemaining = replayVert.airJumpsRemaining;
    this.stance = replayStance;
  }

  /** Fold an external visual displacement into the error offset so it GLIDES out instead of popping —
   *  used when a hit-stop freeze lifts (the predictor kept ticking; the rig didn't move — review #11). */
  foldError(dx: number, dy: number): void {
    this.applyMovementCorrection(this.errX + dx, this.errY + dy);
  }

  /** Retire medium correction debt on a strict wall-clock deadline. */
  decayError(dtSec: number, _dx = 0, _dy = 0): void {
    const dt = Math.min(Math.max(dtSec, 0), 0.25);
    if (dt <= 0 || Math.abs(this.errX) + Math.abs(this.errY) <= 0) return;
    if (this.correctionRemainingSec <= 1e-9 || dt + 1e-9 >= this.correctionRemainingSec) {
      this.errX = 0;
      this.errY = 0;
      this.correctionRemainingSec = 0;
      this.fastStallRecoveryActive = false;
      this.presentationSnapPending = true;
      return;
    }
    const remainingFraction = 1 - dt / this.correctionRemainingSec;
    this.errX *= remainingFraction;
    this.errY *= remainingFraction;
    this.correctionRemainingSec -= dt;
  }

  /**
   * The position to DRAW this frame: the last predicted tick advanced through the retained frame-rate
   * input slices for the pending window. Recomputing those slices from `pred` keeps the preview pure while
   * preserving every sub-tick direction change; callers without sampled slices retain the legacy single
   * partial-step path. The decaying correction offset is presentation-only.
   */
  renderPos(
    dx: number,
    dy: number,
    sinceTickSec: number,
  ): {
    x: number;
    y: number;
    height: number;
    vh: number;
    stance: MoveStance;
    slidePhase: SlidePhase;
    slideTick: number;
  } {
    if (this.paused || this.stalled) {
      // Downed or stalled: hold at server truth PLUS the decaying offset — the
      // pause-entry fold (amendment #14) glides the pre-pause visual lead out
      // instead of snapping the rig backward by ~RTT×speed.
      return {
        x: this.pred.x + this.errX,
        y: this.pred.y + this.errY,
        height: this.height,
        vh: this.vh,
        stance: this.stance.stance,
        slidePhase: this.stance.slidePhase,
        slideTick: this.stance.slidePhaseTick,
      };
    }
    const hasFrameSamples = this.inputSamples.length > 0;
    const frac = hasFrameSamples
      ? Math.min(Math.max(this.inputSampleSeconds, 0), DT)
      : Math.min(Math.max(sinceTickSec, 0), DT);
    this.previewCmd.dx = dx;
    this.previewCmd.dy = dy;
    let p = this.pred;
    if (frac > 0) {
      // Preview may sample steering, but it must never mutate the committed dash heading.
      const previewStance = this.previewStance;
      this.copyStance(previewStance, this.stance);
      const previewPred = this.previewPred;
      previewPred.x = this.pred.x;
      previewPred.y = this.pred.y;
      previewPred.mvx = this.pred.mvx;
      previewPred.mvy = this.pred.mvy;
      previewPred.vx = this.pred.vx;
      previewPred.vy = this.pred.vy;
      previewPred.momentumX = this.pred.momentumX;
      previewPred.momentumY = this.pred.momentumY;
      p =
        hasFrameSamples && previewStance.stance === STANCE_NONE && previewStance.recoveryT <= 0
          ? stepAliasedInputHorizontal(
              previewPred,
              this.inputSamples,
              this.relics,
              frac,
              this.attackMoveMode,
              this.moveSpeedMultiplier,
              this.belt,
              this.beltLockX,
            )
          : stepStanceHorizontal(
              previewPred,
              previewStance,
              this.previewCmd,
              this.relics,
              frac,
              this.attackMoveMode,
              this.moveSpeedMultiplier,
              this.belt,
              this.beltLockX,
            );
    }
    let height = this.height;
    let vh = this.vh;
    if (frac > 0) {
      if (this.stance.stance === STANCE_POUND) {
        if (this.stance.poundGatherT <= 0) {
          height = Math.max(0, height - POUND_SPEED * frac);
          vh = height > 0 ? -POUND_SPEED : 0;
        }
      } else {
        const vert = stepVertical(height, vh, frac);
        height = vert.height;
        vh = vert.vh;
      }
    }
    return {
      x: p.x + this.errX,
      y: p.y + this.errY,
      height,
      vh,
      stance: this.stance.stance,
      slidePhase: this.stance.slidePhase,
      slideTick: this.stance.slidePhaseTick,
    };
  }

  /**
   * Bound a locomotion-only owner presentation to the frame-current authority row. Ordinary prediction
   * lead remains untouched inside the radius. Excess stale reconciliation debt is retired from the visual
   * offset at the same time, so repeated direction changes cannot leave the rig orbiting an old lane.
   * Simulation position and pending input replay are never clamped or rewritten here.
   */
  boundLocomotionPresentation(
    authorityX: number,
    authorityY: number,
    candidateX: number,
    candidateY: number,
  ): { x: number; y: number } {
    const out = this.authorityBoundRenderPos;
    out.x = candidateX;
    out.y = candidateY;
    if (this.correctionRemainingSec > 0) return out;
    const dx = candidateX - authorityX;
    const dy = candidateY - authorityY;
    const distance = Math.hypot(dx, dy);
    if (distance <= LOCOMOTION_ONLY_AUTHORITY_RADIUS_PX || distance <= 1e-4) return out;
    const scale = LOCOMOTION_ONLY_AUTHORITY_RADIUS_PX / distance;
    out.x = authorityX + dx * scale;
    out.y = authorityY + dy * scale;
    this.errX += out.x - candidateX;
    this.errY += out.y - candidateY;
    return out;
  }

  /** Final owner-presentation gate for ordinary grounded steering. Reconciliation may leave a large
   *  decaying offset whose desired correction points across the freshly commanded heading; keep that
   *  visual step in a narrow forward cone and fold the withheld displacement back into the offset for
   *  later frames. Explicit teleport/hard-snap edges bypass this exactly once. */
  constrainRenderStep(
    previousX: number,
    previousY: number,
    candidateX: number,
    candidateY: number,
    dx: number,
    dy: number,
    enabled = true,
    foldWithheldDisplacement = true,
  ): { x: number; y: number } {
    const out = this.constrainedRenderPos;
    out.x = candidateX;
    out.y = candidateY;
    if (this.presentationSnapPending) {
      this.presentationSnapPending = false;
      return out;
    }
    if (!enabled || this.paused || this.stalled) return out;
    const inputLength = Math.hypot(dx, dy);
    const stepX = candidateX - previousX;
    const stepY = candidateY - previousY;
    const stepLength = Math.hypot(stepX, stepY);
    if (inputLength <= 1e-4 || stepLength <= 0.3) return out;

    const commandAngle = Math.atan2(dy, dx);
    const stepAngle = Math.atan2(stepY, stepX);
    const delta = shortestAngleDelta(commandAngle, stepAngle);
    if (Math.abs(delta) <= PRED_PRESENT_MAX_COMMAND_DELTA) return out;
    const constrainedAngle =
      commandAngle +
      Math.max(-PRED_PRESENT_MAX_COMMAND_DELTA, Math.min(PRED_PRESENT_MAX_COMMAND_DELTA, delta));
    out.x = previousX + Math.cos(constrainedAngle) * stepLength;
    out.y = previousY + Math.sin(constrainedAngle) * stepLength;
    if (foldWithheldDisplacement) this.foldError(out.x - candidateX, out.y - candidateY);
    return out;
  }

  /** Frame-fresh input routing seam: airborne Space becomes pound without waiting for a patch. */
  get isAirborne(): boolean {
    return this.height > GROUND_EPSILON;
  }

  get moveStance(): MoveStance {
    return this.stance.stance;
  }

  /** Frame-fresh fixed-roll admission. No run-up, held-chain, or airborne continuation exists. */
  get canSlide(): boolean {
    return (
      !this.paused &&
      !this.stalled &&
      this.height <= GROUND_EPSILON &&
      this.stance.stance === STANCE_NONE &&
      this.stance.recoveryT <= 0 &&
      this.stance.rollCd <= 0
    );
  }

  get isGroundSliding(): boolean {
    return this.stance.stance === STANCE_SLIDE && this.stance.slidePhase === SLIDE_PHASE_GROUND;
  }

  get slideInvulnerable(): boolean {
    return slideContactInvulnerable(
      this.stance.stance,
      this.stance.slidePhase,
      this.stance.slidePhaseTick,
    );
  }

  get slideCooldownRemaining(): number {
    return this.stance.rollCd;
  }

  get slideParryLocked(): boolean {
    return this.stance.slideParryLockT > 0;
  }

  get slideAttackLocked(): boolean {
    return (
      this.stance.stance === STANCE_SLIDE &&
      this.stance.slidePhaseTick * DT + 1e-9 < ROLL_ATTACK_CANCEL_SECONDS
    );
  }

  get momentumSpeed(): number {
    return Math.hypot(this.pred.momentumX, this.pred.momentumY);
  }

  /** Write the truthful local crouch target into caller-owned storage; false means no usable heading. */
  writeDistanceJumpIndicator(
    out: DistanceJumpIndicator,
    dx: number,
    dy: number,
    aimX: number,
    aimY: number,
  ): boolean {
    let fallbackX = this.stance.crouchAimX;
    let fallbackY = this.stance.crouchAimY;
    if (Math.hypot(fallbackX, fallbackY) <= 1e-4) {
      if (Math.hypot(aimX, aimY) > 1e-4) {
        fallbackX = aimX;
        fallbackY = aimY;
      } else {
        fallbackX = this.stance.aimX;
        fallbackY = this.stance.aimY;
      }
    }
    return writeDistanceJumpIndicator(
      out,
      this.pred.x + this.errX,
      this.pred.y + this.errY,
      dx,
      dy,
      fallbackX,
      fallbackY,
      this.map,
      this.belt,
    );
  }

  /** Mark replay stale after a >250ms frame gap. The next patch rebases simulation immediately but
   * L10 keeps the current SELF presentation and retires the displacement through Smooth. */
  forceResync(): void {
    this.resetInputFrameWindow();
    this.needResync = true;
  }

  /** True while SELF correction debt is being retired through the canonical Smooth window. */
  get isSmoothingCorrection(): boolean {
    return this.correctionRemainingSec > 0;
  }

  /** True only for L10's short stale-resync recovery, never for ordinary B42 Smooth corrections. */
  get isFastStallRecovery(): boolean {
    return this.fastStallRecoveryActive && this.correctionRemainingSec > 0;
  }

  /** True while prediction is paused (dead / level-window freeze) — the scene renders server truth. */
  get isPaused(): boolean {
    return this.paused;
  }

  /** True while the connection has stalled (pending overflow, no ack) — the scene shows a lag hint. */
  get isStalled(): boolean {
    return this.stalled;
  }

  /** Diagnostics for the debug HUD + B42 live verification. */
  get stats(): {
    pending: number;
    errPx: number;
    selfCorrections: number;
    correctionRemainingMs: number;
  } {
    return {
      pending: this.pending.length,
      errPx: Math.hypot(this.errX, this.errY),
      selfCorrections: this.selfCorrectionCount,
      correctionRemainingMs: this.correctionRemainingSec * 1000,
    };
  }
}
