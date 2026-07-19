import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { bladeSizeClassFor } from "../packages/client/src/sprites/pose-language.js";

const KATANA_SIZE_CLASSES = [
  ["drift-wakizashi-kagewake", "short"],
  ["drift-wakizashi-hushglass", "short"],
  ["drift-katana-stillwater-edict", "standard"],
  ["drift-katana-stormthread", "standard"],
  ["drift-katana-riftstep", "standard"],
  ["drift-nodachi-pale-horizon", "long"],
  ["drift-nodachi-gatebreaker", "long"],
  ["drift-greatkatana-moonwake", "great"],
  ["drift-greatkatana-tempest-regent", "great"],
  ["drift-colossal-world-seam", "colossal"],
] as const;

describe("flourish katana size integration", () => {
  it("preserves all ten emitted short/standard/long/great/colossal identities", () => {
    for (const [id, expected] of KATANA_SIZE_CLASSES) {
      const def = WEAPONS[id];
      expect(def, `${id}:definition`).toBeDefined();
      if (!def) continue;
      expect(def.sizeClass, `${id}:emitted`).toBe(expected);
      expect(bladeSizeClassFor(def), `${id}:resolved`).toBe(expected);
    }
  });
});
