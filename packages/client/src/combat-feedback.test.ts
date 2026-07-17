import { CombatDelivery } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  CombatFeedback,
  type CombatReceiptLike,
  type CombatReceiptRows,
  MagnitudeCoalescer,
  TokenBucket,
} from "./combat-feedback.js";

class Rows implements CombatReceiptRows {
  constructor(readonly rows: CombatReceiptLike[]) {}

  forEach(callback: (row: CombatReceiptLike, id: string | number) => void): void {
    this.rows.forEach((row, index) => {
      callback(row, index);
    });
  }
}

function receipt(seq: number, targetId: string, extra: Partial<CombatReceiptLike> = {}) {
  return {
    seq,
    tick: seq,
    targetId,
    sourcePlayerId: "self",
    weaponId: "test",
    delivery: CombatDelivery.Melee,
    element: "physical",
    dirX: 1,
    dirY: 0,
    damage: 10,
    crit: false,
    finalBlow: false,
    ...extra,
  } satisfies CombatReceiptLike;
}

describe("CombatFeedback receipt reader", () => {
  it("baselines on attach, deduplicates, and dispatches fresh rows in ascending order", () => {
    const bus = new CombatFeedback();
    const seen: number[] = [];
    bus.subscribeContact((event) => seen.push(event.tick));
    const rows = new Rows([receipt(8, "old-a"), receipt(10, "old-b")]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");
    expect(seen).toEqual([]);

    rows.rows[0] = receipt(12, "later");
    rows.rows[1] = receipt(11, "first");
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self");
    bus.drainReceipts(rows, "self");
    expect(seen).toEqual([11, 12]);
  });

  it("orders uint32 wrap, skips zero, and counts overwritten gaps without stalling", () => {
    const bus = new CombatFeedback();
    const seen: number[] = [];
    bus.subscribeContact((event) => seen.push(event.tick));
    const rows = new Rows([receipt(0xffff_fffe, "base"), { seq: 0 }]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");

    rows.rows[0] = receipt(1, "after-wrap");
    rows.rows[1] = receipt(0xffff_ffff, "at-wrap");
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self");
    expect(seen).toEqual([0xffff_ffff, 1]);
    expect(bus.receiptsDropped).toBe(0);

    rows.rows[0] = receipt(4, "gap");
    rows.rows[1] = { seq: 0 };
    bus.beginFrame(100);
    bus.drainReceipts(rows, "self");
    expect(seen.at(-1)).toBe(4);
    expect(bus.receiptsDropped).toBe(2);
  });

  it("matches prediction by target and delivery family, then emits only the receipt upgrade", () => {
    const bus = new CombatFeedback();
    const layers: string[] = [];
    bus.subscribeContact((event) => layers.push(event.layer));
    const rows = new Rows([receipt(1, "baseline")]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");
    bus.onPredictedContact({ targetId: "enemy", delivery: CombatDelivery.Melee }, 10);
    rows.rows[0] = receipt(2, "enemy", { crit: true });
    bus.drainReceipts(rows, "self", 100);
    expect(layers).toEqual(["instant", "upgrade"]);

    rows.rows[0] = receipt(3, "unpredicted");
    bus.beginFrame(400);
    bus.drainReceipts(rows, "self", 400);
    expect(layers.at(-1)).toBe("full");
  });

  it("keeps confirms owner-only and marks receipt-touched for exactly one frame", () => {
    const bus = new CombatFeedback();
    const confirms: string[] = [];
    bus.subscribeConfirm((event) => confirms.push(event.cue));
    const rows = new Rows([receipt(1, "baseline")]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");
    rows.rows[0] = receipt(2, "enemy", { sourcePlayerId: "teammate" });
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    bus.endFrame(50);
    expect(confirms).toEqual([]);
    expect(bus.wasReceiptTouched("enemy")).toBe(true);
    bus.beginFrame(60);
    expect(bus.wasReceiptTouched("enemy")).toBe(false);
  });
});

describe("CombatFeedback digit honesty", () => {
  it("never emits a number from receipt damage and uses the exact HP delta", () => {
    const bus = new CombatFeedback();
    const shown: Array<{ damage: number; crit: boolean }> = [];
    bus.subscribeDamage((event) => shown.push({ damage: event.damage, crit: event.crit }));
    const rows = new Rows([receipt(1, "baseline")]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");
    rows.rows[0] = receipt(2, "enemy", { damage: 99, crit: true });
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    expect(shown).toEqual([]);
    bus.ingestHpDelta({ targetId: "enemy", damage: 7, x: 1, y: 2, visible: true }, 50);
    expect(shown).toEqual([{ damage: 7, crit: true }]);
  });

  it("degrades incomplete receipt coverage to mixed attribution instead of fabricating ownership", () => {
    const bus = new CombatFeedback();
    let attribution = "";
    bus.subscribeDamage((event) => {
      attribution = event.attribution;
    });
    const rows = new Rows([receipt(1, "baseline")]);
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self");
    rows.rows[0] = receipt(2, "enemy", { damage: 3 });
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    bus.ingestHpDelta({ targetId: "enemy", damage: 10, x: 0, y: 0, visible: true }, 50);
    expect(attribution).toBe("mixed");
  });
});

describe("shared rate-compression primitives", () => {
  it("refills a token bucket over elapsed time and enforces its burst cap", () => {
    const bucket = new TokenBucket(2, 2);
    expect(bucket.tryTake(0)).toBe(true);
    expect(bucket.tryTake(0)).toBe(true);
    expect(bucket.tryTake(0)).toBe(false);
    expect(bucket.tryTake(249)).toBe(false);
    expect(bucket.tryTake(500)).toBe(true);
  });

  it("coalesces count, exact total, and strongest magnitude", () => {
    const merge = new MagnitudeCoalescer();
    merge.add(3);
    merge.add(8);
    merge.add(5);
    expect(merge).toMatchObject({ count: 3, total: 16, strongest: 8 });
    merge.clear();
    expect(merge).toMatchObject({ count: 0, total: 0, strongest: 0 });
  });
});

describe("CombatFeedback attach and degradation regressions", () => {
  it("baselines an empty attached ring without swallowing its first later receipt", () => {
    const bus = new CombatFeedback();
    const seen: number[] = [];
    const rows = new Rows([{ seq: 0 }, { seq: 0 }]);
    bus.subscribeContact((event) => seen.push(event.tick));
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self", 0);
    rows.rows[0] = receipt(1, "first-live");
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    expect(seen).toEqual([1]);
  });

  it("keeps exact digits but removes every receipt-only decoration after incomplete coverage", () => {
    const bus = new CombatFeedback();
    let shown:
      | { damage: number; attribution: string; crit: boolean; finalBlow: boolean }
      | undefined;
    const rows = new Rows([receipt(1, "baseline")]);
    bus.subscribeDamage((event) => {
      shown = {
        damage: event.damage,
        attribution: event.attribution,
        crit: event.crit,
        finalBlow: event.finalBlow,
      };
    });
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self", 0);
    rows.rows[0] = receipt(2, "wrapped-target", {
      damage: 3,
      crit: true,
      finalBlow: true,
    });
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    bus.ingestHpDelta({ targetId: "wrapped-target", damage: 10, x: 0, y: 0, visible: true }, 50);
    expect(shown).toEqual({
      damage: 10,
      attribution: "mixed",
      crit: false,
      finalBlow: false,
    });
  });

  it("plays the predicted instant confirm once and lets a matched receipt add only its crit upgrade", () => {
    const bus = new CombatFeedback();
    const cues: string[] = [];
    const layers: string[] = [];
    const rows = new Rows([receipt(1, "baseline")]);
    bus.subscribeConfirm((event) => cues.push(event.cue));
    bus.subscribeContact((event) => layers.push(event.layer));
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self", 0);
    bus.onPredictedContact({ targetId: "enemy", delivery: CombatDelivery.Melee }, 10);
    bus.endFrame(10);
    bus.beginFrame(100);
    rows.rows[0] = receipt(2, "enemy", { crit: true });
    bus.drainReceipts(rows, "self", 100);
    expect(layers).toEqual(["instant", "upgrade"]);
    expect(cues).toEqual(["confirm:hit", "confirm:crit"]);
  });
});

describe("CombatFeedback confirm compression", () => {
  it("coalesces a same-frame receipt burst into one discrete confirm tick", () => {
    const bus = new CombatFeedback();
    const cues: string[] = [];
    const rows = new Rows([receipt(1, "baseline"), { seq: 0 }, { seq: 0 }, { seq: 0 }]);
    bus.subscribeConfirm((event) => cues.push(event.cue));
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self", 0);

    rows.rows[0] = receipt(2, "a");
    rows.rows[1] = receipt(3, "b");
    rows.rows[2] = receipt(4, "c");
    rows.rows[3] = receipt(5, "d");
    bus.beginFrame(50);
    bus.drainReceipts(rows, "self", 50);
    bus.endFrame(50);
    expect(cues).toEqual(["confirm:hit"]);
  });

  it("uses distinct beam targets, not receipt count, for pulse density", () => {
    const pulseFor = (targetIds: string[]): number => {
      const bus = new CombatFeedback();
      let amount = -1;
      const rows = new Rows([
        receipt(1, "baseline"),
        ...targetIds.slice(1).map(() => ({ seq: 0 })),
      ]);
      bus.subscribeConfirm((event) => {
        if (event.cue === "confirm:hit") amount = event.amount;
      });
      bus.beginFrame(0);
      bus.drainReceipts(rows, "self", 0);
      targetIds.forEach((targetId, index) => {
        rows.rows[index] = receipt(index + 2, targetId, {
          delivery: CombatDelivery.Beam,
        });
      });
      bus.beginFrame(50);
      bus.drainReceipts(rows, "self", 50);
      bus.endFrame(50);
      return amount;
    };

    const repeatedTarget = pulseFor(["a", "a", "a", "a"]);
    const distinctTargets = pulseFor(["a", "b", "c", "d"]);
    expect(repeatedTarget).toBeGreaterThanOrEqual(0.2);
    expect(distinctTargets).toBeGreaterThan(repeatedTarget);
  });

  it("enters the granular ratchet only after five distinct active frames", () => {
    const bus = new CombatFeedback();
    const cues: string[] = [];
    const rows = new Rows([receipt(1, "baseline")]);
    bus.subscribeConfirm((event) => cues.push(event.cue));
    bus.beginFrame(0);
    bus.drainReceipts(rows, "self", 0);

    for (let seq = 2; seq <= 6; seq++) {
      const nowMs = (seq - 1) * 50;
      rows.rows[0] = receipt(seq, `enemy-${seq}`);
      bus.beginFrame(nowMs);
      bus.drainReceipts(rows, "self", nowMs);
      bus.endFrame(nowMs);
    }
    expect(cues).toContain("confirm:ratchet");
  });
});
