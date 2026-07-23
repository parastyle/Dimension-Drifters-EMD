import { readFileSync } from "node:fs";
import {
  comboStepForChain,
  DRIFT_MODEL_ADOPTERS,
  MELEE_COMBO_VARIANT_SEQUENCES,
  meleeComboSelectionFor,
  swingDescriptorFor,
  swingDescriptorForAttackSeq,
  WEAPONS,
} from "@dd/shared";
import { describe, expect, it } from "vitest";

/** §50 Driftblade-model panel: every check below iterates the exported DRIFT_MODEL_ADOPTERS map, so a
 * future adopter (one map row + one sequence) auto-extends the conformance law without touching tests.
 * Per-variant bands come from the analyst's M1–M8; `cadenceGate` marks fast cutters (cooldown ≤ 0.5 s)
 * where M4's tremor/deformation sub-beats are waived to the phrase level. `a2Ratio` is the M2 middle-beat
 * anticipation bound. */
const ADOPTER_LAW: Record<
  string,
  { cadenceGate: boolean; a2Ratio: number; motions: readonly string[] }
> = {
  "nodachi-coldcourt": {
    cadenceGate: false,
    a2Ratio: 0.6,
    motions: ["draw-cut", "guard-check", "sentence-fall"],
  },
  "nodachi-petalfall": {
    cadenceGate: false,
    a2Ratio: 0.6,
    motions: ["slash", "choked-turn", "petalfall"],
  },
  "katana-threehails": {
    cadenceGate: true,
    a2Ratio: 0.6,
    motions: ["shoulder-chop", "guard-check", "splinter-fall"],
  },
};

const ADOPTERS = Object.entries(DRIFT_MODEL_ADOPTERS);

function weapon(id: string) {
  const definition = WEAPONS[id];
  if (!definition) throw new Error(`Missing test weapon: ${id}`);
  return definition;
}

function sequenceOf(variant: keyof typeof MELEE_COMBO_VARIANT_SEQUENCES) {
  return MELEE_COMBO_VARIANT_SEQUENCES[variant];
}

