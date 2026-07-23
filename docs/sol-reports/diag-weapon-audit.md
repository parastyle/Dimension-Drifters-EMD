# Weapon Attack Lifecycle Audit

## Reading map

- `packages/server/src/rooms/GameRoom.ts`
  - attack-message admission and gating
  - `resolveSwing`
  - `stepPendingWeaponLunges`
  - `pendingWeaponLunges` creation, commit, resolution, cancellation, and cleanup
  - effective cooldown, melee durability wear/regeneration, thrown charges/refill
- `packages/shared/src/weapons.ts`
  - weapon definitions and runtime/per-swing state
  - `suppressSwing`, `collisionLength`, combo progression, thrown charge settings
- Merge-wave history
  - B1: `09d7eaa`
  - B4: `b930931` / merge `fa6deb7`
  - B5: `fc702b2`, `179c721`
  - B7: `c4c6066`
  - B8: `5c8173d` (and its merged payload `7ce659b`)
  - B9: `8116f00`
  - B10: `a87f465`
  - restricted comparison of `GameRoom.ts`, `weapons.ts`, and `hit-envelope.ts`, followed by the
    client call site implicated by the server trace
- Output
  - repeated attack accept → resolve → clear trace
  - ranked hypotheses with exact file:line, mechanism, offending commit, and minimal fix

## Executive finding

The catalog-wide stop is not a `pendingWeaponLunges`, cooldown, durability, thrown-charge, combo, or
collision-length leak. It is an unbounded client prediction-ack wait introduced by B4 commit
`b9309311dc0240cbd465060c95bf350505103e5d` and merged by `fa6deb7`.

At `packages/client/src/scenes/ArenaScene.ts:10228-10236`, B4 added a gate that returns from every future
`sendAttack()` while `localPredictedAttackSeq` is ahead of the authoritative `self.attackSeq`. The client
increments that predicted sequence before sending at `ArenaScene.ts:10257-10259`, while the server increments
the authoritative sequence only after resource acceptance at
`packages/server/src/rooms/GameRoom.ts:5994-5998` and `GameRoom.ts:7157-7161`. Therefore one ordinary server
rejection leaves the client exactly one beat ahead forever.

Drive exhaustion supplies the deterministic “after a few attacks” rejection. The server rejects a tap when
live Drive is below the computed debit at `GameRoom.ts:4692-4696`, but the client affordability precheck covers
only thrown, gun, and warp weapons at `ArenaScene.ts:10239-10244`. Melee and cast weapons predict and send an
unaffordable beat. The server consumes their one-shot `attackBuffer` before spending
(`GameRoom.ts:5948-5966` for casts; `GameRoom.ts:5972-5998` for melee), does not stamp `attackSeq`, and the B4
client gate then prevents all retries even after Drive regenerates.

The failed-reset mechanism is:

1. After `N` accepted attacks, the next tap has `available Drive < weapon cost`. `N` is weapon/cadence
   dependent; the static full-bar approximation is `floor(100 / neutralCost)` at
   `packages/shared/src/weapon-resource.ts:262-270`, with the live 100-point capacity and regen defined at
   `packages/shared/src/constants.ts:87-96`.
2. The client sets `localPredictedAttackSeq = self.attackSeq + 1` at
   `ArenaScene.ts:10257-10259` and sends the request at `ArenaScene.ts:10571`.
3. The server zeroes `c.attackBuffer`, rejects at `GameRoom.ts:4692-4696`, and never calls
   `stampAttackBeat`, so `self.attackSeq` remains unchanged.
4. `predictionLead` remains `1`; `ArenaScene.ts:10232-10236` returns on every frame. No new attack request can
   reach the server, so the authoritative sequence can never close the gap. The normal routing path also
   cannot heal it because unchanged `(seq, held)` returns at `ArenaScene.ts:3455-3462`.

This exactly explains “most weapons”: beam/channel/aura use separate held-input paths, warp bypasses the
prediction-lead gate, and thrown/gun/warp have the client Drive precheck. Ordinary melee and cast weapons—the
broad remainder of `sendAttack()`—have neither protection.

