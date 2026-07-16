# Level-up UI parity — devil's advocate

## Verdict

Do **not** put a Hades-sized decision inside a co-op countdown. Import Hades' confidence, Brotato's numerical honesty, and Risk of Rain's hierarchy—not their entire decision economies. Parity here means that a player can recognize the choice, understand its immediate consequence, and commit in roughly two to four seconds while the room remains live. Ten seconds is an accessibility and network ceiling, not permission to write ten seconds of copy.

The current rule is actually a server-authoritative **five-second phase**, not one ten-second pause (`packages/shared/src/leveling.ts:17-20`). FLEX is shown before a pending signature choice, and selecting FLEX refreshes the timer if another pick remains; that can make a milestone level occupy two consecutive five-second phases (`packages/client/src/scenes/ArenaScene.ts:4431-4450`; `packages/server/src/rooms/progression.ts:26-30`). If the original timer expires with both kinds pending, the server resolves one of each in the same timeout pass rather than granting ten guaranteed reading seconds (`packages/server/src/rooms/GameRoom.ts:2494-2506`). Adding prose to consume a hypothetical ten-second budget would therefore be designed against behavior the game does not guarantee.

My accepted scope is a fast, honest, dependency-aware picker with strong visual hierarchy, exact outcome deltas, direct controls, explicit timeout behavior, and co-op awareness. My rejected scope is rarity theater, hover encyclopedias, reroll/banish/skip currencies, and any visual or simulation slow-motion.

## What exists—and what it implies

- This is not a pause. Window membership is per player and is true while either a FLEX or signature pick is owed; the server zeros that player's movement and excludes them from acting (`packages/server/src/rooms/GameRoom.ts:1620-1624`; `packages/server/src/rooms/GameRoom.ts:1711-1724`; `packages/server/src/rooms/GameRoom.ts:1904-1916`). Shared XP is applied across the roster, so several players can enter together, but the mechanism remains a set of personal gates rather than a room pause (`packages/server/src/rooms/GameRoom.ts:2465-2469`).
- The chooser is immune to contact, hostile projectiles, and zones (`packages/server/src/rooms/GameRoom.ts:2133-2139`; `packages/server/src/rooms/GameRoom.ts:3794-3805`; `packages/server/src/rooms/GameRoom.ts:3979-3987`). However, enemy targeting consumes a `bodies` list containing every living player, with no level-window filter, and enemy AI selects from that list (`packages/server/src/rooms/GameRoom.ts:1756-1763`; `packages/server/src/rooms/GameRoom.ts:2014-2026`). Inference: a frozen chooser can remain an invulnerable aggro/body-collision influence while a teammate fights. The UI must not disguise this as stopped time.
- The client covers the whole screen with an interactive 66%-opaque dim and a framed paper panel, then shows only a thin 380-by-6 countdown bar (`packages/client/src/scenes/ArenaScene.ts:4481-4501`; `packages/client/src/scenes/ArenaScene.ts:4516-4525`). The bar reads integer deciseconds from authoritative state (`packages/client/src/scenes/ArenaScene.ts:4452-4458`; `packages/shared/src/state.ts:134-135`), and the server deliberately ceils and patches that mirror at 10 Hz (`packages/server/src/rooms/GameRoom.ts:1626-1630`). The clock is honest; its presentation is too quiet.
- The folio opening is a 320 ms UI-only flourish with a reduced-motion bypass, while its comment explicitly keeps title, countdown, choice copy, and hit geometry face-on (`packages/client/src/scenes/ArenaScene.ts:4394-4428`). That is a good identity layer. But the F/S offer key destroys and rebuilds the shell for the follow-up phase, so the second choice can replay the opening (`packages/client/src/scenes/ArenaScene.ts:4431-4450`; `packages/client/src/scenes/ArenaScene.ts:4539-4552`).
- The P0 input repair is correct and must survive redesign: each choice gets a scene-level, fixed-screen rectangle above the card instead of relying on a hit object inside the transformed container (`packages/client/src/scenes/ArenaScene.ts:4675-4691`; `packages/client/src/scenes/ArenaScene.ts:4749-4763`). Selection is latched on `pointerdown`, competing hit rectangles are disabled, and the server remains the authority that actually closes or advances the offer (`packages/client/src/scenes/ArenaScene.ts:4605-4614`; `packages/server/src/rooms/GameRoom.ts:981-1007`).
- Attribute cards currently show the raw attribute changing by one plus a generic effect phrase, not the resulting combat delta (`packages/client/src/scenes/ArenaScene.ts:4462-4472`; `packages/client/src/scenes/ArenaScene.ts:4726-4744`). Worse, the shell says `+1 STR +1 CON (auto)` even though progression allocates character-specific class and requirement attributes (`packages/client/src/scenes/ArenaScene.ts:4695-4701`; `packages/server/src/rooms/progression.ts:33-50`). That visible promise can already be false.
- Augment cards show icon, name, flavor tag, and description, and their border color is derived from the flavor tag (`packages/client/src/scenes/ArenaScene.ts:4474-4479`; `packages/client/src/scenes/ArenaScene.ts:4618-4669`). `AugmentDef` has tag, description, icon, stacking, and optional weapon delivery—but no rarity (`packages/shared/src/augments.ts:13-30`). A Hades-like “rarity glow” today would communicate power data that does not exist.
- The signature subtitle promises a “parry augment,” while the authoritative draft may add gun- or cast-specific choices based on the wielded weapon (`packages/client/src/scenes/ArenaScene.ts:4618-4624`; `packages/server/src/rooms/GameRoom.ts:2477-2483`). This is a clarity defect, not a missing flourish.
- Offer quality has two upstream holes that reroll would merely conceal. The registry marks augments as stackable or not, but `draftAugments` receives no owned set and filters only by weapon delivery; the server then appends any offered selection (`packages/shared/src/augments.ts:15-29`; `packages/shared/src/augments.ts:224-240`; `packages/server/src/rooms/GameRoom.ts:993-1003`). Inference: an already-owned non-stackable augment can return as a functionally wasted duplicate. Conflagration is also executed only inside the Emberguard branch, although offers have no prerequisite filter (`packages/shared/src/augments.ts:93-115`; `packages/server/src/rooms/GameRoom.ts:3361-3383`).

