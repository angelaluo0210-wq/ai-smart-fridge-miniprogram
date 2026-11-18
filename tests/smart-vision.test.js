const assert = require('assert')
const { normalizeConfidence, normalizeFoodCandidate, normalizeVisionResult } = require('../cloudfunctions/smartFood/logic/vision')
const { extractJson } = require('../cloudfunctions/smartFood/providers/compatibleProvider')

assert.deepStrictEqual(normalizeVisionResult({ foods: [
  { name: '西红柿', category: '蔬菜', confidence: 0.913 },
  { name: '鸡蛋', category: 'dairy_egg', confidence: 1.5 },
  { name: '未知包装', category: '模型乱写', confidence: -1 }
] }), { foods: [
  { name: '西红柿', category: 'vegetable', confidence: 0.91 },
  { name: '鸡蛋', category: 'dairy_egg', confidence: 1 },
  { name: '未知包装', category: 'other', confidence: 0 }
] })
assert.deepStrictEqual(normalizeVisionResult({ foods: [{ name: '豆腐' }, { name: '豆腐' }, null, { name: '' }] }), {
  foods: [{ name: '豆腐', category: 'other', confidence: null }]
})
assert.deepStrictEqual(normalizeVisionResult({ invalid: true }), { foods: [] })
assert.deepStrictEqual(normalizeVisionResult(null), { foods: [] })
assert.strictEqual(normalizeFoodCandidate('不是对象'), null)
assert.strictEqual(normalizeConfidence('未知'), null)
assert.deepStrictEqual(extractJson('```json\n{"foods":[]}\n```'), { foods: [] })
assert.deepStrictEqual(extractJson('以下是结果：\n```json\n{"recipes":[{"title":"测试菜"}]}\n```\n请查收'), { recipes: [{ title: '测试菜' }] })
assert.throws(() => extractJson('这不是 JSON'), /合法 JSON/)

console.log('Phase 3 Step 2 Vision 输出规范化和异常结果测试全部通过')
