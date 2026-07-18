/* biome-ignore-all lint/style/noNonNullAssertion: fixed-cap spectacle rows are bounded by their loops. */
import {
  VASTAGHAR_ENCOUNTER,
  type VastagharActionDef,
  VastagharActionKind,
  VastagharActionResult,
  VastagharArenaMutationKind,
  type VastagharBossState,
  VastagharFoot,
  VastagharMode,
  VastagharPhase,
  VastagharVictoryStage,
} from "@dd/shared";
import type Phaser from "phaser";

const TAU = Math.PI * 2;
const SCAR_CAP = 12;
const PARTICLE_CAP = 64;
const RESOLVE_MEMORY_CAP = 48;
const SHAKE_MEMORY_CAP = 32;
const SWEEP_GLINT_TICKS = 3;
const VASTAGHAR_ACTIONS: Readonly<Partial<Record<number, VastagharActionDef>>> =
  VASTAGHAR_ENCOUNTER.actions;

export type VastagharScoreState =
  | "off"
  | "entrance"
  | "phase1"
  | "phase2"
  | "phase3"
  | "final"
  | "death";

/** Structural subset used by the pure sampler and its tests; the Colyseus row satisfies it directly. */
export type VastagharPresentationState = Pick<
  VastagharBossState,
  | "active"
  | "encounterSeq"
  | "mode"
  | "phase"
  | "phaseStartTick"
  | "actionSeq"
  | "actionKind"
  | "actionResult"
  | "actionStartTick"
  | "actionResolveTick"
  | "actionActiveEndTick"
  | "actionEndTick"
  | "sourceFoot"
  | "aim"
  | "impactX"
  | "impactY"
  | "revolutions"
  | "stepSeq"
  | "stepIndex"
  | "stepCount"
  | "stepStartTick"
  | "stepResolveTick"
  | "responseOpenTick"
  | "stridePips"
  | "punishEndTick"
  | "cueSeq"
  | "cueKind"
  | "cueTick"
  | "arenaMutationSeq"
  | "arenaMutationKind"
  | "arenaMutationTick"
  | "victoryStage"
  | "victoryTick"
  | "victoryXp"
>;

export interface VastagharPresentationFrame {
  active: boolean;
  encounterSeq: number;
  actionSeq: number;
  mode: number;
  phase: number;
  actionKind: number;
  actionResult: number;
  actionLive: boolean;
  sourceFoot: number;
  aim: number;
  impactX: number;
  impactY: number;
  actionT: number;
  windupT: number;
  activeT: number;
  recoveryT: number;
  stepT: number;
  responseT: number;
  responseActive: boolean;
  impactActive: boolean;
  transitionActive: boolean;
  downedGuard: boolean;
  punishActive: boolean;
  desperation: boolean;
  entranceT: number;
  deathT: number;
  worldwheelAngle: number;
  worldwheelRevolution: number;
  worldwheelRevolutionT: number;
  stridePips: number;
  stepIndex: number;
  stepCount: number;
}

