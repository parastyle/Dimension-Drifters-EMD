# ORDER B63 — 30 MODERN GUNS

Owner order, 2026-07-25 (verbatim):

> "please queue up alot more guns. They should be modern but in our weapon art style, taking
> inspiration from modern guns, modern concept guns. Fan favorites you get at walmart; and cool
> future tech laser guns. Every few guns, slam it with camo's youd find in battle field or call of
> duty. I will dissapointed if I don't see red and blue tiger camos. Also almost all these should
> have a laser pointer / light combo attachment. I'm thinking 30 guns should do. Remember 1 Sol 1
> gun, don't let them concept bleed and weird guns that don't make sense."

## Standing laws that bind every gun in this order

1. **ONE SOL, ONE GUN.** Batching subjects bleeds themes across them. Non-negotiable.
2. **No chains, tassels, ropes, or straps that dangle.** We have no physics for them.
3. **Guns must make sense as guns.** A person could pick this up and understand how it works.
   No abstract sculpture, no impossible mechanisms, no "vaguely gun-shaped object."
4. Art contract, unchanged from the shipped roster: *weapon-only in-world sprite, flat orthographic
   full side-profile, ~4–6 colours, bold uniform black outline. Faces RIGHT — MUZZLE to the RIGHT,
   grip to the LEFT.*
5. **Laser/light combo** is a small boxy under-barrel or rail-mounted unit with a lens. It is a
   SILHOUETTE detail, not a glow. No emitted light in the sprite.
6. Camo is **painted onto the receiver/furniture**, following the gun's forms. It never floats, never
   covers the whole gun, and never fights the black outline.

## Camo assignments — RED TIGER AND BLUE TIGER ARE MANDATORY

| Camo | Guns |
| --- | --- |
| **Red tiger** | 02 Blacktail Pump 12, 19 Cyclone Micro-Gat |
| **Blue tiger** | 10 Warden Battle Rifle, 25 Voltcaster Arc Pistol |
| Woodland | 05 Mallard Sweeper |
| Digital / MARPAT | 08 Varmint Bolt .223 |
| Splinter | 12 Longwatch DMR |
| Desert tan | 15 Anvil .50 |
| Hex | 17 Caseless Vanguard |
| Snakeskin | 21 Recoilless Whisper |
| Gold | 28 Ember Plasma Carbine |
| Tiger stripe (classic) | 30 Aurora Ion Cannon |

12 of 30 carry camo — "every few guns" as ordered.

## Laser/light combo

Fitted to **27 of 30**. The three exempt are pieces where a rail unit would look wrong and the owner
said "almost all", not all: **04 Deacon Snub .38**, **05 Mallard Sweeper**, **06 Trailhead Lever .357**.

## The roster

### Tier A — consumer / "the ones you get at Walmart" (real-world inspired)

| # | Name | Family | Inspiration | Camo | Laser/light |
| --- | --- | --- | --- | --- | --- |
| 01 | Rancher .22 Plinker | semi-auto rimfire | Ruger 10/22, wood stock | — | yes |
| 02 | Blacktail Pump 12 | pump shotgun | Mossberg 500 / Rem 870 | **red tiger** | yes |
| 03 | Patriot Carbine AR | semi-auto carbine | civilian AR-15, flat-top | — | yes |
| 04 | Deacon Snub .38 | snub revolver | S&W J-frame | — | no |
| 05 | Mallard Sweeper | over/under | bird gun, blued + walnut | woodland | no |
| 06 | Trailhead Lever .357 | lever action | modern lever, ghost ring | — | no |
| 07 | Sidewalk Nine | polymer pistol | Glock-pattern striker 9mm | — | yes |
| 08 | Varmint Bolt .223 | bolt rifle | budget varmint bolt + scope | digital | yes |

### Tier B — duty / modern military

| # | Name | Family | Inspiration | Camo | Laser/light |
| --- | --- | --- | --- | --- | --- |
| 09 | Precinct SMG-9 | submachine gun | MP5-pattern roller-lock | — | yes |
| 10 | Warden Battle Rifle | battle rifle | SCAR-H 7.62 | **blue tiger** | yes |
| 11 | Breachmaster Auto-12 | auto shotgun | AA-12 drum | — | yes |
| 12 | Longwatch DMR | marksman rifle | SR-25 / M110 | splinter | yes |
| 13 | Ironclad LMG | light machine gun | belt-fed, bipod folded | — | yes |
| 14 | Pocket Vector .45 | folding SMG | KRISS Vector | — | yes |
| 15 | Anvil .50 | anti-materiel | M82-pattern bolt | desert tan | yes |

### Tier C — modern concept / near-future, still ballistic

| # | Name | Family | Inspiration | Camo | Laser/light |
| --- | --- | --- | --- | --- | --- |
| 16 | Helix Bullpup 6.8 | bullpup rifle | integrated optic bullpup | — | yes |
| 17 | Caseless Vanguard | caseless carbine | G11-lineage caseless | hex | yes |
| 18 | Slugthrower Rail-9 | rail pistol | rail-assisted sidearm | — | yes |
| 19 | Cyclone Micro-Gat | compact rotary | handheld rotary | **red tiger** | yes |
| 20 | Smartlink Burstmaster | smart burst rifle | guided-burst concept | — | yes |
| 21 | Recoilless Whisper | integrally suppressed | monolithic suppressor | snakeskin | yes |
| 22 | Magnetar Coilgun | coil accelerator | staged coil barrel | — | yes |

### Tier D — future tech / energy

| # | Name | Family | Inspiration | Camo | Laser/light |
| --- | --- | --- | --- | --- | --- |
| 23 | Solaris Beam Lance | continuous beam | focusing-array lance | — | yes |
| 24 | Prism Scatter Emitter | energy shotgun | split-prism spread | — | yes |
| 25 | Voltcaster Arc Pistol | arc pistol | arc emitter sidearm | **blue tiger** | yes |
| 26 | Nova Pulse Repeater | pulse rifle | pulse-packet rifle | — | yes |
| 27 | Zenith Photon DMR | photon marksman | long photon barrel | — | yes |
| 28 | Ember Plasma Carbine | plasma carbine | plasma bottle + vents | gold | yes |
| 29 | Singularity Micro-Lance | beam sidearm | pocket beam emitter | — | yes |
| 30 | Aurora Ion Cannon | heavy ion | shoulder ion cannon | tiger stripe | yes |

## Per-gun deliverable

One concept entry matching the shipped schema in `data/weapon-concepts-300.json` — `name`, `type:
"ranged"`, `family`, `theme`, `element`, `finish`, `grip`, `size`, `rangeBand`, `scaling`,
`artPrompt`, `palettePrimary`, `paletteAccent`, `cardartAction`, `behavior{...}` — plus ONE generated
sprite. Codegen is STRICT (`gen-weapon-expansion.mjs` §43): unknown keys, sibling mechanic blocks,
bad enums and duplicate ids abort the run.

## Distinctness rule

Every gun above has a named real-world or named-concept anchor. A Sol authors ONLY its assigned row.
It may not invent a different gun, may not borrow another row's silhouette, and may not add a second
weapon. If its row seems wrong, it reports rather than substituting.
