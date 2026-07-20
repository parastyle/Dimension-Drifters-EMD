import { GEAR_SLOTS, type GearId, type GearSlot, STARTER_GEAR_LOADOUT } from "@dd/shared";
import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import {
  replacementPairManifest,
  replacementPairManifestInput,
} from "../../sprites/gear-pairs.test-fixture.js";
import {
  assembleBoilerplate,
  GEAR_BAKE_FRAMES,
  GEAR_BAKED_PART_IDS,
  type GearBakedPartId,
  type GearBakeResolution,
  type GearPartsManifest,
  type GearTextureStateResolver,
  resolveGearBakeLoadout,
  validateGearPartsManifest,
} from "../../sprites/gear-parts.js";
import type {
  GearBakedPartHandle,
  GearTextureBakeAcquireInput,
  GearTextureBakeLease,
} from "../../sprites/gear-texture-baker.js";
import {
  WardrobeCharacterPreview,
  type WardrobePreviewBakeCache,
  wardrobeFixedPartBounds,
} from "./preview.js";

const rawManifest = replacementPairManifestInput("wardrobe-preview-test-r1");

class FakeDisplayObject {
  active = true;
  visible = true;
  x: number;
  y: number;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  originX = 0.5;
  originY = 0.5;
  color = "";
  text = "";
  parentContainer?: FakeContainer;
  texture: { key: string };
  frame: { name: string };

  constructor(x = 0, y = 0, key = "shape", frame = "__BASE", text = "") {
    this.x = x;
    this.y = y;
    this.texture = { key };
    this.frame = { name: frame };
    this.text = text;
  }

  setOrigin(x: number, y = x): this {
    this.originX = x;
    this.originY = y;
    return this;
  }

  setScale(x: number, y = x): this {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setRotation(rotation: number): this {
    this.rotation = rotation;
    return this;
  }

  setTexture(key: string, frame = "__BASE"): this {
    this.texture.key = key;
    this.frame.name = frame;
    return this;
  }

  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  setText(text: string): this {
    this.text = text;
    return this;
  }

  setColor(color: string): this {
    this.color = color;
    return this;
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    const parent = this.parentContainer;
    if (parent) parent.list = parent.list.filter((entry) => entry !== this);
    this.parentContainer = undefined;
  }
}

class FakeContainer extends FakeDisplayObject {
  list: FakeDisplayObject[] = [];

  constructor(x: number, y: number, children: FakeDisplayObject[] = []) {
    super(x, y, "container");
    this.add(children);
  }

  add(children: FakeDisplayObject | FakeDisplayObject[]): this {
    for (const child of Array.isArray(children) ? children : [children]) {
      if (!this.list.includes(child)) this.list.push(child);
      child.parentContainer = this;
    }
    return this;
  }

  removeAll(destroyChildren = false): this {
    const children = [...this.list];
    this.list = [];
    for (const child of children) {
      child.parentContainer = undefined;
      if (destroyChildren) child.destroy();
    }
    return this;
  }
}

class FakeEvents {
  private readonly listeners = new Map<string, Array<() => void>>();

