import {
  type ArenaMap,
  type BeltLevel,
  clampBeltFloorY,
  GROUND_EPSILON,
  INTERP_SNAP_PLAYER,
  JUMP_BUFFER_SECONDS,
  JUMP_COOLDOWN,
  JUMP_VELOCITY,
  PLAYER_RADIUS,
  PRED_ERR_DECAY,
  PRED_PENDING_MAX,
  resolveBeltObstacles,
  resolvePoiCollision,
  stepImpulse,
  stepSteeredMovement,
  stepVertical,
  TICK_MS,
} from "@dd/shared";

/**
 * §4 v0.107 CLIENT-SIDE PREDICTION for the local player (docs/NETCODE_DESIGN.md is the binding spec).
 *
 * PURE module — no Phaser, no Colyseus imports — so the whole reconciliation loop is unit-testable in
 * node against a mock server running the SAME shared steppers. ArenaScene owns the wiring: it mints one
 * sequence-numbered command per 50ms, sends it, feeds it to `tick()`, applies `reconcile()` on every
 * patch, and renders `renderPos()` each frame.
 *
 * Model (per the adversarially-reviewed design):
 * - HORIZONTAL is predicted + reconciled: each patch is tick-locked server truth for the tick that
 *   consumed `ackSeq`, so we REBASE (adopt x/y + steering mv + impulse v — all synced) and REPLAY the
 *   still-pending commands with exact 50ms steps. Player-player pushes/knockback arriving mid-window
 *   surface as a small residual that GLIDES out through a decaying error offset (never pops); anything
 *   teleport-sized (or a `teleportSeq` bump — the server bumps it inside zeroMoveVel at every teleport
 *   site) hard-snaps.
 * - VERTICAL is predicted LOCALLY and only ADOPTED on divergence: jumps are deterministic off the
 *   command stream (buffer/cooldown mirrored from the shared constants), so reconciliation rebases at
 *   the server's acked height/vh and replays every pending jump step. Only a residual beyond the height
 *   threshold hard-snaps (a denied jump / parry-launch we didn't predict).
 * - Prediction PAUSES (and hard-resyncs) while dead or frozen in the level-up window — the server
 *   doesn't move us then, and it zeroes our steering velocity on the freeze edge.
 */

/** One minted input command — the client-side twin of the server's InputCmd. */
export interface PredCmd {
  seq: number;
  dx: number;
  dy: number;
  jump: boolean;
}

/** The slice of the synced PlayerState the predictor needs each patch (kept structural so tests can
 *  feed plain objects and ArenaScene can pass the schema row directly). */
export interface ServerView {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
  height: number;
  vh: number;
  ackSeq: number;
  teleportSeq: number;
  alive: boolean;
  /** §12 level-window freeze (flexPending>0 || sigPending>0) — movement is server-paused. */
  frozen: boolean;
}

interface PredState {
  x: number;
  y: number;
  mvx: number;
  mvy: number;
  vx: number;
  vy: number;
}

/** A pending command plus the local jump-control state immediately before its tick. The server does not
 * sync cooldown/buffer timers, so retaining this deterministic rebase point lets reconciliation replay
 * the exact buffered-jump phase over an authoritative height/vh without mistaking an un-acked hop for
 * divergence. */
interface PendingPredCmd extends PredCmd {
  jumpCdBefore: number;
  jumpBufBefore: number;
}

interface PredVerticalState {
  height: number;
  vh: number;
  jumpCd: number;
  jumpBuf: number;
}

const DT = TICK_MS / 1000;

/** Height divergence (px) beyond which the local vertical prediction adopts the server's arc. */
const HEIGHT_ADOPT_PX = 12;

/** One vertical sim step in the server's phase order: latch this command's jump intent, age timers,
 * trigger a buffered grounded jump when eligible, then integrate the shared height physics. */
