# Bodies — Game Moderator App
## Design Document (v0.1 — Draft for Spec Session)

---

## 1. Overview

**Bodies** is a live-action social deduction game played in person (similar to Mafia/Werewolf crossed with Among Us). Players draw cards; whoever draws the ace is the **killer**, everyone else is a **townsperson**. Lights go off, players hide and roam, the killer kills. When a body is found, lights come on and the group debates, accuses, and votes to eliminate a suspect. Play repeats until the killer is caught or wins.

This app is a **neutral moderator** for the game — not a replacement for it. The physical game stays physical. The app exists to remove friction at three specific points and otherwise stay out of the way.

**Design principle: the app should disappear into the background. It is a referee, not a game.** Any feature that makes the app more of a nuisance than a tool is a failure.

---

## 2. Problems Being Solved

### P1 — Role assignment is chaotic
Dealing physical cards while ensuring the killer's identity stays secret is like herding sheep. People are distracted, cards get seen, games get spoiled before they start.

**Solution:** Players scan into a game room via QR code. The host broadcasts "start game," and the app secretly assigns the killer server-side. Each phone privately displays that player's role.

### P2 — Tracking who is alive is manual and error-prone
As players are killed or voted out, the group has to mentally track who's still in the game. Voting eligibility gets fuzzy.

**Solution:** The app maintains authoritative alive/dead status for every player. Dead players are automatically excluded from voting (as candidates and/or voters — see open questions).

### P3 — In-person voting is difficult
End-of-round votes are hard to conduct fairly and quickly by hand.

**Solution:** Structured in-app voting, scoped to living players.

---

## 3. Core Game Rules (as encoded in the app)

The app is deliberately **unopinionated** about how the game is played, with **one opinionated rule**:

> **The Accusation → Second → Vote rule:** Once a player is accused, if a second player "seconds" the accusation, a vote **must** occur.

Beyond that rule, the app is a host for repeated votes until the game ends:

1. Host creates game, players join, host starts game
2. App secretly assigns killer (respecting host settings, e.g. killer blacklist)
3. Physical play happens — app is dormant
4. Body found → discussion phase
5. Accusation made → seconded → vote
6. Vote resolves → player eliminated (or not) → loop back to play or end game

---

## 4. Roles & Personas

### Host (admin)
- The player who creates the game
- Starts the game (triggers role assignment)
- Has access to **game settings** (see §7)
- Controls game-flow transitions (e.g., declaring "body found," advancing phases)
- **Open question:** Is the host also a player, or semi-outside the game? Current lean: host is a player too, but holds moderator powers.

### Killer
- Secretly assigned at game start
- Only their own phone reveals their role

### Townsperson
- Everyone else
- Phone shows "townsperson" at game start

---

## 5. Platform Decision

### Decision: Mobile web app (no native app, no app stores)

**Rationale:**
- **No app store friction.** No Apple developer account ($99/yr), no review delays or rejections, no Google Play setup, no forcing friends to download anything. This matters given limited dev time and no prior store experience.
- **QR-scan-to-join is proven UX** for "group of friends in a living room" (Jackbox model). Browsers handle QR scanning natively.
- **The use case is web-friendly.** No need for locked-phone push notifications, background processing, or deep camera access. Needs are: real-time state sync, a lobby, and a few screens.
- **Physical world is the push notification.** The room announces "body found!" out loud. Players open their phones *after* hearing commotion — the app doesn't need to summon them.

### Known constraint: iOS Safari suspends tabs aggressively
Nothing keeps a connection alive while a phone is locked — that's the OS, not the web platform. This is handled architecturally (see §6), not fought.

---

## 6. Architecture

### Core principle: the game lives on the server, not on the phones
A phone is a **window into game state**, nothing more. Disconnection must not matter. A player locking their phone for ten minutes changes nothing — on reopening, the app reconnects, pulls current state, and renders wherever the game is now (e.g., lands directly on an in-progress voting screen).

### Key architectural rules

1. **Session identity survives the connection.**
   - On join, generate a player ID, persist in `localStorage`
   - On any page load/reconnect: "I'm player `abc123` in room `XYZW`" → server restores session
   - No re-scanning QR codes, no duplicate "Steve (2)" players
   - Stretch: host can re-issue a session if a player's phone dies and they borrow another

