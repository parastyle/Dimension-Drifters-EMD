import {
  AUG_DRAFT_SIZE,
  AUGMENT_IDS,
  AUGMENTS,
  countAugment,
  draftAugments,
  hasAugment,
  isAugment,
  parseAugments,
  SIGNATURE_INTERVAL,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("AUGMENTS registry (§8 parry pool)", () => {
  it("has the 9 locked augments across the 3 flavor tags", () => {
    expect(AUGMENT_IDS.length).toBe(9);
    const tags = AUGMENT_IDS.map((id) => AUGMENTS[id]?.tag);
    expect(tags.filter((t) => t === "riposte").length).toBe(3);
    expect(tags.filter((t) => t === "aegis").length).toBe(3);
    expect(tags.filter((t) => t === "hex").length).toBe(3);
  });

  it("each def is self-consistent (id matches key, has name/desc/icon, valid tag)", () => {
    for (const id of AUGMENT_IDS) {
      const def = AUGMENTS[id];
      expect(def?.id).toBe(id);
      expect(def?.name.length).toBeGreaterThan(0);
      expect(def?.desc.length).toBeGreaterThan(0);
      expect(def?.icon.length).toBeGreaterThan(0);
      expect(["riposte", "aegis", "hex"]).toContain(def?.tag);
      expect(typeof def?.stacks).toBe("boolean");
    }
  });

  it("the stackable augments are the ones that read as repeatable (twin-fang/iron-stance/second-wind)", () => {
    const stackable = AUGMENT_IDS.filter((id) => AUGMENTS[id]?.stacks).sort();
    expect(stackable).toEqual(["iron-stance", "second-wind", "twin-fang"]);
  });
});

describe("isAugment (untrusted-input guard)", () => {
  it("accepts every real augment id", () => {
    for (const id of AUGMENT_IDS) expect(isAugment(id)).toBe(true);
  });
  it("rejects unknown strings + non-strings", () => {
    for (const v of ["", "Counterblade", "fireball", undefined, null, 3, {}, []])
      expect(isAugment(v)).toBe(false);
  });
});

describe("draftAugments (3-of-9 signature draft)", () => {
  it("returns AUG_DRAFT_SIZE DISTINCT valid augments", () => {
    // Walk a deterministic roll source so the test is stable.
    let i = 0;
    const seq = [0.05, 0.5, 0.95, 0.3, 0.7, 0.1, 0.9, 0.4, 0.6];
    const roll = () => seq[i++ % seq.length] ?? 0;
    for (let k = 0; k < 50; k++) {
      const draft = draftAugments(roll);
      expect(draft.length).toBe(AUG_DRAFT_SIZE);
      expect(new Set(draft).size).toBe(AUG_DRAFT_SIZE); // distinct
      for (const id of draft) expect(isAugment(id)).toBe(true);
    }
  });

  it("is deterministic for a given roll source", () => {
    const mk = () => {
      let i = 0;
      const seq = [0.2, 0.8, 0.45];
      return () => seq[i++ % seq.length] ?? 0;
    };
    expect(draftAugments(mk())).toEqual(draftAugments(mk()));
  });

  it("can surface every augment across enough rolls (the whole pool is reachable)", () => {
    const seen = new Set<string>();
    let i = 0;
    const roll = () => {
      i = (i * 9301 + 49297) % 233280; // tiny LCG → spread across [0,1)
      return i / 233280;
    };
    for (let k = 0; k < 400; k++) for (const id of draftAugments(roll)) seen.add(id);
    expect(seen.size).toBe(AUGMENT_IDS.length);
  });
});

describe("owned-augment CSV helpers (stacks)", () => {
  it("parseAugments splits the CSV + drops blanks", () => {
    expect(parseAugments("")).toEqual([]);
    expect(parseAugments("counterblade")).toEqual(["counterblade"]);
    expect(parseAugments("twin-fang,twin-fang,emberguard")).toEqual([
      "twin-fang",
      "twin-fang",
      "emberguard",
    ]);
  });
  it("countAugment counts stacks; hasAugment is the boolean", () => {
    const owned = "twin-fang,twin-fang,iron-stance,emberguard";
    expect(countAugment(owned, "twin-fang")).toBe(2);
    expect(countAugment(owned, "iron-stance")).toBe(1);
    expect(countAugment(owned, "bulwark")).toBe(0);
    expect(hasAugment(owned, "emberguard")).toBe(true);
    expect(hasAugment(owned, "bulwark")).toBe(false);
  });
});

describe("signature cadence", () => {
  it("a pick unlocks every 5th level (§12) → 6 picks over a 30-level run", () => {
    expect(SIGNATURE_INTERVAL).toBe(5);
    let picks = 0;
    for (let lvl = 1; lvl <= 30; lvl++) if (lvl % SIGNATURE_INTERVAL === 0) picks++;
    expect(picks).toBe(6);
  });
});
