import {
  affixById,
  RARITIES,
  WEAPONS,
  type WeaponExpeditionReservationV1,
  weaponEntryInstances,
} from "@dd/shared";

export interface WeaponSettlementReceiptView {
  ok: boolean;
  outcome: "victory" | "defeat";
  returnedEntries: number;
  returnedPhysical: number;
  intakeEntries: number;
  lostEntries: number;
  lostPhysical: number;
}

export interface SettlementPresentation {
  outcome: "victory" | "defeat";
  heading: string;
  primary: string;
  detail: string;
  foundPhysical: number;
  lostNames: string[];
}

export interface SettlementManifestEntry {
  entryId: string;
  origin: "committed" | "found";
  location: "active" | "pack" | "field";
  physical: number;
  weaponNames: string[];
}

function instanceName(instance: { weaponId: string; rarity: string; affix: string }): string {
  const weapon = WEAPONS[instance.weaponId]?.name ?? "Unknown weapon";
  const rarity = RARITIES.find((row) => row.id === instance.rarity)?.name ?? "";
  const affix = instance.affix ? affixById(instance.affix).name : "";
  return [rarity, affix, weapon].filter(Boolean).join(" ");
}

export function settlementPresentation(
  receipt: WeaponSettlementReceiptView,
  expedition: WeaponExpeditionReservationV1 | null | undefined,
  manifest: readonly SettlementManifestEntry[] = [],
): SettlementPresentation {
  const returnedRows = expedition?.entries.filter((row) => row.location !== "field") ?? [];
  const foundPhysical =
    manifest.length > 0
      ? manifest
          .filter((row) => row.origin === "found" && row.location !== "field")
          .reduce((sum, row) => sum + row.physical, 0)
      : returnedRows
          .filter((row) => row.stakeOrigin === "found")
          .reduce((sum, row) => sum + weaponEntryInstances(row.entry).length, 0);
  if (receipt.outcome === "victory") {
    const intake =
      receipt.intakeEntries > 0
        ? ` · Intake: ${receipt.intakeEntries} ${receipt.intakeEntries === 1 ? "entry" : "entries"}`
        : " · Stash sealed";
    return {
      outcome: "victory",
      heading: "BANKED · THE EDGE PAID",
      primary: `Kept: ${receipt.returnedPhysical} weapons · Found: ${foundPhysical}`,
      detail: `Nothing carried was copied. Everything returned is home${intake}.`,
      foundPhysical,
      lostNames: [],
    };
  }
  const namesByEntry = new Map<string, string[]>();
  for (const row of expedition?.entries ?? []) {
    namesByEntry.set(row.entry.entryId, weaponEntryInstances(row.entry).map(instanceName));
  }
  for (const row of manifest) {
    if (row.weaponNames.length > 0) namesByEntry.set(row.entryId, row.weaponNames);
    else if (!namesByEntry.has(row.entryId)) {
      namesByEntry.set(
        row.entryId,
        Array.from({ length: row.physical }, () => "Unknown weapon"),
      );
    }
  }
  const lostNames = [...namesByEntry.values()].flat();
  return {
    outcome: "defeat",
    heading: "THE CARRY IS GONE",
    primary: `Lost: ${lostNames.length > 0 ? lostNames.join(" · ") : `${receipt.lostPhysical} weapons`}`,
    detail: "The Stash stayed home. The Home-Issue blade returns next embark.",
    foundPhysical: 0,
    lostNames,
  };
}
