import { MovementCorrectionBand } from "@dd/shared";
import type { SelfCorrectionCause, SelfCorrectionEvent } from "./prediction.js";

export interface SelfCorrectionTelemetrySnapshot {
  corrections: number;
  silent: number;
  smooth: number;
  snaps: number;
  maxCorrectionPx: number;
  stallResync: number;
  envelopeViolation: number;
  teleports: number;
  longFrames: number;
  maxFrameMs: number;
}

/** Allocation-free running totals for the dev-only L10 HUD/console instrument. */
export class SelfCorrectionTelemetry {
  private readonly totals: SelfCorrectionTelemetrySnapshot = {
    corrections: 0,
    silent: 0,
    smooth: 0,
    snaps: 0,
    maxCorrectionPx: 0,
    stallResync: 0,
    envelopeViolation: 0,
    teleports: 0,
    longFrames: 0,
    maxFrameMs: 0,
  };

  reset(): void {
    for (const key of Object.keys(this.totals) as Array<keyof SelfCorrectionTelemetrySnapshot>)
      this.totals[key] = 0;
  }

  recordCorrection(event: Readonly<SelfCorrectionEvent>): void {
    this.totals.corrections++;
    this.totals.maxCorrectionPx = Math.max(this.totals.maxCorrectionPx, event.magnitudePx);
    if (event.band === MovementCorrectionBand.Silent) this.totals.silent++;
    else if (event.band === MovementCorrectionBand.Smooth) this.totals.smooth++;
    else this.totals.snaps++;

    if (event.cause === "stall-resync") this.totals.stallResync++;
    else if (event.cause === "envelope-violation") this.totals.envelopeViolation++;
    else this.totals.teleports++;
  }

  recordLongFrame(durationMs: number): void {
    this.totals.longFrames++;
    this.totals.maxFrameMs = Math.max(this.totals.maxFrameMs, durationMs);
  }

  snapshot(): Readonly<SelfCorrectionTelemetrySnapshot> {
    return this.totals;
  }

  summaryLine(): string {
    const t = this.totals;
    return (
      `L10 SELF · ${t.corrections} corrections ` +
      `(${t.silent} silent / ${t.smooth} smooth / ${t.snaps} snap) · ` +
      `max ${t.maxCorrectionPx.toFixed(1)}px · ` +
      `causes ${t.stallResync} stall-resync / ${t.envelopeViolation} envelope-violation / ` +
      `${t.teleports} teleport · ` +
      `>250ms ${t.longFrames} (max ${t.maxFrameMs.toFixed(1)}ms)`
    );
  }
}

export function selfCorrectionBandLabel(event: Readonly<SelfCorrectionEvent>): string {
  if (event.band === MovementCorrectionBand.Silent) return "silent";
  if (event.band === MovementCorrectionBand.Smooth) return "smooth";
  return "snap";
}

export function selfCorrectionCauseLabel(cause: SelfCorrectionCause): string {
  return cause;
}
