const assert = require('assert')
const { cleanReceiptLine, isNonProductLine, parseReceiptText, normalizeOcrResult } = require('../cloudfunctions/smartFood/logic/receipt')

const text = [
  'REWE FILIALE 123',
  'BIO MILCH 1,49',
  'TOMATEN 2,99 EUR',
  'EIER 10 ST 3,29',
  'PFAND 0,25',
  'RABATT -0,50',
  'MWST 7% 0,42',
  'SUMME 7,77',
  'EC-KARTE',
  'SHAMPOO 3,49',
  '1,99'
].join('\n')
assert.deepStrictEqual(parseReceiptText(text).foods, [
  { name: 'BIO MILCH', category: 'dairy_egg', confidence: null },
  { name: 'TOMATEN', category: 'vegetable', confidence: null },
  { name: 'EIER 10 ST', category: 'dairy_egg', confidence: null }
])
assert.strictEqual(cleanReceiptLine('123456 TOFU 2,49'), 'TOFU')
assert.strictEqual(isNonProductLine('合计 20.00'), true)
assert.strictEqual(isNonProductLine('TOTAL 20,00'), true)
assert.strictEqual(isNonProductLine('BANANEN 1,20'), false)
assert.deepStrictEqual(parseReceiptText('TOTAL 1,00\nPFAND 0,25'), { foods: [] })
assert.strictEqual(normalizeOcrResult({ text: 'A\nB' }), 'A\nB')
assert.strictEqual(normalizeOcrResult({}), '')

console.log('Phase 3 Step 3 OCR 文本、价格折扣和非商品过滤测试全部通过')
