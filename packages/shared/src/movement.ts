import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  GRAVITY_APEX,
  GRAVITY_APEX_BAND,
  GRAVITY_FALL,
  GRAVITY_RISE,
  GROUND_EPSILON,
  IMPULSE_EPSILON,
  IMPULSE_FRICTION,
  IMPULSE_MAX,
  LANDING_HEAVY_MIN_SPEED,
  LANDING_HORIZONTAL_WEIGHT,
  LANDING_SOLID_MIN_SPEED,
  LANDING_TIER_HEAVY,
  LANDING_TIER_SOFT,
  LANDING_TIER_SOLID,
  type LandingThumpTier,
  MOVE_HITCH_DIP,
  MOVE_HITCH_MIN_ANGLE,
  MOVE_HITCH_MIN_SPEED,
  MOVE_RECOVER_ACCEL,
  MOVE_ROTATION_RADIANS_PER_SECOND,
  MOVE_ROTATION_REARM_TICKS,
  MOVE_ROTATION_SPEED_RESERVE,
  MOVE_SPEED,
  MOVE_STOP_DECEL,
  PLAYER_RADIUS,
  POUND_DAMAGE_BASE,
  POUND_DAMAGE_CAP,
  POUND_DAMAGE_PER_HEIGHT,
  SLIDE_AIR_STEER_RADIANS_PER_SECOND,
  SLIDE_GROUND_DECAY,
  SLIDE_GROUND_STEER_RADIANS_PER_SECOND,
  SLIDE_HOP_RETENTION,
  SLIDE_LANDING_KICK,
  SLIDE_LANDING_RETENTION,
  SLIDE_SPEED_CAP,
  VERTICAL_PHASE_APEX,
  VERTICAL_PHASE_FALLING,
  VERTICAL_PHASE_GROUNDED,
  VERTICAL_PHASE_RISING,
  type VerticalPhase,
} from "./constants.js";
import { clamp } from "./math.js";

export interface Vec2 {
  x: number;
  y: number;
}

/** Intended movement direction from a player's input (not necessarily normalized). */
export interface MoveInput {
  dx: number;
  dy: number;
}

/**
 * Authoritative player movement step — PURE and deterministic given (pos, input, dt).
 *
 * This is the single source of truth for movement (§26 retro #3): the server runs it
 * every tick, and client-side prediction will run the SAME function later so the two
 * cannot diverge. Keep it free of side effects and engine/network types.
 *
 * Diagonal input is clamped to magnitude 1 — this both removes the diagonal speed bonus
 * and enforces the §7 "flat move speed" law, doubling as a §4 light anti-cheat check
 * (a client cannot request a faster-than-MOVE_SPEED step).
 */
export function stepPlayerMovement(
  pos: Vec2,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
): Vec2 {
  let dx = input.dx;
  let dy = input.dy;

  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }

  let x = pos.x + dx * speed * dtSeconds;
  let y = pos.y + dy * speed * dtSeconds;

  // §4 light server sanity check: clamp position to arena bounds.
  x = clamp(x, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
  y = clamp(y, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);

  return { x, y };
}

/** §20 momentum layer (Stage A). An impulse velocity that shoves the body. */
export interface Impulse {
  vx: number;
  vy: number;
}

/**
 * §7 v0.118 PIVOT or CARVE the movement velocity toward input. A deliberate sharp pivot stays DIRECT:
 * heading snaps on that tick and the v0.111 hitch dips `1 − t·MOVE_HITCH_DIP` exactly as before (t = 0 at
 * MOVE_HITCH_MIN_ANGLE → 1 at a 180° reversal). A continuing turn is not another pivot. Its heading advances
 * at MOVE_ROTATION_RADIANS_PER_SECOND and cannot strobe the hitch as eight-way input walks around its 45°
 * facets. Hysteresis lives inside the already-synced velocity magnitude: 0.001 px/s reserve quanta remember
 * carve direction and require four aligned ticks before re-arming, below any visible/gameplay-significant
 * speed change. A fresh 90°/180° attack-the-other-way still takes the direct hitch branch; the entry band only
 * catches a small turn plus one bounded carve step. Released input still stops under MOVE_STOP_DECEL. PURE +
 * deterministic, zero added state/allocation; authority and prediction share it.
 */
