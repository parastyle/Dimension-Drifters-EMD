import type {
  MeleeComboHand,
  MeleeComboLimb,
  MeleeComboMotion,
  MeleeComboStep,
} from "@dd/shared";

export type KungFuWrapMotion = Extract<
  MeleeComboMotion,
  | "elbow"
  | "knee-strike"
  | "roundhouse-kick"
  | "chain-punch"
  | "sway-jab"
  | "weave-cross"
  | "gourd-haymaker"
  | "iron-knuckle"
  | "iron-palm"
  | "teep-kick"
  | "spinning-back-elbow"
  | "oblique-kick"
  | "double-palm"
  | "weave-backfist"
  | "sweeping-leg"
  | "falling-haymaker"
  | "crushing-palm"
  | "stomp-kick"
  | "windup-palm"
  | "quake-double-palm"
  | "backflip-head-kick"
>;

export interface KungFuWrapPoseInput {
  motion: KungFuWrapMotion;
  hand: MeleeComboHand;
  limb: MeleeComboLimb;
  direction: -1 | 0 | 1;
  timing: Readonly<MeleeComboStep["timing"]>;
  /** Exact authoritative center-to-envelope reach normalized by the shared 76px body height. */
  strikeReachBodyHeights: number;
  t: number;
}

/** All distances are body-height fractions. SpriteRig converts forward/lateral/lift channels once. */
export interface KungFuWrapPoseSample {
  active: boolean;
  handForward: number;
  handLateral: number;
  rearHandForward: number;
  rearHandLateral: number;
  handAngleOffset: number;
  rearHandAngleOffset: number;
  bodyForward: number;
  bodyLateral: number;
  bodyLift: number;
  bodyRotation: number;
  bodyScaleX: number;
  bodyScaleY: number;
  frontFootForward: number;
  frontFootLateral: number;
  frontFootLift: number;
  backFootForward: number;
  backFootLateral: number;
  backFootLift: number;
  footBlend: number;
  impactSnap: number;
  wholeBodyLift: number;
  /** Full-card tumble progress consumed by the same roll rotation helper as the movement kit. */
  flipProgress: number;
}

export function createKungFuWrapPoseSample(): KungFuWrapPoseSample {
  return {
    active: false,
    handForward: 0,
    handLateral: 0,
    rearHandForward: 0,
    rearHandLateral: 0,
    handAngleOffset: 0,
    rearHandAngleOffset: 0,
    bodyForward: 0,
    bodyLateral: 0,
    bodyLift: 0,
    bodyRotation: 0,
    bodyScaleX: 1,
    bodyScaleY: 1,
    frontFootForward: 0,
    frontFootLateral: 0,
    frontFootLift: 0,
    backFootForward: 0,
    backFootLateral: 0,
    backFootLift: 0,
    footBlend: 0,
    impactSnap: 0,
    wholeBodyLift: 0,
    flipProgress: -1,
  };
}

export function createKungFuWrapPoseInput(): KungFuWrapPoseInput {
  return {
    motion: "chain-punch",
    hand: "lead",
    limb: "hand",
    direction: 1,
    timing: { activeStart: 0.1, activeEnd: 0.4, impact: 0.32, followEnd: 0.55 },
    strikeReachBodyHeights: 1.35,
    t: 0,
  };
}

function resetKungFuWrapPoseSample(out: KungFuWrapPoseSample): void {
  out.active = false;
  out.handForward = 0;
  out.handLateral = 0;
  out.rearHandForward = 0;
  out.rearHandLateral = 0;
  out.handAngleOffset = 0;
  out.rearHandAngleOffset = 0;
  out.bodyForward = 0;
  out.bodyLateral = 0;
  out.bodyLift = 0;
  out.bodyRotation = 0;
  out.bodyScaleX = 1;
  out.bodyScaleY = 1;
  out.frontFootForward = 0;
  out.frontFootLateral = 0;
  out.frontFootLift = 0;
  out.backFootForward = 0;
  out.backFootLateral = 0;
  out.backFootLift = 0;
  out.footBlend = 0;
  out.impactSnap = 0;
  out.wholeBodyLift = 0;
  out.flipProgress = -1;
}

