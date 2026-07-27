import { readFileSync } from "node:fs";
import { MovementCorrectionBand } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  DIAGNOSTIC_HUD_METRIC_COUNT,
  DIAGNOSTIC_THRESHOLDS,
  DiagnosticHudTelemetry,
  writeVfxDiagnosticStats,
} from "./diagnostic-hud.js";

const arenaSource = readFileSync(new URL("../scenes/ArenaScene.ts", import.meta.url), "utf8");

function metricStates(telemetry: DiagnosticHudTelemetry, nowMs: number) {
  return Object.fromEntries(
    telemetry.snapshot(nowMs).metrics.map((metric) => [metric.id, metric.state]),
  );
}

describe("DiagnosticHudTelemetry", () => {
  it("keeps all twelve live intake seams wired to ArenaScene", () => {
    for (const intake of [
      "this.diagnosticHud?.recordFrame(deltaMs)",
      "this.diagnosticHud?.recordCommand(cmd.seq)",
      "this.diagnosticHud?.recordServerPatch(",
      "this.diagnosticHud?.recordSelfCorrection(event)",
      "this.diagnosticHud?.recordRenderCommitDivergence(",
      "this.diagnosticHud?.recordIntraTickRenderCommitDivergence(",
      "this.diagnosticHud?.recordResync()",
      "this.diagnosticHud?.markSelfCorrectionSourceAvailable()",
      "out.pendingInputs = this.predictor?.stats.pending",
      "out.enemies = this.room?.state.enemies?.size",
      "out.projectiles = this.room?.state.projectiles?.size",
      "writeVfxDiagnosticStats(this.vfxPlayer?.bloomRoot, out)",
    ]) {
      expect(arenaSource, `missing diagnostic intake: ${intake}`).toContain(intake);
    }
  });

  it("keeps player-visible thresholds centralized at the owner-tuned values", () => {
    expect(DIAGNOSTIC_THRESHOLDS).toMatchObject({
      frameAmberMs: 20,
      frameRedMs: 50,
      stallRedMs: 250,
      divergenceAmberPx: 1,
      divergenceRedPx: 4,
      inputAmberMs: 20,
      inputRedMs: 50,
      tickDriftAmberMs: 8,
      tickDriftRedMs: 20,
      pendingAmber: 4,
      pendingRed: 16,
      pendingGrowthAmber: 4,
      pendingGrowthRed: 16,
      enemyAmber: 49,
      enemyRed: 80,
      projectileAmber: 188,
      projectileRed: 312,
      vfxSurfaceAmber: 8,
      vfxSurfaceRed: 12,
    });
  });

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

  it("marks VFX unavailable when there is no live emitter root", () => {
    const context = {
      pendingInputs: 0,
      enemies: 0,
      projectiles: 0,
      vfxSurfaces: 99 as number | undefined,
      vfxParticles: 99 as number | undefined,
    };

    writeVfxDiagnosticStats(undefined, context);

    expect(context.vfxSurfaces).toBeUndefined();
    expect(context.vfxParticles).toBeUndefined();
  });

  it("keeps a calm ten-second sample fully green", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.markSelfCorrectionSourceAvailable();
    telemetry.recordFrame(16.4, 100);
    telemetry.recordInputKey(100);
    telemetry.recordCommand(1, 110);
    telemetry.recordServerPatch(1, undefined, 100);
    telemetry.recordServerPatch(2, undefined, 150);
    telemetry.recordCommand(2, 170);
    telemetry.recordServerPatch(3, 2, 200);
    telemetry.recordRenderCommitDivergence(DIAGNOSTIC_THRESHOLDS.divergenceAmberPx, 200);
    telemetry.recordIntraTickRenderCommitDivergence(DIAGNOSTIC_THRESHOLDS.divergenceAmberPx, 200);
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
    expect(snapshot.unavailableCount).toBe(0);
    expect(snapshot.metrics.every((metric) => metric.state === "GREEN")).toBe(true);
  });

  it("prints n/a for every source that has not produced a real sample", () => {
    const telemetry = new DiagnosticHudTelemetry(0);

    const cold = telemetry.snapshot(0);
    expect(cold.unavailableCount).toBe(DIAGNOSTIC_HUD_METRIC_COUNT);
    expect(cold.metrics.every((metric) => metric.state === "N/A")).toBe(true);
    expect(cold.metrics.every((metric) => metric.value.includes("n/a"))).toBe(true);
    expect(telemetry.dump(0)).toContain("12 N/A / 0 GREEN");

    telemetry.recordFrame(16, 16);
    telemetry.markSelfCorrectionSourceAvailable();
    telemetry.recordContext(
      {
        pendingInputs: 0,
        enemies: 0,
        projectiles: 0,
        vfxSurfaces: 0,
        vfxParticles: 0,
      },
      16,
    );
    const sampled = telemetry.snapshot(16);
    expect(sampled.metrics.find((metric) => metric.id === "stalls")?.value).toContain(
      "0 this session",
    );
    expect(sampled.metrics.find((metric) => metric.id === "corrections")?.value).toContain(
      "0 | max n/a",
    );
    expect(sampled.metrics.find((metric) => metric.id === "pending")?.value).toContain("now 0");
    expect(sampled.metrics.find((metric) => metric.id === "input")?.value).toContain("n/a");
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
    expect(dump).toContain("STATUS 12 RED / 0 AMBER / 0 N/A / 0 GREEN");
    expect(dump).toContain("RED   Render<->commit");
    expect(dump).toContain("EVENTS 10s stalls=1 corrections=1 resyncs=1");
    expect(dump).toContain("FLAGS red=Frame time,Stalls >250ms,SELF corrections");
  });

  it("keeps the worst intra-tick disagreement visible when the boundary value is zero", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.recordRenderCommitDivergence(0, 100);
    telemetry.recordIntraTickRenderCommitDivergence(13.056, 99);
    telemetry.recordIntraTickRenderCommitDivergence(0, 100);

    const divergence = telemetry.snapshot(100).metrics.find((metric) => metric.id === "divergence");
    expect(divergence).toMatchObject({ state: "RED" });
    expect(divergence?.value).toContain("intra now 0.0px | 10s peak 13.1px");
    expect(divergence?.value).toContain("boundary now 0.0px | 10s peak 0.0px");
    expect(telemetry.dump(100)).toContain("renderCommitIntra=13.1px renderCommitBoundary=0.0px");
  });

  it("treats exact red boundaries as amber because red means strictly above the threshold", () => {
    const telemetry = new DiagnosticHudTelemetry(0);
    telemetry.recordFrame(DIAGNOSTIC_THRESHOLDS.frameRedMs, 100);
    telemetry.recordRenderCommitDivergence(DIAGNOSTIC_THRESHOLDS.divergenceRedPx, 100);

    const states = metricStates(telemetry, 100);
    expect(states.frame).toBe("AMBER");
    expect(states.stalls).toBe("GREEN");
    expect(states.divergence).toBe("AMBER");

    telemetry.recordFrame(DIAGNOSTIC_THRESHOLDS.stallRedMs, 101);
    const stallBoundaryStates = metricStates(telemetry, 101);
    expect(stallBoundaryStates.frame).toBe("RED");
    expect(stallBoundaryStates.stalls).toBe("GREEN");
  });
});
