import { encodeGearCosmetics, type GearId, type GearSlot, STARTER_GEAR_LOADOUT } from "@dd/shared";
import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    BlendModes: { ADD: 1 },
    TintModes: { FILL: 1, MULTIPLY: 2 },
  },
}));

import {
  replacementPairManifest,
  replacementPairManifestInput,
} from "../sprites/gear-pairs.test-fixture.js";
import {
  assembleBoilerplate,
  type GearAssemblyPart,
  type GearBakeSourceDependency,
  type GearPartBakeRecipe,
  type GearPartsManifest,
  type GearTextureState,
  validateGearPartsManifest,
} from "../sprites/gear-parts.js";
import {
  type GearTextureBakeBackend,
  type GearTextureResource,
  gearTextureBakeCacheForScene,
} from "../sprites/gear-texture-baker.js";
import {
  FLOATING_HEAD_SPRING_TUNING,
  type FloatingHeadSpringState,
  SpriteRig,
  sampleFloatingHeadWalkBob,
  stepFloatingHeadSpring,
} from "./SpriteRig.js";

class FakeDisplayObject {
  active = true;
  visible = true;
  x: number;
  y: number;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  alpha = 1;
  originX = 0.5;
  originY = 0.5;
  isTinted = false;
  tintTopLeft = 0xffffff;
  parentContainer?: FakeContainer;
  texture: { key: string };
  frame: { name: string; width: number; height: number };

  constructor(x = 0, y = 0, key = "shape", frame = "__BASE") {
    this.x = x;
    this.y = y;
    this.texture = { key };
    this.frame = { name: frame, width: 168, height: 168 };
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

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  setTint(color: number): this {
    this.isTinted = true;
    this.tintTopLeft = color;
    return this;
  }

  clearTint(): this {
    this.isTinted = false;
    this.tintTopLeft = 0xffffff;
    return this;
  }

  setTintMode(_mode: number): this {
    return this;
  }

  setBlendMode(_mode: number): this {
    return this;
  }

  setStrokeStyle(_width: number, _color: number, _alpha: number): this {
    return this;
  }

  setDepth(_depth: number): this {
    return this;
  }

  setText(_text: string): this {
    return this;
  }

  destroy(): void {
    this.active = false;
    const parent = this.parentContainer;
    if (parent) parent.list = parent.list.filter((entry) => entry !== this);
    this.parentContainer = undefined;
  }
}

class FakeContainer extends FakeDisplayObject {
  list: FakeDisplayObject[] = [];

  constructor(x: number, y: number, children: FakeDisplayObject[]) {
    super(x, y, "container");
    for (const child of children) this.add(child);
  }

  add(child: FakeDisplayObject): this {
    if (!this.list.includes(child)) this.list.push(child);
    child.parentContainer = this;
    return this;
  }

