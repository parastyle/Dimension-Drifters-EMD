# Firing stances

## Scope and taxonomy

The source of truth is `WeaponDef.tags` plus the actual delivery block in
`packages/shared/src/weapons.ts` (including its generated expansion import). Tags alone are not enough:
`gauntlet` can be melee or a worn gun, and `hand-cannon` can be a pistol-shaped slug gun or an explosive
payload launcher. The client therefore resolves the delivery mechanism first, then `classPool`, `delivery`,
`grip`, `family`, and `fireMode`.

The real firing/casting families present are:

- pistol/slug guns (`pistol`, compact 1H/dual projectile and beam guns);
- shouldered long guns and scatterguns (`marksman-rifle`, `lever-rifle`, `railgun`, `shotgun`,
  `blunderbuss`);
- nail/rapid guns (`nailgun`, `machine-pistol`, auto/tracer guns, Gatling-type guns);
- launchers (the base Hand Mortar plus explosive mortars, bombards, howitzers, and payload guns in the
  expansion);
- thrown weapons (`delivery: thrown` with a `thrown` block);
- fist-guns (worn `gauntlet`/fist art with a `gun` or `beam` block, including dual gauntlets);
- wands/rods and compact caster foci (`wand`, `rod`, `scepter`, `focus`, `orb`, 1H relic/totem);
- staves/beam staves (explicit `staff`, or a long 2H/mounted caster focus);
- tomes (book-named families such as `tome`, `grimoire`, `spellbook`, `compendium`, and `psalter`).

## Researched stance table

`H` is the rig body height (currently 76 px). Y is the final hand/grip target relative to the body center;
negative Y is upward. The old global firing target was centered at `-0.27H` with aim travel to `-0.315H`.
The protected face line is `-0.22H`; every new aimed band stays below it. These are grip bands, not muzzle-tip
bands—the semantic weapon axis continues forward from the hand through the painted-art geometry seam.

| Delivery family | Repo resolution | Firing pose | Grip Y band | One-line reasoning |
| --- | --- | --- | ---: | --- |
| Pistol / slug | Compact 1H or dual gun after special cases | One arm per held pistol, extended forward at upper-chest/shoulder height; the off pistol gets its own staggered arm | `-0.12H..-0.04H` | Marine pistol doctrine elevates and **extends** the arms while keeping the head erect for the sights; DD uses one arm per pistol for dual-wield readability, but preserves the important distance from the face ([USMC pistol marksmanship](https://www.trngcmd.marines.mil/Portals/207/Docs/TBS/MCRP%203-01B%20Pistol%20Marksmanship.pdf)). |
| Long gun / rifle | 2H rifle, railgun, lever gun, or other non-special long gun | Shouldered, two-hand support, only a modest cheek-line rise | `-0.16H..-0.08H` | A stock belongs in the shoulder pocket and the cheek contacts the stock to stabilize the sight line, so the grip rises modestly but the whole gun is not translated onto the face ([U.S. Army Marksmanship Unit training](https://www.army.mil/article/71615/usamu_provides_advanced_marksmanship_training_amt)). |
| Scattergun | `delivery: spread`, multi-pellet gun, `shotgun`, or `blunderbuss` | Shouldered two-hand brace, forward-weighted; no pistol-like face lift | `-0.16H..-0.08H` | Shotgun instruction brings the stock smoothly to cheek and shoulder and uses the support hand to point/swing, which is a recoil-and-control brace rather than a head-level hand pose ([Texas Parks & Wildlife](https://tpwd.texas.gov/education/hunter-education/online-course/shooting-skills/shooting-shotguns/)). |
| Nail / rapid | Nail/tracer projectile, rapid family, auto fire mode, or very short fire rate | Extended chest guard for compact tools; braced shoulder line for 2H autos | `-0.13H..-0.05H` | Automatic fire needs a stable body/weapon relationship, while real nail-tool rules keep hands clear of the barrel and prohibit pointing the tool at people; neither supports parking the mechanism by the face ([Army Reserve automatic-fire stability](https://www.usar.army.mil/Portals/98/Documents/Marksmanship/ARM_FY19-3.pdf?ver=2018-10-31-162257-193), [OSHA 1926.302](https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.302)). |
| Launcher | Explosive/payload gun or mortar/howitzer/bombard/launcher | Two-hand shoulder/upper-chest brace, head behind the source and clear of the forward line | `-0.16H..-0.08H` | Shoulder-launched doctrine seats the shoulder stop firmly, supports the front, keeps elbows close, and maintains a sight picture; recoil/backblast demand bracing and clearance, not face proximity ([U.S. Army TM 3-23.25](https://rdl.train.army.mil/catalog-ws/view/100.ATSC/540616D5-D063-4611-876F-8FB4F5188B97-1300783053878/3-23.25/tm3_23x25.pdf)). |
| Thrown | `delivery: thrown` or a `thrown` block | Normal forward-level rest; arm withdraws behind the shoulder only inside the authored throw, then drives forward—no 250 ms aimed linger | n/a | World Athletics separates withdrawal (arm drawn back), delivery (arm thrust forward), and follow-through, so a permanent high/behind-shoulder hold would collapse distinct throw phases ([World Athletics javelin technique](https://worldathletics.org/disciplines/throwing/javelin-throw)). |
| Fist-gun / gauntlet shooter | Worn gauntlet/fist art **and** a gun/beam block | Body squared; punch-forward guard at chest height; each gauntlet owns its hand; **NEVER near the face** | `-0.06H..0.02H` (hard chest cap) | The genre emitter is generated through the gauntlet itself, so the fist is the muzzle: extending it reads as attack, while lifting it to the face hides both the emitter and silhouette ([Marvel: repulsor rays are generated through Iron Man's gauntlets](https://www.marvel.com/characters/iron-man-tony-stark/in-comics)). |
| Wand / rod | `wand`, `rod`, compact focus/orb/scepter/relic | Relaxed one-hand forward point at chest height; no cheek weld | `-0.10H..-0.02H` | A spellcasting focus must be held, but fantasy casting supplies no firearm sight line or stock recoil; a relaxed chest-level point keeps the focus and target direction readable ([D&D SRD 5.2.1, spell components/foci](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)). |
| Staff / beam staff | Explicit `staff`, or long 2H/mounted caster focus | Two-hand brace at mid-torso with the emitting head forward of the face line | `-0.03H..0.05H` | The long lever benefits from two separated hands like other long implements, while focus casting needs no cheek weld; mid-torso hands keep the staff head visibly forward and the face unobstructed ([D&D SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), [Army long-gun stock/cheek relationship](https://www.army.mil/article/71615/usamu_provides_advanced_marksmanship_training_amt)). |
| Tome | Book-named caster family | Book held open at chest; off hand performs the casting gesture | `-0.08H..0.02H` | The SRD distinguishes holding a focus from the forceful/intricate hand gestures of a Somatic component, supporting a stable readable book plus a separate casting hand ([D&D SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)). |

## Animation contract

- Neutral/rest remains the existing aim-relative forward-level directive.
- Fire eases into the resolved family target, retains the existing 250 ms linger, then eases to rest.
- In dual wield, the lead and off hands resolve from their own `WeaponDef`; the lead weapon may not impose its
  family target on the off weapon.
- Fist-gun Y is clamped to the chest cap after aim travel, and all aimed families remain below the protected
  face line.
- Thrown weapons never enter the retained firing envelope; their behind-shoulder wind-up belongs only to the
  authored throw clock.
