/** §45 reusable uniform-grid broad phase. Items occupy exactly one centre cell; queries return the
 *  cells touched by an AABB (or a radius's bounding box), in insertion order. Cell arrays and the row/cell
 *  maps survive `clear()` so the 20Hz simulation reuses its warmed storage instead of rebuilding it. */
interface GridCell<T> {
  readonly items: T[];
  active: boolean;
}

export class SpatialGrid<T> {
  private readonly rows = new Map<number, Map<number, GridCell<T>>>();
  private readonly activeCells: GridCell<T>[] = [];
  private readonly itemCells = new Map<T, GridCell<T>>();
  private readonly itemOrders = new Map<T, number>();
  private nextOrder = 0;

  constructor(readonly cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError("SpatialGrid cellSize must be a positive finite number");
    }
  }

  /** §45.1 empty the live index while retaining every allocated row, cell, and bucket array for reuse. */
  clear(): void {
    for (const cell of this.activeCells) {
      cell.items.length = 0;
      cell.active = false;
    }
    this.activeCells.length = 0;
    this.itemCells.clear();
    this.itemOrders.clear();
    this.nextOrder = 0;
  }

  /** §45.2 insert once, or move an already-indexed item without changing its stable tick insertion order. */
  insert(item: T, x: number, y: number): void {
    this.assertPoint(x, y);
    const previous = this.itemCells.get(item);
    const next = this.cellAt(this.cellCoord(x), this.cellCoord(y));
    if (previous === next) return;
    if (previous) this.removeFromCell(previous, item);
    else this.itemOrders.set(item, this.nextOrder++);
    this.activate(next);
    next.items.push(item);
    this.itemCells.set(item, next);
  }

  update(item: T, x: number, y: number): void {
    this.insert(item, x, y);
  }

  remove(item: T): void {
    const cell = this.itemCells.get(item);
    if (!cell) return;
    this.removeFromCell(cell, item);
    this.itemCells.delete(item);
    this.itemOrders.delete(item);
  }

  /** §45.3 append every item in cells touched by the inclusive AABB, with no duplicates. `out` is reused. */
  queryAabb(minX: number, minY: number, maxX: number, maxY: number, out: T[]): T[] {
    this.assertPoint(minX, minY);
    this.assertPoint(maxX, maxY);
    out.length = 0;
    const x0 = this.cellCoord(Math.min(minX, maxX));
    const y0 = this.cellCoord(Math.min(minY, maxY));
    const x1 = this.cellCoord(Math.max(minX, maxX));
    const y1 = this.cellCoord(Math.max(minY, maxY));
    for (let cy = y0; cy <= y1; cy++) {
      const row = this.rows.get(cy);
      if (!row) continue;
      for (let cx = x0; cx <= x1; cx++) {
        const cell = row.get(cx);
        if (cell?.active) out.push(...cell.items);
      }
    }
    if (out.length > 1) {
      out.sort((a, b) => (this.itemOrders.get(a) ?? 0) - (this.itemOrders.get(b) ?? 0));
    }
    return out;
  }

  /** §45.4 radius broad phase: the touched AABB is deliberately a superset; callers own exact geometry. */
  queryRadius(x: number, y: number, radius: number, out: T[]): T[] {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError("SpatialGrid radius must be a non-negative finite number");
    }
    return this.queryAabb(x - radius, y - radius, x + radius, y + radius, out);
  }

  orderOf(item: T): number | undefined {
    return this.itemOrders.get(item);
  }

  private cellCoord(value: number): number {
    return Math.floor(value / this.cellSize);
  }

  private cellAt(cx: number, cy: number): GridCell<T> {
    let row = this.rows.get(cy);
    if (!row) {
      row = new Map<number, GridCell<T>>();
      this.rows.set(cy, row);
    }
    let cell = row.get(cx);
    if (!cell) {
      cell = { items: [], active: false };
      row.set(cx, cell);
    }
    return cell;
  }

  private activate(cell: GridCell<T>): void {
    if (cell.active) return;
    cell.active = true;
    this.activeCells.push(cell);
  }

  private removeFromCell(cell: GridCell<T>, item: T): void {
    const index = cell.items.indexOf(item);
    if (index >= 0) cell.items.splice(index, 1);
  }

  private assertPoint(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError("SpatialGrid coordinates must be finite numbers");
    }
  }
}
