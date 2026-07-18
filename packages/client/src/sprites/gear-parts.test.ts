import { readFileSync } from "node:fs";
import { type GearId, type GearSlot, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";
import {
  assembleBoilerplate,
  assembleGearLoadout,
  DEFAULT_LOADOUT_HEAD_TEXTURE,
  ensureGearPartFrame,
  type GearPartsManifest,
  hatStackScale,
  hatTowerTotal,
  isGearReplacementManifest,
  resolveGearBakeLoadout,
  resolveLoadoutHeadTexture,
  stepHatSpringChain,
  validateGearPartsManifest,
} from "./gear-parts.js";

const rawManifest: unknown = JSON.parse(
  readFileSync(
    new URL("../../../../tools/artkit/out/gear/gear-parts-manifest.json", import.meta.url),
    "utf8",
  ),
);
const manifest = validateGearPartsManifest(rawManifest);

function requireManifest(): GearPartsManifest {
  if (!manifest) throw new Error("gear parts manifest failed validation");
  return manifest;
}

describe("gear part manifest assembly", () => {
  it("validates the frozen socket, outline, boilerplate, and partial-art contract", () => {
    const value = requireManifest();
    expect(value.socketFrame.id).toBe("GEAR_SOCKET_FRAME_V1");
    expect(value.socketFrame.hatStackBand.id).toBe("HAT_STACK_BAND_V1");
    expect(value.outlinePass).toMatchObject({ color: "#101014", installedRadius: 8 });
    expect(value.boilerplate.parts).toHaveLength(6);
    expect(value.slots).toHaveLength(8);
    expect(
      validateGearPartsManifest({
        ...(rawManifest as Record<string, unknown>),
        socketFrame: { id: "wrong" },
      }),
    ).toBeNull();
  });

  it("assembles each untrimmed blank-kit pivot onto exactly one frozen receiver", () => {
    const assembly = assembleBoilerplate(requireManifest());
    expect(assembly.parts).toHaveLength(6);
    expect(assembly.scale).toBeCloseTo(76 / 512, 10);
    const root = requireManifest().socketFrame.bodyRootSource;
    for (const part of assembly.parts) {
      const raw = part.source.receiverAnchor.raw;
      expect(raw).toBeTruthy();
      expect(part.x).toBeCloseTo(((raw?.x ?? root.x) - root.x) * assembly.scale, 10);
      expect(part.y).toBeCloseTo(((raw?.y ?? root.y) - root.y) * assembly.scale, 10);
    }
    const body = assembly.parts.find((part) => part.source.id === "body");
    const head = assembly.parts.find((part) => part.source.id === "head");
    const leftHand = assembly.parts.find((part) => part.source.id === "hand-l");
    const rightFoot = assembly.parts.find((part) => part.source.id === "foot-r");
    expect(body).toMatchObject({ x: 0, y: 0, originX: 0.5, originY: 0.5 });
    expect(head?.x).toBeCloseTo(0, 10);
    expect(head?.y).toBeCloseTo(-0.38 * 76, 10);
    expect(leftHand?.x).toBeCloseTo((384 - 512) * (76 / 512), 10);
    expect(leftHand?.y).toBeCloseTo((522 - 512) * (76 / 512), 10);
    expect(rightFoot?.x).toBeCloseTo((576 - 512) * (76 / 512), 10);
    expect(rightFoot?.y).toBeCloseTo((736 - 512) * (76 / 512), 10);
  });

  it("keeps the real head on the body socket and every base texture below raw scale", () => {
    const value = requireManifest();
    const assembly = assembleBoilerplate(value);
    const head = assembly.parts.find((part) => part.source.id === "head");
    expect(head).toBeDefined();
    const socketX = (head?.source.receiverAnchor.xL ?? 0) * 76;
    const socketY = (head?.source.receiverAnchor.yL ?? 0) * 76;
    const connectorToleranceAtRigScale = 4 * assembly.scale;
    expect(Math.hypot((head?.x ?? 0) - socketX, (head?.y ?? 0) - socketY)).toBeLessThanOrEqual(
      connectorToleranceAtRigScale,
    );
    for (const part of assembly.parts) {
      expect(part.scale).toBeLessThan(1);
      expect(part.source.alphaBounds.width * part.scale).toBeLessThan(part.source.image.width);
      expect(part.source.alphaBounds.height * part.scale).toBeLessThan(part.source.image.height);
    }
  });

  it("maps validated ids onto normalized sockets and expands prestige hats only", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "ash-walker-hat" as GearId,
    } as Record<GearSlot, GearId>;
    const assembly = assembleGearLoadout(requireManifest(), loadout, 2);
    expect(assembly).toMatchObject({ towerTotal: 3, towerVisible: 3, towerOverflow: 0 });
    expect(assembly.parts).toHaveLength(3);
    for (let index = 0; index < assembly.parts.length; index++) {
      const part = assembly.parts[index];
      expect(part?.source.receiver).toBe("head");
      expect(part?.x).toBeCloseTo(0, 10);
      expect(part?.y).toBeCloseTo(-0.38 * 76, 10);
      expect(part?.depth).toBe(32);
      expect(part?.stackIndex).toBe(index);
      expect(part?.topSocketSource).not.toBeNull();
    }
  });

  it("crops multi-part masters around each source pivot instead of duplicating sibling pixels", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      gloves: "ash-walker-gloves" as GearId,
      boots: "ash-walker-boots" as GearId,
    } as Record<GearSlot, GearId>;
    const assembly = assembleGearLoadout(requireManifest(), loadout);
    const movingParts = assembly.parts.filter(
      (part) => part.slot === "gloves" || part.slot === "boots",
    );
    expect(movingParts).toHaveLength(4);
    for (const part of movingParts) {
      const bounds = part.source.alphaBounds;
      expect(part.originX).toBeCloseTo(
        (part.source.pivotSource.x - bounds.left) / bounds.width,
        10,
      );
      expect(part.originY).toBeCloseTo(
        (part.source.pivotSource.y - bounds.top) / bounds.height,
        10,
      );
      expect(bounds.width).toBeLessThan(part.item.image.width);
    }
  });
});