function stepPredictedVertical(
  s: PredVerticalState,
  jump: boolean,
  dt: number,
): PredVerticalState {
  const jumpCd = Math.max(0, s.jumpCd - dt);
  let jumpBuf = s.jumpBuf;
  if (jump) jumpBuf = JUMP_BUFFER_SECONDS;
  jumpBuf = Math.max(0, jumpBuf - dt);
  let vh = s.vh;
  let nextJumpCd = jumpCd;
  if (jumpBuf > 0 && jumpCd <= 0 && s.height <= GROUND_EPSILON) {
    vh = JUMP_VELOCITY;
    nextJumpCd = JUMP_COOLDOWN;
    jumpBuf = 0;
  }
  const vert = stepVertical(s.height, vh, dt);
  return {
    height: vert.height,
    vh: vert.vh,
    jumpCd: nextJumpCd,
    jumpBuf,
  };
}

/** One horizontal sim step — the same phase order as the server's movement block: steer+integrate+clamp,
 *  impulse on top, POI pushout. NOT replicated (server-only, corrections absorb them): pit teleports
 *  (teleportSeq hard-snap) and player-player BODY collisions — under sustained mutual contact the
 *  ~16px/patch pushout correction converges to a STABLE self-view offset of roughly 35-70px into the
 *  other player (no jitter/oscillation; verified by the adversarial review). Acceptable for co-op PvE;
 *  a predicted push-out against remote snapshot positions is the follow-up if it reads badly in play. */
function stepHorizontal(
  s: PredState,
  dx: number,
  dy: number,
  dt: number,
  map?: ArenaMap,
  belt?: BeltLevel,
): PredState {
  const moved = stepSteeredMovement({ x: s.x, y: s.y }, { vx: s.mvx, vy: s.mvy }, { dx, dy }, dt);
  const imp = stepImpulse(moved, { vx: s.vx, vy: s.vy }, dt);
  let x = imp.x;
  let y = imp.y;
  if (belt) {
    // §29 belt: route out of deck obstacles + clamp DEPTH to the authored floor profile (mirrors the
    // server's belt collision so local prediction lands where the server puts you — no edge rubber-band).
    const o = resolveBeltObstacles(belt, x, y, PLAYER_RADIUS);
    x = o.x;
    y = clampBeltFloorY(belt, o.x, o.y, PLAYER_RADIUS);
  } else if (map) {
    const r = resolvePoiCollision(map, x, y, PLAYER_RADIUS);
    x = r.x;
    y = r.y;
  }
  return { x, y, mvx: moved.vx, mvy: moved.vy, vx: imp.vx, vy: imp.vy };
}

export class SelfPredictor {
  private pred: PredState;
  private readonly pending: PendingPredCmd[] = [];
  private map?: ArenaMap;
  /** §29 belt level (floor profile + obstacles) — when set, prediction uses belt collision, not POI. */
  private belt?: BeltLevel;
  private lastTeleportSeq: number;
  /** Visual error offset — reconciliation corrections land here and decay (glide, don't pop). */
  private errX = 0;
  private errY = 0;
  /** Set when the pending buffer overflows (a stall) — forces a hard resync on the next patch. */
  private needResync = false;
  /** True while dead/frozen — prediction pauses and renders server truth directly. */
  private paused = false;
  /** True while the connection has STALLED (pending overflowed with no ack) — the predictor FREEZES
   *  (stops advancing; dead-reckoning seconds into the dark is worse than holding still) and the scene
   *  shows a connection hint; the next patch hard-resyncs and clears it (review amendment #13). */
  private stalled = false;

  // Vertical (local-first, adopt-on-divergence).
  private height: number;
  private vh: number;
  private jumpCd = 0;
  private jumpBuf = 0;

  /** Last minted command seq (the scene increments through `mintCmd`). */
  private seq = 0;

  constructor(server: ServerView) {
    this.pred = {
      x: server.x,
      y: server.y,
      mvx: server.mvx,
      mvy: server.mvy,
      vx: server.vx,
      vy: server.vy,
    };
    this.height = server.height;
    this.vh = server.vh;
    this.lastTeleportSeq = server.teleportSeq;
    this.paused = !server.alive || server.frozen;
  }

  /** The client-side arena map (regenerated from synced seeds) — enables predicted POI collision. Swap
   *  it on a rift descent BEFORE the next reconcile so the replay pushes out of the NEW map's landmarks. */
  setMap(map: ArenaMap | undefined): void {
    this.map = map;
  }

  /** §29 set the belt level so prediction uses the authored floor/obstacle collision (not POI). */
  setBeltLevel(level: BeltLevel | undefined): void {
    this.belt = level;
  }

