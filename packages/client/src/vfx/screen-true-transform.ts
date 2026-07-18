/**
 * A screen-true child may inherit rotation and scale magnitude from an actor, but it must never inherit a
 * reflection. Mirroring can come from either parent axis (facing turns use X; paper unfolds briefly use Y),
 * so the counter-sign is derived from the complete parent determinant rather than a committed facing flag.
 */
export function screenTrueScaleX(
  parentScaleX: number,
  parentScaleY: number,
  desiredScaleX: number,
): number {
  const parentDeterminant = parentScaleX * parentScaleY;
  return (parentDeterminant < 0 ? -1 : 1) * Math.abs(desiredScaleX);
}

/** Scale-only determinant helper used by transform-law regressions. Rotation and translation preserve it. */
export function scaleWorldDeterminant(
  parentScaleX: number,
  parentScaleY: number,
  childScaleX: number,
  childScaleY: number,
): number {
  return parentScaleX * parentScaleY * childScaleX * childScaleY;
}
