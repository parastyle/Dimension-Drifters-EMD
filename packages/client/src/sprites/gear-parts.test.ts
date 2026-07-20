import {
  GEAR_CATALOG,
  GEAR_IDS,
  type GearId,
  type GearSlot,
  STARTER_GEAR_LOADOUT,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  replacementPairManifest,
  replacementPairManifestInput,
} from "./gear-pairs.test-fixture.js";
import {
  assembleBoilerplate,
  assembleGearLoadout,
  boundsDerivedRigSockets,
  DEFAULT_LOADOUT_HEAD_TEXTURE,
  FOOT_SOCKET_MAX_DEVIATION_SOURCE,
  GEAR_PARTS_MANIFEST,
  type GearPartsManifest,
  gearClickVisibility,
  gearClickVisibilityNotice,
  gearManifestItem,
  HAND_SOCKET_MAX_DEVIATION_SOURCE,
  HEAD_SOCKET_MAX_DEVIATION_SOURCE,
  HEAD_TARGET_SCALE,
  HEAD_WIDTH_ENVELOPE,
  hatStackScale,
  hatTowerTotal,
  headRiderSourcePlacement,
  headScaleNormalization,
  isGearReplacementManifest,
  resolveGearBakeLoadout,
  resolveLoadoutHeadTexture,
  stepHatSpringChain,
  TORSO_CORE_HEIGHT_CAP,
  TORSO_NORMALIZATION_MAX,
  TORSO_NORMALIZATION_MIN,
  torsoScaleNormalization,
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

// HEAD SIZE NORMALIZATION — append-only coverage for the manifest-driven replacement-head fleet.
describe("manifest-driven replacement-head scale", () => {
  it("keeps every installed head within the owner-nudged base alpha band and wide-mask envelope", () => {
    const v2 = replacementPairManifest("head-normalization-r1");
    const base = v2.boilerplate.parts.find((part) => part.id === "head");
    const heads = v2.slots.find((slot) => slot.id === "head")?.items ?? [];
    if (!base || heads.length === 0) throw new Error("head normalization fixture is incomplete");
    const baseEffectiveHeight = base.alphaBounds.height * base.mountScale;
    const baseEffectiveWidth = base.alphaBounds.width * base.mountScale;

    for (const item of heads) {
      if (!GEAR_CATALOG[item.id as GearId]) continue;
      const normalized = headScaleNormalization(v2, item.id as GearId);
      const effectiveHeight = normalized.headHeight * normalized.mountScale;
      const effectiveWidth = normalized.headWidth * normalized.mountScale;
      expect(effectiveHeight / baseEffectiveHeight, item.id).toBeGreaterThanOrEqual(0.94);
      expect(effectiveHeight / baseEffectiveHeight, item.id).toBeLessThanOrEqual(
        HEAD_TARGET_SCALE + 0.000001,
      );
      expect(effectiveWidth / baseEffectiveWidth, item.id).toBeLessThanOrEqual(
        HEAD_WIDTH_ENVELOPE * HEAD_TARGET_SCALE + 0.000001,
      );
    }
  });

  it("automatically normalizes all five reclassified cowl heads from their manifest alpha bounds", () => {
    const v2 = replacementPairManifest("cowl-head-normalization-r1");
    const baseScale = v2.boilerplate.parts.find((part) => part.id === "head")?.mountScale;
    if (!baseScale) throw new Error("base head scale is unavailable");
    for (const id of [
      "ash-walker-hat",
      "ashen-crusader-hat",
      "thornwatch-hat",
      "neon-mirage-hat",
      "pressurized-hat",
    ] as const) {
      const item = gearManifestItem(v2, id);
      expect(item?.parts[0]?.alphaBounds.height, id).toBeGreaterThan(0);
      const normalized = headScaleNormalization(v2, id);
      expect(normalized.gearId, id).toBe(id);
      expect(normalized.mountScale, id).toBeLessThan(baseScale);
    }
  });

  it("uses the normalized scale for every per-head face receiver in both facings", () => {
    const v2 = replacementPairManifest("head-rider-normalization-r1");
    const heads = v2.slots.find((slot) => slot.id === "head")?.items ?? [];
    const baseReceivers = GEAR_CATALOG["blank-drifter-head"].faceReceivers;
    const pivot = { x: 512, y: 300 };
    for (const item of heads) {
      const id = item.id as GearId;
      if (!GEAR_CATALOG[id]) continue;
      const effectiveScale =
        (76 / v2.socketFrame.bodyHeightL) * headScaleNormalization(v2, id).mountScale;
      for (const [receiver, authoringSource] of [
        ["face.eyes", baseReceivers.eyes],
        ["face.mouth", baseReceivers.mouth],
      ] as const) {
        const placement = headRiderSourcePlacement(id, receiver, authoringSource);
        for (const facing of [1, -1] as const) {
          const actualX =
            (authoringSource.x + placement.offset.x - pivot.x) * effectiveScale * facing;
          const actualY = (authoringSource.y + placement.offset.y - pivot.y) * effectiveScale;
          const expectedX = (placement.targetSource.x - pivot.x) * effectiveScale * facing;
          const expectedY = (placement.targetSource.y - pivot.y) * effectiveScale;
          expect(
            Math.hypot(actualX - expectedX, actualY - expectedY),
            `${item.id}:${receiver}`,
          ).toBeLessThanOrEqual(0.01);
        }
      }
    }
  });

  it("keeps the hat band at base scale on the widest and narrowest installed heads", () => {
    const v2 = replacementPairManifest("head-hat-band-r1");
    const rigScale = 76 / v2.socketFrame.bodyHeightL;
    for (const [head, hat] of [
      ["coldsnap-head", "coldsnap-hat"],
      ["unbending-head", "unbending-hat"],
    ] as const) {
      const resolved = resolveGearBakeLoadout(v2, {
        ...STARTER_GEAR_LOADOUT,
        head,
        hat,
      });
      const firstHat = resolved.extras.hats[0];
      if (!firstHat) throw new Error(`${head} did not resolve its hat`);
      const renderedHeadScale = rigScale * resolved.extras.headMountScale;
      const guardedHatScale =
        (renderedHeadScale / resolved.extras.headMountScale) *
        firstHat.source.mountScale *
        firstHat.stackScale;
      expect(guardedHatScale, head).toBeCloseTo(
        rigScale * firstHat.source.mountScale * firstHat.stackScale,
        10,
      );
      expect(firstHat.x, head).toBeCloseTo(firstHat.source.receiverAnchor.xL * 76, 10);
      expect(firstHat.y, head).toBeCloseTo(firstHat.source.receiverAnchor.yL * 76, 10);
      expect(firstHat.topSocketSource, head).not.toBeNull();
    }
  });
});

// ARMORY CLICK VISIBILITY — append-only catalog-wide classification and named fallback coverage.
describe("gear catalog click visibility", () => {
  it("classifies every catalog id into an explicit click outcome", () => {
    expect(GEAR_PARTS_MANIFEST).not.toBeNull();
    const rows = GEAR_IDS.map((id) => [id, gearClickVisibility(GEAR_PARTS_MANIFEST, id)] as const);
    expect(rows).toHaveLength(GEAR_IDS.length);
    expect(new Set(rows.map(([id]) => id)).size).toBe(GEAR_IDS.length);
    for (const [id, state] of rows) {
      expect(["installed", "art-rendering", "invalid-art", "intentionally-artless"], id).toContain(
        state,
      );
      if (state === "installed")
        expect(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, id)).toBeNull();
      else
        expect(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, id), id).toContain(
          GEAR_CATALOG[id].name.toUpperCase(),
        );
    }
  });

  it("distinguishes intentional blanks, invalid boots, and pending reader art", () => {
    for (const id of GEAR_IDS.filter((candidate) => candidate.startsWith("blank-drifter-"))) {
      expect(gearClickVisibility(GEAR_PARTS_MANIFEST, id), id).toBe("intentionally-artless");
      expect(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, id), id).toContain(
        "INTENTIONALLY ARTLESS",
      );
    }
    for (const id of ["thornwatch-boots", "unbending-boots"] as const) {
      expect(gearClickVisibility(GEAR_PARTS_MANIFEST, id), id).toBe("invalid-art");
      expect(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, id), id).toContain("BASE SHOWN");
    }
    for (const id of ["brass-readers", "loaded-readers", "lucky-readers"] as const) {
      expect(gearClickVisibility(GEAR_PARTS_MANIFEST, id), id).toBe("art-rendering");
      expect(gearClickVisibilityNotice(GEAR_PARTS_MANIFEST, id), id).toContain("ART RENDERING");
    }
  });

  it("lets each reclassified cowl advance from rendering to installed solely by landing a manifest row", () => {
    for (const id of [
      "ash-walker-hat",
      "ashen-crusader-hat",
      "thornwatch-hat",
      "neon-mirage-hat",
      "pressurized-hat",
    ] as const) {
      const state = gearClickVisibility(GEAR_PARTS_MANIFEST, id);
      expect(["art-rendering", "installed"], id).toContain(state);
      expect(state === "installed", id).toBe(
        Boolean(GEAR_PARTS_MANIFEST && gearManifestItem(GEAR_PARTS_MANIFEST, id)),
      );
    }
  });
});

