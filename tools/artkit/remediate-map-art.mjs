#!/usr/bin/env node
// Quantitative map-art remediation wave. Jobs are intentionally ordered to
// match docs/mapqol-panel/art-qa.md. Raw renders are stable and resumable;
// installed assets always pass through deterministic Sharp post-processing.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";
import { installGeneratedCutout, normalizeRim, normalizeTileFamily } from "./lib/map-art-processing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const PUBLIC = resolve(REPO, "packages/client/public");
const OUT = resolve(here, "out/map-art-remediation");
const RENDERS = resolve(OUT, "renders");
mkdirSync(RENDERS, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (message) => console.log(message) });

const terrainPrompt = (request, rim = false) => `Generate an image: an identity-preserving EDIT / clean
re-render of the attached original map-art asset.
Use case: stylized-concept
Asset type: ${rim ? "horizontally tileable game pit-rim texture" : "seamless square game-floor texture"}
Input image: Image 1 is the identity, material, palette, rendering-style, and composition reference.
Primary request: ${request}
Style/medium: preserve the original HD painted/cel-shaded game-art treatment and restrained contrast.
Composition: ${rim ? "wide top-down 4:1 rim strip" : "square, directly overhead orthographic ground texture"}.
Constraints: keep the same biome and material identity; keep luminance/chroma uniform through the outer 10%;
no vignette, directional lighting gradient, border, text, objects, characters, or watermark; no large feature
may enter the outer 10% unless it continues toroidally through the exact opposite edge. ${rim ? "Left and right lip height, wall depth, material, and abyss value must continue exactly." : "Left/right and top/bottom must tile seamlessly."}`;

const cutoutPrompt = ({ subject, request, key = "#00ff00" }) => `Generate an image: an identity-preserving
EDIT / clean re-render of the attached original game cutout.
Use case: precise-object-edit
Asset type: high-3/4 top-down game landmark cutout
Input image: Image 1 is the identity reference. Preserve its recognizable subject, silhouette family,
materials, palette, HD cel-shaded rendering, and thick dark outline treatment.
Subject: ${subject}.
Primary request: ${request}
Scene/backdrop: a perfectly flat solid ${key} chroma-key field for local background removal.
Composition: one complete isolated landmark, high 3/4 view, full physical base in frame, one explicit base
footline centered at the bottom, generous empty padding on every side.
Constraints: isolated physical object only; absolutely no cast shadow, contact shadow, painted ground patch,
snow/dirt/moss/soot floor, glow pool, reflection, or ambient occlusion outside the physical base. The backdrop
must be one uniform color with no texture, gradient, floor plane, lighting variation, or shadow. Crisp complete
silhouette; do not use ${key} in the subject; no extra object, text, logo, border, or watermark.`;

const terrainJobs = [
  [1, "tiles/neon-cyber/tile-3.png", "Quiet top-down rain-slick composite. Match the kit's common gunmetal edge palette; remove neon/luminance drift at the perimeter; no border panel or directional reflection."],
  [2, "tiles/neon-cyber/tile-0.png", "Quiet gunmetal base with the same perimeter luminance/chroma as the Neon family; no border panels or directional edge reflection."],
  [3, "tiles/wild-west/tile-2.png", "Sparse pebbles and grass only in the interior. The perimeter is quiet hardpan matching tile-0 in value and hue; no cut pebble or grass at an edge."],
  [4, "tiles/wild-west/tile-0.png", "Uniform quiet hardpan perimeter shared by the Wild West family; no wind gradient or vignette."],
  [5, "tiles/frostfell/tile-3.png", "Confine hoarfrost detail away from the boundary. Match the quiet ice-base edge value/chroma; no directional frost plume at an edge."],
  [6, "tiles/frostfell/tile-1.png", "Calm glacial ice with a uniform shared perimeter and no broad edge brightness shift."],
  [7, "tiles/wild-west/rim.png", "Horizontally toroidal mesa lip. Left/right earth, crack, lip height, wall depth, and abyss value continue exactly; no unique debris in the outer 10%."],
  [8, "tiles/verdant-ruins/rim.png", "Horizontally toroidal mossy masonry lip. No vine or root begins or ends at a canvas edge; identical left/right wall depth and value."],
  [9, "tiles/frostfell/tile-2.png", "Keep cracks away from the boundary or continue them toroidally; uniform snow/ice balance through the perimeter."],
  [10, "tiles/verdant-ruins/tile-1.png", "Interior-only flagstone accents with a shared moss/stone perimeter; no seam or joint terminates at an edge."],
  [11, "tiles/ashlands/tile-1.png", "Confine ropey lava detail to the interior. The perimeter is neutral packed ash matching tile-2; no ember line reaches an edge."],
  [12, "tiles/ashlands/tile-2.png", "Neutral packed-ash perimeter shared with tile-1; ember cracks stay interior and low contrast."],
].map(([priority, path, request]) => ({ priority, path, request, rim: path.endsWith("rim.png") }));

