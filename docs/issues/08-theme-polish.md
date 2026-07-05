# 08 — Theme polish & cinematic beats

**Type:** HITL (design review before merge) · **Covers:** PRD P8, §9.4–9.5

## What to build

Layer the noir motion/feedback and finalize the case-file voice across the whole app. This is the polish pass that turns a functional referee into *Bodies*.

- **Dramatic beats** (role reveal, body found, elimination, game over): cut-to-black transition → mono text **types in** → red **vignette/flicker** → **haptic buzz** (`navigator.vibrate`, best-effort; iOS Safari ignores). **No sound.**
- **Functional screens:** fast, calm fades only.
- **Lexicon + icons:** full case-file copy pass per §9.5, every semantic state/control pairing a **label + icon** (color is never the sole signal).
- **States:** in-theme empty / loading / error states.

Marked HITL: needs a human to eyeball the motion, contrast, and tone before merge.

## Acceptance criteria

- [ ] Beats implemented: cut-to-black, mono typewriter, vignette, haptics where supported; no sound.
- [ ] Functional screens use quick, calm fades only.
- [ ] Every semantic state/control uses a case-file label + icon; no color-only meaning.
- [ ] Copy matches the §9.5 lexicon (or an approved revision); consistent, no synonyms mid-game.
- [ ] Empty / loading / error states are styled in-theme.
- [ ] Human design-review sign-off obtained.

## Blocked by

- [05 — The trial loop](05-trial-loop.md)
