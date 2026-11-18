const assert = require('assert')
const { _test } = require('../miniprogram/services/smartFood')

const result = _test.safeCallResult({
  errCode: -501000,
  errMsg: 'cloud.callFunction:fail',
  requestID: 'request-from-result',
  buildId: 'phase3-debug-20260825',
  prompt: 'private prompt',
  openid: 'private openid',
  apiKey: 'private key'
})
assert.deepStrictEqual(result, {
  errCode: -501000,
  errMsg: 'cloud.callFunction:fail',
  requestID: 'request-from-result',
  buildId: 'phase3-debug-20260825'
})

assert.deepStrictEqual(_test.callErrorDiagnostics({
  errCode: -501000,
  errMsg: 'cloud.callFunction:fail',
  requestId: 'request-top-level',
  result: { prompt: 'must not leak' }
}), {
  errCode: -501000,
  errMsg: 'cloud.callFunction:fail',
  requestId: 'request-top-level'
})

async function testProviderAction() {
  let callOptions = null
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
    cloud: {
      callFunction: async options => {
        callOptions = options
        return { result: { ok: true, httpStatus: 200 }, requestID: 'client-request' }
      }
    }
  }
  const response = await require('../miniprogram/services/smartFood').testProviderConnection()
  assert.deepStrictEqual(callOptions, {
    name: 'smartFood',
    data: { action: 'testProviderConnection', clientEnvVersion: 'develop' }
  })
  assert.strictEqual(response.ok, true)
  assert.strictEqual(response.httpStatus, 200)
}

testProviderAction()
  .then(() => console.log('smartFood 客户端安全诊断字段测试全部通过'))
  .catch(error => { console.error(error); process.exitCode = 1 })
