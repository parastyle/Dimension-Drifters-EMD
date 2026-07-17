/* biome-ignore-all lint/style/noNonNullAssertion: fixed-cap slot/ring indices are bounded by encounter constants. */
import {
  INTERP_EXTRAP_MAX_MS,
  INTERP_SNAP_ENEMY,
  SNAPSHOT_DEPTH,
  TICK_MS,
  WORM_ERUPTION_RADIUS,
  WORM_MAX_SEGMENTS,
  WORM_START_SEGMENTS,
  WormActionKind,
  WormArmorBand,
  WormBossMode,
  type WormBossState,
  WormChain,
  WormSegmentCondition,
  WormSegmentMode,
  WormSegmentRole,
} from "@dd/shared";
import Phaser from "phaser";
import { WormBossVfx } from "../vfx/worm-boss-vfx.js";
import { SPRITE_ATLAS } from "./SpriteRig.js";

const SLOT_COUNT = WORM_MAX_SEGMENTS;
const FRAME_VALUES = SNAPSHOT_DEPTH * SLOT_COUNT;
const TRAIL_CAP = 20;
const WHITE_TEXTURE = "__WHITE";

enum WormCard {
  HeadArmored = 0,
  HeadExposed = 1,
  HeadCritical = 2,
  NeckArmored = 3,
  NeckCracked = 4,
  BodyIntact = 5,
  BodyWounded = 6,
  BodyRegrown = 7,
  SpinnerClosed = 8,
  SpinnerOpen = 9,
  SpinnerWounded = 10,
  TailArmored = 11,
  TailExposed = 12,
  StumpFront = 13,
  StumpRear = 14,
  RegrowthBud = 15,
  RegrowthBudWounded = 16,
}

const CARD_ROLES = [
  "head-armored",
  "head-exposed",
  "head-critical",
  "neck-armored",
  "neck-cracked",
  "body-intact",
  "body-wounded",
  "body-regrown",
  "spinner-closed",
  "spinner-open",
  "spinner-wounded",
  "tail-armored",
  "tail-exposed",
  "stump-front",
  "stump-rear",
  "regrowth-bud",
  "regrowth-bud-wounded",
] as const;

const DIMENSION_ART_SUFFIX_BY_ID: Readonly<Record<string, string>> = {
  "wild-west": "wildwest",
  frostfell: "frostfell",
  "verdant-ruins": "verdant",
  ashlands: "ashlands",
  "neon-cyber": "neoncyber",
};

const ROLE_DIAMETER = new Float32Array([104, 86, 78, 90, 74]);

function dimensionArtSuffix(dimensionId: string): string | undefined {
  return Object.hasOwn(DIMENSION_ART_SUFFIX_BY_ID, dimensionId)
    ? DIMENSION_ART_SUFFIX_BY_ID[dimensionId]
    : undefined;
}

function hasDimensionMaterialPass(card: number): boolean {
  return (
    card === WormCard.HeadArmored ||
    card === WormCard.BodyIntact ||
    card === WormCard.BodyWounded ||
    card === WormCard.SpinnerClosed
  );
}

function flat(frame: number, slot: number): number {
  return frame * SLOT_COUNT + slot;
}

function bit(mask: number, slot: number): boolean {
  return (mask & (1 << slot)) !== 0;
}

function smoothstep01(value: number): number {
  const q = Math.max(0, Math.min(1, value));
  return q * q * (3 - 2 * q);
}

/** Caller-owned output for one whole-worm sample. */
export class WormBatchSample {
  time = 0;
  topologySeq = 0;
  bossMode = WormBossMode.Inactive;
  activeMask = 0;
  targetableMask = 0;
  collidableMask = 0;
  undergroundMask = 0;
  changedMask = 0;
  splitActive = false;
  alpha = 0;
  cut = false;
  readonly x = new Float32Array(SLOT_COUNT);
  readonly y = new Float32Array(SLOT_COUNT);
  readonly generation = new Uint16Array(SLOT_COUNT);
  readonly role = new Uint8Array(SLOT_COUNT);
  readonly condition = new Uint8Array(SLOT_COUNT);
  readonly armorBand = new Uint8Array(SLOT_COUNT);
  readonly mode = new Uint8Array(SLOT_COUNT);
  readonly chain = new Uint8Array(SLOT_COUNT);
  readonly ordinal = new Uint8Array(SLOT_COUNT);
  readonly changeTick = new Uint32Array(SLOT_COUNT);
  readonly integrityQ = new Uint8Array(SLOT_COUNT);
  readonly armorQ = new Uint8Array(SLOT_COUNT);
}

/**
 * The encounter's sole depth-eight snapshot ring. Headers and all twelve slots share one write index, one
 * interpolation bracket, and one alpha. A topology mismatch copies the newer frame wholesale.
 */
export class WormSnapshotRing {
  private readonly times = new Float64Array(SNAPSHOT_DEPTH);
  private readonly poseTicks = new Uint32Array(SNAPSHOT_DEPTH);
  private readonly topologySeqs = new Uint32Array(SNAPSHOT_DEPTH);
  private readonly bossModes = new Uint8Array(SNAPSHOT_DEPTH);
  private readonly activeMasks = new Uint16Array(SNAPSHOT_DEPTH);
  private readonly targetableMasks = new Uint16Array(SNAPSHOT_DEPTH);
  private readonly collidableMasks = new Uint16Array(SNAPSHOT_DEPTH);
  private readonly undergroundMasks = new Uint16Array(SNAPSHOT_DEPTH);
  private readonly changedMasks = new Uint16Array(SNAPSHOT_DEPTH);
  private readonly splitActives = new Uint8Array(SNAPSHOT_DEPTH);
  private readonly xs = new Float32Array(FRAME_VALUES);
  private readonly ys = new Float32Array(FRAME_VALUES);
  private readonly generations = new Uint16Array(FRAME_VALUES);
  private readonly roles = new Uint8Array(FRAME_VALUES);
  private readonly conditions = new Uint8Array(FRAME_VALUES);
  private readonly armorBands = new Uint8Array(FRAME_VALUES);
  private readonly modes = new Uint8Array(FRAME_VALUES);
  private readonly chains = new Uint8Array(FRAME_VALUES);
  private readonly ordinals = new Uint8Array(FRAME_VALUES);
  private readonly changeTicks = new Uint32Array(FRAME_VALUES);
  private readonly integrityQs = new Uint8Array(FRAME_VALUES);
  private readonly armorQs = new Uint8Array(FRAME_VALUES);
  private head = 0;
  private size = 0;

