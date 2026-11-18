const DIRECT_UPLOAD_BYTES = Math.round(1.5 * 1024 * 1024)
const TARGET_UPLOAD_BYTES = 2 * 1024 * 1024
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const MAX_LONG_EDGE = 1920

function resizedDimensions(width, height, maxLongEdge = MAX_LONG_EDGE) {
  const sourceWidth = Math.max(1, Number(width) || 1)
  const sourceHeight = Math.max(1, Number(height) || 1)
  const scale = Math.min(1, maxLongEdge / Math.max(sourceWidth, sourceHeight))
  return { width: Math.round(sourceWidth * scale), height: Math.round(sourceHeight * scale) }
}

function shouldCompress(meta) {
  return Number(meta.size) > DIRECT_UPLOAD_BYTES || Math.max(Number(meta.width) || 0, Number(meta.height) || 0) > MAX_LONG_EDGE
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => wx.getImageInfo({ src, success: resolve, fail: reject }))
}

function getFileSize(filePath, knownSize) {
  if (Number.isFinite(Number(knownSize)) && Number(knownSize) > 0) return Promise.resolve(Number(knownSize))
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().getFileInfo({ filePath, success: result => resolve(Number(result.size) || 0), fail: reject })
  })
}

function compressImage(src, dimensions, quality) {
  return new Promise((resolve, reject) => wx.compressImage({
    src,
    quality,
    compressedWidth: dimensions.width,
    compressedHeight: dimensions.height,
    success: result => resolve(result.tempFilePath),
    fail: reject
  }))
}

function isDevelop() {
  try { return wx.getAccountInfoSync().miniProgram.envVersion === 'develop' } catch (error) { return false }
}

function mb(bytes) { return `${(Number(bytes || 0) / 1024 / 1024).toFixed(2)} MB` }

async function prepareImageForUpload(file) {
  const startedAt = Date.now()
  const sourcePath = file && file.tempFilePath
  if (!sourcePath) throw new Error('未读取到图片')
  const [sourceInfo, sourceSize] = await Promise.all([getImageInfo(sourcePath), getFileSize(sourcePath, file.size)])
  const sourceMeta = { path: sourcePath, size: sourceSize, width: sourceInfo.width, height: sourceInfo.height }
  if (!shouldCompress(sourceMeta)) {
    if (isDevelop()) console.log('[图片预处理]', { original: `${mb(sourceSize)} ${sourceInfo.width}x${sourceInfo.height}`, processed: '直接使用', durationMs: Date.now() - startedAt })
    return { ...sourceMeta, compressed: false }
  }

  const dimensions = resizedDimensions(sourceInfo.width, sourceInfo.height)
  let processedPath = sourcePath
  let processedSize = sourceSize
  let processedInfo = sourceInfo
  for (const quality of [82, 68, 55]) {
    processedPath = await compressImage(processedPath, dimensions, quality)
    processedSize = await getFileSize(processedPath)
    processedInfo = await getImageInfo(processedPath)
    if (processedSize <= TARGET_UPLOAD_BYTES && Math.max(processedInfo.width, processedInfo.height) <= MAX_LONG_EDGE) break
  }
  if (processedSize > MAX_UPLOAD_BYTES) throw new Error('图片处理后仍然过大，请换一张图片')
  if (isDevelop()) console.log('[图片预处理]', {
    original: `${mb(sourceSize)} ${sourceInfo.width}x${sourceInfo.height}`,
    processed: `${mb(processedSize)} ${processedInfo.width}x${processedInfo.height}`,
    durationMs: Date.now() - startedAt
  })
  return { path: processedPath, size: processedSize, width: processedInfo.width, height: processedInfo.height, compressed: true }
}

module.exports = {
  prepareImageForUpload,
  _test: { DIRECT_UPLOAD_BYTES, TARGET_UPLOAD_BYTES, MAX_UPLOAD_BYTES, MAX_LONG_EDGE, resizedDimensions, shouldCompress }
}
