const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  FOOD_SHELF_LIFE_RULES,
  STORAGE_MODES,
  inferFoodCategory,
  inferStorageMode,
  recommendFoodShelfLife,
  recommendedDaysValue
} = require('../miniprogram/utils/foodShelfLifeRules')
const { calculateExpireDate } = require('../miniprogram/utils/date')
const { CATEGORIES } = require('../miniprogram/utils/categories')

const validCategories = new Set(CATEGORIES.map(item => item.key))
assert.ok(FOOD_SHELF_LIFE_RULES.length >= 100 && FOOD_SHELF_LIFE_RULES.length <= 120)
const aliasOwners = new Map()
for (const rule of FOOD_SHELF_LIFE_RULES) {
  assert.ok(validCategories.has(rule.category), `${rule.id} uses an existing category enum: ${rule.category}`)
  for (const name of rule.names) {
    const normalized = String(name).trim().toLowerCase()
    assert.ok(normalized, `${rule.id} has no empty alias`)
    assert.ok(!aliasOwners.has(normalized), `${normalized} is not shared by ${aliasOwners.get(normalized)} and ${rule.id}`)
    aliasOwners.set(normalized, rule.id)
  }
  for (const storageKey of ['refrigerated', 'frozen', 'roomTemperature']) {
    const recommendation = rule[storageKey]
    if (!recommendation || !Number.isInteger(recommendation.recommendedDays)) continue
    assert.ok(Number.isInteger(recommendation.minDays) && Number.isInteger(recommendation.maxDays), `${rule.id}.${storageKey} has an integer range`)
    assert.ok(recommendation.minDays <= recommendation.recommendedDays, `${rule.id}.${storageKey} recommendedDays is above minDays`)
    assert.ok(recommendation.recommendedDays <= recommendation.maxDays, `${rule.id}.${storageKey} recommendedDays is below maxDays`)
    assert.ok(['safety', 'quality', 'storage'].includes(recommendation.type), `${rule.id}.${storageKey} has a known advice type`)
    if (storageKey === 'frozen') assert.strictEqual(recommendation.type, 'quality', `${rule.id} frozen duration is quality only`)
  }
}
assert.ok(aliasOwners.size >= 600, 'the rule library has broad alias coverage')
assert.deepStrictEqual(
  STORAGE_MODES.map(item => [item.key, item.ruleKey]),
  [['refrigerated', 'refrigerated'], ['frozen', 'frozen'], ['room', 'roomTemperature']]
)

function exact(name, storageMode = 'refrigerated') {
  return recommendFoodShelfLife({ name, storageMode })
}

assert.strictEqual(inferFoodCategory('虾'), 'seafood')
assert.strictEqual(inferFoodCategory('鲈鱼'), 'seafood')
assert.strictEqual(inferFoodCategory('牛肉'), 'meat')
assert.strictEqual(inferFoodCategory('鸡肉'), 'meat')
assert.strictEqual(inferFoodCategory('牛奶'), 'dairy_egg')
assert.strictEqual(inferFoodCategory('苹果'), 'fruit')
assert.strictEqual(inferFoodCategory('西红柿'), 'vegetable')