  once(event: string, callback: () => void): void {
    const callbacks = this.listeners.get(event) ?? [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }

  emit(event: string): void {
    const callbacks = this.listeners.get(event) ?? [];
    this.listeners.delete(event);
    for (const callback of callbacks) callback();
  }
}

interface FakeSceneTruth {
  scene: Phaser.Scene;
  images: FakeDisplayObject[];
  texts: FakeDisplayObject[];
  events: FakeEvents;
}

function fakeScene(): FakeSceneTruth {
  const images: FakeDisplayObject[] = [];
  const texts: FakeDisplayObject[] = [];
  const events = new FakeEvents();
  const retainedFrames = new Map<
    string,
    Map<string, { cutX: number; cutY: number; cutWidth: number; cutHeight: number }>
  >();
  const scene = {
    add: {
      image: (x: number, y: number, key: string, frame?: string) => {
        const image = new FakeDisplayObject(x, y, key, frame);
        images.push(image);
        return image;
      },
      ellipse: (x: number, y: number) => new FakeDisplayObject(x, y),
      text: (x: number, y: number, text: string) => {
        const label = new FakeDisplayObject(x, y, "text", "__BASE", text);
        texts.push(label);
        return label;
      },
      container: (x: number, y: number, children: FakeDisplayObject[] = []) =>
        new FakeContainer(x, y, children),
    },
    textures: {
      exists: (_key: string) => true,
      get: (key: string) => ({
        source: [{ width: 1024, height: 1024 }],
        has: (frame: string) => retainedFrames.get(key)?.has(frame) === true,
        add: (
          frame: string,
          _sourceIndex: number,
          cutX: number,
          cutY: number,
          cutWidth: number,
          cutHeight: number,
        ) => {
          const frames = retainedFrames.get(key) ?? new Map();
          frames.set(frame, { cutX, cutY, cutWidth, cutHeight });
          retainedFrames.set(key, frames);
          return true;
        },
        get: (frame: string) => retainedFrames.get(key)?.get(frame),
      }),
    },
    events,
  };
  return { scene: scene as unknown as Phaser.Scene, images, texts, events };
}

interface FakeLease extends GearTextureBakeLease {
  released: boolean;
  readonly resolution: GearBakeResolution;
}

function fakeLease(resolution: GearBakeResolution): FakeLease {
  const handles = Object.fromEntries(
    GEAR_BAKED_PART_IDS.map((partId) => {
      const recipe = resolution.recipe.parts[partId];
      return [
        partId,
        {
          partId,
          textureKey: recipe.key,
          frame: recipe.frame,
          origin: recipe.frame.origin,
        } satisfies GearBakedPartHandle,
      ];
    }),
  ) as unknown as GearTextureBakeLease["handles"];
  const lease: FakeLease = {
    handles,
    extras: resolution.extras,
    readiness: resolution.recipe.readiness === "fallback" ? "fallback" : "ready",
    diagnostics: resolution.recipe.diagnostics,
    released: false,
    resolution,
    retain: () => fakeLease(resolution),
    release: () => {
      lease.released = true;
    },
  };
  return lease;
}

interface FakeBakeCall {
  input: GearTextureBakeAcquireInput;
  generation: number;
  resolution: GearBakeResolution;
  lease: FakeLease;
}

class FakeSharedBaker implements WardrobePreviewBakeCache {
  readonly calls: FakeBakeCall[] = [];

  constructor(private readonly resolveState?: GearTextureStateResolver) {}

  async acquireForGeneration(
    input: GearTextureBakeAcquireInput,
    generation: number,
    _isCurrent: (generation: number) => boolean,
  ): Promise<GearTextureBakeLease> {
    const resolution = resolveGearBakeLoadout(
      input.manifest,
      input.loadout,
      input.prestige,
      input.towerComposition,
      this.resolveState,
    );
    const lease = fakeLease(resolution);
    this.calls.push({ input, generation, resolution, lease });
    return lease;
  }
}

interface DeferredCall {
  input: GearTextureBakeAcquireInput;
  generation: number;
  resolve(lease: FakeLease): void;
}

class DeferredSharedBaker implements WardrobePreviewBakeCache {
  readonly calls: DeferredCall[] = [];

  acquireForGeneration(
    input: GearTextureBakeAcquireInput,
    generation: number,
    _isCurrent: (generation: number) => boolean,
  ): Promise<GearTextureBakeLease> {
    return new Promise((resolve) => {
      this.calls.push({ input, generation, resolve });
    });
  }

