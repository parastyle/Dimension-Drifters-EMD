# B19 Kung-Fu Wraps Rework Integrator

## Understanding

B19 replaces the B14 hand-only glove-pair illusion with a complete worn-limb rig. Each wrap weapon now owns exactly one digit-free hand-wrap sprite (`part-1.png`) and one digit-free foot-wrap sprite (`part-2.png`). While equipped, SpriteRig must duplicate and mirror those two sources across the character's two hand joints and two foot joints, suppressing the corresponding bare limb sprites so a character can never show a third fist, a fused pair, or mixed bare/wrapped extremities. This must remain true facing both right and left.

The four scrolls also need longer four- or five-beat signatures that mix hand and foot strikes, preserve each shipped nominal DPS within +/-10%, and read as distinct fantasized martial arts. Each accepted beat remains server-owned. Its authored displacement starts at that beat's active window, captures the accepted aim, and travels through the existing `PendingWeaponLunge`/`stepPendingWeaponLunges` path. B19 extends that path with signed forward and lateral components so authored advances, retreats, and Drunken Fist side weaves are collision/nav validated. The client continues to predict ordinary input only and reconciles authored root motion from server snapshots, using the existing local correction and remote interpolation paths rather than a presentation-only teleport.

Punch beats anchor their accents to the duplicated `part-1` striking limb. Kick, knee, sweep, and stomp beats anchor their accents to the duplicated `part-2` foot limb and its generated muzzle point. B14's per-style recipes and audio identity are retained, with timing and impact weight redistributed over the longer bars.

## Per-style beat chart

| Style | Beat | Limb / motion | Damage multiplier | Authored root displacement |
| --- | ---: | --- | ---: | --- |
| Muay Thai | 1 | lead-foot teep kick | 0.80 | +10 px forward |
| Muay Thai | 2 | lead elbow | 0.90 | +4 px forward |
| Muay Thai | 3 | rear elbow | 0.90 | +5 px forward |
| Muay Thai | 4 | clinch knee | 1.10 | +12 px forward |
| Muay Thai | 5 | spinning back-elbow finisher | 1.30 | +8 px forward |
| Wing Chun | 1 | lead chain punch | 0.80 | +3 px forward |
| Wing Chun | 2 | rear chain punch | 0.80 | +3 px forward |
| Wing Chun | 3 | lead chain punch | 0.80 | +4 px forward |
| Wing Chun | 4 | low oblique kick | 1.10 | +7 px forward |
| Wing Chun | 5 | double-palm burst | 1.50 | +9 px forward |
| Drunken Fist | 1 | swaying lead jab | 0.80 | +3 px forward, +7 px lateral |
| Drunken Fist | 2 | reverse-feint cross | 0.90 | -3 px forward, -9 px lateral |
| Drunken Fist | 3 | shoulder-weave backfist | 0.90 | +5 px forward, +8 px lateral |
| Drunken Fist | 4 | low sweeping leg | 1.10 | -2 px forward, -11 px lateral |
| Drunken Fist | 5 | falling haymaker | 1.30 | +12 px forward, +4 px lateral |
| Iron Palm | 1 | slow crushing lead palm | 0.90 | +5 px forward |
| Iron Palm | 2 | plated stomp kick | 1.00 | +12 px forward |
| Iron Palm | 3 | rear-palm wind-up strike | 1.00 | -3 px forward |
| Iron Palm | 4 | double-palm quake finisher | 1.10 | +16 px forward |

Each bar's damage multipliers average 1.0, so the shipped base damage/cooldown pairs retain their 20 nominal DPS: Muay Thai 15/0.75, Wing Chun 4/0.20, Drunken Fist 10/0.50, and Iron Palm 18/0.90.

## Displacement and reconciliation plan

1. Add a shared per-beat root-motion descriptor with signed `forwardPx`, signed `lateralPx`, and a bounded duration. Generate it beside each combo beat so shared client presentation and server authority consume the same authored index.
2. At accepted active start, rotate forward/lateral motion into world space from the captured aim. Validate the proposed endpoint and sampled travel segment through `navValidLungeDest`, reject a correction that reverses the requested motion, and interpolate only along the accepted legal segment in `stepPendingWeaponLunges`.
3. Keep movement non-invulnerable and damage timing unchanged. Ordinary input cannot overwrite an active authored segment, and every completed step updates the authoritative ground position.
4. Let the existing owner prediction reconciliation absorb the small authoritative deltas smoothly and let remote rigs follow the same synced snapshots. Add focused tests that prove both paths use synced root coordinates without client-authored displacement.

## Implementation plan