## Server accept → resolve → clear trace

### Admission and cooldown

1. An `"attack"` message only writes aim/target and raises `c.attackBuffer` at
   `packages/server/src/rooms/GameRoom.ts:1514-1564` (pre-wave code; the buffer extension is commit
   `b17c168a`). It does not create a swing or lunge.
2. Every fixed step decrements `c.cd`, `c.drawLock`, `c.handGate`, and `c.attackBuffer` at
   `GameRoom.ts:5718-5739`. The solo admission predicate at `GameRoom.ts:5865-5866` checks acting state,
   slide state, the buffer, cooldown, and draw lock. It does **not** read `meleeSwings` or
   `pendingWeaponLunges`.
3. Every delivery clears the one-shot buffer before calling `trySpendWeaponResource`:
   `GameRoom.ts:5870-5892` (warp), `5894-5919` (gun), `5921-5944` (thrown), `5946-5969` (cast), and
   `5972-5998` (melee). `trySpendWeaponResource` returns false when Drive is short at
   `GameRoom.ts:4692-4696` (resource implementation commit `002502f6`).
4. Only an accepted spend calls `stampAttackBeat` and creates the delivery. For melee, the accepted sequence
   is `GameRoom.ts:5994-5998`; `stampAttackBeat` increments the wire epoch at `GameRoom.ts:7157-7161`.
   Cooldown is set only on acceptance and is decremented on every later step, so there is no server cooldown
   value that can remain permanently armed.

The server-side buffer consumption is an amplifier, not the regression by itself: a new client message would
raise the buffer again. B4 makes that new message impossible after the first unacknowledged prediction.

### `resolveSwing` and lunge lifecycle

- `resolveSwing` replaces the per-player/per-hand melee descriptor at
  `packages/server/src/rooms/GameRoom.ts:7441-7467`. Replacement prevents an old swing-commit row from
  accumulating; the map is not an admission lock.
- An authored lunge similarly replaces the player's lunge row at `GameRoom.ts:7469-7480`; forward drift uses
  the same replacement key at `GameRoom.ts:7481-7493`.
- The only destination-bound swing sets `waitForWeaponLunge` at `GameRoom.ts:7448-7466`. Collision pauses at
  `GameRoom.ts:8822-8839`, not attack admission.
- `stepPendingWeaponLunges` removes invalid/dead/weapon-changed rows at `GameRoom.ts:7894-7902`, initializes
  the collision-clamped segment at `7904-7929`, advances it at `7931-7943`, releases the destination impact,
  and deletes the row at `7944-7947`.
- Release clears the swing wait, pins the destination origin, and consumes its quake at
  `GameRoom.ts:7850-7889`. Cancellation deletes a waiting destination swing at `GameRoom.ts:7843-7847`.
- Non-destination melee descriptors delete themselves at active end in
  `GameRoom.ts:8835-8840` and the later active-path end checks; a subsequent accepted swing would replace the
  row even before that cleanup.
- Run/terminal cleanup clears both `meleeSwings` and `pendingWeaponLunges` at
  `GameRoom.ts:2350-2375`.

B5 commit `179c721` added `impactAtDestination`, wait/release/cancel handling, and the destination quake. Its
only current `impactAtDestination: true` authoring is Thunderhead at
`packages/shared/src/weapons-expansion.generated.ts:14488-14493`; the two current lunge durations are finite
and positive (`weapons-expansion.generated.ts:4064-4067` and `14488-14493`). Thus B5 can at most produce a
Thunderhead-specific deferred-impact defect, not “most weapons,” and no lunge row gates later attacks.

### Effective cooldown, durability, and thrown resources

- The effective accepted interval is a pure clock calculation at
  `packages/shared/src/combat.ts:89-101`; the live cooldown drains at `GameRoom.ts:5718-5724`. Neither retains
  a swing-commit bit.
