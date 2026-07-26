import {
  ACTIVE_WEAPON_CATALOG_IDS,
  COMMON_RELIC_DEFS,
  derivedWeaponBehaviourLine,
  RARE_RELIC_DEFS,
  relicDescriptionFor,
  WEAPONS,
  weaponBehaviourLine,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing weapon fixture: ${id}`);
  return definition;
}

describe("B62 player-facing weapon behavior", () => {
  it("resolves a non-empty behavior line for every catalog weapon", () => {
    const missing = Object.values(WEAPONS)
      .filter((weapon) => weaponBehaviourLine(weapon).trim().length === 0)
      .map((weapon) => weapon.id);

    expect(missing).toEqual([]);
    expect(ACTIVE_WEAPON_CATALOG_IDS).toHaveLength(338);
  });

  it("always prefers an authored description over derived combat copy", () => {
    const authored = Object.values(WEAPONS).find((weapon) => weapon.description?.trim());
    if (!authored?.description) throw new Error("Expected an authored weapon description");
    expect(weaponBehaviourLine(authored)).toBe(authored.description.trim());
    expect(derivedWeaponBehaviourLine(authored)).not.toBe(authored.description.trim());
  });

  it("derives concrete delivery behavior from the authoritative blocks", () => {
    expect(weaponBehaviourLine(weapon("x-gun-coffin-shotgun"))).toBe(
      "Fires 7 pellets in a cone per trigger pull; reloads after 2 trigger pulls in 1.6 seconds.",
    );
    expect(weaponBehaviourLine(weapon("x-sword-neon-katana"))).toBe(
      "Strikes within 138 px, then lightning jumps to 3 more enemies within 240 px.",
    );
    expect(weaponBehaviourLine(weapon("gravediggers-spade"))).toBe(
      "Revives a downed ally caught within 96 px of the swing.",
    );
  });
});

describe("B62 player-facing relic behavior", () => {
  it("resolves a non-empty description for every relic definition", () => {
    const definitions = [...COMMON_RELIC_DEFS, ...RARE_RELIC_DEFS];
    expect(definitions).toHaveLength(15);
    expect(definitions.map((definition) => definition.id)).toHaveLength(
      new Set(definitions.map((definition) => definition.id)).size,
    );
    for (const definition of definitions) {
      expect(definition.desc.trim(), definition.id).not.toBe("");
      expect(relicDescriptionFor(definition.id), definition.id).toBe(definition.desc);
    }
  });
});
