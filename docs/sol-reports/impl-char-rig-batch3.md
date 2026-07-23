# Sol implementation report: char-rig-batch3

## Understanding

Install 37 owner-authored green-chroma whole-art characters as fresh six-part rigs. The intake art is
canonical: preserve the authored head/body/hands/feet placement, key with the shipped soft-matte and
despill path, slice with the shipped guard, normalize to a 76 px body-height unit, and install with the
shipped harvester. Hands must remain ambiguous smooth ovals with no thumbs, digits, palm marks, or
directional cues.

Eleven existing whole-art sprite directories are replaced in place. Twenty-one ids are brand-new. The
five cowboy/hero-set ids are treated as fresh installs; some may already have historical registrations,
so their current repository state will be checked and replaced/registered without preserving stale
parts. `proto-sheriff` and `proto-witch` are retired from production sprites and all generated roster
contracts, while their historical intake files remain untouched. The generated default becomes
`proto-cowboy-hidden-face`.

## Per-character classification assumptions

| Character id | Classification | Intake/layout assumption |
| --- | --- | --- |
| `proto-cowboy-hidden-face` | cowboy/hero-set fresh install; new default | canonical six-part no-thumb source |
| `proto-cowboy` | cowboy/hero-set fresh install | canonical six-part no-thumb source |
| `proto-ninja-purple` | cowboy/hero-set fresh install | canonical six-part no-thumb source |
| `proto-templar-knight` | cowboy/hero-set fresh install | canonical six-part no-thumb source |
| `proto-wizard` | cowboy/hero-set fresh install | canonical six-part no-thumb source |
| `proto-samurai` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-masked-oval-fighter` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-blob-bruiser` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-capsule-tactical-unit` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-armored-bean-heavy` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-hooded-rogue` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-soft-mascot-fighter` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-geometric-robot-pod` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-mutant-lump` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-paper-cutout-fighter` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-helmeted-enforcer` | replace existing sprite directory in place | canonical six-part no-thumb source supersedes thumb art |
| `proto-plague-doctor` | brand-new | canonical six-part no-thumb source |
| `proto-pirate-captain` | brand-new | canonical six-part no-thumb source |
| `proto-desert-nomad` | brand-new | canonical six-part no-thumb source |
| `proto-cyberpunk-hacker` | brand-new | canonical six-part no-thumb source |
| `proto-mushroom-alchemist` | brand-new | canonical six-part no-thumb source |
| `proto-gothic-vampire-hunter` | brand-new | canonical six-part no-thumb source |
| `proto-molten-forge-golem` | brand-new | canonical six-part no-thumb source |
| `proto-frost-rune-guardian` | brand-new | canonical six-part no-thumb source |
| `proto-toxic-wasteland-scavenger` | brand-new | canonical six-part no-thumb source |
| `proto-space-miner` | brand-new | canonical six-part no-thumb source |
| `proto-carnival-harlequin` | brand-new | canonical six-part no-thumb source |
| `proto-clockwork-butler` | brand-new | canonical six-part no-thumb source |
| `proto-swamp-shaman` | brand-new | canonical six-part no-thumb source |
| `proto-bone-cleric` | brand-new | canonical six-part no-thumb source |
| `proto-junkyard-mechanic` | brand-new | canonical six-part no-thumb source |
| `proto-royal-executioner` | brand-new | canonical six-part no-thumb source |
| `proto-alien-void-scholar` | brand-new | canonical six-part no-thumb source |
| `proto-red-rebel-demon-hunter` | brand-new | canonical six-part no-thumb source |
| `proto-red-rebel-demon-hunter-v2` | brand-new | canonical six-part no-thumb source; distinct id/art revision |
| `proto-blue-spectral-demon-hunter` | brand-new | canonical six-part no-thumb source |
| `proto-punk-occult-summoner` | brand-new | canonical six-part no-thumb source |

## Plan

1. Audit the batch2 scripts, generator inputs, manifest schema, current sprite directories, and hardcoded
   roster/default tests.
2. Run the shipped key/slice/normalize/install pipeline deterministically for all 37 intake files,
   replacing existing target directories as needed.
3. Register all 37 ids, retire `proto-sheriff` and `proto-witch`, change the generated default, and
   regenerate checked-in outputs.
4. Add or update deterministic coverage for six textures, head mounts, exact 37-id whole-art census,
   the new default, and retired-id absence.
5. Run generation, asset, typecheck, and full-test gates; fix only in-scope failures; commit the result
   on `sol/char-rig-batch3`.

## Progress log

### Per-character implementation results

