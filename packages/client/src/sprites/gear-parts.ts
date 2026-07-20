import { GEAR_CATALOG, GEAR_SLOTS, type GearId, type GearSlot, isGearId } from "@dd/shared";
import type Phaser from "phaser";
import generatedManifest from "../../../../tools/artkit/out/gear/gear-parts-manifest.json";

export const GEAR_SOCKET_FRAME_ID = "GEAR_SOCKET_FRAME_V1" as const;
export const HAT_STACK_BAND_ID = "HAT_STACK_BAND_V1" as const;
export const GEAR_REPLACEMENT_CONTRACT_ID = "GEAR_REPLACEMENT_V2" as const;
export const MAX_VISIBLE_HATS = 12;
export const MAX_HAT_SLOTS = 30;

export const GEAR_BAKED_PART_IDS = [
  "body",
  "head",
  "hand-l",
  "hand-r",
  "foot-l",
  "foot-r",
] as const;

export type GearBakedPartId = (typeof GEAR_BAKED_PART_IDS)[number];
export type GearRenderRole =
  | "body-patch"
  | "replace-torso"
  | "replace-hand"
  | "replace-foot"
  | "head-accessory"
  | "overlay-hat"
  | "replace-head"
  | "cloak-far";

export interface GearBakeFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly origin: { readonly x: number; readonly y: number };
}

export interface GearReplacementContract {
  readonly id: typeof GEAR_REPLACEMENT_CONTRACT_ID;
  /** Optional generator revision. Schema + contract id remain the stable fallback revision. */
  readonly revision?: string;
  readonly partFrames?: Partial<Record<GearBakedPartId, unknown>>;
  readonly bakeFrames?: Partial<Record<GearBakedPartId, unknown>>;
  readonly frames?: Partial<Record<GearBakedPartId, unknown>>;
  readonly fixedPartFrames?: Partial<Record<GearBakedPartId, unknown>>;
  readonly maskHashes?: Readonly<Record<string, unknown>>;
  readonly canonicalMaskHashes?: Readonly<Record<string, unknown>>;
  readonly compositionOrders?: {
    readonly body?: readonly string[];
    readonly head?: readonly string[];
  };
  readonly compositionOrder?: {
    readonly body?: readonly string[];
    readonly head?: readonly string[];
  };
}

export type GearBakeLayerRole =
  | "base"
  | "replacement-torso"
  | "replacement-head"
  | "facialHair"
  | "glasses"
  | "glove"
  | "boot"
  | "cloak"
  | "hat";

export interface GearBakeSourceDependency {
  readonly role: GearBakeLayerRole;
  readonly slot: GearSlot | null;
  readonly gearId: GearId | null;
  readonly textureKey: string;
  readonly textureUrl: string | null;
  readonly sourceRevision: string;
  /** Source-canvas translation applied before the shared replacement frame is cropped. */
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly state: GearTextureState;
  readonly blank: boolean;
}

export interface GearPartBakeRecipe {
  readonly partId: GearBakedPartId;
  readonly frame: GearBakeFrame;
  readonly layers: readonly GearBakeSourceDependency[];
  readonly dependencies: readonly GearBakeSourceDependency[];
  readonly key: string;
}

export interface GearBakeDiagnostic {
  readonly kind: "missing-art" | "invalid-art";
  readonly partId: GearBakedPartId | "cloak" | "hat";
  readonly slot: GearSlot;
  readonly gearId: GearId;
  readonly textureKey: string;
  readonly message: string;
}

export interface GearBakeRecipe {
  readonly contractRevision: string;
  readonly parts: Readonly<Record<GearBakedPartId, GearPartBakeRecipe>>;
  readonly readiness: GearTextureState | "fallback";
  readonly diagnostics: readonly GearBakeDiagnostic[];
}

export type GearReceiverId =
  | "head"
  | "face.eyes"
  | "face.mouth"
  | "torso"
  | "legs"
  | "back"
  | "hand-l"
  | "hand-r"
  | "foot-l"
  | "foot-r";

export interface GearPartSpringManifest {
  preset: string;
  hz: number;
  dampingRatio: number;
  maxDeg: number;
  dragGain: number;
}

export interface GearReceiverAnchor {
  id?: string;
  frame?: string;
  socket?: string;
  xL: number;
  yL: number;
  parent?: string;
  raw?: { x: number; y: number } | null;
}

export interface GearManifestPart {
  id: string;
  parent: string | null;
  receiver: GearReceiverId;
  pivotSource: { x: number; y: number };
  /** Face riders retain their pre-fixed-frame authoring pivot for per-head socket alignment. */
  authoringPivotSource?: { x: number; y: number };
  receiverAnchor: GearReceiverAnchor;
  restAngle: number;
  mountScale: number;
  plane: number;
  spring: GearPartSpringManifest | null;
  alphaBounds: { left: number; top: number; width: number; height: number };
  sourceRevision?: string;
  sourceHash?: string;
}

export interface GearManifestItem {
  id: string;
  name: string;
  setId: string;
  slot: GearSlot;
  slotDirectory: string;
  texture: string;
  image: { width: number; height: number; sha256?: string };
  faceReceivers?: {
    readonly eyes: Readonly<{ x: number; y: number }>;
    readonly mouth: Readonly<{ x: number; y: number }>;
  } | null;
  parts: GearManifestPart[];
  renderRole?: GearRenderRole;
  sourceRevision?: string;
  sourceHash?: string;
  replacementTexture?:
    | string
    | {
        texture: string;
        sourceRevision?: string;
        sourceHash?: string;
        sha256?: string;
      };
  replacementSourceRevision?: string;
  replacementTextureHash?: string;
  replacementSourceHash?: string;
  replacementTextureRevision?: string;
  replacementImage?: { sha256?: string; sourceRevision?: string; sourceHash?: string };
  stackBandVerification?: {
    frame: string;
    verified: boolean;
    topSocketSource: { x: number; y: number } | null;
  } | null;
}

export interface GearManifestSlot {
  id: GearSlot;
  directory: string;
  receivers: GearReceiverId[];
  componentIds: string[];
  items: GearManifestItem[];
}

export interface BoilerplateManifestPart {
  id: "body" | "head" | "hand-l" | "hand-r" | "foot-l" | "foot-r";
  texture: string;
  parent: string | null;
  receiver: string;
  pivotSource: { x: number; y: number };
  receiverAnchor: GearReceiverAnchor;
  restAngle: number;
  mountScale: number;
  plane: number;
  alphaBounds: { left: number; top: number; width: number; height: number };
  image: { width: number; height: number; sha256?: string };
  sourceRevision?: string;
  sourceHash?: string;
}

export interface GearPartsManifest {
  schemaVersion: number;
  socketFrame: {
    id: string;
    canvas: { width: number; height: number };
    bodyRootSource: { x: number; y: number };
    bodyHeightL: number;
    hatStackBand: {
      id: string;
      sourcePivot: { x: number; y: number };
    };
  };
  outlinePass: {
    color: string;
    baseWidth: number;
    installedRadius: number;
  };
  zOrder: { plane: number; id: string }[];
  boilerplate: { parts: BoilerplateManifestPart[] };
  slots: GearManifestSlot[];
  replacementContract?: GearReplacementContract;
}

export interface BoilerplateAssemblyPart {
  source: BoilerplateManifestPart;
  x: number;
  y: number;
  originX: number;
  originY: number;
  scale: number;
  rotation: number;
  depth: number;
}

export interface BoilerplateAssembly {
  parts: BoilerplateAssemblyPart[];
  scale: number;
}