describe("prestige hat tower math", () => {
  it("miniaturizes monotonically and caps visible height/count", () => {
    expect(hatTowerTotal(0)).toBe(1);
    expect(hatTowerTotal(11)).toBe(12);
    expect(hatTowerTotal(30)).toBe(30);
    expect(hatTowerTotal(Number.NaN)).toBe(1);
    expect(hatStackScale(0, 1)).toBe(1);
    const scales = Array.from({ length: 12 }, (_, index) => hatStackScale(index, 12));
    for (let index = 1; index < scales.length; index++)
      expect(scales[index]).toBeLessThanOrEqual(scales[index - 1] ?? 0);
    expect(scales.every((scale) => scale >= 0.24)).toBe(true);
    expect(scales.reduce((sum, scale) => sum + scale, 0)).toBeLessThan(4.1);
  });

  it("propagates dash lean with progressive lag, settles, and rebases without energy", () => {
    const states = Array.from({ length: 6 }, () => ({ angle: 0, velocity: 0 }));
    for (let frame = 0; frame < 24; frame++)
      stepHatSpringChain(states, 1 / 60, {
        excitation: 0.45,
        dashLean: -1,
        bodyAngle: 0.08,
        landingImpulse: frame === 0 ? -0.4 : 0,
        reducedMotion: false,
        reset: false,
      });
    expect(states.every((state) => Number.isFinite(state.angle + state.velocity))).toBe(true);
    expect(Math.abs(states[5]?.angle ?? 0)).toBeGreaterThan(Math.abs(states[0]?.angle ?? 0));
    expect(states[5]?.angle).toBeLessThan(0);

    for (let frame = 0; frame < 240; frame++)
      stepHatSpringChain(states, 1 / 60, {
        excitation: 0,
        dashLean: 0,
        bodyAngle: 0,
        landingImpulse: 0,
        reducedMotion: true,
        reset: false,
      });
    expect(Math.max(...states.map((state) => Math.abs(state.angle)))).toBeLessThan(0.0001);
    stepHatSpringChain(states, 1 / 60, {
      excitation: 1,
      dashLean: 1,
      bodyAngle: 1,
      landingImpulse: 1,
      reducedMotion: false,
      reset: true,
    });
    expect(states).toEqual(Array.from({ length: 6 }, () => ({ angle: 0, velocity: 0 })));
  });
});

