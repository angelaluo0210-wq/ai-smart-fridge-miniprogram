const config = require('../config')
const { prepareImageForUpload } = require('../utils/imageUpload')

function clientEnvironment() {
  let envVersion = 'unknown'
  try {
    const accountInfo = wx.getAccountInfoSync()
    envVersion = accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion || 'unknown'
  } catch (error) {}
  return { envVersion, cloudEnvId: config.cloudEnv || 'current-associated-environment' }
}

function safeCallResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const allowed = ['errCode', 'errMsg', 'code', 'message', 'requestID', 'requestId', 'buildId', 'configured', 'reason']
  const result = {}
  allowed.forEach(key => {
    const item = value[key]
    if (['string', 'number', 'boolean'].includes(typeof item)) result[key] = item
  })
  return Object.keys(result).length ? result : undefined
}

function callErrorDiagnostics(error = {}) {
  const result = safeCallResult(error.result)
  const requestId = error.requestID || error.requestId || (result && (result.requestID || result.requestId)) || ''
  return {
    errCode: error.errCode === undefined ? '' : error.errCode,
    errMsg: String(error.errMsg || error.message || ''),
    requestId: String(requestId || ''),
    ...(result ? { result } : {})
  }
}

function friendlyCallError(message, diagnostics) {
  const error = new Error(message)
  error.errCode = diagnostics.errCode
  error.errMsg = diagnostics.errMsg
  error.requestId = diagnostics.requestId
  if (diagnostics.result) error.result = diagnostics.result
  return error
}

async function callSmartFood(action, data = {}) {
  const environment = clientEnvironment()
  console.log('[smartFood client request]', {
    action,
    ...environment,
    timestamp: new Date().toISOString()
  })
  try {
    const response = await wx.cloud.callFunction({ name: 'smartFood', data: { action, ...data } })
    if (!response.result) throw new Error('智能服务未返回结果')
    console.log('[smartFood client success]', {
      action,
      hasResult: true,
      configured: typeof response.result.configured === 'boolean' ? response.result.configured : undefined,
      buildId: response.result.buildId || undefined,
      requestId: response.requestID || response.requestId || ''
    })
    return response.result
  } catch (error) {
    const diagnostics = callErrorDiagnostics(error)
    console.error('[smartFood client failure]', { action, ...diagnostics })
    const message = diagnostics.errMsg
    if (message.includes('缺少 OCR 模型配置')) throw friendlyCallError('缺少 OCR 模型配置', diagnostics)
    if (message.includes('尚未配置')) throw friendlyCallError('智能服务尚未配置', diagnostics)
    if (message.includes('图片不能超过')) throw friendlyCallError('图片不能超过 10MB', diagnostics)
    throw friendlyCallError(message.includes('cancel') ? 'USER_CANCELLED' : '智能服务暂时不可用，请稍后重试', diagnostics)
  }
}

function mimeTypeForPath(path) {
  const lower = String(path || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function chooseAndProcessImage(mode, options = {}) {
  let fileID = ''
  let activeStage = 'upload'
  const startedAt = Date.now()
  const logPrefix = mode === 'receipt' ? '[OCR]' : '[Vision]'
  const development = clientEnvironment().envVersion === 'develop'
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {}
  try {
    onStage(activeStage, 'active')
    const choice = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['camera', 'album'], sizeType: ['compressed'] })
    const file = choice.tempFiles && choice.tempFiles[0]
    if (!file || !file.tempFilePath) throw new Error('USER_CANCELLED')
    const prepared = await prepareImageForUpload(file)
    const extension = String(prepared.path).match(/\.(png|webp|jpe?g)$/i)
    const cloudPath = `smart-temp/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension ? extension[1].toLowerCase() : 'jpg'}`
    const uploadStartedAt = Date.now()
    const upload = await wx.cloud.uploadFile({ cloudPath, filePath: prepared.path })
    fileID = upload.fileID
    if (development) console.log(logPrefix, { stage: 'upload', durationMs: Date.now() - uploadStartedAt, processedBytes: prepared.size })
    onStage(activeStage, 'done')
    activeStage = 'recognize'
    onStage(activeStage, 'active')
    const recognitionStartedAt = Date.now()
    const result = await callSmartFood(mode === 'receipt' ? 'parseReceipt' : 'recognizeFoods', {
      fileID,
      mimeType: mimeTypeForPath(prepared.path)
    })
    if (development) console.log(logPrefix, { stage: 'recognize', durationMs: Date.now() - recognitionStartedAt, totalMs: Date.now() - startedAt })
    onStage(activeStage, 'done')
    activeStage = 'organize'
    onStage(activeStage, 'active')
    if (!result || !Array.isArray(result.foods)) throw new Error('识别结果格式无效')
    onStage(activeStage, 'done')
    return result
  } catch (error) {
    const message = String(error.errMsg || error.message || '')
    if (message.includes('cancel') || message === 'USER_CANCELLED') throw new Error('USER_CANCELLED')
    onStage(activeStage, 'error')
    throw error
  } finally {
    if (fileID) {
      try { await wx.cloud.deleteFile({ fileList: [fileID] }) } catch (error) {
        console.warn('客户端清理临时图片失败，云函数也会尝试清理', { fileID, errMsg: error.errMsg || error.message })
      }
    }
  }
}

let recipeRequest = null
let forcedRecipeRequest = null
function generateRecipe(forceRefresh = false, excludedTitles = []) {
  const current = forceRefresh ? forcedRecipeRequest : recipeRequest
  if (current) return current
  const development = clientEnvironment().envVersion === 'develop'
  const request = callSmartFood('generateRecipe', {
    forceRefresh: Boolean(forceRefresh),
    excludedTitles: forceRefresh ? excludedTitles : [],
    debugRecipe: development
  }).then(result => {
    if (development && result && result.ok === false) console.error('[Recipe Debug] client diagnostic', result.diagnostic || { reason: result.reason, errorCode: result.errorCode })
    return result
  })
  const tracked = request.finally(() => {
    if (forceRefresh && forcedRecipeRequest === tracked) forcedRecipeRequest = null
    if (!forceRefresh && recipeRequest === tracked) recipeRequest = null
  })
  if (forceRefresh) forcedRecipeRequest = tracked
  else recipeRequest = tracked
  return tracked
}
function askFoodSafety(question) { return callSmartFood('askFoodSafety', { question }) }
// Deprecated: 新增食材和识别导入已改用 utils/foodShelfLifeRules.js，保留导出只为旧调用兼容。
function recommendShelfLife(name, storageArea = '') { return callSmartFood('recommendShelfLife', { name, storageArea }) }
function getCapabilities() { return callSmartFood('getCapabilities') }
function testProviderConnection() {
  const { envVersion } = clientEnvironment()
  if (envVersion !== 'develop') return Promise.reject(new Error('此诊断仅限开发环境'))
  return callSmartFood('testProviderConnection', { clientEnvVersion: envVersion })
}

module.exports = {
  callSmartFood,
  mimeTypeForPath,
  chooseAndProcessImage,
  prepareImageForUpload,
  generateRecipe,
  askFoodSafety,
  recommendShelfLife,
  getCapabilities,
  testProviderConnection,
  _test: { safeCallResult, callErrorDiagnostics }
}
