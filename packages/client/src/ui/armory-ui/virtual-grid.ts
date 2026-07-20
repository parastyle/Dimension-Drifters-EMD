export interface VirtualGridWindowInput {
  readonly itemCount: number;
  readonly columns: number;
  readonly rowHeight: number;
  readonly viewportHeight: number;
  readonly scrollOffset: number;
  /** Overscan rows on each side. */
  readonly overscanRows?: number;
}

export interface VirtualGridWindow {
  readonly columns: number;
  readonly rowCount: number;
  readonly firstRow: number;
  readonly lastRowExclusive: number;
  readonly firstIndex: number;
  readonly lastIndexExclusive: number;
  readonly poolSize: number;
  readonly contentHeight: number;
  readonly scrollOffset: number;
}

const boundedInteger = (value: number, floor: number): number =>
  Math.max(floor, Number.isFinite(value) ? Math.floor(value) : floor);

export function virtualGridWindow(input: VirtualGridWindowInput): VirtualGridWindow {
  const itemCount = boundedInteger(input.itemCount, 0);
  const columns = boundedInteger(input.columns, 1);
  const rowHeight = Math.max(1, Number.isFinite(input.rowHeight) ? input.rowHeight : 1);
  const viewportHeight = Math.max(1, Number.isFinite(input.viewportHeight) ? input.viewportHeight : 1);
  const overscanRows = boundedInteger(input.overscanRows ?? 1, 0);
  const rowCount = Math.ceil(itemCount / columns);
  const contentHeight = rowCount * rowHeight;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const scrollOffset = Math.max(0, Math.min(maxScroll, input.scrollOffset || 0));
  const visibleFirst = Math.floor(scrollOffset / rowHeight);
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const firstRow = Math.max(0, visibleFirst - overscanRows);
  const lastRowExclusive = Math.min(rowCount, visibleFirst + visibleRows + overscanRows);
  const firstIndex = firstRow * columns;
  const lastIndexExclusive = Math.min(itemCount, lastRowExclusive * columns);
  return {
    columns,
    rowCount,
    firstRow,
    lastRowExclusive,
    firstIndex,
    lastIndexExclusive,
    poolSize: Math.max(0, lastIndexExclusive - firstIndex),
    contentHeight,
    scrollOffset,
  };
}

export type GridMove = "left" | "right" | "up" | "down" | "page-previous" | "page-next";

/** Pure focus/scroll owner shared by the canvas catalog surfaces. */
export class VirtualGridFocusController {
  focusedIndex = 0;
  selectedId = "";
  hoverId = "";
  scrollOffset = 0;

  constructor(
    public columns: number,
    public itemCount: number,
    public rowHeight: number,
    public viewportHeight: number,
  ) {
    this.configure(columns, itemCount, rowHeight, viewportHeight);
  }

  configure(columns: number, itemCount: number, rowHeight: number, viewportHeight: number): void {
    this.columns = boundedInteger(columns, 1);
    this.itemCount = boundedInteger(itemCount, 0);
    this.rowHeight = Math.max(1, rowHeight);
    this.viewportHeight = Math.max(1, viewportHeight);
    this.focusedIndex = Math.max(0, Math.min(Math.max(0, this.itemCount - 1), this.focusedIndex));
    this.scrollIntoView();
  }

  move(move: GridMove): number {
    if (this.itemCount <= 0) {
      this.focusedIndex = 0;
      this.scrollOffset = 0;
      return 0;
    }
    const pageRows = Math.max(1, Math.floor(this.viewportHeight / this.rowHeight));
    const delta =
      move === "left"
        ? -1
        : move === "right"
          ? 1
          : move === "up"
            ? -this.columns
            : move === "down"
              ? this.columns
              : move === "page-previous"
                ? -this.columns * pageRows
                : this.columns * pageRows;
    this.focusedIndex = (this.focusedIndex + delta + this.itemCount * 2) % this.itemCount;
    this.scrollIntoView();
    return this.focusedIndex;
  }

  focus(index: number): number {
    this.focusedIndex = Math.max(0, Math.min(Math.max(0, this.itemCount - 1), Math.floor(index)));
    this.scrollIntoView();
    return this.focusedIndex;
  }

  scrollIntoView(): void {
    if (this.itemCount <= 0) {
      this.scrollOffset = 0;
      return;
    }
    const row = Math.floor(this.focusedIndex / this.columns);
    const rowTop = row * this.rowHeight;
    const rowBottom = rowTop + this.rowHeight;
    if (rowTop < this.scrollOffset) this.scrollOffset = rowTop;
    else if (rowBottom > this.scrollOffset + this.viewportHeight) {
      this.scrollOffset = rowBottom - this.viewportHeight;
    }
    const contentHeight = Math.ceil(this.itemCount / this.columns) * this.rowHeight;
    this.scrollOffset = Math.max(0, Math.min(Math.max(0, contentHeight - this.viewportHeight), this.scrollOffset));
  }

  previewId(defaultId: string): string {
    return this.selectedId || this.hoverId || defaultId;
  }
}
