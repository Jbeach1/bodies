/**
 * Game phase enum (PRD §4). The GameShell switches the rendered screen on
 * `games.phase`; every value here maps to exactly one screen in PhaseRouter.
 */
export const PHASES = {
  LOBBY: 'lobby',
  ROLE_REVEAL: 'role_reveal',
  PLAYING: 'playing',
  DISCUSSION: 'discussion',
  VOTING: 'voting',
  GAME_OVER: 'game_over',
}

export const PHASE_ORDER = [
  PHASES.LOBBY,
  PHASES.ROLE_REVEAL,
  PHASES.PLAYING,
  PHASES.DISCUSSION,
  PHASES.VOTING,
  PHASES.GAME_OVER,
]

/** Human-facing case-file label for a phase (§9.5 lexicon). */
export const PHASE_LABEL = {
  [PHASES.LOBBY]: 'ASSEMBLY',
  [PHASES.ROLE_REVEAL]: 'BRIEFING',
  [PHASES.PLAYING]: 'SURVEILLANCE',
  [PHASES.DISCUSSION]: 'INTERROGATION',
  [PHASES.VOTING]: 'TRIBUNAL',
  [PHASES.GAME_OVER]: 'CASE CLOSED',
}
