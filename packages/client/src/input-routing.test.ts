import { describe, expect, it } from "vitest";
import { routeOwnerNoteInput, routeWeaponInput, type WeaponInputMode } from "./input-routing.js";

const base = (mode: WeaponInputMode = "arena") => ({
  mode,
  modalOpen: false,
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

  it("swallows every weapon/combat selection verb while a note modal is open", () => {
    expect(
      routeWeaponInput({
        ...base("training"),
        modalOpen: true,
        pickupPromptVisible: true,
        interactPressed: true,
        cyclePressed: true,
        previousPagePressed: true,
        nextPagePressed: true,
      }),
    ).toEqual({ pickup: false, cycle: false, galleryPage: 0 });
  });
});

describe("owner-note input routing", () => {
  const sample = (overrides: Partial<Parameters<typeof routeOwnerNoteInput>[0]> = {}) => ({
    mode: "training" as const,
    modalOpen: false,
    gameNotePressed: false,
    weaponNotePressed: false,
    ...overrides,
  });

  it("opens G as a game note and T as a weapon note only in Testing Grounds", () => {
    expect(routeOwnerNoteInput(sample({ gameNotePressed: true }))).toEqual({
      openNote: "game",
      toggleTraining: false,
      gameplayEnabled: false,
    });
    expect(routeOwnerNoteInput(sample({ weaponNotePressed: true }))).toEqual({
      openNote: "weapon",
      toggleTraining: false,
      gameplayEnabled: false,
    });
    expect(routeOwnerNoteInput(sample({ mode: "arena", gameNotePressed: true }))).toEqual({
      openNote: null,
      toggleTraining: false,
      gameplayEnabled: true,
    });
  });

  it("keeps T's enter-Testing-Grounds verb outside training", () => {
    expect(routeOwnerNoteInput(sample({ mode: "arena", weaponNotePressed: true }))).toEqual({
      openNote: null,
      toggleTraining: true,
      gameplayEnabled: true,
    });
  });

  it("lets an open modal swallow note, training-toggle, and gameplay verbs", () => {
    expect(
      routeOwnerNoteInput(
        sample({ modalOpen: true, gameNotePressed: true, weaponNotePressed: true }),
      ),
    ).toEqual({ openNote: null, toggleTraining: false, gameplayEnabled: false });
  });
});
