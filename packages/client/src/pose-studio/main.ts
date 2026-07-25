import { WHOLE_ART_CHARACTERS } from "@dd/shared";
import { IDLE_HAND_POSE_SPECS } from "../sprites/pose-language.js";
import {
  COMBO_MOTIONS,
  COMBO_PATHS,
  cloneRow,
  IDLE_HAND_POSES,
  RIBBON_PROFILES,
  rowFingerprint,
  validateEditableRow,
  type WeaponAuthoringRow,
  type WeaponSummary,
} from "./model.js";
import { type PlaybackFrame, PoseStage, type StageMarkers } from "./stage.js";
import "./style.css";

interface CatalogResponse {
  weapons: WeaponSummary[];
  source: string;
}

interface RowResponse {
  row: WeaponAuthoringRow;
  snapshotAvailable: boolean;
}

type StatusKind = "neutral" | "success" | "error";
type HandleKind = "primary" | "secondary" | "idle" | "path";

interface DragState {
  kind: HandleKind;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRow: WeaponAuthoringRow;
  startMarkers: StageMarkers;
}

const element = <T extends Element>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new ReferenceError(`Missing Pose Studio element #${id}`);
  return found as unknown as T;
};

const characterSelect = element<HTMLSelectElement>("characterSelect");
const weaponSearch = element<HTMLInputElement>("weaponSearch");
const weaponSelect = element<HTMLSelectElement>("weaponSelect");
const zoomInput = element<HTMLInputElement>("zoomInput");
const zoomOutput = element<HTMLOutputElement>("zoomOutput");
const combatScaleInput = element<HTMLInputElement>("combatScaleInput");
const stageWrap = element<HTMLDivElement>("stageWrap");
const stageHost = element<HTMLDivElement>("stageHost");
const stageGuides = element<SVGSVGElement>("stageGuides");
const pathGuide = element<SVGPathElement>("pathGuide");
const timelineInput = element<HTMLInputElement>("timelineInput");
const timelineWindows = element<HTMLDivElement>("timelineWindows");
const beatReadout = element<HTMLSpanElement>("beatReadout");
const playButton = element<HTMLButtonElement>("playButton");
const loopInput = element<HTMLInputElement>("loopInput");
const onionInput = element<HTMLInputElement>("onionInput");
const speedInput = element<HTMLInputElement>("speedInput");
const speedOutput = element<HTMLOutputElement>("speedOutput");
const tweakContent = element<HTMLDivElement>("tweakContent");
const rowId = element<HTMLSpanElement>("rowId");
const recoilReadout = element<HTMLOutputElement>("recoilReadout");
const dirtyChip = element<HTMLSpanElement>("dirtyChip");
const dirtyText = element<HTMLSpanElement>("dirtyText");
const saveButton = element<HTMLButtonElement>("saveButton");
const saveRegenButton = element<HTMLButtonElement>("saveRegenButton");
const snapshotButton = element<HTMLButtonElement>("snapshotButton");
const restoreButton = element<HTMLButtonElement>("restoreButton");
const statusMessage = element<HTMLSpanElement>("statusMessage");
const statusBar = statusMessage.closest(".status-bar") as HTMLElement;

const handles: Record<HandleKind, HTMLButtonElement> = {
  primary: element<HTMLButtonElement>("primaryHandle"),
  secondary: element<HTMLButtonElement>("secondaryHandle"),
  idle: element<HTMLButtonElement>("idleHandle"),
  path: element<HTMLButtonElement>("pathHandle"),
};