  settle(index: number): FakeLease {
    const call = this.calls[index];
    if (!call) throw new Error(`missing deferred bake call ${index}`);
    const lease = fakeLease(
      resolveGearBakeLoadout(
        call.input.manifest,
        call.input.loadout,
        call.input.prestige,
        call.input.towerComposition,
      ),
    );
    call.resolve(lease);
    return lease;
  }
}

interface PreviewTruth {
  readonly partNodes: Map<GearBakedPartId, { image: FakeDisplayObject }>;
  readonly extraNodes: Array<{ image: FakeDisplayObject; gear?: { extraRole?: string } }>;
  readonly status: FakeDisplayObject;
  readonly caption: FakeDisplayObject;
}

function previewTruth(preview: WardrobeCharacterPreview): PreviewTruth {
  return preview as unknown as PreviewTruth;
}

async function settlePreview(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function recipeKeys(resolution: GearBakeResolution): Record<GearBakedPartId, string> {
  return Object.fromEntries(
    GEAR_BAKED_PART_IDS.map((partId) => [partId, resolution.recipe.parts[partId].key]),
  ) as Record<GearBakedPartId, string>;
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

// GEAR REPLACEMENT BOT 4 — append-only shared-baker wardrobe parity coverage.
describe("WardrobeCharacterPreview shared bake parity", () => {
  it("requests the exact equipped and hover-draft recipe keys used by an in-game rig", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });

    preview.refresh(mixedLoadout, 7);
    await settlePreview();
    const equippedCall = baker.calls[0];
    if (!equippedCall) throw new Error("equipped bake call missing");
    expect(recipeKeys(equippedCall.resolution)).toEqual(
      recipeKeys(resolveGearBakeLoadout(manifest, mixedLoadout, 7)),
    );

    preview.refresh(mixedLoadout, 7, "ash-walker-shirt");
    await settlePreview();
    const hoverCall = baker.calls[1];
    if (!hoverCall) throw new Error("hover bake call missing");
    const rigDraft = { ...mixedLoadout, torso: "ash-walker-shirt" as GearId };
    const rigKeys = recipeKeys(resolveGearBakeLoadout(manifest, rigDraft, 7));
    const hoverKeys = recipeKeys(hoverCall.resolution);
    expect(hoverKeys).toEqual(rigKeys);
    expect(hoverKeys.body).not.toBe(recipeKeys(equippedCall.resolution).body);
    for (const partId of GEAR_BAKED_PART_IDS.filter((partId) => partId !== "body")) {
      expect(hoverKeys[partId]).toBe(recipeKeys(equippedCall.resolution)[partId]);
    }
    expect(previewTruth(preview).caption.text).toContain("VISUAL DRAFT");
    preview.refresh(rigDraft, 7, "ash-walker-shirt");
    await settlePreview();
    expect(previewTruth(preview).caption.text).toContain("EQUIPPED SIX-PART BAKE");
  });

  it("drafts only the browsed slot, including locked catalog rows, without mutating account truth", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });
    const equipped = { ...STARTER_GEAR_LOADOUT };
    const original = { ...equipped };
    const lockedCandidates: Record<GearSlot, GearId> = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      head: "pressurized-head",
      torso: "pressurized-shirt",
      gloves: "house-edge-gloves",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    };
    const affectedParts: Record<GearSlot, readonly GearBakedPartId[]> = {
      hat: [],
      glasses: ["head"],
      facialHair: ["head"],
      head: ["head"],
      torso: ["body"],
      gloves: ["hand-l", "hand-r"],
      boots: ["foot-l", "foot-r"],
      cloak: [],
    };
    const equippedKeys = recipeKeys(resolveGearBakeLoadout(manifest, equipped));

