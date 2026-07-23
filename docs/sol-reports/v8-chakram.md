# v8 Chakram — implementation report

## Understanding

Add a durable catalog chakram that composes the shipped thrown delivery
(`throw` / `throw-release` / `thrown`) with the existing ricochet configuration
(`ricochetHops`, `ricochetRange`, `bounces`). The weapon needs generated
single-subject card, sprite, and projectile art; sane thrown-weapon DPS; an
updated 343-durable / 334-active census and every pinned guard; and permanent
live-gate evidence that the projectile starts at the throw origin and bounces
to a second target.

## Plan

1. Inspect the thrown stars/kunai, ricochet pistol/roulette, catalog schemas,
   asset pipeline, census pins, and the prior live-gate/report conventions.
2. Generate one isolated chakram subject, remove its chroma-key background,
   and derive the three repository-native asset roles through the existing
   asset pipeline.
3. Add one iron chakram by composing only the existing thrown and ricochet
   fields, then regenerate outputs and update every census guard and portal.
4. Add and run a permanent private-port gate that proves throw-origin delivery
   and at least one bounce to a second target; retain logs/screenshots/results
   under `docs/owner-notes-audit-v8-evidence/chakram/`.
5. Run `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, focused tests,
   typecheck, full `pnpm test`, and an ephemeral server boot gate. Append exact
   results, assumptions, balance rationale, and the final verdict here.

## Assumptions

- Start with one base iron chakram, taking the census from 342 durable / 333
  active to 343 durable / 334 active.
- Reuse existing asset dimensions and preprocessing rather than introducing a
  new format or rendering path.
- Use only private ephemeral ports, never 5180 or 2567.

## Progress log

- Implementation started in isolated worktree `sol/chakram`.
- Traced the existing composition end to end. Expansion `behavior.kind:
  "thrown"` already maps `ricochetHops` and `ricochetRange` into the shared
  `thrown` block. `GameRoom.throwWeapon` carries those fields through both
  immediate and deferred `throw-release` launches, and
  `redirectThrownRicochet` performs the server-owned nearest-fresh-target
  redirect. No delivery or ricochet mechanic was added.
- Added `x2-iron-chakram` as a physical one-hand thrown weapon: 8 damage,
  0.40 s cadence, four charges, 1.5 s refill, 920 px/s, 700 px primary range,
  one direct pierce, two target ricochet hops, and 360 px hop acquisition.
  Direct raw DPS is 20.00, the floor of the shipped 20–30 star/kunai band.
  Its clustered ceiling is intentionally paid for by `pierce: 1`, finite
  charges, and the requirement that each additional target be available
  within the existing ricochet radius.
- Used Codex built-in image generation in one isolated subject context for
  the iron chakram only. The first render is a chroma-keyed orthographic
  identity; the second uses that identity as its sole reference for a
  portrait ricochet card. The installed imagegen helper removed the key, and
  the canonical slicer/harvester produced the 256×254 one-part runtime sprite
  used both in hand and as `thrown:x2-iron-chakram` projectile art. The card
  factory's existing Sharp contract produced the 600×840 JPEG. Raw, keyed,
  and alpha-cleaned sources are retained in
  `docs/owner-notes-audit-v8-evidence/chakram/`.
- Advanced authored census pins to 343 durable / 334 active / nine archived /
  305 active expansion / 24 thrown. Updated the resource boot guard, archive
  and brutalist census tests, server gallery census, Weaponsmith accessibility
  shell, and resource delivery census together.
- First required `pnpm gen` pass completed: 322 generated expansion weapons,
  141 ranged muzzles, 320 cards, and 334 portal weapons. The VFX-subject
  generator was rerun with reconstructed ignored identity-reference inputs so
  its tracked manifest preserves all 313 baseline entries and adds only the
  chakram entry; generated runtime outputs remain generator-owned.

## Art provenance

- Generation mode: Codex built-in image generation, one subject only (the iron
  chakram). No second weapon, character, pet, or prop was batched into either
  request.
- Sprite prompt specification: one broad battle-worn forged-steel throwing
  ring, large open center, eight shallow integrated outer teeth, four dark
  leather inner grips, cool grey faceted steel, restrained cel shading, thick
  readable outline, complete face-on orthographic weapon on a flat `#00ff00`
  key; explicitly not a star, saw, shield, gear, halo, or circular saw.
