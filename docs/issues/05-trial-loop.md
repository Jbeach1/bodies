# 05 — The trial loop (discussion + voting)

**Type:** AFK · **Covers:** PRD P4+P5, §5.2–5.4

## What to build

The core game loop, kept as one slice because a half-trial isn't demoable. Discussion → accusation → corroboration → vote → resolution → back to discussion or play.

**Discussion:**
- Any living player may `LOG ACCUSATION` against a **living, non-immune, non-self** target (host is a valid target).
- Multiple accusations coexist as **pending** (async).
- The **first `CORROBORATE`** (by another living player) promotes that accusation to the floor → `VOTING` and **clears all other pending accusations**.
- Accuser can **withdraw**; host can **dismiss** an unseconded accusation.

**Voting:**
- Eligible voters = `living − accused`. Each casts `CONVICT` / `ACQUIT`.
- Ballots are **public in real time**; tally + outstanding voters visible.
- **Auto-resolve** when mathematically locked; else host `RESOLVE NOW` (missing ballots = acquit).
- Threshold: convict needs `convictVotes > eligibleVoters/2`; tie/short = **acquit** (mercy bias).

**Resolution:**
- **Convict** → accused dead → win-check → `PLAYING` or `GAME_OVER`.
- **Acquit** → accused `spared_this_discussion = true` (immune until next Report Body / Resume Play) → `DISCUSSION`.
- Host `RESUME SURVEILLANCE` exits the loop to `PLAYING` at any time.

## Acceptance criteria

- [ ] Multiple pending accusations can coexist; targets restricted to living, non-immune, non-self.
- [ ] First corroboration promotes to VOTING and clears all other pending accusations.
- [ ] Accuser withdraw and host dismiss both clear an unseconded accusation.
- [ ] Ballots are public/live; tally and outstanding voters shown.
- [ ] Convict requires `> eligibleVoters/2`; tie/short = acquit; Resolve Now counts missing as acquit; auto-resolve when locked.
- [ ] Convict → death + win-check; Acquit → immunity flag + loop reopens.
- [ ] Host RESUME SURVEILLANCE returns to PLAYING.

## Blocked by

- [04 — Report body & phase engine](04-report-body-phase-engine.md)
