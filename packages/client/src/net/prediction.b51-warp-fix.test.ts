import { readFileSync } from "node:fs";
import {
  BEAM_CHANNEL_MOVE_MUL,
  BELT_Y0,
  beltLevelFor,
  clientServerMotionEpochAdmissible,
  DEPTH_MAX,
  EMPTY_RELIC_STACKS,
  MOVE_SPEED,
  MOVEMENT_CORRECTION_SMOOTH_MAX_MS,
  PLAYER_RADIUS,
  PlayerAttackMoveMode,
  resolveBeltNavigation,
  STANCE_DASH,
  stepPlayerAttackMovement,
  TICK_MS,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import { SelfPredictor, type ServerView } from "./prediction.js";

const DT = TICK_MS / 1000;

function view(extra: Partial<ServerView> = {}): ServerView {
  return {
    x: 1_000,
    y: 1_000,
    mvx: 0,
    mvy: 0,
    vx: 0,
    vy: 0,
    height: 0,
    vh: 0,
    ackSeq: 0,
    teleportSeq: 0,
    moveStance: 0,
    stanceSeq: 0,
    attackMoveMode: PlayerAttackMoveMode.Normal,
    movementCorrectionSeq: 0,
    serverMotionEpoch: 0,
    serverMotionActive: false,
    alive: true,
    ...extra,
  };
}

describe("B51 client prediction parity regressions", () => {
  it("wires B45 gun recoil from the accepted local shot edge into SelfPredictor", () => {
    const arenaSource = readFileSync(new URL("../scenes/ArenaScene.ts", import.meta.url), "utf8");

    expect(/predictor\??\.addPredictedImpulse\s*\(/.test(arenaSource)).toBe(true);
  });

  it("applies ranged-beam recoil on the same predicted tick as authority", () => {
    const weapon = WEAPONS["x2-mirage-coilrifle"];
    expect(weapon?.beam).toBeDefined();
    expect(weapon?.recoil).toBeGreaterThan(0);
    const predictor = new SelfPredictor(view());
    predictor.setServerMovementContext(1, -(weapon?.recoil ?? 0), 0);
    const cmd = {
      ...predictor.mintCmd(0, 0, false, false, false, 1, 0),
      fireHeld: true,
    };

    predictor.tick(cmd);

    expect(predictor.clientMovementReport().vx).toBeCloseTo(-(weapon?.recoil ?? 0) * DT, 9);
  });

  it("uses the server beam-channel movement scalar in the predicted shared step", () => {
    const initial = view({ mvx: MOVE_SPEED });
    const predictor = new SelfPredictor(initial);
    predictor.setServerMovementContext(BEAM_CHANNEL_MOVE_MUL);
    const cmd = predictor.mintCmd(1, 0, false);
    const authority = stepPlayerAttackMovement(
      initial,
      { vx: initial.mvx, vy: initial.mvy },
      cmd,
      DT,
      MOVE_SPEED * BEAM_CHANNEL_MOVE_MUL,
      PlayerAttackMoveMode.Normal,
    );

    predictor.tick(cmd);

    expect(predictor.clientMovementReport().x).toBeCloseTo(authority.x, 9);
    expect(predictor.clientMovementReport().mvx).toBeCloseTo(authority.vx, 9);
  });

  it("launches a server-legal relic air jump instead of waiting for correction", () => {
    const predictor = new SelfPredictor(view({ height: 120, vh: -40 }));
    predictor.setRelics({ ...EMPTY_RELIC_STACKS, jumpCount: 1 });

    predictor.tick(predictor.mintCmd(1, 0, true, false, false, 1, 0));
    const rendered = predictor.renderPos(1, 0, 0);

    expect(rendered.stance).toBe(STANCE_DASH);
    expect(rendered.vh).toBeGreaterThan(0);
  });

  it("passes the server belt depth bounds into the hand-merged movement call", () => {
    const predictionSource = readFileSync(new URL("./prediction.ts", import.meta.url), "utf8");

    expect(/\bBELT_Y0\b/.test(predictionSource)).toBe(true);
    expect(/\bDEPTH_MAX\b/.test(predictionSource)).toBe(true);
  });

  it("keeps local belt prediction behind the current closed room gate", () => {
    const level = beltLevelFor("sky-carrier");
    const firstRoom = level.rooms[0];
    expect(firstRoom).toBeDefined();
    const gateX = firstRoom?.gateX ?? Number.NaN;
    const rightBound = gateX - PLAYER_RADIUS;
    const start = resolveBeltNavigation(
      level,
      rightBound - 1,
      BELT_Y0 + DEPTH_MAX / 2,
      PLAYER_RADIUS,
    );
    const predictor = new SelfPredictor(view(start));
    predictor.setBeltLevel(level);
    predictor.setBeltLockX(gateX);

    predictor.tick(predictor.mintCmd(1, 0, false));

    expect(predictor.clientMovementReport().x).toBeLessThanOrEqual(rightBound);
  });
});

describe("B51 correction policy regressions", () => {
  it("lets a medium correction finish its 140ms band across ordinary state patches", () => {
    const predictor = new SelfPredictor(view());
    predictor.reconcile(view({ x: 1_040, movementCorrectionSeq: 1 }));
    predictor.decayError(0.04);
    expect(predictor.stats.correctionRemainingMs).toBeCloseTo(
      MOVEMENT_CORRECTION_SMOOTH_MAX_MS - 40,
      6,
    );

    predictor.reconcile(view({ x: 1_040, movementCorrectionSeq: 1 }));

    expect(predictor.stats.correctionRemainingMs).toBeCloseTo(
      MOVEMENT_CORRECTION_SMOOTH_MAX_MS - 40,
      6,
    );
    expect(predictor.stats.errPx).toBeGreaterThan(0);
  });

  it("does not re-target or top up correction debt on every active recoil patch", () => {
    const predictor = new SelfPredictor(view());
    predictor.reconcile(view({ x: 1_060, serverMotionEpoch: 1, serverMotionActive: true }));
    predictor.decayError(0.1);
    const debtBeforeNextPatch = predictor.stats.errPx;

    predictor.reconcile(view({ x: 1_080, serverMotionEpoch: 1, serverMotionActive: true }));

    expect(predictor.stats.errPx).toBeLessThanOrEqual(debtBeforeNextPatch);
  });

  it("keeps the B44 gun presentation bound from bypassing the B42 medium band", () => {
    const predictor = new SelfPredictor(view());
    predictor.reconcile(view({ x: 1_060, movementCorrectionSeq: 1 }));
    const banded = predictor.renderPos(0, 0, 0);

    const bounded = predictor.boundLocomotionPresentation(1_060, 1_000, banded.x, banded.y);

    expect(bounded.x).toBe(banded.x);
    expect(bounded.y).toBe(banded.y);
  });
});

describe("B51 motion-epoch round-trip regression", () => {
  it("does not leave post-epoch owner reports stale for a full return trip", () => {
    const predictor = new SelfPredictor(view({ serverMotionEpoch: 7 }));

    // The server opens and closes a fast epoch before its patch completes the trip to this client.
    // The next owner heartbeat is already post-epoch from the server's perspective, but the predictor can
    // only echo the last patch it observed.
    const currentServerEpoch = 8;
    predictor.tick(predictor.mintCmd(1, 0, false));
    const postEpochReport = predictor.clientMovementReport();
    const serverWouldAdopt = clientServerMotionEpochAdmissible(
      postEpochReport.serverMotionEpoch,
      currentServerEpoch,
      false,
    );

    expect(serverWouldAdopt).toBe(true);
    expect(
      clientServerMotionEpochAdmissible(
        postEpochReport.serverMotionEpoch,
        currentServerEpoch,
        true,
      ),
    ).toBe(false);
    expect(
      clientServerMotionEpochAdmissible(
        postEpochReport.serverMotionEpoch,
        currentServerEpoch + 1,
        false,
      ),
    ).toBe(false);
  });
});
