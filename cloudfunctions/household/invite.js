const INVITE_STATUS = Object.freeze({ ACTIVE: 'active', EXPIRED: 'expired', REVOKED: 'revoked' })

function inviteState(invite, now = Date.now()) {
  if (!invite) return 'invalid'
  if (invite.status === INVITE_STATUS.REVOKED) return INVITE_STATUS.REVOKED
  if (invite.status !== INVITE_STATUS.ACTIVE) return invite.status || 'invalid'
  const expiresAt = new Date(invite.expires_at).getTime()
  return Number.isFinite(expiresAt) && expiresAt > now ? INVITE_STATUS.ACTIVE : INVITE_STATUS.EXPIRED
}

function joinState(currentMembership, inviteHouseholdId) {
  if (!currentMembership) return 'available'
  return currentMembership.household_id === inviteHouseholdId ? 'already_member' : 'other_household'
}

module.exports = { INVITE_STATUS, inviteState, joinState }