export function steerVelocity(
  vel: Impulse,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
): Impulse {
  const dx = input.dx;
  const dy = input.dy;
  const inLen = Math.hypot(dx, dy);
  const curSpeed = Math.hypot(vel.vx, vel.vy);

  // No input → crisp decel to a stop along the current heading (no ice-skating).
  if (inLen < 1e-4) {
    const ns = curSpeed - MOVE_STOP_DECEL * dtSeconds;
    if (ns <= 1 || curSpeed < 1e-4) return { vx: 0, vy: 0 };
    return { vx: (vel.vx / curSpeed) * ns, vy: (vel.vy / curSpeed) * ns };
  }

  // Desired heading (unit). Input magnitude is clamped ≤1 for the flat-speed / anti-cheat posture; a
  // deliberate pivot takes this direction immediately, while an active carve approaches it at the cap.
  const inx = dx / inLen;
  const iny = dy / inLen;

  if (curSpeed > MOVE_HITCH_MIN_SPEED) {
    const currentHeading = Math.atan2(vel.vy, vel.vx);
    const inputHeading = Math.atan2(iny, inx);
    let shortest = (inputHeading - currentHeading + Math.PI) % (Math.PI * 2);
    if (shortest < 0) shortest += Math.PI * 2;
    shortest -= Math.PI;
    const angle = Math.abs(shortest);
    const maxTurn = MOVE_ROTATION_RADIANS_PER_SECOND * Math.max(0, dtSeconds);
    const reserve = MOVE_ROTATION_SPEED_RESERVE;
    const markerTolerance = reserve * 0.2;
    const markerUnits = Math.round((speed - curSpeed) / reserve);
    const markerMatches =
      markerUnits >= 1 &&
      markerUnits <= MOVE_ROTATION_REARM_TICKS * 2 &&
      Math.abs(curSpeed - (speed - markerUnits * reserve)) <= markerTolerance;
    let rotationDirection = 0;
    let rearmTicks = 0;
    if (markerMatches) {
      if (markerUnits <= MOVE_ROTATION_REARM_TICKS) {
        rotationDirection = 1;
        rearmTicks = markerUnits;
      } else {
        rotationDirection = -1;
        rearmTicks = markerUnits - MOVE_ROTATION_REARM_TICKS;
      }
    }

    // A just-fired hitch is the cooldown half of the hysteresis. If input keeps rotating before recovery,
    // carve from the dipped heading instead of treating the next facet as another independent pivot.
    const hitchCooldown =
      curSpeed >= speed * (1 - MOVE_HITCH_DIP) - markerTolerance && curSpeed < speed - 1e-9;
    const rotationEntryAngle = Math.min(Math.PI / 2 - 1e-9, MOVE_HITCH_MIN_ANGLE + maxTurn);
    const enteringRotation = angle > 1e-9 && angle <= rotationEntryAngle;

    if (rotationDirection !== 0 || hitchCooldown || enteringRotation) {
      if (angle <= 1e-9) {
        if (rotationDirection !== 0 && rearmTicks > 1) {
          const nextRearmTicks = rearmTicks - 1;
          const markerOffset =
            rotationDirection > 0 ? nextRearmTicks : MOVE_ROTATION_REARM_TICKS + nextRearmTicks;
          const ns = speed - markerOffset * reserve;
          return { vx: inx * ns, vy: iny * ns };
        }
        const ns = Math.min(speed, curSpeed + MOVE_RECOVER_ACCEL * dtSeconds);
        return { vx: inx * ns, vy: iny * ns };
      }
      if (rotationDirection === 0) rotationDirection = shortest >= 0 ? 1 : -1;

      // Follow the remembered rotation direction even when very fast input laps the bounded heading. Using
      // the ordinary shortest arc there would flip sign past 180° and make the supposedly smooth circle jerk.
      let directedRemaining =
        rotationDirection > 0 ? inputHeading - currentHeading : currentHeading - inputHeading;
      directedRemaining %= Math.PI * 2;
      if (directedRemaining < 0) directedRemaining += Math.PI * 2;
      const turn = Math.min(directedRemaining, maxTurn);
      const nextHeading = currentHeading + rotationDirection * turn;
      const markerOffset =
        rotationDirection > 0 ? MOVE_ROTATION_REARM_TICKS : MOVE_ROTATION_REARM_TICKS * 2;
      const markerSpeed = speed - markerOffset * reserve;
      const ns = Math.min(markerSpeed, curSpeed + MOVE_RECOVER_ACCEL * dtSeconds);
      return { vx: Math.cos(nextHeading) * ns, vy: Math.sin(nextHeading) * ns };
    }
  }

  // TURN-HITCH: a sharp change vs the current heading dips the speed once (the "stop"). Skipped from ~rest
  // (nothing to pivot from) — that just spins up via the recover path below.
  if (curSpeed > MOVE_HITCH_MIN_SPEED) {
    const vdx = vel.vx / curSpeed;
    const vdy = vel.vy / curSpeed;
    const dot = clamp(vdx * inx + vdy * iny, -1, 1);
    const ang = Math.acos(dot); // 0 (same way) … π (full reversal)
    if (ang > MOVE_HITCH_MIN_ANGLE) {
      const t = clamp((ang - MOVE_HITCH_MIN_ANGLE) / (Math.PI - MOVE_HITCH_MIN_ANGLE), 0, 1);
      const dipped = speed * (1 - t * MOVE_HITCH_DIP);
      // snap the heading + dip the speed (but never SPEED UP on the turn tick).
      const ns = Math.min(curSpeed, dipped);
      return { vx: inx * ns, vy: iny * ns };
    }
  }

  // Aligned / spin-up-from-rest → recover toward top speed (the "go"), heading = input.
  const ns = Math.min(speed, curSpeed + MOVE_RECOVER_ACCEL * dtSeconds);
  return { vx: inx * ns, vy: iny * ns };
}

