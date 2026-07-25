# Dimension Drifters input map

Surveyed on `feat/v0.118-metagame` from the two client input owners:

- `packages/client/src/scenes/ArenaScene.ts` (Phaser keys, held mouse buttons, and in-arena pointer zones)
- `packages/client/src/scenes/MenuScene.ts` (DOM-style `keydown` routing and menu pointer zones)

The survey also searched the rest of `packages/client`, `packages/client/index.html`, and the generated dev portal. There are no client mouse-wheel bindings. `tools/portal` has its own catalog shortcuts (`1–9`, `/`, `Enter`, and `Space`), but its Testing Grounds links do not advertise any in-game key names.

## Before and after

| Input | Before this remap | After this remap | Reachable context / gate |
| --- | --- | --- | --- |
| `E` | Grab the nearest pickup; otherwise previous weapon, previous belt slot, or previous gallery page | Interact / pick up only; inert when there is no interactable | Active gameplay, alive, no blocking modal; pickup must be in reach |
| `Q` | Next weapon, next belt slot, or next gallery page | Next weapon or next occupied belt slot | Active gameplay, no blocking modal; works in arena and Testing Grounds |
| `Z` | Unbound | Previous weapon-gallery page | Testing Grounds only |
| `X` | Unbound | Next weapon-gallery page | Testing Grounds only |
| `G` | Unbound | Open a general game-note bubble | Testing Grounds only; the note bubble becomes a hard modal |
| `T` | Toggle arena / Testing Grounds | Enter Testing Grounds from arena; open a weapon-note bubble inside Testing Grounds | Development tools only; server validates both the training gate and note write |
| `R` | Near pickup: grab; otherwise tap to drop or hold to salvage | Tap to drop or hold to salvage only; inert while an `E` pickup prompt is visible | Active gameplay, alive, held weapon, no blocking modal |
| `1–3` | Direct belt slots; level-up choices 1–3 | Unchanged | Level window owns the keys while open; otherwise belt mode owns them |
| `4–5` | Level-up choices 4–5 | Unchanged | Level window only |
| `Tab` | Backpack in belt mode; summon sheet in Testing Grounds | Unchanged | Belt and Testing Grounds are mutually exclusive; second press closes the active surface |
| `F` | Trade near a belt shopkeeper | No arena action while `ULTIMATES_ENABLED` is false | Ultimates are reversibly disabled by the B55 owner ruling |
| LMB / RMB over clickable HUD | A HUD click could share the held-button frame with parry/fire outside hard modals | HUD hit-testing suppresses parry/fire while the pointer is over an interactive object | Restart, arsenal, backpack, shop, level window, and summon controls |

### The reported Q/E collision

At survey time, three weapon concerns were multiplexed in the same update block:

| State before remap | `E` handler | `Q` handler |
| --- | --- | --- |
| Pickup in reach | `grabWeapon(pickupId)` | Mode-specific cycle/page action |
| Normal arena, no pickup | `cycleWeapon({ dir: -1 })` | `cycleWeapon({ dir: 1 })` |
| Belt, no pickup | previous occupied arsenal slot | next occupied arsenal slot |
| Testing Grounds, no pickup | `galleryPage({ dir: -1 })` | `galleryPage({ dir: 1 })` |

The starting branch already contained an `eFree` guard, so an `E` edge could not literally send both `grabWeapon` and cycle/page in the same frame on this checkout. `Q` also never sent `grabWeapon`, and the belt/training/arena branches were exclusive. The collision was nevertheless real at the control-contract level: the same nearby key pair changed from weapon selection to gallery navigation, while `E` changed again to pickup based on reach. A stale or missed proximity read therefore made the player's intended pickup become a roster/page change. `R` was also a second pickup alias with its own drop/salvage state machine.

The new route has no fallback meaning: `E` can only produce pickup, `Q` can only produce cycle, and `Z/X` can only produce a gallery-page delta. The route is centralized in `packages/client/src/input-routing.ts` and is covered without Phaser by `input-routing.test.ts`.

## Complete client binding map

### Arena combat and Testing Grounds

