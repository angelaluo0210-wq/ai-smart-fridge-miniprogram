const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const config = require('./config')
const visionProvider = require('./providers/visionProvider')
const llmProvider = require('./providers/llmProvider')
const { normalizeVisionResult } = require('./logic/vision')
const { normalizeOcrResult, parseReceiptText } = require('./logic/receipt')
const {
  recipeCandidates, inventoryFingerprint, compactInventory, normalizeRecipe, normalizeRecipeBatch,
  recipesFromCache, canUseRecipeCache
} = require('./logic/recipe')
const { answerSafetyQuestion } = require('./logic/safety')
const { DEFAULT_RULES, SAFETY_RULES, normalizeName, recommendShelfLife, matchingRule, normalizeModelExplanation } = require('./logic/shelfLife')
const { requireOcrModel } = require('./logic/modelRouting')
const { canAccessFridge } = require('./access')
const { naturalDayTimestamp, remainingDays, localDateForOffset } = require('./date')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const command = db.command
const ACTIONS = new Set(['recognizeFoods', 'parseReceipt', 'generateRecipe', 'askFoodSafety', 'recommendShelfLife', 'getCapabilities', 'testProviderConnection'])
const SMART_FOOD_BUILD_ID = 'phase3-recipe-debug-20260826'

async function fetchAll(collection, where = {}) {
  const rows = []
  while (true) {
    const { data } = await db.collection(collection).where(where).skip(rows.length).limit(100).get()
    rows.push(...data)
    if (data.length < 100) return rows
  }
}

async function accessibleInventory(openid) {
  const membershipRows = await fetchAll('household_members', { user_openid: openid })
  const membership = membershipRows[0] || null
  const selectedRows = membership ? await fetchAll('fridge_members', { user_openid: openid }) : []
  const context = {
    householdId: membership ? membership.household_id : '',
    selectedFridgeIds: new Set(selectedRows.map(row => row.fridge_id))
  }
  const fridges = (await fetchAll('fridges')).filter(fridge => canAccessFridge(openid, fridge, context))
  const foods = []
  for (let index = 0; index < fridges.length; index += 20) {
    const ids = fridges.slice(index, index + 20).map(fridge => fridge._id)
    if (ids.length) foods.push(...await fetchAll('foods', { fridge_id: command.in(ids) }))
  }
  return { fridges, foods }
}

async function currentUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get()
  return result.data[0] || {}
}

async function processTemporaryImage(event, handler) {
  const fileID = String(event.fileID || '')
  if (!fileID.startsWith('cloud://')) throw new Error('图片文件无效')
  try {
    const result = await cloud.downloadFile({ fileID })
    const buffer = result.fileContent
    if (!buffer || !buffer.length) throw new Error('图片内容为空')
    if (buffer.length > config.maxImageBytes) throw new Error('图片不能超过 10MB')
    const mimeType = /^image\/(jpeg|png|webp)$/.test(String(event.mimeType || '')) ? event.mimeType : 'image/jpeg'
    return await handler(buffer, mimeType)
  } finally {
    try { await cloud.deleteFile({ fileList: [fileID] }) } catch (error) {
      console.error('[临时图片删除失败]', { fileID, errMsg: error.errMsg || error.message })
    }
  }
}

async function recognizeFoods(event) {
  return processTemporaryImage(event, async (buffer, mimeType) => {
    if (!visionProvider.isVisionConfigured()) return { configured: false, provider: config.providerName, foods: [], reason: 'provider_not_configured' }
    const normalized = normalizeVisionResult(await visionProvider.recognizeFoods(buffer, mimeType))
    return { configured: true, provider: config.providerName, ...normalized }
  })
}

