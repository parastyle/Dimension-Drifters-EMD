export interface TomeOpenArt {
  readonly textureKey: string;
  readonly url?: string;
  /** No companion frame exists: retain two mirrored/splayed leaves made from the equipped closed sprite. */
  readonly proceduralSplay?: true;
  /** Painted direction of the open fore-edge in texture-local radians (+X = 0). */
  readonly openingDirectionRad?: number;
  /** Multiplier for detached page-turn quads; the held book scale remains unchanged. */
  readonly pageScale?: number;
}

/**
 * Expansion books with a painted open-state companion, plus explicit procedural fallbacks where the owner
 * ordered an open state without new art. Painted companions stay loose and load only when equipped.
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
    pageScale: 7,
  },
  "x2-rimebound-folio": {
    textureKey: "procedural-open:x2-rimebound-folio",
    proceduralSplay: true,
  },
};

export function tomeOpenArtFor(spriteId: string): TomeOpenArt | undefined {
  return TOME_OPEN_ART[spriteId];
}

/** Rotate painted open-book art so its actual fore-edge, not the bitmap's +X axis, follows aim. */
export function tomeOpenRotationForAim(spriteId: string, aimLocalRad: number): number {
  return aimLocalRad - (tomeOpenArtFor(spriteId)?.openingDirectionRad ?? 0);
}