export interface GearAssemblyPart {
  key: string;
  gearId: GearId;
  slot: GearSlot;
  item: GearManifestItem;
  source: GearManifestPart;
  x: number;
  y: number;
  originX: number;
  originY: number;
  scale: number;
  rotation: number;
  depth: number;
  stackIndex: number;
  stackScale: number;
  topSocketSource: { x: number; y: number } | null;
  extraRole?: "cloak-far" | "overlay-hat" | "prestige-cap";
}

export interface GearLoadoutAssembly {
  parts: GearAssemblyPart[];
  towerTotal: number;
  towerVisible: number;
  towerOverflow: number;
}

export interface GearExtraAssembly extends GearLoadoutAssembly {
  readonly cloak: GearAssemblyPart | null;
  readonly hats: readonly GearAssemblyPart[];
  /** Retained compatibility field. Head is now an independent slot and never consumes hat capacity. */
  readonly replacementHeadPosition: boolean;
  readonly diagnostics: readonly GearBakeDiagnostic[];
}

export interface GearBakeResolution {
  readonly recipe: GearBakeRecipe;
  readonly extras: GearExtraAssembly;
  readonly dependencies: readonly GearBakeSourceDependency[];
}

export type GearTextureStateResolver = (
  dependency: Omit<GearBakeSourceDependency, "state">,
) => GearTextureState;

/** Compatibility seam for schema-v1 callers; schema-v2 head items are baked from the manifest. */
export interface AlternativeHeadTextureSelection {
  readonly gearId: string;
  readonly textureKey: string;
  readonly frame?: string;
}

export interface ResolvedLoadoutHeadTexture {
  readonly gearId: string | null;
  readonly textureKey: string;
  readonly frame?: string;
}

export interface HatSpringState {
  angle: number;
  velocity: number;
}

export interface HatChainInput {
  excitation: number;
  dashLean: number;
  bodyAngle: number;
  landingImpulse: number;
  reducedMotion: boolean;
  reset: boolean;
}

export interface HatChainTuning {
  hz: number;
  dampingRatio: number;
  maxDeg: number;
  dragGain: number;
}

export const DEFAULT_HAT_CHAIN_TUNING: Readonly<HatChainTuning> = Object.freeze({
  hz: 5.2,
  dampingRatio: 0.58,
  maxDeg: 9,
  dragGain: 0.7,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const FROZEN_GEAR_BAKE_FRAMES: Readonly<Record<GearBakedPartId, GearBakeFrame>> = Object.freeze({
  body: Object.freeze({
    left: 268,
    top: 180,
    width: 488,
    height: 544,
    origin: Object.freeze({ x: 244 / 488, y: 332 / 544 }),
  }),
  head: Object.freeze({
    left: 290,
    top: 40,
    width: 508,
    height: 552,
    origin: Object.freeze({ x: 222 / 508, y: 260 / 552 }),
  }),
  "hand-l": Object.freeze({
    left: 294,
    top: 432,
    width: 180,
    height: 180,
    origin: Object.freeze({ x: 0.5, y: 0.5 }),
  }),
  "hand-r": Object.freeze({
    left: 550,
    top: 432,
    width: 180,
    height: 180,
    origin: Object.freeze({ x: 0.5, y: 0.5 }),
  }),
  "foot-l": Object.freeze({
    left: 353,
    top: 641,
    width: 190,
    height: 190,
    origin: Object.freeze({ x: 0.5, y: 0.5 }),
  }),
  "foot-r": Object.freeze({
    left: 481,
    top: 641,
    width: 190,
    height: 190,
    origin: Object.freeze({ x: 0.5, y: 0.5 }),
  }),
});

export const GEAR_BAKE_FRAMES = FROZEN_GEAR_BAKE_FRAMES;

function frameTuple(value: unknown): readonly number[] | null {
  if (Array.isArray(value) && value.length === 4 && value.every(finite)) return value;
  if (!isRecord(value)) return null;
  const candidate = value.crop ?? value.frame ?? value.rect ?? value.sourceRect;
  if (Array.isArray(candidate) && candidate.length === 4 && candidate.every(finite))
    return candidate;
  if (finite(value.left) && finite(value.top) && finite(value.width) && finite(value.height)) {
    return [value.left, value.top, value.width, value.height];
  }
  return null;
}

export function replacementBakeFrame(
  manifest: GearPartsManifest,
  partId: GearBakedPartId,
): GearBakeFrame | null {
  const contract = manifest.replacementContract;
  if (!contract) return null;
  const raw =
    contract.partFrames?.[partId] ??
    contract.bakeFrames?.[partId] ??
    contract.frames?.[partId] ??
    contract.fixedPartFrames?.[partId];
  const tuple = frameTuple(raw);
  const frozen = FROZEN_GEAR_BAKE_FRAMES[partId];
  if (
    !tuple ||
    tuple[0] !== frozen.left ||
    tuple[1] !== frozen.top ||
    tuple[2] !== frozen.width ||
    tuple[3] !== frozen.height
  ) {
    return null;
  }
  return frozen;
}

function replacementCompositionOrdersValid(contract: GearReplacementContract): boolean {
  const orders = contract.compositionOrders ?? contract.compositionOrder;
  return (
    Array.isArray(orders?.body) &&
    orders.body.join(",") === "torso" &&
    Array.isArray(orders.head) &&
    orders.head.join(",") === "head,facialHair,glasses"
  );
}

function sourceRevisionOf(
  item: Pick<GearManifestItem, "sourceRevision" | "sourceHash" | "image" | "texture">,
  part?: Pick<GearManifestPart, "sourceRevision" | "sourceHash">,
): string {
  return (
    part?.sourceRevision ??
    part?.sourceHash ??
    item.sourceRevision ??
    item.sourceHash ??
    item.image.sha256 ??
    item.texture
  );
}

function boilerplateRevisionOf(part: BoilerplateManifestPart): string {
  return part.sourceRevision ?? part.sourceHash ?? part.image.sha256 ?? part.texture;
}

function pointShape(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && finite(value.x) && finite(value.y);
}

function receiverId(value: unknown): value is GearReceiverId {
  return (
    value === "head" ||
    value === "face.eyes" ||
    value === "face.mouth" ||
    value === "torso" ||
    value === "legs" ||
    value === "back" ||
    value === "hand-l" ||
    value === "hand-r" ||
    value === "foot-l" ||
    value === "foot-r"
  );
}

function slotId(value: unknown): value is GearSlot {
  return typeof value === "string" && (GEAR_SLOTS as readonly string[]).includes(value);
}

function receiverAnchorShape(value: unknown): value is GearReceiverAnchor {
  return isRecord(value) && finite(value.xL) && finite(value.yL);
}

function springShape(value: unknown): value is GearPartSpringManifest | null {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.preset === "string" &&
      finite(value.hz) &&
      finite(value.dampingRatio) &&
      finite(value.maxDeg) &&
      finite(value.dragGain))
  );
}

function partShape(value: unknown): value is GearManifestPart {
  if (!isRecord(value) || !receiverId(value.receiver)) return false;
  const bounds = value.alphaBounds;
  return (
    typeof value.id === "string" &&
    (typeof value.parent === "string" || value.parent === null) &&
    pointShape(value.pivotSource) &&
    (value.authoringPivotSource === undefined || pointShape(value.authoringPivotSource)) &&
    receiverAnchorShape(value.receiverAnchor) &&
    finite(value.restAngle) &&
    finite(value.mountScale) &&
    value.mountScale > 0 &&
    finite(value.plane) &&
    springShape(value.spring) &&
    isRecord(bounds) &&
    finite(bounds.left) &&
    finite(bounds.top) &&
    finite(bounds.width) &&
    finite(bounds.height)
  );
}

