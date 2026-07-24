import { CombatDelivery, type WeaponDef } from "@dd/shared";

export const PREDICT_TTL_MS = 250;

const VFX_HUE_STOPS = [
  0xff4d3a,
  0xff8a2b,
  0xd6ff5a,
  0x6fd6ff,
  0x9cff3b,
  0x6f8bff,
  0xb07bd6,
  0xff4d3a,
] as const;

/** Keep receipt-owned chain hops in the same authored hue family as the weapon's chain recipe. */
export function chainLightningReceiptColor(weapon: Readonly<WeaponDef> | undefined): number {
  const hue = weapon?.chainLightning?.vfx?.color;
  if (Number.isFinite(hue)) {
    const index = Math.min(
      VFX_HUE_STOPS.length - 2,
      Math.floor(Math.max(0, Math.min(1, hue ?? 0)) * (VFX_HUE_STOPS.length - 1)),
    );
    return VFX_HUE_STOPS[index] ?? 0x6fd6ff;
  }
  return weapon?.gun?.projectileColor ?? 0x5dd6ff;
}

export type DeliveryGroup = "melee" | "gun" | "cast" | "thrown" | "quake";
export type ContactLayer = "instant" | "upgrade" | "full" | "ambient";
export type DamageAttribution = "self" | "teammate" | "mixed" | "unattributed";
export type ConfirmCue =
  | "confirm:hit"
  | "confirm:armor"
  | "confirm:ratchet"
  | "confirm:crit"
  | "confirm:kill";

export interface CombatReceiptLike {
  seq?: number;
  tick?: number;
  targetId?: string;
  sourcePlayerId?: string;
  weaponId?: string;
  delivery?: number;
  element?: string;
  dirX?: number;
  dirY?: number;
  damage?: number;
  crit?: boolean;
  finalBlow?: boolean;
}

export interface CombatReceiptRows {
  forEach(callback: (row: CombatReceiptLike, id: string | number) => void): void;
}

export interface PredictedContact {
  targetId: string;
  delivery: number;
  weaponId?: string;
  element?: string;
  dirX?: number;
  dirY?: number;
  x?: number;
  y?: number;
}

/** Reused for synchronous subscribers; listeners must copy fields they need after the callback. */
export interface HitContactEvent {
  layer: ContactLayer;
  targetId: string;
  sourcePlayerId: string;
  selfHit: boolean;
  matchedPrediction: boolean;
  weaponId: string;
  delivery: number;
  element: string;
  dirX: number;
  dirY: number;
  damage: number;
  crit: boolean;
  finalBlow: boolean;
  tick: number;
  x: number;
  y: number;
}

export interface AuthoritativeHpDelta {
  targetId: string;
  /** The only arithmetic admitted to the damage-number outlet: previous authoritative HP minus new HP. */
  damage: number;
  x: number;
  y: number;
  visible: boolean;
  selfDamage?: boolean;
}

/** Reused for synchronous subscribers; receipt damage can never construct this event. */
export interface DamageNumberEvent {
  targetId: string;
  damage: number;
  x: number;
  y: number;
  visible: boolean;
  attribution: DamageAttribution;
  crit: boolean;
  finalBlow: boolean;
  selfDamage: boolean;
}

export interface ConfirmEvent {
  cue: ConfirmCue;
  /** Gain/intensity input. Damage magnitude never changes pitch. Kill-rung amt is semantic. */
  amount: number;
}

interface PredictEntry {
  atMs: number;
  charges: number;
}

interface ReceiptDecoration {
  atMs: number;
  receiptDamage: number;
  self: boolean;
  teammate: boolean;
  crit: boolean;
  finalBlow: boolean;
}

type CompleteReceipt = Required<CombatReceiptLike>;

function createReceiptScratch(): CompleteReceipt {
  return {
    seq: 0,
    tick: 0,
    targetId: "",
    sourcePlayerId: "",
    weaponId: "",
    delivery: 0,
    element: "physical",
    dirX: 0,
    dirY: 0,
    damage: 0,
    crit: false,
    finalBlow: false,
  };
}

