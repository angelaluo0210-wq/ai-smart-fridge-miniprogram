const assert = require('assert')
const reminderAccess = require('../cloudfunctions/sendExpiryReminders/access')
const householdAccess = require('../cloudfunctions/household/access')
const {
  isReminderCandidate,
  reminderKey,
  reminderKeyFromRecord,
  collectCandidates
} = require('../cloudfunctions/sendExpiryReminders/logic')
const { getRemainingDays, todayForTimezoneOffset } = require('../cloudfunctions/sendExpiryReminders/date')
const { personalOwnerWhere, canAccessPersonalRecord } = require('../miniprogram/utils/personalData')

const owner = 'user-owner'
const member = 'user-member'
const other = 'user-unselected-member'
const outsider = 'user-outsider'
const householdId = 'household-1'

const fridges = [
  { _id: 'private', created_by: owner, household_id: householdId, visibility: 'private', name: '私人冰箱' },
  { _id: 'household', created_by: owner, household_id: householdId, visibility: 'household', name: '家庭冰箱' },
  { _id: 'selected', created_by: owner, household_id: householdId, visibility: 'selected', name: '指定冰箱' }
]

const contexts = {
  [owner]: { householdId, selectedFridgeIds: new Set() },
  [member]: { householdId, selectedFridgeIds: new Set(['selected']) },
  [other]: { householdId, selectedFridgeIds: new Set() },
  [outsider]: { householdId: '', selectedFridgeIds: new Set(['selected']) }
}

const expected = {
  [owner]: [true, true, true],
  [member]: [false, true, true],
  [other]: [false, true, false],
  [outsider]: [false, false, false]
}

for (const openid of [owner, member, other, outsider]) {
  fridges.forEach((fridge, index) => {
    const reminderResult = reminderAccess.canAccessFridge(openid, fridge, contexts[openid])
    const householdResult = householdAccess.canAccessFridge(openid, fridge, contexts[openid])
    assert.strictEqual(reminderResult, expected[openid][index], `${openid} access to ${fridge._id}`)
    assert.strictEqual(reminderResult, householdResult, 'reminder and Household access rules stay aligned')
  })
}

assert.strictEqual(isReminderCandidate({ status: 'fresh' }, 3), false, 'more than two days remains fresh')
for (const days of [0, 1, 2]) {
  assert.strictEqual(isReminderCandidate({ status: 'fresh' }, days), true, `${days} remaining days is eligible`)
}
assert.strictEqual(isReminderCandidate({ status: 'fresh' }, -1), false, 'computed expired food is excluded')
for (const status of ['expired', 'consumed', 'discarded']) {
  assert.strictEqual(isReminderCandidate({ status }, 0), false, `${status} food is excluded`)
}

const sameInstant = Date.parse('2026-08-24T21:30:00.000Z')
const berlinDate = todayForTimezoneOffset(-120, sameInstant)
const shanghaiDate = todayForTimezoneOffset(-480, sameInstant)
assert.strictEqual(berlinDate, '2026-08-24', 'UTC+2 recipient still sees August 24')
assert.strictEqual(shanghaiDate, '2026-08-25', 'UTC+8 recipient already sees August 25')
assert.strictEqual(getRemainingDays('2026-08-25', berlinDate), 1)
assert.strictEqual(getRemainingDays('2026-08-25', shanghaiDate), 0)

const key = reminderKey(member, 'food-1', '2026-08-25')
const sentKeys = new Set([key])
assert.strictEqual(sentKeys.has(reminderKey(member, 'food-1', '2026-08-25')), true, 'same recipient, food and local date is deduplicated')
assert.strictEqual(sentKeys.has(reminderKey(owner, 'food-1', '2026-08-25')), false, 'another recipient has an independent reminder')
assert.strictEqual(sentKeys.has(reminderKey(member, 'food-1', '2026-08-26')), false, 'another local date has an independent reminder')
assert.strictEqual(reminderKeyFromRecord({
  recipient_openid: member,
  food_id: 'food-1',
  local_date: '2026-08-25',
  reminder_type: 'near_expiry'
}), key, 'new reminder fields produce the expected key')
assert.strictEqual(reminderKeyFromRecord({
  openid: member,
  food_id: 'food-1',
  scheduled_date: '2026-08-25',
  reminder_type: 'near_expiry'
}), key, 'legacy reminder fields remain compatible')

const fridgeById = new Map(fridges.map(fridge => [fridge._id, fridge]))
const foods = [
  { _id: 'private-food', fridge_id: 'private', name: '私人物品', expire_date: '2026-08-25', status: 'fresh' },
  { _id: 'household-food', fridge_id: 'household', name: '家庭物品', expire_date: '2026-08-26', status: 'fresh' },
  { _id: 'selected-food', fridge_id: 'selected', name: '指定物品', expire_date: '2026-08-27', status: 'fresh' },
  { _id: 'too-early', fridge_id: 'household', name: '未临期', expire_date: '2026-08-28', status: 'fresh' },
  { _id: 'consumed', fridge_id: 'household', name: '已食用', expire_date: '2026-08-25', status: 'consumed' }
]
const memberCandidates = collectCandidates({
  foods,
  fridgeById,
  recipientOpenid: member,
  householdId,
  selectedFridgeIds: contexts[member].selectedFridgeIds,
  today: '2026-08-25'
})
assert.deepStrictEqual(memberCandidates.map(item => item.food._id), ['household-food', 'selected-food'])
assert.deepStrictEqual(memberCandidates.map(item => item.fridge.name), ['家庭冰箱', '指定冰箱'])

assert.deepStrictEqual(personalOwnerWhere(member), { _openid: member }, 'personal query only uses the owner openid')
assert.deepStrictEqual(personalOwnerWhere(member, { checked: false }), { _openid: member, checked: false })
assert.strictEqual(canAccessPersonalRecord(member, { _openid: member, household_id: householdId }), true)
assert.strictEqual(canAccessPersonalRecord(owner, { _openid: member, household_id: householdId }), false, 'same Household never grants shopping item access')
assert.strictEqual(canAccessPersonalRecord(member, { _openid: owner, household_id: householdId }), false, 'personal shopping isolation works in both directions')

console.log('Phase 2.5 Household 提醒、时区、去重和个人购物清单测试全部通过')
