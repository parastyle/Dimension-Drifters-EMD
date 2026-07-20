import { PROJECTILE_RADIUS, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("owner ledger W-SIZE", () => {
  it("matches every ordered display scalar without coupling Hand Mortar collision", () => {
    expect(WEAPONS["x-gun-hand-mortar"]?.gun?.projectileVisualScale).toBe(1 + 4);
    expect(PROJECTILE_RADIUS).toBe(10);
    expect(WEAPONS["x2-throne-of-ash-coal-scepter"]?.displayLength).toBe(88 * 3);
    expect(WEAPONS["x2-dustdevil-whirlbits"]?.displayLength).toBe(60 * 2);
    expect(WEAPONS["x2-saloon-tomahawk"]?.displayLength).toBe(60 * 2);
  });

  it("sets Gravesinger to the current caster-family median of 90 px", () => {
    const lengths = Object.values(WEAPONS)
      .filter((weapon) => weapon.tags.classPool === "caster")
      .map((weapon) => weapon.displayLength)
      .sort((a, b) => a - b);
    const middle = Math.floor(lengths.length / 2);
    const lower = lengths[middle - 1] ?? Number.NaN;
    const upper = lengths[middle] ?? Number.NaN;
    const median = lengths.length % 2 === 1 ? upper : (lower + upper) / 2;
    expect(lengths).toHaveLength(97);
    expect(median).toBe(90);
    expect(WEAPONS["x2-gravesinger-s-hex-wand"]?.displayLength).toBe(median);
  });
});
