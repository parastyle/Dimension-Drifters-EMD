/** A point in the source pixels of one installed held-weapon PNG. */
export interface WeaponArtPoint {
  readonly x: number;
  readonly y: number;
}

export interface WeaponArtMuzzlePoint extends WeaponArtPoint {
  /** Zero-based `part-N.png` index. */
  readonly part: number;
  /** Catalog-law reference produced by the alpha barrel-band heuristic. */
  readonly derived: WeaponArtPoint;
  /** Required whenever the authored point intentionally differs from the alpha derivation. */
  readonly overrideReason?: string;
}

export interface WeaponArtMuzzleDefinition {
  readonly sprite: string;
  readonly parts: readonly { readonly width: number; readonly height: number }[];
  readonly points: readonly WeaponArtMuzzlePoint[];
  /** Multiple held copies either emit together or alternate by accepted beat. */
  readonly salvoMode: "parallel" | "cycle";
  /** Multiple bores on the selected copy either emit together or select one by accepted beat. */
  readonly barrelMode: "parallel" | "cycle";
}

/** Column-major 2D affine transform: x' = a*x + c*y + tx; y' = b*x + d*y + ty. */
export interface WeaponAffineTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface WeaponSpriteTransformInput {
  /** Sprite origin/pivot position in the parent coordinate space. */
  x: number;
  y: number;
  /** Source-pixel pivot. */
  originX: number;
  originY: number;
  rotation: number;
  /** Signed scale. Negative X/Y carries sprite mirroring through the same transform. */
  scaleX: number;
  scaleY: number;
}

/** Build the exact affine used to draw a sprite from position/rotation/scale/mirror/origin. */
export function weaponSpriteTransform(
  input: Readonly<WeaponSpriteTransformInput>,
  out: WeaponAffineTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
): WeaponAffineTransform {
  const cos = Math.cos(input.rotation);
  const sin = Math.sin(input.rotation);
  out.a = cos * input.scaleX;
  out.b = sin * input.scaleX;
  out.c = -sin * input.scaleY;
  out.d = cos * input.scaleY;
  out.tx = input.x - out.a * input.originX - out.c * input.originY;
  out.ty = input.y - out.b * input.originX - out.d * input.originY;
  return out;
}

/** Compose a sprite's parent-local affine through its parent/root affine. */
export function composeWeaponTransform(
  parent: Readonly<WeaponAffineTransform>,
  local: Readonly<WeaponAffineTransform>,
  out: WeaponAffineTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
): WeaponAffineTransform {
  const a = parent.a * local.a + parent.c * local.b;
  const b = parent.b * local.a + parent.d * local.b;
  const c = parent.a * local.c + parent.c * local.d;
  const d = parent.b * local.c + parent.d * local.d;
  const tx = parent.a * local.tx + parent.c * local.ty + parent.tx;
  const ty = parent.b * local.tx + parent.d * local.ty + parent.ty;
  out.a = a;
  out.b = b;
  out.c = c;
  out.d = d;
  out.tx = tx;
  out.ty = ty;
  return out;
}

/**
 * The only art-point-to-space operation. Server launches, projectile/beam visuals, flashes, and probes
 * all feed the relevant sprite affine into this function; no caller may reinterpret the point as reach or
 * forward/lateral offsets.
 */
export function transformWeaponArtPoint<T extends { x: number; y: number }>(
  point: Readonly<WeaponArtPoint>,
  transform: Readonly<WeaponAffineTransform>,
  out: T = { x: 0, y: 0 } as T,
): T {
  const x = transform.a * point.x + transform.c * point.y + transform.tx;
  const y = transform.b * point.x + transform.d * point.y + transform.ty;
  out.x = x;
  out.y = y;
  return out;
}

function beatIndex(acceptedSeq: number, count: number): number {
  return (Math.max(1, acceptedSeq >>> 0) - 1) % Math.max(1, count);
}

/** Ordered physical art points emitted by one accepted beat. */
export function weaponArtMuzzlePointsForShot(
  definition: Readonly<WeaponArtMuzzleDefinition>,
  acceptedSeq: number,
  salvoIndex?: number,
): readonly WeaponArtMuzzlePoint[] {
  let selected = definition.points;
  const parts = [...new Set(definition.points.map((point) => point.part))];
  if (definition.salvoMode === "cycle" && parts.length > 1) {
    const part = parts[(salvoIndex ?? beatIndex(acceptedSeq, parts.length)) % parts.length];
    selected = definition.points.filter((point) => point.part === part);
  }
  if (definition.barrelMode === "cycle" && selected.length > 1) {
    const point = selected[beatIndex(acceptedSeq, selected.length)];
    return point ? [point] : [];
  }
  return selected;
}
