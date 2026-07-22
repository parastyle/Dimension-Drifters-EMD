// @ts-nocheck -- throwaway runtime instrumentation intentionally inspects private live rig fields.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { meleeComboSelectionFor, WEAPONS } from "@dd/shared";
import {
  bootArena,
  runArenaSpec,
  waitForDevWeapon,
} from "../../../../e2e/helpers/arena-harness.js";

const EVIDENCE_DIR = import.meta.dirname;
const RAW_FILE = path.join(EVIDENCE_DIR, "live-per-part-frames.json");
const SUMMARY_FILE = path.join(EVIDENCE_DIR, "live-analysis.json");

const POSITION_MULTIPLE = 6;
const ROTATION_MULTIPLE = 6;
const POSITION_FLOOR_PX = 4;
const ROTATION_FLOOR_RAD = 0.12;
const LOCAL_RADIUS = 15;

const WEAPON_SPECS = [
  { id: "x-sword-neon-katana", weaponClass: "katana" },
  { id: "x2-verdict-longsword", weaponClass: "ordinary non-katana melee" },
  { id: "x2-dustreaper-zweihander", weaponClass: "greatsword" },
  { id: "x2-wendigo-claws", weaponClass: "claw / dual wield" },
  { id: "x2-dustdevil-glaive", weaponClass: "polearm" },
  { id: "twin-bowie-fangs", weaponClass: "dagger / dual wield" },
].map((spec) => {
  const definition = WEAPONS[spec.id];
  if (!definition) throw new Error(`missing measurement weapon ${spec.id}`);
  const selection = meleeComboSelectionFor(definition);
  if (!selection) throw new Error(`missing combo selection for ${spec.id}`);
  return {
    ...spec,
    steps: selection.sequence.length,
    comboFamily: selection.family,
    comboVariant: selection.variant,
    cooldown: definition.cooldown,
    dual: definition.dual === true,
  };
});

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function partVisibilityWeight(part: string): { position: number; rotation: number } {
  if (part.startsWith("weapon:")) return { position: 1.35, rotation: 60 };
  if (part.startsWith("hand-arm:")) return { position: 1.25, rotation: 32 };
  if (part === "torso/body") return { position: 1.12, rotation: 30 };
  if (part === "head") return { position: 1.1, rotation: 28 };
  if (part.startsWith("foot:")) return { position: 0.9, rotation: 20 };
  if (part === "root") return { position: 1, rotation: 35 };
  if (part.startsWith("shadow")) return { position: 0.25, rotation: 8 };
  return { position: 0.5, rotation: 12 };
}

function weaponLabel(previous: any, current: any): string {
  const before = previous.weaponIds.join("+") || "unarmed";
  const after = current.weaponIds.join("+") || "unarmed";
  return before === after ? after : `${before} → ${after}`;
}

function classifyBoundary(previous: any, current: any): string {
  const beforeWeapons = previous.weaponIds.join("+");
  const afterWeapons = current.weaponIds.join("+");
  if (beforeWeapons !== afterWeapons) return "weapon swap";

  const movementScenario = current.scenario.includes(":movement-");
  const stanceEntry = previous.moveStance !== current.moveStance;
  const airborneEntry = (previous.height ?? 0) <= 0.5 && (current.height ?? 0) > 0.5;
  if (movementScenario && (stanceEntry || airborneEntry)) return "movement interrupt";

  if (
    previous.comboFamily !== "none" &&
    current.comboFamily === "none"
  ) {
    return "chain drop/expiry";
  }
  if (
    previous.attackStage === "hold" &&
    current.attackStage === "rest" &&
    current.scenario.includes(":drop")
  ) {
    return "chain drop/expiry";
  }
  if (
    previous.comboStep !== current.comboStep &&
    (previous.attackStage !== "rest" || current.attackStage !== "rest")
  ) {
    if (
      (previous.dual || current.dual) &&
      previous.swingHand !== current.swingHand
    ) {
      return "dual-wield hand desync";
    }
    return "combo step boundary";
  }
  if (previous.attackStage !== "attack" && current.attackStage === "attack") {
    return "rest → attack";
  }
  if (
    previous.attackStage === "attack" &&
    current.attackStage !== "attack"
  ) {
    return "attack → rest";
  }
  if (previous.attackStage === "hold" && current.attackStage === "rest") {
    return "attack → rest";
  }
  return "within-pose / no named seam";
}

