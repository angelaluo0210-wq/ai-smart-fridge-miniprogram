const VISIBILITY = Object.freeze({ PRIVATE: 'private', HOUSEHOLD: 'household', SELECTED: 'selected' })
function creatorOf(fridge = {}) { return String(fridge.created_by || fridge._openid || '') }
function visibilityOf(fridge = {}) { return Object.values(VISIBILITY).includes(fridge.visibility) ? fridge.visibility : VISIBILITY.PRIVATE }
function canAccessFridge(openid, fridge, context = {}) {
  const creator = creatorOf(fridge)
  const visibility = visibilityOf(fridge)
  if (!openid || !creator) return false
  if (creator === openid) return true
  if (visibility === VISIBILITY.PRIVATE) return false
  if (!context.householdId || String(fridge.household_id || '') !== context.householdId) return false
  if (visibility === VISIBILITY.HOUSEHOLD) return true
  return visibility === VISIBILITY.SELECTED && Boolean(context.selectedFridgeIds && context.selectedFridgeIds.has(fridge._id))
}
module.exports = { VISIBILITY, creatorOf, visibilityOf, canAccessFridge }