async function parseReceipt(event) {
  return processTemporaryImage(event, async (buffer, mimeType) => {
    requireOcrModel(config.ocrModel)
    if (!visionProvider.isOcrConfigured()) return { configured: false, provider: config.providerName, foods: [], reason: 'provider_not_configured' }
    const text = normalizeOcrResult(await visionProvider.recognizeReceipt(buffer, mimeType))
    return { configured: true, provider: config.providerName, ...parseReceiptText(text) }
  })
}

const recipeInFlight = new Map()

function recipeCacheId(openid, fingerprint) {
  return `rc_${crypto.createHash('sha256').update(`${openid}|${fingerprint}`).digest('hex').slice(0, 29)}`
}

async function readRecipeCache(id) {
  try { return { ok: true, data: (await db.collection(config.recipeCacheCollection).doc(id).get()).data || null } } catch (error) {
    const message = String(error.errMsg || error.message || '')
    if (/does not exist|not found/i.test(message)) return { ok: true, data: null }
    console.error('[Recipe Debug] D cache read failed', { name: error.name, message })
    return { ok: false, data: null }
  }
}

async function saveRecipeCache(id, openid, localDate, fingerprint, recipes) {
  const data = {
    _openid: openid, local_date: localDate, inventory_fingerprint: fingerprint,
    recipes, recipe: recipes[0] || null, generated_at: db.serverDate(), updated_at: db.serverDate()
  }
  try {
    await db.collection(config.recipeCacheCollection).doc(id).set({ data })
    return true
  } catch (writeError) {
    console.error('[菜谱缓存写入失败]', { errMsg: writeError.errMsg || writeError.message })
    return false
  }
}

function normalizeExcludedRecipeTitles(value) {
  return (Array.isArray(value) ? value : []).map(item => String(item || '').trim().slice(0, 50)).filter(Boolean).slice(0, 10)
}

