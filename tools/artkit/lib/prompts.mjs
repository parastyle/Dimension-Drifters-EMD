// artkit/lib/prompts.mjs — game-agnostic ticket builders. A "subject" is the
// only input shape the pipeline knows about:
//
//   { id: string,            // slug, used for output paths
//     name: string,          // display name
//     prompt: string,        // freeform "what this thing looks like / does"
//     palette?: { primary?: string, accent?: string },  // SOFT colour hint
//     tags?: string[],       // optional flavour tags (forest, undead, gun…)
//     cardartAction?: string,// optional explicit action pose for the cardart
//     feedback?: string[] }  // optional revision notes to fold in on a redo
//
// Nothing here references cards, decks, commanders, elements, or any game.

/** Build the project-style canon block shared by every ticket. */
function styleCanon(style) {
  return [
    "## Project style canon",
    "",
    style.styleBlock,
    "",
    `OUTLINES — ${style.outlineGuidance}`,
    "",
    `SHADING — ${style.shadingGuidance}`,
    "",
    `HARD AVOID: ${style.avoidList.join("; ")}.`,
  ].join("\n");
}

const CHAT_ISOLATION = (id) =>
  `# CHAT-ISOLATION REQUIREMENT — READ FIRST

This ticket targets ONE entity: \`${id}\`.

Image-generation models silently carry visual concepts across turns in the same chat. To prevent contamination:
1. Process exactly ONE ticket per Codex chat. If you have already generated images for any other entity in this chat, STOP and open a fresh chat.
2. Disregard ALL prior visual context from earlier in this chat.`;

function feedbackBlock(feedback) {
  if (!feedback?.length) return "";
  return `\n## ⚠ USER FEEDBACK (must address)\n\nThe previous version was flagged. Address each note SPECIFICALLY — do NOT just regenerate from the same prompt:\n${feedback
    .map((f) => `- > ${String(f).trim().replace(/\n/g, "\n  > ")}`)
    .join("\n")}\n`;
}

/** Phase 0 — generate N identity-ref CANDIDATES (the "reference": subject
 *  alone on transparency). Human picks one → identity-ref.png. */
export function buildReferenceTicket(subject, style, candidateCount = 3, styleRefAttached = false, variant = null) {
  const isVfx = subject.kind === "vfx";
  const palette = subject.palette
    ? `\n## Palette (soft influence)\n- Primary: ${subject.palette.primary ?? "(none)"}\n- Accent: ${subject.palette.accent ?? "(none)"}\n`
    : "";
  const tags = subject.tags?.length ? `\n## Tags\n${subject.tags.map((t) => `\`${t}\``).join(", ")}\n` : "";

  // Reference-image-driven generation (the #1 AI-consistency lever). For a VFX, Image 1 is the
  // SOURCE WEAPON (the effect inherits its palette + material); otherwise it's the house anchor.
  const styleRefBlock = !styleRefAttached
    ? ""
    : isVfx
      ? "\n## ⭐ SOURCE WEAPON — Image 1 (the weapon that PRODUCES this effect)\nImage 1 is the weapon that makes this VFX. The effect must look like it BELONGS to this weapon: reuse its PALETTE and its MATERIAL (stone / metal / wood / bone), plus the game's rendering language (outline weight, flat-cel discipline, grime). This is the impact/energy THIS weapon throws — NOT a generic effect. Do NOT draw the weapon itself; draw ONLY the effect it produces.\n"
      : "\n## ⭐ HOUSE-STYLE REFERENCE — Image 1 (MATCH ITS RENDERING EXACTLY)\nImage 1 is the LOCKED Dimension Drifters house-style anchor (an approved finished asset). Your output MUST match its rendering language EXACTLY: outline weight + hand-drawn unevenness, flat-cel shadow/highlight discipline, palette + saturation + grime level, and the limbless construction language (compact body + detached blob hands & feet). Render it as if drawn by the SAME hand for the SAME game. Do NOT copy Image 1's specific design, costume, hat, or colours — render the DIFFERENT subject described below; only the STYLE is shared.\n";

  const renderRules = isVfx ? style.vfxRenderRules : style.identityRefRenderRules;

  // A VFX is GROUND (top-down slam/pool/decal) or DIRECTIONAL (side-on slash/spray/beam). Directional
  // effects FACE RIGHT like every weapon/character (`vfxOrientation` defaults to "right"); ground
  // effects are seen from above (set `vfxOrientation: "ground"`).
  const vfxOrient = subject.vfxOrientation || "right";
  const orientationBlock = !isVfx
    ? `
## ⛔ ORIENTATION — NON-NEGOTIABLE. VERIFY ON EVERY CANDIDATE BEFORE RETURNING.