let summaries: WeaponSummary[] = [];
let row: WeaponAuthoringRow;
let savedRow: WeaponAuthoringRow;
let stage: PoseStage;
let selectedBeat = 0;
let snapshotAvailable = false;
let latestMarkers: StageMarkers | undefined;
let drag: DragState | undefined;
let busy = false;
let lastFrameBeat = -1;
let stageUpdateQueued = false;

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message: string, kind: StatusKind = "neutral"): void {
  statusMessage.textContent = message;
  statusBar.dataset.kind = kind;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as T & { error?: string; errors?: string[] };
  if (!response.ok) {
    throw new Error(
      payload.errors?.join("\n") ?? payload.error ?? `Request failed (${response.status})`,
    );
  }
  return payload;
}

function setBusy(next: boolean): void {
  busy = next;
  saveButton.disabled = next || !row;
  saveRegenButton.disabled = next || !row;
  snapshotButton.disabled = next || !row;
  restoreButton.disabled = next || !snapshotAvailable;
}

function updateDirty(): void {
  const dirty = !!row && !!savedRow && rowFingerprint(row) !== rowFingerprint(savedRow);
  dirtyChip.dataset.dirty = String(dirty);
  dirtyText.textContent = dirty ? "Unsaved row edits" : "Row matches disk";
  document.documentElement.dataset.dirty = String(dirty);
  setBusy(busy);
}

