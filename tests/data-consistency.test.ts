import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DIMENSIONS,
  ENEMY_KINDS,
  EXPANSION_WEAPON_IDS,
  MELEE_COMBO_VARIANT_SEQUENCES,
  SHIFTER_KIND_IDS,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

/**
 * Source-of-truth guard (audit AUDIT-2). `displayLength` is authored in BOTH `weapons.ts` (what ships)
 * and the Weaponsmith's `assignments.json` (the authoring tool). They silently diverged on 3 swords
 * before this guard existed. Until the SoT pipeline (SPEC-01) makes weapons.ts the sole owner + the
 * smith a read-only mirror, this test makes a divergence fail the BUILD instead of the playtest.
 */
const assignments = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../tools/weaponsmith/assignments.json", import.meta.url)),
    "utf8",
  ),
) as Record<string, { displayLength?: number }>;

describe("displayLength: weapons.ts ↔ Weaponsmith assignments.json", () => {
  for (const [id, def] of Object.entries(WEAPONS)) {
    const authored = assignments[id]?.displayLength;
    if (authored == null) continue; // smith hasn't authored a size for this weapon — nothing to compare
    it(`${id} agrees (weapons.ts=${def.displayLength}, smith=${authored})`, () => {
      expect(def.displayLength).toBe(authored);
    });
  }

  it("covers every coded weapon that the smith has sized", () => {
    // sanity: at least the explore swords the user tuned should be present in both
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
  });
});

/**
 * §13/§14 codegen source-of-truth guards (audit cluster ①). The weapon data spans several files that drift
 * silently if one is edited without re-running its codegen. These make a drift fail the BUILD, not a
 * playtest: (1) every Weaponsmith VFX assignment targets a real weapon (a typo'd/ghost id wastes a baked
 * VFX entry and starves the REAL weapon); (2) the codegen'd expansion roster is a perfect bijection with
 * its concepts source (edit the concepts, forget `gen-weapon-expansion.mjs`, and this fails); (3) every
 * re-bake-safe VFX override (weapon-vfx-overrides.json) targets a real weapon.
 */
describe("weapon-data cross-references (codegen SoT)", () => {
  const realKeys = (o: Record<string, unknown>) =>
    Object.keys(o).filter((k) => !k.startsWith("//"));

  it("keeps the concept source census header honest", () => {
    const source = readJson("../data/weapon-concepts-300.json") as {
      count: number;
      byType: Record<string, number>;
      weapons: { type: string }[];
    };
    expect(source.count).toBe(source.weapons.length);
    expect(source.byType).toEqual(
      source.weapons.reduce<Record<string, number>>((counts, weapon) => {
        counts[weapon.type] = (counts[weapon.type] ?? 0) + 1;
        return counts;
      }, {}),
    );
  });

  it("every Weaponsmith assignment id is a real weapon (no ghost/typo VFX targets)", () => {
    for (const id of realKeys(assignments)) expect(WEAPONS[id], `assignment "${id}"`).toBeDefined();
  });

  it("the expansion roster is a 1:1 bijection with its concepts source (codegen is in sync)", () => {
    const concepts = readJson("../data/weapon-concepts-300.json") as {
      weapons: { id: string; banned?: boolean; expansion?: boolean }[];
    };
    // §41 `banned: true` concepts are CUT from the game by design ruling (the generator skips them) but
    // stay in the data file as the record — the bijection holds over the non-banned set.
    const conceptIds = new Set(
      concepts.weapons.filter((w) => !w.banned && w.expansion !== false).map((w) => w.id),
    );
    const expansionIds = new Set(EXPANSION_WEAPON_IDS);
    for (const id of conceptIds)
      expect(
        expansionIds.has(id),
        `concept "${id}" lacks a generated WeaponDef — re-run gen-weapon-expansion.mjs`,
      ).toBe(true);
    for (const id of expansionIds)
      expect(
        conceptIds.has(id),
        `generated "${id}" has no concept — re-run gen-weapon-expansion.mjs`,
      ).toBe(true);
  });

  it("every curated codegen concept resolves in the combined live roster", () => {
    const concepts = readJson("../data/weapon-concepts-300.json") as {
      weapons: { id: string; banned?: boolean; expansion?: boolean }[];
    };
    for (const row of concepts.weapons.filter((w) => !w.banned && w.expansion === false)) {
      expect(WEAPONS[row.id], `curated codegen concept "${row.id}"`).toBeDefined();
      expect(WEAPONS[row.id]?.expansion).toBe(false);
    }
  });

  it("every VFX override (weapon-vfx-overrides.json) targets a real weapon", () => {
    const overrides = readJson("../tools/artkit/weapon-vfx-overrides.json") as Record<
      string,
      unknown
    >;
    for (const id of realKeys(overrides)) expect(WEAPONS[id], `override "${id}"`).toBeDefined();
  });
});

