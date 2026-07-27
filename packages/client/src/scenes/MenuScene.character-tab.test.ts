import { createMetaAccountV5, DEFAULT_CHARACTER, WHOLE_ART_CHARACTERS } from "@dd/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHARACTER_SELECTION_STORAGE_KEY } from "../ui/character-select.js";
import { PET_META_STORAGE_KEY, selectPet } from "../ui/pet-select.js";
import { prestigeCeremonyView } from "../ui/wardrobe/model.js";

vi.mock("phaser", () => {
  const target = function PhaserStub() {};
  let stub: unknown;
  stub = new Proxy(target, {
    get(inner, property) {
      if (property === "prototype") return inner.prototype;
      if (property === Symbol.toPrimitive) return () => 0;
      return stub;
    },
    apply: () => 0,
    construct: () => ({}),
  });
  return { default: stub };
});

const {
  DESTINATION_PRESTIGE_COPY,
  INITIAL_MENU_TAB,
  MENU_TAB_DESCRIPTORS,
  MenuScene,
  destinationPrestigeEligibilityCopy,
  menuLaunchSelections,
  menuTabVisibility,
} = await import("./MenuScene.js");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MenuScene Characters tab contract", () => {
  it("builds Characters instead of the dormant Wardrobe and omits its art preload", () => {
    const createSource = MenuScene.prototype.create.toString();
    const preloadSource = MenuScene.prototype.preload.toString();

    expect(createSource).toContain("buildCharacterWorkspace");
    expect(createSource).not.toContain("buildWardrobeWorkspace");
    expect(preloadSource).toContain("queueCharacterPreviewTextures");
    expect(preloadSource).not.toMatch(
      /boilerplateTextureKey|boilerplateTextureUrl|gearTextureUrl|GEAR_PARTS_MANIFEST\.boilerplate/,
    );
  });

  it("starts on Characters and keeps Armory / Carry, Packs, and Destinations reachable", () => {
    expect(INITIAL_MENU_TAB).toBe("characters");
    expect(MENU_TAB_DESCRIPTORS).toEqual([
      { tab: "characters", label: "CHARACTERS", width: 142 },
      { tab: "armory", label: "ARMORY / CARRY", width: 176 },
      { tab: "packs", label: "PACKS", width: 142 },
      { tab: "options", label: "OPTIONS", width: 142 },
      { tab: "run", label: "DESTINATIONS", width: 142 },
    ]);
    expect(MENU_TAB_DESCRIPTORS.some((row) => String(row.tab) === "wardrobe")).toBe(false);
    expect(menuTabVisibility("characters")).toMatchObject({
      characters: true,
      companions: true,
      armory: false,
      packs: false,
      prestige: false,
    });
    expect(menuTabVisibility("armory")).toMatchObject({
      characters: false,
      companions: false,
      armory: true,
      packs: false,
    });
    expect(menuTabVisibility("packs")).toMatchObject({
      characters: false,
      companions: false,
      armory: false,
      packs: true,
    });
    expect(menuTabVisibility("options")).toMatchObject({
      characters: false,
      companions: false,
      armory: false,
      packs: false,
      options: true,
    });
    expect(menuTabVisibility("run")).toMatchObject({
      destinations: true,
      prestige: true,
      companions: false,
    });
  });

  it("uses the same persisted selection commit for pointer and keyboard activation", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const refreshCharacterWorkspace = vi.fn();
    const play = vi.fn();
    const sceneState = {
      selectedCharacterId: DEFAULT_CHARACTER,
      characterFocusIndex: 0,
      metaAccount: createMetaAccountV5(),
      audio: { play },
      refreshCharacterWorkspace,
    };
    const selectCharacter = Reflect.get(MenuScene.prototype, "selectCharacter") as (
      this: typeof sceneState,
      id: (typeof WHOLE_ART_CHARACTERS)[number],
    ) => void;

    selectCharacter.call(sceneState, "proto-wizard");

    expect(sceneState.selectedCharacterId).toBe("proto-wizard");
    expect(sceneState.characterFocusIndex).toBe(WHOLE_ART_CHARACTERS.indexOf("proto-wizard"));
    expect(JSON.parse(values.get(CHARACTER_SELECTION_STORAGE_KEY) ?? "")).toEqual({
      version: 1,
      selectedCharacterId: "proto-wizard",
    });
    expect(refreshCharacterWorkspace).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledWith("armory:stage");
  });

  it("launches with both the selected whole-art character and unchanged companion selection", () => {
    expect(menuLaunchSelections("proto-samurai", "gilded-gecko")).toEqual({
      selectedCharacterId: "proto-samurai",
      selectedPetId: "gilded-gecko",
    });
  });

  it("keeps companion selection writable while companions live on Characters", () => {
    const writes = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => writes.get(key) ?? null,
      setItem: (key: string, value: string) => writes.set(key, value),
    });
    const account = createMetaAccountV5();
    account.pets["gilded-gecko"] = { bondXp: 250 };

    const selected = selectPet(account, "gilded-gecko");

    expect(menuTabVisibility("characters").companions).toBe(true);
    expect(selected.selectedPetId).toBe("gilded-gecko");
    expect(JSON.parse(writes.get(PET_META_STORAGE_KEY) ?? "").selectedPetId).toBe("gilded-gecko");
  });

  it("keeps eligible prestige reachable from Destinations with neutral reward copy", () => {
    const view = prestigeCeremonyView(createMetaAccountV5(), true);
    expect(view.eligible).toBe(true);
    expect(menuTabVisibility("run").prestige).toBe(true);
    expect(destinationPrestigeEligibilityCopy(view)).toBe(view.eligibilityCopy);
    expect(destinationPrestigeEligibilityCopy({ ...view, nextWorldTier: null })).toBe(
      "WORLD TIER 30 · CAP",
    );
    expect(Object.values(DESTINATION_PRESTIGE_COPY).join("\n")).not.toMatch(/hat|tower|wardrobe/i);
  });
});