| Input | Action | Context and explicit gating |
| --- | --- | --- |
| `W`, `A`, `S`, `D` held | Move | Arena, belt, and Testing Grounds while no level/legend/summon modal blocks input |
| Mouse move | Aim/facing and targeted action position | All live gameplay; raw window pointer/mouse movement is translated into game coordinates |
| RMB held | Fire repeatedly; charge/channel beam weapons | Alive, no blocking modal, not slide-attack-locked, and pointer not over interactive UI |
| LMB held | Parry/brace when cooldown permits | Alive, no blocking modal, not slide-parry-locked, and pointer not over interactive UI |
| `Space` tap | Jump | Alive and gameplay input enabled |
| `Space` hold, then release | Crouch and distance leap | Alive and gameplay input enabled; classified by `SpaceGestureClassifier` |
| `Space` tap while airborne | Ground pound | Alive and gameplay input enabled |
| `Space` during slide | Slide hop | Alive and gameplay input enabled |
| `Shift` or `Ctrl` press | Slide | Alive, no blocking modal, predictor permits it; both are intentional aliases |
| `E` press | Pick up the exact highlighted weapon | Alive, nearest pickup in prompt radius, no blocking modal; does not cycle or page |
| `R` tap/release | Drop held weapon | Alive, held weapon, no pickup prompt, release before salvage threshold |
| `R` hold | Salvage held weapon | Alive, held weapon, no pickup prompt; one shot at `SALVAGE_HOLD_SECONDS` |
| `Q` press | Advance held weapon | Normal arena and Testing Grounds |
| `Q` press | Advance to next occupied arsenal entry | Belt mode; skips empty and bound off-hand rows |
| `1`, `2`, `3` | Equip arsenal slot | Belt mode only when no level window owns the number keys |
| `Z`, `X` | Previous / next gallery page | Testing Grounds only; server still enforces host-only shared-gallery mutation |
| `P` | Cycle the equipped weapon's pose preview | Development build and Testing Grounds only |
| `G` | Open a general game-note bubble | Testing Grounds only; unavailable while another modal owns input |
| `T` | Open a weapon-note bubble and snapshot the active-slot weapon id/name | Testing Grounds only; unavailable while another modal owns input |
| `T` | Enter Testing Grounds | Arena / non-training gameplay only; server validates the development-tools gate |
| `B` | Spawn the playtest boss | Active gameplay; server validates the request |
| `C` | Cycle legacy cosmetic character | Active gameplay |
| `M` | Toggle persisted audio mute | Active gameplay |
| `F` | No arena action (`ULTIMATES_ENABLED = false`) | Ultimate input remains dormant until the owner re-enables the feature |
| `F` | Open/close Trading Post | Belt mode and inside shop radius; suppresses ultimate for that press |
| `Tab` | Open/close Backpack | Belt mode |
| `Tab` | Open/close summon menu | Testing Grounds outside belt mode |
| `Esc` | Close summon menu | Summon menu open |
| `H` | Open/close Verb Legend | Not during a level window; opening it closes Backpack, shop, or summon menu |

`Tab` and `Esc` are captured by Phaser so the browser does not steal focus. The owner-note textarea temporarily disables Phaser keyboard processing and global key capture, resets held-key state, and restores both on save/cancel so typing cannot move, fire, parry, cycle, or leak a held key back into play. Any keyboard or pointer gesture also resumes the audio context; that is an idempotent browser-policy hook, not a gameplay action.

### Level-up / signature window

The level window is a hard modal. Its release latch must clear before gameplay resumes, so the press that selected or closed the window cannot leak into movement, jump, slot selection, fire, or parry.

| Input | Action |
| --- | --- |
| `1–5` | Select and confirm the matching offered card |
| `W`, `A`, Left, Up | Move focus to previous card |
| `S`, `D`, Right, Down | Move focus to next card |
| `Enter`, `Space` | Confirm focused card |
| Pointer click on a card | Focus and confirm that card |

### Dock, arsenal, Backpack, and shop pointer controls

| Pointer target | Action | Context |
| --- | --- | --- |
| Restart / Wardrobe button | Restart active run, or return to Wardrobe after outcome | Arena HUD |
| Arsenal slot | Select slot | Belt HUD, panel closed |
| Arsenal slot | Stow to pack | Backpack open |
| Arsenal slot | Select; Inventory click stows directly | Trading Post / Backpack open |
| Pack weapon card | Inventory equips directly; Sell/Bind only selects | Backpack / Trading Post |
| Persistent detail action | Sell, bind/unbind, or buy the selected upgrade | Trading Post; explicit confirmation surface |

The ordinary carousel is display-only. Its previous arm is labelled `PREV`; its actionable next arm is labelled `[Q] NEXT`. The backpack traps arrows/Enter, uses `Z/X` for trading workflows, `Q` for the active slot, and `Tab`/`Esc` to close. While it is open the modal swallows gameplay and owner-note input. While the pointer is over any interactive HUD object, LMB/RMB combat is suppressed.

### Testing Grounds summon menu

| Input | Action |
| --- | --- |
| `Tab` or `Esc` | Close the summon menu |
| Pointer click `1`, `3`, `10`, `30` | Set summon count |
| Pointer click `tough` | Toggle tough spawns |
| Pointer click enemy | Spawn selected enemy kind/count |
| Pointer click boss | Replace the live boss with that boss |
| Pointer click `Prev` / `Next` | Page the boss list (not the weapon gallery) |

