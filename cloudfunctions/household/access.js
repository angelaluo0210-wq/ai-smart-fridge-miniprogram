const VISIBILITY = Object.freeze({ PRIVATE: 'private', HOUSEHOLD: 'household', SELECTED: 'selected' })
const VALID_VISIBILITIES = new Set(Object.values(VISIBILITY))

function creatorOf(fridge = {}) {
  return String(fridge.created_by || fridge._openid || '')
}

function visibilityOf(fridge = {}) {
  return VALID_VISIBILITIES.has(fridge.visibility) ? fridge.visibility : VISIBILITY.PRIVATE
}

function normalizeFridge(fridge = {}) {
  return {
    ...fridge,
    created_by: creatorOf(fridge),
    household_id: String(fridge.household_id || ''),
    visibility: visibilityOf(fridge)
  }
}

function canAccessFridge(openid, fridge, context = {}) {
  const normalized = normalizeFridge(fridge)
  if (!openid || !normalized.created_by) return false
  if (normalized.created_by === openid) return true
  if (normalized.visibility === VISIBILITY.PRIVATE) return false
  if (!context.householdId || normalized.household_id !== context.householdId) return false
  if (normalized.visibility === VISIBILITY.HOUSEHOLD) return true
  return normalized.visibility === VISIBILITY.SELECTED &&
    Boolean(context.selectedFridgeIds && context.selectedFridgeIds.has(normalized._id))
}

function canManageFridge(openid, fridge) {
  return Boolean(openid) && creatorOf(fridge) === String(openid)
}

function selectedMembersForVisibility(visibility, selectedOpenids) {
  return visibility === VISIBILITY.SELECTED ? Array.from(new Set(selectedOpenids || [])) : []
}

module.exports = {
  VISIBILITY, VALID_VISIBILITIES, creatorOf, visibilityOf, normalizeFridge,
  canAccessFridge, canManageFridge, selectedMembersForVisibility
}