  /** Mint the next sequence-numbered command from this frame's sampled input. */
  mintCmd(dx: number, dy: number, jump: boolean): PredCmd {
    this.seq = (this.seq + 1) >>> 0;
    return { seq: this.seq, dx, dy, jump };
  }

  /** Advance one exact 50ms predicted tick with `cmd` (the scene sends the same cmd to the server). */
  tick(cmd: PredCmd): void {
    if (this.paused || this.stalled) return; // dead/frozen/stalled — don't advance into the dark
    this.pred = stepHorizontal(this.pred, cmd.dx, cmd.dy, DT, this.map, this.belt);
    const pending: PendingPredCmd = {
      ...cmd,
      jumpCdBefore: this.jumpCd,
      jumpBufBefore: this.jumpBuf,
    };
    const vert = stepPredictedVertical(
      {
        height: this.height,
        vh: this.vh,
        jumpCd: this.jumpCd,
        jumpBuf: this.jumpBuf,
      },
      cmd.jump,
      DT,
    );
    this.height = vert.height;
    this.vh = vert.vh;
    this.jumpCd = vert.jumpCd;
    this.jumpBuf = vert.jumpBuf;
    this.pending.push(pending);
    if (this.pending.length > PRED_PENDING_MAX) {
      this.pending.shift();
      // The connection STALLED (~3.2s of un-acked commands): FREEZE prediction (tick() short-circuits
      // from now on) and rebase hard when truth next arrives — amendment #13.
      this.needResync = true;
      this.stalled = true;
    }
  }

  /** Reconcile against a fresh patch (call from room.onStateChange — data only, never touch rigs here). */
  reconcile(server: ServerView): void {
    const teleported = server.teleportSeq !== this.lastTeleportSeq;
    this.lastTeleportSeq = server.teleportSeq;
    const pauseNow = !server.alive || server.frozen;

    // Trim everything the server has consumed — WRAP-AWARE (uint32 delta space, matching the server's
    // monotonic gate): `seq ≤ ack` ⇔ the uint32 forward distance from seq to ack is < 2³¹.
    const acked = (s: number) => (server.ackSeq - s) >>> 0 < 0x80000000;
    while (this.pending.length > 0 && acked((this.pending[0] as PredCmd).seq)) {
      this.pending.shift();
    }

    // Where the player is DRAWN right now (pred + offset) — corrections preserve this, then glide.
    const visX = this.pred.x + this.errX;
    const visY = this.pred.y + this.errY;

    // REBASE from synced truth (tick-locked: this is the state of the tick that consumed ackSeq).
    this.pred = {
      x: server.x,
      y: server.y,
      mvx: server.mvx,
      mvy: server.mvy,
      vx: server.vx,
      vy: server.vy,
    };

    if (teleported || this.needResync || pauseNow || this.paused) {
      // HARD RESYNC family — but the error-offset treatment differs by CAUSE (amendment #14):
      // - a TELEPORT / stall recovery SNAPS (a rift/pit/restart is a cut, not a glide): err = 0;
      // - ENTERING a freeze (level window / down) FOLDS the visual lead into the offset so the rig
      //   GLIDES back under the level-up UI (~⅓s decay) instead of popping backward by ~RTT×speed;
      // - mid-freeze reconciles PRESERVE the decaying offset (re-zeroing would undo the fold).
      const enteringPause = pauseNow && !this.paused;
      if (teleported || this.needResync) {
        this.errX = 0;
        this.errY = 0;
      } else if (enteringPause) {
        this.errX = visX - server.x;
        this.errY = visY - server.y;
        if (Math.hypot(this.errX, this.errY) > INTERP_SNAP_PLAYER) {
          this.errX = 0;
          this.errY = 0;
        }
      }
      // else: staying paused / resuming — keep the (already-decayed) offset as-is.
      this.pending.length = 0;
      this.needResync = false;
      this.stalled = false; // truth arrived — the stall (if any) is over
      this.height = server.height;
      this.vh = server.vh;
      this.jumpBuf = 0;
      this.paused = pauseNow;
      return;
    }

    // REPLAY the still-pending window (exact 50ms steps — the server integrates the same way).
    // Vertical starts at the acked authoritative height/vh, not the already-predicted tip of the arc:
    // otherwise a normal pre-jump patch sees the first ~15px hop as divergence and eats it.
    let replayVert: PredVerticalState = {
      height: server.height,
      vh: server.vh,
      jumpCd: this.pending[0]?.jumpCdBefore ?? this.jumpCd,
      jumpBuf: this.pending[0]?.jumpBufBefore ?? this.jumpBuf,
    };
    for (const cmd of this.pending) {
      this.pred = stepHorizontal(this.pred, cmd.dx, cmd.dy, DT, this.map, this.belt);
      replayVert = stepPredictedVertical(replayVert, cmd.jump, DT);
    }

    // Fold the correction into the error offset so it GLIDES out; teleport-sized error snaps.
    this.errX = visX - this.pred.x;
    this.errY = visY - this.pred.y;
    if (Math.hypot(this.errX, this.errY) > INTERP_SNAP_PLAYER) {
      this.errX = 0;
      this.errY = 0;
    }

    // Vertical: only a residual AFTER authoritative rebase + pending replay is real divergence (a denied
    // jump / an unpredicted launch). Adopt the replayed present, never the older acked-tick height.
    if (Math.abs(replayVert.height - this.height) > HEIGHT_ADOPT_PX) {
      this.height = replayVert.height;
      this.vh = replayVert.vh;
    }
  }