const propJobs = [
  {
    priority: 13,
    path: "pois/neon-cyber/poi-neon-cyber-03.png",
    subject: "a full readable rooftop holo-billboard tower, not a cropped sign sliver",
    request: "Recover a complete high-3/4 landmark with its support tower and centered physical base; no chroma residue or underpaint.",
    width: 220,
    height: 280,
    contactX: 110,
    contactY: 275,
  },
  {
    priority: 14,
    path: "pois/ashlands/poi-ashlands-00.png",
    subject: "the same squat jagged black obsidian crystal spire cluster",
    request: "Preserve the recognizable obsidian silhouette and physical basal rocks only; remove every painted ground/contact/cast shadow.",
    width: 191,
    height: 280,
    contactX: 96,
    contactY: 276,
  },
  {
    priority: 15,
    path: "pois/ashlands/poi-ashlands-02.png",
    subject: "the same squat dormant charcoal fumarole cone with a small intrinsic smoke wisp",
    request: "Preserve the cone and attached physical rocks; remove the soot ground patch and all painted shadow; use one clear centered footline.",
    width: 280,
    height: 263,
    contactX: 140,
    contactY: 258,
  },
  {
    priority: 16,
    path: "pois/neon-cyber/poi-neon-cyber-00.png",
    subject: "the same tall industrial holo-billboard machinery tower with magenta panels",
    request: "Keep the machinery landmark isolated with a complete support base; remove underpaint, glow pool, AO, contact shadow, and cast shadow.",
    width: 169,
    height: 280,
    contactX: 85,
    contactY: 276,
  },
  {
    priority: 17,
    path: "pois/frostfell/poi-frostfell-01.png",
    subject: "the same leaning frozen pine with snow and ice physically attached to its branches and roots",
    request: "Give the tree a visually explicit physical root base and footline; remove the surrounding snow-floor patch and every painted shadow.",
    width: 148,
    height: 280,
    contactX: 74,
    contactY: 276,
  },
  {
    priority: 18,
    path: "pois/poi-00.png",
    subject: "the same tall leafless weathered Wild West dead tree",
    request: "Keep the trunk, branches, and physical roots; fully expose and center the base; remove surrounding dirt and every painted shadow.",
    width: 135,
    height: 280,
    contactX: 68,
    contactY: 274,
  },
  {
    priority: 19,
    path: "pois/verdant-ruins/poi-verdant-ruins-04.png",
    subject: "the same strangler-fig tree physically devouring a broken mossy ruin wall",
    request: "Keep roots that physically belong to the tree/wall; remove the surrounding moss floor and every shadow; create one clear centered anchor footline.",
    key: "magenta",
    keyHex: "#ff00ff",
    width: 280,
    height: 263,
    contactX: 140,
    contactY: 258,
  },
  {
    priority: 20,
    path: "pois/neon-cyber/poi-neon-cyber-06.png",
    subject: "the same collapsed rusted industrial crane with yellow machinery housing and truss boom",
    request: "Keep only the complete crane and its actual support feet; no ground glow or shadow; center the physical support base on the declared anchor.",
    width: 280,
    height: 268,
    contactX: 110,
    contactY: 264,
  },
];