EVERYTHING in this game faces **RIGHT**. This is the single most-violated rule — check it explicitly on each take.
- **WEAPONS / PROPS:** flat orthographic SIDE-PROFILE (no perspective, no tilt, no 3/4). The **BUSINESS END points RIGHT** — blade tip, spear/pick/spike point, gun/cannon/launcher MUZZLE, axe/cleaver edge, staff head/crown/orb. The **grip / handle / haft / stock / pommel sits on the LEFT.**
- **CHARACTERS / ENEMIES:** true side-profile **facing RIGHT**, looking ACROSS the frame — NEVER toward the camera/viewer.
- If a draft faces LEFT or angles toward the viewer, **MIRROR or REDRAW it to face RIGHT** before returning it. Do not return a left-facing or front-facing subject.
`
    : vfxOrient === "ground"
      ? `
## ⛔ ORIENTATION — TOP-DOWN GROUND PLANE
This is a FLOOR effect (slam / crater / pool / decal) seen from **straight above**, radiating outward from a central impact point. It composites onto the arena floor at runtime — no horizon, no side-on perspective. Keep it on the empty #00ff00 chroma per the render rules.
`
      : `
## ⛔ ORIENTATION — THE EFFECT FACES RIGHT (NON-NEGOTIABLE — match the weapon)
This effect is swung / fired / thrown by a weapon that points **RIGHT**, so the effect points RIGHT too. Render it flat **side-on, no tilt, no 3/4**, with its **direction of travel / leading edge / open side pointing RIGHT**:
- a **slash crescent** sweeps through the air with its arc **opening toward the RIGHT** (the bright leading edge on the right, the tail trailing to the left);
- a **muzzle flash / spray / spark** blasts **toward the RIGHT**;
- a **beam / bolt** fires **toward the RIGHT**.
If a take points LEFT, **MIRROR it to point RIGHT** before returning. (You can re-orient an old effect to any swing angle later with the Weaponsmith's 15° rotation tool — but the SOURCE art is always authored facing RIGHT.)
`;

  // VFX takes must each be a SEPARATE standalone image — the #1 failure mode is the model packing
  // the N variations into ONE tiled grid / contact-sheet (then only 1 file harvests). When `variant`
  // is set the caller is generating ONE take per run (the robust path), so we ask for a single image.
  const antiGrid = "\n\nCRITICAL OUTPUT FORMAT: return the effect as a SINGLE standalone image on empty #00ff00 chroma. Do NOT tile, grid, montage, collage, or contact-sheet multiple takes into one image, and do NOT add panels, borders, labels, or captions.";
  const task = isVfx
    ? variant
      ? `Generate ONE candidate VFX PNG — a single standalone take on this effect, matching the game style + the source weapon (Image 1). ${variant} ONLY the effect — no weapon, no character, no scene, no frame.${antiGrid}`
      : `Generate ${candidateCount} candidate VFX PNGs as ${candidateCount} SEPARATE image files — ${candidateCount} DRAMATICALLY DIFFERENT takes on this same effect (vary the shape, density, spread, and energy from one to the next), all matching the game style + the source weapon (Image 1). ONLY the effect — no weapon, no character, no scene, no frame.${antiGrid}`
    : `Generate ${candidateCount} candidate identity-ref PNGs — ${candidateCount} takes that ALL match the house style${styleRefAttached ? " (Image 1)" : ""}, varying only this subject's pose + proportion interpretation. ONLY identity-ref candidates; no scene, no card frame.`;

  return `${CHAT_ISOLATION(subject.id)}

# Phase 0: ${isVfx ? "VFX effect" : "Reference candidate"} generation

Entity: ${subject.id} (${subject.name})
Asset: ${isVfx ? "a VFX EFFECT skin — the visual effect this weapon/action produces, mid-action, alone on chroma." : "the canonical identity reference — what this character/creature/object IS, at rest, alone on void."}
${styleRefBlock}${feedbackBlock(subject.feedback)}
${styleCanon(style)}

## Subject description (use exactly)

${subject.prompt}
${palette}${tags}
## Render rules (CRITICAL)

${renderRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}
${orientationBlock}
## Task

${task}
`;
}

/** Deterministic small hash → archetype index (same subject → same backdrop). */
function stableHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build the weighted archetype pool once (elaborate-scene is over-weighted
 *  so ~1 in N subjects gets a full painted scene instead of a flat backdrop). */
function archetypePool(style) {
  const pool = [];
  for (const a of style.bgArchetypes) {
    const w = a.id === "elaborate-scene" ? style.elaborateSceneWeight ?? 12 : 1;
    for (let i = 0; i < w; i++) pool.push(a);
  }
  return pool;
}

/** Phase 0.5 — the CARD ART: subject (from its picked identity-ref) in an
 *  action pose, single-render, popping off a complementary backdrop. The
 *  backdrop archetype is chosen deterministically for per-subject variety. */
