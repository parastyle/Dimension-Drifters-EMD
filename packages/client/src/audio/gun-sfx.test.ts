import { readFileSync } from "node:fs";
import { ACTIVE_WEAPON_CATALOG_IDS, WEAPONS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_GUN_FIRE_FAMILY_BY_ID,
  GUN_FIRE_FAMILY_PROFILES,
  gunFireAudioCue,
  gunFireFamilyFor,
} from "./gun-sfx.js";

interface ManifestRow {
  id: string;
  replaces?: string | null;
  variations?: number;
}

function readAuthorManifest(): ManifestRow[] {
  const root = JSON.parse(
    readFileSync(new URL("../../../../tools/soundkit/sfx-manifest.json", import.meta.url), "utf8"),
  ) as { sounds: ManifestRow[] };
  return root.sounds;
}

function readPublicManifest(): ManifestRow[] {
  const root = JSON.parse(
    readFileSync(new URL("../../public/audio/sfx/manifest.json", import.meta.url), "utf8"),
  ) as { entries: ManifestRow[] };
  return root.entries;
}

const REQUIRED_EVENT_CUES = [
  "weapon:pickup",
  "money:pickup",
  "parry:brace",
  "weapon:swap",
  "weapon:salvage",
  "kungfu:muay-thai",
  "kungfu:wing-chun",
  "kungfu:drunken-fist",
  "kungfu:iron-palm",
  "pound:tuck",
  "pound:drop",
  "death:small",
  "death:medium",
  "death:tough",
  "death:boss",
  "boss:serraketh:dive",
  "boss:serraketh:erupt",
  "boss:serraketh:sever",
  "boss:serraketh:regrow",
  "boss:serraketh:death",
  "ui:confirm",
  "ui:cancel",
] as const;

describe("active gun sound-family census", () => {
  it("resolves every active gun exactly once and leaves no placeholder cue in the map", () => {
    const activeGunIds = ACTIVE_WEAPON_CATALOG_IDS.filter((id) => WEAPONS[id]?.gun).sort();
    const mappedIds = Object.keys(ACTIVE_GUN_FIRE_FAMILY_BY_ID).sort();

    // B63/B66 additions feed this deliberate loss-and-placeholder tripwire.
    expect(activeGunIds).toHaveLength(139);
    expect(mappedIds).toEqual(activeGunIds);
    for (const weaponId of activeGunIds) {
      const family = gunFireFamilyFor(weaponId);
      const cue = gunFireAudioCue(weaponId);
      expect(family, weaponId).toBeDefined();
      if (!family) throw new Error(`Missing gun fire family for ${weaponId}`);
      expect(cue, weaponId).toBe(GUN_FIRE_FAMILY_PROFILES[family].cue);
      expect(cue, weaponId).not.toMatch(/(?:^shot:|placeholder|beep|wacky:)/);
    }
  });

  it("backs every family with two or three installed round-robin variations", () => {
    const authorRows = readAuthorManifest();
    const publicRows = readPublicManifest();
    const usedFamilies = new Set(Object.values(ACTIVE_GUN_FIRE_FAMILY_BY_ID));

    expect(usedFamilies).toEqual(new Set(Object.keys(GUN_FIRE_FAMILY_PROFILES)));
    for (const [family, profile] of Object.entries(GUN_FIRE_FAMILY_PROFILES)) {
      const authored = authorRows.find((row) => row.id === profile.sampleId);
      const installed = publicRows.find((row) => row.id === profile.sampleId);
      expect(authored?.replaces, family).toBe(profile.cue);
      expect(authored?.variations, family).toBeGreaterThanOrEqual(2);
      expect(authored?.variations, family).toBeLessThanOrEqual(3);
      expect(installed, family).toMatchObject({
        id: profile.sampleId,
        replaces: profile.cue,
        variations: authored?.variations,
      });
    }
  });
});

describe("event sample coverage", () => {
  it("publishes one unambiguous installed sample resolution for every new or recovered event", () => {
    const authorRows = readAuthorManifest();
    const publicRows = readPublicManifest();

    for (const cue of REQUIRED_EVENT_CUES) {
      const authored = authorRows.filter((row) => row.replaces === cue);
      const installed = publicRows.filter((row) => row.replaces === cue);
      expect(authored, cue).toHaveLength(1);
      expect(installed, cue).toHaveLength(1);
      expect(installed[0]?.id, cue).toBe(authored[0]?.id);
    }
  });
});