## Attack 1: “Give it Hades depth”

### Steelman

Hades is the right reference for emotional legibility. A pick has a dominant name, a strong family color, an immediately visible quality signal, concise mechanical copy, and enough context to feel authored rather than generated. That confidence is worth copying. The level-up should feel like a reward, and the paper folio is a distinctive foundation for it.

### Attack

Hades earns depth with stopped time. Dimension Drifters does not. A player reading conditionals is not merely delaying their own DPS; they are consuming teammate protection and returning into a world that continued to position enemies. The current full-screen dim compounds that problem by taking away situational information while the server continues combat (`packages/client/src/scenes/ArenaScene.ts:4481-4501`; `packages/server/src/rooms/GameRoom.ts:2014-2026`).

More detail also magnifies existing misinformation. A beautiful `STR +1` card is still weak if it hides the actual damage change. A glowing “parry” card is actively wrong when it modifies bullets. A premium Conflagration card is a trap when Emberguard is absent. The first parity pass must repair truth and decision speed before spectacle.

### Verdict

**Reject Hades information density; accept Hades information hierarchy.** Every card gets exactly three decision layers, all visible without hover:

1. **Identity:** icon, short name, honest category—not fictional rarity.
2. **Immediate consequence:** one primary before→after result computed from shared simulation functions. The shared model already exposes crit and CON derivation, and weapon damage has a shared multiplier path (`packages/shared/src/leveling.ts:43-59`; `packages/shared/src/leveling.ts:62-79`; `packages/shared/src/weapons.ts:359`).
3. **Context:** at most one compact badge such as `OWNED ×2`, `NEW`, `CURRENT WEAPON`, `REQUIRES EMBERGUARD`, or `COMBOS: BRAND`.

No lore paragraph, nested tooltip, hover comparison, or second page belongs in the live pick. Deeper explanation belongs in an out-of-combat codex/build screen.

## Attack 2: “Genre parity means reroll, skip, and banish”

### Steelman

These tools can reduce helpless drafts, let players protect an emerging build, and turn random offers into strategic authorship. They are familiar genre language, and a single reroll can rescue a run from three irrelevant choices.

### Attack

They are not three buttons; they are a meta-economy.

- **Reroll** requires a charge source, price curve, offer-history rule, duplicate rule, deterministic timeout behavior, and a server message/state transition. The current protocol only accepts an attribute or an augment already present in the authoritative offer (`packages/server/src/rooms/GameRoom.ts:981-1007`).
- **Banish** requires persistent exclusion scope—this pick, this run, this character, or the account—plus pool-size floors, weapon-swap semantics, and UI for remaining exclusions. That complexity is especially hostile under a live timer.
- **Skip** is not neutral. FLEX is an owed point and the window stays open while anything remains owed; timeout deliberately converts the owed choices into defaults so the reward is not lost (`packages/server/src/rooms/progression.ts:26-30`; `packages/server/src/rooms/GameRoom.ts:2472-2506`). “Skip” therefore needs a new rule for forfeiting, banking, or auto-allocating value.

Most importantly, a reroll is the wrong remedy for dead offers caused by eligibility bugs. Filter already-owned non-stackables, encode real prerequisites, and show synergies first. Only then can telemetry tell us whether randomness still needs relief.

