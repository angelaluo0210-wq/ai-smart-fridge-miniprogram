const assert = require('assert')
const { DEFAULT_RULES, median, capDays, recommendShelfLife, normalizeModelExplanation } = require('../cloudfunctions/smartFood/logic/shelfLife')
const { DEFAULT_FOOD_RULES } = require('../miniprogram/utils/defaultFoods')

Object.entries(DEFAULT_FOOD_RULES).forEach(([name, localRule]) => {
  assert.deepStrictEqual(DEFAULT_RULES[name], {
    category: localRule.category,
    storageArea: localRule.storageArea,
    min: localRule.suggestedDaysMin,
    max: localRule.suggestedDaysMax,
    days: localRule.defaultDays
  }, `${name} client and cloud default rules stay aligned`)
})

assert.strictEqual(median([2, 3, 4]), 3)
assert.strictEqual(median([2, 4]), 3)
assert.strictEqual(capDays(10, { max: 3 }), 3)

const template = recommendShelfLife({
  template: { default_shelf_life_days: 5, category: 'soy', default_storage_area: '冷藏上层' },
  historyDays: [2, 2, 3], safetyRule: { max: 3 }, defaultRule: { days: 3, category: 'soy', storageArea: '冷藏' }
})
assert.strictEqual(template.source, 'template')
assert.strictEqual(template.days, 3)
assert.strictEqual(template.safetyCapped, true)
assert.strictEqual(template.storageArea, '冷藏上层')

const history = recommendShelfLife({ historyDays: [2, 3, 10], safetyRule: { max: 3 }, defaultRule: { days: 5, category: 'vegetable', storageArea: '冷藏' } })
assert.strictEqual(history.source, 'history')
assert.strictEqual(history.days, 3)
assert.strictEqual(history.sampleSize, 3)

const cappedHistory = recommendShelfLife({ historyDays: [8, 10, 12], safetyRule: { max: 3 }, defaultRule: null })
assert.strictEqual(cappedHistory.days, 3, 'personal history never exceeds safety upper bound')
assert.strictEqual(cappedHistory.safetyCapped, true)

assert.deepStrictEqual(recommendShelfLife({ safetyRule: { max: 2 }, historyDays: [1] }), {
  source: 'safety', days: 2, category: 'other', storageArea: '冷藏', safetyCapped: false
})
assert.strictEqual(recommendShelfLife({ defaultRule: { days: 7, category: 'fruit', storageArea: '冷藏' } }).source, 'default')
assert.deepStrictEqual(recommendShelfLife({ fallbackDays: 4 }), {
  source: 'fallback', days: 4, category: 'other', storageArea: '', safetyCapped: false
})
assert.strictEqual(normalizeModelExplanation({ explanation: '  建议冷藏并尽快食用  ' }, 'fallback'), '建议冷藏并尽快食用')
assert.strictEqual(normalizeModelExplanation({}, '确定性说明'), '确定性说明')

console.log('Phase 3 Step 6 模板、历史、安全上限、默认规则和 fallback 测试全部通过')
