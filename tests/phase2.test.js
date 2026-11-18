const assert = require('assert')
const { CATEGORIES, normalizeCategoryKey, getCategoryLabel, decorateCategory } = require('../miniprogram/utils/categories')
const { isActiveFood, isInactiveFood } = require('../miniprogram/utils/foodLifecycle')
const { getFoodStatus } = require('../miniprogram/utils/foodStatus')
const { DEFAULT_FOOD_RULES, getDefaultFoodRule, normalizeFoodName } = require('../miniprogram/utils/defaultFoods')
const { buildDailySummary } = require('../miniprogram/utils/foodSummary')

assert.strictEqual(CATEGORIES.length, 10)
assert.strictEqual(normalizeCategoryKey('vegetable'), 'vegetable')
assert.strictEqual(normalizeCategoryKey('蔬菜'), 'vegetable')
assert.strictEqual(normalizeCategoryKey('菜'), 'vegetable')
assert.strictEqual(normalizeCategoryKey('未知旧分类'), 'other')
assert.strictEqual(normalizeCategoryKey(), 'other')
assert.strictEqual(getCategoryLabel('未知旧分类'), '未知旧分类')
assert.strictEqual(getCategoryLabel(), '未分类')
assert.strictEqual(decorateCategory({ name: '旧食材' }).categoryLabel, '未分类')

assert.strictEqual(isActiveFood({ status: 'fresh' }), true)
assert.strictEqual(isActiveFood({}), true)
assert.strictEqual(isInactiveFood({ status: 'consumed' }), true)
assert.strictEqual(isInactiveFood({ status: 'discarded' }), true)
assert.strictEqual(getFoodStatus({ status: 'discarded', expire_date: '2026-08-25' }, '2026-08-24'), 'discarded')

assert.strictEqual(Object.keys(DEFAULT_FOOD_RULES).length, 10)
assert.strictEqual(getDefaultFoodRule(' 豆腐 ').category, 'soy')
assert.strictEqual(getDefaultFoodRule('豆腐').defaultDays, 3)
assert.strictEqual(getDefaultFoodRule('不存在的食材'), null)
assert.strictEqual(normalizeFoodName(' 牛奶 '), '牛奶')

const templates = [{ name: '豆腐', default_shelf_life_days: 5 }]
const template = templates.find(item => normalizeFoodName(item.name) === normalizeFoodName('豆腐'))
assert.strictEqual(template.default_shelf_life_days, 5)
assert.strictEqual(getDefaultFoodRule('豆腐').defaultDays, 3)

assert.deepStrictEqual(buildDailySummary([
  { remainingDays: 0 }, { remainingDays: 1 }, { remainingDays: 2 },
  { remainingDays: 3 }, { remainingDays: -1 }
]), { todayDue: 1, upcoming: 2, expired: 1 })

console.log('Phase 2 分类、生命周期、旧数据兼容、默认规则和每日总结测试全部通过')
