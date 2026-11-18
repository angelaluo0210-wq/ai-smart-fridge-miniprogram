function buildDailySummary(foods) {
  const list = Array.isArray(foods) ? foods : []
  return {
    todayDue: list.filter(food => food.remainingDays === 0).length,
    upcoming: list.filter(food => food.remainingDays >= 1 && food.remainingDays <= 2).length,
    expired: list.filter(food => food.remainingDays < 0).length
  }
}

module.exports = { buildDailySummary }
