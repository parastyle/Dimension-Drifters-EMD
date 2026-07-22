import {
  comboStepForChain,
  meleeComboSelectionFor,
  swingDescriptorFor,
  swingDescriptorWithComboStep,
  WEAPONS,
  weaponAttackCooldown,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

const ACTIVE_KATANAS = [
  "x-sword-neon-katana",
  "x2-hailwidow-katana",
  "x2-gravechill-nodachi",
  "x2-voltfang-tachi",
  "x2-cinderfang-wakizashi-pair",
  "x2-stormpetal-odachi",
  "drift-katana-stillwater-edict",
  "drift-katana-stormthread",
  "drift-katana-riftstep",
  "drift-nodachi-pale-horizon",
  "drift-nodachi-gatebreaker",
  "drift-greatkatana-moonwake",
  "drift-greatkatana-tempest-regent",
  "drift-colossal-world-seam",
] as const;

describe("GameRoom V7 katana authority contract", () => {
  it.each(ACTIVE_KATANAS)("advances %s only from contiguous accepted sequence state", (id) => {
    const definition = WEAPONS[id];
    if (!definition) throw new Error(`missing active katana ${id}`);
    const selected = meleeComboSelectionFor(definition);
    if (!selected) throw new Error(`missing combo selection ${id}`);
    const intervalMs = weaponAttackCooldown(definition) * 1_000;
    const graceMs = Math.min(300, Math.max(120, weaponAttackCooldown(definition) * 350));
    let previousSeq: number | undefined;
    let previousAt = -1e9;
    let previousStep = 0;
    let expiresAt = -1e9;

    for (let ordinal = 0; ordinal < selected.sequence.length * 2; ordinal++) {
      const seq = ordinal + 1;
      const acceptedAt = ordinal * intervalMs;
      const step = comboStepForChain(
        seq,
        acceptedAt,
        id,
        selected.family,
        selected.sequence.length,
        previousSeq,
        previousAt,
        id,
        previousSeq === undefined ? undefined : selected.family,
        previousStep,
        expiresAt,
      );
      expect(step, `${id} accepted beat ${ordinal}`).toBe(ordinal % selected.sequence.length);
      const base = swingDescriptorFor(definition, weaponAttackCooldown(definition));
      const presented = swingDescriptorWithComboStep(base, definition, step);
      expect(presented.comboChoreography).toEqual(selected.sequence[step]?.choreography);
      expect({
        effectiveCooldown: presented.effectiveCooldown,
        activeStartSeconds: presented.activeStartSeconds,
        activeEndSeconds: presented.activeEndSeconds,
        impactSeconds: presented.impactSeconds,
      }).toEqual({
        effectiveCooldown: base.effectiveCooldown,
        activeStartSeconds: base.activeStartSeconds,
        activeEndSeconds: base.activeEndSeconds,
        impactSeconds: base.impactSeconds,
      });
      previousSeq = seq;
      previousAt = acceptedAt;
      previousStep = step;
      expiresAt = acceptedAt + intervalMs + graceMs;
    }

    expect(
      comboStepForChain(
        (previousSeq ?? 0) + 1,
        expiresAt + 1,
        id,
        selected.family,
        selected.sequence.length,
        previousSeq,
        previousAt,
        id,
        selected.family,
        previousStep,
        expiresAt,
      ),
      `${id} expired chain`,
    ).toBe(0);
  });

  it("keeps choreography presentation-only rather than adding a second authority clock", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("./GameRoom.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain("this.nextSoloMeleeBeat(player, c, weapon, soloCooldown)");
    expect(source).toContain("this.stampAttackBeat(player)");
    expect(source).toContain("this.recordSoloMeleeBeat(");
    expect(source).not.toContain("comboChoreography");
    expect(source).not.toContain("KatanaChoreography");
  });
});
