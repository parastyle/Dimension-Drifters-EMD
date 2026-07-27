# B88 L11 — seen hits

## Mechanism

I chose the direct L10-compatible mechanism: the client adds the body it is already presenting
(`px`, `py`) to the existing 20 Hz `input` command. It samples `selfPresentedWorldX/Y` before the
next predictor step, so hit-stop, correction presentation, and ordinary local lead report the body
that was actually on screen rather than an unpublished simulation result. There is no second
channel and no server rewind/history.

The server stores one presented-self body per player. Every positional incoming-damage resolver
asks `presentedPlayerPosition()` for that body; it never substitutes the trailing authoritative
movement body after presentation reporting has begun. Before the first input command, the
synchronized spawn body is the only possible drawn body and is the fallback.

Malformed, half-present, missing-on-a-fresh-command, or out-of-envelope reports make the defensive
body non-hittable. Server-authored placements invalidate an already-reported body until the client
reports the newly drawn position. These cases deliberately choose the allowed error direction:
the client may show a hit the server declines, but uncertainty cannot manufacture a hit the client
did not see.

This changes SELF DEFENCE only. Enemy AI, movement, rewards, state, and player attacks against
enemies remain server-authoritative. The outgoing `detonate()` pipeline was not changed.

## B42 robustness clamp

The shared B42 continuity radius is now a named helper used by both movement adoption and presented
defence:

`R = (maxMoveSpeed + maxImpulseSpeed) × dt + authored displacement + newest-wins catch-up + 3 px`

For presented defence, authored displacement is zero; movement speed is the applicable relic walk,
distance-jump, or current roll speed; impulse is the current authored impulse; and catch-up is the
same `maxMoveSpeed × dt × (INPUT_MSGS_PER_TICK - 1)` allowance as B42. At ordinary 320 px/s walking,
20 Hz, and the four-message newest-wins budget, `R = 16 + 48 + 3 = 67 px`, which admits the measured
49 px `AUTH LEAD`.

A finite report outside `R` is projected radially onto the envelope edge for bounded
storage/diagnostics, but that projected point is marked non-hittable. This is robustness for a
broken/desynchronized client, not anti-cheat and not permission to hit at an invented projection.
Non-finite reports are also non-hittable. I did not reuse B42's navigation-adoption gate for
defence: the drawn body must be allowed to report a real pit/hazard position, and defensive truth
cannot move the authoritative player or gain rewards.

## Complete incoming-path census

The 15 incoming positional paths/interactions are:

1. Ordinary enemy contact/melee overlap in the contact phase uses the presented body for radius,
   belt depth gating, and knockback direction.
2. Ordinary committed enemy melee (`duelistSwing`) retains its frozen target identity and four-tick
   commitment, but resolves reach against that target's presented body.
3. Tough-enemy committed combo melee (`comboSwing`) does the same for every authored combo beat,
   including launch/air-keep strings.
4. Hostile enemy projectiles use the presented body for projectile overlap before parry, roll
   null-whiff, damage, or knockback.
5. Circular boss detonation/AoE (`applyBossAoE`) uses the presented body for radius and knockback.
6. Ground boss quake (`applyBossQuake`) uses the presented body before height, parry, pit grace, and
   knockback handling.
7. Vastaghar's epoch-gated quake uses the presented body before its airborne/parry/hit accounting.
8. Vastaghar's swept annular attack uses the presented body for arc membership and impulse.
9. Boss beam/dash oriented rectangles use the presented body for rectangle membership and shove
   side.
10. Boss ring-band/gap mechanics use the presented body for annulus membership.
11. Boss melee arcs (`applyBossMelee`) use the presented body for arc membership, parry reaction,
    damage, and knockback. Serraketh/worm melee emissions route through this seam.
12. Hostile zoner puddles/ground zones use the presented body for their per-tick radius test.
13. Top-down pit/hazard sampling uses the presented body for foot contact, last safe ground, and
    nearest-ground recovery.
14. Belt pit sampling uses the presented body's X for gap contact, last safe ground, and snapback
    choice.
15. Dimension Door's ultimate decoy remains a separate server-authored taunt body: enemy contact
    damages the decoy, its detonation damages enemies through the unchanged outgoing pipeline, and
    it never aliases the player damage body. Door teleport/return placement invalidates the old
    presented player body until the next client report.

Worm audit: there is no production caller of `acceptWormContact`; the worm controller's actual
incoming player mechanics emit through the quake, melee, projectile, rectangle, and ring seams
listed above. Player-owned explosions, fissures, decoy detonations, and all other `detonate()` calls
are outgoing enemy damage and were intentionally untouched.

The shared `damagePlayer()` primitive still owns health, death, and mitigation after a spatial path
has admitted a hit. Parry windows, dodge-roll i-frames, slide null-whiffs, airborne quake evasion,
juggle mercy, and pit grace remain in their original order after the presented-body overlap and
were not weakened.

## Wire and schema

`SCHEMA_VERSION` is bumped from 50 to 51 and every pinned fixture was updated. Representative
Colyseus MessagePack measurement of the real input object was 269 bytes before and 293 bytes with
two finite floating-point fields: **+24 bytes per command, +480 bytes/second per player at 20 Hz**.
Transport framing is unchanged.

## Measurement and verification

`tools/diag-l11-phantom-hits.mts` replays a 21-command, 320 px/s walk past a stationary enemy using
the shipped 24 + 18 = 42 px contact reach and a conservative 49 px `AUTH LEAD` sample. Replaying the
pre-L11 stale-server predicate produces 3 phantom samples out of 21 (14.29%); the presented-body
predicate produces 0/21 (0.00%).

The real-room regression places the stale server body 41 px from an 18 px enemy, places the
presented body another 49 px ahead, and proves HP does not change. It would hit under the old
server-position predicate. Shared tests also pin exact in-envelope retention, radial projection,
and malformed-report rejection.

- `pnpm gen:check`: PASS
- `pnpm typecheck`: PASS
- Rubber-band telemetry: PASS, 131 scenarios (65 top-down, 66 belt); both modes recorded 0
  correction requests, 0 applications, 0 snaps, and 0 total pixels.
- Full `pnpm test`, consecutive run 1: PASS — 247 files, 2,953 passed, 20 intentionally skipped.
- Full `pnpm test`, consecutive run 2: PASS — 247 files, 2,953 passed, 20 intentionally skipped.

VERDICT: mechanism=presented self on existing 20 Hz input; paths covered=15; schema bump=yes (50→51); wire cost=+24 B/command, +480 B/s; phantom hits=3/21 (14.29%)→0/21 (0.00%); telemetry=top-down+belt 0 requests/0 applications/0 snaps/0 px; 2x test results=PASS 2953/2953, PASS 2953/2953.
