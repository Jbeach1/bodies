# 04 — Report body & phase engine

**Type:** AFK · **Covers:** PRD P3, §4, §5.4

## What to build

The dormant play phase, the host's body-reporting action, and the authoritative phase/win engine that the rest of the game runs on.

- **Dormant PLAYING screen:** ambient case-file "surveillance" state for everyone; killer's view is identical (purely informational). Host holds `REPORT BODY`.
- **Report Body (host):** select **1+ victims** from the living roster → confirm marks them dead, resets `spared_this_discussion` for all, runs the win-check, and enters `DISCUSSION` (or `GAME_OVER` if a night kill hit parity).
- **Phase engine:** transitions go through server RPCs that enforce valid moves; win-check per §5.4 runs after every death.

## Acceptance criteria

- [ ] PLAYING renders the ambient case-file screen; only the host sees REPORT BODY.
- [ ] Report Body supports multi-select victims; each is marked dead atomically.
- [ ] Win-check after deaths: `livingKillers == 0` → town wins; `livingKillers >= livingTown` → killers win → `GAME_OVER` + winner set; otherwise `DISCUSSION`.
- [ ] `spared_this_discussion` is reset for all players on entering DISCUSSION.
- [ ] Transitions are RPC-driven and reject invalid moves.

## Blocked by

- [03 — Roles: settings → assign → reveal](03-roles-assign-reveal.md)
