import { describe, expect, it } from "vitest";
import { WEAPONS } from "@dd/shared";
import { BATTLE_ROSTER } from "./battle-roster.js";
import {
  BattleSim,
  BEAT_MS,
  MIDLINE_X,
  MAX_BEATS_PER_ACTION,
  MIN_BEATS_PER_ACTION,
  SLING_MAX_DEPTH_PX,
  DODGE_MAX_Y,
  DODGE_MIN_Y,
  SUDDEN_DEATH_BEAT,
  WEAPON_DAMAGE_SCALE,
  WEAPON_REACH_SCALE,
  weaponProfile,
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
    const hurt = sim.units.some((u) => u.hp < u.spec.stats.maxHp);
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

  it("holds the formation over a long fight, even though everyone dodges", () => {
    // Units are no longer welded to their row — they roll out of the way of bolts. What must survive is
    // that a roll is temporary: lane homing walks them back, so the battle line still exists at the end.
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 20_000);
    for (const unit of sim.units) {
      if (!unit.alive) continue;
      const drift = Math.abs(unit.y - unit.spec.laneY);
      const budget = unit.spec.stats.dodgeSpeed * (unit.spec.stats.dodgeDurationMs / 1000);
      // Never further from home than a single roll could have carried them (plus the escort's own range
      // for units that interpose).
      const escort = unit.spec.abilities.includes("interpose") ? 600 : 0;
      expect(drift).toBeLessThanOrEqual(budget + escort + 1);
    }
  });

  it("threatens the backline, not just the two tanks", () => {
    // Regression guard for the first live build: every DPS shot the nearest enemy, which is always the
    // opposing vanguard, so medics and snipers were never in danger and the guard had nothing to protect.
    const sim = new BattleSim(BATTLE_ROSTER);
    run(sim, 30_000);
    const backlineHurt = sim.units.filter(
      (u) => u.spec.role !== "vanguard" && u.hp < u.spec.stats.maxHp,
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
    expect(Math.abs(guard.y - medic.y)).toBeLessThan(guard.spec.stats.parryReach);
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

describe("weapons are mechanical, not cosmetic", () => {
  it("takes damage from the weapon catalog scaled by the unit's might", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    for (const unit of sim.units) {
      const def = WEAPONS[unit.spec.weaponId];
      expect(def).toBeDefined();
      expect(unit.weapon.damage).toBeCloseTo(
        (def?.damage ?? 0) * WEAPON_DAMAGE_SCALE * unit.spec.stats.might,
        5,
      );
    }
  });

  it("gives the roster more than one attack cadence", () => {
    // If every weapon collapsed to the same beats-per-action, the catalog would be decoration again.
    const sim = new BattleSim(BATTLE_ROSTER);
    const cadences = new Set(sim.units.map((u) => u.weapon.beatsPerAction));
    expect(cadences.size).toBeGreaterThan(1);
  });

  it("keeps a heavy melee weapon slower and harder-hitting than a light one", () => {
    const heavy = weaponProfile(BATTLE_ROSTER.find((s) => s.id === "kord")!); // tombstone greatsword
    const light = weaponProfile(BATTLE_ROSTER.find((s) => s.id === "dell")!); // nailgun
    expect(heavy.damage).toBeGreaterThan(light.damage);
    expect(heavy.beatsPerAction).toBeGreaterThanOrEqual(light.beatsPerAction);
  });

  it("never lets a weapon act more often than once a beat or rarer than the cap", () => {
    for (const spec of BATTLE_ROSTER) {
      const profile = weaponProfile(spec);
      expect(profile.beatsPerAction).toBeGreaterThanOrEqual(MIN_BEATS_PER_ACTION);
      expect(profile.beatsPerAction).toBeLessThanOrEqual(MAX_BEATS_PER_ACTION);
    }
  });

  it("scales melee reach into this stage's much larger canvas", () => {
    const kord = BATTLE_ROSTER.find((s) => s.id === "kord")!;
    const def = WEAPONS[kord.weaponId];
    expect(weaponProfile(kord).reach).toBeCloseTo((def?.range ?? 0) * WEAPON_REACH_SCALE, 5);
  });
});

describe("per-unit stats", () => {
  it("applies each unit's bias over the role baseline", () => {
    const kord = BATTLE_ROSTER.find((s) => s.id === "kord")!;
    const halvard = BATTLE_ROSTER.find((s) => s.id === "halvard")!;
    expect(kord.stats.guard).toBeLessThan(halvard.stats.guard); // tougher
    expect(kord.stats.speed).toBeLessThan(halvard.stats.speed); // but slower to the threatened row
  });

  it("makes guard actually reduce damage taken", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const kord = sim.unit("kord")!;
    const before = kord.hp;
    sim.projectiles.push({
      id: 1,
      team: 1,
      ownerId: "crane",
      targetId: "kord",
      x: kord.x,
      y: kord.y,
      vx: -900,
      vy: 0,
      damage: 100,
      alive: true,
    });
    sim.step(16);
    const taken = before - kord.hp;
    // Parried or not, if it landed it must have been reduced by guard rather than applied raw.
    if (taken > 0) expect(taken).toBeLessThan(100);
  });
});

describe("takeover", () => {
  function controlled(sim: BattleSim, id = "kord") {
    sim.setControlled(id);
    return sim.unit(id)!;
  }

  it("hands exactly one unit to the player", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    controlled(sim);
    expect(sim.units.filter((u) => u.controlled)).toHaveLength(1);
    expect(sim.controlled?.spec.id).toBe("kord");
  });

  it("steers the taken-over unit instead of running its stance AI", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    const startX = unit.x;
    sim.setIntent(-1, 0, false); // walk away from the midline, which the AI would never choose
    run(sim, 600);
    expect(unit.x).toBeLessThan(startX - 100);
  });

  it("holds position when the player gives no input", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    sim.setIntent(0, 0, false);
    const startX = unit.x;
    const startY = unit.y;
    run(sim, 800);
    expect(Math.abs(unit.x - startX)).toBeLessThan(40); // only sling drift is allowed
    expect(unit.y).toBe(startY);
  });

  it("lets the player leave their own depth row, unlike the AI", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    sim.setIntent(0, -1, false);
    run(sim, 500);
    expect(unit.y).toBeLessThan(unit.spec.laneY - 100);
  });

  function bolt(sim: BattleSim, guard: { x: number; y: number }) {
    sim.projectiles.length = 0;
    sim.projectiles.push({
      id: 1,
      team: 1,
      ownerId: "crane",
      targetId: "vesh",
      x: guard.x + 30,
      y: guard.y,
      vx: -900,
      vy: 0,
      damage: 7,
      alive: true,
    });
  }

  it("does NOT parry for the player unless guard is held", () => {
    // Standing in the line is necessary but not sufficient once a human is driving. This is the entire
    // reason takeover is a skill rather than a strictly worse AI.
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    sim.setIntent(0, 0, false);
    bolt(sim, unit);
    sim.step(16);
    expect(sim.takeEvents().some((e) => e.type === "parry")).toBe(false);
  });

  it("parries when the player is in the line AND holding guard", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    sim.setIntent(0, 0, true);
    bolt(sim, unit);
    sim.step(16);
    const parries = sim.takeEvents().filter((e) => e.type === "parry");
    expect(parries).toHaveLength(1);
    expect(parries[0]).toMatchObject({ unitId: "kord", byPlayer: true });
  });

  it("still parries automatically for AI units", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const guard = sim.unit("kord")!;
    bolt(sim, guard);
    sim.step(16);
    const parries = sim.takeEvents().filter((e) => e.type === "parry");
    expect(parries).toHaveLength(1);
    expect(parries[0]).toMatchObject({ byPlayer: false });
  });

  it("releases control when the unit dies", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    unit.hp = 1;
    sim.projectiles.push({
      id: 9,
      team: 1,
      ownerId: "crane",
      targetId: "kord",
      x: unit.x,
      y: unit.y,
      vx: -900,
      vy: 0,
      damage: 999,
      alive: true,
    });
    sim.setIntent(0, 0, false);
    sim.step(16);
    expect(unit.alive).toBe(false);
    expect(sim.controlled).toBeUndefined();
  });

  it("gives control back to the AI on release", () => {
    const sim = new BattleSim(BATTLE_ROSTER);
    const unit = controlled(sim);
    sim.setControlled(undefined);
    expect(unit.controlled).toBe(false);
    sim.setIntent(-1, 0, false); // stale intent must not steer an AI unit
    const startX = unit.x;
    run(sim, 800);
    expect(unit.x).toBeGreaterThanOrEqual(startX - 40);
  });
});

