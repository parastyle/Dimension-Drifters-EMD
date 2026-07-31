import { describe, expect, it } from "vitest";
import { BATTLE_ROSTER } from "./battle-roster.js";
import {
  BattleSim,
  BEAT_MS,
  MIDLINE_X,
  PARRY_REACH_PX,
  SLING_MAX_DEPTH_PX,
  midlineDepth,
  stanceHomeX,
  type UnitSpec,
} from "./battle-sim.js";

/** Run the fight forward in realistic frame slices rather than one giant step. */
function run(sim: BattleSim, ms: number, frameMs = 16): void {
  for (let elapsed = 0; elapsed < ms; elapsed += frameMs) sim.step(frameMs);
}

describe("battle roster", () => {
  it("fields four per side with one vanguard, one medic and two ranged", () => {
    for (const team of [0, 1] as const) {
      const side = BATTLE_ROSTER.filter((u) => u.team === team);
      expect(side).toHaveLength(4);
      expect(side.filter((u) => u.role === "vanguard")).toHaveLength(1);
      expect(side.filter((u) => u.role === "medic")).toHaveLength(1);
      expect(side.filter((u) => u.role === "ranged")).toHaveLength(2);
    }
  });

  it("mirrors depth lanes so opposing roles share a row", () => {
    // Without this the two vanguards stand in different rows, never come within melee reach, and the
    // melee half of the fight silently never happens.
    for (const role of ["vanguard", "medic"] as const) {
      const lanes = BATTLE_ROSTER.filter((u) => u.role === role).map((u) => u.laneY);
      expect(new Set(lanes).size).toBe(1);
    }
  });

  it("puts both vanguards inside melee reach of each other when both press forward", () => {
    const left = BATTLE_ROSTER.find((u) => u.team === 0 && u.role === "vanguard");
    const right = BATTLE_ROSTER.find((u) => u.team === 1 && u.role === "vanguard");
    expect(left && right).toBeTruthy();
    const gap = Math.abs(stanceHomeX(right!, "forward") - stanceHomeX(left!, "forward"));
    expect(gap).toBeLessThan(300); // `actVanguard`'s reach
  });

  it("gives every unit real catalog art", () => {
    for (const spec of BATTLE_ROSTER) {
      expect(spec.spriteId.startsWith("proto-")).toBe(true);
      expect(spec.weaponId.length).toBeGreaterThan(0);
    }
  });
});

describe("stance", () => {
  const left = BATTLE_ROSTER.find((u) => u.team === 0 && u.role === "ranged") as UnitSpec;
  const right = BATTLE_ROSTER.find((u) => u.team === 1 && u.role === "ranged") as UnitSpec;

  it("moves both teams toward the midline when forward and away when back", () => {
    expect(stanceHomeX(left, "forward")).toBeGreaterThan(stanceHomeX(left, "hold"));
    expect(stanceHomeX(left, "back")).toBeLessThan(stanceHomeX(left, "hold"));
    expect(stanceHomeX(right, "forward")).toBeLessThan(stanceHomeX(right, "hold"));
    expect(stanceHomeX(right, "back")).toBeGreaterThan(stanceHomeX(right, "hold"));
  });

  it("shortens the shot's flight — which is what gives the enemy less time to dodge", () => {
    // The owner's stated intent for forward stance. It holds because flight time is distance over a
    // fixed projectile speed, so standing closer is the entire mechanism.
    const aggressive = Math.abs(stanceHomeX(right, "hold") - stanceHomeX(left, "forward"));
    const passive = Math.abs(stanceHomeX(right, "hold") - stanceHomeX(left, "back"));
    expect(aggressive).toBeLessThan(passive);
  });

  it("never lets a resting stance put a unit on the wrong side of the line", () => {
    for (const spec of BATTLE_ROSTER) {
      for (const stance of ["forward", "hold", "back"] as const) {
        const x = stanceHomeX(spec, stance);
        expect(spec.team === 0 ? x < MIDLINE_X : x > MIDLINE_X).toBe(true);
      }
    }
  });
});

describe("the invisible midline", () => {
  function simWithCrosser(): { sim: BattleSim; id: string } {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = sim.units[0]!;
    // Shove a team-0 unit well onto enemy ground, as if it had chased something across.
    unit.x = MIDLINE_X + 120;
    return { sim, id: unit.spec.id };
  }

  it("lets a unit cross — nothing blocks it", () => {
    const { sim, id } = simWithCrosser();
    expect(midlineDepth(sim.unit(id)!)).toBeGreaterThan(0);
  });

  it("slings the crosser back onto its own side", () => {
    const { sim, id } = simWithCrosser();
    run(sim, 1500);
    const unit = sim.unit(id)!;
    expect(unit.x).toBeLessThan(MIDLINE_X);
  });

  it("caps how deep anyone can wade", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = sim.units[0]!;
    unit.x = MIDLINE_X + 900; // absurd overshoot
    sim.step(16);
    expect(midlineDepth(unit)).toBeLessThanOrEqual(SLING_MAX_DEPTH_PX + 1);
  });

  it("slings team 1 the opposite way", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = sim.units.find((u) => u.spec.team === 1)!;
    unit.x = MIDLINE_X - 120;
    run(sim, 1500);
    expect(unit.x).toBeGreaterThan(MIDLINE_X);
  });

  it("does not leave sling velocity running once safely home", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = sim.units[0]!;
    unit.x = MIDLINE_X + 60;
    run(sim, 4000);
    expect(Math.abs(unit.vx)).toBeLessThan(30);
  });
});

