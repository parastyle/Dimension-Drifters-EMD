import { GEAR_CATALOG, GEAR_SLOTS, type GearId, type GearSlot, isGearId } from "@dd/shared";
import type Phaser from "phaser";
import generatedManifest from "../../../../tools/artkit/out/gear/gear-parts-manifest.json";

export const GEAR_SOCKET_FRAME_ID = "GEAR_SOCKET_FRAME_V1" as const;
export const HAT_STACK_BAND_ID = "HAT_STACK_BAND_V1" as const;
export const MAX_VISIBLE_HATS = 12;
export const MAX_HAT_SLOTS = 30;

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
  receiverAnchor: GearReceiverAnchor;
  restAngle: number;
  mountScale: number;
  plane: number;
  spring: GearPartSpringManifest | null;
  alphaBounds: { left: number; top: number; width: number; height: number };
}

export interface GearManifestItem {
  id: string;
  name: string;
  setId: string;
  slot: GearSlot;
  slotDirectory: string;
  texture: string;
  image: { width: number; height: number };
  parts: GearManifestPart[];
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
  image: { width: number; height: number };
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
}

export interface GearLoadoutAssembly {
  parts: GearAssemblyPart[];
  towerTotal: number;
  towerVisible: number;
  towerOverflow: number;
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
    isRecord(image) &&
    finite(image.width) &&
    finite(image.height) &&
    image.width > 0 &&
    image.height > 0
  );
}

/** Validate the generated art contract without requiring all still-rendering slots to be present. */
export function validateGearPartsManifest(value: unknown): GearPartsManifest | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
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
      itemIds.add(item.id);
    }
  }
  for (const slot of GEAR_SLOTS) if (!slots.has(slot)) return null;
  return value as unknown as GearPartsManifest;
}

/** Synchronous because Vite bundles the generated machine manifest with this typed loader. */
export const GEAR_PARTS_MANIFEST = validateGearPartsManifest(generatedManifest as unknown);

export function boilerplateTextureKey(partId: string): string {
  return `boilerplate:${partId}`;
}

export function boilerplateTextureUrl(texture: string): string {
  return `sprites/boilerplate/${texture}`;
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
      let x = 0;
      let y = 0;
      if (source.id === "head") {
        x = source.receiverAnchor.xL * targetBodyHeight;
        y = source.receiverAnchor.yL * targetBodyHeight;
      } else if (source.id !== "body") {
        x = (source.pivotSource.x - root.x) * scale;
        y = (source.pivotSource.y - root.y) * scale;
      }
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
  for (const slot of manifest.slots) {
    if (slot.id !== def.slot) continue;
    for (const item of slot.items) {
      if (item.id === expectedId) return item;
      if (def.legacySetId && item.setId === def.legacySetId) return item;
    }
    return undefined;
  }
  return undefined;
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
): GearAssemblyPart {
  const targetBodyHeight = 76;
  const stackScale = stackIndex >= 0 ? hatStackScale(stackIndex, stackCount) : 1;
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
  };
}

/**
 * Promote a manifest part's alpha bounds to a retained Phaser frame. Multi-part masters (paired gloves,
 * paired boots, cloak/clasp) can then move each authored component without drawing its siblings twice.
 */
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
    if (!texture.add(frameName, 0, bounds.left, bounds.top, bounds.width, bounds.height))
      return undefined;
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
