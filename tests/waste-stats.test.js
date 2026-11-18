const assert = require('assert')
const {
  getWeekRange,
  getMonthRange,
  calculateWasteStats
} = require('../miniprogram/utils/wasteStats')

function localDate(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0)
}

const now = localDate(2026, 8, 25)
const foods = [
  { name: '牛奶', status: 'consumed', consumed_at: localDate(2026, 8, 3) },
  { name: '鸡蛋', status: 'consumed', consumed_at: localDate(2026, 8, 10) },
  { name: '豆腐', status: 'consumed', consumed_at: localDate(2026, 8, 20) },
  { name: '菠菜', status: 'consumed', consumed_at: localDate(2026, 8, 24) },
  { name: '牛奶', status: 'consumed', consumed_at: localDate(2026, 8, 25) },
  { name: '苹果', status: 'consumed', consumed_at: localDate(2026, 8, 25, 23) },
  { name: '面包', status: 'consumed', consumed_at: localDate(2026, 8, 1) },
  { name: '酸奶', status: 'consumed', consumed_at: localDate(2026, 8, 15) },
  { name: '菠菜', status: 'discarded', discarded_at: localDate(2026, 8, 24) },
  { name: '菠菜', status: 'discarded', discarded_at: localDate(2026, 8, 25) },
  { name: '旧牛奶', status: 'consumed' },
  { name: '旧豆腐', status: 'discarded', discarded_at: '不是日期' },
  { name: '过期但未处理', status: 'fresh', expire_date: '2026-08-20' }
]

const month = calculateWasteStats(foods, 'month', now)
assert.strictEqual(month.consumed, 8)
assert.strictEqual(month.discarded, 2)
assert.strictEqual(month.total, 10)
assert.strictEqual(month.wasteRate, 20)
assert.strictEqual(month.wasteRateText, '20%')
assert.deepStrictEqual(month.mostDiscarded, [{ name: '菠菜', count: 2 }])

const week = calculateWasteStats(foods, 'week', now)
assert.strictEqual(week.consumed, 3, 'Monday and Tuesday records are included in the local week')
assert.strictEqual(week.discarded, 2)
assert.strictEqual(week.wasteRate, 40)

const empty = calculateWasteStats([], 'month', now)
assert.strictEqual(empty.total, 0)
assert.strictEqual(empty.wasteRate, null)
assert.strictEqual(empty.wasteRateText, '')
assert.strictEqual(empty.hasRecords, false)
assert.deepStrictEqual(empty.mostDiscarded, [])

const onlyConsumed = calculateWasteStats([
  { name: '米饭', status: 'consumed', consumed_at: localDate(2026, 8, 2) }
], 'month', now)
assert.strictEqual(onlyConsumed.wasteRate, 0)
assert.deepStrictEqual(onlyConsumed.mostDiscarded, [])

const onlyDiscarded = calculateWasteStats([
  { name: '生菜', status: 'discarded', discarded_at: localDate(2026, 8, 2) }
], 'month', now)
assert.strictEqual(onlyDiscarded.wasteRate, 100)

const monthBoundaries = calculateWasteStats([
  { name: '月初', status: 'consumed', consumed_at: new Date(2026, 7, 1, 0, 0, 0, 0) },
  { name: '月末', status: 'discarded', discarded_at: new Date(2026, 7, 31, 23, 59, 59, 999) },
  { name: '上月', status: 'consumed', consumed_at: new Date(2026, 6, 31, 23, 59, 59, 999) },
  { name: '下月', status: 'discarded', discarded_at: new Date(2026, 8, 1, 0, 0, 0, 0) }
], 'month', now)
assert.strictEqual(monthBoundaries.total, 2, 'local month includes both endpoints and excludes adjacent months')

const ranking = calculateWasteStats([
  ...Array.from({ length: 3 }, () => ({ name: '菠菜', status: 'discarded', discarded_at: localDate(2026, 8, 5) })),
  ...Array.from({ length: 2 }, () => ({ name: '牛奶', status: 'discarded', discarded_at: localDate(2026, 8, 6) })),
  { name: '豆腐', status: 'discarded', discarded_at: localDate(2026, 8, 7) }
], 'month', now)
assert.deepStrictEqual(ranking.mostDiscarded, [
  { name: '菠菜', count: 3 },
  { name: '牛奶', count: 2 },
  { name: '豆腐', count: 1 }
])

const sundayRange = getWeekRange(localDate(2026, 8, 30))
assert.deepStrictEqual([
  sundayRange.start.getFullYear(), sundayRange.start.getMonth() + 1, sundayRange.start.getDate()
], [2026, 8, 24])
assert.deepStrictEqual([
  sundayRange.end.getFullYear(), sundayRange.end.getMonth() + 1, sundayRange.end.getDate()
], [2026, 8, 31])

const mondayRange = getWeekRange(localDate(2026, 8, 31))
assert.deepStrictEqual([
  mondayRange.start.getFullYear(), mondayRange.start.getMonth() + 1, mondayRange.start.getDate()
], [2026, 8, 31], 'Monday starts a new week')

const crossYearWeek = getWeekRange(localDate(2026, 1, 1))
assert.deepStrictEqual([
  crossYearWeek.start.getFullYear(), crossYearWeek.start.getMonth() + 1, crossYearWeek.start.getDate()
], [2025, 12, 29])
assert.deepStrictEqual([
  crossYearWeek.end.getFullYear(), crossYearWeek.end.getMonth() + 1, crossYearWeek.end.getDate()
], [2026, 1, 5])

const february = getMonthRange(localDate(2026, 2, 28))
assert.deepStrictEqual([
  february.start.getFullYear(), february.start.getMonth() + 1, february.start.getDate()
], [2026, 2, 1])
assert.deepStrictEqual([
  february.end.getFullYear(), february.end.getMonth() + 1, february.end.getDate()
], [2026, 3, 1], 'month range uses an exclusive next-month boundary')

const december = getMonthRange(localDate(2026, 12, 31))
assert.deepStrictEqual([
  december.end.getFullYear(), december.end.getMonth() + 1, december.end.getDate()
], [2027, 1, 1])

console.log('Phase 3 Step 1 浪费统计、周月边界和旧数据兼容测试全部通过')