function analyzeFrames(frames: readonly any[]): any {
  const bySeries = new Map<string, any[]>();
  for (const frame of frames) {
    const key = `${frame.actorId}|${frame.scenario}`;
    const series = bySeries.get(key) ?? [];
    series.push(frame);
    bySeries.set(key, series);
  }

  const boundaries: any[] = [];
  for (const series of bySeries.values()) {
    series.sort((a, b) => a.frameIndex - b.frameIndex);
    const partDeltas = new Map<string, any[]>();
    for (let index = 1; index < series.length; index++) {
      const previous = series[index - 1];
      const current = series[index];
      const seam = classifyBoundary(previous, current);
      for (const [part, now] of Object.entries(current.parts)) {
        const before = previous.parts[part];
        if (!before || (!before.rendered && !now.rendered)) continue;
        const positionPx = Math.hypot(now.worldX - before.worldX, now.worldY - before.worldY);
        const rotationRad = angleDistance(now.worldRotation, before.worldRotation);
        const scaleDelta = Math.hypot(now.worldScaleX - before.worldScaleX, now.worldScaleY - before.worldScaleY);
        const record = {
          seriesIndex: index,
          frameIndex: current.frameIndex,
          previousFrameIndex: previous.frameIndex,
          wallMs: current.wallMs,
          sceneNow: current.sceneNow,
          frameDtMs: current.wallMs - previous.wallMs,
          actorId: current.actorId,
          actorType: current.actorType,
          scenario: current.scenario,
          seam,
          weapon: weaponLabel(previous, current),
          part,
          positionPx,
          rotationRad,
          scaleDelta,
          from: before,
          to: now,
          previousMeta: {
            attackSeq: previous.attackSeq,
            rigAttackSeq: previous.rigAttackSeq,
            comboStep: previous.comboStep,
            swingHand: previous.swingHand,
            attackStage: previous.attackStage,
            comboFamily: previous.comboFamily,
            moveStance: previous.moveStance,
            height: previous.height,
          },
          currentMeta: {
            attackSeq: current.attackSeq,
            rigAttackSeq: current.rigAttackSeq,
            comboStep: current.comboStep,
            swingHand: current.swingHand,
            attackStage: current.attackStage,
            comboFamily: current.comboFamily,
            moveStance: current.moveStance,
            height: current.height,
          },
        };
        const list = partDeltas.get(part) ?? [];
        list.push(record);
        partDeltas.set(part, list);
        boundaries.push(record);
      }
    }

    for (const partRecords of partDeltas.values()) {
      for (let index = 0; index < partRecords.length; index++) {
        const record = partRecords[index];
        const local = partRecords.slice(
          Math.max(0, index - LOCAL_RADIUS),
          Math.min(partRecords.length, index + LOCAL_RADIUS + 1),
        );
        const neighbors = local.filter((candidate) => candidate !== record);
        record.localMedianPositionPx = median(neighbors.map((candidate) => candidate.positionPx));
        record.localMedianRotationRad = median(neighbors.map((candidate) => candidate.rotationRad));
        const positionTeleport =
          record.positionPx >= POSITION_FLOOR_PX &&
          record.positionPx >=
            POSITION_MULTIPLE * Math.max(record.localMedianPositionPx, 0.001);
        const rotationTeleport =
          record.rotationRad >= ROTATION_FLOOR_RAD &&
          record.rotationRad >=
            ROTATION_MULTIPLE * Math.max(record.localMedianRotationRad, 0.0001);
        record.positionMultiple =
          record.positionPx / Math.max(record.localMedianPositionPx, 0.001);
        record.rotationMultiple =
          record.rotationRad / Math.max(record.localMedianRotationRad, 0.0001);
        record.flagged = positionTeleport || rotationTeleport;
        const weights = partVisibilityWeight(record.part);
        record.visibilityScore =
          record.positionPx * weights.position + record.rotationRad * weights.rotation;
      }
    }
  }

  const opportunities = new Map<string, any>();
  for (const boundary of boundaries) {
    const key = [
      boundary.seam,
      boundary.actorType,
      boundary.weapon,
      boundary.part,
    ].join("|");
    const aggregate = opportunities.get(key) ?? {
      seam: boundary.seam,
      actorType: boundary.actorType,
      weapon: boundary.weapon,
      part: boundary.part,
      opportunities: 0,
      fires: 0,
      positionDeltas: [],
      rotationDeltas: [],
      worst: undefined,
    };
    aggregate.opportunities++;
    aggregate.positionDeltas.push(boundary.positionPx);
    aggregate.rotationDeltas.push(boundary.rotationRad);
    if (boundary.flagged) {
      aggregate.fires++;
      if (!aggregate.worst || boundary.visibilityScore > aggregate.worst.visibilityScore) {
        aggregate.worst = boundary;
      }
    }
    opportunities.set(key, aggregate);
  }

  const ranked = [...opportunities.values()]
    .filter((entry) => entry.fires > 0)
    .map((entry) => ({
      seam: entry.seam,
      actorType: entry.actorType,
      weapon: entry.weapon,
      part: entry.part,
      worstPositionPx: entry.worst.positionPx,
      worstRotationRad: entry.worst.rotationRad,
      medianPositionPx: median(entry.positionDeltas),
      medianRotationRad: median(entry.rotationDeltas),
      localMedianAtWorstPositionPx: entry.worst.localMedianPositionPx,
      localMedianAtWorstRotationRad: entry.worst.localMedianRotationRad,
      fires: entry.fires,
      opportunities: entry.opportunities,
      fireRate: entry.fires / entry.opportunities,
      visibilityScore: entry.worst.visibilityScore,
      worstBoundary: entry.worst,
    }))
    .sort((a, b) => b.visibilityScore - a.visibilityScore);

  const flagsBySeam: Record<string, number> = {};
  for (const boundary of boundaries) {
    if (!boundary.flagged) continue;
    flagsBySeam[boundary.seam] = (flagsBySeam[boundary.seam] ?? 0) + 1;
  }
  const totalFlags = Object.values(flagsBySeam).reduce((sum, value) => sum + value, 0);
  const namedSeamFlags = Object.entries(flagsBySeam)
    .filter(([seam]) => seam !== "within-pose / no named seam")
    .reduce((sum, [, value]) => sum + value, 0);

  const coverage = WEAPON_SPECS.flatMap((spec) =>
    ["local", "remote"].map((actorType) => {
      const matching = frames.filter(
        (frame) =>
          frame.actorType === actorType &&
          frame.weaponIds.includes(spec.id) &&
          frame.scenario.includes(":full"),
      );
      return {
        actorType,
        weaponId: spec.id,
        weaponClass: spec.weaponClass,
        expectedSteps: spec.steps,
        observedSteps: [...new Set(matching.map((frame) => frame.comboStep).filter((step) => step >= 0))].sort((a, b) => a - b),
        renderedFrames: matching.length,
        authoritySeqs: [...new Set(matching.map((frame) => frame.attackSeq))].length,
        rigSeqMatches: matching.filter((frame) => frame.attackSeq === frame.rigAttackSeq).length,
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    method: {
      positionalDelta: "Euclidean distance between consecutive final world-transform origins",
      rotationalDelta: "wrapped absolute world-rotation difference",
      localWindow: `${LOCAL_RADIUS} prior + ${LOCAL_RADIUS} following boundaries for the same actor/scenario/part, excluding the tested boundary`,
      positionThreshold: `>= ${POSITION_FLOOR_PX}px and >= ${POSITION_MULTIPLE}x local median`,
      rotationThreshold: `>= ${ROTATION_FLOOR_RAD}rad and >= ${ROTATION_MULTIPLE}x local median`,
      visibilityRanking: "weapon rotation 60 px-equivalent/rad; weapon position 1.35x; hand position 1.25x; shadow position 0.25x",
    },
    frameCount: frames.length,
    transformSampleCount: frames.reduce((sum, frame) => sum + Object.keys(frame.parts).length, 0),
    boundaryPartComparisons: boundaries.length,
    totalFlags,
    namedSeamFlags,
    flagsBySeam,
    coverage,
    ranked,
  };
}

async function equipLocal(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect.poll(
    () => page.evaluate((id) => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      const self = arena.room.state.players.get(arena.room.sessionId);
      return {
        authority: self?.weapon ?? null,
        rig: arena.blobs.get(arena.room.sessionId)?.weaponDef?.id ?? null,
        wanted: id,
      };
    }, weaponId),
    { message: `equip ${weaponId}` },
  ).toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function setScenario(page: Page, scenario: string, actorIds: string[]): Promise<void> {
  await page.evaluate(({ label, ids }) => {
    globalThis.__animMeasureScenario = label;
    globalThis.__animMeasureActors = ids;
  }, { label: scenario, ids: actorIds });
}

async function localBeat(page: Page): Promise<void> {
  await page.evaluate(() => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    const self = arena.room.state.players.get(arena.room.sessionId);
    arena.room.send("attack", {
      aimX: 1,
      aimY: 0,
      tx: (self?.x ?? 0) + 300,
      ty: self?.y ?? 0,
    });
  });
}

async function setLocalHeldAttack(page: Page, held: boolean): Promise<void> {
  await page.evaluate((down) => {
    const holder = globalThis;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__animMeasureLocalAttackTimer) {
      window.clearInterval(holder.__animMeasureLocalAttackTimer);
      holder.__animMeasureLocalAttackTimer = undefined;
    }
    if (!down) return;
    const send = () => {
      const self = arena.room.state.players.get(arena.room.sessionId);
      arena.room.send("attack", {
        aimX: 1,
        aimY: 0,
        tx: (self?.x ?? 0) + 300,
        ty: self?.y ?? 0,
      });
    };
    send();
    holder.__animMeasureLocalAttackTimer = window.setInterval(send, 70);
  }, held);
}

async function waitForStepCoverage(
  page: Page,
  actorId: string,
  scenario: string,
  expectedSteps: number,
): Promise<void> {
  await page.waitForFunction(({ id, label, steps }) => {
    const frames = globalThis.__animMeasureFrames ?? [];
    const observed = new Set(
      frames
        .filter((frame) => frame.actorId === id && frame.scenario === label)
        .map((frame) => frame.comboStep)
        .filter((step) => step >= 0),
    );
    return observed.size >= steps && observed.has(steps - 1);
  }, { id: actorId, label: scenario, steps: expectedSteps }, { timeout: 35_000 });
}

async function connectRawPlayer(page: Page): Promise<any> {
  const connection = await page.evaluate(() => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    return { roomId: arena.room.roomId, url: location.href };
  });
  const gamePort = Number(new URL(connection.url).searchParams.get("port"));
  if (!connection.roomId || !Number.isFinite(gamePort) || gamePort <= 0) {
    throw new Error("private room/port missing for raw remote player");
  }
  const { Client } = await import(
    "../../../../packages/client/node_modules/colyseus.js/build/esm/index.mjs"
  );
  const client = new Client(`ws://127.0.0.1:${gamePort}`);
  return await client.joinById(connection.roomId);
}

