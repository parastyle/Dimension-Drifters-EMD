import { MovementCorrectionBand } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_HUD_METRIC_COUNT,
  DiagnosticHudTelemetry,
  writeVfxDiagnosticStats,
} from "./diagnostic-hud.js";

function metricStates(telemetry: DiagnosticHudTelemetry, nowMs: number) {
  return Object.fromEntries(
    telemetry.snapshot(nowMs).metrics.map((metric) => [metric.id, metric.state]),
  );
}

describe("DiagnosticHudTelemetry", () => {
  it("counts only visible VFX surfaces and their live particles", () => {
    const context = {
      pendingInputs: 0,
      enemies: 0,
      projectiles: 0,
      vfxSurfaces: 99,
      vfxParticles: 99,
    };
    writeVfxDiagnosticStats(
      {
        list: [
          {
            visible: true,
            list: [
              { getAliveParticleCount: () => 7 },
              { list: [{ getAliveParticleCount: () => 5 }] },
            ],
          },
          { visible: false, list: [{ getAliveParticleCount: () => 100 }] },
          { visible: true },
        ],
      },
      context,
    );

    expect(context.vfxSurfaces).toBe(2);
    expect(context.vfxParticles).toBe(12);
  });

  it("keeps a calm ten-second sample fully green", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.recordFrame(16.4, 100);
    telemetry.recordInputKey(100);
    telemetry.recordCommand(1, 110);
    telemetry.recordServerPatch(1, undefined, 100);
    telemetry.recordServerPatch(2, undefined, 150);
    telemetry.recordCommand(2, 170);
    telemetry.recordServerPatch(3, 2, 200);
    telemetry.recordRenderCommitDivergence(1.25, 200);
    telemetry.recordContext(
      {
        pendingInputs: 1,
        enemies: 12,
        projectiles: 8,
        vfxSurfaces: 2,
        vfxParticles: 18,
        heapUsedBytes: 100 * 1024 * 1024,
        heapLimitBytes: 1_024 * 1024 * 1024,
      },
      200,
    );
    telemetry.recordHudCost(0.01, true, false, 200);

    const snapshot = telemetry.snapshot(200);
    expect(snapshot.metrics).toHaveLength(DIAGNOSTIC_HUD_METRIC_COUNT);
    expect(snapshot.redCount).toBe(0);
    expect(snapshot.amberCount).toBe(0);
    expect(snapshot.metrics.every((metric) => metric.state === "GREEN")).toBe(true);
  });

  it("makes every hard-failure threshold red and preserves the cold-readable dump", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.recordFrame(260, 100);
    telemetry.recordSelfCorrection(
      {
        magnitudePx: 240,
        band: MovementCorrectionBand.Snap,
        cause: "envelope-violation",
      },
      100,
    );
    telemetry.recordRenderCommitDivergence(9, 100);
    telemetry.recordInputKey(0);
    telemetry.recordCommand(7, 101);
    telemetry.recordServerPatch(1, undefined, 0);
    telemetry.recordCommand(8, 200);
    telemetry.recordServerPatch(2, 8, 501);
    telemetry.recordContext(
      {
        pendingInputs: 0,
        enemies: 0,
        projectiles: 0,
        vfxSurfaces: 0,
        vfxParticles: 0,
        heapUsedBytes: 100 * 1024 * 1024,
        heapLimitBytes: 1_024 * 1024 * 1024,
      },
      0,
    );
    telemetry.recordContext(
      {
        pendingInputs: 33,
        enemies: 81,
        projectiles: 313,
        vfxSurfaces: 13,
        vfxParticles: 385,
        heapUsedBytes: 181 * 1024 * 1024,
        heapLimitBytes: 1_024 * 1024 * 1024,
      },
      10_000,
    );
    telemetry.recordResync(100);
    telemetry.recordHudCost(0.51, true, true, 100);

    const snapshot = telemetry.snapshot(10_000);
    expect(snapshot.redCount).toBe(DIAGNOSTIC_HUD_METRIC_COUNT);
    expect(snapshot.amberCount).toBe(0);
    expect(metricStates(telemetry, 10_000)).toEqual({
      frame: "RED",
      stalls: "RED",
      corrections: "RED",
      divergence: "RED",
      input: "RED",
      tick: "RED",
      rtt: "RED",
      pending: "RED",
      load: "RED",
      heap: "RED",
      resync: "RED",
      cost: "RED",
    });

    const dump = telemetry.dump(10_000, "2026-07-27T12:00:00.000Z");
    expect(dump).toContain("DD DIAG v1 | 2026-07-27T12:00:00.000Z | last 10.0s");
    expect(dump).toContain("STATUS 12 RED / 0 AMBER / 0 GREEN");
    expect(dump).toContain("RED   Render<->commit");
    expect(dump).toContain("EVENTS 10s stalls=1 corrections=1 resyncs=1");
    expect(dump).toContain("FLAGS red=Frame time,Stalls >250ms,SELF corrections");
  });

  it("treats exact red boundaries as amber because red means strictly above the threshold", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.recordFrame(250, 100);
    telemetry.recordRenderCommitDivergence(8, 100);

    const states = metricStates(telemetry, 100);
    expect(states.frame).toBe("AMBER");
    expect(states.stalls).toBe("GREEN");
    expect(states.divergence).toBe("AMBER");
  });
});
