# 06 — Endgame & replay

**Type:** AFK · **Covers:** PRD P6, §8.10

## What to build

The game's end and the fast path back into another round with the same group.

- **GAME_OVER screen:** reveals the winner and **every player's role** (case-file beat).
- **Play Again (`NEW CASE`):** host resets roles to null, all players alive, clears trial state (accusations/votes/ballots), and returns to an **editable LOBBY** — host can add/remove players and change settings before starting again. Same room code, existing device sessions preserved, no re-scan.

## Acceptance criteria

- [ ] GAME_OVER shows the winner and a full role reveal for all players.
- [ ] Play Again resets `is_alive = true`, `role = null`, and clears accusations/votes/ballots.
- [ ] Post-game lobby is editable: add/remove players, change settings, then start again.
- [ ] Same `room_code` and existing `device_sessions` persist across replays.

## Blocked by

- [05 — The trial loop](05-trial-loop.md)
