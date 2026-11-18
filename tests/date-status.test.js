const assert = require('assert')
const { calculateExpireDate, isValidDate, getRemainingDays } = require('../miniprogram/utils/date')
const { getFoodStatus, getRemainingText } = require('../miniprogram/utils/foodStatus')
const cloudDate = require('../cloudfunctions/sendExpiryReminders/date')

const today = '2026-08-24'

assert.strictEqual(calculateExpireDate('2026-08-24', 3), '2026-08-27')
assert.strictEqual(calculateExpireDate('2026-08-31', 1), '2026-09-01')
assert.strictEqual(calculateExpireDate('2026-12-30', 5), '2027-01-04')
assert.strictEqual(isValidDate('2026-02-29'), false)
assert.strictEqual(isValidDate('2028-02-29'), true)
assert.strictEqual(getRemainingDays('2026-08-24', today), 0)
assert.strictEqual(getRemainingDays('2026-08-25', today), 1)
assert.strictEqual(getRemainingDays('2026-08-26', today), 2)
assert.strictEqual(getRemainingDays('2026-08-27', today), 3)
assert.strictEqual(getRemainingDays('2026-08-23', today), -1)
assert.strictEqual(getFoodStatus({ expire_date: '2026-08-24', status: 'fresh' }, today), 'near_expiry')
assert.strictEqual(getFoodStatus({ expire_date: '2026-08-26', status: 'fresh' }, today), 'near_expiry')
assert.strictEqual(getFoodStatus({ expire_date: '2026-08-27', status: 'fresh' }, today), 'fresh')
assert.strictEqual(getFoodStatus({ expire_date: '2026-08-23', status: 'fresh' }, today), 'expired')
assert.strictEqual(getFoodStatus({ expire_date: '2026-08-23', status: 'consumed' }, today), 'consumed')
assert.strictEqual(getRemainingText('2026-08-24', today), '今天到期')
assert.strictEqual(getRemainingText('2026-08-25', today), '剩余 1 天')
assert.strictEqual(getRemainingText('2026-08-23', today), '已过期 1 天')
assert.throws(() => calculateExpireDate('2026-08-24', 0))
assert.throws(() => calculateExpireDate('错误日期', 3))

const expireDate = '2026-08-25'
const naturalDayCases = [
  { today: '2026-08-22', days: 3, status: 'fresh', display: '剩余 3 天' },
  { today: '2026-08-23', days: 2, status: 'near_expiry', display: '剩余 2 天' },
  { today: '2026-08-24', days: 1, status: 'near_expiry', display: '剩余 1 天' },
  { today: '2026-08-25', days: 0, status: 'near_expiry', display: '今天到期' },
  { today: '2026-08-26', days: -1, status: 'expired', display: '已过期 1 天' }
]

naturalDayCases.forEach(testCase => {
  const food = { expire_date: expireDate, status: 'fresh' }
  assert.strictEqual(getRemainingDays(expireDate, testCase.today), testCase.days)
  assert.strictEqual(cloudDate.getRemainingDays(expireDate, testCase.today), testCase.days)
  assert.strictEqual(getFoodStatus(food, testCase.today), testCase.status)
  assert.strictEqual(getRemainingText(expireDate, testCase.today), testCase.display)
})

assert.strictEqual(calculateExpireDate('2026-08-24', 1), '2026-08-25')
assert.strictEqual(getRemainingDays('2026-09-01', '2026-08-31'), 1)
assert.strictEqual(cloudDate.getRemainingDays('2026-09-01', '2026-08-31'), 1)
assert.strictEqual(getRemainingDays('2027-01-01', '2026-12-31'), 1)
assert.strictEqual(cloudDate.getRemainingDays('2027-01-01', '2026-12-31'), 1)

// 同一时刻：欧洲夏令时仍是 8 月 24 日，北京已经是 8 月 25 日。
const sameInstant = Date.parse('2026-08-24T21:30:00Z')
assert.strictEqual(cloudDate.todayForTimezoneOffset(-120, sameInstant), '2026-08-24')
assert.strictEqual(cloudDate.todayForTimezoneOffset(-480, sameInstant), '2026-08-25')

console.log('日期、状态、跨月跨年和用户时区一致性测试全部通过')
