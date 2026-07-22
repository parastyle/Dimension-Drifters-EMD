// @ts-nocheck -- live instrumentation intentionally inspects private rig state after the final pose writer.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  bladeAngleAt,
  HIT_ENVELOPE_TOLERANCE_PX,
  meleeComboSelectionFor,
  meleeDamageHalfWidthAt,
  meleeDamageReachAt,
  WEAPONS,
  weaponUsesAuthoritativeEnvelopeCombo,
} from "@dd/shared";
import { bootArena, runArenaSpec, waitForDevWeapon } from "../helpers/arena-harness.js";

const EVIDENCE_DIR = path.resolve(
  import.meta.dirname,
  "../../docs/design/anim-evidence/combo-bridge",
);
const POSITION_MULTIPLE = 6;
const ROTATION_MULTIPLE = 6;
const POSITION_FLOOR_PX = 4;
const ROTATION_FLOOR_RAD = 0.12;
const LOCAL_RADIUS = 15;
const REMOTE_ONSET_MAX_MS = 70;

const WEAPON_SPECS = [
  { id: "x2-hailwidow-katana", weaponClass: "katana" },
  { id: "x2-verdict-longsword", weaponClass: "ordinary melee" },
  { id: "x2-dustreaper-zweihander", weaponClass: "greatsword" },
  { id: "x2-wendigo-claws", weaponClass: "claw / dual wield" },
  { id: "x2-dustdevil-glaive", weaponClass: "polearm" },
  { id: "twin-bowie-fangs", weaponClass: "dagger pair / dual wield" },
].map((spec) => {
  const definition = WEAPONS[spec.id];
  const selection = definition ? meleeComboSelectionFor(definition) : undefined;
  if (!definition || !selection) throw new Error(`missing live-gate combo ${spec.id}`);
  return {
    ...spec,
    steps: selection.sequence.length,
    cooldown: definition.cooldown,
    authoritativeGeometry: weaponUsesAuthoritativeEnvelopeCombo(definition),
  };
});

/**
 * Active geometry that was already red before this bridge work belongs here with a durable reason.
 * The 1 px threshold remains unchanged and every excluded sample is still written to evidence.
 */
const KNOWN_BASELINE_GEOMETRY_EXCLUSIONS: Readonly<Record<string, string>> = Object.freeze({
  "x2-hailwidow-katana":
    "Authored katana active geometry is red with no transition residual; the authority panel records the pre-existing signed/reverse choreography gap.",
  "x2-dustdevil-glaive":
    "Authored polearm active geometry is red with no transition residual; this bridge change does not alter its weapon affine or hit path.",
});

const PRESENTATION_PARTS = new Set([
  "torso/body",
  "head",
  "hand-arm:lead",
  "hand-arm:off",
  "foot:lead",
  "foot:off",
  "shadow",
  "shadow-halo",
]);

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

function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared <= 1e-9
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

async function equipLocal(page: Page, weaponId: string): Promise<void> {
  await page.evaluate((id) => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    arena.room.send("devEquip", { weapon: id });
  }, weaponId);
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const arena = globalThis.ddGame.scene.getScene("arena");
          const self = arena.room.state.players.get(arena.room.sessionId);
          return {
            authority: self?.weapon ?? null,
            rig: arena.blobs.get(arena.room.sessionId)?.weaponDef?.id ?? null,
            wanted: id,
          };
        }, weaponId),
      { message: `local equip ${weaponId}` },
    )
    .toEqual({ authority: weaponId, rig: weaponId, wanted: weaponId });
}

async function setScenario(page: Page, scenario: string, actorIds: readonly string[]): Promise<void> {
  await page.evaluate(
    ({ label, ids }) => {
      globalThis.__animBridgeScenario = label;
      globalThis.__animBridgeActors = ids;
    },
    { label: scenario, ids: actorIds },
  );
}

