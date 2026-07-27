import "./style.css";

type Point = [number, number];
type Polygon = Point[];
type Tool = "select" | "polygon";
type StandResult = "yes" | "edge" | "no";

interface PrefabSummary {
  id: string;
  name: string;
  kind: "platform" | "mega" | "prop";
  role: string;
  source: string;
  width: number;
  height: number;
  authored: boolean;
  polygonCount: number;
  artUrl: string;
}

interface CatalogResponse {
  prefabs: PrefabSummary[];
}

interface PrefabResponse {
  id: string;
  width: number;
  height: number;
  source: string;
  artUrl: string;
  authored: boolean;
  origin: "alpha-seed" | "saved";
  polygons: Polygon[];
}

interface SeedResponse {
  id: string;
  width: number;
  height: number;
  origin: "alpha-seed";
  polygons: Polygon[];
}

interface SaveResponse {
  ok: true;
  id: string;
  polygons: Polygon[];
  polygonCount: number;
  dataFile: string;
  savedAt: string;
}

interface EditorSnapshot {
  polygons: Polygon[];
  draft: Polygon;
  selectedPolygon: number;
  selectedVertex: number;
}

interface VertexDrag {
  pointerId: number;
  polygonIndex: number;
  vertexIndex: number;
  before: EditorSnapshot;
  moved: boolean;
}

function element<T extends Element>(selector: string): T {
  const match = document.querySelector<T>(selector);
  if (!match) throw new Error(`Missing Walkability Painter element: ${selector}`);
  return match;
}

const prefabList = element<HTMLElement>("#prefab-list");
const prefabSearch = element<HTMLInputElement>("#prefab-search");
const doneCount = element<HTMLElement>("#done-count");
const untouchedCount = element<HTMLElement>("#untouched-count");
const prefabName = element<HTMLElement>("#prefab-name");
const prefabDimensions = element<HTMLElement>("#prefab-dimensions");
const prefabSource = element<HTMLElement>("#prefab-source");
const authoringBadge = element<HTMLElement>("#authoring-badge");
const dirtyIndicator = element<HTMLElement>("#dirty-indicator");
const saveButton = element<HTMLButtonElement>("#save-button");
const selectTool = element<HTMLButtonElement>("#select-tool");
const polygonTool = element<HTMLButtonElement>("#polygon-tool");
const undoButton = element<HTMLButtonElement>("#undo-button");
const redoButton = element<HTMLButtonElement>("#redo-button");
const deleteButton = element<HTMLButtonElement>("#delete-button");
const reseedButton = element<HTMLButtonElement>("#reseed-button");
const zoomSelect = element<HTMLSelectElement>("#zoom-select");
const overlayButton = element<HTMLButtonElement>("#overlay-button");
const nativeScaleLabel = element<HTMLElement>("#native-scale-label");
const cursorCoordinate = element<HTMLElement>("#cursor-coordinate");
const stageScroll = element<HTMLElement>("#stage-scroll");
const canvasWrap = element<HTMLElement>("#canvas-wrap");
const canvas = element<HTMLCanvasElement>("#paint-canvas");
const statusMessage = element<HTMLElement>("#status-message");
const saveConfirmation = element<HTMLElement>("#save-confirmation");
const standState = element<HTMLElement>("#stand-state");
const standFigure = element<HTMLElement>("#stand-figure");
const standTitle = element<HTMLElement>("#stand-title");
const standDetail = element<HTMLElement>("#stand-detail");
const radiusInput = element<HTMLInputElement>("#radius-input");
const radiusOutput = element<HTMLOutputElement>("#radius-output");
const polygonCount = element<HTMLElement>("#polygon-count");
const polygonList = element<HTMLElement>("#polygon-list");
const context = (() => {
  const value = canvas.getContext("2d");
  if (!value) throw new Error("This browser does not support a 2D canvas.");
  return value;
})();