  bringToTop(child: FakeDisplayObject): this {
    this.list = this.list.filter((entry) => entry !== child);
    this.list.push(child);
    return this;
  }
}

function fakeScene(): Phaser.Scene {
  const textureFrames = new Map<string, Set<string>>();
  const scene = {
    add: {
      image: (x: number, y: number, key: string, frame?: string) =>
        new FakeDisplayObject(x, y, key, frame),
      ellipse: (x: number, y: number) => new FakeDisplayObject(x, y),
      rectangle: (x: number, y: number) => new FakeDisplayObject(x, y),
      text: (x: number, y: number) => new FakeDisplayObject(x, y),
      container: (x: number, y: number, children: FakeDisplayObject[]) =>
        new FakeContainer(x, y, children),
    },
    textures: {
      exists: (key: string) => key.startsWith("boilerplate:") || key.startsWith("gear:"),
      get: (key: string) => ({
        has: (frame: string) => textureFrames.get(key)?.has(frame) === true,
        add: (frame: string) => {
          const frames = textureFrames.get(key) ?? new Set<string>();
          frames.add(frame);
          textureFrames.set(key, frames);
          return true;
        },
      }),
    },
  };
  return scene as unknown as Phaser.Scene;
}

interface RigTruth {
  body: FakeDisplayObject;
  parts: FakeDisplayObject[];
  hands: Array<{ img: FakeDisplayObject; front: boolean }>;
  feet: Array<{ img: FakeDisplayObject; front: boolean }>;
  boilerplateHead?: FakeDisplayObject;
  slideAfterimageA: FakeDisplayObject;
  slideAfterimageB: FakeDisplayObject;
  gearAttachments: Array<{
    image: FakeDisplayObject;
    spec: GearAssemblyPart;
    angle: number;
    velocity: number;
  }>;
  placeNodeGear(attachment: RigTruth["gearAttachments"][number]): void;
}

function compatibilityPairManifest(): GearPartsManifest {
  const candidate = replacementPairManifestInput("rig-compatibility-r1") as GearPartsManifest;
  candidate.schemaVersion = 1;
  delete candidate.replacementContract;
  const manifest = validateGearPartsManifest(candidate);
  if (!manifest) throw new Error("synthetic pair compatibility manifest failed validation");
  return manifest;
}

describe("SpriteRig boilerplate assembly truth", () => {
  it("atomically removes the legacy kit, fills absent limbs, and preserves rig scale", () => {
    const manifest = compatibilityPairManifest();
    const rig = new SpriteRig(
      fakeScene(),
      0,
      0,
      false,
      "rig-truth",
      "cc-pyra-cinderhowl-the-flame-caster",
    );
    rig.setRigScale(1.25);
    rig.equipGearLoadout(STARTER_GEAR_LOADOUT, manifest);

    const truth = rig as unknown as RigTruth;
    expect(truth.hands).toHaveLength(2);
    expect(truth.feet).toHaveLength(2);
    expect(truth.parts.map((part) => part.texture.key).sort()).toEqual(
      [
        "boilerplate:body",
        "boilerplate:foot-l",
        "boilerplate:foot-r",
        "boilerplate:hand-l",
        "boilerplate:hand-r",
      ].sort(),
    );
    expect(truth.boilerplateHead?.texture.key).toBe("boilerplate:head");
    expect([...truth.parts, truth.boilerplateHead].every((part) => part?.isTinted === false)).toBe(
      true,
    );
    expect(truth.slideAfterimageA.texture.key).toBe("boilerplate:body");
    expect(truth.slideAfterimageB.texture.key).toBe("boilerplate:body");
    expect(truth.parts.every((part) => !part.texture.key.startsWith("cc-pyra"))).toBe(true);
    expect(rig.root.scaleX).toBe(1.25);
    expect(rig.root.scaleY).toBe(1.25);

    const head = assembleBoilerplate(manifest).parts.find((part) => part.source.id === "head");
    expect(truth.boilerplateHead?.x).toBeCloseTo(head?.x ?? Number.NaN, 10);
    expect(truth.boilerplateHead?.y).toBeCloseTo(head?.y ?? Number.NaN, 10);
    expect(truth.parts.every((part) => Math.abs(part.scaleX) < 1)).toBe(true);
  });

  it("copies final animated limb transforms into cropped gear receivers", () => {
    const manifest = compatibilityPairManifest();
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      gloves: "ash-walker-gloves" as GearId,
      boots: "ash-walker-boots" as GearId,
    } as Record<GearSlot, GearId>;
    const rig = new SpriteRig(fakeScene(), 0, 0, false, "gear-truth", "drifter", manifest);
    rig.equipGearLoadout(loadout, manifest);

    const truth = rig as unknown as RigTruth;
    const hand = truth.hands.find((candidate) => candidate.front);
    const glove = truth.gearAttachments.find(
      (attachment) => attachment.spec.source.receiver === "hand-r",
    );
    expect(hand).toBeDefined();
    expect(glove).toBeDefined();
    if (!hand || !glove) return;
    hand.img.setPosition(37, -12).setRotation(0.4).setScale(-0.21, 0.19);
    glove.angle = 0.08;
    truth.placeNodeGear(glove);

    expect(glove.image.x).toBe(37);
    expect(glove.image.y).toBe(-12);
    expect(glove.image.scaleX).toBeCloseTo(hand.img.scaleX * glove.spec.source.mountScale, 10);
    expect(glove.image.scaleY).toBeCloseTo(hand.img.scaleY * glove.spec.source.mountScale, 10);
    expect(glove.image.rotation).toBeCloseTo(
      hand.img.rotation - (glove.spec.rotation + glove.angle),
      10,
    );
  });
});

