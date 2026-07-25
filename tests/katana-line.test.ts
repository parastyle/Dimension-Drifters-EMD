import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DROP_POOL,
  katanaBeatEffectFor,
  MELEE_COMBO_VARIANT_SEQUENCES,
  meleeComboSelectionFor,
  WEAPON_IDS,
  WEAPONS,
  weaponAttackCooldown,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated";

const LINE = [
  ["drift-wakizashi-kagewake", "short", "short-flurry", 4],
  ["drift-wakizashi-hushglass", "short", "draw-opener", 5],
  ["drift-katana-stillwater-edict", "standard", "perfect-tempo", 6],
  ["drift-katana-stormthread", "standard", "storm-tempo", 7],
  ["drift-katana-riftstep", "standard", "finisher-reach", 4],
  ["drift-nodachi-pale-horizon", "long", "reach-crescendo", 5],
  ["drift-nodachi-gatebreaker", "long", "haste-break", 7],
  ["drift-greatkatana-moonwake", "great", "finisher-burst", 6],
  ["drift-greatkatana-tempest-regent", "great", "perfect-guard", 5],
  ["drift-colossal-world-seam", "colossal", "colossal-release", 4],
] as const;

const weapon = (id: (typeof LINE)[number][0]) => {
  const value = WEAPONS[id];
  if (!value) throw new Error(`missing katana-line weapon ${id}`);
  return value;
};

const sequence = (id: (typeof LINE)[number][0]) => {
  const variant = weapon(id).comboVariant;
  if (!variant || !(variant in MELEE_COMBO_VARIANT_SEQUENCES))
    throw new Error(`missing generated combo variant for ${id}`);
  return MELEE_COMBO_VARIANT_SEQUENCES[variant];
};

