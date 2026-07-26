import { createMetaAccountV5, sanitizeMetaAccountV5 } from "@dd/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadOrCreatePetAccountId,
  MetaAccountStorageError,
  PET_ACCOUNT_ID_STORAGE_KEY,
  PET_META_STORAGE_KEY,
  savePetMetaAccount,
} from "./pet-select.js";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("authoritative account cache", () => {
  it("writes one complete account cache record and verifies it", () => {
    const account = createMetaAccountV5();
    account.scrip = 123;
    const canonical = sanitizeMetaAccountV5(account);
    expect(savePetMetaAccount(account)).toEqual(canonical);
    expect(JSON.parse(storage.values.get(PET_META_STORAGE_KEY) ?? "")).toEqual(canonical);
    expect(storage.values.has("dd.beltScrip")).toBe(false);
  });

  it("surfaces a blocked write instead of returning an advanced account", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const advanced = createMetaAccountV5();
    advanced.scrip = 999;
    expect(() => savePetMetaAccount(advanced)).toThrow(MetaAccountStorageError);
  });

  it("surfaces failed read-back verification", () => {
    vi.spyOn(storage, "getItem").mockReturnValue("different");
    expect(() => savePetMetaAccount(createMetaAccountV5())).toThrow(/Account cache verify failed/);
  });

  it("creates one stable account identity and surfaces identity storage failure", () => {
    const first = loadOrCreatePetAccountId();
    expect(first).toMatch(/^acct_[A-Za-z0-9_-]{16,80}$/);
    expect(storage.values.get(PET_ACCOUNT_ID_STORAGE_KEY)).toBe(first);
    expect(loadOrCreatePetAccountId()).toBe(first);

    storage.values.clear();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => loadOrCreatePetAccountId()).toThrow(MetaAccountStorageError);
  });
});
