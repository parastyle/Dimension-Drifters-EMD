export const RECONNECT_SESSION_KEY = "dd.reconnect.v1";

export interface ReconnectReservation {
  readonly token: string;
  readonly roomId: string;
  readonly runId: string;
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
