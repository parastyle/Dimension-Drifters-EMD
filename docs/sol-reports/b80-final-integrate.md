# B80 final integration

## Outcome

The 394-weapon catalog is green at 374 active and 20 archived. The initial full run reported 10
failed tests plus 8 suites blocked during import. No test was deleted, skipped, or weakened. Literal
cohort and distribution pins remain literal where B78 documented intent; the one newly discovered
pure-size telemetry pin now derives from the matrix it measures.

The recoil failure was treated as the standing every-ranged-weapon law. The final cohort contains
143 ranged guns and 6 ranged beams, every member has positive physical recoil, and every non-ranged
weapon remains at zero. No recoil or other balance value was changed.

## Failure classification and action

| Failure | Kind | Action |
|---|---|---|
| Gun-SFX import failure (`x2-zenith-photon-dmr`) blocked 8 suites | Behavioural law | Restored cumulative energy-family routing in `gun-sfx.ts`: photon marksman rifles and plasma carbines now resolve to the installed precision energy/coil family. The exact active-gun cohort pin moved 147 -> 151 only after all 151 mapped exactly once. |
| `pose-language`: `x2-nova-pulse-repeater` used the fallback | Behavioural law | Restored all five missing ranged family names from the parallel gun branches: `beam-sidearm`, `heavy-ion-cannon`, `photon-marksman-rifle`, `plasma-carbine`, and `pulse-rifle`. The catalog-wide no-fallback assertion is unchanged. |
| `b24-radial-hunt`: resolver cohort 350 -> 355 | Behavioural membership law | All five eligible additions pass fallback removal. Kept the intent pins literal and moved total 350 -> 355, former `blade-trail` membership 312 -> 317, and active membership 332 -> 337. |
| `b30-expunged-vfx-envelope-audit`: cohort 350 -> 355 | Behavioural membership law | All five additions pass the visible/damage envelope audit; moved the literal membership tripwire to 355. |
| `b31-recovered-art-integrator`: catalog 389 -> 394 | Legitimate count growth | Preserved its historical literal contract and moved catalog 389 -> 394, active 369 -> 374, and active expansion 340 -> 345. Archives remain the separately pinned 20. |
| `b45-gun-recoil`: ranged guns 139 -> 143 | Behavioural law | Audited the law before moving either pin: all 143 gun definitions and all 6 beam definitions have positive recoil; melee/caster roots remain planted. Moved gun 139 -> 143 and beam 5 -> 6 cohort tripwires. |
| `data-consistency`: concept header ranged 138 vs 143 | Legitimate count growth | Corrected only `data/weapon-concepts-300.json` metadata to `ranged: 143`; the 375 concept rows and weapon identities are unchanged. |
| `driftblade-model-panel`: ordinary `arc/default` routes 126 -> 127 | Behavioural membership law | Confirmed the new non-adopter takes the existing ordinary arc route and no existing route changed; moved the exact invariance aggregate to 127. |
| `v5g-gun-muzzle-alpha`: muzzle cohort 173 -> 178 | Behavioural law | All five additions have valid generated art-space points at their derived barrel tips. Moved the literal weapon and minimum-point pins to 178; the validator and tolerance are unchanged. |
| `weapon-resource`: delivery ownership changed | Behavioural membership law | Confirmed four additions enter `gun` and one enters `beam`; moved the exact delivery golden from gun 148 / beam 24 to gun 152 / beam 25. Formula coefficients, medians, and balance are unchanged. |
| `weapon-tiers`: authored tier population changed | Legitimate count growth | Kept the authored five-tier distribution literal and moved it from `[75, 77, 71, 80, 66]` to `[75, 78, 72, 82, 67]`. |
| Telemetry acceptance ran 129 scenarios but expected 125 | Legitimate pure-count growth | Replaced the stale non-gun constant with a derivation from 12 fixed cases plus declared parry directions, combo wraps, live gun-family representatives, live beam representatives, and the optional ultimate. Scenario assertions and zero-correction gates are unchanged. |