### Verdict

**Reject reroll, banish, and skip for parity scope.** Keep one decision and one commit. Revisit a single free reroll only if post-fix telemetry shows a meaningful rate of three-choice drafts with no build-relevant option. If it returns later, it must be server-authoritative, have no escalating shop economy, and never pause or reset the countdown invisibly.

## Attack 3: “Use slow-motion so players can read”

### Steelman

Slow-motion is an effective solo-game spotlight. It can turn a system interrupt into a reward beat, lower visual noise, and let the player appreciate premium motion and effects.

### Attack

Local visual slow-motion lies: authoritative enemies, projectiles, hazards, and teammates continue at simulation speed, so slowed world presentation makes visible positions and impact timing diverge from what hits. That violates the project's WYSIWYG doctrine in the most dangerous possible moment; the game-feel audit already treats visible-versus-authoritative position drift as a hit-truth failure (`docs/GAMEFEEL_AUDIT.md:93-96`). Room-wide slow-motion is worse: one player's menu changes everyone else's controls and attack cadence, and simultaneous/asynchronous level-ups have no fair owner of the time scale.

### Verdict

**No world, camera, animation-clock, projectile, particle, or simulation slow-motion.** UI easing is allowed because it depicts only the folio. Audio ducking, a restrained vignette, and procedural emphasis on the selected card are allowed if the combat mix and world timing remain intelligible. The countdown must continue visibly at its true rate.

## Accepted parity scope

Ship this definition of parity:

- **Correct the contract first.** Derive the auto-allocation subtitle from the character class; label gun/cast offers correctly; prevent owned non-stackables from reappearing; encode hard prerequisites such as Emberguard→Conflagration. These are truth fixes.
- **Make the timeout explicit.** Add a large whole-second number beside the authoritative bar, change urgency at three seconds, and print `AUTO: <outcome>` on the phase. The server currently defaults FLEX to the class attribute and signature to the first offered augment (`packages/server/src/rooms/GameRoom.ts:2494-2506`); the player should see that consequence before it happens.
- **Show phase and burden.** On levels that also award the every-fifth-level signature pick, show `1/2 — ATTRIBUTE` then `2/2 — SIGNATURE` (`packages/server/src/rooms/progression.ts:47-50`). Play the full folio opening once; use a short page/tab transition for phase two. Do not lengthen the timer to justify more text.
- **Replace raw deltas with outcome deltas.** Keep `STR 7→8` as secondary copy; lead with the current weapon's real damage change, exact crit change, exact HP/regen change, or the signature value most affected. Calculate from shared data, never from duplicated display constants.
- **Keep cards glanceable.** Three augment cards are fine. Five attributes need a responsive compact row/grid: the current fixed row consumes 814 px before margins while its folio is capped at 780 px (`packages/client/src/scenes/ArenaScene.ts:4495-4501`; `packages/client/src/scenes/ArenaScene.ts:4701-4705`). No essential information may require hover.
- **Add direct input parity.** Preserve the scene-level hit rectangles, then add number keys, D-pad/stick focus, confirm, visible focus state, and a one-action latch. Mouse, keyboard, and controller must select the same authoritative IDs.
- **Preserve co-op sight.** Reduce the current 66% blanket dim, keep ally health/status and dangerous world silhouettes readable, and state `WORLD LIVE` (`packages/client/src/scenes/ArenaScene.ts:4481-4501`). Do not imply the chooser is protecting or pausing teammates.
- **Use honest visual prestige.** Retain the paper folio and category colors already in the window (`packages/client/src/scenes/ArenaScene.ts:4394-4428`; `packages/client/src/scenes/ArenaScene.ts:4462-4479`), plus procedural borders/glows and existing painted/FX assets. Reserve “rarity” language and power-tier glow for a future system that actually supplies authoritative rarity/magnitude data.
- **Do not broaden the economy.** No reroll currency, banish persistence, skip banking, card locks, or shop-style price logic in this pass.

## Acceptance bar

The redesign is at genre parity when all of these are true:

1. A fresh player can state the primary consequence of every card after a two-second glance.
2. A practiced player can select any option by mouse, keyboard, or controller in under two seconds.
3. No card can promise the wrong auto attributes, ability family, dependency, stack value, or timeout result.
4. A milestone's second phase is obvious before the first commit; no surprise second modal.
5. The player can still identify ally distress and nearby danger through the overlay, with no false slow-motion.
6. Timeout tests prove the displayed `AUTO` result matches the server's actual resolution.
7. Telemetry targets median decision time at or below three seconds, 90th percentile at or below six seconds, and timeout below five percent. If those fail, cut copy before adding time.

That is major-game parity under co-op constraints: **less reading, more certainty, no lies.**
