import { readFileSync } from "node:fs";
import { comboStepForChain } from "@dd/shared";
import { describe, expect, it } from "vitest";

const RIG_SOURCE = ["rig-core.ts", "rig-combat.ts", "rig-pose.ts"]
  .map((file) =>
    readFileSync(new URL(`../packages/client/src/entities/rig/${file}`, import.meta.url), "utf8"),
  )
  .join("\n");

describe("rig correctness panel", () => {
  it("indexes a contiguous accepted combo chain instead of the global attack ordinal", () => {
    expect(
      comboStepForChain(
        98,
        1_000,
        "tombstone-greatsword",
        "chop",
        3,
        undefined,
        -Infinity,
        "",
        undefined,
        0,
        -Infinity,
      ),
    ).toBe(0);
    expect(
      comboStepForChain(
        99,
        1_500,
        "tombstone-greatsword",
        "chop",
        3,
        98,
        1_000,
        "tombstone-greatsword",
        "chop",
        0,
        1_700,
      ),
    ).toBe(1);
    expect(
      comboStepForChain(
        100,
        1_650,
        "tombstone-greatsword",
        "chop",
        3,
        99,
        1_500,
        "tombstone-greatsword",
        "chop",
        1,
        1_900,
      ),
    ).toBe(2);
  });

  it("restarts on swap, family change, cadence expiry, missing beats, or clock reversal", () => {
    const step = (seq: number, atMs: number, weaponId: string, family: "arc" | "chop") =>
      comboStepForChain(
        seq,
        atMs,
        weaponId,
        family,
        3,
        40,
        1_000,
        "tombstone-greatsword",
        "chop",
        1,
        1_700,
      );

    expect(step(41, 1_300, "x2-dustreaper-zweihander", "chop")).toBe(0);
    expect(step(41, 1_300, "tombstone-greatsword", "arc")).toBe(0);
    expect(step(41, 1_701, "tombstone-greatsword", "chop")).toBe(0);
    expect(step(42, 1_300, "tombstone-greatsword", "chop")).toBe(0);
    expect(step(41, 999, "tombstone-greatsword", "chop")).toBe(0);
  });

  it("deduplicates a beat and advances deterministically across uint32 wrap", () => {
    expect(
      comboStepForChain(
        0xffffffff,
        1_000,
        "tombstone-greatsword",
        "chop",
        3,
        0xffffffff,
        1_000,
        "tombstone-greatsword",
        "chop",
        2,
        1_700,
      ),
    ).toBe(2);
    expect(
      comboStepForChain(
        0,
        1_400,
        "tombstone-greatsword",
        "chop",
        3,
        0xffffffff,
        1_000,
        "tombstone-greatsword",
        "chop",
        2,
        1_700,
      ),
    ).toBe(0);
  });

  it("samples combo, tome, and source state from the freeze-aware rig clock", () => {
    expect(RIG_SOURCE).toContain(
      "presentationEpochForWallEpoch(this: SpriteRigContext, epochMs: number)",
    );
    expect(RIG_SOURCE).toContain("const sceneNow = timeMs;");
    expect(RIG_SOURCE).toContain("const el = sceneNow - this.swingStart;");
    expect(RIG_SOURCE).toContain("this.prepareTomeVisual(sceneNow, outsidePaperView)");
    expect(RIG_SOURCE).toContain("this.syncTomeVisual(sceneNow, outsidePaperView)");
    expect(RIG_SOURCE).not.toContain("const el = this.scene.time.now - this.swingStart;");
  });

  it("routes an observed accepted beat through authored VFX with owner dedupe and camera LOD", () => {
    expect(RIG_SOURCE).toContain("flushObservedAttackSignature(this: SpriteRigContext,");
    expect(RIG_SOURCE).toContain("if (!this.isSelf && nextSwing");
    expect(RIG_SOURCE).toContain("outsideSignatureView");
    expect(RIG_SOURCE).toContain("scene.spawnSlash?.(");
    expect(RIG_SOURCE).toContain("scene.spawnChain?.(");
    expect(RIG_SOURCE).toContain("readonly observedSignatureAim: { x: number; y: number; }");
    expect(RIG_SOURCE).toContain("syncObservedSourceFlash(this: SpriteRigContext,");
  });
});
