import { type GearId, type GearSlot, STARTER_GEAR_LOADOUT } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  replacementPairManifest,
  replacementPairManifestInput,
} from "./gear-pairs.test-fixture.js";
import {
  assembleBoilerplate,
  assembleGearLoadout,
  DEFAULT_LOADOUT_HEAD_TEXTURE,
  type GearPartsManifest,
  hatStackScale,
  hatTowerTotal,
  headRiderSourcePlacement,
  isGearReplacementManifest,
  resolveGearBakeLoadout,
  resolveLoadoutHeadTexture,
  stepHatSpringChain,
  validateGearPartsManifest,
} from "./gear-parts.js";

const rawManifest = replacementPairManifestInput("gear-parts-test-r1");
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
      hat: "molten-core-hat" as GearId,
    } as Record<GearSlot, GearId>;
    const assembly = assembleGearLoadout(requireManifest(), loadout, 2);
    expect(assembly).toMatchObject({ towerTotal: 3, towerVisible: 3, towerOverflow: 0 });
    expect(assembly.parts).toHaveLength(3);
    for (let index = 0; index < assembly.parts.length; index++) {
      const part = assembly.parts[index];
      expect(part?.source.receiver).toBe("head");
      expect(part?.x).toBeCloseTo(0, 10);
      expect(part?.y).toBeCloseTo(-0.38 * 76, 10);
      expect(part?.depth).toBe(part?.source.plane);
      expect(part?.stackIndex).toBe(index);
      expect(part?.topSocketSource).not.toBeNull();
    }
  });

  it("keeps paired hand/foot replacement components independently addressable", () => {
    const value = requireManifest();
    for (const [slotId, expectedReceivers] of [
      ["gloves", ["hand-l", "hand-r"]],
      ["boots", ["foot-l", "foot-r"]],
    ] as const) {
      const item = value.slots.find((slot) => slot.id === slotId)?.items[0];
      expect(item?.parts.map((part) => part.receiver).sort()).toEqual(
        [...expectedReceivers].sort(),
      );
      expect(new Set(item?.parts.map((part) => part.sourceRevision)).size).toBe(2);
      for (const part of item?.parts ?? []) {
        expect(part.alphaBounds.width).toBeLessThan(item?.image.width ?? 0);
        expect(part.alphaBounds.height).toBeLessThan(item?.image.height ?? 0);
      }
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
      hat: "molten-core-hat" as GearId,
    } as Record<GearSlot, GearId>;
    const syncedRemotePrestige = 12;
    const remote = assembleGearLoadout(requireManifest(), loadout, syncedRemotePrestige);
    const owner = assembleGearLoadout(requireManifest(), loadout, syncedRemotePrestige);
    expect(remote).toMatchObject({ towerTotal: 13, towerVisible: 12, towerOverflow: 1 });
    expect(remote.parts.map((part) => [part.gearId, part.stackIndex])).toEqual(
      owner.parts.map((part) => [part.gearId, part.stackIndex]),
    );
    expect(remote.parts.every((part) => part.gearId === "molten-core-hat")).toBe(true);
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
  it("routes all eight equipped items into six bakes plus cloak and hat extras", () => {
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
    const resolved = resolveGearBakeLoadout(requireManifest(), loadout);
    const routedIds = new Set([
      ...resolved.dependencies.flatMap((dependency) =>
        dependency.gearId ? [dependency.gearId] : [],
      ),
      ...resolved.extras.parts.map((part) => part.gearId),
    ]);
    expect(routedIds).toEqual(new Set(Object.values(loadout)));
    expect(resolved.recipe.parts.body.layers.map((layer) => layer.role)).toEqual([
      "replacement-torso",
    ]);
    expect(resolved.recipe.parts.head.layers.map((layer) => layer.role)).toEqual([
      "replacement-head",
      "facialHair",
      "glasses",
    ]);
    expect(resolved.extras.parts.map((part) => part.slot)).toEqual(["cloak", "hat"]);
  });
});

// v0.118 gear-layer bounds diagnostics — append-only loaded-texture mismatch coverage.
describe("retained gear frame diagnostics", () => {
  it("names a missing full-torso render and keeps the bare torso as the visible fallback", () => {
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      torso: "pressurized-shirt" as GearId,
    } as Record<GearSlot, GearId>;
    const resolved = resolveGearBakeLoadout(requireManifest(), loadout, 0, [], (dependency) =>
      dependency.gearId === "pressurized-shirt" ? "missing" : "ready",
    );
    expect(resolved.recipe.parts.body.layers.map((layer) => layer.role)).toEqual(["base"]);
    expect(resolved.recipe.diagnostics).toContainEqual(
      expect.objectContaining({ slot: "torso", gearId: "pressurized-shirt" }),
    );
    expect(resolved.recipe.diagnostics[0]?.message).toContain('"pressurized-shirt"');
  });
});

