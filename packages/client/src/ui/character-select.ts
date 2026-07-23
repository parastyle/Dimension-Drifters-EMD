import {
  characterName,
  DEFAULT_CHARACTER,
  isWholeArtCharacter,
  WHOLE_ART_CHARACTERS,
  type WholeArtCharacter,
} from "@dd/shared";

export const CHARACTER_SELECTION_STORAGE_KEY = "dd.character.selected.v1";

export interface CharacterSelectionState {
  readonly version: 1;
  readonly selectedCharacterId: WholeArtCharacter;
}

export interface CharacterSelectionOption {
  readonly id: WholeArtCharacter;
  readonly name: string;
  readonly selected: boolean;
}

export interface CharacterSelectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type CharacterSelectionKeyResult =
  | { readonly handled: false; readonly focusIndex: number; readonly activate: false }
  | { readonly handled: true; readonly focusIndex: number; readonly activate: boolean };

function defaultCharacterSelection(): CharacterSelectionState {
  return { version: 1, selectedCharacterId: DEFAULT_CHARACTER };
}

/** Accept only this model's current envelope; raw ids and prior envelopes are legacy, not migrations. */
export function sanitizeCharacterSelection(value: unknown): CharacterSelectionState {
  if (!value || typeof value !== "object") return defaultCharacterSelection();
  const source = value as { version?: unknown; selectedCharacterId?: unknown };
  if (source.version !== 1 || !isWholeArtCharacter(source.selectedCharacterId)) {
    return defaultCharacterSelection();
  }
  return { version: 1, selectedCharacterId: source.selectedCharacterId };
}

export function loadCharacterSelection(
  storage: CharacterSelectionStorage | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): CharacterSelectionState {
  if (!storage) return defaultCharacterSelection();
  try {
    const raw = storage.getItem(CHARACTER_SELECTION_STORAGE_KEY);
    return sanitizeCharacterSelection(raw ? JSON.parse(raw) : undefined);
  } catch {
    return defaultCharacterSelection();
  }
}

export function saveCharacterSelection(
  selectedCharacterId: unknown,
  storage: CharacterSelectionStorage | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): CharacterSelectionState {
  const state = sanitizeCharacterSelection({ version: 1, selectedCharacterId });
  try {
    storage?.setItem(CHARACTER_SELECTION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A blocked local preference must never block entering a run.
  }
  return state;
}

export function characterSelectionOptions(
  selectedCharacterId: unknown,
): CharacterSelectionOption[] {
  const selected = isWholeArtCharacter(selectedCharacterId)
    ? selectedCharacterId
    : DEFAULT_CHARACTER;
  return WHOLE_ART_CHARACTERS.map((id) => ({
    id,
    name: characterName(id),
    selected: id === selected,
  }));
}

/** Small keyboard model shared by the Phaser scene and deterministic behavior tests. */
export function routeCharacterSelectionKey(
  key: string,
  focusIndex: number,
  optionCount: number = WHOLE_ART_CHARACTERS.length,
): CharacterSelectionKeyResult {
  const last = Math.max(0, optionCount - 1);
  const current = Math.max(0, Math.min(last, Math.floor(focusIndex) || 0));
  if (optionCount <= 0) return { handled: false, focusIndex: 0, activate: false };
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return { handled: true, focusIndex: Math.max(0, current - 1), activate: false };
  }
  if (key === "ArrowRight" || key === "ArrowDown") {
    return { handled: true, focusIndex: Math.min(last, current + 1), activate: false };
  }
  if (key === "Home") return { handled: true, focusIndex: 0, activate: false };
  if (key === "End") return { handled: true, focusIndex: last, activate: false };
  if (key === "Enter" || key === " ") {
    return { handled: true, focusIndex: current, activate: true };
  }
  return { handled: false, focusIndex: current, activate: false };
}