async function generateRecipe(openid, forceRefresh = false, excludedTitleValues = [], debugRecipe = false) {
  let stage = 'A'
  const startedAt = Date.now()
  let providerStartedAt = 0
  const excludedTitles = forceRefresh ? normalizeExcludedRecipeTitles(excludedTitleValues) : []
  const providerMeta = { httpStatus: 0, durationMs: 0, providerErrorCode: '', providerErrorMessage: '', requestId: '' }
  try {
    console.log('[Recipe Debug] A action entered', { forceRefresh: Boolean(forceRefresh), excludedTitlesCount: excludedTitles.length })
    if (!llmProvider.isConfigured()) {
      console.log('[Recipe Debug] K returning response', { reason: 'provider_not_configured', durationMs: Date.now() - startedAt })
      return { configured: false, provider: config.providerName, recipe: null, recipes: [], reason: 'provider_not_configured' }
    }

    stage = 'B'
    const [{ foods }, user] = await Promise.all([accessibleInventory(openid), currentUser(openid)])
    console.log('[Recipe Debug] B foods loaded', { foodsCount: foods.length })
    const localDate = localDateForOffset(user.timezone_offset_minutes)
    const candidates = recipeCandidates(foods, food => remainingDays(food.expire_date, localDate))
    if (!candidates.length) {
      console.log('[Recipe Debug] K returning response', { reason: 'empty_inventory', durationMs: Date.now() - startedAt })
      return { configured: true, provider: config.providerName, recipe: null, recipes: [], reason: 'empty_inventory' }
    }

    stage = 'C'
    const fingerprint = inventoryFingerprint(candidates)
    const cacheId = recipeCacheId(openid, fingerprint)
    console.log('[Recipe Debug] C fingerprint generated', { fingerprintGenerated: Boolean(fingerprint), candidatesCount: candidates.length })

    stage = 'D'
    const cacheResult = forceRefresh ? { ok: true, data: null, bypassed: true } : await readRecipeCache(cacheId)
    const cachedRecipes = recipesFromCache(cacheResult.data)
    console.log('[Recipe Debug] D cache checked', { cacheReadSuccess: cacheResult.ok, cacheBypassed: Boolean(cacheResult.bypassed), cacheHit: cachedRecipes.length > 0 })
    if (canUseRecipeCache(cacheResult.data, forceRefresh)) {
      console.log('[Recipe Debug] K returning response', { cached: true, recipesCount: cachedRecipes.length, durationMs: Date.now() - startedAt })
      return { configured: true, provider: config.providerName, recipes: cachedRecipes, recipe: cachedRecipes[0], cached: true, localDate, fingerprint }
    }

    const inFlightKey = `${openid}|${fingerprint}|${forceRefresh ? 'refresh' : 'normal'}`
    if (recipeInFlight.has(inFlightKey)) return await recipeInFlight.get(inFlightKey)
    const inventory = compactInventory(candidates)
    const request = (async () => {
      stage = 'E'
      const preparedRequest = llmProvider.buildRecipeRequest(inventory, { forceRefresh, excludedTitles })
      console.log('[Recipe Debug] E prompt built', {
        inventoryCount: inventory.length,
        excludedTitlesCount: excludedTitles.length,
        forceRefresh: Boolean(forceRefresh),
        promptChars: preparedRequest.promptChars,
        maxTokens: preparedRequest.maxTokens,
        temperature: preparedRequest.temperature
      })
      stage = 'F'
      providerStartedAt = Date.now()
      console.log('[Recipe Debug] F provider request starting', { model: config.textModel, forceRefresh: Boolean(forceRefresh) })
      const providerResult = await llmProvider.generateRecipe(inventory, {
        forceRefresh,
        excludedTitles,
        preparedRequest,
        exposeDiagnostics: debugRecipe,
        onProviderStage: info => {
          if (info.stage === 'response_received') {
            stage = 'G'
            providerMeta.httpStatus = info.httpStatus
            providerMeta.durationMs = Date.now() - providerStartedAt
            console.log('[Recipe Debug] G provider response received', { httpStatus: info.httpStatus, responseBytes: info.responseBytes, providerDurationMs: providerMeta.durationMs })
          } else if (info.stage === 'response_parsing') {
            stage = 'H'
          } else if (info.stage === 'response_parsed') {
            stage = 'H'
            console.log('[Recipe Debug] H response parsed', info)
          }
        }
      })
      providerMeta.durationMs = Date.now() - providerStartedAt

      stage = 'I'
      let recipes = normalizeRecipeBatch(providerResult, inventory, 3, excludedTitles)
      if (!recipes.length) {
        const legacy = normalizeRecipe(providerResult, inventory)
        if (legacy) recipes = [legacy]
      }
      console.log('[Recipe Debug] I recipes normalized', { recipesCount: recipes.length, providerDurationMs: providerMeta.durationMs })
      const newRecipeTitles = recipes.map(recipe => recipe.title)
      if (!recipes.length || (forceRefresh && recipes.length < 3)) {
        console.error('[Recipe Debug] FAILED', { stage: 'I', name: 'RecipeValidationError', message: 'Provider 未返回足够的有效新菜谱', stack: '' })
        const invalidResult = {
          ok: false, configured: true, provider: config.providerName, recipes: [], recipe: null, reason: 'invalid_provider_result', errorCode: 'RECIPE_GENERATION_FAILED',
          refreshDiagnostics: forceRefresh ? { cacheBypassed: true, providerCalled: true, oldRecipeTitles: excludedTitles, newRecipeTitles } : undefined
        }
        if (debugRecipe) invalidResult.diagnostic = {
          stage: 'I', message: 'Provider 未返回足够的有效新菜谱', httpStatus: providerMeta.httpStatus,
          providerErrorCode: '', providerErrorMessage: '', requestId: '', providerDurationMs: providerMeta.durationMs,
          totalDurationMs: Date.now() - startedAt, recipesCount: recipes.length
        }
        console.log('[Recipe Debug] K returning response', { reason: 'invalid_provider_result', recipesCount: recipes.length, totalDurationMs: Date.now() - startedAt })
        return invalidResult
      }

      stage = 'J'
      const cacheWritten = await saveRecipeCache(cacheId, openid, localDate, fingerprint, recipes)
      console.log('[Recipe Debug] J cache written', { cacheWritten, recipesCount: recipes.length })
      stage = 'K'
      console.log('[Recipe Debug] K returning response', { cached: false, recipesCount: recipes.length, totalDurationMs: Date.now() - startedAt })
      return {
        ok: true, configured: true, provider: config.providerName, recipes, recipe: recipes[0], cached: false, localDate, fingerprint,
        refreshDiagnostics: forceRefresh ? { cacheBypassed: true, providerCalled: true, oldRecipeTitles: excludedTitles, newRecipeTitles } : undefined
      }
    })()
    recipeInFlight.set(inFlightKey, request)
    try { return await request } finally { recipeInFlight.delete(inFlightKey) }
  } catch (error) {
    if (providerStartedAt && !providerMeta.durationMs) providerMeta.durationMs = Date.now() - providerStartedAt
    providerMeta.httpStatus = Number(error.httpStatus) || providerMeta.httpStatus
    providerMeta.providerErrorCode = error.providerErrorCode || (String(error.message || '').includes('超时') ? 'PROVIDER_TIMEOUT' : '')
    providerMeta.providerErrorMessage = error.providerErrorMessage || ''
    providerMeta.requestId = error.requestId || ''
    console.error('[Recipe Debug] FAILED', { stage, name: error && error.name, message: error && error.message, stack: error && error.stack })
    const result = { ok: false, configured: true, provider: config.providerName, recipe: null, recipes: [], reason: 'recipe_generation_failed', errorCode: 'RECIPE_GENERATION_FAILED' }
    if (debugRecipe) result.diagnostic = {
      stage,
      message: String(error && error.message || '菜谱生成失败').slice(0, 300),
      httpStatus: providerMeta.httpStatus,
      providerErrorCode: providerMeta.providerErrorCode,
      providerErrorMessage: String(providerMeta.providerErrorMessage || '').slice(0, 500),
      requestId: providerMeta.requestId,
      providerDurationMs: providerMeta.durationMs,
      totalDurationMs: Date.now() - startedAt
    }
    return result
  }
}

