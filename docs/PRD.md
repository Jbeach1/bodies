# Bodies — Product Requirements Document

**Status:** v1 spec, ready for decomposition into issues
**Source design doc:** [`.claude/bodies-design-doc.md`](../.claude/bodies-design-doc.md)
**Last updated:** 2026-07-05

---

## 1. Overview

**Bodies** is a live-action social-deduction party game (Mafia/Werewolf × Among Us) played in person. Players draw roles; the **killer(s)** hunt in the dark; when a body is found the group interrogates, accuses, and votes. This app is a **neutral moderator** — it removes friction at three points (role assignment, alive/dead tracking, voting) and otherwise **disappears into the background**.

> **Prime directive:** the app is a referee, not a game. Mood shows up only at dramatic beats; functional screens stay calm, fast, and legible — often in a dim room.

### Problems solved
- **P1 — Role assignment chaos** → QR/code join, server-side secret role assignment, private per-phone reveal.
- **P2 — Manual alive/dead tracking** → app holds authoritative status; dead players auto-excluded from voting.
- **P3 — Hard in-person voting** → structured in-app vote scoped to living players.

---

## 2. Locked Decisions (the spec)

| Area | Decision |
|---|---|
| **Host** | Full player **and** moderator. Mod powers **decoupled from alive/dead** — a dead host keeps the mod panel (becomes a living-room referee). |
| **Kill reporting** | Phones untouched in the dark. Lights on → **host taps "Report Body" and selects victim(s)**. Killer is phone-free during the act. |
| **Multi-victim** | A single Report Body event may mark **1+ victims** (multi-killer nights). |
| **Win conditions** | Auto-detected after **every** death. Town wins when `livingKillers == 0`; Killers win when `livingKillers >= livingTown`. Host counts as a body. A night-kill that hits parity ends the game with **no vote**. |
| **Ballot** | Binary **[Convict]/[Acquit]** on one accused player. |
| **Voter eligibility** | Accused is **excluded**: `eligibleVoters = living − accused`. Dead cannot vote/accuse/second. |
| **Threshold** | **Strict majority** to convict (`convictVotes > eligibleVoters/2`). Tie / short = **Acquit** (mercy bias). |
| **Vote visibility** | **Live public show-of-hands** — each ballot visible as it lands. |
| **Vote completion** | Live tally; auto-resolves when mathematically locked; else **host "Resolve Now"** (missing = Acquit). No timers in v1. |
| **Discussion loop** | Accusations are **async & coexist**. **First accusation to be corroborated (seconded) wins the floor** → vote; that promotion **clears all other pending accusations**. **Acquit** → accused **immune for rest of this discussion**, loop reopens. **Convict** → win-check → back to dark play. Loop ends on an elimination **or** host resuming play. |
| **Multiple killers** | `killerCount` setting. Killers **know each other** (accomplices listed on the reveal card). |
| **Dead players** | **Full ghost view** — see all state incl. killer identity. Cannot act. |
| **Role reveal** | **Press-and-hold to peek**; snaps back to face-down on release. |
| **Host tools** | **Full correction toolkit**: toggle any player alive/dead, cancel an in-progress vote, force-resume play. Win-check re-runs after toggles. |
| **Stack** | **Supabase** (Postgres + Realtime) + **Vite + React + React Router** SPA, static deploy. Free tiers. |
| **Identity** | **localStorage UUID, no auth**. Permissive RLS. Client owns reconnect reconciliation. |
| **Secrecy** | **UI-only** role hiding (low-tech, low-stakes friends). No network-tab hardening in v1. |
| **Schema** | **Roster entry split from device session** now (device-swap UI deferred to v2). |
| **Rooms** | Short code, persists (24h idle TTL). **Editable lobby between games** + one-tap replay. |
| **Theme** | **Restrained noir, dark-only.** **Monochrome + red only** (every semantic state pairs **icon + label**). **Forensic monospace** display / **Inter** body. **Case-file copy everywhere.** Cinematic at beats (cut-to-black, typewriter, vignette, haptics), calm elsewhere, **no sound**. |

---

## 3. Roles & Personas

- **Host** — creates the game; holds the mod panel (start, report body, resolve/cancel vote, corrections, resume play, play again, settings). Also drawn a role and can be killed/voted out; **keeps mod powers while dead**.
- **Killer(s)** — secretly assigned. Reveal card names accomplices when `killerCount > 1`. Purely informational during play (no dark-phase phone action).
- **Townsperson** — everyone else.
- **Ghost (dead player)** — full spectator view, no actions.

