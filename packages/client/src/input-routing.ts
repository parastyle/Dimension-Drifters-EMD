export type WeaponInputMode = "arena" | "training" | "belt";

export interface WeaponInputSample {
  readonly mode: WeaponInputMode;
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
  const pageDelta = Number(sample.nextPagePressed) - Number(sample.previousPagePressed);
  const pickup = sample.alive && sample.pickupPromptVisible && sample.interactPressed;
  return {
    pickup,
    cycle: !pickup && sample.cyclePressed,
    galleryPage:
      !pickup && sample.mode === "training" && pageDelta !== 0 ? (pageDelta < 0 ? -1 : 1) : 0,
  };
}
