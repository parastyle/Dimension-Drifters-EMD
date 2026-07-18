import type { GearId, GearSlot } from "@dd/shared";
import type Phaser from "phaser";
import {
  GEAR_BAKED_PART_IDS,
  type GearBakeDiagnostic,
  type GearBakedPartId,
  type GearBakeFrame,
  type GearBakeResolution,
  type GearBakeSourceDependency,
  type GearExtraAssembly,
  type GearPartBakeRecipe,
  type GearPartsManifest,
  type GearTextureState,
  type GearTextureStateResolver,
  resolveGearBakeLoadout,
} from "./gear-parts.js";

export const GEAR_TEXTURE_CACHE_BUDGET_BYTES = 48 * 1024 * 1024;

export interface GearTextureResource {
  readonly textureKey: string;
  readonly destroyed: boolean;
  destroy(): void;
}

export interface GearTextureBakeBackend {
  ensureSources(
    dependencies: readonly GearBakeSourceDependency[],
  ): Promise<ReadonlyMap<string, GearTextureState>>;
  createTexture(recipe: GearPartBakeRecipe): GearTextureResource | Promise<GearTextureResource>;
  destroy(): void;
}

export interface GearBakedPartHandle {
  readonly partId: GearBakedPartId;
  readonly textureKey: string;
  readonly frame: GearBakeFrame;
  readonly origin: { readonly x: number; readonly y: number };
}

export interface GearTextureBakeLease {
  readonly handles: Readonly<Record<GearBakedPartId, GearBakedPartHandle>>;
  readonly extras: GearExtraAssembly;
  readonly readiness: "ready" | "fallback";
  readonly diagnostics: readonly GearBakeDiagnostic[];
  readonly released: boolean;
  retain(): GearTextureBakeLease;
  release(): void;
}

export interface GearTextureBakeAcquireInput {
  readonly manifest: GearPartsManifest;
  readonly loadout: Readonly<Record<GearSlot, GearId>>;
  readonly prestige?: number;
  readonly towerComposition?: readonly GearId[];
}

export interface GearTextureBakeCacheStats {
  readonly entries: number;
  readonly activeEntries: number;
  readonly zeroRefEntries: number;
  readonly bytes: number;
  readonly budgetBytes: number;
  readonly pendingCreations: number;
  readonly destroyed: boolean;
}

interface GearTextureCacheEntry {
  readonly key: string;
  readonly resource: GearTextureResource;
  readonly handle: GearBakedPartHandle;
  readonly bytes: number;
  refCount: number;
  lastUsedEpoch: number;
}

interface PendingLoaderWait {
  finish(): void;
}

function uniqueDependencies(
  dependencies: readonly GearBakeSourceDependency[],
): GearBakeSourceDependency[] {
  return [
    ...new Map(dependencies.map((dependency) => [dependency.textureKey, dependency])).values(),
  ];
}

/** Phaser's RenderTexture is kept outside the display list and saved under the recipe key. */
export class PhaserGearTextureBakeBackend implements GearTextureBakeBackend {
  private readonly failedTextures = new Set<string>();
  private readonly waits = new Set<PendingLoaderWait>();
  private loadChain: Promise<ReadonlyMap<string, GearTextureState>> = Promise.resolve(new Map());
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  ensureSources(
    dependencies: readonly GearBakeSourceDependency[],
  ): Promise<ReadonlyMap<string, GearTextureState>> {
    const unique = uniqueDependencies(dependencies);
    const run = this.loadChain.then(() => this.loadBatch(unique));
    this.loadChain = run.catch(() => this.statesFor(unique));
    return run;
  }

  private statesFor(
    dependencies: readonly GearBakeSourceDependency[],
  ): ReadonlyMap<string, GearTextureState> {
    const states = new Map<string, GearTextureState>();
    for (const dependency of dependencies) {
      const state = this.scene.textures.exists(dependency.textureKey)
        ? "ready"
        : dependency.textureUrl === null || this.failedTextures.has(dependency.textureKey)
          ? "missing"
          : "pending";
      states.set(dependency.textureKey, state);
    }
    return states;
  }