    for (const slot of GEAR_SLOTS) {
      const id = lockedCandidates[slot];
      preview.refresh(equipped, 0, id);
      await settlePreview();
      const call = baker.calls.at(-1);
      if (!call) throw new Error(`missing ${slot} draft call`);
      expect(call.input.loadout[slot]).toBe(id);
      for (const otherSlot of GEAR_SLOTS.filter((candidate) => candidate !== slot)) {
        expect(call.input.loadout[otherSlot]).toBe(equipped[otherSlot]);
      }
      const draftKeys = recipeKeys(call.resolution);
      const changedParts = GEAR_BAKED_PART_IDS.filter(
        (partId) => draftKeys[partId] !== equippedKeys[partId],
      );
      expect(changedParts).toEqual(affectedParts[slot]);
      expect(Object.values(STARTER_GEAR_LOADOUT)).not.toContain(id);
      expect(equipped).toEqual(original);
    }
  });

  it("rejects late A after newer B and releases hover leases on exit and shutdown", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const deferred = new DeferredSharedBaker();
    const deferredScene = fakeScene();
    const deferredPreview = new WardrobeCharacterPreview(deferredScene.scene, {
      manifest,
      bakeCache: deferred,
    });
    deferredPreview.refresh(mixedLoadout, 0, "ash-walker-shirt");
    deferredPreview.refresh(mixedLoadout, 0, "coldsnap-shirt");
    const leaseB = deferred.settle(1);
    await settlePreview();
    const leaseA = deferred.settle(0);
    await settlePreview();
    expect(leaseA.released).toBe(true);
    expect(leaseB.released).toBe(false);
    for (const partId of GEAR_BAKED_PART_IDS) {
      expect(previewTruth(deferredPreview).partNodes.get(partId)?.image.texture.key).toBe(
        leaseB.handles[partId].textureKey,
      );
    }

    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });
    preview.refresh(mixedLoadout, 0);
    await settlePreview();
    const equippedLease = baker.calls[0]?.lease;
    preview.refresh(mixedLoadout, 0, "ash-walker-shirt");
    await settlePreview();
    const hoverLease = baker.calls[1]?.lease;
    expect(equippedLease?.released).toBe(true);
    preview.refresh(mixedLoadout, 0);
    await settlePreview();
    const returnedLease = baker.calls[2]?.lease;
    expect(hoverLease?.released).toBe(true);
    scene.events.emit("shutdown");
    expect(returnedLease?.released).toBe(true);
  });

  it("renders the baker's bare fallback on six retained nodes and creates no garment attachments", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const missingShirt: GearTextureStateResolver = (dependency) =>
      dependency.gearId === "pressurized-shirt" ? "missing" : "ready";
    const baker = new FakeSharedBaker(missingShirt);
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });

    preview.refresh(mixedLoadout, 0);
    await settlePreview();
    const call = baker.calls[0];
    if (!call) throw new Error("fallback bake call missing");
    const gameResolution = resolveGearBakeLoadout(manifest, mixedLoadout, 0, [], missingShirt);
    expect(recipeKeys(call.resolution)).toEqual(recipeKeys(gameResolution));
    expect(call.resolution.recipe.parts.body.layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(previewTruth(preview).partNodes.size).toBe(6);
    for (const partId of GEAR_BAKED_PART_IDS) {
      const node = previewTruth(preview).partNodes.get(partId)?.image;
      expect(node).toMatchObject({ active: true, visible: true });
      expect(node?.texture.key).toBe(gameResolution.recipe.parts[partId].key);
    }
    expect(
      previewTruth(preview).extraNodes.every((node) => node.gear?.extraRole !== undefined),
    ).toBe(true);
    expect(previewTruth(preview).status.text).toContain("SOME ART UNAVAILABLE");
  });

  it("names artless and missing clicked items while retaining the base-model bake", async () => {
    const manifest = replacementPairManifest("wardrobe-click-fallback-r1");
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });

    preview.refresh(STARTER_GEAR_LOADOUT, 0, "blank-drifter-head");
    await settlePreview();
    expect(previewTruth(preview).status.text).toContain("STITCH HEAD");
    expect(previewTruth(preview).status.text).toContain("INTENTIONALLY ARTLESS");
    expect(previewTruth(preview).partNodes.get("head")?.image.visible).toBe(true);

    preview.refresh(STARTER_GEAR_LOADOUT, 0, "brass-readers");
    await settlePreview();
    expect(previewTruth(preview).status.text).toContain("BRASS READERS");
    expect(previewTruth(preview).status.text).toContain("ART RENDERING");
    expect(previewTruth(preview).partNodes.get("head")?.image.visible).toBe(true);
  });
});

