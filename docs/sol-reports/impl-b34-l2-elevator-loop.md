# B34 Lane 2 — Elevator Loop + Length Variants

## Initial implementation plan

### Deterministic length variants

Corporate floors have an authored playable band of `x=120..5040`, a 4,920 px span aligned to
the LDtk 60 px module grid. Runtime floor instances will preserve the authored left edge and use
three deterministic spans:

| Variant | Playable band | Span | Intended pacing |
| --- | --- | ---: | --- |
| short | `120..3120` | 3,000 px (61%) | compressed encounter |
| standard | `120..4080` | 3,960 px (80%) | baseline encounter |
| long | `120..5040` | 4,920 px (100%) | full hall with denser wave pressure |

The variant is selected by a shared seeded function of floor depth, not client randomness. The
runtime crop removes authored tiles, collision cells, lane guides, and wave anchors beyond the
chosen end. It repositions the right exit elevator, right EndWall, and camera maximum to that end,
then clamps or filters every spawn/wave anchor so all anchors remain inside the resulting band.
Long changes encounter density through the existing belt wave/tier machinery rather than by
inventing another difficulty system.

### Elevator transition state machine

The room owns the authoritative state and broadcasts enough state for every client to render the
same transition:

1. `sealed`: all three doors are closed; left and middle are dormant; the right exit is inert.
2. `ready`: the shipped belt room-clear requirement is satisfied, the right door gains its lit /
   slightly-open affordance, and the normal `E` interact hint becomes available.
3. `countdown`: the first valid server interaction starts one shared three-second party countdown;
   re-entry cannot create a second transition.
4. `departing`: the exit doors open, elevator SFX plays, and clients fade to black; the server
   teleports stragglers into the car so nobody remains on the old floor.
5. `loading`: floor depth increments, the next material in
   `Red_Carpet -> Portrait_Hall -> Marble -> Red_Carpet` and its deterministic length variant are
   installed, while run money/chests/relic state remains untouched.
6. `arriving`: every player is placed at the new floor's left elevator, the fade lifts, and that
   arrival door closes behind the party.
7. `sealed`: combat resumes on the new floor with the HUD floor chip showing the incremented
   depth.

### Door tile and animation plan

The three authored `ElevatorMarker` positions remain the placement source. Each placeholder marker
will be replaced by a real closed-door composition made from the corporate tileset's elevator /
door-family tiles. Left and middle doors always render the closed frame. The right door uses the
same frame plus two leaf sprites: closed in `sealed`, offset slightly with a lit header in `ready`,
and slid apart in `departing`. On the next floor the left composition briefly renders open, then
slides shut for the arrival read. Tile atlas inspection will lock the exact door tile IDs before
runtime wiring; if the atlas has only a closed authored face, the second frame will be produced by
sliding the two door halves rather than adding new art.

SFX selection will first search shipped elevator/ding/door-slide families. New Soundkit clips are
only permitted if neither family exists, with an absolute maximum of two generated clips.

## Stage log

- Created this report before implementation changes, defining the module-aligned spans, shared
  room transition phases, party/straggler behavior, and tileset-native door animation approach.
- Implemented the shared endless-floor constructor and deterministic variant selector. Runtime
  crops now transform tiles, collision, lane data, player/enemy anchors, right EndWall, right exit,
  and camera bounds as one module-aligned geometry operation. Floor 1/2/3 intentionally resolve to
  standard/short/long for gate coverage.
- Replaced the corporate belt's boss ending with depth-scaled required room waves. Short,
  standard, and long floors emit two, three, and four waves respectively; later floors increase
  those wave counts through the existing depth value while the shipped elapsed-time/tier sampling
  continues to own tough-enemy pressure. Existing depth-biased wave anchors now reach a bilateral
  50/50 split by the deeper floors.
- Added schema v40's append-only corporate floor/elevator fields and the authoritative room
  transition. Only the final right door accepts interaction, its three-second countdown is shared,
  every party member is fixed inside the departing car, and the next-floor placement hard-resyncs
  all players at the left arrival door. Run clock, HP, weapon/relic rows, scrip, money, and chests
  remain run-scoped across the floor boundary.
- Added atlas-native two-leaf elevator doors at all three markers, rectangular ready/countdown
  lighting, the existing `E` affordance on only the right exit, fade-out/fade-in transition,
  arrival close, and an `F<depth>` HUD chip. Shipped UI dock tick/open/close samples supply the ding
  and slides, so no generated audio was needed.
- Added unit coverage for infinite material order, variant determinism, complete crop geometry,
  depth pressure/bilateral anchors, final-wave arming, and co-op straggler transition. The focused
  shared plus full GameRoom gate passes 312 tests.
- Closed the B20 continuity audit by letting only corporate belts use the shipped deterministic
  chest cadence, placing those chests on safe authored floor anchors. Legacy belts remain
  unchanged. Unit coverage now also retains and reclamps unopened chests and armed money rows
  while preserving scrip and relic state through the floor transition.
- Extended `orchestrator-b34-visual-probe.spec.ts` with an authoritative floor-clear/transition
  capture on a per-test stack. The final live gate passed on private ephemeral client/game ports
  `49655/49654` with `proto-cowboy-hidden-face`, proving F1 red/standard ready, the party
  transition, F2 portrait/short arrival, the left arrival door, and the `F1` to `F2` HUD update.
- Final verification is green: `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`,
  `pnpm assets:check`, and full `pnpm test` (`188` files / `2,329` tests). Schema remains an
  append-only bump from 39 to 40 and every exact pin was migrated. `git diff --check` is clean.

Verdict: loop live; 3 length variants; doors animated; co-op transition; depth escalation; floor counter; evidence path `docs/owner-notes-audit-v11-evidence/b34-l2-elevator-loop/`; files touched: shared corporate/belt/schema, server room/tests, client scene/audio, orchestrator probe, evidence, and this report.
