import { getDimension, ROOM_NAME } from "@dd/shared";
import type { Client as ColyseusClient, Room } from "colyseus.js";

/**
 * §50 first-session finding #1 — the menu's chosen run is an honest MATCHMAKING CONTRACT.
 *
 * The server already filters matchmaking by the creation options (`index.ts`:
 * `filterBy(["belt", "beltLevel", "dimensionId", "bossRush"])`), so `joinOrCreate` can only ever match a
 * room CREATED with the same pick. This module closes the two client-side gaps that remained:
 *
 *  1. INTENT — the menu now distinguishes QUICK JOIN (share a matching live run, or start one) from
 *     HOST NEW (always mint a fresh room). ArenaScene's connect path is owned elsewhere and always calls
 *     `client.joinOrCreate(ROOM_NAME, …)`, so the intent is applied here by wrapping that one method:
 *     MenuScene arms `setLaunchIntent()` + `installMatchmakingContract()` before starting the arena.
 *
 *  2. TRUTH ON ARRIVAL — filterBy compares CREATION-time options, but a live run's dimension advances on
 *     every rift descent (`ArenaState.dimensionId`/`depth` move on; the listing doesn't). A quick-joiner
 *     asking for dimension A can therefore legitimately land in a matching room that has since descended
 *     to dimension C at depth 3. On the first synced state we compare the room's reality against the
 *     request and show a short DOM toast: verb (hosting/joined/started), mode, dimension, depth, drifter
 *     count — plus an explicit amber notice when the request was overridden, so a "wrong" world is
 *     disclosed instead of read as a bug. (In-canvas HUD is ArenaScene-owned; the toast is the same
 *     external-DOM surface as the existing `#status` line.)
 *
 * Everything below the install seam is pure + unit-tested (`matchmaking.test.ts`).
 */

export type LaunchIntent = "quick" | "host";

/** What the player actually asked the matchmaker for (normalized from the raw join options). */
export interface RunRequest {
  dimensionId?: string;
  bossRush: boolean;
  belt: boolean;
}

/** One line of the arrival report. `warn` lines mean the joined room differs from the request. */
export interface ArrivalLine {
  kind: "headline" | "info" | "warn";
  text: string;
}

const TOAST_ID = "dd-join-contract";

let launchIntent: LaunchIntent = "quick";

/** MenuScene calls this at launch; the value persists across ArenaScene's connect retries. */
export function setLaunchIntent(intent: LaunchIntent): void {
  launchIntent = intent;
}

export function getLaunchIntent(): LaunchIntent {
  return launchIntent;
}

/** Normalize untyped join options into the request contract (trust nothing — options is wire-shaped). */
export function readRunRequest(options: unknown): RunRequest {
  const o = (options ?? {}) as Record<string, unknown>;
  return {
    dimensionId: typeof o.dimensionId === "string" && o.dimensionId ? o.dimensionId : undefined,
    bossRush: o.bossRush === true,
    belt: o.belt === true,
  };
}

/** Build the arrival report from the FIRST synced state vs the request. Pure — state is read defensively
 *  (structural, no schema import) so it works against any ArenaState-shaped object. */
export function buildArrivalReport(
  state: unknown,
  requested: RunRequest,
  intent: LaunchIntent,
): ArrivalLine[] {
  const s = (state ?? {}) as {
    dimensionId?: unknown;
    depth?: unknown;
    mode?: unknown;
    players?: { size?: unknown };
  };
  const actualDim = getDimension(
    typeof s.dimensionId === "string" && s.dimensionId ? s.dimensionId : requested.dimensionId,
  );
  const requestedDim = getDimension(requested.dimensionId);
  const depth = typeof s.depth === "number" && s.depth > 0 ? s.depth : 1;
  const drifters = typeof s.players?.size === "number" && s.players.size > 0 ? s.players.size : 1;
  const mode = typeof s.mode === "string" ? s.mode : "arena";
  const actualBossRush = mode === "bossrush";

  const modeLabel = actualBossRush
    ? "BOSS RUSH"
    : requested.belt
      ? `BELT — ${actualDim.name.toUpperCase()}`
      : actualDim.name.toUpperCase();
  // "STARTED" when we're alone in the room (we created it or everyone left); "JOINED" when the run is
  // already inhabited — the player should never have to guess which happened.
  const verb = intent === "host" ? "HOSTING" : drifters > 1 ? "JOINED" : "STARTED";
  const lines: ArrivalLine[] = [{ kind: "headline", text: `${verb} — ${modeLabel}` }];
  lines.push({
    kind: "info",
    text: `depth ${depth} · ${drifters} drifter${drifters === 1 ? "" : "s"}${
      mode === "training" ? " · TRAINING GROUNDS" : ""
    }`,
  });

  // Mode mismatch should be impossible while the server filters on `bossRush` — kept as a loud tripwire
  // so a future filter regression is disclosed to the player instead of silently mislabeling the run.
  if (requested.bossRush !== actualBossRush) {
    lines.push({
      kind: "warn",
      text: requested.bossRush
        ? "You picked BOSS RUSH — this room is a survival run."
        : "You picked a survival run — this room is BOSS RUSH.",
    });
  }

  // The honest-drift case: the room was CREATED with your pick but the squad has since descended.
  if (
    !requested.belt &&
    !requested.bossRush &&
    !actualBossRush &&
    requested.dimensionId !== undefined &&
    requestedDim.id !== actualDim.id
  ) {
    lines.push({
      kind: "warn",
      text:
        `You picked ${requestedDim.name} — this live run has already descended to ` +
        `${actualDim.name} (depth ${depth}). QUICK JOIN matches a run by its starting pick; ` +
        `HOST NEW RUN always starts fresh.`,
    });
  }
  return lines;
}

