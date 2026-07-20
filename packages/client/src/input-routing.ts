export type WeaponInputMode = "arena" | "training" | "belt";
export type OwnerNoteType = "game" | "weapon";

export interface WeaponInputSample {
  readonly mode: WeaponInputMode;
  readonly modalOpen: boolean;
  readonly alive: boolean;
  readonly pickupPromptVisible: boolean;
  readonly interactPressed: boolean;
  readonly cyclePressed: boolean;
  readonly previousPagePressed: boolean;
  readonly nextPagePressed: boolean;
}

export interface WeaponInputRoute {
  readonly pickup: boolean;
  readonly cycle: boolean;
  readonly galleryPage: -1 | 0 | 1;
}

/**
 * One physical key owns one weapon verb:
 * E interacts, Q cycles, and Z/X page the Testing-Grounds gallery.
 */
export function routeWeaponInput(sample: WeaponInputSample): WeaponInputRoute {
  if (sample.modalOpen) return { pickup: false, cycle: false, galleryPage: 0 };
  const pageDelta = Number(sample.nextPagePressed) - Number(sample.previousPagePressed);
  const pickup = sample.alive && sample.pickupPromptVisible && sample.interactPressed;
  return {
    pickup,
    cycle: !pickup && sample.cyclePressed,
    galleryPage:
      !pickup && sample.mode === "training" && pageDelta !== 0 ? (pageDelta < 0 ? -1 : 1) : 0,
  };
}

export interface OwnerNoteInputSample {
  readonly mode: WeaponInputMode;
  readonly modalOpen: boolean;
  readonly gameNotePressed: boolean;
  readonly weaponNotePressed: boolean;
}

export interface OwnerNoteInputRoute {
  readonly openNote: OwnerNoteType | null;
  readonly toggleTraining: boolean;
  readonly gameplayEnabled: boolean;
}

/**
 * G/T are context verbs: in Testing Grounds they open owner-note bubbles; elsewhere only T
 * retains its existing enter-Testing-Grounds verb. Any modal owns the whole input frame.
 */
export function routeOwnerNoteInput(sample: OwnerNoteInputSample): OwnerNoteInputRoute {
  if (sample.modalOpen) {
    return { openNote: null, toggleTraining: false, gameplayEnabled: false };
  }
  if (sample.mode === "training") {
    const openNote = sample.gameNotePressed ? "game" : sample.weaponNotePressed ? "weapon" : null;
    return { openNote, toggleTraining: false, gameplayEnabled: openNote === null };
  }
  return {
    openNote: null,
    toggleTraining: sample.weaponNotePressed,
    gameplayEnabled: true,
  };
}

export type ArmoryUiContext = "wardrobe" | "menu-armory" | "backpack";
export type ArmoryUiMove = "left" | "right" | "up" | "down" | null;

export interface ArmoryUiInputSample {
  readonly context: ArmoryUiContext;
  /** A higher-priority modal (owner note, level choice, legend, summon sheet) owns the frame. */
  readonly modalOpen: boolean;
  readonly textInputFocused: boolean;
  readonly leftPressed: boolean;
  readonly rightPressed: boolean;
  readonly upPressed: boolean;
  readonly downPressed: boolean;
  readonly enterPressed: boolean;
  readonly escapePressed: boolean;
  readonly closePressed: boolean;
  readonly previousContextPressed: boolean;
  readonly nextContextPressed: boolean;
  readonly previousPagePressed: boolean;
  readonly nextPagePressed: boolean;
  readonly resetPressed: boolean;
  readonly digitPressed: number | null;
}

export interface ArmoryUiInputRoute {
  readonly move: ArmoryUiMove;
  readonly primary: boolean;
  readonly contextDelta: -1 | 0 | 1;
  readonly pageDelta: -1 | 0 | 1;
  readonly workflowDelta: -1 | 0 | 1;
  readonly reset: boolean;
  readonly preset: number | null;
  readonly activeSlot: number | null;
  readonly close: boolean;
  readonly gameplayEnabled: false;
}

const emptyArmoryUiRoute = (): ArmoryUiInputRoute => ({
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

/**
 * Canvas armory surfaces are explicit input contexts. While one is open it swallows gameplay, and a
 * focused canvas text field suspends every letter shortcut until the field releases focus.
 */
export function routeArmoryUiInput(sample: ArmoryUiInputSample): ArmoryUiInputRoute {
  const route = emptyArmoryUiRoute();
  if (sample.modalOpen || sample.textInputFocused) return route;
  const move: ArmoryUiMove = sample.leftPressed
    ? "left"
    : sample.rightPressed
      ? "right"
      : sample.upPressed
        ? "up"
        : sample.downPressed
          ? "down"
          : null;
  const contextDelta = Number(sample.nextContextPressed) - Number(sample.previousContextPressed);
  const pageDelta = Number(sample.nextPagePressed) - Number(sample.previousPagePressed);
  const digit = sample.digitPressed;
  return {
    ...route,
    move,
    primary: sample.enterPressed,
    contextDelta: contextDelta === 0 ? 0 : contextDelta < 0 ? -1 : 1,
    pageDelta:
      sample.context === "backpack" || pageDelta === 0 ? 0 : pageDelta < 0 ? -1 : 1,
    workflowDelta:
      sample.context !== "backpack" || pageDelta === 0 ? 0 : pageDelta < 0 ? -1 : 1,
    reset: sample.context === "wardrobe" && sample.resetPressed,
    preset:
      sample.context === "wardrobe" && digit !== null && digit >= 1 && digit <= 6 ? digit : null,
    activeSlot:
      sample.context !== "wardrobe" && digit !== null && digit >= 1 && digit <= 3 ? digit : null,
    close: sample.escapePressed || (sample.context === "backpack" && sample.closePressed),
  };
}
