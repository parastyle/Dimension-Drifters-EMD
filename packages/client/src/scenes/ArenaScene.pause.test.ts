import { describe, expect, it } from "vitest";
import { resolvePauseFrame } from "./arena/pause-control.js";

describe("ArenaScene B62 pause input behavior", () => {
  it("requests a vote on live Escape without predicting a pause or blocking gameplay", () => {
    expect(
      resolvePauseFrame({
        authoritativePaused: false,
        escapePressed: true,
        modalBlocking: false,
        localConfirmed: false,
      }),
    ).toEqual({ voteIntent: "confirm", blockGameplay: false });
  });

  it("keeps multiplayer gameplay live while a local confirmation is pending", () => {
    expect(
      resolvePauseFrame({
        authoritativePaused: false,
        escapePressed: false,
        modalBlocking: false,
        localConfirmed: true,
      }),
    ).toEqual({ voteIntent: null, blockGameplay: false });
    expect(
      resolvePauseFrame({
        authoritativePaused: false,
        escapePressed: true,
        modalBlocking: false,
        localConfirmed: true,
      }),
    ).toEqual({ voteIntent: "cancel", blockGameplay: false });
  });

  it("blocks only an authoritative pause and lets Escape request a resume", () => {
    expect(
      resolvePauseFrame({
        authoritativePaused: true,
        escapePressed: false,
        modalBlocking: false,
        localConfirmed: true,
      }),
    ).toEqual({ voteIntent: null, blockGameplay: true });
    expect(
      resolvePauseFrame({
        authoritativePaused: true,
        escapePressed: true,
        modalBlocking: false,
        localConfirmed: true,
      }),
    ).toEqual({ voteIntent: "cancel", blockGameplay: true });
  });

  it("never steals Escape from an open gameplay modal while the game is live", () => {
    expect(
      resolvePauseFrame({
        authoritativePaused: false,
        escapePressed: true,
        modalBlocking: true,
        localConfirmed: false,
      }),
    ).toEqual({ voteIntent: null, blockGameplay: false });
  });
});