export function seqAfter(a: number, b: number): boolean {
  const aa = a >>> 0;
  const bb = b >>> 0;
  return aa !== bb && (aa - bb) >>> 0 < 0x8000_0000;
}

/** Count published sequence steps, accounting for the ring contract that uint32 zero is skipped. */
export function seqDistance(after: number, before: number): number {
  const aa = after >>> 0;
  const bb = before >>> 0;
  let distance = (aa - bb) >>> 0;
  if (aa < bb && aa !== 0 && bb !== 0 && distance > 0) distance--;
  return distance;
}

export function deliveryGroup(delivery: number): DeliveryGroup {
  switch (delivery) {
    case CombatDelivery.Melee:
    case CombatDelivery.Parry:
      return "melee";
    case CombatDelivery.Gun:
    case CombatDelivery.Scatter:
    case CombatDelivery.Chain:
      return "gun";
    case CombatDelivery.Cast:
    case CombatDelivery.Beam:
    case CombatDelivery.Warp:
      return "cast";
    case CombatDelivery.Thrown:
      return "thrown";
    case CombatDelivery.Quake:
      return "quake";
    default:
      return "cast";
  }
}

export class TokenBucket {
  private tokens: number;
  private lastMs = Number.NaN;

  constructor(
    readonly capacity: number,
    readonly refillPerSec: number,
  ) {
    this.tokens = Math.max(0, capacity);
  }

  tryTake(nowMs: number, cost = 1): boolean {
    const safeCost = Math.max(0, cost);
    if (Number.isFinite(this.lastMs)) {
      const elapsed = Math.max(0, nowMs - this.lastMs);
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed * this.refillPerSec) / 1000);
    }
    this.lastMs = nowMs;
    if (this.tokens + 1e-9 < safeCost) return false;
    this.tokens -= safeCost;
    return true;
  }

  pay(nowMs: number, cost = 1): void {
    this.tryTake(nowMs, 0);
    this.tokens = Math.max(0, this.tokens - Math.max(0, cost));
  }

  get available(): number {
    return this.tokens;
  }
}

/** Shared merge-never-drop primitive for rate-limited channels. */
export class MagnitudeCoalescer {
  count = 0;
  total = 0;
  strongest = 0;

  add(magnitude: number): void {
    const value = Math.max(0, magnitude);
    this.count++;
    this.total += value;
    this.strongest = Math.max(this.strongest, value);
  }

  clear(): void {
    this.count = 0;
    this.total = 0;
    this.strongest = 0;
  }
}

class ConfirmDirector {
  private readonly eventTimes = new Float64Array(64);
  private eventCursor = 0;
  private eventCount = 0;
  private readonly frameTimes = new Float64Array(16);
  private frameCursor = 0;
  private frameCount = 0;
  private frameSerial = 0;
  private recordedFrame = -1;
  private ratchet = false;
  private lastReceiptAt = -1e9;
  private lastDiscreteAt = -1e9;
  private lastRatchetAt = -1e9;
  private lastBeamPulseAt = -1e9;
  private readonly beamTargets = new Set<string>();
  private beamDamage = 0;
  private lastKillAt = -1e9;
  private killStreak = 0;
  private readonly pending = new MagnitudeCoalescer();

  beginFrame(): void {
    this.frameSerial++;
  }

  ordinary(
    delivery: number,
    damage: number,
    crit: boolean,
    finalBlow: boolean,
    nowMs: number,
    emit: (cue: ConfirmCue, amount: number) => void,
    targetId = "",
  ): void {
    if (delivery === CombatDelivery.Parry) return;
    if (finalBlow) {
      this.killStreak = nowMs - this.lastKillAt <= 1000 ? Math.min(4, this.killStreak + 1) : 1;
      this.lastKillAt = nowMs;
      emit("confirm:kill", (this.killStreak - 1) / 3);
    } else if (crit) {
      emit("confirm:crit", Math.min(1, Math.max(0.2, damage / 45)));
    }

    if (delivery === CombatDelivery.Beam) {
      if (!crit && !finalBlow) {
        if (targetId) this.beamTargets.add(targetId);
        this.beamDamage += Math.max(0, damage);
      }
      return;
    }

    this.pushEvent(nowMs);
    if (this.recordedFrame !== this.frameSerial) {
      this.recordedFrame = this.frameSerial;
      this.pushFrame(nowMs);
    }
    this.lastReceiptAt = nowMs;
    if (!this.ratchet && this.countRecent(this.frameTimes, this.frameCount, nowMs, 300) >= 5)
      this.ratchet = true;
    if (crit || finalBlow) return;
    this.pending.add(damage);
  }

