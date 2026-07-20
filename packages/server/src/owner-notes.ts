import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER_NOTE_MAX_CHARS = 2_000;
export const OWNER_NOTES_PATH = fileURLToPath(
  new URL("../../../data/owner-notes.jsonl", import.meta.url),
);

export interface OwnerNoteRecord {
  readonly ts: string;
  readonly session: string;
  readonly mode: "training";
  readonly type: "game" | "weapon";
  readonly weaponId?: string;
  readonly weaponName?: string;
  readonly note: string;
}

/** Bound CPU/storage work before cleaning control characters; preserve tabs and newlines for field notes. */
export function sanitizeOwnerNote(value: unknown): string {
  if (typeof value !== "string") return "";
  const bounded = value.slice(0, OWNER_NOTE_MAX_CHARS).replace(/\r\n?/g, "\n");
  let cleaned = "";
  for (const character of bounded) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 9 || codePoint === 10 || (codePoint >= 32 && codePoint !== 127)) {
      cleaned += character;
    }
  }
  return cleaned.trim();
}

export function ownerNotesPath(): string {
  const override = process.env.DD_OWNER_NOTES_PATH;
  return override ? resolve(override) : OWNER_NOTES_PATH;
}

/** One synchronous append keeps each accepted note one complete JSONL record and never truncates history. */
export function appendOwnerNote(record: OwnerNoteRecord, path = ownerNotesPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "a" });
}
