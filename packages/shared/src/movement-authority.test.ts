import { describe, expect, it } from "vitest";
import {
  clampPresentedSelfPosition,
  evaluateClientMovementEnvelope,
  MovementCorrectionBand,
  MovementEnvelopeReject,
  movementCorrectionBand,
} from "./movement-authority.js";

const baseline = {
  x: 1_016,
  y: 1_000,
  mvx: 320,
  mvy: 0,
  vx: 0,
  vy: 0,
};

const envelope = {
  fromX: 1_000,
  fromY: 1_000,
  dtSeconds: 0.05,
  maxMoveSpeed: 320,
  maxImpulseSpeed: 0,
};

describe("B42 client movement plausibility envelope", () => {
  it("accepts finite walk, dash/dodge, and authored-window reports at their explicit budgets", () => {
    expect(evaluateClientMovementEnvelope(baseline, envelope).accepted).toBe(true);
    expect(
      evaluateClientMovementEnvelope(
        { ...baseline, x: 1_034, mvx: 680 },
        { ...envelope, maxMoveSpeed: 680 },
      ).accepted,
    ).toBe(true);
    expect(
      evaluateClientMovementEnvelope(
        { ...baseline, x: 1_116, mvx: 320 },
        { ...envelope, authoredDisplacementPx: 100 },
      ).accepted,
    ).toBe(true);
    expect(
      evaluateClientMovementEnvelope(
        { ...baseline, x: 1_064, mvx: -320 },
        { ...envelope, clientCatchUpDisplacementPx: 48 },
      ).accepted,
    ).toBe(true);
  });

  it.each([
    {
      label: "NaN",
      report: { ...baseline, x: Number.NaN },
      reason: MovementEnvelopeReject.NonFinite,
    },
    {
      label: "infinity",
      report: { ...baseline, vy: Number.POSITIVE_INFINITY },
      reason: MovementEnvelopeReject.NonFinite,
    },
    {
      label: "move speed",
      report: { ...baseline, mvx: 400 },
      reason: MovementEnvelopeReject.MoveSpeed,
    },
    {
      label: "impulse speed",
      report: { ...baseline, vx: 100 },
      reason: MovementEnvelopeReject.ImpulseSpeed,
    },
    {
      label: "combined speed",
      report: { ...baseline, mvx: 344, vx: 44 },
      reason: MovementEnvelopeReject.TotalSpeed,
      customEnvelope: { ...envelope, maxImpulseSpeed: 20 },
    },
    {
      label: "continuity",
      report: { ...baseline, x: 1_040 },
      reason: MovementEnvelopeReject.Continuity,
    },
  ])("rejects $label violations", ({ report, reason, customEnvelope }) => {
    expect(evaluateClientMovementEnvelope(report, customEnvelope ?? envelope).reason).toBe(reason);
  });
});

describe("L11 presented-self B42 clamp", () => {
  it("keeps an in-envelope body exact and radially projects an outlier", () => {
    const presentedEnvelope = {
      fromX: 1_000,
      fromY: 2_000,
      dtSeconds: 0.05,
      maxMoveSpeed: 320,
      maxImpulseSpeed: 0,
      clientCatchUpDisplacementPx: 32,
    };
    expect(clampPresentedSelfPosition({ x: 1_049, y: 2_000 }, presentedEnvelope)).toEqual({
      x: 1_049,
      y: 2_000,
      clamped: false,
    });
    expect(clampPresentedSelfPosition({ x: 1_100, y: 2_000 }, presentedEnvelope)).toEqual({
      x: 1_051,
      y: 2_000,
      clamped: true,
    });
    expect(
      clampPresentedSelfPosition({ x: Number.NaN, y: 2_000 }, presentedEnvelope),
    ).toBeUndefined();
  });
});

describe("B42 correction bands", () => {
  it("classifies silent, capped-smooth, and large snap distances", () => {
    expect(movementCorrectionBand(2.999)).toBe(MovementCorrectionBand.Silent);
    expect(movementCorrectionBand(3)).toBe(MovementCorrectionBand.Smooth);
    expect(movementCorrectionBand(199.999)).toBe(MovementCorrectionBand.Smooth);
    expect(movementCorrectionBand(200)).toBe(MovementCorrectionBand.Snap);
    expect(movementCorrectionBand(Number.NaN)).toBe(MovementCorrectionBand.Snap);
  });
});