  get length(): number {
    return this.size;
  }

  private index(logical: number): number {
    return (this.head + logical) % SNAPSHOT_DEPTH;
  }

  private differsFrom(frame: number, state: WormBossState): boolean {
    if (
      this.poseTicks[frame] !== state.poseTick ||
      this.topologySeqs[frame] !== state.topologySeq ||
      this.bossModes[frame] !== state.mode ||
      this.activeMasks[frame] !== state.activeMask ||
      this.targetableMasks[frame] !== state.targetableMask ||
      this.collidableMasks[frame] !== state.collidableMask ||
      this.undergroundMasks[frame] !== state.undergroundMask ||
      this.changedMasks[frame] !== state.changedMask ||
      this.splitActives[frame] !== Number(state.splitActive)
    ) {
      return true;
    }
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const row = state.segments[slot];
      const offset = flat(frame, slot);
      if (
        this.generations[offset] !== (row?.generation ?? 0) ||
        this.roles[offset] !== (row?.role ?? 0) ||
        this.conditions[offset] !== (row?.condition ?? 0) ||
        this.armorBands[offset] !== (row?.armorBand ?? 0) ||
        this.modes[offset] !== (row?.mode ?? WormSegmentMode.Dormant) ||
        this.chains[offset] !== (row?.chain ?? WormChain.None) ||
        this.ordinals[offset] !== (row?.ordinal ?? 0) ||
        this.changeTicks[offset] !== (row?.changeTick ?? 0) ||
        this.integrityQs[offset] !== (row?.integrityQ ?? 0) ||
        this.armorQs[offset] !== (row?.armorQ ?? 0)
      ) {
        return true;
      }
    }
    return false;
  }

  private write(frame: number, time: number, state: WormBossState): void {
    this.times[frame] = time;
    this.poseTicks[frame] = state.poseTick;
    this.topologySeqs[frame] = state.topologySeq;
    this.bossModes[frame] = state.mode;
    this.activeMasks[frame] = state.activeMask;
    this.targetableMasks[frame] = state.targetableMask;
    this.collidableMasks[frame] = state.collidableMask;
    this.undergroundMasks[frame] = state.undergroundMask;
    this.changedMasks[frame] = state.changedMask;
    this.splitActives[frame] = Number(state.splitActive);
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const row = state.segments[slot];
      const offset = flat(frame, slot);
      this.xs[offset] = row?.x ?? 0;
      this.ys[offset] = row?.y ?? 0;
      this.generations[offset] = row?.generation ?? 0;
      this.roles[offset] = row?.role ?? 0;
      this.conditions[offset] = row?.condition ?? 0;
      this.armorBands[offset] = row?.armorBand ?? 0;
      this.modes[offset] = row?.mode ?? WormSegmentMode.Dormant;
      this.chains[offset] = row?.chain ?? WormChain.None;
      this.ordinals[offset] = row?.ordinal ?? 0;
      this.changeTicks[offset] = row?.changeTick ?? 0;
      this.integrityQs[offset] = row?.integrityQ ?? 0;
      this.armorQs[offset] = row?.armorQ ?? 0;
    }
  }

  /** Captures pose publications plus immediate metadata edges; inert 20 Hz room patches are ignored. */
  push(state: WormBossState, serverTick: number): void {
    const last = this.size > 0 ? this.index(this.size - 1) : -1;
    if (last >= 0 && !this.differsFrom(last, state)) return;
    const poseChanged = last < 0 || this.poseTicks[last] !== state.poseTick;
    let time = (poseChanged ? state.poseTick : serverTick) * TICK_MS;
    if (last >= 0 && time < this.times[last]!) return;
    if (last >= 0 && time === this.times[last]) {
      this.write(last, time, state);
      return;
    }
    let frame: number;
    if (this.size < SNAPSHOT_DEPTH) {
      frame = this.index(this.size++);
    } else {
      frame = this.head;
      this.head = (this.head + 1) % SNAPSHOT_DEPTH;
    }
    if (last >= 0) time = Math.max(time, this.times[last]! + 0.001);
    this.write(frame, time, state);
  }

  reset(state: WormBossState, serverTick: number): void {
    this.head = 0;
    this.size = 1;
    this.write(0, Math.max(state.poseTick, serverTick) * TICK_MS, state);
  }

  private copyMetadata(frame: number, out: WormBatchSample): void {
    out.time = this.times[frame]!;
    out.topologySeq = this.topologySeqs[frame]!;
    out.bossMode = this.bossModes[frame]! as WormBossMode;
    out.activeMask = this.activeMasks[frame]!;
    out.targetableMask = this.targetableMasks[frame]!;
    out.collidableMask = this.collidableMasks[frame]!;
    out.undergroundMask = this.undergroundMasks[frame]!;
    out.changedMask = this.changedMasks[frame]!;
    out.splitActive = this.splitActives[frame] !== 0;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const offset = flat(frame, slot);
      out.generation[slot] = this.generations[offset]!;
      out.role[slot] = this.roles[offset]!;
      out.condition[slot] = this.conditions[offset]!;
      out.armorBand[slot] = this.armorBands[offset]!;
      out.mode[slot] = this.modes[offset]!;
      out.chain[slot] = this.chains[offset]!;
      out.ordinal[slot] = this.ordinals[offset]!;
      out.changeTick[slot] = this.changeTicks[offset]!;
      out.integrityQ[slot] = this.integrityQs[offset]!;
      out.armorQ[slot] = this.armorQs[offset]!;
    }
  }

  private copyFrame(frame: number, out: WormBatchSample, cut: boolean): WormBatchSample {
    this.copyMetadata(frame, out);
    out.alpha = cut ? 1 : 0;
    out.cut = cut;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const offset = flat(frame, slot);
      out.x[slot] = this.xs[offset]!;
      out.y[slot] = this.ys[offset]!;
    }
    return out;
  }

  private samplePair(a: number, b: number, time: number, out: WormBatchSample): WormBatchSample {
    if (this.topologySeqs[a] !== this.topologySeqs[b]) return this.copyFrame(b, out, true);
    const ax = this.xs[flat(a, 0)]!;
    const ay = this.ys[flat(a, 0)]!;
    const bx = this.xs[flat(b, 0)]!;
    const by = this.ys[flat(b, 0)]!;
    if (Math.hypot(bx - ax, by - ay) > INTERP_SNAP_ENEMY) return this.copyFrame(b, out, true);
    const span = Math.max(0.001, this.times[b]! - this.times[a]!);
    const alpha = Math.max(0, Math.min(1, (time - this.times[a]!) / span));
    // Metadata changes are event edges, never texture/mode blends. Positions still share this one alpha.
    this.copyMetadata(alpha >= 1 ? b : a, out);
    out.time = time;
    out.alpha = alpha;
    out.cut = false;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const ai = flat(a, slot);
      const bi = flat(b, slot);
      out.x[slot] = this.xs[ai]! + (this.xs[bi]! - this.xs[ai]!) * alpha;
      out.y[slot] = this.ys[ai]! + (this.ys[bi]! - this.ys[ai]!) * alpha;
    }
    return out;
  }

  sampleInto(time: number, out: WormBatchSample): WormBatchSample | null {
    if (this.size === 0) return null;
    const first = this.head;
    const last = this.index(this.size - 1);
    if (time <= this.times[first]!) return this.copyFrame(first, out, false);
    if (time >= this.times[last]!) {
      if (this.size < 2) return this.copyFrame(last, out, false);
      const previous = this.index(this.size - 2);
      if (this.topologySeqs[previous] !== this.topologySeqs[last])
        return this.copyFrame(last, out, true);
      const span = this.times[last]! - this.times[previous]!;
      const headDx = this.xs[flat(last, 0)]! - this.xs[flat(previous, 0)]!;
      const headDy = this.ys[flat(last, 0)]! - this.ys[flat(previous, 0)]!;
      if (span <= 0 || Math.hypot(headDx, headDy) > INTERP_SNAP_ENEMY) {
        return this.copyFrame(last, out, true);
      }
      this.copyFrame(last, out, false);
      const ahead = Math.min(time - this.times[last]!, INTERP_EXTRAP_MAX_MS);
      const alpha = ahead / span;
      out.time = time;
      out.alpha = 1 + alpha;
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const a = flat(previous, slot);
        const b = flat(last, slot);
        const stableSurface =
          this.modes[a] === WormSegmentMode.Surface &&
          this.modes[b] === WormSegmentMode.Surface &&
          this.generations[a] === this.generations[b] &&
          this.chains[a] === this.chains[b] &&
          this.ordinals[a] === this.ordinals[b];
        if (!stableSurface) continue;
        out.x[slot] = this.xs[b]! + (this.xs[b]! - this.xs[a]!) * alpha;
        out.y[slot] = this.ys[b]! + (this.ys[b]! - this.ys[a]!) * alpha;
      }
      return out;
    }
    for (let logical = this.size - 1; logical > 0; logical--) {
      const b = this.index(logical);
      const a = this.index(logical - 1);
      if (time >= this.times[a]! && time <= this.times[b]!) {
        return this.samplePair(a, b, time, out);
      }
    }
    return this.copyFrame(last, out, false);
  }
}

