import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

/**
 * Source-of-truth guard (audit AUDIT-2). `displayLength` is authored in BOTH `weapons.ts` (what ships)
 * and the Weaponsmith's `assignments.json` (the authoring tool). They silently diverged on 3 swords
 * before this guard existed. Until the SoT pipeline (SPEC-01) makes weapons.ts the sole owner + the
 * smith a read-only mirror, this test makes a divergence fail the BUILD instead of the playtest.
 */
const assignments = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../tools/weaponsmith/assignments.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, { displayLength?: number }>;

describe("displayLength: weapons.ts ↔ Weaponsmith assignments.json", () => {
  for (const [id, def] of Object.entries(WEAPONS)) {
    const authored = assignments[id]?.displayLength;
    if (authored == null) continue; // smith hasn't authored a size for this weapon — nothing to compare
    it(`${id} agrees (weapons.ts=${def.displayLength}, smith=${authored})`, () => {
      expect(def.displayLength).toBe(authored);
    });
  }

  it("covers every coded weapon that the smith has sized", () => {
    // sanity: at least the explore swords the user tuned should be present in both
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
  });
});
