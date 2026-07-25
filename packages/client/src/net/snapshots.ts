import {
  INTERP_DELAY_MS,
  INTERP_EXTRAP_MAX_MS,
  MOVEMENT_CORRECTION_SMOOTH_MAX_MS,
  MovementCorrectionBand,
  movementCorrectionBand,
  SNAPSHOT_DEPTH,
  TICK_MS,
} from "@dd/shared";

/**
 * §4 v0.107 SNAPSHOT-BUFFER INTERPOLATION for remote entities (docs/NETCODE_DESIGN.md).
 *
 * PURE module (no Phaser/Colyseus) — unit-testable. Remote players + enemies render a fixed
 * INTERP_DELAY_MS behind the SERVER-TICK timeline, linearly interpolated between two real snapshots.
 * The timeline is the synced `ArenaState.tick` counter (tick × TICK_MS), NOT client receive time —
 * a TCP burst delivers 200ms of patches in ~1ms of wall clock, and stamping those with receive time
 * would collapse 200ms of motion into a teleport (review #6). `TimelineSync` learns the offset between
 * the client clock and the tick timeline (sliding-window minimum = the least-delayed arrival) so
 * `renderTime()` tracks the server clock through drift and jitter.
 */

export interface SnapshotPoint {
  x: number;
  y: number;
}

/** Maps client wall-clock to the server-tick timeline from observed patch arrivals. */
export class TimelineSync {
  private static readonly WINDOW_MS = 3000;
  /** §4 one tick-locked sample per TICK_MS, plus two boundary slots because the expiry is strictly `>`. */
  private static readonly CAPACITY = Math.ceil(TimelineSync.WINDOW_MS / TICK_MS) + 2;
  /** §4 fixed rings avoid sliding-array objects + `shift()` copies on every expired patch. */
  private readonly arrivals = new Float64Array(TimelineSync.CAPACITY);
  private readonly offsets = new Float64Array(TimelineSync.CAPACITY);
  private head = 0;
  private size = 0;
  private minOffset = Number.POSITIVE_INFINITY;

  /** Record a patch arrival: the synced tick counter + the client receive clock. */
  onPatch(tick: number, clientNow: number): void {
    let removedMin = false;
    while (
      this.size > 0 &&
      clientNow - this.arrivals[this.head]! > TimelineSync.WINDOW_MS
    ) {
      if (this.offsets[this.head] === this.minOffset) removedMin = true;
      this.head = (this.head + 1) % TimelineSync.CAPACITY;
      this.size--;
    }
    if (removedMin) this.rescanMinimum();

    // A pathological patch flood can fill the fixed ring before wall-clock expiry. Preserve the newest
    // observations, exactly as SnapshotBuffer does, and cheaply rescan only if the evicted value owned MIN.
    if (this.size === TimelineSync.CAPACITY) {
      const removedOffset = this.offsets[this.head];
      this.head = (this.head + 1) % TimelineSync.CAPACITY;
      this.size--;
      if (removedOffset === this.minOffset) this.rescanMinimum();
    }

    const index = (this.head + this.size) % TimelineSync.CAPACITY;
    const off = clientNow - tick * TICK_MS;
    this.arrivals[index] = clientNow;
    this.offsets[index] = off;
    this.size++;
    if (off < this.minOffset) this.minOffset = off;
  }

  /** Recompute MIN only when its owning ring slot expires/overwrites; renderTime remains allocation-free O(1). */
  private rescanMinimum(): void {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.size; i++) {
      const off = this.offsets[(this.head + i) % TimelineSync.CAPACITY]!;
      if (off < min) min = off;
    }
    this.minOffset = min;
  }

  /** The server-timeline instant remote entities should RENDER at (delay behind the newest estimate). */
  renderTime(clientNow: number): number {
    if (this.size === 0) return 0;
    return clientNow - this.minOffset - INTERP_DELAY_MS;
  }

  get ready(): boolean {
    return this.size > 0;
  }

  /** Drop all learned offsets — call on a scene restart / reconnect (a NEW room's tick counter starts
   *  over, so offsets learned against the old room's timeline are garbage). */
  reset(): void {
    this.head = 0;
    this.size = 0;
    this.minOffset = Number.POSITIVE_INFINITY;
  }
}

/** Per-entity fixed ring of tick-stamped positions with bracketed linear interpolation. */
export class SnapshotBuffer {
  /** §4 structure-of-arrays ring: no per-patch objects and no O(depth) `shift()` at capacity. */
  private readonly times = new Float64Array(SNAPSHOT_DEPTH);
  private readonly xs = new Float64Array(SNAPSHOT_DEPTH);
  private readonly ys = new Float64Array(SNAPSHOT_DEPTH);
  private head = 0;
  private size = 0;

