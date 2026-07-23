import {
  type Attr,
  DEFAULT_WEAPON,
  damageMultFromGrades,
  EXPANSION_WEAPON_IDS,
  effectiveDamageMult,
  FISTS_WEAPON,
  GRADE_DMG_COEFF,
  meleeReach,
  nextWeapon,
  prevWeapon,
  REQ_PENALTY_FLOOR,
  REQ_PENALTY_PER_POINT,
  REVIVE_HP_FRAC,
  REZ_RADIUS,
  requirementPenalty,
  requirementShortfall,
  sourceDamageMult,
  transformWeaponArtPoint,
  WEAPON_IDS,
  WEAPONS,
  weaponDamageMult,
  weaponDamageSources,
  weaponMuzzleGripOffset,
  weaponMuzzleWorldPoint,
  weaponSpriteTransform,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const at = (o: Partial<Record<Attr, number>>): Record<Attr, number> => ({
  str: 1,
  dex: 1,
  int: 1,
  con: 1,
  luk: 1,
  ...o,
});

describe("weaponDamageMult (§10 scaling grades)", () => {
  it("is 1.0 at the 1/1/1/1/1 baseline for any weapon", () => {
    for (const w of Object.values(WEAPONS)) {
      expect(weaponDamageMult(w, at({}))).toBeCloseTo(1, 6);
    }
  });

  it("scales a B-grade STR weapon by 0.06 per point over 1 (rusty-cleaver)", () => {
    const cleaver = WEAPONS["rusty-cleaver"];
    expect(cleaver?.scalingGrades).toEqual({ str: "B" });
    expect(weaponDamageMult(cleaver as never, at({ str: 2 }))).toBeCloseTo(
      1 + GRADE_DMG_COEFF.B,
      6,
    );
    expect(weaponDamageMult(cleaver as never, at({ str: 11 }))).toBeCloseTo(
      1 + GRADE_DMG_COEFF.B * 10,
      6,
    );
  });

  it("an A-grade weapon scales harder than a B-grade weapon at the same attr", () => {
    const a = weaponDamageMult(WEAPONS["tombstone-greatsword"] as never, at({ str: 10 })); // STR A
    const b = weaponDamageMult(WEAPONS["rusty-cleaver"] as never, at({ str: 10 })); // STR B
    expect(a).toBeGreaterThan(b);
    expect(GRADE_DMG_COEFF.A).toBeGreaterThan(GRADE_DMG_COEFF.B);
  });

  it("sums multiple graded attributes (driftblade dex:B + str:C)", () => {
    const d = WEAPONS.driftblade;
    expect(d?.scalingGrades).toEqual({ dex: "B", str: "C" });
    const m = weaponDamageMult(d as never, at({ dex: 3, str: 5 }));
    expect(m).toBeCloseTo(1 + GRADE_DMG_COEFF.B * 2 + GRADE_DMG_COEFF.C * 4, 6);
  });

  it("an ungraded attribute does not affect damage", () => {
    const cleaver = WEAPONS["rusty-cleaver"]; // only STR is graded
    expect(weaponDamageMult(cleaver as never, at({ dex: 30, luk: 30 }))).toBeCloseTo(1, 6);
  });

  it("falls back to the legacy { str: 'B' } default when scalingGrades is omitted", () => {
    const def = { id: "x", name: "x" } as never; // no scalingGrades
    expect(weaponDamageMult(def, at({ str: 6 }))).toBeCloseTo(1 + GRADE_DMG_COEFF.B * 5, 6);
  });
});

describe("sourceDamageMult (§14 WYSIWYG per-source scaling)", () => {
  // A STR/DEX blade (the "edge") with INT-scaling VFX sources, à la Wyrmtooth's magma/explosion.
  const blade = { scalingGrades: { str: "C", dex: "C" } } as never;

  it("a source with NO grades inherits the weapon's edge grades", () => {
    const attrs = at({ str: 8, dex: 4 });
    expect(sourceDamageMult(blade, undefined, attrs)).toBeCloseTo(
      weaponDamageMult(blade, attrs),
      6,
    );
  });

  it("a source's OWN grades scale off a DIFFERENT attribute than the edge", () => {
    // Edge scales STR/DEX, this source scales INT only.
    const intSource = { int: "B" } as const;
    // High STR/DEX, baseline INT → the edge scales up, the INT source stays at 1.0.
    const big = at({ str: 11, dex: 11, int: 1 });
    expect(weaponDamageMult(blade, big)).toBeGreaterThan(1);
    expect(sourceDamageMult(blade, intSource, big)).toBeCloseTo(1, 6);
    // High INT, baseline STR/DEX → the INT source scales, the edge stays at 1.0.
    const smart = at({ str: 1, dex: 1, int: 6 });
    expect(sourceDamageMult(blade, intSource, smart)).toBeCloseTo(1 + GRADE_DMG_COEFF.B * 5, 6);
    expect(weaponDamageMult(blade, smart)).toBeCloseTo(1, 6);
  });

  it("makes INT a live damage attribute (it drives a B-grade source)", () => {
    expect(sourceDamageMult(blade, { int: "B" }, at({ int: 4 }))).toBeGreaterThan(1);
  });
});

describe("Wyrmtooth multi-source (§14 WYSIWYG scatter + explosion)", () => {
  const w = WEAPONS["x-sword-bone"];

  it("blade scales STR/DEX while the magma + explosion scale INT", () => {
    expect(w?.scalingGrades).toEqual({ str: "C", dex: "C" });
    expect(w?.scatter?.scalingGrades).toEqual({ int: "B" });
    expect(w?.scatter?.explode).toBeTruthy();
  });

  it("the magma source scales off INT, independent of the blade's STR/DEX", () => {
    const smart = at({ int: 6 }); // INT pumped, STR/DEX at baseline
    expect(sourceDamageMult(w as never, w?.scatter?.scalingGrades, smart)).toBeCloseTo(
      1 + GRADE_DMG_COEFF.B * 5,
      6,
    );
    expect(weaponDamageMult(w as never, smart)).toBeCloseTo(1, 6); // blade unmoved by INT
  });

  it("the explosion omits its own grades, so the server inherits the scatter's INT scaling", () => {
    expect(w?.scatter?.explode?.scalingGrades).toBeUndefined();
    expect(w?.scatter?.explode?.radius).toBeGreaterThan(0); // a real, fixed blast (§14)
  });
});

describe("weaponDamageSources (§9 card multi-source)", () => {
  it("enumerates Wyrmtooth's blade + magma + blast, each with its own scaling", () => {
    const s = weaponDamageSources(WEAPONS["x-sword-bone"] as never);
    expect(s.map((x) => x.label)).toEqual(["hit", "magma", "blast"]);
    const magma = s.find((x) => x.label === "magma");
    expect(magma?.count).toBe(6);
    expect(magma?.grades).toEqual({ int: "B" }); // INT-scaled, independent of the STR/DEX blade
  });

  it("a plain melee weapon has a single 'hit' source", () => {
    const s = weaponDamageSources({ damage: 7, scalingGrades: { str: "B" } } as never);
    expect(s).toHaveLength(1);
    expect(s[0]?.label).toBe("hit");
  });

  it("a thrown weapon's primary source is the throw", () => {
    expect(weaponDamageSources(WEAPONS["rusty-cleaver"] as never)[0]?.label).toBe("throw");
  });
});

describe("damageMultFromGrades (the scaling primitive)", () => {
  it("scales a single graded attribute by its coefficient per point over 1", () => {
    expect(damageMultFromGrades({ int: "B" }, at({ int: 6 }))).toBeCloseTo(
      1 + GRADE_DMG_COEFF.B * 5,
      6,
    );
  });

  it("falls back to the legacy { str: 'B' } default when grades are undefined", () => {
    expect(damageMultFromGrades(undefined, at({ str: 3 }))).toBeCloseTo(
      1 + GRADE_DMG_COEFF.B * 2,
      6,
    );
  });
});

describe("requirement enforcement (§11 damage penalty)", () => {
  // A weapon needing STR 6 / INT 5, scaling off a B-grade edge so we can separate scaling from penalty.
  const w = { scalingGrades: { str: "B" }, requirements: { str: 6, int: 5 } } as never;

  it("no shortfall and penalty 1.0 when every requirement is met", () => {
    const attrs = at({ str: 6, int: 5 });
    expect(requirementShortfall(w, attrs)).toBe(0);
    expect(requirementPenalty(w, attrs)).toBe(1);
  });

  it("a weapon with no requirements never penalises", () => {
    const plain = { scalingGrades: { str: "B" } } as never;
    expect(requirementPenalty(plain, at({ str: 1 }))).toBe(1);
    expect(requirementShortfall(plain, at({}))).toBe(0);
  });

  it("sums the shortfall across attributes", () => {
    // STR 4 (−2) + INT 2 (−3) = 5 short.
    expect(requirementShortfall(w, at({ str: 4, int: 2 }))).toBe(5);
  });

  it("penalises 12% per point short, applied to every damage source", () => {
    const attrs = at({ str: 5, int: 5 }); // 1 short on STR only
    expect(requirementShortfall(w, attrs)).toBe(1);
    expect(requirementPenalty(w, attrs)).toBeCloseTo(1 - REQ_PENALTY_PER_POINT, 6);
    // effectiveDamageMult = scaling × penalty (here scaling at str:5 = 1 + 0.06*4).
    const scaling = 1 + GRADE_DMG_COEFF.B * 4;
    expect(effectiveDamageMult(w, undefined, attrs)).toBeCloseTo(
      scaling * (1 - REQ_PENALTY_PER_POINT),
      6,
    );
  });

  it("floors at REQ_PENALTY_FLOOR for a badly under-statted weapon (still wieldable, never 0)", () => {
    const attrs = at({ str: 1, int: 1 }); // 5 + 4 = 9 short → would be 1 - 1.08 < floor
    expect(requirementPenalty(w, attrs)).toBe(REQ_PENALTY_FLOOR);
    expect(effectiveDamageMult(w, undefined, attrs)).toBeGreaterThan(0);
  });

  it("raising the deficient attribute monotonically lifts the penalty toward 1.0", () => {
    const p3 = requirementPenalty(w, at({ str: 3, int: 5 }));
    const p4 = requirementPenalty(w, at({ str: 4, int: 5 }));
    const p6 = requirementPenalty(w, at({ str: 6, int: 5 }));
    expect(p4).toBeGreaterThan(p3);
    expect(p6).toBe(1);
  });

  it("every shipped weapon meets its own requirements at a reasonable end-game stat spread", () => {
    // Sanity: requirements authored on real weapons are reachable (no impossible gate).
    const maxed = at({ str: 30, dex: 30, int: 30, con: 30, luk: 30 });
    for (const weap of Object.values(WEAPONS)) {
      expect(requirementPenalty(weap, maxed)).toBe(1);
    }
  });
});

describe("guns (§9/§15 ranged)", () => {
  const GUN_IDS = [
    "x-gun-revolver-cannon",
    "x-gun-coffin-shotgun",
    "x-gun-gatling",
    "x-gun-nailgun",
    "x-gun-ricochet-pistol",
  ];

  it("every gun has a complete gun block + a bullet/muzzle style", () => {
    for (const id of GUN_IDS) {
      const g = WEAPONS[id]?.gun;
      expect(g, id).toBeTruthy();
      expect(g?.damage).toBeGreaterThan(0);
      expect(g?.projectileSpeed).toBeGreaterThan(0);
      expect(g?.range).toBeGreaterThan(0);
      expect(g?.fireRate).toBeGreaterThan(0);
      expect(g?.magazine).toBeGreaterThan(0);
      expect(g?.reloadSeconds).toBeGreaterThan(0);
      expect(typeof g?.bulletKind).toBe("string");
      expect(typeof g?.muzzle).toBe("string");
    }
  });

  it("the §9 card shows a 'shot' source whose pellet count matches the gun", () => {
    for (const id of GUN_IDS) {
      const def = WEAPONS[id];
      const src = weaponDamageSources(def as never);
      expect(src[0]?.label).toBe("shot");
      expect(src[0]?.base).toBe(def?.gun?.damage);
      expect(src[0]?.count).toBe(def?.gun?.pellets ?? 1);
    }
  });

  it("each gun is mechanically distinct (spread shotgun, fast gatling, piercing nailgun, bouncing pistol)", () => {
    expect(WEAPONS["x-gun-coffin-shotgun"]?.gun?.pellets ?? 1).toBeGreaterThan(1); // a volley
    expect(WEAPONS["x-gun-gatling"]?.gun?.fireRate).toBeLessThan(
      WEAPONS["x-gun-revolver-cannon"]?.gun?.fireRate as number,
    ); // gatling out-cycles the revolver
    expect(WEAPONS["x-gun-nailgun"]?.gun?.pierce ?? 1).toBeGreaterThan(1); // skewers a line
    expect(WEAPONS["x-gun-ricochet-pistol"]?.gun?.bounces ?? 0).toBeGreaterThan(0); // caroms
  });

  it("guns are reachable — requirements are met at a maxed stat spread", () => {
    const maxed = at({ str: 30, dex: 30, int: 30, con: 30, luk: 30 });
    for (const id of GUN_IDS) expect(requirementPenalty(WEAPONS[id] as never, maxed)).toBe(1);
  });
});

describe("GRADE_DMG_COEFF ordering", () => {
  it("is strictly decreasing S>A>B>C>D>E", () => {
    const order: Array<keyof typeof GRADE_DMG_COEFF> = ["S", "A", "B", "C", "D", "E"];
    for (let i = 1; i < order.length; i++) {
      expect(GRADE_DMG_COEFF[order[i - 1]]).toBeGreaterThan(GRADE_DMG_COEFF[order[i]]);
    }
  });
});

describe("art-space muzzle transform", () => {
  it("authors every projectile gun and beam in source PNG pixels", () => {
    for (const id of WEAPON_IDS) {
      const weapon = WEAPONS[id];
      if (!weapon?.gun && !weapon?.beam) continue;
      expect(weapon.muzzle?.points.length, id).toBeGreaterThan(0);
      for (const point of weapon.muzzle?.points ?? []) {
        const dimensions = weapon.muzzle?.parts[point.part];
        expect(point.x, `${id}/x`).toBeGreaterThanOrEqual(0);
        expect(point.x, `${id}/x`).toBeLessThan(dimensions?.width ?? 0);
        expect(point.y, `${id}/y`).toBeGreaterThanOrEqual(0);
        expect(point.y, `${id}/y`).toBeLessThan(dimensions?.height ?? 0);
      }
    }
  });

  it("carries scale and mirror through the same affine as the sprite", () => {
    const transform = weaponSpriteTransform({
      x: 100,
      y: 40,
      originX: 10,
      originY: 5,
      rotation: 0,
      scaleX: -2,
      scaleY: 3,
    });
    expect(transformWeaponArtPoint({ x: 20, y: 7 }, transform)).toEqual({ x: 80, y: 46 });
  });

  it("scales the held-hand pose while the PNG stays a fixed on-screen size", () => {
    const weapon = WEAPONS["x-gun-revolver-cannon"];
    if (!weapon) throw new Error("revolver fixture required");
    const grip = weaponMuzzleGripOffset(weapon, 0, { aimX: 1, aimY: 0, facing: 1 });
    const base = weaponMuzzleWorldPoint(weapon, { x: 20, y: 30, aimX: 1, aimY: 0 });
    const large = weaponMuzzleWorldPoint(weapon, {
      x: 20,
      y: 30,
      aimX: 1,
      aimY: 0,
      renderScale: 1.25,
    });
    expect(large.x - base.x).toBeCloseTo(grip.x * 0.25, 8);
    expect(large.y - base.y).toBeCloseTo(grip.y * 0.25, 8);
    expect(large.x - 20 - grip.x * 1.25).toBeCloseTo(base.x - 20 - grip.x, 8);
    expect(large.y - 30 - grip.y * 1.25).toBeCloseTo(base.y - 30 - grip.y, 8);
  });
});

describe("nextWeapon (§9 cycle)", () => {
  it("advances to the next id in the roster", () => {
    const first = WEAPON_IDS[0];
    const second = WEAPON_IDS[1];
    if (!first || !second) return;
    expect(nextWeapon(first)).toBe(second);
  });

  it("wraps around from the last weapon back to the first", () => {
    const last = WEAPON_IDS[WEAPON_IDS.length - 1];
    if (!last) return;
    expect(nextWeapon(last)).toBe(WEAPON_IDS[0]);
  });

  it("an unknown id (e.g. fists, excluded from the cycle) falls to the default weapon", () => {
    // indexOf → -1, (-1 + 1) % n = 0 → the first roster weapon; for an empty roster, DEFAULT_WEAPON.
    const out = nextWeapon(FISTS_WEAPON);
    expect(out).toBe(WEAPON_IDS[0] ?? DEFAULT_WEAPON);
  });

  it("cycling the whole roster visits every weapon exactly once and returns home", () => {
    const start = WEAPON_IDS[0];
    if (!start) return;
    const visited = [start];
    let cur = start;
    for (let i = 0; i < WEAPON_IDS.length - 1; i++) {
      cur = nextWeapon(cur);
      visited.push(cur);
    }
    expect(new Set(visited).size).toBe(WEAPON_IDS.length); // no repeats until the wrap
    expect(nextWeapon(cur)).toBe(start); // full loop closes
  });
});

describe("§13 expansion roster (the +300, gated behind the `expansion` flag)", () => {
  it("ships ~297 expansion weapons, all flagged + valid WeaponDefs", () => {
    expect(EXPANSION_WEAPON_IDS.length).toBeGreaterThan(250);
    for (const id of EXPANSION_WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w?.expansion).toBe(true);
      expect(w?.tags?.classPool).toBeTruthy(); // a real, complete WeaponDef
      expect(w?.damage).toBeGreaterThan(0);
    }
  });

  it("is held OUT of the active roster — no expansion weapon is cycleable/droppable", () => {
    const active = new Set(WEAPON_IDS);
    for (const id of EXPANSION_WEAPON_IDS) expect(active.has(id)).toBe(false);
    // …and the active roster carries nothing flagged expansion.
    for (const id of WEAPON_IDS) expect(WEAPONS[id]?.expansion).not.toBe(true);
  });

  it("every expansion weapon sits at the 1.0 damage baseline at 1/1/1/1/1 (no free scaling)", () => {
    for (const id of EXPANSION_WEAPON_IDS) {
      expect(weaponDamageMult(WEAPONS[id] as never, at({}))).toBeCloseTo(1, 6);
    }
  });
});

