import { DEFAULT_CHARACTER, WHOLE_ART_CHARACTERS, type WholeArtCharacter } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_SELECTION_STORAGE_KEY,
  type CharacterSelectionStorage,
  characterSelectionOptions,
  loadCharacterSelection,
  routeCharacterSelectionKey,
  sanitizeCharacterSelection,
  saveCharacterSelection,
} from "./character-select.js";

function memoryStorage(initial?: string): CharacterSelectionStorage & { value: string | null } {
  return {
    value: initial ?? null,
    getItem(key) {
      expect(key).toBe(CHARACTER_SELECTION_STORAGE_KEY);
      return this.value;
    },
    setItem(key, value) {
      expect(key).toBe(CHARACTER_SELECTION_STORAGE_KEY);
      this.value = value;
    },
  };
}

describe("character selection persistence", () => {
  it.each([
    undefined,
    null,
    "proto-retired-character",
    { version: 0, selectedCharacterId: "proto-retired-character" },
    { version: 1, selectedCharacterId: "drifter" },
    { version: 1, selectedCharacterId: 4 },
  ])("defaults a missing, corrupt, legacy, or non-whole-art value", (value) => {
    expect(sanitizeCharacterSelection(value).selectedCharacterId).toBe(DEFAULT_CHARACTER);
  });

  it.each(WHOLE_ART_CHARACTERS)("accepts and persists shared whole-art id %s", (id) => {
    const storage = memoryStorage();
    expect(saveCharacterSelection(id, storage)).toEqual({
      version: 1,
      selectedCharacterId: id,
    });
    expect(loadCharacterSelection(storage).selectedCharacterId).toBe(id);
  });

  it("falls back safely for malformed JSON and blocked storage", () => {
    expect(loadCharacterSelection(memoryStorage("{nope"))).toEqual({
      version: 1,
      selectedCharacterId: DEFAULT_CHARACTER,
    });
    expect(
      saveCharacterSelection("proto-wizard", {
        getItem: () => null,
        setItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual({ version: 1, selectedCharacterId: "proto-wizard" });
  });
});

describe("character selection behavior", () => {
  it("projects exactly the shared whole-art roster with one readable selected card", () => {
    const options = characterSelectionOptions("proto-wizard");
    expect(options.map((option) => option.id)).toEqual([...WHOLE_ART_CHARACTERS]);
    expect(options.every((option) => option.name.length > 0)).toBe(true);
    expect(options.filter((option) => option.selected).map((option) => option.id)).toEqual([
      "proto-wizard",
    ]);
  });

  it("routes bounded arrows plus Home/End and activates with Enter or Space", () => {
    expect(routeCharacterSelectionKey("ArrowLeft", 0)).toMatchObject({ focusIndex: 0 });
    expect(routeCharacterSelectionKey("ArrowRight", 0)).toEqual({
      handled: true,
      focusIndex: 1,
      activate: false,
    });
    expect(routeCharacterSelectionKey("End", 0)).toMatchObject({
      focusIndex: WHOLE_ART_CHARACTERS.length - 1,
    });
    expect(routeCharacterSelectionKey("Home", 2)).toMatchObject({ focusIndex: 0 });
    expect(routeCharacterSelectionKey("Enter", 1)).toEqual({
      handled: true,
      focusIndex: 1,
      activate: true,
    });
    expect(routeCharacterSelectionKey(" ", 2)).toMatchObject({ activate: true });
    expect(routeCharacterSelectionKey("q", 1)).toEqual({
      handled: false,
      focusIndex: 1,
      activate: false,
    });
  });

  it("sanitizes an invalid card activation before it can be saved", () => {
    const storage = memoryStorage();
    const selected = saveCharacterSelection("cc-asha-the-ash-walker", storage);
    expect(selected.selectedCharacterId).toBe(DEFAULT_CHARACTER);
    expect(
      JSON.parse(storage.value ?? "") as {
        selectedCharacterId: WholeArtCharacter;
      },
    ).toMatchObject({ selectedCharacterId: DEFAULT_CHARACTER });
  });
});
