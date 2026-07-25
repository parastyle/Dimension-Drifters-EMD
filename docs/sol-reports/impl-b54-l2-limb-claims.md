# B54 Lane 2 — limb-claim schema and catalog declarations

Date: 2026-07-25

Lane: `impl-b54-l2-limb-claims`

Scope: shared weapon/combo data, generation, schema pins, census tests, and documentation only. No
client rig, gameplay, damage, displacement, recoil, or timing code changed.

## Contract

`WeaponDef.limbClaims?: WeaponLimbClaims` is presentation metadata with six claimable channels:

- `hand-l`, `hand-r`, `foot-l`, `foot-r`
- `head`
- `body-lean`

The resolved contract contains:

```ts
interface WeaponLimbClaims {
  held: readonly WeaponLimbClaim[];
  comboBeats: readonly (readonly WeaponLimbClaim[])[];
}

interface WeaponLimbClaim {
  limb: WeaponLimb;
  release: "snap" | "handoff";
}
```

`held` ownership is continuous while the weapon is equipped. `comboBeats[i]` adds the ownership required
by combo beat `i`; the effective action set is the union of `held` and that beat. Anything outside the
union is free for the per-render-frame spring rig.

Release policy is explicit on every claim:

- `handoff` returns the channel to its spring with the authored exit velocity. The consumer clamps that
  velocity with the shipped `JIGGLE_HANDOFF_MAX_V`.
- `snap` rebases at the spring target with no inherited velocity.

All inferred catalog claims currently use `handoff`. `snap` is available for a future action that
deliberately requires a zero-energy release; it is not inferred casually.

This metadata never enters authority, collision, damage, movement, timing, or netcode. In particular,
`body-lean` is a local pose channel, not root displacement. The schema compatibility pin moved from 45
to 46 as required by the lane order, although no Colyseus field was added.

## Generator and inference

`gen-weapon-limb-claims.mjs` imports the compiled canonical catalog and the shared
`meleeComboSelectionFor()` resolver. This avoids copying combo-family, signature-variant, generated-bar,
and choreography-hand routing into a second implementation. It emits
`weapon-limb-claims.generated.ts`, which is joined into every runtime `WeaponDef`.

The pass is part of both `pnpm gen` and `pnpm gen:check`. Runtime catalog imports fail if any definition
lacks a generated declaration. During generation only, the join permits a just-added weapon to be absent
from the one-pass-old output so the generator can rebuild the complete registry.

Inference rules:

1. A `1H` grip claims `hand-r` while held.
2. `2H`, `dual`, and `mounted` grips claim both hands while held.
3. Caster-class, cast, beam, and glove-pair definitions claim both hands while held, regardless of their
   broad grip fallback.
4. A combo hand beat claims the hand named by the resolved `hand` field: `lead → hand-r`,
   `off → hand-l`, and `both → both hands`.
5. A combo foot beat uses the same authored side selector: `lead → foot-r`, `off → foot-l`, and
   `both → both feet`.
6. Choreography's explicit hand wins over the base combo step hand, matching the shared swing descriptor.
7. Glove-pair wrap kicks therefore add the selected foot to the pair's continuously claimed hands.
8. No inference claims `head` or `body-lean`; those require future explicit authored evidence.

Generation currently emits 359 declarations and 797 resolved combo beats, including fists and archived
identity rows. The active census covers 338 weapons and 740 combo beats.

## Explicit override ledger

There are four overrides. Each corrects a legacy foot beat whose `hand: "both"` describes a two-hand
guard, while the authored strike itself moves one lead/front foot. Leaving raw inference in place would
falsely claim both feet and make these glove-pair actions own all four appendages.

| Weapon | Beat | Generated claim | Reason |
| --- | ---: | --- | --- |
| `x2-muay-thai-wraps` | 3 — Knee Strike | `foot-r / handoff` | One lead/front knee strikes; both hands form the clinch guard. |
| `x2-muay-thai-wraps` | 4 — Roundhouse Kick | `foot-r / handoff` | One lead/front foot strikes; both hands remain the guard. |
| `x2-drunken-fist-wraps` | 3 — Sweeping Leg | `foot-r / handoff` | One lead/front leg sweeps; both hands retain the loose guard. |
| `x2-drunken-fist-wraps` | 4 — Frontflip Heel Drop | `foot-r / handoff` | One lead/front heel is the authored contact; both hands accompany the pose. |

The machine-readable ledger is `data/weapon-limb-claim-overrides.json`. The generator rejects unknown
weapons, invalid limbs/policies, duplicate scopes, out-of-range beats, missing reasons, and overrides
that are redundant with inference.

## Free-limb census

Free counts include all six claimable channels. The separate all-four check considers the four physical
appendages only. Combo counts use the effective `held ∪ comboBeat` action set.

| Action surface | Actions | 5 free | 4 free | 3 free | Claims all four appendages |
| --- | ---: | ---: | ---: | ---: | ---: |
| Held/idle | 338 | 68 | 270 | 0 | 0 |
| Combo beats | 740 | 193 | 539 | 8 | 0 |
| Total | 1,078 | 261 | 809 | 8 | 0 |

Thus 1,070 of 1,078 actions (99.3%) leave at least four of six channels free. The eight three-free
actions are the wrap kicks: two held hands plus one striking foot. No active weapon/action claims all
four appendages.

The census test independently re-derives structural reasons from grip/class/delivery and resolved combo
fields, compares every emitted set, checks override use and non-redundancy, rejects duplicate/invalid
claims, verifies beat-count parity, prints the distribution above, and fails on any four-appendage
action.

## Authoring note

For a future weapon, author truthful grip/class/delivery and combo `limb`/`hand` data first, then run
`pnpm gen`. Do not manually edit the generated TypeScript. Most weapons need no `limbClaims` hand edit.

Add an override only when the existing field vocabulary is genuinely ambiguous or inference is wrong.
Put it in `weapon-limb-claim-overrides.json`, identify the exact held/beat scope, provide the smallest
claim set, choose the release policy deliberately, and explain the authored visual reason. Never use a
claim to encode damage, root movement, gun recoil, timing, or net authority. A free channel is the normal
state.

## Verification

- `pnpm gen` — pass; emitted 359 weapon declarations, 797 combo beats, and 4 overrides
- `pnpm gen:check` — pass
- `pnpm typecheck` — pass across shared, client, and server
- Focused census — 2/2 tests pass, with the census line printed
- Full `pnpm test` — 217/217 files and 2,777/2,777 tests pass
- `git diff --check` — pass

## Files

- Contract/join: `packages/shared/src/weapons.ts`
- Generated registry: `packages/shared/src/weapon-limb-claims.generated.ts`
- Generator/ledger: `tools/artkit/gen-weapon-limb-claims.mjs`,
  `data/weapon-limb-claim-overrides.json`
- Generation commands: `package.json`
- Census: `tests/weapon-limb-claims.test.ts`
- Compatibility pin: `packages/shared/src/constants.ts` plus eight server schema-pin test files
- Report: this file

verdict: contract shipped, 338 weapons inferred, 4 overrides, free-limb census 1,070/1,078 actions keep at least four of six channels free and 0 claim all four appendages, files touched: 16.