describe("Gravedigger's Spade — §6 rez carrier", () => {
  const spade = WEAPONS["gravediggers-spade"];

  it("exists, is a melee weapon, and carries a rez effect at REZ_RADIUS", () => {
    expect(spade).toBeDefined();
    expect(spade?.rez?.radius).toBe(REZ_RADIUS);
    expect(spade?.tags.classPool).toBe("melee");
  });

  it("uses the bespoke Gravewarden Buster sprite while preserving its stable gameplay id", () => {
    expect(spade?.sprite).toBe("gravewarden-buster");
  });

  it("is in the cyclable roster (so it spawns as a Testing-Grounds pickup)", () => {
    expect(WEAPON_IDS).toContain("gravediggers-spade");
  });

  it("the revive returns a sane fraction of max HP, floored at 1 (never 0)", () => {
    expect(REVIVE_HP_FRAC).toBeGreaterThan(0);
    expect(REVIVE_HP_FRAC).toBeLessThan(1);
    expect(Math.max(1, Math.round(100 * REVIVE_HP_FRAC))).toBe(30);
    expect(Math.max(1, Math.round(1 * REVIVE_HP_FRAC))).toBe(1); // tiny maxHp still revives to ≥1
  });
});

describe("prevWeapon (§9 cycle — E back-cycle)", () => {
  it("retreats to the previous id in the roster", () => {
    const first = WEAPON_IDS[0];
    const second = WEAPON_IDS[1];
    if (!first || !second) return;
    expect(prevWeapon(second)).toBe(first);
  });

  it("wraps around from the first weapon back to the last", () => {
    const first = WEAPON_IDS[0];
    if (!first) return;
    expect(prevWeapon(first)).toBe(WEAPON_IDS[WEAPON_IDS.length - 1]);
  });

  it("is the exact inverse of nextWeapon for every roster id", () => {
    for (const id of WEAPON_IDS) {
      expect(prevWeapon(nextWeapon(id))).toBe(id);
      expect(nextWeapon(prevWeapon(id))).toBe(id);
    }
  });

  it("an unknown id (e.g. fists, excluded from the cycle) falls to a valid roster weapon", () => {
    // indexOf → -1, (0 - 1 + n) % n = n-1 → the last roster weapon; for an empty roster, DEFAULT_WEAPON.
    const out = prevWeapon(FISTS_WEAPON);
    expect(out).toBe(WEAPON_IDS[WEAPON_IDS.length - 1] ?? DEFAULT_WEAPON);
  });
});