  private index(logicalIndex: number): number {
    return (this.head + logicalIndex) % SNAPSHOT_DEPTH;
  }

  /** Push the entity's position from a fresh patch. Ignores duplicate stamps (same tick re-observed). */
  push(t: number, x: number, y: number): void {
    if (this.size > 0) {
      const last = this.index(this.size - 1);
      if (t <= this.times[last]!) return;
    }

    let index: number;
    if (this.size < SNAPSHOT_DEPTH) {
      index = this.index(this.size);
      this.size++;
    } else {
      index = this.head;
      this.head = (this.head + 1) % SNAPSHOT_DEPTH;
    }
    this.times[index] = t;
    this.xs[index] = x;
    this.ys[index] = y;
  }

  /** Drop history and hold a single authoritative point — used on TELEPORTS (a remote pit snap-back /
   *  reposition must cut, not re-walk the old path — review #10). */
  reset(t: number, x: number, y: number): void {
    this.head = 0;
    this.size = 1;
    this.times[0] = t;
    this.xs[0] = x;
    this.ys[0] = y;
  }

  private write(index: number, out: SnapshotPoint): SnapshotPoint {
    out.x = this.xs[index]!;
    out.y = this.ys[index]!;
    return out;
  }

  /**
   * Sample buffered motion into caller-owned `out` (the allocation-free render-loop API).
   * - Bracketed: linear interp between the two surrounding snapshots. A bracket gap wider than
   *   `snapGapPx` is a TELEPORT — jump to the newer side, never tween across it.
   * - Ahead of the newest (starved buffer / TCP stall): extrapolate along the last observed velocity,
   *   clamped to INTERP_EXTRAP_MAX_MS, then HOLD (bounded guessing).
   * - Before the oldest (just spawned): hold the oldest.
   * Returns null when the buffer is empty (caller falls back to raw state).
   */
  sampleInto(t: number, snapGapPx: number, out: SnapshotPoint): SnapshotPoint | null {
    const n = this.size;
    if (n === 0) return null;
    const first = this.head;
    const last = this.index(n - 1);
    if (t <= this.times[first]!) return this.write(first, out);
    if (t >= this.times[last]!) {
      // Extrapolate (clamped) along the newest observed velocity, then hold.
      if (n < 2) return this.write(last, out);
      const prev = this.index(n - 2);
      const span = this.times[last]! - this.times[prev]!;
      if (span <= 0) return this.write(last, out);
      const dx = this.xs[last]! - this.xs[prev]!;
      const dy = this.ys[last]! - this.ys[prev]!;
      const band = movementCorrectionBand(Math.hypot(dx, dy), snapGapPx);
      if (band !== MovementCorrectionBand.Smooth)
        return this.write(last, out); // silent dust / teleport: never extrapolate
      const ahead = Math.min(t - this.times[last]!, INTERP_EXTRAP_MAX_MS);
      const k = ahead / span;
      out.x = this.xs[last]! + dx * k;
      out.y = this.ys[last]! + dy * k;
      return out;
    }

    // Bracketed: find the surrounding pair (ring is tiny — linear scan is the fast path).
    for (let i = n - 1; i > 0; i--) {
      const b = this.index(i);
      const a = this.index(i - 1);
      if (t >= this.times[a]! && t <= this.times[b]!) {
        const dx = this.xs[b]! - this.xs[a]!;
        const dy = this.ys[b]! - this.ys[a]!;
        const band = movementCorrectionBand(Math.hypot(dx, dy), snapGapPx);
        if (band !== MovementCorrectionBand.Smooth) return this.write(b, out);
        const span = this.times[b]! - this.times[a]!;
        const smoothSpan = Math.min(span, MOVEMENT_CORRECTION_SMOOTH_MAX_MS);
        const smoothStart = this.times[b]! - smoothSpan;
        if (t <= smoothStart) return this.write(a, out);
        const k = (t - smoothStart) / smoothSpan;
        out.x = this.xs[a]! + dx * k;
        out.y = this.ys[a]! + dy * k;
        return out;
      }
    }
    return this.write(last, out);
  }

  /** Compatibility wrapper for non-hot callers; render loops should retain an output and call sampleInto(). */
  sample(t: number, snapGapPx: number): SnapshotPoint | null {
    return this.sampleInto(t, snapGapPx, { x: 0, y: 0 });
  }
}
