const assert = require('assert')
const {
  canConvertUnit, convertQuantity, parseIngredientAmount, isUsableFood, expiredFoodsForCleanup, hasOperationId, nextOperationIds,
  previewConsumption, buildDeductionPlan
} = require('../cloudfunctions/household/recipeConsumption')
const { localDateForOffset } = require('../cloudfunctions/household/date')

const today = '2026-09-01'
const foods = [
  { _id: 'egg-soon', name: '鲜鸡蛋', quantity: 2, unit: '个', status: 'fresh', expire_date: '2026-09-02' },
  { _id: 'egg-later', name: '鸡蛋', quantity: 6, unit: '个', status: 'fresh', expire_date: '2026-09-09' },
  { _id: 'pork', name: '猪肉', quantity: 0.5, unit: 'kg', status: 'fresh', expire_date: '2026-09-03' },
  { _id: 'milk', name: '牛奶', quantity: 1, unit: '盒', status: 'fresh', expire_date: '2026-09-03' },
  { _id: 'expired', name: '鸡蛋', quantity: 9, unit: '个', status: 'fresh', expire_date: '2026-08-31' },
  { _id: 'consumed', name: '鸡蛋', quantity: 9, unit: '个', status: 'consumed', expire_date: '2026-09-03' },
  { _id: 'discarded', name: '鸡蛋', quantity: 9, unit: '个', status: 'discarded', expire_date: '2026-09-03' },
  { _id: 'zero', name: '鸡蛋', quantity: 0, unit: '个', status: 'fresh', expire_date: '2026-09-03' }
]

assert.deepStrictEqual(parseIngredientAmount('2 个'), { quantity: 2, unit: '个', estimated: true })
assert.deepStrictEqual(parseIngredientAmount('适量'), { quantity: 0, unit: '', estimated: false })
assert.strictEqual(canConvertUnit('kg', 'g'), true)
assert.strictEqual(convertQuantity(0.5, 'kg', 'g'), 500)
assert.strictEqual(canConvertUnit('盒', 'ml'), false, 'non-standard container conversions are never guessed')
assert.strictEqual(isUsableFood(foods[4], today), false)
assert.strictEqual(isUsableFood(foods[5], today), false)
assert.strictEqual(isUsableFood(foods[6], today), false)
assert.strictEqual(isUsableFood(foods[7], today), false)
assert.deepStrictEqual(expiredFoodsForCleanup(foods, today).map(food => food._id), ['expired'], 'cleanup marks only locally expired active foods')

const eggPreview = previewConsumption(foods, [{ name: '鸡蛋', quantity: 9, unit: '个', estimated: true }], today)[0]
assert.strictEqual(eggPreview.inventoryQuantity, 8)
assert.strictEqual(eggPreview.shortage, 1)
const eggPlan = buildDeductionPlan(foods, [{ name: '鸡蛋', quantity: 3, unit: '个' }], today)
assert.deepStrictEqual(eggPlan.deductions.map(item => [item.foodId, item.after]), [['egg-soon', 0], ['egg-later', 5]], 'FEFO consumes the nearest valid batch first')
assert.strictEqual(buildDeductionPlan(foods, [{ name: '鸡蛋', quantity: 2, unit: '个' }], today).deductions[0].after, 0)
const shortagePlan = buildDeductionPlan([{ _id: 'one', name: '鸡蛋', quantity: 1, unit: '个', status: 'fresh', expire_date: '2026-09-02' }], [{ name: '鸡蛋', quantity: 2, unit: '个' }], today)
assert.strictEqual(shortagePlan.deductions[0].after, 0)
assert.strictEqual(shortagePlan.summaries[0].shortage, 1)
assert.strictEqual(buildDeductionPlan(foods, [{ name: '猪肉', quantity: 300, unit: 'g' }], today).deductions[0].after, 0.2)
assert.throws(() => buildDeductionPlan(foods, [{ name: '牛奶', quantity: 200, unit: 'ml' }], today), /单位不一致/)
assert.throws(() => buildDeductionPlan(foods, [{ name: '鸡蛋', quantity: -1, unit: '个' }], today), /大于或等于 0/)
const operationFood = { recipe_operation_ids: ['cook_old'] }
assert.strictEqual(hasOperationId(operationFood, 'cook_old'), true)
assert.deepStrictEqual(nextOperationIds(operationFood, 'cook_new'), ['cook_old', 'cook_new'])
assert.strictEqual(nextOperationIds({ recipe_operation_ids: Array.from({ length: 20 }, (_, index) => `op_${index}`) }, 'op_new').length, 20)
assert.strictEqual(localDateForOffset(-480, Date.UTC(2026, 7, 31, 16, 30)), '2026-09-01')
assert.strictEqual(localDateForOffset(0, Date.UTC(2026, 7, 31, 23, 30)), '2026-08-31')

console.log('Phase 3.5 可用库存、单位换算、FEFO、库存不足和时区测试全部通过')