function cardFor(role: number, condition: number, armorBand: number, generation: number): WormCard {
  const wounded =
    condition === WormSegmentCondition.Wounded || condition === WormSegmentCondition.BreakReady;
  const open = condition === WormSegmentCondition.ArmorOpen || armorBand === WormArmorBand.Exposed;
  switch (role) {
    case WormSegmentRole.Head:
      if (
        condition === WormSegmentCondition.BreakReady ||
        condition === WormSegmentCondition.Wounded
      ) {
        return WormCard.HeadCritical;
      }
      return open ? WormCard.HeadExposed : WormCard.HeadArmored;
    case WormSegmentRole.Neck:
      return wounded || open || armorBand === WormArmorBand.Cracked
        ? WormCard.NeckCracked
        : WormCard.NeckArmored;
    case WormSegmentRole.Body:
      if (condition === WormSegmentCondition.Regrown || generation > 1) return WormCard.BodyRegrown;
      return wounded || open ? WormCard.BodyWounded : WormCard.BodyIntact;
    case WormSegmentRole.Spinner:
      if (wounded) return WormCard.SpinnerWounded;
      return open ? WormCard.SpinnerOpen : WormCard.SpinnerClosed;
    case WormSegmentRole.Tail:
      return wounded || open ? WormCard.TailExposed : WormCard.TailArmored;
    default:
      return WormCard.BodyIntact;
  }
}

function chromaKeyLooseTexture(scene: Phaser.Scene, rawKey: string, outputKey: string): boolean {
  if (scene.textures.exists(outputKey)) return true;
  if (!scene.textures.exists(rawKey) || typeof document === "undefined") return false;
  const source = scene.textures.get(rawKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const width = source.width;
  const height = source.height;
  if (width <= 1 || height <= 1) return false;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i]!;
    const green = data[i + 1]!;
    const blue = data[i + 2]!;
    if (green <= 175 || green <= red * 2.1 || green <= blue * 2.1) continue;
    const edge = Math.max(red, blue);
    data[i + 1] = Math.min(green, edge);
    data[i + 3] = Math.min(data[i + 3]!, edge * 4);
  }
  context.putImageData(image, 0, 0);
  const texture = scene.textures.addCanvas(outputKey, canvas);
  if (!texture) return false;
  texture.refresh();
  scene.textures.remove(rawKey);
  return true;
}

/** One pooled renderer for the complete synchronized Serraketh owner. */
export class WormRig {
  readonly ownerId: string;
  readonly snapshots = new WormSnapshotRing();