const decalJob = {
  priority: 21,
  path: "decals/ashlands/decal-ashlands-04.png",
  subject: "the same irregular flat sulfur-crust material patch",
  request: "Make the sulfur muted ochre/grey rather than self-lit yellow. It is intrinsic flat staining only: no object-like outline, no contact/cast shadow, no glow, no floor plane.",
  width: 132,
  height: 94,
  contactX: 66,
  contactY: 89,
};

const phase = process.argv.find((arg) => arg.startsWith("--phase="))?.slice(8) ?? "all";
const fromPriority = Number(process.argv.find((arg) => arg.startsWith("--from="))?.slice(7) ?? 1);
const toPriority = Number(process.argv.find((arg) => arg.startsWith("--to="))?.slice(5) ?? 999);
const selected = (job) => job.priority >= fromPriority && job.priority <= toPriority;
const wantsTerrain = phase === "all" || phase === "terrain";
const wantsProps = phase === "all" || phase === "props";

async function render(job, prompt) {
  const target = resolve(PUBLIC, job.path);
  const safe = job.path.replaceAll("/", "--").replace(/\.png$/i, "");
  const raw = resolve(RENDERS, `${String(job.priority).padStart(2, "0")}--${safe}.png`);
  if (!existsSync(raw)) {
    console.log(`RENDER P${job.priority} ${job.path}`);
    const code = await runCodexExec({
      label: `map-art-p${job.priority}-${safe}`,
      cwd: REPO,
      prompt,
      images: [target],
      harvestTo: raw,
      stdoutFile: resolve(RENDERS, `${String(job.priority).padStart(2, "0")}--${safe}.log`),
    });
    if (!existsSync(raw)) throw new Error(`P${job.priority} produced no image (Codex exit ${code})`);
  } else {
    console.log(`RESUME P${job.priority} ${job.path}`);
  }
  return { raw, target };
}

if (wantsTerrain) {
  for (const job of terrainJobs.filter(selected)) {
    const { raw, target } = await render(job, terrainPrompt(job.request, job.rim));
    await sharp(raw)
      .resize(job.rim ? 1024 : 512, job.rim ? 256 : 512, { fit: "cover" })
      .removeAlpha()
      .png()
      .toFile(target);
    console.log(`INSTALLED P${job.priority} ${job.path}`);
  }

  const edgeBases = { "wild-west": 0, frostfell: 1, "verdant-ruins": 0, ashlands: 2, "neon-cyber": 0 };
  for (const [theme, edgeBase] of Object.entries(edgeBases)) {
    const files = [0, 1, 2, 3].map((index) => resolve(PUBLIC, `tiles/${theme}/tile-${index}.png`));
    await normalizeTileFamily({ files, baseFile: files[edgeBase], strip: 32 });
    await normalizeRim(resolve(PUBLIC, `tiles/${theme}/rim.png`), 32);
    console.log(`NORMALIZED ${theme} tile family + rim`);
  }
}

if (wantsProps) {
  for (const job of [...propJobs, decalJob].filter(selected)) {
    const key = job.key ?? "green";
    const keyHex = job.keyHex ?? "#00ff00";
    const { raw, target } = await render(job, cutoutPrompt({ subject: job.subject, request: job.request, key: keyHex }));
    const validation = await installGeneratedCutout({
      raw,
      target,
      width: job.width,
      height: job.height,
      contactX: job.contactX,
      contactY: job.contactY,
      key,
      margin: 4,
      alignContact: job.path.startsWith("pois/"),
    });
    console.log(`INSTALLED P${job.priority} ${job.path} ${validation.width}x${validation.height} margins=${validation.margins.join("/")}`);
  }
}

console.log(`map-art remediation phase ${phase}: complete`);
