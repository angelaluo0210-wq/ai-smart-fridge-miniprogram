const assert = require('assert')
const {
  readSeed,
  validateSeed,
  documentData,
  parseMode,
  credentialDiagnostic,
  normalizeApiKey,
  buildPlan,
  summarize
} = require('../scripts/import-food-safety-seed')

const seed = readSeed()
const validation = validateSeed(seed)
assert.strictEqual(validation.documentCount, 20)
assert.deepStrictEqual(validation.allowedHosts, ['nhc.gov.cn', 'www.nhc.gov.cn', 'samr.gov.cn', 'www.samr.gov.cn'])

const first = seed.documents[0]
const stored = documentData(first)
assert.strictEqual(stored._id, undefined)
assert.strictEqual(stored.country, first.country)
assert.strictEqual(stored.source_type, first.source_type)
assert.strictEqual(stored.topic, first.topic)
assert.strictEqual(stored.priority, first.priority)
assert.strictEqual(stored.updated_at, first.updated_at)

function invalid(mutator) {
  const clone = JSON.parse(JSON.stringify(seed))
  mutator(clone)
  return clone
}

assert.throws(() => validateSeed(invalid(value => { delete value.documents[0].title })), /缺少必填字段 title/)
assert.throws(() => validateSeed(invalid(value => { value.documents[0].url = 'http://www.nhc.gov.cn/test' })), /必须是无凭据 HTTPS URL/)
assert.throws(() => validateSeed(invalid(value => { value.documents[0].url = 'https://example.com/test' })), /host 不在/)
assert.throws(() => validateSeed(invalid(value => { value.documents[1]._id = value.documents[0]._id })), /重复 _id/)
assert.throws(() => validateSeed(invalid(value => { value.documents[0].keywords = [] })), /keywords/)
assert.throws(() => validateSeed(invalid(value => { value.documents[0].active = 'true' })), /active 必须是 boolean/)

assert.strictEqual(parseMode([]), '--dry-run')
assert.strictEqual(parseMode(['--apply']), '--apply')
assert.throws(() => parseMode(['--apply', '--dry-run']), /一次只能指定一个模式/)
assert.deepStrictEqual(credentialDiagnostic(' key-value\r\n'), {
  hasApiKey: true,
  length: 12,
  hasCR: true,
  hasLF: true,
  hasOuterWhitespace: true
})
assert.deepStrictEqual(credentialDiagnostic(''), {
  hasApiKey: false,
  length: 0,
  hasCR: false,
  hasLF: false,
  hasOuterWhitespace: false
})
assert.strictEqual(normalizeApiKey('  raw-key  '), 'raw-key')
assert.throws(() => normalizeApiKey('Bearer raw-key'), /不需要 Bearer/)
assert.throws(() => normalizeApiKey('{"apiKey":"raw-key"}'), /不能是 JSON/)
assert.throws(() => normalizeApiKey('line1\nline2'), /含 CR\/LF/)
assert.throws(() => normalizeApiKey('raw key'), /可见 ASCII/)
assert.throws(() => normalizeApiKey('ApiKey：raw-key'), /可见 ASCII/)
assert.deepStrictEqual(summarize([{ action: 'create' }, { action: 'update' }, { action: 'skip' }, { action: 'skip' }]), {
  create: 1,
  update: 1,
  skip: 2
})

async function testIdempotentPlan() {
  const same = seed.documents[0]
  const changed = { ...seed.documents[1], title: '数据库中的旧标题' }
  const existingById = new Map([[same._id, same], [changed._id, changed]])
  const collection = {
    where(query) {
      return {
        limit() {
          return { get: async () => ({ data: existingById.has(query._id) ? [existingById.get(query._id)] : [] }) }
        }
      }
    }
  }
  const plan = await buildPlan(collection, seed.documents.slice(0, 3))
  assert.deepStrictEqual(plan.map(item => item.action), ['skip', 'update', 'create'])
}

testIdempotentPlan()
  .then(() => console.log('food_safety_seed_cn 结构、字段、HTTPS host 和幂等计划测试全部通过'))
  .catch(error => { console.error(error); process.exitCode = 1 })