  update(nowMs: number, emit: (cue: ConfirmCue, amount: number) => void): void {
    const recent = this.countRecent(this.eventTimes, this.eventCount, nowMs, 300);
    if (this.ratchet) {
      if (nowMs - this.lastReceiptAt > 250 && recent < 3) {
        this.ratchet = false;
        this.pending.clear();
      } else if (nowMs - this.lastReceiptAt <= 100 && nowMs - this.lastRatchetAt >= 55) {
        emit("confirm:ratchet", Math.max(0, Math.min(1, (recent - 5) / 10)));
        this.lastRatchetAt = nowMs;
        this.pending.clear();
      }
    } else if (this.pending.count > 0 && nowMs - this.lastDiscreteAt >= 45) {
      this.flushDiscrete(nowMs, emit);
    }

    if (this.beamTargets.size > 0 && nowMs - this.lastBeamPulseAt >= 260) {
      const density = Math.min(1, this.beamTargets.size / 6);
      const magnitude = Math.min(1, this.beamDamage / 90);
      emit("confirm:hit", Math.max(0.2, density * 0.75 + magnitude * 0.25));
      this.lastBeamPulseAt = nowMs;
      this.beamTargets.clear();
      this.beamDamage = 0;
    }
  }

  reset(): void {
    this.eventCursor = 0;
    this.eventCount = 0;
    this.frameCursor = 0;
    this.frameCount = 0;
    this.frameSerial = 0;
    this.recordedFrame = -1;
    this.ratchet = false;
    this.lastReceiptAt = -1e9;
    this.lastDiscreteAt = -1e9;
    this.lastRatchetAt = -1e9;
    this.lastBeamPulseAt = -1e9;
    this.beamTargets.clear();
    this.beamDamage = 0;
    this.lastKillAt = -1e9;
    this.killStreak = 0;
    this.pending.clear();
  }

  private flushDiscrete(nowMs: number, emit: (cue: ConfirmCue, amount: number) => void): void {
    const amount = Math.min(
      1,
      this.pending.total / 45 + Math.max(0, this.pending.count - 1) * 0.08,
    );
    emit("confirm:hit", Math.max(0.12, amount));
    this.lastDiscreteAt = nowMs;
    this.pending.clear();
  }

  private pushEvent(nowMs: number): void {
    this.eventTimes[this.eventCursor] = nowMs;
    this.eventCursor = (this.eventCursor + 1) % this.eventTimes.length;
    this.eventCount = Math.min(this.eventTimes.length, this.eventCount + 1);
  }

  private pushFrame(nowMs: number): void {
    this.frameTimes[this.frameCursor] = nowMs;
    this.frameCursor = (this.frameCursor + 1) % this.frameTimes.length;
    this.frameCount = Math.min(this.frameTimes.length, this.frameCount + 1);
  }

  private countRecent(
    buffer: Float64Array,
    count: number,
    nowMs: number,
    windowMs: number,
  ): number {
    let recent = 0;
    for (let i = 0; i < count; i++) if (nowMs - buffer[i]! <= windowMs) recent++;
    return recent;
  }
}

/**
 * The one combat-feedback dispatcher. Predicted contacts may emit only the cheap instant layer; receipts
 * upgrade or provide a full fallback. Damage-number subscribers are reachable solely through HP deltas.
 */
