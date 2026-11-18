// 云函数按目录独立部署；本文件与 cloudfunctions/household/access.js 保持同一权限语义，测试会同时覆盖两份实现。
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

module.exports = { VISIBILITY, creatorOf, visibilityOf, normalizeFridge, canAccessFridge }
