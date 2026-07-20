import { describe, expect, it } from "vitest";
import { routeWeaponInput, type WeaponInputMode } from "./input-routing.js";

const base = (mode: WeaponInputMode = "arena") => ({
  mode,
  alive: true,
  pickupPromptVisible: false,
  interactPressed: false,
  cyclePressed: false,
  previousPagePressed: false,
  nextPagePressed: false,
});

describe("weapon input routing", () => {
  it("routes E to pickup alone while a pickup prompt is active", () => {
    expect(
      routeWeaponInput({
        ...base("training"),
        pickupPromptVisible: true,
        interactPressed: true,
        cyclePressed: true,
        nextPagePressed: true,
      }),
    ).toEqual({ pickup: true, cycle: false, galleryPage: 0 });
  });

  it.each([
    "arena",
    "belt",
  ] as const)("keeps Testing-Grounds page keys inert in %s combat", (mode) => {
    for (const key of ["previousPagePressed", "nextPagePressed"] as const) {
      expect(routeWeaponInput({ ...base(mode), [key]: true })).toEqual({
        pickup: false,
        cycle: false,
        galleryPage: 0,
      });
    }
  });

  it("keeps E inert instead of falling through when no pickup is available", () => {
    expect(routeWeaponInput({ ...base("training"), interactPressed: true })).toEqual({
      pickup: false,
      cycle: false,
      galleryPage: 0,
    });
  });

  it("gives Q the same single cycle verb in every gameplay mode", () => {
    for (const mode of ["arena", "training", "belt"] as const) {
      expect(routeWeaponInput({ ...base(mode), cyclePressed: true })).toEqual({
        pickup: false,
        cycle: true,
        galleryPage: 0,
      });
    }
  });

  it("routes Z/X only to opposite Testing-Grounds page directions", () => {
    expect(routeWeaponInput({ ...base("training"), previousPagePressed: true })).toMatchObject({
      pickup: false,
      cycle: false,
      galleryPage: -1,
    });
    expect(routeWeaponInput({ ...base("training"), nextPagePressed: true })).toMatchObject({
      pickup: false,
      cycle: false,
      galleryPage: 1,
    });
  });
});
