function isOwner(membership) {
  return Boolean(membership) && membership.role === 'owner'
}

function isMember(membership) {
  return Boolean(membership) && membership.role === 'member'
}

function canUpdateHouseholdName(membership) {
  return isOwner(membership)
}

function canRemoveHouseholdMember(actor, target) {
  if (!isOwner(actor) || !isMember(target)) return false
  if (!actor.household_id || actor.household_id !== target.household_id) return false
  return actor.user_openid !== target.user_openid
}

function canLeaveHousehold(membership) {
  return isMember(membership)
}

module.exports = {
  isOwner,
  isMember,
  canUpdateHouseholdName,
  canRemoveHouseholdMember,
  canLeaveHousehold
}