// METAGAME WAVE 7B — append-only floating-head channel coverage.
describe("SpriteRig floating head spring", () => {
  const freshHeadState = (): FloatingHeadSpringState => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ready: false,
  });

  it("converges on a moved body-socket target without residual energy", () => {
    const state = freshHeadState();
    stepFloatingHeadSpring(state, {
      targetX: 0,
      targetY: 0,
      authoredOffsetX: 0,
      authoredOffsetY: 0,
      impulseX: 0,
      impulseY: 0,
      elapsedSeconds: 1 / 60,
      reducedMotion: false,
      reset: true,
    });
    for (let frame = 0; frame < 240; frame++)
      stepFloatingHeadSpring(state, {
        targetX: 3,
        targetY: -2,
        authoredOffsetX: 0,
        authoredOffsetY: 0,
        impulseX: 0,
        impulseY: 0,
        elapsedSeconds: 1 / 60,
        reducedMotion: false,
        reset: false,
      });
    expect(state.x).toBeCloseTo(3, 5);
    expect(state.y).toBeCloseTo(-2, 5);
    expect(Math.hypot(state.vx, state.vy)).toBeLessThan(0.0001);
  });

  it("keeps the walk beat counter-phased and inside its authored pixel ceiling", () => {
    const samples = Array.from({ length: 720 }, (_, index) =>
      sampleFloatingHeadWalkBob((index / 720) * Math.PI * 2, 1, false),
    );
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(
      FLOATING_HEAD_SPRING_TUNING.walkBobPx,
    );
    expect(sampleFloatingHeadWalkBob(Math.PI / 4, 1, false)).toBeLessThan(0);
    expect(sampleFloatingHeadWalkBob((Math.PI * 3) / 4, 1, false)).toBeGreaterThan(0);
  });

  it("removes authored bob and clamps reduced-motion follow to a minimal residual", () => {
    const state = freshHeadState();
    stepFloatingHeadSpring(state, {
      targetX: 0,
      targetY: 0,
      authoredOffsetX: 4,
      authoredOffsetY: -3,
      impulseX: 0,
      impulseY: 0,
      elapsedSeconds: 1 / 60,
      reducedMotion: false,
      reset: true,
    });
    stepFloatingHeadSpring(state, {
      targetX: 2,
      targetY: 1,
      authoredOffsetX: 100,
      authoredOffsetY: -100,
      impulseX: 100,
      impulseY: -100,
      elapsedSeconds: 1 / 60,
      reducedMotion: true,
      reset: false,
    });
    expect(Math.hypot(state.x - 2, state.y - 1)).toBeLessThanOrEqual(
      FLOATING_HEAD_SPRING_TUNING.reducedMaxOffset + 1e-10,
    );
    expect(sampleFloatingHeadWalkBob(Math.PI / 4, 1, true)).toBe(0);
  });
});

// METAGAME WAVE 7B — append-only sprung-head wardrobe parenting coverage.
describe("SpriteRig sprung-head gear truth", () => {
  it("moves face gear and the prestige seed with the final sprung head transform", () => {
    const manifest = compatibilityPairManifest();
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "molten-core-hat" as GearId,
      glasses: "ash-walker-glasses" as GearId,
      facialHair: "ash-walker-facial-hair" as GearId,
    } as Record<GearSlot, GearId>;
    const rig = new SpriteRig(fakeScene(), 0, 0, false, "head-gear-truth", "drifter", manifest);
    rig.equipGearLoadout(loadout, manifest, 1);

    const truth = rig as unknown as RigTruth & {
      placeHeadGear(attachment: RigTruth["gearAttachments"][number]): void;
    };
    const head = truth.boilerplateHead;
    if (!head) throw new Error("boilerplate head was not installed");
    const riders = truth.gearAttachments.filter(
      (attachment) =>
        attachment.spec.source.receiver === "face.eyes" ||
        attachment.spec.source.receiver === "face.mouth" ||
        attachment.spec.stackIndex === 0,
    );
    expect(riders).toHaveLength(3);
    head.setPosition(9, -31).setRotation(0.22).setScale(-0.16, 0.15);
    const before = riders.map((attachment) => {
      attachment.angle = 0.07;
      truth.placeHeadGear(attachment);
      expect(attachment.image.rotation).toBeCloseTo(
        head.rotation - (attachment.spec.rotation + attachment.angle),
        10,
      );
      return { x: attachment.image.x, y: attachment.image.y };
    });

    head.setPosition(15, -34);
    for (let index = 0; index < riders.length; index++) {
      const attachment = riders[index];
      const prior = before[index];
      if (!attachment || !prior) continue;
      truth.placeHeadGear(attachment);
      expect(attachment.image.x - prior.x).toBeCloseTo(6, 10);
      expect(attachment.image.y - prior.y).toBeCloseTo(-3, 10);
    }
  });
});

