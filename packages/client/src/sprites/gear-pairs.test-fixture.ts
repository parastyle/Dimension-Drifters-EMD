import { GEAR_CATALOG, GEAR_IDS, GEAR_SLOTS, type GearSlot } from "@dd/shared";
import generatedManifest from "../../../../tools/artkit/out/gear/gear-parts-manifest.json";
import {
  GEAR_REPLACEMENT_CONTRACT_ID,
  type GearManifestItem,
  type GearManifestSlot,
  type GearPartsManifest,
  type GearRenderRole,
  validateGearPartsManifest,
} from "./gear-parts.js";

const ROLE_BY_SLOT = {
  hat: "overlay-hat",
  glasses: "head-accessory",
  facialHair: "head-accessory",
  head: "replace-head",
  torso: "replace-torso",
  gloves: "replace-hand",
  boots: "replace-foot",
  cloak: "cloak-far",
} as const satisfies Readonly<Record<GearSlot, GearRenderRole>>;

/** Test-only adapter for the checked-in pre-pairs manifest while the parallel render fleet is in flight. */
export function replacementPairManifestInput(revision = "pairs-test-r1"): unknown {
  const candidate = structuredClone(generatedManifest) as unknown as GearPartsManifest;
  candidate.schemaVersion = 2;
  candidate.replacementContract = {
    id: GEAR_REPLACEMENT_CONTRACT_ID,
    revision,
    partFrames: {
      body: [344, 324, 336, 376],
      head: [352, 112, 384, 456],
      "hand-l": [294, 432, 180, 180],
      "hand-r": [550, 432, 180, 180],
      "foot-l": [353, 641, 190, 190],
      "foot-r": [481, 641, 190, 190],
    },
    compositionOrders: {
      body: ["torso"],
      head: ["head", "facialHair", "glasses"],
    },
  };

  const oldSlots = new Map(candidate.slots.map((slot) => [slot.id as string, slot]));
  const oldShirt = oldSlots.get("shirt");
  const currentTorso = oldSlots.get("torso");
  const currentHead = oldSlots.get("head");
  const hats = oldSlots.get("hat");
  const bodyTemplate = candidate.boilerplate.parts.find((part) => part.id === "body");
  const headPartTemplate = candidate.boilerplate.parts.find((part) => part.id === "head");
  if (!bodyTemplate || !headPartTemplate || !hats) {
    throw new Error("manifest lacks boilerplate torso/head test templates");
  }

  const torsoSources = new Map(
    [...(oldShirt?.items ?? []), ...(currentTorso?.items ?? [])].map((item) => [item.id, item]),
  );
  const headSources = new Map((currentHead?.items ?? []).map((item) => [item.id, item]));

  const replacementItem = (
    id: (typeof GEAR_IDS)[number],
    slot: "torso" | "head",
  ): GearManifestItem => {
    const def = GEAR_CATALOG[id];
    const existing = (slot === "torso" ? torsoSources : headSources).get(id);
    if (existing) {
      return {
        ...structuredClone(existing),
        slot,
        slotDirectory: slot === "head" ? "heads" : "torso",
        renderRole: slot === "head" ? "replace-head" : "replace-torso",
        sourceRevision: `source:${id}`,
        parts: existing.parts.map((part) => ({
          ...structuredClone(part),
          id: slot,
          receiver: slot,
          spring: null,
          sourceRevision: `source:${id}:${slot}`,
        })),
        stackBandVerification: null,
      };
    }

    const part = slot === "head" ? headPartTemplate : bodyTemplate;
    return {
      id,
      name: def.name,
      setId: def.legacySetId ?? id,
      slot,
      slotDirectory: slot === "head" ? "heads" : "torso",
      texture: `${id}.png`,
      image: structuredClone(part.image),
      renderRole: slot === "head" ? "replace-head" : "replace-torso",
      sourceRevision: `source:${id}`,
      parts: [
        {
          ...structuredClone(part),
          id: slot,
          receiver: slot,
          spring: null,
          sourceRevision: `source:${id}:${slot}`,
        },
      ],
      stackBandVerification: null,
    };
  };

  const torso: GearManifestSlot = {
    ...(currentTorso ? structuredClone(currentTorso) : {}),
    id: "torso",
    directory: "torso",
    receivers: ["torso"],
    componentIds: ["torso"],
    items: GEAR_IDS.filter(
      (id) => GEAR_CATALOG[id].slot === "torso" && !id.startsWith("blank-drifter-"),
    ).map((id) => replacementItem(id, "torso")),
  };

  const headItems: GearManifestItem[] = GEAR_IDS.filter(
    (id) => GEAR_CATALOG[id].slot === "head" && !id.startsWith("blank-drifter-"),
  ).map((id) => replacementItem(id, "head"));
  const head: GearManifestSlot = {
    ...(currentHead ? structuredClone(currentHead) : {}),
    id: "head",
    directory: "heads",
    receivers: ["head"],
    componentIds: ["head"],
    items: headItems,
  };

  const slotsById = new Map<string, GearManifestSlot>();
  for (const source of candidate.slots) {
    if (source.id === ("shirt" as GearSlot) || source.id === ("pants" as GearSlot)) continue;
    const slot = structuredClone(source);
    const role = ROLE_BY_SLOT[slot.id as GearSlot];
    for (const item of slot.items) {
      item.renderRole = role;
      item.sourceRevision = `source:${item.id}`;
      if (slot.id === "hat" && item.parts.length > 1) {
        item.parts = item.parts.filter((part) => part.id === "prestige-cap");
      }
      for (const part of item.parts) part.sourceRevision = `source:${item.id}:${part.id}`;
    }
    slotsById.set(slot.id, slot);
  }
  slotsById.set("head", head);
  slotsById.set("torso", torso);
  candidate.slots = GEAR_SLOTS.map((slot) => {
    const row = slotsById.get(slot);
    if (!row) throw new Error(`pairs fixture lacks ${slot} slot`);
    return row;
  });
  return candidate;
}

export function replacementPairManifest(revision?: string): GearPartsManifest {
  const manifest = validateGearPartsManifest(replacementPairManifestInput(revision));
  if (!manifest) throw new Error("synthetic torso+head manifest failed validation");
  return manifest;
}
