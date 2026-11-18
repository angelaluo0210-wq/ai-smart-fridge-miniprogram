const assert = require('assert')
const imageUpload = require('../miniprogram/utils/imageUpload')

const { resizedDimensions, shouldCompress, DIRECT_UPLOAD_BYTES, MAX_LONG_EDGE } = imageUpload._test
assert.deepStrictEqual(resizedDimensions(4032, 3024), { width: 1920, height: 1440 })
assert.deepStrictEqual(resizedDimensions(1200, 800), { width: 1200, height: 800 })
assert.strictEqual(shouldCompress({ size: DIRECT_UPLOAD_BYTES - 1, width: 1200, height: 800 }), false)
assert.strictEqual(shouldCompress({ size: DIRECT_UPLOAD_BYTES + 1, width: 1200, height: 800 }), true)
assert.strictEqual(shouldCompress({ size: 500000, width: MAX_LONG_EDGE + 1, height: 800 }), true)

async function run() {
  let source = { path: 'small.jpg', size: 1024 * 1024, width: 1200, height: 800 }
  let compressCalls = 0
  let uploadCalls = 0
  let deleteCalls = 0
  let functionCalls = 0
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }),
    chooseMedia: async () => ({ tempFiles: [{ tempFilePath: source.path, size: source.size }] }),
    getImageInfo: ({ src, success }) => {
      if (src === 'compressed.jpg') success({ width: 1920, height: 1440 })
      else success({ width: source.width, height: source.height })
    },
    getFileSystemManager: () => ({ getFileInfo: ({ filePath, success }) => success({ size: filePath === 'compressed.jpg' ? 1.4 * 1024 * 1024 : source.size }) }),
    compressImage: ({ success }) => { compressCalls += 1; success({ tempFilePath: 'compressed.jpg' }) },
    cloud: {
      uploadFile: async ({ filePath }) => { uploadCalls += 1; assert.strictEqual(filePath, source.size > DIRECT_UPLOAD_BYTES ? 'compressed.jpg' : source.path); return { fileID: 'cloud://env/smart-temp/test.jpg' } },
      callFunction: async () => { functionCalls += 1; return { result: { configured: true, foods: [{ name: '牛奶' }] } } },
      deleteFile: async () => { deleteCalls += 1 }
    }
  }
  delete require.cache[require.resolve('../miniprogram/services/smartFood')]
  const smartFood = require('../miniprogram/services/smartFood')
  const smallStages = []
  await smartFood.chooseAndProcessImage('vision', { onStage: (key, status) => smallStages.push(`${key}:${status}`) })
  assert.strictEqual(compressCalls, 0, 'small image bypasses compression')
  assert.deepStrictEqual(smallStages, ['upload:active', 'upload:done', 'recognize:active', 'recognize:done', 'organize:active', 'organize:done'])

  source = { path: 'large.jpg', size: 10 * 1024 * 1024, width: 4032, height: 3024 }
  await smartFood.chooseAndProcessImage('receipt')
  assert.strictEqual(compressCalls, 1, 'large 4K image is compressed before upload')
  assert.strictEqual(uploadCalls, 2)
  assert.strictEqual(deleteCalls, 2, 'cloud temporary file is cleaned after both flows')

  const failureStages = []
  wx.cloud.callFunction = async () => { functionCalls += 1; throw new Error('provider failed') }
  await assert.rejects(
    smartFood.chooseAndProcessImage('vision', { onStage: (key, status) => failureStages.push(`${key}:${status}`) }),
    /智能服务暂时不可用/
  )
  assert.ok(failureStages.includes('recognize:error'), 'recognition failure marks the actual failed stage')
  assert.strictEqual(deleteCalls, 3, 'failed recognition still cleans cloud temporary file')

  let resolveRequest
  wx.cloud.callFunction = () => { functionCalls += 1; return new Promise(resolve => { resolveRequest = resolve }) }
  const first = smartFood.generateRecipe()
  const second = smartFood.generateRecipe()
  assert.strictEqual(first, second, 'concurrent recipe reads reuse one client request')
  resolveRequest({ result: { recipes: [] } })
  await Promise.all([first, second])
  assert.strictEqual(functionCalls, 4, 'only one cloud call is added for two concurrent recipe reads')

  const refreshPayloads = []
  wx.cloud.callFunction = async options => {
    functionCalls += 1
    refreshPayloads.push(options.data)
    return { result: { recipes: [{ title: `新菜${functionCalls}` }] } }
  }
  await smartFood.generateRecipe(true, ['旧菜A', '旧菜B'])
  await smartFood.generateRecipe(true, ['旧菜A', '旧菜B'])
  assert.strictEqual(refreshPayloads.length, 2, 'completed forced request releases its lock for the next click')
  assert.strictEqual(refreshPayloads[0].forceRefresh, true)
  assert.deepStrictEqual(refreshPayloads[0].excludedTitles, ['旧菜A', '旧菜B'])
  console.log('图片压缩决策、真实阶段、临时云文件清理和菜谱请求锁测试全部通过')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