1. Extend the generated combo vocabulary with the required teep, elbow pair, clinch knee, spin elbow, oblique kick, double palm, drunken weave/sweep/fall, stomp, and quake-finisher motions plus per-beat limb identity and root motion.
2. Rebuild the four source combo bars, regenerate shared definitions, and retime the existing B14 VFX/SFX recipes so foot beats use `part-2` anchors.
3. Extend authoritative root stepping for signed forward/lateral motion while preserving B5 destination-lunge behavior for unrelated weapons.
4. Replace wrap glove-pair held rendering with four joint-mounted worn sprites and suppress only the character's base hands/feet while a B19 wrap is equipped.
5. Update the B14 tests to the B19 contract and add combo-signature, DPS, nav authority, reconciliation, limb-count, no-fused-pair, and both-facing coverage.
6. Run generation, generated-diff validation, typecheck, the full test suite, and asset validation. Then boot only private ephemeral server/client ports, exercise every full bar in both facings on `proto-cowboy-hidden-face`, retain captures/logs/JSON, and close both listeners.

## Per-wrap implementation results

### Muay Thai Wraps

Implemented the five-beat teep -> elbow -> elbow -> clinch knee -> spinning back-elbow bar. The foot beats route through the live `part-2` muzzle, hand beats use `part-1`, the accepted root steps total 39 authored forward pixels before nav limiting, and the damage multipliers average 1.0. Live right/left captures confirmed the crimson hand/foot duplication, exact signature, heavy accents, and mirrored displacement.

### Wing Chun Wraps

Implemented the fastest five-beat bar: three 200 ms centerline chain punches, a low oblique kick, and a double-palm burst. The last palm carries the redistributed finisher weight while the five multipliers average 1.0. Live right/left captures confirmed the white endless-knot mitts and boots, distinct hand/foot anchors, exact signature, and the fastest observed cadence.

### Drunken Fist Wraps

Implemented five signed-direction beats with forward/backward and lateral feints: swaying jab, reverse cross, weaving backfist, sweeping leg, and falling haymaker. The authored path is 50.4 px even though its opposing vectors partially cancel. Live right/left captures confirmed the tan wine-stained 2+2 rig, foot sweep anchor, exact bar, alternating drift, and server-limited travel.

### Iron Palm Wraps

Implemented the four-beat heavy bar: crushing palm, plated stomp, wind-up retreat, and double-palm quake finisher. The 36 px authored path includes the 3 px wind-up retreat, and its multipliers average 1.0. Live right/left captures confirmed the grey plated mitt/boot duplication, stomp foot anchor, quake presentation, exact signature, and the slowest/heaviest cadence.

## Completed integration

SpriteRig now creates two hand mounts from wrap part 0 and two foot mounts from part 1, suppresses the character's base hand/foot and gear attachments for the equipped interval, mirrors the common actor root for either facing, destroys both mount groups on swap/unequip, and exposes live limb-specific muzzle transforms. The server schedules every B19 root step from accepted aim at active start, runs it through endpoint plus full-segment pit/POI/belt navigation checks, and publishes the resulting player coordinates through the existing authoritative state. Local correction smoothing and remote interpolation tests cover the client reconciliation path.

B14's recipes remain the style source, with beat-aware limb routing and audio weights. Unit and integration tests cover the 2+2 mount plan, unique receivers, both facings, art connectivity, combo distinctness, cadence order, the 18–22 DPS band, authored server movement, pit clamping, local/remote reconciliation, limb-aware audio, and style VFX.

Verification is green: generation and generated-diff checks, typecheck, 167 full test files / 2,235 tests, asset validation, diff whitespace validation, and the private-port Playwright gate. The live run used client `52790` and game `52789`, never `5180` or `2567`, and retained eight telemetry captures plus sixteen hand/foot PNGs under `docs/owner-notes-audit-v10-evidence/b19-kungfu-rework/`.

Files touched: `data/weapon-concepts-300.json`; `tools/artkit/gen-weapon-expansion.mjs`; `packages/shared/src/melee.ts`, `weapons.ts`, and `weapons-expansion.generated.ts`; client SpriteRig, pose, ArenaScene, VFX recipes/runtime, prediction/snapshot tests, and wrap rig/VFX tests; server GameRoom and B19 authority tests; shared B14 contract tests; the B19 Playwright live gate; this report; and the B19 evidence directory. No wrap art, character base sprites, fans, Wyrmskull, Mirage, or pets were modified.

verdict: 4 wraps rendering 2+2 limbs, 4 elaborate combos with displacement, DPS bands 18-22 (all nominal 20), evidence path docs/owner-notes-audit-v10-evidence/b19-kungfu-rework/, files touched shared generator/contracts, four wrap definitions, SpriteRig/client pose/VFX/reconciliation, GameRoom authority, B19 tests/live gate, report, and evidence
