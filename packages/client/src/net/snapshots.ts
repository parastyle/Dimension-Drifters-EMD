import { INTERP_DELAY_MS, INTERP_EXTRAP_MAX_MS, SNAPSHOT_DEPTH, TICK_MS } from "@dd/shared";

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

interface Snap {
  /** Server-timeline stamp (tick × TICK_MS). */
  t: number;
  x: number;
  y: number;
}

/** Maps client wall-clock to the server-tick timeline from observed patch arrivals. */
export class TimelineSync {
  /** Sliding window of (clientNow − tickMs) offsets; the MIN is the least-delayed observed arrival. */
  private readonly offsets: { at: number; off: number }[] = [];
  private static readonly WINDOW_MS = 3000;

  /** Record a patch arrival: the synced tick counter + the client receive clock. */
  onPatch(tick: number, clientNow: number): void {
    const off = clientNow - tick * TICK_MS;
    this.offsets.push({ at: clientNow, off });
    while (
      this.offsets.length > 0 &&
      clientNow - (this.offsets[0] as { at: number }).at > TimelineSync.WINDOW_MS
    ) {
      this.offsets.shift();
    }
  }

  /** The server-timeline instant remote entities should RENDER at (delay behind the newest estimate). */
  renderTime(clientNow: number): number {
    if (this.offsets.length === 0) return 0;
    let min = Number.POSITIVE_INFINITY;
    for (const o of this.offsets) if (o.off < min) min = o.off;
    return clientNow - min - INTERP_DELAY_MS;
  }

  get ready(): boolean {
    return this.offsets.length > 0;
  }

  /** Drop all learned offsets — call on a scene restart / reconnect (a NEW room's tick counter starts
   *  over, so offsets learned against the old room's timeline are garbage). */
  reset(): void {
    this.offsets.length = 0;
  }
}

/** Per-entity ring of tick-stamped positions with bracketed linear interpolation. */
export class SnapshotBuffer {
  private readonly snaps: Snap[] = [];

  /** Push the entity's position from a fresh patch. Ignores duplicate stamps (same tick re-observed). */
  push(t: number, x: number, y: number): void {
    const last = this.snaps[this.snaps.length - 1];
    if (last && t <= last.t) return;
    this.snaps.push({ t, x, y });
    while (this.snaps.length > SNAPSHOT_DEPTH) this.snaps.shift();
  }

  /** Drop history and hold a single authoritative point — used on TELEPORTS (a remote pit snap-back /
   *  reposition must cut, not re-walk the old path — review #10). */
  reset(t: number, x: number, y: number): void {
    this.snaps.length = 0;
    this.snaps.push({ t, x, y });
  }

  /**
   * Sample the buffered motion at server-timeline `t` (from `TimelineSync.renderTime`).
   * - Bracketed: linear interp between the two surrounding snapshots. A bracket gap wider than
   *   `snapGapPx` is a TELEPORT — jump to the newer side, never tween across it.
   * - Ahead of the newest (starved buffer / TCP stall): extrapolate along the last observed velocity,
   *   clamped to INTERP_EXTRAP_MAX_MS, then HOLD (bounded guessing).
   * - Before the oldest (just spawned): hold the oldest.
   * Returns null when the buffer is empty (caller falls back to raw state).
   */
  sample(t: number, snapGapPx: number): { x: number; y: number } | null {
    const n = this.snaps.length;
    if (n === 0) return null;
    const first = this.snaps[0] as Snap;
    const last = this.snaps[n - 1] as Snap;
    if (t <= first.t) return { x: first.x, y: first.y };
    if (t >= last.t) {
      // Extrapolate (clamped) along the newest observed velocity, then hold.
      if (n < 2) return { x: last.x, y: last.y };
      const prev = this.snaps[n - 2] as Snap;
      const span = last.t - prev.t;
      if (span <= 0) return { x: last.x, y: last.y };
      const gap = Math.hypot(last.x - prev.x, last.y - prev.y);
      if (gap > snapGapPx) return { x: last.x, y: last.y }; // don't extrapolate a teleport
      const ahead = Math.min(t - last.t, INTERP_EXTRAP_MAX_MS);
      const k = ahead / span;
      return { x: last.x + (last.x - prev.x) * k, y: last.y + (last.y - prev.y) * k };
    }
    // Bracketed: find the surrounding pair (ring is tiny — linear scan is the fast path).
    for (let i = n - 1; i > 0; i--) {
      const b = this.snaps[i] as Snap;
      const a = this.snaps[i - 1] as Snap;
      if (t >= a.t && t <= b.t) {
        if (Math.hypot(b.x - a.x, b.y - a.y) > snapGapPx) return { x: b.x, y: b.y }; // teleport: cut
        const k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: last.x, y: last.y };
  }
}
