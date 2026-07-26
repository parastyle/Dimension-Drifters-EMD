import {
  type SwingDescriptor,
  swingDescriptorFor,
  WEAPONS,
  type WeaponDef,
  weaponDisplaySpriteId,
} from "@dd/shared";
import Phaser from "phaser";
import type { RigAnim } from "../entities/rig/rig-core.js";
import {
  createPresentedActorState,
  type PresentationFrame,
  type PresentedActorState,
} from "../entities/rig/rig-presentation.js";
import { type AuthoredRigElementSnapshot, SpriteRig } from "../entities/SpriteRig.js";
import { SPRITES, type SpriteManifest } from "../sprites/manifest.js";
import {
  WHOLE_ART_CHARACTER_PART_ROLES,
  wholeArtCharacterManifest,
  wholeArtCharacterTextureKey,
  wholeArtCharacterTextureUrl,
} from "../sprites/whole-art-character.js";
import type { ComboBeat, ElementTransformPose, WeaponAuthoringRow } from "./model.js";

export interface StageMarkers {
  primary: Readonly<{ x: number; y: number }>;
  secondary: Readonly<{ x: number; y: number }>;
  idle: Readonly<{ x: number; y: number }>;
  path: Readonly<{ x: number; y: number }>;
  pathOrigin: Readonly<{ x: number; y: number }>;
  bodyHeight: number;
  elements: readonly AuthoredRigElementSnapshot[];
}

export interface PlaybackFrame {
  beatIndex: number;
  progress: number;
  timelineValue: number;
  playing: boolean;
}

interface StageCallbacks {
  onFrame(frame: PlaybackFrame, markers: StageMarkers): void;
  onError(message: string): void;
}

const DEFAULT_POSE_SECONDS = 0.62;

function manifestFor(spriteId: string): SpriteManifest | undefined {
  return (SPRITES as Readonly<Record<string, SpriteManifest>>)[spriteId];
}

function editableDefinition(row: WeaponAuthoringRow): WeaponDef | undefined {
  const base = WEAPONS[row.id];
  if (!base) return undefined;
  return {
    ...base,
    displayLength: row.stats.displayLength,
    gripFrac: row.stats.gripFrac,
    gripPoints: row.gripPoints
      ? (structuredClone(row.gripPoints) as unknown as WeaponDef["gripPoints"])
      : base.gripPoints,
    poseLanguage: row.poseLanguage
      ? (structuredClone(row.poseLanguage) as unknown as WeaponDef["poseLanguage"])
      : base.poseLanguage,
    elementTransforms: row.elementTransforms
      ? (structuredClone(row.elementTransforms) as WeaponDef["elementTransforms"])
      : undefined,
    performance: row.performance
      ? (structuredClone(row.performance) as unknown as WeaponDef["performance"])
      : base.performance,
    comboChoreography: row.comboChoreography
      ? (structuredClone(row.comboChoreography) as unknown as WeaponDef["comboChoreography"])
      : base.comboChoreography,
  };
}

function descriptorFor(
  row: WeaponAuthoringRow,
  definition: WeaponDef,
  beatIndex: number,
): SwingDescriptor {
  const base = swingDescriptorFor(definition, Math.max(definition.cooldown, DEFAULT_POSE_SECONDS));
  const beat = row.comboBar?.[beatIndex];
  if (!beat) return base;
  const poseSeconds = Math.max(DEFAULT_POSE_SECONDS, base.poseSeconds);
  return {
    ...base,
    poseSeconds,
    activeStartSeconds: beat.timing.activeStart * poseSeconds,
    activeEndSeconds: beat.timing.activeEnd * poseSeconds,
    impactSeconds: beat.timing.impact * poseSeconds,
    comboFamily: definition.comboFamily,
    comboVariant: definition.comboVariant,
    comboStep: beatIndex,
    motion: beat.motion,
    comboDirection: beat.direction,
    comboHand: beat.hand,
    comboLimb: beat.limb,
    comboTiming: beat.timing,
    comboPath: beat.path,
    comboRibbon: beat.ribbon as unknown as SwingDescriptor["comboRibbon"],
    comboChoreography: definition.comboChoreography?.[beatIndex],
  };
}