// §20 v0.117 WYSIWYG melee reach — the swept-blade hit must reach the RENDERED tip (playtest: "the tips of
// some melee weapons don't hit"). meleeReach floors at the sprite tip + scales with the holder's rig.
describe("meleeReach (§20 WYSIWYG — the blade tip must connect)", () => {
  it("never falls short of the authored range for any roster weapon", () => {
    for (const id of WEAPON_IDS) {
      const w = WEAPONS[id];
      // max(range, spriteTip) × 1 ≥ range — the hit reach can only be EXTENDED to the art, never shrunk.
      expect(meleeReach(w, 1)).toBeGreaterThanOrEqual(w.range);
    }
  });

  it("floors the reach at the rendered sprite tip so an OVERHANGING blade still connects", () => {
    // driftblade authors range 300 but its sprite is 320 long → the point used to whiff just past the hit
    // segment. The reach must now cover the visible tip ((1−gripFrac)×displayLength), not stop at `range`.
    const w = WEAPONS.driftblade;
    const tip = (1 - w.gripFrac) * w.displayLength;
    expect(w.displayLength).toBeGreaterThan(w.range); // guard: this weapon's art overhangs its authored range
    expect(meleeReach(w, 1)).toBeGreaterThanOrEqual(tip);
    expect(meleeReach(w, 1)).toBeGreaterThan(w.range); // strictly extended past the authored range
  });

  it("scales linearly with the holder's rig (a big character's blade hits as far as it looks)", () => {
    const w = WEAPONS.driftblade;
    expect(meleeReach(w, 2)).toBeCloseTo(2 * meleeReach(w, 1), 6);
    expect(meleeReach(w, 1.25)).toBeCloseTo(1.25 * meleeReach(w, 1), 6);
  });
});