describe("driftblade-model panel", () => {
  it("routes every adopter through the map while the model anchor stays greatsword", () => {
    expect(ADOPTERS.length).toBeGreaterThanOrEqual(3);
    for (const [id, variant] of ADOPTERS) {
      const selection = meleeComboSelectionFor(weapon(id));
      expect(selection, id).toMatchObject({ family: "chop", variant });
      // The selection must be the frozen module table itself — remote determinism is static data.
      expect(selection?.sequence, id).toBe(sequenceOf(variant));
      expect(ADOPTER_LAW[variant], `law table row for ${variant}`).toBeDefined();
    }
    expect(meleeComboSelectionFor(weapon("driftblade"))).toMatchObject({
      family: "chop",
      variant: "greatsword",
    });
    // Driftblade is the model, never an adopter row.
    expect(Object.keys(DRIFT_MODEL_ADOPTERS)).not.toContain("driftblade");
  });

  it("holds the M1–M7 timing skeleton per adopter (phrase-level under the cadence gate)", () => {
    for (const [id, variant] of ADOPTERS) {
      const law = ADOPTER_LAW[variant];
      if (!law) throw new Error(`Missing law row: ${variant}`);
      const sequence = sequenceOf(variant);
      // M1 — three distinct roles/motions on a frozen table.
      expect(Object.isFrozen(sequence), variant).toBe(true);
      expect(sequence, variant).toHaveLength(3);
      expect(
        sequence.map((step) => step.motion),
        variant,
      ).toEqual(law.motions);
      expect(new Set(sequence.map((step) => step.motion)).size, variant).toBe(3);
      for (const step of sequence) {
        expect(Object.isFrozen(step), step.name).toBe(true);
        // Shipped timing law, verbatim from the big-sword panel.
        expect(step.timing.activeStart, step.name).toBeLessThan(step.timing.activeEnd);
        expect(step.timing.activeEnd, step.name).toBeLessThanOrEqual(step.timing.followEnd);
        expect(step.timing.followEnd, step.name).toBeLessThanOrEqual(1);
        expect(step.timing.impact, step.name).toBeGreaterThanOrEqual(step.timing.activeStart);
        expect(step.timing.impact, step.name).toBeLessThanOrEqual(step.timing.activeEnd);
      }
      // M2 — commitment ramp: the middle beat accelerates the phrase, the finisher is loaded.
      const [draw, punctuate, payoff] = sequence;
      if (!draw || !punctuate || !payoff) throw new Error(`Short sequence: ${variant}`);
      const a1 = draw.timing.activeStart;
      const a2 = punctuate.timing.activeStart;
      const a3 = payoff.timing.activeStart;
      expect(a1, variant).toBeGreaterThanOrEqual(0.2);
      expect(a1, variant).toBeLessThanOrEqual(0.3);
      expect(a2, variant).toBeLessThanOrEqual(law.a2Ratio * a1 + 1e-9);
      expect(a3, variant).toBeGreaterThanOrEqual(1.7 * a1 - 1e-9);
      if (law.cadenceGate) {
        // Phrase-level adoption is only honest below the read threshold (analyst cadence gate).
        expect(weapon(id).cooldown, id).toBeLessThanOrEqual(0.5);
      } else {
        // M4 — the earned finisher's absolute floors apply at full cadence.
        expect(a2, variant).toBeLessThanOrEqual(0.15);
        expect(a3, variant).toBeGreaterThanOrEqual(0.44);
        expect(payoff.timing.impact, variant).toBeGreaterThanOrEqual(0.58);
        expect(payoff.timing.followEnd, variant).toBeGreaterThanOrEqual(0.78);
      }
    }
  });

  it("keeps every adopter step on the one unit-strength Stage-1 server sweep", () => {
    for (const [, variant] of ADOPTERS) {
      for (const step of sequenceOf(variant)) {
        expect(step.path, `${variant}:${step.name}`).toEqual({
          kind: "sweep",
          arcMultiplier: 1,
          rangeMultiplier: 1,
          damageMultiplier: 1,
          knockback: 0,
        });
      }
    }
  });

  it("authors the silence-then-crescendo ribbon arc on every adopter", () => {
    for (const [, variant] of ADOPTERS) {
      const sequence = sequenceOf(variant);
      for (const step of sequence) {
        const ribbon = step.ribbon;
        expect(ribbon, `${variant}:${step.name}`).toBeDefined();
        if (!ribbon) continue;
        expect(ribbon.radialEnd, step.name).toBe(1);
        expect(ribbon.radialStart, step.name).toBeGreaterThan(0);
        expect(ribbon.radialStart, step.name).toBeLessThan(ribbon.radialEnd);
        expect(ribbon.setupEcho === undefined || ribbon.setupEcho === "neutral-dim").toBe(true);
      }
      // Rule R — the compact beat never gets a body ribbon (authored SILENCE, widthMultiplier 0), and
      // the payoff is the widest, brightest paint of the cycle (the crescendo).
      const widths = sequence.map((step) => step.ribbon?.widthMultiplier ?? 0);
      expect(widths[1], variant).toBe(0);
      expect(widths[0], variant).toBeGreaterThan(0);
      expect(widths[2], variant).toBeGreaterThan(1);
      expect(widths[2], variant).toBe(Math.max(...widths));
    }
  });

  it("is not a clone of the model (M8) and the adopters never blur into each other", () => {
    const greatsword = sequenceOf("greatsword");
    const signatures = new Set<string>();
    for (const [, variant] of ADOPTERS) {
      const sequence = sequenceOf(variant);
      expect(sequence, variant).not.toBe(greatsword);
      let differences = 0;
      if (sequence[1]?.motion !== greatsword[1]?.motion) differences++;
      if (sequence[2]?.motion !== greatsword[2]?.motion) differences++;
      if (
        sequence.some(
          (step, i) =>
            JSON.stringify(step.timing) !== JSON.stringify(greatsword[i]?.timing ?? null),
        )
      )
        differences++;
      if (
        sequence.some(
          (step, i) =>
            JSON.stringify(step.ribbon ?? null) !== JSON.stringify(greatsword[i]?.ribbon ?? null),
        )
      )
        differences++;
      expect(differences, variant).toBeGreaterThanOrEqual(2);
      signatures.add(sequence.map((step) => `${step.motion}@${step.timing.activeStart}`).join("|"));
    }
    expect(signatures.size).toBe(ADOPTERS.length);
  });

  it("keeps every non-adopter's routing byte-identical (full-roster invariance table)", () => {
    const signatureGroups: Record<string, string[]> = {};
    const defaultCounts: Record<string, number> = {};
    for (const id of Object.keys(WEAPONS)) {
      const selection = meleeComboSelectionFor(weapon(id));
      if (!selection) continue;
      const key = `${selection.family}/${selection.variant}`;
      if (
        selection.variant === "default" ||
        selection.variant === "dagger" ||
        selection.variant === "claw"
      ) {
        defaultCounts[key] = (defaultCounts[key] ?? 0) + 1;
      } else {
        let group = signatureGroups[key];
        if (!group) {
          group = [];
          signatureGroups[key] = group;
        }
        group.push(id);
      }
    }
    for (const ids of Object.values(signatureGroups)) ids.sort();
    // Any future routing drift — adopter or not — must edit exactly one visible row here.
    expect(signatureGroups).toEqual({
      "chop/greatsword": ["driftblade"],
      "chop/nodachi-coldcourt": ["x2-gravechill-nodachi"],
      "chop/nodachi-petalfall": ["x2-stormpetal-odachi"],
      "chop/katana-threehails": ["x2-hailwidow-katana"],
      "chop/katana-kagewake": ["drift-wakizashi-kagewake"],
      "chop/katana-hushglass": ["drift-wakizashi-hushglass"],
      "chop/katana-stillwater-edict": ["drift-katana-stillwater-edict"],
      "chop/katana-stormthread": ["drift-katana-stormthread"],
      "chop/katana-riftstep": ["drift-katana-riftstep"],
      "chop/katana-pale-horizon": ["drift-nodachi-pale-horizon"],
      "chop/katana-gatebreaker": ["drift-nodachi-gatebreaker"],
      "chop/katana-moonwake": ["drift-greatkatana-moonwake"],
      "chop/katana-tempest-regent": ["drift-greatkatana-tempest-regent"],
      "chop/katana-world-seam": ["drift-colossal-world-seam"],
      "chop/greatsword-momentum": [
        "tombstone-greatsword",
        "x-sword-bone",
        "x-sword-coffin",
        "x2-cairnfall-monolith",
        "x2-dawnwall-testament",
        "x2-nullwake-ordinance",
        "x2-pyre-gallows-brand",
        "x2-rimewrit-grave-slab",
        "x2-stormrail-colossus",
      ],
      "chop/riftcleaver-crystal-cadence": ["x2-riftcleaver-greatblade"],
      "chop/glacier-down-up": ["x2-glacier-headtaker"],
      "chop/hollowmoon-eclipse": ["x2-hollowmoon-reaver"],
      "chop/quicksilver-up-down": ["x2-quicksilver-censer"],
      "chop/reliquary-down-stab": ["x2-reliquary-halberd"],
      "chop/saintspar-down-swing": ["x2-saintspar-lochaber"],
      "chop/voltfang-rise": ["x2-voltfang-tachi"],
      "punch/sparkknuckle-voltage-boxing": ["x2-sparkknuckle-hex-mitt"],
      "chop/claymore-breach": ["x2-dustreaper-zweihander", "x2-tombwarden-claymore"],
      "chop/glaive-compass": ["x2-thunderhead-voulge", "x2-wickfire-fauchard"],
      "chop/bardiche-hookbreak": ["x2-permafrost-bardiche", "x2-quarry-splitter-bardiche"],
      "chop/cinderbrand-alternating-chops": ["x2-cinderbrand-cleaver"],
      "chop/dustdevil-chop-stab": ["x2-dustdevil-glaive"],
      "chop/reapers-tithe-rest-and-orbit": ["x2-reaper-s-tithe"],
      "arc/ember-fan-cinder-sweeps": ["x2-ember-fan"],
      "arc/iron-war-fan-threefold": ["x2-iron-war-fan"],
      "arc/storm-fan-crossed-return": ["x2-storm-fan"],
      "arc/hero-spin": [
        "rattler-sabre",
        "x2-brimstone-falcata",
        "x2-saltbrand-cutlass",
        "x2-sandsong-saber",
        "x2-toxinwell-khopesh",
      ],
      "arc/mournveil-fan-spin": ["x2-mournveil-scythe"],
      "arc/thunderpost-storm-cadence": ["x2-thunderpost-fetish"],
      "punch/coyote-voltage-boxing": ["x2-coyote-trickster-s-sparkmitt"],
      "rake/frostfang-forward-rend": ["x2-frostfang-rakes"],
      "thrust/blightfork-jab": ["x2-blightfork-glaive"],
      "thrust/marrowpike-triple-stab": ["x2-marrowpike-ranseur"],
      "thrust/nullspike-three-thrust": ["x2-nullspike-pike"],
      "thrust/stinger": [
        "x2-bonewhisper-jian",
        "x2-buckhorn-boarspear",
        "x2-cinderbrand-pike",
        "x2-galvanic-lancepole",
        "x2-hexbloom-rapier",
        "x2-phantom-estoc",
        "x2-sidewinder-spontoon",
        "x2-sunlance-javelin-pike",
        "x2-venomtongue-trident",
      ],
      "thrust/verdict-procession": ["x2-verdict-longsword"],
      "thrust/voltedge-stab": ["x-sword-neon-katana"],
      "thrust/wyrmskull-spear-jabs": ["x2-wyrmskull-reliquary"],
      "chop/pommel": ["x2-mauler-slug-thrower", "x2-slughammer-breachgun", "x2-thunderhead-sledge"],
      "chop/quake-mauler": [
        "x2-anvil-drop",
        "x2-anvil-heart-quake-maul-staff",
        "x2-boomtown-maul",
        "x2-cairn-of-hollow-names",
        "x2-choir-iron-greataxe",
        "x2-cinderquill-almanac",
        "x2-dust-devil-cyclone-orb",
        "x2-dustdevil-warmaul",
        "x2-frostbite-headstone",
        "x2-godsbone-pillar",
        "x2-hangman-s-greatcleaver",
        "x2-hoarfrost-piledriver",
        "x2-idol-of-the-pale-verdict",
        "x2-ledger-of-spent-souls",
        "x2-maledict-tome-of-salt-lines",
        "x2-mawstone-cairn-idol",
        "x2-obsidian-maw-void-staff",
        "x2-plaguethresh",
        "x2-reckoning-s-sun-orb",
        "x2-rotgrove-totem",
        "x2-saint-calamity",
        "x2-sermon-bell",
        "x2-sluicebox-maul-axe",
        "x2-squeaky-mallet",
        "x2-widowmaker-wrecking-ball",
      ],
    });
    expect(defaultCounts).toEqual({
      "punch/default": 19,
      "arc/default": 124,
      "chop/default": 8,
      "rake/dagger": 1,
      "rake/claw": 4,
    });
  });

  it("resolves adopter steps deterministically from the synced accepted chain and attackSeq", () => {
    const id = "x2-gravechill-nodachi";
    const family = "chop";
    // Three contiguous accepted beats inside cadence walk the opener → punctuate → payoff.
    expect(
      comboStepForChain(7, 1_000, id, family, 3, undefined, -1e9, "", undefined, 0, -1e9),
    ).toBe(0);
    expect(comboStepForChain(8, 1_500, id, family, 3, 7, 1_000, id, family, 0, 1_900)).toBe(1);
    expect(comboStepForChain(9, 2_100, id, family, 3, 8, 1_500, id, family, 1, 2_400)).toBe(2);
    // A beat after the authored cadence window expires restarts at the opener.
    expect(comboStepForChain(10, 2_500, id, family, 3, 9, 2_100, id, family, 2, 2_450)).toBe(0);

    // Enrichment carries the adopter step + ribbon without touching the accepted clock (Stage-1 law).
    const definition = weapon("x2-hailwidow-katana");
    const base = swingDescriptorFor(definition, definition.cooldown);
    const enriched = swingDescriptorForAttackSeq(base, definition, 3);
    expect(enriched).toMatchObject({
      comboVariant: "katana-threehails",
      comboStep: 2,
      motion: "splinter-fall",
    });
    expect(enriched.comboRibbon).toBeDefined();
    expect(enriched.activeStartSeconds).toBe(base.activeStartSeconds);
    expect(enriched.activeEndSeconds).toBe(base.activeEndSeconds);
    expect(enriched.impactSeconds).toBe(base.impactSeconds);
  });

  it("lands the gravechill quake remap with the panelQuakePose list (never separately)", () => {
    // The quake carrier's variant and SpriteRig's impact-remap literal list MUST move together — the
    // tech panel's #1 functional-regression risk (a silent wrong-frame ground crack otherwise).
    expect(weapon("x2-gravechill-nodachi").quake).toBeTruthy();
    const rigSource = readFileSync(
      new URL("../packages/client/src/entities/SpriteRig.ts", import.meta.url),
      "utf8",
    );
    const listStart = rigSource.indexOf("const panelQuakePose =");
    const listEnd = rigSource.indexOf("if (comboPose?.timing.impact", listStart);
    expect(listStart).toBeGreaterThan(-1);
    expect(listEnd).toBeGreaterThan(listStart);
    const list = rigSource.slice(listStart, listEnd);
    expect(list).toContain(`poseVariant === "${DRIFT_MODEL_ADOPTERS["x2-gravechill-nodachi"]}"`);
    expect(list).toContain(`poseVariant === "${DRIFT_MODEL_ADOPTERS["x2-stormpetal-odachi"]}"`);
    expect(list).toContain('poseVariant === "greatsword"');
  });

  it("consumes the per-step ribbon in both painted-edge renderer paths (fallback parity)", () => {
    const renderSource = readFileSync(
      new URL("../packages/client/src/vfx/vfx-render.js", import.meta.url),
      "utf8",
    );
    const fallbackStart = renderSource.indexOf("function drawPerFallback(");
    const renderPerStart = renderSource.indexOf("function renderPer(");
    const renderPerEnd = renderSource.indexOf("function strokeArcG(");
    expect(fallbackStart).toBeGreaterThan(-1);
    expect(renderPerStart).toBeGreaterThan(fallbackStart);
    expect(renderPerEnd).toBeGreaterThan(renderPerStart);
    // The WebGL rope path AND the canvas/quality-4 fallback both read the authored comboRibbon.
    expect(renderSource.slice(fallbackStart, renderPerStart)).toContain("comboRibbon");
    expect(renderSource.slice(renderPerStart, renderPerEnd)).toContain("comboRibbon");
    // Owner-side plumbing: the wielder's own spawnSlash passes the rig's enriched descriptor.
    const arenaSource = readFileSync(
      new URL("../packages/client/src/scenes/ArenaScene.ts", import.meta.url),
      "utf8",
    );
    expect(arenaSource).toContain("rig?.activeSwing ?? swing");
  });
});
