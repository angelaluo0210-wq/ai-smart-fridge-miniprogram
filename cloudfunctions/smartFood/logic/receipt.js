const { normalizeCategory } = require('./categories')

const NON_PRODUCT = /(?:\b(?:summe|total|subtotal|mwst|ust|vat|pfand|rabatt|discount|ec[- ]?karte|visa|mastercard|bar|gegeben|rückgeld|wechselgeld|transaktion|beleg|kasse|filiale|datum|uhrzeit|steuer|netto|brutto|gesamt|zahlung|coupon|punkte|shampoo|spülmittel|waschmittel|seife|toilettenpapier|batterie|müllbeutel|detergent|soap|tissue)\b|会员|合计|总计|小计|折扣|支付|找零|税额|门店|收银|交易号|洗发|洗衣|肥皂|纸巾|电池|垃圾袋)/i
const PRICE_ONLY = /^\s*[-+]?\d+[,.]\d{2}\s*[a-z€¥￥%]*\s*$/i
const PRODUCT_HINTS = [
  [/tomat|西红柿|番茄/i, 'vegetable'], [/spinat|菠菜/i, 'vegetable'], [/kartoff|土豆/i, 'vegetable'],
  [/apfel|apple|苹果/i, 'fruit'], [/banan|香蕉/i, 'fruit'], [/milch|milk|牛奶/i, 'dairy_egg'],
  [/ei(er)?\b|egg|鸡蛋/i, 'dairy_egg'], [/joghurt|yogurt|酸奶/i, 'dairy_egg'], [/tofu|豆腐/i, 'soy'],
  [/fleisch|huhn|chicken|schwein|beef|鸡肉|猪肉|牛肉/i, 'meat'], [/fisch|鱼/i, 'seafood'],
  [/brot|bread|面包/i, 'staple'], [/reis|rice|大米/i, 'staple'], [/saft|juice|果汁/i, 'drink']
]

function guessCategory(name) {
  const match = PRODUCT_HINTS.find(([pattern]) => pattern.test(name))
  return normalizeCategory(match ? match[1] : 'other')
}

function cleanReceiptLine(line) {
  return String(line || '')
    .replace(/^\s*\d{4,}\s+/, '')
    .replace(/\s+\d+[,.]\d{2}\s*(?:[a-z]{1,3}|€|¥|￥)?\s*$/i, '')
    .replace(/\s+[x*]\s*\d+(?:[,.]\d+)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isNonProductLine(line) {
  const value = String(line || '').trim()
  return !value || value.length < 2 || PRICE_ONLY.test(value) || NON_PRODUCT.test(value) || /^[-=*_.\s]+$/.test(value)
}

function parseReceiptText(text, maxItems = 30) {
  const foods = []
  const seen = new Set()
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    if (isNonProductLine(rawLine)) continue
    const name = cleanReceiptLine(rawLine).slice(0, 30)
    const key = name.toLowerCase()
    if (isNonProductLine(name) || seen.has(key)) continue
    seen.add(key)
    foods.push({ name, category: guessCategory(name), confidence: null })
    if (foods.length >= maxItems) break
  }
  return { foods }
}

function normalizeOcrResult(result) {
  if (typeof result === 'string') return result.trim()
  return String(result && (result.text || result.ocrText) || '').trim()
}

module.exports = { NON_PRODUCT, PRICE_ONLY, guessCategory, cleanReceiptLine, isNonProductLine, parseReceiptText, normalizeOcrResult }
