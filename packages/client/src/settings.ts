export const SETTINGS_STORAGE_KEY = "dd.settings.v1";

export type DamageNumberVisibility = "all" | "own" | "off";
export type DamageNumberStyle = "detailed" | "aggregate";
export type DamageNumberScale = 0.8 | 0.9 | 1 | 1.1 | 1.2 | 1.3 | 1.4;
export type ScreenShakeScale = 0 | 0.5 | 1;
export type RenderScaleMode = "auto" | "native" | "performance";
export type ColorblindAssistMode = "off" | "shapes";

export interface FeedbackSettings {
  damageNumbers: DamageNumberVisibility;
  damageNumberStyle: DamageNumberStyle;
  damageNumberScale: DamageNumberScale;
  hitConfirmAudio: boolean;
  /** Dedicated confirm-layer gain. Optional in the type so v1 callers written before this field migrate. */
  confirmVolume?: number;
  hitSparks: boolean;
  screenShake: ScreenShakeScale;
  hitStop: boolean;
  flashes: "full" | "reduced";
  /** Optional for callers authored before the v1 accessibility append; sanitized settings always fill it. */
  colorblindAssist?: ColorblindAssistMode;
}

export interface RenderingSettings {
  renderScale: RenderScaleMode;
}

export interface ContextHintSettings {
  beamOverheat: number;
  juggle: number;
  ultimateReady: number;
  lavaGapFall: number;
  empoweredReturn: number;
}

export interface OnboardingSettings {
  verbLegendSeen: boolean;
  contextHints: ContextHintSettings;
}

export interface ClientSettings {
  version: 1;
  feedback: FeedbackSettings;
  rendering: RenderingSettings;
  onboarding: OnboardingSettings;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_SETTINGS: Readonly<ClientSettings> = Object.freeze({
  version: 1,
  feedback: Object.freeze({
    damageNumbers: "all",
    damageNumberStyle: "detailed",
    damageNumberScale: 1,
    hitConfirmAudio: true,
    confirmVolume: 1,
    hitSparks: true,
    screenShake: 1,
    hitStop: true,
    flashes: "full",
    colorblindAssist: "off",
  }),
  rendering: Object.freeze({
    renderScale: "auto",
  }),
  onboarding: Object.freeze({
    verbLegendSeen: false,
    contextHints: Object.freeze({
      beamOverheat: 0,
      juggle: 0,
      ultimateReady: 0,
      lavaGapFall: 0,
      empoweredReturn: 0,
    }),
  }),
});

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDefaults(): ClientSettings {
  return {
    version: 1,
    feedback: { ...DEFAULT_SETTINGS.feedback },
    rendering: { ...DEFAULT_SETTINGS.rendering },
    onboarding: {
      ...DEFAULT_SETTINGS.onboarding,
      contextHints: { ...DEFAULT_SETTINGS.onboarding.contextHints },
    },
  };
}

function numberScale(value: unknown): DamageNumberScale {
  const allowed: readonly DamageNumberScale[] = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
  return allowed.includes(value as DamageNumberScale) ? (value as DamageNumberScale) : 1;
}

function shakeScale(value: unknown): ScreenShakeScale {
  return value === 0 || value === 0.5 || value === 1 ? value : 1;
}

function confirmVolume(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1.5, value))
    : 1;
}

function hintCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(2, Math.floor(value)))
    : 0;
}

