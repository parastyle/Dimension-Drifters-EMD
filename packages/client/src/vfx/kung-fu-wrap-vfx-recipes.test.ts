import { describe, expect, it } from "vitest";
import { KUNG_FU_WRAP_VFX_RECIPES, kungFuWrapBeatAudioCue } from "./kung-fu-wrap-vfx-recipes.js";

describe("B19 kung-fu wrap beat accents", () => {
  it("keeps four distinct shipped visual recipes", () => {
    expect(
      new Set(Object.values(KUNG_FU_WRAP_VFX_RECIPES).map((recipe) => recipe.swing)).size,
    ).toBe(4);
    expect(
      new Set(Object.values(KUNG_FU_WRAP_VFX_RECIPES).map((recipe) => recipe.impact)).size,
    ).toBe(4);
  });

  it("routes every kick through a foot-weighted cue and preserves style hand accents", () => {
    for (const weaponId of Object.keys(KUNG_FU_WRAP_VFX_RECIPES)) {
      expect(kungFuWrapBeatAudioCue(weaponId, "foot", "stomp-kick"), weaponId).toBe("melee:blunt");
    }
    expect(kungFuWrapBeatAudioCue("x2-wing-chun-wraps", "hand", "chain-punch")).toBe("melee:light");
    expect(kungFuWrapBeatAudioCue("x2-drunken-fist-wraps", "hand", "weave-cross")).toBe(
      "melee:arcane",
    );
    expect(kungFuWrapBeatAudioCue("x2-muay-thai-wraps", "hand", "elbow")).toBe("melee:heavy");
    expect(kungFuWrapBeatAudioCue("x2-iron-palm-wraps", "hand", "quake-double-palm")).toBe(
      "melee:heavy",
    );
  });
});
