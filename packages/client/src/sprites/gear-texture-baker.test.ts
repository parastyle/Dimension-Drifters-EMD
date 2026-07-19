import { type GearId, type GearSlot, isGearId, STARTER_GEAR_LOADOUT } from "@dd/shared";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { replacementPairManifest } from "./gear-pairs.test-fixture.js";
import type {
  GearBakeSourceDependency,
  GearPartBakeRecipe,
  GearTextureState,
} from "./gear-parts.js";
import {
  GEAR_TEXTURE_CACHE_BUDGET_BYTES,
  type GearTextureBakeBackend,
  GearTextureBakeCache,
  type GearTextureResource,
  gearTextureBakeCacheForScene,
} from "./gear-texture-baker.js";

interface FakeResource extends GearTextureResource {
  destroyed: boolean;
}

class FakeBakeBackend implements GearTextureBakeBackend {
  readonly createCalls: Array<{ key: string; roles: string[] }> = [];
  readonly resources: FakeResource[] = [];
  readonly stateCalls: GearBakeSourceDependency[][] = [];
  destroyed = false;
  private gate?: Promise<void>;
  private openGate?: () => void;

  constructor(
    private readonly missing: (dependency: GearBakeSourceDependency) => boolean = () => false,
  ) {}

  delaySources(): void {
    this.gate = new Promise((resolve) => {
      this.openGate = resolve;
    });
  }

  settleSources(): void {
    this.openGate?.();
    this.openGate = undefined;
    this.gate = undefined;
  }

  async ensureSources(
    dependencies: readonly GearBakeSourceDependency[],
  ): Promise<ReadonlyMap<string, GearTextureState>> {
    this.stateCalls.push([...dependencies]);
    await this.gate;
    return new Map(
      dependencies.map((dependency) => [
        dependency.textureKey,
        dependency.textureUrl === null || this.missing(dependency) ? "missing" : "ready",
      ]),
    );
  }

  createTexture(recipe: GearPartBakeRecipe): GearTextureResource {
    this.createCalls.push({ key: recipe.key, roles: recipe.layers.map((layer) => layer.role) });
    const resource: FakeResource = {
      textureKey: recipe.key,
      destroyed: false,
      destroy() {
        resource.destroyed = true;
      },
    };
    this.resources.push(resource);
    return resource;
  }

  destroy(): void {
    this.destroyed = true;
    this.settleSources();
  }
}

function fakeScene(): Phaser.Scene {
  return {} as Phaser.Scene;
}

const mixedLoadout = {
  hat: "coldsnap-hat",
  glasses: "pressurized-glasses",
  facialHair: "pressurized-facial-hair",
  head: "pressurized-head",
  torso: "pressurized-shirt",
  gloves: "house-edge-gloves",
  boots: "house-edge-boots",
  cloak: "thornwatch-cloak",
} as Record<GearSlot, GearId>;

describe("GearTextureBakeCache part recipes", () => {
  it("reuses unaffected part keys and never keys on prestige, facing, player, or locality", async () => {
    const manifest = replacementPairManifest("cache-test-r1");
    const backend = new FakeBakeBackend();
    const cache = new GearTextureBakeCache(fakeScene(), backend);
    const first = await cache.acquire({
      manifest,
      loadout: mixedLoadout,
      prestige: 0,
    });
    const second = await cache.acquire({
      manifest,
      loadout: { ...mixedLoadout, boots: "pressurized-boots" as GearId },
      prestige: 30,
    });

    expect(second.handles.body.textureKey).toBe(first.handles.body.textureKey);
    expect(second.handles.head.textureKey).toBe(first.handles.head.textureKey);
    expect(second.handles["hand-l"].textureKey).toBe(first.handles["hand-l"].textureKey);
    expect(second.handles["foot-l"].textureKey).not.toBe(first.handles["foot-l"].textureKey);
    expect(second.handles["foot-r"].textureKey).not.toBe(first.handles["foot-r"].textureKey);
    for (const handle of Object.values(second.handles)) {
      expect(handle.textureKey).not.toMatch(/prestige|facing|mirror|player|remote|local/i);
      expect(handle.textureKey).not.toContain("30");
    }
    expect(
      backend.createCalls.find((call) => call.key === first.handles.body.textureKey)?.roles,
    ).toEqual(["replacement-torso"]);
    expect(
      backend.createCalls.find((call) => call.key === first.handles.head.textureKey)?.roles,
    ).toEqual(["replacement-head", "facialHair", "glasses"]);
    first.release();
    second.release();
  });

  it("settles missing nonblank art to six live base handles and named diagnostics", async () => {
    const manifest = replacementPairManifest("cache-test-r1");
    const backend = new FakeBakeBackend((dependency) => dependency.gearId !== null);
    const cache = new GearTextureBakeCache(fakeScene(), backend);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const lease = await cache.acquire({ manifest, loadout: mixedLoadout, prestige: 30 });

    expect(lease.readiness).toBe("fallback");
    expect(Object.values(lease.handles)).toHaveLength(6);
    expect(Object.values(lease.handles).every((handle) => handle.textureKey.length > 0)).toBe(true);
    expect(backend.createCalls.map((call) => call.roles)).toEqual([
      ["base"],
      ["base"],
      ["base"],
      ["base"],
      ["base"],
      ["base"],
    ]);
    expect(lease.extras.parts).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[gear-bake] missing replacement art"),
    );
    lease.release();
    cache.shutdown();
    warn.mockRestore();
  });
});