// METAGAME WAVE 6 — append-only synced-count tower composition coverage.
describe("public prestige tower composition", () => {
  it("treats the synced remote count exactly like owner-private prestige", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "ash-walker-hat" as GearId,
    } as Record<GearSlot, GearId>;
    const syncedRemotePrestige = 12;
    const remote = assembleGearLoadout(requireManifest(), loadout, syncedRemotePrestige);
    const owner = assembleGearLoadout(requireManifest(), loadout, syncedRemotePrestige);
    expect(remote).toMatchObject({ towerTotal: 13, towerVisible: 12, towerOverflow: 1 });
    expect(remote.parts.map((part) => [part.gearId, part.stackIndex])).toEqual(
      owner.parts.map((part) => [part.gearId, part.stackIndex]),
    );
    expect(remote.parts.every((part) => part.gearId === "ash-walker-hat")).toBe(true);
  });
});

// METAGAME WAVE 7B — append-only alternative-head texture seam coverage.
describe("loadout head texture seam", () => {
  it("defaults to the boilerplate head and accepts a future alternative without catalog coupling", () => {
    expect(resolveLoadoutHeadTexture()).toBe(DEFAULT_LOADOUT_HEAD_TEXTURE);
    expect(resolveLoadoutHeadTexture({ gearId: "", textureKey: "gear:head:empty" })).toBe(
      DEFAULT_LOADOUT_HEAD_TEXTURE,
    );
    expect(DEFAULT_LOADOUT_HEAD_TEXTURE).toEqual({
      gearId: null,
      textureKey: "boilerplate:head",
    });
    expect(
      resolveLoadoutHeadTexture({
        gearId: "future-knight-head",
        textureKey: "gear:alternative-head:future-knight-head",
        frame: "closed-oval",
      }),
    ).toEqual({
      gearId: "future-knight-head",
      textureKey: "gear:alternative-head:future-knight-head",
      frame: "closed-oval",
    });
  });
});

// v0.118 gear-layer live reproduction — append-only exact mixed-set loadout coverage.
describe("mixed-set eight-slot gear assembly", () => {
  it("places all eight equipped items into the body, hands, feet, and sprung-head groups", () => {
    const loadout = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      shirt: "pressurized-shirt",
      gloves: "house-edge-gloves",
      pants: "pressurized-pants",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    } as Record<GearSlot, GearId>;
    const assembly = assembleGearLoadout(requireManifest(), loadout);
    const groupForReceiver = (receiver: string): "body" | "hands" | "feet" | "head" => {
      if (receiver.startsWith("hand-")) return "hands";
      if (receiver.startsWith("foot-")) return "feet";
      if (receiver === "head" || receiver.startsWith("face.")) return "head";
      return "body";
    };
    const placedItems = new Map<GearId, Set<string>>();
    for (const part of assembly.parts) {
      const groups = placedItems.get(part.gearId) ?? new Set<string>();
      groups.add(groupForReceiver(part.source.receiver));
      placedItems.set(part.gearId, groups);
    }

    expect(placedItems.size).toBe(8);
    expect(
      Object.fromEntries([...placedItems].map(([gearId, groups]) => [gearId, [...groups].sort()])),
    ).toEqual({
      "thornwatch-cloak": ["body"],
      "house-edge-boots": ["feet"],
      "house-edge-gloves": ["hands"],
      "pressurized-pants": ["body"],
      "pressurized-shirt": ["body"],
      "pressurized-facial-hair": ["head"],
      "pressurized-glasses": ["head"],
      "coldsnap-hat": ["head"],
    });
    // Paired gloves and boots expand the eight equipped items into ten retained render parts.
    expect(assembly.parts).toHaveLength(10);
    expect(new Set(assembly.parts.map((part) => groupForReceiver(part.source.receiver)))).toEqual(
      new Set(["body", "hands", "feet", "head"]),
    );
  });
});