export class CombatFeedback {
  private readonly contactListeners = new Set<(event: HitContactEvent) => void>();
  private readonly damageListeners = new Set<(event: DamageNumberEvent) => void>();
  private readonly confirmListeners = new Set<(event: ConfirmEvent) => void>();
  private readonly predictLedger = new Map<string, PredictEntry>();
  private readonly receiptTouched = new Set<string>();
  private readonly decorations = new Map<string, ReceiptDecoration>();
  private readonly freshReceipts: CompleteReceipt[] = Array.from({ length: 64 }, () =>
    createReceiptScratch(),
  );
  private readonly confirm = new ConfirmDirector();
  private lastSeenSeq: number | null = null;
  private nowMs = 0;
  receiptsDropped = 0;

  private readonly contactEvent: HitContactEvent = {
    layer: "instant",
    targetId: "",
    sourcePlayerId: "",
    selfHit: false,
    matchedPrediction: false,
    weaponId: "",
    delivery: 0,
    element: "physical",
    dirX: 0,
    dirY: 0,
    damage: 0,
    crit: false,
    finalBlow: false,
    tick: 0,
    x: 0,
    y: 0,
  };

  private readonly damageEvent: DamageNumberEvent = {
    targetId: "",
    damage: 0,
    x: 0,
    y: 0,
    visible: false,
    attribution: "unattributed",
    crit: false,
    finalBlow: false,
    selfDamage: false,
  };

  private readonly confirmEvent: ConfirmEvent = { cue: "confirm:hit", amount: 0 };

  beginFrame(nowMs: number): void {
    this.nowMs = nowMs;
    this.receiptTouched.clear();
    this.confirm.beginFrame();
    this.sweepPredictions(nowMs);
    for (const [targetId, decoration] of this.decorations) {
      if (nowMs - decoration.atMs > PREDICT_TTL_MS) this.decorations.delete(targetId);
    }
  }

  endFrame(nowMs = this.nowMs): void {
    this.confirm.update(nowMs, (cue, amount) => this.emitConfirm(cue, amount));
  }

  reset(): void {
    this.predictLedger.clear();
    this.receiptTouched.clear();
    this.decorations.clear();
    this.lastSeenSeq = null;
    this.receiptsDropped = 0;
    this.confirm.reset();
  }

  subscribeContact(listener: (event: HitContactEvent) => void): () => void {
    this.contactListeners.add(listener);
    return () => this.contactListeners.delete(listener);
  }

  subscribeDamage(listener: (event: DamageNumberEvent) => void): () => void {
    this.damageListeners.add(listener);
    return () => this.damageListeners.delete(listener);
  }

  subscribeConfirm(listener: (event: ConfirmEvent) => void): () => void {
    this.confirmListeners.add(listener);
    return () => this.confirmListeners.delete(listener);
  }

  onPredictedContact(event: PredictedContact, nowMs = this.nowMs): void {
    if (!event.targetId) return;
    const key = this.ledgerKey(event.targetId, event.delivery);
    const entry = this.predictLedger.get(key);
    if (entry && nowMs - entry.atMs <= PREDICT_TTL_MS) {
      entry.atMs = nowMs;
      entry.charges++;
    } else {
      this.predictLedger.set(key, { atMs: nowMs, charges: 1 });
    }
    this.fillContact(
      "instant",
      event.targetId,
      "",
      true,
      false,
      event.weaponId ?? "",
      event.delivery,
      event.element ?? "physical",
      event.dirX ?? 0,
      event.dirY ?? 0,
      0,
      false,
      false,
      0,
      event.x ?? 0,
      event.y ?? 0,
    );
    this.emitContact();
    this.confirm.ordinary(
      event.delivery,
      6,
      false,
      false,
      nowMs,
      (cue, amount) => this.emitConfirm(cue, amount),
      event.targetId,
    );
  }

