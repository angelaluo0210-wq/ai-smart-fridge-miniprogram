const assert = require('assert')
const {
  CLASSIC_RECIPES,
  canMakeRecipe,
  scoreRecipe,
  findClassicRecipeCandidates,
  getRecipeBatch
} = require('../miniprogram/utils/classicRecipes')
const { canonicalizeIngredientName } = require('../miniprogram/utils/foodShelfLifeRules')

assert.strictEqual(CLASSIC_RECIPES.length, 175, 'only complete recipe objects are retained')
assert.strictEqual(new Set(CLASSIC_RECIPES.map(recipe => recipe.id)).size, CLASSIC_RECIPES.length, 'recipe ids must be unique')
assert.ok(CLASSIC_RECIPES.every(recipe => recipe.title && recipe.requiredIngredients.length && recipe.steps.length), 'every recipe is complete')

assert.deepStrictEqual(canonicalizeIngredientName('鲜虾'), {
  normalizedName: '鲜虾', canonicalName: '虾', ruleId: 'shrimp_crayfish'
})
assert.strictEqual(canonicalizeIngredientName('开封牛奶').ruleId, 'milk_opened', 'opened state remains distinct')
assert.strictEqual(canonicalizeIngredientName('切开的西瓜').ruleId, 'watermelon_cut', 'cut state remains distinct')
assert.strictEqual(canonicalizeIngredientName('蒜').canonicalName, '蒜', 'same shelf-life rule does not make garlic equal ginger')
assert.strictEqual(canonicalizeIngredientName('鸡翅').canonicalName, '鸡翅', 'specific poultry cuts remain distinct for recipes')
assert.strictEqual(canonicalizeIngredientName('饺子皮').ruleId, '', 'partial shelf-life matches are not used for recipes')
assert.deepStrictEqual(canonicalizeIngredientName('  自制酱料  '), {
  normalizedName: '自制酱料', canonicalName: '自制酱料', ruleId: ''
})

const tomatoEgg = CLASSIC_RECIPES.find(recipe => recipe.id === 'tomato_scrambled_eggs')
const inventory = [
  { name: '番茄', quantity: 2, unit: '个', remainingDays: 1 },
  { name: '鲜鸡蛋', quantity: 6, unit: '个', remainingDays: 5 },
  { name: '小葱', quantity: 1, unit: '把', remainingDays: 2 },
  { name: '菠菜', quantity: 1, unit: '把', remainingDays: 0 }
]
assert.strictEqual(canMakeRecipe(tomatoEgg, inventory), true, 'shared aliases make canonical recipe ingredients match inventory')
assert.strictEqual(canMakeRecipe(tomatoEgg, [{ name: '番茄', quantity: 2, unit: '个', remainingDays: 1 }]), false, 'all required ingredients are required')
assert.strictEqual(canMakeRecipe(tomatoEgg, [{ name: '番茄', quantity: 2, unit: '个', remainingDays: 1 }, { name: '鸡蛋', quantity: 2, unit: '个', remainingDays: -1, computedStatus: 'expired' }]), false, 'expired foods are not recipe inventory')
assert.strictEqual(canMakeRecipe(tomatoEgg, [{ name: '番茄', quantity: 2, unit: '个', remainingDays: 1 }, { name: '鸡蛋', quantity: 0, unit: '个', remainingDays: 2 }]), false, 'zero quantity foods are not recipe inventory')
assert.ok(scoreRecipe(tomatoEgg, inventory) > scoreRecipe(tomatoEgg, inventory.slice(0, 2)), 'optional inventory match adds score')
assert.ok(scoreRecipe(tomatoEgg, inventory) > scoreRecipe(tomatoEgg, inventory.map(food => ({ ...food, remainingDays: 10 }))), 'near-expiry ingredients add score')

const candidates = findClassicRecipeCandidates(inventory)
assert.ok(candidates.length >= 3)
assert.ok(candidates.every(recipe => recipe.source === 'classic' && Array.isArray(recipe.stockedIngredients)))
const first = getRecipeBatch(candidates, 0, 3)
const second = getRecipeBatch(candidates, 1, 3)
assert.strictEqual(first.recipes.length, 3)
assert.ok(first.recipes.every(recipe => !second.recipes.some(other => other.id === recipe.id)), 'local pages do not repeat recipes')
assert.strictEqual(first.nextPage, 1)

let indexPage
global.getApp = () => ({})
global.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }) }
global.Page = definition => { indexPage = definition }
require('../miniprogram/pages/index/index')

const localOnlyPage = {
  data: { recipeLoading: false, recipes: first.recipes },
  classicRecipeCandidates: candidates.slice(0, 6),
  classicRecipePage: 1,
  setData(data, callback) { Object.assign(this.data, data); if (callback) callback() },
  loadRecipe() { throw new Error('a complete local page must not call Qwen') }
}
indexPage.refreshRecipes.call(localOnlyPage)
assert.deepStrictEqual(localOnlyPage.data.recipes.map(recipe => recipe.id), candidates.slice(3, 6).map(recipe => recipe.id))

let fallbackCall = null
const partialPage = {
  data: { recipeLoading: false, recipes: first.recipes },
  classicRecipeCandidates: candidates.slice(0, 4),
  classicRecipePage: 1,
  setData(data, callback) { Object.assign(this.data, data); if (callback) callback() },
  loadRecipe(forceRefresh, localRecipes) { fallbackCall = { forceRefresh, localRecipes } }
}
indexPage.refreshRecipes.call(partialPage)
assert.strictEqual(fallbackCall.forceRefresh, true)
assert.strictEqual(fallbackCall.localRecipes.length, 1, 'partial final local page is preserved while AI fills the batch')

delete global.Page
delete global.wx
delete global.getApp

console.log('经典菜谱统一标准化、库存评分与本地分页测试全部通过')