let catalog: PrefabSummary[] = [];
let current: PrefabResponse | undefined;
let art: HTMLImageElement | undefined;
let polygons: Polygon[] = [];
let draft: Polygon = [];
let selectedPolygon = -1;
let selectedVertex = -1;
let tool: Tool = "select";
let zoom = 1;
let overlayVisible = true;
let footprintRadius = 24;
let hoverPoint: Point | undefined;
let baseline = "[]";
let dirty = false;
let busy = false;
let drag: VertexDrag | undefined;
let undoStack: EditorSnapshot[] = [];
let redoStack: EditorSnapshot[] = [];

function clonePolygonList(value: Polygon[]): Polygon[] {
  return structuredClone(value);
}

function snapshot(): EditorSnapshot {
  return {
    polygons: clonePolygonList(polygons),
    draft: structuredClone(draft),
    selectedPolygon,
    selectedVertex,
  };
}

function restore(value: EditorSnapshot): void {
  polygons = clonePolygonList(value.polygons);
  draft = structuredClone(value.draft);
  selectedPolygon = value.selectedPolygon;
  selectedVertex = value.selectedVertex;
  updateEditorState();
}

function mutate(action: () => void): void {
  undoStack.push(snapshot());
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  action();
  updateEditorState();
}

function setStatus(message: string, tone: "normal" | "success" | "error" = "normal"): void {
  statusMessage.textContent = message;
  statusMessage.className = tone === "normal" ? "" : tone;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? `${response.status} ${response.statusText}`);
  return value;
}

function serializePolygons(): string {
  return JSON.stringify(polygons);
}

function updateDirty(): void {
  dirty = serializePolygons() !== baseline || draft.length > 0;
  document.documentElement.dataset.dirty = String(dirty);
  dirtyIndicator.textContent = dirty ? "Unsaved edits" : "No unsaved edits";
  dirtyIndicator.classList.toggle("dirty", dirty);
}

function updateHistoryButtons(): void {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
  deleteButton.disabled = selectedPolygon < 0;
}

function updateEditorState(): void {
  updateDirty();
  updateHistoryButtons();
  renderPolygonList();
  renderCanvas();
}

function kindLabel(kind: PrefabSummary["kind"]): string {
  if (kind === "mega") return "Connected hero rooms";
  if (kind === "prop") return "Dimension props";
  return "Platform prefabs";
}

function renderCatalog(): void {
  const query = prefabSearch.value.trim().toLowerCase();
  const visible = catalog.filter((prefab) =>
    `${prefab.id} ${prefab.role} ${prefab.kind}`.toLowerCase().includes(query),
  );
  prefabList.replaceChildren();
  for (const kind of ["platform", "mega", "prop"] as const) {
    const group = visible.filter((prefab) => prefab.kind === kind);
    if (group.length === 0) continue;
    const heading = document.createElement("div");
    heading.className = "prefab-group-label";
    heading.textContent = kindLabel(kind);
    prefabList.append(heading);
    for (const prefab of group) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `prefab-item${current?.id === prefab.id ? " active" : ""}`;
      button.dataset.prefabId = prefab.id;
      const dot = document.createElement("i");
      dot.className = `status-dot ${prefab.authored ? "saved" : "seeded"}`;
      const copy = document.createElement("span");
      copy.className = "prefab-item-copy";
      const name = document.createElement("strong");
      name.textContent = prefab.name;
      const dimensions = document.createElement("small");
      dimensions.textContent = `${prefab.width} × ${prefab.height} px · ${prefab.role}`;
      copy.append(name, dimensions);
      const status = document.createElement("em");
      status.textContent = prefab.authored ? `${prefab.polygonCount} poly` : "seed";
      button.append(dot, copy, status);
      button.addEventListener("click", () => void loadPrefab(prefab.id));
      prefabList.append(button);
    }
  }
  const saved = catalog.filter((prefab) => prefab.authored).length;
  doneCount.textContent = String(saved);
  untouchedCount.textContent = String(catalog.length - saved);
}

function displayName(id: string): string {
  return id.replaceAll("-", " ");
}

function renderHeading(): void {
  if (!current) return;
  prefabName.textContent = displayName(current.id);
  prefabDimensions.textContent = `${current.width} × ${current.height} native px`;
  prefabSource.textContent = current.source;
  authoringBadge.textContent = current.authored ? "SAVED COLLISION" : "UNTOUCHED · AUTO SEED";
  authoringBadge.classList.toggle("seed", !current.authored);
}

