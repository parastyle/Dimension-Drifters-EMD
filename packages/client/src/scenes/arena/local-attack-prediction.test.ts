import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { driveCostView } from "../../ui/drive-hud.js";
import {
  hasDriveForPredictedAttack,
  LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS,
  localAttackPredictionLeadGate,
} from "./local-attack-prediction.js";

interface PredictorHarness {
  authoritativeSeq: number;
  predictedSeq: number;
  predictedAtMs: number;
}

function tryPredictAttack(
  state: PredictorHarness,
  driveValueQ: number,
  driveCost: number,
  nowMs: number,
): boolean {
  const gate = localAttackPredictionLeadGate({
    predictedSeq: state.predictedSeq,
    authoritativeSeq: state.authoritativeSeq,
    predictedAtMs: state.predictedAtMs,
    nowMs,
  });
  state.predictedSeq = gate.predictedSeq;
  if (gate.blocked || !hasDriveForPredictedAttack(driveValueQ, driveCost)) return false;
  state.predictedSeq = (state.predictedSeq + 1) >>> 0;
  state.predictedAtMs = nowMs;
  return true;
}

describe("local discrete-attack prediction", () => {
  it.each([
    ["melee", "x-sword-bone"],
    ["caster", "x-staff-arcane-lance"],
  ])("lets a %s weapon fire again after a Drive rejection strands its predicted sequence", (_kind, weaponId) => {
    const cost = driveCostView(weaponId).cost;
    const affordableDriveQ = Math.ceil(cost * 100);
    const state: PredictorHarness = {
      authoritativeSeq: 41,
      predictedSeq: 41,
      predictedAtMs: -1e9,
    };

    expect(cost).toBeGreaterThan(0);
    expect(tryPredictAttack(state, affordableDriveQ, cost, 1_000)).toBe(true);
    expect(state.predictedSeq).toBe(42);

    // The server rejects this attack from its lower authoritative Drive balance: attackSeq stays at 41.
    expect(
      tryPredictAttack(
        state,
        affordableDriveQ,
        cost,
        1_000 + LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS - 1,
      ),
    ).toBe(false);

    // Once the lead is genuinely stale, heal it even if the refreshed public Drive is still empty.
    expect(
      tryPredictAttack(
        state,
        Math.max(0, Math.floor(cost * 100) - 1),
        cost,
        1_000 + LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS,
      ),
    ).toBe(false);
    expect(state.predictedSeq).toBe(41);

    // Drive regenerates; the aligned predictor can send and animate a new attack instead of stalling.
    expect(
      tryPredictAttack(
        state,
        affordableDriveQ,
        cost,
        1_000 + LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS + 1,
      ),
    ).toBe(true);
    expect(state.predictedSeq).toBe(42);
  });

  it("keeps the normal speculative beat blocked inside the acknowledgement window", () => {
    const decision = localAttackPredictionLeadGate({
      predictedSeq: 8,
      authoritativeSeq: 7,
      predictedAtMs: 5_000,
      nowMs: 5_000 + LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS - 1,
    });

    expect(decision).toEqual({ predictedSeq: 8, blocked: true, healed: false });
  });

  it("uses a positive Drive cost for every discrete predictor precheck, including melee and caster", () => {
    const arenaSource = readFileSync(new URL("../ArenaScene.ts", import.meta.url), "utf8");
    const sendAttackStart = arenaSource.indexOf("  private sendAttack(): void {");
    const sendAttackEnd = arenaSource.indexOf("  private predictGunRoundRecoil(", sendAttackStart);
    const sendAttackSource = arenaSource.slice(sendAttackStart, sendAttackEnd);
    const driveCostAt = sendAttackSource.indexOf(
      "const driveCost = weapon ? driveCostView(weapon.id).cost : 0;",
    );
    const genericBillingAt = sendAttackSource.indexOf("driveCost > 0", driveCostAt);
    const predictionAt = sendAttackSource.indexOf(
      "this.localPredictedAttackSeq = (this.localPredictedAttackSeq + 1) >>> 0;",
    );

    expect(sendAttackStart).toBeGreaterThanOrEqual(0);
    expect(sendAttackEnd).toBeGreaterThan(sendAttackStart);
    expect(driveCostAt).toBeGreaterThanOrEqual(0);
    expect(genericBillingAt).toBeGreaterThan(driveCostAt);
    expect(predictionAt).toBeGreaterThan(genericBillingAt);
    expect(sendAttackSource).not.toContain("weapon?.thrown || weapon?.gun || weapon?.warp");
    expect(driveCostView("x-sword-bone").cost).toBeGreaterThan(0);
    expect(driveCostView("x-staff-arcane-lance").cost).toBeGreaterThan(0);
  });
});
