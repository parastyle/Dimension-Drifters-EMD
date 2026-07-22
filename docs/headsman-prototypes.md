# Sanctified Headsman — holy blade-extension prototypes

Production decision: **Pale Procession (treatment 2)**. The production resolver ignores prototype URL
state and always uses this treatment. The four links and the in-game `P` cycle remain dev-build visual
references only. The shipped extension begins beneath the outer 30% of the physical blade, is drawn one
depth layer below the held weapon so the real sprite masks the join, and still ends at exactly 3× physical
blade length. Gameplay reach remains unchanged at the owner's direction-by-omission.

![Sanctified Headsman prototype contact sheet](assets/headsman-prototypes-contact-sheet.jpg)

| Prototype | Design intent | Live review link |
|---|---|---|
| 1. Radiant Verdict | A solid ivory-gold execution edge: the clearest, heaviest material read and strongest silhouette at combat speed. | [Open prototype 1](http://localhost:5180/?dev=weapon:x2-sanctified-headsman&proto=1) |
| 2. Pale Procession | A curved champagne ghost-blade: weightless, haunted, and visibly different from a solid metal/light slab. | [Open prototype 2](http://localhost:5180/?dev=weapon:x2-sanctified-headsman&proto=2) |
| 3. Woven Litany | Braided prayer-light and motes weave into the blade during the attack, leaving deliberate gaps through the silhouette. | [Open prototype 3](http://localhost:5180/?dev=weapon:x2-sanctified-headsman&proto=3) |
| 4. Cathedral Ruin | A jagged leaded stained-glass blade with amber, ruby, cobalt, and ivory panes plus close-held shards. | [Open prototype 4](http://localhost:5180/?dev=weapon:x2-sanctified-headsman&proto=4) |

## Shared mechanism

All four treatments use the same animation and geometry. The extension grows during the final wind-up, reaches full length at the active edge, holds through the damage sweep, and disappears for recovery. Every render frame samples the held sprite's real world-space tip, rotation, facing, and orbit foreshortening, so the magic stays joined to the physical blade instead of approximating its path. Changing the dev-only `proto` reference changes only the texture and treatment thickness.

The physical blade portion is about 167.7 px from grip to tip. The mechanism adds about 335.3 px of magic blade, making the blade itself exactly 3× physical length (about 503 px) at full reveal.

## Reach decision — closed visual-only

The owner declined a reach change by omission in the V6.1 ledger. The weapon therefore keeps authored
`range: 160`; the current shared physical-tip floor resolves its authoritative melee reach to about
190.5 px. The full magic tip is visual-only and reaches about 525.8 px from the actor pivot.