- Drive credit is recomputed every tick at `GameRoom.ts:4593-4625` and committed at
  `GameRoom.ts:4628-4641`; even a depleted server resource recovers. The permanent failure is the client no
  longer asking after recovery.
- `WeaponDef.durability` is explicitly display scaffolding: “depletion/break/repair MECHANIC is not built
  yet” at `packages/shared/src/weapons.ts:789-793`. `GameRoom.ts` contains no durability read or write, so
  durability cannot reach zero or fail to regenerate.
- Legacy reload/charge schema is deliberately tombstoned at `GameRoom.ts:824-825`.
  Save/restore/stepping writes charge and reload fields to zero at `GameRoom.ts:2989-3052` and
  `GameRoom.ts:3101-3105`.
- A thrown attack spends Drive and then calls `throwWeapon` at `GameRoom.ts:5921-5944`;
  `throwWeapon` reads speed/range/damage/pierce but never `charges` or `refillSeconds` at
  `GameRoom.ts:10991-11075`. `charges` only influences the derived Drive price at
  `packages/shared/src/weapon-resource.ts:241-246`; `refillSeconds` is not a live server clock.

Therefore B7 charges cannot become stuck. B7 commit `c4c6066` changed generated data for two weapons but made
no change to `GameRoom.ts`, `weapons.ts`, or `hit-envelope.ts`; its authored charges are translated into
Drive cost by the pre-existing schema-30 resource code.

## Shared state audit

- `WEAPONS` is assembled as definition data at `packages/shared/src/weapons.ts:2260-2263`; it contains no
  per-run or per-swing mutable state.
- `performance.suppressSwing` is a presentation/combo-classification flag at `weapons.ts:377-382`. Its shared
  mechanical consumer is `isMonkGloveWeapon` at `packages/shared/src/melee.ts:1923-1934`; `GameRoom.ts` never
  uses it as attack admission. B8 can change pose vocabulary, not arm a permanent server gate.
- Combo progression is computed from accepted sequence snapshots at
  `GameRoom.ts:7164-7209` and recorded only after acceptance at `GameRoom.ts:7212-7228`. It selects a step;
  it never rejects a swing. The given B8 reconciliation commit `5c8173d` has no diff in
  `GameRoom.ts`, `weapons.ts`, or `hit-envelope.ts`; the merged payload `7ce659b` changes pose/combo
  authoring, not the admission/resource seam.
- `collisionLength` is a static optional fallback at `weapons.ts:1101-1106`, consumed by melee reach at
  `weapons.ts:1108-1124` and blade-extension geometry at
  `packages/shared/src/hit-envelope.ts:222-244`. B9 commit `8116f00` preserves old collision sizes while
  enlarging four presentation sizes. It may make one of those weapons feel shorter than its enlarged art,
  but it cannot change after attack `N` or stop future attack messages.
- B10 commit `a87f465` removes the Sanctified Headsman extension override at
  `hit-envelope.ts:60-100` and removes one VFX recipe union member around `weapons.ts:241-270`. That is a
  one-weapon static reach/VFX change, not a temporal gate.

## Restricted merge-wave diff cross-check

| Batch | Commit | Relevant result |
|---|---|---|
| B5 | `fc702b2` / `179c721` | The merge commit has no combined diff in the three requested files; `179c721` adds destination-lunge state and cleanup in `GameRoom.ts:7448-7493`, `7843-7947`, plus the `impactAtDestination` type at `weapons.ts:416-423`. It does not touch admission. |
| B7 | `c4c6066` | No diff in `GameRoom.ts`, `weapons.ts`, or `hit-envelope.ts`; two generated definitions become thrown. |
| B8 | `5c8173d` | No diff in the three requested files. The earlier merged payload `7ce659b` changes pose/grip/combo data, not resource admission. |
| B9 | `8116f00` | Adds `collisionLength` and routes reach/muzzle/envelope geometry through it (`weapons.ts:510`, `1013-1017`, `1101-1124`; `hit-envelope.ts:222-244`). Static geometry only. |
| B10 | `a87f465` | Removes one Headsman blade extension/VFX identity (`hit-envelope.ts:60-100`, `weapons.ts:241-270`). Static, one weapon. |
| B4 (discovered root) | `b930931`, merged by `fa6deb7` | Adds the unconditional positive prediction-lead return at `ArenaScene.ts:10228-10236`, outside the requested three-file diff set. This is the only merge-wave change that creates a catalog-wide state which cannot self-clear after a server rejection. |

