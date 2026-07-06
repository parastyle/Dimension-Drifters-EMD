import { type BossDef, EnemyState, type TgSpec, type Vec2 } from "@dd/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BossController, type BossEmitSink } from "./BossController.js";

// §16 v0.109 BossController — the data-driven boss machine. These pin the phase selection, the
// telegraph windup→resolve lifecycle, and the projectile/add budget rails against a mock emit sink.

/** A recording mock sink. `hostile`/`adds` are settable so budget tests can simulate a busy arena. */
function mockSink(over: Partial<{ hostile: number; adds: number }> = {}) {
  const calls = {
    fireProjectile: [] as unknown[][],
    addTelegraph: [] as TgSpec[],
    setTelegraphProgress: [] as { id: string; t: number }[],
    removeTelegraph: [] as string[],
    updateTelegraphGeom: [] as { id: string; a: number; rot: number }[],
    damageRect: [] as { rot: number; damage: number; knockback: number }[],
    damageAnnulus: [] as { bandR: number; gapHalf: number; damage: number }[],
    dropZone: [] as unknown[][],
    spawnAdds: [] as { kind: string; spots: readonly Vec2[] }[],
    applyAoE: [] as unknown[][],
  };
  let seq = 0;
  const sink: BossEmitSink = {
    fireProjectile: (...a) => calls.fireProjectile.push(a),
    addTelegraph: (spec) => {
      calls.addTelegraph.push(spec);
      return `tg${seq++}`;
    },
    setTelegraphProgress: (id, t) => calls.setTelegraphProgress.push({ id, t }),
    removeTelegraph: (id) => calls.removeTelegraph.push(id),
    updateTelegraphGeom: (id, _x, _y, a, _b, rot) => calls.updateTelegraphGeom.push({ id, a, rot }),
    damageRect: (_x, _y, _len, _halfW, rot, damage, knockback) =>
      calls.damageRect.push({ rot, damage, knockback }),
    damageAnnulus: (_cx, _cy, bandR, _bandHalf, _gapCenter, gapHalf, damage) =>
      calls.damageAnnulus.push({ bandR, gapHalf, damage }),
    dropZone: (...a) => calls.dropZone.push(a),
    spawnAdds: (kind, spots) => calls.spawnAdds.push({ kind, spots }),
    applyAoE: (...a) => calls.applyAoE.push(a),
    hostileProjectiles: () => over.hostile ?? 0,
    aliveAdds: () => over.adds ?? 0,
  };
  return { sink, calls };
}

function boss(hp: number): EnemyState {
  const e = new EnemyState();
  e.id = "boss0";
  e.kind = "verkaln"; // a real boss body (radius/speed lookup)
  e.hp = hp;
  e.x = 1000;
  e.y = 1000;
  return e;
}

const TARGETS: Vec2[] = [{ x: 1300, y: 1000 }];

const TEST_DEF: BossDef = {
  kind: "verkaln",
  name: "Test Titan",
  move: "stationary",
  phases: [
    {
      hpAbove: 0.5,
      modules: [
        {
          primitive: "landingZone",
          cooldown: 2,
          windup: 0.5,
          params: { count: 1, radius: 100, damage: 10, knockback: 0, spread: 0 },
        },
      ],
    },
    {
      hpAbove: 0.2,
      modules: [
        {
          primitive: "bulletFan",
          cooldown: 1,
          params: { count: 6, arc: 1, speed: 300, damage: 5 },
        },
      ],
    },
    {
      hpAbove: 0,
      modules: [
        {
          primitive: "summonAdds",
          cooldown: 3,
          addKind: "mote-swarm",
          params: { count: 4, ringRadius: 100, ringJitter: 0 },
        },
      ],
    },
  ],
};

describe("BossController — phase selection by HP fraction", () => {
  it("returns the 1-based phase for the HP band (generalises bossPhaseForHp)", () => {
    const c = new BossController(TEST_DEF, 100, 1);
    const { sink } = mockSink();
    expect(c.step(0.05, boss(100), TARGETS, 1, 0, sink)).toBe(1); // frac 1 → P1
    expect(c.step(0.05, boss(30), TARGETS, 1, 1, sink)).toBe(2); // frac 0.3 → P2
    expect(c.step(0.05, boss(10), TARGETS, 1, 2, sink)).toBe(3); // frac 0.1 → P3
  });
});