- Card prompt specification: use the generated iron-chakram identity as the
  sole reference, show that same ring caroming between two splintered training
  targets with one sharply bent silver trail, full-bleed portrait action art,
  no text, logo, frame, extra weapon, or character.
- Final runtime files are
  `packages/client/public/sprites/x2-iron-chakram/part-1.png` and
  `packages/client/public/cards/x2-iron-chakram.jpg`. The existing own-sprite
  thrown resolver also uses that one-part sprite as the projectile art. Raw,
  keyed, and alpha-cleaned generation artifacts remain beside the live proof.

## Permanent live proof

- Added
  `e2e/tests/v8-chakram-ricochet-live-gate.spec.ts`. It deep-links the real
  Testing Grounds on a private stack, aligns the live pointer/throw rig, selects
  a stationary pair inside the 360 px hop radius with enemy and POI lanes
  clear, sends one attack, and watches the one authoritative projectile from
  release through both HP changes.
- The first replay exposed an edge at the original draft's 660 px lifetime:
  the 50 ms projectile clock could retire before sampling a large target on the
  720 px Testing-Grounds summon ring. The final primary range is 700 px, which
  gives the existing point-sampled thrown collision a terminal in-range tick
  without changing damage, cadence, charges, ricochet range, or the 20.00
  direct-DPS budget. A second replay showed rendered interpolation is not a
  reliable direction oracle when a row retires quickly, so the permanent gate
  now measures the synced server velocity fields while retaining the rendered
  path as supporting evidence.
- Final retained run: accepted attack sequence `0 -> 1`; exactly one projectile
  (`p0`), kind `thrown:x2-iron-chakram`, source weapon
  `x2-iron-chakram`, and presentation anchor `throw`; release-hand error
  `0 px` and origin-metadata error `0 px` against `<= 0.25 px`; rendered travel
  `651.3464 px` against `>= 18 px`; direct target `e0` and fresh target `e6`
  both reduced from `440` to `436.463989`; one proven bounce over
  `287.4152 px` against `<= 360 px`; authoritative direction change
  `1.667663 rad` against `>= 0.35 rad`. The rendered path independently showed
  a `0.876732 rad` turn.
- After the hardened gate's normal green run, `--repeat-each=3 --workers=1`
  passed three consecutive fresh sessions on the private stack at port 63591.
  Ports 5180 and 2567 were never touched. The final JSON and screenshot are
  retained under `docs/owner-notes-audit-v8-evidence/chakram/`.

## Final validation

- `pnpm gen` passed from source and regenerated 322 expansion weapons, 141
  ranged muzzle rows, 320 card rows, and the 334-weapon portal.
- `pnpm gen:check` passed every available generated-output comparison.
  `subjects-vfx-300.json` reported the repository's existing availability skip
  for ten ignored reference artifacts; the available 314-subject output is
  stable and contains the chakram.
- `pnpm assets:check` passed: 423 sprite entries / 763 parts, 350 loose
  expansion parts, 413 atlas frames, 320 cards, 14 projectile URLs, and 96
  particle URLs.
- Focused catalog, art, resource, archive, portal, data-consistency, and model
  tests passed 398/398. The focused server ricochet/gallery checks passed 2/2.
  The permanent Playwright gate passed once normally and 3/3 under consecutive
  replay.
- Full `pnpm test` passed 136/136 files and 1779/1779 tests. Final
  `pnpm typecheck` passed shared, server, and client. The full integration suite
  and permanent gate both booted real servers on ephemeral private ports.
- `git diff --check` passed. Authored and generated text changes were audited
  as LF-only.

verdict — chakram shipped, ricochet proven, census updated, server boots, gate thresholds met.