function renderRole(value: unknown): value is GearRenderRole {
  return (
    value === "body-patch" ||
    value === "replace-torso" ||
    value === "replace-hand" ||
    value === "replace-foot" ||
    value === "head-accessory" ||
    value === "overlay-hat" ||
    value === "replace-head" ||
    value === "cloak-far"
  );
}

function expectedRenderRole(slot: GearSlot): readonly GearRenderRole[] {
  switch (slot) {
    case "torso":
      return ["replace-torso"];
    case "head":
      return ["replace-head"];
    case "gloves":
      return ["replace-hand"];
    case "boots":
      return ["replace-foot"];
    case "glasses":
    case "facialHair":
      return ["head-accessory"];
    case "cloak":
      return ["cloak-far"];
    case "hat":
      return ["overlay-hat"];
  }
}

function v2ItemRoleValid(item: GearManifestItem): boolean {
  if (!renderRole(item.renderRole) || !expectedRenderRole(item.slot).includes(item.renderRole))
    return false;
  const receivers = new Set(item.parts.map((part) => part.receiver));
  const receiversValid =
    (item.slot === "gloves" &&
      receivers.size === 2 &&
      receivers.has("hand-l") &&
      receivers.has("hand-r")) ||
    (item.slot === "boots" &&
      receivers.size === 2 &&
      receivers.has("foot-l") &&
      receivers.has("foot-r")) ||
    (item.slot === "torso" && item.parts.length === 1 && receivers.has("torso")) ||
    (item.slot === "head" && item.parts.length === 1 && receivers.has("head")) ||
    (item.slot === "glasses" && item.parts.length === 1 && receivers.has("face.eyes")) ||
    (item.slot === "facialHair" && item.parts.length === 1 && receivers.has("face.mouth")) ||
    (item.slot === "cloak" && item.parts.length === 1 && receivers.has("back")) ||
    (item.slot === "hat" && item.parts.length === 1 && receivers.has("head"));
  const hasRevision = Boolean(item.sourceRevision ?? item.sourceHash ?? item.image.sha256);
  return receiversValid && hasRevision;
}

function itemShape(value: unknown, slot: GearSlot): value is GearManifestItem {
  if (!isRecord(value) || value.slot !== slot || !Array.isArray(value.parts)) return false;
  const image = value.image;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.setId !== "string" ||
    typeof value.slotDirectory !== "string" ||
    typeof value.texture !== "string" ||
    !isRecord(image) ||
    !finite(image.width) ||
    !finite(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    return false;
  }
  const partIds = new Set<string>();
  for (const part of value.parts) {
    if (!partShape(part) || partIds.has(part.id)) return false;
    if (
      part.alphaBounds.left < 0 ||
      part.alphaBounds.top < 0 ||
      part.alphaBounds.width <= 0 ||
      part.alphaBounds.height <= 0 ||
      part.alphaBounds.left + part.alphaBounds.width > image.width ||
      part.alphaBounds.top + part.alphaBounds.height > image.height ||
      part.pivotSource.x < 0 ||
      part.pivotSource.y < 0 ||
      part.pivotSource.x > image.width ||
      part.pivotSource.y > image.height
    ) {
      return false;
    }
    partIds.add(part.id);
  }
  if (slot !== "hat") return true;
  const stack = value.stackBandVerification;
  return (
    isRecord(stack) &&
    stack.frame === HAT_STACK_BAND_ID &&
    stack.verified === true &&
    pointShape(stack.topSocketSource)
  );
}

function boilerplatePartShape(value: unknown): value is BoilerplateManifestPart {
  if (!isRecord(value)) return false;
  const image = value.image;
  const bounds = value.alphaBounds;
  return (
    (value.id === "body" ||
      value.id === "head" ||
      value.id === "hand-l" ||
      value.id === "hand-r" ||
      value.id === "foot-l" ||
      value.id === "foot-r") &&
    typeof value.texture === "string" &&
    (typeof value.parent === "string" || value.parent === null) &&
    typeof value.receiver === "string" &&
    pointShape(value.pivotSource) &&
    receiverAnchorShape(value.receiverAnchor) &&
    finite(value.restAngle) &&
    finite(value.mountScale) &&
    finite(value.plane) &&
    isRecord(bounds) &&
    finite(bounds.left) &&
    finite(bounds.top) &&
    finite(bounds.width) &&
    finite(bounds.height) &&
    bounds.left >= 0 &&
    bounds.top >= 0 &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    isRecord(image) &&
    finite(image.width) &&
    finite(image.height) &&
    image.width > 0 &&
    image.height > 0 &&
    bounds.left + bounds.width <= image.width &&
    bounds.top + bounds.height <= image.height
  );
}

/** Validate the generated art contract without requiring all still-rendering slots to be present. */
export function validateGearPartsManifest(value: unknown): GearPartsManifest | null {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) return null;
  const schemaVersion = value.schemaVersion;
  const frame = value.socketFrame;
  const boilerplate = value.boilerplate;
  const outline = value.outlinePass;
  if (
    !isRecord(frame) ||
    frame.id !== GEAR_SOCKET_FRAME_ID ||
    !isRecord(frame.canvas) ||
    frame.canvas.width !== 1024 ||
    frame.canvas.height !== 1024 ||
    !pointShape(frame.bodyRootSource) ||
    !finite(frame.bodyHeightL) ||
    frame.bodyHeightL <= 0 ||
    !isRecord(frame.hatStackBand) ||
    frame.hatStackBand.id !== HAT_STACK_BAND_ID ||
    !pointShape(frame.hatStackBand.sourcePivot) ||
    !isRecord(outline) ||
    outline.color !== "#101014" ||
    !finite(outline.baseWidth) ||
    !finite(outline.installedRadius) ||
    !isRecord(boilerplate) ||
    !Array.isArray(boilerplate.parts) ||
    !Array.isArray(value.zOrder) ||
    !Array.isArray(value.slots)
  ) {
    return null;
  }

  if (schemaVersion === 2) {
    const contract = value.replacementContract;
    if (
      !isRecord(contract) ||
      contract.id !== GEAR_REPLACEMENT_CONTRACT_ID ||
      !replacementCompositionOrdersValid(contract as unknown as GearReplacementContract)
    ) {
      return null;
    }
    const manifestCandidate = value as unknown as GearPartsManifest;
    for (const partId of GEAR_BAKED_PART_IDS)
      if (!replacementBakeFrame(manifestCandidate, partId)) return null;
  }

  const boilerplateIds = new Set<string>();
  for (const part of boilerplate.parts) {
    if (!boilerplatePartShape(part) || boilerplateIds.has(part.id)) return null;
    boilerplateIds.add(part.id);
  }
  for (const id of ["body", "head", "hand-l", "hand-r", "foot-l", "foot-r"])
    if (!boilerplateIds.has(id)) return null;

  const planeIds = new Set<string>();
  const planeValues = new Set<number>();
  for (const row of value.zOrder) {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !finite(row.plane) ||
      planeIds.has(row.id) ||
      planeValues.has(row.plane)
    ) {
      return null;
    }
    planeIds.add(row.id);
    planeValues.add(row.plane);
  }

  const slots = new Set<GearSlot>();
  for (const row of value.slots) {
    if (!isRecord(row) || !slotId(row.id) || slots.has(row.id) || !Array.isArray(row.items))
      return null;
    slots.add(row.id);
    const itemIds = new Set<string>();
    for (const item of row.items) {
      if (!itemShape(item, row.id) || itemIds.has(item.id)) return null;
      if (schemaVersion === 2 && !v2ItemRoleValid(item)) return null;
      itemIds.add(item.id);
    }
  }
  for (const slot of GEAR_SLOTS) if (!slots.has(slot)) return null;
  return value as unknown as GearPartsManifest;
}

