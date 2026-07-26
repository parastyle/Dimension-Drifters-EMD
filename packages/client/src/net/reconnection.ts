export const RECONNECT_SESSION_KEY = "dd.reconnect.v1";

export interface ReconnectReservation {
  readonly token: string;
  readonly roomId: string;
  readonly runId: string;
}

export interface ReconnectProbeResult {
  readonly requestId: string;
  readonly ok: boolean;
  readonly reason: string;
  readonly roomId: string;
  readonly sessionId: string;
  readonly runId: string;
  readonly isHost: boolean;
}

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function currentSessionStorage(): SessionStorageLike | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maxLength && (allowEmpty || value.length > 0);
}

export function parseReconnectProbeResult(
  value: unknown,
  expectedRequestId: string,
): ReconnectProbeResult | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const probe = value as Partial<ReconnectProbeResult>;
  if (
    probe.requestId !== expectedRequestId ||
    typeof probe.ok !== "boolean" ||
    !isBoundedString(probe.reason, 64, true) ||
    !isBoundedString(probe.roomId, 128) ||
    !isBoundedString(probe.sessionId, 128) ||
    !isBoundedString(probe.runId, 64, true) ||
    typeof probe.isHost !== "boolean"
  ) {
    return undefined;
  }
  return {
    requestId: probe.requestId,
    ok: probe.ok,
    reason: probe.reason,
    roomId: probe.roomId,
    sessionId: probe.sessionId,
    runId: probe.runId,
    isHost: probe.isHost,
  };
}

export function reconnectValidationFailure(options: {
  readonly reservation: ReconnectReservation;
  readonly probe: ReconnectProbeResult;
  readonly roomId: string;
  readonly sessionId: string;
  readonly schemaVersion: number;
  readonly expectedSchemaVersion: number;
  readonly tick: number;
  readonly outcome: string;
  readonly hasPlayer: boolean;
}): string | undefined {
  const { reservation, probe } = options;
  if (options.roomId !== reservation.roomId || probe.roomId !== reservation.roomId)
    return "wrong-room";
  if (probe.sessionId !== options.sessionId) return "wrong-session";
  if (options.schemaVersion !== options.expectedSchemaVersion) return "schema-mismatch";
  if (options.tick <= 0) return "simulation-not-ready";
  if (!options.hasPlayer) return "player-missing";
  if (options.outcome !== "active") return "run-not-active";
  if (!probe.ok) return probe.reason || "server-refused";
  if (reservation.runId && probe.runId !== reservation.runId) return "wrong-run";
  return undefined;
}

export function loadReconnectReservation(
  storage: SessionStorageLike | undefined = currentSessionStorage(),
): ReconnectReservation | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(RECONNECT_SESSION_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<ReconnectReservation>;
    if (
      !isBoundedString(value.token, 256) ||
      !isBoundedString(value.roomId, 128) ||
      !isBoundedString(value.runId, 64, true)
    ) {
      return undefined;
    }
    return { token: value.token, roomId: value.roomId, runId: value.runId };
  } catch {
    return undefined;
  }
}

export function saveReconnectReservation(
  reservation: ReconnectReservation,
  storage: SessionStorageLike | undefined = currentSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(RECONNECT_SESSION_KEY, JSON.stringify(reservation));
  } catch {
    // Storage policy/quota must not break the live room; same-page reconnect still uses the in-memory token.
  }
}

export function clearReconnectReservation(
  expectedToken?: string,
  storage: SessionStorageLike | undefined = currentSessionStorage(),
): void {
  if (!storage) return;
  try {
    if (expectedToken) {
      const current = loadReconnectReservation(storage);
      if (current && current.token !== expectedToken) return;
    }
    storage.removeItem(RECONNECT_SESSION_KEY);
  } catch {
    // Best-effort cleanup for restricted browser storage.
  }
}

/** Exponential retry capped at four seconds with ±25% jitter. */
export function reconnectDelayMs(attempt: number, random = Math.random): number {
  const base = Math.min(4_000, 250 * 2 ** Math.max(0, Math.floor(attempt)));
  const jitter = 0.75 + Math.min(1, Math.max(0, random())) * 0.5;
  return Math.min(4_000, Math.round(base * jitter));
}
