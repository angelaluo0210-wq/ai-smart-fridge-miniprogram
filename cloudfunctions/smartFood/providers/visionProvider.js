const compatible = require('./compatibleProvider')
const config = require('../config')

function imageMessage(prompt, imageBuffer, mimeType) {
  return [{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}` } }
  ] }]
}

function recognizeFoods(imageBuffer, mimeType) {
  return compatible.requestJson(imageMessage(
    '识别图片中清晰可见的食材。只返回 JSON：{"foods":[{"name":"名称","category":"vegetable|fruit|meat|seafood|dairy_egg|soy|staple|drink|seasoning|other","confidence":0到1}]}。不要猜测不可见物品，不要返回说明文字。',
    imageBuffer, mimeType
  ), { model: config.visionModel })
}

function recognizeReceipt(imageBuffer, mimeType) {
  return compatible.requestJson(imageMessage(
    '对购物小票进行 OCR，保留商品行原始语言和换行。不要补写不可见内容。只返回 JSON：{"text":"OCR 原始文本"}。',
    imageBuffer, mimeType
  ), { maxTokens: 2400, model: config.ocrModel })
}

function isVisionConfigured() { return compatible.isConfigured(config.visionModel) }
function isOcrConfigured() { return compatible.isConfigured(config.ocrModel) }
module.exports = { isVisionConfigured, isOcrConfigured, recognizeFoods, recognizeReceipt }