// METAGAME WAVE 7B — append-only runtime head-texture swap coverage.
describe("SpriteRig alternative-head texture seam", () => {
  it("installs a ready per-loadout head texture and returns to the boilerplate default", () => {
    const manifest = compatibilityPairManifest();
    const rig = new SpriteRig(fakeScene(), 0, 0, false, "head-texture-seam", "drifter", manifest);
    const truth = rig as unknown as RigTruth;

    rig.equipGearLoadout(STARTER_GEAR_LOADOUT, manifest, 0, [], {
      gearId: "future-knight-head",
      textureKey: "gear:alternative-head:future-knight-head",
    });
    expect(truth.boilerplateHead?.texture.key).toBe("gear:alternative-head:future-knight-head");

    rig.equipGearLoadout(STARTER_GEAR_LOADOUT, manifest);
    expect(truth.boilerplateHead?.texture.key).toBe("boilerplate:head");
  });
});

// v0.118 gear-layer live reproduction — append-only four-group runtime coverage.
describe("SpriteRig mixed-set gear attachment groups", () => {
  it("retains and places every part from the exact eight-slot loadout through the synced wire path", () => {
    const manifest = compatibilityPairManifest();
    const loadout = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      head: "pressurized-head",
      torso: "pressurized-shirt",
      gloves: "house-edge-gloves",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    } as Record<GearSlot, GearId>;
    const encoded = encodeGearCosmetics(loadout);
    expect(encoded).toEqual({
      gearUpper: "x,2q,2r,2s,20",
      gearLower: "2d,2u,2f",
    });

    const rig = new SpriteRig(fakeScene(), 0, 0, false, "mixed-gear-truth", "drifter", manifest);
    expect(rig.equipSyncedGear(encoded.gearUpper, encoded.gearLower, manifest)).toBe(true);
    const truth = rig as unknown as RigTruth & {
      syncGearPose(
        elapsedSeconds: number,
        outsidePaperView: boolean,
        rebase: boolean,
        reducedMotion: boolean,
        excitation: number,
        dashLean: number,
        landed: boolean,
      ): void;
    };
    truth.syncGearPose(1 / 60, false, true, false, 0, 0, false);

    const groups = { body: 0, hands: 0, feet: 0, head: 0 };
    for (const attachment of truth.gearAttachments) {
      const receiver = attachment.spec.source.receiver;
      if (receiver.startsWith("hand-")) groups.hands++;
      else if (receiver.startsWith("foot-")) groups.feet++;
      else if (receiver === "head" || receiver.startsWith("face.")) groups.head++;
      else groups.body++;
      expect(attachment.image.visible).toBe(true);
      expect((rig.root as unknown as FakeContainer).list).toContain(attachment.image);
    }
    const head = truth.boilerplateHead;
    expect(head).toBeDefined();
    for (const attachment of truth.gearAttachments.filter((candidate) =>
      ["face.eyes", "face.mouth"].includes(candidate.spec.source.receiver),
    )) {
      expect(attachment.image.scaleX).toBeCloseTo(
        (head?.scaleX ?? Number.NaN) * attachment.spec.source.mountScale,
        10,
      );
      expect(attachment.image.scaleY).toBeCloseTo(
        (head?.scaleY ?? Number.NaN) * attachment.spec.source.mountScale,
        10,
      );
    }
    expect(groups).toEqual({ body: 2, hands: 2, feet: 2, head: 4 });
    expect(truth.gearAttachments).toHaveLength(10);
    expect(new Set(truth.gearAttachments.map((attachment) => attachment.spec.gearId)).size).toBe(8);
    expect(truth.gearAttachments.map((attachment) => attachment.spec.depth)).toEqual(
      [...truth.gearAttachments]
        .sort((a, b) => a.spec.depth - b.spec.depth)
        .map((attachment) => attachment.spec.depth),
    );
  });
});

