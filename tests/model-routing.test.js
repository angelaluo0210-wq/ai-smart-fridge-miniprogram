const assert = require('assert')
const { resolveModelConfig, requireOcrModel } = require('../cloudfunctions/smartFood/logic/modelRouting')

assert.deepStrictEqual(resolveModelConfig({
  SMART_FOOD_MODEL: 'legacy',
  SMART_FOOD_VISION_MODEL: 'qwen3-vl-8b-instruct',
  SMART_FOOD_OCR_MODEL: 'qwen-vl-ocr',
  SMART_FOOD_TEXT_MODEL: 'qwen3.6-flash-2026-04-16'
}), {
  visionModel: 'qwen3-vl-8b-instruct',
  ocrModel: 'qwen-vl-ocr',
  textModel: 'qwen3.6-flash-2026-04-16'
})

assert.deepStrictEqual(resolveModelConfig({ SMART_FOOD_MODEL: 'legacy-model' }), {
  visionModel: 'legacy-model',
  ocrModel: '',
  textModel: 'legacy-model'
}, 'legacy model never silently supplies the OCR model')
assert.strictEqual(requireOcrModel(' qwen-vl-ocr '), 'qwen-vl-ocr')
assert.throws(() => requireOcrModel(''), error => error.message === '缺少 OCR 模型配置')
assert.throws(() => requireOcrModel(undefined), error => error.message === '缺少 OCR 模型配置')

console.log('smartFood Vision/OCR/Text 独立模型路由测试全部通过')
