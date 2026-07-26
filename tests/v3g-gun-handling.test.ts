import { WEAPONS, type WeaponDef, weaponHasHandlingTag } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { projectileColorSuffix } from "../packages/client/src/scenes/arena/projectile-color.js";

const catalog = Object.values(WEAPONS);

function tagged(tag: "bolt" | "break" | "lever" | "pump" | "pistol" | "revolver"): WeaponDef[] {
  return catalog.filter((weapon) => weaponHasHandlingTag(weapon, tag));
}

describe("V3G catalog gun-handling laws", () => {
  it("tags every semantic lever rifle and gives it a lever grip", () => {
    const candidates = catalog.filter(
      (weapon) =>
        !!weapon.gun &&
        ((weapon.tags.family === "lever-rifle" && !/\bpump\b/i.test(weapon.name)) ||
          /\bthunderhead repeater cannon\b/i.test(weapon.name) ||
          weapon.id === "x2-boomstick-saddlegun"),
    );
    expect(candidates).toHaveLength(10);
    expect(
      tagged("lever")
        .map((weapon) => weapon.id)
        .sort(),
    ).toEqual(candidates.map((weapon) => weapon.id).sort());
    for (const weapon of candidates) {
      expect(weaponHasHandlingTag(weapon, "lever"), weapon.id).toBe(true);
      expect(weapon.gripPoints?.secondary?.role, weapon.id).toBe(
        weapon.id === "x2-thunderhead-repeater-cannon" ? "horizontal-foregrip" : "lever",
      );
    }
  });

  it("tags every pump-operated shotgun/pump catalog member and authors its moving fore-hand", () => {
    const candidates = catalog.filter(
      (weapon) =>
        !!weapon.gun &&
        !weapon.breakAction &&
        ((weapon.tags.family === "shotgun" &&
          weapon.tags.fireMode !== "semi-auto" &&
          weapon.id !== "x2-dustdevil-riotgun" &&
          weapon.id !== "x2-twin-maw-greenerbore" &&
          weapon.id !== "x2-hallowbore-coachgun" &&
          weapon.id !== "x2-boomstick-saddlegun") ||
          /\bpump-rifle\b/i.test(weapon.name) ||
          /\bbuckshot avalanche\b/i.test(weapon.name)),
    );
    expect(candidates).toHaveLength(11);
    expect(
      tagged("pump")
        .map((weapon) => weapon.id)
        .sort(),
    ).toEqual(candidates.map((weapon) => weapon.id).sort());
    for (const weapon of candidates) {
      expect(weaponHasHandlingTag(weapon, "pump"), weapon.id).toBe(true);
      expect(["pump", "vertical-foregrip"], weapon.id).toContain(
        weapon.gripPoints?.secondary?.role,
      );
    }
  });

  it("pins the owner-classified and catalog-inferred bolt-action census", () => {
    const boltIds = tagged("bolt")
      .map((weapon) => weapon.id)
      .sort();
    expect(boltIds).toEqual(
      [
        "x2-anvil-50",
        "x2-barrett-50-cal-sniper",
        "x2-buzzard-s-eye-marksman",
        "x2-m50-anti-materiel-rifle",
        "x2-mauler-slug-thrower",
        "x2-pale-horse-longgun",
        "x2-tracer-saint-carbine",
        "x2-varmint-bolt-223",
      ].sort(),
    );
    for (const id of boltIds) {
      expect(WEAPONS[id]?.gripPoints?.secondary?.role, id).toBe("bolt");
      expect(WEAPONS[id]?.gripPoints?.primary, id).toBeDefined();
    }
  });

  it("enumerates every authored pistol after the B63 sidearm additions", () => {
    const pistols = tagged("pistol");
    expect(pistols).toHaveLength(33);
    expect(pistols.every((weapon) => !!(weapon.gun || weapon.beam))).toBe(true);
  });
});

describe("V3G named grip truth and Thunderhead redistribution", () => {
  it.each([
    ["x2-hexpost-charm-pole", "two-hand-rifle"],
    ["x2-embernail-repeater", "under-barrel"],
    ["x2-widowmaker-arbalest", "crank"],
    ["x2-thunderhead-spikecaster", "under-barrel"],
    ["x2-hailstorm-coilgun", "under-barrel"],
    ["x2-dustdevil-riotgun", "vertical-foregrip"],
    ["x2-cinderquill-dart-caster", "two-hand-rifle"],
    ["x2-boneyard-ricochet-mortar", "two-hand-rifle"],
    ["x2-brimstone-rocket-tube", "shoulder-RPG"],
  ] as const)("round-trips %s's %s anchor role", (id, role) => {
    const weapon = WEAPONS[id];
    expect(weapon, id).toBeDefined();
    expect(weapon?.gripPoints?.primary, id).toBeDefined();
    expect(weapon?.gripPoints?.secondary?.role, id).toBe(role);
  });

  it.each([
    ["x2-rustwidow-pump-rifle", 0.64, 0.78],
    ["x2-buckshot-briar", 0.67, 0.76],
    ["x2-galvanic-coachgun", 0.69, 0.68],
  ] as const)("places %s's support hand on the pictured pump/fore-end", (id, x, y) => {
    expect(WEAPONS[id]?.gripPoints?.secondary).toMatchObject({ role: "pump", x, y });
  });

  it("places Frostbore's support hand on its barrel-mounted fore-wrap", () => {
    expect(WEAPONS["x2-frostbore-scattergun"]?.gripPoints?.secondary).toMatchObject({
      role: "horizontal-foregrip",
      x: 0.58,
      y: 0.68,
    });
    expect(weaponHasHandlingTag(WEAPONS["x2-frostbore-scattergun"], "break")).toBe(true);
  });

  it("doubles Cinderquill's held size", () => {
    expect(WEAPONS["x2-cinderquill-dart-caster"]?.displayLength).toBe(168);
  });

  it("slows Thunderhead, turns its projectiles blue, and preserves 50 base DPS", () => {
    const gun = WEAPONS["x2-thunderhead-repeater-cannon"]?.gun;
    expect(gun).toMatchObject({
      fireRate: 0.42,
      damage: 13.5,
      muzzleColor: 0x33e6ff,
      projectileColor: 0x33e6ff,
      explode: { damage: 7.5 },
    });
    expect(((gun?.damage ?? 0) + (gun?.explode?.damage ?? 0)) / (gun?.fireRate ?? 1)).toBe(50);
    expect(projectileColorSuffix("tracer:#33e6ff")).toBe(0x33e6ff);
  });
});