class RigBakeBackend implements GearTextureBakeBackend {
  readonly createCalls: GearPartBakeRecipe[] = [];
  private readonly bakedKeys = new Set<string>();
  private gate?: Promise<void>;
  private openGate?: () => void;

  constructor(scene: Phaser.Scene) {
    const originalExists = scene.textures.exists.bind(scene.textures);
    scene.textures.exists = (key: string) => this.bakedKeys.has(key) || originalExists(key);
  }

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
    await this.gate;
    return new Map(dependencies.map((dependency) => [dependency.textureKey, "ready"]));
  }

  createTexture(recipe: GearPartBakeRecipe): GearTextureResource {
    this.createCalls.push(recipe);
    this.bakedKeys.add(recipe.key);
    let destroyed = false;
    return {
      textureKey: recipe.key,
      get destroyed() {
        return destroyed;
      },
      destroy: () => {
        destroyed = true;
        this.bakedKeys.delete(recipe.key);
      },
    };
  }

  destroy(): void {
    this.settleSources();
    this.bakedKeys.clear();
  }
}

function replacementScene(): { scene: Phaser.Scene; backend: RigBakeBackend } {
  const scene = fakeScene();
  (scene as unknown as { time: unknown }).time = {
    delayedCall: () => ({ remove: () => undefined }),
  };
  const backend = new RigBakeBackend(scene);
  gearTextureBakeCacheForScene(scene, backend);
  return { scene, backend };
}

interface ReplacementRigTruth extends RigTruth {
  gearAssembly?: {
    parts: GearAssemblyPart[];
    towerTotal: number;
    towerVisible: number;
    towerOverflow: number;
  };
  hatAttachments: RigTruth["gearAttachments"];
  hatOverflowLabel?: FakeDisplayObject;
  syncGearPose(
    elapsedSeconds: number,
    outsidePaperView: boolean,
    rebase: boolean,
    reducedMotion: boolean,
    excitation: number,
    dashLean: number,
    landed: boolean,
  ): void;
}

