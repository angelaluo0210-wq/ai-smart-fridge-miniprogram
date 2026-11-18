// Deprecated compatibility module: 当前新增/导入页面不再读取这些旧云端规则。
// 客户端唯一生效规则位于 miniprogram/utils/foodShelfLifeRules.js。
const DEFAULT_RULES = {
  豆腐: { category: 'soy', storageArea: '冷藏', min: 2, max: 3, days: 3 },
  鸡蛋: { category: 'dairy_egg', storageArea: '冷藏', min: 21, max: 35, days: 21 },
  牛奶: { category: 'dairy_egg', storageArea: '冷藏', min: 3, max: 7, days: 7 },
  西红柿: { category: 'vegetable', storageArea: '冷藏', min: 5, max: 7, days: 7 },
  菠菜: { category: 'vegetable', storageArea: '冷藏', min: 2, max: 3, days: 3 },
  鸡胸肉: { category: 'meat', storageArea: '冷藏', min: 1, max: 2, days: 1 },
  猪肉: { category: 'meat', storageArea: '冷藏', min: 2, max: 3, days: 3 },
  鱼: { category: 'seafood', storageArea: '冷藏', min: 1, max: 2, days: 2 },
  酸奶: { category: 'dairy_egg', storageArea: '冷藏', min: 7, max: 14, days: 14 },
  蘑菇: { category: 'vegetable', storageArea: '冷藏', min: 3, max: 5, days: 5 }
}

// MVP 安全上限只是配置层，不替代产品标签或权威机构的具体判断。
const SAFETY_RULES = {
  豆腐: { min: 2, max: 3 }, 菠菜: { min: 2, max: 3 }, 鸡胸肉: { min: 1, max: 2 },
  猪肉: { min: 2, max: 3 }, 鱼: { min: 1, max: 2 }, 牛奶: { min: 3, max: 7 }
}

function normalizeName(value) { return String(value || '').trim().toLowerCase() }
function positiveInteger(value) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null }

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function capDays(days, safetyRule) {
  const normalized = positiveInteger(days)
  if (!normalized) return null
  const upper = safetyRule && positiveInteger(safetyRule.max)
  return upper ? Math.min(normalized, upper) : normalized
}

function recommendShelfLife({ template, historyDays, safetyRule, defaultRule, fallbackDays = 3 }) {
  const safety = safetyRule || null
  const templateDays = template && positiveInteger(template.default_shelf_life_days)
  if (templateDays) return {
    source: 'template', days: capDays(templateDays, safety),
    category: template.category || defaultRule && defaultRule.category || 'other',
    storageArea: template.default_storage_area || defaultRule && defaultRule.storageArea || '',
    safetyCapped: Boolean(safety && templateDays > safety.max)
  }
  const history = Array.isArray(historyDays) ? historyDays.map(positiveInteger).filter(Boolean) : []
  if (history.length >= 2) {
    const historicalDays = median(history)
    return {
      source: 'history', days: capDays(historicalDays, safety),
      category: defaultRule && defaultRule.category || 'other', storageArea: defaultRule && defaultRule.storageArea || '',
      safetyCapped: Boolean(safety && historicalDays > safety.max), sampleSize: history.length
    }
  }
  if (safety) return { source: 'safety', days: positiveInteger(safety.max), category: defaultRule && defaultRule.category || 'other', storageArea: defaultRule && defaultRule.storageArea || '冷藏', safetyCapped: false }
  if (defaultRule) return { source: 'default', days: positiveInteger(defaultRule.days), category: defaultRule.category || 'other', storageArea: defaultRule.storageArea || '', safetyCapped: false }
  return { source: 'fallback', days: positiveInteger(fallbackDays) || 3, category: 'other', storageArea: '', safetyCapped: false }
}

function matchingRule(name, rules) {
  const normalized = normalizeName(name)
  const key = Object.keys(rules).find(item => normalizeName(item) === normalized)
  return key ? rules[key] : null
}

function normalizeModelExplanation(result, fallback) {
  const explanation = String(result && result.explanation || '').trim().slice(0, 160)
  return explanation || String(fallback || '').slice(0, 160)
}

module.exports = { DEFAULT_RULES, SAFETY_RULES, normalizeName, positiveInteger, median, capDays, recommendShelfLife, matchingRule, normalizeModelExplanation }
