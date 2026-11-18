// Phase 2 兼容入口。所有分类、天数和提示规则只维护在 foodShelfLifeRules.js。
const shelfLifeRules = require('./foodShelfLifeRules')

const LEGACY_DEFAULT_NAMES = ['豆腐', '鸡蛋', '牛奶', '西红柿', '菠菜', '鸡胸肉', '猪肉', '鱼', '酸奶', '蘑菇']

const DEFAULT_FOOD_RULES = Object.fromEntries(LEGACY_DEFAULT_NAMES.map(name => {
  const matched = shelfLifeRules.findFoodRuleForInput(name)
  const rule = matched.refrigerated
  return [name, {
    category: shelfLifeRules.inferFoodCategory(name),
    storageArea: '冷藏',
    suggestedDaysMin: rule.minDays,
    suggestedDaysMax: rule.maxDays,
    defaultDays: rule.recommendedDays
  }]
}))

function getDefaultFoodRule(name) {
  const matched = shelfLifeRules.findFoodRuleForInput(name)
  const rule = matched && matched.refrigerated
  return rule ? {
    name: matched.names[0],
    category: shelfLifeRules.inferFoodCategory(name),
    storageArea: '冷藏',
    suggestedDaysMin: rule.minDays,
    suggestedDaysMax: rule.maxDays,
    defaultDays: rule.recommendedDays
  } : null
}

module.exports = { ...shelfLifeRules, DEFAULT_FOOD_RULES, getDefaultFoodRule }
