import {
  CLIENT_MOVE_SPEED_TOLERANCE,
  MOVEMENT_CORRECTION_LARGE_PX,
  MOVEMENT_CORRECTION_SILENT_PX,
} from "./constants.js";

export const MovementEnvelopeReject = Object.freeze({
  None: 0,
  NonFinite: 1,
  MoveSpeed: 2,
  ImpulseSpeed: 3,
  TotalSpeed: 4,
  Continuity: 5,
  Navigation: 6,
} as const);

export type MovementEnvelopeRejectReason =
  (typeof MovementEnvelopeReject)[keyof typeof MovementEnvelopeReject];

export interface ClientMovementReport {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
  /** Last server ownership/correction epochs observed by the reporting client. */
  serverMotionEpoch?: number;
  movementCorrectionSeq?: number;
}

export interface MovementEnvelope {
  fromX: number;
  fromY: number;
  dtSeconds: number;
  maxMoveSpeed: number;
  maxImpulseSpeed: number;
  /** Authored root motion/knockback may widen continuity for its exact server-owned window. */
  authoredDisplacementPx?: number;
  speedTolerance?: number;
  positionTolerancePx?: number;
}

export interface MovementEnvelopeResult {
  accepted: boolean;
  reason: MovementEnvelopeRejectReason;
  displacementPx: number;
  moveSpeed: number;
  impulseSpeed: number;
  totalSpeed: number;
  maxDisplacementPx: number;
}

/** Pure numeric half of B42's self-movement plausibility gate. Navigation stays environment-specific on the
 * server, but all finite/speed/continuity math is shared and directly testable by both simulations. */
export function evaluateClientMovementEnvelope(
  report: Readonly<ClientMovementReport>,
  envelope: Readonly<MovementEnvelope>,
): MovementEnvelopeResult {
  const finite = [
    report.x,
    report.y,
    report.mvx,
    report.mvy,
    report.vx,
    report.vy,
    envelope.fromX,
    envelope.fromY,
    envelope.dtSeconds,
    envelope.maxMoveSpeed,
    envelope.maxImpulseSpeed,
    envelope.authoredDisplacementPx ?? 0,
  ].every(Number.isFinite);
  const displacementPx = Math.hypot(report.x - envelope.fromX, report.y - envelope.fromY);
  const moveSpeed = Math.hypot(report.mvx, report.mvy);
  const impulseSpeed = Math.hypot(report.vx, report.vy);
  const totalSpeed = Math.hypot(report.mvx + report.vx, report.mvy + report.vy);
  const speedTolerance = Math.max(0, envelope.speedTolerance ?? CLIENT_MOVE_SPEED_TOLERANCE);
  const maxMoveSpeed = Math.max(0, envelope.maxMoveSpeed);
  const maxImpulseSpeed = Math.max(0, envelope.maxImpulseSpeed);
  const maxDisplacementPx =
    (maxMoveSpeed + maxImpulseSpeed) * Math.max(0, envelope.dtSeconds) +
    Math.max(0, envelope.authoredDisplacementPx ?? 0) +
    Math.max(0, envelope.positionTolerancePx ?? MOVEMENT_CORRECTION_SILENT_PX);

  let reason: MovementEnvelopeRejectReason = MovementEnvelopeReject.None;
  if (!finite) reason = MovementEnvelopeReject.NonFinite;
  else if (moveSpeed > maxMoveSpeed + speedTolerance) reason = MovementEnvelopeReject.MoveSpeed;
  else if (impulseSpeed > maxImpulseSpeed + speedTolerance)
    reason = MovementEnvelopeReject.ImpulseSpeed;
  else if (totalSpeed > maxMoveSpeed + maxImpulseSpeed + speedTolerance)
    reason = MovementEnvelopeReject.TotalSpeed;
  else if (displacementPx > maxDisplacementPx) reason = MovementEnvelopeReject.Continuity;

  return {
    accepted: reason === MovementEnvelopeReject.None,
    reason,
    displacementPx,
    moveSpeed,
    impulseSpeed,
    totalSpeed,
    maxDisplacementPx,
  };
}

export const MovementCorrectionBand = Object.freeze({
  Silent: 0,
  Smooth: 1,
  Snap: 2,
} as const);

export type MovementCorrectionBandValue =
  (typeof MovementCorrectionBand)[keyof typeof MovementCorrectionBand];

/** One correction law for owners and spectated remotes. */
export function movementCorrectionBand(
  errorPx: number,
  largeThresholdPx = MOVEMENT_CORRECTION_LARGE_PX,
): MovementCorrectionBandValue {
  if (!Number.isFinite(errorPx) || errorPx >= Math.max(0, largeThresholdPx))
    return MovementCorrectionBand.Snap;
  if (errorPx < MOVEMENT_CORRECTION_SILENT_PX) return MovementCorrectionBand.Silent;
  return MovementCorrectionBand.Smooth;
}
