import { MELEE_TWO_HAND_GRIP_REACH, type SwingDescriptor, type WeaponDef } from "@dd/shared";

export const SANCTIFIED_HEADSMAN_ID = "x2-sanctified-headsman";
export const SANCTIFIED_HEADSMAN_LENGTH_MULTIPLIER = 3;

export interface HeadsmanPrototype {
  readonly proto: 1 | 2 | 3 | 4;
  readonly name: string;
  readonly designIntent: string;
  readonly textureKey: string;
  readonly url: string;
  readonly thicknessScale: number;
}

export const HEADSMAN_PROTOTYPES = Object.freeze([
  Object.freeze({
    proto: 1,
    name: "Radiant Verdict",
    designIntent: "A solid ivory-gold execution edge with the heaviest, clearest material read.",
    textureKey: "headsman-proto:1",
    url: "vfx/headsman-prototypes/radiant-verdict.png",
    thicknessScale: 0.34,
  }),
  Object.freeze({
    proto: 2,
    name: "Pale Procession",
    designIntent: "A curved champagne ghost-blade with a weightless spectral body.",
    textureKey: "headsman-proto:2",
    url: "vfx/headsman-prototypes/pale-procession.png",
    thicknessScale: 0.32,
  }),
  Object.freeze({
    proto: 3,
    name: "Woven Litany",
    designIntent: "Braided prayer-light and motes weave themselves into a cutting silhouette.",
    textureKey: "headsman-proto:3",
    url: "vfx/headsman-prototypes/woven-litany.png",
    thicknessScale: 0.38,
  }),
  Object.freeze({
    proto: 4,
    name: "Cathedral Ruin",
    designIntent: "A jagged leaded stained-glass blade with amber, ruby, and cobalt panes.",
    textureKey: "headsman-proto:4",
    url: "vfx/headsman-prototypes/cathedral-ruin.png",
    thicknessScale: 0.4,
  }),
] as const satisfies readonly HeadsmanPrototype[]);

/** Dev grammar: `?dev=weapon:x2-sanctified-headsman&proto=1..4`, or the hash form `#p1..4` —
 * the hash survives chat/link handlers that strip second query parameters. Invalid/missing values
 * use proto 1 strictly as a review placeholder; this does not declare an owner-selected winner. */
export function headsmanPrototypeFromSearch(search: string, hash = ""): HeadsmanPrototype {
  const fromHash = /^#p([1-4])$/.exec(hash)?.[1];
  const raw = devCycleOverride ?? fromHash ?? new URLSearchParams(search).get("proto");
  const proto = Number(raw);
  return (
    HEADSMAN_PROTOTYPES.find((candidate) => candidate.proto === proto) ?? HEADSMAN_PROTOTYPES[0]
  );
}

/** Dev-only live cycle: the owner's chat client strips URL queries entirely, so P cycles the
 * prototype in-game instead. Holds the last choice for the session; null defers to the URL. */
let devCycleOverride: string | null = null;

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "p" && event.key !== "P") return;
    const target = event.target as HTMLElement | null;
    // Never steal the key from note bubbles or other text inputs.
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const current = Number(devCycleOverride ?? "0");
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
    toast.textContent = `HEADSMAN PROTOTYPE ${next} — ${chosen.name} (P to cycle)`;
    toast.style.opacity = "1";
    clearTimeout((toast as HTMLElement & { hideTimer?: number }).hideTimer);
    (toast as HTMLElement & { hideTimer?: number }).hideTimer = window.setTimeout(() => {
      toast.style.opacity = "0";
    }, 2600);
  });
}

export interface HeadsmanExtensionGeometry {
  readonly physicalBladeLength: number;
  readonly totalBladeLength: number;
  readonly extensionLength: number;
  readonly extensionStart: number;
}

/** One geometry law shared by all four treatments: the magic starts at the physical tip and makes the
 * total visible blade exactly 3x the physical blade length. It is visual-only; authoritative range is
 * deliberately unchanged pending the owner's reach decision. */
export function headsmanExtensionGeometry(weapon: WeaponDef): HeadsmanExtensionGeometry {
  const physicalBladeLength = Math.max(1, (1 - weapon.gripFrac) * weapon.displayLength);
  const totalBladeLength = physicalBladeLength * SANCTIFIED_HEADSMAN_LENGTH_MULTIPLIER;
  return {
    physicalBladeLength,
    totalBladeLength,
    extensionLength: totalBladeLength - physicalBladeLength,
    extensionStart: (weapon.twoHanded ? MELEE_TWO_HAND_GRIP_REACH : 0) + physicalBladeLength,
  };
}

/** Lengthen through the end of wind-up, then hold the full 3x blade across the damage sweep. Starting the
 * growth before the often-brief active edge makes the mechanism visible even at low frame cadence. All
 * prototypes use this exact clock so owner comparison is treatment-only. */
export function headsmanExtensionReveal(
  swing: Pick<SwingDescriptor, "activeStartSeconds" | "activeEndSeconds">,
  elapsedSeconds: number,
): number {
  const activeSeconds = swing.activeEndSeconds - swing.activeStartSeconds;
  if (activeSeconds <= 0 || elapsedSeconds >= swing.activeEndSeconds) return 0;
  const growSeconds = Math.min(swing.activeStartSeconds, Math.max(0.08, activeSeconds * 0.45));
  const growStartSeconds = swing.activeStartSeconds - growSeconds;
  if (elapsedSeconds < growStartSeconds) return 0;
  if (elapsedSeconds >= swing.activeStartSeconds || growSeconds <= 0) return 1;
  const progress = (elapsedSeconds - growStartSeconds) / growSeconds;
  return progress * progress * (3 - 2 * progress);
}
