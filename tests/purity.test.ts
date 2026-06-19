import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bladeAngleAt,
  type ChainCandidate,
  clampQuakeEpicenter,
  coneAngles,
  selectChainTargets,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

// §4 server-authoritative-vs-replicated boundary. The CLIENT re-runs a handful of shared helpers to draw VFX
// in lockstep with the server (chain bolts, scatter cones, quake epicentre, blade sweep). That only stays in
// sync if those helpers are PURE — deterministic + Math.random-free. This test pins both properties so a
// future edit that drops a `Math.random()` into one of these modules fails the gate instead of desyncing co-op.

const HERE = dirname(fileURLToPath(import.meta.url));
const SHARED_SRC = join(HERE, "..", "packages", "shared", "src");
const REPLICATED_MODULES = ["combat.ts", "melee.ts", "enemies.ts"];

describe("§4 replicated-helper purity boundary", () => {
  it("the client-replicated shared modules contain NO Math.random (would desync co-op VFX)", () => {
    for (const file of REPLICATED_MODULES) {
      const src = readFileSync(join(SHARED_SRC, file), "utf8");
      expect(src, `${file} must stay Math.random-free`).not.toMatch(/Math\s*\.\s*random/);
    }
  });

  it("coneAngles is deterministic (call N === call N+1)", () => {
    expect(coneAngles(0.5, 5, 0.8)).toEqual(coneAngles(0.5, 5, 0.8));
  });

  it("bladeAngleAt is deterministic", () => {
    expect(bladeAngleAt(0.5, 2.0, 0.3)).toBe(bladeAngleAt(0.5, 2.0, 0.3));
  });

  it("clampQuakeEpicenter is deterministic", () => {
    expect(clampQuakeEpicenter({ x: 0, y: 0 }, { x: 500, y: 0 }, 260)).toEqual(
      clampQuakeEpicenter({ x: 0, y: 0 }, { x: 500, y: 0 }, 260),
    );
  });

  it("selectChainTargets is deterministic for fixed inputs", () => {
    const candidates: ChainCandidate[] = [
      { id: "a", x: 30, y: 0 },
      { id: "b", x: 60, y: 0 },
      { id: "c", x: 90, y: 30 },
    ];
    const seed = { x: 0, y: 0 };
    expect(selectChainTargets(seed, candidates, 3, 240)).toEqual(
      selectChainTargets(seed, candidates, 3, 240),
    );
  });
});
