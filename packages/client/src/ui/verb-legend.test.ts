import { describe, expect, it, vi } from "vitest";
import { type OnboardingSettings, sanitizeSettings } from "../settings.js";
import { VerbLegendManager, type VerbLegendSurface } from "./verb-legend.js";

class FakeSurface implements VerbLegendSurface {
  legendVisible = false;
  hintVisible = false;
  hintCopy = "";
  hintColor = "";
  hintAlpha = 0;

  layout(): void {}

  setLegendVisible(visible: boolean): void {
    this.legendVisible = visible;
  }

  showHint(copy: string, color: string): void {
    this.hintVisible = true;
    this.hintCopy = copy;
    this.hintColor = color;
  }

  setHintAlpha(alpha: number): void {
    this.hintAlpha = alpha;
  }

  hideHint(): void {
    this.hintVisible = false;
    this.hintAlpha = 0;
  }

  destroy(): void {}
}

function onboarding(overrides: Partial<OnboardingSettings> = {}): OnboardingSettings {
  return {
    verbLegendSeen: false,
    contextHints: {
      beamOverheat: 0,
      juggle: 0,
      ultimateReady: 0,
      lavaGapFall: 0,
      empoweredReturn: 0,
    },
    ...overrides,
  };
}

describe("VerbLegendManager", () => {
  it("persists the first-run legend once and latches input until every control is released", () => {
    const surface = new FakeSurface();
    const persist = vi.fn();
    const manager = new VerbLegendManager({
      surface,
      onboarding: onboarding(),
      persist,
      reducedMotion: false,
    });

    expect(manager.showFirstRun(0)).toBe(true);
    expect(manager.showFirstRun(1)).toBe(false);
    expect(surface.legendVisible).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0]?.[0].verbLegendSeen).toBe(true);

    manager.toggleLegend(100);
    expect(manager.isModalBlocking()).toBe(true);
    manager.releaseInputLatchIf(false);
    expect(manager.isModalBlocking()).toBe(true);
    manager.releaseInputLatchIf(true);
    expect(manager.isModalBlocking()).toBe(false);
  });

  it("throttles the shared prompt and persists no more than two accepted fires per hint", () => {
    const surface = new FakeSurface();
    const persisted: OnboardingSettings[] = [];
    const manager = new VerbLegendManager({
      surface,
      onboarding: onboarding({ verbLegendSeen: true }),
      persist: (value) => persisted.push(value),
      reducedMotion: false,
    });

    expect(manager.offerHint("beamOverheat", 0)).toBe(true);
    expect(manager.offerHint("juggle", 100)).toBe(false);
    manager.update(2_201, 1280, 720);
    expect(manager.offerHint("beamOverheat", 2_500)).toBe(false);
    expect(manager.offerHint("beamOverheat", 3_201)).toBe(true);
    manager.update(5_402, 1280, 720);
    expect(manager.offerHint("beamOverheat", 6_500)).toBe(false);

    expect(persisted).toHaveLength(2);
    expect(persisted[0]?.contextHints.beamOverheat).toBe(1);
    expect(persisted[1]?.contextHints.beamOverheat).toBe(2);
    expect(persisted[1]?.contextHints.juggle).toBe(0);
  });

  it("honors persisted caps and retires prompts without allocating another text surface", () => {
    const surface = new FakeSurface();
    const persist = vi.fn();
    const prior = onboarding({ verbLegendSeen: true });
    prior.contextHints.empoweredReturn = 2;
    const manager = new VerbLegendManager({
      surface,
      onboarding: prior,
      persist,
      reducedMotion: true,
    });

    expect(manager.offerHint("empoweredReturn", 0)).toBe(false);
    expect(manager.offerHint("ultimateReady", 0)).toBe(false);
    expect(manager.offerHint("juggle", 0)).toBe(true);
    manager.update(1_000, 1024, 768);
    expect(surface.hintAlpha).toBe(1);
    manager.update(2_201, 1024, 768);
    expect(surface.hintVisible).toBe(false);
    expect(manager.activeHintId()).toBeUndefined();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe("verb onboarding settings", () => {
  it("migrates legacy v1 data and clamps persisted hint counters to the two-fire cap", () => {
    expect(sanitizeSettings({ version: 1 }).onboarding).toEqual(onboarding());
    const settings = sanitizeSettings({
      version: 1,
      onboarding: {
        verbLegendSeen: true,
        contextHints: { beamOverheat: 99, juggle: 1.9, lavaGapFall: -4 },
      },
    });

    expect(settings.onboarding.verbLegendSeen).toBe(true);
    expect(settings.onboarding.contextHints).toMatchObject({
      beamOverheat: 2,
      juggle: 1,
      lavaGapFall: 0,
      empoweredReturn: 0,
    });
  });
});