async function testProviderConnection(event) {
  if (String(event.clientEnvVersion || '') !== 'develop') throw new Error('此诊断仅限开发环境')
  try {
    const result = await llmProvider.testConnection()
    return {
      ok: true,
      buildId: SMART_FOOD_BUILD_ID,
      provider: config.providerName,
      model: config.textModel,
      httpStatus: result.httpStatus
    }
  } catch (error) {
    return {
      ok: false,
      buildId: SMART_FOOD_BUILD_ID,
      provider: config.providerName,
      model: config.textModel,
      httpStatus: Number(error.httpStatus) || 0,
      providerErrorCode: error.providerErrorCode || 'PROVIDER_REQUEST_FAILED',
      providerErrorMessage: error.providerErrorMessage || 'Provider 请求未成功',
      requestId: error.requestId || ''
    }
  }
}

async function safetyDocuments() {
  try { return await fetchAll(config.safetyCollection, { active: true }) } catch (error) {
    console.error('[食品安全知识库读取失败]', { errMsg: error.errMsg || error.message })
    return []
  }
}

async function askFoodSafety(questionValue) {
  const question = String(questionValue || '').trim().slice(0, 200)
  if (!question) throw new Error('请输入食品安全问题')
  return answerSafetyQuestion({
    question,
    mode: config.safetyMode,
    provider: llmProvider,
    loadDocuments: safetyDocuments,
    allowedHosts: config.allowedSafetyHosts
  })
}

