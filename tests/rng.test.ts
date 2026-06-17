import { makeRng, mixSeeds, randomSeed } from "@dd/shared";
import { describe, expect, it } from "vitest";

// The PRNG is the backbone of server-seeded procgen (§17/§4): server + client MUST get the exact same
// stream from the same seed, or co-op clients desync their maps. These pin that contract directly,
// in isolation (mapgen.test.ts only exercised it transitively).

describe("makeRng — deterministic stream", () => {
  it("same seed → identical sequence (server + client reproduce it)", () => {
    const a = makeRng(123456);
    const b = makeRng(123456);
    for (let i = 0; i < 64; i++) expect(a.next()).toBe(b.next());
  });

  it("different seeds → diverging sequences", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it("next() stays in [0, 1)", () => {
    const r = makeRng(0xdecaf);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("range(min, max) stays within [min, max)", () => {
    const r = makeRng(77);
    for (let i = 0; i < 2000; i++) {
      const v = r.range(-5, 12);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(12);
    }
  });

  it("int(min, max) is an inclusive integer range hitting both ends", () => {
    const r = makeRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const v = r.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.has(1)).toBe(true); // lower bound reachable
    expect(seen.has(6)).toBe(true); // upper bound reachable (INCLUSIVE)
  });

  it("chance(p) is never-true at 0, always-true at 1, and roughly p in between", () => {
    expect(makeRng(3).chance(0)).toBe(false);
    expect(makeRng(3).chance(1)).toBe(true);
    const r = makeRng(2024);
    let hits = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (r.chance(0.25)) hits++;
    expect(hits / N).toBeGreaterThan(0.2);
    expect(hits / N).toBeLessThan(0.3);
  });

  it("pick returns an element of the array and stays in bounds", () => {
    const arr = ["a", "b", "c", "d"] as const;
    const r = makeRng(555);
    for (let i = 0; i < 1000; i++) expect(arr).toContain(r.pick(arr));
  });
});

describe("mixSeeds — collapse scalars to one 32-bit seed", () => {
  it("is deterministic for the same inputs", () => {
    expect(mixSeeds(1, 2, 3, 4)).toBe(mixSeeds(1, 2, 3, 4));
  });

  it("is order-sensitive (independent passes don't correlate)", () => {
    expect(mixSeeds(1, 2)).not.toBe(mixSeeds(2, 1));
  });

  it("a single differing input changes the mix (terrain vs hazard stay decorrelated)", () => {
    expect(mixSeeds(10, 20, 30, 40)).not.toBe(mixSeeds(10, 20, 30, 41));
  });

  it("always yields a non-negative 32-bit integer", () => {
    for (const args of [[0], [1, 2, 3], [-7, 9999999], [0xffffffff, 1]]) {
      const h = mixSeeds(...args);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("randomSeed — fresh seed scalar", () => {
  it("is always a non-zero 32-bit unsigned integer", () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1); // never 0 (a 0 seed is a degenerate stream)
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("feeds makeRng a usable, varied stream", () => {
    const r = makeRng(randomSeed());
    const first = r.next();
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
  });
});