describe("BossController — telegraph windup → resolve", () => {
  it("raises a telegraph on trigger, fills it, then resolves the payload + removes it at peak", () => {
    const c = new BossController(TEST_DEF, 100, 1);
    const { sink, calls } = mockSink();
    // Run ~0.6s of ticks at frac 1 (stays in P1: one landingZone, windup 0.5).
    for (let t = 0; t < 13; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);
    expect(calls.addTelegraph.length).toBe(1); // exactly one cast in the window
    expect(calls.addTelegraph[0]?.shape).toBe(0); // circle
    expect(calls.setTelegraphProgress.length).toBeGreaterThan(0); // it filled over the windup
    expect(calls.applyAoE.length).toBe(1); // resolved once at peak
    expect(calls.removeTelegraph.length).toBe(1); // and the row was cleared
  });

  it("dispose() cancels an in-flight telegraph (no orphaned rows)", () => {
    const c = new BossController(TEST_DEF, 100, 1);
    const { sink, calls } = mockSink();
    c.step(0.05, boss(100), TARGETS, 1, 0, sink); // starts a landingZone windup
    expect(calls.addTelegraph.length).toBe(1);
    c.dispose(sink);
    expect(calls.removeTelegraph).toContain("tg0");
  });

  it("a RESOLVE pins the row to t=1 before removal, but a CANCEL never does (client tells them apart)", () => {
    // Resolve: run past the windup — the last progress written before removal must be exactly 1.
    const c1 = new BossController(TEST_DEF, 100, 1);
    const r = mockSink();
    for (let t = 0; t < 13; t++) c1.step(0.05, boss(100), TARGETS, 1, t, r.sink);
    const tg0progress = r.calls.setTelegraphProgress.filter((p) => p.id === "tg0");
    expect(tg0progress.at(-1)?.t).toBe(1); // pinned full → client edge-fires the impact
    expect(r.calls.removeTelegraph).toContain("tg0");

    // Cancel: dispose mid-windup — the row is removed but its progress was never pinned to 1.
    const c2 = new BossController(TEST_DEF, 100, 1);
    const k = mockSink();
    for (let t = 0; t < 4; t++) c2.step(0.05, boss(100), TARGETS, 1, t, k.sink); // ~0.2s into a 0.5s windup
    c2.dispose(k.sink);
    const cancelProgress = k.calls.setTelegraphProgress.filter((p) => p.id === "tg0");
    expect(cancelProgress.every((p) => p.t < 1)).toBe(true); // never full → client suppresses the phantom impact
  });
});

describe("BossController — budget rails", () => {
  it("drops projectiles that would exceed the concurrent hostile budget", () => {
    const c = new BossController(TEST_DEF, 100, 1);
    const { sink, calls } = mockSink({ hostile: 200 }); // already over the 120 ceiling
    c.step(0.05, boss(30), TARGETS, 1, 0, sink); // P2 bulletFan (instant, windup 0)
    expect(calls.fireProjectile.length).toBe(0); // budget 0 → nothing fires
  });

  it("caps adds to the remaining add-budget room", () => {
    const c = new BossController(TEST_DEF, 100, 1);
    const { sink, calls } = mockSink({ adds: 11 }); // cap is 12 → room for 1 of the 4
    c.step(0.05, boss(10), TARGETS, 1, 0, sink); // P3 summonAdds (instant)
    expect(calls.spawnAdds.length).toBe(1);
    expect(calls.spawnAdds[0]?.spots.length).toBe(1);
    expect(calls.spawnAdds[0]?.kind).toBe("mote-swarm");
  });
});

describe("BossController — active hazards (beam / ring / dash)", () => {
  const hazardDef = (primitive: string, params: Record<string, number>): BossDef => ({
    kind: "nul-sightline",
    name: "Hazard Test",
    move: "stationary",
    phases: [{ hpAbove: 0, modules: [{ primitive, cooldown: 99, windup: 0.3, params }] }],
  });

  it("a beamSweep goes LIVE after its windup, sweeps its lane, damages, then expires the row", () => {
    const c = new BossController(
      hazardDef("beamSweep", { length: 800, halfWidth: 40, sweepArc: 1, duration: 0.5, dps: 30 }),
      100,
      1,
    );
    const { sink, calls } = mockSink();
    for (let t = 0; t < 20; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);
    expect(calls.damageRect.length).toBeGreaterThan(0); // dealt damage while live
    // the beam rotated across its sweep (first vs last synced angle differ)
    const rots = calls.updateTelegraphGeom.map((u) => u.rot);
    expect(Math.abs((rots.at(-1) ?? 0) - (rots[0] ?? 0))).toBeGreaterThan(0.3);
    expect(calls.removeTelegraph).toContain("tg0"); // expired + cleaned up
  });

  it("an expandingRing grows its damage band outward, then expires", () => {
    const c = new BossController(
      hazardDef("expandingRing", {
        maxR: 500,
        bandHalf: 40,
        gapAngle: 0.5,
        duration: 0.5,
        dps: 26,
      }),
      100,
      1,
    );
    const { sink, calls } = mockSink();
    for (let t = 0; t < 20; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);
    expect(calls.damageAnnulus.length).toBeGreaterThan(0);
    const bands = calls.damageAnnulus.map((d) => d.bandR);
    expect(bands.at(-1) ?? 0).toBeGreaterThan(bands[0] ?? 999); // band expanded outward
    expect(calls.removeTelegraph).toContain("tg0");
  });

  it("a dashCharge hurtles the boss body along its lane + shoves with knockback", () => {
    const c = new BossController(
      hazardDef("dashCharge", {
        reach: 600,
        halfWidth: 60,
        duration: 0.4,
        damage: 55,
        knockback: 700,
      }),
      100,
      1,
    );
    const { sink, calls } = mockSink();
    const b = boss(100); // at (1000,1000); target at (1300,1000) → dashes +x
    for (let t = 0; t < 20; t++) c.step(0.05, b, TARGETS, 1, t, sink);
    expect(b.x).toBeGreaterThan(1000); // the body moved down the lane
    expect(calls.damageRect.some((d) => d.knockback > 0)).toBe(true); // shove applied
    expect(calls.removeTelegraph).toContain("tg0");
  });
});

describe("BossController — determinism", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("same seed + same inputs → identical emit sequence (no Math.random leak)", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("boss sim must not touch Math.random");
    });
    const run = () => {
      const c = new BossController(TEST_DEF, 100, 42);
      const { sink, calls } = mockSink();
      for (let t = 0; t < 20; t++) c.step(0.05, boss(10), TARGETS, 1, t, sink);
      return calls.spawnAdds.map((s) =>
        s.spots.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`),
      );
    };
    expect(run()).toEqual(run());
    spy.mockRestore();
  });
});
