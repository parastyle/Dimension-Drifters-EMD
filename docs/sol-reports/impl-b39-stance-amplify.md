# Sol Report — B39 Stance Amplify

Branch: `sol/b39-stance-amplify`

## Base

- The repository has no `origin/main`; its current integration line is
  `origin/feat/v0.118-metagame`.
- `git rebase origin/feat/v0.118-metagame` reported the branch up to date at `c75fe9d`.
- That base contains B38's `8a157b9 fix(anim): layer revolver hammer hands above art` change in
  `SpriteRig`.

## Implementation

- Replaced B35's rotation-only gun nod with a catalog-derived cheek-weld pose containing both a
  visible downward translation and an amplified nod.
- The final head pose is applied after the floating-head spring resolves and before head-attached
  gear is synchronized. Hats, face gear, and other riders therefore inherit the final translated
  and rotated head transform.
- Both translation and rotation are multiplied by the existing `rangedAimBlend`; the established
  90 ms raise / 180 ms settle envelope supplies smooth entry and exit.
- The existing determinant-sign correction remains in the rotation path, so left and right facings
  both nod visually downward. Translation is screen-vertical in rig-local space and is naturally
  invariant under the horizontal root mirror.

## Catalog mapping and tuning

| Cheek-weld class | Catalog derivation | Drop | Nod |
| --- | --- | ---: | ---: |
| `sightedLong` | `tags.family` ends in `-rifle`, family is `railgun`, or `tags.handling` contains `bolt` | 18 px | 0.11 rad |
| `short` | Every other held gun, including pistols, rapid guns, scatterguns, and launchers | 9 px | 0.07 rad |

The mapping has no weapon-id allowlist. Tests pin family-derived Cinderbore and Sunbreaker, the
bolt-derived Barrett and Mauler, four compact/short gun fixtures, and a non-gun negative fixture.
B35's affected regression assertion was migrated from “nod below 0.08” to the new full/half
translation-plus-rotation contract.

## Verification

- Focused stance/rig tests: passed, 2 files / 39 tests.
- `pnpm typecheck`: passed.
- Full `pnpm test`: passed, 190 files / 2,358 tests.
- The isolated worktree initially lacked ignored ArtKit test dependencies/output fixtures; local
  ignored junctions restored those prerequisites without entering the diff. The final full run is
  green.
- B39 live gate: passed, 1 Playwright test against the real arena client/server stack.
- Private ephemeral ports: client `65494`, game `65493`; protected defaults `5180` and `2567` were
  not used.
- Character/camera: `proto-cowboy-hidden-face`, 1.5× combat zoom.

## Live visual receipt

Evidence is retained under
`docs/owner-notes-audit-v11-evidence/b39-stance-amplify/`:

- Eight raw captures: unarmed idle, Barrett bolt-action rifle, Sunbreaker railgun, and Revolver
  Cannon pistol in both facings.
- Six labeled side-by-side contrasts with matching-facing unarmed idle on the left and the armed
  stance on the right.
- `live-gate.json` records ports, catalog tags, facing settlement, local/screen drop, head-height
  ratio, nod delta, and head/body/weapon bounds for every capture.
- `README.md` records the visual verdict and private-port receipt.

Measured live values:

- Barrett both facings: 18 px local drop, 20.1% of head height, 0.11 rad nod.
- Sunbreaker both facings: 18 px local drop, 19.9–20.4% of head height, 0.11 rad nod.
- Revolver both facings: 9 px local drop, 9.6% of head height, 0.07 rad nod.
- Every armed head center remained at least 32.6 px above the weapon centerline. Visual inspection
  of all six contrasts shows the scarf/stock proximity reading as a cheek weld without the face
  disappearing into the torso or gun art.

Verdict: drop px by weapon class = sightedLong 18 / short 9; rotation rad = sightedLong 0.11 / short 0.07; contrast captures retained = 6 side-by-sides + 8 raw under b39-stance-amplify; files touched = 22.
