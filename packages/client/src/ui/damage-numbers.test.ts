import { describe, expect, it } from "vitest";
import type { DamageNumberEvent } from "../combat-feedback.js";
import type { FeedbackSettings } from "../settings.js";
import {
  DamageNumberEngine,
  type DamageNumberTuning,
  DEFAULT_DAMAGE_NUMBER_TUNING,
} from "./damage-numbers.js";

const detailed: FeedbackSettings = {
  damageNumbers: "all",
  damageNumberStyle: "detailed",
  damageNumberScale: 1,
  hitConfirmAudio: true,
  hitSparks: true,
  screenShake: 1,
  hitStop: true,
  flashes: "full",
};

function event(
  targetId: string,
  damage: number,
  extra: Partial<DamageNumberEvent> = {},
): DamageNumberEvent {
  return {
    targetId,
    damage,
    x: 100,
    y: 80,
    visible: true,
    attribution: "self",
    crit: false,
    finalBlow: false,
    selfDamage: false,
    ...extra,
  };
}

function tuning(patch: Partial<DamageNumberTuning> = {}): DamageNumberTuning {
  return { ...DEFAULT_DAMAGE_NUMBER_TUNING, ...patch };
}

describe("DamageNumberEngine accumulator math", () => {
  it("spends four per-target tokens, then latches and sums sustained damage exactly", () => {
    const engine = new DamageNumberEngine();
    engine.beginFrame();
    for (let i = 0; i < 4; i++)
      expect(engine.ingest(event("enemy", 3), 0, detailed)).toBeGreaterThanOrEqual(0);
    const accumulator = engine.ingest(event("enemy", 5), 0, detailed);
    expect(accumulator).toBeGreaterThanOrEqual(0);
    engine.ingest(event("enemy", 7), 50, detailed);
    expect(engine.inspectAccumulator("enemy")?.value).toBe(12);
  });

  it("ticks display value toward the exact total and releases 300ms after stream end", () => {
    const engine = new DamageNumberEngine();
    const aggregate = { ...detailed, damageNumberStyle: "aggregate" as const };
    engine.beginFrame();
    const slot = engine.ingest(event("beam-target", 100), 0, aggregate);
    expect(engine.inspectAccumulator("beam-target")?.displayValue).toBe(0);
    engine.update(90, 90);
    const after = engine.inspectAccumulator("beam-target")?.displayValue ?? 0;
    expect(after).toBeGreaterThan(60);
    expect(after).toBeLessThan(100);
    engine.update(299, 100);
    expect(engine.inspectAccumulator("beam-target")).toBeDefined();
    engine.update(300, 1);
    expect(engine.inspectAccumulator("beam-target")).toBeUndefined();
    expect(engine.view(slot)?.displayValue).toBe(100);
  });

  it("gold-flashes an accumulator once per crit quantum without spawning another slot", () => {
    const engine = new DamageNumberEngine();
    const aggregate = { ...detailed, damageNumberStyle: "aggregate" as const };
    engine.beginFrame();
    const slot = engine.ingest(event("enemy", 10), 0, aggregate);
    const same = engine.ingest(event("enemy", 6, { crit: true }), 50, aggregate);
    expect(same).toBe(slot);
    expect(engine.activeCount).toBe(1);
    expect(engine.inspectAccumulator("enemy")).toMatchObject({ value: 16, critFlashMs: 150 });
    engine.update(150, 100);
    expect(engine.inspectAccumulator("enemy")?.critFlashMs).toBe(50);
    engine.update(210, 60);
    expect(engine.inspectAccumulator("enemy")?.critFlashMs).toBe(0);
  });

  it("banks rather than drops when the live pool is full, then materializes the exact sum", () => {
    const engine = new DamageNumberEngine(tuning({ maxLabels: 1 }));
    engine.beginFrame();
    engine.ingest(event("first", 4), 0, detailed);
    expect(
      engine.ingest(event("banked", 9), 0, { ...detailed, damageNumberStyle: "aggregate" }),
    ).toBe(-1);
    for (let now = 100; now <= 700; now += 100) {
      engine.beginFrame();
      engine.update(now, 100);
    }
    expect(engine.inspectAccumulator("banked")?.value).toBe(9);
  });
});

describe("DamageNumberEngine filtering and budgets", () => {
  it("filters before folding in own-only mode so teammate arithmetic cannot inflate the label", () => {
    const engine = new DamageNumberEngine();
    const ownOnly = {
      ...detailed,
      damageNumbers: "own" as const,
      damageNumberStyle: "aggregate" as const,
    };
    engine.beginFrame();
    expect(engine.ingest(event("enemy", 12, { attribution: "teammate" }), 0, ownOnly)).toBe(-1);
    engine.ingest(event("enemy", 5), 0, ownOnly);
    expect(engine.inspectAccumulator("enemy")?.value).toBe(5);
  });

  it("keeps self-damage distinct and exempt from the per-frame spawn budget", () => {
    const engine = new DamageNumberEngine(tuning({ frameSpawnBudget: 0 }));
    engine.beginFrame();
    const slot = engine.ingest(
      event("self", 11, { selfDamage: true, attribution: "self" }),
      0,
      detailed,
    );
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(engine.view(slot)).toMatchObject({ selfDamage: true, value: 11 });
  });

  it("turns aggregate-only mode into one climbing label from the first delta", () => {
    const engine = new DamageNumberEngine();
    const aggregate = { ...detailed, damageNumberStyle: "aggregate" as const };
    engine.beginFrame();
    const first = engine.ingest(event("enemy", 2), 0, aggregate);
    const second = engine.ingest(event("enemy", 3), 40, aggregate);
    expect(second).toBe(first);
    expect(engine.inspectAccumulator("enemy")?.value).toBe(5);
  });
});

describe("DamageNumberEngine flush laws", () => {
  it("flushes a latched accumulator immediately when the authoritative delta is final", () => {
    const engine = new DamageNumberEngine();
    const aggregate = { ...detailed, damageNumberStyle: "aggregate" as const };
    engine.beginFrame();
    const slot = engine.ingest(event("enemy", 12), 0, aggregate);
    expect(engine.inspectAccumulator("enemy")).toBeDefined();
    expect(engine.ingest(event("enemy", 8, { finalBlow: true }), 40, aggregate)).toBe(slot);
    expect(engine.inspectAccumulator("enemy")).toBeUndefined();
    expect(engine.view(slot)).toMatchObject({
      value: 20,
      displayValue: 20,
      finalBlow: true,
      anchored: false,
    });
  });

  it("detaches a live accumulator when its target despawns", () => {
    const engine = new DamageNumberEngine();
    const aggregate = { ...detailed, damageNumberStyle: "aggregate" as const };
    engine.beginFrame();
    const slot = engine.ingest(event("enemy", 9), 0, aggregate);
    engine.targetGone("enemy");
    expect(engine.inspectAccumulator("enemy")).toBeUndefined();
    expect(engine.view(slot)).toMatchObject({ value: 9, anchored: false });
  });
});