/**
 * §7 v0.105 one STEERED movement step: steer the velocity toward the input, integrate it, clamp to the
 * arena. The server's authoritative movement (replacing the old instant-velocity step); returns the new
 * velocity so the caller persists it per player. Same anti-cheat posture as before — the input magnitude
 * is clamped inside `steerVelocity` and the speed ceiling is hard. PURE.
 */
export function stepSteeredMovement(
  pos: Vec2,
  vel: Impulse,
  input: MoveInput,
  dtSeconds: number,
  speed: number = MOVE_SPEED,
  yMin: number = PLAYER_RADIUS,
  yMax: number = ARENA_HEIGHT - PLAYER_RADIUS,
): { x: number; y: number; vx: number; vy: number } {
  // §29 belt mode passes a shallow [yMin, yMax] DEPTH BAND instead of the full arena, so the same movement
  // sim confines players to the belt band; both the server and the client predictor pass identical bounds.
  const v = steerVelocity(vel, input, dtSeconds, speed);
  return {
    x: clamp(pos.x + v.vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS),
    y: clamp(pos.y + v.vy * dtSeconds, yMin, yMax),
    vx: v.vx,
    vy: v.vy,
  };
}

/**
 * Integrate an impulse shove into a position then decay it under exponential friction — PURE + deterministic.
 * The authoritative player position = the WASD base (`stepPlayerMovement`) PLUS this offset, so recoil /
 * knockback / (later) parry-launch read as weight without breaking input control. Clamps to the arena;
 * snaps sub-`IMPULSE_EPSILON` residuals to 0 so the shove fully settles. Same fn server + (future) client
 * prediction so the two can't diverge.
 */
export function stepImpulse(
  pos: Vec2,
  vel: Impulse,
  dtSeconds: number,
): { x: number; y: number; vx: number; vy: number } {
  const x = clamp(pos.x + vel.vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS);
  const y = clamp(pos.y + vel.vy * dtSeconds, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS);
  const decay = Math.exp(-IMPULSE_FRICTION * dtSeconds); // frame-rate-independent friction
  let vx = vel.vx * decay;
  let vy = vel.vy * decay;
  if (Math.abs(vx) < IMPULSE_EPSILON) vx = 0;
  if (Math.abs(vy) < IMPULSE_EPSILON) vy = 0;
  return { x, y, vx, vy };
}