// v0.118 gear-layer bounds diagnostics — append-only loaded-texture mismatch coverage.
describe("retained gear frame diagnostics", () => {
  it("names a loaded mismatched item, clips its frame, and preserves its manifest pivot", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      shirt: "pressurized-shirt" as GearId,
    } as Record<GearSlot, GearId>;
    const part = assembleGearLoadout(requireManifest(), loadout).parts.find(
      (candidate) => candidate.gearId === "pressurized-shirt",
    );
    if (!part) throw new Error("Boiler Shirt did not assemble");

    const frames = new Map<
      string,
      { cutX: number; cutY: number; cutWidth: number; cutHeight: number }
    >();
    const texture = {
      source: [{ width: 500, height: 500 }],
      has: (name: string) => frames.has(name),
      add: (
        name: string,
        _sourceIndex: number,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => {
        const frame = { cutX: x, cutY: y, cutWidth: width, cutHeight: height };
        frames.set(name, frame);
        return frame;
      },
      get: (name: string) => frames.get(name),
    };
    const scene = {
      textures: {
        exists: () => true,
        get: () => texture,
      },
    } as unknown as Parameters<typeof ensureGearPartFrame>[0];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(ensureGearPartFrame(scene, part)).toBe("part:torso-panel");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"pressurized-shirt"'));
    expect(frames.get("part:torso-panel")).toEqual({
      cutX: 401,
      cutY: 365,
      cutWidth: 99,
      cutHeight: 135,
    });
    expect(part.originX).toBeCloseTo((part.source.pivotSource.x - 401) / 99, 10);
    expect(part.originY).toBeCloseTo((part.source.pivotSource.y - 365) / 135, 10);
    warn.mockRestore();
  });
});

function replacementManifest(): GearPartsManifest {
  const candidate = structuredClone(rawManifest) as GearPartsManifest;
  candidate.schemaVersion = 2;
  candidate.replacementContract = {
    id: "GEAR_REPLACEMENT_V1",
    revision: "test-art-r1",
    partFrames: {
      body: [344, 324, 336, 376],
      head: [352, 112, 384, 456],
      "hand-l": [294, 432, 180, 180],
      "hand-r": [550, 432, 180, 180],
      "foot-l": [353, 641, 190, 190],
      "foot-r": [481, 641, 190, 190],
    },
    maskHashes: {
      bodyFill: "body-fill",
      shirtRequired: "shirt-required",
      shirtAllowed: "shirt-allowed",
      pantsRequired: "pants-required",
      pantsAllowed: "pants-allowed",
    },
    compositionOrders: {
      body: ["body", "pants", "shirt"],
      head: ["head", "facialHair", "glasses"],
    },
  };
  const roleForSlot = {
    boots: "replace-foot",
    cloak: "cloak-far",
    facialHair: "head-accessory",
    glasses: "head-accessory",
    gloves: "replace-hand",
    hat: "overlay-hat",
    pants: "body-patch",
    shirt: "body-patch",
  } as const;
  for (const slot of candidate.slots) {
    for (const item of slot.items) {
      item.renderRole =
        item.id === "demon-mask-hat" || item.id === "unbending-hat"
          ? "replace-head"
          : roleForSlot[slot.id];
      item.sourceRevision = `source:${item.id}`;
      for (const part of item.parts) part.sourceRevision = `source:${item.id}:${part.id}`;
      if (item.renderRole === "replace-head") {
        item.replacementTexture = {
          texture: `${item.id}.png`,
          sourceRevision: `head:${item.id}`,
        };
      }
    }
  }
  const validated = validateGearPartsManifest(candidate);
  if (!validated) throw new Error("synthetic replacement manifest failed validation");
  return validated;
}

