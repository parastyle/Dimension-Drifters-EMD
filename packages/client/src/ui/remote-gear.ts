import { decodeGearCosmetics, type GearId, type GearSlot } from "@dd/shared";

export type RemoteGearLoadout = Readonly<Record<GearSlot, GearId>>;

export interface SyncedGearRow {
  gearUpper: unknown;
  gearLower: unknown;
}

/** Wave 4 data seam only. Wave 5 may read this cache when it attaches cosmetics to SpriteRig. */
export function syncRemoteGearLoadouts(
  target: Map<string, RemoteGearLoadout>,
  rows: Iterable<[string, SyncedGearRow]>,
): void {
  const live = new Set<string>();
  for (const [id, row] of rows) {
    live.add(id);
    const previous = target.get(id);
    const signature = `${String(row.gearUpper)}|${String(row.gearLower)}`;
    if (
      (previous as (RemoteGearLoadout & { __signature?: string }) | undefined)?.__signature ===
      signature
    )
      continue;
    const decoded = decodeGearCosmetics(row.gearUpper, row.gearLower) as Record<
      GearSlot,
      GearId
    > & {
      __signature?: string;
    };
    Object.defineProperty(decoded, "__signature", { value: signature, enumerable: false });
    target.set(id, Object.freeze(decoded));
  }
  for (const id of target.keys()) if (!live.has(id)) target.delete(id);
}
