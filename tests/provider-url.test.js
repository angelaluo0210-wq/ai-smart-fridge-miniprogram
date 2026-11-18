const assert = require('assert')
const { resolveChatCompletionsUrl } = require('../cloudfunctions/smartFood/providers/compatibleProvider')

const base = 'https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
const endpoint = `${base}/chat/completions`
assert.strictEqual(resolveChatCompletionsUrl(base).toString(), endpoint)
assert.strictEqual(resolveChatCompletionsUrl(`${base}/`).toString(), endpoint)
assert.strictEqual(resolveChatCompletionsUrl(endpoint).toString(), endpoint)
assert.throws(
  () => resolveChatCompletionsUrl(`${endpoint}/chat/completions`),
  error => error.message === 'SMART_FOOD_API_URL 包含重复路径'
)
assert.throws(
  () => resolveChatCompletionsUrl('https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/v1/chat/completions'),
  error => error.message === 'SMART_FOOD_API_URL 包含重复路径'
)
assert.throws(() => resolveChatCompletionsUrl('http://example.com/v1'), /必须使用 HTTPS/)
assert.throws(() => resolveChatCompletionsUrl(`${base}?debug=1`), /不能包含 query/)

console.log('smartFood 百炼 Base URL、完整 endpoint 和重复路径测试全部通过')
