import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type SettingsStorage,
  SettingsStore,
} from "./settings.js";

class MemoryStorage implements SettingsStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("SettingsStore", () => {
  it("loads defaults and round-trips the enumerated feedback settings", () => {
    const storage = new MemoryStorage();
    const first = new SettingsStore(storage);
    expect(first.load()).toEqual(DEFAULT_SETTINGS);
    first.update({
      feedback: {
        damageNumbers: "own",
        damageNumberStyle: "aggregate",
        damageNumberScale: 1.4,
        hitConfirmAudio: false,
        flashes: "reduced",
      },
    });

    const second = new SettingsStore(storage);
    expect(second.load().feedback).toMatchObject({
      damageNumbers: "own",
      damageNumberStyle: "aggregate",
      damageNumberScale: 1.4,
      hitConfirmAudio: false,
      flashes: "reduced",
    });
  });

  it("falls back safely on corrupt or invalid-version JSON", () => {
    const storage = new MemoryStorage();
    storage.values.set(SETTINGS_STORAGE_KEY, "{not json");
    expect(new SettingsStore(storage).load()).toEqual(DEFAULT_SETTINGS);
    storage.values.set(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 9, feedback: {} }));
    expect(new SettingsStore(storage).load()).toEqual(DEFAULT_SETTINGS);
  });

  it("preserves unknown fields when known settings are updated", () => {
    const storage = new MemoryStorage();
    storage.values.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        futureRoot: { enabled: true },
        feedback: { futureToggle: "keep-me", damageNumbers: "all" },
      }),
    );
    const store = new SettingsStore(storage);
    store.update({ feedback: { damageNumbers: "off" } });
    const persisted = JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(persisted.futureRoot).toEqual({ enabled: true });
    expect(persisted.feedback).toMatchObject({ futureToggle: "keep-me", damageNumbers: "off" });
  });

  it("notifies subscribers and remains usable when storage throws", () => {
    const throwing: SettingsStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const store = new SettingsStore(throwing);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.update({ feedback: { hitStop: false } }).feedback.hitStop).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.update({ feedback: { hitStop: true } });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("confirm-volume settings", () => {
  it("persists the dedicated confirm gain in the single v1 blob and clamps its mix range", () => {
    const storage = new MemoryStorage();
    const store = new SettingsStore(storage);
    expect(store.update({ feedback: { confirmVolume: 1.3 } }).feedback.confirmVolume).toBe(1.3);
    const serialized = JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY) ?? "{}") as {
      feedback?: { confirmVolume?: number };
    };
    expect(serialized.feedback?.confirmVolume).toBe(1.3);
    expect(store.update({ feedback: { confirmVolume: 9 } }).feedback.confirmVolume).toBe(1.5);
  });
});
