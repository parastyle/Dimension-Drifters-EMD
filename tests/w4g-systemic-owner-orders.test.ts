import { readFileSync } from "node:fs";
import { WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { firingStanceFor } from "../packages/client/src/sprites/firing-stance.js";
import { resolvedGunGripPoints } from "../packages/client/src/sprites/gun-grip-points.js";
import {
  createFlourishInput,
  createFlourishSample,
  sampleFlourish,
  WEAPON_FLOURISH_SPECS,
} from "../packages/client/src/sprites/pose-language.js";
import { BEAM_VFX_RECIPES } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import {
  generatedImageMeleeGeometryFor,
  resolveGeneratedImageWeaponVfxRecipe,
} from "../packages/client/src/vfx/generated-image-weapon-vfx-recipes.js";
import {
  paintedParticleDisplaySize,
  paintedParticleDominance,
  paintedSwingDisplayWidth,
} from "../packages/client/src/vfx/painted-particle-scale.js";
import { resolveWeaponAuraVfxRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`missing W4G fixture ${id}`);
  return definition;
}

describe("W4G1 pistol idle-twirl visibility", () => {
  it("samples a full visible turn instead of a same-frame algebraic zero", () => {
    const beat = WEAPON_FLOURISH_SPECS.pistol.idleSettle;
    if (!beat) throw new Error("missing pistol idle settle");
    const input = createFlourishInput();
    input.spec = beat;
    input.moment = "idle-settle";
    const out = createFlourishSample();
    const angles: number[] = [];
    for (let elapsedMs = 0; elapsedMs < beat.timing.durationMs; elapsedMs += 5) {
      input.elapsedMs = elapsedMs;
      angles.push(sampleFlourish(input, out).weaponRotationRad);
    }
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI * 1.8);
  });
});

describe("W4G2 painted 96-pack scale contract", () => {
  it("keeps the remaining painted scale fixes and hands Dustreaper to B11 image geometry", () => {
    const dustreaper = weapon("x2-dustreaper-zweihander");
    const dustRecipe = resolveGeneratedImageWeaponVfxRecipe(dustreaper.id);
    const fulgurite = weapon("x2-fulgurite-storm-sphere");
    const fulguriteAura = resolveWeaponAuraVfxRecipe(fulgurite);
    if (!dustreaper || !dustRecipe || !fulguriteAura)
      throw new Error("missing painted-particle fixture");

    expect(dustRecipe).toMatchObject({
      kind: "fire-dragon-sweep",
      subject: "vfx-fire-dragon",
    });
    expect(generatedImageMeleeGeometryFor(dustreaper)).toEqual({
      forwardExtent: 300,
      halfWidth: 54,
    });
    expect(
      paintedParticleDisplaySize(
        paintedParticleDominance(
          fulgurite.displayLength,
          fulguriteAura.particleDominance,
          fulguriteAura.minParticlePx,
          fulguriteAura.maxParticlePx,
        ),
      ),
    ).toBeCloseTo(36.96, 5);
    expect(paintedSwingDisplayWidth(weapon("x2-gravechain-scythe"))).toBeCloseTo(61.2, 5);
    expect(paintedSwingDisplayWidth(weapon("x2-godsbone-pillar"))).toBeCloseTo(88.4, 5);
  });

  it("routes every burst consumer through an explicit display-size contract", () => {
    const files = [
      "packages/client/src/scenes/ArenaScene.ts",
      "packages/client/src/scenes/arena/vfx.ts",
      "packages/client/src/vfx/caster-vfx.ts",
      "packages/client/src/vfx/ultimate-vfx.ts",
      "packages/client/src/vfx/weapon-effect-vfx.ts",
    ];
    let calls = 0;
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      for (const match of source.matchAll(/particleBurst\(/g)) {
        calls += 1;
        expect(source.slice(match.index, match.index + 900), file).toContain("scaleContract:");
      }
    }
    expect(calls).toBe(37);
  });
});

describe("W4G3 low-stock shotgun stance", () => {
  it("puts every shotgun trigger hand and pump hand on reviewed painted anchors", () => {
    const shotguns = Object.values(WEAPONS).filter(
      (definition) =>
        !!definition.gun &&
        (definition.tags.family === "shotgun" ||
          /pump-rifle|buckshot avalanche/i.test(definition.name)),
    );
    expect(shotguns).toHaveLength(17);
    for (const definition of shotguns) {
      const primary = definition.gripPoints?.primary;
      const secondary = definition.gripPoints?.secondary;
      expect(primary?.x, `${definition.id}:trigger`).toBeGreaterThanOrEqual(0.23);
      expect(secondary?.x, `${definition.id}:pump`).toBeGreaterThan(primary?.x ?? 1);
      expect(["pump", "vertical-foregrip"], definition.id).toContain(secondary?.role);
      expect(firingStanceFor(definition).family, definition.id).toBe("scattergun");
      expect(firingStanceFor(definition).lead.y, definition.id).toBeGreaterThan(-0.1);
    }
  });
});

