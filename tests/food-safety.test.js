const assert = require('assert')
const {
  validateSource,
  retrieveSafetyDocuments,
  normalizeSafetyAnswer,
  normalizeLlmOnlySafetyAnswer,
  answerSafetyQuestion,
  safetyFallback
} = require('../cloudfunctions/smartFood/logic/safety')

const documents = [
  { _id: 'milk', title: 'Milk storage', organization: 'Official Agency', url: 'https://safety.example.gov/milk', content: '牛奶 开封 冷藏 保存 时间', keywords: ['牛奶', '冷藏'] },
  { _id: 'egg', title: 'Egg storage', organization: 'Official Agency', url: 'https://safety.example.gov/egg', content: '鸡蛋 冷藏 保存', keywords: ['鸡蛋'] },
  { _id: 'blog', title: 'Random blog', organization: 'Unknown', url: 'http://blog.example.com/post', content: '牛奶保存' }
]
assert.strictEqual(validateSource(documents[2]), null, 'non-HTTPS source is rejected')
assert.strictEqual(validateSource(documents[0]), null, 'sources are disabled until an allowlist is configured')
assert.strictEqual(validateSource(documents[0], ['another.gov']), null, 'host outside configured allowlist is rejected')
const retrieved = retrieveSafetyDocuments('牛奶开封后如何冷藏？', documents, { allowedHosts: ['example.gov'] })
assert.strictEqual(retrieved[0].id, 'milk', 'the most specific source ranks first')
assert.strictEqual(retrieved.some(item => item.id === 'blog'), false, 'invalid source never enters retrieval results')
assert.deepStrictEqual(retrieveSafetyDocuments('完全无关的问题', documents, { allowedHosts: ['example.gov'] }), [])
assert.deepStrictEqual(normalizeSafetyAnswer({ answer: '请冷藏。', sourceIds: ['milk', 'fake'] }, retrieved), {
  answer: '请冷藏。', sources: [{
    id: 'milk', title: 'Milk storage', organization: 'Official Agency', url: 'https://safety.example.gov/milk'
  }]
})
assert.strictEqual(normalizeSafetyAnswer({ answer: '没有引用', sourceIds: ['fake'] }, retrieved), null)
assert.strictEqual(safetyFallback('no_sources').sources.length, 0)
assert.strictEqual(safetyFallback('provider_not_configured').fallback, true)

assert.deepStrictEqual(normalizeLlmOnlySafetyAnswer({ answer: '结论：请冷藏。', sourceIds: ['fake'] }), {
  answer: '结论：请冷藏。', sources: [], fallback: false, mode: 'llm_only'
})

async function testLlmOnlyFlow() {
  const questions = []
  let retrievalCalls = 0
  const provider = {
    isConfigured: () => true,
    answerSafetyLlmOnly: async question => {
      questions.push(question)
      return { answer: `结论：已回答 ${question}` }
    },
    answerSafety: async () => { throw new Error('LLM-only 不应调用 RAG provider') }
  }
  for (const question of ['生鸡肉可以冷藏多久', '牛奶开封后怎么保存']) {
    const result = await answerSafetyQuestion({
      question,
      mode: 'llm_only',
      provider,
      loadDocuments: async () => { retrievalCalls += 1; return [] },
      allowedHosts: []
    })
    assert.ok(result.answer.includes(question))
    assert.deepStrictEqual(result.sources, [])
    assert.strictEqual(result.fallback, false)
  }
  assert.deepStrictEqual(questions, ['生鸡肉可以冷藏多久', '牛奶开封后怎么保存'])
  assert.strictEqual(retrievalCalls, 0, 'LLM-only 模式不得查询 food_safety_documents')
  await assert.rejects(
    () => answerSafetyQuestion({
      question: '这还能吃吗？',
      mode: 'llm_only',
      provider: { isConfigured: () => true, answerSafetyLlmOnly: async () => { throw new Error('智能服务暂时不可用，请稍后重试') } }
    }),
    /智能服务暂时不可用，请稍后重试/
  )
}

testLlmOnlyFlow()
  .then(() => console.log('Phase 3 Step 5 RAG 保留、LLM-only 问答和无来源回答测试全部通过'))
  .catch(error => { console.error(error); process.exitCode = 1 })