function applyZoom(): void {
  if (!current) return;
  canvas.style.width = `${current.width * zoom}px`;
  canvas.style.height = `${current.height * zoom}px`;
  canvasWrap.style.width = `${current.width * zoom}px`;
  canvasWrap.style.height = `${current.height * zoom}px`;
  nativeScaleLabel.textContent =
    zoom === 1 ? "Native pixels · 1:1" : `Inspection zoom · ${Math.round(zoom * 100)}%`;
  renderCanvas();
}

function pointPath(polygon: Polygon): void {
  const first = polygon[0];
  if (!first) return;
  context.moveTo(first[0], first[1]);
  for (const point of polygon.slice(1)) context.lineTo(point[0], point[1]);
  context.closePath();
}

function renderCanvas(): void {
  if (!current || !art) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(art, 0, 0, current.width, current.height);
  const screenLine = 1 / zoom;

  if (overlayVisible) {
    for (const [index, polygon] of polygons.entries()) {
      context.beginPath();
      pointPath(polygon);
      context.fillStyle =
        index === selectedPolygon ? "rgba(53, 232, 208, 0.31)" : "rgba(53, 232, 208, 0.22)";
      context.fill();
      context.lineWidth = (index === selectedPolygon ? 2.4 : 1.5) * screenLine;
      context.strokeStyle = index === selectedPolygon ? "#63ffe8" : "#35e8d0";
      context.stroke();
    }
  }

  if (selectedPolygon >= 0 && polygons[selectedPolygon]) {
    const polygon = polygons[selectedPolygon];
    if (!polygon) return;
    const radius = 4.5 * screenLine;
    for (const [index, point] of polygon.entries()) {
      context.beginPath();
      context.arc(point[0], point[1], radius, 0, Math.PI * 2);
      context.fillStyle = index === selectedVertex ? "#ff713d" : "#081013";
      context.fill();
      context.lineWidth = 1.5 * screenLine;
      context.strokeStyle = index === selectedVertex ? "#ffd1bf" : "#91fff0";
      context.stroke();
    }
  }

  if (draft.length > 0) {
    const firstDraftPoint = draft[0];
    if (!firstDraftPoint) return;
    context.save();
    context.beginPath();
    context.moveTo(firstDraftPoint[0], firstDraftPoint[1]);
    for (const point of draft.slice(1)) context.lineTo(point[0], point[1]);
    context.setLineDash([7 * screenLine, 5 * screenLine]);
    context.lineWidth = 2 * screenLine;
    context.strokeStyle = "#ff8c61";
    context.stroke();
    context.restore();
    for (const [index, point] of draft.entries()) {
      context.beginPath();
      context.arc(point[0], point[1], 4.5 * screenLine, 0, Math.PI * 2);
      context.fillStyle = index === 0 && draft.length >= 3 ? "#ff713d" : "#12181d";
      context.fill();
      context.lineWidth = 1.5 * screenLine;
      context.strokeStyle = "#ffc0a8";
      context.stroke();
    }
  }

  if (hoverPoint && draft.length === 0) {
    const state = standAt(hoverPoint);
    const color = state === "yes" ? "#35e8d0" : state === "edge" ? "#ffc167" : "#ff6472";
    context.beginPath();
    context.arc(hoverPoint[0], hoverPoint[1], footprintRadius, 0, Math.PI * 2);
    context.fillStyle =
      state === "yes"
        ? "rgba(53, 232, 208, 0.10)"
        : state === "edge"
          ? "rgba(255, 193, 103, 0.10)"
          : "rgba(255, 100, 114, 0.08)";
    context.fill();
    context.lineWidth = 1.5 * screenLine;
    context.strokeStyle = color;
    context.stroke();
    context.beginPath();
    context.arc(hoverPoint[0], hoverPoint[1], 2.5 * screenLine, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }
}

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (!currentPoint || !previousPoint) continue;
    const intersects =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1] &&
      point[0] <
        ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInWalkable(point: Point): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function standAt(point: Point): StandResult {
  if (!pointInWalkable(point)) return "no";
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const sample: Point = [
      point[0] + Math.cos(angle) * footprintRadius,
      point[1] + Math.sin(angle) * footprintRadius,
    ];
    if (!pointInWalkable(sample)) return "edge";
  }
  return "yes";
}

