# V6.1 Brutalist Greatsword Line

Six active, two-handed greatswords extend the durable weapon census from 329 to 335. The archive remains
nine weapons, so the active catalog moves from 320 to 326. All six are expansion drops and use the shared
`greatsword-momentum` sequence, `two-hands-on-hilt` grip, `great` size class, and weighted gait.

## Balance placement

The established primary two-handed greatsword cohort (Dervish Greatblade, Tombwarden Claymore, and
Dustreaper Zweihander) has a raw damage/cooldown median of **16.67 DPS**. This line occupies
**15.22–16.43 DPS** (91.3–98.6% of that median): deliberately competitive, never above the cohort median,
with cadence, reach, and arc providing the differences.

| ID | Weapon | Element typing | Damage / cooldown | Raw DPS | Median placement | Extension treatment |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `x2-rimewrit-grave-slab` | Rimewrit Grave-Slab | frost | 14 / 0.92 | 15.22 | 91.3% | frost crystal edge |
| `x2-pyre-gallows-brand` | Pyre-Gallows Brand | fire | 13 / 0.80 | 16.25 | 97.5% | roaring flame blade |
| `x2-stormrail-colossus` | Stormrail Colossus | shock | 11.5 / 0.70 | 16.43 | 98.6% | crackling arc edge |
| `x2-nullwake-ordinance` | Nullwake Ordinance | void | 15 / 0.94 | 15.96 | 95.7% | hollow void with purple rim |
| `x2-dawnwall-testament` | Dawnwall Testament | holy | 12.5 / 0.78 | 16.03 | 96.2% | hard blue-white daylight blade |
| `x2-cairnfall-monolith` | Cairnfall Monolith | physical | 16 / 1.02 | 15.69 | 94.1% | jagged stone blade |

Rimewrit reuses Glacier Headtaker's shared slow payload (`slow`, multiplier `0.1`, `0.8s`). No other status
was added. Rock remains physical element typing because the catalog has no separate rock damage type.

## Shared extension law

Every treatment calls `headsmanExtensionGeometry` and `headsmanExtensionReveal`. The treatment grows
through windup, follows the rig's live blade-tip pose, overlaps the outer 30% of the real blade underneath
the wielder, and ends at exactly three times the physical blade length. It is presentation-only: authoritative
melee range is unchanged.

Dawnwall's extension is blue-white, hard-edged, and architectural. It does not reuse the Headsman's
champagne/gold, curved, spectral Pale Procession language.

## Artkit outcomes

The six held sprites and six extension sheets each passed the Codex render, chroma key, alpha scrub, visual
inspection, slice/install, manifest, and atlas stages on **attempt 1 of 3**. No render failed and no retry was
consumed. Each held sprite resolved to one connected tip-right part. Extension validation reported:

| Treatment | Installed sheet | Installed dimensions | Visible pixels |
| --- | --- | ---: | ---: |
| frost | `frost-crystal-edge.png` | 528x121 | 33,531 |
| fire | `roaring-flame-blade.png` | 528x148 | 34,763 |
| electricity | `crackling-arc-edge.png` | 528x104 | 23,090 |
| void | `hollow-void-rim.png` | 528x131 | 31,096 |
| light | `radiant-daylight-blade.png` | 528x131 | 29,546 |
| rock | `jagged-stone-blade.png` | 528x131 | 31,784 |

The final physical-weapon prompt set is in `tools/artkit/subjects-300.json`; the extension prompt set is in
`tools/artkit/subjects-v6-1-brutalist-greatswords.json`. The extension installer is
`tools/artkit/install-v6-1-brutalist-greatswords.mjs`.

## Census

| Census | Before | After | Delta |
| --- | ---: | ---: | ---: |
| durable weapon resources | 329 | 335 | +6 |
| active catalog / portal | 320 | 326 | +6 |
| archived | 9 | 9 | 0 |
| melee resource delivery | 167 | 173 | +6 |
| active expansion | 291 | 297 | +6 |

Thrown (18), gun (116), cast (2), beam (22), and zone (4) resource-delivery counts are unchanged.
