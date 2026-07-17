import { DEFAULT_DIMENSION, DIMENSION_IDS, getDimension } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { buildArrivalReport, type RunRequest, readRunRequest } from "./matchmaking.js";

/**
 * §50 first-session finding #1 — the arrival report is the player-facing half of the matchmaking
 * contract: it must say what room was actually landed in, and it must WARN (never stay silent) when
 * the joined room differs from the menu request. Pure-function coverage; the DOM toast and the
 * colyseus prototype seam are thin adapters over these.
 */

const DIM_A = DIMENSION_IDS[0] ?? DEFAULT_DIMENSION;
const DIM_B = DIMENSION_IDS[1] ?? DEFAULT_DIMENSION;

function req(overrides: Partial<RunRequest> = {}): RunRequest {
  return { dimensionId: DIM_A, bossRush: false, belt: false, ...overrides };
}

function state(overrides: Record<string, unknown> = {}): unknown {
  return { dimensionId: DIM_A, depth: 1, mode: "arena", players: { size: 1 }, ...overrides };
}

const warns = (lines: ReturnType<typeof buildArrivalReport>) =>
  lines.filter((l) => l.kind === "warn");
const headline = (lines: ReturnType<typeof buildArrivalReport>) =>
  lines.find((l) => l.kind === "headline")?.text ?? "";

describe("readRunRequest", () => {
  it("normalizes the real join options shape", () => {
    expect(readRunRequest({ dimensionId: DIM_A, bossRush: true, belt: false, scrip: 40 })).toEqual({
      dimensionId: DIM_A,
      bossRush: true,
      belt: false,
    });
  });

  it("coerces junk/missing options to a safe request (wire data is untrusted)", () => {
    expect(readRunRequest(undefined)).toEqual({
      dimensionId: undefined,
      bossRush: false,
      belt: false,
    });
    expect(readRunRequest({ dimensionId: 7, bossRush: "yes", belt: 1 })).toEqual({
      dimensionId: undefined,
      bossRush: false,
      belt: false,
    });
    expect(readRunRequest({ dimensionId: "" })).toEqual({
      dimensionId: undefined,
      bossRush: false,
      belt: false,
    });
  });
});

describe("buildArrivalReport", () => {
  it("a matching solo landing reads STARTED with the dimension name and no warnings", () => {
    const lines = buildArrivalReport(state(), req(), "quick");
    expect(headline(lines)).toBe(`STARTED — ${getDimension(DIM_A).name.toUpperCase()}`);
    expect(lines.find((l) => l.kind === "info")?.text).toContain("depth 1 · 1 drifter");
    expect(warns(lines)).toHaveLength(0);
  });

  it("landing with squadmates reads JOINED and counts drifters", () => {
    const lines = buildArrivalReport(state({ players: { size: 3 } }), req(), "quick");
    expect(headline(lines)).toContain("JOINED");
    expect(lines.find((l) => l.kind === "info")?.text).toContain("3 drifters");
    expect(warns(lines)).toHaveLength(0);
  });

  it("host intent reads HOSTING even when alone", () => {
    expect(headline(buildArrivalReport(state(), req(), "host"))).toContain("HOSTING");
  });

  it("WARNS when the matched run has descended past the requested dimension", () => {
    const lines = buildArrivalReport(
      state({ dimensionId: DIM_B, depth: 3, players: { size: 2 } }),
      req({ dimensionId: DIM_A }),
      "quick",
    );
    const w = warns(lines);
    expect(w).toHaveLength(1);
    expect(w[0]?.text).toContain(getDimension(DIM_A).name);
    expect(w[0]?.text).toContain(getDimension(DIM_B).name);
    expect(w[0]?.text).toContain("depth 3");
    expect(headline(lines)).toContain(getDimension(DIM_B).name.toUpperCase());
  });

  it("boss rush request landing in a boss-rush room is clean; mode mismatch trips the warning", () => {
    const rush = buildArrivalReport(
      state({ mode: "bossrush" }),
      req({ bossRush: true, dimensionId: DEFAULT_DIMENSION }),
      "quick",
    );
    expect(headline(rush)).toBe("STARTED — BOSS RUSH");
    expect(warns(rush)).toHaveLength(0);

    const mismatch = buildArrivalReport(state(), req({ bossRush: true }), "quick");
    expect(warns(mismatch)).toHaveLength(1);
    expect(warns(mismatch)[0]?.text).toContain("BOSS RUSH");
  });

  it("does not raise the dimension-drift warning for belt or boss-rush requests", () => {
    const belt = buildArrivalReport(
      state({ dimensionId: DIM_B }),
      req({ belt: true, dimensionId: DIM_A }),
      "quick",
    );
    expect(warns(belt)).toHaveLength(0);
    expect(headline(belt)).toContain("BELT");
  });

  it("training mode is disclosed on the info line", () => {
    const lines = buildArrivalReport(state({ mode: "training" }), req(), "quick");
    expect(lines.find((l) => l.kind === "info")?.text).toContain("TRAINING GROUNDS");
  });

  it("survives a malformed first state (defaults, never throws)", () => {
    const lines = buildArrivalReport({}, req(), "quick");
    expect(headline(lines)).toBe(`STARTED — ${getDimension(DIM_A).name.toUpperCase()}`);
    expect(buildArrivalReport(null, readRunRequest(undefined), "quick")).toBeTruthy();
  });
});
