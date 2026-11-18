const CATEGORIES = [
  { key: 'vegetable', label: '蔬菜' },
  { key: 'fruit', label: '水果' },
  { key: 'meat', label: '肉类' },
  { key: 'seafood', label: '海鲜' },
  { key: 'dairy_egg', label: '蛋奶' },
  { key: 'soy', label: '豆制品' },
  { key: 'staple', label: '主食' },
  { key: 'drink', label: '饮料' },
  { key: 'seasoning', label: '调味品' },
  { key: 'other', label: '其他' }
]

const LEGACY_ALIASES = {
  蔬菜: 'vegetable',
  菜: 'vegetable',
  水果: 'fruit',
  肉: 'meat',
  肉类: 'meat',
  海鲜: 'seafood',
  水产: 'seafood',
  蛋奶: 'dairy_egg',
  奶蛋: 'dairy_egg',
  豆制品: 'soy',
  豆类: 'soy',
  主食: 'staple',
  饮料: 'drink',
  调味品: 'seasoning',
  调料: 'seasoning',
  其他: 'other'
}

function getCategory(key) {
  return CATEGORIES.find(item => item.key === key) || null
}

function normalizeCategoryKey(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'other'
  if (getCategory(raw)) return raw
  return LEGACY_ALIASES[raw] || 'other'
}

function getCategoryLabel(value) {
  const raw = String(value || '').trim()
  if (!raw) return '未分类'
  const category = getCategory(raw)
  if (category) return category.label
  const aliasKey = LEGACY_ALIASES[raw]
  if (aliasKey) return getCategory(aliasKey).label
  return raw
}

function decorateCategory(food) {
  return {
    ...food,
    categoryKey: normalizeCategoryKey(food.category),
    categoryLabel: getCategoryLabel(food.category)
  }
}

module.exports = { CATEGORIES, LEGACY_ALIASES, getCategory, normalizeCategoryKey, getCategoryLabel, decorateCategory }
