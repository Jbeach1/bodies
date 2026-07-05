# 03 — Roles: settings → assign → reveal

**Type:** AFK · **Covers:** PRD P2, §5.1, §8.4–8.5

## What to build

Everything from "host configures the game" to "each phone privately knows its role and play begins."

- **Settings (host):** `killerCount` stepper + blacklist multi-select over the roster, persisted to `games.settings`.
- **Start + validation:** host `START` runs the §5.1 checks; on pass, calls `assign_roles(game_id)`.
- **Assignment RPC:** atomic Postgres function picks `killerCount` killers at random from `players − blacklistedFromKiller`; everyone else townsperson; phase → `role_reveal`.
- **Reveal:** face-down card; **press-and-hold to peek**, release snaps back. Killer card lists `ACCOMPLICES` when `killerCount > 1`; town card shows `CIVILIAN`.
- **Ready-check:** each player acks `CONFIRM IDENTITY`; host sees readiness and taps `BEGIN` (may force) → phase `playing`.

## Acceptance criteria

- [ ] Settings persist to `games.settings` (killerCount default 1, blacklist array).
- [ ] START is blocked with a clear message unless: `players >= 4`, `killerCount >= 1`, `killerCount < players − killerCount`, and eligible pool `>= killerCount`.
- [ ] `assign_roles` RPC assigns roles atomically; killers random from (players − blacklist); host never has to compute roles client-side.
- [ ] Press-and-hold reveals the role and release hides it; nothing lingers on screen.
- [ ] `killerCount > 1`: killer card names accomplices; town card shows CIVILIAN only.
- [ ] Ready-check acks tracked; host readiness view; BEGIN advances to `playing`.

## Blocked by

- [02 — Create & join a room](02-rooms-and-lobby.md)
