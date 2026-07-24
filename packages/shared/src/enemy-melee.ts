import {
  ENEMY_MELEE_COMMIT_SECONDS,
  PLAYER_ATTACK_INPUT_SPEED_MULT,
} from "./constants.js";

/** Public movement mode mirrored through PlayerState's packed tail. */
export const PlayerAttackMoveMode = {
  Normal: 0,
  InputSlow: 1,
  RootMotion: 2,
} as const;

export type PlayerAttackMoveModeValue =
  (typeof PlayerAttackMoveMode)[keyof typeof PlayerAttackMoveMode];

/** Root motion is a replacement channel; unauthored active frames retain modest steering. */
export function playerAttackInputSpeedMultiplier(mode: number): number {
  if (mode === PlayerAttackMoveMode.RootMotion) return 0;
  if (mode === PlayerAttackMoveMode.InputSlow) return PLAYER_ATTACK_INPUT_SPEED_MULT;
  return 1;
}

export interface LockedLungePoint {
  x: number;
  y: number;
}

/** Linear server-authoritative travel along the vector captured at the white pop. */
export function lockedLungePointAt(
  from: Readonly<LockedLungePoint>,
  to: Readonly<LockedLungePoint>,
  elapsedSeconds: number,
): LockedLungePoint {
  const t = Math.max(0, Math.min(1, elapsedSeconds / ENEMY_MELEE_COMMIT_SECONDS));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export interface CommittedMeleeDefense {
  parrying: boolean;
  rollInvulnerable: boolean;
  airborne: boolean;
  authoredDisplacementBeyondReach: boolean;
}

/** Walking is intentionally absent: only an authoritative player verb can answer a committed lunge. */
export function committedMeleeEvaded(defense: Readonly<CommittedMeleeDefense>): boolean {
  return (
    defense.parrying ||
    defense.rollInvulnerable ||
    defense.airborne ||
    defense.authoredDisplacementBeyondReach
  );
}
