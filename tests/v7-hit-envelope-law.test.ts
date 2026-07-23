import { readFileSync } from "node:fs";
import {
  BLADE_EXTENSION_WEAPON_IDS,
  beamDamageEnvelopeFor,
  beamDescriptorFor,
  bladeExtensionGeometryFor,
  bladeExtensionIgnitionReveal,
  bladeExtensionPoseAt,
  bladeExtensionReveal,
  HIT_ENVELOPE_TOLERANCE_PX,
  hitEnvelopeExtentsAgree,
  meleeComboSelectionFor,
  meleeDamageEnvelopeFor,
  meleeDamageHalfWidthAt,
  meleeDamageReachAt,
  meleeReach,
  PROJECTILE_RADIUS,
  projectileDamageEnvelopeFor,
  swingDescriptorFor,
  WEAPON_CATALOG_IDS,
  WEAPONS,
  weaponDamageEnvelopeFor,
  weaponHitEnvelopeAuthoringFor,
  weaponUsesAuthoritativeEnvelopeCombo,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

describe("V7-HIT standing VFX-collision law", () => {
  it("resolves one finite canonical damage envelope for every catalog weapon", () => {
    for (const id of WEAPON_CATALOG_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      if (!weapon) continue;
      const envelope = weaponDamageEnvelopeFor(weapon);
      expect(envelope.weaponId, id).toBe(id);

      if (envelope.melee) {
        expect(Number.isFinite(envelope.melee.baseReach), `${id}/melee/baseReach`).toBe(true);
        expect(Number.isFinite(envelope.melee.maxReach), `${id}/melee/maxReach`).toBe(true);
        expect(envelope.melee.maxReach, `${id}/melee/reach-order`).toBeGreaterThanOrEqual(
          envelope.melee.baseReach,
        );
        expect(envelope.melee.maxHalfWidth, `${id}/melee/width-order`).toBeGreaterThanOrEqual(
          envelope.melee.baseHalfWidth,
        );
      }

      for (const delivery of ["gun", "cast", "thrown", "scatter"] as const) {
        const projectile = envelope.projectiles[delivery];
        if (!projectile) continue;
        expect(projectileDamageEnvelopeFor(weapon, delivery), `${id}/${delivery}`).toEqual(
          projectile,
        );
        expect(projectile.radius, `${id}/${delivery}/radius`).toBeGreaterThan(0);
        expect(projectile.halfLength, `${id}/${delivery}/halfLength`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps every flagship extension's full tip within the server envelope without authored width", () => {
    for (const id of BLADE_EXTENSION_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon, id).toBeDefined();
      if (!weapon) continue;
      expect(weaponUsesAuthoritativeEnvelopeCombo(weapon), `${id}/combo-clock`).toBe(true);
      const swing = swingDescriptorFor(weapon, weapon.cooldown);
      const activeMidpoint = (swing.activeStartSeconds + swing.activeEndSeconds) / 2;
      const visual = bladeExtensionGeometryFor(weapon);
      const server = meleeDamageEnvelopeFor(weapon);
      expect(visual, id).toBeDefined();
      if (!visual) continue;

      expect(
        hitEnvelopeExtentsAgree(
          visual.extensionStart + visual.extensionLength,
          meleeDamageReachAt(weapon, swing, activeMidpoint),
        ),
        `${id}/reach`,
      ).toBe(true);
      expect(meleeDamageHalfWidthAt(weapon, swing, activeMidpoint), `${id}/halfWidth`).toBe(
        server.baseHalfWidth,
      );
      expect(server.maxReach, `${id}/maxReach`).toBeCloseTo(visual.fullTipReach, 8);
      expect(server.maxHalfWidth, `${id}/maxHalfWidth`).toBe(server.baseHalfWidth);
      expect(
        weaponHitEnvelopeAuthoringFor(weapon)?.melee?.bladeExtension,
        `${id}/no-authored-thickness`,
      ).not.toHaveProperty("thicknessScale");
      expect(
        Math.abs(server.maxReach - visual.fullTipReach),
        `${id}/tolerance=${HIT_ENVELOPE_TOLERANCE_PX}`,
      ).toBeLessThanOrEqual(HIT_ENVELOPE_TOLERANCE_PX);
    }
  });

  it("makes reach follow the one 100ms combo ignition and holds full reach on later hits", () => {
    expect(bladeExtensionIgnitionReveal(0)).toBe(0);
    expect(bladeExtensionIgnitionReveal(0.05)).toBeCloseTo(0.5, 8);
    expect(bladeExtensionIgnitionReveal(0.1)).toBe(1);
    for (const id of BLADE_EXTENSION_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      if (!weapon) throw new Error(`Missing extension fixture: ${id}`);
      const base = swingDescriptorFor(weapon, weapon.cooldown);
      const opening = { ...base, comboStep: 0 };
      const continuation = { ...base, comboStep: 1 };
      const envelope = meleeDamageEnvelopeFor(weapon);
      const samples = [0, 0.025, 0.05, 0.075, 0.1] as const;
      let previousReach = envelope.baseReach;
      for (const elapsed of samples) {
        const reveal = bladeExtensionReveal(weapon, opening, elapsed);
        const reach = meleeDamageReachAt(weapon, opening, elapsed);
        expect(reach, `${id}/opening/${elapsed}`).toBeGreaterThanOrEqual(previousReach);
        if (reveal < 1) expect(reach, `${id}/short/${elapsed}`).toBeLessThan(envelope.maxReach);
        previousReach = reach;
      }
      expect(meleeDamageReachAt(weapon, opening, 0.1), `${id}/opening-full`).toBeCloseTo(
        envelope.maxReach,
        8,
      );
      expect(bladeExtensionReveal(weapon, continuation, 0), `${id}/no-reignite`).toBe(1);
      expect(meleeDamageReachAt(weapon, continuation, 0), `${id}/continuation-full`).toBeCloseTo(
        envelope.maxReach,
        8,
      );
    }
  });

  it("shares the brutalist backswing/runaway angle and foreshortening with server reach", () => {
    for (const id of BLADE_EXTENSION_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      const sequence = weapon && meleeComboSelectionFor(weapon)?.sequence;
      expect(sequence, `${id}/momentum-sequence`).toHaveLength(3);
      if (!weapon || !sequence) continue;
      const base = swingDescriptorFor(weapon, weapon.cooldown);
      for (const step of sequence) {
        const swing = {
          ...base,
          activeStartSeconds: step.timing.activeStart * base.poseSeconds,
          activeEndSeconds: step.timing.activeEnd * base.poseSeconds,
          motion: step.motion,
        };
        const elapsed = (swing.activeStartSeconds + swing.activeEndSeconds) / 2;
        const visual = bladeExtensionPoseAt(weapon, swing, elapsed, 0);
        const geometry = bladeExtensionGeometryFor(weapon);
        expect(visual, `${id}/${step.motion}/pose`).toBeDefined();
        expect(geometry, `${id}/${step.motion}/geometry`).toBeDefined();
        if (!visual || !geometry) continue;
        const gripReach = geometry.fullTipReach - geometry.totalBladeLength;
        const visualTip = Math.max(
          meleeDamageEnvelopeFor(weapon).baseReach,
          gripReach + geometry.totalBladeLength * visual.lengthScale,
        );
        expect(
          hitEnvelopeExtentsAgree(visualTip, meleeDamageReachAt(weapon, swing, elapsed)),
          `${id}/${step.motion}/foreshortened-tip`,
        ).toBe(true);
      }
    }
  });

  it("keeps Sanctified Headsman on its ordinary blade envelope with no ignition hook", () => {
    const headsman = WEAPONS["x2-sanctified-headsman"];
    if (!headsman) throw new Error("Missing Sanctified Headsman fixture");
    const envelope = meleeDamageEnvelopeFor(headsman);
    const swing = swingDescriptorFor(headsman, headsman.cooldown);
    expect(BLADE_EXTENSION_WEAPON_IDS).not.toContain(headsman.id);
    expect(weaponHitEnvelopeAuthoringFor(headsman)?.melee?.bladeExtension).toBeUndefined();
    expect(bladeExtensionGeometryFor(headsman)).toBeUndefined();
    expect(bladeExtensionReveal(headsman, swing, 0.05)).toBe(0);
    expect(envelope.maxReach).toBe(envelope.baseReach);
    expect(meleeDamageReachAt(headsman, swing, swing.activeEndSeconds)).toBe(envelope.baseReach);
    expect(weaponUsesAuthoritativeEnvelopeCombo(headsman)).toBe(false);
  });

  it("normalizes beam geometry once and preserves the legacy shared projectile radius until authored", () => {
    for (const id of WEAPON_CATALOG_IDS) {
      const weapon = WEAPONS[id];
      if (!weapon) continue;
      if (weapon.beam) {
        const envelope = beamDamageEnvelopeFor(weapon);
        const descriptor = beamDescriptorFor(weapon, 0, 0);
        expect(envelope, id).toMatchObject({
          range: descriptor.range,
          width: descriptor.width,
          halfWidth: descriptor.width / 2,
          coneHalfAngle: descriptor.coneHalfAngle,
        });
      }
      for (const delivery of ["gun", "cast", "thrown", "scatter"] as const) {
        const authored = weapon.hitEnvelope?.projectiles?.[delivery];
        if (authored) continue;
        const sourceExists =
          (delivery === "gun" && !!weapon.gun) ||
          (delivery === "cast" && !!weapon.cast) ||
          (delivery === "thrown" && !!weapon.thrown) ||
          (delivery === "scatter" && !!weapon.scatter);
        if (sourceExists)
          expect(projectileDamageEnvelopeFor(weapon, delivery).radius, `${id}/${delivery}`).toBe(
            PROJECTILE_RADIUS,
          );
      }
    }
  });

  it("keeps every catalog weapon's authored visual extent within tolerance of its server envelope", () => {
    const agree = (id: string, surface: string, visual: number, server: number) =>
      expect(
        hitEnvelopeExtentsAgree(visual, server),
        `${id}/${surface}: visual=${visual}, server=${server}`,
      ).toBe(true);

    for (const id of WEAPON_CATALOG_IDS) {
      const weapon = WEAPONS[id];
      if (!weapon) continue;
      const server = weaponDamageEnvelopeFor(weapon);
      if (server.melee) {
        agree(id, "melee/baseReach", meleeReach(weapon), server.melee.baseReach);
        const visualExtension = bladeExtensionGeometryFor(weapon);
        if (visualExtension)
          agree(id, "melee/extensionTip", visualExtension.fullTipReach, server.melee.maxReach);
      }
      for (const delivery of ["gun", "cast", "thrown", "scatter"] as const) {
        const body = server.projectiles[delivery];
        if (!body) continue;
        const visualAuthoring = weapon.hitEnvelope?.projectiles?.[delivery];
        agree(id, `${delivery}/radius`, visualAuthoring?.radius ?? PROJECTILE_RADIUS, body.radius);
        agree(id, `${delivery}/halfLength`, visualAuthoring?.halfLength ?? 0, body.halfLength);
      }
      if (weapon.beam && server.beam) {
        const visual = beamDescriptorFor(weapon, 0, 0);
        agree(id, "beam/range", visual.range, server.beam.range);
        agree(id, "beam/width", visual.width, server.beam.width);
      }
      if (weapon.groundZone && server.groundZone) {
        agree(
          id,
          "groundZone/initial",
          weapon.groundZone.initialRadius,
          server.groundZone.initialRadius,
        );
        agree(id, "groundZone/max", weapon.groundZone.maxRadius, server.groundZone.maxRadius);
      }
      if (weapon.performance?.aura && server.aura)
        agree(id, "aura", weapon.performance.aura.radius, server.aura.radius);
      if (weapon.quake && server.quake)
        agree(id, "quake", weapon.quake.radius, server.quake.radius);
      if (weapon.warp && server.warp)
        agree(id, "warp", weapon.warp.burstRadius, server.warp.radius);
      if (weapon.gun?.explode && server.gunExplosion)
        agree(id, "gunExplosion", weapon.gun.explode.radius, server.gunExplosion.radius);
      if (weapon.scatter?.explode && server.scatterExplosion)
        agree(
          id,
          "scatterExplosion",
          weapon.scatter.explode.radius,
          server.scatterExplosion.radius,
        );
      if (weapon.katanaHook?.finisherBurst && server.katanaFinisherBurst)
        agree(
          id,
          "katanaFinisherBurst",
          weapon.katanaHook.finisherBurst.radius,
          server.katanaFinisherBurst.radius,
        );
    }
  });

  it("keeps collision on shared timing while presentation reads only the final rig attachment", () => {
    const client = readFileSync("packages/client/src/vfx/VfxPlayer.ts", "utf8");
    const rig = readFileSync("packages/client/src/entities/SpriteRig.ts", "utf8");
    const server = readFileSync("packages/server/src/rooms/GameRoom.ts", "utf8");
    expect(client).toContain("bladeExtensionGeometryFor(weapon)");
    expect(client).toContain("bladeExtensionDrawTransform(pose, state.geometry, state.reveal)");
    expect(client).not.toContain("bladeExtensionPoseAt(");
    expect(client).not.toContain("fallbackAngle");
    expect(client).not.toContain("thicknessRatio");
    expect(client).toContain('scene.events.on("postupdate", this.syncBladeExtensions, this)');
    expect(rig).toContain("measureBladeWidthAtExtensionJoin(");
    expect(rig).toMatch(/\(\)\s*=>\s*\n?\s*this\.leadWeaponTipPose\(signatureHand\)/);
    expect(rig).toContain("() => this.leadWeaponTipPose(1)");
    expect(server).toContain("meleeDamageReachAt(envelopeWeapon, sw.swing, sampleElapsed)");
    expect(server).toContain("meleeDamageHalfWidthAt(envelopeWeapon, sw.swing, sampleElapsed)");
    expect(server).toContain(
      "bladeExtensionPoseAt(envelopeWeapon, sw.swing, sampleElapsed, sw.aim0)",
    );
    expect(server).toContain("weaponUsesAuthoritativeEnvelopeCombo(weapon)");
  });
});