function options(values: readonly string[], selected: string | undefined): string {
  return values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`,
    )
    .join("");
}

function numberField(
  label: string,
  edit: string,
  value: number,
  minimum: number,
  maximum: number,
  step: number,
  wide = false,
): string {
  return `
    <label class="${wide ? "wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <input
        type="number"
        data-edit="${escapeHtml(edit)}"
        value="${value}"
        min="${minimum}"
        max="${maximum}"
        step="${step}"
      />
    </label>`;
}

function renderTweak(): void {
  rowId.textContent = row.id;
  rowId.title = row.id;
  const recoil = typeof row.behavior?.recoil === "number" ? row.behavior.recoil : undefined;
  recoilReadout.textContent =
    row.behavior?.kind === "gun"
      ? recoil === undefined
        ? "runtime default"
        : String(recoil)
      : "not a gun";

  const primary = row.gripPoints?.primary ?? { x: row.stats.gripFrac, y: 0.5 };
  const secondary = row.gripPoints?.secondary;
  const beat = row.comboBar?.[selectedBeat];
  const beatTabs = row.comboBar
    ? `<div class="beat-tabs">${row.comboBar
        .map(
          (candidate, index) =>
            `<button class="beat-tab${index === selectedBeat ? " active" : ""}" data-beat="${index}" title="${escapeHtml(candidate.name)}" type="button">${index + 1}</button>`,
        )
        .join("")}</div>`
    : "";

  const comboSection = beat
    ? `
      <section class="field-section">
        <h3>Beat ${selectedBeat + 1} / ${row.comboBar?.length ?? 0}</h3>
        ${beatTabs}
        <div class="field-grid">
          <label class="wide">
            <span>Beat label</span>
            <input type="text" data-edit="beat.name" value="${escapeHtml(beat.name)}" />
          </label>
          <label>
            <span>Motion</span>
            <select data-edit="beat.motion">${options(COMBO_MOTIONS, beat.motion)}</select>
          </label>
          <label>
            <span>Path kind</span>
            <select data-edit="beat.path.kind">${options(COMBO_PATHS, beat.path.kind)}</select>
          </label>
        </div>
      </section>
      <section class="field-section">
        <h3>Timing window</h3>
        <div class="field-grid">
          ${numberField("Active start", "beat.timing.activeStart", beat.timing.activeStart, 0, 1, 0.01)}
          ${numberField("Active end", "beat.timing.activeEnd", beat.timing.activeEnd, 0, 1, 0.01)}
          ${numberField("Impact", "beat.timing.impact", beat.timing.impact, 0, 1, 0.01)}
          ${numberField("Follow end", "beat.timing.followEnd", beat.timing.followEnd, 0, 1, 0.01)}
        </div>
      </section>
      <section class="field-section">
        <h3>Path and payload</h3>
        <div class="field-grid">
          ${numberField("Arc multiplier", "beat.path.arcMultiplier", beat.path.arcMultiplier, -2, 2, 0.01)}
          ${numberField("Range multiplier", "beat.path.rangeMultiplier", beat.path.rangeMultiplier, 0.5, 1.5, 0.01)}
          ${numberField("Damage multiplier", "beat.path.damageMultiplier", beat.path.damageMultiplier, 0.5, 2, 0.01)}
          ${numberField("Delta angle", "beat.path.deltaAngle", beat.path.deltaAngle ?? 0, -6.283, 6.283, 0.01)}
          <label class="wide">
            <span>Ribbon profile</span>
            <select data-edit="beat.ribbon.profile"${beat.ribbon ? "" : " disabled"}>
              ${options(RIBBON_PROFILES, beat.ribbon?.profile)}
            </select>
          </label>
        </div>
      </section>`
    : `
      <section class="field-section">
        <h3>Runtime combo</h3>
        <div class="empty-authoring">
          This row has no authored <code>comboBar</code>. The stage shows the real runtime fallback, but
          Pose Studio will not invent a parallel beat format. Add a supported combo bar in source before
          using beat controls.
        </div>
      </section>`;

  tweakContent.innerHTML = `
    <section class="field-section">
      <h3>Weapon mount</h3>
      <div class="field-grid">
        ${numberField("Display length", "stats.displayLength", row.stats.displayLength, 40, 400, 1)}
        ${numberField("Grip fraction", "stats.gripFrac", row.stats.gripFrac, 0.05, 0.9, 0.01)}
        ${numberField("Primary X", "grip.primary.x", primary.x, 0, 1, 0.01)}
        ${numberField("Primary Y", "grip.primary.y", primary.y, 0, 1, 0.01)}
        ${
          secondary
            ? `${numberField("Secondary X", "grip.secondary.x", secondary.x, 0, 1, 0.01)}
               ${numberField("Secondary Y", "grip.secondary.y", secondary.y, 0, 1, 0.01)}`
            : `<div class="empty-authoring wide">No secondary grip is expressed by this row.</div>`
        }
        <label class="wide">
          <span>Pose-language idle</span>
          <select data-edit="poseLanguage.idle">
            ${options(IDLE_HAND_POSES, row.poseLanguage?.idle)}
          </select>
        </label>
      </div>
    </section>
    ${comboSection}`;

  tweakContent.querySelectorAll<HTMLButtonElement>("[data-beat]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedBeat = Number(button.dataset.beat);
      stage.setTimeline(selectedBeat);
      renderTweak();
      renderTimeline();
    });
  });
  tweakContent
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-edit]")
    .forEach((input) => {
      input.addEventListener("change", () => applyFieldEdit(input));
    });
}

function renderTimeline(): void {
  const beats = row.comboBar ?? [];
  const count = Math.max(1, beats.length);
  timelineInput.max = String(count);
  timelineWindows.innerHTML =
    beats.length > 0
      ? beats
          .map((beat, index) => {
            const activeLeft = beat.timing.activeStart * 100;
            const activeWidth = (beat.timing.activeEnd - beat.timing.activeStart) * 100;
            const followLeft = beat.timing.activeEnd * 100;
            const followWidth = (beat.timing.followEnd - beat.timing.activeEnd) * 100;
            return `
              <div class="beat-window${index === selectedBeat ? " selected" : ""}" data-window-beat="${index}">
                <b class="beat-number">${index + 1} · ${escapeHtml(beat.name)}</b>
                <span class="active-window" style="left:${activeLeft}%;width:${activeWidth}%"></span>
                <span class="follow-window" style="left:${followLeft}%;width:${followWidth}%"></span>
                <span class="impact-tick" style="left:${beat.timing.impact * 100}%"></span>
              </div>`;
          })
          .join("")
      : `<div class="beat-window selected"><b class="beat-number">Runtime fallback</b></div>`;
}

function updatePlayback(frame: PlaybackFrame): void {
  timelineInput.value = String(frame.timelineValue);
  playButton.textContent = frame.playing ? "❚❚" : "▶";
  playButton.setAttribute("aria-label", frame.playing ? "Pause" : "Play");
  const beat = row.comboBar?.[frame.beatIndex];
  beatReadout.textContent = beat
    ? `Beat ${frame.beatIndex + 1} · ${beat.name} · ${Math.round(frame.progress * 100)}%`
    : `Runtime fallback · ${Math.round(frame.progress * 100)}%`;
  if (frame.beatIndex !== lastFrameBeat) {
    lastFrameBeat = frame.beatIndex;
    selectedBeat = frame.beatIndex;
    renderTimeline();
    renderTweak();
  }
}

function positionHandle(
  handle: HTMLButtonElement,
  point: Readonly<{ x: number; y: number }>,
): void {
  handle.style.left = `${point.x}px`;
  handle.style.top = `${point.y}px`;
}

function updateMarkers(markers: StageMarkers): void {
  latestMarkers = markers;
  stageGuides.setAttribute("viewBox", `0 0 ${stageWrap.clientWidth} ${stageWrap.clientHeight}`);
  if (drag?.kind !== "primary") positionHandle(handles.primary, markers.primary);
  if (drag?.kind !== "secondary") positionHandle(handles.secondary, markers.secondary);
  if (drag?.kind !== "idle") positionHandle(handles.idle, markers.idle);
  if (drag?.kind !== "path") positionHandle(handles.path, markers.path);
  handles.secondary.hidden = !row.gripPoints?.secondary;
  handles.idle.hidden = !row.poseLanguage;
  handles.path.hidden = !row.comboBar?.[selectedBeat];
  pathGuide.setAttribute(
    "d",
    `M ${markers.pathOrigin.x.toFixed(1)} ${markers.pathOrigin.y.toFixed(1)} Q ${(
      (markers.pathOrigin.x + markers.path.x) / 2
    ).toFixed(
      1,
    )} ${(Math.min(markers.pathOrigin.y, markers.path.y) - 28).toFixed(1)} ${markers.path.x.toFixed(1)} ${markers.path.y.toFixed(1)}`,
  );
}

function scheduleStageRow(): void {
  if (stageUpdateQueued) return;
  stageUpdateQueued = true;
  requestAnimationFrame(() => {
    stageUpdateQueued = false;
    stage.setRow(row);
  });
}

function commitEdit(
  mutate: (candidate: WeaponAuthoringRow) => void,
  message: string,
  rerender = true,
): boolean {
  const candidate = cloneRow(row);
  mutate(candidate);
  const error = validateEditableRow(candidate);
  if (error) {
    setStatus(`Rejected: ${error}`, "error");
    if (rerender) renderTweak();
    return false;
  }
  row = candidate;
  updateDirty();
  renderTimeline();
  if (rerender) renderTweak();
  scheduleStageRow();
  setStatus(message);
  return true;
}

function ensurePrimary(candidate: WeaponAuthoringRow): void {
  candidate.gripPoints ??= {
    primary: { x: candidate.stats.gripFrac, y: 0.5 },
  };
}

function applyFieldEdit(input: HTMLInputElement | HTMLSelectElement): void {
  const edit = input.dataset.edit;
  if (!edit) return;
  const number =
    input instanceof HTMLInputElement && input.type === "number" ? Number(input.value) : 0;
  const beatIndex = selectedBeat;
  commitEdit((candidate) => {
    const beat = candidate.comboBar?.[beatIndex];
    switch (edit) {
      case "stats.displayLength":
        candidate.stats.displayLength = number;
        break;
      case "stats.gripFrac":
        candidate.stats.gripFrac = number;
        break;
      case "grip.primary.x":
        ensurePrimary(candidate);
        if (candidate.gripPoints) candidate.gripPoints.primary.x = number;
        break;
      case "grip.primary.y":
        ensurePrimary(candidate);
        if (candidate.gripPoints) candidate.gripPoints.primary.y = number;
        break;
      case "grip.secondary.x":
        if (candidate.gripPoints?.secondary) candidate.gripPoints.secondary.x = number;
        break;
      case "grip.secondary.y":
        if (candidate.gripPoints?.secondary) candidate.gripPoints.secondary.y = number;
        break;
      case "poseLanguage.idle":
        candidate.poseLanguage = {
          ...(candidate.poseLanguage ?? {}),
          idle: input.value as NonNullable<WeaponAuthoringRow["poseLanguage"]>["idle"],
        };
        break;
      case "beat.name":
        if (beat) beat.name = input.value.trim();
        break;
      case "beat.motion":
        if (beat) beat.motion = input.value as (typeof COMBO_MOTIONS)[number];
        break;
      case "beat.path.kind":
        if (beat) beat.path.kind = input.value as (typeof COMBO_PATHS)[number];
        break;
      case "beat.timing.activeStart":
        if (beat) beat.timing.activeStart = number;
        break;
      case "beat.timing.activeEnd":
        if (beat) beat.timing.activeEnd = number;
        break;
      case "beat.timing.impact":
        if (beat) beat.timing.impact = number;
        break;
      case "beat.timing.followEnd":
        if (beat) beat.timing.followEnd = number;
        break;
      case "beat.path.arcMultiplier":
        if (beat) beat.path.arcMultiplier = number;
        break;
      case "beat.path.rangeMultiplier":
        if (beat) beat.path.rangeMultiplier = number;
        break;
      case "beat.path.damageMultiplier":
        if (beat) beat.path.damageMultiplier = number;
        break;
      case "beat.path.deltaAngle":
        if (beat) beat.path.deltaAngle = number;
        break;
      case "beat.ribbon.profile":
        if (beat?.ribbon) {
          beat.ribbon.profile = input.value as (typeof RIBBON_PROFILES)[number];
        }
        break;
    }
  }, `Updated ${edit}; the in-memory authoring row is dirty.`);
}

function filteredSummaries(): WeaponSummary[] {
  const query = weaponSearch.value.trim().toLowerCase();
  if (!query) return summaries;
  return summaries.filter((summary) =>
    `${summary.name} ${summary.id} ${summary.family} ${summary.type}`.toLowerCase().includes(query),
  );
}

function renderWeaponOptions(): void {
  const current = weaponSelect.value || row?.id;
  const filtered = filteredSummaries();
  weaponSelect.innerHTML = filtered
    .map(
      (summary) =>
        `<option value="${escapeHtml(summary.id)}">${escapeHtml(summary.name)} · ${escapeHtml(summary.family)} · ${summary.comboBeats || "runtime"} beat${summary.comboBeats === 1 ? "" : "s"}</option>`,
    )
    .join("");
  if (current && filtered.some((summary) => summary.id === current)) weaponSelect.value = current;
  else if (filtered[0]) weaponSelect.value = filtered[0].id;
}

async function loadRow(id: string): Promise<void> {
  setBusy(true);
  setStatus(`Loading ${id} from data/weapon-concepts-300.json…`);
  try {
    const response = await api<RowResponse>(`/api/pose-studio/row/${encodeURIComponent(id)}`);
    row = cloneRow(response.row);
    savedRow = cloneRow(response.row);
    snapshotAvailable = response.snapshotAvailable;
    selectedBeat = 0;
    lastFrameBeat = -1;
    weaponSelect.value = id;
    renderTweak();
    renderTimeline();
    updateDirty();
    if (stage) {
      stage.setPlaying(false);
      stage.setTimeline(0);
      stage.setRow(row);
    }
    setStatus(`Loaded ${row.name}. Edits remain in memory until Save row.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
    throw error;
  } finally {
    setBusy(false);
  }
}