// GEAR REPLACEMENT BOT 3 — append-only recipe, fallback, and dual-role routing coverage.
describe("replacement-contract recipe routing", () => {
  it("routes garments into six ordered recipes and leaves only cloak/hats in visible extras", () => {
    const v2 = replacementManifest();
    expect(isGearReplacementManifest(v2)).toBe(true);
    const loadout = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      shirt: "pressurized-shirt",
      gloves: "house-edge-gloves",
      pants: "pressurized-pants",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    } as Record<GearSlot, GearId>;
    const resolved = resolveGearBakeLoadout(v2, loadout, 2);

    expect(resolved.recipe.parts.body.layers.map((layer) => layer.role)).toEqual([
      "base",
      "pants",
      "shirt",
    ]);
    expect(resolved.recipe.parts.head.layers.map((layer) => layer.role)).toEqual([
      "base",
      "facialHair",
      "glasses",
    ]);
    expect(resolved.recipe.parts["hand-l"].layers.map((layer) => layer.role)).toEqual(["glove"]);
    expect(resolved.recipe.parts["foot-r"].layers.map((layer) => layer.role)).toEqual(["boot"]);
    expect(resolved.extras.parts.map((part) => part.slot)).toEqual(["cloak", "hat", "hat", "hat"]);
    expect(
      resolved.extras.parts.some((part) =>
        ["shirt", "pants", "gloves", "boots", "glasses", "facialHair"].includes(part.slot),
      ),
    ).toBe(false);
    expect(resolved.extras).toMatchObject({
      towerTotal: 3,
      towerVisible: 3,
      towerOverflow: 0,
      replacementHeadPosition: false,
    });
  });

  it("falls back every missing nonblank role to six nonempty base-backed recipes", () => {
    const v2 = replacementManifest();
    const loadout = {
      hat: "coldsnap-hat",
      glasses: "pressurized-glasses",
      facialHair: "pressurized-facial-hair",
      shirt: "pressurized-shirt",
      gloves: "house-edge-gloves",
      pants: "pressurized-pants",
      boots: "house-edge-boots",
      cloak: "thornwatch-cloak",
    } as Record<GearSlot, GearId>;
    const resolved = resolveGearBakeLoadout(v2, loadout, 30, [], (dependency) =>
      dependency.gearId ? "missing" : "ready",
    );

    expect(Object.values(resolved.recipe.parts)).toHaveLength(6);
    expect(Object.values(resolved.recipe.parts).every((part) => part.key.length > 0)).toBe(true);
    expect(resolved.recipe.parts.body.layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.parts.head.layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.parts["hand-l"].layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.parts["hand-r"].layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.parts["foot-l"].layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.parts["foot-r"].layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.extras.parts).toHaveLength(0);
    expect(resolved.extras).toMatchObject({ towerTotal: 0, towerVisible: 0, towerOverflow: 0 });
    expect(new Set(resolved.recipe.diagnostics.map((row) => row.slot))).toEqual(
      new Set(["shirt", "pants", "gloves", "boots", "glasses", "facialHair", "cloak", "hat"]),
    );
  });

  it("falls back one paired component independently and composes accessories onto a missing head fallback", () => {
    const v2 = replacementManifest();
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "demon-mask-hat" as GearId,
      glasses: "pressurized-glasses" as GearId,
      facialHair: "pressurized-facial-hair" as GearId,
      gloves: "house-edge-gloves" as GearId,
      boots: "house-edge-boots" as GearId,
    } as Record<GearSlot, GearId>;
    const resolved = resolveGearBakeLoadout(v2, loadout, 1, [], (dependency) => {
      if (dependency.role === "replacement-head") return "missing";
      if (dependency.sourceRevision.endsWith(":glove-l")) return "missing";
      if (dependency.sourceRevision.endsWith(":boot-r")) return "missing";
      return "ready";
    });

    expect(resolved.recipe.parts.head.layers.map((layer) => layer.role)).toEqual([
      "base",
      "facialHair",
      "glasses",
    ]);
    expect(resolved.recipe.parts["hand-l"].layers[0]?.role).toBe("base");
    expect(resolved.recipe.parts["hand-r"].layers[0]?.role).toBe("glove");
    expect(resolved.recipe.parts["foot-l"].layers[0]?.role).toBe("boot");
    expect(resolved.recipe.parts["foot-r"].layers[0]?.role).toBe("base");
  });
});

