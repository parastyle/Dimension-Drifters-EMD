export interface TomeOpenArt {
  readonly textureKey: string;
  readonly url: string;
  /** Painted direction of the open fore-edge in texture-local radians (+X = 0). */
  readonly openingDirectionRad?: number;
}

/**
 * The seven expansion books with a painted open-state companion. These stay loose instead of entering the
 * main atlas: expansion weapon art is loaded only when an equipped/pickup identity makes it necessary.
 */
const TOME_OPEN_ART: Readonly<Record<string, TomeOpenArt>> = {
  "x2-pyroglyph-spellbook": {
    textureKey: "tome-open:x2-pyroglyph-spellbook",
    url: "sprites/x2-pyroglyph-spellbook/open.png",
  },
  "x2-hexbloom-scattergrimoire": {
    textureKey: "tome-open:x2-hexbloom-scattergrimoire",
    url: "sprites/x2-hexbloom-scattergrimoire/open.png",
    openingDirectionRad: -Math.PI / 2,
  },
  "x2-null-grimoire-of-the-hollow-page": {
    textureKey: "tome-open:x2-null-grimoire-of-the-hollow-page",
    url: "sprites/x2-null-grimoire-of-the-hollow-page/open.png",
  },
  "x2-codex-of-forked-tongues": {
    textureKey: "tome-open:x2-codex-of-forked-tongues",
    url: "sprites/x2-codex-of-forked-tongues/open.png",
  },
  "x2-maledict-tome-of-salt-lines": {
    textureKey: "tome-open:x2-maledict-tome-of-salt-lines",
    url: "sprites/x2-maledict-tome-of-salt-lines/open.png",
  },
  "x2-emberleaf-chapbook": {
    textureKey: "tome-open:x2-emberleaf-chapbook",
    url: "sprites/x2-emberleaf-chapbook/open.png",
  },
  "x2-verdigris-grand-grimoire": {
    textureKey: "tome-open:x2-verdigris-grand-grimoire",
    url: "sprites/x2-verdigris-grand-grimoire/open.png",
  },
};

export function tomeOpenArtFor(spriteId: string): TomeOpenArt | undefined {
  return TOME_OPEN_ART[spriteId];
}

/** Rotate painted open-book art so its actual fore-edge, not the bitmap's +X axis, follows aim. */
export function tomeOpenRotationForAim(spriteId: string, aimLocalRad: number): number {
  return aimLocalRad - (tomeOpenArtFor(spriteId)?.openingDirectionRad ?? 0);
}
