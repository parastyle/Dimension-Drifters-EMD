import {
  BLADE_EXTENSION_LENGTH_MULTIPLIER,
  BLADE_EXTENSION_OVERLAP_FRACTION,
  type BladeExtensionGeometry,
  bladeExtensionGeometryFor,
  bladeExtensionReveal,
  SANCTIFIED_HEADSMAN_ID,
  type SwingDescriptor,
  WEAPONS,
  type WeaponDef,
} from "@dd/shared";

export { SANCTIFIED_HEADSMAN_ID };
export const SANCTIFIED_HEADSMAN_LENGTH_MULTIPLIER = BLADE_EXTENSION_LENGTH_MULTIPLIER;
/** The extension roots inside the outer 30% of the physical blade; the real sprite masks this join. */
export const SANCTIFIED_HEADSMAN_BLADE_OVERLAP_FRACTION = BLADE_EXTENSION_OVERLAP_FRACTION;

export interface HeadsmanPrototype {
  readonly proto: 1 | 2 | 3 | 4;
  readonly name: string;
  readonly designIntent: string;
  readonly textureKey: string;
  readonly url: string;
}

export const HEADSMAN_PROTOTYPES = Object.freeze([
  Object.freeze({
    proto: 1,
    name: "Radiant Verdict",
    designIntent: "A solid ivory-gold execution edge with the heaviest, clearest material read.",
    textureKey: "headsman-proto:1",
    url: "vfx/headsman-prototypes/radiant-verdict.png",
  }),
  Object.freeze({
    proto: 2,
    name: "Pale Procession",
    designIntent: "A curved champagne ghost-blade with a weightless spectral body.",
    textureKey: "headsman-proto:2",
    url: "vfx/headsman-prototypes/pale-procession.png",
  }),
  Object.freeze({
    proto: 3,
    name: "Woven Litany",
    designIntent: "Braided prayer-light and motes weave themselves into a cutting silhouette.",
    textureKey: "headsman-proto:3",
    url: "vfx/headsman-prototypes/woven-litany.png",
  }),
  Object.freeze({
    proto: 4,
    name: "Cathedral Ruin",
    designIntent: "A jagged leaded stained-glass blade with amber, ruby, and cobalt panes.",
    textureKey: "headsman-proto:4",
    url: "vfx/headsman-prototypes/cathedral-ruin.png",
  }),
] as const satisfies readonly HeadsmanPrototype[]);

export const SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT = HEADSMAN_PROTOTYPES[1];

/** Dev grammar: `?dev=weapon:x2-sanctified-headsman&proto=1..4`, or the hash form `#p1..4` —
 * the hash survives chat/link handlers that strip second query parameters. These references are dev-only;
 * invalid/missing values resolve to the shipped Pale Procession treatment. */
let devCycleOverride: string | null = null;

/** Production is locked to Pale Procession; URL/hash selection survives only in dev builds. */
export function resolveHeadsmanTreatment(
  search: string,
  hash: string,
  devMode: boolean,
  cycleOverride: string | null = devCycleOverride,
): HeadsmanPrototype {
  if (!devMode) return SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT;
  const fromHash = /^#p([1-4])$/.exec(hash)?.[1];
  const raw = cycleOverride ?? fromHash ?? new URLSearchParams(search).get("proto");
  const proto = Number(raw);
  return (
    HEADSMAN_PROTOTYPES.find((candidate) => candidate.proto === proto) ??
    SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT
  );
}

export function headsmanPrototypeFromSearch(search: string, hash = ""): HeadsmanPrototype {
  return resolveHeadsmanTreatment(search, hash, import.meta.env.DEV);
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "p" && event.key !== "P") return;
    const target = event.target as HTMLElement | null;
    // Never steal the key from note bubbles or other text inputs.
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const current = Number(
      devCycleOverride ?? String(SANCTIFIED_HEADSMAN_PRODUCTION_TREATMENT.proto),
    );
    const next = current >= 4 || current < 1 ? 1 : current + 1;
    devCycleOverride = String(next);
    const chosen = HEADSMAN_PROTOTYPES[next - 1] ?? HEADSMAN_PROTOTYPES[0];
    let toast = document.getElementById("headsman-proto-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "headsman-proto-toast";
      toast.style.cssText =
        "position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:9999;" +
        "background:rgba(15,12,20,.92);color:#e8d9a8;border:1px solid #6b5a33;" +
        "padding:10px 18px;border-radius:8px;font:600 15px system-ui;pointer-events:none";
      document.body.appendChild(toast);
    }
    toast.textContent = `HEADSMAN DEV TREATMENT ${next} — ${chosen.name} (P to cycle)`;
    toast.style.opacity = "1";
    clearTimeout((toast as HTMLElement & { hideTimer?: number }).hideTimer);
    (toast as HTMLElement & { hideTimer?: number }).hideTimer = window.setTimeout(() => {
      toast.style.opacity = "0";
    }, 2600);
  });
}

export type HeadsmanExtensionGeometry = BladeExtensionGeometry;

/** The magic starts beneath the outer physical blade and still ends at the exact 3x visual endpoint.
 * Compatibility name retained for prototype tests; live client and server call the shared law directly. */
export function headsmanExtensionGeometry(weapon: WeaponDef): HeadsmanExtensionGeometry {
  const geometry = bladeExtensionGeometryFor(weapon);
  if (!geometry) throw new Error(`Weapon ${weapon.id} has no shared blade-extension envelope`);
  return geometry;
}

/** Lengthen through the end of wind-up, then hold the full 3x blade across the damage sweep. Starting the
 * growth before the often-brief active edge makes the mechanism visible even at low frame cadence. All
 * prototypes use this exact clock so owner comparison is treatment-only. */
export function headsmanExtensionReveal(
  swing: Pick<SwingDescriptor, "activeStartSeconds" | "activeEndSeconds" | "comboStep" | "motion">,
  elapsedSeconds: number,
): number {
  const weapon = WEAPONS[SANCTIFIED_HEADSMAN_ID];
  if (!weapon) return 0;
  return bladeExtensionReveal(weapon, swing, elapsedSeconds);
}