function updateStandReadout(point: Point | undefined): void {
  cursorCoordinate.textContent = point
    ? `x ${Math.round(point[0])} · y ${Math.round(point[1])}`
    : "x — · y —";
  const state = point ? standAt(point) : undefined;
  const className = state ?? "idle";
  standState.className = `stand-state ${className}`;
  standFigure.className = `stand-figure ${className}`;
  document.documentElement.dataset.standState = state ?? "idle";
  if (!state) {
    standState.textContent = "MOVE CURSOR";
    standTitle.textContent = "Probe the overlay";
    standDetail.textContent =
      "The filled cyan region is the exact polygon data the game will consume.";
  } else if (state === "yes") {
    standState.textContent = "YES";
    standTitle.textContent = "Full footprint supported";
    standDetail.textContent = `Center and 16 edge samples fit inside authored collision at ${footprintRadius} px radius.`;
  } else if (state === "edge") {
    standState.textContent = "EDGE";
    standTitle.textContent = "Center is valid, body clips edge";
    standDetail.textContent =
      "The game-facing point is walkable, but this preview footprint crosses the boundary.";
  } else {
    standState.textContent = "NO";
    standTitle.textContent = "Outside walkable collision";
    standDetail.textContent =
      "The cursor is over art that the saved polygons do not mark walkable.";
  }
}

function renderPolygonList(): void {
  polygonCount.textContent = String(polygons.length);
  polygonList.replaceChildren();
  if (polygons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "polygon-empty";
    empty.textContent = "No closed regions. Press P and click around the walkable surface.";
    polygonList.append(empty);
    return;
  }
  for (const [index, polygon] of polygons.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `polygon-row${index === selectedPolygon ? " active" : ""}`;
    const swatch = document.createElement("i");
    swatch.className = "polygon-swatch";
    const label = document.createElement("span");
    label.textContent = `Region ${index + 1}`;
    const vertices = document.createElement("small");
    vertices.textContent = `${polygon.length} vertices`;
    button.append(swatch, label, vertices);
    button.addEventListener("click", () => {
      selectedPolygon = index;
      selectedVertex = -1;
      setTool("select");
      updateEditorState();
    });
    polygonList.append(button);
  }
}

function setTool(next: Tool): void {
  tool = next;
  document.documentElement.dataset.tool = next;
  selectTool.classList.toggle("active", next === "select");
  polygonTool.classList.toggle("active", next === "polygon");
  selectTool.setAttribute("aria-pressed", String(next === "select"));
  polygonTool.setAttribute("aria-pressed", String(next === "polygon"));
  setStatus(
    next === "polygon"
      ? "Polygon tool: click vertices, then click the first point or press Enter to close."
      : "Select tool: click a region, drag its vertices, or use arrows for pixel nudges.",
  );
}

function confirmDiscard(reason: string): boolean {
  if (!dirty) return true;
  return window.confirm(
    `You have unsaved walkability edits. ${reason} will discard only the in-memory edits; the repo file is unchanged. Continue?`,
  );
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolveImage, rejectImage) => {
    image.addEventListener("load", () => resolveImage(), { once: true });
    image.addEventListener("error", () => rejectImage(new Error(`Could not load ${source}`)), {
      once: true,
    });
    image.src = `${source}?t=${Date.now()}`;
  });
  return image;
}

