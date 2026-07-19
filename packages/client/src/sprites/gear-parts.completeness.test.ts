import {
  GEAR_CATALOG,
  GEAR_IDS,
  type GearId,
  LEGACY_PANTS_TO_TORSO,
  STARTER_GEAR_IDS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";
import generatedManifest from "../../../../tools/artkit/out/gear/gear-parts-manifest.json";

// Burn-down list: remove an id as soon as its full-object/current-slot manifest row lands. A stale entry
// fails because `missingArt` is compared exactly, so completed renders cannot hide in the allowlist.
const PENDING_RENDER_ALLOWLIST = [
  "ash-walker-head",
  "ash-walker-shirt",
  "ashen-crusader-head",
  "ashen-crusader-shirt",
  "molten-core-head",
  "molten-core-shirt",
  "coldsnap-head",
  "coldsnap-shirt",
  "graveside-head",
  "graveside-shirt",
  "nine-veils-head",
  "nine-veils-shirt",
  "demon-mask-shirt",
  "thornwatch-head",
  "thornwatch-shirt",
  "thornwatch-boots",
  "neon-mirage-head",
  "neon-mirage-shirt",
  "house-edge-head",
  "house-edge-shirt",
  "unbending-shirt",
  "unbending-boots",
  "pressurized-head",
  "pressurized-shirt",
  "mended-workshirt",
  "reinforced-workshirt",
  "shopkeeps-sunday-best",
  "brass-readers",
  "lucky-readers",
  "loaded-readers",
] as const satisfies readonly GearId[];

const TEMPORARY_RETIRED_MANIFEST_ROWS =
  [] as const satisfies readonly (keyof typeof LEGACY_PANTS_TO_TORSO)[];

interface RawManifestItem {
  id: string;
  slot: string;
  renderRole?: string;
}

describe("gear catalog and art manifest completeness", () => {
  it("covers every nonblank id with current art or the exact pending-render burn-down list", () => {
    const manifestItems = generatedManifest.slots.flatMap(
      (slot) => slot.items as RawManifestItem[],
    );
    const manifestById = new Map(manifestItems.map((item) => [item.id, item]));
    const intentionallyArtless = new Set<GearId>(STARTER_GEAR_IDS);
    const hasCurrentArt = (id: GearId): boolean => {
      const def = GEAR_CATALOG[id];
      const item = manifestById.get(id);
      if (!item) return false;
      if (def.slot === "torso") {
        return item.slot === "torso" && item.renderRole === "replace-torso";
      }
      if (def.slot === "head") return item.slot === "head" && item.renderRole === "replace-head";
      // The two former helmet rows already contain valid hat-cap art; only their role metadata is stale.
      return (
        item.slot === def.slot ||
        ((id === "demon-mask-hat" || id === "unbending-hat") && item.slot === "hat")
      );
    };

    const missingArt = GEAR_IDS.filter((id) => !intentionallyArtless.has(id) && !hasCurrentArt(id));
    expect(missingArt).toEqual(PENDING_RENDER_ALLOWLIST);

    const retiredManifestIds = manifestItems
      .map((item) => item.id)
      .filter((id) => id in LEGACY_PANTS_TO_TORSO);
    expect(retiredManifestIds.sort()).toEqual([...TEMPORARY_RETIRED_MANIFEST_ROWS].sort());
  });
});
