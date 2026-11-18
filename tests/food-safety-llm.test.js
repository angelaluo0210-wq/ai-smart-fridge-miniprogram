const assert = require('assert')

process.env.SMART_FOOD_TEXT_MODEL = 'qwen-text-test'
process.env.SMART_FOOD_API_URL = 'https://workspace.example.com/compatible-mode/v1'
process.env.SMART_FOOD_API_KEY = 'test-only-key'

const compatible = require('../cloudfunctions/smartFood/providers/compatibleProvider')
const calls = []
compatible.requestJson = async (messages, options) => {
  calls.push({ messages, options })
  return { answer: '结论：测试回答。' }
}
const provider = require('../cloudfunctions/smartFood/providers/llmProvider')

async function run() {
  for (const question of ['生鸡肉可以冷藏多久', '牛奶开封后怎么保存']) {
    const result = await provider.answerSafetyLlmOnly(question)
    assert.strictEqual(result.answer, '结论：测试回答。')
  }
  assert.strictEqual(calls.length, 2)
  calls.forEach((call, index) => {
    assert.strictEqual(call.options.model, 'qwen-text-test')
    assert.strictEqual(call.messages[1].content, ['生鸡肉可以冷藏多久', '牛奶开封后怎么保存'][index])
    assert.ok(call.messages[0].content.includes('简体中文'))
    assert.ok(call.messages[0].content.includes('不得编造法规'))
    assert.ok(call.messages[0].content.includes('不给出绝对安全保证'))
    assert.ok(call.messages[0].content.includes('没有外部资料来源而拒绝'))
  })
  console.log('食品安全 LLM-only Prompt 和 SMART_FOOD_TEXT_MODEL 路由测试全部通过')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
