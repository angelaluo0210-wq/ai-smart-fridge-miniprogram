const { canAccessFridge } = require('./access')
const { getRemainingDays } = require('./date')

const REMINDER_TYPE = 'near_expiry'
const EXCLUDED_STATUSES = new Set(['expired', 'consumed', 'discarded'])

function isReminderCandidate(food, remainingDays) {
  return Boolean(food) && !EXCLUDED_STATUSES.has(food.status) &&
    Number.isInteger(remainingDays) && remainingDays >= 0 && remainingDays <= 2
}

function reminderKey(recipientOpenid, foodId, localDate, reminderType = REMINDER_TYPE) {
  return [recipientOpenid, foodId, reminderType, localDate].map(value => String(value || '')).join('|')
}

function reminderKeyFromRecord(record) {
  return reminderKey(
    record.recipient_openid || record.openid,
    record.food_id,
    record.local_date || record.scheduled_date,
    record.reminder_type || REMINDER_TYPE
  )
}

function collectCandidates({ foods, fridgeById, recipientOpenid, householdId, selectedFridgeIds, today, onInvalidFood }) {
  const candidates = []
  for (const food of foods || []) {
    const fridge = fridgeById.get(food.fridge_id)
    if (!fridge || !canAccessFridge(recipientOpenid, fridge, { householdId, selectedFridgeIds })) continue
    let remainingDays
    try {
      remainingDays = getRemainingDays(food.expire_date, today)
    } catch (error) {
      if (typeof onInvalidFood === 'function') onInvalidFood(food, error)
      continue
    }
    if (isReminderCandidate(food, remainingDays)) candidates.push({ food, fridge, remainingDays })
  }
  return candidates.sort((a, b) =>
    a.remainingDays - b.remainingDays ||
    String(a.food.expire_date).localeCompare(String(b.food.expire_date)) ||
    String(a.food._id).localeCompare(String(b.food._id)))
}

module.exports = {
  REMINDER_TYPE,
  EXCLUDED_STATUSES,
  isReminderCandidate,
  reminderKey,
  reminderKeyFromRecord,
  collectCandidates
}