export function sanitizeSettings(value: unknown): ClientSettings {
  if (!isRecord(value) || value.version !== 1) return cloneDefaults();
  const raw = isRecord(value.feedback) ? value.feedback : {};
  const rawRendering = isRecord(value.rendering) ? value.rendering : {};
  const rawOnboarding = isRecord(value.onboarding) ? value.onboarding : {};
  const rawContextHints = isRecord(rawOnboarding.contextHints) ? rawOnboarding.contextHints : {};
  return {
    version: 1,
    feedback: {
      damageNumbers:
        raw.damageNumbers === "all" || raw.damageNumbers === "own" || raw.damageNumbers === "off"
          ? raw.damageNumbers
          : "all",
      damageNumberStyle:
        raw.damageNumberStyle === "aggregate" || raw.damageNumberStyle === "detailed"
          ? raw.damageNumberStyle
          : "detailed",
      damageNumberScale: numberScale(raw.damageNumberScale),
      hitConfirmAudio: typeof raw.hitConfirmAudio === "boolean" ? raw.hitConfirmAudio : true,
      confirmVolume: confirmVolume(raw.confirmVolume),
      hitSparks: typeof raw.hitSparks === "boolean" ? raw.hitSparks : true,
      screenShake: shakeScale(raw.screenShake),
      hitStop: typeof raw.hitStop === "boolean" ? raw.hitStop : true,
      flashes: raw.flashes === "reduced" || raw.flashes === "full" ? raw.flashes : "full",
      colorblindAssist: raw.colorblindAssist === "shapes" ? "shapes" : "off",
    },
    rendering: {
      renderScale:
        rawRendering.renderScale === "native" || rawRendering.renderScale === "performance"
          ? rawRendering.renderScale
          : "auto",
    },
    onboarding: {
      verbLegendSeen:
        typeof rawOnboarding.verbLegendSeen === "boolean" ? rawOnboarding.verbLegendSeen : false,
      contextHints: {
        beamOverheat: hintCount(rawContextHints.beamOverheat),
        juggle: hintCount(rawContextHints.juggle),
        ultimateReady: hintCount(rawContextHints.ultimateReady),
        lavaGapFall: hintCount(rawContextHints.lavaGapFall),
        empoweredReturn: hintCount(rawContextHints.empoweredReturn),
      },
    },
  };
}

function mergeRecords(base: UnknownRecord, patch: UnknownRecord): UnknownRecord {
  const result: UnknownRecord = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const previous = result[key];
    result[key] = isRecord(previous) && isRecord(value) ? mergeRecords(previous, value) : value;
  }
  return result;
}

function knownFields(settings: ClientSettings): UnknownRecord {
  return {
    version: settings.version,
    feedback: { ...settings.feedback },
    rendering: { ...settings.rendering },
    onboarding: {
      ...settings.onboarding,
      contextHints: { ...settings.onboarding.contextHints },
    },
  };
}

/**
 * Small injectable store used by the singleton below and by unit tests. Failed storage reads/writes
 * degrade to an in-memory copy; valid unknown fields remain in the serialized object for forward compat.
 */
export class SettingsStore {
  private current = cloneDefaults();
  private raw: UnknownRecord = knownFields(this.current);
  private loaded = false;
  private memoryRaw: string | null = null;
  private readonly listeners = new Set<(settings: ClientSettings) => void>();

  constructor(private readonly storage?: SettingsStorage) {}

  load(): ClientSettings {
    if (this.loaded) return this.current;
    this.loaded = true;
    let serialized = this.memoryRaw;
    try {
      serialized = this.storage?.getItem(SETTINGS_STORAGE_KEY) ?? serialized;
    } catch {
      // Private browsing and hardened embeds may reject storage access.
    }
    if (serialized !== null) {
      try {
        const parsed: unknown = JSON.parse(serialized);
        if (isRecord(parsed)) this.raw = parsed;
      } catch {
        this.raw = knownFields(this.current);
      }
    }
    this.current = sanitizeSettings(this.raw);
    this.raw = mergeRecords(this.raw, knownFields(this.current));
    return this.current;
  }

  update(patch: DeepPartial<ClientSettings>): ClientSettings {
    this.load();
    this.raw = mergeRecords(this.raw, patch as UnknownRecord);
    this.current = sanitizeSettings(this.raw);
    this.raw = mergeRecords(this.raw, knownFields(this.current));
    this.memoryRaw = JSON.stringify(this.raw);
    try {
      this.storage?.setItem(SETTINGS_STORAGE_KEY, this.memoryRaw);
    } catch {
      // Keep the in-memory value active even when persistence is unavailable.
    }
    for (const listener of this.listeners) listener(this.current);
    return this.current;
  }

  subscribe(listener: (settings: ClientSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function browserStorage(): SettingsStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

const singleton = new SettingsStore(browserStorage());

export function loadSettings(): ClientSettings {
  return singleton.load();
}

export function updateSettings(patch: DeepPartial<ClientSettings>): ClientSettings {
  return singleton.update(patch);
}

export function onSettingsChange(listener: (settings: ClientSettings) => void): () => void {
  return singleton.subscribe(listener);
}