function consumedHistoryDays(foods, name, offsetMinutes) {
  const normalized = normalizeName(name)
  return foods.filter(food => food.status === 'consumed' && normalizeName(food.name) === normalized && food.consumed_at && food.put_in_date)
    .map(food => {
      const timestamp = new Date(food.consumed_at).getTime()
      if (!Number.isFinite(timestamp)) return null
      try {
        const consumedDate = localDateForOffset(offsetMinutes, timestamp)
        const days = Math.round((naturalDayTimestamp(consumedDate) - naturalDayTimestamp(food.put_in_date)) / 86400000)
        return days >= 0 && days <= 365 ? Math.max(1, days) : null
      } catch (error) { return null }
    }).filter(Boolean)
}

function recommendationExplanation(result) {
  const labels = { template: '你的常用模板', history: '你的历史使用习惯', safety: '内置保守上限（请参考包装）', default: '内置食材规则', fallback: '通用默认值' }
  return `${labels[result.source]}建议保存 ${result.days} 天${result.safetyCapped ? '，已按安全上限缩短' : ''}`
}

async function recommendForUser(openid, event) {
  const name = String(event.name || '').trim().slice(0, 30)
  if (!name) throw new Error('请先填写食材名称')
  const [{ foods }, user, templates] = await Promise.all([
    accessibleInventory(openid), currentUser(openid), fetchAll('food_templates', { _openid: openid })
  ])
  const template = templates.find(item => normalizeName(item.name) === normalizeName(name)) || null
  const defaultRule = matchingRule(name, DEFAULT_RULES)
  const safetyRule = matchingRule(name, SAFETY_RULES)
  const result = recommendShelfLife({
    template,
    historyDays: consumedHistoryDays(foods, name, user.timezone_offset_minutes),
    safetyRule,
    defaultRule,
    fallbackDays: 3
  })
  const fallbackExplanation = recommendationExplanation(result)
  let explanation = fallbackExplanation
  if (llmProvider.isConfigured()) {
    try {
      explanation = normalizeModelExplanation(await llmProvider.explainShelfLife(name, result), fallbackExplanation)
    } catch (error) {
      console.warn('[保存建议文本生成失败] 使用确定性说明', { errMsg: error.errMsg || error.message })
    }
  }
  return { ...result, explanation }
}

exports.main = async event => {
  const action = String(event && event.action || '')
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  console.log('[smartFood entry]', {
    action,
    hasWxOpenid: Boolean(openid),
    buildId: SMART_FOOD_BUILD_ID,
    timestamp: new Date().toISOString()
  })
  if (!ACTIONS.has(action)) throw new Error('不支持的智能服务操作')
  if (!openid) throw new Error('无法获取微信用户身份')
  try {
    if (action === 'getCapabilities') return {
      buildId: SMART_FOOD_BUILD_ID,
      provider: config.providerName,
      vision: visionProvider.isVisionConfigured(),
      ocr: visionProvider.isOcrConfigured(),
      text: llmProvider.isConfigured(),
      llm: llmProvider.isConfigured(),
      models: { vision: config.visionModel, ocr: config.ocrModel, text: config.textModel }
    }
    if (action === 'testProviderConnection') return await testProviderConnection(event)
    if (action === 'recognizeFoods') return await recognizeFoods(event)
    if (action === 'parseReceipt') return await parseReceipt(event)
    if (action === 'generateRecipe') return await generateRecipe(openid, event.forceRefresh === true, event.excludedTitles, event.debugRecipe === true)
    if (action === 'askFoodSafety') return await askFoodSafety(event.question)
    if (action === 'recommendShelfLife') return await recommendForUser(openid, event)
  } catch (error) {
    console.error('[smartFood 调用失败]', { action, hasWxOpenid: Boolean(openid), errMsg: error.errMsg || error.message })
    throw new Error(error.message === 'SMART_FOOD_PROVIDER_NOT_CONFIGURED' ? '智能服务尚未配置' : error.message)
  }
}

exports._test = { recipeCacheId, consumedHistoryDays, recommendationExplanation, SMART_FOOD_BUILD_ID }