## Pin accounting

Fifteen intentional literal assertions or exact aggregate goldens were bumped:

| Owner | Pins bumped |
|---|---:|
| Active gun SFX cohort | 1 |
| B24 fallback-removal cohort | 3 |
| B30 hit-envelope cohort | 1 |
| B31 historical census | 3 |
| B45 recoil cohorts | 2 |
| Driftblade route invariance aggregate | 1 |
| V7 muzzle cohorts | 2 |
| Drive delivery aggregate | 1 |
| Authored tier aggregate | 1 |

One newly exposed pure-count pin was derived: telemetry scenario totals now follow the constructed
top-down and belt matrices. The concept source's `byType.ranged` metadata correction is not counted
as a test pin.

## Real defects found in guns 22-30

1. **Zenith Photon DMR and Ember Plasma Carbine had no gun fire-sound family after integration.**
   Their individual branches each added a case from the same pre-merge switch, but the cumulative
   switch retained neither case. `photon-marksman-rifle` and `plasma-carbine` now resolve through the
   installed `coil-rail` precision-energy treatment. The active registry constructs successfully and
   equals all 151 active gun IDs.
2. **Five new energy families were absent from intentional pose classification.** Nova Pulse
   Repeater, Zenith Photon DMR, Ember Plasma Carbine, Singularity Micro-Lance, and Aurora Ion Cannon
   would have reported an accidental long-gun/pistol fallback one at a time. Their family names are
   now explicit in the ranged vocabulary. Magnetar, Solaris, Prism, and Voltcaster were already
   covered by `coil-accelerator`, `continuous-beam-rifle`, `energy-shotgun`, and `arc-pistol`.

The concept census header was stale count metadata, not a weapon behaviour defect. No missing recoil,
manifest row, VFX override, muzzle allocation, taxonomy import, or behaviour-line defect remained
after the full audit.

## Thirty-gun validation

The 30 IDs were read from `b63-gun-01.md` through `b63-gun-30.md` and checked against the live shared
catalog:

- reports: 30; unique IDs: 30; active catalog members: 30;
- taxonomy: 30/30 calls to `weaponTaxonomyFor` return a non-empty subclass and none throws. New
  singleton families correctly normalize to `Special/Special` after their title-cased family
  derivation under the B79 owner law;
- muzzle: 30/30 have at least one art-space muzzle point; the catalog-wide derivation validator
  reports no failures;
- behaviour: 30/30 resolve to a non-empty `weaponBehaviourLine`, using authored copy where present
  and authoritative delivery-derived copy otherwise;
- recoil: 30/30 are positive, consistent with the catalog-wide ranged-root law.

## Verification

- Affected set: 11/11 files pass; 519 passed.
- `pnpm gen`: pass. The isolated worktree lacks the ignored VFX reference artifacts, so the unscoped
  empty local subject rewrite was discarded; no production generated artifact is out of sync.
- `pnpm gen:check`: pass; the expected unavailable-reference VFX subject check is explicitly skipped.
- `pnpm typecheck`: pass for shared, client, and server.
- Telemetry: pass, 129/129 scenarios; 64 top-down and 65 belt; 38 gun families and 6 ranged beams;
  zero requests, applications, silent corrections, smooth corrections, snaps, and correction pixels.
- Full suite run 1: 242/242 files; 2,924 passed and 20 skipped.
- Full suite run 2, consecutive with run 1: 242/242 files; 2,924 passed and 20 skipped.
- Owner-map files, lava-foundry, walkability painting, movement constants, weapon identities, and
  weapon balance are unchanged.

verdict: 18 test/suite failures fixed, 16 pins derived/bumped, 2 real defects found+fixed, 30/30 guns valid (subclass + muzzle + behaviour line), telemetry PASS 129/129 with zero requests/applications/snaps/pixels in top-down and belt, 2x test results PASS 242/242 files with 2,924 passed and 20 skipped each run.