  private async loadBatch(
    dependencies: readonly GearBakeSourceDependency[],
  ): Promise<ReadonlyMap<string, GearTextureState>> {
    if (this.destroyed) return this.statesFor(dependencies);
    if (this.scene.load.isLoading()) await this.waitForLoader();
    if (this.destroyed) return this.statesFor(dependencies);

    const queued = dependencies.filter(
      (dependency) =>
        dependency.textureUrl !== null &&
        !this.failedTextures.has(dependency.textureKey) &&
        !this.scene.textures.exists(dependency.textureKey),
    );
    if (queued.length === 0) return this.statesFor(dependencies);

    const queuedKeys = new Set(queued.map((dependency) => dependency.textureKey));
    for (const dependency of queued)
      this.scene.load.image(dependency.textureKey, dependency.textureUrl as string);
    await this.waitForLoader(queuedKeys);
    for (const key of queuedKeys)
      if (!this.scene.textures.exists(key)) this.failedTextures.add(key);
    return this.statesFor(dependencies);
  }

  private waitForLoader(queuedKeys?: ReadonlySet<string>): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const onError = (file: Phaser.Loader.File): void => {
        const key = String(file.key);
        if (!queuedKeys || queuedKeys.has(key)) this.failedTextures.add(key);
      };
      const finish = (): void => {
        if (settled) return;
        settled = true;
        this.scene.load.off("loaderror", onError);
        this.scene.load.off("complete", finish);
        this.waits.delete(wait);
        resolve();
      };
      const wait = { finish };
      this.waits.add(wait);
      this.scene.load.on("loaderror", onError);
      this.scene.load.once("complete", finish);
      if (!this.scene.load.isLoading()) this.scene.load.start();
    });
  }

  createTexture(recipe: GearPartBakeRecipe): GearTextureResource {
    if (this.destroyed) throw new Error("Gear texture backend has shut down");
    for (const layer of recipe.layers)
      if (!this.scene.textures.exists(layer.textureKey))
        throw new Error(`Gear bake source "${layer.textureKey}" is unresolved`);

    const renderTexture = this.scene.make.renderTexture(
      {
        x: 0,
        y: 0,
        width: recipe.frame.width,
        height: recipe.frame.height,
      },
      false,
    );
    renderTexture.clear();
    for (const layer of recipe.layers)
      renderTexture.stamp(layer.textureKey, undefined, -recipe.frame.left, -recipe.frame.top, {
        originX: 0,
        originY: 0,
      });
    renderTexture.render();
    renderTexture.saveTexture(recipe.key);

    let resourceDestroyed = false;
    return {
      textureKey: recipe.key,
      get destroyed() {
        return resourceDestroyed;
      },
      destroy: () => {
        if (resourceDestroyed) return;
        resourceDestroyed = true;
        if (this.scene.textures.exists(recipe.key)) this.scene.textures.remove(recipe.key);
        renderTexture.destroy();
      },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const wait of [...this.waits]) wait.finish();
    this.waits.clear();
    this.failedTextures.clear();
  }
}

class GearTextureBakeLeaseImpl implements GearTextureBakeLease {
  released = false;

  constructor(
    private readonly owner: GearTextureBakeCache,
    readonly entries: readonly GearTextureCacheEntry[],
    readonly handles: Readonly<Record<GearBakedPartId, GearBakedPartHandle>>,
    readonly extras: GearExtraAssembly,
    readonly readiness: "ready" | "fallback",
    readonly diagnostics: readonly GearBakeDiagnostic[],
  ) {}

  retain(): GearTextureBakeLease {
    if (this.released) throw new Error("Cannot retain a released gear texture lease");
    return this.owner.retainLease(this);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.owner.releaseLease(this);
  }

  invalidate(): void {
    this.released = true;
  }
}