async function equipRemote(page: Page, room: any, weaponId: string): Promise<void> {
  room.send("devEquip", { weapon: weaponId });
  await expect.poll(
    () => room.state?.players?.get(room.sessionId)?.weapon ?? null,
    { message: `remote authority equip ${weaponId}` },
  ).toBe(weaponId);
  await expect.poll(
    () => page.evaluate(({ id, weapon }) => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      return arena.blobs.get(id)?.weaponDef?.id ?? null;
    }, { id: room.sessionId, weapon: weaponId }),
    { message: `observer render remote ${weaponId}` },
  ).toBe(weaponId);
}

function startRawAttack(room: any): { stop(): void } {
  let seq = Number(room.state?.players?.get(room.sessionId)?.ackSeq ?? 0) >>> 0;
  const target = () => {
    const player = room.state?.players?.get(room.sessionId);
    return {
      aimX: 1,
      aimY: 0,
      tx: (player?.x ?? 0) + 300,
      ty: player?.y ?? 0,
    };
  };
  const sendInput = () => {
    seq = (seq + 1) >>> 0;
    const aim = target();
    room.send("input", {
      seq,
      dx: 0,
      dy: 0,
      jump: false,
      crouchHeld: false,
      pound: false,
      slide: false,
      slideHeld: false,
      fireHeld: false,
      aimX: aim.aimX,
      aimY: aim.aimY,
      targetX: aim.tx,
      targetY: aim.ty,
    });
  };
  const sendAttack = () => room.send("attack", target());
  sendInput();
  sendAttack();
  const inputTimer = setInterval(sendInput, 50);
  const attackTimer = setInterval(sendAttack, 80);
  return {
    stop() {
      clearInterval(inputTimer);
      clearInterval(attackTimer);
    },
  };
}

