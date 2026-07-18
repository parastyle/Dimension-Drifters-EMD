import { type MoveStance, type PetId, type PetStageBand, STANCE_DASH } from "@dd/shared";
import type Phaser from "phaser";
import {
  assemblePetStage,
  ensurePetStageTextures,
  type PetAssemblyPart,
  type PetManifestStage,
  type PetPartsManifest,
  petManifestStage,
  petTextureKey,
} from "../sprites/pet-parts.js";

export interface PetFollowState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ready: boolean;
}

export interface PetFollowTuning {
  hz: number;
  damping: number;
  maxSpeed: number;
  maxAcceleration: number;
}

export const PET_FOLLOW_TUNING: Readonly<PetFollowTuning> = {
  hz: 4.25,
  damping: 0.78,
  maxSpeed: 340,
  maxAcceleration: 2_600,
};

export const PET_SETTLE_TUNING: Readonly<PetFollowTuning> = {
  hz: 6.2,
  damping: 0.58,
  maxSpeed: 520,
  maxAcceleration: 5_600,
};

const MAX_FOLLOW_DT = 0.1;
const FOLLOW_SUBSTEP = 1 / 120;
const ORBIT_PERIOD_SECONDS = 2.8;
const LAG_SAMPLE_MS = 100;
const OWNER_HISTORY_SIZE = 16;
const LOD_MARGIN = 96;
const DART_TRIGGER_PX = 78;
const DART_SPEED = 920;
const MODE_NORMAL = 0;
const MODE_COMPRESS = 1;
const MODE_DART = 2;
const MODE_SETTLE = 3;
const MODE_TELEPORT = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Allocation-free capped second-order step. Small substeps keep the authored high frequency stable. */
export function stepPetFollowSpring(
  state: PetFollowState,
  targetX: number,
  targetY: number,
  elapsedSeconds: number,
  tuning: Readonly<PetFollowTuning> = PET_FOLLOW_TUNING,
): void {
  if (!state.ready || !Number.isFinite(state.x + state.y + state.vx + state.vy)) {
    state.x = targetX;
    state.y = targetY;
    state.vx = 0;
    state.vy = 0;
    state.ready = true;
    return;
  }
  let remaining = clamp(elapsedSeconds, 0, MAX_FOLLOW_DT);
  const omega = Math.PI * 2 * tuning.hz;
  while (remaining > 1e-7) {
    const dt = Math.min(FOLLOW_SUBSTEP, remaining);
    let ax = omega * omega * (targetX - state.x) - 2 * tuning.damping * omega * state.vx;
    let ay = omega * omega * (targetY - state.y) - 2 * tuning.damping * omega * state.vy;
    const acceleration = Math.hypot(ax, ay);
    if (acceleration > tuning.maxAcceleration) {
      const scale = tuning.maxAcceleration / acceleration;
      ax *= scale;
      ay *= scale;
    }
    state.vx += ax * dt;
    state.vy += ay * dt;
    const speed = Math.hypot(state.vx, state.vy);
    if (speed > tuning.maxSpeed) {
      const scale = tuning.maxSpeed / speed;
      state.vx *= scale;
      state.vy *= scale;
    }
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    remaining -= dt;
  }
  if (
    Math.hypot(targetX - state.x, targetY - state.y) < 0.35 &&
    Math.hypot(state.vx, state.vy) < 2
  ) {
    state.x = targetX;
    state.y = targetY;
    state.vx = 0;
    state.vy = 0;
  }
}

interface PetRigPart {
  image: Phaser.GameObjects.Image;
  assembly: PetAssemblyPart;
  angle: number;
  velocity: number;
}

function stepAngularSpring(
  part: PetRigPart,
  target: number,
  dt: number,
  hz: number,
  damping: number,
): void {
  if (dt <= 0) return;
  const omega = hz * Math.PI * 2;
  const z = damping;
  const x = part.angle - target;
  const v = part.velocity;
  let nextX: number;
  let nextV: number;
  if (Math.abs(z - 1) < 1e-4) {
    const decay = Math.exp(-omega * dt);
    nextX = decay * ((1 + omega * dt) * x + dt * v);
    nextV = decay * (-omega * omega * dt * x + (1 - omega * dt) * v);
  } else if (z < 1) {
    const damped = omega * Math.sqrt(1 - z * z);
    const decay = Math.exp(-z * omega * dt);
    const cosine = Math.cos(damped * dt);
    const sine = Math.sin(damped * dt);
    const ratio = (z * omega) / damped;
    nextX = decay * ((cosine + ratio * sine) * x + (sine / damped) * v);
    nextV = decay * ((-(omega * omega * sine) / damped) * x + (cosine - ratio * sine) * v);
  } else {
    const damped = omega * Math.sqrt(z * z - 1);
    const decay = Math.exp(-z * omega * dt);
    const cosine = Math.cosh(damped * dt);
    const sine = Math.sinh(damped * dt);
    const ratio = (z * omega) / damped;
    nextX = decay * ((cosine + ratio * sine) * x + (sine / damped) * v);
    nextV = decay * ((-(omega * omega * sine) / damped) * x + (cosine - ratio * sine) * v);
  }
  part.angle = target + nextX;
  part.velocity = nextV;
}

