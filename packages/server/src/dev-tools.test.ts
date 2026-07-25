import { describe, expect, it } from "vitest";
import { serverDevToolsEnabled } from "./dev-tools.js";

describe("server debug authority", () => {
  it("is disabled for absent, misspelled, and NODE_ENV-only configuration", () => {
    expect(serverDevToolsEnabled({})).toBe(false);
    expect(serverDevToolsEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(serverDevToolsEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(serverDevToolsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(serverDevToolsEnabled({ DD_DEV_TOOLS: "true" })).toBe(false);
    expect(serverDevToolsEnabled({ DD_DEV_TOOLS: "01" })).toBe(false);
  });

  it("requires the exact positive capability regardless of NODE_ENV", () => {
    expect(serverDevToolsEnabled({ DD_DEV_TOOLS: "1" })).toBe(true);
    expect(serverDevToolsEnabled({ DD_DEV_TOOLS: "1", NODE_ENV: "production" })).toBe(true);
  });
});
