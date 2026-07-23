export const BRIMSTONE_ROCKET_TUBE_ID = "x2-brimstone-rocket-tube";

export interface StraightFlightSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flightAgeTicks: number;
}

export interface StraightFlightRenderState {
  x: number;
  y: number;
  observedFlightAgeTicks: number | undefined;
}

/** Row-404 amendment: only Brimstone opts out of the live-muzzle convergence presentation. */
export function usesAuthoritativeStraightFlight(
  weaponId: string,
  arcHeight: number | undefined,
): boolean {
  return weaponId === BRIMSTONE_ROCKET_TUBE_ID && !(arcHeight && arcHeight > 0);
}

/**
 * Rebase on each newly observed server tick, then extrapolate only along its synced velocity.
 * Tick boundaries are exact authority positions and between-tick samples cannot introduce curvature.
 */
export function stepAuthoritativeStraightFlight(
  snapshot: StraightFlightSnapshot,
  rendered: StraightFlightRenderState,
  dtSeconds: number,
): StraightFlightRenderState {
  if (rendered.observedFlightAgeTicks !== snapshot.flightAgeTicks) {
    return {
      x: snapshot.x,
      y: snapshot.y,
      observedFlightAgeTicks: snapshot.flightAgeTicks,
    };
  }
  const dt = Math.max(0, dtSeconds);
  return {
    x: rendered.x + snapshot.vx * dt,
    y: rendered.y + snapshot.vy * dt,
    observedFlightAgeTicks: snapshot.flightAgeTicks,
  };
}