function buildStageVisual(
  scene: Phaser.Scene,
  manifest: PetPartsManifest,
  petId: PetId,
  stageBand: PetStageBand,
): Phaser.GameObjects.Container | undefined {
  const stage = petManifestStage(manifest, petId, stageBand);
  if (!stage || ensurePetStageTextures(scene, petId, stage) !== "ready") return undefined;
  const assembly = assemblePetStage(stage);
  const images: Phaser.GameObjects.Image[] = [];
  for (const part of assembly.parts) {
    const image = scene.add
      .image(part.x, part.y, petTextureKey(petId, stageBand, part.source.id))
      .setOrigin(part.originX, part.originY)
      .setScale(part.scale)
      .setRotation(part.rotation)
      .setDepth(part.depth);
    images.push(image);
  }
  return scene.add.container(0, 0, images);
}

/** Result-only paper card turn. This allocates only on the terminal progression edge. */
export function playPetEvolutionCeremony(
  scene: Phaser.Scene,
  manifest: PetPartsManifest,
  petId: PetId,
  oldStageBand: PetStageBand,
  newStageBand: PetStageBand,
  label: string,
): void {
  const oldStage = petManifestStage(manifest, petId, oldStageBand);
  const newStage = petManifestStage(manifest, petId, newStageBand);
  if (!oldStage || !newStage) return;
  const oldState = ensurePetStageTextures(scene, petId, oldStage);
  const newState = ensurePetStageTextures(scene, petId, newStage);
  if (oldState === "pending" || newState === "pending") {
    scene.load.once("complete", () =>
      playPetEvolutionCeremony(scene, manifest, petId, oldStageBand, newStageBand, label),
    );
    return;
  }
  if (oldState !== "ready" || newState !== "ready") return;
  const oldForm = buildStageVisual(scene, manifest, petId, oldStageBand);
  const newForm = buildStageVisual(scene, manifest, petId, newStageBand);
  if (!oldForm || !newForm) return;
  const x = scene.cameras.main.width / scene.cameras.main.zoom / 2;
  const y = scene.cameras.main.height / scene.cameras.main.zoom / 2 + 105;
  const plate = scene.add
    .rectangle(x, y, 300, 154, 0x111018, 0.94)
    .setScrollFactor(0)
    .setDepth(100_010)
    .setStrokeStyle(2, 0xcfc6ae, 0.75);
  const caption = scene.add
    .text(x, y - 58, label, {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#cfc6ae",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(100_012);
  oldForm
    .setPosition(x, y + 8)
    .setScale(3)
    .setScrollFactor(0)
    .setDepth(100_011);
  newForm
    .setPosition(x, y + 8)
    .setScale(0.03, 3)
    .setScrollFactor(0)
    .setDepth(100_011)
    .setVisible(false);
  scene.tweens.add({
    targets: oldForm,
    scaleX: 0.03,
    rotation: 0.055,
    duration: 180,
    ease: "Cubic.easeIn",
    onComplete: () => {
      oldForm.setVisible(false);
      newForm.setVisible(true);
      scene.tweens.add({
        targets: newForm,
        scaleX: 3,
        rotation: 0,
        duration: 300,
        ease: "Back.easeOut",
        onComplete: () => {
          scene.tweens.add({
            targets: [newForm, plate, caption],
            alpha: 0,
            y: "-=18",
            delay: 520,
            duration: 320,
            ease: "Cubic.easeIn",
            onComplete: () => {
              oldForm.destroy(true);
              newForm.destroy(true);
              plate.destroy();
              caption.destroy();
            },
          });
        },
      });
    },
  });
}

/** A retained, client-only 2-4-part follower. No method writes or derives gameplay state. */
export class PetRig {
  readonly root: Phaser.GameObjects.Container;
  readonly ownerId: string;
  readonly isSelf: boolean;
  readonly partySlot: number;
  private petId: PetId;
  private stageBand: PetStageBand;
  private artResolvedForBand: PetStageBand | 0 = 0;
  private artUnavailableForBand: PetStageBand | 0 = 0;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ownerMark: Phaser.GameObjects.Rectangle;
  private parts: PetRigPart[] = [];
  private destroyed = false;
  private radiusPx = 15;
  private readonly follow: PetFollowState = { x: 0, y: 0, vx: 0, vy: 0, ready: false };
  private headingX = 1;
  private headingY = 0;
  private lastHeadingX = 1;
  private lastHeadingY = 0;
  private targetX = 0;
  private targetY = 0;
  private lastOwnerX = 0;
  private lastOwnerY = 0;
  private ownerReady = false;
  private readonly ownerTimes = new Float64Array(OWNER_HISTORY_SIZE);
  private readonly ownerXs = new Float64Array(OWNER_HISTORY_SIZE);
  private readonly ownerYs = new Float64Array(OWNER_HISTORY_SIZE);
  private ownerHistoryCursor = 0;
  private ownerHistoryCount = 0;
  private lagOwnerX = 0;
  private lagOwnerY = 0;
  private lastTeleportSeq = -1;
  private lastStance: MoveStance = 0 as MoveStance;
  private lastAttackSeq = -1;
  private mode = MODE_NORMAL;
  private modeTime = 0;
  private dartStartX = 0;
  private dartStartY = 0;
  private teleportAlpha = 1;
  private sleeping = false;
  private projectionOriginY = 0;
  private projectionScaleY = 1;
  private baseDisplayX = 0;
  private baseDisplayY = 0;
  private avoidX = 0;
  private avoidY = 0;
  private avoidAlpha = 1;
  private visualAlpha = 0;
  private wasDowned = false;
  private prevFollowVx = 0;
  private prevFollowVy = 0;
  private idleSeconds = 0;
  private personalityTime = -1;
  private personalityDuration = 0.6;
  private nextPersonalityAt = 5.5;
  private rngState: number;
  private flinchTime = -1;
  private flinchMagnitude = 0;
  private flinchDirX = 0;
  private flinchDirY = 0;
  private lastFullFlinchAt = -1e9;
  private celebrationTime = -1;
  private streakKills = 0;
  private celebrationMilestone = 5;
  private lastKillAt = -1e9;
  private streakStartedAt = -1e9;
  private lastCelebrationAt = -1e9;
  private rootFacing = 1;
  private orbitPhase = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly manifest: PetPartsManifest,
    ownerId: string,
    petId: PetId,
    stageBand: PetStageBand,
    isSelf: boolean,
    partySlot: number,
  ) {
    this.ownerId = ownerId;
    this.petId = petId;
    this.stageBand = stageBand;
    this.isSelf = isSelf;
    this.partySlot = partySlot;
    this.rngState = hash32(`${ownerId}:${petId}`) || 1;
    this.orbitPhase = (hash32(`${ownerId}:${petId}:orbit`) / 0x1_0000_0000) * Math.PI * 2;
    this.shadow = scene.add.ellipse(0, 9, 22, 7, 0x0d0a10, 0.24).setDepth(-100);
    const ownerColor = 0x5f7a86 ^ (hash32(ownerId) & 0x3f3f3f);
    this.ownerMark = scene.add.rectangle(-10, 8, 4, 3, ownerColor, 0.9).setDepth(90);
    this.root = scene.add.container(0, 0, [this.shadow, this.ownerMark]).setVisible(false);
    this.schedulePersonality();
  }

  get worldX(): number {
    return this.follow.x;
  }

  get worldY(): number {
    return this.follow.y;
  }

  get screenX(): number {
    return this.baseDisplayX;
  }

  get screenY(): number {
    return this.baseDisplayY;
  }

  get radius(): number {
    return this.radiusPx;
  }

  setProjection(originY: number, scaleY: number): void {
    this.projectionOriginY = originY;
    this.projectionScaleY = Math.max(0.01, scaleY);
  }

  setDescriptor(petId: PetId, stageBand: PetStageBand): void {
    if (this.petId === petId && this.stageBand === stageBand) return;
    this.petId = petId;
    this.stageBand = stageBand;
    this.rngState = hash32(`${this.ownerId}:${petId}`) || 1;
    this.orbitPhase = (hash32(`${this.ownerId}:${petId}:orbit`) / 0x1_0000_0000) * Math.PI * 2;
    this.clearParts();
    this.artResolvedForBand = 0;
    this.artUnavailableForBand = 0;
    this.follow.vx = 0;
    this.follow.vy = 0;
    this.schedulePersonality();
  }

  onOwnerHit(dirX: number, dirY: number, nowMs: number): void {
    const length = Math.hypot(dirX, dirY);
    if (length > 0.001) {
      this.flinchDirX = -dirX / length;
      this.flinchDirY = -dirY / length;
    } else {
      this.flinchDirX = -this.headingX;
      this.flinchDirY = -this.headingY;
    }
    const full = nowMs - this.lastFullFlinchAt >= 350;
    this.flinchMagnitude = full ? 7 : 2;
    this.flinchTime = 0;
    if (full) this.lastFullFlinchAt = nowMs;
    this.celebrationTime = -1;
    this.personalityTime = -1;
    this.idleSeconds = 0;
  }

  onOwnerKill(nowMs: number): void {
    const streakExpired =
      nowMs - this.lastKillAt > 2_250 ||
      (this.streakKills < 5 && nowMs - this.streakStartedAt > 2_250);
    if (streakExpired) {
      this.streakKills = 1;
      this.celebrationMilestone = 5;
      this.streakStartedAt = nowMs;
    } else this.streakKills++;
    this.lastKillAt = nowMs;
    if (this.streakKills >= this.celebrationMilestone && nowMs - this.lastCelebrationAt >= 3_000) {
      this.celebrationTime = 0;
      this.lastCelebrationAt = nowMs;
      this.celebrationMilestone += 10;
    }
  }

  setAvoidance(offsetX: number, offsetY: number, alpha: number): void {
    this.avoidX = clamp(offsetX, -28, 28);
    this.avoidY = clamp(offsetY, -28, 28);
    const length = Math.hypot(this.avoidX, this.avoidY);
    if (length > 28) {
      this.avoidX = (this.avoidX / length) * 28;
      this.avoidY = (this.avoidY / length) * 28;
    }
    this.avoidAlpha = clamp(alpha, 0, 1);
    this.applyRootPresentation();
  }

  update(
    nowMs: number,
    deltaMs: number,
    ownerX: number,
    ownerY: number,
    aimX: number,
    aimY: number,
    stance: MoveStance,
    teleportSeq: number,
    attackSeq: number,
    downed: boolean,
    reducedMotion: boolean,
  ): void {
    if (this.destroyed) return;
    this.syncArt();
    const dt = clamp(deltaMs / 1000, 0, MAX_FOLLOW_DT);
    const projectedOwnerY = this.projectY(ownerY);
    const view = this.scene.cameras.main.worldView;
    const ownerOffscreen =
      ownerX < view.left - LOD_MARGIN ||
      ownerX > view.right + LOD_MARGIN ||
      projectedOwnerY < view.top - LOD_MARGIN ||
      projectedOwnerY > view.bottom + LOD_MARGIN;
    const petOffscreen =
      !this.follow.ready ||
      this.baseDisplayX < view.left - LOD_MARGIN ||
      this.baseDisplayX > view.right + LOD_MARGIN ||
      this.baseDisplayY < view.top - LOD_MARGIN ||
      this.baseDisplayY > view.bottom + LOD_MARGIN;
    if (!this.isSelf && ownerOffscreen && petOffscreen) {
      this.sleeping = true;
      this.root.setVisible(false);
      return;
    }

    const waking = this.sleeping;
    this.sleeping = false;
    this.root.setVisible(this.parts.length > 0);
    if (!this.ownerReady || waking || deltaMs > 180) this.resetOwnerHistory(ownerX, ownerY, nowMs);
    else this.writeOwnerHistory(ownerX, ownerY, nowMs);
    this.sampleLaggedOwner(nowMs - LAG_SAMPLE_MS);
    const ownerDx = ownerX - this.lastOwnerX;
    const ownerDy = ownerY - this.lastOwnerY;
    this.lastOwnerX = ownerX;
    this.lastOwnerY = ownerY;
    this.ownerReady = true;
    const movement = Math.hypot(ownerDx, ownerDy);
    let desiredHeadingX = aimX;
    let desiredHeadingY = aimY;
    if (movement > 0.25) {
      desiredHeadingX = ownerDx / movement;
      desiredHeadingY = ownerDy / movement;
    }
    const aimLength = Math.hypot(desiredHeadingX, desiredHeadingY);
    if (aimLength < 0.001) {
      desiredHeadingX = this.headingX;
      desiredHeadingY = this.headingY;
    } else {
      desiredHeadingX /= aimLength;
      desiredHeadingY /= aimLength;
    }
    const headingBlend = 1 - Math.exp(-dt / 0.14);
    this.headingX += (desiredHeadingX - this.headingX) * headingBlend;
    this.headingY += (desiredHeadingY - this.headingY) * headingBlend;
    const headingLength = Math.hypot(this.headingX, this.headingY) || 1;
    this.headingX /= headingLength;
    this.headingY /= headingLength;
    const rightX = -this.headingY;
    const rightY = this.headingX;
    const rear =
      (this.stageBand === 1 ? 48 : this.stageBand === 2 ? 58 : 68) + (this.partySlot >= 2 ? 6 : 0);
    const shoulderSign = this.partySlot % 2 === 0 ? 1 : -1;
    const orbitAngle = (nowMs / 1000 / ORBIT_PERIOD_SECONDS) * Math.PI * 2 + this.orbitPhase;
    const orbitScale = reducedMotion || downed ? 0 : 1;
    let anchorX =
      this.lagOwnerX -
      rear * this.headingX +
      shoulderSign * 20 * rightX +
      Math.cos(orbitAngle) * 10 * orbitScale * rightX -
      Math.sin(orbitAngle) * 6 * orbitScale * this.headingX;
    let anchorY =
      this.lagOwnerY -
      rear * this.headingY +
      shoulderSign * 20 * rightY +
      Math.cos(orbitAngle) * 10 * orbitScale * rightY -
      Math.sin(orbitAngle) * 6 * orbitScale * this.headingY;
    if (!this.isSelf && Math.hypot(anchorX - this.targetX, anchorY - this.targetY) < 0.75) {
      anchorX = this.targetX;
      anchorY = this.targetY;
    } else {
      this.targetX = anchorX;
      this.targetY = anchorY;
    }

    const firstTeleport = this.lastTeleportSeq < 0;
    const teleported = !firstTeleport && teleportSeq !== this.lastTeleportSeq;
    this.lastTeleportSeq = teleportSeq;
    const stanceEdge = stance !== this.lastStance;
    const attackEdge = this.lastAttackSeq >= 0 && attackSeq !== this.lastAttackSeq;
    this.lastStance = stance;
    this.lastAttackSeq = attackSeq;
    if (teleported) this.beginTeleport();
    else if (stanceEdge && stance === STANCE_DASH && !downed) this.beginDart();
    if (attackEdge || stanceEdge) {
      this.idleSeconds = 0;
      this.personalityTime = -1;
    }
    if (downed) {
      this.celebrationTime = -1;
      this.personalityTime = -1;
    }

    if (waking || !this.follow.ready) {
      this.follow.x = anchorX;
      this.follow.y = anchorY;
      this.follow.vx = 0;
      this.follow.vy = 0;
      this.follow.ready = true;
      this.mode = MODE_NORMAL;
      this.modeTime = 0;
    } else {
      const error = Math.hypot(anchorX - this.follow.x, anchorY - this.follow.y);
      if (this.mode === MODE_NORMAL && error > 320) this.beginTeleport();
      else if (this.mode === MODE_NORMAL && error > DART_TRIGGER_PX && !downed) this.beginDart();
      this.stepFollowMode(anchorX, anchorY, dt, downed);
    }

    this.stepPersonality(dt, movement, attackEdge || stanceEdge || this.flinchTime >= 0, downed);
    if (this.flinchTime >= 0) this.flinchTime += dt;
    if (this.flinchTime > 0.3) this.flinchTime = -1;
    if (this.celebrationTime >= 0) {
      this.celebrationTime += dt;
      if (this.celebrationTime > 0.78) this.celebrationTime = -1;
    }

    const flinchEnvelope = this.flinchEnvelope();
    let personalityX = 0;
    let personalityY = 0;
    if (this.personalityTime >= 0 && !reducedMotion) {
      const p = this.personalityTime / this.personalityDuration;
      const beat = Math.sin(Math.PI * clamp(p, 0, 1));
      if (this.petId === "hearth-newt" || this.petId === "gilded-gecko") {
        personalityX = Math.cos(p * Math.PI * 2) * 7 * beat;
        personalityY = Math.sin(p * Math.PI * 2) * 4 * beat;
      } else if (this.petId === "copper-snail" || this.petId === "slate-tortoise") {
        personalityY = Math.sin(p * Math.PI * 3) * 3 * beat;
      } else if (this.petId === "brass-crab") {
        personalityX = Math.sin(p * Math.PI * 2) * 5 * beat;
      } else {
        personalityY = -6 * beat;
      }
    }
    if (this.celebrationTime >= 0 && !reducedMotion) {
      const p = this.celebrationTime / 0.78;
      const envelope = Math.sin(Math.PI * clamp(p, 0, 1));
      personalityX += Math.cos(p * Math.PI * 2) * 12 * envelope;
      personalityY += Math.sin(p * Math.PI * 2) * 7 * envelope;
    }
    const hover = downed
      ? Math.sin(nowMs * 0.001 * ((Math.PI * 2) / 1.4))
      : Math.sin(nowMs * 0.001 * Math.PI * 2 * 1.55 + orbitAngle) * (reducedMotion ? 1 : 2.5);
    const droop = downed ? 7 : 0;
    this.baseDisplayX =
      this.follow.x + personalityX + this.flinchDirX * flinchEnvelope * this.flinchMagnitude;
    this.baseDisplayY =
      this.projectY(
        this.follow.y + personalityY + this.flinchDirY * flinchEnvelope * this.flinchMagnitude,
      ) +
      hover +
      droop;
    this.avoidX = 0;
    this.avoidY = 0;
    this.avoidAlpha = 1;
    const normalAlpha = this.isSelf ? 0.88 : 0.68;
    const overlap = Math.hypot(this.follow.x - ownerX, this.follow.y - ownerY) < this.radiusPx + 24;
    const targetAlpha = downed ? 0.35 : overlap ? 0.42 : normalAlpha;
    this.visualAlpha += (targetAlpha - this.visualAlpha) * (1 - Math.exp(-dt / 0.16));
    this.teleportAlpha = this.teleportPresentationAlpha();
    this.rootFacing = this.headingX < -0.08 ? -1 : this.headingX > 0.08 ? 1 : this.rootFacing;
    const headingTurn = Math.atan2(
      this.lastHeadingX * this.headingY - this.lastHeadingY * this.headingX,
      this.lastHeadingX * this.headingX + this.lastHeadingY * this.headingY,
    );
    this.lastHeadingX = this.headingX;
    this.lastHeadingY = this.headingY;
    const compress =
      this.mode === MODE_COMPRESS
        ? 1 - Math.sin(Math.PI * clamp(this.modeTime / 0.06, 0, 1)) * 0.2
        : 1;
    this.root.scaleX = this.rootFacing * compress;
    this.root.scaleY = 2 - compress;
    this.root.rotation = clamp(headingTurn * 0.18, -0.07, 0.07);
    if (this.celebrationTime >= 0 && !reducedMotion)
      this.root.rotation += Math.sin((this.celebrationTime / 0.78) * Math.PI * 4) * 0.09;
    this.root.setDepth(Math.min(this.follow.y - 2, ownerY - 2));
    this.shadow.setScale(1 - Math.abs(hover) * 0.025, 1 - Math.abs(hover) * 0.04);
    this.stepParts(dt, reducedMotion, downed, flinchEnvelope);
    if (downed !== this.wasDowned) {
      this.wasDowned = downed;
      for (let i = 0; i < this.parts.length; i++)
        this.parts[i]?.image.setTint(downed ? 0xaaa49b : 0xffffff);
    }
    this.applyRootPresentation();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.parts.length = 0;
    if (this.root.active) this.root.destroy(true);
  }

  private syncArt(): void {
    if (this.artResolvedForBand === this.stageBand && this.parts.length > 0) return;
    if (this.artUnavailableForBand === this.stageBand) return;
    const desired = petManifestStage(this.manifest, this.petId, this.stageBand);
    const hatchling = petManifestStage(this.manifest, this.petId, 1);
    if (!desired || !hatchling) {
      this.artUnavailableForBand = this.stageBand;
      return;
    }
    const desiredState = ensurePetStageTextures(this.scene, this.petId, desired);
    const hatchlingState =
      this.stageBand === 1
        ? desiredState
        : ensurePetStageTextures(this.scene, this.petId, hatchling);
    if (desiredState === "ready") {
      this.buildParts(desired);
      this.artResolvedForBand = this.stageBand;
      return;
    }
    if (desiredState === "missing" && hatchlingState === "ready") {
      this.buildParts(hatchling);
      this.artResolvedForBand = this.stageBand;
      return;
    }
    if (desiredState === "missing" && hatchlingState === "missing")
      this.artUnavailableForBand = this.stageBand;
  }

  private buildParts(stage: PetManifestStage): void {
    this.clearParts();
    const assembly = assemblePetStage(stage);
    this.radiusPx = Math.max(assembly.width, assembly.height) / 2;
    this.shadow.setSize(this.radiusPx * 1.25, Math.max(5, this.radiusPx * 0.38));
    this.ownerMark.setPosition(-this.radiusPx * 0.55, this.radiusPx * 0.42);
    for (const part of assembly.parts) {
      const image = this.scene.add
        .image(part.x, part.y, petTextureKey(this.petId, stage.stage, part.source.id))
        .setOrigin(part.originX, part.originY)
        .setScale(part.scale)
        .setRotation(part.rotation)
        .setDepth(part.depth)
        .setTint(this.wasDowned ? 0xaaa49b : 0xffffff);
      this.root.add(image);
      this.parts.push({ image, assembly: part, angle: 0, velocity: 0 });
    }
    this.root.bringToTop(this.ownerMark);
    this.root.setVisible(!this.sleeping);
  }

  private clearParts(): void {
    for (let i = 0; i < this.parts.length; i++) this.parts[i]?.image.destroy();
    this.parts.length = 0;
  }

  private stepFollowMode(anchorX: number, anchorY: number, dt: number, downed: boolean): void {
    this.modeTime += dt;
    if (downed && this.mode !== MODE_TELEPORT) this.mode = MODE_NORMAL;
    if (this.mode === MODE_NORMAL) {
      stepPetFollowSpring(this.follow, anchorX, anchorY, dt);
      return;
    }
    if (this.mode === MODE_COMPRESS) {
      stepPetFollowSpring(this.follow, anchorX, anchorY, dt, PET_FOLLOW_TUNING);
      if (this.modeTime >= 0.06) this.startDartTravel();
      return;
    }
    if (this.mode === MODE_DART) {
      const duration = 0.15;
      const u = clamp(this.modeTime / duration, 0, 1);
      const t = smoothstep(u);
      const landX = anchorX - this.headingX * 14;
      const landY = anchorY - this.headingY * 14;
      const desiredX = this.dartStartX + (landX - this.dartStartX) * t;
      const desiredY = this.dartStartY + (landY - this.dartStartY) * t;
      let stepX = desiredX - this.follow.x;
      let stepY = desiredY - this.follow.y;
      const stepDistance = Math.hypot(stepX, stepY);
      const maxStep = DART_SPEED * dt;
      if (stepDistance > maxStep && maxStep > 0) {
        const scale = maxStep / stepDistance;
        stepX *= scale;
        stepY *= scale;
      }
      this.follow.x += stepX;
      this.follow.y += stepY;
      if (dt > 0) {
        this.follow.vx = stepX / dt;
        this.follow.vy = stepY / dt;
      }
      if (u >= 1) {
        this.mode = MODE_SETTLE;
        this.modeTime = 0;
      }
      return;
    }
    if (this.mode === MODE_SETTLE) {
      stepPetFollowSpring(this.follow, anchorX, anchorY, dt, PET_SETTLE_TUNING);
      if (this.modeTime >= 0.22) {
        this.mode = MODE_NORMAL;
        this.modeTime = 0;
      }
      return;
    }
    if (this.mode === MODE_TELEPORT && this.modeTime >= 0.07) {
      this.follow.x = anchorX - this.headingX * 64;
      this.follow.y = anchorY - this.headingY * 64;
      this.follow.vx = 0;
      this.follow.vy = 0;
      this.startDartTravel();
    }
  }

  private beginDart(): void {
    if (this.mode === MODE_TELEPORT || this.mode === MODE_DART) return;
    this.mode = MODE_COMPRESS;
    this.modeTime = 0;
  }

  private startDartTravel(): void {
    this.mode = MODE_DART;
    this.modeTime = 0;
    this.dartStartX = this.follow.x;
    this.dartStartY = this.follow.y;
  }

  private beginTeleport(): void {
    this.mode = MODE_TELEPORT;
    this.modeTime = 0;
    this.celebrationTime = -1;
    this.personalityTime = -1;
  }

  private teleportPresentationAlpha(): number {
    if (this.mode === MODE_TELEPORT) return 1 - clamp(this.modeTime / 0.07, 0, 1);
    if (this.mode === MODE_DART) return 0.75 + 0.25 * smoothstep(this.modeTime / 0.15);
    return 1;
  }

  private stepParts(dt: number, reducedMotion: boolean, downed: boolean, flinch: number): void {
    const accelerationX = dt > 0 ? (this.follow.vx - this.prevFollowVx) / dt : 0;
    const accelerationY = dt > 0 ? (this.follow.vy - this.prevFollowVy) / dt : 0;
    this.prevFollowVx = this.follow.vx;
    this.prevFollowVy = this.follow.vy;
    const lateralAcceleration = -this.headingY * accelerationX + this.headingX * accelerationY;
    const celebration =
      this.celebrationTime >= 0 ? Math.sin((this.celebrationTime / 0.78) * Math.PI * 4) : 0;
    const personality =
      this.personalityTime >= 0
        ? Math.sin((this.personalityTime / this.personalityDuration) * Math.PI * 3)
        : 0;
    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i];
      if (!part) continue;
      const spring = part.assembly.source.spring;
      if (!spring) continue;
      const maxAngle = (spring.maxDeg * Math.PI) / 180;
      let target = 0;
      if (downed) target = clamp(part.assembly.depth / 20, -1, 1) * maxAngle * 0.72;
      else if (!reducedMotion) {
        if (spring.preset === "flutter")
          target =
            clamp(-lateralAcceleration / 2_600, -1, 1) * maxAngle * spring.dragGain +
            personality * maxAngle * 0.45;
        else if (spring.preset === "antenna")
          target = clamp(-lateralAcceleration / 1_900, -1, 1) * maxAngle * spring.dragGain;
        else if (spring.preset === "tail")
          target =
            clamp(-lateralAcceleration / 1_500, -1, 1) * maxAngle * spring.dragGain +
            personality * maxAngle * 0.3;
        else
          target =
            clamp(-accelerationY / 2_600, -1, 1) * maxAngle * spring.dragGain +
            personality * maxAngle * 0.22;
        target += celebration * Math.min((12 * Math.PI) / 180, maxAngle * 1.7);
      }
      if (flinch > 0) target -= Math.sign(part.assembly.depth || 1) * maxAngle * 0.8 * flinch;
      target = clamp(
        target,
        -Math.max(maxAngle, (12 * Math.PI) / 180),
        Math.max(maxAngle, (12 * Math.PI) / 180),
      );
      stepAngularSpring(part, target, dt, spring.hz, spring.damping);
      part.image.rotation = part.assembly.rotation + part.angle;
    }
  }

  private flinchEnvelope(): number {
    if (this.flinchTime < 0) return 0;
    if (this.flinchTime <= 0.11) return Math.sin((this.flinchTime / 0.11) * (Math.PI / 2));
    return (1 - clamp((this.flinchTime - 0.11) / 0.19, 0, 1)) ** 2;
  }

  private stepPersonality(
    dt: number,
    ownerMovement: number,
    interrupted: boolean,
    downed: boolean,
  ): void {
    if (interrupted || downed || this.mode !== MODE_NORMAL || this.celebrationTime >= 0) {
      this.idleSeconds = 0;
      this.personalityTime = -1;
      return;
    }
    if (ownerMovement < 0.3) this.idleSeconds += dt;
    else this.idleSeconds = 0;
    if (this.personalityTime >= 0) {
      this.personalityTime += dt;
      if (this.personalityTime >= this.personalityDuration) {
        this.personalityTime = -1;
        this.idleSeconds = 0;
        this.schedulePersonality();
      }
      return;
    }
    this.nextPersonalityAt -= dt;
    if (this.idleSeconds >= 1.8 && this.nextPersonalityAt <= 0) {
      this.personalityTime = 0;
      this.personalityDuration = 0.45 + this.random01() * 0.3;
    }
  }

  private schedulePersonality(): void {
    this.nextPersonalityAt = 4.5 + this.random01() * 3;
  }

  private random01(): number {
    let value = this.rngState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.rngState = value >>> 0 || 1;
    return this.rngState / 0x1_0000_0000;
  }

  private projectY(worldY: number): number {
    return this.projectionOriginY + (worldY - this.projectionOriginY) * this.projectionScaleY;
  }

  private applyRootPresentation(): void {
    this.root.setPosition(this.baseDisplayX + this.avoidX, this.baseDisplayY + this.avoidY);
    this.root.setAlpha(this.visualAlpha * this.teleportAlpha * this.avoidAlpha);
  }

  private resetOwnerHistory(x: number, y: number, nowMs: number): void {
    this.ownerHistoryCursor = 1;
    this.ownerHistoryCount = 1;
    this.ownerTimes[0] = nowMs;
    this.ownerXs[0] = x;
    this.ownerYs[0] = y;
    this.lagOwnerX = x;
    this.lagOwnerY = y;
    this.lastOwnerX = x;
    this.lastOwnerY = y;
    this.ownerReady = true;
  }

  private writeOwnerHistory(x: number, y: number, nowMs: number): void {
    const index = this.ownerHistoryCursor;
    this.ownerTimes[index] = nowMs;
    this.ownerXs[index] = x;
    this.ownerYs[index] = y;
    this.ownerHistoryCursor = (index + 1) % OWNER_HISTORY_SIZE;
    this.ownerHistoryCount = Math.min(OWNER_HISTORY_SIZE, this.ownerHistoryCount + 1);
  }

  private sampleLaggedOwner(sampleMs: number): void {
    let olderIndex = -1;
    let newerIndex = -1;
    let olderTime = Number.NEGATIVE_INFINITY;
    let newerTime = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.ownerHistoryCount; i++) {
      const index = (this.ownerHistoryCursor - 1 - i + OWNER_HISTORY_SIZE) % OWNER_HISTORY_SIZE;
      const time = this.ownerTimes[index] ?? 0;
      if (time <= sampleMs && time > olderTime) {
        olderTime = time;
        olderIndex = index;
      }
      if (time >= sampleMs && time < newerTime) {
        newerTime = time;
        newerIndex = index;
      }
    }
    if (olderIndex < 0) olderIndex = newerIndex;
    if (newerIndex < 0) newerIndex = olderIndex;
    if (olderIndex < 0 || newerIndex < 0) return;
    const span = newerTime - olderTime;
    const t = span > 0 && Number.isFinite(span) ? clamp((sampleMs - olderTime) / span, 0, 1) : 0;
    const olderX = this.ownerXs[olderIndex] ?? this.lagOwnerX;
    const olderY = this.ownerYs[olderIndex] ?? this.lagOwnerY;
    const newerX = this.ownerXs[newerIndex] ?? olderX;
    const newerY = this.ownerYs[newerIndex] ?? olderY;
    this.lagOwnerX = olderX + (newerX - olderX) * t;
    this.lagOwnerY = olderY + (newerY - olderY) * t;
  }
}
