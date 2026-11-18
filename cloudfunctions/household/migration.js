const VALID_VISIBILITIES = new Set(['private', 'household', 'selected'])

function buildFridgeMigration(fridge, openid, householdId) {
  if (fridge.household_id && fridge.household_id !== householdId) return {}
  const data = {}
  if (!fridge.household_id) data.household_id = householdId
  if (!fridge.created_by) data.created_by = fridge._openid || openid
  if (!VALID_VISIBILITIES.has(fridge.visibility)) data.visibility = 'private'
  return data
}

function belongsToMigrationHousehold(fridge, householdId) {
  return !fridge.household_id || fridge.household_id === householdId
}

module.exports = { buildFridgeMigration, belongsToMigrationHousehold }
