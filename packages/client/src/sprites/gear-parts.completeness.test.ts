import { GEAR_CATALOG, GEAR_IDS, type GearId, STARTER_GEAR_IDS } from "@dd/shared";
import { describe, expect, it } from "vitest";
import { GEAR_PARTS_MANIFEST } from "./gear-parts.js";

// TEMP(v0.118 follow-up render fleet): remove each ID when its Trading Post starter art lands.
const TEMPORARY_MISSING_GEAR_ART = [
  "mended-workshirt",
  "reinforced-workshirt",
  "shopkeeps-sunday-best",
  "brass-readers",
  "lucky-readers",
  "loaded-readers",
  "work-gloves",
  "knuckled-gloves",
  "ironhand-gloves",
] as const satisfies readonly GearId[];

describe("gear catalog and art manifest completeness", () => {
  it("keeps every wearable catalog id and every manifest id in one shared id space", () => {
    if (!GEAR_PARTS_MANIFEST) throw new Error("gear parts manifest failed validation");

    const catalogIds = new Set<string>(GEAR_IDS);
    const intentionallyArtless = new Set<GearId>(STARTER_GEAR_IDS);
    const manifestItems = GEAR_PARTS_MANIFEST.slots.flatMap((slot) => slot.items);
    const manifestIds = manifestItems.map((item) => item.id);
    const manifestIdSet = new Set(manifestIds);

    expect(manifestIds).toHaveLength(manifestIdSet.size);
    expect(manifestIds.filter((id) => !catalogIds.has(id))).toEqual([]);
    expect(manifestIds.filter((id) => intentionallyArtless.has(id as GearId))).toEqual([]);

    const missingWearableArt = GEAR_IDS.filter(
      (id) => !intentionallyArtless.has(id) && !manifestIdSet.has(id),
    );
    expect(missingWearableArt).toEqual(TEMPORARY_MISSING_GEAR_ART);

    for (const item of manifestItems) {
      expect(item.slot).toBe(GEAR_CATALOG[item.id as GearId].slot);
    }
  });
});
