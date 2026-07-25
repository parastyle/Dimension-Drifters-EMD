import { describe, expect, it } from "vitest";
import { clientDevToolsEnabled } from "./dev-tools.js";

describe("client debug query authority", () => {
  it("is fail-closed unless the exact build capability is present", () => {
    expect(clientDevToolsEnabled({})).toBe(false);
    expect(clientDevToolsEnabled({ VITE_DD_DEV_TOOLS: "true" })).toBe(false);
    expect(clientDevToolsEnabled({ VITE_DD_DEV_TOOLS: "0" })).toBe(false);
    expect(clientDevToolsEnabled({ VITE_DD_DEV_TOOLS: "1" })).toBe(true);
  });
});
