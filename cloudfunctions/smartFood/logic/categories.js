const CATEGORIES = new Set(['vegetable', 'fruit', 'meat', 'seafood', 'dairy_egg', 'soy', 'staple', 'drink', 'seasoning', 'other'])
const ALIASES = {
  蔬菜: 'vegetable', 水果: 'fruit', 肉类: 'meat', 肉: 'meat', 海鲜: 'seafood', 水产: 'seafood',
  蛋奶: 'dairy_egg', 奶蛋: 'dairy_egg', 豆制品: 'soy', 豆类: 'soy', 主食: 'staple',
  饮料: 'drink', 调味品: 'seasoning', 调料: 'seasoning', 其他: 'other'
}

function normalizeCategory(value) {
  const category = String(value || '').trim()
  if (CATEGORIES.has(category)) return category
  return ALIASES[category] || 'other'
}

module.exports = { CATEGORIES, ALIASES, normalizeCategory }