export class GearTextureBakeCache {
  private readonly entries = new Map<string, GearTextureCacheEntry>();
  private readonly pendingCreations = new Map<string, Promise<GearTextureCacheEntry>>();
  private readonly leases = new Set<GearTextureBakeLeaseImpl>();
  private readonly reportedDiagnostics = new Set<string>();
  private epoch = 0;
  private totalBytes = 0;
  private overBudgetReported = false;
  private destroyed = false;

  constructor(
    readonly scene: Phaser.Scene,
    private readonly backend: GearTextureBakeBackend = new PhaserGearTextureBakeBackend(scene),
    readonly budgetBytes = GEAR_TEXTURE_CACHE_BUDGET_BYTES,
  ) {}

  get stats(): GearTextureBakeCacheStats {
    let activeEntries = 0;
    for (const entry of this.entries.values()) if (entry.refCount > 0) activeEntries++;
    return {
      entries: this.entries.size,
      activeEntries,
      zeroRefEntries: this.entries.size - activeEntries,
      bytes: this.totalBytes,
      budgetBytes: this.budgetBytes,
      pendingCreations: this.pendingCreations.size,
      destroyed: this.destroyed,
    };
  }

  async acquire(input: GearTextureBakeAcquireInput): Promise<GearTextureBakeLease> {
    if (this.destroyed) throw new Error("Gear texture cache has shut down");
    const initial = resolveGearBakeLoadout(
      input.manifest,
      input.loadout,
      input.prestige,
      input.towerComposition,
    );
    const states = await this.backend.ensureSources(initial.dependencies);
    if (this.destroyed) throw new Error("Gear texture cache has shut down");
    const resolveState: GearTextureStateResolver = (dependency) =>
      states.get(dependency.textureKey) ?? "missing";
    const settled = resolveGearBakeLoadout(
      input.manifest,
      input.loadout,
      input.prestige,
      input.towerComposition,
      resolveState,
    );
    return this.acquireSettled(settled);
  }

  async acquireForGeneration(
    input: GearTextureBakeAcquireInput,
    generation: number,
    isCurrent: (generation: number) => boolean,
  ): Promise<GearTextureBakeLease | null> {
    const lease = await this.acquire(input);
    if (this.destroyed || !isCurrent(generation)) {
      lease.release();
      return null;
    }
    return lease;
  }

  private async acquireSettled(settled: GearBakeResolution): Promise<GearTextureBakeLease> {
    const acquired: GearTextureCacheEntry[] = [];
    const handles = {} as Record<GearBakedPartId, GearBakedPartHandle>;
    try {
      for (const partId of GEAR_BAKED_PART_IDS) {
        const recipe = settled.recipe.parts[partId];
        if (recipe.layers.length === 0 || recipe.layers.some((layer) => layer.state !== "ready")) {
          throw new Error(`No visible settled source for baked gear part "${partId}"`);
        }
        const entry = await this.getOrCreate(recipe);
        if (this.destroyed || entry.resource.destroyed)
          throw new Error("Gear texture cache shut down during a bake");
        entry.refCount++;
        entry.lastUsedEpoch = ++this.epoch;
        acquired.push(entry);
        handles[partId] = entry.handle;
        this.evictToBudget();
      }
    } catch (error) {
      for (const entry of acquired) {
        entry.refCount = Math.max(0, entry.refCount - 1);
        entry.lastUsedEpoch = ++this.epoch;
      }
      this.evictToBudget();
      throw error;
    }

    for (const diagnostic of settled.recipe.diagnostics) this.reportDiagnostic(diagnostic);
    const lease = new GearTextureBakeLeaseImpl(
      this,
      acquired,
      handles,
      settled.extras,
      settled.recipe.readiness === "fallback" ? "fallback" : "ready",
      settled.recipe.diagnostics,
    );
    this.leases.add(lease);
    return lease;
  }

