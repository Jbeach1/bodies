# 07 — Host toolkit & ghost view

**Type:** AFK · **Covers:** PRD P7, §5.5

## What to build

The moderator's correction tools and the spectator experience for eliminated players.

- **Host mod panel** (available in every phase, **works even when the host is dead**):
  - Toggle any player **alive/dead** → re-runs win-check.
  - **Cancel** an in-progress vote → discard vote + ballots → back to `DISCUSSION`.
  - Force **RESUME SURVEILLANCE** → `DISCUSSION → PLAYING`.
- **Ghost view (dead players):** full spectator view — roster, phase, live tally, and **the killer's identity** — but no actions.

## Acceptance criteria

- [ ] Mod panel reachable in every phase and functional when the host is dead.
- [ ] Alive/dead toggle updates status and re-runs the win-check.
- [ ] Cancel vote discards the current vote + ballots and returns to DISCUSSION.
- [ ] Force resume moves DISCUSSION → PLAYING.
- [ ] Dead players see the full ghost view incl. killer identity and cannot accuse/second/vote.

## Blocked by

- [05 — The trial loop](05-trial-loop.md)
