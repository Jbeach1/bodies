# Bodies — Implementation Issues

Tracer-bullet vertical slices decomposed from [`../PRD.md`](../PRD.md). Each slice cuts end-to-end (schema + realtime + UI) and is demoable on its own. Build in dependency order.

| # | Slice | Type | Blocked by |
|---|---|---|---|
| [01](01-scaffold.md) | Scaffold & deploy skeleton | AFK | — |
| [02](02-rooms-and-lobby.md) | Create & join a room | AFK | 01 |
| [03](03-roles-assign-reveal.md) | Roles: settings → assign → reveal | AFK | 02 |
| [04](04-report-body-phase-engine.md) | Report body & phase engine | AFK | 03 |
| [05](05-trial-loop.md) | The trial loop (discussion + voting) | AFK | 04 |
| [06](06-endgame-replay.md) | Endgame & replay | AFK | 05 |
| [07](07-host-toolkit-ghost-view.md) | Host toolkit & ghost view | AFK | 05 |
| [08](08-theme-polish.md) | Theme polish & cinematic beats | **HITL** | 05 |

**Deferred to v2 (not sliced):** device-swap claim-code flow, discussion/vote timers, light-mode theme, network-tab role hardening.

**Deploy target:** Vercel (static, zero-config for Vite) — default; Netlify/Cloudflare Pages equivalent.