  private async getOrCreate(recipe: GearPartBakeRecipe): Promise<GearTextureCacheEntry> {
    const cached = this.entries.get(recipe.key);
    if (cached && !cached.resource.destroyed) return cached;
    const pending = this.pendingCreations.get(recipe.key);
    if (pending) return pending;
    const creation = Promise.resolve(this.backend.createTexture(recipe)).then((resource) => {
      if (this.destroyed) {
        resource.destroy();
        throw new Error("Gear texture cache shut down during a bake");
      }
      const handle: GearBakedPartHandle = Object.freeze({
        partId: recipe.partId,
        textureKey: resource.textureKey,
        frame: recipe.frame,
        origin: recipe.frame.origin,
      });
      const entry: GearTextureCacheEntry = {
        key: recipe.key,
        resource,
        handle,
        bytes: recipe.frame.width * recipe.frame.height * 4,
        refCount: 0,
        lastUsedEpoch: ++this.epoch,
      };
      this.entries.set(entry.key, entry);
      this.totalBytes += entry.bytes;
      return entry;
    });
    this.pendingCreations.set(recipe.key, creation);
    try {
      return await creation;
    } finally {
      if (this.pendingCreations.get(recipe.key) === creation)
        this.pendingCreations.delete(recipe.key);
    }
  }

  retainLease(source: GearTextureBakeLeaseImpl): GearTextureBakeLease {
    if (this.destroyed) throw new Error("Gear texture cache has shut down");
    for (const entry of source.entries) {
      if (entry.resource.destroyed || this.entries.get(entry.key) !== entry)
        throw new Error("Cannot retain an evicted gear texture");
      entry.refCount++;
      entry.lastUsedEpoch = ++this.epoch;
    }
    const lease = new GearTextureBakeLeaseImpl(
      this,
      source.entries,
      source.handles,
      source.extras,
      source.readiness,
      source.diagnostics,
    );
    this.leases.add(lease);
    return lease;
  }

  releaseLease(lease: GearTextureBakeLeaseImpl): void {
    if (!this.leases.delete(lease) || this.destroyed) return;
    for (const entry of lease.entries) {
      entry.refCount = Math.max(0, entry.refCount - 1);
      entry.lastUsedEpoch = ++this.epoch;
    }
    this.evictToBudget();
  }

  private evictToBudget(): void {
    while (this.totalBytes > this.budgetBytes) {
      let oldest: GearTextureCacheEntry | undefined;
      for (const entry of this.entries.values()) {
        if (entry.refCount > 0) continue;
        if (!oldest || entry.lastUsedEpoch < oldest.lastUsedEpoch) oldest = entry;
      }
      if (!oldest) {
        if (!this.overBudgetReported) {
          this.overBudgetReported = true;
          console.warn(
            `[gear-bake] active texture leases exceed ${this.budgetBytes} bytes; deferring eviction`,
          );
        }
        return;
      }
      this.entries.delete(oldest.key);
      this.totalBytes -= oldest.bytes;
      oldest.resource.destroy();
    }
  }

  private reportDiagnostic(diagnostic: GearBakeDiagnostic): void {
    const key = `${diagnostic.partId}:${diagnostic.textureKey}`;
    if (this.reportedDiagnostics.has(key)) return;
    this.reportedDiagnostics.add(key);
    console.warn(diagnostic.message);
  }

  shutdown(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const lease of this.leases) lease.invalidate();
    this.leases.clear();
    for (const entry of this.entries.values()) entry.resource.destroy();
    this.entries.clear();
    this.pendingCreations.clear();
    this.totalBytes = 0;
    this.reportedDiagnostics.clear();
    this.backend.destroy();
  }
}

const sceneCaches = new WeakMap<Phaser.Scene, GearTextureBakeCache>();

export function gearTextureBakeCacheForScene(
  scene: Phaser.Scene,
  backend?: GearTextureBakeBackend,
  budgetBytes = GEAR_TEXTURE_CACHE_BUDGET_BYTES,
): GearTextureBakeCache {
  const current = sceneCaches.get(scene);
  if (current && !current.stats.destroyed) return current;
  const cache = new GearTextureBakeCache(scene, backend, budgetBytes);
  sceneCaches.set(scene, cache);
  scene.events?.once("shutdown", () => {
    cache.shutdown();
    if (sceneCaches.get(scene) === cache) sceneCaches.delete(scene);
  });
  return cache;
}