/** Add an impulse to a velocity, capped at `IMPULSE_MAX` so a rapid-fire stream / pile-up can't fling a
 *  body across the arena. PURE. */
export function addImpulse(vel: Impulse, ix: number, iy: number): Impulse {
  let vx = vel.vx + ix;
  let vy = vel.vy + iy;
  const sp = Math.hypot(vx, vy);
  if (sp > IMPULSE_MAX) {
    vx = (vx / sp) * IMPULSE_MAX;
    vy = (vy / sp) * IMPULSE_MAX;
  }
  return { vx, vy };
}

/**
 * §5/§20 vertical physics (Stage B) — integrate a HEIGHT (px above ground) under an upward velocity `vh`
 * and gravity, landing (snap to 0) when it returns to the floor. PURE + deterministic. The jump seeds `vh`
 * with `JUMP_VELOCITY`; the later §8 parry-launch adds to it, so a chain of incoming hits can loft a player
 * higher and gravity reclaims them when it stops. `height > GROUND_EPSILON` = airborne (clears §17 pits).
 */
export function stepVertical(
  height: number,
  vh: number,
  dtSeconds: number,
): { height: number; vh: number } {
  let h = Math.max(0, height);
  let v = vh;
  let remaining = Math.max(0, dtSeconds);

  // Exact constant-acceleration slices end at the tick, a gravity-zone boundary, or ground contact.
  for (let slice = 0; slice < 4 && remaining > 1e-9; slice++) {
    const gravity = verticalGravity(v);
    let boundarySeconds = Number.POSITIVE_INFINITY;
    let boundaryVelocity = v;
    if (v > GRAVITY_APEX_BAND) {
      boundarySeconds = (v - GRAVITY_APEX_BAND) / gravity;
      boundaryVelocity = GRAVITY_APEX_BAND;
    } else if (v > -GRAVITY_APEX_BAND) {
      boundarySeconds = (v + GRAVITY_APEX_BAND) / gravity;
      boundaryVelocity = -GRAVITY_APEX_BAND;
    }

    const stepSeconds = Math.min(remaining, boundarySeconds);
    const landingSeconds = (v + Math.sqrt(Math.max(0, v * v + 2 * gravity * h))) / gravity;
    if (landingSeconds <= stepSeconds + 1e-9) return { height: 0, vh: 0 };

    h += v * stepSeconds - 0.5 * gravity * stepSeconds * stepSeconds;
    v -= gravity * stepSeconds;
    remaining -= stepSeconds;
    if (boundarySeconds <= stepSeconds + 1e-9) v = boundaryVelocity;
  }

  if (h <= 0) return { height: 0, vh: 0 };
  return { height: h, vh: v };
}

/** The authored three-zone gravity profile, shared by authority, prediction, and analytic tests. */
export function verticalGravity(vh: number): number {
  if (vh > GRAVITY_APEX_BAND) return GRAVITY_RISE;
  if (vh <= -GRAVITY_APEX_BAND) return GRAVITY_FALL;
  return GRAVITY_APEX;
}

/** Normal grounded/rise/apex/fall pose, derived from the already-synced height/vh channels. */
export function verticalPhase(height: number, vh: number): VerticalPhase {
  if (height <= GROUND_EPSILON) return VERTICAL_PHASE_GROUNDED;
  if (vh > GRAVITY_APEX_BAND) return VERTICAL_PHASE_RISING;
  if (vh <= -GRAVITY_APEX_BAND) return VERTICAL_PHASE_FALLING;
  return VERTICAL_PHASE_APEX;
}

