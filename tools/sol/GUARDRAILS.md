## Sol guardrails — the "do not fuck with" list

Locked 2026-07-28 after a session in which five separate batches each fixed a real defect and the
owner still could not walk in a straight line. Every rule below is a scar, not a preference: the
citation is what it cost. Paste this block verbatim into every Sol brief.

- **G1 — Never add a filter between prediction and the drawn root.** Five had accumulated: the
  authority leash, the presentation chase, the debt ledger, the root limiter, and camera weight. Each
  was defensible alone; together they WERE the warp, and each new one hid the previous. Adding another
  needs an owner ruling. Removing one is usually the fix.
  [Cost: b82, b83, b85, b87, plus four orchestrator patches. Resolved by DELETING a layer, not adding.]

- **G2 — A tolerance constant ships with a derivation or it does not ship.**
  `MAX_VISIBLE_OVERLAP_FRACTION = 0.32`, `edgeInsetPx = 48`, `bottomTrimFraction = 0.13`,
  `collisionLength = 118`. Every one silenced a failing check and quietly degraded the game — 32%
  platform overlap, two thirds of every floor unwalkable, 57.7 px of dead blade. If you cannot derive
  the number from a body radius, a speed, or a tick, you are hiding a bug behind it.

- **G3 — Art and hitbox never diverge silently.** If art scales, reach scales. A deliberate exception
  must be declared in a machine-checked list with its owner citation, and a test must fail when the
  exception stops being real. "Presentation-only" is not a licence to let the drawn edge lie.
  [Cost: the Dervish Greatblade shipped with a pre-resize hitbox for six days.]

- **G4 — No retry-then-throw where the game needs a guarantee.** Rejection sampling cannot guarantee
  an invariant; it can only fail late. Construct so the invariant holds by arithmetic, and degrade
  deterministically when construction is impossible. A live `throw` in generation is a crash path.

- **G5 — Never grade your own live verification.** "No browser available" is an acceptable report.
  Claiming a feature works without having seen it run is not, and it wasted a full owner test cycle
  twice. State plainly what you could not verify.

- **G6 — Never fix feel with easing, damping, or smoothing.** Canon L09/L10. Every smoothed thing
  became positional debt, and debt is repaid as a warp the player feels later. The transition is
  instant; what must not happen is EXTRA or WITHHELD distance.

- **G7 — Assume the merge dropped your call site.** A merge can keep your new module and restore the
  old caller, and the suite stays green because unit tests drive the module directly. Pin call sites
  as literal source strings so the seam cannot rot silently.
  [Cost: b83's fix was inert in the owner's build; found only when a later batch re-derived it.]

- **G8 — Aggregates cannot see single-frame events.** A min/max/mean metric read all-green through a
  visible 48 px pop. Any diagnostic you build needs per-frame capture of the raw quantity, not just
  summary statistics.

- **G9 — HARD NO-TOUCH.** Canon L09/L10/L11; the B42 plausibility envelope; b83's frame-sampled input
  path; b90's two lava invariants (no touching surfaces, every edge jumpable);
  `data/weapon-concepts-300.json`; the walkability painter. Changing any of these requires an explicit
  owner order quoted in the brief.

- **G10 — Follow the evidence over the brief's hypothesis.** Briefs state a suspected cause to save
  you time, not to fix your conclusion. b87 and b91 both refuted their brief's hypothesis and were
  right to. Say so plainly in the report when you do.