describe("GearTextureBakeCache budget and leases", () => {
  it("evicts oldest zero-ref recipes under the 48 MiB budget during high-diversity churn", async () => {
    const manifest = replacementPairManifest("cache-test-r1");
    const backend = new FakeBakeBackend();
    const cache = new GearTextureBakeCache(fakeScene(), backend);
    const headIds =
      manifest.slots
        .find((slot) => slot.id === "head")
        ?.items.map((item) => item.id)
        .filter(isGearId) ?? [];
    const glassesIds =
      manifest.slots
        .find((slot) => slot.id === "glasses")
        ?.items.map((item) => item.id)
        .filter(isGearId) ?? [];
    for (const head of headIds) {
      for (const glasses of glassesIds) {
        const lease = await cache.acquire({
          manifest,
          loadout: { ...STARTER_GEAR_LOADOUT, head, glasses },
        });
        lease.release();
      }
    }

    expect(cache.stats.budgetBytes).toBe(GEAR_TEXTURE_CACHE_BUDGET_BYTES);
    expect(cache.stats.bytes).toBeLessThanOrEqual(GEAR_TEXTURE_CACHE_BUDGET_BYTES);
    expect(backend.resources.some((resource) => resource.destroyed)).toBe(true);
    expect(cache.stats.activeEntries).toBe(0);
  });

  it("protects active entries and a secondary decoy lease until the final release", async () => {
    const backend = new FakeBakeBackend();
    const cache = new GearTextureBakeCache(fakeScene(), backend, 1);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const primary = await cache.acquire({
      manifest: replacementPairManifest("cache-test-r1"),
      loadout: STARTER_GEAR_LOADOUT,
    });
    const secondary = primary.retain();

    expect(cache.stats.activeEntries).toBe(6);
    expect(cache.stats.bytes).toBeGreaterThan(cache.stats.budgetBytes);
    primary.release();
    expect(cache.stats.activeEntries).toBe(6);
    expect(backend.resources.every((resource) => !resource.destroyed)).toBe(true);
    secondary.release();
    expect(cache.stats).toMatchObject({ entries: 0, activeEntries: 0, bytes: 0 });
    expect(backend.resources.every((resource) => resource.destroyed)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("destroys every cached texture and invalidates leases on scene shutdown", async () => {
    let shutdown: (() => void) | undefined;
    const scene = {
      events: {
        once: (event: string, callback: () => void) => {
          if (event === "shutdown") shutdown = callback;
        },
      },
    } as unknown as Phaser.Scene;
    const backend = new FakeBakeBackend();
    const cache = gearTextureBakeCacheForScene(scene, backend);
    const lease = await cache.acquire({
      manifest: replacementPairManifest("cache-test-r1"),
      loadout: STARTER_GEAR_LOADOUT,
    });
    shutdown?.();

    expect(lease.released).toBe(true);
    expect(cache.stats).toMatchObject({ entries: 0, bytes: 0, destroyed: true });
    expect(backend.resources.every((resource) => resource.destroyed)).toBe(true);
    expect(backend.destroyed).toBe(true);
  });

  it("releases a stale async generation without exposing destroyed texture handles", async () => {
    const backend = new FakeBakeBackend();
    backend.delaySources();
    const cache = new GearTextureBakeCache(fakeScene(), backend, 0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let currentGeneration = 1;
    const pending = cache.acquireForGeneration(
      { manifest: replacementPairManifest("cache-test-r1"), loadout: mixedLoadout },
      1,
      (generation) => generation === currentGeneration,
    );
    currentGeneration = 2;
    backend.settleSources();

    expect(await pending).toBeNull();
    expect(cache.stats).toMatchObject({ entries: 0, activeEntries: 0, bytes: 0 });
    expect(backend.resources.every((resource) => resource.destroyed)).toBe(true);
    warn.mockRestore();
  });
});
