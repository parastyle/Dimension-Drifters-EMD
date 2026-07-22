import { readFileSync } from "node:fs";
import { MELEE_TWO_HAND_GRIP_REACH, swingDescriptorFor, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  headsmanExtensionGeometry,
  resolveHeadsmanTreatment,
  SANCTIFIED_HEADSMAN_BLADE_OVERLAP_FRACTION,
  SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT,
} from "../packages/client/src/vfx/headsman-prototypes.js";
import { WEAPON_VFX } from "../packages/client/src/vfx/weapon-vfx.generated.js";
import {
  GENERIC_IMPACT_RING_LAYER_IDS,
  splitWeaponVfxSuite,
  weaponVfxSuiteFor,
} from "../packages/client/src/vfx/weapon-vfx-suite.js";

describe("V6.1 Headsman ship decision", () => {
  it("locks production to Pale Procession while retaining dev-only review selection", () => {
    expect(SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT).toMatchObject({
      proto: 2,
      name: "Pale Procession",
      textureKey: "headsman-proto:2",
    });
    for (const selection of ["?proto=1", "?proto=3", "?proto=4"])
      expect(resolveHeadsmanTreatment(selection, "#p4", false)).toBe(
        SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT,
      );
    expect(resolveHeadsmanTreatment("?proto=4", "", true).proto).toBe(4);
  });

  it("roots the extension under the physical blade, masks the alpha inset, and preserves the 3x endpoint", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    expect(headsman).toBeDefined();
    if (!headsman) throw new Error("missing Sanctified Headsman fixture");
    const geometry = headsmanExtensionGeometry(headsman);
    const gripReach = headsman.twoHanded ? MELEE_TWO_HAND_GRIP_REACH : 0;
    const physicalTip = gripReach + geometry.physicalBladeLength;
    expect(geometry.extensionStart).toBeLessThan(physicalTip);
    expect(physicalTip - geometry.extensionStart).toBeCloseTo(geometry.overlapLength);
    expect(geometry.overlapLength).toBeCloseTo(
      geometry.physicalBladeLength * SANCTIFIED_HEADSMAN_BLADE_OVERLAP_FRACTION,
    );
    expect(geometry.overlapLength).toBeGreaterThan(geometry.extensionLength * (8 / 528));
    expect(geometry.extensionStart + geometry.extensionLength).toBeCloseTo(
      gripReach + geometry.totalBladeLength,
    );
    // Base card authoring is unchanged; V7-HIT derives active server reach from the shared extension.
    expect(headsman.range).toBe(160);

    const player = readFileSync("packages/client/src/vfx/VfxPlayer.ts", "utf8");
    expect(player).toContain("heldTip.x - Math.cos(angle) * overlapLength");
    expect(player).toContain(".setDepth((heldTip?.depth ?? attachment.fallbackDepth) - 1)");
  });
});

describe("V6.1 generic cursor-circle regression", () => {
  it("emits no generic ring primitive and does not require a replacement impact", () => {
    for (const definition of Object.values(WEAPONS)) {
      if (definition.archived) continue;
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const suite = weaponVfxSuiteFor(definition.id, definition.tags.element, swing.style).suite;
      for (const layerId of GENERIC_IMPACT_RING_LAYER_IDS)
        expect(suite[layerId]?.on, `${definition.id}:${layerId}`).not.toBe(true);
      if (suite["painted-impact"]?.on)
        expect(suite["painted-impact"]?.params.paint, definition.id).toBeTypeOf("number");
    }

    for (const [weaponId, recipe] of Object.entries(WEAPON_VFX))
      for (const layerId of GENERIC_IMPACT_RING_LAYER_IDS)
        expect(recipe.suite[layerId]?.on, `${weaponId}:${layerId}`).not.toBe(true);

    for (const id of ["x2-revenant-knuckle", "x2-mournveil-scythe", "drift-colossal-world-seam"]) {
      const definition = WEAPONS[id];
      if (!definition) throw new Error(`missing V6.1 fixture ${id}`);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      expect(
        weaponVfxSuiteFor(id, definition.tags.element, swing.style).suite["painted-impact"],
        id,
      ).toMatchObject({ on: true });
    }

    for (const id of ["x2-voltfang-tachi", "x2-sanctified-headsman"]) {
      const definition = WEAPONS[id];
      if (!definition) throw new Error(`missing V6.3 targetless fixture ${id}`);
      const swing = swingDescriptorFor(definition, definition.cooldown);
      const suite = weaponVfxSuiteFor(id, definition.tags.element, swing.style).suite;
      expect(Object.keys(splitWeaponVfxSuite(suite).target), id).toEqual([]);
    }
  });

  it("routes replacement impacts to Codex splat art without a rim drawing path", () => {
    expect(globalThis.VFXLAYERS.LAYERS["painted-impact"]).toMatchObject({
      trigger: "impact",
      anchor: "target",
    });
    const renderer = readFileSync("packages/client/src/vfx/vfx-render.js", "utf8");
    const replacement = renderer.slice(
      renderer.indexOf('"painted-impact": {'),
      renderer.indexOf('"hit-spark": {'),
    );
    expect(replacement).toContain("S.paintedImpact?.(o.params)");
    expect(replacement).not.toMatch(/paintBrokenRim|\.arc\(|\.ellipse\(|\.circle\(/i);
  });
});
