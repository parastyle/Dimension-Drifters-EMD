import { describe, expect, it } from "vitest";
import {
  clearReconnectReservation,
  loadReconnectReservation,
  RECONNECT_SESSION_KEY,
  reconnectDelayMs,
  saveReconnectReservation,
} from "./reconnection.js";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("session reconnection reservation", () => {
  it("round-trips the token, room, and run and clears only the expected token", () => {
    const storage = memoryStorage();
    const reservation = { token: "room:token", roomId: "room", runId: "run_1" };
    saveReconnectReservation(reservation, storage);
    expect(loadReconnectReservation(storage)).toEqual(reservation);

    clearReconnectReservation("other", storage);
    expect(loadReconnectReservation(storage)).toEqual(reservation);
    clearReconnectReservation(reservation.token, storage);
    expect(storage.values.has(RECONNECT_SESSION_KEY)).toBe(false);
  });

  it("rejects malformed persisted data and bounds capped jitter", () => {
    const storage = memoryStorage();
    storage.setItem(RECONNECT_SESSION_KEY, '{"token":"","roomId":"room","runId":"run"}');
    expect(loadReconnectReservation(storage)).toBeUndefined();
    expect(reconnectDelayMs(0, () => 0)).toBe(188);
    expect(reconnectDelayMs(20, () => 1)).toBe(4_000);
  });
});
