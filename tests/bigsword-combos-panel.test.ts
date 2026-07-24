import { readFileSync } from "node:fs";
import {
  comboStepForAttackSeq,
  MELEE_COMBO_VARIANT_SEQUENCES,
  meleeComboSelectionFor,
  swingDescriptorFor,
  swingDescriptorForAttackSeq,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const PANEL_VARIANTS = [
  "greatsword-momentum",
  "claymore-breach",
  "glaive-compass",
  "bardiche-hookbreak",
] as const;

const PANEL_ROSTER = {
  "greatsword-momentum": [
    "tombstone-greatsword",
    "x-sword-coffin",
    "x-sword-bone",
    "x2-rimewrit-grave-slab",
    "x2-pyre-gallows-brand",
    "x2-stormrail-colossus",
    "x2-nullwake-ordinance",
    "x2-dawnwall-testament",
    "x2-cairnfall-monolith",
  ],
  "claymore-breach": ["x2-tombwarden-claymore", "x2-dustreaper-zweihander"],
  "glaive-compass": ["x2-thunderhead-voulge", "x2-wickfire-fauchard"],
  "bardiche-hookbreak": ["x2-permafrost-bardiche"],
} as const;

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing test weapon: ${id}`);
  return definition;
}

describe("big-sword visual combo panel", () => {
  it("routes each designer family to its own immutable three-step sentence", () => {
    for (const variant of PANEL_VARIANTS) {
      const sequence = MELEE_COMBO_VARIANT_SEQUENCES[variant];
      expect(Object.isFrozen(sequence), variant).toBe(true);
      expect(sequence, variant).toHaveLength(3);
      expect(new Set(sequence.map((step) => step.motion)).size, variant).toBe(3);
      for (const step of sequence) expect(Object.isFrozen(step), step.name).toBe(true);
    }

    expect(MELEE_COMBO_VARIANT_SEQUENCES["greatsword-momentum"].map((step) => step.motion)).toEqual(
      ["falling-gate", "backswing-wheel", "runaway-cleave"],
    );
    expect(MELEE_COMBO_VARIANT_SEQUENCES["claymore-breach"].map((step) => step.motion)).toEqual([
      "highland-gate",
      "rising-ward",
      "bind-break-cast-off",
    ]);
    expect(MELEE_COMBO_VARIANT_SEQUENCES["glaive-compass"].map((step) => step.motion)).toEqual([
      "long-reap",
      "shaft-switch",
      "compass-rose",
    ]);
    expect(MELEE_COMBO_VARIANT_SEQUENCES["bardiche-hookbreak"].map((step) => step.motion)).toEqual([
      "headsmans-drop",
      "hook-and-haul",
      "gallows-turn",
    ]);
  });

  it("covers the explicit panel roster while retaining the nodachi benchmark", () => {
    for (const variant of PANEL_VARIANTS) {
      for (const id of PANEL_ROSTER[variant]) {
        expect(meleeComboSelectionFor(weapon(id)), id).toMatchObject({ family: "chop", variant });
      }
    }
    // §50 Driftblade-model rollout split: the MODEL anchor stays on `greatsword`; the two nodachi are
    // no longer byte-for-byte clones — they route to their own adopter variants (de-clone, M8).
    expect(meleeComboSelectionFor(weapon("driftblade")), "driftblade").toMatchObject({
      family: "chop",
      variant: "greatsword",
    });
    expect(meleeComboSelectionFor(weapon("x2-gravechill-nodachi"))).toMatchObject({
      family: "chop",
      variant: "nodachi-coldcourt",
    });
    expect(meleeComboSelectionFor(weapon("x2-stormpetal-odachi"))).toMatchObject({
      family: "chop",
      variant: "nodachi-petalfall",
    });
    expect(meleeComboSelectionFor(weapon("x2-quarry-splitter-bardiche"))).toMatchObject({
      family: "chop",
      variant: "quarry-frontflip-slam",
    });
  });

  it("does not flatten Dervish, Anchor, spade, or true quake maulers", () => {
    expect(meleeComboSelectionFor(weapon("x-sword-whirlwind"))).toBeUndefined();
    expect(meleeComboSelectionFor(weapon("x-sword-anchor"))).toBeUndefined();
    expect(meleeComboSelectionFor(weapon("gravediggers-spade"))).toBeUndefined();
    expect(meleeComboSelectionFor(weapon("x2-boomtown-maul"))).toMatchObject({
      variant: "quake-mauler",
    });
  });

  it("keeps every new path on one unit-strength Stage-1 server sweep", () => {
    for (const variant of PANEL_VARIANTS) {
      for (const step of MELEE_COMBO_VARIANT_SEQUENCES[variant]) {
        expect(step.path, `${variant}:${step.name}`).toEqual({
          kind: "sweep",
          arcMultiplier: 1,
          rangeMultiplier: 1,
          damageMultiplier: 1,
          knockback: 0,
        });
        expect(step.timing.activeStart).toBeLessThan(step.timing.activeEnd);
        expect(step.timing.activeEnd).toBeLessThanOrEqual(step.timing.followEnd);
        expect(step.timing.followEnd).toBeLessThanOrEqual(1);
        expect(step.timing.impact).toBeGreaterThanOrEqual(step.timing.activeStart);
        expect(step.timing.impact).toBeLessThanOrEqual(step.timing.activeEnd);
      }
    }
  });

  it("authors a different business-edge ribbon for every beat without a second bright contact", () => {
    const profiles = new Set<string>();
    for (const variant of PANEL_VARIANTS) {
      for (const step of MELEE_COMBO_VARIANT_SEQUENCES[variant]) {
        expect(step.ribbon, `${variant}:${step.name}`).toBeDefined();
        if (!step.ribbon) continue;
        profiles.add(step.ribbon.profile);
        expect(step.ribbon.radialStart).toBeGreaterThanOrEqual(0);
        expect(step.ribbon.radialEnd).toBe(1);
        expect(step.ribbon.radialStart).toBeLessThan(step.ribbon.radialEnd);
        expect(step.ribbon.setupEcho === undefined || step.ribbon.setupEcho === "neutral-dim").toBe(
          true,
        );
      }
    }
    expect(profiles.size).toBe(12);
    expect(MELEE_COMBO_VARIANT_SEQUENCES["glaive-compass"][0]?.ribbon?.radialStart).toBe(0.68);
    expect(MELEE_COMBO_VARIANT_SEQUENCES["bardiche-hookbreak"][0]?.ribbon?.radialStart).toBe(0.68);
  });

  it("resolves visual steps directly from uint32 attackSeq, including wrap", () => {
    expect([1, 2, 3, 4, 5, 6].map((seq) => comboStepForAttackSeq(seq, 3))).toEqual([
      0, 1, 2, 0, 1, 2,
    ]);
    expect(comboStepForAttackSeq(0xffffffff, 3)).toBe(2);
    expect(comboStepForAttackSeq(0, 3)).toBe(2);
    expect(comboStepForAttackSeq(123, 0)).toBe(0);

    const definition = weapon("x2-dustreaper-zweihander");
    const base = swingDescriptorFor(definition, definition.cooldown);
    const enriched = swingDescriptorForAttackSeq(base, definition, 5);
    expect(enriched).toMatchObject({
      comboVariant: "claymore-breach",
      comboStep: 1,
      motion: "rising-ward",
    });
    expect(enriched.activeStartSeconds).toBe(base.activeStartSeconds);
    expect(enriched.activeEndSeconds).toBe(base.activeEndSeconds);
    expect(enriched.impactSeconds).toBe(base.impactSeconds);
  });

  it("scales the one descriptor clock for Swift and Heavy without changing pose fractions", () => {
    const definition = weapon("tombstone-greatsword");
    const swift = swingDescriptorFor(definition, definition.cooldown * 0.82);
    const normal = swingDescriptorFor(definition, definition.cooldown);
    const heavy = swingDescriptorFor(definition, definition.cooldown * 1.2);
    expect(swift.poseSeconds / normal.poseSeconds).toBeCloseTo(0.82, 8);
    expect(heavy.poseSeconds / normal.poseSeconds).toBeCloseTo(1.2, 8);
    expect(swift.activeStartSeconds / swift.poseSeconds).toBeCloseTo(
      normal.activeStartSeconds / normal.poseSeconds,
      8,
    );
    expect(heavy.impactSeconds / heavy.poseSeconds).toBeCloseTo(
      normal.impactSeconds / normal.poseSeconds,
      8,
    );
  });

  it("consumes the retained beat in SpriteRig and keeps all flourish on visual channels", () => {
    const source = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("comboStepForAttackSeq(this.attackBeatSeq, sequence.length)");
    expect(source).toContain(
      "remapPoseTimeAtImpact(tt, comboPose.timing.impact, descriptorImpact)",
    );
    expect(source).toContain("private applyMomentumCombo(");
    expect(source).toContain("private applyBreachCombo(");
    expect(source).toContain("private applyCompassCombo(");
    expect(source).toContain("private applyHookbreakCombo(");
    const panelPoses = source.slice(
      source.indexOf("private applyMomentumCombo("),
      source.indexOf("/** Hammer-head fulcrum vault"),
    );
    expect(panelPoses).not.toMatch(/this\.root\.(?:x|y)\s*[+\-*/]?=/);
  });
});
