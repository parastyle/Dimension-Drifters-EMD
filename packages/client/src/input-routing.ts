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
