const { getRemainingDays } = require('./date')
const { isInactiveFood } = require('./foodLifecycle')

const STATUS_TEXT = {
  fresh: '新鲜',
  near_expiry: '快过期',
  expired: '已过期',
  consumed: '已食用',
  discarded: '已扔掉'
}

function getFoodStatus(food, today) {
  if (food.status === 'consumed') return 'consumed'
  if (food.status === 'discarded') return 'discarded'
  const days = getRemainingDays(food.expire_date, today)
  if (days < 0) return 'expired'
  if (days <= 2) return 'near_expiry'
  return 'fresh'
}

function getRemainingText(expireDate, today) {
  const days = getRemainingDays(expireDate, today)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `剩余 ${days} 天`
}

function decorateFood(food, today) {
  const computedStatus = getFoodStatus(food, today)
  return {
    ...food,
    computedStatus,
    isInactive: isInactiveFood(food),
    statusText: STATUS_TEXT[computedStatus],
    remainingDays: getRemainingDays(food.expire_date, today),
    remainingText: getRemainingText(food.expire_date, today)
  }
}

module.exports = { STATUS_TEXT, getFoodStatus, getRemainingText, decorateFood }