export function isKungFuWrapMotion(
  motion: MeleeComboMotion | undefined,
): motion is KungFuWrapMotion {
  return (
    motion === "elbow" ||
    motion === "knee-strike" ||
    motion === "roundhouse-kick" ||
    motion === "chain-punch" ||
    motion === "sway-jab" ||
    motion === "weave-cross" ||
    motion === "gourd-haymaker" ||
    motion === "iron-knuckle" ||
    motion === "iron-palm" ||
    motion === "teep-kick" ||
    motion === "spinning-back-elbow" ||
    motion === "oblique-kick" ||
    motion === "double-palm" ||
    motion === "weave-backfist" ||
    motion === "sweeping-leg" ||
    motion === "falling-haymaker" ||
    motion === "crushing-palm" ||
    motion === "stomp-kick" ||
    motion === "windup-palm" ||
    motion === "quake-double-palm" ||
    motion === "backflip-head-kick"
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function strikeEnvelope(input: Readonly<KungFuWrapPoseInput>): number {
  const { t, timing } = input;
  const impact = timing.impact ?? timing.activeEnd;
  if (t < timing.activeStart) return -0.2 * smooth(t / Math.max(0.001, timing.activeStart));
  if (t < impact)
    return (
      -0.2 + 1.2 * smooth((t - timing.activeStart) / Math.max(0.001, impact - timing.activeStart))
    );
  if (t < timing.followEnd)
    return 1 - 0.12 * smooth((t - impact) / Math.max(0.001, timing.followEnd - impact));
  return 0.88 * (1 - smooth((t - timing.followEnd) / Math.max(0.001, 1 - timing.followEnd)));
}

function actionOwnership(input: Readonly<KungFuWrapPoseInput>): number {
  const { t, timing } = input;
  if (t < timing.activeStart) return smooth(t / Math.max(0.001, timing.activeStart));
  if (t <= timing.activeEnd) return 1;
  if (t < timing.followEnd)
    return (
      1 -
      0.18 * smooth((t - timing.activeEnd) / Math.max(0.001, timing.followEnd - timing.activeEnd))
    );
  return 0.82 * (1 - smooth((t - timing.followEnd) / Math.max(0.001, 1 - timing.followEnd)));
}

export function sampleKungFuWrapPose(
  input: Readonly<KungFuWrapPoseInput>,
  out: KungFuWrapPoseSample,
): KungFuWrapPoseSample {
  resetKungFuWrapPoseSample(out);
  const direction = input.direction === 0 ? 1 : input.direction;
  const extension = strikeEnvelope(input);
  const ownership = actionOwnership(input);
  const impact = input.timing.impact ?? input.timing.activeEnd;
  const snap = clamp01(1 - Math.abs(input.t - impact) / 0.07) ** 2;
  out.active = ownership > 0;
  out.footBlend = ownership;
  out.impactSnap = snap;
  if (ownership <= 0) return out;

  switch (input.motion) {
    case "elbow":
      out.handForward = 0.38 * extension;
      out.handLateral = direction * 0.14 * (1 - clamp01(extension));
      out.handAngleOffset = direction * (0.72 - clamp01(extension) * 0.55);
      out.bodyForward = 0.08 * ownership;
      out.bodyLateral = direction * 0.05 * ownership;
      out.bodyRotation = direction * 0.2 * ownership;
      out.bodyScaleX = 1 - 0.08 * ownership;
      out.frontFootForward = 0.12;
      out.frontFootLateral = direction * 0.08;
      out.backFootForward = -0.08;
      out.backFootLateral = -direction * 0.06;
      break;
    case "knee-strike":
      out.handForward = 0.1 * ownership;
      out.handLateral = direction * 0.08;
      out.rearHandForward = 0.07 * ownership;
      out.rearHandLateral = -direction * 0.08;
      out.bodyForward = 0.13 * ownership;
      out.bodyLift = 0.035 * ownership;
      out.bodyRotation = -direction * 0.1 * ownership;
      out.bodyScaleY = 1 - 0.08 * ownership;
      out.frontFootForward = 0.4 * clamp01(extension);
      out.frontFootLateral = direction * 0.04;
      out.frontFootLift = 0.34 * ownership;
      out.backFootForward = -0.12;
      out.backFootLateral = -direction * 0.1;
      break;
    case "roundhouse-kick": {
      const arcProgress = smooth(
        (input.t - input.timing.activeStart) /
          Math.max(0.001, impact - input.timing.activeStart),
      );
      out.handForward = 0.08 * ownership;
      out.handLateral = direction * 0.12;
      out.rearHandForward = 0.06 * ownership;
      out.rearHandLateral = -direction * 0.1;
      out.bodyForward = 0.1 * ownership;
      out.bodyLateral = -direction * 0.12 * ownership;
      out.bodyLift = 0.08 * ownership;
      out.bodyRotation = direction * 0.48 * ownership;
      out.bodyScaleX = 1 - 0.18 * ownership;
      out.frontFootForward = 0.88 * clamp01(extension);
      out.frontFootLateral = direction * (-0.42 + arcProgress * 0.84) * ownership;
      out.frontFootLift = 0.34 * ownership;
      out.backFootForward = -0.2;
      out.backFootLateral = -direction * 0.17;
      break;
    }
    case "teep-kick":
      out.handForward = 0.06 * ownership;
      out.handLateral = direction * 0.1;
      out.rearHandForward = 0.04 * ownership;
      out.rearHandLateral = -direction * 0.11;
      out.bodyForward = 0.1 * ownership;
      out.bodyLateral = -direction * 0.035 * ownership;
      out.bodyLift = 0.025 * ownership;
      out.bodyRotation = -direction * 0.08 * ownership;
      out.bodyScaleY = 1 - 0.05 * ownership;
      out.frontFootForward = 0.78 * clamp01(extension);
      out.frontFootLateral = direction * 0.04;
      out.frontFootLift = 0.2 * ownership;
      out.backFootForward = -0.16;
      out.backFootLateral = -direction * 0.1;
      break;
    case "spinning-back-elbow":
      out.handForward = 0.46 * Math.max(0.25, clamp01(extension));
      out.handLateral = direction * 0.2 * (1 - 2 * clamp01(extension));
      out.handAngleOffset = direction * (-1.2 + 1.85 * clamp01(extension));
      out.rearHandForward = 0.04;
      out.rearHandLateral = -direction * 0.14;
      out.bodyForward = 0.1 * ownership;
      out.bodyLateral = -direction * 0.08 * ownership;
      out.bodyLift = 0.035 * ownership;
      out.bodyRotation = direction * 0.52 * ownership;
      out.bodyScaleX = 1 - 0.22 * ownership;
      out.frontFootForward = 0.2;
      out.frontFootLateral = direction * 0.18;
      out.backFootForward = -0.14;
      out.backFootLateral = -direction * 0.16;
      break;
    case "chain-punch":
      out.handForward = 0.9 * extension;
      out.handLateral = direction * 0.045 * (1 - clamp01(extension));
      out.bodyForward = 0.055 * ownership;
      out.bodyRotation = direction * 0.055 * ownership;
      out.bodyScaleX = 1 - 0.035 * ownership;
      out.frontFootForward = 0.1;
      out.frontFootLateral = direction * 0.04;
      out.backFootForward = -0.06;
      out.backFootLateral = -direction * 0.035;
      break;
    case "oblique-kick":
      out.handForward = 0.05;
      out.handLateral = direction * 0.08;
      out.rearHandForward = 0.05;
      out.rearHandLateral = -direction * 0.08;
      out.bodyForward = 0.07 * ownership;
      out.bodyLateral = -direction * 0.04 * ownership;
      out.bodyRotation = -direction * 0.07 * ownership;
      out.frontFootForward = 0.62 * clamp01(extension);
      out.frontFootLateral = direction * 0.07;
      out.frontFootLift = 0.13 * ownership;
      out.backFootForward = -0.12;
      out.backFootLateral = -direction * 0.08;
      break;
    case "double-palm":
      out.handForward = 0.78 * extension;
      out.handLateral = direction * 0.045;
      out.rearHandForward = 0.72 * extension;
      out.rearHandLateral = -direction * 0.045;
      out.bodyForward = 0.13 * ownership;
      out.bodyLift = -0.02 * ownership;
      out.bodyScaleX = 1 - 0.1 * ownership;
      out.bodyScaleY = 1 - 0.06 * ownership;
      out.frontFootForward = 0.18;
      out.frontFootLateral = 0.1;
      out.backFootForward = -0.14;
      out.backFootLateral = -0.1;
      break;
    case "sway-jab":
      out.handForward = 0.66 * extension;
      out.handLateral = direction * 0.12 * (1 - clamp01(extension));
      out.handAngleOffset = -direction * 0.08;
      out.bodyForward = 0.06 * ownership;
      out.bodyLateral = direction * 0.17 * ownership;
      out.bodyLift = 0.025 * ownership;
      out.bodyRotation = -direction * 0.16 * ownership;
      out.bodyScaleY = 1 - 0.06 * ownership;
      out.frontFootForward = 0.12;
      out.frontFootLateral = direction * 0.13;
      out.backFootForward = -0.08;
      out.backFootLateral = direction * 0.04;
      break;
    case "weave-cross":
      out.handForward = 0.76 * extension;
      out.handLateral = -direction * 0.11 * (1 - clamp01(extension));
      out.handAngleOffset = direction * 0.05;
      out.bodyForward = 0.09 * ownership;
      out.bodyLateral = -direction * 0.2 * ownership;
      out.bodyLift = -0.06 * ownership;
      out.bodyRotation = direction * 0.19 * ownership;
      out.bodyScaleY = 1 - 0.11 * ownership;
      out.frontFootForward = 0.16;
      out.frontFootLateral = -direction * 0.12;
      out.backFootForward = -0.06;
      out.backFootLateral = direction * 0.08;
      break;
    case "weave-backfist":
      out.handForward = 0.62 * Math.max(0.18, clamp01(extension));
      out.handLateral = direction * 0.21 * (1 - 2 * clamp01(extension));
      out.handAngleOffset = direction * (-0.72 + 1.24 * clamp01(extension));
      out.bodyForward = 0.07 * ownership;
      out.bodyLateral = direction * 0.2 * ownership;
      out.bodyLift = 0.015 * ownership;
      out.bodyRotation = -direction * 0.26 * ownership;
      out.bodyScaleX = 1 - 0.1 * ownership;
      out.frontFootForward = 0.14;
      out.frontFootLateral = direction * 0.17;
      out.backFootForward = -0.1;
      out.backFootLateral = -direction * 0.05;
      break;
    case "sweeping-leg":
      out.handForward = 0.05;
      out.handLateral = direction * 0.15;
      out.rearHandForward = -0.02;
      out.rearHandLateral = -direction * 0.14;
      out.bodyForward = 0.04 * ownership;
      out.bodyLateral = direction * 0.12 * ownership;
      out.bodyLift = -0.12 * ownership;
      out.bodyRotation = direction * 0.38 * ownership;
      out.bodyScaleY = 1 - 0.22 * ownership;
      out.frontFootForward = 0.62 * Math.max(0.2, clamp01(extension));
      out.frontFootLateral = direction * 0.3 * (1 - 2 * clamp01(extension));
      out.frontFootLift = 0.06 * ownership;
      out.backFootForward = -0.18;
      out.backFootLateral = -direction * 0.12;
      break;
    case "gourd-haymaker":
      out.handForward = 0.76 * Math.max(0.18, clamp01(extension));
      out.handLateral = direction * 0.2 * (1 - 2 * clamp01(extension));
      out.handAngleOffset = direction * (-0.95 + 1.58 * clamp01(extension));
      out.bodyForward = 0.1 * ownership;
      out.bodyLateral = direction * 0.23 * (1 - clamp01(extension)) * ownership;
      out.bodyLift = 0.02 * ownership;
      out.bodyRotation = direction * 0.34 * ownership;
      out.bodyScaleX = 1 - 0.12 * ownership;
      out.bodyScaleY = 1 - 0.08 * ownership;
      out.frontFootForward = 0.22;
      out.frontFootLateral = direction * 0.18;
      out.backFootForward = -0.12;
      out.backFootLateral = -direction * 0.13;
      break;
    case "falling-haymaker":
      out.handForward = 0.82 * Math.max(0.16, clamp01(extension));
      out.handLateral = direction * 0.24 * (1 - 2 * clamp01(extension));
      out.handAngleOffset = direction * (-1.08 + 1.7 * clamp01(extension));
      out.bodyForward = 0.14 * ownership;
      out.bodyLateral = direction * 0.16 * (1 - clamp01(extension)) * ownership;
      out.bodyLift = -0.09 * clamp01(extension) * ownership;
      out.bodyRotation = direction * 0.42 * ownership;
      out.bodyScaleX = 1 - 0.16 * ownership;
      out.bodyScaleY = 1 - 0.13 * ownership;
      out.frontFootForward = 0.24;
      out.frontFootLateral = direction * 0.2;
      out.backFootForward = -0.14;
      out.backFootLateral = -direction * 0.14;
      break;
    case "iron-knuckle":
      out.handForward = 0.73 * extension;
      out.handLateral = direction * 0.055 * (1 - clamp01(extension));
      out.bodyForward = 0.12 * ownership;
      out.bodyRotation = direction * 0.16 * ownership;
      out.bodyScaleX = 1 - 0.11 * ownership;
      out.bodyScaleY = 1 - 0.07 * ownership;
      out.frontFootForward = 0.18;
      out.frontFootLateral = direction * 0.08;
      out.backFootForward = -0.14;
      out.backFootLateral = -direction * 0.08;
      break;
    case "iron-palm":
      out.handForward = 0.67 * extension;
      out.handLateral = direction * 0.08;
      out.rearHandForward = 0.58 * extension;
      out.rearHandLateral = -direction * 0.09;
      out.bodyForward = 0.16 * ownership;
      out.bodyLift = -0.035 * ownership;
      out.bodyRotation = direction * 0.1 * ownership;
      out.bodyScaleX = 1 - 0.15 * ownership;
      out.bodyScaleY = 1 - 0.12 * ownership;
      out.frontFootForward = 0.22;
      out.frontFootLateral = direction * 0.13;
      out.backFootForward = -0.18;
      out.backFootLateral = -direction * 0.13;
      break;
    case "crushing-palm":
      out.handForward = 0.7 * extension;
      out.handLateral = direction * 0.06 * (1 - clamp01(extension));
      out.handAngleOffset = -direction * 0.08;
      out.bodyForward = 0.13 * ownership;
      out.bodyLift = -0.03 * ownership;
      out.bodyRotation = direction * 0.14 * ownership;
      out.bodyScaleX = 1 - 0.13 * ownership;
      out.bodyScaleY = 1 - 0.1 * ownership;
      out.frontFootForward = 0.2;
      out.frontFootLateral = direction * 0.1;
      out.backFootForward = -0.16;
      out.backFootLateral = -direction * 0.1;
      break;
    case "stomp-kick":
      out.handForward = 0.04;
      out.handLateral = direction * 0.12;
      out.rearHandForward = 0.03;
      out.rearHandLateral = -direction * 0.1;
      out.bodyForward = 0.11 * ownership;
      out.bodyLift = 0.04 * (1 - clamp01(extension)) * ownership;
      out.bodyRotation = -direction * 0.1 * ownership;
      out.bodyScaleY = 1 - 0.12 * ownership;
      out.frontFootForward = 0.58 * clamp01(extension);
      out.frontFootLateral = direction * 0.04;
      out.frontFootLift = 0.24 * (1 - clamp01(extension)) * ownership;
      out.backFootForward = -0.18;
      out.backFootLateral = -direction * 0.12;
      break;
    case "windup-palm":
      out.handForward = 0.5 * extension;
      out.handLateral = -direction * 0.18 * (1 - clamp01(extension));
      out.handAngleOffset = direction * (0.4 - 0.28 * clamp01(extension));
      out.rearHandForward = 0.08;
      out.rearHandLateral = direction * 0.12;
      out.bodyForward = -0.035 * ownership;
      out.bodyLateral = -direction * 0.08 * ownership;
      out.bodyRotation = -direction * 0.28 * ownership;
      out.bodyScaleX = 1 - 0.1 * ownership;
      out.frontFootForward = 0.1;
      out.frontFootLateral = -direction * 0.1;
      out.backFootForward = -0.2;
      out.backFootLateral = direction * 0.11;
      break;
    case "quake-double-palm":
      out.handForward = 0.78 * extension;
      out.handLateral = direction * 0.1;
      out.rearHandForward = 0.72 * extension;
      out.rearHandLateral = -direction * 0.1;
      out.bodyForward = 0.2 * ownership;
      out.bodyLift = -0.06 * ownership;
      out.bodyScaleX = 1 - 0.18 * ownership;
      out.bodyScaleY = 1 - 0.16 * ownership;
      out.frontFootForward = 0.26;
      out.frontFootLateral = 0.15;
      out.backFootForward = -0.22;
      out.backFootLateral = -0.15;
      break;
    case "backflip-head-kick": {
      const flipProgress = clamp01(input.t / Math.max(0.001, input.timing.followEnd));
      const apex = Math.sin(Math.PI * flipProgress);
      const overhead = Math.sin(Math.PI * clamp01(flipProgress * 1.2));
      out.flipProgress = flipProgress;
      out.wholeBodyLift = 0.48 * apex;
      out.handForward = -0.08 * apex;
      out.handLateral = direction * 0.18 * apex;
      out.rearHandForward = -0.12 * apex;
      out.rearHandLateral = -direction * 0.17 * apex;
      out.bodyForward = -0.08 * apex;
      out.bodyLateral = direction * 0.05 * Math.sin(Math.PI * 2 * flipProgress);
      out.bodyScaleX = 1 - 0.16 * apex;
      out.bodyScaleY = 1 + 0.12 * apex;
      out.frontFootForward = 0.92 * Math.max(clamp01(extension), overhead * 0.82);
      out.frontFootLateral = direction * 0.22 * Math.sin(Math.PI * 2 * flipProgress);
      out.frontFootLift = 0.48 * overhead;
      out.backFootForward = -0.28 * apex;
      out.backFootLateral = -direction * 0.2 * apex;
      out.backFootLift = 0.24 * apex;
      break;
    }
  }

  // The visible striking receiver and the accepted hit envelope share this authored reach. Subtract the
  // neutral joint offset so the limb travels to, rather than beyond, the server's center-to-edge distance.
  if (extension > 0) {
    const limbTravel = Math.max(0.58, input.strikeReachBodyHeights - 0.46) * extension;
    if (input.limb === "foot") {
      out.frontFootForward = Math.max(out.frontFootForward, limbTravel);
    } else {
      out.handForward = Math.max(out.handForward, limbTravel);
      if (input.hand === "both")
        out.rearHandForward = Math.max(out.rearHandForward, limbTravel * 0.94);
    }
  }
  return out;
}
