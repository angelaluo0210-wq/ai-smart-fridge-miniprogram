const assert = require('assert')
const { parseProviderError, providerHttpError } = require('../cloudfunctions/smartFood/providers/compatibleProvider')

assert.deepStrictEqual(parseProviderError(JSON.stringify({
  code: 'AccessDenied',
  message: 'Workspace access denied',
  request_id: 'req-top-level'
})), {
  providerErrorCode: 'AccessDenied',
  providerErrorMessage: 'Workspace access denied',
  request_id: 'req-top-level'
})

assert.deepStrictEqual(parseProviderError(JSON.stringify({
  error: {
    code: 'InvalidApiKey',
    message: 'Invalid API key'
  },
  request_id: 'req-nested'
})), {
  providerErrorCode: 'InvalidApiKey',
  providerErrorMessage: 'Invalid API key',
  request_id: 'req-nested'
})

assert.deepStrictEqual(parseProviderError('<html>Forbidden</html>'), {})
assert.deepStrictEqual(parseProviderError(JSON.stringify({ prompt: 'private food data' })), {})

const sanitized = parseProviderError(JSON.stringify({
  code: 'Forbidden\nInjected',
  message: 'Denied\r\nnext line',
  RequestId: 'req-tab\tvalue'
}))
assert.deepStrictEqual(sanitized, {
  providerErrorCode: 'Forbidden Injected',
  providerErrorMessage: 'Denied next line',
  request_id: 'req-tab value'
})

const normalError = providerHttpError(403, JSON.stringify({ code: 'AccessDenied', message: 'Denied', request_id: 'req-1' }))
assert.strictEqual(normalError.message, '智能服务暂时不可用，请稍后重试')
assert.strictEqual(normalError.httpStatus, undefined)
assert.strictEqual(normalError.providerErrorCode, undefined)

const diagnosticError = providerHttpError(403, JSON.stringify({ code: 'AccessDenied', message: 'Denied', request_id: 'req-1' }), true)
assert.strictEqual(diagnosticError.message, '智能服务暂时不可用，请稍后重试')
assert.strictEqual(diagnosticError.httpStatus, 403)
assert.strictEqual(diagnosticError.providerErrorCode, 'AccessDenied')
assert.strictEqual(diagnosticError.providerErrorMessage, 'Denied')
assert.strictEqual(diagnosticError.requestId, 'req-1')

console.log('smartFood Provider 错误响应安全解析测试全部通过')