The full-screen backdrop/panel are interactive absorbers, preventing clicks from reaching gameplay. Weapon-gallery paging remains outside this menu on `Z/X` and is inert while the menu is open.

### Main menu: closet, carry, and destinations

| Input | Action | Context |
| --- | --- | --- |
| `1–6` | Apply wardrobe preset | Wardrobe / closet tab |
| `R` | Clear selected wardrobe slot to its starter item | Wardrobe / closet tab |
| Arrow keys | Move the roving catalog focus | Wardrobe or Armory / Carry tab |
| `Enter` | Equip/unequip the focused gear, or stage/remove the focused weapon entry | Wardrobe or Armory / Carry tab |
| `Q`, `E` | Previous/next Closet slot; move staged Armory item between Active and Pack | Wardrobe / Armory context |
| `Z`, `X` | Previous/next virtual catalog page | Wardrobe or Armory / Carry tab |
| `/` | Focus the active canvas catalog search field | Wardrobe or Armory / Carry tab |
| `Esc` | Return to Destinations, or close the Prestige drawer first | Wardrobe or Armory / Carry tab |
| `1…N` | Launch the numbered dimension | Destinations tab |
| `B` | Launch Boss Rush | Destinations tab |
| `H` | Toggle Quick Join / Host New Run | Destinations tab |
| Pointer click tab | Switch Wardrobe, Armory / Carry, or Destinations | Main menu |
| Pointer click wardrobe slot | Select closet category | Wardrobe |
| Pointer click gear card | Equip item | Wardrobe |
| Pointer hover gear card | Preview item and inspector copy | Wardrobe |
| Pointer click preset / pager | Apply preset / page gear catalog | Wardrobe |
| Pointer hold prestige button, release | Start and finish eligible prestige ceremony; pointer-out cancels | Wardrobe |
| Pointer click companion | Select owned pet; hover previews it | Wardrobe |
| Pointer click stash card / pager | Stage or remove carry entry / page stash | Armory / Carry |
| Pointer click Quick Join / Host | Select launch contract | Destinations |
| Pointer click dimension, belt level, or Boss Rush card | Launch that destination | Destinations |
| Pointer click volume `−` / `+` / Mute | Change persisted audio settings | Main menu |

## Collision state machine after remap

1. A hard modal (owner-note bubble, level window, release latch, Verb Legend, summon menu, backpack/trading workspace, or its close edge) owns input and blocks gameplay handlers.
2. In arena/non-training play, `T` keeps its single enter-Testing-Grounds verb and `G` is inert. In Testing Grounds, `G` opens a game note and `T` opens a weapon note; neither can also toggle the mode.
3. While an owner-note bubble is open, its DOM textarea owns every keyboard/pointer frame. `Enter` submits, `Shift+Enter` inserts a newline, and `Esc` cancels.
4. With gameplay enabled, the client resolves the nearest in-range pickup and shows `[E] Pick up` on that exact target.
5. `E` sends only `grabWeapon(pickupId)`. Without the prompt it is inert; it never falls through to cycle or page. A pickup edge also wins over any cycle/page edge sampled in that same frame.
6. `R` is disabled while that pickup prompt is present. Away from pickups, release before the threshold drops; reaching the threshold salvages and suppresses release-drop.
7. `Q` sends only a forward weapon/slot cycle. In Testing Grounds it still cycles the held weapon; it never pages the gallery.
8. `Z/X` produce a page delta only when mode is `training`. Both are inert in arena and belt combat.
9. `F`, `Tab`, number keys, movement keys, and `Space` retain their existing mutually exclusive proximity/modal grammars described above.
10. A pointer over interactive UI suppresses the LMB parry and RMB fire/channel paths, so one HUD click cannot also perform a combat verb.

## UI copy audit

- Top HTML HUD: now includes `E interact · Q cycle · H controls`.
- Pickup affordance: new world-space `[E] Pick up` prompt on the highlighted target.
- Verb Legend: `E` pickup/interact, `Q` next weapon/slot, `Z/X` gallery pages, `T` enter Testing Grounds, and contextual `G/T` notes.
- Testing Grounds objective/location plate: identifies `WEAPON EVALUATION` and shows page count, `Z/X`, `Q`, `E`, `R`, Portal search, and `G/T` owner-note context; only the nearest gallery pickup expands to its full 14 px label.
- Ordinary weapon dock: removes all `E` badges; previous items are passive and `[Q] NEXT` is the only cycle affordance.
- Belt arsenal readout: adds `[Q] Next slot`.
- Backpack and Trading Post: the header exposes Inventory/Sell/Bind/Upgrades; selling exists only on the persistent `Sell for ◈N` action, never on a tile click.
- Testing Grounds summon sheet: existing `Tab / Esc to close` remains correct.
- Dev portal Testing Grounds links/cards: no in-game key names were present, so no portal copy changed.