describe("the fight", () => {
  it("resolves attacks only on beat boundaries", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    sim.step(BEAT_MS - 20);
    expect(sim.takeEvents().some((e) => e.type === "beat")).toBe(false);
    sim.step(40);
    expect(sim.takeEvents().some((e) => e.type === "beat")).toBe(true);
  });

  it("puts bolts in the air and eventually damages somebody", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 4000);
    const hurt = sim.units.some((u) => u.hp < u.spec.maxHp);
    expect(hurt).toBe(true);
  });

  it("reaches a winner inside a couple of minutes", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 120_000);
    expect(sim.snapshot().winner).toBeDefined();
  });

  it("replays identically from the same seed", () => {
    const a = new BattleSim(BATTLE_ROSTER, 4242);
    const b = new BattleSim(BATTLE_ROSTER, 4242);
    run(a, 20_000);
    run(b, 20_000);
    expect(a.units.map((u) => u.hp)).toEqual(b.units.map((u) => u.hp));
    expect(a.snapshot().beatIndex).toBe(b.snapshot().beatIndex);
  });

  it("diverges on a different seed, so the spread is real", () => {
    const a = new BattleSim(BATTLE_ROSTER, 1);
    const b = new BattleSim(BATTLE_ROSTER, 999_983);
    run(a, 20_000);
    run(b, 20_000);
    expect(a.units.map((u) => u.hp)).not.toEqual(b.units.map((u) => u.hp));
  });

  it("stops simulating once a side is wiped", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 120_000);
    const before = sim.units.map((u) => u.hp);
    run(sim, 5000);
    expect(sim.units.map((u) => u.hp)).toEqual(before);
  });

  it("keeps everyone except the vanguard welded to their depth lane", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 20_000);
    for (const unit of sim.units) {
      if (unit.spec.role === "vanguard") continue; // the escort is the one unit allowed to change rows
      expect(unit.y).toBe(unit.spec.laneY);
    }
  });

  it("threatens the backline, not just the two tanks", () => {
    // Regression guard for the first live build: every DPS shot the nearest enemy, which is always the
    // opposing vanguard, so medics and snipers were never in danger and the guard had nothing to protect.
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 30_000);
    const backlineHurt = sim.units.filter(
      (u) => u.spec.role !== "vanguard" && u.hp < u.spec.maxHp,
    );
    expect(backlineHurt.length).toBeGreaterThan(0);
  });
});

describe("the vanguard escort", () => {
  it("leaves its row to get into the line of a bolt aimed at someone else", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const guard = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "vanguard")!;
    const medic = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "medic")!;
    expect(guard.y).not.toBe(medic.y);
    sim.projectiles.push({
      id: 1,
      team: 1,
      ownerId: "crane",
      targetId: medic.spec.id,
      x: MIDLINE_X + 200,
      y: medic.y,
      vx: -900,
      vy: 0,
      damage: 7,
      alive: true,
    });
    run(sim, BEAT_MS + 60); // one beat to decide, a few frames to walk
    expect(Math.abs(guard.y - medic.y)).toBeLessThan(Math.abs(guard.spec.laneY - medic.y));
  });

  it("closes to within parry reach of a threatened row while the threat is live", () => {
    // Interposition is only real if the guard can physically arrive. If this ever fails, the parry
    // mechanic has silently become decorative again. The bolt is slow and distant on purpose: the escort
    // target is re-derived every beat, so the threat has to still be in the air to hold the guard there.
    const sim = new BattleSim(BATTLE_ROSTER);
    const guard = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "vanguard")!;
    const medic = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "medic")!;
    for (let elapsed = 0; elapsed < 1500; elapsed += 16) {
      // Re-seat a single, unambiguous threat every frame. The escort target is whichever ally is hit
      // SOONEST, so leaving the fight's own crossfire in play would let a faster bolt aimed elsewhere win
      // the guard's attention and this would measure noise rather than the escort.
      sim.projectiles.length = 0;
      sim.projectiles.push({
        id: 1,
        team: 1,
        ownerId: "crane",
        targetId: medic.spec.id,
        x: medic.x + 1200,
        y: medic.y,
        vx: -300,
        vy: 0,
        damage: 7,
        alive: true,
      });
      sim.step(16);
    }
    expect(Math.abs(guard.y - medic.y)).toBeLessThan(PARRY_REACH_PX);
  });

});

describe("parry by interposition", () => {
  it("lets a vanguard eat a bolt aimed past it, and only one at a time", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const guard = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "vanguard")!;
    const spawn = (): void => {
      sim.projectiles.push({
        id: Math.floor(guard.x) + sim.projectiles.length,
        team: 1,
        ownerId: "crane",
        targetId: "vesh",
        x: guard.x + 40,
        y: guard.y,
        vx: -900,
        vy: 0,
        damage: 7,
        alive: true,
      });
    };
    spawn();
    spawn();
    sim.step(16);
    const parries = sim.takeEvents().filter((e) => e.type === "parry");
    // Two bolts on the same line, one guard: exactly one is caught. Parry is triage, not a wall.
    expect(parries).toHaveLength(1);
  });

  it("does not let a vanguard parry its own team's bolts", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const guard = sim.units.find((u) => u.spec.team === 0 && u.spec.role === "vanguard")!;
    sim.projectiles.push({
      id: 1,
      team: 0,
      ownerId: "tuli",
      targetId: "halvard",
      x: guard.x,
      y: guard.y,
      vx: 900,
      vy: 0,
      damage: 7,
      alive: true,
    });
    sim.step(16);
    expect(sim.takeEvents().some((e) => e.type === "parry")).toBe(false);
  });
});
