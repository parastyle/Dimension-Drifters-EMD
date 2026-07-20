import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "..");

describe("Weaponsmith combined-preview actors", () => {
  it("references actor images that exist under the /art mount", () => {
    const source = readFileSync(
      path.join(repo, "tools", "weaponsmith", "public", "app.js"),
      "utf8",
    );
    const match = source.match(/engine\.setActors\("([^"]+)", "([^"]+)"\)/);

    expect(match, "Weaponsmith should configure both combined-preview actors").not.toBeNull();
    for (const url of match?.slice(1) ?? []) {
      expect(url.startsWith("/art/"), url).toBe(true);
      const [, , subject, file] = url.split("/");
      expect(
        existsSync(path.join(repo, "tools", "artkit", "out", subject ?? "", "sheets", file ?? "")),
        `${url} should resolve through the Weaponsmith /art mount`,
      ).toBe(true);
    }
  });
});