  drainReceipts(rows: CombatReceiptRows | undefined, selfId: string, nowMs = this.nowMs): void {
    if (!rows) return;
    if (this.lastSeenSeq === null) {
      let newest = 0;
      rows.forEach((row) => {
        const seq = (row.seq ?? 0) >>> 0;
        if (seq !== 0 && (newest === 0 || seqAfter(seq, newest))) newest = seq;
      });
      // Attaching to an empty preallocated ring is still an attachment. Leaving this null would make
      // the first later receipt look like stale bootstrap data and silently swallow the first real hit.
      this.lastSeenSeq = newest;
      return;
    }

    const baseline = this.lastSeenSeq;
    let freshCount = 0;
    rows.forEach((row) => {
      const seq = (row.seq ?? 0) >>> 0;
      if (seq === 0 || !seqAfter(seq, baseline)) return;
      const fresh = this.freshReceipts[freshCount] ?? createReceiptScratch();
      if (freshCount >= this.freshReceipts.length) this.freshReceipts.push(fresh);
      fresh.seq = seq;
      fresh.tick = (row.tick ?? 0) >>> 0;
      fresh.targetId = row.targetId ?? "";
      fresh.sourcePlayerId = row.sourcePlayerId ?? "";
      fresh.weaponId = row.weaponId ?? "";
      fresh.delivery = row.delivery ?? 0;
      fresh.element = row.element ?? "physical";
      fresh.dirX = row.dirX ?? 0;
      fresh.dirY = row.dirY ?? 0;
      fresh.damage = Math.max(0, row.damage ?? 0);
      fresh.crit = row.crit === true;
      fresh.finalBlow = row.finalBlow === true;
      freshCount++;
    });
    if (freshCount === 0) return;
    // Fixed ring is tiny; insertion-sort the active prefix in place so steady-state drains allocate zero.
    for (let index = 1; index < freshCount; index++) {
      let cursor = index;
      while (
        cursor > 0 &&
        seqDistance(this.freshReceipts[cursor]?.seq ?? 0, baseline) <
          seqDistance(this.freshReceipts[cursor - 1]?.seq ?? 0, baseline)
      ) {
        const previous = this.freshReceipts[cursor - 1];
        const current = this.freshReceipts[cursor];
        if (!previous || !current) break;
        this.freshReceipts[cursor - 1] = current;
        this.freshReceipts[cursor] = previous;
        cursor--;
      }
    }
    const newest = this.freshReceipts[freshCount - 1];
    if (!newest) return;
    this.receiptsDropped += Math.max(0, seqDistance(newest.seq, baseline) - freshCount);

    for (let index = 0; index < freshCount; index++) {
      const receipt = this.freshReceipts[index];
      if (receipt) this.dispatchReceipt(receipt, selfId, nowMs);
    }
    this.lastSeenSeq = newest.seq;
  }

  ingestHpDelta(delta: AuthoritativeHpDelta, nowMs = this.nowMs): void {
    if (!(delta.damage > 0)) return;
    const decoration = delta.selfDamage ? undefined : this.decorations.get(delta.targetId);
    let attribution: DamageAttribution = delta.selfDamage ? "self" : "unattributed";
    let crit = false;
    let finalBlow = false;
    if (decoration && nowMs - decoration.atMs <= PREDICT_TTL_MS) {
      const incomplete = decoration.receiptDamage + 0.5 < delta.damage;
      if (incomplete) {
        attribution = "mixed";
      } else {
        if (decoration.self && decoration.teammate) attribution = "mixed";
        else if (decoration.self) attribution = "self";
        else if (decoration.teammate) attribution = "teammate";
        crit = decoration.crit;
        finalBlow = decoration.finalBlow;
      }
      // A partial ring view is classified as mixed (known receipts + unknown residual), but proves
      // neither which semantic flags belonged to the missing arithmetic. Keep the exact HP delta and
      // deliberately strip every receipt-only semantic decoration.
      this.decorations.delete(delta.targetId);
    }
    const event = this.damageEvent;
    event.targetId = delta.targetId;
    event.damage = delta.damage;
    event.x = delta.x;
    event.y = delta.y;
    event.visible = delta.visible;
    event.attribution = attribution;
    event.crit = crit;
    event.finalBlow = finalBlow;
    event.selfDamage = delta.selfDamage === true;
    for (const listener of this.damageListeners) listener(event);
  }

  wasReceiptTouched(targetId: string): boolean {
    return this.receiptTouched.has(targetId);
  }

