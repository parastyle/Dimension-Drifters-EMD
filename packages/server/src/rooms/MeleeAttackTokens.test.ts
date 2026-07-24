import { MELEE_ATTACK_TOKEN_CAP } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { MeleeAttackTokens } from "./MeleeAttackTokens.js";

describe("MeleeAttackTokens", () => {
  it("caps simultaneous commits per target and admits the next holder after resolution", () => {
    const tokens = new MeleeAttackTokens();
    for (let i = 0; i < MELEE_ATTACK_TOKEN_CAP; i++)
      expect(tokens.acquire("player-a", `enemy-${i}`)).toBe(true);
    expect(tokens.count("player-a")).toBe(MELEE_ATTACK_TOKEN_CAP);
    expect(tokens.acquire("player-a", "waiting-enemy")).toBe(false);

    expect(tokens.releaseHolder("enemy-1")).toBe(true);
    expect(tokens.acquire("player-a", "waiting-enemy")).toBe(true);
    expect(tokens.count("player-a")).toBe(MELEE_ATTACK_TOKEN_CAP);
  });

  it("releases a dead holder in O(1) and cannot retain a second target", () => {
    const tokens = new MeleeAttackTokens();
    expect(tokens.acquire("player-a", "doomed-enemy")).toBe(true);
    expect(tokens.acquire("player-b", "doomed-enemy")).toBe(false);
    expect(tokens.targetOf("doomed-enemy")).toBe("player-a");

    expect(tokens.releaseHolder("doomed-enemy")).toBe(true);
    expect(tokens.targetOf("doomed-enemy")).toBeUndefined();
    expect(tokens.count("player-a")).toBe(0);
  });

  it("maintains independent budgets per player and clears every holder when a target falls", () => {
    const tokens = new MeleeAttackTokens(2);
    expect(tokens.acquire("player-a", "a-1")).toBe(true);
    expect(tokens.acquire("player-a", "a-2")).toBe(true);
    expect(tokens.acquire("player-a", "a-3")).toBe(false);
    expect(tokens.acquire("player-b", "b-1")).toBe(true);
    expect(tokens.acquire("player-b", "b-2")).toBe(true);
    expect(tokens.count("player-b")).toBe(2);

    expect(tokens.releaseTarget("player-a")).toBe(2);
    expect(tokens.count("player-a")).toBe(0);
    expect(tokens.count("player-b")).toBe(2);
    expect(tokens.acquire("player-b", "a-1")).toBe(false);
    expect(tokens.acquire("player-a", "a-1")).toBe(true);
  });
});