/** Exact continuous time until ground contact under the same piecewise profile as `stepVertical`. */
export function verticalTimeToGround(height: number, vh: number): number {
  let h = Math.max(0, height);
  let v = vh;
  let elapsed = 0;
  if (h <= 0 && v <= 0) return 0;

  for (let slice = 0; slice < 4; slice++) {
    const gravity = verticalGravity(v);
    let boundarySeconds = Number.POSITIVE_INFINITY;
    let boundaryVelocity = v;
    if (v > GRAVITY_APEX_BAND) {
      boundarySeconds = (v - GRAVITY_APEX_BAND) / gravity;
      boundaryVelocity = GRAVITY_APEX_BAND;
    } else if (v > -GRAVITY_APEX_BAND) {
      boundarySeconds = (v + GRAVITY_APEX_BAND) / gravity;
      boundaryVelocity = -GRAVITY_APEX_BAND;
    }
    const landingSeconds = (v + Math.sqrt(Math.max(0, v * v + 2 * gravity * h))) / gravity;
    if (landingSeconds <= boundarySeconds + 1e-9) return elapsed + landingSeconds;
    h += v * boundarySeconds - 0.5 * gravity * boundarySeconds * boundarySeconds;
    v = boundaryVelocity;
    elapsed += boundarySeconds;
  }
  return elapsed;
}

/** Server/client landing payoff classification. Horizontal energy matters only for committed leaps. */
export function landingThumpTier(
  verticalSpeed: number,
  horizontalSpeed = 0,
  forceHeavy = false,
): LandingThumpTier {
  const effective = Math.abs(verticalSpeed) + Math.abs(horizontalSpeed) * LANDING_HORIZONTAL_WEIGHT;
  if (forceHeavy || effective > LANDING_HEAVY_MIN_SPEED) return LANDING_TIER_HEAVY;
  if (effective >= LANDING_SOLID_MIN_SPEED) return LANDING_TIER_SOLID;
  return LANDING_TIER_SOFT;
}

/** Height-priced pound damage captured at the trigger edge, never recomputed from later displacement. */
export function poundDamage(triggerHeight: number): number {
  return Math.min(
    POUND_DAMAGE_CAP,
    POUND_DAMAGE_BASE + POUND_DAMAGE_PER_HEIGHT * Math.max(0, triggerHeight),
  );
}

/** Hard anti-sprint/corruption ceiling for every player-authored slide assignment. */
export function clampSlideSpeed(speed: number): number {
  return Number.isFinite(speed) ? clamp(Math.max(0, speed), 0, SLIDE_SPEED_CAP) : 0;
}

/** Speed installed by one grounded integration. Decay happens after position consumes the current value. */
export function slideGroundNextSpeed(speed: number): number {
  return clampSlideSpeed(clampSlideSpeed(speed) * SLIDE_GROUND_DECAY);
}

/** One-time horizontal transfer at slide-hop liftoff. */
export function slideHopSpeed(speed: number): number {
  return clampSlideSpeed(clampSlideSpeed(speed) * SLIDE_HOP_RETENTION);
}

/** One-use landing retention plus scrape kick; this is the only renewable chain injection. */
export function slideLandingSpeed(landingSpeed: number): number {
  return clampSlideSpeed(
    clampSlideSpeed(landingSpeed) * SLIDE_LANDING_RETENTION + SLIDE_LANDING_KICK,
  );
}

/** Allocation-free bounded carve shared by authority and predictor. Aim never participates. */
export function slideSteeredAngle(
  currentX: number,
  currentY: number,
  inputX: number,
  inputY: number,
  dtSeconds: number,
  airborne: boolean,
): number {
  const current = Math.atan2(currentY, currentX);
  const inputLength = Math.hypot(inputX, inputY);
  if (inputLength <= 1e-4) return current;
  const desired = Math.atan2(inputY, inputX);
  let delta = (desired - current + Math.PI) % (Math.PI * 2);
  if (delta < 0) delta += Math.PI * 2;
  delta -= Math.PI;
  const maxStep =
    (airborne ? SLIDE_AIR_STEER_RADIANS_PER_SECOND : SLIDE_GROUND_STEER_RADIANS_PER_SECOND) *
    Math.max(0, dtSeconds);
  return current + clamp(delta, -maxStep, maxStep);
}