- `proto-cowboy-hidden-face` — source SHA-256 `09D759B04BE9…`; 90.3% field keyed; body
  269x235; head 415x283 at (`19`, `-302`); hands 97x121 / 97x120; feet 137x99 / 136x99;
  exactly six components.
- `proto-cowboy` — source SHA-256 `DE12821EE1CC…`; 88.0% field keyed; body 282x273; head
  457x274 at (`10`, `-311`); hands 108x134 / 108x134; feet 154x118 / 153x118; exactly six
  components.
- `proto-ninja-purple` — source SHA-256 `155C96EDDAA6…`; 88.1% field keyed; body 303x290;
  head 356x279 at (`14`, `-352`); hands 112x126 / 113x126; feet 164x115 / 163x116; exactly
  six components.
- `proto-templar-knight` — source SHA-256 `F0733A2ACB8C…`; 90.3% field keyed; body 283x290;
  head 280x259 at (`21`, `-299`); hands 98x120 / 98x119; feet 128x87 / 127x87; exactly six
  components.
- `proto-wizard` — source SHA-256 `6AE3C75C5FB2…`; 87.2% field keyed; body 324x276; head
  457x336 at (`28`, `-336`); hands 113x131 / 112x130; feet 153x105 / 153x105; exactly six
  components.
- `proto-samurai` — source SHA-256 `6D41D7432F60…`; 89.3% field keyed; body 298x303; head
  292x293 at (`23`, `-318`); hands 94x118 / 94x118; feet 145x109 / 145x109; exactly six
  components.
- `proto-masked-oval-fighter` — source SHA-256 `CEB5D7E47566…`; 93.9% field keyed; body
  207x232; head 166x227 at (`20`, `-268`); hands 81x103 / 81x103; feet 102x78 / 100x79;
  exactly six components.
- `proto-blob-bruiser` — source SHA-256 `E1BF9FA03710…`; 87.4% field keyed; body 329x282;
  head 313x291 at (`9`, `-321`); hands 109x135 / 109x135; feet 151x110 / 149x110; exactly
  six components.
- `proto-capsule-tactical-unit` — source SHA-256 `699711D23FD7…`; 92.0% field keyed; body
  219x222; head 209x245 at (`10`, `-262`); hands 99x119 / 99x118; feet 134x94 / 137x96;
  exactly six components.
- `proto-armored-bean-heavy` — source SHA-256 `22E89435FD24…`; 88.8% field keyed; body
  305x270; head 256x251 at (`22`, `-294`); hands 120x147 / 119x146; feet 155x108 / 157x108;
  exactly six components.
- `proto-hooded-rogue` — source SHA-256 `06F200A549A0…`; 88.9% field keyed; body 294x280;
  head 322x307 at (`6`, `-325`); hands 99x129 / 99x129; feet 134x98 / 136x98; exactly six
  components.
- `proto-soft-mascot-fighter` — source SHA-256 `80188C2C646C…`; 91.8% field keyed; body
  231x224; head 255x221 at (`3`, `-253`); hands 103x118 / 104x118; feet 122x92 / 121x91;
  exactly six components.
- `proto-geometric-robot-pod` — source SHA-256 `6BE0C49EA055…`; 90.0% field keyed; body
  311x264; head 259x213 at (`27`, `-291`); hands 115x130 / 115x130; feet 155x104 / 162x104;
  exactly six components.
- `proto-mutant-lump` — source SHA-256 `C1B7A2C9AF99…`; 90.1% field keyed; body 279x280;
  head 267x262 at (`30`, `-290`); hands 97x128 / 97x128; feet 149x100 / 149x99; exactly six
  components.
- `proto-paper-cutout-fighter` — source SHA-256 `16FB86AAA973…`; 92.0% field keyed; body
  242x227; head 236x311 at (`9`, `-283`); hands 91x114 / 92x114; feet 132x86 / 129x86;
  exactly six components.
- `proto-helmeted-enforcer` — source SHA-256 `BAA32449F191…`; 88.3% field keyed; body
  324x302; head 255x252 at (`12`, `-296`); hands 103x150 / 102x150; feet 152x97 / 150x96;
  exactly six components.
- `proto-plague-doctor` — source SHA-256 `D9D9D2EEBFF6…`; 84.9% field keyed; body 346x387;
  head 481x314 at (`22`, `-374`); hands 99x139 / 99x139; feet 154x103 / 148x102; exactly six
  components.
- `proto-pirate-captain` — source SHA-256 `56CE17F2F1BD…`; 85.5% field keyed; body 337x324;
  head 440x336 at (`13`, `-359`); hands 102x134 / 102x133; feet 151x113 / 159x110; exactly
  six components.
