export const LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS = 250;

export interface LocalAttackPredictionLeadInput {
  predictedSeq: number;
  authoritativeSeq: number;
  predictedAtMs: number;
  nowMs: number;
}

export interface LocalAttackPredictionLeadDecision {
  predictedSeq: number;
  blocked: boolean;
  healed: boolean;
}

/**
 * Preserve one speculative attack while authority catches up, but never let a rejected/lost attack strand
 * the local predictor forever. Sequence comparisons use the same uint32 half-range convention as sync.
 */
export function localAttackPredictionLeadGate(
  input: LocalAttackPredictionLeadInput,
): LocalAttackPredictionLeadDecision {
  const predictedSeq = input.predictedSeq >>> 0;
  const authoritativeSeq = input.authoritativeSeq >>> 0;
  const predictionLead = (predictedSeq - authoritativeSeq) >>> 0;
  if (predictionLead === 0) return { predictedSeq, blocked: false, healed: false };
  if (predictionLead >= 0x80000000) {
    return { predictedSeq: authoritativeSeq, blocked: false, healed: true };
  }

  const elapsedMs =
    Number.isFinite(input.predictedAtMs) && Number.isFinite(input.nowMs)
      ? Math.max(0, input.nowMs - input.predictedAtMs)
      : LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS;
  if (elapsedMs < LOCAL_ATTACK_PREDICTION_LEAD_TIMEOUT_MS) {
    return { predictedSeq, blocked: true, healed: false };
  }
  return { predictedSeq: authoritativeSeq, blocked: false, healed: true };
}

/** The public Drive mirror is floored to hundredths, so prediction must never round it upward. */
export function hasDriveForPredictedAttack(driveValueQ: number, driveCost: number): boolean {
  if (!(driveCost > 0)) return true;
  const drive = Math.floor(Number(driveValueQ) || 0) / 100;
  return drive + 1e-9 >= driveCost;
}
