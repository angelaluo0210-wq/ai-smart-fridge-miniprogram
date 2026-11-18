const crypto = require('crypto')

const INACTIVE = new Set(['expired', 'consumed', 'discarded'])
const PANTRY_BASICS = new Set(['盐', '油', '水', '食用油'])

function recipeCandidates(foods, remainingDaysForFood) {
  const candidates = []
  for (const food of Array.isArray(foods) ? foods : []) {
    if (!food || INACTIVE.has(food.status)) continue
    const quantity = Number(food.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0 || !String(food.name || '').trim() || !String(food.unit || '').trim()) continue
    try {
      const remainingDays = remainingDaysForFood(food)
      if (Number.isInteger(remainingDays) && remainingDays >= 0) candidates.push({ food, remainingDays })
    } catch (error) { /* 单条旧数据日期异常不阻塞整份推荐。 */ }
  }
  return candidates.sort((a, b) => a.remainingDays - b.remainingDays || String(a.food.name).localeCompare(String(b.food.name), 'zh-CN'))
}

function inventoryFingerprint(candidates) {
  const rows = (Array.isArray(candidates) ? candidates : []).map(item => ({
    id: String(item.food && item.food._id || ''),
    name: String(item.food && item.food.name || '').trim().toLowerCase(),
    status: String(item.food && item.food.status || ''),
    expireDate: String(item.food && item.food.expire_date || ''),
    fridgeId: String(item.food && item.food.fridge_id || ''),
    storage: String(item.food && item.food.storage_area || '').trim().toLowerCase(),
    category: String(item.food && item.food.category || '').trim().toLowerCase(),
    quantity: Number.isFinite(Number(item.food && item.food.quantity)) ? Number(item.food.quantity) : null,
    unit: String(item.food && item.food.unit || '').trim().toLowerCase()
  })).sort((a, b) => a.id.localeCompare(b.id))
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 24)
}

function compactInventory(candidates, maxItems = 30) {
  return candidates.slice(0, maxItems).map(item => {
    const quantity = Number(item.food.quantity)
    const hasQuantity = item.food.quantity !== undefined && item.food.quantity !== null && item.food.quantity !== '' && Number.isFinite(quantity)
    return {
      name: String(item.food.name || '').slice(0, 30),
      remaining_days: item.remainingDays,
      ...(hasQuantity ? { quantity } : {}),
      ...(item.food.unit ? { unit: String(item.food.unit).slice(0, 10) } : {})
    }
  }).filter(item => item.name)
}

function normalizeStringList(value, maxItems, maxLength = 100) {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems)
}

function normalizeRecipe(result, inventory) {
  if (!result || typeof result !== 'object') return null
  const title = String(result.title || '').trim().slice(0, 50)
  const steps = normalizeStringList(result.steps, 10, 200)
  if (!title || !steps.length) return null
  const inventoryNames = new Set((inventory || []).map(item => String(item.name || '').trim().toLowerCase()).filter(Boolean))
  const ingredients = (Array.isArray(result.ingredients) ? result.ingredients : []).map(item => ({
    name: String(typeof item === 'string' ? item : item && item.name || '').trim().slice(0, 30),
    amount: String(typeof item === 'object' && item && item.amount || '').trim().slice(0, 30)
  })).filter(item => item.name).slice(0, 20)
  const stockedIngredients = []
  const additionalIngredients = []
  ingredients.forEach(item => {
    const normalized = item.name.toLowerCase()
    if (inventoryNames.has(normalized) || PANTRY_BASICS.has(item.name)) stockedIngredients.push(item)
    else additionalIngredients.push(item)
  })
  let priorityIngredients = normalizeStringList(result.priorityIngredients, 8, 30)
    .filter(name => inventoryNames.has(name.toLowerCase()))
  if (!priorityIngredients.length) priorityIngredients = stockedIngredients.map(item => item.name).slice(0, 4)
  const minutes = Number(result.estimatedMinutes)
  return {
    title,
    summary: String(result.summary || result.reason || '').trim().slice(0, 160),
    priorityIngredients,
    stockedIngredients,
    additionalIngredients,
    steps,
    estimatedMinutes: Number.isInteger(minutes) && minutes >= 5 && minutes <= 180 ? minutes : null
  }
}

function normalizeRecipeTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s·•，,、。.!！?？_\-—]/g, '')
}

function normalizeRecipeBatch(result, inventory, maxItems = 3, excludedTitles = []) {
  const source = Array.isArray(result) ? result : (result && Array.isArray(result.recipes) ? result.recipes : [])
  const titles = new Set((Array.isArray(excludedTitles) ? excludedTitles : []).map(normalizeRecipeTitle).filter(Boolean))
  return source.map(item => normalizeRecipe(item, inventory)).filter(recipe => {
    if (!recipe) return false
    const title = normalizeRecipeTitle(recipe.title)
    if (titles.has(title)) return false
    titles.add(title)
    return true
  }).slice(0, maxItems)
}

function recipesFromCache(cached) {
  if (!cached || typeof cached !== 'object') return []
  if (Array.isArray(cached.recipes)) return cached.recipes.filter(Boolean)
  return cached.recipe ? [cached.recipe] : []
}

function canUseRecipeCache(cached, forceRefresh) {
  return forceRefresh !== true && recipesFromCache(cached).length > 0
}

module.exports = {
  INACTIVE, PANTRY_BASICS, recipeCandidates, inventoryFingerprint, compactInventory,
  normalizeRecipe, normalizeRecipeTitle, normalizeRecipeBatch, recipesFromCache, canUseRecipeCache
}