function beatCount(row: WeaponAuthoringRow): number {
  return Math.max(1, row.comboBar?.length ?? 0);
}

class PoseStudioScene extends Phaser.Scene {
  private row: WeaponAuthoringRow;
  private characterId: string;
  private callbacks: StageCallbacks;
  private liveRigs: SpriteRig[] = [];
  private onionRigs: SpriteRig[] = [];
  private backdrop?: Phaser.GameObjects.Graphics;
  private rightCaption?: Phaser.GameObjects.Text;
  private leftCaption?: Phaser.GameObjects.Text;
  private beatIndex = 0;
  private progress = 0;
  private playing = false;
  private looping = true;
  private onionSkin = true;
  private playbackSpeed = 1;
  private zoom = 1;
  private combatScale = false;
  private previewPose: ElementTransformPose = "held";
  private animationClock = 1_000;
  private presentationFrameId = 0;
  private readonly presentedRigs = new WeakMap<SpriteRig, PresentedActorState>();
  private restartPending = true;
  private loaderGeneration = 0;
  private lastWidth = -1;
  private lastHeight = -1;

  constructor(row: WeaponAuthoringRow, characterId: string, callbacks: StageCallbacks) {
    super({ key: "PoseStudioScene" });
    this.row = structuredClone(row);
    this.characterId = characterId;
    this.callbacks = callbacks;
  }

  preload(): void {
    this.load.spritesheet("ptcl:shock-spark", "particles/shock-spark.png", {
      frameWidth: 96,
      frameHeight: 96,
    });
    this.queueCharacter(this.characterId);
    this.queueWeapon(this.row);
  }