/** Synchronous because Vite bundles the generated machine manifest with this typed loader. */
export const GEAR_PARTS_MANIFEST = validateGearPartsManifest(generatedManifest as unknown);

if (!GEAR_PARTS_MANIFEST) {
  console.warn(
    "[gear-bake] replacement manifest invalid or unavailable; preserving the compatibility rig",
  );
}

export function isGearReplacementManifest(
  manifest: GearPartsManifest | null | undefined,
): manifest is GearPartsManifest & { replacementContract: GearReplacementContract } {
  return (
    manifest?.schemaVersion === 2 &&
    manifest.replacementContract?.id === GEAR_REPLACEMENT_CONTRACT_ID &&
    GEAR_BAKED_PART_IDS.every((partId) => replacementBakeFrame(manifest, partId) !== null)
  );
}

export function boilerplateTextureKey(partId: string): string {
  return `boilerplate:${partId}`;
}

export function boilerplateTextureUrl(texture: string): string {
  return `sprites/boilerplate/${texture}`;
}

export const DEFAULT_LOADOUT_HEAD_TEXTURE: Readonly<ResolvedLoadoutHeadTexture> = Object.freeze({
  gearId: null,
  textureKey: boilerplateTextureKey("head"),
});

export function gearReplacementHeadTextureKey(item: Pick<GearManifestItem, "id" | "slot">): string {
  return gearTextureKey(item);
}

export function gearReplacementHeadTextureUrl(item: GearManifestItem): string | null {
  return item.renderRole === "replace-head" ? gearTextureUrl(item) : null;
}

export function resolveLoadoutHeadTexture(
  selection?: Readonly<AlternativeHeadTextureSelection> | null,
): Readonly<ResolvedLoadoutHeadTexture>;
export function resolveLoadoutHeadTexture(
  manifest: GearPartsManifest,
  loadout: Readonly<Record<GearSlot, GearId>>,
  textureReady?: (textureKey: string) => boolean,
): Readonly<ResolvedLoadoutHeadTexture>;
/**
 * The v2 production seam is manifest-driven. The selection overload remains solely for the schema-v1
 * compatibility renderer while the replacement art fleet is not installed.
 */
export function resolveLoadoutHeadTexture(
  manifestOrSelection?: GearPartsManifest | Readonly<AlternativeHeadTextureSelection> | null,
  loadout?: Readonly<Record<GearSlot, GearId>>,
  textureReady: (textureKey: string) => boolean = () => false,
): Readonly<ResolvedLoadoutHeadTexture> {
  if (
    manifestOrSelection &&
    "schemaVersion" in manifestOrSelection &&
    loadout &&
    isGearReplacementManifest(manifestOrSelection)
  ) {
    const gearId = loadout.head;
    if (!isGearId(gearId) || GEAR_CATALOG[gearId].slot !== "head")
      return DEFAULT_LOADOUT_HEAD_TEXTURE;
    const item = gearManifestItem(manifestOrSelection, gearId);
    if (item?.renderRole !== "replace-head") return DEFAULT_LOADOUT_HEAD_TEXTURE;
    const textureKey = gearReplacementHeadTextureKey(item);
    return textureReady(textureKey) ? { gearId, textureKey } : DEFAULT_LOADOUT_HEAD_TEXTURE;
  }

  const selection = manifestOrSelection as Readonly<AlternativeHeadTextureSelection> | null;
  if (
    !selection ||
    selection.gearId.trim().length === 0 ||
    selection.textureKey.trim().length === 0
  )
    return DEFAULT_LOADOUT_HEAD_TEXTURE;
  return {
    gearId: selection.gearId,
    textureKey: selection.textureKey,
    ...(selection.frame === undefined ? {} : { frame: selection.frame }),
  };
}

export function gearTextureKey(item: Pick<GearManifestItem, "slot" | "id">): string {
  return `gear:${item.slot}:${item.id}`;
}

export function gearTextureUrl(item: Pick<GearManifestItem, "slotDirectory" | "texture">): string {
  return `sprites/gear/${item.slotDirectory}/${item.texture}`;
}

