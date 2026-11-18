function tokenize(value) {
  const text = String(value || '').toLowerCase()
  const latin = text.match(/[a-zäöüß0-9]{2,}/g) || []
  const chinese = text.match(/[\u4e00-\u9fff]{2,}/g) || []
  const pairs = []
  chinese.forEach(word => {
    pairs.push(word)
    for (let index = 0; index < word.length - 1; index += 1) pairs.push(word.slice(index, index + 2))
  })
  return Array.from(new Set([...latin, ...pairs]))
}

function validHttpsUrl(value) {
  try { return new URL(String(value || '')).protocol === 'https:' } catch (error) { return false }
}

function validateSource(document, allowedHosts = []) {
  if (!document || !document._id || !document.title || !document.organization || !validHttpsUrl(document.url)) return null
  const hostname = new URL(document.url).hostname.toLowerCase()
  const hosts = (allowedHosts || []).map(item => String(item).trim().toLowerCase()).filter(Boolean)
  if (!hosts.length || !hosts.some(host => hostname === host || hostname.endsWith(`.${host}`))) return null
  const content = String(document.content || '').trim()
  if (!content) return null
  return {
    id: String(document._id),
    title: String(document.title).trim().slice(0, 120),
    organization: String(document.organization).trim().slice(0, 120),
    url: String(document.url),
    content: content.slice(0, 3000),
    keywords: Array.isArray(document.keywords) ? document.keywords.map(String) : []
  }
}

function retrieveSafetyDocuments(question, documents, options = {}) {
  const questionTokens = tokenize(question)
  if (!questionTokens.length) return []
  return (Array.isArray(documents) ? documents : [])
    .map(document => validateSource(document, options.allowedHosts))
    .filter(Boolean)
    .map(source => {
      const haystack = tokenize(`${source.title} ${source.keywords.join(' ')} ${source.content}`)
      const matches = questionTokens.filter(token => haystack.includes(token)).length
      return { source, score: matches }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.source.title.localeCompare(b.source.title, 'zh-CN'))
    .slice(0, options.limit || 3)
    .map(item => item.source)
}

function normalizeSafetyAnswer(result, retrievedSources) {
  if (!result || typeof result !== 'object') return null
  const answer = String(result.answer || '').trim().slice(0, 1200)
  if (!answer) return null
  const byId = new Map((retrievedSources || []).map(source => [source.id, source]))
  const sourceIds = Array.isArray(result.sourceIds) ? result.sourceIds.map(String) : []
  const sources = Array.from(new Set(sourceIds)).map(id => byId.get(id)).filter(Boolean).map(source => ({
    id: source.id, title: source.title, organization: source.organization, url: source.url
  }))
  if (!sources.length) return null
  return { answer, sources }
}

function normalizeLlmOnlySafetyAnswer(result) {
  if (!result || typeof result !== 'object') return null
  const answer = String(result.answer || '').trim().slice(0, 1200)
  if (!answer) return null
  return { answer, sources: [], fallback: false, mode: 'llm_only' }
}

async function answerSafetyQuestion(options = {}) {
  const question = String(options.question || '').trim().slice(0, 200)
  const provider = options.provider
  const mode = options.mode === 'rag' ? 'rag' : 'llm_only'
  if (!provider || !provider.isConfigured()) return safetyFallback(mode === 'rag' ? 'provider_not_configured' : 'provider_not_configured_llm')
  if (mode === 'rag') {
    const documents = typeof options.loadDocuments === 'function' ? await options.loadDocuments() : []
    const sources = retrieveSafetyDocuments(question, documents, { allowedHosts: options.allowedHosts, limit: 3 })
    if (!sources.length) return safetyFallback('no_sources')
    const answer = normalizeSafetyAnswer(await provider.answerSafety(question, sources), sources)
    return answer ? { ...answer, fallback: false, mode: 'rag' } : safetyFallback('invalid_answer')
  }
  const answer = normalizeLlmOnlySafetyAnswer(await provider.answerSafetyLlmOnly(question))
  return answer || safetyFallback('invalid_answer_llm')
}

function safetyFallback(reason = 'no_sources') {
  const messages = {
    no_sources: '没有找到足够可靠的信息，建议不要仅根据 AI 判断该食品是否安全。',
    provider_not_configured: '食品安全知识服务尚未配置，暂时无法基于权威资料生成回答。',
    provider_not_configured_llm: '食品安全智能服务尚未配置，请稍后再试。',
    invalid_answer: '没有得到能够由可靠来源支持的回答，建议咨询当地食品安全机构或专业人员。',
    invalid_answer_llm: '本次没有得到有效回答，请稍后重试；紧急或高风险情况请咨询专业人士。'
  }
  return { answer: messages[reason] || messages.no_sources, sources: [], fallback: true, reason }
}

module.exports = {
  tokenize,
  validHttpsUrl,
  validateSource,
  retrieveSafetyDocuments,
  normalizeSafetyAnswer,
  normalizeLlmOnlySafetyAnswer,
  answerSafetyQuestion,
  safetyFallback
}
