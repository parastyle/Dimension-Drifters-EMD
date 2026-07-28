import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The guardrail list is pasted into every Sol brief. It only changes behaviour if it stays in sync
 * with the spec that owns it, and if the rules it names still correspond to real code. A drifted
 * guardrail block is worse than none: briefs would cite rules the codebase no longer honours.
 */
const spec = readFileSync(new URL("../DIMENSION_DRIFTERS_MASTER_SPEC.md", import.meta.url), "utf8");
const block = readFileSync(new URL("../tools/sol/GUARDRAILS.md", import.meta.url), "utf8");

describe("Sol guardrails", () => {
  it("keeps the paste-ready block byte-identical to the spec section that owns it", () => {
    const start = spec.indexOf("## Sol guardrails");
    const end = spec.indexOf("## Current locked decisions");
    expect(start, "spec is missing the Sol guardrails section").toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(block.trimEnd()).toBe(spec.slice(start, end).trimEnd());
  });

  it("states every rule G1..G10", () => {
    for (let n = 1; n <= 10; n++) {
      expect(block, `guardrail G${n} is missing`).toContain(`**G${n} —`);
    }
  });

  it("names the canon laws it defers to", () => {
    for (const law of ["L09", "L10", "L11", "B42"]) {
      expect(block, `guardrail block should reference ${law}`).toContain(law);
    }
  });
});