- `proto-desert-nomad` — source SHA-256 `A7C3ED9EC8C8…`; 85.7% field keyed; body 348x329;
  head 415x305 at (`18`, `-359`); hands 108x120 / 107x120; feet 189x115 / 185x113; exactly
  six components.
- `proto-cyberpunk-hacker` — source SHA-256 `7FE757306152…`; 85.0% field keyed; body 368x365;
  head 309x286 at (`9`, `-365`); hands 111x148 / 109x149; feet 164x113 / 167x113; exactly
  six components.
- `proto-mushroom-alchemist` — source SHA-256 `BFBC610FF41C…`; 86.0% field keyed; body
  335x321; head 376x298 at (`10`, `-336`); hands 113x121 / 112x121; feet 165x113 / 164x108;
  exactly six components.
- `proto-gothic-vampire-hunter` — source SHA-256 `755078DAA4A8…`; 86.4% field keyed; body
  328x353; head 510x346 at (`5`, `-356`); hands 104x136 / 101x136; feet 139x95 / 141x95;
  exactly six components.
- `proto-molten-forge-golem` — source SHA-256 `33CBEF1B7EC7…`; 83.1% field keyed; body
  408x332; head 299x252 at (`10`, `-325`); hands 144x177 / 143x177; feet 212x138 / 205x136;
  exactly six components.
- `proto-frost-rune-guardian` — source SHA-256 `0CAAA9E2059C…`; 86.3% field keyed; body
  345x312; head 268x267 at (`17`, `-297`); hands 133x146 / 134x146; feet 181x121 / 179x119;
  exactly six components.
- `proto-toxic-wasteland-scavenger` — source SHA-256 `291C92045961…`; 84.8% field keyed;
  body 364x344; head 356x298 at (`9`, `-356`); hands 113x144 / 113x144; feet 175x125 /
  172x124; exactly six components.
- `proto-space-miner` — source SHA-256 `AE39BC4271A9…`; 83.7% field keyed; body 381x315;
  head 323x303 at (`21`, `-324`); hands 125x166 / 126x166; feet 180x134 / 178x133; exactly
  six components.
- `proto-carnival-harlequin` — source SHA-256 `F8D200FCD3C1…`; 85.8% field keyed; body
  357x344; head 392x325 at (`14`, `-349`); hands 100x144 / 99x143; feet 181x122 / 174x120;
  exactly six components.
- `proto-clockwork-butler` — source SHA-256 `4BF9F25E8335…`; 87.4% field keyed; body 326x314;
  head 252x295 at (`15`, `-335`); hands 110x124 / 109x124; feet 178x121 / 179x121; exactly
  six components.
- `proto-swamp-shaman` — source SHA-256 `498D2B07004D…`; 84.4% field keyed; body 364x358;
  head 425x334 at (`4`, `-375`); hands 108x146 / 107x146; feet 147x112 / 147x111; exactly
  six components.
- `proto-bone-cleric` — source SHA-256 `96808D12C6FE…`; 86.3% field keyed; body 339x351;
  head 337x345 at (`18`, `-362`); hands 107x132 / 108x132; feet 149x105 / 152x105; exactly
  six components.
- `proto-junkyard-mechanic` — source SHA-256 `8129D85E3A97…`; 84.1% field keyed; body
  336x337; head 415x311 at (`20`, `-348`); hands 125x149 / 124x150; feet 172x127 / 173x126;
  exactly six components.
- `proto-royal-executioner` — source SHA-256 `1B24B5ABB8E6…`; 85.6% field keyed; body
  365x403; head 285x283 at (`23`, `-350`); hands 106x130 / 105x130; feet 137x117 / 133x114;
  exactly six components.
- `proto-alien-void-scholar` — source SHA-256 `2388FC1E5D51…`; 86.6% field keyed; body
  332x336; head 317x328 at (`12`, `-337`); hands 111x138 / 111x139; feet 150x114 / 150x110;
  exactly six components.
- `proto-red-rebel-demon-hunter` — source SHA-256 `EEDE81302409…`; 87.3% field keyed; body
  377x422; head 349x254 at (`-1`, `-362`); hands 121x106 / 120x106; feet 139x105 / 144x104;
  exactly six components.
- `proto-red-rebel-demon-hunter-v2` — source SHA-256 `1A7660CB2DAA…`; 86.2% field keyed;
  body 336x386; head 325x287 at (`7`, `-346`); hands 124x133 / 124x133; feet 157x136 /
  163x132; exactly six components.
- `proto-blue-spectral-demon-hunter` — source SHA-256 `E92A51BD7D57…`; 90.6% field keyed;
  body 277x367; head 183x220 at (`6`, `-335`); hands 95x120 / 95x119; feet 138x169 /
  149x166; exactly six components.
