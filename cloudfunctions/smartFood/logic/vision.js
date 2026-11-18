const { normalizeCategory } = require('./categories')

function normalizeConfidence(value) {
  const confidence = Number(value)
  if (!Number.isFinite(confidence)) return null
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100
}

function normalizeFoodCandidate(item) {
  if (!item || typeof item !== 'object') return null
  const name = String(item.name || '').trim().slice(0, 30)
  if (!name) return null
  return { name, category: normalizeCategory(item.category), confidence: normalizeConfidence(item.confidence) }
}

function normalizeVisionResult(result, maxItems = 20) {
  const rows = Array.isArray(result) ? result : result && result.foods
  if (!Array.isArray(rows)) return { foods: [] }
  const seen = new Set()
  const foods = []
  for (const row of rows) {
    const food = normalizeFoodCandidate(row)
    const key = food && food.name.toLowerCase()
    if (!food || seen.has(key)) continue
    seen.add(key)
    foods.push(food)
    if (foods.length >= maxItems) break
  }
  return { foods }
}

module.exports = { normalizeConfidence, normalizeFoodCandidate, normalizeVisionResult }
