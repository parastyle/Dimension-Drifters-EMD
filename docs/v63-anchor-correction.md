# V6.3 anchor-law correction

Date: 2026-07-21  
Branch: `feat/v0.118-metagame`

## Corrected law

> "ONLY relocate effects that were already character-centered."

Conditional form: **if** a weapon defines a character-anchored hit-class effect, **then** that effect
must anchor at the attacked/impact point. A weapon with no impact effect passes. No coverage test or
fallback builder may manufacture a cursor effect merely to satisfy anchor coverage.

The provenance boundary is weapon-authored composition. `ee27031` extracted an older generic
element/archetype fallback and split every target-class layer into a second target surface. Although the
generic layer primitives existed in the old builder, the 64 weapons below had no weapon-authored impact
recipe or authored target suite at the V5 baseline. Promoting those generic flourishes into independent
cursor punctuation is therefore **ADDED** under the owner's clarified category law. Their source/motion
fallback remains; only its target partition is deleted.

The 11 pre-existing authored suites below are different: their specific hit layers are visible in
`b3b1fd0` and were relocated by the split, so they are **MOVED** and stay. The six brutalist greatswords
introduced by `9064298` are new V6.1 weapon-line authoring, not impact-sweep fallout, and are outside this
revert. `9064298`'s four existing ring-to-painted replacements retain their genuine pre-sweep predecessor.

## Mandatory provenance table

### MOVED — kept (11)

Each row's authored layer is visible in `b3b1fd0` (`weapon-vfx.generated.ts` / override source) before
`f738040`; `ee27031` changed placement, not composition.

| Weapon | Pre-sweep authored hit layer(s) | Result | Pre-sweep source |
|---|---|---|---|
| Buzzcutter (`x-sword-buzzsaw`) | `cleave-flash`, `hit-spark` | MOVED-kept | `b3b1fd0` |
| Voltedge (`x-sword-neon-katana`) | `hit-spark`, `arc-bolt` | MOVED-kept | `b3b1fd0` |
| Wyrmtooth (`x-sword-bone`) | `hit-spark`, `impact-flash` | MOVED-kept | `b3b1fd0` |
| Mournveil Scythe (`x2-mournveil-scythe`) | `shockwave-ring` (painted replacement in `9064298`) | MOVED-kept | `b3b1fd0` |
| Stillwater Edict (`drift-katana-stillwater-edict`) | `impact-flash` | MOVED-kept | `b3b1fd0` |
| Stormthread Tachi (`drift-katana-stormthread`) | `arc-bolt`, `hit-spark` | MOVED-kept | `b3b1fd0` |
| Riftstep Katana (`drift-katana-riftstep`) | `cleave-flash` | MOVED-kept | `b3b1fd0` |
| Gatebreaker Odachi (`drift-nodachi-gatebreaker`) | `cleave-flash`, `hit-spark` | MOVED-kept | `b3b1fd0` |
| Moonwake Great Katana (`drift-greatkatana-moonwake`) | `shockwave-ring`, `impact-flash` (ring painted in `9064298`) | MOVED-kept | `b3b1fd0` |
| Tempest Regent (`drift-greatkatana-tempest-regent`) | `arc-bolt`, `shockwave-ring` (ring painted in `9064298`) | MOVED-kept | `b3b1fd0` |
| World-Seam Odachi (`drift-colossal-world-seam`) | `cleave-flash`, `shockwave-ring`, `impact-flash` (ring painted in `9064298`) | MOVED-kept | `b3b1fd0` |

### ADDED — deleted (64)

For every row, `b3b1fd0` shows no weapon-authored target suite/impact recipe for the deleted fallback
punctuation. Existing typed motion recipes, authored slash art, blade extensions, and source fallback
ribbons remain untouched.