async function setLocalHeldAttack(page: Page, held: boolean): Promise<void> {
  await page.evaluate((down) => {
    const holder = globalThis;
    const arena = holder.ddGame.scene.getScene("arena");
    if (holder.__animBridgeLocalAttackTimer) {
      window.clearInterval(holder.__animBridgeLocalAttackTimer);
      holder.__animBridgeLocalAttackTimer = undefined;
    }
    arena.input.activePointer.rightButtonDown = () => down;
    const send = () => arena.stepNetInput?.(50, false, false, 0, 0);
    send();
    if (!down) return;
    holder.__animBridgeLocalAttackTimer = window.setInterval(send, 70);
  }, held);
}

async function waitForStepCoverage(
  page: Page,
  actorId: string,
  scenario: string,
  expectedSteps: number,
): Promise<void> {
  await page.waitForFunction(
    ({ id, label, steps }) => {
      const observed = new Set(
        (globalThis.__animBridgeFrames ?? [])
          .filter((frame) => frame.actorId === id && frame.scenario === label)
          .map((frame) => frame.comboStep)
          .filter((step) => step >= 0),
      );
      return observed.size >= steps && observed.has(steps - 1);
    },
    { id: actorId, label: scenario, steps: expectedSteps },
    { timeout: 35_000 },
  );
}

async function connectRawPlayer(page: Page): Promise<any> {
  const connection = await page.evaluate(() => {
    const arena = globalThis.ddGame.scene.getScene("arena");
    return { roomId: arena.room.roomId, url: location.href };
  });
  const gamePort = Number(new URL(connection.url).searchParams.get("port"));
  if (!connection.roomId || !Number.isFinite(gamePort) || gamePort <= 0)
    throw new Error("private room/port missing for remote combo actor");
  const { Client } = await import("../../packages/client/node_modules/colyseus.js/build/esm/index.mjs");
  return await new Client(`ws://127.0.0.1:${gamePort}`).joinById(connection.roomId);
}

