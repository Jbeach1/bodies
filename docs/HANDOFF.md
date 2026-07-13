# Handoff — Bodies

**Purpose:** kick off implementation of the sliced issues next session.
**Written:** 2026-07-05

## Where things stand

Brand-new repo (`C:\GIT\bodies`, branch `main`, one initial commit). A full design → PRD → issues pass is done. **Nothing is committed yet** — the design doc, PRD, and issues are all untracked working-tree files. No app code exists.

## Artifacts (read these first — don't re-derive)

- **`.claude/bodies-design-doc.md`** — original v0.1 design doc (the seed).
- **`docs/PRD.md`** — the spec. §2 is the locked-decision table (source of truth), §4 state machine, §5 mechanics, §7 data model, §8 screens, §9 theming + lexicon, §11 build plan.
- **`docs/issues/`** — 8 tracer-bullet slices + `README.md` index with the dependency graph. This is the build order.

## What the next session should do

Start executing `docs/issues/` in dependency order. Critical path is **01 → 02 → 03 → 04 → 05**; then **06, 07, 08** fan out from 05. Begin with **`docs/issues/01-scaffold.md`** (Vite + React + React Router + Supabase client + noir design tokens, deploy to Vercel).

Before writing code, consider committing the current docs (branch first — we're on `main`).

## Decisions that aren't obvious from the artifacts

- **Secrecy is deliberately UI-only.** Killer identity is hidden client-side, not hardened against the network tab — an intentional call (low-tech, low-stakes friends). Don't add RLS/field-level secrecy; it's explicitly v2.
- **Mutations go through Postgres RPCs** (not client writes) to keep the phase engine + win-check server-authoritative and race-free — even though secrecy is relaxed. This was a conscious "slightly more than minimum" choice.
- **Slice 5 is intentionally fat** (discussion + voting together) because a half-trial isn't demoable. It can split into 5a/5b if wanted.
- **Case-file copy everywhere** (buttons included) — the user chose maximum immersion over plain labels; mitigate comprehension with paired icons + a fixed lexicon (PRD §9.5). Lexicon names (`CONVICT`/`ACQUIT`/`CIVILIAN`) are provisional copy, easily changed.
- **Dead host keeps mod powers**; **dead players get full ghost view incl. killer identity** — both intentional.
- **Supabase + Vite SPA + localStorage-UUID identity (no auth)** — see PRD §2/§7 for the why.

## Open / deferred

- **Deploy host:** defaulted to Vercel (not yet set up). Netlify/CF Pages equivalent.
- **v2 deferred:** device-swap claim-code flow (schema is already split to allow it), discussion/vote timers, light-mode theme, network-tab hardening.
- No Supabase project provisioned yet; no env/secrets set. Slice 01 covers this.

## Suggested skills for next session

- **`run`** — to launch/verify the app once slice 01 is deployable.
- **`verify`** — after each non-trivial slice, exercise the flow end-to-end (multi-device game state is easy to get subtly wrong).
- **`tdd`** — the phase engine + win-check + vote-threshold logic (PRD §5) are pure and well-specified — good TDD candidates.
- **`code-review`** — before committing each slice.
- **`grill-with-docs` / `improve-codebase-architecture`** — only if a design gap surfaces mid-build; otherwise the PRD is the contract.
