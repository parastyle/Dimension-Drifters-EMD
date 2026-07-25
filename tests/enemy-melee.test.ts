import {
  committedMeleeEvaded,
  ENEMY_KINDS,
  ENEMY_MELEE_COMMIT_SECONDS,
  ENEMY_MELEE_COMMIT_TICKS,
  enemyMeleeAccent,
  enemyMeleeCommitCue,
  lockedLungePointAt,
  PlayerAttackMoveMode,
  PLAYER_ATTACK_INPUT_SPEED_MULT,
  playerAttackInputSpeedMultiplier,
  TICK_MS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("B33 commitment melee contract", () => {
  it("ramps on each kind's authored personality clock, then uses one 200 ms impact clock", () => {
    expect(ENEMY_KINDS.ronin?.melee?.windup).not.toBe(
      ENEMY_KINDS["vault-ronin"]?.melee?.windup,
    );
    expect(ENEMY_MELEE_COMMIT_SECONDS).toBe(0.2);
    expect(ENEMY_MELEE_COMMIT_TICKS).toBe(4);
    expect((ENEMY_MELEE_COMMIT_TICKS * TICK_MS) / 1000).toBe(
      ENEMY_MELEE_COMMIT_SECONDS,
    );

    const from = { x: 10, y: 20 };
    const to = { x: 110, y: -20 };
    expect(lockedLungePointAt(from, to, 0.05)).toEqual({ x: 35, y: 10 });
    const threeQuarter = lockedLungePointAt(from, to, 0.15);
    expect(threeQuarter.x).toBeCloseTo(85, 10);
    expect(threeQuarter.y).toBeCloseTo(-10, 10);
    expect(lockedLungePointAt(from, to, 0.2)).toEqual(to);
    expect(lockedLungePointAt(from, to, 2)).toEqual(to);
  });

  it("locks the vector independently from later target movement", () => {
    const from = { x: 0, y: 0 };
    const lockedEndpoint = { x: 80, y: 0 };
    const halfway = lockedLungePointAt(from, lockedEndpoint, 0.1);
    const movedTarget = { x: -400, y: 320 };
    expect(halfway).toEqual({ x: 40, y: 0 });
    expect(lockedLungePointAt(from, lockedEndpoint, 0.2)).not.toEqual(movedTarget);
  });

  it.each([
    ["parry", { parrying: true, rollInvulnerable: false, airborne: false, authoredDisplacementBeyondReach: false }],
    ["roll", { parrying: false, rollInvulnerable: true, airborne: false, authoredDisplacementBeyondReach: false }],
    ["jump", { parrying: false, rollInvulnerable: false, airborne: true, authoredDisplacementBeyondReach: false }],
    ["authored displacement", { parrying: false, rollInvulnerable: false, airborne: false, authoredDisplacementBeyondReach: true }],
  ])("allows %s to evade a commitment", (_label, defense) => {
    expect(committedMeleeEvaded(defense)).toBe(true);
  });

  it("does not accept walking or strafing as an evasion channel", () => {
    expect(
      committedMeleeEvaded({
        parrying: false,
        rollInvulnerable: false,
        airborne: false,
        authoredDisplacementBeyondReach: false,
      }),
    ).toBe(false);
  });

  it("slows active attack input without exposing a weapon-owned replacement mode", () => {
    expect(playerAttackInputSpeedMultiplier(PlayerAttackMoveMode.Normal)).toBe(1);
    expect(playerAttackInputSpeedMultiplier(PlayerAttackMoveMode.InputSlow)).toBe(
      PLAYER_ATTACK_INPUT_SPEED_MULT,
    );
    expect(PLAYER_ATTACK_INPUT_SPEED_MULT).toBe(0.75);
    expect(PlayerAttackMoveMode).not.toHaveProperty("RootMotion");
  });

  it("gives the Wild West wolf a red body accent and selects shipped per-family cues", () => {
    expect(enemyMeleeAccent("critter")).toBe(0xff4438);
    expect(enemyMeleeCommitCue("critter")).toBe("melee:claw");
    expect(enemyMeleeCommitCue("ronin")).toBe("melee:light");
    expect(enemyMeleeCommitCue("shifter-grave-warden")).toBe("melee:arcane");
  });
});
