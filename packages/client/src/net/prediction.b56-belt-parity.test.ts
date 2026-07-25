import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const arenaSource = readFileSync(new URL("../scenes/ArenaScene.ts", import.meta.url), "utf8");
const menuSource = readFileSync(new URL("../scenes/MenuScene.ts", import.meta.url), "utf8");

describe("B56 belt-mode permanent regressions", () => {
  it("never feeds the projected Phaser root back into SELF prediction presentation", () => {
    expect(arenaSource).toContain("private selfPresentedWorldX = Number.NaN");
    expect(arenaSource).toContain("private selfPresentedWorldY = Number.NaN");
    expect(arenaSource).toMatch(
      /constrainRenderStep\(\s*previousWorldX,\s*previousWorldY,\s*candidate\.x,\s*candidate\.y,/,
    );
    expect(arenaSource).not.toMatch(/constrainRenderStep\(\s*blob\.x,\s*blob\.y,/);
  });

  it("folds hit-stop error in retained world space instead of projected belt space", () => {
    expect(arenaSource).toMatch(/predictor\.foldError\(worldX\s*-\s*r\.x,\s*worldY\s*-\s*r\.y\)/);
    expect(arenaSource).not.toMatch(
      /predictor\.foldError\(selfRig\.x\s*-\s*r\.x,\s*selfRig\.y\s*-\s*r\.y\)/,
    );
  });

  it("projects belt chest art and pickup/chest prompts onto the same render plane", () => {
    expect(arenaSource).toContain("this.chests.forEach((c) =>");
    expect(arenaSource).toContain("y: this.belt ? this.beltY(pk.y) : pk.y");
    expect(arenaSource).toContain("y: this.belt ? this.beltY(chest.y) : chest.y");
  });

  it("keeps URL belt boot independent of a camera fade completion event", () => {
    const launchBelt = menuSource.slice(
      menuSource.indexOf("private launchBelt("),
      menuSource.indexOf("private buildBossRushCard("),
    );
    expect(launchBelt).toContain(
      "this.launch(beltLevelFor(levelId).dimensionId, false, true, levelId, true)",
    );

    const launch = menuSource.slice(
      menuSource.indexOf("private launch(\n"),
      menuSource.indexOf("private screenW("),
    );
    expect(launch.indexOf("if (direct)")).toBeGreaterThanOrEqual(0);
    expect(launch.indexOf("if (direct)")).toBeLessThan(launch.indexOf("fadeOut(280"));
    expect(launch).toContain("void ready.then(startArena)");
  });
});
