export type PauseVoteIntent = "confirm" | "cancel" | null;

export interface PauseFrameInput {
  readonly authoritativePaused: boolean;
  readonly escapePressed: boolean;
  readonly modalBlocking: boolean;
  readonly localConfirmed: boolean;
}

export interface PauseFrameDecision {
  readonly voteIntent: PauseVoteIntent;
  readonly blockGameplay: boolean;
}

/**
 * Route the pause key without predicting authority.
 *
 * A pending multiplayer vote never blocks gameplay. Only the synced `paused` bit can halt client input,
 * and a modal owns Escape before pause voting does.
 */
export function resolvePauseFrame(input: PauseFrameInput): PauseFrameDecision {
  if (input.authoritativePaused) {
    return {
      voteIntent: input.escapePressed ? "cancel" : null,
      blockGameplay: true,
    };
  }
  if (!input.escapePressed || input.modalBlocking) {
    return { voteIntent: null, blockGameplay: false };
  }
  return {
    voteIntent: input.localConfirmed ? "cancel" : "confirm",
    blockGameplay: false,
  };
}