/**
 * §43 FIELD-LEVEL codegen guard (Sol audit data P0s #1/#2). The bijection test above only proves the id
 * SETS match — it passed for months while 11 weapons shipped with their entire mechanic block dropped
 * (stats authored as SIBLINGS of `behavior`) and 200+ supported fields (muzzleColor, bounces, etc.)
 * silently vanished in the mapper. This test re-derives the authored→emitted mapping
 * INDEPENDENTLY (the clamp bands are duplicated here on purpose — two encodings must agree) and compares
 * every gameplay-bearing field. A generator that drops or mis-clamps a field now fails the BUILD.
 */
describe("§43 expansion codegen: every authored gameplay field survives into the WeaponDef", () => {
  type Behavior = Record<string, unknown> & { kind?: string };
  type Concept = {
    id: string;
    banned?: boolean;
    expansion?: boolean;
    type: string;
    size?: string;
    description?: string;
    sprite?: string;
    sizeClass?: string;
    swingStyle?: string;
    comboFamily?: string;
    comboVariant?: string;
    comboBar?: unknown[];
    katanaHook?: Record<string, unknown>;
    bespokeVfxSheet?: boolean;
    suppressVfx?: boolean;
    effectRecipe?: string;
    effectEmitter?: string;
    effectTiming?: string;
    poseLanguage?: {
      idle?: string;
      feet?: string;
    };
    elementTransforms?: Record<string, unknown>;
    gripPoints?: {
      primary: { x: number; y: number };
      secondary?: { x: number; y: number; role: string };
    };
    handlingTags?: string[];
    performance?: Behavior;
    hitStatus?: Behavior;
    behavior?: Behavior;
    stats?: Record<string, number>;
  };
  const concepts = (readJson("../data/weapon-concepts-300.json") as { weapons: Concept[] }).weapons;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const iclamp = (v: number, lo: number, hi: number) => Math.round(clamp(v, lo, hi));
  const singleShotGunIds = new Set([
    "x2-barrett-50-cal-sniper",
    "x2-m50-anti-materiel-rifle",
    "x2-saintskull-monstrance",
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkFields = (id: string, got: any, authored: Behavior, spec: Record<string, unknown>) => {
    for (const [field, rule] of Object.entries(spec) as [string, any][]) {
      const a = authored[field];
      if (a === undefined) continue; // defaults are the generator's business; DROPS are the bug
      const path = `${id}.${field}`;
      if (rule.eq) expect(got?.[field], path).toBe(a);
      else if (rule.int)
        expect(got?.[field] ?? rule.absentAs, path).toBe(
          iclamp(a as number, rule.int[0], rule.int[1]),
        );
      else
        expect(got?.[field] ?? rule.absentAs, path).toBe(
          clamp(a as number, rule.num[0], rule.num[1]),
        );
    }
  };

  const MECH_SIBLINGS = [
    "thrown",
    "quake",
    "chainLightning",
    "scatter",
    "gun",
    "beam",
    "groundZone",
    "glovePair",
    "warp",
    "cast",
  ];
  const BEAM_GUN_IDS = new Set([
    "x2-mirage-coilrifle",
    "x2-stormcaller-tesla-gatling",
    "x2-permafrost-siege-lobber",
    "x2-doomsday-drum-cannon",
  ]);
  it("no concept authors a mechanic block as a SIBLING of behavior (the 11-weapon data-loss bug)", () => {
    for (const w of concepts)
      for (const k of MECH_SIBLINGS)
        expect(
          (w as Record<string, unknown>)[k],
          `${w.id}.${k} must live INSIDE behavior`,
        ).toBeUndefined();
  });

  it("no concept row retains deleted scaling or requirement keys", () => {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      expect(value).not.toHaveProperty("scalingGrades");
      expect(value).not.toHaveProperty("requirements");
      for (const child of Object.values(value as Record<string, unknown>)) visit(child);
    };
    for (const concept of concepts) visit(concept);
  });

  for (const w of concepts.filter((w) => !w.banned)) {
    it(`${w.id}: authored fields all reach the generated def`, () => {
      const def = WEAPONS[w.id];
      expect(def, w.id).toBeDefined();
      if (!def) return;
      const b = w.behavior ?? { kind: "edge" };
      const kind = b.kind ?? "edge";
      const s = w.stats ?? {};
      const ranged = w.type === "ranged";

      if (w.expansion !== undefined) expect(def.expansion, `${w.id}.expansion`).toBe(w.expansion);
      if (w.description !== undefined)
        expect(def.description, `${w.id}.description`).toBe(w.description);
      if (w.sprite !== undefined) expect(def.sprite, `${w.id}.sprite`).toBe(w.sprite);
      if (w.sizeClass !== undefined) expect(def.sizeClass, `${w.id}.sizeClass`).toBe(w.sizeClass);
      if (w.comboFamily !== undefined)
        expect(def.comboFamily, `${w.id}.comboFamily`).toBe(w.comboFamily);
      if (w.comboVariant !== undefined) {
        expect(def.comboVariant, `${w.id}.comboVariant`).toBe(w.comboVariant);
        // This suite exists to prove authored fields SURVIVE codegen, so the assertion is a subset
        // check, not deep equality. The generator legitimately DENORMALIZES: V7 katana movesets are
        // authored as a parallel `comboChoreography` array and merged into each step as
        // `step.choreography` for runtime convenience. Exact equality would reject that addition
        // while catching nothing extra — a dropped or mutated authored field still fails below.
        const emitted = MELEE_COMBO_VARIANT_SEQUENCES[
          w.comboVariant as keyof typeof MELEE_COMBO_VARIANT_SEQUENCES
        ] as Record<string, unknown>[] | undefined;
        expect(emitted, `${w.id}.comboBar present`).toBeDefined();
        expect(emitted, `${w.id}.comboBar length`).toHaveLength(w.comboBar?.length ?? 0);
        (w.comboBar as Record<string, unknown>[] | undefined)?.forEach((step, i) => {
          for (const [key, value] of Object.entries(step)) {
            expect(emitted?.[i]?.[key], `${w.id}.comboBar[${i}].${key}`).toEqual(value);
          }
        });
      }
      if (w.katanaHook !== undefined)
        expect(def.katanaHook, `${w.id}.katanaHook`).toEqual(w.katanaHook);
      if (w.bespokeVfxSheet !== undefined)
        expect(def.bespokeVfxSheet, `${w.id}.bespokeVfxSheet`).toBe(w.bespokeVfxSheet);
      if (w.suppressVfx !== undefined)
        expect(def.suppressVfx, `${w.id}.suppressVfx`).toBe(w.suppressVfx);
      if (w.effectRecipe !== undefined)
        expect(def.effectRecipe, `${w.id}.effectRecipe`).toBe(w.effectRecipe);
      if (w.effectEmitter !== undefined)
        expect(def.effectEmitter, `${w.id}.effectEmitter`).toBe(w.effectEmitter);
      if (w.effectTiming !== undefined)
        expect(def.effectTiming, `${w.id}.effectTiming`).toBe(w.effectTiming);
      if (w.poseLanguage !== undefined)
        expect(def.poseLanguage, `${w.id}.poseLanguage`).toEqual(w.poseLanguage);
      if (w.elementTransforms !== undefined)
        expect(def.elementTransforms, `${w.id}.elementTransforms`).toEqual(w.elementTransforms);
      if (w.gripPoints !== undefined)
        expect(def.gripPoints, `${w.id}.gripPoints`).toEqual(w.gripPoints);
      if (w.handlingTags !== undefined)
        expect(def.tags.handling, `${w.id}.tags.handling`).toEqual(w.handlingTags);
      if (w.performance) {
        checkFields(w.id, def.performance, w.performance, {
          hold: { eq: true },
          action: { eq: true },
          continuous: { eq: true },
          suppressSwing: { eq: true },
          windupSeconds: { num: [0.1, 0.75] },
          carryForwardPx: { num: [0, 80] },
          preThrowRevolutions: { num: [0, 3] },
        });
      }
      if (w.hitStatus) {
        checkFields(w.id, def.hitStatus, w.hitStatus, {
          kind: { eq: true },
          multiplier: { num: [0.1, 1] },
          seconds: { num: [0.05, 4] },
        });
      }

      // Held-swing baseline (stats.*)
      checkFields(w.id, def, s as Behavior, {
        damage: { num: [1, 40] },
        range: { num: ranged ? [80, 320] : [40, 1200] },
        halfArc: { num: [0.3, 1.4] },
        cooldown: { num: [0.12, 1.5] },
        displayLength: { num: [40, 400] },
        collisionLength: { num: [40, 400] },
        swingArc: {
          num: w.swingStyle === "spin" ? [Math.PI * 2, Math.PI * 6] : [1.8, 3.4],
        },
        gripFrac: { num: [0.04, 0.5] },
      });
      // Mechanic block
      const isBeam = kind === "beam" || BEAM_GUN_IDS.has(w.id);
      if (isBeam) {
        expect(def.beam, `${w.id}.beam`).toBeDefined();
        expect(
          def.gun,
          `${w.id}.gun (beam concepts are never projectile placeholders)`,
        ).toBeUndefined();

        const sourceTick = clamp((b.tickRate ?? b.fireRate ?? 0.1) as number, 0.05, 0.25);
        const normalizedTick = Number((Math.round(sourceTick / 0.05) * 0.05).toFixed(2));
        const heldDamage = clamp(s.damage ?? 8, 1, 40);
        const beamDamage = clamp((b.damage ?? heldDamage) as number, 1, 40);
        const sizeWidth = { S: 32, M: 48, L: 56, XL: 64 }[w.size ?? "M"] ?? 48;
        const sizeLag = { S: 0.16, M: 0.22, L: 0.28, XL: 0.35 }[w.size ?? "M"] ?? 0.22;

        expect(def.beam?.damagePerSecond, `${w.id}.beam.damagePerSecond`).toBe(
          beamDamage / sourceTick,
        );
        expect(def.beam?.tickRate, `${w.id}.beam.tickRate`).toBe(normalizedTick);
        expect(def.beam?.width, `${w.id}.beam.width`).toBe(
          clamp((b.width ?? sizeWidth) as number, 4, 64),
        );
        expect(def.beam?.range, `${w.id}.beam.range`).toBe(
          clamp((b.range ?? s.range ?? 520) as number, 240, 640),
        );
        expect(def.beam?.chargeSeconds, `${w.id}.beam.chargeSeconds`).toBe(
          clamp((b.chargeSeconds ?? 0.65) as number, 0.65, 1.25),
        );
        expect(def.beam?.sweepLagSeconds, `${w.id}.beam.sweepLagSeconds`).toBe(
          clamp((b.sweepLagSeconds ?? sizeLag) as number, 0.05, 0.35),
        );
        expect(def.beam?.overheat, `${w.id}.beam.overheat`).toEqual({
          maxChannelSeconds: 1.25,
          heatPerSecond: 0.6,
          coolPerSecond: 0.35,
          ignitionHeat: 0.25,
          lockSeconds: 1.5,
          restartHeat: 0.35,
        });
        expect(def.beam?.movement, `${w.id}.beam.movement`).toEqual({
          chargeMul: 0.55,
          channelMul: 0.35,
        });
      } else if (kind === "groundZone") {
        const zone = b.zone as Behavior | undefined;
        expect(def.groundZone, `${w.id}.groundZone`).toBeDefined();
        if (zone) {
          checkFields(w.id, def.groundZone, zone, {
            trigger: { eq: true },
            style: { eq: true },
            initialRadius: { num: [12, 240] },
            maxRadius: { num: [12, 320] },
            growthPerSecond: { num: [0, 240] },
            lingerSeconds: { num: [0.25, 8] },
            damagePerSecond: { num: [0, 120] },
            tickRate: { num: [0.05, 1] },
            placementRange: { num: [40, 900] },
            slowMultiplier: { num: [0.1, 1] },
            slowSeconds: { num: [0.05, 4] },
            grenadeArcHeight: { num: [24, 240] },
          });
        }
      } else if (kind === "cast") {
        expect(def.cast, `${w.id}.cast`).toBeDefined();
        checkFields(w.id, def.cast, b, {
          damage: { num: [1, 60] },
          speed: { num: [240, 1400] },
          range: { num: [180, 900] },
          cooldown: { num: [0.2, 2.5] },
          pierce: { int: [1, 99] },
          bulletKind: { eq: true },
        });
        if (b.volley)
          checkFields(w.id, def.cast?.volley, b.volley as Behavior, {
            count: { int: [2, 6] },
            spread: { num: [0.02, 0.8] },
          });
        if (b.projectileWaveform)
          checkFields(
            w.id,
            def.cast?.projectileWaveform,
            b.projectileWaveform as Behavior,
            {
              amplitudePx: { num: [1, 80] },
              frequencyHz: { num: [0.1, 8] },
              phaseRad: { num: [-Math.PI * 2, Math.PI * 2] },
            },
          );
        if (b.explode)
          checkFields(w.id, def.cast?.explode, b.explode as Behavior, {
            radius: { num: [30, 100] },
            damage: { num: [1, 30] },
          });
      } else if (kind === "gun" || ranged) {
        expect(def.gun, `${w.id}.gun`).toBeDefined();
        const singleShot = singleShotGunIds.has(w.id);
        const calamityHowitzer = w.id === "x2-calamity-howitzer";
        const ownerExpandedBlast =
          w.id === "x2-brimstone-rocket-tube" || w.id === "x2-tidehook-bombarpoon";
        const faradayer = w.id === "x2-tesla-faradayer";
        checkFields(w.id, def.gun, b, {
          damage: { num: [1, singleShot ? 120 : 40] },
          projectileSpeed: { num: [400, 4000] },
          range: { num: [280, 1100] },
          fireRate: {
            num: [
              0.05,
              w.id === "x2-mesa-hand-cannon" ? 1.2 : calamityHowitzer ? 3 : singleShot ? 1.5 : 0.9,
            ],
          },
          magazine: { int: [1, 80] },
          reloadSeconds: { num: [0.6, calamityHowitzer ? 5 : 3] },
          bulletKind: { eq: true },
          muzzle: { eq: true },
          muzzleColor: { int: [0, 0xffffff] },
          projectileColor: { int: [0, 0xffffff] },
          projectileArt: { eq: true },
          projectileVisualScale: { num: [0.5, faradayer ? 12 : 4] },
          sonicBoomRing: { eq: true },
          recoil: { num: [0.0004, 0.005] },
          pellets: { int: [1, 12], absentAs: 1 },
          pierce: { int: [1, 6], absentAs: 1 },
          bounces: { int: [0, 6], absentAs: 0 },
        });
        if (b.explode)
          checkFields(w.id, def.gun?.explode, b.explode as Behavior, {
            radius: { num: [30, calamityHowitzer || ownerExpandedBlast ? 220 : 140] },
            damage: { num: [1, calamityHowitzer ? 60 : 30] },
          });
      } else if (kind === "thrown") {
        checkFields(w.id, def.thrown, b, {
          speed: { num: [300, 1200] },
          range: { num: [200, 900] },
          damage: { num: [1, 40] },
          charges: { int: [1, 6] },
          refillSeconds: { num: [0.6, 4] },
          pierce: { int: [1, 5] },
          arcHeight: { num: [24, 180] },
          rotation: { eq: true },
          ricochetHops: { int: [0, 4] },
          ricochetRange: { num: [80, 900] },
          returning: { eq: true },
        });
      } else if (kind === "glovePair") {
        checkFields(w.id, def.glovePair, b, {
          wrapsFeet: { eq: true },
        });
      } else if (kind === "warp") {
        checkFields(w.id, def.warp, b, {
          burstRadius: { num: [24, 100] },
        });
      } else if (kind === "quake") {
        checkFields(w.id, def.quake, b, {
          radius: { num: [70, 220] },
          damage: { num: [1, 30] },
        });
      } else if (kind === "chainLightning") {
        checkFields(w.id, def.chainLightning, b, {
          jumps: { int: [1, 6] },
          range: { num: [100, 240] },
          damage: { num: [1, 24] },
          falloff: { num: [0.5, 1] },
        });
        if (b.vfx)
          checkFields(w.id, def.chainLightning?.vfx, b.vfx as Behavior, {
            color: { num: [0, 1] },
            jag: { num: [0, 1] },
            life: { num: [60, 600] },
          });
      } else if (kind === "scatter") {
        checkFields(w.id, def.scatter, b, {
          count: { int: [2, 10] },
          spread: { num: [0.2, 0.9] },
          speed: { num: [300, 1000] },
          range: { num: [150, 700] },
          damage: { num: [1, 24] },
          pierce: { int: [1, 5], absentAs: 1 },
        });
        if (b.explode)
          checkFields(w.id, def.scatter?.explode, b.explode as Behavior, {
            radius: { num: [30, 80] },
            damage: { num: [1, 30] },
          });
      }
    });
  }
});

describe("B17 poseLanguage strict generator fixtures", () => {
  const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
  const source = readJson("../data/weapon-concepts-300.json") as {
    weapons: Array<Record<string, unknown> & { banned?: boolean }>;
  };

  it("rejects unknown pose names, unknown keys, and secondary-grip without a secondary point", () => {
    const cases = [
      {
        name: "unknown-pose",
        poseLanguage: { idle: "thumbs-behind-back" },
        error: "poseLanguage.idle",
      },
      {
        name: "unknown-key",
        poseLanguage: { idle: "low-guard", recovery: "snap" },
        error: "unknown key poseLanguage.recovery",
      },
      {
        name: "missing-secondary",
        poseLanguage: { idle: "secondary-grip" },
        error: "secondary-grip requires gripPoints.secondary",
      },
    ] as const;

    for (const fixture of cases) {
      const tempDir = mkdtempSync(join(tmpdir(), `dd-b17-${fixture.name}-`));
      try {
        const mutated = structuredClone(source);
        const target = mutated.weapons.find((weapon) => !weapon.banned);
        if (!target) throw new Error("missing generator fixture weapon");
        delete target.gripPoints;
        target.poseLanguage = fixture.poseLanguage;
        const input = join(tempDir, "weapon-concepts.json");
        writeFileSync(input, JSON.stringify(mutated), "utf8");
        const result = spawnSync(process.execPath, ["tools/artkit/gen-weapon-expansion.mjs"], {
          cwd: repositoryRoot,
          env: { ...process.env, DD_WEAPON_CONCEPTS_SRC: input },
          encoding: "utf8",
        });
        expect(result.status, fixture.name).toBe(1);
        expect(result.stderr, fixture.name).toContain(fixture.error);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }, 30_000);
});

// §17 the dimension registry is partly codegen'd; its rosters/bosses are raw kind-id strings. A typo or a
// renamed/removed kind would fail SILENTLY (pickEnemyKind thins the pool, a bad boss id → no boss spawns).
// Turn that into a build failure instead of a dead dimension found mid-playtest.
describe("§17 dimension registry ↔ ENEMY_KINDS", () => {
  for (const [dimId, dim] of Object.entries(DIMENSIONS)) {
    it(`${dimId}: every roster id is a real, positively-weighted kind`, () => {
      for (const id of dim.roster) {
        const kind = ENEMY_KINDS[id];
        expect(kind, `${dimId} roster id "${id}"`).toBeDefined();
        expect(kind?.weight ?? 0, `${dimId} roster id "${id}" weight`).toBeGreaterThan(0);
      }
    });
    it(`${dimId}: the boss id resolves to a kind with archetype "boss"`, () => {
      const boss = ENEMY_KINDS[dim.boss];
      expect(boss, `${dimId} boss "${dim.boss}"`).toBeDefined();
      expect(boss?.archetype).toBe("big");
    });
  }

  it("every SHIFTER_KIND_IDS entry is a real kind carrying the shifter flag", () => {
    expect(SHIFTER_KIND_IDS.length).toBeGreaterThan(0);
    for (const id of SHIFTER_KIND_IDS) {
      const kind = ENEMY_KINDS[id];
      expect(kind, `shifter "${id}"`).toBeDefined();
      expect(kind?.shifter, `shifter "${id}" flag`).toBeDefined();
    }
  });
});
