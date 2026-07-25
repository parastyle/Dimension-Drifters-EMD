import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "..");

describe("Weaponsmith combined-preview actors", () => {
  it("references tracked actor images served by the character-sprite mount", () => {
    const source = readFileSync(
      path.join(repo, "tools", "weaponsmith", "public", "app.js"),
      "utf8",
    );
    const match = source.match(/engine\.setActors\(\s*"([^"]+)",\s*"([^"]+)",?\s*\)/);

    expect(match, "Weaponsmith should configure both combined-preview actors").not.toBeNull();
    for (const url of match?.slice(1) ?? []) {
      expect(url.startsWith("/character-sprite/"), url).toBe(true);
      const [, , subject, file] = url.split("/");
      expect(
        existsSync(
          path.join(repo, "packages", "client", "public", "sprites", subject ?? "", file ?? ""),
        ),
        `${url} should resolve through the Weaponsmith character-sprite mount`,
      ).toBe(true);
    }
  });
});