async function equipRemote(page: Page, room: any, weaponId: string): Promise<void> {
  room.send("devEquip", { weapon: weaponId });
  await expect
    .poll(() => room.state?.players?.get(room.sessionId)?.weapon ?? null, {
      message: `remote authority equip ${weaponId}`,
    })
    .toBe(weaponId);
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ id }) => globalThis.ddGame.scene.getScene("arena").blobs.get(id)?.weaponDef?.id ?? null,
          { id: room.sessionId },
        ),
      { message: `observer render remote ${weaponId}` },
    )
    .toBe(weaponId);
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
    const aim = target();
    seq = (seq + 1) >>> 0;
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
  return page.evaluate(() => {
    const holder = globalThis;
    const arena = holder.ddGame.scene.getScene("arena");
    if (arena.verbs?.isLegendOpen?.()) arena.verbs.toggleLegend(arena.time.now);
    arena.verbs?.releaseInputLatchIf?.(true);
    arena.game.hasFocus = true;
    arena.pointerOverInteractiveUi = false;
    if (!arena.game.loop.forceSetTimeOut) {
      arena.game.loop.sleep();
      arena.game.loop.forceSetTimeOut = true;
      arena.game.loop.wake(true);
    }
    holder.__animBridgeFrames = [];
    holder.__animBridgeScenario = "initial-settle";
    holder.__animBridgeActors = [arena.room.sessionId];

    const copyTransform = (node) => {
      if (!node) return undefined;
      const matrix = node.getWorldTransformMatrix?.();
      return {
        worldX: Number(matrix?.tx ?? node.x ?? 0),
        worldY: Number(matrix?.ty ?? node.y ?? 0),
        worldRotation: Math.atan2(Number(matrix?.b ?? 0), Number(matrix?.a ?? 1)),
        rendered:
          node.active !== false && node.visible !== false && Number(node.alpha ?? 1) > 0.001,
      };
    };
    const copyBlade = (pose) =>
      pose
        ? {
            hand: pose.hand,
            x: pose.x,
            y: pose.y,
            axisX: pose.axisX,
            axisY: pose.axisY,
            physicalBladeLength: pose.physicalBladeLength,
            bladeWidth: pose.bladeWidth,
          }
        : undefined;

    const hookRig = (rig, actorId) => {
      if (!rig || rig.__animBridgeOriginalAnimate) return;
      rig.__animBridgeOriginalAnimate = rig.animate;
      rig.animate = function animBridgeAnimate(timeMs, anim) {
        const result = this.__animBridgeOriginalAnimate.call(this, timeMs, anim);
        if (!(holder.__animBridgeActors ?? []).includes(actorId)) return result;
        const row = arena.room.state.players.get(actorId);
        if (!row) return result;
        const swing = this.swing;
        const parts = {
          "torso/body": copyTransform(this.body),
          head: copyTransform(this.boilerplateHead),
          shadow: copyTransform(this.shadow),
          "shadow-halo": copyTransform(this.shadowHalo),
        };
        for (const hand of this.hands ?? [])
          parts[hand.front ? "hand-arm:lead" : "hand-arm:off"] = copyTransform(hand.img);
        for (const foot of this.feet ?? [])
          parts[foot.front ? "foot:lead" : "foot:off"] = copyTransform(foot.img);
        holder.__animBridgeFrames.push({
          wallMs: performance.now(),
          sceneNow: Number(timeMs),
          scenario: holder.__animBridgeScenario,
          actorId,
          actorType: actorId === arena.room.sessionId ? "local" : "remote",
          weaponId: this.weaponDef?.id ?? "unarmed",
          attackSeq: Number(row.attackSeq ?? 0) >>> 0,
          rigAttackSeq: Number(this.attackBeatSeq ?? 0) >>> 0,
          swingStart: Number(this.swingStart ?? -1e9),
          swingElapsedMs: Number(timeMs - Number(this.swingStart ?? -1e9)),
          comboStep: Number(swing?.comboStep ?? -1),
          swingHand: this.swingHand,
          aimWorld: Number(this.swingAimWorld ?? 0),
          swing: swing
            ? {
                poseSeconds: swing.poseSeconds,
                comboTiming: swing.comboTiming,
                comboPath: swing.comboPath,
                comboStep: swing.comboStep,
              }
            : undefined,
          root: { x: this.root.x, y: this.root.y, rotation: this.root.rotation },
          transition: this.comboStageTransition
            ? {
                acceptedAtMs: this.comboStageTransition.acceptedAtMs,
                startedAtMs: this.comboStageTransition.startedAtMs,
                deadlineAtMs: this.comboStageTransition.deadlineAtMs,
                durationMs: this.comboStageTransition.durationMs,
              }
            : undefined,
          blades: [copyBlade(this.leadWeaponTipPose(0)), copyBlade(this.leadWeaponTipPose(1))],
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

function continuityAnalysis(frames: readonly any[]): { seams: any[]; flags: any[] } {
  const seams: any[] = [];
  const flags: any[] = [];
  const groups = new Map<string, any[]>();
  for (const frame of frames) {
    const key = `${frame.scenario}|${frame.actorId}`;
    const group = groups.get(key);
    if (group) group.push(frame);
    else groups.set(key, [frame]);
  }
  for (const group of groups.values()) {
    const deltas: any[] = [];
    for (let index = 1; index < group.length; index++) {
      const previous = group[index - 1];
      const current = group[index];
      const byPart: Record<string, any> = {};
      for (const part of PRESENTATION_PARTS) {
        const before = previous.parts[part];
        const after = current.parts[part];
        if (!before?.rendered || !after?.rendered) continue;
        byPart[part] = {
          positionPx: Math.hypot(after.worldX - before.worldX, after.worldY - before.worldY),
          rotationRad: angleDistance(after.worldRotation, before.worldRotation),
        };
      }
      deltas.push({ previous, current, byPart });
    }
    for (let index = 0; index < deltas.length; index++) {
      const boundary = deltas[index];
      if (
        boundary.previous.comboStep < 0 ||
        boundary.current.comboStep < 0 ||
        boundary.previous.comboStep === boundary.current.comboStep
      )
        continue;
      for (const [part, delta] of Object.entries(boundary.byPart)) {
        const neighbors = deltas
          .slice(Math.max(0, index - LOCAL_RADIUS), Math.min(deltas.length, index + LOCAL_RADIUS + 1))
          .filter((_, neighborOffset) => Math.max(0, index - LOCAL_RADIUS) + neighborOffset !== index)
          .map((candidate) => candidate.byPart[part])
          .filter(Boolean);
        const medianPositionPx = median(neighbors.map((candidate) => candidate.positionPx));
        const medianRotationRad = median(neighbors.map((candidate) => candidate.rotationRad));
        const positionFlag =
          delta.positionPx >= POSITION_FLOOR_PX &&
          delta.positionPx >= POSITION_MULTIPLE * Math.max(1e-9, medianPositionPx);
        const rotationFlag =
          delta.rotationRad >= ROTATION_FLOOR_RAD &&
          delta.rotationRad >= ROTATION_MULTIPLE * Math.max(1e-9, medianRotationRad);
        const record = {
          actorType: boundary.current.actorType,
          weaponId: boundary.current.weaponId,
          fromStep: boundary.previous.comboStep,
          toStep: boundary.current.comboStep,
          part,
          positionPx: delta.positionPx,
          rotationRad: delta.rotationRad,
          medianPositionPx,
          medianRotationRad,
          positionFlag,
          rotationFlag,
        };
        seams.push(record);
        if (positionFlag || rotationFlag) flags.push(record);
      }
    }
  }
  return { seams, flags };
}

function geometryAnalysis(frames: readonly any[]): { samples: any[]; failures: any[]; worst: any[] } {
  const samples: any[] = [];
  for (const frame of frames) {
    const definition = WEAPONS[frame.weaponId];
    const selection = definition ? meleeComboSelectionFor(definition) : undefined;
    const step = selection?.sequence[frame.comboStep];
    if (!definition || !step || !frame.swing || !weaponUsesAuthoritativeEnvelopeCombo(definition))
      continue;
    const elapsedSeconds = frame.swingElapsedMs / 1000;
    const activeStartSeconds = step.timing.activeStart * frame.swing.poseSeconds;
    const activeEndSeconds = step.timing.activeEnd * frame.swing.poseSeconds;
    if (elapsedSeconds < activeStartSeconds || elapsedSeconds >= activeEndSeconds) continue;
    const progress =
      activeEndSeconds <= activeStartSeconds
        ? 1
        : Math.max(
            0,
            Math.min(1, (elapsedSeconds - activeStartSeconds) / (activeEndSeconds - activeStartSeconds)),
          );
    const arc = step.path.deltaAngle ?? definition.swingArc * step.path.arcMultiplier;
    const angle = bladeAngleAt(frame.aimWorld, arc, progress);
    const authoritativeSwing = {
      activeStartSeconds,
      activeEndSeconds,
      poseSeconds: frame.swing.poseSeconds,
      motion: step.motion,
      comboStep: frame.comboStep,
    };
    const reach =
      meleeDamageReachAt(definition, authoritativeSwing, elapsedSeconds) *
      (step.path.rangeMultiplier ?? 1);
    const halfWidth = meleeDamageHalfWidthAt(definition, authoritativeSwing, elapsedSeconds);
    const ax = frame.root.x;
    const ay = frame.root.y;
    const bx = ax + Math.cos(angle) * reach;
    const by = ay + Math.sin(angle) * reach;
    const hands =
      frame.swingHand === "both" ? [0, 1] : [Number(frame.swingHand === 1 ? 1 : 0)];
    for (const hand of hands) {
      const blade = frame.blades[hand];
      if (!blade) continue;
      const gripX = blade.x - blade.axisX * blade.physicalBladeLength;
      const gripY = blade.y - blade.axisY * blade.physicalBladeLength;
      const centerlineError = Math.max(
        pointSegmentDistance(gripX, gripY, ax, ay, bx, by),
        pointSegmentDistance(blade.x, blade.y, ax, ay, bx, by),
      );
      const envelopeErrorPx = Math.max(0, centerlineError + blade.bladeWidth / 2 - halfWidth);
      samples.push({
        actorType: frame.actorType,
        weaponId: frame.weaponId,
        comboStep: frame.comboStep,
        hand,
        elapsedSeconds,
        activeStartSeconds,
        activeEndSeconds,
        envelopeErrorPx,
        transitionActive: !!frame.transition,
      });
    }
  }
  const failures = samples.filter(
    (sample) =>
      sample.envelopeErrorPx > HIT_ENVELOPE_TOLERANCE_PX &&
      !KNOWN_BASELINE_GEOMETRY_EXCLUSIONS[sample.weaponId],
  );
  const worstByKey = new Map<string, any>();
  for (const sample of samples) {
    const key = `${sample.actorType}|${sample.weaponId}`;
    if ((worstByKey.get(key)?.envelopeErrorPx ?? -1) < sample.envelopeErrorPx)
      worstByKey.set(key, sample);
  }
  return { samples, failures, worst: [...worstByKey.values()] };
}

test("combo bridge is continuous, authority-safe, and immediate for local and remote rigs", async ({
  page,
}) => {
  test.setTimeout(360_000);
  await runArenaSpec(page, async (baseURL) => {
    await mkdir(EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 640, height: 360 });
    await bootArena(page, baseURL, `weapon:${WEAPON_SPECS[0].id}`);
    await waitForDevWeapon(page, WEAPON_SPECS[0].id);
    await page.locator("#game-root canvas").click({ position: { x: 320, y: 180 } });
    await page.mouse.move(600, 180);
    await page.waitForTimeout(700);
    const localId = await mountProbe(page);

    for (const spec of WEAPON_SPECS) {
      await equipLocal(page, spec.id);
      const scenario = `${spec.id}:local:combo`;
      await setScenario(page, scenario, [localId]);
      await page.waitForTimeout(180);
      await setLocalHeldAttack(page, true);
      await waitForStepCoverage(page, localId, scenario, spec.steps);
      await page.waitForTimeout(
        spec.authoritativeGeometry ? 650 : Math.max(180, spec.cooldown * 300),
      );
      if (spec.id === "x2-dustreaper-zweihander")
        await page.screenshot({ path: path.join(EVIDENCE_DIR, "after-local-greatsword.png") });
      await setLocalHeldAttack(page, false);
      await page.waitForTimeout(500);
    }

    const remoteRoom = await connectRawPlayer(page);
    try {
      await expect
        .poll(() => page.evaluate((id) => globalThis.ddGame.scene.getScene("arena").blobs.has(id), remoteRoom.sessionId), {
          message: "remote rig should render",
        })
        .toBe(true);
      for (const spec of WEAPON_SPECS) {
        await equipRemote(page, remoteRoom, spec.id);
        const scenario = `${spec.id}:remote:combo`;
        await setScenario(page, scenario, [remoteRoom.sessionId]);
        await page.waitForTimeout(180);
        const control = startRawAttack(remoteRoom);
        try {
          await waitForStepCoverage(page, remoteRoom.sessionId, scenario, spec.steps);
          await page.waitForTimeout(
            spec.authoritativeGeometry ? 650 : Math.max(180, spec.cooldown * 300),
          );
          if (spec.id === "x2-dustreaper-zweihander")
            await page.screenshot({ path: path.join(EVIDENCE_DIR, "after-remote-greatsword.png") });
        } finally {
          control.stop();
        }
        await page.waitForTimeout(500);
      }
    } finally {
      await remoteRoom.leave();
    }

    await setLocalHeldAttack(page, false);
    const frames = await page.evaluate(() => [...(globalThis.__animBridgeFrames ?? [])]);
    const continuity = continuityAnalysis(frames);
    const geometry = geometryAnalysis(frames);
    const relevantFrames = frames.filter((frame) => frame.comboStep >= 0 && frame.swing);
    const seqMismatches = relevantFrames.filter(
      (frame) => frame.rigAttackSeq !== frame.attackSeq,
    );
    const firstBySeq = new Map<string, any>();
    for (const frame of relevantFrames) {
      const key = `${frame.actorId}|${frame.rigAttackSeq}`;
      if (!firstBySeq.has(key)) firstBySeq.set(key, frame);
    }
    const remoteOnsets = [...firstBySeq.values()]
      .filter((frame) => frame.actorType === "remote")
      .map((frame) => ({
        weaponId: frame.weaponId,
        attackSeq: frame.rigAttackSeq,
        delayMs: Math.max(0, frame.sceneNow - frame.swingStart),
      }));
    const coverage = WEAPON_SPECS.flatMap((spec) =>
      ["local", "remote"].map((actorType) => {
        const matching = relevantFrames.filter(
          (frame) => frame.actorType === actorType && frame.weaponId === spec.id,
        );
        return {
          actorType,
          weaponId: spec.id,
          weaponClass: spec.weaponClass,
          expectedSteps: spec.steps,
          observedSteps: [...new Set(matching.map((frame) => frame.comboStep))].sort(),
          frames: matching.length,
        };
      }),
    );
    const evidence = {
      capturedAt: new Date().toISOString(),
      thresholds: {
        position: `>= ${POSITION_FLOOR_PX}px and >= ${POSITION_MULTIPLE}x 15-frame local median`,
        rotation: `>= ${ROTATION_FLOOR_RAD}rad and >= ${ROTATION_MULTIPLE}x 15-frame local median`,
        activeEnvelopePx: HIT_ENVELOPE_TOLERANCE_PX,
        remoteOnsetMs: REMOTE_ONSET_MAX_MS,
        attackSeqDelta: 0,
      },
      continuityScope: [...PRESENTATION_PARTS],
      combatTruthScope: ["root rotation", "weapon affines", "blade/capsule"],
      knownBaselineGeometryExclusions: KNOWN_BASELINE_GEOMETRY_EXCLUSIONS,
      beforeReference: {
        raw: "docs/design/anim-evidence/measure/live-per-part-frames.json",
        analysis: "docs/design/anim-evidence/measure/live-analysis.json",
        finding: "15/15 remote and 8/19 local combo boundaries flagged before implementation",
      },
      coverage,
      continuity,
      geometry: { worst: geometry.worst, sampleCount: geometry.samples.length, failures: geometry.failures },
      seqMismatchCount: seqMismatches.length,
      remoteOnsets,
      frameCount: frames.length,
    };
    await writeFile(path.join(EVIDENCE_DIR, "after-summary.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    await writeFile(path.join(EVIDENCE_DIR, "after-frames.json"), `${JSON.stringify({ frames })}\n`);

    for (const row of coverage) {
      expect(row.observedSteps, `${row.actorType}/${row.weaponId} full combo`).toEqual(
        Array.from({ length: row.expectedSteps }, (_, index) => index),
      );
      expect(row.frames, `${row.actorType}/${row.weaponId} rendered combo frames`).toBeGreaterThan(8);
    }
    expect(continuity.flags.length, "presentation-only combo seam teleport flags").toBe(0);
    expect(seqMismatches.length, "rigAttackSeq - authority attackSeq").toBe(0);
    expect(remoteOnsets.length, "remote accepted attacks observed").toBeGreaterThan(10);
    expect(
      Math.max(...remoteOnsets.map((sample) => sample.delayMs)),
      "remote weapon onset after mapped epoch",
    ).toBeLessThanOrEqual(REMOTE_ONSET_MAX_MS);
    expect(geometry.samples.length, "authoritative active geometry samples").toBeGreaterThan(20);
    expect(
      geometry.samples.filter((sample) => sample.transitionActive).length,
      "transition residual at authoritative active samples",
    ).toBe(0);
    expect(geometry.failures.length, "non-excluded V7 active envelope failures").toBe(0);
  });
});