describe("replacement-head tower contract", () => {
  it("uses the existing head seam, reserves position zero, and stacks at most eleven legal caps", () => {
    const v2 = replacementManifest();
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      hat: "demon-mask-hat" as GearId,
      glasses: "pressurized-glasses" as GearId,
      facialHair: "pressurized-facial-hair" as GearId,
    } as Record<GearSlot, GearId>;
    const zero = resolveGearBakeLoadout(v2, loadout, 0);
    const max = resolveGearBakeLoadout(v2, loadout, 30, [
      "demon-mask-hat" as GearId,
      "coldsnap-hat" as GearId,
    ]);

    expect(resolveLoadoutHeadTexture(v2, loadout, () => true)).toEqual({
      gearId: "demon-mask-hat",
      textureKey: "gear:replacement-head:demon-mask-hat",
    });
    expect(resolveLoadoutHeadTexture(v2, loadout)).toBe(DEFAULT_LOADOUT_HEAD_TEXTURE);
    expect(zero.recipe.parts.head.layers.map((layer) => layer.role)).toEqual([
      "replacement-head",
      "facialHair",
      "glasses",
    ]);
    expect(zero.extras).toMatchObject({
      towerTotal: 1,
      towerVisible: 1,
      towerOverflow: 0,
      replacementHeadPosition: true,
    });
    expect(zero.extras.hats).toHaveLength(0);
    expect(max.extras).toMatchObject({ towerTotal: 30, towerVisible: 12, towerOverflow: 18 });
    expect(max.extras.hats).toHaveLength(11);
    expect(max.extras.hats[0]?.gearId).toBe("demon-mask-hat");
    expect(max.extras.hats[1]?.gearId).toBe("coldsnap-hat");
    expect(max.extras.hats.map((part) => part.extraRole)).toContain("prestige-cap");
    expect(max.extras.parts.every((part) => part.extraRole !== undefined)).toBe(true);
  });

  it("pins both replacement ids at prestige 0, 1, 11, and 30", () => {
    const v2 = replacementManifest();
    for (const hat of ["demon-mask-hat", "unbending-hat"] as const) {
      const loadout = { ...STARTER_GEAR_LOADOUT, hat } as Record<GearSlot, GearId>;
      const samples = [0, 1, 11, 30].map((prestige) =>
        resolveGearBakeLoadout(v2, loadout, prestige),
      );
      expect(samples.map((sample) => sample.extras.towerTotal)).toEqual([1, 2, 12, 30]);
      expect(samples.map((sample) => sample.extras.towerVisible)).toEqual([1, 2, 12, 12]);
      expect(samples.map((sample) => sample.extras.towerOverflow)).toEqual([0, 0, 0, 18]);
      expect(samples.map((sample) => sample.extras.hats.length)).toEqual([0, 1, 11, 11]);
      expect(
        samples.every((sample) =>
          sample.extras.hats.every((part) => part.extraRole === "prestige-cap"),
        ),
      ).toBe(true);
    }
  });
});
