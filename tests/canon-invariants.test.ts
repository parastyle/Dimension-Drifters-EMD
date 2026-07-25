import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PlayerState, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

const ROOM_SOURCE = fileURLToPath(new URL("../packages/server/src/rooms/", import.meta.url));

function runtimeTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return runtimeTypeScriptFiles(absolute);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [absolute] : [];
  });
}

describe("lean-canon anti-rot invariants", () => {
  it("does not restore numeric player stat, level, or XP progression state", () => {
    const player = new PlayerState() as unknown as Record<string, unknown>;
    const retiredFields = [
      "level",
      "xp",
      "xpToNext",
      "str",
      "dex",
      "int",
      "con",
      "luk",
      "pendingLevelChoices",
    ];
    for (const field of retiredFields) {
      expect(player, `PlayerState must not restore retired field "${field}"`).not.toHaveProperty(
        field,
      );
    }
  });

  it("keeps every weapon free of scalingGrades and requirements at every nesting level", () => {
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      const serialized = JSON.stringify(weapon);
      expect(serialized, `${id} restored deleted stat-coupled weapon data`).not.toMatch(
        /"(?:scalingGrades|requirements)"\s*:/,
      );
    }
  });

  it("does not restore a shopkeeper room surface or message", () => {
    for (const file of runtimeTypeScriptFiles(ROOM_SOURCE)) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} restored the deleted shopkeeper flow`).not.toMatch(
        /\b(?:shopkeeper|shopNpc|openShop)\b/i,
      );
    }
  });
});
