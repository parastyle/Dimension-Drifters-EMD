/** Element and authored projectile-colour suffixes carried in a projectile kind. */
const ELEMENT_COLOR: Readonly<Record<string, number>> = {
  fire: 0xff6a2a,
  frost: 0x6fd6ff,
  shock: 0xffe24a,
  holy: 0xffe6a0,
  toxic: 0x9cff3b,
  void: 0xb14bff,
  arcane: 0x8f6aff,
};

/** Resolve the optional suffix in "<kind>:<element|#rrggbb>" without loading Phaser. */
export function projectileColorSuffix(kind: string): number | undefined {
  const i = kind.indexOf(":");
  if (i < 0) return undefined;
  const suffix = kind.slice(i + 1);
  if (/^#[\da-f]{6}$/i.test(suffix)) return Number.parseInt(suffix.slice(1), 16);
  return ELEMENT_COLOR[suffix];
}

export function projectileElementColor(element: string): number | undefined {
  return ELEMENT_COLOR[element];
}
