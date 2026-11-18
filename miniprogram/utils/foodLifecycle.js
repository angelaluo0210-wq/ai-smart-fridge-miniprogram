const INACTIVE_STATUSES = ['consumed', 'discarded']

function isInactiveFood(food) {
  return Boolean(food && INACTIVE_STATUSES.includes(food.status))
}

function isActiveFood(food) {
  return !isInactiveFood(food)
}

module.exports = { INACTIVE_STATUSES, isInactiveFood, isActiveFood }
