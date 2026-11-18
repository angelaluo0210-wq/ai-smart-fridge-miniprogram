const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
function naturalDayTimestamp(value) {
  if (!DATE_PATTERN.test(String(value || ''))) throw new Error('日期格式不正确')
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('日期不存在')
  return timestamp
}
function remainingDays(expireDate, today) { return Math.round((naturalDayTimestamp(expireDate) - naturalDayTimestamp(today)) / 86400000) }
function localDateForOffset(offsetMinutes, now = Date.now()) {
  const offset = Number(offsetMinutes)
  const safeOffset = Number.isFinite(offset) && offset >= -840 && offset <= 840 ? offset : -480
  const date = new Date(Number(now) - safeOffset * 60000)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}
module.exports = { naturalDayTimestamp, remainingDays, localDateForOffset }