describe("WardrobeCharacterPreview shared extras and replacement heads", () => {
  it("keeps normal tower counts while baking the independent head and accessories into one node", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });
    const normal = { ...STARTER_GEAR_LOADOUT, hat: "coldsnap-hat" as GearId };

    preview.refresh(normal, 30);
    await settlePreview();
    const normalLease = baker.calls[0]?.lease;
    expect(normalLease?.extras).toMatchObject({
      replacementHeadPosition: false,
      towerTotal: 30,
      towerVisible: 12,
      towerOverflow: 18,
    });
    expect(normalLease?.extras.hats).toHaveLength(12);
    expect(previewTruth(preview).extraNodes).toHaveLength(12);
    expect(
      previewTruth(preview).extraNodes.every((node) => node.gear?.extraRole === "overlay-hat"),
    ).toBe(true);

    const replacement = {
      ...STARTER_GEAR_LOADOUT,
      head: "demon-mask-head" as GearId,
      hat: "demon-mask-hat" as GearId,
      glasses: "pressurized-glasses" as GearId,
      facialHair: "pressurized-facial-hair" as GearId,
    };
    preview.refresh(replacement, 0);
    await settlePreview();
    const bareReplacementLease = baker.calls[1]?.lease;
    expect(bareReplacementLease?.extras).toMatchObject({
      replacementHeadPosition: false,
      towerTotal: 1,
      towerVisible: 1,
      towerOverflow: 0,
    });
    expect(bareReplacementLease?.extras.hats).toHaveLength(1);
    expect(previewTruth(preview).extraNodes).toHaveLength(1);
    expect(
      bareReplacementLease?.resolution.recipe.parts.head.layers.map((layer) => layer.role),
    ).toEqual(["replacement-head", "facialHair", "glasses"]);
    expect(previewTruth(preview).partNodes.get("head")?.image.texture.key).toBe(
      bareReplacementLease?.handles.head.textureKey,
    );

    preview.refresh(replacement, 30);
    await settlePreview();
    const towerLease = baker.calls[2]?.lease;
    expect(towerLease?.extras).toMatchObject({
      replacementHeadPosition: false,
      towerTotal: 30,
      towerVisible: 12,
      towerOverflow: 18,
    });
    expect(towerLease?.extras.hats).toHaveLength(12);
    expect(previewTruth(preview).extraNodes).toHaveLength(12);
    expect(
      previewTruth(preview).extraNodes.every((node) => node.gear?.extraRole === "overlay-hat"),
    ).toBe(true);
    expect(scene.images.filter((image) => image.active)).toHaveLength(18);
  });

  it("derives its six-part envelope from fixed frames, never loose garment alpha bounds", () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const bounds = wardrobeFixedPartBounds(manifest);
    const altered = structuredClone(manifest);
    for (const slot of altered.slots) {
      for (const item of slot.items) {
        for (const part of item.parts) {
          part.alphaBounds = { left: -50_000, top: -50_000, width: 100_000, height: 100_000 };
        }
      }
    }
    expect(wardrobeFixedPartBounds(altered)).toEqual(bounds);

    const assembly = assembleBoilerplate(manifest, 76);
    const head = assembly.parts.find((part) => part.source.id === "head");
    if (!head || assembly.parts.length !== 6) throw new Error("fixed boilerplate parts missing");
    const edge = (part: (typeof assembly.parts)[number], side: "left" | "right" | "top" | "bottom") => {
      const frame = GEAR_BAKE_FRAMES[part.source.id];
      if (side === "left") return part.x - frame.origin.x * frame.width * part.scale;
      if (side === "right") return part.x + (1 - frame.origin.x) * frame.width * part.scale;
      if (side === "top") return part.y - frame.origin.y * frame.height * part.scale;
      return part.y + (1 - frame.origin.y) * frame.height * part.scale;
    };
    expect(bounds.minX).toBeCloseTo(Math.min(...assembly.parts.map((part) => edge(part, "left"))));
    expect(bounds.maxX).toBeCloseTo(Math.max(...assembly.parts.map((part) => edge(part, "right"))));
    expect(bounds.minY).toBeCloseTo(Math.min(...assembly.parts.map((part) => edge(part, "top"))));
    expect(bounds.maxY).toBeCloseTo(Math.max(...assembly.parts.map((part) => edge(part, "bottom"))));
    expect(head.scale).toBeCloseTo(assembly.scale * head.source.mountScale);
  });
});

