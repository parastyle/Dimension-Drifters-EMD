import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source contracts for the battle scene's presentation wiring.
 *
 * These pin CALL SITES, not behaviour, because the behaviour lives in Phaser and the failure mode this
 * guards against is a merge that keeps a helper but quietly drops the line that invokes it — which has
 * happened in this repo before (see `tools/sol/GUARDRAILS.md` G7). A unit test of the helper alone would
 * still pass while the feature was dead on screen.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(path.join(here, file), "utf8");

describe("weapon sizing", () => {
  const fight = read("BattleFight.ts");

  it("undoes the rig's fixed-on-screen weapon size so weapons track the character", () => {
    // Without this call the rig divides weapon scale by its own baseScale every frame (§29 / task #20), so
    // scaling characters up for this 3840-wide stage leaves their weapons at 1x — the "weapons are way too
    // small" report. Passing the rig's baseColor back in is the whole fix.
    expect(fight).toContain("rig.setWeaponScaleMul(");
    expect(fight).toContain("RIG_SCALE * wholeArtCharacterVisualScale(unit.spec.spriteId) * WEAPON_BOOST");
  });

  it("keeps the multiplier at the authored ratio by default", () => {
    expect(fight).toMatch(/const WEAPON_BOOST = 1;/);
  });
});

describe("the rig's weapon multiplier stays opt-in", () => {
  const core = readFileSync(path.join(here, "../../entities/rig/rig-core.ts"), "utf8");
  const pose = readFileSync(path.join(here, "../../entities/rig/rig-pose.ts"), "utf8");

  it("defaults to 1 so every existing caller is unaffected", () => {
    expect(readFileSync(path.join(here, "../../entities/SpriteRig.ts"), "utf8")).toContain(
      "private weaponScaleMul = 1;",
    );
    expect(core).toContain("setWeaponScaleMul(this: SpriteRigContext, mult: number): void");
  });

  it("applies to BOTH weapon scale sites, or a two-handed grip misses an up-scaled gun", () => {
    const sites = pose.match(/this\.weaponScaleMul/g) ?? [];
    expect(sites.length).toBe(2);
  });
});

describe("projectiles use real weapon art", () => {
  const fight = read("BattleFight.ts");

  it("builds bolts from the arena's projectile factory rather than drawing circles", () => {
    expect(fight).toContain("makeGunIdentityProjectile(");
    expect(fight).toContain("makeBullet(");
    expect(fight).toContain("this.syncBolts()");
  });

  it("falls back for casters, which carry no gun block", () => {
    expect(fight).toContain("def?.gun");
  });
});

describe("parry presentation", () => {
  const fight = read("BattleFight.ts");

  it("cycles B26's three authored guard poses instead of pinning one", () => {
    expect(fight).toContain("this.nextGuardPose(");
    expect(fight).toContain("PARRY_GUARD_POSES");
    expect(fight).not.toContain("triggerParrySuccess(this.clockMs, 1,");
  });

  it("shows the brace stance while guard is held, not only when a bolt lands", () => {
    expect(fight).toContain("rig.triggerBrace(");
  });
});

describe("camera shake routing", () => {
  it("goes through the scene's audited adapter, never the raw camera", () => {
    const fight = read("BattleFight.ts");
    expect(fight).toContain("host.shakeCam?.(");
    expect(fight).not.toMatch(/cameras\.main\.shake\(/);
  });

  it("budgets the shake inside the adapter", () => {
    expect(read("BattleScene.ts")).toContain("budgetedCameraShakeIntensity(");
  });
});
