# 01 — Scaffold & deploy skeleton

**Type:** AFK · **Covers:** PRD P0, §9

## What to build

Stand up the empty app end-to-end: a Vite + React + React Router SPA with the Supabase client wired from env, the noir design system in place, and a styled placeholder Home screen deployed to a public static URL. This is the bootstrap slice — every later slice renders inside this shell.

- Vite + React + React Router project that boots and builds.
- Supabase JS client initialized from env vars (project URL + anon key).
- Dark-only design tokens from §9.2 as CSS variables (monochrome + single red accent).
- Fonts: forensic monospace display (JetBrains Mono or IBM Plex Mono) + Inter body.
- A base layout and a phase-router shell that will later switch screens on `games.phase`.
- Static deploy to Vercel; live URL renders a themed Home screen with `CREATE GAME` / `JOIN GAME` placeholders.

## Acceptance criteria

- [ ] App boots locally (`dev`) and produces a clean production build.
- [ ] Supabase client connects using env config; a trivial round-trip (e.g. `select now()`) succeeds.
- [ ] §9.2 color tokens defined as CSS variables; app is dark-only.
- [ ] Mono display font + Inter body font load and apply per §9.3.
- [ ] Routing shell exists and is structured to switch on game phase.
- [ ] Deployed to a public static URL (Vercel).
- [ ] Home screen renders in the noir style with CREATE GAME / JOIN GAME placeholders.

## Blocked by

None — can start immediately.