// GEAR REPLACEMENT BOT 3 — append-only recipe, fallback, and dual-role routing coverage.
describe("replacement-contract recipe routing", () => {
  it("routes garments into six ordered recipes and leaves only cloak/hats in visible extras", () => {
    const v2 = replacementPairManifest("test-art-r1");
    expect(isGearReplacementManifest(v2)).toBe(true);
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
    const resolved = resolveGearBakeLoadout(v2, loadout, 2);

    expect(resolved.recipe.parts.body.layers.map((layer) => layer.role)).toEqual([
      "replacement-torso",
    ]);
    expect(resolved.recipe.parts.head.layers.map((layer) => layer.role)).toEqual([
      "replacement-head",
      "facialHair",
      "glasses",
    ]);
    expect(resolved.recipe.parts["hand-l"].layers.map((layer) => layer.role)).toEqual(["glove"]);
    expect(resolved.recipe.parts["foot-r"].layers.map((layer) => layer.role)).toEqual(["boot"]);
    expect(resolved.extras.parts.map((part) => part.slot)).toEqual(["cloak", "hat", "hat", "hat"]);
    expect(
      resolved.extras.parts.some((part) =>
        ["torso", "head", "gloves", "boots", "glasses", "facialHair"].includes(part.slot),
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
    const v2 = replacementPairManifest("test-art-r1");
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
      new Set(["torso", "head", "gloves", "boots", "glasses", "facialHair", "cloak", "hat"]),
    );
  });

  it("falls back one paired component independently and composes accessories onto a missing head fallback", () => {
    const v2 = replacementPairManifest("test-art-r1");
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      head: "demon-mask-head" as GearId,
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

describe("independent replacement-head and hat-tower contract", () => {
  it("bakes the head slot without consuming any of the twelve visible hat positions", () => {
    const v2 = replacementPairManifest("test-art-r1");
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      head: "demon-mask-head" as GearId,
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
      gearId: "demon-mask-head",
      textureKey: "gear:head:demon-mask-head",
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
      replacementHeadPosition: false,
    });
    expect(zero.extras.hats).toHaveLength(1);
    expect(max.extras).toMatchObject({ towerTotal: 30, towerVisible: 12, towerOverflow: 18 });
    expect(max.extras.hats).toHaveLength(12);
    expect(max.extras.hats[0]?.gearId).toBe("demon-mask-hat");
    expect(max.extras.hats[1]?.gearId).toBe("coldsnap-hat");
    expect(max.extras.hats.every((part) => part.extraRole === "overlay-hat")).toBe(true);
    expect(max.extras.parts.every((part) => part.extraRole !== undefined)).toBe(true);
  });

  it("pins both former helmet identities as heads while their hats use normal tower math", () => {
    const v2 = replacementPairManifest("test-art-r1");
    for (const setId of ["demon-mask", "unbending"] as const) {
      const loadout = {
        ...STARTER_GEAR_LOADOUT,
        head: `${setId}-head`,
        hat: `${setId}-hat`,
      } as Record<GearSlot, GearId>;
      const samples = [0, 1, 11, 30].map((prestige) =>
        resolveGearBakeLoadout(v2, loadout, prestige),
      );
      expect(samples.map((sample) => sample.extras.towerTotal)).toEqual([1, 2, 12, 30]);
      expect(samples.map((sample) => sample.extras.towerVisible)).toEqual([1, 2, 12, 12]);
      expect(samples.map((sample) => sample.extras.towerOverflow)).toEqual([0, 0, 0, 18]);
      expect(samples.map((sample) => sample.extras.hats.length)).toEqual([1, 2, 12, 12]);
      expect(
        samples.every((sample) =>
          sample.extras.hats.every((part) => part.extraRole === "overlay-hat"),
        ),
      ).toBe(true);
    }
  });
});

// HEAD-FIT PANEL — append-only proof that source-space socket correction survives the signed head scale.
describe("per-head face-rider source placement", () => {
  it("lands Ash Walker eyes and mouth within tolerance at 0.85 scale in both facings", () => {
    const v2 = replacementPairManifest("head-fit-panel-r1");
    const loadout = {
      ...STARTER_GEAR_LOADOUT,
      head: "ash-walker-head" as GearId,
      glasses: "ash-walker-glasses" as GearId,
      facialHair: "ash-walker-facial-hair" as GearId,
    } as Record<GearSlot, GearId>;
    const headLayers = resolveGearBakeLoadout(v2, loadout).recipe.parts.head.layers;
    const glasses = headLayers.find((layer) => layer.role === "glasses");
    const facialHair = headLayers.find((layer) => layer.role === "facialHair");
    expect(glasses?.offsetX).toBeCloseTo(127.05, 8);
    expect(glasses?.offsetY).toBeCloseTo(-126.17, 8);
    expect(facialHair?.offsetX).toBeCloseTo(113, 8);
    expect(facialHair?.offsetY).toBeCloseTo(-68, 8);

    const cases = [
      {
        layer: glasses,
        placement: headRiderSourcePlacement("ash-walker-head", "face.eyes", { x: 553, y: 364 }),
      },
      {
        layer: facialHair,
        placement: headRiderSourcePlacement("ash-walker-head", "face.mouth", { x: 568, y: 410 }),
      },
    ];
    const mountedScale = (76 / 512) * 0.85;
    for (const facing of [1, -1] as const) {
      for (const { layer, placement } of cases) {
        if (!layer) throw new Error("face rider layer did not resolve");
        const actual = {
          x: (placement.authoringSource.x + (layer.offsetX ?? 0) - 512) * mountedScale * facing,
          y: (placement.authoringSource.y + (layer.offsetY ?? 0) - 300) * mountedScale,
        };
        const expected = {
          x: (placement.targetSource.x - 512) * mountedScale * facing,
          y: (placement.targetSource.y - 300) * mountedScale,
        };
        expect(Math.hypot(actual.x - expected.x, actual.y - expected.y)).toBeLessThanOrEqual(0.01);
      }
    }
  });
});
