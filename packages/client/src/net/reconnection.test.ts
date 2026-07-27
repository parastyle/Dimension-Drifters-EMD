import { describe, expect, it } from "vitest";
import {
  clearReconnectReservation,
  loadReconnectReservation,
  parseReconnectProbeResult,
  RECONNECT_SESSION_KEY,
  reconnectDelayMs,
  reconnectValidationFailure,
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

  it("accepts only a matching active, simulated room with its player and authoritative runtime", () => {
    const reservation = { token: "room:token", roomId: "room", runId: "run_1" };
    const probe = parseReconnectProbeResult(
      {
        requestId: "probe-1",
        ok: true,
        reason: "",
        roomId: "room",
        sessionId: "player",
        runId: "run_1",
        isHost: true,
      },
      "probe-1",
    );
    expect(probe).toBeDefined();
    if (!probe) throw new Error("valid probe fixture was rejected");
    const valid = {
      reservation,
      probe,
      roomId: "room",
      sessionId: "player",
      schemaVersion: 51,
      expectedSchemaVersion: 51,
      tick: 10,
      outcome: "active",
      hasPlayer: true,
    };
    expect(reconnectValidationFailure(valid)).toBeUndefined();
    expect(reconnectValidationFailure({ ...valid, outcome: "defeat" })).toBe("run-not-active");
    expect(reconnectValidationFailure({ ...valid, hasPlayer: false })).toBe("player-missing");
    expect(
      reconnectValidationFailure({
        ...valid,
        probe: { ...probe, ok: false, reason: "solo-host-lost" },
      }),
    ).toBe("solo-host-lost");
  });

  it("rejects malformed, stale, and cross-room probe replies", () => {
    expect(parseReconnectProbeResult({ requestId: "wrong" }, "probe-2")).toBeUndefined();
    const reservation = { token: "room:token", roomId: "room", runId: "run_1" };
    const probe = {
      requestId: "probe-2",
      ok: true,
      reason: "",
      roomId: "other",
      sessionId: "player",
      runId: "run_1",
      isHost: true,
    };
    expect(
      reconnectValidationFailure({
        reservation,
        probe,
        roomId: "other",
        sessionId: "player",
        schemaVersion: 51,
        expectedSchemaVersion: 51,
        tick: 10,
        outcome: "active",
        hasPlayer: true,
      }),
    ).toBe("wrong-room");
  });
});
