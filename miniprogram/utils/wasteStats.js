const PERIOD = Object.freeze({ WEEK: 'week', MONTH: 'month' })

function startOfLocalDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('统计日期无效')
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getWeekRange(now = new Date()) {
  const start = startOfLocalDay(now)
  const dayFromMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - dayFromMonday)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

function getMonthRange(now = new Date()) {
  const local = startOfLocalDay(now)
  return {
    start: new Date(local.getFullYear(), local.getMonth(), 1),
    end: new Date(local.getFullYear(), local.getMonth() + 1, 1)
  }
}

function getPeriodRange(period, now = new Date()) {
  if (period === PERIOD.WEEK) return getWeekRange(now)
  if (period === PERIOD.MONTH) return getMonthRange(now)
  throw new Error(`不支持的统计周期: ${period}`)
}

function toTimestamp(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (value && typeof value.toDate === 'function') return toTimestamp(value.toDate())
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function lifecycleTimestamp(food) {
  if (!food) return null
  if (food.status === 'consumed') return toTimestamp(food.consumed_at)
  if (food.status === 'discarded') return toTimestamp(food.discarded_at)
  return null
}

function rankDiscarded(foods) {
  const counts = new Map()
  foods.forEach(food => {
    const name = String(food.name || '').trim() || '未命名食材'
    counts.set(name, (counts.get(name) || 0) + 1)
  })
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

function calculateWasteStats(foods, period = PERIOD.MONTH, now = new Date()) {
  const range = getPeriodRange(period, now)
  const inPeriod = (Array.isArray(foods) ? foods : []).filter(food => {
    const timestamp = lifecycleTimestamp(food)
    return timestamp !== null && timestamp >= range.start.getTime() && timestamp < range.end.getTime()
  })
  const consumedFoods = inPeriod.filter(food => food.status === 'consumed')
  const discardedFoods = inPeriod.filter(food => food.status === 'discarded')
  const total = consumedFoods.length + discardedFoods.length
  const wasteRate = total ? Math.round((discardedFoods.length / total) * 1000) / 10 : null

  return {
    period,
    start: range.start,
    end: range.end,
    total,
    consumed: consumedFoods.length,
    discarded: discardedFoods.length,
    wasteRate,
    wasteRateText: wasteRate === null ? '' : `${wasteRate}%`,
    hasRecords: total > 0,
    mostDiscarded: rankDiscarded(discardedFoods)
  }
}

module.exports = {
  PERIOD,
  startOfLocalDay,
  getWeekRange,
  getMonthRange,
  getPeriodRange,
  toTimestamp,
  lifecycleTimestamp,
  rankDiscarded,
  calculateWasteStats
}
