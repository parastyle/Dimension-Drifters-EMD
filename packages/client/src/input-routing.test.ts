import { describe, expect, it } from "vitest";
import {
  routeArmoryUiInput,
  routeOwnerNoteInput,
  routeWeaponInput,
  type ArmoryUiContext,
  type WeaponInputMode,
} from "./input-routing.js";

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

// ARMORY UI TRACK A — append-only context routing coverage.
describe("armory UI input routing", () => {
  const sample = (
    context: ArmoryUiContext,
    overrides: Partial<Parameters<typeof routeArmoryUiInput>[0]> = {},
  ) => ({
    context,
    modalOpen: false,
    textInputFocused: false,
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false,
    enterPressed: false,
    escapePressed: false,
    closePressed: false,
    previousContextPressed: false,
    nextContextPressed: false,
    previousPagePressed: false,
    nextPagePressed: false,
    resetPressed: false,
    digitPressed: null,
    ...overrides,
  });

  it("maps the same physical keys to explicit Closet-only navigation verbs", () => {
    expect(routeArmoryUiInput(sample("wardrobe", { nextContextPressed: true }))).toMatchObject({
      contextDelta: 1,
      workflowDelta: 0,
      gameplayEnabled: false,
    });
    expect(routeArmoryUiInput(sample("wardrobe", { nextPagePressed: true }))).toMatchObject({
      pageDelta: 1,
      preset: null,
    });
    expect(routeArmoryUiInput(sample("wardrobe", { resetPressed: true, digitPressed: 6 }))).toMatchObject({
      reset: true,
      preset: 6,
    });
  });

  it("maps Backpack Z/X to workflows and keeps Q/1-3 inside the modal", () => {
    expect(
      routeArmoryUiInput(
        sample("backpack", {
          nextContextPressed: true,
          previousPagePressed: true,
          digitPressed: 3,
        }),
      ),
    ).toMatchObject({ contextDelta: 1, workflowDelta: -1, pageDelta: 0, activeSlot: 3 });
  });

  it("lets any higher modal and a focused search field swallow the complete catalog frame", () => {
    for (const overrides of [{ modalOpen: true }, { textInputFocused: true }]) {
      expect(
        routeArmoryUiInput(
          sample("wardrobe", {
            ...overrides,
            rightPressed: true,
            enterPressed: true,
            nextContextPressed: true,
            nextPagePressed: true,
            resetPressed: true,
            digitPressed: 2,
          }),
        ),
      ).toEqual({
        move: null,
        primary: false,
        contextDelta: 0,
        pageDelta: 0,
        workflowDelta: 0,
        reset: false,
        preset: null,
        activeSlot: null,
        close: false,
        gameplayEnabled: false,
      });
    }
  });
});