/** Render the arrival report as a transient top-center DOM toast (mirrors the external `#status` surface —
 *  the in-canvas HUD belongs to ArenaScene). Warn lines hold longer and tint the border amber. */
function showArrivalToast(lines: ArrivalLine[]): void {
  if (typeof document === "undefined" || !document.body) return;
  document.getElementById(TOAST_ID)?.remove();
  const hasWarn = lines.some((l) => l.kind === "warn");
  const el = document.createElement("div");
  el.id = TOAST_ID;
  el.style.cssText =
    "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:40;pointer-events:none;" +
    `background:rgba(15,12,20,0.93);border:1px solid ${hasWarn ? "#b3703a" : "#3a3550"};` +
    "border-radius:6px;padding:9px 18px;font-family:'Segoe UI',system-ui,sans-serif;" +
    "text-align:center;max-width:min(92vw,560px);opacity:1;transition:opacity 700ms;";
  for (const line of lines) {
    const div = document.createElement("div");
    div.textContent = line.text;
    div.style.cssText =
      line.kind === "headline"
        ? "color:#33e6ff;font-size:15px;font-weight:700;letter-spacing:0.06em;"
        : line.kind === "warn"
          ? "color:#ffab5c;font-size:13px;margin-top:5px;line-height:1.45;"
          : "color:#c9c2d4;font-size:13px;margin-top:2px;";
    el.appendChild(div);
  }
  document.body.appendChild(el);
  window.setTimeout(
    () => {
      el.style.opacity = "0";
      window.setTimeout(() => el.remove(), 750);
    },
    hasWarn ? 10000 : 5200,
  );
}

/** One removable first-state watcher per joined room (mirrors ArenaScene's explicit-remove pattern —
 *  Colyseus's `once()` hides its wrapper). Reports the room's reality vs the request. */
function watchArrival(room: Room, requested: RunRequest, intent: LaunchIntent): void {
  let pending = true;
  const onFirstState = (state: unknown): void => {
    if (!pending) return;
    pending = false;
    room.onStateChange.remove(onFirstState);
    const lines = buildArrivalReport(state, requested, intent);
    showArrivalToast(lines);
    const warns = lines.filter((l) => l.kind === "warn");
    if (warns.length > 0) {
      console.warn(`[matchmaking] request overridden: ${warns.map((l) => l.text).join(" | ")}`);
    }
  };
  room.onStateChange(onFirstState);
}

let installed = false;

/**
 * Wrap `Client.prototype.joinOrCreate` for the game room ONLY: apply the menu's launch intent
 * (HOST NEW → `create()`, QUICK JOIN → the original filtered `joinOrCreate`), then attach the
 * arrival-truth watcher. colyseus.js is imported lazily so the menu/boot chunk stays net-free
 * (§17 payload diet) — MenuScene awaits this alongside its lazy ArenaScene import, which guarantees
 * the wrapper is live before the arena's connect() ever constructs a Client. Idempotent.
 */
export async function installMatchmakingContract(): Promise<void> {
  if (installed) return;
  installed = true;
  const { Client } = await import("colyseus.js");
  const original = Client.prototype.joinOrCreate;
  const patched = async function (
    this: ColyseusClient,
    ...args: Parameters<ColyseusClient["joinOrCreate"]>
  ): Promise<Room> {
    const [roomName, options, rootSchema] = args;
    if (roomName !== ROOM_NAME) return original.apply(this, args);
    const intent = launchIntent;
    const requested = readRunRequest(options);
    const room =
      intent === "host"
        ? await this.create(roomName, options, rootSchema)
        : await original.apply(this, args);
    watchArrival(room, requested, intent);
    return room;
  };
  // The generic signature can't be expressed on a wrapper function value — the runtime shape is identical.
  Client.prototype.joinOrCreate = patched as ColyseusClient["joinOrCreate"];
}