export function assembleBoilerplate(
  manifest: GearPartsManifest,
  targetBodyHeight = 76,
): BoilerplateAssembly {
  const scale = targetBodyHeight / manifest.socketFrame.bodyHeightL;
  const root = manifest.socketFrame.bodyRootSource;
  const parts = manifest.boilerplate.parts
    .map<BoilerplateAssemblyPart>((source) => {
      // Boilerplate files retain the untrimmed 1024 socket frame. Position the authored pivot at exactly
      // one receiver: prefer its frozen source-space point, with normalized L units only as a fallback.
      // The image origin then consumes the pivot once; alphaBounds never contributes a second offset.
      const raw = source.receiverAnchor.raw;
      const x = raw ? (raw.x - root.x) * scale : source.receiverAnchor.xL * targetBodyHeight;
      const y = raw ? (raw.y - root.y) * scale : source.receiverAnchor.yL * targetBodyHeight;
      return {
        source,
        x,
        y,
        originX: source.pivotSource.x / source.image.width,
        originY: source.pivotSource.y / source.image.height,
        scale: scale * source.mountScale,
        rotation: (source.restAngle * Math.PI) / 180,
        depth: source.plane,
      };
    })
    .sort((a, b) => a.depth - b.depth);
  return { parts, scale };
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function gearManifestItem(
  manifest: GearPartsManifest,
  gearId: GearId,
): GearManifestItem | undefined {
  const def = GEAR_CATALOG[gearId];
  const expectedId = slug(def.name);
  const setFallbackIsAmbiguous =
    Boolean(def.legacySetId) &&
    Object.values(GEAR_CATALOG).filter(
      (candidate) => candidate.slot === def.slot && candidate.legacySetId === def.legacySetId,
    ).length > 1;
  for (const slot of manifest.slots) {
    if (slot.id !== def.slot) continue;
    const exact = slot.items.find((item) => item.id === gearId);
    if (exact) return exact;
    for (const item of slot.items) {
      if (item.id === expectedId) return item;
      if (!setFallbackIsAmbiguous && def.legacySetId && item.setId === def.legacySetId) return item;
    }
    return undefined;
  }
  return undefined;
}

export type HeadRiderReceiver = "face.eyes" | "face.mouth";

export interface HeadRiderSourcePlacement {
  readonly authoringSource: Readonly<{ x: number; y: number }>;
  readonly targetSource: Readonly<{ x: number; y: number }>;
  readonly offset: Readonly<{ x: number; y: number }>;
}

/**
 * Resolve a face rider entirely in the untrimmed 1024px authoring canvas. The baked card is then
 * mounted/scaled/mirrored once with its winning head, so the same source offset serves both facings.
 */
export function headRiderSourcePlacement(
  headGearId: GearId,
  receiver: HeadRiderReceiver,
  authoringSource: Readonly<{ x: number; y: number }>,
): HeadRiderSourcePlacement {
  const head = GEAR_CATALOG[headGearId];
  const fallback = GEAR_CATALOG["blank-drifter-head"].faceReceivers;
  const receivers = head.slot === "head" ? (head.faceReceivers ?? fallback) : fallback;
  const targetSource = receiver === "face.eyes" ? receivers.eyes : receivers.mouth;
  return {
    authoringSource,
    targetSource,
    offset: {
      x: targetSource.x - authoringSource.x,
      y: targetSource.y - authoringSource.y,
    },
  };
}

function blankGearId(gearId: GearId): boolean {
  return gearId.startsWith("blank-drifter-");
}

function contractRevision(manifest: GearPartsManifest): string {
  const revision = manifest.replacementContract?.revision;
  return `${manifest.schemaVersion}:${GEAR_REPLACEMENT_CONTRACT_ID}:${revision ?? "contract"}`;
}

function dependencyWithState(
  source: Omit<GearBakeSourceDependency, "state">,
  resolveState: GearTextureStateResolver,
): GearBakeSourceDependency {
  return {
    ...source,
    state: source.textureUrl === null && !source.blank ? "missing" : resolveState(source),
  };
}

function baseDependency(
  manifest: GearPartsManifest,
  partId: GearBakedPartId,
  resolveState: GearTextureStateResolver,
): GearBakeSourceDependency {
  const source = manifest.boilerplate.parts.find((candidate) => candidate.id === partId);
  const textureKey = boilerplateTextureKey(partId);
  return dependencyWithState(
    {
      role: "base",
      slot: null,
      gearId: null,
      textureKey,
      textureUrl: source ? boilerplateTextureUrl(source.texture) : null,
      sourceRevision: source ? boilerplateRevisionOf(source) : "missing",
      blank: false,
    },
    resolveState,
  );
}

function selectedItemDependency(
  manifest: GearPartsManifest,
  loadout: Readonly<Record<GearSlot, GearId>>,
  slot: GearSlot,
  role: GearBakeLayerRole,
  resolveState: GearTextureStateResolver,
  receiver?: GearReceiverId,
  riderHeadId?: GearId,
): GearBakeSourceDependency | null {
  const gearId = loadout[slot];
  if (!isGearId(gearId) || GEAR_CATALOG[gearId].slot !== slot || blankGearId(gearId)) return null;
  const item = gearManifestItem(manifest, gearId);
  const part = receiver
    ? item?.parts.find((candidate) => candidate.receiver === receiver)
    : item?.parts[0];
  const hasRequiredPart = !receiver || part !== undefined;
  const riderPlacement =
    part && riderHeadId && (part.receiver === "face.eyes" || part.receiver === "face.mouth")
      ? headRiderSourcePlacement(
          riderHeadId,
          part.receiver,
          part.authoringPivotSource ?? part.receiverAnchor.raw ?? part.pivotSource,
        )
      : null;
  return dependencyWithState(
    {
      role,
      slot,
      gearId,
      textureKey: item ? gearTextureKey(item) : `gear:${slot}:${gearId}`,
      textureUrl: item && hasRequiredPart ? gearTextureUrl(item) : null,
      sourceRevision: item ? sourceRevisionOf(item, part) : "missing",
      offsetX: riderPlacement?.offset.x,
      offsetY: riderPlacement?.offset.y,
      blank: false,
    },
    resolveState,
  );
}

function replacementPartDependency(
  manifest: GearPartsManifest,
  loadout: Readonly<Record<GearSlot, GearId>>,
  slot: "torso" | "head",
  renderRole: "replace-torso" | "replace-head",
  role: "replacement-torso" | "replacement-head",
  resolveState: GearTextureStateResolver,
): GearBakeSourceDependency | null {
  const gearId = loadout[slot];
  if (!isGearId(gearId) || GEAR_CATALOG[gearId].slot !== slot || blankGearId(gearId)) return null;
  const item = gearManifestItem(manifest, gearId);
  return dependencyWithState(
    {
      role,
      slot,
      gearId,
      textureKey: item ? gearTextureKey(item) : `gear:${slot}:${gearId}`,
      textureUrl: item?.renderRole === renderRole ? gearTextureUrl(item) : null,
      sourceRevision: item ? sourceRevisionOf(item, item.parts[0]) : "missing",
      blank: false,
    },
    resolveState,
  );
}

function fallbackDiagnostic(
  dependency: GearBakeSourceDependency,
  partId: GearBakedPartId | "cloak" | "hat",
): GearBakeDiagnostic | null {
  if (dependency.state !== "missing" || !dependency.gearId || !dependency.slot) return null;
  const fallback =
    partId === "cloak" || partId === "hat" ? `omitting ${partId}` : `using bare ${partId}`;
  return {
    kind: "missing-art",
    partId,
    slot: dependency.slot,
    gearId: dependency.gearId,
    textureKey: dependency.textureKey,
    message: `[gear-bake] missing replacement art for "${dependency.gearId}" (${dependency.textureKey}); ${fallback} fallback`,
  };
}

function dependencyToken(dependency: GearBakeSourceDependency | null): string {
  if (!dependency) return "blank";
  const identity = dependency.gearId ?? "boilerplate";
  const placement = `:${dependency.offsetX ?? 0},${dependency.offsetY ?? 0}`;
  if (dependency.state === "missing") return `${identity}@fallback${placement}`;
  if (dependency.state === "pending") return `${identity}@pending${placement}`;
  return `${identity}@${dependency.sourceRevision}${placement}`;
}

export function gearPartRecipeKey(
  manifest: GearPartsManifest,
  partId: GearBakedPartId,
  dependencies: readonly (GearBakeSourceDependency | null)[],
): string {
  return `gear-bake:${contractRevision(manifest)}:${partId}:${dependencies
    .map(dependencyToken)
    .join("|")}`;
}

function makePartRecipe(
  manifest: GearPartsManifest,
  partId: GearBakedPartId,
  dependencies: readonly (GearBakeSourceDependency | null)[],
  layerDependencies: readonly (GearBakeSourceDependency | null)[] = dependencies,
  keyDependencies: readonly (GearBakeSourceDependency | null)[] = dependencies,
): GearPartBakeRecipe {
  const frame = replacementBakeFrame(manifest, partId) ?? FROZEN_GEAR_BAKE_FRAMES[partId];
  const present = dependencies.filter(
    (dependency): dependency is GearBakeSourceDependency => dependency !== null,
  );
  return {
    partId,
    frame,
    dependencies: present,
    layers: layerDependencies.filter(
      (dependency): dependency is GearBakeSourceDependency =>
        dependency !== null && dependency.state === "ready",
    ),
    key: gearPartRecipeKey(manifest, partId, keyDependencies),
  };
}

function defaultTextureState(): GearTextureState {
  return "ready";
}

function itemExtraDependency(
  item: GearManifestItem,
  gearId: GearId,
  role: "cloak" | "hat",
  resolveState: GearTextureStateResolver,
): GearBakeSourceDependency {
  return dependencyWithState(
    {
      role,
      slot: item.slot,
      gearId,
      textureKey: gearTextureKey(item),
      textureUrl: gearTextureUrl(item),
      sourceRevision: sourceRevisionOf(item),
      blank: false,
    },
    resolveState,
  );
}

function missingExtraDependency(slot: "cloak" | "hat", gearId: GearId): GearBakeSourceDependency {
  return {
    role: slot,
    slot,
    gearId,
    textureKey: `gear:${slot}:${gearId}`,
    textureUrl: null,
    sourceRevision: "missing",
    state: "missing",
    blank: false,
  };
}

function legalTowerItem(
  manifest: GearPartsManifest,
  requested: GearId | undefined,
): GearManifestItem | undefined {
  if (!requested || !isGearId(requested) || GEAR_CATALOG[requested].slot !== "hat")
    return undefined;
  const item = gearManifestItem(manifest, requested);
  return item?.renderRole === "overlay-hat" ? item : undefined;
}

/** Resolve only the v2 six-part bake and the cloak/hat structural extras. */
export function resolveGearBakeLoadout(
  manifest: GearPartsManifest,
  loadout: Readonly<Record<GearSlot, GearId>>,
  prestige = 0,
  towerComposition: readonly GearId[] = [],
  resolveState: GearTextureStateResolver = defaultTextureState,
): GearBakeResolution {
  const bodyBase = baseDependency(manifest, "body", resolveState);
  const torsoReplacement = replacementPartDependency(
    manifest,
    loadout,
    "torso",
    "replace-torso",
    "replacement-torso",
    resolveState,
  );
  const headBase = baseDependency(manifest, "head", resolveState);
  const headReplacement = replacementPartDependency(
    manifest,
    loadout,
    "head",
    "replace-head",
    "replacement-head",
    resolveState,
  );
  const riderHeadId =
    headReplacement?.state === "ready" && headReplacement.gearId
      ? headReplacement.gearId
      : "blank-drifter-head";
  const facialHair = selectedItemDependency(
    manifest,
    loadout,
    "facialHair",
    "facialHair",
    resolveState,
    "face.mouth",
    riderHeadId,
  );
  const glasses = selectedItemDependency(
    manifest,
    loadout,
    "glasses",
    "glasses",
    resolveState,
    "face.eyes",
    riderHeadId,
  );
  const handLeftBase = baseDependency(manifest, "hand-l", resolveState);
  const handRightBase = baseDependency(manifest, "hand-r", resolveState);
  const gloveLeft = selectedItemDependency(
    manifest,
    loadout,
    "gloves",
    "glove",
    resolveState,
    "hand-l",
  );
  const gloveRight = selectedItemDependency(
    manifest,
    loadout,
    "gloves",
    "glove",
    resolveState,
    "hand-r",
  );
  const footLeftBase = baseDependency(manifest, "foot-l", resolveState);
  const footRightBase = baseDependency(manifest, "foot-r", resolveState);
  const bootLeft = selectedItemDependency(
    manifest,
    loadout,
    "boots",
    "boot",
    resolveState,
    "foot-l",
  );
  const bootRight = selectedItemDependency(
    manifest,
    loadout,
    "boots",
    "boot",
    resolveState,
    "foot-r",
  );

  const winningBody = torsoReplacement?.state === "ready" ? torsoReplacement : bodyBase;
  const winningHead = headReplacement?.state === "ready" ? headReplacement : headBase;
  const winningLeftHand = gloveLeft?.state === "ready" ? gloveLeft : handLeftBase;
  const winningRightHand = gloveRight?.state === "ready" ? gloveRight : handRightBase;
  const winningLeftFoot = bootLeft?.state === "ready" ? bootLeft : footLeftBase;
  const winningRightFoot = bootRight?.state === "ready" ? bootRight : footRightBase;
  const bodyKeyDependencies = torsoReplacement
    ? torsoReplacement.state === "ready"
      ? [torsoReplacement]
      : [bodyBase, torsoReplacement]
    : [bodyBase];
  const headKeyDependencies = headReplacement
    ? headReplacement.state === "ready"
      ? [headReplacement, facialHair, glasses]
      : [headBase, headReplacement, facialHair, glasses]
    : [headBase, facialHair, glasses];
  const parts: Record<GearBakedPartId, GearPartBakeRecipe> = {
    body: makePartRecipe(
      manifest,
      "body",
      [bodyBase, torsoReplacement],
      [winningBody],
      bodyKeyDependencies,
    ),
    head: makePartRecipe(
      manifest,
      "head",
      [headBase, headReplacement, facialHair, glasses],
      [winningHead, facialHair, glasses],
      headKeyDependencies,
    ),
    "hand-l": makePartRecipe(
      manifest,
      "hand-l",
      [handLeftBase, gloveLeft],
      [winningLeftHand],
      [gloveLeft ?? handLeftBase],
    ),
    "hand-r": makePartRecipe(
      manifest,
      "hand-r",
      [handRightBase, gloveRight],
      [winningRightHand],
      [gloveRight ?? handRightBase],
    ),
    "foot-l": makePartRecipe(
      manifest,
      "foot-l",
      [footLeftBase, bootLeft],
      [winningLeftFoot],
      [bootLeft ?? footLeftBase],
    ),
    "foot-r": makePartRecipe(
      manifest,
      "foot-r",
      [footRightBase, bootRight],
      [winningRightFoot],
      [bootRight ?? footRightBase],
    ),
  };

  const diagnostics: GearBakeDiagnostic[] = [];
  for (const [dependency, partId] of [
    [torsoReplacement, "body"],
    [headReplacement, "head"],
    [facialHair, "head"],
    [glasses, "head"],
    [gloveLeft, "hand-l"],
    [gloveRight, "hand-r"],
    [bootLeft, "foot-l"],
    [bootRight, "foot-r"],
  ] as const) {
    if (!dependency) continue;
    const diagnostic = fallbackDiagnostic(dependency, partId);
    if (diagnostic) diagnostics.push(diagnostic);
  }

  const extraDependencies: GearBakeSourceDependency[] = [];
  let cloak: GearAssemblyPart | null = null;
  const cloakId = loadout.cloak;
  if (isGearId(cloakId) && !blankGearId(cloakId)) {
    const item = gearManifestItem(manifest, cloakId);
    const source = item?.renderRole === "cloak-far" ? item.parts[0] : undefined;
    const dependency = item
      ? itemExtraDependency(item, cloakId, "cloak", resolveState)
      : missingExtraDependency("cloak", cloakId);
    extraDependencies.push(dependency);
    if (source && dependency.state === "ready")
      cloak = assemblyPart(
        manifest,
        cloakId,
        item as GearManifestItem,
        source,
        -1,
        1,
        -1,
        "cloak-far",
      );
    const diagnostic = fallbackDiagnostic(dependency, "cloak");
    if (diagnostic) diagnostics.push(diagnostic);
  }

  const hats: GearAssemblyPart[] = [];
  const boundedPrestige = Number.isFinite(prestige)
    ? Math.min(MAX_HAT_SLOTS, Math.max(0, Math.floor(prestige)))
    : 0;
  const selectedHatId = loadout.hat;
  const selectedHat =
    isGearId(selectedHatId) && !blankGearId(selectedHatId)
      ? gearManifestItem(manifest, selectedHatId)
      : undefined;
  const requestedSegmentCount =
    selectedHat?.renderRole === "overlay-hat" ? Math.min(MAX_HAT_SLOTS, boundedPrestige + 1) : 0;
  let readySegmentTotal = 0;
  let readyVisibleSegments = 0;
  for (let index = 0; index < requestedSegmentCount; index++) {
    const requestedId = towerComposition[index] ?? towerComposition[towerComposition.length - 1];
    const composed = legalTowerItem(manifest, requestedId);
    const item = composed ?? selectedHat;
    const gearId = composed ? (requestedId as GearId) : selectedHatId;
    if (!item || !isGearId(gearId)) continue;
    const legalSource = item.renderRole === "overlay-hat" ? item.parts[0] : undefined;
    const dependency = itemExtraDependency(item, gearId, "hat", resolveState);
    if (!extraDependencies.some((candidate) => candidate.textureKey === dependency.textureKey))
      extraDependencies.push(dependency);
    if (!legalSource || dependency.state !== "ready") {
      const diagnostic = fallbackDiagnostic(dependency, "hat");
      if (diagnostic && !diagnostics.some((row) => row.textureKey === diagnostic.textureKey))
        diagnostics.push(diagnostic);
      continue;
    }
    readySegmentTotal++;
    if (readyVisibleSegments >= MAX_VISIBLE_HATS) continue;
    const visibleCountForScale = Math.min(requestedSegmentCount, MAX_VISIBLE_HATS);
    hats.push(
      assemblyPart(
        manifest,
        gearId,
        item,
        legalSource,
        readyVisibleSegments,
        visibleCountForScale,
        readyVisibleSegments,
        "overlay-hat",
      ),
    );
    readyVisibleSegments++;
  }
  const towerTotal = readySegmentTotal;
  const towerVisible = readyVisibleSegments;
  const extras: GearExtraAssembly = {
    parts: [...(cloak ? [cloak] : []), ...hats].sort(
      (a, b) => a.depth - b.depth || a.stackIndex - b.stackIndex,
    ),
    cloak,
    hats,
    replacementHeadPosition: false,
    towerTotal,
    towerVisible,
    towerOverflow: Math.max(0, readySegmentTotal - readyVisibleSegments),
    diagnostics,
  };
  const dependencies = [
    ...new Map(
      [...Object.values(parts).flatMap((part) => part.dependencies), ...extraDependencies].map(
        (dependency) => [dependency.textureKey, dependency],
      ),
    ).values(),
  ];
  const pending = dependencies.some((dependency) => dependency.state === "pending");
  return {
    recipe: {
      contractRevision: contractRevision(manifest),
      parts,
      readiness: pending ? "pending" : diagnostics.length > 0 ? "fallback" : "ready",
      diagnostics,
    },
    extras,
    dependencies,
  };
}

export function hatTowerTotal(prestige: number): number {
  const bounded = Number.isFinite(prestige) ? Math.max(0, Math.floor(prestige)) : 0;
  return Math.min(MAX_HAT_SLOTS, bounded + 1);
}

/** One hat stays full-size; larger towers shrink globally and then progressively toward the cap. */
export function hatStackScale(index: number, total: number): number {
  if (total <= 1) return 1;
  const safeIndex = Math.max(0, Math.floor(index));
  const base = 0.82 / (1 + 0.075 * Math.max(0, total - 2));
  return Math.max(0.24, base * 0.93 ** safeIndex);
}

function towerGearId(equippedHat: GearId, composition: readonly GearId[], index: number): GearId {
  const requested = composition[index] ?? composition[composition.length - 1] ?? equippedHat;
  return isGearId(requested) && GEAR_CATALOG[requested].slot === "hat" ? requested : equippedHat;
}

function assemblyPart(
  manifest: GearPartsManifest,
  gearId: GearId,
  item: GearManifestItem,
  source: GearManifestPart,
  stackIndex: number,
  stackCount: number,
  scaleIndex = stackIndex,
  extraRole?: GearAssemblyPart["extraRole"],
): GearAssemblyPart {
  const targetBodyHeight = 76;
  const stackScale = stackIndex >= 0 ? hatStackScale(scaleIndex, stackCount) : 1;
  const bounds = source.alphaBounds;
  return {
    key: `${gearId}:${source.id}:${stackIndex}`,
    gearId,
    slot: item.slot,
    item,
    source,
    x: source.receiverAnchor.xL * targetBodyHeight,
    y: source.receiverAnchor.yL * targetBodyHeight,
    originX: (source.pivotSource.x - bounds.left) / bounds.width,
    originY: (source.pivotSource.y - bounds.top) / bounds.height,
    scale: (targetBodyHeight / manifest.socketFrame.bodyHeightL) * source.mountScale * stackScale,
    rotation: (source.restAngle * Math.PI) / 180,
    depth: source.plane,
    stackIndex,
    stackScale,
    topSocketSource: item.stackBandVerification?.topSocketSource ?? null,
    ...(extraRole ? { extraRole } : {}),
  };
}

/**
 * Promote a manifest part's alpha bounds to a retained Phaser frame. Multi-part masters (paired gloves,
 * paired boots, cloak/clasp) can then move each authored component without drawing its siblings twice.
 */
const reportedGearFrameIssues = new Set<string>();

function warnGearFrameIssue(issue: string, message: string): void {
  if (reportedGearFrameIssues.has(issue)) return;
  reportedGearFrameIssues.add(issue);
  console.warn(message);
}

export function ensureGearPartFrame(
  scene: Phaser.Scene,
  part: GearAssemblyPart,
): string | undefined {
  const key = gearTextureKey(part.item);
  if (!scene.textures.exists(key)) return undefined;
  const texture = scene.textures.get(key);
  const frameName = `part:${part.source.id}`;
  if (!texture.has(frameName)) {
    const bounds = part.source.alphaBounds;
    const textureSource = texture.source?.[0];
    const sourceWidth =
      finite(textureSource?.width) && textureSource.width > 0
        ? textureSource.width
        : part.item.image.width;
    const sourceHeight =
      finite(textureSource?.height) && textureSource.height > 0
        ? textureSource.height
        : part.item.image.height;
    const left = clamp(bounds.left, 0, Math.max(0, sourceWidth - 1));
    const top = clamp(bounds.top, 0, Math.max(0, sourceHeight - 1));
    const right = clamp(bounds.left + bounds.width, left + 1, sourceWidth);
    const bottom = clamp(bounds.top + bounds.height, top + 1, sourceHeight);
    if (
      sourceWidth !== part.item.image.width ||
      sourceHeight !== part.item.image.height ||
      left !== bounds.left ||
      top !== bounds.top ||
      right - left !== bounds.width ||
      bottom - top !== bounds.height
    ) {
      warnGearFrameIssue(
        `${key}:${part.source.id}:bounds`,
        `[gear] texture/manifest bounds mismatch for "${part.item.id}" (${key}, part ${part.source.id}): loaded ${sourceWidth}x${sourceHeight}, manifest ${part.item.image.width}x${part.item.image.height}, bounds ${bounds.left},${bounds.top},${bounds.width},${bounds.height}; rendering the in-range crop`,
      );
    }
    if (!texture.add(frameName, 0, left, top, right - left, bottom - top)) {
      warnGearFrameIssue(
        `${key}:${part.source.id}:retain`,
        `[gear] failed to retain manifest frame for "${part.item.id}" (${key}, part ${part.source.id})`,
      );
      return undefined;
    }
  }
  const retainedFrame = texture.get?.(frameName);
  if (
    retainedFrame &&
    finite(retainedFrame.cutX) &&
    finite(retainedFrame.cutY) &&
    finite(retainedFrame.cutWidth) &&
    retainedFrame.cutWidth > 0 &&
    finite(retainedFrame.cutHeight) &&
    retainedFrame.cutHeight > 0
  ) {
    part.originX = (part.source.pivotSource.x - retainedFrame.cutX) / retainedFrame.cutWidth;
    part.originY = (part.source.pivotSource.y - retainedFrame.cutY) / retainedFrame.cutHeight;
  }
  return frameName;
}

/** Resolve catalog ids onto validated manifest rows. Missing/still-rendering art simply contributes no part. */
export function assembleGearLoadout(
  manifest: GearPartsManifest,
  loadout: Readonly<Record<GearSlot, GearId>>,
  prestige = 0,
  towerComposition: readonly GearId[] = [],
): GearLoadoutAssembly {
  if (isGearReplacementManifest(manifest))
    return resolveGearBakeLoadout(manifest, loadout, prestige, towerComposition).extras;
  const parts: GearAssemblyPart[] = [];
  for (const slot of GEAR_SLOTS) {
    if (slot === "hat") continue;
    const gearId = loadout[slot];
    if (!isGearId(gearId) || GEAR_CATALOG[gearId].slot !== slot) continue;
    const item = gearManifestItem(manifest, gearId);
    if (!item) continue;
    for (const source of item.parts)
      parts.push(assemblyPart(manifest, gearId, item, source, -1, 1));
  }

  const equippedHat = loadout.hat;
  const towerTotal = hatTowerTotal(prestige);
  const towerVisible = Math.min(MAX_VISIBLE_HATS, towerTotal);
  if (isGearId(equippedHat) && GEAR_CATALOG[equippedHat].slot === "hat") {
    for (let index = 0; index < towerVisible; index++) {
      const gearId = towerGearId(equippedHat, towerComposition, index);
      const item = gearManifestItem(manifest, gearId);
      if (!item) continue;
      for (const source of item.parts)
        parts.push(assemblyPart(manifest, gearId, item, source, index, towerVisible));
    }
  }
  parts.sort((a, b) => a.depth - b.depth || a.stackIndex - b.stackIndex);
  return {
    parts,
    towerTotal,
    towerVisible,
    towerOverflow: Math.max(0, towerTotal - MAX_VISIBLE_HATS),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Exact damped angular step; stable at the clamped frame interval without Euler energy growth. */
export function stepGearAngularSpring(
  state: HatSpringState,
  target: number,
  elapsedSeconds: number,
  hz: number,
  dampingRatio: number,
): void {
  const dt = clamp(elapsedSeconds, 0, 0.05);
  if (dt <= 0) return;
  const omega = Math.max(0.01, hz) * Math.PI * 2;
  const z = Math.max(0, dampingRatio);
  const x = state.angle - target;
  const velocity = state.velocity;
  let nextX: number;
  let nextVelocity: number;
  if (Math.abs(z - 1) < 1e-4) {
    const decay = Math.exp(-omega * dt);
    nextX = decay * ((1 + omega * dt) * x + dt * velocity);
    nextVelocity = decay * (-omega * omega * dt * x + (1 - omega * dt) * velocity);
  } else if (z < 1) {
    const damped = omega * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * omega * dt);
    const cosine = Math.cos(damped * dt);
    const sine = Math.sin(damped * dt);
    const ratio = (z * omega) / damped;
    nextX = decay * ((cosine + ratio * sine) * x + (sine / damped) * velocity);
    nextVelocity =
      decay * ((-(omega * omega * sine) / damped) * x + (cosine - ratio * sine) * velocity);
  } else {
    const damped = omega * Math.sqrt(z * z - 1);
    const decay = Math.exp(-z * omega * dt);
    const cosine = Math.cosh(damped * dt);
    const sine = Math.sinh(damped * dt);
    const ratio = (z * omega) / damped;
    nextX = decay * ((cosine + ratio * sine) * x + (sine / damped) * velocity);
    nextVelocity =
      decay * ((-(omega * omega * sine) / damped) * x + (cosine - ratio * sine) * velocity);
  }
  state.angle = target + nextX;
  state.velocity = nextVelocity;
}

/**
 * Retained spring chain: every segment follows the angle below at a progressively lower frequency. Dash
 * lean grows toward the top, producing the comic topple without moving gameplay or synchronizing physics.
 */
export function stepHatSpringChain(
  states: readonly HatSpringState[],
  elapsedSeconds: number,
  input: Readonly<HatChainInput>,
  tuning: Readonly<HatChainTuning> = DEFAULT_HAT_CHAIN_TUNING,
): void {
  if (input.reset) {
    for (const state of states) {
      state.angle = 0;
      state.velocity = 0;
    }
    return;
  }
  const maxAngle = (tuning.maxDeg * Math.PI) / 180;
  const motion = input.reducedMotion ? 0 : clamp(input.excitation, -1, 1);
  const dash = input.reducedMotion ? 0 : clamp(input.dashLean, -1, 1);
  const body = clamp(input.bodyAngle * 0.24, -maxAngle * 0.7, maxAngle * 0.7);
  for (let index = 0; index < states.length; index++) {
    const state = states[index];
    if (!state) continue;
    const below = index > 0 ? (states[index - 1]?.angle ?? 0) : body;
    const progressive = states.length <= 1 ? 0 : index / (states.length - 1);
    const localLimit = maxAngle * (1 + progressive * 0.85);
    let target =
      below * (index === 0 ? 0.35 : 0.78) +
      motion * maxAngle * tuning.dragGain * (1 + progressive * 0.25) +
      dash * maxAngle * (0.45 + progressive * 1.15);
    target = clamp(target, -localLimit, localLimit);
    if (!input.reducedMotion && input.landingImpulse !== 0)
      state.velocity += clamp(input.landingImpulse, -1, 1) * (1.1 + progressive * 1.7);
    stepGearAngularSpring(
      state,
      target,
      elapsedSeconds,
      tuning.hz / (1 + index * 0.075),
      tuning.dampingRatio + Math.min(0.12, index * 0.01),
    );
    state.angle = clamp(state.angle, -localLimit, localLimit);
    state.velocity = clamp(state.velocity, -8, 8);
  }
}

const pendingTextures = new Set<string>();
const failedTextures = new Set<string>();

export type GearTextureState = "ready" | "pending" | "missing";

function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  url: string,
  queuedKeys: Set<string>,
): boolean {
  if (scene.textures.exists(key) || failedTextures.has(key)) return false;
  if (pendingTextures.has(key)) {
    if (scene.load.isLoading()) return false;
    pendingTextures.delete(key);
  }
  pendingTextures.add(key);
  queuedKeys.add(key);
  scene.load.image(key, url);
  return true;
}

function finishTextureQueue(scene: Phaser.Scene, queuedKeys: Set<string>): void {
  if (queuedKeys.size === 0) return;
  const onError = (file: Phaser.Loader.File): void => {
    const key = String(file.key);
    if (queuedKeys.has(key)) failedTextures.add(key);
  };
  scene.load.on("loaderror", onError);
  scene.load.once("complete", () => {
    scene.load.off("loaderror", onError);
    for (const key of queuedKeys) {
      pendingTextures.delete(key);
      if (!scene.textures.exists(key)) failedTextures.add(key);
    }
  });
  if (!scene.load.isLoading()) scene.load.start();
}

function textureState(scene: Phaser.Scene, keys: Iterable<string>): GearTextureState {
  let missing = false;
  for (const key of keys) {
    if (scene.textures.exists(key)) continue;
    if (failedTextures.has(key)) missing = true;
    else return "pending";
  }
  return missing ? "missing" : "ready";
}

/** Queue the fixed six-part blank kit once; callers keep their legacy pixels until it becomes ready. */
export function ensureBoilerplateTextures(
  scene: Phaser.Scene,
  manifest: GearPartsManifest,
): GearTextureState {
  const queuedKeys = new Set<string>();
  for (const part of manifest.boilerplate.parts)
    ensureTexture(
      scene,
      boilerplateTextureKey(part.id),
      boilerplateTextureUrl(part.texture),
      queuedKeys,
    );
  finishTextureQueue(scene, queuedKeys);
  return textureState(
    scene,
    manifest.boilerplate.parts.map((part) => boilerplateTextureKey(part.id)),
  );
}

/** Queue each selected loose item once. Paired gloves/boots share one validated 1024px texture. */
export function ensureGearAssemblyTextures(
  scene: Phaser.Scene,
  assembly: GearLoadoutAssembly,
): GearTextureState {
  const queuedKeys = new Set<string>();
  const keys = new Set<string>();
  for (const part of assembly.parts) {
    const key = gearTextureKey(part.item);
    if (keys.has(key)) continue;
    keys.add(key);
    ensureTexture(scene, key, gearTextureUrl(part.item), queuedKeys);
  }
  finishTextureQueue(scene, queuedKeys);
  return textureState(scene, keys);
}
