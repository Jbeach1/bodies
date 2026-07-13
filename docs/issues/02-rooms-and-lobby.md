# 02 — Create & join a room

**Type:** AFK · **Covers:** PRD P1, §7, §8.1–8.3

## What to build

The full "get people into a room" path. A host creates a game and gets a short code + QR; players join by code/QR with a name; each device gets a durable identity that survives reload. The lobby shows a live roster on every phone.

- **Create:** host → `games` row with a unique short `room_code` + rendered QR.
- **Join:** open code/QR, enter name → `players` roster entry + `device_sessions` row bound to a `localStorage` UUID.
- **Live lobby:** roster list updates in realtime across all devices.
- **Reconnect:** on reload/return, the localStorage UUID rehydrates the player into their room and current phase — no re-scan, no duplicate "Steve (2)".

Uses the roster-vs-device split from §7 so a future device-swap is additive. Permissive RLS scoped to the room; anon key only.

## Acceptance criteria

- [ ] CREATE GAME creates a game with a unique short code and a scannable QR.
- [ ] Joining by code/QR + name creates a `players` row and a `device_sessions` binding; UUID + room stored in localStorage.
- [ ] Lobby lists all players live (realtime) on every connected device.
- [ ] Reload/return restores the same identity into the same room and phase (no duplicate player).
- [ ] RLS lets a room's data be read/written with the anon key, scoped to that room.
- [ ] `games.updated_at` is touched on activity (supports later 24h idle TTL).

## Blocked by

- [01 — Scaffold & deploy skeleton](01-scaffold.md)