  private dispatchReceipt(receipt: CompleteReceipt, selfId: string, nowMs: number): void {
    if (!receipt.targetId) return;
    const selfHit = receipt.sourcePlayerId === selfId;
    const matchedPrediction = selfHit && this.consumePrediction(receipt, nowMs);
    const layer: ContactLayer = selfHit ? (matchedPrediction ? "upgrade" : "full") : "ambient";
    this.receiptTouched.add(receipt.targetId);
    this.addDecoration(receipt, selfHit, nowMs);
    this.fillContact(
      layer,
      receipt.targetId,
      receipt.sourcePlayerId,
      selfHit,
      matchedPrediction,
      receipt.weaponId,
      receipt.delivery,
      receipt.element,
      receipt.dirX,
      receipt.dirY,
      receipt.damage,
      receipt.crit,
      receipt.finalBlow,
      receipt.tick,
      0,
      0,
    );
    this.emitContact();
    if (selfHit) {
      if (
        !matchedPrediction ||
        receipt.crit ||
        receipt.finalBlow ||
        receipt.delivery === CombatDelivery.Beam
      )
        this.confirm.ordinary(
          receipt.delivery,
          receipt.damage,
          receipt.crit,
          receipt.finalBlow,
          nowMs,
          (cue, amount) => this.emitConfirm(cue, amount),
          receipt.targetId,
        );
    }
  }

  private addDecoration(receipt: CompleteReceipt, selfHit: boolean, nowMs: number): void {
    let decoration = this.decorations.get(receipt.targetId);
    if (!decoration || nowMs - decoration.atMs > PREDICT_TTL_MS) {
      decoration = {
        atMs: nowMs,
        receiptDamage: 0,
        self: false,
        teammate: false,
        crit: false,
        finalBlow: false,
      };
      this.decorations.set(receipt.targetId, decoration);
    }
    decoration.atMs = nowMs;
    decoration.receiptDamage += receipt.damage;
    decoration.self ||= selfHit;
    decoration.teammate ||= !selfHit;
    decoration.crit ||= receipt.crit;
    decoration.finalBlow ||= receipt.finalBlow;
  }

  private consumePrediction(receipt: CompleteReceipt, nowMs: number): boolean {
    const key = this.ledgerKey(receipt.targetId, receipt.delivery);
    const entry = this.predictLedger.get(key);
    if (!entry || entry.charges <= 0 || nowMs - entry.atMs > PREDICT_TTL_MS) {
      if (entry) this.predictLedger.delete(key);
      return false;
    }
    entry.charges--;
    if (entry.charges <= 0) this.predictLedger.delete(key);
    return true;
  }

  private sweepPredictions(nowMs: number): void {
    for (const [key, entry] of this.predictLedger)
      if (nowMs - entry.atMs > PREDICT_TTL_MS) this.predictLedger.delete(key);
  }

  private ledgerKey(targetId: string, delivery: number): string {
    return `${targetId}|${deliveryGroup(delivery)}`;
  }

  private fillContact(
    layer: ContactLayer,
    targetId: string,
    sourcePlayerId: string,
    selfHit: boolean,
    matchedPrediction: boolean,
    weaponId: string,
    delivery: number,
    element: string,
    dirX: number,
    dirY: number,
    damage: number,
    crit: boolean,
    finalBlow: boolean,
    tick: number,
    x: number,
    y: number,
  ): void {
    const event = this.contactEvent;
    event.layer = layer;
    event.targetId = targetId;
    event.sourcePlayerId = sourcePlayerId;
    event.selfHit = selfHit;
    event.matchedPrediction = matchedPrediction;
    event.weaponId = weaponId;
    event.delivery = delivery;
    event.element = element;
    event.dirX = dirX;
    event.dirY = dirY;
    event.damage = damage;
    event.crit = crit;
    event.finalBlow = finalBlow;
    event.tick = tick;
    event.x = x;
    event.y = y;
  }

  private emitContact(): void {
    for (const listener of this.contactListeners) listener(this.contactEvent);
  }

  private emitConfirm(cue: ConfirmCue, amount: number): void {
    this.confirmEvent.cue = cue;
    this.confirmEvent.amount = Math.max(0, Math.min(1, amount));
    for (const listener of this.confirmListeners) listener(this.confirmEvent);
  }
}
