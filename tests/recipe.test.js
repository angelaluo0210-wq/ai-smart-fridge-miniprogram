const assert = require('assert')
const {
  recipeCandidates, inventoryFingerprint, compactInventory, normalizeRecipe, normalizeRecipeTitle, normalizeRecipeBatch,
  recipesFromCache, canUseRecipeCache
} = require('../cloudfunctions/smartFood/logic/recipe')
const smartAccess = require('../cloudfunctions/smartFood/access')
const householdAccess = require('../cloudfunctions/household/access')
const { recipeMessages, buildRecipeRequest } = require('../cloudfunctions/smartFood/providers/llmProvider')

const foods = [
  { _id: 'fresh', name: '鸡蛋', quantity: 6, unit: '个', status: 'fresh', expire_date: '2026-08-30', fridge_id: 'f1', days: 5 },
  { _id: 'day2', name: '西红柿', quantity: 4, unit: '个', status: 'fresh', expire_date: '2026-08-27', fridge_id: 'f1', days: 2 },
  { _id: 'today', name: '豆腐', quantity: 1, unit: '盒', status: 'fresh', expire_date: '2026-08-25', fridge_id: 'f1', days: 0 },
  { _id: 'zero', name: '零库存', quantity: 0, unit: '个', status: 'fresh', expire_date: '2026-08-30', fridge_id: 'f1', days: 5 },
  { _id: 'expired', name: '坏牛奶', quantity: 1, unit: '盒', status: 'fresh', expire_date: '2026-08-24', fridge_id: 'f1', days: -1 },
  { _id: 'stored-expired', name: '旧记录', quantity: 1, unit: '个', status: 'expired', expire_date: '2026-08-30', fridge_id: 'f1', days: 5 },
  { _id: 'bad-date', name: '日期异常', quantity: 1, unit: '个', status: 'fresh', expire_date: 'bad', fridge_id: 'f1', days: 3 },
  { _id: 'consumed', name: '菠菜', quantity: 1, unit: '把', status: 'consumed', expire_date: '2026-08-25', fridge_id: 'f1', days: 0 },
  { _id: 'discarded', name: '蘑菇', quantity: 1, unit: '盒', status: 'discarded', expire_date: '2026-08-25', fridge_id: 'f1', days: 0 }
]
const candidates = recipeCandidates(foods, food => { if (food._id === 'bad-date') throw new Error('invalid date'); return food.days })
assert.deepStrictEqual(candidates.map(item => item.food._id), ['today', 'day2', 'fresh'])
assert.deepStrictEqual(compactInventory(candidates), [
  { name: '豆腐', remaining_days: 0, quantity: 1, unit: '盒' },
  { name: '西红柿', remaining_days: 2, quantity: 4, unit: '个' },
  { name: '鸡蛋', remaining_days: 5, quantity: 6, unit: '个' }
])
const fingerprint = inventoryFingerprint(candidates)
assert.strictEqual(fingerprint, inventoryFingerprint(candidates.slice().reverse()), 'input order does not invalidate cache')
assert.notStrictEqual(fingerprint, inventoryFingerprint(candidates.map(item => item.food._id === 'today' ? { ...item, food: { ...item.food, expire_date: '2026-08-26' } } : item)), 'expiry change invalidates cache')
assert.notStrictEqual(fingerprint, inventoryFingerprint(candidates.slice(1)), 'accessible inventory change invalidates cache')
assert.notStrictEqual(fingerprint, inventoryFingerprint(candidates.map(item => item.food._id === 'today' ? { ...item, food: { ...item.food, quantity: 2 } } : item)), 'quantity change invalidates cache')
assert.notStrictEqual(fingerprint, inventoryFingerprint(candidates.map(item => item.food._id === 'today' ? { ...item, food: { ...item.food, storage_area: '冷冻' } } : item)), 'storage change invalidates cache')

