function list(value) { return String(value || '').split(',').map(item => item.trim()).filter(Boolean) }
const { resolveModelConfig } = require('./logic/modelRouting')
const models = resolveModelConfig(process.env)

module.exports = {
  providerName: process.env.SMART_FOOD_PROVIDER_NAME || 'compatible-json-provider',
  apiUrl: process.env.SMART_FOOD_API_URL || '',
  apiKey: process.env.SMART_FOOD_API_KEY || '',
  model: process.env.SMART_FOOD_MODEL || '',
  visionModel: models.visionModel,
  ocrModel: models.ocrModel,
  textModel: models.textModel,
  requestTimeoutMs: Number(process.env.SMART_FOOD_TIMEOUT_MS) || 25000,
  recipeCacheCollection: process.env.SMART_RECIPE_CACHE_COLLECTION || 'smart_recipe_cache',
  safetyCollection: process.env.FOOD_SAFETY_COLLECTION || 'food_safety_documents',
  safetyMode: String(process.env.FOOD_SAFETY_MODE || 'llm_only').trim().toLowerCase() === 'rag' ? 'rag' : 'llm_only',
  allowedSafetyHosts: list(process.env.FOOD_SAFETY_ALLOWED_HOSTS),
  maxImageBytes: 10 * 1024 * 1024
}