| Weapon | Sweep-added target fallback deleted | Result | Pre-sweep source |
|---|---|---|---|
| Gravewarden Buster (`gravediggers-spade`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Tombstone Greatsword (`tombstone-greatsword`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Dervish Greatblade (`x-sword-whirlwind`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Driftblade (`driftblade`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Drowned Anchor (`x-sword-anchor`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Reaper's Lid (`x-sword-coffin`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Brimstone Falcata (`x2-brimstone-falcata`) | `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Hailwidow Katana (`x2-hailwidow-katana`) | `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Gravechill Nodachi (`x2-gravechill-nodachi`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Voltfang Tachi (`x2-voltfang-tachi`) | `arc-bolt`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Reverent Broadsword (`x2-reverent-broadsword`) | `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Phantom Estoc (`x2-phantom-estoc`) | `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Mirage Hardlight Saber (`x2-mirage-hardlight-saber`) | `impact-flash`, `arc-bolt`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Riftcleaver Greatblade (`x2-riftcleaver-greatblade`) | `cleave-flash`, `painted-impact`, `impact-flash`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Cinderfang Wakizashi Pair (`x2-cinderfang-wakizashi-pair`) | `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Verdict Longsword (`x2-verdict-longsword`) | `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Bonewhisper Jian (`x2-bonewhisper-jian`) | `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Stormpetal Odachi (`x2-stormpetal-odachi`) | `cleave-flash`, `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Toxinwell Khopesh (`x2-toxinwell-khopesh`) | `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Cinderbrand Cleaver (`x2-cinderbrand-cleaver`) | `cleave-flash`, `painted-impact`, `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Permafrost Bardiche (`x2-permafrost-bardiche`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Thunderhoof Splittingaxe (`x2-thunderhoof-splittingaxe`) | `cleave-flash`, `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Sanctified Headsman (`x2-sanctified-headsman`) | `cleave-flash`, `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Hollowmoon Reaver (`x2-hollowmoon-reaver`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Sluicebox Maul-Axe (`x2-sluicebox-maul-axe`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Brimstone Doubleheader (`x2-brimstone-doubleheader`) | `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Glacier Headtaker (`x2-glacier-headtaker`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Choir-Iron Greataxe (`x2-choir-iron-greataxe`) | `cleave-flash`, `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Witchwood Splitter (`x2-witchwood-splitter`) | `cleave-flash`, `painted-impact`, `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Stormcrow Twin-Hatchets (`x2-stormcrow-twin-hatchets`) | `arc-bolt`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Reliquary Broadaxe (`x2-reliquary-broadaxe`) | `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Iron Vow Bearded Axe (`x2-iron-vow-bearded-axe`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Dustdevil Glaive (`x2-dustdevil-glaive`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Rimethorn Naginata (`x2-rimethorn-naginata`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Galvanic Lancepole (`x2-galvanic-lancepole`) | `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Reliquary Halberd (`x2-reliquary-halberd`) | `cleave-flash`, `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Venomtongue Trident (`x2-venomtongue-trident`) | `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Hexglyph Partisan (`x2-hexglyph-partisan`) | `cleave-flash`, `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Quarry-Splitter Bardiche (`x2-quarry-splitter-bardiche`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Wickfire Fauchard (`x2-wickfire-fauchard`) | `cleave-flash`, `painted-impact`, `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Saintspar Lochaber (`x2-saintspar-lochaber`) | `cleave-flash`, `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Thunderhead Voulge (`x2-thunderhead-voulge`) | `cleave-flash`, `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Marrowpike Ranseur (`x2-marrowpike-ranseur`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Blightfork Glaive (`x2-blightfork-glaive`) | `cleave-flash`, `painted-impact`, `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Boomtown Maul (`x2-boomtown-maul`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Quicksilver Censer (`x2-quicksilver-censer`) | `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Thunderhead Sledge (`x2-thunderhead-sledge`) | `cleave-flash`, `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Frostbite Headstone (`x2-frostbite-headstone`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Pendulum of the Pyre (`x2-pendulum-of-the-pyre`) | `cleave-flash`, `painted-impact`, `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Anvil-Drop (`x2-anvil-drop`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Dustdevil Warmaul (`x2-dustdevil-warmaul`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Saint Calamity (`x2-saint-calamity`) | `cleave-flash`, `painted-impact`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Hoarfrost Piledriver (`x2-hoarfrost-piledriver`) | `cleave-flash`, `painted-impact`, `hit-spark`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Widowmaker Wrecking-Ball (`x2-widowmaker-wrecking-ball`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Bramblecoil (`x2-bramblecoil`) | `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Reaper's Tithe (`x2-reaper-s-tithe`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Gravechain Scythe (`x2-gravechain-scythe`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Plaguethresh (`x2-plaguethresh`) | `cleave-flash`, `painted-impact`, `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |
| Hollow Harvest (`x2-hollow-harvest`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Rendclaw Vambrace (`x2-rendclaw-vambrace`) | `arc-bolt`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Frostfang Rakes (`x2-frostfang-rakes`) | `painted-impact`, `arc-bolt` | ADDED-deleted | `b3b1fd0` |
| Cinder Briar (`x2-cinder-briar`) | `ember-rain`, `impact-flash` | ADDED-deleted | `b3b1fd0` |
| Abyssal Apocrypha (`x2-abyssal-apocrypha`) | `cleave-flash`, `painted-impact` | ADDED-deleted | `b3b1fd0` |
| Verdigris Grand Grimoire (`x2-verdigris-grand-grimoire`) | `cleave-flash`, `painted-impact`, `ember-rain`, `hit-spark` | ADDED-deleted | `b3b1fd0` |

### EXPLICIT — kept (11)

The target effect named by the applicable owner-ledger row stays. When the same weapon also resolved a
generic fallback target partition, that fallback partition is deleted so the authored/named effect is the
only impact composition.

| Weapon | Explicit owner disposition | Result | Pre-sweep source / ledger cross-check |
|---|---|---|---|
| Hexbloom Rapier (`x2-hexbloom-rapier`) | toxic VFX at point of impact | EXPLICIT-kept; generic toxic fallback deleted | `b3b1fd0` (no dedicated impact); V5G2 row |
| Sermon Bell (`x2-sermon-bell`) | notes on impact, at impact | EXPLICIT-kept; generic holy fallback deleted | `b3b1fd0` (`sermon-musical-notes`, body); V5G2 row |
| Tombwarden Claymore (`x2-tombwarden-claymore`) | dark slash to cursor | EXPLICIT-kept; generic heavy fallback deleted | `b3b1fd0` (`tombwarden-dark-slash`, blade); V5G2 row |
| Hangman's Greatcleaver (`x2-hangman-s-greatcleaver`) | non-gore spatter on cursor | EXPLICIT-kept; generic heavy fallback deleted | `b3b1fd0` (`hangman-blood-spatter`, blade); V5G2 row |
| Cinderbrand Pike (`x2-cinderbrand-pike`) | magma at impact | EXPLICIT-kept; generic fire fallback deleted | `b3b1fd0` (no dedicated impact); V5G2 row |
| Wendigo Claws (`x2-wendigo-claws`) | existing hit cue on target | EXPLICIT-kept | `4e027cb` (pre-`ee27031` frost fallback); V6G1 row |
| Revenant Knuckle (`x2-revenant-knuckle`) | circle successor on attacked area | EXPLICIT-kept as painted impact | `4e027cb` (pre-`ee27031` void circle fallback); V6G1 row |
| Riftcaller Naginata (`x2-riftcaller-naginata`) | self aura deleted | EXPLICIT-kept as deletion; no target fallback | `4e027cb` (pre-`ee27031` void self aura); V6G1 row |
| Seraph's Knuckle-Reliquary (`x2-seraph-s-knuckle-reliquary`) | beam endpoint at cursor | EXPLICIT-kept | `4e027cb` (pre-`ee27031` beam endpoint); V6G1 row |
| Dustreaper Zweihander (`x2-dustreaper-zweihander`) | 30x flame at cursor | EXPLICIT-kept; generic heavy fallback deleted | `4e027cb` (`dustreaper-continuous-edge`, blade); V6G1 row |
| Nullspike Pike (`x2-nullspike-pike`) | circle on enemy | EXPLICIT-kept; generic void fallback deleted | `b3b1fd0` (`nullspike-impact-circle`, already target); V3 row |

## Dedupe result

The unauthored fallback builder is now source/motion-only. It can synthesize `blade-trail`,
`twin-slash`, or `thrust-streak`, but never a hit/cast/impact layer. Wendigo and Revenant are the only
named fallback-impact exceptions. Typed explicit recipes (Hexbloom, Sermon, Tombwarden, Hangman,
Cinderbrand Pike, Dustreaper, Nullspike) therefore no longer stack with generic target punctuation.
Riftcaller's painted circle successor is also absent.

## Live evidence

The V6.3 probe targets recognizable ADDED cases: Driftblade, Voltfang Tachi, Sanctified Headsman,
Drowned Anchor, Gravechain Scythe, and Cinderbrand Cleaver. For a nondisruptive comparison, each
`before` page intercepts only its own Vite module response and reconstructs the deleted generic target
partition; the working tree and owner stack remain on corrected code. Every `before` JSON records source
layers plus the old target layers. Every corrected `after` JSON records the same source `blade-trail` and
an empty target list. All 12 browser-error lists are empty.

| Weapon | Before | After |
|---|---|---|
| Driftblade | `docs/owner-notes-audit-v6-evidence/v63/before-driftblade.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-driftblade.{png,json}` |
| Voltfang Tachi | `docs/owner-notes-audit-v6-evidence/v63/before-voltfang.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-voltfang.{png,json}` |
| Sanctified Headsman | `docs/owner-notes-audit-v6-evidence/v63/before-headsman.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-headsman.{png,json}` |
| Drowned Anchor | `docs/owner-notes-audit-v6-evidence/v63/before-drowned-anchor.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-drowned-anchor.{png,json}` |
| Gravechain Scythe | `docs/owner-notes-audit-v6-evidence/v63/before-gravechain.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-gravechain.{png,json}` |
| Cinderbrand Cleaver | `docs/owner-notes-audit-v6-evidence/v63/before-cinderbrand-cleaver.{png,json}` | `docs/owner-notes-audit-v6-evidence/v63/after-cinderbrand-cleaver.{png,json}` |

Aggregate records: `before-summary.json` and `after-summary.json` in the same directory.

## Files changed

- `packages/client/src/vfx/weapon-vfx-suite.ts` — source-only generic fallback plus the two named
  fallback-impact exceptions.
- `tests/v6g-systemic-owner-orders.test.ts`, `tests/v61-ship-fix.test.ts`, and
  `tests/weapon-vfx-owner-notes.test.ts` — conditional law, dedupe, MOVED retention, and targetless pass
  coverage.
- `tools/v61-headsman-circle-live-probe.mjs` — old V6.1 live gate made conditional.
- `tools/v63-anchor-correction-live-probe.mjs` and
  `e2e/tests/v63-anchor-correction-live-probe.spec.ts` — six-case before/after live evidence.
- `docs/owner-notes-audit-v6-evidence/v63/` — 12 paired PNG/JSON captures and two summaries.
- `docs/v63-anchor-correction.md` — provenance, exhaustive category table, law, evidence, and validation.

## Validation

| Check | Result |
|---|---|
| Targeted V6G/V6.1/weapon-VFX tests | 21 passed, 0 failed |
| `pnpm typecheck` | pass |
| `npx vitest run` | 125 files / 1,705 tests passed; 0 failed |
| `pnpm e2e` with `DD_E2E_BASE_URL=http://localhost:5180` | 18 passed; 0 failed |
| V6.3 live probe | 6 before + 6 after captures; all assertions true; 0 browser errors |
| Owner stack 5180/2567 | original listeners preserved: PID 172652 / PID 126676 |
