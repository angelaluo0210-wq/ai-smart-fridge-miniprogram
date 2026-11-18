const assert = require('assert')
const { EventEmitter } = require('events')

process.env.SMART_FOOD_API_URL = 'https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
process.env.SMART_FOOD_API_KEY = 'test-key-not-logged'
process.env.SMART_FOOD_TEXT_MODEL = 'qwen3.7-flash'

const https = require('https')

function mockRequest(statusCode, responseBody) {
  https.request = (endpoint, options, onResponse) => {
    const request = new EventEmitter()
    request.end = () => process.nextTick(() => {
      const response = new EventEmitter()
      response.statusCode = statusCode
      onResponse(response)
      response.emit('data', Buffer.from(responseBody))
      response.emit('end')
    })
    request.destroy = error => process.nextTick(() => request.emit('error', error))
    return request
  }
}

async function run() {
  delete require.cache[require.resolve('../cloudfunctions/smartFood/config')]
  delete require.cache[require.resolve('../cloudfunctions/smartFood/providers/compatibleProvider')]
  const compatible = require('../cloudfunctions/smartFood/providers/compatibleProvider')

  mockRequest(200, JSON.stringify({
    choices: [{ message: { content: '```json\n{"recipes":[{"title":"A"},{"title":"B"},{"title":"C"}]}\n```' } }]
  }))
  const stages = []
  const result = await compatible.requestJson([{ role: 'user', content: 'test' }], {
    model: 'qwen3.7-flash',
    onStage: info => stages.push(info)
  })
  assert.deepStrictEqual(result.recipes.map(item => item.title), ['A', 'B', 'C'])
  assert.deepStrictEqual(stages.map(item => item.stage), ['response_received', 'response_parsing', 'response_parsed'])
  assert.strictEqual(stages[0].httpStatus, 200)
  assert.strictEqual(stages[2].hasCodeFence, true)
  assert.deepStrictEqual(stages[2].parsedKeys, ['recipes'])

  mockRequest(403, JSON.stringify({ code: 'AccessDenied', message: 'Model access denied', request_id: 'req-safe' }))
  const failureStages = []
  await assert.rejects(
    compatible.requestJson([{ role: 'user', content: 'test' }], {
      model: 'qwen3.7-flash', exposeDiagnostics: true, onStage: info => failureStages.push(info)
    }),
    error => error.httpStatus === 403 && error.providerErrorCode === 'AccessDenied' && error.providerErrorMessage === 'Model access denied'
  )
  assert.deepStrictEqual(failureStages.map(item => item.stage), ['response_received'])
  console.log('smartFood Provider 分阶段响应、JSON code fence 和安全错误诊断测试全部通过')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