export function createVastagharPresentationFrame(): VastagharPresentationFrame {
  return {
    active: false,
    encounterSeq: 0,
    actionSeq: 0,
    mode: VastagharMode.Inactive,
    phase: VastagharPhase.None,
    actionKind: VastagharActionKind.None,
    actionResult: VastagharActionResult.Pending,
    actionLive: false,
    sourceFoot: VastagharFoot.Body,
    aim: 0,
    impactX: 0,
    impactY: 0,
    actionT: 0,
    windupT: 0,
    activeT: 0,
    recoveryT: 0,
    stepT: 0,
    responseT: 0,
    responseActive: false,
    impactActive: false,
    transitionActive: false,
    downedGuard: false,
    punishActive: false,
    desperation: false,
    entranceT: 0,
    deathT: 0,
    worldwheelAngle: 0,
    worldwheelRevolution: 0,
    worldwheelRevolutionT: 0,
    stridePips: 0,
    stepIndex: 0,
    stepCount: 0,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const p = clamp01(value);
  return p * p * (3 - 2 * p);
}

/** Wrap-safe signed distance from an integer epoch to a possibly fractional render tick. */
export function vastagharTickDelta(renderTick: number, epoch: number): number {
  const whole = Math.floor(renderTick);
  return ((whole - epoch) | 0) + (renderTick - whole);
}

function tickProgress(renderTick: number, start: number, end: number): number {
  const elapsed = vastagharTickDelta(renderTick, start);
  const span = (end - start) >>> 0;
  if (elapsed <= 0) return 0;
  return span === 0 ? 1 : clamp01(elapsed / span);
}

function tickCrossed(previous: number, current: number, epoch: number): boolean {
  return vastagharTickDelta(previous, epoch) < 0 && vastagharTickDelta(current, epoch) >= 0;
}

/**
 * Decode the schema-26 tick epochs into one seekable frame. Packet arrival never appears in this math:
 * late observers land at the current action/step/revolution instead of replaying Claim from zero.
 */
export function sampleVastagharPresentation(
  state: VastagharPresentationState,
  renderTick: number,
  out: VastagharPresentationFrame = createVastagharPresentationFrame(),
): VastagharPresentationFrame {
  out.active = state.active;
  out.encounterSeq = state.encounterSeq;
  out.actionSeq = state.actionSeq;
  out.mode = state.mode;
  out.phase = state.phase;
  out.actionKind = state.actionKind;
  out.actionResult = state.actionResult;
  out.actionLive =
    state.active &&
    state.actionKind !== VastagharActionKind.None &&
    vastagharTickDelta(renderTick, state.actionEndTick) < 0;
  out.sourceFoot = state.sourceFoot;
  out.aim = state.aim;
  out.impactX = state.impactX;
  out.impactY = state.impactY;
  out.stridePips = state.stridePips;
  out.stepIndex = state.stepIndex;
  out.stepCount = state.stepCount;

  out.actionT = tickProgress(renderTick, state.actionStartTick, state.actionEndTick);
  out.windupT = tickProgress(renderTick, state.actionStartTick, state.actionResolveTick);
  out.activeT = tickProgress(renderTick, state.actionResolveTick, state.actionActiveEndTick);
  out.recoveryT = tickProgress(renderTick, state.actionActiveEndTick, state.actionEndTick);
  out.stepT = tickProgress(renderTick, state.stepStartTick, state.stepResolveTick);
  out.responseT = tickProgress(renderTick, state.responseOpenTick, state.stepResolveTick);

  const toStepResolve = vastagharTickDelta(renderTick, state.stepResolveTick);
  // `actionResult` resolves after the first contact of a multi-step sequence. The current `stepSeq`
  // remains the answer authority, so later March/Twin/Final-Tread windows must not inherit that latch.
  out.responseActive =
    out.actionLive &&
    vastagharTickDelta(renderTick, state.responseOpenTick) >= 0 &&
    toStepResolve < 0;
  out.impactActive = toStepResolve >= 0 && toStepResolve < 1;
  out.transitionActive = state.mode === VastagharMode.Transition && out.actionLive;
  out.downedGuard =
    state.mode === VastagharMode.StrideBreak &&
    vastagharTickDelta(renderTick, state.punishEndTick) < 0;
  out.punishActive =
    (state.mode === VastagharMode.Punish || state.mode === VastagharMode.StrideBreak) &&
    vastagharTickDelta(renderTick, state.punishEndTick) < 0;
  out.desperation =
    state.mode === VastagharMode.Desperation || state.phase === VastagharPhase.FinalTread;
  out.entranceT =
    state.mode === VastagharMode.Entrance
      ? tickProgress(renderTick, state.phaseStartTick, (state.phaseStartTick + 15) >>> 0)
      : state.active
        ? 1
        : 0;
  out.deathT =
    state.actionKind === VastagharActionKind.Death
      ? tickProgress(renderTick, state.actionStartTick, state.actionEndTick)
      : 0;

  const action = VASTAGHAR_ACTIONS[state.actionKind];
  const revolutions = Math.max(1, state.revolutions || 1);
  const revolutionProgress = clamp01(out.activeT) * revolutions;
  out.worldwheelRevolution = Math.min(revolutions - 1, Math.floor(revolutionProgress));
  out.worldwheelRevolutionT = revolutionProgress - Math.floor(revolutionProgress);
  const sweepStart =
    state.actionKind === VastagharActionKind.Worldwheel
      ? state.aim - Math.PI / 2
      : state.aim - (action?.sweepRadians ?? 0) / 2;
  out.worldwheelAngle = sweepStart + (action?.sweepRadians ?? 0) * out.activeT;
  return out;
}

/** Fixed-memory enforcement of the advocate's one-second impulse and ten-second duty-cycle budgets. */
export class VastagharShakeBudget {
  private readonly at = new Float64Array(SHAKE_MEMORY_CAP);
  private readonly duration = new Float32Array(SHAKE_MEMORY_CAP);
  private readonly intensity = new Float32Array(SHAKE_MEMORY_CAP);
  private readonly tier = new Uint8Array(SHAKE_MEMORY_CAP);
  private cursor = 0;
  private count = 0;

  reset(): void {
    this.cursor = 0;
    this.count = 0;
  }

  accept(nowMs: number, durationMs: number, intensity: number, tier: 1 | 2 | 3): boolean {
    let impulse = 0;
    let duty = 0;
    let recentTierThree = false;
    for (let i = 0; i < this.count; i++) {
      const age = nowMs - this.at[i]!;
      if (age < 0 || age > 10_000) continue;
      duty += this.duration[i]!;
      if (age <= 1_000) {
        impulse += this.duration[i]! * this.intensity[i]!;
        recentTierThree ||= this.tier[i] === 3;
      }
    }
    if (duty + durationMs > 2_000) return false;
    if (impulse + durationMs * intensity > 14) return false;
    if (tier === 3 && recentTierThree) return false;

    const index = this.count < SHAKE_MEMORY_CAP ? this.count++ : this.cursor;
    this.at[index] = nowMs;
    this.duration[index] = durationMs;
    this.intensity[index] = intensity;
    this.tier[index] = tier;
    this.cursor = (index + 1) % SHAKE_MEMORY_CAP;
    return true;
  }
}

export interface VastagharVfxCallbacks {
  audio(cue: string, x?: number, amount?: number): void;
  pack(name: "nuke" | "quake-burst" | "void-implosion", x: number, y: number, radius: number): void;
  score(state: VastagharScoreState): void;
  duckScore(db: number, durationSeconds: number): void;
  shake(
    x: number,
    y: number,
    durationMs: number,
    intensity: number,
    tier: 1 | 2 | 3,
    localThreatened: boolean,
  ): void;
}

export interface VastagharVfxUpdate {
  state: VastagharPresentationState;
  authorityTick: number;
  renderTick: number;
  bossX: number;
  bossY: number;
  localX: number;
  localY: number;
  localThreatened: boolean;
  reducedMotion: boolean;
}

export interface VastagharQuakeResolve {
  encounterSeq: number;
  castSeq: number;
  actionKind: number;
  x: number;
  y: number;
  radius: number;
  localThreatened: boolean;
  reducedMotion: boolean;
}

enum ParticleKind {
  Dust = 1,
  Scrap = 2,
  Crown = 3,
}

function hash01(seed: number): number {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Pooled, epoch-driven titan spectacle. Exact danger remains in ArenaScene's protected telegraph layer. */
export class VastagharVfx {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly air: Phaser.GameObjects.Graphics;
  private readonly response: Phaser.GameObjects.Graphics;
  private readonly screen: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly frame = createVastagharPresentationFrame();

  private readonly scarX = new Float32Array(SCAR_CAP);
  private readonly scarY = new Float32Array(SCAR_CAP);
  private readonly scarRadius = new Float32Array(SCAR_CAP);
  private readonly scarAge = new Float32Array(SCAR_CAP);
  private readonly scarWorldbreak = new Uint8Array(SCAR_CAP);
  private scarCursor = 0;

  private readonly particleKind = new Uint8Array(PARTICLE_CAP);
  private readonly particleX = new Float32Array(PARTICLE_CAP);
  private readonly particleY = new Float32Array(PARTICLE_CAP);
  private readonly particleVx = new Float32Array(PARTICLE_CAP);
  private readonly particleVy = new Float32Array(PARTICLE_CAP);
  private readonly particleAge = new Float32Array(PARTICLE_CAP);
  private readonly particleLife = new Float32Array(PARTICLE_CAP);
  private readonly particleSize = new Float32Array(PARTICLE_CAP);
  private particleCursor = 0;

  private readonly resolvedKeys = new Array<string>(RESOLVE_MEMORY_CAP).fill("");
  private resolvedCursor = 0;
  private seenEncounterSeq = 0;
  private seenCueSeq = 0;
  private seenStepSeq = 0;
  private seenActionSeq = 0;
  private seenRevolution = 0;
  private seenMutationSeq = 0;
  private encounterStartTick = 0;
  private previousRenderTick = 0;
  private seeded = false;
  private deathQuakeFired = false;
  private deathVoidFired = false;
  private deathNukeFired = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: VastagharVfxCallbacks,
  ) {
    this.ground = scene.add.graphics().setDepth(2);
    this.air = scene.add.graphics().setDepth(99_520);
    this.response = scene.add.graphics().setDepth(99_996).setBlendMode(1);
    this.screen = scene.add.graphics().setScrollFactor(0).setDepth(99_980);
    this.title = scene.add
      .text(0, 0, "VASTAGHAR, THE WORLD-TREAD", {
        fontFamily: "monospace",
        fontSize: "24px",
        color: "#f1d28a",
        fontStyle: "bold",
        stroke: "#17120f",
        strokeThickness: 6,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100_004)
      .setVisible(false);
    this.subtitle = scene.add
      .text(0, 0, "THE LAST CROSSING", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#d5b36d",
        fontStyle: "bold",
        stroke: "#17120f",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100_004)
      .setVisible(false);
    this.status = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#17120f",
        strokeThickness: 5,
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(100_004)
      .setVisible(false);
  }

  get presentation(): VastagharPresentationFrame {
    return this.frame;
  }

  private scoreFor(state: VastagharPresentationState): VastagharScoreState {
    if (!state.active) return "off";
    if (state.mode === VastagharMode.Victory) return "death";
    if (state.mode === VastagharMode.Entrance && state.actionSeq <= 1) return "entrance";
    if (state.mode === VastagharMode.Desperation || state.phase === VastagharPhase.FinalTread)
      return "final";
    if (state.phase === VastagharPhase.UnderHeel) return "phase3";
    if (state.phase === VastagharPhase.BreakStride) return "phase2";
    return "phase1";
  }

  private resetEpoch(state: VastagharPresentationState, renderTick: number): void {
    this.seenEncounterSeq = state.encounterSeq;
    this.seenCueSeq = state.cueSeq;
    this.seenStepSeq = state.stepSeq;
    this.seenActionSeq = state.actionSeq;
    this.seenRevolution = this.frame.worldwheelRevolution;
    this.seenMutationSeq = state.arenaMutationSeq;
    this.encounterStartTick =
      state.cueKind === VastagharActionKind.None ? state.cueTick : state.phaseStartTick;
    this.previousRenderTick = renderTick;
    this.seeded = true;
    this.deathQuakeFired = state.victoryStage > VastagharVictoryStage.ThreatEnded;
    this.deathVoidFired = state.victoryStage > VastagharVictoryStage.Collapse;
    this.deathNukeFired = state.victoryStage > VastagharVictoryStage.XpCrown;
    this.resolvedKeys.fill("");
    this.resolvedCursor = 0;
  }

  private playCue(input: VastagharVfxUpdate): void {
    const state = input.state;
    const kind = state.cueKind;
    if (kind === VastagharActionKind.StrideBreak) {
      this.callbacks.audio("boss:titan:break", input.bossX, 1);
      this.callbacks.duckScore(5, 0.36);
      this.callbacks.shake(input.bossX, input.bossY, 180, 0.012, 2, input.localThreatened);
    } else if (kind === VastagharActionKind.Death) {
      this.callbacks.audio("boss:titan:death", input.bossX, 1);
      this.callbacks.duckScore(6, 0.8);
      this.callbacks.shake(input.bossX, input.bossY, 420, 0.03, 3, input.localThreatened);
      this.fireDeathQuake(input);
    }
  }

  private fireDeathQuake(input: VastagharVfxUpdate): void {
    if (this.deathQuakeFired) return;
    this.deathQuakeFired = true;
    if (!input.reducedMotion) this.callbacks.pack("quake-burst", input.bossX, input.bossY, 280);
  }

  private fireDeathVoid(input: VastagharVfxUpdate): void {
    if (this.deathVoidFired) return;
    this.deathVoidFired = true;
    if (!input.reducedMotion) this.callbacks.pack("void-implosion", input.bossX, input.bossY, 230);
  }

  private fireDeathNuke(input: VastagharVfxUpdate): void {
    if (this.deathNukeFired) return;
    this.deathNukeFired = true;
    if (!input.reducedMotion) this.callbacks.pack("nuke", input.bossX, input.bossY, 280);
  }

  update(input: VastagharVfxUpdate, deltaMs: number): VastagharPresentationFrame {
    const state = input.state;
    sampleVastagharPresentation(state, input.renderTick, this.frame);
    this.ground.clear();
    this.air.clear();
    this.response.clear();
    this.screen.clear();
    this.title.setVisible(false);
    this.subtitle.setVisible(false);
    this.status.setVisible(false);
    this.callbacks.score(this.scoreFor(state));

    if (!state.active) {
      this.seeded = false;
      this.drawScars(deltaMs, input.reducedMotion);
      this.drawParticles(deltaMs, input.reducedMotion);
      return this.frame;
    }
    if (!this.seeded || this.seenEncounterSeq !== state.encounterSeq)
      this.resetEpoch(state, input.renderTick);

    if (
      tickCrossed(this.previousRenderTick, input.renderTick, (this.encounterStartTick + 9) >>> 0)
    ) {
      if (!input.reducedMotion) this.callbacks.pack("quake-burst", input.bossX, input.bossY, 280);
      this.callbacks.duckScore(6, 0.7);
      this.callbacks.audio("boss:titan:intro", undefined, 1);
      this.callbacks.shake(input.bossX, input.bossY, 700, 0.02, 3, input.localThreatened);
    }

    if (this.seenCueSeq !== state.cueSeq) {
      this.seenCueSeq = state.cueSeq;
      this.playCue(input);
    }
    if (this.seenStepSeq !== state.stepSeq) {
      this.seenStepSeq = state.stepSeq;
      this.callbacks.audio("boss:titan:lift", state.impactX, 0.82);
    }
    if (this.seenActionSeq !== state.actionSeq) {
      this.seenActionSeq = state.actionSeq;
      this.seenRevolution =
        state.actionKind === VastagharActionKind.Worldwheel ? -1 : this.frame.worldwheelRevolution;
    } else if (
      state.actionKind === VastagharActionKind.Worldwheel &&
      this.frame.activeT > 0 &&
      this.frame.worldwheelRevolution > this.seenRevolution
    ) {
      this.seenRevolution = this.frame.worldwheelRevolution;
      this.callbacks.audio("boss:titan:wheel", input.bossX, 0.78);
    }
    if (
      this.frame.responseActive &&
      tickCrossed(this.previousRenderTick, input.renderTick, state.responseOpenTick)
    )
      this.callbacks.audio("boss:titan:glint", state.impactX, 0.72);

    if (this.seenMutationSeq !== state.arenaMutationSeq) {
      this.seenMutationSeq = state.arenaMutationSeq;
      if (
        state.arenaMutationKind === VastagharArenaMutationKind.StuckStep ||
        state.arenaMutationKind === VastagharArenaMutationKind.WorldTurn
      ) {
        this.callbacks.audio("boss:titan:phase", input.bossX, 1);
        this.callbacks.shake(input.bossX, input.bossY, 320, 0.024, 3, input.localThreatened);
        if (!input.reducedMotion)
          this.callbacks.pack(
            state.arenaMutationKind === VastagharArenaMutationKind.StuckStep
              ? "quake-burst"
              : "void-implosion",
            input.bossX,
            input.bossY,
            state.arenaMutationKind === VastagharArenaMutationKind.StuckStep ? 220 : 230,
          );
      }
    }

    const action = VASTAGHAR_ACTIONS[state.actionKind];
    const footfallSequence =
      state.actionKind === VastagharActionKind.Crownstep ||
      state.actionKind === VastagharActionKind.ThreefoldMarch ||
      state.actionKind === VastagharActionKind.TwinTread ||
      state.actionKind === VastagharActionKind.FinalTread;
    const stepRadius = action?.stepRadii[state.stepIndex] ?? action?.stepRadii[0] ?? 0;
    if (
      footfallSequence &&
      state.stepSeq !== 0 &&
      stepRadius > 0 &&
      tickCrossed(this.previousRenderTick, input.renderTick, state.stepResolveTick)
    )
      this.resolveQuake({
        encounterSeq: state.encounterSeq,
        castSeq: (state.actionSeq << 3) + state.stepIndex + 1,
        actionKind: state.actionKind,
        x: state.impactX,
        y: state.impactY,
        radius: stepRadius,
        localThreatened: input.localThreatened,
        reducedMotion: input.reducedMotion,
      });

    if (state.mode === VastagharMode.Victory) {
      const deathAge = vastagharTickDelta(input.renderTick, state.actionStartTick);
      if (deathAge >= 0) this.fireDeathQuake(input);
      if (deathAge >= 3.2) this.fireDeathVoid(input);
      if (deathAge >= 6.6) this.fireDeathNuke(input);
    }

    this.drawScars(deltaMs, input.reducedMotion);
    this.drawParticles(deltaMs, input.reducedMotion);
    this.drawEntrance(input);
    this.drawAction(input);
    this.drawVictory(input);
    this.previousRenderTick = input.renderTick;
    return this.frame;
  }

  private drawEntrance(input: VastagharVfxUpdate): void {
    const age = vastagharTickDelta(input.renderTick, this.encounterStartTick);
    if (age < 0 || age > 64 || input.state.phase !== VastagharPhase.LearnWeight) return;
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    if (!input.reducedMotion && age <= 3) {
      const tear = 34 * smoothstep(age / 3);
      this.screen.fillStyle(0x14100e, 0.9 * (1 - clamp01(age / 4)));
      this.screen.fillRect(0, 0, width, Math.max(0, height / 2 - tear));
      this.screen.fillRect(0, height / 2 + tear, width, Math.max(0, height / 2 - tear));
    }
    if (age >= 16 && age <= 56) {
      this.title
        .setPosition(width / 2, 86)
        .setVisible(true)
        .setAlpha(clamp01((56 - age) / 8));
      this.subtitle
        .setPosition(width / 2, 112)
        .setVisible(true)
        .setAlpha(clamp01((56 - age) / 8));
    }
    if (age >= 29 && age <= 64) {
      this.status
        .setPosition(width / 2, 142)
        .setText("JUMP or PARRY the WHITE footfall")
        .setColor("#ffffff")
        .setVisible(true)
        .setAlpha(clamp01((64 - age) / 8));
    }
  }

  private drawAction(input: VastagharVfxUpdate): void {
    const state = input.state;
    const frame = this.frame;
    const actionKind = frame.actionLive ? state.actionKind : VastagharActionKind.None;
    const action = VASTAGHAR_ACTIONS[actionKind];
    const radius = action?.stepRadii[state.stepIndex] ?? action?.stepRadii[0] ?? 0;
    if (frame.responseActive && radius > 0) {
      const p = frame.responseT;
      const alpha = 0.46 + 0.42 * Math.sin(p * Math.PI);
      this.response.lineStyle(input.reducedMotion ? 2.2 : 3.2, 0xffffff, alpha);
      this.response.strokeCircle(state.impactX, state.impactY, radius);
      const tickCount = input.reducedMotion ? 8 : 12;
      for (let i = 0; i < tickCount; i++) {
        const angle = (i / tickCount) * TAU;
        const inset = 10 + 18 * p;
        this.response.lineStyle(2, 0xffffff, 0.28 + p * 0.48);
        this.response.lineBetween(
          state.impactX + Math.cos(angle) * radius,
          state.impactY + Math.sin(angle) * radius,
          state.impactX + Math.cos(angle) * (radius - inset),
          state.impactY + Math.sin(angle) * (radius - inset),
        );
      }
      this.drawFootBracket(state.impactX, state.impactY, p, input);
      this.drawEdgeDirection(state.impactX, state.impactY, 0xffffff);
    }

    if (
      (actionKind === VastagharActionKind.Worldwheel ||
        actionKind === VastagharActionKind.HeelReap) &&
      action
    ) {
      const forecastAlpha = frame.windupT < 1 ? 0.16 + frame.windupT * 0.12 : 0.1;
      this.ground.lineStyle(2, 0xc9b78c, forecastAlpha);
      if (actionKind === VastagharActionKind.Worldwheel) {
        this.ground.strokeCircle(input.bossX, input.bossY, action.innerRange);
        this.ground.strokeCircle(input.bossX, input.bossY, action.outerRange);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          this.ground.lineStyle(1.5, 0xbda579, forecastAlpha * 0.75);
          this.ground.lineBetween(
            input.bossX + Math.cos(a) * action.innerRange,
            input.bossY + Math.sin(a) * action.innerRange,
            input.bossX + Math.cos(a) * (action.innerRange + 18),
            input.bossY + Math.sin(a) * (action.innerRange + 18),
          );
        }
      } else {
        const start = state.aim - action.sweepRadians / 2;
        this.ground.beginPath();
        this.ground.arc(
          input.bossX,
          input.bossY,
          action.outerRange,
          start,
          start + action.sweepRadians,
        );
        this.ground.strokePath();
      }
      if (frame.responseActive) {
        const hx = input.bossX + Math.cos(frame.worldwheelAngle) * action.outerRange;
        const hy = input.bossY + Math.sin(frame.worldwheelAngle) * action.outerRange;
        this.response.lineStyle(
          input.reducedMotion ? 2.2 : 3.2,
          0xffffff,
          0.42 + frame.responseT * 0.46,
        );
        this.response.beginPath();
        this.response.arc(
          input.bossX,
          input.bossY,
          action.outerRange,
          actionKind === VastagharActionKind.Worldwheel ? 0 : state.aim - action.sweepRadians / 2,
          actionKind === VastagharActionKind.Worldwheel ? TAU : state.aim + action.sweepRadians / 2,
        );
        this.response.strokePath();
        this.drawFootBracket(hx, hy, frame.responseT, input);
        this.drawEdgeDirection(hx, hy, 0xffffff);
      }
      if (frame.activeT > 0 && frame.activeT < 1) {
        const hx = input.bossX + Math.cos(frame.worldwheelAngle) * action.outerRange;
        const hy = input.bossY + Math.sin(frame.worldwheelAngle) * action.outerRange;
        const localAngle = Math.atan2(input.localY - input.bossY, input.localX - input.bossX);
        const ahead = (((localAngle - frame.worldwheelAngle) % TAU) + TAU) % TAU;
        const leadRadians =
          (Math.abs(action.sweepRadians) * SWEEP_GLINT_TICKS) / Math.max(1, action.activeTicks);
        const contactLead = ahead <= leadRadians ? 1 - ahead / Math.max(0.001, leadRadians) : 0;
        this.drawFootBracket(hx, hy, contactLead, input);
        this.drawEdgeDirection(hx, hy, 0xffffff);
        if (actionKind === VastagharActionKind.Worldwheel) {
          const notchAngle = state.aim - Math.PI / 2;
          for (let revolution = 0; revolution < 2; revolution++) {
            const notchRadius = action.outerRange + 18 + revolution * 10;
            const complete = revolution < frame.worldwheelRevolution;
            this.ground.lineStyle(3, complete ? 0xe0c16e : 0x82715d, complete ? 0.7 : 0.3);
            this.ground.lineBetween(
              input.bossX + Math.cos(notchAngle) * notchRadius,
              input.bossY + Math.sin(notchAngle) * notchRadius,
              input.bossX + Math.cos(notchAngle) * (notchRadius + 12),
              input.bossY + Math.sin(notchAngle) * (notchRadius + 12),
            );
          }
        }
      }
    }

    if (frame.transitionActive) {
      const q = smoothstep(frame.actionT);
      const color = state.actionKind === VastagharActionKind.PhaseWorldTurn ? 0x875cb8 : 0xb69762;
      this.air.lineStyle(5, 0x17120f, 0.62);
      this.air.lineBetween(input.bossX - 180 * q, input.bossY, input.bossX + 180 * q, input.bossY);
      this.air.lineStyle(2, color, 0.78);
      this.air.lineBetween(input.bossX - 180 * q, input.bossY, input.bossX + 180 * q, input.bossY);
    }

    if (frame.downedGuard) {
      const replant = smoothstep((frame.actionT - (1 - 9 / 64)) / (9 / 64));
      const remaining = Math.max(
        0,
        ((state.punishEndTick - Math.floor(input.renderTick)) | 0) -
          (input.renderTick - Math.floor(input.renderTick)),
      );
      this.status
        .setPosition(this.scene.scale.width / 2, 112)
        .setText(`DOWNED GUARD  •  PAYOFF TIME  •  ${(remaining / 20).toFixed(1)}s`)
        .setColor("#ffd978")
        .setVisible(true)
        .setAlpha(0.82 + 0.18 * Math.sin(input.renderTick * 0.5));
      this.ground.lineStyle(5, replant > 0 ? 0x4b4036 : 0xf0c66a, 0.35 + replant * 0.18);
      this.ground.strokeEllipse(input.bossX, input.bossY, 430, 180);
    } else if (frame.desperation && state.mode !== VastagharMode.Victory) {
      this.screen.lineStyle(12, 0x6b1f25, input.reducedMotion ? 0.12 : 0.2);
      this.screen.strokeRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    }
  }

  private drawFootBracket(x: number, y: number, progress: number, input: VastagharVfxUpdate): void {
    const crest = progress >= 0.72;
    const size = input.reducedMotion ? 13 : crest ? 23 : 16;
    const alpha = input.reducedMotion ? 0.68 : 0.5 + progress * 0.5;
    this.response.lineStyle(crest ? 3.4 : 2.2, 0xffffff, alpha);
    this.response.lineBetween(x - size, y - size, x - size * 0.35, y - size * 0.35);
    this.response.lineBetween(x + size, y + size, x + size * 0.35, y + size * 0.35);
    this.response.lineBetween(x + size, y - size, x + size * 0.35, y - size * 0.35);
    this.response.lineBetween(x - size, y + size, x - size * 0.35, y + size * 0.35);
    if (crest) this.response.fillStyle(0xffffff, 0.9).fillCircle(x, y, 3.2);
  }

  private drawEdgeDirection(x: number, y: number, color: number): void {
    const camera = this.scene.cameras.main;
    const sx = (x - camera.scrollX) * camera.zoom;
    const sy = (y - camera.scrollY) * camera.zoom;
    if (sx >= 32 && sx <= camera.width - 32 && sy >= 32 && sy <= camera.height - 32) return;
    const cx = camera.width * 0.5;
    const cy = camera.height * 0.5;
    const dx = sx - cx;
    const dy = sy - cy;
    const scale = Math.min(
      Math.abs(dx) > 0.001 ? (cx - 44) / Math.abs(dx) : Number.POSITIVE_INFINITY,
      Math.abs(dy) > 0.001 ? (cy - 44) / Math.abs(dy) : Number.POSITIVE_INFINITY,
    );
    const ex = cx + dx * scale;
    const ey = cy + dy * scale;
    const angle = Math.atan2(dy, dx);
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const bx = ex - Math.cos(angle) * 18;
    const by = ey - Math.sin(angle) * 18;
    this.screen.fillStyle(0x17120f, 0.82);
    this.screen.fillTriangle(ex, ey, bx + nx * 10, by + ny * 10, bx - nx * 10, by - ny * 10);
    this.screen.lineStyle(2.5, color, 0.94);
    this.screen.lineBetween(bx - nx * 8, by - ny * 8, ex, ey);
    this.screen.lineBetween(ex, ey, bx + nx * 8, by + ny * 8);
  }

  private drawVictory(input: VastagharVfxUpdate): void {
    const state = input.state;
    if (state.mode !== VastagharMode.Victory) return;
    const stage = state.victoryStage;
    if (stage === VastagharVictoryStage.XpCrown) {
      const pulse = 0.5 + Math.sin(input.renderTick * 0.35) * 0.5;
      this.air.lineStyle(3, 0xffdd78, 0.55 + pulse * 0.35);
      this.air.strokeCircle(input.bossX, input.bossY - 24, 22 + pulse * 5);
      this.air.lineBetween(input.bossX - 15, input.bossY - 32, input.bossX - 8, input.bossY - 45);
      this.air.lineBetween(input.bossX - 8, input.bossY - 45, input.bossX, input.bossY - 34);
      this.air.lineBetween(input.bossX, input.bossY - 34, input.bossX + 8, input.bossY - 45);
      this.air.lineBetween(input.bossX + 8, input.bossY - 45, input.bossX + 15, input.bossY - 32);
    }
    const held = stage >= VastagharVictoryStage.ReceiptHeld;
    this.status
      .setPosition(this.scene.scale.width / 2, 112)
      .setText(
        held
          ? `THE LAST CROSSING CLEARED  •  +${state.victoryXp || VASTAGHAR_ENCOUNTER.bossXp} XP`
          : "THE WORLD-TREAD FALLS",
      )
      .setColor(held ? "#ffe092" : "#e8d8bc")
      .setVisible(true);
  }

  resolveQuake(resolve: VastagharQuakeResolve): boolean {
    const key = `${resolve.encounterSeq}:${resolve.castSeq}`;
    for (const remembered of this.resolvedKeys) if (remembered === key) return false;
    this.resolvedKeys[this.resolvedCursor] = key;
    this.resolvedCursor = (this.resolvedCursor + 1) % this.resolvedKeys.length;

    const index = this.scarCursor;
    this.scarCursor = (this.scarCursor + 1) % SCAR_CAP;
    this.scarX[index] = resolve.x;
    this.scarY[index] = resolve.y;
    this.scarRadius[index] = resolve.radius;
    this.scarAge[index] = 0.001;
    this.scarWorldbreak[index] = resolve.radius >= 900 ? 1 : 0;

    const visible = this.scene.cameras.main.worldView.contains(resolve.x, resolve.y);
    if (visible && !resolve.reducedMotion)
      this.callbacks.pack(
        "quake-burst",
        resolve.x,
        resolve.y,
        resolve.radius >= 900 ? 280 : Math.min(190, resolve.radius * 0.48),
      );
    if (visible)
      this.emitDust(resolve.x, resolve.y, resolve.castSeq, resolve.reducedMotion ? 5 : 12);
    this.callbacks.audio("boss:titan:step", resolve.x, resolve.radius >= 900 ? 1 : 0.88);
    if (resolve.radius >= 900) this.callbacks.duckScore(6, 0.42);
    this.callbacks.shake(
      resolve.x,
      resolve.y,
      resolve.radius >= 900 ? 320 : 220,
      resolve.radius >= 900 ? 0.024 : 0.018,
      resolve.radius >= 900 ? 3 : 2,
      resolve.localThreatened,
    );
    return true;
  }

  emitAddEntrance(x: number, y: number, epoch: number, reducedMotion: boolean): void {
    if (!this.scene.cameras.main.worldView.contains(x, y)) return;
    const count = reducedMotion ? 3 : 8;
    for (let i = 0; i < count; i++) {
      const angle = hash01(epoch + i * 31) * TAU;
      const speed = 38 + hash01(epoch + i * 47) * 78;
      this.seedParticle(
        ParticleKind.Scrap,
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        420 + hash01(epoch + i * 61) * 260,
        3 + hash01(epoch + i * 73) * 5,
      );
    }
  }

  private emitDust(x: number, y: number, epoch: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = hash01(epoch + i * 41) * TAU;
      const speed = 44 + hash01(epoch + i * 53) * 105;
      this.seedParticle(
        ParticleKind.Dust,
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed * 0.62,
        360 + hash01(epoch + i * 67) * 360,
        2.5 + hash01(epoch + i * 79) * 6,
      );
    }
  }

  private seedParticle(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
  ): void {
    let index = this.particleCursor;
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const candidate = (this.particleCursor + i) % PARTICLE_CAP;
      if (this.particleKind[candidate] === 0) {
        index = candidate;
        break;
      }
    }
    this.particleCursor = (index + 1) % PARTICLE_CAP;
    this.particleKind[index] = kind;
    this.particleX[index] = x;
    this.particleY[index] = y;
    this.particleVx[index] = vx;
    this.particleVy[index] = vy;
    this.particleAge[index] = 0;
    this.particleLife[index] = life;
    this.particleSize[index] = size;
  }

  private drawScars(deltaMs: number, reducedMotion: boolean): void {
    for (let i = 0; i < SCAR_CAP; i++) {
      const initialAge = this.scarAge[i]!;
      if (initialAge <= 0) continue;
      const age = initialAge + deltaMs;
      this.scarAge[i] = age;
      if (age >= 2_000) {
        this.scarAge[i] = 0;
        continue;
      }
      const q = clamp01(age / 2_000);
      const x = this.scarX[i]!;
      const y = this.scarY[i]!;
      const radius = this.scarRadius[i]!;
      const impactQ = clamp01(age / (reducedMotion ? 140 : 360));
      const ringRadius = radius * (0.15 + smoothstep(impactQ) * 0.85);
      // The material perimeter is full-size on the resolve epoch. A lower-contrast shock ring may travel
      // inside it, but no expanding decoration is allowed to imply expanding gameplay coverage.
      this.ground.lineStyle(reducedMotion ? 2 : 3, 0x75675a, (1 - q) * 0.58);
      this.ground.strokeCircle(x, y, radius);
      if (!reducedMotion) {
        this.ground.lineStyle(3, 0xd9d2c0, (1 - q) * 0.42);
        this.ground.strokeCircle(x, y, ringRadius);
      }
      const cracks = reducedMotion ? 8 : this.scarWorldbreak[i] ? 20 : 12;
      for (let crack = 0; crack < cracks; crack++) {
        const angle = (crack / cracks) * TAU + hash01(i * 97 + crack * 13) * 0.22;
        const inner = radius * (0.18 + (crack % 3) * 0.07);
        const outer = radius * (0.65 + (crack % 4) * 0.07);
        this.ground.lineStyle(1.4, 0x75675a, (1 - q) * 0.32);
        this.ground.lineBetween(
          x + Math.cos(angle) * inner,
          y + Math.sin(angle) * inner,
          x + Math.cos(angle) * outer,
          y + Math.sin(angle) * outer,
        );
      }
    }
  }

  private drawParticles(deltaMs: number, reducedMotion: boolean): void {
    const dt = Math.min(0.05, Math.max(0, deltaMs / 1_000));
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const kind = this.particleKind[i]!;
      if (kind === 0) continue;
      this.particleAge[i] = this.particleAge[i]! + deltaMs;
      const age = this.particleAge[i]!;
      const life = this.particleLife[i]!;
      if (age >= life) {
        this.particleKind[i] = 0;
        continue;
      }
      this.particleX[i] = this.particleX[i]! + this.particleVx[i]! * dt;
      this.particleY[i] = this.particleY[i]! + this.particleVy[i]! * dt;
      this.particleVx[i] = this.particleVx[i]! * Math.max(0, 1 - dt * 2.4);
      this.particleVy[i] = this.particleVy[i]! * Math.max(0, 1 - dt * 2.4) + 45 * dt;
      const q = clamp01(age / life);
      const alpha = (1 - q) * (reducedMotion ? 0.38 : 0.7);
      const size = this.particleSize[i]!;
      if (kind === ParticleKind.Dust) {
        this.air.fillStyle(0xb59a70, alpha * 0.5);
        this.air.fillCircle(this.particleX[i]!, this.particleY[i]!, size * (0.8 + q));
      } else {
        this.air.fillStyle(kind === ParticleKind.Crown ? 0xffdd78 : 0xd3c7ad, alpha);
        this.air.fillTriangle(
          this.particleX[i]! + size,
          this.particleY[i]!,
          this.particleX[i]! - size * 0.6,
          this.particleY[i]! - size * 0.45,
          this.particleX[i]! - size * 0.6,
          this.particleY[i]! + size * 0.45,
        );
      }
    }
  }

  destroy(): void {
    this.callbacks.score("off");
    this.ground.destroy();
    this.air.destroy();
    this.response.destroy();
    this.screen.destroy();
    this.title.destroy();
    this.subtitle.destroy();
    this.status.destroy();
  }
}