  create(): void {
    this.backdrop = this.add.graphics().setDepth(-20);
    this.leftCaption = this.add
      .text(0, 0, "FACING RIGHT", {
        color: "#8e9894",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5);
    this.rightCaption = this.add
      .text(0, 0, "FACING LEFT", {
        color: "#8e9894",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5);
    this.rebuildRigs();
  }

  private queueCharacter(characterId: string): void {
    const manifest = wholeArtCharacterManifest(characterId);
    if (!manifest) return;
    for (const role of WHOLE_ART_CHARACTER_PART_ROLES) {
      const part = manifest.parts.find((candidate) => candidate.role === role);
      const key = wholeArtCharacterTextureKey(characterId, role);
      if (part && !this.textures.exists(key)) {
        this.load.image(key, wholeArtCharacterTextureUrl(characterId, part));
      }
    }
  }

  private queueWeapon(row: WeaponAuthoringRow): void {
    const definition = editableDefinition(row);
    if (!definition) return;
    const spriteId = weaponDisplaySpriteId(definition);
    const manifest = manifestFor(spriteId);
    if (!manifest) return;
    for (const part of manifest.parts) {
      const key = `${spriteId}:${part.role}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, `sprites/${spriteId}/${part.file}`);
      }
    }
  }

  private loadThenRebuild(queue: () => void): void {
    const generation = ++this.loaderGeneration;
    queue();
    const complete = (): void => {
      if (generation !== this.loaderGeneration) return;
      this.rebuildRigs();
    };
    this.load.once(Phaser.Loader.Events.COMPLETE, complete);
    if (!this.load.isLoading()) this.load.start();
  }

  setRow(row: WeaponAuthoringRow): void {
    const previousDefinition = WEAPONS[this.row.id] ?? WEAPONS[row.id];
    const previousSprite = previousDefinition
      ? weaponDisplaySpriteId(previousDefinition)
      : undefined;
    this.row = structuredClone(row);
    this.beatIndex = Math.min(this.beatIndex, beatCount(this.row) - 1);
    const definition = editableDefinition(this.row);
    if (!definition) {
      this.callbacks.onError(`The generated game catalog has no WeaponDef for ${row.id}.`);
      return;
    }
    const spriteId = weaponDisplaySpriteId(definition);
    const manifest = manifestFor(spriteId);
    if (!manifest) {
      this.callbacks.onError(`No installed rig manifest exists for ${spriteId}.`);
      return;
    }
    const assetsReady = manifest.parts.every((part) =>
      this.textures.exists(`${spriteId}:${part.role}`),
    );
    if (spriteId !== previousSprite || !assetsReady) {
      this.loadThenRebuild(() => this.queueWeapon(this.row));
      return;
    }
    for (const rig of [...this.liveRigs, ...this.onionRigs]) {
      rig.equipWeapon(spriteId, definition, manifest);
    }
    this.restartPending = true;
  }

  setCharacter(characterId: string): void {
    if (characterId === this.characterId) return;
    this.characterId = characterId;
    const manifest = wholeArtCharacterManifest(characterId);
    const ready =
      !!manifest &&
      WHOLE_ART_CHARACTER_PART_ROLES.every((role) =>
        this.textures.exists(wholeArtCharacterTextureKey(characterId, role)),
      );
    if (ready) this.rebuildRigs();
    else this.loadThenRebuild(() => this.queueCharacter(characterId));
  }

  setTimeline(value: number): void {
    const count = beatCount(this.row);
    const bounded = Phaser.Math.Clamp(value, 0, count);
    this.beatIndex = Math.min(count - 1, Math.floor(bounded));
    this.progress = bounded >= count ? 1 : bounded - this.beatIndex;
    this.restartPending = true;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.restartPending = true;
  }

  togglePlaying(): boolean {
    this.setPlaying(!this.playing);
    return this.playing;
  }

  setLooping(looping: boolean): void {
    this.looping = looping;
  }

  setOnionSkin(visible: boolean): void {
    this.onionSkin = visible;
    for (const rig of this.onionRigs) rig.root.setVisible(visible);
    this.restartPending = true;
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Phaser.Math.Clamp(speed, 0.1, 2);
    this.restartPending = true;
  }

  setZoom(zoom: number): void {
    this.zoom = Phaser.Math.Clamp(zoom, 0.6, 2.2);
    this.applyScale();
  }

  setCombatScale(enabled: boolean): void {
    this.combatScale = enabled;
    this.applyScale();
  }

  setPosePreview(pose: ElementTransformPose): void {
    if (pose === this.previewPose) return;
    this.previewPose = pose;
    this.rebuildRigs();
  }

  private applyScale(): void {
    const scale = this.zoom * (this.combatScale ? 1 : 1.55);
    for (const rig of [...this.liveRigs, ...this.onionRigs]) rig.setRigScale(scale);
  }

  private destroyRigs(): void {
    for (const rig of [...this.liveRigs, ...this.onionRigs]) rig.destroy();
    this.liveRigs = [];
    this.onionRigs = [];
  }

  private rebuildRigs(): void {
    this.destroyRigs();
    const definition = editableDefinition(this.row);
    const characterManifest = wholeArtCharacterManifest(this.characterId);
    if (!definition || !characterManifest) {
      this.callbacks.onError(
        "The selected character or generated weapon definition is unavailable.",
      );
      return;
    }
    const spriteId = weaponDisplaySpriteId(definition);
    const weaponManifest = manifestFor(spriteId);
    if (!weaponManifest) {
      this.callbacks.onError(`No installed rig manifest exists for ${spriteId}.`);
      return;
    }
    const width = this.scale.width;
    const height = this.scale.height;
    const y = height * 0.61;
    const xs = [width * 0.29, width * 0.71];
    this.liveRigs = xs.map((x, index) => {
      const rig = new SpriteRig(this, x, y, false, `pose-studio-live-${index}`, this.characterId);
      rig.equipWeapon(spriteId, definition, weaponManifest);
      return rig;
    });
    this.onionRigs = xs.map((x, index) => {
      const rig = new SpriteRig(this, x, y, false, `pose-studio-onion-${index}`, this.characterId);
      rig.equipWeapon(spriteId, definition, weaponManifest);
      rig.root.setAlpha(0.18).setVisible(this.onionSkin);
      return rig;
    });
    this.applyScale();
    this.restartPending = true;
  }

  private layout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;
    const y = height * 0.61;
    const leftX = width * 0.29;
    const rightX = width * 0.71;
    this.liveRigs[0]?.setPosition(leftX, y);
    this.liveRigs[1]?.setPosition(rightX, y);
    this.onionRigs[0]?.setPosition(leftX, y);
    this.onionRigs[1]?.setPosition(rightX, y);
    this.leftCaption?.setPosition(leftX, height - 26);
    this.rightCaption?.setPosition(rightX, height - 26);
    this.backdrop?.clear();
    this.backdrop?.fillStyle(0x0d1110, 1).fillRect(0, 0, width, height);
    this.backdrop?.lineStyle(1, 0x29312e, 0.46);
    for (let x = 0; x < width; x += 40) this.backdrop?.lineBetween(x, 0, x, height);
    for (let yLine = 0; yLine < height; yLine += 40) {
      this.backdrop?.lineBetween(0, yLine, width, yLine);
    }
    this.backdrop?.lineStyle(1, 0xb9fb62, 0.24);
    this.backdrop?.lineBetween(width / 2, 0, width / 2, height);
    this.backdrop?.lineBetween(0, y + 34, width, y + 34);
  }

  private restartPoses(): void {
    const definition = editableDefinition(this.row);
    if (!definition || this.liveRigs.length === 0) return;
    const current = descriptorFor(this.row, definition, this.beatIndex);
    const durationMs = current.poseSeconds * 1000;
    if (this.previewPose === "held") {
      for (const [index, rig] of this.liveRigs.entries()) {
        const aim = index === 0 ? -0.08 : Math.PI + 0.08;
        rig.triggerSwing(this.animationClock - this.progress * durationMs, aim, current);
      }
    }
    const count = beatCount(this.row);
    const previousIndex = (this.beatIndex - 1 + count) % count;
    const previous = descriptorFor(this.row, definition, previousIndex);
    const ghostProgress = Math.max(0.18, Math.min(0.92, this.progress));
    if (this.previewPose === "held") {
      for (const [index, rig] of this.onionRigs.entries()) {
        const aim = index === 0 ? -0.08 : Math.PI + 0.08;
        rig.triggerSwing(
          this.animationClock - ghostProgress * previous.poseSeconds * 1000,
          aim,
          previous,
        );
      }
    }
    this.restartPending = false;
  }

  private advance(deltaMs: number): void {
    if (!this.playing) return;
    const definition = editableDefinition(this.row);
    if (!definition) return;
    const descriptor = descriptorFor(this.row, definition, this.beatIndex);
    this.progress += (deltaMs * this.playbackSpeed) / (descriptor.poseSeconds * 1000);
    if (this.progress < 1) return;
    const count = beatCount(this.row);
    if (this.beatIndex < count - 1) {
      this.beatIndex++;
      this.progress %= 1;
      this.restartPending = true;
    } else if (this.looping) {
      this.beatIndex = 0;
      this.progress %= 1;
      this.restartPending = true;
    } else {
      this.progress = 1;
      this.playing = false;
      this.restartPending = true;
    }
  }

  private animationInput(facing: 1 | -1): RigAnim {
    return {
      moveX: 0,
      moveY: 0,
      aimX: facing,
      aimY: -0.08,
      aimDxPx: facing * 160,
      aimDir: facing === 1 ? -0.08 : Math.PI + 0.08,
      isSelf: true,
      reducedMotion: false,
    };
  }

  private markers(): StageMarkers {
    const rig = this.liveRigs[0];
    const primary = rig?.handWorldAnchor(0) ?? { x: 0, y: 0 };
    const secondary = rig?.handWorldAnchor(1) ?? primary;
    const beat: ComboBeat | undefined = this.row.comboBar?.[this.beatIndex];
    const rangeMultiplier = beat?.path.rangeMultiplier ?? 1;
    const direction = beat?.direction ?? 1;
    const angular =
      beat?.path.deltaAngle ??
      (beat ? beat.path.arcMultiplier * direction * 0.34 : direction * 0.34);
    const radius = Math.min(
      this.scale.width * 0.24,
      Math.max(72, this.row.stats.range * rangeMultiplier * (this.combatScale ? 0.9 : 1.1)),
    );
    const path = {
      x: primary.x + Math.cos(-0.08 + angular) * radius,
      y: primary.y + Math.sin(-0.08 + angular) * radius,
    };
    return {
      primary,
      secondary,
      idle: secondary,
      path,
      pathOrigin: primary,
      bodyHeight: 76 * this.zoom * (this.combatScale ? 1 : 1.55),
      elements: this.liveRigs.flatMap((liveRig) => liveRig.authoredElementSnapshots()),
    };
  }

  override update(_time: number, deltaMs: number): void {
    this.layout();
    this.advance(deltaMs);
    this.animationClock += this.playing ? deltaMs * this.playbackSpeed : 0;
    const presentationFrame: PresentationFrame = {
      frame: ++this.presentationFrameId,
      nowMs: this.animationClock,
      deltaMs: this.playing ? Math.min(100, deltaMs * this.playbackSpeed) : 0,
      deltaSeconds: this.playing ? Math.min(0.1, (deltaMs * this.playbackSpeed) / 1000) : 0,
      wallNowMs: _time,
      wallDeltaMs: deltaMs,
      cut: deltaMs > 100,
    };
    if (this.restartPending) this.restartPoses();
    const inputs = [this.animationInput(1), this.animationInput(-1)];
    for (const [index, rig] of this.onionRigs.entries()) {
      const input = index === 0 ? inputs[0] : inputs[1];
      if (input) this.animatePresentedRig(rig, input, presentationFrame);
    }
    for (const [index, rig] of this.liveRigs.entries()) {
      const input = index === 0 ? inputs[0] : inputs[1];
      if (input) this.animatePresentedRig(rig, input, presentationFrame);
    }
    this.callbacks.onFrame(
      {
        beatIndex: this.beatIndex,
        progress: this.progress,
        timelineValue: this.beatIndex + this.progress,
        playing: this.playing,
      },
      this.markers(),
    );
  }

  private animatePresentedRig(rig: SpriteRig, input: RigAnim, frame: PresentationFrame): void {
    let state = this.presentedRigs.get(rig);
    if (!state) {
      state = createPresentedActorState(frame);
      this.presentedRigs.set(rig, state);
    }
    Object.assign(state, input);
    state.frame = frame;
    state.rootX = rig.x;
    state.rootY = rig.y;
    rig.animate(state);
  }
}

export class PoseStage {
  private readonly scene: PoseStudioScene;
  private readonly game: Phaser.Game;

  constructor(
    parent: HTMLElement,
    row: WeaponAuthoringRow,
    characterId: string,
    callbacks: StageCallbacks,
  ) {
    this.scene = new PoseStudioScene(row, characterId, callbacks);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.max(640, parent.clientWidth),
      height: Math.max(360, parent.clientHeight),
      backgroundColor: "#0d1110",
      transparent: false,
      scene: this.scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: Math.max(640, parent.clientWidth),
        height: Math.max(360, parent.clientHeight),
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
      },
      audio: { noAudio: true },
    });
  }

  setRow(row: WeaponAuthoringRow): void {
    this.scene.setRow(row);
  }

  setCharacter(characterId: string): void {
    this.scene.setCharacter(characterId);
  }

  setTimeline(value: number): void {
    this.scene.setTimeline(value);
  }

  togglePlaying(): boolean {
    return this.scene.togglePlaying();
  }

  setPlaying(playing: boolean): void {
    this.scene.setPlaying(playing);
  }

  setLooping(looping: boolean): void {
    this.scene.setLooping(looping);
  }

  setOnionSkin(visible: boolean): void {
    this.scene.setOnionSkin(visible);
  }

  setPlaybackSpeed(speed: number): void {
    this.scene.setPlaybackSpeed(speed);
  }

  setZoom(zoom: number): void {
    this.scene.setZoom(zoom);
  }

  setCombatScale(enabled: boolean): void {
    this.scene.setCombatScale(enabled);
  }

  setPosePreview(pose: ElementTransformPose): void {
    this.scene.setPosePreview(pose);
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
