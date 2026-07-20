import type { OwnerNoteType } from "../input-routing.js";

export interface OwnerNoteContext {
  readonly type: OwnerNoteType;
  readonly activeSlot?: number;
  readonly weaponId?: string;
  readonly weaponName?: string;
}

interface OwnerNoteOverlayOptions {
  readonly onSubmit: (context: OwnerNoteContext, note: string) => void;
  readonly onClose: () => void;
}

/** A retained, accessible DOM textarea above Phaser's canvas. */
export class OwnerNoteOverlay {
  private root: HTMLDivElement | null = null;

  constructor(private readonly options: OwnerNoteOverlayOptions) {}

  isOpen(): boolean {
    return this.root !== null;
  }

  open(context: OwnerNoteContext): boolean {
    if (this.root) return false;

    const root = document.createElement("div");
    root.className = "owner-note-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "owner-note-title");
    root.innerHTML = `
      <section class="owner-note-bubble">
        <div class="owner-note-kicker">OWNER FIELD NOTES</div>
        <h2 id="owner-note-title"></h2>
        <div class="owner-note-context"></div>
        <textarea maxlength="2000" rows="9" spellcheck="true"></textarea>
        <div class="owner-note-error" aria-live="polite"></div>
        <footer>
          <span><kbd>Enter</kbd> save · <kbd>Shift+Enter</kbd> newline · <kbd>Esc</kbd> cancel</span>
          <div>
            <button type="button" data-action="cancel">Cancel</button>
            <button type="button" data-action="save" class="owner-note-save">Save note</button>
          </div>
        </footer>
      </section>`;

    const title = root.querySelector<HTMLHeadingElement>("h2");
    const contextLine = root.querySelector<HTMLDivElement>(".owner-note-context");
    const textarea = root.querySelector<HTMLTextAreaElement>("textarea");
    const error = root.querySelector<HTMLDivElement>(".owner-note-error");
    const save = root.querySelector<HTMLButtonElement>('[data-action="save"]');
    const cancel = root.querySelector<HTMLButtonElement>('[data-action="cancel"]');
    if (!title || !contextLine || !textarea || !error || !save || !cancel) {
      throw new Error("Owner-note controls failed to initialize");
    }

    title.textContent = context.type === "weapon" ? "WEAPON NOTE" : "GAME NOTE";
    contextLine.textContent =
      context.type === "weapon"
        ? `ACTIVE SLOT ${(context.activeSlot ?? 0) + 1} · ${context.weaponName ?? "Unknown weapon"} · ${context.weaponId ?? "unknown"}`
        : "TESTING GROUNDS · GENERAL GAMEPLAY";
    textarea.setAttribute("aria-label", context.type === "weapon" ? "Weapon note" : "Game note");
    textarea.placeholder =
      context.type === "weapon"
        ? "What did this weapon feel like? Capture balance, readability, bugs, or ideas…"
        : "Capture a gameplay observation, bug, balance thought, or follow-up…";

    const submit = (): void => {
      const note = textarea.value.trim();
      if (!note) {
        error.textContent = "Write a note before saving.";
        textarea.focus();
        return;
      }
      this.options.onSubmit(context, note);
      this.close();
    };
    textarea.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        this.close();
      } else if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        submit();
      }
    });
    save.addEventListener("click", submit);
    cancel.addEventListener("click", () => this.close());
    root.addEventListener("pointerdown", (event) => event.stopPropagation());
    document.body.appendChild(root);
    this.root = root;
    requestAnimationFrame(() => {
      if (this.root === root) textarea.focus();
    });
    return true;
  }

  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.options.onClose();
  }

  destroy(): void {
    this.close();
  }
}