  private readonly sample = new WormBatchSample();
  private readonly segmentImages: Phaser.GameObjects.Image[] = [];
  private readonly budImages: Phaser.GameObjects.Image[] = [];
  private readonly capImages: Phaser.GameObjects.Image[] = [];
  private readonly ao: Phaser.GameObjects.Graphics;
  private readonly vfx: WormBossVfx;
  private readonly mainOrder = new Int8Array(SLOT_COUNT);
  private readonly stubOrder = new Int8Array(SLOT_COUNT);
  private readonly lastAngles = new Float32Array(SLOT_COUNT);
  private readonly lastX = new Float32Array(SLOT_COUNT);
  private readonly lastY = new Float32Array(SLOT_COUNT);
  private readonly lastGeneration = new Uint16Array(SLOT_COUNT);
  private readonly lastRole = new Uint8Array(SLOT_COUNT);
  private readonly lastCondition = new Uint8Array(SLOT_COUNT);
  private readonly lastArmorBand = new Uint8Array(SLOT_COUNT);
  private readonly lastMode = new Uint8Array(SLOT_COUNT);
  private readonly lastChain = new Uint8Array(SLOT_COUNT);
  private readonly lastOrdinal = new Uint8Array(SLOT_COUNT);
  private readonly lastIntegrity = new Uint8Array(SLOT_COUNT);
  private readonly segmentCard = new Int8Array(SLOT_COUNT);
  private readonly segmentRole = new Int8Array(SLOT_COUNT);
  private readonly budCard = new Int8Array(3);
  private readonly capCard = new Int8Array(2);
  private readonly budSlot = new Int8Array(3);
  private readonly capAnchorSlot = new Int8Array(2);
  private readonly capSide = new Int8Array(2);
  private readonly capExpireMs = new Float64Array(2);
  private readonly hitFlashUntil = new Float64Array(SLOT_COUNT);
  private readonly deathUntil = new Float64Array(SLOT_COUNT);
  private readonly deathStart = new Float64Array(SLOT_COUNT);
  private readonly deathX = new Float32Array(SLOT_COUNT);
  private readonly deathY = new Float32Array(SLOT_COUNT);
  private readonly deathAngle = new Float32Array(SLOT_COUNT);
  private readonly trailX = new Float32Array(TRAIL_CAP);
  private readonly trailY = new Float32Array(TRAIL_CAP);
  private trailHead = 0;
  private trailCount = 0;
  private trailFadeUntil = 0;
  private lastTrailSampleTime = -1;
  private readonly textureKeys: string[] = new Array(CARD_ROLES.length).fill(WHITE_TEXTURE);
  private readonly textureFrames: (string | undefined)[] = new Array(CARD_ROLES.length);
  private lastTopologySeq = -1;
  private lastActiveMask = 0;
  private lastActionSeq = -1;
  private lastEruptionSeq = -1;
  private mainCount = 0;
  private stubCount = 0;
  private projectionOriginY = 0;
  private projectionScale = 1;
  private artDimensionId = "";
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    state: WormBossState,
    serverTick: number,
  ) {
    this.ownerId = state.ownerId;
    this.segmentCard.fill(-1);
    this.segmentRole.fill(-1);
    this.budCard.fill(-1);
    this.capCard.fill(-1);
    this.budSlot.fill(-1);
    this.capAnchorSlot.fill(-1);
    this.mainOrder.fill(-1);
    this.stubOrder.fill(-1);
    this.ao = scene.add.graphics().setDepth(1);
    this.vfx = new WormBossVfx(scene);
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      this.segmentImages.push(
        scene.add.image(0, 0, WHITE_TEXTURE).setVisible(false).setOrigin(0.5),
      );
    }
    for (let i = 0; i < 3; i++) {
      this.budImages.push(scene.add.image(0, 0, WHITE_TEXTURE).setVisible(false).setOrigin(0.5));
    }
    for (let i = 0; i < 2; i++) {
      this.capImages.push(scene.add.image(0, 0, WHITE_TEXTURE).setVisible(false).setOrigin(0.5));
    }
    this.snapshots.reset(state, serverTick);
    this.ensureArt();
  }

  setProjection(originY: number, scale: number): void {
    this.projectionOriginY = originY;
    this.projectionScale = scale;
  }

  capture(state: WormBossState, serverTick: number): void {
    if (this.destroyed) return;
    const dimensionId = this.readDimensionId();
    if (dimensionId !== this.artDimensionId) this.ensureArt();
    if (state.ownerId === this.ownerId) this.snapshots.push(state, serverTick);
  }

  private ensureArt(): void {
    this.artDimensionId = this.readDimensionId();
    this.refreshTextureSources();
    let queued = 0;
    const atlas = this.scene.textures.exists(SPRITE_ATLAS)
      ? this.scene.textures.get(SPRITE_ATLAS)
      : null;
    for (let card = 0; card < CARD_ROLES.length; card++) {
      const role = CARD_ROLES[card]!;
      const shortFrame = `seam-eater/${role}`;
      const fullFrame = `seam-eater/seam-eater-${role}`;
      const outputKey = `seam-eater:${role}`;
      const rawKey = `seam-eater:raw:${role}`;
      const hasCanonical =
        atlas?.has(shortFrame) ||
        atlas?.has(fullFrame) ||
        this.scene.textures.exists(outputKey) ||
        this.scene.textures.exists(rawKey);
      if (!hasCanonical) {
        this.scene.load.image(rawKey, `sprites/seam-eater/seam-eater-${role}.png`);
        queued++;
      }
    }
    const suffix = dimensionArtSuffix(this.artDimensionId);
    if (suffix) {
      for (let card = 0; card < CARD_ROLES.length; card++) {
        if (!hasDimensionMaterialPass(card)) continue;
        const role = CARD_ROLES[card]!;
        const outputKey = `seam-eater:${role}--${suffix}`;
        const rawKey = `seam-eater:raw:${role}--${suffix}`;
        if (this.scene.textures.exists(outputKey) || this.scene.textures.exists(rawKey)) continue;
        this.scene.load.image(rawKey, `sprites/seam-eater/seam-eater-${role}--${suffix}.png`);
        queued++;
      }
    }
    if (queued === 0) return;
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.refreshTextureSources();
    });
    this.scene.load.start();
  }

  private refreshTextureSources(): void {
    const suffix = dimensionArtSuffix(this.readDimensionId());
    const hasAtlas = this.scene.textures.exists(SPRITE_ATLAS);
    const atlas = hasAtlas ? this.scene.textures.get(SPRITE_ATLAS) : null;
    let changed = false;
    for (let card = 0; card < CARD_ROLES.length; card++) {
      const role = CARD_ROLES[card]!;
      let key = WHITE_TEXTURE;
      let frame: string | undefined;
      const shortFrame = `seam-eater/${role}`;
      const fullFrame = `seam-eater/seam-eater-${role}`;
      if (atlas?.has(shortFrame)) {
        key = SPRITE_ATLAS;
        frame = shortFrame;
      } else if (atlas?.has(fullFrame)) {
        key = SPRITE_ATLAS;
        frame = fullFrame;
      } else {
        const outputKey = `seam-eater:${role}`;
        const rawKey = `seam-eater:raw:${role}`;
        chromaKeyLooseTexture(this.scene, rawKey, outputKey);
        if (this.scene.textures.exists(outputKey)) key = outputKey;
      }
      if (suffix && hasDimensionMaterialPass(card)) {
        const outputKey = `seam-eater:${role}--${suffix}`;
        const rawKey = `seam-eater:raw:${role}--${suffix}`;
        chromaKeyLooseTexture(this.scene, rawKey, outputKey);
        if (this.scene.textures.exists(outputKey)) {
          key = outputKey;
          frame = undefined;
        }
      }
      if (this.textureKeys[card] !== key || this.textureFrames[card] !== frame) changed = true;
      this.textureKeys[card] = key;
      this.textureFrames[card] = frame;
    }
    if (changed) {
      this.segmentCard.fill(-1);
      this.budCard.fill(-1);
      this.capCard.fill(-1);
    }
  }

  private readDimensionId(): string {
    const dimensionId = (
      this.scene as Phaser.Scene & { room?: { state?: { dimensionId?: unknown } } }
    ).room?.state?.dimensionId;
    return typeof dimensionId === "string" ? dimensionId : "";
  }

  private setCard(
    image: Phaser.GameObjects.Image,
    cards: Int8Array,
    index: number,
    card: WormCard,
  ): void {
    if (cards[index] === card) return;
    cards[index] = card;
    image.setTexture(this.textureKeys[card]!, this.textureFrames[card]);
  }

  private projectY(y: number): number {
    return this.projectionOriginY + (y - this.projectionOriginY) * this.projectionScale;
  }

  private rebuildOrders(sample: WormBatchSample): void {
    this.mainOrder.fill(-1);
    this.stubOrder.fill(-1);
    this.mainCount = 0;
    this.stubCount = 0;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!bit(sample.activeMask, slot)) continue;
      const ordinal = sample.ordinal[slot]!;
      if (sample.chain[slot] === WormChain.Main && ordinal < SLOT_COUNT) {
        this.mainOrder[ordinal] = slot;
        this.mainCount = Math.max(this.mainCount, ordinal + 1);
      } else if (sample.chain[slot] === WormChain.Stub && ordinal < SLOT_COUNT) {
        this.stubOrder[ordinal] = slot;
        this.stubCount = Math.max(this.stubCount, ordinal + 1);
      }
    }
  }

  private updateAngles(sample: WormBatchSample): void {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!bit(sample.activeMask, slot)) continue;
      const order = sample.chain[slot] === WormChain.Stub ? this.stubOrder : this.mainOrder;
      const ordinal = sample.ordinal[slot]!;
      const previous = ordinal > 0 ? order[ordinal - 1]! : -1;
      const next = ordinal + 1 < SLOT_COUNT ? order[ordinal + 1]! : -1;
      let dx = 0;
      let dy = 0;
      // Source cards face right/headward, so the tangent points from the tailward neighbour toward the head.
      if (previous >= 0 && next >= 0) {
        dx = sample.x[previous]! - sample.x[next]!;
        dy = sample.y[previous]! - sample.y[next]!;
      } else if (previous >= 0) {
        dx = sample.x[previous]! - sample.x[slot]!;
        dy = sample.y[previous]! - sample.y[slot]!;
      } else if (next >= 0) {
        dx = sample.x[slot]! - sample.x[next]!;
        dy = sample.y[slot]! - sample.y[next]!;
      }
      if (dx * dx + dy * dy > 0.0001) this.lastAngles[slot] = Math.atan2(dy, dx);
    }
  }

  private assignCaps(sample: WormBatchSample, nowMs: number): void {
    this.capAnchorSlot.fill(-1);
    this.capExpireMs.fill(0);
    if (sample.splitActive) {
      const mainEnd = this.mainCount > 0 ? this.mainOrder[this.mainCount - 1]! : -1;
      const stubFront = this.stubCount > 0 ? this.stubOrder[0]! : -1;
      if (mainEnd >= 0) {
        this.capAnchorSlot[0] = mainEnd;
        this.capSide[0] = -1;
        this.capExpireMs[0] = Number.POSITIVE_INFINITY;
      }
      if (stubFront >= 0) {
        this.capAnchorSlot[1] = stubFront;
        this.capSide[1] = 1;
        this.capExpireMs[1] = Number.POSITIVE_INFINITY;
      }
      return;
    }
    const removed = this.lastActiveMask & ~sample.activeMask;
    if (removed === 0) return;
    let severed = -1;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (bit(removed, slot)) {
        severed = slot;
        break;
      }
    }
    if (severed < 0) return;
    const chain = this.lastChain[severed]!;
    const ordinal = this.lastOrdinal[severed]!;
    let headward = -1;
    let tailward = -1;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (!bit(sample.activeMask, slot) || this.lastChain[slot] !== chain) continue;
      const candidate = this.lastOrdinal[slot]!;
      if (candidate < ordinal && (headward < 0 || candidate > this.lastOrdinal[headward]!)) {
        headward = slot;
      }
      if (candidate > ordinal && (tailward < 0 || candidate < this.lastOrdinal[tailward]!)) {
        tailward = slot;
      }
    }
    if (headward >= 0) {
      this.capAnchorSlot[0] = headward;
      this.capSide[0] = -1;
      this.capExpireMs[0] = nowMs + 520;
    }
    if (tailward >= 0) {
      this.capAnchorSlot[1] = tailward;
      this.capSide[1] = 1;
      this.capExpireMs[1] = nowMs + 520;
    }
  }

  private topologyEdge(sample: WormBatchSample, nowMs: number): void {
    if (this.lastTopologySeq < 0) {
      this.lastTopologySeq = sample.topologySeq;
      if (sample.splitActive) this.assignCaps(sample, nowMs);
      return;
    }
    if (sample.topologySeq === this.lastTopologySeq) return;
    const removed = this.lastActiveMask & ~sample.activeMask;
    const added = sample.activeMask & ~this.lastActiveMask;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (bit(removed, slot)) {
        this.deathStart[slot] = nowMs;
        this.deathUntil[slot] = nowMs + 220;
        this.deathX[slot] = this.lastX[slot]!;
        this.deathY[slot] = this.lastY[slot]!;
        this.deathAngle[slot] = this.lastAngles[slot]!;
        this.vfx.emitSever(
          this.lastX[slot]!,
          this.lastY[slot]!,
          this.lastAngles[slot]!,
          sample.topologySeq * 31 + slot,
        );
        this.vfx.localShake(this.lastX[slot]!, this.lastY[slot]!, nowMs, 105, 0.006);
      }
      if (bit(added, slot)) {
        this.vfx.emitRegrowth(sample.x[slot]!, sample.y[slot]!, sample.topologySeq * 43 + slot);
      }
      if (
        this.lastMode[slot] === WormSegmentMode.Bud &&
        sample.mode[slot] === WormSegmentMode.Destroyed
      ) {
        this.vfx.emitSever(
          this.lastX[slot]!,
          this.lastY[slot]!,
          this.lastAngles[slot]!,
          sample.topologySeq * 59 + slot,
        );
      }
    }
    this.assignCaps(sample, nowMs);
    this.lastTopologySeq = sample.topologySeq;
  }

  private updateCaps(sample: WormBatchSample, nowMs: number): void {
    for (let index = 0; index < 2; index++) {
      const image = this.capImages[index]!;
      const slot = this.capAnchorSlot[index]!;
      if (slot < 0 || nowMs >= this.capExpireMs[index]! || !bit(sample.activeMask, slot)) {
        image.setVisible(false);
        continue;
      }
      const side = this.capSide[index]!;
      const angle = this.lastAngles[slot]!;
      const diameter = ROLE_DIAMETER[sample.role[slot]!] ?? 78;
      const x = sample.x[slot]! + Math.cos(angle) * diameter * 0.34 * side;
      const y = sample.y[slot]! + Math.sin(angle) * diameter * 0.34 * side;
      const card = side > 0 ? WormCard.StumpFront : WormCard.StumpRear;
      this.setCard(image, this.capCard, index, card);
      image
        .setVisible(true)
        .setPosition(x, this.projectY(y))
        .setRotation(angle)
        .setAlpha(0.94)
        .clearTint();
      image.displayWidth = diameter * 0.76;
      image.displayHeight = diameter * 0.76;
      image.setDepth(this.projectY(y) + 72 + (side > 0 ? 0.02 : 0.01));
    }
  }

  private assignBuds(sample: WormBatchSample): void {
    for (let i = 0; i < 3; i++) {
      const slot = this.budSlot[i]!;
      if (slot >= 0 && sample.mode[slot] !== WormSegmentMode.Bud) this.budSlot[i] = -1;
    }
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      if (sample.mode[slot] !== WormSegmentMode.Bud) continue;
      let assigned = false;
      for (let i = 0; i < 3; i++) if (this.budSlot[i] === slot) assigned = true;
      if (assigned) continue;
      for (let i = 0; i < 3; i++) {
        if (this.budSlot[i]! >= 0) continue;
        this.budSlot[i] = slot;
        break;
      }
    }
  }

  private updateBuds(sample: WormBatchSample, serverTick: number): void {
    this.assignBuds(sample);
    for (let index = 0; index < 3; index++) {
      const image = this.budImages[index]!;
      const slot = this.budSlot[index]!;
      if (slot < 0 || sample.mode[slot] !== WormSegmentMode.Bud) {
        image.setVisible(false);
        continue;
      }
      const wounded =
        sample.condition[slot] === WormSegmentCondition.Wounded ||
        sample.condition[slot] === WormSegmentCondition.BreakReady ||
        sample.integrityQ[slot]! < 142;
      this.setCard(
        image,
        this.budCard,
        index,
        wounded ? WormCard.RegrowthBudWounded : WormCard.RegrowthBud,
      );
      const unfold = smoothstep01((serverTick - sample.changeTick[slot]!) / 8);
      const x = sample.x[slot]!;
      const y = this.projectY(sample.y[slot]!);
      image
        .setVisible(true)
        .setPosition(x, y)
        .setRotation(this.lastAngles[slot]! + (1 - unfold) * 0.18)
        .setAlpha(bit(sample.targetableMask, slot) ? 1 : 0.68);
      image.displayWidth = 64 * (0.35 + unfold * 0.65);
      image.displayHeight = 64 * (0.12 + unfold * 0.88);
      if (bit(sample.targetableMask, slot)) image.clearTint();
      else image.setTint(0x98939d);
      image.setDepth(y + 64 + slot * 0.001);
    }
  }

  private updateTrail(sample: WormBatchSample, nowMs: number): void {
    const burrowed =
      sample.bossMode === WormBossMode.Underground ||
      sample.bossMode === WormBossMode.EruptionClaim ||
      sample.undergroundMask !== 0;
    if (burrowed && sample.time !== this.lastTrailSampleTime) {
      const x = sample.x[0]!;
      const y = sample.y[0]!;
      let append = this.trailCount === 0;
      if (!append) {
        const previous = (this.trailHead - 1 + TRAIL_CAP) % TRAIL_CAP;
        append = Math.hypot(x - this.trailX[previous]!, y - this.trailY[previous]!) >= 8;
      }
      if (append) {
        this.trailX[this.trailHead] = x;
        this.trailY[this.trailHead] = y;
        this.trailHead = (this.trailHead + 1) % TRAIL_CAP;
        this.trailCount = Math.min(TRAIL_CAP, this.trailCount + 1);
      }
      this.lastTrailSampleTime = sample.time;
      this.trailFadeUntil = nowMs + 520;
    }
    if (burrowed || nowMs < this.trailFadeUntil) {
      this.vfx.drawBurrowTrail(
        this.trailX,
        this.trailY,
        this.trailCount,
        this.trailHead,
        nowMs,
        this.projectionOriginY,
        this.projectionScale,
      );
    }
  }

  private updateAction(
    state: WormBossState,
    sample: WormBatchSample,
    serverTick: number,
    nowMs: number,
  ): void {
    if (state.actionSeq !== this.lastActionSeq) {
      this.lastActionSeq = state.actionSeq;
      if (state.actionKind === WormActionKind.SeamDive) {
        this.trailHead = 0;
        this.trailCount = 0;
        this.lastTrailSampleTime = -1;
      }
    }
    const action = state.actionKind as WormActionKind;
    if (action === WormActionKind.Eruption) {
      const span = Math.max(1, state.actionResolveTick - state.actionStartTick);
      const phase = Math.max(0, Math.min(1, (serverTick - state.actionStartTick) / span));
      this.vfx.drawEruptionPaint(
        state.actionTargetX,
        state.actionTargetY,
        WORM_ERUPTION_RADIUS,
        phase,
        this.projectionOriginY,
        this.projectionScale,
      );
      this.vfx.drawEdgeDirection(state.actionTargetX, this.projectY(state.actionTargetY), 0xd96a4f);
      if (serverTick >= state.actionResolveTick && this.lastEruptionSeq !== state.actionSeq) {
        this.lastEruptionSeq = state.actionSeq;
        this.vfx.emitEruption(
          state.actionTargetX,
          state.actionTargetY,
          WORM_ERUPTION_RADIUS,
          state.actionSeq * 101 + state.actionResolveTick,
        );
        this.vfx.localShake(state.actionTargetX, state.actionTargetY, nowMs, 190, 0.017);
      }
    } else {
      this.vfx.clearEdgeDirection();
    }

    const parryAction = action === WormActionKind.RibQuake || action === WormActionKind.StitchReap;
    const emitter = state.actionEmitterSlot;
    const validEmitter =
      emitter < SLOT_COUNT &&
      bit(sample.activeMask, emitter) &&
      sample.generation[emitter] === state.actionEmitterGeneration &&
      state.actionTopologySeq === sample.topologySeq;
    if (
      parryAction &&
      validEmitter &&
      serverTick >= state.actionResolveTick - 3 &&
      serverTick <= state.actionResolveTick
    ) {
      const progress = Math.max(0, Math.min(1, (serverTick - (state.actionResolveTick - 3)) / 3));
      this.vfx.drawGlint(
        sample.x[emitter]!,
        sample.y[emitter]!,
        this.lastAngles[emitter]!,
        progress,
        serverTick >= state.actionResolveTick,
        this.projectionOriginY,
        this.projectionScale,
      );
    } else {
      this.vfx.clearGlint();
    }
  }

  private drawAo(sample: WormBatchSample): void {
    this.ao.clear();
    let minDepth = Number.POSITIVE_INFINITY;
    for (let chainIndex = 0; chainIndex < 2; chainIndex++) {
      const order = chainIndex === 0 ? this.mainOrder : this.stubOrder;
      const count = chainIndex === 0 ? this.mainCount : this.stubCount;
      for (let ordinal = 0; ordinal < count; ordinal++) {
        const slot = order[ordinal]!;
        if (slot < 0 || bit(sample.undergroundMask, slot)) continue;
        const x = sample.x[slot]!;
        const y = this.projectY(sample.y[slot]! + 9);
        minDepth = Math.min(minDepth, y);
        this.ao.fillStyle(0x0c0910, 0.14);
        this.ao.fillEllipse(x, y, (ROLE_DIAMETER[sample.role[slot]!] ?? 78) * 0.78, 24);
        if (ordinal <= 0) continue;
        const previous = order[ordinal - 1]!;
        if (previous < 0 || bit(sample.undergroundMask, previous)) continue;
        this.ao.lineStyle(22, 0x0c0910, 0.12);
        this.ao.lineBetween(sample.x[previous]!, this.projectY(sample.y[previous]! + 9), x, y);
      }
    }
    if (Number.isFinite(minDepth)) this.ao.setDepth(minDepth - 90);
  }

  private renderSegments(sample: WormBatchSample, serverTick: number, nowMs: number): void {
    const view = this.scene.cameras.main.worldView;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const image = this.segmentImages[slot]!;
      const active = bit(sample.activeMask, slot);
      const underground =
        bit(sample.undergroundMask, slot) ||
        sample.mode[slot] === WormSegmentMode.Submerging ||
        sample.mode[slot] === WormSegmentMode.Underground;
      if (!active || underground || sample.mode[slot] === WormSegmentMode.Bud) {
        if (!active && nowMs < this.deathUntil[slot]!) {
          const q = smoothstep01(
            (nowMs - this.deathStart[slot]!) /
              Math.max(1, this.deathUntil[slot]! - this.deathStart[slot]!),
          );
          image
            .setVisible(true)
            .setPosition(this.deathX[slot]!, this.projectY(this.deathY[slot]!))
            .setRotation(this.deathAngle[slot]! + Math.sin(q * Math.PI) * 0.18)
            .setAlpha(1 - q)
            .setDepth(this.projectY(this.deathY[slot]!) + 84);
          const diameter = ROLE_DIAMETER[this.lastRole[slot]!] ?? 78;
          image.displayWidth = diameter * (1 + q * 0.18);
          image.displayHeight = diameter * Math.max(0.05, 1 - q);
        } else {
          image.setVisible(false);
        }
        continue;
      }
      const role = sample.role[slot]!;
      if (this.segmentRole[slot] !== role) {
        this.segmentRole[slot] = role;
        this.segmentCard[slot] = -1;
      }
      const card = cardFor(
        role,
        sample.condition[slot]!,
        sample.armorBand[slot]!,
        sample.generation[slot]!,
      );
      this.setCard(image, this.segmentCard, slot, card);
      const worldX = sample.x[slot]!;
      const worldY = sample.y[slot]!;
      const y = this.projectY(worldY);
      const farOffscreen =
        worldX < view.left - 190 ||
        worldX > view.right + 190 ||
        y < view.top - 190 ||
        y > view.bottom + 190;
      if (farOffscreen) {
        image.setVisible(false);
        continue;
      }
      let verticalScale = 1;
      let alpha = bit(sample.targetableMask, slot) ? 1 : 0.72;
      if (
        sample.mode[slot] === WormSegmentMode.Emerging ||
        sample.mode[slot] === WormSegmentMode.ArmGrace
      ) {
        const appear = smoothstep01((serverTick - sample.changeTick[slot]!) / 6);
        verticalScale = 0.48 + appear * 0.52;
        alpha *= 0.76 + appear * 0.24;
      } else if (sample.mode[slot] === WormSegmentMode.Reconnecting) {
        verticalScale = 0.92 + Math.sin(serverTick * 1.4 + slot) * 0.035;
      }
      let rotation = this.lastAngles[slot]!;
      if (sample.condition[slot] === WormSegmentCondition.BreakReady) {
        rotation += Math.sin(serverTick * 2.1 + slot * 1.7) * 0.035;
      }
      image.setVisible(true).setPosition(worldX, y).setRotation(rotation).setAlpha(alpha);
      const diameter = ROLE_DIAMETER[role] ?? 78;
      image.displayWidth = diameter;
      image.displayHeight = diameter * verticalScale;
      if (this.textureKeys[card] === WHITE_TEXTURE) image.setTint(0x29242d);
      else if (nowMs < this.hitFlashUntil[slot]!) image.setTint(0xffffff);
      else if (sample.mode[slot] === WormSegmentMode.ArmGrace) image.setTint(0xc3e7df);
      else if (!bit(sample.targetableMask, slot)) image.setTint(0x99939e);
      else image.clearTint();
      const ordinalLift = (SLOT_COUNT - sample.ordinal[slot]!) * 7;
      const chainBand = sample.chain[slot] === WormChain.Stub ? -0.1 : 0;
      image.setDepth(y + ordinalLift + chainBand + slot * 0.001);
    }
  }

  private emitModeEdges(sample: WormBatchSample): void {
    if (this.lastTopologySeq < 0) return;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const nowUnderground =
        sample.mode[slot] === WormSegmentMode.Submerging ||
        sample.mode[slot] === WormSegmentMode.Underground;
      const wasUnderground =
        this.lastMode[slot] === WormSegmentMode.Submerging ||
        this.lastMode[slot] === WormSegmentMode.Underground;
      if (nowUnderground && !wasUnderground) {
        this.vfx.emitDiveDust(sample.x[slot]!, sample.y[slot]!, sample.topologySeq * 17 + slot);
      }
      if (sample.integrityQ[slot]! < this.lastIntegrity[slot]!) {
        this.hitFlashUntil[slot] = this.scene.time.now + 92;
      }
    }
  }

  private remember(sample: WormBatchSample): void {
    this.lastActiveMask = sample.activeMask;
    this.lastX.set(sample.x);
    this.lastY.set(sample.y);
    this.lastGeneration.set(sample.generation);
    this.lastRole.set(sample.role);
    this.lastCondition.set(sample.condition);
    this.lastArmorBand.set(sample.armorBand);
    this.lastMode.set(sample.mode);
    this.lastChain.set(sample.chain);
    this.lastOrdinal.set(sample.ordinal);
    this.lastIntegrity.set(sample.integrityQ);
  }

  update(
    renderTimeMs: number,
    state: WormBossState,
    serverTick: number,
    nowMs: number,
    deltaMs: number,
  ): void {
    if (this.destroyed) return;
    const sample = this.snapshots.sampleInto(renderTimeMs, this.sample);
    if (!sample) return;
    this.rebuildOrders(sample);
    this.updateAngles(sample);
    this.emitModeEdges(sample);
    this.topologyEdge(sample, nowMs);
    this.vfx.beginGroundFrame();
    this.updateTrail(sample, nowMs);
    this.updateAction(state, sample, serverTick, nowMs);
    this.drawAo(sample);
    this.renderSegments(sample, serverTick, nowMs);
    this.updateBuds(sample, serverTick);
    this.updateCaps(sample, nowMs);
    this.vfx.update(deltaMs, this.projectionOriginY, this.projectionScale);
    this.remember(sample);
  }

  /** Adds the entrance anatomy notches to ArenaScene's existing single boss bar. */
  drawBossBarNotches(
    graphics: Phaser.GameObjects.Graphics,
    state: WormBossState,
    left: number,
    width: number,
    top: number,
    bottom: number,
    scale: number,
  ): void {
    let count = WORM_START_SEGMENTS;
    for (let slot = WORM_START_SEGMENTS; slot < SLOT_COUNT; slot++) {
      if ((state.segments[slot]?.generation ?? 0) > 0) count++;
    }
    const gap = width / (count + 1);
    let visual = 0;
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const row = state.segments[slot];
      if (!row || (slot >= WORM_START_SEGMENTS && row.generation === 0)) continue;
      visual++;
      const x = left + gap * visual;
      const destroyed = row.condition === WormSegmentCondition.Destroyed;
      const regrown = row.condition === WormSegmentCondition.Regrown || row.generation > 1;
      const open =
        row.condition === WormSegmentCondition.ArmorOpen || row.armorBand === WormArmorBand.Exposed;
      const wounded =
        row.condition === WormSegmentCondition.Wounded ||
        row.condition === WormSegmentCondition.BreakReady;
      if (destroyed) {
        graphics.lineStyle(1.4 * scale, 0x8b6c68, 0.5);
        graphics.lineBetween(x - 2.5 * scale, top + 2 * scale, x + 2.5 * scale, bottom - 2 * scale);
        graphics.lineBetween(x + 2.5 * scale, top + 2 * scale, x - 2.5 * scale, bottom - 2 * scale);
        continue;
      }
      const color = regrown ? 0xbfe5db : open ? 0xe3c7ff : wounded ? 0xd69078 : 0xd8cfba;
      graphics.lineStyle((open ? 2.4 : 1.7) * scale, color, open ? 0.95 : 0.78);
      graphics.lineBetween(x, top + scale, x, bottom - scale);
      if (row.condition === WormSegmentCondition.BreakReady) {
        graphics.lineStyle(1.1 * scale, 0x3b1720, 0.9);
        graphics.lineBetween(x - 2 * scale, (top + bottom) * 0.5, x + 2 * scale, bottom - scale);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const image of this.segmentImages) image.destroy();
    for (const image of this.budImages) image.destroy();
    for (const image of this.capImages) image.destroy();
    this.ao.destroy();
    this.vfx.destroy();
  }
}
