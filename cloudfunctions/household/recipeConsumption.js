const { remainingDays } = require('./date')

const INACTIVE = new Set(['expired', 'consumed', 'discarded'])
const UNIT_ALIASES = new Map([
  ['g', 'g'], ['克', 'g'], ['kg', 'kg'], ['千克', 'kg'], ['公斤', 'kg'],
  ['ml', 'ml'], ['毫升', 'ml'], ['l', 'l'], ['升', 'l']
])
const UNIT_FACTORS = { g: 1, kg: 1000, ml: 1, l: 1000 }

function roundQuantity(value) { return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000 }
function hasOperationId(food, operationId) { return Array.isArray(food && food.recipe_operation_ids) && food.recipe_operation_ids.includes(operationId) }
function nextOperationIds(food, operationId) {
  const previous = Array.isArray(food && food.recipe_operation_ids) ? food.recipe_operation_ids : []
  return Array.from(new Set([...previous, operationId])).slice(-20)
}
function ingredientKey(value) { return String(value || '').trim().toLowerCase().replace(/[\s·•，,、。.!！?？_\-—]/g, '') }
function normalizeUnit(value) {
  const raw = String(value || '').trim().toLowerCase()
  return UNIT_ALIASES.get(raw) || raw
}
function unitFamily(unit) {
  const normalized = normalizeUnit(unit)
  if (normalized === 'g' || normalized === 'kg') return 'mass'
  if (normalized === 'ml' || normalized === 'l') return 'volume'
  return normalized ? `exact:${normalized}` : ''
}
function canConvertUnit(fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  return Boolean(from && to && (from === to || unitFamily(from) === unitFamily(to)))
}
function convertQuantity(quantity, fromUnit, toUnit) {
  const number = Number(quantity)
  if (!Number.isFinite(number) || !canConvertUnit(fromUnit, toUnit)) return null
  const from = normalizeUnit(fromUnit)
  const to = normalizeUnit(toUnit)
  if (from === to) return roundQuantity(number)
  return roundQuantity(number * UNIT_FACTORS[from] / UNIT_FACTORS[to])
}
function parseIngredientAmount(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d+(?:\.\d+)?)\s*([^\d\s].*)?$/)
  if (!match) return { quantity: 0, unit: '', estimated: false }
  return { quantity: Number(match[1]), unit: String(match[2] || '').trim(), estimated: true }
}
function namesMatch(foodName, ingredientName) {
  const food = ingredientKey(foodName)
  const ingredient = ingredientKey(ingredientName)
  return Boolean(food && ingredient && (food === ingredient || (Math.min(food.length, ingredient.length) >= 2 && (food.includes(ingredient) || ingredient.includes(food)))))
}
function isUsableFood(food, today) {
  const quantity = Number(food && food.quantity)
  if (!food || INACTIVE.has(String(food.status || '')) || !Number.isFinite(quantity) || quantity <= 0 || !food.name || !food.unit) return false
  try { return remainingDays(food.expire_date, today) >= 0 } catch (error) { return false }
}
function expiredFoodsForCleanup(foods, today) {
  return (Array.isArray(foods) ? foods : []).filter(food => {
    if (!food || food.status === 'consumed' || food.status === 'discarded') return false
    try { return remainingDays(food.expire_date, today) < 0 } catch (error) { return false }
  })
}
function fefoRows(foods, ingredientName, today) {
  return (Array.isArray(foods) ? foods : []).filter(food => isUsableFood(food, today) && namesMatch(food.name, ingredientName))
    .sort((a, b) => remainingDays(a.expire_date, today) - remainingDays(b.expire_date, today) || String(a._id).localeCompare(String(b._id)))
}
function normalizeRequestedIngredients(ingredients) {
  const rows = (Array.isArray(ingredients) ? ingredients : []).map(item => ({
    name: String(item && item.name || '').trim().slice(0, 30),
    quantity: Number(item && item.quantity),
    unit: String(item && item.unit || '').trim().slice(0, 10)
  })).filter(item => item.name)
  if (rows.length > 20) throw new Error('一次最多处理 20 种食材')
  rows.forEach(item => {
    if (!Number.isFinite(item.quantity) || item.quantity < 0) throw new Error(`${item.name}的实际消耗量必须大于或等于 0`)
    if (item.quantity > 0 && !item.unit) throw new Error(`请填写${item.name}的消耗单位`)
  })
  return rows
}
function recipeIngredients(recipe) {
  const stocked = Array.isArray(recipe && recipe.stockedIngredients) ? recipe.stockedIngredients : []
  return stocked.slice(0, 20).map(item => {
    const parsed = parseIngredientAmount(item && item.amount)
    return { name: String(item && item.name || '').trim().slice(0, 30), ...parsed }
  }).filter(item => item.name)
}
function previewConsumption(foods, ingredients, today) {
  return (Array.isArray(ingredients) ? ingredients : []).map(item => {
    const matches = fefoRows(foods, item.name, today)
    const preferredUnit = String(item.unit || (matches[0] && matches[0].unit) || '').trim()
    const compatible = matches.filter(food => canConvertUnit(food.unit, preferredUnit))
    const inventoryQuantity = roundQuantity(compatible.reduce((total, food) => total + convertQuantity(food.quantity, food.unit, preferredUnit), 0))
    const requested = Number.isFinite(Number(item.quantity)) ? Math.max(0, Number(item.quantity)) : 0
    const mismatch = matches.length > 0 && compatible.length === 0
    return {
      name: item.name, quantity: requested, unit: preferredUnit, estimated: Boolean(item.estimated),
      inventoryQuantity, shortage: roundQuantity(Math.max(0, requested - inventoryQuantity)),
      mismatch, warning: mismatch ? '单位不一致，请确认实际使用量和单位' : '', batchCount: compatible.length
    }
  })
}
function buildDeductionPlan(foods, ingredients, today) {
  const remainingById = new Map((Array.isArray(foods) ? foods : []).map(food => [food._id, Number(food.quantity)]))
  const deductions = []
  const summaries = []
  for (const ingredient of normalizeRequestedIngredients(ingredients)) {
    let needed = ingredient.quantity
    const matches = fefoRows(foods, ingredient.name, today)
    const compatible = matches.filter(food => canConvertUnit(food.unit, ingredient.unit))
    if (needed > 0 && matches.length && !compatible.length) throw new Error(`${ingredient.name}单位不一致，请确认实际使用量`)
    for (const food of compatible) {
      if (needed <= 0) break
      const current = remainingById.get(food._id)
      const availableInRequestedUnit = convertQuantity(current, food.unit, ingredient.unit)
      const usedInRequestedUnit = Math.min(needed, availableInRequestedUnit)
      const usedInFoodUnit = convertQuantity(usedInRequestedUnit, ingredient.unit, food.unit)
      const nextQuantity = roundQuantity(Math.max(0, current - usedInFoodUnit))
      if (usedInFoodUnit > 0) deductions.push({ foodId: food._id, name: food.name, used: usedInFoodUnit, unit: food.unit, before: current, after: nextQuantity })
      remainingById.set(food._id, nextQuantity)
      needed = roundQuantity(Math.max(0, needed - usedInRequestedUnit))
    }
    summaries.push({ name: ingredient.name, requested: ingredient.quantity, unit: ingredient.unit, shortage: needed })
  }
  return { deductions, summaries }
}

module.exports = {
  INACTIVE, normalizeUnit, canConvertUnit, convertQuantity, parseIngredientAmount, namesMatch, hasOperationId, nextOperationIds,
  isUsableFood, expiredFoodsForCleanup, normalizeRequestedIngredients, recipeIngredients, previewConsumption, buildDeductionPlan
}