async function loadPrefab(id: string): Promise<void> {
  if (busy || current?.id === id) return;
  if (!confirmDiscard("Switching prefabs")) {
    renderCatalog();
    return;
  }
  busy = true;
  setStatus(`Loading ${displayName(id)} at native size…`);
  try {
    const response = await api<PrefabResponse>(
      `/api/walkability-painter/prefab/${encodeURIComponent(id)}`,
    );
    const image = await loadImage(response.artUrl);
    current = response;
    art = image;
    canvas.width = response.width;
    canvas.height = response.height;
    polygons = clonePolygonList(response.polygons);
    draft = [];
    selectedPolygon = polygons.length > 0 ? 0 : -1;
    selectedVertex = -1;
    undoStack = [];
    redoStack = [];
    baseline = serializePolygons();
    hoverPoint = undefined;
    applyZoom();
    updateStandReadout(undefined);
    renderHeading();
    renderCatalog();
    updateEditorState();
    document.documentElement.dataset.loadedPrefab = id;
    const parameters = new URLSearchParams(location.search);
    parameters.set("prefab", id);
    history.replaceState(null, "", `${location.pathname}?${parameters.toString()}`);
    requestAnimationFrame(() => {
      stageScroll.scrollLeft = Math.max(0, (response.width * zoom - stageScroll.clientWidth) / 2);
      stageScroll.scrollTop = Math.max(0, (response.height * zoom - stageScroll.clientHeight) / 2);
    });
    setStatus(
      response.authored
        ? `Loaded saved collision for ${id}. Edits stay in memory until Save collision.`
        : `Loaded untouched ${id} with an alpha-derived starting guess. Correct it, then save explicitly.`,
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
    throw error;
  } finally {
    busy = false;
  }
}

function pointerPoint(event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
  const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
  return [
    Math.max(0, Math.min(canvas.width, Math.round(x))),
    Math.max(0, Math.min(canvas.height, Math.round(y))),
  ];
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function nearestVertex(point: Point): { polygonIndex: number; vertexIndex: number } | undefined {
  const threshold = 10 / zoom;
  let nearest: { polygonIndex: number; vertexIndex: number; distance: number } | undefined;
  for (const [polygonIndex, polygon] of polygons.entries()) {
    for (const [vertexIndex, vertex] of polygon.entries()) {
      const candidateDistance = distance(point, vertex);
      if (candidateDistance <= threshold && (!nearest || candidateDistance < nearest.distance)) {
        nearest = { polygonIndex, vertexIndex, distance: candidateDistance };
      }
    }
  }
  return nearest;
}

function closeDraft(): void {
  if (draft.length < 3) {
    setStatus("A walkable polygon needs at least three vertices.", "error");
    return;
  }
  mutate(() => {
    polygons.push(structuredClone(draft));
    draft = [];
    selectedPolygon = polygons.length - 1;
    selectedVertex = -1;
  });
  setTool("select");
  setStatus("Polygon closed in memory. Save collision writes it to the repo.", "success");
}

function beginPointer(event: PointerEvent): void {
  if (!current || event.button !== 0) return;
  const point = pointerPoint(event);
  canvas.focus();
  if (tool === "polygon") {
    if (event.detail >= 2 && draft.length >= 3) {
      closeDraft();
      event.preventDefault();
      return;
    }
    if (draft.length >= 3 && draft[0] && distance(point, draft[0]) <= 12 / zoom) {
      closeDraft();
      event.preventDefault();
      return;
    }
    mutate(() => {
      draft.push(point);
      selectedPolygon = -1;
      selectedVertex = -1;
    });
    setStatus(
      draft.length < 3
        ? `Placed vertex ${draft.length}. Add ${3 - draft.length} more before closing.`
        : `Placed vertex ${draft.length}. Click the orange first point or press Enter to close.`,
    );
    event.preventDefault();
    return;
  }

  const vertex = nearestVertex(point);
  if (vertex) {
    selectedPolygon = vertex.polygonIndex;
    selectedVertex = vertex.vertexIndex;
    drag = {
      pointerId: event.pointerId,
      polygonIndex: vertex.polygonIndex,
      vertexIndex: vertex.vertexIndex,
      before: snapshot(),
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    document.documentElement.dataset.dragging = "vertex";
    updateEditorState();
    event.preventDefault();
    return;
  }

  selectedPolygon = -1;
  selectedVertex = -1;
  for (let index = polygons.length - 1; index >= 0; index -= 1) {
    const polygon = polygons[index];
    if (polygon && pointInPolygon(point, polygon)) {
      selectedPolygon = index;
      break;
    }
  }
  updateEditorState();
}

function movePointer(event: PointerEvent): void {
  if (!current) return;
  const point = pointerPoint(event);
  hoverPoint = point;
  updateStandReadout(point);
  if (drag && drag.pointerId === event.pointerId) {
    const polygon = polygons[drag.polygonIndex];
    const vertex = polygon?.[drag.vertexIndex];
    if (vertex && (vertex[0] !== point[0] || vertex[1] !== point[1])) {
      polygon[drag.vertexIndex] = point;
      drag.moved = true;
      updateDirty();
      renderCanvas();
    }
    event.preventDefault();
    return;
  }
  renderCanvas();
}

function endPointer(event: PointerEvent): void {
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.moved) {
    undoStack.push(drag.before);
    redoStack = [];
    setStatus("Vertex moved in native pixels. Save collision to persist it.", "success");
  }
  drag = undefined;
  delete document.documentElement.dataset.dragging;
  updateEditorState();
}

function leaveCanvas(): void {
  if (drag) return;
  hoverPoint = undefined;
  updateStandReadout(undefined);
  renderCanvas();
}

function undo(): void {
  const previous = undoStack.pop();
  if (!previous) return;
  redoStack.push(snapshot());
  restore(previous);
  setStatus("Undid the last in-memory edit.");
}

function redo(): void {
  const next = redoStack.pop();
  if (!next) return;
  undoStack.push(snapshot());
  restore(next);
  setStatus("Redid the in-memory edit.");
}

function deleteSelected(): void {
  if (selectedPolygon < 0 || !polygons[selectedPolygon]) return;
  const removed = selectedPolygon + 1;
  mutate(() => {
    polygons.splice(selectedPolygon, 1);
    selectedPolygon = Math.min(selectedPolygon, polygons.length - 1);
    selectedVertex = -1;
  });
  setStatus(`Removed region ${removed} in memory. Undo is available.`);
}

async function reseed(): Promise<void> {
  if (!current || busy) return;
  const confirmed = window.confirm(
    "Replace the current in-memory polygons with a fresh alpha-derived guess? Nothing on disk changes until Save collision.",
  );
  if (!confirmed) return;
  busy = true;
  try {
    const response = await api<SeedResponse>(
      `/api/walkability-painter/seed/${encodeURIComponent(current.id)}`,
    );
    mutate(() => {
      polygons = clonePolygonList(response.polygons);
      draft = [];
      selectedPolygon = polygons.length > 0 ? 0 : -1;
      selectedVertex = -1;
    });
    setStatus(
      "Restored the alpha-derived guess in memory. Save only after reviewing it.",
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    busy = false;
  }
}

async function saveCollision(): Promise<void> {
  if (!current || busy) return;
  if (draft.length > 0) {
    setStatus(
      "Close the active polygon with Enter, or cancel it with Escape, before saving.",
      "error",
    );
    return;
  }
  if (polygons.length === 0) {
    setStatus("At least one walkable polygon is required before saving.", "error");
    return;
  }
  busy = true;
  saveButton.disabled = true;
  setStatus(`Saving ${current.id}…`);
  try {
    const response = await api<SaveResponse>("/api/walkability-painter/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, polygons }),
    });
    polygons = clonePolygonList(response.polygons);
    current.polygons = clonePolygonList(response.polygons);
    current.authored = true;
    current.origin = "saved";
    baseline = serializePolygons();
    const summary = catalog.find((prefab) => prefab.id === current?.id);
    if (summary) {
      summary.authored = true;
      summary.polygonCount = response.polygonCount;
    }
    renderHeading();
    renderCatalog();
    updateEditorState();
    document.documentElement.dataset.lastSave = response.id;
    saveConfirmation.textContent = `Confirmed ${new Date(response.savedAt).toLocaleTimeString()} · ${response.dataFile}`;
    setStatus(
      `Saved and reloaded ${response.polygonCount} polygon${response.polygonCount === 1 ? "" : "s"} for ${response.id}.`,
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
}

function nudgeSelected(key: string, amount: number): void {
  const vertex = polygons[selectedPolygon]?.[selectedVertex];
  if (!vertex || !current) return;
  const selectedPrefab = current;
  const dx = key === "ArrowLeft" ? -amount : key === "ArrowRight" ? amount : 0;
  const dy = key === "ArrowUp" ? -amount : key === "ArrowDown" ? amount : 0;
  mutate(() => {
    vertex[0] = Math.max(0, Math.min(selectedPrefab.width, vertex[0] + dx));
    vertex[1] = Math.max(0, Math.min(selectedPrefab.height, vertex[1] + dy));
  });
  setStatus(`Nudged selected vertex ${dx}, ${dy} native px.`);
}

function toggleOverlay(): void {
  overlayVisible = !overlayVisible;
  overlayButton.classList.toggle("active", overlayVisible);
  overlayButton.setAttribute("aria-pressed", String(overlayVisible));
  renderCanvas();
  setStatus(overlayVisible ? "Collision overlay visible." : "Collision overlay hidden.");
}

canvas.addEventListener("pointerdown", beginPointer);
canvas.addEventListener("pointermove", movePointer);
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", leaveCanvas);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
prefabSearch.addEventListener("input", renderCatalog);
selectTool.addEventListener("click", () => setTool("select"));
polygonTool.addEventListener("click", () => setTool("polygon"));
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
deleteButton.addEventListener("click", deleteSelected);
reseedButton.addEventListener("click", () => void reseed());
saveButton.addEventListener("click", () => void saveCollision());
overlayButton.addEventListener("click", toggleOverlay);
zoomSelect.addEventListener("change", () => {
  zoom = Number(zoomSelect.value);
  applyZoom();
});
radiusInput.addEventListener("input", () => {
  footprintRadius = Number(radiusInput.value);
  radiusOutput.value = `${footprintRadius} px`;
  updateStandReadout(hoverPoint);
  renderCanvas();
});

document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  const editingText =
    target?.matches("input, select, textarea") === true || target?.isContentEditable === true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveCollision();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if (editingText) return;
  if (event.key.toLowerCase() === "p") setTool("polygon");
  else if (event.key.toLowerCase() === "v") setTool("select");
  else if (event.key.toLowerCase() === "o") toggleOverlay();
  else if (event.key.toLowerCase() === "a") void reseed();
  else if (event.key === "Enter" && draft.length >= 3) closeDraft();
  else if (event.key === "Escape" && draft.length > 0) {
    mutate(() => {
      draft = [];
    });
    setTool("select");
    setStatus("Cancelled the open polygon. Undo can restore it.");
  } else if (event.key === "Backspace" && draft.length > 0) {
    mutate(() => {
      draft.pop();
    });
    setStatus("Removed the last open-polygon vertex.");
  } else if (event.key === "Delete") deleteSelected();
  else if (
    selectedVertex >= 0 &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    nudgeSelected(event.key, event.shiftKey ? 10 : 1);
    event.preventDefault();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

async function bootstrap(): Promise<void> {
  setTool("select");
  const response = await api<CatalogResponse>("/api/walkability-painter/catalog");
  catalog = response.prefabs;
  if (catalog.length === 0) {
    throw new Error(
      "No platform prefabs were found. Set LAVA_PACKAGE_ROOT to the lava V9 handoff package.",
    );
  }
  renderCatalog();
  const requested = new URLSearchParams(location.search).get("prefab");
  const initial =
    catalog.find((prefab) => prefab.id === requested)?.id ??
    catalog.find((prefab) => prefab.id === "broken-turntable-arena")?.id ??
    catalog[0]?.id;
  if (!initial) throw new Error("The prefab catalog is empty.");
  await loadPrefab(initial);
  document.documentElement.dataset.walkabilityReady = "true";
}

void bootstrap().catch((error) => {
  setStatus(error instanceof Error ? error.message : String(error), "error");
  document.documentElement.dataset.walkabilityReady = "error";
});
