import {
  ACTIVE_EXPANSION_WEAPON_IDS,
  ACTIVE_WEAPON_CATALOG_IDS,
  ARCHIVED_WEAPON_IDS,
  createMetaAccountV5,
  DROP_POOL,
  hitEnvelopeExtentsAgree,
  lockedPackCandidates,
  meleeComboSelectionFor,
  meleeReach,
  WEAPON_IDS,
  WEAPONS,
  type WeaponDef,
  weaponDamageEnvelopeFor,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { gunFireFamilyForWeapon } from "../packages/client/src/audio/gun-sfx.js";
import { comboWeaponThicknessSign } from "../packages/client/src/sprites/pose-language.js";
import { tomeOpenArtFor } from "../packages/client/src/sprites/tome-open-art.js";
import { CASTER_PARTICLE_PROJECTILES } from "../packages/client/src/vfx/caster-vfx-recipes.js";
import { resolveWeaponEffectRecipe } from "../packages/client/src/vfx/weapon-effect-recipes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";

const ARCHIVE_IDS = [
  "x2-hollowmother-spore-totem",
  "x2-codex-of-forked-tongues",
  "x2-voltscript-codicil",
  "x2-bonepicker-coachgun",
] as const;

const SURVIVING_B30_IDS = [
  "x2-quicksilver-streetsweeper",
  "x2-frostgig-harpoon",
  "x2-fool-s-gold-revolver",
  "x2-sunbreaker-railgun",
  "x2-buckshot-briar",
  "x2-cinderfang-derringer",
  "x2-hailshard-resonator",
  "tombstone-greatsword",
  "x2-coyote-trickster-s-sparkmitt",
  "x2-saintspar-lochaber",
  "x2-quarry-splitter-bardiche",
  "x2-choir-iron-greataxe",
  "gravediggers-spade",
  "x2-sanctified-headsman",
  "x2-brimstone-falcata",
  "x2-rimebound-folio",
] as const;

function weapon(id: string): WeaponDef {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing B30 weapon fixture: ${id}`);
  return definition;
}

describe("B30 recovered skipped-window orders", () => {
  it("reclassifies Streetsweeper as a hand-planted semi-auto grenade launcher at unchanged DPS", () => {
    const streetsweeper = weapon("x2-quicksilver-streetsweeper");
    const oldDps = (4 * 5) / 0.3;
    const newDps =
      ((streetsweeper.gun?.damage ?? 0) + (streetsweeper.gun?.explode?.damage ?? 0)) /
      (streetsweeper.gun?.fireRate ?? 1);

    expect(streetsweeper.tags).toMatchObject({
      family: "grenade-launcher",
      delivery: "projectile",
      fireMode: "semi-auto",
    });
    expect(streetsweeper.gun).toMatchObject({
      damage: 11,
      bulletKind: "grenade",
      fireRate: 0.3,
      arcHeight: 112,
      explode: { radius: 62, damage: 9 },
    });
    expect(streetsweeper.gripPoints?.secondary).toEqual({
      x: 0.63,
      y: 0.7,
      role: "horizontal-foregrip",
    });
    expect(streetsweeper.tags.handling ?? []).not.toContain("pump");
    expect(gunFireFamilyForWeapon(streetsweeper)).toBe("siege-ordnance");
    expect(newDps / oldDps).toBeGreaterThanOrEqual(0.9);
    expect(newDps / oldDps).toBeLessThanOrEqual(1.1);
  });

  it("archives all four superseded weapons out of every active acquisition pool", () => {
    const packIds = lockedPackCandidates(createMetaAccountV5(), "weapon").map((row) => row.id);
    for (const id of ARCHIVE_IDS) {
      expect(weapon(id).archived, id).toBe(true);
      expect(ARCHIVED_WEAPON_IDS, id).toContain(id);
      expect(ACTIVE_WEAPON_CATALOG_IDS, id).not.toContain(id);
      expect(ACTIVE_EXPANSION_WEAPON_IDS, id).not.toContain(id);
      expect(WEAPON_IDS, id).not.toContain(id);
      expect(DROP_POOL, id).not.toContain(id);
      expect(packIds, id).not.toContain(id);
    }
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(339);
    expect(ARCHIVED_WEAPON_IDS).toHaveLength(19);
  });

  it("places Frostgig overhead and pins the revolver and Railgun grips to the painted handles", () => {
    expect(weapon("x2-frostgig-harpoon").performance?.hold).toBe("overhead");
    // B35 supersedes the earlier trigger midpoint with the painted handle.
    expect(weapon("x2-fool-s-gold-revolver").gripPoints?.primary).toEqual({
      x: 0.22,
      y: 0.66,
    });
    expect(weapon("x2-sunbreaker-railgun").gripPoints).toEqual({
      primary: { x: 0.36, y: 0.67 },
      secondary: { x: 0.5, y: 0.64, role: "horizontal-foregrip" },
    });
  });

  it("applies Buckshot Briar and Cinderfang size orders only as render metadata", () => {
    const briar = weapon("x2-buckshot-briar");
    const derringer = weapon("x2-cinderfang-derringer");
    expect(briar.displayLength).toBe(120);
    expect(briar.displayLength / 96).toBeCloseTo(1.25, 10);
    expect(derringer.displayLength).toBeCloseTo(46 * 1.2, 10);
    expect(briar.collisionLength).toBeUndefined();
    expect(derringer.collisionLength).toBeUndefined();
  });

  it("removes Hailshard's rogue swing authority while retaining only its aimed ice projectiles", () => {
    const hail = weapon("x2-hailshard-resonator");
    const envelope = weaponDamageEnvelopeFor(hail);
    expect(hail).toMatchObject({
      suppressVfx: true,
      suppressMeleeHitbox: true,
      performance: { action: "hold", suppressSwing: true },
      scatter: { aim: "cone", count: 5, explode: { radius: 48, damage: 5 } },
    });
    expect(hail.performance?.aura).toBeUndefined();
    expect(envelope.melee).toBeUndefined();
    expect(envelope.projectiles.scatter).toBeDefined();
    expect(envelope.scatterExplosion).toEqual({ radius: 48 });
    expect(WEAPON_VFX[hail.id]).toBeUndefined();
  });

  it("keeps Tombstone's visible blade and damage extent equal with no stale quake", () => {
    const tombstone = weapon("tombstone-greatsword");
    const envelope = weaponDamageEnvelopeFor(tombstone);
    expect(tombstone.quake).toBeUndefined();
    expect(envelope.quake).toBeUndefined();
    expect(envelope.melee).toBeDefined();
    expect(hitEnvelopeExtentsAgree(meleeReach(tombstone), envelope.melee?.baseReach ?? -1)).toBe(
      true,
    );
  });

  it("removes Sparkmitt VFX while preserving its authored animation combo", () => {
    const sparkmitt = weapon("x2-coyote-trickster-s-sparkmitt");
    expect(sparkmitt.suppressVfx).toBe(true);
    expect(sparkmitt.authoritativeCombo).toBe(true);
    expect(meleeComboSelectionFor(sparkmitt)?.sequence).toHaveLength(8);
    expect(resolveWeaponEffectRecipe(sparkmitt)).toBeUndefined();
    expect(WEAPON_VFX[sparkmitt.id]).toBeUndefined();
  });

  it("faces Saintspar's blade with the down chop and reverses it for the up motion", () => {
    const combo = meleeComboSelectionFor(weapon("x2-saintspar-lochaber"));
    expect(combo?.sequence.map((step) => step.motion)).toEqual(["overhead", "rising-chop"]);
    expect(comboWeaponThicknessSign(combo?.sequence[0])).toBe(1);
    expect(comboWeaponThicknessSign(combo?.sequence[1])).toBe(-1);
  });

  it("shrinks Bardiche and authors one forward flip whose complete arc ends in a slam", () => {
    const bardiche = weapon("x2-quarry-splitter-bardiche");
    const combo = meleeComboSelectionFor(bardiche);
    expect(bardiche.displayLength).toBe(256);
    expect(bardiche.displayLength / 320).toBeCloseTo(0.8, 10);
    expect(bardiche.quake).toBeUndefined();
    expect(bardiche.authoritativeCombo).toBe(true);
    expect(combo?.sequence).toHaveLength(1);
    expect(combo?.sequence[0]).toMatchObject({
      motion: "execution-slam",
      path: { kind: "fan", deltaAngle: Math.PI * 2 },
      rootMotion: { forwardPx: 96, durationSeconds: 0.22 },
      theatrics: { flip: "front" },
    });
  });

  it("uses blade-owned flame, not holy or radial authority, on Choir Iron", () => {
    const choir = weapon("x2-choir-iron-greataxe");
    expect(choir.quake).toBeUndefined();
    expect(resolveWeaponEffectRecipe(choir)).toMatchObject({
      classification: "weapon-motion",
      swingPack: "fire-bolt",
      emitter: "blade",
    });
  });

  it("makes Gravewarden jump forward through six correctly directed turns at 3x visual speed", () => {
    const spade = weapon("gravediggers-spade");
    expect(spade).toMatchObject({
      cooldown: 0.6,
      swingArc: Math.PI * 2,
      performance: {
        lunge: { distancePx: 144, durationSeconds: 0.2 },
        twirl: {
          plane: "continuous-frontflip",
          direction: "forward",
          visualRevolutions: 6,
          cadenceSeconds: 0.2,
        },
      },
    });
  });

  it("orders Headsman's overhead chop before its existing slash", () => {
    const headsman = weapon("x2-sanctified-headsman");
    expect(headsman.swingStyle).toBe("chop");
    expect(meleeComboSelectionFor(headsman)?.sequence.map((step) => step.motion)).toEqual([
      "overhead",
      "slash",
    ]);
  });

  it("promotes Falcata to a premade dual full-revolution whirlwind without changing DPS", () => {
    const falcata = weapon("x2-brimstone-falcata");
    const oldDps = 9 / 0.42;
    expect(falcata.tags.grip).toBe("dual");
    expect(falcata.dual).toBe(true);
    expect(falcata.swingStyle).toBe("spin");
    expect(falcata.swingArc).toBeCloseTo(Math.PI * 2, 10);
    expect(falcata.performance).toMatchObject({
      action: "spin",
      continuous: true,
      suppressSwing: true,
      twirl: { plane: "ground-whirlwind", visualRevolutions: 1 },
    });
    expect(falcata.damage / falcata.cooldown / oldDps).toBeCloseTo(1, 10);
  });

  it("keeps Rimebound active, opens it procedurally, and fires envelope-true icicles only", () => {
    const folio = weapon("x2-rimebound-folio");
    const envelope = weaponDamageEnvelopeFor(folio);
    expect(folio.archived).not.toBe(true);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toContain(folio.id);
    expect(folio).toMatchObject({
      suppressMeleeHitbox: true,
      performance: { action: "page-flip", suppressSwing: true },
      scatter: { count: 7, damage: 4 },
    });
    expect(folio.scatter?.aim ?? "cone").toBe("cone");
    expect(tomeOpenArtFor(folio.id)).toEqual({
      textureKey: "procedural-open:x2-rimebound-folio",
      proceduralSplay: true,
    });
    expect(CASTER_PARTICLE_PROJECTILES[folio.id]).toEqual({
      treatment: "stream",
      pack: "frost-shard",
      count: 5,
    });
    expect(envelope.melee).toBeUndefined();
    expect(envelope.projectiles.scatter).toBeDefined();
  });

  it("keeps every surviving recovered order free of standing-ban surfaces", () => {
    for (const id of SURVIVING_B30_IDS) {
      const definition = weapon(id);
      expect(definition.performance?.aura, `${id}: aura`).toBeUndefined();
      expect(definition.scatter?.aim, `${id}: radial scatter`).not.toBe("radial-random");
      expect(JSON.stringify(definition), `${id}: chain/tassel metadata`).not.toMatch(
        /tassel|chain(?:ed)?-ornament/i,
      );
    }
  });
});
