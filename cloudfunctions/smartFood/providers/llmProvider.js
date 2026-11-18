const compatible = require('./compatibleProvider')
const config = require('../config')

const FOOD_SAFETY_LLM_ONLY_PROMPT = `你是面向中国普通家庭用户的食品安全助手。请遵守以下规则：
1. 使用简体中文，回答简洁、明确、可操作，优先给出用户最关心的结论，再解释原因。
2. 对冷藏、冷冻、解冻、剩菜、肉类、乳制品、鸡蛋、蔬果和变质判断等问题提供实用建议。
3. 如果食品包装上的储存说明与通用建议不同，优先建议遵循包装说明。
4. 不确定时明确表达不确定性；不得编造法规、标准、机构、来源或“中国国家标准”“国家卫健委规定”等出处。
5. 对“还能不能吃”且无法通过文字可靠判断的问题，采取保守建议，不给出绝对安全保证。
6. 涉及孕妇、婴幼儿、老人或免疫功能较弱人群时，提醒采用更谨慎标准，必要时咨询医生或食品安全专业人士。
7. 不要因为没有外部资料来源而拒绝回答普通食品安全问题。
8. 使用适合小程序阅读的“结论、建议、注意”结构，避免长篇科普。
只返回严格 JSON：{"answer":"结论：……\\n\\n建议：……\\n\\n注意：……"}`

function recipeMessages(inventory, excludedTitles = []) {
  const exclusions = (Array.isArray(excludedTitles) ? excludedTitles : []).map(item => String(item || '').trim().slice(0, 50)).filter(Boolean).slice(0, 10)
  return [
    { role: 'system', content: '你是家庭菜谱助手。基于库存一次返回3道不同家常菜，优先消耗 remaining_days 0–2 的食材。避开上一批菜名及其近似改写。每道菜只给简短理由、食材名和最多3个简短步骤。仅输出严格 JSON。' },
    { role: 'user', content: `库存：${JSON.stringify(inventory)}\n排除菜名：${JSON.stringify(exclusions)}\n格式：{"recipes":[{"title":"菜名","ingredients":["食材"],"reason":"简短理由","steps":["步骤1","步骤2","步骤3"]}]}` }
  ]
}

function buildRecipeRequest(inventory, options = {}) {
  const messages = recipeMessages(inventory, options.excludedTitles)
  const maxTokens = 1400
  const temperature = options.forceRefresh ? 0.5 : 0.2
  return {
    messages,
    maxTokens,
    temperature,
    promptChars: messages.reduce((total, message) => total + String(message.content || '').length, 0)
  }
}

function generateRecipe(inventory, options = {}) {
  const prepared = options.preparedRequest || buildRecipeRequest(inventory, options)
  return compatible.requestJson(prepared.messages, {
    maxTokens: prepared.maxTokens,
    model: config.textModel,
    temperature: prepared.temperature,
    exposeDiagnostics: options.exposeDiagnostics === true,
    onStage: options.onProviderStage
  })
}

function answerSafety(question, sources) {
  const chunks = sources.map(source => ({ id: source.id, title: source.title, organization: source.organization, content: source.content }))
  return compatible.requestJson([
    { role: 'system', content: '你是食品安全资料问答助手。只能依据给定资料回答；资料不足时必须说明不知道。不得引用未提供来源。返回严格 JSON。' },
    { role: 'user', content: `问题：${question}\n资料：${JSON.stringify(chunks)}\n返回：{"answer":"","sourceIds":["资料id"]}` }
  ], { maxTokens: 1400, temperature: 0.1, model: config.textModel })
}

function answerSafetyLlmOnly(question) {
  return compatible.requestJson([
    { role: 'system', content: FOOD_SAFETY_LLM_ONLY_PROMPT },
    { role: 'user', content: String(question || '').trim().slice(0, 200) }
  ], { maxTokens: 900, temperature: 0.1, model: config.textModel })
}

function explainShelfLife(name, recommendation) {
  return compatible.requestJson([
    { role: 'system', content: '你只负责用简短中文解释既定保存建议，不得修改天数、来源或安全上限。返回严格 JSON。' },
    { role: 'user', content: `食材：${name}\n既定建议：${JSON.stringify(recommendation)}\n返回：{"explanation":"不超过60字的说明"}` }
  ], { maxTokens: 160, temperature: 0.1, model: config.textModel })
}

function testConnection() {
  return compatible.requestJson([
    { role: 'user', content: '只回复 OK' }
  ], {
    maxTokens: 8,
    temperature: 0,
    model: config.textModel,
    plainText: true,
    connectionDiagnostic: true,
    exposeDiagnostics: true
  })
}

function isConfigured() { return compatible.isConfigured(config.textModel) }
module.exports = {
  isConfigured,
  generateRecipe,
  recipeMessages,
  buildRecipeRequest,
  answerSafety,
  answerSafetyLlmOnly,
  explainShelfLife,
  testConnection,
  FOOD_SAFETY_LLM_ONLY_PROMPT
}
