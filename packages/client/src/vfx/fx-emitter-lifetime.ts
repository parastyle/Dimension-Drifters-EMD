export const FX_EMITTER_LIFETIME_BOUND_MS = 1_600;

export interface WispTweenTiming {
  readonly delay: number;
  readonly riseDuration: number;
  readonly fadeDuration: number;
  readonly total: number;
}

/** Finite timing shared by every painted pack wisp; delay belongs to the first chain segment. */
export function wispTweenTiming(order: number): WispTweenTiming {
  const delay = 45 + order * 22;
  const riseDuration = 420 + order * 35;
  const fadeDuration = 520 + order * 45;
  return Object.freeze({
    delay,
    riseDuration,
    fadeDuration,
    total: delay + riseDuration + fadeDuration,
  });
}