async function mountProbe(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const holder = globalThis;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    holder.__animMeasureFrames = [];
    holder.__animMeasureFrameIndex = 0;
    holder.__animMeasureScenario = "initial-settle";
    holder.__animMeasureActors = [arena.room.sessionId];

    const copyTransform = (node) => {
      const matrix = node.getWorldTransformMatrix?.();
      const a = Number(matrix?.a ?? node.scaleX ?? 1);
      const b = Number(matrix?.b ?? 0);
      const c = Number(matrix?.c ?? 0);
      const d = Number(matrix?.d ?? node.scaleY ?? 1);
      return {
        x: Number(node.x ?? 0),
        y: Number(node.y ?? 0),
        rotation: Number(node.rotation ?? 0),
        scaleX: Number(node.scaleX ?? 1),
        scaleY: Number(node.scaleY ?? 1),
        worldX: Number(matrix?.tx ?? node.x ?? 0),
        worldY: Number(matrix?.ty ?? node.y ?? 0),
        worldRotation: Math.atan2(b, a),
        worldScaleX: Math.hypot(a, b),
        worldScaleY: Math.hypot(c, d),
        visible: node.visible !== false,
        alpha: Number(node.alpha ?? 1),
        rendered: node.active !== false && node.visible !== false && Number(node.alpha ?? 1) > 0.001,
        type: String(node.type ?? node.constructor?.name ?? "GameObject"),
        texture: String(node.texture?.key ?? ""),
      };
    };

    const hookRig = (rig, actorId) => {
      if (!rig || rig.__animMeasureOriginalAnimate) return;
      rig.__animMeasureOriginalAnimate = rig.animate;
      rig.__animMeasureOwnedCounter = 0;
      rig.animate = function animMeasureAnimate(timeMs, anim) {
        const result = this.__animMeasureOriginalAnimate.call(this, timeMs, anim);
        const actors = holder.__animMeasureActors ?? [];
        if (!actors.includes(actorId)) return result;
        const row = arena.room.state.players.get(actorId);
        if (!row) return result;

        const semantic = new Map();
        const register = (node, name) => {
          if (node) semantic.set(node, name);
        };
        register(this.body, "torso/body");
        register(this.boilerplateHead, "head");
        register(this.shadow, "shadow");
        register(this.shadowHalo, "shadow-halo");
        for (const hand of this.hands ?? []) {
          register(hand.img, hand.front ? "hand-arm:lead" : "hand-arm:off");
        }
        for (const foot of this.feet ?? []) {
          register(foot.img, foot.front ? "foot:lead" : "foot:off");
        }
        register(this.weapons?.[0]?.img, "weapon:lead");
        register(this.weapons?.[1]?.img, "weapon:off");

        const parts = { root: copyTransform(this.root) };
        for (const [node, name] of semantic) parts[name] = copyTransform(node);
        for (const node of this.root.list ?? []) {
          const known = semantic.get(node);
          if (known) continue;
          const rendered = node.active !== false && node.visible !== false && Number(node.alpha ?? 1) > 0.001;
          if (!rendered) continue;
          if (!node.__animMeasureOwnedId) {
            this.__animMeasureOwnedCounter++;
            node.__animMeasureOwnedId = this.__animMeasureOwnedCounter;
          }
          const type = String(node.type ?? node.constructor?.name ?? "GameObject");
          const texture = String(node.texture?.key ?? "shape");
          parts[`owned:${type}:${texture}:${node.__animMeasureOwnedId}`] = copyTransform(node);
        }

        const swing = this.swing;
        const poseMs = Math.max(0, Number(swing?.poseSeconds ?? 0) * 1000);
        const elapsedMs = Number(timeMs - Number(this.swingStart ?? -1e9));
        const attackStage =
          swing && elapsedMs >= -34 && elapsedMs <= poseMs
            ? "attack"
            : this.comboHoldPose
              ? "hold"
              : "rest";
        const hand = swing?.comboChoreography?.hand ?? swing?.hand ?? this.swingHand;
        const swingHand = hand === 1 || hand === "off" ? "off" : hand === "both" ? "both" : "lead";
        const weaponIds = (this.weapons ?? []).map((weapon) => weapon.def?.id ?? "unknown");
        holder.__animMeasureFrameIndex++;
        holder.__animMeasureFrames.push({
          frameIndex: holder.__animMeasureFrameIndex,
          wallMs: performance.now(),
          sceneNow: Number(timeMs),
          scenario: holder.__animMeasureScenario ?? "unlabeled",
          actorId,
          actorType: actorId === arena.room.sessionId ? "local" : "remote",
          weaponIds,
          weaponId: this.weaponDef?.id ?? weaponIds[0] ?? "unarmed",
          dual: (this.weapons?.length ?? 0) > 1,
          attackSeq: Number(row.attackSeq ?? 0) >>> 0,
          rigAttackSeq: Number(this.attackBeatSeq ?? 0) >>> 0,
          swingStart: Number(this.swingStart ?? -1e9),
          swingElapsedMs: elapsedMs,
          poseMs,
          attackStage,
          comboStep: Number(swing?.comboStep ?? this.swingStep ?? -1),
          comboFamily: String(this.comboFamily ?? "none"),
          comboVariant: String(swing?.comboVariant ?? this.swingVariant ?? "default"),
          swingHand,
          comboExpiresAtMs: Number(this.comboExpiresAtMs ?? -1e9),
          hasComboHold: !!this.comboHoldPose,
          hasStageTransition: !!this.comboStageTransition,
          moveStance: Number(row.moveStance ?? anim.moveStance ?? 0),
          height: Number(row.height ?? anim.jumpHeight ?? 0),
          authorityX: Number(row.x ?? 0),
          authorityY: Number(row.y ?? 0),
          parts,
        });
        return result;
      };
    };

    const hookAll = () => {
      for (const [actorId, rig] of arena.blobs) hookRig(rig, actorId);
    };
    hookAll();
    arena.events.on("postupdate", hookAll);
    return arena.room.sessionId;
  });
}