describe("the fight always resolves", () => {
  /** Play a whole fight out and report how it ended. */
  function play(seed: number): { winner: number | undefined; seconds: number } {
    const sim = new BattleSim(BATTLE_ROSTER, seed);
    let t = 0;
    while (t < 300_000 && sim.snapshot().winner === undefined) {
      sim.step(16);
      t += 16;
    }
    return { winner: sim.snapshot().winner, seconds: t / 1000 };
  }

  it("lets a medic attack when nobody needs healing", () => {
    // Medics used to have `mend` alone, so a fight that thinned to two medics could never end — neither
    // could deal damage and no amount of sudden-death ramp could break it.
    const vesh = BATTLE_ROSTER.find((s) => s.id === "vesh")!;
    expect(vesh.abilities).toContain("mend");
    expect(vesh.abilities).toContain("volley");
  });

  it("escalates damage once sudden death begins", () => {
    const sim = new BattleSim(BATTLE_ROSTER, 11);
    const early = (sim as unknown as { suddenDeathMultiplier(): number }).suddenDeathMultiplier();
    expect(early).toBe(1);
    for (let i = 0; i < SUDDEN_DEATH_BEAT + 20; i += 1) sim.step(BEAT_MS);
    const late = (sim as unknown as { suddenDeathMultiplier(): number }).suddenDeathMultiplier();
    expect(late).toBeGreaterThan(1);
  });

  it("finishes the great majority of seeds well inside the cap", () => {
    const results = Array.from({ length: 40 }, (_, i) => play((i + 1) * 7919));
    const decided = results.filter((r) => r.winner !== undefined);
    expect(decided.length / results.length).toBeGreaterThan(0.85);
    const median = decided.map((r) => r.seconds).sort((a, b) => a - b)[
      Math.floor(decided.length / 2)
    ];
    expect(median).toBeLessThan(90); // the design log's "is 90 seconds of this fun?" budget
  });

  it("is not lopsided between the two sides", () => {
    // Both a balance guard and a fairness guard: beat actions apply immediately, so a fixed resolution
    // order silently handed the first-listed team every mutual kill. 150 identical-squad seeds came out
    // 77-58 before `resolveBeat` started alternating.
    const results = Array.from({ length: 60 }, (_, i) => play((i + 1) * 7919));
    const left = results.filter((r) => r.winner === 0).length;
    const right = results.filter((r) => r.winner === 1).length;
    const share = left / (left + right);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });
});