// GEAR REPLACEMENT BOT 3 — append-only retained-node and atomic-commit coverage.
describe("SpriteRig replacement bake integration", () => {
  it("commits six baked textures atomically and creates only cloak/hat extras", async () => {
    const manifest = replacementPairManifest("rig-test-r1");
    const { scene, backend } = replacementScene();
    backend.delaySources();
    const rig = new SpriteRig(scene, 0, 0, false, "replacement-rig", "drifter", manifest);
    const truth = rig as unknown as ReplacementRigTruth;
    const loadout = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      head: "pressurized-head",
      torso: "pressurized-shirt",
      gloves: "house-edge-gloves",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    } as Record<GearSlot, GearId>;
    rig.equipGearLoadout(loadout, manifest);

    expect(truth.parts.every((part) => part.texture.key.startsWith("boilerplate:"))).toBe(true);
    expect(truth.boilerplateHead?.texture.key).toBe("boilerplate:head");
    backend.settleSources();
    await vi.waitFor(() =>
      expect(truth.parts.every((part) => part.texture.key.startsWith("gear-bake:"))).toBe(true),
    );

    expect(truth.parts).toHaveLength(5);
    expect(truth.hands).toHaveLength(2);
    expect(truth.feet).toHaveLength(2);
    expect(truth.boilerplateHead?.texture.key).toMatch(/^gear-bake:.*:head:/);
    expect(truth.slideAfterimageA.texture.key).toBe(truth.body.texture.key);
    expect(truth.slideAfterimageA.texture.key).toBe(truth.slideAfterimageB.texture.key);
    expect(truth.gearAttachments.map((attachment) => attachment.spec.slot).sort()).toEqual([
      "cloak",
      "hat",
    ]);
    expect(
      truth.gearAttachments.every((attachment) => attachment.spec.extraRole !== undefined),
    ).toBe(true);
    expect(backend.createCalls).toHaveLength(6);

    const display = (rig.root as unknown as FakeContainer).list;
    const cloak = truth.gearAttachments.find((attachment) => attachment.spec.slot === "cloak");
    const hat = truth.gearAttachments.find((attachment) => attachment.spec.slot === "hat");
    const backHand = truth.hands.find((hand) => !hand.front)?.img;
    const frontHand = truth.hands.find((hand) => hand.front)?.img;
    if (!cloak || !hat || !backHand || !frontHand || !truth.boilerplateHead)
      throw new Error("replacement render stack was incomplete");
    expect(display.indexOf(cloak.image)).toBeLessThan(display.indexOf(truth.body));
    expect(display.indexOf(backHand)).toBeLessThan(display.indexOf(truth.body));
    expect(display.indexOf(truth.body)).toBeLessThan(display.indexOf(truth.boilerplateHead));
    expect(display.indexOf(truth.boilerplateHead)).toBeLessThan(display.indexOf(hat.image));
    expect(display.indexOf(hat.image)).toBeLessThan(display.indexOf(frontHand));

    rig.setBranded(true);
    expect(
      [
        ...truth.parts,
        truth.boilerplateHead,
        ...truth.gearAttachments.map((row) => row.image),
      ].every((part) => part?.isTinted),
    ).toBe(true);
    rig.flash(80, 0xabcdef);
    expect(truth.body.tintTopLeft).toBe(0xabcdef);
    expect(truth.boilerplateHead.tintTopLeft).toBe(0xabcdef);
    expect(truth.gearAttachments.every((row) => row.image.tintTopLeft === 0xabcdef)).toBe(true);

    truth.syncGearPose(1 / 60, true, false, false, 1, 1, false);
    truth.syncGearPose(1 / 60, false, false, false, 1, 1, false);
    truth.syncGearPose(1 / 60, false, false, false, 1, 1, false);
    for (let frame = 0; frame < 240; frame++)
      truth.syncGearPose(1 / 60, false, false, true, 1, 1, false);
    expect(Math.max(...truth.hatAttachments.map((row) => Math.abs(row.angle)))).toBeLessThan(0.001);
    expect(backend.createCalls).toHaveLength(6);
  });

  it("bakes the independent head with accessories and retains all twelve visible hats", async () => {
    const manifest = replacementPairManifest("rig-test-r1");
    const { scene, backend } = replacementScene();
    const rig = new SpriteRig(scene, 0, 0, false, "replacement-head-rig", "drifter", manifest);
    const truth = rig as unknown as ReplacementRigTruth;
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      head: "demon-mask-head" as GearId,
      hat: "demon-mask-hat" as GearId,
      glasses: "pressurized-glasses" as GearId,
      facialHair: "pressurized-facial-hair" as GearId,
    } as Record<GearSlot, GearId>;
    rig.equipGearLoadout(loadout, manifest, 30);
    await vi.waitFor(() => expect(truth.hatAttachments).toHaveLength(12));

    expect(truth.boilerplateHead?.texture.key).toContain("demon-mask-head");
    expect(
      truth.hatAttachments.every((attachment) => attachment.spec.extraRole === "overlay-hat"),
    ).toBe(true);
    expect(truth.gearAttachments).toHaveLength(12);
    expect(truth.gearAssembly).toMatchObject({
      towerTotal: 30,
      towerVisible: 12,
      towerOverflow: 18,
    });
    expect(truth.hatOverflowLabel).toBeDefined();
    const headBake = backend.createCalls.find((recipe) => recipe.partId === "head");
    expect(headBake?.layers.map((layer) => layer.role)).toEqual([
      "replacement-head",
      "facialHair",
      "glasses",
    ]);

    const createdBeforePrestigeOnlyChange = backend.createCalls.length;
    rig.equipGearLoadout(loadout, manifest, 0);
    await vi.waitFor(() => expect(truth.hatAttachments).toHaveLength(1));
    expect(truth.gearAssembly).toMatchObject({
      towerTotal: 1,
      towerVisible: 1,
      towerOverflow: 0,
    });
    expect(backend.createCalls).toHaveLength(createdBeforePrestigeOnlyChange);
  });
});