// BEAM PANEL REGRESSIONS — appended-only contract coverage.
const {
  BEAM_AGGREGATE_TARGET_CAP: BEAM_TARGET_CAP,
  BEAM_MAX_RANGE: BEAM_RANGE_CAP,
  BEAM_MAX_TURN_RATE: BEAM_TURN_CAP,
  BEAM_MAX_WIDTH: BEAM_WIDTH_CAP,
  BEAM_MIN_CHARGE_SECONDS: BEAM_CHARGE_FLOOR,
  beamDescriptorFor: makeBeamDescriptor,
  beamStepDamage: beamDamageForStep,
  stepBeamAngle: steerBeamAngle,
} = await import("@dd/shared");

describe("beam weapons — hard panel laws", () => {
  const beamDefs = Object.values(WEAPONS).filter((weapon) => weapon.beam);

  it("keeps the 18 caster beams plus the five named energy guns after Gilded's zone conversion", () => {
    expect(beamDefs.filter((weapon) => weapon.tags.classPool === "caster")).toHaveLength(18);
    expect(WEAPONS["x2-voltcaster-machine-pistol"]?.beam).toBeDefined();
    expect(WEAPONS["x2-stormcaller-tesla-gatling"]?.beam).toBeDefined();
    expect(WEAPONS["x2-mirage-coilrifle"]?.beam).toBeDefined();
    expect(beamDefs).toHaveLength(23);
    for (const weapon of beamDefs) expect(weapon.gun, weapon.id).toBeUndefined();
  });

  it("keeps every generated beam inside charge, width, range, movement, and heat laws", () => {
    for (const weapon of beamDefs) {
      const beam = weapon.beam!;
      expect(beam.chargeSeconds, weapon.id).toBeGreaterThanOrEqual(BEAM_CHARGE_FLOOR);
      expect(beam.width, weapon.id).toBeLessThanOrEqual(BEAM_WIDTH_CAP);
      expect(beam.range, weapon.id).toBeLessThanOrEqual(BEAM_RANGE_CAP);
      expect(beam.movement.chargeMul, weapon.id).toBeLessThanOrEqual(0.55);
      expect(beam.movement.channelMul, weapon.id).toBeLessThanOrEqual(0.35);
      expect(beam.overheat.ignitionHeat, weapon.id).toBeGreaterThanOrEqual(0.25);
      expect(beam.overheat.heatPerSecond, weapon.id).toBeGreaterThanOrEqual(0.6);
      expect(beam.overheat.maxChannelSeconds, weapon.id).toBeLessThanOrEqual(1.25);
    }
  });

  it("enforces the caps again while constructing an immutable accepted descriptor", () => {
    const source = WEAPONS["x2-mesa-spine-thunder-stave"]!;
    const hostile = {
      ...source,
      beam: { ...source.beam!, width: 999, range: 9999, chargeSeconds: 0.01 },
    };
    const descriptor = makeBeamDescriptor(hostile, 12, 34);
    expect(descriptor.width).toBe(BEAM_WIDTH_CAP);
    expect(descriptor.range).toBe(BEAM_RANGE_CAP);
    expect(descriptor.chargeSeconds).toBe(BEAM_CHARGE_FLOOR);
    expect(Object.isFrozen(descriptor)).toBe(true);
  });

  it("caps live aim rotation at 75 degrees/second even with a zero-ish lag", () => {
    const next = steerBeamAngle(0, Math.PI, 0.001, 0.05);
    expect(Math.abs(next)).toBeCloseTo(BEAM_TURN_CAP * 0.05, 8);
  });

  it("normalizes DPS by actual dt and shares output above three contacts", () => {
    expect(beamDamageForStep(40, 0.05, 1)).toBeCloseTo(2, 8);
    expect(beamDamageForStep(40, 0.05, 4)).toBeCloseTo(1.5, 8);
    expect(beamDamageForStep(40, 0.05, 100) * 100).toBeCloseTo(40 * 0.05 * BEAM_TARGET_CAP, 8);
  });

  it("reports beam DPS as its own scaled card damage source", () => {
    const weapon = WEAPONS["x2-mesa-spine-thunder-stave"]!;
    const sources = weaponDamageSources(weapon);
    expect(sources[0]?.label).toBe("beam DPS");
    expect(sources[0]?.base).toBe(weapon.beam?.damagePerSecond);
    expect(sources[0]?.grades).toEqual(weapon.beam?.scalingGrades ?? weapon.scalingGrades);
  });
});
