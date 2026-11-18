const https = require('https')
const config = require('../config')

function isConfigured(model = config.model) { return Boolean(config.apiUrl && config.apiKey && model) }

function resolveChatCompletionsUrl(value) {
  const endpoint = new URL(String(value || '').trim())
  if (endpoint.protocol !== 'https:') throw new Error('SMART_FOOD_API_URL 必须使用 HTTPS')
  if (endpoint.search || endpoint.hash) throw new Error('SMART_FOOD_API_URL 不能包含 query 或 hash')
  const path = endpoint.pathname.replace(/\/+$/, '')
  if (/\/chat\/completions\/chat\/completions$/i.test(path) || /\/v1\/v1(?:\/|$)/i.test(path)) {
    throw new Error('SMART_FOOD_API_URL 包含重复路径')
  }
  endpoint.pathname = /\/chat\/completions$/i.test(path) ? path : `${path}/chat/completions`
  return endpoint
}

function extractJson(value) {
  if (value && typeof value === 'object') return value
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(text) } catch (error) {
    const start = Math.min(...['{', '['].map(char => { const index = text.indexOf(char); return index < 0 ? Infinity : index }))
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
    if (!Number.isFinite(start) || end <= start) throw new Error('Provider 未返回合法 JSON')
    return JSON.parse(text.slice(start, end + 1))
  }
}

function safeErrorValue(value, maxLength = 500) {
  if (value === undefined || value === null) return ''
  return String(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength)
}

function parseProviderError(value) {
  let payload = null
  try { payload = JSON.parse(String(value || '')) } catch (error) { return {} }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const nested = payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error)
    ? payload.error
    : {}
  const code = safeErrorValue(nested.code || payload.code, 120)
  const message = safeErrorValue(nested.message || payload.message, 500)
  const requestId = safeErrorValue(
    payload.request_id || payload.requestId || payload.RequestId || nested.request_id || nested.requestId,
    200
  )
  return {
    ...(code ? { providerErrorCode: code } : {}),
    ...(message ? { providerErrorMessage: message } : {}),
    ...(requestId ? { request_id: requestId } : {})
  }
}

function providerHttpError(httpStatus, value, exposeDiagnostics = false) {
  const parsed = parseProviderError(value)
  const error = new Error('智能服务暂时不可用，请稍后重试')
  if (exposeDiagnostics) {
    error.httpStatus = Number(httpStatus) || 0
    error.providerErrorCode = parsed.providerErrorCode || ''
    error.providerErrorMessage = parsed.providerErrorMessage || ''
    error.requestId = parsed.request_id || ''
  }
  return error
}

function notifyStage(options, stage, details = {}) {
  if (typeof options.onStage !== 'function') return
  try { options.onStage({ stage, ...details }) } catch (error) { /* 诊断回调不能影响 Provider 请求。 */ }
}

function transportError(error, exposeDiagnostics) {
  if (!exposeDiagnostics) return error
  error.httpStatus = 0
  error.providerErrorCode = String(error.message || '').includes('超时') ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REQUEST_FAILED'
  error.providerErrorMessage = safeErrorValue(error.message || 'Provider 网络请求失败')
  return error
}

function requestJson(messages, options = {}) {
  const model = options.model || config.model
  if (!isConfigured(model)) throw new Error('SMART_FOOD_PROVIDER_NOT_CONFIGURED')
  const endpoint = resolveChatCompletionsUrl(config.apiUrl)
  const requestBody = {
    model,
    messages,
    temperature: options.temperature === undefined ? 0.2 : options.temperature,
    max_tokens: options.maxTokens || 1600
  }
  if (!options.plainText) requestBody.response_format = { type: 'json_object' }
  const body = JSON.stringify(requestBody)
  const requestMeta = { url: endpoint.toString(), model }
  console.log('[Provider 请求]', requestMeta)
  return new Promise((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: config.requestTimeoutMs
    }, response => {
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        size += chunk.length
        if (size > 2 * 1024 * 1024) request.destroy(new Error('Provider 响应过大'))
        else chunks.push(chunk)
      })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        notifyStage(options, 'response_received', { httpStatus: Number(response.statusCode) || 0, responseBytes: Buffer.byteLength(text) })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          console.error('[Provider 请求失败]', {
            ...requestMeta,
            httpStatus: response.statusCode,
            ...parseProviderError(text)
          })
          return reject(providerHttpError(response.statusCode, text, options.exposeDiagnostics === true))
        }
        console.log('[Provider 响应]', { ...requestMeta, httpStatus: response.statusCode })
        if (options.connectionDiagnostic === true) return resolve({ httpStatus: response.statusCode })
        notifyStage(options, 'response_parsing', { httpStatus: Number(response.statusCode) || 0 })
        try {
          const payload = JSON.parse(text)
          const content = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
          const parsed = extractJson(content)
          notifyStage(options, 'response_parsed', {
            responseKeys: Object.keys(payload).slice(0, 12),
            choiceCount: Array.isArray(payload.choices) ? payload.choices.length : 0,
            contentType: typeof content,
            contentLength: String(content || '').length,
            hasCodeFence: /^\s*```/.test(String(content || '')),
            parsedType: Array.isArray(parsed) ? 'array' : typeof parsed,
            parsedKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).slice(0, 12) : []
          })
          resolve(parsed)
        } catch (error) { reject(error) }
      })
    })
    request.on('timeout', () => request.destroy(new Error('Provider 请求超时')))
    request.on('error', error => reject(transportError(error, options.exposeDiagnostics === true)))
    request.end(body)
  })
}

module.exports = { isConfigured, resolveChatCompletionsUrl, extractJson, parseProviderError, providerHttpError, requestJson }