async function saveRowToDisk(): Promise<void> {
  const localError = validateEditableRow(row);
  if (localError) throw new Error(localError);
  const response = await api<RowResponse>("/api/pose-studio/save", {
    method: "POST",
    body: JSON.stringify({ id: row.id, row }),
  });
  row = cloneRow(response.row);
  savedRow = cloneRow(response.row);
  snapshotAvailable = response.snapshotAvailable;
  updateDirty();
  renderTweak();
  document.documentElement.dataset.lastSave = row.id;
  setStatus(`Saved ${row.id}; the catalog row is now an ordinary git diff.`, "success");
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  if (busy) return;
  setBusy(true);
  try {
    await action();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    setBusy(false);
  }
}

async function pollRegen(): Promise<void> {
  for (;;) {
    const state = await api<{ status: string; ok?: boolean; code?: number; log?: string }>(
      "/api/pose-studio/regen",
    );
    document.documentElement.dataset.regenStatus = state.status;
    if (state.status === "running") {
      setStatus(
        "Regenerating the game catalog… Vite may refresh this page when shared output changes.",
      );
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      continue;
    }
    if (state.status === "passed") {
      sessionStorage.removeItem("dd-pose-studio-regen");
      setStatus(
        "pnpm gen passed. Reload the game client to inspect this row in context.",
        "success",
      );
      return;
    }
    if (state.status === "failed") {
      sessionStorage.removeItem("dd-pose-studio-regen");
      throw new Error(
        `pnpm gen failed (code ${state.code ?? "?"}). ${state.log?.slice(-800) ?? ""}`,
      );
    }
    return;
  }
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const bounds = stageWrap.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function startDrag(event: PointerEvent, kind: HandleKind): void {
  if (!latestMarkers || event.button !== 0) return;
  const target = event.currentTarget as HTMLButtonElement;
  target.setPointerCapture(event.pointerId);
  drag = {
    kind,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startRow: cloneRow(row),
    startMarkers: structuredClone(latestMarkers),
  };
  stage.setPlaying(false);
  playButton.textContent = "▶";
  document.documentElement.dataset.dragging = kind;
  event.preventDefault();
}

function nearestIdlePose(point: Readonly<{ x: number; y: number }>, markers: StageMarkers): string {
  const desiredX = (point.x - markers.primary.x) / markers.bodyHeight;
  const desiredY = (point.y - markers.primary.y) / markers.bodyHeight;
  let nearest: (typeof IDLE_HAND_POSES)[number] = IDLE_HAND_POSES[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const pose of IDLE_HAND_POSES) {
    const spec = IDLE_HAND_POSE_SPECS[pose];
    const x = spec.offFacingX ?? spec.facingX;
    const y = spec.offScreenY ?? spec.screenY;
    const distance = (desiredX - x) ** 2 + (desiredY - y) ** 2;
    if (distance < nearestDistance) {
      nearest = pose;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function moveDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const point = pointerPosition(event);
  positionHandle(handles[drag.kind], point);
  const dx = event.clientX - drag.startClientX;
  const dy = event.clientY - drag.startClientY;
  const start = drag.startRow;
  const beatIndex = selectedBeat;

  if (drag.kind === "primary") {
    const origin = start.gripPoints?.primary ?? { x: start.stats.gripFrac, y: 0.5 };
    commitEdit(
      (candidate) => {
        ensurePrimary(candidate);
        if (!candidate.gripPoints) return;
        candidate.gripPoints.primary.x = round(
          PhaserClamp(origin.x + dx / Math.max(80, start.stats.displayLength), 0, 1),
          3,
        );
        candidate.gripPoints.primary.y = round(
          PhaserClamp(origin.y + dy / Math.max(60, start.stats.displayLength * 0.65), 0, 1),
          3,
        );
      },
      "Primary grip updated live in the catalog row.",
      false,
    );
  } else if (drag.kind === "secondary" && start.gripPoints?.secondary) {
    commitEdit(
      (candidate) => {
        const secondary = candidate.gripPoints?.secondary;
        if (!secondary) return;
        secondary.x = round(
          PhaserClamp(
            (start.gripPoints?.secondary?.x ?? secondary.x) +
              dx / Math.max(80, start.stats.displayLength),
            0,
            1,
          ),
          3,
        );
        secondary.y = round(
          PhaserClamp(
            (start.gripPoints?.secondary?.y ?? secondary.y) +
              dy / Math.max(60, start.stats.displayLength * 0.65),
            0,
            1,
          ),
          3,
        );
      },
      "Secondary grip updated live in the catalog row.",
      false,
    );
  } else if (drag.kind === "idle") {
    const idle = nearestIdlePose(point, drag.startMarkers);
    commitEdit(
      (candidate) => {
        candidate.poseLanguage = {
          ...(candidate.poseLanguage ?? {}),
          idle: idle as NonNullable<WeaponAuthoringRow["poseLanguage"]>["idle"],
        };
      },
      `Idle hand snapped to supported pose "${idle}"; the schema expresses named poses, not free coordinates.`,
      false,
    );
  } else if (drag.kind === "path") {
    const beat = start.comboBar?.[beatIndex];
    if (!beat) return;
    const origin = drag.startMarkers.pathOrigin;
    const vx = point.x - origin.x;
    const vy = point.y - origin.y;
    const stageScale = combatScaleInput.checked ? 0.9 : 1.1;
    const rangeMultiplier = PhaserClamp(
      Math.hypot(vx, vy) / Math.max(1, start.stats.range * stageScale),
      0.5,
      1.5,
    );
    const deltaAngle = wrapAngle(Math.atan2(vy, vx) + 0.08);
    const direction = beat.direction || 1;
    const arcMultiplier = PhaserClamp(deltaAngle / (0.34 * direction), -2, 2);
    commitEdit(
      (candidate) => {
        const candidateBeat = candidate.comboBar?.[beatIndex];
        if (!candidateBeat) return;
        candidateBeat.path.rangeMultiplier = round(rangeMultiplier, 3);
        candidateBeat.path.deltaAngle = round(deltaAngle, 3);
        candidateBeat.path.arcMultiplier = round(arcMultiplier, 3);
      },
      "Beat target encoded as supported rangeMultiplier, deltaAngle, and arcMultiplier fields.",
      false,
    );
  }
  document.documentElement.dataset.lastEdit = drag.kind;
  event.preventDefault();
}

function endDrag(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const kind = drag.kind;
  drag = undefined;
  delete document.documentElement.dataset.dragging;
  renderTweak();
  renderTimeline();
  setStatus(
    kind === "idle"
      ? "Idle drag committed to the nearest named pose supported by the catalog schema."
      : `${kind} drag committed in memory. Save row writes it to the catalog.`,
    "success",
  );
}

function PhaserClamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrapAngle(value: number): number {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function bootstrap(): Promise<void> {
  const catalog = await api<CatalogResponse>("/api/pose-studio/catalog");
  summaries = catalog.weapons;
  characterSelect.innerHTML = WHOLE_ART_CHARACTERS.map(
    (id) => `<option value="${id}">${id.replace(/^proto-/, "").replaceAll("-", " ")}</option>`,
  ).join("");
  const parameters = new URLSearchParams(location.search);
  const character = parameters.get("character") ?? "proto-cowboy-hidden-face";
  characterSelect.value = WHOLE_ART_CHARACTERS.includes(
    character as (typeof WHOLE_ART_CHARACTERS)[number],
  )
    ? character
    : WHOLE_ART_CHARACTERS[0];
  renderWeaponOptions();
  const requestedWeapon = parameters.get("weapon");
  const initialWeapon =
    summaries.find((summary) => summary.id === requestedWeapon)?.id ??
    summaries.find((summary) => summary.id === "x2-voltfang-tachi")?.id ??
    summaries.find((summary) => summary.family === "katana" && summary.comboBeats > 0)?.id ??
    summaries[0]?.id;
  if (!initialWeapon) throw new Error("The active weapon catalog is empty.");
  weaponSelect.value = initialWeapon;
  await loadRow(initialWeapon);
  stage = new PoseStage(stageHost, row, characterSelect.value, {
    onFrame(frame, markers) {
      updatePlayback(frame);
      updateMarkers(markers);
    },
    onError(message) {
      setStatus(message, "error");
    },
  });

  document.documentElement.dataset.poseStudioReady = "true";
  if (sessionStorage.getItem("dd-pose-studio-regen")) void pollRegen();
}

weaponSearch.addEventListener("input", renderWeaponOptions);
weaponSelect.addEventListener("change", () => {
  if (weaponSelect.value) void loadRow(weaponSelect.value);
});
characterSelect.addEventListener("change", () => {
  stage.setCharacter(characterSelect.value);
  setStatus(`Loaded real rig art for ${characterSelect.value}.`);
});
zoomInput.addEventListener("input", () => {
  const value = Number(zoomInput.value);
  zoomOutput.value = `${value.toFixed(2)}×`;
  stage.setZoom(value);
});
combatScaleInput.addEventListener("change", () => {
  stage.setCombatScale(combatScaleInput.checked);
  setStatus(
    combatScaleInput.checked ? "Combat-scale rig envelope enabled." : "Inspection scale enabled.",
  );
});
timelineInput.addEventListener("input", () => {
  stage.setPlaying(false);
  stage.setTimeline(Number(timelineInput.value));
});
playButton.addEventListener("click", () => {
  stage.togglePlaying();
});
loopInput.addEventListener("change", () => stage.setLooping(loopInput.checked));
onionInput.addEventListener("change", () => stage.setOnionSkin(onionInput.checked));
speedInput.addEventListener("input", () => {
  const speed = Number(speedInput.value);
  speedOutput.value = `${speed.toFixed(1)}×`;
  stage.setPlaybackSpeed(speed);
});

for (const [kind, handle] of Object.entries(handles) as Array<[HandleKind, HTMLButtonElement]>) {
  handle.addEventListener("pointerdown", (event) => startDrag(event, kind));
  handle.addEventListener("pointermove", moveDrag);
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
}

snapshotButton.addEventListener("click", () =>
  withBusy(async () => {
    await api("/api/pose-studio/snapshot", {
      method: "POST",
      body: JSON.stringify({ id: row.id }),
    });
    snapshotAvailable = true;
    setStatus(`Snapshot captured for ${row.id}.`, "success");
  }),
);
restoreButton.addEventListener("click", () =>
  withBusy(async () => {
    const response = await api<RowResponse>("/api/pose-studio/restore", {
      method: "POST",
      body: JSON.stringify({ id: row.id }),
    });
    row = cloneRow(response.row);
    savedRow = cloneRow(response.row);
    snapshotAvailable = response.snapshotAvailable;
    selectedBeat = 0;
    stage.setTimeline(0);
    stage.setRow(row);
    renderTweak();
    renderTimeline();
    updateDirty();
    setStatus(`Restored the single disk snapshot for ${row.id}.`, "success");
  }),
);
saveButton.addEventListener("click", () => withBusy(saveRowToDisk));
saveRegenButton.addEventListener("click", () =>
  withBusy(async () => {
    await saveRowToDisk();
    sessionStorage.setItem("dd-pose-studio-regen", String(Date.now()));
    await api("/api/pose-studio/regen", { method: "POST", body: "{}" });
    await pollRegen();
  }),
);

void bootstrap().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error), "error");
  document.documentElement.dataset.poseStudioReady = "error";
});