2. **Never trust the connection for game logic.**
   - A vote is a database write, not a client-side event
   - Killer assignment is a server-side fact, re-fetched on reconnect
   - Clients only ever *render current state*; they never own it

3. **Use a managed real-time backend (Firebase Firestore or Supabase Realtime).**
   - Both handle the reconnect/re-sync dance automatically (suspended tab wakes → queued writes flush → state re-syncs)
   - Avoids writing custom WebSocket reconnection logic
   - Generous free tiers; no server to operate

### Proposed stack
- **Frontend:** Next.js or plain React, mobile-first
- **Backend/state:** Firebase (Firestore) or Supabase (Realtime) — final choice TBD in spec session
- **Role assignment & sensitive logic:** server-side (cloud function / edge function / RLS-protected), so no client ever holds another player's role

### Game flow (happy path)
1. Host opens site → creates game → gets room code + QR code
2. Players scan QR → enter name → land in lobby
3. Host hits **Start** → server secretly assigns killer → each phone privately shows role
4. Phones get pocketed; app is dormant during physical play
5. Body found → host triggers **Body Found** → app enters discussion mode
6. Accusation → second → vote (living players only)
7. Vote resolves → player marked dead (or vote fails) → return to play
8. Repeat until win condition → game over screen

---

## 7. Host Settings

Settings are fields on the game document, read at start-game time by the assignment logic. Building the settings screen as a simple key-value panel from day one means future rules don't require rearchitecting.

**v1 settings:**
- `blacklistedFromKiller: [playerIds]` — players who cannot be assigned killer (e.g., host doesn't enjoy the role)
- `killerCount` — multiple killers

**Anticipated future settings (design for extensibility, don't build yet):**
- Discussion/vote timers
- Other configurable house rules as they emerge

---

## 8. Game State Machine (skeleton — to be fully specified)

```
LOBBY ──start──▶ ROLE_REVEAL ──▶ PLAYING (app dormant)
                                    │
                              body found (host)
                                    ▼
                               DISCUSSION
                                    │
                          accusation + second
                                    ▼
                                 VOTING
                                    │
                    ┌──── vote resolves ────┐
                    ▼                       ▼
              player eliminated        vote fails
                    │                       │
             win condition? ──no──▶ back to PLAYING
                    │                (or DISCUSSION?)
                   yes
                    ▼
                GAME_OVER
```

---

## 9. Open Questions (for the spec / grill session)

### Voting mechanics
- What happens if **two accusations fly at once**? Queue them? First-seconded wins? Host arbitrates?
- Can the **accused vote**? Can they vote for themselves?
- What is the vote threshold — simple majority of living players? Plurality? What breaks ties?
- Is voting **secret or public** (do players see who voted for whom, live or after)?
- After a failed vote (no elimination), does play resume or does discussion continue for a new accusation?
- Can the same player be re-accused in the same discussion phase?

### Death & elimination
- Who marks a player as killed during the night phase — the victim self-reports? The host? The killer?
- Do dead players get a spectator view? Can they see who the killer is once dead?
- Can dead players observe votes (without participating)?

### Roles & win conditions
- Exact win conditions: killer caught = town wins; killer count reaches parity with town = killer wins? Or house rules?
- Does the killer's phone need any special functionality during play, or is the role purely informational?

### Host
- Is the host a full player or semi-outside the game?
- If the host is killed/eliminated, do host powers transfer? To whom?
- Can the host override/cancel a vote or resurrect a player (undo misclicks)?

### Sessions & rooms
- Room lifecycle: how long do rooms live? Can a group start a rematch with the same lobby?
- Handling a player whose phone dies mid-game (host re-issues session?)

### Technical
- Firebase vs. Supabase — final decision criteria (auth needs, pricing at scale, dev familiarity)
- Anonymous auth vs. no auth (localStorage-only identity)?
- How is role information secured so a curious player can't read the killer's identity from the client or network tab?

---

## 10. Non-Goals (v1)

- Native iOS/Android apps or app store distribution
- Push notifications to locked phones
- In-app chat (discussion happens out loud, in the room)
- Replacing any physical aspect of the game
- Accounts, profiles, or persistent player history
