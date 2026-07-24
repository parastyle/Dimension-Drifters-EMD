import { MAX_MONEY_DROPS, type MoneyDropState } from "@dd/shared";
import Phaser from "phaser";

const DROP_DEPTH = 99_981;

interface Point {
  x: number;
  y: number;
}

interface MoneyDropCallbacks {
  target(playerId: string, out: Point): boolean;
  project(x: number, y: number, out: Point): void;
  receipt(value: number): void;
}

type MoneyDropRows = Iterable<[string, MoneyDropState]>;

/** Fixed-pool renderer for the authoritative money-drop map. */
export class MoneyDropRenderer {
  private readonly coins: Phaser.GameObjects.Arc[] = [];
  private readonly marks: Phaser.GameObjects.Text[] = [];
  private readonly slotById = new Map<string, number>();
  private readonly ids = new Array<string>(MAX_MONEY_DROPS).fill("");
  private readonly active = new Uint8Array(MAX_MONEY_DROPS);
  private readonly delivered = new Uint8Array(MAX_MONEY_DROPS);
  private readonly seen = new Uint32Array(MAX_MONEY_DROPS);
  private generation = 0;
  private readonly origin: Point = { x: 0, y: 0 };
  private readonly targetPoint: Point = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private readonly callbacks: MoneyDropCallbacks,
  ) {
    for (let i = 0; i < MAX_MONEY_DROPS; i++) {
      this.coins.push(
        scene.add
          .circle(0, 0, 8, 0xf6c84a, 0.96)
          .setStrokeStyle(2, 0x5b3510, 1)
          .setDepth(DROP_DEPTH)
          .setVisible(false),
      );
      this.marks.push(
        scene.add
          .text(0, 0, "$", {
            color: "#402100",
            fontFamily: "monospace",
            fontSize: "12px",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setDepth(DROP_DEPTH + 1)
          .setVisible(false),
      );
    }
  }

  update(rows: MoneyDropRows, renderTick: number): void {
    this.generation = (this.generation + 1) >>> 0 || 1;
    for (const [id, drop] of rows) {
      const slot = this.slotById.get(id) ?? this.acquire(id);
      if (slot < 0) continue;
      this.seen[slot] = this.generation;
      if (drop.delivered) {
        if (this.delivered[slot] === 0) this.callbacks.receipt(drop.value);
        this.delivered[slot] = 1;
        this.hide(slot);
        continue;
      }
      this.delivered[slot] = 0;
      this.callbacks.project(drop.x, drop.y, this.origin);
      let x = this.origin.x;
      let y = this.origin.y + Math.sin(renderTick * 0.22 + drop.seed) * 3;
      if (drop.collectorId && this.callbacks.target(drop.collectorId, this.targetPoint)) {
        const span = Math.max(1, drop.collectTick - drop.launchTick);
        const t = Phaser.Math.Clamp((renderTick - drop.launchTick) / span, 0, 0.96);
        const eased = t * t * (3 - 2 * t);
        x += (this.targetPoint.x - x) * eased;
        y += (this.targetPoint.y - y) * eased;
      }
      const tier = drop.value >= 40 ? 1.5 : drop.value >= 10 ? 1.25 : 1;
      this.coins[slot]?.setPosition(x, y).setScale(tier).setVisible(true);
      this.marks[slot]?.setPosition(x, y).setScale(tier).setVisible(true);
    }
    for (let slot = 0; slot < MAX_MONEY_DROPS; slot++) {
      if (this.active[slot] !== 0 && this.seen[slot] !== this.generation) this.release(slot);
    }
  }

  clear(): void {
    for (let slot = 0; slot < MAX_MONEY_DROPS; slot++) {
      if (this.active[slot] !== 0) this.release(slot);
    }
  }

  destroy(): void {
    this.slotById.clear();
    for (const coin of this.coins) coin.destroy();
    for (const mark of this.marks) mark.destroy();
  }

  private acquire(id: string): number {
    for (let slot = 0; slot < MAX_MONEY_DROPS; slot++) {
      if (this.active[slot] !== 0) continue;
      this.active[slot] = 1;
      this.ids[slot] = id;
      this.delivered[slot] = 0;
      this.slotById.set(id, slot);
      return slot;
    }
    return -1;
  }

  private release(slot: number): void {
    const id = this.ids[slot] ?? "";
    if (id) this.slotById.delete(id);
    this.ids[slot] = "";
    this.active[slot] = 0;
    this.delivered[slot] = 0;
    this.hide(slot);
  }

  private hide(slot: number): void {
    this.coins[slot]?.setVisible(false);
    this.marks[slot]?.setVisible(false);
  }
}