---

## 4. Game State Machine

```
                 ┌───────────────────────── PLAY AGAIN (host) ──────────────────────────┐
                 ▼                                                                        │
   LOBBY ──host Start──▶ ROLE_REVEAL ──host Begin──▶ PLAYING (dormant) ◀───────┐          │
 (editable)   (assign roles, RPC)   (ready-check)        │                     │          │
                                                    host Report Body           │ Convict  │
                                                         ▼                 (win-check:no)  │
                                                     DISCUSSION ───────────────┘          │
                                                    (interrogation)                        │
                                                   │        ▲                              │
                                        accusation │        │ Acquit (accused now immune)  │
                                        corroborated│        │                             │
                                                   ▼        │                              │
                                                     VOTING ─┘                             │
                                                   │                                       │
                                       resolve ────┤                                       │
                                                   │  Convict → mark dead → WIN-CHECK ──────┤
                                                   │                              │ yes     │
                                                   │  host Resume Play ──▶ PLAYING│         │
                                                   ▼                              ▼         │
                                                                             GAME_OVER ─────┘
                                                                        (reveal all roles)
```

**Phase enum:** `lobby | role_reveal | playing | discussion | voting | game_over`

**Transition rules**
- `lobby → role_reveal`: host Start; validation passes; RPC assigns roles.
- `role_reveal → playing`: host Begin (after ready-check; host may force).
- `playing → discussion`: host Report Body → mark victim(s) dead → **win-check** (may jump to `game_over`). On entry, reset `spared_this_discussion = false` for all.
- `discussion → voting`: an accusation gets corroborated (first wins floor); clear all other pending accusations.
- `voting → discussion` (Acquit): mark accused `spared_this_discussion = true`; reopen loop.
- `voting → playing | game_over` (Convict): mark accused dead → **win-check**.
- `discussion → playing`: host Resume Play (safety valve; also the normal loop exit).
- `* → game_over`: any win-check that succeeds.
- `game_over → lobby`: host Play Again → reset roles/alive, keep roster, allow edits.

---

## 5. Detailed Mechanics

### 5.1 Role assignment (server-side, atomic)
Implemented as a Supabase **Postgres RPC** `assign_roles(game_id)` (SECURITY DEFINER) so assignment is atomic and the host client never has to compute/write everyone's roles.

```
pool        = players(game) − settings.blacklistedFromKiller
killers     = random sample of killerCount from pool
everyone else = townsperson
```