describe("W4G4 foregrips never use magazine paint", () => {
  const reviewedMagazineRegions = {
    "x2-gravedog-auto-rifle": { left: 0.42, right: 0.6, top: 0.56, bottom: 0.92 },
    "x2-stormspur-coil-carbine": { left: 0.39, right: 0.56, top: 0.5, bottom: 0.9 },
    "x2-dustdevil-riotgun": { left: 0.4, right: 0.64, top: 0.56, bottom: 0.96 },
    "x2-tesla-drumbore": { left: 0.32, right: 0.6, top: 0.4, bottom: 0.9 },
    "x2-brimstone-gallows-rifle": { left: 0.42, right: 0.63, top: 0.55, bottom: 0.96 },
  } as const;

  it.each(
    Object.entries(reviewedMagazineRegions),
  )("keeps %s outside its magazine region", (id, box) => {
    const anchor = weapon(id).gripPoints?.secondary;
    if (!anchor) throw new Error(`${id} needs an authored secondary anchor`);
    const inside =
      anchor.x >= box.left &&
      anchor.x <= box.right &&
      anchor.y >= box.top &&
      anchor.y <= box.bottom;
    expect(inside, `${id} secondary anchor ${anchor.x},${anchor.y}`).toBe(false);
    expect(["pump", "vertical-foregrip", "under-barrel"]).toContain(anchor.role);
  });

  it("ships Stormspur at the ordered +45% held size", () => {
    expect(weapon("x2-stormspur-coil-carbine").displayLength).toBeCloseTo(116 * 1.45, 5);
  });

  it("gives every two-hand firearm an under-barrel secondary anchor", () => {
    const firearms = Object.values(WEAPONS).filter(
      (definition) => !!definition.gun || !!definition.beam,
    );
    expect(firearms.length).toBeGreaterThan(100);
    for (const definition of firearms) {
      const grips = resolvedGunGripPoints(definition);
      if (definition.tags.grip === "1H" || definition.tags.grip === "dual") {
        if (grips?.secondary) {
          expect(grips.secondary.x, definition.id).toBeGreaterThan(grips.primary.x);
        }
        continue;
      }
      expect(grips?.secondary, definition.id).toBeDefined();
      expect(grips?.secondary?.x, definition.id).toBeGreaterThan(grips?.primary.x ?? 1);
      if (!definition.gripPoints) {
        expect(grips?.secondary?.x, definition.id).toBeGreaterThanOrEqual(0.68);
        expect(grips?.secondary?.role, definition.id).toBe("two-hand-rifle");
      }
    }
  });
});

describe("W4G5 waveform beam recipes", () => {
  it("authors amplitude and frequency for the whole beam roster", () => {
    const beamIds = Object.values(WEAPONS)
      .filter((definition) => !!definition.beam)
      .map((definition) => definition.id);
    for (const id of beamIds) {
      const recipe = BEAM_VFX_RECIPES[id];
      expect(recipe, id).toBeDefined();
      expect(recipe?.rippleAmplitude, id).toBeGreaterThanOrEqual(0);
      expect(recipe?.rippleFrequency, id).toBeGreaterThan(0);
    }
    const signatures = new Set(Object.values(BEAM_VFX_RECIPES).map((recipe) => recipe.ripple));
    expect([...signatures]).toEqual(expect.arrayContaining(["sine", "cosine", "double-helix"]));
  });

  it("makes Mirage Coilrifle a continuous purple double helix", () => {
    const mirage = weapon("x2-mirage-coilrifle");
    expect(mirage.gun).toBeUndefined();
    expect(mirage.beam).toMatchObject({ range: 640, width: 18, tickRate: 0.1 });
    expect(mirage.tags.fireMode).toBe("hold");
    expect(BEAM_VFX_RECIPES[mirage.id]).toMatchObject({
      ripple: "double-helix",
      rippleAmplitude: 0.42,
      rippleFrequency: 4,
      accentColor: 0xb14bff,
    });
  });
});

describe("W4G6 barrel alignment truth", () => {
  it("authors the painted barrel points in source PNG space", () => {
    expect(weapon("x2-voltcaster-machine-pistol").muzzle?.points[0]).toMatchObject({
      part: 0,
      x: 255,
      y: 39.1,
    });
    expect(weapon("x2-stormcaller-tesla-gatling").muzzle?.points).toHaveLength(6);
    expect(weapon("x2-coyote-stinger").gun).toMatchObject({
      spread: 0.18,
    });
    expect(weapon("x2-coyote-stinger").muzzle?.points).toHaveLength(2);
    expect(weapon("x2-hollowpoint-hex").muzzle?.points[0]).toMatchObject({
      part: 0,
      x: 255,
      y: 30.9,
    });
    expect(BEAM_VFX_RECIPES["x2-voltcaster-machine-pistol"]).toMatchObject({
      edgeColor: 0x5c0505,
      accentColor: 0xff2a1f,
      coreColor: 0xffe0d4,
    });
  });
});
