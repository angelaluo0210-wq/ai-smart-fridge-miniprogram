const { visibilityOf } = require('./access')

function planMemberDeparture(fridges, userOpenid, householdId) {
  const owned = (fridges || []).filter(fridge =>
    String(fridge.created_by || fridge._openid || '') === userOpenid &&
    String(fridge.household_id || '') === householdId
  )
  const sharedFridgeIds = owned.filter(fridge => visibilityOf(fridge) !== 'private').map(fridge => fridge._id)
  const privateFridgeIds = owned.filter(fridge => visibilityOf(fridge) === 'private').map(fridge => fridge._id)
  return { canLeave: sharedFridgeIds.length === 0, sharedFridgeIds, privateFridgeIds }
}

function privateFridgeDetachPatch() {
  return { household_id: '', visibility: 'private' }
}

module.exports = { planMemberDeparture, privateFridgeDetachPatch }