function compatibilityManifest(): GearPartsManifest {
  const candidate = structuredClone(rawManifest) as GearPartsManifest;
  candidate.schemaVersion = 1;
  delete candidate.replacementContract;
  const validated = validateGearPartsManifest(candidate);
  if (!validated) throw new Error("synthetic compatibility manifest failed validation");
  return validated;
}

describe("WardrobeCharacterPreview manifest-version fallback", () => {
  it("renders the shared v1 six-part boilerplate plus legacy loose-garment assembly", async () => {
    const { assembleGearLoadout } = await import("../../sprites/gear-parts.js");
    const manifest = compatibilityManifest();
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });
    const rigAssembly = assembleGearLoadout(manifest, mixedLoadout, 7);
    expect(rigAssembly.parts.filter((part) => part.stackIndex < 0).length).toBeGreaterThan(0);

    preview.refresh(mixedLoadout, 7);
    await settlePreview();

    const truth = previewTruth(preview);
    expect(baker.calls).toHaveLength(0);
    expect(truth.partNodes.size).toBe(6);
    for (const partId of GEAR_BAKED_PART_IDS) {
      expect(truth.partNodes.get(partId)?.image).toMatchObject({
        active: true,
        visible: true,
        texture: { key: `boilerplate:${partId}` },
      });
    }
    const legacyNodes = preview as unknown as {
      extraNodes: Array<{ gear?: { key: string; stackIndex: number } }>;
    };
    expect(legacyNodes.extraNodes.map((node) => node.gear?.key)).toEqual(
      rigAssembly.parts.map((part) => part.key),
    );
    expect(legacyNodes.extraNodes.some((node) => (node.gear?.stackIndex ?? 0) < 0)).toBe(true);
    expect(truth.status.text).toContain("REPLACEMENT CONTRACT UNAVAILABLE");

    const hoverDraft = { ...mixedLoadout, hat: "molten-core-hat" as GearId };
    const rigHoverAssembly = assembleGearLoadout(manifest, hoverDraft, 7);
    preview.refresh(mixedLoadout, 7, "molten-core-hat");
    await settlePreview();
    expect(legacyNodes.extraNodes.map((node) => node.gear?.key)).toEqual(
      rigHoverAssembly.parts.map((part) => part.key),
    );
    expect(truth.caption.text).toContain("VISUAL DRAFT");

    preview.refresh(mixedLoadout, 7);
    await settlePreview();
    expect(legacyNodes.extraNodes.map((node) => node.gear?.key)).toEqual(
      rigAssembly.parts.map((part) => part.key),
    );
    expect(baker.calls).toHaveLength(0);
  });

  it("keeps schema v2 on the existing shared bake-lease path", async () => {
    const manifest = replacementPairManifest("wardrobe-preview-test-r1");
    const baker = new FakeSharedBaker();
    const scene = fakeScene();
    const preview = new WardrobeCharacterPreview(scene.scene, { manifest, bakeCache: baker });

    preview.refresh(mixedLoadout, 7);
    await settlePreview();

    const call = baker.calls[0];
    if (!call) throw new Error("replacement bake call missing");
    const truth = previewTruth(preview);
    expect(baker.calls).toHaveLength(1);
    expect(truth.partNodes.size).toBe(6);
    for (const partId of GEAR_BAKED_PART_IDS) {
      expect(truth.partNodes.get(partId)?.image.texture.key).toBe(
        call.lease.handles[partId].textureKey,
      );
    }
    expect(truth.extraNodes).toHaveLength(call.lease.extras.parts.length);
    expect(truth.extraNodes.every((node) => node.gear?.extraRole !== undefined)).toBe(true);
  });
});
