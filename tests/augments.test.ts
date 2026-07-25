import {
  AUG_DRAFT_SIZE,
  AUGMENT_IDS,
  AUGMENTS,
  augmentStackCap,
  countAugment,
  draftAugments,
  grantAugment,
  hasAugment,
  isAugment,
  parseAugments,
  SIGNATURE_INTERVAL,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("AUGMENTS registry (§8 parry pool)", () => {
  it("has 14 augments: 10 universal parry + §38 weapon-gated (2 gun, 2 cast)", () => {
    expect(AUGMENT_IDS.length).toBe(14);
    const parry = AUGMENT_IDS.filter((id) => !AUGMENTS[id]?.weapon);
    expect(parry.length).toBe(10); // the universal parry pool is unchanged
    expect(AUGMENT_IDS.filter((id) => AUGMENTS[id]?.weapon === "gun").length).toBe(2);
    expect(AUGMENT_IDS.filter((id) => AUGMENTS[id]?.weapon === "cast").length).toBe(2);
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

  it("the stackable augments read as repeatable (parry stacks + all §38 weapon augments stack)", () => {
    const stackable = AUGMENT_IDS.filter((id) => AUGMENTS[id]?.stacks).sort();
    expect(stackable).toEqual([
      "arc-split",
      "hollowpoints",
      "iron-stance",
      "overcharge",
      "ricochet-rounds",
      "second-wind",
      "twin-fang",
    ]);
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

  it("can surface every augment across enough rolls, when each weapon kind is drafted (§38 gating)", () => {
    const seen = new Set<string>();
    let i = 0;
    const roll = () => {
      i = (i * 9301 + 49297) % 233280; // tiny LCG → spread across [0,1)
      return i / 233280;
    };
    // The ungated (parry) draft can't reach the gun/cast augments — draft every weapon kind to cover the pool.
    for (let k = 0; k < 400; k++)
      for (const wk of [undefined, "gun", "cast"] as const)
        for (const id of draftAugments(roll, wk)) seen.add(id);
    expect(seen.size).toBe(AUGMENT_IDS.length);
  });

  it("§38 the ungated (parry) draft never surfaces a weapon-gated augment", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 400; k++) for (const id of draftAugments(Math.random)) seen.add(id);
    for (const id of seen) expect(AUGMENTS[id]?.weapon).toBeUndefined();
    expect(seen.size).toBe(10); // exactly the universal parry pool
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

  it("grants stackable copies while enforcing non-stackable and Arc Split caps", () => {
    const first = grantAugment("", "counterblade");
    expect(first).toEqual({ augments: "counterblade", stacks: 1, granted: true });
    expect(grantAugment(first.augments, "counterblade")).toEqual({
      augments: "counterblade",
      stacks: 1,
      granted: false,
    });

    let owned = "";
    for (let stack = 1; stack <= 4; stack++) {
      const result = grantAugment(owned, "twin-fang");
      expect(result.granted).toBe(true);
      expect(result.stacks).toBe(stack);
      owned = result.augments;
    }
    expect(countAugment(owned, "twin-fang")).toBe(4);

    expect(augmentStackCap("arc-split")).toBe(3);
    let split = "";
    for (let stack = 1; stack <= 3; stack++) split = grantAugment(split, "arc-split").augments;
    expect(grantAugment(split, "arc-split")).toEqual({
      augments: "arc-split,arc-split,arc-split",
      stacks: 3,
      granted: false,
    });
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