- `proto-punk-occult-summoner` — source SHA-256 `6883ED5BD168…`; 85.4% field keyed; body
  367x361; head 374x307 at (`10`, `-352`); hands 118x114 / 117x113; feet 152x115 / 152x114;
  exactly six components.

All 37 installed manifests preserve these source-space centroid relationships through the installer's
single uniform presize factor. Each installed body is exactly 168 px high, which feeds the unchanged 76 px
runtime body-height normalization.

### Installation and registration

- Copied all 37 raw owner sources byte-for-byte from the primary intake staging area into this isolated
  worktree. A final SHA-256 comparison reports 37/37 exact matches.
- Wrote the shipped keyer's `.keyed.png` and charcoal `.preview.png` outputs beside every raw intake file.
  The initial key removed 83.1%–93.9% of each source canvas.
- Installed 222 loose part PNGs through `harvest-install.mjs --kind=character --post-key=1`. All 37
  manifests have the exact ordered roles `body`, `head`, `hand-l`, `hand-r`, `foot-l`, and `foot-r`, a
  168 px installed body, and a negative authored head mount.
- Removed the obsolete hardcoded samurai/sheriff/witch source-space head seating. The fresh samurai and all
  other rigs now retain the connected-component geometry authored in their replacement source.
- Added a deterministic `--retire-ids` installer path, then retired `proto-sheriff` and `proto-witch` from
  the generated manifest and deleted both production sprite directories. Their historical intake files
  remain untouched.
- Repacked `dd-sprites` to 635 atlas frames. No retired frame remains in the atlas JSON.
- Generated exactly 37 `proto-*` rows into `PLAYABLE_CHARACTERS` / `WHOLE_ART_CHARACTERS`, assigned every
  visual prototype the neutral Unwritten kit and non-gating bruiser lineage, and set
  `DEFAULT_CHARACTER = "proto-cowboy-hidden-face"`. `GameRoom` continues to import that generated shared
  default, so missing/invalid join selections now resolve to the no-thumb cowboy without a server-local
  duplicate.
- Removed the three stale whole-art envelope fractions tied to the replaced/retired sheets. The shipped
  geometry-derived whole-art envelope calculation handles all 37; `SpriteRig` and its 76 px body target
  were not changed.
- Migrated the old roster/default fixtures across client selection, menu, Arena fallback, SpriteRig
  envelope/idle-hand coverage, progression, and GameRoom join/cycle identity tests.

### Deterministic verification

- Focused character/rig/selection/server coverage: 9 files / 589 tests passed.
- Installed-pixel audit: 37 rigs / 222 parts / 2,230,443 visible pixels; `exactKey=0`, `keyable=0`, and
  `greenDominant=0`.
- `pnpm gen`: passed; emitted 77 playable characters (39 `cc-*`, 37 `proto-*`, and Drifter).
- `pnpm gen:check`: passed. Its only notices are the existing isolated-worktree skips for unavailable
  ignored weapon-reference scratch and non-prototype scale scratch.
- `pnpm assets:check`: passed with 470 sprite entries / 995 manifest parts / 635 atlas frames.
- `pnpm typecheck`: passed for shared, client, and server.
- Full `pnpm test`: passed 159 test files / 2,187 tests after restoring three ignored ArtKit test fixtures
  from the primary repository into this worktree's untracked scratch output.
- `git diff --check` passed. A raw-byte audit found no CRLF sequence in any of the 19 changed text files.
- No application live stack was booted.

### Files touched

- 111 intake assets: 37 raw, 37 keyed, and 37 preview PNGs.
- 234 character-part changes: 222 installed/replaced part PNGs plus 12 deleted legacy sheriff/witch parts.
- Two repacked atlas files: `packages/client/public/sprites/dd-sprites.json` and `.png`.
- Generated registration and roster outputs: sprite manifest, shared characters, shared lineage census, and
  developer portal.
- Installer/generator source: `harvest-install.mjs` and `gen-character-roster.mjs`.
- Runtime-adjacent cleanup: the stale envelope-fraction table and the Arena fallback comment only; no
  SpriteRig, render-scene behavior, menu implementation, gear, weapon, pet, or pose-language change.
- Nine deterministic test files and this implementation report.
- Total tracked/untracked worktree delta before commit: 365 files.

Verdict: 37 installed, 11 replaced-in-place, 21 brand-new, 2 legacy retired (proto-sheriff + proto-witch), new DEFAULT_CHARACTER `proto-cowboy-hidden-face`, roster size 37, files touched 365 (including 5 cowboy/hero-set fresh installs).
