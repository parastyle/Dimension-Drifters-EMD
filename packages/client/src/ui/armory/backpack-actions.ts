export type BackpackWorkflow = "inventory";
export type BackpackSelectionSource = "bag" | "slot";

export type BackpackTileIntent = "equip" | "stow" | "select" | "none";

export function backpackTileIntent(
  _workflow: BackpackWorkflow,
  source: BackpackSelectionSource,
): BackpackTileIntent {
  return source === "bag" ? "equip" : "stow";
}

export type BackpackPrimaryIntent = "disassemble" | "stow" | "none";

/** The persistent detail action is the explicit destructive seam for bag disassembly. */
export function backpackPrimaryIntent(
  _workflow: BackpackWorkflow,
  source: BackpackSelectionSource | null,
): BackpackPrimaryIntent {
  if (!source) return "none";
  return source === "bag" ? "disassemble" : "stow";
}
