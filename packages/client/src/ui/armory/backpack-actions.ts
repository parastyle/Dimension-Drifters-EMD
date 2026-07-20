export type BackpackWorkflow = "inventory" | "sell" | "bind" | "upgrades";
export type BackpackSelectionSource = "bag" | "slot";

export type BackpackTileIntent = "equip" | "stow" | "select" | "none";

/** Tile clicks are reversible in Inventory and selection-only in every trading workflow. */
export function backpackTileIntent(
  workflow: BackpackWorkflow,
  source: BackpackSelectionSource,
): BackpackTileIntent {
  if (workflow !== "inventory") return workflow === "upgrades" ? "none" : "select";
  return source === "bag" ? "equip" : "stow";
}

export type BackpackPrimaryIntent = "equip" | "stow" | "sell" | "bind" | "upgrade" | "none";

/** Destructive SELL can only emerge from the persistent detail action / Enter route. */
export function backpackPrimaryIntent(
  workflow: BackpackWorkflow,
  source: BackpackSelectionSource | null,
): BackpackPrimaryIntent {
  if (workflow === "upgrades") return "upgrade";
  if (!source) return "none";
  if (workflow === "sell") return "sell";
  if (workflow === "bind") return "bind";
  return source === "bag" ? "equip" : "stow";
}