**Start validation (host Start button):**
- `playerCount >= 4` (minimum for a fun game).
- `1 <= killerCount`.
- `killerCount < playerCount − killerCount`  (killers must start below parity, else instant win).
- `|pool| >= killerCount` (blacklist hasn't shrunk the eligible pool below the killer count).

### 5.2 Discussion / accusation loop
- Any **living** player may **Log Accusation** against a **living, non-immune, non-self** target. Accusing the host is allowed.
- Multiple accusations may sit **pending** simultaneously (async).
- Any **other living** player may **Corroborate** a pending accusation. The **first corroboration promotes that accusation to the floor** → `voting`, and **clears all other pending accusations**.
- Unseconded accusations can be **Withdrawn** by the accuser or **Dismissed** by the host.

### 5.3 Voting
- `eligibleVoters = living − accused`.
- Each eligible voter casts **Convict** or **Acquit**; ballots are **public in real time**.
- **Auto-resolve** the instant the outcome is locked (convict count `> eligibleVoters/2`, or acquit count makes convict unreachable).
- Otherwise host taps **Resolve Now** → missing ballots count as **Acquit**.
- **Convict** → accused dead → win-check → `playing` or `game_over`.
- **Acquit** → accused `spared_this_discussion = true` (immune until next Report Body or Resume Play) → `discussion`.

### 5.4 Win check (runs after every death & every host alive/dead toggle)
```
if livingKillers == 0:        winner = TOWN;    phase = game_over
elif livingKillers >= livingTown: winner = KILLERS; phase = game_over
```
`livingTown = living players − living killers` (host included in whichever bucket their role puts them).

### 5.5 Host correction toolkit
- **Toggle alive/dead** on any player → re-run win-check.
- **Cancel vote** → discard current vote + ballots, return to `discussion`.
- **Resume Play** → `discussion → playing`.
- Available whether or not the host is alive.

---

## 6. Settings (game document, JSONB)

Simple key-value panel from day one so future rules don't require rearchitecting.

**v1**
- `blacklistedFromKiller: playerId[]` — cannot be assigned killer.
- `killerCount: int` (default `1`).

**Deferred (design for extensibility, don't build):** discussion/vote timers, other house rules.

---

## 7. Data Model (Supabase / Postgres)

```
games
  id            uuid pk
  room_code     text unique         -- short, e.g. 4 chars
  phase         text                -- lobby|role_reveal|playing|discussion|voting|game_over
  host_player_id uuid fk players
  settings      jsonb               -- { blacklistedFromKiller:[], killerCount:1 }
  winner        text null           -- town|killers|null
  current_vote_id uuid null fk votes
  created_at    timestamptz
  updated_at    timestamptz         -- drives 24h idle TTL cleanup

players                             -- roster entry (identity), split from device
  id            uuid pk
  game_id       uuid fk games
  name          text
  join_order    int
  role          text null           -- killer|town|null(pre-assign)
  is_alive      bool default true
  is_host       bool default false
  spared_this_discussion bool default false
  created_at    timestamptz

device_sessions                     -- device → player binding (enables future swap)
  id            uuid pk
  player_id     uuid fk players
  device_uuid   text                -- localStorage UUID
  last_seen     timestamptz

accusations
  id            uuid pk
  game_id       uuid fk games
  accuser_id    uuid fk players
  accused_id    uuid fk players
  seconder_id   uuid null fk players
  status        text                -- pending|on_floor|resolved|withdrawn|cleared
  created_at    timestamptz

votes
  id            uuid pk
  game_id       uuid fk games
  accusation_id uuid fk accusations
  accused_id    uuid fk players
  status        text                -- open|resolved|cancelled
  outcome       text null           -- convict|acquit|null
  created_at    timestamptz
  resolved_at   timestamptz null

ballots
  id            uuid pk
  vote_id       uuid fk votes
  voter_id      uuid fk players
  choice        text                -- convict|acquit
  created_at    timestamptz
  unique(vote_id, voter_id)
```

**Realtime subscriptions:** clients subscribe to their `game` row + related `players`, `accusations`, `votes`, `ballots` for the room. Reconnect → refetch snapshot → render current phase.

**RPCs (Postgres functions):** `assign_roles`, `report_body(victimIds)`, `corroborate(accusationId)`, `resolve_vote`, `toggle_alive`, `play_again`. Keeping mutations in RPCs makes transitions atomic and win-checks server-authoritative.

---

## 8. Screens (mobile-first)

1. **Home** — `CREATE GAME` · `JOIN GAME`.
2. **Join** — enter room code + name → create player + device_session → lobby. (Reconnect skips this if localStorage has a valid binding.)
3. **Lobby** — roster (live), room code + QR, waiting state for players. **Host:** settings entry + `START`. **Between games:** editable (add/remove players, change settings) before replay.
4. **Settings (host)** — `killerCount` stepper, blacklist multi-select, (placeholder for future timers).
5. **Role Reveal** — face-down card, **press-and-hold to peek**; killers see accomplices; `CONFIRM IDENTITY` ack. **Host:** readiness roster + `BEGIN`.
6. **Playing (dormant)** — ambient case-file "surveillance" screen; **host:** `REPORT BODY`. Dead → ghost view.
7. **Report Body (host)** — select victim(s) from living roster → confirm → discussion.
8. **Discussion / Interrogation** — living: roster with `LOG ACCUSATION`; pending-accusations list with `CORROBORATE`; immune players flagged. **Host:** `RESUME SURVEILLANCE` + correction tools.
9. **Voting / Tribunal** — accused shown; `CONVICT`/`ACQUIT` for eligible voters; live tally + who's outstanding; **host:** `RESOLVE NOW`.
10. **Game Over** — winner + full role reveal; **host:** `PLAY AGAIN`.
11. **Ghost overlay (dead)** — spectator view layered over any phase.
12. **Host mod panel** — overlay: toggle alive/dead, cancel vote, resume play.

---

## 9. Theming Specification

### 9.1 Foundations
- **Dark-only** v1 (light mode deferred; implement as swappable tokens).
- **Monochrome + single red accent.** Red is the **only** hue.
- **Accessibility rule (hard):** color never carries meaning alone — **every semantic state pairs an icon + text label** (convict/acquit, alive/dead, killer/town).

### 9.2 Color tokens
```
--bg-0        #0a0a0b   base (near-black)
--bg-1        #141416   elevated surface
--bg-2        #1e1e22   raised / cards
--text        #ECECEC   primary
--text-muted  #8A8A90   secondary
--red         #E5484D   THE accent — danger / killer / convict / body / beats
--red-dim     #7A2A2E   pressed/disabled red
--dead        #5A5A60   deceased (desaturated) + strikethrough
--host        #FFFFFF   brighter white = moderator/authority layer
--line        #2A2A30   hairlines/borders
```
- **Convict** = solid red fill + skull/✕ icon. **Acquit** = neutral outline + release/✓ icon.
- **Alive** = normal weight. **Dead** = `--dead` + strikethrough + closed-case icon.
- **Host controls** = `--host` brighter treatment to read as a distinct authority layer.

### 9.3 Typography
- **Display / headings:** forensic **monospace** (e.g. JetBrains Mono / IBM Plex Mono) — case-file voice.
- **Body / UI:** **Inter** (or system sans) for legibility.
- Dramatic beats render big mono caps that **type out**.

### 9.4 Motion & feedback
- **Beats** (role reveal, body found, elimination, game over): cut-to-black transition → mono text **types in** → subtle red **vignette/flicker** → **haptic buzz** (`navigator.vibrate`, best-effort; iOS Safari ignores).
- **Functional screens:** fast, calm fades only.
- **No sound** (the room is the soundtrack).

### 9.5 Copy lexicon (case-file everywhere; tunable, always paired with an icon)
| Action / state | Case-file label |
|---|---|
| Start game | `INITIATE` |
| Body found | `REPORT BODY` / beat: `> BODY DISCOVERED` |
| Discussion phase | `INTERROGATION` |
| Accuse | `LOG ACCUSATION` |
| Second | `CORROBORATE` |
| Vote phase | `TRIBUNAL` |
| Eliminate | `CONVICT` |
| Spare | `ACQUIT` |
| Resume play | `RESUME SURVEILLANCE` |
| Killer role | `KILLER` (+ `ACCOMPLICES: …`) |
| Town role | `CIVILIAN` |
| Alive / Dead | `ACTIVE` / `CASE CLOSED` |
| Play again | `NEW CASE` |

> Comprehension guardrail: immersive labels always ship with an icon, and the lexicon is fixed/learnable — no synonyms mid-game.

---

## 10. Non-Goals & Deferred

**v1 non-goals (from design doc):** native apps / app stores, push to locked phones, in-app chat, replacing physical play, accounts/profiles/history.

**Deferred to v2:** device-swap claim-code flow (schema is ready), discussion/vote timers, light-mode theme, network-tab role hardening (RLS/field secrecy).

---

## 11. Build Plan (tracer-bullet slices → issues)

Each phase is a vertical slice that leaves the app runnable.

- **P0 — Scaffold:** Vite + React + Router, Supabase project + client, env/secrets, static deploy pipeline, **design tokens + fonts**, base layout & phase router.
- **P1 — Rooms & lobby:** create game, join by code, live roster, **localStorage UUID + device_session identity**, reconnect/rehydrate.
- **P2 — Roles:** settings panel, Start validation, `assign_roles` RPC, **press-and-hold role reveal** (+ accomplices), ready-check, Begin.
- **P3 — Play & bodies:** dormant surveillance screen, **Report Body (multi-victim)**, phase engine, win-check.
- **P4 — Discussion:** async accusations, **first-corroboration-wins** floor + clear-others, immunity tracking, host resume/withdraw/dismiss.
- **P5 — Voting:** ballots, **live public tally**, strict-majority auto-resolve, host Resolve Now, convict/acquit outcomes + win-check.
- **P6 — Endgame:** game-over reveal, **Play Again** (editable-lobby reset).
- **P7 — Host & ghosts:** full correction toolkit, dead-player ghost view.
- **P8 — Theme polish:** cinematic beats (typewriter, cut-to-black, vignette, haptics), full lexicon/icon pass, empty/loading states.

---

## 12. Resolved Defaults (previously open)

- **Min players:** 4. **Assignment:** blacklist-aware random via RPC with start validation (§5.1).
- **Ready-check:** each player acks `CONFIRM IDENTITY` after peeking; host sees readiness and may force Begin.
- **Dormant screen:** ambient surveillance card; killer sees same (informational); host holds `REPORT BODY`.
- **Accusation targeting:** living, non-immune, non-self; host is a valid target; dead cannot act.
- **Multi-victim night:** Report Body accepts 1+ victims; each marked dead; single win-check after.
