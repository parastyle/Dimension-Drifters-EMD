import { MovementCorrectionBand } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfCorrectionTelemetry } from "./self-correction-telemetry.js";

describe("SelfCorrectionTelemetry", () => {
  it("summarizes bands, causes, correction pixels, and >250ms frames for the owner readout", () => {
    const telemetry = new SelfCorrectionTelemetry();
    telemetry.recordCorrection({
      magnitudePx: 92,
      band: MovementCorrectionBand.Smooth,
      cause: "stall-resync",
    });
    telemetry.recordCorrection({
      magnitudePx: 2.5,
      band: MovementCorrectionBand.Silent,
      cause: "envelope-violation",
    });
    telemetry.recordCorrection({
      magnitudePx: 1400,
      band: MovementCorrectionBand.Snap,
      cause: "teleport",
    });
    telemetry.recordLongFrame(271.25);
    telemetry.recordLongFrame(318.5);

    expect(telemetry.snapshot()).toMatchObject({
      corrections: 3,
      silent: 1,
      smooth: 1,
      snaps: 1,
      maxCorrectionPx: 1400,
      stallResync: 1,
      envelopeViolation: 1,
      teleports: 1,
      longFrames: 2,
      maxFrameMs: 318.5,
    });
    expect(telemetry.summaryLine()).toBe(
      "L10 SELF · 3 corrections (1 silent / 1 smooth / 1 snap) · max 1400.0px · " +
        "causes 1 stall-resync / 1 envelope-violation / 1 teleport · " +
        ">250ms 2 (max 318.5ms)",
    );
  });
});