B1 commit `09d7eaa` is confined to projectile/damage-number facing code and does not touch attack admission,
resource spending, swing state, or the three requested files.

## Ranked root-cause hypotheses

### 1. B4 client prediction high-water deadlock — confirmed, overwhelmingly most likely

- **File/line:** `packages/client/src/scenes/ArenaScene.ts:10228-10236`, with the predicted increment at
  `10257-10259`; server rejection at `packages/server/src/rooms/GameRoom.ts:4692-4696`; authoritative stamp
  only at `GameRoom.ts:7157-7161`.
- **Offending commit:** `b9309311dc0240cbd465060c95bf350505103e5d` (B4), merged by `fa6deb7`.
- **Mechanism:** after the first rejected predicted attack, `localPredictedAttackSeq` stays exactly one ahead
  of `self.attackSeq`; `predictionLead > 0` returns forever, so no subsequent `"attack"` RPC can advance the
  authoritative sequence.
- **Why after a few:** Drive eventually makes a tap unaffordable; melee/cast lack the precheck at
  `ArenaScene.ts:10239-10244`.
- **Minimal fix:** replace the unbounded `predictionLead > 0` return with a bounded acknowledgement wait that
  rolls `localPredictedAttackSeq` back to `self.attackSeq` and retries when no authoritative edge arrives.
  The smallest emergency rollback is to remove the B4 positive-lead `return` (restoring pre-`b930931`
  behavior). Also apply the Drive affordability precheck to every discrete weapon before prediction so the
  expected low-Drive rejection normally never opens the gap.

### 2. B5 destination-lunge wait orphan — possible only as a narrow defensive hazard, not this bug

- **File/line:** `GameRoom.ts:7448-7466`, `7843-7947`, and `8822-8839`.
- **Offending commit if triggered:** `179c721`.
- **Mechanism required:** a destination lunge would need a non-finite/non-positive duration or lost map row
  so `waitForWeaponLunge` never releases. Current Thunderhead authoring is positive
  (`weapons-expansion.generated.ts:14488-14493`), cancellation removes the waiting swing, and a later
  accepted swing replaces both rows.
- **Scope:** one destination-impact weapon, and only collision would wait; `canAct` still accepts later
  attacks.
- **Minimal defensive fix:** validate/clamp authored lunge duration to at least one fixed step and cancel any
  waiting swing whose lunge row is absent. This is hardening, not the regression fix.

### 3. B9/B10 collision-envelope shrink — static whiff candidate, not a stop-after-N mechanism

- **File/line:** `weapons.ts:1101-1124`, `hit-envelope.ts:222-244`, and
  `hit-envelope.ts:60-100`.
- **Commits:** `8116f00` (B9), `a87f465` (B10).
- **Mechanism:** preserved pre-resize collision lengths can make enlarged presentation art overstate reach,
  and B10 removes one Headsman extension. Neither value mutates per attack; inputs, cooldowns, and
  `attackSeq` continue.
- **Minimal fix if independently observed:** correct the affected weapon's static collision/envelope datum,
  not lifecycle reset code.

VERDICT: The single most-likely root cause is the unbounded `localPredictedAttackSeq` gate at `packages/client/src/scenes/ArenaScene.ts:10228-10236`, introduced by B4 commit `b930931` (merged as `fa6deb7`); replace the unconditional positive-lead return with a bounded ack timeout that rolls the predicted sequence back to `self.attackSeq` and retries (and precheck Drive for all discrete weapons) — confidence: 98%.
