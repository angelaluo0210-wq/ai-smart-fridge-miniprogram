const fs = require('fs')
const path = require('path')

const DEFAULT_SEED_PATH = path.resolve(__dirname, '..', 'data', 'food_safety_seed_cn.json')
const DEFAULT_COLLECTION = 'food_safety_documents'
const REQUIRED_FIELDS = ['_id', 'title', 'organization', 'url', 'content', 'keywords', 'active']
const DOCUMENT_FIELDS = [
  'title', 'organization', 'url', 'content', 'keywords', 'active',
  'country', 'source_type', 'topic', 'priority', 'updated_at'
]

function fail(message) { throw new Error(message) }

function readSeed(seedPath = DEFAULT_SEED_PATH) {
  let value
  try { value = JSON.parse(fs.readFileSync(seedPath, 'utf8')) } catch (error) {
    fail(`无法读取 seed JSON：${error.message}`)
  }
  return value
}

function validateNonEmptyString(value, field, id) {
  if (typeof value !== 'string' || !value.trim()) fail(`${id || 'document'} 缺少有效 ${field}`)
}

function validateSeed(seed) {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) fail('seed 顶层必须是对象')
  if (!Array.isArray(seed.recommended_allowed_hosts) || !seed.recommended_allowed_hosts.length) {
    fail('recommended_allowed_hosts 必须是非空数组')
  }
  const allowedHosts = seed.recommended_allowed_hosts.map(host => {
    validateNonEmptyString(host, 'recommended_allowed_hosts')
    const normalized = host.trim().toLowerCase()
    if (normalized.includes('/') || normalized.includes(':')) fail(`recommended_allowed_hosts 包含非法 host：${host}`)
    return normalized
  })
  if (new Set(allowedHosts).size !== allowedHosts.length) fail('recommended_allowed_hosts 包含重复项')
  if (!Array.isArray(seed.documents)) fail('documents 必须是数组')

  const ids = new Set()
  seed.documents.forEach((document, index) => {
    const label = `documents[${index}]`
    if (!document || typeof document !== 'object' || Array.isArray(document)) fail(`${label} 必须是对象`)
    REQUIRED_FIELDS.forEach(field => {
      if (!Object.prototype.hasOwnProperty.call(document, field)) fail(`${label} 缺少必填字段 ${field}`)
    })
    validateNonEmptyString(document._id, '_id', label)
    if (document._id !== document._id.trim() || document._id.length > 128 || document._id.includes('/')) {
      fail(`${label} 的 _id 非法`)
    }
    if (ids.has(document._id)) fail(`documents 包含重复 _id：${document._id}`)
    ids.add(document._id)
    validateNonEmptyString(document.title, 'title', document._id)
    validateNonEmptyString(document.organization, 'organization', document._id)
    validateNonEmptyString(document.content, 'content', document._id)
    if (!Array.isArray(document.keywords) || !document.keywords.length || document.keywords.some(item => typeof item !== 'string' || !item.trim())) {
      fail(`${document._id} 的 keywords 必须是非空字符串数组`)
    }
    if (typeof document.active !== 'boolean') fail(`${document._id} 的 active 必须是 boolean`)

    let sourceUrl
    try { sourceUrl = new URL(document.url) } catch (error) { fail(`${document._id} 的 url 非法`) }
    if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password) fail(`${document._id} 的 url 必须是无凭据 HTTPS URL`)
    if (!allowedHosts.includes(sourceUrl.hostname.toLowerCase())) fail(`${document._id} 的 url host 不在 recommended_allowed_hosts 中`)

    ;['country', 'source_type', 'topic'].forEach(field => {
      if (Object.prototype.hasOwnProperty.call(document, field)) validateNonEmptyString(document[field], field, document._id)
    })
    if (Object.prototype.hasOwnProperty.call(document, 'priority') && !Number.isFinite(document.priority)) {
      fail(`${document._id} 的 priority 必须是有限数字`)
    }
    if (Object.prototype.hasOwnProperty.call(document, 'updated_at')) {
      validateNonEmptyString(document.updated_at, 'updated_at', document._id)
      if (!Number.isFinite(Date.parse(document.updated_at))) fail(`${document._id} 的 updated_at 不是合法日期时间`)
    }
  })
  return { documentCount: seed.documents.length, allowedHosts }
}

function documentData(document) {
  return DOCUMENT_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(document, field)) result[field] = document[field]
    return result
  }, {})
}

function comparableData(document) {
  return JSON.stringify(documentData(document || {}))
}

function parseMode(args) {
  const modes = ['--validate-only', '--credential-diagnostic', '--dry-run', '--apply', '--verify'].filter(mode => args.includes(mode))
  if (modes.length > 1) fail('一次只能指定一个模式')
  return modes[0] || '--dry-run'
}