describe("dodge rolls", () => {
  /** Put one bolt on a collision course with a unit and let it react. */
  function incoming(sim: BattleSim, targetId: string) {
    const u = sim.unit(targetId)!;
    sim.projectiles.push({
      id: 77,
      team: u.spec.team === 0 ? 1 : 0,
      ownerId: "crane",
      targetId,
      x: u.x + (u.spec.team === 0 ? 300 : -300),
      y: u.y,
      vx: u.spec.team === 0 ? -900 : 900,
      vy: 0,
      damage: 7,
      alive: true,
    });
    return u;
  }

  it("gives every unit a real dodge, not just the squishy ones", () => {
    for (const spec of BATTLE_ROSTER) {
      expect(spec.stats.dodgeSpeed).toBeGreaterThan(0);
      expect(spec.stats.dodgeDurationMs).toBeGreaterThan(0);
      expect(spec.stats.dodgeCooldownMs).toBeGreaterThan(0);
    }
  });

  it("rolls out of the path of an incoming bolt", () => {
    const sim = new BattleSim(BATTLE_ROSTER, 5);
    const unit = incoming(sim, "tuli");
    const y0 = unit.y;
    run(sim, 260);
    expect(Math.abs(unit.y - y0)).toBeGreaterThan(60);
  });

  it("returns to its own row afterwards, so the formation survives", () => {
    // The roll buys one bolt; it must not relocate anybody permanently.
    const sim = new BattleSim(BATTLE_ROSTER, 5);
    const unit = incoming(sim, "tuli");
    run(sim, 300);
    const displaced = Math.abs(unit.y - unit.spec.laneY);
    expect(displaced).toBeGreaterThan(40);
    sim.projectiles.length = 0;
    run(sim, 4000);
    expect(Math.abs(unit.y - unit.spec.laneY)).toBeLessThan(displaced);
  });

  it("cannot dodge everything — the cooldown bites", () => {
    const sim = new BattleSim(BATTLE_ROSTER, 5);
    const unit = sim.unit("tuli")!;
    let rolls = 0;
    for (let i = 0; i < 60; i++) {
      sim.projectiles.length = 0;
      incoming(sim, "tuli");
      sim.step(16);
      for (const e of sim.takeEvents()) if (e.type === "dodge" && e.unitId === "tuli") rolls++;
    }
    expect(rolls).toBeGreaterThan(0);
    expect(rolls).toBeLessThan(4); // one second of constant fire is not four dodges
    expect(unit.alive).toBe(true);
  });

  it("keeps rolls inside the stage's usable floor", () => {
    const sim = new BattleSim(BATTLE_ROSTER, 9);
    run(sim, 30_000);
    for (const unit of sim.units) {
      expect(unit.y).toBeGreaterThanOrEqual(DODGE_MIN_Y - 1);
      expect(unit.y).toBeLessThanOrEqual(DODGE_MAX_Y + 1);
    }
  });

  it("never steers the unit the player took over", () => {
    const sim = new BattleSim(BATTLE_ROSTER, 5);
    sim.setControlled("kord");
    const unit = sim.unit("kord")!;
    sim.setIntent(0, 0, false);
    incoming(sim, "kord");
    const y0 = unit.y;
    run(sim, 300);
    expect(unit.y).toBe(y0);
  });
});

describe("melee always swings", () => {
  it("emits an attack even when the target is out of reach", () => {
    // A vanguard that only animated when it could connect stood frozen for most of the fight.
    const sim = new BattleSim(BATTLE_ROSTER, 3);
    const kord = sim.unit("kord")!;
    const halvard = sim.unit("halvard")!;
    halvard.x = MIDLINE_X + 1500; // far out of any weapon's reach
    let swings = 0;
    let damaged = false;
    const before = halvard.hp;
    for (let i = 0; i < 40; i++) {
      halvard.x = MIDLINE_X + 1500;
      sim.step(BEAT_MS);
      for (const e of sim.takeEvents()) if (e.type === "attack" && e.unitId === kord.spec.id) swings++;
      if (halvard.hp < before) damaged = true;
    }
    expect(swings).toBeGreaterThan(0);
    expect(damaged).toBe(false); // swinging, but whiffing
  });
});
