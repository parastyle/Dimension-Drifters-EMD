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

  it("builds bolts from the shared selection chain, not its own subset", () => {
    // The battle scene originally called two of the arena's branches directly, so authored generated art and
    // caster recipes never appeared and everything degraded to a generic tracer.
    expect(fight).toContain("makeProjectileArt(");
    expect(fight).toContain("this.syncBolts()");
  });

  it("keeps ONE implementation — the arena calls the same function", () => {
    const arena = readFileSync(path.join(here, "../ArenaScene.ts"), "utf8");
    expect(arena).toContain("makeProjectileArt(");
    // A second inline copy is exactly how the two modes drifted apart the first time.
    expect(arena).not.toContain("makeSpit(this, pr)");
  });

  it("derives a projectile kind without a server, so casters are not left generic", () => {
    expect(fight).toContain("defaultProjectileKind(");
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

  it("uses the arena's OWN parry spark and chain rather than a lookalike", () => {
    expect(fight).toContain("spawnParrySpark(");
    expect(fight).toContain("spawnComboPop(");
    expect(fight).toContain("PARRY_CHAIN_WINDOW");
  });

  it("keeps one implementation of the parry spark", () => {
    const arena = readFileSync(path.join(here, "../ArenaScene.ts"), "utf8");
    expect(arena).toContain('from "./arena/parry-vfx.js"');
  });

  it("steps the authored combo chain instead of replaying one swing", () => {
    expect(fight).toContain("swingDescriptorForAttackSeq(");
    expect(fight).toContain("entry.attackSeq++");
  });

  it("gives guns their recoil, not a melee swing", () => {
    expect(fight).toContain("triggerGunRecoil(");
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

describe("facing is locked to the battle line", () => {
  it("passes a hard facing override rather than letting movement decide", () => {
    // Ordinary rig facing follows moveX, so a retreating unit turned its back on the enemy — measured at
    // 8-9% of frames on both vanguards, which are the units that move laterally most.
    const fight = readFileSync(path.join(here, "BattleFight.ts"), "utf8");
    expect(fight).toContain("pose.facingLock = facing;");
  });

  it("keeps the override optional in the rig, so the arena is unaffected", () => {
    const core = readFileSync(path.join(here, "../../entities/rig/rig-core.ts"), "utf8");
    expect(core).toContain("facingLock?: 1 | -1;");
    const pose = readFileSync(path.join(here, "../../entities/rig/rig-pose.ts"), "utf8");
    expect(pose).toContain("if (anim.facingLock !== undefined) {");
  });
});

describe("the camera-space LOD cull", () => {
  it("is turned off for rigs that live under a transformed container", () => {
    // The cull compares root.x/y against cameras.main.worldView. These rigs are laid out on a 3840x2160
    // virtual canvas inside a scaled container, so that comparison judged most of the cast off-screen and
    // skipped their head sync — heads ended up ~4200px from their bodies.
    expect(readFileSync(path.join(here, "BattleFight.ts"), "utf8")).toContain(
      "rig.setViewCulling(false)",
    );
  });

  it("still defaults to on, so the arena keeps its LOD", () => {
    expect(readFileSync(path.join(here, "../../entities/SpriteRig.ts"), "utf8")).toContain(
      "private viewCulling = true;",
    );
    expect(readFileSync(path.join(here, "../../entities/rig/rig-pose.ts"), "utf8")).toContain(
      "this.viewCulling &&",
    );
  });
});

describe("dodge presentation", () => {
  it("reuses the authored roll stance instead of inventing a pose", () => {
    const fight = readFileSync(path.join(here, "BattleFight.ts"), "utf8");
    expect(fight).toContain("STANCE_ROLL");
    expect(fight).toContain("SLIDE_PHASE_GROUND");
    expect(fight).toContain("this.sim.isDodging(unit)");
  });
});

describe("widescreen fill", () => {
  const stage = readFileSync(path.join(here, "BattleStage.ts"), "utf8");

  it("offers cover as well as contain, so a wider-than-16:9 display can fill", () => {
    // The stage art is authored 3840x2160. Contain preserves the whole frame and therefore pillarboxes on
    // anything wider — measured at 320px bars a side on 2560x1080. Cover fills and crops instead.
    expect(stage).toContain("Math.max(width / CANVAS_W, height / CANVAS_H)");
    expect(stage).toContain("setFillMode");
  });

  it("refuses to crop past the band the fight occupies", () => {
    expect(stage).toContain("MIN_VISIBLE_CANVAS_H");
    expect(stage).toContain("Math.min(cover, maxCrop)");
  });

  it("is what the widescreen toggle actually switches", () => {
    expect(readFileSync(path.join(here, "BattleScene.ts"), "utf8")).toContain(
      "this.stage?.setFillMode(on)",
    );
  });
});