const coverageCases = {
  vegetable: ['菠菜', '西兰花', '黄瓜', '西红柿', '茄子', '蘑菇', '芹菜', '生菜'],
  fruit: ['苹果', '葡萄', '草莓', '蓝莓', '西瓜'],
  dairy_egg: ['牛奶', '酸奶', 'mozzarella', 'cheddar'],
  soy: ['豆腐', '豆浆'],
  staple: ['熟米饭', '熟面条', '面包'],
  meat: ['鸡胸肉', '五花肉', '牛肉'],
  seafood: ['虾仁', '三文鱼', '鲈鱼']
}
for (const [category, names] of Object.entries(coverageCases)) {
  for (const name of names) {
    const recommendation = exact(name)
    assert.ok(recommendation, `${name} has a refrigerated recommendation`)
    assert.strictEqual(inferFoodCategory(name), category, `${name} maps to ${category}`)
    assert.ok(Number.isInteger(recommendation.recommendedDays) && recommendation.recommendedDays > 0, `${name} has valid recommendedDays`)
    assert.ok(recommendation.minDays <= recommendation.recommendedDays && recommendation.recommendedDays <= recommendation.maxDays, `${name} recommendation stays in range`)
    assert.ok(recommendation.text.includes(String(recommendation.recommendedDays)), `${name} text uses the same recommendedDays`)
  }
}
for (const name of coverageCases.vegetable.concat(coverageCases.fruit)) assert.strictEqual(exact(name).adviceType, 'quality', `${name} is a quality recommendation`)
for (const name of coverageCases.soy) assert.strictEqual(exact(name).adviceType, 'quality', `${name} is a quality recommendation`)
for (const name of coverageCases.dairy_egg) assert.ok(['storage', 'quality'].includes(exact(name).adviceType), `${name} avoids an absolute safety claim`)
for (const name of coverageCases.meat.concat(coverageCases.seafood, ['熟米饭', '熟面条'])) assert.strictEqual(exact(name).adviceType, 'safety', `${name} is a safety recommendation`)
assert.strictEqual(exact('切开的西瓜').adviceType, 'safety')
assert.strictEqual(exact('西瓜').adviceType, 'quality')
assert.notStrictEqual(exact('切开的西瓜').matchedName, exact('西瓜').matchedName)
assert.strictEqual(exact('开封牛奶').recommendedDays, 3)
assert.strictEqual(exact('牛奶').recommendedDays, 7)
assert.notStrictEqual(exact('开封牛奶').matchedName, exact('牛奶').matchedName)
for (const name of ['炒饭', '粥', '熟面条', '熟意大利面', '熟饺子']) {
  assert.deepStrictEqual([exact(name).minDays, exact(name).maxDays, exact(name).recommendedDays], [3, 4, 3], `${name} reuses the cooked-leftovers range`)
}
for (const name of ['broccoli', 'milk', 'spinach', 'shrimp', 'salmon fillet']) assert.ok(exact(name), `${name} English alias matches`)

assert.deepStrictEqual(
  { days: exact('虾').days, min: exact('虾').minDays, max: exact('虾').maxDays, source: exact('虾').source },
  { days: 3, min: 3, max: 5, source: 'exact' }
)
assert.strictEqual(exact('虾', 'frozen').days, 180)
assert.strictEqual(exact('牛奶').days, 7)
assert.strictEqual(exact('鸡蛋').days, 21)
assert.strictEqual(exact('胡萝卜').recommendedDays, 14)
assert.match(exact('胡萝卜').text, /^保鲜建议：/)
assert.match(exact('虾').text, /^食品安全建议：/)
assert.match(exact('虾', 'frozen').text, /^保鲜建议：/)
assert.ok(exact('虾').text.includes(String(exact('虾').recommendedDays)))
assert.deepStrictEqual(
  { days: exact('熟米饭').days, min: exact('熟米饭').minDays, max: exact('熟米饭').maxDays },
  { days: 3, min: 3, max: 4 }
)

assert.strictEqual(exact('规则库里没有的食材'), null)
const categoryFallback = recommendFoodShelfLife({ name: '新鲜海产', category: 'seafood', storageMode: 'refrigerated' })
assert.strictEqual(categoryFallback, null)

const shrimpRecommendation = exact('虾')
assert.strictEqual(recommendedDaysValue('9', shrimpRecommendation, true), '9')
assert.strictEqual(recommendedDaysValue('9', shrimpRecommendation, false), '3')
assert.strictEqual(recommendedDaysValue('9', shrimpRecommendation, true, true), '3')

const template = { category: 'seafood', default_storage_area: '冷藏区', default_shelf_life_days: 4 }
assert.strictEqual(recommendFoodShelfLife({ name: '虾', storageMode: 'refrigerated', template }).source, 'template')
assert.strictEqual(recommendFoodShelfLife({ name: '虾', storageMode: 'refrigerated', template }).days, 4)
assert.strictEqual(recommendFoodShelfLife({ name: '虾', storageMode: 'frozen', template }).source, 'exact')

assert.strictEqual(inferStorageMode('', { name: '冷冻柜' }), 'frozen')
assert.strictEqual(inferStorageMode('冷藏室上层'), 'refrigerated')
assert.strictEqual(calculateExpireDate('2026-08-26', 2), '2026-08-28')
assert.strictEqual(calculateExpireDate('2026-03-28', 2), '2026-03-30')

for (const pageFile of ['pages/add-food/add-food.js', 'pages/import-review/import-review.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', pageFile), 'utf8')
  assert.ok(source.includes("utils/foodShelfLifeRules"), `${pageFile} uses the unified rule module`)
  assert.ok(!source.includes("services/smartFood"), `${pageFile} does not call the deprecated cloud recommendation`)
}
const addFoodSource = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/add-food/add-food.js'), 'utf8')
assert.ok(addFoodSource.includes('preserveManualDays: this.shelfLifeManuallyEdited'), 'automatic template matching preserves manual shelf-life days')

console.log('food recommendation tests passed')