describe("Driftblade katana line", () => {
  it("keeps ten durable katana definitions, with both archived entries excluded from active loot", () => {
    const sizes: Record<string, number> = {};
    for (const [id, sizeClass, hook] of LINE) {
      const def = weapon(id);
      const archived = id === "drift-wakizashi-kagewake" || id === "drift-wakizashi-hushglass";
      expect(WEAPON_IDS.includes(id), `${id} active`).toBe(!archived);
      expect(DROP_POOL.includes(id), `${id} loot eligible`).toBe(!archived);
      expect(def.archived === true, `${id} archived`).toBe(archived);
      expect(def.expansion, `${id} curated`).toBe(false);
      expect(def.tags.family, `${id} pose family`).toBe("katana");
      expect(def.sizeClass, `${id}.sizeClass`).toBe(sizeClass);
      expect(def.katanaHook?.kind, `${id}.katanaHook.kind`).toBe(hook);
      expect(def.sprite, `${id} temporary lineage sprite`).toBe("driftblade");
      sizes[sizeClass] = (sizes[sizeClass] ?? 0) + 1;
    }
    expect(sizes).toEqual({ short: 2, standard: 3, long: 2, great: 2, colossal: 1 });
    expect(new Set(LINE.map(([, , hook]) => hook))).toHaveLength(10);
  });

  it("emits ten immutable, deliberate 4-7 beat bars with distinct rhythm signatures", () => {
    const rhythms = new Set<string>();
    for (const [id, , , beats] of LINE) {
      const bar = sequence(id);
      expect(bar, `${id} beat count`).toHaveLength(beats);
      expect(Object.isFrozen(bar), `${id} sequence frozen`).toBe(true);
      for (const step of bar) {
        expect(Object.isFrozen(step), `${id}/${step.name} frozen`).toBe(true);
        expect(step.timing.activeStart).toBeLessThan(step.timing.activeEnd);
        expect(step.timing.impact).toBeGreaterThanOrEqual(step.timing.activeStart);
        expect(step.timing.impact).toBeLessThanOrEqual(step.timing.activeEnd);
        expect(step.timing.activeEnd).toBeLessThanOrEqual(step.timing.followEnd);
        expect(step.ribbon, `${id}/${step.name} clean-arc ribbon`).toBeDefined();
      }
      rhythms.add(
        bar
          .map(
            (step) =>
              `${step.motion}:${step.direction}@${step.timing.activeStart}-${step.timing.impact}-${step.timing.followEnd}`,
          )
          .join("|"),
      );
    }
    expect(rhythms).toHaveLength(10);
  });

  it("keeps both retired wakizashi halves as independent archived one-handed definitions", () => {
    for (const id of ["drift-wakizashi-kagewake", "drift-wakizashi-hushglass"] as const) {
      expect(weapon(id).archived).toBe(true);
      expect(weapon(id).tags.grip).toBe("1H");
    }
  });

  it("resolves every mechanical hook at the authored beat", () => {
    expect(
      katanaBeatEffectFor(weapon("drift-wakizashi-hushglass"), 0, 5, false).damageMultiplier,
    ).toBe(1.38);

    const stillwater = weapon("drift-katana-stillwater-edict");
    expect(katanaBeatEffectFor(stillwater, 1, 6, true, 1.12).perfect).toBe(true);
    expect(katanaBeatEffectFor(stillwater, 1, 6, true, 1.121).perfect).toBe(false);

    const storm = weapon("drift-katana-stormthread");
    expect(katanaBeatEffectFor(storm, 0, 7, false).damageMultiplier).toBeCloseTo(1.045);
    expect(katanaBeatEffectFor(storm, 6, 7, true).damageMultiplier).toBeCloseTo(1.27);

    const rift = katanaBeatEffectFor(weapon("drift-katana-riftstep"), 3, 4, true);
    expect(rift).toMatchObject({ finisher: true, damageMultiplier: 1.14 });
    expect("dashImpulse" in rift).toBe(false);
    expect(
      meleeComboSelectionFor(weapon("drift-katana-riftstep"))?.sequence[3]?.path.rangeMultiplier,
    ).toBe(1.36);

    expect(
      katanaBeatEffectFor(weapon("drift-nodachi-pale-horizon"), 4, 5, true).reachMultiplier,
    ).toBe(1.24);

    const gate = weapon("drift-nodachi-gatebreaker");
    expect(weaponAttackCooldown(gate)).toBeCloseTo(0.4264);
    expect(katanaBeatEffectFor(gate, 2, 7, true).damageMultiplier).toBe(0.86);
    expect(katanaBeatEffectFor(gate, 6, 7, true).toughDamageMultiplier).toBe(1.8);

    expect(katanaBeatEffectFor(weapon("drift-greatkatana-moonwake"), 5, 6, true)).toMatchObject({
      burstRadius: 175,
      burstDamage: 12,
    });

    const guard = weapon("drift-greatkatana-tempest-regent");
    expect(katanaBeatEffectFor(guard, 1, 5, true, 1.14)).toMatchObject({
      perfect: true,
      invulnerabilitySeconds: 0.08,
    });
    expect(katanaBeatEffectFor(guard, 1, 5, true, 1.141).invulnerabilitySeconds).toBe(0);

    expect(katanaBeatEffectFor(weapon("drift-colossal-world-seam"), 3, 4, true)).toMatchObject({
      finisher: true,
      damageMultiplier: 1.65,
      reachMultiplier: 1.12,
    });
  });

  it("bakes one distinct procedural VFX suite from each per-weapon source assignment", () => {
    const signatures = new Set<string>();
    for (const [id] of LINE) {
      const source = JSON.parse(
        readFileSync(
          fileURLToPath(new URL(`../tools/weaponsmith/assignments/${id}.json`, import.meta.url)),
          "utf8",
        ),
      ) as { suite: Record<string, { on: boolean }>; vfxRadius: number };
      const baked = WEAPON_VFX[id];
      expect(baked, `${id} baked VFX`).toBeDefined();
      expect(baked?.vfxRadius, `${id} radius`).toBe(source.vfxRadius);
      expect(
        Object.values(source.suite).some((layer) => layer.on),
        `${id} enabled source layer`,
      ).toBe(true);
      expect(
        Object.values(baked?.suite ?? {}).every((layer) => layer.on),
        `${id} enabled output`,
      ).toBe(true);
      signatures.add(JSON.stringify(baked));
    }
    expect(signatures).toHaveLength(10);
  });

  it("flags exactly four follow-up bespoke-sheet candidates without requiring rendered assets now", () => {
    expect(LINE.filter(([id]) => weapon(id).bespokeVfxSheet).map(([id]) => id)).toEqual([
      "drift-katana-riftstep",
      "drift-greatkatana-moonwake",
      "drift-greatkatana-tempest-regent",
      "drift-colossal-world-seam",
    ]);
    for (const [id] of LINE) expect(WEAPON_VFX[id]?.hero, `${id} no rendered hero`).toBeUndefined();
  });
});
