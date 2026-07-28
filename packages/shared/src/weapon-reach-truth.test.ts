import { describe, expect, it } from "vitest";
import { WEAPONS, meleeReach, weaponCollisionLength } from "./weapons.js";

/**
 * REACH TRUTH — the drawn tip must be able to hit.
 *
 * `meleeReach` derives from `collisionLength ?? displayLength`, so an ordinary weapon's hitbox tracks
 * its art automatically and a resize is self-correcting. A weapon that authors an explicit
 * `collisionLength` opts OUT of that, and nothing re-checked those after an art change.
 *
 * That is exactly how the Dervish Greatblade broke. Owner note 2026-07-22 ("sword twice as big")
 * doubled `displayLength` 118 -> 236, `collisionLength: 118` stayed at the pre-resize length, and the
 * full-circle spin kept the old radius: 207.7px of drawn edge against a 150px hitbox, 57.7px of dead
 * tip, shipped and unnoticed until the owner asked whether resizes update hitboxes. Two more carried
 * the same defect (`x2-idol-of-the-pale-verdict`, `x2-squeaky-mallet`).
 *
 * This test is the standing guard. It fails the moment art out-reaches its own hitbox again.
 */

/** Hitboxes may legitimately EXCEED the sprite (fists, thrown blades whose `range` is the real reach). */
const TIP_TOLERANCE_PX = 0.5;

/**
 * Weapons the owner deliberately ordered drawn LARGER than they hit. Intent must be declared here, with
 * its citation, so "the art lies on purpose" can never be confused with "a resize left the hitbox
 * behind" — which is the failure this file exists to catch. Adding an id here is a design decision, not
 * a way to silence the guard.
 */
const PRESENTATION_ONLY_OVERSIZE: ReadonlyMap<string, string> = new Map([
  [
    "twin-bowie-fangs",
    "B28 owner order: double the painted pair without changing its collision/reach authority.",
  ],
]);

describe("melee reach truth", () => {
  const meleeIds = Object.keys(WEAPONS).filter((id) => {
    const weapon = WEAPONS[id];
    return !!weapon && !weapon.gun && !weapon.cast && (weapon.displayLength ?? 0) > 0;
  });

  it("covers a meaningful share of the catalog", () => {
    expect(meleeIds.length).toBeGreaterThan(100);
  });

  it("never draws an edge further than it can hit", () => {
    const offenders: string[] = [];
    for (const id of meleeIds) {
      const weapon = WEAPONS[id];
      if (!weapon || PRESENTATION_ONLY_OVERSIZE.has(id)) continue;
      const drawnTip = (1 - weapon.gripFrac) * weapon.displayLength;
      const reach = meleeReach(weapon, 1);
      if (reach + TIP_TOLERANCE_PX < drawnTip) {
        offenders.push(
          `${id}: drawn tip ${drawnTip.toFixed(1)}px > reach ${reach.toFixed(1)}px ` +
            `(short ${(drawnTip - reach).toFixed(1)}px; displayLength=${weapon.displayLength}, ` +
            `collisionLength=${weapon.collisionLength ?? "derived"}, range=${weapon.range})`,
        );
      }
    }
    expect(offenders, `weapons whose art out-reaches their hitbox:\n${offenders.join("\n")}`).toEqual(
      [],
    );
  });

  it("keeps an explicit collisionLength only where it does not shorten the drawn edge", () => {
    // An override is legitimate when the authored `range` still covers the art (thrown blades, wraps).
    // It is NOT legitimate when it leaves drawn edge unreachable — that is the resize-drift bug above.
    for (const id of meleeIds) {
      const weapon = WEAPONS[id];
      if (!weapon || weapon.collisionLength == null || PRESENTATION_ONLY_OVERSIZE.has(id)) continue;
      const drawnTip = (1 - weapon.gripFrac) * weapon.displayLength;
      expect(
        meleeReach(weapon, 1) + TIP_TOLERANCE_PX,
        `${id} pins collisionLength=${weapon.collisionLength} under its own art. Either derive it ` +
          `(delete the override) or declare the intent in PRESENTATION_ONLY_OVERSIZE with a citation.`,
      ).toBeGreaterThanOrEqual(drawnTip);
    }
  });

  it("keeps every declared oversize exception real, so the list cannot rot", () => {
    for (const [id, reason] of PRESENTATION_ONLY_OVERSIZE) {
      const weapon = WEAPONS[id];
      expect(weapon, `${id} is declared oversize but no longer exists`).toBeDefined();
      if (!weapon) continue;
      expect(reason.length, `${id} needs a real citation`).toBeGreaterThan(20);
      const drawnTip = (1 - weapon.gripFrac) * weapon.displayLength;
      // If the art no longer out-reaches the hitbox, the exception is stale and should be deleted.
      expect(
        meleeReach(weapon, 1) + TIP_TOLERANCE_PX,
        `${id} no longer draws past its hitbox — remove it from PRESENTATION_ONLY_OVERSIZE`,
      ).toBeLessThan(drawnTip);
    }
  });

  it("scales reach with the holder so a bigger rig hits as far as it looks", () => {
    const id = meleeIds.find((candidate) => (WEAPONS[candidate]?.range ?? 0) > 0);
    expect(id).toBeDefined();
    const weapon = WEAPONS[id as string];
    expect(weapon).toBeDefined();
    if (!weapon) return;
    expect(meleeReach(weapon, 1.25)).toBeCloseTo(meleeReach(weapon, 1) * 1.25, 6);
  });

  it("derives collision length from display length when no override is authored", () => {
    const derived = meleeIds
      .map((id) => WEAPONS[id])
      .filter((weapon) => weapon && weapon.collisionLength == null);
    expect(derived.length).toBeGreaterThan(0);
    for (const weapon of derived) {
      if (!weapon) continue;
      expect(weaponCollisionLength(weapon)).toBe(weapon.displayLength);
    }
  });
});
