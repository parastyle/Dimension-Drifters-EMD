import { WEAPONS, type WeaponDef } from "@dd/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dd/shared", () => {
  const base = {
    name: "Fixture Blade",
    damage: 8,
    range: 90,
    halfArc: 0.6,
    cooldown: 0.3,
    displayLength: 90,
    swingArc: 2.2,
    gripFrac: 0.15,
    tags: {
      grip: "1H",
      size: "M",
      delivery: "melee-arc",
      fireMode: "tap",
      element: "physical",
      classPool: "melee",
      family: "sword",
      rangeBand: "close",
      scaling: ["DEX"],
    },
  };
  return {
    WEAPONS: {
      "rattler-sabre": { ...base, id: "rattler-sabre", name: "Rattler Sabre" },
      driftblade: {
        ...base,
        id: "driftblade",
        name: "Driftblade",
        twoHanded: true,
        displayLength: 320,
        tags: { ...base.tags, grip: "2H", size: "XL", family: "greatsword" },
      },
    },
    isWornWeapon: () => false,
    meleeComboSelectionFor: () => undefined,
    swingStyleFor: () => "chop",
    weaponHasHandlingTag: (weapon: { tags?: { handling?: string[] } } | undefined, tag: string) =>
      weapon?.tags?.handling?.includes(tag) === true,
  };
});

import {
  BLADE_SIZE_STANCES,
  bladeSizeClassFor,
  createFlourishInput,
  createFlourishSample,
  FLOURISH_DUAL_AFTER_ECHO_MS,
  FLOURISH_DUAL_DRAW_ECHO_MS,
  FLOURISH_DUAL_STOW_ECHO_MS,
  sampleFlourish,
  WEAPON_FLOURISH_SPECS,
  type WeaponPoseFamily,
  weaponFlourishSpecFor,
  weaponPoseFamilyFor,
} from "./pose-language.js";

function weapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Missing flourish fixture weapon: ${id}`);
  return def;
}

describe("flourish grammar descriptors", () => {
  it("covers every current weapon with a frozen family performance", () => {
    for (const def of Object.values(WEAPONS)) {
      const family = weaponPoseFamilyFor(def);
      const spec = weaponFlourishSpecFor(def);
      expect(spec.family, def.id).toBe(family);
      expect(Object.isFrozen(spec), def.id).toBe(true);
      for (const beat of [spec.draw, spec.stow, spec.afterAttack, spec.idleSettle]) {
        if (!beat) continue;
        expect(Object.isFrozen(beat), `${def.id}:beat`).toBe(true);
        expect(Object.isFrozen(beat.timing), `${def.id}:timing`).toBe(true);
      }
    }
  });

  it("holds all four visual duration ceilings for every family and sword size", () => {
    const specs = new Set(Object.values(WEAPON_FLOURISH_SPECS));
    for (const sizeClass of Object.keys(BLADE_SIZE_STANCES) as Array<
      keyof typeof BLADE_SIZE_STANCES
    >) {
      const fixture = {
        ...weapon("driftblade"),
        id: `sized-${sizeClass}`,
        tags: { ...weapon("driftblade").tags, sizeClass },
      } as WeaponDef;
      specs.add(weaponFlourishSpecFor(fixture));
    }
    for (const spec of specs) {
      expect(spec.draw.timing.durationMs, `${spec.family}:draw`).toBeLessThanOrEqual(420);
      expect(spec.stow.timing.durationMs, `${spec.family}:stow`).toBeLessThanOrEqual(200);
      expect(spec.afterAttack.timing.durationMs, `${spec.family}:after`).toBeLessThanOrEqual(480);
      expect(spec.idleSettle?.timing.durationMs ?? 0, `${spec.family}:idle`).toBeLessThanOrEqual(
        340,
      );
      for (const beat of [spec.draw, spec.stow, spec.afterAttack]) {
        expect(beat.timing.statementAtMs, `${spec.family}:anticipation`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("keeps dual responses visibly alternating inside the 45-60ms law", () => {
    expect(FLOURISH_DUAL_DRAW_ECHO_MS).toBe(50);
    expect(FLOURISH_DUAL_STOW_ECHO_MS).toBe(45);
    expect(FLOURISH_DUAL_AFTER_ECHO_MS).toBe(55);
    for (const delay of [
      FLOURISH_DUAL_DRAW_ECHO_MS,
      FLOURISH_DUAL_STOW_ECHO_MS,
      FLOURISH_DUAL_AFTER_ECHO_MS,
    ]) {
      expect(delay).toBeGreaterThanOrEqual(45);
      expect(delay).toBeLessThanOrEqual(60);
    }
  });

  it("pins Horizon Wheel, Three-Count Deadeye, Last Word, and the beam catch", () => {
    const horizon = weaponFlourishSpecFor(weapon("driftblade"));
    expect(horizon.draw.timing.durationMs).toBe(390);
    expect(horizon.afterAttack.timing.durationMs).toBe(460);
    expect(horizon.afterAttack.rotationRad).toBe(Math.PI * 2);
    expect((horizon.afterAttack.overshootRad * 180) / Math.PI).toBeCloseTo(14, 10);
    expect(WEAPON_FLOURISH_SPECS.pistol.streakThreshold).toBe(3);
    expect(WEAPON_FLOURISH_SPECS.pistol.afterAttack.rotationRad).toBe(Math.PI * 2);
    expect((WEAPON_FLOURISH_SPECS.pistol.afterAttack.overshootRad * 180) / Math.PI).toBeCloseTo(
      12,
      10,
    );
    expect(WEAPON_FLOURISH_SPECS.tome.draw.timing).toMatchObject({
      durationMs: 350,
      statementAtMs: 70,
      catchAtMs: 250,
    });
    expect(WEAPON_FLOURISH_SPECS.tome.afterAttack.timing).toMatchObject({
      durationMs: 320,
      statementAtMs: 55,
      catchAtMs: 235,
    });
    const base = weapon("rattler-sabre");
    const beam = {
      ...base,
      id: "beam-overlay",
      beam: {},
      tags: {
        ...base.tags,
        grip: "1H",
        classPool: "ranged",
        family: "pistol",
        delivery: "beam",
      },
    } as WeaponDef;
    const beamSpec = weaponFlourishSpecFor(beam);
    expect(beamSpec.streakThreshold).toBe(0);
    expect(beamSpec.afterAttack.rotationRad).toBe(0);
    expect(beamSpec.afterAttack.overshootRad).toBe(0);
  });
});

describe("size-class stance resolution", () => {
  it("obeys canonical tag, Driftblade migration truth, legacy fallback, and staged root emission", () => {
    const driftblade = weapon("driftblade");
    expect(bladeSizeClassFor(driftblade)).toBe("great");
    const base = weapon("rattler-sabre");
    const explicit = {
      ...base,
      id: "explicit-size",
      tags: { ...base.tags, size: "S", sizeClass: "colossal" },
    } as WeaponDef;
    expect(bladeSizeClassFor(explicit)).toBe("colossal");
    for (const [size, expected] of [
      ["S", "short"],
      ["M", "standard"],
      ["L", "great"],
      ["XL", "colossal"],
    ] as const) {
      const fixture = {
        ...base,
        id: `legacy-${size}`,
        tags: { ...base.tags, size },
        sizeClass: undefined,
      } as WeaponDef;
      expect(bladeSizeClassFor(fixture)).toBe(expected);
    }
    const staged = { ...base, id: "staged", sizeClass: "great" } as WeaponDef;
    expect(bladeSizeClassFor(staged)).toBe("great");
  });

  it("authors raised short, forward standard, tip-trailing great, and near-rear colossal homes", () => {
    expect(BLADE_SIZE_STANCES.short.restAngleRad).toBeGreaterThanOrEqual(-0.7);
    expect(BLADE_SIZE_STANCES.short.restAngleRad).toBeLessThanOrEqual(-0.44);
    expect(BLADE_SIZE_STANCES.standard.restAngleRad).toBeGreaterThanOrEqual(-0.38);
    expect(BLADE_SIZE_STANCES.standard.restAngleRad).toBeLessThanOrEqual(-0.14);
    expect(BLADE_SIZE_STANCES.great.restAngleRad).toBeGreaterThanOrEqual(2.62);
    expect(BLADE_SIZE_STANCES.great.restAngleRad).toBeLessThanOrEqual(2.88);
    expect(BLADE_SIZE_STANCES.colossal.restAngleRad).toBeGreaterThanOrEqual(2.88);
    expect(BLADE_SIZE_STANCES.colossal.restAngleRad).toBeLessThanOrEqual(3.11);
  });
});

describe("allocation-free flourish sampler", () => {
  it("reuses and clears caller output while remaining continuous at both phase cuts", () => {
    const input = createFlourishInput();
    input.spec = WEAPON_FLOURISH_SPECS.pistol.afterAttack;
    input.moment = "after-attack";
    const out = createFlourishSample();
    expect(sampleFlourish(input, out)).toBe(out);
    for (const cut of [input.spec.timing.statementAtMs, input.spec.timing.catchAtMs]) {
      input.elapsedMs = cut - 0.001;
      sampleFlourish(input, out);
      const before = { angle: out.weaponRotationRad, hand: out.handForward };
      input.elapsedMs = cut;
      sampleFlourish(input, out);
      expect(out.weaponRotationRad).toBeCloseTo(before.angle, 3);
      expect(out.handForward).toBeCloseTo(before.hand, 3);
    }
    input.elapsedMs = input.spec.timing.durationMs;
    sampleFlourish(input, out);
    expect(out.active).toBe(false);
    expect(out.ownership).toBe(0);
    expect(out.weaponRotationRad).toBe(0);
    expect(out.headForwardPx).toBe(0);
    expect(out.proxyAlpha).toBe(0);
  });

  it("makes every rotational statement one monotonic arc with one 8-18 degree catch", () => {
    for (const [family, spec] of Object.entries(WEAPON_FLOURISH_SPECS) as Array<
      [WeaponPoseFamily, (typeof WEAPON_FLOURISH_SPECS)[WeaponPoseFamily]]
    >) {
      for (const [name, beat] of [
        ["draw", spec.draw],
        ["stow", spec.stow],
        ["after", spec.afterAttack],
      ] as const) {
        if (beat.rotationRad === 0) continue;
        const input = createFlourishInput();
        input.spec = beat;
        input.moment = name === "after" ? "after-attack" : name;
        const out = createFlourishSample();
        let previous = Number.NEGATIVE_INFINITY;
        for (let elapsed = beat.timing.statementAtMs; elapsed < beat.timing.catchAtMs; elapsed++) {
          input.elapsedMs = elapsed;
          sampleFlourish(input, out);
          expect(out.weaponRotationRad, `${family}:${name}:${elapsed}`).toBeGreaterThanOrEqual(
            previous - 1e-10,
          );
          previous = out.weaponRotationRad;
        }
        expect(Math.abs(beat.rotationRad), `${family}:${name}:arc`).toBeLessThanOrEqual(
          Math.PI * 2,
        );
        let peak = 0;
        for (let elapsed = beat.timing.catchAtMs; elapsed < beat.timing.durationMs; elapsed++) {
          input.elapsedMs = elapsed;
          sampleFlourish(input, out);
          peak = Math.max(peak, Math.abs(out.catchOvershootRad));
        }
        expect((peak * 180) / Math.PI, `${family}:${name}:catch`).toBeGreaterThanOrEqual(8);
        expect((peak * 180) / Math.PI, `${family}:${name}:catch`).toBeLessThanOrEqual(18);
      }
    }
  });

  it("routes the sprung-head accents and full-body channels without exceeding paper bounds", () => {
    for (const spec of Object.values(WEAPON_FLOURISH_SPECS)) {
      const input = createFlourishInput();
      input.spec = spec.afterAttack;
      input.moment = "after-attack";
      const out = createFlourishSample();
      let sawBody = false;
      let sawFoot = false;
      let sawHead = false;
      for (let elapsed = 0; elapsed < input.spec.timing.durationMs; elapsed += 8) {
        input.elapsedMs = elapsed;
        sampleFlourish(input, out);
        sawBody ||=
          Math.abs(out.bodyForward) + Math.abs(out.bodyLateral) + Math.abs(out.bodyTurn) > 0;
        sawFoot ||= Math.abs(out.footForward) + Math.abs(out.footLateral) > 0;
        sawHead ||= Math.hypot(out.headForwardPx, out.headLateralPx) > 0;
        expect(Math.abs(out.handForward)).toBeLessThanOrEqual(0.24);
        expect(Math.abs(out.handLateral)).toBeLessThanOrEqual(0.24);
        expect(Math.abs(out.bodyForward)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(out.bodyLateral)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(out.bodyTurn)).toBeLessThanOrEqual(0.12);
        expect(Math.abs(out.footForward)).toBeLessThanOrEqual(0.07);
        expect(Math.abs(out.footLateral)).toBeLessThanOrEqual(0.07);
        expect(Math.hypot(out.footForward, out.footLateral)).toBeLessThanOrEqual(0.07);
        expect(out.paperHop).toBeLessThanOrEqual(0.05);
        expect(Math.hypot(out.headForwardPx, out.headLateralPx)).toBeLessThanOrEqual(3.5);
      }
      if (spec.afterAttack.rotationRad !== 0) {
        expect(sawBody, spec.family).toBe(true);
        expect(sawFoot, spec.family).toBe(true);
        expect(sawHead, spec.family).toBe(true);
      }
    }
  });

  it("uses a dignified nonzero reduced settle with no rotation, hop, head cycle, or idle beat", () => {
    const input = createFlourishInput();
    input.spec = WEAPON_FLOURISH_SPECS["two-hand-sword"].afterAttack;
    input.moment = "after-attack";
    input.elapsedMs = 60;
    input.reducedMotion = true;
    const out = sampleFlourish(input, createFlourishSample());
    expect(out.active).toBe(true);
    expect(out.settleOnly).toBe(true);
    expect(Math.hypot(out.handForward, out.handLateral)).toBeGreaterThan(0);
    expect(out.weaponRotationRad).toBe(0);
    expect(out.catchOvershootRad).toBe(0);
    expect(out.paperHop).toBe(0);
    expect(out.headForwardPx).toBe(0);
    expect(out.headLateralPx).toBe(0);
    input.elapsedMs = 159;
    expect(sampleFlourish(input, out).active).toBe(false);
    input.moment = "idle-settle";
    input.elapsedMs = 0;
    expect(sampleFlourish(input, out).active).toBe(false);
  });

  it("reaches cyclic weapon home and holds exact full-body home before ownership fades", () => {
    for (const spec of Object.values(WEAPON_FLOURISH_SPECS)) {
      for (const [moment, beat] of [
        ["draw", spec.draw],
        ["after-attack", spec.afterAttack],
      ] as const) {
        const input = createFlourishInput();
        input.spec = beat;
        input.moment = moment;
        const out = createFlourishSample();
        let firstFadeMs = -1;
        for (let elapsed = beat.timing.catchAtMs; elapsed < beat.timing.durationMs; elapsed++) {
          input.elapsedMs = elapsed;
          sampleFlourish(input, out);
          if (out.ownership < 0.999) {
            firstFadeMs = elapsed;
            break;
          }
        }
        expect(firstFadeMs, `${spec.family}:${moment}:fade`).toBeGreaterThan(0);
        input.elapsedMs = firstFadeMs;
        sampleFlourish(input, out);
        const cyclicAngleError = Math.abs(
          Math.atan2(Math.sin(out.weaponRotationRad), Math.cos(out.weaponRotationRad)),
        );
        expect(
          Math.hypot(out.handForward, out.handLateral),
          `${spec.family}:${moment}:grip-home`,
        ).toBeLessThanOrEqual(0.03);
        expect(cyclicAngleError, `${spec.family}:${moment}:weapon-home`).toBeLessThanOrEqual(0.18);

        const priorX = out.handForward;
        const priorY = out.handLateral;
        input.elapsedMs = Math.min(beat.timing.durationMs - 0.001, firstFadeMs + 16.7);
        sampleFlourish(input, out);
        expect(
          Math.hypot(out.handForward - priorX, out.handLateral - priorY) / 0.0167,
          `${spec.family}:${moment}:terminal-velocity-Hps`,
        ).toBeLessThanOrEqual(120 / 76);
      }
    }
  });

  it("takes every family through the complete reduced-motion grammar", () => {
    for (const spec of Object.values(WEAPON_FLOURISH_SPECS)) {
      for (const [moment, beat, elapsed] of [
        ["draw", spec.draw, 50],
        ["stow", spec.stow, 50],
        ["after-attack", spec.afterAttack, 50],
      ] as const) {
        const input = createFlourishInput();
        input.spec = beat;
        input.moment = moment;
        input.elapsedMs = elapsed;
        input.reducedMotion = true;
        const out = sampleFlourish(input, createFlourishSample());
        expect(out.active, `${spec.family}:${moment}:active`).toBe(true);
        expect(out.settleOnly, `${spec.family}:${moment}:settle`).toBe(true);
        expect(out.weaponRotationRad, `${spec.family}:${moment}:rotation`).toBe(0);
        expect(out.catchOvershootRad, `${spec.family}:${moment}:overshoot`).toBe(0);
        expect(out.paperHop, `${spec.family}:${moment}:hop`).toBe(0);
        expect(out.headForwardPx, `${spec.family}:${moment}:head-x`).toBe(0);
        expect(out.headLateralPx, `${spec.family}:${moment}:head-y`).toBe(0);
      }
      const input = createFlourishInput();
      input.spec = spec.idleSettle ?? spec.afterAttack;
      input.moment = "idle-settle";
      input.elapsedMs = 1;
      input.reducedMotion = true;
      expect(sampleFlourish(input, createFlourishSample()).active, `${spec.family}:idle`).toBe(
        false,
      );
    }
  });
});
