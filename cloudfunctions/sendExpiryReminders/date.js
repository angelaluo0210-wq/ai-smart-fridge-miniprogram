const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toUtcNaturalDay(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new Error(`日期格式不正确: ${value}`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`日期不存在: ${value}`)
  }
  return timestamp
}

function getRemainingDays(expireDate, today) {
  return Math.round((toUtcNaturalDay(expireDate) - toUtcNaturalDay(today)) / 86400000)
}

// timezoneOffsetMinutes 与 Date#getTimezoneOffset() 语义一致：UTC - 本地时间。
function todayForTimezoneOffset(timezoneOffsetMinutes, now = Date.now()) {
  const offset = Number(timezoneOffsetMinutes)
  if (!Number.isFinite(offset) || offset < -840 || offset > 840) {
    throw new Error(`时区偏移无效: ${timezoneOffsetMinutes}`)
  }
  const local = new Date(Number(now) - offset * 60000)
  const year = local.getUTCFullYear()
  const month = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

module.exports = { toUtcNaturalDay, getRemainingDays, todayForTimezoneOffset }