// BOUNDS-ANCHOR RIG — append-only catalog-wide torso normalization and socket authority coverage.
describe("alpha-normalized torso family and bounds-derived rig sockets", () => {
  const sourcePoint = (
    v2: GearPartsManifest,
    id: "head" | "hand-l" | "hand-r" | "foot-l" | "foot-r",
  ) => {
    const raw = v2.boilerplate.parts.find((part) => part.id === id)?.receiverAnchor.raw;
    if (!raw) throw new Error(`missing boilerplate ${id} receiver`);
    return raw;
  };

  it("normalizes all 12 torso core masses into one measured band while retaining ornate overhang", () => {
    const v2 = replacementPairManifest("torso-normalization-r1");
    const base = v2.boilerplate.parts.find((part) => part.id === "body");
    const installedTorsoIds = new Set(
      GEAR_PARTS_MANIFEST?.slots
        .find((slot) => slot.id === "torso")
        ?.items.filter((item) => item.renderRole === "replace-torso")
        .map((item) => item.id) ?? [],
    );
    const torsos =
      v2.slots
        .find((slot) => slot.id === "torso")
        ?.items.filter((item) => installedTorsoIds.has(item.id)) ?? [];
    if (!base) throw new Error("base torso measurement missing");
    expect(torsos).toHaveLength(12);
    const baseEffectiveHeight = base.alphaBounds.height * base.mountScale;
    const baseEffectiveWidth = base.alphaBounds.width * base.mountScale;

    for (const item of torsos) {
      const id = item.id as GearId;
      const normalized = torsoScaleNormalization(v2, id);
      const coreRatio = (normalized.coreHeight * normalized.mountScale) / baseEffectiveHeight;
      const fullHeightRatio = normalized.effectiveBounds.height / baseEffectiveHeight;
      const widthRatio = normalized.effectiveBounds.width / baseEffectiveWidth;
      expect(normalized.gearId, id).toBe(id);
      expect(normalized.factor, id).toBeGreaterThanOrEqual(TORSO_NORMALIZATION_MIN);
      expect(normalized.factor, id).toBeLessThanOrEqual(TORSO_NORMALIZATION_MAX);
      expect(coreRatio, id).toBeGreaterThanOrEqual(0.999999);
      expect(coreRatio, id).toBeLessThanOrEqual(1.000001);
      expect(fullHeightRatio, id).toBeGreaterThanOrEqual(0.999999);
      expect(fullHeightRatio, id).toBeLessThanOrEqual(TORSO_CORE_HEIGHT_CAP + 0.01);
      expect(widthRatio, id).toBeGreaterThanOrEqual(0.7);
      expect(widthRatio, id).toBeLessThanOrEqual(1.03);

      const resolved = resolveGearBakeLoadout(v2, { ...STARTER_GEAR_LOADOUT, torso: id });
      expect(resolved.extras.torsoMountScale, id).toBeCloseTo(normalized.mountScale, 12);
      expect(resolved.recipe.parts.body.layers[0]?.bakeTransform?.scale, id).toBeCloseTo(
        normalized.mountScale,
        12,
      );
    }
  });

  it("keeps the naked drifter's five receiver points and zero-origin bake path exactly unchanged", () => {
    const v2 = replacementPairManifest("base-pixel-identity-r1");
    const resolved = resolveGearBakeLoadout(v2, STARTER_GEAR_LOADOUT);
    const sockets = resolved.extras.rigSockets;
    expect(torsoScaleNormalization(v2, null).mountScale).toBe(1);
    for (const id of ["head", "hand-l", "hand-r", "foot-l", "foot-r"] as const)
      expect(sockets[id], id).toEqual(sourcePoint(v2, id));
    for (const recipe of Object.values(resolved.recipe.parts)) {
      expect(recipe.layers).toHaveLength(1);
      expect(recipe.layers[0]?.role).toBe("base");
      expect(recipe.layers[0]?.bakeTransform).toBeUndefined();
      expect(recipe.layers[0]?.offsetX).toBeUndefined();
      expect(recipe.layers[0]?.offsetY).toBeUndefined();
    }
  });

  it("holds the head/top and foot/hem gaps across all 12 torsos while hands obey weapon-safe caps", () => {
    const v2 = replacementPairManifest("socket-invariants-r1");
    const baseSockets = boundsDerivedRigSockets(v2, null);
    const legacyHead = sourcePoint(v2, "head");
    const legacyLeftHand = sourcePoint(v2, "hand-l");
    const legacyRightHand = sourcePoint(v2, "hand-r");
    const legacyLeftFoot = sourcePoint(v2, "foot-l");
    const legacyRightFoot = sourcePoint(v2, "foot-r");
    const baseHeadGap = baseSockets.torsoBounds.top - legacyHead.y;
    const baseFootGap = legacyLeftFoot.y - baseSockets.torsoBounds.bottom;
    const installedTorsoIds = new Set(
      GEAR_PARTS_MANIFEST?.slots
        .find((slot) => slot.id === "torso")
        ?.items.filter((item) => item.renderRole === "replace-torso")
        .map((item) => item.id) ?? [],
    );
    const torsos =
      v2.slots
        .find((slot) => slot.id === "torso")
        ?.items.filter((item) => installedTorsoIds.has(item.id)) ?? [];
    expect(torsos).toHaveLength(12);

    for (const item of torsos) {
      const sockets = boundsDerivedRigSockets(v2, item.id as GearId);
      expect(sockets.torsoBounds.top - sockets.head.y, `${item.id}:head-gap`).toBeCloseTo(
        baseHeadGap,
        10,
      );
      expect(
        sockets["foot-l"].y - sockets.torsoBounds.bottom,
        `${item.id}:left-foot-gap`,
      ).toBeCloseTo(baseFootGap, 10);
      expect(
        sockets["foot-r"].y - sockets.torsoBounds.bottom,
        `${item.id}:right-foot-gap`,
      ).toBeCloseTo(baseFootGap, 10);
      for (const [id, legacy] of [
        ["hand-l", legacyLeftHand],
        ["hand-r", legacyRightHand],
      ] as const) {
        expect(Math.abs(sockets[id].x - legacy.x), `${item.id}:${id}:x`).toBeLessThanOrEqual(
          HAND_SOCKET_MAX_DEVIATION_SOURCE.x,
        );
        expect(Math.abs(sockets[id].y - legacy.y), `${item.id}:${id}:y`).toBeLessThanOrEqual(
          HAND_SOCKET_MAX_DEVIATION_SOURCE.y,
        );
      }
      expect(Math.abs(sockets.head.x - legacyHead.x), `${item.id}:head-x`).toBeLessThanOrEqual(
        HEAD_SOCKET_MAX_DEVIATION_SOURCE.x,
      );
      for (const [id, legacy] of [
        ["foot-l", legacyLeftFoot],
        ["foot-r", legacyRightFoot],
      ] as const) {
        expect(Math.abs(sockets[id].x - legacy.x), `${item.id}:${id}:x`).toBeLessThanOrEqual(
          FOOT_SOCKET_MAX_DEVIATION_SOURCE.x,
        );
        expect(Math.abs(sockets[id].y - legacy.y), `${item.id}:${id}:y`).toBeLessThanOrEqual(
          FOOT_SOCKET_MAX_DEVIATION_SOURCE.y,
        );
      }
    }
  });

  it("keeps all 17 nudged heads on face riders while hats remain on the base authoring band", () => {
    const v2 = replacementPairManifest("all-head-riders-hats-r1");
    const heads = v2.slots.find((slot) => slot.id === "head")?.items ?? [];
    const base = v2.boilerplate.parts.find((part) => part.id === "head");
    if (!base) throw new Error("base head missing");
    expect(heads).toHaveLength(17);
    const rigScale = 76 / v2.socketFrame.bodyHeightL;

    for (const item of heads) {
      const id = item.id as GearId;
      const normalized = headScaleNormalization(v2, id);
      const heightRatio =
        (normalized.headHeight * normalized.mountScale) /
        (base.alphaBounds.height * base.mountScale);
      expect(heightRatio, id).toBeGreaterThanOrEqual(0.94);
      expect(heightRatio, id).toBeLessThanOrEqual(HEAD_TARGET_SCALE + 0.000001);
      const resolved = resolveGearBakeLoadout(v2, {
        ...STARTER_GEAR_LOADOUT,
        head: id,
        hat: "coldsnap-hat",
      });
      expect(resolved.extras.headMountScale, id).toBeCloseTo(normalized.mountScale, 12);
      const hat = resolved.extras.hats[0];
      if (!hat) throw new Error(`${id} lost the control hat`);
      const guardedHatScale =
        ((rigScale * resolved.extras.headMountScale) / resolved.extras.headMountScale) *
        hat.source.mountScale *
        hat.stackScale;
      expect(guardedHatScale, id).toBeCloseTo(
        rigScale * hat.source.mountScale * hat.stackScale,
        12,
      );
      for (const receiver of ["face.eyes", "face.mouth"] as const) {
        const authoring =
          receiver === "face.eyes"
            ? GEAR_CATALOG["blank-drifter-head"].faceReceivers.eyes
            : GEAR_CATALOG["blank-drifter-head"].faceReceivers.mouth;
        const placement = headRiderSourcePlacement(id, receiver, authoring);
        expect(authoring.x + placement.offset.x, `${id}:${receiver}:x`).toBe(
          placement.targetSource.x,
        );
        expect(authoring.y + placement.offset.y, `${id}:${receiver}:y`).toBe(
          placement.targetSource.y,
        );
      }
    }
  });

  it("reduces alpha-box interpenetration for both wide masks on Graveside and Ashen collars", () => {
    const v2 = replacementPairManifest("collar-mask-proof-r1");
    const baseHead = v2.boilerplate.parts.find((part) => part.id === "head");
    if (!baseHead) throw new Error("base head missing");
    type Box = { left: number; top: number; right: number; bottom: number };
    const overlap = (a: Box, b: Box) => ({
      width: Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)),
      height: Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
    });

    for (const torsoId of ["graveside-shirt", "ashen-crusader-shirt"] as const) {
      const torsoItem = gearManifestItem(v2, torsoId);
      const torsoPart = torsoItem?.parts.find((part) => part.id === "torso");
      if (!torsoPart) throw new Error(`${torsoId} missing torso alpha`);
      const torsoAfter = torsoScaleNormalization(v2, torsoId).effectiveBounds;
      const sockets = boundsDerivedRigSockets(v2, torsoId);
      const torsoBefore: Box = {
        left: torsoPart.alphaBounds.left,
        top: torsoPart.alphaBounds.top,
        right: torsoPart.alphaBounds.left + torsoPart.alphaBounds.width,
        bottom: torsoPart.alphaBounds.top + torsoPart.alphaBounds.height,
      };
      for (const headId of ["coldsnap-head", "demon-mask-head"] as const) {
        const headItem = gearManifestItem(v2, headId);
        const headPart = headItem?.parts.find((part) => part.id === "head");
        if (!headPart) throw new Error(`${headId} missing head alpha`);
        const afterMount = headScaleNormalization(v2, headId).mountScale;
        const beforeMount = afterMount / HEAD_TARGET_SCALE;
        const boxAt = (socket: Readonly<{ x: number; y: number }>, mount: number): Box => ({
          left: socket.x + (headPart.alphaBounds.left - headPart.pivotSource.x) * mount,
          top: socket.y + (headPart.alphaBounds.top - headPart.pivotSource.y) * mount,
          right:
            socket.x +
            (headPart.alphaBounds.left + headPart.alphaBounds.width - headPart.pivotSource.x) *
              mount,
          bottom:
            socket.y +
            (headPart.alphaBounds.top + headPart.alphaBounds.height - headPart.pivotSource.y) *
              mount,
        });
        const before = overlap(torsoBefore, boxAt(sourcePoint(v2, "head"), beforeMount));
        const after = overlap(torsoAfter, boxAt(sockets.head, afterMount));
        expect(after.width, `${torsoId}+${headId}:connected-width`).toBeGreaterThan(200);
        expect(after.height, `${torsoId}+${headId}:connected-height`).toBeGreaterThan(100);
        expect(
          after.width * after.height,
          `${torsoId}+${headId}:interpenetration-area`,
        ).toBeLessThan(before.width * before.height);
      }
    }
  });
});
