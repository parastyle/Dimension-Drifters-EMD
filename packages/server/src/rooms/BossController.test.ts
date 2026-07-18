import {
  type BossDef,
  DIMENSIONS,
  EnemyState,
  bossDefFor,
  type TgSpec,
  type Vec2,
} from "@dd/shared";
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
    applyQuake: [] as unknown[][],
    applyMelee: [] as { x: number; y: number; range: number; halfArc: number; damage: number }[],
    moveBoss: [] as { x: number; y: number }[],
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
    applyQuake: (...a) => calls.applyQuake.push(a),
    applyMelee: (x, y, _aimX, _aimY, range, halfArc, damage, _knockback) =>
      calls.applyMelee.push({ x, y, range, halfArc, damage }),
    moveBoss: (x, y) => calls.moveBoss.push({ x, y }),
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

  it("limits hazard damage to a non-tick-aligned authored duration", () => {
    const c = new BossController(
      hazardDef("beamSweep", {
        length: 800,
        halfWidth: 40,
        sweepArc: 1,
        duration: 0.38,
        dps: 100,
      }),
      100,
      1,
    );
    const { sink, calls } = mockSink();
    for (let t = 0; t < 20; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);

    const totalDamage = calls.damageRect.reduce((sum, hit) => sum + hit.damage, 0);
    expect(totalDamage).toBeCloseTo(0.38 * 100, 10); // 0.38s of DPS, not a rounded-up 0.40s
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

describe("BossController — §16 Slice 3 melee trio (meleeCombo / blinkStrike)", () => {
  const meleeDef: BossDef = {
    kind: "kaido",
    name: "Melee Test",
    move: "chase",
    phases: [
      {
        hpAbove: 0,
        modules: [
          {
            primitive: "meleeCombo",
            cooldown: 99,
            windup: 0.4,
            params: { range: 200, halfArc: 0.7, damage: 15, knockback: 440 },
          },
        ],
      },
    ],
  };

  it("a meleeCombo raises a PARRYABLE white cone, then resolves ONE melee arc at peak", () => {
    const c = new BossController(meleeDef, 100, 1);
    const { sink, calls } = mockSink();
    for (let t = 0; t < 12; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);
    const cone = calls.addTelegraph[0];
    expect(cone?.shape).toBe(2); // TgShape.Cone
    expect(cone?.danger).toBe(0); // TELEGRAPH_PARRYABLE — you PARRY this one (white)
    expect(cone?.kindTag).toBe(6); // parryable melee arc
    expect(calls.applyMelee.length).toBe(1); // resolved a single swing
    expect(calls.applyMelee[0]?.damage).toBeCloseTo(15); // depth 1 → base damage
    expect(calls.removeTelegraph).toContain("tg0"); // row cleaned up
  });

  it("a boss PLANTS its feet while a meleeCombo winds up (the arc stays co-located)", () => {
    const c = new BossController(meleeDef, 100, 1);
    const { sink } = mockSink();
    const b = boss(100); // at (1000,1000), target far to the +x → would normally chase
    c.step(0.05, b, TARGETS, 1, 0, sink); // triggers the windup this tick
    const xAfterTrigger = b.x;
    for (let t = 1; t < 6; t++) c.step(0.05, b, TARGETS, 1, t, sink); // still winding up
    expect(b.x).toBe(xAfterTrigger); // frozen — did not chase while the swing is committed
  });

  const blinkDef: BossDef = {
    kind: "nihil",
    name: "Blink Test",
    move: "kite",
    phases: [
      {
        hpAbove: 0,
        modules: [
          {
            primitive: "blinkStrike",
            cooldown: 99,
            windup: 0.4,
            params: { offset: 80, radius: 130, damage: 20, knockback: 620 },
          },
        ],
      },
    ],
  };

  it("a blinkStrike TELEPORTS the boss to the strike spot, then slams THERE", () => {
    const c = new BossController(blinkDef, 100, 1);
    const { sink, calls } = mockSink();
    for (let t = 0; t < 12; t++) c.step(0.05, boss(100), TARGETS, 1, t, sink);
    expect(calls.moveBoss.length).toBe(1); // it blinked once
    expect(calls.applyAoE.length).toBe(1); // and slammed
    const dest = calls.moveBoss[0];
    const slam = calls.applyAoE[0]; // [x, y, radius, damage, knockback]
    // WYSIWYG: the teleport destination and the slam share the same spot (near the target).
    expect(slam?.[0]).toBeCloseTo(dest?.x ?? -1);
    expect(slam?.[1]).toBeCloseTo(dest?.y ?? -1);
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

describe("§36 dimension finale bosses — each level plays a distinct fight", () => {
  it("every dimension's boss resolves to a bespoke def (not the CLASSIC fallback)", () => {
    for (const dim of Object.values(DIMENSIONS)) {
      const def = bossDefFor(dim.boss);
      // The CLASSIC fallback is named "Old Rust"; only the wild-west drifter may map onto a def whose
      // NAME differs from its themed kind — but none may fall through to the generic classic clone.
      expect(def, `${dim.id} boss "${dim.boss}"`).toBeDefined();
      expect(def.kind, `${dim.id} boss "${dim.boss}" fell back to CLASSIC`).not.toBe("classic");
    }
  });
  it("maps the five dimensions onto five DISTINCT fights (no two levels share a boss)", () => {
    const kinds = Object.values(DIMENSIONS).map((d) => bossDefFor(d.boss).kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe("improve2 G-06 Serraketh authored action reachability", () => {
  it("fires the tail reap and post-split spinner quake through one synced major-action lane", async () => {
    const shared = await import("@dd/shared");
    const def = bossDefFor("seam-eater");
    const root = new EnemyState();
    root.id = "serraketh-actions";
    root.kind = "seam-eater";
    root.hp = 1000;
    root.x = 1000;
    root.y = 1000;
    const state = new shared.WormBossState();
    const controller = new BossController(def, 1000, 77);
    controller.attachWorm(state, root, 0, 0);
    const { sink, calls } = mockSink();

    for (let tick = 1; tick <= 30; tick++) {
      controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    }
    expect(state.actionKind).toBe(shared.WormActionKind.StitchReap);
    expect(state.actionResolveTick - state.actionStartTick).toBe(11);
    expect(calls.addTelegraph.at(-1)?.kindTag).toBe(9);
    expect(calls.addTelegraph.at(-1)?.danger).toBe(shared.TELEGRAPH_PARRYABLE);
    const tailSlot = state.actionEmitterSlot;
    for (let tick = 31; tick <= 41; tick++) {
      controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    }
    expect(calls.applyMelee).toHaveLength(1);
    expect(controller.acceptWormParry("p1", 41)).toBe(true);
    expect(controller.wormRuntime?.armorBand[tailSlot]).toBe(shared.WormArmorBand.Exposed);

    root.hp = 600; // phase 2 first commits the authored split, then alternates to Rib Quake
    let ribStart = -1;
    for (let tick = 42; tick < 360; tick++) {
      controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
      if (state.actionKind === shared.WormActionKind.RibQuake) {
        ribStart = tick;
        break;
      }
    }
    expect(ribStart).toBeGreaterThan(0);
    expect(state.actionResolveTick - state.actionStartTick).toBe(16);
    expect(calls.addTelegraph.at(-1)?.kindTag).toBe(7);
    const quakesBefore = calls.applyQuake.length;
    for (let tick = ribStart + 1; tick <= state.actionResolveTick; tick++) {
      controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    }
    expect(calls.applyQuake.length).toBe(quakesBefore + 1);
    expect(state.actionKind).toBe(shared.WormActionKind.RibQuake);
  });
});

// Integration harness for the GameRoom catch-up/broadcast boundary. Kept here with the controller lifecycle
// tests so the regression directly pins the contract between BossController.step() and GameRoom.update().
vi.mock("colyseus", () => {
  class Room {
    state: unknown;
    clients: { sessionId: string }[] = [];
    roomId = "test";
    setState(s: unknown) {
      this.state = s;
    }
    onMessage() {}
    setSimulationInterval() {}
    setPatchRate() {}
    broadcast() {}
    broadcastPatch() {}
  }
  return { Room, Client: class {} };
});

const { GameRoom: TelegraphTestRoom } = await import("./GameRoom.js");

describe("BossController — settled telegraph broadcast retention", () => {
  it("keeps t=1 through a multi-substep update broadcast, then deletes it on the next update", () => {
    // biome-ignore lint/suspicious/noExplicitAny: integration test intentionally injects private boss runtime.
    const room = new TelegraphTestRoom() as any;
    room.onMessage = () => {};
    room.clients = [{ sessionId: "p1" }];
    room.roomId = "telegraph-settle";
    room.onCreate();
    room.onJoin({ sessionId: "p1" });

    const settleDef: BossDef = {
      kind: "verkaln",
      name: "Settle Test",
      move: "stationary",
      phases: [
        {
          hpAbove: 0,
          modules: [
            {
              primitive: "landingZone",
              cooldown: 99,
              windup: 0.1,
              params: { count: 1, radius: 100, damage: 0, knockback: 0, spread: 0 },
            },
          ],
        },
      ],
    };
    const liveBoss = boss(100);
    room.state.enemies.set(liveBoss.id, liveBoss);
    room.bossId = liveBoss.id;
    room.bossSpawned = true;
    room.bossController = new BossController(settleDef, liveBoss.hp, 1);

    const broadcasts: { size: number; t?: number }[] = [];
    room.broadcastPatch = () => {
      const row = room.state.telegraphs.values().next().value;
      broadcasts.push({ size: room.state.telegraphs.size, t: row?.t });
    };

    room.update(50); // trigger the 100ms windup
    room.update(150); // three substeps: fill → settle → formerly delete, then one broadcast

    expect(broadcasts.at(-1)).toEqual({ size: 1, t: 1 });
    expect(room.state.telegraphs.size).toBe(1);
    expect(room.state.telegraphs.values().next().value?.t).toBe(1);

    room.update(50); // the preceding t=1 generation has now been broadcast
    expect(room.state.telegraphs.size).toBe(0);
    expect(broadcasts.at(-1)).toEqual({ size: 0, t: undefined });
  });
});

// Wave 1 append-only coverage: fixed-cap authoritative Serraketh runtime/director.
const wormShared = await import("@dd/shared");
const wormServer = await import("./BossController.js");

function makeWormRuntime() {
  const state = new wormShared.WormBossState();
  const def = bossDefFor("seam-eater").worm!;
  const root = new EnemyState();
  root.id = "serraketh-root";
  root.kind = def.rootKind;
  root.hp = def.baseCoreHp;
  root.x = 900;
  root.y = 800;
  const runtime = new wormServer.WormBossRuntime(
    state,
    def,
    root.hp,
    0x51ea,
    root.id,
    root.x,
    root.y,
    0,
    0,
  );
  return { state, def, root, runtime };
}

describe("Serraketh wave 1 — authoritative chain", () => {
  it("holds role-specific follow spacing from one current-tick arc-length history", () => {
    const { runtime, root } = makeWormRuntime();
    const target = [{ x: 2800, y: 800 }];
    for (let tick = 1; tick <= 120; tick++) {
      runtime.advance(0.05, root, target, tick);
      for (let i = 1; i < runtime.mainCount; i++) {
        const a = runtime.orderSlot(wormShared.WormChain.Main, i - 1);
        const b = runtime.orderSlot(wormShared.WormChain.Main, i);
        const wanted =
          wormShared.WORM_PATH_OVERLAP_FACTOR *
          (runtime.segmentRadius(a) + runtime.segmentRadius(b));
        const actual = Math.hypot(runtime.x[a]! - runtime.x[b]!, runtime.y[a]! - runtime.y[b]!);
        expect(Math.abs(actual - wanted)).toBeLessThanOrEqual(Math.max(3, wanted * 0.05));
      }
    }
  });

  it("splits only the documented central seam into one headless tailward stub", () => {
    const { runtime, state } = makeWormRuntime();
    const before = state.topologySeq;
    expect(runtime.triggerSplit(5, 20)).toBe(true);
    expect(state.topologySeq).toBe(before + 1);
    expect(runtime.mainCount).toBe(5);
    expect(runtime.stubCount).toBe(4);
    expect(Array.from({ length: runtime.mainCount }, (_, i) => runtime.orderSlot(wormShared.WormChain.Main, i)))
      .toEqual([0, 1, 2, 3, 4]);
    expect(Array.from({ length: runtime.stubCount }, (_, i) => runtime.orderSlot(wormShared.WormChain.Stub, i)))
      .toEqual([6, 7, 8, 9]);
    expect(runtime.role[runtime.orderSlot(wormShared.WormChain.Stub, 0)]).not.toBe(
      wormShared.WormSegmentRole.Head,
    );
    expect(state.splitActive).toBe(true);
    expect(runtime.activeCount).toBe(9);
  });

  it("regrows Body slots only and never exceeds the twelve-part cap", () => {
    const { runtime, state } = makeWormRuntime();
    expect(runtime.beginRegrow(1, 4)).toBe(2); // only two dormant Body slots exist before the scripted split
    expect(runtime.effectiveBodyCount).toBe(12);
    expect(runtime.resolveRegrow(111)).toBe(2);
    expect(runtime.activeCount).toBe(wormShared.WORM_MAX_SEGMENTS);
    expect(state.activeMask.toString(2).split("1").length - 1).toBe(wormShared.WORM_MAX_SEGMENTS);
    for (let slot = 10; slot < 12; slot++) {
      expect(runtime.role[slot]).toBe(wormShared.WormSegmentRole.Body);
      expect(runtime.generation[slot]).toBe(1);
      expect(runtime.rewardPaid[slot]).toBe(1);
    }
    expect(runtime.beginRegrow(200, 4)).toBe(0);
  });

  it("keeps the 13/25/18-tick dive, bulge travel, and fixed eruption claim laws", () => {
    const state = new wormShared.WormBossState();
    const def = bossDefFor("seam-eater");
    const root = new EnemyState();
    root.id = "serraketh-root";
    root.kind = def.worm!.rootKind;
    root.hp = def.worm!.baseCoreHp;
    root.x = 900;
    root.y = 800;
    const controller = new BossController(def, root.hp, 7);
    controller.attachWorm(state, root, 0, 0);
    const { sink, calls } = mockSink();
    expect(controller.startWormBurrow({ x: 1400, y: 900 }, 0, 25)).toBe(true);
    for (let tick = 0; tick < 12; tick++) controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    expect(state.mode).toBe(wormShared.WormBossMode.Submerging);
    controller.step(0.05, root, TARGETS, 1, 12, sink, 12);
    expect(state.mode).toBe(wormShared.WormBossMode.Underground);
    expect(state.targetableMask).toBe(0);
    for (let tick = 13; tick <= 38; tick++) controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    expect(state.mode).toBe(wormShared.WormBossMode.EruptionClaim);
    expect(state.actionResolveTick - state.actionStartTick).toBe(wormShared.WORM_ERUPTION_CLAIM_TICKS);
    expect(calls.addTelegraph.at(-1)?.a).toBe(wormShared.WORM_ERUPTION_RADIUS);
    for (let tick = 39; tick <= 56; tick++) controller.step(0.05, root, TARGETS, 1, tick, sink, tick);
    expect(calls.applyAoE).toHaveLength(1);
    expect(state.mode).toBe(wormShared.WormBossMode.Emerging);
  });

  it("deduplicates a named chain contact to one hit per 350ms epoch", () => {
    const { state, root } = makeWormRuntime();
    const def = bossDefFor("seam-eater");
    const controller = new BossController(def, root.hp, 3);
    controller.attachWorm(state, root, 0, 0);
    expect(controller.acceptWormContact("p1", wormShared.WormChain.Main, 20)).toBe(true);
    expect(controller.acceptWormContact("p1", wormShared.WormChain.Main, 20)).toBe(false);
    expect(controller.acceptWormContact("p1", wormShared.WormChain.Main, 26)).toBe(false);
    expect(controller.acceptWormContact("p1", wormShared.WormChain.Main, 28)).toBe(true);
  });
});

// VASTAGHAR bot 1 append-only coverage: the flagship's server-owned action/phase/mutation/reward clock.
const vastShared = await import("@dd/shared");
const vastServer = await import("./BossController.js");

type VastAnswer = "miss" | "jump" | "parry";

function makeVastagharHarness(answer: VastAnswer = "miss", liveAdds = 0) {
  const base = mockSink({ adds: liveAdds });
  const mutations: { kind: number; poiIndex: number }[] = [];
  const addCounts: number[] = [];
  const answerMode = { value: answer };
  const fill = (out: import("@dd/shared").BossCounterSummary) => {
    out.threatened = 1;
    out.answered = answerMode.value === "miss" ? 0 : 1;
    out.parried = answerMode.value === "parry" ? 1 : 0;
    out.airborne = answerMode.value === "jump" ? 1 : 0;
    out.hit = answerMode.value === "miss" ? 1 : 0;
    out.lastParrierId = answerMode.value === "parry" ? "p1" : "";
  };
  const sink = Object.assign(base.sink, {
    applyVastagharQuake: (
      _x: number,
      _y: number,
      _radius: number,
      _damage: number,
      _knockback: number,
      _epoch: number,
      out: import("@dd/shared").BossCounterSummary,
    ) => fill(out),
    applyVastagharSweep: (
      _x: number,
      _y: number,
      _inner: number,
      _outer: number,
      _halfWidth: number,
      _from: number,
      _to: number,
      _damage: number,
      _knockback: number,
      _actionSeq: number,
      _revolution: number,
      _airborne: boolean,
      out: import("@dd/shared").BossCounterSummary,
    ) => fill(out),
    mutateVastagharArena: (kind: number, poiIndex: number) => mutations.push({ kind, poiIndex }),
    spawnAdds: (_kind: string, spots: readonly Vec2[]) => addCounts.push(spots.length),
  }) as import("./BossController.js").VastagharEmitSink;
  const state = new vastShared.VastagharBossState();
  const root = new EnemyState();
  root.id = "vastaghar-root";
  root.kind = "world-titan";
  root.hp = 1900;
  root.x = 1200;
  root.y = 1200;
  const runtime = new vastServer.VastagharEncounterRuntime(
    vastShared.VASTAGHAR_ENCOUNTER,
    state,
    root.hp,
    root.id,
    0,
    5,
    1500,
    1200,
    6,
    1200,
    1500,
  );
  const targets: import("./BossController.js").VastagharTarget[] = [
    { id: "p1", x: 1300, y: 1200, alive: true, downTick: 0, recentBossDamage: 0 },
    { id: "p2", x: 1000, y: 1200, alive: true, downTick: 0, recentBossDamage: 0 },
  ];
  return { runtime, state, root, sink, targets, mutations, addCounts, answerMode };
}

function stepVastaghar(
  h: ReturnType<typeof makeVastagharHarness>,
  fromTick: number,
  toTick: number,
): void {
  for (let tick = fromTick; tick <= toTick; tick++)
    h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
}

function reachVastagharPhase(
  h: ReturnType<typeof makeVastagharHarness>,
  phase: import("@dd/shared").VastagharPhase,
  startTick: number,
): number {
  for (let tick = startTick; tick < startTick + 1000; tick++) {
    h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
    if (h.state.phase === phase && h.state.mode !== vastShared.VastagharMode.Transition) return tick;
  }
  throw new Error(`phase ${phase} was not reached`);
}

describe("Vastaghar flagship — authored 20 Hz authority", () => {
  it("admits one 70/35/8 threshold at a time and publishes each visible transition sequence", () => {
    const h = makeVastagharHarness("miss");
    stepVastaghar(h, 0, 88);
    const p1Damage = h.runtime.capIncomingDamage(h.root.hp, 1900 * 0.3, "p1", "pound", 1, 0, 0);
    h.root.hp -= p1Damage;
    const p2Tick = reachVastagharPhase(h, vastShared.VastagharPhase.BreakStride, 89);
    expect(h.state.maxHp).toBe(1900);
    expect(h.mutations[0]).toEqual({
      kind: vastShared.VastagharArenaMutationKind.StuckStep,
      poiIndex: 5,
    });

    const p2Damage = h.runtime.capIncomingDamage(h.root.hp, 1900 * 0.35, "p1", "ultimate", 6, 0, 0);
    h.root.hp -= p2Damage;
    const p3Tick = reachVastagharPhase(h, vastShared.VastagharPhase.UnderHeel, p2Tick + 1);
    expect(h.mutations.some((m) => m.kind === vastShared.VastagharArenaMutationKind.WorldTurn)).toBe(true);

    const p3Damage = h.runtime.capIncomingDamage(h.root.hp, 1900 * 0.27, "p2", "pound", 1, 0, 0);
    h.root.hp -= p3Damage;
    const finalTick = reachVastagharPhase(h, vastShared.VastagharPhase.FinalTread, p3Tick + 1);
    expect(finalTick).toBeGreaterThan(p3Tick);
    expect(h.state.mode).toBe(vastShared.VastagharMode.Desperation);
    expect(h.state.storedDamage).toBe(0);
  });

  it("keeps each rhythmic footfall on a separate epoch with 15-tick cadence and a five-tick answer window", () => {
    const h = makeVastagharHarness("miss");
    stepVastaghar(h, 0, 88);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 570, "p1", "hammer", 1, 0, 0);
    let tick = reachVastagharPhase(h, vastShared.VastagharPhase.BreakStride, 89);
    while (h.state.actionKind !== vastShared.VastagharActionKind.ThreefoldMarch) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
    }
    const start = h.state.actionStartTick;
    expect(h.state.stepResolveTick - start).toBe(19);
    expect(h.state.stepResolveTick - h.state.responseOpenTick).toBe(5);
    while (h.state.stepIndex < 1) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
    }
    expect(h.state.stepResolveTick - (start + 19)).toBe(15);
    while (h.state.stepIndex < 2) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
    }
    expect(h.state.stepResolveTick - (start + 34)).toBe(15);
  });

  it("opens punish state only from a correct jump/parry answer, never from recovery time alone", () => {
    const missed = makeVastagharHarness("miss");
    stepVastaghar(missed, 0, 64);
    expect(missed.state.mode).not.toBe(vastShared.VastagharMode.Punish);
    expect(missed.state.punishEndTick).toBe(0);

    const jumped = makeVastagharHarness("jump");
    stepVastaghar(jumped, 0, 64);
    expect(jumped.state.mode).toBe(vastShared.VastagharMode.Punish);
    expect(jumped.state.punishEndTick - 64).toBeGreaterThanOrEqual(20);
    expect(jumped.state.stridePips).toBe(1);
  });

  it("destroys no more than the two authored POIs and publishes mutation/collision edges together", () => {
    const h = makeVastagharHarness("miss");
    stepVastaghar(h, 0, 88);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 570, "p1", "hammer", 1, 0, 0);
    let tick = reachVastagharPhase(h, vastShared.VastagharPhase.BreakStride, 89);
    while (!h.mutations.some((m) => m.kind === vastShared.VastagharArenaMutationKind.LandmarkBreak)) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
      if (tick > 700) throw new Error("Landmark Break did not resolve");
    }
    expect(h.state.destroyedPoiMask).toBe((1 << 5) | (1 << 6));
    expect(h.mutations.filter((m) => m.poiIndex !== 255).map((m) => m.poiIndex)).toEqual([5, 6]);
  });

  it("enforces the four-add encounter budget even when the authored wave requests more", () => {
    const h = makeVastagharHarness("miss", 1);
    stepVastaghar(h, 0, 88);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 570, "p1", "hammer", 1, 0, 0);
    const tick = reachVastagharPhase(h, vastShared.VastagharPhase.BreakStride, 89);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 665, "p2", "ultimate", 6, 0, 0);
    reachVastagharPhase(h, vastShared.VastagharPhase.UnderHeel, tick + 1);
    expect(h.addCounts).toEqual([3]);
  });

  it("conserves field XP into the reserved crown and exposes the ordered death receipt", () => {
    expect(vastServer.conserveVastagharVictoryXp(37, vastShared.VASTAGHAR_ENCOUNTER.bossXp)).toBe(147);
    const h = makeVastagharHarness("miss");
    h.runtime.beginVictory(100, h.sink);
    expect(h.state.mode).toBe(vastShared.VastagharMode.Victory);
    expect(h.state.victoryStage).toBe(vastShared.VastagharVictoryStage.ThreatEnded);
    expect(h.runtime.advanceVictory(109)).toBe(false);
    expect(h.runtime.advanceVictory(110)).toBe(true);
    h.runtime.setVictoryEcho("vastaghar-core:1", 147);
    expect([h.state.victoryStage, h.state.victoryEchoId, h.state.victoryXp]).toEqual([
      vastShared.VastagharVictoryStage.XpCrown,
      "vastaghar-core:1",
      147,
    ]);
  });

  it("retains the v26 nested flagship state under schema 30", () => {
    expect(vastShared.SCHEMA_VERSION).toBe(30);
    expect(new vastShared.ArenaState().schemaVersion).toBe(30);
    expect(new vastShared.ArenaState().vastaghar).toBeInstanceOf(vastShared.VastagharBossState);
  });
});

describe("Vastaghar flagship - Worldwheel revolution receipts", () => {
  it("publishes two independently hittable 2pi melee revolutions from one frozen action epoch", () => {
    const h = makeVastagharHarness("miss");
    const revolutions: number[] = [];
    h.sink.applyVastagharSweep = (
      _x,
      _y,
      _inner,
      _outer,
      _halfWidth,
      _from,
      _to,
      _damage,
      _knockback,
      _actionSeq,
      revolution,
      _airborne,
      out,
    ) => {
      if (h.state.actionKind === vastShared.VastagharActionKind.Worldwheel)
        revolutions.push(revolution);
      out.threatened = 1;
      out.answered = 0;
      out.parried = 0;
      out.airborne = 0;
      out.hit = 1;
      out.lastParrierId = "";
    };
    stepVastaghar(h, 0, 88);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 570, "p1", "pound", 1, 0, 0);
    let tick = reachVastagharPhase(h, vastShared.VastagharPhase.BreakStride, 89);
    h.root.hp -= h.runtime.capIncomingDamage(h.root.hp, 665, "p2", "ultimate", 6, 0, 0);
    tick = reachVastagharPhase(h, vastShared.VastagharPhase.UnderHeel, tick + 1);
    while (h.state.actionKind !== vastShared.VastagharActionKind.Worldwheel) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
      if (tick > 1400) throw new Error("Worldwheel did not start");
    }
    const endTick = h.state.actionEndTick;
    while (tick <= endTick) {
      tick++;
      h.runtime.step(0.05, h.root, h.targets, 1, tick, h.sink, tick);
    }
    expect(h.state.revolutions).toBe(2);
    expect([...new Set(revolutions)]).toEqual([0, 1]);
  });
});