  /** Fold an external visual displacement into the error offset so it GLIDES out instead of popping —
   *  used when a hit-stop freeze lifts (the predictor kept ticking; the rig didn't move — review #11). */
  foldError(dx: number, dy: number): void {
    this.errX += dx;
    this.errY += dy;
    if (Math.hypot(this.errX, this.errY) > INTERP_SNAP_PLAYER) {
      this.errX = 0;
      this.errY = 0;
    }
  }

  /** Decay the visual error offset (call once per render frame). */
  decayError(dtSec: number): void {
    const k = Math.exp(-PRED_ERR_DECAY * dtSec);
    this.errX *= k;
    this.errY *= k;
    if (Math.abs(this.errX) + Math.abs(this.errY) < 0.5) {
      this.errX = 0;
      this.errY = 0;
    }
  }

  /**
   * The position to DRAW this frame: the last predicted tick advanced by the fractional frame time as a
   * PURE preview (recomputed from `pred` each frame, never accumulated — review #8: position integration
   * doesn't compose across sub-steps, so the preview must always be one single partial step), plus the
   * decaying error offset. `sinceTickSec` ∈ [0, 50ms].
   */
  renderPos(
    dx: number,
    dy: number,
    sinceTickSec: number,
  ): { x: number; y: number; height: number } {
    if (this.paused || this.stalled) {
      // Frozen (level window / down) or stalled: hold at server truth PLUS the decaying offset — the
      // pause-entry fold (amendment #14) glides the pre-freeze visual lead out under the level-up UI
      // instead of snapping the rig backward by ~RTT×speed.
      return { x: this.pred.x + this.errX, y: this.pred.y + this.errY, height: this.height };
    }
    const frac = Math.min(Math.max(sinceTickSec, 0), DT);
    const p = frac > 0 ? stepHorizontal(this.pred, dx, dy, frac, this.map, this.belt) : this.pred;
    const vert =
      frac > 0 ? stepVertical(this.height, this.vh, frac) : { height: this.height, vh: 0 };
    return { x: p.x + this.errX, y: p.y + this.errY, height: vert.height };
  }

  /** Force a hard resync on the next patch — the scene calls this after a >250ms frame gap (a
   *  throttled-tab wake), mirroring the server's own stall posture (amendment #12). */
  forceResync(): void {
    this.needResync = true;
  }

  /** True while prediction is paused (dead / level-window freeze) — the scene renders server truth. */
  get isPaused(): boolean {
    return this.paused;
  }

  /** True while the connection has stalled (pending overflow, no ack) — the scene shows a lag hint. */
  get isStalled(): boolean {
    return this.stalled;
  }

  /** Diagnostics for the debug HUD + live verification: pending depth + current error magnitude. */
  get stats(): { pending: number; errPx: number } {
    return { pending: this.pending.length, errPx: Math.hypot(this.errX, this.errY) };
  }
}
