const FRIDGE_VISIBILITY = Object.freeze({
  PRIVATE: 'private',
  HOUSEHOLD: 'household',
  SELECTED: 'selected'
})

const VALID_VISIBILITIES = new Set(Object.values(FRIDGE_VISIBILITY))

function getFridgeCreator(fridge = {}) {
  return String(fridge.created_by || fridge._openid || '')
}

function normalizeFridgeVisibility(visibility) {
  return VALID_VISIBILITIES.has(visibility) ? visibility : FRIDGE_VISIBILITY.PRIVATE
}

function normalizeFridgeAccessFields(fridge = {}) {
  return {
    ...fridge,
    household_id: String(fridge.household_id || ''),
    created_by: getFridgeCreator(fridge),
    visibility: normalizeFridgeVisibility(fridge.visibility)
  }
}

function canAccessFridge(userOpenid, fridge, context = {}) {
  const openid = String(userOpenid || '')
  const normalized = normalizeFridgeAccessFields(fridge)
  if (!openid || !normalized.created_by) return false
  if (normalized.created_by === openid) return true
  if (normalized.visibility === FRIDGE_VISIBILITY.PRIVATE) return false
  if (!normalized.household_id || !context.isHouseholdMember) return false
  if (normalized.visibility === FRIDGE_VISIBILITY.HOUSEHOLD) return true
  return normalized.visibility === FRIDGE_VISIBILITY.SELECTED && Boolean(context.isSelectedMember)
}

function canManageFridge(userOpenid, fridge) {
  return Boolean(userOpenid) && getFridgeCreator(fridge) === String(userOpenid)
}

function getVisibilityLabel(visibility) {
  const labels = {
    [FRIDGE_VISIBILITY.PRIVATE]: '仅自己可见',
    [FRIDGE_VISIBILITY.HOUSEHOLD]: '全部家庭成员可见',
    [FRIDGE_VISIBILITY.SELECTED]: '部分家庭成员可见'
  }
  return labels[normalizeFridgeVisibility(visibility)]
}

module.exports = {
  FRIDGE_VISIBILITY,
  normalizeFridgeVisibility,
  normalizeFridgeAccessFields,
  getFridgeCreator,
  canAccessFridge,
  canManageFridge,
  getVisibilityLabel
}
