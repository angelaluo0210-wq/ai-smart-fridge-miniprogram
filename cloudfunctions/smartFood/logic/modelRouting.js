function resolveModelConfig(env = {}) {
  const legacyModel = String(env.SMART_FOOD_MODEL || '').trim()
  return {
    visionModel: String(env.SMART_FOOD_VISION_MODEL || legacyModel).trim(),
    ocrModel: String(env.SMART_FOOD_OCR_MODEL || '').trim(),
    textModel: String(env.SMART_FOOD_TEXT_MODEL || legacyModel).trim()
  }
}

function requireOcrModel(model) {
  const value = String(model || '').trim()
  if (!value) throw new Error('缺少 OCR 模型配置')
  return value
}

module.exports = { resolveModelConfig, requireOcrModel }