test("measure every live rig part across animation seams", async ({ page }) => {
  test.setTimeout(420_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 960, height: 540 });
    await bootArena(page, baseURL, `weapon:${WEAPON_SPECS[0].id}`);
    await waitForDevWeapon(page, WEAPON_SPECS[0].id);
    await page.locator("#game-root canvas").click({ position: { x: 480, y: 270 } });
    await page.mouse.move(900, 270);
    await page.waitForTimeout(900);
    const localId = await mountProbe(page);
    await page.waitForTimeout(350);

    for (const spec of WEAPON_SPECS) {
      await equipLocal(page, spec.id);
      const scenario = `${spec.id}:local:full`;
      await setScenario(page, scenario, [localId]);
      await page.waitForTimeout(320);
      await setLocalHeldAttack(page, true);
      await waitForStepCoverage(page, localId, scenario, spec.steps);
      await page.waitForTimeout(Math.max(180, spec.cooldown * 350));
      await setLocalHeldAttack(page, false);
      await page.waitForTimeout(Math.max(1_450, spec.cooldown * 1_500));
    }

    await equipLocal(page, "x-sword-neon-katana");
    await setScenario(page, "x-sword-neon-katana:local:drop", [localId]);
    await page.waitForTimeout(300);
    await localBeat(page);
    await page.waitForTimeout(1_900);

    await equipLocal(page, "x-sword-neon-katana");
    await setScenario(page, "x-sword-neon-katana:local:weapon-swap", [localId]);
    await page.waitForTimeout(300);
    await localBeat(page);
    await page.waitForTimeout(180);
    await equipLocal(page, "x2-verdict-longsword");
    await page.waitForTimeout(1_400);

    await equipLocal(page, "x-sword-neon-katana");
    await setScenario(page, "x-sword-neon-katana:local:movement-roll", [localId]);
    await page.waitForTimeout(300);
    await localBeat(page);
    await page.waitForTimeout(90);
    await page.keyboard.down("d");
    await page.keyboard.press("Shift");
    await expect.poll(() => page.evaluate(() => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.moveStance ?? 0;
    }), { message: "roll interrupt should enter a movement stance" }).not.toBe(0);
    await page.waitForTimeout(500);
    await page.keyboard.up("d");
    await page.waitForTimeout(850);

    await setScenario(page, "x-sword-neon-katana:local:movement-jump", [localId]);
    await page.waitForTimeout(250);
    await localBeat(page);
    await page.waitForTimeout(90);
    await page.evaluate(() => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      arena.jumpQueued = true;
      arena.stepNetInput?.(50, false, false, 1, 0);
    });
    await expect.poll(() => page.evaluate(() => {
      const arena = globalThis.ddGame.scene.getScene("arena");
      return arena.room.state.players.get(arena.room.sessionId)?.height ?? 0;
    }), { message: "jump interrupt should leave the ground" }).toBeGreaterThan(0.5);
    await page.waitForTimeout(320);
    await page.waitForTimeout(1_300);

    const remoteRoom = await connectRawPlayer(page);
    try {
      await expect.poll(
        () => page.evaluate((id) => globalThis.ddGame.scene.getScene("arena").blobs.has(id), remoteRoom.sessionId),
        { message: "remote rig should render in the observer room" },
      ).toBe(true);

      for (const spec of WEAPON_SPECS) {
        await equipRemote(page, remoteRoom, spec.id);
        const scenario = `${spec.id}:remote:full`;
        await setScenario(page, scenario, [remoteRoom.sessionId]);
        await page.waitForTimeout(320);
        const control = startRawAttack(remoteRoom);
        try {
          await waitForStepCoverage(page, remoteRoom.sessionId, scenario, spec.steps);
          await page.waitForTimeout(Math.max(180, spec.cooldown * 350));
        } finally {
          control.stop();
        }
        await page.waitForTimeout(Math.max(1_450, spec.cooldown * 1_500));
      }

      await equipLocal(page, "x-sword-neon-katana");
      await equipRemote(page, remoteRoom, "x2-verdict-longsword");
      const coopScenario = "coop:simultaneous:local-katana+remote-melee";
      await setScenario(page, coopScenario, [localId, remoteRoom.sessionId]);
      await page.waitForTimeout(320);
      const rawControl = startRawAttack(remoteRoom);
      await setLocalHeldAttack(page, true);
      try {
        await Promise.all([
          waitForStepCoverage(page, localId, coopScenario, WEAPON_SPECS[0].steps),
          waitForStepCoverage(page, remoteRoom.sessionId, coopScenario, WEAPON_SPECS[1].steps),
        ]);
      } finally {
        await setLocalHeldAttack(page, false);
        rawControl.stop();
      }
      await page.waitForTimeout(1_500);
    } finally {
      await remoteRoom.leave();
    }

    await setLocalHeldAttack(page, false);
    await setScenario(page, "local:post-coverage-rest-tail", [localId]);
    await page.waitForTimeout(20_000);
    const frames = await page.evaluate(() => [...(globalThis.__animMeasureFrames ?? [])]);
    const analysis = analyzeFrames(frames);
    await writeFile(RAW_FILE, `${JSON.stringify({
      capturedAt: new Date().toISOString(),
      weaponSpecs: WEAPON_SPECS,
      thresholds: analysis.method,
      frames,
    })}\n`, "utf8");
    await writeFile(SUMMARY_FILE, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");

    for (const row of analysis.coverage) {
      expect(row.observedSteps, `${row.actorType}/${row.weaponId} must reach its last combo step`).toEqual(
        Array.from({ length: row.expectedSteps }, (_, index) => index),
      );
      expect(row.renderedFrames, `${row.actorType}/${row.weaponId} rendered frames`).toBeGreaterThan(20);
    }
    expect(analysis.transformSampleCount, "per-part transform evidence").toBeGreaterThan(10_000);
  });
});
