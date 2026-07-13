/**
 * Host START validation (PRD §5.1). Mirrored server-side in assign_roles —
 * this copy exists only to give the host an immediate, specific reason before
 * they tap the button; the RPC is the actual source of truth.
 */
export function validateStart(roster, settings) {
  const n = roster.length
  const killerCount = settings?.killerCount ?? 1
  const blacklist = settings?.blacklistedFromKiller ?? []
  const poolSize = roster.filter((p) => !blacklist.includes(p.id)).length

  if (n < 3) return 'Need at least 3 players.'
  if (killerCount < 1) return 'Need at least 1 killer.'
  if (killerCount >= n - killerCount) return 'Too many killers for this many players.'
  if (poolSize < killerCount) return 'Blacklist leaves too few eligible killers.'
  return null
}