function credentialDiagnostic(value) {
  const key = typeof value === 'string' ? value : ''
  return {
    hasApiKey: key.length > 0,
    length: key.length,
    hasCR: key.includes('\r'),
    hasLF: key.includes('\n'),
    hasOuterWhitespace: key !== key.trim()
  }
}

function normalizeApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : ''
  if (!key) fail('缺少 CLOUDBASE_APIKEY')
  if (key.includes('\r') || key.includes('\n')) fail('CLOUDBASE_APIKEY 含 CR/LF，请只设置控制台复制的单行原始 ApiKey')
  if (/^Bearer\s+/i.test(key)) fail('CLOUDBASE_APIKEY 不需要 Bearer 前缀')
  if (/^[{[]/.test(key)) fail('CLOUDBASE_APIKEY 必须是原始 ApiKey 字符串，不能是 JSON 或多字段 credential')
  if (!/^[\x21-\x7e]+$/.test(key)) fail('CLOUDBASE_APIKEY 必须是单行可见 ASCII 原始 token，不能包含内部空白或控制字符')
  return key
}

async function loadExisting(collection, id) {
  const result = await collection.where({ _id: id }).limit(1).get()
  return Array.isArray(result.data) && result.data.length ? result.data[0] : null
}

async function buildPlan(collection, documents) {
  const entries = []
  for (const document of documents) {
    const existing = await loadExisting(collection, document._id)
    const action = !existing ? 'create' : comparableData(existing) === comparableData(document) ? 'skip' : 'update'
    entries.push({ id: document._id, action, data: documentData(document) })
  }
  return entries
}

function summarize(entries) {
  return entries.reduce((result, entry) => {
    result[entry.action] += 1
    return result
  }, { create: 0, update: 0, skip: 0 })
}

function cloudbaseApp(envId) {
  let cloudbase
  try { cloudbase = require('@cloudbase/node-sdk') } catch (error) {
    fail('缺少 @cloudbase/node-sdk，请先运行 npm install')
  }
  return cloudbase.init({ env: envId })
}

async function main() {
  const mode = parseMode(process.argv.slice(2))
  const seed = readSeed()
  const validation = validateSeed(seed)
  console.log('[seed validation]', { documents: validation.documentCount, allowedHosts: validation.allowedHosts.length })
  if (mode === '--validate-only') return

  const envId = String(process.env.CLOUDBASE_ENV_ID || '').trim()
  const rawApiKey = typeof process.env.CLOUDBASE_APIKEY === 'string' ? process.env.CLOUDBASE_APIKEY : ''
  console.log('[credential diagnostic]', credentialDiagnostic(rawApiKey))
  if (mode === '--credential-diagnostic') return
  if (!envId) fail('缺少 CLOUDBASE_ENV_ID')
  process.env.CLOUDBASE_APIKEY = normalizeApiKey(rawApiKey)
  const collectionName = String(process.env.FOOD_SAFETY_COLLECTION || DEFAULT_COLLECTION).trim()
  if (!collectionName) fail('FOOD_SAFETY_COLLECTION 不能为空')

  const collection = cloudbaseApp(envId).database().collection(collectionName)
  const plan = await buildPlan(collection, seed.documents)
  const summary = summarize(plan)

  if (mode === '--verify') {
    const verification = { expected: seed.documents.length, matched: summary.skip, missing: summary.create, different: summary.update }
    console.log('[food safety seed verify]', verification)
    if (verification.matched !== verification.expected) process.exitCode = 2
    return
  }

  console.log('[food safety seed plan]', {
    mode: mode === '--apply' ? 'apply' : 'dry-run',
    collection: collectionName,
    create: summary.create,
    update: summary.update,
    skip: summary.skip
  })
  if (mode !== '--apply') return

  for (const entry of plan) {
    if (entry.action === 'skip') continue
    const reference = collection.doc(entry.id)
    if (entry.action === 'create') await reference.set(entry.data)
    else await reference.update(entry.data)
  }
  console.log('[food safety seed imported]', { created: summary.create, updated: summary.update, skipped: summary.skip })
}

if (require.main === module) {
  main().catch(error => {
    console.error('[food safety seed import failed]', { message: error.message })
    process.exitCode = 1
  })
}

module.exports = {
  DEFAULT_SEED_PATH,
  REQUIRED_FIELDS,
  DOCUMENT_FIELDS,
  readSeed,
  validateSeed,
  documentData,
  comparableData,
  parseMode,
  credentialDiagnostic,
  normalizeApiKey,
  buildPlan,
  summarize
}