const recipe = normalizeRecipe({
  title: '番茄豆腐', summary: '优先处理豆腐', priorityIngredients: ['豆腐', '不存在'],
  ingredients: [{ name: '豆腐', amount: '1盒' }, { name: '盐', amount: '少许' }, { name: '葱', amount: '1根' }],
  steps: ['切块', '加热'], estimatedMinutes: 20
}, compactInventory(candidates))
assert.deepStrictEqual(recipe.priorityIngredients, ['豆腐'])
assert.deepStrictEqual(recipe.stockedIngredients.map(item => item.name), ['豆腐', '盐'])
assert.deepStrictEqual(recipe.additionalIngredients.map(item => item.name), ['葱'])
assert.strictEqual(normalizeRecipe({ title: '', steps: [] }, []), null)
const lightweightRecipe = normalizeRecipe({
  title: '番茄炒蛋', reason: '优先处理西红柿', ingredients: ['西红柿', '鸡蛋', '盐'], steps: ['切番茄', '炒鸡蛋', '合炒']
}, compactInventory(candidates))
assert.strictEqual(lightweightRecipe.summary, '优先处理西红柿')
assert.deepStrictEqual(lightweightRecipe.stockedIngredients.map(item => item.name), ['西红柿', '鸡蛋', '盐'])
assert.deepStrictEqual(lightweightRecipe.priorityIngredients, ['西红柿', '鸡蛋', '盐'])
const batch = normalizeRecipeBatch({ recipes: [
  { title: '番茄豆腐', ingredients: [{ name: '豆腐' }], steps: ['煮'] },
  { title: '菠菜炒蛋', ingredients: [{ name: '鸡蛋' }], steps: ['炒'] },
  { title: '番茄豆腐', ingredients: [{ name: '豆腐' }], steps: ['重复'] },
  { title: '蒸鸡蛋', ingredients: [{ name: '鸡蛋' }], steps: ['蒸'] }
] }, compactInventory(candidates))
assert.deepStrictEqual(batch.map(item => item.title), ['番茄豆腐', '菠菜炒蛋', '蒸鸡蛋'], 'single response yields up to three unique recipes')
assert.strictEqual(normalizeRecipeTitle(' 番茄-豆腐！'), '番茄豆腐')
assert.deepStrictEqual(normalizeRecipeBatch({ recipes: [
  { title: '番茄豆腐', ingredients: [], steps: ['旧菜'] },
  { title: '蒸鸡蛋', ingredients: [], steps: ['新菜'] }
] }, compactInventory(candidates), 3, ['番茄 豆腐']), [normalizeRecipe({ title: '蒸鸡蛋', ingredients: [], steps: ['新菜'] }, compactInventory(candidates))], 'refresh excludes prior titles after normalization')
assert.deepStrictEqual(recipesFromCache({ recipe }), [recipe], 'legacy single-recipe cache stays readable')
assert.strictEqual(canUseRecipeCache({ recipes: batch }, false), true, 'same fingerprint cache skips provider')
assert.strictEqual(canUseRecipeCache({ recipes: batch }, true), false, 'explicit refresh bypasses cache')
const refreshMessages = recipeMessages(compactInventory(candidates), ['番茄豆腐', '菠菜炒蛋'])
assert.ok(refreshMessages[1].content.includes('["番茄豆腐","菠菜炒蛋"]'), 'previous recipe titles are sent as an exclusion list')
assert.ok(refreshMessages[0].content.includes('避开上一批菜名'), 'refresh prompt explicitly forbids previous titles')
const refreshRequest = buildRecipeRequest(compactInventory(candidates), { forceRefresh: true, excludedTitles: ['番茄豆腐'] })
assert.strictEqual(refreshRequest.maxTokens, 1400)
assert.strictEqual(refreshRequest.temperature, 0.5)
assert.ok(refreshRequest.promptChars < 600, 'lightweight prompt stays compact for representative inventory')

const fridge = { _id: 'f1', created_by: 'owner', household_id: 'h1', visibility: 'selected' }
for (const [openid, context] of [
  ['owner', { householdId: '', selectedFridgeIds: new Set() }],
  ['member', { householdId: 'h1', selectedFridgeIds: new Set(['f1']) }],
  ['other', { householdId: 'h1', selectedFridgeIds: new Set() }],
  ['outsider', { householdId: '', selectedFridgeIds: new Set(['f1']) }]
]) {
  assert.strictEqual(smartAccess.canAccessFridge(openid, fridge, context), householdAccess.canAccessFridge(openid, fridge, context))
}

console.log('Phase 3 Step 4 菜谱候选、排除规则、缓存指纹和结构验证测试全部通过')