export function buildCardartTicket(subject, style) {
  const pool = archetypePool(style);
  const archetype = pool[stableHash(subject.id) % pool.length];
  const isWeapon = subject.tags?.includes("weapon");
  const noun = isWeapon ? "weapon" : "subject";
  const action =
    subject.cardartAction ||
    `pick a pose that matches the subject's flavor: "${subject.prompt.slice(0, 200).replace(/"/g, "'")}"`;
  const palette = subject.palette
    ? `\n## Palette (SOFT influence — lock the real palette to the identity-ref image, not to these)\n- Primary: ${subject.palette.primary ?? "(none)"}\n- Accent: ${subject.palette.accent ?? "(none)"}\n`
    : "";
  // The card MUST depict the EXACT same object as the picked weapon/identity-ref — the #1 card-art
  // failure is the model "reinterpreting" the weapon into a generic look-alike (e.g. the Tombstone
  // Greatsword card dropping its R.I.P. engraving + rebar guard). This block forces 1:1 adherence.
  const adherenceBlock = `## ⛔ MATCH IMAGE 1 EXACTLY — THIS IS THE #1 RULE
Image 1 is the **EXACT, canonical ${noun}** this card depicts (the selected art). The card MUST show the **IDENTICAL ${noun}** — same silhouette, shape, proportions, parts, materials, colours, and EVERY distinguishing detail. ${
    isWeapon
      ? "For this weapon, reproduce its **blade/head shape, cross-guard, grip/haft wrap, pommel, rivets, weathering, AND any engraved letters, numbers, words, or symbols** (e.g. an \"R.I.P.\", roman numerals, a brand sigil) — copy them faithfully."
      : "Reproduce its build, costume, markings, and features faithfully."
  } You may **only** (a) render it larger and mid-action, (b) add motion/energy, and (c) place it on the background below. Do **NOT** redesign, restyle, simplify, swap, or "improve" it — a player must INSTANTLY recognise it as the SAME ${noun} they see in-world. If in doubt, copy Image 1 more literally.

`;
  return `${CHAT_ISOLATION(subject.id)}

# Phase 0.5: Card art (single-render with painted background)

Entity: ${subject.id} (${subject.name})
Input — Image 1: the locked identity-ref — **the EXACT ${noun} this card depicts** (defines who/what this is, down to every detail).
${feedbackBlock(subject.feedback)}
${adherenceBlock}${styleCanon(style)}

## What we are making

ONE cohesive **PORTRAIT, full-bleed** card-art render: the subject in an ACTION POSE on a custom background designed AROUND them so the character POPS, not blends in. NOT a composite of two pre-made images — render the whole thing at once so palette + lighting + atmosphere are cohesive.

## Composition direction — FULL-BLEED PORTRAIT (a trading-card illustration)

- **Tall 3:4-ish PORTRAIT** orientation. The art is **FULL-BLEED**: it fills the frame edge-to-edge with NO border, NO margin, NO frame, NO rounded corners, NO drop-shadow box — the illustration bleeds off all four sides.
- The subject sits **large and clear in the UPPER-CENTRE / top half**, at full display (the hero of the image), with the background bleeding out behind and below it.
- **Keep the LOWER THIRD visually CALMER** — a darker, simpler, less-busy zone (ground haze, shadow, gradient-to-dark, depth). A semi-transparent UI INFO PANEL is composited over that lower third in-game, so it must not bury critical detail there. Do NOT put text, frames, or UI in the image yourself — that's added in-engine.

The ${noun} from Image 1 (kept IDENTICAL per the match-rule above) is mid-ACTION — ${action}. The pose should imply MOTION.

${style.cardartRenderRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Background — use THIS archetype (assigned for variety)

**\`${archetype.id}\`**: ${archetype.description}

Build the backdrop AROUND the character per the rules above. Do NOT default every subject to atmospheric haze — this one is specifically the **${archetype.id}** treatment.

## Color theory — character POPS off the bg

Derive the character's palette from the IDENTITY-REF (Image 1) — what colour is this specific subject actually drawn in? The background uses COMPLEMENTARY tones at LOWER saturation so the character is the brightest, loudest element in the frame. (Slate-blue character → warm amber/violet bg; red → teal; yellow → cobalt; green → magenta; bone-white → saturated red/blue; etc.)
${palette}
## Task

Generate ONE **PORTRAIT** card-art PNG at **1024x1536 (tall 2:3)** from the identity-ref (Image 1) as the sole character reference. FULL-BLEED (art to all edges, no frame/border), subject large in the upper-centre, lower third kept calm for the in-engine info overlay. A single cohesive render — NOT a composite. Do NOT generate reference candidates or alternate poses; ONLY the one card-art image.
`;
}
